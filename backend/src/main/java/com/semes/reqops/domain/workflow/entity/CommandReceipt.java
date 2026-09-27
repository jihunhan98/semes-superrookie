package com.semes.reqops.domain.workflow.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "COMMAND_RECEIPTS", uniqueConstraints = @UniqueConstraint(name = "UQ_COMMAND_RECEIPT", columnNames = {"project_id", "command_key"}))
public class CommandReceipt {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "project_id", nullable = false) private Long projectId;
    @Column(name = "command_key", nullable = false, length = 100) private String commandKey;
    @Column(name = "request_hash", nullable = false, length = 64) private String requestHash;
    @Lob @Column(name = "response_json", nullable = false) private String responseJson;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    protected CommandReceipt() {}
    public CommandReceipt(Long projectId, String commandKey, String requestHash, String responseJson) { this.projectId = projectId; this.commandKey = commandKey; this.requestHash = requestHash; this.responseJson = responseJson; }
    @PrePersist void created() { createdAt = LocalDateTime.now(); }
    public String getRequestHash() { return requestHash; }
    public String getResponseJson() { return responseJson; }
}
