'use strict';

// ============================================================
// Storage and migration layer (replaceable by Supabase later)
// ============================================================
const STORAGE_KEYS = Object.freeze({
  users: 'klearn_users',
  session: 'klearn_session',
  progress: 'klearn_progress',
  srs: 'klearn_srs',
  settings: 'klearn_settings',
  practice: 'klearn_practice',
  practiceHistory: 'klearn_practice_history'
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
  const settings = storage.get(STORAGE_KEYS.settings, {});
  storage.set(STORAGE_KEYS.settings, { ...settings, schemaVersion: 4, language: settings.language || 'vi', updatedAt: new Date().toISOString() });
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
  vocabulary: window.KLEARN_VOCABULARY || []
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
  toastTimer: null,
  practiceFilters: { level: 'all', skill: 'all', difficulty: 'all', status: 'all', topic: 'all', page: 1 },
  practiceSession: null,
  practiceResult: null,
  reviewSelectionCount: 10,
  reviewSession: null,
  pretestSession: null,
  vocabularyTest: null
};

const MAIN_VIEWS = ['home', 'lessons', 'lesson', 'review', 'review-start', 'vocab-pretest', 'pretest-result', 'vocab-test-setup', 'vocab-test', 'vocab-test-result', 'practice', 'practice-hub', 'practice-session', 'practice-result', 'practice-review', 'quick-practice', 'profile', 'edit-profile'];
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

function shuffleArray(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function sampleItems(items, count) { return shuffleArray(items).slice(0, Math.max(0, Math.min(count, items.length))); }

function userPracticeLevel(level = '') {
  if (level.includes('TOPIK II')) return 'TOPIK_II';
  if (level.includes('TOPIK')) return 'TOPIK_I';
  return 'Beginner';
}

function ratingText(percentage) {
  if (percentage >= 90) return 'Rất tốt';
  if (percentage >= 80) return 'Tốt';
  if (percentage >= 60) return 'Cần củng cố';
  return 'Nên ôn lại';
}

// ============================================================
// Practice bank, history and question selection service
// ============================================================
const PracticeService = {
  bank: window.KLEARN_PRACTICE_BANK,
  getHistory() {
    const all = storage.get(STORAGE_KEYS.practiceHistory, {});
    return Array.isArray(all?.[state.currentUser?.id]) ? all[state.currentUser.id] : [];
  },
  getMeta() {
    const all = storage.get(STORAGE_KEYS.practice, {});
    return all?.[state.currentUser?.id] && typeof all[state.currentUser.id] === 'object'
      ? all[state.currentUser.id]
      : { recentQuestionIds: [], weakTopics: {}, activeSession: null };
  },
  saveMeta(meta) {
    const all = storage.get(STORAGE_KEYS.practice, {});
    const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
    safe[state.currentUser.id] = meta;
    storage.set(STORAGE_KEYS.practice, safe);
  },
  setSummary(setId) {
    const attempts = this.getHistory().filter((attempt) => attempt.setId === setId);
    if (!attempts.length) return { status: 'not_started', best: null, latest: null };
    const latest = [...attempts].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
    const best = Math.max(...attempts.map((attempt) => attempt.score));
    return { status: latest.percentage < 60 ? 'needs_review' : 'completed', best, latest };
  },
  filteredSets(filters = state.practiceFilters) {
    const sets = this.bank?.sets || [];
    return sets.filter((set) => {
      const summary = this.setSummary(set.id);
      return (filters.level === 'all' || set.level === filters.level)
        && (filters.skill === 'all' || set.skill === filters.skill || set.skill === 'mixed')
        && (filters.difficulty === 'all' || set.difficulty === Number(filters.difficulty))
        && (filters.status === 'all' || summary.status === filters.status)
        && (filters.topic === 'all' || set.topic === filters.topic);
    });
  },
  prioritizeQuestions(questions, count) {
    const history = this.getHistory();
    const meta = this.getMeta();
    const recent = new Set((meta.recentQuestionIds || []).slice(-80));
    const wrong = new Set(history.flatMap((attempt) => attempt.wrongQuestionIds || []));
    return questions
      .map((question) => ({ question, priority: (wrong.has(question.id) ? 3 : 0) + (!recent.has(question.id) ? 2 : 0) + Math.random() }))
      .sort((a, b) => b.priority - a.priority)
      .map(({ question }) => question)
      .slice(0, count);
  },
  startSet(setId, questionCount = 15) {
    const set = this.bank.sets.find((item) => item.id === setId);
    if (!set) return false;
    const questions = this.prioritizeQuestions(this.bank.getQuestions(set.id), Math.min(questionCount, set.questionCount));
    state.practiceSession = { id: uniqueId(), set, questions, index: 0, answers: [], selected: '', checked: false, startedAt: new Date().toISOString() };
    this.saveMeta({ ...this.getMeta(), activeSession: state.practiceSession });
    setView('practice-session');
    return true;
  },
  startQuick(count, skill) {
    const level = userPracticeLevel(state.currentUser.level);
    let sets = this.bank.sets.filter((set) => set.level === level && (skill === 'mixed' || set.skill === skill || set.skill === 'mixed'));
    if (!sets.length) sets = this.bank.sets.filter((set) => set.level === level);
    const pool = sets.flatMap((set) => this.bank.getQuestions(set.id));
    const questions = this.prioritizeQuestions(pool, count);
    const set = { id: `quick-${level}-${skill}`, title: `Luyện nhanh · ${count} câu`, level, levelLabel: level.replace('_', ' '), skill, topic: 'Luyện nhanh', difficulty: 2, questionCount: count };
    state.practiceSession = { id: uniqueId(), set, questions, index: 0, answers: [], selected: '', checked: false, startedAt: new Date().toISOString(), quick: true };
    this.saveMeta({ ...this.getMeta(), activeSession: state.practiceSession });
    setView('practice-session');
  },
  restoreActive() {
    const active = this.getMeta().activeSession;
    if (active?.questions?.length && active.index < active.questions.length) state.practiceSession = active;
  },
  finish() {
    const session = state.practiceSession;
    const correct = session.answers.filter((answer) => answer.correct).length;
    const total = session.questions.length;
    const percentage = Math.round((correct / total) * 100);
    const skillGroups = {};
    const topicGroups = {};
    session.answers.forEach((answer) => {
      const question = session.questions.find((item) => item.id === answer.questionId);
      if (!question) return;
      if (!skillGroups[question.skill]) skillGroups[question.skill] = { correct: 0, total: 0 };
      if (!topicGroups[question.topic]) topicGroups[question.topic] = { correct: 0, total: 0 };
      skillGroups[question.skill].total += 1;
      topicGroups[question.topic].total += 1;
      if (answer.correct) { skillGroups[question.skill].correct += 1; topicGroups[question.topic].correct += 1; }
    });
    const toPercentages = (groups) => Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, Math.round((value.correct / value.total) * 100)]));
    const attempt = {
      id: session.id,
      userId: state.currentUser.id,
      setId: session.set.id,
      setTitle: session.set.title,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
      score: correct,
      total,
      percentage,
      answers: session.answers,
      wrongQuestionIds: session.answers.filter((answer) => !answer.correct).map((answer) => answer.questionId),
      skillBreakdown: toPercentages(skillGroups),
      topicBreakdown: toPercentages(topicGroups)
    };
    const all = storage.get(STORAGE_KEYS.practiceHistory, {});
    const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
    safe[state.currentUser.id] = [attempt, ...(Array.isArray(safe[state.currentUser.id]) ? safe[state.currentUser.id] : [])].slice(0, 200);
    storage.set(STORAGE_KEYS.practiceHistory, safe);
    const meta = this.getMeta();
    const recent = [...(meta.recentQuestionIds || []), ...session.questions.map((question) => question.id)].slice(-150);
    const weakTopics = { ...(meta.weakTopics || {}) };
    Object.entries(attempt.topicBreakdown).forEach(([topic, score]) => { weakTopics[topic] = score; });
    this.saveMeta({ ...meta, recentQuestionIds: recent, weakTopics, activeSession: null });
    state.practiceResult = { attempt, questions: session.questions, set: session.set };
    state.practiceSession = null;
    setView('practice-result');
  },
  statistics() {
    const history = this.getHistory();
    const completed = history.length;
    const average = completed ? Math.round(history.reduce((sum, attempt) => sum + attempt.percentage, 0) / completed) : 0;
    const topik = history.filter((attempt) => /^t[12]-/.test(attempt.setId));
    const bestTopik = topik.length ? Math.max(...topik.map((attempt) => attempt.score)) : 0;
    return { completed, average, bestTopik, latest: history[0] || null, weakTopics: Object.entries(this.getMeta().weakTopics || {}).sort((a, b) => a[1] - b[1]).slice(0, 3) };
  }
};

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
  return APP_DATA.vocabulary.map((word) => normalizeSrsCard({ ...word, nextReview: due }, word));
}

function normalizeSrsCard(record = {}, vocabularyItem = null) {
  const word = vocabularyItem || APP_DATA.vocabulary.find((item) => item.id === (record.wordId || record.id)) || {};
  const reviewCount = Number(record.reviewCount) || 0;
  const correctCount = Number(record.correctCount) || 0;
  const wrongCount = Number(record.wrongCount) || 0;
  const status = ['new', 'learning', 'review', 'mastered'].includes(record.status)
    ? record.status
    : reviewCount === 0 ? 'new' : record.difficulty === 'easy' ? 'review' : 'learning';
  return {
    ...word,
    ...record,
    id: record.id || word.id || uniqueId(),
    wordId: record.wordId || record.id || word.id,
    userId: state.currentUser?.id || record.userId || null,
    korean: record.korean || word.korean || '',
    meaningVi: record.meaningVi || record.vietnamese || word.meaningVi || '',
    exampleKo: record.exampleKo || record.example || word.exampleKo || '',
    exampleVi: record.exampleVi || record.translation || word.exampleVi || '',
    audioText: record.audioText || word.audioText || record.korean || word.korean || '',
    status,
    reviewCount,
    correctCount,
    wrongCount,
    streakCorrect: Number(record.streakCorrect) || 0,
    lastReviewed: record.lastReviewed || null,
    nextReview: record.nextReview || new Date(Date.now() - 60_000).toISOString(),
    difficulty: record.difficulty || 'new',
    mastery: Math.max(0, Math.min(100, Number(record.mastery) || Math.round((correctCount / Math.max(1, correctCount + wrongCount)) * 100))),
    pretestPassed: Boolean(record.pretestPassed || record.pretestPassedAt),
    pretestPassedAt: record.pretestPassedAt || null,
    skipCurrentSession: Boolean(record.skipCurrentSession),
    lastResult: record.lastResult || null
  };
}

function getUserSrs() {
  if (!state.currentUser) return [];
  const allSrs = storage.get(STORAGE_KEYS.srs, {});
  const safeSrs = allSrs && typeof allSrs === 'object' && !Array.isArray(allSrs) ? allSrs : {};
  const existing = Array.isArray(safeSrs[state.currentUser.id]) ? safeSrs[state.currentUser.id] : [];
  const migrated = existing.map((record) => normalizeSrsCard(record));
  const knownIds = new Set(migrated.map((record) => record.wordId));
  const due = new Date(Date.now() - 60_000).toISOString();
  APP_DATA.vocabulary.forEach((word) => {
    if (!knownIds.has(word.id)) migrated.push(normalizeSrsCard({ ...word, nextReview: due }, word));
  });
  safeSrs[state.currentUser.id] = migrated;
  storage.set(STORAGE_KEYS.srs, safeSrs);
  return migrated;
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

const VocabularyService = {
  dueCards() { return state.srsData.filter((card) => new Date(card.nextReview).getTime() <= Date.now()); },
  bySource(source) {
    if (source === 'wrong') return state.srsData.filter((card) => card.wrongCount > 0).sort((a, b) => b.wrongCount - a.wrongCount);
    if (source === 'mastered') return state.srsData.filter((card) => card.status === 'mastered');
    if (source === 'review') return state.srsData.filter((card) => ['learning', 'review'].includes(card.status));
    return state.srsData.filter((card) => card.reviewCount > 0 || card.status !== 'new');
  },
  optionsFor(card, direction = 'ko_vi') {
    const seen = new Set();
    const pool = APP_DATA.vocabulary.filter((word) => {
      const value = direction === 'vi_ko' ? word.korean : word.meaningVi;
      const correctValue = direction === 'vi_ko' ? card.korean : card.meaningVi;
      if (word.id === card.wordId || value === correctValue || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
    const distractors = sampleItems(pool, 3);
    const correct = direction === 'vi_ko' ? card.korean : card.meaningVi;
    const options = direction === 'vi_ko' ? [card.korean, ...distractors.map((word) => word.korean)] : [card.meaningVi, ...distractors.map((word) => word.meaningVi)];
    return { correct, options: shuffleArray(options) };
  },
  updateCard(wordId, changes) {
    const cards = state.srsData.map((card) => card.wordId === wordId ? normalizeSrsCard({ ...card, ...changes }, card) : card);
    saveUserSrs(cards);
    return cards.find((card) => card.wordId === wordId);
  },
  pretestResult(card, correct, response) {
    const now = new Date().toISOString();
    return this.updateCard(card.wordId, {
      status: correct ? (card.status === 'new' ? 'learning' : card.status) : 'review',
      correctCount: card.correctCount + (correct ? 1 : 0),
      wrongCount: card.wrongCount + (correct ? 0 : 1),
      streakCorrect: correct ? card.streakCorrect + 1 : 0,
      mastery: Math.max(0, Math.min(100, card.mastery + (correct ? 8 : -15))),
      pretestPassed: correct,
      pretestPassedAt: correct ? now : card.pretestPassedAt,
      skipCurrentSession: false,
      lastResult: { wordId: card.wordId, result: correct ? 'correct' : 'wrong', testedAt: now, response, correct }
    });
  },
  skipAfterPretest(card) {
    const days = card.streakCorrect >= 5 ? 30 : card.streakCorrect >= 3 ? 14 : 7;
    return this.updateCard(card.wordId, { skipCurrentSession: true, nextReview: new Date(Date.now() + days * 86400000).toISOString(), status: card.mastery >= 80 ? 'mastered' : 'review' });
  },
  sessionStats() {
    const total = state.srsData.length;
    const mastered = state.srsData.filter((card) => card.status === 'mastered').length;
    const learning = state.srsData.filter((card) => ['learning', 'review'].includes(card.status)).length;
    const reviewed = state.srsData.filter((card) => card.reviewCount > 0);
    const retention = reviewed.length ? Math.round(reviewed.reduce((sum, card) => sum + card.mastery, 0) / reviewed.length) : 0;
    return { total, mastered, learning, retention };
  }
};

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
    state.practiceSession = null;
    state.practiceResult = null;
    state.reviewSession = null;
    state.pretestSession = null;
    state.vocabularyTest = null;
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
    const reviewViews = ['review-start', 'vocab-pretest', 'pretest-result', 'vocab-test-setup', 'vocab-test', 'vocab-test-result'];
    const practiceViews = ['practice-hub', 'practice-session', 'practice-result', 'practice-review', 'quick-practice'];
    const activeView = state.currentView === 'lesson' ? 'lessons'
      : state.currentView === 'edit-profile' ? 'profile'
        : reviewViews.includes(state.currentView) ? 'review'
          : practiceViews.includes(state.currentView) ? 'lessons'
            : state.currentView;
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
  const dueCount = VocabularyService.dueCards().length;
  const practiceStats = PracticeService.statistics();
  const roadmapNames = ['Hangul', 'TOPIK I', 'TOPIK II', 'TOPIK Exam'];
  return `<section class="dashboard-hero section"><p class="eyebrow">Lộ trình cá nhân</p><h1 class="headline">Xin chào, ${escapeHtml(firstName(state.currentUser.fullName))} 👋</h1><p class="korean-motto">오늘도 화이팅!</p></section>
    <section class="card glass section"><div class="streak-line"><strong>🔥 ${progress.stats.streak} ngày liên tiếp</strong><span>${pct}% hôm nay</span></div><div class="bar large"><span style="width:${pct}%"></span></div><div class="daily-tasks"><span>${progress.daily.tasks.vocabulary ? '✓' : '○'} Học/ôn từ vựng</span><span>${progress.daily.tasks.lesson ? '✓' : '○'} Hoàn thành 1 bài</span><span>${progress.daily.tasks.speaking ? '✓' : '○'} Luyện nói 5 phút</span></div></section>
    <section class="dashboard-grid section"><article class="feature-card dark-card"><span class="card-kicker">Tiếp tục học</span><h2>${escapeHtml(state.currentUser.level)} · Unit 3</h2><p>은/는 và 이/가</p><button class="btn light" data-open-lesson="topic-particle">Tiếp tục</button></article><article class="feature-card review-card"><span class="card-kicker">Ôn tập hôm nay</span><h2>🧠 ${dueCount} từ cần ôn</h2><p>Ôn đúng lúc để nhớ lâu hơn.</p><button class="btn primary" data-view="review">Ôn ngay</button></article></section>
    <section class="card practice-promo section"><div><p class="eyebrow">Luyện tập hôm nay</p><h2>Luyện đề tiếng Hàn</h2><p>15 câu theo trình độ · 10 từ cần kiểm tra</p><div class="practice-last-score">${practiceStats.latest ? `Điểm gần nhất: <strong>${practiceStats.latest.score}/${practiceStats.latest.total}</strong>` : 'Bạn chưa làm đề nào'}</div></div><div class="practice-promo-actions"><button class="btn primary" data-view="practice-hub">Luyện ngay</button><button class="btn secondary" data-view="quick-practice">Luyện nhanh</button></div></section>
    <section class="card section"><div class="section-heading"><div><p class="eyebrow">Lộ trình</p><h2 class="section-title">Từ nền tảng đến kỳ thi</h2></div><span class="level-pill">${escapeHtml(state.currentUser.level)}</span></div><div class="roadmap-list">${roadmapNames.map((name, index) => {
      const value = roadmap[index];
      const status = value === null ? 'locked' : value >= 100 ? 'done' : 'active';
      return `<div class="roadmap-row ${status}"><span class="roadmap-icon">${status === 'done' ? '✓' : status === 'locked' ? '🔒' : '▶'}</span><div><strong>${name}</strong><div class="bar"><span style="width:${value || 0}%"></span></div></div><b>${status === 'locked' ? 'Khóa' : `${value}%`}</b></div>`;
    }).join('')}</div></section>`;
}

function lessonsView() {
  const completed = Boolean(state.lessonProgress['topic-particle']?.completed);
  return `<section class="section page-heading"><p class="eyebrow">Khóa học của bạn</p><h1 class="headline">Học theo lộ trình</h1><p class="subtle">Cấu trúc bốn level đã sẵn sàng để bổ sung course, unit và lesson.</p></section><section class="card practice-entry section"><div class="practice-entry-icon">📝</div><div><h2>Luyện đề</h2><p>Luyện theo trình độ, kỹ năng, TOPIK, EPS-TOPIK hoặc chủ đề.</p></div><button class="btn primary" data-view="practice-hub">Mở ngân hàng đề</button></section><section class="course-list">${APP_DATA.courses.map((course, courseIndex) => `<article class="card course-card ${courseIndex > 0 ? 'future-course' : ''}"><div class="course-title"><div><span class="course-number">0${courseIndex + 1}</span><h2>${course.title}</h2></div><span class="level-pill">${course.vocabularyGoal}</span></div>${course.units.map((unit) => `<div class="unit-block"><h3>${unit.title}</h3><div class="lesson-tags">${unit.lessons.map((lesson) => {
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

function practiceHubView() {
  const filters = state.practiceFilters;
  const filtered = PracticeService.filteredSets();
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  filters.page = Math.min(filters.page, totalPages);
  const visibleSets = filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize);
  const topics = [...new Set((PracticeService.bank?.sets || []).map((set) => set.topic))].sort();
  const statusLabels = { not_started: 'Chưa làm', completed: 'Đã làm', needs_review: 'Cần luyện lại' };
  return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">${PracticeService.bank.totalSetCount} bộ · ${PracticeService.bank.totalQuestionCount.toLocaleString('vi-VN')} câu</p><h1 class="headline">Luyện đề</h1><p class="subtle">Câu hỏi nguyên bản mô phỏng phong cách TOPIK/EPS, có đáp án và giải thích tiếng Việt.</p></section>
    <section class="practice-mode-grid section"><button data-practice-level="all"><span>🧭</span><b>Theo trình độ</b></button><button data-practice-skill="mixed"><span>🎯</span><b>Theo kỹ năng</b></button><button data-practice-level="TOPIK_I"><span>🏆</span><b>TOPIK</b></button><button data-practice-level="EPS"><span>🏭</span><b>EPS-TOPIK</b></button><button data-practice-level="VOCABULARY"><span>🗂</span><b>Theo chủ đề</b></button></section>
    <section class="card quick-banner section"><div><p class="eyebrow">Không có nhiều thời gian?</p><h2>Luyện nhanh 5–30 câu</h2></div><button class="btn primary" data-view="quick-practice">Chọn bài nhanh</button></section>
    <section class="card practice-filters section">
      <label>Cấp độ<select data-practice-filter="level"><option value="all">Tất cả</option>${[['Beginner','Beginner'],['TOPIK_I','TOPIK I'],['TOPIK_II','TOPIK II'],['EPS','EPS'],['VOCABULARY','Theo chủ đề']].map(([value, label]) => `<option value="${value}" ${filters.level === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Kỹ năng<select data-practice-filter="skill"><option value="all">Tất cả</option>${[['vocabulary','Từ vựng'],['grammar','Ngữ pháp'],['listening','Nghe'],['reading','Đọc'],['mixed','Tổng hợp']].map(([value, label]) => `<option value="${value}" ${filters.skill === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Độ khó<select data-practice-filter="difficulty"><option value="all">Tất cả</option><option value="1" ${filters.difficulty === '1' ? 'selected' : ''}>Dễ</option><option value="2" ${filters.difficulty === '2' ? 'selected' : ''}>Trung bình</option><option value="3" ${filters.difficulty === '3' ? 'selected' : ''}>Khó</option></select></label>
      <label>Trạng thái<select data-practice-filter="status"><option value="all">Tất cả</option><option value="not_started" ${filters.status === 'not_started' ? 'selected' : ''}>Chưa làm</option><option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>Đã làm</option><option value="needs_review" ${filters.status === 'needs_review' ? 'selected' : ''}>Cần luyện lại</option></select></label>
      <label class="filter-topic">Chủ đề<select data-practice-filter="topic"><option value="all">Tất cả chủ đề</option>${topics.map((topic) => `<option value="${escapeHtml(topic)}" ${filters.topic === topic ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}</select></label>
    </section>
    <div class="results-count">${filtered.length} bộ đề phù hợp</div>
    <section class="practice-set-list">${visibleSets.length ? visibleSets.map((set) => {
      const summary = PracticeService.setSummary(set.id);
      return `<article class="card practice-set-card"><div class="set-card-top"><div><span class="set-level">${escapeHtml(set.levelLabel)}</span><h2>${escapeHtml(set.title)}</h2></div><span class="difficulty difficulty-${set.difficulty}">${['','Dễ','Trung bình','Khó'][set.difficulty]}</span></div><p>${escapeHtml(set.topic)} · ${escapeHtml(set.skillLabel)}</p><div class="set-meta"><span>15 câu</span><span>Điểm cao nhất: ${summary.best === null ? '—' : `${summary.best}/15`}</span><span>${summary.latest ? formatDate(summary.latest.completedAt) : statusLabels[summary.status]}</span></div><button class="btn ${summary.status === 'not_started' ? 'primary' : 'secondary'} full" data-start-set="${set.id}">${summary.status === 'not_started' ? 'Bắt đầu' : 'Làm lại'}</button></article>`;
    }).join('') : '<div class="empty-filter card">Không có bộ đề phù hợp. Hãy thử thay đổi bộ lọc.</div>'}</section>
    <div class="pagination"><button class="btn secondary" data-practice-page="${filters.page - 1}" ${filters.page <= 1 ? 'disabled' : ''}>← Trước</button><span>${filters.page} / ${totalPages}</span><button class="btn secondary" data-practice-page="${filters.page + 1}" ${filters.page >= totalPages ? 'disabled' : ''}>Sau →</button></div>`;
}

function quickPracticeView() {
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">Theo trình độ ${escapeHtml(state.currentUser.level)}</p><h1 class="headline">Luyện nhanh</h1><p class="subtle">Hệ thống ưu tiên câu chưa gặp, câu từng sai và hạn chế câu vừa trả lời đúng.</p></section>
    <form id="quickPracticeForm" class="card choice-form"><fieldset><legend>Số câu</legend><div class="segmented-options">${[5,10,15,20,30].map((count) => `<label><input type="radio" name="count" value="${count}" ${count === 10 ? 'checked' : ''}><span>${count}</span></label>`).join('')}</div></fieldset><fieldset><legend>Kỹ năng</legend><div class="radio-list">${[['vocabulary','Từ vựng'],['grammar','Ngữ pháp'],['listening','Nghe'],['reading','Đọc'],['mixed','Tổng hợp']].map(([value,label]) => `<label><input type="radio" name="skill" value="${value}" ${value === 'mixed' ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset><button class="btn primary full" type="submit">Bắt đầu luyện nhanh</button></form>`;
}

function practiceSessionView() {
  const session = state.practiceSession;
  if (!session?.questions?.length) return `<section class="empty-state"><h1 class="headline">Chưa có phiên luyện</h1><button class="btn primary" data-view="practice-hub">Chọn đề</button></section>`;
  const question = session.questions[session.index];
  const selectedAnswer = session.selected;
  const correct = selectedAnswer === question.correctAnswer;
  return `<div class="lesson-header"><button class="close-btn" id="leavePractice" aria-label="Thoát bài luyện">×</button><div class="lesson-progress"><div class="bar"><span style="width:${Math.round(((session.index + (session.checked ? 1 : 0)) / session.questions.length) * 100)}%"></span></div></div><span class="subtle">${session.index + 1}/${session.questions.length}</span></div>
    <section class="section practice-session-title"><p class="eyebrow">${escapeHtml(session.set.levelLabel || session.set.level)} · ${escapeHtml(session.set.topic)}</p><h1>${escapeHtml(session.set.title)}</h1></section>
    <section class="card live-question"><div class="question-tags"><span>${escapeHtml(question.skill)}</span><span>Độ khó ${question.difficulty}</span></div>${question.koreanText ? `<div class="question-korean">${escapeHtml(question.koreanText)}</div>` : ''}<h2>${escapeHtml(question.prompt)}</h2>${question.audioText ? `<button class="audio-inline" data-speak="${escapeHtml(question.audioText)}">🔊 Nghe</button>` : ''}<div class="answer-list">${question.options.map((option, index) => {
      const answerClass = !session.checked ? (selectedAnswer === option ? 'selected' : '') : option === question.correctAnswer ? 'correct' : selectedAnswer === option ? 'wrong' : '';
      return `<button class="answer-button ${answerClass}" data-practice-answer="${escapeHtml(option)}" ${session.checked ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
    }).join('')}</div>${session.checked ? `<div class="answer-feedback ${correct ? 'success' : 'error'}"><strong>${correct ? '✓ Đúng rồi!' : 'Chưa đúng'}</strong>${!correct ? `<p>Đáp án đúng: <b>${escapeHtml(question.correctAnswer)}</b></p>` : ''}<p>${escapeHtml(question.explanationVi)}</p></div>` : ''}</section>
    <div class="sticky-question-action">${session.checked ? `<button class="btn primary full" id="nextPracticeQuestion">${session.index === session.questions.length - 1 ? 'Xem kết quả' : 'Câu tiếp theo'}</button>` : `<button class="btn primary full" id="checkPracticeAnswer" ${!selectedAnswer ? 'disabled' : ''}>Kiểm tra</button>`}</div>`;
}

function practiceResultView() {
  const result = state.practiceResult;
  if (!result?.attempt) return `<section class="empty-state"><h1 class="headline">Chưa có kết quả</h1><button class="btn primary" data-view="practice-hub">Về Luyện đề</button></section>`;
  const attempt = result.attempt;
  const weakTopics = Object.entries(attempt.topicBreakdown).filter(([, score]) => score < 70).sort((a, b) => a[1] - b[1]).slice(0, 4);
  return `<section class="result-page practice-result-page"><div class="result-score-ring" style="--score:${attempt.percentage * 3.6}deg"><div><strong>${attempt.score}/${attempt.total}</strong><span>${attempt.percentage}%</span></div></div><p class="eyebrow">${ratingText(attempt.percentage)}</p><h1 class="headline">Kết quả luyện đề</h1><div class="result-counts"><span>Đúng <b>${attempt.score}</b></span><span>Sai <b>${attempt.total - attempt.score}</b></span></div>
    <section class="card result-analysis"><h2>Phân tích kỹ năng</h2>${Object.entries(attempt.skillBreakdown).map(([skill, score]) => `<div class="analysis-row"><span>${escapeHtml(skill)}</span><div class="bar"><span style="width:${score}%"></span></div><b>${score}%</b></div>`).join('')}</section>
    <section class="card result-analysis"><h2>Bạn cần ôn thêm</h2>${weakTopics.length ? `<div class="weak-topic-list">${weakTopics.map(([topic, score]) => `<span>${escapeHtml(topic)} · ${score}%</span>`).join('')}</div>` : '<p class="subtle">Bạn đang nắm khá đều các chủ đề trong đề này.</p>'}</section>
    <div class="result-actions">${attempt.wrongQuestionIds.length ? '<button class="btn secondary" data-view="practice-review">Xem lại câu sai</button>' : ''}<button class="btn secondary" data-retry-set="${escapeHtml(result.set.id)}">Làm lại</button><button class="btn primary" data-view="practice-hub">Về Luyện đề</button></div></section>`;
}

function practiceReviewView() {
  const result = state.practiceResult;
  if (!result?.attempt) return practiceResultView();
  const wrongAnswers = result.attempt.answers.filter((answer) => !answer.correct);
  return `<section class="section page-heading"><button class="back-link" data-view="practice-result" aria-label="Quay lại">←</button><p class="eyebrow">${wrongAnswers.length} câu cần xem lại</p><h1 class="headline">Giải thích câu sai</h1></section><section class="wrong-review-list">${wrongAnswers.map((answer, index) => {
    const question = result.questions.find((item) => item.id === answer.questionId);
    return `<article class="card wrong-review-card"><span>Câu ${index + 1}</span>${question.koreanText ? `<div class="question-korean small">${escapeHtml(question.koreanText)}</div>` : ''}<h2>${escapeHtml(question.prompt)}</h2><p>Bạn chọn: <b class="wrong-text">${escapeHtml(answer.selectedAnswer)}</b></p><p>Đáp án: <b class="correct-text">${escapeHtml(question.correctAnswer)}</b></p><div class="explanation-box">${escapeHtml(question.explanationVi)}</div></article>`;
  }).join('')}</section><button class="btn primary full" data-view="practice-result">Quay lại kết quả</button>`;
}

function dueCards() { return VocabularyService.dueCards(); }

function reviewView() {
  const cards = dueCards();
  if (!cards.length) {
    const next = [...state.srsData].sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview))[0];
    return `<section class="empty-state"><div class="celebration">🎉</div><h1 class="headline">Bạn đã ôn xong hôm nay!</h1><p class="subtle">${next ? `Thẻ tiếp theo dự kiến vào ${formatDate(next.nextReview)}.` : 'Hãy quay lại sau khi có từ mới.'}</p><button class="btn secondary" data-view="vocab-test-setup">Kiểm tra vốn từ</button><button class="btn primary" data-view="home">Về trang chủ</button></section>`;
  }
  const max = cards.length;
  const choices = [5, 10, 20, 30, 50].filter((count) => count < max);
  const selected = Math.min(state.reviewSelectionCount || 10, max);
  state.reviewSelectionCount = selected;
  return `<section class="section page-heading"><p class="eyebrow">SRS cá nhân</p><h1 class="headline">Ôn tập hôm nay</h1><p class="subtle">Hôm nay bạn có <strong>${max} từ cần ôn</strong>. Bạn không cần ôn tất cả trong một lần.</p></section>
    <section class="card review-setup-card section"><h2>Bạn muốn ôn bao nhiêu từ?</h2><div class="count-options">${choices.map((count) => `<button class="${selected === count ? 'selected' : ''}" data-review-count="${count}">${count}</button>`).join('')}<button class="${selected === max ? 'selected' : ''}" data-review-count="${max}">Tất cả</button></div><label class="custom-count">Số khác<input id="customReviewCount" type="number" min="1" max="${max}" value="${selected}"></label></section>
    <section class="card start-mode-card section"><h2>Bạn muốn bắt đầu như thế nào?</h2><button class="start-mode recommended" data-review-mode="pretest"><span>✨ Khuyến nghị</span><b>Kiểm tra trước</b><small>Lọc các từ bạn đã nhớ trước khi mở flashcard.</small></button><button class="start-mode" data-review-mode="direct"><b>Ôn ngay</b><small>Mở flashcard với ${selected} từ đã chọn.</small></button></section>
    <button class="btn secondary full" data-view="vocab-test-setup">Kiểm tra vốn từ đã học</button>`;
}

function reviewSessionView() {
  const session = state.reviewSession;
  if (!session?.cardIds?.length || session.index >= session.cardIds.length) {
    return `<section class="empty-state"><div class="celebration">🎉</div><h1 class="headline">Hoàn thành phiên ôn!</h1><p class="subtle">Bạn đã ôn ${session?.completed || 0} từ. Lịch SRS đã được lưu.</p><button class="btn primary" data-view="review">Về Ôn tập</button></section>`;
  }
  const card = state.srsData.find((item) => item.wordId === session.cardIds[session.index]);
  const progress = Math.round((session.index / session.cardIds.length) * 100);
  return `<section class="section page-heading"><p class="eyebrow">Đã ôn ${session.index} / ${session.cardIds.length}</p><h1 class="headline">Flashcard SRS</h1><div class="bar large"><span style="width:${progress}%"></span></div></section>
    <div class="flashcard ${state.flashcardFlipped ? 'flipped' : ''}" id="flipCard" role="button" tabindex="0" aria-label="Lật flashcard"><div class="flashcard-face front"><span class="card-kicker">Tiếng Hàn</span><strong>${escapeHtml(card.korean)}</strong><button type="button" class="flash-audio" data-speak="${escapeHtml(card.audioText)}" aria-label="Nghe phát âm">🔊</button><span class="flip-hint">Chạm để lật</span></div><div class="flashcard-face back"><span class="card-kicker">Tiếng Việt</span><strong>${escapeHtml(card.meaningVi)}</strong><div class="flash-example"><b>${escapeHtml(card.exampleKo)}</b><span>${escapeHtml(card.exampleVi)}</span></div></div></div>
    ${state.flashcardFlipped ? `<div class="srs-actions" aria-label="Đánh giá mức độ ghi nhớ"><button data-srs-rating="forgot"><span>😵</span><b>Quên</b><small>10 phút</small></button><button data-srs-rating="hard"><span>😕</span><b>Khó</b><small>1 ngày</small></button><button data-srs-rating="remember"><span>🙂</span><b>Nhớ</b><small>3–30 ngày</small></button><button data-srs-rating="easy"><span>😎</span><b>Rất dễ</b><small>7–30 ngày</small></button></div>` : '<p class="subtle center">Hãy lật thẻ trước khi tự đánh giá.</p>'}`;
}

function currentPretestCard() {
  const session = state.pretestSession;
  return session ? state.srsData.find((card) => card.wordId === session.cardIds[session.index]) : null;
}

function vocabularyPretestView() {
  const session = state.pretestSession;
  const card = currentPretestCard();
  if (!session || !card) return pretestResultView();
  const direction = session.index % 3 === 1 ? 'vi_ko' : 'ko_vi';
  if (!session.currentQuestion || session.currentQuestion.wordId !== card.wordId) {
    const generated = VocabularyService.optionsFor(card, direction);
    session.currentQuestion = { wordId: card.wordId, direction, ...generated };
  }
  const question = session.currentQuestion;
  const result = session.currentResult;
  const prompt = direction === 'vi_ko' ? `Từ nào có nghĩa là “${card.meaningVi}”?` : session.index % 3 === 2 ? 'Nghe và chọn nghĩa đúng.' : `“${card.korean}” có nghĩa là gì?`;
  return `<section class="section page-heading"><p class="eyebrow">Kiểm tra trước · ${session.index + 1}/${session.cardIds.length}</p><h1 class="headline">Bạn còn nhớ từ này?</h1><div class="bar"><span style="width:${Math.round((session.index / session.cardIds.length) * 100)}%"></span></div></section>
    <section class="card pretest-question"><h2>${escapeHtml(prompt)}</h2>${session.index % 3 === 2 ? `<button class="audio-inline" data-speak="${escapeHtml(card.audioText)}">🔊 Nghe từ</button>` : ''}<div class="answer-list">${question.options.map((option, index) => `<button class="answer-button ${result ? option === question.correct ? 'correct' : result.response === option ? 'wrong' : '' : ''}" data-pretest-answer="${escapeHtml(option)}" ${result ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div></section>
    ${result ? `<section class="card pretest-decision ${result.correct ? 'passed' : 'failed'}"><h2>${result.correct ? '✅ Bạn đã nhớ từ này' : 'Bạn cần ôn lại từ này'}</h2><div class="pretest-word"><strong>${escapeHtml(card.korean)}</strong><span>${escapeHtml(card.meaningVi)}</span></div>${result.correct ? '<p>Bạn muốn bỏ qua trong phiên này hay vẫn ôn để củng cố?</p><div class="action-row"><button class="btn secondary" data-pretest-decision="keep">Vẫn nhắc lại</button><button class="btn primary" data-pretest-decision="skip">Bỏ qua lần này</button></div>' : `<p>Đáp án đúng: <b>${escapeHtml(question.correct)}</b>. Từ này sẽ tự động nằm trong phiên ôn.</p><button class="btn primary full" data-pretest-decision="required">Tiếp tục</button>`}</section>` : ''}`;
}

function pretestResultView() {
  const session = state.pretestSession;
  if (!session) return reviewView();
  const passed = session.results.filter((result) => result.correct);
  const failed = session.results.filter((result) => !result.correct);
  return `<section class="result-page pretest-summary"><div class="celebration">🧠</div><p class="eyebrow">Kiểm tra hoàn tất</p><h1 class="headline">${session.results.length} từ</h1><div class="result-counts"><span>Nhớ tốt <b>${passed.length}</b></span><span>Cần ôn <b>${failed.length}</b></span></div><section class="card"><h2>Lựa chọn phiên ôn</h2><button class="summary-choice recommended" data-pretest-summary="failed"><span>Khuyến nghị</span><b>Chỉ ôn ${failed.length} từ chưa nhớ</b><small>Các từ đã đạt được lùi lịch ôn hợp lý.</small></button><button class="summary-choice" data-pretest-summary="decisions"><b>Theo lựa chọn từng từ</b><small>Giữ các từ bạn đã chọn “Vẫn nhắc lại”.</small></button><button class="summary-choice" data-pretest-summary="all"><b>Vẫn ôn tất cả ${session.results.length} từ</b><small>Củng cố toàn bộ danh sách.</small></button></section></section>`;
}

function vocabularyTestSetupView() {
  return `<section class="section page-heading"><button class="back-link" data-view="review" aria-label="Quay lại">←</button><p class="eyebrow">Đánh giá độc lập</p><h1 class="headline">Kiểm tra vốn từ</h1><p class="subtle">Chọn nguồn từ và số lượng. Từ sai có thể được thêm ngay vào phiên ôn.</p></section><form id="vocabularyTestForm" class="card choice-form"><fieldset><legend>Số từ</legend><div class="segmented-options">${[10,20,30,50].map((count) => `<label><input type="radio" name="count" value="${count}" ${count === 10 ? 'checked' : ''}><span>${count}</span></label>`).join('')}</div></fieldset><fieldset><legend>Nguồn từ</legend><div class="radio-list">${[['learned','Từ đã học'],['wrong','Từ hay sai'],['mastered','Từ mastered'],['review','Từ đang ôn']].map(([value,label]) => `<label><input type="radio" name="source" value="${value}" ${value === 'review' ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset><button class="btn primary full" type="submit">Bắt đầu kiểm tra</button></form>`;
}

function vocabularyTestView() {
  const session = state.vocabularyTest;
  if (!session || session.index >= session.cardIds.length) return vocabularyTestResultView();
  const card = state.srsData.find((item) => item.wordId === session.cardIds[session.index]);
  if (!session.currentQuestion || session.currentQuestion.wordId !== card.wordId) session.currentQuestion = { wordId: card.wordId, ...VocabularyService.optionsFor(card, session.index % 2 ? 'vi_ko' : 'ko_vi') };
  const question = session.currentQuestion;
  const viToKo = session.index % 2 === 1;
  return `<section class="section page-heading"><p class="eyebrow">Kiểm tra vốn từ · ${session.index + 1}/${session.cardIds.length}</p><div class="bar"><span style="width:${Math.round((session.index / session.cardIds.length) * 100)}%"></span></div></section><section class="card pretest-question"><h2>${viToKo ? `Từ nào có nghĩa là “${escapeHtml(card.meaningVi)}”?` : `“${escapeHtml(card.korean)}” có nghĩa là gì?`}</h2><div class="answer-list">${question.options.map((option,index) => `<button class="answer-button" data-vocab-test-answer="${escapeHtml(option)}"><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div></section>`;
}

function vocabularyTestResultView() {
  const session = state.vocabularyTest;
  if (!session?.results) return vocabularyTestSetupView();
  const correct = session.results.filter((result) => result.correct).length;
  const wrong = session.results.filter((result) => !result.correct);
  const percentage = Math.round((correct / Math.max(1, session.results.length)) * 100);
  return `<section class="result-page"><div class="result-score-ring" style="--score:${percentage * 3.6}deg"><div><strong>${correct}/${session.results.length}</strong><span>${percentage}%</span></div></div><p class="eyebrow">${ratingText(percentage)}</p><h1 class="headline">Kết quả vốn từ</h1><div class="result-counts"><span>Đúng <b>${correct}</b></span><span>Sai <b>${wrong.length}</b></span></div><section class="card result-analysis"><h2>Từ cần ôn lại</h2>${wrong.length ? `<div class="weak-topic-list">${wrong.map((result) => { const card = state.srsData.find((item) => item.wordId === result.wordId); return `<span>${escapeHtml(card.korean)} · ${escapeHtml(card.meaningVi)}</span>`; }).join('')}</div>` : '<p class="subtle">Bạn đã trả lời đúng tất cả.</p>'}</section>${wrong.length ? '<button class="btn primary full" id="addWrongToReview">Thêm từ sai vào phiên ôn</button>' : ''}<button class="btn secondary full" data-view="review">Về Ôn tập</button></section>`;
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
  const practiceStats = PracticeService.statistics();
  const vocabularyStats = VocabularyService.sessionStats();
  return `<section class="card profile-head section"><div class="profile-avatar">${escapeHtml(state.currentUser.avatar || initials(state.currentUser.fullName))}</div><h1 class="headline profile-name">${escapeHtml(state.currentUser.fullName)}</h1><p class="subtle">${escapeHtml(state.currentUser.level)} · ${escapeHtml(goals.join(' · '))}</p><div class="stats stats-four"><div class="stat"><b>${progress.stats.lessonsCompleted}</b><small>Bài đã học</small></div><div class="stat"><b>${progress.stats.learningDays}</b><small>Ngày học</small></div><div class="stat"><b>${progress.stats.streak}</b><small>Streak</small></div><div class="stat"><b>${progress.stats.wordsLearned}</b><small>Từ đã học</small></div></div><button class="btn secondary full" data-view="edit-profile">Chỉnh sửa hồ sơ</button></section>
    <section class="card section"><h2 class="section-title">📝 Tiến độ luyện đề</h2><div class="practice-stats"><div><b>${practiceStats.completed}</b><span>Số đề đã làm</span></div><div><b>${practiceStats.average}%</b><span>Điểm trung bình</span></div><div><b>${practiceStats.bestTopik}/15</b><span>TOPIK tốt nhất</span></div></div>${practiceStats.weakTopics.length ? `<h3 class="weak-heading">Điểm yếu của bạn</h3><div class="weak-topic-list">${practiceStats.weakTopics.map(([topic, score]) => `<span>${escapeHtml(topic)} · ${score}%</span>`).join('')}</div>` : '<p class="subtle center">Làm thêm đề để hệ thống tìm chủ đề cần củng cố.</p>'}<button class="btn primary full" data-view="practice-hub">Tiếp tục luyện</button></section>
    <section class="card section"><h2 class="section-title">🧠 Trí nhớ từ vựng</h2><div class="practice-stats"><div><b>${vocabularyStats.learning}</b><span>Đang học</span></div><div><b>${vocabularyStats.mastered}</b><span>Mastered</span></div><div><b>${vocabularyStats.retention}%</b><span>Tỷ lệ nhớ</span></div></div></section>
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
  const views = {
    welcome: welcomeView, register: registerView, login: loginView,
    'onboarding-goals': goalsView, 'onboarding-level': levelView, placement: placementView, 'onboarding-result': onboardingResultView,
    home: homeView, lessons: lessonsView, lesson: lessonView,
    'practice-hub': practiceHubView, 'quick-practice': quickPracticeView, 'practice-session': practiceSessionView, 'practice-result': practiceResultView, 'practice-review': practiceReviewView,
    review: reviewView, 'review-start': reviewSessionView, 'vocab-pretest': vocabularyPretestView, 'pretest-result': pretestResultView,
    'vocab-test-setup': vocabularyTestSetupView, 'vocab-test': vocabularyTestView, 'vocab-test-result': vocabularyTestResultView,
    practice: practiceView, profile: profileView, 'edit-profile': editProfileView
  };
  appElement().innerHTML = (views[state.currentView] || welcomeView)();
  bindEvents();
  window.scrollTo(0, 0);
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
  document.querySelectorAll('[data-open-lesson]').forEach((button) => { button.onclick = () => openLesson(button.dataset.openLesson); });
  document.querySelectorAll('[data-preview-lesson]').forEach((button) => { button.onclick = () => toast(`${button.dataset.previewLesson}: nội dung đang được chuẩn bị.`); });
  document.querySelectorAll('[data-speak]').forEach((button) => { button.onclick = (event) => { event.stopPropagation(); speakKorean(button.dataset.speak); }; });
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
  const flipCard = document.getElementById('flipCard'); if (flipCard) {
    flipCard.onclick = () => { state.flashcardFlipped = !state.flashcardFlipped; render(); };
    flipCard.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); state.flashcardFlipped = !state.flashcardFlipped; render(); } };
  }
  document.querySelectorAll('[data-srs-rating]').forEach((button) => { button.onclick = () => rateSrs(button.dataset.srsRating); });
  document.querySelectorAll('[data-practice-filter]').forEach((select) => { select.onchange = () => { state.practiceFilters[select.dataset.practiceFilter] = select.value; state.practiceFilters.page = 1; render(); }; });
  document.querySelectorAll('[data-practice-level]').forEach((button) => { button.onclick = () => { state.practiceFilters = { ...state.practiceFilters, level: button.dataset.practiceLevel, topic: 'all', page: 1 }; render(); }; });
  document.querySelectorAll('[data-practice-skill]').forEach((button) => { button.onclick = () => { state.practiceFilters = { ...state.practiceFilters, skill: button.dataset.practiceSkill, page: 1 }; render(); }; });
  document.querySelectorAll('[data-practice-page]').forEach((button) => { button.onclick = () => { state.practiceFilters.page = Number(button.dataset.practicePage); render(); }; });
  document.querySelectorAll('[data-start-set]').forEach((button) => { button.onclick = () => PracticeService.startSet(button.dataset.startSet); });
  document.querySelectorAll('[data-retry-set]').forEach((button) => { button.onclick = () => PracticeService.startSet(button.dataset.retrySet); });
  const quickPracticeForm = document.getElementById('quickPracticeForm'); if (quickPracticeForm) quickPracticeForm.onsubmit = startQuickPractice;
  document.querySelectorAll('[data-practice-answer]').forEach((button) => { button.onclick = () => selectPracticeAnswer(button.dataset.practiceAnswer); });
  const checkPracticeAnswer = document.getElementById('checkPracticeAnswer'); if (checkPracticeAnswer) checkPracticeAnswer.onclick = checkPractice;
  const nextPracticeQuestion = document.getElementById('nextPracticeQuestion'); if (nextPracticeQuestion) nextPracticeQuestion.onclick = nextPractice;
  const leavePractice = document.getElementById('leavePractice'); if (leavePractice) leavePractice.onclick = leavePracticeSession;
  document.querySelectorAll('[data-review-count]').forEach((button) => { button.onclick = () => { state.reviewSelectionCount = Number(button.dataset.reviewCount); render(); }; });
  const customReviewCount = document.getElementById('customReviewCount'); if (customReviewCount) customReviewCount.onchange = () => { state.reviewSelectionCount = Math.max(1, Math.min(dueCards().length, Number(customReviewCount.value) || 1)); render(); };
  document.querySelectorAll('[data-review-mode]').forEach((button) => { button.onclick = () => startReviewMode(button.dataset.reviewMode); });
  document.querySelectorAll('[data-pretest-answer]').forEach((button) => { button.onclick = () => answerVocabularyPretest(button.dataset.pretestAnswer); });
  document.querySelectorAll('[data-pretest-decision]').forEach((button) => { button.onclick = () => decideVocabularyPretest(button.dataset.pretestDecision); });
  document.querySelectorAll('[data-pretest-summary]').forEach((button) => { button.onclick = () => startReviewFromPretest(button.dataset.pretestSummary); });
  const vocabularyTestForm = document.getElementById('vocabularyTestForm'); if (vocabularyTestForm) vocabularyTestForm.onsubmit = startVocabularyTest;
  document.querySelectorAll('[data-vocab-test-answer]').forEach((button) => { button.onclick = () => answerVocabularyTest(button.dataset.vocabTestAnswer); });
  const addWrongToReview = document.getElementById('addWrongToReview'); if (addWrongToReview) addWrongToReview.onclick = addWrongVocabularyToReview;
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
// Practice bank and vocabulary assessment handlers
// ============================================================
function saveActivePracticeSession() {
  if (!state.practiceSession) return;
  PracticeService.saveMeta({ ...PracticeService.getMeta(), activeSession: state.practiceSession });
}

function startQuickPractice(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  PracticeService.startQuick(Number(form.get('count')) || 10, String(form.get('skill') || 'mixed'));
}

function selectPracticeAnswer(answer) {
  if (!state.practiceSession || state.practiceSession.checked) return;
  state.practiceSession.selected = answer;
  saveActivePracticeSession();
  render();
}

function checkPractice() {
  const session = state.practiceSession;
  if (!session?.selected || session.checked) return;
  const question = session.questions[session.index];
  session.checked = true;
  session.answers[session.index] = {
    questionId: question.id,
    selectedAnswer: session.selected,
    correct: session.selected === question.correctAnswer,
    answeredAt: new Date().toISOString()
  };
  saveActivePracticeSession();
  render();
}

function nextPractice() {
  const session = state.practiceSession;
  if (!session?.checked) return;
  if (session.index >= session.questions.length - 1) return PracticeService.finish();
  session.index += 1;
  session.selected = '';
  session.checked = false;
  saveActivePracticeSession();
  render();
}

function leavePracticeSession() {
  saveActivePracticeSession();
  toast('Phiên luyện đã được lưu trên thiết bị.');
  setView('practice-hub');
}

function selectedReviewCardIds() {
  const limit = Math.max(1, Math.min(state.reviewSelectionCount, dueCards().length));
  return [...dueCards()]
    .sort((a, b) => (b.wrongCount - a.wrongCount) || (new Date(a.nextReview) - new Date(b.nextReview)))
    .slice(0, limit)
    .map((card) => card.wordId);
}

function beginReviewSession(cardIds) {
  state.reviewSession = { cardIds: [...new Set(cardIds)], index: 0, completed: 0, startedAt: new Date().toISOString() };
  state.flashcardFlipped = false;
  setView('review-start');
}

function startReviewMode(mode) {
  const cardIds = selectedReviewCardIds();
  if (!cardIds.length) return toast('Hiện không có từ đến hạn ôn.');
  if (mode === 'direct') return beginReviewSession(cardIds);
  state.pretestSession = { cardIds, index: 0, results: [], currentQuestion: null, currentResult: null, startedAt: new Date().toISOString() };
  setView('vocab-pretest');
}

function answerVocabularyPretest(response) {
  const session = state.pretestSession;
  const card = currentPretestCard();
  if (!session || !card || session.currentResult) return;
  const correct = response === session.currentQuestion.correct;
  VocabularyService.pretestResult(card, correct, response);
  session.currentResult = { wordId: card.wordId, response, correct, decision: correct ? null : 'required' };
  render();
}

function decideVocabularyPretest(decision) {
  const session = state.pretestSession;
  if (!session?.currentResult) return;
  const latestCard = state.srsData.find((card) => card.wordId === session.currentResult.wordId);
  if (decision === 'skip' && latestCard) VocabularyService.skipAfterPretest(latestCard);
  session.results.push({ ...session.currentResult, decision });
  session.index += 1;
  session.currentQuestion = null;
  session.currentResult = null;
  if (session.index >= session.cardIds.length) setView('pretest-result');
  else render();
}

function startReviewFromPretest(choice) {
  const session = state.pretestSession;
  if (!session) return setView('review');
  let cardIds = session.cardIds;
  if (choice === 'failed') cardIds = session.results.filter((result) => !result.correct).map((result) => result.wordId);
  if (choice === 'decisions') cardIds = session.results.filter((result) => !result.correct || result.decision === 'keep').map((result) => result.wordId);
  beginReviewSession(cardIds);
}

function startVocabularyTest(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const requestedCount = Number(form.get('count')) || 10;
  const source = String(form.get('source') || 'review');
  let pool = VocabularyService.bySource(source);
  if (!pool.length) pool = dueCards().length ? dueCards() : state.srsData;
  const cardIds = sampleItems(pool, Math.min(requestedCount, pool.length)).map((card) => card.wordId);
  state.vocabularyTest = { source, cardIds, index: 0, results: [], currentQuestion: null, startedAt: new Date().toISOString() };
  setView(cardIds.length ? 'vocab-test' : 'vocab-test-result');
}

function answerVocabularyTest(response) {
  const session = state.vocabularyTest;
  if (!session || session.index >= session.cardIds.length) return;
  const card = state.srsData.find((item) => item.wordId === session.cardIds[session.index]);
  const correct = response === session.currentQuestion.correct;
  VocabularyService.pretestResult(card, correct, response);
  session.results.push({ wordId: card.wordId, response, correct, correctAnswer: session.currentQuestion.correct, testedAt: new Date().toISOString() });
  session.index += 1;
  session.currentQuestion = null;
  if (session.index >= session.cardIds.length) setView('vocab-test-result');
  else render();
}

function addWrongVocabularyToReview() {
  const wrongIds = state.vocabularyTest?.results?.filter((result) => !result.correct).map((result) => result.wordId) || [];
  beginReviewSession(wrongIds);
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
  const session = state.reviewSession;
  const card = session?.cardIds?.length ? state.srsData.find((item) => item.wordId === session.cardIds[session.index]) : null;
  if (!card || !state.flashcardFlipped) return;
  const now = Date.now();
  const remembered = rating !== 'forgot';
  const streakCorrect = remembered ? card.streakCorrect + 1 : 0;
  const days = rating === 'hard' ? 1 : rating === 'remember' ? (streakCorrect >= 5 ? 30 : streakCorrect >= 3 ? 14 : 3) : rating === 'easy' ? (streakCorrect >= 5 ? 30 : streakCorrect >= 3 ? 14 : 7) : 0;
  const interval = rating === 'forgot' ? 10 * 60_000 : days * 86400000;
  const mastery = Math.max(0, Math.min(100, card.mastery + (rating === 'forgot' ? -18 : rating === 'hard' ? 4 : rating === 'remember' ? 10 : 15)));
  const updated = VocabularyService.updateCard(card.wordId, {
    lastReviewed: new Date(now).toISOString(),
    nextReview: new Date(now + interval).toISOString(),
    reviewCount: card.reviewCount + 1,
    correctCount: card.correctCount + (remembered ? 1 : 0),
    wrongCount: card.wrongCount + (remembered ? 0 : 1),
    streakCorrect,
    difficulty: rating,
    mastery,
    status: mastery >= 85 && streakCorrect >= 3 ? 'mastered' : remembered ? 'review' : 'learning',
    skipCurrentSession: false,
    lastResult: { wordId: card.wordId, result: remembered ? 'correct' : 'wrong', rating, testedAt: new Date(now).toISOString(), response: rating, correct: remembered }
  });
  const progress = getUserProgress();
  progress.daily.tasks.vocabulary = true;
  progress.stats.wordsLearned = Math.max(progress.stats.wordsLearned, state.srsData.filter((item) => item.reviewCount > 0).length);
  saveUserProgress(progress);
  session.index += 1;
  session.completed += 1;
  state.flashcardFlipped = false;
  toast(`Đã lên lịch ôn lại: ${updated.korean}.`);
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
  PracticeService.restoreActive();
  const requestedView = location.hash.slice(1);
  setView(restoredUser.onboardingCompleted && MAIN_VIEWS.includes(requestedView) ? requestedView : restoredUser.onboardingCompleted ? 'home' : onboardingViewFor(restoredUser));
} else {
  setView(PUBLIC_VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'welcome');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('[K-Learn VN] Service worker không đăng ký được.', error)));
}
