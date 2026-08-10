package com.semes.reqops.common;

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
}
