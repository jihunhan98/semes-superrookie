package com.semes.backend.dto;

/** 프론트가 보내는 요구사항 원문(여러 조항이 줄바꿈으로 구분됨). */
public record AnalyzeRequest(String text) {
}
