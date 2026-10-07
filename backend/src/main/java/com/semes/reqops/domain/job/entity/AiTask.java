package com.semes.reqops.domain.job.entity;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity @Table(name="AI_TASKS")
public class AiTask {
 @Id @GeneratedValue(strategy=GenerationType.IDENTITY) private Long id; @Column(name="job_id",nullable=false) private Long jobId;
 @Column(name="task_key",nullable=false,length=160) private String taskKey; @Column(nullable=false,length=30) private String phase;
 @Column(nullable=false,length=20) private String status; @Column(name="attempt",nullable=false) private int attempt; @Column(name="max_attempts",nullable=false) private int maxAttempts=3;
 @Column(name="next_run_at",nullable=false) private LocalDateTime nextRunAt; @Column(name="lease_until") private LocalDateTime leaseUntil;
 @Column(name="lease_token",length=64) private String leaseToken; @Column(name="worker_id",length=100) private String workerId;
 @Lob @Column(name="input_json") private String inputJson; @Lob @Column(name="result_json") private String resultJson;
 @Column(name="error_code",length=80) private String errorCode; @Column(name="error_message",length=1000) private String errorMessage;
 @Column(name="created_at",nullable=false,updatable=false) private LocalDateTime createdAt; @Column(name="updated_at",nullable=false) private LocalDateTime updatedAt;
 protected AiTask(){} public AiTask(Long job,String key,String phase,String input){jobId=job;taskKey=key;this.phase=phase;inputJson=input;status="QUEUED";nextRunAt=LocalDateTime.now();}
 @PrePersist void created(){createdAt=updatedAt=LocalDateTime.now();} @PreUpdate void updated(){updatedAt=LocalDateTime.now();}
 public void claim(String worker,String token){status="RUNNING";workerId=worker;leaseToken=token;leaseUntil=LocalDateTime.now().plusSeconds(180);attempt++;}
 public void recoverExpired(){status="RETRY_WAIT";leaseUntil=null;leaseToken=null;workerId=null;nextRunAt=LocalDateTime.now();}
 public void succeed(String result){status="SUCCEEDED";resultJson=result;leaseUntil=null;} public void fail(String code,String message){errorCode=code;errorMessage=message==null?null:message.substring(0,Math.min(message.length(),1000));leaseUntil=null;if(attempt<maxAttempts){status="RETRY_WAIT";nextRunAt=LocalDateTime.now().plusSeconds(attempt==1?2:8);}else status="FAILED";}
 public void manualRetry(){status="RETRY_WAIT";attempt=0;errorCode=null;errorMessage=null;leaseUntil=null;leaseToken=null;workerId=null;nextRunAt=LocalDateTime.now();}
 public Long getId(){return id;} public Long getJobId(){return jobId;} public String getTaskKey(){return taskKey;} public String getStatus(){return status;} public String getInputJson(){return inputJson;} public int getAttempt(){return attempt;} public String getErrorCode(){return errorCode;} public String getErrorMessage(){return errorMessage;}
}
