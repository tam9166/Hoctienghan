const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const values = new Map();
const scoped = new Map();
let fetchCount = 0;
let history = [];
let progress = { foundation: { learnedCharacters: [], checkpoint: null }, stats: { streak: 1 } };
const state = { currentUser: { id: 'qa', createdAt: '2026-01-01T00:00:00.000Z', currentTopikLevel: 1 }, srsData: [], cms: null };
const access = { role: () => 'admin', isCloudReady: () => false };
const window = {
  KLEARN_APP: {
    storage: { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) },
    state, STORAGE_KEYS: { contentCatalogCache: 'catalog', contentDrafts: 'drafts', achievements: 'achievements' }, render: () => {}, setView: () => {}, toast: () => {}, escapeHtml: String,
    getUserProgress: () => progress, userScoped: (key) => scoped.get(key) || [], saveUserScoped: (key, value) => scoped.set(key, value), updateCurrentUser: () => {},
    LearnerProfileService: { get: () => ({ weeklyStudyMinutes: 0 }) }, PracticeService: { getHistory: () => history }, CloudSyncService: { schedule: () => {} }, AccessControlService: access
  },
  AccessControlService: access,
  KLEARN_EXTRA_VIEWS: {},
  KLEARN_AFTER_RENDER: null
};
const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, document: {}, navigator: { onLine: true }, setTimeout, fetch: async () => { fetchCount += 1; return { ok: true, clone() { return this; }, async json() { return { schemaVersion: 1, pages: [] }; } }; } };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'ecosystem-scale.js'), 'utf8'), context);

assert.equal(fetchCount, 0, 'content must not load at application startup');

(async () => {
  const catalog = await window.ContentRepository.catalog();
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(fetchCount, 1, 'catalog loads lazily on first request');
  await window.ContentRepository.catalog();
  assert.equal(fetchCount, 1, 'catalog is memory cached');

  const invalid = window.ContentAdminService.validate({ title: 'Unverified approval', type: 'lesson', difficulty: 'TOPIK_1', source: 'curriculum', reviewStatus: 'approved', verified: false });
  assert.ok(invalid.errors.some((message) => message.includes('verified')), 'approved content requires verification');
  const valid = window.ContentAdminService.validate({ title: 'Verified lesson', type: 'lesson', difficulty: 'TOPIK_1', source: 'curriculum', reviewStatus: 'approved', verified: true });
  assert.equal(valid.errors.length, 0);
  const invalidEnums = window.ContentAdminService.validate({ title: 'Bad metadata', type: 'widget', difficulty: 'LEVEL_99', reviewStatus: 'published', verified: true });
  assert.equal(invalidEnums.errors.length, 3, 'invalid quality-control enums cannot be normalized into valid values');

  let achievements = window.AchievementService.all();
  assert.equal(achievements.find((item) => item.id === 'first-hangul').unlocked, false, 'achievement cannot unlock without real progress');
  progress = { foundation: { learnedCharacters: ['ㅏ'], checkpoint: null }, stats: { streak: 1 } };
  achievements = window.AchievementService.all();
  assert.equal(achievements.find((item) => item.id === 'first-hangul').unlocked, true, 'real Hangul progress unlocks achievement');

  assert.equal(window.EcosystemTimelineService.steps().find((item) => item.id === 'topik-1').reachedAt, null, 'TOPIK milestone starts pending');
  history = [{ level: 'TOPIK_1', percentage: 72, completedAt: '2026-02-01T00:00:00.000Z' }];
  assert.equal(window.EcosystemTimelineService.steps().find((item) => item.id === 'topik-1').reachedAt, '2026-02-01T00:00:00.000Z', 'passing result unlocks TOPIK milestone');
  console.log('ecosystem scale: lazy content, quality gates and real milestones passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
