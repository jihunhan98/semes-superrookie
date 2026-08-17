package com.semes.reqops.domain.requirement.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * AI 검토 결과 한 건.
 *
 * <p>화면에서 <b>읽기 전용 참고 자료</b>로만 쓰인다. 사용자가 "적용"하는 대상이 아니라,
 * 제안이 이미 반영된 문장({@link RequirementAiDraft})을 만들 때 재료로 쓰인다.
 */
@Entity
@Table(name = "REQUIREMENT_FINDINGS")
public class RequirementFinding {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requirement_id", nullable = false)
    private Long requirementId;

    /** 검출 유형 — 화면 배지 라벨과 동일한 한글 문자열. */
    @Column(name = "finding_type", nullable = false, length = 40)
    private String findingType;

    @Column(name = "target_span", length = 500)
    private String targetSpan;

    @Column(length = 1000)
    private String reason;

    @Column(length = 1000)
    private String suggestion;

    /** 상충 유형일 때 상대 요구사항의 req_key. 그 외에는 null. */
    @Column(name = "conflict_req_key", length = 50)
    private String conflictReqKey;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RequirementFinding() {
    }

    public RequirementFinding(Long requirementId, String findingType, String targetSpan,
                              String reason, String suggestion, String conflictReqKey) {
        this.requirementId = requirementId;
        this.findingType = findingType;
        this.targetSpan = targetSpan;
        this.reason = reason;
        this.suggestion = suggestion;
        this.conflictReqKey = conflictReqKey;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getRequirementId() { return requirementId; }
    public String getFindingType() { return findingType; }
    public String getTargetSpan() { return targetSpan; }
    public String getReason() { return reason; }
    public String getSuggestion() { return suggestion; }
    public String getConflictReqKey() { return conflictReqKey; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
