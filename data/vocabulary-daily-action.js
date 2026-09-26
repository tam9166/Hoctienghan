/* P84-P0 — local-first vocabulary Today action. Orchestrates P82; it does not replace SRS/session engines. */
(function vocabularyDailyAction(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app || !global.P82DeckService || !global.P82LearningSessionService) return;
  const { state, STORAGE_KEYS, escapeHtml = String, render, setView, toast, userScoped, saveUserScoped } = app;
  const runtime = state.p84Vocabulary || (state.p84Vocabulary = { mode: 'today', recallMode: 'vi-ko', requested: 10, adjustedCount: 0, message: '', excludeWordIds: [], deckId: '' });
  if (!runtime.recallMode) runtime.recallMode = 'vi-ko';
  const language = () => global.document?.documentElement?.lang || 'vi';
  const copy = (vi, en, zh) => ({ vi, en, 'zh-CN': zh })[language()] || vi;
  const dateValue = (value, fallback = Number.MAX_SAFE_INTEGER) => { const parsed = new Date(value || '').getTime(); return Number.isFinite(parsed) ? parsed : fallback; };
  const unique = (items) => { const seen = new Set(); return items.filter((item) => item?.id && !seen.has(item.id) && seen.add(item.id)); };

  function preferences() { return userScoped?.(STORAGE_KEYS.dailyExperience)?.[0] || {}; }
  function savePreference(count) {
    const previous = preferences();
    saveUserScoped?.(STORAGE_KEYS.dailyExperience, [{ ...previous, preferredVocabularyCount: count, updatedAt: new Date().toISOString() }], 5);
  }
  function defaultCount() { const value = Number(preferences().preferredVocabularyCount); return Number.isInteger(value) && value > 0 ? value : 10; }
  function errorsByWord() {
    const result = new Map();
    (global.ErrorNotebookService?.all?.() || []).filter((item) => !item.resolved && item.wordId).forEach((item) => result.set(item.wordId, Number(result.get(item.wordId) || 0) + Math.max(1, Number(item.count) || 1)));
    return result;
  }
  function frequentlyWrong(entry, errorCount = 0) {
    const progress = entry?.progress || {}; const repeated = Math.max(Number(progress.wrongAttempts || 0), Number(errorCount || 0));
    return repeated >= 2 && Boolean(progress.weak || Number(progress.wrongAttempts || 0) > Number(progress.correctAttempts || 0));
  }
  function goalScore(deck) {
    const target = Number(state.currentUser?.targetTopikLevel || 0); const tokens = [state.currentUser?.level, ...(state.currentUser?.goals || []), target ? `topik ${target}` : ''].filter(Boolean).join(' ').toLocaleLowerCase();
    const text = `${deck.title || ''} ${deck.description || ''} ${(deck.topics || []).map((item) => item.name).join(' ')}`.toLocaleLowerCase();
    return tokens.split(/\s+/).filter((token) => token.length > 1 && text.includes(token)).length;
  }
  function deckSnapshot(deck) {
    const errorCounts = errorsByWord(); let entries = global.P82DeckService.learningWords(deck.id);
    const selectedTopic = state.p82Vocabulary?.deckId === deck.id ? state.p82Vocabulary?.topic : 'all';
    if (selectedTopic && selectedTopic !== 'all') entries = entries.filter((entry) => entry.topic === selectedTopic);
    entries = entries.map((entry) => ({ ...entry, errorCount: Number(errorCounts.get(entry.id) || 0) }));
    const due = entries.filter((entry) => entry.progress.status === 'reviewing').sort((a, b) => dateValue(a.progress.nextReview, 0) - dateValue(b.progress.nextReview, 0));
    const unmastered = entries.filter((entry) => !entry.progress.mastered);
    const learning = unmastered.filter((entry) => entry.progress.status !== 'not_started' && entry.progress.status !== 'reviewing').sort((a, b) => Number(b.progress.wrongAttempts || 0) - Number(a.progress.wrongAttempts || 0) || Number(a.progress.mastery || 0) - Number(b.progress.mastery || 0));
    const wrong = unmastered.filter((entry) => Number(entry.progress.wrongAttempts || 0) > 0).sort((a, b) => Number(b.progress.wrongAttempts || 0) - Number(a.progress.wrongAttempts || 0));
    const fresh = unmastered.filter((entry) => entry.progress.status === 'not_started').sort((a, b) => Number(a.sourceOrder ?? a.sourceRow ?? 0) - Number(b.sourceOrder ?? b.sourceRow ?? 0));
    const weak = entries.filter((entry) => frequentlyWrong(entry, entry.errorCount)).sort((a, b) => Math.max(Number(b.progress.wrongAttempts || 0), b.errorCount) - Math.max(Number(a.progress.wrongAttempts || 0), a.errorCount) || dateValue(b.progress.lastReviewed, 0) - dateValue(a.progress.lastReviewed, 0));
    const unmasteredPriority = unique([...learning, ...wrong, ...fresh]);
    const today = unique([...due, ...unmasteredPriority, ...weak]);
    return { deck, topic: selectedTopic || 'all', entries, due, unmastered, unmasteredPriority, weak, fresh, today, activeSession: deck.activeSession || null };
  }
  function selectedSnapshot() {
    const decks = global.P82DeckService.all();
    if (!decks.length) return null;
    const selectedId = runtime.deckId || state.p82Vocabulary?.deckId;
    const active = decks.find((deck) => deck.activeSession);
    const selected = decks.find((deck) => deck.id === selectedId);
    if (active || selected) return deckSnapshot(active || selected);
    const ranked = decks.map((deck) => { const snapshot = deckSnapshot(deck); const priority = snapshot.due.length ? 4 : snapshot.unmastered.length ? 3 : snapshot.weak.length ? 2 : 0; return { snapshot, score: priority * 100000 + goalScore(deck) * 1000 + dateValue(deck.updatedAt, 0) / 1e12 }; }).sort((a, b) => b.score - a.score);
    return ranked[0]?.snapshot || null;
  }
  function recommendation(snapshot = selectedSnapshot()) {
    if (!snapshot) return { kind: 'empty', label: copy('Thêm bộ từ đầu tiên', 'Add your first deck', '添加第一个词库'), available: 0, snapshot: null };
    if (snapshot.activeSession) return { kind: 'resume', label: copy('Tiếp tục phiên từ vựng', 'Continue vocabulary session', '继续词汇学习'), available: snapshot.activeSession.queue?.length || 0, snapshot };
    if (snapshot.due.length) return { kind: 'today', reason: 'due', label: copy('Ôn từ đến hạn', 'Review due vocabulary', '复习到期词汇'), available: snapshot.today.length, snapshot };
    if (snapshot.unmastered.length) return { kind: 'unmastered', reason: 'unmastered', label: copy(`Học ${Math.min(defaultCount(), snapshot.unmastered.length)} từ chưa thuộc`, `Learn ${Math.min(defaultCount(), snapshot.unmastered.length)} unmastered words`, `学习 ${Math.min(defaultCount(), snapshot.unmastered.length)} 个未掌握词`), available: snapshot.unmastered.length, snapshot };
    if (snapshot.weak.length) return { kind: 'weak', reason: 'weak', label: copy('Ôn từ hay sai', 'Review frequently missed words', '复习常错词'), available: snapshot.weak.length, snapshot };
    return { kind: 'complete', label: copy('Bạn đã hoàn thành các nhiệm vụ từ vựng hôm nay', 'Today’s vocabulary tasks are complete', '今天的词汇任务已完成'), available: 0, snapshot };
  }
  function pool(mode = runtime.mode, snapshot = selectedSnapshot()) {
    if (!snapshot) return [];
    const values = mode === 'weak' ? snapshot.weak : mode === 'unmastered' ? snapshot.unmasteredPriority : snapshot.today;
    const excluded = new Set(runtime.excludeWordIds || []); const remaining = values.filter((entry) => !excluded.has(entry.id));
    return remaining.length ? remaining : values;
  }
  function validateCount(value, available, custom = false) {
    const number = Number(value);
    if (!Number.isInteger(number)) return { ok: false, message: copy('Số lượng phải là số nguyên.', 'Enter a whole number.', '请输入整数。') };
    if (number <= 0) return { ok: false, message: copy('Số lượng phải lớn hơn 0.', 'The amount must be greater than 0.', '数量必须大于 0。') };
    if (!available) return { ok: false, message: copy('Hiện không có từ phù hợp.', 'No matching words are available.', '目前没有符合条件的词。') };
    if (custom && number > available) return { ok: false, message: copy(`Chỉ có ${available} từ phù hợp. Hãy nhập từ 1 đến ${available}.`, `Only ${available} words are available. Enter 1–${available}.`, `只有 ${available} 个符合条件的词，请输入 1–${available}。`) };
    return { ok: true, count: Math.min(number, available), adjusted: number > available };
  }
  function open(mode = 'today', options = {}) {
    runtime.mode = ['today', 'unmastered', 'weak'].includes(mode) ? mode : 'today'; runtime.deckId = options.deckId || runtime.deckId || ''; runtime.excludeWordIds = options.excludeWordIds || []; runtime.requested = defaultCount(); runtime.adjustedCount = 0; runtime.message = ''; setView('vocabulary-today-p84');
  }
  function startRequested(value, custom = false) {
    const snapshot = selectedSnapshot(); const availableWords = pool(runtime.mode, snapshot); const validation = validateCount(value, availableWords.length, custom);
    if (!validation.ok) { runtime.adjustedCount = 0; runtime.message = validation.message; render(); return validation; }
    if (validation.adjusted) { runtime.requested = validation.count; runtime.adjustedCount = validation.count; runtime.message = copy(`Hiện có ${validation.count} từ phù hợp.`, `${validation.count} matching words are available.`, `目前有 ${validation.count} 个符合条件的词。`); render(); return { ...validation, needsConfirmation: true }; }
    const active = snapshot?.activeSession;
    if (active) { state.p82Vocabulary.deckId = snapshot.deck.id; global.P82LearningSessionService.resume(snapshot.deck.id); setView('vocabulary-session-p82'); return { ok: true, resumed: true, count: active.selectedWordIds.length }; }
    const wordIds = availableWords.slice(0, validation.count).map((entry) => entry.id);
    const session = global.P82LearningSessionService.start(snapshot.deck.id, { scope: runtime.mode, topic: snapshot.topic, count: wordIds.length, wordIds, source: 'p84-today', mode: runtime.recallMode });
    state.p82Vocabulary.deckId = snapshot.deck.id; savePreference(wordIds.length); runtime.adjustedCount = 0; runtime.message = ''; runtime.excludeWordIds = []; setView('vocabulary-session-p82'); return { ok: true, count: wordIds.length, session };
  }
  function confirmAdjusted() { return startRequested(runtime.requested, true); }
  function retryLatest(deckId) {
    const deck = global.P82DeckService.get(deckId); const latest = deck?.sessionHistory?.find((item) => item.source === 'p84-today' && item.weakWordIds?.length);
    if (!latest) return open('weak', { deckId });
    runtime.deckId = deckId; runtime.mode = 'weak'; runtime.recallMode = latest.mode || runtime.recallMode; runtime.excludeWordIds = []; const session = global.P82LearningSessionService.start(deckId, { scope: 'weak', count: latest.weakWordIds.length, wordIds: latest.weakWordIds, source: 'p84-today', mode: runtime.recallMode }); state.p82Vocabulary.deckId = deckId; setView('vocabulary-session-p82'); return session;
  }
  function learnMore(deckId) {
    const deck = global.P82DeckService.get(deckId); const latest = deck?.sessionHistory?.find((item) => item.source === 'p84-today');
    open('today', { deckId, excludeWordIds: latest?.selectedWordIds || [] });
  }
  function homeCard() {
    const value = recommendation(); const snapshot = value.snapshot;
    if (!snapshot) return `<section class="p84-today-card" data-p84-home><div><p class="eyebrow">🎯 ${copy('HÔM NAY BẠN NÊN HỌC', 'TODAY’S VOCABULARY', '今日词汇')}</p><h2>${copy('Tạo bộ từ cá nhân đầu tiên', 'Create your first personal deck', '创建第一个个人词库')}</h2><p>${copy('Import hoặc thêm từ để nhận đề xuất trên thiết bị.', 'Import or add words to get an on-device recommendation.', '导入或添加词汇即可获得设备端推荐。')}</p></div><button class="btn primary" data-view="my-vocabulary-p82">${copy('Mở My Vocabulary', 'Open My Vocabulary', '打开我的词汇')}</button></section>`;
    const counts = `<ul><li><b>${snapshot.due.length}</b> ${copy('từ đến hạn ôn', 'due for review', '个到期词')}</li><li><b>${snapshot.unmastered.length}</b> ${copy('từ chưa thuộc', 'unmastered', '个未掌握词')}</li><li><b>${snapshot.weak.length}</b> ${copy('từ hay sai', 'frequently missed', '个常错词')}</li></ul>`;
    return `<section class="p84-today-card" data-p84-home aria-labelledby="p84TodayTitle"><div><p class="eyebrow">🎯 ${copy('HÔM NAY BẠN NÊN HỌC', 'TODAY’S VOCABULARY', '今日词汇')}</p><h2 id="p84TodayTitle">${escapeHtml(value.label)}</h2><p>${escapeHtml(snapshot.deck.title)}${snapshot.topic !== 'all' ? ` · ${escapeHtml(snapshot.topic)}` : ''}</p>${counts}</div><div class="p84-today-actions">${value.kind === 'complete' ? '<span class="p84-complete" role="status">✓</span>' : `<button class="btn primary" data-p84-open="${value.kind === 'resume' ? 'resume' : value.kind}">${escapeHtml(value.label)}</button>`}<button class="p84-link" data-p84-open="unmastered" ${snapshot.unmastered.length ? '' : 'disabled'}>${copy('Học từ chưa thuộc', 'Learn unmastered', '学习未掌握词')}</button><button class="p84-link" data-p84-open="weak" ${snapshot.weak.length ? '' : 'disabled'}>🔥 ${copy('Ôn từ hay sai', 'Review frequent mistakes', '复习常错词')}</button></div></section>`;
  }
  function selectionView() {
    const snapshot = selectedSnapshot(); const values = pool(runtime.mode, snapshot); const available = values.length; const title = runtime.mode === 'weak' ? copy('Ôn từ hay sai', 'Review frequently missed words', '复习常错词') : runtime.mode === 'unmastered' ? copy('Học từ chưa thuộc', 'Learn unmastered vocabulary', '学习未掌握词') : copy('Từ vựng hôm nay', 'Today’s vocabulary', '今日词汇');
    if (!snapshot) return `<section class="p84-selection section"><button class="back-link" data-view="home">← Home</button><h1>${title}</h1><p>${copy('Chưa có bộ từ cá nhân.', 'No personal vocabulary deck yet.', '还没有个人词库。')}</p><button class="btn primary" data-view="my-vocabulary-p82">My Vocabulary</button></section>`;
    const preview = values.slice(0, 8).map((entry) => `<li><b lang="ko">${escapeHtml(entry.korean)}</b><span>${escapeHtml(entry.meaning)}</span>${runtime.mode === 'weak' ? `<small>${Math.max(entry.errorCount, Number(entry.progress.wrongAttempts || 0))}× ${copy('sai', 'wrong', '错误')}</small>` : ''}</li>`).join('');
    const recallModes = [{ id: 'vi-ko', label: 'Việt → Hàn' }, { id: 'ko-vi', label: 'Hàn → Việt' }, ...(global.P84RecallInputService?.audioAvailable?.() ? [{ id: 'listening-ko', label: 'Nghe → Hàn' }] : []), { id: 'mixed', label: 'Trộn' }];
    return `<section class="p84-selection section"><button class="back-link" data-view="home">← Home</button><p class="eyebrow">P84-P1 · ${escapeHtml(snapshot.deck.title)}</p><h1>${escapeHtml(title)}</h1><p>${available ? copy(`Hiện có ${available} từ phù hợp. Chọn số từ và cách luyện.`, `${available} matching words are available. Choose a size and recall mode.`, `目前有 ${available} 个符合条件的词。请选择数量和练习方式。`) : copy('Bạn đã hoàn thành các nhiệm vụ từ vựng hôm nay.', 'Today’s vocabulary tasks are complete.', '今天的词汇任务已完成。')}</p>${runtime.message ? `<div class="p84-message" role="alert">${escapeHtml(runtime.message)}${runtime.adjustedCount ? `<button class="btn primary" data-p84-confirm-adjusted>${copy(`Học ${runtime.adjustedCount} từ`, `Learn ${runtime.adjustedCount} words`, `学习 ${runtime.adjustedCount} 个词`)}</button>` : ''}</div>` : ''}${available ? `<fieldset class="p84-size"><legend>${copy('Bạn muốn học bao nhiêu?', 'How many words?', '想学习多少个词？')}</legend><div>${[5,10,20].map((count) => `<button type="button" class="${runtime.requested === count ? 'active' : ''}" data-p84-size="${count}">${count}</button>`).join('')}<button type="button" data-p84-custom-toggle>${copy('Tùy chỉnh', 'Custom', '自定义')}</button></div><form id="p84CustomForm" class="p84-custom hidden"><label for="p84CustomCount">${copy(`Nhập từ 1 đến ${available}`, `Enter 1–${available}`, `输入 1–${available}`)}</label><input id="p84CustomCount" name="count" type="number" min="1" max="${available}" step="1" inputmode="numeric" required><button class="btn primary">${copy('Bắt đầu', 'Start', '开始')}</button></form></fieldset><fieldset class="p84-recall-mode"><legend>Bạn muốn luyện thế nào?</legend>${recallModes.map((mode) => `<button type="button" class="${runtime.recallMode === mode.id ? 'active' : ''}" data-p84-recall-mode="${mode.id}">${mode.label}</button>`).join('')}</fieldset><button class="btn primary" data-p84-start-selected>Bắt đầu ${runtime.requested} từ</button><ul class="p84-preview" aria-label="${copy('Từ được ưu tiên', 'Priority words', '优先词汇')}">${preview}</ul>` : '<button class="btn secondary" data-view="home">Kết thúc</button>'}</section>`;
  }
  function bind() {
    if (state.currentView === 'home' && !global.document?.querySelector('[data-p84-home]')) {
      const anchor = global.document?.querySelector('.ux-today-strip, .daily-home-header, .foundation-welcome, .daily-start-panel, .dashboard-hero, .bla-home-hero');
      anchor?.insertAdjacentHTML('afterend', homeCard());
    }
    global.document?.querySelectorAll?.('[data-p84-open]')?.forEach((button) => { button.onclick = () => { const mode = button.dataset.p84Open; if (mode === 'resume') { const snapshot = selectedSnapshot(); if (snapshot?.activeSession) { state.p82Vocabulary.deckId = snapshot.deck.id; global.P82LearningSessionService.resume(snapshot.deck.id); setView('vocabulary-session-p82'); } return; } open(mode); }; });
    global.document?.querySelectorAll?.('[data-p84-size]')?.forEach((button) => { button.onclick = () => { runtime.requested = Number(button.dataset.p84Size); render(); }; });
    global.document?.querySelector('[data-p84-start-selected]')?.addEventListener('click', () => startRequested(runtime.requested, false));
    global.document?.querySelectorAll?.('[data-p84-recall-mode]')?.forEach((button) => { button.onclick = () => { runtime.recallMode = button.dataset.p84RecallMode; render(); }; });
    global.document?.querySelector('[data-p84-custom-toggle]')?.addEventListener('click', () => { const form = global.document.getElementById('p84CustomForm'); form?.classList.toggle('hidden'); form?.querySelector('input')?.focus(); });
    const custom = global.document?.getElementById('p84CustomForm'); if (custom) custom.onsubmit = (event) => { event.preventDefault(); startRequested(new FormData(custom).get('count'), true); };
    global.document?.querySelector('[data-p84-confirm-adjusted]')?.addEventListener('click', confirmAdjusted);
    global.document?.querySelectorAll?.('[data-p84-retry]')?.forEach((button) => { button.onclick = () => retryLatest(button.dataset.p84Retry); });
    global.document?.querySelectorAll?.('[data-p84-more]')?.forEach((button) => { button.onclick = () => learnMore(button.dataset.p84More); });
  }

  const P84TodayVocabularyService = { snapshot: selectedSnapshot, recommendation, pool, validateCount, frequentlyWrong, open, startRequested, retryLatest, learnMore, homeCard, defaultCount };
  global.P84TodayVocabularyService = P84TodayVocabularyService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'vocabulary-today-p84': selectionView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };
  render();
})(window);
