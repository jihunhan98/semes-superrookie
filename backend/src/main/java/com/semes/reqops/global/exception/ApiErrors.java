package com.semes.reqops.global.exception;

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

    /** 프로젝트를 찾을 수 없음 → 404 */
    public static class ProjectNotFound extends RuntimeException {
        public ProjectNotFound(Long id) {
            super("프로젝트를 찾을 수 없습니다: " + id);
        }
    }

    /** Owner 전용 작업을 Member가 시도 → 403 */
    public static class NotProjectOwner extends RuntimeException {
        public NotProjectOwner() {
            super("프로젝트 소유자만 할 수 있는 작업입니다.");
        }
    }

    /** 이 프로젝트의 멤버가 아님 → 403 */
    public static class NotProjectMember extends RuntimeException {
        public NotProjectMember() {
            super("프로젝트 멤버가 아닙니다.");
        }
    }

    /** 접근 토큰이 유효하지 않거나 폐기됨 → 400 */
    public static class InvalidProjectToken extends RuntimeException {
        public InvalidProjectToken() {
            super("유효하지 않은 접근 토큰입니다.");
        }
    }

    /** 요구사항을 찾을 수 없음 → 404 */
    public static class RequirementNotFound extends RuntimeException {
        public RequirementNotFound(Long id) {
            super("요구사항을 찾을 수 없습니다: " + id);
        }
    }

    /** 같은 프로젝트에 같은 요구사항 ID가 이미 있음 → 409 */
    public static class DuplicateReqKey extends RuntimeException {
        public DuplicateReqKey(String reqKey) {
            super("이미 사용 중인 요구사항 ID입니다: " + reqKey);
        }
    }

    /**
     * 고객 합의 기록 없이 확정을 시도함 → 409
     *
     * <p>화면에서도 버튼이 비활성화되지만, API 단에서도 막아야 "합의 없이 확정된
     * 요구사항"이 만들어지지 않는다.
     */
    public static class ConsensusRequired extends RuntimeException {
        public ConsensusRequired() {
            super("고객 합의 기록이 있어야 확정할 수 있습니다.");
        }
    }

    /** 비교하려는 버전이 이력에 없음 → 404 */
    public static class VersionNotFound extends RuntimeException {
        public VersionNotFound(String version) {
            super("해당 버전을 찾을 수 없습니다: " + version);
        }
    }

    /** 합의일 형식이 yyyy-MM-dd가 아님 → 400 */
    public static class InvalidAgreedDate extends RuntimeException {
        public InvalidAgreedDate(String value) {
            super("합의일은 yyyy-MM-dd 형식이어야 합니다: " + value);
        }
    }

    /** 확정되지 않은 요구사항에서 산출물 도출(이슈 나누기)을 시도함 → 409 */
    public static class RequirementNotConfirmed extends RuntimeException {
        public RequirementNotConfirmed() {
            super("확정된 요구사항만 이슈로 나눌 수 있습니다.");
        }
    }

    /** 개발 이슈를 찾을 수 없음 → 404 */
    public static class DevIssueNotFound extends RuntimeException {
        public DevIssueNotFound(String issueKey) {
            super("개발 이슈를 찾을 수 없습니다: " + issueKey);
        }
    }

    /** 산출물 유형이 voc/functional/nonfunctional/detail-design 중 하나가 아님 → 404 */
    public static class ArtifactTypeNotFound extends RuntimeException {
        public ArtifactTypeNotFound(String type) {
            super("알 수 없는 산출물 유형입니다: " + type);
        }
    }
}
