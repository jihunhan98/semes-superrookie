package com.semes.reqops.domain.artifact.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name="ARTIFACT_REVISIONS")
public class ArtifactRevision {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="artifact_id",nullable=false) private Long artifactId;
    @Column(name="revision_no",nullable=false) private int revisionNo;
    @Enumerated(EnumType.STRING) @Column(nullable=false,length=20) private ArtifactState state;
    @Lob @Column(name="content_json",nullable=false) private String contentJson;
    @Column(name="content_hash",nullable=false,length=64) private String contentHash;
    @Column(length=500) private String reason;
    @Column(name="actor_id",nullable=false) private Long actorId;
    @Column(name="created_at",nullable=false,updatable=false) private LocalDateTime createdAt;
    protected ArtifactRevision(){}
    public ArtifactRevision(Long artifactId,int revisionNo,ArtifactState state,String contentJson,String hash,String reason,Long actorId){this.artifactId=artifactId;this.revisionNo=revisionNo;this.state=state;this.contentJson=contentJson;this.contentHash=hash;this.reason=reason;this.actorId=actorId;}
    @PrePersist void created(){createdAt=LocalDateTime.now();}
    public Long getId(){return id;} public int getRevisionNo(){return revisionNo;} public ArtifactState getState(){return state;} public String getContentJson(){return contentJson;} public String getContentHash(){return contentHash;} public LocalDateTime getCreatedAt(){return createdAt;}
}
