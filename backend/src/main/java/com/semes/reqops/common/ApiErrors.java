package com.semes.reqops.common;

/** 도메인 예외 모음. 핸들러(GlobalExceptionHandler)가 HTTP 상태로 변환한다. */
public final class ApiErrors {

    private ApiErrors() {
    }

    /** 사번 중복 → 409 */
    public static class DuplicateEmpNo extends RuntimeException {
        public DuplicateEmpNo(String empNo) {
            super("이미 사용 중인 사번입니다: " + empNo);
        }
    }

    /** 로그인 실패(사번/비밀번호 불일치) → 401 */
    public static class InvalidLogin extends RuntimeException {
        public InvalidLogin() {
            super("사번 또는 비밀번호가 올바르지 않습니다.");
        }
    }
}
