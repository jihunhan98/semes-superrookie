package com.semes.reqops.domain.requirement.repository;

import com.semes.reqops.domain.requirement.entity.RequirementVersion;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RequirementVersionRepository extends JpaRepository<RequirementVersion, Long> {

    /** 최신 확정 버전 — 다음 버전 번호를 계산할 때 쓴다. */
    Optional<RequirementVersion> findFirstByRequirementIdOrderByIdDesc(Long requirementId);

    /** 버전 이력 — 최신순. */
    List<RequirementVersion> findByRequirementIdOrderByIdDesc(Long requirementId);
}
