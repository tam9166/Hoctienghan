const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/real-korean-experience.json'));

function createRuntime() {
  const values = new Map(); const srsAdds = []; const errors = []; const sync = [];
  const state = { currentUser: { id: 'learner-a', currentTopikLevel: 1 }, currentView: 'lessons' };
  const scoped = (key) => values.get(key)?.[state.currentUser.id] || [];
  const saveScoped = (key, items, limit = 100) => { const all = values.get(key) || {}; all[state.currentUser.id] = items.slice(0, limit); values.set(key, all); };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { realKoreanExperience: 'p71b', savedSentences: 'sentences', shadowingProgress: 'shadowing' },
      userScoped: scoped, saveUserScoped: saveScoped, setView(view) { state.currentView = view; }, render() {}, toast() {}, escapeHtml: String, speakKorean() {},
      DictionaryService: { search: (term) => [{ id: `dictionary-${term}`, korean: term }], addToSrs: (entry) => srsAdds.push(entry) },
      CloudSyncService: { schedule: (reason) => sync.push(reason) }
    },
    VoiceCaptureService: { supported: () => ({ microphone: false, recorder: false, recognition: false, audioSignals: false }), start: async () => ({ status: 'text-fallback' }), stop: async () => ({ status: 'idle', transcript: '', audioStored: false }) },
    VoiceAnalysisService: { evaluate: async ({ target, transcript }) => ({ pronunciation: target === transcript ? 96 : 62, fluency: target === transcript ? 90 : 58, method: 'transparent-browser-fallback' }) },
    AIOrchestrationService: { request: async () => ({ fallback: true, reply: 'AI unavailable' }) },
    ErrorNotebookService: { add: (item) => errors.push(item) }, LearningMemoryService: { upsert() {} },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, document: null
  };
  window.window = window;
  vm.runInNewContext(read('data/real-korean-experience.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, Set, Map, Promise, FormData: class {} });
  window.RealKoreanContentService.hydrate(content);
  return { window, state, values, srsAdds, errors, sync };
}

(async () => {
  const runtime = createRuntime(); const w = runtime.window;
  for (const service of ['RealKoreanContentService', 'VietnamesePronunciationLabService', 'SentenceMiningService', 'RealMediaLearningService', 'RealConversationPracticeService', 'RealShadowingService', 'RealKoreanExperienceService']) assert.ok(w[service], `${service} missing`);

  assert.equal(w.RealKoreanContentService.get().status, 'approved');
  assert.equal(w.RealKoreanContentService.get().verified, true);
  assert.throws(() => w.RealKoreanContentService.hydrate({ schemaVersion: 1, status: 'draft', verified: false }), /quality gate/);
  w.RealKoreanContentService.hydrate(content);

  assert.deepEqual([...w.VietnamesePronunciationLabService.all().map((item) => item.sound)], ['ㄹ', 'ㅓ', 'ㅡ', '받침', '연음']);
  assert.deepEqual(w.VietnamesePronunciationLabService.support(), { microphone: false, recorder: false, recognition: false, audioSignals: false });
  assert.equal((await w.VietnamesePronunciationLabService.startCapture()).status, 'text-fallback');
  const confused = await w.VietnamesePronunciationLabService.analyze('vn-eo', { transcript: '소울' });
  assert.equal(confused.wrongSound, 'ㅗ'); assert.match(confused.feedback, /ㅓ.*가까.*ㅗ|ㅓ.*gần ㅗ/); assert.equal(confused.audioStored, false);
  const missing = await w.VietnamesePronunciationLabService.analyze('vn-batchim', { transcript: '한구' });
  assert.equal(missing.wrongSound, 'ㄱ 받침'); assert.ok(runtime.errors.length >= 2);

  for (const sourceType of ['film', 'webtoon', 'youtube', 'document']) {
    const mined = w.SentenceMiningService.mine({ sourceType, sourceLabel: 'Nguồn cá nhân', sentence: '오늘 뭐 먹을래?', translation: 'Hôm nay ăn gì?' });
    assert.ok(mined.vocabulary.length >= 3); assert.equal(mined.grammar[0].id, 'g-eulrae'); assert.equal(mined.flashcards.length, mined.vocabulary.length);
  }
  const latest = w.SentenceMiningService.all()[0];
  assert.equal(w.SentenceMiningService.createFlashcards(latest).length, latest.vocabulary.length);
  assert.ok(runtime.srsAdds.length >= 3);

  assert.equal(w.RealMediaLearningService.all().length, 3); assert.ok(w.RealMediaLearningService.all().some((item) => item.type === 'short-video'));
  const media = w.RealMediaLearningService.complete('media-cafe-order', 1);
  assert.equal(media.completed, true); assert.equal(w.RealMediaLearningService.progress('media-cafe-order').lineIndex, 1);
  assert.equal(w.RealMediaLearningService.addVocabulary('coffee').korean, '커피');

  assert.deepEqual([...w.RealConversationPracticeService.all().map((item) => item.topic)], ['restaurant', 'airport', 'interview', 'hospital', 'workplace']);
  const conversation = await w.RealConversationPracticeService.evaluate('real-hospital', '배가 아파요.');
  assert.ok(conversation.overall >= 70); assert.equal(conversation.aiStatus, 'fallback'); assert.equal(conversation.partnerReply, '언제부터 아팠어요?'); assert.equal(conversation.audioStored, false);

  assert.deepEqual([...w.RealShadowingService.speeds('shadow-cafe')], [.75, 1, 1.15]);
  const shadow = await w.RealShadowingService.compare('shadow-cafe', '아메리카노 한 잔 주세요.', { speed: .75 });
  assert.equal(shadow.speed, .75); assert.equal(shadow.audioStored, false); assert.ok(shadow.score >= 90);
  assert.equal(runtime.values.get('shadowing')['learner-a'].length, 1);

  const countA = w.RealKoreanExperienceService.summary().mined;
  runtime.state.currentUser = { id: 'learner-b', currentTopikLevel: 1 };
  assert.equal(JSON.stringify(w.RealKoreanExperienceService.summary()), JSON.stringify({ pronunciation: 0, mined: 0, media: 0, conversation: 0, shadowing: 0 }));
  runtime.state.currentUser = { id: 'learner-a', currentTopikLevel: 1 };
  assert.equal(w.RealKoreanExperienceService.summary().mined, countA);
  assert.ok(runtime.sync.includes('p71b-pronunciation'));

  const appSource = read('app.js'); const loader = read('data/route-loader.js'); const worker = read('sw.js'); const css = read('real-korean-experience.css');
  const migration = read('supabase/migrations/20260912_p71b_real_korean_experience.sql'); const report = read('docs/P71B_REAL_KOREAN_EXPERIENCE_REPORT.md');
  assert.match(appSource, /realKoreanExperience: 'klearn_real_korean_experience'/); assert.match(appSource, /STORAGE_KEYS\.realKoreanExperience/); assert.match(appSource, /\[STORAGE_KEYS\.realKoreanExperience\]: 400/);
  assert.match(loader, /real-korean-experience\.css\?v=1/); assert.match(loader, /data\/real-korean-experience\.js\?v=1/); assert.match(loader, /dependencies: \['voice', 'conversation', 'languageMastery', 'practical'\]/);
  assert.match(worker, /klearn-v87/); assert.match(worker, /content\/real-korean-experience\.json/); assert.match(css, /@media\(max-width:700px\)/); assert.match(css, /@media\(max-width:380px\)/);
  for (const table of ['real_korean_pronunciation_attempts', 'sentence_mining_items', 'real_korean_media_progress', 'real_korean_scenario_attempts', 'real_korean_shadowing_attempts']) {
    assert.match(migration, new RegExp(`create table if not exists public\\.${table}`)); assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  }
  assert.ok((migration.match(/user_id = auth\.uid\(\)/g) || []).length >= 10); assert.match(migration, /Audio blobs and raw source documents are intentionally not stored/);
  for (const heading of ['# P71B REAL KOREAN EXPERIENCE REPORT', '## Pronunciation Lab', '## Sentence Mining', '## Media Learning', '## Conversation', '## Shadowing', '## Testing', '## Git']) assert.match(report, new RegExp(heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  console.log('P71B pronunciation, fallback, mining, media, conversation, shadowing, privacy and user isolation passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
