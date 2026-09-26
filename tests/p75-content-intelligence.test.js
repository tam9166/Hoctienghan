const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/content-intelligence-platform.json'));

function runtime(options = {}) {
  const records = new Map();
  let role = options.role || 'student';
  const progress = options.progress || { lessonProgress: { legacyLesson: { completed: true, score: 88 } }, skills: { listening: 30, grammar: 65 } };
  const srs = options.srs || [];
  const theory = [{ id: 'legacyLesson', title: 'Legacy lesson', topic: 'basic', level: 1, skill: 'grammar', difficulty: 'TOPIK_1', version: 1 }];
  const vocabulary = [{ id: 'legacyWord', korean: '학교', meaning: 'trường học', level: 1, topic: 'school', version: 1 }];
  const advanced = [
    { id: 'legacyGrammar', type: 'grammar', title: '은/는', level: 'Beginner', skill: 'grammar', status: 'approved', version: 2, quality: { grammarAccuracy: 96, exampleQuality: 90 } }
  ];
  const offline = [
    { id: 'beginner-pack', estimatedSize: '~24 KB', lessonIds: ['legacyLesson'], vocabularyIds: ['legacyWord'], grammarIds: [], audioAssets: ['a'], assets: ['./content/beginner.json'], version: 2 },
    { id: 'topik-1-pack', estimatedSize: '~28 KB', lessonIds: ['legacyLesson'], vocabularyIds: [], grammarIds: ['legacyGrammar'], audioAssets: ['b'], assets: ['./content/topik1.json'], version: 2 },
    { id: 'business-korean-pack', estimatedSize: '~34 KB', lessonIds: [], vocabularyIds: [], grammarIds: [], exerciseIds: ['e'], audioAssets: [], assets: ['./content/career-learning-ecosystem.json'], version: 1 },
    { id: 'travel-korean-pack', estimatedSize: '~38 KB', lessonIds: [], vocabularyIds: [], grammarIds: [], exerciseIds: ['e'], audioAssets: [], assets: ['./content/real-world-assistant.json'], version: 1 }
  ];
  const window = {
    KLEARN_APP: {
      state: { currentUser: { id: 'p75-user', currentTopikLevel: 1 }, currentView: 'content-intelligence', srsData: srs },
      storage: { get: (key, fallback) => records.has(key) ? structuredClone(records.get(key)) : fallback, set: (key, value) => { records.set(key, structuredClone(value)); return true; } },
      STORAGE_KEYS: { contentIntelligence: 'p75-workspace' },
      getUserProgress: () => progress,
      getUserSrs: () => srs,
      PracticeService: { getHistory: () => options.practice || [] },
      LearnerProfileService: { get: () => options.profile || { weakSkills: ['listening'], skillScores: { listening: 30, grammar: 65 } } },
      AccessControlService: { role: () => role },
      render() {}, setView() {}, toast() {}, escapeHtml: String
    },
    KLEARN_THEORY_LESSONS: theory,
    KLEARN_VOCABULARY: vocabulary,
    AdvancedContentService: { raw: () => advanced, load: async () => advanced },
    ContentRepository: { list: async () => ({ items: [] }) },
    OfflinePackService: { catalog: () => offline, status: () => 'available', download: async (id) => ({ id, downloaded: true }) },
    UserResearchService: { all: () => ({ events: options.events || [] }) },
    SupabaseService: { session: { user: { app_metadata: { content_scopes: ['*'] } } } },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    document: null,
    fetch: async () => ({ ok: true, json: async () => config }),
    setTimeout
  };
  window.window = window;
  const context = { window, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, fetch: window.fetch };
  vm.runInNewContext(read('data/content-intelligence-platform.js'), context);
  window.ContentIntelligenceConfigService.hydrate(config);
  return { window, progress, records, setRole: (value) => { role = value; } };
}

assert.equal(config.entitySchema.types.length, 9);
assert.deepEqual(config.workflow.statuses, ['draft', 'ai_review', 'human_review', 'approved', 'published', 'archived']);
assert.equal(Object.keys(config.qualityModel.weights).length, 6);
assert.equal(config.packs.length, 4);

const student = runtime();
const services = ['ContentEntityRegistryService', 'ContentPermissionService', 'ContentWorkspaceService', 'ContentDifficultyEngine', 'ContentQualityIntelligenceService', 'AIContentIntelligenceAssistant', 'ContentPerformanceService', 'ContentLearningEffectivenessService', 'ContentRecommendationIntelligenceService', 'ContentGapAnalysisService', 'ContentPackIntelligenceService', 'ContentAdminDashboardService'];
services.forEach((name) => assert.ok(student.window[name], `${name} missing`));

const audit = student.window.ContentEntityRegistryService.migrationAudit();
assert.equal(audit.mutatesLearningData, false);
assert.equal(audit.preservesIds, true);
assert.equal(audit.invalid.length, 0);
assert.equal(Object.values(audit.types).filter(Boolean).length, 9);
assert.deepEqual(student.progress.lessonProgress, { legacyLesson: { completed: true, score: 88 } });
assert.throws(() => student.window.ContentWorkspaceService.create({ id: 'forbidden', type: 'lesson', title: 'No' }), /không có quyền/);

// Version snapshots are immutable, IDs remain stable, and learning progress is outside the workspace.
const editor = runtime({ role: 'content_editor' });
const created = editor.window.ContentWorkspaceService.create({ id: 'editor-lesson', type: 'lesson', title: 'Bài của editor', level: 'TOPIK 1', topic: 'intro', skill: 'speaking', difficulty: 'Elementary', author: 'Editor' });
assert.equal(created.version, 1);
const revised = editor.window.ContentWorkspaceService.revise('editor-lesson', { title: 'Bài đã sửa', id: 'cannot-change-id' }, 'Improve example');
assert.equal(revised.id, 'editor-lesson');
assert.equal(revised.version, 2);
const history = editor.window.ContentWorkspaceService.history('editor-lesson');
assert.equal(history.length, 2);
assert.equal(history[1].snapshot.title, 'Bài của editor');
assert.equal(history[0].snapshot.title, 'Bài đã sửa');
assert.deepEqual(editor.progress.lessonProgress, { legacyLesson: { completed: true, score: 88 } });

editor.window.ContentWorkspaceService.transition('editor-lesson', 'ai_review', 'Automated checks only');
editor.window.ContentWorkspaceService.transition('editor-lesson', 'human_review', 'Ready for a person');
editor.window.ContentWorkspaceService.transition('editor-lesson', 'approved', 'Reviewed by editor');
assert.throws(() => editor.window.ContentWorkspaceService.transition('editor-lesson', 'published'), /không có quyền/);
assert.throws(() => editor.window.AIContentIntelligenceAssistant.publish(), /không được phép publish/);

// Only an admin can publish an approved version.
editor.setRole('admin');
const published = editor.window.ContentWorkspaceService.transition('editor-lesson', 'published', 'Admin publish');
assert.equal(published.review_status, 'published');
assert.equal(published.human_approved, true);

// Difficulty and quality are evidence-aware. Missing effectiveness remains null.
const legacyGrammar = student.window.ContentEntityRegistryService.byId('legacyGrammar');
const quality = student.window.ContentQualityIntelligenceService.score(legacyGrammar);
assert.equal(quality.dimensions.learningEffectiveness, null);
assert.ok(quality.score >= 0 && quality.score <= 100);
assert.match(quality.rule, /never replaced/);
assert.equal(student.window.ContentDifficultyEngine.assess(legacyGrammar).advisoryOnly, true);

// Analytics comes from actual attempts, events, and SRS evidence.
const measured = runtime({
  practice: [{ contentId: 'legacyLesson', status: 'completed', completedAt: '2026-09-16T00:00:00Z', percentage: 80, wrongQuestionIds: ['q1'] }],
  events: [{ event: 'content_viewed', properties: { contentId: 'legacyLesson' } }],
  srs: [{ id: 'legacyWord', reviewCount: 3, mastery: 80, correctCount: 4, wrongCount: 1, lastReviewed: '2026-08-01T00:00:00Z' }]
});
const performance = measured.window.ContentPerformanceService.evidence(measured.window.ContentEntityRegistryService.byId('legacyLesson'));
assert.equal(performance.status, 'measured');
assert.ok(performance.views >= 1);
assert.ok(performance.averageScore >= 80);
assert.equal(performance.commonErrors[0].id, 'q1');
const retention = measured.window.ContentLearningEffectivenessService.measure(measured.window.ContentEntityRegistryService.byId('legacyWord'));
assert.equal(retention.status, 'measured');
assert.equal(retention.retention30, 100);

const recommendations = measured.window.ContentRecommendationIntelligenceService.recommend(3);
assert.ok(recommendations.length > 0);
assert.match(recommendations[0].reason, /Chưa đủ cohort/);
assert.ok(measured.window.ContentGapAnalysisService.missing().length > 0);
const packs = measured.window.ContentPackIntelligenceService.catalog();
assert.equal(packs.length, 4);
assert.ok(packs.every((item) => item.downloadReady));
assert.ok(packs.find((item) => item.id === 'business-korean-pack').exerciseIds.length > 0);

const app = read('app.js');
const loader = read('data/route-loader.js');
const index = read('index.html');
const worker = read('sw.js');
const practical = read('data/practical-study.js');
assert.match(app, /contentIntelligence: 'klearn_content_intelligence'/);
assert.match(loader, /contentIntelligence/);
assert.match(index, /route-loader\.js\?v=32/);
assert.match(index, /app\.js\?v=89/);
assert.match(worker, /klearn-v105/);
assert.match(worker, /content-intelligence-platform\.json/);
assert.match(practical, /business-korean-pack/);
assert.match(practical, /travel-korean-pack/);
assert.doesNotMatch(read('data/content-intelligence-platform.js'), /passwordHash|access_token|refresh_token/);

console.log('P75 unit: entity migration, immutable versions, CMS workflow, permissions, evidence quality, analytics, recommendation, gaps and offline packs passed');
