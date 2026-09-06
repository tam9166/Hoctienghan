/* Tiếng Hàn - TamHoanq · P43 AI Agent Learning Architecture */
(function buildAIAgentLearningArchitecture(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService, LearnerProfileService, PracticeService, getUserProgress, setView, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.aiAgents || 'klearn_ai_agents';
  const runtime = state.aiAgentRuntime || (state.aiAgentRuntime = { content: null, loading: false, error: '' });
  const list = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = (value, max = 4000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max);
  const now = () => new Date().toISOString();
  const esc = (value) => escapeHtml ? escapeHtml(value) : clean(value, 500);
  const approved = (source) => source?.verified === true && ['approved', 'published'].includes(String(source.reviewStatus || source.status || '').toLowerCase());
  const hasSensitiveKey = (value, depth = 0) => {
    if (depth > 5 || value == null) return false;
    if (typeof value === 'string') return /(bearer\s+[a-z0-9._-]+|api[_ -]?key|access[_ -]?token|password|system\s+prompt|ignore\s+(all\s+)?previous)/i.test(value);
    if (Array.isArray(value)) return value.some((item) => hasSensitiveKey(item, depth + 1));
    if (typeof value === 'object') return Object.entries(value).some(([key, item]) => /^(password|secret|token|access[_-]?token|refresh[_-]?token|authorization|cookie|email|rawAudio|rawChatHistory|api[_-]?key)$/i.test(key) || hasSensitiveKey(item, depth + 1));
    return false;
  };
  const safeSource = (source) => approved(source) ? { id: clean(source.id, 120), verified: true, reviewStatus: clean(source.reviewStatus || source.status, 24), title: clean(source.title || source.pattern || source.korean, 160) } : null;
  const requestId = () => `agent-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

  const fallbackContent = {
    id: 'p43-ai-agent-learning-architecture', version: '1.0.0', architectureVersion: 'p43-v1', verified: true, reviewStatus: 'approved',
    agents: [
      { id: 'planner', name: 'Learning Planner', task: 'study_advisor', intents: ['plan', 'study_plan', 'today'] },
      { id: 'grammar', name: 'Grammar', task: 'grammar', intents: ['grammar', 'explain_grammar'], sourceRequired: true },
      { id: 'vocabulary', name: 'Vocabulary', task: 'definition', intents: ['vocabulary', 'explain_vocabulary', 'define'], sourceRequired: true },
      { id: 'speaking', name: 'Speaking', task: 'speaking', intents: ['speaking', 'pronunciation', 'speaking_practice'] },
      { id: 'writing', name: 'Writing', task: 'writing_review', intents: ['writing', 'review_writing'] },
      { id: 'exam', name: 'TOPIK Exam', task: 'planning', intents: ['exam', 'topik', 'topik_preparation'] },
      { id: 'career', name: 'Career', task: 'career_coach', intents: ['career', 'business_korean', 'interview'] },
      { id: 'memory', name: 'Learning Memory', task: 'memory', intents: ['memory', 'remember', 'review_priority'], mutatesLearningData: 'explicit-confirmation-only' }
    ],
    routing: { maximumPrimaryAgents: 1, qualityControllerAlwaysRuns: true, maximumRetries: 0, ambiguousIntent: 'request-clarification' },
    context: { allowedFields: ['currentTopikLevel', 'targetTopikLevel', 'learningStyle', 'learningMode', 'explanationStyle', 'weakGrammar', 'weakVocabulary', 'weakSkills', 'frequentErrors', 'recentMistakes', 'relevantMemory', 'knowledgeGraph', 'recommendations', 'dueSrsCount', 'recentScores', 'listeningScore', 'speakingScore', 'writingScore', 'streak', 'weeklyStudyMinutes', 'masteryByTopic', 'dailyPlan', 'currentView', 'scores'] },
    quality: { minimumScore: .7, blockedClaims: ['official TOPIK answer', 'guaranteed TOPIK score', 'guaranteed employment', 'medical diagnosis'], approvedSourceRequiredFor: ['grammar', 'vocabulary'] },
    privacy: { storesRawInput: false, storesRawResponse: false, storesRawAudio: false, auditMetadataOnly: true }
  };

  const AIAgentRegistryService = {
    hydrate(value) {
      const agents = list(value?.agents); const ids = agents.map((item) => item.id).sort().join(',');
      if (value?.verified !== true || value.reviewStatus !== 'approved' || value.architectureVersion !== 'p43-v1' || ids !== 'career,exam,grammar,memory,planner,speaking,vocabulary,writing' || value.routing?.maximumPrimaryAgents !== 1 || value.routing?.maximumRetries !== 0 || value.privacy?.auditMetadataOnly !== true || value.privacy?.storesRawInput !== false || value.privacy?.storesRawResponse !== false || value.privacy?.storesRawAudio !== false) throw new Error('AI agent architecture quality gate failed');
      runtime.content = value; runtime.error = ''; global.KLEARN_AI_AGENT_ARCHITECTURE = value; return value;
    },
    async load() {
      if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') return this.hydrate(fallbackContent);
      runtime.loading = global.fetch('./content/ai-agent-architecture.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`AI agent architecture ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 180); return this.hydrate(fallbackContent); }).finally(() => { runtime.loading = false; });
      return runtime.loading;
    },
    all() { return list((runtime.content || fallbackContent).agents); },
    get(id) { return this.all().find((item) => item.id === id) || null; },
    version: () => (runtime.content || fallbackContent).architectureVersion
  };
  if (global.KLEARN_AI_AGENT_ARCHITECTURE) AIAgentRegistryService.hydrate(global.KLEARN_AI_AGENT_ARCHITECTURE);

  const AIAgentContextService = {
    build(extra = {}) {
      const profile = LearnerProfileService?.get?.() || {}; const progress = getUserProgress?.() || {};
      const source = { currentTopikLevel: profile.currentTopikLevel, targetTopikLevel: profile.targetTopikLevel, learningStyle: profile.learningStyle, learningMode: profile.learningMode, explanationStyle: profile.explanationStyle, weakGrammar: profile.weakGrammar, weakVocabulary: profile.weakVocabulary, weakSkills: profile.weakSkills, frequentErrors: profile.frequentErrors, recentMistakes: profile.recentMistakes, dueSrsCount: profile.dueSrsCount, listeningScore: profile.skillScores?.listening, speakingScore: profile.skillScores?.speaking, writingScore: profile.skillScores?.writing, streak: progress.stats?.streak, weeklyStudyMinutes: profile.weeklyStudyMinutes, masteryByTopic: profile.masteryByTopic, dailyPlan: progress.daily, currentView: state.currentView, ...object(extra) };
      const allowed = new Set((runtime.content || fallbackContent).context.allowedFields); const filtered = Object.fromEntries(Object.entries(source).filter(([key, value]) => allowed.has(key) && value !== undefined));
      return global.AIContextService?.build?.(filtered, 'agent_orchestration') || filtered;
    }
  };

  const AIAgentAuditService = {
    all() { const value = userScoped(STORE_KEY)[0]; return list(value?.audit); },
    record(event = {}) {
      if (!state.currentUser?.id) return null;
      const item = { id: clean(event.id || requestId(), 80), agentId: clean(event.agentId, 30), intent: clean(event.intent, 50), status: clean(event.status, 30), qualityScore: Math.max(0, Math.min(1, Number(event.qualityScore || 0))), latencyMs: Math.max(0, Math.round(Number(event.latencyMs || 0))), inputChars: Math.max(0, Math.round(Number(event.inputChars || 0))), sourceId: clean(event.sourceId, 120) || null, primaryAgentsUsed: 1, qualityControllerRan: true, rawInputStored: false, rawResponseStored: false, rawAudioStored: false, createdAt: now() };
      const current = userScoped(STORE_KEY)[0] || {}; saveUserScoped(STORE_KEY, [{ ...current, version: 1, audit: [item, ...list(current.audit)].slice(0, 200), updatedAt: item.createdAt }], 1); CloudSyncService?.schedule?.('ai-agent-audit'); return item;
    }
  };

  const localPlan = (payload = {}) => {
    const recommendation = global.AIStudyAdvisorService?.recommend?.(payload); if (recommendation) return recommendation;
    const due = Number(payload.dueSrsCount || 0); return { items: [{ title: due ? `Ôn ${Math.min(15, due)} từ SRS` : 'Tiếp tục bài học', minutes: 10 }, { title: 'Luyện kỹ năng yếu', minutes: 5 }], nextAction: due ? 'Ôn từ đến hạn' : 'Tiếp tục bài đang học', evidence: { dueSrsCount: due } };
  };
  const AILearningPlannerAgent = { id: 'planner', async run(payload = {}, context = {}) { const plan = localPlan(payload); if (payload.enhance === false || !global.AIStudyAdvisorService?.ask) return { status: 'ready', route: 'daily-session', plan, reply: plan.nextAction || 'Kế hoạch học đã sẵn sàng.' }; const result = await global.AIStudyAdvisorService.ask({ ...payload, context }); return { ...result, status: result.status || 'ready', route: 'daily-session', plan, reply: result.ai || result.reply || result.nextAction || plan.nextAction }; } };
  const AIGrammarAgent = { id: 'grammar', async run(payload = {}) { if (!approved(payload.source)) return { status: 'blocked', reason: 'approved-source-required', reply: 'Phần ngữ pháp này cần nguồn nội dung đã được duyệt trước khi giải thích.' }; return { ...(await global.AIContentExplanationService?.explain?.({ type: 'grammar', id: payload.source.id, text: payload.text || payload.source.pattern, language: payload.language || 'ko', content: payload.source })), status: 'ready', route: 'theory', source: safeSource(payload.source) }; } };
  const AIVocabularyAgent = { id: 'vocabulary', async run(payload = {}) { if (!approved(payload.source)) return { status: 'blocked', reason: 'approved-source-required', reply: 'Từ vựng này cần nguồn nội dung đã được duyệt trước khi giải thích.' }; return { ...(await global.AIContentExplanationService?.explain?.({ type: 'vocabulary', id: payload.source.id, text: payload.text || payload.source.korean, language: payload.language || 'ko', content: payload.source })), status: 'ready', route: 'dictionary', source: safeSource(payload.source) }; } };
  const AISpeakingAgent = { id: 'speaking', async run(payload = {}, context = {}) { const input = clean(payload.transcript || payload.text); if (!input || payload.enhance === false) { const match = global.VoiceMatchingService?.recommend?.({ level: context.currentTopikLevel }) || null; return { status: 'ready', route: 'advanced-voice', recommendation: match, reply: 'Mở bài luyện nói phù hợp và ghi âm khi bạn sẵn sàng.' }; } const result = await global.AIOrchestrationService?.request?.({ task: 'speaking', input, language: payload.language || 'vi', context }); return { ...result, status: 'ready', route: 'advanced-voice' }; } };
  const AIWritingAgent = { id: 'writing', async run(payload = {}) { const text = clean(payload.text); if (!text) return { status: 'blocked', reason: 'empty-input', reply: 'Hãy nhập một câu hoặc đoạn viết cần góp ý.' }; return { ...(await global.AIWritingReviewService?.review?.({ text, type: payload.type || 'message', language: payload.language || 'ko' })), status: 'ready', route: 'writing-hub' }; } };
  const AIExamAgent = { id: 'exam', async run(payload = {}, context = {}) { const history = PracticeService?.getHistory?.() || []; const evidence = { attempts: history.length, recentScores: history.slice(0, 5).map((item) => Number(item.percentage || 0)), targetTopikLevel: context.targetTopikLevel || null }; if (payload.enhance === false || !global.AIOrchestrationService?.request) return { status: 'ready', route: 'topik', evidence, reply: 'Kế hoạch TOPIK được tạo từ kết quả luyện tập gần đây.' }; const result = await global.AIOrchestrationService.request({ task: 'planning', input: clean(payload.text || 'Tạo kế hoạch luyện TOPIK dựa trên dữ liệu tổng hợp; không khẳng định điểm số chính thức.'), language: payload.language || 'vi', context: { ...context, recentScores: evidence.recentScores } }); return { ...result, status: 'ready', route: 'topik', evidence }; } };
  const AICareerAgent = { id: 'career', async run(payload = {}) { const report = global.JobPreparationReportService?.generate?.() || null; const result = await global.AICareerCoachService?.coach?.({ scenario: payload.scenario || 'interview', text: clean(payload.text), language: payload.language || 'ko' }); return { ...result, status: 'ready', route: 'career-center', evidence: report ? { readiness: report.readiness ?? report.score ?? null } : null }; } };
  const AIMemoryAgent = { id: 'memory', snapshot() { const memory = global.AILearningMemoryService?.snapshot?.() || {}; const priority = global.SpacedRepetitionOptimizer?.rank?.(state.srsData || [], 5) || []; return { ...memory, reviewPriority: priority.map((item) => ({ wordId: item.wordId, priority: item.priority, forgettingProbability: item.forgettingProbability })) }; }, async run(payload = {}) { if (payload.action === 'remember') { if (payload.confirmed !== true) return { status: 'confirmation-required', mutationPerformed: false, reply: 'Hãy xác nhận trước khi cập nhật bộ nhớ học tập.' }; const allowed = ['goal', 'level', 'weakSkills', 'frequentErrors', 'learningStyle', 'preferredExplanation', 'targetLanguage']; const changes = Object.fromEntries(Object.entries(object(payload.changes)).filter(([key]) => allowed.includes(key))); const memory = global.AILearningMemoryService?.remember?.(changes) || changes; return { status: 'ready', mutationPerformed: true, route: 'smart-review', memory, reply: 'Bộ nhớ học tập đã được cập nhật theo xác nhận của bạn.' }; } return { status: 'ready', mutationPerformed: false, route: 'smart-review', memory: this.snapshot(), reply: 'Đã tổng hợp kiến thức cần ưu tiên ôn.' }; } };

  const agents = { planner: AILearningPlannerAgent, grammar: AIGrammarAgent, vocabulary: AIVocabularyAgent, speaking: AISpeakingAgent, writing: AIWritingAgent, exam: AIExamAgent, career: AICareerAgent, memory: AIMemoryAgent };
  const AIAgentQualityController = {
    evaluate(agentId, result = {}, payload = {}) {
      const config = runtime.content || fallbackContent; const text = clean(result.reply || result.ai || ''); const reasons = [];
      if (hasSensitiveKey(result)) reasons.push('sensitive-data');
      if (config.quality.approvedSourceRequiredFor.includes(agentId) && !approved(payload.source)) reasons.push('approved-source-required');
      if (config.quality.blockedClaims.some((claim) => text.toLowerCase().includes(String(claim).toLowerCase()))) reasons.push('unsupported-claim');
      const base = global.AIResponseQualityService?.check?.(text, { task: AIAgentRegistryService.get(agentId)?.task, source: safeSource(payload.source) }) || global.AICompanionQualityService?.evaluate?.(text, { task: agentId, source: safeSource(payload.source) }) || { status: text ? 'pass' : 'review', score: text ? .9 : .5, reasons: [] };
      reasons.push(...list(base.reasons)); const unique = [...new Set(reasons)]; const blocked = result.status === 'blocked' || unique.some((reason) => ['sensitive-data', 'approved-source-required', 'unsupported-claim', 'unsafe-input'].includes(reason)); const score = blocked ? Math.min(.49, Number(base.score || 0)) : Math.max(0, Math.min(1, Number(base.score ?? .8)));
      return { status: blocked ? 'blocked' : (score < Number(config.quality.minimumScore || .7) || unique.length ? 'review' : 'pass'), score, reasons: unique, checkedAt: now(), controller: 'p43-quality-v1' };
    },
    safeResult(result, quality) { if (quality.status !== 'blocked') return result; return { status: 'blocked', reason: quality.reasons[0] || 'quality-gate', reply: 'Nội dung chưa vượt qua kiểm tra chất lượng. Bạn vẫn có thể dùng bài học và công cụ luyện tập có sẵn.', fallback: true }; }
  };

  const LearningAgentOrchestratorService = {
    route(intent, payload = {}) {
      const value = clean(intent, 50).toLowerCase();
      if (value === 'explain') return ['grammar', 'vocabulary'].includes(payload.contentType) ? payload.contentType : null;
      return AIAgentRegistryService.all().find((agent) => list(agent.intents).includes(value))?.id || null;
    },
    async dispatch({ intent = '', payload = {}, context = {} } = {}) {
      const started = Date.now(); const id = requestId(); const agentId = this.route(intent, payload); const inputChars = clean(payload.text || payload.transcript || '').length;
      if (!agentId) return { requestId: id, status: 'clarification-required', clarification: 'Vui lòng chọn tác vụ: kế hoạch, ngữ pháp, từ vựng, nói, viết, TOPIK, nghề nghiệp hoặc bộ nhớ.', primaryAgentsUsed: 0, qualityControllerRan: false, retries: 0 };
      if (hasSensitiveKey(payload) || hasSensitiveKey(context)) { const quality = { status: 'blocked', score: 0, reasons: ['unsafe-input'], controller: 'p43-quality-v1', checkedAt: now() }; AIAgentAuditService.record({ id, agentId, intent, status: 'blocked', qualityScore: 0, latencyMs: Date.now() - started, inputChars }); return { requestId: id, status: 'blocked', agentId, result: AIAgentQualityController.safeResult({}, quality), quality, primaryAgentsUsed: 1, qualityControllerRan: true, retries: 0 }; }
      const safeContext = AIAgentContextService.build(context); let result;
      try { result = await agents[agentId].run(object(payload), safeContext); } catch (_) { result = { status: 'review', fallback: true, reply: 'Tác vụ tạm thời không khả dụng. Dữ liệu học của bạn vẫn an toàn.' }; }
      const quality = AIAgentQualityController.evaluate(agentId, result, payload); const safe = AIAgentQualityController.safeResult(result, quality); const status = quality.status === 'blocked' ? 'blocked' : result.status === 'confirmation-required' ? 'confirmation-required' : quality.status;
      AIAgentAuditService.record({ id, agentId, intent, status, qualityScore: quality.score, latencyMs: Date.now() - started, inputChars, sourceId: safeSource(payload.source)?.id });
      return { requestId: id, status, agentId, result: safe, quality, primaryAgentsUsed: 1, qualityControllerRan: true, retries: 0 };
    },
    registry: () => AIAgentRegistryService.all(),
    policy: () => ({ maximumPrimaryAgents: 1, maximumRetries: 0, qualityControllerAlwaysRuns: true })
  };

  const uiAgents = [
    ['planner', 'Kế hoạch học', 'Tạo lộ trình từ tiến độ thật.', 'daily-session'], ['grammar', 'Ngữ pháp', 'Giải thích dựa trên bài đã duyệt.', 'theory'], ['vocabulary', 'Từ vựng', 'Nghĩa, ngữ cảnh và cách dùng.', 'dictionary'], ['speaking', 'Luyện nói', 'Phản hồi phát âm theo bài luyện.', 'advanced-voice'],
    ['writing', 'Viết', 'Góp ý câu và đoạn viết.', 'writing-hub'], ['exam', 'Luyện TOPIK', 'Chuẩn bị theo kết quả gần đây.', 'topik'], ['career', 'Tiếng Hàn nghề nghiệp', 'Tình huống công việc thực tế.', 'career-center'], ['memory', 'Bộ nhớ học tập', 'Ưu tiên kiến thức cần ôn.', 'smart-review']
  ];
  const panel = () => `<section class="card section ai-agent-panel" data-ai-agent-panel aria-labelledby="aiAgentTitle"><div class="section-heading"><div><p class="eyebrow">Điều phối học tập · P43</p><h2 class="section-title" id="aiAgentTitle">Đúng chuyên môn cho từng tác vụ</h2></div><span class="ai-agent-status"><i aria-hidden="true"></i> 1 tác vụ + kiểm soát chất lượng</span></div><p class="subtle">Mỗi yêu cầu được chuyển đến một bộ xử lý chuyên trách. Không có chuỗi agent tự chạy và không lưu nội dung trao đổi trong nhật ký vận hành.</p><div class="ai-agent-grid">${uiAgents.map(([id, title, description, route]) => `<button type="button" class="ai-agent-card" data-ai-agent-route="${esc(route)}"><span class="ai-agent-code">${esc(id.slice(0, 2).toUpperCase())}</span><span><b>${esc(title)}</b><small>${esc(description)}</small></span></button>`).join('')}</div><div class="ai-agent-foot"><span>8 tác vụ chuyên trách</span><span>Không retry tự động</span><span>Metadata riêng tư</span></div></section>`;
  const mountPanel = () => { if (!global.document || state.currentView !== 'ai-coach' || !state.currentUser || global.document.querySelector('[data-ai-agent-panel]')) return; global.document.getElementById('app')?.insertAdjacentHTML('beforeend', panel()); global.document.querySelectorAll('[data-ai-agent-route]').forEach((button) => { button.onclick = () => setView(button.dataset.aiAgentRoute); }); };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); mountPanel(); };

  Object.assign(global, { AIAgentRegistryService, AIAgentContextService, AIAgentAuditService, AILearningPlannerAgent, AIGrammarAgent, AIVocabularyAgent, AISpeakingAgent, AIWritingAgent, AIExamAgent, AICareerAgent, AIMemoryAgent, AIAgentQualityController, LearningAgentOrchestratorService });
  global.AIAgentLearningArchitecture = { registry: AIAgentRegistryService, orchestrator: LearningAgentOrchestratorService, quality: AIAgentQualityController, agents, version: 'p43-v1' };
  AIAgentRegistryService.load().finally(mountPanel);
})(window);
