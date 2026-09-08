/* P54 demo/presentation mode. Sample records live only under demo-p54. */
(() => {
  'use strict';
  const app = window.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, auth, createSessionRecord, getUserSrs, escapeHtml, setView, render, toast, CloudSyncService, CloudAccountService } = app;
  const DEMO_ID = 'demo-p54';
  const STORE_KEY = STORAGE_KEYS.productDemo || 'klearn_product_demo';
  const routes = new Set(['demo', 'demo-center', 'home', 'lessons', 'review', 'ai-coach', 'analytics', 'learning-outcomes', 'topik']);
  const fallback = {
    version: 1, verified: true,
    account: { id: DEMO_ID, fullName: 'Minh Anh · Demo', email: 'demo@tamhoanq.local', level: 'TOPIK I', goal: 'topik' },
    flow: [
      { id: 'home', label: 'Home', view: 'home', message: 'Kế hoạch hôm nay và hành động tiếp theo' },
      { id: 'learning', label: 'Learning', view: 'lessons', message: 'Lộ trình bài học và dữ liệu tiến độ' },
      { id: 'ai', label: 'Trợ lý học tập', view: 'ai-coach', message: 'Gợi ý dựa trên hồ sơ' },
      { id: 'analytics', label: 'Analytics', view: 'analytics', message: 'Kết quả và bằng chứng tiến bộ' }
    ],
    showcase: [], sample: { lessonsCompleted: 18, learningDays: 24, streak: 7, wordsLearned: 126, skills: { vocabulary: 78, grammar: 69, listening: 61, speaking: 66, reading: 74, writing: 58 } },
    privacy: { isolatedUserId: DEMO_ID, cloudSync: false, changesRealUsers: false, storesCredentials: false }
  };
  let content = fallback;
  let contentLoaded = false;
  let contentPromise = null;
  const now = () => new Date().toISOString();
  const daysAgo = (days) => new Date(Date.now() - days * 86400000).toISOString();
  const readStore = () => { const value = storage.get(STORE_KEY, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; };
  const writeStore = (changes) => { const next = { ...readStore(), ...changes, version: 1, updatedAt: now() }; storage.set(STORE_KEY, next); return next; };
  const readMap = (key) => { const value = storage.get(key, {}); return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; };
  const putDemo = (key, value) => storage.set(key, { ...readMap(key), [DEMO_ID]: value });
  const removeDemo = (key) => { const value = { ...readMap(key) }; delete value[DEMO_ID]; storage.set(key, value); };
  const seededKeys = () => [STORAGE_KEYS.progress, STORAGE_KEYS.srs, STORAGE_KEYS.practiceHistory, STORAGE_KEYS.errors, STORAGE_KEYS.achievements, STORAGE_KEYS.milestones, STORAGE_KEYS.learningOutcomes, STORAGE_KEYS.learnerProfile];

  const DemoContentService = {
    get() { return content; },
    hydrate(value) { if (value?.verified === true && value?.privacy?.isolatedUserId === DEMO_ID) content = value; contentLoaded = true; return content; },
    async load() { if (contentPromise) return contentPromise; contentPromise = (async () => { try { const response = await fetch('content/product-demo.json'); if (!response.ok) throw new Error('demo content unavailable'); this.hydrate(await response.json()); } catch (_) { contentLoaded = true; /* The embedded verified fallback keeps demo usable offline. */ } if (routes.has(state.currentView)) render(); return content; })(); return contentPromise; }
  };

  function sampleProgress() {
    const sample = content.sample || fallback.sample;
    const lessonIds = (window.KLEARN_THEORY_LESSONS || []).slice(0, 6).map((item, index) => [item.id, { status: index < 4 ? 'completed' : 'in_progress', completed: index < 4, score: 72 + index * 3, completedAt: index < 4 ? daysAgo(12 - index * 2) : null, updatedAt: daysAgo(index + 1) }]);
    return {
      daily: { date: now().slice(0, 10), tasks: { vocabulary: true, lesson: true, practice: false, listening: true, speaking: false, writing: false } },
      lessonProgress: Object.fromEntries(lessonIds),
      stats: { lessonsCompleted: sample.lessonsCompleted, learningDays: sample.learningDays, streak: sample.streak, wordsLearned: sample.wordsLearned },
      skills: { ...sample.skills },
      pronunciationAttempts: [{ transcript: '안녕하세요', score: 82, createdAt: daysAgo(2) }, { transcript: '저는 학생이에요', score: 76, createdAt: daysAgo(6) }],
      writingSubmissions: [{ id: 'demo-writing-1', answer: '저는 학생이에요.', score: 78, createdAt: daysAgo(4) }],
      foundation: { learnedCharacters: ['ㅏ', 'ㅓ', 'ㅗ', 'ㅜ', 'ㄱ', 'ㄴ', 'ㄷ', 'ㅁ'], completedActivities: ['vowels-basic', 'consonants-basic', 'syllable-가'], firstWords: ['나라', '학교', '친구'], checkpoint: { score: 82, passed: true }, updatedAt: daysAgo(20) },
      mockTests: [{ title: 'TOPIK I · Đề mẫu', date: daysAgo(8).slice(0, 10), score: '142/200' }, { title: 'Luyện nghe TOPIK I', date: daysAgo(3).slice(0, 10), score: '76/100' }]
    };
  }

  function sampleHistory() {
    return [
      { id: 'demo-attempt-4', setId: 't1-listening-demo', setTitle: 'Nghe TOPIK I', level: 'TOPIK_1', completedAt: daysAgo(2), durationSeconds: 640, score: 8, total: 10, percentage: 80, skillBreakdown: { listening: 80 }, topicBreakdown: { conversation: 80 } },
      { id: 'demo-attempt-3', setId: 't1-grammar-demo', setTitle: 'Ngữ pháp cơ bản', level: 'TOPIK_1', completedAt: daysAgo(5), durationSeconds: 510, score: 7, total: 10, percentage: 70, skillBreakdown: { grammar: 70 }, topicBreakdown: { particles: 60 } },
      { id: 'demo-attempt-2', setId: 't1-reading-demo', setTitle: 'Đọc hiểu ngắn', level: 'TOPIK_1', completedAt: daysAgo(9), durationSeconds: 720, score: 8, total: 10, percentage: 80, skillBreakdown: { reading: 80 }, topicBreakdown: { daily_life: 80 } },
      { id: 'demo-attempt-1', setId: 'foundation-checkpoint', setTitle: 'Checkpoint Hangul', level: 'LEVEL_0', completedAt: daysAgo(22), durationSeconds: 420, score: 9, total: 10, percentage: 90, skillBreakdown: { reading: 90, listening: 80 }, topicBreakdown: { hangul: 90 } }
    ];
  }

  const SampleLearningDataService = {
    seed() {
      putDemo(STORAGE_KEYS.progress, sampleProgress());
      putDemo(STORAGE_KEYS.practiceHistory, sampleHistory());
      putDemo(STORAGE_KEYS.errors, [{ id: 'demo-error-1', type: 'grammar', question: '저__ 학생이에요.', mistake: '이', correction: '는', explanation: 'Chủ đề giới thiệu bản thân dùng 은/는.', count: 2, resolved: false, createdAt: daysAgo(5), lastSeen: daysAgo(2) }]);
      putDemo(STORAGE_KEYS.achievements, [{ id: 'demo-achievement-hangul', title: 'Đọc Hangul đầu tiên', reachedAt: daysAgo(22), verified: true }, { id: 'demo-achievement-streak', title: '7 ngày học liên tục', reachedAt: daysAgo(1), verified: true }]);
      putDemo(STORAGE_KEYS.milestones, [{ id: 'demo-milestone-100', title: '100 từ đầu tiên', achievedAt: daysAgo(4), verified: true }]);
      putDemo(STORAGE_KEYS.learningOutcomes, [{ version: 1, baselines: {}, evidence: [{ key: 'first-hangul', title: 'Đọc được Hangul đầu tiên', achievedAt: daysAgo(22) }], snapshots: [], updatedAt: now() }]);
      return { userId: DEMO_ID, isolated: true };
    },
    decorateSrs() {
      const cards = (getUserSrs?.() || []).map((card, index) => index < 12 ? { ...card, status: index < 5 ? 'mastered' : 'review', mastery: index < 5 ? 92 - index : 76 - index, reviewCount: 3 + (index % 3), correctCount: 3 + (index % 2), wrongCount: index % 3 === 0 ? 1 : 0, lastReviewed: daysAgo(index + 1), nextReview: index > 8 ? daysAgo(1) : new Date(Date.now() + (index + 1) * 86400000).toISOString() } : card);
      putDemo(STORAGE_KEYS.srs, cards); state.srsData = cards; return cards;
    },
    clear() { [...new Set([...seededKeys(), ...Object.values(STORAGE_KEYS)])].filter((key) => key && ![STORAGE_KEYS.users, STORAGE_KEYS.session, STORE_KEY, STORAGE_KEYS.settings].includes(key)).forEach(removeDemo); const settings = readMap(STORAGE_KEYS.settings); if (settings.users && typeof settings.users === 'object') { const users = { ...settings.users }; delete users[DEMO_ID]; storage.set(STORAGE_KEYS.settings, { ...settings, users }); } }
  };

  const PresentationModeService = {
    enabled() { return readStore().presentationMode !== false; },
    apply(enabled = this.enabled()) { document.documentElement.dataset.presentationMode = enabled ? 'true' : 'false'; return enabled; },
    set(enabled) { writeStore({ presentationMode: Boolean(enabled) }); this.apply(Boolean(enabled)); render(); }
  };

  const DemoAccountService = {
    active() { return state.currentUser?.id === DEMO_ID && state.currentUser?.isDemo === true; },
    activate() {
      const existing = readStore(); const previousSession = existing.active ? existing.previousSession : storage.get(STORAGE_KEYS.session, null); const previousView = existing.active ? existing.previousView : state.currentView; const previousCloudUser = existing.active ? existing.previousCloudUser : state.cloudUser;
      const account = content.account || fallback.account; const users = storage.get(STORAGE_KEYS.users, []); const safeUsers = Array.isArray(users) ? users.filter((item) => item?.id !== DEMO_ID) : [];
      safeUsers.push({ id: DEMO_ID, fullName: account.fullName, email: account.email, avatar: 'MA', goals: [account.goal || 'topik'], level: account.level || 'TOPIK I', currentTopikLevel: 1, targetTopikLevel: 2, learningTrack: 'topik', learningStyle: 'visual', learningMode: 'topik', explanationStyle: 'step-by-step', studyMinutesPerDay: 20, onboardingCompleted: true, onboardingStep: 'complete', placement: { index: 0, answers: [], score: 8 }, isDemo: true, cloudUserId: null, createdAt: daysAgo(24), updatedAt: now() });
      storage.set(STORAGE_KEYS.users, safeUsers); SampleLearningDataService.seed(); storage.set(STORAGE_KEYS.session, createSessionRecord(DEMO_ID, { demo: true })); state.cloudUser = null; if (CloudSyncService) { CloudSyncService.provider = null; CloudSyncService.setStatus?.('local'); } auth.restoreSession(); state.selectedGoals = [account.goal || 'topik']; state.selectedLevel = account.level || 'TOPIK I'; SampleLearningDataService.decorateSrs(); writeStore({ active: true, presentationMode: true, previousSession, previousView, previousCloudUser, activatedAt: now() }); PresentationModeService.apply(true); setView('home'); return state.currentUser;
    },
    reset() { if (!this.active()) return this.activate(); SampleLearningDataService.seed(); SampleLearningDataService.decorateSrs(); writeStore({ resetAt: now() }); render(); return true; },
    exit() {
      const demo = readStore(); SampleLearningDataService.clear(); const users = storage.get(STORAGE_KEYS.users, []); storage.set(STORAGE_KEYS.users, Array.isArray(users) ? users.filter((item) => item?.id !== DEMO_ID) : []); writeStore({ active: false, presentationMode: false, previousSession: null, previousCloudUser: null, exitedAt: now() }); delete document.documentElement.dataset.presentationMode; state.currentUser = null; state.cloudUser = demo.previousCloudUser || null;
      if (demo.previousSession?.userId) storage.set(STORAGE_KEYS.session, demo.previousSession); else storage.remove(STORAGE_KEYS.session);
      const restored = auth.restoreSession(); state.selectedGoals = [...(restored?.goals || [])]; state.selectedLevel = restored?.level || ''; if (restored) CloudAccountService?.restore?.().catch?.(() => {}); setView(restored?.onboardingCompleted ? (demo.previousView || 'home') : restored ? 'onboarding-goals' : 'welcome'); return restored;
    }
  };

  const DemoFlowService = {
    steps() { return content.flow || fallback.flow; },
    index(view = state.currentView) { const groups = [['home'], ['lessons', 'lesson', 'lesson-preview', 'theory'], ['ai-coach', 'adaptive-plan'], ['analytics', 'progress-reports', 'learning-outcomes']]; const index = groups.findIndex((items) => items.includes(view)); return index < 0 ? 0 : index; },
    next() { const steps = this.steps(); const current = this.index(); setView(steps[Math.min(steps.length - 1, current + 1)]?.view || 'demo-center'); },
    go(view) { setView(view); }
  };

  function demoLandingView() {
    const account = content.account || fallback.account;
    return `<section class="demo-landing"><button class="back-link" data-view="welcome" aria-label="Quay lại">←</button><div class="demo-mark">TH</div><p class="eyebrow">PRESENTATION MODE</p><h1>Trải nghiệm sản phẩm trong 1 chạm</h1><p class="demo-lead">Dữ liệu học mẫu đã sẵn sàng cho bảo vệ đồ án, demo khách hàng và pitching.</p><div class="demo-account"><div><small>TÀI KHOẢN DEMO</small><b>${escapeHtml(account.fullName)}</b><span>${escapeHtml(account.email)} · không cần mật khẩu</span></div><button class="btn primary" data-demo-start>Vào bản demo</button></div><div class="demo-assurance"><span><b>Dữ liệu riêng</b>Không ảnh hưởng user thật</span><span><b>Offline-ready</b>Sau khi app shell đã cài</span><span><b>Khôi phục phiên</b>Thoát demo sẽ trả lại tài khoản trước</span></div></section>`;
  }

  function demoCenterView() {
    const progress = app.getUserProgress(); const steps = DemoFlowService.steps(); const showcases = content.showcase || [];
    return `<section class="demo-center-hero section"><div><p class="eyebrow">P54 · DEMO CONTROL</p><h1>Trung tâm trình bày</h1><p>Flow nhất quán, dữ liệu có sẵn và mọi màn hình đều sẵn sàng chụp.</p></div><div class="demo-kpis"><span><b>${progress.stats.lessonsCompleted}</b>Bài học</span><span><b>${progress.stats.wordsLearned}</b>Từ đã học</span><span><b>${progress.stats.streak}</b>Streak</span></div></section><section class="demo-flow section"><div class="demo-section-heading"><div><small>STANDARD DEMO FLOW</small><h2>Home → Learning → AI → Analytics</h2></div><button class="btn primary" data-demo-go="home">Bắt đầu flow</button></div><div class="demo-flow-list">${steps.map((step, index) => `<button data-demo-go="${escapeHtml(step.view)}"><span>${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(step.label)}</b><small>${escapeHtml(step.message)}</small></button>`).join('')}</div></section><section class="demo-showcase section"><div class="demo-section-heading"><div><small>FEATURE SHOWCASE</small><h2>Mỗi module giải quyết một vấn đề học tập</h2></div></div><div>${showcases.map((item) => `<article><small>${escapeHtml(item.id)}</small><h3>${escapeHtml(item.title)}</h3><p><b>Mục đích:</b> ${escapeHtml(item.purpose)}</p><p><b>Giá trị:</b> ${escapeHtml(item.value)}</p><button class="text-button" data-demo-go="${escapeHtml(item.view)}">Mở module →</button></article>`).join('')}</div></section><section class="demo-controls section"><label><input type="checkbox" data-demo-presentation ${PresentationModeService.enabled() ? 'checked' : ''}><span><b>Presentation mode</b><small>Ẩn chi tiết debug, cloud và nội dung kỹ thuật khi trình bày.</small></span></label><div><button class="btn secondary" data-demo-reset>Khôi phục dữ liệu mẫu</button><button class="btn danger" data-demo-exit>Thoát demo</button></div></section>`;
  }

  function guideView() {
    const steps = DemoFlowService.steps(); const index = DemoFlowService.index(); const current = steps[index] || steps[0]; const next = steps[index + 1];
    return `<aside class="demo-guide" aria-label="Luồng trình bày"><button class="demo-guide-brand" data-demo-center><span>DEMO</span><b>${escapeHtml(current?.label || 'Overview')}</b></button><div class="demo-guide-progress" aria-label="Bước ${index + 1} trên ${steps.length}">${steps.map((_, itemIndex) => `<i class="${itemIndex <= index ? 'active' : ''}"></i>`).join('')}</div>${next ? `<button class="btn primary" data-demo-next>Tiếp: ${escapeHtml(next.label)} →</button>` : `<button class="btn primary" data-demo-center>Hoàn tất demo</button>`}</aside>`;
  }

  const DemoModeService = Object.freeze({ account: DemoAccountService, data: SampleLearningDataService, presentation: PresentationModeService, flow: DemoFlowService, content: DemoContentService, id: DEMO_ID });
  window.DemoModeService = DemoModeService;
  window.KLEARN_EXTRA_VIEWS = { ...(window.KLEARN_EXTRA_VIEWS || {}), demo: demoLandingView, 'demo-center': demoCenterView };

  const previousAfterRender = window.KLEARN_AFTER_RENDER;
  window.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); const root = document.getElementById('app'); if (!root) return;
    if (routes.has(state.currentView) && !contentLoaded) DemoContentService.load();
    if (DemoAccountService.active()) { PresentationModeService.apply(); if (!document.querySelector('.demo-guide') && state.currentView !== 'demo-center') root.insertAdjacentHTML('afterbegin', guideView()); }
    root.querySelectorAll('[data-view]').forEach((button) => { if (!button.onclick) button.onclick = () => setView(button.dataset.view); });
    root.querySelector('[data-demo-start]')?.addEventListener('click', () => DemoAccountService.activate());
    root.querySelectorAll('[data-demo-go]').forEach((button) => { button.onclick = () => DemoFlowService.go(button.dataset.demoGo); });
    root.querySelectorAll('[data-demo-center]').forEach((button) => { button.onclick = () => setView('demo-center'); });
    root.querySelector('[data-demo-next]')?.addEventListener('click', () => DemoFlowService.next());
    root.querySelector('[data-demo-presentation]')?.addEventListener('change', (event) => PresentationModeService.set(event.currentTarget.checked));
    root.querySelector('[data-demo-reset]')?.addEventListener('click', () => { DemoAccountService.reset(); toast('Dữ liệu demo đã được khôi phục.'); });
    root.querySelectorAll('[data-demo-exit]').forEach((button) => { button.onclick = () => DemoAccountService.exit(); });
  };

  if (DemoAccountService.active()) PresentationModeService.apply();
  DemoContentService.load();
})(window);
