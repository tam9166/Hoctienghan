'use strict';
const { authenticate, rpc, begin } = require('./_shared');

module.exports = async function handler(req, res) {
  if (begin(req, res, ['GET']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const mode = String(req.query?.mode || 'teacher');
  if (!['teacher','admin'].includes(mode)) return res.status(400).json({ error: 'Invalid dashboard mode' });
  const result = await rpc(auth, mode === 'admin' ? 'p77_admin_business_dashboard' : 'p77_teacher_business_dashboard');
  if (!result.ok) return res.status(result.status || 403).json({ error: result.error });
  return res.status(200).json({ dashboard: result.data, mode, aggregateOnly: true, includesPrivateLearnerData: false, source: 'server' });
};
