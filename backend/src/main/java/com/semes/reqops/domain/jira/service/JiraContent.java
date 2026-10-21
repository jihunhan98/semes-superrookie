package com.semes.reqops.domain.jira.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.semes.reqops.domain.issue.entity.DevIssue;
import com.semes.reqops.domain.requirement.entity.Requirement;
import java.util.Map;

/** Keep all AI artifact fields; Jira receives text, never an abbreviated preview. */
public final class JiraContent {
    private JiraContent(){}
    private static final Map<String,String> LABELS=Map.ofEntries(
        Map.entry("requester","요청자"),Map.entry("requestContent","요청사항"),Map.entry("specialNotes","특이사항"),
        Map.entry("overview","개요"),Map.entry("constraintsNote","제약사항"),Map.entry("scenarios","시나리오"),
        Map.entry("type","유형"),Map.entry("precondition","선행조건"),Map.entry("scenario","시나리오"),Map.entry("postcondition","후행조건"),
        Map.entry("description","설명"),Map.entry("classDiagram","Class Diagram (Mermaid 원문)"),
        Map.entry("sequenceDiagramAsIs","변경 전 Sequence Diagram (Mermaid 원문)"),Map.entry("sequenceDiagramToBe","변경 후 Sequence Diagram (Mermaid 원문)"));
    public static String issue(DevIssue i,Requirement r){
        return "h2. 개발 이슈\n"+field("현상 기록",i.getSymptom())+field("개선 요청사항",i.getImprovementReq())+
            field("변경 범위",i.getChangeScope())+field("제약 사항",i.getConstraintsNote())+
            field("변경 전",i.getBeforeState())+field("변경 후",i.getAfterState())+
            field("기한",i.getDueOn()==null?null:i.getDueOn().toString())+
            "h2. 원 요구사항 "+r.getReqKey()+"\n"+r.getContent()+"\n\n";
    }
    private static String field(String label,String value){return "*"+label+"*\n"+(value==null||value.isBlank()?"없음":value)+"\n\n";}
    public static String artifact(String title,JsonNode node){return "h2. "+title+"\n"+render(node)+"\n\n";}
    private static String render(JsonNode node){
        if(node==null||node.isNull())return "없음";
        if(node.isValueNode())return node.asText();
        StringBuilder out=new StringBuilder();
        if(node.isArray()){int index=0;for(JsonNode row:node)out.append("\n").append(++index).append(". ").append(render(row)).append("\n");}
        else node.fields().forEachRemaining(entry->out.append("*").append(LABELS.getOrDefault(entry.getKey(),entry.getKey())).append("*\n").append(render(entry.getValue())).append("\n\n"));
        return out.toString();
    }
}
