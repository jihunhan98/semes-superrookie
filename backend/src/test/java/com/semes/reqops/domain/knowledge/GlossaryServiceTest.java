package com.semes.reqops.domain.knowledge;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.project.repository.*;
import com.semes.reqops.domain.project.entity.*;
import com.semes.reqops.domain.requirement.repository.RequirementRepository;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.*;import org.springframework.test.util.ReflectionTestUtils;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;
class GlossaryServiceTest {
 static <T>T stub(Class<T> type){return mock(type,withSettings().mockMaker("mock-maker-subclass"));}
 ProjectTermRepository terms=stub(ProjectTermRepository.class);ProjectTermUsageRepository usages=stub(ProjectTermUsageRepository.class);
 ProjectRepository projects=stub(ProjectRepository.class);MembershipRepository memberships=stub(MembershipRepository.class);RequirementRepository requirements=stub(RequirementRepository.class);
 GlossaryService service=new GlossaryService(terms,usages,projects,memberships,requirements,new ObjectMapper());
 List<ProjectTerm> rows=new ArrayList<>();
 @BeforeEach void setup(){when(projects.findLockedById(1L)).thenReturn(Optional.of(stub(Project.class)));when(terms.findByProjectIdOrderByIdAsc(1L)).thenAnswer(i->new ArrayList<>(rows));when(terms.findByProjectIdAndNormalizedName(eq(1L),anyString())).thenAnswer(i->rows.stream().filter(t->t.getNormalizedName().equals(i.getArgument(1))).findFirst());when(terms.saveAndFlush(any())).thenAnswer(i->{ProjectTerm t=i.getArgument(0);ReflectionTestUtils.setField(t,"id",(long)rows.size()+1);if(!rows.contains(t))rows.add(t);return t;});}
 ProjectTerm add(String name,String definition,String state){ProjectTerm t=new ProjectTerm(1L,name,GlossaryService.normalize(name),definition);ReflectionTestUtils.setField(t,"id",(long)rows.size()+1);t.review(name,t.getNormalizedName(),definition,state,7L);rows.add(t);return t;}
 @Test void newCandidateIsPendingAndLinkedToItsRequirement(){
  String text="Task Step은 태스크 수행 단계이다.";
  var result=service.importCandidates(1L,77L,text,List.of(new TermCandidate("Task Step","단계로 추정됨",text)),service.hash(List.of()));
  assertEquals(1,result.newCount());assertEquals("PENDING",rows.get(0).getStatus());
  var cap=org.mockito.ArgumentCaptor.forClass(ProjectTermUsage.class);verify(usages).save(cap.capture());assertEquals(77L,cap.getValue().getRequirementId());assertEquals(text,cap.getValue().getSourceQuote());
 }
 @Test void inferenceNeverOverwritesConfirmedDefinition(){
  var existing=add("Task Step","사용자가 확정한 정의","CONFIRMED");
  var before=service.hash(service.forAnalysis(1L));
  service.importCandidates(1L,77L,"Task Step 상태를 확인한다.",List.of(new TermCandidate("task step","AI가 새로 추정한 뜻","Task Step 상태를 확인한다.")),before);
  assertEquals(1,rows.size());assertEquals("사용자가 확정한 정의",existing.getDefinition());assertEquals("CONFIRMED",existing.getStatus());
  verify(terms,never()).saveAndFlush(any());
 }
 @Test void dismissedTermIsNotAutomaticallyRegisteredAgain(){
  var t=add("VCS","사용하지 않는 용어","DISMISSED");
  service.importCandidates(1L,77L,"VCS가 작업을 처리한다.",List.of(new TermCandidate("VCS","새 추정","VCS가 작업을 처리한다.")),service.hash(service.forAnalysis(1L)));
  assertEquals(1,rows.size());assertEquals("DISMISSED",t.getStatus());verify(terms,never()).saveAndFlush(any());
 }
 @Test void unsupportedTermWithoutEvidenceIsNotRegistered(){
  service.importCandidates(1L,77L,"원문",List.of(new TermCandidate("AMR","추정","없는 인용")),service.hash(List.of()));
  assertTrue(rows.isEmpty());verify(terms,never()).saveAndFlush(any());
 }
 @Test void dictionaryChangeDuringAnalysisRejectsOldSnapshot(){
  String before=service.hash(List.of());add("VCS","새로 확정한 정의","CONFIRMED");
  assertThrows(ApiErrors.Conflict.class,()->service.importCandidates(1L,77L,"VCS",List.of(),before));verify(usages,never()).deleteByRequirementId(any());
 }
 @Test void nonMemberCannotReadOrReviewGlossary(){
  assertThrows(ApiErrors.NotProjectMember.class,()->service.list(1L,9L));
  assertThrows(ApiErrors.NotProjectMember.class,()->service.review(1L,1L,new KnowledgeDto.TermReview(9L,0L,"VCS","의미","CONFIRMED")));
 }
 @Test void staleReviewCannotOverwriteAnotherUserEdit(){
  var term=add("VCS","의미","PENDING");when(memberships.findByUserIdAndProjectId(7L,1L)).thenReturn(Optional.of(stub(Membership.class)));when(terms.findById(term.getId())).thenReturn(Optional.of(term));
  assertThrows(ApiErrors.Conflict.class,()->service.review(1L,term.getId(),new KnowledgeDto.TermReview(7L,8L,"VCS","덮어쓰기","CONFIRMED")));assertEquals("의미",term.getDefinition());
 }
 @Test void normalizedNameIsCaseAndWhitespaceInsensitive(){assertEquals(GlossaryService.normalize(" Task   Step "),GlossaryService.normalize("task step"));}
 @Test void confirmingDefinitionChangesAnalysisHash(){var term=add("Task Step","동일한 뜻","PENDING");String before=service.hash(service.forAnalysis(1L));term.review("Task Step",term.getNormalizedName(),term.getDefinition(),"CONFIRMED",7L);assertNotEquals(before,service.hash(service.forAnalysis(1L)));}
}
