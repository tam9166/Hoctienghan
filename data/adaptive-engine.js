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
  const errorRecords = () => window.ErrorNotebookService?.all?.() || (Array.isArray(readUserMap(STORAGE_KEYS.errors)[uid()]) ? readUserMap(STORAGE_KEYS.errors)[uid()] : []);
  const skillLabel = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', reading: 'Đọc', writing: 'Viết', speaking: 'Nói' };
  const skillViews = { vocabulary: 'review', grammar: 'practice-hub', listening: 'skill-hub', reading: 'practice-hub', writing: 'writing-hub', speaking: 'speaking-hub' };
  const reasonText = (item) => item.reasons.join(' · ');
  const VALID_MINUTES = Object.freeze([5, 15, 30, 45, 60, 90]);
  const QUESTION_TYPE_LABELS = Object.freeze({ main_idea: 'Ý chính', detail: 'Chi tiết', time_place: 'Thời gian/địa điểm', inference: 'Suy luận', vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', chart: 'Biểu đồ', conversation: 'Hội thoại' });
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
    const errors = errorRecords();
    const topErrors = errors.filter((item) => !item.resolved).reduce((acc, item) => {
      const type = item.type === 'grammar' ? 'grammar' : (item.type === 'speaking' ? 'speaking' : item.type === 'writing' ? 'writing' : null);
      if (type) acc[type] = (acc[type] || 0) + (Number(item.count) || 1);
      return acc;
    }, {});
    const due = Number(profile.dueSrsCount || 0) || app.VocabularyService?.dueCards?.().length || 0;
    const scores = { vocabulary: profile.skillScores?.vocabulary ?? progress.skills?.vocabulary ?? 0, grammar: profile.skillScores?.grammar ?? progress.skills?.grammar ?? 0, listening: profile.skillScores?.listening ?? progress.skills?.listening ?? 0, reading: profile.skillScores?.reading ?? progress.skills?.reading ?? 0, writing: profile.skillScores?.writing ?? progress.skills?.writing ?? 0, speaking: profile.skillScores?.speaking ?? progress.skills?.speaking ?? 0 };
    const weakSkills = new Set([...(profile.weakSkills || []), ...(stats.weakTopics || []).map((item) => Array.isArray(item) ? item[0] : item)].map((item) => String(item).toLocaleLowerCase()));
    const activity = recentActivity();
    const target = Number(profile.targetTopikLevel || state.currentUser?.targetTopikLevel || 2);
    const memories = window.LearningMemoryService?.all?.() || [];
    const graphWeakness = window.KnowledgeGraphService?.weaknessAnalysis?.() || [];
    const patternMap = window.LanguageScienceService?.adaptiveContext?.().priorityErrors || [];
    return { profile, progress, stats, topErrors, due, scores, weakSkills, activity, target, memories, graphWeakness, patternMap };
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
      const pattern = s.patternMap.find((item) => item.type === id || (id === 'grammar' && ['particles', 'batchim'].includes(item.type)));
      if (pattern) { points += Math.min(3, Math.max(1, Math.ceil(pattern.share / 25))); reasons.push(`xu hướng lỗi ${pattern.type} ${pattern.share}%`); }
      const style = s.profile.learningStyle || state.currentUser?.learningStyle || 'visual'; const mode = s.profile.learningMode || state.currentUser?.learningMode || 'casual';
      if ((STYLE_FOCUS[style] || []).includes(id)) { points += 2; reasons.push(`hợp phong cách ${style}`); }
      if ((MODE_FOCUS[mode] || []).includes(id)) { points += 2; reasons.push(`phù hợp chế độ ${mode}`); }
      if (!reasons.length) reasons.push('duy trì nhịp học');
      const minutes = id === 'vocabulary' ? 8 : (id === 'speaking' || id === 'writing' ? 7 : 6);
      return { id, type: id, title: `${skillLabel[id]}${focusNode ? ` · ${focusNode.label}` : focusMemory && focusMemory.topic !== id ? ` · ${focusMemory.topic}` : ''}`, score: points, rawScore: clamp(score), reasons, reason: reasonText({ reasons }), minutes, actionView: skillViews[id] };
    }).sort((a, b) => b.score - a.score || b.rawScore - a.rawScore || a.id.localeCompare(b.id));
  }

  function examHistory() {
    const all = safeObject(storage.get(STORAGE_KEYS.examAttempts, {}));
    const value = safeObject(all[uid()]);
    return Array.isArray(value.history) ? value.history : [];
  }

  function completedSessions() {
    return (userScoped(STORAGE_KEYS.focusSessions) || []).filter((item) => item?.status === 'completed');
  }

  function average(values = []) {
    const numbers = values.map(Number).filter(Number.isFinite);
    return numbers.length ? Math.round(numbers.reduce((sum, value) => sum + value, 0) / numbers.length) : null;
  }

  function aggregateBreakdowns(items, property) {
    const groups = {};
    items.forEach((item) => Object.entries(item?.[property] || {}).forEach(([key, value]) => {
      if (!Number.isFinite(Number(value))) return;
      groups[key] = groups[key] || [];
      groups[key].push(Number(value));
    }));
    return Object.fromEntries(Object.entries(groups).map(([key, values]) => [key, { score: average(values), samples: values.length }]));
  }

  const AdaptiveLearningProfileService = {
    snapshot(input = {}) {
      const base = safeObject(input.profile || LearnerProfileService.get?.() || {});
      const progress = safeObject(input.progress || getUserProgress?.() || {});
      const practice = Array.isArray(input.quizHistory) ? input.quizHistory : (PracticeService.getHistory?.() || []);
      const topik = Array.isArray(input.topikHistory) ? input.topikHistory : examHistory();
      const sessions = Array.isArray(input.sessions) ? input.sessions : completedSessions();
      const errors = Array.isArray(input.recentErrors) ? input.recentErrors : errorRecords();
      const srsCards = Array.isArray(input.srsCards) ? input.srsCards : (state.srsData || []);
      const dueCards = Array.isArray(input.srsDue) ? input.srsDue : (app.VocabularyService?.dueCards?.() || []);
      const sessionEvidence = sessions.map((session) => { const groups = {}; (session.tasks || []).forEach((taskItem) => { const score = Number(taskItem.result?.score); if (!skillLabel[taskItem.type] || !Number.isFinite(score)) return; groups[taskItem.type] = groups[taskItem.type] || []; groups[taskItem.type].push(score); }); return { skillBreakdown: Object.fromEntries(Object.entries(groups).map(([skill, scores]) => [skill, average(scores)])) }; });
      const skillEvidence = aggregateBreakdowns([...practice, ...topik, ...sessionEvidence], 'skillBreakdown');
      const skillScores = { ...(base.skillScores || {}), ...(progress.skills || {}) };
      Object.entries(skillEvidence).forEach(([skill, evidence]) => { if (evidence.samples) skillScores[skill] = evidence.score; });
      const questionTypes = aggregateBreakdowns([...practice, ...topik], 'questionTypeBreakdown');
      const studyMinutes = sessions.reduce((sum, item) => sum + Number(item.actualMinutes || item.targetMinutes || 0), 0)
        + [...practice, ...topik].reduce((sum, item) => sum + Math.max(0, Number(item.durationSeconds || 0) / 60), 0);
      const retentionCards = srsCards.filter((card) => Number(card.reviewCount || card.repetitions || 0) > 0);
      const retention = retentionCards.length ? Math.round(retentionCards.reduce((sum, card) => sum + clamp(card.mastery || (Number(card.wrongCount || 0) ? 40 : 75)), 0) / retentionCards.length) : null;
      const goal = input.userGoal || GoalTrackingService.getGoal?.() || {};
      return {
        userId: uid(), currentLevel: goal.currentLevel || base.currentTopikLevel || state.currentUser?.level || 'Beginner', currentTopikLevel: Number(base.currentTopikLevel || state.currentUser?.currentTopikLevel || 1), targetTopikLevel: Number(goal.targetLevel || base.targetTopikLevel || state.currentUser?.targetTopikLevel || 2),
        skillScores, questionTypes, vocabularyMastery: Number(skillScores.vocabulary || 0), grammarMastery: Number(skillScores.grammar || 0), listeningAccuracy: Number(skillScores.listening || 0), readingAccuracy: Number(skillScores.reading || 0), srs: { due: dueCards.length, total: srsCards.length, retention },
        errors: { total: errors.length, unresolved: errors.filter((item) => !item.resolved).length, repeated: errors.filter((item) => Number(item.repetitionCount || item.count || 1) > 1).length },
        study: { minutes: Math.round(studyMinutes), sessions: sessions.length, recent: sessions.slice(0, 10) }, quizAttempts: practice.length, topikAttempts: topik.length, updatedAt: now()
      };
    }
  };

  const WeaknessDetectionService = {
    detect(input = {}) {
      const profile = input.learningProfile || AdaptiveLearningProfileService.snapshot(input);
      const output = [];
      Object.entries(profile.skillScores || {}).forEach(([skill, score]) => {
        if (!skillLabel[skill] || !Number.isFinite(Number(score)) || Number(score) <= 0 || Number(score) >= 65) return;
        output.push({ id: `skill:${skill}`, kind: 'skill', skill, label: skillLabel[skill], score: Math.round(Number(score)), samples: Math.max(1, Number(input.skillSamples?.[skill] || 1)), priority: Number(score) < 50 ? 'high' : 'medium', reason: `${skillLabel[skill]} hiện đạt ${Math.round(Number(score))}%.` });
      });
      Object.entries(profile.questionTypes || {}).forEach(([type, evidence]) => {
        const score = Number(evidence?.score); const samples = Number(evidence?.samples || 0);
        if (!Number.isFinite(score) || score >= 65 || samples < 1) return;
        output.push({ id: `question-type:${type}`, kind: 'question-type', skill: type.includes('listen') || ['time_place', 'conversation'].includes(type) ? 'listening' : 'reading', questionType: type, label: QUESTION_TYPE_LABELS[type] || type, score: Math.round(score), samples, priority: score < 50 ? 'high' : 'medium', reason: `${QUESTION_TYPE_LABELS[type] || type}: ${Math.round(score)}% qua ${samples} lần đo.` });
      });
      return output.sort((a, b) => a.score - b.score || b.samples - a.samples || a.id.localeCompare(b.id));
    }
  };

  const RootCauseAnalysisService = {
    analyze(weakness, errorsInput) {
      const errors = (Array.isArray(errorsInput) ? errorsInput : errorRecords()).filter((item) => !item.resolved);
      if (!weakness) return { ready: false, message: 'Chưa đủ dữ liệu để xác định nguyên nhân.' };
      const related = errors.filter((item) => [item.type, item.errorType, item.skill, item.questionType].filter(Boolean).some((value) => normalizeSearch(value).includes(normalizeSearch(weakness.skill || weakness.questionType || weakness.label))));
      const repeated = related.filter((item) => Number(item.repetitionCount || item.count || 1) >= 2);
      if (related.length < 2 && repeated.length === 0) return { ready: false, evidenceCount: related.length, message: 'Chưa đủ dữ liệu để xác định nguyên nhân.' };
      const types = related.reduce((map, item) => { const key = item.questionType || item.errorType || item.type || 'general'; map[key] = (map[key] || 0) + Number(item.repetitionCount || item.count || 1); return map; }, {});
      const dominant = Object.entries(types).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
      return { ready: true, evidenceCount: related.length, cause: dominant[0], message: `Dữ liệu cho thấy lỗi ${QUESTION_TYPE_LABELS[dominant[0]] || dominant[0]} lặp ${dominant[1]} lần trong ${weakness.label}.` };
    }
  };

  const AdaptiveSrsPriorityService = {
    rank(cardsInput) {
      const cards = Array.isArray(cardsInput) ? cardsInput : (state.srsData || []);
      const errorWords = new Set(errorRecords().map((item) => item.wordId).filter(Boolean));
      return cards.map((card) => {
        const dueAt = new Date(card.dueAt || card.nextReview || card.due || 0).getTime(); const overdueDays = dueAt ? Math.max(0, Math.floor((Date.now() - dueAt) / 86400000)) : 0;
        const failed = Number(card.wrongCount || card.lapses || 0); const recent = Date.now() - new Date(card.createdAt || 0).getTime() <= 7 * 86400000;
        const highValue = Boolean(card.topikLevel || card.highValue || (card.tags || []).some((tag) => /topik/i.test(tag)));
        const fromError = errorWords.has(card.wordId || card.id);
        const priorityScore = overdueDays * 10 + failed * 8 + (recent ? 4 : 0) + (highValue ? 3 : 0) + (fromError ? 6 : 0) - (Number(card.mastery || 0) >= 85 ? 8 : 0);
        const reasons = [overdueDays ? `quá hạn ${overdueDays} ngày` : '', failed ? `sai ${failed} lần` : '', recent ? 'mới học' : '', highValue ? 'từ vựng TOPIK giá trị cao' : '', fromError ? 'xuất hiện trong Sổ lỗi' : ''].filter(Boolean);
        return { ...card, priorityScore, priorityReasons: reasons };
      }).sort((a, b) => b.priorityScore - a.priorityScore || String(a.wordId || a.id).localeCompare(String(b.wordId || b.id)));
    }
  };

  function task(type, minutes, title, reason, priority, extra = {}) {
    const routes = { srs: 'review', repair: 'error-notebook', grammar: 'grammar-compare', listening: 'listening-studio', reading: 'practice-hub', vocabulary: 'vocabulary-hub', topik: 'topik-exam-catalog-p80', lesson: state.currentUser?.learningTrack === 'foundation' ? 'foundation' : 'lessons', quiz: 'quick-practice', writing: 'writing-hub', speaking: 'speaking-hub' };
    return { id: `${type}-${priority}`, type, minutes, title, reason, priority, route: routes[type] || 'lessons', actionView: routes[type] || 'lessons', completed: false, ...extra };
  }

  function allocate(total, weights) {
    const sum = weights.reduce((value, item) => value + item, 0) || 1;
    const values = weights.map((weight) => Math.max(1, Math.floor(total * weight / sum)));
    let difference = total - values.reduce((value, item) => value + item, 0); let index = 0;
    while (difference !== 0) { const direction = difference > 0 ? 1 : -1; if (values[index] + direction >= 1) { values[index] += direction; difference -= direction; } index = (index + 1) % values.length; }
    return values;
  }

  const LearningSessionGeneratorService = {
    generateLearningSession(input = {}) {
      const requested = Number(input.availableMinutes || input.minutes || GoalTrackingService.getGoal?.()?.dailyMinutes || 30);
      const availableMinutes = Math.max(5, Math.min(90, requested));
      const profile = input.learningProfile || AdaptiveLearningProfileService.snapshot(input);
      const weaknesses = Array.isArray(input.weaknesses) ? input.weaknesses : WeaknessDetectionService.detect({ ...input, learningProfile: profile });
      const errors = Array.isArray(input.recentErrors) ? input.recentErrors : errorRecords().filter((item) => !item.resolved);
      const repeatedErrors = errors.filter((item) => Number(item.repetitionCount || item.count || 1) > 1);
      const dueCount = Array.isArray(input.srsDue) ? input.srsDue.length : Number(input.srsDue ?? profile.srs?.due ?? 0);
      const inactivity = InactivityDetectionService.status(input.lastActivityAt);
      const effectiveMinutes = inactivity.mode === 'welcome-back' && !input.ignoreInactivity ? Math.min(10, availableMinutes) : availableMinutes;
      const weak = weaknesses.find((item) => item.kind === 'skill') || weaknesses[0];
      const candidates = [];
      if (dueCount > 0) candidates.push({ type: 'srs', weight: 8, title: `Ôn ${dueCount} từ SRS đến hạn`, reason: `${dueCount} từ đang đến hạn; thẻ quá hạn và sai lặp được xử lý trước.` });
      if (weak && weak.skill !== 'vocabulary') candidates.push({ type: weak.skill || 'topik', weight: 7, title: `Luyện ${weak.label || skillLabel[weak.skill] || 'kỹ năng yếu'}`, reason: weak.reason || `${weak.label} hiện đạt ${weak.score}%.`, weaknessId: weak.id });
      if (errors.length) candidates.push({ type: 'repair', weight: repeatedErrors.length ? 7 : 5, title: `Làm lại ${Math.min(5, errors.length)} lỗi trong Error Notebook`, reason: repeatedErrors.length ? `${repeatedErrors.length} lỗi đang lặp lại; cần sửa trước khi học mới.` : `${errors.length} lỗi chưa được xử lý.` });
      if (effectiveMinutes === 5) {
        const five = [];
        if (dueCount) five.push({ type: 'srs', weight: 2, title: `Ôn nhanh SRS`, reason: `${dueCount} từ đang đến hạn.` });
        if (errors.length) five.push({ type: 'repair', weight: 2, title: 'Sửa lỗi quan trọng', reason: repeatedErrors.length ? `${repeatedErrors.length} lỗi lặp cần ưu tiên.` : `${errors.length} lỗi chưa xử lý.` });
        five.push({ type: 'quiz', weight: 1, title: 'Mini Quiz', reason: 'Kiểm tra nhanh sau phần ôn.' });
        const selected = five.slice(0, 3); const minutes = allocate(5, selected.map((item) => item.weight));
        const tasks = selected.map((item, index) => task(item.type, minutes[index], item.title, item.reason, index + 1));
        return this.finalize(tasks, 5, profile, weaknesses, inactivity, input);
      }
      if (!candidates.some((item) => item.type === 'lesson')) candidates.push({ type: 'lesson', weight: effectiveMinutes >= 60 ? 6 : 4, title: 'Học bài tiếp theo', reason: `Bài mới phù hợp ${profile.currentLevel || `TOPIK ${profile.currentTopikLevel}`}.` });
      if (effectiveMinutes >= 45) {
        const nextWeak = weaknesses.find((item) => item.kind === 'skill' && item.skill !== weak?.skill && Number(profile.skillScores?.[item.skill] || 0) < 75);
        if (nextWeak) candidates.splice(candidates.length - 1, 0, { type: nextWeak.skill, weight: 5, title: `Củng cố ${nextWeak.label}`, reason: nextWeak.reason, weaknessId: nextWeak.id });
        else candidates.splice(candidates.length - 1, 0, { type: 'topik', weight: 5, title: 'Luyện dạng câu TOPIK', reason: `Bám mục tiêu TOPIK ${profile.targetTopikLevel}.` });
      }
      if (effectiveMinutes >= 90) candidates.splice(candidates.length - 1, 0, { type: 'writing', weight: 4, title: 'Luyện đầu ra', reason: 'Phiên dài có thể dành thời gian cho viết và tự kiểm tra.' });
      const selected = candidates.slice(0, effectiveMinutes >= 60 ? 6 : effectiveMinutes >= 45 ? 5 : 4);
      const minutes = allocate(effectiveMinutes, selected.map((item) => item.weight));
      const tasks = selected.map((item, index) => task(item.type, minutes[index], item.title, item.reason, index + 1, { weaknessId: item.weaknessId }));
      return this.finalize(tasks, effectiveMinutes, profile, weaknesses, inactivity, input);
    },
    finalize(tasks, minutes, profile, weaknesses, inactivity, input) {
      const signature = [minutes, profile.srs?.due, profile.errors?.unresolved, profile.study?.sessions || 0, profile.study?.minutes || 0, ...Object.entries(profile.skillScores || {}).sort(([a], [b]) => a.localeCompare(b)).map(([skill, score]) => `${skill}:${score}`), ...tasks.map((item) => `${item.type}:${item.minutes}:${item.reason}`)].join('|');
      return { id: input.id || `adaptive-${uid() || 'guest'}-${dateKey()}-${Math.abs([...signature].reduce((hash, character) => ((hash << 5) - hash) + character.charCodeAt(0) | 0, 0))}`, userId: uid(), createdAt: input.createdAt || now(), estimatedDuration: minutes, minutes, totalMinutes: minutes, reason: tasks[0]?.reason || 'Duy trì nhịp học.', priority: tasks[0]?.type || 'lesson', tasks, weaknesses: weaknesses.slice(0, 5), inactivity, completionState: 'planned', evidenceSignature: signature, generatedBy: 'adaptive-personal-assistant-v1' };
    }
  };

  const InactivityDetectionService = {
    daysSince(lastActivityAt) { const activity = lastActivityAt ? new Date(lastActivityAt).getTime() : recentActivity().last; return activity ? Math.max(0, Math.floor((Date.now() - activity) / 86400000)) : 0; },
    status(lastActivityAt) { const days = this.daysSince(lastActivityAt); if (days >= 7) return { days, mode: 'welcome-back', minutes: 10, message: 'Chào mừng bạn quay lại! Hôm nay chỉ cần 10 phút.' }; if (days >= 3) return { days, mode: 'light', minutes: 15, message: 'Bắt đầu lại nhẹ nhàng, không cần học bù.' }; return { days, mode: 'normal', minutes: null, message: '' }; }
  };

  const TopikReadinessDataService = {
    snapshot(targetLevel = GoalTrackingService.getGoal?.()?.targetLevel || state.currentUser?.targetTopikLevel || 2) {
      const history = examHistory(); const skillEvidence = aggregateBreakdowns(history, 'skillBreakdown'); const scores = Object.fromEntries(Object.entries(skillEvidence).map(([key, value]) => [key, value.score]));
      const ordered = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      return { targetLevel: Number(targetLevel), attempts: history.length, currentPracticePerformance: history[0]?.percentage ?? null, recentScores: history.slice(0, 8).map((item) => ({ id: item.id, title: item.setTitle, score: item.percentage, completedAt: item.completedAt, durationSeconds: item.durationSeconds })), trend: history.slice(0, 8).reverse().map((item) => Number(item.percentage || 0)), skills: scores, strengths: ordered.filter(([, score]) => score >= 75).map(([skill]) => skill), weaknesses: ordered.filter(([, score]) => score < 65).reverse().map(([skill]) => skill), disclaimer: 'Chỉ là dữ liệu luyện tập, không dự đoán kết quả thi.' };
    }
  };

  const AdaptiveStudyPlanService = {
    weekly(input = {}) {
      const weaknesses = input.weaknesses || WeaknessDetectionService.detect(input); const goal = input.userGoal || GoalTrackingService.getGoal(); const studyDays = Math.max(1, Math.min(7, Number(goal?.studyDaysPerWeek || 6)));
      const priority = [...new Set(weaknesses.filter((item) => item.kind === 'skill').map((item) => item.skill).concat(goal?.prioritySkills || [], ['vocabulary', 'grammar', 'listening', 'reading']))];
      const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return dayNames.map((day, index) => index < studyDays ? { day, rest: false, focus: index === studyDays - 1 ? ['review', priority[0]] : index === Math.max(0, studyDays - 2) && Number(goal?.targetLevel || 0) ? ['topik', priority[0]] : [priority[index % priority.length]], reason: index < 2 && weaknesses[0] ? weaknesses[0].reason : `Theo mục tiêu ${goal?.goalType || 'học tiếng Hàn'}.` } : { day, rest: true, focus: [], reason: 'Ngày nghỉ theo lịch đã đặt.' });
    }
  };

  const AdaptiveProgressService = {
    snapshot(period = '7d') {
      const days = period === 'today' ? 1 : period === '30d' ? 30 : period === 'all' ? Infinity : 7; const cutoff = days === Infinity ? 0 : Date.now() - days * 86400000;
      const practice = (PracticeService.getHistory?.() || []).filter((item) => new Date(item.completedAt || 0).getTime() >= cutoff); const topik = examHistory().filter((item) => new Date(item.completedAt || 0).getTime() >= cutoff); const sessions = completedSessions().filter((item) => new Date(item.completedAt || 0).getTime() >= cutoff); const profile = AdaptiveLearningProfileService.snapshot({ quizHistory: practice, topikHistory: topik, sessions }); const progress = getUserProgress?.() || {};
      return { period, studyMinutes: profile.study.minutes, sessions: sessions.length, lessonsCompleted: Number(progress.stats?.lessonsCompleted || 0), vocabularyLearned: (state.srsData || []).filter((item) => Number(item.reviewCount || item.repetitions || 0) > 0).length, srsRetention: profile.srs.retention, quizAccuracy: average(practice.map((item) => item.percentage)), topikScore: average(topik.map((item) => item.percentage)), skills: profile.skillScores, streak: Number(progress.stats?.streak || 0) };
    }
  };

  const LearningSessionResultService = {
    record(session, outcomes = {}) {
      if (!session?.tasks?.length) return null;
      session.tasks = session.tasks.map((taskItem) => { const result = outcomes[taskItem.id] || outcomes[taskItem.type] || taskItem.result; return result ? { ...taskItem, result: { score: clamp(result.score), correct: Number(result.correct || 0), total: Number(result.total || 0), completedAt: result.completedAt || now() } } : taskItem; });
      session.result = { recordedAt: now(), measuredTasks: session.tasks.filter((item) => Number.isFinite(Number(item.result?.score))).length };
      window.FocusSessionService?.save?.(session); CloudSyncService.schedule?.('adaptive-session-result');
      const profile = AdaptiveLearningProfileService.snapshot(); const weaknesses = WeaknessDetectionService.detect({ learningProfile: profile });
      return { session, profile, nextRecommendation: LearningSessionGeneratorService.generateLearningSession({ availableMinutes: GoalTrackingService.getGoal()?.dailyMinutes || session.targetMinutes || 30, learningProfile: profile, weaknesses, ignoreInactivity: true }) };
    }
  };

  const LevelAdaptiveExplanationService = {
    guidance(level = AdaptiveLearningProfileService.snapshot().currentTopikLevel) { const value = Number(level) || 1; return value <= 2 ? { vietnameseRatio: .8, koreanRatio: .2, style: 'Câu ngắn, tiếng Việt là chính, kèm ví dụ Hàn.' } : value <= 4 ? { vietnameseRatio: .5, koreanRatio: .5, style: 'Giải thích song ngữ, tăng ngữ cảnh tiếng Hàn.' } : { vietnameseRatio: .2, koreanRatio: .8, style: 'Ưu tiên giải thích tiếng Hàn, tiếng Việt chỉ làm rõ điểm khó.' }; }
  };

  const DailyMissionService = {
    getAll() { return uid() ? (readUserMap(STORAGE_KEYS.dailyMissions)[uid()] || []) : []; },
    getToday() {
      if (!uid()) return null;
      const today = dateKey(); const existing = this.getAll().find((item) => item.date === today); const signals = prioritySignals(); const inactivity = InactivityDetectionService.status();
      const baseMinutes = Number(GoalTrackingService.getGoal?.()?.dailyMinutes || state.currentUser?.studyMinutesPerDay || signals.profile.studyMinutesPerDay || 20) || 20;
      const requestedMinutes = inactivity.mode === 'welcome-back' ? 10 : inactivity.mode === 'light' ? Math.min(baseMinutes, 15) : baseMinutes;
      const session = LearningSessionGeneratorService.generateLearningSession({ availableMinutes: requestedMinutes, ignoreInactivity: false });
      if (existing?.completed) return existing;
      if (existing?.generatedBy === 'adaptive-personal-assistant-v1' && existing.evidenceSignature === session.evidenceSignature) return existing;
      const priorities = session.tasks.map((item) => ({ ...item, id: item.id, score: Math.max(1, 10 - item.priority), rawScore: 0, reasons: [item.reason], actionView: item.actionView || item.route }));
      const mission = { id: `mission-${uid()}-${today}`, userId: uid(), date: today, generatedAt: now(), totalMinutes: session.minutes, priorities, tasks: session.tasks, reason: session.reason, evidenceSignature: session.evidenceSignature, weaknesses: session.weaknesses, reducedPlan: inactivity.mode !== 'normal', inactivityMode: inactivity.mode, habitHint: this.habitHint(signals.activity), completed: false, completedItems: [], generatedBy: 'adaptive-personal-assistant-v1', learningStyle: signals.profile.learningStyle, learningMode: signals.profile.learningMode };
      writeUserMap(STORAGE_KEYS.dailyMissions, [mission, ...this.getAll().filter((item) => item.date !== today)].slice(0, 30), 'adaptive-mission');
      return mission;
    },
    habitHint(activity = recentActivity()) { if (!activity.last) return 'Bắt đầu bằng một phiên ngắn để tạo nhịp học.'; const hour = new Date(activity.last).getHours(); return `Bạn thường học khoảng ${String(hour).padStart(2, '0')}:00 — giữ khung giờ này nếu thuận tiện.`; },
    complete(itemId) { const mission = this.getToday(); if (!mission) return; mission.completedItems = [...new Set([...(mission.completedItems || []), itemId || 'mission'])]; mission.completed = mission.completedItems.includes('mission') || mission.completedItems.length >= mission.priorities.length; writeUserMap(STORAGE_KEYS.dailyMissions, [mission, ...this.getAll().filter((item) => item.id !== mission.id)].slice(0, 30), 'adaptive-mission'); return mission; },
    start(item) { const target = typeof item === 'string' ? this.getToday()?.priorities?.find((entry) => entry.id === item) : item; if (target?.actionView) setView(target.actionView); }
  };

  function defaultGoal() { const user = state.currentUser || {}; return { id: `goal-${uid()}`, userId: uid(), goalType: user.goals?.includes('topik') ? 'topik' : 'communication', currentLevel: user.level || 'Beginner', targetLevel: Number(user.targetTopikLevel || 2), deadline: '', targetMonths: 6, dailyMinutes: Number(user.studyMinutesPerDay || 20), studyDaysPerWeek: 6, prioritySkills: [], personalGoal: '', createdAt: now(), updatedAt: now() }; }
  const GoalTrackingService = {
    getGoal() { return uid() ? (readUserMap(STORAGE_KEYS.learningGoals)[uid()] || defaultGoal()) : null; },
    saveGoal(input = {}) { if (!uid()) return null; const previous = this.getGoal() || defaultGoal(); const prioritySkills = Array.isArray(input.prioritySkills) ? input.prioritySkills.filter((item) => skillLabel[item]).slice(0, 6) : previous.prioritySkills || []; const goal = { ...previous, ...input, id: previous.id || `goal-${uid()}`, userId: uid(), currentLevel: String(input.currentLevel || previous.currentLevel || 'Beginner').slice(0, 50), targetLevel: clamp(input.targetLevel || previous.targetLevel, 1, 6), targetMonths: Math.max(1, Math.min(60, Number(input.targetMonths || previous.targetMonths || 6))), dailyMinutes: Math.max(5, Math.min(180, Number(input.dailyMinutes || previous.dailyMinutes || 20))), studyDaysPerWeek: Math.max(1, Math.min(7, Number(input.studyDaysPerWeek || previous.studyDaysPerWeek || 6))), prioritySkills, personalGoal: String(input.personalGoal ?? previous.personalGoal ?? '').slice(0, 300), deadline: String(input.deadline ?? previous.deadline ?? '').slice(0, 10), updatedAt: now() }; writeUserMap(STORAGE_KEYS.learningGoals, goal, 'adaptive-goal'); return goal; },
    progress(goal = this.getGoal()) { const s = prioritySignals(); const current = Number(s.profile.currentTopikLevel || state.currentUser?.currentTopikLevel || 1); const target = Number(goal?.targetLevel || 2); const levelPart = target <= current ? 100 : clamp((current - 1) / Math.max(1, target - 1) * 100); const avg = Number(s.stats.average || 0); return Math.round(clamp(levelPart * .65 + avg * .35)); },
    daysRemaining(goal = this.getGoal()) { if (!goal?.deadline) return null; return Math.max(0, Math.ceil((new Date(`${goal.deadline}T23:59:59`).getTime() - Date.now()) / 86400000)); }
  };

  const RoadmapService = {
    get(goal = GoalTrackingService.getGoal()) { if (!uid() || !goal) return []; const maps = readUserMap(STORAGE_KEYS.adaptiveRoadmaps); if (maps[uid()]?.goalUpdatedAt === goal.updatedAt) return maps[uid()].phases || []; const current = Number(state.currentUser?.currentTopikLevel || 1); const target = Number(goal.targetLevel || 2); const phases = [{ title: 'Củng cố nền tảng', weeks: 2, focus: ['vocabulary', 'grammar'] }, { title: 'Tăng phản xạ nghe – đọc', weeks: 3, focus: ['listening', 'reading'] }, { title: 'Luyện đầu ra', weeks: 3, focus: ['speaking', 'writing'] }, { title: `Bứt tốc TOPIK ${target}`, weeks: Math.max(3, target - current + 2), focus: ['vocabulary', 'grammar', 'reading'] }, { title: 'Thi thử có chiến lược', weeks: 2, focus: ['reading', 'listening'] }, { title: 'Ôn điểm yếu cuối chặng', weeks: 2, focus: buildPriorities().slice(0, 2).map((item) => item.id) }].map((phase, index) => ({ ...phase, index: index + 1, status: index === 0 ? 'active' : 'planned', rationale: `Ưu tiên ${phase.focus.map((item) => skillLabel[item]).join(', ')} dựa trên dữ liệu hiện tại.` })); writeUserMap(STORAGE_KEYS.adaptiveRoadmaps, { goalUpdatedAt: goal.updatedAt, generatedAt: now(), phases }, 'adaptive-roadmap'); return phases; },
    async generateWithAI(goal = GoalTrackingService.getGoal()) { const fallback = this.get(goal); if (!window.AICoachService?.request) return { text: 'Dịch vụ gợi ý chưa sẵn sàng; lộ trình trên thiết bị vẫn hoạt động.', phases: fallback, source: 'rules' }; try { const text = await window.AICoachService.request(`Hãy đề xuất lộ trình học tiếng Hàn theo tuần cho mục tiêu TOPIK ${goal.targetLevel}, ${goal.dailyMinutes} phút/ngày, deadline ${goal.deadline || 'chưa đặt'}. Dựa duy nhất trên learner context; không bịa điểm số. Trả lời tiếng Việt ngắn gọn, có ưu tiên kỹ năng và cách đo tiến bộ.`); return { text, phases: fallback, source: 'ai+rules' }; } catch (error) { return { text: `${error.message} Lộ trình local vẫn được giữ bên dưới.`, phases: fallback, source: 'rules' }; } }
  };

  function missionCard() { const mission = DailyMissionService.getToday(); if (!mission) return ''; const top = mission.priorities || []; return `<section class="card section adaptive-mission-home"><div class="section-heading"><div><p class="eyebrow">Kế hoạch cá nhân</p><h2 class="section-title">Nhiệm vụ hôm nay</h2></div><span class="level-pill">${mission.totalMinutes} phút</span></div><p class="subtle">${mission.reducedPlan ? 'Phiên rút gọn để lấy lại nhịp học.' : 'Ba hoạt động quan trọng nhất cho hôm nay.'}</p><div class="mission-priority-list">${top.map((item, index) => `<button class="mission-priority ${mission.completedItems?.includes(item.id) ? 'done' : ''}" data-adaptive-start="${item.id}"><span class="mission-rank">${index + 1}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.reason?.split('·')[0]?.trim() || 'Theo tiến độ hiện tại')}</small></span><em>${item.minutes}′</em></button>`).join('')}</div><div class="action-row"><button class="btn primary" data-view="adaptive-plan">${mission.completed ? 'Xem lại kế hoạch' : 'Bắt đầu học'}</button><button class="btn secondary" data-view="adaptive-plan">Xem lộ trình</button></div></section>`; }
  function goalCard() { const goal = GoalTrackingService.getGoal(); if (!goal) return ''; const progress = GoalTrackingService.progress(goal); const days = GoalTrackingService.daysRemaining(goal); return `<section class="card section adaptive-goal-home"><div class="section-heading"><div><p class="eyebrow">🎯 Mục tiêu cá nhân</p><h2 class="section-title">${escapeHtml(goal.currentLevel)} → TOPIK ${goal.targetLevel}</h2></div><span class="level-pill">${progress}%</span></div><div class="bar"><span style="width:${progress}%"></span></div><p class="subtle">${days === null ? `${goal.targetMonths} tháng` : `${days} ngày còn lại`} · ${goal.dailyMinutes} phút/ngày · ${goal.studyDaysPerWeek} ngày/tuần</p><button class="btn secondary" data-view="adaptive-plan">Điều chỉnh mục tiêu & lộ trình</button></section>`; }
  function adaptiveView() { const mission = DailyMissionService.getToday(); const goal = GoalTrackingService.getGoal(); const phases = RoadmapService.get(goal); const progress = GoalTrackingService.progress(goal); const days = GoalTrackingService.daysRemaining(goal); const profile = AdaptiveLearningProfileService.snapshot(); const weaknesses = WeaknessDetectionService.detect({ learningProfile: profile }).slice(0, 3); const readiness = TopikReadinessDataService.snapshot(goal.targetLevel); const weekly = AdaptiveStudyPlanService.weekly({ userGoal: goal, weaknesses }); return `<section class="section page-heading"><p class="eyebrow">Personal Korean Learning Assistant</p><h1 class="headline">Kế hoạch học của bạn</h1><p class="subtle">Kế hoạch local-first được tính từ goal, SRS, lỗi, quiz, TOPIK và phiên học; không dùng AI cho việc xếp ưu tiên.</p></section><section class="card section adaptive-mission"><div class="section-heading"><div><p class="eyebrow">HÔM NAY HỌC GÌ? · ${mission.date}</p><h2 class="section-title">${mission.totalMinutes} phút có chủ đích</h2></div><span class="sync-status">${mission.completed ? '✓ Đã hoàn thành' : `${mission.completedItems?.length || 0}/${mission.priorities.length} mục`}</span></div><div class="mission-priority-list">${mission.priorities.map((item, index) => `<article class="mission-priority ${mission.completedItems?.includes(item.id) ? 'done' : ''}"><span class="mission-rank">${index + 1}</span><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.reason)}</small></span><em>${item.minutes}′</em><button class="btn secondary" data-adaptive-start="${item.id}">Mở</button></article>`).join('')}</div><p class="subtle">${escapeHtml(mission.habitHint || '')}</p><button class="btn primary full" data-view="home">▶ BẮT ĐẦU HỌC HÔM NAY</button></section><section class="card section adaptive-weaknesses"><div class="section-heading"><div><p class="eyebrow">🧠 Tôi đang yếu gì?</p><h2 class="section-title">Dựa trên bằng chứng hiện có</h2></div></div>${weaknesses.length ? weaknesses.map((item) => `<article><span class="${item.priority}">${item.score}%</span><div><b>${escapeHtml(item.label)}</b><small>${escapeHtml(item.reason)} ${escapeHtml(RootCauseAnalysisService.analyze(item).message)}</small></div><button class="btn secondary" data-adaptive-practice="${escapeHtml(item.id)}">Luyện ngay</button></article>`).join('') : '<p class="subtle">Chưa đủ dữ liệu. Hãy hoàn thành quiz hoặc đề TOPIK để hệ thống phân tích.</p>'}</section><section class="card section adaptive-readiness"><div class="section-heading"><div><p class="eyebrow">🎯 TOPIK Readiness</p><h2 class="section-title">Mục tiêu TOPIK ${goal.targetLevel}</h2></div><span>${readiness.attempts} bài</span></div>${Object.entries(readiness.skills).map(([skill, score]) => `<p><span>${escapeHtml(skillLabel[skill] || skill)}</span><b>${score}%</b></p>`).join('') || '<p class="subtle">Chưa có bài TOPIK đã chấm.</p>'}<small>${readiness.disclaimer}</small></section><section class="card section adaptive-goal-form"><div class="section-heading"><div><p class="eyebrow">Mục tiêu học tập</p><h2 class="section-title">Mục tiêu & lịch học</h2></div><span class="level-pill">${progress}%</span></div><form id="adaptiveGoalForm" class="coach-form"><label>Trình độ hiện tại<select name="currentLevel">${['Beginner','Elementary','Intermediate','Advanced'].map((value) => `<option value="${value}" ${goal.currentLevel === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label>Mục tiêu<select name="goalType"><option value="topik" ${goal.goalType === 'topik' ? 'selected' : ''}>Thi TOPIK</option><option value="communication" ${goal.goalType === 'communication' ? 'selected' : ''}>Giao tiếp</option><option value="study" ${goal.goalType === 'study' ? 'selected' : ''}>Du học</option><option value="work" ${goal.goalType === 'work' ? 'selected' : ''}>Làm việc / XKLĐ</option></select></label><label>TOPIK mục tiêu<select name="targetLevel">${[1,2,3,4,5,6].map((level) => `<option value="${level}" ${Number(goal.targetLevel) === level ? 'selected' : ''}>TOPIK ${level}</option>`).join('')}</select></label><label>Thời gian muốn đạt<input type="number" min="1" max="60" name="targetMonths" value="${goal.targetMonths}" /> tháng</label><label>Phút mỗi ngày<select name="dailyMinutes">${VALID_MINUTES.map((value) => `<option value="${value}" ${Number(goal.dailyMinutes) === value ? 'selected' : ''}>${value} phút</option>`).join('')}</select></label><label>Số ngày/tuần<input type="number" min="1" max="7" name="studyDaysPerWeek" value="${goal.studyDaysPerWeek}" /></label><label>Kỹ năng ưu tiên<input name="prioritySkills" value="${escapeHtml((goal.prioritySkills || []).join(', '))}" placeholder="listening, vocabulary" /></label><label>Mục tiêu cá nhân<textarea name="personalGoal" rows="2">${escapeHtml(goal.personalGoal || '')}</textarea></label><label>Ngày thi dự kiến<input type="date" name="deadline" value="${escapeHtml(goal.deadline || '')}" min="${dateKey()}" /></label><button class="btn primary full" type="submit">Lưu mục tiêu & tạo roadmap</button></form><div class="adaptive-week-plan">${weekly.map((item) => `<span class="${item.rest ? 'rest' : ''}"><b>${item.day}</b><small>${item.rest ? 'Nghỉ' : item.focus.map((focus) => skillLabel[focus] || focus).join(' + ')}</small></span>`).join('')}</div><div class="roadmap-phase-list">${phases.map((phase) => `<article class="roadmap-phase ${phase.status}"><div><span class="phase-index">${phase.index}</span><b>${escapeHtml(phase.title)}</b><small>${phase.weeks} tuần · ${escapeHtml(phase.rationale)}</small></div><span>${phase.status === 'active' ? 'Đang học' : 'Sắp tới'}</span></article>`).join('')}</div><button class="btn secondary full" id="generateAdaptiveRoadmap">Tạo diễn giải lộ trình</button><div id="adaptiveRoadmapOutput" class="coach-output hidden"></div>${days !== null ? `<p class="subtle">Deadline còn ${days} ngày.</p>` : ''}</section>`; }

  window.DailyMissionService = DailyMissionService;
  window.GoalTrackingService = GoalTrackingService;
  window.RoadmapService = RoadmapService;
  window.AdaptiveLearningProfileService = AdaptiveLearningProfileService;
  window.WeaknessDetectionService = WeaknessDetectionService;
  window.RootCauseAnalysisService = RootCauseAnalysisService;
  window.AdaptiveSrsPriorityService = AdaptiveSrsPriorityService;
  window.LearningSessionGeneratorService = LearningSessionGeneratorService;
  window.InactivityDetectionService = InactivityDetectionService;
  window.TopikReadinessDataService = TopikReadinessDataService;
  window.AdaptiveStudyPlanService = AdaptiveStudyPlanService;
  window.AdaptiveProgressService = AdaptiveProgressService;
  window.LevelAdaptiveExplanationService = LevelAdaptiveExplanationService;
  window.LearningSessionResultService = LearningSessionResultService;
  window.generateLearningSession = (input) => LearningSessionGeneratorService.generateLearningSession(input);
  window.AdaptiveLearningEngine = { priorities: buildPriorities, profile: AdaptiveLearningProfileService, weaknesses: WeaknessDetectionService, rootCauses: RootCauseAnalysisService, srsPriority: AdaptiveSrsPriorityService, generateLearningSession: (input) => LearningSessionGeneratorService.generateLearningSession(input), results: LearningSessionResultService, dailyMission: DailyMissionService, goals: GoalTrackingService, roadmap: RoadmapService, readiness: TopikReadinessDataService, weeklyPlan: AdaptiveStudyPlanService, progress: AdaptiveProgressService, inactivity: InactivityDetectionService };
  const previousAfterRender = window.KLEARN_AFTER_RENDER;
  const previousHomeExtra = window.KLEARN_EXTRA_HOME;
  const previousProfileExtra = window.KLEARN_EXTRA_PROFILE;
  window.KLEARN_EXTRA_VIEWS = { ...(window.KLEARN_EXTRA_VIEWS || {}), 'adaptive-plan': adaptiveView };
  window.KLEARN_EXTRA_HOME = () => `${previousHomeExtra ? previousHomeExtra() : ''}${missionCard()}`;
  window.KLEARN_EXTRA_PROFILE = () => `${previousProfileExtra ? previousProfileExtra() : ''}${goalCard()}`;
  window.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (state.currentView === 'home' && !window.DailyLearningExperienceService && !document.querySelector('.adaptive-mission-home')) (document.getElementById('homeMissionAnchor') || document.getElementById('app'))?.insertAdjacentHTML(document.getElementById('homeMissionAnchor') ? 'afterend' : 'beforeend', missionCard());
    if (state.currentView === 'profile' && !document.querySelector('.adaptive-goal-home')) document.getElementById('app')?.insertAdjacentHTML('afterbegin', goalCard());
    document.querySelectorAll('[data-view="adaptive-plan"]').forEach((button) => { button.onclick = () => setView('adaptive-plan'); });
    document.querySelectorAll('[data-adaptive-start]').forEach((button) => { button.onclick = () => { DailyMissionService.complete(button.dataset.adaptiveStart); DailyMissionService.start(button.dataset.adaptiveStart); }; });
    document.querySelectorAll('[data-adaptive-complete]').forEach((button) => { button.onclick = () => { DailyMissionService.complete(button.dataset.adaptiveComplete); toast('Đã lưu tiến độ nhiệm vụ hôm nay.'); render(); }; });
    document.querySelectorAll('[data-adaptive-practice]').forEach((button) => { button.onclick = () => { const weakness = WeaknessDetectionService.detect().find((item) => item.id === button.dataset.adaptivePractice); const plan = LearningSessionGeneratorService.generateLearningSession({ availableMinutes: 15, weaknesses: weakness ? [weakness] : [] }); const target = plan.tasks.find((item) => item.weaknessId === weakness?.id) || plan.tasks[0]; if (target?.actionView) setView(target.actionView); }; });
    const goalForm = document.getElementById('adaptiveGoalForm'); if (goalForm) goalForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(goalForm); GoalTrackingService.saveGoal({ currentLevel: String(form.get('currentLevel') || 'Beginner'), goalType: String(form.get('goalType') || 'topik'), targetLevel: Number(form.get('targetLevel')) || 2, targetMonths: Number(form.get('targetMonths')) || 6, dailyMinutes: Number(form.get('dailyMinutes')) || 20, studyDaysPerWeek: Number(form.get('studyDaysPerWeek')) || 6, prioritySkills: String(form.get('prioritySkills') || '').split(',').map((item) => item.trim().toLocaleLowerCase()).filter(Boolean), personalGoal: String(form.get('personalGoal') || ''), deadline: String(form.get('deadline') || '') }); toast('Đã lưu mục tiêu và tạo roadmap.'); render(); };
    const aiButton = document.getElementById('generateAdaptiveRoadmap'); if (aiButton) aiButton.onclick = async () => { aiButton.disabled = true; aiButton.textContent = 'Đang phân tích...'; const result = await RoadmapService.generateWithAI(); const output = document.getElementById('adaptiveRoadmapOutput'); if (output) { output.classList.remove('hidden'); output.innerHTML = escapeHtml(result.text).replace(/\n/g, '<br>'); } aiButton.disabled = false; };
  };
  render();
})();
