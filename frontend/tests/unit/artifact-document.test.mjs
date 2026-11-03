import test from 'node:test';
import assert from 'node:assert/strict';
import {classDiagramSource,cleanDiagram,designDiagrams,scenariosFor} from '../../app/lib/artifacts/document.mjs';
test('canonical and legacy sequence fields render the same diagrams',()=>{
 const code='sequenceDiagram\n A->>B: 요청';
 assert.equal(designDiagrams({sequenceDiagramToBe:code}).after,code);
 assert.equal(designDiagrams({sequenceAfterCode:'```mermaid\n'+code+'\n```'}).after,code);
 assert.equal(cleanDiagram('```mermaid\nclassDiagram\n class A\n```'),'classDiagram\n class A');
});
test('saved diagrams with escaped line breaks render as Mermaid lines',()=>{
 const classSource=String.raw`classDiagram\n class AMRController\n AMRController : +move()`;
 const sequenceSource=String.raw`sequenceDiagram\r\n AMRController->>Motor: move()`;
 assert.equal(designDiagrams({classDiagram:classSource}).classes,'classDiagram\n class AMRController\n AMRController : +move()');
 assert.equal(designDiagrams({sequenceDiagramToBe:sequenceSource}).after,'sequenceDiagram\n AMRController->>Motor: move()');
 assert.equal(cleanDiagram('```mermaid'+String.raw`\nsequenceDiagram\n A->>B: Go\n`+'```'),'sequenceDiagram\n A->>B: Go');
 assert.equal(cleanDiagram('sequenceDiagram\n A->>B: literal \\n label'),'sequenceDiagram\n A->>B: literal \\n label');
});
test('legacy class arrays retain names and fields as a class diagram',()=>{
 const code=classDiagramSource([{name:'MatchingService',fields:['+ match(req): Result'],changed:true}]);
 assert.match(code,/classDiagram/);assert.match(code,/MatchingService/);assert.match(code,/match\(req\): Result/);
 assert.equal(classDiagramSource(null),'');
});
test('legacy behaviors are grouped without discarding scenario content',()=>{
 const rows=scenariosFor({behaviors:[{type:'기본',item:'선행조건',content:'IDLE'},{type:'기본',item:'시나리오',content:'후보 조회'},{type:'기본',item:'시나리오',content:'우선순위 정렬'},{type:'예외',item:'후행조건',content:'대기 상태'}]});
 assert.equal(rows.length,2);assert.equal(rows[0].precondition,'IDLE');assert.equal(rows[0].scenario,'후보 조회\n우선순위 정렬');assert.equal(rows[1].postcondition,'대기 상태');
});
test('canonical non-applicable and unknown scenarios retain their reasons',()=>{
 const rows=scenariosFor({scenarios:[{type:'EXCEPTION',applicability:'NOT_APPLICABLE',reason:'이 요구사항에서 제외'}]});
 assert.equal(rows[0].label,'예외 시나리오');assert.equal(rows[0].reason,'이 요구사항에서 제외');assert.equal(rows[0].applicability,'NOT_APPLICABLE');
});

test('saved form fields stay ordered, empty fields remain visible and metadata is excluded',async()=>{
 const {documentSections,supplementalFields}=await import('../../app/lib/artifacts/document.mjs');
 const content={engine:'internal',specialNotes:'참고',legacyExtras:{quality:{status:'OK'},request:'기존 고객 요청'},requestContent:null,requester:null};
 const fields=documentSections('voc',content);
 assert.deepEqual(fields.map(field=>field.key),['requester','requestContent','specialNotes']);
 assert.equal(fields[0].value,null);assert.equal(fields[1].value,'기존 고객 요청');
 assert.equal(supplementalFields('voc',content).length,0);
});
test('v2 empty shells retain legacy scenario and diagram content',async()=>{
 const {documentScenarios}=await import('../../app/lib/artifacts/document.mjs');
 const content={scenarios:[{type:'BASIC',precondition:null,scenario:null,postcondition:null,applicability:'UNKNOWN'}],classDiagram:null,sequenceDiagramToBe:null,legacyExtras:{behaviors:[{type:'기본',item:'시나리오',content:'기존 후보 조회'}],classDiagram:[{name:'MatchingService',fields:['+ match()']}],sequenceAfterCode:'sequenceDiagram\n A->>B: 기존 요청'}};
 assert.equal(documentScenarios(content)[0].scenario,'기존 후보 조회');
 assert.equal(documentScenarios(content).length,3);
 assert.match(designDiagrams(content).classes,/MatchingService/);
 assert.match(designDiagrams(content).after,/기존 요청/);
});
test('explicitly excluded scenarios do not inherit legacy behavior',async()=>{
 const {documentScenarios}=await import('../../app/lib/artifacts/document.mjs');
 const rows=documentScenarios({scenarios:[{type:'EXCEPTION',scenario:null,applicability:'NOT_APPLICABLE',reason:'합의로 제외'}],legacyExtras:{behaviors:[{type:'예외',item:'시나리오',content:'옛 오류 처리'}]}});
 assert.equal(rows[2].scenario,null);assert.equal(rows[2].reason,'합의로 제외');
});
test('legacy business notes remain available without leaking unrecognized transport keys',async()=>{
 const {supplementalFields}=await import('../../app/lib/artifacts/document.mjs');
 const fields=supplementalFields('functional',{overview:'새 개요',legacyExtras:{description:'옛 개요',role:'대상 역할',purpose:'처리 목적',quality:{status:'OK'},engine:'rule',elapsedMs:123,randomTransportKey:'internal'}});
 assert.deepEqual(fields.map(field=>field.key),['role','purpose']);
});
