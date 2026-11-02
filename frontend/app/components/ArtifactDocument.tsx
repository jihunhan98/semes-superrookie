"use client";
import {useState} from "react";
import ArtifactRichText from "./ArtifactRichText";
import MermaidDiagram from "./MermaidDiagram";
import ReviewIcon from "./ReviewIcon";
import {designDiagrams,scenariosFor} from "../lib/artifacts/document.mjs";
import styles from "./ArtifactDocument.module.css";
const labels:Record<string,string>={title:'제목',summary:'요약',description:'설계 개요',content:'내용',overview:'요구사항 개요',requester:'요청자',requestContent:'고객 요청 내용',specialNotes:'특이 사항',request:'고객 요청 내용',notes:'참고 사항',role:'수행 역할',purpose:'목적',scope:'적용 범위',requirements:'요구사항',acceptanceCriteria:'인수 기준',preconditions:'선행 조건',postconditions:'완료 조건',steps:'수행 절차',exceptions:'예외 처리',constraints:'제약 조건',constraintsNote:'제약 조건',beforeState:'변경 전',afterState:'변경 후',symptom:'현상',improvementReq:'개선 요구',changeScope:'변경 범위',functionalRequirements:'기능 요구사항',nonFunctionalRequirements:'비기능 요구사항',name:'이름',definition:'정의',type:'유형',item:'항목',value:'값',reason:'근거',quote:'원문',reqKey:'요구사항',field:'항목'};
const internal=new Set(['classDiagram','sequenceDiagramAsIs','sequenceDiagramToBe','sequenceBeforeCode','sequenceAfterCode','scenarios','behaviors','asIsApplicability','asIsReason','legacyExtras','schemaVersion','quality','evidence','engine','elapsedMs']);
function Value({value}:{value:unknown}){
 if(value===null||value===undefined||value==='')return <span className={styles.emptyValue}>작성된 내용이 없습니다.</span>;
 if(typeof value==='string')return <ArtifactRichText text={value}/>;
 if(Array.isArray(value))return value.length?<ol className={styles.valueList}>{value.map((row,i)=><li key={i}><Value value={row}/></li>)}</ol>:<span className={styles.emptyValue}>등록된 항목이 없습니다.</span>;
 if(typeof value==='object')return <dl className={styles.values}>{Object.entries(value).filter(([key])=>!internal.has(key)).map(([key,v])=><div key={key}><dt>{labels[key]??key}</dt><dd><Value value={v}/></dd></div>)}</dl>;
 return <span>{String(value)}</span>;
}
export default function ArtifactDocument({content}:{content:Record<string,unknown>}){
 const [flow,setFlow]=useState<'before'|'after'>('after');
 const scenarios=scenariosFor(content) as {label:string;reason?:string;applicability?:string;[key:string]:unknown}[],diagrams=designDiagrams(content);
 const hasDesign=['classDiagram','sequenceDiagramAsIs','sequenceDiagramToBe','sequenceBeforeCode','sequenceAfterCode'].some(key=>key in content);
 const extras=content.legacyExtras&&typeof content.legacyExtras==='object'?Object.fromEntries(Object.entries(content.legacyExtras).filter(([key,value])=>!internal.has(key)&&value!==null&&value!=='')):{};
 return <div className={styles.document}>
 {Object.entries(content).filter(([key])=>!internal.has(key)).map(([key,value])=><section className={styles.section} key={key}><header><span className={styles.sectionMark}/><h3>{labels[key]??key}</h3></header><Value value={value}/></section>)}
 {scenarios.length>0&&<section className={styles.section}><header><ReviewIcon name="file" size={16}/><h3>동작 시나리오</h3><span>{scenarios.length}개</span></header><div className={styles.scenarios}>{scenarios.map((scenario,i)=><article className={styles.scenario} key={i}><div className={styles.scenarioHead}><span className={styles.scenarioNumber}>{String(i+1).padStart(2,'0')}</span><h4>{scenario.label}</h4>{scenario.applicability==='NOT_APPLICABLE'&&<small>해당 없음</small>}</div><dl>{[['precondition','선행 조건'],['scenario','수행 흐름'],['postcondition','완료 조건']].map(([field,label])=><div key={field}><dt>{label}</dt><dd><Value value={scenario[field]}/></dd></div>)}</dl>{scenario.reason&&<p className={styles.note}>{scenario.reason}</p>}</article>)}</div></section>}
 {hasDesign&&<>
 <section className={styles.section}><header><ReviewIcon name="diagram" size={17}/><h3>클래스 다이어그램</h3><span>구성 요소와 관계</span></header><div className={styles.diagramCard}>{diagrams.classes?<MermaidDiagram code={diagrams.classes} label="시스템 구조" copyable/>:<div className={styles.diagramEmpty}><ReviewIcon name="diagram" size={27}/><p>등록된 클래스 다이어그램이 없습니다.</p></div>}</div></section>
 <section className={styles.section}><header><ReviewIcon name="diagram" size={17}/><h3>시퀀스 다이어그램</h3><span>변경 전·후 처리 흐름</span></header><div className={styles.flowTabs} role="group" aria-label="시퀀스 비교"><button type="button" aria-pressed={flow==='before'} onClick={()=>setFlow('before')}>변경 전 <small>AS-IS</small></button><button type="button" aria-pressed={flow==='after'} onClick={()=>setFlow('after')}>변경 후 <small>TO-BE</small></button></div>
 {flow==='before'&&typeof content.asIsReason==='string'&&<div className={styles.contextNote}><ReviewIcon name="info" size={15}/>{content.asIsReason}</div>}
 <div className={styles.diagramCard}>{diagrams[flow]?<MermaidDiagram key={flow} code={diagrams[flow]} label={flow==='before'?'변경 전 처리 흐름':'변경 후 처리 흐름'} copyable/>:<div className={styles.diagramEmpty}><ReviewIcon name="diagram" size={27}/><p>등록된 {flow==='before'?'변경 전':'변경 후'} 시퀀스 다이어그램이 없습니다.</p></div>}</div></section>
 </>}
 {Object.keys(extras).length>0&&<details className={styles.extra}><summary>추가 참고 내용</summary><Value value={extras}/></details>}
 {Array.isArray(content.evidence)&&content.evidence.length>0&&<details className={styles.extra}><summary>요구사항 근거 {content.evidence.length}건</summary><Value value={content.evidence}/></details>}
 </div>;
}
