'use strict';
const { clean, authenticate, rpc, begin } = require('../billing/_shared');

async function select(auth, path) {
  const response = await fetch(`${auth.config.url}/rest/v1/${path}`, { headers: { apikey: auth.config.anonKey, authorization: `Bearer ${auth.token}` } });
  const data = await response.json().catch(() => ([]));
  return { ok: response.ok, status: response.status, data, error: response.ok ? '' : clean(data?.message || data?.error || 'Commerce service unavailable', 160) };
}

module.exports = { clean, authenticate, rpc, begin, select };
