package com.semes.reqops.domain.knowledge;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;
@Entity @Table(name="PROJECT_TERMS") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class ProjectTerm {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="project_id",nullable=false) private Long projectId;
 @Column(nullable=false,length=100) private String name;
 @Column(name="normalized_name",nullable=false,length=200) private String normalizedName;
 @Lob @Column(nullable=false) private String definition;
 @Lob @Column(name="ai_definition") private String aiDefinition;
 @Column(nullable=false,length=20) private String status="PENDING";
 @Version @Column(name="row_version",nullable=false) private long revision;
 @Column(name="reviewed_by") private Long reviewedBy;
 @Column(name="reviewed_at") private LocalDateTime reviewedAt;
 @Column(name="created_at",nullable=false) private LocalDateTime createdAt=LocalDateTime.now();
 public ProjectTerm(Long projectId,String name,String normalized,String definition){this.projectId=projectId;this.name=name;this.normalizedName=normalized;this.definition=definition;this.aiDefinition=definition;}
 public void review(String name,String normalized,String definition,String status,Long actor){this.name=name;this.normalizedName=normalized;this.definition=definition;this.status=status;this.reviewedBy=actor;this.reviewedAt=LocalDateTime.now();}
}
