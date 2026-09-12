'use strict';
const { authenticate, rpc, begin } = require('./_shared');
module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.body?.plan !== 'premium' || req.body?.acceptedNoAutoCharge !== true) return res.status(400).json({ error: 'Explicit no-auto-charge confirmation required' });
  const trial = await rpc(auth, 'commercial_start_trial', { accepted_no_auto_charge: true }); if (!trial.ok) return res.status(trial.status || 409).json({ error: trial.error });
  const row = Array.isArray(trial.data) ? trial.data[0] : trial.data;
  return res.status(200).json({ subscription: row, paymentMethodRequired: false, autoCharge: false, source: 'server' });
};
