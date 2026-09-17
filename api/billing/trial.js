'use strict';
const crypto = require('node:crypto');
const { authenticate, rpc, begin, clean } = require('./_shared');
module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  if (req.body?.plan !== 'premium' || req.body?.acceptedNoAutoCharge !== true) return res.status(400).json({ error: 'Explicit no-auto-charge confirmation required' });
  const integrityToken = clean(req.headers?.['x-trial-integrity'], 100);
  if (!/^[A-Za-z0-9_-]{24,100}$/.test(integrityToken)) return res.status(400).json({ error: 'Trial integrity proof required' });
  const pepper = String(process.env.TRIAL_ABUSE_PEPPER || process.env.SUPABASE_ANON_KEY || 'tamhoanq-p77-trial');
  const integrityHash = crypto.createHmac('sha256', pepper).update(integrityToken).digest('hex');
  const trial = await rpc(auth, 'p77_start_trial', { accepted_no_auto_charge: true, integrity_key_hash: integrityHash }); if (!trial.ok) return res.status(trial.status || 409).json({ error: trial.error });
  const row = Array.isArray(trial.data) ? trial.data[0] : trial.data;
  return res.status(200).json({ subscription: row, paymentMethodRequired: false, autoCharge: false, autoRenew: false, source: 'server' });
};
