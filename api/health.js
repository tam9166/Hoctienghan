const rateLimit = require('./_rate-limit');
const releaseInfo = require('./_release');

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
const configuredSupabase = () => {
  const url = String(process.env.SUPABASE_URL || '').trim();
  const key = String(process.env.SUPABASE_ANON_KEY || '').trim();
  try { const parsed = new URL(url); return { url: parsed.protocol === 'https:' && parsed.hostname.endsWith('.supabase.co') ? url : '', key: key ? '[configured]' : '' }; } catch (_) { return { url: '', key: '' }; }
};

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const limit = rateLimit(req, { bucket: 'health', max: 30, windowMs: 60000 });
  if (!limit.allowed) { res.setHeader('Retry-After', String(limit.retryAfterSeconds)); return res.status(429).json({ status: 'rate_limited', retryAfterSeconds: limit.retryAfterSeconds }); }
  const supabase = configuredSupabase();
  const release = releaseInfo();
  let database = { status: supabase.url && supabase.key ? 'configured' : 'unconfigured', latencyMs: null };
  if (supabase.url && supabase.key && typeof fetch === 'function') {
    const started = Date.now();
    try { const response = await Promise.race([fetch(`${supabase.url}/rest/v1/`, { headers: { apikey: String(process.env.SUPABASE_ANON_KEY), Authorization: `Bearer ${String(process.env.SUPABASE_ANON_KEY)}` } }), timeout(2500)]); database = { status: response.ok || response.status === 404 ? 'ok' : 'degraded', latencyMs: Date.now() - started }; } catch (_) { database = { status: 'unreachable', latencyMs: Date.now() - started }; }
  }
  const ai = process.env.OPENAI_API_KEY ? 'configured' : 'unconfigured';
  const production = release.environment === 'production';
  const criticalDependencyFailed = ['degraded', 'unreachable'].includes(database.status) || (production && database.status === 'unconfigured');
  const status = criticalDependencyFailed ? 'degraded' : 'ok';
  const degradedFeatures = ai === 'unconfigured' ? ['ai'] : [];
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  return res.status(status === 'ok' ? 200 : 503).json({ status, backend: 'ok', database, ai, degradedFeatures, checkedAt: new Date().toISOString(), release });
};
