/* Tiếng Hàn - TamHoanq — one-click daily learning experience */
(function buildDailyLearningExperience(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, userScoped, saveUserScoped, PracticeService, LearnerProfileService } = app;
  const DURATIONS = Object.freeze([5, 15, 30, 60]);
  const now = () => new Date().toISOString();
  const today = () => now().slice(0, 10);
  const language = () => document.documentElement?.lang || 'vi';
  const localize = (value) => typeof value === 'string' ? value : (value?.[language()] || value?.vi || value?.en || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const uid = () => state.currentUser?.id || '';
  const readState = () => userScoped(STORAGE_KEYS.dailyExperience)[0] || { preferredMinutes: 15, updatedAt: null };
  const saveState = (changes = {}) => { const value = { ...readState(), ...changes, userId: uid(), updatedAt: now() }; saveUserScoped(STORAGE_KEYS.dailyExperience, [value], 5); return value; };
  const safeMinutes = (value) => DURATIONS.includes(Number(value)) ? Number(value) : 15;
  const formatTime = (value) => new Intl.DateTimeFormat(language() === 'zh-CN' ? 'zh-CN' : language(), { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  const addMinutes = (value, minutes) => new Date(new Date(value).getTime() + minutes * 60000).toISOString();
  const skillLabel = (skill) => ({ vocabulary: copy('Từ vựng', 'Vocabulary', '词汇'), grammar: copy('Ngữ pháp', 'Grammar', '语法'), listening: copy('Nghe', 'Listening', '听力'), speaking: copy('Nói', 'Speaking', '口语'), reading: copy('Đọc', 'Reading', '阅读'), writing: copy('Viết', 'Writing', '写作'), lesson: copy('Bài học', 'Lesson', '课程'), repair: copy('Sửa lỗi', 'Mistake repair', '错题修复'), quick: 'Quick Practice' })[skill] || skill;
  const routeFor = (type) => ({ srs: 'review', grammar: 'grammar-compare', listening: 'listening-studio', speaking: 'speaking-room', lesson: state.currentUser?.learningTrack === 'foundation' ? 'foundation' : 'lessons', repair: 'error-notebook' })[type] || 'lessons';

  function splitMinutes(total, parts) {
    const base = Math.floor(total / parts); const values = Array(parts).fill(base); let remainder = total - base * parts;
    for (let index = 0; remainder > 0; index = (index + 1) % parts, remainder -= 1) values[index] += 1;
    return values;
  }

  const DailyPlanService = {
    latestMistake() { return (global.ErrorNotebookService?.top?.(20) || []).find((item) => !item.resolved) || null; },
    isRecovery() { return Boolean(global.ComebackModeService?.status?.().active); },
    build(minutes = readState().preferredMinutes) {
      const duration = safeMinutes(minutes); const recovery = this.isRecovery(); const foundation = state.currentUser?.learningTrack === 'foundation';
      if (recovery) {
        const slots = splitMinutes(duration, 3);
        return { minutes: duration, recovery: true, tasks: [
          { id: 'recovery-srs', type: 'srs', route: 'review', minutes: slots[0], title: copy('Ôn 10 từ quan trọng', 'Review 10 important words', '复习 10 个重要单词'), reason: copy('Lấy lại nhịp nhớ mà không học dồn.', 'Restart recall without cramming.', '轻量恢复记忆，不突击。') },
          { id: 'recovery-error', type: 'repair', route: 'error-notebook', minutes: slots[1], title: copy('Sửa 1 lỗi cần nhớ', 'Repair one familiar mistake', '修复 1 个常见错误'), reason: copy('Chỉ xử lý một lỗi gần nhất.', 'Work on one recent mistake only.', '只处理最近的一个错误。') },
          { id: 'recovery-lesson', type: 'lesson', route: routeFor('lesson'), minutes: slots[2], title: copy('Học 1 bài ngắn', 'Complete one short lesson', '学习 1 节短课'), reason: copy('Kết thúc nhẹ để sẵn sàng cho ngày mai.', 'Finish lightly and be ready for tomorrow.', '轻松结束，为明天做好准备。') }
        ] };
      }
      if (duration === 5) return { minutes: 5, recovery: false, tasks: [{ id: 'daily-quick', type: 'quick', action: 'quick', route: 'quick-practice', minutes: 5, title: 'Quick Practice', reason: copy('5 từ vựng · 3 câu nghe · 1 câu ngữ pháp.', '5 vocabulary · 3 listening · 1 grammar item.', '5 个词汇 · 3 道听力 · 1 道语法。') }] };
      const specifications = duration === 15
        ? [['srs', 5], [foundation ? 'lesson' : 'grammar', 5], ['listening', 5]]
        : duration === 30
          ? [['srs', 8], ['repair', 7], [foundation ? 'lesson' : 'grammar', 7], ['listening', 8]]
          : [['srs', 15], ['lesson', 15], [foundation ? 'reading' : 'grammar', 10], ['listening', 10], ['speaking', 10]];
      const director = global.LearningDirectorService?.plan?.(); const directorByType = Object.fromEntries((director?.tasks || []).map((item) => [item.type, item]));
      const titles = {
        srs: copy('Ôn từ đến hạn', 'Review due vocabulary', '复习到期词汇'), grammar: copy('Củng cố ngữ pháp yếu', 'Strengthen weak grammar', '巩固薄弱语法'), listening: copy('Luyện nghe tập trung', 'Focused listening', '专注听力'), speaking: copy('Nói theo mẫu', 'Guided speaking', '跟读口语'), lesson: foundation ? copy('Tiếp tục Hangul', 'Continue Hangul', '继续学习韩文') : copy('Tiếp tục bài đang học', 'Continue current lesson', '继续当前课程'), reading: copy('Đọc một đoạn ngắn', 'Read a short passage', '阅读短文'), repair: copy('Sửa lỗi gần nhất', 'Replay the last mistake', '重练最近错题')
      };
      return { minutes: duration, recovery: false, tasks: specifications.map(([type, taskMinutes], index) => ({ id: `daily-${type}-${index}`, type, route: routeFor(type), minutes: taskMinutes, title: directorByType[type]?.title || titles[type], reason: directorByType[type]?.reason || copy('Được chọn từ tiến độ và ưu tiên hiện tại.', 'Selected from your current progress and priorities.', '根据当前进度与优先级选择。') })) };
    }
  };

  const DailyLearningSessionService = {
    active() { return global.FocusSessionService?.active?.() || null; },
    latestToday() { return (global.FocusSessionService?.all?.() || []).find((item) => item.source === 'daily-experience' && String(item.completedAt || item.startedAt).slice(0, 10) === today()) || null; },
    start(minutes) {
      if (this.active()) return this.active();
      const plan = DailyPlanService.build(minutes); const session = global.FocusSessionService?.start?.(plan.minutes);
      if (!session) return null;
      session.source = 'daily-experience'; session.recovery = plan.recovery; session.currentTask = 0; session.tasks = plan.tasks.map((task) => ({ ...task, completed: false }));
      global.FocusSessionService.save(session); saveState({ preferredMinutes: plan.minutes, lastStartedAt: session.startedAt }); return session;
    },
    completeCurrent() { const session = this.active(); if (!session) return null; global.FocusSessionService.completeTask(session); const active = this.active(); if (!active) saveState({ lastCompletedAt: now() }); return active || this.latestToday(); },
    progress(session = this.active() || this.latestToday()) { if (!session?.tasks?.length) return 0; return Math.round(session.tasks.filter((item) => item.completed).length / session.tasks.length * 100); },
    currentTask(session = this.active()) { return session?.tasks?.find((item) => !item.completed) || null; }
  };

  const DailyQuickPracticeService = {
    questions() {
      const sets = PracticeService?.bank?.sets || []; const all = sets.flatMap((set) => PracticeService.bank.getQuestions(set.id)).filter((item, index, values) => values.findIndex((candidate) => candidate.id === item.id) === index);
      const take = (skill, count) => all.filter((item) => item.skill === skill).slice(0, count);
      return [...take('vocabulary', 5), ...take('listening', 3), ...take('grammar', 1)];
    },
    start() { const questions = this.questions(); return questions.length === 9 && PracticeService?.startQuestions?.(questions, 'Quick Practice · 9 câu', 'daily-quick'); }
  };

  const StudyHabitService = {
    events() {
      const practice = (PracticeService?.getHistory?.() || []).map((item) => ({ at: item.completedAt, minutes: Math.max(1, Math.round(Number(item.durationSeconds || 0) / 60)), skills: Object.keys(item.skillBreakdown || {}) }));
      const focus = (global.FocusSessionService?.all?.() || []).filter((item) => item.status === 'completed').map((item) => ({ at: item.completedAt, minutes: Number(item.actualMinutes || 0), skills: (item.tasks || []).map((task) => task.type) }));
      return [...practice, ...focus].filter((item) => item.at && new Date(item.at).getTime());
    },
    analyze() {
      const events = this.events(); if (!events.length) return { ready: false, eventCount: 0, bestWindow: null, bestDay: null, topSkill: null };
      const hours = {}; const days = {}; const skills = {};
      events.forEach((event) => { const date = new Date(event.at); const windowStart = Math.floor(date.getHours() / 2) * 2; hours[windowStart] = (hours[windowStart] || 0) + Math.max(1, event.minutes); const day = date.getDay(); days[day] = (days[day] || 0) + Math.max(1, event.minutes); event.skills.forEach((skill) => { if (skill) skills[skill] = (skills[skill] || 0) + 1; }); });
      const pick = (object) => Object.entries(object).sort((a, b) => b[1] - a[1])[0]?.[0]; const hour = Number(pick(hours)); const day = Number(pick(days)); const dayNames = language() === 'zh-CN' ? ['周日','周一','周二','周三','周四','周五','周六'] : language() === 'en' ? ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'] : ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
      return { ready: events.length >= 2, eventCount: events.length, bestWindow: Number.isFinite(hour) ? `${String(hour).padStart(2, '0')}:00–${String((hour + 2) % 24).padStart(2, '0')}:00` : null, bestDay: Number.isFinite(day) ? dayNames[day] : null, topSkill: skillLabel(pick(skills) || ''), raw: { hours, days, skills } };
    }
  };

  function activityWeek() {
    const activity = global.StudyCalendarService?.activityByDay?.() || {}; const result = [];
    for (let offset = 6; offset >= 0; offset -= 1) { const date = new Date(); date.setHours(12, 0, 0, 0); date.setDate(date.getDate() - offset); const key = date.toISOString().slice(0, 10); result.push({ ...(activity[key] || { minutes: 0, lessons: 0, reviews: 0, practices: 0 }), key, date }); }
    return result;
  }
  function timeline(plan, session) {
    const start = session?.startedAt || now(); let elapsed = 0;
    return plan.tasks.map((task, index) => { const sessionTask = session?.tasks?.[index]; const completed = Boolean(sessionTask?.completed); const current = session?.status === 'active' && session.currentTask === index; const item = { ...task, completed, current, time: formatTime(addMinutes(start, elapsed)) }; elapsed += task.minutes; return item; });
  }
  function progressSummary(session, plan) { const progress = getUserProgress?.() || {}; const percentage = session ? DailyLearningSessionService.progress(session) : 0; return { percentage, done: session?.tasks?.filter((item) => item.completed).length || 0, total: session?.tasks?.length || plan.tasks.length, streak: Number(progress.stats?.streak || 0) }; }
  function latestMistakeMarkup() {
    const mistake = DailyPlanService.latestMistake(); const queued = mistake ? global.ManualReviewQueueService?.all?.().find((item) => item.sourceId === mistake.id) : null;
    if (!mistake) return `<div class="daily-mistake empty"><p class="eyebrow">${copy('Lỗi cần sửa hôm nay', 'Mistake to replay', '今日错题')}</p><b>${copy('Chưa có lỗi cần sửa', 'No saved mistakes yet', '暂无需要修复的错误')}</b><small>${copy('Lỗi mới sẽ tự xuất hiện ở đây sau khi luyện.', 'New mistakes will appear here after practice.', '练习后的新错题会显示在这里。')}</small></div>`;
    return `<div class="daily-mistake"><p class="eyebrow">${copy('Lỗi cần sửa hôm nay', 'Mistake to replay', '今日错题')}</p><b>${escapeHtml(mistake.mistake || mistake.question || mistake.topic || '')}</b>${mistake.correction ? `<span lang="ko">→ ${escapeHtml(mistake.correction)}</span>` : ''}<small>${Number(mistake.count || 1)}× · ${escapeHtml(mistake.explanation || copy('Mở Sổ lỗi để xem lại.', 'Open the Error Notebook to review it.', '打开错题本进行复习。'))}</small><div class="daily-review-actions"><button data-view="error-notebook">${copy('Ôn ngay', 'Review now', '立即复习')}</button><button data-daily-review="later" data-error-id="${escapeHtml(mistake.id)}">${copy('Ôn sau', 'Review later', '稍后复习')}</button><button data-daily-review="skipped" data-error-id="${escapeHtml(mistake.id)}">${copy('Bỏ qua', 'Skip', '跳过')}</button></div>${queued ? `<em>${queued.status === 'later' ? copy('Đã lên lịch ôn sau', 'Scheduled for later', '已安排稍后复习') : queued.status === 'skipped' ? copy('Đã bỏ qua', 'Skipped', '已跳过') : copy('Đã thêm vào hôm nay', 'Added for today', '已加入今日复习')}</em>` : ''}</div>`;
  }
  function homeView() {
    const preferences = readState(); const active = DailyLearningSessionService.active(); const completed = DailyLearningSessionService.latestToday(); const selectedMinutes = safeMinutes(active?.targetMinutes || preferences.preferredMinutes); const plan = active ? { minutes: active.targetMinutes, recovery: active.recovery, tasks: active.tasks } : DailyPlanService.build(selectedMinutes); const completedForPlan = completed && Number(completed.targetMinutes) === selectedMinutes ? completed : null; const session = active || completedForPlan; const items = timeline(plan, session); const summary = progressSummary(session, plan); const next = active ? DailyLearningSessionService.currentTask(active) : completedForPlan ? null : plan.tasks[0]; const habit = StudyHabitService.analyze(); const week = activityWeek(); const manualDue = global.ManualReviewQueueService?.dueToday?.().length || 0; const name = String(state.currentUser?.fullName || '').trim().split(/\s+/).filter(Boolean).pop() || copy('bạn', 'there', '你'); const goal = global.RealGoalPlannerService?.current?.()?.title || state.currentUser?.goalLabel || '';
    return `<section class="daily-home section"><header class="daily-home-header"><div><p class="eyebrow">${copy('Hôm nay', 'Today', '今天')} · ${escapeHtml(new Intl.DateTimeFormat(language() === 'zh-CN' ? 'zh-CN' : language(), { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date()))}</p><h1 class="headline">${copy(`Chào ${name}`, `Hello ${name}`, `${name}，你好`)}</h1><p>${plan.recovery ? copy('Quay lại nhẹ nhàng, không cần học bù.', 'Ease back in—no need to catch up all at once.', '轻松恢复，不必一次补完。') : goal ? `${copy('Mục tiêu', 'Goal', '目标')}: ${escapeHtml(goal)}` : copy('Một phiên rõ ràng là đủ để giữ nhịp.', 'One clear session is enough to keep momentum.', '完成一个清晰的学习时段即可保持节奏。')}</p></div><div class="daily-progress-ring" style="--daily-progress:${summary.percentage * 3.6}deg"><strong>${summary.percentage}%</strong><small>${summary.done}/${summary.total}</small></div></header><section class="daily-start-panel"><div class="daily-time-choice" role="radiogroup" aria-label="${copy('Thời gian học', 'Study time', '学习时间')}"><span>${copy('Tôi có', 'I have', '我有')}</span>${DURATIONS.map((minutes) => `<button class="${minutes === selectedMinutes ? 'active' : ''}" data-daily-minutes="${minutes}" aria-pressed="${minutes === selectedMinutes}">${minutes}′</button>`).join('')}</div><button class="btn primary daily-start-button" data-start-daily>${active ? copy('Tiếp tục phiên học', 'Continue today’s session', '继续今日学习') : copy('Bắt đầu học hôm nay', 'Start learning today', '开始今日学习')}</button><button class="btn secondary" data-start-quick>Quick Practice</button></section>${plan.recovery ? `<section class="daily-recovery-note"><span>↻</span><div><b>${copy('Recovery Plan · Ngày 1', 'Recovery Plan · Day 1', '恢复计划 · 第 1 天')}</b><small>${copy('10 từ quan trọng · 1 lỗi · 1 bài ngắn', '10 important words · 1 mistake · 1 short lesson', '10 个重要单词 · 1 个错题 · 1 节短课')}</small></div></section>` : ''}<section class="daily-home-grid"><article class="daily-timeline"><div class="daily-section-heading"><div><p class="eyebrow">Today's Plan</p><h2>${copy('Lịch học hôm nay', 'Today’s timeline', '今日时间线')}</h2></div><span>${plan.minutes} ${copy('phút', 'minutes', '分钟')}</span></div><ol>${items.map((item) => `<li class="${item.completed ? 'done' : item.current ? 'current' : ''}"><time>${item.time}</time><span>${item.completed ? '✓' : item.current ? '→' : '○'}</span><div><b>${escapeHtml(item.title)}</b><small>${item.minutes}′ · ${escapeHtml(item.reason || skillLabel(item.type))}</small></div></li>`).join('')}<li class="timeline-finish ${summary.percentage === 100 ? 'done' : ''}"><time>${formatTime(addMinutes(active?.startedAt || now(), plan.minutes))}</time><span>${summary.percentage === 100 ? '✓' : '○'}</span><div><b>${copy('Hoàn thành', 'Complete', '完成')}</b></div></li></ol></article><aside class="daily-next-column"><div class="daily-next-action"><p class="eyebrow">Next Action</p><h2>${escapeHtml(next?.title || copy('Đã hoàn thành hôm nay', 'Today is complete', '今日已完成'))}</h2><p>${escapeHtml(next?.reason || copy('Bạn có thể nghỉ và quay lại vào ngày mai.', 'You can rest and return tomorrow.', '可以休息，明天再继续。'))}</p>${next ? `<button class="btn secondary full" data-daily-open="${escapeHtml(next.action || next.route)}">${copy('Mở hoạt động', 'Open activity', '打开活动')}</button>` : ''}</div>${latestMistakeMarkup()}<div class="daily-manual-queue"><span>↻</span><div><b>${copy('Hàng ôn tự chọn', 'Manual review queue', '手动复习队列')}</b><small>${manualDue} ${copy('mục đến hạn hôm nay', 'items due today', '项今日到期')}</small></div><button data-view="manual-review-queue">${copy('Mở', 'Open', '打开')}</button></div></aside></section><section class="daily-week"><div class="daily-section-heading"><div><p class="eyebrow">Learning Calendar</p><h2>${copy('7 ngày gần đây', 'Last 7 days', '最近 7 天')}</h2></div><button class="text-link" data-view="study-calendar">${copy('Xem lịch đầy đủ', 'Open calendar', '查看完整日历')}</button></div><div class="daily-week-strip">${week.map((day) => `<div class="${day.key === today() ? 'today' : ''} ${day.minutes ? 'studied' : ''}"><span>${new Intl.DateTimeFormat(language() === 'zh-CN' ? 'zh-CN' : language(), { weekday: 'short' }).format(day.date)}</span><b>${day.date.getDate()}</b><small>${day.minutes ? `${day.minutes}′` : '—'}</small></div>`).join('')}</div></section><section class="daily-habit"><div><p class="eyebrow">Study Habit</p><h2>${habit.ready ? `${copy('Bạn học hiệu quả nhất', 'Your strongest study window', '最佳学习时段')}: ${habit.bestWindow}` : copy('Đang tìm nhịp học phù hợp', 'Finding your study rhythm', '正在寻找适合你的学习节奏')}</h2><p>${habit.ready ? `${habit.bestDay} · ${copy('thường học', 'most practised', '最常练习')} ${escapeHtml(habit.topSkill || '—')}` : copy('Hoàn thành ít nhất 2 phiên để xem phân tích thói quen thật.', 'Complete at least two sessions to see real habit insights.', '完成至少 2 次学习即可查看真实习惯分析。')}</p></div><span>🔥 ${summary.streak} ${copy('ngày', 'days', '天')}</span></section></section>`;
  }
  function dailySessionView() {
    const active = DailyLearningSessionService.active(); const latest = DailyLearningSessionService.latestToday();
    if (!active) return `<section class="daily-session-complete section"><span>✓</span><p class="eyebrow">${copy('Phiên hôm nay', 'Today’s session', '今日学习')}</p><h1 class="headline">${latest ? copy('Bạn đã hoàn thành phiên học', 'Session completed', '学习已完成') : copy('Chưa có phiên đang chạy', 'No active session', '当前没有进行中的学习')}</h1><p>${latest ? `${latest.actualMinutes || latest.targetMinutes} ${copy('phút đã được ghi vào tiến độ.', 'minutes were added to your progress.', '分钟已记录到学习进度。')}` : copy('Bắt đầu từ Home với một lần chạm.', 'Start from Home with one tap.', '从首页一键开始。')}</p><button class="btn primary" data-view="home">${copy('Về Home', 'Back to Home', '返回首页')}</button></section>`;
    const task = DailyLearningSessionService.currentTask(active); const percentage = DailyLearningSessionService.progress(active); const plan = { minutes: active.targetMinutes, tasks: active.tasks }; const items = timeline(plan, active);
    return `<section class="section page-heading daily-session-heading"><button class="back-link" data-view="home">← Home</button><p class="eyebrow">${copy('Phiên học hôm nay', 'Today’s study session', '今日学习')}</p><h1 class="headline">${active.targetMinutes} ${copy('phút tập trung', 'focused minutes', '分钟专注学习')}</h1><div class="bar large"><span style="width:${percentage}%"></span></div><p class="subtle">${active.tasks.filter((item) => item.completed).length}/${active.tasks.length} ${copy('bước hoàn thành', 'steps complete', '步已完成')}</p></section><section class="daily-session-layout"><article class="daily-session-current"><span>${skillLabel(task?.type || '')}</span><h2>${escapeHtml(task?.title || '')}</h2><p>${escapeHtml(task?.reason || '')}</p><div class="daily-session-actions"><button class="btn secondary" data-daily-open="${escapeHtml(task?.action || task?.route || 'lessons')}">${copy('Mở hoạt động', 'Open activity', '打开活动')}</button><button class="btn primary" data-complete-daily-task>${copy('Đã xong, tiếp tục', 'Done, continue', '完成并继续')}</button></div><small>${copy('Chỉ xác nhận sau khi bạn đã thực hiện hoạt động.', 'Confirm only after completing the activity.', '完成活动后再确认。')}</small></article><ol class="daily-session-timeline">${items.map((item) => `<li class="${item.completed ? 'done' : item.current ? 'current' : ''}"><time>${item.time}</time><span>${item.completed ? '✓' : item.current ? '→' : '○'}</span><div><b>${escapeHtml(item.title)}</b><small>${item.minutes}′</small></div></li>`).join('')}</ol></section>`;
  }

  const DailyLearningExperienceService = { homeView, plan: DailyPlanService, sessions: DailyLearningSessionService, quickPractice: DailyQuickPracticeService, habits: StudyHabitService, durations: DURATIONS };
  global.DailyLearningExperienceService = DailyLearningExperienceService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'daily-session': dailySessionView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    document.querySelectorAll('[data-daily-minutes]').forEach((button) => { button.onclick = () => { saveState({ preferredMinutes: safeMinutes(button.dataset.dailyMinutes) }); render(); }; });
    document.querySelector('[data-start-daily]')?.addEventListener('click', () => { const active = DailyLearningSessionService.active(); if (!active) DailyLearningSessionService.start(readState().preferredMinutes); setView('daily-session'); });
    document.querySelectorAll('[data-start-quick]').forEach((button) => { button.onclick = () => { if (!DailyQuickPracticeService.start()) toast(copy('Chưa đủ dữ liệu cho Quick Practice.', 'Quick Practice content is not ready.', '快速练习内容不足。')); }; });
    document.querySelectorAll('[data-daily-open]').forEach((button) => { button.onclick = () => { if (button.dataset.dailyOpen === 'quick') { if (!DailyQuickPracticeService.start()) toast(copy('Chưa đủ dữ liệu cho Quick Practice.', 'Quick Practice content is not ready.', '快速练习内容不足。')); return; } setView(button.dataset.dailyOpen); }; });
    document.querySelector('[data-complete-daily-task]')?.addEventListener('click', () => { DailyLearningSessionService.completeCurrent(); render(); });
    document.querySelectorAll('[data-daily-review]').forEach((button) => { button.onclick = () => { const mistake = DailyPlanService.latestMistake(); if (!mistake || !global.ManualReviewQueueService) return; const item = global.ManualReviewQueueService.add({ type: mistake.type === 'grammar' ? 'grammar' : 'sentence', sourceId: mistake.id, title: mistake.mistake || mistake.question, content: mistake.correction || mistake.explanation || mistake.question, status: 'today' }); if (item && button.dataset.dailyReview !== 'today') global.ManualReviewQueueService.decide(item.id, button.dataset.dailyReview); toast(button.dataset.dailyReview === 'later' ? copy('Đã lên lịch ôn sau.', 'Scheduled for later.', '已安排稍后复习。') : copy('Đã bỏ qua mục này.', 'Item skipped.', '已跳过该项目。')); render(); }; });
  };
  render();
})(window);
