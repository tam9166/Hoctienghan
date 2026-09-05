/* Tiếng Hàn - TamHoanq — long-term learning ecosystem */
(function buildLongTermEcosystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  const content = global.KLEARN_LONG_TERM_DATA;
  if (!app || !content) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, AccessControlService, DictionaryService } = app;
  const now = () => new Date().toISOString();
  const today = () => now().slice(0, 10);
  const uid = () => state.currentUser?.id || '';
  const makeId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const list = (key) => userScoped(key);
  const save = (key, items, limit = 300) => saveUserScoped(key, items, limit);
  const runtime = state.longTerm || (state.longTerm = { strategySection: 'listening', selectedGoal: 'study-korea', selectedMonths: 6, teacherReviewResult: null, teacherWorkspaceLoaded: false });

  const RealGoalPlannerService = {
    current() { return list(STORAGE_KEYS.realGoalPlans)[0] || null; },
    generate(goalId, months, dailyMinutes = 20) {
      const goal = content.goalTemplates.find((item) => item.id === goalId) || content.goalTemplates[0];
      const duration = [3, 6, 12].includes(Number(months)) ? Number(months) : 6;
      const minutes = Math.max(10, Math.min(120, Number(dailyMinutes) || 20));
      const phases = content.roadmapPhases[duration].map((phase, index) => ({ ...phase, focus: goal.focus[index % goal.focus.length], weeklyMinutes: minutes * 6, status: index === 0 ? 'active' : 'planned' }));
      return { id: makeId('goal'), userId: uid(), goalId: goal.id, title: goal.title, months: duration, dailyMinutes: minutes, outcome: goal.outcomes[duration], phases, createdAt: now(), updatedAt: now() };
    },
    save(input) { const plan = this.generate(input.goalId, input.months, input.dailyMinutes); save(STORAGE_KEYS.realGoalPlans, [plan], 3); return plan; }
  };

  const LearningJournalService = {
    all() { return list(STORAGE_KEYS.learningJournal); },
    add(input = {}) {
      if (!uid()) return null;
      const learned = String(input.learned || '').trim(); const difficulty = String(input.difficulty || '').trim(); const nextGoal = String(input.nextGoal || '').trim();
      if (!learned && !difficulty && !nextGoal) return null;
      const entry = { id: makeId('journal'), userId: uid(), date: String(input.date || today()), learned: learned.slice(0, 1200), difficulty: difficulty.slice(0, 1200), nextGoal: nextGoal.slice(0, 800), createdAt: now(), updatedAt: now() };
      save(STORAGE_KEYS.learningJournal, [entry, ...this.all()], 365); return entry;
    },
    summary() { const entries = this.all(); return { count: entries.length, thisMonth: entries.filter((item) => String(item.date || '').slice(0, 7) === today().slice(0, 7)).length, latest: entries[0] || null }; }
  };

  const TeacherFeedbackService = {
    all() { return list(STORAGE_KEYS.teacherFeedback); },
    evaluate(input = {}) {
      const submission = String(input.submission || '').trim(); const type = ['writing', 'speaking', 'sentence'].includes(input.type) ? input.type : 'sentence';
      if (!submission) return null;
      const hasHangul = /[가-힣]/.test(submission); const hasSpacing = /\s/.test(submission); const polite = /(요|니다|니까)[.!?]?$/u.test(submission); const particle = /(은|는|이|가|을|를|에|에서|와|과|도|만)/u.test(submission);
      const strengths = [hasHangul && 'Đã sử dụng Hangul', hasSpacing && 'Có phân tách cụm từ rõ', polite && 'Đuôi câu lịch sự phù hợp', particle && 'Đã dùng trợ từ trong câu'].filter(Boolean);
      const improvements = [!hasHangul && 'Viết phần trả lời bằng Hangul', !hasSpacing && submission.length > 6 && 'Kiểm tra khoảng cách giữa các cụm', !polite && 'Thống nhất đuôi câu lịch sự 해요체 hoặc 합니다체', !particle && 'Kiểm tra trợ từ chỉ chủ đề/chủ ngữ/tân ngữ'].filter(Boolean);
      if (!improvements.length) improvements.push(type === 'sentence' ? 'Thử mở rộng câu bằng thời gian hoặc địa điểm' : 'Thử thêm một ý giải thích để nội dung tự nhiên hơn');
      if (!strengths.length) strengths.push('Đã bắt đầu diễn đạt ý của riêng bạn');
      const score = Math.min(100, 35 + Number(hasHangul) * 25 + Number(hasSpacing) * 10 + Number(polite) * 20 + Number(particle) * 10);
      return { id: makeId('feedback'), userId: uid(), type, prompt: String(input.prompt || '').slice(0, 500), submission: submission.slice(0, 2500), score, strengths, improvements, nextExercise: type === 'speaking' ? 'Nói lại cùng nội dung bằng 2 câu ngắn, giữ một mức độ lịch sự.' : type === 'writing' ? 'Viết lại đoạn và thêm một câu nêu lý do bằng -아서/어서.' : 'Viết thêm một câu cùng mẫu nhưng đổi chủ ngữ và địa điểm.', reviewer: 'teacher-rubric', createdAt: now(), updatedAt: now() };
    },
    save(result) { if (!result) return null; save(STORAGE_KEYS.teacherFeedback, [result, ...this.all()], 200); return result; },
    review(input) { return this.save(this.evaluate(input)); }
  };

  const ManualReviewQueueService = {
    all() { return list(STORAGE_KEYS.manualReviewQueue); },
    active() { return this.all().filter((item) => item.status !== 'skipped').sort((a, b) => String(a.reviewOn).localeCompare(String(b.reviewOn))); },
    add(input = {}) {
      const type = ['vocabulary', 'grammar', 'sentence'].includes(input.type) ? input.type : 'vocabulary'; const body = String(input.content || '').trim();
      if (!uid() || !body) return null;
      const fingerprint = `${type}:${String(input.sourceId || body).toLocaleLowerCase()}`; const previous = this.all().find((item) => item.fingerprint === fingerprint);
      const item = { ...(previous || {}), id: previous?.id || makeId('manual-review'), userId: uid(), fingerprint, type, title: String(input.title || body).slice(0, 160), content: body.slice(0, 1200), sourceId: String(input.sourceId || ''), status: input.status || 'today', reviewOn: input.reviewOn || today(), updatedAt: now(), createdAt: previous?.createdAt || now() };
      save(STORAGE_KEYS.manualReviewQueue, [item, ...this.all().filter((entry) => entry.id !== item.id)], 300); return item;
    },
    decide(id, decision) {
      const allowed = ['today', 'later', 'skipped']; if (!allowed.includes(decision)) return null;
      const items = this.all(); const item = items.find((entry) => entry.id === id); if (!item) return null;
      const later = new Date(); later.setDate(later.getDate() + 3); item.status = decision; item.reviewOn = decision === 'today' ? today() : decision === 'later' ? later.toISOString().slice(0, 10) : item.reviewOn; item.updatedAt = now(); save(STORAGE_KEYS.manualReviewQueue, items, 300); return item;
    },
    dueToday() { return this.active().filter((item) => item.reviewOn <= today()); }
  };

  const TeacherWorkspaceService = {
    isTeacher() { return ['teacher', 'admin'].includes(AccessControlService?.role?.()); },
    records() { return list(STORAGE_KEYS.teacherWorkspace); },
    addLearner(input = {}) {
      if (!this.isTeacher()) return null;
      const studentCode = String(input.studentCode || '').trim(); if (!studentCode) return null;
      const record = { id: makeId('teacher-link'), teacherId: uid(), studentCode: studentCode.slice(0, 80), displayName: String(input.displayName || 'Học viên').slice(0, 100), status: 'pending', progress: null, assignments: [], comments: [], createdAt: now(), updatedAt: now() };
      save(STORAGE_KEYS.teacherWorkspace, [record, ...this.records()], 100); return record;
    },
    addAssignment(studentCode, input = {}) {
      if (!this.isTeacher()) return null;
      const records = this.records(); const learner = records.find((item) => item.studentCode === studentCode && item.teacherId === uid()); if (!learner) return null;
      const assignment = { id: makeId('assignment'), title: String(input.title || '').trim().slice(0, 180), instructions: String(input.instructions || '').trim().slice(0, 1200), dueDate: String(input.dueDate || ''), status: 'assigned', createdAt: now() }; if (!assignment.title) return null;
      learner.assignments = [assignment, ...(learner.assignments || [])]; learner.updatedAt = now(); save(STORAGE_KEYS.teacherWorkspace, records, 100); return assignment;
    },
    addComment(studentCode, message) {
      if (!this.isTeacher()) return null;
      const records = this.records(); const learner = records.find((item) => item.studentCode === studentCode && item.teacherId === uid()); const text = String(message || '').trim(); if (!learner || !text) return null;
      const comment = { id: makeId('teacher-comment'), message: text.slice(0, 1500), createdAt: now() }; learner.comments = [comment, ...(learner.comments || [])]; learner.updatedAt = now(); save(STORAGE_KEYS.teacherWorkspace, records, 100); return comment;
    },
    canRead(record) { return Boolean(record && this.isTeacher() && record.teacherId === uid()); }
  };

  const CommunityFoundationService = {
    all() { return list(STORAGE_KEYS.communityProgress); },
    joined(eventId) { return this.all().find((item) => item.eventId === eventId) || null; },
    join(eventId) { const event = content.communityEvents.find((item) => item.id === eventId); if (!event || !uid()) return null; const previous = this.joined(eventId); const item = previous || { id: makeId('community'), userId: uid(), eventId, progress: 0, joinedAt: now(), updatedAt: now() }; save(STORAGE_KEYS.communityProgress, [item, ...this.all().filter((entry) => entry.eventId !== eventId)], 100); return item; },
    sharingPreview() { const progress = global.AchievementService?.all?.() || []; return { achievements: progress.filter((item) => item.unlockedAt).length, generatedLocally: true }; }
  };

  function heading(back, eyebrow, title, subtitle) { return `<section class="section page-heading"><button class="back-link" data-view="${back}">← Quay lại</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(subtitle)}</p></section>`; }
  function strategyCenterView() {
    const selected = content.strategyModules.find((item) => item.id === runtime.strategySection) || content.strategyModules[0];
    return `${heading('topik', 'Không dùng AI · chiến thuật có cấu trúc', 'TOPIK Strategy Center', 'Chuẩn bị cách làm bài trước khi luyện đề; dữ liệu điểm vẫn đến từ các bài bạn đã làm.')}<nav class="strategy-center-tabs section">${content.strategyModules.map((item) => `<button class="${item.id === selected.id ? 'active' : ''}" data-strategy-center="${item.id}"><span>${item.icon}</span><b>${escapeHtml(item.title)}</b></button>`).join('')}</nav><section class="strategy-center-detail section"><article><p class="eyebrow">${escapeHtml(selected.title)}</p><h2>${escapeHtml(selected.summary)}</h2><ol>${selected.steps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol></article><aside><h3>Lỗi cần tránh</h3>${selected.mistakes.map((item) => `<p><span>!</span>${escapeHtml(item)}</p>`).join('')}</aside></section><section class="strategy-center-footer section"><div><b>Cần chiến thuật theo từng dạng câu?</b><small>Strategy Lab liên kết trực tiếp với ngân hàng bài tập hiện tại.</small></div><button class="btn primary" data-view="strategy-lab">Mở Strategy Lab</button></section>`;
  }
  function goalPlannerView() {
    const current = RealGoalPlannerService.current(); const preview = RealGoalPlannerService.generate(runtime.selectedGoal, runtime.selectedMonths, current?.dailyMinutes || state.currentUser?.studyMinutesPerDay || 20); const goal = content.goalTemplates.find((item) => item.id === preview.goalId);
    return `${heading('profile', 'Mục tiêu đời thật', 'Real Goal Planner', 'Chọn đích đến và quỹ thời gian; roadmap được tạo bằng quy tắc rõ ràng, không dùng AI.')}<form id="realGoalForm" class="real-goal-form section"><fieldset><legend>1. Bạn học để làm gì?</legend><div class="real-goal-options">${content.goalTemplates.map((item) => `<label><input type="radio" name="goalId" value="${item.id}" ${item.id === preview.goalId ? 'checked' : ''}><span><i>${item.icon}</i><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.focus[0])}</small></span></label>`).join('')}</div></fieldset><fieldset><legend>2. Chọn nhịp kế hoạch</legend><div class="goal-duration-options">${[3,6,12].map((months) => `<label><input type="radio" name="months" value="${months}" ${months === preview.months ? 'checked' : ''}><span><b>${months} tháng</b><small>${months === 3 ? 'Tập trung' : months === 6 ? 'Cân bằng' : 'Bền vững'}</small></span></label>`).join('')}</div><label class="goal-minutes">Phút mỗi ngày<input type="number" name="dailyMinutes" min="10" max="120" step="5" value="${preview.dailyMinutes}"></label></fieldset><button class="btn primary full" type="submit">Lưu roadmap ${preview.months} tháng</button></form><section class="goal-roadmap section"><div class="section-heading"><div><p class="eyebrow">${escapeHtml(goal.title)}</p><h2 class="section-title">${escapeHtml(preview.outcome)}</h2></div>${current ? '<span class="sync-status">Đã lưu</span>' : '<span class="sync-status">Bản xem trước</span>'}</div>${preview.phases.map((phase, index) => `<article class="goal-roadmap-phase ${phase.status}"><span>${index + 1}</span><div><small>${phase.range}</small><b>${escapeHtml(phase.title)}</b><p>${escapeHtml(phase.focus)} · ${phase.weeklyMinutes} phút/tuần</p></div><em>${phase.ratio}%</em></article>`).join('')}</section>`;
  }
  function journalView() {
    const summary = LearningJournalService.summary();
    return `${heading('profile', 'Dữ liệu riêng tư theo tài khoản', 'Nhật ký học tập', 'Ghi ngắn điều đã học, khó khăn và mục tiêu tiếp theo. Chỉ bạn mới xem được nhật ký này.')}<section class="journal-overview section"><div><b>${summary.count}</b><span>Tổng ghi chép</span></div><div><b>${summary.thisMonth}</b><span>Trong tháng này</span></div><div><b>${summary.latest?.date || '—'}</b><span>Lần gần nhất</span></div></section><form id="learningJournalForm" class="journal-form card section"><label>Ngày<input type="date" name="date" max="${today()}" value="${today()}"></label><label>Hôm nay bạn học gì?<textarea name="learned" maxlength="1200" rows="3" placeholder="Ví dụ: đọc một đoạn TOPIK 1 và ôn 15 từ…"></textarea></label><label>Điều gì còn khó?<textarea name="difficulty" maxlength="1200" rows="3" placeholder="Ghi lại điểm bạn muốn xử lý ở lần sau…"></textarea></label><label>Mục tiêu tiếp theo<input name="nextGoal" maxlength="800" placeholder="Ví dụ: phân biệt 에 và 에서"></label><button class="btn primary full" type="submit">Lưu nhật ký</button></form><section class="journal-list section">${LearningJournalService.all().length ? LearningJournalService.all().map((item) => `<article><time>${escapeHtml(item.date)}</time><div>${item.learned ? `<p><b>Đã học</b>${escapeHtml(item.learned)}</p>` : ''}${item.difficulty ? `<p><b>Khó khăn</b>${escapeHtml(item.difficulty)}</p>` : ''}${item.nextGoal ? `<p><b>Mục tiêu tiếp</b>${escapeHtml(item.nextGoal)}</p>` : ''}</div><button class="text-link" data-open-ai="Dựa trên nhật ký này, hãy gợi ý một bước học tiếp theo ngắn gọn. Đã học: ${escapeHtml(item.learned)}. Khó khăn: ${escapeHtml(item.difficulty)}. Mục tiêu: ${escapeHtml(item.nextGoal)}">Nhờ trợ lý gợi ý</button></article>`).join('') : '<div class="empty-state"><h2>Chưa có ghi chép</h2><p>Nhật ký đầu tiên có thể chỉ cần một câu.</p></div>'}</section>`;
  }
  function teacherReviewView() {
    const result = runtime.teacherReviewResult;
    return `${heading('profile', 'Rubric phản hồi sư phạm', 'Teacher-style Feedback', 'Dùng cho bài viết, transcript đoạn nói hoặc câu tự tạo. Không gửi nội dung cho người khác.')}<form id="teacherFeedbackForm" class="teacher-feedback-form card section"><label>Loại nội dung<select name="type"><option value="sentence">Câu tự tạo</option><option value="writing">Bài viết</option><option value="speaking">Đoạn nói (transcript)</option></select></label><label>Đề bài / bối cảnh<input name="prompt" maxlength="500" placeholder="Bạn đang muốn diễn đạt điều gì?"></label><label>Nội dung tiếng Hàn<textarea name="submission" maxlength="2500" rows="7" required lang="ko" placeholder="여기에 한국어로 써 보세요…"></textarea></label><button class="btn primary full" type="submit">Nhận phản hồi</button></form>${result ? `<section class="teacher-feedback-result section"><div class="teacher-feedback-score"><strong>${result.score}</strong><span>/100</span><small>Rubric hướng dẫn</small></div><div><h2>Điểm tốt</h2>${result.strengths.map((item) => `<p class="feedback-good">✓ ${escapeHtml(item)}</p>`).join('')}</div><div><h2>Cần sửa</h2>${result.improvements.map((item) => `<p class="feedback-improve">→ ${escapeHtml(item)}</p>`).join('')}</div><div class="teacher-next-exercise"><h2>Bài tập tiếp theo</h2><p>${escapeHtml(result.nextExercise)}</p><button class="btn secondary" data-feedback-to-review="${result.id}">Thêm vào hàng ôn</button></div></section>` : ''}<section class="feedback-history section"><h2 class="section-title">Phản hồi gần đây</h2>${TeacherFeedbackService.all().slice(0, 5).map((item) => `<article><span>${item.type === 'writing' ? 'Bài viết' : item.type === 'speaking' ? 'Đoạn nói' : 'Câu tự tạo'}</span><b lang="ko">${escapeHtml(item.submission)}</b><em>${item.score}/100</em></article>`).join('') || '<p class="subtle">Chưa có bài được đánh giá.</p>'}</section>`;
  }
  function manualReviewView() {
    const items = ManualReviewQueueService.all();
    return `${heading('review', 'Tự kiểm soát nội dung ôn', 'Hàng ôn thủ công', 'Tự đưa vocabulary, grammar hoặc câu vào lịch: ôn hôm nay, ôn sau hoặc bỏ qua.')}<section class="manual-review-summary section"><div><b>${ManualReviewQueueService.dueToday().length}</b><span>Đến hạn hôm nay</span></div><div><b>${items.filter((item) => item.status === 'later').length}</b><span>Để ôn sau</span></div><div><b>${items.filter((item) => item.status === 'skipped').length}</b><span>Đã bỏ qua</span></div></section><form id="manualReviewForm" class="manual-review-form card section"><label>Loại<select name="type"><option value="vocabulary">Vocabulary</option><option value="grammar">Grammar</option><option value="sentence">Sentence</option></select></label><label>Nội dung<input name="content" maxlength="1200" required placeholder="학교, 은/는 hoặc một câu cần nhớ"></label><button class="btn primary" type="submit">Thêm vào hàng ôn</button></form><section class="manual-review-list section">${items.length ? items.map((item) => `<article class="${item.status}"><div><span>${item.type}</span><b lang="${item.type === 'vocabulary' || item.type === 'sentence' ? 'ko' : 'vi'}">${escapeHtml(item.title)}</b><small>${item.status === 'today' ? 'Ôn hôm nay' : item.status === 'later' ? `Ôn ngày ${item.reviewOn}` : 'Đã bỏ qua'}</small></div><div><button class="${item.status === 'today' ? 'active' : ''}" data-review-decision="today" data-review-id="${item.id}">Hôm nay</button><button class="${item.status === 'later' ? 'active' : ''}" data-review-decision="later" data-review-id="${item.id}">Ôn sau</button><button class="${item.status === 'skipped' ? 'active' : ''}" data-review-decision="skipped" data-review-id="${item.id}">Bỏ qua</button></div></article>`).join('') : '<div class="empty-state"><h2>Hàng ôn đang trống</h2><p>Thêm một từ, cấu trúc hoặc câu bạn muốn chủ động gặp lại.</p></div>'}</section>`;
  }
  function teacherWorkspaceView() {
    const allowed = TeacherWorkspaceService.isTeacher(); const records = allowed ? TeacherWorkspaceService.records() : [];
    if (!allowed) return `${heading('profile', 'Teacher Account Foundation', 'Không gian giáo viên', 'Quyền này chỉ mở khi Supabase app_metadata.role là teacher hoặc admin.')}<section class="teacher-access-note section"><b>Tài khoản hiện tại là Student</b><p>Học viên không thể mở roster, assignment, tiến độ hay nhận xét của giáo viên khác.</p></section>`;
    return `${heading('profile', 'Role: Teacher', 'Không gian giáo viên', 'Giao bài, xem snapshot tiến độ và nhận xét trong phạm vi học viên đã liên kết.')}<form id="teacherLearnerForm" class="teacher-link-form card section"><label>Mã học viên<input name="studentCode" maxlength="80" required placeholder="Mã do học viên cung cấp"></label><label>Tên hiển thị<input name="displayName" maxlength="100" placeholder="Tên dùng trong lớp"></label><button class="btn primary" type="submit">Gửi liên kết</button></form><section class="teacher-roster section">${records.length ? records.map((record) => `<article><header><div><span>${escapeHtml(record.status)}</span><h2>${escapeHtml(record.displayName)}</h2><small>${escapeHtml(record.studentCode)}</small></div><div class="teacher-progress-mini">${record.progress ? `<b>${Number(record.progress.mastery || 0)}%</b><small>Mastery</small>` : '<b>—</b><small>Chờ liên kết cloud</small>'}</div></header><form data-teacher-assignment="${escapeHtml(record.studentCode)}"><input name="title" required placeholder="Tên bài được giao"><input name="dueDate" type="date"><textarea name="instructions" rows="2" placeholder="Hướng dẫn ngắn"></textarea><button class="btn secondary" type="submit">Giao bài</button></form><form data-teacher-comment="${escapeHtml(record.studentCode)}"><input name="message" required maxlength="1500" placeholder="Nhận xét cho học viên"><button class="btn secondary" type="submit">Lưu nhận xét</button></form><div class="teacher-record-list">${(record.assignments || []).slice(0, 3).map((item) => `<p><b>${escapeHtml(item.title)}</b><span>${item.dueDate ? `Hạn ${item.dueDate}` : 'Không hạn'}</span></p>`).join('')}${(record.comments || []).slice(0, 2).map((item) => `<p><b>Nhận xét</b><span>${escapeHtml(item.message)}</span></p>`).join('')}</div></article>`).join('') : '<div class="empty-state"><h2>Chưa liên kết học viên</h2><p>Chỉ học viên đã chấp nhận liên kết mới có thể cung cấp snapshot tiến độ.</p></div>'}</section><section class="security-principle section"><b>Nguyên tắc riêng tư</b><p>Teacher chỉ được đọc tiến độ tóm tắt của liên kết đã chấp nhận. Journal và dữ liệu cá nhân chi tiết không nằm trong snapshot.</p></section>`;
  }
  function communityView() {
    const preview = CommunityFoundationService.sharingPreview();
    return `${heading('profile', 'Không phải mạng xã hội', 'Community Foundation', 'Challenge, learning event và bản xem trước chia sẻ thành tích — không có feed công khai.')}<section class="community-foundation-grid section">${content.communityEvents.map((event) => { const joined = CommunityFoundationService.joined(event.id); return `<article><span>${event.type === 'challenge' ? 'Challenge' : 'Learning event'}</span><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.description)}</p><div class="bar"><i style="width:${Math.min(100, Math.round(Number(joined?.progress || 0) / event.target * 100))}%"></i></div><small>${joined ? `${joined.progress}/${event.target} · đã tham gia` : `${event.durationDays} ngày · mục tiêu ${event.target}`}</small><button class="btn ${joined ? 'secondary' : 'primary'} full" data-community-join="${event.id}" ${joined ? 'disabled' : ''}>${joined ? 'Đã tham gia' : 'Tham gia'}</button></article>`; }).join('')}</section><section class="achievement-share-preview section"><div><p class="eyebrow">Achievement sharing</p><h2>Thành tích thuộc quyền kiểm soát của bạn</h2><p>${preview.achievements} huy hiệu đã mở. App chỉ tạo bản xem trước cục bộ; không tự đăng hoặc gửi dữ liệu.</p></div><button class="btn secondary" data-view="achievements">Xem huy hiệu</button></section>`;
  }

  function ecosystemLinks() { return `<section class="long-term-entry-grid"><button data-view="real-goal-planner"><span>◎</span><b>Mục tiêu đời thật</b><small>Roadmap 3 / 6 / 12 tháng</small></button><button data-view="learning-journal"><span>日</span><b>Nhật ký học tập</b><small>Ghi điều đã học và khó khăn</small></button><button data-view="teacher-review"><span>✓</span><b>Phản hồi kiểu giáo viên</b><small>Điểm tốt, cần sửa, bài tiếp</small></button><button data-view="manual-review-queue"><span>↻</span><b>Hàng ôn thủ công</b><small>Hôm nay, ôn sau hoặc bỏ qua</small></button><button data-view="community-hub"><span>◇</span><b>Challenge & sự kiện</b><small>Tham gia theo lựa chọn</small></button><button data-view="teacher-workspace"><span>선</span><b>Không gian giáo viên</b><small>Nền tảng role và phân quyền</small></button></section>`; }

  global.RealGoalPlannerService = RealGoalPlannerService;
  global.LearningJournalService = LearningJournalService;
  global.TeacherFeedbackService = TeacherFeedbackService;
  global.ManualReviewQueueService = ManualReviewQueueService;
  global.TeacherWorkspaceService = TeacherWorkspaceService;
  global.CommunityFoundationService = CommunityFoundationService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'topik-strategy-center': strategyCenterView, 'real-goal-planner': goalPlannerView, 'learning-journal': journalView, 'teacher-review': teacherReviewView, 'manual-review-queue': manualReviewView, 'teacher-workspace': teacherWorkspaceView, 'community-hub': communityView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (state.currentView === 'topik' && !document.querySelector('[data-open-strategy-center]')) document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', `<section class="strategy-center-entry section"><div><p class="eyebrow">Không dùng AI</p><h2>TOPIK Strategy Center</h2><p>Nghe · đọc · thời gian · dạng câu · lỗi phổ biến</p></div><button class="btn primary" data-open-strategy-center>Mở trung tâm</button></section>`);
    if (state.currentView === 'profile' && !document.querySelector('.long-term-entry-grid')) document.querySelector('.profile-quick-actions, .profile-action-list, .page-heading')?.insertAdjacentHTML('afterend', ecosystemLinks());
    if (state.currentView === 'review' && !document.querySelector('[data-open-manual-queue]')) document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', `<section class="manual-review-entry section"><div><b>Hàng ôn thủ công</b><small>${ManualReviewQueueService.dueToday().length} mục bạn tự chọn đến hạn hôm nay</small></div><button class="btn secondary" data-open-manual-queue>Mở hàng ôn</button></section>`);
    if (state.currentView === 'dictionary' && state.dictionarySelectedId && !document.querySelector('[data-dictionary-manual-review]')) { const entry = DictionaryService.byId(state.dictionarySelectedId); const detail = document.querySelector('.dictionary-entry'); if (entry && detail) detail.insertAdjacentHTML('beforeend', `<button class="btn secondary" data-dictionary-manual-review="${entry.id}">↻ Thêm vào hàng ôn</button>`); }

    document.querySelector('[data-open-strategy-center]')?.addEventListener('click', () => setView('topik-strategy-center'));
    document.querySelector('[data-open-manual-queue]')?.addEventListener('click', () => setView('manual-review-queue'));
    document.querySelectorAll('.long-term-entry-grid [data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
    document.querySelector('[data-dictionary-manual-review]')?.addEventListener('click', (event) => { const entry = DictionaryService.byId(event.currentTarget.dataset.dictionaryManualReview); ManualReviewQueueService.add({ type: 'vocabulary', sourceId: entry?.id, title: entry?.korean, content: `${entry?.korean || ''} — ${entry?.meanings?.vi || entry?.meaningVi || ''}` }); toast('Đã thêm từ vào hàng ôn thủ công.'); });
    document.querySelectorAll('[data-strategy-center]').forEach((button) => { button.onclick = () => { runtime.strategySection = button.dataset.strategyCenter; render(); }; });
    const goalForm = document.getElementById('realGoalForm'); if (goalForm) { goalForm.onchange = () => { const values = new FormData(goalForm); runtime.selectedGoal = String(values.get('goalId') || runtime.selectedGoal); runtime.selectedMonths = Number(values.get('months')) || 6; render(); }; goalForm.onsubmit = (event) => { event.preventDefault(); const values = new FormData(goalForm); RealGoalPlannerService.save({ goalId: values.get('goalId'), months: values.get('months'), dailyMinutes: values.get('dailyMinutes') }); toast('Đã lưu roadmap đời thật.'); render(); }; }
    const journalForm = document.getElementById('learningJournalForm'); if (journalForm) journalForm.onsubmit = (event) => { event.preventDefault(); const values = new FormData(journalForm); const entry = LearningJournalService.add({ date: values.get('date'), learned: values.get('learned'), difficulty: values.get('difficulty'), nextGoal: values.get('nextGoal') }); if (!entry) return toast('Hãy ghi ít nhất một nội dung.'); toast('Đã lưu nhật ký riêng tư.'); render(); };
    const feedbackForm = document.getElementById('teacherFeedbackForm'); if (feedbackForm) feedbackForm.onsubmit = (event) => { event.preventDefault(); const values = new FormData(feedbackForm); runtime.teacherReviewResult = TeacherFeedbackService.review({ type: values.get('type'), prompt: values.get('prompt'), submission: values.get('submission') }); if (!runtime.teacherReviewResult) return toast('Hãy nhập nội dung cần nhận xét.'); render(); };
    document.querySelector('[data-feedback-to-review]')?.addEventListener('click', () => { const result = TeacherFeedbackService.all().find((item) => item.id === runtime.teacherReviewResult?.id); if (result) { ManualReviewQueueService.add({ type: 'sentence', sourceId: result.id, title: result.submission, content: result.nextExercise }); toast('Đã thêm bài tập tiếp theo vào hàng ôn.'); } });
    const reviewForm = document.getElementById('manualReviewForm'); if (reviewForm) reviewForm.onsubmit = (event) => { event.preventDefault(); const values = new FormData(reviewForm); ManualReviewQueueService.add({ type: values.get('type'), content: values.get('content') }); toast('Đã thêm vào hàng ôn.'); render(); };
    document.querySelectorAll('[data-review-decision]').forEach((button) => { button.onclick = () => { ManualReviewQueueService.decide(button.dataset.reviewId, button.dataset.reviewDecision); render(); }; });
    const learnerForm = document.getElementById('teacherLearnerForm'); if (learnerForm) learnerForm.onsubmit = (event) => { event.preventDefault(); const values = new FormData(learnerForm); const created = TeacherWorkspaceService.addLearner({ studentCode: values.get('studentCode'), displayName: values.get('displayName') }); if (!created) return toast('Không thể tạo liên kết với role hiện tại.'); toast('Đã tạo yêu cầu liên kết học viên.'); render(); };
    document.querySelectorAll('[data-teacher-assignment]').forEach((form) => { form.onsubmit = (event) => { event.preventDefault(); const values = new FormData(form); TeacherWorkspaceService.addAssignment(form.dataset.teacherAssignment, { title: values.get('title'), dueDate: values.get('dueDate'), instructions: values.get('instructions') }); toast('Đã lưu bài giao trong workspace giáo viên.'); render(); }; });
    document.querySelectorAll('[data-teacher-comment]').forEach((form) => { form.onsubmit = (event) => { event.preventDefault(); const values = new FormData(form); TeacherWorkspaceService.addComment(form.dataset.teacherComment, values.get('message')); toast('Đã lưu nhận xét.'); render(); }; });
    document.querySelectorAll('[data-community-join]').forEach((button) => { button.onclick = () => { CommunityFoundationService.join(button.dataset.communityJoin); toast('Đã tham gia thử thách.'); render(); }; });
  };
  render();
})(window);
