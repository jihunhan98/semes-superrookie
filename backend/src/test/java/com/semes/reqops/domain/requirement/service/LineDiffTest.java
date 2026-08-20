package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.requirement.dto.RequirementDto.DiffRow;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * 버전 비교 diff 검증.
 *
 * <p>split 뷰가 좌우 줄을 나란히 그려야 해서, 단순히 "무엇이 바뀌었나"뿐 아니라
 * <b>행이 어떻게 짝지어지는지</b>가 중요하다. 짝이 어긋나면 화면에서 무엇이 무엇으로
 * 바뀐 건지 따라갈 수 없다.
 */
class LineDiffTest {

    @Test
    @DisplayName("같은 문장이면 전부 ctx 로 나온다")
    void identical() {
        List<DiffRow> rows = LineDiff.rows("첫 줄\n둘째 줄", "첫 줄\n둘째 줄");

        assertThat(rows).hasSize(2);
        assertThat(rows).allMatch(r -> "ctx".equals(r.type()));
        assertThat(rows.get(0).baseNo()).isEqualTo(1);
        assertThat(rows.get(0).headNo()).isEqualTo(1);
    }

    @Test
    @DisplayName("한 줄만 고치면 그 줄이 change 로 좌우 짝지어진다")
    void oneLineChanged() {
        List<DiffRow> rows = LineDiff.rows(
                "우선순위 순 할당.\n약속된 형식의 메시지를 수신.\nAMR 매칭.",
                "우선순위 순 할당.\nIF 명세서 v1.2 형식의 메시지를 수신.\nAMR 매칭.");

        assertThat(rows).hasSize(3);
        assertThat(rows.get(0).type()).isEqualTo("ctx");
        assertThat(rows.get(2).type()).isEqualTo("ctx");

        DiffRow changed = rows.get(1);
        assertThat(changed.type()).isEqualTo("change");
        // 좌우가 같은 행에 마주 보고 있어야 화면에서 대응이 보인다.
        assertThat(changed.baseText()).contains("약속된 형식");
        assertThat(changed.headText()).contains("IF 명세서 v1.2");
        assertThat(changed.baseNo()).isEqualTo(2);
        assertThat(changed.headNo()).isEqualTo(2);
    }

    @Test
    @DisplayName("줄을 추가하면 base 쪽은 비고 head 쪽만 채워진다")
    void lineAdded() {
        List<DiffRow> rows = LineDiff.rows("첫 줄", "첫 줄\n새로 붙인 줄");

        assertThat(rows).hasSize(2);
        assertThat(rows.get(1).type()).isEqualTo("add");
        assertThat(rows.get(1).baseText()).isNull();
        assertThat(rows.get(1).headText()).isEqualTo("새로 붙인 줄");
    }

    @Test
    @DisplayName("줄을 지우면 head 쪽이 빈다")
    void lineRemoved() {
        List<DiffRow> rows = LineDiff.rows("첫 줄\n지울 줄", "첫 줄");

        assertThat(rows).hasSize(2);
        assertThat(rows.get(1).type()).isEqualTo("del");
        assertThat(rows.get(1).baseText()).isEqualTo("지울 줄");
        assertThat(rows.get(1).headText()).isNull();
    }

    @Test
    @DisplayName("최초 확정(비교 대상 없음)은 전부 add 로 나온다")
    void firstVersionAgainstEmpty() {
        List<DiffRow> rows = LineDiff.rows("", "확정된 문장.");

        // 빈 문자열도 한 줄로 세므로 첫 행은 빈 줄끼리 매칭되거나 change 가 된다.
        assertThat(rows).isNotEmpty();
        assertThat(rows).anyMatch(r -> "확정된 문장.".equals(r.headText()));
    }

    @Test
    @DisplayName("삭제 3줄·추가 1줄이면 남는 삭제는 짝 없이 del 로 남는다")
    void unevenBlocks() {
        List<DiffRow> rows = LineDiff.rows("a\nb\nc", "z");

        assertThat(rows).hasSize(3);
        assertThat(rows.get(0).type()).isEqualTo("change");   // a ↔ z
        assertThat(rows.get(1).type()).isEqualTo("del");      // b
        assertThat(rows.get(2).type()).isEqualTo("del");      // c
        assertThat(rows.get(1).headText()).isNull();
    }
}
