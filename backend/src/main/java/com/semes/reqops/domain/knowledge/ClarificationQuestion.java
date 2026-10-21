package com.semes.reqops.domain.knowledge;
import jakarta.persistence.*;import lombok.*;
@Entity @Table(name="CLARIFICATION_QUESTIONS") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class ClarificationQuestion {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="requirement_id",nullable=false) private Long requirementId;
 @Column(nullable=false,length=64) private String fingerprint;
 @Column(nullable=false,length=20) private String status="OPEN";
 @Lob @Column(name="question_data",nullable=false) private String data;
 @Lob private String answer;
 @Lob private String replacement;
 @Lob private String note;
 @Column(name="answered_by") private Long answeredBy;
 public ClarificationQuestion(Long req,String fingerprint,String data){requirementId=req;this.fingerprint=fingerprint;this.data=data;}
 public void refresh(String data){this.data=data;}
 public void supersede(){status="SUPERSEDED";}
 public void defer(String note,Long actor){status="DEFERRED";this.note=note;answeredBy=actor;}
 public void answer(String value,String replacement,Long actor){status="ANSWERED";answer=value;this.replacement=replacement;answeredBy=actor;}
}
