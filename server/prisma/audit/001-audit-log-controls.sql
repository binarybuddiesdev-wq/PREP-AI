DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_auditor') THEN
    CREATE ROLE prepai_auditor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_audit_maintenance') THEN
    CREATE ROLE prepai_audit_maintenance NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;

REVOKE ALL ON TABLE public."AuditLog" FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO prepai_auditor, prepai_audit_maintenance;
GRANT SELECT ON TABLE public."AuditLog" TO prepai_auditor;
GRANT SELECT, INSERT, DELETE ON TABLE public."AuditLog" TO prepai_audit_maintenance;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_api') THEN
    REVOKE ALL ON TABLE public."AuditLog" FROM prepai_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_worker') THEN
    REVOKE ALL ON TABLE public."AuditLog" FROM prepai_worker;
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.prepai_append_audit_log(
  audit_id text,
  actor_type text,
  actor_id text,
  subject_user_id text,
  audit_action text,
  resource_type text,
  resource_id text,
  event_key text,
  audit_details jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  allowed_keys text[];
  required_keys text[];
BEGIN
  IF audit_id IS NULL OR octet_length(audit_id) > 128
     OR actor_type NOT IN ('ADMIN', 'USER', 'SYSTEM', 'PROVIDER', 'ANONYMOUS')
     OR octet_length(coalesce(actor_id, '')) > 128
     OR octet_length(coalesce(subject_user_id, '')) > 128
     OR octet_length(coalesce(resource_id, '')) > 128
     OR event_key IS NULL OR octet_length(event_key) > 512
     OR octet_length(coalesce(audit_details::text, '')) > 2048 THEN
    RAISE EXCEPTION 'Audit event exceeds allowed fields or sizes' USING ERRCODE = '22023';
  END IF;

  CASE audit_action
    WHEN 'payment.subscription_cancelled' THEN
      IF resource_type <> 'payment_subscription' THEN RAISE EXCEPTION 'Invalid audit resource' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY[]::text[]; required_keys := ARRAY[]::text[];
    WHEN 'payment.refund_requested' THEN
      IF resource_type <> 'payment_refund' OR actor_type <> 'ADMIN' THEN RAISE EXCEPTION 'Invalid audit resource or actor' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY['chargeId', 'amountMinor', 'currency']; required_keys := allowed_keys;
    WHEN 'payment.refund_state_changed' THEN
      IF resource_type <> 'payment_refund' OR actor_type <> 'PROVIDER' THEN RAISE EXCEPTION 'Invalid audit resource or actor' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY['status', 'providerRefundId']; required_keys := ARRAY['status'];
    WHEN 'payment.webhook_received' THEN
      IF resource_type <> 'payment_webhook_event' OR actor_type <> 'PROVIDER' THEN RAISE EXCEPTION 'Invalid audit resource or actor' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY['eventType']; required_keys := allowed_keys;
    WHEN 'user.role_projection_requested' THEN
      IF resource_type <> 'user' OR actor_type <> 'SYSTEM' THEN RAISE EXCEPTION 'Invalid audit resource or actor' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY['fromRole', 'toRole']; required_keys := allowed_keys;
    WHEN 'user.account_deleted' THEN
      IF resource_type <> 'user' OR actor_type <> 'PROVIDER' THEN RAISE EXCEPTION 'Invalid audit resource or actor' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY[]::text[]; required_keys := ARRAY[]::text[];
    WHEN 'webhook.signature_failed' THEN
      IF resource_type <> 'webhook' OR actor_type <> 'ANONYMOUS' THEN RAISE EXCEPTION 'Invalid audit resource or actor' USING ERRCODE = '22023'; END IF;
      allowed_keys := ARRAY['provider', 'route']; required_keys := allowed_keys;
    ELSE
      RAISE EXCEPTION 'Audit action is not allow-listed' USING ERRCODE = '22023';
  END CASE;

  IF audit_details IS NOT NULL AND jsonb_typeof(audit_details) <> 'object' THEN
    RAISE EXCEPTION 'Audit details must be a JSON object' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_object_keys(coalesce(audit_details, '{}'::jsonb)) AS detail_keys(key)
    WHERE key <> ALL(allowed_keys)
  ) OR EXISTS (
    SELECT 1 FROM unnest(required_keys) AS required_keys(key)
    WHERE NOT coalesce(audit_details, '{}'::jsonb) ? key
  ) THEN
    RAISE EXCEPTION 'Audit details contain missing or non-allow-listed fields' USING ERRCODE = '22023';
  END IF;

  IF audit_action = 'webhook.signature_failed' AND NOT coalesce((
    (audit_details->>'provider' = 'CLERK'
      AND audit_details->>'route' = 'webhooks/clerk'
      AND event_key ~ '^webhook-signature:clerk:webhooks/clerk:[0-9]+$')
    OR (audit_details->>'provider' = 'RAZORPAY'
      AND audit_details->>'route' = 'webhooks/razorpay'
      AND event_key ~ '^webhook-signature:razorpay:webhooks/razorpay:[0-9]+$')
  ), false) THEN
    RAISE EXCEPTION 'Invalid signature failure audit event' USING ERRCODE = '22023';
  END IF;
  IF audit_action = 'user.role_projection_requested' AND (
    audit_details->>'fromRole' IS NULL
    OR audit_details->>'fromRole' NOT IN ('USER', 'PREMIUM', 'ADMIN')
    OR audit_details->>'toRole' IS NULL
    OR audit_details->>'toRole' NOT IN ('USER', 'PREMIUM', 'ADMIN')
  ) THEN
    RAISE EXCEPTION 'Invalid role projection audit event' USING ERRCODE = '22023';
  END IF;
  IF audit_action = 'payment.refund_state_changed'
     AND (audit_details->>'status' IS NULL OR audit_details->>'status' NOT IN ('requested', 'pending', 'processed', 'failed')) THEN
    RAISE EXCEPTION 'Invalid refund state audit event' USING ERRCODE = '22023';
  END IF;
  IF audit_action = 'payment.refund_requested' AND (
    jsonb_typeof(audit_details->'amountMinor') IS DISTINCT FROM 'number'
    OR (audit_details->>'amountMinor')::numeric <= 0
    OR audit_details->>'chargeId' IS NULL
    OR audit_details->>'currency' IS NULL
    OR audit_details->>'currency' !~ '^[A-Z]{3}$'
  ) THEN
    RAISE EXCEPTION 'Invalid refund request audit event' USING ERRCODE = '22023';
  END IF;
  IF audit_action = 'payment.webhook_received' AND (audit_details->>'eventType' IS NULL OR audit_details->>'eventType' NOT IN (
    'subscription.authenticated', 'subscription.activated', 'subscription.charged',
    'subscription.pending', 'subscription.halted', 'subscription.paused',
    'subscription.resumed', 'subscription.cancelled', 'subscription.completed'
  )) THEN
    RAISE EXCEPTION 'Invalid payment webhook audit event' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public."AuditLog" (
    "id", "actorType", "actorId", "subjectUserId", "action",
    "resourceType", "resourceId", "eventKey", "details"
  ) VALUES (
    audit_id, actor_type, actor_id, subject_user_id, audit_action,
    resource_type, resource_id, event_key, audit_details
  )
  ON CONFLICT ("eventKey") DO NOTHING;
END
$$;

CREATE OR REPLACE FUNCTION public.prepai_reject_audit_log_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_user = 'prepai_audit_maintenance'
     AND OLD."createdAt" < now() - interval '2 years' THEN
    RETURN OLD;
  END IF;

  RAISE EXCEPTION 'AuditLog rows are append-only'
    USING ERRCODE = '42501';
END
$$;

DROP TRIGGER IF EXISTS prepai_audit_log_append_only ON public."AuditLog";
CREATE TRIGGER prepai_audit_log_append_only
BEFORE UPDATE OR DELETE ON public."AuditLog"
FOR EACH ROW EXECUTE FUNCTION public.prepai_reject_audit_log_mutation();

CREATE OR REPLACE FUNCTION public.prepai_prune_audit_log()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  DELETE FROM public."AuditLog"
  WHERE "createdAt" < now() - interval '2 years';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END
$$;

ALTER FUNCTION public.prepai_reject_audit_log_mutation() OWNER TO prepai_audit_maintenance;
ALTER FUNCTION public.prepai_prune_audit_log() OWNER TO prepai_audit_maintenance;
ALTER FUNCTION public.prepai_append_audit_log(text, text, text, text, text, text, text, text, jsonb) OWNER TO prepai_audit_maintenance;
REVOKE ALL ON FUNCTION public.prepai_reject_audit_log_mutation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepai_prune_audit_log() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepai_append_audit_log(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_prune_audit_log() TO prepai_audit_maintenance;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_api') THEN
    GRANT EXECUTE ON FUNCTION public.prepai_prune_audit_log() TO prepai_api;
    GRANT EXECUTE ON FUNCTION public.prepai_append_audit_log(text, text, text, text, text, text, text, text, jsonb) TO prepai_api;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_worker') THEN
    GRANT EXECUTE ON FUNCTION public.prepai_append_audit_log(text, text, text, text, text, text, text, text, jsonb) TO prepai_worker;
  END IF;
END
$$;

REVOKE UPDATE, DELETE, TRUNCATE ON TABLE public."AuditLog" FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prepai_append_audit_log(text, text, text, text, text, text, text, text, jsonb) FROM PUBLIC;
