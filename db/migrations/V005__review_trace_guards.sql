WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
SET DEFINE OFF

DECLARE
  v_duplicates NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_duplicates
  FROM (
    SELECT target_type, target_id, knowledge_entry_id, quote_hash
    FROM evidence_links
    GROUP BY target_type, target_id, knowledge_entry_id, quote_hash
    HAVING COUNT(*) > 1
  );
  IF v_duplicates > 0 THEN
    RAISE_APPLICATION_ERROR(-20005,
      'Duplicate evidence links exist. Export and reconcile them before V005; this migration does not delete data.');
  END IF;
END;
/

CREATE INDEX ix_finding_open_blocker
  ON requirement_findings(requirement_id, severity, resolution_state);

CREATE INDEX ix_review_item_finding
  ON review_items(requirement_id, finding_id, state);

CREATE INDEX ix_issue_lineage_target
  ON issue_lineage(target_issue_id, relation_type);

CREATE UNIQUE INDEX uq_evidence_trace
  ON evidence_links(target_type, target_id, knowledge_entry_id, quote_hash);

INSERT INTO req_schema_history(version,checksum)
VALUES ('V005','REQOPS_REVIEW_TRACE_GUARDS_20260927');
COMMIT;
