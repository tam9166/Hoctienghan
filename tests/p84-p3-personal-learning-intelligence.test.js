#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function boot({ userId = 'p84-p3-user', cards = [], decks = [], practice = [], errors = [], progress = null, audio = true } = {}) {
  const saves = []; const views = []; let directorCalls = 0;
  const state = { currentUser: { id: userId, fullName: 'P84 P3', currentTopikLevel: 2, targetTopikLevel: 4, studyMinutesPerDay: 15 }, currentView: 'vocabulary-intelligence-p84', srsData: structuredClone(cards), p82Vocabulary: null };
  const deckValues = structuredClone(decks);
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    P82DeckService: { all: () => structuredClone(deckValues), learningWords: (deckId) => structuredClone(deckValues.find((deck) => deck.id === deckId)?.customWords || []) },
    P82LearningSessionService: { start: (_deckId, options) => { views.push(`${options.source}:${options.count}:${options.wordIds?.length || 0}`); return { selectedWordIds: options.wordIds || ['word-1'] }; } },
    P84VocabularyHealthService: {}, P84ReviewIntelligenceService: { start: (_deckId, options) => { views.push(`review:${options.type}:${options.count}`); return true; } },
    P84VocabularyMastery: { audioAvailable: () => audio },
    LearningDirectorService: { plan: () => { directorCalls += 1; return { tasks: [{ id: 'existing-srs' }] }; } },
    ErrorNotebookService: { all: () => structuredClone(errors), top: () => structuredClone(errors) },
    KLEARN_APP: {
      state, STORAGE_KEYS: { focusSessions: 'focus' }, escapeHtml: String, render() {}, setView(view) { state.currentView = view; views.push(view); }, toast() {},
      getUserProgress: () => structuredClone(progress || { updatedAt: '2026-09-21T00:00:00.000Z', stats: { streak: 7 } }), getUserSrs: () => state.srsData,
      userScoped: () => [], saveUserScoped: (...args) => { saves.push(args); }, PracticeService: { getHistory: () => structuredClone(practice) },
      LearnerProfileService: { get: () => ({ currentTopikLevel: 2, targetTopikLevel: 4, studyMinutesPerDay: 15 }) }
    }
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone };
  vm.runInNewContext(read('data/personal-learning-intelligence.js'), context);
  return { window, state, saves, views, directorCalls: () => directorCalls };
}

function learnedFixture({ ageDays = 0, count = 24 } = {}) {
  const now = Date.now(); const customWords = []; const cards = [];
  for (let index = 0; index < count; index += 1) {
    const reviewed = new Date(now - (ageDays + index % 7) * 86400000).toISOString(); const id = `word-${index}`; const topic = index < count / 2 ? 'Education' : 'Work';
    customWords.push({ id, korean: `단어${index}`, meaning: `Nghĩa ${index}`, topic });
    cards.push({ id, wordId: id, deckId: 'deck-1', korean: `단어${index}`, topic, status: index < 16 ? 'mastered' : 'learning', mastery: index < 16 ? 88 : 35, reviewCount: 12, correctCount: 8, wrongCount: index < 16 ? 1 : 5, activatedAt: reviewed, lastReviewed: reviewed, updatedAt: reviewed, nextReview: new Date(now - 86400000).toISOString(), personalVocabularyEvidence: { modeStats: { 'ko-vi': { attempts: 5, correct: 5, wrong: 0 }, 'vi-ko': { attempts: 5, correct: 4, wrong: 1 }, 'context-fill': { attempts: 4, correct: 3, wrong: 1 }, 'listening-ko': { attempts: 4, correct: 2, wrong: 2 } } } });
  }
  const completedAt = new Date(now - ageDays * 86400000).toISOString();
  const decks = [{ id: 'deck-1', title: 'TOPIK II', customWords, updatedAt: completedAt, activeSession: null, sessionHistory: [{ id: 'session-1', selectedWordIds: customWords.slice(0, 12).map((word) => word.id), selectedWords: 12, attempts: 18, correctAttempts: 12, wrongAttempts: 6, completedAt, updatedAt: completedAt }] }];
  const practice = [{ id: 'p1', completedAt, skillBreakdown: { reading: 80, listening: 50 } }, { id: 'p2', completedAt, skillBreakdown: { reading: 76, listening: 54 } }];
  return { cards, decks, practice };
}

(() => {
  const fresh = boot(); const fw = fresh.window;
  assert.equal(fw.P84LearningSignalService.snapshot().enough, false);
  assert.equal(fw.P84LearningHealthService.dashboard().unlocked, false);
  assert.equal(fw.P84PersonalReportService.weekly().enough, false);
  assert.match(fw.KLEARN_EXTRA_VIEWS['vocabulary-intelligence-p84'](), /Chưa đủ dữ liệu/);

  const fixture = learnedFixture(); const rt = boot({ ...fixture, errors: [{ id: 'e1', count: 5, resolved: false, type: 'vocabulary-context' }] }); const w = rt.window;
  const signals = w.P84LearningSignalService.snapshot(); const profile = w.P84PrivateLearningProfileService.get(); const health = w.P84LearningHealthService.dashboard(); const week = w.P84PersonalReportService.weekly(); const month = w.P84PersonalReportService.monthly();
  assert.equal(signals.enough, true); assert.equal(signals.masteredWords, 16); assert.equal(signals.weakWords, 8); assert.equal(signals.dueCount, 24); assert.equal(signals.srsCompletionRate, 100); assert.equal(signals.frequentMistakes.length, 1);
  assert.ok(profile.strengths.some((item) => item.skill === 'vocabulary')); assert.ok(profile.strengths.some((item) => item.skill === 'reading')); assert.ok(profile.weaknesses.some((item) => item.skill === 'listening'));
  assert.equal(health.unlocked, true); assert.ok(health.vocabulary > 0); assert.match(health.label, /7 ngày liên tiếp/);
  assert.equal(week.enough, true); assert.equal(week.wordsStudied, 24); assert.equal(week.learningDays, 7); assert.equal(month.enough, true); assert.equal(month.vocabularyGrowth, 24); assert.equal(month.strongTopic.topic, 'Education');
  assert.match(w.KLEARN_EXTRA_VIEWS['vocabulary-intelligence-p84'](), /Luyện ngay/); assert.match(w.KLEARN_EXTRA_VIEWS['vocabulary-report-p84'](), /Weekly Report/);

  const five = w.P84AdaptivePlanService.plan(5); assert.equal(five.minutes, 5); assert.equal(five.tasks.length, 1); assert.equal(five.tasks[0].count, 5); assert.equal(five.offline, true);
  const thirty = w.P84AdaptivePlanService.plan(30); assert.ok(thirty.tasks.some((item) => item.type === 'srs')); assert.ok(thirty.tasks.some((item) => item.type === 'context')); assert.ok(thirty.tasks.some((item) => item.type === 'new')); assert.ok(thirty.tasks.some((item) => item.type === 'listening')); assert.ok(rt.directorCalls() >= 2, 'must reuse the existing Learning Director');
  const goal = w.P84GoalTrackingService.get(); assert.deepEqual({ current: goal.currentTopikLevel, target: goal.targetTopikLevel }, { current: 2, target: 4 }); assert.equal(goal.vocabularyTarget, 4000); assert.equal(goal.currentProgressOnly, true); assert.match(goal.disclaimer, /không phải dự đoán/);
  assert.equal(rt.saves.length, 0, 'derived reports must not create a synced storage domain');

  const returned = boot(learnedFixture({ ageDays: 30 })); const recovery = returned.window.P84RecoveryPlanService.status(); assert.equal(recovery.active, true); assert.ok(recovery.awayDays >= 30); assert.equal(recovery.days.length, 3); assert.equal(recovery.days[0].type, 'familiar'); assert.equal(recovery.resetsProgress, false); returned.window.P84AdaptivePlanService.start(recovery.days[0]); assert.ok(returned.views.some((item) => item === 'p84-p3-recovery:10:10')); assert.match(returned.window.KLEARN_EXTRA_VIEWS['vocabulary-recovery-p84'](), /Chào mừng quay lại/);

  const noAi = boot({ ...fixture, audio: false }); assert.equal(noAi.window.P84AdaptivePlanService.plan(30).tasks.some((item) => item.type === 'listening'), false); assert.equal(noAi.window.P84PersonalReportService.weekly().enough, true);
  const isolated = boot({ userId: 'other-user' }); assert.equal(isolated.window.P84LearningSignalService.snapshot().activeCards, 0); assert.equal(isolated.window.P84PrivateLearningProfileService.get().private, true);

  const large = learnedFixture({ count: 5000 }); const performance = boot(large); const started = Date.now(); const largeProfile = performance.window.P84PrivateLearningProfileService.get(); const elapsed = Date.now() - started; assert.equal(largeProfile.signals.activeCards, 5000); assert.ok(elapsed < 2000, `5000-word profile took ${elapsed}ms`);

  const source = read('data/personal-learning-intelligence.js'); const combined = [source, read('personal-learning-intelligence.css'), read('data/route-loader.js'), read('data/personal-vocabulary-system.js'), read('sw.js')].join('\n');
  assert.doesNotMatch(source, /fetch\s*\(|AICoachService|AIOrchestration/); assert.match(source, /LearningDirectorService/); assert.match(source, /derivedReportsSynced: false/); assert.match(combined, /personal-learning-intelligence/); assert.match(combined, /@media\(max-width:430px\)/); assert.match(combined, /vocabulary-recovery-p84/); assert.match(read('vercel.json'), /"api\/commerce\.js"/);
  console.log(`P84-P3 unit: new-user empty state, 30-day reports, strengths/weaknesses/actions, health/streak, SRS signals, 5/30-minute adaptive plans, goal progress, 30-day recovery, AI-disabled/offline/private/derived-sync contracts passed (5000-word profile: ${elapsed}ms)`);
})();
