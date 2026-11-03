package com.semes.reqops.domain.requirement.repository;

import com.semes.reqops.domain.requirement.entity.RequirementAiDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RequirementAiDraftRepository extends JpaRepository<RequirementAiDraft, Long> {

    /** 가장 최근 draft. 재분석하면 새 행이 쌓이므로 마지막 것을 쓴다. */
    Optional<RequirementAiDraft> findFirstByRequirementIdOrderByIdDesc(Long requirementId);

    @org.springframework.data.jpa.repository.Query("select d from RequirementAiDraft d where d.requirementId in :ids and d.id = (select max(x.id) from RequirementAiDraft x where x.requirementId=d.requirementId)")
    List<RequirementAiDraft> findLatestForRequirements(@org.springframework.data.repository.query.Param("ids") List<Long> ids);

    List<RequirementAiDraft> findByRequirementId(Long requirementId);
}
