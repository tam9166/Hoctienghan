/* Tiếng Hàn - TamHoanq · P73C real-user retention and Korean immersion */
(function buildRealUserRetention(global) {
  'use strict';
  const app = global.KLEARN_APP;
  // A cached route script can execute while the synchronous app bundle is still
  // finishing. Retry on the next task instead of marking the route as loaded
  // without registering its services.
  if (!app) { global.setTimeout?.(() => buildRealUserRetention(global), 0); return; }
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, PracticeService, LearnerProfileService, render, setView, toast, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.realUserRetention || 'klearn_real_user_retention';
  const ROUTES = new Set(['real-user-retention', 'learning-journey', 'real-korean-missions', 'real-korean-mission', 'conversation-memory', 'evidence-achievements', 'learning-reflection', 'monthly-learning-report']);
  const runtime = state.realUserRetentionRuntime || (state.realUserRetentionRuntime = { content: null, loading: false, error: '', scenarioId: null, listening: false });
  const now = () => new Date().toISOString();
  const time = (value) => new Date(value || 0).getTime() || 0;
  const clean = (value, limit = 800) => String(value ?? '').normalize('NFC').trim().slice(0, limit);
  const normalized = (value) => clean(value).toLocaleLowerCase().replace(/[\s.,!?;:'"“”‘’()[\]{}~-]+/g, '');
  const hasText = (answer, value) => normalized(answer).includes(normalized(value));
  const id = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const monthKey = (value = new Date()) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}`;
  const dateLabel = (value) => value ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : 'Đang tích lũy';
  const emptyStore = () => ({ schemaVersion: 1, milestones: [], missionAttempts: [], conversations: [], achievements: [], reflections: [], monthlyReports: [] });
  function readStore() {
    const value = userScoped(STORE_KEY)[0];
    if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyStore();
    const result = { ...emptyStore(), ...value };
    ['milestones', 'missionAttempts', 'conversations', 'achievements', 'reflections', 'monthlyReports'].forEach((field) => { result[field] = Array.isArray(result[field]) ? result[field] : []; });
    return result;
  }
  function writeStore(value) {
    const safe = { ...emptyStore(), ...value, schemaVersion: 1, updatedAt: now() };
    saveUserScoped(STORE_KEY, [safe], 1);
    return safe;
  }
  function updateStore(mutator) { const current = readStore(); return writeStore(mutator(current) || current); }

  const ContentService = {
    hydrate(value) {
      if (value?.verified !== true || value.reviewStatus !== 'approved' || !Array.isArray(value.scenarios) || value.scenarios.length !== 7 || !Array.isArray(value.missionTracks) || value.missionTracks.length !== 3) throw new Error('P73C content quality gate failed');
      const ids = new Set(value.scenarios.map((item) => item.id));
      if (ids.size !== 7 || value.scenarios.some((item) => !item.goal || !item.context || !item.dialogue || !item.speakingTask || !item.modelAnswer || !item.requiredSkills?.length || !item.vocabulary?.length || !item.grammar?.length) || value.missionTracks.some((item) => !ids.has(item.scenarioId))) throw new Error('P73C scenario schema invalid');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content;
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/real-user-retention.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P73C content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = error.message || 'Không tải được nội dung.'; return null; }).finally(() => { runtime.loading = false; if (ROUTES.has(state.currentView)) render(); });
      return runtime.loading;
    }
  };

  function progress() { return getUserProgress?.() || {}; }
  function srs() { return app.getUserSrs?.() || state.srsData || []; }
  function masteredWords() { return srs().filter((item) => item.status === 'mastered' || Number(item.mastery || 0) >= 85); }
  function practiceHistory() { return PracticeService?.getHistory?.() || []; }
  function foundationEvidence() {
    const foundation = progress().foundation || {};
    const learned = Array.isArray(foundation.learnedCharacters) ? foundation.learnedCharacters : [];
    return learned.length >= 5 ? { source: 'foundation-progress', learnedCharacters: learned.length, occurredAt: foundation.updatedAt || foundation.completedAt || now() } : null;
  }
  function conversationEvidence() {
    const own = readStore().missionAttempts.find((item) => item.completed && Number(item.score) >= 65);
    if (own) return { source: 'real-korean-mission', scenarioId: own.scenarioId, score: own.score, occurredAt: own.completedAt };
    const existing = global.ConversationHistoryService?.all?.().find((item) => Number(item.completedRuns || 0) > 0 && Number(item.averageScore || item.lastScore || 0) >= 60);
    return existing ? { source: 'conversation-history', scenarioId: existing.scenarioId, score: existing.lastScore || existing.averageScore, occurredAt: existing.lastPracticedAt || existing.updatedAt } : null;
  }
  function topikTwoEvidence() {
    const attempt = practiceHistory().find((item) => Number(item.percentage || item.score || 0) >= 60 && /topik\s*2|level[-_ ]?2|t2-/i.test(`${item.level || ''} ${item.setTitle || ''} ${item.setId || ''}`));
    return attempt ? { source: 'practice-history', attemptId: attempt.id || attempt.setId, score: Number(attempt.percentage || attempt.score), occurredAt: attempt.completedAt || attempt.createdAt } : null;
  }
  function masteredEvidence(target) {
    const items = masteredWords(); if (items.length < target) return null;
    const ordered = [...items].sort((a, b) => time(a.lastReviewed || a.updatedAt || a.createdAt) - time(b.lastReviewed || b.updatedAt || b.createdAt));
    const threshold = ordered[target - 1];
    return { source: 'srs-mastery', masteredVocabulary: items.length, threshold: target, occurredAt: threshold?.lastReviewed || threshold?.updatedAt || threshold?.createdAt || now() };
  }

  const LearningJourneyService = {
    definitions() {
      return [
        { id: 'journey-start', targetDay: 1, title: 'Bắt đầu hành trình', achievement: 'Ngày đầu tiên', evidence: () => state.currentUser?.createdAt ? { source: 'account-profile', occurredAt: state.currentUser.createdAt } : null },
        { id: 'hangul-reader', targetDay: 1, title: 'Đọc được Hangul', achievement: 'Hangul Starter', evidence: foundationEvidence },
        { id: 'vocabulary-500', targetDay: 30, title: 'Thành thạo 500 từ', achievement: '500 từ trong trí nhớ', evidence: () => masteredEvidence(500) },
        { id: 'basic-conversation', targetDay: 90, title: 'Hoàn thành hội thoại cơ bản', achievement: 'First Conversation', evidence: conversationEvidence },
        { id: 'topik-2-ready', targetDay: 180, title: 'Chứng minh năng lực TOPIK 2', achievement: 'TOPIK 2 Evidence', evidence: topikTwoEvidence }
      ];
    },
    refresh() {
      const saved = readStore().milestones; let changed = false;
      const items = this.definitions().map((definition) => {
        const existing = saved.find((item) => item.id === definition.id);
        if (existing) return { ...existing, targetDay: definition.targetDay };
        const evidence = definition.evidence();
        if (!evidence) return { id: definition.id, targetDay: definition.targetDay, title: definition.title, achievement: definition.achievement, reached: false, date: null, evidence: null };
        changed = true;
        return { id: definition.id, targetDay: definition.targetDay, title: definition.title, achievement: definition.achievement, reached: true, date: evidence.occurredAt || now(), evidence: { ...evidence, occurredAt: undefined }, createdAt: now(), updatedAt: now() };
      });
      if (changed) updateStore((value) => ({ ...value, milestones: items.filter((item) => item.reached) }));
      return items;
    },
    next() { return this.refresh().find((item) => !item.reached) || null; }
  };

  const EvidenceAchievementService = {
    definitions() {
      return [
        { id: 'hangul-starter', title: 'Hangul Starter', description: 'Đã học ít nhất 5 ký tự Hangul.', evidence: foundationEvidence },
        { id: 'first-conversation', title: 'First Conversation', description: 'Đã hoàn thành một tình huống giao tiếp với điểm đạt.', evidence: conversationEvidence },
        { id: 'vocabulary-builder-1000', title: 'Vocabulary Builder 1000', description: 'Đã mastery 1.000 từ theo SRS.', evidence: () => masteredEvidence(1000) }
      ];
    },
    refresh() {
      const saved = readStore().achievements; let changed = false;
      const items = this.definitions().map((definition) => {
        const existing = saved.find((item) => item.id === definition.id);
        if (existing) return existing;
        const evidence = definition.evidence();
        if (!evidence) return { id: definition.id, title: definition.title, description: definition.description, unlocked: false, evidence: null };
        changed = true;
        return { id: definition.id, title: definition.title, description: definition.description, unlocked: true, unlockedAt: evidence.occurredAt || now(), evidence: { ...evidence, occurredAt: undefined }, createdAt: now(), updatedAt: now() };
      });
      if (changed) updateStore((value) => ({ ...value, achievements: items.filter((item) => item.unlocked) }));
      return items;
    }
  };

  const RealKoreanMissionService = {
    all() { return runtime.content?.scenarios || []; },
    tracks() { return runtime.content?.missionTracks || []; },
    get(scenarioId) { return this.all().find((item) => item.id === scenarioId) || null; },
    history() { return readStore().missionAttempts; },
    historyFor(scenarioId) { return this.history().filter((item) => item.scenarioId === scenarioId); },
    recommended() {
      const level = Number(state.currentUser?.currentTopikLevel || 0); const target = level <= 1 ? 'beginner' : level <= 3 ? 'intermediate' : 'advanced';
      return [...this.all()].sort((a, b) => Number(a.level === target) - Number(b.level === target) || this.historyFor(b.id).length - this.historyFor(a.id).length).at(-1) || this.all()[0];
    },
    evaluate(scenario, submission) {
      const answer = clean(submission, 1200); if (!answer) return null;
      const matchedVocabulary = scenario.vocabulary.filter((word) => hasText(answer, word));
      const matchedKeywords = scenario.keywords.filter((word) => hasText(answer, word));
      const matchedGrammar = scenario.grammarPatterns.filter((pattern) => hasText(answer, pattern));
      const meaning = Math.round(matchedKeywords.length / Math.max(1, scenario.keywords.length) * 100);
      const languageUse = Math.round((matchedVocabulary.length + matchedGrammar.length) / Math.max(1, scenario.vocabulary.length + scenario.grammarPatterns.length) * 100);
      const completion = /[가-힯]/u.test(answer) && answer.length >= 5 ? 100 : 30;
      const score = Math.round(meaning * .55 + languageUse * .3 + completion * .15);
      const missingVocabulary = scenario.vocabulary.filter((word) => !matchedVocabulary.includes(word));
      const errors = scenario.grammarPatterns.filter((pattern) => !matchedGrammar.includes(pattern)).map((pattern) => `Chưa dùng mẫu ${pattern}`);
      if (meaning < 60) errors.unshift('Chưa truyền đủ ý chính của tình huống');
      return { score, meaning, languageUse, completion, matchedVocabulary, missingVocabulary, errors, suggestion: scenario.modelAnswer, completed: score >= 65 };
    },
    submit(scenarioId, submission, mode = 'text') {
      const scenario = this.get(scenarioId); const evaluation = scenario && this.evaluate(scenario, submission); if (!evaluation) return null;
      const attempt = { id: id('mission'), scenarioId, title: scenario.title, level: scenario.level, submission: clean(submission, 1200), inputMode: mode === 'voice' ? 'voice-transcript' : 'text', ...evaluation, completedAt: now(), createdAt: now(), updatedAt: now() };
      updateStore((value) => ({ ...value, missionAttempts: [attempt, ...value.missionAttempts].slice(0, 300) }));
      ConversationMemoryService.record(scenario, attempt);
      if (attempt.score < 65 || attempt.errors.length) global.ErrorNotebookService?.add?.({ type: 'real-korean-mission', question: scenario.dialogue, mistake: attempt.submission, correction: attempt.suggestion, explanation: attempt.errors.join('. ') || 'Hãy thử lại với từ vựng mục tiêu.' });
      global.LongTermLearningMemoryService?.record?.({ type: attempt.completed ? 'milestone' : 'weakness_snapshot', title: attempt.completed ? `Tình huống: ${scenario.title}` : `Cần luyện: ${scenario.title}`, summary: attempt.completed ? `Hoàn thành với ${attempt.score}/100.` : `Cần bổ sung ${attempt.missingVocabulary.length} từ mục tiêu.`, signature: `p73c-mission:${attempt.id}`, source: 'real-korean-mission', signal: { scenarioId, score: attempt.score, missingVocabulary: attempt.missingVocabulary, errorTags: attempt.errors } });
      LearningJourneyService.refresh(); EvidenceAchievementService.refresh();
      return attempt;
    }
  };

  const ConversationMemoryService = {
    all() { return readStore().conversations; },
    record(scenario, attempt) {
      const item = { id: id('conversation-memory'), scenarioId: scenario.id, title: scenario.title, said: attempt.submission, score: attempt.score, errors: attempt.errors, missingVocabulary: attempt.missingVocabulary, completed: attempt.completed, occurredAt: attempt.completedAt, createdAt: now(), updatedAt: now() };
      updateStore((value) => ({ ...value, conversations: [item, ...value.conversations].slice(0, 300) }));
      return item;
    },
    summary() { const items = this.all(); const vocabulary = items.flatMap((item) => item.missingVocabulary || []); const counts = vocabulary.reduce((out, word) => ({ ...out, [word]: Number(out[word] || 0) + 1 }), {}); return { attempts: items.length, completed: items.filter((item) => item.completed).length, commonMissingVocabulary: Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 8) }; }
  };

  const LearningReflectionService = {
    all() { return readStore().reflections; },
    save(input = {}) {
      const goal = clean(input.goal, 500); const difficulty = clean(input.difficulty, 800); const achievement = clean(input.achievement, 800); if (!goal || !difficulty || !achievement) return null;
      const entry = { id: id('reflection'), month: monthKey(), goal, difficulty, achievement, createdAt: now(), updatedAt: now() };
      updateStore((value) => ({ ...value, reflections: [entry, ...value.reflections].slice(0, 120) }));
      global.LearningJournalService?.add?.({ learned: achievement, difficulty, nextGoal: goal });
      return entry;
    }
  };

  function monthlySkillDelta(start) {
    const records = global.LongTermLearningMemoryService?.records?.('improvement_snapshot') || [];
    const inMonth = records.filter((item) => time(item.occurredAt) >= start.getTime()).sort((a, b) => time(a.occurredAt) - time(b.occurredAt));
    if (inMonth.length < 2) return null;
    const first = inMonth[0].signal?.skillScores || {}; const last = inMonth.at(-1).signal?.skillScores || {};
    return Object.fromEntries(['vocabulary', 'grammar', 'listening', 'speaking', 'reading', 'writing'].map((skill) => [skill, Number(last[skill] || 0) - Number(first[skill] || 0)]));
  }
  const MonthlyLearningReportService = {
    all() { return readStore().monthlyReports; },
    generate(reference = new Date()) {
      const start = new Date(reference.getFullYear(), reference.getMonth(), 1); const end = new Date(reference.getFullYear(), reference.getMonth() + 1, 1);
      const events = global.LearningActivityService?.between?.(start, end) || [];
      const summary = global.LearningActivityService?.summarize?.(events) || { minutes: 0, sessions: 0, activeDays: 0 };
      const newWords = srs().filter((item) => { const first = time(item.createdAt || item.firstReviewedAt); return first >= start.getTime() && first < end.getTime(); }).length;
      const profile = LearnerProfileService?.get?.() || {};
      return { id: `monthly-${monthKey(reference)}`, month: monthKey(reference), minutes: summary.minutes, sessions: summary.sessions, activeDays: summary.activeDays, skillDeltas: monthlySkillDelta(start), newWords, improvementPoint: profile.weakSkills?.[0] || null, generatedAt: now(), evidence: { activitySource: events.length ? 'learning-activity-events' : 'insufficient-data', skillSource: monthlySkillDelta(start) ? 'memory-snapshots' : 'insufficient-data', vocabularySource: 'srs-created-date' } };
    },
    save(reference = new Date()) { const report = this.generate(reference); updateStore((value) => ({ ...value, monthlyReports: [report, ...value.monthlyReports.filter((item) => item.id !== report.id)].slice(0, 36) })); return report; },
    current() { return this.all().find((item) => item.id === `monthly-${monthKey()}`) || this.generate(); }
  };

  const ReturnLoopService = {
    recommend() {
      const due = global.VocabularyService?.dueCards?.().length || srs().filter((item) => item.nextReview && time(item.nextReview) <= Date.now()).length;
      if (due) return { type: 'weakness', title: `Ôn ${Math.min(due, 10)} từ đang đến hạn`, reason: 'SRS cho thấy nhóm từ này cần được gợi nhớ lại.', route: 'review', minutes: 5 };
      const lesson = Object.entries(progress().lessonProgress || {}).find(([, value]) => value && !value.completed && Number(value.progress || value.percent || 0) > 0);
      if (lesson) return { type: 'lesson', title: 'Tiếp tục bài đang học', reason: `Tiến trình ${clean(lesson[0], 80)} vẫn được giữ nguyên.`, route: 'lessons', minutes: 5 };
      const scenario = runtime.content ? RealKoreanMissionService.recommended() : null;
      if (scenario) return { type: 'mission', title: `Thử tình huống: ${scenario.title}`, reason: 'Một nhiệm vụ đời thật ngắn để dùng kiến thức đã học.', route: 'real-korean-missions', minutes: 5 };
      return { type: 'journey', title: 'Tiếp tục một bước nhỏ', reason: 'Hành trình của bạn được giữ nguyên; không cần học bù.', route: 'real-user-retention', minutes: 5 };
    }
  };

  const esc = (value) => escapeHtml(value == null ? '' : String(value));
  const heading = (back, eyebrow, title, subtitle) => `<section class="p73c-heading section"><button class="back-link" data-view="${back}">← Quay lại</button><p class="eyebrow">${esc(eyebrow)}</p><h1 class="headline">${esc(title)}</h1><p>${esc(subtitle)}</p></section>`;
  const loading = () => `<section class="card section empty-state"><h2>Đang chuẩn bị trải nghiệm…</h2><p>${esc(runtime.error || 'Nội dung tình huống chỉ tải khi bạn mở khu vực này.')}</p></section>`;
  function hubView() {
    if (!runtime.content) return loading(); const next = ReturnLoopService.recommend(); const journey = LearningJourneyService.refresh(); const achievement = EvidenceAchievementService.refresh(); const memory = ConversationMemoryService.summary();
    return `${heading('home', 'P73C · HÀNH TRÌNH THỰC TẾ', 'Học để dùng được tiếng Hàn', 'Mỗi lần quay lại, bạn chỉ cần một bước rõ ràng.')}
      <section class="p73c-next section"><div><small>BƯỚC TIẾP THEO</small><h2>${esc(next.title)}</h2><p>${esc(next.reason)}</p></div><button class="btn primary" data-view="${next.route}">Bắt đầu ${next.minutes} phút</button></section>
      <section class="p73c-hub-grid section"><button data-view="learning-journey"><span>${journey.filter((item) => item.reached).length}/${journey.length}</span><b>Learning Journey</b><small>Cột mốc có bằng chứng</small></button><button data-view="real-korean-missions"><span>7</span><b>Real Korean Mission</b><small>Tình huống đời thật</small></button><button data-view="conversation-memory"><span>${memory.attempts}</span><b>Bộ nhớ hội thoại</b><small>Lỗi và từ còn thiếu</small></button><button data-view="evidence-achievements"><span>${achievement.filter((item) => item.unlocked).length}</span><b>Thành tựu</b><small>Không dùng XP</small></button><button data-view="learning-reflection"><span>✎</span><b>Phản tư học tập</b><small>Mục tiêu · khó khăn · thành quả</small></button><button data-view="monthly-learning-report"><span>30</span><b>Báo cáo tháng</b><small>Kết quả từ dữ liệu thật</small></button></section>`;
  }
  function journeyView() {
    const items = LearningJourneyService.refresh(); const next = items.find((item) => !item.reached);
    return `${heading('real-user-retention', 'LEARNING JOURNEY', 'Câu chuyện tiến bộ của bạn', 'Mỗi mốc chỉ xuất hiện khi có evidence từ dữ liệu học.')}
      <ol class="p73c-timeline section">${items.map((item) => `<li class="${item.reached ? 'reached' : ''}"><span>${item.reached ? '✓' : '·'}</span><div><small>${item.reached ? dateLabel(item.date) : 'Chưa đủ bằng chứng'} · mốc tham chiếu ngày ${item.targetDay}</small><h2>${esc(item.title)}</h2><p>${item.reached ? `${esc(item.achievement)} · ${esc(item.evidence?.source || '')}` : 'Mốc này sẽ tự ghi nhận khi bạn đạt tiêu chí, không tự mở theo số ngày.'}</p></div></li>`).join('')}</ol>
      ${next ? `<p class="p73c-note section">Tiếp theo: <b>${esc(next.title)}</b>. Không có hard lock và không cần học bù.</p>` : ''}`;
  }
  function missionsView() {
    if (!runtime.content) return loading(); const recommended = RealKoreanMissionService.recommended();
    return `${heading('real-user-retention', 'REAL KOREAN MISSION', 'Dùng tiếng Hàn trong đời thật', 'Tách biệt Daily Mission: mỗi nhiệm vụ có bối cảnh, bài nộp và phản hồi.')}
      <section class="p73c-mission-tracks section" aria-label="Lộ trình nhiệm vụ mẫu">${RealKoreanMissionService.tracks().map((track) => `<article><small>${esc(track.level)}</small><b>${esc(track.title)}</b><span>${esc(track.goal)}</span></article>`).join('')}</section>
      <section class="p73c-scenarios section">${RealKoreanMissionService.all().map((scenario) => { const history = RealKoreanMissionService.historyFor(scenario.id); const best = Math.max(0, ...history.map((item) => item.score)); return `<article class="${scenario.id === recommended?.id ? 'recommended' : ''}"><div><span>${esc(scenario.level)}</span>${scenario.id === recommended?.id ? '<em>Gợi ý</em>' : ''}</div><h2>${esc(scenario.title)}</h2><p>${esc(scenario.context)}</p><small>${scenario.vocabulary.length} từ · ${scenario.grammar.length} mẫu · ${history.length ? `cao nhất ${best}/100` : 'chưa luyện'}</small><button class="btn secondary full" data-p73c-scenario="${esc(scenario.id)}">${history.length ? 'Luyện lại' : 'Mở tình huống'}</button></article>`; }).join('')}</section>`;
  }
  function missionView() {
    if (!runtime.content) return loading(); const scenario = RealKoreanMissionService.get(runtime.scenarioId) || RealKoreanMissionService.recommended(); if (!scenario) return loading(); runtime.scenarioId = scenario.id; const latest = RealKoreanMissionService.historyFor(scenario.id)[0]; const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    return `${heading('real-korean-missions', `REAL MISSION · ${scenario.level.toUpperCase()}`, scenario.title, scenario.context)}
      <section class="p73c-mission section"><div class="p73c-mission-goal"><small>MỤC TIÊU</small><b>${esc(scenario.goal)}</b><span>Kỹ năng: ${scenario.requiredSkills.map(esc).join(' · ')}</span></div><div class="p73c-mission-brief"><article><small>ĐỐI TÁC NÓI</small><p lang="ko">${esc(scenario.dialogue)}</p><button class="audio-btn" data-speak="${esc(scenario.dialogue)}">🔊 Nghe</button></article><article><small>NHIỆM VỤ</small><p>${esc(scenario.speakingTask)}</p></article></div><div class="p73c-targets"><div><b>Từ mục tiêu</b><p>${scenario.vocabulary.map((item) => `<span lang="ko">${esc(item)}</span>`).join('')}</p></div><div><b>Mẫu câu</b><p>${scenario.grammar.map((item) => `<span lang="ko">${esc(item)}</span>`).join('')}</p></div></div>
      <form id="p73cMissionForm"><label for="p73cSubmission">Bạn trả lời bằng tiếng Hàn</label><textarea id="p73cSubmission" name="submission" lang="ko" maxlength="1200" rows="5" required placeholder="Nhập hoặc nói câu trả lời…"></textarea><div><button class="btn secondary" type="button" data-p73c-voice ${Recognition ? '' : 'disabled'}>${Recognition ? '🎙 Nói câu trả lời' : 'Micro không hỗ trợ · dùng text'}</button><button class="btn primary" type="submit">Nhận phản hồi</button></div><small>Voice chỉ chuyển thành text; app không lưu audio.</small></form>
      ${latest ? `<section class="p73c-feedback ${latest.completed ? 'passed' : ''}" aria-live="polite"><div><strong>${latest.score}</strong><span>/100</span></div><div><h3>${latest.completed ? 'Đã truyền đủ ý' : 'Hãy thử thêm một lần'}</h3><p>${latest.errors.length ? esc(latest.errors.join('. ')) : 'Bạn đã dùng đúng các ý chính trong tình huống.'}</p><small>Cách nói gợi ý</small><b lang="ko">${esc(latest.suggestion)}</b></div></section>` : ''}</section>`;
  }
  function memoryView() {
    const items = ConversationMemoryService.all(); const summary = ConversationMemoryService.summary();
    return `${heading('real-user-retention', 'CONVERSATION MEMORY', 'Bộ nhớ hội thoại', 'Ghi lại câu bạn đã nói, lỗi và từ còn thiếu; không lưu audio.')}
      <section class="p73c-summary section"><article><b>${summary.attempts}</b><small>Lượt nói</small></article><article><b>${summary.completed}</b><small>Tình huống đạt</small></article><article><b>${summary.commonMissingVocabulary.length}</b><small>Từ cần bổ sung</small></article></section>
      ${summary.commonMissingVocabulary.length ? `<section class="p73c-note section"><b>Từ thường thiếu:</b> ${summary.commonMissingVocabulary.map(([word, count]) => `<span lang="ko">${esc(word)} ×${count}</span>`).join(' ')}</section>` : ''}
      <section class="p73c-memory-list section">${items.length ? items.map((item) => `<article><header><span>${dateLabel(item.occurredAt)}</span><b>${esc(item.title)}</b><em>${item.score}/100</em></header><p lang="ko">${esc(item.said)}</p>${item.errors?.length ? `<small>Cần sửa: ${esc(item.errors.join(' · '))}</small>` : '<small>✓ Đã đạt mục tiêu tình huống</small>'}</article>`).join('') : '<article class="empty-state"><h2>Chưa có lượt hội thoại</h2><p>Hoàn thành một Real Korean Mission để tạo bằng chứng đầu tiên.</p><button class="btn primary" data-view="real-korean-missions">Mở nhiệm vụ</button></article>'}</section>`;
  }
  function achievementsView() {
    const items = EvidenceAchievementService.refresh();
    return `${heading('real-user-retention', 'EVIDENCE ACHIEVEMENTS', 'Thành tựu học tập thật', 'Achievement được mở bằng mastery hoặc completion evidence, tuyệt đối không bằng XP.')}<section class="p73c-achievements section">${items.map((item) => `<article class="${item.unlocked ? 'unlocked' : 'locked'}"><span>${item.unlocked ? '🏅' : '○'}</span><div><small>${item.unlocked ? dateLabel(item.unlockedAt) : 'Chưa đủ bằng chứng'}</small><h2>${esc(item.title)}</h2><p>${esc(item.description)}</p>${item.unlocked ? `<em>${esc(item.evidence?.source || '')}</em>` : ''}</div></article>`).join('')}</section>`;
  }
  function reflectionView() {
    const entries = LearningReflectionService.all();
    return `${heading('real-user-retention', 'LEARNING REFLECTION', 'Nhìn lại để học có chủ đích', 'Ba câu ngắn về mục tiêu, khó khăn và điều bạn đã làm được.')}<form id="p73cReflectionForm" class="p73c-reflection section"><label>Mục tiêu tiếp theo<textarea name="goal" maxlength="500" required placeholder="Ví dụ: Tự gọi món bằng tiếng Hàn"></textarea></label><label>Khó khăn hiện tại<textarea name="difficulty" maxlength="800" required placeholder="Ví dụ: Tôi chưa nghe kịp đuôi câu"></textarea></label><label>Điều bạn đã làm được<textarea name="achievement" maxlength="800" required placeholder="Ví dụ: Tôi đã đọc trọn một đoạn ngắn"></textarea></label><p>🔒 Nội dung này thuộc tài khoản của bạn.</p><button class="btn primary" type="submit">Lưu phản tư</button></form>${entries.length ? `<section class="p73c-reflection-list section">${entries.slice(0, 6).map((item) => `<article><small>${dateLabel(item.createdAt)}</small><h3>${esc(item.goal)}</h3><p><b>Khó:</b> ${esc(item.difficulty)}</p><p><b>Đã làm được:</b> ${esc(item.achievement)}</p></article>`).join('')}</section>` : ''}`;
  }
  function reportView() {
    const report = MonthlyLearningReportService.current(); const deltas = report.skillDeltas;
    return `${heading('real-user-retention', 'MONTHLY LEARNING REPORT', `Báo cáo tháng ${report.month}`, 'Kết quả phản ánh activity, SRS và memory snapshot hiện có; thiếu bằng chứng sẽ hiển thị rõ.')}<section class="p73c-report section"><div class="p73c-summary"><article><b>${report.minutes}</b><small>Phút học</small></article><article><b>${report.activeDays}</b><small>Ngày có học</small></article><article><b>${report.newWords}</b><small>Từ mới có timestamp</small></article></div><article class="p73c-report-skills"><h2>Thay đổi kỹ năng</h2>${deltas ? Object.entries(deltas).map(([skill, delta]) => `<div><span>${esc(skill)}</span><b>${delta > 0 ? '+' : ''}${delta}%</b></div>`).join('') : '<p>Chưa có ít nhất 2 memory snapshot trong tháng; app không tự tạo phần trăm.</p>'}</article><article class="p73c-report-focus"><small>ĐIỂM CẦN CẢI THIỆN</small><h2>${esc(report.improvementPoint || 'Chưa đủ bằng chứng')}</h2><p>Nguồn: ${esc(report.evidence.activitySource)} · ${esc(report.evidence.skillSource)} · ${esc(report.evidence.vocabularySource)}</p></article><button class="btn primary" data-p73c-save-report>Lưu báo cáo tháng</button></section>`;
  }
  function homeCard() {
    const recommendation = ReturnLoopService.recommend();
    return `<section class="p73c-home-return" data-p73c-home><div><small>TIẾP TỤC HÀNH TRÌNH</small><h2>${esc(recommendation.title)}</h2><p>${esc(recommendation.reason)} Chỉ ${recommendation.minutes} phút cũng đủ cho hôm nay.</p></div><button class="btn secondary" data-view="${recommendation.route}">Học tiếp</button></section>`;
  }

  Object.assign(global, { RealUserRetentionContentService: ContentService, LearningJourneyService, RealKoreanMissionService, ConversationMemoryService, EvidenceAchievementService, LearningReflectionService, MonthlyLearningReportService, ReturnLoopService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'real-user-retention': hubView, 'learning-journey': journeyView, 'real-korean-missions': missionsView, 'real-korean-mission': missionView, 'conversation-memory': memoryView, 'evidence-achievements': achievementsView, 'learning-reflection': reflectionView, 'monthly-learning-report': reportView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (ROUTES.has(state.currentView)) ContentService.load();
    if (state.currentView !== 'home') document.querySelector('[data-p73c-home]')?.remove();
    if (state.currentView === 'home' && !document.querySelector('[data-p73c-home]')) {
      const root = document.getElementById('app'); const anchor = document.querySelector('.ux-today-strip, .daily-start-panel, .dashboard-hero');
      if (anchor) anchor.insertAdjacentHTML('afterend', homeCard()); else root?.insertAdjacentHTML('beforeend', homeCard());
    }
    document.querySelectorAll('[data-p73c-home] [data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
    document.querySelectorAll('[data-p73c-scenario]').forEach((button) => { button.onclick = () => { runtime.scenarioId = button.dataset.p73cScenario; setView('real-korean-mission'); }; });
    const form = document.getElementById('p73cMissionForm'); if (form) form.onsubmit = (event) => { event.preventDefault(); const submission = new FormData(form).get('submission'); const result = RealKoreanMissionService.submit(runtime.scenarioId, submission, form.dataset.inputMode || 'text'); if (!result) return toast('Hãy nhập câu trả lời bằng tiếng Hàn.'); toast(result.completed ? 'Đã hoàn thành tình huống.' : 'Phản hồi đã sẵn sàng. Bạn có thể thử lại.'); render(); };
    const voice = document.querySelector('[data-p73c-voice]'); if (voice) voice.onclick = () => {
      const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition; const input = document.getElementById('p73cSubmission'); if (!Recognition || !input) return toast('Thiết bị chưa hỗ trợ micro. Bạn vẫn có thể dùng text.');
      const recognition = new Recognition(); recognition.lang = 'ko-KR'; recognition.interimResults = false; voice.disabled = true; voice.textContent = 'Đang nghe…';
      recognition.onresult = (event) => { input.value = event.results[0][0].transcript; form.dataset.inputMode = 'voice'; };
      recognition.onerror = () => toast('Không nhận được giọng nói. Hãy tiếp tục bằng text.');
      recognition.onend = () => { voice.disabled = false; voice.textContent = '🎙 Nói câu trả lời'; }; try { recognition.start(); } catch (_) { recognition.onend(); toast('Không thể mở micro. Hãy dùng text.'); }
    };
    const reflection = document.getElementById('p73cReflectionForm'); if (reflection) reflection.onsubmit = (event) => { event.preventDefault(); const values = new FormData(reflection); const saved = LearningReflectionService.save({ goal: values.get('goal'), difficulty: values.get('difficulty'), achievement: values.get('achievement') }); if (!saved) return toast('Hãy trả lời đủ ba câu phản tư.'); toast('Đã lưu phản tư học tập.'); render(); };
    document.querySelector('[data-p73c-save-report]')?.addEventListener('click', () => { MonthlyLearningReportService.save(); toast('Đã lưu báo cáo tháng từ dữ liệu hiện có.'); render(); });
  };
  // Route assets may finish immediately after the base view rendered. Decorate
  // that existing view once so Home receives its return-loop card on first load.
  if (global.document?.getElementById?.('app')) global.setTimeout?.(() => global.KLEARN_AFTER_RENDER?.(), 0);
})(window);
