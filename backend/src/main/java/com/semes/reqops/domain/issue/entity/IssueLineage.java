package com.semes.reqops.domain.issue.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@IdClass(IssueLineageId.class)
@Table(name = "ISSUE_LINEAGE")
public class IssueLineage {
    @Id @Column(name = "source_issue_id") private Long sourceIssueId;
    @Id @Column(name = "target_issue_id") private Long targetIssueId;
    @Id @Column(name = "relation_type", length = 20) private String relationType;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    protected IssueLineage() {}
    public IssueLineage(Long sourceIssueId, Long targetIssueId, String relationType) {
        this.sourceIssueId = sourceIssueId; this.targetIssueId = targetIssueId; this.relationType = relationType;
    }
    @PrePersist void created() { createdAt = LocalDateTime.now(); }
}
