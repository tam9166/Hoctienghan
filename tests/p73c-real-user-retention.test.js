const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/real-user-retention.json'));

function createRuntime(options = {}, shared = new Map()) {
  const state = { currentUser: { id: options.userId || 'p73c-user', createdAt: options.createdAt || '2026-09-15T00:00:00.000Z', currentTopikLevel: options.level || 0 }, currentView: 'real-user-retention', srsData: options.srs || [] };
  let progress = options.progress || { foundation: { learnedCharacters: [] }, lessonProgress: {} };
  const practice = options.practice || [];
  const errors = []; const memories = []; const journals = [];
  const userScoped = (key) => shared.get(key)?.[state.currentUser.id] || [];
  const saveUserScoped = (key, values, limit = 100) => { const all = shared.get(key) || {}; all[state.currentUser.id] = values.slice(0, limit); shared.set(key, all); };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { realUserRetention: 'p73c-store' },
      userScoped, saveUserScoped, getUserProgress: () => progress, getUserSrs: () => state.srsData,
      PracticeService: { getHistory: () => practice },
      LearnerProfileService: { get: () => options.profile || { weakSkills: ['listening'] } },
      render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String
    },
    ErrorNotebookService: { add(value) { errors.push(value); return value; } },
    LongTermLearningMemoryService: {
      record(value) { memories.push(value); return value; },
      records(type) { return type === 'improvement_snapshot' ? (options.snapshots || []) : []; }
    },
    LearningJournalService: { add(value) { journals.push(value); return value; } },
    LearningActivityService: {
      between: () => options.events || [],
      summarize: (events) => ({ minutes: events.reduce((sum, item) => sum + item.minutes, 0), sessions: events.length, activeDays: new Set(events.map((item) => item.at.slice(0, 10))).size })
    },
    ConversationHistoryService: { all: () => options.conversationHistory || [] },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    document: null, SpeechRecognition: null, webkitSpeechRecognition: null
  };
  window.window = window;
  const context = { window, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.runInNewContext(read('data/real-user-retention.js'), context);
  window.RealUserRetentionContentService.hydrate(content);
  return { window, state, shared, errors, memories, journals, setProgress(value) { progress = value; } };
}

assert.equal(content.scenarios.length, 7);
assert.deepEqual(content.scenarios.map((item) => item.id), ['airport-check-in', 'restaurant-order', 'cafe-order', 'shopping-size', 'hospital-symptoms', 'interview-introduction', 'office-email']);
assert.deepEqual(content.missionTracks.map((item) => item.title), ['Tự giới thiệu', 'Gọi món trọn lượt', 'Email công việc']);
assert.ok(content.scenarios.every((item) => item.goal && item.requiredSkills.length && item.context && item.vocabulary.length && item.grammar.length && item.dialogue && item.speakingTask));

const runtime = createRuntime(); const w = runtime.window;
for (const service of ['LearningJourneyService', 'RealKoreanMissionService', 'ConversationMemoryService', 'EvidenceAchievementService', 'LearningReflectionService', 'MonthlyLearningReportService', 'ReturnLoopService']) assert.ok(w[service], `${service} missing`);
const invalid = structuredClone(content); invalid.scenarios.pop();
assert.throws(() => w.RealUserRetentionContentService.hydrate(invalid), /quality gate failed/);
w.RealUserRetentionContentService.hydrate(content);

// New user: account start is evidence; later milestones do not unlock from age or page views.
let journey = w.LearningJourneyService.refresh();
assert.equal(journey.filter((item) => item.reached).length, 1);
assert.equal(journey.slice(1).map((item) => item.targetDay).join(','), '1,30,90,180');
assert.equal(w.EvidenceAchievementService.refresh().filter((item) => item.unlocked).length, 0);
runtime.setProgress({ foundation: { learnedCharacters: ['ㅏ', 'ㅑ', 'ㅓ', 'ㅕ', 'ㄱ'], updatedAt: '2026-09-15T01:00:00.000Z' }, lessonProgress: {} });
journey = w.LearningJourneyService.refresh();
assert.equal(journey.find((item) => item.id === 'hangul-reader').reached, true);
assert.equal(w.EvidenceAchievementService.refresh().find((item) => item.id === 'hangul-starter').unlocked, true);

// A successful real-world submission persists text evidence, not audio, and does not mutate SRS.
const beforeSrs = JSON.stringify(runtime.state.srsData);
const mission = w.RealKoreanMissionService.submit('restaurant-order', '김치찌개 하나와 물 주세요.', 'voice');
assert.equal(mission.completed, true); assert.ok(mission.score >= 65);
assert.equal(w.ConversationMemoryService.all()[0].said, '김치찌개 하나와 물 주세요.');
assert.equal(w.ConversationMemoryService.all()[0].audio, undefined);
assert.equal(JSON.stringify(runtime.state.srsData), beforeSrs);
assert.ok(runtime.memories.some((item) => item.source === 'real-korean-mission'));
assert.equal(w.EvidenceAchievementService.refresh().find((item) => item.id === 'first-conversation').unlocked, true);

const weak = w.RealKoreanMissionService.submit('office-email', '회의', 'text');
assert.equal(weak.completed, false); assert.ok(runtime.errors.length > 0);
assert.ok(weak.missingVocabulary.length > 0);

const reflection = w.LearningReflectionService.save({ goal: 'Gọi món tự nhiên', difficulty: 'Nghe chưa kịp', achievement: 'Đã nói một câu' });
assert.ok(reflection); assert.equal(runtime.journals.length, 1);

// 30-day learner: report only uses supplied activity and snapshot evidence.
const monthRuntime = createRuntime({
  createdAt: '2026-08-16T00:00:00.000Z',
  events: [{ at: '2026-09-02T10:00:00.000Z', minutes: 12 }, { at: '2026-09-03T10:00:00.000Z', minutes: 18 }],
  snapshots: [
    { occurredAt: '2026-09-01T00:00:00.000Z', signal: { skillScores: { listening: 40, speaking: 50 } } },
    { occurredAt: '2026-09-14T00:00:00.000Z', signal: { skillScores: { listening: 48, speaking: 55 } } }
  ],
  profile: { weakSkills: ['grammar'] }
});
const monthly = monthRuntime.window.MonthlyLearningReportService.generate(new Date('2026-09-15T00:00:00.000Z'));
assert.equal(monthly.minutes, 30); assert.equal(monthly.activeDays, 2); assert.equal(monthly.skillDeltas.listening, 8); assert.equal(monthly.improvementPoint, 'grammar');

// 180-day learner: 1,000 mastered words and TOPIK 2 evidence unlock only from source records.
const mastered = Array.from({ length: 1000 }, (_, index) => ({ id: `word-${index}`, status: 'mastered', mastery: 90, lastReviewed: `2026-09-${String(index % 14 + 1).padStart(2, '0')}T00:00:00.000Z` }));
const veteran = createRuntime({ createdAt: '2026-03-19T00:00:00.000Z', srs: mastered, practice: [{ id: 'topik2-a', setTitle: 'TOPIK 2 mock', percentage: 76, completedAt: '2026-09-10T00:00:00.000Z' }] });
const veteranJourney = veteran.window.LearningJourneyService.refresh();
assert.equal(veteranJourney.find((item) => item.id === 'vocabulary-500').reached, true);
assert.equal(veteranJourney.find((item) => item.id === 'topik-2-ready').reached, true);
assert.equal(veteran.window.EvidenceAchievementService.refresh().find((item) => item.id === 'vocabulary-builder-1000').unlocked, true);

const app = read('app.js'); const index = read('index.html'); const worker = read('sw.js'); const loader = read('data/route-loader.js'); const css = read('real-user-retention.css'); const moduleSource = read('data/real-user-retention.js');
assert.match(app, /realUserRetention: 'klearn_real_user_retention'/); assert.match(app, /mergeRealUserRetention/); assert.match(app, /STORAGE_KEYS\.realUserRetention/);
assert.doesNotMatch(index, /data\/real-user-retention\.js\?v=4/); assert.match(index, /app\.js\?v=89/); assert.match(index, /route-loader\.js\?v=31/);
assert.match(loader, /realUserRetentionCore/); assert.match(loader, /routes\('home', \['growth', 'realUserRetentionCore', 'productDelightCore'\]\)/);
assert.match(worker, /klearn-v105/); assert.match(worker, /content\/real-user-retention\.json/); assert.match(worker, /real-user-retention\.css\?v=2/);
assert.match(read('data/ai-coach.js'), /\.\.\.\(window\.KLEARN_EXTRA_VIEWS \|\| \{\}\)/); assert.match(read('data/ai-coach.js'), /previousAfterRender\?\.\(\)/);
assert.match(css, /@media \(max-width: 560px\)/); assert.match(css, /prefers-reduced-motion/);
assert.doesNotMatch(moduleSource, /mất streak|mất chuỗi|bạn sẽ tụt hậu/i);
console.log('P73C unit: evidence journey, seven real Korean scenarios, conversation memory, achievements, reflection, monthly report, return loop, cloud merge and lazy/offline assets passed');
