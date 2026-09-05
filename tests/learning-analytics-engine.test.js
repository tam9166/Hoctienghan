const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'learning-analytics-engine.js'), 'utf8');
const fixedNow = new Date('2026-09-06T12:00:00.000Z').getTime();

function boot(fixture = {}) {
  const scores = fixture.scores || { vocabulary: 90, grammar: 60, listening: 45, reading: 72, speaking: 66, writing: 58 };
  const srs = fixture.srs || [
    { wordId: 'school', korean: '학교', mastery: 85, correctCount: 8, wrongCount: 1, reviewCount: 9, intervalDays: 4, lastReviewed: new Date(fixedNow - 45 * 86400000).toISOString(), nextReview: new Date(fixedNow - 35 * 86400000).toISOString() },
    { wordId: 'student', korean: '학생', mastery: 82, correctCount: 8, wrongCount: 1, reviewCount: 9, intervalDays: 30, lastReviewed: new Date(fixedNow - 2 * 86400000).toISOString(), nextReview: new Date(fixedNow + 12 * 86400000).toISOString() }
  ];
  const history = fixture.history || [
    { percentage: 82, durationSeconds: 900, completedAt: '2026-09-05T13:30:00.000Z', skillBreakdown: { listening: 82 } },
    { percentage: 76, durationSeconds: 600, completedAt: '2026-09-04T13:15:00.000Z', skillBreakdown: { grammar: 76 } }
  ];
  const errors = fixture.errors || [
    { id: 'e1', type: 'grammar', question: '은/는', mistake: '이/가', correction: '은/는', explanation: 'Chưa hiểu khái niệm trợ từ chủ đề', count: 4 },
    { id: 'e2', type: 'listening', question: 'batchim', mistake: 'ㄱ', correction: 'ㅋ', explanation: 'Nhầm âm khi nghe', count: 2 }
  ];
  const state = { currentUser: { id: 'learner', targetTopikLevel: 3, studyMinutesPerDay: 30 }, currentView: 'home', srsData: srs };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    document,
    KLEARN_APP: {
      state, render: () => {}, escapeHtml: String,
      getUserProgress: () => ({ skills: scores, stats: { streak: 3 } }),
      PracticeService: { getHistory: () => history },
      LearnerProfileService: { get: () => ({ skillScores: scores }) }
    },
    ErrorNotebookService: { top: () => errors },
    FocusSessionService: { all: () => [] },
    KnowledgeGraphService: { context: () => [] },
    SmartReviewService: {
      forgettingPrediction: () => 0,
      plan() { return { atRisk: srs.map((card) => ({ wordId: card.wordId })) }; }
    },
    KLEARN_AFTER_RENDER: null
  };
  const FakeDate = class extends Date {
    constructor(...args) { super(...(args.length ? args : [fixedNow])); }
    static now() { return fixedNow; }
  };
  const context = { window, document, console, Date: FakeDate, Math, Object, Array, Number, String, Set, Map };
  vm.createContext(context);
  vm.runInContext(source, context);
  return window;
}

const app = boot();
const oldSchool = app.MemoryRiskService.analyze(app.KLEARN_APP.state.srsData[0], fixedNow);
const recentStudent = app.MemoryRiskService.analyze(app.KLEARN_APP.state.srsData[1], fixedNow);
assert.equal(oldSchool.level, 'high');
assert.ok(oldSchool.riskScore > recentStudent.riskScore);
assert.ok(oldSchool.recallStrength < recentStudent.recallStrength);
assert.equal(app.RecallStrengthService.score(app.KLEARN_APP.state.srsData[0], fixedNow), oldSchool.recallStrength);
assert.equal(app.SmartReviewService.memoryRisk(app.KLEARN_APP.state.srsData[0]).level, 'high');
assert.equal(app.SmartReviewService.plan(20).atRisk[0].recallStrength, oldSchool.recallStrength);

const bottleneck = app.LearningBottleneckService.detect({ vocabulary: 90, grammar: 60, listening: 45 });
assert.equal(bottleneck.ready, true);
assert.equal(bottleneck.primary.skill, 'listening');
assert.match(bottleneck.primary.conclusion, /Nghe/);
assert.equal(app.LearningBottleneckService.detect({ vocabulary: 90 }).ready, false);

const root = app.MistakeRootCauseService.summary();
assert.equal(root.ready, true);
assert.ok(root.causes.some((item) => item.cause === 'concept_gap'));
assert.ok(root.causes.some((item) => item.cause === 'perception_gap'));
assert.match(app.MistakeRootCauseService.analyze({ explanation: 'nhầm ngữ cảnh lịch sự', count: 2 }).label, /ngữ cảnh/);

const patterns = app.LearningPatternService.analyze([
  { at: '2026-09-05T20:00:00', minutes: 15, score: 90, type: 'listening' },
  { at: '2026-09-04T20:30:00', minutes: 15, score: 86, type: 'listening' },
  { at: '2026-09-03T08:00:00', minutes: 45, score: 55, type: 'grammar' }
]);
assert.equal(patterns.ready, true);
assert.equal(patterns.bestWindow, '20:00–22:00');
assert.equal(patterns.preferredType, 'Nghe');

const dependency = app.SkillDependencyService.forTarget(3, { vocabulary: 80, grammar: 70, listening: 30, reading: 65, writing: 62 });
assert.equal(dependency.target, 3);
assert.ok(dependency.requirements.some((item) => item.id === 'topik1-grammar'));
assert.equal(dependency.blockers[0].id, 'listening-foundation');

const graph = app.KnowledgeRelationService.graph('먹다');
assert.ok(graph.nodes.some((item) => item.label === '음식'));
assert.ok(graph.nodes.some((item) => item.label === '식당'));
assert.ok(graph.nodes.some((item) => item.label === '주문'));
assert.ok(graph.edges.some((edge) => edge[2] === 'grammar'));

const efficiency = app.StudyEfficiencyService.score();
assert.equal(efficiency.ready, true);
assert.ok(efficiency.score > 0 && efficiency.score <= 100);
assert.equal(efficiency.sampleCount, 2);

const forecast = app.LearningForecastService.forecast({ minutesPerDay: 30, months: 3, efficiency });
assert.equal(forecast.months, 3);
assert.ok(forecast.levelRange[0] <= forecast.levelRange[1]);
assert.match(forecast.disclaimer, /không đảm bảo/i);
assert.equal(forecast.confidence, 'low');

const report = app.PersonalInsightService.report();
assert.equal(report.generatedBy, 'deterministic-local-rules');
assert.match(report.slowdown, /Nghe/);
assert.ok(report.nextAction.length > 0);
assert.equal(app.LearningAnalyticsEngine.analyze().bottleneck.primary.skill, 'listening');

console.log('learning analytics engine: memory risk, recall, bottleneck, patterns, root cause, graphs, efficiency, forecast and insight passed');
