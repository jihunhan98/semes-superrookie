package com.semes.reqops;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import java.sql.Connection;
import java.sql.DriverManager;
import java.util.Set;
import static org.junit.jupiter.api.Assertions.*;

class OracleSchemaIT {
    private Connection connect() throws Exception {
        String url = System.getenv("ORACLE_TEST_URL"); String user = System.getenv("ORACLE_TEST_USER"); String password = System.getenv("ORACLE_TEST_PASSWORD");
        Assumptions.assumeTrue(url != null && user != null && password != null, "Oracle 전용 테스트 환경변수가 필요합니다.");
        return DriverManager.getConnection(url, user, password);
    }
    @Test void expandedSchemaAndNoCascadeArePresent() throws Exception {
        try (Connection connection = connect()) {
            Set<String> expected = Set.of("WORK_BUNDLES","AI_JOBS","AI_TASKS","ARTIFACT_REVISIONS","KNOWLEDGE_ENTRIES","COMMAND_RECEIPTS","LEGACY_SNAPSHOTS","REQ_ATTACHMENTS");
            try (var statement=connection.prepareStatement("select table_name from user_tables");var rows=statement.executeQuery()) { var actual=new java.util.HashSet<String>();while(rows.next())actual.add(rows.getString(1));assertTrue(actual.containsAll(expected),()->"missing="+expected.stream().filter(t->!actual.contains(t)).toList()); }
            try (var statement=connection.prepareStatement("select delete_rule from user_constraints where constraint_name='FK_DEV_ISSUE_ARTIFACTS_ISSUE'");var rows=statement.executeQuery()) { assertTrue(rows.next());assertEquals("NO ACTION",rows.getString(1)); }
        }
    }
    @Test void koreanClobRoundTripsWithoutLoss() throws Exception {
        String text="고객 합의 당시 본문과 개발 산출물의 한글 무손실 검증 ".repeat(12);
        try(Connection connection=connect();var statement=connection.prepareStatement("select to_clob(?) from dual")){statement.setString(1,text);try(var rows=statement.executeQuery()){assertTrue(rows.next());assertEquals(text,rows.getString(1));}}
    }
}
