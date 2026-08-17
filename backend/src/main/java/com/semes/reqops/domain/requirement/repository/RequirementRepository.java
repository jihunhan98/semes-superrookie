package com.semes.reqops.domain.requirement.repository;

import com.semes.reqops.domain.requirement.entity.Requirement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RequirementRepository extends JpaRepository<Requirement, Long> {

    List<Requirement> findByProjectIdOrderByCreatedAtDesc(Long projectId);

    Optional<Requirement> findByProjectIdAndReqKey(Long projectId, String reqKey);

    boolean existsByProjectIdAndReqKey(Long projectId, String reqKey);
}
