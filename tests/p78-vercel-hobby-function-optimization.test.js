#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { audit } = require('../scripts/vercel-function-audit');
const billingRouter = require('../api/billing');
const commerceRouter = require('../api/commerce');
const chatHandler = require('../api/chat');
const feedbackHandler = require('../api/ai/feedback');
const configHandler = require('../api/config');

const root = path.join(__dirname, '..');
const expectedRewrites = Object.freeze({
  '/api/billing/cancel': '/api/billing?action=cancel',
  '/api/billing/checkout': '/api/billing?action=checkout',
  '/api/billing/entitlements': '/api/billing?action=entitlements',
  '/api/billing/trial': '/api/billing?action=trial',
  '/api/commerce/access': '/api/commerce?action=access',
  '/api/commerce/catalog': '/api/commerce?action=catalog',
  '/api/commerce/course': '/api/commerce?action=course',
  '/api/commerce/dashboard': '/api/commerce?action=dashboard',
  '/api/commerce/purchase': '/api/commerce?action=purchase',
  '/api/commerce/purchases': '/api/commerce?action=purchases'
});

function response() {
  return {
    statusCode: 200,
    headers: {},
    payload: null,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.payload = value; return this; },
    end() { return this; }
  };
}

function request(method, options = {}) {
  return {
    method,
    query: options.query || {},
    body: options.body || {},
    headers: { 'x-forwarded-for': `p78-${Math.random()}`, ...(options.headers || {}) }
  };
}

function jwt(role) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'none' })}.${encode({ role })}.signature`;
}

async function main() {
  const functionAudit = audit();
  assert.equal(functionAudit.count, 7);
  assert.deepEqual(functionAudit.detected, [
    'api/ai/feedback.js', 'api/billing.js', 'api/chat.js', 'api/commerce.js',
    'api/config.js', 'api/health.js', 'api/version.js'
  ]);

  const vercel = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const actualRewrites = Object.fromEntries(vercel.rewrites.map(({ source, destination }) => [source, destination]));
  assert.deepEqual(actualRewrites, expectedRewrites);
  assert.deepEqual(Object.keys(vercel.functions).sort(), functionAudit.detected);

  let res = response();
  await billingRouter(request('GET', { query: { action: '../../chat' } }), res);
  assert.equal(res.statusCode, 404);
  res = response();
  await commerceRouter(request('GET', { query: { action: 'not-real' } }), res);
  assert.equal(res.statusCode, 404);

  res = response();
  await billingRouter(request('GET', { query: { action: 'entitlements' } }), res);
  assert.equal(res.statusCode, 401);
  res = response();
  await commerceRouter(request('POST', { query: { action: 'access' } }), res);
  assert.equal(res.statusCode, 401);
  res = response();
  await commerceRouter(request('POST', { query: { action: 'catalog' } }), res);
  assert.equal(res.statusCode, 405);

  res = response();
  await chatHandler(request('POST', { body: { privacy: { aiEnabled: false } } }), res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.code, 'AI_DISABLED_BY_USER');

  res = response();
  await feedbackHandler(request('POST', { body: { requestRef: 'request-1234', task: 'tutor', rating: 'helpful' } }), res);
  assert.equal(res.statusCode, 401);

  const priorUrl = process.env.SUPABASE_URL;
  const priorAnon = process.env.SUPABASE_ANON_KEY;
  try {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_ANON_KEY = jwt('service_role');
    res = response();
    configHandler(request('GET'), res);
    assert.deepEqual(res.payload, { configured: false });

    process.env.SUPABASE_ANON_KEY = jwt('anon');
    res = response();
    configHandler(request('GET'), res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.configured, true);
    assert.equal(res.payload.supabasePublishableKey, process.env.SUPABASE_ANON_KEY);
    assert.equal(JSON.stringify(res.payload).includes('service_role'), false);
  } finally {
    if (priorUrl == null) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = priorUrl;
    if (priorAnon == null) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = priorAnon;
  }

  const courseSource = fs.readFileSync(path.join(root, 'api/commerce/_course.js'), 'utf8');
  const dashboardSource = fs.readFileSync(path.join(root, 'api/commerce/_dashboard.js'), 'utf8');
  assert.match(courseSource, /owner_id=eq\.\$\{encodeURIComponent\(auth\.user\.id\)\}/);
  assert.match(courseSource, /status=in\.\(draft,rejected\)/);
  assert.match(dashboardSource, /\['teacher','admin'\]/);
  assert.match(dashboardSource, /p77_admin_business_dashboard/);
  assert.match(dashboardSource, /p77_teacher_business_dashboard/);

  console.log('P78 Vercel optimization: 7 functions, legacy route rewrites, allowlisted dispatch, auth/AI consent, public-key and owner/role security contracts passed');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
