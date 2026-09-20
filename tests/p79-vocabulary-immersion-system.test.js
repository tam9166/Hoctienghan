#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/vocabulary-immersion-system.json'));
const source = read('data/vocabulary-immersion-system.js');

function boot() {
  const values = new Map(); const errors = []; const adaptive = []; const mutations = []; const collections = [];
  const state = { currentUser: { id: 'p79-user', onboardingCompleted: true }, currentView: 'home', srsData: [], p79Vocabulary: null };
  const storage = { get(key, fallback) { return values.has(key) ? structuredClone(values.get(key)) : structuredClone(fallback); }, set(key, value) { values.set(key, structuredClone(value)); return true; } };
  let progress = { skills: { vocabulary: 0 }, daily: { tasks: {} }, stats: {}, lessonProgress: {} };
  const scoped = (key) => values.get(`${key}:p79-user`) || [];
  const saveScoped = (key, value) => { values.set(`${key}:p79-user`, structuredClone(value)); return value; };
  const document = { querySelector: () => null, querySelectorAll: () => [] };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    VocabularyCollectionService: {
      all: () => structuredClone(collections),
      create(title) { const item = { id: `collection-${collections.length + 1}`, title, wordIds: [], customWords: [] }; collections.unshift(item); return structuredClone(item); },
      save(value) { const index = collections.findIndex((item) => item.id === value.id); if (index >= 0) collections[index] = structuredClone(value); else collections.unshift(structuredClone(value)); return value; }
    },
    AdaptiveDifficultyService: { record: (skill, correct) => adaptive.push({ skill, correct }) },
    ErrorNotebookService: { add: (item) => errors.push(structuredClone(item)) },
    UserResearchService: { track() {} },
    KLEARN_APP: {
      state, STORAGE_KEYS: { vocabularyCollections: 'collections', achievements: 'achievements', offlinePacks: 'offlinePacks' }, storage,
      escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {}, speakKorean() {},
      getUserProgress: () => structuredClone(progress), saveUserProgress(value) { progress = structuredClone(value); },
      getUserSrs: () => state.srsData, saveUserSrs(cards) { state.srsData = structuredClone(cards); return state.srsData; },
      userScoped: scoped, saveUserScoped: saveScoped,
      VocabularyService: { updateCard(wordId, changes) { state.srsData = state.srsData.map((card) => card.wordId === wordId ? { ...card, ...structuredClone(changes), updatedAt: new Date().toISOString() } : card); return state.srsData.find((card) => card.wordId === wordId); } },
      emitLearningMutation(type, id, payload) { mutations.push({ type, id, payload: structuredClone(payload) }); }
    },
    fetch: async () => ({ ok: true, json: async () => config }), addEventListener() {}, console
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, fetch: window.fetch, FormData: class {} };
  vm.runInNewContext(source, context); window.P79VocabularyConfigService.hydrate(config);
  return { window, state, values, errors, adaptive, mutations, collections, progress: () => progress };
}

(async () => {
  assert.equal(config.topics.length, 17);
  assert.equal(config.topics.filter((item) => item.topikLevel === 'TOPIK I').length, 9);
  assert.equal(config.topics.filter((item) => item.topikLevel === 'TOPIK II').length, 8);
  assert.equal(config.masteryLevels.length, 5);
  assert.deepEqual(new Set(config.wordTypes), new Set(['Danh từ','Động từ','Tính từ','Trạng từ','Cụm từ','Trợ từ']));
  assert.ok(config.vocabulary.length >= 35);
  for (const word of config.vocabulary) ['korean','pronunciation','meaning','wordType','topicId','level','example','audio','image','relatedWords','commonMistake'].forEach((field) => assert.ok(word[field] || Array.isArray(word[field]), `${word.id}.${field} missing`));

  const rt = boot(); const w = rt.window;
  ['P79VocabularyConfigService','VocabularyTopicLibraryService','VocabularyMasteryBridgeService','VocabularyPracticeService','VocabularyTopicAchievementService','PersonalVocabularyService','VocabularyAnalyticsService','VocabularyOfflinePackService'].forEach((name) => assert.ok(w[name], `${name} missing`));
  assert.equal(w.VocabularyTopicLibraryService.all().length, 17);
  assert.equal(w.VocabularyTopicLibraryService.get('greetings').totalVocabulary, 2);
  assert.equal(w.VocabularyTopicLibraryService.get('time').totalVocabulary, 3);

  const word = config.vocabulary.find((item) => item.id === 'p79-greetings-annyeong');
  w.VocabularyMasteryBridgeService.activate(word.id);
  assert.equal(rt.state.srsData.length, 1, 'P79 must use the existing SRS array');
  assert.equal(rt.state.srsData[0].immersionLevel, 1);
  assert.equal(rt.state.srsData[0].activationSource, 'p79-vocabulary-immersion');
  assert.equal(w.VocabularyMasteryBridgeService.record(word.id, 'reading', { correct: true, score: 100 }).immersionLevel, 2);
  assert.equal(w.VocabularyMasteryBridgeService.record(word.id, 'listening', { correct: true, score: 100 }).immersionLevel, 3);
  assert.equal(w.VocabularyMasteryBridgeService.record(word.id, 'writing', { correct: true, score: 100 }).immersionLevel, 4);
  assert.equal(w.VocabularyMasteryBridgeService.record(word.id, 'speaking', { correct: true, score: 90 }).immersionLevel, 4, 'speaking alone must not grant usage mastery');
  const mastered = w.VocabularyMasteryBridgeService.record(word.id, 'context', { correct: true, score: 100 });
  assert.equal(mastered.immersionLevel, 5); assert.equal(mastered.status, 'mastered'); assert.equal(mastered.mastery, 100);
  assert.equal(w.VocabularyTopicLibraryService.get('greetings').completedVocabulary, 1);
  assert.ok(rt.mutations.some((item) => item.type === 'vocabulary_updated'));
  assert.equal(rt.progress().daily.tasks.vocabulary, true);
  assert.ok(rt.adaptive.every((item) => item.skill === 'vocabulary'));

  const second = config.vocabulary.find((item) => item.id === 'p79-greetings-thanks');
  w.VocabularyMasteryBridgeService.activate(second.id);
  const wrong = w.VocabularyPracticeService.grade(second.id, 'writing', '안녕');
  assert.equal(wrong.correct, false); assert.equal(rt.errors.length, 1); assert.equal(rt.errors[0].wordId, second.id);
  rt.state.srsData.find((card) => card.wordId === second.id).immersionLevel = 5;
  const topicAchievement = w.VocabularyTopicAchievementService.evaluate('greetings');
  assert.equal(topicAchievement.id, 'p79-topic-greetings'); assert.ok((rt.values.get('achievements:p79-user') || []).some((item) => item.id === topicAchievement.id));
  ['listening','reading','writing','speaking','context'].forEach((mode) => assert.equal(w.VocabularyPracticeService.question(second.id, mode).mode, mode));

  const collection = w.PersonalVocabularyService.create('Từ trong phim');
  const personal = w.PersonalVocabularyService.add(collection.id, { korean: '대박', pronunciation: 'dae-bak', meaning: 'Tuyệt vời', wordType: 'Cụm từ', example: '대박이에요!' });
  assert.equal(rt.collections[0].customWords.length, 1); assert.ok(rt.state.srsData.some((card) => card.wordId === personal.id));
  const analytics = w.VocabularyAnalyticsService.summary();
  assert.equal(analytics.totalWords, config.vocabulary.length + 1); assert.equal(analytics.masteredWords, 2); assert.ok(analytics.weakWords >= 1);

  assert.deepEqual(w.VocabularyOfflinePackService.all().map((item) => item.id), ['p79-topik-i-vocabulary','p79-topik-ii-vocabulary','p79-travel-vocabulary','p79-business-vocabulary']);
  const offline = await w.VocabularyOfflinePackService.download('p79-topik-i-vocabulary');
  assert.equal(offline.status, 'downloaded'); assert.equal(offline.learningDataPreserved, true); assert.equal((rt.values.get('offlinePacks:p79-user') || []).length, 1);

  const combined = [source, read('data/route-loader.js'), read('sw.js'), read('app.js'), read('vocabulary-immersion-system.css')].join('\n');
  assert.match(combined, /vocabulary-immersion-p79/); assert.match(combined, /content\/vocabulary-immersion-system\.json/); assert.match(combined, /STORAGE_KEYS\.vocabularyCollections/); assert.match(combined, /STORAGE_KEYS\.offlinePacks/); assert.match(combined, /ErrorNotebookService/); assert.match(combined, /AdaptiveDifficultyService/); assert.match(combined, /emitLearningMutation/); assert.match(combined, /@media\(max-width:430px\)/);
  assert.match(read('data/route-loader.js'), /p79Vocabulary: \{ dependencies: \['practical', 'scale'\]/); assert.match(read('data/route-loader.js'), /p79VocabularyVoice: \{ dependencies: \['p79Vocabulary', 'voice'\]/);
  assert.doesNotMatch(combined, /(service_role|private_key|client_secret)\s*[:=]/i);
  console.log('P79 unit: 17 topics, complete vocabulary model, five-skill practice, evidence mastery, shared SRS/adaptive/error/journey stores, personal collections, analytics and offline packs passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
