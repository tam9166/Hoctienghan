const MAX_MESSAGES = 12;
function cleanMessage(item) {
  if (!item || !['user', 'assistant'].includes(item.role)) return null;
  return { role: item.role, content: String(item.content || '').slice(0, 4000) };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const key = process.env.OPENAI_API_KEY;
  if (!key) return res.status(503).json({ configured: false });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const messages = Array.isArray(body.messages) ? body.messages.map(cleanMessage).filter(Boolean).slice(-MAX_MESSAGES) : [];
  if (!messages.length || messages[messages.length - 1].role !== 'user') return res.status(400).json({ error: 'A user message is required' });
  const language = ['vi', 'en', 'zh-CN'].includes(body.learningLanguage) ? body.learningLanguage : 'vi';
  const learnerContext = body.learnerContext && typeof body.learnerContext === 'object' ? body.learnerContext : {};
  const system = `Bạn là AI Gia sư tiếng Hàn của Tiếng Hàn - TamHoanq. Giải thích grammar, vocabulary, TOPIK, pronunciation, speaking, writing và translation. Trả lời bằng ${language === 'en' ? 'English' : language === 'zh-CN' ? 'Simplified Chinese' : 'Vietnamese'}; giữ nguyên Korean và romanization. Không tuyên bố chấm phoneme/handwriting AI nếu không có model. Dùng context người học tối thiểu: current TOPIK ${learnerContext.currentTopikLevel || 'unknown'}, target TOPIK ${learnerContext.targetTopikLevel || 'unknown'}, weak skills ${(learnerContext.weakSkills || []).join(', ') || 'unknown'}, SRS due ${learnerContext.dueSrs || 0}.`;
  try {
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', input: [{ role: 'system', content: system }, ...messages], max_output_tokens: 900 }) });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'AI provider error' });
    const reply = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((part) => part.text || '').join('') || '';
    return res.status(200).json({ reply: String(reply).slice(0, 8000) });
  } catch (_) { return res.status(502).json({ error: 'AI unavailable' }); }
};
