package com.semes.reqops.domain.requirement.repository;

import com.semes.reqops.domain.requirement.entity.RequirementFinding;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RequirementFindingRepository extends JpaRepository<RequirementFinding, Long> {

    List<RequirementFinding> findByRequirementIdOrderByIdAsc(Long requirementId);

    List<RequirementFinding> findByRequirementIdAndSeverityAndResolutionStateOrderByIdAsc(
            Long requirementId, String severity, String resolutionState);

    void deleteByRequirementId(Long requirementId);

    void deleteByRequirementIdAndResolutionState(Long requirementId, String resolutionState);

    int countByRequirementId(Long requirementId);

    int countByRequirementIdAndResolutionState(Long requirementId, String resolutionState);
}
