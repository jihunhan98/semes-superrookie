package com.semes.reqops.domain.jira;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.semes.reqops.domain.jira.service.*;
import com.semes.reqops.global.exception.ApiErrors;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.Test;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.jupiter.api.Assertions.*;

class JiraClientTest {
    @Test void sendsFullUnicodeContentOnlyToConfiguredServer() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);
        AtomicReference<String> body=new AtomicReference<>(),auth=new AtomicReference<>();
        AtomicInteger calls=new AtomicInteger();
        server.createContext("/jira/rest/api/2/issue",exchange->{
            calls.incrementAndGet();body.set(new String(exchange.getRequestBody().readAllBytes(),StandardCharsets.UTF_8));auth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] response="{\"key\":\"AMR-123\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type","application/json");exchange.sendResponseHeaders(201,response.length);exchange.getResponseBody().write(response);exchange.close();
        });
        server.start();
        try {
            String base="http://127.0.0.1:"+server.getAddress().getPort()+"/jira";
            ObjectMapper mapper=new ObjectMapper();JiraClient client=new JiraClient(base,"unit-test-only",mapper);
            String description="한글 AI 산출물\nSOC 50% → 30%\n".repeat(1500);
            assertEquals("AMR-123",client.create(base,Map.of("summary","충전 기준 변경","description",description)));
            assertEquals(description,mapper.readTree(body.get()).path("fields").path("description").asText());
            assertEquals("Bearer unit-test-only",auth.get());
            assertThrows(ApiErrors.Conflict.class,()->client.create("http://other.example.test",Map.of()));
            assertEquals(1,calls.get());
        } finally {server.stop(0);}
    }
    @Test void missingAuthenticationFailsBeforeNetworkRequest(){
        assertThrows(ApiErrors.Conflict.class,()->new JiraClient("","",new ObjectMapper()).create("http://jira.example.test",Map.of()));
    }
    @Test void redirectIsNotFollowedAndDoesNotExposeToken() throws Exception {
        HttpServer server=HttpServer.create(new InetSocketAddress("127.0.0.1",0),0);AtomicInteger destinationCalls=new AtomicInteger();
        server.createContext("/rest/api/2/issue",exchange->{exchange.getResponseHeaders().add("Location","/redirected");exchange.sendResponseHeaders(302,-1);exchange.close();});
        server.createContext("/redirected",exchange->{destinationCalls.incrementAndGet();exchange.sendResponseHeaders(201,-1);exchange.close();});server.start();
        try {String base="http://127.0.0.1:"+server.getAddress().getPort();assertThrows(ApiErrors.Conflict.class,()->new JiraClient(base,"unit-test-only",new ObjectMapper()).create(base,Map.of()));assertEquals(0,destinationCalls.get());}
        finally {server.stop(0);}
    }
    @Test void normalizesPortAndContextWithoutAcceptingCredentialsOrOtherSchemes(){
        assertEquals("http://jira.example.test:18080/jira",JiraAddress.normalize("HTTP://JIRA.EXAMPLE.TEST:18080/jira/"));
        for(String invalid:new String[]{"javascript:alert(1)","http://user:password@jira.example.test","http://jira.example.test?token=x","http://jira.example.test#fragment","jira.example.test:18080","http://jira.example.test:99999"})assertThrows(IllegalArgumentException.class,()->JiraAddress.normalize(invalid));
    }
}
