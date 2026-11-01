import test from 'node:test';
import assert from 'node:assert/strict';
import {analysisNotice} from '../../app/lib/review/analysis.mjs';
test('partial HTTP-success analysis shows cause and coverage',()=>{
 const text=analysisNotice({aiEngine:'internal',reviewContext:{status:'PARTIAL',comparedCount:2,totalCount:4,reviewWarnings:['INVALID_RESPONSE']}});
 assert.match(text,/일부만/);assert.match(text,/2\/4/);assert.match(text,/JSON/);assert.match(text,/제안은 검토/);
});
test('legacy partial response still explains why 200 is not completion',()=>{
 assert.match(analysisNotice({aiEngine:'rule',reviewContext:{status:'PARTIAL'}}),/검증을 통과/);
});
test('complete zero-findings response has no failure notice',()=>{
 assert.equal(analysisNotice({aiEngine:'internal',reviewContext:{status:'COMPLETE'}}),'');
});
test('transport unavailable and timeout have different explanations',()=>{
 assert.match(analysisNotice({aiEngine:'unavailable',reviewContext:{status:'FAILED'}}),/서버 응답/);
 assert.match(analysisNotice({aiEngine:'rule',reviewContext:{status:'PARTIAL',reviewWarnings:['TIMEOUT']}}),/대기시간/);
});
