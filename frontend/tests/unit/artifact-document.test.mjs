import test from 'node:test';
import assert from 'node:assert/strict';
import {classDiagramSource,cleanDiagram,designDiagrams,scenariosFor} from '../../app/lib/artifacts/document.mjs';
test('canonical and legacy sequence fields render the same diagrams',()=>{
 const code='sequenceDiagram\n A->>B: 요청';
 assert.equal(designDiagrams({sequenceDiagramToBe:code}).after,code);
 assert.equal(designDiagrams({sequenceAfterCode:'```mermaid\n'+code+'\n```'}).after,code);
 assert.equal(cleanDiagram('```mermaid\nclassDiagram\n class A\n```'),'classDiagram\n class A');
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
