const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'daily-learning-experience.js'), 'utf8');
const scoped = new Map();
const focusByUser = new Map();

function question(id, skill) { return { id, skill, prompt: id, options: ['a', 'b'], correctAnswer: 'a' }; }
const questions = [
  ...Array.from({ length: 6 }, (_, index) => question(`v-${index}`, 'vocabulary')),
  ...Array.from({ length: 4 }, (_, index) => question(`l-${index}`, 'listening')),
  ...Array.from({ length: 3 }, (_, index) => question(`g-${index}`, 'grammar'))
];

function boot({ userId = 'learner-a', returning = false, history = [], errors = [], learningTrack = 'topik', calendarActivity = {} } = {}) {
  const originalProgress = { stats: { streak: 4, lessonsCompleted: 3 }, skills: { vocabulary: 62, grammar: 45, listening: 40 } };
  const state = { currentUser: { id: userId, fullName: 'Nguyễn Minh', learningTrack, goalLabel: 'TOPIK 1' }, currentView: 'home' };
  const focus = {
    all: () => focusByUser.get(userId) || [],
    active() { return this.all().find((item) => ['active', 'paused'].includes(item.status)); },
    start(minutes) { const item = { id: `focus-${userId}`, targetMinutes: minutes, status: 'active', startedAt: new Date().toISOString(), tasks: [], currentTask: 0 }; focusByUser.set(userId, [item]); return item; },
    save(session) { focusByUser.set(userId, [session, ...this.all().filter((item) => item.id !== session.id)]); },
    completeTask(session) { session.tasks[session.currentTask].completed = true; if (session.tasks.every((item) => item.completed)) { session.status = 'completed'; session.completedAt = new Date().toISOString(); session.actualMinutes = session.targetMinutes; } else session.currentTask += 1; this.save(session); }
  };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { dailyExperience: 'daily-experience' },
      render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      getUserProgress: () => originalProgress,
      userScoped: (key) => scoped.get(key)?.[userId] || [],
      saveUserScoped: (key, items) => { const values = scoped.get(key) || {}; values[userId] = items; scoped.set(key, values); },
      PracticeService: {
        bank: { sets: [{ id: 'set-1' }], getQuestions: () => questions },
        getHistory: () => history,
        startQuestions: (items, title, type) => { window.startedQuick = { items, title, type }; return true; }
      },
      LearnerProfileService: { get: () => ({ skillScores: originalProgress.skills }) }
    },
    FocusSessionService: focus,
    ErrorNotebookService: { top: () => errors },
    ComebackModeService: { status: () => ({ active: returning }) },
    LearningDirectorService: { plan: () => ({ tasks: [{ type: 'skill', title: 'Luyện nghe đang yếu', reason: 'Listening score 40%.' }] }) },
    StudyCalendarService: { activityByDay: () => calendarActivity },
    ManualReviewQueueService: { all: () => [], dueToday: () => [], add: () => null, decide: () => null },
    RealGoalPlannerService: { current: () => null },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null
  };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { window, progress: originalProgress };
}

const newcomer = boot({ userId: 'new-user', learningTrack: 'foundation' });
assert.match(newcomer.window.DailyLearningExperienceService.homeView(), /Bắt đầu học hôm nay/);
assert.match(newcomer.window.DailyLearningExperienceService.homeView(), /Chưa có lỗi cần sửa/);
assert.equal(newcomer.window.DailyLearningExperienceService.plan.build(15).tasks[1].route, 'foundation');
assert.deepEqual(newcomer.progress, { stats: { streak: 4, lessonsCompleted: 3 }, skills: { vocabulary: 62, grammar: 45, listening: 40 } }, 'rendering does not mutate progress');

const existing = boot({ userId: 'existing-user', errors: [{ id: 'e-1', type: 'grammar', mistake: '저가 학생', correction: '제가 학생', explanation: 'Dùng 제가.', count: 2 }] });
const service = existing.window.DailyLearningExperienceService;
assert.deepEqual([...service.durations], [5, 15, 30, 60]);
assert.equal(service.plan.build(5).tasks.length, 1);
assert.equal(service.plan.build(15).tasks.reduce((sum, task) => sum + task.minutes, 0), 15);
assert.equal(service.plan.build(30).tasks.reduce((sum, task) => sum + task.minutes, 0), 30);
assert.equal(service.plan.build(60).tasks.reduce((sum, task) => sum + task.minutes, 0), 60);
assert.match(service.homeView(), /저가 학생/);
const session = service.sessions.start(15);
assert.equal(session.source, 'daily-experience');
assert.deepEqual([...session.tasks.map((item) => item.minutes)], [5, 5, 5]);
assert.equal(service.sessions.progress(session), 0);
service.sessions.completeCurrent();
assert.equal(service.sessions.progress(session), 33);
assert.equal(typeof existing.window.KLEARN_EXTRA_VIEWS['daily-session'], 'function');
assert.match(existing.window.KLEARN_EXTRA_VIEWS['daily-session'](), /Đã xong, tiếp tục/);

const activityKey = new Date().toISOString().slice(0, 10);
const withCalendarActivity = boot({ userId: 'calendar-user', calendarActivity: { [activityKey]: { date: activityKey, minutes: 15, lessons: 1 } } });
assert.match(withCalendarActivity.window.DailyLearningExperienceService.homeView(), /15′/, 'calendar activity date strings must not replace Date objects');

const completedUser = boot({ userId: 'completed-user' });
completedUser.window.DailyLearningExperienceService.sessions.start(5);
completedUser.window.DailyLearningExperienceService.sessions.completeCurrent();
assert.match(completedUser.window.DailyLearningExperienceService.homeView(), /Đã hoàn thành hôm nay/);

const quick = service.quickPractice.questions();
assert.equal(quick.length, 9);
assert.equal(quick.filter((item) => item.skill === 'vocabulary').length, 5);
assert.equal(quick.filter((item) => item.skill === 'listening').length, 3);
assert.equal(quick.filter((item) => item.skill === 'grammar').length, 1);
assert.equal(service.quickPractice.start(), true);
assert.equal(existing.window.startedQuick.items.length, 9);

const returning = boot({ userId: 'returning-user', returning: true, errors: [{ id: 'e-2', mistake: '은', correction: '는' }] });
const recovery = returning.window.DailyLearningExperienceService.plan.build(15);
assert.equal(recovery.recovery, true);
assert.deepEqual([...recovery.tasks.map((item) => item.title)], ['Ôn 10 từ quan trọng', 'Sửa 1 lỗi cần nhớ', 'Học 1 bài ngắn']);
assert.equal(recovery.tasks.reduce((sum, item) => sum + item.minutes, 0), 15);
assert.match(returning.window.DailyLearningExperienceService.homeView(), /Recovery Plan · Ngày 1/);

const habit = boot({ userId: 'habit-user', history: [
  { completedAt: new Date(2026, 8, 5, 20, 10).toISOString(), durationSeconds: 600, skillBreakdown: { listening: 70 } },
  { completedAt: new Date(2026, 8, 4, 20, 35).toISOString(), durationSeconds: 900, skillBreakdown: { listening: 80, grammar: 60 } }
] }).window.DailyLearningExperienceService.habits.analyze();
assert.equal(habit.ready, true);
assert.equal(habit.bestWindow, '20:00–22:00');
assert.equal(habit.topSkill, 'Nghe');

const isolated = boot({ userId: 'isolated-user' });
assert.equal(isolated.window.DailyLearningExperienceService.sessions.active(), null, 'daily sessions remain user scoped');
console.log('daily learning experience: new, existing and returning users; one-click sessions, quick practice, habits and privacy passed');
