#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function boot({ audio = true, recognition = true, userId = 'p84-p2-user' } = {}) {
  const values = new Map(); const errors = []; const sync = []; const state = { currentUser: { id: userId, fullName: 'P84 P2' }, currentView: 'my-vocabulary-p82', srsData: [], p82Vocabulary: null };
  const scoped = (key) => structuredClone(values.get(`${key}:${state.currentUser.id}`) || []);
  const saveScoped = (key, value) => { values.set(`${key}:${state.currentUser.id}`, structuredClone(value)); return value; };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, createElement: () => ({ click() {} }) };
  const SRSStateService = { hasLearningEvidence: (card = {}) => Boolean(card.activatedAt || card.lastReviewed || Number(card.reviewCount) || Number(card.mastery) || ['learning', 'review', 'mastered'].includes(card.status)), isDue(card = {}, at = Date.now()) { return this.hasLearningEvidence(card) && card.nextReview && new Date(card.nextReview).getTime() <= at; } };
  const MasteryService = { status: (score) => Number(score) >= 80 ? 'mastered' : Number(score) >= 50 ? 'understood' : Number(score) > 0 ? 'learning' : 'not_started' };
  const saveSrs = (cards) => { state.srsData = structuredClone(cards); return state.srsData; };
  const VocabularyService = { recordRecall(card, correct, response, metadata = {}) { const current = state.srsData.find((item) => (item.wordId || item.id) === (card.wordId || card.id)); const stamp = new Date().toISOString(); Object.assign(current, { reviewCount: Number(current.reviewCount || 0) + 1, correctCount: Number(current.correctCount || 0) + (correct ? 1 : 0), wrongCount: Number(current.wrongCount || 0) + (correct ? 0 : 1), mastery: Math.max(0, Number(current.mastery || 0) + (correct ? 10 : -18)), status: correct ? 'review' : 'learning', lastReviewed: stamp, nextReview: new Date(Date.now() + (correct ? 86400000 : 600000)).toISOString(), personalVocabularyEvidence: metadata.personalVocabularyEvidence, updatedAt: stamp, lastResponse: response }); return current; } };
  const window = { document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, confirm: () => true, prompt: () => null, SpeechRecognition: recognition ? function Recognition() {} : undefined,
    ErrorNotebookService: { all: () => errors, add: (item) => { errors.push({ ...structuredClone(item), id: `error-${errors.length}`, count: 1, resolved: false }); } }, AdaptiveDifficultyService: { record() {} },
    KLEARN_APP: { state, STORAGE_KEYS: { vocabularyCollections: 'collections', vocabularyOrganization: 'organization', offlinePacks: 'offline' }, escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {}, userScoped: scoped, saveUserScoped: saveScoped, getUserSrs: () => state.srsData, saveUserSrs: saveSrs, VocabularyService, SRSStateService, MasteryService, CloudSyncService: { schedule(reason) { sync.push(reason); } }, PrivacyPreferenceService: { allows: () => false }, emitLearningMutation() {}, speakKorean() {} }
  };
  if (audio) window.speechSynthesis = { cancel() {}, speak() {} };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, Blob, FormData: class {}, URL: { createObjectURL: () => '', revokeObjectURL() {} } };
  vm.runInNewContext(read('data/personal-vocabulary-system.js'), context); vm.runInNewContext(read('data/personal-vocabulary-organization.js'), context); vm.runInNewContext(read('data/vocabulary-mastery-real-usage.js'), context);
  return { window, state, values, errors, sync };
}
function makeDeck(rt, title = 'TOPIK II') {
  return rt.window.P82ImportService.createDeckFromFile({ title, fileName: 'context.csv', text: ['Korean,Meaning,Topic,Example', '학교,Trường học,School,저는 학교에 갑니다.', '빌리다,Mượn,Daily,도서관에서 책을 빌립니다.', '빌려주다,Cho mượn,Daily,친구에게 책을 빌려줍니다.', '알다,Biết,Daily,저는 답을 압니다.', '암다,Ôm,Daily,아이를 안습니다.', '예시없음,Không có ví dụ,Other,'].join('\n') }).deck.id;
}

(async () => {
  const rt = boot(); const w = rt.window; const deckId = makeDeck(rt); const words = w.P82DeckService.words(deckId); const school = words.find((word) => word.korean === '학교');
  w.P84MetadataService.addExample(deckId, school.id, '저는 학교에서 공부합니다.');
  const examples = w.P84ContextService.examples(w.P82DeckService.words(deckId).find((word) => word.id === school.id));
  assert.equal(examples.length, 2); assert.ok(examples.some((item) => item.source === 'personal' && item.label === 'My Example'));
  const context = w.P84ContextService.question(deckId, school.id, 'system'); assert.equal(context.prompt, '저는 ______에 갑니다.'); assert.equal(context.expected, '학교'); assert.equal(context.offline, true);
  const noExample = words.find((word) => word.korean === '예시없음'); assert.equal(w.P84ContextService.question(deckId, noExample.id), null, 'missing examples must not create fake data');

  const borrow = words.find((word) => word.korean === '빌리다'); const lend = words.find((word) => word.korean === '빌려주다');
  w.P84MetadataService.addExample(deckId, borrow.id, '도서관에서 책을 빌리다.');
  const relation = w.P84WordRelationService.add({ deckId, sourceWordId: borrow.id, relatedWordId: lend.id, relationType: 'similar', source: 'verified' });
  assert.equal(relation.source, 'verified'); assert.equal(relation.confidence, 1); assert.equal(w.P84WordRelationService.all(deckId, borrow.id).length, 1);
  const know = words.find((word) => word.korean === '알다'); assert.ok(w.P84WordRelationService.suggest(deckId, know.id).some((item) => item.word.korean === '암다'), 'similar spelling should be suggested, never verified automatically');

  const overdue = new Date(Date.now() - 3 * 86400000).toISOString();
  rt.state.srsData = [{ id: borrow.id, wordId: borrow.id, status: 'learning', mastery: 25, reviewCount: 4, correctCount: 1, wrongCount: 3, nextReview: overdue, activatedAt: overdue, personalVocabularyEvidence: { modeStats: { 'vi-ko': { attempts: 3, correct: 1, wrong: 2 }, 'context-fill': { attempts: 2, correct: 0, wrong: 2 } } } }];
  const confusion = w.P84VocabularyHealthService.confusion(deckId, borrow.id); assert.equal(confusion.active, true); assert.equal(w.P84VocabularyHealthService.word(deckId, borrow.id).recommendation, 'Luyện lại ngữ cảnh của từ này');
  const health = w.P84VocabularyHealthService.deck(deckId); assert.equal(health.total, 6); assert.ok(health.weak >= 1); assert.ok(health.categories.confusion >= 1); assert.equal(health.details.find((item) => item.word.id === borrow.id).typing, 'weak');
  const recommendations = w.P84ReviewIntelligenceService.recommend(deckId); assert.equal(recommendations[0].word.id, borrow.id); assert.ok(recommendations[0].reasons.includes('SRS overdue')); assert.ok(recommendations[0].reasons.includes('Confusing words'));

  let session = w.P84ReviewIntelligenceService.start(deckId, { type: 'context', count: 1 }); assert.equal(session.queue[0].mode, 'context');
  let current = w.P84ReviewIntelligenceService.current(); const wrong = w.P84ReviewIntelligenceService.answer('sai'); assert.equal(wrong.correct, false); assert.equal(w.P84ReviewIntelligenceService.current().item.mode, 'context', 'wrong retry must retain question mode'); assert.equal(rt.errors.at(-1).type, 'vocabulary-context');
  current = w.P84ReviewIntelligenceService.current(); const correct = w.P84ReviewIntelligenceService.answer(current.word.korean); assert.equal(correct.completed, true); const card = rt.state.srsData.find((item) => item.wordId === current.word.id); assert.equal(card.personalVocabularyEvidence.modeStats['context-fill'].correct >= 1, true); assert.ok(rt.sync.includes('p84-p2-review-complete'));

  session = w.P84ReviewIntelligenceService.start(deckId, { type: 'confusion', count: 1 }); current = w.P84ReviewIntelligenceService.current(); assert.equal(current.question.mode, 'confusion'); assert.equal(current.question.options.length, 2); w.P84ReviewIntelligenceService.answer(current.word.korean);
  session = w.P84ReviewIntelligenceService.start(deckId, { type: 'mixed', count: 5 }); assert.ok(session.queue.every((item) => ['meaning', 'typing', 'listening', 'context', 'confusion'].includes(item.mode))); assert.ok(new Set(session.queue.map((item) => item.mode)).size >= 3);
  const before = { mastery: card.mastery, wrongCount: card.wrongCount, note: w.P82DeckService.words(deckId).find((word) => word.id === school.id).personalExamples.length };
  w.P84WordRelationService.add({ deckId, sourceWordId: know.id, relatedWordId: words.find((word) => word.korean === '암다').id, relationType: 'similar', source: 'suggested', confidence: .6 });
  const after = rt.state.srsData.find((item) => item.wordId === current.word.id); assert.equal(after.mastery, before.mastery); assert.equal(after.wrongCount, before.wrongCount); assert.equal(w.P82DeckService.words(deckId).find((word) => word.id === school.id).personalExamples.length, before.note, 'relations must preserve personal examples');

  const fallback = boot({ audio: false, recognition: false, userId: 'fallback' }); const fallbackDeck = makeDeck(fallback); assert.equal(fallback.window.P84VocabularyMastery.audioAvailable(), false); assert.equal(fallback.window.P84VocabularyMastery.pronunciationAvailable(), false); assert.equal(fallback.window.P84VocabularyHealthService.word(fallbackDeck, fallback.window.P82DeckService.words(fallbackDeck)[0].id).listening, 'unavailable'); assert.throws(() => fallback.window.P84ReviewIntelligenceService.start(fallbackDeck, { type: 'listening' }), /Audio unavailable/);
  const consent = await w.P84ContextService.generateExample(deckId, school.id, false); assert.equal(consent.status, 'consent_required'); assert.equal(consent.label, 'AI Generated'); assert.equal((await w.P84ContextService.generateExample(deckId, school.id, true)).status, 'unavailable', 'AI disabled must not generate');

  const perf = boot({ userId: 'p84-p2-performance' }); const rows = ['Korean,Meaning,Topic']; for (let index = 0; index < 5000; index += 1) rows.push(`성능${index},Hiệu năng ${index},Scale`); const largeDeck = perf.window.P82ImportService.createDeckFromFile({ title: '5000 words', fileName: 'large.csv', text: rows.join('\n') }).deck.id; const healthStarted = Date.now(); const largeHealth = perf.window.P84VocabularyHealthService.deck(largeDeck); const healthMs = Date.now() - healthStarted; const reviewStarted = Date.now(); const largeReview = perf.window.P84ReviewIntelligenceService.recommend(largeDeck, 100); const reviewMs = Date.now() - reviewStarted; assert.equal(largeHealth.total, 5000); assert.equal(largeReview.length, 100); assert.ok(healthMs < 2000, `5000-word health took ${healthMs}ms`); assert.ok(reviewMs < 1500, `5000-word review ranking took ${reviewMs}ms`);

  const source = [read('data/vocabulary-mastery-real-usage.js'), read('vocabulary-mastery-real-usage.css'), read('data/route-loader.js'), read('sw.js')].join('\n');
  assert.match(source, /vocabulary-mastery-session-p84/); assert.match(source, /@media\(max-width:430px\)/); assert.match(source, /AI Generated/); assert.match(source, /personalExamples/); assert.doesNotMatch(read('data/vocabulary-mastery-real-usage.js'), /fetch\s*\(/); assert.match(read('app.js'), /wordRelations: mergeItems\('wordRelations'/); assert.match(read('app.js'), /reviewHistory: mergeItems\('reviewHistory'/);
  console.log(`P84-P2 unit: context/fill blank, personal examples, verified/suggested relations, similar/confusing words, health/weakness breakdown, smart and mixed review, listening fallback, retry, SRS/mastery/Error Notebook preservation, offline/privacy/CloudSync contracts passed (5000-word health: ${healthMs}ms; review ranking: ${reviewMs}ms)`);
})().catch((error) => { console.error(error); process.exitCode = 1; });
