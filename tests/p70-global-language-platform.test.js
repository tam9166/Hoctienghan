const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const baseContent = JSON.parse(read('content/global-language-platform.json'));
const config = JSON.parse(read('content/global-language-core-v2.json'));
const koPack = JSON.parse(read('content/language-packs/ko-core.json'));

function boot(userId = 'p70-user') {
  const values = new Map(); const fetches = []; const aiCalls = [];
  const state = { currentUser: { id: userId }, currentView: 'global-language-platform', srsData: [{ id: '학교', wordId: '학교', korean: '학교', meaningVi: 'trường học', mastery: 80, status: 'review', nextReview: new Date(0).toISOString() }] };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const value = values.get(key); return Array.isArray(value?.[state.currentUser.id]) ? value[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); return list; };
  const window = { KLEARN_APP: { state, storage, STORAGE_KEYS: { languageProfiles: 'language-profiles', languageLearningState: 'language-state' }, userScoped, saveUserScoped, CloudSyncService: { schedule: () => {} }, escapeHtml: String, render() {}, setView() {}, toast() {} }, AIOrchestrationService: { request: async (value) => { aiCalls.push(value); return { reply: 'ok' }; } } };
  const fetch = async (url) => { fetches.push(String(url)); if (String(url).includes('global-language-core-v2')) return { ok: true, json: async () => config }; if (String(url).includes('ko-core')) return { ok: true, json: async () => koPack }; return { ok: true, json: async () => baseContent }; };
  const context = { window, document: undefined, fetch, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(read('data/global-language-platform.js'), context); vm.runInContext(read('data/global-language-core-v2.js'), context);
  return { window, state, values, fetches, aiCalls };
}

(async () => {
  assert.equal(config.schemaVersion, 2); assert.equal(config.reviewStatus, 'approved');
  assert.deepEqual(Object.keys(config.languages), ['ko','ja','zh','en']);
  assert.deepEqual(config.contentSchema, ['id','language','level','skill','topic','status','reviewStatus']);
  assert.equal(config.privacy.profileOwnerOnly, true); assert.equal(config.privacy.languageIsolation, true);
  const app = boot(); await app.window.GlobalLanguageCoreV2Config.load();

  const korean = app.window.LanguageLessonService.normalize({ id: 'lesson-1', topikLevel: 1, skill: 'grammar', topic: 'particles' });
  const japanese = app.window.LanguageLessonService.normalize({ id: 'lesson-1', language: 'ja', level: 'N5', skill: 'writing', topic: 'kana' });
  assert.equal(korean.language, 'ko'); assert.equal(app.window.LanguageLessonService.key(korean), 'lesson-1');
  assert.equal(app.window.LanguageLessonService.key(japanese), 'ja:lesson-1');
  assert.equal(app.window.LanguageConfigurationService.scriptType('ko'), 'syllable_block');
  assert.deepEqual(Array.from(app.window.WritingSystemFramework.systems('ja'), (item) => item.id), ['hiragana','katakana','kanji']);
  assert.equal(app.window.WritingSystemFramework.systems('zh')[0].type, 'character');
  assert.equal(app.window.WritingSystemFramework.systems('en')[0].type, 'alphabet');

  assert.equal(app.window.MultiLanguageOnboardingService.steps().length, 5);
  app.window.MultiLanguageOnboardingService.complete({ nativeLanguage: 'vi', targetLanguage: 'ko', goal: 'TOPIK 2', level: 'TOPIK 1' });
  app.window.MultiLanguageOnboardingService.complete({ nativeLanguage: 'vi', targetLanguage: 'ja', goal: 'JLPT N3', level: 'N5' });
  assert.equal(app.window.MultiLanguageProfileService.active(), 'ja');
  assert.equal(app.window.MultiLanguageProfileService.language('ko').goal, 'TOPIK 2');
  assert.equal(app.window.MultiLanguageProfileService.language('ja').goal, 'JLPT N3');
  assert.equal(app.window.MultiLanguageProfileService.configure({ nativeLanguage: 'ja', targetLanguage: 'ja' }), null);
  app.window.MultiLanguageProfileService.setProgress('ko', { overall: 70, skills: { grammar: 60 }, weakSkills: ['grammar'] });
  app.window.MultiLanguageProfileService.setProgress('ja', { overall: 20, skills: { writing: 25 }, weakSkills: ['writing'] });
  assert.equal(app.window.MultiLanguageProfileService.language('ko').progress.overall, 70);
  assert.equal(app.window.MultiLanguageProfileService.language('ja').progress.overall, 20);

  const koItem = app.window.UniversalSRSService.add('ko', { id: '은는', itemType: 'grammar', prompt: '은/는', answer: 'topic particle' });
  const jaItem = app.window.UniversalSRSService.add('ja', { id: '日', itemType: 'kanji', prompt: '日', answer: 'day' });
  assert.equal(app.window.UniversalSRSService.cards('ko').some((item) => item.korean === '학교'), true, 'legacy Korean SRS missing');
  assert.equal(app.window.UniversalSRSService.cards('ko').some((item) => item.id === koItem.id), true);
  assert.equal(app.window.UniversalSRSService.cards('ja').length, 1);
  app.window.UniversalSRSService.review('ja', jaItem.id, true);
  assert.equal(app.window.UniversalSRSService.cards('ja')[0].strength, 10);
  assert.equal(app.window.UniversalSRSService.cards('ko').find((item) => item.id === koItem.id).strength, 0);
  app.window.UniversalMasteryService.record('ko', 'lesson-1', 90); app.window.UniversalMasteryService.record('ja', 'lesson-1', 35);
  assert.equal(app.window.UniversalMasteryService.get('ko', 'lesson-1').score, 90);
  assert.equal(app.window.UniversalMasteryService.get('ja', 'lesson-1').score, 35);
  assert.equal(app.window.WritingSystemFramework.record('ja', { scriptId: 'hiragana', mode: 'stroke_order', score: 80 }).languageId, 'ja');

  assert.equal(app.window.UniversalExamFramework.forLanguage('en').length, 2);
  assert.equal(app.window.UniversalExamFramework.normalizeQuestion({ id: 'q1', examId: 'jlpt', level: 'N5', skill: 'reading', score: 1 }).languageId, 'ja');
  assert.equal(app.window.UniversalExamFramework.normalizeQuestion({ id: 'q2', examId: 'topik', level: 'N5', skill: 'reading' }), null);
  assert.equal(app.window.UniversalAdaptiveEngine.plan('ko').primarySkill, 'grammar');
  assert.equal(app.window.UniversalAdaptiveEngine.plan('ja').primarySkill, 'writing');

  const aiContext = app.window.AILanguageContextService.build('ja');
  assert.deepEqual({ native: aiContext.nativeLanguage, target: aiContext.targetLanguage, level: aiContext.level }, { native: 'vi', target: 'ja', level: 'N5' });
  await app.window.AILanguageContextService.request('Giải thích trợ từ', 'grammar', 'ja');
  assert.equal(app.aiCalls[0].language, 'vi'); assert.equal(app.aiCalls[0].context.targetLanguage, 'ja');
  assert.equal('languages' in app.aiCalls[0].context, false, 'AI received the full profile database');

  const performance = app.window.GlobalLanguagePerformanceService.simulateCatalog(100);
  assert.equal(performance.catalogCount, 100); assert.equal(performance.loadedCount, 0); assert.equal(performance.startupContentLoaded, false);
  assert.equal(app.window.GlobalLanguagePerformanceService.benchmark(1, 1).catalogPages, 1);
  const scale = app.window.GlobalLanguagePerformanceService.benchmark(10, 100); assert.equal(scale.languageMetadata, 10); assert.equal(scale.catalogPages, 5); assert.equal(scale.packsFetched, 0);
  assert.equal(app.fetches.some((url) => url.includes('ko-core')), false, 'pack loaded during startup');
  app.window.GlobalLanguageCoreV2Config.hydrate(config);
  assert.equal(app.window.LanguagePackRegistry.catalog(1, 2).items.length, 2);
  await app.window.LanguagePackRegistry.load('ko-core');
  assert.deepEqual(Array.from(app.window.LanguagePackRegistry.loaded()), ['ko-core']);
  assert.equal(await app.window.LanguagePackRegistry.load('ja-foundation'), null);
  assert.equal(app.window.MultiLanguageSearchService.search('xin chào').length, 3);
  assert.equal(app.window.CrossLanguageLearningService.compare('xin chào').entries.length, 3);
  assert.equal(app.window.CommunityLanguageService.groups('ja')[0].id, 'ja-learners');
  assert.equal(app.window.MarketLocalizationService.market('VN').interfaceLocales[0], 'vi-VN');
  assert.equal(app.window.MarketLocalizationService.paymentReady(), false);

  const originalUserState = JSON.stringify(app.window.MultiLanguageProfileService.get()); app.state.currentUser = { id: 'another-user' };
  assert.notEqual(JSON.stringify(app.window.MultiLanguageProfileService.get()), originalUserState, 'language state leaked between users');

  const appSource = read('app.js'); const aiSource = read('data/ai-infrastructure.js'); const loader = read('data/route-loader.js'); const worker = read('sw.js'); const migration = read('supabase/migrations/20260912_p70_global_language_platform.sql');
  assert.match(appSource, /languageLearningState: 'klearn_language_learning_state'/);
  assert.match(appSource, /mergeLanguageLearningState/); assert.match(appSource, /STORAGE_KEYS\.languageLearningState/); assert.match(appSource, /local = local && typeof local === 'object'/);
  for (const field of ['nativeLanguage','targetLanguage','examSystem','scriptSystem']) assert.match(aiSource, new RegExp(`'${field}'`));
  assert.match(loader, /data\/global-language-core-v2\.js\?v=1/); assert.match(loader, /global-language-core\.css\?v=1/);
  assert.match(loader, /routes\('search', \['resources', 'practical', 'context', 'content', 'competitiveContent', 'globalLanguage'\]\)/);
  assert.match(worker, /klearn-v86/); assert.match(worker, /content\/global-language-core-v2\.json/); assert.match(worker, /content\/language-packs\/ko-core\.json/);
  for (const table of ['language_learning_profiles','language_learning_items','language_writing_attempts','global_language_pack_catalog','language_content_registry']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, /user_id = auth\.uid\(\)/); assert.match(migration, /unique \(user_id, language_id, item_type, content_id\)/);
  assert.match(migration, /super admins publish language content/); assert.match(migration, /Owner-only level, goal and progress per target language/);
  assert.doesNotMatch(migration, /update\s+public\.(learning_sync|education_|user_progress)/i);
  for (const route of ['global-language-onboarding','global-writing-system','global-content-packs','global-language-search','global-adaptive-plan']) assert.equal(typeof app.window.KLEARN_EXTRA_VIEWS[route], 'function');
  console.log('P70 global language platform: core/profile/onboarding, writing, exams, isolated SRS/mastery/adaptive, minimal AI context, lazy packs, search/localization, RLS and 100-pack scale passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
