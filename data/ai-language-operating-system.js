/* Tiếng Hàn - TamHoanq · P60 AI Language Operating System */
(function buildAILanguageOperatingSystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app || global.AILanguageOperatingSystem) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService, LearnerProfileService, PracticeService, VocabularyService, getUserProgress, setView, render, toast, escapeHtml, PrivacyPreferenceService } = app;
  const STORE_KEY = STORAGE_KEYS.aiLanguageOs || 'klearn_ai_language_os';
  const routes = new Set(['ai-language-os']);
  const runtime = state.aiLanguageOsRuntime || (state.aiLanguageOsRuntime = { content: null, loading: false, error: '' });
  const list = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = (value, limit = 800) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit);
  const clamp = (value, minimum = 0, maximum = 100) => Math.max(minimum, Math.min(maximum, Number(value) || 0));
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const esc = (value) => escapeHtml ? escapeHtml(value) : clean(value, 500);
  const localize = (value) => value && typeof value === 'object' && !Array.isArray(value) ? (value.vi || value.en || Object.values(value)[0] || '') : clean(value, 500);
  const defaultContract = {
    id: 'p60-ai-language-operating-system', version: '1.0.0', architectureVersion: 'p60-v1', verified: true, reviewStatus: 'approved', implementationMode: 'human-guided-ai-orchestration',
    supportedLanguages: [{ id: 'ko', label: '한국어', contentStatus: 'active' }, { id: 'ja', label: '日本語', contentStatus: 'foundation' }, { id: 'zh', label: '中文', contentStatus: 'foundation' }, { id: 'en', label: 'English', contentStatus: 'foundation' }],
    capabilities: ['memory', 'planner', 'advisor', 'curator', 'prediction', 'multilingual', 'hybrid', 'privacy', 'improvement', 'assistant'].map((id) => ({ id })),
    memory: { allowedFields: ['level', 'goal', 'weakSkills', 'frequentErrors', 'learningStyle', 'preferredExplanation', 'targetLanguage'], explicitConfirmationRequired: true, maximumErrors: 8, maximumWeakSkills: 6 },
    curation: { approvedOnly: true, maximumItems: 5, generatedPracticeRequiresReview: true, fabricatedCurriculumAllowed: false },
    prediction: { maximumProbability: 95, minimumEvidenceSessions: 3, guaranteesOutcome: false, disclaimer: 'Dự đoán chỉ là ước tính từ dữ liệu học hiện có, không bảo đảm kết quả thi hoặc nghề nghiệp.' },
    hybrid: { teacherCanOverride: true, humanApprovalRequiredForPublishing: true, aiReplacesTeacher: false, learnerControlsGoal: true },
    privacy: { requiresAiUsageConsent: true, storesRawPrompt: false, storesRawResponse: false, storesRawAudio: false, continuousImprovementData: 'aggregate-metadata-only' },
    orchestration: { maximumPrimaryAgents: 1, maximumRetries: 0, qualityControllerAlwaysRuns: true, deterministicFallback: true }
  };

  const AILanguageOSContractService = {
    validate(value) {
      const ids = list(value?.capabilities).map((item) => item.id).sort().join(',');
      const languages = list(value?.supportedLanguages).map((item) => item.id).sort().join(',');
      return value?.verified === true && value.reviewStatus === 'approved' && value.architectureVersion === 'p60-v1' && ids === 'advisor,assistant,curator,hybrid,improvement,memory,multilingual,planner,prediction,privacy' && languages === 'en,ja,ko,zh' && value.hybrid?.aiReplacesTeacher === false && value.privacy?.storesRawPrompt === false && value.privacy?.storesRawResponse === false && value.orchestration?.maximumPrimaryAgents === 1 && value.orchestration?.maximumRetries === 0;
    },
    hydrate(value) { if (!this.validate(value)) throw new Error('AI Language OS contract quality gate failed'); runtime.content = value; runtime.error = ''; global.KLEARN_AI_LANGUAGE_OS = value; return value; },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') return this.hydrate(defaultContract);
      runtime.loading = global.fetch('./content/ai-language-operating-system.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`AI Language OS ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 160); return this.hydrate(defaultContract); }).finally(() => { runtime.loading = false; if (routes.has(state.currentView)) render?.(); });
      return runtime.loading;
    },
    get() { return runtime.content || defaultContract; },
    version() { return this.get().architectureVersion; }
  };

  const AIPrivacyFirstService = {
    allowed() { return PrivacyPreferenceService?.allows?.('aiUsage') !== false; },
    status() {
      const policy = AILanguageOSContractService.get().privacy;
      return { aiEnabled: this.allowed(), explicitConsent: policy.requiresAiUsageConsent === true, rawPromptStored: false, rawResponseStored: false, rawAudioStored: false, improvementData: policy.continuousImprovementData, userControlled: true };
    },
    disabledResult() { return { status: 'disabled', fallback: true, reason: 'AI_DISABLED_BY_USER', reply: 'Bạn đã tắt AI. Kế hoạch và nội dung học có sẵn vẫn hoạt động bình thường.' }; }
  };

  const activeLanguage = () => global.LanguageProfileService?.active?.() || global.AILearningMemoryService?.snapshot?.()?.targetLanguage || 'ko';
  const learnerProfile = () => object(LearnerProfileService?.get?.() || {});
  const progress = () => object(getUserProgress?.() || {});
  const errors = () => list(global.ErrorNotebookService?.top?.(30)).filter((item) => !item.resolved && (item.languageId || 'ko') === activeLanguage()).map((item) => clean(item.topic || item.pattern || item.title || item.id, 100)).filter(Boolean);
  const dueCount = () => {
    const languageId = activeLanguage(); const cards = VocabularyService?.dueCards?.();
    if (Array.isArray(cards)) return cards.filter((item) => (item.languageId || 'ko') === languageId).length;
    return languageId === 'ko' ? Number(learnerProfile().dueSrsCount || progress().dueSrsCount || 0) : 0;
  };

  const PersonalLanguageMemoryService = {
    allowedFields() { return [...AILanguageOSContractService.get().memory.allowedFields]; },
    snapshot() {
      const profile = learnerProfile(); const companion = object(global.AILearningMemoryService?.snapshot?.() || {}); const languageId = activeLanguage(); const languageProfile = object(global.LanguageProfileService?.getLanguage?.(languageId) || {});
      return {
        level: clean(languageProfile.currentLevel || companion.level || profile.currentTopikLevel || state.currentUser?.level || 'beginner', 60),
        goal: clean(languageProfile.targetLevel || companion.goal || profile.goal || profile.learningGoal || state.currentUser?.goalLabel || '', 160),
        weakSkills: list(companion.weakSkills || profile.weakSkills || profile.weakSkill).map((item) => clean(item, 80)).filter(Boolean).slice(0, 6),
        frequentErrors: [...new Set([...list(companion.frequentErrors), ...list(profile.frequentErrors), ...errors()])].map((item) => clean(item, 100)).filter(Boolean).slice(0, 8),
        learningStyle: clean(companion.learningStyle || profile.learningStyle || 'chưa xác định', 60),
        preferredExplanation: clean(companion.preferredExplanation || profile.explanationStyle || 'từng bước', 80),
        targetLanguage: languageId,
        updatedAt: companion.updatedAt || null,
        sources: ['learner-profile', 'language-profile', 'error-notebook'],
        containsRawConversation: false
      };
    },
    update(changes = {}, options = {}) {
      if (options.confirmed !== true) return { status: 'confirmation-required', updated: false, memory: this.snapshot() };
      const allowed = new Set(this.allowedFields()); const safe = Object.fromEntries(Object.entries(object(changes)).filter(([key]) => allowed.has(key)));
      if (safe.weakSkills) safe.weakSkills = list(safe.weakSkills).map((item) => clean(item, 80)).filter(Boolean).slice(0, 6);
      if (safe.frequentErrors) safe.frequentErrors = list(safe.frequentErrors).map((item) => clean(item, 100)).filter(Boolean).slice(0, 8);
      const targetLanguage = clean(safe.targetLanguage, 20).toLowerCase(); delete safe.targetLanguage;
      const memory = global.AILearningMemoryService?.remember?.(safe) || { ...this.snapshot(), ...safe };
      if (targetLanguage && global.LanguageCoreService?.supported?.(targetLanguage)) global.LanguageProfileService?.setActive?.(targetLanguage);
      return { status: 'updated', updated: true, memory: { ...memory, targetLanguage: targetLanguage || this.snapshot().targetLanguage } };
    }
  };

  const routeByType = (type) => ({ srs: 'review', review: 'review', grammar: 'grammar-compare', listening: 'listening-studio', speaking: 'speaking-hub', lesson: state.currentUser?.learningTrack === 'foundation' ? 'foundation' : 'lessons', skill: 'practice', repair: 'error-notebook', quick: 'quick-practice' })[type] || 'lessons';
  const fallbackPlan = (minutes = 20) => {
    const memory = PersonalLanguageMemoryService.snapshot(); const duration = Math.max(5, Math.min(60, Number(minutes) || 20)); const due = dueCount(); const weak = memory.weakSkills[0] || 'listening'; const tasks = [];
    if (duration <= 5) return { minutes: 5, tasks: [{ id: due ? 'alos-review' : 'alos-continue', type: due ? 'srs' : 'lesson', route: due ? 'review' : routeByType('lesson'), minutes: 5, title: due ? `Ôn ${Math.min(5, due)} mục đến hạn` : 'Tiếp tục bài học phù hợp', reason: due ? 'Dựa trên hàng đợi SRS.' : 'Duy trì tiến độ theo mục tiêu hiện tại.' }], goal: memory.goal, languageId: memory.targetLanguage, generatedBy: 'deterministic-learning-signals', evidence: { dueSrsCount: due, weakSkill: weak, learningStyle: memory.learningStyle }, aiEnhanced: false };
    if (due) tasks.push({ id: 'alos-review', type: 'srs', route: 'review', minutes: Math.min(10, Math.max(5, Math.round(duration * .35))), title: `Ôn ${Math.min(15, due)} mục đến hạn`, reason: 'Dựa trên hàng đợi SRS.' });
    tasks.push({ id: 'alos-weak-skill', type: weak, route: routeByType(weak), minutes: Math.min(15, Math.max(5, Math.round(duration * .4))), title: `Củng cố ${weak}`, reason: 'Dựa trên kỹ năng cần cải thiện.' });
    tasks.push({ id: 'alos-continue', type: 'lesson', route: routeByType('lesson'), minutes: Math.max(5, duration - tasks.reduce((sum, item) => sum + item.minutes, 0)), title: 'Tiếp tục bài học phù hợp', reason: 'Duy trì tiến độ theo mục tiêu hiện tại.' });
    return { minutes: tasks.reduce((sum, item) => sum + item.minutes, 0), tasks: tasks.slice(0, 3), goal: memory.goal, languageId: memory.targetLanguage, generatedBy: 'deterministic-learning-signals', evidence: { dueSrsCount: due, weakSkill: weak, learningStyle: memory.learningStyle }, aiEnhanced: false };
  };

  const AIStudyPlannerOSService = {
    create(options = {}) {
      const duration = Math.max(5, Math.min(60, Number(options.minutes || state.currentUser?.studyMinutesPerDay || 20)));
      const daily = global.DailyPlanService?.build?.(duration); const baseline = daily?.tasks?.length ? { minutes: daily.minutes, tasks: daily.tasks.map((item, index) => ({ ...item, id: item.id || `alos-task-${index}`, route: item.route || routeByType(item.type), reason: item.reason || 'Dựa trên tiến độ học hiện tại.' })), goal: PersonalLanguageMemoryService.snapshot().goal, languageId: activeLanguage(), generatedBy: 'daily-plan-service', evidence: { dueSrsCount: dueCount(), weakSkill: PersonalLanguageMemoryService.snapshot().weakSkills[0] || null }, aiEnhanced: false } : fallbackPlan(duration);
      return baseline;
    },
    async explain(options = {}) {
      const plan = this.create(options);
      if (!AIPrivacyFirstService.allowed()) return { ...plan, explanation: AIPrivacyFirstService.disabledResult().reply, fallback: true };
      const orchestrator = global.LearningAgentOrchestratorService;
      if (!orchestrator?.dispatch) return { ...plan, explanation: 'Kế hoạch được tạo từ SRS, kỹ năng yếu và mục tiêu hiện tại.', fallback: true };
      const response = await orchestrator.dispatch({ intent: 'today', payload: { enhance: true, dueSrsCount: plan.evidence.dueSrsCount }, context: { recommendations: plan.tasks.map(({ title, minutes, type }) => ({ title, minutes, type })), currentView: state.currentView } });
      const explanation = clean(response.result?.reply || response.result?.ai || 'Kế hoạch được tạo từ tiến độ học hiện tại.', 1200);
      ContinuousAIImprovementService.record({ capability: 'planner', status: response.status, qualityScore: response.quality?.score, fallback: response.result?.fallback });
      return { ...plan, aiEnhanced: !response.result?.fallback, explanation, quality: response.quality, fallback: Boolean(response.result?.fallback) };
    }
  };

  const AILearningAdvisorOSService = {
    recommend(options = {}) {
      const plan = AIStudyPlannerOSService.create(options); const first = plan.tasks[0];
      return { nextAction: first?.title || 'Tiếp tục bài học', route: first?.route || 'lessons', reason: first?.reason || 'Duy trì tiến độ hiện tại.', evidence: plan.evidence, languageId: plan.languageId, generatedBy: plan.generatedBy };
    },
    explain(options = {}) { return AIStudyPlannerOSService.explain(options); }
  };

  const AIContentCuratorOSService = {
    approvedItems() {
      if (global.AdvancedContentService?.publicItems) return list(global.AdvancedContentService.publicItems()).filter((item) => item.status === 'approved');
      return list(global.KLEARN_THEORY_LESSONS).filter((item) => item.verified === true && ['approved', 'published'].includes(String(item.reviewStatus || item.status || '').toLowerCase()));
    },
    select(limit = AILanguageOSContractService.get().curation.maximumItems) {
      const memory = PersonalLanguageMemoryService.snapshot(); const weak = memory.weakSkills[0] || ''; const safeLimit = Math.max(1, Math.min(5, Number(limit) || 3));
      return this.approvedItems().filter((item) => (item.languageId || 'ko') === memory.targetLanguage).map((item) => ({ item, score: (item.skill === weak ? 30 : 0) + (String(item.level || item.difficulty).toLowerCase() === String(memory.level).toLowerCase() ? 20 : 0) + clamp(global.AdvancedContentService?.quality?.(item) || 80, 0, 100) / 10 })).sort((a, b) => b.score - a.score).slice(0, safeLimit).map(({ item }) => ({ id: clean(item.id, 120), type: clean(item.type || 'lesson', 30), title: clean(localize(item.title) || item.korean || item.id, 180), level: clean(item.level || item.difficulty || '', 50), skill: clean(item.skill || '', 50), status: 'approved', reason: item.skill === weak ? `Phù hợp kỹ năng ${weak} cần củng cố.` : 'Nội dung đã duyệt phù hợp để học tiếp.', route: 'content-explorer' }));
    },
    policy() { return { approvedOnly: true, fabricatedCurriculumAllowed: false, generatedPracticeRequiresReview: true }; }
  };

  const AIProgressPredictionService = {
    forecast() {
      const languageId = activeLanguage(); const history = list(PracticeService?.getHistory?.()).filter((item) => (item.languageId || 'ko') === languageId); const recent = history.filter((item) => Date.now() - new Date(item.completedAt || item.createdAt || 0).getTime() <= 30 * 86400000); const profile = learnerProfile(); const scores = languageId === 'ko' ? Object.values(object(profile.skillScores || progress().skills)).map(Number).filter((value) => Number.isFinite(value) && value > 0) : []; const averageScore = scores.length ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0; const activeDays = new Set(recent.map((item) => clean(item.completedAt || item.createdAt, 10))).size; const minimum = Number(AILanguageOSContractService.get().prediction.minimumEvidenceSessions || 3); const enough = recent.length >= minimum || scores.length >= 3; const probability = enough ? Math.round(Math.min(Number(AILanguageOSContractService.get().prediction.maximumProbability || 95), 25 + averageScore * .55 + Math.min(20, activeDays * 2))) : null; const band = probability == null ? 'insufficient-data' : probability >= 75 ? 'on-track' : probability >= 50 ? 'possible-with-adjustment' : 'needs-foundation';
      return { goal: PersonalLanguageMemoryService.snapshot().goal || 'Mục tiêu học tập', probability, band, confidence: recent.length >= 10 ? 'medium' : 'low', evidence: { sessionsLast30Days: recent.length, activeDays, skillSamples: scores.length, averageSkillScore: scores.length ? Math.round(averageScore) : null }, generatedBy: 'bounded-personal-forecast', guaranteesOutcome: false, disclaimer: AILanguageOSContractService.get().prediction.disclaimer };
    }
  };

  const AIMultiLanguageSupportService = {
    matrix() {
      const active = activeLanguage(); const contract = AILanguageOSContractService.get(); const core = global.LanguageCoreService?.all?.(); const languages = list(core).length ? core : contract.supportedLanguages;
      return languages.map((item) => ({ id: item.id, label: clean(item.nativeName || item.label || item.id, 80), active: item.id === active, memoryReady: true, plannerReady: true, coachingReady: true, contentReady: (item.contentStatus || contract.supportedLanguages.find((value) => value.id === item.id)?.contentStatus) === 'active' }));
    },
    active: activeLanguage
  };

  const HumanAIHybridService = {
    policy() { return { ...AILanguageOSContractService.get().hybrid, aiRole: 'recommend-explain-practice-support', humanRole: 'set-goals-review-publish-override', finalAuthority: 'learner-or-authorized-teacher' }; },
    decision(result = {}) { return { ...result, advisoryOnly: true, teacherCanOverride: true, learnerCanReject: true, requiresHumanApproval: Boolean(result.generatedContent) }; }
  };

  const readOSState = () => object(userScoped(STORE_KEY)[0]);
  const writeOSState = (value) => { if (!uid()) return value; saveUserScoped(STORE_KEY, [value], 1); CloudSyncService?.schedule?.('ai-language-os-metadata'); return value; };
  const ContinuousAIImprovementService = {
    record(event = {}) {
      if (!uid()) return null; const item = { id: `alos-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, capability: clean(event.capability, 40), status: clean(event.status, 30), qualityScore: clamp(event.qualityScore, 0, 1), fallback: Boolean(event.fallback), useful: typeof event.useful === 'boolean' ? event.useful : null, createdAt: now(), rawInputStored: false, rawResponseStored: false };
      const current = readOSState(); writeOSState({ version: 1, outcomes: [item, ...list(current.outcomes)].slice(0, 100), updatedAt: item.createdAt }); return item;
    },
    summary() {
      const events = list(readOSState().outcomes); const rated = events.filter((item) => typeof item.useful === 'boolean'); const audits = list(global.AIAgentAuditService?.all?.()); const metrics = object(global.AIOrchestrationService?.getMetrics?.() || {});
      return { events: events.length, rated: rated.length, usefulRate: rated.length ? Math.round(rated.filter((item) => item.useful).length / rated.length * 100) : null, qualityChecks: audits.length, requestCountToday: Number(metrics.requestCount || 0), dataMode: 'aggregate-metadata-only', rawInputStored: false, rawResponseStored: false };
    }
  };

  const GlobalLanguageAssistantOSService = {
    capabilities() { return [{ id: 'plan', route: 'daily-session' }, { id: 'review', route: 'review' }, { id: 'practice', route: 'practice' }, { id: 'coach', route: 'ai-coach' }, { id: 'content', route: 'content-explorer' }, { id: 'prediction', route: 'analytics' }]; },
    async run(action = 'plan', options = {}) {
      if (action === 'plan') return HumanAIHybridService.decision(await AIStudyPlannerOSService.explain(options));
      if (action === 'advisor') return HumanAIHybridService.decision(AILearningAdvisorOSService.recommend(options));
      if (action === 'curate') return HumanAIHybridService.decision({ items: AIContentCuratorOSService.select(options.limit) });
      if (action === 'predict') return HumanAIHybridService.decision(AIProgressPredictionService.forecast());
      return { status: 'clarification-required', allowedActions: ['plan', 'advisor', 'curate', 'predict'], advisoryOnly: true };
    }
  };

  const heading = () => `<section class="alos-heading section"><button class="back-btn" data-view="ai-coach" aria-label="Quay lại">←</button><div><small>P60 · AI LANGUAGE OPERATING SYSTEM</small><h1>Điều phối hành trình học của bạn</h1><p>Memory, kế hoạch, nội dung và dự báo dùng chung một hồ sơ — AI hỗ trợ, người học và giáo viên giữ quyền quyết định.</p></div></section>`;
  const memoryMarkup = (memory) => `<article class="alos-card"><header><div><small>PERSONAL MEMORY</small><h2>Hồ sơ đang được dùng</h2></div><span>${esc(memory.targetLanguage.toUpperCase())}</span></header><ul class="alos-memory-list"><li><span>Trình độ</span><b>${esc(memory.level)}</b></li><li><span>Mục tiêu</span><b>${esc(memory.goal || 'Chưa đặt')}</b></li><li><span>Kỹ năng yếu</span><b>${esc(memory.weakSkills.join(', ') || 'Chưa đủ dữ liệu')}</b></li><li><span>Lỗi thường gặp</span><b>${esc(memory.frequentErrors.join(', ') || 'Chưa có')}</b></li><li><span>Cách học</span><b>${esc(memory.learningStyle)}</b></li></ul><p class="subtle">Không lưu toàn bộ chat, audio, password hoặc token.</p></article>`;
  const planMarkup = (plan) => `<section class="alos-plan section"><header class="section-heading"><div><small>AI STUDY PLANNER</small><h2>Kế hoạch phù hợp lúc này</h2></div><b>${plan.minutes} phút</b></header><ol>${plan.tasks.map((task, index) => `<li><span>${index + 1}</span><div><b>${esc(task.title)}</b><small>${esc(task.minutes)} phút · ${esc(task.reason)}</small></div><button class="btn secondary" data-view="${esc(task.route)}">Mở</button></li>`).join('')}</ol><div class="action-row"><button class="btn primary" data-alos-explain>Giải thích kế hoạch</button><button class="btn secondary" data-view="daily-session">Bắt đầu học</button></div><div class="alos-output" data-alos-output aria-live="polite"></div></section>`;
  const curatorMarkup = (items) => `<article class="alos-card"><header><div><small>CONTENT CURATOR</small><h2>Nội dung nên học tiếp</h2></div><span>Approved only</span></header>${items.length ? `<ul class="alos-curated-list">${items.map((item) => `<li><b>${esc(item.title)}</b><small>${esc(item.level || item.type)} · ${esc(item.reason)}</small></li>`).join('')}</ul>` : '<div class="empty-state"><b>Đang tải nội dung đã duyệt</b><p>Không dùng bản nháp hoặc tự tạo curriculum thay thế.</p></div>'}<div class="action-row"><button class="btn secondary" data-view="content-explorer">Khám phá nội dung</button></div></article>`;
  const predictionMarkup = (prediction) => `<article class="alos-card"><header><div><small>PROGRESS PREDICTION</small><h2>Khả năng đi đúng hướng</h2></div><span>${esc(prediction.confidence)} confidence</span></header><div class="alos-prediction"><strong>${prediction.probability == null ? '—' : `${prediction.probability}%`}</strong><div><b>${prediction.probability == null ? 'Cần thêm dữ liệu học' : prediction.band === 'on-track' ? 'Đang đi đúng hướng' : prediction.band === 'possible-with-adjustment' ? 'Có thể đạt nếu điều chỉnh' : 'Cần củng cố nền tảng'}</b><p>${esc(prediction.goal)}</p></div></div><ul class="alos-evidence"><li><span>30 ngày gần nhất</span> <b>${prediction.evidence.sessionsLast30Days} phiên · ${prediction.evidence.activeDays} ngày</b></li><li><span>Dữ liệu kỹ năng</span> <b>${prediction.evidence.skillSamples} mẫu</b></li></ul><p class="subtle">${esc(prediction.disclaimer)}</p></article>`;
  function operatingSystemView() {
    const memory = PersonalLanguageMemoryService.snapshot(); const plan = AIStudyPlannerOSService.create(); const prediction = AIProgressPredictionService.forecast(); const curated = AIContentCuratorOSService.select(3); const privacy = AIPrivacyFirstService.status(); const improvement = ContinuousAIImprovementService.summary(); const hybrid = HumanAIHybridService.policy();
    return `${heading()}<section class="alos-hero section"><div><small>ONE LEARNING JOURNEY</small><h2>Một lớp thông minh phía sau, không thêm chatbot</h2><p>Đề xuất dựa trên dữ liệu thật, có fallback khi offline và không thay đổi mục tiêu nếu chưa được bạn xác nhận.</p></div><span class="alos-status ${privacy.aiEnabled ? '' : 'off'}"><i></i>${privacy.aiEnabled ? 'AI đã được cho phép' : 'AI đang tắt'}</span></section>${planMarkup(plan)}<section class="alos-grid section">${memoryMarkup(memory)}${predictionMarkup(prediction)}${curatorMarkup(curated)}<article class="alos-card"><header><div><small>LEARNING ADVISOR</small><h2>Bước tiếp theo rõ ràng</h2></div><span>Evidence first</span></header><h3>${esc(AILearningAdvisorOSService.recommend().nextAction)}</h3><p>${esc(AILearningAdvisorOSService.recommend().reason)}</p><div class="action-row"><button class="btn primary" data-view="${esc(AILearningAdvisorOSService.recommend().route)}">Tiếp tục học</button></div></article></section><section class="alos-card section"><header><div><small>MULTI-LANGUAGE SUPPORT</small><h2>Một memory và planner cho nhiều ngôn ngữ</h2></div><span>Shared core</span></header><div class="alos-language-grid">${AIMultiLanguageSupportService.matrix().map((item) => `<article class="${item.active ? 'active' : ''}"><b>${esc(item.label)}</b><small>${item.contentReady ? 'Content active' : 'Engine foundation'} · ${item.active ? 'Đang học' : 'Sẵn sàng hồ sơ'}</small></article>`).join('')}</div><p class="subtle">Japanese, Chinese và English chưa tự tạo curriculum khi content chưa được phát hành.</p></section><section class="alos-governance section"><article><b>Human + AI</b><span>${hybrid.teacherCanOverride ? 'Giáo viên có thể điều chỉnh; người học kiểm soát mục tiêu.' : ''}</span></article><article><b>Privacy first</b><span>${privacy.rawPromptStored ? 'Có lưu prompt' : 'Không lưu raw prompt/response/audio.'}</span></article><article><b>Continuous improvement</b><span>${improvement.qualityChecks} quality check · ${improvement.requestCountToday} request hôm nay · metadata tổng hợp.</span></article></section>`;
  }

  const bind = () => {
    if (!global.document || !state.currentUser) return;
    if (state.currentView === 'ai-coach' && !global.document.querySelector('[data-alos-entry]')) global.document.querySelector('[data-ai-companion], [data-ai-agent-panel], #app > .section:last-child')?.insertAdjacentHTML('afterend', '<section class="alos-entry section" data-alos-entry><div><small>P60 · LEARNING OPERATING SYSTEM</small><h2>Một nơi điều phối toàn bộ hành trình</h2><p>Memory · kế hoạch · nội dung · dự báo · human review</p></div><button class="btn primary" data-view="ai-language-os">Mở hệ thống</button></section>');
    global.document.querySelector('[data-alos-explain]')?.addEventListener('click', async (event) => { const button = event.currentTarget; const output = global.document.querySelector('[data-alos-output]'); button.disabled = true; if (output) output.textContent = 'Đang kiểm tra kế hoạch…'; const result = await AIStudyPlannerOSService.explain(); if (output) output.textContent = result.explanation; button.disabled = false; });
    global.document.querySelectorAll('[data-view]').forEach((button) => { if (!button.onclick) button.onclick = () => setView?.(button.dataset.view); });
  };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };

  Object.assign(global, { AILanguageOSContractService, AIPrivacyFirstService, PersonalLanguageMemoryService, AIStudyPlannerOSService, AILearningAdvisorOSService, AIContentCuratorOSService, AIProgressPredictionService, AIMultiLanguageSupportService, HumanAIHybridService, ContinuousAIImprovementService, GlobalLanguageAssistantOSService });
  global.AILanguageOperatingSystem = Object.freeze({ contract: AILanguageOSContractService, memory: PersonalLanguageMemoryService, planner: AIStudyPlannerOSService, advisor: AILearningAdvisorOSService, curator: AIContentCuratorOSService, prediction: AIProgressPredictionService, languages: AIMultiLanguageSupportService, hybrid: HumanAIHybridService, privacy: AIPrivacyFirstService, improvement: ContinuousAIImprovementService, assistant: GlobalLanguageAssistantOSService, version: 'p60-v1' });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'ai-language-os': operatingSystemView };
  AILanguageOSContractService.load();
  global.AdvancedContentService?.load?.();
})(window);
