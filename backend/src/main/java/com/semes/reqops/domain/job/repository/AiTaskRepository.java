package com.semes.reqops.domain.job.repository;
import com.semes.reqops.domain.job.entity.AiTask; import org.springframework.data.jpa.repository.JpaRepository; import java.time.LocalDateTime; import java.util.List; import java.util.Optional;
public interface AiTaskRepository extends JpaRepository<AiTask,Long>{
 Optional<AiTask> findFirstByStatusInAndNextRunAtLessThanEqualOrderByIdAsc(List<String> statuses,LocalDateTime now);
 int countByJobIdAndStatus(Long jobId,String status);
 List<AiTask> findByJobIdAndStatus(Long jobId,String status);
 List<AiTask> findByStatusAndLeaseUntilBefore(String status,LocalDateTime now);
}
