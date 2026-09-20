#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const source = read('data/personal-vocabulary-system.js');

function boot() {
  const values = new Map(); const errors = []; const adaptive = []; const mutations = [];
  const state = { currentUser: { id: 'p82-user' }, currentView: 'home', srsData: [], p82Vocabulary: null };
  const key = 'collections'; const scoped = (storageKey) => structuredClone(values.get(`${storageKey}:${state.currentUser.id}`) || []);
  const saveScoped = (storageKey, items) => { values.set(`${storageKey}:${state.currentUser.id}`, structuredClone(items)); return items; };
  const document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ click() {} }) };
  const SRSStateService = { hasLearningEvidence(card) { return Boolean(card?.activatedAt || Number(card?.reviewCount) || Number(card?.mastery)); }, isDue(card) { return card?.status !== 'mastered' && card?.nextReview && new Date(card.nextReview) <= new Date(); } };
  const MasteryService = { status: (score) => Number(score) >= 80 ? 'mastered' : Number(score) >= 50 ? 'understood' : Number(score) > 0 ? 'learning' : 'not_started' };
  const saveSrs = (cards) => { state.srsData = structuredClone(cards); return state.srsData; };
  const VocabularyService = {
    recordRecall(card, correct, response, metadata = {}) { const current = state.srsData.find((item) => item.wordId === card.wordId); const at = new Date().toISOString(); const streak = correct ? Number(current.streakCorrect || 0) + 1 : 0; const mastery = Math.max(0, Math.min(100, Number(current.mastery || 0) + (correct ? 10 : -18))); Object.assign(current, { reviewCount: Number(current.reviewCount || 0) + 1, correctCount: Number(current.correctCount || 0) + (correct ? 1 : 0), wrongCount: Number(current.wrongCount || 0) + (correct ? 0 : 1), streakCorrect: streak, mastery, status: mastery >= 85 && streak >= 3 ? 'mastered' : correct ? 'review' : 'learning', lastReviewed: at, nextReview: new Date(Date.now() + (correct ? 3 * 86400000 : 600000)).toISOString(), personalVocabularyEvidence: metadata.personalVocabularyEvidence, updatedAt: at }); return structuredClone(current); }
  };
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    AdaptiveDifficultyService: { record: (skill, correct) => adaptive.push({ skill, correct }) }, ErrorNotebookService: { add: (item) => { errors.push(structuredClone(item)); return item; } },
    AICoachService: { async request(prompt, task) { assert.equal(task, 'vocabulary_classification'); const rows = prompt.split('\n').filter((line) => /^\d+\|/.test(line)); return JSON.stringify(rows.map((line, index) => ({ index: index + 1, topic: `Chủ đề ${(index % 12) + 1}`, subtopic: index % 2 ? 'Nhóm B' : 'Nhóm A', confidence: .88 }))); } },
    caches: { async open() { return { add: async () => true }; } }, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} }, confirm: () => true, prompt: () => null,
    KLEARN_APP: {
      state, STORAGE_KEYS: { vocabularyCollections: key, offlinePacks: 'offlinePacks' }, escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {},
      userScoped: scoped, saveUserScoped: saveScoped, getUserSrs: () => state.srsData, saveUserSrs: saveSrs, VocabularyService, SRSStateService, MasteryService,
      CloudSyncService: { schedule() {} }, PrivacyPreferenceService: { allows: () => true }, emitLearningMutation(type, entityId, details, mutationId) { mutations.push({ type, entityId, details, mutationId }); }, speakKorean() {}
    }
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, Blob, FormData: class {}, URL: window.URL };
  vm.runInNewContext(source, context);
  return { window, state, values, errors, adaptive, mutations };
}

(async () => {
  const rt = boot(); const w = rt.window;
  ['P82DeckService','P82ImportService','P82KoreanInputService','P82LearningSessionService','P82AIClassificationService','P82ExportService','P82OfflineService','PersonalVocabularySystem'].forEach((name) => assert.ok(w[name], `${name} missing`));

  const deck = w.P82DeckService.create({ title: 'Từ cô giáo giao', description: 'Bài 5' });
  assert.equal(deck.owner, 'p82-user'); assert.equal(deck.schemaVersion, 2); assert.equal(w.P82DeckService.all().length, 1);
  const added = w.P82DeckService.addWord(deck.id, { korean: '학교', meaning: 'Trường học', wordType: 'Danh từ', topic: 'Trường học', example: '학교에 가요.', acceptedAnswers: ['학교'] });
  assert.equal(w.P82DeckService.words(deck.id).length, 1);
  w.P82DeckService.editWord(deck.id, added.id, { note: 'Từ cơ bản', subtopic: 'Địa điểm' }); assert.equal(w.P82DeckService.words(deck.id)[0].note, 'Từ cơ bản');
  const copy = w.P82DeckService.duplicate(deck.id); assert.notEqual(copy.id, deck.id); assert.equal(w.P82DeckService.words(copy.id).length, 1);
  w.P82DeckService.removeWord(copy.id, w.P82DeckService.words(copy.id)[0].id); assert.equal(w.P82DeckService.words(copy.id).length, 0);

  const csv = ['Korean,Meaning,WordType,Example', '먹다,Ăn,Động từ,밥을 먹어요.', '친구,Bạn bè,Danh từ,친구를 만나요.'].join('\n');
  const parsedCsv = w.P82ImportService.parse('lesson.csv', csv); assert.equal(parsedCsv.validCount, 2); assert.equal(parsedCsv.hasTopics, false);
  assert.equal(w.P82ImportService.parse('lesson.txt', 'Korean\tMeaning\n회사\tCông ty').validCount, 1);
  assert.equal(w.P82ImportService.parse('lesson.json', JSON.stringify([{ Korean:'경제', Meaning:'Kinh tế', Topic:'Kinh tế' }])).hasTopics, true);
  assert.throws(() => w.P82ImportService.parse('lesson.xlsx', 'binary'), (error) => error.code === 'XLSX_UNAVAILABLE');
  const imported = w.P82ImportService.createDeckFromFile({ title: 'TOPIK II', fileName: 'lesson.csv', text: csv }); assert.equal(imported.result.added, 2);
  const repeat = w.P82ImportService.importIntoDeck(imported.deck.id, parsedCsv, 'skip'); assert.equal(repeat.skipped, 2); assert.equal(repeat.added, 0);
  const merge = w.P82ImportService.importIntoDeck(imported.deck.id, parsedCsv, 'merge'); assert.equal(merge.merged, 2);

  const rows500 = ['Korean,Meaning,WordType']; for (let index = 0; index < 500; index += 1) rows500.push(`단어${index},Nghĩa ${index},Danh từ`);
  const flow = w.P82ImportService.createDeckFromFile({ title: '500 từ', fileName: '500.csv', text: rows500.join('\n') }); assert.equal(flow.result.added, 500); assert.equal(w.P82DeckService.summary(flow.deck.id).totalWords, 500);
  const browser = w.P82DeckService.browse(flow.deck.id, { page: 1 }); assert.equal(browser.items.length, 50); assert.equal(browser.pages, 10, 'large decks must paginate');
  const rows5000 = ['Korean,Meaning']; for (let index = 0; index < 5000; index += 1) rows5000.push(`대단어${index},Nghĩa lớn ${index}`);
  const largeText = rows5000.join('\n'); const started = performance.now(); const parsedLarge = w.P82ImportService.parse('5000.csv', largeText); const parseMs = performance.now() - started; assert.equal(parsedLarge.validCount, 5000); assert.ok(parseMs < 2500, `5000-word parse too slow: ${parseMs}ms`);
  const largeImportStarted = performance.now(); const largeDeck = w.P82ImportService.createDeckFromFile({ title: '5.000 từ', fileName: '5000.csv', text: largeText }); const largeImportMs = performance.now() - largeImportStarted; assert.equal(largeDeck.result.totalWords, 5000); assert.equal(w.P82DeckService.browse(largeDeck.deck.id, { page: 100 }).items.length, 50); assert.ok(largeImportMs < 5000, `5000-word import too slow: ${largeImportMs}ms`);

  const ai = await w.P82AIClassificationService.suggest(flow.deck.id); assert.equal(ai.processed, 500); assert.ok(ai.batches <= 60); assert.equal(ai.suggestionOnly, true); assert.equal(w.P82DeckService.words(flow.deck.id)[0].topic, 'Chưa phân loại', 'AI must not auto-confirm topic'); const noResend = await w.P82AIClassificationService.suggest(flow.deck.id); assert.equal(noResend.processed, 0, 'saved suggestions must not be sent to AI again');
  assert.equal(w.P82AIClassificationService.pending(flow.deck.id).length, 500); assert.equal(w.P82AIClassificationService.confirm(flow.deck.id), 500); assert.ok(w.P82DeckService.topics(flow.deck.id).length >= 12);
  const first = w.P82DeckService.words(flow.deck.id)[0]; w.P82DeckService.assignTopic(flow.deck.id, [first.id], 'Công việc', 'Công ty'); assert.equal(w.P82DeckService.words(flow.deck.id)[0].subtopic, 'Công ty');
  w.P82DeckService.mergeTopic(flow.deck.id, 'Công việc', 'Nghề nghiệp'); assert.equal(w.P82DeckService.words(flow.deck.id)[0].topic, 'Nghề nghiệp');

  assert.equal(w.P82KoreanInputService.validate({ korean:'학교', acceptedAnswers:['학교'] }, '  학교  ').correct, true);
  assert.equal(w.P82KoreanInputService.validate({ korean:'학교', acceptedAnswers:['학교'] }, '학꾜').correct, false, 'near spelling must remain wrong');
  assert.equal(w.P82KoreanInputService.validate({ korean:'무엇', acceptedAnswers:['무엇','뭐'] }, '뭐').correct, true);
  const selected = w.P82LearningSessionService.select(flow.deck.id, { scope:'random', count:10, random:()=>0 }); assert.equal(selected.length, 10); assert.notDeepEqual(Array.from(selected, (word) => word.id), Array.from(w.P82DeckService.words(flow.deck.id).slice(0, 10), (word) => word.id), 'session must shuffle');
  const session = w.P82LearningSessionService.start(flow.deck.id, { scope:'random', count:10, random:()=>0 }); assert.equal(session.selectedWordIds.length, 10); const firstSessionWord = w.P82LearningSessionService.currentWord(flow.deck.id); const wrong = w.P82LearningSessionService.answer(flow.deck.id, '학꾜'); assert.equal(wrong.correct, false); assert.equal(rt.errors.length, 1); assert.equal(rt.errors[0].deckId, flow.deck.id); assert.equal(rt.errors[0].wordId, firstSessionWord.id);
  let guard = 0; while (w.P82LearningSessionService.current(flow.deck.id) && guard < 30) { const word = w.P82LearningSessionService.currentWord(flow.deck.id); w.P82LearningSessionService.answer(flow.deck.id, word.korean); guard += 1; }
  assert.ok(guard <= 11); const finishedDeck = w.P82DeckService.get(flow.deck.id); assert.equal(finishedDeck.activeSession, null); assert.equal(finishedDeck.sessionHistory[0].masteredWords, 10); assert.equal(finishedDeck.sessionHistory[0].rounds, 2); assert.equal(rt.state.srsData.filter((card) => card.deckId === flow.deck.id).length, 10, 'session words must use existing SRS'); assert.ok(rt.adaptive.length >= 11); assert.ok(rt.mutations.some((item) => item.type === 'vocabulary_session_completed'));
  const progress = w.P82DeckService.browse(flow.deck.id, { status:'learning' }); assert.ok(progress.total >= 1); assert.ok(w.P82ExportService.csv(flow.deck.id).includes('Korean,Meaning')); assert.equal(JSON.parse(w.P82ExportService.json(flow.deck.id)).words.length, 500);
  const offline = await w.P82OfflineService.prepare(); assert.equal(offline.cached, true);

  const srsBeforeDelete = rt.state.srsData.length; w.P82DeckService.remove(flow.deck.id); assert.equal(w.P82DeckService.get(flow.deck.id), null); assert.equal(rt.state.srsData.length, srsBeforeDelete, 'deleting a deck must preserve global SRS');
  rt.state.currentUser = { id:'other-user' }; assert.equal(w.P82DeckService.all().length, 0, 'owner isolation failed'); rt.state.currentUser = { id:'p82-user' };

  const combined = [source, read('app.js'), read('data/route-loader.js'), read('sw.js'), read('personal-vocabulary-system.css'), read('api/chat.js'), read('api/_ai-quality.js')].join('\n');
  assert.match(combined, /mergeVocabularyCollections/); assert.match(combined, /VocabularyService\.recordRecall/); assert.match(combined, /ErrorNotebookService/); assert.match(combined, /AdaptiveDifficultyService/); assert.match(combined, /vocabulary_classification/); assert.match(combined, /my-vocabulary-p82/); assert.match(combined, /data-p82-import-into/); assert.match(combined, /@media\(max-width:430px\)/); assert.doesNotMatch(combined, /(service_role|private_key|client_secret)\s*[:=]/i);
  assert.match(read('data/route-loader.js'), /p82Vocabulary: \{ dependencies: \['p79Vocabulary', 'ai'\]/); assert.match(read('sw.js'), /personal-vocabulary-system/); assert.match(read('app.js'), /key === STORAGE_KEYS\.vocabularyCollections/);
  console.log(`P82 unit: deck CRUD, CSV-TXT-JSON import, 5000-word pagination/performance, AI suggestion/manual topics, shuffled retry session, exact Korean, shared mastery-SRS-error-adaptive, export, offline, CloudSync and owner isolation passed (${Math.round(parseMs)}ms parse; ${Math.round(largeImportMs)}ms import)`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
