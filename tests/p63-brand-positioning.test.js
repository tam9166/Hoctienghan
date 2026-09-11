const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const index = read('index.html');
const manifest = JSON.parse(read('manifest.json'));
const styles = read('styles.css');
const logo = read('icons/logo-source.svg');
const vi = read('locales/vi.js');
const en = read('locales/en.js');
const zh = read('locales/zh-CN.js');
const worker = read('sw.js');
const report = read('docs/P63_BRAND_POSITIONING_REPORT.md');

assert.match(index, /Học tiếng Hàn theo lộ trình dành cho người Việt/);
assert.match(index, /Hangul đến TOPIK và tiếng Hàn dùng được trong đời sống/);
assert.match(index, /data-route="ai-coach"[^>]*>[\s\S]*?<span>Trợ lý<\/span>/);
assert.match(index, /locales\/vi\.js\?v=5/);
assert.match(index, /locales\/en\.js\?v=7/);
assert.match(index, /locales\/zh-CN\.js\?v=7/);

assert.equal(manifest.name, 'Tiếng Hàn - TamHoanq');
assert.equal(manifest.theme_color, '#DDFF66');
assert.match(manifest.description, /dành cho người Việt/);
assert.match(styles, /--primary:\s*#DDFF66/i);
assert.match(styles, /--primary-hover:\s*#CBEF4D/i);
assert.match(styles, /--primary-light:\s*#F7FFD1/i);
assert.match(styles, /--logo-ink:\s*#1C2416/i);
assert.match(logo, /fill="#DDFF66"/i);
assert.match(logo, /fill="#1C2416"/i);

assert.match(vi, /'ai\.title': 'Trợ lý học tập'/);
assert.match(vi, /'nav\.assistant': 'Trợ lý'/);
assert.match(vi, /Khi bạn bật hỗ trợ AI/);
assert.doesNotMatch(vi.slice(vi.lastIndexOf('// Product language')), /AI Gia sư TamHoanq/);
assert.match(en, /'ai\.title': 'Learning assistant'/);
assert.match(zh, /'ai\.title': '学习助手'/);
assert.match(worker, /locales\/vi\.js\?v=5/);
assert.match(worker, /locales\/en\.js\?v=7/);
assert.match(worker, /locales\/zh-CN\.js\?v=7/);

for (const heading of [
  '## 1. Current Brand Analysis',
  '## 2. Competitor Comparison',
  '## 3. Target User',
  '## 4. Unique Value Proposition',
  '## 5. Brand Pillars',
  '## 6. Product Language Changes',
  '## 7. Visual Identity',
  '## 8. UX Differentiation',
  '## 9. Removed Generic Elements',
  '## 10. Recommended Changes',
  '## 11. Implementation Plan'
]) assert.match(report, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));

console.log('P63 brand positioning checks passed.');
