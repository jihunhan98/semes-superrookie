// Build a self-contained document using unmodified, published Atlaskit packages.
const fs = require('node:fs');
const path = require('node:path');
const esbuild = require('esbuild');
const { setBooleanFeatureFlagResolver } = require('@atlaskit/platform-feature-flags');
const { getThemeStyles } = require('@atlaskit/tokens/get-theme-styles');
const { getThemeHtmlAttrs } = require('@atlaskit/tokens/get-theme-html-attrs');
const escapeHtml = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

(async () => {
  const output = await esbuild.build({
    absWorkingDir: __dirname,
    entryPoints: ['bootstrap.js'],
    bundle: true, write: false, outdir: 'build',
    minify: true, format: 'iife', platform: 'browser', target: ['es2020'],
    define: { 'process.env.NODE_ENV': '"production"' },
    nodePaths: (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean),
    metafile: true, legalComments: 'inline',
  });
  const js = output.outputFiles.find(file => file.path.endsWith('.js')).text;
  const css = output.outputFiles.find(file => file.path.endsWith('.css')).text;
  // Read the exact shipped licenses for packages whose code is in the bundle.
  const packages = new Map();
  for (const input of Object.keys(output.metafile.inputs)) {
    let directory = path.dirname(path.resolve(__dirname, input));
    while (directory !== path.dirname(directory)) {
      const manifest = path.join(directory, 'package.json');
      if (fs.existsSync(manifest)) {
        const pkg = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        if (pkg.name && pkg.version && pkg.name !== 'reqops-atlaskit-preview') {
          if (!packages.has(pkg.name)) {
            const filenames = fs.readdirSync(directory).filter(name => /^(licen[sc]e|copying|notice)(\.|$)/i.test(name) && fs.statSync(path.join(directory, name)).isFile());
            packages.set(pkg.name, { pkg, texts: filenames.map(name => `${name}\n${fs.readFileSync(path.join(directory, name), 'utf8')}`) });
          }
          break;
        }
      }
      directory = path.dirname(directory);
    }
  }
  // Tokens' theme styles are loaded at build time, so the file needs no CDN.
  const tokensRoot = path.dirname(require.resolve('@atlaskit/tokens/package.json'));
  const tokensPkg = JSON.parse(fs.readFileSync(path.join(tokensRoot, 'package.json'), 'utf8'));
  packages.set(tokensPkg.name, { pkg: tokensPkg, texts: [fs.readFileSync(path.join(tokensRoot, 'LICENSE'), 'utf8')] });
  const notices = [...packages.values()].sort((a, b) => a.pkg.name.localeCompare(b.pkg.name)).map(({ pkg, texts }) => `${pkg.name} ${pkg.version} — ${pkg.license || 'See license below'}\n${texts.join('\n\n')}`).join('\n\n----------------------------------------\n\n');
  const preferences = { colorMode: 'light', light: 'light', dark: 'dark', spacing: 'spacing', typography: 'typography' };
  setBooleanFeatureFlagResolver(() => false);
  const themes = await getThemeStyles(preferences);
  if (!themes.length) throw new Error('Design token themes could not be loaded');
  const attrs = Object.entries(getThemeHtmlAttrs(preferences)).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ');
  const themeStyles = themes.map(theme => `<style ${Object.entries(theme.attrs).map(([key, value]) => `${key}="${escapeHtml(value)}"`).join(' ')}>${theme.css.replace(/<\/style/gi, '<\\/style')}</style>`).join('\n');
  const html = `<!doctype html>\n<html lang="ko" ${attrs}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>ReqOps 개발 이슈 · 실제 Atlaskit 미리보기</title>${themeStyles}<style>${css.replace(/<\/style/gi, '<\\/style')}</style></head><body><div id="root"></div><noscript>이 문서는 React 컴포넌트를 실행하므로 JavaScript를 활성화해주세요.</noscript><details id="third-party-notices"><summary>Third-party notices · 사용한 패키지와 라이선스</summary><pre>${escapeHtml(notices)}</pre></details><script>${js.replace(/<\/script/gi, '<\\/script')}</script></body></html>\n`;
  const destination = path.resolve(__dirname, '../atlaskit-issue-preview.html');
  fs.writeFileSync(destination, html);
  fs.writeFileSync(path.join(__dirname, 'THIRD_PARTY_NOTICES.txt'), notices.trimEnd() + '\n');
  console.log(`Built ${path.basename(destination)} (${Buffer.byteLength(html)} bytes); ${packages.size} bundled packages; ${themes.length} token themes.`);
})().catch(error => { console.error(error); process.exitCode = 1; });
