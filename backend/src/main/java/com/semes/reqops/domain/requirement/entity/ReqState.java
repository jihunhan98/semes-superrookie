package com.semes.reqops.domain.requirement.entity;

/**
 * 요구사항 상태.
 *
 * <p>접수 → 검토 중 → 고객 합의 대기 → 확정 → (수정) 변경 중 → 재확정 · 보류.
 * 확정은 반드시 고객 합의 기록이 있어야 하므로 검토만으로 CONFIRMED 로 갈 수 없다.
 */
public enum ReqState {
    /** 등록만 된 상태. AI 초기 검토는 끝났지만 사람이 아직 안 봤다. */
    RECEIVED,
    /** 담당자가 검토·수정 중. */
    IN_REVIEW,
    /** 수정안은 만들었지만 고객 합의 전이라 확정 불가. */
    PENDING_CONSENSUS,
    /** 고객 합의까지 끝나 버전이 부여됨. 산출물 도출의 입력. */
    CONFIRMED,
    /** 확정본을 다시 고치는 중. */
    REVISING,
    /** 고객 협의가 필요해 대기. */
    ON_HOLD;

    /** 화면에 그대로 쓰는 한글 라벨. */
    public String label() {
        return switch (this) {
            case RECEIVED -> "접수";
            case IN_REVIEW -> "검토중";
            case PENDING_CONSENSUS -> "고객 합의 대기";
            case CONFIRMED -> "확정";
            case REVISING -> "변경중";
            case ON_HOLD -> "보류";
        };
    }
}
