#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const data = JSON.parse(read('content/vietnamese-korean-core.json'));
const sections = ['hangulFoundation','vietnameseContrast','naturalSentences','listeningPacks','topikPractice','survivalCourses','cultureNotes','stories'];
const records = sections.flatMap((key) => data[key] || []);

assert.equal(data.reviewPolicy.humanReviewRequired, true);
assert.equal(data.reviewPolicy.aiMayApprove, false);
assert.deepEqual(data.reviewPolicy.workflow, ['DRAFT','AI_CHECK','HUMAN_REVIEW','APPROVE','PUBLISH']);
assert.ok(records.length >= 30 && records.length <= 100, 'controlled pack should be quality-focused, not bulk generated');
assert.equal(new Set(records.map((item) => item.content_id)).size, records.length, 'stable IDs must be unique');
records.forEach((item) => {
  assert.ok(item.content_id && item.type && item.level && item.topic && item.status);
  assert.ok(['APPROVED','NEEDS_REVIEW','INVALID','MISSING_DATA'].includes(item.status));
  assert.ok(Number(item.quality_score) >= 0 && Number(item.quality_score) <= data.reviewPolicy.provisionalScoreCap);
  if (item.status === 'APPROVED') assert.equal(item.reviewEvidence?.humanReviewed, true);
});
assert.equal(records.filter((item) => item.status === 'APPROVED').length, 0, 'agent must not impersonate a human reviewer');
assert.ok(data.hangulFoundation.some((item) => item.demonstration?.result === '한' && item.demonstration.parts.join('') === 'ㅎㅏㄴ'));
assert.ok(data.hangulFoundation.some((item) => item.strokeOrder?.length && item.practice?.provider === 'HandwritingProvider'));
assert.ok(data.hangulFoundation.some((item) => item.type === 'pronunciation' && item.contrasts?.some((group) => group.items.includes('ㄱ ↔ ㅋ ↔ ㄲ'))));
assert.ok(data.vietnameseContrast.every((item) => item.usage && item.vietnameseContrast && item.commonMistakes?.length && item.correctExample && item.incorrectExample && item.repairExercise));
assert.deepEqual(new Set(data.naturalSentences.map((item) => item.register)), new Set(['formal','daily','casual','chat']));
data.listeningPacks.forEach((item) => {
  assert.equal(item.audio.source_type, 'TTS');
  assert.deepEqual(item.audio.speedOptions.map((speed) => speed.id), ['slow','normal','natural']);
  assert.ok(item.transcript && item.vocabulary.length && item.grammar.length && item.question && item.explanation);
});
assert.deepEqual(new Set(data.listeningPacks.map((item) => item.topic)), new Set(['Gọi đồ ở quán cà phê','Đổi lịch họp','Trao đổi ý kiến','Giới thiệu bản thân','Mua đồ','Phỏng vấn','Giao tiếp','Tin tức']));
data.topikPractice.forEach((item) => {
  assert.equal(item.official_verified, false);
  assert.ok(['TOPIK_STYLE_PRACTICE','ORIGINAL_CREATED_CONTENT'].includes(item.source_type));
  assert.match(item.explanation, /(không phải|tự biên|tự biên soạn)/i);
});
assert.deepEqual(new Set(data.survivalCourses.map((item) => item.topic)), new Set(['Nhà hàng','Bệnh viện','Công việc','Du lịch','Du học']));
assert.ok(data.stories[0].chapters.every((chapter) => chapter.dialogue?.length && chapter.vocabulary?.length && chapter.grammar?.length && chapter.quiz));

const app = read('app.js'); const loader = read('data/route-loader.js'); const worker = read('sw.js'); const moduleSource = read('data/content-competitive-upgrade.js'); const css = read('content-competitive.css'); const migration = read('supabase/migrations/20260912_p66_content_competitive_upgrade.sql');
assert.match(app, /competitiveContentProgress: 'klearn_competitive_content_progress'/);
assert.match(app, /STORAGE_KEYS\.competitiveContentProgress/);
assert.match(app, /MAIN_VIEWS\.push\('vietnamese-korean-core'\)/);
assert.match(loader, /competitiveContent/); assert.match(loader, /content-competitive-upgrade\.js\?v=1/); assert.match(loader, /routes\('vietnamese-korean-core'/);
assert.match(worker, /klearn-v87/); assert.match(worker, /content\/vietnamese-korean-core\.json/); assert.match(worker, /content-competitive\.css\?v=1/);
assert.match(moduleSource, /human-review gate/); assert.match(moduleSource, /qualitySystem: 'P66'/); assert.match(moduleSource, /__p66Wrapped/);
assert.match(css, /@media \(max-width: 420px\)/); assert.match(css, /@media \(min-width: 1024px\)/);
assert.doesNotMatch(migration, /\b(delete|truncate)\s+(from\s+)?public\.(user_|learning_|srs|mastery)/i);
assert.doesNotMatch(migration, /update\s+public\.(user_|learning_progress|srs|mastery)/i);
assert.match(migration, /HUMAN_REVIEW|human reviewer|human-review|Human reviewer/i);

const audit = JSON.parse(execFileSync(process.execPath, [path.join(root, 'scripts/audit-competitive-content.js')], { cwd: root, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }));
assert.equal(audit.p66ControlledPackTotal, records.length);
assert.equal(audit.gates.approvedWithoutHumanEvidence, 0);
assert.equal(audit.gates.officialTopikClaimsInP66, 0);
assert.equal(audit.gates.nativeAudioClaimsInP66, 0);
assert.deepEqual(audit.fields, ['content_id','type','level','topic','quality_score','status']);
console.log(`P66 content competitive upgrade checks passed (${records.length} controlled items, ${audit.total} audited total).`);
