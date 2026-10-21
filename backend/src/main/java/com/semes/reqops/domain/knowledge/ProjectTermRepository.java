package com.semes.reqops.domain.knowledge;
import org.springframework.data.jpa.repository.JpaRepository;import java.util.*;
public interface ProjectTermRepository extends JpaRepository<ProjectTerm,Long>{
 List<ProjectTerm> findByProjectIdOrderByIdAsc(Long projectId);
 Optional<ProjectTerm> findByProjectIdAndNormalizedName(Long projectId,String name);
 long countByProjectIdAndStatus(Long projectId,String status);
}
