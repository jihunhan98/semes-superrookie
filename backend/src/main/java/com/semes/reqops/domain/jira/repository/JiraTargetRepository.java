package com.semes.reqops.domain.jira.repository;
import com.semes.reqops.domain.jira.entity.JiraTarget;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;
import java.util.*;
public interface JiraTargetRepository extends JpaRepository<JiraTarget,Long> {
    List<JiraTarget> findByProjectIdOrderByIdAsc(Long projectId);
    Optional<JiraTarget> findByIdAndProjectId(Long id,Long projectId);
    boolean existsByProjectIdAndBaseUrlAndJiraProjectKey(Long projectId,String baseUrl,String key);
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from JiraTarget t where t.id=:id and t.projectId=:projectId")
    Optional<JiraTarget> lockTarget(@Param("id")Long id,@Param("projectId")Long projectId);
}
