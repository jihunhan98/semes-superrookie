package com.semes.reqops.domain.jira.dto;
import jakarta.validation.constraints.*;
public final class JiraDto {
    private JiraDto(){}
    public record TargetInput(@NotNull Long userId,@NotBlank @Size(max=512) String baseUrl,
        @NotBlank @Size(max=100) String jiraProjectKey,@NotBlank @Size(max=200) String displayName,
        @Pattern(regexp="[0-9]*") @Size(max=40) String issueTypeId,Long expectedRevision){}
    public record TargetResponse(Long id,String baseUrl,String jiraProjectKey,String displayName,String issueTypeId,long revision){}
    public record OpenRequest(@NotNull Long userId,@NotNull Long targetId){}
    public record IssueLinkResponse(Long targetId,Long devIssueId,String jiraIssueKey,String url,boolean created){}
}
