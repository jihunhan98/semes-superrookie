package com.semes.reqops.domain.requirement.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.requirement.dto.RequirementDto.FindingResponse;
import com.semes.reqops.domain.requirement.entity.*;
import com.semes.reqops.domain.requirement.repository.*;
import com.semes.reqops.global.ai.AiAnalyzeDto.*;
import com.semes.reqops.global.exception.ApiErrors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ReviewAnalysisStore {
    private final RequirementRepository requirements;
    private final RequirementFindingRepository findings;
    private final RequirementAiDraftRepository drafts;
    private final ObjectMapper mapper;

    public static String hash(String value) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8))); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    public List<Existing> existing(Long project, Long exclude) {
        return requirements.findByProjectIdOrderByCreatedAtDesc(project).stream()
            .filter(r -> !r.getId().equals(exclude))
            .map(r -> new Existing(r.getReqKey(), r.getContent(), r.getState().name(), r.getVersion())).toList();
    }
    public String existingHash(List<Existing> rows) {
        return hash(json(rows.stream().sorted(Comparator.comparing(Existing::reqKey)).toList()));
    }
    public String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (Exception e) { throw new IllegalStateException(e); }
    }
    public ReviewContext context(RequirementAiDraft draft) {
        try { return draft == null || draft.getReviewData() == null ? null : mapper.readValue(draft.getReviewData(), ReviewContext.class); }
        catch (Exception e) { return null; }
    }
    public FindingResponse response(RequirementFinding f) {
        Finding extra = null;
        try { if (f.getSuggestionData() != null) extra = mapper.readValue(f.getSuggestionData(), Finding.class); }
        catch (Exception ignored) { /* Old findings are still readable, but never executable edits. */ }
        return new FindingResponse(f.getId(), ReviewFindingTypes.normalize(f.getFindingType()), f.getTargetSpan(), f.getReason(),
            f.getSuggestion(), f.getConflictReqKey(), f.getSeverity(), f.getResolutionState(),
            extra == null || extra.proposals() == null ? List.of() : extra.proposals(),
            extra == null ? null : extra.interpretations(), extra == null ? null : extra.conflictQuote(),
            f.getSpanStart(), f.getSpanEnd());
    }
    @Transactional
    public void save(Long id, String content, Response response, List<Existing> existing, boolean initialOnly) {
        requirements.findLockedById(id).orElseThrow(() -> new ApiErrors.RequirementNotFound(id));
        RequirementAiDraft latest = drafts.findFirstByRequirementIdOrderByIdDesc(id).orElse(null);
        // An initial queued analysis must not replace a newer user-triggered review.
        if (initialOnly && latest != null && latest.getReviewData() != null) return;
        ReviewContext previous = context(latest);
        Set<String> kept = new HashSet<>();
        for (RequirementFinding old : findings.findByRequirementIdOrderByIdAsc(id)) {
            if ("KEPT".equals(old.getResolutionState())) {
                if (previous != null && Objects.equals(previous.existingHash(), existingHash(existing))
                    && Objects.equals(old.getInputHash(), hash(content))) {
                    kept.add(ReviewFindingTypes.normalize(old.getFindingType()) + ":" + old.getSpanStart() + ":" + old.getConflictReqKey() + ":" + old.getReason());
                }
                old.supersede();
                findings.save(old);
            } else if ("OPEN".equals(old.getResolutionState())) {
                old.supersede();
                findings.save(old);
            }
        }
        String analysis = UUID.randomUUID().toString(), inputHash = hash(content);
        for (Finding f : response.findings() == null ? List.<Finding>of() : response.findings()) {
            String category = ReviewFindingTypes.normalize(f.findingType());
            if (category == null) continue;
            Integer start = f.spanStart(), end = f.spanEnd();
            if (start == null || end == null || start < 0 || end > content.length() || start >= end
                || !content.substring(start, end).equals(f.targetSpan())) {
                // Exact unique location only; never use the first of repeated phrases.
                start = f.targetSpan() == null ? -1 : content.indexOf(f.targetSpan());
                if (start < 0 || content.indexOf(f.targetSpan(), start + 1) >= 0) continue;
                end = start + f.targetSpan().length();
            }
            List<Proposal> safe = new ArrayList<>();
            for (Proposal p : f.proposals() == null ? List.<Proposal>of() : f.proposals()) {
                if (!List.of("REPLACE", "INSERT_BEFORE", "INSERT_AFTER", "DELETE").contains(p.operation())) continue;
                if (!Objects.equals(start, p.start()) || !Objects.equals(end, p.end())
                    || !Objects.equals(f.targetSpan(), p.before()) || p.after() == null) continue;
                safe.add(p);
            }
            boolean groundedConflict = "기존 요구사항과 상충".equals(f.findingType()) && existing.stream()
                .anyMatch(r -> Objects.equals(r.reqKey(), f.conflictReqKey()) && ("CONFIRMED".equals(r.state()) || r.version() != null)
                    && f.conflictQuote() != null && !f.conflictQuote().isBlank() && r.content().contains(f.conflictQuote()));
            String severity = groundedConflict && "BLOCKING".equals(f.severity()) ? "BLOCKING" : "ADVISORY";
            Finding checked = new Finding(category, f.targetSpan(), f.reason(), f.suggestion(),
                f.conflictReqKey(), severity, safe, f.interpretations(), f.conflictQuote(), start, end);
            RequirementFinding entity = new RequirementFinding(id, checked.findingType(), checked.targetSpan(),
                checked.reason(), checked.suggestion(), checked.conflictReqKey(), analysis, start, end, inputHash);
            entity.setReviewData(severity, json(checked));
            if (kept.contains(checked.findingType() + ":" + start + ":" + checked.conflictReqKey() + ":" + checked.reason())) entity.keepOriginal();
            findings.save(entity);
        }
        RequirementAiDraft draft = new RequirementAiDraft(id, content, response.engine());
        draft.setReviewData(json(new ReviewContext(inputHash, existingHash(existing),
            response.reviewStatus() == null ? "RULE_ONLY" : response.reviewStatus(),
            response.reviewedCount() == null ? 0 : response.reviewedCount(), existing.size())));
        drafts.save(draft);
    }
}
