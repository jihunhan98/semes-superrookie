# ReqOps Oracle 마이그레이션 실행서

대상은 Oracle 19c/AL32UTF8 기준이며 운영 DB에서 `db/init.sql` 전체를 재실행하지 않는다.

1. writer를 중지하고 Data Pump로 스키마와 LOB를 포함해 export한다. export 파일과 row-count/LOB SHA-256 manifest를 별도 보관한다.
2. 테스트 복제본에 `sqlplus`로 접속한 뒤 `@db/migrations/V001__preflight.sql`을 실행한다. 고아·중복 건수가 0인지 확인한다.
3. `@db/migrations/V002__agent_expand.sql`을 적용한다. Oracle DDL은 implicit commit이므로 중간 실패 시 dictionary와 `REQ_SCHEMA_HISTORY`를 대조하고 무작정 재실행하지 않는다.
4. 애플리케이션을 `--reqops.migration.mode=verify`로 실행한 후 `import`, 다시 `verify` 순으로 실행한다. 두 번째 import에서 신규 mapping이 0건이어야 한다.
5. snapshot/hash/count가 원본과 일치한 뒤 `@db/migrations/V004__agent_constraints.sql`을 적용한다. legacy 테이블은 삭제하지 않고 읽기 전용으로 보존한다.
6. `@db/migrations/V005__review_trace_guards.sql`을 적용해 필수 검토 상태, 이슈 lineage, 산출물 근거 링크 조회용 인덱스와 근거 링크 중복 방지 인덱스를 생성한다. 되돌릴 때는 데이터 행을 삭제하지 않고 `db/migrations/rollback/V005__review_trace_guards_rollback.sql`로 인덱스와 ledger 행만 제거한다.

```bash
cd backend
ORACLE_TEST_URL='jdbc:oracle:thin:@//host:1521/service' ORACLE_TEST_USER='...' ORACLE_TEST_PASSWORD='...' ./mvnw -B -Poracle-it verify
./mvnw spring-boot:run -Dspring-boot.run.arguments=--reqops.migration.mode=verify
```

Windows에서는 같은 환경변수를 PowerShell `$env:ORACLE_TEST_URL=...` 형식으로 지정하고 `mvnw.cmd`를 사용한다. 비밀번호는 명령 이력에 남기지 말고 IDE/셸의 비밀 환경 설정을 사용한다.

롤백은 새 writer를 즉시 중지하고 export를 별도 스키마에 복원한 뒤 count/hash를 비교해 DNS/접속 문자열을 원복하는 방식으로 수행한다. 부분 DDL을 `ROLLBACK`만으로 되돌릴 수 있다고 가정하지 않는다.
