package com.semes.reqops.domain.auth;

import jakarta.validation.constraints.NotBlank;

/** 인증 관련 요청/응답 DTO 모음. */
public final class AuthDto {

    private AuthDto() {
    }

    public record SignupRequest(
            @NotBlank String empNo,
            @NotBlank String name,
            String dept,
            @NotBlank String password
    ) {}

    public record LoginRequest(
            @NotBlank String empNo,
            @NotBlank String password
    ) {}

    public record UserResponse(
            Long id,
            String empNo,
            String name,
            String dept
    ) {}
}
