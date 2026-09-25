package com.semes.reqops.domain.workflow.repository;

import com.semes.reqops.domain.workflow.entity.WorkBundle;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface WorkBundleRepository extends JpaRepository<WorkBundle,Long> {
    Optional<WorkBundle> findFirstByRequirementIdAndCurrentOrderByRevisionNoDesc(Long requirementId, int current);
    List<WorkBundle> findByRequirementIdOrderByRevisionNoDesc(Long requirementId);
    long countByRequirementId(Long requirementId);
}
