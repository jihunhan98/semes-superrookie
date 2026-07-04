package com.semes.backend;

import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.client.RestClient;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class AnalyzeController {

    private final RestClient aiServer = RestClient.builder()
            .baseUrl("http://localhost:8001")
            .requestFactory(new SimpleClientHttpRequestFactory())
            .build();

    public record AnalyzeRequest(String sentence) {}

    public record AnalyzeResponse(boolean ambiguous, String type, String reason) {}

    @PostMapping("/analyze")
    public AnalyzeResponse analyze(@RequestBody AnalyzeRequest request) {
        return aiServer.post()
                .uri("/analyze")
                .contentType(MediaType.APPLICATION_JSON)
                .body(request)
                .retrieve()
                .body(AnalyzeResponse.class);
    }
}
