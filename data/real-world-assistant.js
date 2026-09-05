/* Tiếng Hàn - TamHoanq · P19 Korean real-world assistant (local-first) */
(function buildRealWorldAssistant(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, saveUserSrs, DictionaryService, CloudSyncService, speakKorean } = app;
  const storageKey = STORAGE_KEYS.ecosystemExpansion || 'klearn_ecosystem_expansion';
  const routes = new Set(['real-world-assistant', 'korean-document-assistant', 'korean-menu-reader', 'korean-sign-reader', 'real-world-guide', 'survival-checklist']);
  const runtime = state.realWorldAssistant || (state.realWorldAssistant = { content: null, loading: false, error: '', readerMode: 'document', analysis: null, scanStatus: '', guideId: 'banking', menuCategory: 'restaurant', cultureResult: null });
  const now = () => new Date().toISOString();
  const locale = () => global.document?.documentElement?.lang === 'en' ? 'en' : global.document?.documentElement?.lang?.startsWith('zh') ? 'zh-CN' : 'vi';
  const localize = (value) => value && typeof value === 'object' && !Array.isArray(value) ? (value[locale()] || value.vi || value.en || '') : String(value || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const cleanText = (value, limit = 4000) => String(value || '').normalize('NFC').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, limit);
  const safeId = (value) => String(value || '').normalize('NFKD').replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'item';
  const records = () => userScoped(storageKey);
  const writeRecord = (record) => { const next = { ...record, userId: state.currentUser?.id, updatedAt: now() }; saveUserScoped(storageKey, [next, ...records().filter((item) => item.id !== next.id)], 250); CloudSyncService?.schedule?.('real-world-assistant'); return next; };

  const RealWorldContentService = {
    get() { return runtime.content; },
    hydrate(value) { if (!value?.verified || value.reviewStatus !== 'approved' || !Array.isArray(value.guides)) throw new Error('Real-world content quality gate failed'); runtime.content = value; runtime.error = ''; return value; },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/real-world-assistant.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = error.message || 'Content unavailable'; return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    }
  };

  function glossaryMatches(text) { return (runtime.content?.glossary || []).filter((item) => text.includes(item.term)); }
  function detectDocumentType(text) { const scored = (runtime.content?.documentTypes || []).map((item) => ({ item, score: item.keywords.filter((keyword) => text.includes(keyword)).length })).sort((a, b) => b.score - a.score); return scored[0]?.score ? scored[0].item : null; }
  const KoreanDocumentAssistantService = {
    analyze(input, mode = 'document') {
      const text = cleanText(input); if (!text) return null;
      const matches = glossaryMatches(text); const type = detectDocumentType(text); const hangul = text.match(/[\u3131-\u318E\uAC00-\uD7A3]+/g) || [];
      const recognized = new Set(matches.flatMap((item) => item.term)); const unknown = [...new Set(hangul.filter((token) => ![...recognized].some((term) => token.includes(term) || term.includes(token))))].slice(0, 12);
      const translation = matches.length ? matches.map((item) => `${item.term} = ${localize(item.meaning)}`).join(' · ') : copy('Chưa có bản dịch đã kiểm duyệt cho nội dung này.', 'No reviewed translation is available for this text.', '此文本暂无已审核翻译。');
      runtime.analysis = { mode, text, matches, type, unknown, translation, analyzedAt: now(), persisted: false };
      return runtime.analysis;
    },
    async scan(file, mode = 'document') {
      if (!file || !String(file.type || '').startsWith('image/')) throw new Error(copy('Hãy chọn file ảnh.', 'Choose an image file.', '请选择图片文件。'));
      if (Number(file.size || 0) > 8 * 1024 * 1024) throw new Error(copy('Ảnh phải nhỏ hơn 8 MB.', 'The image must be under 8 MB.', '图片需小于 8 MB。'));
      runtime.scanStatus = 'processing';
      if (!global.TextDetector || !global.createImageBitmap) { runtime.scanStatus = 'fallback'; render(); return { supported: false, persisted: false }; }
      const bitmap = await global.createImageBitmap(file);
      try { const blocks = await new global.TextDetector().detect(bitmap); const text = blocks.map((item) => cleanText(item.rawValue, 600)).filter(Boolean).join(' '); runtime.scanStatus = text ? 'complete' : 'empty'; if (text) this.analyze(text, mode); render(); return { supported: true, text, persisted: false }; }
      finally { bitmap.close?.(); }
    },
    addVocabulary(term) {
      const item = [...(runtime.content?.glossary || []), ...(runtime.content?.menuItems || []).map((entry) => ({ term: entry.name, reading: entry.reading, meaning: entry.meaning })), ...(runtime.content?.signs || []).map((entry) => ({ term: entry.text, reading: entry.reading, meaning: entry.meaning }))].find((entry) => (entry.term || entry.name) === term);
      if (!item) return false;
      const dictionaryEntry = DictionaryService?.all?.().find((entry) => entry.korean === term);
      if (dictionaryEntry) { DictionaryService.addToSrs(dictionaryEntry); return true; }
      const wordId = `real-world-${safeId(item.reading || item.term)}`; if ((state.srsData || []).some((card) => card.wordId === wordId || card.korean === item.term)) return true;
      saveUserSrs([...(state.srsData || []), { id: wordId, wordId, userId: state.currentUser?.id, korean: item.term, romanization: item.reading || '', meaningVi: item.meaning?.vi || localize(item.meaning), meaningEn: item.meaning?.en || '', meaningZh: item.meaning?.['zh-CN'] || '', status: 'new', reviewCount: 0, correctCount: 0, wrongCount: 0, mastery: 0, nextReview: now(), difficulty: 'new', source: 'real-world-assistant' }]);
      return true;
    },
    privacy() { return { uploads: false, imageStored: false, textStored: false, processing: global.TextDetector ? 'on-device-ocr' : 'manual-text-fallback' }; }
  };

  const MenuReaderService = {
    categories() { return ['restaurant', 'cafe', 'convenience']; },
    items(category = runtime.menuCategory) { return (runtime.content?.menuItems || []).filter((item) => item.category === category); },
    read(text, category = runtime.menuCategory) { const value = cleanText(text); const items = this.items(category); const matches = value ? items.filter((item) => value.includes(item.name)) : items; return { category, text: value, items: matches, unknown: Boolean(value && !matches.length), disclaimer: copy('Thành phần có thể thay đổi; nếu dị ứng hãy xác nhận trực tiếp với nhân viên.', 'Ingredients may vary; confirm allergies directly with staff.', '配料可能不同；如有过敏请直接向店员确认。') }; }
  };
  const SignReaderService = {
    all() { return runtime.content?.signs || []; },
    read(text) { const value = cleanText(text); const matches = this.all().filter((item) => value.includes(item.text) || item.text.includes(value)); return { text: value, signs: value ? matches : this.all(), unknown: Boolean(value && !matches.length) }; }
  };

  const CultureWarningService = {
    evaluate(input, context = 'workplace') {
      const text = cleanText(input, 500); if (!text) return null; const formal = ['banking', 'rental', 'university', 'workplace', 'shopping'].includes(context); const rules = (runtime.content?.cultureRules || []).filter((rule) => rule.contexts.includes(context));
      const matched = rules.find((rule) => rule.patterns.some((pattern) => new RegExp(pattern, 'u').test(text)));
      const missingPoliteEnding = formal && /[\uAC00-\uD7A3]/.test(text) && !/(\uc694|\ub2c8\ub2e4|\uae4c\uc694|\uc138\uc694|\ub4dc\ub9bd\ub2c8\ub2e4)[.!?]?$/.test(text);
      const result = matched ? { safe: false, severity: matched.severity, message: localize(matched.message), suggestion: copy('Vai vế, xin phép hoặc dùng đuôi lịch sự phù hợp.', 'Soften the request or use a context-appropriate polite ending.', '请软化请求或使用符合场景的礼貌词尾。') } : missingPoliteEnding ? { safe: false, severity: 'notice', message: copy('Câu có thể đúng ngữ pháp nhưng thiếu lịch sự trong môi trường này.', 'The sentence may be grammatical but insufficiently polite here.', '句子语法可能正确，但在此场景中不够礼貌。'), suggestion: copy('Thêm -요 hoặc dùng mẫu yêu cầu mềm.', 'Add -요 or use a softer request form.', '加上 -요 或使用更委婉的请求形式。') } : { safe: true, severity: 'ok', message: copy('Mức độ lịch sự phù hợp với ngữ cảnh đã chọn.', 'The politeness level fits the selected context.', '礼貌程度符合所选场景。'), suggestion: '' };
      runtime.cultureResult = { ...result, text, context }; return runtime.cultureResult;
    }
  };

  const SurvivalChecklistService = {
    catalog() { return runtime.content?.checklist || []; },
    record() { return records().find((item) => item.id === 'p19-survival-checklist') || { id: 'p19-survival-checklist', recordType: 'survival-checklist', completedIds: [] }; },
    toggle(id) { if (!this.catalog().some((item) => item.id === id)) return this.record(); const current = this.record(); const completed = new Set(current.completedIds || []); completed.has(id) ? completed.delete(id) : completed.add(id); return writeRecord({ ...current, completedIds: [...completed] }); },
    progress() { const current = this.record(); const total = this.catalog().length; const done = (current.completedIds || []).filter((id) => this.catalog().some((item) => item.id === id)).length; return { done, total, percentage: total ? Math.round(done / total * 100) : 0 }; }
  };
  const RealWorldGuideService = {
    all() { return runtime.content?.guides || []; },
    get(id = runtime.guideId) { return this.all().find((item) => item.id === id) || this.all()[0] || null; },
    completed(id) { return records().some((item) => item.id === `p19-guide-${id}` && item.completed); },
    complete(id) { if (!this.get(id)) return null; return writeRecord({ id: `p19-guide-${id}`, recordType: 'real-world-guide', guideId: id, completed: true, completedAt: now() }); }
  };

  function heading(back, eyebrow, title, description) { return `<section class="section page-heading real-world-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`; }
  function loadingView(back = 'real-korean-life') { RealWorldContentService.load(); return `${heading(back, 'P19 · REAL-WORLD', copy('Đang tải nội dung…', 'Loading content…', '正在加载内容…'), copy('Chỉ hiển thị nội dung đã kiểm duyệt.', 'Only reviewed content is displayed.', '仅显示已审核内容。'))}<div class="rw-loader section"><i></i></div>`; }
  function hubView() {
    if (!runtime.content) return loadingView(); const progress = SurvivalChecklistService.progress(); const guides = RealWorldGuideService.all();
    return `${heading('real-korean-life', 'P19 · KOREAN REAL-WORLD ECOSYSTEM', copy('Chuẩn bị cuộc sống tại Hàn', 'Prepare for life in Korea', '为韩国生活做准备'), copy('Hiểu giấy tờ, menu, biển báo và cách giao tiếp trong những tình huống quan trọng.', 'Understand documents, menus, signs and communication in important situations.', '理解重要场景中的文件、菜单、标识和沟通方式。'))}
      <section class="rw-overview section"><div><small>SURVIVAL READINESS</small><h2>${progress.percentage}%</h2><p>${progress.done}/${progress.total} ${copy('kỹ năng đã tự xác nhận', 'skills self-confirmed', '项技能已自我确认')}</p><div class="rw-progress"><i style="width:${progress.percentage}%"></i></div></div><button class="btn primary" data-view="survival-checklist">${copy('Mở checklist', 'Open checklist', '打开清单')}</button></section>
      <section class="rw-reader-grid section"><button data-reader-mode="document"><span>文</span><b>${copy('Document Assistant', 'Document Assistant', '文件助手')}</b><small>${copy('Đọc · dịch · giải thích · từ vựng', 'Read · translate · explain · vocabulary', '阅读·翻译·解释·词汇')}</small></button><button data-view="korean-menu-reader"><span>食</span><b>Menu Reader</b><small>Restaurant · Cafe · Convenience</small></button><button data-view="korean-sign-reader"><span>⚠</span><b>Sign Reader</b><small>${copy('Biển báo · thông báo · hướng dẫn', 'Signs · notices · directions', '标识·通知·指引')}</small></button><button data-guide="shopping"><span>袋</span><b>${copy('Mua sắm', 'Shopping', '购物')}</b><small>Size · payment · exchange</small></button></section>
      <section class="rw-guide-grid section">${guides.map((guide) => `<button data-guide="${guide.id}"><span>${guide.icon}</span><div><b>${escapeHtml(localize(guide.title))}</b><small>${escapeHtml(localize(guide.summary))}</small></div><i>${RealWorldGuideService.completed(guide.id) ? '✓' : '→'}</i></button>`).join('')}</section>
      <form id="cultureWarningForm" class="rw-culture section"><div><small>CULTURE WARNING</small><h2>${copy('Câu này có phù hợp không?', 'Does this sentence fit the situation?', '这句话适合该场景吗？')}</h2></div><select name="context"><option value="workplace">Workplace</option><option value="university">University</option><option value="banking">Bank</option><option value="rental">Rental</option><option value="shopping">Shopping</option></select><input name="sentence" lang="ko" maxlength="500" required placeholder="이거 줘"><button class="btn secondary">${copy('Kiểm tra sắc thái', 'Check tone', '检查语气')}</button>${runtime.cultureResult ? `<p class="${runtime.cultureResult.safe ? 'safe' : 'warning'}"><b>${runtime.cultureResult.safe ? '✓' : '!'} ${escapeHtml(runtime.cultureResult.message)}</b>${runtime.cultureResult.suggestion ? `<span>${escapeHtml(runtime.cultureResult.suggestion)}</span>` : ''}</p>` : ''}</form>`;
  }
  function readerShell(mode) {
    if (!runtime.content) return loadingView('real-world-assistant'); runtime.readerMode = mode; const titles = { document: copy('Trợ lý tài liệu tiếng Hàn', 'Korean Document Assistant', '韩文文件助手'), menu: 'Menu Reader', sign: 'Sign Reader' }; const placeholders = { document: '계약서 보증금 월세 관리비', menu: '김치찌개 비빔밥', sign: '출입금지' };
    const analysis = runtime.analysis?.mode === mode ? runtime.analysis : null;
    return `${heading('real-world-assistant', mode.toUpperCase(), titles[mode], copy('Ảnh được OCR trên thiết bị khi trình duyệt hỗ trợ; không upload và không lưu nội dung.', 'Images use on-device OCR when supported; content is neither uploaded nor stored.', '浏览器支持时使用设备端 OCR；内容不上传也不存储。'))}<nav class="rw-reader-tabs section">${[['document','Document'],['menu','Menu'],['sign','Sign']].map(([value, label]) => `<button class="${mode === value ? 'active' : ''}" data-reader-mode="${value}">${label}</button>`).join('')}</nav><section class="rw-reader-workspace section"><form id="realWorldReaderForm"><label>${copy('Nhập text nhìn thấy', 'Enter visible text', '输入看到的文字')}<textarea name="text" lang="ko" maxlength="4000" placeholder="${placeholders[mode]}" required>${escapeHtml(analysis?.text || '')}</textarea></label><button class="btn primary">${copy('Phân tích', 'Analyse', '分析')}</button></form><aside><label class="rw-file-button">${copy('Chọn ảnh', 'Choose image', '选择图片')}<input id="realWorldImageInput" type="file" accept="image/*" hidden></label><span>📷</span><small>${runtime.scanStatus === 'processing' ? copy('Đang nhận diện cục bộ…', 'Running local recognition…', '正在本地识别…') : runtime.scanStatus === 'fallback' ? copy('Thiết bị chưa hỗ trợ OCR. Hãy nhập text.', 'OCR is unavailable. Enter the text instead.', '设备不支持 OCR，请输入文字。') : copy('PNG/JPG · tối đa 8 MB · không upload', 'PNG/JPG · max 8 MB · no upload', 'PNG/JPG · 最大 8 MB · 不上传')}</small></aside></section>${analysis ? analysisMarkup(analysis) : ''}`;
  }
  function analysisMarkup(analysis) {
    if (analysis.mode === 'menu') return menuResults(MenuReaderService.read(analysis.text));
    if (analysis.mode === 'sign') return signResults(SignReaderService.read(analysis.text));
    return `<section class="rw-analysis section"><article><small>${copy('Nội dung', 'Reading', '原文')}</small><h2 lang="ko">${escapeHtml(analysis.text)}</h2>${analysis.type ? `<span>${escapeHtml(localize(analysis.type.title))}</span>` : ''}</article><article><small>${copy('Dịch theo từ khóa đã duyệt', 'Reviewed keyword translation', '已审核关键词翻译')}</small><p>${escapeHtml(analysis.translation)}</p></article>${analysis.type ? `<article><small>${copy('Giải thích', 'Explanation', '解释')}</small><p>${escapeHtml(localize(analysis.type.purpose))}</p><div class="rw-warning">! ${escapeHtml(localize(analysis.type.warning))}</div></article>` : ''}<article><small>VOCABULARY</small><div class="rw-vocab-list">${analysis.matches.length ? analysis.matches.map((item) => `<div><span><b lang="ko">${escapeHtml(item.term)}</b><em>${escapeHtml(item.reading)}</em></span><strong>${escapeHtml(localize(item.meaning))}</strong><button data-realworld-srs="${escapeHtml(item.term)}">+ SRS</button></div>`).join('') : `<p>${copy('Chưa tìm thấy từ đã kiểm duyệt.', 'No reviewed vocabulary was found.', '未找到已审核词汇。')}</p>`}</div>${analysis.unknown.length ? `<p class="subtle">${copy('Chưa xác định', 'Unresolved', '未识别')}: ${analysis.unknown.map(escapeHtml).join(' · ')}</p>` : ''}</article></section>`;
  }
  function menuResults(result = MenuReaderService.read('')) { return `<section class="rw-results section"><header><small>MENU · ${escapeHtml(result.category)}</small><p>${escapeHtml(result.disclaimer)}</p></header>${result.items.length ? result.items.map((item) => `<article><div><h2 lang="ko">${escapeHtml(item.name)}</h2><span>${escapeHtml(item.reading)} · ${escapeHtml(localize(item.meaning))}</span></div><p><b>${copy('Thành phần', 'Ingredients', '配料')}:</b> ${escapeHtml(localize(item.ingredients))}</p><div><code lang="ko">${escapeHtml(item.order)}</code><button data-speak-real="${escapeHtml(item.order)}">🔊</button><button data-realworld-srs="${escapeHtml(item.name)}">+ SRS</button></div></article>`).join('') : `<p class="rw-empty">${copy('Chưa nhận ra món trong bộ nội dung đã duyệt.', 'No reviewed menu item was recognised.', '未识别出已审核菜品。')}</p>`}</section>`; }
  function signResults(result = SignReaderService.read('')) { return `<section class="rw-results rw-sign-results section">${result.signs.length ? result.signs.map((item) => `<article class="${item.severity}"><div><h2 lang="ko">${escapeHtml(item.text)}</h2><span>${escapeHtml(item.reading)} · ${escapeHtml(localize(item.meaning))}</span></div><p>${escapeHtml(localize(item.action))}</p><div><button data-speak-real="${escapeHtml(item.text)}">🔊</button><button data-realworld-srs="${escapeHtml(item.text)}">+ SRS</button></div></article>`).join('') : `<p class="rw-empty">${copy('Chưa nhận ra biển trong bộ nội dung đã duyệt.', 'No reviewed sign was recognised.', '未识别出已审核标识。')}</p>`}</section>`; }
  function menuView() { if (!runtime.content) return loadingView('real-world-assistant'); return `${heading('real-world-assistant', 'MENU READER', copy('Đọc menu tại Hàn', 'Read Korean menus', '读懂韩国菜单'), copy('Tên món, thành phần tham khảo và câu gọi món.', 'Dish names, indicative ingredients and ordering phrases.', '菜名、参考配料和点餐表达。'))}<nav class="rw-category-tabs section">${MenuReaderService.categories().map((category) => `<button class="${runtime.menuCategory === category ? 'active' : ''}" data-menu-category="${category}">${category}</button>`).join('')}</nav>${menuResults(MenuReaderService.read('', runtime.menuCategory))}<button class="rw-scan-entry section" data-reader-mode="menu">📷 ${copy('Quét hoặc nhập menu', 'Scan or enter a menu', '扫描或输入菜单')}</button>`; }
  function signView() { if (!runtime.content) return loadingView('real-world-assistant'); return `${heading('real-world-assistant', 'SIGN READER', copy('Biển báo và thông báo', 'Signs and notices', '标识与通知'), copy('Hiểu ý nghĩa và hành động cần làm.', 'Understand the meaning and the action to take.', '理解含义和需要采取的行动。'))}${signResults()}<button class="rw-scan-entry section" data-reader-mode="sign">📷 ${copy('Quét hoặc nhập biển báo', 'Scan or enter a sign', '扫描或输入标识')}</button>`; }
  function guideView() { if (!runtime.content) return loadingView('real-world-assistant'); if (runtime.guideId === 'shopping') return shoppingView(); const guide = RealWorldGuideService.get(); if (!guide) return hubView(); return `${heading('real-world-assistant', 'REAL-WORLD GUIDE', localize(guide.title), localize(guide.summary))}<ol class="rw-guide-steps section">${guide.steps.map((step, index) => `<li><span>${index + 1}</span><div><h2>${escapeHtml(localize(step.title))}</h2><p>${escapeHtml(localize(step.body))}</p></div></li>`).join('')}</ol><section class="rw-phrase-kit section"><small>PHRASE KIT</small>${guide.phrases.map((phrase) => `<div><b lang="ko">${escapeHtml(phrase)}</b><button data-speak-real="${escapeHtml(phrase)}">🔊</button></div>`).join('')}</section><button class="btn ${RealWorldGuideService.completed(guide.id) ? 'secondary' : 'primary'} rw-complete-guide" data-complete-guide="${guide.id}">${RealWorldGuideService.completed(guide.id) ? copy('Đã thực hành', 'Practised', '已练习') : copy('Tôi đã thực hành các câu này', 'I practised these phrases', '我已练习这些表达')}</button>`; }
  function shoppingView() { const shopping = runtime.content.shopping; return `${heading('real-world-assistant', 'SHOPPING', copy('Mua sắm tại Hàn', 'Shopping in Korea', '在韩国购物'), copy('Size chỉ mang tính tham khảo; hãy thử và hỏi chính sách đổi trả.', 'Sizes are indicative; try items on and ask about returns.', '尺码仅供参考，请试穿并询问退换政策。'))}<section class="rw-size-grid section">${shopping.sizes.map((item) => `<article><strong>${escapeHtml(item.label)}</strong><p>${escapeHtml(localize(item.note))}</p></article>`).join('')}</section><section class="rw-phrase-kit section"><small>SHOPPING PHRASES</small>${shopping.phrases.map((item) => `<div><span><b lang="ko">${escapeHtml(item.ko)}</b><em>${escapeHtml(localize(item.meaning))}</em></span><button data-speak-real="${escapeHtml(item.ko)}">🔊</button></div>`).join('')}</section>`; }
  function checklistView() { if (!runtime.content) return loadingView('real-world-assistant'); const record = SurvivalChecklistService.record(); const selected = new Set(record.completedIds || []); const progress = SurvivalChecklistService.progress(); return `${heading('real-world-assistant', 'SURVIVAL CHECKLIST', copy('Sẵn sàng trước khi sang Hàn', 'Ready before going to Korea', '赴韩前准备清单'), copy('Tự xác nhận những việc bạn đã thực hành; checklist không phải chứng chỉ.', 'Self-confirm what you have practised; this is not a certification.', '自我确认已练习内容；此清单不是证书。'))}<section class="rw-checklist-progress section"><strong>${progress.percentage}%</strong><div><b>${progress.done}/${progress.total}</b><span>${copy('mục đã sẵn sàng', 'items ready', '项已就绪')}</span><i><em style="width:${progress.percentage}%"></em></i></div></section><section class="rw-checklist section">${SurvivalChecklistService.catalog().map((item) => `<label class="${selected.has(item.id) ? 'checked' : ''}"><input type="checkbox" data-survival-item="${item.id}" ${selected.has(item.id) ? 'checked' : ''}><span>${selected.has(item.id) ? '✓' : ''}</span><div><b>${escapeHtml(localize(item.title))}</b><small>${escapeHtml(item.group)}</small></div></label>`).join('')}</section>`; }

  Object.assign(global, { RealWorldContentService, KoreanDocumentAssistantService, MenuReaderService, SignReaderService, CultureWarningService, SurvivalChecklistService, RealWorldGuideService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'real-world-assistant': hubView, 'korean-document-assistant': () => readerShell(runtime.readerMode || 'document'), 'korean-menu-reader': menuView, 'korean-sign-reader': signView, 'real-world-guide': guideView, 'survival-checklist': checklistView };

  if (global.GlobalSearchService && !global.GlobalSearchService.__realWorldWrapped) { const originalSearch = global.GlobalSearchService.search.bind(global.GlobalSearchService); global.GlobalSearchService.search = (query = '') => { const result = originalSearch(query); const normalized = String(query).toLocaleLowerCase(); if (/(hàn quốc|korea|document|tài liệu|menu|biển báo|ngân hàng|thuê nhà|công sở|đại học|shopping)/i.test(normalized)) result.studyTools = [{ view: 'real-world-assistant', title: copy('Chuẩn bị cuộc sống tại Hàn', 'Prepare for life in Korea', '韩国生活准备'), description: 'Document · Menu · Sign · Banking · Rental' }, ...(result.studyTools || [])]; return result; }; global.GlobalSearchService.__realWorldWrapped = true; }
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (state.currentView === 'real-korean-life' && !global.document.querySelector('.rw-p19-entry')) global.document.querySelector('.life-tool-row,.page-heading')?.insertAdjacentHTML('beforebegin', `<button class="rw-p19-entry section" data-view="real-world-assistant"><span>한</span><div><b>${copy('Chuẩn bị cuộc sống tại Hàn', 'Prepare for life in Korea', '为韩国生活做准备')}</b><small>Document · Menu · Sign · Banking · Rental</small></div><i>→</i></button>`);
    if (routes.has(state.currentView) && !runtime.content) RealWorldContentService.load();
    global.document.querySelectorAll('[data-guide]').forEach((button) => { button.onclick = () => { runtime.guideId = button.dataset.guide; setView('real-world-guide'); }; });
    global.document.querySelectorAll('[data-reader-mode]').forEach((button) => { button.onclick = () => { const route = { document: 'korean-document-assistant', menu: 'korean-document-assistant', sign: 'korean-document-assistant' }[button.dataset.readerMode]; runtime.readerMode = button.dataset.readerMode; runtime.analysis = null; setView(route); }; });
    const readerForm = global.document.getElementById('realWorldReaderForm'); if (readerForm) readerForm.onsubmit = (event) => { event.preventDefault(); const text = new FormData(readerForm).get('text'); KoreanDocumentAssistantService.analyze(text, runtime.readerMode); render(); };
    const imageInput = global.document.getElementById('realWorldImageInput'); if (imageInput) imageInput.onchange = () => KoreanDocumentAssistantService.scan(imageInput.files?.[0], runtime.readerMode).catch((error) => { runtime.scanStatus = 'error'; toast(error.message); render(); });
    global.document.querySelectorAll('[data-menu-category]').forEach((button) => { button.onclick = () => { runtime.menuCategory = button.dataset.menuCategory; render(); }; });
    global.document.querySelectorAll('[data-speak-real]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.speakReal); });
    global.document.querySelectorAll('[data-realworld-srs]').forEach((button) => { button.onclick = () => { KoreanDocumentAssistantService.addVocabulary(button.dataset.realworldSrs); toast(copy('Đã thêm vào SRS.', 'Added to SRS.', '已加入 SRS。')); }; });
    global.document.querySelectorAll('[data-survival-item]').forEach((input) => { input.onchange = () => { SurvivalChecklistService.toggle(input.dataset.survivalItem); render(); }; });
    global.document.querySelectorAll('[data-complete-guide]').forEach((button) => { button.onclick = () => { RealWorldGuideService.complete(button.dataset.completeGuide); toast(copy('Đã lưu tiến độ thực hành.', 'Practice progress saved.', '已保存练习进度。')); render(); }; });
    const cultureForm = global.document.getElementById('cultureWarningForm'); if (cultureForm) cultureForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(cultureForm); CultureWarningService.evaluate(form.get('sentence'), form.get('context')); render(); };
  };
  render();
})(window);
