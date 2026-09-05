const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const scoped = new Map();
let progress = { daily: { tasks: { speaking: false } }, skills: { speaking: 0 } };
let capturedErrors = 0;
const scenarioSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'conversation-scenarios.js'), 'utf8');
const simulatorSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'conversation-simulator.js'), 'utf8');

function boot() {
  const state = { currentUser: { id: 'qa', currentTopikLevel: 1 }, conversationSimulator: null };
  const window = {
    KLEARN_APP: {
      state,
      STORAGE_KEYS: { conversationHistory: 'conversation-history' },
      render: () => {}, setView: () => {}, toast: () => {}, escapeHtml: String,
      getUserProgress: () => progress,
      saveUserProgress: (value) => { progress = value; },
      userScoped: (key) => scoped.get(key) || [],
      saveUserScoped: (key, value) => scoped.set(key, value),
      LearnerProfileService: { get: () => ({ weakGrammar: [] }) }
    },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    ErrorNotebookService: { top: () => [], add: () => { capturedErrors += 1; } },
    KnowledgeGraphService: { record: () => {} }, LearningMemoryService: { upsert: () => {} }
  };
  const context = { window, document: { documentElement: { lang: 'vi' } }, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(scenarioSource, context);
  vm.runInContext(simulatorSource, context);
  return window;
}

const first = boot();
assert.equal(first.KLEARN_CONVERSATION_SCENARIOS.length, 13, 'all requested scenario groups are represented');
assert.deepEqual([...new Set(first.KLEARN_CONVERSATION_SCENARIOS.map((item) => item.level))], ['Beginner', 'Intermediate', 'Advanced']);
first.KLEARN_CONVERSATION_SCENARIOS.forEach((scenario) => {
  for (const field of ['id', 'level', 'topic', 'situation', 'dialogue', 'expectedSkills', 'grammarIds', 'vocabularyIds']) assert.ok(scenario[field], `${scenario.id} must include ${field}`);
  assert.ok(scenario.dialogue.length >= 2, `${scenario.id} must support continuous conversation`);
});

first.ConversationSimulatorController.startScenario('beginner-greeting');
const flowFeedback = first.ConversationSimulatorController.submitResponse('안녕하세요? 저도 반갑습니다.');
assert.ok(flowFeedback.overall >= 80, 'beginner response produces multi-criteria feedback');
assert.equal(first.KLEARN_APP.state.conversationSimulator.session.messages.length, 2, 'learner response continues the scenario flow');
assert.equal(first.ConversationHistoryService.get('beginner-greeting').practiceCount, 1, 'scenario flow stores progress immediately');

const intro = first.KLEARN_CONVERSATION_SCENARIOS.find((item) => item.id === 'beginner-self-introduction');
const jobTurn = intro.dialogue[2];
const formal = first.ConversationEvaluationEngine.evaluate(jobTurn, '저는 학생입니다.');
assert.equal(formal.grammar, 100, 'formal copula is grammatically accepted');
assert.ok(formal.natural < 100, 'formal answer receives a conversational naturalness suggestion');
assert.equal(formal.suggestion, '저는 학생이에요.');

const weak = first.ConversationEvaluationEngine.evaluate(jobTurn, '학생');
assert.ok(weak.meaning < 100);
assert.ok(weak.grammar < 100);
first.ConversationHistoryService.record(intro, jobTurn, weak, { firstTurn: true, completed: true });
assert.equal(first.ConversationHistoryService.get(intro.id).practiceCount, 1);
assert.equal(first.ConversationHistoryService.get(intro.id).completedRuns, 1);
assert.equal(progress.daily.tasks.speaking, true, 'conversation integrates with learner progress');
assert.equal(capturedErrors, 1, 'weak grammar is connected to Error Notebook');
assert.equal(/audio|blob|data:/i.test(JSON.stringify(scoped.get('conversation-history'))), false, 'history never stores audio payloads');

const reloaded = boot();
assert.equal(reloaded.ConversationHistoryService.get(intro.id).practiceCount, 1, 'history survives a fresh application boot');
assert.equal(reloaded.ConversationHistoryService.get(intro.id).exchanges[0].answer, '학생');
console.log('conversation simulator: scenarios, nuanced feedback, integrations and reload persistence passed');
