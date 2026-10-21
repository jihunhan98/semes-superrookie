package com.semes.reqops.domain.requirement.service;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ReviewFindingTypesTest {
    @Test void timingAndSubjectiveCriteriaMerge() {
        for (String type : new String[]{"정량 기준 부재", "모호한 정도부사", "시간·일정 모호", ReviewFindingTypes.CRITERIA})
            assertEquals(ReviewFindingTypes.CRITERIA, ReviewFindingTypes.normalize(type));
    }
    @Test void triggeringAndLogicConditionsMerge() {
        assertEquals(ReviewFindingTypes.CONDITION,ReviewFindingTypes.normalize("조건 발생 시점 불명확"));
        assertEquals(ReviewFindingTypes.CONDITION,ReviewFindingTypes.normalize("접속사 범위 모호"));
    }
    @Test void referencesAreExcludedButContentConflictsRemain() {
        assertNull(ReviewFindingTypes.normalize("참조 요구사항 확인 필요"));
        assertEquals(ReviewFindingTypes.CONFLICT,ReviewFindingTypes.normalize("기존 요구사항과 상충"));
    }
}
