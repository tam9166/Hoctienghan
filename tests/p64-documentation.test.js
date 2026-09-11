const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const required = [
  'README.md',
  'PROJECT_OVERVIEW.md',
  'SYSTEM_ARCHITECTURE.md',
  'DATABASE_SCHEMA.md',
  'API_DOCUMENTATION.md',
  'AI_ARCHITECTURE.md',
  'LEARNING_ENGINE.md',
  'SECURITY.md',
  'DEVELOPMENT_GUIDE.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'CASE_STUDY.md',
  'DEMO_GUIDE.md',
  'docs/screenshots/README.md',
  'scripts/capture-portfolio-screenshots.js',
  'docs/screenshots/landing.png',
  'docs/screenshots/home.png',
  'docs/screenshots/learning.png',
  'docs/screenshots/grammar.png',
  'docs/screenshots/topik.png',
  'docs/screenshots/assistant.png',
  'docs/screenshots/analytics.png',
  'docs/screenshots/profile.png'
];

required.forEach((file) => {
  assert.ok(fs.existsSync(path.join(root, file)), `Missing documentation artifact: ${file}`);
});

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function validateLocalLinks(file) {
  const source = read(file);
  const markdownLinks = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of source.matchAll(markdownLinks)) {
    let target = match[1].trim();
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
    if (/^(?:https?:|mailto:|#)/i.test(target)) continue;
    target = decodeURIComponent(target.split('#')[0]);
    if (!target) continue;
    const resolved = path.resolve(path.dirname(path.join(root, file)), target);
    assert.ok(fs.existsSync(resolved), `${file} links to a missing local file: ${target}`);
  }
}

[
  'README.md',
  'PROJECT_OVERVIEW.md',
  'SYSTEM_ARCHITECTURE.md',
  'DATABASE_SCHEMA.md',
  'API_DOCUMENTATION.md',
  'AI_ARCHITECTURE.md',
  'LEARNING_ENGINE.md',
  'SECURITY.md',
  'DEVELOPMENT_GUIDE.md',
  'CONTRIBUTING.md',
  'CHANGELOG.md',
  'CASE_STUDY.md',
  'DEMO_GUIDE.md',
  'docs/screenshots/README.md'
].forEach(validateLocalLinks);

const overview = read('PROJECT_OVERVIEW.md');
assert.match(overview, /static SPA\/PWA/i);
assert.match(overview, /release candidate/i);

const architecture = read('SYSTEM_ARCHITECTURE.md');
assert.match(architecture, /```mermaid/);
assert.match(architecture, /route-loader\.js/);
assert.match(architecture, /learning_sync/);

const database = read('DATABASE_SCHEMA.md');
assert.match(database, /logical domains/i);
assert.match(database, /not separate physical tables/i);
assert.match(database, /compare_and_swap_learning_sync/);

const api = read('API_DOCUMENTATION.md');
['/api/config', '/api/chat', '/api/health', '/api/version'].forEach((endpoint) => {
  assert.ok(api.includes(endpoint), `API documentation is missing ${endpoint}`);
});

const security = read('SECURITY.md');
assert.match(security, /does not currently (?:verify|validate) a Supabase JWT/i);
assert.match(security, /in-memory/i);

const readme = read('README.md');
['Product', 'Screenshots', 'Features', 'Architecture', 'Technology', 'Installation', 'Demo', 'Roadmap', 'License', 'Contact'].forEach((section) => {
  assert.match(readme, new RegExp(`## ${section}`, 'i'), `README is missing the ${section} section`);
});
assert.match(readme, /not presented as production-ready/i, 'README must state the release-candidate limitation');

console.log(`P64 documentation contract passed (${required.length} artifacts, local links valid).`);
