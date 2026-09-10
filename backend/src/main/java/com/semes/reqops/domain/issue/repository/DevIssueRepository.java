package com.semes.reqops.domain.issue.repository;

import com.semes.reqops.domain.issue.entity.DevIssue;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface DevIssueRepository extends JpaRepository<DevIssue, Long> {

    List<DevIssue> findByRequirementIdOrderByDisplayOrderAsc(Long requirementId);

    Optional<DevIssue> findByRequirementIdAndIssueKey(Long requirementId, String issueKey);

    /**
     * 벌크 DELETE 쿼리로 즉시 실행한다(파생 delete 메서드를 쓰지 않는 이유).
     *
     * <p>파생 {@code deleteByX} 메서드는 엔티티를 찾아 하나씩 {@code remove()}로
     * 지우는데, 이 삭제는 Hibernate flush 큐에 쌓였다가 flush 시점에야 실제 DELETE가
     * 나간다 — 그런데 Hibernate는 같은 flush 안에서 INSERT를 DELETE보다 먼저
     * 실행한다. 재분할(confirmSplit)에서 이 메서드로 기존 이슈를 지운 뒤 곧바로
     * 새 이슈를 save()하면, 새 이슈의 issue_key가 (재분할 전과) 같은 번호로 다시
     * 매겨져 옛 행과 겹치는데 — INSERT가 먼저 나가버려 DELETE로 지워지기도 전인
     * 옛 행과 충돌해 UQ_DEV_ISSUES_REQ_KEY 위반이 났다. {@code @Modifying} 벌크
     * 쿼리는 호출 즉시 DELETE를 실행하므로 이 순서 문제가 생기지 않는다.
     */
    @Modifying(clearAutomatically = true)
    @Query("delete from DevIssue d where d.requirementId = :requirementId")
    void deleteByRequirementId(@Param("requirementId") Long requirementId);

    int countByRequirementId(Long requirementId);
}
