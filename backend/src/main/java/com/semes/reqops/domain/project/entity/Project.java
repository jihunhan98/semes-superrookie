package com.semes.reqops.domain.project.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "PROJECTS")
public class Project {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(length = 100)
    private String customer;

    @Column(length = 500)
    private String description;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected Project() {
    }

    public Project(String name, String customer, String description, Long createdBy) {
        this.name = name;
        this.customer = customer;
        this.description = description;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public void update(String name, String customer, String description) {
        this.name = name;
        this.customer = customer;
        this.description = description;
    }

    public Long getId() { return id; }
    public String getName() { return name; }
    public String getCustomer() { return customer; }
    public String getDescription() { return description; }
    public Long getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
