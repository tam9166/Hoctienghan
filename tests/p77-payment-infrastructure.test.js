#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const mockProvider = require('../api/billing/providers/mock');
const providerRegistry = require('../api/billing/providers');
const checkoutHandler = require('../api/billing/checkout');
const trialHandler = require('../api/billing/trial');
const accessHandler = require('../api/commerce/access');
const purchaseHandler = require('../api/commerce/purchase');

function response() {
  return { statusCode: 200, headers: {}, payload: null, setHeader(name, value) { this.headers[name] = value; }, status(code) { this.statusCode = code; return this; }, json(value) { this.payload = value; return this; }, end() { return this; } };
}
function request(method, body = {}, headers = {}) { return { method, body, query: {}, headers: { authorization: 'Bearer test-token', 'x-forwarded-for': `${Math.random()}`, ...headers } }; }

async function main() {
  assert.deepEqual(providerRegistry.available(), ['mock']);
  const checkout = await mockProvider.createCheckout({ amount: 199000, currency: 'VND' });
  assert.equal(checkout.provider, 'mock'); assert.equal(checkout.status, 'pending'); assert.equal(checkout.entitlementChanged, false); assert.equal(checkout.testOnly, true);
  assert.match(checkout.transactionId, /^mock_[a-f0-9]{32}$/);
  assert.equal((await mockProvider.verifyTransaction(checkout.transactionId)).status, 'completed');
  assert.equal((await mockProvider.refund(checkout.transactionId)).status, 'refunded');

  const previousFetch = global.fetch; const previousUrl = process.env.SUPABASE_URL; const previousKey = process.env.SUPABASE_ANON_KEY;
  process.env.SUPABASE_URL = 'https://example.supabase.co'; process.env.SUPABASE_ANON_KEY = 'anon-test-key';
  const rpcCalls = [];
  global.fetch = async (url, options = {}) => {
    if (url.includes('/auth/v1/user')) return { ok: true, status: 200, json: async () => ({ id: '11111111-1111-1111-1111-111111111111', created_at: '2026-09-17T00:00:00Z' }) };
    if (url.includes('/rpc/p77_start_trial')) { rpcCalls.push({ url, options }); return { ok: true, status: 200, json: async () => ([{ plan: 'premium', status: 'trial', start_date: '2026-09-17T00:00:00Z', end_date: '2026-09-24T00:00:00Z', auto_renew: false }]) }; }
    if (url.includes('/rpc/p77_check_resource_access')) { rpcCalls.push({ url, options }); return { ok: true, status: 200, json: async () => ([{ allowed: true, reason: 'course_purchase', effective_plan: 'free', server_verified: true }]) }; }
    if (url.includes('/rpc/p77_create_mock_course_purchase')) { rpcCalls.push({ url, options }); return { ok: true, status: 200, json: async () => ({ id: 'purchase-id', status: 'completed', provider: 'mock', payment_id: 'mock_1234567890', unlocked: true }) }; }
    throw new Error(`Unexpected fetch ${url}`);
  };
  try {
    const checkoutRes = response();
    await checkoutHandler(request('POST', { plan: 'teacher_pro', provider: 'mock', billingPeriod: 'monthly', idempotencyKey: 'checkout-p77-test' }), checkoutRes);
    assert.equal(checkoutRes.statusCode, 200); assert.equal(checkoutRes.payload.provider, 'mock'); assert.equal(checkoutRes.payload.entitlementChanged, false); assert.equal(checkoutRes.payload.webhookRequired, true);

    const trialRes = response();
    const rawIntegrity = 'installation_token_1234567890abcdef';
    await trialHandler(request('POST', { plan: 'premium', acceptedNoAutoCharge: true }, { 'x-trial-integrity': rawIntegrity }), trialRes);
    assert.equal(trialRes.statusCode, 200); assert.equal(trialRes.payload.autoRenew, false); assert.equal(trialRes.payload.autoCharge, false);
    const trialBody = JSON.parse(rpcCalls.find((call) => call.url.includes('p77_start_trial')).options.body);
    assert.match(trialBody.integrity_key_hash, /^[a-f0-9]{64}$/); assert.notEqual(trialBody.integrity_key_hash, rawIntegrity);

    const accessRes = response();
    await accessHandler(request('POST', { resourceType: 'course', resourceId: '22222222-2222-2222-2222-222222222222', accessLevel: 'premium' }), accessRes);
    assert.equal(accessRes.statusCode, 200); assert.equal(accessRes.payload.allowed, true); assert.equal(accessRes.payload.serverVerified, true);

    const purchaseRes = response();
    await purchaseHandler(request('POST', { courseId: '22222222-2222-2222-2222-222222222222', provider: 'mock', idempotencyKey: 'purchase-p77-test' }), purchaseRes);
    assert.equal(purchaseRes.statusCode, 200); assert.equal(purchaseRes.payload.unlocked, true); assert.equal(purchaseRes.payload.cardDataStored, false); assert.equal(purchaseRes.payload.paymentSecretStored, false);
  } finally {
    global.fetch = previousFetch;
    if (previousUrl == null) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = previousUrl;
    if (previousKey == null) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = previousKey;
  }

  const serverFiles = ['api/billing/providers/mock.js','api/billing/checkout.js','api/billing/trial.js','api/commerce/purchase.js','api/commerce/purchases.js','api/commerce/course.js'].map(read).join('\n');
  assert.doesNotMatch(serverFiles, /(STRIPE_SECRET|APPLE_SHARED_SECRET|service_role|card_number|card_cvc|payment_secret)\s*[:=]/i);
  assert.match(read('api/billing/providers/_interface.js'), /createCheckout/);
  assert.match(read('api/billing/providers/_interface.js'), /verifyTransaction/);
  assert.match(read('api/billing/providers/_interface.js'), /refund/);
  assert.match(read('api/billing/providers/_interface.js'), /normalizeEvent/);
  console.log('P77 payment infrastructure: provider interface, mock adapter, server verification, hashed trial integrity, idempotent purchase contract and no payment secrets passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
