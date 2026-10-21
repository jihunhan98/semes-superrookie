package com.semes.reqops.global.ai;

import java.util.List;

/** Full-context review contract. All edit offsets use UTF-16 (Java/JavaScript indices). */
public final class AiAnalyzeDto {
    private AiAnalyzeDto() {}
    public record Existing(String reqKey, String content, String state, String version) {
        public Existing(String reqKey, String content) { this(reqKey, content, null, null); }
    }
    public record GlossaryTerm(Long id, String name, String definition, String status) {}
    public record TermCandidate(String name, String definition, String quote) {}
    public record ProjectContext(String name, String description) {}
    public record Request(String content, String baseContent, String reason, List<Existing> existing, List<GlossaryTerm> glossary, ProjectContext projectContext) {
        public Request(String content,String baseContent,String reason,List<Existing> existing,List<GlossaryTerm> glossary){this(content,baseContent,reason,existing,glossary,null);}
        public Request(String content,String baseContent,String reason,List<Existing> existing){this(content,baseContent,reason,existing,List.of(),null);}
    }
    public record Proposal(String label, String operation, String before, String after,
                           Integer start, Integer end, boolean needsInput) {}
    public record Finding(String findingType, String targetSpan, String reason, String suggestion,
                          String conflictReqKey, String severity, List<Proposal> proposals,
                          String interpretations, String conflictQuote, Integer spanStart, Integer spanEnd,
                          String questionText, List<String> options) {
        public Finding(String type,String span,String reason,String suggestion,String key,String severity,List<Proposal> proposals,
                       String interpretations,String conflictQuote,Integer start,Integer end){
            this(type,span,reason,suggestion,key,severity,proposals,interpretations,conflictQuote,start,end,null,List.of());
        }
        public Finding(String type, String span, String reason, String suggestion, String key) {
            this(type, span, reason, suggestion, key, "ADVISORY", List.of(), null, null, null, null);
        }
    }
    public record Response(List<Finding> findings, String draftContent, String engine, String scope,
                           Integer elapsedMs, String reviewStatus, Integer reviewedCount, List<TermCandidate> terms, String termStatus) {
        public Response(List<Finding> findings,String draft,String engine,String scope,Integer elapsed,String status,Integer count){
            this(findings,draft,engine,scope,elapsed,status,count,List.of(),"unavailable".equals(engine)?"FAILED":"RULE_ONLY");
        }
        public Response(List<Finding> findings, String draft, String engine, String scope, Integer elapsed) {
            this(findings, draft, engine, scope, elapsed, "unavailable".equals(engine) ? "FAILED" : "RULE_ONLY", 0);
        }
    }
    public record ReviewContext(String inputHash, String existingHash, String status,
                                int comparedCount, int totalCount, String glossaryHash, int newTermCount) {
        public ReviewContext(String inputHash,String existingHash,String status,int comparedCount,int totalCount){
            this(inputHash,existingHash,status,comparedCount,totalCount,null,0);
        }
    }
}
