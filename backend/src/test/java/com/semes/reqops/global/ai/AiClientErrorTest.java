package com.semes.reqops.global.ai;

import com.semes.reqops.global.exception.ApiErrors;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class AiClientErrorTest {
    private String requestFailure(int status, String body) throws Exception {
        HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/clarify-answer", exchange -> {
            exchange.getRequestBody().readAllBytes();
            byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
            exchange.sendResponseHeaders(status, bytes.length);
            try (var output = exchange.getResponseBody()) { output.write(bytes); }
        });
        server.start();
        try {
            var client = new AiClient("http://127.0.0.1:" + server.getAddress().getPort(), 1000);
            return assertThrows(ApiErrors.Conflict.class, () -> client.insight("/clarify-answer", Map.of("answer", "답변"))).getMessage();
        } finally { server.stop(0); }
    }

    @Test void schemaFailureNamesTheFieldRatherThanDumpingJson() throws Exception {
        String result = requestFailure(422, "{\"detail\":[{\"loc\":[\"body\",\"targetSpan\"],\"msg\":\"Field required\",\"input\":\"PRIVATE\"}]}");
        assertTrue(result.contains("targetSpan"));
        assertTrue(result.contains("같은 버전"));
        assertFalse(result.contains("PRIVATE"));
        assertFalse(result.contains("{\""));
    }
    @Test void modelFailureKeepsAnActionableMessageAndCode() throws Exception {
        String result = requestFailure(503, "{\"detail\":{\"code\":\"PROVIDER_TIMEOUT\",\"message\":\"AI 응답을 기다리다 중단했습니다. 다시 시도해주세요.\"}}");
        assertTrue(result.contains("다시 시도"));
        assertTrue(result.contains("PROVIDER_TIMEOUT"));
    }
    @Test void gatewayHtmlDoesNotLeakIntoProductUi() throws Exception {
        String result = requestFailure(502, "<html>PRIVATE_GATEWAY_DETAILS</html>");
        assertTrue(result.contains("HTTP 502"));
        assertFalse(result.contains("PRIVATE_GATEWAY"));
    }
}
