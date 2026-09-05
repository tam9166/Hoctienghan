const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'long-term-ecosystem-data.js'), 'utf8');
const systemSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'long-term-ecosystem.js'), 'utf8');
const scoped = new Map();
let role = 'student';

function boot(userId = 'learner-a') {
  const state = { currentUser: { id: userId, studyMinutesPerDay: 20 }, currentView: 'home', longTerm: null };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: {
        realGoalPlans: 'real-goals', learningJournal: 'journal', teacherFeedback: 'teacher-feedback', manualReviewQueue: 'manual-review', teacherWorkspace: 'teacher-workspace', communityProgress: 'community-progress'
      },
      render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      userScoped: (key) => scoped.get(key)?.[state.currentUser?.id] || [],
      saveUserScoped: (key, items) => { const all = scoped.get(key) || {}; all[state.currentUser?.id] = items; scoped.set(key, all); },
      AccessControlService: { role: () => role },
      DictionaryService: { byId: () => null }
    },
    KLEARN_LONG_TERM_DATA: null,
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    AchievementService: { all: () => [] }
  };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(systemSource, context);
  return window;
}

const app = boot();
const data = app.KLEARN_LONG_TERM_DATA;
assert.equal(data.strategyModules.length, 5);
assert.deepEqual([...data.strategyModules.map((item) => item.id)], ['listening', 'reading', 'time', 'patterns', 'mistakes']);
assert.deepEqual([...data.goalTemplates.map((item) => item.id)], ['study-korea', 'work-korea', 'career-korean', 'daily-life']);
assert.deepEqual([...data.communityEvents.map((item) => item.type)], ['challenge', 'challenge', 'learning-event']);

for (const route of ['topik-strategy-center', 'real-goal-planner', 'learning-journal', 'teacher-review', 'manual-review-queue', 'teacher-workspace', 'community-hub']) {
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
  assert.match(app.KLEARN_EXTRA_VIEWS[route](), /^<section/);
}
for (const months of [3, 6, 12]) {
  const plan = app.RealGoalPlannerService.generate('study-korea', months, 30);
  assert.equal(plan.months, months);
  assert.ok(plan.phases.length >= 3);
  assert.equal(plan.phases.reduce((sum, phase) => sum + phase.ratio, 0), 100);
  assert.equal(plan.dailyMinutes, 30);
}
const savedPlan = app.RealGoalPlannerService.save({ goalId: 'work-korea', months: 6, dailyMinutes: 25 });
assert.equal(app.RealGoalPlannerService.current().goalId, 'work-korea');
assert.equal(savedPlan.phases[0].focus, 'An toàn và chỉ dẫn nơi làm việc');

const firstJournal = app.LearningJournalService.add({ learned: 'Ôn 15 từ TOPIK 1', difficulty: 'Trợ từ 은/는', nextGoal: 'Luyện câu ngắn' });
assert.ok(firstJournal);
assert.equal(app.LearningJournalService.summary().count, 1);
const userB = boot('learner-b');
assert.equal(userB.LearningJournalService.all().length, 0, 'journal is private per user');
app.KLEARN_APP.state.currentUser = { id: 'learner-b' };
assert.equal(app.LearningJournalService.all().length, 0, 'switching user cannot read another journal');
app.KLEARN_APP.state.currentUser = { id: 'learner-a' };
assert.equal(app.LearningJournalService.all().length, 1);

const feedback = app.TeacherFeedbackService.evaluate({ type: 'sentence', prompt: 'Giới thiệu bản thân', submission: '저는 학생이에요.' });
assert.ok(feedback.score >= 80);
assert.ok(feedback.strengths.length);
assert.ok(feedback.improvements.length);
app.TeacherFeedbackService.save(feedback);
const reviewItem = app.ManualReviewQueueService.add({ type: 'sentence', title: '저는 학생이에요.', content: feedback.nextExercise, sourceId: feedback.id });
assert.equal(reviewItem.status, 'today');
app.ManualReviewQueueService.decide(reviewItem.id, 'later');
assert.equal(app.ManualReviewQueueService.all()[0].status, 'later');
app.ManualReviewQueueService.decide(reviewItem.id, 'skipped');
assert.equal(app.ManualReviewQueueService.all()[0].status, 'skipped');

assert.equal(app.TeacherWorkspaceService.addLearner({ studentCode: 'student-1', displayName: 'Minh' }), null, 'student cannot access teacher roster');
role = 'teacher';
const learner = app.TeacherWorkspaceService.addLearner({ studentCode: 'student-1', displayName: 'Minh' });
assert.ok(learner);
assert.ok(app.TeacherWorkspaceService.addAssignment('student-1', { title: 'Reading Lab tuần 1' }));
assert.ok(app.TeacherWorkspaceService.addComment('student-1', 'Hãy chú ý trợ từ.'));
assert.equal(app.TeacherWorkspaceService.records()[0].assignments.length, 1);
assert.equal(app.TeacherWorkspaceService.records()[0].comments.length, 1);
role = 'student';
assert.equal(app.TeacherWorkspaceService.canRead(learner), false, 'teacher records are role-gated');

assert.ok(app.CommunityFoundationService.join('event-reading-week'));
assert.equal(app.CommunityFoundationService.joined('event-reading-week').progress, 0);
assert.equal(/journal|difficulty|teacher/i.test(app.KLEARN_EXTRA_VIEWS['community-hub']()), false);
console.log('long-term ecosystem: strategy, goals, journal privacy, review queue, teacher roles and community foundation passed');
