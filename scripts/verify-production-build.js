#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const strip = (asset) => asset.replace(/^\.\//, '').split('?')[0];
const exists = (asset) => fs.existsSync(path.join(root, strip(asset)));
const bytes = (asset) => fs.statSync(path.join(root, strip(asset))).size;

const direct = [...index.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+\.(?:js|css))(?:\?[^"]*)?"/g)].map((match) => match[1]);
const lazy = [...loader.matchAll(/['"]([^'"]+\.(?:js|css)(?:\?[^'"]*)?)['"]/g)].map((match) => match[1]);
const directPaths = direct.map(strip);
const lazyPaths = lazy.map(strip);
const unique = (values) => [...new Set(values)];

assert.equal(directPaths.length, unique(directPaths).length, 'duplicate direct asset in index.html');
assert.equal(lazyPaths.length, unique(lazyPaths).length, 'duplicate lazy asset in route loader');
for (const asset of [...direct, ...lazy]) assert.equal(exists(asset), true, `missing production asset: ${asset}`);
assert.match(index, /data\/route-loader\.js\?v=5/);
assert.doesNotMatch(index, /data\/advanced-learning-analytics\.js/);
assert.doesNotMatch(index, /advanced-voice\.css/);

const directBytes = direct.reduce((sum, asset) => sum + bytes(asset), 0);
const lazyBytes = lazy.reduce((sum, asset) => sum + bytes(asset), 0);
console.log(JSON.stringify({
  status: 'passed',
  directAssets: direct.length,
  directBytes,
  lazyAssets: lazy.length,
  lazyBytes,
  totalReferencedBytes: directBytes + lazyBytes
}, null, 2));
