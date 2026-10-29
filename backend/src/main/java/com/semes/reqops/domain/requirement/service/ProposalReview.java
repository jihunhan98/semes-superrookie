package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.domain.requirement.dto.RequirementDto.*;
import com.semes.reqops.domain.requirement.entity.RequirementFinding;
import com.semes.reqops.global.ai.AiAnalyzeDto.Proposal;
import com.semes.reqops.global.exception.ApiErrors;
import java.util.*;
import java.util.function.Function;

/** Validate all user decisions and compose edits against one immutable analysis snapshot. */
public final class ProposalReview {
    private ProposalReview() {}
    private record Edit(int start, int end, String text) {}
    public static Map<Long,ProposalDecision> validate(String baseline, String result, boolean manual,
            List<RequirementFinding> findings, List<ProposalDecision> decisions,
            Function<RequirementFinding,List<Proposal>> proposals) {
        if (result == null || result.isBlank() || result.contains("⟦") || result.contains("⟧"))
            throw new ApiErrors.Conflict("최종 본문과 입력이 필요한 값을 확인해주세요.");
        Map<Long,ProposalDecision> selected = new HashMap<>();
        Set<Long> expected = new HashSet<>();
        for(var f:findings) expected.add(f.getId());
        for(var d:decisions) {
            if(!expected.contains(d.findingId()) || selected.put(d.findingId(),d)!=null)
                throw new ApiErrors.Conflict("검토 항목이 변경되었거나 중복되었습니다. 다시 불러와주세요.");
            if(!List.of("APPLY","EDIT","EXCLUDE").contains(d.action()))
                throw new ApiErrors.Conflict("제안 적용, 직접 수정, 제외 중 하나를 선택해주세요.");
        }
        if(selected.size()!=expected.size()) throw new ApiErrors.Conflict("모든 검토 항목을 적용·수정하거나 제외해주세요.");
        List<Edit> edits = new ArrayList<>();
        for(var f:findings) {
            var d=selected.get(f.getId());
            if("EXCLUDE".equals(d.action())) continue;
            int start=f.getSpanStart()==null?-1:f.getSpanStart(), end=f.getSpanEnd()==null?-1:f.getSpanEnd();
            if(start<0 || end<start || end>baseline.length() || !baseline.substring(start,end).equals(f.getTargetSpan()))
                throw new ApiErrors.Conflict("검토 원문 위치를 확인하지 못했습니다. 다시 분석해주세요.");
            String text;
            if("EDIT".equals(d.action())) {
                text=d.replacement();
                if(text==null || text.isBlank()) throw new ApiErrors.Conflict("직접 수정할 문장을 입력해주세요.");
            } else {
                var options=proposals.apply(f);
                if(d.proposalIndex()==null || d.proposalIndex()<0 || d.proposalIndex()>=options.size())
                    throw new ApiErrors.Conflict("적용할 AI 수정안을 선택해주세요.");
                var p=options.get(d.proposalIndex()); text=p.after();
                if("INSERT_BEFORE".equals(p.operation())) {end=start;text+="\n";}
                if("INSERT_AFTER".equals(p.operation())) {start=end;text="\n"+text;}
                if("DELETE".equals(p.operation())) text="";
            }
            edits.add(new Edit(start,end,text));
        }
        if(!manual) {
            edits.sort(Comparator.comparingInt(Edit::start).thenComparingInt(Edit::end));
            StringBuilder composed=new StringBuilder();int cursor=0;
            for(var e:edits) {
                if(e.start()<cursor) throw new ApiErrors.Conflict("수정안의 원문 범위가 겹칩니다. 최종 본문 직접 수정으로 정리해주세요.");
                composed.append(baseline,cursor,e.start()).append(e.text());cursor=e.end();
            }
            composed.append(baseline.substring(cursor));
            if(!composed.toString().equals(result)) throw new ApiErrors.Conflict("선택한 수정안과 최종 본문이 다릅니다.");
        }
        return selected;
    }
}
