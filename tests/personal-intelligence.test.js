const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const state = { currentUser: null, sentenceWriting: null };
const window = {
  KLEARN_APP: {
    storage: { get: () => ({}), set: () => {} }, state, STORAGE_KEYS: {}, render: () => {}, setView: () => {}, toast: () => {},
    escapeHtml: (value = '') => String(value), getUserProgress: () => ({ skills: {}, writingSubmissions: [] }), saveUserProgress: () => {}, updateCurrentUser: () => {},
    LearnerProfileService: { get: () => ({ skillScores: {} }) }, CloudSyncService: { schedule: () => {} }
  },
  KLEARN_EXTRA_VIEWS: {}
};
const context = { window, console, Date, String, Number, Object, Array, Math, Set, FormData: class {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'data', 'personal-intelligence.js'), 'utf8'), context);

const service = window.PersonalRecommendationService;
assert.ok(service, 'PersonalRecommendationService must be exposed');

const userA = service.forProfile({ learningStyle: 'audio', learningMode: 'casual', skillScores: { listening: 25, grammar: 82, vocabulary: 70, reading: 72, writing: 65, speaking: 60 } });
const userB = service.forProfile({ learningStyle: 'grammar', learningMode: 'topik', skillScores: { listening: 85, grammar: 20, vocabulary: 70, reading: 72, writing: 65, speaking: 60 } });
assert.equal(userA[0].skill, 'listening', 'weak-listening user should receive listening first');
assert.equal(userB[0].skill, 'grammar', 'weak-grammar user should receive grammar first');
assert.notEqual(userA[0].skill, userB[0].skill, 'different weaknesses must produce different recommendations');

console.log('personal intelligence: User A -> listening, User B -> grammar');
