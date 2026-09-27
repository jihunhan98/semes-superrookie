package com.semes.reqops.domain.knowledge.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "EVIDENCE_LINKS")
public class EvidenceLink {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "target_type", nullable = false, length = 30) private String targetType;
    @Column(name = "target_id", nullable = false) private Long targetId;
    @Column(name = "knowledge_entry_id", nullable = false) private Long knowledgeEntryId;
    @Lob @Column(nullable = false) private String quote;
    @Column(name = "quote_hash", nullable = false, length = 64) private String quoteHash;
    @Column(name = "created_at", nullable = false, updatable = false) private LocalDateTime createdAt;
    protected EvidenceLink() {}
    public EvidenceLink(String targetType, Long targetId, Long knowledgeEntryId, String quote, String quoteHash) {
        this.targetType = targetType; this.targetId = targetId; this.knowledgeEntryId = knowledgeEntryId;
        this.quote = quote; this.quoteHash = quoteHash;
    }
    @PrePersist void created() { createdAt = LocalDateTime.now(); }
}
