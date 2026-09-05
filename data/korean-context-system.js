/* Tiếng Hàn - TamHoanq — Korean context and natural language experience */
(function buildKoreanContextSystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  const data = global.KLEARN_KOREAN_CONTEXT;
  if (!app || !data) return;
  const { state, render, setView, escapeHtml, speakKorean } = app;
  const runtime = state.koreanContext || (state.koreanContext = { register: 'all', query: '', focusId: '' });

  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
  const flatten = (value) => {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) return value.flatMap(flatten);
    if (typeof value === 'object') return Object.values(value).flatMap(flatten);
    return [String(value)];
  };
  const includesQuery = (record, query) => {
    const q = normalize(query);
    return Boolean(q) && flatten(record).some((value) => normalize(value).includes(q));
  };

  const KoreanContextService = {
    vocabulary() { return data.vocabulary || []; },
    grammar() { return data.grammar || []; },
    naturalExpressions() { return data.naturalExpressions || []; },
    formalityLevels() { return data.formalityLevels || []; },
    findVocabulary(value) {
      const source = typeof value === 'object' ? value : { id: value, korean: value };
      return this.vocabulary().find((item) => item.korean === source?.korean || item.id === source?.id) || (!source?.korean && source?.topic ? this.vocabulary().find((item) => item.topic === source.topic) : null) || null;
    },
    findGrammar(value) {
      const source = typeof value === 'object' ? value : { id: value, expression: value };
      return this.grammar().find((item) => item.id === source?.id || item.expression === source?.expression) || null;
    },
    findGrammarForLesson(lesson) {
      if (!lesson) return null;
      const lessonText = normalize(`${lesson.id || ''} ${lesson.title || ''} ${lesson.topic || ''}`);
      return this.grammar().find((item) => (item.lessonTopics || []).some((topic) => lessonText.includes(normalize(topic)))) || null;
    },
    findNatural(id) { return this.naturalExpressions().find((item) => item.id === id) || null; },
    search(query) {
      if (!normalize(query)) return [];
      const vocabulary = this.vocabulary().filter((item) => includesQuery(item, query)).map((item) => ({ id: item.id, type: 'vocabulary', title: item.korean, korean: item.korean, summary: `${item.meaningVi} · ${(item.collocations || []).map((usage) => usage.korean).slice(0, 2).join(' · ')} · ${item.koreanUsuallySay}` }));
      const grammar = this.grammar().filter((item) => includesQuery(item, query)).map((item) => ({ id: item.id, type: 'grammar', title: item.expression, korean: item.expression, summary: `${item.title} · ${item.koreanUsuallySay}` }));
      const natural = this.naturalExpressions().filter((item) => includesQuery(item, query)).map((item) => ({ id: item.id, type: 'natural', title: `${item.textbook} → ${item.natural}`, korean: item.natural, summary: `${item.situation} · ${item.note}` }));
      const formality = this.formalityLevels().filter((item) => includesQuery(item, query)).map((item) => ({ id: item.id, type: 'formality', title: item.korean, korean: item.example, summary: `${item.label} · ${item.use}` }));
      return [...vocabulary, ...grammar, ...natural, ...formality].slice(0, 24);
    }
  };

  const list = (items, className = '') => items?.length ? `<ul class="${className}">${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : '';
  const usagePairs = (items = []) => items.map((item) => `<div class="context-usage-row"><b lang="ko">${escapeHtml(item.korean)}</b><span>${escapeHtml(item.meaning)}</span><button class="audio-btn" data-speak="${escapeHtml(item.korean)}" aria-label="Nghe ${escapeHtml(item.korean)}">🔊</button></div>`).join('');

  function vocabularyContextCard(note) {
    if (!note) return '';
    return `<aside class="korean-context-note" data-context-note="${escapeHtml(note.id)}"><div class="context-note-heading"><div><p class="eyebrow">💡 Người Hàn thường dùng</p><h3>${escapeHtml(note.koreanUsuallySay)}</h3></div><span class="context-register">${escapeHtml(note.politeness)}</span></div><div class="context-note-grid"><section><b>Khi nào dùng</b>${list(note.whenUsed)}</section><section><b>Ai thường dùng</b>${list(note.whoUses)}</section></div>${note.collocations?.length ? `<section class="context-collocations"><b>Hay đi với</b>${usagePairs(note.collocations)}</section>` : ''}${note.avoid?.length || note.invalidUsage?.length ? `<section class="context-caution"><b>Không nên dùng như vậy</b>${list(note.avoid)}${note.invalidUsage.map((item) => `<div><del lang="ko">${escapeHtml(item.korean)}</del><span>${escapeHtml(item.reason)}</span></div>`).join('')}</section>` : ''}</aside>`;
  }

  function grammarContextCard(note) {
    if (!note) return '';
    return `<aside class="korean-context-note grammar-context-note" data-context-note="${escapeHtml(note.id)}"><div class="context-note-heading"><div><p class="eyebrow">💡 Dùng trong đời thật</p><h3><span lang="ko">${escapeHtml(note.expression)}</span> · ${escapeHtml(note.title)}</h3></div><span class="context-register">${escapeHtml(note.politeness)}</span></div><div class="context-note-grid"><section><b>Khi nào dùng</b>${list(note.whenUsed)}</section><section><b>Tình huống phù hợp</b>${list(note.situations)}</section></div>${usagePairs(note.examples)}<p class="context-usually"><b>Người Hàn thường:</b> ${escapeHtml(note.koreanUsuallySay)}</p></aside>`;
  }

  function formalityView() {
    return `<section class="formality-section section"><div class="section-heading"><div><p class="eyebrow">Chọn cách nói theo quan hệ</p><h2 class="section-title">Mức độ lịch sự</h2></div><span class="context-register">존댓말 → 해요체 → 반말</span></div><p class="formality-explanation"><b>해요체 vẫn là một dạng 존댓말.</b> Khi cần trang trọng hơn, dùng 합니다체; chỉ chuyển sang 반말 khi quan hệ cho phép.</p><div class="formality-ladder">${KoreanContextService.formalityLevels().map((level, index) => `<article><span>${index + 1}</span><div><small>${escapeHtml(level.group)}</small><h3 lang="ko">${escapeHtml(level.korean)}</h3><b>${escapeHtml(level.label)}</b><p>${escapeHtml(level.use)}</p></div><div class="formality-example"><span lang="ko">${escapeHtml(level.example)}</span><button class="audio-btn" data-speak="${escapeHtml(level.example)}">🔊</button></div></article>`).join('')}</div></section>`;
  }

  function naturalCard(item) {
    const focused = runtime.focusId === item.id ? ' focused' : '';
    return `<article class="natural-expression-card${focused}" id="${escapeHtml(item.id)}"><header><span>${escapeHtml(item.situation)}</span><em>${escapeHtml(item.politeness)}</em></header><div class="expression-compare"><div><small>Trong giáo trình</small><b lang="ko">${escapeHtml(item.textbook)}</b><button class="audio-btn" data-speak="${escapeHtml(item.textbook)}">🔊</button></div><i aria-hidden="true">→</i><div><small>Trong hội thoại</small><b lang="ko">${escapeHtml(item.natural)}</b><button class="audio-btn" data-speak="${escapeHtml(item.natural)}">🔊</button></div></div><p>💡 ${escapeHtml(item.note)}</p>${item.close && item.close !== item.natural ? `<small class="close-friend-example">Với bạn thân: <b lang="ko">${escapeHtml(item.close)}</b></small>` : ''}</article>`;
  }

  function naturalKoreanView() {
    const query = normalize(runtime.query);
    const expressions = KoreanContextService.naturalExpressions().filter((item) => (runtime.register === 'all' || item.register === runtime.register) && (!query || includesQuery(item, query)));
    return `<section class="section page-heading natural-korean-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Ngữ cảnh & sắc thái</p><h1 class="headline">Tiếng Hàn đời thường</h1><p class="subtle">Hiểu người Hàn nói câu nào, với ai và trong tình huống nào — không chỉ học một bản dịch.</p></section>${formalityView()}<section class="natural-toolbar section"><form id="naturalContextForm"><label><span>Tìm cách nói</span><input id="naturalContextSearch" name="query" type="search" value="${escapeHtml(runtime.query)}" placeholder="감사합니다, công việc, bạn thân…"></label><button class="btn secondary" type="submit">Lọc</button></form><nav aria-label="Lọc mức độ">${[['all','Tất cả'],['해요체','Lịch sự'],['반말','Thân mật']].map(([value, label]) => `<button class="${runtime.register === value ? 'active' : ''}" data-context-register="${value}">${label}</button>`).join('')}</nav></section><section class="natural-expression-grid section">${expressions.map(naturalCard).join('') || '<div class="empty-state compact-empty"><h2>Chưa có cách nói phù hợp</h2><p>Thử từ khóa hoặc mức độ khác.</p></div>'}</section><section class="context-principle section"><b>Quy tắc an toàn</b><p>Khi chưa chắc về quan hệ, hãy bắt đầu bằng 해요체. Cách nói ngắn hơn không phải lúc nào cũng tự nhiên hơn nếu sai mức độ lịch sự.</p></section>`;
  }

  function learningEntry() {
    return `<button class="learning-directory-item" data-open-natural-korean><span>💡</span><div><b>Tiếng Hàn đời thường</b><small>Ngữ cảnh, sắc thái và mức độ lịch sự</small></div><i>›</i></button>`;
  }

  function openSearchResult(item) {
    runtime.focusId = item.id;
    if (item.type === 'vocabulary') {
      const entry = (global.KLEARN_DICTIONARY || []).find((candidate) => candidate.korean === item.korean);
      if (entry) { state.dictionarySelectedId = entry.id; return setView('dictionary'); }
    }
    runtime.query = '';
    runtime.register = 'all';
    setView('natural-korean');
  }

  global.KoreanContextService = KoreanContextService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'natural-korean': naturalKoreanView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;

    if (state.currentView === 'lessons') {
      const directory = document.querySelector('.learning-directory');
      if (directory && !directory.querySelector('[data-open-natural-korean]')) directory.insertAdjacentHTML('beforeend', learningEntry());
    }

    if (state.currentView === 'dictionary' && state.dictionarySelectedId) {
      const entry = (global.KLEARN_DICTIONARY || []).find((item) => item.id === state.dictionarySelectedId);
      const note = KoreanContextService.findVocabulary(entry);
      const detail = document.querySelector('.dictionary-entry');
      if (detail && note && !detail.querySelector('[data-context-note]')) detail.insertAdjacentHTML('beforeend', vocabularyContextCard(note));
    }

    if (state.currentView === 'lesson' && Number(state.lessonStep || 0) === 2) {
      const lesson = global.CurriculumService?.lesson?.(state.selectedLessonPreview) || (global.KLEARN_THEORY_LESSONS || []).find((item) => item.id === state.selectedLessonPreview);
      const note = KoreanContextService.findGrammarForLesson(lesson);
      const card = document.querySelector('.lesson-step-card');
      if (card && note && !card.querySelector('[data-context-note]')) card.insertAdjacentHTML('beforeend', grammarContextCard(note));
    }

    document.querySelector('[data-open-natural-korean]')?.addEventListener('click', () => { runtime.focusId = ''; setView('natural-korean'); });
    document.querySelectorAll('[data-context-register]').forEach((button) => { button.onclick = () => { runtime.register = button.dataset.contextRegister; runtime.focusId = ''; render(); }; });
    const naturalContextForm = document.getElementById('naturalContextForm');
    if (naturalContextForm) naturalContextForm.onsubmit = (event) => { event.preventDefault(); runtime.query = String(new FormData(naturalContextForm).get('query') || '').trim(); runtime.focusId = ''; render(); };
    document.querySelectorAll('[data-context-result]').forEach((button) => { button.onclick = () => { const item = KoreanContextService.search(state.globalQuery).find((candidate) => candidate.id === button.dataset.contextResult); if (item) openSearchResult(item); }; });
    document.querySelectorAll('[data-context-note] [data-speak]').forEach((button) => { button.onclick = (event) => { event.stopPropagation(); speakKorean?.(button.dataset.speak); }; });

    if (state.currentView === 'natural-korean' && runtime.focusId) document.getElementById(runtime.focusId)?.scrollIntoView?.({ block: 'center' });
  };
  render();
})(window);
