package com.semes.reqops.domain.jira.repository;
import com.semes.reqops.domain.jira.entity.JiraIssueLink;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.*;
public interface JiraIssueLinkRepository extends JpaRepository<JiraIssueLink,Long> {
    Optional<JiraIssueLink> findByTargetIdAndDevIssueId(Long targetId,Long issueId);
    List<JiraIssueLink> findByTargetId(Long targetId);
    boolean existsByTargetId(Long targetId);
}
