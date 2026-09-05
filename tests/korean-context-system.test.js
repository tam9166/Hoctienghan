const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'korean-context-data.js'), 'utf8');
const systemSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'korean-context-system.js'), 'utf8');

const state = { currentUser: { id: 'qa' }, globalQuery: '', currentView: 'home' };
const window = {
  KLEARN_APP: { state, render: () => {}, setView: () => {}, escapeHtml: String },
  KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, KLEARN_DICTIONARY: []
};
const context = {
  window, console, String, Number, Object, Array, Math, Set, Map, Date,
  FormData: class { get() { return ''; } },
  document: { querySelector: () => null, getElementById: () => null }
};
vm.createContext(context);
vm.runInContext(dataSource, context);
vm.runInContext(systemSource, context);

const service = window.KoreanContextService;
assert.ok(service, 'context service is exposed');
assert.equal(typeof window.KLEARN_EXTRA_VIEWS['natural-korean'], 'function', 'natural Korean route is registered');

const thanks = service.findVocabulary({ korean: '감사합니다', topic: 'greetings' });
assert.equal(thanks.verified, true);
assert.equal(thanks.reviewStatus, 'approved');
assert.ok(thanks.whenUsed.some((item) => item.includes('người lạ')));
assert.ok(thanks.whenUsed.some((item) => item.includes('công việc')));
assert.ok(thanks.avoid.some((item) => item.includes('bạn thân')));
assert.equal(service.findVocabulary({ korean: '안녕하세요', topic: 'greetings' }), null, 'topic alone must not attach the wrong word note');

const school = service.findVocabulary('학교');
assert.ok(school.collocations.some((item) => item.korean === '학교에 가다'));
assert.ok(school.collocations.some((item) => item.korean === '학교에서 공부하다'));
assert.ok(school.invalidUsage.some((item) => item.korean === '학교를 먹다'));

const politeDaily = service.formalityLevels().find((item) => item.id === 'haeyoche');
assert.equal(politeDaily.group, '존댓말', '해요체 is correctly explained as 존댓말');
assert.ok(service.formalityLevels().some((item) => item.id === 'banmal'));

const casualHello = service.findNatural('natural-hello');
assert.equal(casualHello.textbook, '안녕하세요.');
assert.equal(casualHello.natural, '안녕!');
assert.ok(casualHello.note.includes('người lạ'));

assert.ok(service.search('người lạ').some((item) => item.id === 'context-gamsahamnida'), 'search indexes culture notes');
assert.ok(service.search('안녕').some((item) => item.id === 'natural-hello'), 'search indexes natural expressions');
assert.ok(service.search('학교에서 공부하다').some((item) => item.id === 'context-school'), 'search indexes usage examples');
assert.ok(service.search('lịch sự đời thường').some((item) => item.type === 'formality'), 'search indexes formality explanations');

const grammar = service.findGrammarForLesson({ id: 'topik-1-20', title: 'Bài 20 · Ngữ pháp cơ bản', topic: 'Ngữ pháp cơ bản' });
assert.equal(grammar.id, 'grammar-eun-neun', 'grammar lessons receive a relevant culture note');

console.log('Korean context system: culture, natural speech, formality, collocations and search passed');
