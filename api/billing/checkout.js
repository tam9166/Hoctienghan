'use strict';
const { allowedPlans, allowedProviders, clean, authenticate, begin } = require('./_shared');
module.exports = async function handler(req, res) {
  if (begin(req, res, ['POST']).stopped) return;
  const auth = await authenticate(req); if (!auth.ok) return res.status(auth.status).json({ error: auth.error });
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  if (!allowedPlans.has(body.plan) || !allowedProviders.has(body.provider) || !['monthly','yearly'].includes(body.billingPeriod) || !/^checkout-[a-z0-9-]{4,80}$/i.test(clean(body.idempotencyKey, 100))) return res.status(400).json({ error: 'Invalid checkout request', entitlementChanged: false });
  // Provider adapters are intentionally disabled until pricing, credentials,
  // signed webhook verification and store-policy review are configured.
  return res.status(503).json({ code: 'PAYMENT_PROVIDER_NOT_CONFIGURED', error: 'Payment architecture is ready, but no provider is live.', provider: body.provider, entitlementChanged: false, webhookRequired: true });
};
