package com.semes.reqops.domain.monitoring;
import jakarta.persistence.*;
import java.time.LocalDateTime;
@Entity @Table(name="REQUIREMENT_IMPACT_READS",uniqueConstraints=@UniqueConstraint(columnNames={"event_id","user_id"}))
public class ImpactRead {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id;
 @Column(name="event_id",nullable=false) private Long eventId;
 @Column(name="user_id",nullable=false) private Long userId;
 @Column(name="read_at",nullable=false) private LocalDateTime readAt;
 protected ImpactRead(){} public ImpactRead(Long eventId,Long userId){this.eventId=eventId;this.userId=userId;readAt=LocalDateTime.now();}
 public Long getEventId(){return eventId;}
}
