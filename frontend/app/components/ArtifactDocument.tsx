"use client";
import MermaidDiagram from "./MermaidDiagram";
const labels:Record<string,string>={title:"제목",summary:"요약",description:"설명",content:"내용",purpose:"목적",scope:"범위",requirements:"요구사항",acceptanceCriteria:"인수 기준",preconditions:"선행 조건",postconditions:"완료 조건",steps:"수행 절차",exceptions:"예외 처리",constraints:"제약 조건",sequenceDiagram:"시퀀스 다이어그램",classDiagram:"클래스 다이어그램",mermaid:"다이어그램",legacyExtras:"추가 내용",beforeState:"변경 전",afterState:"변경 후",symptom:"현상",improvementReq:"개선 요구",changeScope:"변경 범위",functionalRequirements:"기능 요구사항",nonFunctionalRequirements:"비기능 요구사항"};
function Value({value}:{value:unknown}){
 if(value===null||value===undefined||value==="")return <p>없음</p>;
 if(typeof value==="string")return /^(?:```mermaid\s*)?(?:sequenceDiagram|classDiagram|flowchart|graph)\b/.test(value.trim())?<MermaidDiagram code={value.replace(/^```mermaid\s*/,"" ).replace(/```\s*$/,"")}/>:<p>{value}</p>;
 if(Array.isArray(value))return <div className="saved-artifact-content">{value.map((row,index)=><section className="saved-artifact-field" key={index}><Value value={row}/></section>)}</div>;
 if(typeof value==="object")return <ArtifactDocument content={value as Record<string,unknown>}/>;
 return <p>{String(value)}</p>;
}
export default function ArtifactDocument({content}:{content:Record<string,unknown>}){return <div className="saved-artifact-content">{Object.entries(content).map(([key,value])=><section className="saved-artifact-field" key={key}><h3>{labels[key]??key}</h3><Value value={value}/></section>)}</div>;}
