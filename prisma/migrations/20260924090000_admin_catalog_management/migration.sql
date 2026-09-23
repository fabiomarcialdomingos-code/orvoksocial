GRANT SELECT, INSERT, UPDATE ON "Question", "QuestionVersion", "AnswerOption" TO orvok_app_runtime;
GRANT SELECT, INSERT, UPDATE ON "WorldCategory", "WorldEvent", "WorldOpportunity" TO orvok_app_runtime;

CREATE POLICY admin_question_select ON "Question" FOR SELECT TO orvok_app_runtime
  USING (EXISTS (SELECT 1 FROM "User" WHERE id=orvok_current_actor() AND role='ADMIN'));
CREATE POLICY admin_question_version_select ON "QuestionVersion" FOR SELECT TO orvok_app_runtime
  USING (EXISTS (SELECT 1 FROM "User" WHERE id=orvok_current_actor() AND role='ADMIN'));
CREATE POLICY admin_option_select ON "AnswerOption" FOR SELECT TO orvok_app_runtime
  USING (EXISTS (SELECT 1 FROM "User" WHERE id=orvok_current_actor() AND role='ADMIN'));
CREATE POLICY admin_world_event_select ON "WorldEvent" FOR SELECT TO orvok_app_runtime
  USING (EXISTS (SELECT 1 FROM "User" WHERE id=orvok_current_actor() AND role='ADMIN'));
CREATE POLICY admin_world_opportunity_select ON "WorldOpportunity" FOR SELECT TO orvok_app_runtime
  USING (EXISTS (SELECT 1 FROM "User" WHERE id=orvok_current_actor() AND role='ADMIN'));
