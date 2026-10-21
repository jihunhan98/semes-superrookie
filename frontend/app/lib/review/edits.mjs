/** @typedef {{start:number,end:number,stale?:boolean}} Range */
/** Map a known UTF-16 edit through another range. Overlaps become stale. */
export function mapRange(range, start, end, insertedLength) {
  if (range.stale) return range;
  const delta = insertedLength - (end - start);
  if (end <= range.start) return { ...range, start: range.start + delta, end: range.end + delta };
  if (start >= range.end) return range;
  return { ...range, stale: true };
}
/** A contiguous edit envelope is deliberately conservative for arbitrary typing/paste. */
export function changedRange(before, after) {
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) start++;
  let oldEnd = before.length, newEnd = after.length;
  while (oldEnd > start && newEnd > start && before[oldEnd - 1] === after[newEnd - 1]) { oldEnd--; newEnd--; }
  return { start, end: oldEnd, text: after.slice(start, newEnd) };
}
/** @param {string} value @param {import('../api').ReviewProposal} proposal @param {Range} anchor */
export function prepareEdit(value, proposal, anchor) {
  if (anchor.stale || value.slice(anchor.start, anchor.end) !== proposal.before)
    throw new Error('대상 문장이 바뀌었습니다. 현재 본문으로 다시 검토해주세요.');
  if (proposal.operation === 'INSERT_BEFORE') return { start: anchor.start, end: anchor.start, text: proposal.after + '\n' };
  if (proposal.operation === 'INSERT_AFTER') return { start: anchor.end, end: anchor.end, text: '\n' + proposal.after };
  if (proposal.operation === 'DELETE') return { start: anchor.start, end: anchor.end, text: '' };
  return { start: anchor.start, end: anchor.end, text: proposal.after };
}
/** @param {string} value @param {{start:number,end:number,text:string}} edit */
export function spliceEdit(value, edit) { return value.slice(0, edit.start) + edit.text + value.slice(edit.end); }
/** @param {string} text */
export function placeholders(text) {
  return [...text.matchAll(/⟦[^⟧]*⟧/g)].map(m => ({ start: m.index, end: m.index + m[0].length, label: m[0] }));
}
