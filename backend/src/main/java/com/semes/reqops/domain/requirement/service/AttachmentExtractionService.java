package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.global.exception.ApiErrors;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;

@Service
public class AttachmentExtractionService {
    static final long MAX_BYTES = 10L * 1024 * 1024;
    private static final int MAX_TEXT = 200_000;

    public Extracted extract(String media, String name, byte[] bytes) throws Exception {
        if (bytes.length > MAX_BYTES) {
            throw new ApiErrors.PayloadTooLarge("첨부 파일은 10MB 이하여야 합니다.");
        }
        String lower = name == null ? "" : name.toLowerCase();
        String text;
        if (media.startsWith("text/plain") || lower.endsWith(".txt")) {
            text = new String(bytes, StandardCharsets.UTF_8);
        } else if ("application/pdf".equals(media) || lower.endsWith(".pdf")) {
            try (PDDocument document = PDDocument.load(bytes)) {
                if (document.getNumberOfPages() > 200) {
                    throw new ApiErrors.PayloadTooLarge("PDF는 200페이지 이하여야 합니다.");
                }
                text = new PDFTextStripper().getText(document);
            }
        } else if (media.contains("wordprocessingml") || lower.endsWith(".docx")) {
            ZipSecureFile.setMinInflateRatio(0.01);
            try (XWPFDocument document = new XWPFDocument(new ByteArrayInputStream(bytes))) {
                StringBuilder output = new StringBuilder();
                document.getParagraphs().forEach(paragraph -> output.append(paragraph.getText()).append('\n'));
                document.getTables().forEach(table -> table.getRows().forEach(row ->
                        row.getTableCells().forEach(cell -> output.append(cell.getText()).append('\t'))));
                text = output.toString();
            }
        } else {
            return new Extracted(null, "UNSUPPORTED");
        }
        if (text.length() > MAX_TEXT) text = text.substring(0, MAX_TEXT);
        return new Extracted(text, "EXTRACTED");
    }

    public record Extracted(String text, String state) {}
}
