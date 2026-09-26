const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'ai-coach.js'), 'utf8');
const values = new Map();
const userId = 'error-user';
const storage = { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) };
const state = { currentUser: { id: userId, level: 'Beginner' }, srsData: [], currentView: 'home' };
const window = {
  KLEARN_APP: { storage, state, STORAGE_KEYS: { errors: 'errors', weeklyReports: 'weekly', handwriting: 'handwriting' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String, getUserProgress: () => ({ stats: {}, skills: {} }), userScoped: () => [], saveUserScoped: () => {}, LearnerProfileService: { get: () => ({ recentLessons: [], weakVocabulary: [], masteryByTopic: {} }) }, PracticeService: { statistics: () => ({ average: 0 }) }, CloudSyncService: { schedule: () => {} }, PrivacyPreferenceService: { allows: () => false } },
  KLEARN_EXTRA_VIEWS: {}, KLEARN_EXTRA_PROFILE: null, KLEARN_EXTRA_HOME: null, KLEARN_AFTER_RENDER: null
};
const document = { addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null, getElementById: () => null };
const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, fetch: async () => ({ ok: false, json: async () => ({}) }) };
vm.createContext(context);
vm.runInContext(source, context);

const input = { type: 'listening', errorType: 'question type', questionType: 'time_place', question: 'Mấy giờ?', selectedAnswer: '3 giờ', correctAnswer: '4 giờ', difficulty: 'medium', source: 'TOPIK 102', sourceId: 'attempt-1:q-4', timestamp: '2026-09-26T10:00:00.000Z', explanation: 'Nghe nhầm thời gian.' };
const first = window.ErrorNotebookService.add(input);
const repeated = window.ErrorNotebookService.add(input);
assert.equal(repeated.id, first.id, 'same error is deduplicated');
assert.equal(repeated.repetitionCount, 2);
assert.equal(repeated.repeated, true);
assert.equal(repeated.selectedAnswer, '3 giờ');
assert.equal(repeated.correctAnswer, '4 giờ');
assert.equal(repeated.questionType, 'time_place');
assert.equal(repeated.source, 'TOPIK 102');
assert.equal(repeated.difficulty, 'medium');
assert.equal(window.ErrorNotebookService.all().length, 1);

window.ErrorNotebookService.capturePractice({ id: 'attempt-2', source: 'quiz', setTitle: 'Mini Test', completedAt: '2026-09-26T11:00:00.000Z', wrongQuestionIds: ['g-1'], answers: [{ questionId: 'g-1', selectedAnswer: '은' }] }, [{ id: 'g-1', skill: 'grammar', questionType: 'particles', prompt: '저__ 학생', correctAnswer: '는', difficulty: 'easy', explanation: 'Chủ đề.' }]);
const grammar = window.ErrorNotebookService.all().find((item) => item.questionType === 'particles');
assert.equal(grammar.type, 'grammar');
assert.equal(grammar.selectedAnswer, '은');
assert.equal(grammar.correctAnswer, '는');
assert.equal(grammar.sourceId, 'attempt-2');

console.log('Error Notebook 2.0: complete evidence fields, deterministic dedupe, repetition count and practice capture passed');
