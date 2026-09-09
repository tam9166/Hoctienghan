const rateLimit = require('./_rate-limit');
const releaseInfo = require('./_release');
const applyCors = require('./_cors');

module.exports = function handler(req, res) {
  if (applyCors(req, res, ['GET'])) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const limit = rateLimit(req, { bucket: 'version', max: 60, windowMs: 60000 });
  if (!limit.allowed) { res.setHeader('Retry-After', String(limit.retryAfterSeconds)); return res.status(429).json({ error: 'Too many version requests' }); }
  res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  return res.status(200).json(releaseInfo());
};
