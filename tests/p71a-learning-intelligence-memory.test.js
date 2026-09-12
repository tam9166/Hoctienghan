const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function createApp() {
  const values = new Map();
  const state = { currentUser: { id: 'learner-a', studyMinutesPerDay: 25, currentTopikLevel: 1 }, currentView: 'profile' };
  const progress = { foundation: { learnedCharacters: ['ㅏ', 'ㄱ'], updatedAt: '2026-08-01T00:00:00Z' }, lessonProgress: { first: { completed: true, score: 90 } }, skills: { vocabulary: 78, grammar: 55, listening: 42, reading: 68, speaking: 61, writing: 58 }, pronunciationAttempts: [{ score: 47 }], writingSubmissions: [{ score: 62 }], stats: { streak: 3 } };
  const srs = [{ wordId: 'school', mastery: 90, status: 'mastered' }, { wordId: 'student', mastery: 50, status: 'review' }];
  const history = [
    { id: 'h1', completedAt: '2026-09-10T20:00:00Z', durationSeconds: 900, skill: 'listening', percentage: 45, skillBreakdown: { listening: 45, grammar: 54 } },
    { id: 'h2', completedAt: '2026-09-11T20:30:00Z', durationSeconds: 1200, skill: 'reading', percentage: 70, skillBreakdown: { reading: 70, vocabulary: 76 } }
  ];
  const userScoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, items) => { const all = values.get(key) || {}; all[state.currentUser.id] = items; values.set(key, all); };
  const AITutorService = { context: () => ({ currentTopikLevel: 1, userLanguage: 'vi' }) };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { longTermLearningMemory: 'p71-memory', achievements: 'achievements' },
      userScoped,
      saveUserScoped,
      getUserProgress: () => progress,
      getUserSrs: () => srs,
      LearnerProfileService: { get: () => ({ skillScores: { ...progress.skills }, weakSkills: ['listening', 'grammar'], studyMinutesPerDay: 25 }) },
      PracticeService: { getHistory: () => history },
      AITutorService,
      CloudSyncService: { schedule() {} },
      setView(view) { state.currentView = view; },
      render() {}, toast() {}, escapeHtml: String
    },
    ErrorNotebookService: { top: () => [{ id: 'e1', question: '은/는 và 이/가', count: 5, updatedAt: '2026-09-11T00:00:00Z', resolved: false }] },
    KLEARN_EXTRA_VIEWS: {},
    KLEARN_AFTER_RENDER: null,
    addEventListener() {},
    document: null
  };
  window.window = window;
  vm.runInNewContext(read('data/learning-intelligence-memory.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, Set, Map, FormData: class {} });
  return { window, state, values, progress, srs, history, AITutorService };
}

const originalApp = createApp();
const w = originalApp.window;

for (const service of ['LongTermLearningMemoryService', 'FullLearningDiagnosticService', 'PersonalLearningPrescriptionService', 'LearningGoalSimulatorService', 'LearningIntelligenceAIContextService']) assert.ok(w[service], `${service} missing`);

const types = new Set(w.LongTermLearningMemoryService.all().map((item) => item.type));
for (const type of ['milestone', 'achievement', 'weakness_snapshot', 'learning_pattern', 'improvement_snapshot']) assert.equal(types.has(type), true, `${type} not captured`);
assert.equal(Number.isInteger(w.LongTermLearningMemoryService.summary().learningPattern.preferredHour), true);
assert.deepEqual(originalApp.progress.lessonProgress, { first: { completed: true, score: 90 } });
assert.equal(originalApp.srs.length, 2);

const diagnostic = w.FullLearningDiagnosticService.run({ scores: { pronunciation: 51 } });
assert.deepEqual(Object.keys(diagnostic.skills), ['vocabulary', 'grammar', 'listening', 'reading', 'speaking', 'writing', 'pronunciation']);
assert.equal(diagnostic.weakest, 'listening');
assert.ok(diagnostic.coverage === 100 && diagnostic.skills.listening.evidenceCount >= 2);
assert.equal(diagnostic.skills.pronunciation.sources.includes('placement-assessment'), true);

const prescription = w.PersonalLearningPrescriptionService.create(14);
assert.equal(prescription.days, 14);
assert.equal(prescription.phases[0].fromDay, 1);
assert.equal(prescription.phases.at(-1).toDay, 14);
assert.ok(prescription.priorities.includes('listening'));

const simulation = w.LearningGoalSimulatorService.simulate('topik', 12, 'TOPIK 4');
assert.equal(simulation.months, 12);
assert.equal(simulation.timeline[0].month, 1);
assert.equal(simulation.timeline.at(-1).month, 12);
assert.match(simulation.disclaimer, /không phải cam kết/);

const aiContext = originalApp.AITutorService.context('Tôi không hiểu câu này');
for (const field of ['learningMemorySummary', 'diagnosticSummary', 'learningPrescription', 'goalSimulation', 'mistakePatterns']) assert.ok(Object.hasOwn(aiContext, field), `${field} absent from AI context`);
assert.equal(aiContext.mistakePatterns[0].count, 5);
assert.doesNotMatch(JSON.stringify(aiContext), /password|token|secret|credential|private information/i);

const learnerACount = w.LongTermLearningMemoryService.all().length;
originalApp.state.currentUser = { id: 'learner-b', studyMinutesPerDay: 10 };
assert.equal(w.LongTermLearningMemoryService.all().length, 0);
w.LongTermLearningMemoryService.captureSnapshot();
assert.ok(w.LongTermLearningMemoryService.all().length > 0);
originalApp.state.currentUser = { id: 'learner-a', studyMinutesPerDay: 25 };
assert.equal(w.LongTermLearningMemoryService.all().length, learnerACount);

const appSource = read('app.js');
const aiSource = read('data/ai-infrastructure.js');
const loader = read('data/route-loader.js');
const worker = read('sw.js');
const migration = read('supabase/migrations/20260912_p71a_learning_intelligence_memory.sql');
const report = read('docs/P71A_LEARNING_INTELLIGENCE_REPORT.md');
assert.match(appSource, /longTermLearningMemory: 'klearn_long_term_learning_memory'/);
assert.match(appSource, /STORAGE_KEYS\.longTermLearningMemory/);
assert.match(appSource, /\[STORAGE_KEYS\.longTermLearningMemory\]: 500/);
assert.match(aiSource, /'learningMemorySummary'/);
assert.match(aiSource, /'diagnosticSummary'/);
assert.match(loader, /learning-intelligence-memory\.css\?v=1/);
assert.match(loader, /data\/learning-intelligence-memory\.js\?v=1/);
assert.match(worker, /klearn-v86/);
assert.match(worker, /data\/learning-intelligence-memory\.js\?v=1/);
for (const table of ['learning_memory_events', 'learning_diagnostic_reports', 'learning_prescriptions', 'learning_goal_simulations']) {
  assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
}
assert.ok((migration.match(/user_id = auth\.uid\(\)/g) || []).length >= 8);
assert.match(migration, /Existing progress, SRS, mastery, adaptive, auth and learning_sync tables are untouched/);
for (const heading of ['# P71A LEARNING INTELLIGENCE REPORT', '## Memory System', '## Diagnostic System', '## Learning Prescription', '## Goal Simulator', '## AI Context Update', '## Testing', '## Git']) assert.match(report, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.match(report, /feat: add learning intelligence and personal memory system/);

console.log('P71A learning memory, 7-skill diagnostic, prescription, goal simulator, AI privacy, user isolation and integration passed');
