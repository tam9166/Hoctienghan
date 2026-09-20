const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const config = JSON.parse(read('content/teacher-creator-ecosystem.json'));

function runtime() {
  const records = new Map();
  let role = 'student';
  let userId = 'learner-1';
  const learningData = { progress: { marker: 'keep-progress', lessonProgress: { old: { completed: true } } }, srs: [{ id: 'word-1', state: 'learning' }], mastery: { grammar: 72 } };
  const window = {
    KLEARN_APP: {
      state: { currentUser: { id: userId, fullName: 'Test User' }, currentView: 'home' },
      storage: { get(key, fallback) { return records.has(key) ? structuredClone(records.get(key)) : structuredClone(fallback); }, set(key, value) { records.set(key, structuredClone(value)); return true; } },
      escapeHtml: String, render() {}, toast() {}, AccessControlService: { role: () => role }
    },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    ContentEntityRegistryService: { all: () => [{ id: 'legacy-lesson' }, { id: 'legacy-word', ownerId: 'creator-old', ownerName: 'Old Creator', ownerStatus: 'verified' }] },
    fetch: async () => ({ ok: true, json: async () => config }),
    document: null
  };
  window.window = window;
  const context = { window, console, Date, Intl, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, structuredClone, setTimeout, fetch: window.fetch };
  vm.runInNewContext(read('data/teacher-creator-ecosystem.js'), context);
  window.TeacherCreatorConfigService.hydrate(config);
  return {
    window, records, learningData,
    identity(nextRole, nextId) { role = nextRole; userId = nextId; window.KLEARN_APP.state.currentUser = { id: nextId, fullName: nextId }; }
  };
}

assert.deepEqual(config.contentTypes, ['vocabulary', 'grammar', 'listening', 'reading', 'speaking', 'writing', 'culture']);
assert.deepEqual(config.courseHierarchy, ['course', 'chapter', 'lesson', 'exercise', 'assessment']);
assert.equal(config.revenueMetadata.paymentEnabled, false);
assert.ok(config.privacy.forbiddenFields.includes('password'));

const rt = runtime();
const w = rt.window;
['TeacherCreatorRoleService', 'TeacherProfileService', 'ExistingContentOwnershipService', 'CreatorDraftService', 'CreatorAIAssistantService', 'CreatorReviewWorkflowService', 'CreatorCourseBuilderService', 'CreatorFeedbackService', 'CreatorAnalyticsService', 'CreatorDashboardService', 'CreatorQualityScoreService', 'TeacherClassroomWorkspaceService', 'TeacherCreatorAuditService'].forEach((name) => assert.ok(w[name], `${name} missing`));

// Learner has no creator/teacher permissions and system content migration is read-only.
assert.equal(w.TeacherCreatorRoleService.role(), 'learner');
assert.throws(() => w.CreatorDraftService.create({}), /không có quyền/);
const migration = w.ExistingContentOwnershipService.migrationAudit();
assert.equal(migration.mutatesLearningData, false);
assert.equal(migration.preservesIds, true);
assert.equal(w.ExistingContentOwnershipService.ownerFor({ id: 'legacy-lesson' }).displayName, 'TamHoanq');
assert.equal(w.ExistingContentOwnershipService.ownerFor({ ownerId: 'creator-old', ownerName: 'Old Creator' }).displayName, 'Old Creator');
assert.deepEqual(rt.learningData, { progress: { marker: 'keep-progress', lessonProgress: { old: { completed: true } } }, srs: [{ id: 'word-1', state: 'learning' }], mastery: { grammar: 72 } });

// Public teacher/creator profile whitelists fields and never accepts credentials/private data.
rt.identity('teacher', 'teacher-1');
assert.equal(w.TeacherCreatorRoleService.can('create_content'), true);
assert.equal(w.TeacherCreatorRoleService.can('create_course'), true);
const profile = w.TeacherProfileService.save({ displayName: 'Cô Kim', avatar: '/kim.png', bio: 'TOPIK teacher', experience: '8 năm', specialization: 'Listening', languages: ['vi', 'ko'], certification: 'TOPIK', email: 'hidden@example.com', password: 'never-store' });
assert.equal(profile.displayName, 'Cô Kim');
assert.equal('email' in profile, false);
assert.equal('password' in profile, false);
assert.deepEqual(Object.keys(w.TeacherProfileService.public()).sort(), ['avatar', 'bio', 'certification', 'displayName', 'experience', 'languages', 'specialization', 'updatedAt', 'userId'].sort());

// Teacher can create only their classes; safe snapshots expose only approved fields.
const classroom = w.TeacherClassroomWorkspaceService.create({ name: 'TOPIK 1 A' });
w.TeacherClassroomWorkspaceService.addStudent(classroom.id, 'student-1');
const snapshot = w.TeacherClassroomWorkspaceService.safeSnapshot(classroom.id, { studentId: 'student-1', displayName: 'An', progress: 48, studyMinutes: 320, weakSkill: 'listening', mistakeCount: 4, email: 'private@example.com', password: 'secret', journal: 'private' });
assert.equal(snapshot.progress, 48);
assert.equal('email' in snapshot, false);
assert.equal('password' in snapshot, false);
assert.equal('journal' in snapshot, false);
assert.ok(w.TeacherClassroomWorkspaceService.createAssignment({ classId: classroom.id, title: 'Ôn từ vựng', contentId: 'legacy-word' }));
assert.ok(w.TeacherClassroomWorkspaceService.createStudyPlan({ classId: classroom.id, title: '14 ngày nghe', weeks: 2, goals: ['Nghe câu ngắn'] }));
rt.identity('teacher', 'teacher-2');
assert.throws(() => w.TeacherClassroomWorkspaceService.addStudent(classroom.id, 'student-2'), /giáo viên khác/);

// Creator workflow requires complete learning fields, own-content boundary, automated check, human reviewer and separate admin publish.
rt.identity('content_creator', 'creator-1');
assert.throws(() => w.CreatorDraftService.create({ type: 'grammar', title: 'Thiếu dữ liệu' }), /Thiếu trường/);
const draft = w.CreatorDraftService.create({ id: 'creator-grammar-1', type: 'grammar', title: '은/는 cho người mới', level: 'TOPIK 1', skill: 'grammar', objective: 'Phân biệt chủ đề cơ bản', explanation: '은 và 는 đánh dấu chủ đề trong ngữ cảnh giao tiếp cơ bản.', example: '저는 학생이에요.', exercise: 'Chọn 은 hoặc 는.' });
assert.equal(draft.ownerId, 'creator-1');
assert.equal(draft.status, 'draft');
assert.equal(draft.revenue.paymentEnabled, false);
const ai = w.CreatorAIAssistantService.review(draft.id);
assert.equal(ai.advisoryOnly, true);
assert.equal(ai.canPublish, false);
assert.throws(() => w.CreatorAIAssistantService.publish(), /không được phép publish/);
const checked = w.CreatorReviewWorkflowService.automatedCheck(draft.id);
assert.equal(checked.automatedCheckPassed, true);
assert.equal(w.CreatorReviewWorkflowService.submit(draft.id).status, 'pending_review');

rt.identity('content_creator', 'creator-2');
assert.throws(() => w.CreatorDraftService.update(draft.id, { title: 'Steal' }), /creator khác/);

rt.identity('reviewer', 'reviewer-1');
assert.equal(w.CreatorReviewWorkflowService.queue().length, 1);
assert.throws(() => w.CreatorReviewWorkflowService.review(draft.id, 'approve', { accuracy: true }), /Checklist quality/);
const checklist = Object.fromEntries(config.workflow.checklist.map((key) => [key, true]));
assert.equal(w.CreatorReviewWorkflowService.review(draft.id, 'approve', checklist, 'Đã kiểm tra').status, 'approved');
assert.throws(() => w.CreatorReviewWorkflowService.publish(draft.id), /không có quyền/);

rt.identity('admin', 'admin-1');
const published = w.CreatorReviewWorkflowService.publish(draft.id);
assert.equal(published.status, 'published');
assert.equal(published.humanReview.reviewerId, 'reviewer-1');

// Self-review is forbidden even when a creator also receives reviewer role later.
rt.identity('content_creator', 'creator-3');
const self = w.CreatorDraftService.create({ id: 'creator-culture-1', type: 'culture', title: 'Chào hỏi nơi làm việc', level: 'TOPIK 1', skill: 'culture', objective: 'Chọn lời chào phù hợp', explanation: 'Dùng lời chào lịch sự với đồng nghiệp và cấp trên.', example: '안녕하세요.', exercise: 'Chọn cách chào phù hợp.' });
w.CreatorReviewWorkflowService.automatedCheck(self.id); w.CreatorReviewWorkflowService.submit(self.id);
rt.identity('reviewer', 'creator-3');
assert.equal(w.CreatorReviewWorkflowService.queue().some((item) => item.id === self.id), false);
assert.throws(() => w.CreatorReviewWorkflowService.review(self.id, 'approve', checklist), /tự duyệt/);

// Course hierarchy enforces ownership and node order.
rt.identity('content_creator', 'creator-1');
const course = w.CreatorCourseBuilderService.create({ title: 'Korean Beginner', description: 'Từ số 0', level: 'Beginner', goal: 'Đọc câu đầu tiên', thumbnail: '', category: 'Foundation' });
const chapter = w.CreatorCourseBuilderService.addNode(course.id, { type: 'chapter', title: 'Hangul' });
const lesson = w.CreatorCourseBuilderService.addNode(course.id, { type: 'lesson', parentId: chapter.id, title: 'Nguyên âm' });
assert.ok(w.CreatorCourseBuilderService.addNode(course.id, { type: 'exercise', parentId: lesson.id, title: 'Nhận diện âm' }));
assert.throws(() => w.CreatorCourseBuilderService.addNode(course.id, { type: 'assessment', parentId: chapter.id, title: 'Wrong parent' }), /Cấu trúc/);

// Feedback is learner-owned, creator receives safe records; analytics and quality never equate views with outcomes.
rt.identity('student', 'learner-2');
assert.ok(w.CreatorFeedbackService.submit(draft.id, { rating: 4, issueType: 'example', message: 'Cần thêm ví dụ.' }));
rt.identity('content_creator', 'creator-1');
const feedback = w.CreatorFeedbackService.forCreator();
assert.equal(feedback.length, 1);
assert.equal('learnerId' in feedback[0], false);
w.CreatorAnalyticsService.recordAggregate({ contentId: draft.id, views: 100, learners: 17, starts: 20, completions: 15, dropOffs: 5, averageScore: 82, improvement: 18, commonErrors: ['은/는'] });
const analytics = w.CreatorAnalyticsService.summary(draft.id);
assert.equal(analytics.completionRate, 75);
assert.equal(analytics.learners, 17);
assert.equal(analytics.dropOffRate, 25);
assert.equal(analytics.improvement, 18);
const quality = w.CreatorQualityScoreService.calculate('creator-1');
assert.ok(quality.score >= 0 && quality.score <= 100);
assert.match(quality.rule, /Views are not learning outcomes/);
const dashboard = w.CreatorDashboardService.snapshot('creator-1');
assert.deepEqual({ learners: dashboard.learners, completionRate: dashboard.completionRate, averageRating: dashboard.averageRating, feedbackCount: dashboard.feedbackCount }, { learners: 17, completionRate: 75, averageRating: 4, feedbackCount: 1 });

// Static integration and SQL/RLS assertions.
const moduleCode = read('data/teacher-creator-ecosystem.js');
const loader = read('data/route-loader.js');
const index = read('index.html');
const worker = read('sw.js');
const migrationSql = read('supabase/migrations/20260916_p76_teacher_creator_ecosystem.sql');
assert.match(loader, /teacherCreator/);
assert.match(loader, /creator-studio-p76/);
assert.match(index, /route-loader\.js\?v=30/);
assert.match(worker, /klearn-v104/);
assert.match(worker, /teacher-creator-ecosystem\.json/);
assert.match(migrationSql, /education_teacher_profiles/);
assert.match(migrationSql, /creator_id = auth\.uid\(\)/);
assert.match(migrationSql, /creator_id <> auth\.uid\(\)/);
assert.match(migrationSql, /old\.status <> 'approved'/);
assert.match(migrationSql, /new\.status = 'published'/);
assert.match(migrationSql, /Aggregate content metrics only/);
assert.doesNotMatch(moduleCode, /passwordHash\s*:/);

console.log('P76 unit: roles, profile whitelist, ownership, gated workflow, course hierarchy, feedback privacy, classroom boundary, analytics and migration preservation passed');
