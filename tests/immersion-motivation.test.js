const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'immersion-motivation-data.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'immersion-motivation.js'), 'utf8');
const scoped = new Map();

function boot({ userId = 'learner-a', foundationReady = false, topikPassed = false, calendar = {} } = {}) {
  const state = {
    currentUser: { id: userId, fullName: 'Nguyễn Minh', currentTopikLevel: 1, createdAt: '2026-01-05T00:00:00.000Z' },
    currentView: 'immersion-journey',
    srsData: [{ id: 'one', status: 'mastered' }, { id: 'two', status: 'learning' }]
  };
  const progress = { foundation: { checkpoint: foundationReady ? { readyForTopik1: true, completedAt: '2026-02-01T00:00:00.000Z' } : {} }, pronunciationAttempts: [{ score: 80 }, { score: 90 }], stats: { streak: 4 } };
  const history = topikPassed ? [{ id: 'exam-1', level: 'TOPIK_1', setTitle: 'TOPIK 1', percentage: 86, completedAt: '2026-03-01T00:00:00.000Z' }] : [];
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { immersionMotivation: 'immersion', achievements: 'achievements' },
      render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      userScoped: (key) => (scoped.get(key) || {})[userId] || [],
      saveUserScoped: (key, items) => { const values = scoped.get(key) || {}; values[userId] = items; scoped.set(key, values); },
      getUserProgress: () => progress,
      PracticeService: { getHistory: () => history },
      MasteryService: { updateLesson: (...args) => { window.masteryUpdate = args; } },
      CloudSyncService: { schedule: (reason) => { window.syncReason = reason; } },
      speakKorean: () => {}
    },
    StudyCalendarService: { activityByDay: () => calendar },
    AchievementService: { all: () => [{ id: 'first-hangul', icon: '🏆', title: 'Đọc Hangul đầu tiên', unlocked: true, unlockedAt: '2026-01-06T00:00:00.000Z' }, { id: 'streak-7', icon: '🏆', title: '7 ngày', unlocked: false }] },
    MilestoneService: { refresh: () => [{ id: 'started', title: { vi: 'Bắt đầu học tiếng Hàn' }, reachedAt: '2026-01-05T00:00:00.000Z' }] },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(moduleSource, context);
  return window;
}

const app = boot({ foundationReady: true, topikPassed: true });
assert.equal(app.SurvivalKitService.catalog().length, 5);
assert.deepEqual([...app.SurvivalKitService.catalog().map((item) => item.place)], ['Sân bay', 'Nhà hàng', 'Bệnh viện', 'Ngân hàng', 'Thuê nhà']);
app.SurvivalKitService.select('survival-restaurant');
const correct = app.SurvivalKitService.evaluate('이거 하나 주세요.');
assert.equal(correct.correct, true);
assert.equal(correct.score, 100);
assert.equal(app.masteryUpdate[0], 'survival:survival-restaurant');
app.SurvivalKitService.completeLesson('survival-restaurant');
assert.ok(app.SurvivalKitService.progress().completedSurvivalIds.includes('survival-restaurant'));

assert.equal(app.MediaLearningService.catalog().length, 3);
assert.match(app.KLEARN_EXTRA_VIEWS['media-learning'](), /TamHoanq biên soạn/);
assert.match(app.KLEARN_EXTRA_VIEWS['media-learning'](), /Từ mới/);
assert.match(app.KLEARN_EXTRA_VIEWS['media-learning'](), /Grammar/);
app.MediaLearningService.complete('media-friends');
assert.ok(app.SurvivalKitService.progress().completedMediaIds.includes('media-friends'));

assert.match(app.KLEARN_EXTRA_VIEWS['slang-dictionary'](), /ㅋㅋㅋ/);
assert.match(app.KLEARN_EXTRA_VIEWS['slang-dictionary'](), /대박/);
assert.match(app.KLEARN_EXTRA_VIEWS['slang-dictionary'](), /Mức độ/);
assert.match(app.KLEARN_EXTRA_VIEWS['slang-dictionary'](), /Tránh dùng/);

const fixedDate = new Date(2026, 8, 5, 12, 0, 0);
assert.deepEqual(app.DailyKoreanFeedService.today(fixedDate), app.DailyKoreanFeedService.today(fixedDate), 'daily feed is deterministic');
app.DailyKoreanFeedService.complete(fixedDate);
assert.equal(app.DailyKoreanFeedService.completed(fixedDate), true);

const challenge = app.MonthlyChallengeService.join(fixedDate);
assert.equal(challenge.month, '2026-09');
const checked = app.MonthlyChallengeService.checkIn(fixedDate);
assert.ok(checked.days.includes('2026-09-05'));
assert.equal(app.MonthlyChallengeService.checkIn(fixedDate).days.length, checked.days.length, 'a challenge day is counted once');

const achievement = app.AchievementRoomService.summary();
assert.equal(achievement.unlocked, 1);
assert.equal(achievement.milestones.length, 1);
assert.equal(achievement.certificates.length, 2);
assert.match(app.KLEARN_EXTRA_VIEWS['achievement-room'](), /không phải chứng chỉ TOPIK chính thức/);

const portfolio = app.PersonalPortfolioService.snapshot();
assert.equal(portfolio.level, 'TOPIK 1');
assert.equal(portfolio.vocabulary.mastered, 1);
assert.equal(portfolio.speaking.average, 85);
assert.match(app.KLEARN_EXTRA_VIEWS['personal-portfolio'](), /Nguyễn Minh/);
assert.match(app.KLEARN_EXTRA_VIEWS['immersion-journey'](), /Korean Survival Kit/);
assert.match(app.KLEARN_EXTRA_VIEWS['immersion-journey'](), /Nhiệm vụ thực tế/);
assert.match(app.KLEARN_EXTRA_VIEWS['immersion-journey'](), /Nhật ký học tập/);
assert.match(app.KLEARN_EXTRA_VIEWS['immersion-journey'](), /Learning Timeline/);

const isolated = boot({ userId: 'learner-b' });
assert.equal(isolated.SurvivalKitService.progress().completedSurvivalIds, undefined, 'immersion progress stays user scoped');
assert.equal(isolated.AchievementRoomService.certificates().length, 0, 'certificates stay user scoped and evidence based');
assert.equal(typeof isolated.KLEARN_EXTRA_VIEWS['monthly-challenge'], 'function');

console.log('immersion motivation: survival, original media, slang, deterministic feed, challenge, achievements and private portfolio passed');
