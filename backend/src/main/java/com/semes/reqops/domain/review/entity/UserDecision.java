package com.semes.reqops.domain.review.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "USER_DECISIONS")
public class UserDecision {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Column(name = "review_item_id", nullable = false) private Long reviewItemId;
    @Column(nullable = false, length = 30) private String action;
    @Lob private String answer;
    @Column(length = 1000) private String reason;
    @Column(name = "actor_id", nullable = false) private Long actorId;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;

    protected UserDecision() {}
    public UserDecision(Long reviewItemId, String action, String answer, String reason, Long actorId) {
        this.reviewItemId = reviewItemId;
        this.action = action;
        this.answer = answer;
        this.reason = reason;
        this.actorId = actorId;
    }
    @PrePersist void created() { createdAt = LocalDateTime.now(); }
}
