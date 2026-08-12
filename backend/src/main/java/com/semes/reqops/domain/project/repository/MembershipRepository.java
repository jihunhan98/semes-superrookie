package com.semes.reqops.domain.project.repository;

import com.semes.reqops.domain.project.entity.Membership;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface MembershipRepository extends JpaRepository<Membership, Long> {
    List<Membership> findByUserId(Long userId);

    List<Membership> findByProjectId(Long projectId);

    Optional<Membership> findByUserIdAndProjectId(Long userId, Long projectId);

    boolean existsByUserIdAndProjectId(Long userId, Long projectId);
}
