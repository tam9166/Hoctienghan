'use strict';
const rateLimit = require('../_rate-limit');
const applyCors = require('../_cors');

const allowedPlans = new Set(['premium', 'pro']);
const allowedProviders = new Set(['stripe', 'google_play', 'apple_store', 'local_payment']);
const clean = (value, max = 500) => String(value || '').normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
function bearer(req) { const value = String(req.headers?.authorization || ''); return /^Bearer\s+\S+$/i.test(value) ? value.replace(/^Bearer\s+/i, '') : ''; }
function environment() {
  const url = String(process.env.SUPABASE_URL || '').replace(/\/$/, ''); const anonKey = String(process.env.SUPABASE_ANON_KEY || '');
  return /^https:\/\//.test(url) && anonKey ? { url, anonKey } : null;
}
async function authenticate(req) {
  const config = environment(); const token = bearer(req); if (!config || !token) return { ok: false, status: 401, error: 'Authenticated cloud account required' };
  try {
    const response = await fetch(`${config.url}/auth/v1/user`, { headers: { apikey: config.anonKey, authorization: `Bearer ${token}` } }); const user = await response.json().catch(() => ({}));
    return response.ok && user.id ? { ok: true, user, token, config } : { ok: false, status: 401, error: 'Invalid session' };
  } catch (_) { return { ok: false, status: 503, error: 'Authentication service unavailable' }; }
}
async function rpc(auth, name, body = {}) {
  const response = await fetch(`${auth.config.url}/rest/v1/rpc/${name}`, { method: 'POST', headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({})); return { ok: response.ok, status: response.status, data: payload, error: response.ok ? '' : clean(payload.message || payload.error || 'Subscription service unavailable', 160) };
}
function begin(req, res, methods) {
  if (applyCors(req, res, methods)) return { stopped: true };
  if (!methods.includes(req.method)) { res.status(405).json({ error: 'Method not allowed' }); return { stopped: true }; }
  const limit = rateLimit(req, { bucket: 'billing', max: 20, windowMs: 60000 });
  if (!limit.allowed) { res.setHeader('Retry-After', String(limit.retryAfterSeconds)); res.status(429).json({ error: 'Too many billing requests' }); return { stopped: true }; }
  return { stopped: false };
}
module.exports = { allowedPlans, allowedProviders, clean, authenticate, rpc, begin };
