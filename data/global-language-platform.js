/* P27 — language-independent learning contracts. Korean remains the only active content pack. */
(() => {
  'use strict';
  const global = window;
  const app = global.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService } = app;
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const clean = (value, max = 240) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const asObject = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const asArray = (value) => Array.isArray(value) ? value : [];
  const LANGUAGE_ALIASES = { ko: 'ko', 'ko-kr': 'ko', korean: 'ko', ja: 'ja', 'ja-jp': 'ja', japanese: 'ja', zh: 'zh', 'zh-cn': 'zh', chinese: 'zh', en: 'en', 'en-us': 'en', english: 'en' };
  const fallbackContent = { version: 1, verified: true, reviewStatus: 'approved', architectureOnly: true, supportedLanguages: [{ id: 'ko', locale: 'ko-KR', nativeName: '한국어', englishName: 'Korean', contentStatus: 'active', direction: 'ltr', script: 'Hangul' }, { id: 'ja', locale: 'ja-JP', nativeName: '日本語', englishName: 'Japanese', contentStatus: 'foundation', direction: 'ltr', script: 'Kana + Kanji' }, { id: 'zh', locale: 'zh-CN', nativeName: '中文', englishName: 'Chinese', contentStatus: 'foundation', direction: 'ltr', script: 'Han' }, { id: 'en', locale: 'en-US', nativeName: 'English', englishName: 'English', contentStatus: 'foundation', direction: 'ltr', script: 'Latin' }], examSystems: [{ id: 'topik', languageId: 'ko', name: 'TOPIK', levels: [1, 2, 3, 4, 5, 6], status: 'active' }, { id: 'jlpt', languageId: 'ja', name: 'JLPT', levels: ['N5', 'N4', 'N3', 'N2', 'N1'], status: 'framework' }, { id: 'hsk', languageId: 'zh', name: 'HSK', levels: [1, 2, 3, 4, 5, 6], status: 'framework' }], levelSystems: { ko: 'TOPIK', ja: 'JLPT', zh: 'HSK', en: 'CEFR' }, contentModel: { course: ['id', 'languageId', 'title', 'level', 'units', 'status'], lesson: ['id', 'courseId', 'languageId', 'skill', 'content', 'examples', 'audioIds'], vocabulary: ['id', 'languageId', 'term', 'meaning', 'reading', 'partOfSpeech', 'level', 'audioIds'], grammar: ['id', 'languageId', 'pattern', 'explanation', 'examples', 'level'], audio: ['id', 'languageId', 'text', 'url', 'locale', 'speed', 'qualityStatus'] } };
  const runtime = { content: null, loading: null, error: '' };
  const normalizeLanguage = (value) => LANGUAGE_ALIASES[clean(value, 30).toLowerCase()] || '';
  const language = (value) => GlobalLanguageContentService.get().supportedLanguages?.find((item) => item.id === normalizeLanguage(value)) || null;
  const requireLanguage = (value) => { const id = normalizeLanguage(value); return language(id) ? id : null; };

  const GlobalLanguageContentService = {
    hydrate(value) { const content = asObject(value); if (content.verified !== true || content.reviewStatus !== 'approved' || content.architectureOnly !== true || !asArray(content.supportedLanguages).length || !asArray(content.examSystems).length) throw new Error('Global language content quality gate failed'); runtime.content = content; runtime.error = ''; return content; },
    async load() { if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading; if (typeof fetch !== 'function') return this.hydrate(fallbackContent); runtime.loading = fetch('./content/global-language-platform.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Global language content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = error.message || 'Global language content unavailable'; return this.hydrate(fallbackContent); }).finally(() => { runtime.loading = null; }); return runtime.loading; },
    get() { return runtime.content || fallbackContent; },
    status() { return { loaded: Boolean(runtime.content), architectureOnly: true, error: runtime.error || null }; }
  };

  const LanguageCoreService = {
    all() { return asArray(GlobalLanguageContentService.get().supportedLanguages); },
    supported(value) { return Boolean(requireLanguage(value)); },
    normalize(value) { return normalizeLanguage(value); },
    get(value) { return language(value); },
    active() { return this.all().filter((item) => item.contentStatus === 'active'); },
    contentStatus(value) { return language(value)?.contentStatus || 'unsupported'; },
    levelSystem(value) { const id = requireLanguage(value); return id ? (GlobalLanguageContentService.get().levelSystems?.[id] || 'CEFR') : null; }
  };

  const defaultProfile = () => ({ version: 1, activeLanguage: 'ko', languages: { ko: { languageId: 'ko', status: 'learning', currentLevel: 'TOPIK1', targetLevel: 'TOPIK2', startedAt: now(), updatedAt: now() } }, updatedAt: now() });
  const readProfile = () => { const value = userScoped(STORAGE_KEYS.languageProfiles || 'klearn_language_profiles')[0]; return value && typeof value === 'object' && !Array.isArray(value) ? { ...defaultProfile(), ...value, languages: asObject(value.languages) } : defaultProfile(); };
  const writeProfile = (value) => { if (!uid()) return null; const next = { ...defaultProfile(), ...value, version: 1, updatedAt: now() }; saveUserScoped(STORAGE_KEYS.languageProfiles || 'klearn_language_profiles', [next], 1); CloudSyncService?.schedule?.('language-profile'); return next; };
  const LanguageProfileService = {
    get() { return readProfile(); },
    active() { return readProfile().activeLanguage; },
    all() { const profile = readProfile(); return Object.values(profile.languages).filter((item) => LanguageCoreService.supported(item.languageId)); },
    getLanguage(languageId) { const id = requireLanguage(languageId); return id ? readProfile().languages[id] || null : null; },
    setActive(languageId) { const id = requireLanguage(languageId); if (!id || !uid()) return null; const profile = readProfile(); const entry = profile.languages[id] || { languageId: id, status: 'planned', startedAt: now() }; return writeProfile({ ...profile, activeLanguage: id, languages: { ...profile.languages, [id]: { ...entry, updatedAt: now() } } }); },
    add(languageId, input = {}) { const id = requireLanguage(languageId); if (!id || !uid()) return null; const profile = readProfile(); const current = profile.languages[id] || {}; return writeProfile({ ...profile, languages: { ...profile.languages, [id]: { languageId: id, status: 'planned', currentLevel: input.currentLevel || null, targetLevel: input.targetLevel || null, ...current, ...input, languageId: id, updatedAt: now() } } }); },
    update(languageId, changes = {}) { const id = requireLanguage(languageId); if (!id || !uid()) return null; const profile = readProfile(); const current = profile.languages[id] || { languageId: id, status: 'planned' }; return writeProfile({ ...profile, languages: { ...profile.languages, [id]: { ...current, ...changes, languageId: id, updatedAt: now() } } }); }
  };

  const ExamFrameworkService = {
    all() { return asArray(GlobalLanguageContentService.get().examSystems); },
    forLanguage(languageId) { const id = requireLanguage(languageId); return this.all().filter((item) => item.languageId === id); },
    get(examId) { return this.all().find((item) => item.id === clean(examId, 30).toLowerCase()) || null; },
    level(examId, level) { const exam = this.get(examId); return exam?.levels?.includes(level) ? level : null; },
    map(languageId, level) { const id = requireLanguage(languageId); const exam = this.forLanguage(id)[0]; return exam ? { examId: exam.id, languageId: id, level: this.level(exam.id, level) || exam.levels[0], label: `${exam.name} ${this.level(exam.id, level) || exam.levels[0]}` } : null; }
  };

  const CourseStructureService = {
    normalize(course = {}) { const languageId = requireLanguage(course.languageId); if (!languageId || !clean(course.id, 100)) return null; return { id: clean(course.id, 100), languageId, title: clean(course.title, 200), level: clean(course.level, 40), units: asArray(course.units).map((unit) => ({ id: clean(unit.id, 100), title: clean(unit.title, 200), lessonIds: asArray(unit.lessonIds).map((id) => clean(id, 100)).filter(Boolean) })).filter((unit) => unit.id), status: ['draft', 'approved', 'archived'].includes(course.status) ? course.status : 'draft' }; },
    lessons(course = {}) { return asArray(course.units).flatMap((unit) => asArray(unit.lessonIds)); },
    validate(course = {}) { const normalized = this.normalize(course); return { valid: Boolean(normalized && normalized.units.length), errors: normalized ? (normalized.units.length ? [] : ['course needs units']) : ['languageId and id are required'] }; }
  };

  const VocabularyEngine = {
    normalize(card = {}, languageId = card.languageId || 'ko') { const id = requireLanguage(languageId); if (!id || !clean(card.id || card.wordId || card.term, 120)) return null; return { ...card, id: clean(card.id || card.wordId || card.term, 120), languageId: id, term: clean(card.term || card.korean || card.word || '', 240), meaning: clean(card.meaning || card.meaningVi || card.translation || '', 500), reading: clean(card.reading || card.romanization || '', 240) }; },
    cards(languageId = LanguageProfileService.active()) { const id = requireLanguage(languageId); if (!id) return []; return asArray(state.srsData).filter((card) => (card.languageId || 'ko') === id).map((card) => this.normalize(card, id)).filter(Boolean); },
    scope(card, languageId = LanguageProfileService.active()) { return this.normalize({ ...card, languageId }, languageId); },
    mastery(card) { const value = Number(card?.mastery); return Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0)); },
    review(card, result = {}) { const normalized = this.normalize(card, card?.languageId); if (!normalized) return null; return { ...normalized, lastResult: Boolean(result.correct), lastReviewed: now(), reviewCount: Number(card.reviewCount || 0) + 1, mastery: Math.max(0, Math.min(100, this.mastery(card) + (result.correct ? 8 : -12))) }; }
  };

  const GrammarFrameworkService = {
    normalize(grammar = {}) { const languageId = requireLanguage(grammar.languageId); if (!languageId || !clean(grammar.id, 120) || !clean(grammar.pattern, 160)) return null; return { id: clean(grammar.id, 120), languageId, pattern: clean(grammar.pattern, 160), explanation: clean(grammar.explanation, 1000), examples: asArray(grammar.examples).slice(0, 12).map((item) => ({ form: clean(item.form || item.korean || item.text, 500), translation: clean(item.translation || item.meaning, 500) })).filter((item) => item.form), level: clean(grammar.level, 40) }; },
    supports(languageId) { return LanguageCoreService.supported(languageId); },
    compare(first, second) { const a = this.normalize(first); const b = this.normalize(second); return a && b && a.languageId !== b.languageId ? { source: a, target: b, sameConcept: false } : null; }
  };

  const AudioFrameworkService = {
    normalize(audio = {}) { const languageId = requireLanguage(audio.languageId); if (!languageId || !clean(audio.id, 120) || !clean(audio.text, 500)) return null; return { id: clean(audio.id, 120), languageId, text: clean(audio.text, 500), url: clean(audio.url, 1000), locale: clean(audio.locale || language(languageId)?.locale, 40), speed: Number(audio.speed) > 0 ? Number(audio.speed) : 1, qualityStatus: ['draft', 'review', 'approved'].includes(audio.qualityStatus) ? audio.qualityStatus : 'review' }; },
    speak(text, languageId = LanguageProfileService.active()) { const id = requireLanguage(languageId); if (!id || !global.speechSynthesis || !global.SpeechSynthesisUtterance) return false; const utterance = new global.SpeechSynthesisUtterance(clean(text, 1000)); utterance.lang = language(id)?.locale || id; global.speechSynthesis.cancel(); global.speechSynthesis.speak(utterance); return true; }
  };

  const LanguageComparisonService = {
    compare(input = {}) { const sourceLanguage = normalizeLanguage(input.sourceLanguage) || (clean(input.sourceLanguage, 20).toLowerCase() === 'vi' ? 'vi' : ''); const targetLanguage = requireLanguage(input.targetLanguage); if (!sourceLanguage || !targetLanguage || sourceLanguage === targetLanguage) return null; return { sourceLanguage, targetLanguage, source: clean(input.source, 1000), target: clean(input.target, 1000), note: clean(input.note || input.notes, 1000), createdAt: now() }; },
    languages() { return ['vi', ...LanguageCoreService.all().map((item) => item.id)]; }
  };

  const LanguagePlatformService = { content: GlobalLanguageContentService, core: LanguageCoreService, profiles: LanguageProfileService, exams: ExamFrameworkService, courses: CourseStructureService, vocabulary: VocabularyEngine, grammar: GrammarFrameworkService, audio: AudioFrameworkService, comparison: LanguageComparisonService, version: 'p27-v1' };
  global.GlobalLanguageContentService = GlobalLanguageContentService;
  global.LanguageCoreService = LanguageCoreService;
  global.LanguageProfileService = LanguageProfileService;
  global.ExamFrameworkService = ExamFrameworkService;
  global.CourseStructureService = CourseStructureService;
  global.LanguageVocabularyEngine = VocabularyEngine;
  global.GrammarFrameworkService = GrammarFrameworkService;
  global.AudioFrameworkService = AudioFrameworkService;
  global.LanguageComparisonService = LanguageComparisonService;
  global.LanguagePlatformService = LanguagePlatformService;
  GlobalLanguageContentService.load();
})();
