/* P81 — TOPIK strategy and coaching, reusing P80, Adaptive, SRS and Error Notebook. */
(function topikStrategyCoachingSystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, storage, escapeHtml = String, render, setView, toast, userScoped, saveUserScoped, updateCurrentUser } = app;
  const runtime = state.p81Topik || (state.p81Topik = {
    config: null, loading: null, level: 'all', section: 'all', query: '', selectedId: '',
    writingDraft: '', writingChecks: null, aiWriting: '', aiDiagnosis: '', aiBusy: false,
    timer: { running: false, deadlineAt: null, remainingSeconds: 0, interval: null },
    timePlan: 'topik-ii', goalWeeks: 14
  });
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clean = (value, max = 4000) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const uid = () => state.currentUser?.id || '';
  const now = () => new Date().toISOString();
  const safeObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const average = (values) => values.length ? Math.round(values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length) : 0;
  const title = (value) => String(value || '').replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

  const P81TopikStrategyConfigService = {
    hydrate(value) {
      const strategies = Array.isArray(value?.strategies) ? value.strategies : [];
      const ids = new Set();
      const valid = Number(value?.schemaVersion) === 1
        && value?.contentPolicy?.sourceType === 'ORIGINAL_EDUCATIONAL_CONTENT'
        && strategies.length >= 20
        && strategies.every((item) => {
          const okay = item.id && item.title && item.section && item.questionType && item.level && item.explanation
            && item.example?.label === 'Practice Example' && item.commonMistakes?.length && item.recommendedApproach?.length
            && item.practiceReference?.section && item.provenance?.sourceType === 'PRACTICE_EXAMPLE'
            && item.provenance?.examYear === null && !ids.has(item.id);
          ids.add(item.id); return Boolean(okay);
        })
        && ['listening', 'reading', 'writing'].every((section) => strategies.some((item) => item.section === section))
        && [51, 52, 53, 54].every((number) => strategies.some((item) => item.practiceReference?.questionNumber === number))
        && Array.isArray(value?.writingTemplates) && value.writingTemplates.length >= 8
        && Array.isArray(value?.timePlans) && value.timePlans.length === 2
        && Array.isArray(value?.offlinePacks) && value.offlinePacks.length >= 3;
      if (!valid) throw new Error('P81 TOPIK strategy content contract failed');
      runtime.config = clone(value); return this.get();
    },
    get() { return runtime.config ? clone(runtime.config) : null; },
    async load() {
      if (runtime.config) return this.get();
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/topik-strategy-coaching-system.json', { cache: 'default' })
        .then((response) => { if (!response.ok) throw new Error(`P81 content ${response.status}`); return response.json(); })
        .then((value) => this.hydrate(value)).catch(() => null).finally(() => { runtime.loading = null; if (String(state.currentView).includes('p81')) render(); });
      return runtime.loading;
    }
  };

  function examAttempts() {
    const all = safeObject(storage.get(STORAGE_KEYS.examAttempts, {}));
    return Array.isArray(all?.[uid()]?.history) ? all[uid()].history : [];
  }

  const P81StrategyLibraryService = {
    all(filters = {}) {
      return (runtime.config?.strategies || [])
        .filter((item) => !filters.level || filters.level === 'all' || item.level === filters.level)
        .filter((item) => !filters.section || filters.section === 'all' || item.section === filters.section)
        .filter((item) => !filters.query || clean(`${item.title} ${item.explanation} ${item.questionType}`, 800).toLocaleLowerCase('vi').includes(clean(filters.query, 120).toLocaleLowerCase('vi')))
        .map(clone);
    },
    get(id) { const item = (runtime.config?.strategies || []).find((entry) => entry.id === id); return item ? clone(item) : null; },
    counts() { const all = this.all(); return { total: all.length, reading: all.filter((item) => item.section === 'reading').length, listening: all.filter((item) => item.section === 'listening').length, writing: all.filter((item) => item.section === 'writing').length }; }
  };

  function evidenceScores(strategy) {
    return examAttempts().filter((attempt) => !strategy.level || attempt.level === strategy.level).flatMap((attempt) => {
      if (attempt.mode === `strategy-p81-${strategy.id}`) return [{ score: Number(attempt.percentage || 0), at: attempt.completedAt, direct: true }];
      const score = attempt.questionTypeBreakdown?.[strategy.questionType];
      const sectionScore = attempt.skillBreakdown?.[strategy.section];
      if (Number.isFinite(Number(score))) return [{ score: Number(score), at: attempt.completedAt, direct: false }];
      return Number.isFinite(Number(sectionScore)) ? [{ score: Number(sectionScore), at: attempt.completedAt, direct: false }] : [];
    }).sort((a, b) => new Date(a.at || 0) - new Date(b.at || 0)).slice(-8);
  }

  const masteryLabels = Object.freeze({ not_started: 'Not Started', learning: 'Learning', practicing: 'Practicing', reliable: 'Reliable', mastered: 'Mastered' });
  const P81StrategyMasteryService = {
    evidence(id) { const strategy = P81StrategyLibraryService.get(id); return strategy ? evidenceScores(strategy) : []; },
    get(id) {
      const evidence = this.evidence(id); const scores = evidence.map((item) => item.score); const avg = average(scores); const recent = average(scores.slice(-3));
      let status = 'not_started';
      if (scores.length) status = 'learning';
      if (scores.length >= 2 && avg >= 60) status = 'practicing';
      if (scores.length >= 3 && recent >= 75) status = 'reliable';
      if (scores.length >= 4 && recent >= 85 && scores.slice(-3).every((score) => score >= 75)) status = 'mastered';
      const previous = scores.length >= 2 ? scores[scores.length - 2] : null; const latest = scores.at(-1) ?? null;
      return { id, status, label: masteryLabels[status], attempts: scores.length, average: avg, recent, latest, improved: previous !== null && latest - previous >= 10, evidence: clone(evidence), basis: 'P80 practice/mock scores; XP is not used.' };
    },
    summary(section) {
      const items = P81StrategyLibraryService.all(section ? { section } : {}).map((strategy) => ({ strategy, mastery: this.get(strategy.id) }));
      return { total: items.length, mastered: items.filter((item) => item.mastery.status === 'mastered').length, reliable: items.filter((item) => ['reliable', 'mastered'].includes(item.mastery.status)).length, items };
    }
  };

  const P81StrategyPracticeService = {
    questions(id, count = 5) {
      const strategy = P81StrategyLibraryService.get(id); if (!strategy || !global.P80TopikQuestionBankService) return [];
      let questions = global.P80TopikQuestionBankService.all(strategy.practiceReference);
      if (strategy.practiceReference.questionNumber) questions = questions.filter((item) => Number(item.questionNumber) === Number(strategy.practiceReference.questionNumber));
      if (!questions.length) questions = global.P80TopikQuestionBankService.all({ level: strategy.level, section: strategy.section });
      return questions.slice(0, Math.max(1, Number(count) || 5));
    },
    start(id, count = 5) {
      const strategy = P81StrategyLibraryService.get(id); const questions = this.questions(id, count);
      if (!strategy || !questions.length || !global.P80TopikExamService) return null;
      return global.P80TopikExamService.start({ level: strategy.level, title: `P81 · ${strategy.title}`, durationMinutes: Math.max(5, questions.length * (strategy.section === 'writing' ? 8 : 2)), mode: `strategy-p81-${strategy.id}`, questions });
    }
  };

  const P81WritingTemplateService = { all() { return clone(runtime.config?.writingTemplates || []); }, get(id) { return this.all().find((item) => item.id === id) || null; } };
  const P81WritingSelfCheckService = {
    check(text, confirmations = {}) {
      const value = clean(text, 5000); const sentences = value.split(/[.!?。！？]\s*/).filter(Boolean); const connectors = (value.match(/또한|그러나|따라서|반면에|그 결과|때문에|이에 따라/g) || []).length;
      const items = [
        { id: 'topic', label: 'Chủ đề', passed: Boolean(confirmations.topic) && value.length >= 20, note: 'Đã trả lời đúng yêu cầu đề?' },
        { id: 'structure', label: 'Cấu trúc', passed: Boolean(confirmations.structure) && sentences.length >= 2, note: 'Có mở–thân–kết hoặc trật tự phù hợp dạng câu?' },
        { id: 'grammar', label: 'Ngữ pháp', passed: Boolean(confirmations.grammar), note: 'Đã kiểm tra đuôi câu và quan hệ ngữ pháp?' },
        { id: 'vocabulary', label: 'Từ vựng', passed: Boolean(confirmations.vocabulary), note: 'Từ có đúng ngữ cảnh và sắc thái?' },
        { id: 'cohesion', label: 'Liên kết', passed: Boolean(confirmations.cohesion) && connectors >= 1, note: 'Từ nối có đúng chức năng?' },
        { id: 'spelling', label: 'Chính tả', passed: Boolean(confirmations.spelling), note: 'Đã đọc lại khoảng trắng và chính tả?' },
        { id: 'length', label: 'Độ dài', passed: value.length >= Math.max(20, Number(confirmations.minimumLength || 20)), note: `${value.length} ký tự trong bản luyện.` },
        { id: 'logic', label: 'Logic', passed: Boolean(confirmations.logic), note: 'Ví dụ và kết luận có hỗ trợ luận điểm?' }
      ];
      return { items, passed: items.filter((item) => item.passed).length, total: items.length, readyToReview: items.every((item) => item.passed), length: value.length, connectors, notice: runtime.config?.contentPolicy?.aiNotice };
    }
  };

  const P81TimeManagementService = {
    plans() { return clone(runtime.config?.timePlans || []); },
    get(id = runtime.timePlan) { return this.plans().find((item) => item.id === id) || this.plans()[0] || null; },
    customize(id, values = {}) { const plan = this.get(id); if (!plan) return null; const sections = plan.sections.map((item) => ({ ...item, minutes: Math.max(0, Math.min(180, Number(values[item.id] ?? item.minutes) || 0)) })); return { ...plan, sections, totalMinutes: sections.reduce((sum, item) => sum + item.minutes, 0), customized: true }; },
    start(minutes = 10) { clearInterval(runtime.timer.interval); runtime.timer.running = true; runtime.timer.remainingSeconds = Math.max(60, Math.round(Number(minutes || 10) * 60)); runtime.timer.deadlineAt = new Date(Date.now() + runtime.timer.remainingSeconds * 1000).toISOString(); this.bind(); return this.status(); },
    bind() { clearInterval(runtime.timer.interval); if (!runtime.timer.running) return; runtime.timer.interval = setInterval(() => { runtime.timer.remainingSeconds = Math.max(0, Math.ceil((new Date(runtime.timer.deadlineAt).getTime() - Date.now()) / 1000)); const node = global.document?.querySelector?.('[data-p81-live-timer]'); if (node) node.textContent = this.format(runtime.timer.remainingSeconds); if (!runtime.timer.remainingSeconds) { this.stop(); toast('Đã hết thời gian luyện.'); } }, 1000); },
    stop() { clearInterval(runtime.timer.interval); runtime.timer.interval = null; runtime.timer.running = false; return this.status(); },
    status() { return { running: runtime.timer.running, remainingSeconds: runtime.timer.remainingSeconds, deadlineAt: runtime.timer.deadlineAt }; },
    format(seconds) { return `${Math.floor(Number(seconds || 0) / 60)}:${String(Number(seconds || 0) % 60).padStart(2, '0')}`; }
  };

  const P81ExamSimulationService = {
    available() { return clone(global.P80TopikConfigService?.get?.()?.mockTests || []); },
    async start(level) {
      const mock = this.available().find((item) => item.level === level); if (!mock) return null;
      try { if (global.document?.documentElement?.requestFullscreen) await global.document.documentElement.requestFullscreen(); } catch (_) { /* Fullscreen is optional. */ }
      return global.P80TopikExamService?.startMock?.(mock.id) || null;
    },
    contract() { return { reusesP80: true, timer: true, navigation: true, sectionProgress: true, hintsDuringExam: false, answersDuringExam: false, aiDuringExam: false, reviewAfterSubmit: true }; }
  };

  function p80Evidence() {
    const attempts = examAttempts().filter((item) => item.source === 'p80-topik-intelligence').slice(0, 12);
    const errors = global.ErrorNotebookService?.top?.(30) || [];
    const priorities = global.AdaptiveLearningEngine?.priorities?.() || [];
    return { attempts, errors, priorities };
  }

  const P81GoalPlannerService = {
    current() { const goal = global.GoalTrackingService?.getGoal?.() || {}; return { currentLevel: Number(state.currentUser?.currentTopikLevel || 1), targetLevel: Number(goal.targetLevel || state.currentUser?.targetTopikLevel || 2), deadline: goal.deadline || '', dailyMinutes: Number(goal.dailyMinutes || state.currentUser?.studyMinutesPerDay || 20) }; },
    save(input = {}) {
      const currentLevel = Math.max(1, Math.min(6, Number(input.currentLevel || 1))); const targetLevel = Math.max(currentLevel, Math.min(6, Number(input.targetLevel || currentLevel)));
      updateCurrentUser?.({ currentTopikLevel: currentLevel, targetTopikLevel: targetLevel });
      return global.GoalTrackingService?.saveGoal?.({ goalType: 'topik', targetLevel, deadline: clean(input.deadline, 10), dailyMinutes: Math.max(10, Math.min(180, Number(input.dailyMinutes || 20))) }) || null;
    },
    weekly(days = runtime.goalWeeks) {
      const goal = this.current(); const evidence = p80Evidence(); const weak = evidence.priorities.slice(0, 3).map((item) => item.id);
      const fallback = goal.targetLevel >= 3 ? ['vocabulary', 'grammar', 'listening', 'reading', 'writing', 'mock-test'] : ['vocabulary', 'grammar', 'listening', 'reading', 'mock-test'];
      const focus = [...new Set([...weak, ...fallback])]; const weeks = Math.max(1, Math.ceil(Math.max(7, Number(days) || 14) / 7));
      return { goal, days: weeks * 7, weeks: Array.from({ length: weeks }, (_, index) => ({ week: index + 1, items: focus.map((skill, order) => ({ skill, minutes: Math.max(10, Math.round(goal.dailyMinutes * (order < 2 ? .45 : .3))), route: skill === 'mock-test' ? 'topik-intelligence-p80' : skill === 'vocabulary' ? 'vocabulary-immersion-p79' : skill === 'writing' ? 'topik-writing-p81' : 'topik-strategies-p81', reason: weak.includes(skill) ? 'Adaptive Engine đánh dấu ưu tiên' : 'Thành phần cần cho mục tiêu TOPIK' })) })), source: 'GoalTrackingService + AdaptiveLearningEngine + P80 evidence', independentScheduler: false };
    }
  };

  const P81StrategyAdaptationService = {
    recommend(limit = 5) {
      const errors = global.ErrorNotebookService?.top?.(50) || [];
      return P81StrategyLibraryService.all().map((strategy) => {
        const mastery = P81StrategyMasteryService.get(strategy.id); const text = `${strategy.section} ${strategy.questionType} ${strategy.title}`.toLocaleLowerCase();
        const errorCount = errors.filter((item) => text.includes(String(item.type || '').replace('topik-', '').toLocaleLowerCase()) || String(item.question || '').toLocaleLowerCase().includes(strategy.questionType.replace('-', ' '))).reduce((sum, item) => sum + Number(item.count || 1), 0);
        const rank = ({ not_started: 5, learning: 4, practicing: 3, reliable: 1, mastered: 0 })[mastery.status] + Math.min(5, errorCount);
        return { strategy, mastery, errorCount, rank, reason: errorCount ? `${errorCount} lỗi liên quan trong Error Notebook` : mastery.status === 'not_started' ? 'Chưa có practice evidence' : `Mastery hiện tại: ${mastery.label}` };
      }).sort((a, b) => b.rank - a.rank || a.strategy.title.localeCompare(b.strategy.title)).slice(0, limit);
    }
  };

  const P81ReadinessService = {
    calculate(level = P81GoalPlannerService.current().targetLevel <= 2 ? 'TOPIK I' : 'TOPIK II') {
      const attempts = examAttempts().filter((item) => item.level === level && item.source === 'p80-topik-intelligence').slice(0, 8);
      const sections = level === 'TOPIK I' ? ['listening', 'reading'] : ['listening', 'reading', 'writing'];
      const skillScores = Object.fromEntries(sections.map((section) => [section, average(attempts.map((item) => item.skillBreakdown?.[section]).filter((value) => Number.isFinite(Number(value))))]));
      const summary = P81StrategyMasteryService.summary(); const reliable = summary.total ? Math.round(summary.reliable / summary.total * 100) : 0;
      const days = new Set(attempts.map((item) => String(item.completedAt || '').slice(0, 10)).filter(Boolean)).size; const consistency = Math.min(100, days * 20);
      const errors = global.ErrorNotebookService?.all?.().filter((item) => String(item.type || '').startsWith('topik-')) || [];
      const unresolved = errors.filter((item) => !item.resolved).length; const errorTrend = errors.length ? Math.max(0, 100 - Math.round(unresolved / errors.length * 100)) : 0;
      const skillAverage = average(Object.values(skillScores)); const score = Math.round(skillAverage * .5 + reliable * .25 + consistency * .15 + errorTrend * .1);
      return { level, score, label: attempts.length < 2 ? 'Chưa đủ bằng chứng' : score >= 80 ? 'Bằng chứng mạnh' : score >= 65 ? 'Đang tiến gần' : score >= 45 ? 'Đang xây nền' : 'Cần thêm luyện tập', skillScores, strategyReliablePercent: reliable, consistency, activeDays: days, errorResolutionPercent: errorTrend, attempts: attempts.length, evidence: ['Điểm kỹ năng từ tối đa 8 bài P80 gần nhất', 'Strategy mastery dựa trên practice evidence', 'Số ngày có bài thi/luyện', 'Tỷ lệ lỗi TOPIK đã xử lý'], notice: runtime.config?.contentPolicy?.readinessNotice };
    }
  };

  const P81TopikCoachService = {
    diagnosis(days = runtime.goalWeeks) {
      const readiness = P81ReadinessService.calculate(); const recommendations = P81StrategyAdaptationService.recommend(3); const plan = P81GoalPlannerService.weekly(days);
      return { readiness, priorities: recommendations.map((item) => ({ id: item.strategy.id, title: item.strategy.title, section: item.strategy.section, reason: item.reason })), plan, currentPerformance: readiness.skillScores, errorSummary: { total: global.ErrorNotebookService?.all?.().length || 0, top: (global.ErrorNotebookService?.top?.(5) || []).map((item) => ({ type: item.type, count: item.count })) }, source: 'P80 history + skill performance + Error Notebook + Adaptive + SRS learner context', official: false };
    },
    async explain(days = runtime.goalWeeks) {
      const diagnosis = this.diagnosis(days); if (!global.AICoachService?.request) return { ...diagnosis, ai: null, fallback: true };
      const evidence = JSON.stringify({ readiness: diagnosis.readiness, priorities: diagnosis.priorities, planDays: diagnosis.plan.days, errorSummary: diagnosis.errorSummary }).slice(0, 3500);
      const prompt = `Bạn là lớp diễn giải của AI Coach hiện có. Dựa duy nhất trên evidence TOPIK sau: ${evidence}. Viết chẩn đoán tiếng Việt ngắn gồm Current performance, Priority Areas và kế hoạch ${diagnosis.plan.days} ngày. Nêu rõ đây không phải chấm điểm hay dự báo chính thức. Không bịa dữ liệu.`;
      try { return { ...diagnosis, ai: clean(await global.AICoachService.request(prompt, 'learning_recommendation'), 8000), fallback: false }; } catch (_) { return { ...diagnosis, ai: null, fallback: true }; }
    }
  };

  const P81OfflineStrategyService = {
    all() { return clone(runtime.config?.offlinePacks || []); },
    installed() { return userScoped(STORAGE_KEYS.offlinePacks).filter((item) => String(item.id).startsWith('p81-')); },
    async download(id) {
      const pack = this.all().find((item) => item.id === id); if (!pack || !uid()) return null;
      const assets = ['./content/topik-strategy-coaching-system.json', './data/topik-strategy-coaching-system.js?v=1', './topik-strategy-coaching-system.css?v=1', './data/topik-exam-intelligence-system.js?v=2', './topik-exam-intelligence-system.css?v=2', './content/topik-exam-intelligence-system.json'];
      let cached = false;
      if (global.caches?.open) { try { const cache = await global.caches.open('klearn-p81-strategy-v1'); await cache.addAll(assets); cached = true; } catch (_) { cached = false; } }
      const item = { ...pack, status: 'downloaded', cached, assets, downloadedAt: now(), learningDataPreserved: true };
      saveUserScoped(STORAGE_KEYS.offlinePacks, [item, ...userScoped(STORAGE_KEYS.offlinePacks).filter((entry) => entry.id !== id)], 60); return item;
    }
  };

  const P81StrategyDashboardService = {
    summary() {
      const sections = Object.fromEntries(['reading', 'listening', 'writing'].map((section) => [section, P81StrategyMasteryService.summary(section)]));
      const all = Object.values(sections).flatMap((item) => item.items); return { sections, weak: P81StrategyAdaptationService.recommend(5), improved: all.filter((item) => item.mastery.improved).slice(0, 5), next: P81StrategyAdaptationService.recommend(1)[0] || null };
    }
  };

  function loading() { return '<div class="p81-shell"><section class="section p81-loading"><h1>Đang tải TOPIK Strategy…</h1><p>Nội dung được tải theo route để giữ initial load gọn.</p></section></div>'; }
  function header(label, subtitle, back = 'topik') { return `<section class="section p81-header"><button class="back-link" data-view="${back}">← Quay lại</button><p class="eyebrow">P81 · TOPIK STRATEGY & COACHING</p><h1>${escapeHtml(label)}</h1><p>${escapeHtml(subtitle)}</p></section>`; }
  function policy() { const p = runtime.config?.contentPolicy || {}; return `<aside class="section p81-policy"><b>Content trust</b><span>${escapeHtml(p.notice || '')}</span><span>${escapeHtml(p.aiNotice || '')}</span></aside>`; }
  function masteryBadge(id) { const mastery = P81StrategyMasteryService.get(id); return `<span class="p81-mastery ${mastery.status}">${mastery.label} · ${mastery.attempts} evidence</span>`; }

  function hubView() {
    if (!runtime.config) return loading(); const counts = P81StrategyLibraryService.counts(); const dashboard = P81StrategyDashboardService.summary();
    return `<div class="p81-shell">${header('TOPIK Strategy & Coaching', 'Hiểu dạng câu → áp dụng chiến thuật → luyện bằng P80 → cải thiện từ bằng chứng.')}<section class="section p81-hero"><div><span>GOAL → STRATEGY → PRACTICE → MOCK → ERROR → IMPROVEMENT</span><h2>Thi có chiến lược, không học mẹo máy móc.</h2><p>Giải thích Vietnamese-first, practice example có provenance và readiness không hứa hẹn điểm.</p></div><div><b>${counts.total}</b><small>chiến thuật</small></div></section><section class="section p81-quick-grid"><button data-view="topik-strategies-p81"><b>Thư viện chiến thuật</b><small>${counts.reading} đọc · ${counts.listening} nghe · ${counts.writing} viết</small></button><button data-view="topik-writing-p81"><b>Writing 51–54</b><small>Template · self-check · AI hỗ trợ có giới hạn</small></button><button data-view="topik-time-p81"><b>Time Management</b><small>Kế hoạch linh hoạt · practice timer</small></button><button data-view="topik-simulation-p81"><b>Exam Simulation</b><small>Tái sử dụng P80 exam mode</small></button><button data-view="topik-goal-p81"><b>Goal Planner</b><small>Adaptive Engine · 7/14 ngày</small></button><button data-view="topik-coach-p81"><b>AI TOPIK Coach</b><small>Chẩn đoán từ dữ liệu hiện có</small></button><button data-view="topik-dashboard-p81"><b>Mastery Dashboard</b><small>${dashboard.sections.reading.mastered}/${dashboard.sections.reading.total} Reading mastered</small></button><button data-view="topik-readiness-p81"><b>Readiness</b><small>Evidence, consistency và error trends</small></button><button data-view="topik-offline-p81"><b>Offline Packs</b><small>Strategy cơ bản không cần AI</small></button></section>${dashboard.next ? `<section class="section p81-next"><div><small>RECOMMENDED NEXT</small><h2>${escapeHtml(dashboard.next.strategy.title)}</h2><p>${escapeHtml(dashboard.next.reason)}</p></div><button class="btn primary" data-p81-strategy="${dashboard.next.strategy.id}">Mở chiến thuật</button></section>` : ''}${policy()}</div>`;
  }

  function libraryView() {
    if (!runtime.config) return loading(); const items = P81StrategyLibraryService.all({ level: runtime.level, section: runtime.section, query: runtime.query });
    return `<div class="p81-shell">${header('Strategy Library', 'TOPIK I Listening/Reading · TOPIK II Listening/Reading/Writing.', 'topik-strategy-p81')}<form class="section p81-filters" data-p81-filter-form><input name="query" value="${escapeHtml(runtime.query)}" placeholder="Tìm ý chính, distractor, Writing 54…" aria-label="Tìm chiến thuật"><select name="level" aria-label="Lọc cấp"><option value="all">Mọi cấp</option><option ${runtime.level === 'TOPIK I' ? 'selected' : ''}>TOPIK I</option><option ${runtime.level === 'TOPIK II' ? 'selected' : ''}>TOPIK II</option></select><select name="section" aria-label="Lọc phần"><option value="all">Mọi phần</option>${['reading','listening','writing'].map((value) => `<option value="${value}" ${runtime.section === value ? 'selected' : ''}>${title(value)}</option>`).join('')}</select><button class="btn primary">Lọc</button></form><section class="section p81-strategy-grid">${items.map((item) => `<button class="p81-strategy-card" data-p81-strategy="${item.id}"><span>${item.level} · ${title(item.section)}</span><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.explanation)}</p>${masteryBadge(item.id)}</button>`).join('') || '<div class="empty-state">Không có chiến thuật phù hợp bộ lọc.</div>'}</section>${policy()}</div>`;
  }

  function detailView() {
    const item = P81StrategyLibraryService.get(runtime.selectedId); if (!item) return libraryView(); const mastery = P81StrategyMasteryService.get(item.id);
    return `<div class="p81-shell">${header(item.title, `${item.level} · ${title(item.section)} · ${title(item.questionType)}`, 'topik-strategies-p81')}<article class="section p81-detail"><div class="p81-detail-head">${masteryBadge(item.id)}<span>${escapeHtml(item.example.label)} · ${escapeHtml(item.provenance.source)}</span></div><h2>Giải thích</h2><p>${escapeHtml(item.explanation)}</p><h2>Cách nghĩ sư phạm</h2><p class="p81-think">${escapeHtml(item.thinkAloud)}</p><h2>Cách làm đề xuất</h2><ol>${item.recommendedApproach.map((step) => `<li>${escapeHtml(step)}</li>`).join('')}</ol><h2>Lỗi thường gặp</h2><ul>${item.commonMistakes.map((mistake) => `<li>${escapeHtml(mistake)}</li>`).join('')}</ul><div class="p81-example"><small>${escapeHtml(item.example.label)} · không phải đề thật</small><h3>${escapeHtml(item.example.prompt)}</h3><p>${escapeHtml(item.example.analysis)}</p><b>${escapeHtml(item.example.answer)}</b></div>${item.checklist ? `<h2>Checklist</h2><ul>${item.checklist.map((entry) => `<li>${escapeHtml(entry)}</li>`).join('')}</ul>` : ''}<div class="p81-evidence"><b>Mastery: ${mastery.label}</b><span>${mastery.attempts} bằng chứng · gần đây ${mastery.recent}%</span><small>${escapeHtml(mastery.basis)}</small></div><div class="action-row"><button class="btn primary" data-p81-practice="${item.id}">Practice bằng P80</button><button class="btn secondary" data-view="topik-dashboard-p81">Xem mastery</button></div></article>${policy()}</div>`;
  }

  function writingView() {
    if (!runtime.config) return loading(); const writing = P81StrategyLibraryService.all({ section: 'writing' }); const templates = P81WritingTemplateService.all(); const result = runtime.writingChecks;
    return `<div class="p81-shell">${header('TOPIK II Writing Studio', 'Câu 51–54, template có ngữ cảnh và self-check trước khi nộp.', 'topik-strategy-p81')}<section class="section p81-writing-types">${writing.map((item) => `<button data-p81-strategy="${item.id}"><b>${item.practiceReference.questionNumber}</b><span>${escapeHtml(item.title.replace(/^Writing \d+ · /, ''))}</span>${masteryBadge(item.id)}</button>`).join('')}</section><section class="section p81-template-library"><div class="section-heading"><div><small>WRITING TEMPLATE LIBRARY</small><h2>Biểu đạt có mục đích</h2></div><span>${templates.length} nhóm</span></div>${templates.map((item) => `<details><summary><b>${escapeHtml(item.category)}</b><span lang="ko">${escapeHtml(item.expression)}</span></summary><p><b>Khi nào:</b> ${escapeHtml(item.when)}</p><p><b>Vì sao:</b> ${escapeHtml(item.why)}</p><p><b>Biến đổi:</b> ${escapeHtml(item.variants.join(' · '))}</p><p lang="ko">${escapeHtml(item.example)}</p><small>⚠ ${escapeHtml(item.warning)}</small></details>`).join('')}</section><form class="section p81-self-check" data-p81-writing-check><h2>Writing Self-check</h2><textarea name="draft" rows="10" maxlength="5000" placeholder="Dán hoặc viết bản nháp tiếng Hàn…">${escapeHtml(runtime.writingDraft)}</textarea><div class="p81-check-grid">${[['topic','Đúng chủ đề'],['structure','Có cấu trúc'],['grammar','Đã kiểm tra ngữ pháp'],['vocabulary','Từ đúng ngữ cảnh'],['cohesion','Liên kết hợp lý'],['spelling','Đã soát chính tả'],['logic','Lập luận logic']].map(([id,label]) => `<label><input type="checkbox" name="${id}">${label}</label>`).join('')}</div><label>Độ dài luyện tập tối thiểu<input type="number" name="minimumLength" min="20" max="700" value="120"></label><button class="btn primary">Kiểm tra trước khi nộp</button></form>${result ? `<section class="section p81-check-result"><h2>${result.passed}/${result.total} mục có bằng chứng tự kiểm</h2>${result.items.map((item) => `<p class="${item.passed ? 'passed' : ''}"><b>${item.passed ? '✓' : '○'} ${escapeHtml(item.label)}</b><span>${escapeHtml(item.note)}</span></p>`).join('')}<p>${escapeHtml(result.notice)}</p><button class="btn secondary" data-p81-ai-writing ${runtime.aiBusy ? 'disabled' : ''}>${runtime.aiBusy ? 'AI đang hỗ trợ…' : 'Nhờ AI Coach phản hồi bản nháp'}</button>${runtime.aiWriting ? `<div class="p81-ai-output">${escapeHtml(runtime.aiWriting).replace(/\n/g, '<br>')}</div>` : ''}</section>` : ''}${policy()}</div>`;
  }

  function timeView() {
    if (!runtime.config) return loading(); const plan = P81TimeManagementService.get(); const timer = P81TimeManagementService.status();
    return `<div class="p81-shell">${header('Time Management Training', 'Điểm khởi đầu linh hoạt; bạn có thể điều chỉnh theo tốc độ cá nhân.', 'topik-strategy-p81')}<section class="section p81-level-switch">${P81TimeManagementService.plans().map((item) => `<button class="${item.id === runtime.timePlan ? 'active' : ''}" data-p81-time-plan="${item.id}">${item.level}</button>`).join('')}</section><form class="section p81-time-plan" data-p81-time-form><h2>${plan.level} · ${plan.totalMinutes} phút gợi ý luyện</h2>${plan.sections.map((item) => `<label><span>${escapeHtml(item.label)}</span><input type="number" min="0" max="180" name="${item.id}" value="${item.minutes}"><small>phút</small></label>`).join('')}<p>${escapeHtml(plan.notice)}</p><button class="btn secondary">Tính kế hoạch cá nhân</button></form><section class="section p81-practice-timer"><small>PRACTICE TIMER</small><b data-p81-live-timer>${P81TimeManagementService.format(timer.remainingSeconds)}</b><label>Phút luyện<input type="number" data-p81-timer-minutes min="1" max="180" value="10"></label><div class="action-row"><button class="btn primary" data-p81-timer-start>Bắt đầu</button><button class="btn secondary" data-p81-timer-stop>Dừng</button></div></section></div>`;
  }

  function simulationView() {
    if (!runtime.config) return loading(); const contract = P81ExamSimulationService.contract();
    return `<div class="p81-shell">${header('Exam Simulation Mode', 'P81 dùng trực tiếp P80 exam engine và kho câu hỏi hiện có.', 'topik-strategy-p81')}<section class="section p81-simulation"><div><small>TRONG PHIÊN THI</small><h2>Không hint · không đáp án · không AI explanation</h2><p>Timer, điều hướng câu, tiến độ phần thi và submit do P80 quản lý. Đáp án và giải thích chỉ xuất hiện sau khi nộp.</p></div><div class="p81-sim-contract">${Object.entries(contract).map(([key,value]) => `<span><b>${value ? '✓' : '—'}</b>${escapeHtml(title(key))}</span>`).join('')}</div><div class="action-row"><button class="btn primary" data-p81-simulate="TOPIK I">Mô phỏng TOPIK I</button><button class="btn primary" data-p81-simulate="TOPIK II">Mô phỏng TOPIK II</button></div><small>Fullscreen được yêu cầu nếu trình duyệt cho phép; exam vẫn hoạt động nếu bị từ chối.</small></section>${policy()}</div>`;
  }

  function goalView() {
    if (!runtime.config) return loading(); const current = P81GoalPlannerService.current(); const plan = P81GoalPlannerService.weekly(runtime.goalWeeks);
    return `<div class="p81-shell">${header('TOPIK Goal Planner', 'Kế hoạch dùng GoalTracking, Adaptive Engine và P80 evidence; không tạo scheduler thứ hai.', 'topik-strategy-p81')}<form class="section p81-goal-form" data-p81-goal><label>Current level<select name="currentLevel">${[1,2,3,4,5,6].map((value) => `<option value="${value}" ${current.currentLevel === value ? 'selected' : ''}>TOPIK ${value}</option>`).join('')}</select></label><label>Target TOPIK<select name="targetLevel">${[1,2,3,4,5,6].map((value) => `<option value="${value}" ${current.targetLevel === value ? 'selected' : ''}>TOPIK ${value}</option>`).join('')}</select></label><label>Target exam date<input type="date" name="deadline" value="${escapeHtml(current.deadline)}"></label><label>Phút/ngày<input type="number" name="dailyMinutes" min="10" max="180" value="${current.dailyMinutes}"></label><button class="btn primary">Lưu vào Adaptive Goal</button></form><section class="section p81-plan-switch"><button class="${runtime.goalWeeks === 7 ? 'active' : ''}" data-p81-plan-days="7">7 ngày</button><button class="${runtime.goalWeeks === 14 ? 'active' : ''}" data-p81-plan-days="14">14 ngày</button><span>${escapeHtml(plan.source)}</span></section><section class="section p81-week-plan">${plan.weeks.map((week) => `<article><h2>Tuần ${week.week}</h2>${week.items.map((item) => `<button data-view="${item.route}"><b>${escapeHtml(title(item.skill))}</b><span>${item.minutes} phút · ${escapeHtml(item.reason)}</span></button>`).join('')}</article>`).join('')}</section><p class="section p81-note">independentScheduler: false · thay đổi mục tiêu được lưu qua GoalTrackingService và CloudSync hiện có.</p></div>`;
  }

  function coachView() {
    if (!runtime.config) return loading(); const diagnosis = P81TopikCoachService.diagnosis(runtime.goalWeeks);
    return `<div class="p81-shell">${header('AI TOPIK Coach', 'Dùng AI Coach hiện tại; không tạo chatbot hoặc endpoint mới.', 'topik-strategy-p81')}<section class="section p81-coach"><div class="section-heading"><div><small>CURRENT PERFORMANCE</small><h2>${Object.entries(diagnosis.currentPerformance).map(([key,value]) => `${title(key)} ${value || '—'}`).join(' · ')}</h2></div><span>${diagnosis.readiness.label}</span></div><h3>Priority Areas</h3>${diagnosis.priorities.map((item) => `<button data-p81-strategy="${item.id}"><b>${escapeHtml(item.title)}</b><span>${escapeHtml(item.reason)}</span></button>`).join('')}<p>Nguồn: ${escapeHtml(diagnosis.source)}.</p><button class="btn primary" data-p81-ai-coach ${runtime.aiBusy ? 'disabled' : ''}>${runtime.aiBusy ? 'AI đang diễn giải…' : `Tạo chẩn đoán và kế hoạch ${runtime.goalWeeks} ngày`}</button>${runtime.aiDiagnosis ? `<div class="p81-ai-output">${escapeHtml(runtime.aiDiagnosis).replace(/\n/g, '<br>')}</div>` : ''}<small>${escapeHtml(runtime.config.contentPolicy.aiNotice)}</small></section></div>`;
  }

  function dashboardView() {
    if (!runtime.config) return loading(); const dashboard = P81StrategyDashboardService.summary();
    return `<div class="p81-shell">${header('Strategy Mastery Dashboard', 'Mastery chỉ tăng từ practice evidence, không dùng XP.', 'topik-strategy-p81')}<section class="section p81-mastery-overview">${Object.entries(dashboard.sections).map(([section,value]) => `<article><small>${title(section)} STRATEGY</small><b>${value.mastered}/${value.total}</b><span>mastered · ${value.reliable} reliable+</span></article>`).join('')}</section><section class="section p81-dashboard-grid"><article><h2>Weak strategies</h2>${dashboard.weak.map((item) => `<button data-p81-strategy="${item.strategy.id}"><b>${escapeHtml(item.strategy.title)}</b><span>${escapeHtml(item.reason)}</span></button>`).join('')}</article><article><h2>Recently improved</h2>${dashboard.improved.map((item) => `<button data-p81-strategy="${item.strategy.id}"><b>${escapeHtml(item.strategy.title)}</b><span>${item.mastery.latest}% · +10 trở lên</span></button>`).join('') || '<p>Chưa có hai bằng chứng liên tiếp để đo cải thiện.</p>'}</article></section></div>`;
  }

  function readinessView() {
    if (!runtime.config) return loading(); const readiness = P81ReadinessService.calculate();
    return `<div class="p81-shell">${header('TOPIK Readiness', 'Chỉ báo minh bạch từ bài P80, strategy mastery, consistency và error trends.', 'topik-strategy-p81')}<section class="section p81-readiness"><div class="p81-readiness-score"><b>${readiness.score}</b><span>/100</span><small>${escapeHtml(readiness.label)}</small></div><div class="p81-readiness-skills">${Object.entries(readiness.skillScores).map(([skill,score]) => `<p><span>${title(skill)}</span><b>${score || '—'}%</b><i><em style="width:${score || 0}%"></em></i></p>`).join('')}</div><div class="p81-readiness-evidence"><p><b>${readiness.attempts}</b><span>P80 attempts</span></p><p><b>${readiness.strategyReliablePercent}%</b><span>Strategy reliable+</span></p><p><b>${readiness.activeDays}</b><span>Active exam days</span></p><p><b>${readiness.errorResolutionPercent}%</b><span>TOPIK errors resolved</span></p></div><h2>Dữ liệu tạo nên chỉ số</h2><ul>${readiness.evidence.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p class="p81-warning">${escapeHtml(readiness.notice)}</p></section></div>`;
  }

  function offlineView() {
    if (!runtime.config) return loading(); const installed = new Set(P81OfflineStrategyService.installed().map((item) => item.id));
    return `<div class="p81-shell">${header('Offline Strategy Packs', 'Nội dung strategy cơ bản và P80 practice data có thể cache; AI không bắt buộc offline.', 'topik-strategy-p81')}<section class="section p81-offline-grid">${P81OfflineStrategyService.all().map((pack) => `<article><small>OFFLINE PACK</small><h2>${escapeHtml(pack.title)}</h2><p>${escapeHtml(pack.levels.join(' · '))} · ${escapeHtml(pack.sections.map(title).join(' · '))}</p><button class="btn ${installed.has(pack.id) ? 'secondary' : 'primary'}" data-p81-offline="${pack.id}">${installed.has(pack.id) ? 'Tải lại pack' : 'Download Strategy Pack'}</button></article>`).join('')}</section><p class="section p81-note">Dữ liệu tiến độ/SRS không bị xóa hoặc thay thế khi tải pack.</p></div>`;
  }

  Object.assign(global, { P81TopikStrategyConfigService, P81StrategyLibraryService, P81StrategyPracticeService, P81WritingTemplateService, P81WritingSelfCheckService, P81TimeManagementService, P81ExamSimulationService, P81GoalPlannerService, P81TopikCoachService, P81StrategyAdaptationService, P81StrategyMasteryService, P81StrategyDashboardService, P81ReadinessService, P81OfflineStrategyService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'topik-strategy-p81': hubView, 'topik-strategies-p81': libraryView, 'topik-strategy-detail-p81': detailView, 'topik-writing-p81': writingView, 'topik-time-p81': timeView, 'topik-simulation-p81': simulationView, 'topik-goal-p81': goalView, 'topik-coach-p81': coachView, 'topik-dashboard-p81': dashboardView, 'topik-readiness-p81': readinessView, 'topik-offline-p81': offlineView };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (state.currentView === 'topik' && !global.document?.querySelector?.('[data-p81-entry]')) global.document.querySelector('.section, #app')?.insertAdjacentHTML('afterbegin', '<button class="p81-entry" data-view="topik-strategy-p81" data-p81-entry><span>81</span><div><b>TOPIK Strategy & Coaching</b><small>Strategy · Writing · Timer · Goal · Coach · Readiness</small></div><i>›</i></button>');
    if (state.currentView === 'topik-intelligence-p80' && !global.document?.querySelector?.('[data-p81-entry]')) global.document.querySelector('.p80-hero')?.insertAdjacentHTML('afterend', '<button class="p81-entry" data-view="topik-strategy-p81" data-p81-entry><span>81</span><div><b>Thêm chiến thuật trước khi làm đề</b><small>Practice vẫn dùng Question Bank và Exam Engine P80</small></div><i>›</i></button>');
    global.document?.querySelectorAll?.('[data-p81-entry]')?.forEach((button) => { button.onclick = () => setView('topik-strategy-p81'); });
    global.document?.querySelectorAll?.('[data-p81-strategy]')?.forEach((button) => { button.onclick = () => { runtime.selectedId = button.dataset.p81Strategy; setView('topik-strategy-detail-p81'); }; });
    global.document?.querySelectorAll?.('[data-p81-practice]')?.forEach((button) => { button.onclick = () => { if (!P81StrategyPracticeService.start(button.dataset.p81Practice, 5)) toast('Chưa có câu P80 phù hợp.'); }; });
    const filter = global.document?.querySelector?.('[data-p81-filter-form]'); if (filter) filter.onsubmit = (event) => { event.preventDefault(); const values = new FormData(filter); runtime.query = clean(values.get('query'), 120); runtime.level = String(values.get('level') || 'all'); runtime.section = String(values.get('section') || 'all'); render(); };
    const writingForm = global.document?.querySelector?.('[data-p81-writing-check]'); if (writingForm) writingForm.onsubmit = (event) => { event.preventDefault(); const values = new FormData(writingForm); runtime.writingDraft = clean(values.get('draft'), 5000); runtime.writingChecks = P81WritingSelfCheckService.check(runtime.writingDraft, Object.fromEntries([...values.keys()].map((key) => [key, key === 'minimumLength' ? Number(values.get(key)) : values.has(key)]))); render(); };
    const aiWriting = global.document?.querySelector?.('[data-p81-ai-writing]'); if (aiWriting) aiWriting.onclick = async () => { runtime.aiBusy = true; render(); const prompt = `Phản hồi hỗ trợ cho bản nháp TOPIK Writing sau, dựa trên checklist structure/grammar/vocabulary/cohesion/logic. Không chấm như giám khảo thật, không hứa điểm. Bản nháp: ${runtime.writingDraft.slice(0, 2500)}`; try { runtime.aiWriting = clean(await global.AICoachService?.request?.(prompt, 'writing_review') || 'AI chưa sẵn sàng.', 8000); } catch (_) { runtime.aiWriting = 'AI tạm thời không khả dụng; checklist local vẫn dùng được.'; } runtime.aiBusy = false; render(); };
    global.document?.querySelectorAll?.('[data-p81-time-plan]')?.forEach((button) => { button.onclick = () => { runtime.timePlan = button.dataset.p81TimePlan; render(); }; });
    const timeForm = global.document?.querySelector?.('[data-p81-time-form]'); if (timeForm) timeForm.onsubmit = (event) => { event.preventDefault(); const values = Object.fromEntries(new FormData(timeForm).entries()); const custom = P81TimeManagementService.customize(runtime.timePlan, values); toast(`Kế hoạch cá nhân: ${custom.totalMinutes} phút. Không bắt buộc theo một công thức.`); };
    global.document?.querySelector?.('[data-p81-timer-start]')?.addEventListener('click', () => { const minutes = Number(global.document.querySelector('[data-p81-timer-minutes]')?.value || 10); P81TimeManagementService.start(minutes); render(); });
    global.document?.querySelector?.('[data-p81-timer-stop]')?.addEventListener('click', () => { P81TimeManagementService.stop(); render(); });
    global.document?.querySelectorAll?.('[data-p81-simulate]')?.forEach((button) => { button.onclick = () => P81ExamSimulationService.start(button.dataset.p81Simulate); });
    const goalForm = global.document?.querySelector?.('[data-p81-goal]'); if (goalForm) goalForm.onsubmit = (event) => { event.preventDefault(); P81GoalPlannerService.save(Object.fromEntries(new FormData(goalForm).entries())); toast('Đã cập nhật GoalTrackingService và Adaptive roadmap.'); render(); };
    global.document?.querySelectorAll?.('[data-p81-plan-days]')?.forEach((button) => { button.onclick = () => { runtime.goalWeeks = Number(button.dataset.p81PlanDays); render(); }; });
    const aiCoach = global.document?.querySelector?.('[data-p81-ai-coach]'); if (aiCoach) aiCoach.onclick = async () => { runtime.aiBusy = true; render(); const result = await P81TopikCoachService.explain(runtime.goalWeeks); runtime.aiDiagnosis = result.ai || 'AI chưa sẵn sàng; chẩn đoán local phía trên vẫn dựa trên evidence.'; runtime.aiBusy = false; render(); };
    global.document?.querySelectorAll?.('[data-p81-offline]')?.forEach((button) => { button.onclick = async () => { const result = await P81OfflineStrategyService.download(button.dataset.p81Offline); toast(result?.cached ? 'Đã cache Strategy Pack cho offline.' : 'Đã lưu pack; cache trình duyệt chưa sẵn sàng.'); render(); }; });
    if (runtime.timer.running) P81TimeManagementService.bind();
  };
  P81TopikStrategyConfigService.load();
})(window);
