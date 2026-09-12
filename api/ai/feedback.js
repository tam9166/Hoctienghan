'use strict';
const { clean, authenticate, begin } = require('../billing/_shared');
const ratings = new Set(['helpful', 'not_helpful']);
const reasons = new Set(['wrong_grammar', 'hard_to_understand', 'unnatural_example', 'level_mismatch', 'none']);

module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const requestRef = clean(body.requestRef, 120); const task = clean(body.task, 50); const rating = clean(body.rating, 20); const reason = clean(body.reason || 'none', 40);
  if (!/^[a-zA-Z0-9._:-]{4,120}$/.test(requestRef) || !/^[a-z0-9_]{2,50}$/.test(task) || !ratings.has(rating) || !reasons.has(reason) || (rating === 'not_helpful' && reason === 'none')) return res.status(400).json({ error: 'Invalid AI feedback metadata' });
  const response = await fetch(`${auth.config.url}/rest/v1/ai_response_feedback`, { method: 'POST', headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}`, 'content-type': 'application/json', prefer: 'return=minimal' }, body: JSON.stringify({ user_id: auth.user.id, request_ref: requestRef, task, rating, reason }) });
  if (!response.ok) { const payload = await response.json().catch(() => ({})); return res.status(response.status).json({ error: clean(payload.message || 'Feedback service unavailable', 160) }); }
  return res.status(202).json({ accepted: true, rawPromptStored: false, rawResponseStored: false });
};
