#!/usr/bin/env node
'use strict';

// Offline-only TOPIK import validator. This script never downloads or scrapes exam content.
const fs = require('node:fs');
const path = require('node:path');

const input = process.argv[2];
const shouldPrint = process.argv.includes('--print');
if (!input) {
  console.error('Usage: node scripts/import-topik-exams.js <file.json|file.csv> [--print]');
  process.exit(1);
}

const clean = (value, max = 8000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
const allowed = {
  format: new Set(['PBT', 'IBT']),
  level: new Set(['TOPIK I', 'TOPIK II', 'TOPIK I/II']),
  status: new Set(['practice', 'past', 'upcoming']),
  contentStatus: new Set(['metadata-only', 'available', 'withdrawn']),
  answerVerification: new Set(['not-available', 'unverified', 'verified-original', 'verified-official'])
};

function csvRows(text) {
  const rows = []; let row = []; let field = ''; let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]; const next = text[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { row.push(field); field = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) { if (char === '\r' && next === '\n') index += 1; row.push(field); if (row.some((item) => item.trim())) rows.push(row); row = []; field = ''; }
    else field += char;
  }
  row.push(field); if (row.some((item) => item.trim())) rows.push(row);
  const headers = rows.shift()?.map((item) => clean(item, 80)) || [];
  return rows.map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function load(file) {
  const raw = fs.readFileSync(file, 'utf8');
  if (path.extname(file).toLowerCase() === '.csv') return csvRows(raw);
  const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : parsed.examCatalog || [parsed];
}

function validate(exam, index) {
  const prefix = `record[${index}]`; const errors = [];
  ['id','title','level','format','examNumber','status','contentStatus','answerVerification','sourceId'].forEach((field) => { if (!clean(exam[field], 500)) errors.push(`${prefix}.${field} is required`); });
  Object.entries(allowed).forEach(([field, choices]) => { if (exam[field] && !choices.has(exam[field])) errors.push(`${prefix}.${field} is invalid`); });
  if (exam.examDate && !/^\d{4}-\d{2}-\d{2}$/.test(exam.examDate)) errors.push(`${prefix}.examDate must be YYYY-MM-DD`);
  if (exam.contentStatus === 'available' && !['verified-original','verified-official'].includes(exam.answerVerification)) errors.push(`${prefix}: available content requires a verified answer status`);
  if (exam.answerVerification === 'verified-official' && !exam.answer_source_url) errors.push(`${prefix}: official answers require answer_source_url`);
  if (exam.source_type === 'official-schedule' && exam.contentStatus !== 'metadata-only') errors.push(`${prefix}: a schedule source cannot be imported as exam content`);
  return errors;
}

const records = load(path.resolve(input)).map((record) => Object.fromEntries(Object.entries(record).map(([key, value]) => [clean(key, 80), typeof value === 'string' ? clean(value) : value])));
const errors = records.flatMap(validate);
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`Validated ${records.length} TOPIK exam metadata record(s). No network content was fetched.`);
if (shouldPrint) process.stdout.write(`${JSON.stringify(records, null, 2)}\n`);
