package com.semes.reqops.domain.requirement.repository;

import com.semes.reqops.domain.requirement.entity.RequirementConsensus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RequirementConsensusRepository extends JpaRepository<RequirementConsensus, Long> {

    /** 가장 최근 합의 기록. 확정은 항상 이 기록을 근거로 삼는다. */
    Optional<RequirementConsensus> findFirstByRequirementIdOrderByIdDesc(Long requirementId);

    List<RequirementConsensus> findByRequirementIdOrderByIdDesc(Long requirementId);
}
