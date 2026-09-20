/* P83 — Smart Document & Image Vocabulary Import. Extends P82; never bypasses review. */
(function smartDocumentVocabularyImport(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, escapeHtml = String, render, setView, toast, PrivacyPreferenceService } = app;
  const ROUTE = 'smart-vocabulary-import-p83';
  const HISTORY_ROUTE = 'vocabulary-import-history-p83';
  const MAX_BYTES = 20 * 1024 * 1024;
  const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
  const MAX_FILES = 30;
  const MAX_ROWS = 5000;
  const PAGE_SIZE = 50;
  const IMAGE_TYPES = new Set(['jpg', 'jpeg', 'png', 'webp']);
  const SUPPORTED = new Set(['csv', 'txt', 'json', 'xlsx', 'docx', 'pdf', ...IMAGE_TYPES]);
  const WORD_TYPES = ['Danh từ', 'Động từ', 'Tính từ', 'Trạng từ', 'Đại từ', 'Số từ', 'Trợ từ', 'Cụm từ', 'Khác'];
  const ERROR_CODES = Object.freeze({ unsupported: 'IMPORT_FILE_TYPE_UNSUPPORTED', tooLarge: 'IMPORT_FILE_TOO_LARGE', empty: 'IMPORT_FILE_EMPTY', corrupted: 'IMPORT_FILE_CORRUPTED', read: 'IMPORT_FILE_READ_FAILED', processing: 'IMPORT_FILE_PROCESSING_FAILED', json: 'JSON_INVALID' });
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const runtime = state.p83Import || (state.p83Import = { sources: [], rows: [], warnings: [], errors: [], busy: false, cancelled: false, progress: null, page: 1, destination: 'new', deckId: '', duplicateMode: 'skip', result: null, selectedSheet: {}, aiBusy: false });
  const fileCache = new Map();
  const pdfCache = new Map();
  const now = () => new Date().toISOString();
  const clean = (value, max = 1000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
  const ext = (name) => clean(name, 180).toLocaleLowerCase().split('.').pop();
  const hasHangul = (value) => /[\u3131-\u318e\uac00-\ud7a3]/u.test(String(value || ''));
  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  const hash = (value) => { let result = 2166136261; for (const char of String(value)) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const fail = (code, message, detail = '') => { const error = new Error(message); error.code = code; error.detail = detail; return error; };
  const u8 = (buffer) => buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const starts = (bytes, signature) => signature.every((value, index) => bytes[index] === value);
  const utf8 = (bytes) => decoder.decode(bytes);
  const normalizePath = (path) => String(path || '').replace(/^\/+/, '').replace(/\\/g, '/');
  const xmlText = (bytes) => utf8(bytes || new Uint8Array());
  const parseXml = (text, label) => { const document = new DOMParser().parseFromString(String(text || ''), 'application/xml'); if (document.querySelector('parsererror')) throw fail('CORRUPT_DOCUMENT', `${label} không có cấu trúc XML hợp lệ.`); return document; };
  const nodes = (root, localName) => [...root.getElementsByTagNameNS('*', localName)];
  const firstText = (root, localName) => clean(nodes(root, localName).map((item) => item.textContent || '').join(''), 5000);
  const sourceKey = (file) => `${clean(file.name, 180)}:${file.size}:${file.lastModified || 0}`;
  const recordError = (file, error) => ({ fileName: clean(file?.name || 'unknown', 180), code: clean(error?.code || ERROR_CODES.processing, 60), message: clean(error?.message || 'Không thể xử lý file.', 400) });

  const P83FileValidationService = {
    limits: () => ({ files: MAX_FILES, documentBytes: MAX_BYTES, imageBytes: MAX_IMAGE_BYTES, rows: MAX_ROWS }),
    async inspect(file) {
      if (!file?.name || typeof file.arrayBuffer !== 'function') throw fail(ERROR_CODES.read, 'Hãy chọn file hợp lệ.');
      const extension = ext(file.name); const limit = IMAGE_TYPES.has(extension) ? MAX_IMAGE_BYTES : MAX_BYTES;
      if (!file.size) throw fail(ERROR_CODES.empty, 'File đang trống.');
      if (file.size > limit) throw fail(ERROR_CODES.tooLarge, `File vượt giới hạn ${Math.round(limit / 1048576)} MB.`);
      if (extension === 'doc') throw fail('DOC_LEGACY_UNSUPPORTED', 'Định dạng .doc cũ không được hỗ trợ. Hãy mở file và Save as .docx.');
      if (!SUPPORTED.has(extension)) throw fail(ERROR_CODES.unsupported, `Không hỗ trợ .${extension || 'unknown'}.`);
      let buffer; try { buffer = await file.arrayBuffer(); } catch (_) { throw fail(ERROR_CODES.read, 'Không thể đọc file.'); } const bytes = u8(buffer); let detected = '';
      if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) detected = 'pdf';
      else if (starts(bytes, [0x50, 0x4b, 0x03, 0x04]) || starts(bytes, [0x50, 0x4b, 0x05, 0x06])) detected = 'zip';
      else if (starts(bytes, [0xff, 0xd8, 0xff])) detected = 'jpeg';
      else if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) detected = 'png';
      else if (bytes.length > 12 && utf8(bytes.slice(0, 4)) === 'RIFF' && utf8(bytes.slice(8, 12)) === 'WEBP') detected = 'webp';
      else if (starts(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) detected = 'ole';
      else if (starts(bytes, [0x4d, 0x5a]) || starts(bytes, [0x7f, 0x45, 0x4c, 0x46])) detected = 'executable';
      else detected = 'text';
      if (detected === 'executable' || detected === 'ole') throw fail(detected === 'ole' ? 'DOC_LEGACY_UNSUPPORTED' : ERROR_CODES.corrupted, detected === 'ole' ? 'File Office cũ không được hỗ trợ. Hãy Save as .docx/.xlsx.' : 'Chữ ký file thực thi bị từ chối.', detected === 'executable' ? 'UNSAFE_FILE_SIGNATURE' : 'OLE_LEGACY');
      const expected = IMAGE_TYPES.has(extension) ? (extension === 'jpg' ? 'jpeg' : extension) : extension;
      if (['xlsx', 'docx'].includes(extension) && detected !== 'zip') throw fail(ERROR_CODES.corrupted, `.${extension} phải là tài liệu OOXML hợp lệ.`, 'MIME_SIGNATURE_MISMATCH');
      if (extension === 'pdf' && detected !== 'pdf') throw fail(ERROR_CODES.corrupted, 'File không có chữ ký PDF hợp lệ.', 'MIME_SIGNATURE_MISMATCH');
      if (IMAGE_TYPES.has(extension) && detected !== expected && !(extension === 'jpeg' && detected === 'jpeg')) throw fail(ERROR_CODES.corrupted, 'Phần mở rộng ảnh không khớp nội dung file.', 'MIME_SIGNATURE_MISMATCH');
      if (['csv', 'txt', 'json'].includes(extension) && (detected !== 'text' || bytes.slice(0, 2048).filter((value) => value === 0).length > 2)) throw fail(ERROR_CODES.corrupted, 'File text chứa dữ liệu nhị phân hoặc encoding không an toàn.', 'BINARY_TEXT_REJECTED');
      return { file, extension, bytes, detected, mime: clean(file.type, 100), key: sourceKey(file), size: file.size };
    }
  };

  function unzip(bytes, type) {
    if (!global.fflate?.unzipSync) throw fail('PARSER_UNAVAILABLE', 'Bộ giải nén OOXML chưa sẵn sàng.');
    let entries; try { entries = global.fflate.unzipSync(bytes, { filter: (entry) => !entry.name.startsWith('__MACOSX/') }); } catch (_) { throw fail('CORRUPT_DOCUMENT', `Không thể giải nén ${type.toUpperCase()}.`); }
    const total = Object.values(entries).reduce((sum, value) => sum + value.length, 0); if (total > 80 * 1024 * 1024) throw fail('ZIP_BOMB_RISK', 'Tài liệu nén vượt giới hạn giải nén an toàn.');
    return Object.fromEntries(Object.entries(entries).map(([name, value]) => [normalizePath(name), value]));
  }

  function columnIndex(reference) { const letters = String(reference || '').match(/[A-Z]+/i)?.[0] || 'A'; return [...letters.toUpperCase()].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0) - 1; }
  function sheetRows(entries, path, sharedStrings) {
    const doc = parseXml(xmlText(entries[path]), 'Worksheet');
    return nodes(doc, 'row').map((row) => { const values = []; nodes(row, 'c').forEach((cell) => { const index = columnIndex(cell.getAttribute('r')); const type = cell.getAttribute('t'); const raw = type === 'inlineStr' ? firstText(cell, 't') : firstText(cell, 'v'); values[index] = type === 's' ? sharedStrings[Number(raw)] || '' : raw; }); return values.map((value) => clean(value, 2000)); }).filter((row) => row.some(Boolean));
  }
  function tableToCandidates(rows, provenance = {}) {
    if (!rows.length) return [];
    const normalized = rows[0].map((value) => clean(value, 100).toLocaleLowerCase().replace(/[ _-]/g, ''));
    const aliases = { korean: ['korean', 'word', 'từtiếnghàn', '한국어', '단어'], meaning: ['meaning', 'meaningvi', 'vietnamese', 'nghĩa', '뜻'], wordType: ['wordtype', 'partofspeech', 'loạitừ', '품사'], topic: ['topic', 'chủđề', '주제'], example: ['example', 'vídụ', '예문'], note: ['note', 'ghichú'] };
    const mapping = {}; Object.entries(aliases).forEach(([key, values]) => { const found = normalized.findIndex((header) => values.includes(header)); if (found >= 0) mapping[key] = found; });
    const hasHeader = mapping.korean !== undefined || mapping.meaning !== undefined; const data = hasHeader ? rows.slice(1) : rows;
    return data.map((values, index) => {
      const korean = clean(values[mapping.korean ?? 0], 100); const meaning = clean(values[mapping.meaning ?? 1], 200); const confidence = korean && meaning && hasHangul(korean) ? (hasHeader ? .98 : .88) : .3;
      return candidate({ korean, meaning, wordType: clean(values[mapping.wordType], 40), topic: clean(values[mapping.topic], 80), example: clean(values[mapping.example], 300), note: clean(values[mapping.note], 300), sourceRow: index + (hasHeader ? 2 : 1), extractionConfidence: confidence, ...provenance });
    }).filter((item) => item.korean || item.meaning);
  }

  const P83XlsxParser = {
    discover(bytes) {
      const entries = unzip(bytes, 'xlsx'); if (!entries['xl/workbook.xml']) throw fail('CORRUPT_XLSX', 'Không tìm thấy workbook trong XLSX.');
      const workbook = parseXml(xmlText(entries['xl/workbook.xml']), 'Workbook');
      const relations = entries['xl/_rels/workbook.xml.rels'] ? parseXml(xmlText(entries['xl/_rels/workbook.xml.rels']), 'Workbook relations') : null;
      const relationMap = new Map(relations ? nodes(relations, 'Relationship').map((node) => [node.getAttribute('Id'), normalizePath(`xl/${String(node.getAttribute('Target') || '').replace(/^\/?xl\//, '')}`)]) : []);
      const sheets = nodes(workbook, 'sheet').map((node, index) => ({ name: clean(node.getAttribute('name'), 120) || `Sheet ${index + 1}`, path: relationMap.get(node.getAttribute('r:id') || node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')) || `xl/worksheets/sheet${index + 1}.xml` })).filter((sheet) => entries[sheet.path]);
      if (!sheets.length) throw fail('EMPTY_XLSX', 'Workbook không có worksheet đọc được.'); return { entries, sheets };
    },
    extract(discovery, sheetName, provenance = {}) {
      const sheet = discovery.sheets.find((item) => item.name === sheetName); if (!sheet) throw fail('WORKSHEET_REQUIRED', 'Hãy chọn worksheet trước khi trích xuất.');
      const sharedStrings = discovery.entries['xl/sharedStrings.xml'] ? nodes(parseXml(xmlText(discovery.entries['xl/sharedStrings.xml']), 'Shared strings'), 'si').map((item) => firstText(item, 't')) : [];
      const rows = sheetRows(discovery.entries, sheet.path, sharedStrings); return { rows: tableToCandidates(rows, { ...provenance, sourceSection: sheet.name, extractionMethod: 'xlsx-ooxml' }), sheet: sheet.name, rawRows: rows.length };
    }
  };

  function paragraphText(node) { return clean(nodes(node, 't').map((item) => item.textContent || '').join(''), 4000); }
  const P83DocxParser = {
    extract(bytes, provenance = {}) {
      const entries = unzip(bytes, 'docx'); if (!entries['word/document.xml']) throw fail('CORRUPT_DOCX', 'Không tìm thấy nội dung document.xml.');
      const doc = parseXml(xmlText(entries['word/document.xml']), 'DOCX'); const body = nodes(doc, 'body')[0]; if (!body) throw fail('EMPTY_DOCX', 'DOCX không có nội dung.');
      const tables = nodes(body, 'tbl').map((table, tableIndex) => nodes(table, 'tr').map((row) => nodes(row, 'tc').map(paragraphText)).filter((row) => row.some(Boolean))).filter((table) => table.length);
      let rows = tables.flatMap((table, tableIndex) => tableToCandidates(table, { ...provenance, sourceSection: `Table ${tableIndex + 1}`, extractionMethod: 'docx-table' }));
      const blocks = [...body.children].filter((node) => node.localName === 'p').map((node, index) => ({ text: paragraphText(node), style: firstText(node, 'pStyle'), list: nodes(node, 'numPr').length > 0, order: index + 1 })).filter((item) => item.text);
      if (!rows.length) rows = P83StructureService.fromLines(blocks.map((item) => item.text), { ...provenance, extractionMethod: 'docx-paragraph', sourceSection: blocks.find((item) => /^Heading/i.test(item.style))?.text || 'Document' });
      if (!rows.length) throw fail('NO_VOCABULARY_FOUND', 'DOCX có nội dung nhưng chưa nhận diện được cặp từ và nghĩa.');
      return { rows, tables: tables.length, paragraphs: blocks.length, priority: tables.length ? 'table' : 'paragraph' };
    }
  };

  function splitPair(line) {
    const value = clean(line, 1000); const match = value.match(/^(.{1,120}?)(?:\s*[\t,:;=–—-]\s+)(.{1,300})$/u); if (!match || !hasHangul(match[1])) return null; return [clean(match[1], 100), clean(match[2], 200)];
  }
  function candidate(input = {}) {
    const korean = clean(input.korean, 100); const meaning = clean(input.meaning, 200); const confidence = Math.max(0, Math.min(1, Number(input.extractionConfidence ?? input.confidence ?? (korean && meaning && hasHangul(korean) ? .85 : .3)) || 0));
    const typeKey = clean(input.wordType, 40).toLocaleLowerCase(); const wordType = ({ noun:'Danh từ', 'danh từ':'Danh từ', '명사':'Danh từ', verb:'Động từ', 'động từ':'Động từ', '동사':'Động từ', adjective:'Tính từ', 'tính từ':'Tính từ', '형용사':'Tính từ', adverb:'Trạng từ', 'trạng từ':'Trạng từ', '부사':'Trạng từ', pronoun:'Đại từ', 'đại từ':'Đại từ', '대명사':'Đại từ', numeral:'Số từ', 'số từ':'Số từ', '수사':'Số từ', particle:'Trợ từ', 'trợ từ':'Trợ từ', '조사':'Trợ từ', phrase:'Cụm từ', 'cụm từ':'Cụm từ' })[typeKey] || (WORD_TYPES.includes(input.wordType) ? input.wordType : 'Khác');
    return { id: input.id || id('p83-row'), included: input.included !== false, korean, meaning, wordType, topic: clean(input.topic, 80) || 'Chưa phân loại', example: clean(input.example, 300), note: clean(input.note, 300), sourceType: clean(input.sourceType, 40), sourceFileName: clean(input.sourceFileName, 180), sourcePage: input.sourcePage == null ? null : Math.max(1, Number(input.sourcePage) || 1), sourceImage: clean(input.sourceImage, 180), sourceSection: clean(input.sourceSection, 180), sourceOrder: Number(input.sourceOrder || 0), sourceRow: Number(input.sourceRow || input.sourceOrder || 1), sourceFingerprint: clean(input.sourceFingerprint, 120), extractionMethod: clean(input.extractionMethod, 40), extractionConfidence: confidence, reviewStatus: input.reviewStatus || (confidence < .7 || !korean || !meaning || !hasHangul(korean) ? 'needs_review' : 'ready'), issues: [...new Set([...(Array.isArray(input.issues) ? input.issues : []), ...(!korean ? ['missing_korean'] : []), ...(!meaning ? ['missing_meaning'] : []), ...(korean && !hasHangul(korean) ? ['no_hangul'] : []), ...(korean.split(/\s+/).length > 5 ? ['sentence_not_word'] : [])])] };
  }
  const P83StructureService = {
    fromLines(lines, provenance = {}) {
      const values = lines.map((line) => clean(line, 1000)).filter(Boolean); const result = [];
      for (let index = 0; index < values.length; index += 1) {
        const pair = splitPair(values[index]); if (pair) { result.push(candidate({ korean: pair[0], meaning: pair[1], sourceOrder: index + 1, extractionConfidence: .87, ...provenance })); continue; }
        if (hasHangul(values[index]) && values[index].length <= 100 && values[index + 1] && !hasHangul(values[index + 1])) { result.push(candidate({ korean: values[index], meaning: values[index + 1], sourceOrder: index + 1, extractionConfidence: .73, ...provenance })); index += 1; }
      }
      return result.slice(0, MAX_ROWS);
    },
    fromText(text, provenance = {}) { return this.fromLines(String(text || '').replace(/\r/g, '').split('\n'), provenance); }
  };

  let pdfModulePromise;
  async function pdfModule() {
    if (!pdfModulePromise) pdfModulePromise = import('../vendor/pdfjs-5.4.624.min.mjs').then((module) => { module.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs-5.4.624.worker.min.mjs', global.document.baseURI).href; return module; });
    return pdfModulePromise;
  }
  async function renderPdfPage(pdfDocument, pageNumber, maxWidth = 1600) {
    const page = await pdfDocument.getPage(pageNumber); const original = page.getViewport({ scale: 1 }); const scale = Math.min(2, maxWidth / Math.max(1, original.width)); const viewport = page.getViewport({ scale }); const canvas = global.document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height); await page.render({ canvasContext: canvas.getContext('2d', { alpha: false }), viewport }).promise; return canvas.toDataURL('image/jpeg', .82);
  }
  const P83PdfParser = {
    async extract(bytes, provenance = {}, progress = () => {}) {
      const pdfjs = await pdfModule(); let loading; try { loading = pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false, useWorkerFetch: false }); } catch (_) { throw fail('CORRUPT_PDF', 'Không thể mở PDF.'); }
      let document; try { document = await loading.promise; } catch (error) { throw fail(error?.name === 'PasswordException' ? 'PDF_PASSWORD_REQUIRED' : 'CORRUPT_PDF', error?.name === 'PasswordException' ? 'PDF có mật khẩu; hãy mở khóa trước khi import.' : 'PDF bị lỗi hoặc không được hỗ trợ.'); }
      const pages = []; const rows = []; const scannedPages = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
        if (runtime.cancelled) throw fail('IMPORT_CANCELLED', 'Đã hủy trích xuất.'); progress(pageNumber, document.numPages);
        const page = await document.getPage(pageNumber); const content = await page.getTextContent(); const text = clean(content.items.map((item) => item.str || '').join(' '), 50000); const scanned = text.replace(/\s/g, '').length < 15;
        pages.push({ page: pageNumber, characters: text.length, scanned }); if (scanned) scannedPages.push(pageNumber); else rows.push(...P83StructureService.fromText(text.replace(/(?<=[.!?])\s+/g, '\n'), { ...provenance, sourcePage: pageNumber, sourceSection: `Page ${pageNumber}`, extractionMethod: 'pdf-text' }));
      }
      return { rows, pages, scannedPages, document, pageCount: document.numPages, detectedScanned: scannedPages.length > 0 };
    },
    renderPage: renderPdfPage
  };

  async function imageDataUrl(file, maxDimension = 1400) {
    const bitmap = await createImageBitmap(file); const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height)); const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale)); const context = canvas.getContext('2d', { alpha: false, willReadFrequently: true }); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.(); let uploadCanvas = canvas; let dataUrl = uploadCanvas.toDataURL('image/jpeg', .78); while (dataUrl.length > 850000 && Math.max(uploadCanvas.width, uploadCanvas.height) > 720) { const smaller = document.createElement('canvas'); smaller.width = Math.max(1, Math.round(uploadCanvas.width * .78)); smaller.height = Math.max(1, Math.round(uploadCanvas.height * .78)); const smallerContext = smaller.getContext('2d', { alpha: false }); smallerContext.fillStyle = '#fff'; smallerContext.fillRect(0, 0, smaller.width, smaller.height); smallerContext.drawImage(uploadCanvas, 0, 0, smaller.width, smaller.height); uploadCanvas = smaller; dataUrl = uploadCanvas.toDataURL('image/jpeg', .7); } return { dataUrl, canvas, width: canvas.width, height: canvas.height };
  }
  function imageQuality(canvas) {
    const context = canvas.getContext('2d', { willReadFrequently: true }); const width = Math.min(canvas.width, 320); const height = Math.max(1, Math.round(canvas.height * width / canvas.width)); const sample = document.createElement('canvas'); sample.width = width; sample.height = height; const sampleContext = sample.getContext('2d', { willReadFrequently: true }); sampleContext.drawImage(canvas, 0, 0, width, height); const data = sampleContext.getImageData(0, 0, width, height).data; let sum = 0; let square = 0; let edges = 0; let previous = 0;
    for (let index = 0; index < data.length; index += 4) { const gray = .299 * data[index] + .587 * data[index + 1] + .114 * data[index + 2]; sum += gray; square += gray * gray; if (index > 4) edges += Math.abs(gray - previous); previous = gray; }
    const pixels = data.length / 4; const mean = sum / pixels; const contrast = Math.sqrt(Math.max(0, square / pixels - mean * mean)); const sharpness = edges / Math.max(1, pixels - 1); const warnings = []; if (canvas.width < 700 || canvas.height < 500) warnings.push('low_resolution'); if (contrast < 28) warnings.push('low_contrast'); if (sharpness < 9) warnings.push('possible_blur'); return { width: canvas.width, height: canvas.height, contrast: Math.round(contrast), sharpness: Math.round(sharpness), orientation: canvas.width > canvas.height ? 'landscape' : 'portrait', warnings };
  }
  const P83ImageOcrService = {
    localAvailable: () => typeof global.TextDetector === 'function' && typeof global.createImageBitmap === 'function',
    async prepare(file, provenance = {}) { try { const prepared = await imageDataUrl(file); const quality = imageQuality(prepared.canvas); if (prepared.width / Math.max(1, prepared.height) > 3.5 || prepared.height / Math.max(1, prepared.width) > 3.5) quality.warnings.push('possible_crop'); return { ...prepared, quality, provenance }; } catch (_) { throw fail('CORRUPT_IMAGE', 'Ảnh bị hỏng hoặc trình duyệt không thể giải mã.'); } },
    async local(file, provenance = {}) {
      if (!this.localAvailable()) throw fail('LOCAL_OCR_UNAVAILABLE', 'Thiết bị này không có TextDetector. Bạn có thể nhập tay hoặc bật AI OCR.');
      const bitmap = await createImageBitmap(file); let detections; try { detections = await new global.TextDetector(['ko', 'vi', 'en']).detect(bitmap); } finally { bitmap.close?.(); }
      const lines = (detections || []).sort((a, b) => (a.boundingBox?.y || 0) - (b.boundingBox?.y || 0) || (a.boundingBox?.x || 0) - (b.boundingBox?.x || 0)).map((item) => clean(item.rawValue, 1000)).filter(Boolean);
      return { text: lines.join('\n'), rows: P83StructureService.fromLines(lines, { ...provenance, extractionMethod: 'on-device-ocr' }), detections: lines.length };
    },
    async ai(items) {
      if (PrivacyPreferenceService?.allows?.('aiUsage') === false) throw fail('AI_DISABLED_BY_USER', 'AI đang tắt trong cài đặt quyền riêng tư.');
      const images = items.slice(0, 3).map((item, index) => ({ dataUrl: item.dataUrl, sourceIndex: index, fileName: clean(item.fileName, 180) }));
      const response = await fetch(global.KLearnPlatform?.apiUrl?.('/api/chat') || '/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-KLearn-AI-Consent': 'granted', ...(global.SupabaseService?.session?.access_token ? { Authorization: `Bearer ${global.SupabaseService.session.access_token}` } : {}) }, body: JSON.stringify({ task: 'document_ocr', messages: [{ role: 'user', content: 'Trích xuất CHÍNH XÁC các mục từ tiếng Hàn và nghĩa tiếng Việt từ ảnh. Không suy đoán phần không đọc được.' }], images, learningLanguage: 'vi', privacy: { aiEnabled: true } }) });
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw fail(payload.code || 'AI_OCR_FAILED', payload.message || 'AI OCR tạm thời không khả dụng.');
      let parsed; try { parsed = JSON.parse(String(payload.reply || '').replace(/^```json\s*|\s*```$/g, '')); } catch (_) { throw fail('AI_OCR_INVALID_RESPONSE', 'AI OCR trả dữ liệu không hợp lệ; không có dữ liệu nào được import.'); }
      const rows = Array.isArray(parsed) ? parsed : parsed.rows; if (!Array.isArray(rows)) throw fail('AI_OCR_INVALID_RESPONSE', 'AI OCR không trả danh sách từ.');
      return rows.slice(0, MAX_ROWS).map((row, index) => { const source = items[Math.max(0, Math.min(items.length - 1, Number(row.sourceIndex) || 0))]; return candidate({ ...row, sourceType: source.sourcePage ? 'pdf' : 'image', sourceFileName: source.fileName, sourceImage: source.sourcePage ? '' : source.fileName, sourcePage: source.sourcePage, sourceOrder: index + 1, sourceFingerprint: source.fingerprint, extractionMethod: 'ai-ocr', reviewStatus: 'needs_review', extractionConfidence: Math.min(.85, Number(row.confidence) || .55) }); });
    }
  };

  function parseJson(text, provenance) {
    let value; try { value = JSON.parse(text); } catch (_) { throw fail(ERROR_CODES.json, 'JSON không hợp lệ.'); } const rows = Array.isArray(value) ? value : value.words; if (!Array.isArray(rows)) throw fail(ERROR_CODES.json, 'JSON cần là array hoặc có trường words.'); return rows.map((row, index) => candidate({ ...row, ...provenance, sourceOrder: index + 1, extractionMethod: 'json' }));
  }
  function parseDelimited(text, provenance, extension) {
    const lines = String(text || '').replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n').filter((line) => line.trim()); if (!lines.length) throw fail('EMPTY_TEXT', 'Không có nội dung text.'); const delimiter = extension === 'csv' ? (lines[0].split(';').length > lines[0].split(',').length ? ';' : ',') : (lines[0].includes('\t') ? '\t' : null);
    if (!delimiter) return P83StructureService.fromLines(lines, { ...provenance, extractionMethod: 'plain-text' });
    const rows = lines.map((line) => { const values = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i += 1) { const char = line[i]; if (char === '"' && line[i + 1] === '"' && quoted) { value += '"'; i += 1; } else if (char === '"') quoted = !quoted; else if (char === delimiter && !quoted) { values.push(value); value = ''; } else value += char; } values.push(value); return values; }); return tableToCandidates(rows, { ...provenance, extractionMethod: extension });
  }

  const P83ImportPipeline = {
    reset() { runtime.sources = []; runtime.rows = []; runtime.warnings = []; runtime.errors = []; runtime.progress = null; runtime.result = null; runtime.page = 1; fileCache.clear(); pdfCache.clear(); },
    cancel() { runtime.cancelled = true; runtime.progress = { phase: 'cancelled', current: 0, total: 0, label: 'Đã hủy an toàn; chưa import dữ liệu.' }; },
    async process(files) {
      const selected = [...(files || [])]; if (!selected.length) throw fail('FILE_REQUIRED', 'Hãy chọn ít nhất một file.'); if (selected.length > MAX_FILES) throw fail('TOO_MANY_FILES', `Mỗi lần tối đa ${MAX_FILES} file.`);
      this.reset(); runtime.busy = true; runtime.cancelled = false; render();
      for (let index = 0; index < selected.length; index += 1) {
        const file = selected[index]; runtime.progress = { phase: 'extract', current: index + 1, total: selected.length, label: clean(file.name, 180) }; render();
        if (runtime.cancelled) break;
        try { await this.processOne(file); } catch (error) { runtime.errors.push(recordError(file, error)); }
      }
      runtime.busy = false; runtime.progress = { phase: runtime.cancelled ? 'cancelled' : 'review', current: selected.length, total: selected.length, label: runtime.cancelled ? 'Đã hủy' : 'Sẵn sàng review' }; render(); return { sources: runtime.sources.length, rows: runtime.rows.length, errors: runtime.errors.length };
    },
    async processOne(file) {
      const inspected = await P83FileValidationService.inspect(file); const fingerprint = hash(`${inspected.key}:${Array.from(inspected.bytes.slice(0, 4096)).join(',')}`); const provenance = { sourceType: inspected.extension, sourceFileName: clean(file.name, 180), sourceFingerprint: fingerprint };
      fileCache.set(inspected.key, { file, inspected, fingerprint }); let result = { rows: [] }; let source = { id: id('source'), key: inspected.key, fileName: provenance.sourceFileName, type: inspected.extension, size: inspected.size, fingerprint, status: 'extracted', rows: 0, warnings: [] };
      if (inspected.extension === 'xlsx') { const discovery = P83XlsxParser.discover(inspected.bytes); fileCache.get(inspected.key).xlsx = discovery; source = { ...source, status: 'choose_sheet', sheets: discovery.sheets.map((item) => item.name), rows: 0 }; runtime.selectedSheet[inspected.key] = ''; }
      else if (inspected.extension === 'docx') result = P83DocxParser.extract(inspected.bytes, provenance);
      else if (inspected.extension === 'pdf') { result = await P83PdfParser.extract(inspected.bytes, provenance, (current, total) => { runtime.progress = { phase: 'pdf', current, total, label: provenance.sourceFileName }; render(); }); pdfCache.set(inspected.key, result.document); source = { ...source, pages: result.pageCount, scannedPages: result.scannedPages, status: result.detectedScanned ? 'scan_detected' : 'extracted', warnings: result.detectedScanned ? [`${result.scannedPages.length} trang scan cần OCR/review.`] : [] }; delete result.document; }
      else if (IMAGE_TYPES.has(inspected.extension)) { const prepared = await P83ImageOcrService.prepare(file, provenance); fileCache.get(inspected.key).prepared = { dataUrl: prepared.dataUrl, quality: prepared.quality, fileName: provenance.sourceFileName, fingerprint }; source = { ...source, type: 'image', status: P83ImageOcrService.localAvailable() ? 'ocr_ready' : 'ai_or_manual_required', quality: prepared.quality, warnings: prepared.quality.warnings }; if (P83ImageOcrService.localAvailable()) { try { result = await P83ImageOcrService.local(file, { ...provenance, sourceType: 'image', sourceImage: provenance.sourceFileName }); source.status = result.rows.length ? 'extracted_local_ocr' : 'needs_ai_or_manual'; } catch (error) { source.warnings.push(error.message); } } }
      else { const text = utf8(inspected.bytes); if ((text.match(/\uFFFD/g) || []).length > Math.max(3, text.length * .01)) throw fail(ERROR_CODES.corrupted, 'Encoding của file text không được hỗ trợ.', 'UNSUPPORTED_ENCODING'); result.rows = inspected.extension === 'json' ? parseJson(text, provenance) : parseDelimited(text, provenance, inspected.extension); }
      const rows = (result.rows || []).slice(0, MAX_ROWS - runtime.rows.length); runtime.rows.push(...rows); source.rows = rows.length; runtime.sources.push(source); if (runtime.rows.length >= MAX_ROWS) runtime.warnings.push(`Đã đạt giới hạn ${MAX_ROWS} mục; phần còn lại không được nạp.`);
    },
    async reprocess(preserveEdits = true) {
      const cachedFiles = [...fileCache.values()].map((item) => item.file).filter(Boolean); if (!cachedFiles.length) throw fail('SOURCE_RESELECT_REQUIRED', 'File nguồn không được lưu. Hãy chọn lại file để reprocess.');
      const sheetSelections = new Map(runtime.sources.filter((source) => source.sheet).map((source) => [source.fileName, source.sheet]));
      const editKey = (row) => `${row.sourceFileName}|${row.sourcePage || 0}|${row.sourceSection}|${row.sourceOrder || row.sourceRow || 0}`;
      const edits = new Map(runtime.rows.map((row) => [editKey(row), clone(row)])); await this.process(cachedFiles);
      for (const source of runtime.sources.filter((item) => item.status === 'choose_sheet')) { const sheet = sheetSelections.get(source.fileName); if (sheet) this.extractSheet(source.id, sheet); }
      if (preserveEdits) runtime.rows = runtime.rows.map((row) => { const previous = edits.get(editKey(row)); return previous ? candidate({ ...row, ...Object.fromEntries(['korean','meaning','wordType','topic','example','note','included','reviewStatus'].map((key) => [key, previous[key]])), id: row.id }) : row; });
      runtime.progress = { phase: 'review', current: cachedFiles.length, total: cachedFiles.length, label: preserveEdits ? 'Reprocess xong · đã giữ chỉnh sửa khớp nguồn' : 'Reprocess xong · dùng extraction mới' }; render(); return { sources: runtime.sources.length, rows: runtime.rows.length, preserved: preserveEdits ? edits.size : 0 };
    },
    extractSheet(sourceId, sheetName) {
      const source = runtime.sources.find((item) => item.id === sourceId); const cached = source && fileCache.get(source.key); if (!source || !cached?.xlsx) throw fail('SOURCE_NOT_FOUND', 'Không tìm thấy workbook đang mở.'); const result = P83XlsxParser.extract(cached.xlsx, sheetName, { sourceType: 'xlsx', sourceFileName: source.fileName, sourceFingerprint: source.fingerprint }); runtime.rows = runtime.rows.filter((row) => row.sourceFingerprint !== source.fingerprint); runtime.rows.push(...result.rows.slice(0, MAX_ROWS - runtime.rows.length)); source.rows = result.rows.length; source.status = 'extracted'; source.sheet = sheetName; runtime.selectedSheet[source.key] = sheetName; render(); return result.rows.length;
    },
    async ocrSources(sourceIds, mode = 'ai') {
      const targets = runtime.sources.filter((source) => sourceIds.includes(source.id)); if (!targets.length) throw fail('OCR_SOURCE_REQUIRED', 'Chọn ảnh hoặc trang scan cần OCR.'); runtime.aiBusy = true; render();
      try {
        const prepared = [];
        for (const source of targets) {
          const cached = fileCache.get(source.key); if (source.type === 'image' && cached?.prepared) prepared.push(cached.prepared);
          if (source.type === 'pdf') { const document = pdfCache.get(source.key); const selectedPages = Array.isArray(source.selectedPages) ? source.selectedPages : []; if (!selectedPages.length) throw fail('OCR_PAGE_REQUIRED', 'Hãy chọn trang scan cần OCR; hệ thống không tự render toàn bộ PDF.'); for (const page of selectedPages) prepared.push({ dataUrl: await P83PdfParser.renderPage(document, page), fileName: `${source.fileName} · page ${page}`, fingerprint: `${source.fingerprint}:p${page}`, sourcePage: page }); }
        }
        if (mode !== 'ai') throw fail('LOCAL_OCR_PDF_UNAVAILABLE', 'OCR PDF local chưa khả dụng trên thiết bị này.');
        const rows = []; for (let index = 0; index < prepared.length; index += 3) { if (runtime.cancelled) break; runtime.progress = { phase: 'ai-ocr', current: Math.min(index + 3, prepared.length), total: prepared.length, label: 'AI OCR (opt-in)' }; render(); rows.push(...await P83ImageOcrService.ai(prepared.slice(index, index + 3))); }
        runtime.rows.push(...rows.slice(0, MAX_ROWS - runtime.rows.length)); targets.forEach((source) => { source.status = 'ocr_review_required'; source.rows = runtime.rows.filter((row) => row.sourceFingerprint === source.fingerprint || row.sourceFileName.startsWith(source.fileName)).length; }); return rows.length;
      } finally { runtime.aiBusy = false; runtime.progress = { phase: 'review', current: 1, total: 1, label: 'OCR hoàn tất — bắt buộc review' }; render(); }
    },
    mergeRows(ids) {
      const selected = runtime.rows.filter((row) => ids.includes(row.id)); if (selected.length < 2) return false; const first = selected[0]; const merged = candidate({ ...first, korean: selected.map((item) => item.korean).filter(Boolean).join(' '), meaning: selected.map((item) => item.meaning).filter(Boolean).join('; '), note: selected.map((item) => item.note).filter(Boolean).join(' · '), extractionConfidence: Math.min(...selected.map((item) => item.extractionConfidence)), reviewStatus: 'needs_review' }); runtime.rows = runtime.rows.filter((row) => !ids.includes(row.id)); runtime.rows.unshift(merged); return true;
    },
    validateReview() {
      const included = runtime.rows.filter((row) => row.included); const invalid = included.filter((row) => !row.korean || !row.meaning || !hasHangul(row.korean)); const uncertain = included.filter((row) => row.reviewStatus === 'needs_review' || row.extractionConfidence < .7); return { included, invalid, uncertain, valid: included.length > 0 && invalid.length === 0 };
    },
    commit({ title, deckId, duplicateMode = 'skip' } = {}) {
      const review = this.validateReview(); if (!review.valid) throw fail('REVIEW_INCOMPLETE', review.included.length ? `Còn ${review.invalid.length} mục thiếu từ tiếng Hàn/nghĩa.` : 'Hãy chọn ít nhất một mục để import.');
      if (review.uncertain.length && !global.confirm?.(`${review.uncertain.length} mục OCR/độ tin cậy thấp đã được đánh dấu. Bạn xác nhận đã review thủ công và muốn import?`)) throw fail('REVIEW_CONFIRMATION_REQUIRED', 'Import đã dừng để bạn tiếp tục review.');
      const sourceFiles = runtime.sources.map((source) => ({ name: source.fileName, type: source.type, pages: source.pages || 0 })); const fingerprint = hash(review.included.map((row) => `${row.sourceFingerprint}|${row.korean}|${row.meaning}`).join('\n')); const importedAt = now(); const parsed = { fileName: sourceFiles.length === 1 ? sourceFiles[0].name : `${sourceFiles.length} nguồn P83`, sourceType: 'smart-document', sourceFiles, fingerprint, rows: review.included.map((row) => ({ ...row, reviewStatus: 'confirmed', importedAt })), invalidCount: 0, reviewedCount: review.included.length, extractionMethod: [...new Set(review.included.map((row) => row.extractionMethod))].join(',') };
      let targetId = clean(deckId, 160); if (!targetId) targetId = global.P82DeckService.create({ title: clean(title, 100) || `Bộ từ ${new Date().toLocaleDateString('vi-VN')}`, description: 'Tạo từ Smart Document & Image Import (P83)', source: { type: 'smart-document', name: parsed.fileName, importedAt: now() } }).id;
      const result = global.P82ImportService.importIntoDeck(targetId, parsed, duplicateMode); runtime.result = { ...result, deckId: targetId, title: global.P82DeckService.get(targetId)?.title, reviewed: review.included.length, uncertain: review.uncertain.length }; render(); return clone(runtime.result);
    }
  };

  const P83TeacherBridgeService = {
    available() { return Boolean(global.TeacherCreatorRoleService?.can?.('create_content')); },
    createDraft(deckId) {
      if (!this.available()) throw fail('TEACHER_ROLE_REQUIRED', 'Tài khoản chưa có quyền Teacher/Creator.'); const deck = global.P82DeckService.get(deckId); if (!deck) throw fail('DECK_NOT_FOUND', 'Không tìm thấy bộ từ.'); const words = global.P82DeckService.words(deckId).slice(0, 80);
      return global.CreatorDraftService.create({ type: 'vocabulary', title: deck.title, level: 'TOPIK', skill: 'vocabulary', objective: `Học và ôn ${words.length} mục từ đã được giáo viên review.`, explanation: `Nguồn P83/P82 deck: ${deck.id}. Nội dung cần qua Automated Check → Human Review → Publish.`, example: words.slice(0, 5).map((word) => `${word.korean}: ${word.meaning}`).join('\n') || 'Vocabulary deck', exercise: 'Học bộ từ bằng luồng P82 và hoàn thành focus session.', tier: 'free' });
    },
    assignmentLink(deckId) { return { contentId: deckId, route: 'teacher-classroom-p76', workflow: 'TeacherClassroomWorkspaceService.createAssignment' }; }
  };

  const P83OfflineService = {
    async prepare() {
      if (!global.caches) return { cached: false, assets: 0 };
      const assets = ['./smart-document-vocabulary-import.css?v=1', './vendor/fflate-0.8.2.min.js', './vendor/pdfjs-5.4.624.min.mjs', './vendor/pdfjs-5.4.624.worker.min.mjs', './data/smart-document-vocabulary-import.js?v=1', './data/personal-vocabulary-system.js?v=2'];
      const cache = await global.caches.open('klearn-pack-p83-smart-import'); await Promise.all(assets.map((asset) => cache.add(asset).catch(() => null))); return { cached: true, assets: assets.length, note: 'Parser chạy offline; AI OCR vẫn cần mạng và consent.' };
    }
  };

  function heading(title, subtitle) { return `<section class="section page-heading p83-heading"><button class="back-link" data-view="my-vocabulary-p82">←</button><p class="eyebrow">P83 · LOCAL-FIRST IMPORT</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(subtitle)}</p></section>`; }
  function parsePageSelection(value, allowed = []) { const valid = new Set(allowed); const selected = new Set(); String(value || '').split(',').map((part) => part.trim()).filter(Boolean).forEach((part) => { const match = part.match(/^(\d+)(?:-(\d+))?$/); if (!match) return; const start = Number(match[1]); const end = Math.min(Number(match[2] || start), start + 49); for (let page = start; page <= end; page += 1) if (valid.has(page)) selected.add(page); }); return [...selected].sort((a, b) => a - b); }
  function sourceMarkup(source) {
    const quality = source.quality ? `<small>${source.quality.width}×${source.quality.height} · contrast ${source.quality.contrast} · sharpness ${source.quality.sharpness}</small>` : '';
    const cached = fileCache.get(source.key); const preview = source.type === 'image' && cached?.prepared?.dataUrl ? `<img class="p83-source-preview" src="${cached.prepared.dataUrl}" alt="Preview ${escapeHtml(source.fileName)}">` : '';
    const sheet = source.status === 'choose_sheet' ? `<label>Worksheet<select data-p83-sheet="${source.id}"><option value="">Chọn worksheet…</option>${source.sheets.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('')}</select></label><button class="btn secondary" data-p83-extract-sheet="${source.id}">Trích xuất sheet</button>` : '';
    const pagePicker = source.type === 'pdf' && source.scannedPages?.length ? `<label>Trang scan cần OCR<input data-p83-pdf-pages="${source.id}" placeholder="Ví dụ: 1,3-5" aria-label="Trang scan cần OCR"><small>Có scan: ${source.scannedPages.join(', ')}</small></label>` : '';
    const ocr = ['ai_or_manual_required', 'needs_ai_or_manual', 'scan_detected', 'ocr_ready'].includes(source.status) ? `<button class="btn secondary" data-p83-ocr="${source.id}">AI OCR (cần đồng ý)</button>` : '';
    return `<article class="p83-source"><div>${preview}<b>${escapeHtml(source.fileName)}</b><span>${escapeHtml(source.type.toUpperCase())} · ${Math.round(source.size / 1024)} KB · ${escapeHtml(source.status)}</span>${quality}${(source.warnings || []).map((warning) => `<small class="warn">${escapeHtml(warning)}</small>`).join('')}</div><div>${sheet}${pagePicker}${ocr}</div></article>`;
  }
  function reviewRowsMarkup() {
    const start = (runtime.page - 1) * PAGE_SIZE; const rows = runtime.rows.slice(start, start + PAGE_SIZE);
    return rows.map((row) => `<article class="p83-review-row ${row.reviewStatus === 'needs_review' ? 'needs-review' : ''}" data-p83-row="${row.id}"><label><span><input type="checkbox" data-p83-select> Chọn</span><span><input type="checkbox" data-p83-field="included" ${row.included ? 'checked' : ''}> Dùng</span></label><label>Tiếng Hàn<input value="${escapeHtml(row.korean)}" data-p83-field="korean" maxlength="100"></label><label>Nghĩa<input value="${escapeHtml(row.meaning)}" data-p83-field="meaning" maxlength="200"></label><label>Loại từ<select data-p83-field="wordType">${WORD_TYPES.map((type) => `<option ${type === row.wordType ? 'selected' : ''}>${type}</option>`).join('')}</select></label><label>Chủ đề<input value="${escapeHtml(row.topic)}" data-p83-field="topic" maxlength="80"></label><label>Ví dụ<input value="${escapeHtml(row.example)}" data-p83-field="example" maxlength="300"></label><div class="p83-row-meta"><span>${Math.round(row.extractionConfidence * 100)}% · ${escapeHtml(row.extractionMethod || 'manual')}</span><small>${escapeHtml(row.sourceFileName)}${row.sourcePage ? ` · trang ${row.sourcePage}` : ''}${row.sourceSection ? ` · ${escapeHtml(row.sourceSection)}` : ''}</small>${row.issues.length ? `<em>${row.issues.map(escapeHtml).join(', ')}</em>` : ''}<button data-p83-delete="${row.id}" aria-label="Xóa mục">×</button></div></article>`).join('') || '<div class="empty-state"><h3>Chưa có mục từ</h3><p>Chọn file hoặc dùng camera. Với ảnh/PDF scan, OCR luôn cần review.</p></div>';
  }
  function importView() {
    const decks = global.P82DeckService?.all?.() || []; const review = P83ImportPipeline.validateReview(); const pages = Math.max(1, Math.ceil(runtime.rows.length / PAGE_SIZE)); runtime.page = Math.min(runtime.page, pages);
    return `<div class="p83-shell">${heading('Smart Document & Image Import', 'Extract → Preview → Validate → Review → Confirm → P82. Không có auto-import từ OCR.')}<section class="section p83-security"><b>Dữ liệu & quyền riêng tư</b><p>Parser XLSX/DOCX/PDF và OCR TextDetector chạy trên thiết bị. AI OCR chỉ chạy sau khi bạn bấm và đã bật AI; ảnh được gửi theo batch nhỏ tới API hiện có, không lưu binary/không CloudSync file. Chỉ metadata provenance của từ đã xác nhận được đồng bộ.</p></section><section class="section p83-picker"><div><h2>1. Chọn nguồn</h2><p>CSV · XLSX · TXT · JSON · DOCX · PDF · JPG/JPEG/PNG/WEBP. DOC cũ: Save as DOCX.</p></div><label class="btn primary">Chọn file<input hidden type="file" multiple data-p83-files accept=".csv,.xlsx,.txt,.json,.docx,.pdf,.jpg,.jpeg,.png,.webp"></label><label class="btn secondary">📷 Chụp ảnh<input hidden type="file" accept="image/*" capture="environment" data-p83-camera></label>${global.NativeCameraBridge?.available?.() ? '<button class="btn secondary" data-p83-native-camera>📷 Camera native</button>' : ''}<button class="btn secondary" data-p83-offline>⇩ Parser offline</button>${runtime.sources.length ? '<button class="btn secondary" data-p83-reprocess>↻ Reprocess</button>' : ''}<button class="btn secondary" data-view="${HISTORY_ROUTE}">Lịch sử import</button>${runtime.busy ? '<button class="btn danger" data-p83-cancel>Hủy</button>' : ''}</section>${runtime.progress ? `<section class="section p83-progress"><b>${escapeHtml(runtime.progress.label)}</b><progress value="${runtime.progress.current}" max="${Math.max(1, runtime.progress.total)}"></progress><span>${runtime.progress.current}/${runtime.progress.total}</span></section>` : ''}${runtime.errors.length ? `<section class="section p83-errors"><h2>Lỗi file</h2>${runtime.errors.map((error) => `<p><code>${escapeHtml(error.code)}</code><b>${escapeHtml(error.fileName)}</b><span>${escapeHtml(error.message)}</span></p>`).join('')}</section>` : ''}${runtime.sources.length ? `<section class="section"><h2>2. Nguồn & extraction</h2><div class="p83-sources">${runtime.sources.map(sourceMarkup).join('')}</div></section>` : ''}<section class="section p83-review"><div class="p83-review-head"><div><h2>3. Review bắt buộc</h2><p>${runtime.rows.length} mục · ${review.uncertain.length} cần xem lại · ${review.invalid.length} chưa hợp lệ</p></div><div><button class="btn secondary" data-p83-add>＋ Mục</button><button class="btn secondary" data-p83-merge>Gộp mục đã chọn</button></div></div><div class="p83-bulk"><label>Gán topic hàng loạt<input data-p83-bulk-topic maxlength="80" placeholder="Ví dụ: Trường học"></label><label>Loại từ<select data-p83-bulk-type><option value="">Giữ nguyên</option>${WORD_TYPES.map((type) => `<option>${type}</option>`).join('')}</select></label><button class="btn secondary" data-p83-apply-bulk>Áp dụng cho mục đã chọn</button></div><div class="p83-review-list">${reviewRowsMarkup()}</div><div class="p83-pagination"><button data-p83-page="${runtime.page - 1}" ${runtime.page <= 1 ? 'disabled' : ''}>←</button><span>Trang ${runtime.page}/${pages}</span><button data-p83-page="${runtime.page + 1}" ${runtime.page >= pages ? 'disabled' : ''}>→</button></div></section><section class="section p83-destination"><h2>4. Xác nhận import vào P82</h2><div><label><input type="radio" name="p83Destination" value="new" ${runtime.destination === 'new' ? 'checked' : ''}> Tạo bộ từ mới</label><label><input type="radio" name="p83Destination" value="existing" ${runtime.destination === 'existing' ? 'checked' : ''}> Thêm vào bộ hiện có</label></div><label>Tên bộ mới<input data-p83-title value="" placeholder="Từ vựng từ tài liệu"></label><label>Bộ hiện có<select data-p83-deck><option value="">Chọn bộ từ…</option>${decks.map((deck) => `<option value="${deck.id}">${escapeHtml(deck.title)} (${deck.totalWords})</option>`).join('')}</select></label><label>Trùng lặp<select data-p83-duplicate><option value="skip">Bỏ qua</option><option value="merge">Gộp metadata</option><option value="duplicate">Giữ cả hai</option></select></label><button class="btn primary" data-p83-commit ${!review.valid ? 'disabled' : ''}>Tôi đã review · Import ${review.included.length} mục</button><small>Việc nhấn nút là xác nhận rõ ràng. Không mục OCR nào được tự động import.</small></section>${runtime.result ? `<section class="section p83-result"><h2>Import hoàn tất</h2><p><b>${escapeHtml(runtime.result.title)}</b> · +${runtime.result.added}, gộp ${runtime.result.merged}, bỏ qua ${runtime.result.skipped}</p><button class="btn primary" data-p83-open-deck="${runtime.result.deckId}">Mở bộ từ / Học P82</button>${P83TeacherBridgeService.available() ? `<button class="btn secondary" data-p83-teacher-draft="${runtime.result.deckId}">Tạo Teacher draft P76</button><button class="btn secondary" data-p83-assignment="${runtime.result.deckId}">Mở Classroom để giao bài</button>` : ''}</section>` : ''}</div>`;
  }
  function historyView() {
    const records = (global.P82DeckService?.all?.() || []).flatMap((deck) => (deck.imports || []).map((item) => ({ ...item, deckId: deck.id, deckTitle: deck.title }))).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return `<div class="p83-shell">${heading('Import History', 'Lưu metadata nguồn và kết quả; không lưu file/ảnh/PDF binary. Reprocess yêu cầu chọn lại file để bảo vệ riêng tư.')}<section class="section p83-history">${records.map((item) => `<article><div><b>${escapeHtml(item.fileName)}</b><span>${escapeHtml(item.deckTitle)} · ${escapeHtml(item.sourceType || 'file')}</span><small>${new Date(item.createdAt).toLocaleString('vi-VN')} · +${item.added}, gộp ${item.merged}, bỏ qua ${item.skipped}</small>${item.sourceFiles?.length ? `<details><summary>Xem nguồn</summary>${item.sourceFiles.map((source) => `<small>${escapeHtml(source.name)} · ${escapeHtml(source.type)}${source.pages ? ` · ${source.pages} trang` : ''}</small>`).join('')}</details>` : ''}</div><button class="btn secondary" data-p83-open-deck="${item.deckId}">Mở</button><button class="btn secondary" data-view="${ROUTE}">Chọn lại file để reprocess</button></article>`).join('') || '<div class="empty-state"><h3>Chưa có lịch sử</h3><p>Import đã xác nhận sẽ xuất hiện tại đây.</p></div>'}</section></div>`;
  }

  function selectedRowIds() { return [...document.querySelectorAll('[data-p83-row] [data-p83-select]:checked')].map((input) => input.closest('[data-p83-row]')?.dataset.p83Row).filter(Boolean); }
  function bind() {
    if (![ROUTE, HISTORY_ROUTE].includes(state.currentView)) return;
    document.querySelector('[data-p83-files]')?.addEventListener('change', (event) => P83ImportPipeline.process(event.target.files).catch((error) => { runtime.errors.push(recordError(null, error)); runtime.busy = false; render(); }));
    document.querySelector('[data-p83-camera]')?.addEventListener('change', (event) => P83ImportPipeline.process(event.target.files).catch((error) => { runtime.errors.push(recordError(null, error)); runtime.busy = false; render(); }));
    document.querySelector('[data-p83-native-camera]')?.addEventListener('click', async () => { try { const file = await global.NativeCameraBridge.captureFile(); if (file) await P83ImportPipeline.process([file]); } catch (error) { runtime.errors.push(recordError(null, error)); render(); } });
    document.querySelector('[data-p83-offline]')?.addEventListener('click', async () => { const result = await P83OfflineService.prepare(); toast(result.cached ? `Đã lưu ${result.assets} parser/assets để dùng offline.` : 'Trình duyệt không hỗ trợ cache offline.'); });
    document.querySelector('[data-p83-reprocess]')?.addEventListener('click', async () => { const preserve = global.confirm?.('Giữ các chỉnh sửa thủ công đã khớp nguồn khi reprocess? Nhấn OK để giữ.'); if (preserve === false && !global.confirm?.('Bạn muốn bỏ chỉnh sửa thủ công và dùng extraction mới?')) return; try { const result = await P83ImportPipeline.reprocess(preserve !== false); toast(`Đã reprocess ${result.sources} nguồn.`); } catch (error) { toast(error.message); } });
    document.querySelector('[data-p83-cancel]')?.addEventListener('click', () => { P83ImportPipeline.cancel(); render(); });
    document.querySelectorAll('[data-p83-extract-sheet]').forEach((button) => button.addEventListener('click', () => { const select = document.querySelector(`[data-p83-sheet="${button.dataset.p83ExtractSheet}"]`); try { const count = P83ImportPipeline.extractSheet(button.dataset.p83ExtractSheet, select?.value); toast(`Đã trích xuất ${count} mục từ worksheet.`); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('[data-p83-ocr]').forEach((button) => button.addEventListener('click', async () => { const source = runtime.sources.find((item) => item.id === button.dataset.p83Ocr); if (source?.type === 'pdf') source.selectedPages = parsePageSelection(document.querySelector(`[data-p83-pdf-pages="${source.id}"]`)?.value, source.scannedPages); if (!global.confirm?.('AI OCR sẽ gửi ảnh/trang scan đã nén tới API AI hiện có. File gốc không được lưu. Tiếp tục?')) return; try { const count = await P83ImportPipeline.ocrSources([button.dataset.p83Ocr], 'ai'); toast(`AI OCR tạo ${count} mục. Hãy review từng mục.`); } catch (error) { toast(error.message); } }));
    document.querySelectorAll('[data-p83-field]').forEach((input) => input.addEventListener('change', () => { const row = runtime.rows.find((item) => item.id === input.closest('[data-p83-row]')?.dataset.p83Row); if (!row) return; const field = input.dataset.p83Field; row[field] = field === 'included' ? input.checked : clean(input.value, field === 'example' ? 300 : 200); if (['korean', 'meaning'].includes(field)) { row.issues = row.issues.filter((issue) => !['missing_korean', 'missing_meaning', 'no_hangul'].includes(issue)); if (!row.korean) row.issues.push('missing_korean'); if (!row.meaning) row.issues.push('missing_meaning'); if (row.korean && !hasHangul(row.korean)) row.issues.push('no_hangul'); row.reviewStatus = row.issues.length ? 'needs_review' : 'ready'; } }));
    document.querySelectorAll('[data-p83-delete]').forEach((button) => button.addEventListener('click', () => { runtime.rows = runtime.rows.filter((row) => row.id !== button.dataset.p83Delete); render(); }));
    document.querySelector('[data-p83-add]')?.addEventListener('click', () => { runtime.rows.unshift(candidate({ extractionMethod: 'manual', extractionConfidence: 1, reviewStatus: 'needs_review' })); runtime.page = 1; render(); });
    document.querySelector('[data-p83-merge]')?.addEventListener('click', () => { if (!P83ImportPipeline.mergeRows(selectedRowIds())) toast('Chọn ít nhất 2 mục trong trang để gộp.'); else render(); });
    document.querySelector('[data-p83-apply-bulk]')?.addEventListener('click', () => { const ids = new Set(selectedRowIds()); const topic = clean(document.querySelector('[data-p83-bulk-topic]')?.value, 80); const type = document.querySelector('[data-p83-bulk-type]')?.value; runtime.rows.forEach((row) => { if (ids.has(row.id)) { if (topic) row.topic = topic; if (WORD_TYPES.includes(type)) row.wordType = type; } }); render(); });
    document.querySelectorAll('[data-p83-page]').forEach((button) => button.addEventListener('click', () => { runtime.page = Math.max(1, Number(button.dataset.p83Page) || 1); render(); }));
    document.querySelectorAll('input[name="p83Destination"]').forEach((input) => input.addEventListener('change', () => { runtime.destination = input.value; }));
    document.querySelector('[data-p83-commit]')?.addEventListener('click', () => { try { const result = P83ImportPipeline.commit({ title: document.querySelector('[data-p83-title]')?.value, deckId: runtime.destination === 'existing' ? document.querySelector('[data-p83-deck]')?.value : '', duplicateMode: document.querySelector('[data-p83-duplicate]')?.value }); toast(`Đã import ${result.added} từ.`); } catch (error) { toast(error.message); } });
    document.querySelectorAll('[data-p83-open-deck]').forEach((button) => button.addEventListener('click', () => { state.p82Vocabulary ||= {}; state.p82Vocabulary.deckId = button.dataset.p83OpenDeck; setView('vocabulary-deck-p82'); }));
    document.querySelector('[data-p83-teacher-draft]')?.addEventListener('click', () => { try { const draft = P83TeacherBridgeService.createDraft(document.querySelector('[data-p83-teacher-draft]').dataset.p83TeacherDraft); toast(`Đã tạo draft ${draft.id}; cần Automated Check và Human Review.`); setView('creator-studio-p76'); } catch (error) { toast(error.message); } });
    document.querySelector('[data-p83-assignment]')?.addEventListener('click', () => setView('teacher-classroom-p76'));
  }

  Object.assign(global, { P83FileValidationService, P83XlsxParser, P83DocxParser, P83PdfParser, P83StructureService, P83ImageOcrService, P83ImportPipeline, P83TeacherBridgeService, P83OfflineService, SmartDocumentVocabularyImport: { version: 'p83-v1', route: ROUTE, validation: P83FileValidationService, xlsx: P83XlsxParser, docx: P83DocxParser, pdf: P83PdfParser, ocr: P83ImageOcrService, pipeline: P83ImportPipeline, teacher: P83TeacherBridgeService, offline: P83OfflineService } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), [ROUTE]: importView, [HISTORY_ROUTE]: historyView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER; global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); if (state.currentView === 'my-vocabulary-p82' && !document.querySelector('[data-p83-entry]')) document.querySelector('.p82-toolbar')?.insertAdjacentHTML('beforeend', '<button class="btn primary" data-view="smart-vocabulary-import-p83" data-p83-entry>▣ Smart Import P83</button>'); };
})(window);
