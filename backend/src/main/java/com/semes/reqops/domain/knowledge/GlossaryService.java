package com.semes.reqops.domain.knowledge;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.project.repository.*;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.domain.requirement.service.ReviewAnalysisStore;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.text.Normalizer;import java.util.*;import java.util.regex.*;
import static com.semes.reqops.domain.knowledge.KnowledgeDto.*;

@Service @RequiredArgsConstructor
public class GlossaryService {
 private final ProjectTermRepository terms;
 private final ProjectTermUsageRepository usages;
 private final ProjectRepository projects;
 private final MembershipRepository memberships;
 private final RequirementRepository requirements;
 private final ObjectMapper mapper;
 public record ImportResult(int newCount,String hash){}
 public void requireMember(Long project,Long actor){memberships.findByUserIdAndProjectId(actor,project).orElseThrow(ApiErrors.NotProjectMember::new);}
 public static String normalize(String name){return Normalizer.normalize(name,Normalizer.Form.NFKC).trim().replaceAll("\\s+"," ").toLowerCase(Locale.ROOT);}
 @Transactional(readOnly=true)
 public List<GlossaryTerm> forAnalysis(Long project){return terms.findByProjectIdOrderByIdAsc(project).stream().map(t->new GlossaryTerm(t.getId(),t.getName(),t.getDefinition(),t.getStatus())).toList();}
 public String hash(List<GlossaryTerm> rows){try{return ReviewAnalysisStore.hash(mapper.writeValueAsString(rows.stream().sorted(Comparator.comparing(t->normalize(t.name()))).toList()));}catch(Exception e){throw new IllegalStateException(e);}}
 @Transactional(readOnly=true)
 public long pending(Long project){return terms.countByProjectIdAndStatus(project,"PENDING");}
 @Transactional(readOnly=true)
 public GlossaryView list(Long project,Long actor){
  requireMember(project,actor);
  List<TermView> result=terms.findByProjectIdOrderByIdAsc(project).stream().map(t->new TermView(t.getId(),t.getName(),t.getDefinition(),t.getAiDefinition(),t.getStatus(),t.getRevision(),
   usages.findByTermIdOrderByIdAsc(t.getId()).stream().map(u->requirements.findById(u.getRequirementId()).filter(r->r.getProjectId().equals(project)).map(r->new Usage(r.getId(),r.getReqKey(),u.getSourceQuote())).orElse(null)).filter(Objects::nonNull).toList())).toList();
  return new GlossaryView(result,result.stream().filter(t->"PENDING".equals(t.status())).count());
 }
 @Transactional
 public GlossaryView review(Long project,Long id,TermReview request){
  requireMember(project,request.userId());projects.findLockedById(project).orElseThrow(()->new ApiErrors.Conflict("프로젝트를 찾지 못했습니다."));
  ProjectTerm term=terms.findById(id).filter(t->t.getProjectId().equals(project)).orElseThrow(()->new ApiErrors.Conflict("용어를 찾지 못했습니다."));
  if(term.getRevision()!=request.revision())throw new ApiErrors.Conflict("다른 사용자가 용어를 수정했습니다. 새로고침 후 다시 확인해주세요.");
  if(!List.of("PENDING","CONFIRMED","DISMISSED").contains(request.status()))throw new ApiErrors.Conflict("용어 확인 상태가 올바르지 않습니다.");
  String normalized=normalize(request.name());
  if(normalized.isBlank()||normalized.length()>200)throw new ApiErrors.Conflict("용어 이름을 확인해주세요.");
  terms.findByProjectIdAndNormalizedName(project,normalized).filter(t->!t.getId().equals(id)).ifPresent(t->{throw new ApiErrors.Conflict("같은 이름의 용어가 이미 있습니다.");});
  term.review(request.name().trim(),normalized,request.definition().trim(),request.status(),request.userId());
  terms.saveAndFlush(term);
  return list(project,request.userId());
 }
 @Transactional
 public ImportResult importCandidates(Long project,Long req,String content,List<TermCandidate> candidates,String expectedHash){
  projects.findLockedById(project).orElseThrow(()->new ApiErrors.Conflict("프로젝트를 찾지 못했습니다."));
  if(expectedHash!=null&&!expectedHash.equals(hash(forAnalysis(project))))throw new ApiErrors.Conflict("분석 중 용어사전이 바뀌었습니다. 최신 정의로 다시 검토해주세요.");
  int created=0;
  for(TermCandidate candidate:candidates==null?List.<TermCandidate>of():candidates){
   if(candidate.name()==null||candidate.definition()==null||candidate.quote()==null)continue;
   String name=candidate.name().trim(),normalized=normalize(name);
   if(name.isBlank()||name.length()>100||normalized.length()>200||candidate.definition().isBlank()||candidate.definition().length()>10000||!content.contains(candidate.quote())||!candidate.quote().toLowerCase(Locale.ROOT).contains(name.toLowerCase(Locale.ROOT)))continue;
   // Existing confirmed definitions and dismissed candidates are never overwritten by inference.
   if(terms.findByProjectIdAndNormalizedName(project,normalized).isPresent())continue;
   terms.saveAndFlush(new ProjectTerm(project,name,normalized,candidate.definition().trim()));created++;
  }
  usages.deleteByRequirementId(req);usages.flush();
  for(ProjectTerm term:terms.findByProjectIdOrderByIdAsc(project)){
   Matcher found=Pattern.compile("(?<![A-Za-z0-9_])"+Pattern.quote(term.getName())+"(?![A-Za-z0-9_])",Pattern.CASE_INSENSITIVE|Pattern.UNICODE_CASE).matcher(content);
   if(found.find()){
    int start=Math.max(0,content.lastIndexOf('\n',found.start())+1),end=content.indexOf('\n',found.end());if(end<0)end=content.length();
    usages.save(new ProjectTermUsage(term.getId(),req,content.substring(start,end)));
   }
  }
  return new ImportResult(created,hash(forAnalysis(project)));
 }
}
