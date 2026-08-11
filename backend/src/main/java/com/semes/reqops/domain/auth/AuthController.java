package com.semes.reqops.domain.auth;

import com.semes.reqops.domain.auth.AuthDto.LoginRequest;
import com.semes.reqops.domain.auth.AuthDto.SignupRequest;
import com.semes.reqops.domain.auth.AuthDto.UserResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class AuthController {

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

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
