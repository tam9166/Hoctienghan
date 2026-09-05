/* Tiếng Hàn - TamHoanq — language mastery enhancement layer */
(function buildLanguageMastery(global) {
  'use strict';
  const app = global.KLEARN_APP;
  const data = global.KLEARN_LANGUAGE_MASTERY_DATA;
  if (!app || !data) return;

  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, userScoped, saveUserScoped, DictionaryService, MasteryService, CloudSyncService, speakKorean, PronunciationProvider } = app;
  const runtime = state.languageMastery || (state.languageMastery = { sceneId: '', lineIndex: 0, lookup: null, imageIndex: 0, grammarId: '' });
  const now = () => new Date().toISOString();
  const uid = () => state.currentUser?.id || '';
  const lang = () => document.documentElement?.lang || 'vi';
  const localize = (value) => typeof value === 'string' ? value : (value?.[lang()] || value?.vi || value?.en || '');
  const copy = (vi, en, zh) => localize({ vi, en, 'zh-CN': zh });
  const safeRecord = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const persisted = () => safeRecord(userScoped(STORAGE_KEYS.languageMastery)[0]);
  const saveProgress = (changes = {}) => {
    const value = { ...persisted(), ...changes, userId: uid(), updatedAt: now() };
    saveUserScoped(STORAGE_KEYS.languageMastery, [value], 5);
    CloudSyncService?.schedule?.('language-mastery');
    return value;
  };
  const scene = () => data.subtitleScenes.find((item) => item.id === runtime.sceneId) || data.subtitleScenes[0];
  const line = () => scene().lines[runtime.lineIndex % scene().lines.length];

  const SubtitleLearningService = {
    scenes: () => data.subtitleScenes,
    progress: persisted,
    selectScene(sceneId) { runtime.sceneId = data.subtitleScenes.some((item) => item.id === sceneId) ? sceneId : data.subtitleScenes[0].id; runtime.lineIndex = 0; runtime.lookup = null; return scene(); },
    selectLine(index) { runtime.lineIndex = Math.max(0, Math.min(Number(index) || 0, scene().lines.length - 1)); runtime.lookup = null; return line(); },
    toggleTranslation() { const visible = persisted().translationVisible !== false; return saveProgress({ translationVisible: !visible }); },
    saveSentence(item = line()) {
      const existing = userScoped(STORAGE_KEYS.savedSentences);
      const record = { id: `subtitle-${scene().id}-${runtime.lineIndex}`, korean: item.korean, translation: localize(item.translation), source: 'subtitle-learning', sceneId: scene().id, createdAt: now() };
      saveUserScoped(STORAGE_KEYS.savedSentences, [record, ...existing.filter((saved) => saved.id !== record.id)], 100);
      CloudSyncService?.schedule?.('subtitle-sentence');
      return record;
    },
    completeScene(sceneId = scene().id) {
      const completedIds = [...new Set([...(persisted().completedSceneIds || []), sceneId])];
      MasteryService?.updateLesson?.(`subtitle:${sceneId}`, 85, { kind: 'subtitle-conversation' });
      return saveProgress({ completedSceneIds: completedIds, lastSceneId: sceneId, lastCompletedAt: now() });
    },
    isSaved(item = line()) { return userScoped(STORAGE_KEYS.savedSentences).some((saved) => saved.source === 'subtitle-learning' && saved.korean === item.korean); }
  };

  const PronunciationHeatmapService = {
    analyze(target = '', transcript = '') {
      const evaluated = PronunciationProvider?.evaluate?.({ target, transcript }) || { score: 0, breakdown: { segments: [] } };
      const segments = (evaluated.breakdown?.segments || []).map((item) => ({ ...item, strength: item.status === 'correct' ? 'strong' : item.status === 'close' ? 'developing' : 'weak' }));
      return { score: Number(evaluated.score || 0), segments, weakSounds: [...new Set(segments.flatMap((item) => item.focus || []))] };
    },
    recentWeakSounds(limit = 5) {
      const attempts = app.getUserProgress?.().pronunciationAttempts || [];
      const counts = {};
      attempts.forEach((attempt) => (attempt.breakdown?.focusSounds || []).forEach((sound) => { counts[sound] = (counts[sound] || 0) + 1; }));
      return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([sound, count]) => ({ sound, count }));
    }
  };

  const GrammarMistakePredictionService = {
    rules: [
      { id: 'grammar_eun_neun', label: '은/는', terms: ['은/는', '저가', 'topic particle', 'trợ từ chủ đề'] },
      { id: 'grammar_i_ga', label: '이/가', terms: ['이/가', '제가', 'subject particle', 'trợ từ chủ ngữ'] },
      { id: 'grammar_e_eseo', label: '에 / 에서', terms: ['에/에서', '학교에 공부', '에서', 'nơi hành động'] },
      { id: 'grammar_ieyo_yeyo', label: '이에요/예요', terms: ['이에요/예요', '의사이에요', '예요', '이에요'] }
    ],
    all() {
      const errors = global.ErrorNotebookService?.all?.() || global.ErrorNotebookService?.top?.(100) || [];
      return this.rules.map((rule) => {
        const matches = errors.filter((error) => {
          const haystack = `${error.type || ''} ${error.question || ''} ${error.mistake || ''} ${error.correction || ''} ${error.explanation || ''}`.toLocaleLowerCase();
          return rule.terms.some((term) => haystack.includes(term.toLocaleLowerCase()));
        });
        return { ...rule, count: matches.reduce((sum, item) => sum + Number(item.count || 1), 0), lastSeenAt: matches.map((item) => item.updatedAt || item.createdAt).filter(Boolean).sort().pop() || null };
      }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count);
    },
    forGrammar(grammarId) { return this.all().find((item) => item.id === grammarId) || null; }
  };

  const VocabularyImageMemoryService = {
    all: () => data.imageVocabulary,
    entry(item) {
      return DictionaryService.search(item.korean)[0] || { id: item.id, korean: item.korean, meanings: { vi: item.meaning, en: item.meaning, 'zh-CN': item.meaning }, meaningVi: item.meaning, exampleVi: item.example, tags: [item.category] };
    },
    addToSrs(item) { const entry = this.entry(item); DictionaryService.addToSrs(entry); return entry; }
  };

  function lookupMarkup() {
    const current = line(); const lookup = runtime.lookup;
    if (!lookup) return `<aside class="subtitle-lookup empty"><span>${copy('Chạm vào từ hoặc điểm ngữ pháp được đánh dấu.', 'Tap a marked word or grammar point.', '点击标记的单词或语法点。')}</span></aside>`;
    if (lookup.type === 'grammar') {
      const note = data.grammarNotes[lookup.key] || { explanation: copy('Đang cập nhật giải thích.', 'Explanation is being updated.', '讲解正在更新。'), usage: current.korean };
      return `<aside class="subtitle-lookup"><p class="eyebrow">Grammar</p><h2 lang="ko">${escapeHtml(lookup.key)}</h2><p>${escapeHtml(note.explanation)}</p><div class="subtitle-usage"><span>${copy('Dùng thật', 'Real usage', '实际用法')}</span><b lang="ko">${escapeHtml(note.usage)}</b><button data-mastery-speak="${escapeHtml(note.usage)}">🔊</button></div><button class="text-link" data-subtitle-close>${copy('Đóng giải thích', 'Close', '关闭')}</button></aside>`;
    }
    const note = data.wordNotes[lookup.key] || {}; const entry = DictionaryService.search(lookup.key)[0];
    return `<aside class="subtitle-lookup"><p class="eyebrow">Vocabulary</p><div class="subtitle-lookup-title"><h2 lang="ko">${escapeHtml(lookup.key)}</h2><button data-mastery-speak="${escapeHtml(lookup.key)}">🔊</button></div><small>${escapeHtml(note.partOfSpeech || entry?.partOfSpeech || '')}</small><p>${escapeHtml(note.meaning || entry?.meanings?.vi || entry?.meaningVi || copy('Đang cập nhật nghĩa.', 'Meaning is being updated.', '释义正在更新。'))}</p>${note.example ? `<div class="subtitle-usage"><span>${copy('Ví dụ', 'Example', '例句')}</span><b lang="ko">${escapeHtml(note.example)}</b></div>` : ''}<div class="subtitle-lookup-actions">${entry ? `<button class="btn primary" data-subtitle-srs="${escapeHtml(entry.id)}">+ SRS</button>` : ''}<button class="text-link" data-subtitle-close>${copy('Đóng', 'Close', '关闭')}</button></div></aside>`;
  }

  function subtitleSegments(item) {
    return item.segments.map((segment) => `<button class="subtitle-token ${segment.type}" data-subtitle-${segment.type}="${escapeHtml(segment.key)}">${escapeHtml(segment.text)}</button>`).join('');
  }

  function subtitleLearningView() {
    const currentScene = scene(); const currentLine = line(); const progress = persisted(); const translationVisible = progress.translationVisible !== false; const saved = SubtitleLearningService.isSaved(currentLine);
    return `<section class="section page-heading subtitle-heading"><button class="back-link" data-view="language-mastery">← ${copy('Làm chủ ngôn ngữ', 'Language mastery', '语言掌握')}</button><p class="eyebrow">Subtitle Learning · ${escapeHtml(currentScene.level)}</p><h1 class="headline">${escapeHtml(localize(currentScene.title))}</h1><p class="subtle">${copy('Nghe hội thoại, đọc phụ đề Hàn, tra ngay trong dòng và chủ động ẩn bản dịch.', 'Listen, read Korean subtitles, inspect words in place and hide translation when ready.', '听对话、阅读韩语字幕、就地查词，并在准备好后隐藏翻译。')}</p></section><nav class="subtitle-scene-tabs section">${data.subtitleScenes.map((item) => `<button class="${item.id === currentScene.id ? 'active' : ''}" data-subtitle-scene="${item.id}"><b>${escapeHtml(localize(item.title))}</b><small>${escapeHtml(item.level)} · ${escapeHtml(item.topic)}</small></button>`).join('')}</nav><section class="subtitle-player section"><div class="subtitle-scene-visual ${escapeHtml(currentScene.setting)}" role="img" aria-label="${escapeHtml(currentScene.topic)}"><span>${currentScene.setting === 'cafe' ? '☕' : currentScene.setting === 'street' ? '🚇' : '▦'}</span><small>${escapeHtml(currentScene.topic)}</small></div><div class="subtitle-dialogue"><header><span>${runtime.lineIndex + 1}/${currentScene.lines.length}</span><button data-subtitle-translation aria-pressed="${translationVisible}">${translationVisible ? copy('Ẩn bản dịch', 'Hide translation', '隐藏翻译') : copy('Hiện bản dịch', 'Show translation', '显示翻译')}</button></header><div class="subtitle-active-line"><small>${escapeHtml(currentLine.speaker)}</small><p lang="ko">${subtitleSegments(currentLine)}</p><div class="subtitle-translation ${translationVisible ? '' : 'hidden'}">${escapeHtml(localize(currentLine.translation))}</div><div class="subtitle-line-actions"><button data-mastery-speak="${escapeHtml(currentLine.korean)}">▶ ${copy('Nghe câu', 'Play line', '播放句子')}</button><button data-subtitle-save class="${saved ? 'saved' : ''}">${saved ? `✓ ${copy('Đã lưu', 'Saved', '已保存')}` : `＋ ${copy('Lưu câu', 'Save sentence', '保存句子')}`}</button></div></div><div class="subtitle-line-list">${currentScene.lines.map((item, index) => `<button class="${index === runtime.lineIndex ? 'active' : ''}" data-subtitle-line="${index}"><span>${escapeHtml(item.speaker)}</span><b lang="ko">${escapeHtml(item.korean)}</b>${translationVisible ? `<small>${escapeHtml(localize(item.translation))}</small>` : ''}</button>`).join('')}</div><div class="subtitle-navigation"><button class="btn secondary" data-subtitle-previous ${runtime.lineIndex === 0 ? 'disabled' : ''}>←</button><button class="btn primary" data-subtitle-next>${runtime.lineIndex === currentScene.lines.length - 1 ? copy('Hoàn thành đoạn', 'Complete scene', '完成片段') : copy('Câu tiếp theo', 'Next line', '下一句')}</button></div></div>${lookupMarkup()}</section>`;
  }

  function masteryHubView() {
    const subtitle = persisted(); const weak = PronunciationHeatmapService.recentWeakSounds(); const predictions = GrammarMistakePredictionService.all(); const shadowCount = global.ShadowingRecorderService?.all?.().length || 0; const collections = global.VocabularyCollectionService?.all?.().length || 0;
    const tools = [
      ['▤', copy('Học qua phụ đề', 'Subtitle learning', '字幕学习'), copy('Hội thoại · tra từ · grammar · lưu câu', 'Dialogue · lookup · grammar · save sentences', '对话 · 查词 · 语法 · 保存句子'), 'subtitle-learning'],
      ['◉', copy('Luyện phát âm', 'Pronunciation heatmap', '发音热图'), weak.length ? `${copy('Âm cần luyện', 'Sounds to practise', '需练习音')}: ${weak.map((item) => item.sound).join(' · ')}` : copy('Phản hồi theo từng âm tiết', 'Syllable-level feedback', '逐音节反馈'), 'speaking-room'],
      ['≋', 'Shadowing Advanced', `${shadowCount} ${copy('lượt đã lưu', 'saved sessions', '次已保存')}`, 'shadowing-recorder'],
      ['▧', copy('Ảnh gợi nhớ từ', 'Vocabulary image memory', '词汇图像记忆'), copy('Ảnh · audio · ví dụ · nghĩa', 'Image · audio · example · meaning', '图像 · 音频 · 例句 · 释义'), 'vocabulary-image-memory'],
      ['文', copy('Ngữ pháp dùng thật', 'Grammar example bank', '真实语法例库'), predictions.length ? `${copy('Cảnh báo cá nhân', 'Personal warnings', '个人提醒')}: ${predictions.length}` : copy('Ví dụ đúng, sai và đời thường', 'Correct, wrong and real usage', '正确、错误与真实用法'), 'grammar-mastery'],
      ['✓', 'Collocation Trainer', '운동하다 ✓ · 운동을 먹다 ✗', 'collocation-trainer'],
      ['⌨', 'Dictation Master', copy('Nghe · nhập Hangul · tô lỗi', 'Listen · type Hangul · highlight errors', '听写 · 输入韩文 · 标记错误'), 'dictation-master'],
      ['＋', copy('Bộ từ cá nhân', 'Personal vocabulary notebook', '个人词汇本'), `${collections} ${copy('bộ từ', 'collections', '个词集')}`, 'vocabulary-collections']
    ];
    return `<section class="section page-heading"><button class="back-link" data-view="lessons">← ${copy('Học tập', 'Learn', '学习')}</button><p class="eyebrow">P1 · Language Mastery</p><h1 class="headline">${copy('Dùng tiếng Hàn tự nhiên hơn', 'Use Korean more naturally', '更自然地使用韩语')}</h1><p class="subtle">${copy('Một nơi để luyện nghe–nói, ghi nhớ từ trong ngữ cảnh và sửa đúng lỗi ngữ pháp bạn thường gặp.', 'One place for listening, speaking, contextual vocabulary and your recurring grammar mistakes.', '集中练习听说、语境词汇和常见语法错误。')}</p></section><section class="mastery-summary section"><div><b>${(subtitle.completedSceneIds || []).length}/${data.subtitleScenes.length}</b><span>${copy('đoạn hội thoại', 'dialogues', '段对话')}</span></div><div><b>${shadowCount}</b><span>shadowing</span></div><div><b>${weak.length}</b><span>${copy('âm đang luyện', 'focus sounds', '个待练音')}</span></div></section><section class="mastery-tool-grid section">${tools.map(([icon, title, description, view]) => `<button data-view="${view}"><span>${icon}</span><div><b>${escapeHtml(title)}</b><small>${escapeHtml(description)}</small></div><i>›</i></button>`).join('')}</section>`;
  }

  function vocabularyImageView() {
    const item = data.imageVocabulary[runtime.imageIndex % data.imageVocabulary.length]; const entry = VocabularyImageMemoryService.entry(item); const inSrs = (state.srsData || []).some((card) => card.wordId === entry.id || card.id === entry.id);
    return `<section class="section page-heading"><button class="back-link" data-view="language-mastery">← ${copy('Làm chủ ngôn ngữ', 'Language mastery', '语言掌握')}</button><p class="eyebrow">Vocabulary Image Memory · ${escapeHtml(item.category)}</p><h1 class="headline">${copy('Nhìn – nghe – nhớ trong câu', 'See, hear and remember in context', '看、听、在句中记忆')}</h1></section><section class="image-memory-card section"><div class="image-memory-visual" style="--memory-color:${escapeHtml(item.color)}" role="img" aria-label="${escapeHtml(item.meaning)}"><span>${item.visual}</span></div><div class="image-memory-content"><small>${runtime.imageIndex + 1}/${data.imageVocabulary.length}</small><h2 lang="ko">${escapeHtml(item.korean)}</h2><p>${escapeHtml(item.meaning)}</p><button class="audio-inline" data-mastery-speak="${escapeHtml(item.audio)}">🔊 ${copy('Nghe từ', 'Play word', '听单词')}</button><div class="image-memory-example"><span>${copy('Trong câu', 'In a sentence', '例句')}</span><b lang="ko">${escapeHtml(item.example)}</b><button data-mastery-speak="${escapeHtml(item.example)}">▶</button></div><button class="btn primary" data-image-srs ${inSrs ? 'disabled' : ''}>${inSrs ? `✓ ${copy('Đã có trong SRS', 'Already in SRS', '已加入 SRS')}` : `+ ${copy('Thêm vào SRS', 'Add to SRS', '加入 SRS')}`}</button></div></section><nav class="image-memory-nav section"><button class="btn secondary" data-image-previous>←</button><div>${data.imageVocabulary.map((_, index) => `<button class="${index === runtime.imageIndex ? 'active' : ''}" data-image-index="${index}" aria-label="${index + 1}"></button>`).join('')}</div><button class="btn secondary" data-image-next>→</button></nav>`;
  }

  function grammarMasteryView() {
    const selected = data.grammarBank.find((item) => item.id === runtime.grammarId) || data.grammarBank[0]; const predictions = GrammarMistakePredictionService.all(); const warning = GrammarMistakePredictionService.forGrammar(selected.id); const saved = global.GrammarNotebookService?.get?.(selected.id);
    return `<section class="section page-heading"><button class="back-link" data-view="language-mastery">← ${copy('Làm chủ ngôn ngữ', 'Language mastery', '语言掌握')}</button><p class="eyebrow">Grammar Example Bank</p><h1 class="headline">${copy('Ngữ pháp trong cách nói thật', 'Grammar in real usage', '真实用法中的语法')}</h1><p class="subtle">${copy('Giải thích ngắn, ví dụ thường gặp, câu sai và cách người Hàn thực sự dùng.', 'Short explanations, common examples, wrong forms and real Korean usage.', '简短讲解、常见例句、错误形式和真实韩语用法。')}</p></section>${predictions.length ? `<section class="grammar-prediction-banner section"><span>!</span><div><b>${copy('Bạn thường sai trợ từ này', 'You often miss this grammar point', '你经常在此语法点出错')}</b><p>${escapeHtml(predictions.slice(0, 3).map((item) => `${item.label} · ${item.count}×`).join('　'))}</p></div></section>` : ''}<nav class="grammar-bank-tabs section">${data.grammarBank.map((item) => `<button class="${item.id === selected.id ? 'active' : ''}" data-grammar-bank="${item.id}"><b lang="ko">${escapeHtml(item.pattern)}</b><small>${escapeHtml(item.title)}</small></button>`).join('')}</nav><section class="grammar-bank-card section">${warning ? `<div class="grammar-personal-warning">⚠ ${copy('Bạn đã gặp lỗi liên quan', 'Related mistakes found', '发现相关错误')} ${warning.count}×</div>` : ''}<header><div><span>${copy('Mẫu câu', 'Pattern', '句型')}</span><h2 lang="ko">${escapeHtml(selected.pattern)}</h2></div><button class="btn ${saved ? 'secondary' : 'primary'}" data-grammar-save="${selected.id}">${saved ? `✓ ${copy('Trong sổ', 'In notebook', '已收藏')}` : `+ ${copy('Lưu vào sổ', 'Save to notebook', '保存到语法本')}`}</button></header><p>${escapeHtml(selected.explanation)}</p><div class="grammar-bank-columns"><section><h3>${copy('Ví dụ thường gặp', 'Common examples', '常见例句')}</h3>${selected.common.map((example) => `<p class="grammar-good" lang="ko"><span>✓</span>${escapeHtml(example)}<button data-mastery-speak="${escapeHtml(example)}">🔊</button></p>`).join('')}</section><section><h3>${copy('Ví dụ sai', 'Wrong examples', '错误例句')}</h3>${selected.wrong.map((example) => `<div class="grammar-wrong"><p lang="ko"><span>✗</span>${escapeHtml(example.text)}</p><b lang="ko">→ ${escapeHtml(example.correction)}</b><small>${escapeHtml(example.reason)}</small></div>`).join('')}</section></div><div class="grammar-real-usage"><span>💡 ${copy('Người Hàn thường nói', 'Korean people usually say', '韩国人常说')}</span><b lang="ko">${escapeHtml(selected.realUsage)}</b><button data-mastery-speak="${escapeHtml(selected.realUsage)}">▶</button></div></section>`;
  }

  function pronunciationHeatmapMarkup(result) {
    if (!result?.target || !result?.transcript) return '';
    const analysis = PronunciationHeatmapService.analyze(result.target, result.transcript);
    if (!analysis.segments.length) return '';
    return `<section class="pronunciation-heatmap"><header><div><p class="eyebrow">Pronunciation Heatmap</p><h3>${copy('Độ rõ theo từng âm tiết', 'Clarity by syllable', '逐音节清晰度')}</h3></div><span>${analysis.score}/100</span></header><div class="pronunciation-heatmap-row" lang="ko">${analysis.segments.map((item) => `<span class="${item.strength}" style="--segment-score:${item.score}%"><b>${escapeHtml(item.syllable)}</b><small>${item.status === 'correct' ? '✓' : '△'} ${item.score}%</small></span>`).join('')}</div>${analysis.weakSounds.length ? `<p>${copy('Âm yếu cần luyện', 'Weak sounds to practise', '需要练习的弱音')}: <b>${escapeHtml(analysis.weakSounds.join(' · '))}</b></p>` : `<p>✓ ${copy('Các âm tiết đều được nhận diện rõ.', 'All syllables were recognised clearly.', '所有音节均识别清晰。')}</p>`}</section>`;
  }

  function nativeComparisonMarkup() {
    const prompt = state.speakingPrompt || global.KLEARN_MODULE_DATA?.speakingModes?.find((item) => item.id === state.speakingMode) || {}; const target = prompt.korean || prompt.appLine || ''; if (!target) return '';
    const result = state.speakingResult || state.pronunciationResult;
    return `<section class="native-voice-comparison section"><header><div><p class="eyebrow">Native Voice Comparison</p><h2>${copy('Nghe mẫu rồi đối chiếu bản thu', 'Listen to the model, then compare', '听示范后对比录音')}</h2></div><span>ko-KR</span></header><div class="native-compare-grid"><div><small>1 · ${copy('Giọng mẫu', 'Model voice', '示范语音')}</small><b lang="ko">${escapeHtml(target)}</b><button class="btn secondary" data-mastery-speak="${escapeHtml(target)}">▶ ${copy('Nghe mẫu', 'Play model', '播放示范')}</button></div><div><small>2 · ${copy('Bản thu của bạn', 'Your recording', '你的录音')}</small>${state.recordedAudioUrl ? `<audio controls src="${escapeHtml(state.recordedAudioUrl)}"></audio>` : `<p>${copy('Thu âm bằng nút micro bên dưới. Audio chỉ tồn tại tạm trong tab.', 'Record with the microphone below. Audio stays only in this tab.', '使用下方麦克风录音，音频仅临时保存在当前标签页。')}</p>`}</div></div>${result ? `<div class="native-compare-result"><span>${copy('Độ khớp transcript', 'Transcript match', '文本匹配度')}</span><strong>${Number(result.score || 0)}%</strong><p>${escapeHtml(result.feedback || '')}</p></div>` : ''}<small>${copy('Giọng mẫu dùng voice tiếng Hàn có sẵn trên thiết bị; đây không phải chấm âm vị chuyên sâu.', 'The model uses an available Korean device voice; this is not advanced phoneme scoring.', '示范使用设备上的韩语语音，并非专业音素评分。')}</small></section>`;
  }

  function enhanceExistingViews() {
    if (state.currentView === 'lessons' && !document.querySelector('.language-mastery-entry')) document.querySelector('.learning-directory')?.insertAdjacentHTML('afterbegin', `<button class="learning-directory-item language-mastery-entry" data-view="language-mastery"><span>말</span><div><b>${copy('Làm chủ ngôn ngữ', 'Language mastery', '语言掌握')}</b><small>Subtitle · Pronunciation · Vocabulary · Grammar</small></div><i>›</i></button>`);
    if (state.currentView === 'speaking-session' && !document.querySelector('.native-voice-comparison')) document.querySelector('.speaking-stage')?.insertAdjacentHTML('afterend', nativeComparisonMarkup());
    if (state.currentView === 'speaking-session' && !document.querySelector('.pronunciation-heatmap')) {
      const result = state.speakingResult || state.pronunciationResult; const markup = pronunciationHeatmapMarkup(result); const anchor = document.querySelector('.pronunciation-breakdown') || document.querySelector('.pronunciation-result .score-display'); if (markup && anchor) anchor.insertAdjacentHTML('afterend', markup);
    }
    if (state.currentView === 'shadowing-recorder' && !document.querySelector('.shadowing-advanced-flow')) {
      const saved = global.ShadowingRecorderService?.all?.() || []; const hasRecording = Boolean(document.querySelector('#shadowAudio'));
      document.querySelector('.shadowing-workspace')?.insertAdjacentHTML('afterbegin', `<section class="shadowing-advanced-flow"><header><div><p class="eyebrow">Shadowing Advanced</p><h2>${copy('Nghe → Lặp lại → Thu âm → So sánh', 'Listen → Repeat → Record → Compare', '听 → 跟读 → 录音 → 对比')}</h2></div><span>${saved.length} ${copy('lượt đã lưu', 'saved', '次已保存')}</span></header><ol><li class="done"><b>1</b><span>${copy('Nghe', 'Listen', '听')}</span></li><li class="${hasRecording ? 'done' : 'current'}"><b>2</b><span>${copy('Lặp lại', 'Repeat', '跟读')}</span></li><li class="${hasRecording ? 'done' : ''}"><b>3</b><span>${copy('Thu âm', 'Record', '录音')}</span></li><li class="${hasRecording ? 'current' : ''}"><b>4</b><span>${copy('So sánh', 'Compare', '对比')}</span></li></ol></section>`);
    }
    if (state.currentView === 'vocabulary-collections' && !document.querySelector('.collection-presets')) {
      const titles = new Set((global.VocabularyCollectionService?.all?.() || []).map((item) => item.title));
      const presets = [copy('Công việc', 'Work', '工作'), copy('Du lịch', 'Travel', '旅行'), copy('Phim', 'Movies', '电影'), copy('Từ khó nhớ', 'Hard to remember', '难记词')].filter((title) => !titles.has(title));
      if (presets.length) document.querySelector('.inline-create')?.insertAdjacentHTML('afterend', `<section class="collection-presets section"><span>${copy('Tạo nhanh', 'Quick create', '快速创建')}</span>${presets.map((title) => `<button data-collection-preset="${escapeHtml(title)}">＋ ${escapeHtml(title)}</button>`).join('')}</section>`);
    }
    if (['grammar-compare', 'grammar-notebook'].includes(state.currentView) && !document.querySelector('.grammar-prediction-inline')) {
      const top = GrammarMistakePredictionService.all()[0]; if (top) document.querySelector('.page-heading')?.insertAdjacentHTML('afterend', `<button class="grammar-prediction-inline section" data-view="grammar-mastery"><span>!</span><div><b>${copy('Bạn thường sai trợ từ này', 'You often miss this grammar point', '你经常在此语法点出错')}</b><small>${escapeHtml(top.label)} · ${top.count}×</small></div><i>›</i></button>`);
    }
  }

  function bind() {
    document.querySelectorAll('[data-mastery-speak]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.masterySpeak); });
    document.querySelectorAll('[data-subtitle-scene]').forEach((button) => { button.onclick = () => { SubtitleLearningService.selectScene(button.dataset.subtitleScene); render(); }; });
    document.querySelectorAll('[data-subtitle-line]').forEach((button) => { button.onclick = () => { SubtitleLearningService.selectLine(button.dataset.subtitleLine); render(); }; });
    document.querySelectorAll('[data-subtitle-word]').forEach((button) => { button.onclick = () => { runtime.lookup = { type: 'word', key: button.dataset.subtitleWord }; render(); }; });
    document.querySelectorAll('[data-subtitle-grammar]').forEach((button) => { button.onclick = () => { runtime.lookup = { type: 'grammar', key: button.dataset.subtitleGrammar }; render(); }; });
    document.querySelector('[data-subtitle-close]')?.addEventListener('click', () => { runtime.lookup = null; render(); });
    document.querySelector('[data-subtitle-translation]')?.addEventListener('click', () => { SubtitleLearningService.toggleTranslation(); render(); });
    document.querySelector('[data-subtitle-save]')?.addEventListener('click', () => { SubtitleLearningService.saveSentence(); toast(copy('Đã lưu câu vào sổ tay.', 'Sentence saved.', '句子已保存。')); render(); });
    document.querySelector('[data-subtitle-srs]')?.addEventListener('click', (event) => { const entry = DictionaryService.byId(event.currentTarget.dataset.subtitleSrs); DictionaryService.addToSrs(entry); toast(copy('Đã thêm từ vào SRS.', 'Added to SRS.', '已加入 SRS。')); });
    document.querySelector('[data-subtitle-previous]')?.addEventListener('click', () => { SubtitleLearningService.selectLine(runtime.lineIndex - 1); render(); });
    document.querySelector('[data-subtitle-next]')?.addEventListener('click', () => { if (runtime.lineIndex < scene().lines.length - 1) SubtitleLearningService.selectLine(runtime.lineIndex + 1); else { SubtitleLearningService.completeScene(); toast(copy('Đã lưu tiến độ đoạn hội thoại.', 'Dialogue progress saved.', '对话进度已保存。')); } render(); });
    document.querySelectorAll('[data-image-index]').forEach((button) => { button.onclick = () => { runtime.imageIndex = Number(button.dataset.imageIndex) || 0; render(); }; });
    document.querySelector('[data-image-previous]')?.addEventListener('click', () => { runtime.imageIndex = (runtime.imageIndex - 1 + data.imageVocabulary.length) % data.imageVocabulary.length; render(); });
    document.querySelector('[data-image-next]')?.addEventListener('click', () => { runtime.imageIndex = (runtime.imageIndex + 1) % data.imageVocabulary.length; render(); });
    document.querySelector('[data-image-srs]')?.addEventListener('click', () => { VocabularyImageMemoryService.addToSrs(data.imageVocabulary[runtime.imageIndex]); toast(copy('Đã thêm từ vào SRS.', 'Added to SRS.', '已加入 SRS。')); render(); });
    document.querySelectorAll('[data-grammar-bank]').forEach((button) => { button.onclick = () => { runtime.grammarId = button.dataset.grammarBank; render(); }; });
    document.querySelector('[data-grammar-save]')?.addEventListener('click', (event) => { global.GrammarNotebookService?.upsert?.(event.currentTarget.dataset.grammarSave); toast(copy('Đã lưu vào sổ ngữ pháp.', 'Saved to grammar notebook.', '已保存到语法本。')); render(); });
    document.querySelectorAll('[data-collection-preset]').forEach((button) => { button.onclick = () => { const item = global.VocabularyCollectionService?.create?.(button.dataset.collectionPreset); if (item) toast(copy('Đã tạo bộ từ.', 'Collection created.', '词集已创建。')); render(); }; });
  }

  global.SubtitleLearningService = SubtitleLearningService;
  global.PronunciationHeatmapService = PronunciationHeatmapService;
  global.GrammarMistakePredictionService = GrammarMistakePredictionService;
  global.VocabularyImageMemoryService = VocabularyImageMemoryService;
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'language-mastery': masteryHubView, 'subtitle-learning': subtitleLearningView, 'vocabulary-image-memory': vocabularyImageView, 'grammar-mastery': grammarMasteryView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; enhanceExistingViews(); bind(); };
  render();
})(window);
