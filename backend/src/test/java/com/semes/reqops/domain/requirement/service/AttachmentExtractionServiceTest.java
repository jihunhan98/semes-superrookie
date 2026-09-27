package com.semes.reqops.domain.requirement.service;

import com.semes.reqops.global.exception.ApiErrors;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class AttachmentExtractionServiceTest {
    private final AttachmentExtractionService service = new AttachmentExtractionService();

    @Test
    void extractsUtf8Text() throws Exception {
        byte[] bytes = "한글 근거 문서\n최대 응답 시간은 3초".getBytes(StandardCharsets.UTF_8);
        var result = service.extract("text/plain", "evidence.txt", bytes);
        assertThat(result.state()).isEqualTo("EXTRACTED");
        assertThat(result.text()).contains("3초");
    }

    @Test
    void keepsUnsupportedImageWithoutInventingText() throws Exception {
        var result = service.extract("image/png", "screen.png", new byte[]{1, 2, 3});
        assertThat(result.state()).isEqualTo("UNSUPPORTED");
        assertThat(result.text()).isNull();
    }

    @Test
    void rejectsOversizedContent() {
        byte[] bytes = new byte[10 * 1024 * 1024 + 1];
        assertThatThrownBy(() -> service.extract("text/plain", "large.txt", bytes))
                .isInstanceOf(ApiErrors.PayloadTooLarge.class);
    }
}
