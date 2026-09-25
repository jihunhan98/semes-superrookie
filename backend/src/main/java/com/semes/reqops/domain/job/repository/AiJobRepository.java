package com.semes.reqops.domain.job.repository;
import com.semes.reqops.domain.job.entity.AiJob; import org.springframework.data.jpa.repository.JpaRepository; import java.util.Optional;
public interface AiJobRepository extends JpaRepository<AiJob,Long>{Optional<AiJob> findByProjectIdAndIdempotencyKey(Long projectId,String key);}
