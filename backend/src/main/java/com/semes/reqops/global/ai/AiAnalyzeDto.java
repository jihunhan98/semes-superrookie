package com.semes.reqops.global.ai;

import java.util.List;

/** Full-context review contract. All edit offsets use UTF-16 (Java/JavaScript indices). */
public final class AiAnalyzeDto {
    private AiAnalyzeDto() {}
    public record Existing(String reqKey, String content, String state, String version) {
        public Existing(String reqKey, String content) { this(reqKey, content, null, null); }
    }
    public record Request(String content, String baseContent, String reason, List<Existing> existing) {}
    public record Proposal(String label, String operation, String before, String after,
                           Integer start, Integer end, boolean needsInput) {}
    public record Finding(String findingType, String targetSpan, String reason, String suggestion,
                          String conflictReqKey, String severity, List<Proposal> proposals,
                          String interpretations, String conflictQuote, Integer spanStart, Integer spanEnd) {
        public Finding(String type, String span, String reason, String suggestion, String key) {
            this(type, span, reason, suggestion, key, "ADVISORY", List.of(), null, null, null, null);
        }
    }
    public record Response(List<Finding> findings, String draftContent, String engine, String scope,
                           Integer elapsedMs, String reviewStatus, Integer reviewedCount) {
        public Response(List<Finding> findings, String draft, String engine, String scope, Integer elapsed) {
            this(findings, draft, engine, scope, elapsed, "unavailable".equals(engine) ? "FAILED" : "RULE_ONLY", 0);
        }
    }
    public record ReviewContext(String inputHash, String existingHash, String status,
                                int comparedCount, int totalCount) {}
}
