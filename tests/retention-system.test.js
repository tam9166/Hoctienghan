const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'retention-system.json'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'data', 'retention-system.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_advanced_retention_system.sql'), 'utf8');

function boot({ userId = 'retention-user', events = [], progress = 50, role = 'student', history = [], mastered = [] } = {}) {
  const scoped = new Map();
  const state = { currentUser: { id: userId, fullName: 'Nguyễn An', studyMinutesPerDay: 20, targetTopikLevel: 2 }, currentView: 'retention-center', lessonProgress: {}, srsData: mastered, retentionRuntime: null };
  const focus = { all: () => events, };
  const app = {
    state,
    STORAGE_KEYS: { retention: 'retention' },
    render: () => {},
    setView: (view) => { state.currentView = view; },
    toast: () => {},
    escapeHtml: (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
    userScoped: (key) => scoped.get(key)?.[userId] || [],
    saveUserScoped: (key, value) => { const all = scoped.get(key) || {}; all[userId] = value; scoped.set(key, all); },
    getUserProgress: () => ({ stats: { streak: 2 } }),
    PracticeService: { getHistory: () => history },
    LearnerProfileService: { get: () => ({ strengths: ['vocabulary'], weakSkills: ['listening'], studyMinutesPerDay: 20 }) },
    AccessControlService: { role: () => role },
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    KLEARN_APP: app,
    FocusSessionService: focus,
    GoalTrackingService: { getGoal: () => ({ goalType: 'topik', targetLevel: 2 }), progress: () => progress },
    VocabularyService: { dueCards: () => [] },
    NotificationService: { get: () => ({ dailyPlan: true }) },
    SupabaseService: null,
    KLEARN_EXTRA_VIEWS: {},
    KLEARN_AFTER_RENDER: null,
    document
  };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, fetch: () => Promise.reject(new Error('unit test offline')), setTimeout, clearTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  window.RetentionContentService.hydrate(content);
  return { window, state, scoped };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.equal(content.goalMilestones.count, 50);
assert.equal(Object.values(content.habit.weights).reduce((sum, item) => sum + item, 0), 100);

const now = Date.now();
const ago = (days, hour = 20) => new Date(now - days * 86400000).setHours(hour, 15, 0, 0);
const events = [
  { id: 'today', status: 'completed', completedAt: new Date(now - 864000).toISOString(), actualMinutes: 20, tasks: [{ completed: true }] },
  { id: 'yesterday', status: 'completed', completedAt: new Date(ago(1)).toISOString(), actualMinutes: 15, tasks: [{ completed: true }] },
  { id: 'two-days', status: 'completed', completedAt: new Date(ago(2)).toISOString(), actualMinutes: 10, tasks: [{ completed: true }] }
];
const learner = boot({ events });
const habit = learner.window.HabitFormationService.analyze();
assert.equal(habit.ready, true);
assert.ok(habit.eventCount >= 3);
assert.ok(habit.score >= 0 && habit.score <= 100);
assert.ok(habit.timeConsistency > 0, 'habit score includes time consistency beyond streak');
assert.equal(learner.window.SmartReminderService.candidate(new Date(), true), null, 'completed today suppresses reminder');

const weekly = learner.window.WeeklyReviewService.save();
assert.equal(learner.window.WeeklyReviewService.current().id, weekly.id);
assert.equal(learner.window.WeeklyReviewService.due(), false);
const reflection = learner.window.MonthlyReflectionService.saveReflection({ nextGoal: 'Hoàn thành 10 bài đọc', challenge: 'Nghe nhanh' });
assert.equal(reflection.nextGoal, 'Hoàn thành 10 bài đọc');
assert.equal(learner.window.MonthlyReflectionService.current().month, reflection.month);

const milestones = learner.window.GoalMilestoneService.all();
assert.equal(milestones.length, 50);
assert.equal(learner.window.GoalMilestoneService.summary().reached, 25);
assert.equal(new Set(milestones.map((item) => item.id)).size, 50);

const return7 = boot({ events: [{ id: 'old', status: 'completed', completedAt: new Date(ago(8)).toISOString(), actualMinutes: 10, tasks: [{ completed: true }] }] });
assert.equal(return7.window.ReactivationService.status().plan.id, 'return-7');
const return30 = boot({ events: [{ id: 'old', status: 'completed', completedAt: new Date(ago(31)).toISOString(), actualMinutes: 10, tasks: [{ completed: true }] }] });
assert.equal(return30.window.ReactivationService.status().plan.id, 'return-30');

const celebration = boot({ mastered: Array.from({ length: 100 }, (_, index) => ({ id: `w-${index}`, status: 'mastered' })), events: Array.from({ length: 3 }, (_, index) => ({ id: `h-${index}`, status: 'completed', completedAt: new Date(ago(index + 1)).toISOString(), actualMinutes: 1000, tasks: [{ completed: true }] })), history: [{ setId: 't1-reading', percentage: 72 }] });
const unlocked = celebration.window.LearningCelebrationService.unlocked().map((item) => item.id);
assert.deepEqual(unlocked.sort(), ['mastered-100', 'study-50-hours', 'topik-milestone'].sort());

const admin = boot({ role: 'admin' });
admin.window.SupabaseService = { session: { user: { app_metadata: { role: 'admin' } } }, client: { from: () => ({ select: () => ({ order: () => ({ limit: async () => ({ data: [{ metric_date: '2026-09-06', active_users: 4, returning_users: 2, inactive_7d_users: 1, inactive_30d_users: 0, drop_points: [] }], error: null }) }) }) }) } };
admin.window.RetentionAdminAnalyticsService.load();
setTimeout(() => {
  assert.equal(admin.window.RetentionAdminAnalyticsService.snapshot().activeUsers, 4);
  const student = boot({ role: 'student' });
  assert.equal(student.window.RetentionAdminAnalyticsService.available(), false);
  assert.match(appSource, /retention: 'klearn_retention'/);
  assert.match(appSource, /retention-center/);
  assert.match(indexSource, /retention-system\.css\?v=1/);
  assert.match(indexSource, /data\/retention-system\.js\?v=1/);
assert.match(workerSource, /klearn-v76/);
  assert.match(workerSource, /retention-system\.json/);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /app_metadata/);
  assert.match(migration, /revoke insert, update, delete/i);
  console.log('retention system: habit, reviews, milestones, reactivation, celebrations, admin aggregate and privacy passed');
}, 0);
