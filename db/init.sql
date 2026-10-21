-- 이번 요구사항 검토 개선에 필요한 ALTER 문만 실행합니다.
-- Jira 테이블을 다시 만들지 않습니다. DBeaver에서 SQL 스크립트 실행하세요.
-- V007을 이미 적용했다면 이 파일은 실행하지 마세요.
ALTER TABLE requirement_findings ADD (suggestion_data CLOB);
ALTER TABLE requirement_ai_drafts ADD (review_data CLOB);

-- 완전한 문장과 한국어 설명을 바이트 수 때문에 잘라내지 않도록 문자 단위로 맞춥니다.
ALTER TABLE requirement_findings MODIFY (target_span VARCHAR2(500 CHAR));
ALTER TABLE requirement_findings MODIFY (reason VARCHAR2(1000 CHAR));
ALTER TABLE requirement_findings MODIFY (suggestion VARCHAR2(1000 CHAR));
