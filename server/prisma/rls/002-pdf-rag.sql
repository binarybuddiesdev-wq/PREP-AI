\set ON_ERROR_STOP on

-- Run after `pnpm --filter server prisma:push:postgresql` has created PdfChunk.
-- pgvector must be installed in the PostgreSQL image before this script runs.
CREATE EXTENSION IF NOT EXISTS vector;

GRANT SELECT, INSERT, UPDATE, DELETE ON public."PdfChunk" TO prepai_api;
GRANT SELECT, INSERT, UPDATE, DELETE ON public."PdfChunk" TO prepai_worker;

ALTER TABLE public."PdfChunk" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PdfChunk" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pdf_chunk_api_tenant ON public."PdfChunk";
CREATE POLICY pdf_chunk_api_tenant ON public."PdfChunk"
  TO prepai_api
  USING ("ownerId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("ownerId" = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS pdf_chunk_worker_source ON public."PdfChunk";
CREATE POLICY pdf_chunk_worker_source ON public."PdfChunk"
  TO prepai_worker
  USING (
    "ownerId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "sourceId" = NULLIF(current_setting('app.worker_source_id', true), '')
    AND "revision" = NULLIF(current_setting('app.worker_revision', true), '')::integer
  )
  WITH CHECK (
    "ownerId" = NULLIF(current_setting('app.current_user_id', true), '')
    AND "sourceId" = NULLIF(current_setting('app.worker_source_id', true), '')
    AND "revision" = NULLIF(current_setting('app.worker_revision', true), '')::integer
  );

GRANT SELECT ON public."TheorySession" TO prepai_rls_function_owner;
CREATE OR REPLACE FUNCTION public.prepai_list_queued_pdf_study_session_ids(p_limit integer)
RETURNS TABLE(session_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT session.id
    FROM public."TheorySession" AS session
    WHERE session.mode = 'pdf'
      AND session."pdfGenerationStatus" = 'queued'
      AND (session."pdfDispatchClaimedAt" IS NULL OR session."pdfDispatchClaimedAt" < now() - interval '30 seconds')
    ORDER BY session."createdAt" ASC
    LIMIT LEAST(GREATEST(p_limit, 1), 100)
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public."TheorySession" AS session
  SET "pdfDispatchClaimedAt" = now()
  FROM candidates
  WHERE session.id = candidates.id
  RETURNING session.id
$$;
ALTER FUNCTION public.prepai_list_queued_pdf_study_session_ids(integer) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_list_queued_pdf_study_session_ids(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_list_queued_pdf_study_session_ids(integer) TO prepai_worker;

CREATE OR REPLACE FUNCTION public.prepai_get_pdf_study_session_owner(p_session_id text)
RETURNS TABLE(owner_id text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT session."userId"
  FROM public."TheorySession" AS session
  WHERE session.id = p_session_id
    AND session.mode = 'pdf'
$$;
ALTER FUNCTION public.prepai_get_pdf_study_session_owner(text) OWNER TO prepai_rls_function_owner;
REVOKE ALL ON FUNCTION public.prepai_get_pdf_study_session_owner(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prepai_get_pdf_study_session_owner(text) TO prepai_worker;
