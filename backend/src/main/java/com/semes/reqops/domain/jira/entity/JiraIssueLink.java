package com.semes.reqops.domain.jira.entity;

import jakarta.persistence.*;

@Entity @Table(name="JIRA_ISSUE_LINKS",uniqueConstraints=@UniqueConstraint(name="UQ_JIRA_ISSUE_LINK",columnNames={"target_id","dev_issue_id"}))
public class JiraIssueLink {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="target_id",nullable=false) private Long targetId;
    @Column(name="dev_issue_id",nullable=false) private Long devIssueId;
    @Column(name="jira_issue_key",nullable=false,length=150) private String jiraIssueKey;
    protected JiraIssueLink() {}
    public JiraIssueLink(Long targetId,Long issueId,String key){this.targetId=targetId;this.devIssueId=issueId;this.jiraIssueKey=key;}
    public Long getTargetId(){return targetId;} public Long getDevIssueId(){return devIssueId;} public String getJiraIssueKey(){return jiraIssueKey;}
}
