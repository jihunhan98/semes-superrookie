import test from 'node:test';
import assert from 'node:assert/strict';
import {hasRequirementChanges} from '../../app/lib/review/consensus.mjs';

test('keeping the registered or currently confirmed body needs no new agreement',()=>{
 assert.equal(hasRequirementChanges('원문','원문'),false);
 assert.equal(hasRequirementChanges('확정된 현재 본문','확정된 현재 본문'),false);
});
test('CRLF/LF encoding is equivalent while actual sentence and whitespace edits require agreement',()=>{
 assert.equal(hasRequirementChanges('첫 문장\r\n둘째 문장','첫 문장\n둘째 문장'),false);
 assert.equal(hasRequirementChanges('원문','원문 '),true);
 assert.equal(hasRequirementChanges('SOC 50% 이상','SOC 30% 이상'),true);
});
test('compare to the saved source even when the AI review draft already contains a change',()=>{
 const source='SOC 50% 이상',reviewedDraft='SOC 30% 이상';
 assert.equal(hasRequirementChanges(source,reviewedDraft),true);
 assert.equal(hasRequirementChanges(source,source),false);
});
