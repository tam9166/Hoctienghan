'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const loader = fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const stability = fs.readFileSync(path.join(root, 'data', 'production-stability.js'), 'utf8');

const directScripts = [...index.matchAll(/<script src="([^"]+)"/g)].map((match) => match[1]);
const directStyles = [...index.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((match) => match[1]);

assert.equal(directScripts.length, 23, 'critical script budget changed');
assert.equal(directStyles.length, 5, 'critical stylesheet budget changed');
assert.match(index, /data\/route-loader\.js\?v=1/);
assert.doesNotMatch(index, /data\/advanced-learning-analytics\.js/);
assert.doesNotMatch(index, /advanced-voice\.css/);
assert.match(loader, /const discoveryRoutes = new Set/);
for (const group of ['topik', 'aiInfra', 'advancedAnalytics', 'content', 'voice', 'career']) assert.match(loader, new RegExp(`${group}:`));
assert.match(loader, /assetPromises\.has/);
assert.match(loader, /loadedGroups\.has/);

assert.match(app, /localStorage\.getItem\(key\) === serialized/);
assert.match(app, /\[STORAGE_KEYS\.practiceHistory\]: 1000/);
assert.match(app, /syncPolicy: \{ version: 1, truncatedDomains \}/);
assert.match(app, /const SearchIndexService =/);
assert.match(app, /const pageSize = 30/);
assert.match(app, /messages \|\| \[\]\)\.slice\(-8\)/);

assert.match(worker, /const CACHE = 'klearn-v71'/);
assert.match(worker, /const INSTALL_ASSETS = new Set/);
assert.match(worker, /url\.pathname\.startsWith\('\/api\/'\)/);
assert.match(worker, /request\.headers\.has\('authorization'\)/);
assert.match(worker, /url\.pathname\.startsWith\('\/content\/'\)/);
assert.match(worker, /request\.mode === 'navigate'/);
assert.match(stability, /privateDataCached: false/);
assert.match(stability, /updateConnectivityBanner/);

console.log('P49 contracts: critical budgets, route lazy loading, bounded cloud payloads, indexed search, paginated history, offline cache privacy and recovery UI passed');
