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
