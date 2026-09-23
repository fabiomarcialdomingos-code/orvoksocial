GRANT INSERT, UPDATE ON "Question", "QuestionVersion", "AnswerOption" TO orvok_app_runtime;
GRANT INSERT ON "AuditLog" TO orvok_app_runtime;

CREATE POLICY app_question_insert ON "Question" FOR INSERT TO orvok_app_runtime
  WITH CHECK (orvok_read_actor() IS NOT NULL);
CREATE POLICY app_question_version_insert ON "QuestionVersion" FOR INSERT TO orvok_app_runtime
  WITH CHECK (orvok_read_actor() IS NOT NULL);
CREATE POLICY app_option_insert ON "AnswerOption" FOR INSERT TO orvok_app_runtime
  WITH CHECK (orvok_read_actor() IS NOT NULL);
