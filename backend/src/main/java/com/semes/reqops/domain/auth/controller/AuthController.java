package com.semes.reqops.domain.auth.controller;

import com.semes.reqops.domain.auth.dto.AuthDto.LoginRequest;
import com.semes.reqops.domain.auth.dto.AuthDto.SignupRequest;
import com.semes.reqops.domain.auth.dto.AuthDto.UserResponse;
import com.semes.reqops.domain.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/signup")
    @ResponseStatus(HttpStatus.CREATED)
    public UserResponse signup(@Valid @RequestBody SignupRequest request) {
        return authService.signup(request);
    }

    @PostMapping("/login")
    public UserResponse login(@Valid @RequestBody LoginRequest request) {
        return authService.login(request);
    }
}
