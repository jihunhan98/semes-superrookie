import { cpSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { prepareBuildKeys } from './runtime-build-keys.cjs';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (...parts) => resolve(root, ...parts);
const source = at('.next/standalone');
if (!existsSync(resolve(source, 'server.js'))) throw new Error('Run npm run build first.');
const staging = at('dist/standalone-staging');
const destination = at('dist/standalone');
rmSync(staging, { recursive: true, force: true });
mkdirSync(staging, { recursive: true });
cpSync(source, staging, { recursive: true });
cpSync(at('.next/static'), resolve(staging, '.next/static'), { recursive: true });
if (existsSync(at('public'))) cpSync(at('public'), resolve(staging, 'public'), { recursive: true });
prepareBuildKeys(staging, false);
cpSync(at('scripts/runtime-build-keys.cjs'), resolve(staging, 'runtime-build-keys.cjs'));
const serverPath = resolve(staging, 'server.js');
writeFileSync(serverPath, "require('./runtime-build-keys.cjs').prepareBuildKeys(__dirname);\n" + readFileSync(serverPath, 'utf8'));
const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
writeFileSync(resolve(staging, 'build-info.json'), JSON.stringify({
  sourceCommit: commit,
  builtAt: new Date().toISOString(),
  buildId: readFileSync(at('.next/BUILD_ID'), 'utf8').trim(),
  ui: 'ReqOps Agent UX - 4 step workflow',
}, null, 2) + '\n');
writeFileSync(resolve(staging, 'run.bat'), '@echo off\r\ncd /d "%~dp0"\r\nif "%PORT%"=="" set PORT=3000\r\ntype build-info.json\r\nnode server.js\r\npause\r\n');
writeFileSync(resolve(staging, 'run.sh'), '#!/bin/sh\ncd "$(dirname "$0")"\nexport PORT="${PORT:-3000}"\ncat build-info.json\nexec node server.js\n', { mode: 0o755 });
rmSync(destination, { recursive: true, force: true });
renameSync(staging, destination);
console.log('Packaged frontend/dist/standalone (server, dependencies, static assets, build info).');
