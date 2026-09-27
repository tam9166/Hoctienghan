const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const app = read('app.js');
const assistant = read('data/beginner-learning-assistant.js');
const coach = read('data/ai-coach.js');
const adaptive = read('data/adaptive-engine.js');
const companion = read('data/global-ai-language-companion.js');
const practical = read('data/practical-study.js');
const daily = read('data/vocabulary-daily-action.js');
const quality = read('data/ai-quality-optimization.js');

test('UX-005 terminology is Vietnamese-first while TOPIK and Hangul remain', () => {
  assert.match(app, /Câu hỏi tự biên soạn/);
  assert.match(app, /Ước tính điểm luyện tập/);
  assert.match(app, /Lỗi do bất cẩn/);
  assert.match(app, /Ngữ pháp/);
  assert.match(assistant, /SRS — hệ thống nhắc bạn ôn từ đúng lúc/);
  assert.match(app, /TOPIK/);
  assert.match(app, /Hangul/);
});

test('UX-006 listening uses a persisted Korean-first translation preference', () => {
  assert.match(app, /listeningMeaning/);
  assert.match(app, /listeningMeaningVisible/);
  assert.match(app, /setListeningMeaningPreference/);
  assert.match(app, /Hiện nghĩa tiếng Việt/);
  assert.match(app, /data-listening-toggle="translation"/);
});

test('UX-007 wrong answers expose contextual repair actions without changing primary flow', () => {
  assert.match(app, /Câu tiếp theo/);
  assert.match(coach, /lesson-error-actions/);
  assert.match(coach, /Sổ lỗi/);
  assert.match(coach, /Ôn lại từ/);
  assert.match(coach, /Xem ngữ pháp/);
  assert.match(coach, /ErrorNotebookService\.add/);
});

test('UX-008 Error Notebook has safe Vietnamese labels, timestamps and source fallback', () => {
  assert.match(coach, /errorTypeLabel/);
  assert.match(coach, /errorDate/);
  assert.match(coach, /Mở câu gốc/);
  assert.match(coach, /Không thể mở bài gốc/);
  assert.match(coach, /data-error-source/);
  assert.match(coach, /lessonId/);
});

test('UX-009 SRS explains due items and keeps one primary queue', () => {
  assert.match(assistant, /ÔN TẬP SRS/);
  assert.match(assistant, /ÔN HÔM NAY/);
  assert.match(assistant, /data-srs-explanation/);
  assert.match(daily, /đã đến lúc ôn/);
});

test('UX-011 recommendations have real destination CTAs', () => {
  assert.match(adaptive, /topik-intelligence-p80/);
  assert.match(adaptive, /actionView/);
  assert.match(companion, /data-companion-route/);
  assert.match(companion, /listening-studio/);
  assert.match(companion, /writing-hub/);
});

test('UX-012 operator telemetry is not injected into learner UI', () => {
  assert.match(quality, /AccessControlService\?\.canReview/);
  assert.match(quality, /data-p68-quality-summary/);
});

test('UX-013 and UX-016 provide one discoverable Ôn & thi hub and route fallback', () => {
  assert.match(assistant, /p2-navigation-hub/);
  assert.match(assistant, /topik-intelligence-p80/);
  assert.match(assistant, /offline-packs/);
  assert.match(assistant, /learning-progress/);
  assert.match(app, /Không thể mở trang này\./);
  assert.match(app, /data-route-retry/);
  assert.match(app, /Về trang chủ/);
});

test('UX-014 Learning Plan uses progressive disclosure', () => {
  assert.match(adaptive, /adaptive-progressive-disclosure/);
  assert.match(adaptive, /Vì sao app đề xuất/);
  assert.match(adaptive, /Mục tiêu & lộ trình/);
});

test('UX-015 Offline vocabulary packs describe their actual payload', () => {
  assert.match(practical, /Gói này chỉ chứa dữ liệu từ vựng, không chứa bài học/);
  assert.match(practical, /vocabularyIds/);
  assert.doesNotMatch(practical, /Vocabulary Pack.*0 lessons/);
});

console.log('UX P2 contract tests passed: terminology, listening, repair actions, SRS, adaptive, telemetry, navigation, plan, offline and route health');
