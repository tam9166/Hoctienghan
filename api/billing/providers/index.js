'use strict';
const { assertProvider } = require('./_interface');
const mock = require('./mock');

const providers = new Map([['mock', assertProvider(mock)]]);

module.exports = Object.freeze({
  get(id) { return providers.get(String(id || '').toLowerCase()) || null; },
  available() { return [...providers.keys()]; },
  register(id, provider) { providers.set(String(id), assertProvider(provider)); }
});
