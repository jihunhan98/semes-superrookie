package com.semes.reqops.domain.jira.service;

import com.fasterxml.jackson.databind.*;
import com.semes.reqops.global.exception.ApiErrors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.net.URI;
import java.net.http.*;
import java.time.Duration;
import java.util.*;

@Component
public class JiraClient {
    private final String configuredBase,token;
    private final ObjectMapper mapper;
    private final HttpClient client=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5))
        .followRedirects(HttpClient.Redirect.NEVER).build();
    public JiraClient(@Value("${JIRA_BASE_URL:}")String base,@Value("${JIRA_API_TOKEN:}")String token,ObjectMapper mapper){
        this.configuredBase=base.isBlank()?"":JiraAddress.normalize(base);this.token=token;this.mapper=mapper;
    }
    public JsonNode readIssue(String base,String key){
        if(configuredBase.isBlank()||token.isBlank())throw new ApiErrors.Conflict("Jira 인증 연결이 설정되지 않았습니다.");
        if(!JiraAddress.normalize(base).equals(configuredBase))throw new ApiErrors.Conflict("Jira 인증 연결 주소와 다릅니다.");
        if(!key.matches("[A-Za-z][A-Za-z0-9_]*-[0-9]+"))throw new ApiErrors.BadRequest("Jira 이슈 키가 올바르지 않습니다.");
        try{
            var request=HttpRequest.newBuilder(URI.create(base+"/rest/api/2/issue/"+key+"?fields=summary,status,issuelinks"))
                .timeout(Duration.ofSeconds(15)).header("Authorization","Bearer "+token).header("Accept","application/json").GET().build();
            var response=client.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()!=200)throw new ApiErrors.Conflict("Jira 연결 이슈를 조회하지 못했습니다. (HTTP "+response.statusCode()+")");
            return mapper.readTree(response.body());
        }catch(ApiErrors.Conflict e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiErrors.Conflict("Jira 조회가 중단되었습니다.");}
        catch(Exception e){throw new ApiErrors.Conflict("Jira 연결 이슈를 조회하지 못했습니다. 연결 상태를 확인해주세요.");}
    }
    public String create(String base,Map<String,Object> fields){
        // Only the configured Jira origin can receive the server-side credential.
        if(configuredBase.isBlank()||token.isBlank())throw new ApiErrors.Conflict("Jira 인증 연결이 아직 설정되지 않았습니다. 프로젝트 등록은 저장되어 있습니다. 관리자에게 Jira 연결 설정을 요청해주세요.");
        if(!JiraAddress.normalize(base).equals(configuredBase))throw new ApiErrors.Conflict("등록한 Jira 주소가 서버의 인증 연결 주소와 다릅니다. Jira 주소를 확인해주세요.");
        try{
            HttpRequest request=HttpRequest.newBuilder(URI.create(base+"/rest/api/2/issue"))
                .timeout(Duration.ofSeconds(30)).header("Authorization","Bearer "+token)
                .header("Content-Type","application/json").header("Accept","application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(Map.of("fields",fields)))).build();
            HttpResponse<String> response=client.send(request,HttpResponse.BodyHandlers.ofString());
            if(response.statusCode()==401||response.statusCode()==403)throw new ApiErrors.Conflict("Jira 인증 또는 이슈 생성 권한을 확인해주세요.");
            if(response.statusCode()!=201)throw new ApiErrors.Conflict("Jira가 이슈 생성을 완료하지 못했습니다. 프로젝트 키, 이슈 유형 ID와 Jira 필수 항목을 확인해주세요. (HTTP "+response.statusCode()+")");
            String key=mapper.readTree(response.body()).path("key").asText();
            if(!key.matches("[A-Za-z][A-Za-z0-9_]*-[0-9]+"))throw new ApiErrors.Conflict("Jira 응답에서 이슈 번호를 확인하지 못했습니다. 중복 생성하지 않도록 Jira에서 먼저 확인해주세요.");
            return key;
        }catch(ApiErrors.Conflict e){throw e;}
        catch(InterruptedException e){Thread.currentThread().interrupt();throw new ApiErrors.Conflict("Jira 요청이 중단되었습니다. 재시도 전에 Jira에서 생성 여부를 확인해주세요.");}
        catch(Exception e){throw new ApiErrors.Conflict("Jira 응답을 확인하지 못했습니다. 사내망 연결을 확인하고, 중복 생성하지 않도록 Jira에서 생성 여부를 먼저 확인해주세요.");}
    }
}
