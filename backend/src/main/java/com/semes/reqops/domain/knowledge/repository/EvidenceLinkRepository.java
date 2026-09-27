package com.semes.reqops.domain.knowledge.repository;

import com.semes.reqops.domain.knowledge.entity.EvidenceLink;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EvidenceLinkRepository extends JpaRepository<EvidenceLink, Long> {
    boolean existsByTargetTypeAndTargetIdAndKnowledgeEntryIdAndQuoteHash(
            String targetType, Long targetId, Long knowledgeEntryId, String quoteHash);
}
