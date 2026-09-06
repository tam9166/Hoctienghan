const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'product-ux.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'data', 'product-ux.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

function boot({ user = {}, progress = {}, practiceCompleted = 0 } = {}) {
  const state = {
    currentUser: { id: 'ux-user', fullName: 'Nguyen An', level: 'Beginner', onboardingCompleted: true, studyMinutesPerDay: 15, ...user },
    currentView: 'home', globalQuery: '', selectedLessonPreview: '', lessonStep: 0, lessonCheck: null
  };
  const values = new Map([
    ['errors', { 'ux-user': [{ id: 'err-1', mistake: '은/는', correction: '이/가', explanation: 'Nhầm trợ từ', resolved: false }] }],
    ['product-ux', {}]
  ]);
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items) => { const all = values.get(key) || {}; all[state.currentUser.id] = items; values.set(key, all); };
  const document = {
    documentElement: { lang: 'vi', dataset: {} },
    querySelector: () => null,
    querySelectorAll: () => [],
    getElementById: () => null
  };
  const normalizeSearch = (value) => String(value || '').toLocaleLowerCase('vi');
  const searchData = {
    lessons: [{ id: 'topik-1-01', title: 'Bài 01 · Trợ từ', topic: 'Ngữ pháp', topikLevel: 1, grammar: { vi: 'Cách dùng 은/는' } }],
    studyTools: [{ id: 'grammar-compare', title: 'So sánh ngữ pháp', description: '은/는 và 이/가', view: 'grammar-compare' }],
    vocabulary: [{ id: 'school', korean: '학교', meanings: { vi: 'trường học' } }],
    saved: [{ id: 'sentence-1', korean: '저는 학생이에요.', translation: 'Tôi là học sinh.' }],
    phrasebook: [{ id: 'phrase-1', korean: '안녕하세요', meanings: { vi: 'xin chào' } }],
    notes: [{ id: 'note-1', content: 'Ghi nhớ trợ từ' }],
    bookmarks: [{ id: 'bookmark-1', title: 'Bài đã lưu', type: 'lesson' }],
    practice: [], resources: [], videos: [], context: []
  };
  const window = {
    document,
    addEventListener: () => {},
    location: { reload: () => {} },
    GlobalSearchService: { search: () => searchData },
    KLEARN_EXTRA_VIEWS: {},
    KLEARN_AFTER_RENDER: null,
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { productUx: 'product-ux', errors: 'errors' },
      render: () => {},
      setView: (view) => { state.currentView = view; },
      toast: () => {},
      escapeHtml: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
      normalizeSearch,
      getUserProgress: () => ({ stats: { lessonsCompleted: 0, streak: 3 }, ...progress }),
      userScoped,
      saveUserScoped,
      updateCurrentUser: (changes) => Object.assign(state.currentUser, changes),
      LearnerProfileService: { get: () => ({}) },
      VocabularyService: { dueCards: () => [] },
      PracticeService: { statistics: () => ({ completed: practiceCompleted }) }
    }
  };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }), setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  window.ProductUxContentService.hydrate(content);
  return { window, state, values };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
for (const segment of Object.values(content.segments)) assert.equal(segment.features.reduce((sum, item) => sum + item.weight, 0), 100, 'feature priorities must total 100%');

const beginner = boot({ user: { learningTrack: 'foundation', level: 'Level 0' } });
assert.equal(beginner.window.UserExperienceProfileService.segment(), 'beginner');
assert.equal(beginner.window.UserExperienceProfileService.disclosureTier(), 'core');
assert.equal(beginner.window.FeaturePriorityService.distribution()['beginner-path'], 70);
assert.deepEqual(Array.from(beginner.window.FeaturePriorityService.visibleCommands(), (item) => item.id), ['learn', 'review']);
assert.ok(Array.from(beginner.window.FeaturePriorityService.hiddenCommands(), (item) => item.id).includes('analytics'));

const topik = boot({ user: { learningTrack: 'topik', learningMode: 'topik', goals: ['topik'], currentTopikLevel: 3 } });
assert.equal(topik.window.UserExperienceProfileService.segment(), 'topik');
assert.equal(topik.window.UserExperienceProfileService.disclosureTier(), 'advanced');
assert.equal(topik.window.FeaturePriorityService.distribution()['topik-mock'], 50);
assert.equal(topik.window.FeaturePriorityService.hiddenCommands().length, 0);

const conversation = boot({ user: { learningMode: 'conversation', goals: ['living'] } });
assert.equal(conversation.window.UserExperienceProfileService.segment(), 'conversation');
assert.equal(conversation.window.FeaturePriorityService.distribution()['conversation-scenario'], 50);

const suggestions = beginner.window.SmartSearchService.suggest('은/는', 20);
for (const type of ['lesson', 'grammar', 'vocabulary', 'sentence', 'mistake', 'saved']) assert.ok(suggestions.some((item) => item.type === type), `search must include ${type}`);
const lesson = suggestions.find((item) => item.type === 'lesson');
assert.equal(beginner.window.SmartSearchService.open(lesson), true);
assert.equal(beginner.state.currentView, 'lesson');
assert.equal(beginner.state.selectedLessonPreview, 'topik-1-01');

const networkError = beginner.window.UXErrorService.explain(new Error('fetch timeout'));
assert.equal(networkError.type, 'network');
assert.ok(networkError.cause.length > 10);
assert.ok(networkError.resolution.length > 10);
assert.notEqual(networkError.cause.toLowerCase(), 'unknown error');

beginner.window.AccessibilityPreferencesService.set({ fontScale: 'large', contrast: 'high', reduceMotion: true });
assert.equal(beginner.window.document.documentElement.dataset.fontScale, 'large');
assert.equal(beginner.window.document.documentElement.dataset.contrast, 'high');
assert.equal(beginner.window.document.documentElement.dataset.reduceMotion, 'true');
assert.equal(beginner.values.get('product-ux')['ux-user'][0].fontScale, 'large');

for (const route of ['home', 'command-center', 'search', 'ux-settings', 'onboarding-goals', 'onboarding-level']) assert.equal(typeof beginner.window.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
assert.match(beginner.window.KLEARN_EXTRA_VIEWS.home(), /Tiếp tục Hangul/);
assert.doesNotMatch(beginner.window.KLEARN_EXTRA_VIEWS.home(), /TOPIK Analytics/);
assert.match(beginner.window.KLEARN_EXTRA_VIEWS['onboarding-goals'](), /1 \/ 2/);
assert.match(beginner.window.KLEARN_EXTRA_VIEWS['onboarding-level'](), /2 \/ 2/);
assert.doesNotMatch(beginner.window.KLEARN_EXTRA_VIEWS['onboarding-level'](), /placement test/i);

assert.match(appSource, /productUx: 'klearn_product_ux'/);
assert.match(appSource, /STORAGE_KEYS\.productUx/);
assert.match(indexSource, /class="skip-link" href="#app"/);
assert.match(indexSource, /product-ux\.css\?v=1/);
assert.match(indexSource, /data\/product-ux\.js\?v=1/);
assert.match(workerSource, /klearn-v56/);
assert.match(workerSource, /content\/product-ux\.json/);

console.log('product UX: personalized segments, priorities, disclosure, smart search, actionable errors, short onboarding, accessibility and offline assets passed');
