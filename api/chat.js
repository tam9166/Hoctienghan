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
  const compactContext = { currentTopikLevel: learnerContext.currentTopikLevel || null, targetTopikLevel: learnerContext.targetTopikLevel || null, currentLesson: learnerContext.currentLesson || null, weakGrammar: (learnerContext.weakGrammar || []).slice(0, 5), weakVocabulary: (learnerContext.weakVocabulary || []).slice(0, 8), weakSkills: (learnerContext.weakSkills || []).slice(0, 3), recentMistakes: (learnerContext.recentMistakes || []).slice(0, 8), errorNotebook: (learnerContext.errorNotebook || []).slice(0, 10), relevantMemory: (learnerContext.relevantMemory || []).slice(0, 6).map((item) => ({ type: item.type, topic: item.topic, content: item.content, confidence: item.confidence, importance: item.importance, source: item.source })), knowledgeGraph: (learnerContext.knowledgeGraph || []).slice(0, 6).map((item) => ({ id: item.id, type: item.type, label: item.label, related: (item.related || []).slice(0, 6), mastery: item.mastery })), dueSrsCount: learnerContext.dueSrsCount || 0, recentScores: (learnerContext.recentScores || []).slice(0, 5), listeningScore: learnerContext.listeningScore || 0, speakingScore: learnerContext.speakingScore || 0, writingScore: learnerContext.writingScore || 0, handwritingProgress: (learnerContext.handwritingProgress || []).slice(0, 8), streak: learnerContext.streak || 0, weeklyStudyMinutes: learnerContext.weeklyStudyMinutes || 0, masteryByTopic: learnerContext.masteryByTopic || {}, dailyPlan: learnerContext.dailyPlan || null };
  const system = `Bạn là AI Gia sư tiếng Hàn của Tiếng Hàn - TamHoanq. Giải thích grammar, vocabulary, TOPIK, pronunciation, speaking, writing và translation. Trả lời bằng ${language === 'en' ? 'English' : language === 'zh-CN' ? 'Simplified Chinese' : 'Vietnamese'}; giữ nguyên Korean và romanization. Không tuyên bố chấm phoneme/handwriting AI nếu không có model. Chỉ dùng dữ liệu người học trong context JSON dưới đây; nếu thiếu dữ liệu hãy nói rõ, không bịa. Context: ${JSON.stringify(compactContext)}`;
  try {
    const response = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o-mini', input: [{ role: 'system', content: system }, ...messages], max_output_tokens: 900 }) });
    const payload = await response.json();
    if (!response.ok) return res.status(502).json({ error: 'AI provider error' });
    const reply = payload.output_text || payload.output?.flatMap((item) => item.content || []).map((part) => part.text || '').join('') || '';
    return res.status(200).json({ reply: String(reply).slice(0, 8000) });
  } catch (_) { return res.status(502).json({ error: 'AI unavailable' }); }
};
