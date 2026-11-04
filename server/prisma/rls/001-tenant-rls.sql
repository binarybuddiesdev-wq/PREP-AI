\set ON_ERROR_STOP on

SELECT format(
  'CREATE ROLE prepai_api LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'api_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_api')
\gexec
ALTER ROLE prepai_api LOGIN PASSWORD :'api_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

SELECT format(
  'CREATE ROLE prepai_worker LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS',
  :'worker_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_worker')
\gexec
ALTER ROLE prepai_worker LOGIN PASSWORD :'worker_password' NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;

SELECT 'CREATE ROLE prepai_rls_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prepai_rls_function_owner')
\gexec
ALTER ROLE prepai_rls_function_owner NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT BYPASSRLS;

SELECT format('GRANT CONNECT ON DATABASE %I TO prepai_api, prepai_worker', current_database())
\gexec
GRANT USAGE ON SCHEMA public TO prepai_api, prepai_worker, prepai_rls_function_owner;

GRANT SELECT, INSERT, UPDATE, DELETE ON
  public."TheorySession",
  public."TheoryAnswer",
  public."CodingSession",
  public."CodingAnswer",
  public."CodingExecution",
  public."CodingQuestion",
  public."PaymentSubscription",
  public."PaymentWebhookEvent"
TO prepai_api;

GRANT SELECT ON public."CodingQuestion" TO prepai_worker;
GRANT SELECT ON public."TheorySession" TO prepai_worker;
GRANT SELECT, UPDATE ON public."TheoryAnswer" TO prepai_worker;
GRANT SELECT, UPDATE ON public."CodingSession" TO prepai_worker;
GRANT SELECT, UPDATE ON public."CodingExecution" TO prepai_worker;
GRANT SELECT, INSERT ON public."CodingAnswer" TO prepai_worker;
GRANT UPDATE ("aiReviewStatus", "aiReviewJson", "aiReviewFailureMessage", "aiReviewProvider", "aiReviewModel", "aiReviewPromptVersion")
  ON public."CodingAnswer" TO prepai_worker;
GRANT UPDATE ("pdfGenerationStatus", "pdfGenerationError", "pdfQuestions")
  ON public."TheorySession" TO prepai_worker;
GRANT UPDATE ("pdfDispatchClaimedAt")
  ON public."TheorySession" TO prepai_rls_function_owner;

GRANT SELECT ON
  public."TheorySession",
  public."TheoryAnswer",
  public."CodingSession",
  public."CodingExecution"
TO prepai_rls_function_owner;
GRANT UPDATE ("dispatchClaimedAt") ON
  public."TheoryAnswer",
  public."CodingExecution"
TO prepai_rls_function_owner;
GRANT SELECT ON public."CodingAnswer" TO prepai_rls_function_owner;
GRANT UPDATE ("aiReviewDispatchClaimedAt")
  ON public."CodingAnswer" TO prepai_rls_function_owner;

CREATE OR REPLACE FUNCTION public.prepai_list_queued_theory_answer_ids(p_limit integer)
RETURNS TABLE(answer_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT answer.id
    FROM public."TheoryAnswer" AS answer
    WHERE answer.status = 'queued'
      AND (answer."dispatchClaimedAt" IS NULL OR answer."dispatchClaimedAt" < now() - interval '30 seconds')
    ORDER BY answer."createdAt" ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public."TheoryAnswer" AS answer
  SET "dispatchClaimedAt" = now()
  FROM candidates
  WHERE answer.id = candidates.id
  RETURNING answer.id
$$;
ALTER FUNCTION public.prepai_list_queued_theory_answer_ids(integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_list_queued_theory_answer_ids(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_list_queued_theory_answer_ids(integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_get_theory_answer_owner(p_answer_id text)
RETURNS TABLE(owner_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT session."userId"
  FROM public."TheoryAnswer" AS answer
  JOIN public."TheorySession" AS session ON session.id = answer."sessionId"
  WHERE answer.id = p_answer_id
$$;
ALTER FUNCTION public.prepai_get_theory_answer_owner(text) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_get_theory_answer_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_get_theory_answer_owner(text) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_list_queued_coding_execution_ids(p_limit integer)
RETURNS TABLE(execution_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT execution.id
    FROM public."CodingExecution" AS execution
    WHERE execution.status = 'queued'
      AND (execution."dispatchClaimedAt" IS NULL OR execution."dispatchClaimedAt" < now() - interval '30 seconds')
    ORDER BY execution."createdAt" ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public."CodingExecution" AS execution
  SET "dispatchClaimedAt" = now()
  FROM candidates
  WHERE execution.id = candidates.id
  RETURNING execution.id
$$;
ALTER FUNCTION public.prepai_list_queued_coding_execution_ids(integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_list_queued_coding_execution_ids(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_list_queued_coding_execution_ids(integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_list_queued_coding_review_execution_ids(p_limit integer)
RETURNS TABLE(execution_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT answer."executionId" AS id
    FROM public."CodingAnswer" AS answer
    WHERE answer."executionId" IS NOT NULL
      AND answer."aiReviewStatus" = 'queued'
      AND (answer."aiReviewDispatchClaimedAt" IS NULL OR answer."aiReviewDispatchClaimedAt" < now() - interval '30 seconds')
    ORDER BY answer."createdAt" ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public."CodingAnswer" AS answer
  SET "aiReviewDispatchClaimedAt" = now()
  FROM candidates
  WHERE answer."executionId" = candidates.id
  RETURNING answer."executionId"
$$;
ALTER FUNCTION public.prepai_list_queued_coding_review_execution_ids(integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_list_queued_coding_review_execution_ids(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_list_queued_coding_review_execution_ids(integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_get_coding_execution_owner(p_execution_id text)
RETURNS TABLE(owner_id text, session_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT execution."userId", execution."sessionId"
  FROM public."CodingExecution" AS execution
  WHERE execution.id = p_execution_id
$$;
ALTER FUNCTION public.prepai_get_coding_execution_owner(text) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_get_coding_execution_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_get_coding_execution_owner(text) TO prepai_worker;

ALTER TABLE public."TheorySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TheorySession" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."TheoryAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."TheoryAnswer" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."CodingSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CodingSession" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."CodingExecution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CodingExecution" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."CodingAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."CodingAnswer" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS theory_session_api_tenant ON public."TheorySession";
CREATE POLICY theory_session_api_tenant ON public."TheorySession"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
DROP POLICY IF EXISTS theory_session_worker_tenant ON public."TheorySession";
CREATE POLICY theory_session_worker_tenant ON public."TheorySession"
  TO prepai_worker
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS theory_answer_api_tenant ON public."TheoryAnswer";
CREATE POLICY theory_answer_api_tenant ON public."TheoryAnswer"
  TO prepai_api
  USING (EXISTS (
    SELECT 1 FROM public."TheorySession" AS session
    WHERE session.id = "TheoryAnswer"."sessionId"
      AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public."TheorySession" AS session
    WHERE session.id = "TheoryAnswer"."sessionId"
      AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
  ));
DROP POLICY IF EXISTS theory_answer_worker_job ON public."TheoryAnswer";
CREATE POLICY theory_answer_worker_job ON public."TheoryAnswer"
  TO prepai_worker
  USING (
    id = NULLIF(current_setting('app.worker_job_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public."TheorySession" AS session
      WHERE session.id = "TheoryAnswer"."sessionId"
        AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.worker_job_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public."TheorySession" AS session
      WHERE session.id = "TheoryAnswer"."sessionId"
        AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  );

DROP POLICY IF EXISTS coding_session_api_tenant ON public."CodingSession";
CREATE POLICY coding_session_api_tenant ON public."CodingSession"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
DROP POLICY IF EXISTS coding_session_worker_tenant ON public."CodingSession";
CREATE POLICY coding_session_worker_tenant ON public."CodingSession"
  TO prepai_worker
  USING (
    id = NULLIF(current_setting('app.worker_session_id', true), '')
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.worker_session_id', true), '')
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
  );

DROP POLICY IF EXISTS coding_execution_api_tenant ON public."CodingExecution";
CREATE POLICY coding_execution_api_tenant ON public."CodingExecution"
  TO prepai_api
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public."CodingSession" AS session
      WHERE session.id = "CodingExecution"."sessionId"
        AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public."CodingSession" AS session
      WHERE session.id = "CodingExecution"."sessionId"
        AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  );
DROP POLICY IF EXISTS coding_execution_worker_job ON public."CodingExecution";
CREATE POLICY coding_execution_worker_job ON public."CodingExecution"
  TO prepai_worker
  USING (
    id = NULLIF(current_setting('app.worker_job_id', true), '')
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "sessionId" = NULLIF(current_setting('app.worker_session_id', true), '')
  )
  WITH CHECK (
    id = NULLIF(current_setting('app.worker_job_id', true), '')
    AND "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "sessionId" = NULLIF(current_setting('app.worker_session_id', true), '')
  );

DROP POLICY IF EXISTS coding_answer_api_tenant ON public."CodingAnswer";
CREATE POLICY coding_answer_api_tenant ON public."CodingAnswer"
  TO prepai_api
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND (
      "sessionId" IS NULL
      OR EXISTS (
        SELECT 1 FROM public."CodingSession" AS session
        WHERE session.id = "CodingAnswer"."sessionId"
          AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
      )
    )
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND (
      "sessionId" IS NULL
      OR EXISTS (
        SELECT 1 FROM public."CodingSession" AS session
        WHERE session.id = "CodingAnswer"."sessionId"
          AND session."userId" = NULLIF(current_setting('app.current_user_id', true), '')
      )
    )
  );
DROP POLICY IF EXISTS coding_answer_worker_job ON public."CodingAnswer";
CREATE POLICY coding_answer_worker_job ON public."CodingAnswer"
  TO prepai_worker
  USING (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "sessionId" = NULLIF(current_setting('app.worker_session_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public."CodingExecution" AS execution
      WHERE execution.id = NULLIF(current_setting('app.worker_job_id', true), '')
        AND execution."sessionId" = "CodingAnswer"."sessionId"
        AND execution."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  )
  WITH CHECK (
    "userId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "sessionId" = NULLIF(current_setting('app.worker_session_id', true), '')
    AND EXISTS (
      SELECT 1 FROM public."CodingExecution" AS execution
      WHERE execution.id = NULLIF(current_setting('app.worker_job_id', true), '')
        AND execution."sessionId" = "CodingAnswer"."sessionId"
        AND execution."userId" = NULLIF(current_setting('app.current_user_id', true), '')
    )
  );
