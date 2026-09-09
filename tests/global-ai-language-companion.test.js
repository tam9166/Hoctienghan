const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'global-ai-language-companion.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'global-ai-language-companion.json'), 'utf8'));
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_global_ai_language_companion.sql'), 'utf8');

function boot() {
  const values = new Map();
  const state = { currentUser: { id: 'companion-user' }, currentView: 'home', srsData: [] };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const window = {
    KLEARN_APP: {
      storage, state, STORAGE_KEYS: { aiMemory: 'ai-memory', aiInfrastructure: 'ai-infrastructure' }, userScoped, saveUserScoped,
      CloudSyncService: { schedule: () => {} }, LearnerProfileService: { get: () => ({ currentTopikLevel: 1, targetTopikLevel: 2, goal: 'TOPIK 2', weakSkills: ['listening'], frequentErrors: ['은/는'], learningStyle: 'audio', explanationStyle: 'examples', dueSrsCount: 6 }) },
      getUserProgress: () => ({ stats: { streak: 4 }, dueSrsCount: 6 }), render: () => {}, toast: () => {}, escapeHtml: (value) => String(value ?? '')
    },
    AIOrchestrationService: { request: async ({ task, input, language }) => ({ reply: `${task}:${language}:${input.slice(0, 20)}`, fallback: false, quality: { status: 'pass', score: .9, reasons: [] } }) },
    document: null, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context);
  return { window, values };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.deepEqual(content.supportedLanguages, ['ko', 'ja', 'zh']);
assert.equal(content.privacy.noRawChat, true);
assert.equal(content.quality.requiresApprovedSourceForPractice, true);

(async () => {
  const app = boot();
  const w = app.window;
  w.AICompanionContentService.hydrate(content);
  assert.deepEqual(w.AICompanionService.supportedLanguages(), ['ko', 'ja', 'zh']);
  const memory = w.AILearningMemoryService.remember({ goal: 'TOPIK 3', targetLanguage: 'ja', weakSkills: ['grammar'] });
  assert.equal(memory.goal, 'TOPIK 3');
  assert.equal(memory.targetLanguage, 'ja');
  assert.equal(w.AILearningMemoryService.snapshot().rawChat, undefined);
  const advisor = w.AIStudyAdvisorService.recommend();
  assert.equal(advisor.evidence.dueSrsCount, 6);
  assert.match(advisor.nextAction, /Ôn/);
  const explanation = await w.AIContentExplanationService.explain({ type: 'grammar', id: 'g1', text: '은/는', language: 'ko', content: { id: 'g1', verified: true, reviewStatus: 'approved', explanation: 'topic marker' } });
  assert.equal(explanation.quality.status, 'pass');
  const blocked = await w.AIPracticeCreatorService.create({ content: { id: 'draft', status: 'draft' } });
  assert.equal(blocked.status, 'blocked');
  const practice = await w.AIPracticeCreatorService.create({ content: { id: 'approved-1', verified: true, reviewStatus: 'approved', title: 'TOPIK 1' }, count: 3, language: 'ja' });
  assert.equal(practice.status, 'needs-review');
  const session = w.AIConversationPartnerService.start({ scenarioId: 'restaurant', language: 'ko' });
  const turn = await w.AIConversationPartnerService.respond(session.id, '김치찌개 하나 주세요.');
  assert.equal(turn.sessionId, session.id);
  assert.match((await w.AIWritingReviewService.review({ text: '저는 학생이에요.', type: 'message' })).reply, /writing_review/);
  assert.match((await w.AICareerCoachService.coach({ scenario: 'interview' })).reply, /career_coach/);
  assert.match((await w.AICultureAdvisorService.explain({ expression: '감사합니다', context: 'work' })).reply, /culture_advisor/);
  assert.equal(w.AICompanionQualityService.evaluate('clear answer', { task: 'culture_advisor', language: 'ko' }).status, 'pass');
  assert.match(index, /global-ai-companion\.css\?v=1/);
  assert.match(index, /data\/global-ai-language-companion\.js\?v=1/);
  assert.match(worker, /klearn-v77/);
  assert.match(worker, /global-ai-language-companion\.json/);
  assert.match(migration, /ai_companion_memory/);
  assert.match(migration, /ai_companion_quality_logs/);
  assert.match(migration, /row level security/i);
  assert.match(migration, /auth\.uid\(\)/);
  assert.match(migration, /raw prompts/i);
  console.log('global AI companion: structured memory, advisor, explanation, approved-content practice gate, conversation, writing, career, culture, multilingual routing, quality and privacy passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
