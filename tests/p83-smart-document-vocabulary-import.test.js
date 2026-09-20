#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

function boot() {
  const decks = new Map(); let counter = 0; const importCalls = []; const drafts = [];
  const state = { currentUser: { id: 'p83-user' }, currentView: 'smart-vocabulary-import-p83' };
  const document = { baseURI: 'http://localhost/', querySelector: () => null, querySelectorAll: () => [], createElement: () => ({ getContext: () => ({}) }) };
  const window = {
    document, location: { href: 'http://localhost/' }, confirm: () => true, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    KLEARN_APP: { state, escapeHtml: String, render() {}, setView(view) { state.currentView = view; }, toast() {}, PrivacyPreferenceService: { allows: () => true } },
    P82DeckService: {
      create(input) { const deck = { ...input, id: `deck-${++counter}`, customWords: [], imports: [] }; decks.set(deck.id, deck); return structuredClone(deck); },
      get(id) { return structuredClone(decks.get(id) || null); }, all() { return [...decks.values()].map((item) => ({ ...structuredClone(item), totalWords: item.customWords.length })); }, words(id) { return structuredClone(decks.get(id)?.customWords || []); }
    },
    P82ImportService: { importIntoDeck(deckId, parsed, duplicateMode) { const deck = decks.get(deckId); deck.customWords.push(...structuredClone(parsed.rows)); deck.imports.unshift({ fileName: parsed.fileName, sourceType: parsed.sourceType, sourceFiles: parsed.sourceFiles, added: parsed.rows.length, merged: 0, skipped: 0, createdAt: new Date().toISOString() }); importCalls.push({ deckId, parsed: structuredClone(parsed), duplicateMode }); return { deckId, added: parsed.rows.length, merged: 0, skipped: 0, totalWords: deck.customWords.length }; } },
    TeacherCreatorRoleService: { can: (capability) => capability === 'create_content' },
    CreatorDraftService: { create(input) { const draft = { ...input, id: `draft-${drafts.length + 1}`, status: 'draft' }; drafts.push(draft); return structuredClone(draft); } }
  };
  window.window = window;
  const context = { window, document, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, clearTimeout, Blob, TextDecoder, URL, DOMParser: class {}, fetch: async () => ({ ok: false, json: async () => ({}) }) };
  vm.runInNewContext(read('data/smart-document-vocabulary-import.js'), context);
  return { window, state, decks, importCalls, drafts };
}

(async () => {
  const rt = boot(); const w = rt.window;
  ['P83FileValidationService','P83XlsxParser','P83DocxParser','P83PdfParser','P83StructureService','P83ImageOcrService','P83ImportPipeline','P83TeacherBridgeService','P83OfflineService','SmartDocumentVocabularyImport'].forEach((name) => assert.ok(w[name], `${name} missing`));

  const paired = w.P83StructureService.fromText('학교 - trường học\n먹다: ăn\n친구\nbạn bè', { sourceType:'txt', sourceFileName:'lesson.txt', sourceFingerprint:'src-1' });
  assert.equal(paired.length, 3); assert.equal(paired[0].korean, '학교'); assert.equal(paired[2].meaning, 'bạn bè'); assert.equal(paired.every((row) => row.sourceFileName === 'lesson.txt'), true);
  assert.equal(w.P83StructureService.fromText('Đây chỉ là văn bản tiếng Việt').length, 0);

  const mockFile = (name, bytes, type = '') => ({ name, size: bytes.length, type, lastModified: 1, async arrayBuffer() { return Uint8Array.from(bytes).buffer; } });
  assert.equal((await w.P83FileValidationService.inspect(mockFile('scan.pdf', [0x25,0x50,0x44,0x46,0x2d,0x31], 'application/pdf'))).detected, 'pdf');
  await assert.rejects(() => w.P83FileValidationService.inspect(mockFile('legacy.doc', [0xd0,0xcf,0x11,0xe0,0xa1,0xb1,0x1a,0xe1])), (error) => error.code === 'DOC_LEGACY_UNSUPPORTED');
  await assert.rejects(() => w.P83FileValidationService.inspect(mockFile('fake.pdf', [0x4d,0x5a,0x90,0x00])), (error) => error.code === 'IMPORT_FILE_CORRUPTED');
  await assert.rejects(() => w.P83FileValidationService.inspect(mockFile('empty.txt', [])), (error) => error.code === 'IMPORT_FILE_EMPTY');
  assert.equal(w.P83StructureService.fromText('학교 - trường học', { wordType:'명사' })[0].wordType, 'Danh từ');

  rt.state.p83Import.sources = [{ fileName:'lesson.txt', type:'txt', pages:0 }];
  rt.state.p83Import.rows = paired;
  const committed = w.P83ImportPipeline.commit({ title:'Từ tài liệu', duplicateMode:'merge' });
  assert.equal(committed.added, 3); assert.equal(rt.importCalls.length, 1); assert.equal(rt.importCalls[0].duplicateMode, 'merge'); assert.equal(rt.importCalls[0].parsed.sourceType, 'smart-document'); assert.equal(rt.importCalls[0].parsed.reviewedCount, 3); assert.equal(rt.importCalls[0].parsed.rows[0].reviewStatus, 'confirmed'); assert.equal(rt.importCalls[0].parsed.rows[0].sourceFingerprint, 'src-1'); assert.ok(rt.importCalls[0].parsed.rows[0].importedAt);
  const draft = w.P83TeacherBridgeService.createDraft(committed.deckId); assert.equal(draft.type, 'vocabulary'); assert.equal(draft.status, 'draft'); assert.match(draft.explanation, /Automated Check/);

  const quality = require(path.join(root, 'api', '_ai-quality.js'));
  assert.equal(quality.contractFor('document_ocr').route, 'strong');
  const goodOcr = JSON.stringify({ rows:[{ sourceIndex:0, korean:'학교', meaning:'trường học', wordType:'Danh từ', topic:'Trường học', example:'학교에 가요.', confidence:.95 }] });
  assert.equal(quality.evaluateResponse(goodOcr, { task:'document_ocr' }).displaySafe, true);
  assert.equal(quality.evaluateResponse('{"rows":"bad"}', { task:'document_ocr' }).displaySafe, false);

  const combined = [read('data/smart-document-vocabulary-import.js'), read('data/personal-vocabulary-system.js'), read('api/chat.js'), read('api/_ai-quality.js'), read('data/mobile-native.js'), read('data/route-loader.js'), read('sw.js')].join('\n');
  assert.match(combined, /fflate-0\.8\.2/); assert.match(combined, /pdfjs-5\.4\.624/); assert.match(combined, /DOC_LEGACY_UNSUPPORTED/); assert.match(combined, /TextDetector/); assert.match(combined, /document_ocr/); assert.match(combined, /AI_OCR_BATCH_TOO_LARGE/); assert.match(combined, /reviewStatus/); assert.match(combined, /sourcePage/); assert.match(combined, /CreatorDraftService\.create/); assert.match(combined, /TeacherClassroomWorkspaceService\.createAssignment/); assert.doesNotMatch(combined, /(service_role|private_key|client_secret)\s*[:=]/i);
  assert.equal(fs.existsSync(path.join(root, 'vendor', 'LICENSE.fflate.txt')), true); assert.equal(fs.existsSync(path.join(root, 'vendor', 'LICENSE.pdfjs.txt')), true);
  const vercel = JSON.parse(read('vercel.json')); assert.equal(Object.keys(vercel.functions || {}).length, 7, 'P83 must not add a Vercel function');
  console.log('P83 unit: safe validation, structured text extraction, mandatory reviewed P82 commit, provenance, P76 draft bridge, OCR JSON quality contract, licensed local parsers and 7/12 function cap passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
