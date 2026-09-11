const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const auditPath = path.join(root, 'scripts', 'audit-content-quality.js');
const migrationPath = path.join(root, 'supabase', 'migrations', '20260911_p62_content_quality_governance.sql');
const report = JSON.parse(execFileSync(process.execPath, [auditPath, '--details'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }));
const migration = fs.readFileSync(migrationPath, 'utf8');

assert.match(report.summary.mode, /read-only/i);
assert.equal(report.rows.length, report.summary.total);
assert.equal(report.summary.vocabulary.total, 1000);
assert.equal(report.summary.byType.lesson >= 120, true);
assert.equal(report.summary.byType.grammar >= 2, true);
assert.equal(report.summary.byType.listening > 0, true);
assert.equal(report.summary.byType.speaking > 0, true);
assert.equal(report.summary.byType.writing > 0, true);
assert.equal(report.summary.byType.topik_question > 0, true);
assert.equal(report.summary.byType.dictionary > 0, true);
assert.equal(report.summary.topik.officialExamSourceVerified, 0);
assert.equal(report.summary.audioOrigins.nativeRecording, 0);
assert.equal(report.summary.audioOrigins.browserTts > 0, true);
assert.equal(report.summary.reviewCoverage.qualityReviewRecords, 4);
assert.equal(report.summary.reviewCoverage.approvedQualityReviewRecords, 3);
assert.equal(report.summary.vocabulary.templateExamples, 1000);
assert.equal(report.summary.vocabulary.automaticRomanization, 986);
assert.equal(report.summary.vocabulary.duplicateSurfaceGroups, 33);

const allowed = new Set(['VALID', 'NEEDS REVIEW', 'INCORRECT', 'MISSING DATA', 'DUPLICATE']);
assert.equal(report.rows.every((row) => row.id && row.type && row.level && row.status && allowed.has(row.classification) && Array.isArray(row.issues)), true);
assert.equal(report.rows.some((row) => row.id === 'freq-학교' && row.issues.includes('AUDIO_SCORE_BELOW_GATE')), true);
assert.equal(report.rows.some((row) => row.type === 'lesson' && row.issues.includes('GENERIC_GRAMMAR_PLACEHOLDER')), true);
assert.equal(report.rows.some((row) => row.type === 'topik_question' && row.issues.includes('GENERATED_FROM_TEMPLATE')), true);

assert.match(migration, /learning_content_versions/);
assert.match(migration, /content_editor/);
assert.match(migration, /Reviewer approval is required/);
assert.match(migration, /Invalid content review transition/);
assert.match(migration, /Only admins can publish or unpublish content/);
assert.match(migration, /Content changes require a higher version/);
assert.match(migration, /completeness_score/);
assert.match(migration, /difficulty_match_score/);
assert.match(migration, /naturalness_score/);
assert.match(migration, /row level security/i);
assert.doesNotMatch(migration, /alter table public\.(user_progress|srs|mastery|learning_history)/i);

console.log('P62 content quality: read-only inventory, human review gates, version history, roles and learner-data isolation passed');
