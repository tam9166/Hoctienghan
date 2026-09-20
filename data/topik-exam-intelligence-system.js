/* P80 — TOPIK exam intelligence on the existing exam, practice, error and adaptive stores. */
(function topikExamIntelligenceSystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, storage, escapeHtml = String, render, setView, toast, getUserProgress, saveUserProgress, emitLearningMutation, speakKorean } = app;
  const runtime = state.p80Topik || (state.p80Topik = { config: null, loading: null, bankLevel: 'TOPIK I', bankSection: 'all', bankType: 'all', session: null, result: null, generator: { level: 'TOPIK I', weakSkill: 'mixed', goal: 'balanced' }, report: null, aiReport: '', aiBusy: false, timer: null });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || 'guest';
  const clean = (value, max = 2000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const normalized = (value) => clean(value, 3000).toLocaleLowerCase('ko-KR').replace(/[\s.,!?;:'"“”‘’()[\]{}\-]/g, '');
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;
  const titleCase = (value) => String(value || '').replace(/-/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
  const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};

  const P80TopikConfigService = {
    hydrate(value) {
      const types = new Set(value?.questionTypes || []); const ids = new Set();
      const valid = Number(value?.schemaVersion) === 1 && value?.contentPolicy?.sourceType === 'ORIGINAL_CREATED_CONTENT' && value?.difficultyPlan?.total === 20 && Array.isArray(value?.mockTests) && value.mockTests.length === 2 && Array.isArray(value?.sectionGroups) && value.sectionGroups.length === 16 && Array.isArray(value?.questions) && value.questions.length >= 44 && value.questions.every((question) => {
        const required = question.id && Number(question.year) && question.exam && question.level && question.section && Number(question.questionNumber) && question.skill && question.difficulty && question.answer && question.explanation && types.has(question.questionType) && !ids.has(question.id);
        ids.add(question.id); return Boolean(required);
      });
      if (!valid || !['TOPIK I', 'TOPIK II'].every((level) => ['easy', 'medium', 'hard'].every((difficulty) => value.questions.filter((item) => item.level === level && item.section !== 'writing' && item.difficulty === difficulty).length >= ({ easy: 5, medium: 10, hard: 5 })[difficulty]))) throw new Error('P80 TOPIK content contract failed');
      runtime.config = clone(value); return this.get();
    },
    get() { return runtime.config ? clone(runtime.config) : null; },
    async load() {
      if (runtime.config) return this.get();
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/topik-exam-intelligence-system.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P80 content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch(() => null).finally(() => { runtime.loading = null; if (String(state.currentView).includes('p80')) render(); });
      return runtime.loading;
    }
  };

  const P80TopikQuestionBankService = {
    all(filters = {}) {
      return (runtime.config?.questions || []).filter((question) => !filters.level || question.level === filters.level).filter((question) => !filters.section || filters.section === 'all' || question.section === filters.section).filter((question) => !filters.questionType || filters.questionType === 'all' || question.questionType === filters.questionType).filter((question) => !filters.difficulty || question.difficulty === filters.difficulty).filter((question) => !filters.group || question.group === filters.group).map(clone);
    },
    get(id) { const item = (runtime.config?.questions || []).find((question) => question.id === id); return item ? clone(item) : null; },
    groups(level, section) { return (runtime.config?.sectionGroups || []).filter((group) => group.level === level && group.section === section).map((group) => ({ ...clone(group), questionCount: this.all({ level, section, group: group.group }).length })); },
    types() { return clone(runtime.config?.questionTypes || []); },
    coverage() {
      const questions = this.all(); return { total: questions.length, topikI: questions.filter((item) => item.level === 'TOPIK I').length, topikII: questions.filter((item) => item.level === 'TOPIK II').length, listening: questions.filter((item) => item.section === 'listening').length, reading: questions.filter((item) => item.section === 'reading').length, writing: questions.filter((item) => item.section === 'writing').length };
    }
  };

  function writingGrade(question, answer) {
    const value = clean(answer, 3000); if (!value) return { score: 0, correct: false, details: { length: 0, keywords: 0 } };
    const lengthRatio = Math.min(1, value.length / Math.max(1, Number(question.minChars || 20))); const keywords = question.keywords || []; const keywordHits = keywords.filter((keyword) => normalized(value).includes(normalized(keyword))).length; const keywordRatio = keywords.length ? keywordHits / keywords.length : normalized(value).includes(normalized(question.answer)) ? 1 : 0;
    const score = Math.round(lengthRatio * 45 + keywordRatio * 55); return { score, correct: score >= 60, details: { length: value.length, minimumLength: question.minChars || 20, keywords: keywordHits, keywordTotal: keywords.length } };
  }
  function gradeQuestion(question, answer) {
    if (question.section === 'writing') return writingGrade(question, answer);
    const correct = normalized(answer) === normalized(question.answer); return { score: correct ? 100 : 0, correct };
  }
  function groupScores(answers, questions, property) {
    const groups = {};
    answers.forEach((answer) => { const question = questions.find((item) => item.id === answer.questionId); const key = question?.[property] || 'mixed'; groups[key] = groups[key] || []; groups[key].push(answer.score); });
    return Object.fromEntries(Object.entries(groups).map(([key, scores]) => [key, average(scores)]));
  }

  const P80ResultAnalysisService = {
    analyze(result, questions) {
      const skillScores = result.skillBreakdown || groupScores(result.answers || [], questions, 'skill'); const typeScores = result.questionTypeBreakdown || groupScores(result.answers || [], questions, 'questionType');
      const weaknesses = [...Object.entries({ ...skillScores, ...Object.fromEntries(Object.entries(typeScores).map(([key, value]) => [`type:${key}`, value])) })].filter(([, score]) => score < 75).sort((a, b) => a[1] - b[1]).slice(0, 5).map(([area, score]) => ({ area: area.replace('type:', ''), score, kind: area.startsWith('type:') ? 'question-type' : 'skill' }));
      const errors = { vocabulary: 0, grammar: 0, strategy: 0, 'careless-mistake': 0 };
      (result.answers || []).filter((answer) => !answer.correct).forEach((answer) => { const question = questions.find((item) => item.id === answer.questionId); const raw = !answer.selectedAnswer ? 'careless' : question?.errorCategory || 'strategy'; const category = raw === 'careless' ? 'careless-mistake' : raw; errors[category] = Number(errors[category] || 0) + 1; });
      return { score: result.percentage, scaledScore: result.scaledScore, skillScores, questionTypeScores: typeScores, weaknesses, errorTypes: errors, strongest: [...Object.entries(skillScores)].sort((a, b) => b[1] - a[1])[0]?.[0] || '—', weakest: weaknesses[0]?.area || '—' };
    }
  };

  const P80ErrorNotebookBridgeService = {
    sync(result, questions) {
      let added = 0;
      (result.answers || []).filter((answer) => !answer.correct).forEach((answer) => {
        const question = questions.find((item) => item.id === answer.questionId); if (!question) return;
        const raw = !answer.selectedAnswer ? 'careless' : question.errorCategory || 'strategy'; const category = raw === 'careless' ? 'careless-mistake' : raw;
        const record = global.ErrorNotebookService?.add?.({ type: `topik-${category}`, question: question.prompt, mistake: answer.selectedAnswer || 'Bỏ trống', correction: question.section === 'writing' ? question.modelAnswer || question.answer : question.answer, explanation: `${question.explanation} Chiến lược: ${question.strategy || 'Ôn lại dạng câu này.'}` });
        if (record) added += 1;
      });
      return added;
    }
  };

  function readAttempts() {
    const all = safeObject(storage.get(STORAGE_KEYS.examAttempts, {})); return Array.isArray(all?.[uid()]?.history) ? all[uid()].history : [];
  }
  function saveAttempt(result) {
    const examAll = safeObject(storage.get(STORAGE_KEYS.examAttempts, {})); const examUser = safeObject(examAll[uid()]); const history = Array.isArray(examUser.history) ? examUser.history : [];
    storage.set(STORAGE_KEYS.examAttempts, { ...examAll, [uid()]: { ...examUser, activeP80: null, history: [result, ...history.filter((item) => item.id !== result.id)].slice(0, 50), updatedAt: now() } });
    const practiceAll = safeObject(storage.get(STORAGE_KEYS.practiceHistory, {})); const practiceHistory = Array.isArray(practiceAll[uid()]) ? practiceAll[uid()] : [];
    storage.set(STORAGE_KEYS.practiceHistory, { ...practiceAll, [uid()]: [result, ...practiceHistory.filter((item) => item.id !== result.id)].slice(0, 200) });
    app.CloudSyncService?.schedule?.('p80-topik-result');
  }
  function persistActive() {
    if (!runtime.session || uid() === 'guest') return;
    const all = safeObject(storage.get(STORAGE_KEYS.examAttempts, {})); const user = safeObject(all[uid()]); storage.set(STORAGE_KEYS.examAttempts, { ...all, [uid()]: { ...user, activeP80: clone(runtime.session), updatedAt: now() } }); app.CloudSyncService?.schedule?.('p80-topik-progress');
  }

  const P80TopikExamService = {
    start(input = {}) {
      const questions = (input.questions || []).map((item) => typeof item === 'string' ? P80TopikQuestionBankService.get(item) : clone(item)).filter(Boolean); if (!questions.length) throw new Error('Chưa có câu hỏi phù hợp.');
      const level = input.level || questions[0].level; const durationMinutes = Math.max(1, Number(input.durationMinutes || Math.max(10, questions.length * (questions.some((item) => item.section === 'writing') ? 4 : 1.5))));
      runtime.result = null; runtime.report = null; runtime.aiReport = ''; runtime.session = { id: `p80-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, source: 'p80-topik-intelligence', mode: input.mode || 'practice', title: input.title || `${level} Practice`, level, questions, answers: {}, index: 0, startedAt: now(), deadlineAt: new Date(Date.now() + durationMinutes * 60000).toISOString(), durationMinutes };
      persistActive(); setView('topik-exam-p80'); return clone(runtime.session);
    },
    startMock(mockId) { const spec = runtime.config?.mockTests?.find((item) => item.id === mockId); if (!spec) throw new Error('Không tìm thấy đề thi.'); return this.start({ level: spec.level, title: spec.title, durationMinutes: spec.durationMinutes, mode: 'mock', questions: P80TopikQuestionBankService.all({ level: spec.level }) }); },
    answer(questionId, value) { if (!runtime.session || !runtime.session.questions.some((item) => item.id === questionId)) return false; runtime.session.answers[questionId] = clean(value, 3000); persistActive(); return true; },
    navigate(index) { if (!runtime.session) return; runtime.session.index = Math.max(0, Math.min(runtime.session.questions.length - 1, Number(index) || 0)); persistActive(); },
    remainingSeconds() { return runtime.session ? Math.max(0, Math.ceil((new Date(runtime.session.deadlineAt).getTime() - Date.now()) / 1000)) : 0; },
    finish(reason = 'submitted') {
      const session = runtime.session; if (!session) return null;
      const answers = session.questions.map((question) => { const selectedAnswer = clean(session.answers[question.id] || '', 3000); const grade = gradeQuestion(question, selectedAnswer); return { questionId: question.id, selectedAnswer, correct: grade.correct, score: grade.score, details: grade.details || null }; });
      const percentage = average(answers.map((item) => item.score)); const maxScore = session.level === 'TOPIK I' ? 200 : 300; const scaledScore = Math.round(percentage * maxScore / 100); const skillBreakdown = groupScores(answers, session.questions, 'skill'); const questionTypeBreakdown = groupScores(answers, session.questions, 'questionType');
      const result = { id: session.id, userId: uid(), source: 'p80-topik-intelligence', setId: session.mode === 'mock' ? `p80-mock-${session.level.replace(/\s/g, '-').toLowerCase()}` : `p80-${session.mode}`, setTitle: session.title, level: session.level, mode: session.mode, startedAt: session.startedAt, completedAt: now(), durationSeconds: Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)), finishReason: reason, score: Math.round(answers.reduce((sum, item) => sum + item.score, 0) / 100), total: answers.length, percentage, scaledScore, maxScore, correct: answers.filter((item) => item.correct).length, wrong: answers.filter((item) => !item.correct).length, skipped: answers.filter((item) => !item.selectedAnswer).length, answers, wrongQuestionIds: answers.filter((item) => !item.correct).map((item) => item.questionId), skillBreakdown, questionTypeBreakdown, examMode: session.mode === 'mock', estimatedWritingScore: session.questions.some((item) => item.section === 'writing'), contentVersion: runtime.config?.schemaVersion || 1 };
      result.analysis = P80ResultAnalysisService.analyze(result, session.questions); saveAttempt(result); P80ErrorNotebookBridgeService.sync(result, session.questions);
      Object.entries(skillBreakdown).forEach(([skill, score]) => global.AdaptiveDifficultyService?.record?.(skill, score >= 70));
      const progress = getUserProgress?.(); if (progress) { progress.daily = progress.daily || { tasks: {} }; progress.daily.tasks = { ...(progress.daily.tasks || {}), practice: true }; if (skillBreakdown.listening != null) progress.daily.tasks.listening = true; progress.skills = { ...(progress.skills || {}), ...Object.fromEntries(Object.entries(skillBreakdown).map(([skill, score]) => [skill, Math.max(Number(progress.skills?.[skill] || 0), score)])) }; saveUserProgress?.(progress); }
      emitLearningMutation?.('topik_completed', result.id, { source: 'p80', level: session.level, mode: session.mode, score: percentage, scaledScore }, `p80:${uid()}:${result.id}`);
      runtime.result = result; runtime.session = null; runtime.report = P80TopikReportService.diagnose(session.level === 'TOPIK I' ? 2 : 4, result); setView('topik-result-p80'); return clone(result);
    },
    resume() { const stored = safeObject(storage.get(STORAGE_KEYS.examAttempts, {}))?.[uid()]?.activeP80; if (!stored?.questions?.length) return null; runtime.session = clone(stored); setView('topik-exam-p80'); return clone(runtime.session); },
    active() { return runtime.session ? clone(runtime.session) : null; }
  };

  const P80SectionPracticeService = {
    groups(level, section) { return P80TopikQuestionBankService.groups(level, section); },
    start(groupId) { const group = runtime.config?.sectionGroups?.find((item) => item.id === groupId); if (!group) throw new Error('Không tìm thấy nhóm câu.'); const questions = P80TopikQuestionBankService.all({ level: group.level, section: group.section, group: group.group }); return P80TopikExamService.start({ level: group.level, title: `${group.level} · ${group.section} · ${group.label}`, mode: 'section', questions }); }
  };

  const P80QuestionTypeTrainingService = {
    types() { return P80TopikQuestionBankService.types().map((id) => ({ id, label: titleCase(id), count: P80TopikQuestionBankService.all({ questionType: id }).length })); },
    start(questionType, level = runtime.bankLevel) { const questions = P80TopikQuestionBankService.all({ level, questionType }); return P80TopikExamService.start({ level, title: `${level} · ${titleCase(questionType)}`, mode: 'question-type', questions }); }
  };

  const P80SmartTestGeneratorService = {
    generate(input = {}) {
      const level = input.level || 'TOPIK I'; const weakSkill = input.weakSkill || 'mixed'; const goal = input.goal || 'balanced'; const plan = runtime.config?.difficultyPlan || { easy: 5, medium: 10, hard: 5 };
      const selected = [];
      ['easy', 'medium', 'hard'].forEach((difficulty) => {
        const pool = P80TopikQuestionBankService.all({ level, difficulty }).filter((item) => item.section !== 'writing').sort((a, b) => {
          const aPriority = Number(a.skill === weakSkill || a.questionType === weakSkill) + Number(goal !== 'balanced' && (a.skill === goal || a.questionType === goal)); const bPriority = Number(b.skill === weakSkill || b.questionType === weakSkill) + Number(goal !== 'balanced' && (b.skill === goal || b.questionType === goal)); return bPriority - aPriority || a.id.localeCompare(b.id);
        });
        selected.push(...pool.slice(0, Number(plan[difficulty] || 0)));
      });
      if (selected.length !== Number(plan.total || 20)) throw new Error('Kho câu hỏi chưa đủ cấu trúc 5 dễ · 10 trung bình · 5 khó.');
      return { id: `p80-smart-${Date.now()}`, level, weakSkill, goal, title: `Smart Test · ${level}`, distribution: Object.fromEntries(['easy', 'medium', 'hard'].map((difficulty) => [difficulty, selected.filter((item) => item.difficulty === difficulty).length])), questions: selected.map(clone) };
    },
    start(input = {}) { const test = this.generate(input); return P80TopikExamService.start({ level: test.level, title: test.title, mode: 'smart', questions: test.questions }); }
  };

  const READINESS = { 'TOPIK I': [[140, 2], [80, 1]], 'TOPIK II': [[230, 6], [190, 5], [150, 4], [120, 3]] };
  const P80ScorePredictionService = {
    predict(level = 'TOPIK II') {
      const attempts = readAttempts().filter((item) => item.source === 'p80-topik-intelligence' && item.level === level).slice(0, 8); if (!attempts.length) return { level, attempts: 0, predictedScore: 0, maxScore: level === 'TOPIK I' ? 200 : 300, readinessLevel: 0, trend: 'insufficient-data', confidence: 'low' };
      const weights = attempts.map((_, index) => attempts.length - index); const weightedPercent = Math.round(attempts.reduce((sum, item, index) => sum + Number(item.percentage || 0) * weights[index], 0) / weights.reduce((sum, value) => sum + value, 0)); const maxScore = level === 'TOPIK I' ? 200 : 300; const predictedScore = Math.round(weightedPercent * maxScore / 100); const chronological = attempts.slice().reverse(); const trendDelta = chronological.length > 1 ? Number(chronological.at(-1).percentage || 0) - Number(chronological[0].percentage || 0) : 0; const readinessLevel = (READINESS[level] || []).find(([threshold]) => predictedScore >= threshold)?.[1] || 0;
      return { level, attempts: attempts.length, predictedScore, maxScore, readinessLevel, weightedPercent, trend: trendDelta > 4 ? 'improving' : trendDelta < -4 ? 'declining' : 'stable', trendDelta, confidence: attempts.length >= 5 ? 'high' : attempts.length >= 3 ? 'medium' : 'low', disclaimer: runtime.config?.contentPolicy?.scoringNotice };
    }
  };

  const P80TopikReportService = {
    diagnose(targetLevel = 4, result = runtime.result) {
      const level = result?.level || (Number(targetLevel) <= 2 ? 'TOPIK I' : 'TOPIK II'); const prediction = P80ScorePredictionService.predict(level); const analysis = result?.analysis || (result ? P80ResultAnalysisService.analyze(result, P80TopikQuestionBankService.all({ level })) : { weaknesses: [], skillScores: {}, errorTypes: {} }); const priorities = (analysis.weaknesses || []).slice(0, 3).map((item) => `${titleCase(item.area)} (${item.score}%)`); const dominantError = Object.entries(analysis.errorTypes || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'chưa đủ dữ liệu';
      return { targetLevel: Number(targetLevel), level, generatedAt: now(), evidence: { latestScore: result?.percentage ?? null, latestScaledScore: result?.scaledScore ?? null, attempts: prediction.attempts, trend: prediction.trend }, diagnosis: priorities.length ? `Để tiến tới TOPIK ${targetLevel}, ưu tiên ${priorities.join(', ')}.` : 'Cần hoàn thành ít nhất một bài để tạo chẩn đoán.', priorities, dominantError, actions: priorities.length ? priorities.map((item, index) => `${index + 1}. Luyện ${item} theo nhóm câu, xem giải thích rồi làm lại sau 24 giờ.`) : ['1. Làm một Smart Test 20 câu để tạo đường cơ sở.'], prediction, disclaimer: runtime.config?.contentPolicy?.scoringNotice };
    },
    async generateAI(targetLevel = 4) {
      const report = this.diagnose(targetLevel); runtime.report = report; if (!global.AICoachService?.request) return { ...report, ai: null, fallback: true };
      const prompt = `Dựa duy nhất vào dữ liệu có cấu trúc sau, viết chẩn đoán TOPIK ngắn bằng tiếng Việt: ${JSON.stringify(report)}. Nêu bằng chứng, 3 ưu tiên và kế hoạch 7 ngày. Không bịa điểm, không gọi đây là kết quả TOPIK chính thức.`;
      try { const ai = await global.AICoachService.request(prompt, 'topik_diagnosis'); runtime.aiReport = clean(ai, 8000); return { ...report, ai: runtime.aiReport, fallback: false }; } catch (_) { runtime.aiReport = ''; return { ...report, ai: null, fallback: true }; }
    }
  };

  function loading() { P80TopikConfigService.load(); return '<section class="section page-heading"><h1>Đang tải TOPIK Intelligence…</h1></section>'; }
  function header(title, subtitle, back = 'topik-intelligence-p80') { return `<section class="section p80-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">P80 · TOPIK EXAM INTELLIGENCE</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></section>`; }
  function notice() { return `<p class="p80-notice">ⓘ ${escapeHtml(runtime.config?.contentPolicy?.notice || '')} ${escapeHtml(runtime.config?.contentPolicy?.scoringNotice || '')}</p>`; }
  function hubView() {
    if (!runtime.config) return loading(); const coverage = P80TopikQuestionBankService.coverage(); const ti = P80ScorePredictionService.predict('TOPIK I'); const tii = P80ScorePredictionService.predict('TOPIK II');
    return `<div class="p80-shell">${header('TOPIK Exam Intelligence', 'Làm đề → phân tích lỗi → luyện đúng điểm yếu → đo lại.','topik')}<section class="section p80-hero"><div><span class="p80-pill">QUESTION BANK ${coverage.total}</span><h2>Không chỉ làm đề.</h2><p>Mỗi kết quả đi thẳng vào phân tích kỹ năng, dạng câu, Error Notebook và score prediction.</p></div><div class="p80-cycle"><span>Làm đề</span><i>→</i><span>Phân tích</span><i>→</i><span>Cải thiện</span></div></section><section class="section p80-stats"><article><b>${coverage.listening}</b><span>Listening</span></article><article><b>${coverage.reading}</b><span>Reading</span></article><article><b>${coverage.writing}</b><span>Writing</span></article><article><b>${coverage.total}</b><span>Original questions</span></article></section><section class="section p80-grid">${(runtime.config.mockTests || []).map((mock) => `<article class="p80-card"><small>REAL EXAM MODE · ${mock.durationMinutes} PHÚT</small><h2>${escapeHtml(mock.title)}</h2><p>${mock.questionCount} câu trong kho P80 · timer · auto scoring · result analysis</p><button class="btn primary" data-p80-mock="${mock.id}">Bắt đầu Full Test</button></article>`).join('')}<article class="p80-card accent"><small>SMART GENERATOR</small><h2>5 dễ · 10 vừa · 5 khó</h2><p>Ưu tiên level, weak skill và goal của bạn.</p><button class="btn primary" data-view="topik-generator-p80">Tạo đề 20 câu</button></article><article class="p80-card"><small>SCORE PREDICTION</small><h2>TOPIK I: ${ti.attempts ? `${ti.predictedScore}/${ti.maxScore}` : 'Chưa đủ dữ liệu'}</h2><p>TOPIK II: ${tii.attempts ? `${tii.predictedScore}/${tii.maxScore} · readiness ${tii.readinessLevel || '—'}` : 'Chưa đủ dữ liệu'}</p><button class="btn secondary" data-view="topik-report-p80">Mở AI TOPIK Report</button></article></section><section class="section p80-actions"><button class="btn secondary" data-view="topik-bank-p80">Kho câu hỏi</button><button class="btn secondary" data-view="topik-section-p80">Luyện theo phần</button><button class="btn secondary" data-view="topik-types-p80">Luyện theo dạng</button><button class="btn secondary" data-view="error-notebook">Sổ lỗi</button></section>${notice()}</div>`;
  }
  function bankView() {
    if (!runtime.config) return loading(); const questions = P80TopikQuestionBankService.all({ level: runtime.bankLevel, section: runtime.bankSection, questionType: runtime.bankType });
    return `<div class="p80-shell">${header('TOPIK Question Bank', 'Lọc theo cấp, phần thi và dạng câu.')}<section class="section p80-filters"><select data-p80-filter="level"><option ${runtime.bankLevel === 'TOPIK I' ? 'selected' : ''}>TOPIK I</option><option ${runtime.bankLevel === 'TOPIK II' ? 'selected' : ''}>TOPIK II</option></select><select data-p80-filter="section"><option value="all">Tất cả phần</option>${['listening','reading','writing'].map((value) => `<option value="${value}" ${runtime.bankSection === value ? 'selected' : ''}>${titleCase(value)}</option>`).join('')}</select><select data-p80-filter="type"><option value="all">Tất cả dạng</option>${P80TopikQuestionBankService.types().map((value) => `<option value="${value}" ${runtime.bankType === value ? 'selected' : ''}>${titleCase(value)}</option>`).join('')}</select></section><section class="section p80-question-list">${questions.map((question) => `<article><div><small>${question.year} · ${escapeHtml(question.exam)} · ${titleCase(question.section)} · Câu ${question.questionNumber}</small><h2>${escapeHtml(question.prompt)}</h2><p>${titleCase(question.questionType)} · ${titleCase(question.difficulty)} · ${titleCase(question.skill)}</p></div><span class="p80-difficulty ${question.difficulty}">${question.difficulty}</span></article>`).join('') || '<p>Không có câu hỏi phù hợp.</p>'}</section>${notice()}</div>`;
  }
  function sectionView() {
    if (!runtime.config) return loading(); const blocks = [['TOPIK I','listening'],['TOPIK I','reading'],['TOPIK II','listening'],['TOPIK II','reading'],['TOPIK II','writing']];
    return `<div class="p80-shell">${header('Section Practice', 'Luyện riêng đúng nhóm câu cần cải thiện.')}<section class="section p80-section-groups">${blocks.map(([level, section]) => `<article><small>${level}</small><h2>${titleCase(section)}</h2><div>${P80SectionPracticeService.groups(level, section).map((group) => `<button data-p80-section="${group.id}"><b>${escapeHtml(group.label)}</b><span>${group.questionCount} câu</span></button>`).join('')}</div></article>`).join('')}</section></div>`;
  }
  function typesView() {
    if (!runtime.config) return loading(); return `<div class="p80-shell">${header('Question Type Training', 'Main idea · Detail · Inference · Vocabulary · Grammar · Chart · Conversation.')}<section class="section p80-level-switch"><button class="${runtime.bankLevel === 'TOPIK I' ? 'active' : ''}" data-p80-level="TOPIK I">TOPIK I</button><button class="${runtime.bankLevel === 'TOPIK II' ? 'active' : ''}" data-p80-level="TOPIK II">TOPIK II</button></section><section class="section p80-type-grid">${P80QuestionTypeTrainingService.types().map((type) => `<button data-p80-type="${type.id}"><span>${type.id === 'chart' ? '▥' : type.id === 'conversation' ? '◌' : '◆'}</span><b>${escapeHtml(type.label)}</b><small>${P80TopikQuestionBankService.all({ level: runtime.bankLevel, questionType: type.id }).length} câu ở ${runtime.bankLevel}</small></button>`).join('')}</section></div>`;
  }
  function generatorView() {
    if (!runtime.config) return loading(); return `<div class="p80-shell">${header('Smart Test Generator', 'Tạo đúng 20 câu với phân bố độ khó cố định.')}<form class="section p80-generator" data-p80-generator><label>Level<select name="level"><option>TOPIK I</option><option ${runtime.generator.level === 'TOPIK II' ? 'selected' : ''}>TOPIK II</option></select></label><label>Weak skill<select name="weakSkill"><option value="mixed">Tổng hợp</option><option value="listening">Listening</option><option value="reading">Reading</option>${P80TopikQuestionBankService.types().map((type) => `<option value="${type}">${titleCase(type)}</option>`).join('')}</select></label><label>Goal<select name="goal"><option value="balanced">Cân bằng</option><option value="listening">Tăng Listening</option><option value="reading">Tăng Reading</option><option value="inference">Inference</option><option value="vocabulary">Academic vocabulary</option></select></label><div class="p80-distribution"><span><b>5</b>Dễ</span><span><b>10</b>Trung bình</span><span><b>5</b>Khó</span></div><button class="btn primary" type="submit">Tạo và bắt đầu đề</button></form>${notice()}</div>`;
  }
  function examView() {
    const session = runtime.session; if (!session?.questions?.length) return `<div class="p80-shell">${header('Exam Mode', 'Không có phiên thi đang hoạt động.')}<section class="empty-state"><button class="btn primary" data-view="topik-intelligence-p80">Chọn đề thi</button></section></div>`;
    const question = session.questions[session.index]; const answer = session.answers[question.id] || ''; const remaining = P80TopikExamService.remainingSeconds();
    return `<div class="p80-shell p80-exam"><section class="section p80-exam-head"><div><small>${escapeHtml(session.title)} · ${titleCase(question.section)}</small><h1>Câu ${session.index + 1}/${session.questions.length}</h1></div><div id="p80ExamTimer" data-deadline="${escapeHtml(session.deadlineAt)}">${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}</div></section><section class="section p80-exam-card"><span class="p80-difficulty ${question.difficulty}">${question.difficulty} · ${titleCase(question.questionType)}</span><h2>${escapeHtml(question.prompt)}</h2>${question.audioText ? `<button class="p80-audio" data-p80-audio="${escapeHtml(question.audioText)}">🔊 Nghe câu hỏi</button>` : ''}${question.section === 'writing' ? `<textarea id="p80WritingAnswer" rows="10" maxlength="3000" placeholder="Viết câu trả lời bằng tiếng Hàn…">${escapeHtml(answer)}</textarea><small>Chấm luyện tập theo độ dài và từ khóa; không phải điểm viết chính thức.</small>` : `<div class="p80-options">${(question.options || []).map((option, index) => `<button class="${answer === option ? 'selected' : ''}" data-p80-answer="${escapeHtml(option)}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div>`}</section><nav class="section p80-exam-nav">${session.questions.map((item, index) => `<button class="${index === session.index ? 'current' : ''} ${session.answers[item.id] ? 'answered' : ''}" data-p80-index="${index}">${index + 1}</button>`).join('')}</nav><section class="section p80-exam-actions"><button class="btn secondary" data-p80-index="${Math.max(0, session.index - 1)}" ${session.index === 0 ? 'disabled' : ''}>← Trước</button><button class="btn secondary" data-p80-index="${Math.min(session.questions.length - 1, session.index + 1)}" ${session.index === session.questions.length - 1 ? 'disabled' : ''}>Tiếp →</button><button class="btn primary" data-p80-submit>Nộp bài</button></section><p class="p80-lock">Exam mode khóa đáp án, giải thích và transcript cho đến khi nộp.</p></div>`;
  }
  function resultView() {
    const result = runtime.result || readAttempts()[0]; if (!result) return hubView(); const analysis = result.analysis || P80ResultAnalysisService.analyze(result, P80TopikQuestionBankService.all({ level: result.level }));
    return `<div class="p80-shell">${header('Result Analysis', `${escapeHtml(result.setTitle)} · ${result.finishReason === 'time-expired' ? 'Hết giờ' : 'Đã nộp'}`)}<section class="section p80-result-hero"><div><b>${result.percentage}%</b><span>${result.scaledScore}/${result.maxScore} điểm ước tính</span></div><p>${result.correct} đúng · ${result.wrong} sai · ${result.skipped} bỏ trống</p></section><section class="section p80-analysis-grid"><article><small>SKILL SCORE</small>${Object.entries(analysis.skillScores || {}).map(([skill, score]) => `<p><span>${titleCase(skill)}</span><b>${score}%</b><i><em style="width:${score}%"></em></i></p>`).join('')}</article><article><small>WEAKNESS</small>${(analysis.weaknesses || []).map((item) => `<p><span>${titleCase(item.area)}</span><b>${item.score}%</b></p>`).join('') || '<p>Chưa phát hiện vùng dưới 75%.</p>'}</article><article><small>ERROR TYPE</small>${Object.entries(analysis.errorTypes || {}).map(([type, count]) => `<p><span>${titleCase(type)}</span><b>${count}</b></p>`).join('')}</article></section><section class="section p80-review">${(result.answers || []).map((answer, index) => { const question = P80TopikQuestionBankService.get(answer.questionId); if (!question) return ''; return `<details class="${answer.correct ? 'correct' : 'wrong'}"><summary>Câu ${index + 1} · ${answer.correct ? '✓ Đúng' : '✕ Cần xem lại'} · ${answer.score}%</summary><h3>${escapeHtml(question.prompt)}</h3><p><b>Bạn chọn:</b> ${escapeHtml(answer.selectedAnswer || 'Bỏ trống')}</p><p><b>Đáp án/mẫu:</b> ${escapeHtml(question.section === 'writing' ? question.modelAnswer || question.answer : question.answer)}</p><p>${escapeHtml(question.explanation)}</p><small>Chiến lược: ${escapeHtml(question.strategy || '')}</small></details>`; }).join('')}</section><section class="section p80-actions"><button class="btn primary" data-view="topik-report-p80">AI TOPIK Report</button><button class="btn secondary" data-view="topik-generator-p80">Tạo đề cải thiện</button><button class="btn secondary" data-view="error-notebook">Mở Sổ lỗi</button></section>${notice()}</div>`;
  }
  function reportView() {
    if (!runtime.config) return loading(); const target = Number(state.currentUser?.targetTopikLevel || (runtime.result?.level === 'TOPIK I' ? 2 : 4)); const report = runtime.report || P80TopikReportService.diagnose(target); const prediction = report.prediction;
    return `<div class="p80-shell">${header('AI TOPIK Report', 'Chẩn đoán dựa trên kết quả thật đã lưu; AI chỉ diễn giải dữ liệu có cấu trúc.')}<section class="section p80-report"><span class="p80-pill">TARGET TOPIK ${report.targetLevel}</span><h2>${escapeHtml(report.diagnosis)}</h2><div class="p80-report-evidence"><article><b>${report.evidence.latestScore == null ? '—' : `${report.evidence.latestScore}%`}</b><small>Bài gần nhất</small></article><article><b>${prediction.attempts}</b><small>Số bài P80</small></article><article><b>${prediction.predictedScore}/${prediction.maxScore}</b><small>Điểm dự đoán</small></article><article><b>${prediction.readinessLevel || '—'}</b><small>Readiness level</small></article></div><h3>Ưu tiên cải thiện</h3><ul>${report.actions.map((action) => `<li>${escapeHtml(action)}</li>`).join('')}</ul><p><b>Nhóm lỗi nổi bật:</b> ${escapeHtml(titleCase(report.dominantError))} · <b>Trend:</b> ${escapeHtml(prediction.trend)} · <b>Confidence:</b> ${escapeHtml(prediction.confidence)}</p>${runtime.aiReport ? `<div class="p80-ai-output">${escapeHtml(runtime.aiReport).replace(/\n/g, '<br>')}</div>` : ''}<button class="btn primary" data-p80-ai-report ${runtime.aiBusy ? 'disabled' : ''}>${runtime.aiBusy ? 'AI đang phân tích…' : 'Tạo diễn giải AI'}</button></section>${notice()}</div>`;
  }

  Object.assign(global, { P80TopikConfigService, P80TopikQuestionBankService, P80TopikExamService, P80SectionPracticeService, P80QuestionTypeTrainingService, P80SmartTestGeneratorService, P80ResultAnalysisService, P80ErrorNotebookBridgeService, P80TopikReportService, P80ScorePredictionService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'topik-intelligence-p80': hubView, 'topik-bank-p80': bankView, 'topik-section-p80': sectionView, 'topik-types-p80': typesView, 'topik-generator-p80': generatorView, 'topik-exam-p80': examView, 'topik-result-p80': resultView, 'topik-report-p80': reportView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (state.currentView === 'topik' && !global.document?.querySelector?.('[data-p80-entry]')) global.document.querySelector('.section, #app')?.insertAdjacentHTML('afterbegin', '<button class="p80-entry" data-view="topik-intelligence-p80" data-p80-entry><span>80</span><div><b>TOPIK Exam Intelligence</b><small>Mock test · section · question type · smart generator · AI report</small></div><i>›</i></button>');
    const entry = global.document?.querySelector?.('[data-p80-entry]'); if (entry) entry.onclick = () => setView('topik-intelligence-p80');
    global.document?.querySelectorAll?.('[data-p80-mock]')?.forEach((button) => { button.onclick = () => P80TopikExamService.startMock(button.dataset.p80Mock); });
    global.document?.querySelectorAll?.('[data-p80-section]')?.forEach((button) => { button.onclick = () => P80SectionPracticeService.start(button.dataset.p80Section); });
    global.document?.querySelectorAll?.('[data-p80-type]')?.forEach((button) => { button.onclick = () => P80QuestionTypeTrainingService.start(button.dataset.p80Type, runtime.bankLevel); });
    global.document?.querySelectorAll?.('[data-p80-level]')?.forEach((button) => { button.onclick = () => { runtime.bankLevel = button.dataset.p80Level; render(); }; });
    global.document?.querySelectorAll?.('[data-p80-filter]')?.forEach((select) => { select.onchange = () => { if (select.dataset.p80Filter === 'level') runtime.bankLevel = select.value; if (select.dataset.p80Filter === 'section') runtime.bankSection = select.value; if (select.dataset.p80Filter === 'type') runtime.bankType = select.value; render(); }; });
    const generatorForm = global.document?.querySelector?.('[data-p80-generator]'); if (generatorForm) generatorForm.onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(generatorForm).entries()); runtime.generator = values; P80SmartTestGeneratorService.start(values); };
    global.document?.querySelectorAll?.('[data-p80-answer]')?.forEach((button) => { button.onclick = () => { const question = runtime.session?.questions?.[runtime.session.index]; if (!question) return; P80TopikExamService.answer(question.id, button.dataset.p80Answer); render(); }; });
    const writing = global.document?.querySelector?.('#p80WritingAnswer'); if (writing) writing.oninput = () => { const question = runtime.session?.questions?.[runtime.session.index]; if (question) P80TopikExamService.answer(question.id, writing.value); };
    global.document?.querySelectorAll?.('[data-p80-index]')?.forEach((button) => { button.onclick = () => { P80TopikExamService.navigate(button.dataset.p80Index); render(); }; });
    global.document?.querySelector?.('[data-p80-submit]')?.addEventListener('click', () => P80TopikExamService.finish('submitted'));
    global.document?.querySelectorAll?.('[data-p80-audio]')?.forEach((button) => { button.onclick = () => speakKorean?.(button.dataset.p80Audio); });
    const aiButton = global.document?.querySelector?.('[data-p80-ai-report]'); if (aiButton) aiButton.onclick = async () => { runtime.aiBusy = true; render(); await P80TopikReportService.generateAI(Number(state.currentUser?.targetTopikLevel || 4)); runtime.aiBusy = false; render(); };
    clearInterval(runtime.timer); runtime.timer = null;
    if (state.currentView === 'topik-exam-p80' && runtime.session) runtime.timer = setInterval(() => { const timer = global.document?.querySelector?.('#p80ExamTimer'); const remaining = P80TopikExamService.remainingSeconds(); if (timer) timer.textContent = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`; if (remaining <= 0) { clearInterval(runtime.timer); runtime.timer = null; P80TopikExamService.finish('time-expired'); } }, 1000);
  };
  P80TopikConfigService.load();
})(window);
