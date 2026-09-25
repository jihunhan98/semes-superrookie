package com.semes.reqops.domain.job.entity;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name="AI_JOBS")
public class AiJob {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="project_id",nullable=false) private Long projectId; @Column(name="requirement_id") private Long requirementId;
 @Column(name="bundle_id") private Long bundleId; @Column(nullable=false,length=30) private String kind;
 @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private JobStatus status;
 @Column(name="idempotency_key",nullable=false,length=100) private String idempotencyKey; @Column(name="request_hash",nullable=false,length=64) private String requestHash;
 @Column(name="requested_by",nullable=false) private Long requestedBy; @Column(name="total_count",nullable=false) private int totalCount;
 @Column(name="succeeded_count",nullable=false) private int succeededCount; @Column(name="failed_count",nullable=false) private int failedCount;
 @Column(name="created_at",nullable=false,updatable=false) private LocalDateTime createdAt; @Column(name="finished_at") private LocalDateTime finishedAt;
 protected AiJob(){} public AiJob(Long p,Long r,Long b,String kind,String key,String hash,Long by,int total){projectId=p;requirementId=r;bundleId=b;this.kind=kind;idempotencyKey=key;requestHash=hash;requestedBy=by;totalCount=total;status=JobStatus.QUEUED;}
 @PrePersist void created(){createdAt=LocalDateTime.now();} public void progress(int ok,int fail){succeededCount=ok;failedCount=fail;status=(ok+fail)<totalCount?JobStatus.RUNNING:(fail==0?JobStatus.SUCCEEDED:(ok==0?JobStatus.FAILED:JobStatus.PARTIAL_FAILED));if(ok+fail>=totalCount)finishedAt=LocalDateTime.now();}
 public Long getId(){return id;} public Long getProjectId(){return projectId;} public Long getRequirementId(){return requirementId;} public Long getBundleId(){return bundleId;} public String getKind(){return kind;} public JobStatus getStatus(){return status;} public int getTotalCount(){return totalCount;} public int getSucceededCount(){return succeededCount;} public int getFailedCount(){return failedCount;} public Long getRequestedBy(){return requestedBy;}
}
