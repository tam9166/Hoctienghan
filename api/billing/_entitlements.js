'use strict';
const { authenticate, rpc, begin } = require('./_shared');
module.exports = async function handler(req, res) {
  if (begin(req, res, ['GET']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const subscription = await rpc(auth, 'commercial_current_subscription'); if (!subscription.ok) return res.status(subscription.status || 503).json({ error: subscription.error });
  const row = Array.isArray(subscription.data) ? subscription.data[0] : subscription.data;
  const today = new Date().toISOString().slice(0, 10);
  const usageResponse = await fetch(`${auth.config.url}/rest/v1/commercial_ai_usage_daily?user_id=eq.${encodeURIComponent(auth.user.id)}&usage_date=eq.${today}&select=request_count,token_count`, { headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}` } }).catch(() => null);
  const usageRows = usageResponse?.ok ? await usageResponse.json().catch(() => []) : [];
  const used = Number(usageRows?.[0]?.request_count || 0); const dailyLimit = Number(row?.ai_daily_limit || 5);
  return res.status(200).json({ subscription: row || { plan: 'free', status: 'active', ai_daily_limit: 5 }, aiUsage: { used, dailyLimit, remaining: Math.max(0, dailyLimit - used), source: 'server' }, source: 'server', serverVerified: true });
};
