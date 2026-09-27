package com.semes.reqops.domain.issue.repository;

import com.semes.reqops.domain.issue.entity.IssueLineage;
import com.semes.reqops.domain.issue.entity.IssueLineageId;
import org.springframework.data.jpa.repository.JpaRepository;

public interface IssueLineageRepository extends JpaRepository<IssueLineage, IssueLineageId> {}
