package com.semes.reqops.domain.project.entity;

import jakarta.persistence.*;

@Entity
@Table(name = "PROJECT_MODULES")
public class ProjectModule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "project_id", nullable = false)
    private Long projectId;

    @Column(name = "module_name", nullable = false, length = 50)
    private String moduleName;

    protected ProjectModule() {
    }

    public ProjectModule(Long projectId, String moduleName) {
        this.projectId = projectId;
        this.moduleName = moduleName;
    }

    public Long getId() { return id; }
    public Long getProjectId() { return projectId; }
    public String getModuleName() { return moduleName; }
}
