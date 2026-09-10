package com.semes.reqops.domain.artifact.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/**
 * 개발 이슈 1건에 붙는 산출물 4종(SWVOC·기능·비기능 요구사항·Detail Design) 중 하나.
 *
 * <p>유형마다 필드 구조가 전혀 달라(예: SWVOC는 요청사항 텍스트, Detail Design은
 * Class/Sequence Diagram 배열) 구조화된 컬럼 대신 {@link #contentJson}에 JSON
 * 문자열로 저장한다 — 프론트가 그대로 파싱해 쓰는 자유 형식이라, 백엔드가 내용을
 * 해석할 필요가 없다.
 *
 * <p>이슈가 재분할로 지워지면 이 행도 함께 지워진다(DB의 ON DELETE CASCADE).
 */
@Entity
@Table(name = "DEV_ISSUE_ARTIFACTS")
public class DevIssueArtifact {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "dev_issue_id", nullable = false)
    private Long devIssueId;

    @Enumerated(EnumType.STRING)
    @Column(name = "artifact_type", nullable = false, length = 20)
    private ArtifactType artifactType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ArtifactState state;

    @Lob
    @Column(name = "content_json", nullable = false)
    private String contentJson;

    @Column(nullable = false, length = 20)
    private String engine;

    @Column(name = "created_by", nullable = false)
    private Long createdBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_by")
    private Long updatedBy;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    protected DevIssueArtifact() {
    }

    public DevIssueArtifact(Long devIssueId, ArtifactType artifactType, String contentJson,
                            String engine, Long createdBy) {
        this.devIssueId = devIssueId;
        this.artifactType = artifactType;
        this.state = ArtifactState.DRAFT;
        this.contentJson = contentJson;
        this.engine = engine;
        this.createdBy = createdBy;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = this.createdAt;
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }

    /** 재생성 — 새 AI 초안으로 덮어쓰고 DRAFT로 되돌린다(이미 확정돼 있었더라도). */
    public void regenerate(String contentJson, String engine) {
        this.contentJson = contentJson;
        this.engine = engine;
        this.state = ArtifactState.DRAFT;
    }

    /** 확정 — 사람이 다듬은 최종 내용을 저장한다. */
    public void confirm(String contentJson, Long updatedBy) {
        this.contentJson = contentJson;
        this.state = ArtifactState.CONFIRMED;
        this.updatedBy = updatedBy;
    }

    public Long getId() { return id; }
    public Long getDevIssueId() { return devIssueId; }
    public ArtifactType getArtifactType() { return artifactType; }
    public ArtifactState getState() { return state; }
    public String getContentJson() { return contentJson; }
    public String getEngine() { return engine; }
    public Long getCreatedBy() { return createdBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
}
