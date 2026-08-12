package com.semes.reqops.domain.project.repository;

import com.semes.reqops.domain.project.entity.Project;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<Project, Long> {
}
