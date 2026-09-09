import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const mobileRoot = path.resolve(scriptDir, '..');
const root = path.resolve(mobileRoot, '..');
const output = path.resolve(mobileRoot, 'www');
assert.equal(path.dirname(output), mobileRoot, 'native output must remain inside mobile/');

const release = process.argv.includes('--release');
const apiBaseUrl = String(process.env.MOBILE_API_BASE_URL || '').trim().replace(/\/$/, '');
if (apiBaseUrl) {
  const parsed = new URL(apiBaseUrl);
  const local = ['localhost', '127.0.0.1'].includes(parsed.hostname);
  assert.ok(parsed.protocol === 'https:' || (!release && local && parsed.protocol === 'http:'), 'MOBILE_API_BASE_URL must use HTTPS');
}
if (release) assert.ok(apiBaseUrl, 'MOBILE_API_BASE_URL is required for a release build');

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
const copyDirectory = (source, destination) => {
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const from = path.join(source, entry.name); const to = path.join(destination, entry.name);
    if (entry.isDirectory()) copyDirectory(from, to);
    else if (entry.isFile()) fs.copyFileSync(from, to);
  }
};
for (const directory of ['content', 'data', 'icons', 'locales']) copyDirectory(path.join(root, directory), path.join(output, directory));
for (const file of fs.readdirSync(root)) {
  if (['.css', '.js'].includes(path.extname(file)) || ['index.html', 'manifest.json', 'version.json'].includes(file)) fs.copyFileSync(path.join(root, file), path.join(output, file));
}

const manifest = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
const channel = String(process.env.MOBILE_RELEASE_CHANNEL || 'development');
const runtime = {
  platform: 'native',
  apiBaseUrl,
  authRedirectUrl: 'com.tamhoanq.korean://auth/callback',
  version: manifest.version,
  channel,
  build: String(process.env.GITHUB_RUN_NUMBER || process.env.MOBILE_BUILD_NUMBER || 'local')
};
fs.writeFileSync(path.join(output, 'mobile-runtime-config.js'), `window.__KLEARN_RUNTIME_CONFIG__ = Object.freeze(${JSON.stringify(runtime)});\n`);

const indexPath = path.join(output, 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace('<script src="data/mobile-native.js?v=1"></script>', '<script src="mobile-native-plugins.js"></script>\n  <script src="data/mobile-native.js?v=1"></script>');
assert.match(html, /mobile-native-plugins\.js/);
fs.writeFileSync(indexPath, html);

await build({ entryPoints: [path.join(mobileRoot, 'src', 'native-plugins.js')], bundle: true, minify: true, platform: 'browser', target: ['es2022'], outfile: path.join(output, 'mobile-native-plugins.js') });
console.log(JSON.stringify({ status: 'built', output, version: manifest.version, channel, release, apiConfigured: Boolean(apiBaseUrl) }, null, 2));
