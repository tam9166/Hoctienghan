#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const base = String(process.argv[2] || process.env.PRODUCTION_URL || '').trim().replace(/\/$/, '');
if (!/^https:\/\//i.test(base)) throw new Error('Provide an HTTPS production URL as the first argument or PRODUCTION_URL.');
const timeoutMs = Math.max(3000, Number(process.env.SMOKE_TIMEOUT_MS || 15000));
const full = process.env.REQUIRE_FULL_SERVICES === '1';
async function request(path, type = 'text') {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeoutMs); const started = Date.now();
  try { const response = await fetch(`${base}${path}`, { redirect: 'follow', cache: 'no-store', signal: controller.signal, headers: { 'User-Agent': 'KLearn-Production-Smoke/1.0' } }); const body = type === 'json' ? await response.json() : await response.text(); return { response, body, latencyMs: Date.now() - started }; }
  finally { clearTimeout(timer); }
}
(async () => {
  const home = await request('/'); assert.equal(home.response.ok, true, `home returned ${home.response.status}`); assert.match(home.body, /Tiếng Hàn - TamHoanq/);
  const manifest = await request('/manifest.json', 'json'); assert.equal(manifest.response.ok, true); assert.equal(manifest.body.name, 'Tiếng Hàn - TamHoanq');
  const version = await request('/api/version', 'json'); assert.equal(version.response.ok, true); assert.match(version.body.version, /^\d+\.\d+\.\d+/);
  const health = await request('/api/health', 'json'); assert.equal(health.body.backend, 'ok'); assert.equal(health.body.release.version, version.body.version);
  if (full) { assert.equal(health.response.ok, true, `health returned ${health.response.status}`); assert.notEqual(health.body.database.status, 'unconfigured', 'Supabase is not configured'); assert.equal(health.body.ai, 'configured', 'AI is not configured'); }
  console.log(JSON.stringify({ status: 'passed', url: base, fullServices: full, homeMs: home.latencyMs, healthMs: health.latencyMs, version: version.body.version, database: health.body.database.status, ai: health.body.ai }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });
