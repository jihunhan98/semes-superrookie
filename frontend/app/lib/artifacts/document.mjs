/** Read both saved artifact schemas without exposing transport metadata as fields. */
export const ARTIFACT_TYPES=[
 {type:'voc',label:'SWVOC',short:'VOC',description:'고객 요청과 전달 사항'},
 {type:'functional',label:'기능 요구사항',short:'FR',description:'정상·대안·예외 시나리오'},
 {type:'nonfunctional',label:'비기능 요구사항',short:'NFR',description:'품질 기준과 제약 조건'},
 {type:'detail-design',label:'상세 설계',short:'DD',description:'구조와 변경 전·후 처리 흐름'},
];
export function cleanDiagram(value){return typeof value==='string'?value.trim().replace(/^```(?:mermaid)?\s*\n?/i,'').replace(/\n?```\s*$/,'').trim():'';}
export function classDiagramSource(value){
 if(typeof value==='string')return cleanDiagram(value);
 if(!Array.isArray(value))return '';
 const rows=value.filter(row=>row&&typeof row==='object'&&typeof row.name==='string');
 if(!rows.length)return '';
 const safe=v=>String(v).replace(/[\r\n{};]/g,' ').replace(/"/g,"'");
 return 'classDiagram\n'+rows.map((row,i)=>`    class Class_${i}["${safe(row.name)}"] {\n${(Array.isArray(row.fields)?row.fields:[]).map(field=>'      '+safe(field)).join('\n')}\n    }`).join('\n');
}
const scenarioLabels={BASIC:'기본 시나리오',VARIANT:'대안 시나리오',EXCEPTION:'예외 시나리오','기본':'기본 시나리오','대안':'대안 시나리오','예외':'예외 시나리오'};
export function scenariosFor(content){
 if(Array.isArray(content.scenarios))return content.scenarios.filter(row=>row&&typeof row==='object').map((row,i)=>({...row,label:scenarioLabels[row.type]??`시나리오 ${i+1}`}));
 const groups=new Map();
 for(const row of Array.isArray(content.behaviors)?content.behaviors:[]){
  if(!row||typeof row!=='object')continue;
  const type=row.type??'기본',group=groups.get(type)??{type,label:scenarioLabels[type]??String(type)};
  const field={'선행조건':'precondition','시나리오':'scenario','후행조건':'postcondition'}[row.item];
  if(field)group[field]=[group[field],row.content].filter(Boolean).join('\n');
  else group.scenario=[group.scenario,row.content].filter(Boolean).join('\n');
  groups.set(type,group);
 }
 return [...groups.values()];
}
export function designDiagrams(content){return {
 classes:classDiagramSource(content.classDiagram),
 before:cleanDiagram(content.sequenceDiagramAsIs??content.sequenceBeforeCode),
 after:cleanDiagram(content.sequenceDiagramToBe??content.sequenceAfterCode),
};}
