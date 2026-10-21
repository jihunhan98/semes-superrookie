package com.semes.reqops.domain.knowledge;
import jakarta.persistence.*;import lombok.*;
@Entity @Table(name="REQUIREMENT_REFINEMENTS") @Getter @NoArgsConstructor(access=AccessLevel.PROTECTED)
public class RequirementRefinement {
 @Id @Column(name="requirement_id") private Long requirementId;
 @Lob @Column(nullable=false) private String content;
 @Column(nullable=false) private long revision;
 @Column(nullable=false,length=20) private String status="ANALYZING";
 @Column(name="new_term_count",nullable=false) private int newTermCount;
 @Column(name="term_status",nullable=false,length=20) private String termStatus="RULE_ONLY";
 @Column(name="glossary_hash",length=64) private String glossaryHash;
 public RequirementRefinement(Long id,String content){requirementId=id;this.content=content;}
 public void analyzed(String text,String status,int newTerms,String termStatus,String glossaryHash){content=text;this.status=status;newTermCount=newTerms;this.termStatus=termStatus;this.glossaryHash=glossaryHash;revision++;}
 public void touched(){revision++;}
}
