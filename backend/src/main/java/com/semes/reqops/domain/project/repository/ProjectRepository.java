package com.semes.reqops.domain.project.repository;

import com.semes.reqops.domain.project.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select p from Project p where p.id = :id")
    java.util.Optional<Project> findLockedById(@org.springframework.data.repository.query.Param("id") Long id);
}
