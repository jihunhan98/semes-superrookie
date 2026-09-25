import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync } from "node:fs";
test("production source has no runtime artifact mock",()=>{const api=readFileSync(new URL("../../app/lib/api.ts",import.meta.url),"utf8");assert.equal(api.includes("mockIssueFor"),false);});
test("workflow presents exactly four user steps",()=>{const source=readFileSync(new URL("../../app/components/WorkflowStepper.tsx",import.meta.url),"utf8");for(const label of ["등록","검출 수정·요구사항 확정","이슈·산출물 도출","검토·전체 확정"])assert.match(source,new RegExp(label));});
