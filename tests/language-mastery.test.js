const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'language-mastery-data.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'language-mastery.js'), 'utf8');
const scoped = new Map();

function boot(userId = 'learner-a') {
  const inserted = [];
  const state = { currentUser: { id: userId }, currentView: 'language-mastery', srsData: [] };
  const dictionary = [
    { id: 'word-school', korean: '학교', meanings: { vi: 'trường học' } },
    { id: 'word-subway', korean: '지하철', meanings: { vi: 'tàu điện ngầm' } }
  ];
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { languageMastery: 'language-mastery', savedSentences: 'saved-sentences' },
      render: () => {},
      setView: (view) => { state.currentView = view; },
      toast: () => {},
      escapeHtml: String,
      userScoped: (key) => (scoped.get(key) || {})[userId] || [],
      saveUserScoped: (key, items) => { const records = scoped.get(key) || {}; records[userId] = items; scoped.set(key, records); },
      DictionaryService: {
        search: (query) => dictionary.filter((item) => item.korean.includes(query)),
        byId: (id) => dictionary.find((item) => item.id === id),
        addToSrs: (entry) => { window.addedToSrs = entry; state.srsData.push({ wordId: entry.id }); }
      },
      MasteryService: { updateLesson: (...args) => { window.masteryUpdate = args; } },
      CloudSyncService: { schedule: (reason) => { window.syncReason = reason; } },
      speakKorean: () => {},
      PronunciationProvider: {
        evaluate: () => ({
          score: 78,
          breakdown: { segments: [
            { syllable: '학', status: 'correct', score: 96, focus: [] },
            { syllable: '교', status: 'close', score: 61, focus: ['ㅛ'] }
          ] }
        })
      },
      getUserProgress: () => ({ pronunciationAttempts: [{ breakdown: { focusSounds: ['ㅛ'] } }] })
    },
    ErrorNotebookService: { all: () => [{ type: 'grammar', mistake: '저가 학생이에요.', correction: '저는 학생이에요.', count: 3 }] },
    ShadowingRecorderService: { all: () => [{ id: 'shadow-1' }] },
    VocabularyCollectionService: { all: () => [{ id: 'work', title: 'Công việc' }] },
    GrammarNotebookService: { get: () => null, upsert: () => ({}) },
    KLEARN_EXTRA_VIEWS: {},
    KLEARN_AFTER_RENDER: null
  };
  const document = {
    documentElement: { lang: 'vi' },
    querySelector: (selector) => selector === '.speaking-stage' ? { insertAdjacentHTML: (_position, html) => inserted.push(html) } : null,
    querySelectorAll: () => [],
    getElementById: () => null
  };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(moduleSource, context);
  window.inserted = inserted;
  return window;
}

const first = boot('mastery-user');
assert.equal(first.SubtitleLearningService.scenes().length, 3);
assert.match(first.KLEARN_EXTRA_VIEWS['language-mastery'](), /Học qua phụ đề/);
assert.match(first.KLEARN_EXTRA_VIEWS['language-mastery'](), /Collocation Trainer/);
assert.match(first.KLEARN_EXTRA_VIEWS['language-mastery'](), /Dictation Master/);

const subtitleBefore = first.KLEARN_EXTRA_VIEWS['subtitle-learning']();
assert.match(subtitleBefore, /Ẩn bản dịch/);
assert.match(subtitleBefore, /data-subtitle-word/);
assert.match(subtitleBefore, /data-subtitle-grammar/);
first.SubtitleLearningService.toggleTranslation();
assert.match(first.KLEARN_EXTRA_VIEWS['subtitle-learning'](), /Hiện bản dịch/);

first.SubtitleLearningService.saveSentence();
first.SubtitleLearningService.saveSentence();
assert.equal(first.KLEARN_APP.userScoped('saved-sentences').length, 1, 'saved subtitle sentences are de-duplicated');
first.SubtitleLearningService.completeScene();
assert.equal(first.masteryUpdate[0], 'subtitle:subtitle-cafe-order');
assert.ok(first.SubtitleLearningService.progress().completedSceneIds.includes('subtitle-cafe-order'));

const heatmap = first.PronunciationHeatmapService.analyze('학교', '학고');
assert.equal(heatmap.score, 78);
assert.equal(heatmap.segments[0].strength, 'strong');
assert.equal(heatmap.segments[1].strength, 'developing');
assert.equal(heatmap.weakSounds[0], 'ㅛ');
assert.equal(first.PronunciationHeatmapService.recentWeakSounds()[0].sound, 'ㅛ');
first.KLEARN_MODULE_DATA = { speakingModes: [{ id: 'sentence', korean: '학교에 가요.' }] };
first.KLEARN_APP.state.currentView = 'speaking-session';
first.KLEARN_APP.state.speakingMode = 'sentence';
first.KLEARN_AFTER_RENDER();
assert.match(first.inserted.join(''), /Native Voice Comparison/);
assert.match(first.inserted.join(''), /학교에 가요/);

const prediction = first.GrammarMistakePredictionService.all()[0];
assert.equal(prediction.label, '은/는');
assert.equal(prediction.count, 3);
const grammarView = first.KLEARN_EXTRA_VIEWS['grammar-mastery']();
assert.match(grammarView, /Ví dụ thường gặp/);
assert.match(grammarView, /Ví dụ sai/);
assert.match(grammarView, /Người Hàn thường nói/);
assert.match(grammarView, /Bạn thường sai trợ từ này/);

const image = first.VocabularyImageMemoryService.all().find((item) => item.korean === '지하철');
first.VocabularyImageMemoryService.addToSrs(image);
assert.equal(first.addedToSrs.id, 'word-subway');
assert.match(first.KLEARN_EXTRA_VIEWS['vocabulary-image-memory'](), /Thêm vào SRS/);

const isolated = boot('isolated-user');
assert.equal(isolated.SubtitleLearningService.progress().completedSceneIds, undefined, 'language mastery progress remains user scoped');
assert.match(isolated.KLEARN_EXTRA_VIEWS['subtitle-learning'](), /Ẩn bản dịch/);
assert.equal(typeof isolated.KLEARN_EXTRA_VIEWS['language-mastery'], 'function');

console.log('language mastery: subtitles, pronunciation, native comparison support, image vocabulary, grammar prediction and reuse routes passed');
