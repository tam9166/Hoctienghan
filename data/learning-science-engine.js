/* Tiếng Hàn - TamHoanq · P41 Learning Science Engine */
(function buildLearningScienceEngine(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, render, setView, toast, escapeHtml, getUserProgress, PracticeService, VocabularyService, CloudSyncService } = app;
  const DAY = 86400000;
  const routes = new Set(['learning-science', 'active-recall', 'interleaved-practice', 'concept-mastery']);
  const runtime = state.learningScienceRuntime || (state.learningScienceRuntime = { content: null, loading: false, error: '', recall: null, recallFeedback: null });
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
  const round = (value) => Math.round(Number(value) || 0);
  const language = () => global.document?.documentElement?.lang || 'vi';
  const localize = (value) => typeof value === 'string' ? value : (value?.[language()] || value?.vi || value?.en || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const normalize = (value) => String(value || '').normalize('NFC').trim().toLocaleLowerCase().replace(/[\s.,!?;:'"“”‘’()\[\]{}]/g, '');
  const list = (value) => Array.isArray(value) ? value : [];
  const now = () => new Date().toISOString();
  const meaning = (card) => card.meaningVi || card.vietnamese || card.meaning || card.meanings?.vi || '';

  const LearningScienceContentService = {
    hydrate(value) {
      if (value?.verified !== true || value.reviewStatus !== 'approved' || value.modelVersion !== 'p41-heuristic-v1' || value.privacy?.storesRawAnswers !== false || value.privacy?.storesAudio !== false || value.privacy?.medicalInference !== false) throw new Error('Learning science quality gate failed');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/learning-science-engine.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Learning science ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = String(error.message || error).slice(0, 180); return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView) || state.currentView === 'analytics') render(); });
      return runtime.loading;
    }
  };

  const SpacedRepetitionOptimizer = {
    analyze(card = {}, referenceTime = Date.now()) {
      const base = global.MemoryRiskService?.analyze?.(card, referenceTime) || {};
      const correct = Math.max(0, Number(card.correctCount || 0)); const wrong = Math.max(0, Number(card.wrongCount || 0)); const attempts = Math.max(Number(card.reviewCount || 0), correct + wrong);
      const mistakeFrequency = attempts ? wrong / Math.max(1, correct + wrong) : .5;
      const declared = String(card.difficulty || 'normal').toLowerCase();
      const difficulty = ['easy', 'normal', 'hard'].includes(declared) ? declared : mistakeFrequency >= .45 ? 'hard' : mistakeFrequency <= .15 && attempts >= 3 ? 'easy' : 'normal';
      const confidenceValue = card.confidence == null ? null : clamp(Number(card.confidence) <= 5 ? Number(card.confidence) * 20 : card.confidence);
      const evidenceConfidence = attempts ? clamp((correct / Math.max(1, correct + wrong)) * 75 + Math.min(25, attempts * 3)) : 25;
      const confidence = round(confidenceValue == null ? evidenceConfidence : confidenceValue * .65 + evidenceConfidence * .35);
      const forgettingProbability = clamp(base.riskScore == null ? 100 - clamp(card.mastery || 0) : base.riskScore) / 100;
      const weights = runtime.content?.srs?.priorityWeights || { forgetting: .42, mistakes: .24, difficulty: .18, lowConfidence: .16 };
      const difficultyScore = difficulty === 'hard' ? 100 : difficulty === 'easy' ? 25 : 60;
      const priority = round(forgettingProbability * 100 * weights.forgetting + mistakeFrequency * 100 * weights.mistakes + difficultyScore * weights.difficulty + (100 - confidence) * weights.lowConfidence);
      return { ...base, wordId: card.wordId || card.id, korean: card.korean || '', difficulty, confidence, mistakeFrequency: round(mistakeFrequency * 100), forgettingProbability: Number(forgettingProbability.toFixed(3)), priority: clamp(priority), evidenceCount: attempts };
    },
    rank(cards = state.srsData || [], limit = 20, referenceTime = Date.now()) { return list(cards).map((card) => ({ card, ...this.analyze(card, referenceTime) })).sort((a, b) => b.priority - a.priority || b.forgettingProbability - a.forgettingProbability).slice(0, limit); },
    nextInterval(card = {}, result = {}) {
      const current = this.analyze(card); const previous = Math.max(1, Number(card.intervalDays || card.interval || 1)); const correct = Boolean(result.correct); const selfConfidence = clamp(Number(result.confidence || 3), 1, 5);
      const factor = correct ? .85 + selfConfidence * .35 : .45; const difficultyFactor = current.difficulty === 'hard' ? .72 : current.difficulty === 'easy' ? 1.25 : 1;
      const minimum = Number(runtime.content?.srs?.minimumIntervalDays || 1); const maximum = Number(runtime.content?.srs?.maximumIntervalDays || 120);
      return Math.max(minimum, Math.min(maximum, round(previous * factor * difficultyFactor)));
    }
  };

  const ActiveRecallService = {
    candidates(limit = 10) { return SpacedRepetitionOptimizer.rank(state.srsData || [], limit).filter((item) => item.card?.korean && meaning(item.card)); },
    start(limit = 10) {
      const cards = this.candidates(Math.max(1, Math.min(20, Number(limit) || 10))).map((item) => ({ wordId: item.wordId, korean: item.card.korean, prompt: `${item.card.korean} = ?`, answer: meaning(item.card), science: item }));
      runtime.recall = { id: `recall-${Date.now().toString(36)}`, cards, index: 0, correct: 0, startedAt: now(), responses: [] }; runtime.recallFeedback = null; return runtime.recall;
    },
    current() { return runtime.recall?.cards?.[runtime.recall.index] || null; },
    answer(response, confidence = 3) {
      const session = runtime.recall; const item = this.current(); if (!session || !item || runtime.recallFeedback) return null;
      const accepted = String(item.answer).split(/[;,/]/).map(normalize).filter(Boolean); const submitted = normalize(response); const correct = Boolean(submitted && accepted.some((answer) => answer === submitted || (answer.length >= 4 && (answer.includes(submitted) || submitted.includes(answer)))));
      const card = (state.srsData || []).find((entry) => (entry.wordId || entry.id) === item.wordId) || {}; const nextInterval = SpacedRepetitionOptimizer.nextInterval(card, { correct, confidence }); const reviewedAt = now();
      VocabularyService?.updateCard?.(item.wordId, { correctCount: Number(card.correctCount || 0) + (correct ? 1 : 0), wrongCount: Number(card.wrongCount || 0) + (correct ? 0 : 1), reviewCount: Number(card.reviewCount || 0) + 1, streakCorrect: correct ? Number(card.streakCorrect || 0) + 1 : 0, mastery: clamp(Number(card.mastery || 0) + (correct ? 6 : -10)), confidence: clamp(Number(confidence), 1, 5), lastReviewed: reviewedAt, nextReview: new Date(Date.now() + nextInterval * DAY).toISOString(), intervalDays: nextInterval, status: correct && Number(card.mastery || 0) >= 84 ? 'mastered' : 'review', lastResult: { result: correct ? 'correct' : 'wrong', testedAt: reviewedAt, correct, responseStored: false } });
      session.responses.push({ wordId: item.wordId, correct, confidence: clamp(confidence, 1, 5), answeredAt: reviewedAt, rawAnswerStored: false }); if (correct) session.correct += 1;
      runtime.recallFeedback = { correct, answer: item.answer, intervalDays: nextInterval }; CloudSyncService?.schedule?.('learning-science-recall'); return runtime.recallFeedback;
    },
    next() { if (!runtime.recall) return null; runtime.recall.index += 1; runtime.recallFeedback = null; if (runtime.recall.index >= runtime.recall.cards.length) { runtime.recall.completedAt = now(); return null; } return this.current(); },
    finish() { const session = runtime.recall; if (!session) return null; return { total: session.cards.length, correct: session.correct, percentage: round(session.correct / Math.max(1, session.cards.length) * 100), rawAnswersStored: false }; }
  };

  const InterleavedPracticeService = {
    pool() { const sets = PracticeService?.bank?.sets || []; return sets.flatMap((set) => PracticeService.bank.getQuestions(set.id)).filter((item, index, values) => ['grammar', 'vocabulary', 'listening'].includes(item.skill) && values.findIndex((candidate) => candidate.id === item.id) === index); },
    build(count = 12, inputQuestions) {
      const pool = list(inputQuestions || this.pool()); const groups = { vocabulary: [], grammar: [], listening: [] }; pool.forEach((item) => { if (groups[item.skill]) groups[item.skill].push(item); });
      const result = []; const order = ['vocabulary', 'listening', 'grammar']; let cursor = 0;
      while (result.length < Math.min(Number(count) || 12, pool.length) && order.some((skill) => groups[skill].length)) { const skill = order[cursor % order.length]; const next = groups[skill].shift(); if (next) result.push(next); cursor += 1; }
      return result;
    },
    start(count = 12) { const questions = this.build(count); return PracticeService?.startQuestions?.(questions, copy('Luyện xen kẽ · nhớ chủ động', 'Interleaved active practice', '交错主动练习'), 'learning-science-interleaved') || false; }
  };

  const DifficultyAdaptationService = {
    recommend(inputHistory) {
      const size = Number(runtime.content?.adaptation?.windowSize || 6); const minimum = Number(runtime.content?.adaptation?.minimumEvidence || 3); const history = list(inputHistory || PracticeService?.getHistory?.()).slice(0, size); if (history.length < minimum) return { level: 'normal', ready: false, sampleCount: history.length, reason: copy('Giữ mức bình thường cho đến khi đủ 3 kết quả.', 'Keep normal difficulty until 3 results are available.', '取得 3 次结果前保持普通难度。') };
      const average = history.reduce((sum, item) => sum + clamp(item.percentage ?? (item.correct ? 100 : 0)), 0) / history.length; const hard = Number(runtime.content?.adaptation?.hardThreshold || 85); const easy = Number(runtime.content?.adaptation?.easyThreshold || 55); const level = average >= hard ? 'hard' : average < easy ? 'easy' : 'normal';
      return { level, ready: true, sampleCount: history.length, average: round(average), reason: level === 'hard' ? copy('Độ chính xác ổn định, có thể tăng thử thách.', 'Stable accuracy supports a harder set.', '准确率稳定，可以提高难度。') : level === 'easy' ? copy('Giảm tải để củng cố nền tảng.', 'Reduce load to rebuild the foundation.', '降低负荷以巩固基础。') : copy('Mức hiện tại đang phù hợp.', 'The current level is appropriate.', '当前难度合适。') };
    }
  };

  const LearningFatigueService = {
    assess({ startedAt, answers = [], durationMinutes } = {}) {
      const minutes = Number.isFinite(Number(durationMinutes)) ? Number(durationMinutes) : startedAt ? Math.max(0, (Date.now() - new Date(startedAt).getTime()) / 60000) : 0;
      let consecutiveMistakes = 0; for (let index = answers.length - 1; index >= 0 && answers[index]?.correct === false; index -= 1) consecutiveMistakes += 1;
      const durationLimit = Number(runtime.content?.cognitiveLoad?.fatigueMinutes || 45); const errorLimit = Number(runtime.content?.cognitiveLoad?.consecutiveMistakes || 3); const shouldPause = minutes >= durationLimit || consecutiveMistakes >= errorLimit;
      return { level: shouldPause ? (minutes >= 60 || consecutiveMistakes >= 5 ? 'high' : 'medium') : 'low', shouldPause, durationMinutes: round(minutes), consecutiveMistakes, reason: minutes >= durationLimit ? copy('Phiên học đã kéo dài; nghỉ ngắn có thể giúp giữ chất lượng.', 'The session is long; a short break may preserve quality.', '学习时间较长，短暂休息有助于保持质量。') : consecutiveMistakes >= errorLimit ? copy('Nhiều lỗi liên tiếp; nên dừng và xem lại một ví dụ.', 'Several consecutive errors; pause and review one example.', '连续多次出错，建议暂停并复习一个例子。') : copy('Chưa có tín hiệu cần nghỉ.', 'No break signal right now.', '目前没有需要休息的信号。'), medicalAssessment: false };
    },
    current() { const recall = runtime.recall; return this.assess(recall ? { startedAt: recall.startedAt, answers: recall.responses } : {}); }
  };

  const CognitiveLoadService = {
    estimate(options = {}) {
      const preferred = Math.max(5, Math.min(60, Number(options.preferredMinutes || state.currentUser?.studyMinutesPerDay || 20))); const history = list(options.history || PracticeService?.getHistory?.()).slice(0, 5); const average = history.length ? history.reduce((sum, item) => sum + clamp(item.percentage), 0) / history.length : 70; const fatigue = options.fatigue || LearningFatigueService.current();
      const adjustment = fatigue.shouldPause ? -.5 : average >= 85 ? .15 : average < 55 ? -.25 : 0; const capacity = Math.max(Number(runtime.content?.cognitiveLoad?.minimumMinutes || 5), Math.min(Number(runtime.content?.cognitiveLoad?.maximumMinutes || 60), Math.round(preferred * (1 + adjustment) / 5) * 5));
      return { minutes: capacity, taskLimit: Math.min(Number(runtime.content?.cognitiveLoad?.maximumTasks || 3), capacity <= 10 ? 1 : capacity <= 25 ? 2 : 3), adjustment, evidenceCount: history.length, reason: fatigue.shouldPause ? copy('Kế hoạch được rút gọn vì tín hiệu mệt trong phiên.', 'The plan is shortened by an in-session fatigue signal.', '因本次学习出现疲劳信号，计划已缩短。') : copy('Ước tính từ thời gian mong muốn và kết quả gần đây.', 'Estimated from preferred time and recent outcomes.', '根据期望时长与近期表现估算。') };
    }
  };

  const RetentionScoreService = {
    scores(cards = state.srsData || [], history = PracticeService?.getHistory?.() || []) {
      const reviewed = list(cards).filter((card) => Number(card.reviewCount || 0) > 0 || card.lastReviewed); const vocabulary = reviewed.length ? round(reviewed.reduce((sum, card) => sum + (global.MemoryRiskService?.analyze?.(card).recallStrength ?? 100 - SpacedRepetitionOptimizer.analyze(card).forgettingProbability * 100), 0) / reviewed.length) : null;
      const grammarValues = list(history).flatMap((item) => item.skillBreakdown?.grammar == null ? [] : [Number(item.skillBreakdown.grammar)]); const grammar = grammarValues.length ? round(grammarValues.reduce((sum, value) => sum + value, 0) / grammarValues.length) : null;
      return { vocabulary, grammar, evidence: { vocabulary: reviewed.length, grammar: grammarValues.length }, ready: vocabulary != null || grammar != null };
    }
  };

  const MisconceptionDetectionService = {
    detect(errors = global.ErrorNotebookService?.top?.(100) || []) {
      const patterns = list(runtime.content?.misconceptions); return patterns.map((pattern) => { const evidence = list(errors).filter((error) => { const text = `${error.question || ''} ${error.mistake || ''} ${error.correction || ''} ${error.explanation || ''}`; return pattern.tokens.every((token) => text.includes(token)) || (pattern.tokens.some((token) => text.includes(token)) && Number(error.count || 1) >= 2); }); const count = evidence.reduce((sum, item) => sum + Math.max(1, Number(item.count || 1)), 0); return { ...pattern, label: localize(pattern.label), evidenceCount: count, confidence: count >= 5 ? 'high' : count >= 2 ? 'developing' : 'insufficient', detected: count >= 2 }; }).filter((item) => item.detected).sort((a, b) => b.evidenceCount - a.evidenceCount);
    }
  };

  const ConceptMasteryTreeService = {
    tree() {
      const progress = getUserProgress?.() || {}; const skills = progress.skills || {}; const retention = RetentionScoreService.scores();
      return list(runtime.content?.conceptTree).map((node) => { const score = node.id === 'vocabulary' && retention.vocabulary != null ? retention.vocabulary : node.id === 'grammar' && retention.grammar != null ? retention.grammar : clamp(skills[node.skill] || 0); return { ...node, label: localize(node.label), score: round(score), status: score >= 80 ? 'strong' : score >= 50 ? 'building' : 'foundation', locked: false }; });
    }
  };

  const OptimalLearningPlanService = {
    build(options = {}) {
      const load = CognitiveLoadService.estimate({ preferredMinutes: options.minutes }); const retention = RetentionScoreService.scores(); const misconceptions = MisconceptionDetectionService.detect(); const difficulty = DifficultyAdaptationService.recommend(); const risk = SpacedRepetitionOptimizer.rank(state.srsData || [], 20); const candidates = [];
      if (risk.length) candidates.push({ id: 'active-recall', title: copy('Nhớ chủ động từ cần ôn', 'Actively recall due words', '主动回忆待复习词汇'), route: 'active-recall', minutes: 5, impact: 95, reason: `${risk.filter((item) => item.priority >= 60).length} ${copy('mục ưu tiên', 'priority items', '个优先项目')}` });
      if (misconceptions.length) candidates.push({ id: 'misconception', title: misconceptions[0].label, route: misconceptions[0].route, minutes: 10, impact: 92, reason: `${misconceptions[0].evidenceCount}× ${copy('lặp lại', 'repeated', '重复')}` });
      if (retention.grammar != null && retention.grammar < 75) candidates.push({ id: 'grammar', title: copy('Củng cố ngữ pháp', 'Reinforce grammar', '巩固语法'), route: 'interleaved-practice', minutes: 10, impact: 84, reason: `Retention ${retention.grammar}%` });
      candidates.push({ id: 'interleaved', title: copy('Luyện xen kẽ', 'Interleaved practice', '交错练习'), route: 'interleaved-practice', minutes: 10, impact: 72, reason: `${copy('Độ khó', 'Difficulty', '难度')}: ${difficulty.level}` });
      let remaining = load.minutes; const tasks = []; candidates.sort((a, b) => b.impact / b.minutes - a.impact / a.minutes).forEach((task) => { if (tasks.length < load.taskLimit && task.minutes <= remaining) { tasks.push(task); remaining -= task.minutes; } });
      if (!tasks.length) tasks.push({ ...candidates[0], minutes: Math.min(load.minutes, candidates[0].minutes) });
      return { minutes: tasks.reduce((sum, task) => sum + task.minutes, 0), capacityMinutes: load.minutes, tasks, difficulty: difficulty.level, load, disclaimer: localize(runtime.content?.disclaimer) };
    }
  };

  function scoreMarkup(label, value, sample) { return `<article><small>${escapeHtml(label)}</small><strong>${value == null ? '—' : `${value}%`}</strong><span>${value == null ? copy('Chưa đủ dữ liệu', 'Not enough evidence', '数据不足') : `${sample} ${copy('tín hiệu', 'signals', '个信号')}`}</span></article>`; }
  function dashboardView() {
    const plan = OptimalLearningPlanService.build(); const retention = RetentionScoreService.scores(); const fatigue = LearningFatigueService.current(); const difficulty = DifficultyAdaptationService.recommend(); const misconceptions = MisconceptionDetectionService.detect(); const tree = ConceptMasteryTreeService.tree();
    return `<section class="section ls-shell"><header class="ls-hero"><div><button class="back-link" data-view="home">← Home</button><p class="eyebrow">Learning Science</p><h1 class="headline">${copy('Học ít hơn, nhớ chắc hơn', 'Study with less waste, remember with confidence', '减少无效学习，记得更牢')}</h1><p>${copy('Một lớp điều phối minh bạch trên SRS, Mastery, lịch sử luyện và Sổ lỗi hiện có.', 'A transparent orchestration layer over your existing SRS, Mastery, practice history and Error Notebook.', '基于现有 SRS、掌握度、练习历史和错题本的透明调度层。')}</p></div><span class="ls-method">${copy('Quy tắc cục bộ · không chatbot', 'Local rules · no chatbot', '本地规则 · 非聊天机器人')}</span></header>
    <div class="ls-score-grid">${scoreMarkup(copy('Nhớ từ vựng', 'Vocabulary retention', '词汇保持度'), retention.vocabulary, retention.evidence.vocabulary)}${scoreMarkup(copy('Nhớ ngữ pháp', 'Grammar retention', '语法保持度'), retention.grammar, retention.evidence.grammar)}${scoreMarkup(copy('Sức chứa hôm nay', 'Today’s capacity', '今日学习容量'), plan.capacityMinutes, `${plan.load.taskLimit} ${copy('bước', 'steps', '步')}`)}<article><small>${copy('Độ khó đề xuất', 'Suggested difficulty', '建议难度')}</small><strong>${difficulty.level}</strong><span>${difficulty.ready ? `${difficulty.average}%` : copy('đang thu thập dữ liệu', 'collecting evidence', '正在收集数据')}</span></article></div>
    <section class="ls-plan"><div><p class="eyebrow">Optimal Plan</p><h2>${copy(`Kế hoạch ${plan.minutes} phút`, `${plan.minutes}-minute plan`, `${plan.minutes} 分钟计划`)}</h2><p>${escapeHtml(plan.load.reason)}</p></div><ol>${plan.tasks.map((task, index) => `<li><span>${index + 1}</span><div><b>${escapeHtml(task.title)}</b><small>${task.minutes}′ · ${escapeHtml(task.reason)}</small></div><button data-view="${escapeHtml(task.route)}">${copy('Mở', 'Open', '打开')}</button></li>`).join('')}</ol></section>
    <div class="ls-action-grid"><button data-view="active-recall"><span>?</span><b>${copy('Nhớ chủ động', 'Active recall', '主动回忆')}</b><small>${copy('Không hiện đáp án trước khi bạn trả lời.', 'The answer stays hidden until you respond.', '回答前隐藏答案。')}</small></button><button data-view="interleaved-practice"><span>⇄</span><b>${copy('Luyện xen kẽ', 'Interleaved practice', '交错练习')}</b><small>${copy('Từ vựng · nghe · ngữ pháp luân phiên.', 'Vocabulary · listening · grammar in rotation.', '词汇、听力、语法轮换。')}</small></button><button data-view="concept-mastery"><span>⌁</span><b>${copy('Cây thành thạo', 'Mastery tree', '掌握树')}</b><small>${copy('Quan hệ nền tảng, không khóa cứng.', 'Dependencies without hard locks.', '展示依赖关系，不强制锁定。')}</small></button></div>
    <section class="ls-evidence-grid"><article><h2>${copy('Tín hiệu trong phiên', 'In-session signal', '本次学习信号')}</h2><strong class="${fatigue.shouldPause ? 'warn' : ''}">${fatigue.shouldPause ? copy('Nên nghỉ ngắn', 'Take a short break', '建议短暂休息') : copy('Có thể tiếp tục', 'Ready to continue', '可以继续')}</strong><p>${escapeHtml(fatigue.reason)}</p><small>${copy('Đây không phải đánh giá sức khỏe.', 'This is not a health assessment.', '这不是健康评估。')}</small></article><article><h2>${copy('Hiểu sai cần sửa', 'Misconceptions to repair', '需要纠正的误解')}</h2>${misconceptions.length ? misconceptions.map((item) => `<button data-view="${escapeHtml(item.route)}"><b>${escapeHtml(item.label)}</b><small>${item.evidenceCount}× · ${item.confidence}</small></button>`).join('') : `<p>${copy('Chưa có mẫu lỗi lặp đủ mạnh.', 'No repeated pattern has enough evidence.', '尚无足够证据的重复错误模式。')}</p>`}</article></section>
    <section class="ls-mini-tree">${tree.map((node, index) => `${index ? '<i>→</i>' : ''}<div class="${node.status}"><b>${escapeHtml(node.label)}</b><span>${node.score}%</span><small>${node.locked ? 'locked' : copy('luôn có thể học', 'always available', '始终可学习')}</small></div>`).join('')}</section><footer>${escapeHtml(plan.disclaimer || '')}</footer></section>`;
  }

  function activeRecallView() {
    const session = runtime.recall || ActiveRecallService.start(10); const item = ActiveRecallService.current(); const feedback = runtime.recallFeedback; if (!item) { const result = ActiveRecallService.finish(); return `<section class="section ls-complete"><button class="back-link" data-view="learning-science">←</button><span>✓</span><h1>${copy('Phiên nhớ chủ động hoàn tất', 'Active recall complete', '主动回忆完成')}</h1><p>${result?.correct || 0}/${result?.total || 0} · ${result?.percentage || 0}%</p><small>${copy('Chỉ chỉ số được giữ trong phiên; câu trả lời thô không được lưu.', 'Only session metrics are retained; raw answers are not stored.', '仅保留学习指标，不保存原始答案。')}</small><button class="btn primary" data-restart-recall>${copy('Luyện lại', 'Practise again', '再次练习')}</button></section>`; }
    return `<section class="section ls-recall"><header><button class="back-link" data-view="learning-science">←</button><p class="eyebrow">Active Recall · ${session.index + 1}/${session.cards.length}</p><div class="bar"><span style="width:${round((session.index + (feedback ? 1 : 0)) / session.cards.length * 100)}%"></span></div></header><article><small>${copy('Tự nhớ nghĩa trước khi xem đáp án', 'Recall the meaning before seeing the answer', '查看答案前先主动回忆')}</small><h1 lang="ko">${escapeHtml(item.prompt)}</h1>${feedback ? `<div class="ls-reveal ${feedback.correct ? 'correct' : 'wrong'}" role="status"><b>${feedback.correct ? copy('Chính xác', 'Correct', '正确') : copy('Cần ôn lại', 'Review needed', '需要复习')}</b><strong>${escapeHtml(feedback.answer)}</strong><small>${copy(`Lịch ôn tiếp theo: ${feedback.intervalDays} ngày`, `Next interval: ${feedback.intervalDays} days`, `下次间隔：${feedback.intervalDays} 天`)}</small></div><button class="btn primary" data-recall-next>${copy('Câu tiếp theo', 'Next item', '下一项')}</button>` : `<form id="activeRecallForm"><label>${copy('Câu trả lời', 'Your answer', '你的答案')}<input name="response" autocomplete="off" required aria-describedby="recallHint"></label><p id="recallHint">${copy('Đáp án chưa được hiển thị.', 'The answer is still hidden.', '答案仍处于隐藏状态。')}</p><fieldset><legend>${copy('Bạn tự tin mức nào?', 'How confident are you?', '你有多自信？')}</legend>${[1,2,3,4,5].map((value) => `<label><input type="radio" name="confidence" value="${value}" ${value === 3 ? 'checked' : ''}><span>${value}</span></label>`).join('')}</fieldset><button class="btn primary" type="submit">${copy('Kiểm tra', 'Check', '检查')}</button></form>`}</article></section>`;
  }

  function interleavedView() { const questions = InterleavedPracticeService.build(12); const difficulty = DifficultyAdaptationService.recommend(); const counts = questions.reduce((acc, item) => ({ ...acc, [item.skill]: (acc[item.skill] || 0) + 1 }), {}); return `<section class="section ls-interleaved"><button class="back-link" data-view="learning-science">←</button><p class="eyebrow">Interleaved Practice</p><h1 class="headline">${copy('Trộn kỹ năng như lúc sử dụng thật', 'Mix skills as in real use', '像真实使用一样混合技能')}</h1><p>${copy('Câu hỏi lấy từ ngân hàng hiện có và được xếp luân phiên, không tạo nội dung mới.', 'Questions come from the existing bank and are rotated; no new content is generated.', '题目来自现有题库并交错排列，不生成新内容。')}</p><div class="ls-mix">${questions.map((item, index) => `<span class="${escapeHtml(item.skill)}"><b>${index + 1}</b>${escapeHtml(item.skill)}</span>`).join('')}</div><dl><div><dt>${copy('Từ vựng', 'Vocabulary', '词汇')}</dt><dd>${counts.vocabulary || 0}</dd></div><div><dt>${copy('Nghe', 'Listening', '听力')}</dt><dd>${counts.listening || 0}</dd></div><div><dt>${copy('Ngữ pháp', 'Grammar', '语法')}</dt><dd>${counts.grammar || 0}</dd></div><div><dt>${copy('Độ khó', 'Difficulty', '难度')}</dt><dd>${difficulty.level}</dd></div></dl><button class="btn primary" data-start-interleaved ${questions.length ? '' : 'disabled'}>${copy(`Bắt đầu ${questions.length} câu`, `Start ${questions.length} items`, `开始 ${questions.length} 题`)}</button></section>`; }

  function conceptView() { const tree = ConceptMasteryTreeService.tree(); return `<section class="section ls-concept"><button class="back-link" data-view="learning-science">←</button><p class="eyebrow">Concept Mastery Tree</p><h1 class="headline">${copy('Nền tảng dẫn tới khả năng tạo câu', 'Foundations lead to sentence production', '从基础走向造句')}</h1><p>${copy('Điểm phản ánh dữ liệu hiện có. Không có phần nào bị khóa cứng.', 'Scores reflect current evidence. Nothing is hard-locked.', '分数反映现有数据，不会强制锁定任何部分。')}</p><ol>${tree.map((node, index) => `<li class="${node.status}"><span>${index + 1}</span><div><b>${escapeHtml(node.label)}</b><small>${node.dependsOn.length ? `${copy('Dựa trên', 'Builds on', '基于')}: ${escapeHtml(node.dependsOn.join(', '))}` : copy('Nền tảng đầu tiên', 'First foundation', '第一基础')}</small><div class="bar"><i style="width:${node.score}%"></i></div></div><strong>${node.score}%</strong></li>`).join('')}</ol><button class="btn secondary" data-view="lessons">${copy('Mở lộ trình học', 'Open learning path', '打开学习路径')}</button></section>`; }

  const services = { LearningScienceContentService, SpacedRepetitionOptimizer, ActiveRecallService, InterleavedPracticeService, DifficultyAdaptationService, CognitiveLoadService, RetentionScoreService, LearningFatigueService, ConceptMasteryTreeService, MisconceptionDetectionService, OptimalLearningPlanService };
  Object.assign(global, services); global.LearningScienceEngine = { ...services, analyze: () => ({ retention: RetentionScoreService.scores(), difficulty: DifficultyAdaptationService.recommend(), fatigue: LearningFatigueService.current(), misconceptions: MisconceptionDetectionService.detect(), conceptTree: ConceptMasteryTreeService.tree(), plan: OptimalLearningPlanService.build() }) };
  if (global.SmartReviewService && !global.SmartReviewService.__learningScienceEnhanced) { global.SmartReviewService.science = (card) => SpacedRepetitionOptimizer.analyze(card); global.SmartReviewService.scienceRank = (cards, limit) => SpacedRepetitionOptimizer.rank(cards, limit); global.SmartReviewService.__learningScienceEnhanced = true; }
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'learning-science': dashboardView, 'active-recall': activeRecallView, 'interleaved-practice': interleavedView, 'concept-mastery': conceptView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; if (state.currentView === 'analytics' && !global.document?.querySelector?.('.ls-analytics-entry')) { global.document?.getElementById?.('app')?.insertAdjacentHTML?.('beforeend', `<section class="section ls-analytics-entry"><div><p class="eyebrow">Learning Science</p><h2>${copy('Từ số liệu đến hành động học', 'Turn evidence into a study action', '把数据转化为学习行动')}</h2><p>${copy('Nhớ chủ động, luyện xen kẽ và kế hoạch tối ưu theo sức chứa hôm nay.', 'Active recall, interleaving and a plan sized for today.', '主动回忆、交错练习与适合今日容量的计划。')}</p></div><button class="btn primary" data-view="learning-science">${copy('Mở Learning Science', 'Open Learning Science', '打开学习科学')}</button></section>`); global.document?.querySelector?.('.ls-analytics-entry [data-view="learning-science"]')?.addEventListener('click', () => setView('learning-science')); } global.document?.getElementById?.('activeRecallForm')?.addEventListener('submit', (event) => { event.preventDefault(); const form = new FormData(event.currentTarget); ActiveRecallService.answer(form.get('response'), Number(form.get('confidence') || 3)); render(); }); global.document?.querySelector?.('[data-recall-next]')?.addEventListener('click', () => { ActiveRecallService.next(); render(); }); global.document?.querySelector?.('[data-restart-recall]')?.addEventListener('click', () => { ActiveRecallService.start(10); render(); }); global.document?.querySelector?.('[data-start-interleaved]')?.addEventListener('click', () => { if (!InterleavedPracticeService.start(12)) toast(copy('Chưa đủ câu hỏi đã duyệt.', 'Not enough approved questions.', '已审核题目不足。')); }); };
  LearningScienceContentService.load();
})(window);
