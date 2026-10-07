package com.semes.reqops.domain.insight;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.job.entity.*;
import com.semes.reqops.domain.job.repository.*;
import com.semes.reqops.domain.job.service.AiJobService;
import com.semes.reqops.domain.knowledge.entity.KnowledgeEntry;
import com.semes.reqops.domain.knowledge.repository.KnowledgeEntryRepository;
import com.semes.reqops.domain.knowledge.service.ProjectKnowledgeService;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.issue.repository.DevIssueRepository;
import com.semes.reqops.domain.artifact.repository.DevIssueArtifactRepository;
import com.semes.reqops.global.ai.AiClient;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

/** Uses existing durable AI jobs/tasks and versioned knowledge entries; no schema reset. */
@Service @RequiredArgsConstructor
public class InsightService {
    private final RequirementRepository requirements;
    private final MembershipRepository memberships;
    private final KnowledgeEntryRepository entries;
    private final ProjectKnowledgeService knowledge;
    private final AiJobRepository jobs;
    private final AiTaskRepository tasks;
    private final AiJobService jobService;
    private final DevIssueRepository issues;
    private final DevIssueArtifactRepository artifacts;
    private final AiClient ai;
    private final ObjectMapper mapper;

    public static String hash(String text) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8))); }
        catch(Exception e) { throw new IllegalStateException(e); }
    }
    public String json(Object value) { try {return mapper.writeValueAsString(value);} catch(Exception e){throw new IllegalStateException(e);} }
    @SuppressWarnings("unchecked") public Map<String,Object> read(String value) {try{return mapper.readValue(value,Map.class);}catch(Exception e){throw new IllegalStateException(e);}}
    public void member(Long project, Long user) {memberships.findByUserIdAndProjectId(user,project).orElseThrow(ApiErrors.NotProjectMember::new);}
    public List<Map<String,Object>> snapshot(Long project) {
        return requirements.findByProjectIdOrderByCreatedAtDesc(project).stream().sorted(Comparator.comparing(r->r.getId()))
            .map(r->{Map<String,Object> row=new LinkedHashMap<>();row.put("id",r.getId());row.put("reqKey",r.getReqKey());row.put("content",r.getContent());row.put("version",r.getVersion());row.put("state",r.getState().name());return row;}).toList();
    }
    @Transactional
    public void enqueue(Long project,Long reqId,Long user,String before,String after,boolean proposed) {
        var target=requirements.findById(reqId).filter(r->r.getProjectId().equals(project)).orElseThrow();
        List<Map<String,Object>> all=snapshot(project);
        Map<String,Object> input=new LinkedHashMap<>();
        input.put("operation","impact");input.put("projectId",project);input.put("requirementId",reqId);input.put("userId",user);
        input.put("reqKey",target.getReqKey());input.put("before",before==null?"":before);input.put("after",after);
        input.put("requirements",all);input.put("proposed",proposed);input.put("snapshotHash",hash(json(all)));
        String requestHash=hash(json(input));String key="impact-"+reqId+"-"+requestHash.substring(0,40);
        if(jobs.findByProjectIdAndIdempotencyKey(project,key).isPresent())return;
        AiJob job=jobs.save(new AiJob(project,reqId,null,"IMPACT",key,requestHash,user,1));
        tasks.save(new AiTask(job.getId(),"impact:"+reqId,"IMPACT",json(input)));
    }
    /** Called by the durable task worker, outside a long database transaction. */
    public void executeImpact(Long jobId,Map<String,Object> input) {
        Long project=((Number)input.get("projectId")).longValue();
        if(entries.findByProjectIdAndSourceTypeAndSourceIdAndSourceVersionId(project,"IMPACT",jobId,1L).isPresent())return;
        Map<String,Object> result;
        if(!Objects.equals(input.get("snapshotHash"),hash(json(snapshot(project))))) result=Map.of("status","STALE","decisions",List.of(),"summary","분석 입력이 변경되었습니다. 최신 내용으로 재분석해 주세요.");
        else {
            result=new LinkedHashMap<>(ai.insight("/impact",input));
            result.put("status",Objects.equals(input.get("snapshotHash"),hash(json(snapshot(project))))?"READY":"STALE");
        }
        Map<String,Object> saved=new LinkedHashMap<>(result);saved.put("input",input);saved.put("analyzedAt",Instant.now().toString());
        knowledge.project(project,"IMPACT",jobId,1L,json(saved));
    }
    @Transactional(readOnly=true)
    public List<Map<String,Object>> impacts(Long project,Long user) {
        member(project,user);
        String currentHash=hash(json(snapshot(project)));
        return jobs.findByProjectIdAndKindOrderByIdDesc(project,"IMPACT").stream().map(job->{
            Map<String,Object> row=new LinkedHashMap<>();row.put("id",job.getId());row.put("requirementId",job.getRequirementId());row.put("status",job.getStatus().name());
            var task=tasks.findByJobIdOrderByIdAsc(job.getId()).stream().findFirst();
            task.ifPresent(t->{row.put("status",t.getStatus());row.put("error",t.getErrorMessage());row.put("input",read(t.getInputJson()));});
            entries.findByProjectIdAndSourceTypeAndSourceIdAndSourceVersionId(project,"IMPACT",job.getId(),1L).ifPresent(entry->{
                row.putAll(read(entry.getContent()));
                var input=(Map<?,?>)row.get("input");
                if(!Objects.equals(currentHash,input.get("snapshotHash")))row.put("status","STALE");
            });
            row.put("read",entries.existsByProjectIdAndSourceTypeAndSourceIdAndSourceVersionId(project,"IMPACT_READ",job.getId(),user));
            return row;
        }).toList();
    }
    @Transactional
    public void markRead(Long project,Long jobId,Long user) {member(project,user);ownedJob(project,jobId);knowledge.project(project,"IMPACT_READ",jobId,user,"{}");}
    @Transactional
    public void retry(Long project,Long jobId,Long user) {
        member(project,user);var job=ownedJob(project,jobId);
        var input=read(tasks.findByJobIdOrderByIdAsc(jobId).get(0).getInputJson());
        if(!Objects.equals(input.get("snapshotHash"),hash(json(snapshot(project))))) {
            var r=requirements.findById(job.getRequirementId()).orElseThrow();
            enqueue(project,r.getId(),user,(String)input.get("before"),Boolean.TRUE.equals(input.get("proposed"))?(String)input.get("after"):r.getContent(),Boolean.TRUE.equals(input.get("proposed")));
        } else jobService.retryFailed(jobId,job.getRequestedBy());
    }
    private AiJob ownedJob(Long p,Long id){return jobs.findById(id).filter(j->j.getProjectId().equals(p)&&"IMPACT".equals(j.getKind())).orElseThrow(()->new ApiErrors.BadRequest("영향 분석을 찾을 수 없습니다."));}

    public Map<String,Object> code(Long project) {
        return entries.findFirstByProjectIdAndSourceTypeOrderByIdDesc(project,"CODE").map(e->{Map<String,Object> out=new LinkedHashMap<>(read(e.getContent()));out.put("snapshotId",e.getId());return out;}).orElse(Map.of());
    }
    public Map<String,Object> registerCode(Long project,Long user,Map<String,Object> input) {
        member(project,user);Map<String,Object> indexed=ai.insight("/code/index",input);
        // Each registration activates a new immutable snapshot, including a restored source version.
        String text=json(indexed);long version=System.currentTimeMillis();
        var saved=knowledge.project(project,"CODE",project,version,text);
        Map<String,Object> result=new LinkedHashMap<>(indexed);result.put("snapshotId",saved.getId());return result;
    }
    public Map<String,Object> coverageInput(Long project,Long reqId) {
        var r=requirements.findById(reqId).filter(x->x.getProjectId().equals(project)).orElseThrow(()->new ApiErrors.RequirementNotFound(reqId));
        List<Map<String,Object>> rows=new ArrayList<>();
        for(var issue:issues.findByRequirementIdAndIssueStateNotOrderByDisplayOrderAsc(reqId,"RETIRED")) {
            Map<String,Object> row=new LinkedHashMap<>();row.put("id",issue.getId());row.put("displayId",issue.getDisplayId());row.put("title",issue.getTitle());row.put("quote",issue.getQuote());row.put("content",issue.aiContent());
            row.put("artifacts",artifacts.findByDevIssueIdOrderByArtifactTypeAsc(issue.getId()).stream().map(a->Map.of("type",a.getArtifactType().slug(),"revision",a.getRowVersion(),"content",read(a.getContentJson()))).toList());rows.add(row);
        }
        return Map.of("reqKey",r.getReqKey(),"requirementContent",r.getContent(),"existing",snapshot(project),"issues",rows,"codeContext",code(project));
    }
    public Map<String,Object> coverage(Long project,Long reqId,Long user) {
        member(project,user);var input=coverageInput(project,reqId);String inputHash=hash(json(input));
        var result=new LinkedHashMap<>(ai.insight("/coverage",input));
        if(!inputHash.equals(hash(json(coverageInput(project,reqId)))))throw new ApiErrors.Conflict("검토 중 입력이 변경되었습니다. 다시 검토해 주세요.");
        result.put("inputHash",inputHash);result.put("checkedAt",Instant.now().toString());
        knowledge.project(project,"COVERAGE",reqId,System.currentTimeMillis(),json(result));return result;
    }
    public Map<String,Object> latestCoverage(Long project,Long reqId,Long user) {
        member(project,user);var input=coverageInput(project,reqId);
        return entries.findFirstByProjectIdAndSourceTypeAndSourceIdOrderByIdDesc(project,"COVERAGE",reqId).map(e->{Map<String,Object> r=new LinkedHashMap<>(read(e.getContent()));r.put("stale",!Objects.equals(r.get("inputHash"),hash(json(input))));return r;}).orElse(Map.of());
    }
}
