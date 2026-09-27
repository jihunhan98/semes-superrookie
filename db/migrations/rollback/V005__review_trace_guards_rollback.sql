WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
SET DEFINE OFF

DROP INDEX uq_evidence_trace;
DROP INDEX ix_issue_lineage_target;
DROP INDEX ix_review_item_finding;
DROP INDEX ix_finding_open_blocker;
DELETE FROM req_schema_history WHERE version='V005';
COMMIT;
