package com.semes.reqops.domain.workflow.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public final class BundleDto {
    private BundleDto(){}
    public record ArtifactSummary(Long id,String type,String state,int schemaVersion,long revision){}
    public record IssueSummary(Long id,String issueKey,String title,String quote,String symptom,String improvementReq,
                               String changeScope,String constraintsNote,String beforeState,String afterState,
                               String dueOn,String createdAt,String resolvedAt,String state,long revision,
                               List<ArtifactSummary> artifacts){ @com.fasterxml.jackson.annotation.JsonProperty("displayId") public String displayId(){return String.format("DEV-%06d",id);} }
    public record GenerationProgress(Long id,String status,int total,int succeeded,int failed,int pending){}
    public record BundleResponse(Long id,Long requirementId,int revisionNo,String state,long revision,List<IssueSummary> issues,String manifestJson,GenerationProgress generation){}
    public record ConfirmRequest(@NotNull Long userId,@NotNull Long expectedRevision,String idempotencyKey){}
}
