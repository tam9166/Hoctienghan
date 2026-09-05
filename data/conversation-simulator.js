/* Tiếng Hàn - TamHoanq — conversation and real usage system */
(function (global) {
  'use strict';
  const app = global.KLEARN_APP;
  const scenarios = global.KLEARN_CONVERSATION_SCENARIOS || [];
  if (!app || !scenarios.length) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, saveUserProgress, userScoped, saveUserScoped, LearnerProfileService } = app;
  const now = () => new Date().toISOString();
  const clean = (value) => String(value || '').normalize('NFC').toLocaleLowerCase().replace(/[\s.,!?;:'"“”‘’()\[\]{}~-]+/g, '');
  const containsAny = (answer, values = []) => values.some((value) => clean(answer).includes(clean(value)));
  const localize = (value) => { if (typeof value === 'string') return value; const locale = document.documentElement.lang === 'zh-CN' ? 'zh-CN' : document.documentElement.lang === 'en' ? 'en' : 'vi'; return value?.[locale] || value?.vi || value?.en || ''; };
  const levelLabels = { Beginner: 'Cơ bản', Intermediate: 'Trung cấp', Advanced: 'Nâng cao' };
  const topicLabels = { greeting: 'Chào hỏi', 'self-introduction': 'Giới thiệu bản thân', restaurant: 'Gọi món', shopping: 'Mua hàng', directions: 'Hỏi đường', price: 'Hỏi giá', interview: 'Phỏng vấn', work: 'Công việc', appointment: 'Đặt lịch', opinion: 'Trao đổi ý kiến', presentation: 'Thuyết trình', debate: 'Tranh luận', meeting: 'Họp' };
  const runtime = state.conversationSimulator || (state.conversationSimulator = { level: 'Beginner', session: null, listening: false });

  const ConversationEvaluationEngine = {
    evaluate(turn, answer) {
      const text = String(answer || '').trim().slice(0, 600);
      const meaningGroups = turn.meaningGroups || [];
      const matchedMeaning = meaningGroups.filter((group) => containsAny(text, group));
      const grammarChecks = turn.grammarChecks || [];
      const passedGrammar = grammarChecks.filter((check) => containsAny(text, check.any));
      const contextKeywords = turn.contextKeywords || [];
      const meaning = meaningGroups.length ? Math.round(matchedMeaning.length / meaningGroups.length * 100) : (text ? 100 : 0);
      const grammar = grammarChecks.length ? Math.round(passedGrammar.length / grammarChecks.length * 100) : (text ? 100 : 0);
      const natural = containsAny(text, turn.naturalPatterns || []) ? 100 : meaning >= 50 ? 68 : 35;
      const context = contextKeywords.length ? (containsAny(text, contextKeywords) ? 100 : meaning >= 50 ? 60 : 25) : 100;
      const overall = Math.round(meaning * .35 + grammar * .25 + natural * .2 + context * .2);
      const missingGrammar = grammarChecks.filter((check) => !passedGrammar.includes(check));
      return {
        answer: text, overall, meaning, grammar, natural, context,
        missingGrammar: missingGrammar.map(({ id, label }) => ({ id, label })),
        feedback: {
          meaning: meaning >= 75 ? 'Đã truyền đạt đúng ý chính.' : meaning >= 45 ? 'Đúng một phần; cần thêm thông tin chính.' : 'Câu trả lời chưa khớp mục đích của lượt nói.',
          grammar: missingGrammar.length ? `Cần kiểm tra: ${missingGrammar.map((item) => item.label).join(', ')}.` : 'Cấu trúc mục tiêu được dùng phù hợp.',
          natural: natural === 100 ? 'Cách nói tự nhiên trong tình huống này.' : `Có thể nói tự nhiên hơn: ${turn.modelAnswer}`,
          context: context >= 80 ? 'Phản hồi phù hợp với tình huống.' : 'Hãy dùng từ khóa gắn trực tiếp với tình huống.'
        },
        suggestion: turn.modelAnswer,
        coaching: turn.coaching || '',
        evaluatedAt: now()
      };
    }
  };

  const ConversationHistoryService = {
    all() { return userScoped(STORAGE_KEYS.conversationHistory); },
    get(scenarioId) { return this.all().find((item) => item.scenarioId === scenarioId) || null; },
    record(scenario, turn, result, options = {}) {
      const list = this.all();
      const previous = this.get(scenario.id) || { id: `conversation-${scenario.id}`, scenarioId: scenario.id, topic: scenario.topic, level: scenario.level, practiceCount: 0, turnAttempts: 0, completedRuns: 0, averageScore: 0, commonErrors: {}, exchanges: [] };
      const turnAttempts = Number(previous.turnAttempts || 0) + 1;
      const commonErrors = { ...(previous.commonErrors || {}) };
      result.missingGrammar.forEach((item) => { commonErrors[item.id] = Number(commonErrors[item.id] || 0) + 1; });
      if (result.meaning < 60) commonErrors.meaning = Number(commonErrors.meaning || 0) + 1;
      if (result.natural < 75) commonErrors.naturalness = Number(commonErrors.naturalness || 0) + 1;
      const next = {
        ...previous,
        practiceCount: Number(previous.practiceCount || 0) + (options.firstTurn ? 1 : 0),
        turnAttempts,
        completedRuns: Number(previous.completedRuns || 0) + (options.completed ? 1 : 0),
        averageScore: Math.round((Number(previous.averageScore || 0) * Number(previous.turnAttempts || 0) + result.overall) / turnAttempts),
        lastScore: result.overall,
        commonErrors,
        weak: result.overall < 70 || Object.values(commonErrors).some((count) => count >= 2),
        lastPracticedAt: result.evaluatedAt,
        updatedAt: result.evaluatedAt,
        exchanges: [{ turnId: turn.id, npc: turn.npc, answer: result.answer, score: result.overall, meaning: result.meaning, grammar: result.grammar, natural: result.natural, context: result.context, evaluatedAt: result.evaluatedAt }, ...(previous.exchanges || [])].slice(0, 60)
      };
      saveUserScoped(STORAGE_KEYS.conversationHistory, [next, ...list.filter((item) => item.scenarioId !== scenario.id)], 50);
      const progress = getUserProgress();
      progress.conversation = progress.conversation && typeof progress.conversation === 'object' ? progress.conversation : { attempts: 0, completed: 0, weakTopics: {} };
      progress.conversation.attempts = Number(progress.conversation.attempts || 0) + 1;
      progress.conversation.completed = Number(progress.conversation.completed || 0) + (options.completed ? 1 : 0);
      progress.conversation.lastScenarioId = scenario.id;
      progress.conversation.lastPracticedAt = result.evaluatedAt;
      progress.conversation.weakTopics = { ...(progress.conversation.weakTopics || {}) };
      if (result.overall < 70) progress.conversation.weakTopics[scenario.topic] = Number(progress.conversation.weakTopics[scenario.topic] || 0) + 1;
      if (progress.daily?.tasks) progress.daily.tasks.speaking = true;
      if (progress.skills) progress.skills.speaking = Math.max(Number(progress.skills.speaking || 0), Math.round(result.overall * .8));
      saveUserProgress(progress);
      const correct = result.overall >= 75;
      [...scenario.grammarIds, ...scenario.vocabularyIds].forEach((nodeId) => global.KnowledgeGraphService?.record?.(nodeId, { correct, source: 'conversation' }));
      if (result.overall < 70 || result.grammar < 75) global.ErrorNotebookService?.add?.({ type: 'conversation', question: turn.npc, mistake: result.answer, correction: result.suggestion, explanation: [result.feedback.meaning, result.feedback.grammar, result.feedback.natural].join(' ') });
      if (result.overall < 70) global.LearningMemoryService?.upsert?.({ type: 'weak_knowledge', topic: `conversation:${scenario.topic}`, content: `Cần luyện thêm tình huống ${topicLabels[scenario.topic] || scenario.topic}`, confidence: .78, importance: 4, source: 'conversation-simulator' }, { increment: true });
      return next;
    },
    summary() { const items = this.all(); return { scenarios: items.length, practices: items.reduce((sum, item) => sum + Number(item.practiceCount || 0), 0), completed: items.reduce((sum, item) => sum + Number(item.completedRuns || 0), 0), average: items.length ? Math.round(items.reduce((sum, item) => sum + Number(item.averageScore || 0), 0) / items.length) : 0, weakTopics: items.filter((item) => item.weak).sort((a, b) => new Date(b.lastPracticedAt) - new Date(a.lastPracticedAt)).map((item) => item.topic) }; }
  };

  const ConversationScenarioService = {
    all() { return scenarios; },
    get(id) { return scenarios.find((item) => item.id === id) || null; },
    recommendation() {
      const profile = LearnerProfileService.get() || {};
      const errorText = (global.ErrorNotebookService?.top?.(40) || []).map((item) => `${item.question} ${item.mistake} ${item.correction}`).join(' ');
      const weakGrammar = (profile.weakGrammar || []).map((item) => item.topic || item).join(' ');
      const history = ConversationHistoryService.all();
      return [...scenarios].map((item) => { const terms = item.dialogue.flatMap((turn) => turn.grammarChecks.flatMap((check) => [check.id, check.label, ...check.any])); const weakness = terms.filter((term) => clean(`${errorText} ${weakGrammar}`).includes(clean(term))).length; const practiced = history.find((entry) => entry.scenarioId === item.id)?.practiceCount || 0; const levelFit = item.level === (Number(state.currentUser?.currentTopikLevel || 1) <= 1 ? 'Beginner' : Number(state.currentUser?.currentTopikLevel || 1) <= 3 ? 'Intermediate' : 'Advanced') ? 3 : 0; return { item, score: weakness * 5 + levelFit - practiced }; }).sort((a, b) => b.score - a.score)[0]?.item || scenarios[0];
    }
  };

  function startScenario(id) {
    const scenario = ConversationScenarioService.get(id);
    if (!scenario) return;
    runtime.session = { scenarioId: id, turnIndex: 0, messages: [{ role: 'partner', text: scenario.dialogue[0].npc }], feedback: null, completed: false };
    render();
  }

  function submitResponse(answer) {
    const session = runtime.session; const scenario = ConversationScenarioService.get(session?.scenarioId); const turn = scenario?.dialogue?.[session?.turnIndex];
    if (!turn || !String(answer || '').trim()) return null;
    const result = ConversationEvaluationEngine.evaluate(turn, answer);
    const completed = session.turnIndex >= scenario.dialogue.length - 1;
    ConversationHistoryService.record(scenario, turn, result, { firstTurn: session.turnIndex === 0, completed });
    session.messages.push({ role: 'learner', text: result.answer });
    session.feedback = result;
    session.completed = completed;
    return result;
  }

  function continueConversation() {
    const session = runtime.session; const scenario = ConversationScenarioService.get(session?.scenarioId);
    if (!session || !scenario || session.completed) return;
    session.turnIndex += 1; session.feedback = null;
    session.messages.push({ role: 'partner', text: scenario.dialogue[session.turnIndex].npc });
    render();
  }

  function catalogView() {
    const summary = ConversationHistoryService.summary(); const recommended = ConversationScenarioService.recommendation(); const filtered = scenarios.filter((item) => item.level === runtime.level);
    return `<section class="section page-heading"><button class="back-link" data-view="lessons">← Học tập</button><p class="eyebrow">Luyện dùng tiếng Hàn</p><h1 class="headline">Conversation Simulator</h1><p class="subtle">Luyện phản hồi liên tục theo tình huống. Hệ thống đánh giá mục đích giao tiếp, ngữ pháp, độ tự nhiên và ngữ cảnh.</p></section><section class="conversation-summary section"><div><b>${summary.practices}</b><span>Lượt luyện</span></div><div><b>${summary.completed}</b><span>Hội thoại hoàn thành</span></div><div><b>${summary.average}%</b><span>Điểm trung bình</span></div></section><section class="conversation-recommendation section"><div><p class="eyebrow">Nên luyện tiếp</p><h2>${escapeHtml(topicLabels[recommended.topic] || recommended.topic)}</h2><p>${escapeHtml(localize(recommended.situation))}</p></div><button class="btn primary" data-conversation-start="${recommended.id}">Bắt đầu</button></section><nav class="conversation-level-tabs section" aria-label="Trình độ hội thoại">${['Beginner','Intermediate','Advanced'].map((level) => `<button class="${runtime.level === level ? 'active' : ''}" data-conversation-level="${level}"><b>${levelLabels[level]}</b><small>${scenarios.filter((item) => item.level === level).length} tình huống</small></button>`).join('')}</nav><section class="conversation-scenario-grid section">${filtered.map((scenario) => { const saved = ConversationHistoryService.get(scenario.id); return `<article class="conversation-scenario-card"><div><span>${escapeHtml(topicLabels[scenario.topic] || scenario.topic)}</span>${saved?.weak ? '<em>Cần luyện lại</em>' : saved?.completedRuns ? '<em class="done">Đã hoàn thành</em>' : ''}</div><h2>${escapeHtml(localize(scenario.situation))}</h2><p>${scenario.dialogue.length} lượt · ${scenario.expectedSkills.map(escapeHtml).join(' · ')}</p><small>${saved ? `${saved.practiceCount} lần · trung bình ${saved.averageScore}%` : 'Chưa luyện'}</small><button class="btn secondary full" data-conversation-start="${scenario.id}">${saved ? 'Luyện lại' : 'Mở tình huống'}</button></article>`; }).join('')}</section>`;
  }

  function sessionView(session) {
    const scenario = ConversationScenarioService.get(session.scenarioId); const turn = scenario.dialogue[session.turnIndex]; const result = session.feedback; const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    return `<section class="section conversation-session-heading"><button class="back-link" data-conversation-back>← Tình huống</button><div><p class="eyebrow">${escapeHtml(levelLabels[scenario.level])} · ${escapeHtml(topicLabels[scenario.topic] || scenario.topic)}</p><h1 class="headline">${escapeHtml(localize(scenario.situation))}</h1></div><div class="conversation-progress"><span>Lượt ${session.turnIndex + 1}/${scenario.dialogue.length}</span><div class="bar"><i style="width:${Math.round((session.turnIndex + (result ? 1 : 0)) / scenario.dialogue.length * 100)}%"></i></div></div></section><section class="conversation-stage section"><div class="conversation-context"><span>Đối tác hội thoại</span><p>${escapeHtml(localize(scenario.situation))}</p><small>Kỹ năng: ${scenario.expectedSkills.map(escapeHtml).join(' · ')}</small></div><div class="conversation-flow">${session.messages.map((message) => `<article class="${message.role}"><small>${message.role === 'partner' ? 'Đối tác' : 'Bạn'}</small><p lang="ko">${escapeHtml(message.text)}</p>${message.role === 'partner' ? `<button class="audio-btn" data-speak="${escapeHtml(message.text)}" aria-label="Nghe câu của đối tác">🔊</button>` : ''}</article>`).join('')}</div>${result ? `<section class="conversation-feedback"><div class="feedback-score"><strong>${result.overall}</strong><span>/100</span><small>${result.overall >= 80 ? 'Phù hợp' : result.overall >= 60 ? 'Đang tiến bộ' : 'Cần thử lại'}</small></div><div class="feedback-grid"><div><b>Đúng ý nghĩa</b><span>${result.meaning}%</span><p>${escapeHtml(result.feedback.meaning)}</p></div><div><b>Grammar</b><span>${result.grammar}%</span><p>${escapeHtml(result.feedback.grammar)}</p></div><div><b>Tự nhiên</b><span>${result.natural}%</span><p>${escapeHtml(result.feedback.natural)}</p></div><div><b>Đúng tình huống</b><span>${result.context}%</span><p>${escapeHtml(result.feedback.context)}</p></div></div><div class="natural-suggestion"><small>Cách nói gợi ý</small><b lang="ko">${escapeHtml(result.suggestion)}</b>${result.coaching ? `<p>${escapeHtml(result.coaching)}</p>` : ''}<button class="audio-btn" data-speak="${escapeHtml(result.suggestion)}">🔊 Nghe</button></div><div class="conversation-feedback-actions">${session.completed ? '<button class="btn primary" data-conversation-finish>Hoàn thành tình huống</button>' : '<button class="btn primary" data-conversation-next>Tiếp tục hội thoại</button>'}<button class="btn secondary" data-open-ai="${escapeHtml(`Giải thích ngắn lỗi trong câu tiếng Hàn: ${result.answer}. Câu gợi ý: ${result.suggestion}`)}">Giải thích thêm</button></div></section>` : `<form id="conversationResponseForm" class="conversation-response"><label for="conversationAnswer">Bạn trả lời bằng tiếng Hàn</label><textarea id="conversationAnswer" name="answer" lang="ko" maxlength="600" rows="4" required placeholder="Nhập câu trả lời…"></textarea><div><button class="btn secondary" type="button" data-conversation-voice ${Recognition ? '' : 'disabled'}>${Recognition ? '🎙 Nói câu trả lời' : 'Micro không hỗ trợ · dùng text'}</button><button class="btn primary" type="submit">Gửi phản hồi</button></div><p>${Recognition ? 'Voice input chỉ chuyển giọng nói thành text; ứng dụng không lưu audio.' : 'Trình duyệt không có SpeechRecognition. Bạn vẫn luyện đầy đủ bằng text.'}</p></form>`}</section>`;
  }

  function conversationView() { return runtime.session ? sessionView(runtime.session) : catalogView(); }
  function entryCard() { return `<section class="card section conversation-entry"><div><p class="eyebrow">Luyện hội thoại thực tế</p><h2 class="section-title">Conversation Simulator</h2><p>Phản hồi liên tục theo tình huống, dùng text hoặc giọng nói.</p></div><button class="btn primary" data-conversation-open>Mở tình huống</button></section>`; }

  function startVoiceInput(button) {
    const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    const input = document.getElementById('conversationAnswer');
    if (!Recognition || !input) return toast('Thiết bị chưa hỗ trợ SpeechRecognition. Hãy nhập câu trả lời.');
    if (runtime.recognition) { try { runtime.recognition.stop(); } catch (_) { /* already stopped */ } return; }
    const recognition = new Recognition(); runtime.recognition = recognition; recognition.lang = 'ko-KR'; recognition.interimResults = false; recognition.maxAlternatives = 1; button.disabled = true; button.textContent = 'Đang nghe…';
    recognition.onresult = (event) => { input.value = event.results[0][0].transcript; input.focus(); };
    recognition.onerror = (event) => { if (event.error !== 'aborted') toast(`Không thể nhận dạng giọng nói (${event.error}). Bạn có thể nhập text.`); };
    recognition.onend = () => { runtime.recognition = null; button.disabled = false; button.textContent = '🎙 Nói câu trả lời'; };
    try { recognition.start(); } catch (_) { runtime.recognition = null; button.disabled = false; toast('Không thể mở nhận dạng giọng nói. Hãy dùng text.'); }
  }

  global.ConversationEvaluationEngine = ConversationEvaluationEngine;
  global.ConversationHistoryService = ConversationHistoryService;
  global.ConversationScenarioService = ConversationScenarioService;
  global.ConversationSimulatorController = { startScenario, submitResponse, continueConversation, reset() { runtime.session = null; } };
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'conversation-simulator': conversationView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.();
    if (!state.currentUser) return;
    if (['lessons','speaking-room'].includes(state.currentView) && !document.querySelector('.conversation-entry')) document.getElementById('app')?.insertAdjacentHTML('afterbegin', entryCard());
    document.querySelector('[data-conversation-open]')?.addEventListener('click', () => { runtime.session = null; setView('conversation-simulator'); });
    document.querySelectorAll('[data-conversation-level]').forEach((button) => { button.onclick = () => { runtime.level = button.dataset.conversationLevel; render(); }; });
    document.querySelectorAll('[data-conversation-start]').forEach((button) => { button.onclick = () => startScenario(button.dataset.conversationStart); });
    document.querySelector('[data-conversation-back]')?.addEventListener('click', () => { runtime.session = null; render(); });
    const form = document.getElementById('conversationResponseForm'); if (form) form.onsubmit = (event) => { event.preventDefault(); const answer = String(new FormData(form).get('answer') || '').trim(); if (!answer) return toast('Hãy nhập câu trả lời tiếng Hàn.'); submitResponse(answer); render(); };
    const voice = document.querySelector('[data-conversation-voice]'); if (voice) voice.onclick = () => startVoiceInput(voice);
    document.querySelector('[data-conversation-next]')?.addEventListener('click', continueConversation);
    document.querySelector('[data-conversation-finish]')?.addEventListener('click', () => { runtime.session = null; toast('Đã lưu tiến độ hội thoại.'); render(); });
  };
  render();
})(window);
