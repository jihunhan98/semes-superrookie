import test from 'node:test';import assert from 'node:assert/strict';
import {composeProposals} from '../../app/lib/review/proposals.mjs';
const f={id:1,targetSpan:'응답을 기다린다.',spanStart:0,spanEnd:9,proposals:[{operation:'REPLACE',after:'3초 동안 응답을 기다린다.'}]};
f.spanEnd=f.targetSpan.length;
test('an AI numeric candidate changes the body only after an explicit choice',()=>{
 assert.equal(composeProposals(f.targetSpan,[f],{}).content,f.targetSpan);
 assert.deepEqual(composeProposals(f.targetSpan,[f],{}).pending,[1]);
 assert.equal(composeProposals(f.targetSpan,[f],{1:{action:'APPLY',proposalIndex:0}}).content,f.proposals[0].after);
});
test('exclude keeps the source and custom edit replaces only selected UTF16 occurrence',()=>{
 assert.equal(composeProposals(f.targetSpan,[f],{1:{action:'EXCLUDE'}}).content,f.targetSpan);
 const s='😀 상태. 상태.';const row={id:2,targetSpan:'상태.',spanStart:7,spanEnd:10};
 assert.equal(composeProposals(s,[row],{2:{action:'EDIT',replacement:'정상 상태.'}}).content,'😀 상태. 정상 상태.');
});
test('empty custom edit and missing candidate stay undecided',()=>{
 assert.deepEqual(composeProposals(f.targetSpan,[f],{1:{action:'EDIT',replacement:' '}}).pending,[1]);
 assert.deepEqual(composeProposals(f.targetSpan,[f],{1:{action:'APPLY',proposalIndex:3}}).pending,[1]);
});
test('overlapping changes and stale source are rejected instead of overwriting unrelated text',()=>{
 assert.match(composeProposals(f.targetSpan,[f,{...f,id:2}],{1:{action:'APPLY'},2:{action:'EDIT',replacement:'수정'}}).error,/겹칩니다/);
 assert.match(composeProposals('다른 본문',[f],{1:{action:'APPLY'}}).error,/위치/);
});

test('zero findings is a valid unchanged document',()=>{
 const result=composeProposals('정상 본문',[],{});
 assert.equal(result.content,'정상 본문');assert.equal(result.error,null);assert.deepEqual(result.ranges,[]);
});
test('result highlights follow preceding edits and retain original finding identities',()=>{
 const baseline='😀 첫 문장. 다음 문장.';
 const rows=[{id:1,targetSpan:'첫 문장.',spanStart:3,spanEnd:8},{id:2,targetSpan:'다음 문장.',spanStart:9,spanEnd:15}];
 const result=composeProposals(baseline,rows,{1:{action:'EDIT',replacement:'수정한 첫 번째 문장.'}});
 for(const r of result.ranges){assert.equal(result.content.slice(r.start,r.end),r.id===1?'수정한 첫 번째 문장.':'다음 문장.');}
 assert.equal(result.ranges[0].kind,'manual');assert.equal(result.ranges[1].kind,'pending');
});
test('insertions and deletions highlight their resulting positions without losing later anchors',()=>{
 for(const operation of ['INSERT_BEFORE','INSERT_AFTER','DELETE']){
  const baseline='첫 문장. 다음 문장.';
  const rows=[{id:1,targetSpan:'첫 문장.',spanStart:0,spanEnd:5,proposals:[{operation,after:'추가 문장.'}]},{id:2,targetSpan:'다음 문장.',spanStart:6,spanEnd:12}];
  const result=composeProposals(baseline,rows,{1:{action:'APPLY',proposalIndex:0}});
  const [changed,next]=result.ranges;
  assert.equal(result.content.slice(changed.start,changed.end),operation==='DELETE'?'':operation==='INSERT_BEFORE'?'추가 문장.\n':'\n추가 문장.');
  assert.equal(result.content.slice(next.start,next.end),'다음 문장.');
 }
});
