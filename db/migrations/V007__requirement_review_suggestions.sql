-- Existing tables only: add opt-in edit proposals and analysis snapshot metadata.
ALTER TABLE requirement_findings ADD (suggestion_data CLOB);
ALTER TABLE requirement_ai_drafts ADD (review_data CLOB);

-- 완전한 문장과 한국어 설명을 바이트 수 때문에 잘라내지 않도록 문자 단위로 맞춥니다.
ALTER TABLE requirement_findings MODIFY (target_span VARCHAR2(500 CHAR));
ALTER TABLE requirement_findings MODIFY (reason VARCHAR2(1000 CHAR));
ALTER TABLE requirement_findings MODIFY (suggestion VARCHAR2(1000 CHAR));
