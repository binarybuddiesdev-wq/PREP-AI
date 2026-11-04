\set ON_ERROR_STOP on

-- The API owns user-scoped billing requests. The worker processes queued
-- reconciliation only for an explicitly supplied owner and operation.
GRANT SELECT, UPDATE ON
  public."PaymentSubscription",
  public."PaymentWebhookEvent",
  public."PaymentRefund"
TO prepai_worker;

GRANT SELECT ON public."PaymentCharge" TO prepai_api;

GRANT SELECT, UPDATE, DELETE ON
  public."PaymentSubscription",
  public."PaymentWebhookEvent",
  public."PaymentRefund"
TO prepai_rls_function_owner;
GRANT SELECT, DELETE ON public."PaymentCharge" TO prepai_rls_function_owner;

ALTER TABLE public."PaymentSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentSubscription" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentWebhookEvent" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentCharge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentCharge" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentRefund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentRefund" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_subscription_api_tenant ON public."PaymentSubscription";
CREATE POLICY payment_subscription_api_tenant ON public."PaymentSubscription"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
DROP POLICY IF EXISTS payment_subscription_worker_tenant ON public."PaymentSubscription";
CREATE POLICY payment_subscription_worker_tenant ON public."PaymentSubscription"
  TO prepai_worker
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS payment_webhook_event_api_tenant ON public."PaymentWebhookEvent";
CREATE POLICY payment_webhook_event_api_tenant ON public."PaymentWebhookEvent"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
DROP POLICY IF EXISTS payment_webhook_event_worker_job ON public."PaymentWebhookEvent";
CREATE POLICY payment_webhook_event_worker_job ON public."PaymentWebhookEvent"
  TO prepai_worker
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "eventId" = NULLIF(current_setting('app.worker_job_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "eventId" = NULLIF(current_setting('app.worker_job_id', true), '')
  );

DROP POLICY IF EXISTS payment_charge_api_tenant ON public."PaymentCharge";
CREATE POLICY payment_charge_api_tenant ON public."PaymentCharge"
  TO prepai_api
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    OR current_setting('app.current_user_is_admin', true) = 'true'
  )
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
DROP POLICY IF EXISTS payment_refund_api_tenant ON public."PaymentRefund";
CREATE POLICY payment_refund_api_tenant ON public."PaymentRefund"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
DROP POLICY IF EXISTS payment_refund_worker_job ON public."PaymentRefund";
CREATE POLICY payment_refund_worker_job ON public."PaymentRefund"
  TO prepai_worker
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND id = NULLIF(current_setting('app.worker_job_id', true), '')
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND id = NULLIF(current_setting('app.worker_job_id', true), '')
  );

CREATE OR REPLACE FUNCTION public.prepai_claim_pending_payment_webhook_events(p_limit integer)
RETURNS TABLE(id text, user_id text, event_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT event.id
    FROM public."PaymentWebhookEvent" AS event
    WHERE event.status = 'received'
      AND (event."dispatchClaimedAt" IS NULL OR event."dispatchClaimedAt" < now() - interval '60 seconds')
    ORDER BY event."createdAt" ASC, event.id ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public."PaymentWebhookEvent" AS event
  SET "dispatchClaimedAt" = now(), attempts = event.attempts + 1, "failureCode" = NULL
  FROM candidates
  WHERE event.id = candidates.id
  RETURNING event.id, event."userId", event."eventId"
$$;
ALTER FUNCTION public.prepai_claim_pending_payment_webhook_events(integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_claim_pending_payment_webhook_events(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_claim_pending_payment_webhook_events(integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_list_expired_payment_subscriptions(p_cutoff timestamptz, p_limit integer)
RETURNS TABLE(id text, user_id text, idempotency_key text, razorpay_subscription_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT subscription.id, subscription."userId", subscription."idempotencyKey", subscription."razorpaySubscriptionId"
  FROM public."PaymentSubscription" AS subscription
  WHERE subscription."razorpaySubscriptionId" IS NOT NULL
    AND (
      (subscription.status = 'active' AND subscription."currentEnd" <= p_cutoff)
      OR (
        subscription.status = 'cancelled'
        AND subscription."cancelAtPeriodEnd" = true
        AND subscription."currentEnd" <= p_cutoff
      )
    )
  ORDER BY subscription."currentEnd" ASC, subscription.id ASC
  LIMIT LEAST(GREATEST(p_limit, 1), 100)
$$;
ALTER FUNCTION public.prepai_list_expired_payment_subscriptions(timestamptz, integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_list_expired_payment_subscriptions(timestamptz, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_list_expired_payment_subscriptions(timestamptz, integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_claim_pending_payment_refunds(p_limit integer)
RETURNS TABLE(
  id text,
  user_id text,
  razorpay_payment_id text,
  razorpay_refund_id text,
  amount_minor integer,
  currency text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT refund.id
    FROM public."PaymentRefund" AS refund
    WHERE refund.status IN ('requested', 'pending')
      AND (refund."reconcileClaimedAt" IS NULL OR refund."reconcileClaimedAt" < now() - interval '60 seconds')
    ORDER BY refund."updatedAt" ASC, refund.id ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public."PaymentRefund" AS refund
  SET "reconcileClaimedAt" = now()
  FROM candidates
  WHERE refund.id = candidates.id
  RETURNING refund.id, refund."userId", refund."razorpayPaymentId", refund."razorpayRefundId", refund."amountMinor", refund.currency
$$;
ALTER FUNCTION public.prepai_claim_pending_payment_refunds(integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_claim_pending_payment_refunds(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_claim_pending_payment_refunds(integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_delete_expired_payment_ledger(p_cutoff timestamptz)
RETURNS TABLE(deleted_refunds integer, deleted_charges integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  refund_count integer;
  charge_count integer;
BEGIN
  DELETE FROM public."PaymentRefund" WHERE "createdAt" < p_cutoff;
  GET DIAGNOSTICS refund_count = ROW_COUNT;
  DELETE FROM public."PaymentCharge" WHERE "createdAt" < p_cutoff;
  GET DIAGNOSTICS charge_count = ROW_COUNT;
  RETURN QUERY SELECT refund_count, charge_count;
END;
$$;
ALTER FUNCTION public.prepai_delete_expired_payment_ledger(timestamptz) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_delete_expired_payment_ledger(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_delete_expired_payment_ledger(timestamptz) TO prepai_worker;
