/* Tiếng Hàn - TamHoanq · P66 Vietnamese-first content quality lab. */
(function buildContentCompetitiveUpgrade(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, normalizeSearch, userScoped, saveUserScoped, speakKorean } = app;
  const VIEW = 'vietnamese-korean-core';
  const SECTIONS = Object.freeze([
    ['foundation', 'Hangul Zero'],
    ['contrast', 'Hàn ↔ Việt'],
    ['sentences', 'Câu tự nhiên'],
    ['listening', 'Nghe thực tế'],
    ['topik', 'TOPIK minh bạch'],
    ['survival', 'Sinh tồn'],
    ['culture', 'Văn hóa'],
    ['story', 'Học qua truyện'],
    ['quality', 'Chất lượng']
  ]);
  const runtime = state.competitiveContent || (state.competitiveContent = { content: null, loading: null, error: '', tab: 'foundation', selectedId: '' });
  const clean = (value, limit = 1200) => String(value || '').normalize('NFC').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, limit);
  const now = () => new Date().toISOString();
  const arrays = (data = runtime.content) => [
    ...(data?.hangulFoundation || []), ...(data?.vietnameseContrast || []), ...(data?.naturalSentences || []),
    ...(data?.listeningPacks || []), ...(data?.topikPractice || []), ...(data?.survivalCourses || []),
    ...(data?.cultureNotes || []), ...(data?.stories || [])
  ];
  const titleOf = (item) => item.title || item.korean || item.topic || item.content_id;
  const statusLabel = (status) => ({ APPROVED: 'Đã duyệt', NEEDS_REVIEW: 'Chờ người duyệt', INVALID: 'Không hợp lệ', MISSING_DATA: 'Thiếu dữ liệu' })[status] || status;

  const CompetitiveContentService = {
    hydrate(value) {
      if (Number(value?.schemaVersion) !== 1 || value?.reviewPolicy?.humanReviewRequired !== true || value?.reviewPolicy?.aiMayApprove !== false) throw new Error('P66 content governance gate failed');
      const records = arrays(value); const ids = records.map((item) => item.content_id); if (!records.length || ids.some((id) => !id) || new Set(ids).size !== ids.length) throw new Error('P66 content identity gate failed');
      if (records.some((item) => item.status === 'APPROVED' && !item.reviewEvidence?.humanReviewed)) throw new Error('P66 human-review gate failed');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/vietnamese-korean-core.json', { cache: 'default' })
        .then((response) => { if (!response.ok) throw new Error(`Content ${response.status}`); return response.json(); })
        .then((value) => this.hydrate(value))
        .catch((error) => { runtime.error = error.message || 'Content unavailable'; return null; })
        .finally(() => { runtime.loading = null; if (state.currentView === VIEW) render(); });
      return runtime.loading;
    },
    all() { return arrays(); },
    byId(id) { return this.all().find((item) => item.content_id === id) || null; },
    search(query) {
      const q = normalizeSearch(query); if (!q) return [];
      return this.all().filter((item) => normalizeSearch([item.content_id, item.type, item.level, item.topic, item.title, item.korean, item.vi, item.summary, item.usage, item.vietnameseContrast, item.context, item.transcript].join(' ')).includes(q));
    },
    progress() { return userScoped(STORAGE_KEYS.competitiveContentProgress); },
    complete(id) {
      const item = this.byId(id); if (!item) return false;
      const entry = { id, contentId: id, version: item.version, completedAt: now(), statusAtCompletion: item.status };
      saveUserScoped(STORAGE_KEYS.competitiveContentProgress, [entry, ...this.progress().filter((record) => record.contentId !== id)], 500); return true;
    },
    isComplete(id) { return this.progress().some((record) => record.contentId === id && record.completedAt); },
    audit() {
      const records = this.all(); const counts = records.reduce((out, item) => { out[item.status] = (out[item.status] || 0) + 1; return out; }, {});
      const scores = records.map((item) => Number(item.quality_score)).filter(Number.isFinite);
      return { total: records.length, counts, provisionalAverage: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, approved: counts.APPROVED || 0 };
    }
  };

  const CompetitiveContentIssueService = {
    all() { return userScoped(STORAGE_KEYS.contentFeedback).filter((item) => item.qualitySystem === 'P66'); },
    submit({ contentId, issueType, message }) {
      const item = CompetitiveContentService.byId(contentId); const detail = clean(message);
      const allowed = new Set((runtime.content?.issueTypes || []).map((type) => type.id));
      if (!item || !allowed.has(issueType) || !detail) throw new Error('Vui lòng chọn nội dung, loại vấn đề và mô tả cụ thể.');
      const entry = { id: `p66-issue-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, userId: state.currentUser?.id, contentId, contentType: item.type, qualitySystem: 'P66', category: issueType, message: detail, status: 'received', contentVersion: item.version, createdAt: now() };
      saveUserScoped(STORAGE_KEYS.contentFeedback, [entry, ...userScoped(STORAGE_KEYS.contentFeedback)], 200); return entry;
    }
  };

  function status(item) { return `<span class="p66-status ${String(item.status || '').toLowerCase()}">${escapeHtml(statusLabel(item.status))}</span><span class="p66-score" title="Điểm cấu trúc tạm thời, chưa phải chứng nhận ngôn ngữ">${Number(item.quality_score) || '—'}/100 tạm tính</span>`; }
  function completeButton(item) { const done = CompetitiveContentService.isComplete(item.content_id); return `<button class="btn ${done ? 'secondary' : 'primary'}" data-p66-complete="${escapeHtml(item.content_id)}">${done ? '✓ Đã học' : 'Đánh dấu đã học'}</button>`; }
  function speakButton(text, rate = 1) { return text ? `<button class="p66-speak" data-p66-speak="${escapeHtml(text)}" data-p66-rate="${rate}">🔊 Nghe</button>` : ''; }
  function card(item, body) { return `<article class="p66-card" data-p66-content="${escapeHtml(item.content_id)}"><header><div><small>${escapeHtml(item.level)} · ${escapeHtml(item.topic)}</small><h2>${escapeHtml(titleOf(item))}</h2></div><div>${status(item)}</div></header>${body}<footer>${completeButton(item)}<button class="text-link" data-p66-report="${escapeHtml(item.content_id)}">Báo vấn đề</button></footer></article>`; }
  function list(values) { return `<ul>${(values || []).map((value) => `<li>${escapeHtml(typeof value === 'string' ? value : value.korean || value.hint || JSON.stringify(value))}</li>`).join('')}</ul>`; }

  function foundationView() {
    return (runtime.content.hangulFoundation || []).map((item) => card(item, `<p>${escapeHtml(item.summary || item.vietnamesePitfall || '')}</p>${item.demonstration ? `<div class="p66-build"><strong lang="ko">${escapeHtml(item.demonstration.result)}</strong><span>${item.demonstration.parts.map(escapeHtml).join(' + ')}</span><p>${escapeHtml(item.demonstration.explanation)}</p></div>` : ''}${item.items ? `<div class="p66-token-grid">${item.items.map((entry) => `<button data-p66-speak="${escapeHtml(entry.korean)}"><b lang="ko">${escapeHtml(entry.korean)}</b><span>${escapeHtml(entry.hint || entry.meaning || '')}</span><small>${escapeHtml(entry.example || '')}</small></button>`).join('')}</div>` : ''}${item.contrasts ? `<div class="p66-contrast-list">${item.contrasts.map((entry) => `<section><b>${escapeHtml(entry.group)}</b>${list(entry.items)}<p>${escapeHtml(entry.vietnamesePitfall)}</p></section>`).join('')}</div>` : ''}${item.strokeOrder ? `<ol>${item.strokeOrder.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><button class="btn secondary" data-view="handwriting">Mở luyện viết hiện có →</button>` : ''}${item.examples ? `<div class="p66-examples">${item.examples.map((entry) => `<p><b lang="ko">${escapeHtml(entry.korean)}</b><span>${escapeHtml(entry.parts.join(' + '))}</span><small>${escapeHtml(entry.note)}</small></p>`).join('')}</div>` : ''}`)).join('');
  }
  function contrastView() {
    return (runtime.content.vietnameseContrast || []).map((item) => card(item, `<div class="p66-contrast"><section><h3>Khi dùng</h3><p>${escapeHtml(item.usage)}</p><h3>So với tiếng Việt</h3><p>${escapeHtml(item.vietnameseContrast)}</p></section><section><h3>Ví dụ đúng</h3><p lang="ko" class="correct">${escapeHtml(item.correctExample.korean)}</p><small>${escapeHtml(item.correctExample.vi)}</small><h3>Ví dụ cần sửa</h3><p lang="ko" class="wrong">${escapeHtml(item.incorrectExample.korean)}</p><small>${escapeHtml(item.incorrectExample.reason)}</small></section></div><details><summary>Bài sửa lỗi</summary><p>${escapeHtml(item.repairExercise.prompt)}</p><b>${escapeHtml(item.repairExercise.answer)}</b><small>${escapeHtml(item.repairExercise.explanation)}</small></details>`)).join('');
  }
  function sentenceView() {
    const groups = Object.groupBy ? Object.groupBy(runtime.content.naturalSentences || [], (item) => item.topic) : (runtime.content.naturalSentences || []).reduce((out, item) => { (out[item.topic] ||= []).push(item); return out; }, {});
    return Object.entries(groups).map(([topic, items]) => `<article class="p66-card"><header><div><small>FORMAL · DAILY · CASUAL · CHAT</small><h2>${escapeHtml(topic)}</h2></div></header><div class="p66-registers">${items.map((item) => `<section><span>${escapeHtml(item.register)} · ${escapeHtml(item.context)}</span><b lang="ko">${escapeHtml(item.korean)}</b><p>${escapeHtml(item.vi)}</p>${speakButton(item.korean)}${status(item)}${completeButton(item)}</section>`).join('')}</div></article>`).join('');
  }
  function listeningView() {
    return (runtime.content.listeningPacks || []).map((item) => card(item, `<div class="p66-audio-disclosure">TTS · ${escapeHtml(item.audio.voice)}<br>${escapeHtml(item.audio.disclosure)}</div><div class="p66-speed">${item.audio.speedOptions.map((speed) => `<button data-p66-speak="${escapeHtml(item.transcript)}" data-p66-rate="${speed.rate}">${escapeHtml(speed.id)} · ${speed.rate}×</button>`).join('')}</div><details><summary>Transcript</summary><p lang="ko">${escapeHtml(item.transcript)}</p></details><div class="p66-columns"><section><h3>Từ vựng</h3>${list(item.vocabulary)}</section><section><h3>Ngữ pháp</h3>${list(item.grammar)}</section></div><div class="p66-question"><b>${escapeHtml(item.question.prompt)}</b>${list(item.question.options)}<small>${escapeHtml(item.explanation)}</small></div>`)).join('');
  }
  function topikView() {
    return `<div class="p66-trust-banner"><b>Minh bạch nguồn TOPIK</b><p>Không nội dung nào dưới đây được gọi là “đề thi thật”. Mỗi câu ghi rõ nguồn và trạng thái xác minh.</p></div>${(runtime.content.topikPractice || []).map((item) => card(item, `<div class="p66-source"><b>${escapeHtml(item.source_type)}</b><span>Official verified: ${item.official_verified ? 'YES' : 'NO'}</span><span>${escapeHtml(item.skill)} · ${escapeHtml(item.difficulty)}</span></div><p lang="ko" class="p66-prompt">${escapeHtml(item.prompt)}</p>${list(item.options)}<details><summary>Đáp án và giải thích</summary><b>${escapeHtml(item.options[item.answer])}</b><p>${escapeHtml(item.explanation)}</p></details>`)).join('')}`;
  }
  function survivalView() { return (runtime.content.survivalCourses || []).map((item) => card(item, `<p>${escapeHtml(item.context)}</p><div class="p66-phrases">${item.phrases.map((phrase) => `<p><b lang="ko">${escapeHtml(phrase)}</b>${speakButton(phrase)}</p>`).join('')}</div><div class="p66-practice"><b>Luyện tập</b><span>${escapeHtml(item.practice)}</span></div>`)).join(''); }
  function cultureView() { return (runtime.content.cultureNotes || []).map((item) => card(item, `<p>${escapeHtml(item.note)}</p><div class="p66-do-dont"><p><b>✓ Nên</b>${escapeHtml(item.do)}</p><p><b>△ Tránh mặc định</b>${escapeHtml(item.avoid)}</p></div>`)).join(''); }
  function storyView() { return (runtime.content.stories || []).map((item) => card(item, `<div class="p66-story">${item.chapters.map((chapter, index) => `<section><span>Chương ${index + 1}</span><h3>${escapeHtml(chapter.title)}</h3>${chapter.dialogue.map((line) => `<p><small>${escapeHtml(line.speaker)}</small><b lang="ko">${escapeHtml(line.korean)}</b><em>${escapeHtml(line.vi)}</em>${speakButton(line.korean)}</p>`).join('')}<details><summary>Từ vựng · ngữ pháp · quiz</summary>${list([...chapter.vocabulary, ...chapter.grammar])}<b>${escapeHtml(chapter.quiz.prompt)}</b><small>${escapeHtml(chapter.quiz.answer)}</small></details></section>`).join('')}</div>`)).join(''); }
  function qualityView() {
    const audit = CompetitiveContentService.audit(); const sources = runtime.content.sources || [];
    return `<section class="p66-quality-overview"><article><small>Tổng nội dung kiểm soát</small><b>${audit.total}</b></article><article><small>Đã được người duyệt</small><b>${audit.approved}</b></article><article><small>Điểm cấu trúc tạm tính</small><b>${audit.provisionalAverage ?? '—'}</b></article><article><small>Vấn đề bạn đã báo</small><b>${CompetitiveContentIssueService.all().length}</b></article></section><section class="p66-governance p66-card"><h2>Draft → AI Check → Human Review → Approve → Publish</h2><p>${escapeHtml(runtime.content.reviewPolicy.disclosure)}</p><div>${Object.entries(audit.counts).map(([key, value]) => `<span><b>${value}</b>${escapeHtml(statusLabel(key))}</span>`).join('')}</div><h3>Thang điểm chất lượng</h3>${list(runtime.content.qualityDimensions.map((item) => ({ korean: item })))}<p class="p66-audio-disclosure">Mọi audio trong gói hiện dùng browser TTS và được ghi đúng là TTS. Không có asset nào được gắn nhãn Native.</p></section><section class="p66-card"><h2>Nguồn đối chiếu</h2>${sources.map((source) => `<p><a href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(source.name)}</a><small>${escapeHtml(source.use)}</small></p>`).join('')}</section>`;
  }
  const views = { foundation: foundationView, contrast: contrastView, sentences: sentenceView, listening: listeningView, topik: topikView, survival: survivalView, culture: cultureView, story: storyView, quality: qualityView };
  function reportDialog() {
    const item = CompetitiveContentService.byId(runtime.selectedId); if (!item) return '';
    return `<div class="p66-modal" role="dialog" aria-modal="true" aria-labelledby="p66ReportTitle"><form data-p66-report-form><button type="button" class="p66-close" data-p66-close aria-label="Đóng">×</button><h2 id="p66ReportTitle">Báo vấn đề nội dung</h2><p>${escapeHtml(titleOf(item))} · v${escapeHtml(item.version)}</p><select name="issueType" required>${(runtime.content.issueTypes || []).map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.label)}</option>`).join('')}</select><textarea name="message" maxlength="1200" required placeholder="Mô tả điều khó hiểu hoặc có thể sai…"></textarea><button class="btn primary">Gửi cho đội nội dung</button></form></div>`;
  }
  function pageView() {
    if (!runtime.content) { CompetitiveContentService.load(); return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">P66 · CONTENT QUALITY LAB</p><h1 class="headline">${runtime.error ? 'Không tải được nội dung' : 'Đang tải nội dung…'}</h1><p class="subtle">${escapeHtml(runtime.error || 'Kiểm tra schema và human-review gate.')}</p></section>`; }
    const selected = SECTIONS.some(([id]) => id === runtime.tab) ? runtime.tab : 'foundation';
    return `<section class="section page-heading p66-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">P66 · VIETNAMESE-FIRST CONTENT</p><h1 class="headline">Nền tảng tiếng Hàn cho người Việt</h1><p class="subtle">Tập trung giải thích rõ, ngữ cảnh thật và nguồn minh bạch. Đây là content lab: nội dung mới đang chờ người duyệt chuyên môn.</p><div class="p66-review-notice"><b>Human review required</b><span>Không nội dung nào được tự động Approved bởi AI.</span></div></section><nav class="p66-tabs section" aria-label="Nội dung P66">${SECTIONS.map(([id, label]) => `<button class="${selected === id ? 'active' : ''}" data-p66-tab="${id}" aria-current="${selected === id ? 'page' : 'false'}">${escapeHtml(label)}</button>`).join('')}</nav><main class="p66-content section">${views[selected]()}</main>${reportDialog()}`;
  }

  Object.assign(global, { CompetitiveContentService, CompetitiveContentIssueService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), [VIEW]: pageView };
  if (global.GlobalSearchService && !global.GlobalSearchService.__p66Wrapped) {
    const original = global.GlobalSearchService.search.bind(global.GlobalSearchService);
    global.GlobalSearchService.search = (query = '') => {
      const result = original(query); const matches = CompetitiveContentService.search(query);
      if (matches.length || /(hangul|tiếng hàn cho người việt|contrast|đối chiếu|survival|sinh tồn|culture|văn hóa)/i.test(String(query))) result.studyTools = [{ id: VIEW, view: VIEW, title: 'Nền tảng tiếng Hàn cho người Việt', description: `${matches.length} kết quả trong content lab · chờ human review` }, ...(result.studyTools || [])];
      return result;
    };
    global.GlobalSearchService.__p66Wrapped = true;
  }
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (state.currentView === 'lessons' && !global.document.querySelector('[data-p66-entry]')) global.document.querySelector('.learning-directory')?.insertAdjacentHTML('afterbegin', `<button class="learning-directory-item p66-entry" data-p66-entry><span>한</span><div><b>Nền tảng cho người Việt</b><small>Hangul Zero · đối chiếu Việt–Hàn · nguồn minh bạch</small></div><i>›</i></button>`);
    global.document.querySelector('[data-p66-entry]')?.addEventListener('click', () => setView(VIEW), { once: true });
    if (state.currentView !== VIEW) return;
    global.document.querySelectorAll('[data-p66-tab]').forEach((button) => { button.onclick = () => { runtime.tab = button.dataset.p66Tab; runtime.selectedId = ''; render(); }; });
    global.document.querySelectorAll('[data-p66-speak]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.p66Speak, Number(button.dataset.p66Rate || 1)); });
    global.document.querySelectorAll('[data-p66-complete]').forEach((button) => { button.onclick = () => { CompetitiveContentService.complete(button.dataset.p66Complete); toast('Đã lưu tiến độ cho nội dung này.'); render(); }; });
    global.document.querySelectorAll('[data-p66-report]').forEach((button) => { button.onclick = () => { runtime.selectedId = button.dataset.p66Report; render(); }; });
    global.document.querySelector('[data-p66-close]')?.addEventListener('click', () => { runtime.selectedId = ''; render(); });
    const form = global.document.querySelector('[data-p66-report-form]'); if (form) form.onsubmit = (event) => { event.preventDefault(); const data = new FormData(form); try { CompetitiveContentIssueService.submit({ contentId: runtime.selectedId, issueType: data.get('issueType'), message: data.get('message') }); runtime.selectedId = ''; toast('Đã gửi báo cáo, cảm ơn bạn.'); render(); } catch (error) { toast(error.message); } };
  };
  if (state.currentView === VIEW) CompetitiveContentService.load();
})(window);
