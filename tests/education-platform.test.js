const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dataSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'education-platform-data.js'), 'utf8');
const moduleSource = fs.readFileSync(path.join(__dirname, '..', 'data', 'education-platform.js'), 'utf8');

function boot({ initialRole = 'student', userId = 'user-a' } = {}) {
  const scoped = new Map(); let role = initialRole;
  const state = { currentUser: { id: userId }, currentView: 'profile' };
  const window = {
    KLEARN_APP: {
      state, STORAGE_KEYS: { educationPlatform: 'education-platform' },
      userScoped: (key) => (scoped.get(key) || {})[state.currentUser?.id] || [],
      saveUserScoped: (key, items) => { const all = scoped.get(key) || {}; all[state.currentUser?.id] = items; scoped.set(key, all); },
      escapeHtml: String, setView: (view) => { state.currentView = view; }, render: () => {}, toast: () => {},
      AccessControlService: { role: () => role, isCloudReady: () => false }, CloudSyncService: { schedule: () => {} }
    },
    KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null,
    setRole: (next) => { role = next; }
  };
  const document = { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const context = { window, document, console, Date, String, Number, Object, Array, Math, Set, Map, FormData: class {}, setTimeout };
  vm.createContext(context);
  vm.runInContext(dataSource, context);
  vm.runInContext(moduleSource, context);
  return window;
}

const student = boot();
assert.equal(student.EducationPermissionService.role(), 'student');
assert.equal(student.EducationPermissionService.can('view_own_assignments'), true);
assert.equal(student.EducationPermissionService.can('view_teacher_dashboard'), false);
assert.equal(student.OrganizationService.createOrganization({ name: 'Không hợp lệ', type: 'center' }), null);
assert.match(student.KLEARN_EXTRA_VIEWS['teacher-dashboard'](), /Tài khoản hiện tại: Student/);
assert.doesNotMatch(student.KLEARN_EXTRA_VIEWS['teacher-dashboard'](), /teacher-data-table/);

const teacher = boot({ initialRole: 'teacher', userId: 'teacher-a' });
const org = teacher.OrganizationService.createOrganization({ name: 'Trung tâm TamHoanq', type: 'center' });
assert.ok(org);
assert.equal(org.type, 'center');
const classroom = teacher.OrganizationService.createClass({ organizationId: org.id, name: 'TOPIK 1 buổi tối', code: 'T1-EVENING' });
assert.ok(classroom);
const member = teacher.OrganizationService.inviteStudent({ classId: classroom.id, studentId: 'student-a', displayName: 'Minh', status: 'active' });
assert.equal(member.status, 'active');

teacher.OrganizationService.cacheSummary('student-a', {
  progress: 68, studyMinutes: 145, lessonCount: 12,
  skills: { listening: 38, vocabulary: 82, grammar: 61 },
  mistakes: [{ title: '은/는', type: 'grammar' }, { content: 'ㅓ / ㅗ', type: 'listening' }],
  outcomes: { status: 'measured', overallGrowth: 14, goalProgress: 72, retention7: 84, retention30: 69, evidenceCount: 4, skillGrowth: { listening: 18, vocabulary: 9, speaking: null } },
  journal: 'This must never be copied', chatHistory: ['private']
});
const row = teacher.TeacherDashboardService.rows()[0];
assert.equal(row.progress, 68);
assert.equal(row.studyMinutes, 145);
assert.equal(row.weakSkill, 'listening');
assert.equal(row.mistakeCount, 2);
assert.equal(row.outcomes.overallGrowth, 14);
assert.equal(row.outcomes.retention30, 69);
assert.equal(row.outcomes.skillGrowth.speaking, null, 'unmeasured teacher outcomes must not be converted to zero');
assert.equal(row.summary.journal, undefined, 'teacher snapshot never includes journal');
assert.equal(row.summary.chatHistory, undefined, 'teacher snapshot never includes chat history');
const analytics = teacher.TeacherDashboardService.analytics(classroom.id);
assert.equal(analytics.students, 1);
assert.equal(analytics.averageProgress, 68);
assert.equal(analytics.studyMinutes, 145);

assert.equal(teacher.EducationAssignmentService.create({ classId: classroom.id, studentId: 'unknown', type: 'lesson', title: 'Không được giao' }), null, 'teacher cannot target an unlinked student');
const assignment = teacher.EducationAssignmentService.create({ classId: classroom.id, studentId: 'student-a', type: 'vocabulary', sourceId: 'topik-core-1', title: 'Ôn 20 từ', dueDate: '2026-09-12' });
assert.ok(assignment);
assert.equal(teacher.EducationAssignmentService.forClass().length, 1);
const classAssignment = teacher.EducationAssignmentService.create({ classId: classroom.id, type: 'test', sourceId: 'mock-01', title: 'Mini test tuần 1' });
assert.equal(classAssignment.studentId, '');

const feedback = teacher.EducationFeedbackService.create({ studentId: 'student-a', type: 'speaking', strengths: 'Nhịp câu rõ', improvements: 'Luyện lại 받침', nextExercise: 'Shadowing 3 câu' });
assert.ok(feedback);
assert.equal(feedback.type, 'speaking');
assert.equal(teacher.EducationFeedbackService.create({ studentId: 'unknown', type: 'writing', improvements: 'No' }), null);

assert.deepEqual(Array.from(teacher.KLEARN_EDUCATION_PLATFORM_DATA.courseTemplates, (item) => item.title), ['Business Korean', 'Travel Korean', 'TOPIK']);
const course = teacher.CourseBuilderService.fromTemplate('business-korean', org.id);
assert.ok(course);
assert.equal(course.status, 'draft');
assert.equal(course.verified, false);
assert.ok(teacher.CourseBuilderService.items(course.id).length >= 5);
const attemptedApproved = teacher.CourseBuilderService.addItem(course.id, { title: 'Bài chưa kiểm định', type: 'lesson', status: 'approved', verified: true });
assert.equal(attemptedApproved.verified, false, 'teacher cannot self-verify content');
assert.equal(attemptedApproved.status, 'in_review', 'unverified content cannot become approved');

teacher.setRole('student');
assert.equal(teacher.TeacherDashboardService.rows().length, 0, 'role downgrade immediately blocks teacher data');
assert.equal(teacher.CourseBuilderService.create({ title: 'Không hợp lệ' }), null);

for (const route of ['education-platform', 'teacher-dashboard', 'organization-center', 'education-assignments', 'education-feedback', 'course-builder', 'organization-analytics', 'education-content']) {
  assert.equal(typeof teacher.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
}

console.log('education platform: roles, organization, classroom analytics, assignments, feedback, course quality and privacy passed');
