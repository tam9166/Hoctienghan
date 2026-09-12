const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'ai-agent-architecture.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'ai-agent-architecture.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p43_ai_agent_architecture.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');

function boot() {
  const values = new Map(); const syncEvents = []; const calls = []; let memoryWrites = 0;
  const state = { currentUser: { id: 'agent-user' }, currentView: 'ai-coach', srsData: [{ wordId: '학교', korean: '학교', mastery: 60 }] };
  const userScoped = (key) => { const all = values.get(key) || {}; return Array.isArray(all[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, value) => { const all = values.get(key) || {}; all[state.currentUser.id] = value; values.set(key, all); };
  const quality = (text) => ({ status: text ? 'pass' : 'review', score: text ? .92 : .4, reasons: text ? [] : ['empty'] });
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { aiAgents: 'ai-agents' }, userScoped, saveUserScoped, CloudSyncService: { schedule: (name) => syncEvents.push(name) },
      LearnerProfileService: { get: () => ({ currentTopikLevel: 1, targetTopikLevel: 2, weakSkills: ['listening'], dueSrsCount: 4, skillScores: { listening: 45 } }) },
      PracticeService: { getHistory: () => [{ percentage: 72 }, { percentage: 80 }] }, getUserProgress: () => ({ stats: { streak: 3 }, daily: { completed: false } }),
      setView: (view) => { state.currentView = view; }, escapeHtml: String
    },
    AIContextService: { build: (value) => value }, AIResponseQualityService: { check: (text) => quality(text) },
    AIStudyAdvisorService: { recommend: () => ({ items: [{ title: 'Ôn 4 từ', minutes: 5 }], nextAction: 'Ôn 4 từ', evidence: { dueSrsCount: 4 } }), ask: async () => ({ reply: 'Kế hoạch cá nhân hóa' }) },
    AIContentExplanationService: { explain: async ({ type, id }) => { calls.push(type); return { reply: `${type}:${id}`, usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 } }; } },
    AIWritingReviewService: { review: async ({ text }) => ({ reply: text === 'unsafe claim' ? 'guaranteed TOPIK score' : `writing:${text}` }) },
    AICareerCoachService: { coach: async ({ scenario }) => ({ reply: `career:${scenario}` }) },
    AILearningMemoryService: { snapshot: () => ({ goal: 'TOPIK 2' }), remember: (value) => { memoryWrites += 1; return value; } },
    SpacedRepetitionOptimizer: { rank: () => [{ wordId: '학교', priority: 88, forgettingProbability: .7 }] },
    AIOrchestrationService: { request: async ({ task }) => ({ reply: `${task}:response` }) },
    document: null, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context);
  window.AIAgentRegistryService.hydrate(content);
  return { window, values, syncEvents, calls, getMemoryWrites: () => memoryWrites };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.equal(content.agents.length, 8);
assert.equal(content.routing.maximumPrimaryAgents, 1);
assert.equal(content.routing.maximumRetries, 0);
assert.equal(content.routing.qualityControllerAlwaysRuns, true);
assert.equal(content.privacy.storesRawInput, false);
assert.equal(content.privacy.storesRawResponse, false);
assert.equal(content.privacy.storesRawAudio, false);

(async () => {
  const app = boot(); const w = app.window; const orchestrator = w.LearningAgentOrchestratorService;
  ['AILearningPlannerAgent', 'AIGrammarAgent', 'AIVocabularyAgent', 'AISpeakingAgent', 'AIWritingAgent', 'AIExamAgent', 'AICareerAgent', 'AIMemoryAgent', 'AIAgentQualityController', 'LearningAgentOrchestratorService'].forEach((name) => assert.ok(w[name], `${name} missing`));
  const policy = orchestrator.policy(); assert.equal(policy.maximumPrimaryAgents, 1); assert.equal(policy.maximumRetries, 0); assert.equal(policy.qualityControllerAlwaysRuns, true);
  assert.equal(orchestrator.route('today'), 'planner');
  assert.equal(orchestrator.route('explain', { contentType: 'grammar' }), 'grammar');
  assert.equal(orchestrator.route('explain', {}), null);

  const ambiguous = await orchestrator.dispatch({ intent: 'unknown' });
  assert.equal(ambiguous.status, 'clarification-required'); assert.equal(ambiguous.primaryAgentsUsed, 0); assert.equal(ambiguous.qualityControllerRan, false);

  const plan = await orchestrator.dispatch({ intent: 'today', payload: { enhance: false } });
  assert.equal(plan.agentId, 'planner'); assert.equal(plan.primaryAgentsUsed, 1); assert.equal(plan.qualityControllerRan, true); assert.equal(plan.retries, 0);

  const noSource = await orchestrator.dispatch({ intent: 'grammar', payload: { text: '은/는' } });
  assert.equal(noSource.status, 'blocked'); assert.match(noSource.result.reply, /chất lượng|nguồn/i);
  const grammar = await orchestrator.dispatch({ intent: 'grammar', payload: { text: '은/는', source: { id: 'g1', verified: true, reviewStatus: 'approved', pattern: '은/는' } } });
  assert.equal(grammar.status, 'pass'); assert.equal(grammar.result.source.id, 'g1'); assert.ok(app.calls.includes('grammar'));
  const vocabulary = await orchestrator.dispatch({ intent: 'define', payload: { text: '학교', source: { id: 'v1', verified: true, status: 'published', korean: '학교' } } });
  assert.equal(vocabulary.status, 'pass'); assert.ok(app.calls.includes('vocabulary'));

  const writing = await orchestrator.dispatch({ intent: 'writing', payload: { text: '저는 학생이에요.' } });
  assert.match(writing.result.reply, /writing:/); assert.equal(writing.primaryAgentsUsed, 1);
  const unsupported = await orchestrator.dispatch({ intent: 'writing', payload: { text: 'unsafe claim' } });
  assert.equal(unsupported.status, 'blocked'); assert.equal(unsupported.result.fallback, true);

  const memoryPending = await orchestrator.dispatch({ intent: 'remember', payload: { action: 'remember', changes: { goal: 'TOPIK 3' } } });
  assert.equal(memoryPending.status, 'confirmation-required'); assert.equal(app.getMemoryWrites(), 0);
  const memorySaved = await orchestrator.dispatch({ intent: 'remember', payload: { action: 'remember', confirmed: true, changes: { goal: 'TOPIK 3', unrelatedExtra: 'must-not-save' } } });
  assert.equal(memorySaved.status, 'pass'); assert.equal(app.getMemoryWrites(), 1); assert.equal(memorySaved.result.memory.unrelatedExtra, undefined);

  const sensitive = await orchestrator.dispatch({ intent: 'writing', payload: { text: 'password=secret-value' } });
  assert.equal(sensitive.status, 'blocked'); assert.ok(sensitive.quality.reasons.includes('unsafe-input'));
  const audit = w.AIAgentAuditService.all(); assert.ok(audit.length >= 7); assert.equal(audit[0].rawInputStored, false); assert.equal(audit[0].rawResponseStored, false); assert.equal(audit[0].rawAudioStored, false); assert.equal(audit.some((item) => 'reply' in item || 'text' in item || 'prompt' in item), false); assert.ok(app.syncEvents.includes('ai-agent-audit'));

  assert.match(migration, /ai_agent_preferences/); assert.match(migration, /ai_agent_audit_logs/); assert.match(migration, /row level security/i); assert.match(migration, /auth\.uid\(\)/); assert.doesNotMatch(migration, /raw_prompt\s+text|raw_response\s+text|raw_audio\s+/i);
  assert.match(index, /ai-agent-architecture\.css\?v=1/); assert.match(index, /data\/ai-agent-architecture\.js\?v=1/); assert.match(index, /app\.js\?v=69/);
  assert.match(worker, /klearn-v83/); assert.match(worker, /content\/ai-agent-architecture\.json/); assert.match(appSource, /aiAgents: 'klearn_ai_agents'/); assert.match(appSource, /STORAGE_KEYS\.aiAgents/);
  console.log('AI agent architecture: eight bounded specialists, deterministic routing, one primary agent, mandatory quality control, approved-source gates, confirmed memory, metadata-only audit and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
