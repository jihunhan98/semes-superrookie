package com.semes.reqops.domain.workflow.dto;

import jakarta.validation.constraints.NotNull;
import java.util.List;

public final class BundleDto {
    private BundleDto(){}
    public record ArtifactSummary(Long id,String type,String state,int schemaVersion,long revision){}
    public record IssueSummary(Long id,String issueKey,String title,String quote,String state,long revision,List<ArtifactSummary> artifacts){}
    public record BundleResponse(Long id,Long requirementId,int revisionNo,String state,long revision,List<IssueSummary> issues,String manifestJson){}
    public record ConfirmRequest(@NotNull Long userId,@NotNull Long expectedRevision,String idempotencyKey){}
}
