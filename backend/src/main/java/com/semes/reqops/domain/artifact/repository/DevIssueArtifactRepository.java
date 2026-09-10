package com.semes.reqops.domain.artifact.repository;

import com.semes.reqops.domain.artifact.entity.ArtifactType;
import com.semes.reqops.domain.artifact.entity.DevIssueArtifact;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DevIssueArtifactRepository extends JpaRepository<DevIssueArtifact, Long> {

    Optional<DevIssueArtifact> findByDevIssueIdAndArtifactType(Long devIssueId, ArtifactType artifactType);
}
