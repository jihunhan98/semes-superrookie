package com.semes.reqops.domain.jira.service;
import java.net.URI;
import java.util.Locale;
public final class JiraAddress {
    private JiraAddress(){}
    public static String normalize(String input){
        try{
            URI uri=URI.create(input.trim());
            String scheme=uri.getScheme()==null?"":uri.getScheme().toLowerCase(Locale.ROOT);
            if(!scheme.equals("http")&&!scheme.equals("https") || uri.getHost()==null || uri.getUserInfo()!=null
                || uri.getQuery()!=null || uri.getFragment()!=null || uri.getPort()>65535 || uri.getPort()==0)
                throw new IllegalArgumentException();
            String path=uri.getPath()==null?"":uri.getPath().replaceAll("/+$","");
            if(path.contains("..") || path.contains("\\"))throw new IllegalArgumentException();
            return new URI(scheme,null,uri.getHost().toLowerCase(Locale.ROOT),uri.getPort(),path,null,null).toString();
        }catch(Exception e){throw new IllegalArgumentException("Jira 주소를 http:// 또는 https://부터 입력해주세요. 프로젝트 경로 없이 Jira 기본 주소를 입력해주세요.");}
    }
}
