package com.semes.reqops.domain.project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "MEMBERSHIPS")
public class Membership {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role;

    @Column(name = "joined_at", nullable = false, updatable = false)
    private LocalDateTime joinedAt;

    protected Membership() {
    }

    public Membership(Long userId, Long projectId, Role role) {
        this.userId = userId;
        this.projectId = projectId;
        this.role = role;
    }

    @PrePersist
    void onCreate() {
        this.joinedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getUserId() { return userId; }
    public Long getProjectId() { return projectId; }
    public Role getRole() { return role; }
    public LocalDateTime getJoinedAt() { return joinedAt; }
}
