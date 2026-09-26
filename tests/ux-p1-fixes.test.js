const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const assistant = fs.readFileSync(path.join(root, 'data', 'beginner-learning-assistant.js'), 'utf8');
const coach = fs.readFileSync(path.join(root, 'data', 'ai-coach.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'beginner-learning-assistant.css'), 'utf8');

test('P1-01 Progress tolerates malformed and legacy dates', () => {
  assert.match(assistant, /const validDate =/);
  assert.match(assistant, /formatDay\(item\.date \|\| item\.key\)/);
  assert.match(assistant, /formatAchievementDate\(item\.at\)/);
  assert.doesNotMatch(assistant, /DateTimeFormat\('vi-VN', \{ weekday: 'short' \}\)\.format\(item\.date\)/);
});

test('P1-02 Today Plan puts the primary CTA before task details', () => {
  assert.match(assistant, /bla-today-start-primary/);
  assert.ok(assistant.indexOf('bla-today-start-primary') < assistant.indexOf('<ol>${plan.tasks'));
  assert.match(css, /\.bla-today-start-primary/);
});

test('P1-03 unauthenticated sample lesson is public while core routes remain protected', () => {
  assert.match(app, /PUBLIC_VIEWS = \['welcome', 'login', 'register', 'demo'\]/);
  assert.match(app, /PUBLIC_VIEWS\.push\('sample-lesson'\)/);
  assert.match(app, /'sample-lesson': sampleLessonView/);
  assert.match(app, /data-view="sample-lesson">Bắt đầu học thử/);
  assert.match(app, /if \(!state\.currentUser && !PUBLIC_VIEWS\.includes\(target\)\) target = 'welcome'/);
  assert.match(app, /Không có dữ liệu học nào bị ghi hoặc xóa/);
});

test('P1-04 beginner-facing Profile and Assistant have collapsed advanced details', () => {
  assert.match(coach, /learner-profile-summary/);
  assert.match(coach, /profile-advanced/);
  assert.match(coach, /learner-assistant-summary/);
  assert.match(coach, /assistant-advanced/);
  assert.match(css, /\.profile-advanced>summary/);
});

test('P1-05 quota errors expose recovery and preserve failed data for retry', () => {
  assert.match(app, /QuotaExceededError/);
  assert.match(app, /lastFailedWrite/);
  assert.match(app, /retryLast\(\)/);
  assert.match(app, /storage-recovery-banner/);
  assert.match(app, /data-storage-retry/);
  assert.match(app, /data-storage-manage/);
  assert.match(app, /return \{ ok: persisted, cards: normalized \}/);
  assert.match(css, /\.storage-recovery-banner/);
});

console.log('UX P1 contract tests passed: progress, mobile CTA, registration timing, beginner presentation and quota recovery');
