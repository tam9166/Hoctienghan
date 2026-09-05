/* Tiếng Hàn - TamHoanq — reading and language expansion experience */
(function buildReadingExpansion(global) {
  'use strict';
  const app = global.KLEARN_APP;
  const data = global.KLEARN_READING_EXPANSION;
  if (!app || !data) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, saveUserProgress, userScoped, saveUserScoped, MasteryService, DictionaryService } = app;
  const runtime = state.readingLab || (state.readingLab = { level: 'Beginner', selectedId: '', startedAt: null, activeLookup: null, encounteredWords: [], result: null, networkRoot: '먹다', collocationIndex: 0, collocationResult: null, dictationLevel: 'Beginner', dictationIndex: 0, dictationResult: null });
  const now = () => new Date().toISOString();
  const compact = (value) => String(value || '').normalize('NFC').replace(/[\s.,!?;:'"“”‘’()[\]{}~-]+/g, '');
  const readingText = (item) => (item?.segments || []).map((segment) => segment.text).join('');
  const readingWordCount = (item) => readingText(item).trim().split(/\s+/).filter(Boolean).length;
  const entryFor = (word) => (global.KLEARN_DICTIONARY || []).find((entry) => entry.korean === word || entry.id === word) || null;
  const networkFor = (word) => data.wordNetworks.find((item) => item.root === word || item.forms?.some((form) => compact(form.korean) === compact(word)) || item.related?.some((related) => related.korean === word)) || null;

  const ReadingProgressService = {
    all() { return userScoped(STORAGE_KEYS.readingExpansion); },
    get(kind, contentId) { return this.all().find((item) => item.kind === kind && item.contentId === contentId) || null; },
    upsert(kind, contentId, changes = {}) {
      const list = this.all(); const previous = this.get(kind, contentId) || { id: `${kind}-${contentId}`, kind, contentId, attempts: 0 };
      const next = { ...previous, ...changes, id: previous.id, kind, contentId, updatedAt: now() };
      saveUserScoped(STORAGE_KEYS.readingExpansion, [next, ...list.filter((item) => !(item.kind === kind && item.contentId === contentId))], 300);
      return next;
    },
    recordReading(item, { score, durationSeconds, newWords = [], wrongQuestions = [] }) {
      const previous = this.get('reading', item.id);
      const seconds = Math.max(10, Number(durationSeconds) || 10);
      const wpm = Math.max(1, Math.round(readingWordCount(item) / (seconds / 60)));
      const combinedWords = [...new Set([...(previous?.newWords || []), ...newWords])];
      const saved = this.upsert('reading', item.id, { attempts: Number(previous?.attempts || 0) + 1, completed: true, bestScore: Math.max(Number(previous?.bestScore || 0), score), lastScore: score, lastWpm: wpm, bestWpm: Math.max(Number(previous?.bestWpm || 0), wpm), durationSeconds: seconds, newWords: combinedWords, errorCount: Number(previous?.errorCount || 0) + wrongQuestions.length, lastReadAt: now() });
      const progress = getUserProgress(); progress.daily.tasks.practice = true; progress.skills.reading = Math.max(Number(progress.skills.reading || 0), Math.round(score * .85)); saveUserProgress(progress);
      MasteryService.updateLesson(`reading:${item.id}`, score, { completed: true, kind: 'reading' });
      wrongQuestions.forEach((question) => global.ErrorNotebookService?.add?.({ type: 'reading', question: question.prompt, mistake: question.selected || 'Chưa chọn đúng', correction: question.correct, explanation: `Bài đọc: ${item.title}` }));
      newWords.forEach((word) => { const node = global.KnowledgeGraphService?.get?.(word); if (node) global.KnowledgeGraphService.record(node.id, { correct: score >= 70, source: 'reading-lab' }); });
      return saved;
    },
    recordCollocation(item, correct, selected) {
      const previous = this.get('collocation', item.id);
      const saved = this.upsert('collocation', item.id, { attempts: Number(previous?.attempts || 0) + 1, correctCount: Number(previous?.correctCount || 0) + (correct ? 1 : 0), wrongCount: Number(previous?.wrongCount || 0) + (correct ? 0 : 1), lastCorrect: correct, lastAnswer: selected, lastPracticedAt: now() });
      MasteryService.updateLesson(`collocation:${item.id}`, correct ? 85 : 35, { kind: 'collocation' });
      if (!correct) global.ErrorNotebookService?.add?.({ type: 'vocabulary', question: `${item.prompt}${item.particle} ___`, mistake: `${item.prompt}${item.particle} ${selected}`, correction: item.natural, explanation: item.explanation });
      return saved;
    },
    recordDictation(item, result) {
      const previous = this.get('dictation', item.id);
      const saved = this.upsert('dictation', item.id, { attempts: Number(previous?.attempts || 0) + 1, bestScore: Math.max(Number(previous?.bestScore || 0), result.score), lastScore: result.score, errorCount: Number(previous?.errorCount || 0) + result.errors, lastAnswer: result.answer, lastPracticedAt: now() });
      const progress = getUserProgress(); progress.daily.tasks.listening = true; progress.skills.listening = Math.max(Number(progress.skills.listening || 0), Math.round(result.score * .85)); saveUserProgress(progress);
      MasteryService.updateLesson(`dictation:${item.id}`, result.score, { kind: 'dictation' });
      if (result.score < 100) global.ErrorNotebookService?.add?.({ type: 'listening', question: 'Nghe và gõ chính tả', mistake: result.answer, correction: item.text, explanation: `Dictation ${result.score}% · ${result.errors} ký tự cần sửa.` });
      return saved;
    },
    summary() {
      const reading = this.all().filter((item) => item.kind === 'reading' && item.completed);
      const speeds = reading.map((item) => Number(item.lastWpm || 0)).filter(Boolean);
      return { completed: reading.length, averageWpm: speeds.length ? Math.round(speeds.reduce((sum, value) => sum + value, 0) / speeds.length) : 0, newWords: new Set(reading.flatMap((item) => item.newWords || [])).size, errors: reading.reduce((sum, item) => sum + Number(item.errorCount || 0), 0) };
    }
  };

  const DictationEvaluationService = {
    compare(expected, answer) {
      const target = [...compact(expected)]; const typed = [...compact(answer)];
      const rows = target.length + 1; const columns = typed.length + 1;
      const table = Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => row ? (column ? 0 : row) : column));
      for (let row = 1; row < rows; row += 1) for (let column = 1; column < columns; column += 1) table[row][column] = target[row - 1] === typed[column - 1] ? table[row - 1][column - 1] : Math.min(table[row - 1][column - 1], table[row - 1][column], table[row][column - 1]) + 1;
      let row = target.length; let column = typed.length; const aligned = []; const extras = [];
      while (row > 0 || column > 0) {
        if (row > 0 && column > 0 && target[row - 1] === typed[column - 1]) { aligned.unshift({ expected: target[row - 1], actual: typed[column - 1], status: 'correct' }); row -= 1; column -= 1; }
        else if (row > 0 && column > 0 && table[row][column] === table[row - 1][column - 1] + 1) { aligned.unshift({ expected: target[row - 1], actual: typed[column - 1], status: 'wrong' }); row -= 1; column -= 1; }
        else if (row > 0 && table[row][column] === table[row - 1][column] + 1) { aligned.unshift({ expected: target[row - 1], actual: '', status: 'missing' }); row -= 1; }
        else { extras.unshift(typed[column - 1]); column -= 1; }
      }
      const distance = table[target.length][typed.length];
      return { expected, answer: String(answer || '').trim(), score: Math.max(0, Math.round((1 - distance / Math.max(1, target.length, typed.length)) * 100)), errors: distance, aligned, extras };
    }
  };

  function readingCatalogView() {
    const summary = ReadingProgressService.summary(); const filtered = data.readings.filter((item) => item.level === runtime.level);
    return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Đọc hiểu theo cấp độ</p><h1 class="headline">Reading Lab</h1><p class="subtle">Đọc ngay trong ngữ cảnh, chạm từ hoặc ngữ pháp để xem giải thích mà không rời bài.</p></section><section class="reading-summary section"><div><b>${summary.completed}</b><span>Bài đã đọc</span></div><div><b>${summary.averageWpm || '—'}</b><span>Từ/phút gần đây</span></div><div><b>${summary.newWords}</b><span>Từ mới đã gặp</span></div><div><b>${summary.errors}</b><span>Lỗi đọc hiểu</span></div></section><nav class="reading-level-tabs section" aria-label="Cấp độ đọc">${['Beginner','TOPIK 1','TOPIK 2+'].map((level) => `<button class="${runtime.level === level ? 'active' : ''}" data-reading-level="${escapeHtml(level)}"><b>${escapeHtml(level)}</b><small>${level === 'Beginner' ? 'Câu ngắn' : level === 'TOPIK 1' ? 'Đoạn văn ngắn' : 'Bài đọc dài'}</small></button>`).join('')}</nav><section class="reading-catalog section">${filtered.map((item) => { const saved = ReadingProgressService.get('reading', item.id); return `<article class="reading-card"><div><span>${escapeHtml(item.topic)}</span><em>${item.estimatedMinutes} phút</em></div><h2>${escapeHtml(item.title)}</h2><p lang="ko">${escapeHtml(readingText(item).replace(/\n/g, ' ')).slice(0, 105)}${readingText(item).length > 105 ? '…' : ''}</p><small>${readingWordCount(item)} từ${saved ? ` · ${saved.bestScore}% · ${saved.lastWpm} từ/phút` : ' · chưa đọc'}</small><button class="btn ${saved ? 'secondary' : 'primary'} full" data-reading-start="${item.id}">${saved ? 'Đọc lại' : 'Bắt đầu đọc'}</button></article>`; }).join('')}</section><section class="reading-tool-grid section"><button data-view="word-network"><span>◎</span><b>Word Relationship Map</b><small>Dạng biến đổi, từ liên quan, collocation</small></button><button data-view="collocation-trainer"><span>✓</span><b>Natural Combination</b><small>Luyện tổ hợp từ tự nhiên</small></button><button data-view="dictation-master"><span>⌨</span><b>Dictation Master</b><small>Nghe, gõ Hangul và sửa từng ký tự</small></button></section>`;
  }

  function renderSegments(item) {
    return item.segments.map((segment, index) => {
      const text = escapeHtml(segment.text).replace(/\n/g, '<br>');
      if (segment.word) return `<button class="reading-token word" data-reading-word="${escapeHtml(segment.word)}" data-segment-index="${index}">${text}</button>`;
      if (segment.grammar) return `<button class="reading-token grammar" data-reading-grammar="${escapeHtml(segment.grammar)}" data-segment-index="${index}">${text}</button>`;
      return text;
    }).join('');
  }

  function lookupPanel(item) {
    const lookup = runtime.activeLookup;
    if (!lookup) return `<aside class="reading-lookup empty"><span>Chạm vào từ được gạch chân hoặc điểm ngữ pháp được đánh dấu để xem giải thích tại đây.</span></aside>`;
    const segment = item.segments[lookup.index];
    if (lookup.type === 'grammar') return `<aside class="reading-lookup"><p class="eyebrow">Ngữ pháp trong câu</p><h2 lang="ko">${escapeHtml(segment.grammar)}</h2><p>${escapeHtml(segment.explanation)}</p>${global.KoreanContextService?.findGrammar?.(segment.grammar)?.koreanUsuallySay ? `<p class="reading-natural-note">💡 ${escapeHtml(global.KoreanContextService.findGrammar(segment.grammar).koreanUsuallySay)}</p>` : ''}<button class="text-link" data-reading-lookup-close>Đóng giải thích</button></aside>`;
    const entry = entryFor(segment.word); const network = networkFor(segment.word);
    return `<aside class="reading-lookup"><p class="eyebrow">Từ trong bài</p><div class="reading-lookup-title"><h2 lang="ko">${escapeHtml(segment.word)}</h2><button class="audio-btn" data-speak="${escapeHtml(segment.word)}">🔊</button></div><p>${escapeHtml(entry?.meanings?.vi || entry?.meaningVi || segment.meaning || 'Đang cập nhật nghĩa.')}</p><div class="reading-lookup-actions">${entry ? `<button class="btn primary" data-reading-add-srs="${escapeHtml(entry.id)}">+ Thêm vào SRS</button>` : ''}${network ? `<button class="btn secondary" data-reading-network="${escapeHtml(network.root)}">Mở Word Map</button>` : ''}</div><button class="text-link" data-reading-lookup-close>Đóng giải thích</button></aside>`;
  }

  function readingSessionView() {
    const item = data.readings.find((candidate) => candidate.id === runtime.selectedId) || data.readings[0]; const saved = ReadingProgressService.get('reading', item.id);
    return `<section class="section reading-session-heading"><button class="back-link" data-reading-exit>← Reading Lab</button><div><p class="eyebrow">${escapeHtml(item.level)} · ${escapeHtml(item.topic)}</p><h1 class="headline">${escapeHtml(item.title)}</h1></div><div><span>${readingWordCount(item)} từ</span><span>${item.estimatedMinutes} phút</span></div></section><section class="reading-workspace section"><article class="reading-passage" lang="ko">${renderSegments(item)}</article>${lookupPanel(item)}</section><section class="reading-legend section"><span><i class="word"></i> Chạm để xem nghĩa</span><span><i class="grammar"></i> Chạm để xem ngữ pháp</span></section><form id="readingCheckForm" class="reading-questions section">${item.questions.map((question, index) => `<fieldset><legend>Câu ${index + 1}</legend><h2>${escapeHtml(question.prompt)}</h2>${question.options.map((option, optionIndex) => `<label><input type="radio" name="${question.id}" value="${optionIndex}" required><span>${escapeHtml(option)}</span></label>`).join('')}</fieldset>`).join('')}<button class="btn primary full" type="submit">Hoàn thành bài đọc</button></form>${runtime.result ? `<section class="reading-result section"><strong>${runtime.result.score}%</strong><div><h2>${runtime.result.score >= 80 ? 'Đã hiểu bài đọc' : 'Hãy đọc lại các điểm đánh dấu'}</h2><p>${runtime.result.correct}/${item.questions.length} câu đúng · ${runtime.result.wpm} từ/phút · ${runtime.encounteredWords.length} từ mới đã mở</p>${saved ? `<small>Lần tốt nhất: ${saved.bestScore}%</small>` : ''}</div><button class="btn secondary" data-reading-next>Về danh sách</button></section>` : ''}`;
  }

  function wordMapView() {
    const network = networkFor(runtime.networkRoot) || data.wordNetworks[0];
    const nodes = (items, kind) => items.map((item) => `<button class="word-network-node ${kind}" data-speak="${escapeHtml(item.korean)}"><b lang="ko">${escapeHtml(item.korean)}</b><small>${escapeHtml(item.label || item.meaning)}</small></button>`).join('');
    return `<section class="section page-heading"><button class="back-link" data-view="reading-lab">← Reading Lab</button><p class="eyebrow">Mạng lưới từ vựng</p><h1 class="headline">Word Relationship Map</h1><p class="subtle">Đi từ từ gốc đến dạng biến đổi, từ cùng ngữ cảnh và tổ hợp tự nhiên.</p></section><nav class="word-network-tabs section">${data.wordNetworks.map((item) => `<button class="${item.id === network.id ? 'active' : ''}" data-network-root="${escapeHtml(item.root)}" lang="ko">${escapeHtml(item.root)}</button>`).join('')}</nav><section class="word-network-map section"><div class="word-network-branch"><h2>Dạng biến đổi</h2>${nodes(network.forms, 'form')}</div><article class="word-network-root"><button class="audio-btn" data-speak="${escapeHtml(network.root)}">🔊</button><small>Từ gốc</small><strong lang="ko">${escapeHtml(network.root)}</strong><span>${escapeHtml(network.meaning)}</span></article><div class="word-network-branch"><h2>Từ liên quan</h2>${nodes(network.related, 'related')}</div></section><section class="word-network-collocations section"><h2 class="section-title">Hay đi với</h2>${network.collocations.map((item) => `<div><b lang="ko">${escapeHtml(item.korean)}</b><span>${escapeHtml(item.meaning)}</span><button class="audio-btn" data-speak="${escapeHtml(item.korean)}">🔊</button></div>`).join('')}</section>`;
  }

  function collocationView() {
    const item = data.collocations[runtime.collocationIndex % data.collocations.length]; const progress = ReadingProgressService.get('collocation', item.id); const result = runtime.collocationResult;
    return `<section class="section page-heading"><button class="back-link" data-view="reading-lab">← Reading Lab</button><p class="eyebrow">Natural Combination Practice</p><h1 class="headline">Collocation Trainer</h1><p class="subtle">Chọn động từ thực sự đi với danh từ trong tiếng Hàn.</p></section><section class="collocation-trainer section"><div class="collocation-progress"><span>Câu ${runtime.collocationIndex + 1}/${data.collocations.length}</span><div class="bar"><i style="width:${Math.round((runtime.collocationIndex + (result ? 1 : 0)) / data.collocations.length * 100)}%"></i></div></div><div class="collocation-prompt" lang="ko"><b>${escapeHtml(item.prompt)}</b><span>${escapeHtml(item.particle)}</span><i>＋</i><strong>?</strong></div><div class="collocation-options">${item.choices.map((choice) => `<button data-collocation-answer="${escapeHtml(choice)}" ${result ? 'disabled' : ''}>${escapeHtml(choice)}</button>`).join('')}</div>${result ? `<div class="collocation-feedback ${result.correct ? 'correct' : 'wrong'}"><strong>${result.correct ? '✓ Tổ hợp tự nhiên' : '✗ Chưa tự nhiên'}</strong><b lang="ko">${escapeHtml(item.natural)}</b><p>${escapeHtml(item.explanation)}</p><button class="btn primary" data-collocation-next>${runtime.collocationIndex === data.collocations.length - 1 ? 'Làm lại từ đầu' : 'Câu tiếp theo'}</button></div>` : `<p class="subtle center">${progress ? `Đã luyện ${progress.attempts} lần · đúng ${progress.correctCount || 0}` : 'Chọn một đáp án để kiểm tra.'}</p>`}</section>`;
  }

  function dictationView() {
    const list = data.dictations.filter((item) => item.level === runtime.dictationLevel); const item = list[runtime.dictationIndex % list.length]; const result = runtime.dictationResult; const saved = ReadingProgressService.get('dictation', item.id);
    return `<section class="section page-heading"><button class="back-link" data-view="reading-lab">← Reading Lab</button><p class="eyebrow">Nghe và gõ Hangul</p><h1 class="headline">Dictation Master</h1><p class="subtle">Nghe câu, nhập lại bằng Hangul rồi đối chiếu từng ký tự.</p></section><nav class="dictation-level-tabs section">${['Beginner','TOPIK 1','TOPIK 2+'].map((level) => `<button class="${runtime.dictationLevel === level ? 'active' : ''}" data-dictation-level="${escapeHtml(level)}">${escapeHtml(level)}</button>`).join('')}</nav><section class="dictation-card section"><div class="dictation-audio"><button data-speak="${escapeHtml(item.text)}" aria-label="Phát câu chính tả">▶</button><div><b>Nghe câu ${runtime.dictationIndex + 1}/${list.length}</b><small>Phát lại bao nhiêu lần tùy ý · không hiện transcript trước khi chấm</small></div></div><form id="dictationForm"><label for="dictationAnswer">Nhập Hangul bạn nghe được</label><textarea id="dictationAnswer" name="answer" lang="ko" rows="3" required spellcheck="false" autocomplete="off" placeholder="여기에 입력하세요…">${escapeHtml(result?.answer || '')}</textarea><button class="btn primary full" type="submit">So sánh</button></form>${result ? `<section class="dictation-feedback"><div class="dictation-score"><strong>${result.score}</strong><span>/100</span></div><div><small>Câu chuẩn</small><p class="dictation-character-line" lang="ko">${result.aligned.map((character) => `<mark class="${character.status}" title="${character.actual ? `Bạn nhập: ${escapeHtml(character.actual)}` : 'Thiếu ký tự'}">${escapeHtml(character.expected)}</mark>`).join('')}${result.extras.length ? `<mark class="extra">+${escapeHtml(result.extras.join(''))}</mark>` : ''}</p><p>${escapeHtml(item.meaning)}</p><small>${result.errors ? `${result.errors} ký tự cần sửa` : 'Chính xác hoàn toàn'}${saved ? ` · tốt nhất ${Math.max(saved.bestScore || 0, result.score)}%` : ''}</small></div><button class="btn secondary" data-dictation-next>Câu tiếp theo</button></section>` : ''}</section>`;
  }

  function entryCard() { return `<button class="learning-directory-item" data-open-reading-lab><span>문</span><div><b>Reading Lab</b><small>Đọc nội tuyến, Word Map và Dictation</small></div><i>›</i></button>`; }
  function dictionaryNetworkPreview(network) { return `<section class="reading-word-network-preview"><div><p class="eyebrow">Word Relationship Map</p><h3>Dạng biến đổi và tổ hợp của <span lang="ko">${escapeHtml(network.root)}</span></h3></div><div>${network.forms.slice(0, 3).map((item) => `<span lang="ko">${escapeHtml(item.korean)}</span>`).join('')}</div><button class="btn secondary" data-reading-network="${escapeHtml(network.root)}">Xem Word Map</button></section>`; }

  function startReading(id) { runtime.selectedId = id; runtime.startedAt = Date.now(); runtime.activeLookup = null; runtime.encounteredWords = []; runtime.result = null; setView('reading-session'); }
  function submitReading(form) {
    const item = data.readings.find((candidate) => candidate.id === runtime.selectedId); if (!item) return;
    const values = new FormData(form); let correct = 0; const wrong = [];
    item.questions.forEach((question) => { const chosen = Number(values.get(question.id)); if (chosen === question.answer) correct += 1; else wrong.push({ prompt: question.prompt, selected: question.options[chosen] || 'Không trả lời', correct: question.options[question.answer] }); });
    const score = Math.round(correct / Math.max(1, item.questions.length) * 100); const durationSeconds = Math.max(10, Math.round((Date.now() - Number(runtime.startedAt || Date.now())) / 1000));
    const saved = ReadingProgressService.recordReading(item, { score, durationSeconds, newWords: runtime.encounteredWords, wrongQuestions: wrong });
    runtime.result = { correct, score, wpm: saved.lastWpm }; render();
  }

  global.ReadingProgressService = ReadingProgressService;
  global.DictationEvaluationService = DictationEvaluationService;
  global.ReadingExpansionService = { readings: () => data.readings, wordNetworks: () => data.wordNetworks, collocations: () => data.collocations, dictations: () => data.dictations, startReading };
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'reading-lab': readingCatalogView, 'reading-session': readingSessionView, 'word-network': wordMapView, 'collocation-trainer': collocationView, 'dictation-master': dictationView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (state.currentView === 'lessons') { const directory = document.querySelector('.learning-directory'); if (directory && !directory.querySelector('[data-open-reading-lab]')) directory.insertAdjacentHTML('beforeend', entryCard()); }
    if (state.currentView === 'skill-hub' && state.selectedSkillHub === 'reading' && !document.querySelector('[data-open-reading-lab]')) document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', `<section class="card section reading-skill-entry"><div><p class="eyebrow">Reading Experience</p><h2 class="section-title">Đọc và tra ngay trong bài</h2></div><button class="btn primary" data-open-reading-lab>Mở Reading Lab</button></section>`);
    if (state.currentView === 'dictionary' && state.dictionarySelectedId) { const entry = DictionaryService.byId(state.dictionarySelectedId); const network = networkFor(entry?.korean); const detail = document.querySelector('.dictionary-entry'); if (network && detail && !detail.querySelector('.reading-word-network-preview')) detail.insertAdjacentHTML('beforeend', dictionaryNetworkPreview(network)); }

    document.querySelectorAll('[data-open-reading-lab]').forEach((button) => { button.onclick = () => setView('reading-lab'); });
    document.querySelectorAll('[data-reading-level]').forEach((button) => { button.onclick = () => { runtime.level = button.dataset.readingLevel; render(); }; });
    document.querySelectorAll('[data-reading-start]').forEach((button) => { button.onclick = () => startReading(button.dataset.readingStart); });
    document.querySelector('[data-reading-exit]')?.addEventListener('click', () => { runtime.result = null; runtime.activeLookup = null; setView('reading-lab'); });
    document.querySelectorAll('[data-reading-word]').forEach((button) => { button.onclick = () => { const word = button.dataset.readingWord; runtime.encounteredWords = [...new Set([...runtime.encounteredWords, word])]; runtime.activeLookup = { type: 'word', index: Number(button.dataset.segmentIndex) }; render(); }; });
    document.querySelectorAll('[data-reading-grammar]').forEach((button) => { button.onclick = () => { runtime.activeLookup = { type: 'grammar', index: Number(button.dataset.segmentIndex) }; render(); }; });
    document.querySelector('[data-reading-lookup-close]')?.addEventListener('click', () => { runtime.activeLookup = null; render(); });
    document.querySelectorAll('[data-reading-add-srs]').forEach((button) => { button.onclick = () => { DictionaryService.addToSrs(DictionaryService.byId(button.dataset.readingAddSrs)); toast('Đã thêm từ vào SRS.'); }; });
    document.querySelectorAll('[data-reading-network]').forEach((button) => { button.onclick = () => { runtime.networkRoot = button.dataset.readingNetwork; setView('word-network'); }; });
    const readingForm = document.getElementById('readingCheckForm'); if (readingForm) readingForm.onsubmit = (event) => { event.preventDefault(); submitReading(readingForm); };
    document.querySelector('[data-reading-next]')?.addEventListener('click', () => { runtime.result = null; runtime.activeLookup = null; setView('reading-lab'); });
    document.querySelectorAll('[data-network-root]').forEach((button) => { button.onclick = () => { runtime.networkRoot = button.dataset.networkRoot; render(); }; });
    document.querySelectorAll('[data-collocation-answer]').forEach((button) => { button.onclick = () => { const item = data.collocations[runtime.collocationIndex % data.collocations.length]; const selected = button.dataset.collocationAnswer; const correct = selected === item.answer; ReadingProgressService.recordCollocation(item, correct, selected); runtime.collocationResult = { correct, selected }; render(); }; });
    document.querySelector('[data-collocation-next]')?.addEventListener('click', () => { runtime.collocationIndex = (runtime.collocationIndex + 1) % data.collocations.length; runtime.collocationResult = null; render(); });
    document.querySelectorAll('[data-dictation-level]').forEach((button) => { button.onclick = () => { runtime.dictationLevel = button.dataset.dictationLevel; runtime.dictationIndex = 0; runtime.dictationResult = null; render(); }; });
    const dictationForm = document.getElementById('dictationForm'); if (dictationForm) dictationForm.onsubmit = (event) => { event.preventDefault(); const list = data.dictations.filter((item) => item.level === runtime.dictationLevel); const item = list[runtime.dictationIndex % list.length]; const answer = String(new FormData(dictationForm).get('answer') || '').trim(); if (!answer) return toast('Hãy nhập câu Hangul bạn nghe được.'); runtime.dictationResult = DictationEvaluationService.compare(item.text, answer); ReadingProgressService.recordDictation(item, runtime.dictationResult); render(); };
    document.querySelector('[data-dictation-next]')?.addEventListener('click', () => { const count = data.dictations.filter((item) => item.level === runtime.dictationLevel).length; runtime.dictationIndex = (runtime.dictationIndex + 1) % count; runtime.dictationResult = null; render(); });
  };
  render();
})(window);
