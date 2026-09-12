/* P71B — real Korean practice orchestration; reuses voice, SRS, conversation and AI infrastructure. */
(function buildRealKoreanExperience(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, setView, render, toast, escapeHtml, speakKorean, DictionaryService, CloudSyncService } = app;
  const storeKey = STORAGE_KEYS.realKoreanExperience || 'klearn_real_korean_experience';
  const runtime = state.realKoreanExperience || (state.realKoreanExperience = { content: null, loading: null, pronunciationId: '', mediaId: '', mediaLine: 0, subtitles: true, scenarioId: '', shadowingId: '', shadowingSpeed: 1, capture: null, result: null, scenarioResult: null, shadowingResult: null });
  const routes = new Set(['real-korean-experience', 'pronunciation-lab-vn', 'sentence-mining', 'media-learning-real', 'real-conversation-lab', 'real-shadowing-lab']);
  const now = () => new Date().toISOString();
  const clean = (value, limit = 600) => String(value == null ? '' : value).replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  const normalize = (value) => clean(value).replace(/[\s.,!?~…'"“”‘’]/g, '').toLocaleLowerCase();
  const records = () => userScoped(storeKey);
  const write = (items, reason = 'real-korean-experience') => { saveUserScoped(storeKey, items, 400); CloudSyncService?.schedule?.(reason); return items; };
  const saveRecord = (record, reason) => { const value = { id: record.id || `p71b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, ...record, userId: state.currentUser?.id || '', updatedAt: now(), createdAt: record.createdAt || now() }; write([value, ...records().filter((item) => item.id !== value.id)], reason); return value; };
  const similarity = (target, heard) => { const a = [...normalize(target)]; const b = [...normalize(heard)]; if (!a.length || !b.length) return 0; let same = 0; a.forEach((char, index) => { if (char === b[index]) same += 1; }); return Math.round(Math.max(0, Math.min(100, same / Math.max(a.length, b.length) * 100))); };

  const RealKoreanContentService = {
    hydrate(value) {
      if (!value || value.schemaVersion !== 1 || value.status !== 'approved' || value.verified !== true || !Array.isArray(value.pronunciationTargets) || !Array.isArray(value.mediaItems) || !Array.isArray(value.scenarios) || !Array.isArray(value.shadowingLines)) throw new Error('Nội dung P71B chưa qua quality gate');
      runtime.content = Object.freeze(value); return runtime.content;
    },
    load() {
      if (runtime.content) return Promise.resolve(runtime.content);
      if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') return Promise.resolve(null);
      runtime.loading = global.fetch('./content/real-korean-experience.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`P71B content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { toast?.(`Không thể tải nội dung luyện tập: ${error.message}`); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); });
      return runtime.loading;
    },
    get() { return runtime.content; },
    pronunciation() { return runtime.content?.pronunciationTargets || []; },
    media() { return runtime.content?.mediaItems || []; },
    scenarios() { return runtime.content?.scenarios || []; },
    shadowing() { return runtime.content?.shadowingLines || []; }
  };

  const VietnamesePronunciationLabService = {
    all: () => RealKoreanContentService.pronunciation(),
    get(id) { return this.all().find((item) => item.id === id) || this.all()[0] || null; },
    support() { return global.VoiceCaptureService?.supported?.() || { microphone: false, recorder: false, recognition: false, audioSignals: false }; },
    startCapture(callbacks = {}) { return global.VoiceCaptureService?.start?.(callbacks) || Promise.resolve({ status: 'text-fallback' }); },
    stopCapture() { return global.VoiceCaptureService?.stop?.() || Promise.resolve({ status: 'idle', transcript: '', frames: [], durationMs: 0, audioBlob: null, audioStored: false }); },
    async analyze(targetId, input = {}) {
      const target = this.get(targetId); if (!target) return null;
      const transcript = clean(input.transcript, 300); const normalized = normalize(transcript); const accepted = target.accepted.some((item) => normalize(item) === normalized); const confusion = target.confusions.find((item) => normalize(item.heard) === normalized);
      let provider = null;
      if (global.VoiceAnalysisService?.evaluate && transcript) {
        try { provider = await global.VoiceAnalysisService.evaluate({ target: target.word, transcript, expectedKeywords: [target.word], capture: input.capture || {}, recognitionConfidence: input.recognitionConfidence }); } catch (_) { provider = null; }
      }
      const fallbackScore = accepted ? 100 : confusion ? 62 : similarity(target.word, transcript);
      const accuracy = Math.round(provider?.pronunciation ?? fallbackScore);
      const missingSound = !transcript ? target.sound : normalize(target.word).length > normalized.length ? target.focusSyllable : '';
      const wrongSound = confusion?.sound || (transcript && accuracy < 75 ? target.sound : '');
      const feedback = !transcript ? `Chưa nhận được giọng nói. Hãy thử lại hoặc nhập transcript để luyện tiếp.` : confusion?.feedback || (accuracy >= 90 ? `Âm ${target.sound} rõ và đúng mẫu.` : accuracy >= 70 ? `${target.tip} Hãy nghe mẫu rồi nói chậm một lần nữa.` : `Cần luyện lại ${target.sound}. ${target.tip}`);
      const result = { targetId: target.id, target: target.word, transcript, sound: target.sound, accuracy, missingSound, wrongSound, feedback, method: provider?.method || 'transparent-text-fallback', audioStored: false, evaluatedAt: now() };
      const saved = saveRecord({ recordType: 'pronunciation_attempt', ...result }, 'p71b-pronunciation');
      if (accuracy < 75) {
        global.ErrorNotebookService?.add?.({ type: 'pronunciation-vietnamese', question: target.word, mistake: transcript || 'Không nhận được âm', correction: target.word, explanation: feedback });
        global.LearningMemoryService?.upsert?.({ type: 'weak_knowledge', topic: `pronunciation:${target.sound}`, content: feedback, confidence: .8, importance: 4, source: 'p71b-pronunciation' }, { increment: true });
      }
      return saved;
    },
    attempts() { return records().filter((item) => item.recordType === 'pronunciation_attempt'); }
  };

  const SentenceMiningService = {
    sourceTypes() { return runtime.content?.mining?.sourceTypes || []; },
    mine(input = {}) {
      const sourceType = clean(input.sourceType, 20); if (!this.sourceTypes().includes(sourceType)) throw new Error('Nguồn câu chưa được hỗ trợ');
      const sentence = clean(input.sentence || input.text, 300); if (!/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(sentence)) throw new Error('Hãy nhập một câu tiếng Hàn');
      const vocab = (runtime.content.mining.vocabulary || []).filter((item) => [item.surface, ...(item.variants || [])].some((form) => sentence.includes(form)));
      const grammar = (runtime.content.mining.grammar || []).filter((item) => sentence.includes(item.pattern));
      const record = saveRecord({ recordType: 'mined_sentence', sourceType, sourceLabel: clean(input.sourceLabel, 80), sentence, translation: clean(input.translation, 300), vocabulary: vocab.map((item) => ({ id: item.id, korean: item.surface, meaning: item.meaning })), grammar: grammar.map((item) => ({ id: item.id, label: item.label, meaning: item.meaning })), flashcards: vocab.map((item) => ({ id: `mined-${item.id}`, front: item.surface, back: item.meaning })), flashcardIds: vocab.map((item) => `mined-${item.id}`) }, 'p71b-sentence-mining');
      const existing = userScoped(STORAGE_KEYS.savedSentences);
      saveUserScoped(STORAGE_KEYS.savedSentences, [{ id: `mined-${record.id}`, korean: sentence, translation: record.translation, source: `sentence-mining:${sourceType}`, createdAt: now() }, ...existing.filter((item) => item.id !== `mined-${record.id}`)], 100);
      return record;
    },
    createFlashcards(record) {
      const added = [];
      (record?.vocabulary || []).forEach((item) => {
        const entry = DictionaryService?.search?.(item.korean)?.[0] || { id: `mined-${item.id}`, korean: item.korean, meaningVi: item.meaning, meanings: { vi: item.meaning }, tags: ['sentence-mining'] };
        if (DictionaryService?.addToSrs) { DictionaryService.addToSrs(entry); added.push(entry.id); }
      });
      if (record?.id) saveRecord({ ...record, flashcardIds: added, flashcardsCreatedAt: now() }, 'p71b-mining-flashcards');
      return added;
    },
    all() { return records().filter((item) => item.recordType === 'mined_sentence'); }
  };

  const RealMediaLearningService = {
    all: () => RealKoreanContentService.media(),
    get(id) { return this.all().find((item) => item.id === id) || this.all()[0] || null; },
    progress(id) { return records().find((item) => item.recordType === 'media_progress' && item.mediaId === id) || null; },
    complete(mediaId, lineIndex = 0) { return saveRecord({ id: `media-${mediaId}`, recordType: 'media_progress', mediaId, lineIndex: Number(lineIndex) || 0, completed: true, completedAt: now() }, 'p71b-media'); },
    addVocabulary(id) {
      const dictionary = runtime.content?.mining?.vocabulary?.find((item) => item.id === id); if (!dictionary) return null;
      const entry = DictionaryService?.search?.(dictionary.surface)?.[0] || { id: `media-${dictionary.id}`, korean: dictionary.surface, meaningVi: dictionary.meaning, meanings: { vi: dictionary.meaning }, tags: ['media-learning'] };
      DictionaryService?.addToSrs?.(entry); return entry;
    }
  };

  const RealConversationPracticeService = {
    all: () => RealKoreanContentService.scenarios(),
    get(id) { return this.all().find((item) => item.id === id) || this.all()[0] || null; },
    async evaluate(scenarioId, answer, options = {}) {
      const scenario = this.get(scenarioId); const safeAnswer = clean(answer, 500); if (!scenario || !safeAnswer) return null;
      const matched = scenario.expectedKeywords.filter((keyword) => normalize(safeAnswer).includes(normalize(keyword)));
      const meaning = Math.round(45 + matched.length / Math.max(1, scenario.expectedKeywords.length) * 55);
      const hasKorean = /[가-힣]/.test(safeAnswer); const grammar = hasKorean ? (/[.?!요니다]$/.test(safeAnswer) ? 88 : 70) : 20;
      const natural = Math.min(95, 55 + matched.length * 18 + (safeAnswer.length >= 5 ? 10 : 0)); const context = matched.length ? 90 : 55;
      let ai = null;
      if (options.useAi !== false && global.AIOrchestrationService?.request) {
        ai = await global.AIOrchestrationService.request({ task: 'conversation_partner', input: `Đóng vai người Hàn trong tình huống: ${scenario.title}. Bạn vừa nói: ${scenario.partner}. Người học trả lời: ${safeAnswer}. Hãy tiếp tục vai bằng một câu tiếng Hàn ngắn, tự nhiên và phù hợp trình độ.`, context: { currentTopikLevel: state.currentUser?.currentTopikLevel || 1, currentView: 'real-conversation-lab' }, language: 'vi' }).catch(() => ({ fallback: true, reply: '' }));
      }
      const overall = Math.round(meaning * .35 + grammar * .25 + natural * .2 + context * .2);
      const result = saveRecord({ recordType: 'conversation_attempt', scenarioId: scenario.id, topic: scenario.topic, answer: safeAnswer, meaning, grammar, natural, context, overall, suggestion: scenario.suggestion, partnerReply: ai && !ai.fallback ? clean(ai.reply, 600) : scenario.fallbackPartnerReply, feedback: overall >= 80 ? 'Phản hồi phù hợp tình huống.' : scenario.contextTip, aiStatus: !ai ? 'not-requested' : ai.fallback ? 'fallback' : 'available', aiFeedback: ai && !ai.fallback ? clean(ai.reply, 600) : '', audioStored: false }, 'p71b-conversation');
      if (overall < 70) global.ErrorNotebookService?.add?.({ type: 'real-conversation', question: scenario.partner, mistake: safeAnswer, correction: scenario.suggestion, explanation: scenario.contextTip });
      return result;
    },
    attempts() { return records().filter((item) => item.recordType === 'conversation_attempt'); }
  };

  const RealShadowingService = {
    all: () => RealKoreanContentService.shadowing(),
    get(id) { return this.all().find((item) => item.id === id) || this.all()[0] || null; },
    speeds(id) { return this.get(id)?.speeds || [.75, 1, 1.15]; },
    async compare(id, transcript, input = {}) {
      const line = this.get(id); if (!line) return null;
      let analysis = null;
      if (global.VoiceAnalysisService?.evaluate) { try { analysis = await global.VoiceAnalysisService.evaluate({ target: line.korean, transcript: clean(transcript, 300), expectedKeywords: [line.korean], capture: input.capture || {} }); } catch (_) { analysis = null; } }
      const accuracy = Math.round(analysis?.pronunciation ?? similarity(line.korean, transcript)); const fluency = Math.round(analysis?.fluency ?? (accuracy >= 90 ? 88 : Math.max(40, accuracy - 5)));
      const result = saveRecord({ recordType: 'shadowing_attempt', shadowingId: line.id, target: line.korean, transcript: clean(transcript, 300), speed: this.speeds(id).includes(Number(input.speed)) ? Number(input.speed) : 1, accuracy, fluency, score: Math.round(accuracy * .7 + fluency * .3), focus: line.focus, audioStored: false }, 'p71b-shadowing');
      const legacy = userScoped(STORAGE_KEYS.shadowingProgress); saveUserScoped(STORAGE_KEYS.shadowingProgress, [result, ...legacy.filter((item) => item.id !== result.id)], 100);
      return result;
    },
    attempts() { return records().filter((item) => item.recordType === 'shadowing_attempt'); }
  };

  const summary = () => ({ pronunciation: VietnamesePronunciationLabService.attempts().length, mined: SentenceMiningService.all().length, media: records().filter((item) => item.recordType === 'media_progress').length, conversation: RealConversationPracticeService.attempts().length, shadowing: RealShadowingService.attempts().length });
  const heading = (back, eyebrow, title, text) => `<section class="section page-heading p71b-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(text)}</p></section>`;
  const loading = () => { RealKoreanContentService.load(); return `${heading('lessons', 'P71B', 'Đang tải trải nghiệm thực tế…', 'Nội dung đã kiểm duyệt sẽ sẵn sàng ngay cả khi offline sau lần tải đầu.') }<div class="section p71b-loader"></div>`; };
  function hubView() { if (!runtime.content) return loading(); const stats = summary(); const cards = [
    ['pronunciation-lab-vn', '입', 'Phòng luyện phát âm', 'ㄹ · ㅓ · ㅡ · 받침 · nối âm', stats.pronunciation],
    ['sentence-mining', '文', 'Khai thác câu', 'Biến câu thật thành từ, ngữ pháp và flashcard', stats.mined],
    ['media-learning-real', '▶', 'Học qua hội thoại', 'Phụ đề Hàn/Việt và từ vựng trong ngữ cảnh', stats.media],
    ['real-conversation-lab', '話', 'Hội thoại tình huống', 'Nhà hàng · sân bay · phỏng vấn · bệnh viện · công sở', stats.conversation],
    ['real-shadowing-lab', '声', 'Shadowing', 'Nghe · nhắc lại · ghi âm · so sánh', stats.shadowing]
  ]; return `${heading('lessons', 'P71B · REAL KOREAN', 'Dùng tiếng Hàn trong đời thật', 'Một lộ trình luyện liền mạch; AI chỉ góp ý thêm và không làm gián đoạn bài học.')}<section class="section p71b-journey"><span>Nghe mẫu</span><i>→</i><span>Nói hoặc nhập</span><i>→</i><span>Nhận phản hồi</span><i>→</i><span>Luyện lại</span></section><section class="section p71b-grid">${cards.map(([view, icon, title, text, count]) => `<button data-view="${view}" class="p71b-card"><span>${icon}</span><div><small>${count} lượt đã lưu</small><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div><i>›</i></button>`).join('')}</section><p class="section p71b-privacy">Quyền riêng tư: audio chỉ được dùng trong bộ nhớ khi chấm và không được lưu. Transcript và tiến trình thuộc riêng tài khoản của bạn.</p>`; }
  function pronunciationView() { if (!runtime.content) return loading(); const target = VietnamesePronunciationLabService.get(runtime.pronunciationId); runtime.pronunciationId = target.id; const support = VietnamesePronunciationLabService.support(); const result = runtime.result?.recordType === 'pronunciation_attempt' ? runtime.result : null; return `${heading('real-korean-experience', 'PHÁT ÂM CHO NGƯỜI VIỆT', target.title, target.tip)}<nav class="section p71b-tabs">${VietnamesePronunciationLabService.all().map((item) => `<button class="${item.id === target.id ? 'active' : ''}" data-p71b-pronunciation="${item.id}">${item.sound}</button>`).join('')}</nav><section class="section p71b-practice"><div class="p71b-model"><small>TỪ MẪU</small><b lang="ko">${target.word}</b><span>${target.translation}</span><button class="btn secondary" data-p71b-speak="${target.word}">🔊 Nghe mẫu</button></div><div class="p71b-steps"><b>1. Nghe</b><b>2. Ghi âm</b><b>3. Phân tích</b><b>4. Luyện lại</b></div><form id="p71bPronunciationForm"><label for="p71bTranscript">Transcript nhận dạng</label><input id="p71bTranscript" name="transcript" lang="ko" maxlength="300" placeholder="${support.recognition ? 'Nhấn micro hoặc nhập khi cần' : 'Thiết bị không hỗ trợ micro · nhập câu đã nói'}"><div><button class="btn secondary" type="button" data-p71b-record>${support.microphone || support.recognition ? '● Bắt đầu ghi âm' : 'Micro không hỗ trợ · dùng text'}</button><button class="btn primary" type="submit">Phân tích</button></div></form>${result ? `<article class="p71b-feedback" aria-live="polite"><strong>${result.accuracy}/100</strong><div><b>${escapeHtml(result.feedback)}</b><p>${result.missingSound ? `Thiếu âm: ${escapeHtml(result.missingSound)}` : 'Không thiếu âm'} · ${result.wrongSound ? `Âm cần sửa: ${escapeHtml(result.wrongSound)}` : 'Không phát hiện âm sai rõ ràng'}</p><small>${escapeHtml(result.method)} · Không lưu audio</small></div></article>` : ''}</section>`; }
  function miningView() { if (!runtime.content) return loading(); const items = SentenceMiningService.all().slice(0, 8); return `${heading('real-korean-experience', 'SENTENCE MINING', 'Lưu câu bạn gặp ngoài đời', 'Nhập một câu ngắn từ phim, webtoon, YouTube hoặc tài liệu; hệ thống tách dữ liệu cục bộ từ nguồn chuẩn.')}<section class="section p71b-form-card"><form id="p71bMiningForm"><label>Nguồn<select name="sourceType">${SentenceMiningService.sourceTypes().map((type) => `<option value="${type}">${type}</option>`).join('')}</select></label><label>Tên nguồn (không bắt buộc)<input name="sourceLabel" maxlength="80"></label><label>Câu tiếng Hàn<textarea name="sentence" lang="ko" maxlength="300" required placeholder="오늘 뭐 먹을래?"></textarea></label><label>Nghĩa tiếng Việt<textarea name="translation" maxlength="300"></textarea></label><button class="btn primary" type="submit">Tạo ghi chú học</button></form></section><section class="section p71b-list">${items.length ? items.map((item) => `<article><small>${escapeHtml(item.sourceType)} · ${escapeHtml(item.sourceLabel || 'Nguồn cá nhân')}</small><h2 lang="ko">${escapeHtml(item.sentence)}</h2><p>${escapeHtml(item.translation || '')}</p><div>${item.vocabulary.map((word) => `<span>${escapeHtml(word.korean)} · ${escapeHtml(word.meaning)}</span>`).join('')}${item.grammar.map((grammar) => `<span>${escapeHtml(grammar.label)}</span>`).join('')}</div><button class="btn secondary" data-p71b-flashcards="${item.id}">Thêm ${item.vocabulary.length} từ vào SRS</button></article>`).join('') : '<div class="empty-state"><b>Chưa có câu đã lưu</b><p>Thử với “오늘 뭐 먹을래?” để tạo bộ học đầu tiên.</p></div>'}</section>`; }
  function mediaView() { if (!runtime.content) return loading(); const item = RealMediaLearningService.get(runtime.mediaId); runtime.mediaId = item.id; const line = item.lines[Math.min(runtime.mediaLine, item.lines.length - 1)]; return `${heading('real-korean-experience', 'MEDIA LEARNING', item.title, 'Hội thoại gốc dành cho học tập; không lưu hoặc nhúng video có bản quyền.')}<nav class="section p71b-media-nav">${RealMediaLearningService.all().map((entry) => `<button class="${entry.id === item.id ? 'active' : ''}" data-p71b-media="${entry.id}">${escapeHtml(entry.title)}</button>`).join('')}</nav><section class="section p71b-media-player"><small>${escapeHtml(item.type.toUpperCase())} · ${runtime.mediaLine + 1}/${item.lines.length}</small><p lang="ko">${escapeHtml(line.korean)}</p>${runtime.subtitles ? `<span>${escapeHtml(line.vietnamese)}</span>` : '<span>Đã ẩn bản dịch</span>'}<div><button class="btn secondary" data-p71b-speak="${escapeHtml(line.korean)}">🔊 Phát câu</button><button class="btn secondary" data-p71b-subtitle>${runtime.subtitles ? 'Ẩn bản dịch' : 'Hiện bản dịch'}</button></div><div class="p71b-vocab">${(line.vocabularyIds || []).map((id) => { const word = runtime.content.mining.vocabulary.find((entry) => entry.id === id); return word ? `<button data-p71b-media-word="${id}">${word.surface}<small>${word.meaning}</small></button>` : ''; }).join('')}</div><div class="p71b-player-actions"><button class="btn secondary" data-p71b-media-prev ${runtime.mediaLine <= 0 ? 'disabled' : ''}>Trước</button><button class="btn primary" data-p71b-media-next>${runtime.mediaLine >= item.lines.length - 1 ? 'Hoàn thành' : 'Câu tiếp'}</button></div></section>`; }
  function conversationView() { if (!runtime.content) return loading(); const scenario = RealConversationPracticeService.get(runtime.scenarioId); runtime.scenarioId = scenario.id; const result = runtime.scenarioResult; return `${heading('real-korean-experience', 'HỘI THOẠI THỰC TẾ', scenario.title, 'Đây là bài luyện tình huống, không phải chatbot. AI chỉ góp ý độ tự nhiên khi khả dụng.')}<nav class="section p71b-tabs">${RealConversationPracticeService.all().map((item) => `<button class="${item.id === scenario.id ? 'active' : ''}" data-p71b-scenario="${item.id}">${escapeHtml(item.topic)}</button>`).join('')}</nav><section class="section p71b-conversation"><article class="partner"><small>NGƯỜI ĐỐI THOẠI</small><p lang="ko">${escapeHtml(scenario.partner)}</p><button data-p71b-speak="${escapeHtml(scenario.partner)}">🔊</button></article><form id="p71bConversationForm"><label for="p71bConversationAnswer">Bạn trả lời bằng tiếng Hàn</label><textarea id="p71bConversationAnswer" name="answer" lang="ko" maxlength="500" required></textarea><div><button class="btn secondary" type="button" data-p71b-conversation-record>● Ghi âm</button><button class="btn primary" type="submit">Gửi phản hồi</button></div><small>Nếu micro không khả dụng, hãy nhập text. Audio không được lưu.</small></form>${result ? `<article class="p71b-conversation-result"><strong>${result.overall}/100</strong><div><p>Ý nghĩa ${result.meaning} · Ngữ pháp ${result.grammar} · Tự nhiên ${result.natural} · Ngữ cảnh ${result.context}</p><b>${escapeHtml(result.feedback)}</b><p lang="ko">Gợi ý: ${escapeHtml(result.suggestion)}</p><p class="p71b-partner-reply" lang="ko"><b>Người đối thoại tiếp tục:</b> ${escapeHtml(result.partnerReply)}</p><small>${result.aiStatus === 'available' ? escapeHtml(result.aiFeedback) : 'AI không khả dụng hoặc chưa dùng; kết quả cục bộ vẫn đầy đủ.'}</small></div></article>` : ''}</section>`; }
  function shadowingView() { if (!runtime.content) return loading(); const line = RealShadowingService.get(runtime.shadowingId); runtime.shadowingId = line.id; const result = runtime.shadowingResult; return `${heading('real-korean-experience', 'SHADOWING', 'Nghe, nhắc lại và so sánh', 'Audio không được lưu; chỉ transcript, tốc độ và điểm tiến trình được đồng bộ.')}<nav class="section p71b-tabs">${RealShadowingService.all().map((item) => `<button class="${item.id === line.id ? 'active' : ''}" data-p71b-shadowing="${item.id}">${escapeHtml(item.korean)}</button>`).join('')}</nav><section class="section p71b-practice"><div class="p71b-model"><small>CÂU MẪU</small><b lang="ko">${escapeHtml(line.korean)}</b><span>${escapeHtml(line.vietnamese)}</span></div><div class="p71b-speed">${RealShadowingService.speeds(line.id).map((speed) => `<button class="${runtime.shadowingSpeed === speed ? 'active' : ''}" data-p71b-speed="${speed}">${speed === .75 ? 'Chậm' : speed === 1 ? 'Bình thường' : 'Tự nhiên'} · ${speed}×</button>`).join('')}</div><button class="btn secondary" data-p71b-shadow-speak>🔊 Nghe ở tốc độ đã chọn</button><form id="p71bShadowingForm"><label>Transcript sau khi nhắc lại<input id="p71bShadowTranscript" name="transcript" lang="ko" maxlength="300" required></label><div><button class="btn secondary" type="button" data-p71b-shadow-record>● Ghi âm</button><button class="btn primary" type="submit">So sánh</button></div><small>Nếu micro không khả dụng, hãy nhập text. Audio không được lưu.</small></form>${result ? `<article class="p71b-feedback"><strong>${result.score}/100</strong><div><b>Phát âm ${result.accuracy} · Độ trôi chảy ${result.fluency}</b><p>Trọng tâm: ${result.focus.map(escapeHtml).join(' · ')}</p><small>${result.speed}× · Không lưu audio</small></div></article>` : ''}</section>`; }
  function entryCard() { return `<section class="section p71b-entry"><div><small>P71B · REAL KOREAN</small><h2>Dùng tiếng Hàn trong đời thật</h2><p>Phát âm cho người Việt, khai thác câu, hội thoại và shadowing trong một lộ trình.</p></div><button class="btn primary" data-view="real-korean-experience">Bắt đầu luyện</button></section>`; }
  async function toggleSharedCapture(inputId, button) {
    const input = global.document?.getElementById(inputId); if (!input) return;
    if (global.VoiceCaptureService?.active?.()) {
      const capture = await VietnamesePronunciationLabService.stopCapture(); runtime.capture = capture;
      if (capture.transcript) input.value = capture.transcript;
      button.textContent = '● Ghi âm'; return;
    }
    const started = await VietnamesePronunciationLabService.startCapture({ onTranscript: ({ final, interim }) => { input.value = `${final} ${interim}`.trim(); } }).catch(() => ({ status: 'text-fallback' }));
    if (started.status === 'recording') button.textContent = '■ Dừng ghi âm'; else toast?.('Micro không khả dụng. Hãy nhập câu trả lời để tiếp tục.');
  }
  function bind() {
    global.document?.querySelector('[data-p71b-conversation-record]')?.addEventListener('click', (event) => toggleSharedCapture('p71bConversationAnswer', event.currentTarget));
    global.document?.querySelector('[data-p71b-shadow-record]')?.addEventListener('click', (event) => toggleSharedCapture('p71bShadowTranscript', event.currentTarget));
    global.document?.querySelectorAll('[data-p71b-speak]').forEach((button) => { button.onclick = () => speakKorean?.(button.dataset.p71bSpeak); });
    global.document?.querySelectorAll('[data-p71b-pronunciation]').forEach((button) => { button.onclick = () => { runtime.pronunciationId = button.dataset.p71bPronunciation; runtime.result = null; render(); }; });
    const pronunciationForm = global.document?.getElementById('p71bPronunciationForm'); if (pronunciationForm) pronunciationForm.onsubmit = async (event) => { event.preventDefault(); if (global.VoiceCaptureService?.active?.()) runtime.capture = await VietnamesePronunciationLabService.stopCapture(); const transcript = new FormData(pronunciationForm).get('transcript') || runtime.capture?.transcript; runtime.result = await VietnamesePronunciationLabService.analyze(runtime.pronunciationId, { transcript, capture: runtime.capture || {} }); runtime.capture = null; render(); };
    global.document?.querySelector('[data-p71b-record]')?.addEventListener('click', async (event) => { const button = event.currentTarget; if (global.VoiceCaptureService?.active?.()) { const capture = await VietnamesePronunciationLabService.stopCapture(); runtime.capture = capture; const input = global.document.getElementById('p71bTranscript'); if (input && capture.transcript) input.value = capture.transcript; button.textContent = '● Bắt đầu ghi âm'; return; } const started = await VietnamesePronunciationLabService.startCapture({ onTranscript: ({ final, interim }) => { const input = global.document.getElementById('p71bTranscript'); if (input) input.value = `${final} ${interim}`.trim(); } }).catch(() => ({ status: 'text-fallback' })); if (started.status === 'recording') button.textContent = '■ Dừng ghi âm'; else toast?.('Không mở được micro. Bạn vẫn có thể luyện bằng text.'); });
    const miningForm = global.document?.getElementById('p71bMiningForm'); if (miningForm) miningForm.onsubmit = (event) => { event.preventDefault(); try { SentenceMiningService.mine(Object.fromEntries(new FormData(miningForm))); toast?.('Đã tạo ghi chú, từ vựng và ngữ pháp.'); render(); } catch (error) { toast?.(error.message); } };
    global.document?.querySelectorAll('[data-p71b-flashcards]').forEach((button) => { button.onclick = () => { const item = SentenceMiningService.all().find((entry) => entry.id === button.dataset.p71bFlashcards); const count = SentenceMiningService.createFlashcards(item).length; toast?.(`Đã thêm ${count} từ vào SRS.`); render(); }; });
    global.document?.querySelectorAll('[data-p71b-media]').forEach((button) => { button.onclick = () => { runtime.mediaId = button.dataset.p71bMedia; runtime.mediaLine = 0; render(); }; });
    global.document?.querySelector('[data-p71b-subtitle]')?.addEventListener('click', () => { runtime.subtitles = !runtime.subtitles; render(); });
    global.document?.querySelectorAll('[data-p71b-media-word]').forEach((button) => { button.onclick = () => { RealMediaLearningService.addVocabulary(button.dataset.p71bMediaWord); toast?.('Đã thêm từ vào SRS.'); }; });
    global.document?.querySelector('[data-p71b-media-prev]')?.addEventListener('click', () => { runtime.mediaLine = Math.max(0, runtime.mediaLine - 1); render(); });
    global.document?.querySelector('[data-p71b-media-next]')?.addEventListener('click', () => { const item = RealMediaLearningService.get(runtime.mediaId); if (runtime.mediaLine < item.lines.length - 1) runtime.mediaLine += 1; else { RealMediaLearningService.complete(item.id, runtime.mediaLine); toast?.('Đã lưu tiến trình hội thoại.'); } render(); });
    global.document?.querySelectorAll('[data-p71b-scenario]').forEach((button) => { button.onclick = () => { runtime.scenarioId = button.dataset.p71bScenario; runtime.scenarioResult = null; render(); }; });
    const conversationForm = global.document?.getElementById('p71bConversationForm'); if (conversationForm) conversationForm.onsubmit = async (event) => { event.preventDefault(); if (global.VoiceCaptureService?.active?.()) runtime.capture = await VietnamesePronunciationLabService.stopCapture(); const answer = new FormData(conversationForm).get('answer') || runtime.capture?.transcript; runtime.scenarioResult = await RealConversationPracticeService.evaluate(runtime.scenarioId, answer); runtime.capture = null; render(); };
    global.document?.querySelectorAll('[data-p71b-shadowing]').forEach((button) => { button.onclick = () => { runtime.shadowingId = button.dataset.p71bShadowing; runtime.shadowingResult = null; render(); }; });
    global.document?.querySelectorAll('[data-p71b-speed]').forEach((button) => { button.onclick = () => { runtime.shadowingSpeed = Number(button.dataset.p71bSpeed); render(); }; });
    global.document?.querySelector('[data-p71b-shadow-speak]')?.addEventListener('click', () => speakKorean?.(RealShadowingService.get(runtime.shadowingId).korean, runtime.shadowingSpeed));
    const shadowForm = global.document?.getElementById('p71bShadowingForm'); if (shadowForm) shadowForm.onsubmit = async (event) => { event.preventDefault(); if (global.VoiceCaptureService?.active?.()) runtime.capture = await VietnamesePronunciationLabService.stopCapture(); const transcript = new FormData(shadowForm).get('transcript') || runtime.capture?.transcript; runtime.shadowingResult = await RealShadowingService.compare(runtime.shadowingId, transcript, { speed: runtime.shadowingSpeed, capture: runtime.capture || {} }); runtime.capture = null; render(); };
  }

  Object.assign(global, { RealKoreanContentService, VietnamesePronunciationLabService, SentenceMiningService, RealMediaLearningService, RealConversationPracticeService, RealShadowingService, RealKoreanExperienceService: { content: RealKoreanContentService, pronunciation: VietnamesePronunciationLabService, mining: SentenceMiningService, media: RealMediaLearningService, conversation: RealConversationPracticeService, shadowing: RealShadowingService, summary, version: 'p71b-v1' } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'real-korean-experience': hubView, 'pronunciation-lab-vn': pronunciationView, 'sentence-mining': miningView, 'media-learning-real': mediaView, 'real-conversation-lab': conversationView, 'real-shadowing-lab': shadowingView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; if (['lessons', 'speaking-hub'].includes(state.currentView) && !global.document?.querySelector('.p71b-entry')) global.document?.querySelector('.page-heading')?.insertAdjacentHTML('afterend', entryCard()); bind(); };
  RealKoreanContentService.load();
})(window);
