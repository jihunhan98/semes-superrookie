package com.semes.reqops.user;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "USERS")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "emp_no", nullable = false, unique = true, length = 20)
    private String empNo;

    @Column(nullable = false, length = 50)
    private String name;

    @Column(length = 100)
    private String dept;

    @Column(name = "password_hash", nullable = false, length = 200)
    private String passwordHash;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected User() {
    }

    public User(String empNo, String name, String dept, String passwordHash) {
        this.empNo = empNo;
        this.name = name;
        this.dept = dept;
        this.passwordHash = passwordHash;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public String getEmpNo() { return empNo; }
    public String getName() { return name; }
    public String getDept() { return dept; }
    public String getPasswordHash() { return passwordHash; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
