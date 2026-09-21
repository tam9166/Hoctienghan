/* P84-P3 — Personal Learning Intelligence & Adaptive Coach.
   Derived, private, local-first insights over existing learning evidence. */
(function personalLearningIntelligence(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app || !global.P82DeckService || !global.P84VocabularyHealthService || !global.P84ReviewIntelligenceService) return;
  const { state, STORAGE_KEYS, escapeHtml = String, render, setView, toast, getUserProgress, getUserSrs, userScoped, PracticeService, LearnerProfileService } = app;
  const DAY = 86400000; const MIN_EVIDENCE = 3; const cache = new Map(); let cacheSignature = '';
  const runtime = state.p84LearningIntelligence || (state.p84LearningIntelligence = { minutes: Number(state.currentUser?.studyMinutesPerDay || 10), reportPeriod: 'week' });
  const now = () => Date.now();
  const time = (value) => { const result = new Date(value || 0).getTime(); return Number.isFinite(result) ? result : 0; };
  const clean = (value, max = 200) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const cards = () => getUserSrs?.() || [];
  const decks = () => global.P82DeckService.all();
  const errors = () => (global.ErrorNotebookService?.all?.() || global.ErrorNotebookService?.top?.(200) || []).filter((item) => !item.resolved);
  const histories = () => decks().flatMap((deck) => (deck.sessionHistory || []).map((session) => ({ ...session, deckId: deck.id, deckTitle: deck.title })));
  const latestStamp = (items, fields) => Math.max(0, ...items.map((item) => Math.max(...fields.map((field) => time(item?.[field])))));
  function signature() {
    const values = cards(), deckValues = decks(), practice = PracticeService?.getHistory?.() || [], errorValues = errors(), progress = getUserProgress?.() || {};
    return [state.currentUser?.id, new Date().toISOString().slice(0, 13), values.length, latestStamp(values, ['updatedAt', 'lastReviewed', 'activatedAt']), deckValues.length, latestStamp(deckValues, ['updatedAt']), practice.length, latestStamp(practice, ['completedAt']), errorValues.length, errorValues.reduce((sum, item) => sum + Number(item.count || 1), 0), progress.updatedAt || ''].join('|');
  }
  function cached(key, factory) { const currentSignature = signature(); if (currentSignature !== cacheSignature) { cache.clear(); cacheSignature = currentSignature; } if (cache.has(key)) return cache.get(key); const value = factory(); cache.set(key, value); return value; }
  function activeCard(card) { return Boolean(card && (card.activatedAt || card.lastReviewed || Number(card.reviewCount) || Number(card.mastery) || ['learning', 'review', 'mastered'].includes(card.status))); }
  function due(card) { return activeCard(card) && card.nextReview && time(card.nextReview) <= now(); }
  function modeAggregate(mode, source = cards()) {
    const stats = source.map((card) => card.personalVocabularyEvidence?.modeStats?.[mode]).filter(Boolean);
    const attempts = stats.reduce((sum, item) => sum + Number(item.attempts || 0), 0); const correct = stats.reduce((sum, item) => sum + Number(item.correct || 0), 0);
    const wrongWords = source.filter((card) => Number(card.personalVocabularyEvidence?.modeStats?.[mode]?.wrong || 0) > 0).length;
    return { attempts, correct, wrong: Math.max(0, attempts - correct), wrongWords, accuracy: attempts >= MIN_EVIDENCE ? clamp(correct / attempts * 100) : null, enough: attempts >= MIN_EVIDENCE };
  }
  function allWords() { return decks().flatMap((deck) => global.P82DeckService.learningWords(deck.id).map((word) => ({ ...word, deckId: deck.id, deckTitle: deck.title }))); }
  function activityDates() {
    const stamps = [
      ...cards().flatMap((card) => [card.lastReviewed, card.activatedAt]),
      ...histories().map((item) => item.completedAt),
      ...(PracticeService?.getHistory?.() || []).map((item) => item.completedAt),
      ...(userScoped?.(STORAGE_KEYS.focusSessions) || []).map((item) => item.completedAt)
    ].map(time).filter(Boolean);
    return [...new Set(stamps.map((stamp) => new Date(stamp).toISOString().slice(0, 10)))].sort();
  }
  function practiceSkill(skill) {
    const values = (PracticeService?.getHistory?.() || []).flatMap((attempt) => Object.entries(attempt.skillBreakdown || {}).filter(([key]) => key === skill).map(([, score]) => Number(score))).filter(Number.isFinite);
    return { attempts: values.length, accuracy: values.length >= 2 ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : null, enough: values.length >= 2 };
  }
  function skillLabel(skill) { return ({ vocabulary: 'Vocabulary recall', reading: 'Reading', listening: 'Listening', context: 'Context', typing: 'Typing', grammar: 'Grammar', speaking: 'Speaking', writing: 'Writing' })[skill] || skill; }
  function routeFor(skill) { return skill === 'listening' || skill === 'context' || skill === 'typing' || skill === 'vocabulary' ? 'vocabulary-intelligence-p84' : skill === 'reading' ? 'practice-hub' : skill === 'writing' ? 'writing-hub' : skill === 'speaking' ? 'speaking-hub' : 'skill-hub'; }

  const P84LearningSignalService = {
    snapshot() {
      return cached('signals', () => {
        const sourceCards = cards(), active = sourceCards.filter(activeCard), words = allWords(); const wordIds = new Set(words.map((word) => word.id)); const personalCards = active.filter((card) => wordIds.has(card.wordId || card.id) || card.personalVocabulary);
        const modes = { meaning: modeAggregate('ko-vi', sourceCards), typing: modeAggregate('vi-ko', sourceCards), context: modeAggregate('context-fill', sourceCards), listening: modeAggregate('listening-ko', sourceCards), confusion: modeAggregate('confusion-choice', sourceCards) };
        const recallAttempts = modes.meaning.attempts + modes.typing.attempts; const recallCorrect = modes.meaning.correct + modes.typing.correct;
        const skillSignals = [
          { skill: 'vocabulary', attempts: recallAttempts, score: recallAttempts >= MIN_EVIDENCE ? clamp(recallCorrect / recallAttempts * 100) : null, source: 'P82/P84 recall evidence' },
          { skill: 'typing', attempts: modes.typing.attempts, score: modes.typing.accuracy, source: 'vi→ko recall' },
          { skill: 'context', attempts: modes.context.attempts, score: modes.context.accuracy, source: 'context-fill recall' },
          { skill: 'listening', attempts: modes.listening.attempts, score: modes.listening.accuracy, source: 'listening→ko recall' },
          ...['reading', 'grammar', 'speaking', 'writing'].map((skill) => { const signal = practiceSkill(skill); return { skill, attempts: signal.attempts, score: signal.accuracy, source: 'practice history' }; })
        ];
        const learnedWords = personalCards.length; const masteredWords = personalCards.filter((card) => card.status === 'mastered' || Number(card.mastery) >= 80).length; const weakWords = personalCards.filter((card) => Number(card.wrongCount || 0) >= 2 || Number(card.mastery || 0) < 40).length; const forgottenWords = personalCards.filter((card) => due(card) && (card.status === 'mastered' || Number(card.mastery) >= 80)).length;
        const errorValues = errors(); const completedSessions = histories().length; const activeSessions = decks().filter((deck) => deck.activeSession).length; const enough = recallAttempts >= MIN_EVIDENCE || active.length >= MIN_EVIDENCE || (PracticeService?.getHistory?.() || []).length >= 2;
        return { generatedAt: new Date().toISOString(), enough, modes, skills: skillSignals, learnedWords, masteredWords, weakWords, forgottenWords, dueCount: active.filter(due).length, srsCompletionRate: completedSessions + activeSessions ? clamp(completedSessions / (completedSessions + activeSessions) * 100) : null, completedSessions, activeCards: active.length, totalWords: words.length, frequentMistakes: errorValues.filter((item) => Number(item.count || 1) >= 2).sort((a, b) => Number(b.count || 1) - Number(a.count || 1)).slice(0, 8), activityDates: activityDates() };
      });
    }
  };

  const P84PrivateLearningProfileService = {
    get() {
      return cached('profile', () => {
        const signals = P84LearningSignalService.snapshot(); const base = LearnerProfileService?.get?.() || {}; const strengths = signals.skills.filter((item) => item.score !== null && item.score >= 75).sort((a, b) => b.score - a.score); const weaknesses = signals.skills.filter((item) => item.score !== null && item.score < 60).sort((a, b) => a.score - b.score);
        const unknown = signals.skills.filter((item) => item.score === null); return { private: true, currentTopikLevel: Number(base.currentTopikLevel || state.currentUser?.currentTopikLevel || 1), targetTopikLevel: Number(base.targetTopikLevel || state.currentUser?.targetTopikLevel || 2), goal: `TOPIK ${Number(base.targetTopikLevel || state.currentUser?.targetTopikLevel || 2)}`, studyMinutesPerDay: Number(base.studyMinutesPerDay || state.currentUser?.studyMinutesPerDay || 20), consistencyDays: Number(getUserProgress?.()?.stats?.streak || 0), strengths, weaknesses, unknown, signals };
      });
    }
  };

  const P84LearningHealthService = {
    dashboard() {
      return cached('health', () => {
        const profile = P84PrivateLearningProfileService.get(), signals = profile.signals; const active = Math.max(1, signals.activeCards); const vocabulary = signals.enough ? clamp(signals.masteredWords / active * 100) : null; const recallValues = [signals.modes.meaning, signals.modes.typing, signals.modes.context, signals.modes.listening].filter((item) => item.accuracy !== null); const recall = recallValues.length ? clamp(recallValues.reduce((sum, item) => sum + item.accuracy, 0) / recallValues.length) : null; const days = signals.activityDates.filter((date) => now() - time(date) <= 30 * DAY).length; const consistency = signals.enough ? clamp(days / Math.min(30, Math.max(7, days || 7)) * 100) : null; const habit = profile.consistencyDays ? `Bạn đã học ${profile.consistencyDays} ngày liên tiếp. ` : ''; return { unlocked: signals.enough, vocabulary, recall, consistency, label: `${habit}Các chỉ số dùng để định hướng nhẹ nhàng, không phải điểm xếp hạng; gián đoạn không bị phạt.` };
      });
    }
  };

  function topicSummary(sourceCards) {
    const groups = new Map(); sourceCards.forEach((card) => { const topic = clean(card.topicLabel || card.topic || 'Chưa phân loại', 80); const current = groups.get(topic) || { topic, mastery: 0, words: 0 }; current.mastery += Number(card.mastery || 0); current.words += 1; groups.set(topic, current); });
    return [...groups.values()].map((item) => ({ ...item, score: clamp(item.mastery / Math.max(1, item.words)) })).filter((item) => item.words >= 2).sort((a, b) => b.score - a.score);
  }
  function periodReport(days) {
    return cached(`report-${days}`, () => {
      const since = now() - days * DAY; const sourceCards = cards().filter(activeCard); const sessions = histories().filter((item) => time(item.completedAt) >= since); const practice = (PracticeService?.getHistory?.() || []).filter((item) => time(item.completedAt) >= since); const recentCards = sourceCards.filter((card) => Math.max(time(card.lastReviewed), time(card.activatedAt), time(card.updatedAt)) >= since); const selectedIds = new Set(sessions.flatMap((item) => item.selectedWordIds || [])); recentCards.forEach((card) => selectedIds.add(card.wordId || card.id)); const topics = topicSummary(sourceCards); const dates = activityDates().filter((date) => time(date) >= since); const improved = sourceCards.filter((card) => { const modes = Object.values(card.personalVocabularyEvidence?.modeStats || {}); return modes.some((item) => Number(item.wrong || 0) > 0 && Number(item.correct || 0) >= Number(item.wrong || 0)); }).sort((a, b) => time(b.lastReviewed) - time(a.lastReviewed)).slice(0, 5).map((card) => ({ korean: card.korean, wrong: Number(card.wrongCount || 0), correct: Number(card.correctCount || 0) }));
      return { days, learningDays: dates.length, wordsStudied: selectedIds.size, mastered: recentCards.filter((card) => card.status === 'mastered' || Number(card.mastery) >= 80).length, reviewAttempts: sessions.reduce((sum, item) => sum + Number(item.attempts || 0), 0), practiceAttempts: practice.length, vocabularyGrowth: sourceCards.filter((card) => time(card.activatedAt || card.createdAt) >= since).length, improved, strongTopic: topics[0] || null, weakTopic: topics.at(-1) || null, enough: sessions.length > 0 || practice.length > 0 || recentCards.length > 0, source: 'SRS, P82/P84 session history, practice history and focus activity' };
    });
  }
  const P84PersonalReportService = { weekly() { return periodReport(7); }, monthly() { return periodReport(30); } };

  const P84GoalTrackingService = {
    targets: Object.freeze({ 1: 800, 2: 1500, 3: 2500, 4: 4000, 5: 6000, 6: 8000 }),
    get() { const profile = P84PrivateLearningProfileService.get(); const target = this.targets[profile.targetTopikLevel] || 4000; const current = profile.signals.activeCards; return { currentTopikLevel: profile.currentTopikLevel, targetTopikLevel: profile.targetTopikLevel, vocabularyCurrent: current, vocabularyTarget: target, vocabularyProgress: clamp(current / target * 100), currentProgressOnly: true, disclaimer: 'Đây là tiến độ dữ liệu hiện tại, không phải dự đoán ngày đạt TOPIK.' }; }
  };

  const P84AdaptivePlanService = {
    plan(minutes = runtime.minutes) {
      const allowed = [5, 10, 20, 30]; const budget = allowed.includes(Number(minutes)) ? Number(minutes) : 10; runtime.minutes = budget; const signals = P84LearningSignalService.snapshot(); const base = global.LearningDirectorService?.plan?.() || { tasks: [] }; const tasks = [];
      const add = (id, title, count, taskMinutes, type, reason) => tasks.push({ id, title, count, minutes: taskMinutes, type, reason });
      if (budget === 5) add('weak', `Luyện ${Math.min(5, Math.max(1, signals.weakWords || signals.dueCount || 5))} từ cần củng cố`, 5, 5, 'typing', 'Phiên ngắn ưu tiên điểm yếu hoặc từ đến hạn.');
      if (budget >= 10) { add('srs', `Ôn ${Math.min(10, Math.max(5, signals.dueCount || 5))} từ SRS`, Math.min(10, Math.max(5, signals.dueCount || 5)), 5, 'srs', 'SRS hiện có quyết định từ đến hạn.'); add('weak', 'Luyện 5 từ hay sai', 5, 5, 'typing', 'Dựa trên wrong count và Error Notebook.'); }
      if (budget >= 20) add('context', 'Làm 5 câu Context', 5, 7, 'context', 'Củng cố khả năng dùng từ trong câu thật.');
      if (budget >= 30) { add('listening', 'Nghe và nhận diện 5 từ', 5, 5, 'listening', 'Chỉ thêm khi thiết bị hỗ trợ audio.'); add('new', 'Học 5 từ mới', 5, 3, 'new', 'Mở rộng vốn từ theo goal và thời gian còn lại.'); }
      const filtered = tasks.filter((task) => task.type !== 'listening' || global.P84VocabularyMastery?.audioAvailable?.()); return { minutes: budget, tasks: filtered, adaptiveSource: base.tasks.map((item) => item.id), goal: P84GoalTrackingService.get(), offline: true };
    },
    start(task) {
      if (!task?.type) throw new Error('Không tìm thấy hoạt động phù hợp.');
      const deckId = runtime.deckId || state.p82Vocabulary?.deckId || decks().sort((a, b) => b.weakWords - a.weakWords || b.reviewWords - a.reviewWords)[0]?.id; if (!deckId) throw new Error('Hãy tạo một deck từ vựng trước.'); runtime.deckId = deckId;
      if (task.type === 'srs') { state.p82Vocabulary.deckId = deckId; setView('vocabulary-today-p84'); return true; }
      if (task.type === 'new') { global.P82LearningSessionService.start(deckId, { scope: 'continue', mode: 'mixed', count: task.count, source: 'p84-p3-adaptive' }); setView('vocabulary-session-p82'); return true; }
      if (task.type === 'familiar') { const deckWordIds = new Set(global.P82DeckService.learningWords(deckId).map((word) => word.id)); const wordIds = cards().filter((card) => deckWordIds.has(card.wordId || card.id) && (card.status === 'mastered' || Number(card.mastery) >= 70)).sort((a, b) => Number(b.mastery || 0) - Number(a.mastery || 0)).slice(0, task.count).map((card) => card.wordId || card.id); if (!wordIds.length) throw new Error('Chưa có từ quen thuộc phù hợp; hãy bắt đầu với từ yếu.'); global.P82LearningSessionService.start(deckId, { wordIds, mode: 'ko-vi', count: task.count, source: 'p84-p3-recovery' }); setView('vocabulary-session-p82'); return true; }
      global.P84ReviewIntelligenceService.start(deckId, { type: task.type, count: task.count }); return true;
    }
  };

  const P84RecoveryPlanService = {
    lastActivity() { const stamps = [...cards().flatMap((card) => [time(card.lastReviewed), time(card.activatedAt)]), ...histories().map((item) => time(item.completedAt)), ...(PracticeService?.getHistory?.() || []).map((item) => time(item.completedAt))].filter(Boolean); return Math.max(0, ...stamps); },
    status() { const last = this.lastActivity(); const awayDays = last ? Math.floor((now() - last) / DAY) : 0; const dueCount = cards().filter(due).length; return { active: Boolean(last && awayDays >= 14), awayDays, dueCount, welcome: 'Chào mừng quay lại.', message: `Bạn có ${dueCount} từ cần ôn. Bắt đầu bằng 10 phút phục hồi, không cần học bù.`, days: [{ day: 1, title: '10 từ quen thuộc', type: 'familiar', count: 10 }, { day: 2, title: '10 từ yếu', type: 'typing', count: 10 }, { day: 3, title: 'Context review', type: 'context', count: 5 }], resetsProgress: false }; }
  };

  function metric(label, value) { return `<div class="p84-p3-metric"><span>${escapeHtml(label)}</span>${value === null ? '<small>Tiếp tục học để mở khóa phân tích.</small>' : `<div class="p84-p3-bar"><i style="width:${value}%"></i></div><b>${value}%</b>`}</div>`; }
  function profileView() {
    const profile = P84PrivateLearningProfileService.get(), health = P84LearningHealthService.dashboard(), plan = P84AdaptivePlanService.plan(), goal = P84GoalTrackingService.get(), recovery = P84RecoveryPlanService.status(); const week = P84PersonalReportService.weekly();
    const strengths = profile.strengths.map((item) => `<li><span>${escapeHtml(skillLabel(item.skill))}</span><b>${item.score}%</b></li>`).join(''); const weaknesses = profile.weaknesses.map((item) => `<li><span>${escapeHtml(skillLabel(item.skill))}</span><b>${item.score}%</b><button data-p84-p3-weak="${item.skill}">Luyện ngay</button></li>`).join('');
    return `<div class="p84-p3-shell"><section class="section p84-p3-heading"><button class="back-link" data-view="home">← Trang chủ</button><p class="eyebrow">P84-P3 · PRIVATE LEARNING PROFILE</p><h1>Learning Profile</h1><p>Goal: ${escapeHtml(profile.goal)} · Current: TOPIK ${profile.currentTopikLevel} · ${profile.studyMinutesPerDay} phút/ngày</p><span class="p84-p3-private">🔒 Chỉ bạn xem được hồ sơ học tập này</span></section>${recovery.active ? `<section class="section p84-p3-recovery"><div><p class="eyebrow">RETURN EXPERIENCE</p><h2>${escapeHtml(recovery.welcome)}</h2><p>${escapeHtml(recovery.message)}</p></div><button class="btn primary" data-view="vocabulary-recovery-p84">Mở Recovery Mode</button></section>` : ''}<section class="section p84-p3-today"><header><div><p class="eyebrow">TODAY ACTION</p><h2>Kế hoạch ${plan.minutes} phút</h2></div><div class="p84-p3-time" role="group" aria-label="Thời gian học hôm nay">${[5,10,20,30].map((minutes) => `<button class="${plan.minutes === minutes ? 'active' : ''}" data-p84-p3-time="${minutes}" aria-pressed="${plan.minutes === minutes}">${minutes}′</button>`).join('')}</div></header><ol>${plan.tasks.map((task) => `<li><div><b>${escapeHtml(task.title)}</b><small>${escapeHtml(task.reason)}</small></div><button class="btn secondary" data-p84-p3-task="${task.id}">Bắt đầu</button></li>`).join('')}</ol></section><section class="section p84-p3-health"><h2>Learning Health</h2><p>${escapeHtml(health.label)}</p>${metric('Vocabulary', health.vocabulary)}${metric('Recall', health.recall)}${metric('Consistency', health.consistency)}</section><section class="p84-p3-analysis"><article class="section"><h2>Bạn đang mạnh</h2><ul>${strengths || '<li>Chưa đủ dữ liệu để xác định điểm mạnh.</li>'}</ul></article><article class="section"><h2>Cần cải thiện</h2><ul>${weaknesses || '<li>Chưa đủ dữ liệu để đánh giá điểm yếu.</li>'}</ul><div class="p84-p3-weak-counts"><span>🎧 ${profile.signals.modes.listening.wrong} lượt nghe sai</span><span>✍️ ${profile.signals.modes.typing.wrong} lượt nhập sai</span><span>📚 ${profile.signals.modes.context.wrong} lượt ngữ cảnh sai</span></div></article></section><section class="section p84-p3-goal"><div><p class="eyebrow">GOAL TRACKING</p><h2>TOPIK ${goal.currentTopikLevel} → TOPIK ${goal.targetTopikLevel}</h2><p>Vocabulary evidence: ${goal.vocabularyCurrent}/${goal.vocabularyTarget}</p></div><div class="p84-p3-goal-ring"><b>${goal.vocabularyProgress}%</b><span>tiến độ hiện tại</span></div><small>${escapeHtml(goal.disclaimer)}</small></section><section class="section p84-p3-report-preview"><div><p class="eyebrow">WEEKLY REPORT</p><h2>${week.enough ? `${week.learningDays} ngày học · ${week.wordsStudied} từ` : 'Chưa đủ dữ liệu tuần này'}</h2><p>${week.enough ? `Mastered ${week.mastered} · Review ${week.reviewAttempts}` : 'Hoàn thành một phiên học để mở báo cáo.'}</p></div><button class="btn secondary" data-view="vocabulary-report-p84">Xem báo cáo</button></section></div>`;
  }
  function reportView() {
    const weekly = P84PersonalReportService.weekly(), monthly = P84PersonalReportService.monthly(), report = runtime.reportPeriod === 'month' ? monthly : weekly; const label = runtime.reportPeriod === 'month' ? 'Monthly Report' : 'Weekly Report';
    return `<div class="p84-p3-shell"><section class="section p84-p3-heading"><button class="back-link" data-view="vocabulary-intelligence-p84">← Learning Profile</button><p class="eyebrow">P84-P3 · PERSONAL REPORT</p><h1>${label}</h1><p>Báo cáo private được tính từ source data hiện có, không lưu bản derived lên cloud.</p><div class="p84-p3-tabs"><button data-p84-p3-period="week" class="${runtime.reportPeriod === 'week' ? 'active' : ''}">Tuần</button><button data-p84-p3-period="month" class="${runtime.reportPeriod === 'month' ? 'active' : ''}">Tháng</button></div></section>${report.enough ? `<section class="section p84-p3-report-grid"><div><b>${report.learningDays}</b><span>ngày học</span></div><div><b>${report.wordsStudied}</b><span>từ đã học/ôn</span></div><div><b>${report.mastered}</b><span>mastered</span></div><div><b>${report.reviewAttempts}</b><span>lượt review</span></div><div><b>${report.vocabularyGrowth}</b><span>vocabulary growth</span></div><div><b>${report.practiceAttempts}</b><span>bài luyện</span></div></section><section class="p84-p3-analysis"><article class="section"><h2>Chủ đề</h2><p>Mạnh: <b>${escapeHtml(report.strongTopic?.topic || 'Chưa đủ dữ liệu')}</b></p><p>Cần củng cố: <b>${escapeHtml(report.weakTopic?.topic || 'Chưa đủ dữ liệu')}</b></p></article><article class="section"><h2>Từ đang cải thiện</h2>${report.improved.length ? `<ul>${report.improved.map((item) => `<li><b lang="ko">${escapeHtml(item.korean)}</b><span>${item.correct} đúng · ${item.wrong} sai tích lũy</span></li>`).join('')}</ul>` : '<p>Chưa đủ evidence để xác định cải thiện.</p>'}</article></section>` : '<section class="section empty-state"><h2>Tiếp tục học để mở khóa báo cáo.</h2><p>Chỉ dữ liệu thật từ session, SRS và practice history được sử dụng.</p></section>'}<section class="section p84-p3-source"><b>Nguồn dữ liệu</b><span>${escapeHtml(report.source)}</span></section></div>`;
  }
  function recoveryView() { const recovery = P84RecoveryPlanService.status(); return `<div class="p84-p3-shell"><section class="section p84-p3-heading"><button class="back-link" data-view="vocabulary-intelligence-p84">← Learning Profile</button><p class="eyebrow">P84-P3 · RECOVERY MODE</p><h1>${escapeHtml(recovery.welcome)}</h1><p>${escapeHtml(recovery.message)}</p></section><section class="section p84-p3-recovery-days">${recovery.days.map((item) => `<article><span>Ngày ${item.day}</span><h2>${escapeHtml(item.title)}</h2><p>Tiến độ cũ được giữ nguyên.</p><button class="btn primary" data-p84-p3-recovery="${item.day}">Bắt đầu</button></article>`).join('')}</section><p class="support-message">Recovery Mode không reset SRS, mastery, wrong count, notes, examples hoặc tags.</p></div>`; }
  function decorate() {
    if (state.currentView === 'home' && !global.document?.querySelector('[data-p84-p3-entry]')) { const profile = P84PrivateLearningProfileService.get(); const weak = profile.weaknesses[0]; const anchor = global.document?.querySelector('[data-p84-today-card], .p84-today-card, #homeMissionAnchor'); anchor?.insertAdjacentHTML('afterend', `<section class="section p84-p3-home" data-p84-p3-entry><div><p class="eyebrow">PRIVATE LEARNING INTELLIGENCE</p><h2>${weak ? `Bước tiếp theo: ${escapeHtml(skillLabel(weak.skill))}` : 'Learning Profile của bạn'}</h2><p>${profile.signals.enough ? `${profile.signals.dueCount} từ đến hạn · ${profile.signals.weakWords} từ cần củng cố` : 'Tiếp tục học để mở khóa phân tích cá nhân.'}</p></div><button class="btn secondary" data-view="vocabulary-intelligence-p84">Xem kế hoạch</button></section>`); }
    if (state.currentView === 'vocabulary-mastery-p84' && !global.document?.querySelector('[data-p84-p3-health-entry]')) global.document?.querySelector('.p84-p2-heading')?.insertAdjacentHTML('afterend', '<button class="btn secondary p84-p3-health-entry" data-p84-p3-health-entry data-view="vocabulary-intelligence-p84">Learning Profile & Adaptive Plan</button>');
  }
  function bind() {
    decorate();
    global.document?.querySelectorAll('[data-p84-p3-time]')?.forEach((button) => { button.onclick = () => { runtime.minutes = Number(button.dataset.p84P3Time); render(); }; });
    global.document?.querySelectorAll('[data-p84-p3-task]')?.forEach((button) => { button.onclick = () => { const task = P84AdaptivePlanService.plan().tasks.find((item) => item.id === button.dataset.p84P3Task); try { P84AdaptivePlanService.start(task); } catch (error) { toast?.(error.message); } }; });
    global.document?.querySelectorAll('[data-p84-p3-weak]')?.forEach((button) => { button.onclick = () => { const type = ({ listening: 'listening', context: 'context', typing: 'typing', vocabulary: 'meaning' })[button.dataset.p84P3Weak]; if (!type) return setView(routeFor(button.dataset.p84P3Weak)); try { P84AdaptivePlanService.start({ type, count: 5 }); } catch (error) { toast?.(error.message); } }; });
    global.document?.querySelectorAll('[data-p84-p3-period]')?.forEach((button) => { button.onclick = () => { runtime.reportPeriod = button.dataset.p84P3Period; render(); }; });
    global.document?.querySelectorAll('[data-p84-p3-recovery]')?.forEach((button) => { button.onclick = () => { const task = P84RecoveryPlanService.status().days.find((item) => item.day === Number(button.dataset.p84P3Recovery)); try { P84AdaptivePlanService.start(task); } catch (error) { toast?.(error.message); } }; });
  }

  Object.assign(global, { P84LearningSignalService, P84PrivateLearningProfileService, P84LearningHealthService, P84PersonalReportService, P84AdaptivePlanService, P84GoalTrackingService, P84RecoveryPlanService, P84PersonalLearningIntelligence: { version: 'p84-p3', private: true, derivedReportsSynced: false, signals: P84LearningSignalService, profile: P84PrivateLearningProfileService, health: P84LearningHealthService, reports: P84PersonalReportService, plan: P84AdaptivePlanService, goals: P84GoalTrackingService, recovery: P84RecoveryPlanService } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'vocabulary-intelligence-p84': profileView, 'vocabulary-report-p84': reportView, 'vocabulary-recovery-p84': recoveryView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER; global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };
})(window);
