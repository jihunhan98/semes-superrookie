package com.semes.reqops.domain.knowledge;
import jakarta.persistence.*;import lombok.*;
@Entity @Table(name="PROJECT_TERM_USAGES") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class ProjectTermUsage {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="term_id",nullable=false) private Long termId;
 @Column(name="requirement_id",nullable=false) private Long requirementId;
 @Lob @Column(name="source_quote",nullable=false) private String sourceQuote;
 public ProjectTermUsage(Long term,Long req,String quote){termId=term;requirementId=req;sourceQuote=quote;}
}
