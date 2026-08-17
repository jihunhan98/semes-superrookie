package com.semes.reqops.domain.requirement.repository;

import com.semes.reqops.domain.requirement.entity.RequirementFinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RequirementFindingRepository extends JpaRepository<RequirementFinding, Long> {

    List<RequirementFinding> findByRequirementIdOrderByIdAsc(Long requirementId);

    void deleteByRequirementId(Long requirementId);

    int countByRequirementId(Long requirementId);
}
