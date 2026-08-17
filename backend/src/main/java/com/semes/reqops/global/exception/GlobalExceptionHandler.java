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

    @ExceptionHandler({ApiErrors.NotProjectOwner.class, ApiErrors.NotProjectMember.class})
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
}
