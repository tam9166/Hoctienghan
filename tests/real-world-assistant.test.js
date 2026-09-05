const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'real-world-assistant.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'real-world-assistant.js'), 'utf8');

function boot(userId = 'learner-a', shared = new Map()) {
  const state = { currentUser: { id: userId }, currentView: 'home', srsData: [], realWorldAssistant: null };
  const syncEvents = []; let savedSrs = [];
  const userScoped = (key) => shared.get(key)?.[state.currentUser?.id] || [];
  const saveUserScoped = (key, items) => { const all = shared.get(key) || {}; all[state.currentUser.id] = items; shared.set(key, all); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    document,
    KLEARN_APP: {
      state, STORAGE_KEYS: { ecosystemExpansion: 'ecosystem' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String,
      userScoped, saveUserScoped, saveUserSrs: (cards) => { savedSrs = cards; state.srsData = cards; }, DictionaryService: { all: () => [], addToSrs: () => {} }, CloudSyncService: { schedule: (event) => syncEvents.push(event) }, speakKorean: () => {}
    },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    GlobalSearchService: { search: () => ({ studyTools: [] }) }
  };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.RealWorldContentService.hydrate(content);
  return { window, state, shared, syncEvents, savedSrs: () => savedSrs };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.equal(content.guides.length, 4);
assert.equal(content.checklist.length, 10);
assert.ok(content.menuItems.some((item) => item.category === 'restaurant'));
assert.ok(content.menuItems.some((item) => item.category === 'cafe'));
assert.ok(content.menuItems.some((item) => item.category === 'convenience'));

const shared = new Map(); const a = boot('learner-a', shared); const app = a.window;
const contract = app.KoreanDocumentAssistantService.analyze('임대차계약서 보증금 500만원 월세 50만원 관리비', 'document');
assert.equal(contract.type.id, 'rental-contract');
assert.ok(contract.matches.some((item) => item.term === '임대차계약서'));
assert.ok(contract.matches.some((item) => item.term === '보증금'));
assert.match(contract.translation, /합동|협동|hợp đồng/);
assert.equal(contract.persisted, false);
assert.equal(app.KoreanDocumentAssistantService.privacy().imageStored, false);
assert.equal(app.KoreanDocumentAssistantService.privacy().textStored, false);
assert.equal(app.KoreanDocumentAssistantService.privacy().uploads, false);
assert.equal(a.syncEvents.length, 0, 'document analysis must not sync private text');
assert.deepEqual(a.window.KLEARN_APP.userScoped('ecosystem'), [], 'document text must not be persisted');

const menu = app.MenuReaderService.read('김치찌개 하나 주세요', 'restaurant');
assert.equal(menu.items[0].name, '김치찌개');
assert.match(menu.items[0].order, /주세요/);
assert.match(menu.disclaimer, /dị ứng/);
const signs = app.SignReaderService.read('출입금지');
assert.equal(signs.signs[0].severity, 'danger');
assert.match(signs.signs[0].action.vi, /Không đi qua/);

const cultureUnsafe = app.CultureWarningService.evaluate('이거 줘', 'workplace');
assert.equal(cultureUnsafe.safe, false);
assert.match(cultureUnsafe.message, /thiếu lịch sự/);
const cultureSafe = app.CultureWarningService.evaluate('이 자료를 보내 주실 수 있을까요?', 'workplace');
assert.equal(cultureSafe.safe, true);

assert.equal(app.SurvivalChecklistService.progress().percentage, 0);
app.SurvivalChecklistService.toggle('order-food');
assert.equal(app.SurvivalChecklistService.progress().done, 1);
assert.equal(app.SurvivalChecklistService.progress().percentage, 10);
assert.ok(a.syncEvents.includes('real-world-assistant'));
app.RealWorldGuideService.complete('banking');
assert.equal(app.RealWorldGuideService.completed('banking'), true);

assert.equal(app.KoreanDocumentAssistantService.addVocabulary('계약서'), true);
assert.equal(a.savedSrs().length, 1);
assert.equal(a.savedSrs()[0].korean, '계약서');
assert.equal(a.savedSrs()[0].source, 'real-world-assistant');
assert.equal(a.savedSrs()[0].meaningVi, 'hợp đồng');
assert.equal(a.savedSrs()[0].meaningEn, 'contract');
assert.equal(app.KoreanDocumentAssistantService.addVocabulary('계약서'), true);
assert.equal(a.savedSrs().length, 1, 'SRS item must not be duplicated');

const b = boot('learner-b', shared);
assert.equal(b.window.SurvivalChecklistService.progress().done, 0, 'checklist must be user scoped');
assert.equal(b.window.RealWorldGuideService.completed('banking'), false, 'guide progress must be user scoped');
assert.equal(typeof app.KLEARN_EXTRA_VIEWS['real-world-assistant'], 'function');
assert.equal(typeof app.KLEARN_EXTRA_VIEWS['survival-checklist'], 'function');
assert.match(app.GlobalSearchService.search('ngân hàng').studyTools[0].title, /Hàn/);

console.log('real world assistant: private document analysis, menu, sign, culture, guides, SRS and user-scoped checklist passed');
