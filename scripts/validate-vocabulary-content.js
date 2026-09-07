#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const browser = {};
const context = vm.createContext({ window: browser });
for (const file of ['data/romanization.js', 'data/vocabulary-bank.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context, { filename: file });
}

const vocabulary = browser.KLEARN_VOCABULARY || [];
const duplicateGroups = (key) => Object.entries(vocabulary.reduce((groups, item) => {
  const value = key(item);
  (groups[value] ||= []).push(item);
  return groups;
}, {})).filter(([, items]) => items.length > 1).map(([value, items]) => ({
  value,
  ids: items.map((item) => item.id),
  meanings: [...new Set(items.map((item) => item.meaningVi))],
  topikLevels: [...new Set(items.map((item) => item.topikLevel))]
}));

const report = {
  generatedAt: new Date().toISOString(),
  source: 'data/vocabulary-bank.js',
  total: vocabulary.length,
  duplicateSurface: duplicateGroups((item) => item.korean),
  duplicateWordAndMeaning: duplicateGroups((item) => `${item.korean}|${item.meaningVi}`),
  automaticRomanization: vocabulary.filter((item) => item.romanizationSource === 'automatic-fallback').map((item) => item.id),
  missingAudioText: vocabulary.filter((item) => !String(item.audioText || '').trim()).map((item) => item.id),
  missingExample: vocabulary.filter((item) => !String(item.exampleKo || '').trim()).map((item) => item.id),
  missingMeaning: vocabulary.filter((item) => !String(item.meaningVi || '').trim()).map((item) => item.id),
  inconsistentTopikLevel: vocabulary.filter((item) => ![1, 2, 3, 4, 5, 6].includes(Number(item.topikLevel))).map((item) => item.id),
  templateExample: vocabulary.filter((item) => String(item.exampleKo || '').startsWith('오늘의 표현은')).map((item) => item.id)
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
