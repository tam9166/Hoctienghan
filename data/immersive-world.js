(function (global) {
  'use strict';

  const app = global.KLEARN_APP;
  const content = global.KLEARN_IMMERSIVE_WORLD_DATA;
  if (!app || !content) return;
  const { state, STORAGE_KEYS, render, setView, toast, escapeHtml, getUserProgress, saveUserProgress, userScoped, saveUserScoped, speakKorean, CloudSyncService } = app;
  const key = STORAGE_KEYS.immersiveWorld || 'klearn_immersive_world';
  const now = () => new Date().toISOString();
  const clean = (value) => String(value || '').normalize('NFC').toLocaleLowerCase().replace(/[\s.,!?;:'"“”‘’()\[\]{}~-]+/g, '');
  const includesAny = (answer, values = []) => values.some((value) => clean(answer).includes(clean(value)));
  const runtime = state.immersiveWorld || (state.immersiveWorld = { session: null, debateTopicId: content.debateTopics[0].id, debateResult: null });

  function records() { return userScoped(key); }
  function write(items) { saveUserScoped(key, items, 120); CloudSyncService?.schedule?.('immersive-world'); }
  function missionById(id) { return content.missions.find((item) => item.id === id) || null; }
  function worldMissions(world) { return content.missions.filter((item) => item.world === world); }

  const ImmersionSettingsService = {
    record() { return records().find((item) => item.recordType === 'settings') || { id: 'immersive-settings', recordType: 'settings', enabled: false }; },
    enabled() { return Boolean(global.StudySettingsService?.get?.().koreanOnlyMode || this.record().enabled); },
    set(enabled) {
      const current = this.record(); const study = global.StudySettingsService?.get?.() || {};
      const next = enabled
        ? { ...current, enabled: true, previousRomanization: study.showRomanization ?? true, previousTranslation: study.translationDisplay || 'always', updatedAt: now() }
        : { ...current, enabled: false, updatedAt: now() };
      write([next, ...records().filter((item) => item.recordType !== 'settings')]);
      global.StudySettingsService?.save?.(enabled
        ? { koreanOnlyMode: true, showRomanization: false, translationDisplay: 'hidden' }
        : { koreanOnlyMode: false, showRomanization: current.previousRomanization ?? true, translationDisplay: current.previousTranslation || 'always' });
      return next.enabled;
    }
  };

  function localEvaluate(turn, answer) {
    const text = String(answer || '').trim().slice(0, 800);
    const groups = turn.meaningGroups || [];
    const grammar = turn.grammarChecks || [];
    const meaning = groups.length ? Math.round(groups.filter((group) => includesAny(text, group)).length / groups.length * 100) : 70;
    const passed = grammar.filter((check) => includesAny(text, check.any));
    const grammarScore = grammar.length ? Math.round(passed.length / grammar.length * 100) : 75;
    const natural = includesAny(text, turn.naturalPatterns) ? 100 : meaning >= 50 ? 68 : 35;
    const contextScore = includesAny(text, turn.contextKeywords) ? 100 : meaning >= 50 ? 60 : 30;
    const overall = Math.round(meaning * .35 + grammarScore * .25 + natural * .2 + contextScore * .2);
    return { answer: text, meaning, grammar: grammarScore, natural, context: contextScore, overall, missingGrammar: grammar.filter((item) => !passed.includes(item)).map(({ id, label }) => ({ id, label })), suggestion: turn.modelAnswer, feedback: { meaning: meaning >= 70 ? 'Đúng ý chính.' : 'Cần bổ sung ý chính.', grammar: grammarScore >= 75 ? 'Cấu trúc phù hợp.' : `Kiểm tra ${grammar.filter((item) => !passed.includes(item)).map((item) => item.label).join(', ')}.`, natural: natural >= 80 ? 'Cách nói tự nhiên.' : 'Có thể diễn đạt gọn hơn.', context: contextScore >= 75 ? 'Phù hợp tình huống.' : 'Hãy bám sát vai và bối cảnh.' }, evaluatedAt: now() };
  }
  function evaluate(turn, answer) { return global.ConversationEvaluationEngine?.evaluate?.(turn, answer) || localEvaluate(turn, answer); }
  function speakingMetrics(result, answer, modelAnswer) {
    const units = String(answer).trim().split(/\s+/).filter(Boolean);
    const modelUnits = String(modelAnswer).trim().split(/\s+/).filter(Boolean);
    const hesitation = (String(answer).match(/(음|어|저기)/g) || []).length;
    const coverage = Math.min(1, units.length / Math.max(1, modelUnits.length));
    return {
      confidence: Math.max(0, Math.min(100, Math.round(45 + coverage * 40 + (result.context >= 75 ? 15 : 0) - hesitation * 8))),
      fluency: Math.max(0, Math.min(100, Math.round(42 + Math.min(35, units.length * 5) + (result.natural >= 75 ? 18 : 0) - hesitation * 7))),
      accuracy: Math.round(result.meaning * .35 + result.grammar * .4 + result.context * .25)
    };
  }

  const ImmersiveProgressService = {
    all() { return records().filter((item) => item.recordType === 'mission'); },
    get(missionId) { return this.all().find((item) => item.missionId === missionId) || null; },
    record(mission, turn, result, metrics, completed) {
      const existing = this.get(mission.id) || { id: `immersive-${mission.id}`, recordType: 'mission', missionId: mission.id, world: mission.world, attempts: 0, completedRuns: 0, exchanges: [], confidence: 0, fluency: 0, accuracy: 0, averageScore: 0 };
      const attempts = existing.attempts + 1;
      const weighted = (previous, current) => Math.round((Number(previous || 0) * existing.attempts + current) / attempts);
      const next = { ...existing, attempts, completedRuns: existing.completedRuns + (completed ? 1 : 0), confidence: weighted(existing.confidence, metrics.confidence), fluency: weighted(existing.fluency, metrics.fluency), accuracy: weighted(existing.accuracy, metrics.accuracy), averageScore: weighted(existing.averageScore, result.overall), lastPracticedAt: result.evaluatedAt, exchanges: [{ turnId: turn.id, answer: result.answer, score: result.overall, ...metrics, evaluatedAt: result.evaluatedAt }, ...existing.exchanges].slice(0, 50) };
      write([next, ...records().filter((item) => item.id !== next.id)]);
      const progress = getUserProgress(); progress.immersive = { ...(progress.immersive || {}), attempts: Number(progress.immersive?.attempts || 0) + 1, completed: Number(progress.immersive?.completed || 0) + (completed ? 1 : 0), lastMissionId: mission.id, updatedAt: result.evaluatedAt }; if (progress.skills) progress.skills.speaking = Math.max(Number(progress.skills.speaking || 0), Math.round((metrics.accuracy + metrics.fluency) / 2 * .85)); if (progress.daily?.tasks) progress.daily.tasks.speaking = true; saveUserProgress(progress);
      app.MasteryService?.updateLesson?.(`immersive:${mission.id}`, { score: result.overall, completed });
      if (result.overall < 70) global.ErrorNotebookService?.add?.({ type: 'immersive-speaking', question: turn.npc, mistake: result.answer, correction: result.suggestion, explanation: `${result.feedback.grammar} ${result.feedback.natural}` });
      return next;
    },
    completion(world) { const missions = worldMissions(world); const completed = missions.filter((mission) => Number(this.get(mission.id)?.completedRuns || 0) > 0).length; return { completed, total: missions.length, percentage: missions.length ? Math.round(completed / missions.length * 100) : 0 }; }
  };

  const SpeakingJourneyService = {
    summary() { const attempts = ImmersiveProgressService.all().filter((item) => item.attempts); const average = (key) => attempts.length ? Math.round(attempts.reduce((sum, item) => sum + Number(item[key] || 0), 0) / attempts.length) : 0; const exchanges = attempts.flatMap((item) => item.exchanges.map((entry) => ({ ...entry, missionId: item.missionId }))).sort((a, b) => new Date(a.evaluatedAt) - new Date(b.evaluatedAt)); return { confidence: average('confidence'), fluency: average('fluency'), accuracy: average('accuracy'), attempts: attempts.reduce((sum, item) => sum + item.attempts, 0), completed: attempts.reduce((sum, item) => sum + item.completedRuns, 0), trend: exchanges.slice(-8) }; }
  };

  const LearningAvatarArchitectureService = {
    research() { const summary = SpeakingJourneyService.summary(); const progress = getUserProgress(); return { status: 'architecture-research', inputs: ['Learning goal', 'Mastery', 'SRS', 'Speaking journey'], state: { level: state.currentUser?.currentTopikLevel ? `TOPIK ${state.currentUser.currentTopikLevel}` : 'Level 0', speakingFocus: [summary.confidence, summary.fluency, summary.accuracy].indexOf(Math.min(summary.confidence, summary.fluency, summary.accuracy)) === 0 ? 'confidence' : summary.fluency <= summary.accuracy ? 'fluency' : 'accuracy', streak: progress.stats?.streak || 0 }, boundaries: ['Không tạo khuôn mặt AI', 'Không giả lập cảm xúc', 'Không tự động nhắn tin', 'Không dùng dữ liệu ngoài học tập'] }; }
  };

  const DebatePracticeService = {
    topics() { return content.debateTopics; },
    evaluate(topicId, answer) {
      const topic = content.debateTopics.find((item) => item.id === topicId); const response = String(answer || '').trim().slice(0, 1200); if (!topic || !response) return null;
      const position = includesAny(response, ['동의', '반대', '생각', '의견']) ? 100 : 40;
      const reason = includesAny(response, topic.connectors) ? 100 : 45;
      const relevance = Math.min(100, topic.keywords.filter((item) => clean(response).includes(clean(item))).length * 30 + 25);
      const development = Math.min(100, 35 + response.split(/\s+/).filter(Boolean).length * 6);
      const overall = Math.round(position * .25 + reason * .3 + relevance * .25 + development * .2);
      const result = { id: `debate-${Date.now()}`, recordType: 'debate', topicId, answer: response, overall, position, reason, relevance, development, createdAt: now() };
      write([result, ...records()].slice(0, 120)); return result;
    },
    history() { return records().filter((item) => item.recordType === 'debate'); }
  };

  function startMission(id) { const mission = missionById(id); if (!mission) return; runtime.session = { missionId: id, stepIndex: 0, feedback: null, messages: [{ role: 'partner', text: mission.steps[0].npc }] }; setView('immersive-session'); }
  function submitAnswer(answer) { const mission = missionById(runtime.session?.missionId); const turn = mission?.steps[runtime.session?.stepIndex]; if (!mission || !turn || !String(answer || '').trim()) return null; const result = evaluate(turn, answer); const metrics = speakingMetrics(result, answer, turn.modelAnswer); const completed = runtime.session.stepIndex === mission.steps.length - 1; ImmersiveProgressService.record(mission, turn, result, metrics, completed); runtime.session.messages.push({ role: 'learner', text: result.answer }); runtime.session.feedback = { ...result, metrics }; runtime.session.completed = completed; return runtime.session.feedback; }
  function nextStep() { const mission = missionById(runtime.session?.missionId); if (!mission || runtime.session.completed) return; runtime.session.stepIndex += 1; runtime.session.feedback = null; runtime.session.messages.push({ role: 'partner', text: mission.steps[runtime.session.stepIndex].npc }); render(); }

  function heading(back, eyebrow, title, description) { return `<section class="section page-heading world-heading"><button class="back-link" data-view="${back}">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`; }
  function immersionToggle() { const enabled = ImmersionSettingsService.enabled(); return `<section class="world-immersion-toggle section ${enabled ? 'enabled' : ''}"><div><span>IMMERSION MODE</span><b>${enabled ? '한국어만 사용' : 'Korean Only khi luyện'}</b><small>${enabled ? 'Dịch và romanization đang ẩn.' : 'Bật để ẩn bản dịch và phiên âm trong session.'}</small></div><button data-world-immersion aria-pressed="${enabled}">${enabled ? 'ON' : 'OFF'}</button></section>`; }
  function hubView() {
    const journey = SpeakingJourneyService.summary();
    return `${heading('immersion-journey', 'P4 · Future Immersive Experience', 'Thế giới tiếng Hàn', 'Luyện vai liên tục trong thành phố, trường học, công việc và chuyến đi.')}${immersionToggle()}<section class="world-hero section"><div><small>SPEAKING JOURNEY</small><h2>${journey.attempts ? `${journey.completed} mission đã hoàn thành` : 'Bắt đầu với một tình huống thật'}</h2><p>Confidence ${journey.confidence}% · Fluency ${journey.fluency}% · Accuracy ${journey.accuracy}%</p></div><button class="btn secondary" data-view="speaking-journey">Xem hành trình</button></section><section class="world-directory section">${content.worlds.map((world) => { const progress = ImmersiveProgressService.completion(world.id); return `<button data-view="${world.view}"><span>${world.icon}</span><div><b>${escapeHtml(world.title)}</b><small>${escapeHtml(world.subtitle)}</small><i><em style="width:${progress.percentage}%"></em></i></div><strong>${progress.completed}/${progress.total}</strong></button>`; }).join('')}<button data-view="debate-studio"><span>論</span><div><b>AI Debate Mode</b><small>Argument · Opinion · Discussion</small><i><em style="width:${Math.min(100, DebatePracticeService.history().length * 20)}%"></em></i></div><strong>${DebatePracticeService.history().length}</strong></button><button data-view="learning-avatar-research"><span>○</span><div><b>Learning Avatar Research</b><small>Kiến trúc cá nhân hóa · không avatar AI phức tạp</small><i><em style="width:25%"></em></i></div><strong>R&D</strong></button></section>`;
  }
  function catalogView(world, title, description) { const missions = worldMissions(world); const completion = ImmersiveProgressService.completion(world); return `${heading('immersive-world', world === 'city' ? '한국 도시' : 'IMMERSIVE SCENARIOS', title, description)}<section class="world-progress section"><div><b>${completion.percentage}%</b><span>${completion.completed}/${completion.total} tình huống</span></div><i><em style="width:${completion.percentage}%"></em></i></section><section class="scenario-world-grid section">${missions.map((mission) => { const saved = ImmersiveProgressService.get(mission.id); return `<article><div class="world-place-visual"><span>${mission.icon}</span><small>${escapeHtml(mission.place)}</small></div><div><p>${escapeHtml(mission.level)} · ${escapeHtml(mission.role)}</p><h2>${escapeHtml(mission.title)}</h2><h3 lang="ko">${escapeHtml(mission.koreanTitle)}</h3><small>${escapeHtml(mission.description)}</small><button class="btn primary" data-world-mission="${mission.id}">${saved ? 'Luyện lại' : 'Bắt đầu'}</button></div></article>`; }).join('')}</section>`; }
  function cityView() { return catalogView('city', 'Virtual Korean City', 'Chọn một địa điểm và xử lý nhiệm vụ bằng tiếng Hàn.'); }
  function roleplayView() { return catalogView('roleplay', 'Roleplay Game', 'Sống qua ngày đầu tiên của du học sinh, nhân viên hoặc khách du lịch.'); }
  function careerView() { return catalogView('career', 'Career Korean Simulator', 'Phỏng vấn, họp và email công việc với register phù hợp.'); }
  function universityView() { return catalogView('university', 'University Life Simulator', 'Lớp học, bạn bè và khuôn viên trong một hành trình liên tục.'); }
  function travelView() { return catalogView('travel', 'Travel Simulator', 'Đặt phòng, gọi món và hỏi đường bằng câu có thể dùng ngay.'); }
  function voiceView() { return catalogView('voice', 'Voice World', 'Hội thoại mở bằng giọng nói; nếu trình duyệt không hỗ trợ thì dùng text. Audio không được lưu.'); }

  function sessionView() {
    const session = runtime.session; const mission = missionById(session?.missionId); if (!mission) return hubView(); const turn = mission.steps[session.stepIndex]; const feedback = session.feedback; const koreanOnly = ImmersionSettingsService.enabled(); const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition;
    return `<div class="immersive-session-shell ${koreanOnly ? 'is-korean-only' : ''}">${heading('immersive-world', `${mission.place} · ${mission.level}`, koreanOnly ? mission.koreanTitle : mission.title, koreanOnly ? turn.goal : mission.description)}<section class="session-status section"><span>${session.stepIndex + 1}/${mission.steps.length}</span><i><em style="width:${Math.round((session.stepIndex + (feedback ? 1 : 0)) / mission.steps.length * 100)}%"></em></i><button data-world-immersion>${koreanOnly ? 'KOR ONLY' : 'Bilingual'}</button></section><section class="world-session-stage section"><aside><div class="session-location"><span>${mission.icon}</span><small>${escapeHtml(mission.place)}</small></div><p>${koreanOnly ? '역할' : 'Vai của bạn'}: <b>${escapeHtml(mission.role)}</b></p><p class="world-translation">${escapeHtml(turn.goal)}</p></aside><main><div class="world-dialogue">${session.messages.map((message) => `<article class="${message.role}"><small>${message.role === 'partner' ? (koreanOnly ? '상대방' : 'Đối tác') : (koreanOnly ? '나' : 'Bạn')}</small><p lang="ko">${escapeHtml(message.text)}</p>${message.role === 'partner' ? `<button data-world-speak="${escapeHtml(message.text)}">🔊</button>` : ''}</article>`).join('')}</div>${!feedback ? `<div class="npc-prompt"><b lang="ko">${escapeHtml(turn.npc)}</b><p class="world-translation">${escapeHtml(turn.translation)}</p></div><form id="worldResponseForm"><label>${koreanOnly ? '한국어로 답하세요' : 'Trả lời bằng tiếng Hàn'}<textarea id="worldAnswer" name="answer" lang="ko" maxlength="800" rows="4" required></textarea></label><div><button class="btn secondary" type="button" data-world-voice ${Recognition ? '' : 'disabled'}>${Recognition ? '🎙 Voice' : 'Text fallback'}</button><button class="btn primary">답변 보내기</button></div><small>${Recognition ? 'SpeechRecognition ko-KR · không lưu audio' : 'Trình duyệt không hỗ trợ microphone; session text vẫn hoạt động.'}</small></form>` : `<section class="world-feedback"><header><strong>${feedback.overall}</strong><div><b>${feedback.overall >= 80 ? (koreanOnly ? '자연스러워요' : 'Phù hợp') : (koreanOnly ? '한 번 더 연습해요' : 'Cần luyện thêm')}</b><span>Meaning ${feedback.meaning} · Grammar ${feedback.grammar} · Natural ${feedback.natural}</span></div></header><div class="speaking-signal-grid"><div><span>Confidence</span><b>${feedback.metrics.confidence}%</b></div><div><span>Fluency</span><b>${feedback.metrics.fluency}%</b></div><div><span>Accuracy</span><b>${feedback.metrics.accuracy}%</b></div></div><div class="world-suggestion"><small>${koreanOnly ? '자연스러운 표현' : 'Cách nói gợi ý'}</small><b lang="ko">${escapeHtml(feedback.suggestion)}</b><button data-world-speak="${escapeHtml(feedback.suggestion)}">🔊</button></div><p class="world-translation">${escapeHtml(feedback.feedback.grammar)} ${escapeHtml(feedback.feedback.natural)}</p><div class="action-row">${session.completed ? '<button class="btn primary" data-world-finish>Hoàn thành mission</button>' : '<button class="btn primary" data-world-next>Tiếp tục</button>'}<button class="btn secondary" data-world-retry>Thử lại</button></div></section>`}</main></section></div>`;
  }

  function debateView() {
    const topic = content.debateTopics.find((item) => item.id === runtime.debateTopicId) || content.debateTopics[0]; const result = runtime.debateResult;
    return `${heading('immersive-world', 'ARGUMENT · OPINION · DISCUSSION', 'AI Debate Mode', 'Lập luận được chấm bằng rubric; trợ lý hiện có chỉ phản biện khi bạn chủ động yêu cầu.')}<nav class="debate-topics section">${content.debateTopics.map((item) => `<button class="${item.id === topic.id ? 'active' : ''}" data-debate-topic="${item.id}"><b>${escapeHtml(item.title)}</b><small lang="ko">${escapeHtml(item.korean)}</small></button>`).join('')}</nav><section class="debate-stage section"><aside><span>TOPIC</span><h2 lang="ko">${escapeHtml(topic.opening)}</h2><p>Hãy nêu quan điểm, lý do, ví dụ và phản hồi một ý kiến trái chiều.</p><div>${topic.connectors.map((item) => `<i lang="ko">${escapeHtml(item)}</i>`).join('')}</div></aside><main><form id="debateForm"><label>Lập luận bằng tiếng Hàn<textarea name="answer" lang="ko" rows="8" maxlength="1200" required>${escapeHtml(result?.topicId === topic.id ? result.answer : '')}</textarea></label><button class="btn primary">Phân tích lập luận</button></form>${result?.topicId === topic.id ? `<div class="debate-result"><strong>${result.overall}</strong><div><p>Quan điểm <b>${result.position}%</b></p><p>Lý do <b>${result.reason}%</b></p><p>Bám chủ đề <b>${result.relevance}%</b></p><p>Phát triển ý <b>${result.development}%</b></p></div><button class="btn secondary" data-open-ai="${escapeHtml(`Hãy phản biện lập luận tiếng Hàn này theo vai người tranh luận, sau đó gợi ý một câu trả lời tự nhiên. Chủ đề: ${topic.korean}. Lập luận: ${result.answer}`)}">Nhờ trợ lý phản biện</button></div>` : ''}</main></section>`;
  }

  function journeyView() { const summary = SpeakingJourneyService.summary(); const points = summary.trend.map((item, index) => `${index ? '→ ' : ''}${item.score}`).join(' ') || 'Chưa có dữ liệu'; return `${heading('immersive-world', 'ADVANCED SPEAKING JOURNEY', 'Hành trình nói', 'Theo dõi ba tín hiệu học tập minh bạch; không tuyên bố chấm âm vị chính xác.')}<section class="journey-score-grid section"><article><span>CONFIDENCE</span><b>${summary.confidence}%</b><p>Mức hoàn thành câu, độ dài và bám vai.</p></article><article><span>FLUENCY</span><b>${summary.fluency}%</b><p>Độ liền mạch của transcript và cách nói tự nhiên.</p></article><article><span>ACCURACY</span><b>${summary.accuracy}%</b><p>Ý nghĩa, ngữ pháp và độ phù hợp bối cảnh.</p></article></section><section class="journey-trend section"><div><small>${summary.attempts} lượt · ${summary.completed} mission</small><h2>Xu hướng điểm gần đây</h2><p>${points}</p></div><button class="btn primary" data-view="virtual-korean-city">Tiếp tục luyện</button></section>`; }
  function avatarView() { const research = LearningAvatarArchitectureService.research(); return `${heading('immersive-world', 'ARCHITECTURE RESEARCH ONLY', 'Personal Learning Avatar', 'Nghiên cứu một đại diện học tập tối giản; chưa tạo nhân vật AI, giọng nói hay khuôn mặt.')}<section class="avatar-research-card section"><div class="avatar-placeholder"><span>TH</span><small>STATE, NOT PERSONA</small></div><article><span>PROPOSED INPUTS</span>${research.inputs.map((item) => `<p>✓ ${escapeHtml(item)}</p>`).join('')}</article><article><span>CURRENT SAFE STATE</span><p>Level: <b>${escapeHtml(research.state.level)}</b></p><p>Speaking focus: <b>${escapeHtml(research.state.speakingFocus)}</b></p><p>Streak: <b>${research.state.streak}</b></p></article></section><section class="avatar-boundaries section"><h2>Ranh giới sản phẩm</h2>${research.boundaries.map((item) => `<p><span>—</span>${escapeHtml(item)}</p>`).join('')}<small>Giai đoạn P4 chỉ xác định contract dữ liệu và giới hạn an toàn.</small></section>`; }

  function startVoice(button) { const Recognition = global.SpeechRecognition || global.webkitSpeechRecognition; const input = document.getElementById('worldAnswer'); if (!Recognition || !input) return toast('Thiết bị chưa hỗ trợ SpeechRecognition. Hãy dùng text.'); if (runtime.recognition) { runtime.recognition.stop(); return; } const recognition = new Recognition(); runtime.recognition = recognition; recognition.lang = 'ko-KR'; recognition.interimResults = false; button.disabled = true; button.textContent = '듣고 있어요…'; recognition.onresult = (event) => { input.value = event.results[0][0].transcript; }; recognition.onerror = (event) => { if (event.error !== 'aborted') toast('Không thể nhận giọng nói. Hãy dùng text.'); }; recognition.onend = () => { runtime.recognition = null; button.disabled = false; button.textContent = '🎙 Voice'; }; try { recognition.start(); } catch (_) { runtime.recognition = null; button.disabled = false; toast('Không thể mở microphone. Hãy dùng text.'); } }

  global.ImmersionSettingsService = ImmersionSettingsService;
  global.ImmersiveProgressService = ImmersiveProgressService;
  global.SpeakingJourneyService = SpeakingJourneyService;
  global.LearningAvatarArchitectureService = LearningAvatarArchitectureService;
  global.DebatePracticeService = DebatePracticeService;
  global.ImmersiveWorldController = { startMission, submitAnswer, nextStep, reset() { runtime.session = null; } };
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'immersive-world': hubView, 'virtual-korean-city': cityView, 'immersive-session': sessionView, 'roleplay-game': roleplayView, 'debate-studio': debateView, 'career-korean': careerView, 'university-life': universityView, 'travel-simulator': travelView, 'voice-world': voiceView, 'speaking-journey': journeyView, 'learning-avatar-research': avatarView };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return;
    if (state.currentView === 'immersion-journey' && !document.querySelector('[data-open-immersive-world]')) document.querySelector('.immersion-journey-strip,.page-heading')?.insertAdjacentHTML('afterend', `<section class="future-world-entry section"><div><span>城</span><div><b>Thế giới tiếng Hàn</b><small>Virtual City · Roleplay · Career · University · Travel</small></div></div><button class="btn primary" data-open-immersive-world>Khám phá</button></section>`);
    document.querySelector('[data-open-immersive-world]')?.addEventListener('click', () => setView('immersive-world'));
    document.querySelectorAll('[data-world-mission]').forEach((button) => { button.onclick = () => startMission(button.dataset.worldMission); });
    document.querySelectorAll('[data-world-immersion]').forEach((button) => { button.onclick = () => { ImmersionSettingsService.set(!ImmersionSettingsService.enabled()); toast(ImmersionSettingsService.enabled() ? 'Đã bật Korean Only.' : 'Đã khôi phục bản dịch và phiên âm.'); render(); }; });
    document.querySelectorAll('[data-world-speak]').forEach((button) => { button.onclick = () => speakKorean(button.dataset.worldSpeak); });
    const responseForm = document.getElementById('worldResponseForm'); if (responseForm) responseForm.onsubmit = (event) => { event.preventDefault(); const answer = new FormData(responseForm).get('answer'); if (!String(answer || '').trim()) return toast('Hãy nhập câu trả lời.'); submitAnswer(answer); render(); };
    document.querySelector('[data-world-voice]')?.addEventListener('click', (event) => startVoice(event.currentTarget));
    document.querySelector('[data-world-next]')?.addEventListener('click', nextStep);
    document.querySelector('[data-world-retry]')?.addEventListener('click', () => { runtime.session.feedback = null; runtime.session.messages = runtime.session.messages.filter((item, index) => item.role !== 'learner' || index < runtime.session.stepIndex * 2); render(); });
    document.querySelector('[data-world-finish]')?.addEventListener('click', () => { const world = missionById(runtime.session?.missionId)?.world || 'city'; runtime.session = null; toast('Đã lưu hành trình nói.'); setView(content.worlds.find((item) => item.id === world)?.view || 'immersive-world'); });
    document.querySelectorAll('[data-debate-topic]').forEach((button) => { button.onclick = () => { runtime.debateTopicId = button.dataset.debateTopic; runtime.debateResult = null; render(); }; });
    const debateForm = document.getElementById('debateForm'); if (debateForm) debateForm.onsubmit = (event) => { event.preventDefault(); runtime.debateResult = DebatePracticeService.evaluate(runtime.debateTopicId, new FormData(debateForm).get('answer')); if (!runtime.debateResult) return toast('Hãy nhập lập luận tiếng Hàn.'); render(); };
  };
  render();
})(window);
