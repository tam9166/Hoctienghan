(function (global) {
  'use strict';

  const app = global.KLEARN_APP;
  if (!app || global.LearningOutcomeService) return;

  const { state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, PracticeService, LearnerProfileService, escapeHtml, setView, render, toast, CloudSyncService } = app;
  const STORE_KEY = STORAGE_KEYS.learningOutcomes || 'klearn_learning_outcomes';
  const DAY = 86400000;
  const SKILLS = Object.freeze(['vocabulary', 'grammar', 'listening', 'speaking']);
  const SKILL_LABELS = Object.freeze({ vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', speaking: 'Nói' });
  const now = () => new Date().toISOString();
  const dateMs = (value) => { const result = new Date(value || 0).getTime(); return Number.isFinite(result) ? result : 0; };
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : null;
  const finite = (value) => Number.isFinite(Number(value));
  const uid = () => state.currentUser?.id || '';
  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const records = () => userScoped(STORE_KEY).filter((item) => item && typeof item === 'object');
  const saveRecords = (items) => saveUserScoped(STORE_KEY, items.slice(0, 200), 200);
  const scoreOf = (value) => finite(value) ? clamp(value) : null;
  const practiceHistory = () => (PracticeService?.getHistory?.() || []).filter((item) => item && dateMs(item.completedAt || item.createdAt));
  const scoped = (key) => key ? userScoped(key) : [];

  function skillPoints(skill) {
    const points = practiceHistory().flatMap((attempt) => {
      const direct = scoreOf(attempt.skillBreakdown?.[skill]);
      if (direct == null) return [];
      return [{ at: attempt.completedAt || attempt.createdAt, score: direct, source: 'practice', sourceId: attempt.id || attempt.setId || '' }];
    });
    if (skill === 'speaking') {
      scoped(STORAGE_KEYS.speakingSessions).forEach((session) => {
        const score = scoreOf(session.score ?? session.overallScore ?? session.accuracy);
        if (score != null && dateMs(session.createdAt || session.completedAt)) points.push({ at: session.createdAt || session.completedAt, score, source: 'speaking', sourceId: session.id || '' });
      });
    }
    if (skill === 'listening') {
      scoped(STORAGE_KEYS.listeningSessions).forEach((session) => {
        const score = scoreOf(session.score ?? session.percentage ?? session.accuracy);
        if (score != null && dateMs(session.createdAt || session.completedAt)) points.push({ at: session.createdAt || session.completedAt, score, source: 'listening', sourceId: session.id || '' });
      });
    }
    if (skill === 'vocabulary') {
      (state.srsData || []).forEach((card) => {
        const reviews = Math.max(0, Number(card.reviewCount) || 0);
        const attempts = Math.max(reviews, (Number(card.correctCount) || 0) + (Number(card.wrongCount) || 0));
        const score = attempts ? clamp(((Number(card.correctCount) || 0) / attempts) * 100) : scoreOf(card.mastery);
        if (reviews > 0 && score != null && dateMs(card.lastReviewed)) points.push({ at: card.lastReviewed, score, source: 'srs', sourceId: card.wordId || card.id || '' });
      });
    }
    return points.sort((a, b) => dateMs(a.at) - dateMs(b.at));
  }

  function initialSnapshot() {
    const placement = scoreOf(state.currentUser?.placementScore ?? state.currentUser?.placementResult?.percentage);
    const skills = Object.fromEntries(SKILLS.map((skill) => {
      const points = skillPoints(skill);
      const first = points.slice(0, Math.min(3, points.length));
      return [skill, { score: first.length ? average(first.map((point) => point.score)) : placement, sampleSize: first.length || (placement == null ? 0 : 1), source: first.length ? 'earliest-evidence' : placement == null ? 'none' : 'placement' }];
    }));
    return { capturedAt: now(), skills, placementScore: placement };
  }

  function ensureBaseline() {
    if (!uid() || !state.currentUser?.onboardingCompleted) return null;
    const current = records();
    const existing = current.find((item) => item.kind === 'baseline');
    if (existing) return existing;
    const baseline = { id: `baseline-${uid()}`, kind: 'baseline', version: 1, capturedAt: now(), snapshot: initialSnapshot() };
    saveRecords([baseline, ...current]);
    return baseline;
  }

  function measureSkill(skill, baseline = ensureBaseline()) {
    const points = skillPoints(skill);
    const baselineValue = baseline?.snapshot?.skills?.[skill];
    const baselineAt = dateMs(baseline?.capturedAt || baseline?.snapshot?.capturedAt);
    const newer = points.filter((point) => dateMs(point.at) > baselineAt);
    let before = scoreOf(baselineValue?.score);
    let after = newer.length >= 2 ? average(newer.slice(-3).map((point) => point.score)) : null;
    let beforeSamples = Math.max(0, Number(baselineValue?.sampleSize) || 0);
    let afterSamples = newer.length;
    let source = 'baseline';

    const distinctSpan = points.length > 1 ? dateMs(points[points.length - 1].at) - dateMs(points[0].at) : 0;
    if (after == null && points.length >= 4 && distinctSpan > 0) {
      const width = Math.min(3, Math.floor(points.length / 2));
      before = average(points.slice(0, width).map((point) => point.score));
      after = average(points.slice(-width).map((point) => point.score));
      beforeSamples = width;
      afterSamples = width;
      source = 'historical-evidence';
    }
    const measured = before != null && after != null && beforeSamples > 0 && afterSamples >= 2;
    const delta = measured ? after - before : null;
    return {
      skill,
      label: SKILL_LABELS[skill],
      status: measured ? 'measured' : 'collecting',
      before: measured ? before : before,
      after: measured ? after : (points.length ? average(points.slice(-3).map((point) => point.score)) : null),
      delta,
      relativeGrowth: measured && before > 0 ? Math.round((delta / before) * 100) : null,
      baselineSamples: beforeSamples,
      currentSamples: measured ? afterSamples : points.length,
      confidence: measured ? (Math.min(beforeSamples, afterSamples) >= 3 ? 'medium' : 'early') : 'insufficient',
      source
    };
  }

  function retentionAt(days) {
    const eligible = (state.srsData || []).filter((card) => {
      const started = dateMs(card.activatedAt || card.createdAt || card.firstReviewed);
      const reviewed = dateMs(card.lastReviewed);
      return (Number(card.reviewCount) || 0) >= 2 && started > 0 && reviewed - started >= days * DAY;
    });
    if (!eligible.length) return { days, status: 'collecting', score: null, sampleSize: 0, dueForMeasurement: (state.srsData || []).filter((card) => (Number(card.reviewCount) || 0) > 0).length };
    const scores = eligible.map((card) => {
      const attempts = (Number(card.correctCount) || 0) + (Number(card.wrongCount) || 0);
      return attempts ? ((Number(card.correctCount) || 0) / attempts) * 100 : Number(card.mastery) || 0;
    });
    return { days, status: 'measured', score: clamp(average(scores)), sampleSize: eligible.length, dueForMeasurement: 0 };
  }

  function goalResult(skills) {
    const targetLevel = Math.max(1, Math.min(6, Number(state.currentUser?.targetTopikLevel || LearnerProfileService?.get?.()?.targetTopikLevel) || 1));
    const attempts = practiceHistory().filter((item) => item.examMode || /topik/i.test(String(item.level || item.setTitle || ''))).sort((a, b) => dateMs(b.completedAt) - dateMs(a.completedAt));
    const recentScores = attempts.slice(0, 3).map((item) => scoreOf(item.percentage)).filter((value) => value != null);
    const supporting = ['vocabulary', 'grammar', 'listening'].map((skill) => skills[skill]?.after).filter((value) => value != null);
    if (recentScores.length < 2) return { status: 'collecting', target: `TOPIK ${targetLevel}`, progress: null, readiness: null, sampleSize: recentScores.length, message: 'Cần ít nhất 2 bài luyện TOPIK để đo mức sẵn sàng.' };
    const examScore = average(recentScores);
    const skillScore = supporting.length ? average(supporting) : examScore;
    const readiness = clamp(examScore * 0.75 + skillScore * 0.25);
    return { status: 'measured', target: `TOPIK ${targetLevel}`, progress: readiness, readiness, sampleSize: recentScores.length, message: readiness >= 70 ? `Dữ liệu luyện tập cho thấy bạn đang tiến gần mục tiêu TOPIK ${targetLevel}.` : `Tiếp tục củng cố kỹ năng yếu trước mục tiêu TOPIK ${targetLevel}.`, disclaimer: 'Ước tính từ bài luyện, không phải điểm thi chính thức.' };
  }

  function evidenceCatalog() {
    const progress = getUserProgress();
    const lessons = Object.entries(progress.lessonProgress || {}).filter(([, value]) => value?.completed);
    const reviewed = (state.srsData || []).filter((card) => (Number(card.reviewCount) || 0) > 0);
    const mastered = (state.srsData || []).filter((card) => card.status === 'mastered' || Number(card.mastery) >= 80);
    const speaking = scoped(STORAGE_KEYS.speakingSessions);
    const handwriting = scoped(STORAGE_KEYS.handwriting);
    const hangulDone = lessons.some(([lessonId]) => /hangul|foundation|vowel|consonant|syllable/i.test(lessonId)) || handwriting.some((item) => Number(item.masteryScore || item.score) >= 60);
    const firstLesson = lessons.sort((a, b) => dateMs(a[1].completedAt) - dateMs(b[1].completedAt))[0];
    const catalog = [
      { key: 'first-hangul', title: 'Đọc được Hangul đầu tiên', achieved: hangulDone, at: handwriting[0]?.updatedAt || handwriting[0]?.createdAt || firstLesson?.[1]?.completedAt },
      { key: 'first-lesson', title: 'Hoàn thành bài học đầu tiên', achieved: Boolean(firstLesson), at: firstLesson?.[1]?.completedAt },
      { key: 'ten-words', title: 'Ôn tập 10 từ đầu tiên', achieved: reviewed.length >= 10, value: reviewed.length },
      { key: 'fifty-words', title: 'Làm chủ 50 từ', achieved: mastered.length >= 50, value: mastered.length },
      { key: 'first-speaking', title: 'Hoàn thành lượt luyện nói đầu tiên', achieved: speaking.length > 0, at: speaking[speaking.length - 1]?.createdAt },
      { key: 'topik-practice', title: 'Hoàn thành bài luyện TOPIK đầu tiên', achieved: practiceHistory().some((item) => item.examMode || /topik/i.test(String(item.level || item.setTitle || ''))), at: practiceHistory().find((item) => item.examMode || /topik/i.test(String(item.level || item.setTitle || '')))?.completedAt }
    ];
    return catalog.filter((item) => item.achieved).map((item) => ({ ...item, achievedAt: item.at || now() }));
  }

  function courseEffectiveness() {
    const history = practiceHistory().sort((a, b) => dateMs(a.completedAt) - dateMs(b.completedAt));
    const titles = new Map((global.KLEARN_THEORY_LESSONS || []).map((lesson) => [lesson.id, lesson.title]));
    return Object.entries(getUserProgress().lessonProgress || {}).filter(([, value]) => value?.completed && dateMs(value.completedAt)).map(([lessonId, value]) => {
      const completedAt = dateMs(value.completedAt);
      const before = history.filter((attempt) => { const at = dateMs(attempt.completedAt); return at < completedAt && at >= completedAt - 30 * DAY; }).slice(-3);
      const after = history.filter((attempt) => { const at = dateMs(attempt.completedAt); return at > completedAt && at <= completedAt + 30 * DAY; }).slice(0, 3);
      const measured = before.length > 0 && after.length > 0;
      const beforeScore = measured ? average(before.map((item) => item.percentage)) : null;
      const afterScore = measured ? average(after.map((item) => item.percentage)) : null;
      return { lessonId, title: titles.get(lessonId) || value.title || lessonId, status: measured ? 'measured' : 'collecting', before: beforeScore, after: afterScore, lift: measured ? afterScore - beforeScore : null, beforeSamples: before.length, afterSamples: after.length, note: measured ? 'Tương quan với kết quả luyện trong 30 ngày; không khẳng định quan hệ nhân quả.' : 'Cần kết quả luyện trước và sau bài học.' };
    }).sort((a, b) => (b.lift ?? -999) - (a.lift ?? -999)).slice(0, 8);
  }

  function buildSnapshot() {
    const baseline = ensureBaseline();
    const skills = Object.fromEntries(SKILLS.map((skill) => [skill, measureSkill(skill, baseline)]));
    const measured = Object.values(skills).filter((item) => item.status === 'measured');
    const retention7 = retentionAt(7);
    const retention30 = retentionAt(30);
    const goal = goalResult(skills);
    const evidence = evidenceCatalog();
    const overallGrowth = measured.length ? Math.round(measured.reduce((sum, item) => sum + item.delta, 0) / measured.length) : null;
    return {
      capturedAt: now(),
      status: measured.length ? 'measured' : 'collecting',
      overallGrowth,
      skills,
      retention: { day7: retention7, day30: retention30 },
      goal,
      evidence,
      courseEffectiveness: courseEffectiveness(),
      teacherSummary: {
        status: measured.length ? 'measured' : 'collecting',
        overallGrowth,
        goalProgress: goal.progress,
        retention7: retention7.score,
        retention30: retention30.score,
        evidenceCount: evidence.length,
        skillGrowth: Object.fromEntries(SKILLS.map((skill) => [skill, skills[skill].delta])),
        updatedAt: now()
      }
    };
  }

  function refreshCurrent(options = {}) {
    if (!uid() || !state.currentUser?.onboardingCompleted) return null;
    const snapshot = buildSnapshot();
    const current = records();
    const achieved = snapshot.evidence.map((item) => {
      const existing = current.find((record) => record.kind === 'evidence' && record.key === item.key);
      return existing || { id: `evidence-${item.key}`, kind: 'evidence', key: item.key, title: item.title, achievedAt: item.achievedAt, value: item.value ?? null };
    });
    const currentRecord = { id: `current-${uid()}`, kind: 'current', version: 1, updatedAt: now(), ...snapshot };
    const preserved = current.filter((item) => item.kind !== 'current' && item.kind !== 'evidence');
    saveRecords([currentRecord, ...achieved, ...preserved]);
    if (options.sync !== false) CloudSyncService?.schedule?.(STORE_KEY);
    return currentRecord;
  }

  function current() {
    return records().find((item) => item.kind === 'current') || refreshCurrent({ sync: false });
  }

  function saveReport() {
    const snapshot = buildSnapshot();
    const report = { id: id('outcome-report'), kind: 'report', version: 1, createdAt: now(), ...snapshot };
    const existing = records().filter((item) => item.kind !== 'current');
    const currentRecord = { id: `current-${uid()}`, kind: 'current', version: 1, updatedAt: now(), ...snapshot };
    saveRecords([currentRecord, report, ...existing].slice(0, 200));
    CloudSyncService?.schedule?.(STORE_KEY);
    return report;
  }

  function formatMetric(value, suffix = '%') { return value == null ? 'Đang thu thập' : `${value > 0 && suffix === ' điểm' ? '+' : ''}${value}${suffix}`; }
  function statusPill(status) { return `<span class="outcome-status ${status === 'measured' ? 'measured' : 'collecting'}">${status === 'measured' ? 'Đã đo' : 'Đang thu thập'}</span>`; }
  function heading(title, description, back = 'profile') { return `<section class="section page-heading outcome-heading"><button class="back-link" data-view="${back}" aria-label="Quay lại">←</button><p class="eyebrow">Kết quả học tập</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`; }
  function skillCard(item) {
    const after = item.after == null ? 0 : item.after;
    return `<article class="outcome-skill-card"><header><div><small>${escapeHtml(item.label)}</small><strong>${item.delta == null ? '—' : `${item.delta >= 0 ? '+' : ''}${item.delta} điểm`}</strong></div>${statusPill(item.status)}</header><div class="outcome-before-after"><span>Trước <b>${item.before == null ? '—' : `${item.before}%`}</b></span><i aria-hidden="true">→</i><span>Hiện tại <b>${item.after == null ? '—' : `${item.after}%`}</b></span></div><div class="outcome-track" role="progressbar" aria-label="${escapeHtml(item.label)} hiện tại" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${after}"><i style="width:${after}%"></i></div><p>${item.status === 'measured' ? `${item.currentSamples} mẫu hiện tại · độ tin cậy ${item.confidence === 'medium' ? 'trung bình' : 'sớm'}` : `Cần thêm lượt kiểm tra độc lập · hiện có ${item.currentSamples} mẫu`}</p></article>`;
  }
  function retentionCard(item) { return `<article class="outcome-retention-card"><small>Sau ${item.days} ngày</small><strong>${item.score == null ? '—' : `${item.score}%`}</strong>${statusPill(item.status)}<p>${item.status === 'measured' ? `${item.sampleSize} từ đủ điều kiện đo` : 'Chưa đủ từ được kiểm tra lại đúng mốc thời gian.'}</p></article>`; }

  function dashboardView() {
    const value = refreshCurrent({ sync: false }) || buildSnapshot();
    const measuredCount = Object.values(value.skills).filter((item) => item.status === 'measured').length;
    return `${heading('Outcome Dashboard', 'Theo dõi mức tiến bộ có bằng chứng, không dùng số lần mở app để thay cho kết quả.')}
      <section class="outcome-hero section"><div><span>Kết quả tổng hợp</span><strong>${formatMetric(value.overallGrowth, ' điểm')}</strong><p>${measuredCount ? `${measuredCount}/4 kỹ năng đã đủ dữ liệu before–after.` : 'Hãy hoàn thành thêm lượt luyện để tạo phép đo before–after.'}</p></div><div class="outcome-hero-actions"><button class="btn primary" data-view="student-progress-report">Xem báo cáo học viên</button><button class="btn secondary" data-refresh-outcomes>Làm mới dữ liệu</button></div></section>
      <section class="section"><div class="section-heading"><div><p class="eyebrow">Skill Growth Score</p><h2 class="section-title">Tiến bộ theo kỹ năng</h2></div><small class="subtle">Chỉ hiện chênh lệch khi đủ mẫu</small></div><div class="outcome-skill-grid">${SKILLS.map((skill) => skillCard(value.skills[skill])).join('')}</div></section>
      <section class="section outcome-two-col"><div><div class="section-heading"><h2 class="section-title">Khả năng ghi nhớ</h2></div><div class="outcome-retention-grid">${retentionCard(value.retention.day7)}${retentionCard(value.retention.day30)}</div></div><article class="outcome-goal-card"><div><small>Mục tiêu hiện tại</small><h2>${escapeHtml(value.goal.target)}</h2></div>${statusPill(value.goal.status)}<strong>${value.goal.progress == null ? '—' : `${value.goal.progress}%`}</strong><p>${escapeHtml(value.goal.message)}</p>${value.goal.disclaimer ? `<small>${escapeHtml(value.goal.disclaimer)}</small>` : ''}</article></section>
      <section class="section outcome-evidence"><div class="section-heading"><div><p class="eyebrow">Learning Evidence</p><h2 class="section-title">Bằng chứng học tập</h2></div><b>${value.evidence.length} cột mốc</b></div>${value.evidence.length ? `<ol>${value.evidence.map((item) => `<li><span aria-hidden="true">✓</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(String(item.achievedAt || '').slice(0, 10))}</small></div></li>`).join('')}</ol>` : '<div class="empty-state"><h3>Chưa có cột mốc được xác nhận</h3><p>Hoàn thành một bài hoặc một lượt luyện để bắt đầu lưu bằng chứng.</p><button class="btn primary" data-view="lessons">Bắt đầu học</button></div>'}</section>
      <section class="section outcome-course-section"><div class="section-heading"><div><p class="eyebrow">Course Effectiveness</p><h2 class="section-title">Bài học gắn với tiến bộ</h2></div></div>${value.courseEffectiveness.length ? value.courseEffectiveness.map((item) => `<article><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.note)}</small></div><span>${item.lift == null ? 'Đang thu thập' : `${item.lift >= 0 ? '+' : ''}${item.lift} điểm`}</span></article>`).join('') : '<div class="empty-state"><h3>Chưa có bài hoàn thành</h3><p>Dữ liệu hiệu quả xuất hiện khi có kết quả luyện trước và sau bài học.</p></div>'}</section>`;
  }

  function reportView() {
    const value = current() || buildSnapshot();
    const created = value.updatedAt || value.capturedAt || now();
    return `${heading('Student Progress Report', 'Bản báo cáo riêng tư tổng hợp tiến bộ, khả năng ghi nhớ và mục tiêu.', 'learning-outcomes')}
      <section class="outcome-report-paper section" aria-label="Báo cáo tiến bộ học viên"><header><div><small>Học viên</small><h2>${escapeHtml(state.currentUser?.name || state.currentUser?.email || 'Học viên')}</h2></div><div><small>Cập nhật</small><b>${escapeHtml(String(created).slice(0, 10))}</b></div></header><div class="outcome-report-summary"><div><small>Tăng trưởng tổng</small><strong>${formatMetric(value.overallGrowth, ' điểm')}</strong></div><div><small>Mục tiêu</small><strong>${escapeHtml(value.goal.target)}</strong></div><div><small>Cột mốc</small><strong>${value.evidence.length}</strong></div></div><h3>Before / After theo kỹ năng</h3><div class="outcome-report-table" role="table">${SKILLS.map((skill) => { const item = value.skills[skill]; return `<div role="row"><span role="cell">${escapeHtml(item.label)}</span><span role="cell">${item.before == null ? '—' : `${item.before}%`}</span><span role="cell">${item.after == null ? '—' : `${item.after}%`}</span><b role="cell">${item.delta == null ? 'Đang thu thập' : `${item.delta >= 0 ? '+' : ''}${item.delta} điểm`}</b></div>`; }).join('')}</div><h3>Kết luận có căn cứ</h3><p>${value.status === 'measured' ? `Dữ liệu hiện có cho phép đo ${Object.values(value.skills).filter((item) => item.status === 'measured').length} kỹ năng. Chỉ số được tính từ kết quả luyện, SRS và speaking đã lưu.` : 'Chưa đủ mẫu độc lập để kết luận mức tăng trưởng. App sẽ tiếp tục thu thập khi bạn học và ôn tập.'}</p><p class="outcome-report-note">Báo cáo không thay thế chứng chỉ hoặc kết quả thi TOPIK chính thức. Các phép đo “course effectiveness” là tương quan, không khẳng định quan hệ nhân quả.</p></section>
      <div class="section outcome-report-actions"><button class="btn primary" data-save-outcome-report>Lưu báo cáo</button><button class="btn secondary" data-print-outcome-report>In / lưu PDF</button></div>`;
  }

  function teacherView() {
    if (!global.TeacherDashboardService?.available?.()) return `${heading('Kết quả học viên', 'Teacher View chỉ dành cho giáo viên hoặc quản trị viên.', 'education-platform')}<section class="empty-state section"><h2>Không có quyền truy cập</h2><p>Dữ liệu kết quả được giới hạn theo role và liên kết lớp học.</p></section>`;
    const rows = global.TeacherDashboardService.rows();
    return `${heading('Kết quả học viên', 'Chỉ hiển thị snapshot tổng hợp; không hiển thị nhật ký, câu trả lời hoặc dữ liệu riêng tư.', 'teacher-dashboard')}<section class="section teacher-outcome-list">${rows.length ? rows.map((student) => { const value = student.outcomes || {}; return `<article><header><div><small>Học viên</small><h2>${escapeHtml(student.displayName || 'Học viên')}</h2></div>${statusPill(value.status)}</header><dl><div><dt>Tăng trưởng</dt><dd>${formatMetric(value.overallGrowth, ' điểm')}</dd></div><div><dt>Mục tiêu</dt><dd>${value.goalProgress == null ? '—' : `${value.goalProgress}%`}</dd></div><div><dt>Nhớ sau 7 ngày</dt><dd>${value.retention7 == null ? '—' : `${value.retention7}%`}</dd></div><div><dt>Cột mốc</dt><dd>${value.evidenceCount || 0}</dd></div></dl></article>`; }).join('') : '<div class="empty-state"><h2>Chưa có snapshot kết quả</h2><p>Khi học viên đồng bộ dữ liệu và đủ bằng chứng, kết quả tổng hợp sẽ xuất hiện tại đây.</p></div>'}</section>`;
  }

  const LearningOutcomeService = Object.freeze({ ensureBaseline, skillPoints, measureSkill, retentionAt, goalResult, evidenceCatalog, courseEffectiveness, buildSnapshot, refreshCurrent, current, saveReport, records });
  global.LearningOutcomeService = LearningOutcomeService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'learning-outcomes': dashboardView, 'student-progress-report': reportView, 'teacher-outcomes': teacherView };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser?.onboardingCompleted) return;
    ensureBaseline();
    if (state.currentView === 'profile' && !document.querySelector('[data-learning-outcome-entry]')) {
      document.querySelector('.profile-head, .personal-profile, .profile-quick-actions, .profile-action-list, #app > .section')?.insertAdjacentHTML('afterend', `<section class="outcome-profile-entry section" data-learning-outcome-entry><div><span>Kết quả, không chỉ hoạt động</span><h2>Tiến bộ học tập</h2><p>Before–after, ghi nhớ 7/30 ngày và bằng chứng đạt mục tiêu.</p></div><button class="btn primary" data-open-learning-outcomes>Mở báo cáo</button></section>`);
    }
    if (state.currentView === 'analytics' && !document.querySelector('[data-learning-outcome-analytics]')) {
      document.querySelector('#app > .page-heading')?.insertAdjacentHTML('afterend', `<section class="outcome-analytics-entry section" data-learning-outcome-analytics><div><small>Learning outcomes</small><b>Phân biệt kết quả tiến bộ với số lần hoạt động.</b></div><button class="btn secondary" data-open-learning-outcomes>Xem Outcome Dashboard</button></section>`);
    }
    if (state.currentView === 'teacher-dashboard' && global.TeacherDashboardService?.available?.() && !document.querySelector('[data-teacher-outcomes-entry]')) {
      document.querySelector('#app > .page-heading, #app > .section')?.insertAdjacentHTML('afterend', `<section class="outcome-analytics-entry section" data-teacher-outcomes-entry><div><small>Teacher View</small><b>Xem tăng trưởng và khả năng ghi nhớ của học viên.</b></div><button class="btn secondary" data-view="teacher-outcomes">Mở kết quả lớp</button></section>`);
    }
    document.querySelectorAll('[data-open-learning-outcomes]').forEach((button) => { button.onclick = () => setView('learning-outcomes'); });
    document.querySelector('[data-refresh-outcomes]')?.addEventListener('click', () => { refreshCurrent(); toast('Đã làm mới dữ liệu kết quả học tập.'); render(); });
    document.querySelector('[data-save-outcome-report]')?.addEventListener('click', () => { saveReport(); toast('Đã lưu Student Progress Report.'); });
    document.querySelector('[data-print-outcome-report]')?.addEventListener('click', () => global.print?.());
  };

  let refreshTimer = 0;
  global.addEventListener?.('klearn-sync-action', () => {
    global.clearTimeout?.(refreshTimer);
    refreshTimer = global.setTimeout?.(() => refreshCurrent(), 800);
  });
  ensureBaseline();
  refreshCurrent({ sync: false });
  if (['learning-outcomes', 'student-progress-report', 'teacher-outcomes'].includes(state.currentView)) render();
  else global.KLEARN_AFTER_RENDER?.();
})(window);
