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
