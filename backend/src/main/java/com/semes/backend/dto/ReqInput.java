package com.semes.backend.dto;

/**
 * 프론트가 보내는 요구사항 한 건 (docx 표의 한 행).
 *
 * @param id       문서의 요구사항 ID (예: req-tf-01)
 * @param category 분류 (맥락)
 * @param content  내용
 * @param remark   비고
 */
public record ReqInput(String id, String category, String content, String remark) {
}
