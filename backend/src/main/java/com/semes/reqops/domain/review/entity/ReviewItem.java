package com.semes.reqops.domain.review.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "REVIEW_ITEMS")
public class ReviewItem {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "bundle_id") private Long bundleId;
    @Column(name = "requirement_id", nullable = false) private Long requirementId;
    @Column(name = "finding_id") private Long findingId;
    @Column(nullable = false, length = 20) private String severity;
    @Column(name = "item_type", nullable = false, length = 40) private String itemType;
    @Column(nullable = false, length = 1000) private String message;
    @Lob @Column(name = "source_json") private String sourceJson;
    @Column(nullable = false, length = 20) private String state = "OPEN";
    @Column(nullable = false, length = 64) private String fingerprint;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;

    protected ReviewItem() {}

    public ReviewItem(Long requirementId, Long findingId, String itemType, String message,
                      String sourceJson, String fingerprint) {
        this.requirementId = requirementId;
        this.findingId = findingId;
        this.severity = "BLOCKING";
        this.itemType = itemType;
        this.message = message;
        this.sourceJson = sourceJson;
        this.fingerprint = fingerprint;
    }

    @PrePersist void created() { createdAt = LocalDateTime.now(); }
    public Long getId() { return id; }
    public void accept() { state = "ACCEPTED_WITH_REASON"; }
}
