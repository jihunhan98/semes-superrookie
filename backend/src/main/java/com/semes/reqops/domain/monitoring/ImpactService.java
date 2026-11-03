package com.semes.reqops.domain.monitoring;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import com.semes.reqops.domain.requirement.entity.Requirement;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.domain.project.repository.MembershipRepository;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;import org.springframework.transaction.annotation.Transactional;
import java.util.*;import java.util.stream.Collectors;
@Service @RequiredArgsConstructor
public class ImpactService {
 private final ImpactEventRepository events;private final ImpactReadRepository reads;private final RequirementRepository requirements;private final RequirementAiDraftRepository drafts;private final MembershipRepository memberships;private final ObjectMapper mapper;
 public record Target(Long id,String reqKey,String content,String state,String version,Comparison comparison){}
 public record Data(String reqKey,String sourceContent,String savedContentHash,String sourceVersion,String kind,String status,int reviewedCount,int totalCount,List<Target> targets){}
 public record View(Long id,Long requirementId,String createdAt,boolean stale,Data data){}
 /** Caller holds the requirement lock, so concurrent retries cannot duplicate an event. */
 @Transactional public void capture(Requirement req,String content,Response response,List<Existing> existing,String contextHash){
  String input=ReviewAnalysisStore.hash(content);
  List<Comparison> received=response.comparisons()==null?List.of():response.comparisons();
  var ids=requirements.findByProjectIdOrderByCreatedAtDesc(req.getProjectId()).stream().collect(Collectors.toMap(Requirement::getReqKey,Requirement::getId));
  List<Target> targets=new ArrayList<>();
  for(var old:existing){
   var rows=received.stream().filter(Objects::nonNull).filter(c->Objects.equals(c.reqKey(),old.reqKey())).toList();
   Comparison c=rows.size()==1?rows.get(0):null;
   if(!valid(c,content,old.content())) c=new Comparison(old.reqKey(),"UNREVIEWED","","","","응답 누락 또는 원문 근거 검증에 실패했습니다.","최신 본문으로 다시 검토해주세요.");
   targets.add(new Target(ids.get(old.reqKey()),old.reqKey(),old.content(),old.state(),old.version(),c));
  }
  int reviewed=(int)targets.stream().filter(t->!"UNREVIEWED".equals(t.comparison().relation())).count();
  String status=reviewed==targets.size()?"COMPLETE":reviewed==0?"FAILED":"PARTIAL";
  Data data=new Data(req.getReqKey(),content,ReviewAnalysisStore.hash(req.getContent()),req.getVersion(),Objects.equals(content,req.getContent())?"저장 본문 검토":"수정 중 본문 검토",status,reviewed,targets.size(),targets);
  String json=json(data);
  for(var old:events.findByRequirementIdAndCurrent(req.getId(),1)){
   if(old.getInputHash().equals(input)&&old.getContextHash().equals(contextHash)&&old.getEventData().equals(json))return;
   old.supersede();events.save(old);
  }
  events.save(new ImpactEvent(req.getProjectId(),req.getId(),input,contextHash,json));
 }
 public static boolean valid(Comparison c,String source,String target){
  if(c==null||!Set.of("CONFLICT","DEPENDENCY_REVIEW","NEEDS_REVIEW","NONE").contains(c.relation()==null?"":c.relation())||blank(c.reason()))return false;
  return "NONE".equals(c.relation())||(!blank(c.sourceQuote())&&source.contains(c.sourceQuote())&&!blank(c.targetQuote())&&target.contains(c.targetQuote())&&!blank(c.sameCondition())&&!blank(c.reviewQuestion()));
 }
 @Transactional(readOnly=true) public List<View> list(Long project,Long user,Long requirement,boolean includeRead){
  member(project,user);
  var all=includeRead?events.findByProjectIdOrderByIdDesc(project):events.findByProjectIdAndCurrentOrderByIdDesc(project,1);
  var seen=all.isEmpty()?Set.<Long>of():reads.findByUserIdAndEventIdIn(user,all.stream().map(ImpactEvent::getId).toList()).stream().map(ImpactRead::getEventId).collect(Collectors.toSet());
  var reqs=requirements.findByProjectIdOrderByCreatedAtDesc(project);
  var byId=reqs.stream().collect(Collectors.toMap(Requirement::getId,x->x));
  var latestDrafts=all.isEmpty()?Map.<Long,com.semes.reqops.domain.requirement.entity.RequirementAiDraft>of():drafts.findLatestForRequirements(all.stream().map(ImpactEvent::getRequirementId).distinct().toList()).stream().collect(Collectors.toMap(d->d.getRequirementId(),d->d));
  List<View> result=new ArrayList<>();
  for(var e:all){
   if(requirement!=null&&!requirement.equals(e.getRequirementId()))continue;
   if(!includeRead&&seen.contains(e.getId()))continue;
   Data data=parse(e.getEventData());
   var source=byId.get(e.getRequirementId());if(source==null)continue;
   // A draft becomes obsolete when another review or saved body replaces it.
   var latest=latestDrafts.get(source.getId());
   boolean stale=!e.isCurrent()||latest==null||!e.getInputHash().equals(ReviewAnalysisStore.hash(latest.getDraftContent()));
   if(!Objects.equals(data.savedContentHash(),ReviewAnalysisStore.hash(source.getContent()))&&!Objects.equals(e.getInputHash(),ReviewAnalysisStore.hash(source.getContent())))stale=true;
   var expected=data.targets().stream().map(t->new Existing(t.reqKey(),t.content(),t.state(),t.version())).sorted(Comparator.comparing(Existing::reqKey)).toList();
   var current=reqs.stream().filter(r->!r.getId().equals(source.getId())).map(r->new Existing(r.getReqKey(),r.getContent(),r.getState().name(),r.getVersion())).sorted(Comparator.comparing(Existing::reqKey)).toList();
   if(!expected.equals(current))stale=true;
   boolean warning=!"COMPLETE".equals(data.status())||data.targets().stream().anyMatch(t->!"NONE".equals(t.comparison().relation()));
   if(includeRead||warning&&!stale)result.add(new View(e.getId(),e.getRequirementId(),e.getCreatedAt().toString(),stale,data));
  }
  return result;
 }
 @Transactional public void read(Long project,Long id,Long user){
  member(project,user);var event=events.lockById(id).filter(e->e.getProjectId().equals(project)).orElseThrow(()->new ApiErrors.BadRequest("알림을 찾지 못했습니다."));
  if(!reads.existsByEventIdAndUserId(id,user))reads.save(new ImpactRead(id,user));
 }
 private void member(Long p,Long u){memberships.findByUserIdAndProjectId(u,p).orElseThrow(ApiErrors.NotProjectMember::new);}
 private static boolean blank(String x){return x==null||x.isBlank();}
 private String json(Object o){try{return mapper.writeValueAsString(o);}catch(Exception e){throw new IllegalStateException(e);}}
 private Data parse(String json){try{return mapper.readValue(json,Data.class);}catch(Exception e){throw new IllegalStateException(e);}}
}
