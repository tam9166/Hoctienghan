const buckets = globalThis.__KLEARN_RATE_LIMIT_BUCKETS || (globalThis.__KLEARN_RATE_LIMIT_BUCKETS = new Map());

module.exports = function rateLimit(req, options = {}) {
  const bucket = String(options.bucket || 'default');
  const max = Math.max(1, Number(options.max || 60));
  const windowMs = Math.max(1000, Number(options.windowMs || 60000));
  const forwarded = req?.headers?.['x-forwarded-for'] || req?.headers?.['x-real-ip'] || req?.socket?.remoteAddress || 'unknown';
  const ip = String(forwarded).split(',')[0].trim().slice(0, 100);
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const current = buckets.get(key);
  const state = current && now - current.startedAt < windowMs ? current : { startedAt: now, count: 0 };
  state.count += 1; buckets.set(key, state);
  if (buckets.size > 10000) for (const [entryKey, entry] of buckets) if (now - entry.startedAt >= windowMs) buckets.delete(entryKey);
  return { allowed: state.count <= max, remaining: Math.max(0, max - state.count), retryAfterSeconds: Math.max(1, Math.ceil((state.startedAt + windowMs - now) / 1000)) };
};
