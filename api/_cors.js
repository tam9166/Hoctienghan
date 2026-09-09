'use strict';

const nativeOrigins = new Set(['capacitor://localhost', 'https://localhost']);
const configuredOrigins = () => String(process.env.MOBILE_ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter((value) => {
  try { const url = new URL(value); return url.protocol === 'https:' && url.origin === value.replace(/\/$/, ''); } catch (_) { return false; }
});

module.exports = function applyCors(req, res, methods = ['GET']) {
  const origin = String(req?.headers?.origin || '').trim();
  const allowed = nativeOrigins.has(origin) || configuredOrigins().includes(origin);
  res.setHeader('Vary', 'Origin');
  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', [...new Set([...methods, 'OPTIONS'])].join(', '));
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-KLearn-AI-Consent');
    res.setHeader('Access-Control-Max-Age', '600');
  }
  if (req?.method !== 'OPTIONS') return false;
  if (!allowed) { res.status(403).json({ error: 'Origin not allowed' }); return true; }
  res.status(204);
  if (typeof res.end === 'function') res.end(); else res.json(null);
  return true;
};
