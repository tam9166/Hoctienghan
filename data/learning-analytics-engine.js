/* Tiếng Hàn - TamHoanq — interpretable learning intelligence analytics */
(function buildLearningAnalytics(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, render, escapeHtml, getUserProgress, PracticeService, LearnerProfileService } = app;
  const DAY = 86400000;
  const clamp = (value, min = 0, max = 100) => Math.min(max, Math.max(min, Number(value) || 0));
  const language = () => global.document?.documentElement?.lang || 'vi';
  const localize = (value) => typeof value === 'string' ? value : (value?.[language()] || value?.vi || value?.en || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const dateMs = (value, fallback = Date.now()) => { const time = new Date(value || '').getTime(); return Number.isFinite(time) ? time : fallback; };
  const round = (value) => Math.round(Number(value) || 0);

  const SKILL_LABELS = Object.freeze({
    vocabulary: { vi: 'Từ vựng', en: 'Vocabulary', 'zh-CN': '词汇' },
    grammar: { vi: 'Ngữ pháp', en: 'Grammar', 'zh-CN': '语法' },
    listening: { vi: 'Nghe', en: 'Listening', 'zh-CN': '听力' },
    speaking: { vi: 'Nói', en: 'Speaking', 'zh-CN': '口语' },
    reading: { vi: 'Đọc', en: 'Reading', 'zh-CN': '阅读' },
    writing: { vi: 'Viết', en: 'Writing', 'zh-CN': '写作' }
  });
  const skillLabel = (skill) => localize(SKILL_LABELS[skill] || skill);

  const MemoryRiskService = {
    analyze(card = {}, referenceTime = Date.now()) {
      const reviewed = card.lastReviewed || card.updatedAt || card.createdAt;
      const neverReviewed = !card.lastReviewed;
      const elapsedDays = neverReviewed ? Math.max(1, Number(card.intervalDays || card.interval || 1)) : Math.max(0, (referenceTime - dateMs(reviewed, referenceTime)) / DAY);
      const correct = Math.max(0, Number(card.correctCount || 0));
      const wrong = Math.max(0, Number(card.wrongCount || 0));
      const attempts = Math.max(Number(card.reviewCount || 0), correct + wrong);
      const accuracy = attempts ? correct / Math.max(1, correct + wrong) : .35;
      const mastery = clamp(card.mastery || 0);
      const evidence = Math.min(1, attempts / 8);
      const learnedBase = mastery * .5 + accuracy * 100 * .35 + evidence * 100 * .15;
      const interval = Math.max(1, Number(card.intervalDays || card.interval || 3));
      const stabilityDays = Math.max(1, interval * (.65 + accuracy) + Math.max(0, Number(card.streakCorrect || 0)) * 1.25);
      const decay = neverReviewed ? .42 : Math.exp(-elapsedDays / (stabilityDays * 1.4));
      const recallStrength = clamp(round(learnedBase * decay));
      const overdueDays = Math.max(0, (referenceTime - dateMs(card.nextReview, referenceTime)) / DAY);
      const riskScore = clamp(round(100 - recallStrength * .78 + Math.min(22, overdueDays * 1.6) + (neverReviewed ? 10 : 0)));
      const level = riskScore >= 67 ? 'high' : riskScore >= 35 ? 'medium' : 'low';
      const reasons = [];
      if (neverReviewed) reasons.push(copy('Chưa có lần ôn hoàn chỉnh', 'No completed review yet', '尚未完成复习'));
      if (elapsedDays >= 30) reasons.push(copy(`${Math.floor(elapsedDays)} ngày chưa gặp lại`, `Not seen for ${Math.floor(elapsedDays)} days`, `${Math.floor(elapsedDays)} 天未复习`));
      if (wrong > correct && attempts) reasons.push(copy('Số lần sai cao hơn đúng', 'More incorrect than correct recalls', '错误次数高于正确次数'));
      if (mastery < 50) reasons.push(copy('Mastery còn thấp', 'Mastery is still low', '掌握度仍较低'));
      if (!reasons.length) reasons.push(copy('Khoảng ôn và độ ổn định hiện tại', 'Current review interval and stability', '当前复习间隔与稳定性'));
      return { wordId: card.wordId || card.id, korean: card.korean || '', mastery, attempts, accuracy: round(accuracy * 100), elapsedDays: Math.floor(elapsedDays), stabilityDays: round(stabilityDays), recallStrength, riskScore, level, reasons, evidence: attempts >= 5 ? 'strong' : attempts >= 2 ? 'developing' : 'limited' };
    },
    rank(cards = state.srsData || [], limit = 12, referenceTime = Date.now()) { return cards.map((card) => ({ card, ...this.analyze(card, referenceTime) })).sort((a, b) => b.riskScore - a.riskScore || a.recallStrength - b.recallStrength).slice(0, limit); }
  };

  const LearningBottleneckService = {
    detect(inputScores) {
      const profile = LearnerProfileService?.get?.() || {};
      const scores = inputScores || profile.skillScores || getUserProgress?.()?.skills || {};
      const available = Object.entries(scores).filter(([skill, score]) => SKILL_LABELS[skill] && Number(score) > 0).map(([skill, score]) => ({ skill, score: clamp(score) }));
      if (available.length < 2) return { ready: false, reason: copy('Cần ít nhất 2 kỹ năng có kết quả.', 'At least two scored skills are required.', '至少需要 2 项技能成绩。'), candidates: [] };
      const mean = available.reduce((sum, item) => sum + item.score, 0) / available.length;
      const dependencyWeight = { listening: 1.18, vocabulary: 1.12, grammar: 1.08, reading: 1.05, speaking: 1, writing: 1 };
      const candidates = available.map((item) => ({ ...item, gap: round(mean - item.score), impact: round((Math.max(0, mean - item.score) * 1.25 + (100 - item.score) * .28) * (dependencyWeight[item.skill] || 1)) })).sort((a, b) => b.impact - a.impact);
      const primary = candidates[0];
      return { ready: true, mean: round(mean), primary: { ...primary, label: skillLabel(primary.skill), conclusion: copy(`${skillLabel(primary.skill)} đang là điểm nghẽn lớn nhất.`, `${skillLabel(primary.skill)} is the strongest current bottleneck.`, `${skillLabel(primary.skill)} 是当前最主要的瓶颈。`) }, candidates, evidenceCount: available.length };
    }
  };

  const LearningPatternService = {
    events() {
      const practice = (PracticeService?.getHistory?.() || []).map((item) => ({ at: item.completedAt || item.createdAt, minutes: Math.max(1, round(Number(item.durationSeconds || 0) / 60)), score: clamp(item.percentage), type: Object.keys(item.skillBreakdown || {})[0] || item.skill || 'practice' }));
      const focus = (global.FocusSessionService?.all?.() || []).filter((item) => item.status === 'completed').map((item) => ({ at: item.completedAt, minutes: Math.max(1, Number(item.actualMinutes || item.targetMinutes || 0)), score: clamp((item.tasks || []).filter((task) => task.completed).length / Math.max(1, (item.tasks || []).length) * 100), type: (item.tasks || []).find((task) => task.completed)?.type || 'focus' }));
      return [...practice, ...focus].filter((item) => item.at && Number.isFinite(new Date(item.at).getTime()));
    },
    analyze(inputEvents) {
      const events = inputEvents || this.events();
      if (events.length < 2) return { ready: false, eventCount: events.length, reason: copy('Hoàn thành ít nhất 2 phiên để nhận diện xu hướng.', 'Complete at least two sessions to identify a pattern.', '完成至少 2 次学习以识别模式。') };
      const windows = {}; const durations = {}; const types = {};
      events.forEach((event) => {
        const hour = new Date(event.at).getHours(); const windowStart = Math.floor(hour / 2) * 2;
        const duration = event.minutes <= 10 ? '5–10' : event.minutes <= 20 ? '11–20' : event.minutes <= 40 ? '21–40' : '41+';
        const add = (group, key) => { group[key] = group[key] || { weighted: 0, minutes: 0, count: 0, totalScore: 0 }; group[key].weighted += event.score * Math.min(30, event.minutes); group[key].minutes += Math.min(30, event.minutes); group[key].count += 1; group[key].totalScore += event.score; };
        add(windows, windowStart); add(durations, duration); add(types, event.type || 'practice');
      });
      const rank = (group) => Object.entries(group).map(([key, value]) => ({ key, count: value.count, averageScore: round(value.totalScore / value.count), efficiency: round(value.weighted / Math.max(1, value.minutes)) })).sort((a, b) => b.efficiency - a.efficiency || b.count - a.count);
      const bestWindow = rank(windows)[0]; const bestDuration = rank(durations)[0]; const preferredType = Object.entries(types).sort((a, b) => b[1].count - a[1].count)[0];
      const start = Number(bestWindow.key);
      return { ready: true, eventCount: events.length, bestWindow: `${String(start).padStart(2, '0')}:00–${String((start + 2) % 24).padStart(2, '0')}:00`, bestDuration: `${bestDuration.key} ${copy('phút', 'minutes', '分钟')}`, preferredType: skillLabel(preferredType[0]), averageScore: round(events.reduce((sum, item) => sum + item.score, 0) / events.length), confidence: events.length >= 10 ? 'high' : events.length >= 5 ? 'medium' : 'early', windows: rank(windows), durations: rank(durations) };
    }
  };

  const ROOT_CAUSES = Object.freeze({
    concept_gap: { vi: 'Chưa vững khái niệm', en: 'Concept gap', 'zh-CN': '概念未掌握' },
    rule_decay: { vi: 'Quên quy tắc', en: 'Rule decay', 'zh-CN': '规则遗忘' },
    context_confusion: { vi: 'Nhầm ngữ cảnh', en: 'Context confusion', 'zh-CN': '语境混淆' },
    perception_gap: { vi: 'Chưa nhận ra âm', en: 'Sound perception gap', 'zh-CN': '语音识别薄弱' }
  });
  const MistakeRootCauseService = {
    analyze(error = {}) {
      const text = `${error.type || ''} ${error.question || ''} ${error.mistake || ''} ${error.correction || ''} ${error.explanation || ''}`.toLocaleLowerCase();
      let cause = 'concept_gap'; const evidence = [];
      if (/(listening|pronunciation|nghe|phát âm|batchim|받침|âm thanh)/i.test(text)) { cause = 'perception_gap'; evidence.push(copy('Lỗi xuất hiện trong tín hiệu nghe/phát âm.', 'The mistake appears in listening or pronunciation signals.', '错误出现在听力或发音信号中。')); }
      else if (/(ngữ cảnh|context|tự nhiên|lịch sự|situation|formal|informal|존댓말|반말)/i.test(text)) { cause = 'context_confusion'; evidence.push(copy('Cấu trúc có thể đúng nhưng chưa hợp tình huống.', 'The form may be correct but mismatched to the situation.', '形式可能正确，但与情境不匹配。')); }
      else if (/(quên|forgot|không nhớ|lâu chưa|nhớ rule)/i.test(text) || (error.resolved && Number(error.count || 1) > 1)) { cause = 'rule_decay'; evidence.push(copy('Quy tắc từng được xử lý nhưng lỗi đã quay lại.', 'A previously handled rule has resurfaced.', '已处理的规则再次出错。')); }
      else evidence.push(copy('Mẫu lỗi cho thấy nền tảng khái niệm cần được củng cố.', 'The pattern suggests the underlying concept needs reinforcement.', '错误模式表明需要巩固基础概念。'));
      const count = Math.max(1, Number(error.count || 1));
      return { id: error.id, cause, label: localize(ROOT_CAUSES[cause]), confidence: count >= 4 ? 'high' : count >= 2 ? 'medium' : 'early', count, evidence, nextAction: cause === 'rule_decay' ? copy('Ôn lại rule và retest ngắn.', 'Review the rule and take a short retest.', '复习规则并进行简短复测。') : cause === 'context_confusion' ? copy('So sánh hai tình huống dùng.', 'Compare two usage situations.', '对比两个使用情境。') : cause === 'perception_gap' ? copy('Nghe chậm và luyện cặp âm.', 'Listen slowly and train a minimal pair.', '慢速听并练习最小对立。') : copy('Học lại ví dụ cơ bản trước khi làm bài.', 'Relearn a basic example before practising.', '练习前重新学习基础例句。') };
    },
    summary(errors = global.ErrorNotebookService?.top?.(50) || []) {
      const items = errors.map((error) => ({ error, ...this.analyze(error) })); const totals = {};
      items.forEach((item) => { totals[item.cause] = (totals[item.cause] || 0) + item.count; });
      const causes = Object.entries(totals).map(([cause, count]) => ({ cause, count, label: localize(ROOT_CAUSES[cause]) })).sort((a, b) => b.count - a.count);
      return { ready: items.length > 0, items, causes, primary: causes[0] || null };
    }
  };

  const KNOWLEDGE_NODES = Object.freeze([
    { id: 'topic-food', type: 'topic', label: '음식', detail: copy('Chủ đề ăn uống', 'Food topic', '饮食主题') },
    { id: 'word-eat', type: 'vocabulary', label: '먹다', detail: copy('ăn', 'to eat', '吃') },
    { id: 'form-eat', type: 'form', label: '먹어요', detail: copy('dạng 해요체', 'haeyo form', '海耀体') },
    { id: 'grammar-want', type: 'grammar', label: '먹고 싶다', detail: copy('muốn ăn', 'want to eat', '想吃') },
    { id: 'word-restaurant', type: 'vocabulary', label: '식당', detail: copy('nhà hàng', 'restaurant', '餐厅') },
    { id: 'word-order', type: 'vocabulary', label: '주문', detail: copy('gọi món', 'order', '点餐') },
    { id: 'sentence-order', type: 'sentence', label: '비빔밥을 주문해요.', detail: copy('Tôi gọi bibimbap.', 'I order bibimbap.', '我点拌饭。') }
  ]);
  const KNOWLEDGE_EDGES = Object.freeze([
    ['topic-food', 'word-eat', 'topic'], ['word-eat', 'form-eat', 'conjugates'], ['word-eat', 'grammar-want', 'grammar'], ['topic-food', 'word-restaurant', 'context'], ['word-restaurant', 'word-order', 'collocation'], ['word-order', 'sentence-order', 'sentence']
  ]);
  const KnowledgeRelationService = {
    graph(query = '먹다') {
      const normalized = String(query || '').toLocaleLowerCase(); const seed = KNOWLEDGE_NODES.find((node) => normalized.includes(node.label.toLocaleLowerCase()) || node.label.toLocaleLowerCase().includes(normalized)) || KNOWLEDGE_NODES[1];
      const ids = new Set([seed.id]); KNOWLEDGE_EDGES.forEach(([from, to]) => { if (from === seed.id || to === seed.id || seed.id === 'word-eat') { ids.add(from); ids.add(to); } });
      const localNodes = KNOWLEDGE_NODES.filter((node) => ids.has(node.id));
      const existing = global.KnowledgeGraphService?.context?.(query, 5) || [];
      const nodes = [...localNodes, ...existing.filter((node) => !localNodes.some((item) => item.label === node.label)).map((node) => ({ id: `existing-${node.id}`, type: node.type, label: node.label, detail: node.mastery == null ? '' : `Mastery ${node.mastery}%` }))];
      return { seed, nodes, edges: KNOWLEDGE_EDGES.filter(([from, to]) => nodes.some((node) => node.id === from) && nodes.some((node) => node.id === to)) };
    }, nodes: () => KNOWLEDGE_NODES, edges: () => KNOWLEDGE_EDGES
  };

  const SkillDependencyService = {
    forTarget(level = state.currentUser?.targetTopikLevel || 1, inputScores) {
      const target = Math.max(1, Math.min(6, Number(level) || 1)); const profile = LearnerProfileService?.get?.() || {}; const scores = inputScores || profile.skillScores || getUserProgress?.()?.skills || {};
      const requirements = [
        { id: 'hangul', label: copy('Nền tảng Hangul', 'Hangul foundation', '韩文基础'), skill: 'reading', threshold: 35, from: 1 },
        { id: 'topik1-grammar', label: 'TOPIK 1 grammar', skill: 'grammar', threshold: 45, from: 1 },
        { id: 'listening-foundation', label: copy('Nền tảng nghe', 'Listening foundation', '听力基础'), skill: 'listening', threshold: 50, from: 2 },
        { id: 'core-vocabulary', label: copy('Từ vựng nền tảng', 'Core vocabulary', '核心词汇'), skill: 'vocabulary', threshold: 55, from: 2 },
        { id: 'topik2-reading', label: 'TOPIK 2 reading', skill: 'reading', threshold: 60, from: 3 },
        { id: 'sentence-production', label: copy('Tạo câu', 'Sentence production', '句子输出'), skill: 'writing', threshold: 58, from: 3 },
        { id: 'advanced-comprehension', label: copy('Đọc/nghe học thuật', 'Advanced comprehension', '高级理解'), skill: 'reading', threshold: 70, from: 4 }
      ].filter((item) => item.from <= target).map((item) => ({ ...item, score: clamp(scores[item.skill] || 0), ready: Number(scores[item.skill] || 0) >= item.threshold }));
      return { target, requirements, blockers: requirements.filter((item) => !item.ready).sort((a, b) => (a.score - a.threshold) - (b.score - b.threshold)), readiness: requirements.length ? round(requirements.filter((item) => item.ready).length / requirements.length * 100) : 0 };
    }
  };

  const StudyEfficiencyService = {
    score(inputHistory, inputSessions, inputCards) {
      const history = inputHistory || PracticeService?.getHistory?.() || [];
      const sessions = inputSessions || (global.FocusSessionService?.all?.() || []).filter((item) => item.status === 'completed');
      const cards = inputCards || state.srsData || [];
      const practiceMinutes = history.reduce((sum, item) => sum + Math.max(1, Number(item.durationSeconds || 0) / 60), 0);
      const focusMinutes = sessions.reduce((sum, item) => sum + Math.max(0, Number(item.actualMinutes || 0)), 0);
      const accuracy = history.length ? history.reduce((sum, item) => sum + clamp(item.percentage), 0) / history.length : 0;
      const completion = sessions.length ? sessions.reduce((sum, item) => sum + (item.tasks || []).filter((task) => task.completed).length / Math.max(1, (item.tasks || []).length) * 100, 0) / sessions.length : (history.length ? 100 : 0);
      const reviewed = cards.filter((card) => Number(card.reviewCount || 0) > 0 || card.lastReviewed); const retention = reviewed.length ? reviewed.reduce((sum, card) => sum + MemoryRiskService.analyze(card).recallStrength, 0) / reviewed.length : accuracy;
      const raw = accuracy * .55 + retention * .3 + completion * .15;
      return { ready: history.length + sessions.length >= 2, score: round(clamp(raw)), accuracy: round(accuracy), retention: round(retention), completion: round(completion), minutes: round(practiceMinutes + focusMinutes), sampleCount: history.length + sessions.length, explanation: copy('Kết hợp kết quả, độ lưu giữ và mức hoàn thành; không chấm cao chỉ vì học lâu.', 'Combines outcomes, retention and completion; time alone does not raise the score.', '结合学习结果、保持度和完成度；仅学习时长不会提高分数。') };
    }
  };

  const LearningForecastService = {
    forecast(options = {}) {
      const minutesPerDay = Math.max(5, Math.min(180, Number(options.minutesPerDay || state.currentUser?.studyMinutesPerDay || 30)));
      const months = Math.max(1, Math.min(12, Number(options.months || 3))); const profile = LearnerProfileService?.get?.() || {}; const scores = options.skillScores || profile.skillScores || getUserProgress?.()?.skills || {};
      const measured = Object.values(scores).map(Number).filter((score) => score > 0); const measuredAverage = measured.length ? measured.reduce((sum, score) => sum + score, 0) / measured.length : 18; const coverage = Math.min(1, measured.length / 6); const baseline = measuredAverage * coverage + 18 * (1 - coverage);
      const efficiency = options.efficiency || StudyEfficiencyService.score(); const efficiencyFactor = efficiency.ready ? Math.max(.55, efficiency.score / 75) : .7;
      const projected = clamp(baseline + months * 5.2 * Math.sqrt(minutesPerDay / 30) * efficiencyFactor);
      const thresholds = [0, 30, 43, 56, 68, 79, 89]; let expectedLevel = 1;
      thresholds.slice(1).forEach((threshold, index) => { if (projected >= threshold) expectedLevel = Math.min(6, index + 1); });
      const confidence = efficiency.sampleCount >= 10 && measured.length >= 4 ? 'medium' : 'low'; const spread = confidence === 'medium' ? 7 : 13;
      const low = clamp(projected - spread); const high = clamp(projected + spread);
      const levelFor = (score) => { let value = 1; thresholds.slice(1).forEach((threshold, index) => { if (score >= threshold) value = Math.min(6, index + 1); }); return value; };
      return { minutesPerDay, months, baseline: round(baseline), projected: round(projected), expectedLevel, levelRange: [levelFor(low), levelFor(high)], scoreRange: [round(low), round(high)], confidence, assumptions: [copy(`${minutesPerDay} phút/ngày trong ${months} tháng`, `${minutesPerDay} minutes/day for ${months} months`, `每天 ${minutesPerDay} 分钟，持续 ${months} 个月`), copy('Nhịp học và hiệu quả gần đây được duy trì', 'Recent consistency and efficiency are maintained', '保持近期学习节奏与效率')], disclaimer: copy('Đây là khoảng ước tính, không đảm bảo kết quả TOPIK.', 'This is an estimated range, not a guaranteed TOPIK result.', '这是估算区间，不保证 TOPIK 结果。') };
    }
  };

  const PersonalInsightService = {
    report(options = {}) {
      const bottleneck = options.bottleneck || LearningBottleneckService.detect(); const patterns = options.patterns || LearningPatternService.analyze(); const efficiency = options.efficiency || StudyEfficiencyService.score(); const risk = options.risk || MemoryRiskService.rank(state.srsData || [], 5); const progress = getUserProgress?.() || {};
      const strongest = Object.entries((LearnerProfileService?.get?.() || {}).skillScores || progress.skills || {}).filter(([, value]) => Number(value) > 0).sort((a, b) => b[1] - a[1])[0];
      const progressReason = strongest ? copy(`Kỹ năng ${skillLabel(strongest[0])} đang dẫn đầu với ${round(strongest[1])}%.`, `${skillLabel(strongest[0])} leads at ${round(strongest[1])}%.`, `${skillLabel(strongest[0])} 以 ${round(strongest[1])}% 领先。`) : copy('Cần thêm kết quả luyện để xác định động lực tiến bộ.', 'More practice results are needed to identify what drives progress.', '需要更多练习结果来识别进步动因。');
      const slowdown = bottleneck.ready ? bottleneck.primary.conclusion : bottleneck.reason;
      const nextAction = risk[0]?.riskScore >= 67 ? copy(`Ôn lại ${risk[0].korean || copy('mục có rủi ro cao', 'the highest-risk item', '最高风险内容')} trước.`, `Review ${risk[0].korean || 'the highest-risk item'} first.`, `先复习 ${risk[0].korean || '最高风险内容'}。`) : bottleneck.ready ? copy(`Dành 10 phút cho ${skillLabel(bottleneck.primary.skill)}.`, `Spend 10 minutes on ${skillLabel(bottleneck.primary.skill)}.`, `用 10 分钟练习${skillLabel(bottleneck.primary.skill)}。`) : copy('Hoàn thành một phiên Quick Practice.', 'Complete one Quick Practice session.', '完成一次快速练习。');
      return { progressReason, slowdown, nextAction, evidence: { efficiencyReady: efficiency.ready, patternEvents: patterns.eventCount || 0, riskItems: risk.filter((item) => item.riskScore >= 67).length }, generatedBy: 'deterministic-local-rules' };
    }
  };

  function riskLabel(level) { return level === 'high' ? copy('Cao', 'High', '高') : level === 'medium' ? copy('Vừa', 'Medium', '中') : copy('Thấp', 'Low', '低'); }
  function confidenceLabel(value) { return value === 'high' ? copy('Dữ liệu tốt', 'Strong evidence', '数据充足') : value === 'medium' ? copy('Đang hình thành', 'Developing evidence', '正在形成') : copy('Dữ liệu sớm', 'Early evidence', '早期数据'); }
  function analyticsPanel() {
    const risks = MemoryRiskService.rank(state.srsData || [], 6); const highRisk = risks.filter((item) => item.riskScore >= 67);
    const bottleneck = LearningBottleneckService.detect(); const patterns = LearningPatternService.analyze(); const roots = MistakeRootCauseService.summary(); const dependency = SkillDependencyService.forTarget(); const efficiency = StudyEfficiencyService.score();
    const minutes = Number(state.learningForecastMinutes || 30); const forecast = LearningForecastService.forecast({ minutesPerDay: minutes, efficiency }); const insight = PersonalInsightService.report({ bottleneck, patterns, efficiency, risk: risks }); const graph = KnowledgeRelationService.graph('먹다');
    const metric = (label, value, detail, tone = '') => `<article class="li-metric ${tone}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></article>`;
    return `<section class="learning-intelligence section" aria-labelledby="learning-intelligence-title">
      <header class="li-heading"><div><p class="eyebrow">Learning Intelligence</p><h2 id="learning-intelligence-title">${copy('Hiểu tiến độ, không chỉ đếm điểm', 'Understand progress, not just scores', '理解进步，不只是计分')}</h2><p>${copy('Phân tích bằng quy tắc minh bạch từ SRS, mastery, lịch sử luyện và Sổ lỗi.', 'Transparent rules combine SRS, mastery, practice history and the Error Notebook.', '通过透明规则结合 SRS、掌握度、练习历史和错题本。')}</p></div><span class="li-local-badge">${copy('Xử lý trên thiết bị', 'Processed on device', '设备端处理')}</span></header>
      <div class="li-metrics">${metric(copy('Hiệu quả học', 'Learning efficiency', '学习效率'), efficiency.ready ? `${efficiency.score}/100` : '—', efficiency.ready ? `${efficiency.sampleCount} ${copy('phiên', 'sessions', '次学习')}` : copy('Cần 2 phiên', 'Need 2 sessions', '需要 2 次学习'))}${metric(copy('Điểm nghẽn', 'Bottleneck', '学习瓶颈'), bottleneck.ready ? bottleneck.primary.label : '—', bottleneck.ready ? `${bottleneck.primary.score}%` : copy('Chưa đủ dữ liệu', 'Not enough data', '数据不足'), bottleneck.ready ? 'attention' : '')}${metric(copy('Trí nhớ rủi ro cao', 'High memory risk', '高记忆风险'), String(highRisk.length), copy('mục nên ôn sớm', 'items to review soon', '项建议尽快复习'), highRisk.length ? 'attention' : '')}${metric(copy('Dự báo 3 tháng', '3-month forecast', '3 个月预测'), `TOPIK ${forecast.levelRange[0]}–${forecast.levelRange[1]}`, confidenceLabel(forecast.confidence))}</div>
      <article class="li-insight"><div><small>${copy('Báo cáo cá nhân', 'Personal insight report', '个人洞察报告')}</small><h3>${copy('Bạn tiến bộ vì…', 'You are progressing because…', '你的进步来自…')}</h3><p>${escapeHtml(insight.progressReason)}</p></div><div><h3>${copy('Bạn đang chậm ở…', 'You are slowing at…', '你目前的阻力是…')}</h3><p>${escapeHtml(insight.slowdown)}</p><b>→ ${escapeHtml(insight.nextAction)}</b></div></article>
      <div class="li-two-column">
        <article class="li-panel"><div class="li-panel-title"><div><small>Memory Risk</small><h3>${copy('Từ có nguy cơ quên', 'Knowledge at risk', '易遗忘内容')}</h3></div><span>Recall 0–100</span></div>${risks.length ? `<div class="li-risk-list">${risks.map((item) => `<div class="li-risk-row"><div><b lang="ko">${escapeHtml(item.korean || item.wordId || '—')}</b><small>${item.elapsedDays} ${copy('ngày', 'days', '天')} · ${escapeHtml(item.reasons[0])}</small></div><div class="li-recall"><span><i style="width:${item.recallStrength}%"></i></span><small>Recall ${item.recallStrength}</small></div><em class="${item.level}">${riskLabel(item.level)} ${item.riskScore}</em></div>`).join('')}</div>` : `<p class="li-empty">${copy('Chưa có thẻ SRS để phân tích.', 'No SRS cards are available for analysis.', '暂无 SRS 卡片可供分析。')}</p>`}</article>
        <article class="li-panel"><div class="li-panel-title"><div><small>Root Cause</small><h3>${copy('Vì sao lỗi lặp lại', 'Why mistakes repeat', '错误为何重复')}</h3></div><span>${roots.items?.length || 0} ${copy('mẫu', 'patterns', '个模式')}</span></div>${roots.ready ? `<div class="li-cause-list">${roots.causes.map((cause) => { const total = roots.causes.reduce((sum, item) => sum + item.count, 0); const percentage = round(cause.count / total * 100); return `<div><span><b>${escapeHtml(cause.label)}</b><small>${cause.count}×</small></span><div><i style="width:${percentage}%"></i></div></div>`; }).join('')}</div><p class="li-note">${escapeHtml(roots.items[0]?.nextAction || '')}</p>` : `<p class="li-empty">${copy('Sổ lỗi chưa có đủ tín hiệu.', 'The Error Notebook has no signals yet.', '错题本暂无可用信号。')}</p>`}</article>
      </div>
      <div class="li-two-column">
        <article class="li-panel"><div class="li-panel-title"><div><small>Learning Pattern</small><h3>${copy('Nhịp học hiệu quả', 'Effective study pattern', '高效学习模式')}</h3></div><span>${patterns.eventCount || 0} ${copy('phiên', 'sessions', '次')}</span></div>${patterns.ready ? `<dl class="li-definition"><div><dt>${copy('Khung giờ', 'Time window', '时间段')}</dt><dd>${patterns.bestWindow}</dd></div><div><dt>${copy('Thời lượng', 'Duration', '时长')}</dt><dd>${patterns.bestDuration}</dd></div><div><dt>${copy('Hoạt động', 'Activity', '活动')}</dt><dd>${escapeHtml(patterns.preferredType)}</dd></div></dl><p class="li-note">${confidenceLabel(patterns.confidence)} · ${copy('cập nhật theo kết quả mới', 'updates with new results', '随新结果更新')}</p>` : `<p class="li-empty">${escapeHtml(patterns.reason)}</p>`}</article>
        <article class="li-panel"><div class="li-panel-title"><div><small>Forecast</small><h3>${copy('Nếu duy trì nhịp học', 'If you maintain this pace', '如果保持当前节奏')}</h3></div></div><div class="li-forecast-controls" role="group" aria-label="${copy('Phút học mỗi ngày', 'Study minutes per day', '每日学习分钟')}">${[15,30,60].map((value) => `<button class="${minutes === value ? 'active' : ''}" data-forecast-minutes="${value}">${value}′/${copy('ngày', 'day', '天')}</button>`).join('')}</div><div class="li-forecast-result"><strong>TOPIK ${forecast.levelRange[0]}–${forecast.levelRange[1]}</strong><span>${forecast.scoreRange[0]}–${forecast.scoreRange[1]} ${copy('điểm năng lực ước tính', 'estimated skill score', '估算能力分')}</span></div><p class="li-note">${escapeHtml(forecast.disclaimer)}</p></article>
      </div>
      <article class="li-panel li-dependencies"><div class="li-panel-title"><div><small>Skill Dependency Graph</small><h3>${copy(`Nền tảng cho TOPIK ${dependency.target}`, `Foundations for TOPIK ${dependency.target}`, `TOPIK ${dependency.target} 的基础`)}</h3></div><span>${dependency.readiness}% ready</span></div><div class="li-dependency-track">${dependency.requirements.map((item, index) => `<div class="${item.ready ? 'ready' : 'blocked'}"><span>${item.ready ? '✓' : index + 1}</span><b>${escapeHtml(item.label)}</b><small>${item.score}/${item.threshold}</small></div>`).join('')}</div>${dependency.blockers[0] ? `<p class="li-note">→ ${copy('Ưu tiên trước', 'Prioritize first', '优先项')}: <b>${escapeHtml(dependency.blockers[0].label)}</b></p>` : ''}</article>
      <article class="li-panel li-knowledge"><div class="li-panel-title"><div><small>Knowledge Graph</small><h3>${copy('Từ → ngữ pháp → câu → chủ đề', 'Word → grammar → sentence → topic', '单词 → 语法 → 句子 → 主题')}</h3></div></div><div class="li-knowledge-lanes">${['topic','vocabulary','form','grammar','sentence'].map((type) => `<div><small>${type}</small>${graph.nodes.filter((node) => node.type === type).map((node) => `<span><b lang="ko">${escapeHtml(node.label)}</b><em>${escapeHtml(node.detail || '')}</em></span>`).join('') || '<i>—</i>'}</div>`).join('<b class="li-arrow">→</b>')}</div><p class="li-note">${copy('Graph dùng quan hệ từ vựng, biến đổi, collocation và ngữ cảnh; có thể mở rộng từ KnowledgeGraph hiện tại.', 'The graph connects vocabulary, forms, collocations and context, and extends the existing KnowledgeGraph.', '该图连接词汇、变形、搭配和语境，并扩展现有 KnowledgeGraph。')}</p></article>
      <footer class="li-method"><b>${copy('Cách tính', 'Method', '计算方法')}</b><span>${escapeHtml(efficiency.explanation)}</span><span>${copy('Không dùng chat history, password, token hay audio.', 'No chat history, password, token or audio is used.', '不使用聊天记录、密码、令牌或音频。')}</span></footer>
    </section>`;
  }

  const services = { MemoryRiskService, RecallStrengthService: { score: (card, referenceTime) => MemoryRiskService.analyze(card, referenceTime).recallStrength }, LearningBottleneckService, LearningPatternService, MistakeRootCauseService, KnowledgeRelationService, SkillDependencyService, LearningForecastService, StudyEfficiencyService, PersonalInsightService };
  Object.assign(global, services);
  global.LearningAnalyticsEngine = { ...services, analyze() { const efficiency = StudyEfficiencyService.score(); return { risks: MemoryRiskService.rank(), bottleneck: LearningBottleneckService.detect(), patterns: LearningPatternService.analyze(), rootCauses: MistakeRootCauseService.summary(), dependency: SkillDependencyService.forTarget(), efficiency, forecast: LearningForecastService.forecast({ efficiency }), report: PersonalInsightService.report({ efficiency }) }; } };

  if (global.SmartReviewService && !global.SmartReviewService.__learningAnalyticsEnhanced) {
    const originalPlan = global.SmartReviewService.plan.bind(global.SmartReviewService);
    global.SmartReviewService.forgettingPrediction = (card) => MemoryRiskService.analyze(card).riskScore / 100;
    global.SmartReviewService.recallStrength = (card) => MemoryRiskService.analyze(card).recallStrength;
    global.SmartReviewService.memoryRisk = (card) => MemoryRiskService.analyze(card);
    global.SmartReviewService.plan = function enhancedPlan(minutes) { const plan = originalPlan(minutes); return { ...plan, atRisk: (plan.atRisk || []).map((item) => { const card = (state.srsData || []).find((entry) => (entry.wordId || entry.id) === item.wordId); return card ? { ...item, ...MemoryRiskService.analyze(card) } : item; }) }; };
    global.SmartReviewService.__learningAnalyticsEnhanced = true;
  }

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser || state.currentView !== 'analytics' || global.document?.querySelector?.('.learning-intelligence')) return;
    global.document?.getElementById?.('app')?.insertAdjacentHTML('beforeend', analyticsPanel());
    global.document?.querySelectorAll?.('[data-forecast-minutes]')?.forEach((button) => { button.onclick = () => { state.learningForecastMinutes = Number(button.dataset.forecastMinutes) || 30; render(); }; });
  };
  render();
})(window);
