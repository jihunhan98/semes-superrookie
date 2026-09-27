package com.semes.reqops.domain.issue.repository;

import com.semes.reqops.domain.issue.entity.IssueRevision;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IssueRevisionRepository extends JpaRepository<IssueRevision, Long> {
    int countByIssueId(Long issueId);
}
