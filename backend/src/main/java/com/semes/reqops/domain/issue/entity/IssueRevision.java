package com.semes.reqops.domain.issue.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "ISSUE_REVISIONS")
public class IssueRevision {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "issue_id", nullable = false) private Long issueId;
    @Column(name = "revision_no", nullable = false) private int revisionNo;
    @Lob @Column(name = "snapshot_json", nullable = false) private String snapshotJson;
    @Column(name = "content_hash", nullable = false, length = 64) private String contentHash;
    @Column(length = 500) private String reason;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;

    protected IssueRevision() {}
    public IssueRevision(Long issueId, int revisionNo, String snapshotJson, String contentHash,
                         String reason, Long actorId) {
        this.issueId = issueId; this.revisionNo = revisionNo; this.snapshotJson = snapshotJson;
        this.contentHash = contentHash; this.reason = reason; this.actorId = actorId;
    }
    @PrePersist void created() { createdAt = LocalDateTime.now(); }
}
