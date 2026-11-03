package com.semes.reqops.domain.monitoring;
import org.springframework.data.jpa.repository.JpaRepository;import java.util.*;
public interface ImpactReadRepository extends JpaRepository<ImpactRead,Long>{
 List<ImpactRead> findByUserIdAndEventIdIn(Long userId,List<Long> ids);
 boolean existsByEventIdAndUserId(Long eventId,Long userId);
}
