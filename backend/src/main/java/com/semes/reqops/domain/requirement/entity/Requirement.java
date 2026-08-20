package com.semes.reqops.domain.requirement.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "REQUIREMENTS")
public class Requirement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    /** 사용자가 직접 입력하는 요구사항 ID (예: req-am-03). 프로젝트 내 고유. */
    @Column(name = "req_key", nullable = false, length = 50)
    private String reqKey;

    @Lob
    @Column(nullable = false)
    private String content;

    @Column(name = "requester_dept", length = 100)
    private String requesterDept;

    @Column(name = "requester_name", length = 50)
    private String requesterName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ReqState state;

    /** 확정 시 부여되는 Semver. 확정 전에는 null. */
    @Column(length = 20)
    private String version;

    @Column(name = "assignee_id")
    private Long assigneeId;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected Requirement() {
    }

    public Requirement(Long projectId, String reqKey, String content,
                       String requesterDept, String requesterName, Long createdBy) {
        this.projectId = projectId;
        this.reqKey = reqKey;
        this.content = content;
        this.requesterDept = requesterDept;
        this.requesterName = requesterName;
        this.createdBy = createdBy;
        // 등록자가 곧 담당자. 재배정은 이후 기능.
        this.assigneeId = createdBy;
        this.state = ReqState.RECEIVED;
    }

    @PrePersist
    void onCreate() {
        LocalDateTime now = LocalDateTime.now();
        this.createdAt = now;
        this.updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /**
     * 확정 — 합의된 본문을 확정본으로 삼고 버전을 부여한다.
     *
     * <p>등록 원문(content)을 확정본으로 <b>덮어쓴다</b>. 원문이 필요하면 버전 이력
     * (requirement_versions)에 각 버전의 본문이 남아 있으므로 거기서 볼 수 있다.
     */
    public void confirm(String confirmedContent, String newVersion) {
        this.content = confirmedContent;
        this.version = newVersion;
        this.state = ReqState.CONFIRMED;
    }

    /** 보류 — 고객 협의가 더 필요해 확정을 미룬다. 나중에 이어서 확정할 수 있다. */
    public void hold() {
        this.state = ReqState.ON_HOLD;
    }

    /** 합의 기록이 들어와 확정 직전 단계로 올린다(아직 확정은 아니다). */
    public void markPendingConsensus() {
        if (this.state == ReqState.RECEIVED || this.state == ReqState.IN_REVIEW
                || this.state == ReqState.ON_HOLD) {
            this.state = ReqState.PENDING_CONSENSUS;
        }
    }

    /**
     * 확정본을 고치기 시작 — 목록에서 "지금 손대는 중"으로 보이게 한다.
     *
     * <p>버전은 그대로 둔다. 재확정 전까지는 여전히 이전 버전이 유효한 확정본이기 때문.
     */
    public void startRevision() {
        if (this.state == ReqState.CONFIRMED) {
            this.state = ReqState.REVISING;
        }
    }

    /** 확정된 적이 있는지 — 화면에서 "확정하기"와 "수정하기"를 가르는 기준. */
    public boolean isConfirmed() {
        return this.state == ReqState.CONFIRMED && this.version != null;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public String getReqKey() { return reqKey; }
    public String getContent() { return content; }
    public String getRequesterDept() { return requesterDept; }
    public String getRequesterName() { return requesterName; }
    public ReqState getState() { return state; }
    public String getVersion() { return version; }
    public Long getAssigneeId() { return assigneeId; }
    public Long getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
