const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const legacyData = fs.readFileSync(path.join(root, 'data', 'immersive-world-data.js'), 'utf8');
const legacyModule = fs.readFileSync(path.join(root, 'data', 'immersive-world.js'), 'utf8');
const source = fs.readFileSync(path.join(root, 'data', 'immersive-korean-world.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'immersive-korean-world.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p44_immersive_korean_world.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function boot(userId = 'p44-user') {
  const scoped = new Map(); const syncEvents = []; const state = { currentUser: { id: userId, currentTopikLevel: 2 }, currentView: 'immersive-world' };
  const progress = { stats: { streak: 2 }, skills: { speaking: 0 }, daily: { tasks: { speaking: false } } }; let settings = { showRomanization: true, translationDisplay: 'always', koreanOnlyMode: false };
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { immersiveWorld: 'legacy-world', immersiveKoreanWorld: 'p44-world' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      getUserProgress: () => progress, saveUserProgress: (next) => Object.assign(progress, next), userScoped: (key) => (scoped.get(key) || {})[state.currentUser.id] || [], saveUserScoped: (key, items) => { const all = scoped.get(key) || {}; all[state.currentUser.id] = items; scoped.set(key, all); }, speakKorean: () => {}, CloudSyncService: { schedule: (name) => syncEvents.push(name) }, MasteryService: { updateLesson: () => {} }
    },
    StudySettingsService: { get: () => settings, save: (changes) => { settings = { ...settings, ...changes }; return settings; } },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null, console
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, Promise, JSON, setTimeout };
  vm.createContext(context); vm.runInContext(legacyData, context); vm.runInContext(legacyModule, context); vm.runInContext(source, context); window.ImmersiveKoreanWorldContentService.hydrate(content);
  return { window, state, scoped, syncEvents, getSettings: () => settings };
}

assert.equal(content.verified, true); assert.equal(content.reviewStatus, 'approved'); assert.equal(content.version, '2.0.0');
assert.deepEqual(content.levels.map((item) => item.id), ['beginner', 'intermediate', 'advanced']);
assert.deepEqual(content.cityPlaces.map((item) => item.id), ['airport', 'cafe', 'university', 'office']);
assert.equal(content.scenarioLibrary.length, 7); assert.deepEqual([...new Set(content.scenarioLibrary.map((item) => item.role))].sort(), ['student', 'traveler', 'worker']);
assert.equal(content.privacy.storesRawAudio, false); assert.equal(content.privacy.storesFreeText, false); assert.equal(content.privacy.progressIsUserScoped, true);

const app = boot(); const w = app.window;
['ImmersiveLevelService', 'VirtualKoreanCityService', 'ScenarioLibraryService', 'ImmersiveMissionService', 'ImmersiveProgressMapService', 'DailyLifeSimulationService', 'InteractiveKoreanStoryService', 'CultureDecisionGameService', 'LanguageSurvivalModeService', 'ImmersiveKoreanWorldProgressService', 'RealWorldReadinessService'].forEach((name) => assert.ok(w[name], `${name} missing`));
assert.equal(w.ImmersiveLevelService.currentId(), 'beginner'); w.ImmersiveLevelService.set('intermediate'); assert.equal(w.ImmersiveLevelService.currentId(), 'intermediate');
assert.equal(w.VirtualKoreanCityService.places().length, 4); assert.equal(w.VirtualKoreanCityService.open('office'), true); assert.equal(app.state.currentView, 'immersive-session');
assert.ok(w.ImmersiveWorldController.submitAnswer('안녕하세요. 잘 부탁드립니다.').overall >= 70); w.ImmersiveWorldController.nextStep(); assert.ok(w.ImmersiveWorldController.submitAnswer('네, 오후 세 시까지 확인하겠습니다.').overall >= 70); assert.equal(w.ImmersiveProgressService.get('city-office').completedRuns, 1);

w.DailyLifeSimulationService.start(); assert.equal(w.DailyLifeSimulationService.stages().length, 5);
while (!app.state.immersiveKoreanWorldRuntime.daily.completed) { const stage = w.DailyLifeSimulationService.current(); const answer = stage.choices.find((item) => item.correct); assert.equal(w.DailyLifeSimulationService.choose(answer.id).correct, true); if (!app.state.immersiveKoreanWorldRuntime.daily.completed) w.DailyLifeSimulationService.next(); }
assert.equal(w.DailyLifeSimulationService.best(), 100); assert.equal(w.ImmersiveKoreanWorldProgressService.snapshot().dailyRuns[0].rawTextStored, false);

w.InteractiveKoreanStoryService.start(); w.InteractiveKoreanStoryService.choose('airport-train'); const ending = w.InteractiveKoreanStoryService.choose('station-polite'); assert.equal(ending.completed, true); assert.equal(ending.ending.outcome, 'ready'); assert.equal(w.InteractiveKoreanStoryService.best(), 100);
w.CultureDecisionGameService.start(); while (!app.state.immersiveKoreanWorldRuntime.culture.completed) { const question = w.CultureDecisionGameService.current(); assert.equal(w.CultureDecisionGameService.answer(question.correctIndex).correct, true); if (!app.state.immersiveKoreanWorldRuntime.culture.completed) w.CultureDecisionGameService.next(); } assert.equal(w.CultureDecisionGameService.best(), 100);

assert.equal(w.LanguageSurvivalModeService.enabled(), false); assert.equal(w.LanguageSurvivalModeService.set(true), true); assert.equal(w.LanguageSurvivalModeService.enabled(), true); assert.equal(app.getSettings().showRomanization, false); assert.equal(app.getSettings().translationDisplay, 'hidden');
assert.equal(w.ScenarioLibraryService.all().length, 7); assert.equal(w.ScenarioLibraryService.setRole('student'), true); assert.ok(w.ScenarioLibraryService.filtered().every((item) => item.role === 'student')); assert.equal(w.ScenarioLibraryService.setRole('invalid'), false);
const map = w.ImmersiveProgressMapService.summary(); assert.deepEqual(map.nodes.map((item) => item.id), ['beginner', 'intermediate', 'advanced']); assert.ok(map.total >= 7); assert.ok(map.nextMission);
const readiness = w.RealWorldReadinessService.calculate(); assert.ok(readiness.score >= 50); assert.equal(readiness.evidence.cityTotal, 4); assert.equal(readiness.evidence.cityCompleted, 1); assert.match(readiness.disclaimer, /không phải chứng nhận/i);
assert.ok(app.syncEvents.includes('immersive-korean-world')); assert.equal(JSON.stringify(w.ImmersiveKoreanWorldProgressService.snapshot()).includes('안녕하세요'), false, 'P44 progress must not store free text');

for (const route of ['immersive-daily-life', 'immersive-story', 'immersive-culture-game', 'immersive-readiness', 'immersive-scenarios', 'immersive-progress-map']) assert.equal(typeof w.KLEARN_EXTRA_VIEWS[route], 'function', `${route} missing`);
const other = boot('p44-other'); other.window.ImmersiveKoreanWorldContentService.hydrate(content); assert.equal(other.window.ImmersiveKoreanWorldProgressService.snapshot().dailyRuns.length, 0, 'P44 data must be user scoped');
assert.match(migration, /immersive_korean_world_profiles/); assert.match(migration, /immersive_korean_world_events/); assert.match(migration, /row level security/i); assert.match(migration, /auth\.uid\(\)/); assert.match(migration, /raw_text_stored boolean not null default false check \(raw_text_stored = false\)/); assert.match(migration, /raw_audio_stored boolean not null default false check \(raw_audio_stored = false\)/);
assert.match(index, /immersive-korean-world\.css\?v=2/); assert.match(index, /data\/immersive-korean-world\.js\?v=2/); assert.match(index, /app\.js\?v=66/); assert.match(worker, /klearn-v80/); assert.match(worker, /content\/immersive-korean-world\.json/); assert.match(appSource, /immersiveKoreanWorld: 'klearn_immersive_korean_world'/); assert.match(appSource, /STORAGE_KEYS\.immersiveKoreanWorld/);
console.log('P58 immersive Korean world: airport/cafe/university/office city, three roles, story decisions, cultural training, survival mode, scenario library, readiness and progress map passed');
