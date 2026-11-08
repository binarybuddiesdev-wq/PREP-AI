\set ON_ERROR_STOP on

-- Exposure history is written only by authenticated API requests. It contains
-- opaque question IDs and is scoped to the current learner.
GRANT SELECT, INSERT ON public."QuestionExposure" TO prepai_api;
GRANT SELECT, INSERT, UPDATE ON public."QuestionRotation" TO prepai_api;
GRANT SELECT, INSERT ON public."CodingQuestion" TO prepai_worker;

ALTER TABLE public."QuestionExposure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QuestionExposure" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."QuestionRotation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."QuestionRotation" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS question_exposure_api_tenant ON public."QuestionExposure";
CREATE POLICY question_exposure_api_tenant ON public."QuestionExposure"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));

DROP POLICY IF EXISTS question_rotation_api_tenant ON public."QuestionRotation";
CREATE POLICY question_rotation_api_tenant ON public."QuestionRotation"
  TO prepai_api
  USING ("userId" = NULLIF(current_setting('app.current_user_id', true), ''))
  WITH CHECK ("userId" = NULLIF(current_setting('app.current_user_id', true), ''));
