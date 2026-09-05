/* K-Learn VN — local-first adaptive learning engine */
(function () {
  'use strict';
  const app = window.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, userScoped, saveUserScoped, LearnerProfileService, PracticeService, CloudSyncService } = app;
  const uid = () => state.currentUser?.id || '';
  const now = () => new Date().toISOString();
  const normalizeSearch = (value = '') => String(value).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  const dateKey = (date = new Date()) => { const d = new Date(date); return d.toISOString().slice(0, 10); };
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
  const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const readUserMap = (key) => safeObject(storage.get(key, {}));
  const writeUserMap = (key, value, syncLabel) => { const map = readUserMap(key); map[uid()] = value; storage.set(key, map); if (syncLabel) CloudSyncService.schedule(syncLabel); };
  const skillLabel = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', reading: 'Đọc', writing: 'Viết', speaking: 'Nói' };
  const skillViews = { vocabulary: 'review', grammar: 'practice-hub', listening: 'skill-hub', reading: 'practice-hub', writing: 'writing-hub', speaking: 'speaking-hub' };
  const reasonText = (item) => item.reasons.join(' · ');
  const STYLE_FOCUS = { visual: ['vocabulary', 'reading', 'writing'], audio: ['listening', 'speaking'], grammar: ['grammar', 'writing'], conversation: ['speaking', 'listening'], exam: ['reading', 'listening', 'grammar'] };
  const MODE_FOCUS = { casual: ['vocabulary', 'listening'], topik: ['listening', 'reading', 'grammar', 'vocabulary'], conversation: ['speaking', 'listening'], work: ['speaking', 'listening', 'vocabulary'] };

  function recentActivity() {
    const history = PracticeService.getHistory?.() || [];
    const dates = history.map((item) => item.completedAt || item.createdAt).filter(Boolean).map((item) => new Date(item).getTime()).filter(Number.isFinite);
    const last = dates.length ? Math.max(...dates) : 0;
    return { history, last, daysSince: last ? Math.max(0, Math.floor((Date.now() - last) / 86400000)) : 999 };
  }

  function prioritySignals() {
    const profile = LearnerProfileService.get() || {};
    const progress = getUserProgress() || {};
    const stats = PracticeService.statistics?.() || {};
    const errors = window.ErrorNotebookService?.all?.() || [];
    const topErrors = errors.filter((item) => !item.resolved).reduce((acc, item) => {
      const type = item.type === 'grammar' ? 'grammar' : (item.type === 'speaking' ? 'speaking' : item.type === 'writing' ? 'writing' : null);
      if (type) acc[type] = (acc[type] || 0) + (Number(item.count) || 1);
      return acc;
    }, {});
    const due = Number(profile.dueSrsCount || 0) || (state.srsData || []).filter((item) => item.nextReview && new Date(item.nextReview) <= new Date()).length;
    const scores = { vocabulary: profile.skillScores?.vocabulary ?? progress.skills?.vocabulary ?? 0, grammar: profile.skillScores?.grammar ?? progress.skills?.grammar ?? 0, listening: profile.skillScores?.listening ?? progress.skills?.listening ?? 0, reading: profile.skillScores?.reading ?? progress.skills?.reading ?? 0, writing: profile.skillScores?.writing ?? progress.skills?.writing ?? 0, speaking: profile.skillScores?.speaking ?? progress.skills?.speaking ?? 0 };
    const weakSkills = new Set([...(profile.weakSkills || []), ...(stats.weakTopics || []).map((item) => Array.isArray(item) ? item[0] : item)].map((item) => String(item).toLocaleLowerCase()));
    const activity = recentActivity();
    const target = Number(profile.targetTopikLevel || state.currentUser?.targetTopikLevel || 2);
    const memories = window.LearningMemoryService?.all?.() || [];
    const graphWeakness = window.KnowledgeGraphService?.weaknessAnalysis?.() || [];
    return { profile, progress, stats, topErrors, due, scores, weakSkills, activity, target, memories, graphWeakness };
  }

  function buildPriorities() {
    const s = prioritySignals();
    return Object.keys(skillLabel).map((id) => {
      const score = Number(s.scores[id]) || 0;
      const focusMemory = s.memories.find((item) => ['weak_knowledge', 'repeated_mistake'].includes(item.type) && normalizeSearch(`${item.topic} ${item.content}`).includes(id));
      const focusNode = s.graphWeakness.find((item) => normalizeSearch(`${item.id} ${item.label} ${item.type}`).includes(id));
      const reasons = [];
      let points = 0;
      if (score < 60 || s.weakSkills.has(id) || s.weakSkills.has(skillLabel[id].toLocaleLowerCase())) { points += 3; reasons.push('kỹ năng yếu'); }
      if ((s.topErrors[id] || 0) >= 2) { points += 3; reasons.push(`${s.topErrors[id]} lỗi lặp`); }
      if (focusMemory) { points += 2; reasons.push(`memory: ${focusMemory.topic}`); }
      const taskLast = s.activity.history.find((item) => item.skill === id || item.skillBreakdown?.[id] !== undefined);
      const staleDays = taskLast?.completedAt ? Math.floor((Date.now() - new Date(taskLast.completedAt).getTime()) / 86400000) : s.activity.daysSince;
      if (staleDays >= 3 || !taskLast) { points += 2; reasons.push(staleDays >= 3 ? 'lâu chưa luyện' : 'chưa có lịch sử'); }
      if (id === 'vocabulary' && s.due > 0) { points += 3; reasons.push(`${s.due} thẻ SRS đến hạn`); }
      if (['reading', 'listening', 'grammar', 'vocabulary'].includes(id) && s.target >= 3) { points += 2; reasons.push(`liên quan TOPIK ${s.target}`); }
      if (focusNode?.weaknessScore >= 2) { points += 2; reasons.push(`graph yếu: ${focusNode.label}`); }
      const style = s.profile.learningStyle || state.currentUser?.learningStyle || 'visual'; const mode = s.profile.learningMode || state.currentUser?.learningMode || 'casual';
      if ((STYLE_FOCUS[style] || []).includes(id)) { points += 2; reasons.push(`hợp phong cách ${style}`); }
      if ((MODE_FOCUS[mode] || []).includes(id)) { points += 2; reasons.push(`phù hợp chế độ ${mode}`); }
      if (!reasons.length) reasons.push('duy trì nhịp học');
      const minutes = id === 'vocabulary' ? 8 : (id === 'speaking' || id === 'writing' ? 7 : 6);
      return { id, type: id, title: `${skillLabel[id]}${focusNode ? ` · ${focusNode.label}` : focusMemory && focusMemory.topic !== id ? ` · ${focusMemory.topic}` : ''}`, score: points, rawScore: clamp(score), reasons, reason: reasonText({ reasons }), minutes, actionView: skillViews[id] };
    }).sort((a, b) => b.score - a.score || b.rawScore - a.rawScore || a.id.localeCompare(b.id));
  }

  const DailyMissionService = {
    getAll() { return uid() ? (readUserMap(STORAGE_KEYS.dailyMissions)[uid()] || []) : []; },
    getToday() {
      if (!uid()) return null;
      const today = dateKey(); const existing = this.getAll().find((item) => item.date === today);
      if (existing && (existing.generatedBy === 'adaptive-memory-v3' || existing.completed)) return existing;
      const signals = prioritySignals();
      const baseMinutes = Number(state.currentUser?.studyMinutesPerDay || signals.profile.studyMinutesPerDay || 20) || 20;
      const reduced = signals.activity.daysSince >= 3 || Number(signals.progress.stats?.streak || 0) === 0;
      const totalMinutes = Math.max(10, Math.min(90, reduced ? Math.min(baseMinutes, 15) : baseMinutes));
      const priorities = buildPriorities().slice(0, 3).map((item, index) => ({ ...item, minutes: index === 0 ? Math.max(item.minutes, Math.round(totalMinutes * .4)) : item.minutes }));
      const mission = { id: `mission-${uid()}-${today}`, userId: uid(), date: today, generatedAt: now(), totalMinutes, priorities, reducedPlan: reduced, habitHint: this.habitHint(signals.activity), completed: false, completedItems: [], generatedBy: 'adaptive-memory-v3', learningStyle: signals.profile.learningStyle, learningMode: signals.profile.learningMode };
      writeUserMap(STORAGE_KEYS.dailyMissions, [mission, ...this.getAll().filter((item) => item.date !== today)].slice(0, 30), 'adaptive-mission');
      return mission;
    },
    habitHint(activity = recentActivity()) { if (!activity.last) return 'Bắt đầu bằng một phiên ngắn để tạo nhịp học.'; const hour = new Date(activity.last).getHours(); return `Bạn thường học khoảng ${String(hour).padStart(2, '0')}:00 — giữ khung giờ này nếu thuận tiện.`; },
    complete(itemId) { const mission = this.getToday(); if (!mission) return; mission.completedItems = [...new Set([...(mission.completedItems || []), itemId || 'mission'])]; mission.completed = mission.completedItems.includes('mission') || mission.completedItems.length >= mission.priorities.length; writeUserMap(STORAGE_KEYS.dailyMissions, [mission, ...this.getAll().filter((item) => item.id !== mission.id)].slice(0, 30), 'adaptive-mission'); return mission; },
    start(item) { const target = typeof item === 'string' ? this.getToday()?.priorities?.find((entry) => entry.id === item) : item; if (target?.actionView) setView(target.actionView); }
  };

  function defaultGoal() { const user = state.currentUser || {}; return { id: `goal-${uid()}`, userId: uid(), goalType: user.goals?.includes('topik') ? 'topik' : 'communication', targetLevel: Number(user.targetTopikLevel || 2), dailyMinutes: Number(user.studyMinutesPerDay || 20), deadline: '', createdAt: now(), updatedAt: now() }; }
  const GoalTrackingService = {
    getGoal() { return uid() ? (readUserMap(STORAGE_KEYS.learningGoals)[uid()] || defaultGoal()) : null; },
    saveGoal(input = {}) { if (!uid()) return null; const previous = this.getGoal() || defaultGoal(); const goal = { ...previous, ...input, id: previous.id || `goal-${uid()}`, userId: uid(), targetLevel: clamp(input.targetLevel || previous.targetLevel, 1, 6), dailyMinutes: Math.max(5, Math.min(180, Number(input.dailyMinutes || previous.dailyMinutes || 20))), updatedAt: now() }; writeUserMap(STORAGE_KEYS.learningGoals, goal, 'adaptive-goal'); return goal; },
    progress(goal = this.getGoal()) { const s = prioritySignals(); const current = Number(s.profile.currentTopikLevel || state.currentUser?.currentTopikLevel || 1); const target = Number(goal?.targetLevel || 2); const levelPart = target <= current ? 100 : clamp((current - 1) / Math.max(1, target - 1) * 100); const avg = Number(s.stats.average || 0); return Math.round(clamp(levelPart * .65 + avg * .35)); },
    daysRemaining(goal = this.getGoal()) { if (!goal?.deadline) return null; return Math.max(0, Math.ceil((new Date(`${goal.deadline}T23:59:59`).getTime() - Date.now()) / 86400000)); }
  };

  const RoadmapService = {
    get(goal = GoalTrackingService.getGoal()) { if (!uid() || !goal) return []; const maps = readUserMap(STORAGE_KEYS.adaptiveRoadmaps); if (maps[uid()]?.goalUpdatedAt === goal.updatedAt) return maps[uid()].phases || []; const current = Number(state.currentUser?.currentTopikLevel || 1); const target = Number(goal.targetLevel || 2); const phases = [{ title: 'Củng cố nền tảng', weeks: 2, focus: ['vocabulary', 'grammar'] }, { title: 'Tăng phản xạ nghe – đọc', weeks: 3, focus: ['listening', 'reading'] }, { title: 'Luyện đầu ra', weeks: 3, focus: ['speaking', 'writing'] }, { title: `Bứt tốc TOPIK ${target}`, weeks: Math.max(3, target - current + 2), focus: ['vocabulary', 'grammar', 'reading'] }, { title: 'Thi thử có chiến lược', weeks: 2, focus: ['reading', 'listening'] }, { title: 'Ôn điểm yếu cuối chặng', weeks: 2, focus: buildPriorities().slice(0, 2).map((item) => item.id) }].map((phase, index) => ({ ...phase, index: index + 1, status: index === 0 ? 'active' : 'planned', rationale: `Ưu tiên ${phase.focus.map((item) => skillLabel[item]).join(', ')} dựa trên dữ liệu hiện tại.` })); writeUserMap(STORAGE_KEYS.adaptiveRoadmaps, { goalUpdatedAt: goal.updatedAt, generatedAt: now(), phases }, 'adaptive-roadmap'); return phases; },
    async generateWithAI(goal = GoalTrackingService.getGoal()) { const fallback = this.get(goal); if (!window.AICoachService?.request) return { text: 'Dịch vụ gợi ý chưa sẵn sàng; lộ trình trên thiết bị vẫn hoạt động.', phases: fallback, source: 'rules' }; try { const text = await window.AICoachService.request(`Hãy đề xuất lộ trình học tiếng Hàn theo tuần cho mục tiêu TOPIK ${goal.targetLevel}, ${goal.dailyMinutes} phút/ngày, deadline ${goal.deadline || 'chưa đặt'}. Dựa duy nhất trên learner context; không bịa điểm số. Trả lời tiếng Việt ngắn gọn, có ưu tiên kỹ năng và cách đo tiến bộ.`); return { text, phases: fallback, source: 'ai+rules' }; } catch (error) { return { text: `${error.message} Lộ trình local vẫn được giữ bên dưới.`, phases: fallback, source: 'rules' }; } }
  };

  function missionCard() { const mission = DailyMissionService.getToday(); if (!mission) return ''; const top = mission.priorities || []; return `<section class="card section adaptive-mission-home"><div class="section-heading"><div><p class="eyebrow">Kế hoạch cá nhân</p><h2 class="section-title">Nhiệm vụ hôm nay</h2></div><span class="level-pill">${mission.totalMinutes} phút</span></div><p class="subtle">${mission.reducedPlan ? 'Phiên rút gọn để lấy lại nhịp học.' : 'Ba hoạt động quan trọng nhất cho hôm nay.'}</p><div class="mission-priority-list">${top.map((item, index) => `<button class="mission-priority ${mission.completedItems?.includes(item.id) ? 'done' : ''}" data-adaptive-start="${item.id}"><span class="mission-rank">${index + 1}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.reason?.split('·')[0]?.trim() || 'Theo tiến độ hiện tại')}</small></span><em>${item.minutes}′</em></button>`).join('')}</div><div class="action-row"><button class="btn primary" data-view="adaptive-plan">${mission.completed ? 'Xem lại kế hoạch' : 'Bắt đầu học'}</button><button class="btn secondary" data-view="adaptive-plan">Xem lộ trình</button></div></section>`; }
  function goalCard() { const goal = GoalTrackingService.getGoal(); if (!goal) return ''; const progress = GoalTrackingService.progress(goal); const days = GoalTrackingService.daysRemaining(goal); return `<section class="card section adaptive-goal-home"><div class="section-heading"><div><p class="eyebrow">🎯 Mục tiêu cá nhân</p><h2 class="section-title">TOPIK ${goal.targetLevel}</h2></div><span class="level-pill">${progress}%</span></div><div class="bar"><span style="width:${progress}%"></span></div><p class="subtle">${days === null ? 'Chưa đặt deadline.' : `${days} ngày còn lại`} · ${goal.dailyMinutes} phút/ngày</p><button class="btn secondary" data-view="adaptive-plan">Điều chỉnh mục tiêu & lộ trình</button></section>`; }
  function adaptiveView() { const mission = DailyMissionService.getToday(); const goal = GoalTrackingService.getGoal(); const phases = RoadmapService.get(goal); const progress = GoalTrackingService.progress(goal); const days = GoalTrackingService.daysRemaining(goal); return `<section class="section page-heading"><p class="eyebrow">Kế hoạch cá nhân</p><h1 class="headline">Kế hoạch học của bạn</h1><p class="subtle">Ưu tiên được tính từ điểm kỹ năng, lỗi lặp, SRS đến hạn, thời gian bỏ trống và mục tiêu TOPIK. Cùng một ngày sẽ giữ nguyên kế hoạch khi tải lại.</p></section><section class="card section adaptive-mission"><div class="section-heading"><div><p class="eyebrow">Nhiệm vụ · ${mission.date}</p><h2 class="section-title">${mission.totalMinutes} phút có chủ đích</h2></div><span class="sync-status">${mission.completed ? '✓ Đã hoàn thành' : `${mission.completedItems?.length || 0}/${mission.priorities.length} mục`}</span></div><div class="mission-priority-list">${mission.priorities.map((item, index) => `<article class="mission-priority ${mission.completedItems?.includes(item.id) ? 'done' : ''}"><span class="mission-rank">${index + 1}</span><span><b>${escapeHtml(item.title)} · ${item.score} điểm</b><small>${escapeHtml(item.reason)}</small></span><em>${item.minutes}′</em><button class="btn secondary" data-adaptive-start="${item.id}">Mở</button></article>`).join('')}</div><p class="subtle">${escapeHtml(mission.habitHint || '')}</p><button class="btn primary full" data-adaptive-complete="mission">${mission.completed ? 'Đã đánh dấu hoàn thành' : 'Đánh dấu nhiệm vụ đã hoàn thành'}</button></section><section class="card section adaptive-goal-form"><div class="section-heading"><div><p class="eyebrow">Mục tiêu học tập</p><h2 class="section-title">Mục tiêu & deadline</h2></div><span class="level-pill">${progress}%</span></div><form id="adaptiveGoalForm" class="coach-form"><label>Mục tiêu<select name="goalType"><option value="topik" ${goal.goalType === 'topik' ? 'selected' : ''}>Thi TOPIK</option><option value="communication" ${goal.goalType === 'communication' ? 'selected' : ''}>Giao tiếp</option><option value="study" ${goal.goalType === 'study' ? 'selected' : ''}>Du học</option><option value="work" ${goal.goalType === 'work' ? 'selected' : ''}>Làm việc / XKLĐ</option></select></label><label>TOPIK mục tiêu<select name="targetLevel">${[1,2,3,4,5,6].map((level) => `<option value="${level}" ${Number(goal.targetLevel) === level ? 'selected' : ''}>TOPIK ${level}</option>`).join('')}</select></label><label>Phút mỗi ngày<select name="dailyMinutes">${[15,20,30,45,60].map((value) => `<option value="${value}" ${Number(goal.dailyMinutes) === value ? 'selected' : ''}>${value} phút</option>`).join('')}</select></label><label>Deadline<input type="date" name="deadline" value="${escapeHtml(goal.deadline || '')}" min="${dateKey()}" /></label><button class="btn primary full" type="submit">Lưu mục tiêu & tạo roadmap</button></form><div class="roadmap-phase-list">${phases.map((phase) => `<article class="roadmap-phase ${phase.status}"><div><span class="phase-index">${phase.index}</span><b>${escapeHtml(phase.title)}</b><small>${phase.weeks} tuần · ${escapeHtml(phase.rationale)}</small></div><span>${phase.status === 'active' ? 'Đang học' : 'Sắp tới'}</span></article>`).join('')}</div><button class="btn secondary full" id="generateAdaptiveRoadmap">Tạo lộ trình phù hợp</button><div id="adaptiveRoadmapOutput" class="coach-output hidden"></div>${days !== null ? `<p class="subtle">Deadline còn ${days} ngày. Hệ thống sẽ ưu tiên mục tiêu này trong kế hoạch hôm nay.</p>` : ''}</section>`; }

  window.DailyMissionService = DailyMissionService;
  window.GoalTrackingService = GoalTrackingService;
  window.RoadmapService = RoadmapService;
  window.AdaptiveLearningEngine = { priorities: buildPriorities, dailyMission: DailyMissionService, goals: GoalTrackingService, roadmap: RoadmapService };
  const previousAfterRender = window.KLEARN_AFTER_RENDER;
  const previousHomeExtra = window.KLEARN_EXTRA_HOME;
  const previousProfileExtra = window.KLEARN_EXTRA_PROFILE;
  window.KLEARN_EXTRA_VIEWS = { ...(window.KLEARN_EXTRA_VIEWS || {}), 'adaptive-plan': adaptiveView };
  window.KLEARN_EXTRA_HOME = () => `${previousHomeExtra ? previousHomeExtra() : ''}${missionCard()}`;
  window.KLEARN_EXTRA_PROFILE = () => `${previousProfileExtra ? previousProfileExtra() : ''}${goalCard()}`;
  window.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (state.currentView === 'home' && !document.querySelector('.adaptive-mission-home')) (document.getElementById('homeMissionAnchor') || document.getElementById('app'))?.insertAdjacentHTML(document.getElementById('homeMissionAnchor') ? 'afterend' : 'beforeend', missionCard());
    if (state.currentView === 'profile' && !document.querySelector('.adaptive-goal-home')) document.getElementById('app')?.insertAdjacentHTML('afterbegin', goalCard());
    document.querySelectorAll('[data-view="adaptive-plan"]').forEach((button) => { button.onclick = () => setView('adaptive-plan'); });
    document.querySelectorAll('[data-adaptive-start]').forEach((button) => { button.onclick = () => { DailyMissionService.complete(button.dataset.adaptiveStart); DailyMissionService.start(button.dataset.adaptiveStart); }; });
    document.querySelectorAll('[data-adaptive-complete]').forEach((button) => { button.onclick = () => { DailyMissionService.complete(button.dataset.adaptiveComplete); toast('Đã lưu tiến độ nhiệm vụ hôm nay.'); render(); }; });
    const goalForm = document.getElementById('adaptiveGoalForm'); if (goalForm) goalForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(goalForm); GoalTrackingService.saveGoal({ goalType: String(form.get('goalType') || 'topik'), targetLevel: Number(form.get('targetLevel')) || 2, dailyMinutes: Number(form.get('dailyMinutes')) || 20, deadline: String(form.get('deadline') || '') }); toast('Đã lưu mục tiêu và tạo roadmap.'); render(); };
    const aiButton = document.getElementById('generateAdaptiveRoadmap'); if (aiButton) aiButton.onclick = async () => { aiButton.disabled = true; aiButton.textContent = 'Đang phân tích...'; const result = await RoadmapService.generateWithAI(); const output = document.getElementById('adaptiveRoadmapOutput'); if (output) { output.classList.remove('hidden'); output.innerHTML = escapeHtml(result.text).replace(/\n/g, '<br>'); } aiButton.disabled = false; };
  };
  render();
})();
