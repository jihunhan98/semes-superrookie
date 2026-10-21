package com.semes.reqops.domain.knowledge;
import jakarta.validation.constraints.*;import java.util.*;
public final class KnowledgeDto {
 private KnowledgeDto(){}
 public record Usage(Long requirementId,String reqKey,String quote){}
 public record TermView(Long id,String name,String definition,String aiDefinition,String status,long revision,List<Usage> usages){}
 public record GlossaryView(List<TermView> terms,long pendingCount){}
 public record TermReview(@NotNull Long userId,@NotNull Long revision,@NotBlank @Size(max=100) String name,@NotBlank @Size(max=30000) String definition,@NotBlank String status){}
 public record QuestionView(Long id,String category,String question,String sourceText,List<String> options,String status,String answer,String replacement,String note){}
 public record RefinementView(boolean exists,long revision,String content,String status,List<QuestionView> questions,long pendingTerms,int newTermCount,String termStatus,boolean dictionaryChanged){}
 public record AnswerRequest(@NotNull Long userId,@NotNull Long revision,@NotBlank @Size(max=4000) String answer){}
 public record DeferRequest(@NotNull Long userId,@NotNull Long revision,@Size(max=4000) String note){}
}
