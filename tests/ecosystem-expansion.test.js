const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'ecosystem-expansion.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'ecosystem-expansion.json'), 'utf8'));
const scoped = new Map();

function boot(userId = 'learner-a') {
  const progress = {
    stats: { streak: 4, lessonsCompleted: 2, studyMinutes: 135 },
    skills: { reading: 72, writing: 58, speaking: 62, listening: 44, grammar: 66 },
    foundation: { learnedCharacters: ['ㅏ', 'ㄱ', 'ㄴ'], firstWords: ['w1', 'w2'], updatedAt: '2026-08-01T08:00:00.000Z' },
    lessonProgress: { first: { completed: true, masteryScore: 82, completedAt: '2026-08-04T08:00:00.000Z' } }
  };
  const state = { currentUser: { id: userId, createdAt: '2026-07-01T08:00:00.000Z', currentTopikLevel: 1, learningStyle: 'visual', goals: ['career'] }, currentView: 'ecosystem-expansion', srsData: [
    ...Array.from({ length: 4 }, (_, index) => ({ id: `m-${index}`, status: 'mastered', nextReview: '2026-01-01' })),
    { id: 'due', status: 'learning', nextReview: '2026-01-01' }
  ] };
  const errors = [
    { type: 'grammar', question: '은/는 particle', count: 4 },
    { type: 'listening', question: '받침 듣기', count: 3 },
    { type: 'writing', question: '문장', count: 1 }
  ];
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { ecosystemExpansion: 'ecosystem-expansion', writingAttempts: 'writing-attempts' },
      render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      getUserProgress: () => progress, saveUserProgress: (value) => Object.assign(progress, value),
      userScoped: (key) => scoped.get(key)?.[userId] || [],
      saveUserScoped: (key, items) => { const all = scoped.get(key) || {}; all[userId] = items; scoped.set(key, all); },
      CloudSyncService: { schedule: () => {} },
      LearnerProfileService: { get: () => ({ learningStyle: 'visual', skillScores: progress.skills, weakSkills: ['listening'], recentLessons: [{ id: 'first' }] }) },
      PracticeService: { getHistory: () => [{ percentage: 78, completedAt: new Date().toISOString() }] }
    },
    ErrorNotebookService: { top: () => errors },
    DailyLearningExperienceService: { habits: { analyze: () => ({ bestWindow: '20:00–22:00' }) }, sessions: { start: () => ({}) } },
    FocusSessionService: { all: () => [] },
    ImmersiveProgressService: { all: () => [{ completedRuns: 2 }] },
    KLEARN_THEORY_LESSONS: [{ id: 'lesson-1', title: 'Trợ từ', topic: '은/는', contentVersion: 1, reviewStatus: 'approved' }],
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const fetch = async () => ({ ok: true, json: async () => content });
  const context = { window, document, console, fetch, Date, Intl, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(moduleSource, context);
  window.ExpansionContentService.hydrate(content);
  return { window, progress };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.deepEqual(content.lifeScenarios.map((item) => item.group), ['Housing', 'Hospital', 'Bank', 'School', 'Work']);
assert.equal(content.numberExercises.some((item) => item.system === 'native'), true);
assert.equal(content.numberExercises.some((item) => item.system === 'sino'), true);
assert.deepEqual(content.careerPaths.map((item) => item.title), ['IT Korean', 'Business Korean', 'Tourism Korean', 'Office Korean']);

const { window: app } = boot();
const timeline = app.JourneyIntelligenceService.timeline();
assert.deepEqual(Array.from(timeline, (item) => item.id), ['started', 'hangul', 'first-lesson', 'topik', 'hours']);
assert.equal(timeline.some((item) => item.id === 'vocab-100'), false, 'unreached milestones are not fabricated');
const dna = app.JourneyIntelligenceService.dna();
assert.equal(dna.style, 'visual');
assert.equal(dna.strength, 'reading');
assert.equal(dna.weakness, 'listening');
assert.equal(dna.bestWindow, '20:00–22:00');
assert.match(app.JourneyIntelligenceService.notification().message.vi, /20:00/);
app.JourneyIntelligenceService.setPreference('difficult', 'low');
assert.equal(app.JourneyIntelligenceService.sessionPlan().difficulty, 'easy');
assert.deepEqual(Array.from(app.JourneyIntelligenceService.sessionPlan().items), ['SRS review', 'Vocabulary', 'Light listening']);

assert.equal(app.RealKoreanLifeService.start('life-housing'), true);
const life = app.RealKoreanLifeService.evaluate('보증금은 얼마예요?');
assert.equal(life.score, 100);
assert.equal(app.KLEARN_APP.state.currentView, 'life-simulator');
const doc = app.RealKoreanLifeService.analyzeDocument('영업시간 휴무일');
assert.deepEqual(Array.from(doc.matches, (item) => item.term), ['영업시간', '휴무일']);
assert.equal(doc.matches[0].parts.length, 2);
app.KLEARN_APP.state.ecosystemExpansion.numberIndex = 2;
assert.equal(app.RealKoreanLifeService.checkNumber('15000').correct, true);

const patterns = app.LanguageScienceService.errorPatterns();
assert.equal(patterns[0].type, 'particles');
assert.equal(patterns.reduce((sum, item) => sum + item.share, 0) >= 99, true);
const simple = app.LanguageScienceService.analyzeSentence('저는 학생이에요.', true);
const complex = app.LanguageScienceService.analyzeSentence('저는 한국에서 공부하고 있는 학생이지만 주말에는 회사에서 일해요.', true);
assert.equal(complex.words > simple.words, true);
assert.equal(complex.clauses > simple.clauses, true);
assert.equal(complex.natural >= simple.natural, true);
assert.equal(app.LanguageScienceService.thinking('밥을 먹어요.').correct, true);

const metrics = app.SkillWorldService.metrics();
assert.equal(metrics.hangul, 8);
assert.equal(metrics.conversation, 2);
assert.equal(app.SkillWorldService.badges().find((item) => item.id === 'listening-beginner').unlocked, false);
assert.ok(app.SkillWorldService.challenge().target > 0);

assert.equal(app.CareerPurposeService.select('it'), 'it');
assert.equal(app.CareerPurposeService.practice('interview', '안녕하세요. 저는 개발자입니다. 협업을 잘합니다.').score > 50, true);

const graph = app.LearningArchitectureService.memoryGraph();
assert.equal(graph.nodes.length, 5);
assert.equal(graph.nodes.some((node) => node.kind === 'weak-skill' && node.label === 'listening'), true);
const generated = app.LearningArchitectureService.generatePractice();
assert.equal(generated.length, 1);
assert.equal(generated[0].source, 'reviewed-content');
assert.equal(generated[0].sourceId, 'lesson-1');
assert.equal(app.LearningArchitectureService.speechSupport().audioStored, false);

for (const route of ['ecosystem-expansion', 'journey-intelligence', 'real-korean-life', 'life-simulator', 'document-reader', 'address-number-trainer', 'language-science', 'korean-thinking', 'skill-world', 'career-purpose', 'career-practice', 'learning-architecture']) {
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
}
assert.match(app.KLEARN_EXTRA_VIEWS['ecosystem-expansion'](), /P5–P10/);
assert.match(app.KLEARN_EXTRA_VIEWS['document-reader'](), /không upload/i);
assert.match(app.KLEARN_EXTRA_VIEWS['learning-architecture'](), /Không có chatbot mới/i);

const isolated = boot('learner-b').window;
assert.equal(isolated.JourneyIntelligenceService.preference().mood, 'normal');
assert.equal(isolated.LanguageScienceService.sentenceHistory().length, 0);

const indexSource = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
assert.equal(indexSource.includes('content/ecosystem-expansion.json'), false, 'heavy content is not loaded by index startup');
assert.match(moduleSource, /fetch\('\.\/content\/ecosystem-expansion\.json'/);
const scaleSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'ecosystem-scale.js'), 'utf8');
assert.match(scaleSource, /\.immersion-toggle button\[data-korean-only\]/, 'Korean Only handler targets the button, not the html data attribute');
assert.doesNotMatch(scaleSource, /document\.querySelector\('\[data-korean-only\]'\)/, 'html root must never receive the toggle click handler');
const adaptiveSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'adaptive-engine.js'), 'utf8');
assert.match(adaptiveSource, /LanguageScienceService\?\.adaptiveContext/, 'error trends feed the existing adaptive engine');
const workerSource = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
assert.doesNotMatch(workerSource, /content\/ecosystem-expansion\.json/, 'heavy content is fetched on demand instead of service-worker install');

console.log('ecosystem expansion: P5-P10 intelligence, real life, language science, mastery, career and safe AI foundations passed');
