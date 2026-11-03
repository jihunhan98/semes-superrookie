package com.semes.reqops.domain.monitoring;
import org.springframework.data.jpa.repository.*;import java.util.*;
public interface ImpactEventRepository extends JpaRepository<ImpactEvent,Long>{
 List<ImpactEvent> findByProjectIdOrderByIdDesc(Long projectId);
 List<ImpactEvent> findByProjectIdAndCurrentOrderByIdDesc(Long projectId,int current);
 List<ImpactEvent> findByRequirementIdAndCurrent(Long requirementId,int current);
 @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE) @Query("select e from ImpactEvent e where e.id=:id") Optional<ImpactEvent> lockById(@org.springframework.data.repository.query.Param("id") Long id);
}
