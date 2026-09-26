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
  const values = new Map(); const errors = []; const adaptive = []; const mutations = []; const srs = [];
  const state = { currentUser: { id: 'p80-user', currentTopikLevel: 3, targetTopikLevel: 4 }, currentView: 'topik', p80Topik: null };
  let progress = { skills: {}, daily: { tasks: {} }, stats: {}, lessonProgress: {} };
  const storage = { get(key, fallback) { return values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback); }, set(key, value) { values.set(key, structuredClone(value)); return true; } };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    ErrorNotebookService: { add(item) { errors.push(structuredClone(item)); return item; } },
    DictionaryService: { search(term) { return String(term).includes('회의') ? [{ id:'dict-meeting', korean:'회의', meaningVi:'cuộc họp' }] : []; }, addToSrs(entry, metadata) { const card={ ...entry, metadata }; srs.push(card); return card; } },
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
  return { window, state, values, errors, srs, adaptive, mutations, progress: () => progress };
}

(async () => {
  assert.equal(config.schemaVersion, 2); assert.equal(config.contentPolicy.sourceType, 'ORIGINAL_CREATED_CONTENT');
  assert.equal(config.questions.length, 44); assert.equal(config.sectionGroups.length, 16); assert.equal(config.mockTests.length, 2);
  assert.equal(config.examCatalog.length, 12); assert.equal(config.sources.length, 3); assert.equal(config.typeTraining.length, 18);
  assert.ok(config.examCatalog.filter((item) => item.contentStatus === 'metadata-only').every((item) => item.answerVerification === 'not-available'));
  assert.deepEqual(new Set(config.questionTypes), new Set(['main-idea','detail','inference','vocabulary','grammar','chart','conversation']));
  for (const level of ['TOPIK I','TOPIK II']) assert.deepEqual(Object.fromEntries(['easy','medium','hard'].map((difficulty) => [difficulty, config.questions.filter((item) => item.level === level && item.section !== 'writing' && item.difficulty === difficulty).length])), { easy: 5, medium: 10, hard: 5 });
  for (const question of config.questions) ['id','year','exam','section','questionNumber','skill','difficulty','answer','explanation'].forEach((field) => assert.ok(question[field], `${question.id}.${field} missing`));

  const rt = boot(); const w = rt.window;
  ['P80TopikConfigService','P80ExamCatalogService','P80TopikQuestionBankService','P80TopikExamService','P80SectionPracticeService','P80QuestionTypeTrainingService','P80SmartTestGeneratorService','P80RandomPracticeService','P80ResultAnalysisService','P80ErrorNotebookBridgeService','P80SrsSuggestionService','P80HistoryService','P80TopikReportService','P80ScorePredictionService'].forEach((name) => assert.ok(w[name], `${name} missing`));
  assert.equal(w.P80ExamCatalogService.all({ format:'IBT' }).length, 6); assert.equal(w.P80ExamCatalogService.all({ status:'upcoming' }).length, 4);
  assert.equal(w.P80ExamCatalogService.get('p80-topik-i-original').canStart, true); assert.equal(w.P80ExamCatalogService.get('topik-pbt-108-2026').canStart, false);
  assert.equal(w.P80TopikExamService.startCatalog('topik-pbt-108-2026').status, 'metadata-only');
  assert.deepEqual(structuredClone(w.P80TopikQuestionBankService.coverage()), { total:44, topikI:20, topikII:24, listening:20, reading:20, writing:4 });
  assert.equal(w.P80SectionPracticeService.groups('TOPIK I','listening').length, 3); assert.equal(w.P80SectionPracticeService.groups('TOPIK II','writing').length, 4);
  assert.equal(w.P80QuestionTypeTrainingService.types().length, 18);

  const smart = w.P80SmartTestGeneratorService.generate({ level:'TOPIK II', weakSkill:'inference', goal:'reading' });
  assert.equal(smart.questions.length, 20); assert.deepEqual(structuredClone(smart.distribution), { easy:5, medium:10, hard:5 }); assert.equal(new Set(smart.questions.map((item) => item.id)).size, 20);
  const random = w.P80RandomPracticeService.generate({ level:'TOPIK I', section:'reading', questionType:'detail', count:5 }); assert.ok(random.questions.length > 0 && random.questions.length <= 5); assert.ok(random.questions.every((item) => item.level === 'TOPIK I' && item.section === 'reading' && item.questionType === 'detail'));
  const session = w.P80SmartTestGeneratorService.start({ level:'TOPIK II', weakSkill:'inference', goal:'reading' });
  session.questions.forEach((question, index) => w.P80TopikExamService.answer(question.id, index === 0 ? 'đáp án sai' : question.answer));
  const result = w.P80TopikExamService.finish('submitted');
  assert.equal(result.total, 20); assert.equal(result.wrong, 1); assert.equal(result.percentage, 95); assert.equal(result.scaledScore, 285); assert.equal(result.analysis.errorTypes.strategy + result.analysis.errorTypes.vocabulary + result.analysis.errorTypes.grammar + result.analysis.errorTypes['careless-mistake'], 1);
  assert.equal(result.answerVerification, 'verified-original'); assert.equal(result.scoreType, 'practice-estimate'); assert.equal(result.gradableTotal, 20); assert.equal(result.unverifiedTotal, 0); assert.equal(result.questionSnapshots.length, 20);
  assert.equal(rt.errors.length, 0, 'wrong answers require explicit confirmation'); const errorRecord = w.P80ErrorNotebookBridgeService.add(result, result.wrongQuestionIds[0]); assert.ok(errorRecord); assert.equal(rt.errors.length, 1); assert.match(rt.errors[0].type, /^topik-(vocabulary|grammar|strategy|careless-mistake)$/); assert.ok(rt.adaptive.length >= 2); assert.ok(rt.mutations.some((item) => item.type === 'topik_completed'));
  assert.equal(rt.values.get('examAttempts')['p80-user'].history[0].id, result.id); assert.equal(rt.values.get('practiceHistory')['p80-user'][0].id, result.id); assert.equal(rt.progress().daily.tasks.practice, true);

  const section = w.P80SectionPracticeService.start('tii-writing-51'); const writing = section.questions[0]; w.P80TopikExamService.toggleMark(writing.id); assert.deepEqual(w.P80TopikExamService.active().marked, [writing.id]); w.P80TopikExamService.answer(writing.id, writing.modelAnswer); const writingResult = w.P80TopikExamService.finish();
  assert.equal(writingResult.skillBreakdown.writing, 100); assert.equal(writingResult.estimatedWritingScore, true);
  const srsSuggestions = w.P80SrsSuggestionService.suggestions(writing.id, writingResult); assert.equal(srsSuggestions[0].id, 'dict-meeting'); assert.ok(w.P80SrsSuggestionService.add(writing.id, 'dict-meeting', writingResult)); assert.equal(rt.srs.length, 1);
  const mock = w.P80TopikExamService.startMock('p80-topik-i-full'); assert.equal(mock.questions.length, 20); assert.equal(mock.durationMinutes, 100);
  assert.equal(mock.examId, 'p80-topik-i-original'); const resumed = w.P80TopikExamService.resume(); assert.equal(resumed.id, mock.id);
  const unverifiedQuestion = { ...config.questions[0], id:'unverified-question', answerVerification:'unverified' }; w.P80TopikExamService.start({ level:'TOPIK I', title:'Unverified safety test', questions:[unverifiedQuestion] }); w.P80TopikExamService.answer(unverifiedQuestion.id, unverifiedQuestion.answer); const unverified = w.P80TopikExamService.finish(); assert.equal(unverified.gradableTotal, 0); assert.equal(unverified.unverifiedTotal, 1); assert.equal(unverified.scaledScore, null); assert.equal(unverified.answers[0].correct, null);

  const prediction = w.P80ScorePredictionService.predict('TOPIK II'); assert.equal(prediction.attempts, 2); assert.ok(prediction.predictedScore > 0); assert.equal(prediction.confidence, 'low');
  const report = w.P80TopikReportService.diagnose(4, result); assert.equal(report.targetLevel, 4); assert.ok(report.actions.length >= 1); assert.match(report.disclaimer, /ước tính/i);
  assert.ok(w.P80HistoryService.summary().attempts >= 2); assert.equal(w.P80HistoryService.get(result.id).id, result.id);
  const migration = read('supabase/migrations/20260926_topik_exam_repository.sql');
  ['topik_exams','topik_exam_sections','topik_exam_questions','topik_exam_options','topik_exam_answers','topik_exam_explanations','topik_exam_sources','topik_exam_attempts','topik_exam_user_answers'].forEach((table) => assert.match(migration, new RegExp(`create table if not exists public\\.${table}`)));
  assert.match(migration, /(auth\.uid\(\) = user_id|user_id = auth\.uid\(\))/); assert.match(migration, /enable row level security/g); assert.match(migration, /has_any_role\(array\['reviewer','admin'\]\)/);
  const combined = [source, read('data/route-loader.js'), read('sw.js'), read('app.js'), read('topik-exam-intelligence-system.css'), migration, read('scripts/import-topik-exams.js')].join('\n');
  assert.match(combined, /topik-intelligence-p80/); assert.match(combined, /content\/topik-exam-intelligence-system\.json/); assert.match(combined, /STORAGE_KEYS\.examAttempts/); assert.match(combined, /STORAGE_KEYS\.practiceHistory/); assert.match(combined, /ErrorNotebookService/); assert.match(combined, /AdaptiveDifficultyService/); assert.match(combined, /emitLearningMutation/); assert.match(combined, /@media\(max-width:430px\)/);
  assert.doesNotMatch(combined, /(service_role|private_key|client_secret)\s*[:=]/i);
  console.log('P80 unit: sourced exam catalog, 44 original questions, verified scoring, review/SRS/error/history, RLS and import policy passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
