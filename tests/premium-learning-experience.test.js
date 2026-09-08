const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'premium-learning-experience.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'premium-learning-experience.json'), 'utf8'));
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const indexSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const workerSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_premium_learning_experience.sql'), 'utf8');

function boot(tier = 'premium') {
  const values = new Map();
  const state = { currentUser: { id: 'premium-user' }, currentView: 'premium-features', srsData: [{ korean: '학교', meaning: { vi: 'trường học' }, mastery: 80, topic: 'school' }] };
  const progress = { pronunciationAttempts: [{ score: 82 }, { score: 74 }], skills: { vocabulary: 88 }, stats: { wordsLearned: 1 } };
  const storage = { get(key, fallback = null) { return values.has(key) ? values.get(key) : fallback; }, set(key, value) { values.set(key, value); return true; } };
  const userScoped = (key) => { const all = values.get(key); return Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; };
  const saveUserScoped = (key, list) => { const all = values.get(key) || {}; all[state.currentUser.id] = list; values.set(key, all); };
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { premiumLearning: 'premium_learning' }, storage, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String, userScoped, saveUserScoped,
      PracticeService: { startRandom: (options) => { state.mockOptions = options; } }, getUserProgress: () => progress,
      LearnerProfileService: { get: () => ({ weakSkills: ['listening'], frequentErrors: ['은/는'], skillScores: { vocabulary: 88 } }) },
      NotesService: { all: () => [{ sourceType: 'lesson', sourceId: 'l1', content: 'Review particles' }] },
      VocabularyService: { all: () => state.srsData }, SupportService: { submit: async (request) => ({ ...request, status: 'sent' }) }
    },
    SubscriptionService: { activeTier: () => tier, status: () => ({ tier, status: tier === 'premium' ? 'active' : 'none' }), can: () => tier === 'premium' },
    AdvancedReportService: { report: () => ({ summary: { weakestSkill: 'listening', nextAction: 'Luyện nghe' } }) },
    PersonalInsightService: { report: () => ({ nextAction: 'Ôn nghe 15 phút.' }) },
    CertificationService: { definitions: () => [{ id: 'business', title: 'Business Korean' }], issue: (id) => ({ certificateId: id, status: 'local-preview' }) },
    document: null, console
  };
  const context = { window, console, Date, String, Number, Object, Array, Math, Set, Map, RegExp, Promise, JSON };
  vm.createContext(context); vm.runInContext(source, context);
  return { window, state, values };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.equal(content.privacy.basicFeaturesRemainAvailable, true);
assert.deepEqual(content.plans.map((item) => item.id), ['topik-6-months', 'conversation-3-months']);
assert.deepEqual(content.contentPacks.map((item) => item.id), ['business-korean', 'academic-korean', 'travel-korean']);
assert.equal(content.family.status, 'architecture-only');

const app = boot('premium');
app.window.PremiumLearningContentService.hydrate(content);
const premium = app.window.PremiumLearningService;
assert.equal(premium.entitlement.isPremium(), true);
assert.equal(premium.plans.activate('topik-6-months').goal, 'topik');
assert.equal(premium.mockExams.start('topik-1-real-mode').mode, 'premium-real-environment');
assert.equal(app.state.mockOptions.count, 50);
assert.equal(premium.contentPacks.open('business-korean').id, 'business-korean');
assert.equal(premium.privateReport.generate().recommendation, 'Ôn nghe 15 phút.');
assert.equal(premium.speakingReview.summary().fluency, 78);
assert.equal(premium.curriculum.generate().modules.length, 4);
assert.equal(premium.exports.download('notes').status, 'downloaded');
assert.equal(premium.exports.download('print-pdf').status, 'print-dialog');
assert.equal(premium.certificates.issue('business').status, 'local-preview');
premium.support.request({ message: 'Please review my speaking.' }).then((result) => assert.equal(result.status, 'sent'));
assert.equal(premium.family.status().status, 'architecture-only');

const free = boot('free');
free.window.PremiumLearningContentService.hydrate(content);
assert.equal(free.window.PremiumEntitlementService.isPremium(), false);
assert.equal(free.window.PremiumStudyPlanService.activate('topik-6-months'), null);
assert.equal(free.window.AdvancedMockExamService.start('topik-1-real-mode'), null);
assert.equal(free.window.MaterialExportService.download('notes').status, 'downloaded', 'basic note export remains available');
assert.match(appSource, /premiumLearning: 'klearn_premium_learning'/);
assert.match(appSource, /STORAGE_KEYS\.premiumLearning/);
assert.match(appSource, /startTopikExam/);
assert.match(indexSource, /premium-learning\.css\?v=1/);
assert.match(indexSource, /data\/premium-learning-experience\.js\?v=1/);
assert.match(workerSource, /klearn-v71/);
assert.match(workerSource, /premium-learning-experience\.json/);
assert.match(migration, /premium_family_accounts/);
assert.match(migration, /premium_family_members/);
assert.match(migration, /commercial_has_entitlement\('family_account'\)/);
assert.match(migration, /row level security/i);
console.log('premium learning: entitlement gate, study plans, mock exams, packs, private report, speaking review, curriculum, export, certificate, support, family foundation and RLS passed');
