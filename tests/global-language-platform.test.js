const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'global-language-platform.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'global-language-platform.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_global_language_platform.sql'), 'utf8');

function boot() {
  const values = new Map();
  const state = { currentUser: { id: 'language-user' }, srsData: [{ id: '학교', korean: '학교', meaningVi: 'trường học', status: 'review', mastery: 80 }] };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const value = values.get(key); return Array.isArray(value?.[state.currentUser.id]) ? value[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const window = { KLEARN_APP: { storage, state, STORAGE_KEYS: { languageProfiles: 'language-profiles' }, userScoped, saveUserScoped, CloudSyncService: { schedule: () => {} } } };
  const fetch = async () => ({ ok: true, json: async () => content });
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON, fetch };
  vm.createContext(context); vm.runInContext(source, context); return { window, state };
}

assert.equal(content.architectureOnly, true);
assert.equal(content.supportedLanguages.length, 4);
assert.deepEqual(content.examSystems.map((item) => item.id), ['topik', 'jlpt', 'hsk']);
assert.deepEqual(content.levelSystems, { ko: 'TOPIK', ja: 'JLPT', zh: 'HSK', en: 'CEFR' });

(async () => {
  const app = boot();
  const platform = app.window.LanguagePlatformService;
  assert.deepEqual(platform.core.normalize('ja-JP'), 'ja');
  assert.equal(platform.core.contentStatus('Korean'), 'active');
  assert.equal(platform.core.levelSystem('zh'), 'HSK');
  assert.equal(platform.exams.level('jlpt', 'N3'), 'N3');
  assert.equal(platform.exams.level('topik', 'N3'), null);
  const topikMapping = platform.exams.map('ko', 2); assert.equal(topikMapping.examId, 'topik'); assert.equal(topikMapping.languageId, 'ko'); assert.equal(topikMapping.level, 2); assert.equal(topikMapping.label, 'TOPIK 2');
  assert.equal(platform.courses.validate({ id: 'course-1', languageId: 'ja', units: [{ id: 'u1', lessonIds: ['l1'] }] }).valid, true);
  assert.equal(platform.courses.validate({ id: 'course-1', languageId: 'xx', units: [] }).valid, false);
  const card = platform.vocabulary.normalize({ id: '학교', korean: '학교', meaningVi: 'trường học' }, 'ko');
  assert.equal(card.languageId, 'ko');
  assert.equal(platform.vocabulary.cards('ko').length, 1);
  assert.equal(platform.vocabulary.cards('ja').length, 0);
  assert.equal(platform.grammar.normalize({ id: 'g1', languageId: 'ja', pattern: 'です', examples: [{ form: '学生です', translation: 'là học sinh' }] }).languageId, 'ja');
  assert.equal(platform.audio.normalize({ id: 'a1', languageId: 'zh', text: '你好', locale: 'zh-CN', qualityStatus: 'approved' }).locale, 'zh-CN');
  assert.deepEqual(platform.comparison.compare({ sourceLanguage: 'vi', targetLanguage: 'ko', source: 'Tôi là học sinh', target: '저는 학생이에요.' }).sourceLanguage, 'vi');
  assert.equal(platform.comparison.compare({ sourceLanguage: 'ko', targetLanguage: 'ko' }), null);
  assert.equal(platform.profiles.active(), 'ko');
  assert.equal(platform.profiles.add('ja', { targetLevel: 'N3' }).languages.ja.targetLevel, 'N3');
  assert.equal(platform.profiles.setActive('ja').activeLanguage, 'ja');
  assert.equal(platform.profiles.getLanguage('ja').status, 'planned');
  await platform.content.load();
  assert.equal(platform.content.status().architectureOnly, true);
  assert.match(appSource, /languageProfiles: 'klearn_language_profiles'/);
  assert.match(appSource, /STORAGE_KEYS\.languageProfiles/);
  assert.match(indexSource, /data\/global-language-platform\.js\?v=1/);
  assert.match(workerSource, /klearn-v51/);
  assert.match(workerSource, /global-language-platform\.json/);
  assert.match(migration, /language_profiles/);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /row level security/i);
  console.log('global language platform: core contracts, profiles, TOPIK/JLPT/HSK mapping, vocabulary, grammar, audio, comparison, content gate and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
