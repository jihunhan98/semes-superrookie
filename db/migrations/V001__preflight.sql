WHENEVER SQLERROR EXIT SQL.SQLCODE ROLLBACK
SET PAGESIZE 500 LINESIZE 240 LONG 200000 LONGCHUNKSIZE 200000
PROMPT === ReqOps migration preflight (read only) ===
SELECT product, version, version_full FROM product_component_version WHERE product LIKE 'Oracle Database%';
SELECT parameter, value FROM nls_database_parameters WHERE parameter IN ('NLS_CHARACTERSET','NLS_NCHAR_CHARACTERSET');
SELECT table_name, num_rows FROM user_tables ORDER BY table_name;
SELECT table_name, column_id, column_name, data_type, data_length, nullable
  FROM user_tab_columns ORDER BY table_name, column_id;
SELECT constraint_name, constraint_type, table_name, status, delete_rule
  FROM user_constraints ORDER BY table_name, constraint_name;
SELECT index_name, table_name, uniqueness, status FROM user_indexes ORDER BY table_name, index_name;

PROMPT === data integrity counts ===
SELECT 'REQUIREMENTS_WITHOUT_PROJECT' check_name, COUNT(*) invalid_count
  FROM requirements r WHERE NOT EXISTS (SELECT 1 FROM projects p WHERE p.id=r.project_id);
SELECT 'DUPLICATE_REQ_KEY' check_name, COUNT(*) invalid_count FROM (
  SELECT project_id, req_key FROM requirements GROUP BY project_id, req_key HAVING COUNT(*) > 1
);
SELECT 'ISSUES_WITHOUT_REQUIREMENT' check_name, COUNT(*) invalid_count
  FROM dev_issues i WHERE NOT EXISTS (SELECT 1 FROM requirements r WHERE r.id=i.requirement_id);
SELECT 'ARTIFACTS_WITHOUT_ISSUE' check_name, COUNT(*) invalid_count
  FROM dev_issue_artifacts a WHERE NOT EXISTS (SELECT 1 FROM dev_issues i WHERE i.id=a.dev_issue_id);

PROMPT Export the schema and all LOBs with Data Pump before applying V002.
EXIT SUCCESS
