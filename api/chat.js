const rateLimit = require('./_rate-limit');
const applyCors = require('./_cors');
const billing = require('./billing/_shared');
const aiQuality = require('./_ai-quality');
const MAX_MESSAGES = 12;
const ROUTES = new Set(['small', 'strong']);
const TASKS = new Set(['tutor', 'coach', 'translation', 'definition', 'flashcard', 'short_feedback', 'grammar', 'grammar_support', 'speaking', 'speaking_feedback', 'realtime_voice_feedback', 'writing', 'sentence_correction', 'weekly_report', 'personalized_practice', 'learning_recommendation', 'conversation', 'planning', 'study_advisor', 'content_explanation', 'practice_creator', 'conversation_partner', 'writing_review', 'career_coach', 'culture_advisor', 'content_difficulty', 'content_translation', 'lesson_draft', 'example_generation', 'audio_script', 'quiz_generation']);
const MAX_CONTEXT_CHARS = 6000;
function cleanMessage(item) {
  if (!item || !['user', 'assistant'].includes(item.role)) return null;
  return { role: item.role, content: String(item.content || '').slice(0, 4000) };
}
function containsSensitive(value) {
  return /(api[_ -]?key|password|secret|access[_ -]?token|bearer\s+[a-z0-9._-]+)/i.test(String(value || ''));
}
function compact(value, depth = 0) {
  if (depth > 3) return undefined;
  if (typeof value === 'string') return value.slice(0, 500);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => compact(item, depth + 1)).filter((item) => item !== undefined);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).slice(0, 20).map(([key, item]) => [key.slice(0, 40), compact(item, depth + 1)]).filter(([, item]) => item !== undefined));
  return null;
}
async function recordEvaluation(auth, entry) {
  if (!auth?.ok) return;
  const response = await fetch(`${auth.config.url}/rest/v1/ai_evaluation_logs`, { method: 'POST', headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ user_id: auth.user.id, request_ref: entry.requestRef, task: entry.task, task_value: aiQuality.valueFor(entry.task), model_route: entry.modelRoute, prompt_version: entry.promptVersion, quality_status: entry.quality.status, quality_score: entry.quality.score / 100, accuracy_score: entry.quality.dimensions.accuracy, usefulness_score: entry.quality.dimensions.usefulness, naturalness_score: entry.quality.dimensions.naturalness, completeness_score: entry.quality.dimensions.completeness, validation_reasons: entry.quality.reasons, fallback: entry.fallback, input_tokens: entry.usage.inputTokens, output_tokens: entry.usage.outputTokens, total_tokens: entry.usage.totalTokens, latency_ms: entry.latencyMs, estimated_cost_micros: entry.estimatedCostMicros, cost_source: entry.estimatedCostMicros === null ? 'not_configured' : 'server_environment', cache_status: 'bypass', subscription_plan: ['free','premium','pro'].includes(entry.plan) ? entry.plan : 'free' }) }).catch(() => null);
  return response?.ok;
}

module.exports = async function handler(req, res) {
  if (applyCors(req, res, ['POST'])) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const limit = rateLimit(req, { bucket: 'ai', max: 40, windowMs: 60000 });
  if (!limit.allowed) { res.setHeader('Retry-After', String(limit.retryAfterSeconds)); return res.status(429).json({ error: 'Too many AI requests', retryAfterSeconds: limit.retryAfterSeconds }); }
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const consentHeader = String(req?.headers?.['x-klearn-ai-consent'] || '').toLowerCase();
  if (consentHeader !== 'granted' || body.privacy?.aiEnabled !== true) return res.status(403).json({ code: 'AI_DISABLED_BY_USER', error: 'Bạn đã tắt tính năng AI.', action: { label: 'Mở cài đặt', route: 'profile' } });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ configured: false });
  const messages = Array.isArray(body.messages) ? body.messages.map(cleanMessage).filter(Boolean).slice(-8) : [];
  if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'A user message is required' });
  const language = ['vi', 'en', 'zh-CN', 'ko', 'ja', 'zh'].includes(body.learningLanguage) ? body.learningLanguage : 'vi';
  const requestedTask = TASKS.has(String(body.task || '').trim()) ? String(body.task).trim() : 'tutor';
  const task = aiQuality.inferTask(requestedTask, messages[messages.length - 1].content);
  const taskContract = aiQuality.contractFor(task);
  const requestedRoute = ROUTES.has(String(body.modelRoute || '').trim()) ? String(body.modelRoute).trim() : '';
  const modelRoute = taskContract.route || requestedRoute || 'small';
  const promptVersion = String(body.promptVersion || `p68-${task}-v1`).slice(0, 80).replace(/[^a-zA-Z0-9:._-]/g, '');
  const learnerContext = aiQuality.sanitizeContext(body.learnerContext && typeof body.learnerContext === 'object' ? compact(body.learnerContext) : {}, task);
  const rawContext = JSON.stringify(learnerContext).slice(0, MAX_CONTEXT_CHARS);
  if (messages.some((message) => containsSensitive(message.content) || aiQuality.sensitiveValue(message.content)) || containsSensitive(rawContext)) return res.status(400).json({ code: 'AI_PRIVATE_DATA_REJECTED', error: 'AI request contains private or unsafe data' });
  let aiUsage = null; let aiAuth = null;
  if (String(req.headers?.authorization || '').startsWith('Bearer ')) { const candidate = await billing.authenticate(req); if (candidate.ok) aiAuth = candidate; }
  if (process.env.BILLING_ENFORCEMENT_ENABLED === 'true') {
    if (!aiAuth) { const denied = await billing.authenticate(req); return res.status(denied.status).json({ code: 'AI_SUBSCRIPTION_AUTH_REQUIRED', error: denied.error }); }
    const claim = await billing.rpc(aiAuth, 'commercial_claim_ai_usage', { request_tokens: 0 });
    if (!claim.ok) return res.status(claim.status || 503).json({ code: 'AI_QUOTA_UNAVAILABLE', error: claim.error });
    aiUsage = Array.isArray(claim.data) ? claim.data[0] : claim.data;
    if (!aiUsage?.allowed) return res.status(429).json({ code: 'AI_DAILY_LIMIT_REACHED', error: 'Bạn đã dùng hết lượt AI hôm nay. Các chức năng học cốt lõi vẫn hoạt động.', aiUsage });
  }
  const voiceContract = task === 'realtime_voice_feedback' ? ' Chỉ trả về một JSON object hợp lệ, không markdown, gồm replyKo, feedbackVi, correctionKo, naturalness (0-100), reason và confidence (0-1). replyKo phải ngắn, tự nhiên và đúng vai. Không tự chấm phoneme, batchim hoặc acoustic; các điểm đó thuộc bộ phân tích cục bộ.' : '';
  const system = `${aiQuality.buildSystem({ task, language, context: learnerContext })}${voiceContract} Prompt version: ${promptVersion}.`;
  try {
    const startedAt = Date.now();
    const model = modelRoute === 'strong' ? (process.env.OPENAI_STRONG_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.OPENAI_SMALL_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini');
    const requestBody = { model, input: [{ role: 'system', content: system }, ...messages], max_output_tokens: taskContract.maxOutputTokens, store: false };
    if (task === 'realtime_voice_feedback') requestBody.text = { format: { type: 'json_schema', name: 'voice_feedback', strict: true, schema: { type: 'object', properties: { replyKo: { type: 'string' }, feedbackVi: { type: 'string' }, correctionKo: { type: 'string' }, naturalness: { type: 'number', minimum: 0, maximum: 100 }, reason: { type: 'string' }, confidence: { type: 'number', minimum: 0, maximum: 1 } }, required: ['replyKo', 'feedbackVi', 'correctionKo', 'naturalness', 'reason', 'confidence'], additionalProperties: false } } };
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify(requestBody), signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'AI provider error' });
    const reply = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((part) => part.text || '').join('') || '';
    const usage = payload.usage || {};
    const normalizedUsage = { inputTokens: usage.input_tokens || usage.prompt_tokens || 0, outputTokens: usage.output_tokens || usage.completion_tokens || 0, totalTokens: usage.total_tokens || 0 };
    const quality = aiQuality.evaluateResponse(reply, { task, level: learnerContext.currentTopikLevel });
    const requestId = String(payload.id || `ai-${Date.now().toString(36)}`).slice(0, 120); const latencyMs = Date.now() - startedAt; const estimatedCostMicros = aiQuality.estimatedCostMicros(normalizedUsage); const plan = aiUsage?.plan || aiAuth?.user?.app_metadata?.subscription_tier || 'free';
    await recordEvaluation(aiAuth, { requestRef: requestId, task, modelRoute, promptVersion, quality, fallback: !quality.displaySafe, usage: normalizedUsage, latencyMs, estimatedCostMicros, plan });
    if (!quality.displaySafe || containsSensitive(reply)) return res.status(502).json({ code: 'AI_RESPONSE_REJECTED', error: 'Không thể phân tích chính xác. Hãy thử lại.', requestId, quality: { ...quality, text: undefined }, learningCoreAvailable: true });
    return res.status(200).json({ requestId, reply: quality.text, quality: { ...quality, text: undefined }, usage: normalizedUsage, estimatedCostMicros, costSource: estimatedCostMicros === null ? 'not-configured' : 'server-environment', latencyMs, aiUsage, task, modelRoute, promptVersion });
  } catch (error) { return res.status(error?.name === 'TimeoutError' ? 504 : 502).json({ code: error?.name === 'TimeoutError' ? 'AI_TIMEOUT' : 'AI_UNAVAILABLE', error: 'AI tạm thời không khả dụng.', learningCoreAvailable: true }); }
};
