package com.semes.reqops.domain.monitoring;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="REQUIREMENT_IMPACT_EVENTS")
public class ImpactEvent {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="project_id",nullable=false) private Long projectId;
 @Column(name="requirement_id",nullable=false) private Long requirementId;
 @Column(name="input_hash",nullable=false,length=64) private String inputHash;
 @Column(name="context_hash",nullable=false,length=64) private String contextHash;
 @Column(name="is_current",nullable=false) private int current;
 @Column(name="event_data",nullable=false) @Lob private String eventData;
 @Column(name="created_at",nullable=false) private LocalDateTime createdAt;
 protected ImpactEvent(){}
 public ImpactEvent(Long p,Long r,String input,String context,String json){projectId=p;requirementId=r;inputHash=input;contextHash=context;eventData=json;current=1;createdAt=LocalDateTime.now();}
 public void supersede(){current=0;}
 public boolean isCurrent(){return current==1;}public Long getId(){return id;}public Long getProjectId(){return projectId;}public Long getRequirementId(){return requirementId;}public String getInputHash(){return inputHash;}public String getContextHash(){return contextHash;}public String getEventData(){return eventData;}public LocalDateTime getCreatedAt(){return createdAt;}
}
