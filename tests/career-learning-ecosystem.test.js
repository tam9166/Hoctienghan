const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'data', 'career-learning-ecosystem.js'), 'utf8');
const content = JSON.parse(fs.readFileSync(path.join(root, 'content', 'career-learning-ecosystem.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p42_korean_career_ecosystem.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8') + fs.readFileSync(path.join(root, 'data', 'route-loader.js'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'career-learning.css'), 'utf8');

function boot(userId = 'learner-a', shared = new Map()) {
  const state = { currentUser: { id: userId, fullName: userId }, currentView: 'home', srsData: [{ wordId: 'existing', korean: '기존', mastery: 70, status: 'review' }] };
  const calls = []; const scoped = (key) => shared.get(key)?.[userId] || []; const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const legacyPaths = [{ id: 'it' }, { id: 'business' }, { id: 'tourism' }];
  const window = {
    document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    CareerPurposeService: { paths: () => legacyPaths, select: (id) => calls.push(['legacy-career', id]) },
    CultureWarningService: { evaluate: () => ({ safe: true }) }, RealTimeVoiceConversationService: {},
    KLEARN_APP: {
      state, STORAGE_KEYS: { careerLearning: 'career-store' }, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String,
      userScoped: scoped, saveUserScoped: saveScoped,
      saveUserSrs(cards) { state.srsData = cards; calls.push(['srs', cards.length]); },
      CloudSyncService: { schedule(reason) { calls.push(['sync', reason]); } }, speakKorean() {}
    }
  };
  const context = { window, document, console, Date, Intl, String, Number, Boolean, Object, Array, Math, Set, Map, Promise, JSON, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.CareerContentService.hydrate(content);
  return { window, state, shared, calls };
}

(async () => {
  assert.equal(content.verified, true); assert.equal(content.reviewStatus, 'approved'); assert.equal(content.privacy.analyticsStoresDraftText, false); assert.equal(content.privacy.storesContactDetails, false);
  assert.deepEqual(content.paths.map((item) => item.id), ['it', 'business', 'tourism', 'translation', 'manufacturing', 'study-abroad']); assert.equal(content.paths.every((item) => item.vocabulary.length >= 6), true);
  const shared = new Map(); const fixture = boot('learner-a', shared); const app = fixture.window;

  assert.equal(app.CareerPathService.currentId(), 'business'); assert.equal(app.CareerPathService.select('it').id, 'it'); assert.equal(app.CareerPathService.currentId(), 'it'); assert.ok(fixture.calls.some((item) => item[0] === 'legacy-career'), 'existing career path service should be reused when compatible');
  assert.equal(app.CareerPathService.select('manufacturing').id, 'manufacturing'); assert.equal(fixture.calls.some((item) => item[0] === 'legacy-career' && item[1] === 'manufacturing'), false, 'unsupported legacy path must not be rewritten');

  const previousCards = fixture.state.srsData.length; const added = app.ProfessionalVocabularyService.addPack('manufacturing'); assert.equal(added, 6); assert.equal(fixture.state.srsData.length, previousCards + 6); assert.ok(fixture.state.srsData.some((item) => item.korean === '안전' && item.source === 'career-learning')); assert.equal(app.ProfessionalVocabularyService.addPack('manufacturing'), 0, 'SRS pack import must be idempotent');
  fixture.state.srsData.find((item) => item.korean === '안전').mastery = 90; assert.equal(app.ProfessionalVocabularyService.progress('manufacturing').mastered, 1);

  app.WorkplaceScenarioService.open('meeting-update'); const scenario = app.WorkplaceScenarioService.submit('현재 진행 상황을 보고드립니다. 문제가 있지만 다음 계획을 준비했습니다.'); assert.ok(scenario.score >= 70); assert.equal(scenario.formal, true); assert.equal(scenario.culture.safe, true);
  app.JobInterviewService.select('self-introduction'); const interview = app.JobInterviewService.submit('안녕하세요. 저는 개발자입니다. 프로젝트 경험이 있고 협업이 강점입니다.'); assert.ok(interview.score >= 70); assert.match(interview.model, /웹 개발/); assert.equal(app.JobInterviewService.voiceRoute(), 'advanced-voice');

  const resume = app.KoreanResumeService.save({ headline: '웹 개발자', summary: '3년 경력의 개발자입니다.', experience: '프로젝트를 완료했습니다.', skills: 'JavaScript · 한국어' }); assert.equal(resume.userScoped, true); assert.equal(app.KoreanResumeService.completeness().percentage, 100);
  const email = app.BusinessEmailService.evaluate({ subject: '자료 요청드립니다', body: '안녕하세요, 팀장님. 자료를 보내 주실 수 있을까요? 확인 부탁드립니다. 감사합니다.', save: true }); assert.equal(email.score, 100); assert.equal(email.polite, true);
  const presentation = app.PresentationCoachService.evaluate({ opening: '안녕하세요. 결과를 발표하겠습니다.', structure: '먼저 배경을 설명하고 다음으로 결과를 말씀드리겠습니다.', closing: '이상으로 발표를 마치겠습니다. 질문 있으시면 말씀해 주세요.' }, true); assert.equal(presentation.score, 100); assert.equal(app.WorkplaceCultureService.notes().length, 3);

  const stored = shared.get('career-store')['learner-a'][0]; assert.equal(stored.completions.every((item) => item.rawDraftStoredInAnalytics === false), true); assert.doesNotMatch(JSON.stringify(stored.completions), /프로젝트를 완료|자료를 보내|발표하겠습니다/, 'analytics summaries must exclude draft text');
  const report = app.JobPreparationReportService.generate(); assert.ok(report.readiness > 0 && report.readiness <= 100); assert.ok(report.nextAction.route); assert.match(report.disclaimer, /không đảm bảo tuyển dụng/i);
  const other = boot('learner-b', shared); assert.equal(other.window.KoreanResumeService.completeness().percentage, 0, 'resume must be user-scoped'); assert.equal(other.window.CareerProgressService.summary().evidenceCount, 0, 'career evidence must be user-scoped');

  for (const route of ['career-center','career-vocabulary','workplace-scenarios','workplace-scenario','job-interview-trainer','korean-resume-builder','business-email-writing','presentation-coach','workplace-culture','career-report']) assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} registered`);
  for (const table of ['career_learning_profiles','career_activity_summaries','career_resume_drafts','career_email_drafts','career_presentation_drafts']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} RLS`);
  assert.match(migration, /raw_draft_stored boolean not null default false check \(raw_draft_stored = false\)/); assert.match(migration, /CV, email and presentation draft text is excluded from analytics/);
  assert.match(index, /career-learning\.css\?v=1/); assert.match(index, /data\/career-learning-ecosystem\.js\?v=2/); assert.match(index, /app\.js\?v=65/); assert.match(worker, /klearn-v79/); assert.match(worker, /content\/career-learning-ecosystem\.json/); assert.match(appSource, /careerLearning: 'klearn_career_learning'/); assert.match(appSource, /STORAGE_KEYS\.careerLearning/); assert.match(css, /@media\(max-width:600px\)/);
  console.log('career learning ecosystem: six paths, professional SRS packs, workplace scenarios, interview, resume, email, presentation, culture, readiness report, private sync and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
