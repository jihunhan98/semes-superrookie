# Oracle 19c 스키마를 SQL 파일로 이전하는 방법

> 목적: 기존 Oracle 19c의 **데이터를 제외한 스키마 구조**를 SQL 파일로 내보내 메일 등으로 전달하고, 다른 Oracle 19c에서 실행한다. 대상은 테이블/컬럼/PK/FK/UNIQUE/CHECK/NOT NULL/인덱스/시퀀스/뷰/트리거/프로시저/패키지 등이다.

## 결론 및 도구 선택

- **Oracle SQL Developer의 Tools → Database Export**: 여러 객체의 DDL을 한 번에 내보내기 편리하다. 가장 먼저 권장.
- **DBeaver**: 테이블 등 객체의 **Generate SQL → DDL**로 생성 SQL을 확인·저장할 수 있다. 버전/에디션에 따라 스키마 전체 DDL 일괄 내보내기 메뉴 및 지원 범위가 다르므로, 개별 객체 DDL만 추출한 경우에는 전체 이전이 완료된 것으로 간주하지 않는다.
- **DBMS_METADATA**: SQLcl/SQL*Plus 등으로 메타데이터를 직접 추출할 수 있으나, 객체 유형과 종속성 순서를 직접 관리해야 한다.
- **Data Pump**: 완전성과 복원 자동화가 우선이면 `expdp CONTENT=METADATA_ONLY`가 더 안전하다.

## 0. 이전 전 점검

1. 원본/대상 DB가 모두 Oracle 19c인지, **CDB/PDB 및 서비스명**이 무엇인지 확인한다.
2. 원본 스키마 사용자명, 대상 사용자명, 기본/임시 테이블스페이스, quota, 필요한 권한을 확인한다.
3. 다른 스키마를 참조하는 FK, 뷰, 시노님, DB Link, DIRECTORY, 외부 파일/잡, 사용자 정의 타입 등 외부 의존성을 조사한다.
4. 대상 DB에서 새 스키마를 만들 권한이 있는지 DBA에게 확인한다. **SYS/SYSTEM 스키마를 통째로 복사하지 않는다.**
5. 기존 운영 DB에서는 DDL **조회/내보내기만** 수행하고, 추출한 SQL은 별도 테스트 DB에서 먼저 검증한다.
6. 추출된 SQL에는 계정명, 서버명, 경로, DB Link 연결 정보 등 민감한 메타데이터가 들어갈 수 있으므로 메일 전송/깃 업로드 전에 검토한다.

점검 SQL (스키마 사용자로 접속):

```sql
SELECT USER FROM DUAL;
SELECT SYS_CONTEXT('USERENV','CON_NAME') AS PDB_NAME FROM DUAL;
SELECT OBJECT_TYPE, COUNT(*) FROM USER_OBJECTS GROUP BY OBJECT_TYPE ORDER BY OBJECT_TYPE;
SELECT CONSTRAINT_TYPE, COUNT(*) FROM USER_CONSTRAINTS GROUP BY CONSTRAINT_TYPE ORDER BY CONSTRAINT_TYPE;
SELECT COUNT(*) AS TABLE_COUNT FROM USER_TABLES;
```

## 1. Oracle SQL Developer: 권장 GUI 절차

1. SQL Developer에서 **원본 Oracle 19c 스키마 계정**으로 연결한다.
2. **Tools(도구) → Database Export(데이터베이스 익스포트)** 를 연다. 메뉴 이름/화면은 버전에 따라 조금 다를 수 있다.
3. 연결을 선택하고, 출력 형식을 **SQL 파일**로 지정한다. 출력 경로 예: `oracle19c_schema.sql`.
4. **Export DDL / DDL 내보내기**를 켜고, **Export Data / 데이터 내보내기**는 끈다.
5. 필요한 객체 유형(테이블, 제약조건, 인덱스, 시퀀스, 뷰, 트리거, 함수/프로시저, 패키지, 타입 등)을 선택한다. 사용자/권한 생성 DDL은 별도 준비가 필요할 수 있다.
6. 스키마 및 대상 객체를 선택한다. 객체 필터 때문에 일부가 빠지지 않았는지 확인한다.
7. 완료 후 SQL 파일에서 `CREATE TABLE`, `ALTER TABLE ... ADD CONSTRAINT`, `CREATE INDEX`, `CREATE SEQUENCE`, `CREATE VIEW`, `CREATE TRIGGER` 등을 검색한다.
8. 원본 객체 개수와 출력 결과를 비교하고, 외부 스키마 참조 및 TABLESPACE/스토리지 설정을 점검한다.

**중요:** PK/FK/인덱스가 실제로 포함됐는지는 옵션과 출력 파일을 확인해야 한다. 메뉴를 실행했다는 사실만으로 모든 객체가 보존됐다고 단정할 수 없다.

## 2. DBeaver: DDL 추출 절차

1. 원본 Oracle 연결 → Database Navigator에서 스키마를 펼친다.
2. Tables 아래 대상 테이블을 선택하거나 여러 테이블을 선택한다.
3. 우클릭 → **Generate SQL → DDL** (또는 해당 버전의 DDL/SQL 생성 메뉴)를 선택한다.
4. 생성된 SQL을 SQL Editor에 열어 **.sql 파일로 저장**한다.
5. Views, Sequences, Triggers, Procedures, Packages, Types 등도 탐색기에서 각각 DDL 생성 가능 여부를 확인하고 별도로 내보낸다.
6. 특히 FK/PK/CHECK/UNIQUE, 독립 인덱스, 시퀀스, 트리거가 빠지지 않았는지 확인한다.

**주의:** DBeaver의 **Data Transfer / Export Data**는 주로 데이터 내보내기 기능이다. 이를 스키마 전체 DDL 백업 기능과 혼동하지 않는다. DBeaver 버전/에디션별 지원 기능이 다르므로, **스키마 전체를 파일 하나로 안전하게 추출해야 한다면 SQL Developer Database Export를 우선 사용**한다.

## 3. SQL만으로 추출: DBMS_METADATA 예시

Oracle의 `DBMS_METADATA.GET_DDL`은 개별 객체 DDL을 반환한다. 아래 예시는 **일부 객체 유형을 추출하는 참고용**이며, 전체 스키마의 완전한 내보내기 도구는 아니다.

SQLcl/SQL*Plus에서 실행 (SQL Developer의 일반 Run Statement가 아닌 Script 실행 환경이 필요):

```sql
SET LONG 1000000
SET LONGCHUNKSIZE 1000000
SET PAGESIZE 0
SET LINESIZE 32767
SET FEEDBACK OFF
SET HEADING OFF
SET TRIMSPOOL ON

BEGIN
  DBMS_METADATA.SET_TRANSFORM_PARAM(DBMS_METADATA.SESSION_TRANSFORM, 'SQLTERMINATOR', TRUE);
END;
/

SPOOL schema_partial.sql

SELECT DBMS_METADATA.GET_DDL('TABLE', TABLE_NAME) FROM USER_TABLES ORDER BY TABLE_NAME;
SELECT DBMS_METADATA.GET_DDL('SEQUENCE', SEQUENCE_NAME) FROM USER_SEQUENCES ORDER BY SEQUENCE_NAME;
SELECT DBMS_METADATA.GET_DDL('VIEW', VIEW_NAME) FROM USER_VIEWS ORDER BY VIEW_NAME;

SPOOL OFF
```

테이블 DDL의 제약조건 포함 여부는 `DBMS_METADATA` 변환 파라미터에 영향을 받는다. 특히 FK를 별도 `ALTER TABLE`로 나중에 생성하려면 `REF_CONSTRAINTS` 옵션 및 중복 출력 여부를 확인해야 한다. 독립 인덱스, 트리거, 프로시저, 패키지, 타입, 시노님, 권한 등은 별도 추출이 필요하다. 패키지/트리거 등 PL/SQL 객체의 실행 구분자(`/`)와 SQL 문장 구분자도 검증한다.

## 4. 대상 Oracle 19c에 복원

1. DBA가 대상 PDB에 **스키마 사용자**, 필요한 테이블스페이스/quota/권한을 먼저 준비한다. 원본에 포함된 사용자/권한 DDL이 있다면 대상 환경에 맞게 검토한다.
2. SQL 파일에서 원본 TABLESPACE명, 스토리지 절, 다른 스키마 참조, 경로, DB Link, 사용자명을 확인한다.
3. **빈 대상 스키마**에서 SQL Developer의 **Run Script (F5)** 또는 SQLcl/SQL*Plus의 `@oracle19c_schema.sql`로 실행한다. 단일 SQL 문 실행(Ctrl+Enter)과 혼동하지 않는다.
4. 스크립트가 객체 의존성을 올바르게 정렬하지 않았다면 다음 순서로 분리 실행한다.
   - 기본 타입/시퀀스 및 테이블 (FK는 후순위)
   - PK/UNIQUE/CHECK 및 독립 인덱스
   - FK (참조 대상 테이블/키 생성 후)
   - 뷰/프로시저/함수/패키지/트리거 등 (종속성에 맞게)
   - 시노님/권한 등 추가 객체
5. 실행 로그에서 ORA- 오류를 확인한다. 오류가 하나라도 있으면 '이전 완료'로 판단하지 않는다.

**실행 순서 예시:**

```sql
CREATE TABLE PARENT (ID NUMBER NOT NULL);
CREATE TABLE CHILD (ID NUMBER NOT NULL, PARENT_ID NUMBER);
ALTER TABLE PARENT ADD CONSTRAINT PK_PARENT PRIMARY KEY (ID);
ALTER TABLE CHILD ADD CONSTRAINT PK_CHILD PRIMARY KEY (ID);
ALTER TABLE CHILD ADD CONSTRAINT FK_CHILD_PARENT FOREIGN KEY (PARENT_ID) REFERENCES PARENT(ID);
```

## 5. 이전 결과 검증 SQL

원본과 대상에서 **동일한 스키마 계정**으로 각각 실행하고 결과를 비교한다.

```sql
SELECT OBJECT_TYPE, COUNT(*) AS CNT
FROM USER_OBJECTS
GROUP BY OBJECT_TYPE
ORDER BY OBJECT_TYPE;

SELECT CONSTRAINT_TYPE, COUNT(*) AS CNT
FROM USER_CONSTRAINTS
GROUP BY CONSTRAINT_TYPE
ORDER BY CONSTRAINT_TYPE;

SELECT TABLE_NAME, COUNT(*) AS COLUMN_COUNT
FROM USER_TAB_COLUMNS
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;

SELECT OBJECT_TYPE, OBJECT_NAME, STATUS
FROM USER_OBJECTS
WHERE STATUS <> 'VALID'
ORDER BY OBJECT_TYPE, OBJECT_NAME;

SELECT CONSTRAINT_NAME, TABLE_NAME, STATUS, VALIDATED
FROM USER_CONSTRAINTS
WHERE STATUS <> 'ENABLED' OR VALIDATED <> 'VALIDATED';
```

객체 **개수만 같다고 동일한 스키마는 아니다**. 제약조건의 컬럼/참조 테이블, 인덱스 컬럼, 기본값, NULL 허용 여부, 시퀀스 옵션, 뷰/PLSQL 소스까지 비교해야 한다. 데이터가 없는 상태에서는 일부 제약조건 검증과 트리거 동작은 실제 데이터로 추가 테스트해야 한다.

## 6. 흔한 오류

| 오류 | 대표 원인 | 확인할 사항 |
| --- | --- | --- |
| ORA-00942 | 참조 테이블/뷰 없음 또는 권한 없음 | 생성 순서, 스키마명, 권한 |
| ORA-02270 | FK가 참조하는 PK/UNIQUE 키 없음 | 참조 키 선생성 |
| ORA-00955 | 동일 이름 객체가 이미 존재 | 빈 스키마 여부, 기존 객체 |
| ORA-01950 | 테이블스페이스 quota 부족 | 대상 사용자 quota |
| ORA-01031 | 권한 부족 | CREATE TABLE/VIEW/PROCEDURE 등 |
| ORA-04063 | 뷰/패키지 등 컴파일 오류 | 종속 객체, 소스/권한 |

## 7. 나중에 데이터 이전할 때

구조만 이전한 뒤 데이터는 별도로 이전할 수 있다. FK가 있는 경우 부모→자식 적재 순서와 제약조건 활성화 상태를 고려한다. 대량 데이터는 Data Pump의 `CONTENT=DATA_ONLY`를 검토하되, 대상 테이블의 기존 데이터와 중복 PK 충돌, 시퀀스 현재값 및 트리거 동작을 반드시 확인한다.

## 실무 체크리스트

- [ ] 원본/대상 PDB 및 스키마 사용자 확인
- [ ] SQL Developer로 전체 DDL 출력, 데이터 제외
- [ ] PK/FK/UNIQUE/CHECK/NOT NULL 확인
- [ ] 독립 인덱스/시퀀스/뷰/트리거/패키지 확인
- [ ] 사용자/테이블스페이스/권한/외부 의존성 확인
- [ ] 메일 전송 전 민감 정보 검토
- [ ] 대상 빈 스키마에서 F5 스크립트 실행
- [ ] 오류 로그 및 INVALID 객체 확인
- [ ] 원본/대상 객체 정의 비교

참고: Oracle Database 19c Utilities (Data Pump), Oracle Database 19c PL/SQL Packages and Types Reference (`DBMS_METADATA`), Oracle SQL Developer Database Export 설명서 및 사용 중인 DBeaver 버전별 매뉴얼.
