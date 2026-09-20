'use strict';

// One Vercel Function, small domain handlers. Public legacy paths are kept by
// explicit rewrites in vercel.json; the action remains allowlisted here.
const handlers = Object.freeze({
  access: require('./commerce/_access'),
  catalog: require('./commerce/_catalog'),
  course: require('./commerce/_course'),
  dashboard: require('./commerce/_dashboard'),
  purchase: require('./commerce/_purchase'),
  purchases: require('./commerce/_purchases')
});

module.exports = async function commerceRouter(req, res) {
  const action = String(req.query?.action || '').trim().toLowerCase();
  const handler = handlers[action];
  if (!handler) return res.status(404).json({ error: 'Unknown commerce action' });
  return handler(req, res);
};
