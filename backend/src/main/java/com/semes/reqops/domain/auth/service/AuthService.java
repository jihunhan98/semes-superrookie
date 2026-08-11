package com.semes.reqops.domain.auth.service;

import com.semes.reqops.domain.auth.dto.AuthDto.LoginRequest;
import com.semes.reqops.domain.auth.dto.AuthDto.SignupRequest;
import com.semes.reqops.domain.auth.dto.AuthDto.UserResponse;
import com.semes.reqops.global.exception.ApiErrors;
import com.semes.reqops.domain.user.entity.User;
import com.semes.reqops.domain.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;

    /** 회원가입 — 사번 중복 검사 후 비밀번호를 평문 문자열로 저장. */
    @Transactional
    public UserResponse signup(SignupRequest req) {
        if (userRepository.existsByEmpNo(req.empNo())) {
            throw new ApiErrors.DuplicateEmpNo(req.empNo());
        }
        User user = new User(
                req.empNo(),
                req.name(),
                req.dept(),
                req.password()
        );
        userRepository.save(user);
        return toResponse(user);
    }

    /** 로그인 — 사번으로 조회 후 비밀번호 문자열을 그대로 대조한다(세션/토큰 없음). */
    @Transactional(readOnly = true)
    public UserResponse login(LoginRequest req) {
        User user = userRepository.findByEmpNo(req.empNo())
                .orElseThrow(ApiErrors.InvalidLogin::new);
        if (!user.getPassword().equals(req.password())) {
            throw new ApiErrors.InvalidLogin();
        }
        return toResponse(user);
    }

    private UserResponse toResponse(User u) {
        return new UserResponse(u.getId(), u.getEmpNo(), u.getName(), u.getDept());
    }
}
