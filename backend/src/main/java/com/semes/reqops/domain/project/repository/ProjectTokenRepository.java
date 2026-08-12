package com.semes.reqops.domain.project.repository;

import com.semes.reqops.domain.project.entity.ProjectToken;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectTokenRepository extends JpaRepository<ProjectToken, Long> {
    Optional<ProjectToken> findByTokenAndRevokedFalse(String token);

    List<ProjectToken> findByProjectIdAndRevokedFalse(Long projectId);
}
