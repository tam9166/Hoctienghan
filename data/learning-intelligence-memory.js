/* Tiếng Hàn - TamHoanq · P71A long-term learning intelligence (local-first, additive). */
(function buildLearningIntelligenceMemory(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, getUserSrs, LearnerProfileService, PracticeService, AITutorService, CloudSyncService, setView, render, toast, escapeHtml } = app;
  const memoryKey = STORAGE_KEYS.longTermLearningMemory || 'klearn_long_term_learning_memory';
  const now = () => new Date().toISOString();
  const day = () => now().slice(0, 10);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const clean = (value, limit = 240) => String(value ?? '').trim().slice(0, limit);
  const hash = (value) => { let result = 2166136261; for (const char of String(value)) { result ^= char.charCodeAt(0); result = Math.imul(result, 16777619); } return (result >>> 0).toString(36); };
  const SKILLS = Object.freeze(['vocabulary', 'grammar', 'listening', 'reading', 'speaking', 'writing', 'pronunciation']);
  const SKILL_LABELS = Object.freeze({ vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', reading: 'Đọc', speaking: 'Nói', writing: 'Viết', pronunciation: 'Phát âm' });
  const ROUTES = Object.freeze({ vocabulary: 'vocabulary-hub', grammar: 'grammar-compare', listening: 'listening-studio', reading: 'reading-lab', speaking: 'speaking-hub', writing: 'writing-hub', pronunciation: 'pronunciation' });
  const PRIVATE_KEY = /(password|token|secret|credential|email|phone|address|raw|transcript|audio|message|journal)/i;

  function safeSignal(value, depth = 0) {
    if (depth > 5 || value == null) return value == null ? null : undefined;
    if (typeof value === 'string') return clean(value);
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.slice(0, 20).map((item) => safeSignal(item, depth + 1)).filter((item) => item !== undefined);
    if (typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([key]) => !PRIVATE_KEY.test(key)).slice(0, 30).map(([key, item]) => [clean(key, 60), safeSignal(item, depth + 1)]).filter(([, item]) => item !== undefined));
    return undefined;
  }
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : null;
  const timestamp = (value) => new Date(value || 0).getTime() || 0;

  const LongTermLearningMemoryService = {
    all() { return userScoped(memoryKey).filter((item) => item && item.schemaVersion === 1); },
    records(type) { return this.all().filter((item) => !type || item.type === type).sort((a, b) => timestamp(b.occurredAt) - timestamp(a.occurredAt)); },
    record(input = {}) {
      if (!state.currentUser || !input.type) return null;
      const occurredAt = input.occurredAt || now();
      const signature = clean(input.signature || `${input.type}:${input.title || ''}:${occurredAt.slice(0, 10)}`, 180);
      const id = `p71a-${clean(input.type, 48)}-${hash(signature)}`;
      const current = this.all();
      const existing = current.find((item) => item.id === id);
      const entry = { id, schemaVersion: 1, type: clean(input.type, 48), title: clean(input.title, 120), summary: clean(input.summary, 320), occurredAt: existing?.occurredAt || occurredAt, updatedAt: now(), source: clean(input.source || 'learning-evidence', 60), signal: safeSignal(input.signal || {}) };
      if (existing && existing.title === entry.title && existing.summary === entry.summary && existing.source === entry.source && JSON.stringify(existing.signal) === JSON.stringify(entry.signal)) return existing;
      saveUserScoped(memoryKey, [entry, ...current.filter((item) => item.id !== id)], 500);
      return entry;
    },
    learningPattern(history = PracticeService?.getHistory?.() || []) {
      const valid = history.filter((item) => timestamp(item.completedAt || item.createdAt));
      const hours = valid.map((item) => new Date(item.completedAt || item.createdAt).getHours());
      const hourCounts = hours.reduce((result, hour) => ({ ...result, [hour]: Number(result[hour] || 0) + 1 }), {});
      const preferredHour = Object.entries(hourCounts).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
      const durations = valid.map((item) => Number(item.durationSeconds || item.duration || 0) / 60).filter((value) => value > 0 && value <= 240);
      const types = valid.map((item) => clean(item.skill || item.type || item.mode, 40)).filter(Boolean);
      const typeCounts = types.reduce((result, type) => ({ ...result, [type]: Number(result[type] || 0) + 1 }), {});
      return { sessions: valid.length, preferredHour: preferredHour == null ? null : Number(preferredHour), averageMinutes: average(durations), preferredActivity: Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null };
    },
    captureSnapshot() {
      if (!state.currentUser) return [];
      const created = []; const profile = LearnerProfileService?.get?.() || {}; const progress = getUserProgress?.() || {}; const history = PracticeService?.getHistory?.() || [];
      const errors = (global.ErrorNotebookService?.top?.(30) || []).filter((item) => !item.resolved);
      const weak = (profile.weakSkills || []).slice(0, 4);
      created.push(this.record({ type: 'weakness_snapshot', title: 'Điểm yếu theo ngày', summary: weak.length ? weak.map((skill) => SKILL_LABELS[skill] || skill).join(', ') : 'Chưa có điểm yếu rõ', signature: `weakness:${day()}`, signal: { skills: weak, frequentMistakes: errors.slice(0, 6).map((item) => ({ topic: clean(item.question || item.type, 100), count: Number(item.count || 1) })) } }));
      const pattern = this.learningPattern(history);
      created.push(this.record({ type: 'learning_pattern', title: 'Nhịp học theo ngày', summary: pattern.sessions ? `${pattern.sessions} phiên đã được dùng để nhận diện thói quen.` : 'Chưa đủ phiên học để nhận diện thói quen.', signature: `pattern:${day()}`, signal: pattern }));
      const skillScores = Object.fromEntries(SKILLS.map((skill) => [skill, Number(profile.skillScores?.[skill] ?? progress.skills?.[skill] ?? 0)]));
      created.push(this.record({ type: 'improvement_snapshot', title: 'Ảnh chụp tiến bộ', summary: 'Mốc kỹ năng dùng để so sánh sự tiến bộ theo thời gian.', signature: `improvement:${day()}`, signal: { skillScores } }));
      const learnedCharacters = progress.foundation?.learnedCharacters?.length || 0;
      if (learnedCharacters > 0) created.push(this.record({ type: 'milestone', title: 'Bắt đầu đọc Hangul', summary: `Đã học ${learnedCharacters} ký tự Hangul.`, signature: 'milestone:first-hangul', occurredAt: progress.foundation?.updatedAt || now(), signal: { learnedCharacters }, source: 'foundation-progress' }));
      const completedLessons = Object.values(progress.lessonProgress || {}).filter((item) => item.completed).length;
      [1, 10, 30].filter((count) => completedLessons >= count).forEach((count) => created.push(this.record({ type: 'milestone', title: `Hoàn thành ${count} bài học`, summary: 'Mốc được xác nhận từ lesson progress.', signature: `milestone:lessons:${count}`, signal: { completedLessons: count }, source: 'lesson-progress' })));
      const mastered = (getUserSrs?.() || []).filter((item) => item.status === 'mastered' || Number(item.mastery || 0) >= 85).length;
      [1, 50, 100].filter((count) => mastered >= count).forEach((count) => created.push(this.record({ type: 'achievement', title: `Thành thạo ${count} từ`, summary: 'Mốc được xác nhận từ SRS hiện tại.', signature: `achievement:vocabulary:${count}`, signal: { masteredVocabulary: count }, source: 'srs' })));
      return created.filter(Boolean);
    },
    improvement() {
      const snapshots = this.records('improvement_snapshot').sort((a, b) => timestamp(a.occurredAt) - timestamp(b.occurredAt));
      const first = snapshots[0]?.signal?.skillScores || {}; const latest = snapshots.at(-1)?.signal?.skillScores || {};
      return Object.fromEntries(SKILLS.map((skill) => [skill, { before: Number(first[skill] || 0), current: Number(latest[skill] || 0), change: Number(latest[skill] || 0) - Number(first[skill] || 0) }]));
    },
    summary() {
      const latestWeakness = this.records('weakness_snapshot')[0]; const pattern = this.records('learning_pattern')[0];
      return { milestones: this.records('milestone').slice(0, 5), achievements: this.records('achievement').slice(0, 5), weaknessHistory: this.records('weakness_snapshot').slice(0, 14), learningPattern: pattern?.signal || {}, improvement: this.improvement(), latestWeakSkills: latestWeakness?.signal?.skills || [] };
    }
  };

  function evidenceScores() {
    const profile = LearnerProfileService?.get?.() || {}; const progress = getUserProgress?.() || {}; const history = PracticeService?.getHistory?.() || []; const srs = getUserSrs?.() || [];
    const buckets = Object.fromEntries(SKILLS.map((skill) => [skill, []]));
    SKILLS.forEach((skill) => { const score = profile.skillScores?.[skill] ?? progress.skills?.[skill]; if (Number(score) > 0) buckets[skill].push({ score: clamp(score), source: 'learner-profile' }); });
    if (srs.length) buckets.vocabulary.push({ score: clamp(average(srs.map((item) => Number(item.mastery || 0))) || 0), source: 'srs-mastery' });
    history.slice(0, 100).forEach((attempt) => {
      Object.entries(attempt.skillBreakdown || {}).forEach(([skill, score]) => { if (buckets[skill] && Number.isFinite(Number(score))) buckets[skill].push({ score: clamp(score), source: 'practice-history' }); });
      const skill = attempt.skill || attempt.category; if (buckets[skill] && Number.isFinite(Number(attempt.percentage))) buckets[skill].push({ score: clamp(attempt.percentage), source: 'practice-history' });
    });
    (progress.pronunciationAttempts || []).slice(-30).forEach((item) => buckets.pronunciation.push({ score: clamp(item.score || item.overall || item.accuracy), source: 'pronunciation-attempt' }));
    (progress.writingSubmissions || []).slice(-30).forEach((item) => buckets.writing.push({ score: clamp(item.score), source: 'writing-submission' }));
    return buckets;
  }

  const FullLearningDiagnosticService = {
    calculate(overrides = {}) {
      const buckets = evidenceScores();
      Object.entries(overrides.scores || {}).forEach(([skill, score]) => { if (buckets[skill] && Number.isFinite(Number(score))) buckets[skill].push({ score: clamp(score), source: 'placement-assessment' }); });
      const skills = Object.fromEntries(SKILLS.map((skill) => { const evidence = buckets[skill]; const score = average(evidence.map((item) => item.score)); return [skill, { score, status: score == null ? 'insufficient-data' : score < 50 ? 'needs-foundation' : score < 70 ? 'developing' : score < 85 ? 'stable' : 'strong', evidenceCount: evidence.length, sources: [...new Set(evidence.map((item) => item.source))] }]; }));
      const ranked = Object.entries(skills).filter(([, value]) => value.score != null).sort((a, b) => a[1].score - b[1].score);
      return { schemaVersion: 1, generatedAt: now(), skills, weakest: ranked[0]?.[0] || null, strongest: ranked.at(-1)?.[0] || null, overall: average(ranked.map(([, value]) => value.score)), coverage: Math.round(ranked.length / SKILLS.length * 100), disclaimer: 'Báo cáo dựa trên dữ liệu học hiện có; kỹ năng thiếu bằng chứng không được tự suy đoán.' };
    },
    run(overrides = {}) {
      const report = this.calculate(overrides); const id = `diagnostic-${Date.now().toString(36)}`;
      LongTermLearningMemoryService.record({ type: 'diagnostic', title: 'Learning Health Report', summary: report.weakest ? `Kỹ năng cần ưu tiên: ${SKILL_LABELS[report.weakest]}.` : 'Chưa đủ dữ liệu để xác định kỹ năng yếu nhất.', signature: id, signal: { report } });
      return { id, ...report };
    },
    latest() { return LongTermLearningMemoryService.records('diagnostic')[0]?.signal?.report || null; }
  };

  const PersonalLearningPrescriptionService = {
    create(days = 14) {
      const duration = Math.max(7, Math.min(30, Number(days) || 14)); const diagnostic = FullLearningDiagnosticService.run();
      const ranked = Object.entries(diagnostic.skills).filter(([, value]) => value.score != null).sort((a, b) => a[1].score - b[1].score).map(([skill]) => skill);
      const foundationNeeded = ((getUserProgress?.() || {}).foundation?.learnedCharacters?.length || 0) < 10;
      const priorities = [...new Set([...(foundationNeeded ? ['pronunciation', 'reading'] : []), ...ranked, 'vocabulary', 'grammar', 'listening'])].slice(0, 3);
      const firstEnd = Math.max(2, Math.round(duration * .28)); const secondEnd = Math.max(firstEnd + 2, Math.round(duration * .58));
      const phases = [{ fromDay: 1, toDay: firstEnd, skill: priorities[0], focus: foundationNeeded ? 'Hangul, âm tiết và phát âm nền tảng' : `Củng cố ${SKILL_LABELS[priorities[0]]}` }, { fromDay: firstEnd + 1, toDay: secondEnd, skill: priorities[1], focus: `Luyện có hướng dẫn: ${SKILL_LABELS[priorities[1]]}` }, { fromDay: secondEnd + 1, toDay: duration, skill: priorities[2], focus: `Active recall và ứng dụng ${SKILL_LABELS[priorities[2]]}` }].filter((phase) => phase.skill && phase.fromDay <= phase.toDay).map((phase) => ({ ...phase, route: ROUTES[phase.skill], minutesPerDay: Number(state.currentUser?.studyMinutesPerDay || 20) }));
      const prescription = { id: `prescription-${Date.now().toString(36)}`, schemaVersion: 1, createdAt: now(), days: duration, diagnosticGeneratedAt: diagnostic.generatedAt, priorities, phases, status: 'active', reviewOn: new Date(Date.now() + duration * 86400000).toISOString().slice(0, 10) };
      LongTermLearningMemoryService.record({ type: 'prescription', title: `Đơn học ${duration} ngày`, summary: `Ưu tiên ${priorities.map((skill) => SKILL_LABELS[skill]).join(', ')}.`, signature: prescription.id, signal: { prescription } });
      return prescription;
    },
    current() { return LongTermLearningMemoryService.records('prescription').find((item) => item.signal?.prescription?.status === 'active')?.signal?.prescription || null; }
  };

  const GOALS = Object.freeze({
    topik: { label: 'TOPIK', milestones: ['Củng cố nền tảng chữ Hàn', 'Hoàn thành TOPIK 1', 'Ổn định TOPIK 2', 'Luyện đề theo mục tiêu'] },
    study: { label: 'Du học', milestones: ['Tiếng Hàn sinh hoạt', 'Đọc thông báo trường học', 'Nghe giảng và ghi chú', 'Sẵn sàng môi trường học thuật'] },
    work: { label: 'Đi làm', milestones: ['Giao tiếp công sở cơ bản', 'Email và báo cáo', 'Họp và kính ngữ', 'Mô phỏng phỏng vấn'] },
    travel: { label: 'Du lịch', milestones: ['Sân bay và phương tiện', 'Gọi món và mua sắm', 'Hỏi đường và xử lý tình huống', 'Survival checkpoint'] },
    conversation: { label: 'Giao tiếp', milestones: ['Phát âm nền tảng', 'Hội thoại ngắn', 'Shadowing và phản xạ', 'Tình huống đời thực'] }
  });
  const LearningGoalSimulatorService = {
    simulate(goalType = 'topik', months = 12, target = '') {
      const goal = GOALS[goalType] || GOALS.topik; const duration = Math.max(1, Math.min(24, Number(months) || 12));
      const timeline = goal.milestones.map((title, index) => ({ month: Math.max(1, Math.round(1 + index * (duration - 1) / Math.max(1, goal.milestones.length - 1))), title: index === goal.milestones.length - 1 && target ? `${title}: ${clean(target, 60)}` : title }));
      const result = { id: `goal-${Date.now().toString(36)}`, schemaVersion: 1, goalType, goal: goal.label, target: clean(target, 60), months: duration, createdAt: now(), timeline, assumptions: { minutesPerDay: Number(state.currentUser?.studyMinutesPerDay || 20), consistencyDaysPerWeek: 5 }, disclaimer: 'Đây là mô phỏng định hướng, không phải cam kết kết quả. Timeline sẽ thay đổi theo dữ liệu học thực tế.' };
      LongTermLearningMemoryService.record({ type: 'goal_simulation', title: `${duration} tháng · ${goal.label}`, summary: result.disclaimer, signature: result.id, signal: { simulation: result } });
      return result;
    },
    latest() { return LongTermLearningMemoryService.records('goal_simulation')[0]?.signal?.simulation || null; },
    goals() { return GOALS; }
  };

  const LearningIntelligenceAIContextService = {
    build() {
      LongTermLearningMemoryService.captureSnapshot();
      const memory = LongTermLearningMemoryService.summary(); const diagnostic = FullLearningDiagnosticService.latest() || FullLearningDiagnosticService.calculate(); const prescription = PersonalLearningPrescriptionService.current(); const simulation = LearningGoalSimulatorService.latest();
      const mistakePatterns = (global.ErrorNotebookService?.top?.(12) || []).filter((item) => !item.resolved).slice(0, 6).map((item) => ({ topic: clean(item.question || item.type, 100), count: Number(item.count || 1), lastSeen: clean(item.updatedAt || item.lastSeen || item.createdAt, 40) }));
      return safeSignal({ learningMemorySummary: { milestoneCount: memory.milestones.length, recentMilestones: memory.milestones.slice(0, 3).map((item) => ({ title: item.title, occurredAt: item.occurredAt })), weaknessTrend: memory.latestWeakSkills, learningPattern: memory.learningPattern, improvement: memory.improvement }, diagnosticSummary: { generatedAt: diagnostic.generatedAt, overall: diagnostic.overall, weakest: diagnostic.weakest, coverage: diagnostic.coverage, skills: Object.fromEntries(SKILLS.map((skill) => [skill, diagnostic.skills[skill]?.score])) }, learningPrescription: prescription ? { days: prescription.days, priorities: prescription.priorities, phases: prescription.phases.map((phase) => ({ fromDay: phase.fromDay, toDay: phase.toDay, skill: phase.skill, focus: phase.focus })) } : null, goalSimulation: simulation ? { goal: simulation.goal, target: simulation.target, months: simulation.months, timeline: simulation.timeline } : null, mistakePatterns });
    }
  };

  if (AITutorService?.context && !AITutorService.context.p71aWrapped) {
    const baseContext = AITutorService.context.bind(AITutorService);
    const context = (query = '') => ({ ...baseContext(query), ...LearningIntelligenceAIContextService.build(query) });
    context.p71aWrapped = true; AITutorService.context = context;
  }

  const esc = (value) => escapeHtml(value == null ? '' : String(value));
  const heading = (title, subtitle) => `<section class="page-heading section"><button class="back-btn" data-p71-view="profile">←</button><div><p class="eyebrow">P71A · LEARNING INTELLIGENCE</p><h1>${esc(title)}</h1><p>${esc(subtitle)}</p></div></section>`;
  const scoreRows = (report) => `<div class="p71-score-list">${SKILLS.map((skill) => { const value = report.skills[skill]; return `<div><span>${esc(SKILL_LABELS[skill])}</span><b>${value.score == null ? '—' : `${value.score}%`}</b><small>${value.evidenceCount} bằng chứng</small><i><em style="width:${value.score || 0}%"></em></i></div>`; }).join('')}</div>`;
  function memoryView() { LongTermLearningMemoryService.captureSnapshot(); const summary = LongTermLearningMemoryService.summary(); return `${heading('Bộ nhớ học dài hạn', 'Một timeline dựa trên mốc, điểm yếu và tiến bộ thật của bạn.')}<section class="p71-grid section"><article class="p71-card"><small>MILESTONES</small><h2>Hành trình đã ghi nhận</h2>${summary.milestones.length ? `<ol class="p71-timeline">${summary.milestones.map((item) => `<li><time>${esc(item.occurredAt.slice(0, 10))}</time><b>${esc(item.title)}</b><span>${esc(item.summary)}</span></li>`).join('')}</ol>` : '<p class="subtle">Hoàn thành bài học đầu tiên để tạo mốc.</p>'}</article><article class="p71-card"><small>LEARNING PATTERN</small><h2>Nhịp học phù hợp</h2><p>${summary.learningPattern.sessions ? `Dựa trên ${summary.learningPattern.sessions} phiên học.` : 'Chưa đủ dữ liệu.'}</p><dl><div><dt>Khung giờ</dt><dd>${summary.learningPattern.preferredHour == null ? '—' : `${String(summary.learningPattern.preferredHour).padStart(2, '0')}:00`}</dd></div><div><dt>Thời lượng</dt><dd>${summary.learningPattern.averageMinutes || '—'} phút</dd></div><div><dt>Hoạt động</dt><dd>${esc(summary.learningPattern.preferredActivity || '—')}</dd></div></dl></article></section><section class="p71-actions section"><button class="btn primary" data-p71-view="learning-diagnostic">Chẩn đoán 7 kỹ năng</button><button class="btn secondary" data-p71-view="learning-goal-simulator">Mô phỏng mục tiêu</button></section>`; }
  function diagnosticView() { const report = FullLearningDiagnosticService.latest() || FullLearningDiagnosticService.calculate(); return `${heading('Learning Health Report', 'Đánh giá 7 kỹ năng; không tự tạo điểm cho phần chưa có dữ liệu.')}<section class="p71-card section"><header><div><small>DIAGNOSTIC COVERAGE</small><h2>${report.coverage}% dữ liệu kỹ năng</h2></div><strong>${report.overall == null ? 'Chưa đủ dữ liệu' : `${report.overall}% tổng quan`}</strong></header>${scoreRows(report)}<p class="subtle">${esc(report.disclaimer)}</p><div class="p71-actions"><button class="btn primary" data-p71-run-diagnostic>Chạy chẩn đoán mới</button><button class="btn secondary" data-p71-create-prescription>Tạo đơn học 14 ngày</button></div></section>`; }
  function prescriptionView() { const plan = PersonalLearningPrescriptionService.current(); return `${heading('Personal Learning Prescription', 'Một kế hoạch ngắn được tạo từ chẩn đoán gần nhất.')}<section class="p71-card section">${plan ? `<header><div><small>${plan.days} DAYS</small><h2>Ưu tiên ${plan.priorities.map((skill) => esc(SKILL_LABELS[skill])).join(' · ')}</h2></div><strong>Đánh giá lại ${esc(plan.reviewOn)}</strong></header><ol class="p71-plan">${plan.phases.map((phase) => `<li><span>Ngày ${phase.fromDay}–${phase.toDay}</span><b>${esc(phase.focus)}</b><small>${phase.minutesPerDay} phút/ngày</small><button class="text-link" data-p71-view="${esc(phase.route)}">Mở bài luyện</button></li>`).join('')}</ol>` : '<div class="empty-state"><h2>Chưa có đơn học</h2><p>Chạy chẩn đoán trước để kế hoạch có căn cứ.</p><button class="btn primary" data-p71-create-prescription>Tạo đơn học 14 ngày</button></div>'}</section>`; }
  function goalView() { const latest = LearningGoalSimulatorService.latest(); return `${heading('Goal Simulator', 'Ước lượng lộ trình theo mục tiêu và thời gian bạn có.')}<section class="p71-card section"><form class="p71-goal-form" id="p71GoalForm"><label>Mục tiêu<select name="goalType">${Object.entries(GOALS).map(([id, goal]) => `<option value="${id}" ${latest?.goalType === id ? 'selected' : ''}>${esc(goal.label)}</option>`).join('')}</select></label><label>Thời gian<input type="number" name="months" min="1" max="24" value="${latest?.months || 12}"></label><label>Đích cụ thể<input name="target" maxlength="60" value="${esc(latest?.target || 'TOPIK 4')}" placeholder="Ví dụ: TOPIK 4"></label><button class="btn primary" type="submit">Tạo timeline</button></form>${latest ? `<ol class="p71-timeline p71-goal-timeline">${latest.timeline.map((item) => `<li><time>Tháng ${item.month}</time><b>${esc(item.title)}</b></li>`).join('')}</ol><p class="subtle">${esc(latest.disclaimer)}</p>` : '<p class="subtle">Chọn mục tiêu để tạo mô phỏng đầu tiên.</p>'}</section>`; }
  function entryCard() { return `<section class="p71-entry section" data-p71-entry><div><small>P71A · PERSONAL MEMORY</small><h2>Ứng dụng đang nhớ hành trình học của bạn</h2><p>Timeline · chẩn đoán 7 kỹ năng · đơn học · mô phỏng mục tiêu</p></div><button class="btn primary" data-p71-view="learning-intelligence-memory">Mở báo cáo</button></section>`; }

  function bind() {
    global.document?.querySelectorAll('[data-p71-view]').forEach((button) => { button.onclick = () => setView(button.dataset.p71View); });
    global.document?.querySelector('[data-p71-run-diagnostic]')?.addEventListener('click', () => { FullLearningDiagnosticService.run(); toast('Đã cập nhật chẩn đoán 7 kỹ năng.'); render(); });
    global.document?.querySelectorAll('[data-p71-create-prescription]').forEach((button) => { button.onclick = () => { PersonalLearningPrescriptionService.create(14); toast('Đã tạo đơn học 14 ngày.'); setView('learning-prescription'); }; });
    const form = global.document?.getElementById('p71GoalForm'); if (form) form.onsubmit = (event) => { event.preventDefault(); const data = new FormData(form); LearningGoalSimulatorService.simulate(data.get('goalType'), data.get('months'), data.get('target')); toast('Đã tạo timeline mục tiêu.'); render(); };
  }

  Object.assign(global, { LongTermLearningMemoryService, FullLearningDiagnosticService, PersonalLearningPrescriptionService, LearningGoalSimulatorService, LearningIntelligenceAIContextService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'learning-intelligence-memory': memoryView, 'learning-diagnostic': diagnosticView, 'learning-prescription': prescriptionView, 'learning-goal-simulator': goalView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; const root = global.document?.getElementById('app'); if (state.currentView === 'profile' && !global.document.querySelector('[data-p71-entry]')) root?.insertAdjacentHTML('afterbegin', entryCard()); if (state.currentView === 'onboarding-result' && !global.document.querySelector('[data-p71-entry]')) root?.insertAdjacentHTML('beforeend', entryCard()); bind(); };
  global.addEventListener?.('klearn-sync-action', () => LongTermLearningMemoryService.captureSnapshot());
  LongTermLearningMemoryService.captureSnapshot();
})(window);
