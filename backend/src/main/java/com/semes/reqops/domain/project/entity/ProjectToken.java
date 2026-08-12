package com.semes.reqops.domain.project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "PROJECT_TOKENS")
public class ProjectToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(nullable = false, unique = true, length = 64)
    private String token;

    @Column(nullable = false)
    private boolean revoked;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected ProjectToken() {
    }

    public ProjectToken(Long projectId, String token) {
        this.projectId = projectId;
        this.token = token;
        this.revoked = false;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void revoke() {
        this.revoked = true;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public String getToken() { return token; }
    public boolean isRevoked() { return revoked; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
