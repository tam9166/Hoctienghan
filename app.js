'use strict';

// ============================================================
// Storage and migration layer (replaceable by Supabase later)
// ============================================================
const STORAGE_KEYS = Object.freeze({
  users: 'klearn_users',
  session: 'klearn_session',
  progress: 'klearn_progress',
  srs: 'klearn_srs',
  settings: 'klearn_settings'
});

const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`[K-Learn VN] Dữ liệu ${key} bị lỗi và đã được bỏ qua.`, error);
      try { localStorage.removeItem(key); } catch (_) { /* Storage may be unavailable. */ }
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[K-Learn VN] Không thể lưu ${key}.`, error);
      return false;
    }
  },
  remove(key) {
    try { localStorage.removeItem(key); } catch (_) { /* Storage may be unavailable. */ }
  }
};

function migrateLegacyStorage() {
  ['role', 'userRole', 'selectedRole', 'klearn_role', 'currentRole'].forEach((key) => storage.remove(key));
  if (!storage.get(STORAGE_KEYS.settings)) {
    storage.set(STORAGE_KEYS.settings, { schemaVersion: 3, language: 'vi', updatedAt: new Date().toISOString() });
  }
}

// ============================================================
// Course, onboarding, placement-test and vocabulary data
// ============================================================
const APP_DATA = Object.freeze({
  goals: [
    { id: 'study', icon: '🎓', label: 'Du học' },
    { id: 'work', icon: '💼', label: 'Làm việc tại Hàn Quốc' },
    { id: 'eps', icon: '🏭', label: 'EPS / Xuất khẩu lao động' },
    { id: 'topik', icon: '🏆', label: 'Thi TOPIK' },
    { id: 'hobby', icon: '❤️', label: 'Sở thích / K-Drama / K-Pop' },
    { id: 'living', icon: '🇰🇷', label: 'Sinh sống tại Hàn Quốc' }
  ],
  levelChoices: [
    { id: 'none', icon: '🌱', label: 'Chưa biết gì', level: 'Beginner' },
    { id: 'hangul', icon: 'ㄱ', label: 'Biết bảng chữ cái Hangul', level: 'Beginner+' },
    { id: 'basic', icon: '📗', label: 'Đã học tiếng Hàn cơ bản', level: 'TOPIK I' },
    { id: 'topik', icon: '🏆', label: 'Đã từng thi TOPIK', level: '' },
    { id: 'placement', icon: '📝', label: 'Tôi muốn làm bài kiểm tra đầu vào', level: 'Placement Test' }
  ],
  placementQuestions: [
    { prompt: 'Chữ nào đọc gần giống âm “ga/ka”?', options: ['ㄱ', 'ㄴ', 'ㅁ', 'ㅅ'], answer: 0 },
    { prompt: '“안녕하세요” có nghĩa là gì?', options: ['Cảm ơn', 'Xin chào', 'Xin lỗi', 'Tạm biệt'], answer: 1 },
    { prompt: 'Từ “사람” có nghĩa là gì?', options: ['Người', 'Nhà', 'Sách', 'Nước'], answer: 0 },
    { prompt: 'Điền trợ từ đúng: 저__ 학생입니다.', options: ['를', '는', '에', '도'], answer: 1 },
    { prompt: '“학교” là từ chỉ…', options: ['Công ty', 'Bệnh viện', 'Trường học', 'Nhà hàng'], answer: 2 },
    { prompt: 'Dạng quá khứ phù hợp của “가다” là gì?', options: ['가요', '갔어요', '갈 거예요', '가세요'], answer: 1 },
    { prompt: 'Nối câu đối lập bằng cấu trúc nào?', options: ['-지만', '-고', '-에서', '-에게'], answer: 0 },
    { prompt: '“저는 한국어를 공부해요.” nghĩa là gì?', options: ['Tôi dạy tiếng Hàn.', 'Tôi thích Hàn Quốc.', 'Tôi học tiếng Hàn.', 'Tôi đến trường.'], answer: 2 },
    { prompt: 'Câu nào dùng kính ngữ phù hợp hơn?', options: ['선생님이 먹어.', '선생님께서 드세요.', '선생님은 자.', '선생님을 가요.'], answer: 1 },
    { prompt: '“비가 와서 집에 있어요.” diễn đạt ý nào?', options: ['Vì trời mưa nên tôi ở nhà.', 'Nếu trời mưa tôi sẽ đi.', 'Tuy mưa nhưng tôi ra ngoài.', 'Tôi thích ngôi nhà khi mưa.'], answer: 0 }
  ],
  courses: [
    {
      id: 'level-1', level: 'Beginner', title: 'LEVEL 1 — Người mới bắt đầu', vocabularyGoal: '300–500 từ',
      units: [
        { id: 'hangul-foundation', title: 'Nền tảng Hangul', lessons: ['Hangul', 'Phụ âm', 'Nguyên âm', 'Ghép âm', 'Batchim', 'Nối âm', 'Biến âm'] },
        { id: 'beginner-life', title: 'Giao tiếp nhập môn', lessons: ['Chào hỏi', 'Số đếm', 'Gia đình', 'Đồ ăn', 'Ngữ pháp cơ bản', 'Trợ từ chủ đề 은/는'] }
      ]
    },
    {
      id: 'level-2', level: 'TOPIK I', title: 'LEVEL 2 — TOPIK I', vocabularyGoal: '1.000–1.500 từ',
      units: [
        { id: 'topik-1', title: 'TOPIK cấp 1–2', lessons: ['Hiện tại / quá khứ / tương lai', '-고', '-지만', '-아서/어서', 'Kính ngữ cơ bản'] },
        { id: 'topik-1-skills', title: 'Bốn kỹ năng', lessons: ['Nghe', 'Nói', 'Đọc', 'Viết'] }
      ]
    },
    {
      id: 'level-3', level: 'TOPIK II', title: 'LEVEL 3 — TOPIK II', vocabularyGoal: 'Từ vựng học thuật & công việc',
      units: [
        { id: 'topik-2-grammar', title: 'TOPIK cấp 3–4', lessons: ['Ngữ pháp nâng cao', 'Bị động / sai khiến', 'Sắc thái câu', 'Từ học thuật'] },
        { id: 'topik-2-life', title: 'Hàn Quốc thực tế', lessons: ['Công sở', 'Đọc báo', 'Viết đoạn', 'Email công việc', 'Phỏng vấn'] }
      ]
    },
    {
      id: 'level-4', level: 'TOPIK Exam', title: 'LEVEL 4 — TOPIK Exam', vocabularyGoal: 'Luyện thi có chiến lược',
      units: [
        { id: 'exam-bank', title: 'Ngân hàng đề', lessons: ['TOPIK I', 'TOPIK II', 'Listening', 'Reading', 'Writing'] },
        { id: 'exam-analysis', title: 'Phân tích', lessons: ['Điểm', 'Phân tích điểm yếu', 'Countdown kỳ thi'] }
      ]
    }
  ],
  vocabulary: [
    { id: 'kr', korean: '한국', vietnamese: 'Hàn Quốc', example: '저는 한국에 갑니다.', translation: 'Tôi đi Hàn Quốc.' },
    { id: 'student', korean: '학생', vietnamese: 'Học sinh', example: '저는 학생입니다.', translation: 'Tôi là học sinh.' },
    { id: 'school', korean: '학교', vietnamese: 'Trường học', example: '학교에서 공부해요.', translation: 'Tôi học ở trường.' },
    { id: 'friend', korean: '친구', vietnamese: 'Bạn bè', example: '친구를 만나요.', translation: 'Tôi gặp bạn.' },
    { id: 'thanks', korean: '감사합니다', vietnamese: 'Cảm ơn', example: '정말 감사합니다.', translation: 'Thật sự cảm ơn.' },
    { id: 'food', korean: '음식', vietnamese: 'Đồ ăn', example: '한국 음식을 좋아해요.', translation: 'Tôi thích đồ ăn Hàn Quốc.' }
  ]
});

// ============================================================
// State and utilities
// ============================================================
const state = {
  currentUser: null,
  currentView: 'welcome',
  onboardingStep: 'goals',
  selectedGoals: [],
  selectedLevel: '',
  dailyProgress: null,
  lessonProgress: {},
  srsData: [],
  pronunciationAttempts: [],
  selectedWords: [],
  sentenceCorrect: false,
  flashcardFlipped: false,
  recording: false,
  mediaRecorder: null,
  recognition: null,
  mediaStream: null,
  chunks: [],
  recordedAudioUrl: '',
  pronunciationResult: null,
  toastTimer: null
};

const MAIN_VIEWS = ['home', 'lessons', 'lesson', 'review', 'practice', 'profile', 'edit-profile'];
const PUBLIC_VIEWS = ['welcome', 'login', 'register'];
const ONBOARDING_VIEWS = ['onboarding-goals', 'onboarding-level', 'placement', 'onboarding-result'];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalizeEmail(value = '') { return String(value).trim().toLowerCase(); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function firstName(fullName = '') { return fullName.trim().split(/\s+/).filter(Boolean).pop() || 'bạn'; }
function initials(fullName = '') { return (firstName(fullName).charAt(0) || '한').toUpperCase(); }
function appElement() { return document.getElementById('app'); }
function formatDate(value) { return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)); }

function toast(message) {
  const element = document.getElementById('toast');
  clearTimeout(state.toastTimer);
  element.textContent = message;
  element.classList.add('show');
  state.toastTimer = setTimeout(() => element.classList.remove('show'), 2400);
}

function setFormError(message = '') {
  const error = document.getElementById('formError');
  if (!error) return;
  error.textContent = message;
  error.classList.toggle('hidden', !message);
}

async function hashPassword(password) {
  if (window.crypto?.subtle) {
    const bytes = new TextEncoder().encode(password);
    const digest = await window.crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }
  return btoa(unescape(encodeURIComponent(password)));
}

function uniqueId() {
  return window.crypto?.randomUUID ? window.crypto.randomUUID() : `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ============================================================
// User, progress and SRS services
// ============================================================
function getUsers() {
  const users = storage.get(STORAGE_KEYS.users, []);
  return Array.isArray(users) ? users : [];
}

function saveUsers(users) { storage.set(STORAGE_KEYS.users, users); }

function normalizeUser(user) {
  if (!user || typeof user !== 'object') return null;
  return {
    ...user,
    fullName: typeof user.fullName === 'string' && user.fullName.trim() ? user.fullName : 'Người học K-Learn',
    email: typeof user.email === 'string' ? user.email : '',
    avatar: typeof user.avatar === 'string' ? user.avatar : initials(user.fullName || ''),
    goals: Array.isArray(user.goals) ? user.goals : [],
    level: typeof user.level === 'string' ? user.level : 'Beginner',
    onboardingCompleted: user.onboardingCompleted === true,
    onboardingStep: typeof user.onboardingStep === 'string' ? user.onboardingStep : 'goals',
    placement: user.placement && typeof user.placement === 'object'
      ? { index: Number(user.placement.index) || 0, answers: Array.isArray(user.placement.answers) ? user.placement.answers : [], score: Number(user.placement.score) || 0 }
      : { index: 0, answers: [], score: 0 }
  };
}

function updateCurrentUser(changes) {
  if (!state.currentUser) return;
  const users = getUsers();
  const index = users.findIndex((user) => user?.id === state.currentUser.id);
  if (index < 0) return;
  users[index] = normalizeUser({ ...users[index], ...changes, updatedAt: new Date().toISOString() });
  saveUsers(users);
  state.currentUser = users[index];
}

function defaultProgress() {
  return {
    daily: { date: todayKey(), tasks: { vocabulary: false, lesson: false, speaking: false } },
    lessonProgress: {},
    stats: { lessonsCompleted: 0, learningDays: 1, streak: 1, wordsLearned: 0 },
    skills: { listening: 0, speaking: 0, reading: 0, writing: 0 },
    pronunciationAttempts: [],
    mockTests: [
      { title: 'TOPIK I - Đề mẫu', date: 'Chưa làm', score: '—/200' },
      { title: 'Đề luyện tập Nghe', date: 'Chưa làm', score: '—/100' }
    ]
  };
}

function getUserProgress() {
  if (!state.currentUser) return defaultProgress();
  const defaults = defaultProgress();
  const allProgress = storage.get(STORAGE_KEYS.progress, {});
  const safeProgress = allProgress && typeof allProgress === 'object' && !Array.isArray(allProgress) ? allProgress : {};
  let progress = safeProgress[state.currentUser.id];
  if (!progress || typeof progress !== 'object') progress = defaultProgress();
  progress = {
    ...defaults,
    ...progress,
    daily: { ...defaults.daily, ...(progress.daily && typeof progress.daily === 'object' ? progress.daily : {}), tasks: { ...defaults.daily.tasks, ...(progress.daily?.tasks && typeof progress.daily.tasks === 'object' ? progress.daily.tasks : {}) } },
    stats: { ...defaults.stats, ...(progress.stats && typeof progress.stats === 'object' ? progress.stats : {}) },
    skills: { ...defaults.skills, ...(progress.skills && typeof progress.skills === 'object' ? progress.skills : {}) },
    lessonProgress: progress.lessonProgress && typeof progress.lessonProgress === 'object' ? progress.lessonProgress : {},
    pronunciationAttempts: Array.isArray(progress.pronunciationAttempts) ? progress.pronunciationAttempts : [],
    mockTests: Array.isArray(progress.mockTests) ? progress.mockTests : defaults.mockTests
  };
  if (progress.daily.date !== todayKey()) progress.daily = { date: todayKey(), tasks: { vocabulary: false, lesson: false, speaking: false } };
  safeProgress[state.currentUser.id] = progress;
  storage.set(STORAGE_KEYS.progress, safeProgress);
  return progress;
}

function saveUserProgress(progress) {
  if (!state.currentUser) return;
  const allProgress = storage.get(STORAGE_KEYS.progress, {});
  const safeProgress = allProgress && typeof allProgress === 'object' && !Array.isArray(allProgress) ? allProgress : {};
  safeProgress[state.currentUser.id] = progress;
  storage.set(STORAGE_KEYS.progress, safeProgress);
  syncUserData();
}

function defaultSrsCards() {
  const due = new Date(Date.now() - 60_000).toISOString();
  return APP_DATA.vocabulary.map((word) => ({ ...word, lastReviewed: null, nextReview: due, reviewCount: 0, difficulty: 'new' }));
}

function getUserSrs() {
  if (!state.currentUser) return [];
  const allSrs = storage.get(STORAGE_KEYS.srs, {});
  const safeSrs = allSrs && typeof allSrs === 'object' && !Array.isArray(allSrs) ? allSrs : {};
  if (!Array.isArray(safeSrs[state.currentUser.id])) {
    safeSrs[state.currentUser.id] = defaultSrsCards();
    storage.set(STORAGE_KEYS.srs, safeSrs);
  }
  return safeSrs[state.currentUser.id];
}

function saveUserSrs(cards) {
  const allSrs = storage.get(STORAGE_KEYS.srs, {});
  const safeSrs = allSrs && typeof allSrs === 'object' && !Array.isArray(allSrs) ? allSrs : {};
  safeSrs[state.currentUser.id] = cards;
  storage.set(STORAGE_KEYS.srs, safeSrs);
  state.srsData = cards;
}

function initializeUserData(userId) {
  const allProgress = storage.get(STORAGE_KEYS.progress, {});
  const safeProgress = allProgress && typeof allProgress === 'object' && !Array.isArray(allProgress) ? allProgress : {};
  if (!safeProgress[userId]) safeProgress[userId] = defaultProgress();
  storage.set(STORAGE_KEYS.progress, safeProgress);

  const allSrs = storage.get(STORAGE_KEYS.srs, {});
  const safeSrs = allSrs && typeof allSrs === 'object' && !Array.isArray(allSrs) ? allSrs : {};
  if (!safeSrs[userId]) safeSrs[userId] = defaultSrsCards();
  storage.set(STORAGE_KEYS.srs, safeSrs);
}

function syncUserData() {
  if (!state.currentUser) return;
  const progress = getUserProgress();
  state.dailyProgress = progress.daily;
  state.lessonProgress = progress.lessonProgress;
  state.pronunciationAttempts = progress.pronunciationAttempts;
  state.srsData = getUserSrs();
}

// ============================================================
// Authentication and onboarding service
// ============================================================
const auth = {
  async register({ fullName, email, password }) {
    const users = getUsers();
    if (users.some((user) => user?.email === email)) throw new Error('Email này đã được đăng ký.');
    const now = new Date().toISOString();
    const user = {
      id: uniqueId(), fullName, email, passwordHash: await hashPassword(password), avatar: initials(fullName), goals: [], level: '',
      onboardingCompleted: false, onboardingStep: 'goals', placement: { index: 0, answers: [], score: 0 }, createdAt: now, updatedAt: now
    };
    users.push(user);
    saveUsers(users);
    initializeUserData(user.id);
    storage.set(STORAGE_KEYS.session, { userId: user.id, createdAt: now });
    state.currentUser = user;
    syncUserData();
    return user;
  },
  async login(email, password) {
    const storedUser = getUsers().find((item) => item?.email === email);
    if (!storedUser || storedUser.passwordHash !== await hashPassword(password)) throw new Error('Email hoặc mật khẩu không đúng.');
    const user = normalizeUser(storedUser);
    storage.set(STORAGE_KEYS.session, { userId: user.id, createdAt: new Date().toISOString() });
    state.currentUser = user;
    initializeUserData(user.id);
    syncUserData();
    return user;
  },
  logout() {
    storage.remove(STORAGE_KEYS.session);
    state.currentUser = null;
    state.selectedGoals = [];
    state.selectedLevel = '';
    state.dailyProgress = null;
    state.lessonProgress = {};
    state.srsData = [];
    state.pronunciationAttempts = [];
    setView('welcome');
  },
  restoreSession() {
    const session = storage.get(STORAGE_KEYS.session, null);
    if (!session?.userId) return null;
    const storedUser = getUsers().find((item) => item?.id === session.userId);
    const user = normalizeUser(storedUser);
    if (!user) {
      storage.remove(STORAGE_KEYS.session);
      return null;
    }
    state.currentUser = user;
    initializeUserData(user.id);
    syncUserData();
    return user;
  }
};

function onboardingViewFor(user) {
  const step = user?.onboardingStep || 'goals';
  if (step === 'level') return 'onboarding-level';
  if (step === 'placement') return 'placement';
  if (step === 'result') return 'onboarding-result';
  return 'onboarding-goals';
}

function persistOnboarding(step, changes = {}) {
  state.onboardingStep = step;
  updateCurrentUser({ onboardingStep: step, ...changes });
}

// ============================================================
// Routing and shell
// ============================================================
function isMainView(view) { return MAIN_VIEWS.includes(view); }

function setView(view, options = {}) {
  let target = view;
  if (!state.currentUser && !PUBLIC_VIEWS.includes(target)) target = 'welcome';
  if (state.currentUser && !state.currentUser.onboardingCompleted && !ONBOARDING_VIEWS.includes(target)) target = onboardingViewFor(state.currentUser);
  if (state.currentUser?.onboardingCompleted && (PUBLIC_VIEWS.includes(target) || ONBOARDING_VIEWS.includes(target))) target = 'home';
  state.currentView = target;
  if (!options.fromHash && location.hash !== `#${target}`) history.replaceState(null, '', `#${target}`);
  render();
}

function syncShell() {
  const showChrome = Boolean(state.currentUser?.onboardingCompleted && isMainView(state.currentView));
  document.getElementById('topbar').classList.toggle('hidden', !showChrome);
  document.getElementById('bottomNav').classList.toggle('hidden', !showChrome);
  appElement().classList.toggle('public-content', !showChrome);
  if (showChrome) {
    document.querySelector('#avatarBtn .avatar').textContent = state.currentUser.avatar || initials(state.currentUser.fullName);
    document.getElementById('streakCount').textContent = getUserProgress().stats.streak;
  }
  document.querySelectorAll('.nav-item').forEach((button) => {
    const activeView = state.currentView === 'lesson' ? 'lessons' : state.currentView === 'edit-profile' ? 'profile' : state.currentView;
    const active = button.dataset.route === activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

// ============================================================
// Public and onboarding views
// ============================================================
function welcomeView() {
  return `<section class="auth-page welcome-page">
    <div class="brand-mark" aria-hidden="true">한</div><p class="eyebrow">K-Learn VN</p>
    <h1 class="welcome-title">Tiếng Hàn được thiết kế<br>dành riêng cho người Việt.</h1>
    <div class="welcome-points"><span>Học theo trình độ.</span><span>Học theo mục tiêu.</span><span>Tiến bộ mỗi ngày.</span></div>
    <div class="auth-actions"><button class="btn primary full" data-view="register">Bắt đầu học</button><p class="auth-switch">Đã có tài khoản?</p><button class="btn secondary full" data-view="login">Đăng nhập</button></div>
  </section>`;
}

function registerView() {
  return `<section class="auth-page"><button class="back-link" data-view="welcome" aria-label="Quay lại">←</button><p class="eyebrow">Tạo tài khoản học viên</p>
    <h1 class="headline">Bắt đầu lộ trình của bạn</h1><p class="subtle">Chỉ mất vài phút để K-Learn VN hiểu mục tiêu của bạn.</p>
    <form id="registerForm" class="auth-form" novalidate>
      <label>Họ tên<input name="fullName" type="text" autocomplete="name" maxlength="80" placeholder="Nguyễn Minh Anh" /></label>
      <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="ban@example.com" /></label>
      <label>Mật khẩu<input name="password" type="password" autocomplete="new-password" minlength="6" placeholder="Ít nhất 6 ký tự" /></label>
      <label>Xác nhận mật khẩu<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" placeholder="Nhập lại mật khẩu" /></label>
      <p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full" type="submit">Đăng ký</button>
    </form>
    <p class="auth-switch">Đã có tài khoản? <button class="text-button" data-view="login">Đăng nhập</button></p>
    <p class="security-note">MVP này lưu tài khoản trên thiết bị. Không sử dụng lại mật khẩu quan trọng của bạn.</p>
  </section>`;
}

function loginView() {
  return `<section class="auth-page"><button class="back-link" data-view="welcome" aria-label="Quay lại">←</button><p class="eyebrow">K-Learn VN</p>
    <h1 class="headline">Chào mừng trở lại 👋</h1><p class="subtle">Tiếp tục lộ trình tiếng Hàn dành riêng cho bạn.</p>
    <form id="loginForm" class="auth-form" novalidate>
      <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="ban@example.com" /></label>
      <label>Mật khẩu<input name="password" type="password" autocomplete="current-password" placeholder="Mật khẩu" /></label>
      <p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full" type="submit">Đăng nhập</button>
    </form>
    <button class="text-button forgot-button" id="forgotPassword">Quên mật khẩu?</button>
    <p class="auth-switch">Chưa có tài khoản? <button class="text-button" data-view="register">Đăng ký</button></p>
  </section>`;
}

function onboardingFrame(step, title, subtitle, content) {
  const width = step.startsWith('1') ? 25 : step.startsWith('2') ? 55 : step.startsWith('3') ? 82 : 100;
  return `<section class="onboarding-page"><div class="onboarding-top"><span class="brand-small">K-Learn VN</span><span class="step-label">${escapeHtml(step)}</span></div>
    <div class="bar onboarding-bar"><span style="width:${width}%"></span></div><div class="onboarding-copy"><h1 class="headline">${title}</h1><p class="subtle">${subtitle}</p></div>${content}</section>`;
}

function goalsView() {
  const selected = state.selectedGoals.length ? state.selectedGoals : (state.currentUser.goals || []);
  state.selectedGoals = [...selected];
  const content = `<div class="choice-list">${APP_DATA.goals.map((goal) => `<button class="choice-card ${selected.includes(goal.id) ? 'selected' : ''}" data-goal="${goal.id}"><span class="choice-icon">${goal.icon}</span><span>${goal.label}</span><span class="choice-check">${selected.includes(goal.id) ? '✓' : ''}</span></button>`).join('')}</div>
    <p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full sticky-action" id="goalsContinue">Tiếp tục</button>`;
  return onboardingFrame('1 / 3', 'Bạn học tiếng Hàn để làm gì?', 'Bạn có thể chọn nhiều mục tiêu.', content);
}

function levelView() {
  const selectedId = APP_DATA.levelChoices.find((choice) => choice.level === state.selectedLevel)?.id || '';
  const showTopikFollowup = state.selectedLevel === 'TOPIK experience';
  const content = `<div class="choice-list">${APP_DATA.levelChoices.map((choice) => {
    const selected = selectedId === choice.id || (choice.id === 'topik' && showTopikFollowup);
    return `<button class="choice-card ${selected ? 'selected' : ''}" data-level-choice="${choice.id}"><span class="choice-icon">${choice.icon}</span><span>${choice.label}</span><span class="choice-check">${selected ? '✓' : ''}</span></button>`;
  }).join('')}</div>
    ${showTopikFollowup ? `<div class="followup-card"><strong>Kết quả TOPIK gần nhất của bạn?</strong><button class="mini-choice" data-level-result="TOPIK I nâng cao">TOPIK I (cấp 1–2)</button><button class="mini-choice" data-level-result="TOPIK II khởi đầu">TOPIK II (cấp 3 trở lên)</button><button class="mini-choice" data-level-result="Placement Test">Tôi muốn kiểm tra lại</button></div>` : ''}
    <p id="formError" class="form-error hidden" role="alert"></p><div class="action-row"><button class="btn secondary" data-view="onboarding-goals">Quay lại</button><button class="btn primary" id="levelContinue">Tiếp tục</button></div>`;
  return onboardingFrame('2 / 3', 'Trình độ tiếng Hàn hiện tại của bạn?', 'Chọn phương án gần đúng nhất. Bạn có thể làm bài kiểm tra đầu vào.', content);
}

function placementView() {
  const placement = state.currentUser.placement || { index: 0, answers: [], score: 0 };
  const index = Math.min(placement.index || 0, APP_DATA.placementQuestions.length - 1);
  const question = APP_DATA.placementQuestions[index];
  const content = `<div class="test-progress"><span>${index + 1} / ${APP_DATA.placementQuestions.length}</span><span>${placement.score || 0} điểm</span></div>
    <section class="card question-card"><h2>${escapeHtml(question.prompt)}</h2><div class="answer-list">${question.options.map((option, optionIndex) => `<button class="answer-button" data-test-answer="${optionIndex}"><span>${String.fromCharCode(65 + optionIndex)}</span>${escapeHtml(option)}</button>`).join('')}</div></section>`;
  return onboardingFrame('3 / 3 · Placement Test', 'Kiểm tra trình độ đầu vào', 'Chọn một đáp án. Kết quả chỉ dùng để gợi ý lộ trình MVP.', content);
}

function goalLabels(goals = []) { return goals.map((id) => APP_DATA.goals.find((goal) => goal.id === id)?.label).filter(Boolean); }

function onboardingResultView() {
  const goals = goalLabels(state.currentUser.goals);
  return `<section class="onboarding-page result-page"><div class="celebration">🎉</div><p class="eyebrow">Cá nhân hóa hoàn tất</p><h1 class="headline">Lộ trình của bạn đã sẵn sàng</h1>
    <p class="subtle">K-Learn VN sẽ ưu tiên bài học phù hợp với trình độ và mục tiêu của bạn.</p><div class="result-summary"><div><span>Trình độ</span><strong>${escapeHtml(state.currentUser.level || state.selectedLevel)}</strong></div><div><span>Mục tiêu</span><strong>${escapeHtml(goals.join(' · '))}</strong></div>${state.currentUser.placement?.answers?.length ? `<div><span>Placement Test</span><strong>${state.currentUser.placement.score}/10 điểm</strong></div>` : ''}</div>
    <button class="btn primary full" id="finishOnboarding">Bắt đầu học</button></section>`;
}

// ============================================================
// Authenticated app views
// ============================================================
function dailyCompletion(progress) {
  const tasks = progress.daily.tasks;
  return (tasks.vocabulary ? 30 : 0) + (tasks.lesson ? 40 : 0) + (tasks.speaking ? 30 : 0);
}

function roadmapFor(level) {
  const maps = {
    Beginner: [0, null, null, null], 'Beginner+': [35, null, null, null], 'TOPIK I': [100, 42, null, null],
    'TOPIK I nâng cao': [100, 75, null, null], 'TOPIK II khởi đầu': [100, 100, 15, null], 'TOPIK II': [100, 100, 35, null]
  };
  return maps[level] || maps.Beginner;
}

function homeView() {
  const progress = getUserProgress();
  const pct = dailyCompletion(progress);
  const roadmap = roadmapFor(state.currentUser.level);
  const dueCount = state.srsData.filter((card) => new Date(card.nextReview).getTime() <= Date.now()).length;
  const roadmapNames = ['Hangul', 'TOPIK I', 'TOPIK II', 'TOPIK Exam'];
  return `<section class="dashboard-hero section"><p class="eyebrow">Lộ trình cá nhân</p><h1 class="headline">Xin chào, ${escapeHtml(firstName(state.currentUser.fullName))} 👋</h1><p class="korean-motto">오늘도 화이팅!</p></section>
    <section class="card glass section"><div class="streak-line"><strong>🔥 ${progress.stats.streak} ngày liên tiếp</strong><span>${pct}% hôm nay</span></div><div class="bar large"><span style="width:${pct}%"></span></div><div class="daily-tasks"><span>${progress.daily.tasks.vocabulary ? '✓' : '○'} Học/ôn từ vựng</span><span>${progress.daily.tasks.lesson ? '✓' : '○'} Hoàn thành 1 bài</span><span>${progress.daily.tasks.speaking ? '✓' : '○'} Luyện nói 5 phút</span></div></section>
    <section class="dashboard-grid section"><article class="feature-card dark-card"><span class="card-kicker">Tiếp tục học</span><h2>${escapeHtml(state.currentUser.level)} · Unit 3</h2><p>은/는 và 이/가</p><button class="btn light" data-open-lesson="topic-particle">Tiếp tục</button></article><article class="feature-card review-card"><span class="card-kicker">Ôn tập hôm nay</span><h2>🧠 ${dueCount} từ cần ôn</h2><p>Ôn đúng lúc để nhớ lâu hơn.</p><button class="btn primary" data-view="review">Ôn ngay</button></article></section>
    <section class="card section"><div class="section-heading"><div><p class="eyebrow">Lộ trình</p><h2 class="section-title">Từ nền tảng đến kỳ thi</h2></div><span class="level-pill">${escapeHtml(state.currentUser.level)}</span></div><div class="roadmap-list">${roadmapNames.map((name, index) => {
      const value = roadmap[index];
      const status = value === null ? 'locked' : value >= 100 ? 'done' : 'active';
      return `<div class="roadmap-row ${status}"><span class="roadmap-icon">${status === 'done' ? '✓' : status === 'locked' ? '🔒' : '▶'}</span><div><strong>${name}</strong><div class="bar"><span style="width:${value || 0}%"></span></div></div><b>${status === 'locked' ? 'Khóa' : `${value}%`}</b></div>`;
    }).join('')}</div></section>`;
}

function lessonsView() {
  const completed = Boolean(state.lessonProgress['topic-particle']?.completed);
  return `<section class="section page-heading"><p class="eyebrow">Khóa học của bạn</p><h1 class="headline">Học theo lộ trình</h1><p class="subtle">Cấu trúc bốn level đã sẵn sàng để bổ sung course, unit và lesson.</p></section><section class="course-list">${APP_DATA.courses.map((course, courseIndex) => `<article class="card course-card ${courseIndex > 0 ? 'future-course' : ''}"><div class="course-title"><div><span class="course-number">0${courseIndex + 1}</span><h2>${course.title}</h2></div><span class="level-pill">${course.vocabularyGoal}</span></div>${course.units.map((unit) => `<div class="unit-block"><h3>${unit.title}</h3><div class="lesson-tags">${unit.lessons.map((lesson) => {
    const isGrammar = lesson.includes('은/는');
    return `<button class="lesson-tag ${isGrammar ? 'available' : ''} ${isGrammar && completed ? 'completed' : ''}" ${isGrammar ? 'data-open-lesson="topic-particle"' : `data-preview-lesson="${escapeHtml(lesson)}"`}>${isGrammar && completed ? '✓ ' : ''}${escapeHtml(lesson)}</button>`;
  }).join('')}</div></div>`).join('')}</article>`).join('')}</section>`;
}

function lessonView() {
  const completed = Boolean(state.lessonProgress['topic-particle']?.completed);
  return `<div class="lesson-header"><button class="close-btn" data-view="lessons" aria-label="Đóng bài học">×</button><div class="lesson-progress"><div class="bar"><span style="width:${completed ? 100 : 60}%"></span></div></div><span class="subtle">${completed ? '10/10' : '6/10'}</span></div>
    <section class="section lesson-title"><p class="eyebrow">Ngữ pháp sơ cấp</p><h1 class="headline">Trợ từ chủ đề</h1><div class="korean">은/는</div></section>
    <section class="card glass section"><h2 class="section-title">🧠 So sánh với Tiếng Việt</h2><p class="subtle">Trong tiếng Hàn, <b>은/는</b> được gắn sau danh từ để đánh dấu chủ đề của câu. Có thể hiểu gần với “thì” hoặc “là” trong tiếng Việt.</p><div class="grammar-box"><b>Quy tắc</b><ul class="subtle"><li>Có patchim (phụ âm cuối) + <b>은</b></li><li>Không có patchim + <b>는</b></li></ul></div></section>
    <section class="section"><h2 class="section-title">Ví dụ</h2><div class="example"><div><div class="korean example-korean">저<span class="highlight">는</span> 학생입니다.</div><div class="subtle">Tôi là học sinh.</div></div><button class="audio-btn" data-speak="저는 학생입니다" aria-label="Nghe câu ví dụ">🔊</button></div><div class="example"><div><div class="korean example-korean">선생님<span class="highlight">은</span> 한국 사람입니다.</div><div class="subtle">Giáo viên là người Hàn Quốc.</div></div><button class="audio-btn" data-speak="선생님은 한국 사람입니다" aria-label="Nghe câu ví dụ">🔊</button></div></section>
    <section class="exercise section"><h2 class="section-title">🧩 Sắp xếp câu</h2><p class="subtle center">Tạo câu: “Tôi là người Việt Nam.”</p><div id="dropZone" class="drop-zone"></div><div id="chipBox" class="chips"></div><p id="sentenceFeedback" class="exercise-feedback" role="status"></p><div class="action-row"><button class="btn secondary" id="resetSentence">Làm lại</button><button class="btn primary" id="checkSentence">Kiểm tra</button></div></section>
    <div class="action-row lesson-actions"><button class="btn secondary" data-view="lessons">Quay lại</button><button class="btn primary" id="completeLesson" ${!state.sentenceCorrect && !completed ? 'disabled' : ''}>${completed ? 'Đã hoàn thành ✓' : 'Hoàn thành bài'}</button></div>`;
}

function dueCards() { return state.srsData.filter((card) => new Date(card.nextReview).getTime() <= Date.now()); }

function reviewView() {
  const cards = dueCards();
  if (!cards.length) {
    const next = [...state.srsData].sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview))[0];
    return `<section class="empty-state"><div class="celebration">🎉</div><h1 class="headline">Bạn đã ôn xong hôm nay!</h1><p class="subtle">${next ? `Thẻ tiếp theo dự kiến vào ${formatDate(next.nextReview)}.` : 'Hãy quay lại sau khi có từ mới.'}</p><button class="btn primary" data-view="home">Về trang chủ</button></section>`;
  }
  const card = cards[0];
  return `<section class="section page-heading"><p class="eyebrow">SRS MVP · ${cards.length} thẻ đến hạn</p><h1 class="headline">Ôn tập hôm nay</h1><p class="subtle">Chạm vào thẻ để xem nghĩa và ví dụ.</p></section>
    <button class="flashcard ${state.flashcardFlipped ? 'flipped' : ''}" id="flipCard" aria-label="Lật flashcard"><div class="flashcard-face front"><span class="card-kicker">Tiếng Hàn</span><strong>${escapeHtml(card.korean)}</strong><span class="flip-hint">Chạm để lật</span></div><div class="flashcard-face back"><span class="card-kicker">Tiếng Việt</span><strong>${escapeHtml(card.vietnamese)}</strong><div class="flash-example"><b>${escapeHtml(card.example)}</b><span>${escapeHtml(card.translation)}</span></div></div></button>
    <button class="audio-inline" data-speak="${escapeHtml(card.korean)}">🔊 Nghe phát âm</button>
    ${state.flashcardFlipped ? `<div class="srs-actions" aria-label="Đánh giá mức độ ghi nhớ"><button data-srs-rating="forgot"><span>😵</span><b>Quên</b><small>10 phút</small></button><button data-srs-rating="hard"><span>😕</span><b>Khó</b><small>1 ngày</small></button><button data-srs-rating="remember"><span>🙂</span><b>Nhớ</b><small>3 ngày</small></button><button data-srs-rating="easy"><span>😎</span><b>Rất dễ</b><small>7 ngày</small></button></div>` : '<p class="subtle center">Hãy lật thẻ trước khi tự đánh giá.</p>'}`;
}

function pronunciationFeedback(result) {
  if (!result) return '<p class="subtle">Kết quả nhận diện và điểm tương đồng sẽ xuất hiện tại đây.</p>';
  if (result.score >= 90) return '<p class="feedback-good">Rất tốt! Câu nhận diện gần như trùng khớp hoàn toàn.</p>';
  if (result.score >= 70) return '<p class="feedback-mid">Khá tốt. Hãy nghe lại và luyện nhịp câu thêm một lần.</p>';
  return '<p class="feedback-bad">Hãy nói chậm, rõ từng âm tiết rồi thử lại.</p>';
}

function practiceView() {
  const result = state.pronunciationResult || state.pronunciationAttempts[0] || null;
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  return `<section class="card practice-card section"><span class="eyebrow">Luyện đọc câu sau</span><div class="phrase">안녕하세요</div><button class="audio-btn" data-speak="안녕하세요" aria-label="Nghe câu mẫu">🔊</button><div><span class="translation">Xin chào</span></div></section>
    <section class="card section pronunciation-result"><div class="subtle center">Kết quả Speech-to-Text</div>${result ? `<div class="recognized-text">“${escapeHtml(result.transcript)}”</div><div class="score-display"><span>Điểm phát âm MVP</span><strong>${result.score} / 100</strong></div>` : '<div class="result-placeholder">Nói câu mẫu để bắt đầu chấm theo độ giống văn bản.</div>'}</section>
    <section class="card glass section"><div class="feedback"><div class="ai-dot">✦</div><div><b class="feedback-title">Tailored Feedback</b>${pronunciationFeedback(result)}<small>Điểm chỉ dựa trên nhận dạng giọng nói và độ giống văn bản, không phải chấm âm vị AI chính xác.</small></div></div></section>
    ${state.recordedAudioUrl ? `<section class="card section"><label class="audio-playback-label">Bản ghi gần nhất</label><audio class="audio-playback" controls src="${state.recordedAudioUrl}"></audio></section>` : ''}
    <div class="mic-wrap"><button id="micBtn" class="mic-btn ${state.recording ? 'recording' : ''}" aria-label="${state.recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}">${state.recording ? '■' : '🎙'}</button><div class="subtle" id="micLabel">${state.recording ? 'Đang nghe... nhấn để dừng' : 'Nhấn để ghi âm và nhận diện câu nói'}</div></div>
    ${!Recognition ? '<div class="support-message">Trình duyệt này chưa hỗ trợ Speech Recognition. Bạn vẫn có thể ghi và nghe lại bản ghi nếu MediaRecorder khả dụng.</div>' : ''}<div class="action-row"><button class="btn secondary" data-view="home">Bỏ qua</button><button class="btn primary" id="practiceNext">Hoàn tất</button></div>`;
}

function profileView() {
  const progress = getUserProgress();
  const goals = goalLabels(state.currentUser.goals);
  const skills = progress.skills;
  const showTopik = state.currentUser.goals.includes('topik') || state.currentUser.level.includes('TOPIK');
  return `<section class="card profile-head section"><div class="profile-avatar">${escapeHtml(state.currentUser.avatar || initials(state.currentUser.fullName))}</div><h1 class="headline profile-name">${escapeHtml(state.currentUser.fullName)}</h1><p class="subtle">${escapeHtml(state.currentUser.level)} · ${escapeHtml(goals.join(' · '))}</p><div class="stats stats-four"><div class="stat"><b>${progress.stats.lessonsCompleted}</b><small>Bài đã học</small></div><div class="stat"><b>${progress.stats.learningDays}</b><small>Ngày học</small></div><div class="stat"><b>${progress.stats.streak}</b><small>Streak</small></div><div class="stat"><b>${progress.stats.wordsLearned}</b><small>Từ đã học</small></div></div><button class="btn secondary full" data-view="edit-profile">Chỉnh sửa hồ sơ</button></section>
    ${showTopik ? `<section class="card countdown-card section"><p class="eyebrow">Đếm ngược TOPIK</p><div><strong>28</strong><span>ngày</span></div><p class="subtle">Mốc luyện thi demo — ngày thi chính thức sẽ được kết nối sau.</p></section>` : ''}
    <section class="card section"><h2 class="section-title">📊 Tiến độ kỹ năng</h2><div class="skill-grid">${[['listening', 'Nghe'], ['speaking', 'Nói'], ['reading', 'Đọc'], ['writing', 'Viết']].map(([key, label]) => `<div class="skill"><strong>${skills[key]}%</strong><div class="subtle">${label}</div><div class="bar"><span style="width:${skills[key]}%"></span></div></div>`).join('')}</div></section>
    <section class="card section"><h2 class="section-title">🏅 Huy hiệu</h2><div class="badges"><div class="badge"><div class="badge-icon">🔥</div><small>Chăm chỉ</small></div><div class="badge"><div class="badge-icon">🎙</div><small>Phát âm</small></div><div class="badge"><div class="badge-icon">🧠</div><small>Trí nhớ tốt</small></div><div class="badge locked-badge"><div class="badge-icon">🔒</div><small>Cao thủ TOPIK</small></div></div></section>
    <section class="card section"><h2 class="section-title">🕘 Lịch sử thi thử</h2>${progress.mockTests.map((test) => `<div class="history-item"><div><b>${escapeHtml(test.title)}</b><div class="subtle">${escapeHtml(test.date)}</div></div><div class="score">${escapeHtml(test.score)}</div></div>`).join('')}</section><button class="btn danger full logout-button" id="logoutButton">Đăng xuất</button>`;
}

function editProfileView() {
  return `<section class="section page-heading"><button class="back-link" data-view="profile" aria-label="Quay lại">←</button><p class="eyebrow">Tài khoản học viên</p><h1 class="headline">Chỉnh sửa hồ sơ</h1></section><form id="editProfileForm" class="card auth-form" novalidate><label>Họ tên<input name="fullName" type="text" maxlength="80" value="${escapeHtml(state.currentUser.fullName)}" /></label><label>Trình độ<select name="level">${['Beginner', 'Beginner+', 'TOPIK I', 'TOPIK I nâng cao', 'TOPIK II khởi đầu'].map((level) => `<option ${state.currentUser.level === level ? 'selected' : ''}>${level}</option>`).join('')}</select></label><p class="subtle">Email: ${escapeHtml(state.currentUser.email)}</p><p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full" type="submit">Lưu thay đổi</button></form>`;
}

// ============================================================
// Render and event binding
// ============================================================
function render() {
  syncShell();
  const views = { welcome: welcomeView, register: registerView, login: loginView, 'onboarding-goals': goalsView, 'onboarding-level': levelView, placement: placementView, 'onboarding-result': onboardingResultView, home: homeView, lessons: lessonsView, lesson: lessonView, review: reviewView, practice: practiceView, profile: profileView, 'edit-profile': editProfileView };
  appElement().innerHTML = (views[state.currentView] || welcomeView)();
  bindEvents();
  window.scrollTo(0, 0);
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
  document.querySelectorAll('[data-open-lesson]').forEach((button) => { button.onclick = () => openLesson(button.dataset.openLesson); });
  document.querySelectorAll('[data-preview-lesson]').forEach((button) => { button.onclick = () => toast(`${button.dataset.previewLesson}: nội dung đang được chuẩn bị.`); });
  document.querySelectorAll('[data-speak]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.speak); });
  const registerForm = document.getElementById('registerForm'); if (registerForm) registerForm.onsubmit = handleRegister;
  const loginForm = document.getElementById('loginForm'); if (loginForm) loginForm.onsubmit = handleLogin;
  const editForm = document.getElementById('editProfileForm'); if (editForm) editForm.onsubmit = handleEditProfile;
  const forgot = document.getElementById('forgotPassword'); if (forgot) forgot.onclick = () => toast('Khôi phục mật khẩu cần backend. Với MVP, hãy đăng ký tài khoản mới trên thiết bị này.');
  document.querySelectorAll('[data-goal]').forEach((button) => { button.onclick = () => toggleGoal(button.dataset.goal); });
  const goalsContinue = document.getElementById('goalsContinue'); if (goalsContinue) goalsContinue.onclick = continueGoals;
  document.querySelectorAll('[data-level-choice]').forEach((button) => { button.onclick = () => selectLevelChoice(button.dataset.levelChoice); });
  document.querySelectorAll('[data-level-result]').forEach((button) => { button.onclick = () => { state.selectedLevel = button.dataset.levelResult; render(); }; });
  const levelContinue = document.getElementById('levelContinue'); if (levelContinue) levelContinue.onclick = continueLevel;
  document.querySelectorAll('[data-test-answer]').forEach((button) => { button.onclick = () => answerPlacement(Number(button.dataset.testAnswer)); });
  const finishOnboarding = document.getElementById('finishOnboarding'); if (finishOnboarding) finishOnboarding.onclick = completeOnboarding;
  if (state.currentView === 'lesson') setupSentenceExercise();
  const completeLessonButton = document.getElementById('completeLesson'); if (completeLessonButton) completeLessonButton.onclick = completeLesson;
  const flipCard = document.getElementById('flipCard'); if (flipCard) flipCard.onclick = () => { state.flashcardFlipped = !state.flashcardFlipped; render(); };
  document.querySelectorAll('[data-srs-rating]').forEach((button) => { button.onclick = () => rateSrs(button.dataset.srsRating); });
  const micButton = document.getElementById('micBtn'); if (micButton) micButton.onclick = toggleRecording;
  const practiceNext = document.getElementById('practiceNext'); if (practiceNext) practiceNext.onclick = completePractice;
  const logoutButton = document.getElementById('logoutButton'); if (logoutButton) logoutButton.onclick = () => auth.logout();
}

// ============================================================
// Form and onboarding handlers
// ============================================================
async function handleRegister(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const fullName = String(form.get('fullName') || '').trim();
  const email = normalizeEmail(form.get('email'));
  const password = String(form.get('password') || '');
  const confirmPassword = String(form.get('confirmPassword') || '');
  if (!fullName || !email || !password || !confirmPassword) return setFormError('Vui lòng điền đầy đủ thông tin.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return setFormError('Email chưa đúng định dạng.');
  if (password.length < 6) return setFormError('Mật khẩu phải có ít nhất 6 ký tự.');
  if (password !== confirmPassword) return setFormError('Mật khẩu xác nhận chưa khớp.');
  try {
    await auth.register({ fullName, email, password });
    state.selectedGoals = [];
    state.selectedLevel = '';
    setView('onboarding-goals');
  } catch (error) { setFormError(error.message); }
}

async function handleLogin(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = normalizeEmail(form.get('email'));
  const password = String(form.get('password') || '');
  if (!email || !password) return setFormError('Vui lòng nhập email và mật khẩu.');
  try {
    const user = await auth.login(email, password);
    state.selectedGoals = [...(user.goals || [])];
    state.selectedLevel = user.level || '';
    setView(user.onboardingCompleted ? 'home' : onboardingViewFor(user));
  } catch (error) { setFormError(error.message); }
}

function toggleGoal(goalId) {
  state.selectedGoals = state.selectedGoals.includes(goalId) ? state.selectedGoals.filter((id) => id !== goalId) : [...state.selectedGoals, goalId];
  render();
}

function continueGoals() {
  if (!state.selectedGoals.length) return setFormError('Hãy chọn ít nhất một mục tiêu.');
  persistOnboarding('level', { goals: [...state.selectedGoals] });
  state.selectedLevel = state.currentUser.level || '';
  setView('onboarding-level');
}

function selectLevelChoice(choiceId) {
  const choice = APP_DATA.levelChoices.find((item) => item.id === choiceId);
  state.selectedLevel = choiceId === 'topik' ? 'TOPIK experience' : choice.level;
  render();
}

function continueLevel() {
  if (!state.selectedLevel || state.selectedLevel === 'TOPIK experience') return setFormError('Hãy chọn trình độ hoặc phương án kiểm tra phù hợp.');
  if (state.selectedLevel === 'Placement Test') {
    const existing = state.currentUser.placement || { index: 0, answers: [], score: 0 };
    persistOnboarding('placement', { placement: existing.index >= 10 ? { index: 0, answers: [], score: 0 } : existing });
    setView('placement');
    return;
  }
  persistOnboarding('result', { level: state.selectedLevel });
  setView('onboarding-result');
}

function placementLevel(score) {
  if (score <= 3) return 'Beginner';
  if (score <= 6) return 'TOPIK I';
  if (score <= 8) return 'TOPIK I nâng cao';
  return 'TOPIK II khởi đầu';
}

function answerPlacement(answerIndex) {
  const placement = { ...(state.currentUser.placement || { index: 0, answers: [], score: 0 }) };
  const question = APP_DATA.placementQuestions[placement.index];
  if (!question) return;
  placement.answers = [...(placement.answers || []), answerIndex];
  if (answerIndex === question.answer) placement.score = (placement.score || 0) + 1;
  placement.index += 1;
  if (placement.index >= APP_DATA.placementQuestions.length) {
    const level = placementLevel(placement.score);
    state.selectedLevel = level;
    persistOnboarding('result', { level, placement });
    setView('onboarding-result');
  } else {
    updateCurrentUser({ onboardingStep: 'placement', placement });
    render();
  }
}

function completeOnboarding() {
  updateCurrentUser({ onboardingCompleted: true, onboardingStep: 'completed' });
  syncUserData();
  toast('Lộ trình cá nhân đã được tạo!');
  setView('home');
}

function handleEditProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const fullName = String(form.get('fullName') || '').trim();
  const level = String(form.get('level') || '');
  if (!fullName) return setFormError('Họ tên không được để trống.');
  updateCurrentUser({ fullName, avatar: initials(fullName), level });
  toast('Đã cập nhật hồ sơ.');
  setView('profile');
}

// ============================================================
// Lesson, SRS, TTS and pronunciation handlers
// ============================================================
function openLesson(lessonId) {
  if (lessonId !== 'topic-particle') return toast('Bài học đang được chuẩn bị.');
  state.selectedWords = [];
  state.sentenceCorrect = Boolean(state.lessonProgress['topic-particle']?.completed);
  setView('lesson');
}

function setupSentenceExercise() {
  const allWords = ['베트남 사람입니다', '저', '는'];
  const zone = document.getElementById('dropZone');
  const box = document.getElementById('chipBox');
  const feedback = document.getElementById('sentenceFeedback');
  function draw() {
    zone.innerHTML = state.selectedWords.length ? state.selectedWords.map((word, index) => `<button class="chip selected" data-selected-word="${index}">${word}</button>`).join('') : '<span class="subtle">Chạm vào các từ bên dưới</span>';
    box.innerHTML = allWords.filter((word) => !state.selectedWords.includes(word)).map((word) => `<button class="chip" data-word="${word}">${word}</button>`).join('');
    box.querySelectorAll('[data-word]').forEach((button) => { button.onclick = () => { state.selectedWords.push(button.dataset.word); state.sentenceCorrect = false; draw(); }; });
    zone.querySelectorAll('[data-selected-word]').forEach((button) => { button.onclick = () => { state.selectedWords.splice(Number(button.dataset.selectedWord), 1); state.sentenceCorrect = false; draw(); }; });
  }
  draw();
  document.getElementById('resetSentence').onclick = () => { state.selectedWords = []; state.sentenceCorrect = false; feedback.textContent = ''; draw(); };
  document.getElementById('checkSentence').onclick = () => {
    state.sentenceCorrect = state.selectedWords.join(' ') === '저 는 베트남 사람입니다';
    feedback.textContent = state.sentenceCorrect ? 'Chính xác! 잘했어요 🎉' : 'Chưa đúng. Gợi ý: 저 + 는 + 베트남 사람입니다';
    feedback.className = `exercise-feedback ${state.sentenceCorrect ? 'success' : 'error'}`;
    const completeButton = document.getElementById('completeLesson');
    if (state.sentenceCorrect && completeButton) completeButton.disabled = false;
  };
}

function completeLesson() {
  if (!state.sentenceCorrect && !state.lessonProgress['topic-particle']?.completed) return;
  const progress = getUserProgress();
  if (!progress.lessonProgress['topic-particle']?.completed) {
    progress.lessonProgress['topic-particle'] = { completed: true, completedAt: new Date().toISOString(), score: 100 };
    progress.stats.lessonsCompleted += 1;
    progress.skills.reading = Math.min(100, progress.skills.reading + 10);
  }
  progress.daily.tasks.lesson = true;
  saveUserProgress(progress);
  toast('Đã lưu tiến độ bài 은/는.');
  setView('home');
}

function rateSrs(rating) {
  const card = dueCards()[0];
  if (!card || !state.flashcardFlipped) return;
  const intervals = { forgot: 10 * 60_000, hard: 24 * 60 * 60_000, remember: 3 * 24 * 60 * 60_000, easy: 7 * 24 * 60 * 60_000 };
  const now = Date.now();
  const cards = state.srsData.map((item) => item.id === card.id ? { ...item, lastReviewed: new Date(now).toISOString(), nextReview: new Date(now + intervals[rating]).toISOString(), reviewCount: (item.reviewCount || 0) + 1, difficulty: rating } : item);
  saveUserSrs(cards);
  const progress = getUserProgress();
  progress.daily.tasks.vocabulary = true;
  progress.stats.wordsLearned = Math.max(progress.stats.wordsLearned, cards.filter((item) => item.reviewCount > 0).length);
  saveUserProgress(progress);
  state.flashcardFlipped = false;
  toast('Đã lên lịch ôn lại thẻ.');
  render();
}

function speakKorean(text) {
  if (!('speechSynthesis' in window)) return toast('Thiết bị chưa hỗ trợ đọc văn bản.');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  utterance.rate = 0.85;
  window.speechSynthesis.speak(utterance);
}

function normalizeKorean(text = '') { return text.toLowerCase().normalize('NFC').replace(/[^가-힣a-z0-9]/g, ''); }

function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row]);
  for (let column = 0; column <= a.length; column += 1) matrix[0][column] = column;
  for (let row = 1; row <= b.length; row += 1) {
    for (let column = 1; column <= a.length; column += 1) {
      matrix[row][column] = b[row - 1] === a[column - 1] ? matrix[row - 1][column - 1] : Math.min(matrix[row - 1][column - 1], matrix[row][column - 1], matrix[row - 1][column]) + 1;
    }
  }
  return matrix[b.length][a.length];
}

function similarityScore(target, transcript) {
  const expected = normalizeKorean(target);
  const actual = normalizeKorean(transcript);
  if (!actual) return 0;
  return Math.max(0, Math.round((1 - levenshtein(expected, actual) / Math.max(expected.length, actual.length, 1)) * 100));
}

function storePronunciationAttempt(transcript) {
  const result = { target: '안녕하세요', transcript, score: similarityScore('안녕하세요', transcript), createdAt: new Date().toISOString() };
  state.pronunciationResult = result;
  const progress = getUserProgress();
  progress.pronunciationAttempts = [result, ...progress.pronunciationAttempts].slice(0, 20);
  progress.daily.tasks.speaking = true;
  progress.skills.speaking = Math.min(100, progress.skills.speaking + 5);
  progress.skills.listening = Math.min(100, progress.skills.listening + 2);
  saveUserProgress(progress);
  return result;
}

function stopMedia() {
  if (state.recognition) {
    try { state.recognition.stop(); } catch (_) { /* Already stopped. */ }
    state.recognition = null;
  }
  if (state.mediaRecorder?.state === 'recording') state.mediaRecorder.stop();
  else {
    state.mediaStream?.getTracks().forEach((track) => track.stop());
    state.mediaStream = null;
    state.recording = false;
    render();
  }
}

async function toggleRecording() {
  if (state.recording) return stopMedia();
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const canRecord = Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
  if (!Recognition && !canRecord) return toast('Trình duyệt chưa hỗ trợ ghi âm hoặc nhận dạng giọng nói.');
  state.chunks = [];
  let transcriptCaptured = false;
  try {
    if (canRecord) {
      state.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      state.mediaRecorder = new MediaRecorder(state.mediaStream);
      state.mediaRecorder.ondataavailable = (event) => { if (event.data.size) state.chunks.push(event.data); };
      state.mediaRecorder.onstop = () => {
        state.mediaStream?.getTracks().forEach((track) => track.stop());
        state.mediaStream = null;
        state.recording = false;
        if (state.chunks.length) {
          if (state.recordedAudioUrl) URL.revokeObjectURL(state.recordedAudioUrl);
          state.recordedAudioUrl = URL.createObjectURL(new Blob(state.chunks, { type: state.mediaRecorder.mimeType || 'audio/webm' }));
        }
        if (state.currentView === 'practice') render();
      };
      state.mediaRecorder.start();
    }
    if (Recognition) {
      state.recognition = new Recognition();
      state.recognition.lang = 'ko-KR';
      state.recognition.interimResults = false;
      state.recognition.maxAlternatives = 1;
      state.recognition.onresult = (event) => { transcriptCaptured = true; storePronunciationAttempt(event.results[0][0].transcript); };
      state.recognition.onerror = (event) => { if (event.error !== 'aborted') toast(`Không thể nhận dạng giọng nói (${event.error}).`); };
      state.recognition.onend = () => {
        state.recognition = null;
        if (!transcriptCaptured) toast('Chưa nhận diện được câu nói. Hãy thử lại ở nơi yên tĩnh.');
        if (state.mediaRecorder?.state === 'recording') state.mediaRecorder.stop();
        else { state.recording = false; render(); }
      };
      state.recognition.start();
    }
    state.recording = true;
    render();
  } catch (error) {
    state.recording = false;
    if (state.mediaRecorder?.state === 'recording') state.mediaRecorder.stop();
    else {
      state.mediaStream?.getTracks().forEach((track) => track.stop());
      state.mediaStream = null;
    }
    toast('Cần cấp quyền micro để luyện phát âm.');
    render();
  }
}

function completePractice() {
  if (state.recording) stopMedia();
  toast('Đã lưu buổi luyện phát âm.');
  setView('home');
}

// ============================================================
// App bootstrap
// ============================================================
document.querySelectorAll('.nav-item').forEach((button) => { button.onclick = () => setView(button.dataset.route); });
document.getElementById('avatarBtn').onclick = () => setView('profile');
window.addEventListener('hashchange', () => {
  const view = location.hash.slice(1);
  if (view && view !== state.currentView) setView(view, { fromHash: true });
});

migrateLegacyStorage();
const restoredUser = auth.restoreSession();
if (restoredUser) {
  state.selectedGoals = [...(restoredUser.goals || [])];
  state.selectedLevel = restoredUser.level || '';
  const requestedView = location.hash.slice(1);
  setView(restoredUser.onboardingCompleted && MAIN_VIEWS.includes(requestedView) ? requestedView : restoredUser.onboardingCompleted ? 'home' : onboardingViewFor(restoredUser));
} else {
  setView(PUBLIC_VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'welcome');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('[K-Learn VN] Service worker không đăng ký được.', error)));
}
