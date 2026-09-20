#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { audit } = require('../scripts/vercel-function-audit');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/topik-strategy-coaching-system.json'));
const source = read('data/topik-strategy-coaching-system.js');

function boot() {
  const values = new Map(); const started = []; const scheduled = []; const cached = [];
  const state = { currentUser: { id: 'p81-user', currentTopikLevel: 2, targetTopikLevel: 4, studyMinutesPerDay: 30 }, currentView: 'topik', p81Topik: null };
  const attempts = [90, 88, 86, 84].map((score, index) => ({ id: `a${index}`, source: 'p80-topik-intelligence', level: 'TOPIK II', mode: 'mock', percentage: score, completedAt: `2026-09-${String(10 + index).padStart(2, '0')}T00:00:00Z`, questionTypeBreakdown: { 'main-idea': score, inference: score - 20 }, skillBreakdown: { listening: score - 4, reading: score, writing: score - 30 } }));
  values.set('examAttempts', { 'p81-user': { history: attempts } });
  values.set('errors', { 'p81-user': [{ id: 'e1', type: 'topik-inference', question: 'inference', count: 3, resolved: false }] });
  const storage = { get(key, fallback) { return values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback); }, set(key, value) { values.set(key, structuredClone(value)); return true; } };
  const userScoped = (key) => storage.get(key, {})['p81-user'] || [];
  const saveUserScoped = (key, items) => { const all = storage.get(key, {}); all['p81-user'] = structuredClone(items); storage.set(key, all); };
  const document = { querySelector: () => null, querySelectorAll: () => [], documentElement: { requestFullscreen: async () => true } };
  const questionBank = [
    { id: 'r1', level: 'TOPIK II', section: 'reading', questionType: 'main-idea', questionNumber: 50 },
    { id: 'r2', level: 'TOPIK II', section: 'reading', questionType: 'inference', questionNumber: 34 },
    { id: 'w51', level: 'TOPIK II', section: 'writing', questionType: 'grammar', questionNumber: 51 }
  ];
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    P80TopikConfigService: { get: () => ({ mockTests: [{ id: 'mock-i', level: 'TOPIK I' }, { id: 'mock-ii', level: 'TOPIK II' }] }) },
    P80TopikQuestionBankService: { all(filters = {}) { return questionBank.filter((item) => !filters.level || item.level === filters.level).filter((item) => !filters.section || item.section === filters.section).filter((item) => !filters.questionType || item.questionType === filters.questionType).map((item) => structuredClone(item)); } },
    P80TopikExamService: { start(input) { started.push(structuredClone(input)); return input; }, startMock(id) { started.push({ mockId: id }); return { id }; } },
    ErrorNotebookService: { all: () => userScoped('errors'), top: () => userScoped('errors') },
    AdaptiveLearningEngine: { priorities: () => [{ id: 'inference', score: 8 }, { id: 'writing', score: 7 }] },
    GoalTrackingService: { getGoal: () => ({ targetLevel: 4, deadline: '2026-12-19', dailyMinutes: 30 }), saveGoal(goal) { window.savedGoal = goal; return goal; } },
    AICoachService: { request: async () => 'Ưu tiên inference; đây không phải dự báo chính thức.' },
    caches: { open: async () => ({ addAll: async (assets) => cached.push(...assets) }) },
    KLEARN_APP: {
      state, STORAGE_KEYS: { examAttempts: 'examAttempts', offlinePacks: 'offlinePacks' }, storage,
      escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {}, userScoped, saveUserScoped,
      updateCurrentUser(changes) { Object.assign(state.currentUser, changes); }, CloudSyncService: { schedule(label) { scheduled.push(label); } }
    },
    fetch: async () => ({ ok: true, json: async () => config }), console
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval, fetch: window.fetch, FormData: class {} };
  vm.runInNewContext(source, context); window.P81TopikStrategyConfigService.hydrate(config);
  return { window, state, values, started, cached, scheduled };
}

(async () => {
  assert.equal(config.schemaVersion, 1);
  assert.equal(config.contentPolicy.sourceType, 'ORIGINAL_EDUCATIONAL_CONTENT');
  assert.equal(config.strategies.length, 23);
  assert.equal(config.writingTemplates.length, 8);
  assert.deepEqual(new Set(config.strategies.map((item) => item.section)), new Set(['reading', 'listening', 'writing']));
  assert.deepEqual(config.strategies.filter((item) => item.section === 'writing').map((item) => item.practiceReference.questionNumber), [51, 52, 53, 54]);
  for (const strategy of config.strategies) {
    for (const field of ['id', 'title', 'section', 'questionType', 'level', 'explanation', 'example', 'commonMistakes', 'recommendedApproach', 'practiceReference', 'provenance']) assert.ok(strategy[field], `${strategy.id}.${field} missing`);
    assert.equal(strategy.example.label, 'Practice Example');
    assert.equal(strategy.provenance.sourceType, 'PRACTICE_EXAMPLE');
    assert.equal(strategy.provenance.examYear, null);
    assert.doesNotMatch(JSON.stringify(strategy), /official topik question/i);
  }

  const rt = boot(); const w = rt.window;
  const services = ['P81TopikStrategyConfigService','P81StrategyLibraryService','P81StrategyPracticeService','P81WritingTemplateService','P81WritingSelfCheckService','P81TimeManagementService','P81ExamSimulationService','P81GoalPlannerService','P81TopikCoachService','P81StrategyAdaptationService','P81StrategyMasteryService','P81StrategyDashboardService','P81ReadinessService','P81OfflineStrategyService'];
  services.forEach((name) => assert.ok(w[name], `${name} missing`));
  assert.equal(w.P81StrategyLibraryService.all({ level: 'TOPIK I' }).every((item) => item.level === 'TOPIK I'), true);
  assert.equal(w.P81StrategyLibraryService.all({ section: 'writing' }).length, 4);
  assert.equal(w.P81StrategyLibraryService.all({ query: 'distractor' }).length, 1);

  const practice = w.P81StrategyPracticeService.start('p81-tii-reading-main-idea', 5);
  assert.equal(practice.mode, 'strategy-p81-p81-tii-reading-main-idea');
  assert.equal(practice.questions[0].id, 'r1');
  const mastery = w.P81StrategyMasteryService.get('p81-tii-reading-main-idea');
  assert.equal(mastery.status, 'mastered'); assert.equal(mastery.attempts, 4); assert.match(mastery.basis, /XP is not used/);
  assert.ok(['not_started','learning','practicing','reliable','mastered'].includes(w.P81StrategyMasteryService.get('p81-tii-writing-51').status));

  const writing = w.P81WritingSelfCheckService.check('정보가 중요하다. 따라서 여러 출처를 확인해야 한다.', { topic: true, structure: true, grammar: true, vocabulary: true, cohesion: true, spelling: true, logic: true, minimumLength: 20 });
  assert.equal(writing.total, 8); assert.equal(writing.passed, 8); assert.equal(writing.readyToReview, true); assert.match(writing.notice, /không thay thế giám khảo/);
  const customTime = w.P81TimeManagementService.customize('topik-i', { listening: 35, reading: 50, review: 10, buffer: 5 });
  assert.equal(customTime.totalMinutes, 100); assert.equal(customTime.customized, true);
  w.P81TimeManagementService.start(1); assert.equal(w.P81TimeManagementService.status().running, true); w.P81TimeManagementService.stop();

  assert.deepEqual(structuredClone(w.P81ExamSimulationService.contract()), { reusesP80:true, timer:true, navigation:true, sectionProgress:true, hintsDuringExam:false, answersDuringExam:false, aiDuringExam:false, reviewAfterSubmit:true });
  await w.P81ExamSimulationService.start('TOPIK II'); assert.equal(rt.started.at(-1).mockId, 'mock-ii');
  w.P81GoalPlannerService.save({ currentLevel: 2, targetLevel: 4, deadline: '2026-12-19', dailyMinutes: 30 });
  assert.equal(w.savedGoal.targetLevel, 4); assert.equal(rt.state.currentUser.targetTopikLevel, 4);
  const plan = w.P81GoalPlannerService.weekly(14); assert.equal(plan.weeks.length, 2); assert.equal(plan.independentScheduler, false); assert.match(plan.source, /AdaptiveLearningEngine/);

  const adapted = w.P81StrategyAdaptationService.recommend(); assert.ok(adapted.length >= 1); assert.ok(adapted.some((item) => item.strategy.questionType === 'inference'));
  const diagnosis = w.P81TopikCoachService.diagnosis(7); assert.equal(diagnosis.official, false); assert.equal(diagnosis.plan.days, 7); assert.match(diagnosis.source, /Error Notebook/);
  const ai = await w.P81TopikCoachService.explain(7); assert.equal(ai.fallback, false); assert.match(ai.ai, /không phải dự báo chính thức/);
  const readiness = w.P81ReadinessService.calculate('TOPIK II'); assert.equal(readiness.attempts, 4); assert.ok(readiness.score > 0); assert.equal(readiness.evidence.length, 4); assert.match(readiness.notice, /không phải cam kết/);
  const dashboard = w.P81StrategyDashboardService.summary(); assert.equal(dashboard.sections.writing.total, 4); assert.ok(dashboard.next);
  const offline = await w.P81OfflineStrategyService.download('p81-topik-ii-writing'); assert.equal(offline.status, 'downloaded'); assert.equal(offline.cached, true); assert.equal(offline.learningDataPreserved, true); assert.ok(rt.cached.includes('./content/topik-strategy-coaching-system.json'));

  const functionAudit = audit(); assert.equal(functionAudit.count, 7);
  const combined = [source, read('data/route-loader.js'), read('sw.js'), read('app.js'), read('topik-strategy-coaching-system.css')].join('\n');
  assert.match(combined, /topik-strategy-p81/); assert.match(combined, /p80Topik/); assert.match(combined, /P80TopikExamService/); assert.match(combined, /GoalTrackingService/); assert.match(combined, /AdaptiveLearningEngine/); assert.match(combined, /ErrorNotebookService/); assert.match(combined, /AICoachService/); assert.match(combined, /STORAGE_KEYS\.offlinePacks/); assert.match(combined, /@media\(max-width:600px\)/);
  assert.doesNotMatch(combined, /(service_role|private_key|client_secret)\s*[:=]/i);
  console.log('P81 unit: 23 strategies, reading/listening/writing, templates, self-check, flexible timer, P80 simulation, Adaptive goal/coach, evidence mastery/readiness, offline packs, security and 7-function budget passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
