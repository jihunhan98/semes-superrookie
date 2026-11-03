package com.semes.reqops.domain.workflow.service;
import com.semes.reqops.domain.workflow.entity.WorkBundle;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class WorkflowReadServiceTest {
 @Test void threeConfirmedIssuesAndTwelveArtifactsRemainAtStepFour(){
  var p=WorkflowReadService.progress("CONFIRMED","CONFIRMED",3,12);
  assertEquals(4,p.step());assertEquals("확정 완료",p.label());assertEquals(12,p.artifactCount());assertEquals(12,p.expectedArtifactCount());
 }
 @Test void requirementConfirmationAloneIsOnlyDerivationReady(){
  var p=WorkflowReadService.progress("CONFIRMED",null,0,0);assertEquals(3,p.step());assertEquals("도출 준비",p.label());
 }
 @Test void savedDraftArtifactsProceedToReviewWithoutPretendingToBeConfirmed(){
  var p=WorkflowReadService.progress("CONFIRMED","REVIEW",3,12);assertEquals(4,p.step());assertEquals("산출물 검토",p.label());
 }
 @Test void editingRequirementDoesNotInheritOldBundleCompletion(){
  assertEquals(2,WorkflowReadService.progress("REVISING","CONFIRMED",3,12).step());
 }
 @Test void lateGenerationCallbackCannotDemoteConfirmedBundle(){
  var b=new WorkBundle(1L,10L,1,1L);b.generating();b.review();assertEquals("REVIEW",b.getState().name());
  b.confirm("[]","hash",1L);b.review();assertEquals("CONFIRMED",b.getState().name());
 }
}
