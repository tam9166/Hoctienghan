/* Tiếng Hàn - TamHoanq — personal learning intelligence (local-first, cloud-compatible) */
(function buildLearningIntelligence(global) {
  'use strict';
  const app = global.KLEARN_APP;
  const data = global.KLEARN_LEARNING_INTELLIGENCE_DATA;
  if (!app || !data) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, getUserSrs, userScoped, saveUserScoped, PracticeService, LearnerProfileService, MasteryService, speakKorean, DictionaryService, VocabularyService } = app;
  const uid = () => state.currentUser?.id || '';
  const now = () => new Date().toISOString();
  const today = () => new Date().toISOString().slice(0, 10);
  const safeDate = (value) => { const time = new Date(value || 0).getTime(); return Number.isFinite(time) ? time : 0; };
  const daysSince = (value) => value ? Math.max(0, Math.floor((Date.now() - safeDate(value)) / 86400000)) : 30;
  const lang = () => global.I18nService?.getPreference?.() || document.documentElement?.lang || 'vi';
  const text = (value) => typeof value === 'string' ? value : (value?.[lang()] || value?.vi || Object.values(value || {})[0] || '');
  const list = (key) => userScoped?.(key) || [];
  const save = (key, value, limit = 100) => saveUserScoped?.(key, value, limit);
  const runtime = state.learningIntelligence || (state.learningIntelligence = { adaptive: {}, director: { date: '', completed: [] }, comeback: {}, fatigue: {} });
  const readPersisted = () => list(STORAGE_KEYS.learningIntelligence)[0] || { adaptive: {}, director: { date: '', completed: [] }, comeback: {}, fatigue: {} };
  const writePersisted = (value) => { const next = { ...value, userId: uid(), updatedAt: now() }; save(STORAGE_KEYS.learningIntelligence, [next], 5); Object.assign(runtime, next); return next; };
  const persisted = () => { const value = readPersisted(); Object.assign(runtime, value); return runtime; };

  const ExampleQualityService = {
    all() { return data.exampleQuality.filter((item) => item.verified === true); },
    byId(id) { return this.all().find((item) => item.id === id) || null; },
    forSituation(situation) { return this.all().filter((item) => !situation || item.situation === situation); },
    score(item) { return Math.max(0, Math.min(100, Number(item?.naturalScore) || 0)); }
  };

  const GrammarDependencyService = {
    all() { return data.grammarDependencies; },
    get(id) { return this.all().find((item) => item.id === id || item.korean === id) || null; },
    prerequisites(id) { return this.get(id)?.prerequisiteIds?.map((item) => this.get(item)).filter(Boolean) || []; },
    next(id) { return this.get(id)?.nextIds?.map((item) => this.get(item)).filter(Boolean) || []; },
    chain() { return this.all().map((item) => ({ ...item, prerequisites: this.prerequisites(item.id), next: this.next(item.id) })); }
  };

  const VocabularyImportanceService = {
    source(entry) { return data.vocabularyImportance[entry?.korean] || {}; },
    importance(entry) { const source = this.source(entry); return Math.max(1, Math.min(5, Number(entry?.frequencyScore || source.frequencyScore || (6 - Number(entry?.topikLevel || source.topikLevel || 3))) || 1)); },
    forgetRisk(card) { const overdue = card?.nextReview ? Math.max(0, daysSince(card.nextReview)) : daysSince(card?.lastReviewed); const mastery = Number(card?.mastery) || 0; return Math.max(1, Math.min(5, Math.round(1 + Math.min(3, overdue / 10) + (mastery < 60 ? 1 : 0)))); },
    rank(entry, card = null) { const importance = this.importance(entry); const forgetRisk = this.forgetRisk(card || entry); return { importance, forgetRisk, priority: importance * forgetRisk, stars: '★'.repeat(importance) + '☆'.repeat(5 - importance) }; },
    ranked(limit = 8) {
      const vocabulary = VocabularyService?.all?.() || [];
      const cards = getUserSrs?.() || [];
      return cards.map((card) => { const entry = vocabulary.find((item) => item.id === card.wordId || item.korean === card.korean) || card; return { ...entry, ...card, ...this.rank(entry, card) }; }).sort((a, b) => b.priority - a.priority).slice(0, limit);
    }
  };

  const AdaptiveDifficultyService = {
    config: {
      quiz: { values: ['easy', 'medium', 'hard'], labels: { easy: { vi: 'Dễ', en: 'Easy', 'zh-CN': '简单' }, medium: { vi: 'Vừa', en: 'Medium', 'zh-CN': '中等' }, hard: { vi: 'Khó', en: 'Hard', 'zh-CN': '困难' } } },
      grammar: { values: ['hints', 'normal', 'no-hints'], labels: { hints: { vi: 'Có gợi ý', en: 'Hints', 'zh-CN': '带提示' }, normal: { vi: 'Bình thường', en: 'Normal', 'zh-CN': '正常' }, 'no-hints': { vi: 'Không gợi ý', en: 'No hints', 'zh-CN': '无提示' } } },
      listening: { values: ['slow', 'normal', 'native'], labels: { slow: { vi: 'Chậm', en: 'Slow', 'zh-CN': '慢速' }, normal: { vi: 'Bình thường', en: 'Normal', 'zh-CN': '正常' }, native: { vi: 'Tốc độ tự nhiên', en: 'Native', 'zh-CN': '母语速度' } } },
      speaking: { values: ['support', 'normal', 'independent'], labels: { support: { vi: 'Nhiều hỗ trợ', en: 'More support', 'zh-CN': '更多提示' }, normal: { vi: 'Bình thường', en: 'Normal', 'zh-CN': '正常' }, independent: { vi: 'Tự diễn đạt', en: 'Independent', 'zh-CN': '独立表达' } } }
    },
    initial(activity) {
      const profile = LearnerProfileService?.get?.() || {}; const score = Number(profile.skillScores?.[activity] || 0); const values = this.config[activity]?.values || ['easy', 'medium', 'hard'];
      if (activity === 'listening') return score >= 80 ? 'native' : score < 50 ? 'slow' : 'normal';
      if (activity === 'grammar') return score >= 80 ? 'no-hints' : score < 50 ? 'hints' : 'normal';
      if (activity === 'speaking') return score >= 80 ? 'independent' : score < 50 ? 'support' : 'normal';
      return score >= 80 ? 'hard' : score < 50 ? 'easy' : values[1];
    },
    get(activity = 'quiz') { persisted(); const configured = runtime.adaptive?.[activity]; if (this.config[activity]?.values.includes(configured)) return configured; return this.initial(activity); },
    values(activity) { return this.config[activity]?.values || []; },
    label(activity, value) { return text(this.config[activity]?.labels?.[value] || value); },
    set(activity, value) { if (!this.config[activity]?.values.includes(value)) return this.get(activity); const current = persisted(); writePersisted({ ...current, adaptive: { ...(current.adaptive || {}), [activity]: value } }); return value; },
    record(activity, correct) {
      if (!this.config[activity]) return null; const current = persisted(); const previous = current.adaptive?.[activity]; const value = this.config[activity].values.includes(previous) ? previous : this.initial(activity); const outcomes = Array.isArray(current.adaptive?.[`${activity}History`]) ? current.adaptive[`${activity}History`] : []; outcomes.push(Boolean(correct)); const recent = outcomes.slice(-8); let index = this.config[activity].values.indexOf(value);
      if (recent.slice(-3).length === 3 && recent.slice(-3).every(Boolean)) index = Math.min(this.config[activity].values.length - 1, index + 1);
      if (recent.slice(-2).length === 2 && recent.slice(-2).every((item) => !item)) index = Math.max(0, index - 1);
      const nextValue = this.config[activity].values[index]; writePersisted({ ...current, adaptive: { ...(current.adaptive || {}), [activity]: nextValue, [`${activity}History`]: recent } }); return nextValue;
    }
  };

  function skillScore(profile, progress, skill) { const profileScore = Number(profile?.skillScores?.[skill]); const progressScore = Number(progress?.skills?.[skill]); return Number.isFinite(profileScore) && profileScore > 0 ? profileScore : Number.isFinite(progressScore) && progressScore > 0 ? progressScore : null; }
  const LearningDirectorService = {
    plan() {
      const progress = getUserProgress?.() || {}; const profile = LearnerProfileService?.get?.() || {}; const cards = VocabularyService?.dueCards?.() || (getUserSrs?.() || []).filter((item) => safeDate(item.nextReview) <= Date.now()); const errors = global.ErrorNotebookService?.top?.(20) || []; const tasks = [];
      if (cards.length) tasks.push({ id: 'srs', type: 'review', title: `Ôn ${Math.min(cards.length, 20)} từ sắp quên`, minutes: Math.min(15, Math.max(5, cards.length)), reason: 'SRS cho biết các từ này đã đến thời điểm gặp lại.', route: 'review' });
      else tasks.push({ id: 'srs', type: 'review', title: 'Ôn 5 từ nền tảng', minutes: 5, reason: 'Một lượt ôn ngắn giúp duy trì nhịp ghi nhớ.', route: 'review' });
      const error = errors[0]; if (error) tasks.push({ id: 'error', type: 'repair', title: `Sửa lỗi ${error.correction || error.topic || 'gần đây'}`, minutes: 5, reason: `Bạn đã gặp lỗi này ${Number(error.count || error.occurrences || 1)} lần; xử lý một điểm sẽ hiệu quả hơn học dàn trải.`, route: 'error-notebook' });
      const skills = ['listening', 'grammar', 'vocabulary', 'speaking', 'reading', 'writing'].map((skill) => ({ skill, score: skillScore(profile, progress, skill) })).filter((item) => item.score !== null).sort((a, b) => a.score - b.score); const weak = skills[0];
      if (weak) tasks.push({ id: `skill-${weak.skill}`, type: 'skill', title: `Luyện ${({ listening: 'nghe', grammar: 'ngữ pháp', vocabulary: 'từ vựng', speaking: 'nói', reading: 'đọc', writing: 'viết' })[weak.skill]}`, minutes: 10, reason: `Điểm hiện tại ${weak.score}%; thêm một phiên ngắn để củng cố kỹ năng này.`, route: weak.skill === 'speaking' ? 'speaking-hub' : weak.skill === 'writing' ? 'writing-hub' : weak.skill === 'vocabulary' ? 'vocabulary-hub' : weak.skill === 'listening' ? 'listening-studio' : weak.skill === 'grammar' ? 'grammar-compare' : 'skill-hub', skill: weak.skill });
      const current = persisted(); const completed = current.director?.date === today() ? (current.director.completed || []) : []; return { date: today(), totalMinutes: tasks.reduce((sum, item) => sum + item.minutes, 0), tasks, completed, goal: global.RealGoalPlannerService?.current?.()?.title || state.currentUser?.goalLabel || '' };
    },
    complete(id) { const current = persisted(); const director = current.director?.date === today() ? current.director : { date: today(), completed: [] }; if (!director.completed.includes(id)) director.completed = [...director.completed, id]; writePersisted({ ...current, director }); return director.completed; },
    isComplete(id) { return this.plan().completed.includes(id); }
  };

  const ComebackModeService = {
    lastActivity() { const sources = [PracticeService?.getHistory?.()?.map((item) => item.completedAt), global.LearningJournalService?.all?.()?.map((item) => item.createdAt || item.date), list(STORAGE_KEYS.progress)?.map((item) => item.updatedAt)]; return sources.flat().map(safeDate).filter(Boolean).sort((a, b) => b - a)[0] || 0; },
    status() { const last = this.lastActivity(); const awayDays = last ? Math.floor((Date.now() - last) / 86400000) : 0; return { active: awayDays >= 7, awayDays, lastActivity: last ? new Date(last).toISOString() : null, days: 7, day: Math.min(7, Math.max(1, awayDays - 6)), tasks: [{ id: 'comeback-srs', title: 'Ôn 10 từ quan trọng', minutes: 5 }, { id: 'comeback-error', title: 'Sửa 1 lỗi quen thuộc', minutes: 3 }, { id: 'comeback-lesson', title: 'Học 1 bài ngắn', minutes: 5 }] }; },
    dismiss() { const current = persisted(); writePersisted({ ...current, comeback: { dismissedOn: today() } }); }
  };

  const FatigueDetectionService = {
    analyze() {
      const history = PracticeService?.getHistory?.() || []; const recent = history.filter((item) => Date.now() - safeDate(item.completedAt) <= 14 * 86400000); const previous = history.filter((item) => { const age = Date.now() - safeDate(item.completedAt); return age > 14 * 86400000 && age <= 28 * 86400000; }); const signals = []; const skips = recent.reduce((sum, item) => sum + Number(item.skipped || item.skips || 0), 0); const wrong = recent.reduce((sum, item) => sum + Number(item.wrong || 0), 0); const total = recent.reduce((sum, item) => sum + Number(item.total || item.questionCount || 0), 0); const activeSession = PracticeService?.getMeta?.()?.activeSession; if (activeSession?.startedAt && Date.now() - safeDate(activeSession.startedAt) > 60 * 60 * 1000) signals.push('bỏ dở một phiên học'); if (skips >= 2) signals.push('nhiều lượt bỏ qua'); if (total >= 5 && wrong / total >= .45) signals.push('lặp lại lỗi'); if (previous.length >= 2 && recent.length < previous.length / 2) signals.push('nhịp học giảm'); const score = signals.length; return { score, signals, gentle: score >= 2 ? 'Có vẻ bạn đang cần một nhịp học nhẹ hơn. Thử 10 phút, rồi dừng khi thấy đủ.' : '' }; },
    shouldSuggest() { return this.analyze().score >= 2; }
  };

  const NativeAudioService = {
    speeds: data.audioSpeeds,
    play(korean, speed = 'normal') { const option = this.speeds.find((item) => item.id === speed) || this.speeds[1]; speakKorean?.(korean, option.rate); return { korean, speed: option.id, rate: option.rate }; },
    label(speed) { return text(this.speeds.find((item) => item.id === speed)?.label || speed); }
  };

  const KoreanFeedService = {
    current(date = today()) { const day = String(Number(date.slice(-2)) || 1).padStart(2, '0'); return data.dailyFeed.find((item) => item.dateKey === day) || data.dailyFeed[0]; },
    all() { return data.dailyFeed; }
  };

  const PersonalLearningReportService = {
    report() {
      const history = PracticeService?.getHistory?.() || []; const month = today().slice(0, 7); const attempts = history.filter((item) => String(item.completedAt || '').slice(0, 7) === month); const focusMinutes = list(STORAGE_KEYS.focusSessions).filter((item) => String(item.completedAt || '').slice(0, 7) === month).reduce((sum, item) => sum + Number(item.actualMinutes || 0), 0); const minutes = attempts.reduce((sum, item) => sum + (Number(item.durationSeconds || item.duration || 0) / 60), 0) + focusMinutes; const progress = getUserProgress?.() || {}; const profile = LearnerProfileService?.get?.() || {}; const cards = getUserSrs?.() || []; const mastered = cards.filter((item) => item.status === 'mastered' || Number(item.mastery) >= 85).length; const skills = ['vocabulary', 'grammar', 'listening', 'speaking', 'writing', 'reading'].map((skill) => ({ skill, score: skillScore(profile, progress, skill) })).filter((item) => item.score !== null); return { month, minutes: Math.round(minutes), attempts: attempts.length, mastered, average: attempts.length ? Math.round(attempts.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / attempts.length) : null, strengths: skills.slice().sort((a, b) => b.score - a.score).slice(0, 2), weaknesses: skills.slice().sort((a, b) => a.score - b.score).slice(0, 2), skills, source: 'practice-history-focus-sessions-and-user-progress' }; }
  };

  function heading(back, eyebrow, title, subtitle) { return `<section class="section page-heading"><button class="back-link" data-view="${escapeHtml(back)}">← Quay lại</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(subtitle)}</p></section>`; }
  function skillLabel(skill) { return ({ vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', speaking: 'Nói', writing: 'Viết', reading: 'Đọc' })[skill] || skill; }
  function personalReportView() { const report = PersonalLearningReportService.report(); return `${heading('profile', 'Báo cáo cá nhân', 'Tóm tắt tiến độ học', 'Chỉ dùng dữ liệu thật từ những buổi học và lượt ôn của bạn.')}<section class="personal-report-summary section"><div><b>${report.minutes || 0}</b><span>phút luyện trong tháng</span></div><div><b>${report.mastered}</b><span>từ đã thành thạo</span></div><div><b>${report.attempts}</b><span>lượt luyện</span></div><div><b>${report.average === null ? '—' : `${report.average}%`}</b><span>điểm trung bình</span></div></section><section class="card section"><h2 class="section-title">Kỹ năng nổi bật</h2>${report.skills.length ? `<div class="report-skill-list">${report.skills.map((item) => `<div class="report-skill-row"><span>${escapeHtml(skillLabel(item.skill))}</span><strong>${item.score}%</strong><div class="bar"><span style="width:${item.score}%"></span></div></div>`).join('')}</div><p class="subtle">Điểm mạnh: ${report.strengths.map((item) => skillLabel(item.skill)).join(', ') || 'đang hình thành'} · Cần thêm thời gian: ${report.weaknesses.map((item) => skillLabel(item.skill)).join(', ') || 'chưa đủ dữ liệu'}.</p>` : '<p class="subtle">Chưa đủ dữ liệu để tạo biểu đồ kỹ năng. Hãy hoàn thành một hoạt động học.</p>'}</section><section class="card section"><h2 class="section-title">Nguồn dữ liệu</h2><p class="subtle">${report.attempts} bài luyện trong tháng này và ${report.mastered} thẻ SRS có trạng thái thành thạo. Không có số liệu ước đoán.</p><button class="btn secondary" data-view="home">Về kế hoạch hôm nay</button></section>`; }

  function directorCard() { const plan = LearningDirectorService.plan(); return `<section class="card section learning-director-card" data-learning-director><header class="section-heading"><div><p class="eyebrow">Today's Learning Plan</p><h2 class="section-title">Hôm nay bạn nên học</h2><p class="subtle">${plan.goal ? `Theo mục tiêu: ${escapeHtml(plan.goal)}` : 'Một kế hoạch ngắn dựa trên dữ liệu học gần đây.'}</p></div><span class="time-badge">${plan.totalMinutes} phút</span></header><ol class="director-task-list">${plan.tasks.map((task) => `<li class="director-task ${plan.completed.includes(task.id) ? 'is-complete' : ''}"><div><span class="director-check">${plan.completed.includes(task.id) ? '✓' : '○'}</span><div><b>${escapeHtml(task.title)}</b><small>${task.minutes} phút · ${escapeHtml(task.reason)}</small></div></div><div class="director-task-actions"><button class="btn secondary" data-director-open="${escapeHtml(task.route)}">Mở</button><button class="text-link" data-director-complete="${escapeHtml(task.id)}">${plan.completed.includes(task.id) ? 'Đã xong' : 'Đánh dấu xong'}</button></div></li>`).join('')}</ol></section>`; }
  function comebackCard() { const status = ComebackModeService.status(); const current = persisted(); if (!status.active || current.comeback?.dismissedOn === today()) return ''; return `<section class="card section comeback-card"><div><p class="eyebrow">Chào mừng quay lại</p><h2 class="section-title">Kế hoạch phục hồi ${status.day}/7</h2><p class="subtle">Bạn đã nghỉ ${status.awayDays} ngày. Hôm nay chỉ cần một nhịp nhẹ, không cần học bù.</p></div><ul>${status.tasks.map((item) => `<li><b>${escapeHtml(item.title)}</b><span>${item.minutes} phút</span></li>`).join('')}</ul><button class="text-link" data-comeback-dismiss>Ẩn gợi ý hôm nay</button></section>`; }
  function fatigueCard() { const fatigue = FatigueDetectionService.analyze(); if (!fatigue.gentle) return ''; return `<section class="card section fatigue-card"><p class="eyebrow">Nhịp học</p><h2 class="section-title">Học nhẹ một chút nhé</h2><p>${escapeHtml(fatigue.gentle)}</p><small>Dấu hiệu: ${escapeHtml(fatigue.signals.join(' · '))}</small><button class="btn secondary" data-view="focus-study">Bắt đầu 10 phút</button></section>`; }
  function feedCard() { const item = KoreanFeedService.current(); return `<section class="card section korean-today-card"><header class="section-heading"><div><p class="eyebrow">Korean Today</p><h2 class="section-title">Một mẩu tiếng Hàn hôm nay</h2></div><span class="verified-badge">✓ Đã biên tập</span></header><div class="feed-phrase"><b lang="ko">${escapeHtml(item.phrase)}</b><span>${escapeHtml(item.translation)}</span><button class="audio-btn" data-intelligence-audio="${escapeHtml(item.phrase)}" data-audio-speed="normal" aria-label="Nghe câu mẫu">🔊</button></div><p class="feed-note"><strong>💡 Người Hàn thường dùng:</strong> ${escapeHtml(item.cultureNote)}</p><div class="feed-reading"><p lang="ko">${escapeHtml(item.reading)}</p><small>${escapeHtml(item.readingTranslation)}</small></div><div class="feed-vocab"><span>Từ trong ngày</span><b lang="ko">${escapeHtml(item.vocabulary.korean)}</b><small>${escapeHtml(item.vocabulary.meaning)}</small></div><div class="audio-speed-row">${data.audioSpeeds.map((speed) => `<button class="chip" data-intelligence-audio="${escapeHtml(item.phrase)}" data-audio-speed="${speed.id}">${escapeHtml(text(speed.label))}</button>`).join('')}</div></section>`; }
  function skillRadarCard() { const progress = getUserProgress?.() || {}; const profile = LearnerProfileService?.get?.() || {}; const skills = ['vocabulary', 'grammar', 'listening', 'speaking', 'writing', 'reading'].map((skill) => ({ skill, score: skillScore(profile, progress, skill) })); return `<section class="card section skill-radar-card"><header class="section-heading"><div><p class="eyebrow">Skill Radar</p><h2 class="section-title">Bức tranh kỹ năng</h2></div><button class="text-link" data-view="personal-report">Xem báo cáo</button></header><div class="skill-radar-list">${skills.map((item) => `<div class="skill-radar-row"><span>${escapeHtml(skillLabel(item.skill))}</span>${item.score === null ? '<em>Chưa có dữ liệu</em>' : `<strong>${item.score}%</strong><div class="bar"><span style="width:${Math.min(100, item.score)}%"></span></div>`}</div>`).join('')}</div><p class="subtle">Điểm được tính từ quiz, luyện tập và mastery hiện có.</p></section>`; }
  function adaptiveCard() { const labels = { quiz: 'Quiz', grammar: 'Ngữ pháp', listening: 'Nghe', speaking: 'Nói' }; return `<section class="card section adaptive-controls-card"><header class="section-heading"><div><p class="eyebrow">Adaptive Practice</p><h2 class="section-title">Mức độ tự điều chỉnh</h2></div><span class="verified-badge">Theo kết quả thật</span></header><div class="adaptive-controls-list">${Object.keys(labels).map((activity) => `<label class="adaptive-control-row"><span><b>${labels[activity]}</b><small>${activity === 'quiz' ? 'Độ khó câu hỏi' : activity === 'grammar' ? 'Mức gợi ý' : activity === 'listening' ? 'Tốc độ nghe' : 'Mức hỗ trợ'}</small></span><select data-adaptive-activity="${activity}">${AdaptiveDifficultyService.values(activity).map((value) => `<option value="${value}" ${value === AdaptiveDifficultyService.get(activity) ? 'selected' : ''}>${escapeHtml(AdaptiveDifficultyService.label(activity, value))}</option>`).join('')}</select></label>`).join('')}</div><p class="subtle">Ba lượt đúng liên tiếp sẽ tăng thử thách; hai lượt sai sẽ giảm một bậc. Trình độ gốc không thay đổi.</p></section>`; }
  function grammarDependencyCard() { const chain = GrammarDependencyService.chain(); return `<section class="card section grammar-dependency-card"><header class="section-heading"><div><p class="eyebrow">Lộ trình ngữ pháp</p><h2 class="section-title">Học theo thứ tự nền tảng</h2></div><button class="text-link" data-view="grammar-compare">Mở bài ngữ pháp</button></header><div class="grammar-chain">${chain.map((item, index) => `<div class="grammar-chain-node"><span>${index + 1}</span><div><b lang="ko">${escapeHtml(item.korean)}</b><small>${escapeHtml(item.titleVi)}</small></div>${index < chain.length - 1 ? '<i>↓</i>' : ''}</div>`).join('')}</div><p class="subtle">Mỗi bước hiển thị điều kiện cần biết trước và bước tiếp theo.</p></section>`; }
  function dictionaryQualityMarkup() {
    const entry = DictionaryService?.byId?.(state.dictionarySelectedId); if (!entry) return '';
    const example = ExampleQualityService.forSituation(entry.korean === '학교' ? 'daily-life' : '')[0];
    const rank = VocabularyImportanceService.rank(entry, (getUserSrs?.() || []).find((item) => item.wordId === entry.id));
    if (!example && !rank) return '';
    return `<section class="example-quality-panel"><div><p class="eyebrow">Ngữ cảnh & độ tin cậy</p><h3>Ví dụ đã kiểm chứng</h3><p class="subtle">${example ? `${escapeHtml(example.korean)} · tự nhiên ${example.naturalScore}/100 · dùng trong ${escapeHtml(example.situation)}` : 'Ví dụ đang được biên tập.'}</p></div><div class="importance-score"><span>Tầm quan trọng</span><b>${rank.stars}</b><small>Ưu tiên ôn ${rank.priority}/25 · rủi ro quên ${rank.forgetRisk}/5</small></div></section>`;
  }

  global.ExampleQualityService = ExampleQualityService;
  global.GrammarDependencyService = GrammarDependencyService;
  global.VocabularyImportanceService = VocabularyImportanceService;
  global.AdaptiveDifficultyService = AdaptiveDifficultyService;
  global.LearningDirectorService = LearningDirectorService;
  global.ComebackModeService = ComebackModeService;
  global.FatigueDetectionService = FatigueDetectionService;
  global.NativeAudioService = NativeAudioService;
  global.KoreanFeedService = KoreanFeedService;
  global.PersonalLearningReportService = PersonalLearningReportService;
  global.LearningIntelligenceService = { director: LearningDirectorService, adaptive: AdaptiveDifficultyService, comeback: ComebackModeService, fatigue: FatigueDetectionService, report: PersonalLearningReportService, feed: KoreanFeedService, examples: ExampleQualityService, grammar: GrammarDependencyService, vocabulary: VocabularyImportanceService, audio: NativeAudioService };
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'personal-report': personalReportView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (state.currentView === 'home' && !global.DailyLearningExperienceService) {
      const anchor = document.getElementById('homeMissionAnchor');
      if (!document.querySelector('[data-learning-director]')) {
        const markup = `${comebackCard()}${fatigueCard()}${directorCard()}${feedCard()}${skillRadarCard()}${grammarDependencyCard()}`;
        if (anchor) anchor.insertAdjacentHTML('afterend', markup + (state.currentUser.learningTrack === 'foundation' ? '' : adaptiveCard()));
        else if (state.currentUser.learningTrack === 'foundation') document.getElementById('app')?.insertAdjacentHTML('beforeend', `${directorCard()}${feedCard()}`);
        else document.getElementById('app')?.insertAdjacentHTML('beforeend', markup + adaptiveCard());
      }
      document.querySelectorAll('[data-director-open]').forEach((button) => { button.onclick = () => setView(button.dataset.directorOpen); });
      document.querySelectorAll('[data-director-complete]').forEach((button) => { button.onclick = () => { LearningDirectorService.complete(button.dataset.directorComplete); render(); }; });
      document.querySelector('[data-comeback-dismiss]')?.addEventListener('click', () => { ComebackModeService.dismiss(); render(); });
    }
    document.querySelectorAll('[data-intelligence-audio]').forEach((button) => { button.onclick = () => NativeAudioService.play(button.dataset.intelligenceAudio, button.dataset.audioSpeed || 'normal'); });
    document.querySelectorAll('[data-adaptive-activity]').forEach((select) => { select.onchange = () => { AdaptiveDifficultyService.set(select.dataset.adaptiveActivity, select.value); toast(`Đã chọn mức ${AdaptiveDifficultyService.label(select.dataset.adaptiveActivity, select.value)}.`); }; });
    document.querySelectorAll('[data-view]').forEach((button) => { if (!button.onclick) button.onclick = () => setView(button.dataset.view); });
    if (state.currentView === 'grammar-compare' && !document.querySelector('.grammar-dependency-card')) document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', grammarDependencyCard());
    if (['practice-hub', 'practice', 'listening-studio', 'speaking-room'].includes(state.currentView) && !document.querySelector('.adaptive-controls-card')) document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', adaptiveCard());
    if (state.currentView === 'dictionary' && state.dictionarySelectedId && !document.querySelector('.example-quality-panel')) { const target = document.querySelector('.dictionary-entry'); const markup = dictionaryQualityMarkup(); if (target && markup) target.insertAdjacentHTML('beforeend', markup); }
  };
  render();
})(window);
