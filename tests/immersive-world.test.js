const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'immersive-world-data.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'immersive-world.js'), 'utf8');
const scoped = new Map();

function boot(userId = 'learner-a') {
  const state = { currentUser: { id: userId, currentTopikLevel: 2 }, currentView: 'immersive-world' };
  const progress = { stats: { streak: 4 }, skills: { speaking: 0 }, daily: { tasks: { speaking: false } } };
  let studySettings = { showRomanization: true, translationDisplay: 'always', koreanOnlyMode: false };
  const masteryCalls = []; const errors = [];
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { immersiveWorld: 'immersive-world' },
      render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      getUserProgress: () => progress, saveUserProgress: (next) => Object.assign(progress, next),
      userScoped: (key) => (scoped.get(key) || {})[state.currentUser?.id] || [],
      saveUserScoped: (key, items) => { const all = scoped.get(key) || {}; all[state.currentUser?.id] = items; scoped.set(key, all); },
      speakKorean: () => {}, CloudSyncService: { schedule: () => {} }, MasteryService: { updateLesson: (...args) => masteryCalls.push(args) }
    },
    StudySettingsService: { get: () => studySettings, save: (changes) => { studySettings = { ...studySettings, ...changes }; return studySettings; } },
    ErrorNotebookService: { add: (item) => errors.push(item) },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    masteryCalls, errors, getStudySettings: () => studySettings
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(moduleSource, context);
  return window;
}

const app = boot();
const worlds = app.KLEARN_IMMERSIVE_WORLD_DATA.worlds;
assert.deepEqual(Array.from(worlds, (item) => item.id), ['city', 'roleplay', 'career', 'university', 'travel', 'voice']);
assert.deepEqual(Array.from(app.KLEARN_IMMERSIVE_WORLD_DATA.missions.filter((item) => item.world === 'city'), (item) => item.place), ['Restaurant', 'Airport', 'School', 'Office', 'Hospital']);
assert.deepEqual(Array.from(app.KLEARN_IMMERSIVE_WORLD_DATA.missions.filter((item) => item.world === 'roleplay'), (item) => item.title), ['Du học sinh mới', 'Nhân viên mới', 'Du lịch Hàn Quốc']);
assert.deepEqual(Array.from(app.KLEARN_IMMERSIVE_WORLD_DATA.missions.filter((item) => item.world === 'career'), (item) => item.title), ['Phỏng vấn', 'Cuộc họp', 'Email công việc']);
assert.deepEqual(Array.from(app.KLEARN_IMMERSIVE_WORLD_DATA.missions.filter((item) => item.world === 'university'), (item) => item.title), ['Trong lớp', 'Trò chuyện với bạn', 'Trong khuôn viên']);
assert.deepEqual(Array.from(app.KLEARN_IMMERSIVE_WORLD_DATA.missions.filter((item) => item.world === 'travel'), (item) => item.title), ['Đặt phòng', 'Gọi món', 'Hỏi đường']);

app.ImmersiveWorldController.startMission('city-restaurant');
assert.equal(app.KLEARN_APP.state.currentView, 'immersive-session');
const first = app.ImmersiveWorldController.submitAnswer('두 명이에요.');
assert.ok(first.overall >= 75);
assert.ok(first.metrics.confidence > 0);
assert.ok(first.metrics.fluency > 0);
assert.ok(first.metrics.accuracy > 0);
app.ImmersiveWorldController.nextStep();
const second = app.ImmersiveWorldController.submitAnswer('비빔밥 하나랑 물 주세요.');
assert.ok(second.overall >= 75);
assert.equal(app.ImmersiveProgressService.get('city-restaurant').completedRuns, 1);
assert.equal(app.ImmersiveProgressService.completion('city').completed, 1);
assert.equal(app.masteryCalls.length, 2);
assert.equal(app.KLEARN_APP.getUserProgress().daily.tasks.speaking, true);

const speaking = app.SpeakingJourneyService.summary();
assert.equal(speaking.attempts, 2);
assert.equal(speaking.completed, 1);
assert.ok(speaking.confidence > 0 && speaking.fluency > 0 && speaking.accuracy > 0);

assert.equal(app.ImmersionSettingsService.enabled(), false);
app.ImmersionSettingsService.set(true);
assert.equal(app.ImmersionSettingsService.enabled(), true);
assert.equal(app.getStudySettings().showRomanization, false);
assert.equal(app.getStudySettings().translationDisplay, 'hidden');
assert.match(app.KLEARN_EXTRA_VIEWS['immersive-session'](), /is-korean-only/);
app.ImmersionSettingsService.set(false);
assert.equal(app.getStudySettings().showRomanization, true);
assert.equal(app.getStudySettings().translationDisplay, 'always');

const debate = app.DebatePracticeService.evaluate('remote-work', '저는 재택근무에 부분적으로 동의하지만 소통이 어렵기 때문에 모든 업무에 효율적이지는 않다고 생각합니다.');
assert.ok(debate.overall >= 70);
assert.equal(app.DebatePracticeService.history().length, 1);
app.KLEARN_APP.state.immersiveWorld.debateResult = debate;
assert.match(app.KLEARN_EXTRA_VIEWS['debate-studio'](), /Nhờ trợ lý phản biện/);

const avatar = app.LearningAvatarArchitectureService.research();
assert.equal(avatar.status, 'architecture-research');
assert.equal(avatar.boundaries.length, 4);
assert.match(app.KLEARN_EXTRA_VIEWS['learning-avatar-research'](), /chưa tạo nhân vật AI/i);
assert.match(app.KLEARN_EXTRA_VIEWS['voice-world'](), /Audio không được lưu/);

for (const route of ['immersive-world', 'virtual-korean-city', 'immersive-session', 'roleplay-game', 'debate-studio', 'career-korean', 'university-life', 'travel-simulator', 'voice-world', 'speaking-journey', 'learning-avatar-research']) {
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
}

const isolated = boot('learner-b');
assert.equal(isolated.ImmersiveProgressService.all().length, 0, 'immersive progress is user scoped');
assert.equal(isolated.DebatePracticeService.history().length, 0, 'debate history is user scoped');

console.log('immersive world: city, roleplay, career, university, travel, voice fallback, debate, Korean-only and speaking journey passed');
