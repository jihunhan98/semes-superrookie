import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
const {prepareBuildKeys}=createRequire(import.meta.url)('../../scripts/runtime-build-keys.cjs');
test('distribution contains no preview or action keys; startup creates fresh keys',()=>{
 const root=mkdtempSync(join(tmpdir(),'reqops-keys-'));
 try {
  mkdirSync(join(root,'.next/server'),{recursive:true});
  writeFileSync(join(root,'.next/prerender-manifest.json'),JSON.stringify({preview:{previewModeId:'test-id',previewModeSigningKey:'test-signing',previewModeEncryptionKey:'test-encryption'}}));
  writeFileSync(join(root,'.next/server/server-reference-manifest.json'),JSON.stringify({encryptionKey:'test-action'}));
  const preview=()=>JSON.parse(readFileSync(join(root,'.next/prerender-manifest.json'),'utf8')).preview;
  const actions=()=>JSON.parse(readFileSync(join(root,'.next/server/server-reference-manifest.json'),'utf8')).encryptionKey;
  prepareBuildKeys(root,false);
  assert.deepEqual(Object.values(preview()),['','','']);assert.equal(actions(),'');
  prepareBuildKeys(root);const first=preview().previewModeSigningKey;
  assert.ok(Object.values(preview()).every(Boolean));assert.ok(actions());
  prepareBuildKeys(root);assert.notEqual(preview().previewModeSigningKey,first);
  prepareBuildKeys(root,false);
  assert.deepEqual(Object.values(preview()),['','','']);assert.equal(actions(),'');
 } finally {rmSync(root,{recursive:true,force:true});}
});
