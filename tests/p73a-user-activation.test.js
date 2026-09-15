const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content/product-ux.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'data/product-ux.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'product-ux.css'), 'utf8');

const state = { currentUser: { id: 'p73', fullName: 'Minh An', goals: [], level: 'Level 0', learningTrack: 'foundation', onboardingCompleted: false, onboardingStep: 'goals', studyMinutesPerDay: 15, createdAt: new Date().toISOString() }, currentView: 'onboarding-goals' };
const values = new Map([['product', {}], ['errors', {}], ['handwriting', { p73: [] }]]);
let progress = { stats: { lessonsCompleted: 0, streak: 1 }, foundation: { learnedCharacters: [], completedActivities: [], firstWords: [] } };
let srs = [];
const userScoped = (key) => values.get(key)?.p73 || [];
const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all.p73 = list; values.set(key, all); };
const document = { documentElement: { lang: 'vi', dataset: {} }, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null };
const window = { document, addEventListener: () => {}, location: { reload: () => {} }, KLEARN_EXTRA_VIEWS: {}, GlobalSearchService: { search: () => ({}) }, KLEARN_APP: { state, STORAGE_KEYS: { productUx: 'product', errors: 'errors', handwriting: 'handwriting' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: (value) => String(value ?? ''), normalizeSearch: (value) => String(value || '').toLowerCase(), getUserProgress: () => progress, getUserSrs: () => srs, userScoped, saveUserScoped, updateCurrentUser: (changes) => Object.assign(state.currentUser, changes), LearnerProfileService: { get: () => ({}) }, VocabularyService: { dueCards: () => [] }, PracticeService: { statistics: () => ({ completed: 0 }) } } };
const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }), setTimeout, clearTimeout };
vm.createContext(context); vm.runInContext(source, context); window.ProductUxContentService.hydrate(content);

assert.deepEqual(content.onboarding.goals.map((item) => item.id), ['topik', 'conversation', 'study', 'work', 'travel']);
assert.equal(content.onboarding.levels.length, 3);
assert.deepEqual(content.onboarding.minutes, [5, 15, 30]);
assert.equal(window.FirstSevenDaysService.snapshot().current.day, 1);
assert.match(window.KLEARN_EXTRA_VIEWS.home(), /Hôm nay chỉ cần hoàn thành một bước nhỏ/);
assert.doesNotMatch(window.KLEARN_EXTRA_VIEWS.home(), /AI|Analytics|TamHoanq Score|League/);

progress.foundation.learnedCharacters = ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㅗ'];
assert.equal(window.FirstSevenDaysService.snapshot().current.day, 2);
progress.foundation.learnedCharacters.push('ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ');
progress.foundation.completedActivities = ['syllable-ga', 'batchim-basic', 'reading-first'];
values.set('handwriting', { p73: [{ character: '가', completed: true }] });
assert.equal(window.FirstSevenDaysService.snapshot().current.day, 7);
progress.foundation.completedActivities.push('first-sentence');
assert.equal(window.FirstSevenDaysService.snapshot().completed, 7);
srs = [{ id: 'word', status: 'learning', reviewCount: 1 }];
assert.match(window.FirstSevenDaysService.progressStory(), /ghi nhớ 1 từ/);

const registerMarkup = appSource.slice(appSource.indexOf('function registerView()'), appSource.indexOf('function loginView()'));
assert.match(registerMarkup, />Tạo tài khoản</);
assert.match(registerMarkup, /Tiếp tục tiến trình/);
assert.match(registerMarkup, /Bắt đầu mới/);
assert.doesNotMatch(registerMarkup, />[^<]*(?:local|cloud|sync|database)[^<]*</i);
assert.match(appSource, /createDefaultAccount/);
assert.match(appSource, /EXISTING_PROGRESS/);
assert.match(appSource, /skipHydrate: true/);
assert.match(appSource, /onboardingStep === 'time'|step === 'time'/);
assert.match(css, /\.p73-beginner-home/);
assert.match(css, /@media \(max-width: 599px\)/);
console.log('P73A unit: unified account CTA, safe legacy recovery, 3-step onboarding, evidence-based seven-day journey, beginner Home and progress story passed');
