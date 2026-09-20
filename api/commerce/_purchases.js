'use strict';
const { authenticate, select, begin } = require('./_shared');

module.exports = async function handler(req, res) {
  if (begin(req, res, ['GET']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const fields = 'id,course_id,price,currency,status,provider,payment_id,purchased_at';
  const result = await select(auth, `commercial_course_purchases?user_id=eq.${encodeURIComponent(auth.user.id)}&select=${fields}&order=purchased_at.desc`);
  if (!result.ok) return res.status(result.status || 503).json({ error: result.error });
  return res.status(200).json({ purchases: result.data || [], private: true, source: 'server' });
};
