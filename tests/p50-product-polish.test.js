const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const styles = read('styles.css');
const app = read('app.js');
const index = read('index.html');
const manifest = JSON.parse(read('manifest.json'));
const worker = read('sw.js');
const logo = read('icons/logo-source.svg');

for (const token of ['primary', 'primary-hover', 'primary-light', 'background', 'surface', 'text', 'border', 'success', 'warning', 'error']) {
  assert.match(styles, new RegExp(`--${token}:`), `missing --${token}`);
}
assert.match(styles, /--primary:\s*#DDFF66/i);
assert.match(styles, /--primary-hover:\s*#CBEF4D/i);
assert.match(styles, /--primary-light:\s*#F7FFD1/i);
assert.equal(manifest.theme_color.toUpperCase(), '#DDFF66');
assert.match(index, /theme-color" content="#DDFF66"/i);
assert.match(logo, /fill="#DDFF66"/i);

for (const file of ['styles.css', 'advanced-content-platform.css', 'community-learning.css', 'learning-science.css', 'product-ux.css']) {
  assert.doesNotMatch(read(file), /#(?:C5ED4F|A8CF35|9FC72F)/i, `${file} still uses an old brand accent`);
}

assert.match(app, /const ProductLanguageService =/);
assert.match(app, /ProductLanguageService\.apply\(document\)/);
assert.match(app, /Trợ lý học tập/);
assert.doesNotMatch(app, />✨ AI<\/button>/);
assert.doesNotMatch(app, /<strong>AI_DISABLED_BY_USER<\/strong>/);
assert.match(index, />Trợ lý<\/span>/);
assert.match(styles, /\.bottom-nav \.nav-item\[data-route="ai-coach"\]\s*\{\s*display:\s*none/);
assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
assert.match(styles, /:focus-visible/);
assert.match(worker, /const CACHE = 'klearn-v87'/);
assert.match(index, /styles\.css\?v=32/);
assert.match(index, /app\.js\?v=73/);

function pngSize(file) {
  const data = fs.readFileSync(path.join(root, file));
  assert.equal(data.subarray(1, 4).toString(), 'PNG');
  return [data.readUInt32BE(16), data.readUInt32BE(20)];
}
assert.deepEqual(pngSize('icons/icon-192.png'), [192, 192]);
assert.deepEqual(pngSize('icons/icon-512.png'), [512, 512]);
assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);

console.log('P50 product polish static checks passed.');
