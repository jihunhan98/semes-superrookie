package com.semes.reqops.domain.requirement.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name="REQ_ATTACHMENTS")
public class RequirementAttachment {
    @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
    @Column(name="requirement_id",nullable=false) private Long requirementId;
    @Column(name="file_name",nullable=false,length=255) private String fileName;
    @Column(name="media_type",nullable=false,length=100) private String mediaType;
    @Column(name="file_size",nullable=false) private long fileSize;
    @Lob @Column(name="content_blob",nullable=false) private byte[] content;
    @Lob @Column(name="extracted_text") private String extractedText;
    @Column(name="extraction_state",nullable=false,length=20) private String extractionState;
    @Column(name="uploaded_by",nullable=false) private Long uploadedBy;
    @Column(name="created_at",nullable=false,updatable=false) private LocalDateTime createdAt;
    protected RequirementAttachment(){}
    public RequirementAttachment(Long requirementId,String fileName,String mediaType,byte[] content,String extractedText,String state,Long uploadedBy){this.requirementId=requirementId;this.fileName=fileName;this.mediaType=mediaType;this.fileSize=content.length;this.content=content;this.extractedText=extractedText;this.extractionState=state;this.uploadedBy=uploadedBy;}
    @PrePersist void created(){createdAt=LocalDateTime.now();}
    public Long getId(){return id;} public String getFileName(){return fileName;} public String getMediaType(){return mediaType;} public long getFileSize(){return fileSize;} public String getExtractedText(){return extractedText;} public String getExtractionState(){return extractionState;} public LocalDateTime getCreatedAt(){return createdAt;}
}
