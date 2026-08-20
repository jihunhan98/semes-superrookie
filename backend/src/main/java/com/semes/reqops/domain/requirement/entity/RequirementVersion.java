package com.semes.reqops.domain.requirement.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 확정 이력 한 줄. 확정·재확정마다 커밋처럼 쌓인다.
 *
 * <p>요구사항 본문은 확정할 때마다 덮어쓰이므로, "그때 무엇으로 확정했는지"는
 * 이 테이블에만 남는다. 버전 비교 화면도 이 데이터를 쓴다.
 */
@Entity
@Table(name = "REQUIREMENT_VERSIONS")
public class RequirementVersion {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requirement_id", nullable = false)
    private Long requirementId;

    /** 1.0.0 / 1.0.1 ... */
    @Column(nullable = false, length = 20)
    private String version;

    /** 최초 확정이면 "최초 확정", 재확정이면 수정 사유. */
    @Column(nullable = false, length = 200)
    private String title;

    @Lob
    @Column(nullable = false)
    private String content;

    /** 근거가 된 합의 기록. */
    @Column(name = "consensus_id")
    private Long consensusId;

    @Column(name = "confirmed_by", nullable = false)
    private Long confirmedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RequirementVersion() {
    }

    public RequirementVersion(Long requirementId, String version, String title,
                              String content, Long consensusId, Long confirmedBy) {
        this.requirementId = requirementId;
        this.version = version;
        this.title = title;
        this.content = content;
        this.consensusId = consensusId;
        this.confirmedBy = confirmedBy;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getRequirementId() { return requirementId; }
    public String getVersion() { return version; }
    public String getTitle() { return title; }
    public String getContent() { return content; }
    public Long getConsensusId() { return consensusId; }
    public Long getConfirmedBy() { return confirmedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
