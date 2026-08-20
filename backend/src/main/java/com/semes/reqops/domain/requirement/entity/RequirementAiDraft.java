package com.semes.reqops.domain.requirement.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * AI 제안이 모두 반영된 문장.
 *
 * <p>확정 화면의 "확정될 본문" 칸에 <b>미리 채워지는 값</b>이다. 사용자는 이 텍스트를
 * 그대로 확정하거나 직접 고치거나, 등록 원문으로 되돌린다 — 별도의 "적용" 버튼은 없다.
 */
@Entity
@Table(name = "REQUIREMENT_AI_DRAFTS")
public class RequirementAiDraft {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requirement_id", nullable = false)
    private Long requirementId;

    @Lob
    @Column(name = "draft_content", nullable = false)
    private String draftContent;

    /**
     * 판정 경로: llm-api(사내 LLM 응답) / rule(규칙 기반만) / unavailable(AI 서버 자체 미응답).
     *
     * <p>rule 은 "검토를 못 했다"가 아니다 — 규칙 검출은 LLM 유무와 무관하게 항상 돌기
     * 때문에, LLM 만 못 쓴 경우와 아무 검토도 못 한 경우를 구분해서 저장한다.
     */
    @Column(name = "engine", nullable = false, length = 20)
    private String engine;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RequirementAiDraft() {
    }

    public RequirementAiDraft(Long requirementId, String draftContent, String engine) {
        this.requirementId = requirementId;
        this.draftContent = draftContent;
        this.engine = engine;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getRequirementId() { return requirementId; }
    public String getDraftContent() { return draftContent; }
    public String getEngine() { return engine; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
