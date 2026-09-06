/* P26 — safe AI orchestration. AI stays behind existing learning features. */
(() => {
  'use strict';
  const app = window.KLEARN_APP;
  if (!app) return;
  window.KLEARN_AI_INFRASTRUCTURE = window.KLEARN_AI_INFRASTRUCTURE || {
    version: 1,
    status: 'approved',
    promptVersions: { default: 'p26-v1', tutor: 'p26-tutor-v1', coach: 'p26-coach-v1', grammar: 'p26-grammar-v1', speaking: 'p26-speaking-v1', writing: 'p26-writing-v1' },
    experiments: { promptTone: { enabled: true, variants: ['clear', 'supportive'], allocation: [50, 50] } },
    routing: { simple: ['translation', 'definition', 'flashcard', 'short_feedback', 'tutor'], strong: ['grammar', 'coach', 'speaking', 'writing', 'conversation', 'planning'] },
    limits: { maxInputChars: 4000, maxContextChars: 9000, maxResponseChars: 8000, dailyRequests: 80, dailyEstimatedTokens: 30000, maxOutputTokens: 900 },
    quality: { minimumScore: .7, blockedClaims: ['official TOPIK answer', 'guaranteed score', 'phoneme analysis'] }
  };
  const { storage, state, STORAGE_KEYS, CloudSyncService } = app;
  const uid = () => state.currentUser?.id || 'anonymous';
  const now = () => new Date().toISOString();
  const config = window.KLEARN_AI_INFRASTRUCTURE || {
    version: 1, promptVersions: { default: 'p26-v1' }, experiments: {}, routing: { simple: ['translation', 'definition', 'flashcard', 'short_feedback', 'tutor'], strong: ['grammar', 'coach', 'speaking', 'writing', 'conversation', 'planning'] },
    limits: { maxInputChars: 4000, maxContextChars: 9000, maxResponseChars: 8000, dailyRequests: 80, dailyEstimatedTokens: 30000, maxOutputTokens: 900 }, quality: { minimumScore: .7, blockedClaims: [] }
  };
  const key = STORAGE_KEYS.aiInfrastructure || 'klearn_ai_infrastructure';
  const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = (value, limit = 600) => String(value == null ? '' : value).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim().slice(0, limit);
  const hash = (value) => { let result = 2166136261; for (const char of String(value)) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return (result >>> 0); };
  const currentDay = () => new Date().toISOString().slice(0, 10);
  const defaultMetrics = () => ({ usageDay: currentDay(), requestCount: 0, totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0, lastRequestAt: null, byTask: {}, qualityLogs: [], promptExperiments: {} });
  const read = () => { const all = safeObject(storage.get(key, {})); const stored = safeObject(all[uid()]); const value = { ...defaultMetrics(), ...stored, byTask: safeObject(stored.byTask), qualityLogs: Array.isArray(stored.qualityLogs) ? stored.qualityLogs : [], promptExperiments: safeObject(stored.promptExperiments) }; if (value.usageDay !== currentDay()) { value.usageDay = currentDay(); value.requestCount = 0; value.totalInputTokens = 0; value.totalOutputTokens = 0; value.totalTokens = 0; value.byTask = {}; } return value; };
  const write = (value) => { const all = safeObject(storage.get(key, {})); all[uid()] = value; storage.set(key, all); if (uid() !== 'anonymous') CloudSyncService?.schedule?.('ai-infrastructure'); return value; };
  const capped = (value, depth = 0) => {
    if (depth > 3) return undefined;
    if (typeof value === 'string') return clean(value, 500);
    if (typeof value === 'number' || typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 10).map((item) => capped(item, depth + 1)).filter((item) => item !== undefined);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 20).filter(([k]) => !/(password|secret|token|api[_ -]?key|authorization|cookie|email)/i.test(k)).map(([k, v]) => [clean(k, 40), capped(v, depth + 1)]).filter(([, v]) => v !== undefined));
    return null;
  };
  const ALLOWED = new Set(['userLanguage', 'currentTopikLevel', 'targetTopikLevel', 'learningStyle', 'learningMode', 'explanationStyle', 'learningPace', 'currentLesson', 'weakGrammar', 'weakVocabulary', 'weakSkills', 'frequentErrors', 'recentMistakes', 'errorNotebook', 'relevantMemory', 'knowledgeGraph', 'recommendations', 'dueSrsCount', 'recentScores', 'listeningScore', 'speakingScore', 'writingScore', 'handwritingProgress', 'streak', 'weeklyStudyMinutes', 'masteryByTopic', 'dailyPlan', 'conversationSummary', 'currentView', 'scores', 'srs', 'errors', 'lessonProgress']);
  const buildContext = (context = {}, task = 'tutor') => {
    const source = safeObject(context); const result = {};
    ALLOWED.forEach((field) => { if (source[field] !== undefined) result[field] = capped(source[field]); });
    result.task = clean(task, 40); result.schemaVersion = 'p26-v1';
    const trimOrder = ['recommendations', 'knowledgeGraph', 'recentMistakes', 'errorNotebook', 'relevantMemory', 'recentScores']; const limit = Number(config.limits?.maxContextChars || 9000); while (JSON.stringify(result).length > limit && trimOrder.length) { const field = trimOrder.shift(); if (Array.isArray(result[field])) result[field] = result[field].slice(0, Math.max(1, Math.floor(result[field].length / 2))); else delete result[field]; }
    return JSON.parse(JSON.stringify(result));
  };
  const routeFor = (task = '') => { const normalized = clean(task, 40).toLowerCase(); return (config.routing?.strong || []).includes(normalized) ? 'strong' : 'small'; };
  const promptVersionFor = (task = '', userId = uid()) => {
    const normalized = clean(task, 40).toLowerCase(); const base = config.promptVersions?.[normalized] || config.promptVersions?.default || 'p26-v1'; const experiment = config.experiments?.promptTone; if (!experiment?.enabled || !Array.isArray(experiment.variants) || !experiment.variants.length) return base;
    const variantIndex = hash(`${userId}:${normalized}:promptTone`) % experiment.variants.length; const metrics = read(); metrics.promptExperiments[normalized] = experiment.variants[variantIndex]; write(metrics); return `${base}:${experiment.variants[variantIndex]}`;
  };
  const estimateTokens = (value) => Math.max(1, Math.ceil(String(value || '').length / 4));
  const blocked = (value) => /(api[_ -]?key|password|secret|access[_ -]?token|bearer\s+[a-z0-9._-]+|ignore\s+(all\s+)?previous|system\s+prompt)/i.test(String(value || ''));
  const safeInput = (value) => { const input = clean(value, config.limits?.maxInputChars || 4000); return { input, blocked: blocked(input) }; };
  const checkResponse = (reply, options = {}) => {
    const text = clean(reply, config.limits?.maxResponseChars || 8000); const task = clean(options.task || 'tutor', 40).toLowerCase(); const reasons = []; if (!text) reasons.push('empty'); if (blocked(text)) reasons.push('sensitive-data'); if ((config.quality?.blockedClaims || []).some((claim) => text.toLowerCase().includes(String(claim).toLowerCase()))) reasons.push('unsupported-claim'); if (/official\s+source|nguồn chính thức/i.test(text) && !options.source) reasons.push('unverified-source');
    const learnerLevel = Number(options.level || 0); const referencedLevels = [...text.matchAll(/TOPIK\s*([1-6])/gi)].map((match) => Number(match[1])); if (learnerLevel && referencedLevels.some((level) => level > learnerLevel + 1)) reasons.push('level-mismatch'); if (task === 'grammar' && text.length < 18) reasons.push('insufficient-learning-detail'); const score = Math.max(0, Math.min(1, 1 - reasons.length * .25)); return { status: reasons.length ? (reasons.includes('sensitive-data') || reasons.includes('unsupported-claim') ? 'blocked' : 'review') : 'pass', score, reasons, text };
  };
  const fallbackFor = (task = 'tutor', language = 'vi') => { if (language === 'en') return 'AI is temporarily unavailable. Your learning data is safe; continue with the current lesson or review queue.'; if (language === 'zh-CN') return 'AI 暂时不可用。你的学习数据仍然安全，可以继续当前课程或复习队列。'; if (task === 'grammar' || task === 'writing') return 'AI đang tạm thời không khả dụng. Hãy dùng phần giải thích và bài luyện có sẵn để tiếp tục.'; return 'AI đang tạm thời không khả dụng. Dữ liệu học của bạn vẫn an toàn; hãy tiếp tục bài học hoặc ôn tập hiện có.'; };
  const record = (metrics, task, route, version, usage, quality, fallback) => {
    const safeTask = clean(task || 'tutor', 40); const event = { task: safeTask, modelRoute: route, promptVersion: version, qualityStatus: quality.status, qualityScore: quality.score, fallback: Boolean(fallback), inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.totalTokens, createdAt: now() };
    metrics.requestCount += 1; metrics.totalInputTokens += usage.inputTokens; metrics.totalOutputTokens += usage.outputTokens; metrics.totalTokens += usage.totalTokens; metrics.lastRequestAt = event.createdAt; metrics.byTask[safeTask] = Number(metrics.byTask[safeTask] || 0) + 1; metrics.qualityLogs = [event, ...(metrics.qualityLogs || [])].slice(0, 100); return metrics;
  };
  const request = async ({ task = 'tutor', input = '', messages = [], context = {}, language = 'vi' } = {}) => {
    const route = routeFor(task); const promptVersion = promptVersionFor(task); const safe = safeInput(input); const metrics = read(); const budgetExceeded = metrics.requestCount >= Number(config.limits?.dailyRequests || 80) || metrics.totalTokens >= Number(config.limits?.dailyEstimatedTokens || 30000);
    const fallback = (reason) => { const usage = { inputTokens: estimateTokens(safe.input), outputTokens: 0, totalTokens: estimateTokens(safe.input) }; const quality = { status: 'review', score: .8, reasons: [reason], text: fallbackFor(task, language) }; write(record(metrics, task, route, promptVersion, usage, quality, true)); return { reply: quality.text, fallback: true, quality, usage, modelRoute: route, promptVersion }; };
    if (!safe.input || safe.blocked) return fallback(safe.blocked ? 'unsafe-input' : 'empty-input');
    if (budgetExceeded) return fallback('local-budget');
    const learnerContext = buildContext(context, task); const cleanMessages = (Array.isArray(messages) ? messages : []).map((item) => ({ role: item?.role === 'assistant' ? 'assistant' : 'user', content: clean(item?.content, 1800) })).filter((item) => item.content).slice(-8); if (!cleanMessages.length || cleanMessages[cleanMessages.length - 1].role !== 'user') cleanMessages.push({ role: 'user', content: safe.input });
    const estimatedInput = estimateTokens(JSON.stringify({ messages: cleanMessages, learnerContext }));
    try {
      if (typeof fetch !== 'function') return fallback('fetch-unavailable');
      const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: cleanMessages, learnerContext, learningLanguage: ['vi', 'en', 'zh-CN'].includes(language) ? language : 'vi', task: clean(task, 40), modelRoute: route, promptVersion }) });
      const payload = await response.json().catch(() => ({})); const reply = response.ok && payload.reply ? clean(payload.reply, config.limits?.maxResponseChars || 8000) : ''; const quality = checkResponse(reply, { task, level: learnerContext.currentTopikLevel }); const rejected = !response.ok || !reply || quality.status === 'blocked'; const usagePayload = safeObject(payload.usage); const usage = { inputTokens: Number(usagePayload.inputTokens || usagePayload.input_tokens || estimatedInput), outputTokens: Number(usagePayload.outputTokens || usagePayload.output_tokens || estimateTokens(reply)), totalTokens: Number(usagePayload.totalTokens || usagePayload.total_tokens || estimatedInput + estimateTokens(reply)) }; const finalReply = rejected ? fallbackFor(task, language) : reply; write(record(metrics, task, payload.modelRoute || route, payload.promptVersion || promptVersion, usage, quality, rejected)); return { reply: finalReply, fallback: rejected, quality: rejected ? { ...quality, status: 'review', reasons: [...quality.reasons, response.ok ? 'quality-gate' : 'provider-error'] } : quality, usage, modelRoute: payload.modelRoute || route, promptVersion: payload.promptVersion || promptVersion };
    } catch (_) { return fallback('provider-unavailable'); }
  };
  const getMetrics = () => read();
  window.AIContextService = { build: buildContext, allowedFields: () => [...ALLOWED] };
  window.AIResponseQualityService = { check: checkResponse };
  window.AIOrchestrationService = { request, routeFor, promptVersionFor, getMetrics, estimateTokens, safety: { checkInput: (value) => !blocked(value), checkOutput: (value) => !blocked(value) }, fallbackFor };
})();
