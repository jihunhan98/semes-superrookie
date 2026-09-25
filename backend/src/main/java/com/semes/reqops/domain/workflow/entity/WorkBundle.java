package com.semes.reqops.domain.workflow.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "WORK_BUNDLES")
public class WorkBundle {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name="requirement_id", nullable=false) private Long requirementId;
    @Column(name="requirement_version_id") private Long requirementVersionId;
    @Column(name="revision_no", nullable=false) private int revisionNo;
    @Enumerated(EnumType.STRING) @Column(nullable=false, length=20) private BundleState state;
    @Column(name="is_current", nullable=false) private int current;
    @Column(name="source_status", nullable=false, length=20) private String sourceStatus;
    @Version @Column(name="row_version", nullable=false) private long rowVersion;
    @Column(name="validation_hash", length=64) private String validationHash;
    @Lob @Column(name="manifest_json") private String manifestJson;
    @Column(name="created_by", nullable=false) private Long createdBy;
    @Column(name="created_at", nullable=false, updatable=false) private LocalDateTime createdAt;
    @Column(name="confirmed_by") private Long confirmedBy;
    @Column(name="confirmed_at") private LocalDateTime confirmedAt;

    protected WorkBundle() {}
    public WorkBundle(Long requirementId, Long versionId, int revisionNo, Long actorId) {
        this.requirementId=requirementId; this.requirementVersionId=versionId; this.revisionNo=revisionNo;
        this.createdBy=actorId; this.state=BundleState.PLANNING; this.current=1; this.sourceStatus="VERIFIED";
    }
    @PrePersist void created(){createdAt=LocalDateTime.now();}
    public void supersede(){current=0; if(state!=BundleState.CONFIRMED) state=BundleState.SUPERSEDED;}
    public void issuesReady(){state=BundleState.ISSUES_READY;}
    public void generating(){state=BundleState.GENERATING;}
    public void review(){state=BundleState.REVIEW;}
    public void confirm(String manifest, String hash, Long actor){state=BundleState.CONFIRMED;manifestJson=manifest;validationHash=hash;confirmedBy=actor;confirmedAt=LocalDateTime.now();}
    public Long getId(){return id;} public Long getRequirementId(){return requirementId;} public Long getRequirementVersionId(){return requirementVersionId;}
    public int getRevisionNo(){return revisionNo;} public BundleState getState(){return state;} public boolean isCurrent(){return current==1;}
    public long getRowVersion(){return rowVersion;} public String getManifestJson(){return manifestJson;} public LocalDateTime getCreatedAt(){return createdAt;} public LocalDateTime getConfirmedAt(){return confirmedAt;}
}
