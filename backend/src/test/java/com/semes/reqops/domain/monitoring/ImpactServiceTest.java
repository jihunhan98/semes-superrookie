package com.semes.reqops.domain.monitoring;
import com.semes.reqops.global.ai.AiAnalyzeDto.Comparison;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class ImpactServiceTest {
 @Test void serverAcceptsOnlyExactEvidenceForBothDocuments(){
  var c=new Comparison("REQ01","CONFLICT","30%","50%","같은 AMR 후보 조건","30~50%의 포함 여부가 다릅니다.","기준을 선택해주세요.");
  assertTrue(ImpactService.valid(c,"SOC 30% 이상","SOC 50% 이상"));
  assertFalse(ImpactService.valid(c,"SOC 30% 이상","SOC 40% 이상"));
 }
 @Test void missingOrUnsupportedComparisonCannotBeNoImpact(){
  assertFalse(ImpactService.valid(null,"본문","본문"));
  assertFalse(ImpactService.valid(new Comparison("REQ01","UNREVIEWED","","","","미확인",""),"본문","본문"));
  assertFalse(ImpactService.valid(new Comparison("REQ01","NONE","","","","",""),"본문","본문"));
 }
 @Test void explicitNoImpactRequiresItsReasonButNotFakeEvidence(){
  assertTrue(ImpactService.valid(new Comparison("REQ01","NONE","","","","서로 다른 동작입니다.",""),"본문","본문"));
 }
}
