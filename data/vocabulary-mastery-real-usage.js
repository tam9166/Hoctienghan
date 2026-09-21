/* P84-P2 — Vocabulary Mastery & Real Usage. Recommendation/question layer only. */
(function vocabularyMasteryRealUsage(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app || !global.P82DeckService || !global.P82LearningSessionService) return;
  const { state, STORAGE_KEYS, escapeHtml = String, render, setView, toast, userScoped, saveUserScoped, getUserSrs, saveUserSrs, CloudSyncService, PrivacyPreferenceService, speakKorean } = app;
  const runtime = state.p84Mastery || (state.p84Mastery = { deckId: '', session: null, result: null, detailWordId: '', relationFilter: 'all' });
  const RELATION_TYPES = Object.freeze(['family', 'similar', 'opposite', 'derived']);
  const REVIEW_TYPES = Object.freeze(['meaning', 'typing', 'listening', 'context', 'confusion', 'mixed']);
  const now = () => new Date().toISOString();
  const clean = (value, max = 500) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const normalized = (value) => clean(value, 500).toLocaleLowerCase('vi-VN').replace(/[\s\u00a0]+/g, ' ').trim();
  const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const uid = () => state.currentUser?.id || '';
  const audioAvailable = () => typeof speakKorean === 'function' && 'speechSynthesis' in global;
  const pronunciationAvailable = () => Boolean(global.SpeechRecognition || global.webkitSpeechRecognition);
  const cards = () => new Map((getUserSrs?.() || []).map((card) => [card.wordId || card.id, card]));
  const allWords = (deckId) => global.P82DeckService.words(deckId).filter((word) => !word.deletedAt);
  const findWord = (deckId, wordId) => allWords(deckId).find((word) => word.id === wordId) || null;
  const organization = () => {
    const raw = userScoped?.(STORAGE_KEYS.vocabularyOrganization) || [];
    const base = Array.isArray(raw) && raw[0] && typeof raw[0] === 'object' ? raw[0] : {};
    return { schemaVersion: 2, folders: Array.isArray(base.folders) ? base.folders : [], wordRelations: Array.isArray(base.wordRelations) ? base.wordRelations : [], reviewHistory: Array.isArray(base.reviewHistory) ? base.reviewHistory : [], updatedAt: base.updatedAt || null };
  };
  function saveOrganization(changes, reason = 'p84-p2-mastery') {
    const current = organization(); const next = { ...current, ...changes, schemaVersion: 2, updatedAt: now() };
    saveUserScoped?.(STORAGE_KEYS.vocabularyOrganization, [next], 10); CloudSyncService?.schedule?.(reason); return next;
  }
  function examplesFor(word) {
    const result = [];
    if (clean(word.example, 500)) result.push({ id: `system-${word.id}`, text: clean(word.example, 500), source: 'system', label: 'System example', verified: true });
    (word.personalExamples || []).forEach((example) => { const text = clean(example?.text ?? example, 500); if (text) result.push({ id: example?.id || id('personal-example'), text, source: 'personal', label: 'My Example', verified: true }); });
    return result.filter((example) => normalized(example.text).includes(normalized(word.korean)));
  }
  function blankSentence(text, answer) { const source = clean(text, 500); const index = source.indexOf(answer); return index < 0 ? '' : `${source.slice(0, index)}______${source.slice(index + answer.length)}`; }
  function editDistance(left, right) {
    const a = [...normalized(left)], b = [...normalized(right)]; const row = b.map((_, index) => index + 1);
    for (let x = 0; x < a.length; x += 1) { let previous = x; row[0] = x + 1; for (let y = 0; y < b.length; y += 1) { const value = row[y + 1]; row[y + 1] = Math.min(row[y + 1] + 1, row[y] + 1, previous + (a[x] === b[y] ? 0 : 1)); previous = value; } }
    return row[b.length] || 0;
  }

  const P84WordRelationService = {
    all(deckId = '', wordId = '') { return organization().wordRelations.filter((item) => !item.deletedAt && (!deckId || item.deckId === deckId) && (!wordId || item.sourceWordId === wordId || item.relatedWordId === wordId)).map(clone); },
    add(input = {}) {
      const deckId = clean(input.deckId, 120); const source = findWord(deckId, input.sourceWordId); const related = findWord(deckId, input.relatedWordId);
      if (!source || !related || source.id === related.id) throw new Error('Quan hệ từ cần hai từ khác nhau trong deck của bạn.');
      const relationType = RELATION_TYPES.includes(input.relationType) ? input.relationType : 'similar'; const sourceType = input.source === 'verified' ? 'verified' : 'suggested';
      const values = organization().wordRelations; const existing = values.find((item) => !item.deletedAt && item.deckId === deckId && item.sourceWordId === source.id && item.relatedWordId === related.id && item.relationType === relationType);
      const relation = { id: existing?.id || id('p84-relation'), owner: uid(), deckId, sourceWordId: source.id, relatedWordId: related.id, sourceWord: source.korean, relatedWord: related.korean, relationType, confidence: Math.max(0, Math.min(1, Number(input.confidence ?? (sourceType === 'verified' ? 1 : .6)))), source: sourceType, createdAt: existing?.createdAt || now(), updatedAt: now(), deletedAt: null };
      saveOrganization({ wordRelations: [relation, ...values.filter((item) => item.id !== relation.id)].slice(0, 5000) }, 'p84-p2-word-relation'); return clone(relation);
    },
    verify(relationId) { const values = organization().wordRelations; const relation = values.find((item) => item.id === relationId && !item.deletedAt); if (!relation) throw new Error('Không tìm thấy quan hệ từ.'); return this.add({ ...relation, source: 'verified', confidence: 1 }); },
    remove(relationId) { const values = organization().wordRelations.map((item) => item.id === relationId ? { ...item, deletedAt: now(), updatedAt: now() } : item); saveOrganization({ wordRelations: values }, 'p84-p2-word-relation-delete'); return true; },
    suggest(deckId, wordId) {
      const source = findWord(deckId, wordId); if (!source) return []; const existing = new Set(this.all(deckId, wordId).map((item) => item.sourceWordId === wordId ? item.relatedWordId : item.sourceWordId));
      return allWords(deckId).filter((word) => word.id !== source.id && !existing.has(word.id)).map((word) => { const distance = editDistance(source.korean, word.korean); const max = Math.max([...source.korean].length, [...word.korean].length, 1); return { word, distance, confidence: Math.max(0, 1 - distance / max) }; }).filter((item) => item.distance <= 2 && item.confidence >= .45).sort((a, b) => b.confidence - a.confidence).slice(0, 8);
    }
  };

  function errorCounts() {
    const map = new Map();
    (global.ErrorNotebookService?.all?.() || []).filter((item) => !item.resolved && item.wordId).forEach((item) => map.set(item.wordId, Number(map.get(item.wordId) || 0) + Number(item.count || 1)));
    return map;
  }
  function modeStat(card, mode) { return card?.personalVocabularyEvidence?.modeStats?.[mode] || { attempts: 0, correct: 0, wrong: 0 }; }
  function strength(stat, unknown = 'unknown') { const attempts = Number(stat?.attempts || 0); if (!attempts) return unknown; const rate = Number(stat.correct || 0) / attempts; return rate >= .8 ? 'strong' : rate >= .5 ? 'learning' : 'weak'; }

  const P84VocabularyHealthService = {
    word(deckId, wordId, prepared = null) {
      const word = prepared?.word || findWord(deckId, wordId); if (!word) return null; const card = (prepared?.cardMap || cards()).get(word.id); const errors = Number((prepared?.errors || errorCounts()).get(word.id) || 0); const meaning = modeStat(card, 'ko-vi'); const typing = modeStat(card, 'vi-ko'); const context = modeStat(card, 'context-fill'); const listening = modeStat(card, 'listening-ko');
      return { word: clone(word), mastery: Number(card?.mastery || 0), status: card?.status || 'not_started', wrongCount: Math.max(Number(card?.wrongCount || 0), errors), meaning: strength(meaning), typing: strength(typing), context: strength(context, examplesFor(word).length ? 'not_learned' : 'unavailable'), listening: audioAvailable() ? strength(listening) : 'unavailable', confusion: this.confusion(deckId, wordId, prepared), recommendation: errors >= 2 || strength(context) === 'weak' ? 'Luyện lại ngữ cảnh của từ này' : null };
    },
    confusion(deckId, wordId, prepared = null) {
      const relations = prepared?.relations || P84WordRelationService.all(deckId); const related = relations.filter((item) => (item.sourceWordId === wordId || item.relatedWordId === wordId) && ['similar', 'opposite'].includes(item.relationType)); const card = (prepared?.cardMap || cards()).get(wordId); const wrong = Number(card?.wrongCount || 0) + Number((prepared?.errors || errorCounts()).get(wordId) || 0); return { active: related.length > 0 && wrong >= 2, wrong, relations: related.map(clone) };
    },
    deck(deckId) {
      const words = allWords(deckId); const prepared = { cardMap: cards(), errors: errorCounts(), relations: P84WordRelationService.all(deckId) }; const details = words.map((word) => this.word(deckId, word.id, { ...prepared, word }));
      const mastered = details.filter((item) => item.mastery >= 80 || item.status === 'mastered').length; const weak = details.filter((item) => item.mastery < 40 && item.status !== 'not_started' || item.wrongCount >= 2).length;
      const categories = { meaning: details.filter((item) => item.meaning === 'weak').length, typing: details.filter((item) => item.typing === 'weak').length, confusion: details.filter((item) => item.confusion.active).length, context: details.filter((item) => ['weak', 'not_learned'].includes(item.context)).length };
      return { total: words.length, mastered, learning: Math.max(0, words.length - mastered - weak), weak, categories, details };
    }
  };

  function candidateMode(word, requested) {
    if (requested === 'listening' && !audioAvailable()) return null;
    if (requested === 'context' && !examplesFor(word).length) return null;
    if (requested === 'confusion' && !P84WordRelationService.all(word.deckId, word.id).some((item) => ['similar', 'opposite'].includes(item.relationType))) return null;
    return requested;
  }
  function questionFor(deckId, word, mode) {
    const examples = examplesFor(word); const example = examples[0];
    if (mode === 'context') return { mode, prompt: blankSentence(example.text, word.korean), expected: word.korean, source: example.source, label: example.label, example: example.text };
    if (mode === 'listening') return { mode, prompt: 'Nghe và nhập lại bằng Hangul.', expected: word.korean };
    if (mode === 'confusion') { const relation = P84WordRelationService.all(deckId, word.id).find((item) => ['similar', 'opposite'].includes(item.relationType)); const otherId = relation.sourceWordId === word.id ? relation.relatedWordId : relation.sourceWordId; const other = findWord(deckId, otherId); return { mode, prompt: word.meaning, expected: word.korean, options: [word, other].filter(Boolean).map((item) => ({ id: item.id, korean: item.korean, meaning: item.meaning })), relation }; }
    if (mode === 'meaning') return { mode, prompt: word.korean, expected: word.meaning };
    return { mode: 'typing', prompt: word.meaning, expected: word.korean };
  }
  function validate(word, answer, question) {
    const entered = normalized(answer);
    if (question.mode === 'meaning') return { correct: [word.meaning, ...(word.acceptedMeanings || [])].some((item) => normalized(item) === entered), entered };
    return { correct: [word.korean, ...(word.acceptedAnswers || [])].some((item) => normalized(item) === entered), entered: clean(answer, 300) };
  }

  const P84ReviewIntelligenceService = {
    recommend(deckId, limit = 20) {
      const cardMap = cards(), errors = errorCounts(), relations = P84WordRelationService.all(deckId), stamp = Date.now();
      return allWords(deckId).map((word) => { const card = cardMap.get(word.id); const context = modeStat(card, 'context-fill'); const confusion = P84VocabularyHealthService.confusion(deckId, word.id, { cardMap, errors, relations }); const overdue = card?.nextReview && new Date(card.nextReview).getTime() <= stamp ? Math.max(1, Math.floor((stamp - new Date(card.nextReview).getTime()) / 86400000) + 1) : 0; const wrong = Math.max(Number(card?.wrongCount || 0), Number(errors.get(word.id) || 0)); const lowConfidence = Math.max(0, 50 - Number(card?.mastery || 0)); const score = overdue * 100 + wrong * 25 + (confusion.active ? 30 : 0) + (Number(context.attempts || 0) && strength(context) === 'weak' ? 20 : 0) + lowConfidence; return { word, score, reasons: [overdue && 'SRS overdue', wrong >= 2 && 'Frequently wrong', confusion.active && 'Confusing words', strength(context) === 'weak' && 'Context weakness', lowConfidence > 20 && 'Low confidence'].filter(Boolean) }; }).sort((a, b) => b.score - a.score).slice(0, Math.max(1, Math.min(5000, Number(limit) || 20)));
    },
    availableModes(deckId, words = allWords(deckId)) { const modes = ['meaning', 'typing']; if (audioAvailable()) modes.push('listening'); if (words.some((word) => examplesFor(word).length)) modes.push('context'); if (words.some((word) => P84WordRelationService.all(deckId, word.id).some((item) => ['similar', 'opposite'].includes(item.relationType)))) modes.push('confusion'); return modes; },
    start(deckId, options = {}) {
      const requested = REVIEW_TYPES.includes(options.type) ? options.type : 'mixed'; const count = Math.max(1, Math.min(100, Number(options.count) || 10)); const scanLimit = ['context', 'confusion'].includes(requested) ? 5000 : Math.max(count * 5, 100); let candidates = this.recommend(deckId, scanLimit).map((item) => item.word); if (requested !== 'mixed') candidates = candidates.filter((word) => candidateMode({ ...word, deckId }, requested)); candidates = candidates.slice(0, count); const available = this.availableModes(deckId, candidates); if (!candidates.length) throw new Error(requested === 'listening' && !audioAvailable() ? 'Audio unavailable.' : 'Chưa có dữ liệu phù hợp cho kiểu ôn này.'); if (requested !== 'mixed' && !available.includes(requested)) throw new Error(requested === 'listening' ? 'Audio unavailable.' : 'Chưa có dữ liệu phù hợp cho kiểu ôn này.');
      const queue = candidates.map((word, index) => { const preferred = requested === 'mixed' ? available[index % available.length] : requested; const mode = candidateMode({ ...word, deckId }, preferred) || (available.includes('context') && examplesFor(word).length ? 'context' : 'typing'); return { wordId: word.id, mode }; });
      runtime.deckId = deckId; runtime.session = { id: id('p84-p2-session'), deckId, requested, queue, originalCount: queue.length, completed: 0, correct: 0, wrong: 0, attempts: [], startedAt: now() }; runtime.result = null; setView?.('vocabulary-mastery-session-p84'); return clone(runtime.session);
    },
    current() { const item = runtime.session?.queue?.[0]; if (!item) return null; const word = findWord(runtime.session.deckId, item.wordId); return word ? { item, word, question: questionFor(runtime.session.deckId, word, item.mode) } : null; },
    answer(answer) {
      const current = this.current(); if (!current) throw new Error('Không có câu hỏi đang hoạt động.'); const validation = validate(current.word, answer, current.question); const mode = current.question.mode === 'context' ? 'context-fill' : current.question.mode === 'confusion' ? 'confusion-choice' : current.question.mode === 'listening' ? 'listening-ko' : current.question.mode === 'meaning' ? 'ko-vi' : 'vi-ko';
      const recorded = global.P82LearningSessionService.recordRecall(runtime.session.deckId, current.word.id, validation.correct, validation.entered, { mode, source: 'p84-p2-review', errorType: current.question.mode === 'confusion' ? 'vocabulary-confusion' : current.question.mode === 'context' ? 'vocabulary-context' : 'vocabulary-recall', question: current.question.prompt, expected: current.question.expected, explanation: 'Luyện lại ngữ cảnh của từ này.' });
      runtime.session.queue.shift(); if (validation.correct) { runtime.session.correct += 1; runtime.session.completed += 1; } else { runtime.session.wrong += 1; runtime.session.queue.push(current.item); }
      runtime.session.attempts.push({ wordId: current.word.id, mode: current.question.mode, correct: validation.correct, answer: validation.entered, createdAt: now() }); runtime.result = { ...validation, word: current.word, question: current.question, recorded };
      if (!runtime.session.queue.length) { const summary = { id: runtime.session.id, deckId: runtime.session.deckId, type: runtime.session.requested, words: runtime.session.originalCount, correct: runtime.session.correct, wrong: runtime.session.wrong, attempts: runtime.session.attempts.length, startedAt: runtime.session.startedAt, completedAt: now(), updatedAt: now() }; const currentOrg = organization(); saveOrganization({ reviewHistory: [summary, ...currentOrg.reviewHistory.filter((item) => item.id !== summary.id)].slice(0, 100) }, 'p84-p2-review-complete'); runtime.session = null; runtime.result = { completed: true, summary }; }
      return clone(runtime.result);
    },
    next() { runtime.result = null; render?.(); },
    play() { const current = this.current(); if (current?.question.mode === 'listening' && audioAvailable()) speakKorean?.(current.word.korean); return audioAvailable(); }
  };

  const P84ContextService = {
    examples: examplesFor,
    question(deckId, wordId, source = 'any') { const word = findWord(deckId, wordId); if (!word) return null; const example = examplesFor(word).find((item) => source === 'any' || item.source === source); return example ? { word: clone(word), type: 'fill-blank', prompt: blankSentence(example.text, word.korean), expected: word.korean, example: clone(example), offline: true } : null; },
    aiConsentRequired: true,
    async generateExample(deckId, wordId, consent = false) { const word = findWord(deckId, wordId); if (!consent) return { status: 'consent_required', label: 'AI Generated' }; if (PrivacyPreferenceService?.allows?.('aiUsage') !== true || !global.AICoachService?.request) return { status: 'unavailable', label: 'AI Generated' }; const reply = await global.AICoachService.request(`Tạo đúng một câu ví dụ tiếng Hàn ngắn có từ ${word.korean}. Không dùng dữ liệu cá nhân.`, 'vocabulary_example'); return { status: 'generated', text: clean(reply, 500), label: 'AI Generated', official: false }; }
  };

  function healthView() {
    const deckId = runtime.deckId || state.p82Vocabulary?.deckId || global.P82DeckService.all()[0]?.id; const deck = global.P82DeckService.get(deckId); if (!deck) return '<div class="p84-p2-shell"><section class="empty-state">Chưa có deck từ vựng.</section></div>';
    runtime.deckId = deck.id; const health = P84VocabularyHealthService.deck(deck.id); const detail = runtime.detailWordId ? P84VocabularyHealthService.word(deck.id, runtime.detailWordId) : null;
    const rows = health.details.slice(0, 100).map((item) => `<button class="p84-p2-word" data-p84-p2-detail="${item.word.id}"><b lang="ko">${escapeHtml(item.word.korean)}</b><span>${escapeHtml(item.word.meaning)}</span><small>Meaning: ${item.meaning} · Typing: ${item.typing} · Context: ${item.context} · Listening: ${item.listening}</small></button>`).join('');
    return `<div class="p84-p2-shell"><section class="section p84-p2-heading"><button class="back-link" data-view="vocabulary-deck-p82">← Deck</button><p class="eyebrow">P84-P2 · VOCABULARY MASTERY</p><h1>${escapeHtml(deck.title)}</h1><p>Phân tích từ bằng evidence hiện có; không thay thế mastery hoặc SRS.</p></section><section class="section p84-p2-health"><div><strong>${health.total}</strong><span>Tổng từ</span></div><div><strong>${health.mastered}</strong><span>Mastered</span></div><div><strong>${health.learning}</strong><span>Learning</span></div><div><strong>${health.weak}</strong><span>Weak</span></div></section><section class="section p84-p2-categories"><h2>Weak categories</h2><span>Nhớ nghĩa kém <b>${health.categories.meaning}</b></span><span>Nhập sai <b>${health.categories.typing}</b></span><span>Nhầm từ <b>${health.categories.confusion}</b></span><span>Chưa dùng được <b>${health.categories.context}</b></span></section><section class="section p84-p2-review-picker"><h2>Smart Review</h2><p>Ưu tiên: SRS overdue → frequently wrong → confusing words → context weakness → low confidence.</p><div>${['meaning','typing','listening','context','confusion','mixed'].map((type) => `<button class="btn secondary" data-p84-p2-start="${type}" ${type === 'listening' && !audioAvailable() ? 'disabled title="Audio unavailable"' : ''}>${({meaning:'Ôn nghĩa',typing:'Ôn nhập từ',listening:'Ôn nghe',context:'Ôn ngữ cảnh',confusion:'Ôn từ dễ nhầm',mixed:'Mixed Review'})[type]}</button>`).join('')}</div></section>${detail ? `<section class="section p84-p2-detail"><h2 lang="ko">${escapeHtml(detail.word.korean)}</h2><p>${escapeHtml(detail.word.meaning)}</p><div class="action-row"><button class="btn secondary" data-p84-p2-listen-word="${escapeHtml(detail.word.korean)}" ${audioAvailable() ? '' : 'disabled'}>🔊 Listen</button>${pronunciationAvailable() ? '<button class="btn secondary" data-view="speaking-room">🎙 Speak & compare</button>' : '<span class="subtle">Speech Recognition unavailable</span>'}</div>${detail.confusion.active ? '<div class="p84-warning">⚠️ Bạn đang nhầm nhóm từ này</div>' : ''}<details open><summary>Breakdown</summary><ul><li>Meaning: ${detail.meaning}</li><li>Typing: ${detail.typing}</li><li>Context: ${detail.context}</li><li>Listening: ${detail.listening}</li></ul></details><details><summary>Word family & relations</summary>${P84WordRelationService.all(deck.id, detail.word.id).map((relation) => `<p><b>${escapeHtml(relation.sourceWord)}</b> ↔ <b>${escapeHtml(relation.relatedWord)}</b> · ${relation.relationType} · ${relation.source === 'verified' ? 'Verified relationship' : 'Suggested relationship'}</p>`).join('') || '<p>Chưa có quan hệ đã lưu.</p>'}<button class="btn secondary" data-p84-p2-add-relation="${detail.word.id}">Thêm relation</button></details><details><summary>Context & examples</summary>${P84ContextService.examples(detail.word).map((example) => `<p><span>${escapeHtml(example.label)}</span><br><b lang="ko">${escapeHtml(example.text)}</b></p>`).join('') || '<p>Chưa có câu ví dụ; hệ thống không tạo dữ liệu giả.</p>'}</details>${detail.recommendation ? `<p class="p84-p2-recommendation">${detail.recommendation}</p>` : ''}</section>` : ''}<section class="section p84-p2-word-list"><h2>Word-level analysis</h2>${rows || '<div class="empty-state">Deck chưa có từ.</div>'}</section></div>`;
  }
  function sessionView() {
    if (!runtime.session) { const summary = runtime.result?.summary; return `<div class="p84-p2-shell p84-p2-focus"><section class="section p84-p2-complete"><span>✓</span><h1>${summary ? 'Hoàn thành Mixed Review' : 'Chưa có phiên ôn'}</h1>${summary ? `<p>${summary.words} từ · ${summary.correct} đúng · ${summary.wrong} sai. SRS, mastery và Error Notebook đã được cập nhật.</p>` : ''}<button class="btn primary" data-view="vocabulary-mastery-p84">Xem Vocabulary Health</button></section></div>`; }
    const current = P84ReviewIntelligenceService.current(); if (!current) return healthView(); const result = runtime.result; const question = current.question; const progress = Math.round(runtime.session.completed / runtime.session.originalCount * 100);
    const sourceBadge = question.source ? `<small>${question.label}${question.source === 'personal' ? ' · riêng tư, xử lý trên thiết bị' : ''}</small>` : '';
    return `<div class="p84-p2-shell p84-p2-focus"><section class="section p84-p2-session-head"><button class="back-link" data-view="vocabulary-mastery-p84">← Lưu và thoát</button><p class="eyebrow">${question.mode.toUpperCase()} · ${runtime.session.completed}/${runtime.session.originalCount}</p><div class="p84-p2-progress"><i style="width:${progress}%"></i></div></section><section class="section p84-p2-question" data-mode="${question.mode}">${question.mode === 'listening' ? '<button class="p84-p2-audio" data-p84-p2-audio aria-label="Nghe từ tiếng Hàn">🔊 Nghe</button><p>Audio được tạo bằng khả năng phát âm của thiết bị.</p>' : `<h2 ${question.mode === 'meaning' ? 'lang="ko"' : ''}>${escapeHtml(question.prompt)}</h2>`}${sourceBadge}${!result && question.options ? `<div class="p84-p2-options">${question.options.map((option) => `<button data-p84-p2-choice="${escapeHtml(option.korean)}"><b lang="ko">${escapeHtml(option.korean)}</b><span>${escapeHtml(option.meaning)}</span></button>`).join('')}</div>` : !result ? `<form id="p84P2Answer"><label>${question.mode === 'meaning' ? 'Nghĩa tiếng Việt' : 'Đáp án'}</label><input name="answer" autocomplete="off" autofocus required><button class="btn primary">Kiểm tra</button></form>` : ''}${result ? `<aside class="${result.correct ? 'correct' : 'wrong'}"><b>${result.correct ? '✓ Chính xác' : '❌ Chưa chính xác'}</b><p>Đáp án: <strong lang="ko">${escapeHtml(question.expected)}</strong></p>${question.example ? `<p lang="ko">${escapeHtml(question.example)}</p>` : ''}<button class="btn primary" data-p84-p2-next>${result.correct ? 'Tiếp tục' : 'Thử lại sau'}</button></aside>` : ''}</section></div>`;
  }
  function decorate() {
    if (state.currentView === 'vocabulary-deck-p82' && !global.document?.querySelector('[data-p84-p2-open]')) global.document?.querySelector('.p84-deck-organizer, .p82-stats')?.insertAdjacentHTML('afterend', '<section class="section p84-p2-entry" data-p84-p2-open><div><p class="eyebrow">P84-P2 · REAL USAGE</p><h2>Vocabulary Health & Context</h2><p>Ngữ cảnh, từ dễ nhầm và smart review dựa trên evidence hiện có.</p></div><button class="btn primary" data-p84-p2-health>Mở phân tích</button></section>');
  }
  function bind() {
    decorate();
    global.document?.querySelector('[data-p84-p2-health]')?.addEventListener('click', () => { runtime.deckId = state.p82Vocabulary?.deckId; runtime.detailWordId = ''; setView('vocabulary-mastery-p84'); });
    global.document?.querySelectorAll('[data-p84-p2-detail]')?.forEach((button) => { button.onclick = () => { runtime.detailWordId = button.dataset.p84P2Detail; render(); }; });
    global.document?.querySelectorAll('[data-p84-p2-start]')?.forEach((button) => { button.onclick = () => { try { P84ReviewIntelligenceService.start(runtime.deckId, { type: button.dataset.p84P2Start, count: 10 }); } catch (error) { toast?.(error.message); } }; });
    global.document?.querySelectorAll('[data-p84-p2-add-relation]')?.forEach((button) => { button.onclick = () => { const source = findWord(runtime.deckId, button.dataset.p84P2AddRelation); const relatedText = global.prompt('Từ liên quan trong cùng deck', ''); if (!relatedText) return; const related = allWords(runtime.deckId).find((word) => normalized(word.korean) === normalized(relatedText)); if (!related) return toast?.('Không tìm thấy từ liên quan trong deck.'); const relationType = global.prompt(`Loại quan hệ: ${RELATION_TYPES.join(', ')}`, 'family'); const verified = global.confirm('Bạn xác nhận quan hệ này là đúng? Cancel sẽ lưu dạng Suggested relationship.'); try { P84WordRelationService.add({ deckId: runtime.deckId, sourceWordId: source.id, relatedWordId: related.id, relationType, source: verified ? 'verified' : 'suggested', confidence: verified ? 1 : .6 }); render(); } catch (error) { toast?.(error.message); } }; });
    const form = global.document?.getElementById('p84P2Answer'); if (form) form.onsubmit = (event) => { event.preventDefault(); try { P84ReviewIntelligenceService.answer(new FormData(form).get('answer')); render(); } catch (error) { toast?.(error.message); } };
    global.document?.querySelectorAll('[data-p84-p2-choice]')?.forEach((button) => { button.onclick = () => { if (runtime.result) return; P84ReviewIntelligenceService.answer(button.dataset.p84P2Choice); render(); }; });
    global.document?.querySelector('[data-p84-p2-next]')?.addEventListener('click', () => P84ReviewIntelligenceService.next());
    global.document?.querySelector('[data-p84-p2-audio]')?.addEventListener('click', () => { if (!P84ReviewIntelligenceService.play()) toast?.('Audio unavailable.'); });
    global.document?.querySelectorAll('[data-p84-p2-listen-word]')?.forEach((button) => { button.onclick = () => speakKorean?.(button.dataset.p84P2ListenWord); });
  }

  Object.assign(global, { P84ContextService, P84WordRelationService, P84VocabularyHealthService, P84ReviewIntelligenceService, P84VocabularyMastery: { version: 'p84-p2', context: P84ContextService, relations: P84WordRelationService, health: P84VocabularyHealthService, review: P84ReviewIntelligenceService, audioAvailable, pronunciationAvailable } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'vocabulary-mastery-p84': healthView, 'vocabulary-mastery-session-p84': sessionView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER; global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };
})(window);
