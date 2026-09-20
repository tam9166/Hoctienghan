'use strict';
const { clean, authenticate, rpc, begin } = require('./_shared');

module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const courseId = clean(req.body?.courseId, 80); const provider = clean(req.body?.provider, 40);
  const idempotencyKey = clean(req.body?.idempotencyKey, 100);
  if (!/^[0-9a-f-]{36}$/i.test(courseId) || provider !== 'mock' || !/^purchase-[A-Za-z0-9-]{4,80}$/.test(idempotencyKey)) return res.status(400).json({ error: 'Invalid purchase request', unlocked: false });
  const result = await rpc(auth, 'p77_create_mock_course_purchase', { target_course_id: courseId, request_idempotency_key: idempotencyKey });
  if (!result.ok) return res.status(result.status || 409).json({ error: result.error, unlocked: false });
  return res.status(200).json({ purchase: result.data, unlocked: result.data?.unlocked !== false, source: 'server', cardDataStored: false, paymentSecretStored: false });
};
