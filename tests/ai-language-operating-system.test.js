const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'ai-language-operating-system.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'ai-language-operating-system.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'ai-language-os.css'), 'utf8');

function boot() {
  const values = new Map(); const sync = []; const agentCalls = []; let memoryWrites = 0; let aiAllowed = true;
  const state = { currentUser: { id: 'p60-user', level: 'TOPIK 1', studyMinutesPerDay: 20 }, currentView: 'ai-language-os', srsData: [] };
  const userScoped = (key) => { const all = values.get(key) || {}; return Array.isArray(all[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { aiLanguageOs: 'ai-language-os' }, userScoped, saveUserScoped,
      CloudSyncService: { schedule: (event) => sync.push(event) },
      LearnerProfileService: { get: () => ({ currentTopikLevel: 1, targetTopikLevel: 2, goal: 'TOPIK 2', weakSkills: ['listening'], frequentErrors: ['은/는'], learningStyle: 'audio', explanationStyle: 'examples', dueSrsCount: 6, skillScores: { listening: 52, grammar: 64, vocabulary: 76 } }) },
      PracticeService: { getHistory: () => [1, 2, 3, 4].map((id) => ({ id, percentage: 70 + id, completedAt: new Date(Date.now() - id * 86400000).toISOString() })) },
      VocabularyService: { dueCards: () => Array(6).fill({}) }, getUserProgress: () => ({ skills: { listening: 52, grammar: 64, vocabulary: 76 }, dueSrsCount: 6 }),
      PrivacyPreferenceService: { allows: () => aiAllowed }, setView: () => {}, render: () => {}, toast: () => {}, escapeHtml: String
    },
    AILearningMemoryService: {
      snapshot: () => ({ level: 'TOPIK 1', goal: 'TOPIK 2', weakSkills: ['listening'], frequentErrors: ['은/는'], learningStyle: 'audio', preferredExplanation: 'examples', targetLanguage: 'ko' }),
      remember: (changes) => { memoryWrites += 1; return changes; }
    },
    LanguageProfileService: { active: () => 'ko', getLanguage: () => ({ currentLevel: 'TOPIK 1', targetLevel: 'TOPIK 2' }) },
    LanguageCoreService: { all: () => [{ id: 'ko', nativeName: '한국어', contentStatus: 'active' }, { id: 'ja', nativeName: '日本語', contentStatus: 'foundation' }, { id: 'zh', nativeName: '中文', contentStatus: 'foundation' }, { id: 'en', nativeName: 'English', contentStatus: 'foundation' }] },
    DailyPlanService: { build: () => ({ minutes: 20, tasks: [{ id: 'review', type: 'srs', route: 'review', minutes: 8, title: 'Ôn từ', reason: 'Đến hạn' }, { id: 'listen', type: 'listening', route: 'listening-studio', minutes: 12, title: 'Luyện nghe', reason: 'Kỹ năng yếu' }] }) },
    AdvancedContentService: {
      load: async () => null,
      publicItems: () => [{ id: 'approved-listening', type: 'lesson', title: { vi: 'Nghe câu ngắn' }, level: 'TOPIK 1', skill: 'listening', status: 'approved', quality: { grammar: 95 } }, { id: 'draft-lesson', type: 'lesson', title: { vi: 'Bản nháp' }, status: 'draft' }],
      quality: (item) => item.status === 'approved' ? 95 : 20
    },
    LearningAgentOrchestratorService: { dispatch: async (request) => { agentCalls.push(request); return { status: 'pass', result: { reply: 'Hãy ôn từ trước vì có 6 mục đến hạn.', fallback: false }, quality: { score: .91, status: 'pass' } }; } },
    AIAgentAuditService: { all: () => [{ status: 'pass' }] }, AIOrchestrationService: { getMetrics: () => ({ requestCount: 2 }) },
    document: null, console,
    fetch: async () => ({ ok: true, json: async () => content })
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON, fetch: window.fetch };
  vm.createContext(context); vm.runInContext(source, context);
  return { window, values, sync, agentCalls, memoryWrites: () => memoryWrites, setAiAllowed: (value) => { aiAllowed = value; } };
}

assert.equal(content.architectureVersion, 'p60-v1');
assert.equal(content.capabilities.length, 10);
assert.deepEqual(content.supportedLanguages.map((item) => item.id), ['ko', 'ja', 'zh', 'en']);
assert.equal(content.hybrid.aiReplacesTeacher, false);
assert.equal(content.privacy.storesRawPrompt, false);
assert.equal(content.privacy.storesRawResponse, false);
assert.equal(content.curation.fabricatedCurriculumAllowed, false);
assert.equal(content.prediction.guaranteesOutcome, false);

(async () => {
  const app = boot(); const w = app.window;
  w.AILanguageOSContractService.hydrate(content);
  assert.equal(w.AILanguageOperatingSystem.version, 'p60-v1');
  assert.equal(w.AILanguageOSContractService.get().capabilities.length, 10);

  const memory = w.PersonalLanguageMemoryService.snapshot();
  assert.equal(memory.targetLanguage, 'ko');
  assert.deepEqual(Array.from(memory.weakSkills), ['listening']);
  assert.equal(memory.containsRawConversation, false);
  assert.equal(w.PersonalLanguageMemoryService.update({ goal: 'TOPIK 3' }).status, 'confirmation-required');
  assert.equal(app.memoryWrites(), 0, 'memory changed without explicit confirmation');
  assert.equal(w.PersonalLanguageMemoryService.update({ goal: 'TOPIK 3', password: 'forbidden' }, { confirmed: true }).updated, true);
  assert.equal(app.memoryWrites(), 1);

  const plan = w.AIStudyPlannerOSService.create();
  assert.equal(plan.minutes, 20); assert.equal(plan.tasks.length, 2); assert.equal(plan.evidence.dueSrsCount, 6); assert.equal(plan.aiEnhanced, false);
  assert.equal(w.AILearningAdvisorOSService.recommend().route, 'review');

  const curated = w.AIContentCuratorOSService.select();
  assert.equal(curated.length, 1); assert.equal(curated[0].id, 'approved-listening'); assert.equal(curated[0].status, 'approved');
  assert.equal(w.AIContentCuratorOSService.policy().approvedOnly, true);

  const forecast = w.AIProgressPredictionService.forecast();
  assert.ok(forecast.probability > 0 && forecast.probability <= 95); assert.equal(forecast.guaranteesOutcome, false); assert.equal(forecast.generatedBy, 'bounded-personal-forecast');
  const languages = w.AIMultiLanguageSupportService.matrix();
  assert.equal(languages.length, 4); assert.equal(languages.filter((item) => item.contentReady).length, 1); assert.equal(languages.find((item) => item.id === 'en').plannerReady, true);

  const hybrid = w.HumanAIHybridService.policy();
  assert.equal(hybrid.teacherCanOverride, true); assert.equal(hybrid.aiReplacesTeacher, false); assert.equal(hybrid.finalAuthority, 'learner-or-authorized-teacher');

  app.setAiAllowed(false);
  const disabled = await w.AIStudyPlannerOSService.explain();
  assert.equal(disabled.fallback, true); assert.equal(app.agentCalls.length, 0, 'agent called after AI opt-out');
  app.setAiAllowed(true);
  const explained = await w.GlobalLanguageAssistantOSService.run('plan');
  assert.match(explained.explanation, /6 mục đến hạn/); assert.equal(explained.advisoryOnly, true); assert.equal(app.agentCalls.length, 1);
  const improvement = w.ContinuousAIImprovementService.summary();
  assert.equal(improvement.dataMode, 'aggregate-metadata-only'); assert.equal(improvement.rawInputStored, false); assert.equal(improvement.rawResponseStored, false);
  assert.doesNotMatch(JSON.stringify(app.values.get('ai-language-os')), /6 mục đến hạn|password|TOPIK 3/);
  assert.ok(app.sync.includes('ai-language-os-metadata'));

  assert.equal(typeof w.KLEARN_EXTRA_VIEWS['ai-language-os'], 'function');
  assert.match(appSource, /aiLanguageOs: 'klearn_ai_language_os'/); assert.match(appSource, /STORAGE_KEYS\.aiLanguageOs/); assert.match(appSource, /MAIN_VIEWS\.push\('ai-language-os'\)/);
  assert.match(index, /ai-language-os\.css\?v=1/); assert.match(index, /data\/ai-language-operating-system\.js\?v=1/); assert.match(index, /data\/route-loader\.js\?v=8/); assert.match(index, /app\.js\?v=68/);
  assert.match(worker, /klearn-v82/); assert.match(worker, /content\/ai-language-operating-system\.json/); assert.match(css, /@media \(max-width: 620px\)/);
  console.log('P60 AI Language OS: memory confirmation, evidence planner, advisor, approved curation, bounded forecast, multilingual support, human authority, privacy fallback and metadata-only improvement passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
