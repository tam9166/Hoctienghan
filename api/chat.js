const MAX_MESSAGES = 12;
const ROUTES = new Set(['small', 'strong']);
const TASKS = new Set(['tutor', 'coach', 'translation', 'definition', 'flashcard', 'short_feedback', 'grammar', 'speaking', 'writing', 'conversation', 'planning']);
const MAX_CONTEXT_CHARS = 9000;
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

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ configured: false });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const messages = Array.isArray(body.messages) ? body.messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES) : [];
  if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'A user message is required' });
  const language = ['vi', 'en', 'zh-CN'].includes(body.learningLanguage) ? body.learningLanguage : 'vi';
  const task = TASKS.has(String(body.task || '').trim()) ? String(body.task).trim() : 'tutor';
  const modelRoute = ROUTES.has(String(body.modelRoute || '').trim()) ? String(body.modelRoute).trim() : ['grammar', 'coach', 'speaking', 'writing', 'conversation', 'planning'].includes(task) ? 'strong' : 'small';
  const promptVersion = String(body.promptVersion || 'p26-v1').slice(0, 80).replace(/[^a-zA-Z0-9:._-]/g, '');
  const learnerContext = body.learnerContext && typeof body.learnerContext === 'object' ? compact(body.learnerContext) : {};
  const rawContext = JSON.stringify(learnerContext).slice(0, MAX_CONTEXT_CHARS);
  if (containsSensitive(messages[messages.length - 1].content) || containsSensitive(rawContext)) return res.status(400).json({ error: 'Unsafe AI request' });
  const system = `Bạn là lớp AI hỗ trợ học tiếng Hàn của Tiếng Hàn - TamHoanq. Task: ${task}. Prompt version: ${promptVersion}. Trả lời bằng ${language === 'en' ? 'English' : language === 'zh-CN' ? 'Simplified Chinese' : 'Vietnamese'}; giữ nguyên Korean và romanization. Giải thích phù hợp trình độ người học, chỉ dùng dữ liệu trong context tối thiểu, nói rõ khi không chắc chắn, không bịa grammar/điểm TOPIK/nguồn chính thức. Không tuyên bố chấm phoneme hoặc handwriting AI nếu không có model. Context: ${rawContext}`;
  try {
    const model = modelRoute === 'strong' ? (process.env.OPENAI_STRONG_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini') : (process.env.OPENAI_SMALL_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini');
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model, input: [{ role: 'system', content: system }, ...messages], max_output_tokens: 900 }) });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'AI provider error' });
    const reply = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((part) => part.text || '').join('') || '';
    if (!reply || containsSensitive(reply)) return res.status(502).json({ error: 'AI quality gate rejected response' });
    const usage = payload.usage || {};
    return res.status(200).json({ reply: String(reply).slice(0, 8000), usage: { inputTokens: usage.input_tokens || usage.prompt_tokens || 0, outputTokens: usage.output_tokens || usage.completion_tokens || 0, totalTokens: usage.total_tokens || 0 }, modelRoute, promptVersion });
  } catch (_) { return res.status(502).json({ error: 'AI unavailable' }); }
};
