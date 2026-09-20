/* P79 — topic vocabulary immersion on the existing SRS, mastery and learning-data core. */
(function vocabularyImmersionSystem(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, storage, escapeHtml = String, render, setView, toast, getUserProgress, saveUserProgress, getUserSrs, saveUserSrs, userScoped, saveUserScoped, VocabularyService, emitLearningMutation, speakKorean } = app;
  const runtime = state.p79Vocabulary || (state.p79Vocabulary = { config: null, loading: null, topicId: 'greetings', wordId: '', practiceMode: 'listening', practiceResult: null, capture: null });
  const now = () => new Date().toISOString();
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const clean = (value, max = 300) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const normalize = (value) => clean(value, 500).toLocaleLowerCase('ko-KR').replace(/[\s.,!?;:'"“”‘’()\[\]{}\-]/g, '');
  const uid = () => state.currentUser?.id || 'guest';
  const randomId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const DAY = 86400000;

  const P79VocabularyConfigService = {
    hydrate(value) {
      const topicIds = new Set((value?.topics || []).map((item) => item.id));
      if (Number(value?.schemaVersion) !== 1 || value?.topics?.length !== 17 || !value?.topics?.every((item) => item.id && item.title && item.level && item.topikLevel && item.description) || !value?.vocabulary?.every((word) => word.id && word.korean && word.pronunciation && word.meaning && word.wordType && topicIds.has(word.topicId) && word.example && word.audio && word.image && Array.isArray(word.relatedWords) && word.commonMistake) || value?.masteryLevels?.length !== 5) throw new Error('P79 vocabulary contract failed');
      runtime.config = clone(value);
      if (!runtime.wordId) runtime.wordId = value.vocabulary[0]?.id || '';
      return this.get();
    },
    get() { return runtime.config ? clone(runtime.config) : null; },
    async load() {
      if (runtime.config) return this.get();
      if (runtime.loading) return runtime.loading;
      runtime.loading = fetch('./content/vocabulary-immersion-system.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P79 content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch(() => null).finally(() => { runtime.loading = null; if (String(state.currentView).startsWith('vocabulary-')) render(); });
      return runtime.loading;
    }
  };

  function collections() { return global.VocabularyCollectionService?.all?.() || userScoped?.(STORAGE_KEYS.vocabularyCollections) || []; }
  function customWords() { return collections().flatMap((collection) => (collection.customWords || []).map((word) => ({ ...word, collectionId: collection.id, custom: true }))); }
  function configuredWords() { return runtime.config?.vocabulary || []; }
  function findWord(wordId) { return configuredWords().find((word) => word.id === wordId) || customWords().find((word) => word.id === wordId) || null; }
  function findCard(wordId) { return (getUserSrs?.() || state.srsData || []).find((card) => card.wordId === wordId || card.id === wordId) || null; }
  function cardFor(word) {
    const existing = findCard(word.id);
    if (existing) return existing;
    const stamp = now();
    const card = {
      id: word.id, wordId: word.id, userId: uid(), korean: word.korean, pronunciation: word.pronunciation, romanization: word.pronunciation,
      meaning: word.meaning, meaningVi: word.meaning, partOfSpeech: word.wordType, topic: word.topicId || word.collectionId || 'personal', topicId: word.topicId || null,
      level: word.level || 'Personal', topikLevel: word.topikLevel === 'TOPIK II' ? 3 : word.topikLevel === 'TOPIK I' ? 1 : null,
      example: word.example || '', audio: word.audio || `tts:${word.korean}`, image: word.image || 'emoji:🗂️', relatedWords: word.relatedWords || [], commonMistake: word.commonMistake || '',
      status: 'learning', mastery: 20, reviewCount: 0, correctCount: 0, wrongCount: 0, streakCorrect: 0, activatedAt: stamp, createdAt: stamp, updatedAt: stamp,
      nextReview: new Date(Date.now() + DAY).toISOString(), immersionLevel: 1, immersionEvidence: {}, activationSource: 'p79-vocabulary-immersion'
    };
    saveUserSrs([...(getUserSrs?.() || []), card]);
    return findCard(word.id) || card;
  }

  const VocabularyTopicLibraryService = {
    all(filter = 'all') {
      const topics = runtime.config?.topics || [];
      return topics.filter((topic) => filter === 'all' || topic.topikLevel === filter).map((topic) => {
        const words = this.words(topic.id); const completed = words.filter((word) => Number(findCard(word.id)?.immersionLevel || 0) >= 5).length;
        const active = words.filter((word) => Number(findCard(word.id)?.immersionLevel || 0) > 0).length;
        return { ...clone(topic), totalVocabulary: words.length, completedVocabulary: completed, activeVocabulary: active, completion: words.length ? Math.round(completed / words.length * 100) : 0 };
      });
    },
    get(topicId) { return this.all().find((topic) => topic.id === topicId) || null; },
    words(topicId) { return configuredWords().filter((word) => word.topicId === topicId).map(clone); },
    select(topicId) { if (!this.get(topicId)) return false; runtime.topicId = topicId; runtime.wordId = this.words(topicId)[0]?.id || ''; runtime.practiceResult = null; setView('vocabulary-topic-p79'); return true; }
  };

  const VocabularyMasteryBridgeService = {
    levels() { return clone(runtime.config?.masteryLevels || []); },
    level(wordId) { return Number(findCard(wordId)?.immersionLevel || 0); },
    evidence(wordId) { return clone(findCard(wordId)?.immersionEvidence || {}); },
    activate(wordId) {
      const word = findWord(wordId); if (!word) return null;
      const card = cardFor(word); if (Number(card.immersionLevel || 0) >= 1) return card;
      return VocabularyService.updateCard(word.id, { immersionLevel: 1, mastery: Math.max(20, Number(card.mastery || 0)), activatedAt: card.activatedAt || now(), activationSource: 'p79-vocabulary-immersion' });
    },
    derive(evidence = {}) {
      let level = 1;
      if (evidence.reading?.passed) level = 2;
      if (level >= 2 && evidence.listening?.passed) level = 3;
      if (level >= 3 && evidence.writing?.passed) level = 4;
      if (level >= 4 && evidence.context?.passed && evidence.speaking?.passed) level = 5;
      return level;
    },
    record(wordId, skill, result = {}) {
      const word = findWord(wordId); if (!word || !['listening', 'reading', 'writing', 'speaking', 'context'].includes(skill)) return null;
      const card = cardFor(word); const correct = Boolean(result.correct); const score = Math.max(0, Math.min(100, Number(result.score ?? (correct ? 100 : 0)))); const previousEvidence = card.immersionEvidence || {};
      const previous = previousEvidence[skill] || {};
      const evidence = { ...previousEvidence, [skill]: { attempts: Number(previous.attempts || 0) + 1, correct: Number(previous.correct || 0) + (correct ? 1 : 0), bestScore: Math.max(Number(previous.bestScore || 0), score), passed: Boolean(previous.passed || correct && score >= (skill === 'writing' || skill === 'context' ? 80 : 70)), lastAttemptAt: now() } };
      const level = this.derive(evidence); const nextDays = [1, 1, 3, 7, 14, 30][level];
      const updated = VocabularyService.updateCard(word.id, {
        immersionEvidence: evidence, immersionLevel: level, mastery: Math.max(Number(card.mastery || 0), level * 20),
        status: level >= 5 ? 'mastered' : level >= 2 ? 'review' : 'learning', reviewCount: Number(card.reviewCount || 0) + 1,
        correctCount: Number(card.correctCount || 0) + (correct ? 1 : 0), wrongCount: Number(card.wrongCount || 0) + (correct ? 0 : 1), streakCorrect: correct ? Number(card.streakCorrect || 0) + 1 : 0,
        lastReviewed: now(), nextReview: new Date(Date.now() + nextDays * DAY).toISOString(), lastImmersionSkill: skill
      });
      this.integrate(word, skill, correct, score, level);
      return updated;
    },
    integrate(word, skill, correct, score, level) {
      const progress = getUserProgress?.();
      if (progress) {
        progress.skills = { ...(progress.skills || {}), vocabulary: Math.max(Number(progress.skills?.vocabulary || 0), score), [skill]: Math.max(Number(progress.skills?.[skill] || 0), score) };
        progress.daily = progress.daily || { tasks: {} }; progress.daily.tasks = { ...(progress.daily.tasks || {}), vocabulary: true };
        if (skill === 'listening') progress.daily.tasks.listening = true; if (skill === 'speaking') progress.daily.tasks.speaking = true;
        saveUserProgress?.(progress);
      }
      global.AdaptiveDifficultyService?.record?.('vocabulary', correct);
      if (!correct) global.ErrorNotebookService?.add?.({ type: `vocabulary-${skill}`, question: word.korean, mistake: clean(runtime.practiceResult?.answer || '', 120), correction: skill === 'writing' ? word.korean : word.meaning, explanation: word.commonMistake, topic: word.topicId, wordId: word.id });
      emitLearningMutation?.('vocabulary_updated', word.id, { action: 'immersion-practice', skill, correct, score, immersionLevel: level, topicId: word.topicId }, `p79:${uid()}:${word.id}:${skill}:${Date.now()}`);
      global.UserResearchService?.track?.('vocabulary_immersion_practice', { skill, success: correct, topicId: word.topicId });
      VocabularyTopicAchievementService.evaluate(word.topicId);
    }
  };

  const VocabularyTopicAchievementService = {
    evaluate(topicId) {
      const topic = VocabularyTopicLibraryService.get(topicId); if (!topic || topic.completion < 100) return null;
      const id = `p79-topic-${topicId}`; const saved = userScoped?.(STORAGE_KEYS.achievements) || []; const existing = saved.find((item) => item.id === id); if (existing) return existing;
      const achievement = { id, title: `Hoàn thành chủ đề: ${topic.title}`, icon: topic.icon || '🏆', unlockedAt: now(), derived: true, source: 'p79-vocabulary-immersion' };
      saveUserScoped?.(STORAGE_KEYS.achievements, [achievement, ...saved], 100);
      emitLearningMutation?.('achievement_unlocked', id, { topicId, source: 'p79' }, `p79-achievement:${uid()}:${topicId}`);
      return achievement;
    }
  };

  const VocabularyPracticeService = {
    modes() { return ['listening', 'reading', 'writing', 'speaking', 'context']; },
    distractors(word) { return configuredWords().filter((item) => item.id !== word.id && item.meaning !== word.meaning).slice(0, 3).map((item) => item.meaning); },
    question(wordId = runtime.wordId, mode = runtime.practiceMode) {
      const word = findWord(wordId); if (!word) return null;
      const base = { wordId: word.id, mode, korean: word.korean, meaning: word.meaning, example: word.example };
      if (mode === 'listening') return { ...base, prompt: 'Nghe và chọn nghĩa đúng', audio: word.audio, answer: word.meaning, options: [word.meaning, ...this.distractors(word)].sort((a, b) => a.localeCompare(b, 'vi')) };
      if (mode === 'reading') return { ...base, prompt: `Đọc thành tiếng: ${word.korean}`, answer: word.korean, acceptsVoice: true };
      if (mode === 'writing') return { ...base, prompt: `Viết bằng tiếng Hàn: ${word.meaning}`, answer: word.korean };
      if (mode === 'speaking') return { ...base, prompt: `Nói từ: ${word.meaning}`, answer: word.korean, acceptsVoice: true };
      return { ...base, prompt: word.example.replace(word.korean, '＿＿＿'), answer: word.korean };
    },
    grade(wordId, mode, answer) {
      const word = findWord(wordId); if (!word) return null;
      const expected = mode === 'listening' ? word.meaning : word.korean; const exact = normalize(answer) === normalize(expected);
      const score = exact ? 100 : normalize(answer) && (normalize(expected).includes(normalize(answer)) || normalize(answer).includes(normalize(expected))) ? 75 : 0;
      const result = { wordId, mode, answer: clean(answer, 200), expected, correct: score >= (mode === 'writing' || mode === 'context' ? 80 : 70), score, gradedAt: now() };
      runtime.practiceResult = result; VocabularyMasteryBridgeService.record(wordId, mode, result); return clone(result);
    }
  };

  const PersonalVocabularyService = {
    all() { return clone(collections()); },
    create(title) {
      const safe = clean(title, 80); if (!safe) throw new Error('Tên bộ từ không được để trống.');
      if (global.VocabularyCollectionService?.create) return global.VocabularyCollectionService.create(safe);
      const item = { id: randomId('collection'), userId: uid(), title: safe, wordIds: [], customWords: [], createdAt: now(), updatedAt: now() };
      saveUserScoped?.(STORAGE_KEYS.vocabularyCollections, [item, ...collections()], 100); return item;
    },
    add(collectionId, input = {}) {
      const collection = collections().find((item) => item.id === collectionId); if (!collection) throw new Error('Không tìm thấy bộ từ.');
      const korean = clean(input.korean, 80); const meaning = clean(input.meaning, 160); if (!korean || !meaning) throw new Error('Cần nhập từ tiếng Hàn và nghĩa.');
      const word = { id: randomId('personal-word'), korean, pronunciation: clean(input.pronunciation, 100), meaning, wordType: clean(input.wordType || 'Danh từ', 30), topicId: null, level: 'Personal', topikLevel: 'Personal', example: clean(input.example, 240), exampleMeaning: '', audio: `tts:${korean}`, image: 'emoji:🗂️', relatedWords: [], commonMistake: clean(input.commonMistake, 240), createdAt: now() };
      const next = { ...collection, wordIds: [...new Set([...(collection.wordIds || []), word.id])], customWords: [word, ...(collection.customWords || [])], updatedAt: now() };
      if (global.VocabularyCollectionService?.save) global.VocabularyCollectionService.save(next); else saveUserScoped?.(STORAGE_KEYS.vocabularyCollections, [next, ...collections().filter((item) => item.id !== collectionId)], 100);
      cardFor({ ...word, collectionId }); return clone(word);
    }
  };

  const VocabularyAnalyticsService = {
    summary() {
      const ids = new Set([...configuredWords(), ...customWords()].map((word) => word.id)); const cards = (getUserSrs?.() || []).filter((card) => ids.has(card.wordId));
      const topics = VocabularyTopicLibraryService.all();
      return { totalWords: ids.size, activeWords: cards.filter((card) => Number(card.immersionLevel || 0) > 0).length, masteredWords: cards.filter((card) => Number(card.immersionLevel || 0) >= 5).length, weakWords: cards.filter((card) => Number(card.wrongCount || 0) > Number(card.correctCount || 0) || Number(card.mastery || 0) < 40).length, topicProgress: topics.map((topic) => ({ id: topic.id, title: topic.title, completion: topic.completion, completed: topic.completedVocabulary, total: topic.totalVocabulary })) };
    }
  };

  const VocabularyOfflinePackService = {
    all() { const downloaded = new Set((userScoped?.(STORAGE_KEYS.offlinePacks) || []).map((item) => item.id)); return (runtime.config?.offlinePacks || []).map((pack) => ({ ...clone(pack), vocabularyCount: [...new Set(pack.topicIds.flatMap((id) => VocabularyTopicLibraryService.words(id).map((word) => word.id)))].length, downloaded: downloaded.has(pack.id) || Boolean(global.MobileOfflineService?.metadata?.().find?.((item) => item.id === pack.id && item.status === 'downloaded')) })); },
    async download(packId) {
      const pack = this.all().find((item) => item.id === packId); if (!pack) return { status: 'missing' };
      try { const result = await global.MobileOfflineService?.download?.(packId); if (result?.status === 'downloaded') return { ...result, learningDataPreserved: true }; } catch (_) {}
      const current = userScoped?.(STORAGE_KEYS.offlinePacks) || []; const record = { id: pack.id, title: pack.title, type: 'vocabulary', topicIds: pack.topicIds, vocabularyCount: pack.vocabularyCount, status: 'downloaded', downloadedAt: now(), source: 'p79' };
      saveUserScoped?.(STORAGE_KEYS.offlinePacks, [record, ...current.filter((item) => item.id !== pack.id)], 100); return { ...record, learningDataPreserved: true };
    }
  };

  function loading() { P79VocabularyConfigService.load(); return '<section class="section page-heading"><h1>Đang tải Vocabulary Immersion…</h1></section>'; }
  function header(title, subtitle, back = 'lessons') { return `<section class="section p79-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">P79 · VOCABULARY IMMERSION</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></section>`; }
  function levelTrack(level) { return `<ol class="p79-level-track">${(runtime.config?.masteryLevels || []).map((item) => `<li class="${level >= item.level ? 'done' : ''}"><span>${level >= item.level ? '✓' : item.level}</span><small>${escapeHtml(item.label)}</small></li>`).join('')}</ol>`; }

  function libraryView() {
    if (!runtime.config) return loading(); const analytics = VocabularyAnalyticsService.summary();
    return `<div class="p79-shell">${header('Thư viện từ vựng theo chủ đề', 'Chủ đề → học đa kỹ năng → bằng chứng thành thạo thật.')}<section class="section p79-stats"><article><b>${analytics.totalWords}</b><span>Tổng từ</span></article><article><b>${analytics.activeWords}</b><span>Đang học</span></article><article><b>${analytics.masteredWords}</b><span>Thành thạo</span></article><article><b>${analytics.weakWords}</b><span>Từ yếu</span></article></section>${['TOPIK I','TOPIK II'].map((level) => `<section class="section"><div class="p79-section-title"><div><small>${level}</small><h2>${level === 'TOPIK I' ? 'Nền tảng đời sống' : 'Ngôn ngữ học thuật & xã hội'}</h2></div></div><div class="p79-topic-grid">${VocabularyTopicLibraryService.all(level).map((topic) => `<button class="p79-topic-card" data-p79-topic="${topic.id}"><span>${topic.icon}</span><div><small>${escapeHtml(topic.level)}</small><h3>${escapeHtml(topic.title)}</h3><p>${escapeHtml(topic.description)}</p><div class="p79-progress"><i style="width:${topic.completion}%"></i></div><b>${topic.completedVocabulary}/${topic.totalVocabulary} từ · ${topic.completion}%</b></div></button>`).join('')}</div></section>`).join('')}<section class="section p79-actions"><button class="btn secondary" data-view="personal-vocabulary-p79">🗂 Bộ từ cá nhân</button><button class="btn secondary" data-view="vocabulary-offline-p79">⇩ Offline packs</button><button class="btn secondary" data-view="vocabulary-analytics-p79">📊 Tiến độ</button></section></div>`;
  }

  function topicView() {
    if (!runtime.config) return loading(); const topic = VocabularyTopicLibraryService.get(runtime.topicId) || VocabularyTopicLibraryService.all()[0]; if (!topic) return libraryView(); const words = VocabularyTopicLibraryService.words(topic.id);
    return `<div class="p79-shell">${header(`${topic.icon} ${topic.title}`, `${topic.description} · ${topic.completedVocabulary}/${topic.totalVocabulary} từ đã usage mastered.`, 'vocabulary-immersion-p79')}<section class="section p79-roadmap"><div><b>${topic.completion}%</b><span>Topic progress</span></div><div class="p79-progress"><i style="width:${topic.completion}%"></i></div><small>${topic.activeVocabulary}/${topic.totalVocabulary} từ đã bắt đầu · hoàn thành 100% để nhận Topic Achievement</small></section><section class="section p79-word-list">${words.map((word, index) => { const card = findCard(word.id); const level = Number(card?.immersionLevel || 0); return `<article><button class="p79-word-main" data-p79-learn="${word.id}"><span class="p79-word-image">${escapeHtml(word.image.replace('emoji:',''))}</span><div><small>${index + 1} · ${escapeHtml(word.wordType)}</small><h2 lang="ko">${escapeHtml(word.korean)}</h2><p>${escapeHtml(word.pronunciation)} · ${escapeHtml(word.meaning)}</p></div><strong>L${level || 0}</strong></button>${levelTrack(level)}</article>`; }).join('')}</section></div>`;
  }

  function learnView() {
    if (!runtime.config) return loading(); const word = findWord(runtime.wordId) || configuredWords()[0]; if (!word) return libraryView(); const level = VocabularyMasteryBridgeService.level(word.id); const topic = VocabularyTopicLibraryService.get(word.topicId);
    VocabularyMasteryBridgeService.activate(word.id);
    return `<div class="p79-shell">${header(topic?.title || 'Bộ từ cá nhân', 'Không đánh dấu “đã xem”: mỗi cấp cần bằng chứng nghe, đọc, viết và sử dụng.', topic ? 'vocabulary-topic-p79' : 'personal-vocabulary-p79')}<section class="section p79-word-stage"><div class="p79-visual" role="img" aria-label="${escapeHtml(word.meaning)}">${escapeHtml((word.image || 'emoji:🗂️').replace('emoji:',''))}</div><div class="p79-word-copy"><small>${escapeHtml(word.wordType)} · ${escapeHtml(word.level)}</small><h1 lang="ko">${escapeHtml(word.korean)}</h1><p class="p79-pronunciation">/${escapeHtml(word.pronunciation)}/</p><h2>${escapeHtml(word.meaning)}</h2><blockquote lang="ko">${escapeHtml(word.example)}</blockquote>${word.exampleMeaning ? `<p>${escapeHtml(word.exampleMeaning)}</p>` : ''}</div><button class="p79-audio" data-p79-audio="${escapeHtml(word.korean)}" aria-label="Nghe ${escapeHtml(word.korean)}">🔊 Nghe</button></section><section class="section p79-detail-grid"><article><small>TỪ LIÊN QUAN</small><p>${(word.relatedWords || []).map((item) => `<span lang="ko">${escapeHtml(item)}</span>`).join(' ') || 'Tự thêm trong bộ từ cá nhân'}</p></article><article><small>LỖI THƯỜNG GẶP</small><p>${escapeHtml(word.commonMistake || 'Chú ý phát âm và ngữ cảnh sử dụng.')}</p></article></section><section class="section p79-mastery"><div class="p79-section-title"><div><small>MASTERY</small><h2>Level ${level}/5</h2></div></div>${levelTrack(level)}<div class="p79-skill-actions">${[['listening','🎧','Nghe'],['reading','👄','Đọc'],['writing','✍️','Viết'],['speaking','🎙️','Nói'],['context','🧩','Ngữ cảnh']].map(([mode,icon,label]) => `<button data-p79-practice="${mode}"><span>${icon}</span><b>${label}</b><small>${VocabularyMasteryBridgeService.evidence(word.id)[mode]?.passed ? '✓ Đã đạt' : 'Luyện ngay'}</small></button>`).join('')}</div></section><button class="btn primary full p79-next-word" data-p79-seen="${word.id}">Đã học bước đầu · đưa vào SRS</button></div>`;
  }

  function practiceView() {
    if (!runtime.config) return loading(); const question = VocabularyPracticeService.question(); if (!question) return libraryView(); const result = runtime.practiceResult; const evidence = VocabularyMasteryBridgeService.evidence(question.wordId)[question.mode];
    return `<div class="p79-shell">${header(`${question.mode.toUpperCase()} PRACTICE`, `${findWord(question.wordId)?.korean} · lần luyện ${Number(evidence?.attempts || 0) + (result ? 0 : 1)}`, 'vocabulary-learn-p79')}<section class="section p79-practice-card"><div class="p79-mode-tabs">${VocabularyPracticeService.modes().map((mode) => `<button class="${mode === question.mode ? 'active' : ''}" data-p79-mode="${mode}">${mode}</button>`).join('')}</div>${question.mode === 'listening' ? `<button class="p79-listen-prompt" data-p79-audio="${escapeHtml(question.korean)}">🔊<span>Nghe lại</span></button>` : `<p class="eyebrow">${escapeHtml(question.prompt)}</p>`}${question.mode === 'context' ? `<h2 lang="ko">${escapeHtml(question.prompt)}</h2>` : question.mode !== 'listening' ? `<h2>${escapeHtml(question.prompt)}</h2>` : ''}${question.options ? `<div class="p79-options">${question.options.map((option) => `<button data-p79-answer="${escapeHtml(option)}">${escapeHtml(option)}</button>`).join('')}</div>` : `<form data-p79-answer-form><input name="answer" lang="ko" autocomplete="off" required placeholder="${question.acceptsVoice ? 'Nói hoặc nhập câu trả lời' : 'Nhập Hangul'}">${question.acceptsVoice ? '<button class="btn secondary" type="button" data-p79-record>● Thu âm</button>' : ''}<button class="btn primary">Kiểm tra</button></form>`}${question.acceptsVoice ? '<p class="subtle">Nếu micro không khả dụng, luôn có thể nhập câu trả lời.</p>' : ''}${result ? `<aside class="p79-feedback ${result.correct ? 'correct' : 'wrong'}"><b>${result.correct ? '✓ Chính xác' : '→ Chưa đạt'}</b><p>Đáp án: <span lang="ko">${escapeHtml(result.expected)}</span> · ${result.score}%</p><button class="btn primary" data-p79-retry>Luyện lại</button><button class="btn secondary" data-view="vocabulary-learn-p79">Về từ đang học</button></aside>` : ''}</section></div>`;
  }

  function personalView() {
    if (!runtime.config) return loading(); const items = PersonalVocabularyService.all();
    return `<div class="p79-shell">${header('Bộ từ cá nhân', 'Từ trong phim, công việc hay TOPIK dùng chung SRS, practice và mastery.', 'vocabulary-immersion-p79')}<form class="section p79-inline-form" data-p79-create-collection><input name="title" maxlength="80" required placeholder="Ví dụ: Từ trong phim"><button class="btn primary">Tạo collection</button></form><section class="section p79-collections">${items.map((collection) => `<article><header><div><small>CUSTOM VOCABULARY COLLECTION</small><h2>${escapeHtml(collection.title)}</h2><p>${collection.wordIds?.length || 0} từ · dùng chung SRS</p></div></header><form data-p79-add-word="${collection.id}"><input name="korean" lang="ko" required placeholder="Từ tiếng Hàn"><input name="pronunciation" placeholder="Phát âm"><input name="meaning" required placeholder="Nghĩa tiếng Việt"><select name="wordType">${(runtime.config.wordTypes || []).map((type) => `<option>${escapeHtml(type)}</option>`).join('')}</select><input name="example" lang="ko" placeholder="Câu ví dụ"><input name="commonMistake" placeholder="Lỗi thường gặp"><button class="btn secondary">Thêm vào SRS</button></form><div class="p79-personal-words">${(collection.customWords || []).map((word) => `<button data-p79-learn="${word.id}"><b lang="ko">${escapeHtml(word.korean)}</b><span>${escapeHtml(word.meaning)}</span><small>L${VocabularyMasteryBridgeService.level(word.id)}/5</small></button>`).join('') || '<p>Chưa có từ tự tạo.</p>'}</div></article>`).join('') || '<div class="empty-state"><p>Chưa có collection. Tạo bộ đầu tiên để gom từ bạn gặp trong đời sống.</p></div>'}</section></div>`;
  }

  function offlineView() {
    if (!runtime.config) return loading(); return `<div class="p79-shell">${header('Vocabulary Offline Packs', 'Tải dữ liệu chủ đề để học và luyện khi không có mạng.', 'vocabulary-immersion-p79')}<section class="section p79-offline-grid">${VocabularyOfflinePackService.all().map((pack) => `<article><span>⇩</span><div><small>${pack.topicIds.length} chủ đề</small><h2>${escapeHtml(pack.title)}</h2><p>${pack.vocabularyCount} từ · dữ liệu học vẫn dùng SRS hiện tại</p></div><button class="btn ${pack.downloaded ? 'secondary' : 'primary'}" data-p79-download="${pack.id}" ${pack.downloaded ? 'disabled' : ''}>${pack.downloaded ? '✓ Đã tải' : 'Tải pack'}</button></article>`).join('')}</section></div>`;
  }

  function analyticsView() {
    if (!runtime.config) return loading(); const report = VocabularyAnalyticsService.summary();
    return `<div class="p79-shell">${header('Vocabulary Analytics', 'Chỉ tính từ bằng chứng luyện thật trên SRS/mastery hiện có.', 'vocabulary-immersion-p79')}<section class="section p79-stats"><article><b>${report.totalWords}</b><span>Total words</span></article><article><b>${report.masteredWords}</b><span>Mastered words</span></article><article><b>${report.weakWords}</b><span>Weak words</span></article><article><b>${report.activeWords}</b><span>Active words</span></article></section><section class="section p79-topic-analytics">${report.topicProgress.map((topic) => `<button data-p79-topic="${topic.id}"><span>${escapeHtml(topic.title)}</span><div class="p79-progress"><i style="width:${topic.completion}%"></i></div><b>${topic.completed}/${topic.total} · ${topic.completion}%</b></button>`).join('')}</section></div>`;
  }

  Object.assign(global, { P79VocabularyConfigService, VocabularyTopicLibraryService, VocabularyMasteryBridgeService, VocabularyPracticeService, VocabularyTopicAchievementService, PersonalVocabularyService, VocabularyAnalyticsService, VocabularyOfflinePackService });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'vocabulary-immersion-p79': libraryView, 'vocabulary-topic-p79': topicView, 'vocabulary-learn-p79': learnView, 'vocabulary-practice-p79': practiceView, 'personal-vocabulary-p79': personalView, 'vocabulary-offline-p79': offlineView, 'vocabulary-analytics-p79': analyticsView };

  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (state.currentView === 'lessons' && !global.document?.querySelector?.('[data-p79-entry]')) global.document.querySelector('.learning-directory, .section, #app')?.insertAdjacentHTML('afterbegin', '<button class="learning-directory-item p79-entry" data-view="vocabulary-immersion-p79" data-p79-entry><span>어</span><div><b>Vocabulary Immersion</b><small>17 chủ đề · nghe · đọc · viết · nói · sử dụng</small></div><i>›</i></button>');
    global.document?.querySelectorAll?.('[data-p79-topic]')?.forEach((button) => { button.onclick = () => VocabularyTopicLibraryService.select(button.dataset.p79Topic); });
    global.document?.querySelectorAll?.('[data-p79-learn]')?.forEach((button) => { button.onclick = () => { const word = findWord(button.dataset.p79Learn); if (!word) return; runtime.wordId = word.id; runtime.topicId = word.topicId || runtime.topicId; runtime.practiceResult = null; VocabularyMasteryBridgeService.activate(word.id); setView('vocabulary-learn-p79'); }; });
    global.document?.querySelectorAll?.('[data-p79-audio]')?.forEach((button) => { button.onclick = () => speakKorean?.(button.dataset.p79Audio); });
    global.document?.querySelectorAll?.('[data-p79-practice]')?.forEach((button) => { button.onclick = () => { runtime.practiceMode = button.dataset.p79Practice; runtime.practiceResult = null; setView('vocabulary-practice-p79'); }; });
    global.document?.querySelectorAll?.('[data-p79-mode]')?.forEach((button) => { button.onclick = () => { runtime.practiceMode = button.dataset.p79Mode; runtime.practiceResult = null; render(); }; });
    global.document?.querySelectorAll?.('[data-p79-answer]')?.forEach((button) => { button.onclick = () => { VocabularyPracticeService.grade(runtime.wordId, runtime.practiceMode, button.dataset.p79Answer); render(); }; });
    const answerForm = global.document?.querySelector?.('[data-p79-answer-form]'); if (answerForm) answerForm.onsubmit = async (event) => { event.preventDefault(); const data = new FormData(answerForm); const capture = global.VoiceCaptureService?.active?.() ? await global.VoiceCaptureService.stop() : runtime.capture; VocabularyPracticeService.grade(runtime.wordId, runtime.practiceMode, data.get('answer') || capture?.transcript || ''); runtime.capture = null; render(); };
    global.document?.querySelector?.('[data-p79-record]')?.addEventListener('click', async () => { if (!global.VoiceCaptureService?.supported?.().microphone && !global.VoiceCaptureService?.supported?.().recognition) return toast?.('Micro không khả dụng. Hãy nhập câu trả lời.'); if (global.VoiceCaptureService.active?.()) { runtime.capture = await global.VoiceCaptureService.stop(); toast?.('Đã nhận giọng nói; bấm Kiểm tra.'); } else { await global.VoiceCaptureService.start({ onResult: (value) => { runtime.capture = value; } }); toast?.('Đang nghe… nhấn lại để dừng.'); } });
    global.document?.querySelector?.('[data-p79-retry]')?.addEventListener('click', () => { runtime.practiceResult = null; render(); });
    global.document?.querySelector?.('[data-p79-seen]')?.addEventListener('click', (event) => { VocabularyMasteryBridgeService.activate(event.currentTarget.dataset.p79Seen); toast?.('Đã đưa vào SRS ở Level 1. Hãy luyện đủ kỹ năng để lên cấp.'); render(); });
    const createForm = global.document?.querySelector?.('[data-p79-create-collection]'); if (createForm) createForm.onsubmit = (event) => { event.preventDefault(); try { PersonalVocabularyService.create(new FormData(createForm).get('title')); toast?.('Đã tạo bộ từ cá nhân.'); render(); } catch (error) { toast?.(error.message); } };
    global.document?.querySelectorAll?.('[data-p79-add-word]')?.forEach((form) => { form.onsubmit = (event) => { event.preventDefault(); try { PersonalVocabularyService.add(form.dataset.p79AddWord, Object.fromEntries(new FormData(form).entries())); toast?.('Đã thêm từ vào collection và SRS.'); render(); } catch (error) { toast?.(error.message); } }; });
    global.document?.querySelectorAll?.('[data-p79-download]')?.forEach((button) => { button.onclick = async () => { button.disabled = true; const result = await VocabularyOfflinePackService.download(button.dataset.p79Download); toast?.(result.status === 'downloaded' ? 'Đã tải Vocabulary Offline Pack.' : 'Không thể tải pack.'); render(); }; });
  };
  P79VocabularyConfigService.load();
})(window);
