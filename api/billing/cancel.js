'use strict';
const { clean, authenticate, rpc, begin } = require('./_shared');
module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.body?.preserveProgress !== true) return res.status(400).json({ error: 'Learning progress preservation is required' });
  const projection = await rpc(auth, 'commercial_current_subscription'); if (!projection.ok) return res.status(projection.status || 503).json({ error: projection.error });
  const subscription = (Array.isArray(projection.data) ? projection.data[0] : projection.data) || {};
  if (!['premium','pro'].includes(subscription.plan) || !['active','trial','cancelled'].includes(subscription.status)) return res.status(409).json({ error: 'No active paid subscription' });
  const response = await fetch(`${auth.config.url}/rest/v1/commercial_cancellation_requests`, { method: 'POST', headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}`, 'content-type': 'application/json', prefer: 'return=representation' }, body: JSON.stringify({ user_id: auth.user.id, subscription_plan: subscription.plan, reason: clean(req.body?.reason, 500), preserve_learning_progress: true }) });
  const payload = await response.json().catch(() => ([])); if (!response.ok) return res.status(response.status).json({ error: clean(payload.message || 'Cancellation request failed', 160) });
  return res.status(202).json({ request: Array.isArray(payload) ? payload[0] : payload, progressPreserved: true, entitlementChanged: false });
};
