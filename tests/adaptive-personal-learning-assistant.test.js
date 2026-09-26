const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'adaptive-engine.js'), 'utf8');

function boot() {
  const values = new Map();
  const userId = 'adaptive-user-a';
  const now = new Date().toISOString();
  const focusSessions = [];
  const srsData = Array.from({ length: 23 }, (_, index) => ({ id: `card-${index}`, wordId: `word-${index}`, dueAt: new Date(Date.now() - (index + 1) * 86400000).toISOString(), wrongCount: index < 3 ? 3 : 0, mastery: index < 3 ? 35 : 65, createdAt: now, tags: index < 5 ? ['TOPIK'] : [] }));
  const errors = Array.from({ length: 5 }, (_, index) => ({ id: `error-${index}`, type: 'listening', errorType: 'listening', questionType: index < 3 ? 'time_place' : 'detail', question: `Listening ${index}`, count: index < 3 ? 2 : 1, repetitionCount: index < 3 ? 2 : 1, resolved: false, lastSeen: now }));
  const quizHistory = [{ id: 'quiz-1', completedAt: now, durationSeconds: 600, percentage: 67, skillBreakdown: { listening: 48, reading: 88, vocabulary: 64, grammar: 71 }, questionTypeBreakdown: { time_place: 42, detail: 48, inference: 58 } }];
  const examHistory = [{ id: 'topik-1', setTitle: 'TOPIK Practice 102', completedAt: now, durationSeconds: 1800, percentage: 62, skillBreakdown: { listening: 52, reading: 78 }, questionTypeBreakdown: { main_idea: 70, detail: 48, time_place: 42, inference: 51 } }];
  values.set('exam-attempts', { [userId]: { history: examHistory } });
  const storage = { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => values.set(key, value) };
  const state = { currentUser: { id: userId, level: 'Beginner', currentTopikLevel: 1, targetTopikLevel: 3, studyMinutesPerDay: 30, learningStyle: 'exam', learningMode: 'topik', goals: ['topik'] }, srsData };
  const progress = { stats: { streak: 4, lessonsCompleted: 8 }, daily: { studyMinutes: 12 }, skills: { listening: 48, reading: 88, vocabulary: 64, grammar: 71 } };
  const window = {
    KLEARN_APP: {
      storage, state,
      STORAGE_KEYS: { examAttempts: 'exam-attempts', focusSessions: 'focus-sessions', dailyMissions: 'daily-missions', learningGoals: 'learning-goals', adaptiveRoadmaps: 'adaptive-roadmaps' },
      render: () => {}, setView: () => {}, toast: () => {}, escapeHtml: String, getUserProgress: () => progress,
      userScoped: (key) => key === 'focus-sessions' ? focusSessions : [], saveUserScoped: () => {},
      LearnerProfileService: { get: () => ({ currentTopikLevel: 1, targetTopikLevel: 3, currentLevel: 'Beginner', skillScores: { listening: 48, reading: 88, vocabulary: 64, grammar: 71 }, learningStyle: 'exam', learningMode: 'topik', studyMinutesPerDay: 30, dueSrsCount: 23 }) },
      PracticeService: { getHistory: () => quizHistory, statistics: () => ({ average: 67, weakTopics: [['listening', 48]] }) },
      VocabularyService: { dueCards: () => srsData }, CloudSyncService: { schedule: () => {} }
    },
    ErrorNotebookService: { all: () => errors, top: () => errors },
    LearningMemoryService: { all: () => [] }, KnowledgeGraphService: { weaknessAnalysis: () => [] }, LanguageScienceService: { adaptiveContext: () => ({ priorityErrors: [] }) },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_EXTRA_HOME: null, KLEARN_EXTRA_PROFILE: null, KLEARN_AFTER_RENDER: null
  };
  const document = { querySelectorAll: () => [], querySelector: () => null, getElementById: () => null };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, FormData: class {} };
  vm.createContext(context);
  vm.runInContext(source, context);
  return { window, values, focusSessions, srsData, errors, quizHistory, examHistory, progress };
}

const runtime = boot();
const engine = runtime.window.AdaptiveLearningEngine;

const goal = engine.goals.saveGoal({ currentLevel: 'Beginner', targetLevel: 3, targetMonths: 6, dailyMinutes: 30, studyDaysPerWeek: 6, prioritySkills: ['listening', 'vocabulary'], personalGoal: 'Thi TOPIK 3' });
assert.equal(goal.currentLevel, 'Beginner');
assert.equal(goal.targetLevel, 3);
assert.equal(goal.dailyMinutes, 30);
assert.deepEqual([...goal.prioritySkills], ['listening', 'vocabulary']);
assert.equal(engine.goals.getGoal().personalGoal, 'Thi TOPIK 3', 'goal persists locally for offline use');

const profile = engine.profile.snapshot();
assert.equal(profile.srs.due, 23);
assert.equal(profile.skillScores.listening, 50, 'profile combines quiz and TOPIK evidence');
assert.equal(profile.skillScores.reading, 83);
assert.equal(profile.errors.unresolved, 5);
assert.equal(profile.topikAttempts, 1);

const weaknesses = engine.weaknesses.detect({ learningProfile: profile });
assert.equal(weaknesses[0].questionType, 'time_place');
assert.ok(weaknesses.some((item) => item.skill === 'listening'));
assert.equal(weaknesses.some((item) => item.skill === 'reading' && item.kind === 'skill'), false, 'strong reading is not promoted as a weakness');

const cause = engine.rootCauses.analyze(weaknesses.find((item) => item.skill === 'listening'));
assert.equal(cause.ready, true);
assert.match(cause.message, /lặp/);
assert.equal(engine.rootCauses.analyze({ skill: 'writing', label: 'Viết' }).ready, false, 'root cause is not invented without evidence');

const session = engine.generateLearningSession({ availableMinutes: 30, userGoal: goal, learningProfile: profile, weaknesses, srsDue: 23, recentErrors: runtime.errors, currentLevel: 'Beginner', targetTOPIK: 3, ignoreInactivity: true });
assert.equal(session.tasks.reduce((sum, item) => sum + item.minutes, 0), 30);
assert.equal(session.tasks[0].type, 'srs');
assert.ok(session.tasks.some((item) => item.type === 'listening'));
assert.ok(session.tasks.some((item) => item.type === 'repair'));
assert.equal(session.tasks.some((item) => item.type === 'reading'), false);
assert.ok(session.tasks.every((item) => item.reason && item.priority >= 1));
assert.deepEqual(JSON.parse(JSON.stringify(engine.generateLearningSession({ availableMinutes: 30, userGoal: goal, learningProfile: profile, weaknesses, srsDue: 23, recentErrors: runtime.errors, currentLevel: 'Beginner', targetTOPIK: 3, ignoreInactivity: true }).tasks)), JSON.parse(JSON.stringify(session.tasks)), 'same evidence produces deterministic tasks');

const five = engine.generateLearningSession({ availableMinutes: 5, learningProfile: profile, weaknesses, srsDue: 23, recentErrors: runtime.errors, ignoreInactivity: true });
assert.equal(five.tasks.reduce((sum, item) => sum + item.minutes, 0), 5);
assert.deepEqual([...five.tasks.map((item) => item.type)], ['srs', 'repair', 'quiz']);
for (const minutes of [45, 60, 90]) assert.equal(engine.generateLearningSession({ availableMinutes: minutes, learningProfile: profile, weaknesses, srsDue: 23, recentErrors: runtime.errors, ignoreInactivity: true }).tasks.reduce((sum, item) => sum + item.minutes, 0), minutes);

const ranked = engine.srsPriority.rank(runtime.srsData);
assert.ok(ranked[0].priorityReasons.some((reason) => /quá hạn/.test(reason)), 'overdue cards are ranked first');
assert.ok(ranked.some((card) => card.wrongCount === 3 && card.priorityReasons.some((reason) => /sai 3 lần/.test(reason))), 'repeated failures receive explicit additional priority');

const ago = (days) => new Date(Date.now() - days * 86400000).toISOString();
assert.equal(engine.inactivity.status(ago(1)).mode, 'normal');
assert.equal(engine.inactivity.status(ago(3)).mode, 'light');
assert.equal(engine.inactivity.status(ago(7)).mode, 'welcome-back');
assert.equal(engine.generateLearningSession({ availableMinutes: 30, lastActivityAt: ago(7), learningProfile: profile, weaknesses, srsDue: 23, recentErrors: runtime.errors }).minutes, 10);

const readiness = engine.readiness.snapshot(3);
assert.equal(readiness.targetLevel, 3);
assert.equal(readiness.attempts, 1);
assert.match(readiness.disclaimer, /không dự đoán/);
assert.equal(engine.weeklyPlan.weekly({ userGoal: goal, weaknesses }).length, 7);
assert.equal(engine.progress.snapshot('7d').topikScore, 62);

const completedSession = { id: 'completed-session', status: 'completed', targetMinutes: 30, actualMinutes: 30, completedAt: new Date().toISOString(), tasks: session.tasks.map((item) => ({ ...item, completed: true })) };
runtime.focusSessions.unshift(completedSession);
const resultLoop = engine.results.record(completedSession, { listening: { score: 82, correct: 8, total: 10 } });
assert.equal(resultLoop.session.result.measuredTasks, 1);
assert.equal(resultLoop.nextRecommendation.minutes, 30);
const updatedProfile = engine.profile.snapshot();
assert.equal(updatedProfile.study.sessions, 1);
assert.ok(updatedProfile.skillScores.listening > profile.skillScores.listening, 'measured session result updates the dynamic profile');
const next = engine.generateLearningSession({ availableMinutes: 30, learningProfile: updatedProfile, weaknesses, srsDue: 23, recentErrors: runtime.errors, ignoreInactivity: true });
assert.notEqual(next.evidenceSignature, session.evidenceSignature, 'completed result updates profile evidence and next recommendation signature');

const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260927_adaptive_personal_learning_assistant.sql'), 'utf8');
for (const table of ['learning_goals', 'learning_profiles', 'skill_mastery', 'adaptive_recommendations', 'learning_plans', 'learning_plan_tasks', 'learning_sessions', 'weak_areas']) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
assert.match(migration, /enable row level security/);
assert.match(migration, /auth\.uid\(\) = user_id/g);
assert.match(migration, /revoke all on public\.%I from anon/);

console.log('adaptive personal learning assistant: goal, profile, weaknesses, root cause, deterministic sessions, SRS, TOPIK, inactivity, progress, offline persistence, RLS and E2E passed');
