(function (global) {
  'use strict';

  const app = global.KLEARN_APP;
  const data = global.KLEARN_EDUCATION_PLATFORM_DATA;
  if (!app || !data) return;

  const { state, STORAGE_KEYS, userScoped, saveUserScoped, escapeHtml, setView, render, toast, AccessControlService, CloudSyncService } = app;
  const STORE_KEY = STORAGE_KEYS.educationPlatform || 'klearn_education_platform';
  const now = () => new Date().toISOString();
  const uid = () => global.SupabaseService?.session?.user?.id || state.currentUser?.id || '';
  const makeId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const text = (value, length = 240) => String(value || '').trim().slice(0, length);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const isUuid = (value) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

  function emptyStore() {
    return { version: 1, organizations: [], classes: [], memberships: [], assignments: [], feedback: [], courses: [], courseItems: [], selectedOrganizationId: '', selectedClassId: '', cloudUpdatedAt: null };
  }
  function store() {
    const saved = userScoped(STORE_KEY)[0];
    if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return emptyStore();
    const defaults = emptyStore();
    return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, Array.isArray(fallback) ? (Array.isArray(saved[key]) ? saved[key] : []) : (saved[key] ?? fallback)]));
  }
  function save(next) {
    const safe = { ...emptyStore(), ...next, version: 1, updatedAt: now() };
    saveUserScoped(STORE_KEY, [safe], 1);
    CloudSyncService?.schedule?.('education-platform');
    return safe;
  }
  function update(mutator) { const current = store(); const next = mutator(current) || current; save(next); return next; }

  const EducationPermissionService = {
    role() { return AccessControlService?.role?.() || 'student'; },
    can(capability) { return Boolean(data.capabilities[this.role()]?.includes(capability)); },
    require(capability) { if (!this.can(capability)) return false; return true; },
    label() { return ({ student: 'Student', teacher: 'Teacher', reviewer: 'Reviewer', content_editor: 'Content Editor', admin: 'Admin' })[this.role()] || 'Student'; }
  };

  const OrganizationService = {
    all() { return store().organizations; },
    classes(organizationId = store().selectedOrganizationId) { return store().classes.filter((item) => !organizationId || item.organizationId === organizationId); },
    selectedOrganization() { const value = store(); return value.organizations.find((item) => item.id === value.selectedOrganizationId) || value.organizations[0] || null; },
    selectedClass() { const value = store(); return value.classes.find((item) => item.id === value.selectedClassId) || this.classes()[0] || null; },
    selectOrganization(id) { update((value) => ({ ...value, selectedOrganizationId: id, selectedClassId: value.classes.find((item) => item.organizationId === id)?.id || '' })); },
    selectClass(id) { update((value) => ({ ...value, selectedClassId: id })); },
    createOrganization({ id, name, type } = {}) {
      if (!EducationPermissionService.require('create_organization') || !text(name)) return null;
      const organization = { id: id || makeId('org'), name: text(name, 120), type: data.organizationTypes.includes(type) ? type : 'center', ownerId: uid(), createdAt: now() };
      update((value) => ({ ...value, organizations: [organization, ...value.organizations.filter((item) => item.id !== organization.id)], selectedOrganizationId: organization.id }));
      return organization;
    },
    createClass({ id, organizationId, name, code } = {}) {
      if (!EducationPermissionService.require('manage_class') || !text(name)) return null;
      const orgId = organizationId || this.selectedOrganization()?.id;
      if (!orgId || !this.all().some((item) => item.id === orgId)) return null;
      const classroom = { id: id || makeId('class'), organizationId: orgId, teacherId: uid(), name: text(name, 120), code: text(code, 40) || `TH-${Math.random().toString(36).slice(2, 7).toUpperCase()}`, createdAt: now() };
      update((value) => ({ ...value, classes: [classroom, ...value.classes.filter((item) => item.id !== classroom.id)], selectedOrganizationId: orgId, selectedClassId: classroom.id }));
      return classroom;
    },
    inviteStudent({ id, classId, studentId, studentCode, displayName, status = 'invited' } = {}) {
      if (!EducationPermissionService.require('manage_class')) return null;
      const selectedClassId = classId || this.selectedClass()?.id;
      if (!selectedClassId || !store().classes.some((item) => item.id === selectedClassId && item.teacherId === uid())) return null;
      const identifier = text(studentId || studentCode, 100);
      if (!identifier) return null;
      const safeStatus = status === 'active' ? 'active' : 'invited';
      const member = { id: id || makeId('member'), classId: selectedClassId, studentId: text(studentId, 100), studentCode: text(studentCode || studentId, 100), displayName: text(displayName, 100) || 'Học viên', status: safeStatus, joinedAt: safeStatus === 'active' ? now() : null, summary: null };
      update((value) => ({ ...value, memberships: [member, ...value.memberships.filter((item) => !(item.classId === selectedClassId && (item.studentId === identifier || item.studentCode === identifier)))] }));
      return member;
    },
    members(classId = this.selectedClass()?.id) { return store().memberships.filter((item) => item.classId === classId); },
    myMemberships() { return store().memberships.filter((item) => item.studentId === uid()); },
    cacheMemberships(items) { update((value) => ({ ...value, memberships: [...items, ...value.memberships.filter((local) => !items.some((cloud) => cloud.id === local.id))] })); },
    cacheSummary(studentId, summary) {
      update((value) => ({ ...value, memberships: value.memberships.map((item) => item.studentId === studentId && item.status === 'active' ? { ...item, summary: sanitizeSummary(summary), summaryUpdatedAt: now() } : item) }));
    }
  };

  function sanitizeSummary(summary = {}) {
    const skills = Object.fromEntries(Object.entries(summary.skills || {}).slice(0, 8).map(([key, value]) => [text(key, 40), clamp(value)]));
    const mistakes = Array.isArray(summary.mistakes) ? summary.mistakes.slice(0, 8).map((item) => ({ title: text(item?.title || item?.question || item?.mistake || item?.content || item, 160), type: text(item?.type || 'learning', 40), count: Math.max(1, Number(item?.count) || 1) })) : [];
    const sourceOutcomes = summary.outcomes && typeof summary.outcomes === 'object' ? summary.outcomes : {};
    const skillGrowth = Object.fromEntries(Object.entries(sourceOutcomes.skillGrowth || {}).slice(0, 4).map(([key, value]) => [text(key, 40), value != null && Number.isFinite(Number(value)) ? Math.max(-100, Math.min(100, Math.round(Number(value)))) : null]));
    const outcomes = {
      status: ['measured', 'collecting'].includes(sourceOutcomes.status) ? sourceOutcomes.status : 'collecting',
      overallGrowth: sourceOutcomes.overallGrowth != null && Number.isFinite(Number(sourceOutcomes.overallGrowth)) ? Math.max(-100, Math.min(100, Math.round(Number(sourceOutcomes.overallGrowth)))) : null,
      goalProgress: sourceOutcomes.goalProgress != null && Number.isFinite(Number(sourceOutcomes.goalProgress)) ? clamp(sourceOutcomes.goalProgress) : null,
      retention7: sourceOutcomes.retention7 != null && Number.isFinite(Number(sourceOutcomes.retention7)) ? clamp(sourceOutcomes.retention7) : null,
      retention30: sourceOutcomes.retention30 != null && Number.isFinite(Number(sourceOutcomes.retention30)) ? clamp(sourceOutcomes.retention30) : null,
      evidenceCount: Math.max(0, Math.round(Number(sourceOutcomes.evidenceCount) || 0)),
      skillGrowth,
      updatedAt: text(sourceOutcomes.updatedAt, 40)
    };
    return {
      progress: clamp(summary.progress ?? summary.mastery),
      studyMinutes: Math.max(0, Math.round(Number(summary.studyMinutes ?? summary.stats?.totalMinutes ?? summary.stats?.weeklyStudyMinutes) || 0)),
      lessonsCompleted: Math.max(0, Math.round(Number(summary.lessonCount ?? summary.stats?.lessonsCompleted) || 0)),
      skills,
      mistakes,
      outcomes
    };
  }

  const TeacherDashboardService = {
    available() { return EducationPermissionService.can('view_teacher_dashboard'); },
    rows(classId = OrganizationService.selectedClass()?.id) {
      if (!this.available()) return [];
      return OrganizationService.members(classId).filter((item) => item.status === 'active').map((member) => {
        const summary = sanitizeSummary(member.summary || {});
        const sorted = Object.entries(summary.skills).sort((a, b) => a[1] - b[1]);
        return { ...member, ...summary, weakSkill: sorted[0]?.[0] || 'Chưa đủ dữ liệu', mistakeCount: summary.mistakes.length };
      });
    },
    analytics(classId) {
      const rows = this.rows(classId);
      const average = (key) => rows.length ? Math.round(rows.reduce((sum, item) => sum + Number(item[key] || 0), 0) / rows.length) : 0;
      const weakSkills = rows.reduce((result, item) => { result[item.weakSkill] = (result[item.weakSkill] || 0) + 1; return result; }, {});
      return { students: rows.length, averageProgress: average('progress'), studyMinutes: rows.reduce((sum, item) => sum + item.studyMinutes, 0), mistakeCount: rows.reduce((sum, item) => sum + item.mistakeCount, 0), weakSkills };
    }
  };

  const EducationAssignmentService = {
    all() { return store().assignments; },
    forClass(classId = OrganizationService.selectedClass()?.id) { return this.all().filter((item) => item.classId === classId); },
    mine() { const userId = uid(); return this.all().filter((item) => item.studentId === userId || (!item.studentId && store().memberships.some((member) => member.classId === item.classId && member.studentId === userId && member.status === 'active'))); },
    create({ id, classId, studentId = '', type, sourceId, title, instructions, dueDate, status = 'assigned' } = {}) {
      if (!EducationPermissionService.require('assign_content') || !text(title)) return null;
      const targetClass = store().classes.find((item) => item.id === (classId || OrganizationService.selectedClass()?.id));
      if (!targetClass || targetClass.teacherId !== uid()) return null;
      if (studentId && !store().memberships.some((item) => item.classId === targetClass.id && item.studentId === studentId && item.status === 'active')) return null;
      const assignment = { id: id || makeId('assignment'), classId: targetClass.id, teacherId: uid(), studentId: text(studentId, 100), type: data.assignmentTypes.includes(type) ? type : 'lesson', sourceId: text(sourceId, 160), title: text(title, 180), instructions: text(instructions, 2000), dueDate: text(dueDate, 10), status, createdAt: now() };
      update((value) => ({ ...value, assignments: [assignment, ...value.assignments.filter((item) => item.id !== assignment.id)] }));
      return assignment;
    },
    cache(items) { update((value) => ({ ...value, assignments: [...items, ...value.assignments.filter((local) => !items.some((cloud) => cloud.id === local.id))] })); }
  };

  const EducationFeedbackService = {
    all() { return store().feedback; },
    mine() { return this.all().filter((item) => item.studentId === uid()); },
    create({ id, studentId, assignmentId = '', type, strengths, improvements, nextExercise } = {}) {
      if (!EducationPermissionService.require('review_submission') || !text(studentId)) return null;
      const linked = store().memberships.some((member) => member.studentId === studentId && member.status === 'active' && store().classes.some((item) => item.id === member.classId && item.teacherId === uid()));
      if (!linked) return null;
      const feedback = { id: id || makeId('feedback'), teacherId: uid(), studentId: text(studentId, 100), assignmentId: text(assignmentId, 100), type: data.feedbackTypes.includes(type) ? type : 'writing', strengths: text(strengths, 2000), improvements: text(improvements, 2000), nextExercise: text(nextExercise, 2000), createdAt: now() };
      update((value) => ({ ...value, feedback: [feedback, ...value.feedback.filter((item) => item.id !== feedback.id)] }));
      return feedback;
    },
    cache(items) { update((value) => ({ ...value, feedback: [...items, ...value.feedback.filter((local) => !items.some((cloud) => cloud.id === local.id))] })); }
  };

  const CourseBuilderService = {
    all() { return store().courses; },
    items(courseId) { return store().courseItems.filter((item) => item.courseId === courseId).sort((a, b) => a.position - b.position); },
    create({ id, title, track = 'custom', difficulty = 'TOPIK 1', organizationId = '', description = '', status = 'draft', verified = false } = {}) {
      if (!EducationPermissionService.require('build_course') || !text(title)) return null;
      const course = { id: id || makeId('course'), organizationId: organizationId || OrganizationService.selectedOrganization()?.id || '', creatorId: uid(), title: text(title, 180), description: text(description, 1000), track: ['business', 'travel', 'topik', 'custom'].includes(track) ? track : 'custom', difficulty: data.difficulties.includes(difficulty) ? difficulty : 'TOPIK 1', status: data.reviewStatuses.includes(status) ? status : 'draft', verified: Boolean(verified && EducationPermissionService.can('review_content')), createdAt: now() };
      update((value) => ({ ...value, courses: [course, ...value.courses.filter((item) => item.id !== course.id)] }));
      return course;
    },
    fromTemplate(templateId, organizationId = '') {
      const template = data.courseTemplates.find((item) => item.id === templateId);
      if (!template) return null;
      const course = this.create({ title: template.title, track: template.track, difficulty: template.difficulty, organizationId, description: template.description });
      if (!course) return null;
      const items = template.modules.flatMap((module, moduleIndex) => module.items.map((reference, itemIndex) => { const [type, sourceId] = reference.split(':'); return { id: makeId('course-item'), courseId: course.id, moduleTitle: module.title, type, sourceId, title: sourceId.replaceAll('-', ' '), position: moduleIndex * 100 + itemIndex, verified: false, difficulty: template.difficulty, status: 'draft' }; }));
      update((value) => ({ ...value, courseItems: [...items, ...value.courseItems] }));
      return course;
    },
    addItem(courseId, { id, moduleTitle, type, sourceId, title, difficulty, status = 'draft', verified = false } = {}) {
      const course = this.all().find((item) => item.id === courseId && item.creatorId === uid());
      if (!EducationPermissionService.require('build_course') || !course || !text(title)) return null;
      const canVerify = EducationPermissionService.can('review_content');
      const item = { id: id || makeId('course-item'), courseId, moduleTitle: text(moduleTitle, 120) || 'Nội dung khóa học', type: data.contentTypes.includes(type) ? type : 'lesson', sourceId: text(sourceId, 160), title: text(title, 180), position: this.items(courseId).length, verified: Boolean(verified && canVerify), difficulty: data.difficulties.includes(difficulty) ? difficulty : course.difficulty, status: data.reviewStatuses.includes(status) ? status : 'draft' };
      if (item.status === 'approved' && !item.verified) item.status = 'in_review';
      update((value) => ({ ...value, courseItems: [...value.courseItems, item] }));
      return item;
    }
  };

  const EducationPlatformCloudService = {
    ready() { return Boolean(AccessControlService?.isCloudReady?.()); },
    client() { return global.SupabaseService?.client; },
    async refresh() {
      if (!this.ready()) return { offline: true };
      const client = this.client(); const role = EducationPermissionService.role();
      const requests = role === 'student'
        ? [client.from('education_class_assignments').select('*').order('created_at', { ascending: false }), client.from('teacher_feedback').select('*').order('created_at', { ascending: false }), client.from('education_class_students').select('*').order('created_at', { ascending: false })]
        : [client.from('education_organizations').select('*').order('created_at'), client.from('education_classes').select('*').order('created_at'), client.from('education_class_students').select('*'), client.from('education_class_assignments').select('*').order('created_at', { ascending: false }), client.from('education_courses').select('*').order('created_at'), client.from('education_course_items').select('*').order('position'), client.from('teacher_feedback').select('*').order('created_at', { ascending: false })];
      const results = await Promise.all(requests); const failed = results.find((result) => result.error); if (failed) throw failed.error;
      if (role === 'student') {
        EducationAssignmentService.cache((results[0].data || []).map(mapAssignment));
        EducationFeedbackService.cache((results[1].data || []).map(mapFeedback));
        OrganizationService.cacheMemberships((results[2].data || []).map((item) => ({ id: item.id, classId: item.class_id, studentId: item.student_id, studentCode: item.student_id, displayName: item.display_name || 'Học viên', status: item.status, summary: null })));
      } else {
        const [orgs, classes, members, assignments, courses, items, feedback] = results.map((result) => result.data || []);
        update((value) => ({ ...value,
          organizations: orgs.map((item) => ({ id: item.id, name: item.name, type: item.type, ownerId: item.owner_id, createdAt: item.created_at })),
          classes: classes.map((item) => ({ id: item.id, organizationId: item.organization_id, teacherId: item.teacher_id, name: item.name, code: item.code, createdAt: item.created_at })),
          memberships: members.map((item) => ({ id: item.id, classId: item.class_id, studentId: item.student_id, studentCode: item.student_id, displayName: item.display_name || 'Học viên', status: item.status, summary: value.memberships.find((local) => local.studentId === item.student_id)?.summary || null })),
          assignments: assignments.map(mapAssignment), courses: courses.map(mapCourse),
          courseItems: items.map(mapCourseItem), feedback: feedback.map(mapFeedback), cloudUpdatedAt: now()
        }));
        await this.refreshSummaries();
      }
      return { offline: false };
    },
    async refreshSummaries() {
      if (!this.ready() || !TeacherDashboardService.available()) return;
      const members = store().memberships.filter((item) => item.status === 'active' && isUuid(item.studentId));
      await Promise.all(members.map(async (member) => { const { data: summary, error } = await this.client().rpc('education_student_summary', { target_student: member.studentId }); if (!error && summary) OrganizationService.cacheSummary(member.studentId, summary); }));
    },
    async createOrganization(payload) { const { data: row, error } = await this.client().from('education_organizations').insert({ name: text(payload.name, 120), type: payload.type }).select().single(); if (error) throw error; return OrganizationService.createOrganization({ id: row.id, name: row.name, type: row.type }); },
    async respondToInvitation(enrollmentId, decision) { const { error } = await this.client().rpc('respond_to_class_invitation', { enrollment_id: enrollmentId, decision }); if (error) throw error; return this.refresh(); },
    async createClass(payload) { const record = { organization_id: payload.organizationId, name: text(payload.name, 120) }; const code = text(payload.code, 40); if (code) record.code = code; const { data: row, error } = await this.client().from('education_classes').insert(record).select().single(); if (error) throw error; return OrganizationService.createClass({ id: row.id, organizationId: row.organization_id, name: row.name, code: row.code }); },
    async inviteStudent(payload) { const { data: row, error } = await this.client().from('education_class_students').insert({ class_id: payload.classId, student_id: payload.studentId, display_name: text(payload.displayName, 100) }).select().single(); if (error) throw error; return OrganizationService.inviteStudent({ id: row.id, classId: row.class_id, studentId: row.student_id, displayName: row.display_name, status: row.status }); },
    async createAssignment(payload) { const { data: row, error } = await this.client().from('education_class_assignments').insert({ class_id: payload.classId, student_id: payload.studentId || null, assignment_type: payload.type, source_id: text(payload.sourceId, 160), title: text(payload.title, 180), instructions: text(payload.instructions, 2000), due_date: payload.dueDate || null }).select().single(); if (error) throw error; return EducationAssignmentService.create({ ...payload, id: row.id }); },
    async createFeedback(payload) { const { data: row, error } = await this.client().from('teacher_feedback').insert({ student_id: payload.studentId, assignment_id: payload.assignmentId || null, submission_type: payload.type, strengths: text(payload.strengths, 2000), improvements: text(payload.improvements, 2000), next_exercise: text(payload.nextExercise, 2000) }).select().single(); if (error) throw error; return EducationFeedbackService.create({ ...payload, id: row.id }); },
    async createCourse(payload) { const { data: row, error } = await this.client().from('education_courses').insert({ organization_id: payload.organizationId || null, title: text(payload.title, 180), description: text(payload.description, 1000), track: payload.track, difficulty: payload.difficulty }).select().single(); if (error) throw error; return CourseBuilderService.create({ ...payload, id: row.id, status: row.status, verified: row.verified }); },
    async addCourseItem(courseId, payload) { const course = CourseBuilderService.all().find((item) => item.id === courseId); const position = CourseBuilderService.items(courseId).length; const { data: row, error } = await this.client().from('education_course_items').insert({ course_id: courseId, module_title: text(payload.moduleTitle, 120) || 'Nội dung khóa học', item_type: payload.type, source_id: text(payload.sourceId, 160), title: text(payload.title, 180), position, difficulty: payload.difficulty || course?.difficulty || 'TOPIK 1' }).select().single(); if (error) throw error; return CourseBuilderService.addItem(courseId, { ...payload, id: row.id, status: row.status, verified: row.verified, difficulty: row.difficulty }); },
    async createCourseFromTemplate(templateId) {
      const template = data.courseTemplates.find((item) => item.id === templateId); if (!template) return null;
      const course = await this.createCourse({ organizationId: OrganizationService.selectedOrganization()?.id || '', title: template.title, description: template.description, track: template.track, difficulty: template.difficulty });
      for (const module of template.modules) for (const reference of module.items) { const [type, sourceId] = reference.split(':'); await this.addCourseItem(course.id, { moduleTitle: module.title, type, sourceId, title: sourceId.replaceAll('-', ' '), difficulty: template.difficulty }); }
      return course;
    }
  };

  function mapAssignment(item) { return { id: item.id, classId: item.class_id, teacherId: item.teacher_id, studentId: item.student_id || '', type: item.assignment_type, sourceId: item.source_id || '', title: item.title, instructions: item.instructions || '', dueDate: item.due_date || '', status: item.status, createdAt: item.created_at }; }
  function mapFeedback(item) { return { id: item.id, teacherId: item.teacher_id, studentId: item.student_id, assignmentId: item.assignment_id || '', type: item.submission_type, strengths: item.strengths || '', improvements: item.improvements || '', nextExercise: item.next_exercise || '', createdAt: item.created_at }; }
  function mapCourse(item) { return { id: item.id, organizationId: item.organization_id || '', creatorId: item.creator_id, title: item.title, description: item.description || '', track: item.track, difficulty: item.difficulty, status: item.status, verified: item.verified, createdAt: item.created_at }; }
  function mapCourseItem(item) { return { id: item.id, courseId: item.course_id, moduleTitle: item.module_title, type: item.item_type, sourceId: item.source_id || '', title: item.title, position: item.position, verified: item.verified, difficulty: item.difficulty, status: item.status }; }

  function heading(title, description, back = 'profile') { return `<section class="section page-heading education-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">Education Platform</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`; }
  function denied(title = 'Khu vực dành cho giáo viên') { return `${heading(title, 'Quyền truy cập được xác thực từ Supabase, không lấy từ lựa chọn cục bộ.')}<section class="education-denied section"><span aria-hidden="true">◇</span><div><b>Tài khoản hiện tại: ${EducationPermissionService.label()}</b><p>Student chỉ xem bài giao và phản hồi của chính mình. Hãy liên hệ quản trị viên trung tâm nếu bạn cần role Teacher.</p></div><button class="btn secondary" data-view="education-assignments">Bài của tôi</button></section>`; }
  function selector() { const organizations = OrganizationService.all(); const classes = OrganizationService.classes(); const selectedOrg = OrganizationService.selectedOrganization(); const selectedClass = OrganizationService.selectedClass(); return `<div class="education-context"><label>Đơn vị<select data-education-org>${organizations.map((item) => `<option value="${item.id}" ${item.id === selectedOrg?.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><label>Lớp<select data-education-class>${classes.map((item) => `<option value="${item.id}" ${item.id === selectedClass?.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>`).join('')}</select></label><button class="btn secondary" data-education-sync ${!EducationPlatformCloudService.ready() ? 'disabled' : ''}>↻ Cloud</button></div>`; }

  function platformView() {
    const teacher = TeacherDashboardService.available();
    const entries = teacher ? [
      ['teacher-dashboard', '▦', 'Dashboard giáo viên', 'Tiến độ, lỗi, thời gian và kỹ năng yếu'], ['organization-center', '▣', 'Trường & lớp học', 'Đơn vị, lớp và roster có kiểm soát'], ['education-assignments', '✓', 'Giao bài', 'Lesson, vocabulary và test'], ['education-feedback', '✎', 'Nhận xét', 'Writing và speaking'], ['course-builder', '▱', 'Course Builder', 'Business, Travel và TOPIK'], ['organization-analytics', '↗', 'Báo cáo lớp', 'Tổng hợp tiến độ theo lớp'], ['education-content', '◈', 'Nội dung & chất lượng', 'Lesson, grammar, vocabulary và audio']
    ] : [['organization-center', '▣', 'Lời mời vào lớp', 'Chấp nhận hoặc từ chối lời mời'], ['education-assignments', '✓', 'Bài được giao', 'Chỉ hiển thị bài của tài khoản này'], ['education-feedback', '✎', 'Phản hồi giáo viên', 'Writing và speaking của riêng bạn']];
    return `${heading('Nền tảng giáo dục', teacher ? 'Quản lý lớp học theo quyền Teacher và phạm vi tổ chức.' : 'Không gian học viên với dữ liệu được giới hạn theo tài khoản.')}<section class="education-role-strip section"><div><span>Vai trò đã xác thực</span><b>${EducationPermissionService.label()}</b></div><p>${teacher ? 'Bạn có thể quản lý các lớp mình phụ trách.' : 'Bạn không có quyền mở roster hoặc dashboard của người khác.'}</p></section><section class="education-launch-grid section">${entries.map(([view, icon, title, subtitle]) => `<button data-view="${view}"><span>${icon}</span><b>${title}</b><small>${subtitle}</small></button>`).join('')}</section>`;
  }

  function organizationView() {
    if (!EducationPermissionService.can('manage_class')) {
      const invitations = OrganizationService.myMemberships();
      return `${heading('Lời mời vào lớp', 'Chỉ bạn mới có thể chấp nhận lời mời gửi tới tài khoản này.')}<section class="section"><div class="education-context"><p>${EducationPlatformCloudService.ready() ? 'Cập nhật để kiểm tra lời mời mới.' : 'Cần liên kết Supabase để nhận lời mời từ trung tâm.'}</p><button class="btn secondary" data-education-sync ${EducationPlatformCloudService.ready() ? '' : 'disabled'}>↻ Cloud</button></div></section><section class="education-roster card section">${invitations.map((member) => `<article><span class="status-dot ${member.status}"></span><div><b>Lớp ${escapeHtml(member.classId)}</b><small>${member.status === 'active' ? 'Đã tham gia' : member.status === 'removed' ? 'Đã từ chối' : 'Đang chờ phản hồi'}</small></div>${member.status === 'invited' ? `<div class="action-row"><button class="btn primary" data-class-invitation="${member.id}" data-decision="active">Chấp nhận</button><button class="btn secondary" data-class-invitation="${member.id}" data-decision="removed">Từ chối</button></div>` : ''}</article>`).join('') || '<div class="empty-state"><h2>Chưa có lời mời</h2><p>Giáo viên cần dùng đúng Supabase user UUID của bạn.</p></div>'}</section>`;
    }
    const selected = OrganizationService.selectedClass(); const members = OrganizationService.members();
    return `${heading('Trường & lớp học', 'Tạo đơn vị School/Center, lớp học và mời học viên bằng UUID tài khoản cloud.')}<div class="education-two-column section"><form id="educationOrganizationForm" class="card compact-form"><h2>Tạo đơn vị</h2><label>Tên trường / trung tâm<input name="name" required maxlength="120"></label><label>Loại<select name="type"><option value="center">Center</option><option value="school">School</option></select></label><button class="btn primary" type="submit">Tạo đơn vị</button></form><form id="educationClassForm" class="card compact-form"><h2>Tạo lớp</h2><label>Tên lớp<input name="name" required maxlength="120"></label><label>Mã lớp<input name="code" maxlength="40" placeholder="Tự tạo nếu để trống"></label><button class="btn primary" type="submit" ${OrganizationService.all().length ? '' : 'disabled'}>Tạo lớp</button></form></div>${OrganizationService.all().length ? `<section class="section">${selector()}</section>` : ''}${selected ? `<section class="card section roster-panel"><div class="section-heading"><div><p class="eyebrow">${escapeHtml(selected.code)}</p><h2 class="section-title">${escapeHtml(selected.name)}</h2></div><span class="level-pill">${members.length} học viên</span></div><form id="educationStudentForm" class="inline-education-form"><input name="studentId" required placeholder="Supabase user UUID"><input name="displayName" maxlength="100" placeholder="Tên hiển thị"><button class="btn secondary">Gửi lời mời</button></form><div class="education-roster">${members.map((member) => `<article><span class="status-dot ${member.status}"></span><div><b>${escapeHtml(member.displayName)}</b><small>${escapeHtml(member.studentId || member.studentCode)} · ${member.status === 'active' ? 'Đã tham gia' : 'Đang chờ'}</small></div></article>`).join('') || '<p class="subtle">Chưa có học viên. Dữ liệu học chỉ mở sau khi học viên chấp nhận.</p>'}</div></section>` : '<section class="empty-state section"><h2>Hãy tạo lớp đầu tiên</h2><p>Một lớp luôn thuộc một School hoặc Center.</p></section>'}`;
  }

  function dashboardView() {
    if (!TeacherDashboardService.available()) return denied('Dashboard giáo viên');
    const currentClass = OrganizationService.selectedClass(); const analytics = TeacherDashboardService.analytics(); const rows = TeacherDashboardService.rows();
    return `${heading('Dashboard giáo viên', 'Snapshot an toàn: tiến độ, lỗi học, thời gian và kỹ năng yếu.')}<section class="section">${selector()}</section><section class="education-metrics section"><div><span>Học viên active</span><b>${analytics.students}</b></div><div><span>Tiến độ trung bình</span><b>${analytics.averageProgress}%</b></div><div><span>Thời gian học</span><b>${analytics.studyMinutes}′</b></div><div><span>Lỗi cần xử lý</span><b>${analytics.mistakeCount}</b></div></section><section class="card section teacher-table-wrap"><div class="section-heading"><h2 class="section-title">${escapeHtml(currentClass?.name || 'Chưa chọn lớp')}</h2><button class="btn secondary" data-education-summaries ${EducationPlatformCloudService.ready() && rows.length ? '' : 'disabled'}>Cập nhật snapshot</button></div><table class="teacher-data-table"><thead><tr><th>Học viên</th><th>Tiến độ</th><th>Lỗi</th><th>Thời gian</th><th>Kỹ năng yếu</th></tr></thead><tbody>${rows.map((item) => `<tr><td><b>${escapeHtml(item.displayName)}</b></td><td><span class="compact-progress"><i style="width:${item.progress}%"></i></span>${item.progress}%</td><td>${item.mistakeCount}</td><td>${item.studyMinutes} phút</td><td>${escapeHtml(item.weakSkill)}</td></tr>`).join('') || '<tr><td colspan="5">Chưa có học viên active hoặc chưa có snapshot.</td></tr>'}</tbody></table></section><section class="security-principle section"><b>Giới hạn dữ liệu</b><p>Dashboard không đọc nhật ký, chat, bản thu âm hoặc nội dung cá nhân thô. Mọi snapshot cloud cần liên kết/lớp active và được RLS kiểm tra.</p></section>`;
  }

  function assignmentsView() {
    if (!EducationPermissionService.can('assign_content')) { const items = EducationAssignmentService.mine(); return `${heading('Bài được giao', 'Lesson, vocabulary và test dành cho chính tài khoản này.')}<section class="assignment-list section">${renderAssignments(items, false)}</section>`; }
    const selectedClass = OrganizationService.selectedClass(); const members = OrganizationService.members().filter((item) => item.status === 'active');
    return `${heading('Assignment System', 'Giao lesson, vocabulary hoặc test cho cả lớp hay một học viên đã liên kết.')}<section class="section">${selector()}</section><form id="educationAssignmentForm" class="card section education-form-grid"><label>Loại<select name="type">${data.assignmentTypes.map((item) => `<option value="${item}">${item}</option>`).join('')}</select></label><label>Người nhận<select name="studentId"><option value="">Cả lớp</option>${members.map((item) => `<option value="${item.studentId}">${escapeHtml(item.displayName)}</option>`).join('')}</select></label><label class="wide">Tên bài<input name="title" required maxlength="180"></label><label>Mã nội dung<input name="sourceId" maxlength="160" placeholder="lesson / vocabulary / test ID"></label><label>Hạn hoàn thành<input name="dueDate" type="date"></label><label class="wide">Hướng dẫn<textarea name="instructions" rows="3" maxlength="2000"></textarea></label><button class="btn primary wide" ${selectedClass ? '' : 'disabled'}>Giao bài</button></form><section class="assignment-list section">${renderAssignments(EducationAssignmentService.forClass(), true)}</section>`;
  }
  function renderAssignments(items, teacher) { return items.length ? items.map((item) => `<article><div><span>${escapeHtml(item.type)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.instructions || 'Không có hướng dẫn bổ sung.')}</p></div><aside><b>${item.dueDate ? `Hạn ${escapeHtml(item.dueDate)}` : 'Không thời hạn'}</b><small>${teacher ? (item.studentId ? 'Cá nhân' : 'Cả lớp') : escapeHtml(item.status || 'assigned')}</small></aside></article>`).join('') : '<div class="empty-state"><h2>Chưa có bài được giao</h2><p>Bài học sẽ xuất hiện ở đây và vẫn được giới hạn theo tài khoản.</p></div>'; }

  function feedbackView() {
    if (!EducationPermissionService.can('review_submission')) { const items = EducationFeedbackService.mine(); return `${heading('Phản hồi giáo viên', 'Nhận xét writing và speaking dành cho chính tài khoản này.')}<section class="feedback-list section">${renderFeedback(items)}</section>`; }
    const members = OrganizationService.members().filter((item) => item.status === 'active');
    return `${heading('Teacher Feedback', 'Nhận xét có cấu trúc cho writing và speaking.')}<section class="section">${selector()}</section><form id="educationFeedbackForm" class="card section education-form-grid"><label>Học viên<select name="studentId" required><option value="">Chọn học viên</option>${members.map((item) => `<option value="${item.studentId}">${escapeHtml(item.displayName)}</option>`).join('')}</select></label><label>Loại<select name="type"><option value="writing">Writing</option><option value="speaking">Speaking</option></select></label><label class="wide">Điểm tốt<textarea name="strengths" rows="2" maxlength="2000"></textarea></label><label class="wide">Cần sửa<textarea name="improvements" rows="2" maxlength="2000" required></textarea></label><label class="wide">Bài tập tiếp theo<textarea name="nextExercise" rows="2" maxlength="2000"></textarea></label><button class="btn primary wide" ${members.length ? '' : 'disabled'}>Gửi nhận xét</button></form><section class="feedback-list section">${renderFeedback(EducationFeedbackService.all())}</section>`;
  }
  function renderFeedback(items) { return items.length ? items.map((item) => `<article><header><span>${escapeHtml(item.type)}</span><time>${escapeHtml(String(item.createdAt || '').slice(0, 10))}</time></header>${item.strengths ? `<p class="feedback-good"><b>Điểm tốt</b>${escapeHtml(item.strengths)}</p>` : ''}<p class="feedback-improve"><b>Cần sửa</b>${escapeHtml(item.improvements)}</p>${item.nextExercise ? `<p><b>Bài tiếp theo</b>${escapeHtml(item.nextExercise)}</p>` : ''}</article>`).join('') : '<div class="empty-state"><h2>Chưa có nhận xét</h2><p>Phản hồi writing và speaking sẽ được lưu theo đúng người nhận.</p></div>'; }

  function courseBuilderView() {
    if (!EducationPermissionService.can('build_course')) return denied('Course Builder');
    const courses = CourseBuilderService.all();
    return `${heading('Course Builder', 'Dựng khóa Business Korean, Travel Korean, TOPIK hoặc khóa tùy chỉnh.')}<section class="course-template-grid section">${data.courseTemplates.map((item) => `<article><span>${escapeHtml(item.difficulty)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><button class="btn secondary" data-course-template="${item.id}">Dùng mẫu này</button></article>`).join('')}</section><form id="educationCourseForm" class="card section education-form-grid"><label class="wide">Tên khóa<input name="title" required maxlength="180"></label><label>Track<select name="track"><option value="custom">Custom</option><option value="business">Business</option><option value="travel">Travel</option><option value="topik">TOPIK</option></select></label><label>Độ khó<select name="difficulty">${data.difficulties.map((item) => `<option>${item}</option>`).join('')}</select></label><label class="wide">Mô tả<textarea name="description" rows="2" maxlength="1000"></textarea></label><button class="btn primary wide">Tạo khóa nháp</button></form><section class="course-builder-list section">${courses.map((course) => `<article><header><div><span>${escapeHtml(course.track)} · ${escapeHtml(course.difficulty)}</span><h2>${escapeHtml(course.title)}</h2></div><em class="quality-status ${course.status}">${escapeHtml(course.status)}</em></header><p>${escapeHtml(course.description)}</p><div class="course-items">${CourseBuilderService.items(course.id).map((item) => `<p><span>${escapeHtml(item.type)}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.difficulty)} · ${item.verified ? 'verified' : item.status}</small></p>`).join('') || '<p class="subtle">Chưa có nội dung.</p>'}</div><form data-course-item="${course.id}" class="inline-course-item"><input name="title" required placeholder="Tên nội dung"><select name="type">${data.contentTypes.map((type) => `<option value="${type}">${type}</option>`).join('')}</select><input name="sourceId" placeholder="Content ID"><button class="btn secondary">Thêm</button></form></article>`).join('') || '<div class="empty-state"><h2>Chưa có khóa học</h2><p>Dùng template hoặc tạo khóa nháp đầu tiên.</p></div>'}</section>`;
  }

  function analyticsView() {
    if (!TeacherDashboardService.available()) return denied('Báo cáo tổ chức');
    const classes = OrganizationService.classes();
    return `${heading('Báo cáo tiến độ lớp', 'So sánh snapshot tổng hợp giữa các lớp thuộc đơn vị đang chọn.')}<section class="section">${selector()}</section><section class="org-analytics section">${classes.map((classroom) => { const value = TeacherDashboardService.analytics(classroom.id); return `<article><header><div><small>${escapeHtml(classroom.code)}</small><h2>${escapeHtml(classroom.name)}</h2></div><b>${value.averageProgress}%</b></header><div class="analytics-track"><i style="width:${value.averageProgress}%"></i></div><dl><div><dt>Học viên</dt><dd>${value.students}</dd></div><div><dt>Phút học</dt><dd>${value.studyMinutes}</dd></div><div><dt>Lỗi</dt><dd>${value.mistakeCount}</dd></div></dl><p>Kỹ năng cần ưu tiên: <strong>${escapeHtml(Object.entries(value.weakSkills).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Chưa đủ dữ liệu')}</strong></p></article>`; }).join('') || '<div class="empty-state"><h2>Chưa có lớp để báo cáo</h2><p>Tạo lớp và chờ học viên chấp nhận trước khi tổng hợp.</p></div>'}</section>`;
  }

  function contentView() {
    const manage = EducationPermissionService.can('manage_content'); const review = EducationPermissionService.can('review_content');
    return `${heading('Nội dung & chất lượng', 'Một quy trình chung cho lesson, grammar, vocabulary, audio và test.')}<section class="content-quality-summary section"><article><span>Loại nội dung</span><b>5</b><p>Lesson · Grammar · Vocabulary · Audio · Test</p></article><article><span>Metadata bắt buộc</span><b>3</b><p>Verified · Difficulty · Status</p></article><article><span>Quyền hiện tại</span><b>${manage ? 'Manage' : review ? 'Review' : 'Read'}</b><p>Role: ${EducationPermissionService.label()}</p></article></section><section class="quality-workflow section"><div><span>1</span><b>Draft</b><small>Người soạn tạo nội dung</small></div><i></i><div><span>2</span><b>In review</b><small>Reviewer kiểm tra</small></div><i></i><div><span>3</span><b>Approved</b><small>Chỉ khi verified</small></div></section><section class="card section"><h2 class="section-title">Content Management</h2><p class="subtle">CMS hiện có tiếp tục là nguồn quản lý nội dung. Course Builder chỉ tham chiếu content ID, không sao chép toàn bộ curriculum vào component.</p><div class="action-row">${manage ? '<button class="btn primary" data-view="admin-content">Mở Content Admin</button>' : ''}${review ? '<button class="btn secondary" data-view="review-dashboard">Mở Quality Review</button>' : ''}${!manage && !review ? '<span class="support-message">Student không có quyền sửa hoặc duyệt nội dung.</span>' : ''}</div></section>`;
  }

  global.EducationPermissionService = EducationPermissionService;
  global.OrganizationService = OrganizationService;
  global.TeacherDashboardService = TeacherDashboardService;
  global.EducationAssignmentService = EducationAssignmentService;
  global.EducationFeedbackService = EducationFeedbackService;
  global.CourseBuilderService = CourseBuilderService;
  global.EducationPlatformCloudService = EducationPlatformCloudService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'education-platform': platformView, 'teacher-dashboard': dashboardView, 'organization-center': organizationView, 'education-assignments': assignmentsView, 'education-feedback': feedbackView, 'course-builder': courseBuilderView, 'organization-analytics': analyticsView, 'education-content': contentView };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (state.currentView === 'profile' && !document.querySelector('[data-education-platform-entry]')) {
      document.querySelector('.profile-head, .personal-profile, .profile-quick-actions, .profile-action-list, #app > .section')?.insertAdjacentHTML('afterend', `<section class="education-profile-entry section" data-education-platform-entry><div><span>${EducationPermissionService.label()}</span><h2>Nền tảng giáo dục</h2><p>${TeacherDashboardService.available() ? 'Lớp học, bài giao, phản hồi và báo cáo.' : 'Bài giao và phản hồi của bạn.'}</p></div><button class="btn primary" data-open-education-platform>Mở</button></section>`);
    }
    document.querySelector('[data-open-education-platform]')?.addEventListener('click', () => setView('education-platform'));
    document.querySelector('[data-education-org]')?.addEventListener('change', (event) => { OrganizationService.selectOrganization(event.currentTarget.value); render(); });
    document.querySelector('[data-education-class]')?.addEventListener('change', (event) => { OrganizationService.selectClass(event.currentTarget.value); render(); });
    document.querySelector('[data-education-sync]')?.addEventListener('click', async () => { try { await EducationPlatformCloudService.refresh(); toast('Đã cập nhật dữ liệu lớp học từ cloud.'); render(); } catch (error) { toast(error?.message || 'Không thể đồng bộ dữ liệu giáo dục.'); } });
    document.querySelector('[data-education-summaries]')?.addEventListener('click', async () => { try { await EducationPlatformCloudService.refreshSummaries(); toast('Đã cập nhật snapshot tiến độ.'); render(); } catch (error) { toast(error?.message || 'Không thể đọc snapshot.'); } });
    document.querySelectorAll('[data-class-invitation]').forEach((button) => { button.onclick = async () => { try { await EducationPlatformCloudService.respondToInvitation(button.dataset.classInvitation, button.dataset.decision); toast(button.dataset.decision === 'active' ? 'Đã tham gia lớp.' : 'Đã từ chối lời mời.'); render(); } catch (error) { toast(error?.message || 'Không thể phản hồi lời mời.'); } }; });
    const orgForm = document.getElementById('educationOrganizationForm'); if (orgForm) orgForm.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(orgForm); try { const payload = { name: values.get('name'), type: values.get('type') }; EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.createOrganization(payload) : OrganizationService.createOrganization(payload); toast('Đã tạo đơn vị giáo dục.'); render(); } catch (error) { toast(error?.message || 'Không thể tạo đơn vị.'); } };
    const classForm = document.getElementById('educationClassForm'); if (classForm) classForm.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(classForm); try { const payload = { organizationId: OrganizationService.selectedOrganization()?.id, name: values.get('name'), code: values.get('code') }; EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.createClass(payload) : OrganizationService.createClass(payload); toast('Đã tạo lớp học.'); render(); } catch (error) { toast(error?.message || 'Không thể tạo lớp.'); } };
    const studentForm = document.getElementById('educationStudentForm'); if (studentForm) studentForm.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(studentForm); const payload = { classId: OrganizationService.selectedClass()?.id, studentId: values.get('studentId'), displayName: values.get('displayName') }; if (EducationPlatformCloudService.ready() && !isUuid(payload.studentId)) return toast('Hãy nhập đúng Supabase user UUID.'); try { EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.inviteStudent(payload) : OrganizationService.inviteStudent(payload); toast('Đã gửi lời mời vào lớp.'); render(); } catch (error) { toast(error?.message || 'Không thể mời học viên.'); } };
    const assignmentForm = document.getElementById('educationAssignmentForm'); if (assignmentForm) assignmentForm.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(assignmentForm); const payload = { classId: OrganizationService.selectedClass()?.id, studentId: values.get('studentId'), type: values.get('type'), title: values.get('title'), sourceId: values.get('sourceId'), dueDate: values.get('dueDate'), instructions: values.get('instructions') }; try { EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.createAssignment(payload) : EducationAssignmentService.create(payload); toast('Đã giao bài.'); render(); } catch (error) { toast(error?.message || 'Không thể giao bài.'); } };
    const feedbackForm = document.getElementById('educationFeedbackForm'); if (feedbackForm) feedbackForm.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(feedbackForm); const payload = { studentId: values.get('studentId'), type: values.get('type'), strengths: values.get('strengths'), improvements: values.get('improvements'), nextExercise: values.get('nextExercise') }; try { EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.createFeedback(payload) : EducationFeedbackService.create(payload); toast('Đã lưu phản hồi giáo viên.'); render(); } catch (error) { toast(error?.message || 'Không thể lưu phản hồi.'); } };
    const courseForm = document.getElementById('educationCourseForm'); if (courseForm) courseForm.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(courseForm); const payload = { organizationId: OrganizationService.selectedOrganization()?.id || '', title: values.get('title'), track: values.get('track'), difficulty: values.get('difficulty'), description: values.get('description') }; try { EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.createCourse(payload) : CourseBuilderService.create(payload); toast('Đã tạo khóa học ở trạng thái draft.'); render(); } catch (error) { toast(error?.message || 'Không thể tạo khóa học.'); } };
    document.querySelectorAll('[data-course-template]').forEach((button) => { button.onclick = async () => { try { EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.createCourseFromTemplate(button.dataset.courseTemplate) : CourseBuilderService.fromTemplate(button.dataset.courseTemplate); toast('Đã tạo khóa học từ template.'); render(); } catch (error) { toast(error?.message || 'Không thể dùng template này.'); } }; });
    document.querySelectorAll('[data-course-item]').forEach((form) => { form.onsubmit = async (event) => { event.preventDefault(); const values = new FormData(form); const payload = { title: values.get('title'), type: values.get('type'), sourceId: values.get('sourceId') }; try { EducationPlatformCloudService.ready() ? await EducationPlatformCloudService.addCourseItem(form.dataset.courseItem, payload) : CourseBuilderService.addItem(form.dataset.courseItem, payload); toast('Đã thêm nội dung ở trạng thái draft.'); render(); } catch (error) { toast(error?.message || 'Không thể thêm nội dung.'); } }; });
  };
  render();
})(window);
