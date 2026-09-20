#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const apiRoot = path.join(root, 'api');
const hobbyLimit = 12;
const expectedFunctions = Object.freeze([
  'api/ai/feedback.js',
  'api/billing.js',
  'api/chat.js',
  'api/commerce.js',
  'api/config.js',
  'api/health.js',
  'api/version.js'
]);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    return entry.isFile() ? [target] : [];
  });
}

function detectedFunctions() {
  return walk(apiRoot)
    .filter((file) => path.extname(file) === '.js' && !path.basename(file).startsWith('_'))
    .map((file) => path.relative(root, file).replaceAll(path.sep, '/'))
    .sort();
}

function audit() {
  const detected = detectedFunctions();
  const unexpected = detected.filter((file) => !expectedFunctions.includes(file));
  const missing = expectedFunctions.filter((file) => !detected.includes(file));
  if (detected.length > hobbyLimit || unexpected.length || missing.length) {
    const details = [
      `Detected ${detected.length}/${hobbyLimit} Vercel Functions.`,
      unexpected.length ? `Unexpected: ${unexpected.join(', ')}` : '',
      missing.length ? `Missing: ${missing.join(', ')}` : ''
    ].filter(Boolean).join(' ');
    throw new Error(details);
  }
  return { detected, count: detected.length, limit: hobbyLimit };
}

if (require.main === module) {
  try {
    const result = audit();
    console.log(`Vercel Hobby function audit: ${result.count}/${result.limit}`);
    result.detected.forEach((file) => console.log(`- ${file}`));
  } catch (error) {
    console.error(`Vercel Hobby function audit failed: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = { audit, detectedFunctions, expectedFunctions, hobbyLimit };
