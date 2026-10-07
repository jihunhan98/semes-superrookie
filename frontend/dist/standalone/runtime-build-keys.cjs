const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// Distribution manifests carry no keys. Each server startup creates fresh keys
// before Next.js loads either the JSON or JavaScript manifest.
function prepareBuildKeys(root, generate = true) {
  const next = path.join(root, '.next');
  const previewPath = path.join(next, 'prerender-manifest.json');
  const referencePath = path.join(next, 'server', 'server-reference-manifest.json');
  const preview = JSON.parse(fs.readFileSync(previewPath, 'utf8'));
  const reference = JSON.parse(fs.readFileSync(referencePath, 'utf8'));
  for (const name of ['previewModeSigningKey', 'previewModeEncryptionKey']) {
    preview.preview[name] = generate ? crypto.randomBytes(32).toString('hex') : '';
  }
  reference.encryptionKey = generate
    ? (process.env.NEXT_SERVER_ACTIONS_ENCRYPTION_KEY || crypto.randomBytes(32).toString('base64'))
    : '';
  fs.writeFileSync(previewPath, JSON.stringify(preview));
  fs.writeFileSync(path.join(next, 'prerender-manifest.js'),
    'self.__PRERENDER_MANIFEST=' + JSON.stringify(JSON.stringify(preview)));
  fs.writeFileSync(referencePath, JSON.stringify(reference));
  fs.writeFileSync(path.join(next, 'server', 'server-reference-manifest.js'),
    'self.__RSC_SERVER_MANIFEST=' + JSON.stringify(JSON.stringify(reference)));
}
module.exports = { prepareBuildKeys };
