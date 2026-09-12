#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/education-ecosystem-platform.json'));

function boot() {
  const values = new Map(); const scoped = new Map(); let role = 'teacher'; let aiEnabled = true; const aiCalls = [];
  const state = { currentUser: { id: 'teacher-a' }, currentView: 'education-ecosystem' };
  const storage = { get: (key, fallback) => values.has(key) ? values.get(key) : fallback, set: (key, value) => { values.set(key, value); return value; } };
  const userScoped = (key) => (scoped.get(key) || {})[state.currentUser?.id] || [];
  const saveUserScoped = (key, items) => { const all = scoped.get(key) || {}; all[state.currentUser?.id] = items; scoped.set(key, all); };
  const document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    document, navigator: { onLine: true }, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    SupabaseService: { session: null, client: null }, FeaturePermissionService: { access: () => ({ allowed: true, plan: 'pro' }) },
    AIOrchestrationService: { request: async (request) => { aiCalls.push(request); return { reply: 'Draft cần giáo viên duyệt.', fallback: false }; } },
    KLEARN_APP: {
      state, storage, STORAGE_KEYS: { educationPlatform: 'education-platform', educationEcosystem: 'education-ecosystem' }, userScoped, saveUserScoped,
      escapeHtml: String, setView: (view) => { state.currentView = view; }, render() {}, toast() {}, CloudSyncService: { schedule() {} },
      AccessControlService: { role: () => role, isCloudReady: () => false }, PrivacyPreferenceService: { allows: () => aiEnabled }
    },
    setActor(nextId, nextRole) { state.currentUser = { id: nextId }; role = nextRole; }, setAiEnabled(value) { aiEnabled = value; }
  };
  window.window = window;
  const context = { window, document, navigator: window.navigator, fetch: async () => ({ ok: true, json: async () => content }), console, Date, String, Number, Boolean, Object, Array, Math, Set, Map, RegExp, Promise, JSON, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(read('data/education-platform-data.js'), context);
  vm.runInContext(read('data/education-platform.js'), context);
  vm.runInContext(read('data/education-ecosystem-platform.js'), context);
  window.EducationEcosystemConfigService.hydrate(content);
  return { window, state, values, scoped, aiCalls };
}

(async () => {
  assert.deepEqual(content.roles.map((item) => item.id), ['student','teacher','content_creator','center_admin','super_admin']);
  assert.equal(content.principles.studentLearningCoreUnchanged, true);
  assert.equal(content.principles.studentControlsProgressSharing, true);
  assert.equal(content.principles.teacherCannotReadPrivateData, true);
  assert.equal(content.principles.aiNeverApprovesContent, true);
  assert.deepEqual(content.assessmentTypes, ['vocabulary','grammar','listening','reading']);
  assert.deepEqual(content.creatorWorkflow, ['draft','ai_checked','human_review','approved','published']);
  assert.equal(content.plans.every((plan) => plan.price === null), true, 'P69 must not invent pricing');

  const app = boot(); const w = app.window;
  assert.equal(w.RoleArchitectureService.role(), 'teacher');
  assert.equal(w.RoleArchitectureService.can('create_class'), true);
  const organization = w.OrganizationAccountService.create({ name: 'TamHoanq Center', type: 'center' });
  assert.ok(organization);
  const classroom = w.ClassroomLifecycleService.create({ organizationId: organization.id, name: 'TOPIK 1 tối', code: 'P69-T1' });
  assert.ok(classroom);
  const participant = w.ClassroomLifecycleService.inviteStudent({ classId: classroom.id, studentId: 'student-a', displayName: 'Minh' });
  assert.equal(participant.status, 'active');
  assert.ok(w.ClassroomLifecycleService.assignCourse({ classId: classroom.id, courseId: 'course-topik-1' }));
  const assignment = w.ClassroomLifecycleService.createAssignment({ classId: classroom.id, studentId: 'student-a', title: 'Học Lesson 10', type: 'lesson', contentId: 'lesson-10', deadline: '2026-10-01' });
  assert.ok(assignment);
  const assessment = w.EducationAssessmentService.create({ classId: classroom.id, title: 'Vocabulary checkpoint', type: 'vocabulary', questions: [{ id: 'q1', skill: 'vocabulary', prompt: '학교 nghĩa là gì?', options: ['trường học','bệnh viện'], answer: 'trường học' }, { id: 'q2', skill: 'grammar', prompt: 'Chọn trợ từ: 학교__ 가요', options: ['에','를'], answer: '에' }] });
  assert.ok(assessment);
  assert.equal(w.StudentProgressSharingService.read('student-a', classroom.id), null, 'teacher cannot read progress without student consent');

  w.setActor('student-a', 'student');
  assert.equal(w.RoleArchitectureService.can('create_assessment'), false);
  assert.equal(w.EducationAssessmentService.create({ classId: classroom.id, title: 'Unauthorized', type: 'grammar', questions: [{ prompt: 'x', answer: 'y' }] }), null);
  assert.equal(w.ClassroomLifecycleService.mine().length, 1);
  assert.ok(w.ClassroomLifecycleService.complete(assignment.id));
  const safeAssessment = w.EducationAssessmentService.publicAssessment(assessment.id);
  assert.equal('answer' in safeAssessment.questions[0], false, 'answer key must not reach student');
  const attempt = w.EducationAssessmentService.submit(assessment.id, { q1: 'trường học', q2: '를' });
  assert.equal(attempt.score, 50);
  assert.equal(attempt.skillBreakdown.vocabulary, 100);
  assert.equal(attempt.skillBreakdown.grammar, 0);
  assert.ok(w.ProgressConsentService.grant({ classId: classroom.id, scopes: ['progress','skills','attendance','weakness','topik_readiness'] }));
  const shared = w.StudentProgressSharingService.publish(classroom.id, { attendance: 92, progress: 68, lessonCompletion: 70, vocabularyMastery: 82, grammarWeakness: ['은/는'], topikReadiness: 64, skills: { grammar: 54, listening: 60 }, sessions7d: 1, scoreTrend: -12, lastActiveAt: new Date().toISOString(), password: 'never-share', journal: 'private journal', email: 'student@example.com' });
  assert.ok(shared);
  assert.equal('password' in shared, false);
  assert.equal('journal' in shared, false);
  assert.equal('email' in shared, false);

  w.setActor('teacher-a', 'teacher');
  const teacherSummary = w.StudentProgressSharingService.read('student-a', classroom.id);
  assert.equal(teacherSummary.progress, 68);
  assert.equal('password' in teacherSummary, false);
  const risk = w.TeacherInsightService.risks(classroom.id)[0];
  assert.equal(risk.risk, 'high');
  assert.ok(risk.reasons.includes('Ít hoạt động trong 7 ngày'));
  const overview = w.TeacherInsightService.classOverview(classroom.id);
  assert.equal(overview.students, 1);
  assert.equal(overview.sharedStudents, 1);
  assert.equal(overview.averageProgress, 68);
  const report = w.SchoolReportService.student('student-a', classroom.id);
  assert.equal(report.attendance, 92);
  assert.ok(report.excludes.includes('password'));
  assert.equal(JSON.stringify(report).includes('student@example.com'), false);
  assert.equal(w.EducationAssessmentService.results(assessment.id)[0].score, 50);
  const certificate = w.EducationCertificateService.issue({ studentId: 'student-a', classId: classroom.id, courseId: 'course-topik-1', title: 'Completed Beginner Korean', evidenceType: 'course_completion', evidenceRef: assignment.id });
  assert.ok(certificate);
  const aiSummary = await w.TeacherAISupportService.request('class_error_summary', classroom.id);
  assert.equal(aiSummary.deterministic, true);
  assert.equal(aiSummary.humanApprovalRequired, true);
  const aiDraft = await w.TeacherAISupportService.request('quiz_draft', classroom.id);
  assert.equal(aiDraft.ok, true);
  assert.equal(aiDraft.aggregateOnly, true);
  assert.equal(aiDraft.humanApprovalRequired, true);
  assert.equal(JSON.stringify(app.aiCalls[0]).includes('student-a'), false, 'teacher AI context must be aggregate-only');
  w.setAiEnabled(false);
  const aiOff = await w.TeacherAISupportService.request('quiz_draft', classroom.id);
  assert.equal(aiOff.reason, 'AI_DISABLED_BY_USER');
  assert.equal(aiOff.learningCoreAvailable, true);

  w.setActor('student-a', 'student');
  assert.equal(w.ProgressConsentService.revoke(classroom.id), true);
  w.setActor('teacher-a', 'teacher');
  assert.equal(w.StudentProgressSharingService.read('student-a', classroom.id), null, 'revocation must immediately remove teacher access');

  w.setActor('creator-a', 'content_creator');
  assert.equal(w.RoleArchitectureService.role(), 'content_creator');
  const draft = w.CreatorWorkflowService.create({ type: 'grammar', title: '은/는 cho người Việt', sourceId: 'grammar-topic' });
  assert.equal(draft.status, 'draft');
  const checked = w.CreatorWorkflowService.aiCheck(draft.id, { grammar: 92, difficulty: 84, duplicateRisk: 10 });
  assert.equal(checked.status, 'ai_checked');
  assert.equal(checked.aiCheck.advisoryOnly, true);
  assert.equal(w.CreatorWorkflowService.submit(draft.id).status, 'human_review');
  assert.equal(w.CreatorWorkflowService.review(draft.id, 'approved'), null, 'creator cannot self-approve');
  w.setActor('reviewer-a', 'reviewer');
  assert.equal(w.CreatorWorkflowService.review(draft.id, 'approved', 'Đã kiểm tra ví dụ.').status, 'approved');
  assert.equal(w.CreatorWorkflowService.publish(draft.id), null, 'reviewer cannot publish');
  w.setActor('admin-a', 'super_admin');
  assert.equal(w.RoleArchitectureService.role(), 'super_admin');
  assert.equal(w.CreatorWorkflowService.publish(draft.id).status, 'published');

  w.setActor('center-a', 'center_admin');
  const center = w.OrganizationAccountService.create({ name: 'Seoul Study Center', type: 'center' });
  assert.ok(center);
  assert.equal(w.OrganizationAccountService.addMember({ organizationId: center.id, userId: 'teacher-b', role: 'teacher' }).role, 'teacher');
  assert.equal(w.OrganizationAccountService.addMember({ organizationId: organization.id, userId: 'intruder', role: 'teacher' }), null, 'center admin cannot manage another organization');
  assert.equal(w.MonetizationEducationService.authoritative(), 'server');
  assert.deepEqual(Array.from(w.MonetizationEducationService.plans(), (plan) => plan.id), ['student','teacher','center']);
  assert.equal(w.MonetizationEducationService.plans().every((plan) => plan.price === null), true);

  for (const route of ['education-ecosystem','assessment-center','creator-workflow','school-report','education-certificates']) assert.equal(typeof w.KLEARN_EXTRA_VIEWS[route], 'function', `${route} registered`);
  assert.match(w.KLEARN_EXTRA_VIEWS['education-platform'](), /data-p69-gateway/);

  const migration = read('supabase/migrations/20260912_p69_education_ecosystem_platform.sql');
  for (const table of ['education_class_courses','education_progress_consents','education_assessments','education_assessment_questions','education_assessment_attempts','education_creator_submissions','education_certificates','education_teacher_ai_requests','education_access_audit','education_plan_catalog']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} needs RLS`);
  assert.match(migration, /education_set_progress_consent/);
  assert.match(migration, /education_student_summary_v2/);
  assert.match(migration, /student progress consent required/);
  assert.match(migration, /revoke execute on function public\.education_student_summary\(uuid\) from authenticated/);
  assert.match(read('data/education-platform.js'), /rpc\('education_student_summary_v2', \{ target_student: member\.studentId, target_class: member\.classId \}\)/);
  assert.match(migration, /answer_key is never selectable by students/i);
  assert.match(migration, /reviewer_id is null or reviewer_id <> creator_id/);
  assert.match(migration, /human_approval_required boolean not null default true check \(human_approval_required\)/);
  assert.match(migration, /price_metadata jsonb/);
  assert.doesNotMatch(migration, /\b(delete|truncate)\s+(from\s+)?public\.(learning_sync|srs|mastery|user_progress)/i);
  assert.doesNotMatch(migration, /update\s+public\.(learning_sync|srs|mastery|user_progress)/i);

  const loader = read('data/route-loader.js'); const worker = read('sw.js');
  assert.match(loader, /education-ecosystem\.css\?v=1/);
  assert.match(loader, /education-ecosystem-platform\.js\?v=1/);
  assert.match(worker, /const CACHE = 'klearn-v84'/);
  assert.match(worker, /content\/education-ecosystem-platform\.json/);
  assert.match(read('index.html'), /app\.js\?v=70/);
  assert.match(read('app.js'), /educationEcosystem: 'klearn_education_ecosystem'/);
  console.log('P69 education ecosystem: five roles, classes/courses/assignments, assessments, consent, safe reports, risks, creator human review, certificates, aggregate teacher AI, B2C/B2B plans and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
