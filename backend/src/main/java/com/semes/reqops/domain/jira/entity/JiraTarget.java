package com.semes.reqops.domain.jira.entity;

import jakarta.persistence.*;

@Entity @Table(name="PROJECT_JIRA_TARGETS", uniqueConstraints=@UniqueConstraint(name="UQ_JIRA_TARGET",columnNames={"project_id","base_url","jira_project_key"}))
public class JiraTarget {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="project_id",nullable=false) private Long projectId;
    @Column(name="base_url",nullable=false,length=512) private String baseUrl;
    @Column(name="jira_project_key",nullable=false,length=100) private String jiraProjectKey;
    @Column(name="display_name",nullable=false,length=200) private String displayName;
    @Column(name="issue_type_id",length=40) private String issueTypeId;
    @Version @Column(name="row_version",nullable=false) private long revision;
    protected JiraTarget() {}
    public JiraTarget(Long projectId,String baseUrl,String key,String name,String type){this.projectId=projectId;update(baseUrl,key,name,type);}
    public void update(String baseUrl,String key,String name,String type){this.baseUrl=baseUrl;this.jiraProjectKey=key;this.displayName=name;this.issueTypeId=type;}
    public Long getId(){return id;} public Long getProjectId(){return projectId;} public String getBaseUrl(){return baseUrl;}
    public String getJiraProjectKey(){return jiraProjectKey;} public String getDisplayName(){return displayName;}
    public String getIssueTypeId(){return issueTypeId;} public long getRevision(){return revision;}
}
