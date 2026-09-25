WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
SET DEFINE OFF

DECLARE
  v_count NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM user_constraints WHERE constraint_name='FK_DEV_ISSUE_ARTIFACTS_ISSUE';
  IF v_count=1 THEN EXECUTE IMMEDIATE 'ALTER TABLE dev_issue_artifacts DROP CONSTRAINT fk_dev_issue_artifacts_issue'; END IF;
  EXECUTE IMMEDIATE 'ALTER TABLE dev_issue_artifacts ADD CONSTRAINT fk_dev_issue_artifacts_issue FOREIGN KEY (dev_issue_id) REFERENCES dev_issues(id)';
END;
/
ALTER TABLE dev_issue_artifacts ADD CONSTRAINT ck_artifact_schema CHECK(schema_version IN (1,2));
ALTER TABLE dev_issue_artifacts ADD CONSTRAINT ck_artifact_content_json CHECK(content_json IS JSON);
ALTER TABLE dev_issues ADD CONSTRAINT ck_dev_issue_state CHECK(issue_state IN ('DRAFT','CONFIRMED','RETIRED'));
INSERT INTO req_schema_history(version,checksum) VALUES ('V004','REQOPS_AGENT_CONSTRAINTS_20260925');
COMMIT;
