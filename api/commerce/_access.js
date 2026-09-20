'use strict';
const { clean, authenticate, rpc, begin } = require('./_shared');

module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const resourceType = clean(req.body?.resourceType, 40); const accessLevel = clean(req.body?.accessLevel, 40);
  const resourceId = clean(req.body?.resourceId, 80) || null;
  if (!['lesson','course','dashboard','feature','offline_pack'].includes(resourceType) || !['free','premium','teacher_pro'].includes(accessLevel) || (resourceId && !/^[0-9a-f-]{36}$/i.test(resourceId))) return res.status(400).json({ error: 'Invalid resource access request', allowed: false });
  const result = await rpc(auth, 'p77_check_resource_access', { target_resource_type: resourceType, target_resource_id: resourceId, target_access_level: accessLevel });
  if (!result.ok) return res.status(result.status || 503).json({ error: result.error, allowed: false });
  const row = Array.isArray(result.data) ? result.data[0] : result.data;
  return res.status(200).json({ ...row, source: 'server', serverVerified: true });
};
