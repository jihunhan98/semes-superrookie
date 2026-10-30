package com.semes.reqops.domain.requirement.entity;

import jakarta.persistence.*;

import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 고객 합의 기록.
 *
 * <p>본문을 변경해 확정할 때 이 기록을 확인한다. 등록·기존 확정 본문을
 * 그대로 유지하면 합의 정보를 다시 입력하거나 새 행을 만들지 않는다.
 *
 * <p>{@code agreedContent} 에 합의 시점의 본문을 함께 남긴다. 합의한 뒤에 본문을 또
 * 고치면 "무엇에 합의한 것인지"가 달라지므로, 화면에서 재합의가 필요한지 판단하는
 * 근거로 쓴다.
 */
@Entity
@Table(name = "REQUIREMENT_CONSENSUS")
public class RequirementConsensus {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "requirement_id", nullable = false)
    private Long requirementId;

    /** 대면 미팅 / 유선 / 메일 / 화상회의. */
    @Column(nullable = false, length = 40)
    private String method;

    /** 고객측 담당자 — 예: "삼성전자 EDS 김민석 책임". */
    @Column(name = "customer_contact", nullable = false, length = 100)
    private String customerContact;

    @Column(name = "agreed_on", nullable = false)
    private LocalDate agreedOn;

    /** 합의 내용 요약. */
    @Column(length = 2000)
    private String note;

    /** 이 합의로 확정하기로 한 본문 — 합의 시점 스냅샷. */
    @Lob
    @Column(name = "agreed_content", nullable = false)
    private String agreedContent;

    @Column(name = "recorded_by", nullable = false)
    private Long recordedBy;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    protected RequirementConsensus() {
    }

    public RequirementConsensus(Long requirementId, String method, String customerContact,
                                LocalDate agreedOn, String note, String agreedContent,
                                Long recordedBy) {
        this.requirementId = requirementId;
        this.method = method;
        this.customerContact = customerContact;
        this.agreedOn = agreedOn;
        this.note = note;
        this.agreedContent = agreedContent;
        this.recordedBy = recordedBy;
    }

    @PrePersist
    void onCreate() {
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Long getRequirementId() { return requirementId; }
    public String getMethod() { return method; }
    public String getCustomerContact() { return customerContact; }
    public LocalDate getAgreedOn() { return agreedOn; }
    public String getNote() { return note; }
    public String getAgreedContent() { return agreedContent; }
    public Long getRecordedBy() { return recordedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}
