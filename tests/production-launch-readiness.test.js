const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const version = JSON.parse(read('version.json'));
const vercel = JSON.parse(read('vercel.json'));
const healthHandler = require(path.join(root, 'api', 'health.js'));
const versionHandler = require(path.join(root, 'api', 'version.js'));

function responseRecorder() {
  const result = { statusCode: 200, body: null, headers: {} };
  return {
    result,
    response: {
      status(code) { result.statusCode = code; return this; },
      json(body) { result.body = body; return this; },
      setHeader(name, value) { result.headers[name] = value; }
    }
  };
}

(async () => {
  assert.match(version.version, /^\d+\.\d+\.\d+-rc\.\d+$/);
  assert.equal(version.channel, 'release-candidate');
  assert.equal(version.schemaVersion, 13);
  assert.equal(vercel.functions['api/health.js'].maxDuration, 10);
  const securityHeaders = JSON.stringify(vercel.headers);
  assert.match(securityHeaders, /fonts\.googleapis\.com/);
  assert.match(securityHeaders, /fonts\.gstatic\.com/);

  const ci = read('.github/workflows/ci.yml');
  const deploy = read('.github/workflows/deploy-production.yml');
  const monitor = read('.github/workflows/production-monitor.yml');
  assert.match(ci, /permissions:\s*\n\s*contents: read/);
  assert.match(ci, /scripts\/release-readiness\.js/);
  assert.match(deploy, /environment:\s*\n\s*name: production/);
  assert.match(deploy, /push:\s*\n\s*tags:/);
  assert.doesNotMatch(deploy, /pull_request:/);
  assert.match(deploy, /vercel@latest deploy --prebuilt --prod/);
  assert.match(deploy, /smoke-production\.js/);
  assert.match(monitor, /cron: ['"]17,47 \* \* \* \*['"]/);

  for (const document of ['DOMAIN_DEPLOYMENT.md', 'MONITORING.md', 'BACKUP_RESTORE.md', 'INCIDENT_RESPONSE.md', 'USER_SUPPORT.md', 'RELEASE_CHECKLIST.md', 'VERSION_MANAGEMENT.md']) {
    assert.ok(read(`docs/production/${document}`).length > 300, `${document} must contain an actionable runbook`);
  }

  const versionResponse = responseRecorder();
  await versionHandler({ method: 'GET', headers: { 'x-forwarded-for': 'p55-version-test' } }, versionResponse.response);
  assert.equal(versionResponse.result.statusCode, 200);
  assert.equal(versionResponse.result.body.version, version.version);
  assert.match(versionResponse.result.headers['Cache-Control'], /max-age=60/);

  const originalEnvironment = process.env.VERCEL_ENV;
  const originalUrl = process.env.SUPABASE_URL;
  const originalKey = process.env.SUPABASE_ANON_KEY;
  const originalFetch = globalThis.fetch;
  delete process.env.VERCEL_ENV;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  const localHealth = responseRecorder();
  await healthHandler({ method: 'GET', headers: { 'x-forwarded-for': 'p55-local-health-test' } }, localHealth.response);
  assert.equal(localHealth.result.statusCode, 200);
  assert.equal(localHealth.result.body.database.status, 'unconfigured');
  assert.equal(localHealth.result.body.release.version, version.version);
  assert.match(localHealth.result.headers['Cache-Control'], /no-store/);

  process.env.VERCEL_ENV = 'production';
  const productionHealth = responseRecorder();
  await healthHandler({ method: 'GET', headers: { 'x-forwarded-for': 'p55-production-health-test' } }, productionHealth.response);
  assert.equal(productionHealth.result.statusCode, 503);
  assert.equal(productionHealth.result.body.status, 'degraded');

  process.env.SUPABASE_URL = 'https://p55-health-test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'public-anon-test-key';
  globalThis.fetch = async () => ({ ok: false, status: 500 });
  const failedDatabase = responseRecorder();
  await healthHandler({ method: 'GET', headers: { 'x-forwarded-for': 'p55-failed-database-test' } }, failedDatabase.response);
  assert.equal(failedDatabase.result.statusCode, 503);
  assert.equal(failedDatabase.result.body.database.status, 'degraded');

  if (originalEnvironment === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = originalEnvironment;
  if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl;
  if (originalKey === undefined) delete process.env.SUPABASE_ANON_KEY; else process.env.SUPABASE_ANON_KEY = originalKey;
  globalThis.fetch = originalFetch;

  const readiness = JSON.parse(childProcess.execFileSync(process.execPath, ['scripts/release-readiness.js'], { cwd: root, encoding: 'utf8' }));
  assert.equal(readiness.status, 'passed');
  assert.equal(readiness.version, version.version);
  assert.ok(readiness.requiredArtifacts >= 15);
  console.log('P55: release manifest, protected tag deployment, CI, monitoring, production health behavior, runbooks and readiness audit passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
