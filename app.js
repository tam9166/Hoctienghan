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
  practiceHistory: 'klearn_practice_history',
  speaking: 'klearn_speaking',
  writing: 'klearn_writing', listeningSessions: 'klearn_listening_sessions', writingAttempts: 'klearn_writing_attempts', speakingSessions: 'klearn_speaking_sessions', conversationHistory: 'klearn_conversation_history', readingExpansion: 'klearn_reading_expansion', realGoalPlans: 'klearn_real_goal_plans', learningJournal: 'klearn_learning_journal', teacherFeedback: 'klearn_teacher_feedback', manualReviewQueue: 'klearn_manual_review_queue', teacherWorkspace: 'klearn_teacher_workspace', communityProgress: 'klearn_community_progress', examAttempts: 'klearn_exam_attempts', notes: 'klearn_notes', bookmarks: 'klearn_bookmarks', resourceProgress: 'klearn_resource_progress', highlights: 'klearn_highlights', supportRequests: 'klearn_support_requests', dictionaryFavorites: 'klearn_dictionary_favorites', savedSentences: 'klearn_saved_sentences', translationHistory: 'klearn_translation_history', recentSearches: 'klearn_recent_searches', handwriting: 'klearn_handwriting', learnerProfile: 'klearn_learner_profile', syncMeta: 'klearn_sync_meta', dailyPlan: 'klearn_daily_plan', notifications: 'klearn_notifications', errors: 'klearn_errors', weeklyReports: 'klearn_weekly_reports', dailyMissions: 'klearn_daily_missions', learningGoals: 'klearn_learning_goals', learningIntelligence: 'klearn_learning_intelligence', adaptiveRoadmaps: 'klearn_adaptive_roadmaps', aiMemory: 'klearn_ai_memory', knowledgeProgress: 'klearn_knowledge_progress', grammarNotebook: 'klearn_grammar_notebook', typingProgress: 'klearn_typing_progress', repairPaths: 'klearn_repair_paths', focusSessions: 'klearn_focus_sessions', checkpoints: 'klearn_checkpoints', offlinePacks: 'klearn_offline_packs', shadowingProgress: 'klearn_shadowing_progress', milestones: 'klearn_milestones', achievements: 'klearn_achievements', contentDrafts: 'klearn_content_drafts', contentCatalogCache: 'klearn_content_catalog_cache', vocabularyCollections: 'klearn_vocabulary_collections', sentenceBuilderProgress: 'klearn_sentence_builder_progress', realLifeProgress: 'klearn_real_life_progress', migrationBackup: 'klearn_migration_backup_v8'
});

const storage = {
  get(key, fallback = null) {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : JSON.parse(raw);
    } catch (error) {
      console.warn(`[Tiếng Hàn - TamHoanq] Dữ liệu ${key} bị lỗi và đã được bỏ qua.`, error);
      try { localStorage.removeItem(key); } catch (_) { /* Storage may be unavailable. */ }
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.warn(`[Tiếng Hàn - TamHoanq] Không thể lưu ${key}.`, error);
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
  if (Number(settings?.schemaVersion || 0) < 9 && !storage.get(STORAGE_KEYS.migrationBackup, null)) {
    storage.set(STORAGE_KEYS.migrationBackup, { createdAt: new Date().toISOString(), schemaVersion: Number(settings?.schemaVersion || 0), users: storage.get(STORAGE_KEYS.users, []), progress: storage.get(STORAGE_KEYS.progress, {}), srs: storage.get(STORAGE_KEYS.srs, {}), settings });
  }
  storage.set(STORAGE_KEYS.settings, {
    ...(settings && typeof settings === 'object' && !Array.isArray(settings) ? settings : {}),
    schemaVersion: 13,
    language: LANGUAGE_VALUES.includes(settings?.language) ? settings.language : 'vi',
    theme: ['system', 'light', 'dark'].includes(settings?.theme) ? settings.theme : 'system',
    users: settings?.users && typeof settings.users === 'object' && !Array.isArray(settings.users) ? settings.users : {},
    updatedAt: new Date().toISOString()
  });
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
    { id: 'foundation-unknown', icon: '🌱', label: 'Tôi chưa biết chữ Hàn', level: 'Level 0', path: 'foundation' },
    { id: 'foundation-reading', icon: '가', label: 'Tôi biết Hangul nhưng đọc chậm', level: 'Beginner Reading', path: 'reading' },
    { id: 'beginner-placement', icon: '첫', label: 'Tôi biết một số từ', level: 'Beginner Placement', path: 'beginner-placement' },
    { id: 'placement', icon: '🏆', label: 'Tôi đã học TOPIK', level: 'Placement Test', path: 'placement' }
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
    { prompt: '“비가 와서 집에 있어요.” diễn đạt ý nào?', options: ['Vì trời mưa nên tôi ở nhà.', 'Nếu trời mưa tôi sẽ đi.', 'Tuy mưa nhưng tôi ra ngoài.', 'Tôi thích ngôi nhà khi mưa.'], answer: 0, dimension: 'grammar', difficulty: 2 },
    { prompt: '“회의가 오후 세 시에 시작됩니다.” nghĩa là gì?', options: ['Cuộc họp bắt đầu lúc 3 giờ chiều.', 'Cuộc họp kết thúc lúc 3 giờ.', 'Tôi đi làm lúc 3 giờ.', 'Cuộc họp ở tầng 3.'], answer: 0, dimension: 'vocabulary', difficulty: 2 },
    { prompt: 'Đọc đoạn: 민수는 주말마다 도서관에서 공부합니다. 민수는 어디에서 공부합니까?', options: ['Ở nhà', 'Ở thư viện', 'Ở trường', 'Ở công ty'], answer: 1, dimension: 'reading', difficulty: 2 },
    { prompt: 'Nghe/đọc câu: “내일 비가 올 것 같아요.” Dự đoán là gì?', options: ['Ngày mai có vẻ sẽ mưa.', 'Hôm qua đã mưa.', 'Bây giờ trời nắng.', 'Tuần sau sẽ lạnh.'], answer: 0, dimension: 'listening', difficulty: 3 },
    { prompt: 'Chọn câu tự nhiên hơn khi nói với giáo viên:', options: ['선생님, 질문 있어요.', '선생님, 질문 있다.', '선생님, 질문 있어.', '선생님, 질문이 있냐?'], answer: 0, dimension: 'grammar', difficulty: 3 },
    { prompt: '“환경 보호를 위해 대중교통을 이용해야 합니다.” ý chính là gì?', options: ['Nên dùng phương tiện công cộng để bảo vệ môi trường.', 'Không được đi xe buýt.', 'Môi trường đang rất sạch.', 'Tôi muốn mua ô tô.'], answer: 0, dimension: 'reading', difficulty: 4 }
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
  learningLanguage: 'vi',
  currentView: 'welcome',
  onboardingStep: 'goals',
  selectedGoals: [],
  selectedLevel: '',
  selectedOnboardingPath: '',
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
  listeningStudio: { tier: 'beginner', mode: 'listen', index: 0, playing: false, speed: 1, position: 0, loopA: null, loopB: null, transcriptVisible: true, romanizationVisible: true, translationVisible: true, dictation: '', dictationResult: null, quizAnswer: null },
  writingRoom: { draft: '', startedAt: null, deadlineAt: null, mode: 'sentence' },
  speakingRoomMode: 'repeat',
  examSession: null,
  examResult: null,
  reviewSelectionCount: 10,
  reviewSession: null,
  pretestSession: null,
  vocabularyTest: null,
  practiceSearch: '',
  vocabularyFilters: { topikLevel: 'all', topic: 'all', partOfSpeech: 'all', status: 'all', search: '', page: 1 },
  reviewSource: 'due',
  reviewTopic: 'all',
  selectedSkillHub: 'listening',
  speakingMode: 'sentence',
  speakingPrompt: null,
  speakingResult: null,
  writingLevel: 3,
  writingMode: 'paragraph',
  writingPrompt: null,
  writingSubmission: null,
  selectedLessonPreview: '',
  selectedCourseId: 'beginner',
  selectedStrategyId: '',
  lessonStep: 0,
  lessonCheck: null,
  contextDictionaryTerm: '',
  questionRomanization: {},
  roleplayHintVisible: false
  ,resourceFilters: { type: 'all', level: 'all', search: '' }, selectedResourceId: '', selectedVideoId: '', selectedNoteId: '', selectedBookmarkType: 'all', videoChapterTime: 0, supportDraft: { type: 'general', sourceId: '' }
  ,dictionaryQuery: '', dictionarySelectedId: '', dictionaryFilter: 'all', translationDraft: '', translationDirection: 'vi-ko', translationResult: null, handwritingCharacter: '한', handwritingStage: 1
  ,aiOpen: false, aiConversationId: '', aiDraft: '', aiBusy: false
  ,globalQuery: '', smartReviewMinutes: 20, cloudUser: null, cloudAuthBusy: false, cloudAuthMessage: ''
};

const FOUNDATION_VIEWS = ['foundation', 'hangul-academy', 'syllable-builder', 'reading-first', 'batchim-academy', 'minimal-pairs', 'first-words', 'first-sentence', 'beginner-checkpoint'];
const MAIN_VIEWS = ['home', 'lessons', 'courses', 'course-detail', 'theory', 'roadmap', 'topik', 'strategy-lab', 'strategy-detail', 'listening-studio', 'sentence-writing', 'writing-room', 'speaking-room', 'topik-exam', 'topik-exam-result', 'resources', 'resource-view', 'notes', 'bookmarks', 'videos', 'video-view', 'support', 'review-dashboard', 'ai-coach', 'adaptive-plan', 'error-notebook', 'grammar-compare', 'grammar-notebook', 'typing-trainer', 'repair-path', 'focus-study', 'chapter-checkpoint', 'offline-packs', 'shadowing-recorder', 'study-calendar', 'progress-timeline', 'achievements', 'admin-content', 'vocabulary-collections', 'sentence-builder', 'real-life-missions', 'study-settings', ...FOUNDATION_VIEWS, 'lesson', 'lesson-preview', 'dictionary', 'translation-hub', 'phrasebook', 'handwriting', 'review', 'smart-review', 'search', 'analytics', 'weekly-insights', 'progress-reports', 'practical-korean', 'vocabulary-notebook', 'review-start', 'vocab-pretest', 'pretest-result', 'vocab-test-setup', 'vocab-test', 'vocab-test-result', 'vocabulary-hub', 'practice', 'speaking-hub', 'speaking-session', 'speaking-result', 'writing-hub', 'writing-editor', 'writing-result', 'skill-hub', 'practice-hub', 'exam-catalog', 'random-exam', 'advanced-practice', 'wrong-practice', 'saved-exams', 'practice-history', 'practice-session', 'practice-result', 'practice-review', 'quick-practice', 'profile', 'edit-profile'];
MAIN_VIEWS.push('conversation-simulator');
MAIN_VIEWS.push('natural-korean');
MAIN_VIEWS.push('reading-lab', 'reading-session', 'word-network', 'collocation-trainer', 'dictation-master');
MAIN_VIEWS.push('topik-strategy-center', 'real-goal-planner', 'learning-journal', 'teacher-review', 'manual-review-queue', 'teacher-workspace', 'community-hub', 'personal-report');
const PUBLIC_VIEWS = ['welcome', 'login', 'register'];
const ONBOARDING_VIEWS = ['onboarding-goals', 'onboarding-level', 'beginner-placement', 'placement', 'onboarding-result'];

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
}

function normalizeEmail(value = '') { return String(value).trim().toLowerCase(); }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function firstName(fullName = '') { return fullName.trim().split(/\s+/).filter(Boolean).pop() || 'bạn'; }
function initials(fullName = '') { return (firstName(fullName).charAt(0) || '한').toUpperCase(); }
function appElement() { return document.getElementById('app'); }
function formatDate(value) { return new Intl.DateTimeFormat(I18nService?.locale?.()?.htmlLang || 'vi', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)); }

const THEME_VALUES = Object.freeze(['system', 'light', 'dark']);
const THEME_COLORS = Object.freeze({ light: '#C5ED4F', dark: '#1C2416' });

const ThemeService = {
  isValid(value) { return THEME_VALUES.includes(value); },
  getPreference() {
    const settings = storage.get(STORAGE_KEYS.settings, {});
    const saved = state.currentUser?.id && settings?.users?.[state.currentUser.id];
    if (this.isValid(saved?.theme)) return saved.theme;
    return this.isValid(settings?.theme) ? settings.theme : 'system';
  },
  resolve(preference = this.getPreference()) {
    if (preference !== 'system') return preference;
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  },
  apply(preference = this.getPreference()) {
    const safePreference = this.isValid(preference) ? preference : 'system';
    const resolved = this.resolve(safePreference);
    const root = document.documentElement;
    root.dataset.themePreference = safePreference;
    root.dataset.theme = resolved;
    root.style.colorScheme = resolved;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => { meta.setAttribute('content', THEME_COLORS[resolved]); });
    return resolved;
  },
  setPreference(preference) {
    const safePreference = this.isValid(preference) ? preference : 'system';
    const rawSettings = storage.get(STORAGE_KEYS.settings, {});
    const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? { ...rawSettings } : {};
    const users = settings?.users && typeof settings.users === 'object' && !Array.isArray(settings.users) ? { ...settings.users } : {};
    settings.theme = safePreference;
    if (state.currentUser?.id) {
      users[state.currentUser.id] = { ...(users[state.currentUser.id] || {}), theme: safePreference, updatedAt: new Date().toISOString() };
    }
    storage.set(STORAGE_KEYS.settings, { ...settings, schemaVersion: 13, language: LANGUAGE_VALUES.includes(settings?.language) ? settings.language : 'vi', users, updatedAt: new Date().toISOString() });
    this.apply(safePreference);
  },
  watchSystemTheme() {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return;
    const listener = () => { if (this.getPreference() === 'system') this.apply('system'); };
    media.addEventListener?.('change', listener);
    media.addListener?.(listener);
  }
};

const LANGUAGE_VALUES = Object.freeze(['vi', 'en', 'zh-CN']);
const I18nService = {
  values: LANGUAGE_VALUES,
  isValid(value) { return LANGUAGE_VALUES.includes(value); },
  getPreference() {
    const rawSettings = storage.get(STORAGE_KEYS.settings, {});
    const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? rawSettings : {};
    const saved = state.currentUser?.id && settings?.users?.[state.currentUser.id];
    const language = this.isValid(saved?.language) ? saved.language : (this.isValid(settings?.language) ? settings.language : 'vi');
    state.learningLanguage = language;
    return language;
  },
  locale() { return window.KLEARN_LOCALES?.[this.getPreference()] || window.KLEARN_LOCALES?.vi || { keys: {}, phrases: {} }; },
  t(key, variables = {}) {
    const current = this.locale();
    const translated = current.keys?.[key];
    if (typeof translated !== 'string') {
      if (this.getPreference() !== 'vi') console.warn(`[i18n] Missing ${this.getPreference()} key: ${key}`);
      return this.getPreference() === 'vi' ? String(window.KLEARN_LOCALES?.vi?.keys?.[key] || '') : '';
    }
    return translated.replace(/\{(\w+)\}/g, (_, name) => variables[name] ?? '');
  },
  number(value) { return new Intl.NumberFormat(this.locale().htmlLang || 'vi').format(Number(value) || 0); },
  countLabel(kind, count) {
    const n = Number(count) || 0; const locale = this.getPreference(); const value = this.number(n);
    const labels = {
      vi: { words: `${value} từ`, questions: `${value} câu`, minutes: `${value} phút`, lessons: `${value} bài`, days: `${value} ngày` },
      en: { words: `${value} ${n === 1 ? 'word' : 'words'}`, questions: `${value} ${n === 1 ? 'question' : 'questions'}`, minutes: `${value} ${n === 1 ? 'minute' : 'minutes'}`, lessons: `${value} ${n === 1 ? 'lesson' : 'lessons'}`, days: `${value} ${n === 1 ? 'day' : 'days'}` },
      'zh-CN': { words: `${value} 个单词`, questions: `${value} 题`, minutes: `${value} 分钟`, lessons: `${value} 课`, days: `${value} 天` }
    };
    return labels[locale]?.[kind] || labels.vi[kind];
  },
  translateText(text) {
    const value = String(text);
    const locale = this.locale();
    if (locale.phrases?.[value]) return locale.phrases[value];
    for (const resource of Object.values(window.KLEARN_LOCALES || {})) {
      const source = Object.entries(resource.phrases || {}).find(([, translated]) => translated === value)?.[0];
      if (source) return locale.phrases?.[source] || (this.getPreference() === 'vi' ? source : value);
    }
    const greeting = value.match(/^Xin chào, (.+) 👋$/);
    if (greeting) return this.t('home.greeting', { name: greeting[1] });
    const englishGreeting = value.match(/^Hello, (.+) 👋$/);
    if (englishGreeting) return this.t('home.greeting', { name: englishGreeting[1] });
    const chineseGreeting = value.match(/^你好，(.+) 👋$/);
    if (chineseGreeting) return this.t('home.greeting', { name: chineseGreeting[1] });
    if (value === 'Hôm nay bạn muốn học gì?') return this.t('home.prompt');
    return value;
  },
  translateDOM(root = document) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const parent = node.parentElement;
      if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'PRE'].includes(parent.tagName)) return;
      const leading = node.nodeValue.match(/^\s*/)?.[0] || '';
      const trailing = node.nodeValue.match(/\s*$/)?.[0] || '';
      const core = node.nodeValue.trim();
      if (core) node.nodeValue = `${leading}${this.translateText(core)}${trailing}`;
    });
    root.querySelectorAll?.('[placeholder], [aria-label], [title]').forEach((element) => {
      ['placeholder', 'aria-label', 'title'].forEach((attribute) => {
        if (element.hasAttribute(attribute)) element.setAttribute(attribute, this.translateText(element.getAttribute(attribute)));
      });
    });
    root.querySelectorAll?.('.korean-learning-text, .vocabulary-row, .flashcard, .flash-example').forEach((block) => {
      const koreanNode = block.querySelector('[lang="ko"]');
      const meaning = koreanNode && I18nService.localizedText({ korean: koreanNode.textContent.trim() }, 'meaning');
      if (!meaning) return;
      const target = block.matches('.vocabulary-row') ? block.querySelector('div span') : block.matches('.flashcard') ? block.querySelector('.flashcard-face.back strong') : block.querySelector('.learning-meaning, .flash-example span');
      if (target && !target.closest('[lang="ko"]')) target.textContent = meaning;
    });
  },
  setPreference(language) {
    const safeLanguage = this.isValid(language) ? language : 'vi';
    const rawSettings = storage.get(STORAGE_KEYS.settings, {});
    const settings = rawSettings && typeof rawSettings === 'object' && !Array.isArray(rawSettings) ? { ...rawSettings } : {};
    const users = settings.users && typeof settings.users === 'object' && !Array.isArray(settings.users) ? { ...settings.users } : {};
    settings.language = safeLanguage;
    if (state.currentUser?.id) users[state.currentUser.id] = { ...(users[state.currentUser.id] || {}), language: safeLanguage, updatedAt: new Date().toISOString() };
    storage.set(STORAGE_KEYS.settings, { ...settings, schemaVersion: 13, language: LANGUAGE_VALUES.includes(settings.language) ? settings.language : 'vi', users, updatedAt: new Date().toISOString() });
    document.documentElement.lang = window.KLEARN_LOCALES?.[safeLanguage]?.htmlLang || safeLanguage;
    state.learningLanguage = safeLanguage;
  },
  localizedText(item, field = 'meaning', locale = this.getPreference()) {
    if (!item || typeof item !== 'object') return '';
    const overlay = window.KLEARN_CONTENT_TRANSLATIONS?.[item.korean || item.koreanText || item.appLine];
    const container = item[`${field}s`] || item[field] || overlay?.[field];
    if (container && typeof container === 'object' && !Array.isArray(container)) {
      for (const candidate of locale === 'vi' ? ['vi', 'en'] : [locale, 'en']) if (typeof container[candidate] === 'string' && container[candidate].trim()) return container[candidate];
    }
    const suffixes = locale === 'zh-CN' ? ['Zh', 'ZhCN'] : locale === 'en' ? ['En'] : ['Vi'];
    for (const suffix of suffixes) {
      const candidate = item[`${field}${suffix}`];
      if (typeof candidate === 'string' && candidate.trim()) return candidate;
    }
    const legacy = locale === 'vi' ? (field === 'meaning' ? ['meaningVi', 'vietnamese', 'translationVi'] : field === 'example' ? ['exampleVi', 'translation'] : []) : (field === 'meaning' ? ['meaningEn', 'translationEn'] : field === 'example' ? ['exampleEn', 'translationEn'] : []);
    return legacy.map((key) => item[key]).find((value) => typeof value === 'string' && value.trim()) || '';
  },
  getLocalizedValue(value, locale = this.getPreference(), fallback = '') {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const candidate of locale === 'vi' ? ['vi', 'en'] : [locale, 'en']) if (typeof value[candidate] === 'string' && value[candidate].trim()) return value[candidate];
      return fallback;
    }
    return typeof value === 'string' ? value : fallback;
  },
  localizedArray(values = [], locale = this.getPreference()) { return Array.isArray(values) ? values.map((value) => this.getLocalizedValue(value, locale, '')).filter(Boolean) : []; },
  localizeQuestion(question, locale = this.getPreference()) {
    if (!question || typeof question !== 'object') return question;
    return {
      ...question,
      prompt: this.getLocalizedValue(question.promptLocales || question.prompts || (locale === 'vi' ? question.prompt : null), locale, locale === 'vi' ? (question.prompt || '') : (question.koreanText || '')),
      options: this.localizedArray(question.optionsLocales || question.optionLocales || question.options, locale).length ? this.localizedArray(question.optionsLocales || question.optionLocales || question.options, locale) : (question.options || []),
      explanation: this.getLocalizedValue(question.explanations || question.explanationLocales || question.explanation, locale, locale === 'vi' ? (question.explanation || question.explanationVi || '') : '')
    };
  },
  auditTranslations() {
    const base = Object.keys(window.KLEARN_LOCALES?.vi?.keys || {});
    return {
      missingEn: base.filter((key) => typeof window.KLEARN_LOCALES?.en?.keys?.[key] !== 'string'),
      missingZh: base.filter((key) => typeof window.KLEARN_LOCALES?.['zh-CN']?.keys?.[key] !== 'string')
    };
  },
  updateHeader() {
    const locale = this.getPreference();
    const themePreference = ThemeService.getPreference();
    const code = document.getElementById('languageCode');
    if (code) code.textContent = window.KLEARN_LOCALES?.[locale]?.short || locale.toUpperCase();
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) themeIcon.textContent = themePreference === 'dark' ? '🌙' : themePreference === 'light' ? '☀️' : '◐';
    document.querySelectorAll('[data-theme-choice-header]').forEach((item) => item.setAttribute('aria-checked', String(item.dataset.themeChoiceHeader === themePreference)));
    document.querySelectorAll('[data-language-choice]').forEach((item) => item.setAttribute('aria-checked', String((item.dataset.languageChoice || item.value) === locale)));
    const languageButton = document.getElementById('languageBtn');
    if (languageButton) languageButton.setAttribute('aria-label', this.t('language.title'));
    const themeButton = document.getElementById('themeBtn');
    if (themeButton) themeButton.setAttribute('aria-label', this.t('theme.title'));
    const navKeys = { home: 'nav.home', lessons: 'nav.learn', topik: 'nav.topik', review: 'nav.review', 'ai-coach': 'nav.assistant', profile: 'nav.profile' };
    document.querySelectorAll('.nav-item[data-route]').forEach((item) => {
      const label = item.querySelector('span:last-child');
      if (label && navKeys[item.dataset.route]) label.textContent = this.t(navKeys[item.dataset.route]);
    });
  },
  applyDocument() {
    document.documentElement.lang = window.KLEARN_LOCALES?.[this.getPreference()]?.htmlLang || this.getPreference();
    this.translateDOM(document);
    this.updateHeader();
  }
};
window.auditTranslations = () => I18nService.auditTranslations();

function getUserSettings() {
  const settings = storage.get(STORAGE_KEYS.settings, {});
  const saved = state.currentUser?.id && settings?.users?.[state.currentUser.id];
  const migratedDefault = typeof settings?.showRomanization === 'boolean' ? settings.showRomanization : true;
  return {
    showRomanization: typeof saved?.showRomanization === 'boolean' ? saved.showRomanization : migratedDefault,
    theme: ThemeService.isValid(saved?.theme) ? saved.theme : (ThemeService.isValid(settings?.theme) ? settings.theme : 'system'),
    language: I18nService.isValid(saved?.language) ? saved.language : (I18nService.isValid(settings?.language) ? settings.language : 'vi'),
    translationDisplay: ['always', 'tap', 'hidden'].includes(saved?.translationDisplay) ? saved.translationDisplay : 'always',
    audioSpeed: [0.5, 0.75, 1, 1.25, 1.5].includes(Number(saved?.audioSpeed)) ? Number(saved.audioSpeed) : 1,
    autoPlayAudio: saved?.autoPlayAudio === true,
    koreanFontSize: ['small', 'medium', 'large'].includes(saved?.koreanFontSize) ? saved.koreanFontSize : 'medium',
    dailyVocabularyTarget: Math.max(5, Math.min(100, Number(saved?.dailyVocabularyTarget) || 10)),
    practiceDifficulty: ['easy', 'balanced', 'challenging'].includes(saved?.practiceDifficulty) ? saved.practiceDifficulty : 'balanced',
    guidanceLevel: ['self', 'guided', 'high'].includes(saved?.guidanceLevel) ? saved.guidanceLevel : 'guided'
  };
}

function showRomanizationEnabled() { return getUserSettings().showRomanization; }

function setShowRomanization(showRomanization) {
  if (!state.currentUser) return;
  const settings = storage.get(STORAGE_KEYS.settings, {});
  const users = settings?.users && typeof settings.users === 'object' && !Array.isArray(settings.users) ? { ...settings.users } : {};
  users[state.currentUser.id] = { ...(users[state.currentUser.id] || {}), showRomanization: Boolean(showRomanization), updatedAt: new Date().toISOString() };
  storage.set(STORAGE_KEYS.settings, { ...settings, schemaVersion: 13, language: LANGUAGE_VALUES.includes(settings?.language) ? settings.language : 'vi', users, updatedAt: new Date().toISOString() });
}

function getRomanization(itemOrText = '') {
  const item = typeof itemOrText === 'object' && itemOrText ? itemOrText : { korean: itemOrText };
  if (Object.prototype.hasOwnProperty.call(item, 'romanization')) return item.romanization || '';
  return window.KLEARN_ROMANIZATION?.romanize(item.korean || item.koreanText || item.appLine || '') || '';
}

function getDisplayPronunciation(item = {}) {
  const romanization = getRomanization(item);
  const pronunciationRomanization = item.pronunciationRomanization || window.KLEARN_ROMANIZATION?.getPronunciation(item.korean || item.koreanText || item.appLine || '') || '';
  return pronunciationRomanization && pronunciationRomanization !== romanization ? pronunciationRomanization : '';
}

let contextDictionaryIndex = null;
function contextualizeKorean(text = '') {
  const value = String(text || '');
  if (!value) return '';
  if (!contextDictionaryIndex) {
    contextDictionaryIndex = new Map((DictionaryService.all?.() || []).filter((item) => item?.korean && !/[\s?!.,。！？]/.test(item.korean)).map((item) => [normalizeSearch(item.korean), item]));
  }
  return value.split(/(\s+)/).map((part) => {
    const clean = part.replace(/[.,!?。！？、:;()\[\]{}“”"']/g, '');
    const entry = contextDictionaryIndex.get(normalizeSearch(clean));
    return entry && clean ? `<button type="button" class="context-word" data-context-word="${escapeHtml(entry.korean)}" lang="ko">${escapeHtml(part)}</button>` : escapeHtml(part);
  }).join('');
}

function renderKoreanLearningText(item = {}, options = {}) {
  const korean = item.korean || item.koreanText || item.appLine || '';
  const meaningVi = I18nService.localizedText(item, 'meaning');
  const exampleVi = I18nService.localizedText(item, 'example');
  const romanization = getRomanization({ ...item, korean });
  const pronunciationRomanization = getDisplayPronunciation({ ...item, korean });
  const showRomanization = options.forceRomanization ?? showRomanizationEnabled();
  const sizeClass = options.compact ? ' compact' : '';
  return `<div class="korean-learning-text${sizeClass}"><div class="learning-hangul${options.contextual ? ' contextual-line' : ''}" lang="ko">${options.contextual ? contextualizeKorean(korean) : escapeHtml(korean)}</div>${showRomanization && romanization ? `<div class="learning-romanization">${pronunciationRomanization ? `<span><b>${I18nService.t('romanization.label')}:</b> ${escapeHtml(romanization)}</span><span><b>${I18nService.t('romanization.actual')}:</b> ${escapeHtml(pronunciationRomanization)}</span>` : escapeHtml(romanization)}</div>` : ''}${meaningVi ? `<div class="learning-meaning">${escapeHtml(meaningVi)}</div>` : ''}${options.includeExample && exampleVi ? `<div class="learning-example">${escapeHtml(exampleVi)}</div>` : ''}</div>`;
}

function renderRomanizationToggle(compact = false) {
  const enabled = showRomanizationEnabled();
  return `<button class="romanization-toggle${compact ? ' compact' : ''}" data-romanization-toggle aria-pressed="${enabled}"><span>Aa</span><b>${I18nService.t('romanization.label')}: ${enabled ? I18nService.t('romanization.on') : I18nService.t('romanization.off')}</b></button>`;
}

function toast(message) {
  const element = document.getElementById('toast');
  clearTimeout(state.toastTimer);
  if (!element) return;
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
  const explicit = String(level).match(/[1-6]/)?.[0];
  if (explicit) return `TOPIK_${explicit}`;
  if (level.includes('TOPIK II')) return 'TOPIK_3';
  if (level.includes('TOPIK I')) return 'TOPIK_2';
  return 'Beginner';
}

function inferredTopikLevel(level = '') {
  const explicit = Number(String(level).match(/[1-6]/)?.[0]);
  if (explicit) return explicit;
  if (level.includes('TOPIK II')) return 3;
  if (level.includes('TOPIK I')) return 2;
  return 1;
}

function topikLabel(level) { return `TOPIK ${Math.max(1, Math.min(6, Number(level) || 1))}`; }

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
      : { recentQuestionIds: [], weakTopics: {}, wrongPriorities: {}, savedSetIds: [], activeSession: null };
  },
  saveMeta(meta) {
    const all = storage.get(STORAGE_KEYS.practice, {});
    const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
    safe[state.currentUser.id] = meta;
    storage.set(STORAGE_KEYS.practice, safe);
  },
  setSummary(setId) {
    const attempts = this.getHistory().filter((attempt) => attempt.setId === setId);
    if (!attempts.length) return { status: 'not_started', best: null, latest: null, attemptCount: 0 };
    const latest = [...attempts].sort((a, b) => new Date(b.completedAt) - new Date(a.completedAt))[0];
    const best = Math.max(...attempts.map((attempt) => attempt.score));
    return { status: latest.percentage < 60 ? 'needs_review' : 'completed', best, latest, attemptCount: attempts.length };
  },
  filteredSets(filters = state.practiceFilters) {
    const sets = this.bank?.sets || [];
    return sets.filter((set) => {
      const summary = this.setSummary(set.id);
      return (filters.level === 'all' || set.level === filters.level)
        && (filters.skill === 'all' || set.skill === filters.skill || set.skill === 'mixed')
        && (filters.difficulty === 'all' || set.difficulty === Number(filters.difficulty))
        && (filters.status === 'all' || summary.status === filters.status)
        && (filters.topic === 'all' || set.topic === filters.topic)
        && (!state.practiceSearch || `${set.title} ${set.topic} ${set.practiceTypeLabel}`.toLowerCase().includes(state.practiceSearch.toLowerCase()));
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
    state.questionRomanization = {};
    state.practiceSession = { id: uniqueId(), set, questions, index: 0, answers: [], selected: '', checked: false, startedAt: new Date().toISOString() };
    this.saveMeta({ ...this.getMeta(), activeSession: state.practiceSession });
    setView('practice-session');
    return true;
  },
  startQuick(count, skill) {
    const level = `TOPIK_${state.currentUser.currentTopikLevel || inferredTopikLevel(state.currentUser.level)}`;
    let sets = this.bank.sets.filter((set) => set.level === level && (skill === 'mixed' || set.skill === skill || set.skill === 'mixed'));
    if (!sets.length) sets = this.bank.sets.filter((set) => set.level === level);
    const pool = sets.flatMap((set) => this.bank.getQuestions(set.id));
    const questions = this.prioritizeQuestions(pool, count);
    state.questionRomanization = {};
    const set = { id: `quick-${level}-${skill}`, title: `Luyện nhanh · ${count} câu`, level, levelLabel: level.replace('_', ' '), skill, topic: 'Luyện nhanh', difficulty: 2, questionCount: count };
    state.practiceSession = { id: uniqueId(), set, questions, index: 0, answers: [], selected: '', checked: false, startedAt: new Date().toISOString(), quick: true };
    this.saveMeta({ ...this.getMeta(), activeSession: state.practiceSession });
    setView('practice-session');
  },
  startRandom({ level, count, skill, difficulty }) {
    const resolvedLevel = level === 'current' ? `TOPIK_${state.currentUser.currentTopikLevel}` : level;
    let sets = this.bank.sets.filter((set) => set.level === resolvedLevel);
    if (skill !== 'mixed') sets = sets.filter((set) => set.skill === skill || set.skill === 'mixed');
    if (difficulty !== 'mixed') sets = sets.filter((set) => set.difficulty === Number(difficulty));
    if (!sets.length) sets = this.bank.sets.filter((set) => set.level === resolvedLevel);
    const pool = sets.flatMap((set) => this.bank.getQuestions(set.id));
    const questions = this.prioritizeQuestions(pool, count);
    state.questionRomanization = {};
    const set = { id: `random-${resolvedLevel}-${Date.now()}`, title: `Đề ngẫu nhiên · ${resolvedLevel.replace('_', ' ')}`, level: resolvedLevel, levelLabel: resolvedLevel.replace('_', ' '), skill, topic: 'Đề ngẫu nhiên', difficulty: difficulty === 'mixed' ? 2 : Number(difficulty), questionCount: questions.length };
    state.practiceSession = { id: uniqueId(), set, questions, index: 0, answers: [], selected: '', checked: false, startedAt: new Date().toISOString(), random: true };
    this.saveMeta({ ...this.getMeta(), activeSession: state.practiceSession });
    setView('practice-session');
  },
  startQuestions(questions, title, source = 'custom') {
    const selected = this.prioritizeQuestions(questions, questions.length);
    if (!selected.length) return false;
    state.questionRomanization = {};
    const set = { id: `${source}-${Date.now()}`, title, level: 'CUSTOM', levelLabel: 'Cá nhân', skill: 'mixed', topic: title, difficulty: 2, questionCount: selected.length };
    state.practiceSession = { id: uniqueId(), set, questions: selected, index: 0, answers: [], selected: '', checked: false, startedAt: new Date().toISOString(), source };
    this.saveMeta({ ...this.getMeta(), activeSession: state.practiceSession });
    setView('practice-session');
    return true;
  },
  toggleSaved(setId) {
    const meta = this.getMeta();
    const current = new Set(meta.savedSetIds || []);
    if (current.has(setId)) current.delete(setId); else current.add(setId);
    this.saveMeta({ ...meta, savedSetIds: [...current] });
    return current.has(setId);
  },
  isSaved(setId) { return (this.getMeta().savedSetIds || []).includes(setId); },
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
    const questionTypeGroups = {};
    session.answers.forEach((answer) => { const question = session.questions.find((item) => item.id === answer.questionId); if (!question) return; const type = question.type || question.questionType || question.kind || 'general'; if (!questionTypeGroups[type]) questionTypeGroups[type] = { correct: 0, total: 0 }; questionTypeGroups[type].total += 1; if (answer.correct) questionTypeGroups[type].correct += 1; });
    const attempt = {
      id: session.id,
      userId: state.currentUser.id,
      setId: session.set.id,
      setTitle: session.set.title,
      level: session.set.level,
      startedAt: session.startedAt,
      completedAt: new Date().toISOString(),
      durationSeconds: Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000)),
      score: correct,
      total,
      percentage,
      correct,
      wrong: session.answers.filter((answer) => !answer.correct).length,
      skipped: Math.max(0, total - session.answers.length),
      averageTimeSeconds: Math.max(1, Math.round(Math.max(1, Date.now() - new Date(session.startedAt).getTime()) / 1000 / Math.max(1, total))),
      answers: session.answers,
      wrongQuestionIds: session.answers.filter((answer) => !answer.correct).map((answer) => answer.questionId),
      skillBreakdown: toPercentages(skillGroups),
      topicBreakdown: toPercentages(topicGroups),
      questionTypeBreakdown: Object.fromEntries(Object.entries(questionTypeGroups).map(([type, value]) => [type, Math.round(value.correct / Math.max(1, value.total) * 100)])),
      contentVersion: 1
    };
    const adaptiveActivity = session.set.skill === 'listening' ? 'listening' : session.set.skill === 'speaking' ? 'speaking' : session.set.skill === 'grammar' ? 'grammar' : 'quiz';
    window.AdaptiveDifficultyService?.record?.(adaptiveActivity, percentage >= 70);
    window.ErrorNotebookService?.capturePractice?.(attempt, session.questions);
    const all = storage.get(STORAGE_KEYS.practiceHistory, {});
    const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {};
    safe[state.currentUser.id] = [attempt, ...(Array.isArray(safe[state.currentUser.id]) ? safe[state.currentUser.id] : [])].slice(0, 200);
    storage.set(STORAGE_KEYS.practiceHistory, safe);
    const meta = this.getMeta();
    const recent = [...(meta.recentQuestionIds || []), ...session.questions.map((question) => question.id)].slice(-150);
    const weakTopics = { ...(meta.weakTopics || {}) };
    const wrongPriorities = { ...(meta.wrongPriorities || {}) };
    session.answers.forEach((answer) => { wrongPriorities[answer.questionId] = Math.max(0, (wrongPriorities[answer.questionId] || 0) + (answer.correct ? -1 : 2)); });
    Object.entries(attempt.topicBreakdown).forEach(([topic, score]) => { weakTopics[topic] = score; });
    this.saveMeta({ ...meta, recentQuestionIds: recent, weakTopics, wrongPriorities, activeSession: null });
    const progress = getUserProgress();
    progress.daily.tasks.practice = true;
    if (session.questions.some((question) => question.skill === 'listening')) progress.daily.tasks.listening = true;
    saveUserProgress(progress);
    state.practiceResult = { attempt, questions: session.questions, set: session.set };
    state.practiceSession = null;
    setView('practice-result');
  },
  statistics() {
    const history = this.getHistory();
    const completed = history.length;
    const average = completed ? Math.round(history.reduce((sum, attempt) => sum + attempt.percentage, 0) / completed) : 0;
    const topik = history.filter((attempt) => /^t[1-6]-/.test(attempt.setId));
    const bestTopik = topik.length ? Math.max(...topik.map((attempt) => attempt.score)) : 0;
    const byTopik = Object.fromEntries([1,2,3,4,5,6].map((level) => {
      const attempts = history.filter((attempt) => attempt.level === `TOPIK_${level}` || attempt.setId.startsWith(`t${level}-`));
      const skills = {};
      attempts.forEach((attempt) => Object.entries(attempt.skillBreakdown || {}).forEach(([skill, score]) => { if (!skills[skill]) skills[skill] = []; skills[skill].push(score); }));
      return [level, Object.fromEntries(Object.entries(skills).map(([skill, scores]) => [skill, Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)]))];
    }));
    return { completed, average, bestTopik, latest: history[0] || null, weakTopics: Object.entries(this.getMeta().weakTopics || {}).sort((a, b) => a[1] - b[1]).slice(0, 3), byTopik };
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
  const currentTopikLevel = Math.max(1, Math.min(6, Number(user.currentTopikLevel) || inferredTopikLevel(user.level)));
  const learningTrack = user.learningTrack === 'foundation' ? 'foundation' : 'topik';
  const learningStyle = ['visual', 'audio', 'grammar', 'conversation', 'exam'].includes(user.learningStyle) ? user.learningStyle : 'visual';
  const learningMode = ['casual', 'topik', 'conversation', 'work'].includes(user.learningMode) ? user.learningMode : (Array.isArray(user.goals) && user.goals.includes('topik') ? 'topik' : 'casual');
  const explanationStyle = ['concise', 'step-by-step', 'examples'].includes(user.explanationStyle) ? user.explanationStyle : 'step-by-step';
  return {
    ...user,
    fullName: typeof user.fullName === 'string' && user.fullName.trim() ? user.fullName : 'Người học Tiếng Hàn - TamHoanq',
    email: typeof user.email === 'string' ? user.email : '',
    avatar: typeof user.avatar === 'string' ? user.avatar : initials(user.fullName || ''),
    goals: Array.isArray(user.goals) ? user.goals : [],
    level: typeof user.level === 'string' ? user.level : 'Beginner',
    learningTrack,
    learningStyle,
    learningMode,
    explanationStyle,
    studyMinutesPerDay: Math.max(5, Math.min(180, Number(user.studyMinutesPerDay) || 20)),
    foundationLevel: learningTrack === 'foundation' ? 0 : null,
    foundationEntry: ['hangul-academy', 'reading-first', 'first-words'].includes(user.foundationEntry) ? user.foundationEntry : 'hangul-academy',
    currentTopikLevel,
    targetTopikLevel: Math.max(currentTopikLevel, Math.min(6, Number(user.targetTopikLevel) || Math.min(6, currentTopikLevel + 1))),
    onboardingCompleted: user.onboardingCompleted === true,
    onboardingStep: typeof user.onboardingStep === 'string' ? user.onboardingStep : 'goals',
    placement: user.placement && typeof user.placement === 'object'
      ? { index: Number(user.placement.index) || 0, answers: Array.isArray(user.placement.answers) ? user.placement.answers : [], score: Number(user.placement.score) || 0 }
      : { index: 0, answers: [], score: 0 },
    beginnerPlacement: user.beginnerPlacement && typeof user.beginnerPlacement === 'object'
      ? { index: Number(user.beginnerPlacement.index) || 0, answers: Array.isArray(user.beginnerPlacement.answers) ? user.beginnerPlacement.answers : [], score: Number(user.beginnerPlacement.score) || 0 }
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
  CloudSyncService.schedule('profile');
}

function defaultProgress() {
  return {
    daily: { date: todayKey(), tasks: { vocabulary: false, lesson: false, practice: false, listening: false, speaking: false, writing: false } },
    lessonProgress: {},
    stats: { lessonsCompleted: 0, learningDays: 1, streak: 1, wordsLearned: 0 },
    skills: { vocabulary: 0, grammar: 0, listening: 0, speaking: 0, reading: 0, writing: 0 },
    pronunciationAttempts: [],
    writingSubmissions: [],
    foundation: { learnedCharacters: [], completedActivities: [], firstWords: [], checkpoint: null, updatedAt: null },
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
    writingSubmissions: Array.isArray(progress.writingSubmissions) ? progress.writingSubmissions : [],
    mockTests: Array.isArray(progress.mockTests) ? progress.mockTests : defaults.mockTests
  };
  if (progress.daily.date !== todayKey()) progress.daily = { date: todayKey(), tasks: { ...defaults.daily.tasks } };
  safeProgress[state.currentUser.id] = progress;
  storage.set(STORAGE_KEYS.progress, safeProgress);
  return progress;
}

function saveUserProgress(progress) {
  if (!state.currentUser) return;
  progress = { ...progress, updatedAt: new Date().toISOString(), schemaVersion: 1 };
  const allProgress = storage.get(STORAGE_KEYS.progress, {});
  const safeProgress = allProgress && typeof allProgress === 'object' && !Array.isArray(allProgress) ? allProgress : {};
  safeProgress[state.currentUser.id] = progress;
  storage.set(STORAGE_KEYS.progress, safeProgress);
  syncUserData();
  LearnerProfileService.get();
  CloudSyncService.schedule('progress');
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
    romanization: record.romanization || word.romanization || getRomanization(record.korean || word.korean || ''),
    pronunciationRomanization: record.pronunciationRomanization || word.pronunciationRomanization || '',
    exampleRomanization: record.exampleRomanization || word.exampleRomanization || getRomanization(record.exampleKo || record.example || word.exampleKo || ''),
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
  LearnerProfileService.get();
  CloudSyncService.schedule('srs');
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

function normalizeSearch(value = '') { return String(value).toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim(); }
function userScoped(key) { const all = storage.get(key, {}); return state.currentUser?.id && Array.isArray(all?.[state.currentUser.id]) ? all[state.currentUser.id] : []; }
function saveUserScoped(key, items, limit = 100) { if (!state.currentUser) return; const all = storage.get(key, {}); const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {}; safe[state.currentUser.id] = items.slice(0, limit); storage.set(key, safe); CloudSyncService.schedule(key); }

function contentResources() { return window.KLEARN_RESOURCE_LIBRARY?.resources || []; }
function contentVideos() { return window.KLEARN_RESOURCE_LIBRARY?.videos || []; }
function resourceById(id) { return contentResources().find((item) => item.id === id) || null; }
function videoById(id) { return contentVideos().find((item) => item.id === id) || null; }
function resourceProgress() { const all = storage.get(STORAGE_KEYS.resourceProgress, {}); return state.currentUser?.id ? (all?.[state.currentUser.id] || {}) : {}; }
function setResourceProgress(id, changes = {}) { if (!state.currentUser || !id) return; const all = storage.get(STORAGE_KEYS.resourceProgress, {}); const safe = all && typeof all === 'object' ? all : {}; safe[state.currentUser.id] = { ...(safe[state.currentUser.id] || {}), [id]: { ...(safe[state.currentUser.id]?.[id] || {}), ...changes, updatedAt: new Date().toISOString() } }; storage.set(STORAGE_KEYS.resourceProgress, safe); CloudSyncService.schedule('resource-progress'); }
const NotesService = {
  all() { return userScoped(STORAGE_KEYS.notes); },
  upsert(note) { if (!state.currentUser || !String(note?.content || '').trim()) return; const current = this.all(); const now = new Date().toISOString(); const next = { id: note.id || uniqueId(), userId: state.currentUser.id, sourceType: note.sourceType || 'general', sourceId: note.sourceId || '', anchorId: note.anchorId || '', content: String(note.content).trim(), createdAt: note.createdAt || now, updatedAt: now }; saveUserScoped(STORAGE_KEYS.notes, [next, ...current.filter((item) => item.id !== next.id)], 200); return next; },
  remove(id) { saveUserScoped(STORAGE_KEYS.notes, this.all().filter((item) => item.id !== id), 200); }
};
const BookmarkService = {
  all() { return userScoped(STORAGE_KEYS.bookmarks); },
  key(type, id) { return `${type}:${id}`; },
  has(type, id) { return this.all().some((item) => item.key === this.key(type, id)); },
  toggle(type, id, title = '') { if (!state.currentUser || !id) return false; const key = this.key(type, id); const current = this.all(); if (current.some((item) => item.key === key)) { saveUserScoped(STORAGE_KEYS.bookmarks, current.filter((item) => item.key !== key), 300); return false; } saveUserScoped(STORAGE_KEYS.bookmarks, [{ key, id, type, title, createdAt: new Date().toISOString() }, ...current], 300); return true; }
};
window.NotesService = NotesService;
window.BookmarkService = BookmarkService;
const AccessControlService = {
  role() {
    const role = window.SupabaseService?.session?.user?.app_metadata?.role;
    return ['student', 'teacher', 'reviewer', 'admin'].includes(role) ? role : 'student';
  },
  canReview() { return ['teacher', 'reviewer', 'admin'].includes(this.role()); },
  canManageReviews() { return ['reviewer', 'admin'].includes(this.role()); },
  isCloudReady() { return Boolean(window.SupabaseService?.client && window.SupabaseService?.session?.user); }
};
function contentReviewMeta(contentId, contentType = '') {
  const match = (window.KLEARN_CONTENT_REVIEWS || []).find((item) => item.contentId === contentId && (!contentType || item.contentType === contentType));
  return match || { contentId, contentType, status: 'draft', authorId: null, reviewerId: null, reviewedAt: null, updatedAt: null, version: 1, reviewNotes: '' };
}
function contentStatusLabel(meta) { return ({ draft: 'Bản nháp', in_review: 'Đang xem xét', reviewed: 'Đã biên tập', needs_revision: 'Cần chỉnh sửa', published: 'Đã xuất bản' })[meta.status] || 'Đang hoàn thiện'; }
window.AccessControlService = AccessControlService;
window.ContentReviewService = { meta: contentReviewMeta, label: contentStatusLabel };
const SupportService = {
  all() { return userScoped(STORAGE_KEYS.supportRequests); },
  cache(items) { saveUserScoped(STORAGE_KEYS.supportRequests, items, 100); },
  async submit({ type = 'general', sourceId = '', message = '' } = {}) {
    if (!AccessControlService.isCloudReady()) return { offline: true };
    const client = window.SupabaseService.client; const userId = window.SupabaseService.session.user.id;
    const { data, error } = await client.from('support_requests').insert({ user_id: userId, type, source_id: sourceId, message }).select().single();
    if (error) throw error; this.cache([{ ...data, userId }, ...this.all().filter((item) => item.id !== data.id)]); return { data };
  },
  async refresh() {
    if (!AccessControlService.isCloudReady()) return this.all(); const { data, error } = await window.SupabaseService.client.from('support_requests').select('id,type,source_id,message,status,created_at,updated_at,assigned_teacher_id').order('created_at', { ascending: false }).limit(100); if (error) throw error; const safe = (data || []).map((item) => ({ ...item, userId: state.currentUser?.id })); this.cache(safe); return safe;
  }
};
window.SupportService = SupportService;
async function submitContentReport({ contentId, contentType, reportType = 'other', message = '' } = {}) {
  if (!AccessControlService.isCloudReady()) return { offline: true };
  const userId = window.SupabaseService.session.user.id; const { data, error } = await window.SupabaseService.client.from('content_reports').insert({ user_id: userId, content_id: contentId, content_type: contentType, report_type: reportType, message }).select().single(); if (error) throw error; return { data };
}

const USER_SYNC_KEYS = Object.freeze([
  STORAGE_KEYS.conversationHistory,
  STORAGE_KEYS.readingExpansion,
  STORAGE_KEYS.realGoalPlans, STORAGE_KEYS.learningJournal, STORAGE_KEYS.teacherFeedback, STORAGE_KEYS.manualReviewQueue, STORAGE_KEYS.teacherWorkspace, STORAGE_KEYS.communityProgress,
  STORAGE_KEYS.progress, STORAGE_KEYS.srs, STORAGE_KEYS.settings, STORAGE_KEYS.practice, STORAGE_KEYS.practiceHistory,
  STORAGE_KEYS.speaking, STORAGE_KEYS.writing, STORAGE_KEYS.dictionaryFavorites, STORAGE_KEYS.savedSentences,
  STORAGE_KEYS.translationHistory, STORAGE_KEYS.recentSearches, STORAGE_KEYS.handwriting, STORAGE_KEYS.learnerProfile,
  STORAGE_KEYS.dailyPlan, STORAGE_KEYS.notifications, STORAGE_KEYS.errors, STORAGE_KEYS.weeklyReports, STORAGE_KEYS.dailyMissions, STORAGE_KEYS.learningGoals, STORAGE_KEYS.learningIntelligence, STORAGE_KEYS.adaptiveRoadmaps, STORAGE_KEYS.aiMemory, STORAGE_KEYS.knowledgeProgress, STORAGE_KEYS.listeningSessions, STORAGE_KEYS.writingAttempts, STORAGE_KEYS.speakingSessions, STORAGE_KEYS.examAttempts, STORAGE_KEYS.notes, STORAGE_KEYS.bookmarks, STORAGE_KEYS.resourceProgress, STORAGE_KEYS.highlights, STORAGE_KEYS.grammarNotebook, STORAGE_KEYS.typingProgress, STORAGE_KEYS.repairPaths, STORAGE_KEYS.focusSessions, STORAGE_KEYS.checkpoints, STORAGE_KEYS.shadowingProgress, STORAGE_KEYS.milestones, STORAGE_KEYS.achievements, STORAGE_KEYS.vocabularyCollections, STORAGE_KEYS.sentenceBuilderProgress, STORAGE_KEYS.realLifeProgress, 'klearn_ai_conversations'
]);

const CloudSyncService = {
  timer: null,
  status: 'local',
  provider: null,
  getProvider() {
    if (this.provider) return this.provider;
    const configured = window.KLEARN_CLOUD_PROVIDER;
    if (configured && typeof configured.pull === 'function' && typeof configured.push === 'function') this.provider = configured;
    return this.provider;
  },
  isConfigured() { return Boolean(this.getProvider()); },
  cloudUserId() { return this.getProvider()?.getUserId?.() || null; },
  setStatus(status, detail = '') {
    this.status = status;
    if (state.currentUser) storage.set(STORAGE_KEYS.syncMeta, { ...(storage.get(STORAGE_KEYS.syncMeta, {}) || {}), [state.currentUser.id]: { status, detail, updatedAt: new Date().toISOString() } });
    document.dispatchEvent(new CustomEvent('klearn-sync-status', { detail: { status, detail } }));
  },
  getStatus() {
    const saved = state.currentUser && storage.get(STORAGE_KEYS.syncMeta, {})?.[state.currentUser.id];
    return saved?.status || (navigator.onLine === false ? 'offline' : this.isConfigured() ? 'synced' : 'local');
  },
  snapshot() {
    if (!state.currentUser) return null;
    const localUserId = state.currentUser.id; const userId = this.cloudUserId(); if (!userId) return null;
    const data = Object.fromEntries(USER_SYNC_KEYS.map((key) => { const value = storage.get(key, {}); return [key, key === STORAGE_KEYS.settings ? (value?.users?.[localUserId] || null) : (value?.[localUserId] ?? null)]; }));
    const user = normalizeUser(state.currentUser); if (user) { delete user.passwordHash; delete user.id; }
    return { userId, user, data, updatedAt: new Date().toISOString(), schemaVersion: 3 };
  },
  mergeValue(local, remote) {
    if (Array.isArray(local) || Array.isArray(remote)) {
      const values = [...(Array.isArray(local) ? local : []), ...(Array.isArray(remote) ? remote : [])];
      const keyed = new Map(); values.forEach((item) => { const key = item && typeof item === 'object' ? (item.id || item.wordId || item.questionId || item.createdAt || item.created_at || JSON.stringify(item)) : String(item); const previous = keyed.get(key); const timestamp = (value) => new Date(value?.updatedAt || value?.updated_at || value?.completedAt || value?.last_used_at || value?.createdAt || value?.created_at || 0); if (!previous || timestamp(item) >= timestamp(previous)) keyed.set(key, item); });
      return [...keyed.values()];
    }
    if (local && remote && typeof local === 'object' && typeof remote === 'object') { const localTime = new Date(local.updatedAt || local.updated_at || 0).getTime(); const remoteTime = new Date(remote.updatedAt || remote.updated_at || 0).getTime(); return remoteTime >= localTime ? { ...local, ...remote } : { ...remote, ...local }; }
    return remote ?? local;
  },
  mergeSrs(local = [], remote = []) {
    const rank = { new: 0, learning: 1, review: 2, mastered: 3 }; const map = new Map();
    [...local, ...remote].forEach((card) => { const id = card?.wordId || card?.id; if (!id) return; const previous = map.get(id); if (!previous) return map.set(id, card); const latest = new Date(card.updatedAt || card.lastReviewed || 0) >= new Date(previous.updatedAt || previous.lastReviewed || 0) ? card : previous; const stronger = (rank[card.status] || 0) >= (rank[previous.status] || 0) ? card : previous; map.set(id, { ...previous, ...latest, status: stronger.status, mastery: Math.max(previous.mastery || 0, card.mastery || 0), reviewCount: Math.max(previous.reviewCount || 0, card.reviewCount || 0), correctCount: Math.max(previous.correctCount || 0, card.correctCount || 0), wrongCount: Math.max(previous.wrongCount || 0, card.wrongCount || 0), nextReview: new Date(card.nextReview || 0) > new Date(previous.nextReview || 0) ? card.nextReview : previous.nextReview }); });
    return [...map.values()];
  },
  mergeProgress(local = {}, remote = {}) {
    const merged = this.mergeValue(local, remote) || {}; const lessons = {};
    const ids = new Set([...Object.keys(local.lessonProgress || {}), ...Object.keys(remote.lessonProgress || {})]);
    ids.forEach((id) => { const a = local.lessonProgress?.[id] || {}; const b = remote.lessonProgress?.[id] || {}; const latest = new Date(b.updatedAt || b.completedAt || 0) >= new Date(a.updatedAt || a.completedAt || 0) ? { ...a, ...b } : { ...b, ...a }; lessons[id] = { ...latest, completed: Boolean(a.completed || b.completed), score: Math.max(a.score || 0, b.score || 0), masteryScore: Math.max(a.masteryScore || 0, b.masteryScore || 0), masteryStatus: MasteryService.status(Math.max(a.masteryScore || 0, b.masteryScore || 0)) }; });
    merged.lessonProgress = lessons; merged.stats = Object.fromEntries([...new Set([...Object.keys(local.stats || {}), ...Object.keys(remote.stats || {})])].map((key) => [key, Math.max(local.stats?.[key] || 0, remote.stats?.[key] || 0)])); merged.skills = Object.fromEntries([...new Set([...Object.keys(local.skills || {}), ...Object.keys(remote.skills || {})])].map((key) => [key, Math.max(local.skills?.[key] || 0, remote.skills?.[key] || 0)]));
    const localFoundation = local.foundation && typeof local.foundation === 'object' ? local.foundation : {}; const remoteFoundation = remote.foundation && typeof remote.foundation === 'object' ? remote.foundation : {}; const latestFoundation = new Date(remoteFoundation.updatedAt || 0) >= new Date(localFoundation.updatedAt || 0) ? { ...localFoundation, ...remoteFoundation } : { ...remoteFoundation, ...localFoundation };
    merged.foundation = { ...latestFoundation, learnedCharacters: [...new Set([...(Array.isArray(localFoundation.learnedCharacters) ? localFoundation.learnedCharacters : []), ...(Array.isArray(remoteFoundation.learnedCharacters) ? remoteFoundation.learnedCharacters : [])])], completedActivities: [...new Set([...(Array.isArray(localFoundation.completedActivities) ? localFoundation.completedActivities : []), ...(Array.isArray(remoteFoundation.completedActivities) ? remoteFoundation.completedActivities : [])])], firstWords: [...new Set([...(Array.isArray(localFoundation.firstWords) ? localFoundation.firstWords : []), ...(Array.isArray(remoteFoundation.firstWords) ? remoteFoundation.firstWords : [])])] };
    merged.pronunciationAttempts = this.mergeValue(local.pronunciationAttempts, remote.pronunciationAttempts); merged.writingSubmissions = this.mergeValue(local.writingSubmissions, remote.writingSubmissions); return merged;
  },
  mergeDomain(key, local, remote) { if (key === STORAGE_KEYS.srs) return this.mergeSrs(local, remote); if (key === STORAGE_KEYS.progress) return this.mergeProgress(local, remote); return this.mergeValue(local, remote); },
  mergeSnapshot(remote) {
    if (!remote?.data || !state.currentUser) return;
    const allKeys = new Set(USER_SYNC_KEYS); allKeys.forEach((key) => { const all = storage.get(key, {}); if (key === STORAGE_KEYS.settings) { const safeSettings = all && typeof all === 'object' && !Array.isArray(all) ? { ...all, users: { ...(all.users || {}) } } : { users: {} }; safeSettings.users[state.currentUser.id] = this.mergeDomain(key, safeSettings.users[state.currentUser.id], remote.data[key]); storage.set(key, safeSettings); return; } const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {}; safe[state.currentUser.id] = this.mergeDomain(key, safe[state.currentUser.id], remote.data[key]); storage.set(key, safe); });
    if (remote.user) { const local = getUsers().find((item) => item.id === state.currentUser.id); if (local) { const localId = local.id; const passwordHash = local.passwordHash; const merged = normalizeUser({ ...local, ...remote.user, id: localId, passwordHash, cloudUserId: this.cloudUserId() }); const users = getUsers(); users[users.findIndex((item) => item.id === localId)] = merged; saveUsers(users); state.currentUser = merged; } }
    syncUserData();
  },
  async hydrate() {
    const provider = this.getProvider(); if (!provider || !this.cloudUserId() || !state.currentUser?.cloudUserId || state.currentUser.cloudUserId !== this.cloudUserId()) { this.setStatus(navigator.onLine === false ? 'offline' : 'local'); return false; }
    if (navigator.onLine === false) { this.setStatus('offline'); return false; }
    this.setStatus('syncing');
    try { const remote = await provider.pull(this.snapshot()); if (remote) this.mergeSnapshot(remote); await provider.push(this.snapshot(), { reason: 'migration-or-login' }); this.setStatus('synced'); return true; } catch (error) { this.setStatus(navigator.onLine === false ? 'offline' : 'error', error?.message || 'Cloud unavailable'); return false; }
  },
  schedule(reason = 'local-change') {
    if (!state.currentUser) return;
    if (!this.isConfigured() || !this.cloudUserId() || state.currentUser.cloudUserId !== this.cloudUserId()) { this.setStatus(navigator.onLine === false ? 'offline' : 'local'); return; }
    clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(reason), 1200);
  },
  async flush(reason = 'local-change') {
    const provider = this.getProvider(); if (!provider || !state.currentUser || !this.cloudUserId() || state.currentUser.cloudUserId !== this.cloudUserId()) return false;
    if (navigator.onLine === false) { this.setStatus('offline'); return false; }
    this.setStatus('syncing');
    try { const remote = await provider.pull(this.snapshot()); if (remote) this.mergeSnapshot(remote); await provider.push(this.snapshot(), { reason }); this.setStatus('synced'); return true; } catch (error) { this.setStatus(navigator.onLine === false ? 'offline' : 'error', error?.message || 'Cloud unavailable'); return false; }
  }
};
window.CloudSyncService = CloudSyncService;
window.addEventListener('online', () => CloudSyncService.flush('back-online'));
window.addEventListener('offline', () => CloudSyncService.setStatus('offline'));

const MasteryService = {
  status(score = 0) { const value = Number(score) || 0; return value >= 80 ? 'mastered' : value >= 50 ? 'understood' : value > 0 ? 'learning' : 'not_started'; },
  label(status) { return ({ not_started: 'Chưa học', learning: 'Đang học', understood: 'Đã hiểu', mastered: 'Thành thạo' })[status] || 'Chưa học'; },
  lesson(progress = {}) { const score = Number(progress.masteryScore ?? (progress.completed ? 70 : 0)); return { score, status: progress.masteryStatus || this.status(score) }; },
  updateLesson(lessonId, score, extra = {}) { const progress = getUserProgress(); const current = progress.lessonProgress[lessonId] || {}; progress.lessonProgress[lessonId] = { ...current, ...extra, masteryScore: Math.max(Number(current.masteryScore) || 0, Math.min(100, Number(score) || 0)), masteryStatus: this.status(Math.max(Number(current.masteryScore) || 0, Number(score) || 0)), updatedAt: new Date().toISOString() }; saveUserProgress(progress); return progress.lessonProgress[lessonId]; }
};

const LearnerProfileService = {
  build() {
    const progress = getUserProgress(); const history = PracticeService.getHistory(); const profile = { currentTopikLevel: state.currentUser?.currentTopikLevel || 1, targetTopikLevel: state.currentUser?.targetTopikLevel || 2, goal: state.currentUser?.goals || [], learningStyle: state.currentUser?.learningStyle || 'visual', learningMode: state.currentUser?.learningMode || 'casual', explanationStyle: state.currentUser?.explanationStyle || 'step-by-step', studyMinutesPerDay: Number(state.currentUser?.studyMinutesPerDay || 20), strengths: [], weaknesses: [], weakGrammar: [], weakVocabulary: [], weakSkills: [], skillLevels: {}, frequentErrors: [], masteryByTopic: {}, skillScores: { ...progress.skills }, recentMistakes: [], recentLessons: [], dueSrsCount: state.srsData.filter((item) => new Date(item.nextReview) <= new Date()).length, streak: progress.stats.streak, weeklyStudyMinutes: 0, learningPace: 'steady', preferredStudyHour: null, updatedAt: new Date().toISOString() };
    const scoredSkills = Object.entries(progress.skills).filter(([, score]) => Number(score) > 0); profile.weakSkills = scoredSkills.filter(([, score]) => score < 60).sort((a,b) => a[1]-b[1]).map(([key]) => key); profile.strengths = scoredSkills.filter(([, score]) => score >= 80).sort((a,b) => b[1]-a[1]).map(([key]) => key); profile.weaknesses = profile.weakSkills.slice();
    profile.weakVocabulary = state.srsData.filter((item) => item.wrongCount > 0 || item.mastery < 50).sort((a,b) => (b.wrongCount-a.wrongCount) || (a.mastery-b.mastery)).slice(0, 8).map((item) => ({ id: item.wordId, korean: item.korean, mastery: item.mastery, wrongCount: item.wrongCount }));
    profile.masteryByTopic = Object.fromEntries([...new Set(state.srsData.map((item) => item.topic).filter(Boolean))].map((topic) => { const cards = state.srsData.filter((item) => item.topic === topic); return [topic, Math.round(cards.reduce((sum,item) => sum + (item.mastery || 0), 0) / Math.max(1, cards.length))]; }));
    profile.weakGrammar = Object.entries(PracticeService.getMeta().weakTopics || {}).filter(([, score]) => Number(score) < 60).sort((a,b) => a[1]-b[1]).slice(0, 8).map(([topic, score]) => ({ topic, score }));
    profile.frequentErrors = (window.ErrorNotebookService?.top?.(20) || []).filter((item) => !item.resolved).sort((a,b) => Number(b.count || 1) - Number(a.count || 1)).slice(0, 8).map((item) => ({ id: item.id, type: item.type, topic: item.question || item.type, count: Number(item.count || 1), correction: item.correction || '' }));
    profile.recentMistakes = history.slice(0, 5).flatMap((attempt) => (attempt.wrongQuestionIds || []).map((questionId) => ({ questionId, attemptId: attempt.id, date: attempt.completedAt }))).slice(0, 20);
    profile.recentLessons = Object.entries(progress.lessonProgress).sort((a,b) => new Date(b[1]?.updatedAt || b[1]?.completedAt || 0) - new Date(a[1]?.updatedAt || a[1]?.completedAt || 0)).slice(0, 10).map(([id, value]) => ({ id, ...MasteryService.lesson(value) }));
    const weekAgo = Date.now() - 7 * 86400000;
    const focusMinutes = userScoped(STORAGE_KEYS.focusSessions).filter((item) => item.status === 'completed' && new Date(item.completedAt).getTime() >= weekAgo).reduce((sum, item) => sum + Number(item.actualMinutes || 0), 0);
    profile.weeklyStudyMinutes = history.filter((item) => new Date(item.completedAt).getTime() >= weekAgo).reduce((sum,item) => sum + Math.round((item.durationSeconds || 0) / 60), 0) + focusMinutes;
    profile.skillLevels = Object.fromEntries(Object.entries(profile.skillScores).map(([skill, score]) => [skill, Number(score) >= 80 ? 'strong' : Number(score) >= 60 ? 'medium' : 'weak']));
    const durations = history.map((item) => Number(item.durationSeconds || 0)).filter((value) => value > 0); const averageSeconds = durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : 0;
    profile.learningPace = averageSeconds && averageSeconds < 180 ? 'fast' : averageSeconds > 600 ? 'slow' : 'steady';
    const hours = history.map((item) => item.completedAt ? new Date(item.completedAt).getHours() : null).filter((value) => value !== null); profile.preferredStudyHour = hours.length ? Math.round(hours.reduce((sum, value) => sum + value, 0) / hours.length) : null;
    return profile;
  },
  get() { if (!state.currentUser) return null; const profile = this.build(); const all = storage.get(STORAGE_KEYS.learnerProfile, {}); all[state.currentUser.id] = profile; storage.set(STORAGE_KEYS.learnerProfile, all); return profile; }
};
window.LearnerProfileService = LearnerProfileService;

const SmartReviewService = {
  forgettingPrediction(card) { const last = new Date(card.lastReviewed || card.createdAt || Date.now()).getTime(); const elapsedDays = Math.max(0, (Date.now() - last) / 86400000); const stabilityDays = Math.max(1, Number(card.intervalDays || card.interval || 3) * (.55 + Math.max(0, Number(card.mastery || 0)) / 100)); return Math.min(.99, Math.max(0, 1 - Math.exp(-elapsedDays / stabilityDays))); },
  priority(card) {
    const ageDays = Math.max(0, (Date.now() - new Date(card.lastReviewed || card.createdAt || 0).getTime()) / 86400000);
    const target = Number(state.currentUser?.targetTopikLevel || 2); let score = 0;
    if (new Date(card.nextReview) <= new Date()) score += 3;
    if (Number(card.wrongCount || 0) >= 2) score += 3;
    if (Number(card.topikLevel || 1) <= target) score += 2;
    if (ageDays >= 14 || !card.lastReviewed) score += 2;
    if (window.KnowledgeGraphService?.isWeakTopic?.(card.topic || card.wordId)) score += 2;
    const forgettingRisk = this.forgettingPrediction(card); if (forgettingRisk >= .65) score += 4; if (ageDays >= 30) score += 3;
    return score + forgettingRisk + (100 - (Number(card.mastery) || 0)) / 100;
  },
  plan(minutes = 20) { const count = Math.max(3, Math.round(Number(minutes) / 2)); const ranked = [...state.srsData].sort((a,b) => this.priority(b) - this.priority(a)); const cards = ranked.slice(0, count); const profile = LearnerProfileService.get() || {}; const graphTopics = window.KnowledgeGraphService?.weaknessAnalysis?.().slice(0, 3) || []; return { minutes: Number(minutes), cards, atRisk: ranked.filter((card) => this.forgettingPrediction(card) >= .65).slice(0, 10).map((card) => ({ wordId: card.wordId, korean: card.korean, mastery: Number(card.mastery || 0), risk: Math.round(this.forgettingPrediction(card) * 100), daysSinceReview: Math.floor((Date.now() - new Date(card.lastReviewed || card.createdAt || Date.now()).getTime()) / 86400000) })), grammar: (profile.weakGrammar || []).slice(0, Math.max(1, Math.round(Number(minutes) / 10))), skills: (profile.weakSkills || []).slice(0, 2), graphTopics, estimatedItems: cards.length + Math.max(1, Math.round(Number(minutes) / 5)) }; },
  start(minutes) { const plan = this.plan(minutes); if (!plan.cards.length) return toast('Chưa có dữ liệu để tạo phiên ôn thông minh.'); state.reviewSelectionCount = plan.cards.length; state.reviewSource = 'smart'; beginReviewSession(plan.cards.map((card) => card.wordId)); }
};
window.SmartReviewService = SmartReviewService;

const NotificationService = {
  defaults: { srs: true, dailyPlan: true, streak: true },
  get() { const all = storage.get(STORAGE_KEYS.notifications, {}); return { ...this.defaults, ...(all?.[state.currentUser?.id] || {}) }; },
  set(key, value) { if (!state.currentUser) return; const all = storage.get(STORAGE_KEYS.notifications, {}); const safe = all && typeof all === 'object' && !Array.isArray(all) ? all : {}; safe[state.currentUser.id] = { ...this.get(), [key]: Boolean(value), updatedAt: new Date().toISOString() }; storage.set(STORAGE_KEYS.notifications, safe); CloudSyncService.schedule('notification-preferences'); },
  pending() { if (!state.currentUser) return []; const preferences = this.get(); const progress = getUserProgress(); const notices = []; if (preferences.srs && dueCards().length) notices.push({ id: 'srs-due', text: `${dueCards().length} từ SRS đang đến hạn.` }); if (preferences.dailyPlan && !Object.values(progress.daily.tasks).every(Boolean)) notices.push({ id: 'daily-plan', text: 'Kế hoạch hôm nay vẫn còn mục chưa hoàn thành.' }); if (preferences.streak && progress.stats.streak === 0) notices.push({ id: 'streak', text: 'Hãy học một chút hôm nay để khởi động lại streak.' }); return notices; }
};
window.NotificationService = NotificationService;

const DictionaryService = {
  all() { return Array.isArray(window.KLEARN_DICTIONARY) ? window.KLEARN_DICTIONARY : []; },
  search(query = '', filters = {}) {
    const q = normalizeSearch(query); const list = this.all();
    return list.filter((entry) => {
      const fields = [entry.korean, entry.romanization, entry.meaningVi, entry.meaningEn, entry.meaningZh, entry.meanings?.vi, entry.meanings?.en, entry.meanings?.['zh-CN'], ...(entry.tags || [])].map(normalizeSearch).join(' ');
      return (!q || fields.includes(q)) && (!filters.topik || filters.topik === 'all' || Number(entry.topikLevel) === Number(filters.topik)) && (!filters.partOfSpeech || filters.partOfSpeech === 'all' || entry.partOfSpeech === filters.partOfSpeech);
    }).slice(0, 20);
  },
  byId(id) { return this.all().find((entry) => entry.id === id) || null; },
  recent() { return userScoped(STORAGE_KEYS.recentSearches); },
  addRecent(entry) { if (!state.currentUser || !entry) return; saveUserScoped(STORAGE_KEYS.recentSearches, [entry.id, ...this.recent().filter((id) => id !== entry.id)], 20); },
  favorites() { return userScoped(STORAGE_KEYS.dictionaryFavorites); },
  isFavorite(id) { return this.favorites().includes(id); },
  toggleFavorite(id) { const next = this.isFavorite(id) ? this.favorites().filter((item) => item !== id) : [id, ...this.favorites()]; saveUserScoped(STORAGE_KEYS.dictionaryFavorites, next, 500); return next.includes(id); },
  addToSrs(entry) { if (!entry) return; const card = state.srsData.find((item) => item.wordId === entry.id); if (card) VocabularyService.updateCard(entry.id, { status: 'learning', nextReview: new Date().toISOString() }); else saveUserSrs([...state.srsData, normalizeSrsCard({ ...entry, wordId: entry.id, nextReview: new Date().toISOString() }, entry)]); }
};

const SavedSentenceService = {
  all() { return userScoped(STORAGE_KEYS.savedSentences); },
  save(sentence) { if (!sentence || !state.currentUser) return; saveUserScoped(STORAGE_KEYS.savedSentences, [{ ...sentence, id: sentence.id || uniqueId(), createdAt: sentence.createdAt || new Date().toISOString() }, ...this.all()], 100); },
  remove(id) { saveUserScoped(STORAGE_KEYS.savedSentences, this.all().filter((item) => item.id !== id), 100); }
};

const TranslationService = {
  providers: {},
  registerProvider(name, adapter) { if (name && adapter && typeof adapter.translate === 'function') this.providers[name] = adapter; },
  exact: {
    'xin chào': { korean: '안녕하세요', romanization: 'annyeonghaseyo', translation: 'Xin chào' },
    'cảm ơn': { korean: '감사합니다', romanization: 'gamsahamnida', translation: 'Cảm ơn' },
    'trường học': { korean: '학교', romanization: 'hakgyo', translation: 'Trường học' },
    'nhà vệ sinh ở đâu?': { korean: '화장실이 어디예요?', romanization: 'hwajangsiri eodiyeyo?', translation: 'Nhà vệ sinh ở đâu?' },
    'bao nhiêu tiền?': { korean: '얼마예요?', romanization: 'eolmayeyo?', translation: 'Bao nhiêu tiền?' },
    '안녕하세요': { korean: '안녕하세요', romanization: 'annyeonghaseyo', translation: 'Xin chào' },
    '감사합니다': { korean: '감사합니다', romanization: 'gamsahamnida', translation: 'Cảm ơn' }
  },
  translate({ text = '', sourceLanguage = 'vi', targetLanguage = 'ko', context = 'general', register = 'polite' } = {}) {
    const value = String(text).trim(); if (!value) return null;
    const key = normalizeSearch(value); const exact = this.exact[key] || this.exact[value];
    if (exact) return { ...exact, sourceText: value, sourceLanguage, targetLanguage, context, register, local: true };
    const entry = DictionaryService.search(value)[0];
    if (entry && (sourceLanguage === 'ko' || normalizeSearch(entry.korean) === key)) return { korean: entry.korean, romanization: entry.romanization || getRomanization(entry), translation: entry.meanings?.vi || entry.meaningVi || '', sourceText: value, sourceLanguage, targetLanguage, local: true };
    if (sourceLanguage === 'vi' && targetLanguage === 'ko') {
      const templates = [{ test: /^(.+?) ở đâu\??$/i, build: (m) => `${m[1]}이 어디예요?` }, { test: /^xin nghỉ làm ngày mai$/i, build: () => '내일 하루 쉬고 싶습니다.' }, { test: /^tôi muốn (.+)$/i, build: (m) => `저는 ${m[1]} 하고 싶어요.` }];
      const matched = templates.find((item) => item.test.test(value)); if (matched) { const korean = matched.build(value.match(matched.test)); return { korean, romanization: getRomanization({ korean }), translation: value, sourceText: value, sourceLanguage, targetLanguage, local: true }; }
    }
    return { korean: targetLanguage === 'ko' ? '' : value, romanization: '', translation: sourceLanguage === 'ko' ? '' : value, sourceText: value, sourceLanguage, targetLanguage, unavailable: true, message: 'Bản dịch câu nâng cao cần được cấu hình dịch trực tuyến.' };
  },
  saveHistory(result) { if (!state.currentUser || !result) return; saveUserScoped(STORAGE_KEYS.translationHistory, [{ ...result, id: uniqueId(), timestamp: new Date().toISOString() }, ...userScoped(STORAGE_KEYS.translationHistory)], 100); }
};

const AITutorService = {
  all() { return userScoped('klearn_ai_conversations'); },
  saveAll(items) { saveUserScoped('klearn_ai_conversations', items, 20); },
  current() { return this.all().find((item) => item.id === state.aiConversationId) || null; },
  start(title = 'Hỏi gia sư') { const conversation = { id: uniqueId(), userId: state.currentUser?.id, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), summary: '', messages: [] }; this.saveAll([conversation, ...this.all()]); state.aiConversationId = conversation.id; return conversation; },
  ensure() { return this.current() || this.start(); },
  context(query = '') { const profile = LearnerProfileService.get() || {}; const currentLesson = (window.KLEARN_THEORY_LESSONS || []).find((lesson) => lesson.id === state.selectedLessonPreview); const extra = window.ErrorNotebookService?.context?.() || {}; const handwriting = userScoped(STORAGE_KEYS.handwriting).slice(0, 8).map((item) => ({ character: item.character, stage: item.stage, masteryScore: item.masteryScore })); const memoryQuery = `${query} ${currentLesson?.title || ''} ${currentLesson?.topic || ''}`.trim(); return { userLanguage: I18nService.getPreference(), currentTopikLevel: profile.currentTopikLevel || state.currentUser?.currentTopikLevel || null, targetTopikLevel: profile.targetTopikLevel || state.currentUser?.targetTopikLevel || null, learningStyle: profile.learningStyle, learningMode: profile.learningMode, explanationStyle: profile.explanationStyle, learningPace: profile.learningPace, currentLesson: currentLesson ? { id: currentLesson.id, title: currentLesson.title, topic: currentLesson.topic } : null, weakGrammar: (profile.weakGrammar || []).slice(0, 5), weakVocabulary: (profile.weakVocabulary || []).slice(0, 8), weakSkills: (profile.weakSkills || []).slice(0, 3), frequentErrors: (profile.frequentErrors || []).slice(0, 5), recentMistakes: (profile.recentMistakes || []).slice(0, 8), errorNotebook: extra.top || [], relevantMemory: window.MemoryRetrievalService?.retrieve?.(memoryQuery, { limit: 6 }) || [], knowledgeGraph: window.KnowledgeGraphService?.context?.(memoryQuery, 6) || [], recommendations: window.PersonalRecommendationService?.all?.().slice(0, 3) || [], dueSrsCount: profile.dueSrsCount || 0, recentScores: PracticeService.getHistory().slice(0, 5).map((item) => ({ percentage: item.percentage, skillBreakdown: item.skillBreakdown })), listeningScore: profile.skillScores?.listening || 0, speakingScore: profile.skillScores?.speaking || 0, writingScore: profile.skillScores?.writing || 0, handwritingProgress: handwriting, streak: profile.streak || 0, weeklyStudyMinutes: profile.weeklyStudyMinutes || 0, masteryByTopic: profile.masteryByTopic || {}, dailyPlan: getUserProgress().daily, conversationSummary: this.current()?.summary || '', currentView: state.currentView }; },
  addMessage(role, content) { const conversation = this.ensure(); conversation.messages.push({ role, content: String(content).slice(0, 4000), createdAt: new Date().toISOString() }); conversation.messages = conversation.messages.slice(-30); conversation.updatedAt = new Date().toISOString(); conversation.title = conversation.messages.find((m) => m.role === 'user')?.content.slice(0, 42) || conversation.title; this.saveAll([conversation, ...this.all().filter((item) => item.id !== conversation.id)]); return conversation; },
  async send(content) { const text = String(content || '').trim(); if (!text || state.aiBusy) return; window.LearningMemoryService?.captureQuery?.(text); this.addMessage('user', text); state.aiBusy = true; renderAiWidget(); const conversation = this.current(); const recentMessages = (conversation?.messages || []).slice(-12); try { const response = await fetch('/api/chat', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: recentMessages, learnerContext: this.context(text), learningLanguage: I18nService.getPreference() }) }); const payload = await response.json().catch(() => ({})); const reply = response.ok && payload.reply ? payload.reply : payload.configured === false ? I18nService.t('ai.notConfigured') : I18nService.t('ai.error'); this.addMessage('assistant', reply); } catch (_) { this.addMessage('assistant', I18nService.t('ai.offline')); } finally { state.aiBusy = false; renderAiWidget(); } }
};

const VocabularyService = {
  all() { return state.srsData; },
  dueCards() { return state.srsData.filter((card) => new Date(card.nextReview).getTime() <= Date.now()); },
  bySource(source) {
    if (source === 'due') return this.dueCards();
    if (/^topik-[1-6]$/.test(source)) return state.srsData.filter((card) => card.topikLevel === Number(source.slice(-1)));
    if (source === 'wrong') return state.srsData.filter((card) => card.wrongCount > 0).sort((a, b) => b.wrongCount - a.wrongCount);
    if (source === 'mastered') return state.srsData.filter((card) => card.status === 'mastered');
    if (source === 'review') return state.srsData.filter((card) => ['learning', 'review'].includes(card.status));
    return state.srsData.filter((card) => card.reviewCount > 0 || card.status !== 'new');
  },
  filtered(filters = state.vocabularyFilters) {
    return state.srsData.filter((card) => (filters.topikLevel === 'all' || card.topikLevel === Number(filters.topikLevel))
      && (filters.topic === 'all' || card.topic === filters.topic)
      && (filters.partOfSpeech === 'all' || card.partOfSpeech === filters.partOfSpeech)
      && (filters.status === 'all' || (filters.status === 'wrong' ? card.wrongCount > 0 : filters.status === 'remembered' ? card.mastery >= 60 && card.status !== 'mastered' : card.status === filters.status))
      && (!filters.search || `${card.korean} ${card.romanization || getRomanization(card)} ${I18nService.localizedText(card, 'meaning')}`.toLowerCase().includes(filters.search.toLowerCase())));
  },
  optionsFor(card, direction = 'ko_vi') {
    const seen = new Set();
    const pool = APP_DATA.vocabulary.filter((word) => {
      const value = direction === 'vi_ko' ? word.korean : I18nService.localizedText(word, 'meaning');
      const correctValue = direction === 'vi_ko' ? card.korean : I18nService.localizedText(card, 'meaning');
      if (word.id === card.wordId || value === correctValue || seen.has(value)) return false;
      seen.add(value);
      return true;
    });
    const distractors = sampleItems(pool, 3);
    const correct = direction === 'vi_ko' ? card.korean : I18nService.localizedText(card, 'meaning');
    const options = direction === 'vi_ko' ? [card.korean, ...distractors.map((word) => word.korean)] : [correct, ...distractors.map((word) => I18nService.localizedText(word, 'meaning'))];
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
  markMastered(card) {
    return this.updateCard(card.wordId, { status: 'mastered', mastery: Math.max(90, card.mastery), pretestPassed: true, skipCurrentSession: true, nextReview: new Date(Date.now() + 30 * 86400000).toISOString() });
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
      id: uniqueId(), fullName, email, passwordHash: await hashPassword(password), avatar: initials(fullName), goals: [], level: '', currentTopikLevel: 1, targetTopikLevel: 2,
      onboardingCompleted: false, onboardingStep: 'goals', placement: { index: 0, answers: [], score: 0 }, createdAt: now, updatedAt: now
    };
    users.push(user);
    saveUsers(users);
    initializeUserData(user.id);
    storage.set(STORAGE_KEYS.session, { userId: user.id, createdAt: now });
    state.currentUser = user;
    syncUserData();
    await CloudSyncService.hydrate();
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
    await CloudSyncService.hydrate();
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
    state.speakingPrompt = null;
    state.speakingResult = null;
    state.writingPrompt = null;
    state.writingSubmission = null;
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
    const savedListening = storage.get(STORAGE_KEYS.listeningSessions, {})?.[user.id];
    if (savedListening && typeof savedListening === 'object') state.listeningStudio = { ...state.listeningStudio, ...savedListening, playing: false };
    const savedExam = storage.get(STORAGE_KEYS.examAttempts, {})?.[user.id]?.active;
    if (savedExam?.questions?.length && new Date(savedExam.deadlineAt || 0).getTime() > Date.now()) state.examSession = savedExam;
    CloudSyncService.hydrate().then(() => { if (state.currentUser?.id === user.id) render(); });
    return user;
  }
};

const CloudAccountService = {
  async attachCloudUser(cloudUser, { explicitLink = false } = {}) {
    if (!cloudUser?.id) throw new Error('Không nhận được cloud user hợp lệ.');
    let local = state.currentUser;
    if (local && local.cloudUserId && local.cloudUserId !== cloudUser.id) throw new Error('Tài khoản local này đã liên kết với một cloud account khác.');
    if (local && !explicitLink && !local.cloudUserId) throw new Error('Hãy đăng nhập local trước rồi chọn “Kết nối tài khoản cloud” để xác nhận liên kết dữ liệu cũ.');
    if (!local) local = getUsers().find((item) => item.cloudUserId === cloudUser.id) || null;
    if (!local) {
      const sameEmailLegacy = getUsers().find((item) => normalizeEmail(item.email) === normalizeEmail(cloudUser.email) && !item.cloudUserId);
      if (sameEmailLegacy) throw new Error('Thiết bị có dữ liệu local cùng email. Hãy đăng nhập local trước và chủ động kết nối cloud để tránh gộp nhầm.');
      const now = new Date().toISOString();
      local = normalizeUser({ id: `cloud-${cloudUser.id}`, cloudUserId: cloudUser.id, cloudEmail: cloudUser.email, fullName: cloudUser.user_metadata?.full_name || cloudUser.email?.split('@')[0] || 'Người học', email: cloudUser.email || '', avatar: 'TH', goals: [], level: 'Beginner', currentTopikLevel: 1, targetTopikLevel: 2, onboardingCompleted: true, onboardingStep: 'completed', createdAt: now, updatedAt: now });
      saveUsers([...getUsers(), local]); initializeUserData(local.id);
    } else if (local.cloudUserId !== cloudUser.id) {
      const users = getUsers(); const index = users.findIndex((item) => item.id === local.id); users[index] = normalizeUser({ ...local, cloudUserId: cloudUser.id, cloudEmail: cloudUser.email, updatedAt: new Date().toISOString() }); saveUsers(users); local = users[index];
    }
    state.currentUser = local; state.cloudUser = { id: cloudUser.id, email: cloudUser.email || '' }; storage.set(STORAGE_KEYS.session, { userId: local.id, createdAt: new Date().toISOString(), cloud: true }); syncUserData();
    const syncSucceeded = await CloudSyncService.hydrate(); return { local, syncSucceeded };
  },
  async signIn(email, password, explicitLink = false) { state.cloudAuthBusy = true; state.cloudAuthMessage = ''; try { const data = await window.AuthService.signIn(email, password); try { const link = await this.attachCloudUser(data.user, { explicitLink }); state.cloudAuthMessage = link.syncSucceeded ? 'Đã kết nối cloud và đồng bộ dữ liệu.' : 'Đã kết nối cloud. Đồng bộ chưa hoàn tất; dữ liệu local vẫn an toàn.'; return { ...data, syncSucceeded: link.syncSucceeded }; } catch (error) { await window.AuthService.signOut().catch(() => {}); state.cloudUser = null; throw error; } } finally { state.cloudAuthBusy = false; } },
  async signUp(email, password, explicitLink = false) { state.cloudAuthBusy = true; state.cloudAuthMessage = ''; try { const result = await window.AuthService.signUp(email, password); if (result.confirmationRequired) { state.cloudAuthMessage = 'Hãy mở email xác nhận Supabase rồi quay lại đăng nhập cloud.'; return result; } if (result.user) { try { const link = await this.attachCloudUser(result.user, { explicitLink }); result.syncSucceeded = link.syncSucceeded; } catch (error) { await window.AuthService.signOut().catch(() => {}); state.cloudUser = null; throw error; } } state.cloudAuthMessage = result.syncSucceeded ? 'Tài khoản cloud đã được tạo, liên kết và đồng bộ.' : 'Tài khoản cloud đã được liên kết. Đồng bộ chưa hoàn tất; dữ liệu local vẫn an toàn.'; return result; } finally { state.cloudAuthBusy = false; } },
  async signOut() { await window.AuthService?.signOut?.(); state.cloudUser = null; CloudSyncService.provider = null; CloudSyncService.setStatus('local'); state.cloudAuthMessage = 'Đã ngắt cloud. Dữ liệu local vẫn được giữ nguyên.'; render(); },
  async restore() { const session = await window.AuthService?.getSession?.(); const cloudUser = session?.user; state.cloudUser = cloudUser ? { id: cloudUser.id, email: cloudUser.email || '' } : null; if (!cloudUser) return; const linked = getUsers().find((item) => item.cloudUserId === cloudUser.id); if (linked && (!state.currentUser || state.currentUser.id === linked.id)) await this.attachCloudUser(cloudUser); else if (state.currentUser?.cloudUserId === cloudUser.id) await CloudSyncService.hydrate(); }
};
window.CloudAccountService = CloudAccountService;

function onboardingViewFor(user) {
  const step = user?.onboardingStep || 'goals';
  if (step === 'level') return 'onboarding-level';
  if (step === 'beginner-placement') return 'beginner-placement';
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
  const aliases = { theory: 'theory', roadmap: 'roadmap', topik: 'topik' };
  let target = aliases[view] || view;
  if (!state.currentUser && !PUBLIC_VIEWS.includes(target)) target = 'welcome';
  if (target === 'review-dashboard' && !window.AccessControlService?.canReview?.()) { target = state.currentUser ? 'home' : 'welcome'; }
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
    document.getElementById('streakCount').textContent = getUserProgress().stats.streak;
  }
  document.querySelectorAll('.nav-item').forEach((button) => {
    const reviewViews = ['review-start', 'vocab-pretest', 'pretest-result', 'vocab-test-setup', 'vocab-test', 'vocab-test-result', 'vocabulary-hub'];
    const practiceViews = ['practice-hub', 'exam-catalog', 'random-exam', 'advanced-practice', 'wrong-practice', 'saved-exams', 'practice-history', 'skill-hub', 'writing-hub', 'writing-editor', 'writing-result', 'listening-studio', 'writing-room', 'speaking-room', 'topik-exam', 'topik-exam-result', 'practice-session', 'practice-result', 'practice-review', 'quick-practice'];
    const speakingViews = ['practice', 'speaking-hub', 'speaking-session', 'speaking-result'];
    const activeView = ['conversation-simulator','natural-korean','reading-lab','reading-session','word-network','collocation-trainer','dictation-master'].includes(state.currentView) ? 'lessons'
      : state.currentView === 'lesson' ? 'lessons'
      : ['lessons','courses','course-detail','theory','lesson-preview','handwriting','dictionary','translation-hub','phrasebook','practical-korean','vocabulary-notebook','vocabulary-hub','vocab-test-setup','vocab-test','vocab-test-result','resources','resource-view','videos','video-view', ...FOUNDATION_VIEWS].includes(state.currentView) ? 'lessons'
      : state.currentView === 'roadmap' ? 'profile'
      : ['review','smart-review','review-start','vocab-pretest','pretest-result'].includes(state.currentView) ? 'review'
      : ['topik','strategy-lab','strategy-detail','topik-strategy-center','practice-hub','exam-catalog','random-exam','advanced-practice','wrong-practice','saved-exams','practice-history','skill-hub','writing-hub','writing-editor','writing-result','practice-session','practice-result','practice-review','quick-practice','analytics','search'].includes(state.currentView) ? 'topik'
      : ['ai-coach','adaptive-plan','error-notebook'].includes(state.currentView) ? 'ai-coach'
      : ['profile','edit-profile','weekly-insights','progress-reports','personal-report','notes','bookmarks','real-goal-planner','learning-journal','teacher-review','teacher-workspace','community-hub'].includes(state.currentView) ? 'profile'
        : [...reviewViews, 'manual-review-queue'].includes(state.currentView) ? 'review'
            : practiceViews.includes(state.currentView) ? 'topik'
            : speakingViews.includes(state.currentView) ? 'practice' : state.currentView;
    const active = button.dataset.route === activeView;
    button.classList.toggle('active', active);
    button.setAttribute('aria-current', active ? 'page' : 'false');
  });
}

// ============================================================
// Public and onboarding views
// ============================================================
function renderThemeControl(compact = false) {
  const selected = ThemeService.getPreference();
  const language = I18nService.getPreference();
  const options = ['system', 'light', 'dark'];
  return `<section class="theme-control${compact ? ' compact' : ''}" aria-labelledby="themeControlTitle"><div><h2 id="themeControlTitle">${I18nService.t('theme.title')}</h2><p>${I18nService.t('theme.description')}</p></div><div class="theme-options" role="radiogroup" aria-label="${I18nService.t('theme.title')}">${options.map((value) => `<label class="theme-option"><input type="radio" name="themePreference" value="${value}" data-theme-choice ${selected === value ? 'checked' : ''}><span><b>${I18nService.t(`theme.${value}`)}</b><small>${I18nService.t(`theme.${value}Desc`)}</small></span></label>`).join('')}</div><div class="language-preference"><h3>${I18nService.t('language.title')}</h3><div class="language-options" role="radiogroup" aria-label="${I18nService.t('language.title')}">${[['vi','🇻🇳 Tiếng Việt'],['en','🇬🇧 English'],['zh-CN','🇨🇳 中文（简体）']].map(([value,label]) => `<label><input type="radio" name="languagePreference" value="${value}" data-language-choice ${language === value ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></div></section>`;
}

function welcomeView() {
  return `<section class="auth-page welcome-page">
    <div class="brand-mark" aria-label="Logo Tiếng Hàn - TamHoanq">TH</div><p class="eyebrow">Tiếng Hàn - TamHoanq</p>
    <h1 class="welcome-title">${I18nService.t('welcome.title')}</h1>
    <div class="welcome-points"><span>${I18nService.t('welcome.point.level')}</span><span>${I18nService.t('welcome.point.goal')}</span><span>${I18nService.t('welcome.point.progress')}</span></div>
    <div class="auth-actions"><button class="btn primary full" data-view="register">Bắt đầu học</button><p class="auth-switch">Đã có tài khoản?</p><button class="btn secondary full" data-view="login">Đăng nhập</button></div>${renderThemeControl(true)}
  </section>`;
}

function registerView() {
  return `<section class="auth-page"><button class="back-link" data-view="welcome" aria-label="Quay lại">←</button><div class="auth-branding"><span class="brand-mark brand-mark-compact" aria-label="Logo Tiếng Hàn - TamHoanq">TH</span><span>Tiếng Hàn - TamHoanq</span></div><p class="eyebrow">Tạo tài khoản học viên</p>
    <h1 class="headline">${I18nService.t('auth.register')}</h1><p class="subtle">${I18nService.t('auth.registerSubtitle')}</p>
    <form id="registerForm" class="auth-form" novalidate>
      <label>Họ tên<input name="fullName" type="text" autocomplete="name" maxlength="80" placeholder="Nguyễn Minh Anh" /></label>
      <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="ban@example.com" /></label>
      <label>Mật khẩu<input name="password" type="password" autocomplete="new-password" minlength="6" placeholder="Ít nhất 6 ký tự" /></label>
      <label>Xác nhận mật khẩu<input name="confirmPassword" type="password" autocomplete="new-password" minlength="6" placeholder="Nhập lại mật khẩu" /></label>
      <p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full" type="submit">Đăng ký local</button><button class="btn secondary full" type="button" id="cloudRegisterButton">☁ Đăng ký cloud</button>
    </form>
    <p class="auth-switch">Đã có tài khoản? <button class="text-button" data-view="login">Đăng nhập</button></p>
    <p class="security-note">MVP này lưu tài khoản trên thiết bị. Không sử dụng lại mật khẩu quan trọng của bạn.</p>${renderThemeControl(true)}
  </section>`;
}

function loginView() {
  return `<section class="auth-page"><button class="back-link" data-view="welcome" aria-label="Quay lại">←</button><div class="auth-branding"><span class="brand-mark brand-mark-compact" aria-label="Logo Tiếng Hàn - TamHoanq">TH</span><span>Tiếng Hàn - TamHoanq</span></div><p class="eyebrow">Đăng nhập học tập</p>
    <h1 class="headline">${I18nService.t('auth.welcome')} 👋</h1><p class="subtle">${I18nService.t('auth.loginSubtitle')}</p>
    <form id="loginForm" class="auth-form" novalidate>
      <label>Email<input name="email" type="email" autocomplete="email" inputmode="email" placeholder="ban@example.com" /></label>
      <label>Mật khẩu<input name="password" type="password" autocomplete="current-password" placeholder="Mật khẩu" /></label>
      <p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full" type="submit">Đăng nhập local</button><button class="btn secondary full" type="button" id="cloudLoginButton">☁ Đăng nhập cloud</button>
    </form>
    <button class="text-button forgot-button" id="forgotPassword">Quên mật khẩu?</button>
    <p class="auth-switch">Chưa có tài khoản? <button class="text-button" data-view="register">Đăng ký</button></p>${renderThemeControl(true)}
  </section>`;
}

function onboardingFrame(step, title, subtitle, content) {
  const width = step.startsWith('1') ? 25 : step.startsWith('2') ? 55 : step.startsWith('3') ? 82 : 100;
  return `<section class="onboarding-page"><div class="onboarding-top"><span class="brand-lockup"><span class="brand-mini" aria-hidden="true">TH</span><span class="brand-small">Tiếng Hàn - TamHoanq</span></span><span class="step-label">${escapeHtml(step)}</span></div>
    <div class="bar onboarding-bar"><span style="width:${width}%"></span></div><div class="onboarding-copy"><h1 class="headline">${title}</h1><p class="subtle">${subtitle}</p></div>${content}</section>`;
}

function goalsView() {
  const selected = state.selectedGoals.length ? state.selectedGoals : (state.currentUser.goals || []);
  state.selectedGoals = [...selected];
  const content = `<div class="choice-list">${APP_DATA.goals.map((goal) => `<button class="choice-card ${selected.includes(goal.id) ? 'selected' : ''}" data-goal="${goal.id}"><span class="choice-icon">${goal.icon}</span><span>${goal.label}</span><span class="choice-check">${selected.includes(goal.id) ? '✓' : ''}</span></button>`).join('')}</div>
    <p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full sticky-action" id="goalsContinue">Tiếp tục</button>`;
  return onboardingFrame('1 / 3', I18nService.t('onboarding.goalsTitle'), I18nService.t('onboarding.goalsSubtitle'), content);
}

function levelView() {
  const selectedId = state.selectedOnboardingPath || APP_DATA.levelChoices.find((choice) => choice.level === state.selectedLevel)?.id || '';
  const content = `<div class="choice-list">${APP_DATA.levelChoices.map((choice) => {
    const selected = selectedId === choice.id;
    return `<button class="choice-card ${selected ? 'selected' : ''}" data-level-choice="${choice.id}"><span class="choice-icon">${choice.icon}</span><span>${choice.label}</span><span class="choice-check">${selected ? '✓' : ''}</span></button>`;
  }).join('')}</div>
    <p id="formError" class="form-error hidden" role="alert"></p><div class="action-row"><button class="btn secondary" data-view="onboarding-goals">Quay lại</button><button class="btn primary" id="levelContinue">Tiếp tục</button></div>`;
  return onboardingFrame('2 / 3', 'Bạn đang ở trình độ nào?', 'Chọn phương án gần nhất để bắt đầu đúng chỗ. Người chưa biết Hangul sẽ không phải làm bài TOPIK.', content);
}

function placementQuestionAt(placement, index = placement?.index || 0) {
  const ids = Array.isArray(placement?.questionIds) && placement.questionIds.length ? placement.questionIds : [4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1];
  return { question: APP_DATA.placementQuestions[ids[index]], questionId: ids[index], total: ids.length };
}

function placementView() {
  const placement = state.currentUser.placement || { index: 0, answers: [], score: 0 };
  const { total: placementTotal } = placementQuestionAt(placement, 0);
  const index = Math.min(placement.index || 0, Math.max(0, placementTotal - 1));
  const { question, total } = placementQuestionAt(placement, index);
  const content = `<div class="test-progress"><span>${index + 1} / ${total}</span><span>${placement.score || 0} điểm</span></div>
    <section class="card question-card"><h2>${escapeHtml(question.prompt)}</h2><div class="answer-list">${question.options.map((option, optionIndex) => `<button class="answer-button" data-test-answer="${optionIndex}"><span>${String.fromCharCode(65 + optionIndex)}</span>${escapeHtml(option)}</button>`).join('')}</div></section>`;
  return onboardingFrame('3 / 3 · Placement Test', I18nService.t('onboarding.placementTitle'), `${I18nService.t('onboarding.placementSubtitle')} · ${APP_DATA.placementQuestions.length} câu`, content);
}

function goalLabels(goals = []) { return goals.map((id) => APP_DATA.goals.find((goal) => goal.id === id)?.label).filter(Boolean); }

function onboardingResultView() {
  const goals = goalLabels(state.currentUser.goals);
  const placement = state.currentUser.placement || {}; const answers = placement.answers || []; const ids = placement.questionIds || [4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1]; const dimensions = ['vocabulary','grammar','reading','listening']; const breakdown = dimensions.map((dimension) => { const relevant = ids.map((id, index) => ({ question: APP_DATA.placementQuestions[id], answer: answers[index] })).filter((item) => (item.question?.dimension || 'vocabulary') === dimension && item.answer !== undefined); const correct = relevant.filter((item) => item.answer === item.question.answer).length; return { dimension, score: relevant.length ? Math.round(correct / relevant.length * 100) : 0 }; });
  const foundation = state.currentUser.learningTrack === 'foundation';
  return `<section class="onboarding-page result-page"><div class="celebration">🎉</div><p class="eyebrow">Cá nhân hóa hoàn tất</p><h1 class="headline">Lộ trình của bạn đã sẵn sàng</h1>
    <p class="subtle">${foundation ? 'Bạn sẽ học từ mặt chữ, âm tiết và những từ đầu tiên trước khi vào TOPIK 1.' : 'Tiếng Hàn - TamHoanq sẽ ưu tiên bài học phù hợp với trình độ và mục tiêu của bạn.'}</p><div class="result-summary"><div><span>Điểm bắt đầu</span><strong>${escapeHtml(state.currentUser.level || state.selectedLevel)}</strong></div><div><span>Mục tiêu</span><strong>${escapeHtml(goals.join(' · '))}</strong></div>${answers.length ? `<div><span>Placement Test</span><strong>${state.currentUser.placement.score}/${answers.length} điểm</strong></div>` : ''}</div>${answers.length ? `<section class="card placement-breakdown"><h2>Phân tích theo kỹ năng</h2>${breakdown.map((item) => `<div class="skill"><div class="section-heading"><span>${item.dimension}</span><b>${item.score}%</b></div><div class="bar"><span style="width:${item.score}%"></span></div></div>`).join('')}<p class="subtle">Gợi ý: ${breakdown.sort((a,b) => a.score-b.score)[0]?.dimension || 'vocabulary'} nên được củng cố trước.</p></section>` : `<section class="card foundation-result-note"><strong>${foundation ? 'Level 0 · Nhập môn tiếng Hàn' : 'Lộ trình đã chọn'}</strong><p>${foundation ? 'Hangul → Ghép âm → Đọc từ → Câu đầu tiên → TOPIK 1' : 'Bạn có thể bắt đầu học ngay.'}</p></section>`}
    <button class="btn primary full" id="finishOnboarding">Bắt đầu học</button></section>`;
}

// ============================================================
// Authenticated app views
// ============================================================
function dailyCompletion(progress) {
  const tasks = progress.daily.tasks;
  const keys = ['vocabulary', 'practice', 'listening', 'speaking', 'writing'];
  return Math.round((keys.filter((key) => tasks[key]).length / keys.length) * 100);
}

function roadmapFor(level) {
  const maps = {
    Beginner: [0, null, null, null], 'Beginner+': [35, null, null, null], 'TOPIK I': [100, 42, null, null],
    'TOPIK I nâng cao': [100, 75, null, null], 'TOPIK II khởi đầu': [100, 100, 15, null], 'TOPIK II': [100, 100, 35, null]
  };
  return maps[level] || maps.Beginner;
}

function homeView() {
  if (state.currentUser?.learningTrack === 'foundation' && window.BeginnerFoundation?.homeView) return window.BeginnerFoundation.homeView();
  const progress = getUserProgress();
  const pct = dailyCompletion(progress);
  const dueCount = VocabularyService.dueCards().length;
  const practiceStats = PracticeService.statistics();
  const profile = LearnerProfileService.get() || {};
  const weakCandidate = profile.weakSkills?.[0] || practiceStats.weakTopics?.[0]?.[0] || 'listening';
  const weakSkill = ['listening', 'speaking', 'reading', 'writing', 'grammar', 'vocabulary'].includes(weakCandidate) ? weakCandidate : 'listening';
  const weakLabels = { listening: 'Nghe', speaking: 'Nói', reading: 'Đọc', writing: 'Viết', grammar: 'Ngữ pháp', vocabulary: 'Từ vựng' };
  const target = Number(state.currentUser.targetTopikLevel || 2); const current = Number(state.currentUser.currentTopikLevel || 1);
  const topikProgress = target <= current ? 100 : Math.round(Math.min(95, ((current - 1) / Math.max(1, target - 1)) * 100 + (practiceStats.average || 0) * .2));
  const recentLesson = profile.recentLessons?.[0]; const nextLesson = (window.KLEARN_THEORY_LESSONS || []).find((item) => item.id === recentLesson?.id) || (window.KLEARN_THEORY_LESSONS || []).find((item) => item.topikLevel === current);
  const greeting = I18nService.t('home.greeting', { name: firstName(state.currentUser.fullName) }).replace(/\s*👋$/, '');
  return `<section class="dashboard-hero section"><div><p class="eyebrow">Hôm nay học gì?</p><h1 class="headline">${escapeHtml(greeting)}</h1><p>Giữ nhịp đều, mỗi ngày một bước.</p></div><span class="home-streak">🔥 ${progress.stats.streak} ngày</span></section>
    <section class="home-progress section"><div><span>Tiến độ mục tiêu</span><strong>TOPIK ${current} → ${target}</strong></div><b>${topikProgress}%</b><div class="bar large"><span style="width:${topikProgress}%"></span></div><button class="text-link" data-view="roadmap">Xem lộ trình →</button></section>
    <div id="homeMissionAnchor"></div>
    <section class="home-action-grid section">
      <article class="home-action continue"><span class="home-action-icon">▶</span><div><small>Tiếp tục học</small><h2>${escapeHtml(nextLesson?.title || 'Bài học theo lộ trình')}</h2><p>${escapeHtml(nextLesson?.topic || state.currentUser.level)}</p></div><button class="btn primary" ${nextLesson ? `data-theory-lesson="${nextLesson.id}"` : 'data-view="theory"'}>Học tiếp</button></article>
      <article class="home-action"><span class="home-action-icon">Aa</span><div><small>Từ cần ôn</small><h2>${dueCount.toLocaleString('vi-VN')} từ đến hạn</h2><p>Ôn đúng lúc để ghi nhớ lâu hơn.</p></div><button class="btn secondary" data-view="review">Ôn ngay</button></article>
      <article class="home-action"><span class="home-action-icon">↗</span><div><small>Kỹ năng cần cải thiện</small><h2>${escapeHtml(weakLabels[weakSkill] || weakSkill)}</h2><p>${profile.skillScores?.[weakSkill] || 0}% · ưu tiên trong tuần này</p></div><button class="btn secondary" data-open-skill="${weakSkill}" data-view="${weakSkill === 'speaking' ? 'speaking-hub' : weakSkill === 'writing' ? 'writing-hub' : weakSkill === 'vocabulary' ? 'vocabulary-hub' : 'skill-hub'}">Luyện ngay</button></article>
      <article class="home-action"><span class="home-action-icon">10′</span><div><small>Ôn nhanh</small><h2>Phiên học ngắn</h2><p>Chọn 5, 10, 15 hoặc 20 phút.</p></div><button class="btn secondary" data-view="smart-review">Chọn thời lượng</button></article>
    </section>
    <section class="home-shortcuts section"><button data-view="lessons"><span>📚</span><b>Học tập</b></button><button data-view="practice-hub"><span>🏆</span><b>Luyện TOPIK</b></button><button data-view="vocabulary-notebook"><span>📒</span><b>Sổ từ</b></button><button data-view="practical-korean"><span>💬</span><b>Mẫu câu thực tế</b></button></section>`;
}

function dictionaryView() {
  const query = state.dictionaryQuery || ''; const results = DictionaryService.search(query, { partOfSpeech: state.dictionaryFilter });
  const selected = state.dictionarySelectedId ? DictionaryService.byId(state.dictionarySelectedId) : null;
  if (selected) return dictionaryEntryView(selected);
  const recent = DictionaryService.recent().map((id) => DictionaryService.byId(id)).filter(Boolean);
  return `<section class="section page-heading"><p class="eyebrow">📖 Từ điển</p><h1 class="headline">Tra từ tiếng Hàn</h1><p class="subtle">Tìm bằng Hangul, romanization hoặc nghĩa tiếng Việt.</p></section><section class="card dictionary-search section"><form id="dictionarySearchForm"><input id="dictionarySearch" name="query" value="${escapeHtml(query)}" placeholder="학교 / trường học / hakgyo" autocomplete="off"><button class="btn primary" type="submit">🔍 Tra từ</button></form><div class="filter-row"><select id="dictionaryPos"><option value="all">Tất cả loại từ</option><option value="noun">Danh từ</option><option value="verb">Động từ</option><option value="adjective">Tính từ</option><option value="adverb">Trạng từ</option></select></div></section>${recent.length && !query ? `<section class="section"><h2 class="section-title">Tra gần đây</h2><div class="chip-list">${recent.map((item) => `<button class="chip" data-dictionary-id="${item.id}">${escapeHtml(item.korean)}</button>`).join('')}</div></section>` : ''}<section class="dictionary-results section"><h2 class="section-title">${query ? `${results.length} kết quả` : `Từ điển ${DictionaryService.all().length.toLocaleString('vi-VN')} mục`}</h2>${results.map((item) => `<button class="card dictionary-row" data-dictionary-id="${item.id}"><span class="dictionary-korean" lang="ko">${escapeHtml(item.korean)}</span><span class="dictionary-romanization">${escapeHtml(item.romanization || getRomanization(item))}</span><span>${escapeHtml(I18nService.localizedText(item, 'meaning') || (I18nService.getPreference() === 'vi' ? item.meanings?.vi || '' : ''))}</span></button>`).join('') || '<div class="empty-state compact-empty"><p>Không tìm thấy mục phù hợp.</p></div>'}</section><section class="section utility-links"><button class="btn secondary" data-view="translation-hub">🌐 Dịch & Đặt câu</button><button class="btn secondary" data-view="phrasebook">📒 Sổ tay câu</button></section>`;
}

function dictionaryEntryView(entry) {
  const favorite = DictionaryService.isFavorite(entry.id); const meaning = I18nService.localizedText(entry, 'meaning') || (I18nService.getPreference() === 'vi' ? entry.meanings?.vi || '' : '');
  const examples = Array.isArray(entry.examples) && entry.examples.length ? `<h3>Ví dụ</h3>${entry.examples.map((example) => { const translation = I18nService.getLocalizedValue(example.translations, I18nService.getPreference(), example.translations?.vi || ''); return `<div class="example"><div class="korean contextual-line" lang="ko">${contextualizeKorean(example.korean)}</div><div class="dictionary-romanization">${escapeHtml(example.romanization || getRomanization({ korean: example.korean }))}</div><div>${escapeHtml(translation)}</div><button class="audio-btn" data-speak="${escapeHtml(example.korean)}">🔊</button></div>`; }).join('')}` : '<p class="subtle">Chưa có ví dụ cho mục này.</p>';
  return `<section class="section page-heading"><button class="back-link" data-view="dictionary">← Quay lại</button><p class="eyebrow">📖 Từ điển</p><h1 class="headline" lang="ko">${escapeHtml(entry.korean)}</h1><p class="dictionary-romanization">${escapeHtml(entry.romanization || getRomanization(entry))}</p><p class="subtle">${escapeHtml(entry.partOfSpeech || 'Từ vựng')} · TOPIK ${entry.topikLevel || 1}</p></section><section class="card dictionary-entry section"><h2>${escapeHtml(meaning)}</h2><div class="entry-actions"><button class="btn primary" data-speak="${escapeHtml(entry.audioText || entry.korean)}">🔊 Nghe</button><button class="btn secondary" data-toggle-favorite="${entry.id}">${favorite ? '★ Đã lưu' : '☆ Lưu từ'}</button><button class="btn secondary" data-add-srs="${entry.id}">🧠 Thêm vào ôn tập</button></div>${examples}</section><button class="btn primary full" data-view="translation-hub" data-translate-seed="${escapeHtml(entry.korean)}">🌐 Dịch & đặt câu</button>`;
}

function renderContextDictionary() {
  const root = document.getElementById('contextDictionaryRoot'); if (!root) return;
  const term = String(state.contextDictionaryTerm || '').trim();
  if (!term) { root.innerHTML = ''; return; }
  const entry = DictionaryService.search(term)[0];
  if (!entry) { root.innerHTML = `<div class="context-sheet-backdrop" data-context-close></div><aside class="context-sheet" role="dialog" aria-label="Tra từ nhanh"><button class="context-sheet-close" data-context-close>×</button><p class="eyebrow">Tra từ nhanh</p><h2 lang="ko">${escapeHtml(term)}</h2><p class="subtle">Chưa có dữ liệu từ này.</p><div class="action-row"><button class="btn secondary" data-context-close>Đóng</button><button class="btn primary" data-context-ask-ai>Hỏi trợ lý</button></div></aside>`; return; }
  const favorite = DictionaryService.isFavorite(entry.id); const meaning = I18nService.localizedText(entry, 'meaning') || entry.meanings?.vi || '';
  root.innerHTML = `<div class="context-sheet-backdrop" data-context-close></div><aside class="context-sheet" role="dialog" aria-label="Tra từ nhanh"><button class="context-sheet-close" data-context-close>×</button><p class="eyebrow">Từ trong bài học</p><h2 lang="ko">${escapeHtml(entry.korean)}</h2><p class="context-romanization">${escapeHtml(entry.romanization || getRomanization(entry))}</p><p class="context-meaning">${escapeHtml(meaning)}</p><div class="context-meta"><span>${escapeHtml(entry.partOfSpeech || 'Từ vựng')}</span><span>TOPIK ${entry.topikLevel || 1}</span></div>${entry.examples?.[0] ? `<div class="context-example"><b lang="ko">${escapeHtml(entry.examples[0].korean)}</b><small>${escapeHtml(I18nService.getLocalizedValue(entry.examples[0].translations, I18nService.getPreference(), ''))}</small></div>` : ''}<div class="entry-actions"><button class="btn primary" data-context-speak="${escapeHtml(entry.audioText || entry.korean)}">🔊 Nghe</button><button class="btn secondary" data-context-favorite="${entry.id}">${favorite ? '★ Đã lưu' : '☆ Lưu'}</button><button class="btn secondary" data-context-srs="${entry.id}">+ SRS</button></div><button class="text-link" data-context-open-dictionary="${entry.id}">Xem từ điển đầy đủ →</button></aside>`;
}

function closeContextDictionary() { state.contextDictionaryTerm = ''; renderContextDictionary(); }

function translationHubView() {
  const result = state.translationResult; const direction = state.translationDirection || 'vi-ko'; const sourceLabel = direction === 'vi-ko' ? 'Tiếng Việt' : 'Tiếng Hàn'; const targetLabel = direction === 'vi-ko' ? 'Tiếng Hàn' : 'Tiếng Việt';
  return `<section class="section page-heading"><p class="eyebrow">🌐 Công cụ ngôn ngữ</p><h1 class="headline">Dịch & Đặt câu</h1><p class="subtle">Tra từ, dịch cụm từ và câu với dữ liệu offline.</p></section><section class="card translation-card section"><div class="translation-direction"><label>Dịch từ<select id="translationDirection"><option value="vi-ko" ${direction === 'vi-ko' ? 'selected' : ''}>Tiếng Việt</option><option value="ko-vi" ${direction === 'ko-vi' ? 'selected' : ''}>Tiếng Hàn</option></select></label><button class="swap-btn" id="swapTranslation" type="button">⇄</button><label>Sang<select disabled><option>${targetLabel}</option></select></label></div><form id="translationForm"><textarea id="translationInput" name="text" rows="4" placeholder="Nhập từ, cụm từ hoặc câu...">${escapeHtml(state.translationDraft || '')}</textarea><div class="translation-options"><label>Ngữ cảnh<select name="context"><option value="general">Chung</option><option value="restaurant">🍜 Nhà hàng</option><option value="work">🏢 Công việc</option><option value="hospital">🏥 Bệnh viện</option></select></label><label>Cách nói<select name="register"><option value="polite">Lịch sự</option><option value="casual">Thân mật</option><option value="formal">Trang trọng</option></select></label></div><button class="btn primary full" type="submit">Dịch</button></form></section>${result ? `<section class="card translation-result section">${result.unavailable ? `<p class="support-message">${result.message}</p>` : `<div class="translation-korean" lang="ko">${escapeHtml(result.korean)}</div><div class="dictionary-romanization">${escapeHtml(result.romanization || '')}</div><p>${escapeHtml(result.translation || '')}</p><div class="entry-actions"><button class="btn primary" data-speak="${escapeHtml(result.korean)}">🔊 Nghe</button><button class="btn secondary" id="copyTranslation">Sao chép</button><button class="btn secondary" id="saveTranslation">⭐ Lưu câu</button><button class="btn secondary" id="practiceTranslation">🎙 Luyện nói</button></div>`}</section>` : ''}<section class="section"><button class="btn secondary" data-view="dictionary">📖 Tra từ</button><button class="btn secondary" data-view="phrasebook">📒 Sổ tay câu</button></section>`;
}

function phrasebookView() {
  const phrases = Array.isArray(window.KLEARN_PHRASEBOOK) ? window.KLEARN_PHRASEBOOK : [];
  return `<section class="section page-heading"><p class="eyebrow">📒 Sổ tay câu</p><h1 class="headline">Câu thông dụng</h1><p class="subtle">Các mẫu câu có thể dùng offline. Bấm vào từ tiếng Hàn để xem nhanh nghĩa.</p></section><section class="phrasebook-list section">${phrases.map((item) => `<article class="card phrasebook-row"><div class="korean contextual-line" lang="ko">${contextualizeKorean(item.korean)}</div><div class="dictionary-romanization">${escapeHtml(item.romanization)}</div><p>${escapeHtml(item.meanings?.vi || '')}</p><div class="entry-actions"><button class="audio-btn" data-speak="${escapeHtml(item.korean)}">🔊</button><button class="btn secondary" data-toggle-favorite="${item.id}">☆ Lưu</button></div></article>`).join('')}</section>`;
}

function lessonsView() {
  if (state.currentUser?.learningTrack === 'foundation' && window.BeginnerFoundation?.learningView) return window.BeginnerFoundation.learningView();
  const profile = LearnerProfileService.get() || {}; const progress = getUserProgress(); const current = Number(state.currentUser.currentTopikLevel || 1);
  const levelLessons = (window.KLEARN_THEORY_LESSONS || []).filter((item) => item.topikLevel === current); const done = levelLessons.filter((item) => state.lessonProgress[item.id]?.completed).length;
  const groups = [
    ['📚','Khóa học','Curriculum theo cấp độ, bài học và mastery','courses'], ['Aa','Từ vựng','Theo cấp độ, chủ đề và tình huống','vocabulary-hub'],
    ['🔊','Phòng luyện Nghe','Listen, Dictation, Shadowing và Quiz','listening-studio'], ['🎙','Phòng luyện Nói','Repeat, Situation, Role Play và Free Speaking','speaking-room'],
    ['✍️','Phòng luyện Viết','Môi trường làm bài, timer và autosave','writing-hub'], ['📖','Đọc hiểu','Đoạn đọc ngắn theo trình độ','skill-hub','reading'],
    ['한','Luyện viết chữ','Hangul theo nét và mức độ','handwriting'], ['💬','Tiếng Hàn thực tế','XKLĐ, du học và công sở','practical-korean'], ['📚','Học liệu','Grammar, audio, worksheet và reference','resources'], ['🎬','Bài giảng Video','Video Academy theo course và lesson','videos'], ['📝','Ghi chú của tôi','Ghi chú gắn với nội dung đang học','notes'], ['★','Đã lưu','Bookmark lesson, word, strategy và resource','bookmarks'], ['🧑‍🏫','Gửi giáo viên hỗ trợ','Hỏi người thật khi cần giải đáp','support']
  ];
  return `<section class="section page-heading learning-heading"><p class="eyebrow">Học tập</p><h1 class="headline">Lộ trình TOPIK ${current}</h1><p class="subtle">${done}/${levelLessons.length} bài hoàn thành · Mục tiêu TOPIK ${state.currentUser.targetTopikLevel}</p></section><section class="learning-overview section"><div><span>Tiến độ cấp hiện tại</span><strong>${Math.round(done / Math.max(1, levelLessons.length) * 100)}%</strong></div><div class="bar"><span style="width:${Math.round(done / Math.max(1, levelLessons.length) * 100)}%"></span></div><button class="btn primary" data-view="courses">Xem khóa học</button></section><section class="learning-directory section">${groups.map(([icon,title,description,view,skill]) => `<button class="learning-directory-item" ${skill ? `data-open-skill="${skill}"` : ''} data-view="${view}"><span>${icon}</span><div><b>${title}</b><small>${description}</small></div><i>›</i></button>`).join('')}</section><section class="learning-tools section"><div><h2>Mỗi ngày một phiên ngắn</h2><p>Ôn theo dữ liệu SRS, lỗi sai và kỹ năng cần củng cố.</p></div><button class="btn secondary" data-view="smart-review">Ôn 5–20 phút</button></section>`;
}

function coursesView() {
  const courses = window.CurriculumService?.all?.() || [];
  return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Curriculum</p><h1 class="headline">Khóa học theo lộ trình</h1><p class="subtle">Chọn đúng chặng học; tiến độ được lấy trực tiếp từ các bài đã hoàn thành.</p></section><section class="course-curriculum section">${courses.map((course) => { const p = course.progress; return `<article class="course-card card ${p.status}"><div class="course-card-heading"><div><span class="course-level">${escapeHtml(course.level)}</span><h2>${escapeHtml(course.title)}</h2></div><span class="status-badge">${p.status === 'completed' ? 'Đã hoàn thành' : p.status === 'in_progress' ? 'Đang học' : 'Chưa bắt đầu'}</span></div><p class="subtle">${escapeHtml(course.description)}</p><div class="course-progress-row"><strong>${p.completed}/${p.total} bài</strong><b>${p.percent}%</b></div><div class="bar"><span style="width:${p.percent}%"></span></div><small class="course-meta">${course.lessonIds.length ? `${course.lessonIds.length} bài · khoảng ${course.estimatedMinutes} phút` : 'Chiến thuật và mock exam'}</small><button class="btn ${p.status === 'not_started' ? 'secondary' : 'primary'} full" data-course-id="${course.id}">${p.nextLessonId ? (p.status === 'in_progress' ? 'Tiếp tục khóa học' : 'Xem khóa học') : 'Mở chiến thuật TOPIK'}</button></article>`; }).join('')}</section>`;
}

function courseDetailView() {
  const course = window.CurriculumService?.get?.(state.selectedCourseId) || window.CurriculumService?.all?.()[0];
  if (!course) return '<section class="empty-state"><h1 class="headline">Chưa có khóa học</h1></section>';
  const p = course.progress; const items = course.lessonIds.map((id) => window.CurriculumService.lesson(id)).filter(Boolean);
  return `<section class="section page-heading"><button class="back-link" data-view="courses">← Khóa học</button><p class="eyebrow">${escapeHtml(course.level)}</p><h1 class="headline">${escapeHtml(course.title)}</h1><p class="subtle">${escapeHtml(course.description)}</p><div class="course-detail-summary"><strong>${p.completed}/${p.total} bài</strong><span>${p.percent}% hoàn thành</span></div><div class="bar large"><span style="width:${p.percent}%"></span></div></section><section class="course-lesson-list section">${items.length ? items.map((lesson, index) => { const mastery = window.CurriculumService.mastery(lesson.id); const value = state.lessonProgress[lesson.id] || {}; return `<button class="course-lesson-row ${value.completed ? 'completed' : index === items.findIndex((item) => item.id === p.nextLessonId) ? 'current' : ''}" data-theory-lesson="${lesson.id}"><span class="course-lesson-number">${value.completed ? '✓' : String(index + 1).padStart(2, '0')}</span><span><b>${escapeHtml(lesson.title)}</b><small>${lesson.estimatedMinutes || 10} phút · Mastery ${mastery.score}% · ${mastery.status}</small></span><i>›</i></button>`; }).join('') : '<div class="card empty-state"><p>Khóa này dùng Strategy Lab và kho đề TOPIK.</p><button class="btn primary" data-view="strategy-lab">Mở Chiến thuật TOPIK</button></div>'}</section>${items.length ? `<section class="learning-tools section"><div><h2>Bài tiếp theo</h2><p>${p.nextLessonId ? escapeHtml(window.CurriculumService.lesson(p.nextLessonId)?.title || '') : 'Bạn đã hoàn thành khóa học.'}</p></div><button class="btn primary" ${p.nextLessonId ? `data-theory-lesson="${p.nextLessonId}"` : 'data-view="courses"'}>${p.nextLessonId ? 'Bắt đầu' : 'Xem khóa khác'}</button></section>` : ''}`;
}

function vocabularyNotebookView() {
  const ids = DictionaryService.favorites(); const words = ids.map((id) => DictionaryService.byId(id)).filter(Boolean);
  return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Sổ từ vựng cá nhân</p><h1 class="headline">Từ đã lưu</h1><p class="subtle">${words.length} từ và mẫu câu bạn muốn ghi nhớ.</p></section>${words.length ? `<section class="notebook-list">${words.map((item) => `<article class="notebook-row"><button class="audio-btn" data-speak="${escapeHtml(item.korean)}">🔊</button><div><b lang="ko">${escapeHtml(item.korean)}</b><small>${escapeHtml(item.romanization || getRomanization(item))}</small><span>${escapeHtml(item.meanings?.vi || item.meaningVi || '')}</span></div><button class="text-link" data-dictionary-id="${item.id}">Xem</button></article>`).join('')}</section>` : '<section class="empty-state"><h2>Chưa có từ đã lưu</h2><p class="subtle">Mở từ điển và chọn “Lưu từ” để tạo sổ cá nhân.</p><button class="btn primary" data-view="dictionary">Mở từ điển</button></section>'}<div class="action-row section"><button class="btn secondary" data-view="vocabulary-hub">Kho từ TOPIK</button><button class="btn primary" data-view="vocab-test-setup">Test nhanh</button></div>`;
}

function practicalKoreanView() {
  const modes = [['🏭','XKLĐ','Từ vựng EPS, an toàn và giao tiếp nơi làm việc','EPS'],['🎓','Du học','Trường học, lớp học và sinh hoạt tại Hàn Quốc','study'],['🏢','Công sở','Kính ngữ, email và giao tiếp công việc','work'],['💬','Mẫu câu thực tế','Nhà hàng, bệnh viện, giao thông và mua sắm','phrases']];
  const phrases = (window.KLEARN_PHRASEBOOK || []).slice(0, 5);
  return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Tiếng Hàn trong đời sống</p><h1 class="headline">Học để sử dụng</h1><p class="subtle">Chọn bối cảnh phù hợp với mục tiêu của bạn.</p></section><section class="scenario-grid section">${modes.map(([icon,title,description,id]) => `<button class="scenario-card" ${id === 'EPS' ? 'data-hub-view="exam-catalog" data-hub-value="EPS"' : `data-view="${id === 'phrases' ? 'phrasebook' : 'translation-hub'}"`}><span>${icon}</span><b>${title}</b><small>${description}</small></button>`).join('')}</section><section class="learning-tools section"><div><h2>Mẫu câu dùng ngay</h2>${phrases.map((item) => `<p><b lang="ko">${escapeHtml(item.korean)}</b><br><small>${escapeHtml(item.meanings?.vi || '')}</small></p>`).join('')}</div><button class="btn primary" data-view="phrasebook">Xem tất cả</button></section>`;
}

function progressReportsView() {
  const profile = LearnerProfileService.get() || {}; const history = PracticeService.getHistory(); const month = history.filter((item) => Date.now() - new Date(item.completedAt).getTime() <= 30 * 86400000); const average = month.length ? Math.round(month.reduce((sum, item) => sum + Number(item.percentage || 0), 0) / month.length) : 0;
  return `<section class="section page-heading"><button class="back-link" data-view="profile">← Hồ sơ</button><p class="eyebrow">Báo cáo tiến bộ</p><h1 class="headline">Kết quả học tập</h1><p class="subtle">Số liệu thực từ lịch sử trên thiết bị và dữ liệu đã đồng bộ.</p></section><section class="report-period-grid section"><article><small>7 ngày</small><strong>${profile.weeklyStudyMinutes || 0}</strong><span>phút học</span></article><article><small>30 ngày</small><strong>${month.length}</strong><span>lượt luyện</span></article><article><small>Điểm trung bình</small><strong>${average}%</strong><span>trong tháng</span></article><article><small>Streak</small><strong>${profile.streak || 0}</strong><span>ngày liên tiếp</span></article></section><section class="learning-tools section"><div><h2>Điểm cần tập trung</h2><p>${profile.weakSkills?.length ? profile.weakSkills.join(', ') : 'Chưa đủ dữ liệu để kết luận.'}</p></div><button class="btn primary" data-view="smart-review">Bắt đầu ôn</button></section><div class="action-row"><button class="btn secondary" data-view="weekly-insights">Chi tiết tuần</button><button class="btn secondary" data-view="analytics">TOPIK Analytics</button></div>`;
}

function theoryView() {
  const levels = [1,2,3,4,5,6];
  return `<section class="section page-heading"><p class="eyebrow">📚 Lý thuyết</p><h1 class="headline">Bài học theo TOPIK</h1><p class="subtle">Học theo mục tiêu, tiến độ và kỹ năng của bạn.</p></section><section class="theory-level-list">${levels.map((level) => { const items = (window.KLEARN_THEORY_LESSONS || []).filter((lesson) => lesson.topikLevel === level); const done = items.filter((lesson) => state.lessonProgress[lesson.id]?.completed).length; return `<article class="card theory-level-card"><div class="section-heading"><div><p class="eyebrow">TOPIK ${level}</p><h2 class="section-title">${done}/${items.length} bài hoàn thành</h2></div><span class="level-pill">${Math.round(done / Math.max(1, items.length) * 100)}%</span></div><div class="theory-lesson-grid">${items.map((lesson) => `<button class="lesson-tag ${state.lessonProgress[lesson.id]?.completed ? 'completed' : ''}" data-theory-lesson="${lesson.id}">${state.lessonProgress[lesson.id]?.completed ? '✓ ' : ''}${escapeHtml(lesson.title)}</button>`).join('')}</div></article>`; }).join('')}</section><section class="utility-links section"><button class="btn secondary" data-view="vocabulary-hub">📖 Từ vựng theo cấp độ</button><button class="btn secondary" data-view="vocab-test-setup">📝 Kiểm tra kiến thức</button><button class="btn secondary" data-view="handwriting">✍️ Luyện viết chữ</button></section>`;
}

function roadmapView() {
  if (state.currentUser?.learningTrack === 'foundation' && window.BeginnerFoundation?.roadmapView) return window.BeginnerFoundation.roadmapView();
  const progress = getUserProgress(); const lessons = window.KLEARN_THEORY_LESSONS || []; const completed = lessons.filter((lesson) => state.lessonProgress[lesson.id]?.completed).length; const currentLevel = state.currentUser?.currentTopikLevel || 1;
  return `<section class="section page-heading"><p class="eyebrow">🗺 Lộ trình học</p><h1 class="headline">Kế hoạch của bạn</h1><p class="subtle">Từ ${escapeHtml(state.currentUser.level)} đến TOPIK ${state.currentUser.targetTopikLevel} · bắt đầu ${formatDate(state.currentUser.createdAt || Date.now())}</p></section><section class="card roadmap-summary section"><div class="stats stats-four"><div class="stat"><b>${currentLevel}</b><small>TOPIK hiện tại</small></div><div class="stat"><b>${state.currentUser.targetTopikLevel}</b><small>Mục tiêu</small></div><div class="stat"><b>${completed}</b><small>Bài có hoạt động</small></div><div class="stat"><b>${progress.stats.wordsLearned}</b><small>Từ đã học</small></div></div></section><section class="card section"><h2 class="section-title">Hôm nay</h2><div class="daily-plan"><span>📚 1 bài lý thuyết</span><span>🧠 15 từ</span><span>📝 10 câu luyện</span><span>🎧 5 phút nghe</span><span>🎙 5 phút nói</span><span>✍️ 1 bài viết ngắn</span></div></section><section class="card section"><h2 class="section-title">Roadmap TOPIK · Mastery</h2><div class="roadmap-list">${[1,2,3,4,5,6].map((level) => { const list = lessons.filter((lesson) => lesson.topikLevel === level); const score = Math.round(list.reduce((sum, lesson) => sum + MasteryService.lesson(state.lessonProgress[lesson.id]).score, 0) / Math.max(1, list.length)); return `<div class="roadmap-row ${level <= currentLevel ? 'active' : 'locked'}"><span class="roadmap-icon">${level <= currentLevel ? '▶' : '🔒'}</span><div><strong>TOPIK ${level}</strong><div class="bar"><span style="width:${score}%"></span></div></div><b>${score}%</b></div>`; }).join('')}</div><p class="subtle">Mastery: Chưa học → Đang học → Đã hiểu → Thành thạo.</p></section><section class="card section"><h2 class="section-title">Điểm yếu của tôi</h2><p class="subtle">${progress.skills.listening < progress.skills.reading ? 'Tăng thêm thời lượng nghe trong kế hoạch tuần này.' : 'Tiếp tục củng cố từ vựng và ngữ pháp theo SRS.'}</p><button class="btn primary" data-view="wrong-practice">Luyện lại lỗi sai</button></section>`;
}

const HandwritingProvider = {
  id: 'self-confirmation-mvp',
  evaluate({ strokes = 0, stage = 1 } = {}) { return { score: Math.min(100, Math.round((strokes > 0 ? 45 : 0) + stage * 15)), recognized: false, needsSelfConfirmation: true }; }
};
window.HandwritingProvider = HandwritingProvider;

function handwritingView() {
  const chars = window.KLEARN_HANDWRITING?.characters || ['한']; const saved = userScoped(STORAGE_KEYS.handwriting).find((item) => item.character === state.handwritingCharacter) || { stage: 0, attempts: 0 }; const stage = Math.max(1, Math.min(3, state.handwritingStage || saved.stage + 1)); const guide = stage === 1 ? 'trace' : stage === 2 ? 'guide' : 'free';
  return `<section class="section page-heading"><p class="eyebrow">✍️ Luyện viết chữ</p><h1 class="headline">Viết Hangul bằng tay</h1><p class="subtle">Nghe mẫu rồi luyện theo 3 lượt hỗ trợ giảm dần.</p></section><section class="card handwriting-card section"><div class="handwriting-toolbar"><label>Chữ<select id="handwritingCharacter">${chars.map((char) => `<option ${char === state.handwritingCharacter ? 'selected' : ''}>${char}</option>`).join('')}</select></label><span>Lượt ${stage}/3</span><button class="audio-btn" data-speak="${state.handwritingCharacter}">🔊</button></div><div class="handwriting-stage stage-${guide}"><div class="handwriting-guide">${stage < 3 ? state.handwritingCharacter : ''}</div><canvas id="handwritingCanvas" width="640" height="360" aria-label="Canvas luyện viết ${state.handwritingCharacter}"></canvas></div><div class="entry-actions"><button class="btn secondary" id="handwritingUndo">Hoàn tác</button><button class="btn secondary" id="handwritingClear">Xóa</button><button class="btn secondary" id="handwritingRetry">Viết lại</button><button class="btn primary" id="handwritingNext">${stage < 3 ? 'Tiếp tục' : 'Tôi đã viết đúng'}</button></div><p class="subtle">Chấm MVP dựa trên nét vẽ và xác nhận của bạn; chưa phải nhận diện chữ AI.</p></section>`;
}

function renderAiWidget() {
  const root = document.getElementById('aiRoot'); if (!root) return;
  if (!state.currentUser?.onboardingCompleted) { root.innerHTML = ''; return; }
  const conversation = AITutorService.current(); const messages = conversation?.messages || [];
  const t = (key) => I18nService.t(key);
  root.innerHTML = `<button class="ai-fab" id="aiFab" aria-label="${escapeHtml(t('ai.fab'))}">✨ AI</button>${state.aiOpen ? `<aside class="ai-panel" role="dialog" aria-label="${escapeHtml(t('ai.title'))}"><header><div><strong>✨ ${escapeHtml(t('ai.title'))}</strong><small>${escapeHtml(t('ai.subtitle'))}</small></div><div class="ai-panel-actions"><button id="aiNewChat" aria-label="${escapeHtml(t('ai.newChat'))}">＋</button><button id="aiClose" aria-label="${escapeHtml(t('ai.close'))}">×</button></div></header><div class="ai-quick-actions"><button data-ai-quick="Giải thích bài học hiện tại cho tôi.">📚 ${escapeHtml(t('ai.lesson'))}</button><button data-ai-quick="Sửa câu tiếng Hàn của tôi và giải thích lỗi.">🇰🇷 ${escapeHtml(t('ai.correct'))}</button><button data-ai-quick="Dịch ý này sang tiếng Hàn lịch sự.">🌐 ${escapeHtml(t('ai.translate'))}</button><button data-ai-quick="Tạo cho tôi 5 câu luyện phù hợp trình độ.">📝 ${escapeHtml(t('ai.exercise'))}</button></div><div class="ai-messages">${messages.length ? messages.map((item) => `<div class="ai-message ${item.role}"><span>${item.role === 'assistant' ? '✨' : escapeHtml(t('ai.you'))}</span><p>${escapeHtml(item.content).replace(/\n/g, '<br>')}</p></div>`).join('') : `<div class="ai-empty">${escapeHtml(t('ai.empty'))}</div>`}${state.aiBusy ? `<div class="ai-typing">${escapeHtml(t('ai.thinking'))}</div>` : ''}</div><form id="aiForm"><textarea id="aiInput" rows="2" maxlength="4000" placeholder="${escapeHtml(t('ai.placeholder'))}"></textarea><button class="btn primary" type="submit" aria-label="${escapeHtml(t('ai.send'))}">${escapeHtml(t('ai.send'))}</button></form><small class="ai-privacy">${escapeHtml(t('ai.privacy'))}</small></aside>` : ''}`;
  document.getElementById('aiFab')?.addEventListener('click', () => { state.aiOpen = true; AITutorService.ensure(); renderAiWidget(); });
  document.getElementById('aiClose')?.addEventListener('click', () => { state.aiOpen = false; renderAiWidget(); });
  document.getElementById('aiNewChat')?.addEventListener('click', () => { AITutorService.start('Cuộc trò chuyện mới'); renderAiWidget(); });
  document.querySelectorAll('[data-ai-quick]').forEach((button) => button.addEventListener('click', () => { const input = document.getElementById('aiInput'); if (input) { input.value = button.dataset.aiQuick; input.focus(); } }));
  const form = document.getElementById('aiForm'); if (form) form.addEventListener('submit', (event) => { event.preventDefault(); const input = document.getElementById('aiInput'); const value = input?.value.trim(); if (value) { input.value = ''; AITutorService.send(value); } });
}

function lessonView() {
  const lesson = window.CurriculumService?.lesson?.(state.selectedLessonPreview) || (window.KLEARN_THEORY_LESSONS || []).find((item) => item.id === state.selectedLessonPreview) || (window.KLEARN_THEORY_LESSONS || [])[0] || { id: 'topic-particle', title: 'Bài học tiếng Hàn', topic: 'Ngữ pháp', estimatedMinutes: 10, theory: { vi: 'Học một cấu trúc tiếng Hàn theo ngữ cảnh.' }, grammar: { vi: 'Luyện mẫu câu và kiểm tra ngay trong bài.' } };
  const completed = Boolean(state.lessonProgress[lesson.id]?.completed); const step = Math.max(0, Math.min(6, Number(state.lessonStep) || 0)); const romanization = showRomanizationEnabled();
  const words = DictionaryService.search(lesson.topic || '').slice(0, 3); const fallbackWords = [DictionaryService.byId('word-학교'), DictionaryService.byId('word-공부')].filter(Boolean); const lessonWords = words.length ? words : fallbackWords;
  const wordButton = (word) => word ? `<button class="context-word" data-context-word="${escapeHtml(word.korean)}" lang="ko">${escapeHtml(word.korean)}</button>` : '';
  const examples = lesson.id === 'topic-particle' ? [['저는 학생입니다.', 'Tôi là học sinh.'], ['선생님은 한국 사람입니다.', 'Giáo viên là người Hàn Quốc.']] : [['한국어를 꾸준히 연습해요.', 'Tôi luyện tiếng Hàn đều đặn.'], [`${lesson.topic || '오늘'}에 대해 이야기해요.`, `Cùng nói về chủ đề ${lesson.topic || 'hôm nay'}.`]];
  const stepTitles = ['Mục tiêu', 'Từ vựng', 'Giải thích', 'Ví dụ', 'Quick Check', 'Practice', 'Tổng kết'];
  const body = [
    `<section class="lesson-step-card card"><p class="eyebrow">Mục tiêu bài học</p><h2 class="section-title">Sau bài này, bạn có thể học về ${escapeHtml(lesson.topic || 'chủ đề tiếng Hàn')}.</h2><p class="subtle">${escapeHtml(I18nService.localizedText(lesson, 'theory') || 'Nắm ý chính, nhận diện mẫu câu và áp dụng vào một tình huống ngắn.')}</p><div class="lesson-goal-list"><span>✓ Nhận diện cấu trúc</span><span>✓ Hiểu ví dụ</span><span>✓ Tự kiểm tra ngay</span></div></section>`,
    `<section class="lesson-step-card card"><p class="eyebrow">Từ khóa</p><h2 class="section-title">Từ vựng cần biết</h2><p class="subtle">Chạm vào từ để xem nghĩa nhanh mà không rời bài học.</p><div class="lesson-vocab-grid">${lessonWords.map((word) => `<div><div class="lesson-context-line">${wordButton(word)}</div><small>${escapeHtml(I18nService.localizedText(word, 'meaning') || '')}</small></div>`).join('') || '<p class="subtle">Từ mới sẽ được bổ sung theo dữ liệu bài học.</p>'}</div></section>`,
    `<section class="lesson-step-card card"><p class="eyebrow">Điểm ngữ pháp</p><h2 class="section-title">${escapeHtml(lesson.topic || 'Cấu trúc trọng tâm')}</h2><p class="subtle">${escapeHtml(I18nService.localizedText(lesson, 'grammar') || 'Đọc mẫu câu, xác định vai trò của từ và thử áp dụng vào một câu mới.')}</p><div class="grammar-box"><b>Cách học</b><ol><li>Nhìn vị trí cấu trúc trong câu.</li><li>Đối chiếu nghĩa và ngữ cảnh.</li><li>Thử thay một từ để tạo câu mới.</li></ol></div></section>`,
    `<section class="lesson-step-card card"><div class="section-heading"><div><p class="eyebrow">Ví dụ trong ngữ cảnh</p><h2 class="section-title">Đọc, nghe và chạm từ</h2></div>${renderRomanizationToggle(true)}</div>${examples.map(([korean, meaning]) => `<div class="example"><div><div class="korean example-korean" lang="ko">${korean.split(/(학교|한국어|학생|선생님|공부)/).map((part) => /^(학교|한국어|학생|선생님|공부)$/.test(part) ? wordButton({ korean: part }) : escapeHtml(part)).join('')}</div>${romanization ? `<div class="learning-romanization">${escapeHtml(getRomanization({ korean }))}</div>` : ''}<div class="learning-meaning">${escapeHtml(meaning)}</div></div><button class="audio-btn" data-speak="${escapeHtml(korean)}" aria-label="${I18nService.t('lesson.audio')}">🔊</button></div>`).join('')}</section>`,
    `<section class="lesson-step-card card"><p class="eyebrow">Kiểm tra nhanh</p><h2 class="section-title">Chọn câu đúng</h2><p class="korean" lang="ko">저는 학교<span class="context-word-inline">__</span> 가요.</p><div class="lesson-choice-grid">${['에', '를', '는'].map((answer) => `<button class="lesson-choice ${state.lessonCheck?.key === 'location' && state.lessonCheck.answer === answer ? 'selected' : ''}" data-lesson-choice="location" data-answer="${answer}">${answer}</button>`).join('')}</div>${state.lessonCheck?.key === 'location' ? `<div class="lesson-feedback ${state.lessonCheck.correct ? 'success' : 'error'}"><b>${state.lessonCheck.correct ? 'Đúng rồi!' : 'Chưa đúng'}</b><p>학교에 가요 nghĩa là “đi đến trường”; 에 đánh dấu địa điểm đến.</p></div>` : '<p class="subtle">Chọn một đáp án để xem giải thích.</p>'}</section>`,
    `<section class="lesson-step-card card"><p class="eyebrow">Practice</p><h2 class="section-title">Áp dụng ngay</h2>${lesson.id === 'topic-particle' ? `<p class="subtle">Sắp xếp câu: “Tôi là người Việt Nam.”</p><div id="dropZone" class="drop-zone"></div><div id="chipBox" class="chips"></div><p id="sentenceFeedback" class="exercise-feedback" role="status"></p><div class="action-row"><button class="btn secondary" id="resetSentence">${I18nService.t('lesson.reset')}</button><button class="btn primary" id="checkSentence">${I18nService.t('lesson.check')}</button></div>` : `<p class="subtle">Chọn đuôi câu phù hợp: 어제 친구를 ___.</p><div class="lesson-choice-grid">${['만났어요', '만나요', '갈 거예요'].map((answer) => `<button class="lesson-choice ${state.lessonCheck?.key === 'past' && state.lessonCheck.answer === answer ? 'selected' : ''}" data-lesson-choice="past" data-answer="${answer}">${answer}</button>`).join('')}</div>${state.lessonCheck?.key === 'past' ? `<div class="lesson-feedback ${state.lessonCheck.correct ? 'success' : 'error'}"><b>${state.lessonCheck.correct ? 'Chính xác!' : 'Hãy thử lại'}</b><p>어제 là “hôm qua”, nên dùng thì quá khứ 만났어요.</p></div>` : ''}`}</section>`,
    `<section class="lesson-step-card card lesson-summary"><div class="celebration">✓</div><p class="eyebrow">Hoàn thành bài</p><h2 class="headline">Bạn đã đi hết ${stepTitles.length} bước</h2><p class="subtle">Tiến độ và mastery sẽ được lưu vào đúng bài học ${escapeHtml(lesson.title || '')}.</p><div class="result-counts"><span>Thời lượng <b>${lesson.estimatedMinutes || 10}′</b></span><span>Trạng thái <b>${completed ? 'Đã hoàn thành' : 'Sẵn sàng lưu'}</b></span></div></section>`
  ][step];
  return `<div class="lesson-header"><button class="close-btn" data-view="lessons" aria-label="${I18nService.t('lesson.close')}">×</button><div class="lesson-progress"><div class="bar"><span style="width:${Math.round(((step + 1) / stepTitles.length) * 100)}%"></span></div></div><span class="subtle">${step + 1} / ${stepTitles.length}</span></div><section class="section lesson-title"><p class="eyebrow">${escapeHtml(lesson.title || 'Bài học')}</p><h1 class="headline">${stepTitles[step]}</h1><p class="subtle">${escapeHtml(lesson.topic || '')}</p></section><div class="lesson-stepper">${stepTitles.map((title, index) => `<span class="${index === step ? 'active' : index < step ? 'done' : ''}">${index + 1}. ${title}</span>`).join('')}</div>${body}<div class="action-row lesson-actions"><button class="btn secondary" data-lesson-prev ${step === 0 ? 'disabled' : ''}>← Quay lại</button>${step < stepTitles.length - 1 ? `<button class="btn primary" data-lesson-next>Tiếp theo →</button>` : `<button class="btn primary" id="completeLesson" ${!completed && !state.lessonCheck?.correct && !state.sentenceCorrect ? 'disabled' : ''}>${completed ? 'Đã hoàn thành ✓' : 'Lưu tiến độ'}</button>`}</div>`;
}

function practiceHubView() {
  const target = state.currentUser.targetTopikLevel;
  const historyCount = PracticeService.getHistory().length;
  const savedCount = (PracticeService.getMeta().savedSetIds || []).length;
  const groups = [
    ['🧭','Chiến thuật TOPIK','Học cách xử lý từng dạng câu','strategy-lab'], ['📝','Kho đề TOPIK','270 bộ đề TOPIK 1–6','exam-catalog'], ['⏱','Thi thử full đề','Exam mode · timer · không gợi ý','topik-exam'], ['1–2','TOPIK 1–2','Nền tảng và TOPIK I','exam-catalog','TOPIK_1'],
    ['3–4','TOPIK 3–4','Trung cấp và TOPIK II','exam-catalog','TOPIK_3'], ['5–6','TOPIK 5–6','Học thuật và chuyên sâu','advanced-practice'],
    ['🎲','Đề ngẫu nhiên','5–50 câu tùy chọn','random-exam'], ['🔥','Đề nâng cao','Advanced / Very Advanced','advanced-practice'],
    ['🗂','Từ vựng','1.000 từ TOPIK 1–6','vocabulary-hub'], ['문','Ngữ pháp','30 grammar challenge','skill-hub','grammar'],
    ['🔊','Nghe','Từ, câu, hội thoại, đoạn','skill-hub','listening'], ['📖','Đọc','Ngắn, trung bình, dài','skill-hub','reading'],
    ['✍️','Viết','10 mode và TOPIK Writing','writing-hub'], ['🎙','Nói','10 mode luyện nói','speaking-hub'],
    ['🏭','EPS-TOPIK','30 đề công việc','exam-catalog','EPS'], ['#','Theo chủ đề','Đời sống đến học thuật','exam-catalog','VOCABULARY'],
    ['↻','Luyện lỗi sai','Ưu tiên câu còn yếu','wrong-practice'], ['★','Đề đã lưu',`${savedCount} đề`,'saved-exams'], ['🕘','Lịch sử',`${historyCount} lượt luyện`,'practice-history'], ['📊','Phân tích TOPIK','Trend, readiness, skill','analytics']
  ];
  return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">${PracticeService.bank.practiceTypeCount} dạng bài · ${PracticeService.bank.totalQuestionCount.toLocaleString('vi-VN')} câu</p><h1 class="headline">Trung tâm luyện tập</h1><p class="subtle">Hiện tại ${topikLabel(state.currentUser.currentTopikLevel)} · Mục tiêu ${topikLabel(target)}</p></section>
    <section class="card recommended-card section"><div><span class="eyebrow">Đề xuất theo mục tiêu</span><h2>${topikLabel(target)} · Đề 01</h2><p>Luyện theo cấp mục tiêu và các chủ đề bạn đang yếu.</p></div><button class="btn primary" data-recommended-set="TOPIK_${target}">Luyện đề xuất</button></section>
    <section class="topik-countdown section"><span>Còn 28 ngày</span><div><b>Kế hoạch luyện thi</b><small>Mốc cá nhân mẫu · điều chỉnh trong Hồ sơ</small></div><button class="text-link" data-view="adaptive-plan">Điều chỉnh</button></section><section class="hub-grid">${groups.map(([icon,title,description,view,value]) => `<button class="hub-card" ${view === 'full-exam' ? 'data-full-exam="true"' : `data-hub-view="${view}"`} ${value ? `data-hub-value="${value}"` : ''}><span>${icon}</span><div><b>${title}</b><small>${description}</small></div><i>›</i></button>`).join('')}</section>`;
}

function strategyLabView() {
  const strategies = window.TopikStrategyService?.all?.() || [];
  const groups = [['TOPIK I', ['listening', 'reading']], ['TOPIK II', ['listening', 'reading', 'writing']]];
  return `<section class="section page-heading"><button class="back-link" data-view="topik">← TOPIK</button><p class="eyebrow">TOPIK Strategy Lab</p><h1 class="headline">Chiến thuật TOPIK</h1><p class="subtle">Học cách nhận diện và xử lý từng dạng câu trước khi bấm giờ làm đề.</p></section>${groups.map(([level, skills]) => `<section class="strategy-group section"><div class="section-heading"><h2 class="section-title">${level}</h2><span class="sync-status">${skills.map((skill) => skill === 'listening' ? 'Nghe' : skill === 'reading' ? 'Đọc' : 'Viết').join(' · ')}</span></div><div class="strategy-grid">${strategies.filter((item) => item.examLevel === level && skills.includes(item.skill)).map((item) => { const p = window.TopikStrategyService.progress(item.id); return `<button class="strategy-card" data-strategy-id="${item.id}"><span class="strategy-skill">${item.skill === 'listening' ? '🔊 Nghe' : item.skill === 'reading' ? '📖 Đọc' : '✍️ Viết'}</span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.description)}</small><em>${p.attempts ? `Đã luyện · tốt nhất ${p.best}%` : 'Chưa luyện'}</em></button>`; }).join('') || '<div class="empty-state compact-empty">Chưa có dạng câu phù hợp trong dữ liệu hiện tại.</div>'}</div></section>`).join('')}<section class="support-message section"><b>Nói không phải là phần thi TOPIK chuẩn hóa.</b><span>Phần luyện nói vẫn nằm trong Học tập và được theo dõi riêng.</span></section>`;
}

function strategyDetailView() {
  const strategy = window.TopikStrategyService?.get?.(state.selectedStrategyId);
  if (!strategy) return strategyLabView();
  const p = window.TopikStrategyService.progress(strategy.id);
  return `<section class="section page-heading"><button class="back-link" data-view="strategy-lab">← Chiến thuật TOPIK</button><p class="eyebrow">${escapeHtml(strategy.examLevel)} · ${strategy.skill === 'listening' ? 'Nghe' : strategy.skill === 'reading' ? 'Đọc' : 'Viết'}</p><h1 class="headline">${escapeHtml(strategy.title)}</h1><p class="subtle">${escapeHtml(strategy.description)}</p></section><section class="strategy-detail card section"><div class="strategy-detail-meta"><span>Nhận biết dạng câu</span><span>${p.attempts ? `Đã luyện ${p.attempts} lượt · tốt nhất ${p.best}%` : 'Chưa có kết quả'}</span></div><h2>Nhận biết</h2><ul>${strategy.recognitionTips.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><h2>Mục tiêu câu hỏi</h2><p>${escapeHtml(strategy.description)}</p><h2>4 bước xử lý</h2><ol class="strategy-steps">${strategy.solvingSteps.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ol><h2>Lỗi thường gặp</h2><ul>${strategy.commonMistakes.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>${strategy.examples.map((item) => `<div class="strategy-example"><b>Ví dụ</b><p>${escapeHtml(item.prompt)}</p><small>${escapeHtml(item.answer)}</small></div>`).join('')}<div class="action-row"><button class="btn secondary" data-strategy-practice="${strategy.id}" data-count="5">Luyện 5 câu</button><button class="btn primary" data-strategy-practice="${strategy.id}" data-count="10">Luyện 10 câu</button></div></section>`;
}

function randomExamView() {
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">Ưu tiên câu chưa làm và từng sai</p><h1 class="headline">🎲 Đề ngẫu nhiên</h1></section><form id="randomExamForm" class="card choice-form"><fieldset><legend>Cấp độ</legend><select name="level" class="form-select"><option value="current">Theo trình độ hiện tại (${topikLabel(state.currentUser.currentTopikLevel)})</option>${[1,2,3,4,5,6].map((level) => `<option value="TOPIK_${level}">TOPIK ${level}</option>`).join('')}</select></fieldset><fieldset><legend>Số câu</legend><div class="segmented-options">${[5,10,15,20,30,50].map((count) => `<label><input type="radio" name="count" value="${count}" ${count === 20 ? 'checked' : ''}><span>${count}</span></label>`).join('')}</div></fieldset><fieldset><legend>Kỹ năng</legend><div class="radio-list compact">${[['mixed','Tổng hợp'],['vocabulary','Từ vựng'],['grammar','Ngữ pháp'],['listening','Nghe'],['reading','Đọc'],['writing','Viết'],['speaking','Nói']].map(([value,label]) => `<label><input type="radio" name="skill" value="${value}" ${value === 'mixed' ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset><fieldset><legend>Độ khó</legend><div class="segmented-options">${[['mixed','Trộn'],['1','Dễ'],['2','Vừa'],['3','Khó']].map(([value,label]) => `<label><input type="radio" name="difficulty" value="${value}" ${value === 'mixed' ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset><button class="btn primary full" type="submit">Tạo đề</button></form>`;
}

function advancedPracticeView() {
  const lockedWarning = state.currentUser.currentTopikLevel < 3;
  const sets = PracticeService.bank.sets.filter((set) => ['TOPIK_5','TOPIK_6'].includes(set.level)).slice(0, 12);
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">TOPIK 3–6</p><h1 class="headline">🔥 Thử thách nâng cao</h1><p class="subtle">Ngữ pháp khó, thành ngữ, học thuật, báo chí, suy luận và logic đoạn văn.</p></section>${lockedWarning ? `<section class="support-message advanced-warning"><b>Đề này cao hơn trình độ hiện tại của bạn.</b><span>Bạn vẫn có thể thử; kết quả chỉ dùng để định hướng.</span></section>` : ''}<section class="practice-set-list">${sets.map((set) => { const summary = PracticeService.setSummary(set.id); return `<article class="card practice-set-card"><div class="set-card-top"><div><span class="set-level">${set.levelLabel}</span><h2>Đề ${String(set.examNumber).padStart(2,'0')}</h2></div><button class="save-exam ${PracticeService.isSaved(set.id) ? 'saved' : ''}" data-save-set="${set.id}">${PracticeService.isSaved(set.id) ? '★' : '☆'}</button></div><p>${set.topic} · ${set.difficultyLabel}</p><div class="set-meta"><span>15 câu</span><span>${set.estimatedMinutes} phút</span><span>Tốt nhất ${summary.best ?? '—'}/15</span></div><button class="btn primary full" data-start-set="${set.id}">${lockedWarning ? 'Vẫn thử' : 'Bắt đầu'}</button></article>`; }).join('')}</section>`;
}

function wrongPracticeView() {
  const history = PracticeService.getHistory();
  const ids = [...new Set(history.flatMap((attempt) => attempt.wrongQuestionIds || []))];
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">Từ lịch sử cá nhân</p><h1 class="headline">Luyện lại câu sai</h1><p class="subtle">${ids.length} câu từng sai. Trả lời đúng sẽ giảm độ ưu tiên; sai tiếp sẽ được ưu tiên hơn.</p></section>${ids.length ? `<form id="wrongPracticeForm" class="card choice-form"><fieldset><legend>Số câu</legend><div class="segmented-options">${[5,10,20].filter((count) => count < ids.length).map((count) => `<label><input type="radio" name="count" value="${count}" ${count === Math.min(10, ids.length) ? 'checked' : ''}><span>${count}</span></label>`).join('')}<label><input type="radio" name="count" value="${ids.length}" ${ids.length <= 10 ? 'checked' : ''}><span>Tất cả</span></label></div></fieldset><button class="btn primary full" type="submit">Bắt đầu luyện lỗi sai</button></form>` : '<section class="empty-state compact-empty"><div class="celebration">🎯</div><h2>Bạn chưa có câu sai</h2><button class="btn primary" data-view="exam-catalog">Làm một đề</button></section>'}`;
}

function savedExamsView() {
  const ids = PracticeService.getMeta().savedSetIds || [];
  const sets = ids.map((id) => PracticeService.bank.sets.find((set) => set.id === id)).filter(Boolean);
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">${sets.length} đề</p><h1 class="headline">★ Đề đã lưu</h1></section>${sets.length ? `<section class="practice-set-list">${sets.map((set) => `<article class="card practice-set-card"><div class="set-card-top"><div><span class="set-level">${set.levelLabel}</span><h2>Đề ${String(set.examNumber).padStart(2,'0')}</h2></div><button class="save-exam saved" data-save-set="${set.id}">★</button></div><p>${set.topic} · ${set.practiceTypeLabel}</p><button class="btn primary full" data-start-set="${set.id}">Làm đề</button></article>`).join('')}</section>` : '<section class="empty-state compact-empty"><div class="celebration">☆</div><h2>Chưa lưu đề nào</h2><p class="subtle">Chạm biểu tượng ☆ tại danh sách đề để lưu.</p><button class="btn primary" data-view="exam-catalog">Chọn đề</button></section>'}`;
}

function practiceHistoryView() {
  const history = PracticeService.getHistory();
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">${history.length} lượt</p><h1 class="headline">Lịch sử luyện tập</h1></section><section class="history-list">${history.length ? history.map((attempt) => `<article class="card history-card"><div><span class="set-level">${escapeHtml(attempt.level || 'Practice')}</span><h2>${escapeHtml(attempt.setTitle)}</h2><p>${formatDate(attempt.completedAt)} · ${Math.max(1,Math.round((attempt.durationSeconds || 0)/60))} phút · ${attempt.total-attempt.score} câu sai</p></div><strong>${attempt.score}/${attempt.total}</strong><div class="history-actions"><button class="btn secondary" data-view-attempt="${attempt.id}">Xem kết quả</button><button class="btn primary" data-retry-history="${attempt.id}">Làm lại</button></div></article>`).join('') : '<div class="empty-filter card">Chưa có lịch sử. Hãy hoàn thành một đề đầu tiên.</div>'}</section>`;
}

function skillHubView() {
  const skill = state.selectedSkillHub;
  const labels = { grammar: ['문','Ngữ pháp','30 challenge từ trợ từ đến sắc thái học thuật'], listening: ['🔊','Luyện nghe','Nghe từ, câu, hội thoại, thông báo, công sở, EPS và TOPIK'], reading: ['📖','Luyện đọc','Đoạn ngắn, trung bình và dài theo TOPIK 1–6'] };
  const [icon,title,description] = labels[skill] || labels.listening;
  const sets = PracticeService.bank.sets.filter((set) => set.skill === skill || (skill === 'grammar' && set.level === 'GRAMMAR')).slice(0, 10);
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">${icon} Theo kỹ năng</p><h1 class="headline">${title}</h1><p class="subtle">${description}</p></section><section class="catalog-levels section">${[1,2,3,4,5,6].map((level) => `<button data-skill-level="${level}">TOPIK ${level}</button>`).join('')}</section><section class="practice-set-list">${sets.map((set) => `<article class="card practice-set-card"><span class="set-level">${set.levelLabel}</span><h2>${set.topic}</h2><p>${set.practiceTypeLabel} · ${set.questionCount} câu</p><button class="btn primary full" data-start-set="${set.id}">Luyện ${skill === 'listening' ? 'nghe' : skill === 'reading' ? 'đọc' : 'ngữ pháp'}</button></article>`).join('')}</section>`;
}

function vocabularyHubView() {
  const filters = state.vocabularyFilters;
  const filtered = VocabularyService.filtered();
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  filters.page = Math.min(filters.page, totalPages);
  const words = filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize);
  const topics = [...new Set(state.srsData.map((card) => card.topic))].sort();
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">${state.srsData.length.toLocaleString('vi-VN')} từ</p><h1 class="headline">Từ vựng TOPIK 1–6</h1><p class="subtle">Tìm bằng Hangul, tiếng Việt hoặc phiên âm Latin và lọc theo cấp, chủ đề, loại từ, trạng thái SRS.</p>${renderRomanizationToggle()}</section><label class="search-box section"><span>⌕</span><input id="vocabularySearch" type="search" placeholder="학교, hakgyo hoặc trường học" value="${escapeHtml(filters.search)}"></label><section class="card vocabulary-filters section"><select data-vocab-filter="topikLevel"><option value="all">Mọi cấp TOPIK</option>${[1,2,3,4,5,6].map((level) => `<option value="${level}" ${filters.topikLevel == level ? 'selected' : ''}>TOPIK ${level}</option>`).join('')}</select><select data-vocab-filter="topic"><option value="all">Mọi chủ đề</option>${topics.map((topic) => `<option value="${topic}" ${filters.topic === topic ? 'selected' : ''}>${escapeHtml(state.srsData.find((card) => card.topic === topic)?.topicLabel || topic)}</option>`).join('')}</select><select data-vocab-filter="partOfSpeech"><option value="all">Mọi loại từ</option>${[['noun','Danh từ'],['verb','Động từ'],['adjective','Tính từ'],['adverb','Trạng từ']].map(([value,label]) => `<option value="${value}" ${filters.partOfSpeech === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select data-vocab-filter="status"><option value="all">Mọi trạng thái</option>${[['new','Chưa học'],['learning','Đang học'],['review','Cần ôn'],['remembered','Đã nhớ'],['mastered','Mastered'],['wrong','Hay sai']].map(([value,label]) => `<option value="${value}" ${filters.status === value ? 'selected' : ''}>${label}</option>`).join('')}</select></section><div class="results-count">${filtered.length} từ phù hợp</div><section class="vocabulary-list">${words.map((card) => `<article class="vocabulary-row"><button data-speak="${escapeHtml(card.audioText)}" aria-label="Nghe phát âm tiếng Hàn">🔊</button><div><b lang="ko">${escapeHtml(card.korean)}</b>${showRomanizationEnabled() ? `<i>${escapeHtml(getRomanization(card))}</i>` : ''}<span>${escapeHtml(card.meaningVi)}</span></div><small>TOPIK ${card.topikLevel}<br>${escapeHtml(card.status)}</small></article>`).join('')}</section><div class="pagination"><button class="btn secondary" data-vocab-page="${filters.page-1}" ${filters.page<=1?'disabled':''}>←</button><span>${filters.page} / ${totalPages}</span><button class="btn secondary" data-vocab-page="${filters.page+1}" ${filters.page>=totalPages?'disabled':''}>→</button></div><div class="action-row"><button class="btn secondary" data-view="vocab-test-setup">Kiểm tra từ</button><button class="btn primary" data-view="review">Ôn SRS</button></div>`;
}

function questionSetMetadata(set) {
  const examLevel = /^TOPIK_[12]$/.test(set.level) ? 'TOPIK I' : /^TOPIK_[3-6]$/.test(set.level) ? 'TOPIK II' : set.level;
  const sourceType = set.practiceTypeLabel?.toLowerCase().includes('mock') ? 'mock' : 'practice';
  return { id: set.id, title: set.title, examLevel, skill: set.skill, type: set.practiceTypeLabel || set.category || 'Practice', sourceType, sourceLabel: 'Biên soạn nội bộ · practice bank', difficulty: set.difficultyLabel, questionCount: set.questionCount, estimatedMinutes: set.estimatedMinutes, tags: [set.topic, set.level], createdAt: '2026-01-01', updatedAt: '2026-09-01' };
}
const QuestionBankService = {
  all() { return (PracticeService.bank?.sets || []).map(questionSetMetadata); },
  get(id) { const set = PracticeService.bank?.sets?.find((item) => item.id === id); return set ? questionSetMetadata(set) : null; },
  history(id) { return PracticeService.getHistory().filter((attempt) => attempt.setId === id); }
};
window.QuestionBankService = QuestionBankService;
function examCatalogView() {
  const filters = state.practiceFilters;
  const filtered = PracticeService.filteredSets();
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  filters.page = Math.min(filters.page, totalPages);
  const visibleSets = filtered.slice((filters.page - 1) * pageSize, filters.page * pageSize);
  const topics = [...new Set((PracticeService.bank?.sets || []).map((set) => set.topic))].sort();
  const statusLabels = { not_started: 'Chưa làm', completed: 'Đã làm', needs_review: 'Cần luyện lại' };
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">${PracticeService.bank.totalSetCount} bộ · ${PracticeService.bank.totalQuestionCount.toLocaleString('vi-VN')} câu</p><h1 class="headline">Chọn đề</h1><p class="subtle">Chọn chính xác số đề TOPIK 1–6, EPS, vocabulary hoặc grammar challenge.</p></section>
    <section class="catalog-levels section">${[1,2,3,4,5,6].map((level) => `<button data-practice-level="TOPIK_${level}" class="${filters.level === `TOPIK_${level}` ? 'selected' : ''}">TOPIK ${level}</button>`).join('')}<button data-practice-level="EPS" class="${filters.level === 'EPS' ? 'selected' : ''}">EPS</button><button data-practice-level="all" class="${filters.level === 'all' ? 'selected' : ''}">Tất cả</button></section>
    <label class="search-box section"><span>⌕</span><input id="practiceSearch" type="search" placeholder="Tìm tên đề, chủ đề, dạng bài..." value="${escapeHtml(state.practiceSearch)}"></label>
    <section class="card practice-filters section">
      <label>Cấp độ<select data-practice-filter="level"><option value="all">Tất cả</option>${[['Beginner','Beginner'],...[1,2,3,4,5,6].map((level) => [`TOPIK_${level}`,`TOPIK ${level}`]),['EPS','EPS'],['VOCABULARY','Vocabulary challenge'],['GRAMMAR','Grammar challenge']].map(([value, label]) => `<option value="${value}" ${filters.level === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Kỹ năng<select data-practice-filter="skill"><option value="all">Tất cả</option>${[['vocabulary','Từ vựng'],['grammar','Ngữ pháp'],['listening','Nghe'],['reading','Đọc'],['mixed','Tổng hợp']].map(([value, label]) => `<option value="${value}" ${filters.skill === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <label>Độ khó<select data-practice-filter="difficulty"><option value="all">Tất cả</option><option value="1" ${filters.difficulty === '1' ? 'selected' : ''}>Dễ</option><option value="2" ${filters.difficulty === '2' ? 'selected' : ''}>Trung bình</option><option value="3" ${filters.difficulty === '3' ? 'selected' : ''}>Khó</option><option value="4" ${filters.difficulty === '4' ? 'selected' : ''}>Advanced</option><option value="5" ${filters.difficulty === '5' ? 'selected' : ''}>Very Advanced</option></select></label>
      <label>Trạng thái<select data-practice-filter="status"><option value="all">Tất cả</option><option value="not_started" ${filters.status === 'not_started' ? 'selected' : ''}>Chưa làm</option><option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>Đã làm</option><option value="needs_review" ${filters.status === 'needs_review' ? 'selected' : ''}>Cần luyện lại</option></select></label>
      <label class="filter-topic">Chủ đề<select data-practice-filter="topic"><option value="all">Tất cả chủ đề</option>${topics.map((topic) => `<option value="${escapeHtml(topic)}" ${filters.topic === topic ? 'selected' : ''}>${escapeHtml(topic)}</option>`).join('')}</select></label>
    </section>
    <div class="results-count">${filtered.length} bộ đề phù hợp</div>
    <section class="practice-set-list">${visibleSets.length ? visibleSets.map((set) => {
      const summary = PracticeService.setSummary(set.id);
      const meta = questionSetMetadata(set);
      return `<article class="card practice-set-card"><div class="set-card-top"><div><span class="set-level">${escapeHtml(meta.examLevel)} · ${escapeHtml(set.levelLabel)}</span><h2>${escapeHtml(set.title || `Đề ${String(set.examNumber).padStart(2, '0')}`)}</h2></div><button class="save-exam ${PracticeService.isSaved(set.id) ? 'saved' : ''}" data-save-set="${set.id}" aria-label="${PracticeService.isSaved(set.id) ? 'Bỏ lưu đề' : 'Lưu đề'}">${PracticeService.isSaved(set.id) ? '★' : '☆'}</button></div><p>${escapeHtml(set.topic)} · ${escapeHtml(meta.type)} · ${escapeHtml(meta.difficulty)}</p><div class="set-meta"><span>${meta.questionCount} câu</span><span>Khoảng ${meta.estimatedMinutes} phút</span><span>${escapeHtml(meta.sourceType)} · ${escapeHtml(meta.sourceLabel)}</span><span>Điểm cao nhất: ${summary.best === null ? '—' : `${summary.best}/${set.questionCount}`}</span><span>${summary.latest ? `Sai gần nhất: ${summary.latest.wrong || 0}` : 'Chưa làm'}</span><span>${summary.attemptCount} lượt</span><span>${summary.latest ? formatDate(summary.latest.completedAt) : statusLabels[summary.status]}</span></div><div class="action-row"><button class="btn ${summary.status === 'not_started' ? 'primary' : 'secondary'}" data-start-set="${set.id}">${summary.status === 'not_started' ? 'Làm đề' : 'Làm lại'}</button>${summary.status !== 'not_started' ? '<button class="btn secondary" data-view="wrong-practice">Làm lại câu sai</button>' : ''}</div></article>`;
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
  const question = I18nService.localizeQuestion(session.questions[session.index]);
  const selectedAnswer = session.selected;
  const correct = selectedAnswer === question.correctAnswer;
  const isListening = question.skill === 'listening';
  const reviewRomanization = state.questionRomanization[question.id] ?? showRomanizationEnabled();
  return `<div class="lesson-header"><button class="close-btn" id="leavePractice" aria-label="Thoát bài luyện">×</button><div class="lesson-progress"><div class="bar"><span style="width:${Math.round(((session.index + (session.checked ? 1 : 0)) / session.questions.length) * 100)}%"></span></div></div><span class="subtle">${session.index + 1}/${session.questions.length}</span></div>
    <section class="section practice-session-title"><p class="eyebrow">${escapeHtml(session.set.levelLabel || session.set.level)} · ${escapeHtml(session.set.topic)}</p><h1>${escapeHtml(session.set.title)}</h1></section>
    <section class="card live-question"><div class="question-tags"><span>${escapeHtml(question.skill)}</span><span>${escapeHtml(question.questionTypeLabel || question.questionType)}</span><span>Độ khó ${question.difficulty}</span></div>${question.koreanText && !isListening ? `<div class="question-korean contextual-line" lang="ko">${contextualizeKorean(question.koreanText)}</div>` : ''}<h2>${escapeHtml(question.prompt)}</h2>${question.audioText ? `<button class="audio-inline" data-speak="${escapeHtml(question.audioText)}" aria-label="Nghe phát âm tiếng Hàn">🔊 Nghe</button>` : ''}<div class="answer-list">${question.options.map((option, index) => {
      const answerClass = !session.checked ? (selectedAnswer === option ? 'selected' : '') : option === question.correctAnswer ? 'correct' : selectedAnswer === option ? 'wrong' : '';
      return `<button class="answer-button ${answerClass}" data-practice-answer="${escapeHtml(option)}" ${session.checked ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`;
    }).join('')}</div>${session.checked ? `<div class="answer-feedback ${correct ? 'success' : 'error'}"><strong>${correct ? '✓ Đúng rồi!' : 'Chưa đúng'}</strong>${!correct ? `<p>Đáp án đúng: <b>${escapeHtml(question.correctAnswer)}</b></p>` : ''}<p>${escapeHtml(question.explanationVi)}</p></div>${question.koreanText ? `<div class="question-learning-review"><div class="review-learning-heading"><b>${isListening ? 'Transcript sau khi trả lời' : 'Hỗ trợ học lại'}</b><button data-question-romanization="${escapeHtml(question.id)}">Aa ${reviewRomanization ? 'Ẩn' : 'Hiện'} phiên âm</button></div>${renderKoreanLearningText({ ...question, korean: question.koreanText }, { compact: true, forceRomanization: reviewRomanization })}${question.audioText ? `<button class="audio-inline" data-speak="${escapeHtml(question.audioText)}" aria-label="Nghe lại phát âm tiếng Hàn">🔊 Nghe lại</button>` : ''}</div>` : ''}` : ''}</section>
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
  const wrongAnswers = result.attempt.answers.filter((answer) => !answer.correct && result.questions.some((question) => question.id === answer.questionId));
  return `<section class="section page-heading"><button class="back-link" data-view="practice-result" aria-label="Quay lại">←</button><p class="eyebrow">${wrongAnswers.length} câu cần xem lại</p><h1 class="headline">Giải thích câu sai</h1>${renderRomanizationToggle()}</section><section class="wrong-review-list">${wrongAnswers.map((answer, index) => {
    const question = result.questions.find((item) => item.id === answer.questionId);
      return `<article class="card wrong-review-card"><span>Câu ${index + 1}</span>${question.koreanText ? renderKoreanLearningText({ ...question, korean: question.koreanText }, { compact: true, contextual: true }) : ''}<h2>${escapeHtml(question.prompt)}</h2><p>Bạn chọn: <b class="wrong-text">${escapeHtml(answer.selectedAnswer)}</b></p><p>Đáp án: <b class="correct-text">${escapeHtml(question.correctAnswer)}</b></p><div class="explanation-box">${escapeHtml(question.explanationVi)}</div>${question.audioText ? `<button class="audio-inline" data-speak="${escapeHtml(question.audioText)}" aria-label="Nghe lại phát âm tiếng Hàn">🔊 Nghe lại</button>` : ''}</article>`;
  }).join('')}</section><button class="btn primary full" data-view="practice-result">Quay lại kết quả</button>`;
}

function dueCards() { return VocabularyService.dueCards(); }

function reviewEligibleCards() {
  let cards = VocabularyService.bySource(state.reviewSource || 'due');
  if (state.reviewTopic !== 'all') cards = cards.filter((card) => card.topic === state.reviewTopic);
  if (window.VocabularyImportanceService?.rank) cards = cards.slice().sort((a, b) => window.VocabularyImportanceService.rank(b, b).priority - window.VocabularyImportanceService.rank(a, a).priority);
  return cards;
}

function reviewView() {
  const cards = reviewEligibleCards();
  if (!cards.length) {
    const next = [...state.srsData].sort((a, b) => new Date(a.nextReview) - new Date(b.nextReview))[0];
    return `<section class="empty-state"><div class="celebration">🎉</div><h1 class="headline">Không có từ phù hợp</h1><p class="subtle">${next ? `Thẻ đến hạn tiếp theo dự kiến vào ${formatDate(next.nextReview)}.` : 'Hãy chọn nguồn từ khác.'}</p><button class="btn secondary" id="resetReviewSource">Xem từ đến hạn</button><button class="btn primary" data-view="vocabulary-hub">Mở kho từ vựng</button></section>`;
  }
  const max = cards.length;
  const choices = [5, 10, 20, 30, 50, 100].filter((count) => count < max);
  const selected = Math.min(state.reviewSelectionCount || 10, max);
  state.reviewSelectionCount = selected;
  const topics = [...new Set(state.srsData.map((card) => card.topic))].sort();
  return `<section class="section page-heading"><p class="eyebrow">SRS cá nhân</p><h1 class="headline">Ôn tập từ vựng</h1><p class="subtle">Có <strong>${max} từ phù hợp</strong> với nguồn đã chọn.</p><div class="action-row"><button class="btn primary" data-view="smart-review">🧠 Ôn tập thông minh</button><button class="btn secondary" data-view="vocabulary-hub">Kho từ</button></div></section><section class="card review-source section"><label>Nguồn từ<select id="reviewSource"><option value="due">Từ đến hạn hôm nay</option>${[1,2,3,4,5,6].map((level) => `<option value="topik-${level}" ${state.reviewSource === `topik-${level}` ? 'selected' : ''}>Từ TOPIK ${level}</option>`).join('')}<option value="wrong" ${state.reviewSource==='wrong'?'selected':''}>Từ từng làm sai</option><option value="mastered" ${state.reviewSource==='mastered'?'selected':''}>Từ mastered</option><option value="learned" ${state.reviewSource==='learned'?'selected':''}>Tất cả từ đã học</option></select></label><label>Chủ đề<select id="reviewTopic"><option value="all">Mọi chủ đề</option>${topics.map((topic) => `<option value="${topic}" ${state.reviewTopic===topic?'selected':''}>${escapeHtml(state.srsData.find((card)=>card.topic===topic)?.topicLabel||topic)}</option>`).join('')}</select></label></section>
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
  return `<section class="section page-heading"><p class="eyebrow">Đã ôn ${session.index} / ${session.cardIds.length}</p><h1 class="headline">Flashcard SRS</h1><div class="bar large"><span style="width:${progress}%"></span></div>${renderRomanizationToggle()}</section>
    <div class="flashcard ${state.flashcardFlipped ? 'flipped' : ''}" id="flipCard" role="button" tabindex="0" aria-label="Lật flashcard"><div class="flashcard-face front"><span class="card-kicker">Tiếng Hàn</span><strong lang="ko">${escapeHtml(card.korean)}</strong>${showRomanizationEnabled() ? `<i class="flash-romanization">${escapeHtml(getRomanization(card))}</i>` : ''}<button type="button" class="flash-audio" data-speak="${escapeHtml(card.audioText)}" aria-label="Nghe phát âm tiếng Hàn">🔊</button><span class="flip-hint">Chạm để lật</span></div><div class="flashcard-face back"><span class="card-kicker">Tiếng Việt</span><strong>${escapeHtml(card.meaningVi)}</strong><div class="flash-example"><b lang="ko">${escapeHtml(card.exampleKo)}</b>${showRomanizationEnabled() ? `<i>${escapeHtml(card.exampleRomanization || getRomanization(card.exampleKo))}</i>` : ''}<span>${escapeHtml(card.exampleVi)}</span></div></div></div>
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
  const variant = session.index % 5;
  const direction = [1, 3].includes(variant) ? 'vi_ko' : 'ko_vi';
  if (!session.currentQuestion || session.currentQuestion.wordId !== card.wordId) {
    const generated = VocabularyService.optionsFor(card, direction);
    session.currentQuestion = { wordId: card.wordId, direction, ...generated };
  }
  const question = session.currentQuestion;
  const result = session.currentResult;
  const prompt = variant === 1 ? `Từ nào có nghĩa là “${card.meaningVi}”?` : variant === 2 ? 'Nghe và chọn nghĩa đúng.' : variant === 3 ? `Điền từ: 오늘의 단어는 “___”입니다. (${card.meaningVi})` : variant === 4 ? `Chọn nghĩa gần nhất của “${card.korean}”.` : `“${card.korean}” có nghĩa là gì?`;
  return `<section class="section page-heading"><p class="eyebrow">Kiểm tra trước · ${session.index + 1}/${session.cardIds.length}</p><h1 class="headline">Bạn còn nhớ từ này?</h1><div class="bar"><span style="width:${Math.round((session.index / session.cardIds.length) * 100)}%"></span></div></section>
    <section class="card pretest-question"><h2>${escapeHtml(prompt)}</h2>${variant === 2 ? `<button class="audio-inline" data-speak="${escapeHtml(card.audioText)}">🔊 Nghe từ</button>` : ''}<div class="answer-list">${question.options.map((option, index) => `<button class="answer-button ${result ? option === question.correct ? 'correct' : result.response === option ? 'wrong' : '' : ''}" data-pretest-answer="${escapeHtml(option)}" ${result ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div></section>
    ${result ? `<section class="card pretest-decision ${result.correct ? 'passed' : 'failed'}"><h2>${result.correct ? '✅ Bạn đã nhớ từ này' : 'Bạn cần ôn lại từ này'}</h2>${renderKoreanLearningText(card, { compact: true })}${result.correct ? '<p>Chọn cách xử lý cho phiên ôn này.</p><div class="decision-grid"><button class="btn secondary" data-pretest-decision="keep">Vẫn nhắc lại</button><button class="btn primary" data-pretest-decision="skip">Bỏ qua lần này</button><button class="btn mastery-button" data-pretest-decision="mastered">Đánh dấu đã thuộc</button></div>' : `<p>Đáp án đúng: <b>${escapeHtml(question.correct)}</b>. Từ này sẽ tự động nằm trong phiên ôn.</p><button class="btn primary full" data-pretest-decision="required">Tiếp tục</button>`}</section>` : ''}`;
}

function pretestResultView() {
  const session = state.pretestSession;
  if (!session) return reviewView();
  const passed = session.results.filter((result) => result.correct);
  const failed = session.results.filter((result) => !result.correct);
  const uncertain = passed.filter((result) => result.decision === 'keep');
  const strong = passed.length - uncertain.length;
  return `<section class="result-page pretest-summary"><div class="celebration">🧠</div><p class="eyebrow">Kiểm tra hoàn tất</p><h1 class="headline">${session.results.length} từ</h1><div class="result-counts three"><span>Nhớ tốt <b>${strong}</b></span><span>Chưa chắc <b>${uncertain.length}</b></span><span>Sai <b>${failed.length}</b></span></div><section class="card"><h2>Lựa chọn phiên ôn</h2><button class="summary-choice recommended" data-pretest-summary="decisions"><span>Khuyến nghị</span><b>Chỉ ôn ${failed.length + uncertain.length} từ cần củng cố</b><small>Gồm từ sai và từ bạn chọn vẫn nhắc lại.</small></button><button class="summary-choice" data-pretest-summary="failed"><b>Chỉ ôn ${failed.length} từ sai</b><small>Các từ đã đạt được lùi lịch ôn hợp lý.</small></button><button class="summary-choice" data-pretest-summary="all"><b>Ôn toàn bộ ${session.results.length} từ</b><small>Củng cố toàn bộ danh sách.</small></button></section></section>`;
}

function vocabularyTestSetupView() {
  return `<section class="section page-heading"><button class="back-link" data-view="review" aria-label="Quay lại">←</button><p class="eyebrow">Đánh giá độc lập</p><h1 class="headline">Kiểm tra vốn từ</h1><p class="subtle">Chọn nguồn từ và số lượng. Từ sai có thể được thêm ngay vào phiên ôn.</p></section><form id="vocabularyTestForm" class="card choice-form"><fieldset><legend>Số từ</legend><div class="segmented-options">${[10,20,30,50,100].map((count) => `<label><input type="radio" name="count" value="${count}" ${count === 20 ? 'checked' : ''}><span>${count}</span></label>`).join('')}</div></fieldset><fieldset><legend>Nguồn từ</legend><div class="radio-list">${[['learned','Từ đã học'],['wrong','Từ hay sai'],['mastered','Từ mastered'],['review','Từ đang ôn'],...[1,2,3,4,5,6].map((level)=>[`topik-${level}`,`Từ TOPIK ${level}`])].map(([value,label]) => `<label><input type="radio" name="source" value="${value}" ${value === `topik-${state.currentUser.currentTopikLevel}` ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset><button class="btn primary full" type="submit">Bắt đầu kiểm tra</button></form>`;
}

function vocabularyTestView() {
  const session = state.vocabularyTest;
  if (!session || session.index >= session.cardIds.length) return vocabularyTestResultView();
  const card = state.srsData.find((item) => item.wordId === session.cardIds[session.index]);
  if (!session.currentQuestion || session.currentQuestion.wordId !== card.wordId) session.currentQuestion = { wordId: card.wordId, ...VocabularyService.optionsFor(card, session.index % 2 ? 'vi_ko' : 'ko_vi') };
  const question = session.currentQuestion;
  const viToKo = session.index % 2 === 1;
  const result = session.currentResult;
  return `<section class="section page-heading"><p class="eyebrow">Kiểm tra vốn từ · ${session.index + 1}/${session.cardIds.length}</p><div class="bar"><span style="width:${Math.round((session.index / session.cardIds.length) * 100)}%"></span></div></section><section class="card pretest-question"><h2>${viToKo ? `Từ nào có nghĩa là “${escapeHtml(card.meaningVi)}”?` : `“${escapeHtml(card.korean)}” có nghĩa là gì?`}</h2><div class="answer-list">${question.options.map((option,index) => `<button class="answer-button ${result ? option === question.correct ? 'correct' : result.response === option ? 'wrong' : '' : ''}" data-vocab-test-answer="${escapeHtml(option)}" ${result ? 'disabled' : ''}><span>${String.fromCharCode(65 + index)}</span>${escapeHtml(option)}</button>`).join('')}</div>${result ? `<div class="vocabulary-test-feedback ${result.correct ? 'success' : 'error'}"><strong>${result.correct ? '✓ Chính xác' : 'Chưa đúng'}</strong>${renderKoreanLearningText(card, { compact: true })}<button class="btn primary full" id="nextVocabularyTest">${session.index === session.cardIds.length - 1 ? 'Xem kết quả' : 'Từ tiếp theo'}</button></div>` : ''}</section>`;
}

function vocabularyTestResultView() {
  const session = state.vocabularyTest;
  if (!session?.results) return vocabularyTestSetupView();
  const correct = session.results.filter((result) => result.correct).length;
  const wrong = session.results.filter((result) => !result.correct);
  const percentage = Math.round((correct / Math.max(1, session.results.length)) * 100);
  return `<section class="result-page"><div class="result-score-ring" style="--score:${percentage * 3.6}deg"><div><strong>${correct}/${session.results.length}</strong><span>${percentage}%</span></div></div><p class="eyebrow">${ratingText(percentage)}</p><h1 class="headline">Kết quả vốn từ</h1>${renderRomanizationToggle()}<div class="result-counts"><span>Đúng <b>${correct}</b></span><span>Sai <b>${wrong.length}</b></span></div><section class="card result-analysis"><h2>Từ cần ôn lại</h2>${wrong.length ? `<div class="vocabulary-result-list">${wrong.map((result) => { const card = state.srsData.find((item) => item.wordId === result.wordId); return renderKoreanLearningText(card, { compact: true }); }).join('')}</div>` : '<p class="subtle">Bạn đã trả lời đúng tất cả.</p>'}</section>${wrong.length ? '<button class="btn primary full" id="addWrongToReview">Thêm từ sai vào phiên ôn</button>' : ''}<button class="btn secondary full" data-view="review">Về Ôn tập</button></section>`;
}

function lessonPreviewView() {
  const theoryLesson = (window.KLEARN_THEORY_LESSONS || []).find((item) => item.id === state.selectedLessonPreview);
  const lesson = theoryLesson?.title || state.selectedLessonPreview || 'Bài học tiếng Hàn';
  const skill = /Nghe|Listening/.test(lesson) ? 'listening' : /Đọc|Reading/.test(lesson) ? 'reading' : /Viết|Writing|Email|đoạn/.test(lesson) ? 'writing' : /Nói|Speaking|Phỏng vấn/.test(lesson) ? 'speaking' : 'grammar';
  const route = skill === 'writing' ? 'writing-hub' : skill === 'speaking' ? 'speaking-hub' : 'skill-hub';
  return `<section class="section page-heading"><button class="back-link" data-view="lessons" aria-label="Quay lại">←</button><p class="eyebrow">Bài học MVP</p><h1 class="headline">${escapeHtml(lesson)}</h1><p class="subtle">Mục tiêu: nhận biết cấu trúc, xem ví dụ và chuyển ngay sang bài luyện phù hợp.</p>${renderRomanizationToggle()}</section><section class="card section"><h2 class="section-title">Cách học gợi ý</h2><ol class="learning-steps"><li>Đọc hoặc nghe mẫu tiếng Hàn.</li><li>Đối chiếu nghĩa và cách dùng bằng tiếng Việt.</li><li>Làm bài luyện theo kỹ năng để kiểm tra.</li></ol><div class="example"><div>${renderKoreanLearningText({ korean: '한국어를 꾸준히 연습해요.', romanization: 'hangugeoreul kkujunhi yeonseuphaeyo.', meaningVi: 'Tôi luyện tiếng Hàn đều đặn.' }, { compact: true })}</div><button class="audio-btn" data-speak="한국어를 꾸준히 연습해요." aria-label="Nghe phát âm tiếng Hàn">🔊</button></div></section><button class="btn primary full" data-open-skill="${skill}" data-view="${route}">Bắt đầu luyện ${escapeHtml(lesson)}</button>`;
}

function listeningStudioQuestions() {
  const tier = state.listeningStudio.tier || 'beginner';
  const curated = {
    beginner: [{ id: 'sound-a-o', questionTypeLabel: 'Beginner · Âm', prompt: 'Nghe và chọn âm đúng.', koreanText: 'ㅏ', audioText: '아', correctAnswer: 'ㅏ', options: ['ㅏ', 'ㅗ', 'ㅓ'], explanationVi: 'ㅏ được đọc gần như “a”.' }, { id: 'sound-eu-u', questionTypeLabel: 'Beginner · Âm', prompt: 'Nghe và chọn âm đúng.', koreanText: 'ㅡ', audioText: '으', correctAnswer: 'ㅡ', options: ['ㅜ', 'ㅡ', 'ㅗ'], explanationVi: 'ㅡ là nguyên âm ngang, môi không tròn.' }],
    topik1: [{ id: 't1-sentence-school', questionTypeLabel: 'TOPIK 1 · Câu', prompt: 'Nghe câu và chọn nghĩa.', koreanText: '저는 학교에 가요.', audioText: '저는 학교에 가요.', correctAnswer: 'Tôi đi đến trường.', options: ['Tôi đi đến trường.', 'Tôi học ở nhà.', 'Tôi gặp giáo viên.'], explanationVi: '학교에 가요 nghĩa là đi đến trường.' }],
    topik2: [{ id: 't2-dialogue-cafe', questionTypeLabel: 'TOPIK 2 · Hội thoại', prompt: 'Hai người đang nói về điều gì?', koreanText: '가: 주말에 뭐 했어요? 나: 친구하고 카페에 갔어요.', audioText: '주말에 뭐 했어요? 친구하고 카페에 갔어요.', correctAnswer: 'Hoạt động cuối tuần.', options: ['Hoạt động cuối tuần.', 'Bài kiểm tra.', 'Thời tiết hôm nay.'], explanationVi: '주말 và 했어요 cho biết họ đang nói về cuối tuần.' }],
    advanced: [{ id: 'advanced-dictation', questionTypeLabel: 'Advanced · Dictation', prompt: 'Nghe và chép lại câu.', koreanText: '환경을 보호하기 위해 대중교통을 이용합니다.', audioText: '환경을 보호하기 위해 대중교통을 이용합니다.', correctAnswer: 'Bảo vệ môi trường.', options: ['Bảo vệ môi trường.', 'Tìm việc làm.', 'Học ngoại ngữ.'], explanationVi: 'Tập trung nghe cụm -기 위해 và 대중교통.' }]
  };
  if (curated[tier]?.length) return curated[tier];
  const sets = (PracticeService.bank?.sets || []).filter((set) => set.skill === 'listening');
  const questions = sets.flatMap((set) => PracticeService.bank.getQuestions(set.id)).filter((question) => question.audioText || question.koreanText);
  return questions.length ? questions.slice(0, 8) : [{ id: 'listen-fallback', skill: 'listening', questionType: 'listen_meaning', prompt: 'Nghe câu mẫu và chọn ý nghĩa phù hợp.', koreanText: '한국어를 매일 연습해요.', audioText: '한국어를 매일 연습해요.', correctAnswer: 'Tôi luyện tiếng Hàn mỗi ngày.', options: ['Tôi luyện tiếng Hàn mỗi ngày.', 'Tôi nghỉ học hôm nay.', 'Tôi đang ăn tối.'], explanationVi: '매일 nghĩa là mỗi ngày.' }];
}

function listeningCurrentQuestion() { const questions = listeningStudioQuestions(); return questions[Math.min(state.listeningStudio.index || 0, questions.length - 1)]; }
function saveListeningSession() { if (!state.currentUser) return; const session = { id: `studio-${state.currentUser.id}`, ...state.listeningStudio, updatedAt: new Date().toISOString() }; const all = storage.get(STORAGE_KEYS.listeningSessions, {}); storage.set(STORAGE_KEYS.listeningSessions, { ...(all && typeof all === 'object' ? all : {}), [state.currentUser.id]: session }); CloudSyncService.schedule('listening'); }
function listeningTextComparison(expected, actual) {
  const target = String(expected || '').trim(); const value = String(actual || '').trim(); const out = []; const max = Math.max(target.length, value.length);
  for (let i = 0; i < max; i += 1) { const expectedChar = target[i] || ''; const actualChar = value[i] || ''; if (expectedChar && actualChar && normalizeKorean(expectedChar) === normalizeKorean(actualChar)) out.push(`<span class="diff-correct">${escapeHtml(actualChar)}</span>`); else if (actualChar) out.push(`<span class="diff-wrong">${escapeHtml(actualChar)}</span>`); else if (expectedChar) out.push(`<span class="diff-missing">∅</span>`); }
  return out.join('');
}
function listeningStudioView() {
  const session = state.listeningStudio; const question = listeningCurrentQuestion(); const korean = question.koreanText || question.audioText || ''; const speed = Number(session.speed || 1); const duration = Math.max(8, Math.round(korean.length * 0.42));
  const modes = [['listen', 'Listen', 'Nghe bình thường'], ['dictation', 'Dictation', 'Nghe và nhập Hangul'], ['shadowing', 'Shadowing', 'Nghe rồi nói lại'], ['quiz', 'Quiz', 'Nghe và trả lời']];
  const dictationResult = session.dictationResult; const quizResult = session.quizAnswer; const transcript = session.transcriptVisible || session.romanizationVisible || session.translationVisible;
  return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">🎧 Listening Studio</p><h1 class="headline">Phòng luyện Nghe</h1><p class="subtle">Tập trung vào âm thanh, transcript và phản xạ. Âm mẫu dùng trình đọc tiếng Hàn của trình duyệt.</p></section><section class="listening-room section"><nav class="listening-mode-tabs" aria-label="Chế độ nghe">${modes.map(([id,label,description]) => `<button class="${session.mode === id ? 'active' : ''}" data-listening-mode="${id}"><b>${label}</b><small>${description}</small></button>`).join('')}</nav><section class="listening-player"><div class="player-kicker">${escapeHtml(question.questionTypeLabel || 'Listening practice')} · ${session.index + 1}/${listeningStudioQuestions().length}</div><h2 lang="ko">${session.transcriptVisible ? escapeHtml(korean) : '••• ••• •••'}</h2><div class="player-controls"><button class="player-control" data-listening-seek="-5" aria-label="Lùi 5 giây">−5s</button><button class="player-play" data-listening-play aria-label="${session.playing ? 'Tạm dừng' : 'Phát'}">${session.playing ? 'Ⅱ' : '▶'}</button><button class="player-control" data-listening-seek="5" aria-label="Tiến 5 giây">+5s</button></div><input id="listeningTimeline" type="range" min="0" max="${duration}" value="${Math.min(duration, session.position || 0)}" aria-label="Tiến trình audio"><div class="player-time"><span>${Math.floor((session.position || 0) / 60)}:${String(Math.floor((session.position || 0) % 60)).padStart(2, '0')}</span><span>${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, '0')}</span></div><div class="speed-row" aria-label="Tốc độ phát">${[0.5,0.75,1,1.25,1.5].map((value) => `<button class="${speed === value ? 'selected' : ''}" data-listening-speed="${value}">${value}x</button>`).join('')}</div><div class="ab-loop"><button class="btn secondary" data-listening-loop="a">A: ${session.loopA === null ? '—' : `${session.loopA}s`}</button><button class="btn secondary" data-listening-loop="b">B: ${session.loopB === null ? '—' : `${session.loopB}s`}</button><button class="text-link" data-listening-loop="clear">Xóa A-B</button></div></section><section class="transcript-panel"><div class="transcript-controls"><label><input type="checkbox" data-listening-toggle="transcript" ${session.transcriptVisible ? 'checked' : ''}> Hangul</label><label><input type="checkbox" data-listening-toggle="romanization" ${session.romanizationVisible ? 'checked' : ''}> Romanization</label><label><input type="checkbox" data-listening-toggle="translation" ${session.translationVisible ? 'checked' : ''}> Translation</label></div>${transcript ? `<div class="transcript-content">${session.transcriptVisible ? `<b lang="ko">${escapeHtml(korean)}</b>` : ''}${session.romanizationVisible ? `<span>${escapeHtml(getRomanization({ korean }))}</span>` : ''}${session.translationVisible ? `<small>${escapeHtml(I18nService.localizedText(question, 'meaning') || question.explanationVi || '')}</small>` : ''}</div>` : '<p class="exam-lock-note">Transcript đang ẩn.</p>'}</section>${session.mode === 'dictation' ? `<section class="listening-task"><h2>Dictation</h2><p>Nghe câu rồi nhập lại bằng Hangul.</p><textarea id="dictationInput" rows="3" placeholder="Nhập câu bạn nghe được...">${escapeHtml(session.dictation || '')}</textarea><button class="btn primary" data-listening-dictation>Kiểm tra bản chép</button>${dictationResult ? `<div class="dictation-result ${dictationResult.score >= 80 ? 'success' : 'error'}"><b>Text comparison: ${dictationResult.score}%</b><p class="diff-line">${listeningTextComparison(korean, dictationResult.answer)}</p><small>Đúng: xanh · Thiếu: ∅ · Sai: đỏ</small><button class="text-link" data-listening-save-error>Lưu lỗi vào Sổ lỗi</button></div>` : ''}</section>` : session.mode === 'quiz' ? `<section class="listening-task"><h2>Quiz</h2><p>${escapeHtml(question.prompt || 'Nghe và chọn đáp án.')}</p><div class="answer-list">${(question.options || []).map((option) => `<button class="answer-button ${quizResult ? option === question.correctAnswer ? 'correct' : option === quizResult.answer ? 'wrong' : '' : ''}" data-listening-quiz="${escapeHtml(option)}" ${quizResult ? 'disabled' : ''}>${escapeHtml(option)}</button>`).join('')}</div>${quizResult ? `<div class="answer-feedback ${quizResult.correct ? 'success' : 'error'}">${quizResult.correct ? '✓ Chính xác' : `Đáp án: ${escapeHtml(question.correctAnswer)}`}<p>${escapeHtml(question.explanationVi || '')}</p></div>` : ''}</section>` : session.mode === 'shadowing' ? `<section class="listening-task"><h2>Shadowing</h2><p>Nghe câu mẫu, sau đó mở Phòng luyện Nói để ghi âm và so sánh văn bản.</p><button class="btn primary" data-view="speaking-room">Mở Phòng luyện Nói</button></section>` : `<section class="listening-task"><h2>Listen</h2><p>Nghe lại nhiều lần, điều chỉnh tốc độ và đánh dấu đoạn A-B để lặp.</p><button class="btn secondary" data-listening-next>${session.index >= listeningStudioQuestions().length - 1 ? 'Bắt đầu lại' : 'Câu tiếp theo'}</button></section>`}</section>`;
}

function playListeningAudio() {
  const question = listeningCurrentQuestion(); const korean = question.koreanText || question.audioText || ''; const session = state.listeningStudio; const duration = Math.max(8, Math.round(korean.length * 0.42)); const hasLoop = session.loopA !== null && session.loopB !== null && session.loopB > session.loopA; const start = hasLoop ? Math.floor(korean.length * session.loopA / duration) : 0; const end = hasLoop ? Math.max(start + 1, Math.ceil(korean.length * session.loopB / duration)) : korean.length; const spoken = korean.slice(start, end);
  session.playing = true; saveListeningSession(); speakKorean(spoken, 0.85 * Number(session.speed || 1)); clearTimeout(session.playTimer); session.playTimer = setTimeout(() => { if (hasLoop) session.position = session.loopA; else session.position = Math.min(duration, session.position + Math.max(1, Math.round(korean.length * 0.42))); session.playing = false; saveListeningSession(); if (hasLoop) playListeningAudio(); else render(); }, Math.max(1200, spoken.length * 90 / Number(session.speed || 1)));
}

function writingRoomView() {
  const prompt = state.writingPrompt || window.KLEARN_MODULE_DATA?.writingPrompts?.find((item) => item.type === state.writingRoom.mode) || window.KLEARN_MODULE_DATA?.writingPrompts?.[0];
  if (!prompt) return writingHubView();
  const room = state.writingRoom; const remaining = room.deadlineAt ? Math.max(0, Math.ceil((new Date(room.deadlineAt).getTime() - Date.now()) / 1000)) : 0;
  return `<section class="section page-heading exam-room-heading"><button class="back-link" data-view="writing-hub">← Viết</button><p class="eyebrow">Writing Exam Room · TOPIK ${prompt.level}</p><h1 class="headline">${escapeHtml(prompt.topic)}</h1><div class="exam-timer" id="writingTimer" data-deadline="${escapeHtml(room.deadlineAt || '')}">⏱ ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}</div></section><section class="writing-room-layout"><section class="writing-brief"><span class="card-kicker">${escapeHtml(prompt.type.toUpperCase())}</span><h2>${escapeHtml(prompt.prompt)}</h2><p><b>Yêu cầu:</b> ${prompt.requirements.map(escapeHtml).join(' · ')}</p>${renderWritingKeywords(prompt.keywords)}</section><form id="writingRoomForm" class="writing-editor writing-exam-editor"><textarea id="writingRoomText" name="answer" rows="16" maxlength="1200" placeholder="Viết câu trả lời bằng tiếng Hàn..." required>${escapeHtml(room.draft || '')}</textarea><div class="writing-counter"><span id="writingRoomCharacterCount">${(room.draft || '').length} ký tự</span><span id="writingRoomWordCount">${(room.draft || '').trim() ? (room.draft || '').trim().split(/\s+/).length : 0} từ</span></div><div class="action-row"><button class="btn secondary" type="button" data-writing-reset>Đặt lại</button><button class="btn primary" type="submit">Nộp bài</button></div><p class="security-note">Bản nháp lưu local-first. Kết quả là “Đánh giá luyện tập”, không phải điểm TOPIK chính thức.</p></form></section>`;
}

function saveWritingRoomDraft() {
  if (!state.currentUser) return;
  const all = storage.get(STORAGE_KEYS.writingAttempts, {}); const safe = all && typeof all === 'object' ? all : {};
  safe[state.currentUser.id] = { ...(safe[state.currentUser.id] || {}), [`draft-${state.writingPrompt?.id || 'current'}`]: { promptId: state.writingPrompt?.id, draft: state.writingRoom.draft || '', updatedAt: new Date().toISOString() }, updatedAt: new Date().toISOString() };
  storage.set(STORAGE_KEYS.writingAttempts, safe); CloudSyncService.schedule('writing-draft');
}
function startWritingRoom(promptId) { startWriting(promptId); const all = storage.get(STORAGE_KEYS.writingAttempts, {}); const saved = all?.[state.currentUser?.id]?.[`draft-${promptId}`]; state.writingRoom = { ...state.writingRoom, draft: saved?.draft || '', mode: state.writingPrompt?.type || 'sentence', startedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + ((state.writingPrompt?.level || 1) >= 5 ? 40 : 20) * 60 * 1000).toISOString() }; setView('writing-room'); }
function resetWritingRoom() { if (!window.confirm('Đặt lại bài viết và xóa bản nháp hiện tại?')) return; state.writingRoom.draft = ''; saveWritingRoomDraft(); render(); }

function speakingRoomView() {
  const attempts = getUserProgress().pronunciationAttempts || []; const modes = [['repeat', 'Repeat', 'Nói lại câu mẫu', 'sentence'], ['situation', 'Situation', 'Tình huống đời sống', 'roleplay'], ['roleplay', 'Role Play', 'Đối thoại theo vai', 'roleplay'], ['free', 'Free Speaking', 'Nói tự do theo chủ đề', 'question'], ['shadowing', 'Shadowing', 'Nghe rồi nói theo nhịp', 'shadowing']];
  return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Speaking Practice Room</p><h1 class="headline">Phòng luyện Nói</h1><p class="subtle">${attempts.length} lượt đã lưu · Độ khớp câu dựa trên SpeechRecognition và text similarity, không phải điểm âm vị.</p></section><section class="speaking-room-grid">${modes.map(([id, title, description]) => `<button class="speaking-room-mode" data-speaking-room-mode="${id}"><span>${id === 'repeat' ? '🔁' : id === 'situation' ? '💬' : id === 'roleplay' ? '🎭' : id === 'free' ? '⚡' : '🎧'}</span><b>${title}</b><small>${description}</small></button>`).join('')}</section><section class="support-message section"><b>Phòng nói tiếng Hàn độc lập</b><span>Speaking Practice không phải là phần thi chuẩn hóa của TOPIK.</span></section>`;
}
function startSpeakingRoom(mode) { state.speakingRoomMode = mode; const map = { repeat: 'sentence', shadowing: 'shadowing', free: 'question', situation: 'roleplay', roleplay: 'roleplay' }; if (mode === 'situation') state.speakingPrompt = (window.KLEARN_MODULE_DATA?.roleplays || [])[0]; startSpeaking(map[mode] || 'sentence'); }

function topikExamQuestions(level, count = 50) {
  const sets = (PracticeService.bank?.sets || []).filter((set) => set.level === `TOPIK_${level}` || (level >= 3 && set.level === 'TOPIK_3' && set.skill === 'reading'));
  const pool = sets.flatMap((set) => PracticeService.bank.getQuestions(set.id));
  return (pool.length ? pool : listeningStudioQuestions()).slice(0, count);
}
function startTopikExam(level = state.currentUser?.targetTopikLevel || state.currentUser?.currentTopikLevel || 1, count = 50) {
  const questions = topikExamQuestions(Number(level), count); if (!questions.length) return toast('Chưa có dữ liệu đề thi phù hợp.');
  state.examSession = { id: uniqueId(), level: Number(level), questions, answers: {}, index: 0, startedAt: new Date().toISOString(), deadlineAt: new Date(Date.now() + (Number(level) >= 3 ? 70 : 40) * 60 * 1000).toISOString() };
  const all = storage.get(STORAGE_KEYS.examAttempts, {}); storage.set(STORAGE_KEYS.examAttempts, { ...(all && typeof all === 'object' ? all : {}), [state.currentUser.id]: { ...(all?.[state.currentUser.id] || {}), active: state.examSession, updatedAt: new Date().toISOString() } }); CloudSyncService.schedule('exam-start'); setView('topik-exam');
}
function saveExamSession() { if (!state.currentUser || !state.examSession) return; const all = storage.get(STORAGE_KEYS.examAttempts, {}); storage.set(STORAGE_KEYS.examAttempts, { ...(all && typeof all === 'object' ? all : {}), [state.currentUser.id]: { ...(all?.[state.currentUser.id] || {}), active: state.examSession, updatedAt: new Date().toISOString() } }); CloudSyncService.schedule('exam-progress'); }
function topikExamView() {
  const exam = state.examSession; if (!exam?.questions?.length) return `<section class="empty-state"><h1 class="headline">Chưa có phiên thi</h1><button class="btn primary" data-start-topik-exam>Thi thử TOPIK</button></section>`;
  const question = exam.questions[exam.index]; const selected = exam.answers[question.id]; const answered = Object.keys(exam.answers).length; const remaining = Math.max(0, Math.ceil((new Date(exam.deadlineAt).getTime() - Date.now()) / 1000));
  return `<section class="exam-room-heading section"><div><p class="eyebrow">TOPIK Exam Practice · TOPIK ${exam.level}</p><h1 class="headline">Thi thử TOPIK</h1></div><div class="exam-timer" id="examTimer" data-deadline="${escapeHtml(exam.deadlineAt)}">⏱ ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}</div></section><section class="exam-navigation"><span>${answered}/${exam.questions.length} câu đã trả lời</span><button class="btn secondary" data-exam-submit>Nộp bài</button></section><section class="exam-question-card"><div class="question-number">Câu ${exam.index + 1} / ${exam.questions.length}</div><h2>${escapeHtml(question.prompt || 'Chọn đáp án đúng.')}</h2>${question.audioText ? `<button class="audio-inline" data-speak="${escapeHtml(question.audioText)}">🔊 Nghe</button>` : ''}<div class="answer-list">${(question.options || []).map((option, idx) => `<button class="answer-button ${selected === option ? 'selected' : ''}" data-exam-answer="${escapeHtml(option)}"><span>${String.fromCharCode(65 + idx)}</span>${escapeHtml(option)}</button>`).join('')}</div></section><nav class="exam-question-nav" aria-label="Điều hướng câu hỏi">${exam.questions.map((item, idx) => `<button class="${idx === exam.index ? 'current' : ''} ${exam.answers[item.id] ? 'answered' : ''}" data-exam-index="${idx}">${idx + 1}</button>`).join('')}</nav><p class="exam-lock-note">Exam mode: không hiển thị transcript, translation, romanization, hint, explanation hoặc dictionary.</p>`;
}
function finishTopikExam() {
  const exam = state.examSession; if (!exam) return;
  const answers = exam.questions.map((question) => ({ questionId: question.id, selectedAnswer: exam.answers[question.id] || '', correct: Boolean(exam.answers[question.id]) && exam.answers[question.id] === question.correctAnswer })); const correct = answers.filter((item) => item.correct).length; const total = exam.questions.length;
  const grouped = {}; answers.forEach((answer) => { const q = exam.questions.find((item) => item.id === answer.questionId); const skill = q?.skill || 'mixed'; grouped[skill] = grouped[skill] || { correct: 0, total: 0 }; grouped[skill].total += 1; if (answer.correct) grouped[skill].correct += 1; });
  const result = { id: exam.id, userId: state.currentUser.id, setId: `t${exam.level}-${exam.id}`, setTitle: `TOPIK ${exam.level} Exam Practice`, level: `TOPIK_${exam.level}`, startedAt: exam.startedAt, completedAt: new Date().toISOString(), durationSeconds: Math.max(1, Math.round((Date.now() - new Date(exam.startedAt).getTime()) / 1000)), score: correct, total, percentage: Math.round(correct / total * 100), correct, wrong: total - correct, skipped: answers.filter((item) => !item.selectedAnswer).length, answers, wrongQuestionIds: answers.filter((item) => !item.correct).map((item) => item.questionId), skillBreakdown: Object.fromEntries(Object.entries(grouped).map(([key, value]) => [key, Math.round(value.correct / value.total * 100)])), topicBreakdown: {}, examMode: true, contentVersion: 1 };
  const all = storage.get(STORAGE_KEYS.examAttempts, {}); const history = Array.isArray(all?.[state.currentUser.id]?.history) ? all[state.currentUser.id].history : []; storage.set(STORAGE_KEYS.examAttempts, { ...(all && typeof all === 'object' ? all : {}), [state.currentUser.id]: { history: [result, ...history.filter((item) => item.id !== result.id)].slice(0, 50), active: null, updatedAt: new Date().toISOString() } });
  const practiceAll = storage.get(STORAGE_KEYS.practiceHistory, {}); const practiceSafe = practiceAll && typeof practiceAll === 'object' ? practiceAll : {}; practiceSafe[state.currentUser.id] = [result, ...(Array.isArray(practiceSafe[state.currentUser.id]) ? practiceSafe[state.currentUser.id].filter((item) => item.id !== result.id) : [])].slice(0, 200); storage.set(STORAGE_KEYS.practiceHistory, practiceSafe);
  window.ErrorNotebookService?.capturePractice?.(result, exam.questions); const progress = getUserProgress(); progress.daily.tasks.practice = true; progress.daily.tasks.listening = progress.daily.tasks.listening || exam.questions.some((item) => item.skill === 'listening'); progress.skills = { ...progress.skills, ...Object.fromEntries(Object.entries(grouped).map(([skill, value]) => [skill, Math.max(progress.skills[skill] || 0, Math.round(value.correct / value.total * 100))])) }; saveUserProgress(progress); state.examResult = { result, questions: exam.questions }; state.examSession = null; setView('topik-exam-result');
}
function topikExamResultView() { const data = state.examResult; if (!data?.result) return practiceHubView(); const result = data.result; return `<section class="result-page exam-result-page"><p class="eyebrow">TOPIK Exam Practice · TOPIK ${result.level.replace('TOPIK_', '')}</p><h1 class="headline">Kết quả thi thử</h1><div class="result-score-ring" style="--score:${result.percentage * 3.6}deg"><div><strong>${result.score}/${result.total}</strong><span>${result.percentage}%</span></div></div><div class="result-counts"><span>Đúng <b>${result.correct}</b></span><span>Sai <b>${result.wrong}</b></span><span>Bỏ qua <b>${result.skipped}</b></span><span>Thời gian <b>${Math.ceil(result.durationSeconds / 60)}′</b></span></div><section class="card result-analysis"><h2>Phân tích kỹ năng</h2>${Object.entries(result.skillBreakdown).map(([skill, score]) => `<div class="analysis-row"><span>${escapeHtml(skill)}</span><div class="bar"><span style="width:${score}%"></span></div><b>${score}%</b></div>`).join('')}</section><p class="support-message">Kết quả này đã được đưa vào TOPIK Analytics, Learner Profile, Adaptive Engine và Sổ lỗi. Đây là kết quả luyện tập, không phải điểm thi chính thức.</p><div class="result-actions"><button class="btn secondary" data-view="analytics">TOPIK Analytics</button><button class="btn secondary" data-view="error-notebook">Xem Sổ lỗi</button><button class="btn primary" data-view="topik">Về TOPIK</button></div></section>`; }

function speakingHubView() {
  const modes = window.KLEARN_MODULE_DATA?.speakingModes || [];
  const attempts = getUserProgress().pronunciationAttempts;
  const average = attempts.length ? Math.round(attempts.reduce((sum,item)=>sum+item.score,0)/attempts.length) : 0;
  return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">Speech-to-text scoring MVP</p><h1 class="headline">🎙 Luyện nói</h1><p class="subtle">${attempts.length} lượt · Trung bình ${average}/100. Kết quả dựa trên văn bản nhận diện, không phải chấm âm vị AI.</p>${renderRomanizationToggle()}</section><section class="speaking-mode-grid">${modes.map((mode,index) => `<button data-speaking-mode="${mode.id}"><span>${['🔤','💬','🎧','📖','👥','❓','🎭','⚡','🏆','1–6'][index]}</span><b>${mode.label}</b><small>${mode.vietnamese}</small></button>`).join('')}</section><section class="card section"><h2 class="section-title">Tình huống roleplay</h2><div class="topic-chips">${(window.KLEARN_MODULE_DATA?.roleplays || []).map((role) => `<button data-roleplay="${role.id}">${role.title}</button>`).join('')}</div></section>`;
}

function speakingSessionView() {
  const prompt = state.speakingPrompt || window.KLEARN_MODULE_DATA?.speakingModes?.find((mode) => mode.id === state.speakingMode);
  if (!prompt) return speakingHubView();
  const result = state.speakingResult;
  const isRoleplay = state.speakingMode === 'roleplay';
  const korean = prompt.appLine || prompt.korean;
  const hint = isRoleplay && state.roleplayHintVisible ? `<div class="roleplay-hint"><span class="card-kicker">Gợi ý trả lời</span>${renderKoreanLearningText({ korean: prompt.suggestedAnswer, romanization: prompt.suggestedRomanization, meaningVi: prompt.suggestedMeaningVi }, { compact: true })}<p>Từ khóa: ${(prompt.keywords || []).map(escapeHtml).join(' · ')}</p></div>` : '';
  return `<section class="section page-heading"><button class="back-link" data-view="speaking-hub" aria-label="Quay lại">←</button><p class="eyebrow">${isRoleplay ? `Roleplay · ${escapeHtml(prompt.title || '')}` : 'Speech-to-text scoring MVP'}</p><h1 class="headline">${isRoleplay ? 'Trả lời tình huống' : escapeHtml(prompt.label || 'Luyện nói')}</h1>${renderRomanizationToggle(true)}</section><section class="card speaking-stage section"><span class="card-kicker">${isRoleplay ? 'Nhân vật A' : 'Câu mẫu'}</span>${renderKoreanLearningText({ ...prompt, korean, meaningVi: prompt.meaningVi || prompt.vietnamese })}<div class="speaking-audio-row"><button class="audio-inline" data-speak="${escapeHtml(korean)}" aria-label="Nghe phát âm tiếng Hàn ở tốc độ bình thường">🔊 Bình thường</button><button class="audio-inline" data-speak-rate="0.75" data-speak-text="${escapeHtml(korean)}" aria-label="Nghe phát âm tiếng Hàn chậm">🐢 Chậm 0.75x</button></div>${isRoleplay ? `<button class="hint-toggle" id="roleplayHintToggle">${state.roleplayHintVisible ? 'Ẩn gợi ý' : 'Gợi ý'}</button>${hint}` : ''}${prompt.pronunciationTipVi ? `<details class="pronunciation-tip"><summary>💡 Mẹo phát âm</summary><p>${escapeHtml(prompt.pronunciationTipVi)}</p></details>` : ''}</section>${result ? `<section class="card section pronunciation-result"><p class="eyebrow">Kết quả gần nhất</p><h2>Câu chuẩn</h2>${renderKoreanLearningText({ ...prompt, korean }, { compact: true })}<h2>Transcript nhận được</h2><div class="recognized-text">“${escapeHtml(result.transcript)}”</div><div class="score-display"><span>${isRoleplay ? 'Độ khớp câu trả lời' : 'Độ khớp câu'}</span><strong>${result.score}/100</strong></div><div class="feedback-grid"><p><b>Grammar feedback</b><br>${result.score >= 70 ? 'Cấu trúc chính đã ổn; tiếp tục chú ý đuôi câu lịch sự.' : 'Hãy bám mẫu câu và kiểm tra đuôi câu trước khi nói lại.'}</p><p><b>Vocabulary feedback</b><br>${isRoleplay ? `Từ khóa phù hợp: ${(prompt.keywords || []).join(' · ') || 'theo ngữ cảnh'}.` : 'Ưu tiên nói trọn cụm từ thay vì từng từ rời.'}</p><p><b>Suggested expression</b><br>${escapeHtml(prompt.suggestedAnswer || korean)}</p></div><p class="subtle">${result.feedback}</p><div class="speaking-audio-row"><button class="audio-inline" data-speak="${escapeHtml(korean)}" aria-label="Nghe lại phát âm tiếng Hàn">🔊 Nghe lại câu chuẩn</button><button class="audio-inline" data-repeat-speaking>🎙 Thử lại</button></div></section>` : ''}<form id="speakingFallbackForm" class="card speaking-input"><label>${isRoleplay ? 'Nhập câu trả lời hoặc dùng micro' : 'Nhập văn bản nhận diện để thử khi không có micro'}<input name="transcript" autocomplete="off" placeholder="Nhập câu tiếng Hàn..."></label><button class="btn secondary" type="submit">Đánh giá văn bản</button></form><div class="mic-wrap"><button id="micBtn" class="mic-btn ${state.recording ? 'recording' : ''}" aria-label="${state.recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}">${state.recording ? '■' : '🎙'}</button><div class="subtle">${state.recording ? 'Đang nghe...' : 'Ghi âm bằng ko-KR Speech Recognition'}</div></div><button class="btn primary full" id="speakingComplete">${result ? 'Hoàn thành' : 'Bỏ qua phiên này'}</button>`;
}

function speakingResultView() {
  const result = state.speakingResult;
  const stats = getUserProgress().pronunciationAttempts;
  const average = stats.length ? Math.round(stats.reduce((sum,item)=>sum+item.score,0)/stats.length) : 0;
  const prompt = state.speakingPrompt || {};
  return `<section class="result-page"><div class="celebration">🎙</div><p class="eyebrow">Speech-to-text scoring MVP</p><h1 class="headline">Phiên nói đã lưu</h1>${renderKoreanLearningText({ ...prompt, korean: prompt.korean || prompt.appLine }, { compact: true })}<div class="result-counts"><span>Điểm vừa rồi <b>${result?.score ?? '—'}</b></span><span>Trung bình <b>${average}</b></span></div><p class="subtle">Bạn nói: ${escapeHtml(result?.transcript || 'Không có bản ghi')}</p><p class="security-note">Gợi ý tự động từ text similarity; không phải chấm âm vị.</p><div class="action-row"><button class="btn secondary" data-view="speaking-hub">Mode khác</button><button class="btn secondary" data-open-support data-support-type="speaking" data-support-source="${escapeHtml(result?.id || '')}">Gửi giáo viên hỗ trợ</button><button class="btn primary" data-repeat-speaking>Thử lại</button></div></section>`;
}

function renderWritingKeywords(keywords = []) {
  return `<div class="writing-keyword-list">${keywords.map((keyword) => `<span><b lang="ko">${escapeHtml(keyword)}</b>${showRomanizationEnabled() ? `<i>${escapeHtml(getRomanization(keyword))}</i>` : ''}</span>`).join('')}</div>`;
}

function writingHubView() {
  const modes = window.KLEARN_MODULE_DATA?.writingModes || [];
  const submissions = getUserProgress().writingSubmissions;
  return `<section class="section page-heading"><button class="back-link" data-view="practice-hub" aria-label="Quay lại">←</button><p class="eyebrow">Đánh giá sơ bộ theo cấu trúc bài</p><h1 class="headline">✍️ Luyện viết</h1><p class="subtle">${submissions.length} bài đã viết. Chọn cấp TOPIK và dạng bài.</p></section><section class="catalog-levels section">${[1,2,3,4,5,6].map((level)=>`<button data-writing-level="${level}" class="${state.writingLevel===level?'selected':''}">TOPIK ${level}</button>`).join('')}</section><section class="writing-mode-grid">${modes.map((mode)=>`<button data-writing-mode="${mode.id}" class="${state.writingMode===mode.id?'selected':''}">${mode.label}</button>`).join('')}</section><section class="card section"><h2 class="section-title">Đề phù hợp</h2><div class="writing-prompts">${(window.KLEARN_MODULE_DATA?.writingPrompts || []).filter((prompt)=>prompt.level===state.writingLevel).map((prompt)=>`<button data-writing-prompt="${prompt.id}"><span>${prompt.type.toUpperCase()}</span><b>${prompt.topic}</b><small>${prompt.prompt}</small></button>`).join('')}</div></section>`;
}

function writingEditorView() {
  const prompt = state.writingPrompt;
  if (!prompt) return writingHubView();
  return `<section class="section page-heading"><button class="back-link" data-view="writing-hub" aria-label="Quay lại">←</button><p class="eyebrow">TOPIK ${prompt.level} · ${escapeHtml(prompt.type)}</p><h1 class="headline">${escapeHtml(prompt.topic)}</h1>${renderRomanizationToggle(true)}</section><section class="card writing-brief section"><h2>${escapeHtml(prompt.prompt)}</h2><p><b>Yêu cầu:</b> ${prompt.requirements.map(escapeHtml).join(' · ')}</p><p><b>Từ gợi ý</b></p>${renderWritingKeywords(prompt.keywords)}</section><form id="writingForm" class="writing-editor"><textarea id="writingText" name="answer" rows="12" placeholder="Viết câu trả lời bằng tiếng Hàn..." required></textarea><div class="writing-counter"><span id="characterCount">0 ký tự</span><span id="wordCount">0 từ</span></div><button class="btn primary full" type="submit">Nộp bài</button><p class="security-note">Bài chỉ được đánh giá sơ bộ theo độ dài, từ khóa và biểu đạt bắt buộc.</p></form>`;
}

function writingResultView() {
  const result = state.writingSubmission;
  if (!result) return writingHubView();
  const criteria = result.criteria || { completion: 0, grammar: 0, vocabulary: 0, coherence: 0, naturalness: 0 };
  return `<section class="section page-heading"><button class="back-link" data-view="writing-hub" aria-label="Quay lại">←</button><p class="eyebrow">Đánh giá luyện tập</p><h1 class="headline">Bài viết đã lưu</h1></section><section class="card section"><div class="writing-score"><strong>${result.preliminaryScore}/100</strong><span>Phản hồi tự động · không phải điểm TOPIK chính thức</span></div><h2>Bài của bạn</h2><p class="submitted-writing">${escapeHtml(result.answer)}</p><div class="result-counts three"><span>Ký tự <b>${result.characterCount}</b></span><span>Từ <b>${result.wordCount}</b></span><span>Từ khóa <b>${result.keywordMatches}/${result.keywordTotal}</b></span></div></section><section class="card section writing-criteria"><h2 class="section-title">Phản hồi tự động theo tiêu chí</h2>${Object.entries(criteria).map(([key, value]) => `<div class="analysis-row"><span>${({ completion: 'Hoàn thành yêu cầu', grammar: 'Grammar', vocabulary: 'Vocabulary', coherence: 'Coherence', naturalness: 'Naturalness' })[key] || key}</span><div class="bar"><span style="width:${value}%"></span></div><b>${value}%</b></div>`).join('')}</section><section class="card section"><h2 class="section-title">Bài mẫu</h2><p class="submitted-writing sample">${escapeHtml(result.sampleAnswer)}</p><h3>Gợi ý tự động</h3><p class="subtle">${escapeHtml(result.tipsVi)}</p><button class="btn secondary" data-open-support data-support-type="writing" data-support-source="${escapeHtml(result.id || '')}">Gửi giáo viên hỗ trợ</button></section><div class="action-row"><button class="btn secondary" data-view="writing-hub">Đề khác</button><button class="btn secondary" data-writing-save-error>Lưu lỗi</button><button class="btn secondary" data-view="skill-hub" data-open-skill="grammar">Ôn ngữ pháp liên quan</button><button class="btn primary" data-rewrite>Viết lại</button></div>`;
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
  return `<section class="card practice-card section"><span class="eyebrow">Luyện đọc câu sau</span>${renderKoreanLearningText({ korean: '안녕하세요', romanization: 'annyeonghaseyo', meaningVi: 'Xin chào' })}<button class="audio-btn" data-speak="안녕하세요" aria-label="Nghe phát âm tiếng Hàn">🔊</button></section>
    <section class="card section pronunciation-result"><div class="subtle center">Kết quả Speech-to-Text</div>${result ? `<div class="recognized-text">“${escapeHtml(result.transcript)}”</div><div class="score-display"><span>Điểm phát âm MVP</span><strong>${result.score} / 100</strong></div>` : '<div class="result-placeholder">Nói câu mẫu để bắt đầu chấm theo độ giống văn bản.</div>'}</section>
    <section class="card glass section"><div class="feedback"><div class="ai-dot">✦</div><div><b class="feedback-title">Tailored Feedback</b>${pronunciationFeedback(result)}<small>Điểm chỉ dựa trên nhận dạng giọng nói và độ giống văn bản, không phải chấm âm vị AI chính xác.</small></div></div></section>
    ${state.recordedAudioUrl ? `<section class="card section"><label class="audio-playback-label">Bản ghi gần nhất</label><audio class="audio-playback" controls src="${state.recordedAudioUrl}"></audio></section>` : ''}
    <div class="mic-wrap"><button id="micBtn" class="mic-btn ${state.recording ? 'recording' : ''}" aria-label="${state.recording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'}">${state.recording ? '■' : '🎙'}</button><div class="subtle" id="micLabel">${state.recording ? 'Đang nghe... nhấn để dừng' : 'Nhấn để ghi âm và nhận diện câu nói'}</div></div>
    ${!Recognition ? '<div class="support-message">Trình duyệt này chưa hỗ trợ Speech Recognition. Bạn vẫn có thể ghi và nghe lại bản ghi nếu MediaRecorder khả dụng.</div>' : ''}<div class="action-row"><button class="btn secondary" data-view="home">Bỏ qua</button><button class="btn primary" id="practiceNext">Hoàn tất</button></div>`;
}

function cloudAccountPanel() {
  const cloud = state.cloudUser; const linked = Boolean(cloud && state.currentUser?.cloudUserId === cloud.id); const status = CloudSyncService.getStatus(); const configured = window.SupabaseService?.status === 'ready';
  if (linked) return `<section class="card section cloud-account"><div class="section-heading"><div><p class="eyebrow">☁ Cloud Account</p><h2 class="section-title">Đã kết nối</h2></div><span class="sync-status ${status}">${status === 'syncing' ? '↻ Đang đồng bộ' : status === 'synced' ? '☁ Đã đồng bộ' : status === 'offline' ? '💾 Ngoại tuyến' : '⚠ Chưa đồng bộ'}</span></div><p class="subtle"><span>${escapeHtml(cloud.email)}</span> · <span>dữ liệu local vẫn là nguồn hoạt động chính.</span></p><div class="action-row"><button class="btn primary" id="syncNowButton">Đồng bộ ngay</button><button class="btn secondary" id="cloudSignOutButton">Ngắt cloud</button></div>${state.cloudAuthMessage ? `<p class="support-message">${escapeHtml(state.cloudAuthMessage)}</p>` : ''}</section>`;
  return `<section class="card section cloud-account"><p class="eyebrow">☁ Đồng bộ đa thiết bị</p><h2 class="section-title">${configured ? 'Kết nối tài khoản cloud' : 'Cloud chưa được cấu hình hoặc đang ngoại tuyến'}</h2><p class="subtle">Dữ liệu hiện chỉ được lưu trên thiết bị này. Hãy chủ động đăng nhập hoặc đăng ký Supabase để liên kết đúng tài khoản local hiện tại.</p><form id="cloudConnectForm" class="auth-form"><label>Email cloud<input name="email" type="email" value="${escapeHtml(state.currentUser?.email || '')}" required></label><label>Mật khẩu cloud<input name="password" type="password" minlength="6" required></label><div class="action-row"><button class="btn primary" type="submit" name="action" value="signin">Đăng nhập & liên kết</button><button class="btn secondary" type="submit" name="action" value="signup">Đăng ký & liên kết</button></div></form>${state.cloudAuthMessage ? `<p class="support-message">${escapeHtml(state.cloudAuthMessage)}</p>` : ''}</section>`;
}

function profileView() {
  const progress = getUserProgress();
  const goals = goalLabels(state.currentUser.goals);
  const skills = progress.skills;
  const showTopik = state.currentUser.goals.includes('topik') || state.currentUser.level.includes('TOPIK');
  const practiceStats = PracticeService.statistics();
  const vocabularyStats = VocabularyService.sessionStats();
  const speakingAttempts = progress.pronunciationAttempts;
  const speakingAverage = speakingAttempts.length ? Math.round(speakingAttempts.reduce((sum,item)=>sum+item.score,0)/speakingAttempts.length) : 0;
  return `<section class="card profile-head section"><div class="profile-avatar">${escapeHtml(state.currentUser.avatar || initials(state.currentUser.fullName))}</div><h1 class="headline profile-name">${escapeHtml(state.currentUser.fullName)}</h1><p class="subtle">${escapeHtml(state.currentUser.level)} · ${escapeHtml(goals.join(' · '))}</p><div class="topik-goal"><span>Hiện tại <b>${topikLabel(state.currentUser.currentTopikLevel)}</b></span><i>→</i><span>Mục tiêu <b>${topikLabel(state.currentUser.targetTopikLevel)}</b></span></div><div class="stats stats-four"><div class="stat"><b>${progress.stats.lessonsCompleted}</b><small>Bài đã học</small></div><div class="stat"><b>${progress.stats.learningDays}</b><small>Ngày học</small></div><div class="stat"><b>${progress.stats.streak}</b><small>Streak</small></div><div class="stat"><b>${progress.stats.wordsLearned}</b><small>Từ đã học</small></div></div><button class="btn secondary full" data-view="edit-profile">Chỉnh sửa hồ sơ</button></section>
    ${cloudAccountPanel()}<section class="card section romanization-setting"><div><h2 class="section-title">Hỗ trợ đọc Hangul</h2><p>Phiên âm giúp bạn hình dung cách đọc. Khi đã quen Hangul, hãy thử tắt để luyện đọc trực tiếp.</p></div>${renderRomanizationToggle()}</section>
    ${renderThemeControl()}
    <section class="card section"><h2 class="section-title">📝 Tiến độ luyện đề</h2><div class="practice-stats"><div><b>${practiceStats.completed}</b><span>Số đề đã làm</span></div><div><b>${practiceStats.average}%</b><span>Điểm trung bình</span></div><div><b>${practiceStats.bestTopik}/15</b><span>TOPIK tốt nhất</span></div></div>${practiceStats.weakTopics.length ? `<h3 class="weak-heading">Điểm yếu của bạn</h3><div class="weak-topic-list">${practiceStats.weakTopics.map(([topic, score]) => `<span>${escapeHtml(topic)} · ${score}%</span>`).join('')}</div>` : '<p class="subtle center">Làm thêm đề để hệ thống tìm chủ đề cần củng cố.</p>'}<button class="btn primary full" data-view="practice-hub">Tiếp tục luyện</button></section>
    <section class="card section"><h2 class="section-title">🧠 Trí nhớ từ vựng</h2><div class="practice-stats"><div><b>${vocabularyStats.learning}</b><span>Đang học</span></div><div><b>${vocabularyStats.mastered}</b><span>Mastered</span></div><div><b>${vocabularyStats.retention}%</b><span>Tỷ lệ nhớ</span></div></div></section>
    <section class="card section"><h2 class="section-title">TOPIK 1–6</h2><div class="topik-progress-list">${[1,2,3,4,5,6].map((level)=>{const item=practiceStats.byTopik[level]||{};const values=Object.values(item);const avg=values.length?Math.round(values.reduce((a,b)=>a+b,0)/values.length):0;return `<div class="topik-level-progress"><header><b>TOPIK ${level}</b><div class="bar"><span style="width:${avg}%"></span></div><small>${values.length?`${avg}%`:'—'}</small></header><div class="skill-mini">${[['vocabulary','Từ'],['grammar','Ngữ pháp'],['listening','Nghe'],['reading','Đọc']].map(([key,label])=>`<span>${label} <b>${item[key] === undefined ? '—' : `${item[key]}%`}</b></span>`).join('')}</div></div>`;}).join('')}</div></section>
    <section class="card section"><h2 class="section-title">🎙 Nói & ✍️ Viết</h2><div class="practice-stats"><div><b>${speakingAttempts.length}</b><span>Câu đã luyện</span></div><div><b>${speakingAverage}</b><span>Điểm nói TB</span></div><div><b>${progress.writingSubmissions.length}</b><span>Bài đã viết</span></div></div></section>
    ${(() => { const learner = LearnerProfileService.get() || {}; const syncStatus = CloudSyncService.getStatus(); return `<section class="card section learner-insight"><div class="section-heading"><h2 class="section-title">Tóm tắt tiến độ</h2><span class="sync-status ${syncStatus}">${syncStatus === 'syncing' ? 'Đang đồng bộ...' : syncStatus === 'synced' ? '✓ Đã đồng bộ' : syncStatus === 'offline' ? 'Ngoại tuyến' : syncStatus === 'error' ? 'Lỗi đồng bộ' : 'Chỉ lưu trên thiết bị'}</span></div><p class="subtle">${learner.weakSkills?.length ? `Cần củng cố: ${learner.weakSkills.join(', ')}.` : 'Chưa đủ dữ liệu để kết luận điểm yếu.'}</p><div class="action-row"><button class="btn secondary" data-view="smart-review">Ôn tập theo điểm yếu</button><button class="btn secondary" data-view="adaptive-plan">Mục tiêu & lịch học</button><button class="btn secondary" data-view="progress-reports">Báo cáo tuần / tháng</button></div></section>`; })()}
    ${(() => { const prefs = NotificationService.get(); return `<section class="card section notification-settings"><h2 class="section-title">🔔 Nhắc học</h2><p class="subtle">Chỉ lưu lựa chọn; ứng dụng không tự xin quyền thông báo khi mở.</p><label><input type="checkbox" data-notification-pref="srs" ${prefs.srs ? 'checked' : ''}> Nhắc từ SRS đến hạn</label><label><input type="checkbox" data-notification-pref="dailyPlan" ${prefs.dailyPlan ? 'checked' : ''}> Nhắc kế hoạch hôm nay</label><label><input type="checkbox" data-notification-pref="streak" ${prefs.streak ? 'checked' : ''}> Nhắc duy trì streak</label></section>`; })()}
    ${showTopik ? `<section class="card countdown-card section"><p class="eyebrow">Đếm ngược TOPIK</p><div><strong>28</strong><span>ngày</span></div><p class="subtle">Mốc luyện thi demo — ngày thi chính thức sẽ được kết nối sau.</p></section>` : ''}
    <section class="card section"><h2 class="section-title">📊 Tiến độ kỹ năng</h2><div class="skill-grid">${[['listening', 'Nghe'], ['speaking', 'Nói'], ['reading', 'Đọc'], ['writing', 'Viết']].map(([key, label]) => `<div class="skill"><strong>${skills[key]}%</strong><div class="subtle">${label}</div><div class="bar"><span style="width:${skills[key]}%"></span></div></div>`).join('')}</div></section>
    <section class="card section"><h2 class="section-title">🏅 Huy hiệu</h2><div class="badges"><div class="badge"><div class="badge-icon">🔥</div><small>Chăm chỉ</small></div><div class="badge"><div class="badge-icon">🎙</div><small>Phát âm</small></div><div class="badge"><div class="badge-icon">🧠</div><small>Trí nhớ tốt</small></div><div class="badge locked-badge"><div class="badge-icon">🔒</div><small>Cao thủ TOPIK</small></div></div></section>
    <section class="card section"><h2 class="section-title">🕘 Lịch sử thi thử</h2>${progress.mockTests.map((test) => `<div class="history-item"><div><b>${escapeHtml(test.title)}</b><div class="subtle">${escapeHtml(test.date)}</div></div><div class="score">${escapeHtml(test.score)}</div></div>`).join('')}</section><button class="btn danger full logout-button" id="logoutButton">Đăng xuất</button>`;
}

function editProfileView() {
  return `<section class="section page-heading"><button class="back-link" data-view="profile" aria-label="Quay lại">←</button><p class="eyebrow">Tài khoản học viên</p><h1 class="headline">Chỉnh sửa hồ sơ</h1></section><form id="editProfileForm" class="card auth-form" novalidate><label>Họ tên<input name="fullName" type="text" maxlength="80" value="${escapeHtml(state.currentUser.fullName)}" /></label><label>Trình độ<select name="level">${['Beginner', 'Beginner+', 'TOPIK I', 'TOPIK I nâng cao', 'TOPIK II khởi đầu'].map((level) => `<option ${state.currentUser.level === level ? 'selected' : ''}>${level}</option>`).join('')}</select></label><label>TOPIK hiện tại<select name="currentTopikLevel">${[1,2,3,4,5,6].map((level)=>`<option value="${level}" ${state.currentUser.currentTopikLevel===level?'selected':''}>TOPIK ${level}</option>`).join('')}</select></label><label>TOPIK mục tiêu<select name="targetTopikLevel">${[1,2,3,4,5,6].map((level)=>`<option value="${level}" ${state.currentUser.targetTopikLevel===level?'selected':''}>TOPIK ${level}</option>`).join('')}</select></label><p class="subtle">Email: ${escapeHtml(state.currentUser.email)}</p><p id="formError" class="form-error hidden" role="alert"></p><button class="btn primary full" type="submit">Lưu thay đổi</button></form>`;
}

const GlobalSearchService = {
  search(query = '') {
    const q = normalizeSearch(query); if (!q) return { lessons: [], vocabulary: [], practice: [], phrasebook: [], saved: [], resources: [], videos: [], notes: [], bookmarks: [], studyTools: [], context: [] };
    const match = (value) => normalizeSearch(value).includes(q);
    const lessons = (window.KLEARN_THEORY_LESSONS || []).filter((item) => [item.id, item.title, item.topic, item.theory, item.grammar, item.summary].some(match)).slice(0, 20);
    const vocabulary = (window.KLEARN_DICTIONARY || []).filter((item) => [item.id, item.korean, item.romanization, item.meaningVi, item.meaningEn, item.meaningZh, item.meanings?.vi, item.meanings?.en, item.meanings?.['zh-CN']].some(match)).slice(0, 20);
    const practice = (PracticeService.bank?.sets || []).filter((item) => [item.id, item.title, item.topic, item.practiceTypeLabel, item.levelLabel].some(match)).slice(0, 20);
    const phrasebook = (window.KLEARN_PHRASEBOOK || []).filter((item) => [item.id, item.korean, item.romanization, item.meanings?.vi, item.meanings?.en, item.meanings?.['zh-CN']].some(match)).slice(0, 20);
    const saved = userScoped(STORAGE_KEYS.savedSentences).filter((item) => [item.korean, item.translation, item.meaning, item.sourceText].some(match)).slice(0, 20);
    const resources = contentResources().filter((item) => [item.id, item.title, item.description, item.type, item.level, item.source, ...(item.tags || [])].some(match)).slice(0, 20);
    const videos = contentVideos().filter((item) => [item.id, item.title, item.instructor, item.courseId, ...(item.chapters || []).map((chapter) => chapter.title)].some(match)).slice(0, 20);
    const notes = NotesService.all().filter((item) => [item.content, item.sourceType, item.sourceId].some(match)).slice(0, 20);
    const bookmarks = BookmarkService.all().filter((item) => [item.title, item.type, item.id].some(match)).slice(0, 20);
    const studyTools = [
      ...(window.GrammarCompareService?.all?.() || []).map((item) => ({ id: item.id, title: item.title, description: item.overview?.vi || '', view: 'grammar-compare' })),
      ...(window.GrammarNotebookService?.all?.() || []).map((item) => ({ id: item.id, title: item.grammarId, description: `${item.personalNote || ''} ${(item.tags || []).join(' ')}`, view: 'grammar-notebook' })),
      ...(window.VocabularyCollectionService?.all?.() || []).map((item) => ({ id: item.id, title: item.title, description: `${item.wordIds?.length || 0} words`, view: 'vocabulary-collections' })),
      ...(window.RealLifeMissionService?.catalog?.() || []).map((item) => ({ id: item.id, title: item.title?.vi || item.id, description: `${item.instructions?.vi || ''} ${item.category || ''}`, view: 'real-life-missions' }))
    ].filter((item) => [item.id, item.title, item.description].some(match)).slice(0, 20);
    const context = window.KoreanContextService?.search?.(query) || [];
    return { lessons, vocabulary, practice, phrasebook, saved, resources, videos, notes, bookmarks, studyTools, context };
  }
};
window.GlobalSearchService = GlobalSearchService;

function smartReviewView() {
  const minutes = state.smartReviewMinutes || 20; const plan = SmartReviewService.plan(minutes); const profile = LearnerProfileService.get() || {};
  return `<section class="section page-heading"><button class="back-link" data-view="review" aria-label="Quay lại">←</button><p class="eyebrow">Ôn tập cá nhân</p><h1 class="headline">Ôn tập thông minh</h1><p class="subtle">Kết hợp lịch SRS, lỗi lặp, mục tiêu và các chủ đề còn yếu.</p></section><section class="card section"><h2 class="section-title">Chọn thời lượng</h2><div class="count-options smart-time-options">${[5,10,15,20,30].map((value) => `<button class="${minutes === value ? 'selected' : ''}" data-smart-minutes="${value}">${value} phút</button>`).join('')}</div><div class="smart-review-summary"><b>${plan.cards.length}</b><span>từ ưu tiên</span><b>${plan.grammar.length}</b><span>grammar yếu</span><b>${plan.skills.length}</b><span>skill cần củng cố</span></div><p class="subtle">${plan.graphTopics?.length ? `Chủ đề liên quan: ${plan.graphTopics.map((item) => item.label).join(', ')}.` : profile.weakSkills?.length ? `Đang ưu tiên: ${profile.weakSkills.join(', ')}.` : 'Hệ thống sẽ ưu tiên dữ liệu có lịch sử thực tế.'}</p><button class="btn primary full" data-start-smart-review="${minutes}">Bắt đầu phiên ${minutes} phút</button></section><section class="card section"><h2 class="section-title">Cách hệ thống xếp ưu tiên</h2><ul class="subtle"><li>SRS đến hạn: +3</li><li>Lỗi lặp lại: +3</li><li>Liên quan mục tiêu: +2</li><li>Chủ đề có nguy cơ quên: +2</li><li>Liên kết chủ đề yếu: +2</li></ul></section>`;
}

const RESOURCE_TYPE_LABELS = { grammar: 'Ngữ pháp', vocabulary: 'Từ vựng', audio: 'Audio', worksheet: 'Worksheet', writing: 'Writing', topik: 'TOPIK', reference: 'Reference' };
function reviewDashboardView() {
  if (!AccessControlService.canReview()) return `<section class="empty-state"><h1 class="headline">Khu vực giới hạn</h1><p class="subtle">Bảng kiểm duyệt chỉ mở cho role được Supabase cấp trong app_metadata. Không thể cấp quyền từ giao diện hoặc localStorage.</p><button class="btn primary" data-view="home">Về trang chủ</button></section>`;
  const records = [...(window.KLEARN_CONTENT_REVIEWS || [])]; const counts = records.reduce((out, item) => { out[item.status] = (out[item.status] || 0) + 1; return out; }, {});
  return `<section class="section page-heading"><button class="back-link" data-view="profile" aria-label="Quay lại">←</button><p class="eyebrow">${AccessControlService.role()} · Content Review</p><h1 class="headline">Bảng kiểm duyệt nội dung</h1><p class="subtle">Chỉ là lớp UX; Supabase RLS vẫn là nơi enforce quyền thật.</p></section><section class="review-status-grid section">${['in_review','needs_revision','published','reviewed'].map((status) => `<div class="card"><span class="set-level">${contentStatusLabel({ status })}</span><strong>${counts[status] || 0}</strong></div>`).join('')}</section><section class="card section review-queue"><h2 class="section-title">Content queue</h2>${records.map((item) => `<article class="review-row"><div><b>${escapeHtml(item.contentId)}</b><small>${escapeHtml(item.contentType)} · v${item.version} · cập nhật ${item.updatedAt ? formatDate(item.updatedAt) : '—'}</small></div><span class="set-level">${contentStatusLabel(item)}</span></article>`).join('')}</section>`;
}
function supportView() {
  const requests = SupportService.all(); const labels = { open: 'Đang chờ', assigned: 'Đã giao', answered: 'Đã phản hồi', closed: 'Đã đóng' };
  return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">Teacher / Mentor Support</p><h1 class="headline">Yêu cầu của tôi</h1><p class="subtle">Gửi câu hỏi đến giáo viên khi cần người thật phản hồi. Không gửi request giả khi đang offline.</p></section><section class="card support-request-card section"><form id="supportRequestForm"><label>Loại hỗ trợ<select name="type"><option value="general" ${state.supportDraft.type === 'general' ? 'selected' : ''}>Chung</option><option value="lesson" ${state.supportDraft.type === 'lesson' ? 'selected' : ''}>Lesson</option><option value="question" ${state.supportDraft.type === 'question' ? 'selected' : ''}>Question</option><option value="writing" ${state.supportDraft.type === 'writing' ? 'selected' : ''}>Writing attempt</option><option value="speaking" ${state.supportDraft.type === 'speaking' ? 'selected' : ''}>Speaking practice</option><option value="grammar" ${state.supportDraft.type === 'grammar' ? 'selected' : ''}>Grammar</option><option value="error_notebook" ${state.supportDraft.type === 'error_notebook' ? 'selected' : ''}>Error Notebook</option></select></label><label>ID nội dung (tùy chọn)<input name="sourceId" value="${escapeHtml(state.supportDraft.sourceId || '')}" placeholder="Ví dụ: topic-particle"></label><label>Nội dung<textarea name="message" rows="5" maxlength="4000" required placeholder="Mô tả điều bạn muốn giáo viên hỗ trợ..."></textarea></label><button class="btn primary full" type="submit">Gửi giáo viên hỗ trợ</button></form><p class="security-note">${AccessControlService.isCloudReady() ? 'Request sẽ được gửi qua Supabase và chịu RLS.' : 'Chức năng hỗ trợ giáo viên cần kết nối mạng và Supabase.'}</p></section><section class="support-list section">${requests.length ? requests.map((request) => `<article class="card support-row"><div class="note-card-top"><span class="set-level">${labels[request.status] || request.status}</span><small>${formatDate(request.created_at || request.createdAt)}</small></div><p>${escapeHtml(request.message)}</p><small>${escapeHtml(request.type)}${request.source_id ? ` · ${escapeHtml(request.source_id)}` : ''}</small></article>`).join('') : '<div class="empty-state compact-empty"><h2>Chưa có yêu cầu</h2><p class="subtle">Các yêu cầu đã gửi và phản hồi sẽ xuất hiện tại đây.</p></div>'}</section>${AccessControlService.canReview() ? '<button class="btn secondary full" data-view="review-dashboard">Mở Content Review Dashboard</button>' : ''}`;
}
function resourcesView() {
  const filters = state.resourceFilters; const query = normalizeSearch(filters.search || '');
  const list = contentResources().filter((item) => (filters.type === 'all' || item.type === filters.type) && (filters.level === 'all' || item.level === filters.level || item.level === 'TOPIK_1-6' || item.level === 'ALL') && (!query || [item.title, item.description, item.source, ...(item.tags || [])].some((value) => normalizeSearch(value).includes(query))));
  return `<section class="section page-heading"><button class="back-link" data-view="lessons" aria-label="Quay lại">←</button><p class="eyebrow">Learning Resources</p><h1 class="headline">Học liệu</h1><p class="subtle">Thư viện nội dung được biên soạn, liên kết hoặc cấp quyền rõ ràng.</p></section><label class="search-box section"><span>⌕</span><input id="resourceSearch" type="search" placeholder="Tìm học liệu..." value="${escapeHtml(filters.search || '')}"></label><section class="card resource-filters section"><select data-resource-filter="type"><option value="all">Tất cả loại</option>${Object.entries(RESOURCE_TYPE_LABELS).map(([value,label]) => `<option value="${value}" ${filters.type === value ? 'selected' : ''}>${label}</option>`).join('')}</select><select data-resource-filter="level"><option value="all">Mọi cấp độ</option>${['TOPIK_1','TOPIK_2','TOPIK_3','TOPIK_4','TOPIK_5','TOPIK_6','TOPIK_1-6','ALL'].map((value) => `<option value="${value}" ${filters.level === value ? 'selected' : ''}>${value === 'ALL' ? 'Tất cả' : value.replace('_', ' ')}</option>`).join('')}</select></section><div class="results-count">${list.length} học liệu</div><section class="resource-grid">${list.map((item) => { const progress = resourceProgress()[item.id] || {}; const review = contentReviewMeta(item.id, 'resource'); return `<article class="card resource-card"><div class="resource-card-top"><span class="set-level">${RESOURCE_TYPE_LABELS[item.type] || item.type}</span><button class="save-exam ${BookmarkService.has('resource', item.id) ? 'saved' : ''}" data-bookmark-type="resource" data-bookmark-id="${item.id}" data-bookmark-title="${escapeHtml(item.title)}">${BookmarkService.has('resource', item.id) ? '★' : '☆'}</button></div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div class="resource-meta"><span>${escapeHtml(item.level)}</span><span>${escapeHtml(item.source)}</span><span>${contentStatusLabel(review)} · v${review.version}</span><span>${item.downloadable ? 'Có tải xuống' : 'Đọc trực tuyến'}</span></div><button class="btn ${progress.viewed ? 'secondary' : 'primary'} full" data-resource-id="${item.id}">${progress.viewed ? 'Mở lại' : 'Xem học liệu'}</button></article>`; }).join('')}</section><div class="action-row section"><button class="btn secondary" data-view="videos">Bài giảng Video</button><button class="btn primary" data-view="notes">Ghi chú của tôi</button></div>`;
}
function resourceView() {
  const item = resourceById(state.selectedResourceId); if (!item) return resourcesView(); const progress = resourceProgress()[item.id] || {}; const highlights = userScoped(STORAGE_KEYS.highlights).filter((highlight) => highlight.sourceId === item.id); const notes = NotesService.all().filter((note) => note.sourceId === item.id);
  const review = contentReviewMeta(item.id, 'resource'); return `<section class="section page-heading"><button class="back-link" data-view="resources" aria-label="Quay lại">←</button><p class="eyebrow">${RESOURCE_TYPE_LABELS[item.type] || item.type} · ${escapeHtml(item.level)}</p><h1 class="headline">${escapeHtml(item.title)}</h1><p class="subtle">${escapeHtml(item.description)}</p></section><section class="resource-view-layout"><article class="card resource-document section"><div class="resource-meta"><span>Biên soạn bởi: ${escapeHtml(item.source)}</span><span>License: ${escapeHtml(item.licenseStatus || 'practice')}</span><span>${contentStatusLabel(review)} · v${review.version}${review.updatedAt ? ` · ${formatDate(review.updatedAt)}` : ''}</span></div>${item.audioText ? `<div class="resource-audio"><button class="audio-inline" data-speak="${escapeHtml(item.audioText)}">🔊 Phát audio</button><p lang="ko">${escapeHtml(item.audioText)}</p></div>` : ''}${(item.content || []).map((paragraph, index) => { const anchor = `${item.id}-block-${index + 1}`; const highlighted = highlights.some((entry) => entry.anchorId === anchor); return `<div class="resource-block ${highlighted ? 'highlighted' : ''}" id="${anchor}" data-content-block="${anchor}"><p>${escapeHtml(paragraph)}</p><button class="text-link" data-highlight-resource="${item.id}" data-highlight-anchor="${anchor}">${highlighted ? 'Bỏ đánh dấu' : 'Đánh dấu đoạn'}</button></div>`; }).join('')}<div class="action-row"><button class="btn ${BookmarkService.has('resource', item.id) ? 'secondary' : 'primary'}" data-bookmark-type="resource" data-bookmark-id="${item.id}" data-bookmark-title="${escapeHtml(item.title)}">${BookmarkService.has('resource', item.id) ? 'Đã lưu' : 'Lưu học liệu'}</button><button class="btn secondary" data-resource-viewed="${item.id}">${progress.viewed ? '✓ Đã xem' : 'Đánh dấu đã xem'}</button><button class="btn secondary" data-report-content="${item.id}" data-report-type="${item.type}">Báo lỗi nội dung</button></div></article><aside class="resource-side section"><section class="card"><h2 class="section-title">Ghi chú tại học liệu</h2><form id="resourceNoteForm"><textarea name="content" rows="4" placeholder="Ghi chú cho phần đang học..."></textarea><input type="hidden" name="sourceId" value="${item.id}"><input type="hidden" name="sourceType" value="resource"><button class="btn primary full" type="submit">Lưu ghi chú</button></form></section>${notes.length ? `<section class="card"><h2 class="section-title">Ghi chú đã lưu</h2>${notes.map((note) => `<div class="note-mini"><p>${escapeHtml(note.content)}</p><small>${formatDate(note.updatedAt)}</small></div>`).join('')}</section>` : ''}</aside></section>`;
}
function notesView() {
  const notes = NotesService.all(); const editing = notes.find((note) => note.id === state.selectedNoteId); return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">Notes</p><h1 class="headline">Ghi chú của tôi</h1><p class="subtle">Ghi chú gắn với lesson, grammar, vocabulary, strategy, reading hoặc học liệu.</p></section><form id="noteForm" class="card note-form section"><input type="hidden" name="id" value="${editing?.id || ''}"><label>Nguồn<select name="sourceType"><option value="general">Chung</option><option value="lesson">Lesson</option><option value="grammar">Grammar</option><option value="vocabulary">Vocabulary</option><option value="strategy">Strategy</option><option value="reading">Reading</option><option value="resource">Resource</option></select></label><label>ID nguồn<input name="sourceId" value="${escapeHtml(editing?.sourceId || '')}" placeholder="Ví dụ: grammar-topic-particles"></label><label>Nội dung<textarea name="content" rows="4" placeholder="Viết ghi chú của bạn..." required>${escapeHtml(editing?.content || '')}</textarea></label><div class="action-row"><button class="btn primary" type="submit">${editing ? 'Cập nhật ghi chú' : 'Lưu ghi chú'}</button>${editing ? '<button class="btn secondary" type="button" data-note-cancel>Hủy sửa</button>' : ''}</div></form><section class="notes-list section">${notes.length ? notes.map((note) => `<article class="card note-card"><div class="note-card-top"><span class="set-level">${escapeHtml(note.sourceType)}</span><small>${formatDate(note.updatedAt)}</small></div><p>${escapeHtml(note.content)}</p>${note.sourceId ? `<small>Liên kết: ${escapeHtml(note.sourceId)}${note.anchorId ? ` · ${escapeHtml(note.anchorId)}` : ''}</small>` : ''}<div class="action-row"><button class="text-link" data-note-edit="${note.id}">Sửa</button><button class="text-link danger-text" data-note-delete="${note.id}">Xóa</button></div></article>`).join('') : '<div class="empty-state compact-empty"><h2>Chưa có ghi chú</h2><p class="subtle">Mở một học liệu hoặc lesson để lưu ghi chú đầu tiên.</p></div>'}</section>`;
}
function bookmarksView() {
  const all = BookmarkService.all(); const filtered = state.selectedBookmarkType === 'all' ? all : all.filter((item) => item.type === state.selectedBookmarkType); return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">Bookmarks</p><h1 class="headline">Đã lưu</h1><p class="subtle">Lưu một lần, dùng lại ở đúng ngữ cảnh học.</p></section><section class="card bookmark-filters section"><select data-bookmark-filter><option value="all">Tất cả loại</option>${['lesson','word','grammar','sentence','strategy','resource','question'].map((type) => `<option value="${type}" ${state.selectedBookmarkType === type ? 'selected' : ''}>${type}</option>`).join('')}</select></section><section class="bookmark-list section">${filtered.length ? filtered.map((item) => `<article class="card bookmark-row"><div><span class="set-level">${escapeHtml(item.type)}</span><h2>${escapeHtml(item.title || item.id)}</h2><small>${formatDate(item.createdAt)}</small></div><button class="btn secondary" data-bookmark-type="${escapeHtml(item.type)}" data-bookmark-id="${escapeHtml(item.id)}" data-bookmark-title="${escapeHtml(item.title || '')}">Bỏ lưu</button></article>`).join('') : '<div class="empty-state compact-empty"><h2>Chưa có mục đã lưu</h2><p class="subtle">Bạn có thể lưu học liệu, từ vựng, lesson hoặc chiến thuật khi đang học.</p></div>'}</section>`;
}
function videosView() { const videos = contentVideos(); return `<section class="section page-heading"><button class="back-link" data-view="lessons" aria-label="Quay lại">←</button><p class="eyebrow">Video Academy</p><h1 class="headline">Bài giảng Video</h1><p class="subtle">Learning portal cho video có nguồn, giảng viên và transcript rõ ràng.</p></section><section class="video-grid">${videos.map((video) => `<article class="card video-card"><div class="video-cover">${video.status === 'published' && video.videoUrl ? '▶' : '◷'}</div><span class="set-level">${video.status === 'published' && video.videoUrl ? 'Published' : 'Draft · chưa phát hành'}</span><h2>${escapeHtml(video.title)}</h2><p>${escapeHtml(video.instructor)} · ${video.duration ? `${Math.ceil(video.duration / 60)} phút` : 'Thời lượng đang cập nhật'}</p><button class="btn ${video.status === 'published' && video.videoUrl ? 'primary' : 'secondary'} full" data-video-id="${video.id}">${video.status === 'published' && video.videoUrl ? 'Xem bài giảng' : 'Xem thông tin'}</button></article>`).join('')}</section>`; }
function videoView() { const video = videoById(state.selectedVideoId); if (!video) return videosView(); const hasVideo = video.status === 'published' && Boolean(video.videoUrl); return `<section class="section page-heading"><button class="back-link" data-view="videos" aria-label="Quay lại">←</button><p class="eyebrow">${video.status === 'published' ? 'Published' : 'Draft · chưa phát hành'}</p><h1 class="headline">${escapeHtml(video.title)}</h1><p class="subtle">Biên soạn bởi ${escapeHtml(video.instructor)}</p></section><section class="video-room-layout"><article class="card video-stage">${hasVideo ? `<video id="academyVideo" controls src="${escapeHtml(video.videoUrl)}"></video>` : `<div class="video-unavailable"><strong>Video chưa được phát hành</strong><p>Chưa có video URL được cấp quyền. Nội dung này không hiển thị trình phát broken cho người học.</p></div>`}<section class="video-chapters"><h2 class="section-title">Chapters</h2>${video.chapters.map((chapter) => `<button class="chapter-row ${state.videoChapterTime === chapter.time ? 'active' : ''}" data-video-chapter="${chapter.time}"><span>${String(Math.floor(chapter.time / 60)).padStart(2, '0')}:${String(chapter.time % 60).padStart(2, '0')}</span>${escapeHtml(chapter.title)}</button>`).join('')}</section></article><aside class="video-side"><section class="card"><h2 class="section-title">Transcript</h2>${video.transcript.map((line) => `<p>${escapeHtml(line)}</p>`).join('')}</section><section class="card"><h2 class="section-title">Quick Check</h2><p>Hãy mở lesson tương tác liên quan để kiểm tra ngay sau mỗi chapter.</p>${video.resourceIds?.map((id) => `<button class="text-link" data-resource-id="${id}">Mở học liệu liên quan</button>`).join('') || ''}</section></aside></section>`; }

function globalSearchView() {
  const query = state.globalQuery || ''; const groups = GlobalSearchService.search(query); const total = Object.values(groups).reduce((sum, list) => sum + list.length, 0);
  const section = (title, items, renderItem) => items.length ? `<section class="card section search-group"><div class="section-heading"><h2 class="section-title">${title}</h2><span class="level-pill">${items.length}</span></div>${items.map(renderItem).join('')}</section>` : '';
  return `<section class="section page-heading"><button class="back-link" data-view="home" aria-label="Quay lại">←</button><p class="eyebrow">🔍 Global Search</p><h1 class="headline">Tìm kiếm toàn app</h1></section><form id="globalSearchForm" class="search-box section"><span>⌕</span><input id="globalSearchInput" name="query" type="search" value="${escapeHtml(query)}" placeholder="학교 · hakgyo · trường học · school · 学校 · 은/는" autofocus><button class="btn primary" type="submit">Tìm</button></form>${query ? `<p class="results-count">${total} kết quả cho “${escapeHtml(query)}”</p>` : '<p class="subtle center">Tìm bài học, học liệu, video, ghi chú, từ điển và kho đề.</p>'}${section('NGỮ CẢNH & CÁCH NÓI', groups.context || [], (item) => `<button class="search-result-row context-search-result" data-context-result="${escapeHtml(item.id)}"><b lang="ko">${escapeHtml(item.title)}</b><small>${escapeHtml(item.summary)}</small></button>`)}${section('CÔNG CỤ HỌC', groups.studyTools, (item) => `<button class="search-result-row" data-view="${escapeHtml(item.view)}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.description)}</small></button>`)}${section('BÀI HỌC', groups.lessons, (item) => `<button class="search-result-row" data-theory-lesson="${item.id}"><b>${escapeHtml(item.title)}</b><small>TOPIK ${item.topikLevel} · ${escapeHtml(item.topic)}</small></button>`)}${section('TỪ ĐIỂN', groups.vocabulary, (item) => `<button class="search-result-row" data-dictionary-id="${item.id}"><b lang="ko">${escapeHtml(item.korean)}</b><small>${escapeHtml(item.romanization || '')} · ${escapeHtml(item.meanings?.vi || item.meaningVi || '')}</small></button>`)}${section('KHO ĐỀ TOPIK', groups.practice, (item) => `<button class="search-result-row" data-start-set="${item.id}"><b>${escapeHtml(item.title || item.topic)}</b><small>${escapeHtml(item.levelLabel || '')} · ${item.questionCount || 0} câu</small></button>`)}${section('HỌC LIỆU', groups.resources, (item) => `<button class="search-result-row" data-resource-id="${item.id}"><b>${escapeHtml(item.title)}</b><small>${RESOURCE_TYPE_LABELS[item.type] || item.type} · ${escapeHtml(item.source)}</small></button>`)}${section('VIDEO', groups.videos, (item) => `<button class="search-result-row" data-video-id="${item.id}"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.instructor)} · ${item.status === 'published' ? 'Published' : 'Draft'}</small></button>`)}${section('GHI CHÚ', groups.notes, (item) => `<button class="search-result-row" data-view="notes"><b>${escapeHtml(item.content)}</b><small>${escapeHtml(item.sourceType)} · ${escapeHtml(item.sourceId || '')}</small></button>`)}${section('ĐÃ LƯU', groups.bookmarks, (item) => `<button class="search-result-row" data-view="bookmarks"><b>${escapeHtml(item.title || item.id)}</b><small>${escapeHtml(item.type)}</small></button>`)}${section('PHRASEBOOK', groups.phrasebook, (item) => `<button class="search-result-row"><b lang="ko">${escapeHtml(item.korean)}</b><small>${escapeHtml(item.meanings?.vi || '')}</small></button>`)}${section('CÂU ĐÃ LƯU', groups.saved, (item) => `<button class="search-result-row" data-view="translation-hub"><b lang="ko">${escapeHtml(item.korean || '')}</b><small>${escapeHtml(item.translation || item.meaning || '')}</small></button>`)}`;
}

function analyticsView() {
  const history = PracticeService.getHistory(); const recent = history.slice(0, 5); const profile = LearnerProfileService.get() || {}; const avg = recent.length ? Math.round(recent.reduce((sum, item) => sum + item.percentage, 0) / recent.length) : 0; const readiness = Math.min(100, Math.max(0, Math.round(avg * .75 + (profile.skillScores?.reading || 0) * .1 + (profile.skillScores?.listening || 0) * .1)));
  const trend = recent.slice().reverse().map((item) => item.percentage).join(' → ') || 'Chưa có dữ liệu';
  const skillScores = Object.entries(profile.skillScores || {}).filter(([, value]) => Number(value) > 0);
  return `<section class="section page-heading"><button class="back-link" data-view="topik" aria-label="Quay lại">←</button><p class="eyebrow">📊 TOPIK Analytics</p><h1 class="headline">Phân tích tiến độ</h1><p class="subtle">Ước tính dựa trên kết quả luyện tập, không phải dự đoán điểm thi chính thức.</p></section><section class="card section analytics-summary"><div class="stats stats-four"><div class="stat"><b>${avg}%</b><small>Điểm TB 5 đề gần nhất</small></div><div class="stat"><b>${readiness}%</b><small>Readiness ước tính</small></div><div class="stat"><b>${recent.reduce((sum,item)=>sum+(item.correct || item.score || 0),0)}</b><small>Câu đúng</small></div><div class="stat"><b>${recent.reduce((sum,item)=>sum+(item.wrong || ((item.total || 0)-(item.score || 0))),0)}</b><small>Câu sai</small></div></div><p class="trend-line">Trend: ${trend}</p></section><section class="card section"><h2 class="section-title">Theo kỹ năng</h2><div class="skill-grid">${(skillScores.length ? skillScores : [['listening',0],['reading',0],['vocabulary',0],['grammar',0]]).map(([skill, score]) => `<div class="skill"><strong>${score}%</strong><div class="subtle">${escapeHtml(skill)}</div><div class="bar"><span style="width:${score}%"></span></div></div>`).join('')}</div></section><section class="card section"><h2 class="section-title">Theo dạng câu hỏi</h2>${recent.length ? recent.map((attempt) => `<div class="history-item"><div><b>${escapeHtml(attempt.setTitle)}</b><div class="subtle">${formatDate(attempt.completedAt)} · ${attempt.averageTimeSeconds || '—'}s/câu</div></div><div class="score">${attempt.percentage}%</div></div>`).join('') : '<p class="subtle">Hoàn thành một đề để xem phân tích.</p>'}</section>`;
}

function weeklyInsightsView() {
  const profile = LearnerProfileService.get() || {}; const history = PracticeService.getHistory(); const recent = history.filter((item) => Date.now() - new Date(item.completedAt).getTime() <= 7 * 86400000); const lessons = (profile.recentLessons || []).filter((item) => item.updatedAt ? Date.now() - new Date(item.updatedAt).getTime() <= 7 * 86400000 : item.status !== 'not_started').length; const mastered = state.srsData.filter((item) => item.status === 'mastered').length; const avg = recent.length ? Math.round(recent.reduce((sum,item)=>sum+item.percentage,0)/recent.length) : 0; const weak = profile.weakSkills?.[0] || 'Chưa đủ dữ liệu';
  return `<section class="section page-heading"><button class="back-link" data-view="profile" aria-label="Quay lại">←</button><p class="eyebrow">📈 Tổng hợp tuần</p><h1 class="headline">Tuần này của bạn</h1><p class="subtle">Tổng hợp từ dữ liệu học thật trong 7 ngày gần nhất.</p></section><section class="card section"><div class="stats stats-four"><div class="stat"><b>${profile.weeklyStudyMinutes || 0}</b><small>Phút học</small></div><div class="stat"><b>${lessons}</b><small>Bài đã chạm</small></div><div class="stat"><b>${mastered}</b><small>Từ thành thạo</small></div><div class="stat"><b>${recent.length}</b><small>Đề đã làm</small></div></div></section><section class="card section"><h2 class="section-title">Điểm nổi bật</h2><p>Điểm luyện trung bình: <strong>${avg}%</strong></p><p>Điểm mạnh: <strong>${profile.strengths?.[0] || 'Đang hình thành'}</strong></p><p>Cần cải thiện: <strong>${weak}</strong></p><button class="btn secondary" data-open-ai="Nhận xét tuần này dựa trên structured stats của tôi, không bịa dữ liệu.">Nhận xét tuần này</button></section>`;
}

// ============================================================
// Render and event binding
// ============================================================
function render() {
  ThemeService.apply();
  syncShell();
  const views = {
    welcome: welcomeView, register: registerView, login: loginView,
    'onboarding-goals': goalsView, 'onboarding-level': levelView, placement: placementView, 'onboarding-result': onboardingResultView,
    home: homeView, lessons: lessonsView, theory: theoryView, roadmap: roadmapView, topik: practiceHubView, lesson: lessonView, 'lesson-preview': lessonPreviewView, dictionary: dictionaryView, 'translation-hub': translationHubView, phrasebook: phrasebookView, handwriting: handwritingView,
    'practice-hub': practiceHubView, 'exam-catalog': examCatalogView, 'random-exam': randomExamView, 'advanced-practice': advancedPracticeView, 'wrong-practice': wrongPracticeView, 'saved-exams': savedExamsView, 'practice-history': practiceHistoryView, 'skill-hub': skillHubView,
    'quick-practice': quickPracticeView, 'practice-session': practiceSessionView, 'practice-result': practiceResultView, 'practice-review': practiceReviewView,
    review: reviewView, 'smart-review': smartReviewView, search: globalSearchView, analytics: analyticsView, 'weekly-insights': weeklyInsightsView, 'vocabulary-hub': vocabularyHubView, 'review-start': reviewSessionView, 'vocab-pretest': vocabularyPretestView, 'pretest-result': pretestResultView,
    'vocab-test-setup': vocabularyTestSetupView, 'vocab-test': vocabularyTestView, 'vocab-test-result': vocabularyTestResultView,
    practice: speakingHubView, 'speaking-hub': speakingHubView, 'speaking-session': speakingSessionView, 'speaking-result': speakingResultView,
    'writing-hub': writingHubView, 'writing-editor': writingEditorView, 'writing-result': writingResultView, 'listening-studio': listeningStudioView, 'writing-room': writingRoomView, 'speaking-room': speakingRoomView, 'topik-exam': topikExamView, 'topik-exam-result': topikExamResultView, resources: resourcesView, 'resource-view': resourceView, notes: notesView, bookmarks: bookmarksView, videos: videosView, 'video-view': videoView, support: supportView, 'review-dashboard': reviewDashboardView,
    profile: profileView, 'edit-profile': editProfileView, courses: coursesView, 'course-detail': courseDetailView, 'strategy-lab': strategyLabView, 'strategy-detail': strategyDetailView, 'progress-reports': progressReportsView, 'practical-korean': practicalKoreanView, 'vocabulary-notebook': vocabularyNotebookView,
    ...(window.KLEARN_EXTRA_VIEWS || {})
  };
  appElement().innerHTML = (views[state.currentView] || welcomeView)();
  const viewLabels = { welcome: '', login: 'Đăng nhập', register: 'Đăng ký', profile: 'Hồ sơ', 'edit-profile': 'Chỉnh sửa hồ sơ' };
  document.title = viewLabels[state.currentView] ? `Tiếng Hàn - TamHoanq · ${I18nService.translateText(viewLabels[state.currentView])}` : 'Tiếng Hàn - TamHoanq';
  I18nService.applyDocument();
  bindEvents();
  renderAiWidget();
  renderContextDictionary();
  window.KLEARN_AFTER_RENDER?.();
  window.scrollTo(0, 0);
}

function bindEvents() {
  document.querySelectorAll('[data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
  document.querySelectorAll('[data-resource-id]').forEach((button) => { button.onclick = () => { state.selectedResourceId = button.dataset.resourceId; setView('resource-view'); }; });
  document.querySelectorAll('[data-video-id]').forEach((button) => { button.onclick = () => { state.selectedVideoId = button.dataset.videoId; state.videoChapterTime = 0; setView('video-view'); }; });
  document.querySelectorAll('[data-resource-filter]').forEach((select) => { select.onchange = () => { state.resourceFilters[select.dataset.resourceFilter] = select.value; render(); }; });
  const resourceSearch = document.getElementById('resourceSearch'); if (resourceSearch) resourceSearch.oninput = () => { state.resourceFilters.search = resourceSearch.value; render(); };
  document.querySelectorAll('[data-resource-viewed]').forEach((button) => { button.onclick = () => { setResourceProgress(button.dataset.resourceViewed, { viewed: true }); render(); }; });
  document.querySelectorAll('[data-bookmark-type]').forEach((button) => { button.onclick = () => { const saved = BookmarkService.toggle(button.dataset.bookmarkType, button.dataset.bookmarkId, button.dataset.bookmarkTitle || ''); toast(saved ? 'Đã lưu.' : 'Đã bỏ lưu.'); render(); }; });
  const bookmarkFilter = document.querySelector('[data-bookmark-filter]'); if (bookmarkFilter) bookmarkFilter.onchange = () => { state.selectedBookmarkType = bookmarkFilter.value; render(); };
  document.querySelectorAll('[data-highlight-resource]').forEach((button) => { button.onclick = () => { const itemId = button.dataset.highlightResource; const anchorId = button.dataset.highlightAnchor; const current = userScoped(STORAGE_KEYS.highlights); const exists = current.some((entry) => entry.sourceId === itemId && entry.anchorId === anchorId); saveUserScoped(STORAGE_KEYS.highlights, exists ? current.filter((entry) => !(entry.sourceId === itemId && entry.anchorId === anchorId)) : [{ id: uniqueId(), sourceType: 'resource', sourceId: itemId, anchorId, color: 'yellow', createdAt: new Date().toISOString() }, ...current], 300); render(); }; });
  const resourceNoteForm = document.getElementById('resourceNoteForm'); if (resourceNoteForm) resourceNoteForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(resourceNoteForm); NotesService.upsert({ sourceType: 'resource', sourceId: form.get('sourceId'), content: form.get('content') }); toast('Đã lưu ghi chú.'); render(); };
  const noteForm = document.getElementById('noteForm'); if (noteForm) noteForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(noteForm); NotesService.upsert({ id: form.get('id') || undefined, sourceType: form.get('sourceType'), sourceId: form.get('sourceId'), content: form.get('content') }); state.selectedNoteId = ''; toast('Đã lưu ghi chú.'); render(); };
  document.querySelectorAll('[data-note-edit]').forEach((button) => { button.onclick = () => { state.selectedNoteId = button.dataset.noteEdit; render(); }; });
  document.querySelectorAll('[data-note-delete]').forEach((button) => { button.onclick = () => { if (window.confirm('Xóa ghi chú này?')) { NotesService.remove(button.dataset.noteDelete); render(); } }; });
  const noteCancel = document.querySelector('[data-note-cancel]'); if (noteCancel) noteCancel.onclick = () => { state.selectedNoteId = ''; render(); };
  document.querySelectorAll('[data-video-chapter]').forEach((button) => { button.onclick = () => { state.videoChapterTime = Number(button.dataset.videoChapter); const video = document.getElementById('academyVideo'); if (video) video.currentTime = state.videoChapterTime; render(); }; });
  document.querySelectorAll('[data-open-support]').forEach((button) => { button.onclick = () => { state.supportDraft = { type: button.dataset.supportType || 'general', sourceId: button.dataset.supportSource || '' }; setView('support'); }; });
  const supportRequestForm = document.getElementById('supportRequestForm'); if (supportRequestForm) supportRequestForm.onsubmit = async (event) => { event.preventDefault(); const form = new FormData(supportRequestForm); try { const result = await SupportService.submit({ type: form.get('type'), sourceId: form.get('sourceId'), message: form.get('message') }); if (result.offline) { toast('Chức năng hỗ trợ giáo viên cần kết nối mạng.'); return; } toast('Đã gửi yêu cầu tới giáo viên.'); state.supportDraft = { type: 'general', sourceId: '' }; supportRequestForm.reset(); render(); } catch (error) { toast(`Không thể gửi yêu cầu: ${error.message || 'hãy thử lại.'}`); } };
  document.querySelectorAll('[data-report-content]').forEach((button) => { button.onclick = async () => { const message = window.prompt('Mô tả lỗi nội dung (không bắt buộc):', ''); if (message === null) return; const reportType = window.prompt('Loại lỗi: typo / meaning / audio / answer / other', 'other') || 'other'; try { const result = await submitContentReport({ contentId: button.dataset.reportContent, contentType: button.dataset.reportType || 'resource', reportType, message }); toast(result.offline ? 'Báo lỗi cần kết nối mạng.' : 'Đã gửi báo lỗi nội dung.'); } catch (error) { toast(`Không thể gửi báo lỗi: ${error.message || 'hãy thử lại.'}`); } }; });
  document.querySelectorAll('[data-open-lesson]').forEach((button) => { button.onclick = () => openLesson(button.dataset.openLesson); });
  document.querySelectorAll('[data-preview-lesson]').forEach((button) => { button.onclick = () => openLesson(button.dataset.previewLesson); });
  document.querySelectorAll('[data-theory-lesson]').forEach((button) => { button.onclick = () => openLesson(button.dataset.theoryLesson); });
  document.querySelectorAll('[data-course-id]').forEach((button) => { button.onclick = () => { state.selectedCourseId = button.dataset.courseId; setView('course-detail'); }; });
  document.querySelectorAll('[data-strategy-id]').forEach((button) => { button.onclick = () => { state.selectedStrategyId = button.dataset.strategyId; setView('strategy-detail'); }; });
  document.querySelectorAll('[data-strategy-practice]').forEach((button) => { button.onclick = () => { const questions = window.TopikStrategyService?.questions?.(button.dataset.strategyPractice, Number(button.dataset.count) || 5) || []; if (!PracticeService.startQuestions(questions, `Chiến thuật · ${window.TopikStrategyService?.get?.(button.dataset.strategyPractice)?.title || ''}`, 'strategy')) toast('Chưa có câu hỏi phù hợp cho dạng này.'); }; });
  document.querySelectorAll('[data-listening-mode]').forEach((button) => { button.onclick = () => { state.listeningStudio.mode = button.dataset.listeningMode; state.listeningStudio.dictationResult = null; state.listeningStudio.quizAnswer = null; saveListeningSession(); render(); }; });
  const listeningPlay = document.querySelector('[data-listening-play]'); if (listeningPlay) listeningPlay.onclick = () => { if (state.listeningStudio.playing) { window.speechSynthesis?.cancel(); clearTimeout(state.listeningStudio.playTimer); state.listeningStudio.playing = false; saveListeningSession(); render(); } else playListeningAudio(); };
  document.querySelectorAll('[data-listening-seek]').forEach((button) => { button.onclick = () => { const max = Math.max(8, Math.round((listeningCurrentQuestion().koreanText || listeningCurrentQuestion().audioText || '').length * 0.42)); state.listeningStudio.position = Math.max(0, Math.min(max, Number(state.listeningStudio.position || 0) + Number(button.dataset.listeningSeek))); saveListeningSession(); render(); }; });
  document.querySelectorAll('[data-listening-speed]').forEach((button) => { button.onclick = () => { state.listeningStudio.speed = Number(button.dataset.listeningSpeed); saveListeningSession(); render(); }; });
  const listeningTimeline = document.getElementById('listeningTimeline'); if (listeningTimeline) listeningTimeline.oninput = () => { state.listeningStudio.position = Number(listeningTimeline.value); saveListeningSession(); };
  document.querySelectorAll('[data-listening-loop]').forEach((button) => { button.onclick = () => { const key = button.dataset.listeningLoop; if (key === 'clear') { state.listeningStudio.loopA = null; state.listeningStudio.loopB = null; } else { state.listeningStudio[key === 'a' ? 'loopA' : 'loopB'] = Number(state.listeningStudio.position || 0); } saveListeningSession(); render(); }; });
  document.querySelectorAll('[data-listening-toggle]').forEach((input) => { input.onchange = () => { state.listeningStudio[`${input.dataset.listeningToggle}Visible`] = input.checked; saveListeningSession(); render(); }; });
  const dictationInput = document.getElementById('dictationInput'); const dictationButton = document.querySelector('[data-listening-dictation]'); if (dictationInput) dictationInput.oninput = () => { state.listeningStudio.dictation = dictationInput.value; }; if (dictationButton) dictationButton.onclick = () => { const q = listeningCurrentQuestion(); state.listeningStudio.dictationResult = { answer: state.listeningStudio.dictation || dictationInput?.value || '', score: similarityScore(q.koreanText || q.audioText || '', state.listeningStudio.dictation || dictationInput?.value || '') }; saveListeningSession(); render(); };
  document.querySelectorAll('[data-listening-quiz]').forEach((button) => { button.onclick = () => { const q = listeningCurrentQuestion(); state.listeningStudio.quizAnswer = { answer: button.dataset.listeningQuiz, correct: button.dataset.listeningQuiz === q.correctAnswer }; saveListeningSession(); render(); }; });
  const listeningSaveError = document.querySelector('[data-listening-save-error]'); if (listeningSaveError) listeningSaveError.onclick = () => { const q = listeningCurrentQuestion(); const result = state.listeningStudio.dictationResult; window.ErrorNotebookService?.add?.({ type: 'listening', question: q.koreanText || q.audioText, mistake: result?.answer || '', correction: q.koreanText || q.audioText, explanation: `Text comparison ${result?.score || 0}%` }); toast('Đã lưu lỗi nghe vào Sổ lỗi.'); };
  document.querySelectorAll('[data-listening-next]').forEach((button) => { button.onclick = () => { state.listeningStudio.index = (state.listeningStudio.index + 1) % listeningStudioQuestions().length; state.listeningStudio.position = 0; state.listeningStudio.dictation = ''; state.listeningStudio.dictationResult = null; state.listeningStudio.quizAnswer = null; saveListeningSession(); render(); }; });
  document.querySelectorAll('[data-start-topik-exam]').forEach((button) => { button.onclick = () => startTopikExam(); });
  document.querySelectorAll('[data-exam-index]').forEach((button) => { button.onclick = () => { if (state.examSession) { state.examSession.index = Number(button.dataset.examIndex); saveExamSession(); render(); } }; });
  document.querySelectorAll('[data-exam-answer]').forEach((button) => { button.onclick = () => { if (!state.examSession) return; state.examSession.answers[state.examSession.questions[state.examSession.index].id] = button.dataset.examAnswer; saveExamSession(); render(); }; });
  const examSubmit = document.querySelector('[data-exam-submit]'); if (examSubmit) examSubmit.onclick = () => { if (window.confirm('Nộp bài thi thử? Bạn sẽ không thể chỉnh sửa đáp án.')) finishTopikExam(); };
  document.querySelectorAll('[data-speaking-room-mode]').forEach((button) => { button.onclick = () => startSpeakingRoom(button.dataset.speakingRoomMode); });
  const writingRoomText = document.getElementById('writingRoomText'); if (writingRoomText) writingRoomText.oninput = () => { state.writingRoom.draft = writingRoomText.value; const character = document.getElementById('writingRoomCharacterCount'); const words = document.getElementById('writingRoomWordCount'); if (character) character.textContent = `${writingRoomText.value.length} ký tự`; if (words) words.textContent = `${writingRoomText.value.trim() ? writingRoomText.value.trim().split(/\s+/).length : 0} từ`; saveWritingRoomDraft(); };
  const writingRoomForm = document.getElementById('writingRoomForm'); if (writingRoomForm) writingRoomForm.onsubmit = (event) => { state.writingRoom.draft = writingRoomText?.value || ''; saveWritingRoomDraft(); submitWriting(event); };
  const writingReset = document.querySelector('[data-writing-reset]'); if (writingReset) writingReset.onclick = resetWritingRoom;
  const writingSaveError = document.querySelector('[data-writing-save-error]'); if (writingSaveError) writingSaveError.onclick = () => { const result = state.writingSubmission; if (result) { window.ErrorNotebookService?.add?.({ type: 'writing', question: state.writingPrompt?.prompt || result.topic, mistake: result.answer, correction: result.sampleAnswer, explanation: result.tipsVi }); toast('Đã lưu lỗi viết vào Sổ lỗi.'); } };
  clearInterval(state.roomTimer); state.roomTimer = null;
  if (state.currentView === 'writing-room' || state.currentView === 'topik-exam') { state.roomTimer = setInterval(() => { const deadline = state.currentView === 'writing-room' ? state.writingRoom.deadlineAt : state.examSession?.deadlineAt; if (!deadline) return; if (new Date(deadline).getTime() <= Date.now()) { clearInterval(state.roomTimer); state.roomTimer = null; if (state.currentView === 'topik-exam') finishTopikExam(); else toast('Hết giờ. Hãy nộp bài viết.'); return; } const timer = document.getElementById(state.currentView === 'writing-room' ? 'writingTimer' : 'examTimer'); if (timer) { const remaining = Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000); timer.textContent = `⏱ ${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}`; } }, 1000); }
  document.querySelectorAll('[data-lesson-next]').forEach((button) => { button.onclick = () => { state.lessonStep = Math.min(6, (Number(state.lessonStep) || 0) + 1); render(); }; });
  document.querySelectorAll('[data-lesson-prev]').forEach((button) => { button.onclick = () => { state.lessonStep = Math.max(0, (Number(state.lessonStep) || 0) - 1); render(); }; });
  document.querySelectorAll('[data-lesson-choice]').forEach((button) => { button.onclick = () => { const key = button.dataset.lessonChoice; const answer = button.dataset.answer; const correct = (key === 'location' && answer === '에') || (key === 'past' && answer === '만났어요'); state.lessonCheck = { key, answer, correct }; render(); }; });
  document.querySelectorAll('[data-speak]').forEach((button) => { button.onclick = (event) => { event.stopPropagation(); speakKorean(button.dataset.speak); }; });
  document.querySelectorAll('[data-context-word]').forEach((button) => { button.onclick = (event) => { event.stopPropagation(); state.contextDictionaryTerm = button.dataset.contextWord; renderContextDictionary(); }; });
  const contextRoot = document.getElementById('contextDictionaryRoot'); if (contextRoot) contextRoot.onclick = (event) => { const close = event.target.closest('[data-context-close]'); if (close) return closeContextDictionary(); const speak = event.target.closest('[data-context-speak]'); if (speak) return speakKorean(speak.dataset.contextSpeak); const favorite = event.target.closest('[data-context-favorite]'); if (favorite) { DictionaryService.toggleFavorite(favorite.dataset.contextFavorite); return renderContextDictionary(); } const srs = event.target.closest('[data-context-srs]'); if (srs) { DictionaryService.addToSrs(DictionaryService.byId(srs.dataset.contextSrs)); toast('Đã thêm vào bộ ôn tập.'); return; } const open = event.target.closest('[data-context-open-dictionary]'); if (open) { state.dictionarySelectedId = open.dataset.contextOpenDictionary; closeContextDictionary(); return setView('dictionary'); } const ask = event.target.closest('[data-context-ask-ai]'); if (ask) { closeContextDictionary(); state.aiOpen = true; renderAiWidget(); return; } };
  document.querySelectorAll('[data-romanization-toggle]').forEach((button) => { button.onclick = () => { setShowRomanization(!showRomanizationEnabled()); render(); }; });
  document.querySelectorAll('[data-theme-choice]').forEach((input) => { input.onchange = () => { ThemeService.setPreference(input.value); render(); }; });
  document.querySelectorAll('[data-theme-choice-header]').forEach((input) => { input.onclick = () => { ThemeService.setPreference(input.dataset.themeChoiceHeader); document.getElementById('themeMenu')?.classList.add('hidden'); render(); }; });
  document.querySelectorAll('[data-language-choice]').forEach((input) => { input.onclick = () => { I18nService.setPreference(input.dataset.languageChoice || input.value); document.getElementById('languageMenu')?.classList.add('hidden'); render(); }; });
  const languageBtn = document.getElementById('languageBtn'); if (languageBtn) languageBtn.onclick = () => { const menu = document.getElementById('languageMenu'); const open = menu?.classList.toggle('hidden') === false; document.getElementById('themeMenu')?.classList.add('hidden'); languageBtn.setAttribute('aria-expanded', String(open)); };
  const globalSearchButton = document.getElementById('globalSearchButton'); if (globalSearchButton) globalSearchButton.onclick = () => setView('search');
  document.querySelectorAll('[data-notification-pref]').forEach((input) => { input.onchange = () => NotificationService.set(input.dataset.notificationPref, input.checked); });
  const themeBtn = document.getElementById('themeBtn'); if (themeBtn) themeBtn.onclick = () => { const menu = document.getElementById('themeMenu'); const open = menu?.classList.toggle('hidden') === false; document.getElementById('languageMenu')?.classList.add('hidden'); themeBtn.setAttribute('aria-expanded', String(open)); };
  document.querySelectorAll('[data-question-romanization]').forEach((button) => { button.onclick = () => { const id = button.dataset.questionRomanization; state.questionRomanization[id] = !(state.questionRomanization[id] ?? showRomanizationEnabled()); render(); }; });
  const registerForm = document.getElementById('registerForm'); if (registerForm) registerForm.onsubmit = handleRegister;
  const loginForm = document.getElementById('loginForm'); if (loginForm) loginForm.onsubmit = handleLogin;
  const cloudLoginButton = document.getElementById('cloudLoginButton'); if (cloudLoginButton) cloudLoginButton.onclick = async () => { const form = new FormData(loginForm); showFormError(''); try { await CloudAccountService.signIn(normalizeEmail(form.get('email')), String(form.get('password') || ''), false); setView('home'); } catch (error) { showFormError(error.message); } };
  const cloudRegisterButton = document.getElementById('cloudRegisterButton'); if (cloudRegisterButton) cloudRegisterButton.onclick = async () => { const form = new FormData(registerForm); showFormError(''); try { const result = await CloudAccountService.signUp(normalizeEmail(form.get('email')), String(form.get('password') || ''), false); if (result.confirmationRequired) { showFormError(state.cloudAuthMessage); return; } setView('home'); } catch (error) { showFormError(error.message); } };
  const cloudConnectForm = document.getElementById('cloudConnectForm'); if (cloudConnectForm) cloudConnectForm.onsubmit = async (event) => { event.preventDefault(); const form = new FormData(cloudConnectForm); state.cloudAuthMessage = ''; try { if (event.submitter?.value === 'signup') await CloudAccountService.signUp(normalizeEmail(form.get('email')), String(form.get('password') || ''), true); else await CloudAccountService.signIn(normalizeEmail(form.get('email')), String(form.get('password') || ''), true); render(); } catch (error) { state.cloudAuthMessage = error.message; render(); } };
  const syncNowButton = document.getElementById('syncNowButton'); if (syncNowButton) syncNowButton.onclick = async () => { await CloudSyncService.flush('manual'); render(); };
  const cloudSignOutButton = document.getElementById('cloudSignOutButton'); if (cloudSignOutButton) cloudSignOutButton.onclick = () => CloudAccountService.signOut();
  const editForm = document.getElementById('editProfileForm'); if (editForm) editForm.onsubmit = handleEditProfile;
  const forgot = document.getElementById('forgotPassword'); if (forgot) forgot.onclick = () => toast('Khôi phục mật khẩu cần backend. Với MVP, hãy đăng ký tài khoản mới trên thiết bị này.');
  document.querySelectorAll('[data-goal]').forEach((button) => { button.onclick = () => toggleGoal(button.dataset.goal); });
  const goalsContinue = document.getElementById('goalsContinue'); if (goalsContinue) goalsContinue.onclick = continueGoals;
  document.querySelectorAll('[data-level-choice]').forEach((button) => { button.onclick = () => selectLevelChoice(button.dataset.levelChoice); });
  document.querySelectorAll('[data-level-result]').forEach((button) => { button.onclick = () => { state.selectedLevel = button.dataset.levelResult; render(); }; });
  const levelContinue = document.getElementById('levelContinue'); if (levelContinue) levelContinue.onclick = continueLevel;
  document.querySelectorAll('[data-test-answer]').forEach((button) => { button.onclick = () => answerPlacement(Number(button.dataset.testAnswer)); });
  const finishOnboarding = document.getElementById('finishOnboarding'); if (finishOnboarding) finishOnboarding.onclick = completeOnboarding;
  if (state.currentView === 'lesson' && document.getElementById('dropZone') && document.getElementById('chipBox')) setupSentenceExercise();
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
  document.querySelectorAll('[data-retry-set]').forEach((button) => { button.onclick = () => { if (!PracticeService.startSet(button.dataset.retrySet) && state.practiceResult?.questions?.length) PracticeService.startQuestions(state.practiceResult.questions, `Làm lại · ${state.practiceResult.set.title}`, 'retry'); }; });
  const quickPracticeForm = document.getElementById('quickPracticeForm'); if (quickPracticeForm) quickPracticeForm.onsubmit = startQuickPractice;
  document.querySelectorAll('[data-hub-view]').forEach((button) => { button.onclick = () => openPracticeHubDestination(button.dataset.hubView, button.dataset.hubValue); });
  document.querySelectorAll('[data-full-exam]').forEach((button) => { button.onclick = () => startTopikExam(); });
  document.querySelectorAll('[data-recommended-set]').forEach((button) => { button.onclick = () => { const set = PracticeService.bank.sets.find((item) => item.level === button.dataset.recommendedSet); if (set) PracticeService.startSet(set.id); }; });
  document.querySelectorAll('[data-save-set]').forEach((button) => { button.onclick = () => { PracticeService.toggleSaved(button.dataset.saveSet); toast(PracticeService.isSaved(button.dataset.saveSet) ? 'Đã lưu đề.' : 'Đã bỏ lưu đề.'); render(); }; });
  const practiceSearch = document.getElementById('practiceSearch'); if (practiceSearch) practiceSearch.oninput = () => { state.practiceSearch = practiceSearch.value; state.practiceFilters.page = 1; clearTimeout(practiceSearch._timer); practiceSearch._timer = setTimeout(render, 180); };
  const randomExamForm = document.getElementById('randomExamForm'); if (randomExamForm) randomExamForm.onsubmit = startRandomExam;
  const wrongPracticeForm = document.getElementById('wrongPracticeForm'); if (wrongPracticeForm) wrongPracticeForm.onsubmit = startWrongPractice;
  document.querySelectorAll('[data-view-attempt]').forEach((button) => { button.onclick = () => viewPracticeAttempt(button.dataset.viewAttempt); });
  document.querySelectorAll('[data-retry-history]').forEach((button) => { button.onclick = () => retryPracticeAttempt(button.dataset.retryHistory); });
  document.querySelectorAll('[data-open-skill]').forEach((button) => { button.onclick = () => { state.selectedSkillHub = button.dataset.openSkill; setView(button.dataset.view || 'skill-hub'); }; });
  document.querySelectorAll('[data-skill-level]').forEach((button) => { button.onclick = () => { const set = PracticeService.bank.sets.find((item) => item.level === `TOPIK_${button.dataset.skillLevel}` && item.skill === state.selectedSkillHub); if (set) PracticeService.startSet(set.id); else toast('Không tìm thấy đề phù hợp.'); }; });
  document.querySelectorAll('[data-vocab-filter]').forEach((select) => { select.onchange = () => { state.vocabularyFilters[select.dataset.vocabFilter] = select.value; state.vocabularyFilters.page = 1; render(); }; });
  const vocabularySearch = document.getElementById('vocabularySearch'); if (vocabularySearch) vocabularySearch.oninput = () => { state.vocabularyFilters.search = vocabularySearch.value; state.vocabularyFilters.page = 1; clearTimeout(vocabularySearch._timer); vocabularySearch._timer = setTimeout(render, 180); };
  document.querySelectorAll('[data-vocab-page]').forEach((button) => { button.onclick = () => { state.vocabularyFilters.page = Number(button.dataset.vocabPage); render(); }; });
  document.querySelectorAll('[data-practice-answer]').forEach((button) => { button.onclick = () => selectPracticeAnswer(button.dataset.practiceAnswer); });
  const checkPracticeAnswer = document.getElementById('checkPracticeAnswer'); if (checkPracticeAnswer) checkPracticeAnswer.onclick = checkPractice;
  const nextPracticeQuestion = document.getElementById('nextPracticeQuestion'); if (nextPracticeQuestion) nextPracticeQuestion.onclick = nextPractice;
  const leavePractice = document.getElementById('leavePractice'); if (leavePractice) leavePractice.onclick = leavePracticeSession;
  document.querySelectorAll('[data-review-count]').forEach((button) => { button.onclick = () => { state.reviewSelectionCount = Number(button.dataset.reviewCount); render(); }; });
  const customReviewCount = document.getElementById('customReviewCount'); if (customReviewCount) customReviewCount.onchange = () => { state.reviewSelectionCount = Math.max(1, Math.min(reviewEligibleCards().length, Number(customReviewCount.value) || 1)); render(); };
  const reviewSource = document.getElementById('reviewSource'); if (reviewSource) reviewSource.onchange = () => { state.reviewSource = reviewSource.value; state.reviewSelectionCount = 10; render(); };
  const reviewTopic = document.getElementById('reviewTopic'); if (reviewTopic) reviewTopic.onchange = () => { state.reviewTopic = reviewTopic.value; render(); };
  const resetReviewSource = document.getElementById('resetReviewSource'); if (resetReviewSource) resetReviewSource.onclick = () => { state.reviewSource = 'due'; state.reviewTopic = 'all'; render(); };
  document.querySelectorAll('[data-review-mode]').forEach((button) => { button.onclick = () => startReviewMode(button.dataset.reviewMode); });
  document.querySelectorAll('[data-pretest-answer]').forEach((button) => { button.onclick = () => answerVocabularyPretest(button.dataset.pretestAnswer); });
  document.querySelectorAll('[data-pretest-decision]').forEach((button) => { button.onclick = () => decideVocabularyPretest(button.dataset.pretestDecision); });
  document.querySelectorAll('[data-pretest-summary]').forEach((button) => { button.onclick = () => startReviewFromPretest(button.dataset.pretestSummary); });
  const vocabularyTestForm = document.getElementById('vocabularyTestForm'); if (vocabularyTestForm) vocabularyTestForm.onsubmit = startVocabularyTest;
  document.querySelectorAll('[data-vocab-test-answer]').forEach((button) => { button.onclick = () => answerVocabularyTest(button.dataset.vocabTestAnswer); });
  const nextVocabularyTest = document.getElementById('nextVocabularyTest'); if (nextVocabularyTest) nextVocabularyTest.onclick = advanceVocabularyTest;
  const addWrongToReview = document.getElementById('addWrongToReview'); if (addWrongToReview) addWrongToReview.onclick = addWrongVocabularyToReview;
  document.querySelectorAll('[data-speaking-mode]').forEach((button) => { button.onclick = () => startSpeaking(button.dataset.speakingMode); });
  document.querySelectorAll('[data-roleplay]').forEach((button) => { button.onclick = () => startRoleplay(button.dataset.roleplay); });
  const roleplayHintToggle = document.getElementById('roleplayHintToggle'); if (roleplayHintToggle) roleplayHintToggle.onclick = () => { state.roleplayHintVisible = !state.roleplayHintVisible; render(); };
  document.querySelectorAll('[data-speak-rate]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.speakText, Number(button.dataset.speakRate)); });
  const speakingFallbackForm = document.getElementById('speakingFallbackForm'); if (speakingFallbackForm) speakingFallbackForm.onsubmit = submitSpeakingFallback;
  const speakingComplete = document.getElementById('speakingComplete'); if (speakingComplete) speakingComplete.onclick = completeSpeakingSession;
  const repeatSpeaking = document.querySelector('[data-repeat-speaking]'); if (repeatSpeaking) repeatSpeaking.onclick = () => { state.speakingResult = null; setView('speaking-session'); };
  document.querySelectorAll('[data-writing-level]').forEach((button) => { button.onclick = () => { state.writingLevel = Number(button.dataset.writingLevel); state.writingSubmission = null; render(); }; });
  document.querySelectorAll('[data-writing-mode]').forEach((button) => { button.onclick = () => { state.writingMode = button.dataset.writingMode; const prompts = window.KLEARN_MODULE_DATA?.writingPrompts || []; const prompt = prompts.find((item) => item.type === state.writingMode && item.level === state.writingLevel) || prompts.find((item) => item.type === state.writingMode); if (prompt) startWritingRoom(prompt.id); else toast('Chưa có đề phù hợp cho mode này.'); }; });
  document.querySelectorAll('[data-writing-prompt]').forEach((button) => { button.onclick = () => startWritingRoom(button.dataset.writingPrompt); });
  const writingText = document.getElementById('writingText'); if (writingText) writingText.oninput = updateWritingCounter;
  const writingForm = document.getElementById('writingForm'); if (writingForm) writingForm.onsubmit = submitWriting;
  const rewrite = document.querySelector('[data-rewrite]'); if (rewrite) rewrite.onclick = () => { state.writingSubmission = null; setView('writing-editor'); };
  const micButton = document.getElementById('micBtn'); if (micButton) micButton.onclick = toggleRecording;
  const practiceNext = document.getElementById('practiceNext'); if (practiceNext) practiceNext.onclick = completePractice;
  const globalSearchForm = document.getElementById('globalSearchForm'); if (globalSearchForm) globalSearchForm.onsubmit = (event) => { event.preventDefault(); state.globalQuery = String(new FormData(globalSearchForm).get('query') || document.getElementById('globalSearchInput')?.value || '').trim(); render(); };
  document.querySelectorAll('[data-smart-minutes]').forEach((button) => { button.onclick = () => { state.smartReviewMinutes = Number(button.dataset.smartMinutes); render(); }; });
  document.querySelectorAll('[data-start-smart-review]').forEach((button) => { button.onclick = () => SmartReviewService.start(Number(button.dataset.startSmartReview)); });
  document.querySelectorAll('[data-open-ai]').forEach((button) => button.addEventListener('click', () => { state.aiOpen = true; const conversation = AITutorService.ensure(); state.aiConversationId = conversation.id; renderAiWidget(); const input = document.getElementById('aiInput'); if (input) { input.value = button.dataset.openAi || ''; input.focus(); } }));
  document.querySelectorAll('[data-dictionary-id]').forEach((button) => { button.onclick = () => { state.dictionarySelectedId = button.dataset.dictionaryId; const entry = DictionaryService.byId(state.dictionarySelectedId); DictionaryService.addRecent(entry); render(); }; });
  document.querySelectorAll('[data-translate-seed]').forEach((button) => { button.onclick = () => { state.translationDraft = button.dataset.translateSeed || ''; state.translationDirection = 'ko-vi'; setView('translation-hub'); }; });
  const dictionarySearchForm = document.getElementById('dictionarySearchForm'); if (dictionarySearchForm) dictionarySearchForm.onsubmit = (event) => { event.preventDefault(); state.dictionaryQuery = String(new FormData(dictionarySearchForm).get('query') || '').trim(); state.dictionarySelectedId = ''; render(); };
  const dictionaryPos = document.getElementById('dictionaryPos'); if (dictionaryPos) dictionaryPos.onchange = () => { state.dictionaryFilter = dictionaryPos.value; render(); };
  document.querySelectorAll('[data-toggle-favorite]').forEach((button) => { button.onclick = () => { DictionaryService.toggleFavorite(button.dataset.toggleFavorite); render(); }; });
  document.querySelectorAll('[data-add-srs]').forEach((button) => { button.onclick = () => { DictionaryService.addToSrs(DictionaryService.byId(button.dataset.addSrs)); toast('Đã thêm vào bộ ôn tập.'); }; });
  const translationForm = document.getElementById('translationForm'); if (translationForm) translationForm.onsubmit = (event) => { event.preventDefault(); const form = new FormData(translationForm); const direction = document.getElementById('translationDirection')?.value || 'vi-ko'; state.translationDirection = direction; state.translationDraft = String(form.get('text') || ''); state.translationResult = TranslationService.translate({ text: state.translationDraft, sourceLanguage: direction === 'vi-ko' ? 'vi' : 'ko', targetLanguage: direction === 'vi-ko' ? 'ko' : 'vi', context: form.get('context'), register: form.get('register') }); TranslationService.saveHistory(state.translationResult); render(); };
  const translationDirection = document.getElementById('translationDirection'); if (translationDirection) translationDirection.onchange = () => { state.translationDirection = translationDirection.value; render(); };
  const swapTranslation = document.getElementById('swapTranslation'); if (swapTranslation) swapTranslation.onclick = () => { state.translationDirection = state.translationDirection === 'vi-ko' ? 'ko-vi' : 'vi-ko'; render(); };
  const copyTranslation = document.getElementById('copyTranslation'); if (copyTranslation) copyTranslation.onclick = async () => { const text = state.translationResult?.korean || ''; try { await navigator.clipboard.writeText(text); toast('Đã sao chép tiếng Hàn.'); } catch (_) { const area = document.createElement('textarea'); area.value = text; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); toast('Đã sao chép tiếng Hàn.'); } };
  const saveTranslation = document.getElementById('saveTranslation'); if (saveTranslation) saveTranslation.onclick = () => { SavedSentenceService.save(state.translationResult); toast('Đã lưu câu.'); };
  const practiceTranslation = document.getElementById('practiceTranslation'); if (practiceTranslation) practiceTranslation.onclick = () => { if (state.translationResult?.korean) { state.speakingPrompt = { id: 'translation-result', korean: state.translationResult.korean, label: 'Câu dịch', meaningVi: state.translationResult.translation }; setView('speaking-session'); } };
  const logoutButton = document.getElementById('logoutButton'); if (logoutButton) logoutButton.onclick = async () => { if (state.cloudUser) { try { await window.AuthService?.signOut?.(); } catch (_) { /* Local sign-out must still work during an outage. */ } } auth.logout(); };
  const handwritingCanvas = document.getElementById('handwritingCanvas'); if (handwritingCanvas) setupHandwritingCanvas(handwritingCanvas);
  const handwritingCharacter = document.getElementById('handwritingCharacter'); if (handwritingCharacter) handwritingCharacter.onchange = () => { state.handwritingCharacter = handwritingCharacter.value; state.handwritingStage = 1; render(); };
  const handwritingClear = document.getElementById('handwritingClear'); if (handwritingClear) handwritingClear.onclick = () => handwritingCanvas?._clear?.();
  const handwritingUndo = document.getElementById('handwritingUndo'); if (handwritingUndo) handwritingUndo.onclick = () => handwritingCanvas?._undo?.();
  const handwritingRetry = document.getElementById('handwritingRetry'); if (handwritingRetry) handwritingRetry.onclick = () => { state.handwritingStage = 1; render(); };
  const handwritingNext = document.getElementById('handwritingNext'); if (handwritingNext) handwritingNext.onclick = () => { const all = storage.get(STORAGE_KEYS.handwriting, {}); const list = Array.isArray(all?.[state.currentUser?.id]) ? all[state.currentUser.id] : []; const current = list.find((item) => item.character === state.handwritingCharacter) || { character: state.handwritingCharacter, attempts: 0, stage: 0, strokes: 0 }; const evaluated = HandwritingProvider.evaluate({ strokes: current.strokes, stage: state.handwritingStage }); const next = { ...current, attempts: current.attempts + 1, strokes: current.strokes + 1, stage: Math.min(3, state.handwritingStage), masteryScore: Math.max(current.masteryScore || 0, evaluated.score), masteryStatus: state.handwritingStage >= 3 ? 'mastered' : 'learning', completed: state.handwritingStage >= 3, lastPracticed: new Date().toISOString(), updatedAt: new Date().toISOString() }; saveUserScoped(STORAGE_KEYS.handwriting, [next, ...list.filter((item) => item.character !== next.character)], 100); state.handwritingStage = Math.min(3, state.handwritingStage + 1); if (next.completed) { toast('Đã hoàn thành chữ này.'); window.BeginnerFoundation?.recordHandwriting?.(next.character); } render(); };
}

function setupHandwritingCanvas(canvas) {
  const ctx = canvas.getContext('2d'); if (!ctx) return; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--primary') || '#315875'; const history = []; canvas._history = history; canvas._clear = () => { ctx.clearRect(0, 0, canvas.width, canvas.height); history.length = 0; }; canvas._undo = () => { const snapshot = history.pop(); if (snapshot) ctx.putImageData(snapshot, 0, 0); else ctx.clearRect(0, 0, canvas.width, canvas.height); }; let drawing = false; let last = null; const point = (event) => { const rect = canvas.getBoundingClientRect(); return { x: (event.clientX - rect.left) * canvas.width / rect.width, y: (event.clientY - rect.top) * canvas.height / rect.height }; }; canvas.addEventListener('pointerdown', (event) => { drawing = true; history.push(ctx.getImageData(0, 0, canvas.width, canvas.height)); if (history.length > 20) history.shift(); canvas.setPointerCapture(event.pointerId); last = point(event); }); canvas.addEventListener('pointermove', (event) => { if (!drawing) return; const next = point(event); ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(next.x, next.y); ctx.stroke(); last = next; }); ['pointerup','pointercancel','pointerleave'].forEach((name) => canvas.addEventListener(name, () => { drawing = false; last = null; }));
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
    state.selectedOnboardingPath = '';
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
    state.selectedOnboardingPath = APP_DATA.levelChoices.find((choice) => choice.level === state.selectedLevel)?.id || '';
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
  if (!choice) return;
  state.selectedLevel = choice.level;
  state.selectedOnboardingPath = choice.id;
  render();
}

function continueLevel() {
  if (!state.selectedLevel || !state.selectedOnboardingPath) return setFormError('Hãy chọn trình độ hoặc phương án kiểm tra phù hợp.');
  if (state.selectedOnboardingPath === 'placement') {
    const existing = state.currentUser.placement || { index: 0, answers: [], score: 0 };
    persistOnboarding('placement', { learningTrack: 'topik', placement: existing.index >= 10 ? { index: 0, answers: [], score: 0 } : existing });
    setView('placement');
    return;
  }
  if (state.selectedOnboardingPath === 'beginner-placement') {
    persistOnboarding('beginner-placement', { beginnerPlacement: { index: 0, answers: [], score: 0 } });
    setView('beginner-placement');
    return;
  }
  const foundationEntry = state.selectedOnboardingPath === 'foundation-reading' ? 'reading-first' : 'hangul-academy';
  persistOnboarding('result', { level: state.selectedLevel, learningTrack: 'foundation', foundationLevel: 0, foundationEntry });
  setView('onboarding-result');
}

function placementLevel(score) {
  if (score <= 5) return 'Beginner';
  if (score <= 9) return 'TOPIK I';
  if (score <= 12) return 'TOPIK I nâng cao';
  return 'TOPIK II khởi đầu';
}

function answerPlacement(answerIndex) {
  const placement = { ...(state.currentUser.placement || { index: 0, answers: [], score: 0 }) };
  if (!Array.isArray(placement.questionIds) || !placement.questionIds.length) placement.questionIds = [4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 0, 1];
  const { question, questionId, total } = placementQuestionAt(placement);
  if (!question) return;
  placement.answers = [...(placement.answers || []), answerIndex];
  placement.questionIdsAsked = [...(placement.questionIdsAsked || []), questionId];
  if (answerIndex === question.answer) placement.score = (placement.score || 0) + 1;
  placement.index += 1;
  const remaining = placement.questionIds.filter((id) => !(placement.questionIdsAsked || []).includes(id));
  if (placement.index >= total || !remaining.length) {
    const level = placementLevel(placement.score);
    state.selectedLevel = level;
    persistOnboarding('result', { level, placement });
    setView('onboarding-result');
  } else {
    const targetDifficulty = Math.max(1, Math.min(4, (question.difficulty || 2) + (answerIndex === question.answer ? 1 : -1)));
    const next = remaining.slice().sort((a, b) => Math.abs((APP_DATA.placementQuestions[a].difficulty || 2) - targetDifficulty) - Math.abs((APP_DATA.placementQuestions[b].difficulty || 2) - targetDifficulty))[0];
    placement.questionIds = placement.questionIds.filter((id, idx) => idx <= placement.index || id !== next).slice(0, total);
    placement.questionIds.splice(placement.index, 0, next);
    updateCurrentUser({ onboardingStep: 'placement', placement });
    render();
  }
}

function completeOnboarding() {
  const foundation = state.currentUser.learningTrack === 'foundation';
  const currentTopikLevel = foundation ? 1 : inferredTopikLevel(state.currentUser.level || state.selectedLevel);
  updateCurrentUser({ onboardingCompleted: true, onboardingStep: 'completed', currentTopikLevel, targetTopikLevel: foundation ? 1 : Math.min(6, currentTopikLevel + 1) });
  syncUserData();
  toast('Lộ trình cá nhân đã được tạo!');
  setView('home');
}

function handleEditProfile(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const fullName = String(form.get('fullName') || '').trim();
  const level = String(form.get('level') || '');
  const currentTopikLevel = Number(form.get('currentTopikLevel')) || inferredTopikLevel(level);
  const targetTopikLevel = Math.max(currentTopikLevel, Number(form.get('targetTopikLevel')) || currentTopikLevel);
  if (!fullName) return setFormError('Họ tên không được để trống.');
  updateCurrentUser({ fullName, avatar: initials(fullName), level, currentTopikLevel, targetTopikLevel });
  toast('Đã cập nhật hồ sơ.');
  setView('profile');
}

// ============================================================
// Practice bank and vocabulary assessment handlers
// ============================================================
function openPracticeHubDestination(view, value) {
  if (view === 'exam-catalog' && value) state.practiceFilters = { ...state.practiceFilters, level: value, page: 1 };
  if (view === 'skill-hub' && value) state.selectedSkillHub = value;
  if (view === 'topik-exam') return startTopikExam();
  if (view === 'listening-studio') { state.listeningStudio.mode = 'listen'; return setView(view); }
  if (view === 'speaking-room') return setView(view);
  setView(view);
}

function startRandomExam(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const skill = String(form.get('skill') || 'mixed');
  const chosenLevel = String(form.get('level')) === 'current' ? state.currentUser.currentTopikLevel : Number(String(form.get('level')).slice(-1));
  if (skill === 'writing') {
    const prompts = window.KLEARN_MODULE_DATA?.writingPrompts?.filter((prompt) => prompt.level === chosenLevel) || [];
    if (prompts.length) return startWriting(sampleItems(prompts, 1)[0].id);
  }
  if (skill === 'speaking') {
    const modes = window.KLEARN_MODULE_DATA?.speakingModes || [];
    return startSpeaking(sampleItems(modes, 1)[0]?.id || 'sentence');
  }
  PracticeService.startRandom({ level: String(form.get('level')), count: Number(form.get('count')) || 20, skill, difficulty: String(form.get('difficulty') || 'mixed') });
}

function startWrongPractice(event) {
  event.preventDefault();
  const count = Number(new FormData(event.currentTarget).get('count')) || 10;
  const meta = PracticeService.getMeta();
  const ids = [...new Set(PracticeService.getHistory().flatMap((attempt) => attempt.wrongQuestionIds || []))]
    .sort((a, b) => (meta.wrongPriorities?.[b] || 0) - (meta.wrongPriorities?.[a] || 0));
  const questions = ids.map((id) => PracticeService.bank.getQuestion(id)).filter(Boolean).slice(0, count);
  if (!PracticeService.startQuestions(questions, 'Luyện lại câu sai', 'wrong')) toast('Các câu cũ không còn trong ngân hàng hiện tại.');
}

function viewPracticeAttempt(attemptId) {
  const attempt = PracticeService.getHistory().find((item) => item.id === attemptId);
  if (!attempt) return;
  const questions = attempt.answers.map((answer) => PracticeService.bank.getQuestion(answer.questionId)).filter(Boolean);
  const set = PracticeService.bank.sets.find((item) => item.id === attempt.setId) || { id: attempt.setId, title: attempt.setTitle, level: attempt.level || 'Practice' };
  state.practiceResult = { attempt, questions, set };
  setView('practice-result');
}

function retryPracticeAttempt(attemptId) {
  const attempt = PracticeService.getHistory().find((item) => item.id === attemptId);
  if (!attempt) return;
  if (PracticeService.bank.sets.some((set) => set.id === attempt.setId)) return PracticeService.startSet(attempt.setId, attempt.total);
  const questions = attempt.answers.map((answer) => PracticeService.bank.getQuestion(answer.questionId)).filter(Boolean);
  PracticeService.startQuestions(questions, `Làm lại · ${attempt.setTitle}`, 'retry');
}

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
  const eligible = reviewEligibleCards();
  const limit = Math.max(1, Math.min(state.reviewSelectionCount, eligible.length));
  return [...eligible]
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
  if (decision === 'mastered' && latestCard) VocabularyService.markMastered(latestCard);
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
  if (!session || session.index >= session.cardIds.length || session.currentResult) return;
  const card = state.srsData.find((item) => item.wordId === session.cardIds[session.index]);
  const correct = response === session.currentQuestion.correct;
  VocabularyService.pretestResult(card, correct, response);
  session.currentResult = { wordId: card.wordId, response, correct, correctAnswer: session.currentQuestion.correct, testedAt: new Date().toISOString() };
  render();
}

function advanceVocabularyTest() {
  const session = state.vocabularyTest;
  if (!session?.currentResult) return;
  session.results.push(session.currentResult);
  session.index += 1;
  session.currentQuestion = null;
  session.currentResult = null;
  if (session.index >= session.cardIds.length) setView('vocab-test-result');
  else render();
}

function addWrongVocabularyToReview() {
  const wrongIds = state.vocabularyTest?.results?.filter((result) => !result.correct).map((result) => result.wordId) || [];
  beginReviewSession(wrongIds);
}

function startSpeaking(modeId) {
  state.speakingMode = modeId;
  state.speakingPrompt = modeId === 'roleplay' ? window.KLEARN_MODULE_DATA?.roleplays?.[0] : window.KLEARN_MODULE_DATA?.speakingModes?.find((mode) => mode.id === modeId) || null;
  state.speakingResult = null;
  state.pronunciationResult = null;
  state.roleplayHintVisible = false;
  setView('speaking-session');
}

function startRoleplay(roleplayId) {
  state.speakingMode = 'roleplay';
  state.speakingPrompt = window.KLEARN_MODULE_DATA?.roleplays?.find((role) => role.id === roleplayId) || null;
  state.speakingResult = null;
  state.roleplayHintVisible = false;
  setView('speaking-session');
}

const HANGUL_INITIALS = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
const HANGUL_VOWELS = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
const HANGUL_FINALS = ['', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
function decomposeHangulBlock(character = '') { const code = character.charCodeAt(0) - 0xAC00; if (code < 0 || code > 11171) return null; return { initial: HANGUL_INITIALS[Math.floor(code / 588)], vowel: HANGUL_VOWELS[Math.floor((code % 588) / 28)], final: HANGUL_FINALS[code % 28] }; }
function pronunciationBreakdown(target = '', transcript = '') {
  const expected = [...String(target).normalize('NFC')].filter((char) => /[가-힣]/.test(char)); const actual = [...String(transcript).normalize('NFC')].filter((char) => /[가-힣]/.test(char));
  const segments = expected.map((syllable, index) => { const heard = actual[index] || ''; if (syllable === heard) return { syllable, heard, status: 'correct', score: 100, focus: [] }; const wanted = decomposeHangulBlock(syllable); const got = decomposeHangulBlock(heard); const focus = !got ? [wanted?.vowel || wanted?.initial].filter(Boolean) : [wanted.initial !== got.initial ? wanted.initial : '', wanted.vowel !== got.vowel ? wanted.vowel : '', wanted.final !== got.final ? wanted.final : ''].filter(Boolean); const matches = got ? ['initial','vowel','final'].filter((key) => wanted[key] === got[key]).length : 0; return { syllable, heard: heard || '—', status: matches >= 2 ? 'close' : 'retry', score: Math.round(matches / 3 * 100), focus }; });
  return { segments, focusSounds: [...new Set(segments.flatMap((item) => item.focus))].slice(0, 6), method: 'speech-recognition-text-comparison' };
}

const PronunciationProvider = {
  id: 'text-similarity-mvp',
  evaluate({ target = '', transcript = '', keywords = [], roleplay = false } = {}) {
    if (roleplay) { const normalized = normalizeKorean(transcript); const matched = keywords.filter((keyword) => normalized.includes(normalizeKorean(keyword))).length; return { score: Math.round((matched / Math.max(1, keywords.length)) * 100), matched }; }
    return { score: similarityScore(target, transcript), breakdown: pronunciationBreakdown(target, transcript) };
  }
};
window.PronunciationProvider = PronunciationProvider;

function speakingEvaluation(transcript) {
  const prompt = state.speakingPrompt;
  if (!prompt) return { score: 0, feedback: 'Chưa có câu mẫu.' };
  if (state.speakingMode === 'roleplay') {
    const evaluated = PronunciationProvider.evaluate({ transcript, keywords: prompt.keywords || [], roleplay: true });
    const matched = evaluated.matched;
    const score = evaluated.score;
    return { score, feedback: matched ? `Đã dùng ${matched}/${prompt.keywords.length} từ khóa gợi ý.` : 'Hãy thử dùng một trong các từ khóa gợi ý để phản hồi đúng tình huống.' };
  }
  const evaluated = PronunciationProvider.evaluate({ target: prompt.korean, transcript }); const score = evaluated.score;
  return { ...evaluated, feedback: score >= 90 ? 'Văn bản nhận diện rất gần câu mẫu.' : score >= 70 ? 'Khá tốt; hãy chú ý các âm được đánh dấu rồi thử lại.' : 'Hãy nói chậm, rõ từng âm tiết rồi nghe lại câu mẫu.' };
}

function saveSpeakingAttempt(transcript) {
  const evaluation = speakingEvaluation(transcript);
  const result = { id: uniqueId(), mode: state.speakingMode, target: state.speakingPrompt?.korean || state.speakingPrompt?.appLine || '', transcript, ...evaluation, createdAt: new Date().toISOString() };
  if (evaluation.score < 85) window.ErrorNotebookService?.add?.({ type: 'speaking', question: result.target, mistake: result.transcript, correction: result.target, explanation: result.feedback });
  (evaluation.breakdown?.focusSounds || []).forEach((sound) => window.LearningMemoryService?.upsert?.({ type: 'weak_knowledge', topic: `pronunciation:${sound}`, content: `Cần luyện lại âm ${sound}`, confidence: .72, importance: 3, source: 'pronunciation-breakdown' }, { increment: true }));
  state.speakingResult = result;
  state.pronunciationResult = result;
  const allSpeaking = storage.get(STORAGE_KEYS.speaking, {});
  allSpeaking[state.currentUser.id] = [result, ...(Array.isArray(allSpeaking[state.currentUser.id]) ? allSpeaking[state.currentUser.id] : [])].slice(0, 100);
  storage.set(STORAGE_KEYS.speaking, allSpeaking);
  const speakingSessions = storage.get(STORAGE_KEYS.speakingSessions, {}); const speakingSafe = speakingSessions && typeof speakingSessions === 'object' ? speakingSessions : {};
  speakingSafe[state.currentUser.id] = [result, ...(Array.isArray(speakingSafe[state.currentUser.id]) ? speakingSafe[state.currentUser.id] : [])].slice(0, 100); storage.set(STORAGE_KEYS.speakingSessions, speakingSafe);
  const progress = getUserProgress();
  progress.pronunciationAttempts = [result, ...progress.pronunciationAttempts].slice(0, 100);
  progress.daily.tasks.speaking = true;
  progress.skills.speaking = Math.min(100, Math.max(progress.skills.speaking, Math.round(evaluation.score * 0.8)));
  saveUserProgress(progress);
  return result;
}

function submitSpeakingFallback(event) {
  event.preventDefault();
  const transcript = String(new FormData(event.currentTarget).get('transcript') || '').trim();
  if (!transcript) return toast('Hãy nhập câu tiếng Hàn hoặc dùng micro.');
  saveSpeakingAttempt(transcript);
  render();
}

function completeSpeakingSession() {
  if (state.recording) stopMedia();
  setView('speaking-result');
}

function startWriting(promptId) {
  state.writingPrompt = window.KLEARN_MODULE_DATA?.writingPrompts?.find((prompt) => prompt.id === promptId) || null;
  state.writingSubmission = null;
  if (state.writingPrompt) { state.writingLevel = state.writingPrompt.level; state.writingMode = state.writingPrompt.type; }
  setView('writing-editor');
}

function updateWritingCounter() {
  const text = document.getElementById('writingText')?.value || '';
  const characterCount = [...text.replace(/\s/g, '')].length;
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charElement = document.getElementById('characterCount');
  const wordElement = document.getElementById('wordCount');
  if (charElement) charElement.textContent = `${characterCount} ký tự`;
  if (wordElement) wordElement.textContent = `${wordCount} từ`;
}

function submitWriting(event) {
  event.preventDefault();
  const answer = String(new FormData(event.currentTarget).get('answer') || '').trim();
  const prompt = state.writingPrompt;
  if (!answer || !prompt) return toast('Hãy viết câu trả lời trước khi nộp.');
  const compact = answer.replace(/\s/g, '');
  const characterCount = [...compact].length;
  const wordCount = answer.split(/\s+/).length;
  const keywordMatches = prompt.keywords.filter((keyword) => compact.includes(keyword.replace(/\s/g, ''))).length;
  const targetLength = prompt.level <= 2 ? 15 : prompt.level <= 4 ? 80 : 150;
  const lengthScore = Math.min(50, Math.round((characterCount / targetLength) * 50));
  const keywordScore = Math.round((keywordMatches / Math.max(1, prompt.keywords.length)) * 40);
  const structureScore = /[.!?。]|다\.?$|요\.?$/.test(answer) ? 10 : 4;
  const result = { id: uniqueId(), userId: state.currentUser.id, promptId: prompt.id, level: prompt.level, type: prompt.type, topic: prompt.topic, answer, characterCount, wordCount, keywordMatches, keywordTotal: prompt.keywords.length, preliminaryScore: Math.min(100, lengthScore + keywordScore + structureScore), criteria: { completion: Math.min(100, lengthScore * 2), grammar: structureScore >= 10 ? 80 : 45, vocabulary: keywordScore ? Math.min(100, keywordScore * 2.5) : 20, coherence: wordCount >= 3 ? 75 : 35, naturalness: Math.min(100, 45 + keywordScore + structureScore) }, sampleAnswer: prompt.sampleAnswer, tipsVi: prompt.tipsVi, submittedAt: new Date().toISOString() };
  if (result.preliminaryScore < 70) window.ErrorNotebookService?.add?.({ type: 'writing', question: prompt.prompt, mistake: answer, correction: prompt.sampleAnswer, explanation: prompt.tipsVi });
  state.writingSubmission = result;
  const allWriting = storage.get(STORAGE_KEYS.writing, {});
  allWriting[state.currentUser.id] = [result, ...(Array.isArray(allWriting[state.currentUser.id]) ? allWriting[state.currentUser.id] : [])].slice(0, 100);
  storage.set(STORAGE_KEYS.writing, allWriting);
  const writingAttempts = storage.get(STORAGE_KEYS.writingAttempts, {}); const writingSafe = writingAttempts && typeof writingAttempts === 'object' ? writingAttempts : {}; const writingUser = writingSafe[state.currentUser.id] && typeof writingSafe[state.currentUser.id] === 'object' ? writingSafe[state.currentUser.id] : {}; writingSafe[state.currentUser.id] = { ...writingUser, attempts: [result, ...(Array.isArray(writingUser.attempts) ? writingUser.attempts.filter((item) => item.id !== result.id) : [])].slice(0, 100), updatedAt: new Date().toISOString() }; storage.set(STORAGE_KEYS.writingAttempts, writingSafe);
  const progress = getUserProgress();
  progress.writingSubmissions = [result, ...progress.writingSubmissions].slice(0, 100);
  progress.daily.tasks.writing = true;
  progress.skills.writing = Math.min(100, Math.max(progress.skills.writing, Math.round(result.preliminaryScore * 0.8)));
  saveUserProgress(progress);
  state.writingRoom.draft = '';
  saveWritingRoomDraft();
  setView('writing-result');
}

// ============================================================
// Lesson, SRS, TTS and pronunciation handlers
// ============================================================
function openLesson(lessonId) {
  state.selectedLessonPreview = lessonId;
  state.lessonStep = 0;
  state.lessonCheck = null;
  state.selectedWords = [];
  state.sentenceCorrect = Boolean(state.lessonProgress[lessonId]?.completed);
  setView('lesson');
}

function setupSentenceExercise() {
  const allWords = ['베트남 사람입니다', '저', '는'];
  const zone = document.getElementById('dropZone');
  const box = document.getElementById('chipBox');
  const feedback = document.getElementById('sentenceFeedback');
  function draw() {
    zone.innerHTML = state.selectedWords.length ? state.selectedWords.map((word, index) => `<button class="chip selected" data-selected-word="${index}">${word}</button>`).join('') : `<span class="subtle">${I18nService.t('exercise.tapHint')}</span>`;
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
  const lessonId = state.selectedLessonPreview || 'topic-particle';
  if (!state.lessonCheck?.correct && !state.sentenceCorrect && !state.lessonProgress[lessonId]?.completed) return;
  const progress = getUserProgress();
  if (!progress.lessonProgress[lessonId]?.completed) {
    const existing = progress.lessonProgress[lessonId] || {};
    progress.lessonProgress[lessonId] = { ...existing, completed: true, completedAt: new Date().toISOString(), score: state.lessonCheck?.correct ? 100 : 80, masteryScore: Math.max(Number(existing.masteryScore) || 0, state.lessonCheck?.correct ? 80 : 70), masteryStatus: MasteryService.status(Math.max(Number(existing.masteryScore) || 0, state.lessonCheck?.correct ? 80 : 70)), recallCount: Number(existing.recallCount || 0) + 1, contentVersion: 1, updatedAt: new Date().toISOString() };
    progress.stats.lessonsCompleted += 1;
    progress.skills.reading = Math.min(100, progress.skills.reading + 5);
  }
  progress.daily.tasks.lesson = true;
  saveUserProgress(progress);
  toast('Đã lưu tiến độ bài học.');
  state.lessonStep = 0;
  setView('course-detail');
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

function speakKorean(text, rate = null) {
  if (!('speechSynthesis' in window)) return toast('Thiết bị chưa hỗ trợ đọc văn bản.');
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ko-KR';
  const preferredRate = rate === null ? getUserSettings().audioSpeed : Number(rate);
  utterance.rate = Math.max(0.5, Math.min(1.5, Number(preferredRate) || 1));
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
  if (state.currentView === 'speaking-session') return saveSpeakingAttempt(transcript);
  const result = { target: '안녕하세요', transcript, score: similarityScore('안녕하세요', transcript), feedback: 'Điểm dựa trên độ giống văn bản.', createdAt: new Date().toISOString() };
  state.pronunciationResult = result;
  return saveSpeakingAttempt(transcript);
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
        if (['practice', 'speaking-session'].includes(state.currentView)) render();
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
ThemeService.apply();
ThemeService.watchSystemTheme();
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

window.addEventListener('klearn-cloud-auth', (event) => {
  const cloudUser = event.detail?.user;
  state.cloudUser = cloudUser ? { id: cloudUser.id, email: cloudUser.email || '' } : null;
  if (!cloudUser) { CloudSyncService.setStatus('local'); if (state.currentView === 'profile') render(); return; }
  if (state.currentUser?.cloudUserId === cloudUser.id) CloudSyncService.hydrate().then(() => { if (state.currentView === 'profile') render(); });
});
window.SupabaseService?.init?.().then(() => CloudAccountService.restore()).then(() => { if (state.currentUser && state.currentView === 'profile') render(); });

window.KLEARN_APP = { storage, state, STORAGE_KEYS, render, setView, toast, escapeHtml, normalizeSearch, getUserProgress, saveUserProgress, getUserSrs, saveUserSrs, userScoped, saveUserScoped, updateCurrentUser, LearnerProfileService, MasteryService, VocabularyService, DictionaryService, PracticeService, CloudSyncService, AITutorService, PronunciationProvider, getDisplayPronunciation, speakKorean, AccessControlService, ContentReviewService: window.ContentReviewService, NotesService, BookmarkService, SupportService, QuestionBankService };

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch((error) => console.warn('[Tiếng Hàn - TamHoanq] Service worker không đăng ký được.', error)));
}
