const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'future-language-platform.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'future-language-platform.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p40_future_global_language_platform.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'future-language-platform.css'), 'utf8');

function boot(userId = 'learner-a', shared = new Map()) {
  const state = { currentUser: { id: userId, fullName: userId, onboardingCompleted: true }, currentView: 'profile' };
  const scoped = (key) => shared.get(key)?.[userId] || [];
  const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const profile = { activeLanguage: 'ko', languages: { ko: { languageId: 'ko', status: 'learning', currentLevel: 'TOPIK1', targetLevel: 'TOPIK2' } } };
  const memory = { goal: 'TOPIK 2', learningStyle: 'visual', weakSkills: ['listening'] }; const calls = [];
  const languages = [
    { id: 'ko', locale: 'ko-KR', nativeName: '한국어', contentStatus: 'active', script: 'Hangul' },
    { id: 'ja', locale: 'ja-JP', nativeName: '日本語', contentStatus: 'foundation', script: 'Kana + Kanji' },
    { id: 'zh', locale: 'zh-CN', nativeName: '中文', contentStatus: 'foundation', script: 'Han' },
    { id: 'en', locale: 'en-US', nativeName: 'English', contentStatus: 'foundation', script: 'Latin' }
  ];
  const normalize = (value) => ({ korean: 'ko', japanese: 'ja', chinese: 'zh', english: 'en' })[String(value).toLowerCase()] || String(value).toLowerCase();
  const courses = [{ id: 'ko-approved', language: 'ko', title: { vi: 'Tiếng Hàn' }, provider: 'TamHoanq', difficulty: 'TOPIK 1', status: 'approved', verified: true }, { id: 'ja-draft', language: 'ja', title: 'Japanese', status: 'draft', verified: false }];
  const window = {
    document, navigator: {}, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    LanguageCoreService: { get: (id) => languages.find((item) => item.id === normalize(id)) || null, normalize, levelSystem: (id) => ({ ko: 'TOPIK', ja: 'JLPT', zh: 'HSK', en: 'CEFR' })[id] },
    LanguageProfileService: { get: () => profile, active: () => profile.activeLanguage, setActive: (id) => { profile.activeLanguage = id; return profile; }, add: (id, value) => { profile.languages[id] = { ...(profile.languages[id] || {}), ...value, languageId: id }; calls.push(['profile', id]); return profile; } },
    LanguageVocabularyEngine: {}, GrammarFrameworkService: {}, AudioFrameworkService: {},
    LanguageComparisonService: { compare: (input) => ({ ...input, createdAt: new Date().toISOString() }) },
    AILearningMemoryService: { snapshot: () => memory, remember: (value) => { Object.assign(memory, value); calls.push(['memory', value.targetLanguage]); return memory; } },
    AICompanionService: { supportedLanguages: () => ['ko', 'ja', 'zh'] }, ImmersiveProgressService: {},
    AIStudyAdvisorService: { recommend: ({ language }) => ({ language, nextAction: 'Review' }) }, AIContentExplanationService: {}, AIPracticeCreatorService: {},
    TranslationService: { translate: ({ text, sourceLanguage, targetLanguage }) => text ? { sourceText: text, sourceLanguage, targetLanguage, korean: '안녕하세요', translation: 'Xin chào', local: true } : null },
    CourseMarketplaceService: { catalog: () => courses, accessible: () => true, enroll: (id) => ({ courseId: id }) },
    GlobalSearchService: { search: () => ({ studyTools: [] }) },
    KLEARN_APP: { state, STORAGE_KEYS: { futureLanguage: 'future-language' }, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String, userScoped: scoped, saveUserScoped: saveScoped, CloudSyncService: { schedule: (reason) => calls.push(['sync', reason]) } }
  };
  const context = { window, document, console, Date, Intl, URL, String, Number, Boolean, Object, Array, Math, Set, Map, RegExp, Promise, JSON, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.FutureLanguageContentService.hydrate(content);
  return { window, state, shared, calls };
}

(async () => {
  assert.equal(content.verified, true);
  assert.equal(content.reviewStatus, 'approved');
  assert.deepEqual(content.languages.map((item) => item.id), ['ko', 'ja', 'zh', 'en']);
  assert.equal(content.translation.continuousBackgroundListening, false);
  assert.equal(content.translation.storesRawAudio, false);
  assert.ok(content.forbiddenWearableData.includes('health'));

  const shared = new Map(); const a = boot('learner-a', shared); const app = a.window;
  assert.equal(app.UniversalLanguageEngine.languages().length, 4);
  assert.equal(app.UniversalLanguageEngine.active('ko'), true);
  assert.equal(app.UniversalLanguageEngine.active('ja'), false, 'foundation pack must not be presented as launched');
  assert.equal(app.UniversalLanguageEngine.adapter('en').levelSystem, 'CEFR');
  assert.equal(app.UniversalLanguageEngine.setActive('ja').activeLanguage, 'ja');

  assert.equal(app.CrossLanguageLearningService.create({ sourceLanguage: 'ko', targetLanguage: 'ko', mode: 'compare' }), null);
  const session = app.CrossLanguageLearningService.create({ sourceLanguage: 'vi', targetLanguage: 'ko', mode: 'compare', source: 'Xin chào', target: '안녕하세요' });
  assert.equal(session.contentStored, false);
  assert.equal(session.completedItems, 1);
  const persisted = JSON.stringify(shared.get('future-language')['learner-a']);
  assert.doesNotMatch(persisted, /Xin chào|안녕하세요/, 'raw cross-language content must not be persisted');

  app.UniversalLanguageEngine.setActive('ko');
  const brain = app.PersonalLanguageBrainService.remember('ko', { goal: 'TOPIK 3', learningStyle: 'audio', currentLevel: 'TOPIK1', targetLevel: 'TOPIK3' });
  assert.equal(brain.goal, 'TOPIK 3');
  assert.ok(a.calls.some((item) => item[0] === 'profile'), 'existing LanguageProfileService must be reused');
  assert.ok(a.calls.some((item) => item[0] === 'memory'), 'existing AI memory must be reused');
  assert.equal(app.PersonalLanguageBrainService.snapshot().rawHistoryStored, false);

  assert.equal(app.AIImmersionWorldService.capability('ko').available, true);
  assert.equal(app.AIImmersionWorldService.capability('ja').available, false);
  assert.equal(app.AIImmersionWorldService.start('ko').route, 'immersive-world');
  assert.equal(a.state.currentView, 'immersive-world');
  assert.equal(await app.ARLanguageLearningService.supported(), false);
  assert.equal((await app.ARLanguageLearningService.start()).route, 'korean-document-assistant');
  assert.equal(app.WearableLanguageService.available(), false);
  assert.equal((await app.WearableLanguageService.connect()).status, 'consent-required');
  app.WearableLanguageService.setOptIn(true);
  assert.equal((await app.WearableLanguageService.connect()).status, 'bridge-unavailable');

  const translated = app.RealTimeTranslationAssistantService.translate({ text: 'Xin chào', sourceLanguage: 'vi', targetLanguage: 'ko' });
  assert.equal(translated.status, 'translated');
  assert.equal(translated.rawAudioStored, false);
  assert.doesNotMatch(JSON.stringify(shared.get('future-language')['learner-a']), /Xin chào/, 'translation history must store metrics only');
  assert.equal(app.RealTimeTranslationAssistantService.capabilities().continuousBackgroundListening, false);

  assert.equal(app.GlobalCourseMarketplaceService.catalog().length, 1);
  assert.equal(app.GlobalCourseMarketplaceService.catalog('ja').length, 0, 'draft marketplace content must remain hidden');
  const routed = app.LanguageAIOperatingSystem.route('study-plan', { languageId: 'ko' });
  assert.equal(routed.status, 'routed'); assert.equal(routed.rawHistoryIncluded, false); assert.equal(routed.output.nextAction, 'Review');
  assert.equal(app.LanguageAIOperatingSystem.route('unknown').status, 'unsupported-intent');

  const b = boot('learner-b', shared);
  assert.equal(b.window.CrossLanguageLearningService.history().length, 0, 'future language history must remain user-scoped');
  assert.equal(b.window.PersonalLanguageBrainService.snapshot().brain.ko, undefined, 'language brain must remain user-scoped');

  for (const route of ['future-language-platform','cross-language-lab','language-brain','future-integrations','global-course-marketplace']) assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} registered`);
  assert.equal(app.GlobalSearchService.search('đa ngôn ngữ').studyTools[0].route, 'future-language-platform');
  for (const table of ['language_platform_capabilities','language_cross_learning_sessions','language_device_connections','language_translation_sessions','language_ai_operation_logs']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS`);
  assert.match(migration, /raw_content_stored boolean not null default false check \(raw_content_stored = false\)/);
  assert.match(migration, /raw_audio_stored boolean not null default false check \(raw_audio_stored = false\)/);
  assert.match(migration, /transcript_stored boolean not null default false check \(transcript_stored = false\)/);
  assert.match(migration, /tokens, health, location, contacts, microphone and raw learning content are prohibited/);
  assert.match(migration, /browser clients cannot forge quality or usage records/);
  assert.match(index, /future-language-platform\.css\?v=1/);
  assert.match(index, /data\/future-language-platform\.js\?v=1/);
  assert.match(index, /app\.js\?v=58/);
  assert.match(worker, /klearn-v72/);
  assert.match(worker, /content\/future-language-platform\.json/);
  assert.match(appSource, /'future-language-platform', 'cross-language-lab', 'language-brain', 'future-integrations', 'global-course-marketplace'/);
  assert.match(css, /@media\(max-width:600px\)/);
  console.log('future language platform: universal engine, cross-language, personal brain, immersion, AR fallback, wearable consent, translation privacy, global marketplace, AI OS routing and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
