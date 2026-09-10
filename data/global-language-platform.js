/* P59 — operational global language platform. Korean remains the only active content pack. */
(() => {
  'use strict';
  const global = window;
  const app = global.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService, render, setView, toast, escapeHtml, getUserProgress, MasteryService } = app;
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const clean = (value, max = 240) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const asArray = (value) => Array.isArray(value) ? value : [];
  const LANGUAGE_ALIASES = { ko: 'ko', 'ko-kr': 'ko', korean: 'ko', ja: 'ja', 'ja-jp': 'ja', japanese: 'ja', zh: 'zh', 'zh-cn': 'zh', chinese: 'zh', en: 'en', 'en-us': 'en', english: 'en' };
  const fallbackContent = { version: 1, verified: true, reviewStatus: 'approved', architectureOnly: true, supportedLanguages: [{ id: 'ko', locale: 'ko-KR', nativeName: '한국어', englishName: 'Korean', contentStatus: 'active', direction: 'ltr', script: 'Hangul' }, { id: 'ja', locale: 'ja-JP', nativeName: '日本語', englishName: 'Japanese', contentStatus: 'foundation', direction: 'ltr', script: 'Kana + Kanji' }, { id: 'zh', locale: 'zh-CN', nativeName: '中文', englishName: 'Chinese', contentStatus: 'foundation', direction: 'ltr', script: 'Han' }, { id: 'en', locale: 'en-US', nativeName: 'English', englishName: 'English', contentStatus: 'foundation', direction: 'ltr', script: 'Latin' }], examSystems: [{ id: 'topik', languageId: 'ko', name: 'TOPIK', levels: [1, 2, 3, 4, 5, 6], status: 'active' }, { id: 'jlpt', languageId: 'ja', name: 'JLPT', levels: ['N5', 'N4', 'N3', 'N2', 'N1'], status: 'framework' }, { id: 'hsk', languageId: 'zh', name: 'HSK', levels: [1, 2, 3, 4, 5, 6], status: 'framework' }], levelSystems: { ko: 'TOPIK', ja: 'JLPT', zh: 'HSK', en: 'CEFR' }, contentModel: { course: ['id', 'languageId', 'title', 'level', 'units', 'status'], lesson: ['id', 'courseId', 'languageId', 'skill', 'content', 'examples', 'audioIds'], vocabulary: ['id', 'languageId', 'term', 'meaning', 'reading', 'partOfSpeech', 'level', 'audioIds'], grammar: ['id', 'languageId', 'pattern', 'explanation', 'examples', 'level'], audio: ['id', 'languageId', 'text', 'url', 'locale', 'speed', 'qualityStatus'] } };
  const routes = new Set(['global-language-platform', 'global-language-profiles', 'global-exam-framework', 'global-language-comparison', 'global-expansion']);
  const runtime = state.globalLanguageRuntime || (state.globalLanguageRuntime = { content: null, loading: null, error: '' });
  const esc = (value) => escapeHtml ? escapeHtml(value) : clean(value, 1000);
  const normalizeLanguage = (value) => LANGUAGE_ALIASES[clean(value, 30).toLowerCase()] || '';
  const language = (value) => GlobalLanguageContentService.get().supportedLanguages?.find((item) => item.id === normalizeLanguage(value)) || null;
  const requireLanguage = (value) => { const id = normalizeLanguage(value); return language(id) ? id : null; };

  const GlobalLanguageContentService = {
    hydrate(value) { const content = asObject(value); const languageIds = asArray(content.supportedLanguages).map((item) => item.id).sort().join(','); const examIds = asArray(content.examSystems).map((item) => item.id).sort().join(','); if (content.verified !== true || content.reviewStatus !== 'approved' || ![true, false].includes(content.architectureOnly) || languageIds !== 'en,ja,ko,zh' || examIds !== 'hsk,jlpt,topik') throw new Error('Global language content quality gate failed'); runtime.content = content; runtime.error = ''; return content; },
    async load() { if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading; if (typeof fetch !== 'function') return this.hydrate(fallbackContent); runtime.loading = fetch('./content/global-language-platform.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Global language content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = error.message || 'Global language content unavailable'; return this.hydrate(fallbackContent); }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render?.(); }); return runtime.loading; },
    get() { return runtime.content || fallbackContent; },
    status() { const content = this.get(); return { loaded: Boolean(runtime.content), architectureOnly: content.architectureOnly === true, implementationMode: content.implementationMode || 'contracts-only', error: runtime.error || null }; }
  };

  const LanguageCoreService = {
    all() { return asArray(GlobalLanguageContentService.get().supportedLanguages); },
    supported(value) { return Boolean(requireLanguage(value)); },
    normalize(value) { return normalizeLanguage(value); },
    get(value) { return language(value); },
    active() { return this.all().filter((item) => item.contentStatus === 'active'); },
    contentStatus(value) { return language(value)?.contentStatus || 'unsupported'; },
    levelSystem(value) { const id = requireLanguage(value); return id ? (GlobalLanguageContentService.get().levelSystems?.[id] || 'CEFR') : null; }
  };

  const defaultProfile = () => ({ version: 1, activeLanguage: 'ko', languages: { ko: { languageId: 'ko', status: 'learning', currentLevel: 'TOPIK1', targetLevel: 'TOPIK2', startedAt: now(), updatedAt: now() } }, updatedAt: now() });
  const readProfile = () => { const value = userScoped(STORAGE_KEYS.languageProfiles || 'klearn_language_profiles')[0]; return value && typeof value === 'object' && !Array.isArray(value) ? { ...defaultProfile(), ...value, languages: asObject(value.languages) } : defaultProfile(); };
  const writeProfile = (value) => { if (!uid()) return null; const next = { ...defaultProfile(), ...value, version: 1, updatedAt: now() }; saveUserScoped(STORAGE_KEYS.languageProfiles || 'klearn_language_profiles', [next], 1); CloudSyncService?.schedule?.('language-profile'); return next; };
  const LanguageProfileService = {
    get() { return readProfile(); },
    active() { return readProfile().activeLanguage; },
    all() { const profile = readProfile(); return Object.values(profile.languages).filter((item) => LanguageCoreService.supported(item.languageId)); },
    getLanguage(languageId) { const id = requireLanguage(languageId); return id ? readProfile().languages[id] || null : null; },
    setActive(languageId) { const id = requireLanguage(languageId); if (!id || !uid()) return null; const profile = readProfile(); const entry = profile.languages[id] || { languageId: id, status: 'planned', startedAt: now() }; return writeProfile({ ...profile, activeLanguage: id, languages: { ...profile.languages, [id]: { ...entry, updatedAt: now() } } }); },
    add(languageId, input = {}) { const id = requireLanguage(languageId); if (!id || !uid()) return null; const profile = readProfile(); const current = profile.languages[id] || {}; return writeProfile({ ...profile, languages: { ...profile.languages, [id]: { languageId: id, status: 'planned', currentLevel: input.currentLevel || null, targetLevel: input.targetLevel || null, ...current, ...input, languageId: id, updatedAt: now() } } }); },
    update(languageId, changes = {}) { const id = requireLanguage(languageId); if (!id || !uid()) return null; const profile = readProfile(); const current = profile.languages[id] || { languageId: id, status: 'planned' }; return writeProfile({ ...profile, languages: { ...profile.languages, [id]: { ...current, ...changes, languageId: id, updatedAt: now() } } }); }
  };

  const ExamFrameworkService = {
    all() { return asArray(GlobalLanguageContentService.get().examSystems); },
    forLanguage(languageId) { const id = requireLanguage(languageId); return this.all().filter((item) => item.languageId === id); },
    get(examId) { return this.all().find((item) => item.id === clean(examId, 30).toLowerCase()) || null; },
    level(examId, level) { const exam = this.get(examId); return exam?.levels?.includes(level) ? level : null; },
    map(languageId, level) { const id = requireLanguage(languageId); const exam = this.forLanguage(id)[0]; return exam ? { examId: exam.id, languageId: id, level: this.level(exam.id, level) || exam.levels[0], label: `${exam.name} ${this.level(exam.id, level) || exam.levels[0]}` } : null; }
  };

  const CourseStructureService = {
    normalize(course = {}) { const languageId = requireLanguage(course.languageId); if (!languageId || !clean(course.id, 100)) return null; return { id: clean(course.id, 100), languageId, title: clean(course.title, 200), level: clean(course.level, 40), units: asArray(course.units).map((unit) => ({ id: clean(unit.id, 100), title: clean(unit.title, 200), lessonIds: asArray(unit.lessonIds).map((id) => clean(id, 100)).filter(Boolean) })).filter((unit) => unit.id), status: ['draft', 'approved', 'archived'].includes(course.status) ? course.status : 'draft' }; },
    lessons(course = {}) { return asArray(course.units).flatMap((unit) => asArray(unit.lessonIds)); },
    validate(course = {}) { const normalized = this.normalize(course); return { valid: Boolean(normalized && normalized.units.length), errors: normalized ? (normalized.units.length ? [] : ['course needs units']) : ['languageId and id are required'] }; }
  };

  const VocabularyEngine = {
    normalize(card = {}, languageId = card.languageId || 'ko') { const id = requireLanguage(languageId); if (!id || !clean(card.id || card.wordId || card.term, 120)) return null; return { ...card, id: clean(card.id || card.wordId || card.term, 120), languageId: id, term: clean(card.term || card.korean || card.word || '', 240), meaning: clean(card.meaning || card.meaningVi || card.translation || '', 500), reading: clean(card.reading || card.romanization || '', 240) }; },
    cards(languageId = LanguageProfileService.active()) { const id = requireLanguage(languageId); if (!id) return []; return asArray(state.srsData).filter((card) => (card.languageId || 'ko') === id).map((card) => this.normalize(card, id)).filter(Boolean); },
    scope(card, languageId = LanguageProfileService.active()) { return this.normalize({ ...card, languageId }, languageId); },
    mastery(card) { const value = Number(card?.mastery); return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); },
    review(card, result = {}) { const normalized = this.normalize(card, card?.languageId); if (!normalized) return null; return { ...normalized, lastResult: Boolean(result.correct), lastReviewed: now(), reviewCount: Number(card.reviewCount || 0) + 1, mastery: Math.max(0, Math.min(100, this.mastery(card) + (result.correct ? 8 : -12))) }; }
  };

  const GrammarFrameworkService = {
    normalize(grammar = {}) { const languageId = requireLanguage(grammar.languageId); if (!languageId || !clean(grammar.id, 120) || !clean(grammar.pattern, 160)) return null; return { id: clean(grammar.id, 120), languageId, pattern: clean(grammar.pattern, 160), explanation: clean(grammar.explanation, 1000), examples: asArray(grammar.examples).slice(0, 12).map((item) => ({ form: clean(item.form || item.korean || item.text, 500), translation: clean(item.translation || item.meaning, 500) })).filter((item) => item.form), level: clean(grammar.level, 40) }; },
    supports(languageId) { return LanguageCoreService.supported(languageId); },
    compare(first, second) { const a = this.normalize(first); const b = this.normalize(second); return a && b && a.languageId !== b.languageId ? { source: a, target: b, sameConcept: false } : null; }
  };

  const AudioFrameworkService = {
    normalize(audio = {}) { const languageId = requireLanguage(audio.languageId); if (!languageId || !clean(audio.id, 120) || !clean(audio.text, 500)) return null; return { id: clean(audio.id, 120), languageId, text: clean(audio.text, 500), url: clean(audio.url, 1000), locale: clean(audio.locale || language(languageId)?.locale, 40), speed: Number(audio.speed) > 0 ? Number(audio.speed) : 1, qualityStatus: ['draft', 'review', 'approved'].includes(audio.qualityStatus) ? audio.qualityStatus : 'review' }; },
    speak(text, languageId = LanguageProfileService.active()) { const id = requireLanguage(languageId); if (!id || !global.speechSynthesis || !global.SpeechSynthesisUtterance) return false; const utterance = new global.SpeechSynthesisUtterance(clean(text, 1000)); utterance.lang = language(id)?.locale || id; global.speechSynthesis.cancel(); global.speechSynthesis.speak(utterance); return true; }
  };

  const LanguageComparisonService = {
    compare(input = {}) { const sourceLanguage = normalizeLanguage(input.sourceLanguage) || (clean(input.sourceLanguage, 20).toLowerCase() === 'vi' ? 'vi' : ''); const targetLanguage = requireLanguage(input.targetLanguage); if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) return null; return { sourceLanguage, targetLanguage, source: clean(input.source, 1000), target: clean(input.target, 1000), note: clean(input.note || input.notes, 1000), createdAt: now() }; },
    languages() { return ['vi', ...LanguageCoreService.all().map((item) => item.id)]; }
  };

  const SharedLearningCoreService = {
    knowledgeId(languageId, id) { const languageIdNormalized = requireLanguage(languageId); const itemId = clean(id, 160); if (!languageIdNormalized || !itemId) return null; return languageIdNormalized === 'ko' ? itemId : `${languageIdNormalized}:${itemId}`; },
    adapters(languageId = LanguageProfileService.active()) { const id = requireLanguage(languageId); if (!id) return null; return { languageId: id, srs: VocabularyEngine, mastery: MasteryService || null, analytics: global.AdvancedLearningAnalyticsService || global.LearningAnalyticsEngine || null, reusesExistingState: true, legacyKoreanIdsPreserved: id === 'ko' }; },
    srsCards(languageId = LanguageProfileService.active()) { return VocabularyEngine.cards(languageId); },
    mastery(lessonId, languageId = LanguageProfileService.active()) { const id = this.knowledgeId(languageId, lessonId); if (!id || !MasteryService?.lesson) return { score: 0, status: 'unavailable' }; const progress = getUserProgress?.() || {}; return MasteryService.lesson(progress.lessonProgress?.[id] || {}); },
    analytics(languageId = LanguageProfileService.active()) { const id = requireLanguage(languageId); return id ? { languageId: id, service: global.AdvancedLearningAnalyticsService ? 'advanced' : global.LearningAnalyticsEngine ? 'core' : 'pending', crossUserComparison: false } : null; }
  };

  const GlobalPlatformGatewayService = {
    capabilities() {
      return [
        { id: 'marketplace', title: 'Course Marketplace', description: 'Khóa học approved + verified', route: 'global-education-marketplace', status: global.GlobalEducationMarketplace ? 'ready' : 'lazy' },
        { id: 'teacher', title: 'Teacher Platform', description: 'Lớp học, bài giao và tiến độ', route: 'teacher-dashboard', status: global.TeacherWorkspaceService || global.EducationPlatformService ? 'ready' : 'lazy' },
        { id: 'creator', title: 'Content Creator', description: 'Draft → review → publish', route: 'creator-studio', status: global.MarketplaceCreatorService ? 'ready' : 'lazy' },
        { id: 'certification', title: 'Certification', description: 'Chứng nhận dựa trên tiến độ thật', route: 'marketplace-certificates', status: global.MarketplaceCertificateService || global.CertificationService ? 'ready' : 'lazy' }
      ];
    }
  };

  const GlobalExpansionService = {
    matrix() { return LanguageCoreService.all().map((item) => ({ ...item, engineReady: true, profileReady: true, exam: ExamFrameworkService.forLanguage(item.id)[0] || null, contentReady: item.contentStatus === 'active' })); },
    summary() { const matrix = this.matrix(); return { engineReady: matrix.length, contentReady: matrix.filter((item) => item.contentReady).length, languages: matrix.length, activeContentLanguage: 'ko', noFabricatedCurriculum: true }; }
  };

  const heading = (back, eyebrow, title, description) => `<section class="glp-heading section"><button class="back-btn" data-view="${esc(back)}" aria-label="Quay lại">←</button><div><small>${esc(eyebrow)}</small><h1>${esc(title)}</h1><p>${esc(description)}</p></div></section>`;
  const statusLabel = (status) => status === 'active' ? 'Nội dung đang hoạt động' : 'Engine và hồ sơ sẵn sàng';
  function platformView() {
    const active = LanguageProfileService.active(); const expansion = GlobalExpansionService.summary(); const profileIds = new Set(LanguageProfileService.all().map((item) => item.languageId));
    return `${heading('profile', 'P59 · GLOBAL LANGUAGE PLATFORM', 'Một learning core, nhiều ngôn ngữ', 'Korean đang có curriculum; Japanese, Chinese và English đã dùng chung engine, hồ sơ và contract mở rộng.')}
      <section class="glp-hero section"><div><small>SHARED LEARNING CORE</small><h2>SRS · Mastery · Analytics</h2><p>Giữ nguyên dữ liệu Korean hiện tại và namespace kiến thức mới theo từng ngôn ngữ.</p></div><div><strong>${expansion.engineReady}/4</strong><span>language engines ready</span></div></section>
      <section class="glp-language-grid section">${LanguageCoreService.all().map((item) => `<article class="${active === item.id ? 'active' : ''}"><header><span>${esc(item.id.toUpperCase())}</span><em>${active === item.id ? 'Đang chọn' : profileIds.has(item.id) ? 'Đã có hồ sơ' : 'Chưa thêm'}</em></header><h2>${esc(item.nativeName)}</h2><p>${esc(item.englishName)} · ${esc(item.script)}</p><small>${statusLabel(item.contentStatus)}</small><button class="btn secondary" data-glp-language="${item.id}">${profileIds.has(item.id) ? 'Mở hồ sơ' : 'Thêm vào hồ sơ'}</button></article>`).join('')}</section>
      <section class="glp-core-links section"><button data-view="global-language-profiles"><span>◎</span><b>Language Profile</b><small>Một tài khoản, nhiều mục tiêu</small></button><button data-view="global-exam-framework"><span>試</span><b>Exam Framework</b><small>TOPIK · JLPT · HSK</small></button><button data-view="global-language-comparison"><span>文</span><b>Cross-language</b><small>Việt · Hàn · Nhật</small></button><button data-view="global-expansion"><span>↗</span><b>Global Expansion</b><small>Trạng thái phát hành minh bạch</small></button></section>
      <section class="glp-ecosystem section"><div><small>EDUCATION ECOSYSTEM</small><h2>Học viên, giáo viên và người tạo nội dung dùng chung nền tảng</h2></div><div>${GlobalPlatformGatewayService.capabilities().map((item) => `<button data-view="${item.route}"><b>${esc(item.title)}</b><small>${esc(item.description)}</small><span>→</span></button>`).join('')}</div></section>`;
  }
  function profilesView() {
    const profile = LanguageProfileService.get();
    return `${heading('global-language-platform', 'LANGUAGE PROFILE', 'Các ngôn ngữ của bạn', 'Mỗi ngôn ngữ có trình độ và mục tiêu riêng; lịch sử Korean hiện tại không bị di chuyển hoặc reset.')}<section class="glp-profile-list section">${LanguageCoreService.all().map((item) => { const value = profile.languages[item.id]; return `<article class="${profile.activeLanguage === item.id ? 'active' : ''}"><div><span>${esc(item.id.toUpperCase())}</span><div><h2>${esc(item.nativeName)}</h2><p>${value ? `${esc(value.currentLevel || 'Chưa đặt')} → ${esc(value.targetLevel || 'Chưa đặt mục tiêu')}` : 'Chưa có trong hồ sơ'}</p></div></div><div>${value ? `<button class="btn secondary" data-glp-active="${item.id}" ${profile.activeLanguage === item.id ? 'disabled' : ''}>${profile.activeLanguage === item.id ? 'Đang chọn' : 'Chọn hồ sơ'}</button>` : `<button class="btn primary" data-glp-add="${item.id}">Thêm ngôn ngữ</button>`}</div></article>`; }).join('')}</section><p class="glp-note section">Việc thêm Japanese, Chinese hoặc English tạo hồ sơ và mục tiêu; không tự mở curriculum chưa được phát hành.</p>`;
  }
  function examsView() {
    return `${heading('global-language-platform', 'EXAM FRAMEWORK', 'Một contract cho nhiều kỳ thi', 'TOPIK đang hoạt động; JLPT và HSK có mapping cấp độ để content pack tương lai dùng lại.')}
      <section class="glp-exam-grid section">${ExamFrameworkService.all().map((exam) => { const languageItem = LanguageCoreService.get(exam.languageId); return `<article class="${exam.status}"><header><span>${esc(exam.name)}</span><em>${esc(exam.status)}</em></header><h2>${esc(languageItem?.nativeName || exam.languageId)}</h2><div>${exam.levels.map((level) => `<span>${esc(level)}</span>`).join('')}</div><p>${exam.status === 'active' ? 'Đã kết nối curriculum và analytics hiện tại.' : 'Framework sẵn sàng; chưa công bố đề hoặc curriculum.'}</p>${exam.id === 'topik' ? '<button class="btn primary" data-view="topik">Mở TOPIK</button>' : ''}</article>`; }).join('')}</section>`;
  }
  function comparisonView() {
    const examples = asArray(GlobalLanguageContentService.get().comparison?.examples);
    return `${heading('global-language-platform', 'CROSS-LANGUAGE COMPARISON', 'Nhìn một ý qua nhiều ngôn ngữ', 'So sánh cấu trúc và sắc thái; đây không phải công cụ dịch máy tự động.')}
      <section class="glp-comparison section">${examples.map((example) => `<article><header><b>${esc(example.concept)}</b><small>${esc(example.note)}</small></header><div><span>VI</span><p>${esc(example.vi)}</p></div><div><span>KO</span><p lang="ko">${esc(example.ko)}</p></div><div><span>JA</span><p lang="ja">${esc(example.ja)}</p></div></article>`).join('') || '<div class="empty-state"><h2>Chưa có ví dụ đã duyệt</h2></div>'}</section><button class="btn secondary full section" data-view="cross-language-lab">Mở phòng đối chiếu nâng cao</button>`;
  }
  function expansionView() {
    const matrix = GlobalExpansionService.matrix();
    return `${heading('global-language-platform', 'GLOBAL EXPANSION', 'Mở rộng theo content pack đã kiểm duyệt', 'Engine-ready không đồng nghĩa curriculum đã phát hành. Trạng thái được hiển thị rõ để tránh nội dung giả.')}
      <section class="glp-expansion-table section"><header><span>Language</span><span>Engine</span><span>Profile</span><span>Exam</span><span>Content</span></header>${matrix.map((item) => `<article><b>${esc(item.nativeName)}</b><span>✓ Ready</span><span>✓ Ready</span><span>${item.exam ? esc(item.exam.name) : esc(LanguageCoreService.levelSystem(item.id))}</span><strong class="${item.contentReady ? 'ready' : ''}">${item.contentReady ? 'Active' : 'Foundation'}</strong></article>`) .join('')}</section><section class="glp-note section">Korean tiếp tục dùng ID legacy để bảo toàn SRS/Mastery. Kiến thức của các ngôn ngữ mới dùng namespace riêng như <code>ja:lesson-id</code>.</section>`;
  }

  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'global-language-platform': platformView, 'global-language-profiles': profilesView, 'global-exam-framework': examsView, 'global-language-comparison': comparisonView, 'global-expansion': expansionView };
  const bind = () => {
    if (!global.document || !state.currentUser) return;
    if (routes.has(state.currentView)) GlobalLanguageContentService.load();
    if (state.currentView === 'profile' && !global.document.querySelector('[data-global-language-entry]')) global.document.querySelector('[data-future-language-profile], [data-enterprise-platform-entry], .profile-action-list, #app > .section')?.insertAdjacentHTML('afterend', '<section class="glp-profile-entry section" data-global-language-entry><div><small>P59 · GLOBAL PLATFORM</small><h2>Học nhiều ngôn ngữ trên một tài khoản</h2><p>Korean · Japanese · Chinese · English dùng chung learning core.</p></div><button class="btn primary" data-view="global-language-platform">Mở nền tảng</button></section>');
    global.document.querySelectorAll('[data-glp-language]').forEach((button) => { button.onclick = () => { if (!LanguageProfileService.getLanguage(button.dataset.glpLanguage)) LanguageProfileService.add(button.dataset.glpLanguage); setView?.('global-language-profiles'); }; });
    global.document.querySelectorAll('[data-glp-add]').forEach((button) => { button.onclick = () => { LanguageProfileService.add(button.dataset.glpAdd); toast?.('Đã thêm hồ sơ ngôn ngữ.'); render?.(); }; });
    global.document.querySelectorAll('[data-glp-active]').forEach((button) => { button.onclick = () => { LanguageProfileService.setActive(button.dataset.glpActive); toast?.('Đã chuyển hồ sơ học tập.'); render?.(); }; });
  };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };

  const LanguagePlatformService = { content: GlobalLanguageContentService, core: LanguageCoreService, sharedLearning: SharedLearningCoreService, profiles: LanguageProfileService, exams: ExamFrameworkService, courses: CourseStructureService, vocabulary: VocabularyEngine, grammar: GrammarFrameworkService, audio: AudioFrameworkService, comparison: LanguageComparisonService, gateway: GlobalPlatformGatewayService, expansion: GlobalExpansionService, version: 'p59-v2' };
  global.GlobalLanguageContentService = GlobalLanguageContentService;
  global.LanguageCoreService = LanguageCoreService;
  global.LanguageProfileService = LanguageProfileService;
  global.ExamFrameworkService = ExamFrameworkService;
  global.CourseStructureService = CourseStructureService;
  global.LanguageVocabularyEngine = VocabularyEngine;
  global.GrammarFrameworkService = GrammarFrameworkService;
  global.AudioFrameworkService = AudioFrameworkService;
  global.LanguageComparisonService = LanguageComparisonService;
  global.SharedLearningCoreService = SharedLearningCoreService;
  global.GlobalPlatformGatewayService = GlobalPlatformGatewayService;
  global.GlobalExpansionService = GlobalExpansionService;
  global.LanguagePlatformService = LanguagePlatformService;
  GlobalLanguageContentService.load();
})();
