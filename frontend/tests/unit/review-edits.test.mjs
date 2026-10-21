import test from 'node:test';
import assert from 'node:assert/strict';
import {mapRange,changedRange,prepareEdit,spliceEdit,placeholders} from '../../app/lib/review/edits.mjs';

test('replace only the selected repeated phrase',()=>{
 const value='같은 문장. 같은 문장.';
 const p={operation:'REPLACE',before:'같은 문장.',after:'새 문장.'};
 assert.equal(spliceEdit(value,prepareEdit(value,p,{start:7,end:13})),'같은 문장. 새 문장.');
});
test('insert before/after preserves the original and delete removes only selected text',()=>{
 const value='앞. 대상. 뒤.', anchor={start:3,end:6}, p={before:'대상.',after:'추가.'};
 assert.equal(spliceEdit(value,prepareEdit(value,{...p,operation:'INSERT_BEFORE'},anchor)),'앞. 추가.\n대상. 뒤.');
 assert.equal(spliceEdit(value,prepareEdit(value,{...p,operation:'INSERT_AFTER'},anchor)),'앞. 대상.\n추가. 뒤.');
 assert.equal(spliceEdit(value,prepareEdit(value,{...p,operation:'DELETE'},anchor)),'앞.  뒤.');
});
test('earlier edits move subsequent anchors',()=>{
 assert.deepEqual(mapRange({start:10,end:15},0,3,6),{start:13,end:18});
});
test('overlapping user edits invalidate suggestions rather than overwriting',()=>{
 assert.equal(mapRange({start:10,end:15},12,14,3).stale,true);
 assert.throws(()=>prepareEdit('사용자 수정',{before:'이전 본문',after:'제안',operation:'REPLACE'},{start:0,end:6}),/바뀌었습니다/);
});
test('emoji positions use UTF16 consistently',()=>{
 const text='😀 원문.';
 assert.equal(spliceEdit(text,prepareEdit(text,{operation:'REPLACE',before:'원문.',after:'수정.'},{start:3,end:6})),'😀 수정.');
});
test('typing envelope preserves unchanged suffix and prefix',()=>{
 assert.deepEqual(changedRange('앞 중간 뒤','앞 수정된 중간 뒤'),{start:2,end:2,text:'수정된 '});
});
test('input markers remain visible until explicitly completed',()=>{
 assert.equal(placeholders('대기시간 ⟦시간(ms): 입력 필요⟧').length,1);
 assert.equal(placeholders('대기시간 100ms').length,0);
});
