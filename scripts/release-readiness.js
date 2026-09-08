#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const required = [
  'version.json', 'vercel.json', '.env.example', 'api/health.js', 'api/version.js',
  '.github/workflows/ci.yml', '.github/workflows/deploy-production.yml', '.github/workflows/production-monitor.yml',
  'docs/production/DOMAIN_DEPLOYMENT.md', 'docs/production/MONITORING.md', 'docs/production/BACKUP_RESTORE.md',
  'docs/production/INCIDENT_RESPONSE.md', 'docs/production/USER_SUPPORT.md', 'docs/production/RELEASE_CHECKLIST.md',
  'docs/production/VERSION_MANAGEMENT.md'
];
required.forEach((file) => assert.equal(fs.existsSync(path.join(root, file)), true, `missing launch artifact: ${file}`));

const version = JSON.parse(read('version.json'));
assert.match(version.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/, 'version must follow SemVer');
assert.equal(version.channel, 'release-candidate');
assert.ok(Number(version.schemaVersion) >= 13);

const vercel = JSON.parse(read('vercel.json'));
const headers = JSON.stringify(vercel.headers || []);
for (const name of ['Content-Security-Policy', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) assert.match(headers, new RegExp(name));
assert.equal(vercel.functions['api/chat.js'].maxDuration <= 30, true);

const envExample = read('.env.example');
for (const name of ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'OPENAI_API_KEY', 'PRODUCTION_URL']) assert.match(envExample, new RegExp(`^${name}=`, 'm'));

const tracked = childProcess.execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
assert.equal(tracked.some((file) => /^\.env(?:\.|$)/.test(file) && file !== '.env.example'), false, 'tracked environment secret file');
const secretPattern = /(-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bservice_role\b\s*[:=]\s*['"][A-Za-z0-9._-]{16,}|\bsk-[A-Za-z0-9_-]{24,})/;
const textExtensions = new Set(['.js', '.json', '.md', '.html', '.css', '.sql', '.yml', '.yaml', '.txt', '.example']);
const leaked = tracked.filter((file) => textExtensions.has(path.extname(file).toLowerCase()) || file === '.env.example').filter((file) => { try { return secretPattern.test(read(file)); } catch (_) { return false; } });
assert.deepEqual(leaked, [], `potential secrets in tracked files: ${leaked.join(', ')}`);

const index = read('index.html');
for (const match of index.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const asset = match[1].split('?')[0];
  if (/^(?:https?:|#|mailto:|data:)/.test(asset)) continue;
  assert.equal(fs.existsSync(path.join(root, asset)), true, `missing entry asset: ${asset}`);
}
const manifest = JSON.parse(read('manifest.json'));
for (const icon of manifest.icons || []) assert.equal(fs.existsSync(path.join(root, icon.src)), true, `missing PWA icon: ${icon.src}`);

const warnings = [];
if (!process.env.PRODUCTION_URL) warnings.push('PRODUCTION_URL is not set; domain smoke check remains pending.');
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) warnings.push('Supabase production configuration must be verified in the deployment environment.');
if (!process.env.OPENAI_API_KEY) warnings.push('AI will use its documented fallback until OPENAI_API_KEY is configured.');
console.log(JSON.stringify({ status: 'passed', version: version.version, requiredArtifacts: required.length, trackedFilesScanned: tracked.length, warnings }, null, 2));
