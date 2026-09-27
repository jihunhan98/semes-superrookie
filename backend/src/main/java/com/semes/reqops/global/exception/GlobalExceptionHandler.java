package com.semes.reqops.global.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ApiErrors.DuplicateEmpNo.class)
    public ResponseEntity<Map<String, String>> handleDuplicate(ApiErrors.DuplicateEmpNo e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.InvalidLogin.class)
    public ResponseEntity<Map<String, String>> handleInvalidLogin(ApiErrors.InvalidLogin e) {
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.ProjectNotFound.class)
    public ResponseEntity<Map<String, String>> handleProjectNotFound(ApiErrors.ProjectNotFound e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({ApiErrors.NotProjectOwner.class, ApiErrors.NotProjectMember.class, ApiErrors.Forbidden.class})
    public ResponseEntity<Map<String, String>> handleForbidden(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.InvalidProjectToken.class)
    public ResponseEntity<Map<String, String>> handleInvalidToken(ApiErrors.InvalidProjectToken e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.RequirementNotFound.class)
    public ResponseEntity<Map<String, String>> handleRequirementNotFound(ApiErrors.RequirementNotFound e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.DuplicateReqKey.class)
    public ResponseEntity<Map<String, String>> handleDuplicateReqKey(ApiErrors.DuplicateReqKey e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.ConsensusRequired.class)
    public ResponseEntity<Map<String, String>> handleConsensusRequired(ApiErrors.ConsensusRequired e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.VersionNotFound.class)
    public ResponseEntity<Map<String, String>> handleVersionNotFound(ApiErrors.VersionNotFound e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.InvalidAgreedDate.class)
    public ResponseEntity<Map<String, String>> handleInvalidAgreedDate(ApiErrors.InvalidAgreedDate e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.RequirementNotConfirmed.class)
    public ResponseEntity<Map<String, String>> handleRequirementNotConfirmed(ApiErrors.RequirementNotConfirmed e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.DevIssueNotFound.class)
    public ResponseEntity<Map<String, String>> handleDevIssueNotFound(ApiErrors.DevIssueNotFound e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.ArtifactTypeNotFound.class)
    public ResponseEntity<Map<String, String>> handleArtifactTypeNotFound(ApiErrors.ArtifactTypeNotFound e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler(ApiErrors.DevelopmentIssueNotFound.class)
    public ResponseEntity<Map<String, String>> handleDevelopmentIssueNotFound(ApiErrors.DevelopmentIssueNotFound e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({ApiErrors.IssueNotFixed.class, ApiErrors.Conflict.class})
    public ResponseEntity<Map<String, String>> handleConflict(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message", e.getMessage()));
    }

    @ExceptionHandler({ApiErrors.InvalidScenarioType.class, ApiErrors.BadRequest.class, IllegalArgumentException.class})
    public ResponseEntity<Map<String, String>> handleBadRequest(RuntimeException e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(Map.of("message", e.getMessage()));
    }
    @ExceptionHandler(ApiErrors.PayloadTooLarge.class)
    public ResponseEntity<Map<String,String>> handleTooLarge(ApiErrors.PayloadTooLarge e){return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE).body(Map.of("message",e.getMessage()));}
    @ExceptionHandler(ApiErrors.UnsupportedMedia.class)
    public ResponseEntity<Map<String,String>> handleUnsupported(ApiErrors.UnsupportedMedia e){return ResponseEntity.status(HttpStatus.UNSUPPORTED_MEDIA_TYPE).body(Map.of("message",e.getMessage()));}
}
