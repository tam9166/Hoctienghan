#!/usr/bin/env node
'use strict';

/* P66 whole-content inventory adapter. Read-only; it never edits content or learner data. */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const previous = JSON.parse(execFileSync(process.execPath, [path.join(__dirname, 'audit-content-quality.js'), '--details'], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
const p66 = JSON.parse(fs.readFileSync(path.join(root, 'content/vietnamese-korean-core.json'), 'utf8'));
const arrays = ['hangulFoundation','vietnameseContrast','naturalSentences','listeningPacks','topikPractice','survivalCourses','cultureNotes','stories'];
const p66Rows = arrays.flatMap((key) => (p66[key] || []).map((item) => ({
  content_id: item.content_id,
  type: item.type,
  level: item.level,
  topic: item.topic,
  quality_score: Number.isFinite(Number(item.quality_score)) ? Number(item.quality_score) : 0,
  status: item.status,
  issues: item.status === 'NEEDS_REVIEW' ? ['HUMAN_REVIEW_REQUIRED'] : [],
  source: 'content/vietnamese-korean-core.json'
})));

const normalizeStatus = (row) => {
  if (row.classification === 'INCORRECT') return 'INVALID';
  if (row.classification === 'MISSING DATA') return 'MISSING_DATA';
  if (row.classification === 'VALID' && row.status === 'approved') return 'APPROVED';
  return 'NEEDS_REVIEW';
};
const structuralScore = (row) => ({ VALID: 85, 'NEEDS REVIEW': 60, DUPLICATE: 45, 'MISSING DATA': 25, INCORRECT: 5 })[row.classification] ?? 40;
const legacyRows = previous.rows.map((row) => ({
  content_id: row.id,
  type: row.type,
  level: row.level,
  topic: 'UNMAPPED',
  quality_score: structuralScore(row),
  status: normalizeStatus(row),
  issues: row.issues,
  source: row.source
}));
const rows = [...legacyRows, ...p66Rows];
const by = (key) => rows.reduce((out, row) => { out[row[key]] = (out[row[key]] || 0) + 1; return out; }, {});
const scores = rows.map((row) => row.quality_score).filter(Number.isFinite);
const summary = {
  generatedAt: new Date().toISOString(),
  mode: 'read-only structural inventory; accuracy/naturalness/difficulty require human review',
  fields: ['content_id','type','level','topic','quality_score','status'],
  total: rows.length,
  previousInventoryTotal: legacyRows.length,
  p66ControlledPackTotal: p66Rows.length,
  byType: by('type'),
  byStatus: by('status'),
  structuralScoreAverage: scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null,
  gates: {
    approvedWithoutHumanEvidence: p66Rows.filter((row) => row.status === 'APPROVED').length,
    officialTopikClaimsInP66: (p66.topikPractice || []).filter((item) => item.official_verified || item.source_type === 'OFFICIAL_VERIFIED').length,
    nativeAudioClaimsInP66: (p66.listeningPacks || []).filter((item) => item.audio?.source_type === 'NATIVE').length
  }
};
process.stdout.write(`${JSON.stringify(process.argv.includes('--details') ? { summary, rows } : summary, null, 2)}\n`);
