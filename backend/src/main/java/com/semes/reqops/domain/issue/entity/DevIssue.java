package com.semes.reqops.domain.issue.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;
import java.time.LocalDate;

/**
 * 개발 이슈 — 확정 요구사항을 "이슈 나누기" 화면에서 나눈 결과 한 건.
 *
 * <p>요구사항 1개 ↔ 개발 이슈 N개(1:N). 어떻게 나눌지는 AI가 초안(경계 후보)을
 * 제안하고 사람이 합치기·나누기·제목 수정으로 확정한다({@code docs/screens/f3-이슈나누기-제안.html}
 * 참고). 재분할하면 이 요구사항의 기존 이슈를 전부 지우고 새로 쌓는다 — 버전처럼
 * 이력을 남기지 않는 이유는, 확정 전 초안 단계라 "몇 번째로 나눴는지"가 의미가
 * 없기 때문(확정된 건 요구사항 자체의 버전 이력에 이미 남는다).
 *
 * <p>이슈 본문(요구사항 접수·개발·변경점 설계 3범주)과 산출물 4종(SWVOC·기능·비기능
 * 요구사항·Detail Design)은 아직 UI 목업 단계라 여기 저장하지 않는다 — 실제로 저장하는
 * 건 "이 이슈가 요구사항의 어느 구절을 커버하는지"(quote)와 제목뿐이다.
 */
@Entity
@Table(name = "DEV_ISSUES")
public class DevIssue {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requirement_id", nullable = false)
    private Long requirementId;

    /** 화면 표시용 키. {reqKey}-{순번} 형태로 만든다(예: req-ta-01-1). */
    @Column(name = "issue_key", nullable = false, length = 60)
    private String issueKey;

    @Column(nullable = false, length = 200)
    private String title;

    /** 이 이슈가 커버하는 요구사항 구절 — AI 제안 또는 사람이 직접 쓴 텍스트. */
    @Lob
    @Column
    private String quote;

    /** 화면에 보여줄 순서(=분할 당시 순번). */
    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @Column(name = "bundle_id") private Long bundleId;
    @Lob @Column private String symptom;
    @Lob @Column(name = "improvement_req") private String improvementReq;
    @Lob @Column(name = "change_scope") private String changeScope;
    @Lob @Column(name = "constraints_note") private String constraintsNote;
    @Lob @Column(name = "before_state") private String beforeState;
    @Lob @Column(name = "after_state") private String afterState;
    @Column(name = "due_on") private LocalDate dueOn;
    @Column(name = "resolved_at") private LocalDateTime resolvedAt;
    @Column(name = "issue_state", nullable = false, length = 20) private String issueState = "DRAFT";
    @Version @Column(name = "row_version", nullable = false) private long rowVersion;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected DevIssue() {
    }

    public DevIssue(Long requirementId, String issueKey, String title, String quote,
                    int displayOrder, Long createdBy) {
        this.requirementId = requirementId;
        this.issueKey = issueKey;
        this.title = title;
        this.quote = quote;
        this.displayOrder = displayOrder;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        if (this.issueState == null) this.issueState = "DRAFT";
    }

    public void retire() { this.issueState = "RETIRED"; }
    public void assignBundle(Long bundleId) { this.bundleId = bundleId; }

    public void updateBody(String title, String quote, String symptom, String improvementReq,
                           String changeScope, String constraintsNote, String beforeState, String afterState,
                           LocalDate dueOn) {
        this.title = title;
        this.quote = quote;
        this.symptom = symptom;
        this.improvementReq = improvementReq;
        this.changeScope = changeScope;
        this.constraintsNote = constraintsNote;
        this.beforeState = beforeState;
        this.afterState = afterState;
        this.dueOn = dueOn;
    }

    public void confirm() { this.issueState = "CONFIRMED"; }
    public void resolve() { this.resolvedAt = LocalDateTime.now(); }

    public Long getId() { return id; }
    public Long getRequirementId() { return requirementId; }
    public String getIssueKey() { return issueKey; }
    public String getTitle() { return title; }
    public String getQuote() { return quote; }
    public int getDisplayOrder() { return displayOrder; }
    public Long getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public Long getBundleId() { return bundleId; }
    public String getSymptom() { return symptom; }
    public String getImprovementReq() { return improvementReq; }
    public String getChangeScope() { return changeScope; }
    public String getConstraintsNote() { return constraintsNote; }
    public String getBeforeState() { return beforeState; }
    public String getAfterState() { return afterState; }
    public LocalDate getDueOn() { return dueOn; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public String getIssueState() { return issueState; }
    public long getRowVersion() { return rowVersion; }
}
