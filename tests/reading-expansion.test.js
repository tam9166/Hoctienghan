const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'reading-expansion-data.js'), 'utf8');
const systemSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'reading-expansion.js'), 'utf8');
const scoped = new Map();
const masteryUpdates = [];
let errors = 0;
let graphUpdates = 0;
let progress = {
  daily: { tasks: { practice: false, listening: false } },
  skills: { reading: 0, listening: 0 },
  lessonProgress: {}
};

function boot() {
  const state = { currentUser: { id: 'reading-qa' }, currentView: 'reading-lab' };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { readingExpansion: 'reading-expansion' },
      render: () => {},
      setView: (view) => { state.currentView = view; },
      toast: () => {},
      escapeHtml: String,
      getUserProgress: () => progress,
      saveUserProgress: (value) => { progress = value; },
      userScoped: (key) => scoped.get(key) || [],
      saveUserScoped: (key, value) => scoped.set(key, value),
      MasteryService: { updateLesson: (id, score, extra) => masteryUpdates.push({ id, score, extra }) },
      DictionaryService: {
        byId: (id) => window.KLEARN_DICTIONARY.find((entry) => entry.id === id),
        addToSrs: () => {}
      }
    },
    KLEARN_DICTIONARY: [
      { id: 'rice', korean: '밥', meanings: { vi: 'cơm; bữa ăn' } },
      { id: 'eat', korean: '먹다', meanings: { vi: 'ăn' } }
    ],
    KLEARN_EXTRA_VIEWS: {},
    KLEARN_AFTER_RENDER: null,
    ErrorNotebookService: { add: () => { errors += 1; } },
    KnowledgeGraphService: {
      get: (word) => word === '먹다' ? { id: 'eat-node' } : null,
      record: () => { graphUpdates += 1; }
    }
  };
  const document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(systemSource, context);
  return window;
}

const app = boot();
const content = app.KLEARN_READING_EXPANSION;
assert.equal(content.readings.length, 6, 'ships two readings for every requested level');
assert.deepEqual([...new Set(content.readings.map((item) => item.level))], ['Beginner', 'TOPIK 1', 'TOPIK 2+']);
content.readings.forEach((item) => {
  assert.equal(item.verified, true, `${item.id} is verified content`);
  assert.equal(item.reviewStatus, 'approved', `${item.id} is approved`);
  assert.ok(item.segments.some((segment) => segment.word), `${item.id} has inline vocabulary`);
  assert.ok(item.segments.some((segment) => segment.grammar), `${item.id} has inline grammar`);
  assert.ok(item.questions.length, `${item.id} has comprehension questions`);
});

for (const route of ['reading-lab', 'reading-session', 'word-network', 'collocation-trainer', 'dictation-master']) {
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
}
assert.match(app.KLEARN_EXTRA_VIEWS['reading-lab'](), /Câu ngắn/);
assert.match(app.KLEARN_EXTRA_VIEWS['reading-lab'](), /Word Relationship Map/);

app.ReadingExpansionService.startReading('read-beginner-day');
assert.equal(app.KLEARN_APP.state.currentView, 'reading-session');
app.KLEARN_APP.state.readingLab.activeLookup = { type: 'word', index: 2 };
let sessionHtml = app.KLEARN_EXTRA_VIEWS['reading-session']();
assert.match(sessionHtml, /Từ trong bài/);
assert.match(sessionHtml, /cơm; bữa ăn/);
assert.match(sessionHtml, /data-reading-add-srs="rice"/, 'inline vocabulary connects to SRS');
app.KLEARN_APP.state.readingLab.activeLookup = { type: 'grammar', index: 1 };
sessionHtml = app.KLEARN_EXTRA_VIEWS['reading-session']();
assert.match(sessionHtml, /Ngữ pháp trong câu/);
assert.match(sessionHtml, /Đánh dấu thời điểm/);

const network = content.wordNetworks.find((item) => item.root === '먹다');
assert.ok(network.forms.some((item) => item.korean === '먹어요'));
assert.ok(network.forms.some((item) => item.korean === '먹고 싶어요'));
assert.ok(network.related.some((item) => item.korean === '먹방'));
assert.ok(network.collocations.some((item) => item.korean === '밥을 먹다'));

const perfect = app.DictationEvaluationService.compare('저는 학생이에요.', '저는 학생이에요.');
assert.equal(perfect.score, 100);
assert.equal(perfect.errors, 0);
assert.ok(perfect.aligned.every((character) => character.status === 'correct'));
const imperfect = app.DictationEvaluationService.compare('저는 학생이에요.', '저 학생이예요.');
assert.ok(imperfect.score < 100);
assert.ok(imperfect.errors > 0);
assert.ok(imperfect.aligned.some((character) => character.status !== 'correct'));

const reading = content.readings.find((item) => item.id === 'read-beginner-day');
app.ReadingProgressService.recordReading(reading, {
  score: 80,
  durationSeconds: 60,
  newWords: ['먹다'],
  wrongQuestions: [{ prompt: '어디에 가요?', selected: '회사', correct: '학교' }]
});
assert.equal(app.ReadingProgressService.get('reading', reading.id).completed, true);
assert.equal(app.ReadingProgressService.summary().completed, 1);
assert.equal(app.ReadingProgressService.summary().newWords, 1);
assert.equal(progress.daily.tasks.practice, true);
assert.ok(progress.skills.reading > 0);
assert.equal(graphUpdates, 1, 'new vocabulary updates the knowledge graph');

const collocation = content.collocations[0];
app.ReadingProgressService.recordCollocation(collocation, false, '먹다');
app.ReadingProgressService.recordDictation(content.dictations[0], { ...imperfect, answer: '저 학생이예요.' });
assert.equal(progress.daily.tasks.listening, true);
assert.ok(progress.skills.listening > 0);
assert.equal(errors, 3, 'reading, collocation and dictation mistakes enter Error Notebook');
assert.equal(masteryUpdates.length, 3, 'all learning activities update Mastery');

const reloaded = boot();
assert.equal(reloaded.ReadingProgressService.get('reading', reading.id).bestScore, 80, 'reading progress survives reload');
assert.equal(/audio|blob|data:/i.test(JSON.stringify(scoped.get('reading-expansion'))), false, 'progress does not store audio payloads');
console.log('reading expansion: content, inline lookup, dictation and learning integrations passed');
