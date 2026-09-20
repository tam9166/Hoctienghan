'use strict';

// One Vercel Function, small domain handlers. Public legacy paths are kept by
// explicit rewrites in vercel.json; the action remains allowlisted here.
const handlers = Object.freeze({
  cancel: require('./billing/_cancel'),
  checkout: require('./billing/_checkout'),
  entitlements: require('./billing/_entitlements'),
  trial: require('./billing/_trial')
});

module.exports = async function billingRouter(req, res) {
  const action = String(req.query?.action || '').trim().toLowerCase();
  const handler = handlers[action];
  if (!handler) return res.status(404).json({ error: 'Unknown billing action' });
  return handler(req, res);
};
