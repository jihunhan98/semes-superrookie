package com.semes.reqops.domain.knowledge;
import org.springframework.data.jpa.repository.JpaRepository;import java.util.*;
public interface ProjectTermUsageRepository extends JpaRepository<ProjectTermUsage,Long>{
 List<ProjectTermUsage> findByTermIdOrderByIdAsc(Long id);
 void deleteByRequirementId(Long requirementId);
}
