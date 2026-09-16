/* Tiếng Hàn - TamHoanq · P74 product delight and engagement orchestration */
(function buildProductDelight(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) { global.setTimeout?.(() => buildProductDelight(global), 0); return; }
  const { storage, state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, PracticeService, LearnerProfileService, render, setView, toast, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.productDelight || 'klearn_product_delight';
  const ROUTES = new Set(['product-delight', 'learning-companion', 'learning-celebrations', 'habit-intelligence', 'delight-focus-session', 'culture-context', 'career-journey', 'delight-feedback', 'delight-analytics']);
  const runtime = state.productDelightRuntime || (state.productDelightRuntime = { content: null, loading: false, error: '', focusMinutes: 15, cultureId: '', celebrationId: '' });
  const now = () => new Date().toISOString();
  const time = (value) => new Date(value || 0).getTime() || 0;
  const clean = (value, limit = 1000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit);
  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const emptyStore = () => ({ schemaVersion: 1, celebrations: [], careerPath: '', feedback: [], reminder: { enabled: false, hour: 20 }, companionOpenedAt: null });
  function readStore() {
    const value = userScoped(STORE_KEY)[0];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStore();
    return { ...emptyStore(), ...value, celebrations: Array.isArray(value.celebrations) ? value.celebrations : [], feedback: Array.isArray(value.feedback) ? value.feedback : [], reminder: value.reminder && typeof value.reminder === 'object' ? value.reminder : emptyStore().reminder };
  }
  function writeStore(value) { const next = { ...emptyStore(), ...value, schemaVersion: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); return next; }
  function updateStore(mutator) { const current = readStore(); return writeStore(mutator(current) || current); }

  const ProductDelightContentService = {
    hydrate(value) {
      if (value?.verified !== true || value.reviewStatus !== 'approved' || value.schemaVersion !== 1) throw new Error('P74 content quality gate failed');
      if (value.companion?.personality !== 'calm-supportive' || value.celebrations?.length !== 7 || value.culture?.length !== 6 || value.careerPaths?.length !== 4 || !['5', '15', '30'].every((minutes) => Array.isArray(value.focusTemplates?.[minutes]))) throw new Error('P74 content schema invalid');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/product-delight.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P74 content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 180); return null; }).finally(() => { runtime.loading = false; if (ROUTES.has(state.currentView)) render(); });
      return runtime.loading;
    }
  };

  const progress = () => getUserProgress?.() || {};
  const srs = () => app.getUserSrs?.() || state.srsData || [];
  const mastered = () => srs().filter((item) => item.status === 'mastered' || Number(item.mastery || 0) >= 85).length;
  const learnedCharacters = () => progress().foundation?.learnedCharacters?.length || 0;
  const completedLessons = () => Object.values(progress().lessonProgress || {}).filter((item) => item?.completed).length;
  const completedSentences = () => {
    const key = STORAGE_KEYS.sentenceBuilderProgress || 'klearn_sentence_builder_progress';
    const saved = storage?.get?.(key, {})?.[state.currentUser?.id] || {};
    if (Array.isArray(saved)) return saved.filter((item) => item?.completed || item?.correct || Number(item?.score || 0) >= 60).length;
    return Array.isArray(saved.completedIds) ? saved.completedIds.length : (saved.attempts || []).filter((item) => item?.completed || item?.correct || Number(item?.score || 0) >= 60).length;
  };
  const completedConversations = () => (global.RealKoreanMissionService?.history?.() || []).filter((item) => item.completed).length || (global.ConversationHistoryService?.all?.() || []).filter((item) => Number(item.completedRuns || 0) > 0).length;
  const topikEvidence = () => (PracticeService?.getHistory?.() || []).find((item) => Number(item.percentage || item.score || 0) >= 60 && /topik|(?:^|\s)t[1-6]-/i.test(`${item.level || ''} ${item.setTitle || ''} ${item.setId || ''}`)) || null;
  const ageDays = (reference = new Date()) => Math.max(0, Math.floor((reference.getTime() - time(state.currentUser?.createdAt || reference)) / 86400000));

  const DelightCelebrationService = {
    evidence(definition) {
      if (definition.evidence === 'hangul') return learnedCharacters() >= definition.threshold ? { source: 'foundation-progress', value: learnedCharacters() } : null;
      if (definition.evidence === 'sentence') return completedSentences() >= definition.threshold ? { source: 'sentence-builder-progress', value: completedSentences() } : null;
      if (definition.evidence === 'mastered') return mastered() >= definition.threshold ? { source: 'srs-mastery', value: mastered() } : null;
      if (definition.evidence === 'conversation') return completedConversations() >= definition.threshold ? { source: 'conversation-history', value: completedConversations() } : null;
      if (definition.evidence === 'topik') { const attempt = topikEvidence(); return attempt ? { source: 'practice-history', value: Number(attempt.percentage || attempt.score), attemptId: attempt.id || attempt.setId } : null; }
      return null;
    },
    all() {
      const acknowledged = new Map(readStore().celebrations.map((item) => [item.id, item]));
      return (runtime.content?.celebrations || []).map((definition) => { const evidence = this.evidence(definition); const saved = acknowledged.get(definition.id); return { ...definition, unlocked: Boolean(evidence), evidence, acknowledgedAt: saved?.acknowledgedAt || null }; });
    },
    pending() { return this.all().find((item) => item.unlocked && !item.acknowledgedAt) || null; },
    acknowledge(celebrationId) {
      const item = this.all().find((candidate) => candidate.id === celebrationId && candidate.unlocked); if (!item) return null;
      const record = { id: item.id, evidence: item.evidence, acknowledgedAt: now(), updatedAt: now() };
      updateStore((value) => ({ ...value, celebrations: [record, ...value.celebrations.filter((candidate) => candidate.id !== record.id)] }));
      global.UserResearchService?.track?.('feature_used', { feature: 'learning_celebration', result: item.id }); return record;
    }
  };

  const LearningCompanionService = {
    profile() { return runtime.content?.companion || { name: 'TamHoanq', personality: 'calm-supportive', tone: 'encouraging-without-pressure' }; },
    summary(reference = new Date()) {
      const days = ageDays(reference); const words = mastered(); const lessons = completedLessons(); const hangul = learnedCharacters(); const conversations = completedConversations(); const celebration = DelightCelebrationService.pending();
      const greeting = days >= 30 ? 'Chào mừng bạn quay lại với hành trình của mình.' : days >= 7 ? 'Mỗi phiên ngắn đang tạo nên tiến bộ thật.' : 'Mình sẽ cùng bạn đi từng bước nhỏ.';
      const evidence = [];
      if (hangul) evidence.push(`đọc ${hangul} ký tự Hangul`);
      if (words) evidence.push(`thành thạo ${words} từ`);
      if (lessons) evidence.push(`hoàn thành ${lessons} bài`);
      if (conversations) evidence.push(`hoàn thành ${conversations} hội thoại`);
      return { name: this.profile().name, personality: this.profile().personality, tone: this.profile().tone, days, greeting, evidence, milestoneResponse: celebration?.title || '', encouragement: evidence.length ? 'Bạn không cần học thật nhiều hôm nay—chỉ cần tiếp tục một bước rõ ràng.' : 'Bắt đầu bằng một hoạt động nhỏ; tiến độ sẽ được ghi khi có kết quả thật.' };
    },
    opened() { updateStore((value) => ({ ...value, companionOpenedAt: now() })); }
  };

  const HabitIntelligenceService = {
    analyze(reference = new Date()) {
      const events = global.LearningActivityService?.events?.() || [];
      const cutoff = new Date(reference); cutoff.setDate(cutoff.getDate() - 30);
      const recent = events.filter((item) => time(item.at) >= cutoff.getTime() && time(item.at) <= reference.getTime());
      const base = global.HabitFormationService?.analyze?.(reference) || { ready: false, bestWindow: null, minutes: 0, activeDays: 0 };
      const types = recent.reduce((out, item) => { out[item.type] = Number(out[item.type] || 0) + 1; return out; }, {});
      const preferredType = Object.entries(types).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
      const averageMinutes = recent.length ? Math.max(1, Math.round(recent.reduce((sum, item) => sum + Number(item.minutes || 0), 0) / recent.length)) : 0;
      const dates = recent.map((item) => time(item.at)).filter(Boolean).sort((a, b) => a - b); const spanDays = dates.length > 1 ? Math.floor((dates.at(-1) - dates[0]) / 86400000) + 1 : 0;
      const evidenceReady = recent.length >= 5 && spanDays >= 14;
      return { ...base, evidenceReady, spanDays, eventCount: recent.length, preferredType, averageMinutes, insight: evidenceReady && base.bestWindow ? `Bạn thường hoàn thành tốt hoạt động vào ${base.bestWindow}.` : 'Cần ít nhất 14 ngày có dữ liệu để đề xuất khung giờ đáng tin cậy.' };
    },
    preference() { return readStore().reminder; },
    updateReminder(input = {}) { const reminder = { enabled: Boolean(input.enabled), hour: Math.max(0, Math.min(23, Number(input.hour) || 20)), updatedAt: now() }; updateStore((value) => ({ ...value, reminder })); return reminder; }
  };

  const DelightFocusSessionService = {
    durations: [5, 15, 30],
    build(minutes = 15) {
      const selected = this.durations.includes(Number(minutes)) ? Number(minutes) : 15; const template = runtime.content?.focusTemplates?.[selected] || [];
      const profile = LearnerProfileService?.get?.() || {}; const due = global.VocabularyService?.dueCards?.().length || srs().filter((item) => item.nextReview && time(item.nextReview) <= Date.now()).length; const errors = global.ErrorNotebookService?.top?.(20)?.filter((item) => !item.resolved).length || 0;
      const tasks = template.map((item, index) => ({ id: `delight-${selected}-${index}`, type: item.type, minutes: item.minutes, completed: false, title: item.type === 'srs' ? `Ôn ${Math.min(Math.max(due, 5), 15)} từ SRS` : item.type === 'weakness' ? (errors ? `Sửa ${Math.min(errors, 3)} lỗi gần đây` : `Củng cố ${profile.weakSkills?.[0] || 'từ vựng yếu'}`) : item.label }));
      return { targetMinutes: selected, tasks, source: 'product-delight', engine: 'existing-focus-session' };
    },
    start(minutes = 15) {
      if (!global.FocusSessionService?.start) return null;
      const plan = this.build(minutes); const session = global.FocusSessionService.start(plan.targetMinutes); session.tasks = plan.tasks; session.currentTask = 0; session.source = plan.source; session.engine = plan.engine; global.FocusSessionService.save(session);
      global.UserResearchService?.track?.('feature_used', { feature: 'focus_session', durationBucket: `${plan.targetMinutes}m` }); return session;
    }
  };

  const DelightReturnLoopService = {
    recommend() {
      const lesson = Object.entries(progress().lessonProgress || {}).filter(([, value]) => value && !value.completed && (Number(value.progress || value.percent || 0) > 0 || value.status === 'in_progress')).sort((a, b) => time(b[1].updatedAt) - time(a[1].updatedAt))[0];
      if (lesson) return { type: 'lesson', title: 'Tiếp tục bài đang học', reason: `Tiến trình ${clean(lesson[0], 80)} vẫn được giữ nguyên.`, route: 'lessons' };
      const error = global.ErrorNotebookService?.top?.(10)?.find((item) => !item.resolved);
      if (error) return { type: 'error', title: 'Sửa một lỗi gần đây', reason: clean(error.mistake || error.question, 120), route: 'error-notebook' };
      const goal = global.GoalTrackingService?.getGoal?.(); const goalProgress = goal ? Number(global.GoalTrackingService?.progress?.(goal) || 0) : 0;
      if (goal && goalProgress >= 70) return { type: 'goal', title: `Bạn đang gần mục tiêu TOPIK ${goal.targetLevel || ''}`.trim(), reason: `Đã có ${goalProgress}% bằng chứng tiến độ.`, route: 'goal-milestones' };
      const mission = global.RealKoreanMissionService?.recommended?.();
      if (mission) return { type: 'mission', title: `Thử tình huống: ${mission.title}`, reason: 'Một nhiệm vụ ngắn để dùng kiến thức đã học.', route: 'real-korean-missions' };
      return { type: 'short', title: 'Bắt đầu phiên 5 phút', reason: 'Một bước nhỏ vẫn giữ được nhịp học.', route: 'delight-focus-session' };
    }
  };

  const DelightOfflinePackService = {
    catalog() { return global.OfflinePackService?.catalog?.() || []; },
    summary() { const catalog = this.catalog(); const metadata = global.OfflinePackService?.metadata?.() || []; return { total: catalog.length, downloaded: metadata.length, packs: catalog.map((pack) => ({ ...pack, status: global.OfflinePackService.status(pack) })) }; },
    storageEstimate: async () => global.navigator?.storage?.estimate?.() || null
  };
  const CultureContextLayerService = { all: () => runtime.content?.culture || [], get: (cultureId) => (runtime.content?.culture || []).find((item) => item.id === cultureId) || null };
  const CareerKoreanJourneyService = {
    all: () => runtime.content?.careerPaths || [],
    current() { return this.all().find((item) => item.id === readStore().careerPath) || this.all()[0] || null; },
    select(pathId) { const selected = this.all().find((item) => item.id === pathId); if (!selected) return null; updateStore((value) => ({ ...value, careerPath: selected.id })); return selected; }
  };

  const DelightFeedbackService = {
    all: () => readStore().feedback,
    due(reference = new Date()) { const days = ageDays(reference); const answered = new Set(this.all().map((item) => item.promptId)); return (runtime.content?.feedbackPrompts || []).filter((item) => days >= item.minimumDays && !answered.has(item.id)).sort((a, b) => b.minimumDays - a.minimumDays)[0] || null; },
    submit(input = {}) {
      const category = ['rating', 'comment', 'feature_request', 'learning_problem'].includes(input.category) ? input.category : 'comment'; const comment = clean(input.comment, 1000); const rating = input.rating ? Math.max(1, Math.min(5, Number(input.rating) || 0)) : null; if (!comment && !rating) return null;
      const record = { id: id('delight-feedback'), promptId: clean(input.promptId || 'manual', 80), category, rating, comment, createdAt: now(), updatedAt: now() };
      updateStore((value) => ({ ...value, feedback: [record, ...value.feedback].slice(0, 100) }));
      const type = category === 'rating' ? 'lesson_rating' : category === 'feature_request' ? 'feature_suggestion' : 'issue_report';
      global.UserResearchService?.submitFeedback?.({ type, targetId: `p74:${record.promptId}:${category}`, rating, message: comment || `Đánh giá ${rating}/5` }); return record;
    }
  };

  const DelightAnalyticsService = {
    track(feature, properties = {}) { return global.UserResearchService?.track?.('feature_used', { feature: clean(feature, 80), ...properties }); },
    snapshot(reference = new Date()) {
      const research = global.UserResearchService?.all?.() || { consent: 'unknown', events: [] }; const events = Array.isArray(research.events) ? research.events : []; const days = ageDays(reference); const event = (name) => events.filter((item) => item.event === name); const activeDates = new Set(events.map((item) => String(item.createdAt || '').slice(0, 10)).filter(Boolean));
      return { consent: research.consent || 'unknown', activation: Boolean(event('lesson_completed').length || completedLessons()), day7Retention: days < 7 ? null : activeDates.size >= 2, day30Retention: days < 30 ? null : activeDates.size >= 3, featureUsage: global.UserResearchService?.featureUsage?.() || {}, learningCompletion: event('lesson_completed').length || completedLessons(), sensitiveDataCollected: false };
    },
    experiment() { return global.ExperimentService?.assignment?.('home_layout') || null; }
  };

  const esc = (value) => escapeHtml(value == null ? '' : String(value));
  const heading = (back, eyebrow, title, subtitle) => `<section class="p74-heading section"><button class="back-link" data-view="${back}">← Quay lại</button><p class="eyebrow">${esc(eyebrow)}</p><h1 class="headline">${esc(title)}</h1><p>${esc(subtitle)}</p></section>`;
  const loading = () => `<section class="empty-state section"><h2>Đang chuẩn bị người bạn đồng hành…</h2><p>${esc(runtime.error || 'Nội dung chỉ tải khi bạn mở trải nghiệm P74.')}</p></section>`;
  function companionMarkup(companion = LearningCompanionService.summary()) { return `<section class="p74-companion section"><div class="p74-companion-mark" aria-hidden="true">TH</div><div><small>${esc(companion.name)} · ${esc(companion.personality)}</small><h2>${esc(companion.greeting)}</h2>${companion.evidence.length ? `<ul>${companion.evidence.slice(0, 4).map((item) => `<li>✓ ${esc(item)}</li>`).join('')}</ul>` : '<p>Tiến bộ sẽ xuất hiện ở đây khi có bằng chứng học thật.</p>'}<p>${esc(companion.milestoneResponse || companion.encouragement)}</p></div></section>`; }
  function hubView() {
    if (!runtime.content) return loading(); const next = DelightReturnLoopService.recommend(); const habit = HabitIntelligenceService.analyze(); const celebration = DelightCelebrationService.pending(); const packs = DelightOfflinePackService.summary(); const feedback = DelightFeedbackService.due();
    return `${heading('home', 'P74 · PRODUCT DELIGHT', 'Một người bạn đồng hành lâu dài', 'Động lực đến từ tiến bộ thật, không từ áp lực hay game hóa.')}${companionMarkup()}
      ${celebration ? `<section class="p74-celebration-callout section"><span>🎉</span><div><small>MỐC MỚI CÓ BẰNG CHỨNG</small><h2>${esc(celebration.title)}</h2><p>Bước tiếp theo: ${esc(celebration.next)}</p></div><button class="btn primary" data-p74-celebration="${esc(celebration.id)}">Xem thành quả</button></section>` : ''}
      <section class="p74-next section"><div><small>TIẾP TỤC HÀNH TRÌNH</small><h2>${esc(next.title)}</h2><p>${esc(next.reason)}</p></div><button class="btn primary" data-view="${esc(next.route)}">Học tiếp</button></section>
      <section class="p74-directory section"><button data-view="learning-celebrations"><b>Thành quả học tập</b><span>${DelightCelebrationService.all().filter((item) => item.unlocked).length}/7 mốc có bằng chứng</span></button><button data-view="habit-intelligence"><b>Nhịp học của tôi</b><span>${habit.evidenceReady ? habit.insight : 'Đang tích lũy dữ liệu'}</span></button><button data-view="delight-focus-session"><b>Focus Session</b><span>5 · 15 · 30 phút</span></button><button data-view="offline-packs"><b>Học ngoại tuyến</b><span>${packs.downloaded}/${packs.total || 5} gói đã tải</span></button><button data-view="culture-context"><b>Văn hóa trong câu nói</b><span>6 bối cảnh đời thật</span></button><button data-view="career-journey"><b>Tiếng Hàn theo mục tiêu</b><span>Du học · Công việc · Kinh doanh · Sinh sống</span></button><button data-view="delight-feedback"><b>Góp ý trải nghiệm</b><span>${feedback ? feedback.question : 'Bạn chủ động gửi khi cần'}</span></button><button data-view="delight-analytics"><b>Dữ liệu cải thiện sản phẩm</b><span>Consent · Analytics · A/B test</span></button></section>`;
  }
  const companionView = () => `${heading('product-delight', 'LEARNING COMPANION', 'TamHoanq đồng hành cùng bạn', 'Không phải chatbot và không thay thế Trợ lý học tập.')}${companionMarkup()}<section class="p74-principles section">${LearningCompanionService.profile().principles?.map((item) => `<p>✓ ${esc(item)}</p>`).join('') || ''}</section>`;
  function celebrationsView() { const items = DelightCelebrationService.all(); return `${heading('product-delight', 'LEARNING CELEBRATION', 'Thành quả nói lên điều bạn làm được', 'Mỗi mốc cần evidence; XP không thể mở khóa.')}${runtime.celebrationId ? '' : ''}<section class="p74-celebrations section">${items.map((item) => `<article class="${item.unlocked ? 'unlocked' : 'locked'}"><span>${item.unlocked ? '🎉' : '○'}</span><div><small>${item.unlocked ? esc(`${item.evidence.source} · ${item.evidence.value}`) : 'Chưa đủ bằng chứng'}</small><h2>${esc(item.title)}</h2><p>${item.canDo.map((value) => `✓ ${esc(value)}`).join('<br>')}</p><b>Bước tiếp theo: ${esc(item.next)}</b></div>${item.unlocked && !item.acknowledgedAt ? `<button class="btn secondary" data-p74-ack="${esc(item.id)}">Ghi nhận</button>` : ''}</article>`).join('')}</section>`; }
  function habitView() { const habit = HabitIntelligenceService.analyze(); const reminder = HabitIntelligenceService.preference(); return `${heading('product-delight', 'LEARNING HABIT INTELLIGENCE', 'Học vào nhịp phù hợp với bạn', 'Phân tích từ hoạt động học thật; không tự gửi thông báo.')}
    <section class="p74-habit section"><article><small>KHUNG GIỜ HIỆU QUẢ</small><h2>${esc(habit.evidenceReady ? habit.bestWindow || 'Chưa xác định' : 'Đang tích lũy')}</h2><p>${esc(habit.insight)}</p></article><article><small>LOẠI BÀI THƯỜNG HỌC</small><h2>${esc(habit.preferredType || 'Chưa đủ dữ liệu')}</h2><p>${habit.averageMinutes ? `Trung bình ${habit.averageMinutes} phút/hoạt động.` : 'Hoàn thành thêm hoạt động để tạo phân tích.'}</p></article></section>
    <form id="p74ReminderForm" class="p74-reminder section"><label><input type="checkbox" name="enabled" ${reminder.enabled ? 'checked' : ''}> Tôi muốn dùng gợi ý giờ học</label><label>Giờ mong muốn<input type="number" name="hour" min="0" max="23" value="${reminder.hour}"></label><p>App chỉ lưu lựa chọn. Không tự bật notification và không gửi quá mức bạn cho phép.</p><button class="btn primary">Lưu lựa chọn</button></form>`; }
  function focusView() { const plan = DelightFocusSessionService.build(runtime.focusMinutes); return `${heading('product-delight', 'FOCUS SESSION', 'Một phiên học, một mục tiêu rõ ràng', 'Tái sử dụng SRS, Adaptive, Error Notebook và Focus Session hiện có.')}
    <nav class="p74-duration section">${DelightFocusSessionService.durations.map((minutes) => `<button class="${minutes === runtime.focusMinutes ? 'active' : ''}" data-p74-minutes="${minutes}"><b>${minutes}</b><span>phút</span></button>`).join('')}</nav>
    <ol class="p74-focus-plan section">${plan.tasks.map((task) => `<li><span>${task.minutes}</span><div><small>${esc(task.type)}</small><b>${esc(task.title)}</b></div></li>`).join('')}</ol><button class="btn primary full section" data-p74-start-focus="${plan.targetMinutes}">Bắt đầu phiên ${plan.targetMinutes} phút</button>`; }
  function cultureView() { return `${heading('product-delight', 'KOREAN CULTURE LAYER', 'Tại sao người Hàn nói như vậy?', 'Hiểu bối cảnh, quan hệ và sắc thái thay vì chỉ dịch nghĩa.')}<section class="p74-culture section">${CultureContextLayerService.all().map((item) => `<article><small>${esc(item.category)}</small><h2 lang="ko">${esc(item.korean)}</h2><b>${esc(item.meaning)}</b><p>${esc(item.why)}</p><em>Dùng khi: ${esc(item.when)}</em><button class="btn secondary" data-view="${esc(item.route)}">Luyện trong ngữ cảnh</button></article>`).join('')}</section>`; }
  function careerView() { const current = CareerKoreanJourneyService.current(); return `${heading('product-delight', 'CAREER KOREAN JOURNEY', 'Tiếng Hàn phục vụ mục tiêu thật', 'Một lớp định hướng trên các module nghề nghiệp và đời sống hiện có.')}<nav class="p74-career-tabs section">${CareerKoreanJourneyService.all().map((path) => `<button class="${current?.id === path.id ? 'active' : ''}" data-p74-career="${esc(path.id)}">${esc(path.title)}</button>`).join('')}</nav>${current ? `<section class="p74-career-current section"><small>${esc(current.title)}</small><h2>${esc(current.description)}</h2><div>${current.modules.map((item) => `<span>${esc(item)}</span>`).join('')}</div><button class="btn primary" data-view="${esc(current.route)}">Mở lộ trình</button></section>` : ''}`; }
  function feedbackView() { const due = DelightFeedbackService.due(); return `${heading('product-delight', 'USER FEEDBACK LOOP', 'Bạn chủ động góp ý khi thấy phù hợp', 'Không popup liên tục; nội dung phản hồi không đi vào analytics hành vi.')}<form id="p74FeedbackForm" class="p74-feedback section"><input type="hidden" name="promptId" value="${esc(due?.id || 'manual')}"><h2>${esc(due?.question || 'Bạn muốn TamHoanq cải thiện điều gì?')}</h2><label>Loại phản hồi<select name="category"><option value="rating">Rating</option><option value="comment">Comment</option><option value="feature_request">Feature request</option><option value="learning_problem">Learning problem</option></select></label><label>Đánh giá (không bắt buộc)<select name="rating"><option value="">—</option>${[1, 2, 3, 4, 5].map((value) => `<option value="${value}">${value}/5</option>`).join('')}</select></label><label class="wide">Nội dung<textarea name="comment" maxlength="1000" rows="5" placeholder="Không nhập password, token hoặc dữ liệu nhạy cảm."></textarea></label><button class="btn primary wide">Gửi góp ý</button></form>`; }
  function analyticsView() { const value = DelightAnalyticsService.snapshot(); const experiment = DelightAnalyticsService.experiment(); return `${heading('product-delight', 'PRIVACY-FIRST PRODUCT ANALYTICS', 'Đo cải thiện mà không theo dõi quá mức', 'Chỉ dùng sự kiện học tối thiểu khi người dùng đồng ý.')}<section class="p74-analytics section"><article><small>Activation</small><b>${value.activation ? 'Có bằng chứng' : 'Chưa đủ'}</b></article><article><small>Day 7 retention</small><b>${value.day7Retention === null ? 'Chưa đến ngày 7' : value.day7Retention ? 'Có bằng chứng' : 'Chưa đủ'}</b></article><article><small>Day 30 retention</small><b>${value.day30Retention === null ? 'Chưa đến ngày 30' : value.day30Retention ? 'Có bằng chứng' : 'Chưa đủ'}</b></article><article><small>Learning completion</small><b>${value.learningCompletion}</b></article></section><section class="p74-privacy section"><h2>Quyền riêng tư</h2><p>Consent: <b>${esc(value.consent)}</b> · Sensitive data collected: <b>không</b></p><p>Không thu password, token, private content hoặc thông tin ngoài app.</p><button class="btn secondary" data-view="profile">Quản lý consent trong Hồ sơ</button></section><section class="p74-experiment section"><small>A/B TEST FOUNDATION</small><h2>Home layout · ${esc(experiment?.variant || 'chưa phân nhóm')}</h2><p>Assignment ổn định theo user; outcome chỉ ghi khi consent được bật.</p></section>`; }

  Object.assign(global, { ProductDelightContentService, LearningCompanionService, DelightCelebrationService, HabitIntelligenceService, DelightFocusSessionService, DelightReturnLoopService, DelightOfflinePackService, CultureContextLayerService, CareerKoreanJourneyService, DelightFeedbackService, DelightAnalyticsService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'product-delight': hubView, 'learning-companion': companionView, 'learning-celebrations': celebrationsView, 'habit-intelligence': habitView, 'delight-focus-session': focusView, 'culture-context': cultureView, 'career-journey': careerView, 'delight-feedback': feedbackView, 'delight-analytics': analyticsView };

  function decorateHome() {
    if (state.currentView !== 'home' || !state.currentUser || !runtime.content) return;
    const card = global.document?.querySelector?.('[data-p73c-home]'); if (!card || card.dataset.p74Home) return;
    const companion = LearningCompanionService.summary(); const next = DelightReturnLoopService.recommend(); card.dataset.p74Home = 'true'; card.classList.add('p74-home-companion');
    card.innerHTML = `<div class="p74-home-avatar" aria-hidden="true">TH</div><div><small>${esc(companion.name)} · BẠN ĐỒNG HÀNH</small><h2>${esc(companion.greeting)}</h2><p>${esc(companion.evidence[0] ? `Bạn đã ${companion.evidence[0]}. ${next.reason}` : next.reason)}</p></div><div class="p74-home-actions"><button class="btn primary" data-p74-return="${esc(next.route)}">Học tiếp</button><button class="text-link" data-p74-hub>Hành trình của tôi</button></div>`;
    card.querySelector('[data-p74-return]')?.addEventListener('click', (event) => { DelightAnalyticsService.track('smart_return', { route: event.currentTarget.dataset.p74Return }); setView(event.currentTarget.dataset.p74Return); });
    card.querySelector('[data-p74-hub]')?.addEventListener('click', () => { LearningCompanionService.opened(); setView('product-delight'); });
  }
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (ROUTES.has(state.currentView) || state.currentView === 'home') ProductDelightContentService.load();
    if (state.currentView === 'home') global.setTimeout?.(decorateHome, 0);
    global.document?.querySelectorAll?.('[data-p74-celebration]').forEach((button) => { button.onclick = () => { runtime.celebrationId = button.dataset.p74Celebration; setView('learning-celebrations'); }; });
    global.document?.querySelectorAll?.('[data-p74-ack]').forEach((button) => { button.onclick = () => { DelightCelebrationService.acknowledge(button.dataset.p74Ack); toast('Đã ghi nhận thành quả của bạn.'); render(); }; });
    const reminder = global.document?.getElementById?.('p74ReminderForm'); if (reminder) reminder.onsubmit = (event) => { event.preventDefault(); const form = new FormData(reminder); HabitIntelligenceService.updateReminder({ enabled: form.get('enabled') === 'on', hour: form.get('hour') }); toast('Đã lưu quyền kiểm soát giờ học.'); render(); };
    global.document?.querySelectorAll?.('[data-p74-minutes]').forEach((button) => { button.onclick = () => { runtime.focusMinutes = Number(button.dataset.p74Minutes); render(); }; });
    global.document?.querySelector?.('[data-p74-start-focus]')?.addEventListener('click', (event) => { const session = DelightFocusSessionService.start(Number(event.currentTarget.dataset.p74StartFocus)); if (!session) return toast('Focus Session chưa sẵn sàng.'); setView('focus-study'); });
    global.document?.querySelectorAll?.('[data-p74-career]').forEach((button) => { button.onclick = () => { CareerKoreanJourneyService.select(button.dataset.p74Career); render(); }; });
    const feedback = global.document?.getElementById?.('p74FeedbackForm'); if (feedback) feedback.onsubmit = (event) => { event.preventDefault(); const form = new FormData(feedback); const saved = DelightFeedbackService.submit({ promptId: form.get('promptId'), category: form.get('category'), rating: form.get('rating'), comment: form.get('comment') }); if (!saved) return toast('Hãy chọn rating hoặc nhập nội dung góp ý.'); toast('Cảm ơn bạn đã góp ý.'); feedback.reset(); render(); };
  };
  if (global.document?.getElementById?.('app')) global.setTimeout?.(() => global.KLEARN_AFTER_RENDER?.(), 0);
})(window);
