"use client";
import {useState,type ReactNode} from "react";
import ArtifactRichText from "./ArtifactRichText";
import MermaidDiagram from "./MermaidDiagram";
import {BUSINESS_LABELS,designDiagrams,documentScenarios,documentSections,documentValue,hasDocumentValue,supplementalFields} from "../lib/artifacts/document.mjs";
import styles from "./ArtifactDocument.module.css";

type DocumentType='issue'|'voc'|'functional'|'nonfunctional'|'detail-design';
type Scenario={type:string;label:string;precondition?:unknown;scenario?:unknown;postcondition?:unknown;applicability?:string;reason?:string|null};
const names:Record<string,string>=BUSINESS_LABELS;

function Value({value,empty='작성된 내용이 없습니다.'}:{value:unknown;empty?:string}){
 if(!hasDocumentValue(value))return <span className={styles.emptyValue}>{empty}</span>;
 if(typeof value==='string')return <ArtifactRichText text={value}/>;
 if(Array.isArray(value))return <ol className={styles.valueList}>{value.map((row,i)=><li key={i}><Value value={row}/></li>)}</ol>;
 if(typeof value==='object'&&value!==null){
  const entries=Object.entries(value).filter(([key])=>key in names);
  return entries.length?<dl className={styles.values}>{entries.map(([key,item])=><div key={key}><dt>{names[key]}</dt><dd><Value value={item}/></dd></div>)}</dl>:<span className={styles.emptyValue}>표시할 업무 내용이 없습니다.</span>;
 }
 return <span>{String(value)}</span>;
}

function Section({title,children}:{title:string;children:ReactNode}){
 return <section className={styles.section}><h3>{title}</h3>{children}</section>;
}

export default function ArtifactDocument({content,type='issue'}:{content:Record<string,unknown>;type?:DocumentType}){
 const [flow,setFlow]=useState<'before'|'after'>('after');
 const sections=documentSections(type,content) as {key:string;label:string;value:unknown}[];
 const scenarios=documentScenarios(content) as Scenario[];
 const diagrams=designDiagrams(content);
 const extras=supplementalFields(type,content) as {key:string;label:string;value:unknown}[];
 const applicability=documentValue(content,'asIsApplicability');
 const asIsReason=documentValue(content,'asIsReason');
 const evidence=Array.isArray(content.evidence)?content.evidence.filter((item):item is Record<string,unknown>=>Boolean(item)&&typeof item==='object'):[];
 return <div className={styles.document} data-document-type={type}>
  {sections.filter(item=>type!=='issue'||!['beforeState','afterState'].includes(item.key)).map(item=><Section key={item.key} title={item.label}><Value value={item.value}/></Section>)}
  {type==='issue'&&<Section title="변경 전·후"><div className={styles.comparison}>
   {sections.filter(item=>['beforeState','afterState'].includes(item.key)).map(item=><section key={item.key}><h4>{item.label}</h4><Value value={item.value} empty={item.key==='beforeState'?'없음':'작성된 내용이 없습니다.'}/></section>)}
  </div></Section>}
  {(type==='functional'||type==='nonfunctional')&&<Section title="동작 정의">
   <p className={styles.sectionHint}>기본·변형·예외 동작의 선행조건, 시나리오, 후행조건을 확인합니다.</p>
   <div className={styles.scenarios}>{scenarios.map(scenario=>{
    const notApplicable=scenario.applicability==='NOT_APPLICABLE';
    const unknown=!scenario.applicability||scenario.applicability==='UNKNOWN';
    return <article key={scenario.type} className={styles.scenario}>
     <header className={styles.scenarioHead}><h4>{scenario.label}</h4><span className={`aui-lozenge aui-lozenge-subtle ${unknown?'aui-lozenge-moved':notApplicable?'':'aui-lozenge-success'}`}>{notApplicable?'해당 없음':unknown?'확인 필요':'적용'}</span></header>
     <table className={`aui ${styles.formTable}`}><tbody>{[['precondition','선행조건'],['scenario','시나리오'],['postcondition','후행조건']].map(([field,label])=><tr key={field}><th scope="row">{label}</th><td><Value value={scenario[field as keyof Scenario]} empty={notApplicable?'해당 없음':'작성된 내용이 없습니다.'}/></td></tr>)}</tbody></table>
     {scenario.reason&&<p className={styles.note}><strong>{notApplicable?'해당 없음 사유':'검토 사항'}</strong>{scenario.reason}</p>}
    </article>;
   })}</div>
  </Section>}
  {type==='detail-design'&&<>
   <Section title="클래스 다이어그램"><div className={styles.diagramCard}>{diagrams.classes?<MermaidDiagram code={diagrams.classes} label="클래스 구조" copyable/>:<div className={styles.diagramEmpty}>등록된 클래스 다이어그램이 없습니다.</div>}</div></Section>
   <Section title="시퀀스 다이어그램">
    <div className={styles.flowTabs} role="group" aria-label="변경 전후 시퀀스 선택">{(['before','after'] as const).map(value=><button type="button" className="aui-button" key={value} aria-pressed={flow===value} onClick={()=>setFlow(value)}>{value==='before'?'변경 전 (AS-IS)':'변경 후 (TO-BE)'}</button>)}</div>
    {flow==='before'&&(asIsReason||applicability==='UNKNOWN'||applicability==='NOT_APPLICABLE')&&<div className="aui-message aui-message-info"><p>{typeof asIsReason==='string'?asIsReason:applicability==='NOT_APPLICABLE'?'변경 전 시퀀스는 해당 없음으로 분류되었습니다.':'변경 전 처리 흐름의 근거를 확인해주세요.'}</p></div>}
    <div className={styles.diagramCard}>{diagrams[flow]?<MermaidDiagram key={flow} code={diagrams[flow]} label={flow==='before'?'변경 전 처리 흐름':'변경 후 처리 흐름'} copyable/>:<div className={styles.diagramEmpty}>등록된 {flow==='before'?'변경 전':'변경 후'} 시퀀스 다이어그램이 없습니다.</div>}</div>
   </Section>
  </>}
  {extras.length>0&&<details className={styles.extra}><summary>추가 업무 내용</summary><div>{extras.map(item=><Section key={item.key} title={item.label}><Value value={item.value}/></Section>)}</div></details>}
  {evidence.length>0&&<details className={styles.extra}><summary>요구사항 근거 {evidence.length}건</summary><div>{evidence.map((row,index)=><blockquote className={styles.evidence} key={index}>{typeof row.reqKey==='string'&&<strong>{row.reqKey}</strong>}<Value value={row.quote}/></blockquote>)}</div></details>}
 </div>;
}
