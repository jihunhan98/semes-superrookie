package com.semes.reqops.domain.issue.repository;

import com.semes.reqops.domain.issue.entity.DevIssue;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface DevIssueRepository extends JpaRepository<DevIssue, Long> {

    List<DevIssue> findByRequirementIdOrderByDisplayOrderAsc(Long requirementId);

    Optional<DevIssue> findByRequirementIdAndIssueKey(Long requirementId, String issueKey);

    void deleteByRequirementId(Long requirementId);

    int countByRequirementId(Long requirementId);
}
