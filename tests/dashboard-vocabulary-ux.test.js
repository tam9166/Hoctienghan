const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const p79Source = read('data/vocabulary-immersion-system.js');
const assistantSource = read('data/beginner-learning-assistant.js');
const config = JSON.parse(read('content/vocabulary-immersion-system.json'));

function boot(overrides = {}) {
  const values = new Map(); const audio = []; const focus = [];
  const state = { currentUser: { id: 'ux-user', fullName: 'Nguyễn An', onboardingCompleted: true, learningTrack: 'topik', currentTopikLevel: 1, targetTopikLevel: 2, goals: ['topik'], studyMinutesPerDay: 15, ...overrides.user }, currentView: 'home', srsData: structuredClone(overrides.srsData || []), p79Vocabulary: null, beginnerAssistant: null };
  let progress = { lessonProgress: {}, daily: { tasks: {} }, stats: { streak: 2, wordsLearned: 0 }, skills: { listening: 45, vocabulary: 0 } };
  let activeSession = null;
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const scoped = (key) => structuredClone(values.get(`${key}:ux-user`) || []);
  const saveScoped = (key, value) => { values.set(`${key}:ux-user`, structuredClone(value)); return value; };
  const vocabulary = {
    dueCards: () => state.srsData.filter((card) => card.status !== 'not_started' && card.nextReview && new Date(card.nextReview) <= new Date()),
    updateCard(wordId, changes) { state.srsData = state.srsData.map((card) => card.wordId === wordId ? { ...card, ...structuredClone(changes) } : card); return state.srsData.find((card) => card.wordId === wordId); },
    recordRecall(card, correct) { this.updateCard(card.wordId, { reviewCount: Number(card.reviewCount || 0) + 1, wrongCount: Number(card.wrongCount || 0) + (correct ? 0 : 1) }); }
  };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, KLEARN_THEORY_LESSONS: [],
    CurriculumService: { all: () => [], lesson: () => null }, StudyCalendarService: { activityByDay: () => ({}) },
    ErrorNotebookService: { top: () => structuredClone(overrides.errors || []), add() {} },
    WeaknessDetectionService: { detect: () => structuredClone(overrides.weaknesses || [{ id: 'skill:listening', skill: 'listening', label: 'Nghe', score: 45 }]) }, AdaptiveLearningProfileService: { snapshot: () => ({ targetTopikLevel: state.currentUser.targetTopikLevel }) },
    AdaptiveLearningEngine: { generateLearningSession: () => ({ minutes: 15, tasks: [{ type: 'listening', minutes: 7, title: 'Luyện nghe', reason: 'Kỹ năng đang yếu' }, { type: 'lesson', minutes: 8, title: 'Bài học mới', reason: 'Theo lộ trình' }] }) }, GoalTrackingService: { getGoal: () => ({ targetLevel: state.currentUser.targetTopikLevel, dailyMinutes: 15 }) },
    DailyLearningExperienceService: { sessions: { active: () => activeSession, start(minutes) { activeSession = { id: 'focus-1', source: 'daily-experience', targetMinutes: minutes, tasks: [], currentTask: 0 }; return activeSession; } } }, FocusSessionService: { save(session) { focus.push(structuredClone(session)); activeSession = session; } },
    VocabularyCollectionService: { all: () => [], create: () => null, save: () => null }, AdaptiveDifficultyService: { record() {} }, UserResearchService: { track() {} },
    KLEARN_APP: {
      state, STORAGE_KEYS: { achievements: 'achievements', offlinePacks: 'offlinePacks', vocabularyCollections: 'collections' }, storage: { get: (_key, fallback) => structuredClone(fallback), set: () => true },
      render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String, speakKorean(text, rate) { audio.push({ text, rate }); },
      getUserProgress: () => structuredClone(progress), saveUserProgress(value) { progress = structuredClone(value); }, getUserSrs: () => state.srsData,
      saveUserSrs(cards) { state.srsData = structuredClone(cards); return state.srsData; }, userScoped: scoped, saveUserScoped: saveScoped,
      VocabularyService: vocabulary, DictionaryService: { byId: () => null, favorites: () => [] }, PracticeService: { getHistory: () => structuredClone(overrides.history || []) },
      SRSStateService: { isActive: (card) => Boolean(card.status && card.status !== 'not_started') }, emitLearningMutation() {}, saveUserProgress(value) { progress = structuredClone(value); }
    },
    fetch: async () => ({ ok: true, json: async () => config }), addEventListener() {}, console
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, fetch: window.fetch, FormData: class {} };
  vm.runInNewContext(p79Source, context); window.P79VocabularyConfigService.hydrate(config); vm.runInNewContext(assistantSource, context);
  return { window, state, audio, focus };
}

test('1. listening vocabulary renders Korean before Vietnamese', () => {
  const { window, state } = boot(); state.p79Vocabulary.wordId = 'p79-greetings-annyeong';
  const html = window.KLEARN_EXTRA_VIEWS['vocabulary-learn-p79']();
  assert.ok(html.indexOf('🇰🇷 TIẾNG HÀN') < html.indexOf('🇻🇳 TIẾNG VIỆT'));
  assert.ok(html.indexOf('안녕하세요') < html.indexOf('Xin chào'));
});

test('2. listening vocabulary preserves normal and slow Korean audio', () => {
  const source = p79Source;
  assert.match(source, /data-rate="1"/); assert.match(source, /data-rate="0\.7"/); assert.match(source, /speakKorean\?\.\(button\.dataset\.p79Audio, Number\(button\.dataset\.rate\)/);
});

test('3. a user with no vocabulary sees topic recommendations', () => {
  const { window } = boot(); const html = window.KLEARN_EXTRA_VIEWS.review();
  assert.match(html, /Bắt đầu học từ vựng/); assert.match(html, /data-bla-topic-start/); assert.match(html, /Chào hỏi/);
});

test('4. a user with no SRS gets a clear next action instead of an orphan empty screen', () => {
  const { window } = boot(); const html = window.KLEARN_EXTRA_VIEWS['beginner-vocabulary-review']();
  assert.match(html, /Học nhanh 5 phút/); assert.match(html, /data-bla-vocab-quick/); assert.doesNotMatch(html, /Không có từ phù hợp/);
});

test('5. a user with vocabulary sees due and priority review data', () => {
  const due = { wordId: 'learned-1', korean: '예약하다', meaningVi: 'đặt trước', status: 'review', reviewCount: 3, wrongCount: 2, mastery: 35, nextReview: new Date(Date.now() - 1000).toISOString() };
  const { window } = boot({ srsData: [due] }); const html = window.KLEARN_EXTRA_VIEWS.review();
  assert.match(html, /1 từ đến hạn/); assert.match(html, /Ưu tiên vì hay sai/); assert.match(html, /Bắt đầu ôn/); assert.doesNotMatch(html, /Bắt đầu học từ vựng/);
});

test('6. topic recommendation prioritizes beginner TOPIK I taxonomy', () => {
  const { window } = boot(); const topics = window.VocabularyOnboardingService.recommendations(3);
  assert.equal(topics[0].id, 'greetings'); assert.ok(topics.every((topic) => topic.topikLevel === 'TOPIK I')); assert.ok(topics.every((topic) => topic.wordCount > 0));
});

test('7. a recommended topic can be opened for learning', () => {
  const { window, state } = boot(); const result = window.VocabularyOnboardingService.startTopic('family');
  assert.equal(result.topic.id, 'family'); assert.equal(state.currentView, 'vocabulary-topic-p79'); assert.equal(state.p79Vocabulary.topicId, 'family');
});

test('8. starting a topic creates connected Learning Session context', () => {
  const { window, focus } = boot(); const result = window.VocabularyOnboardingService.startTopic('food');
  assert.equal(result.session.vocabularyContext.topicId, 'food'); assert.equal(result.session.tasks[0].type, 'vocabulary'); assert.ok(focus.length > 0);
});

test('9. opening a new topic word activates it in the shared SRS', () => {
  const { window, state } = boot(); state.p79Vocabulary.wordId = 'p79-food-order'; window.KLEARN_EXTRA_VIEWS['vocabulary-learn-p79']();
  assert.ok(state.srsData.some((card) => card.wordId === 'p79-food-order' && card.status === 'learning'));
});

test('10. compact dashboard keeps all primary destinations accessible', () => {
  const { window } = boot(); const html = window.KLEARN_EXTRA_VIEWS.home();
  for (const route of ['vocabulary-immersion-p79', 'beginner-vocabulary-review', 'error-notebook', 'learning-path', 'topik-intelligence-p80', 'topik-report-p80', 'topik-readiness-p81', 'learning-progress', 'adaptive-plan', 'achievements', 'ux-settings']) assert.match(html, new RegExp(`data-view="${route}"`));
  assert.match(html, /bla-function-directory/); assert.doesNotMatch(html, /bla-home-lower/);
});
