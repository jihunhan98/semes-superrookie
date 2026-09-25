package com.semes.reqops.domain.artifact.repository;
import com.semes.reqops.domain.artifact.entity.ArtifactRevision;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ArtifactRevisionRepository extends JpaRepository<ArtifactRevision,Long>{
    int countByArtifactId(Long artifactId);
    List<ArtifactRevision> findByArtifactIdOrderByRevisionNoDesc(Long artifactId);
}
