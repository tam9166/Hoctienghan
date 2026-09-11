#!/usr/bin/env node
'use strict';

/*
 * P62 content inventory audit.
 *
 * This script is deliberately read-only: it loads the same local content sources
 * as the browser, classifies structural risks, and never rewrites learning data.
 * Linguistic correctness and level suitability remain human-review decisions.
 */

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const browser = {};
const context = vm.createContext({ window: browser, console });
const loadScript = (file) => vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
const clean = (value) => String(value ?? '').normalize('NFC').trim();
const normalize = (value) => clean(value).toLocaleLowerCase('vi').replace(/[\p{P}\p{S}\s]+/gu, '');

[
  'data/romanization.js',
  'data/vocabulary-bank.js',
  'data/dictionary.js',
  'data/theory-lessons.js',
  'data/learning-modules.js',
  'data/practice-bank.js'
].forEach(loadScript);

const vocabulary = browser.KLEARN_VOCABULARY || [];
const dictionary = browser.KLEARN_DICTIONARY || [];
const theoryLessons = browser.KLEARN_THEORY_LESSONS || [];
const modules = browser.KLEARN_MODULE_DATA || {};
const practiceBank = browser.KLEARN_PRACTICE_BANK || { sets: [], getQuestions: () => [] };
const cmsFiles = ['content/beginner.json', 'content/topik1.json', 'content/topik2.json'];
const cmsItems = cmsFiles.flatMap((file) => readJson(file).items.map((item) => ({ ...item, _sourceFile: file })));
const advanced = readJson('content/advanced-content-platform.json');
const quality = readJson('content/content-quality-system.json');
const approvedReviews = new Map((quality.reviews || []).map((review) => [review.contentId, review]));

const severity = { VALID: 0, 'NEEDS REVIEW': 1, DUPLICATE: 2, 'MISSING DATA': 3, INCORRECT: 4 };
const rows = [];
const add = ({ id, type, level = 'UNKNOWN', status = 'unreviewed', source, classifications = [], issues = [] }) => {
  const uniqueClasses = [...new Set(classifications.length ? classifications : ['VALID'])];
  const classification = uniqueClasses.sort((a, b) => severity[b] - severity[a])[0];
  rows.push({ id, type, level, status, classification, issues: [...new Set(issues)], source });
};
const buckets = (items, valueFor) => {
  const result = new Map();
  items.forEach((item) => {
    const value = normalize(valueFor(item));
    if (!value) return;
    const list = result.get(value) || [];
    list.push(item);
    result.set(value, list);
  });
  return [...result.entries()].filter(([, items]) => items.length > 1);
};

const duplicateSurfaceIds = new Set(buckets(vocabulary, (item) => item.korean).flatMap(([, items]) => items.map((item) => item.id)));
const duplicateWordMeaningIds = new Set(buckets(vocabulary, (item) => `${item.korean}|${item.meaningVi}`).flatMap(([, items]) => items.map((item) => item.id)));
const duplicateMeaningGroups = buckets(vocabulary, (item) => item.meaningVi).map(([meaning, items]) => ({ meaning, ids: items.map((item) => item.id), words: [...new Set(items.map((item) => item.korean))] }));
const validParts = new Set(['noun', 'verb', 'adjective', 'adverb', 'phrase', 'number', 'particle', 'pronoun', 'determiner', 'interjection']);

vocabulary.forEach((item) => {
  const classifications = ['NEEDS REVIEW'];
  const issues = [];
  if (duplicateSurfaceIds.has(item.id)) { classifications.push('DUPLICATE'); issues.push('DUPLICATE_SURFACE_REVIEW'); }
  if (duplicateWordMeaningIds.has(item.id)) { classifications.push('DUPLICATE'); issues.push('DUPLICATE_WORD_AND_MEANING'); }
  if (!clean(item.meaningVi)) { classifications.push('MISSING DATA'); issues.push('MISSING_VIETNAMESE_MEANING'); }
  if (!clean(item.partOfSpeech)) { classifications.push('MISSING DATA'); issues.push('MISSING_PART_OF_SPEECH'); }
  else if (!validParts.has(item.partOfSpeech)) { classifications.push('INCORRECT'); issues.push('INVALID_PART_OF_SPEECH'); }
  if (![1, 2, 3, 4, 5, 6].includes(Number(item.topikLevel))) { classifications.push('INCORRECT'); issues.push('INVALID_TOPIK_LEVEL'); }
  else issues.push('TOPIK_LEVEL_REQUIRES_HUMAN_VALIDATION');
  if (!clean(item.exampleKo)) { classifications.push('MISSING DATA'); issues.push('MISSING_EXAMPLE'); }
  else if (clean(item.exampleKo).startsWith('오늘의 표현은')) issues.push('TEMPLATE_EXAMPLE');
  if (item.romanizationSource === 'automatic-fallback') issues.push('AUTOMATIC_ROMANIZATION');
  issues.push('AUDIO_IS_TTS_INPUT_NOT_NATIVE_RECORDING');
  add({ id: item.id, type: 'vocabulary', level: `TOPIK_${item.topikLevel}`, source: 'data/vocabulary-bank.js', classifications, issues });
});

theoryLessons.forEach((item) => {
  const missing = [];
  if (!item.vocabulary?.length) missing.push('EMPTY_VOCABULARY');
  if (!item.examples?.length) missing.push('EMPTY_EXAMPLES');
  if (!Object.keys(item.listening || {}).length) missing.push('EMPTY_LISTENING');
  if (!Object.keys(item.reading || {}).length) missing.push('EMPTY_READING');
  if (/Mẫu câu trọng tâm/.test(clean(item.grammar?.vi))) missing.push('GENERIC_GRAMMAR_PLACEHOLDER');
  add({ id: item.id, type: 'lesson', level: `TOPIK_${item.topikLevel}`, status: 'unreviewed', source: 'data/theory-lessons.js', classifications: missing.length ? ['MISSING DATA'] : ['NEEDS REVIEW'], issues: [...missing, 'NO_EDITORIAL_REVIEW_METADATA'] });
});

cmsItems.forEach((item) => {
  const issues = [];
  const classifications = [];
  if (!item.verified || item.reviewStatus !== 'approved') { classifications.push('NEEDS REVIEW'); issues.push('NOT_APPROVED'); }
  if (!item.version) { classifications.push('MISSING DATA'); issues.push('MISSING_VERSION'); }
  if (!item.createdAt || !item.updatedAt) { classifications.push('MISSING DATA'); issues.push('MISSING_VERSION_TIMESTAMPS'); }
  if (!item.reviewerId && !item.reviewer) { classifications.push('NEEDS REVIEW'); issues.push('MISSING_REVIEWER_EVIDENCE'); }
  if (item.type === 'audio' && item.body?.fallback === 'speech-synthesis') { classifications.push('NEEDS REVIEW'); issues.push('BROWSER_TTS_NOT_NATIVE_AUDIO'); }
  if (item.type === 'grammar' && (!item.body?.meaningVi || !item.body?.example)) { classifications.push('MISSING DATA'); issues.push('INCOMPLETE_GRAMMAR_BODY'); }
  add({ id: item.id, type: item.type, level: item.difficulty, status: item.reviewStatus, source: item._sourceFile, classifications: classifications.length ? classifications : ['VALID'], issues });
});

const advancedItems = [...(advanced.catalog || []), ...(advanced.examples || []), ...(advanced.vocabulary || [])];
advancedItems.forEach((item) => {
  const review = approvedReviews.get(item.id);
  const issues = [];
  const classifications = [];
  if (item.status !== 'approved') { classifications.push('NEEDS REVIEW'); issues.push(`STATUS_${String(item.status || 'unreviewed').toUpperCase()}`); }
  if (!item.version || !item.createdAt || !item.updatedAt) { classifications.push('MISSING DATA'); issues.push('INCOMPLETE_VERSION_METADATA'); }
  if (!review) { classifications.push('NEEDS REVIEW'); issues.push('NO_CONTENT_QUALITY_REVIEW'); }
  else {
    if (review.reviewStatus !== 'approved') { classifications.push('NEEDS REVIEW'); issues.push('QUALITY_REVIEW_NOT_APPROVED'); }
    if (!review.nativeChecked || !review.grammarChecked || !review.exampleChecked || !review.difficultyValidated) { classifications.push('NEEDS REVIEW'); issues.push('QUALITY_CHECKS_INCOMPLETE'); }
    if (Number(review.audio?.score) < 80) { classifications.push('NEEDS REVIEW'); issues.push('AUDIO_SCORE_BELOW_GATE'); }
  }
  add({ id: item.id, type: item.type === 'word' ? 'vocabulary' : item.type, level: item.level || item.difficulty || 'UNKNOWN', status: item.status, source: 'content/advanced-content-platform.json', classifications: classifications.length ? classifications : ['VALID'], issues });
});

(modules.speakingModes || []).forEach((item) => add({
  id: `speaking-${item.id}`, type: 'speaking', level: `TOPIK_${item.topikLevel || 1}`, source: 'data/learning-modules.js',
  classifications: ['NEEDS REVIEW'], issues: ['NO_EDITORIAL_REVIEW_METADATA', 'DEVICE_TTS_REFERENCE_AUDIO']
}));
(modules.roleplays || []).forEach((item) => add({
  id: `roleplay-${item.id}`, type: 'speaking', level: 'UNMAPPED', source: 'data/learning-modules.js',
  classifications: ['NEEDS REVIEW'], issues: ['MISSING_LEVEL', 'NO_EDITORIAL_REVIEW_METADATA']
}));
(modules.writingPrompts || []).forEach((item) => add({
  id: item.id, type: 'writing', level: `TOPIK_${item.level}`, source: 'data/learning-modules.js',
  classifications: ['NEEDS REVIEW'], issues: ['NO_EDITORIAL_REVIEW_METADATA', 'SAMPLE_ANSWER_REQUIRES_HUMAN_REVIEW']
}));

const practiceQuestions = (practiceBank.sets || []).flatMap((set) => practiceBank.getQuestions(set.id).map((question) => ({ ...question, set })));
practiceQuestions.forEach(({ set, ...question }) => {
  const isTopik = /^TOPIK_[1-6]$/.test(set.level);
  const type = isTopik ? 'topik_question' : question.skill === 'listening' ? 'listening' : 'practice_question';
  const issues = ['GENERATED_FROM_TEMPLATE', 'NO_EDITORIAL_REVIEW_METADATA'];
  if (question.skill === 'listening') issues.push('AUDIO_IS_BROWSER_TTS');
  if (!clean(question.explanationVi)) issues.push('MISSING_ANSWER_EXPLANATION');
  add({ id: question.id, type, level: set.level, source: 'data/practice-bank.js', classifications: [issues.includes('MISSING_ANSWER_EXPLANATION') ? 'MISSING DATA' : 'NEEDS REVIEW'], issues });
});

const dictionaryDuplicateIds = new Set(buckets(dictionary, (item) => `${item.korean}|${item.meanings?.vi || item.meaningVi}`).flatMap(([, items]) => items.map((item) => item.id)));
dictionary.forEach((item) => {
  const issues = [];
  const classifications = ['NEEDS REVIEW'];
  if (dictionaryDuplicateIds.has(item.id)) { classifications.push('DUPLICATE'); issues.push('DUPLICATE_ENTRY'); }
  if (!clean(item.korean)) { classifications.push('MISSING DATA'); issues.push('MISSING_KOREAN'); }
  if (!clean(item.meanings?.vi || item.meaningVi)) { classifications.push('MISSING DATA'); issues.push('MISSING_VIETNAMESE_MEANING'); }
  if (!item.examples?.length) { classifications.push('MISSING DATA'); issues.push('MISSING_USAGE_EXAMPLE'); }
  if (/^(derived-|phrase-generated-)/.test(item.id)) issues.push('GENERATED_DERIVATION_REQUIRES_REVIEW');
  issues.push('AUDIO_IS_TTS_INPUT_NOT_NATIVE_RECORDING');
  add({ id: item.id, type: 'dictionary', level: `TOPIK_${item.topikLevel || 1}`, source: 'data/dictionary.js', classifications, issues });
});

const countBy = (key) => rows.reduce((result, row) => { const value = row[key]; result[value] = (result[value] || 0) + 1; return result; }, {});
const issueCounts = rows.flatMap((row) => row.issues).reduce((result, issue) => { result[issue] = (result[issue] || 0) + 1; return result; }, {});
const audioOrigins = {
  nativeRecording: 0,
  aiVoice: 0,
  browserTts: rows.filter((row) => row.issues.some((issue) => /TTS/.test(issue))).length,
  missingOrUnclassified: rows.filter((row) => ['listening', 'speaking'].includes(row.type) && !row.issues.some((issue) => /TTS|AUDIO/.test(issue))).length
};
const summary = {
  generatedAt: new Date().toISOString(),
  mode: 'read-only structural audit; linguistic accuracy requires human review',
  total: rows.length,
  byType: countBy('type'),
  byClassification: countBy('classification'),
  issueCounts,
  vocabulary: {
    total: vocabulary.length,
    duplicateSurfaceGroups: buckets(vocabulary, (item) => item.korean).length,
    duplicateWordAndMeaningGroups: buckets(vocabulary, (item) => `${item.korean}|${item.meaningVi}`).length,
    duplicateMeaningGroups: duplicateMeaningGroups.length,
    automaticRomanization: vocabulary.filter((item) => item.romanizationSource === 'automatic-fallback').length,
    templateExamples: vocabulary.filter((item) => clean(item.exampleKo).startsWith('오늘의 표현은')).length
  },
  audioOrigins,
  topik: {
    generatedQuestionCount: rows.filter((row) => row.type === 'topik_question').length,
    officialExamSourceVerified: 0,
    missingExplanation: rows.filter((row) => row.type === 'topik_question' && row.issues.includes('MISSING_ANSWER_EXPLANATION')).length
  },
  reviewCoverage: {
    qualityReviewRecords: quality.reviews.length,
    approvedQualityReviewRecords: quality.reviews.filter((item) => item.reviewStatus === 'approved').length,
    inventoryItemsWithQualityReview: rows.filter((row) => approvedReviews.has(row.id)).length
  }
};

const full = { summary, duplicateMeaningGroups, rows };
process.stdout.write(`${JSON.stringify(process.argv.includes('--details') ? full : summary, null, 2)}\n`);
