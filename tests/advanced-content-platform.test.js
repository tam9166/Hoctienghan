const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'advanced-content-platform.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'advanced-content-platform.js'), 'utf8');

function boot(userId = 'learner-a', shared = new Map(), weakSkill = 'grammar') {
  const state = { currentUser: { id: userId }, currentView: 'home', advancedContent: null };
  const syncEvents = [];
  const scoped = (key) => shared.get(key)?.[userId] || [];
  const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); syncEvents.push(key); };
  const noteService = {
    all: () => scoped('notes'),
    upsert(note) { const value = { id: note.id || `note-${Date.now()}`, userId, ...note, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; saveScoped('notes', [value, ...this.all().filter((item) => item.id !== value.id)]); return value; }
  };
  const bookmarkService = {
    all: () => scoped('bookmarks'), key: (type, id) => `${type}:${id}`,
    has(type, id) { return this.all().some((item) => item.key === this.key(type, id)); },
    toggle(type, id, title = '') { const key = this.key(type, id); const items = this.all(); if (items.some((item) => item.key === key)) { saveScoped('bookmarks', items.filter((item) => item.key !== key)); return false; } saveScoped('bookmarks', [{ key, type, id, title, createdAt: new Date().toISOString() }, ...items]); return true; }
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, GlobalSearchService: { search: () => ({ studyTools: [] }) },
    KLEARN_APP: {
      state, STORAGE_KEYS: { contentFeedback: 'feedback' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      normalizeSearch: (value = '') => String(value).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(), getUserProgress: () => ({ skills: { grammar: weakSkill === 'grammar' ? 35 : 80, listening: weakSkill === 'listening' ? 30 : 75 } }),
      userScoped: scoped, saveUserScoped: saveScoped, LearnerProfileService: { get: () => ({ weakSkills: [weakSkill] }) }, AccessControlService: { canReview: () => false, canManageReviews: () => false }, NotesService: noteService, BookmarkService: bookmarkService, speakKorean: () => {}
    }
  };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.AdvancedContentService.hydrate(content);
  return { window, state, shared, syncEvents, bookmarks: bookmarkService, notes: noteService };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.deepEqual(content.workflow.statuses, ['draft', 'review', 'approved']);
for (const item of [...content.catalog, ...content.examples, ...content.vocabulary]) {
  assert.ok(Number(item.version) >= 1, `${item.id} needs a version`);
  assert.ok(!Number.isNaN(Date.parse(item.createdAt)), `${item.id} needs createdAt`);
  assert.ok(!Number.isNaN(Date.parse(item.updatedAt)), `${item.id} needs updatedAt`);
  assert.ok(content.workflow.statuses.includes(item.status), `${item.id} has an invalid status`);
}
for (const item of content.catalog.filter((entry) => entry.status === 'approved')) {
  assert.ok(Object.values(item.quality).every((score) => score >= content.workflow.approvalThreshold), `${item.id} failed the quality gate`);
}
for (const grammar of content.catalog.filter((item) => item.type === 'grammar')) {
  const levels = new Set(content.examples.filter((item) => item.grammarId === grammar.id).map((item) => item.difficulty));
  assert.deepEqual([...levels].sort(), ['Advanced', 'Beginner', 'Intermediate'], `${grammar.id} needs three example levels`);
}
const ranks = content.vocabulary.map((item) => item.frequencyRank);
assert.ok(ranks.every((rank) => Number.isInteger(rank) && rank > 0));
assert.equal(new Set(ranks).size, ranks.length, 'frequency ranks must be unique');

const shared = new Map(); const grammarLearner = boot('learner-a', shared, 'grammar'); const platform = grammarLearner.window;
assert.equal(platform.AdvancedContentService.search('학교').some((item) => item.korean === '학교'), true);
assert.equal(platform.AdvancedContentService.search('trợ từ', { type: 'grammar' })[0].id, 'grammar-topic-particle');
assert.equal(platform.AdvancedContentService.search('kế hoạch').some((item) => item.id === 'lesson-daily-plan'), false, 'review content must stay out of learner search');
assert.equal(platform.AdvancedContentService.search('시장 상황').length, 0, 'example under review must stay private');
assert.equal(platform.AdvancedContentService.quality(platform.AdvancedContentService.byId('grammar-topic-particle')), 95);
const currentVersion = platform.ContentVersionService.current('grammar-topic-particle');
assert.equal(currentVersion.version, 4);
assert.equal(currentVersion.createdAt, '2026-06-12T00:00:00.000Z');
assert.equal(currentVersion.updatedAt, '2026-09-01T00:00:00.000Z');
assert.equal(platform.ContentVersionService.history('grammar-topic-particle')[0].version, 4);
assert.equal(platform.NativeReviewService.queue('review').length, 2);
assert.equal(platform.NativeReviewService.canApprove(platform.AdvancedContentService.byId('grammar-topic-particle')), true);
assert.equal(platform.NativeReviewService.canApprove(platform.AdvancedContentService.byId('lesson-daily-plan', true)), false);
assert.equal(platform.NativeReviewService.permissions().review, false);
assert.equal(platform.NativeReviewService.permissions().approve, false);
assert.equal(platform.ContentRecommendationService.next(1)[0].skill, 'grammar');

grammarLearner.bookmarks.toggle('grammar', 'grammar-topic-particle', '은/는');
assert.equal(platform.KoreanNotebookService.bookmarks().length, 1);
platform.KoreanNotebookService.saveNote('grammar-topic-particle', 'Dùng để nêu chủ đề.');
assert.equal(platform.KoreanNotebookService.notes()[0].sourceType, 'content-platform');
const feedback = platform.ContentFeedbackService.submit({ contentId: 'grammar-topic-particle', category: 'missing_example', message: 'Cần thêm ví dụ hội thoại.' });
assert.equal(feedback.status, 'received');
assert.equal(platform.ContentFeedbackService.all().length, 1);
assert.ok(grammarLearner.syncEvents.includes('feedback'));

const listeningLearner = boot('learner-b', shared, 'listening');
assert.equal(listeningLearner.window.ContentRecommendationService.next(1)[0].id, 'lesson-cafe-order');
assert.equal(listeningLearner.window.ContentFeedbackService.all().length, 0, 'feedback must be user scoped');
assert.equal(listeningLearner.window.KoreanNotebookService.bookmarks().length, 0, 'notebook must be user scoped');
assert.equal(typeof platform.KLEARN_EXTRA_VIEWS['content-platform'], 'function');
assert.equal(typeof platform.KLEARN_EXTRA_VIEWS['content-detail'], 'function');
assert.match(platform.GlobalSearchService.search('학교').studyTools[0].title, /nội dung/i);

console.log('advanced content platform: versions, native review, quality, examples, frequency, search, recommendations, notebook and feedback passed');
