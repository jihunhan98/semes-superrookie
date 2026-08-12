package com.semes.reqops.domain.project.repository;

import com.semes.reqops.domain.project.entity.ProjectModule;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ProjectModuleRepository extends JpaRepository<ProjectModule, Long> {
    List<ProjectModule> findByProjectId(Long projectId);

    void deleteByProjectId(Long projectId);
}
