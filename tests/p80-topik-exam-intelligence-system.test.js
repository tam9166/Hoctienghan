#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/topik-exam-intelligence-system.json'));
const source = read('data/topik-exam-intelligence-system.js');

function boot() {
  const values = new Map(); const errors = []; const adaptive = []; const mutations = [];
  const state = { currentUser: { id: 'p80-user', currentTopikLevel: 3, targetTopikLevel: 4 }, currentView: 'topik', p80Topik: null };
  let progress = { skills: {}, daily: { tasks: {} }, stats: {}, lessonProgress: {} };
  const storage = { get(key, fallback) { return values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback); }, set(key, value) { values.set(key, structuredClone(value)); return true; } };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    ErrorNotebookService: { add(item) { errors.push(structuredClone(item)); return item; } },
    AdaptiveDifficultyService: { record(skill, correct) { adaptive.push({ skill, correct }); } },
    KLEARN_APP: {
      state, STORAGE_KEYS: { examAttempts: 'examAttempts', practiceHistory: 'practiceHistory' }, storage,
      escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {}, speakKorean() {},
      getUserProgress: () => structuredClone(progress), saveUserProgress(value) { progress = structuredClone(value); },
      emitLearningMutation(type, id, payload) { mutations.push({ type, id, payload: structuredClone(payload) }); },
      CloudSyncService: { schedule() {} }
    },
    fetch: async () => ({ ok: true, json: async () => config }), console
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, setInterval, clearInterval, fetch: window.fetch, FormData: class {} };
  vm.runInNewContext(source, context); window.P80TopikConfigService.hydrate(config);
  return { window, state, values, errors, adaptive, mutations, progress: () => progress };
}

(async () => {
  assert.equal(config.schemaVersion, 1); assert.equal(config.contentPolicy.sourceType, 'ORIGINAL_CREATED_CONTENT');
  assert.equal(config.questions.length, 44); assert.equal(config.sectionGroups.length, 16); assert.equal(config.mockTests.length, 2);
  assert.deepEqual(new Set(config.questionTypes), new Set(['main-idea','detail','inference','vocabulary','grammar','chart','conversation']));
  for (const level of ['TOPIK I','TOPIK II']) assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map((difficulty) => [difficulty, config.questions.filter((item) => item.level === level && item.section !== 'writing' && item.difficulty === difficulty).length])), { easy: 5, medium: 10, hard: 5 });
  for (const question of config.questions) ['id','year','exam','section','questionNumber','skill','difficulty','answer','explanation'].forEach((field) => assert.ok(question[field], `${question.id}.${field} missing`));

  const rt = boot(); const w = rt.window;
  ['P80TopikConfigService','P80TopikQuestionBankService','P80TopikExamService','P80SectionPracticeService','P80QuestionTypeTrainingService','P80SmartTestGeneratorService','P80ResultAnalysisService','P80ErrorNotebookBridgeService','P80TopikReportService','P80ScorePredictionService'].forEach((name) => assert.ok(w[name], `${name} missing`));
  assert.deepEqual(structuredClone(w.P80TopikQuestionBankService.coverage()), { total:44, topikI:20, topikII:24, listening:20, reading:20, writing:4 });
  assert.equal(w.P80SectionPracticeService.groups('TOPIK I','listening').length, 3); assert.equal(w.P80SectionPracticeService.groups('TOPIK II','writing').length, 4);
  assert.equal(w.P80QuestionTypeTrainingService.types().length, 7);

  const smart = w.P80SmartTestGeneratorService.generate({ level:'TOPIK II', weakSkill:'inference', goal:'reading' });
  assert.equal(smart.questions.length, 20); assert.deepEqual(structuredClone(smart.distribution), { easy:5, medium:10, hard:5 }); assert.equal(new Set(smart.questions.map((item) => item.id)).size, 20);
  const session = w.P80SmartTestGeneratorService.start({ level:'TOPIK II', weakSkill:'inference', goal:'reading' });
  session.questions.forEach((question, index) => w.P80TopikExamService.answer(question.id, index === 0 ? 'đáp án sai' : question.answer));
  const result = w.P80TopikExamService.finish('submitted');
  assert.equal(result.total, 20); assert.equal(result.wrong, 1); assert.equal(result.percentage, 95); assert.equal(result.scaledScore, 285); assert.equal(result.analysis.errorTypes.strategy + result.analysis.errorTypes.vocabulary + result.analysis.errorTypes.grammar + result.analysis.errorTypes['careless-mistake'], 1);
  assert.equal(rt.errors.length, 1); assert.match(rt.errors[0].type, /^topik-(vocabulary|grammar|strategy|careless-mistake)$/); assert.ok(rt.adaptive.length >= 2); assert.ok(rt.mutations.some((item) => item.type === 'topik_completed'));
  assert.equal(rt.values.get('examAttempts')['p80-user'].history[0].id, result.id); assert.equal(rt.values.get('practiceHistory')['p80-user'][0].id, result.id); assert.equal(rt.progress().daily.tasks.practice, true);

  const section = w.P80SectionPracticeService.start('tii-writing-51'); const writing = section.questions[0]; w.P80TopikExamService.answer(writing.id, writing.modelAnswer); const writingResult = w.P80TopikExamService.finish();
  assert.equal(writingResult.skillBreakdown.writing, 100); assert.equal(writingResult.estimatedWritingScore, true);
  const mock = w.P80TopikExamService.startMock('p80-topik-i-full'); assert.equal(mock.questions.length, 20); assert.equal(mock.durationMinutes, 100);

  const prediction = w.P80ScorePredictionService.predict('TOPIK II'); assert.equal(prediction.attempts, 2); assert.ok(prediction.predictedScore > 0); assert.equal(prediction.confidence, 'low');
  const report = w.P80TopikReportService.diagnose(4, result); assert.equal(report.targetLevel, 4); assert.ok(report.actions.length >= 1); assert.match(report.disclaimer, /ước tính/i);
  const combined = [source, read('data/route-loader.js'), read('sw.js'), read('app.js'), read('topik-exam-intelligence-system.css')].join('\n');
  assert.match(combined, /topik-intelligence-p80/); assert.match(combined, /content\/topik-exam-intelligence-system\.json/); assert.match(combined, /STORAGE_KEYS\.examAttempts/); assert.match(combined, /STORAGE_KEYS\.practiceHistory/); assert.match(combined, /ErrorNotebookService/); assert.match(combined, /AdaptiveDifficultyService/); assert.match(combined, /emitLearningMutation/); assert.match(combined, /@media\(max-width:430px\)/);
  assert.doesNotMatch(combined, /(service_role|private_key|client_secret)\s*[:=]/i);
  console.log('P80 unit: 44-question bank, mock/section/type/smart modes, scoring, analysis, error sync, AI-ready report and score prediction passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
