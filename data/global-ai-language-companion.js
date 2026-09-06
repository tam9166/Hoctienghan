/* P32 — contextual AI language companion. AI is an opt-in layer behind existing learning flows. */
(() => {
  'use strict';
  const global = window;
  const app = global.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService, LearnerProfileService, getUserProgress, toast, escapeHtml, render } = app;
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const clean = (value, limit = 600) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit);
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const array = (value) => Array.isArray(value) ? value : [];
  const SUPPORTED_LANGUAGES = new Set(['ko', 'ja', 'zh']);
  const normalizeLanguage = (value) => { const id = clean(value, 20).toLowerCase(); return ({ korean: 'ko', 'ko-kr': 'ko', japanese: 'ja', 'ja-jp': 'ja', chinese: 'zh', 'zh-cn': 'zh' })[id] || (SUPPORTED_LANGUAGES.has(id) ? id : 'ko'); };
  const limitInput = (value) => clean(value, 4000);
  const memoryKey = STORAGE_KEYS?.aiMemory || 'klearn_ai_memory';
  const companionKey = STORAGE_KEYS?.aiInfrastructure || 'klearn_ai_infrastructure';
  const fallbackContent = { status: 'approved', verified: true, reviewStatus: 'approved', supportedLanguages: ['ko', 'ja', 'zh'], quality: { requiresApprovedSourceForPractice: true } };
  let content = global.KLEARN_AI_LANGUAGE_COMPANION_CONTENT || fallbackContent;
  const AICompanionContentService = {
    hydrate(value) { const next = object(value); if (next.verified !== true || next.reviewStatus !== 'approved' || !array(next.supportedLanguages).length) throw new Error('AI companion content quality gate failed'); content = next; global.KLEARN_AI_LANGUAGE_COMPANION_CONTENT = next; return next; },
    async load() { if (content !== fallbackContent) return content; if (typeof fetch !== 'function') return content; try { const response = await fetch('./content/global-ai-language-companion.json', { cache: 'default' }); if (response.ok) this.hydrate(await response.json()); } catch (_) { /* local contract remains the safe fallback */ } return content; },
    get() { return content; },
    languages() { return array(content.supportedLanguages).map((value) => typeof value === 'string' ? value : value.id).filter((value) => SUPPORTED_LANGUAGES.has(value)); }
  };
  const sourceApproved = (source = {}) => source.verified === true && ['approved', 'published'].includes(String(source.reviewStatus || source.status || '').toLowerCase());
  const safeList = (value, max = 8) => array(value).map((item) => clean(typeof item === 'object' ? (item.id || item.topic || item.name || item.label || '') : item, 120)).filter(Boolean).slice(0, max);
  const profile = () => object(LearnerProfileService?.get?.() || {});
  const progress = () => object(getUserProgress?.() || {});
  const readMemories = () => array(userScoped?.(memoryKey)).filter((item) => item && typeof item === 'object');
  const saveMemoryList = (list) => { if (!uid() || !saveUserScoped) return; saveUserScoped(memoryKey, list.slice(0, 120), 120); CloudSyncService?.schedule?.('ai-companion-memory'); };

  const AILearningMemoryService = {
    fields() { return ['goal', 'level', 'weakSkills', 'frequentErrors', 'learningStyle', 'preferredExplanation', 'targetLanguage']; },
    snapshot() {
      const learner = profile(); const current = state.currentUser || {}; const memories = readMemories();
      const memoryProfile = memories.find((item) => item.kind === 'companion-profile')?.profile || {};
      return {
        goal: clean(memoryProfile.goal || learner.goal || learner.learningGoal || current.goal || (learner.targetTopikLevel ? `TOPIK ${learner.targetTopikLevel}` : ''), 160),
        level: clean(memoryProfile.level || learner.currentTopikLevel || current.level || 'beginner', 40),
        weakSkills: safeList(memoryProfile.weakSkills || learner.weakSkills || learner.weakSkill),
        frequentErrors: safeList(memoryProfile.frequentErrors || learner.frequentErrors || learner.recentMistakes),
        learningStyle: clean(memoryProfile.learningStyle || learner.learningStyle || 'visual', 60),
        preferredExplanation: clean(memoryProfile.preferredExplanation || learner.explanationStyle || 'step-by-step', 80),
        targetLanguage: normalizeLanguage(memoryProfile.targetLanguage || 'ko'),
        updatedAt: memoryProfile.updatedAt || null
      };
    },
    save(changes = {}) {
      if (!uid()) return this.snapshot();
      const previous = this.snapshot(); const next = { ...previous, ...object(changes), weakSkills: safeList(changes.weakSkills ?? previous.weakSkills), frequentErrors: safeList(changes.frequentErrors ?? previous.frequentErrors), targetLanguage: normalizeLanguage(changes.targetLanguage || previous.targetLanguage), updatedAt: now() };
      const list = readMemories(); const entry = { id: `companion-profile-${uid()}`, user_id: uid(), kind: 'companion-profile', profile: next, updated_at: next.updatedAt, source: 'learner-profile' };
      saveMemoryList([entry, ...list.filter((item) => item.id !== entry.id)]); return next;
    },
    remember(event = {}) {
      const allowed = ['goal', 'level', 'weakSkills', 'frequentErrors', 'learningStyle', 'preferredExplanation', 'targetLanguage'];
      const changes = Object.fromEntries(allowed.filter((key) => event[key] !== undefined).map((key) => [key, event[key]]));
      return this.save(changes);
    },
    context() {
      const snapshot = this.snapshot();
      return { goal: snapshot.goal, level: snapshot.level, weakSkills: snapshot.weakSkills, frequentErrors: snapshot.frequentErrors, learningStyle: snapshot.learningStyle, preferredExplanation: snapshot.preferredExplanation, targetLanguage: snapshot.targetLanguage };
    }
  };

  const minimalContext = (extra = {}) => {
    const memory = AILearningMemoryService.context(); const p = profile(); const progressData = progress();
    return {
      ...memory,
      currentTopikLevel: p.currentTopikLevel || memory.level,
      targetTopikLevel: p.targetTopikLevel || null,
      weakSkills: safeList(extra.weakSkills || memory.weakSkills),
      frequentErrors: safeList(extra.frequentErrors || memory.frequentErrors),
      dueSrsCount: Number(p.dueSrsCount || progressData.dueSrsCount || 0),
      streak: Number(progressData.stats?.streak || p.streak || 0),
      currentLesson: object(extra.currentLesson).id ? { id: clean(extra.currentLesson.id, 100), title: clean(extra.currentLesson.title, 160) } : undefined,
      task: clean(extra.task || 'companion', 40)
    };
  };

  const evaluate = (response, options = {}) => {
    const text = clean(typeof response === 'string' ? response : response?.reply, 8000);
    const base = global.AIResponseQualityService?.check?.(text, { task: options.task || 'companion', level: options.level || AILearningMemoryService.snapshot().level, source: options.source }) || { status: text ? 'pass' : 'review', score: text ? .85 : 0, reasons: text ? [] : ['empty'], text };
    const quality = { status: base.status, score: Number(base.score ?? 0), reasons: array(base.reasons), evaluatedAt: now(), task: clean(options.task || 'companion', 40), language: normalizeLanguage(options.language), sourceApproved: options.source ? sourceApproved(options.source) : null };
    return quality;
  };
  const request = async ({ task, input, language = 'ko', context = {}, messages = [] } = {}) => {
    const targetLanguage = normalizeLanguage(language); const safeInput = limitInput(input); if (!safeInput) return { reply: '', fallback: true, quality: evaluate('', { task, language: targetLanguage }) };
    const orchestrator = global.AIOrchestrationService?.request;
    if (typeof orchestrator !== 'function') { const reply = fallbackReply(task, targetLanguage); return { reply, fallback: true, quality: AICompanionQualityService.evaluate(reply, { task, language: targetLanguage }) }; }
    const result = await orchestrator({ task, input: safeInput, messages: array(messages).slice(-6).map((item) => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: limitInput(item?.content).slice(0, 1600) })), context: minimalContext({ ...context, task }), language: targetLanguage });
    const quality = AICompanionQualityService.evaluate(result?.reply, { task, language: targetLanguage, source: context.source });
    return { ...(result || {}), reply: clean(result?.reply, 8000), quality };
  };
  function fallbackReply(task, language) {
    if (language === 'ja') return '現在はオフラインです。学習キューから短い復習を続けてください。';
    if (language === 'zh') return 'AI 暂时不可用。请继续当前课程或复习队列。';
    if (task === 'study_advisor') return 'Hôm nay hãy ôn SRS đến hạn, sau đó luyện kỹ năng yếu nhất trong 10 phút.';
    if (task === 'writing_review') return 'Chưa thể gửi bài viết đến bộ kiểm tra. Hãy dùng mẫu câu và giải thích có sẵn.';
    return 'AI đang tạm thời không khả dụng; dữ liệu học của bạn vẫn an toàn.';
  }

  const AIStudyAdvisorService = {
    recommend(options = {}) {
      const memory = AILearningMemoryService.snapshot(); const p = profile(); const progressData = progress(); const due = Number(options.dueSrsCount ?? p.dueSrsCount ?? progressData.dueSrsCount ?? 0); const weak = memory.weakSkills[0] || p.weakSkills?.[0] || 'listening';
      const items = []; if (due > 0) items.push({ type: 'review', title: `Ôn ${Math.min(due, 15)} mục SRS`, minutes: Math.min(15, Math.max(5, due)), reason: 'Có nội dung đã đến hạn.' }); items.push({ type: 'skill', title: `Luyện ${weak}`, minutes: 10, reason: 'Đây là kỹ năng cần được củng cố.' }); if (!items.length) items.push({ type: 'lesson', title: 'Tiếp tục bài học kế tiếp', minutes: 15, reason: 'Duy trì nhịp học hiện tại.' });
      const result = { nextAction: items[0].title, items: items.slice(0, 3), goal: memory.goal || null, evidence: { dueSrsCount: due, weakSkill: weak, streak: Number(progressData.stats?.streak || 0) }, generatedBy: 'local-learning-signals', language: normalizeLanguage(options.language || memory.targetLanguage) };
      AILearningMemoryService.remember({ targetLanguage: result.language }); return result;
    },
    async ask(options = {}) { const baseline = this.recommend(options); const response = await request({ task: 'study_advisor', input: `Dựa trên learner context, giải thích ngắn gọn vì sao hôm nay nên làm: ${baseline.items.map((item) => item.title).join('; ')}. Không bịa số liệu.`, language: options.language || 'ko', context: { recommendations: baseline.items, task: 'study_advisor' } }); return { ...baseline, ai: response.reply, quality: response.quality, fallback: response.fallback }; }
  };

  const AIContentExplanationService = { async explain({ type = 'content', id = '', text = '', language = 'ko', content: source } = {}) { const safeSource = object(source); const input = `Giải thích ${type} ${id || ''} cho người học trình độ ${AILearningMemoryService.snapshot().level}: ${limitInput(text || safeSource.explanation || safeSource.meaning || safeSource.pattern)}. Nêu cách dùng, ví dụ có trong nguồn và mức độ chắc chắn; không tự tạo nguồn.`; return request({ task: 'content_explanation', input, language, context: { source: sourceApproved(safeSource) ? { id: clean(id || safeSource.id, 100), status: 'approved' } : undefined } }); } };
  const AIPracticeCreatorService = { async create({ content: source = {}, count = 5, language = 'ko' } = {}) { if (!sourceApproved(source)) return { status: 'blocked', reason: 'approved-source-required', exercises: [], quality: { status: 'blocked', score: 0, reasons: ['approved-source-required'] } }; const safeCount = Math.max(1, Math.min(20, Number(count) || 5)); const response = await request({ task: 'practice_creator', input: `Tạo ${safeCount} bài luyện bổ sung chỉ từ content đã duyệt: ${limitInput(source.title || source.id || 'approved content')}. Giữ đúng trình độ và đánh dấu kết quả cần review.`, language, context: { source: { id: clean(source.id, 100), status: 'approved' } } }); return { ...response, status: 'needs-review', sourceId: clean(source.id, 100), exercises: [], generatedContentRequiresReview: true }; } };
  const conversationSessions = new Map();
  const AIConversationPartnerService = { start({ scenarioId = '', prompt = '', language = 'ko' } = {}) { const id = `companion-${Date.now()}`; conversationSessions.set(id, { id, scenarioId: clean(scenarioId, 100), turns: [], language: normalizeLanguage(language) }); return { id, scenarioId: clean(scenarioId, 100), language: normalizeLanguage(language), status: 'ready' }; }, async respond(sessionId, input, options = {}) { const session = conversationSessions.get(sessionId); if (!session) return { status: 'missing-session' }; const text = limitInput(input); if (!text) return { status: 'empty-input' }; const response = await request({ task: 'conversation_partner', input: text, messages: [...session.turns, { role: 'user', content: text }], language: options.language || session.language, context: { conversationSummary: `Scenario ${session.scenarioId}; ${session.turns.length} turns`, task: 'conversation_partner' } }); session.turns = [...session.turns, { role: 'user', content: text }, { role: 'assistant', content: response.reply }].slice(-8); return { ...response, sessionId, turn: session.turns.length / 2 }; } };
  const AIWritingReviewService = { async review({ text = '', type = 'message', language = 'ko' } = {}) { const input = limitInput(text); if (!input) return { status: 'empty-input' }; return request({ task: 'writing_review', input: `Review ${type} for a learner. Text: ${input}. Give strengths, corrections, natural alternative and one next exercise. Do not claim official grading.`, language, context: { task: 'writing_review' } }); } };
  const AICareerCoachService = { async coach({ scenario = 'interview', text = '', language = 'ko' } = {}) { return request({ task: 'career_coach', input: `Hỗ trợ tình huống ${clean(scenario, 100)} bằng ${normalizeLanguage(language)}. ${limitInput(text)}. Cho một câu trả lời mẫu và một điểm cần luyện.`, language, context: { task: 'career_coach' } }); } };
  const AICultureAdvisorService = { async explain({ expression = '', context = '', language = 'ko' } = {}) { return request({ task: 'culture_advisor', input: `Giải thích ngữ cảnh xã hội và mức độ lịch sự của ${limitInput(expression)} trong tình huống ${limitInput(context)}. Nêu khi nào nên/không nên dùng, không khẳng định tuyệt đối.`, language, context: { task: 'culture_advisor' } }); } };
  const recordQuality = (quality) => { if (!uid() || !storage?.get || !storage?.set) return; const all = object(storage.get(companionKey, {})); const current = object(all[uid()]); all[uid()] = { ...current, companionQualityLogs: [{ status: quality.status, score: quality.score, task: quality.task, language: quality.language, sourceApproved: quality.sourceApproved, createdAt: quality.evaluatedAt }, ...array(current.companionQualityLogs)].slice(0, 100) }; storage.set(companionKey, all); CloudSyncService?.schedule?.('ai-companion-quality'); };
  const AICompanionQualityService = { evaluate(response, options = {}) { const quality = evaluate(response, options); recordQuality(quality); return quality; }, logs() { return object(storage?.get?.(companionKey, {}))[uid()]?.companionQualityLogs || []; } };
  const AICompanionService = { memory: AILearningMemoryService, advisor: AIStudyAdvisorService, explain: AIContentExplanationService, practice: AIPracticeCreatorService, conversation: AIConversationPartnerService, writing: AIWritingReviewService, career: AICareerCoachService, culture: AICultureAdvisorService, quality: AICompanionQualityService, supportedLanguages: () => AICompanionContentService.languages(), version: 'p32-v1' };

  const esc = (value) => (escapeHtml ? escapeHtml(value) : clean(value, 500));
  const companionPanel = () => { if (!state.currentUser || state.currentView !== 'ai-coach') return ''; const advisor = AIStudyAdvisorService.recommend(); return `<section class="card section ai-companion-panel" data-ai-companion><div class="section-heading"><div><p class="eyebrow">Trợ lý theo ngữ cảnh · P32</p><h2 class="section-title">Hôm nay nên học gì?</h2></div><span class="level-pill">${esc(advisor.goal || 'Theo tiến độ')}</span></div><p class="subtle">Gợi ý từ SRS, mục tiêu và kỹ năng yếu; AI chỉ được gọi khi bạn yêu cầu giải thích hoặc phản hồi.</p><div class="ai-companion-actions">${advisor.items.map((item) => `<div class="ai-companion-action"><b>${esc(item.title)}</b><small>${item.minutes} phút · ${esc(item.reason)}</small></div>`).join('')}</div><div class="action-row"><button class="btn primary" data-companion-advisor>Giải thích gợi ý</button><button class="btn secondary" data-view="conversation-simulator">Luyện hội thoại</button></div><div class="ai-companion-output" data-companion-output aria-live="polite"></div></section>`; };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!global.document || state.currentView !== 'ai-coach' || !state.currentUser || global.document.querySelector('[data-ai-companion]')) return; global.document.getElementById('app')?.insertAdjacentHTML('beforeend', companionPanel()); global.document.querySelector('[data-companion-advisor]')?.addEventListener('click', async () => { const output = global.document.querySelector('[data-companion-output]'); if (!output) return; output.textContent = 'Đang chuẩn bị giải thích…'; const result = await AIStudyAdvisorService.ask(); output.textContent = result.ai || result.nextAction; }); };
  Object.assign(global, { AICompanionContentService, AILearningMemoryService, AIStudyAdvisorService, AIContentExplanationService, AIPracticeCreatorService, AIConversationPartnerService, AIWritingReviewService, AICareerCoachService, AICultureAdvisorService, AICompanionQualityService, AICompanionService });
  global.KLEARN_AI_LANGUAGE_COMPANION_CONTENT = content;
  AICompanionContentService.load();
})();
