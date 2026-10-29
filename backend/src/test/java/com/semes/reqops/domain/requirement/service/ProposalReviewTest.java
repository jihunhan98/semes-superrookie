package com.semes.reqops.domain.requirement.service;
import com.semes.reqops.domain.requirement.dto.RequirementDto.ProposalDecision;
import com.semes.reqops.domain.requirement.entity.RequirementFinding;
import com.semes.reqops.global.ai.AiAnalyzeDto.Proposal;
import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class ProposalReviewTest {
    RequirementFinding finding(long id,int start,String span) {
        var f=mock(RequirementFinding.class);
        when(f.getId()).thenReturn(id);
        lenient().when(f.getSpanStart()).thenReturn(start);
        lenient().when(f.getSpanEnd()).thenReturn(start+span.length());
        lenient().when(f.getTargetSpan()).thenReturn(span);
        return f;
    }
    @Test void selectedNumericCandidateIsAnExplicitUserDecision() {
        String text="응답을 기다린다.";var f=finding(1,0,text);
        var p=new Proposal("AI 제안값","REPLACE",text,"3초 동안 응답을 기다린다.",0,text.length(),false);
        var result=ProposalReview.validate(text,p.after(),false,List.of(f),List.of(new ProposalDecision(1L,"APPLY",0,null,null)),x->List.of(p));
        assertEquals("APPLY",result.get(1L).action());
    }
    @Test void missingDuplicateOrForeignDecisionsAreRejected() {
        var f=finding(1,0,"본문");var d=new ProposalDecision(1L,"EXCLUDE",null,null,null);
        assertThrows(ApiErrors.Conflict.class,()->ProposalReview.validate("본문","본문",false,List.of(f),List.of(),x->List.of()));
        assertThrows(ApiErrors.Conflict.class,()->ProposalReview.validate("본문","본문",false,List.of(f),List.of(d,d),x->List.of()));
        assertThrows(ApiErrors.Conflict.class,()->ProposalReview.validate("본문","본문",true,List.of(f),List.of(new ProposalDecision(9L,"EXCLUDE",null,null,null)),x->List.of()));
    }
    @Test void excludingPreservesOriginalTextAndDoesNotNeedAProposal() {
        var f=finding(1,0,"본문");
        assertDoesNotThrow(()->ProposalReview.validate("본문","본문",false,List.of(f),List.of(new ProposalDecision(1L,"EXCLUDE",null,null,null)),x->List.of()));
    }
    @Test void customReplacementUsesPreciseOccurrenceAndUtf16() {
        String text="😀 상태. 상태.";var f=finding(1,7,"상태.");
        assertDoesNotThrow(()->ProposalReview.validate(text,"😀 상태. 정상 상태.",false,List.of(f),List.of(new ProposalDecision(1L,"EDIT",null,"정상 상태.",null)),x->List.of()));
    }
    @Test void alteredResultAndUnresolvedMarkersAreRejected() {
        var f=finding(1,0,"본문");var d=new ProposalDecision(1L,"EDIT",null,"수정",null);
        assertThrows(ApiErrors.Conflict.class,()->ProposalReview.validate("본문","무관한 결과",false,List.of(f),List.of(d),x->List.of()));
        assertThrows(ApiErrors.Conflict.class,()->ProposalReview.validate("본문","⟦시간⟧",true,List.of(f),List.of(d),x->List.of()));
    }
    @Test void overlappingChoicesRequireExplicitManualFinalBody() {
        var a=finding(1,0,"본문");var b=finding(2,0,"본문");
        var decisions=List.of(new ProposalDecision(1L,"EDIT",null,"수정1",null),new ProposalDecision(2L,"EDIT",null,"수정2",null));
        assertThrows(ApiErrors.Conflict.class,()->ProposalReview.validate("본문","통합 수정",false,List.of(a,b),decisions,x->List.of()));
        assertDoesNotThrow(()->ProposalReview.validate("본문","통합 수정",true,List.of(a,b),decisions,x->List.of()));
    }
}
