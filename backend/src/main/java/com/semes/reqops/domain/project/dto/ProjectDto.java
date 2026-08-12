package com.semes.reqops.domain.project.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

/** 프로젝트 관련 요청/응답 DTO 모음. */
public final class ProjectDto {

    private ProjectDto() {
    }

    public record CreateRequest(
            @NotNull Long userId,
            @NotBlank String name,
            String customer,
            String description
    ) {}

    public record UpdateRequest(
            @NotNull Long userId,
            @NotBlank String name,
            String customer,
            String description
    ) {}

    public record JoinRequest(
            @NotNull Long userId,
            @NotBlank String token
    ) {}

    public record SummaryResponse(
            Long id,
            String name,
            String customer,
            String description,
            String role,
            int memberCount
    ) {}

    public record MemberResponse(
            Long userId,
            String name,
            String empNo,
            String dept,
            String role
    ) {}

    public record DetailResponse(
            Long id,
            String name,
            String customer,
            String description,
            String role,
            String token,
            List<MemberResponse> members
    ) {}

    public record TokenResponse(String token) {}
}
