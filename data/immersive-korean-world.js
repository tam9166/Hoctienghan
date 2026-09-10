/* Tiếng Hàn - TamHoanq · P58 Immersive Korean World */
(function buildImmersiveKoreanWorld(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService, setView, render, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.immersiveKoreanWorld || 'klearn_immersive_korean_world';
  const routes = new Set(['immersive-daily-life', 'immersive-story', 'immersive-culture-game', 'immersive-readiness', 'immersive-scenarios', 'immersive-progress-map']);
  const runtime = state.immersiveKoreanWorldRuntime || (state.immersiveKoreanWorldRuntime = { content: null, loading: false, error: '', daily: null, story: null, culture: null, feedback: null });
  const list = (value) => Array.isArray(value) ? value : [];
  const object = (value) => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const clean = (value, max = 600) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max);
  const esc = (value) => escapeHtml ? escapeHtml(value) : clean(value, 1000);
  const now = () => new Date().toISOString();
  const rank = { beginner: 1, intermediate: 2, advanced: 3 };
  const emptyStore = () => ({ id: 'p44-progress', version: 2, level: 'beginner', roleFilter: 'all', dailyRuns: [], storyRuns: [], cultureRuns: [], survivalRuns: [], updatedAt: null });
  const readStore = () => { const value = userScoped(STORE_KEY)[0]; return value && typeof value === 'object' ? { ...emptyStore(), ...value, dailyRuns: list(value.dailyRuns), storyRuns: list(value.storyRuns), cultureRuns: list(value.cultureRuns), survivalRuns: list(value.survivalRuns) } : emptyStore(); };
  const writeStore = (changes = {}) => { if (!state.currentUser?.id) return null; const next = { ...readStore(), ...changes, version: 2, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); CloudSyncService?.schedule?.('immersive-korean-world'); return next; };
  const percent = (value, total) => total ? Math.max(0, Math.min(100, Math.round(Number(value || 0) / total * 100))) : 0;

  const ImmersiveKoreanWorldContentService = {
    hydrate(value) {
      const places = list(value?.cityPlaces).map((item) => item.id).sort().join(','); const levels = list(value?.levels).map((item) => item.id).sort().join(','); const scenarios = list(value?.scenarioLibrary);
      const scenarioIds = new Set(scenarios.map((item) => item.id)); const roles = new Set(scenarios.map((item) => item.role));
      if (value?.verified !== true || value.reviewStatus !== 'approved' || value.version !== '2.0.0' || places !== 'airport,cafe,office,university' || levels !== 'advanced,beginner,intermediate' || scenarios.length < 7 || scenarioIds.size !== scenarios.length || !['student', 'worker', 'traveler'].every((role) => roles.has(role)) || scenarios.some((item) => !item.missionId || !rank[item.level]) || value.privacy?.storesRawAudio !== false || value.privacy?.storesFreeText !== false || value.privacy?.progressIsUserScoped !== true) throw new Error('Immersive Korean World content quality gate failed');
      runtime.content = value; runtime.error = ''; return value;
    },
    async load() {
      if (runtime.content) return runtime.content; if (runtime.loading) return runtime.loading;
      if (typeof global.fetch !== 'function') return null;
      runtime.loading = global.fetch('./content/immersive-korean-world.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Immersive world ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message, 180); return null; }).finally(() => { runtime.loading = false; if (routes.has(state.currentView) || state.currentView === 'immersive-world') render(); }); return runtime.loading;
    }
  };

  const ImmersiveLevelService = {
    all: () => list(runtime.content?.levels),
    currentId() { const value = readStore().level; return rank[value] ? value : 'beginner'; },
    current() { return this.all().find((item) => item.id === this.currentId()) || this.all()[0] || null; },
    set(level) { if (!rank[level]) return null; writeStore({ level }); return this.current(); }
  };

  const VirtualKoreanCityService = {
    places: () => list(runtime.content?.cityPlaces),
    open(placeId) { const place = this.places().find((item) => item.id === placeId); if (!place || !global.ImmersiveWorldController?.startMission) return false; global.ImmersiveWorldController.startMission(place.missionId); return true; },
    progress() { return this.places().map((place) => { const record = global.ImmersiveProgressService?.get?.(place.missionId); return { ...place, completed: Number(record?.completedRuns || 0) > 0, attempts: Number(record?.attempts || 0), score: Number(record?.averageScore || 0) }; }); }
  };

  const ImmersiveKoreanWorldProgressService = {
    snapshot: () => readStore(),
    scenarioProgress() { const missions = list(global.KLEARN_IMMERSIVE_WORLD_DATA?.missions); return missions.map((mission) => { const value = global.ImmersiveProgressService?.get?.(mission.id); return { missionId: mission.id, world: mission.world, level: mission.level, completed: Number(value?.completedRuns || 0) > 0, completedRuns: Number(value?.completedRuns || 0), averageScore: Number(value?.averageScore || 0) }; }); },
    completedScenarioIds() { return this.scenarioProgress().filter((item) => item.completed).map((item) => item.missionId); }
  };

  const ScenarioLibraryService = {
    all: () => list(runtime.content?.scenarioLibrary),
    roles: () => ['all', 'student', 'worker', 'traveler'],
    role() { const value = readStore().roleFilter; return this.roles().includes(value) ? value : 'all'; },
    setRole(role) { if (!this.roles().includes(role)) return false; writeStore({ roleFilter: role }); return true; },
    find(id) { return this.all().find((item) => item.id === id) || null; },
    filtered({ role = this.role(), level = ImmersiveLevelService.currentId() } = {}) { return this.all().filter((item) => (role === 'all' || item.role === role) && rank[item.level] <= rank[level]); },
    progress(item) { const record = global.ImmersiveProgressService?.get?.(item?.missionId); return { completed: Number(record?.completedRuns || 0) > 0, attempts: Number(record?.attempts || 0), score: Math.round(Number(record?.averageScore || 0)) }; },
    start(id) { const item = this.find(id); if (!item || !global.ImmersiveWorldController?.startMission) return false; global.ImmersiveWorldController.startMission(item.missionId); return true; }
  };

  const ImmersiveMissionService = {
    catalog: () => ScenarioLibraryService.all(),
    start: (scenarioId) => ScenarioLibraryService.start(scenarioId),
    completed() { return this.catalog().filter((item) => ScenarioLibraryService.progress(item).completed); },
    next() { return ScenarioLibraryService.filtered().find((item) => !ScenarioLibraryService.progress(item).completed) || ScenarioLibraryService.filtered()[0] || null; }
  };

  const ImmersiveProgressMapService = {
    nodes() {
      const completed = new Set(ImmersiveMissionService.completed().map((item) => item.id)); const current = ImmersiveLevelService.currentId();
      return ImmersiveLevelService.all().map((level) => { const scenarios = ScenarioLibraryService.all().filter((item) => item.level === level.id); const done = scenarios.filter((item) => completed.has(item.id)).length; const status = scenarios.length > 0 && done === scenarios.length ? 'completed' : level.id === current ? 'current' : 'upcoming'; return { ...level, status, completed: done, total: scenarios.length, percentage: percent(done, scenarios.length) }; });
    },
    summary() { const nodes = this.nodes(); const done = nodes.reduce((sum, item) => sum + item.completed, 0); const total = nodes.reduce((sum, item) => sum + item.total, 0); return { completed: done, total, percentage: percent(done, total), nextMission: ImmersiveMissionService.next(), nodes }; }
  };

  const DailyLifeSimulationService = {
    stages(level = ImmersiveLevelService.currentId()) { return list(runtime.content?.dailyLife).filter((item) => rank[item.level] <= rank[level]); },
    start() { const stages = this.stages(); runtime.daily = { id: `daily-${Date.now().toString(36)}`, level: ImmersiveLevelService.currentId(), index: 0, score: 0, responses: [], completed: false }; runtime.feedback = null; setView('immersive-daily-life'); return runtime.daily; },
    current() { return this.stages(runtime.daily?.level)[runtime.daily?.index || 0] || null; },
    choose(choiceId) { const stage = this.current(); const choice = list(stage?.choices).find((item) => item.id === choiceId); if (!runtime.daily || !stage || !choice || runtime.feedback) return null; runtime.daily.responses.push({ stageId: stage.id, choiceId: choice.id, correct: choice.correct === true }); if (choice.correct) runtime.daily.score += 1; runtime.feedback = { correct: choice.correct === true, feedback: choice.feedback, answer: choice.text }; const total = this.stages(runtime.daily.level).length; if (runtime.daily.responses.length === total) { runtime.daily.completed = true; const run = { id: runtime.daily.id, level: runtime.daily.level, score: runtime.daily.score, total, percentage: percent(runtime.daily.score, total), choiceIds: runtime.daily.responses.map((item) => item.choiceId), rawTextStored: false, completedAt: now() }; const store = readStore(); writeStore({ dailyRuns: [run, ...store.dailyRuns].slice(0, 60) }); } return runtime.feedback; },
    next() { if (!runtime.daily || runtime.daily.completed) return null; runtime.daily.index += 1; runtime.feedback = null; return this.current(); },
    best() { return Math.max(0, ...readStore().dailyRuns.map((item) => Number(item.percentage || 0))); }
  };

  const InteractiveKoreanStoryService = {
    story: () => runtime.content?.story || null,
    node(id) { return list(this.story()?.nodes).find((item) => item.id === id) || null; },
    start() { const story = this.story(); if (!story) return null; runtime.story = { id: `story-${Date.now().toString(36)}`, storyId: story.id, nodeId: story.startNode, score: 0, path: [], completed: false }; runtime.feedback = null; setView('immersive-story'); return runtime.story; },
    current() { return this.node(runtime.story?.nodeId); },
    choose(choiceId) { const node = this.current(); const choice = list(node?.choices).find((item) => item.id === choiceId); if (!runtime.story || !choice || runtime.story.completed) return null; runtime.story.path.push(choice.id); runtime.story.score += Number(choice.score || 0); runtime.story.nodeId = choice.next; const next = this.current(); runtime.feedback = { selected: choice.text, gained: Number(choice.score || 0), nextScene: next?.scene || '' }; if (next?.ending) { runtime.story.completed = true; const maxScore = 4; const run = { id: runtime.story.id, storyId: runtime.story.storyId, level: ImmersiveLevelService.currentId(), outcome: next.outcome, score: runtime.story.score, percentage: percent(runtime.story.score, maxScore), choiceIds: [...runtime.story.path], rawTextStored: false, completedAt: now() }; const store = readStore(); writeStore({ storyRuns: [run, ...store.storyRuns].slice(0, 60) }); } return { ...runtime.feedback, completed: runtime.story.completed, ending: next?.ending ? next : null }; },
    best() { return Math.max(0, ...readStore().storyRuns.map((item) => Number(item.percentage || 0))); }
  };

  const CultureDecisionGameService = {
    questions(level = ImmersiveLevelService.currentId()) { return list(runtime.content?.cultureDecisions).filter((item) => rank[item.level] <= rank[level]); },
    start() { const questions = this.questions(); if (!questions.length) return null; runtime.culture = { id: `culture-${Date.now().toString(36)}`, level: ImmersiveLevelService.currentId(), index: 0, score: 0, responses: [], completed: false }; runtime.feedback = null; setView('immersive-culture-game'); return runtime.culture; },
    current() { return this.questions(runtime.culture?.level)[runtime.culture?.index || 0] || null; },
    answer(index) { const question = this.current(); const selected = Number(index); if (!runtime.culture || !question || runtime.feedback || !Number.isInteger(selected) || selected < 0 || selected >= question.choices.length) return null; const correct = selected === Number(question.correctIndex); runtime.culture.responses.push({ questionId: question.id, choiceIndex: selected, correct }); if (correct) runtime.culture.score += 1; runtime.feedback = { correct, explanation: question.explanation }; const total = this.questions(runtime.culture.level).length; if (runtime.culture.responses.length === total) { runtime.culture.completed = true; const run = { id: runtime.culture.id, level: runtime.culture.level, score: runtime.culture.score, total, percentage: percent(runtime.culture.score, total), decisions: runtime.culture.responses.map((item) => ({ questionId: item.questionId, choiceIndex: item.choiceIndex, correct: item.correct })), rawTextStored: false, completedAt: now() }; const store = readStore(); writeStore({ cultureRuns: [run, ...store.cultureRuns].slice(0, 60) }); } return runtime.feedback; },
    next() { if (!runtime.culture || runtime.culture.completed) return null; runtime.culture.index += 1; runtime.feedback = null; return this.current(); },
    best() { return Math.max(0, ...readStore().cultureRuns.map((item) => Number(item.percentage || 0))); }
  };

  const LanguageSurvivalModeService = {
    enabled: () => Boolean(global.ImmersionSettingsService?.enabled?.()),
    set(enabled) { const changed = global.ImmersionSettingsService?.set?.(Boolean(enabled)); if (enabled && changed) { const store = readStore(); writeStore({ survivalRuns: [{ id: `survival-${Date.now().toString(36)}`, level: ImmersiveLevelService.currentId(), enabledAt: now(), rawAudioStored: false }, ...store.survivalRuns].slice(0, 30) }); } return Boolean(changed); }
  };

  const RealWorldReadinessService = {
    calculate() {
      const weights = runtime.content?.readiness?.weights || { city: 30, roleplay: 20, dailyLife: 15, story: 15, culture: 15, survival: 5 }; const scenario = ImmersiveKoreanWorldProgressService.scenarioProgress(); const cityIds = new Set(VirtualKoreanCityService.places().map((item) => item.missionId)); const cityCompleted = scenario.filter((item) => cityIds.has(item.missionId) && item.completed).length; const roleplay = scenario.filter((item) => item.world === 'roleplay'); const roleplayCompleted = roleplay.filter((item) => item.completed).length; const store = readStore();
      const inputs = { city: percent(cityCompleted, cityIds.size), roleplay: percent(roleplayCompleted, roleplay.length), dailyLife: DailyLifeSimulationService.best(), story: InteractiveKoreanStoryService.best(), culture: CultureDecisionGameService.best(), survival: (LanguageSurvivalModeService.enabled() || store.survivalRuns.length) ? 100 : 0 };
      const breakdown = Object.fromEntries(Object.entries(inputs).map(([key, value]) => [key, { score: value, weight: Number(weights[key] || 0), points: Number((value * Number(weights[key] || 0) / 100).toFixed(1)) }])); const score = Math.round(Object.values(breakdown).reduce((sum, item) => sum + item.points, 0)); const band = list(runtime.content?.readiness?.bands).sort((a, b) => b.minimum - a.minimum).find((item) => score >= item.minimum) || { id: 'foundation', label: 'Cần thêm trải nghiệm có hướng dẫn' };
      return { score, band, breakdown, evidence: { cityCompleted, cityTotal: cityIds.size, roleplayCompleted, roleplayTotal: roleplay.length, dailyRuns: store.dailyRuns.length, storyRuns: store.storyRuns.length, cultureRuns: store.cultureRuns.length }, disclaimer: runtime.content?.readiness?.disclaimer || 'Điểm học tập nội bộ, không phải chứng nhận chính thức.', calculatedAt: now() };
    }
  };

  const survivalCopy = (vi, ko) => LanguageSurvivalModeService.enabled() ? ko : vi;
  const heading = (back, eyebrow, title, description) => `<section class="section page-heading p44-heading"><button class="back-link" data-view="${esc(back)}" aria-label="${survivalCopy('Quay lại', '뒤로 가기')}">←</button><p class="eyebrow">${esc(eyebrow)}</p><h1 class="headline">${esc(title)}</h1><p class="subtle">${esc(description)}</p></section>`;
  const loadingView = () => heading('immersive-world', 'P58 · IMMERSIVE KOREAN WORLD', 'Đang chuẩn bị thế giới…', runtime.error || 'Nội dung tình huống đang được tải.');
  const levelSelector = () => `<div class="p44-levels" role="group" aria-label="Immersion level">${ImmersiveLevelService.all().map((level) => `<button type="button" class="${level.id === ImmersiveLevelService.currentId() ? 'active' : ''}" data-p44-level="${level.id}" aria-pressed="${level.id === ImmersiveLevelService.currentId()}"><b>${esc(level.label)}</b><small>${esc(level.description)}</small></button>`).join('')}</div>`;
  const hubPanel = () => { const readiness = RealWorldReadinessService.calculate(); const city = VirtualKoreanCityService.progress(); const next = ImmersiveMissionService.next(); return `<section class="p44-world-panel section" data-p44-world-panel><div class="p44-panel-head"><div><p class="eyebrow">P58 · LIVING KOREAN WORLD</p><h2>Học bằng cách sống trong tình huống</h2><p>Chọn vai, đến một địa điểm và hoàn thành nhiệm vụ bằng tiếng Hàn.</p></div><button class="p44-readiness-ring" data-view="immersive-readiness" aria-label="Xem điểm sẵn sàng đời thực"><strong>${readiness.score}</strong><span>READINESS</span></button></div>${levelSelector()}<div class="p44-city-grid">${city.map((place) => `<button type="button" data-p44-place="${place.id}" class="${place.completed ? 'completed' : ''}"><span>${place.icon}</span><b>${esc(place.title)}</b><small lang="ko">${esc(place.korean)}</small><em>${place.completed ? '✓ Hoàn thành' : 'Mở nhiệm vụ'}</em></button>`).join('')}</div>${next ? `<button class="p58-next-mission" data-p58-scenario="${esc(next.id)}"><span>NHIỆM VỤ TIẾP THEO</span><b>${esc(next.title)}</b><small lang="ko">${esc(next.titleKo)}</small><strong>→</strong></button>` : ''}<div class="p58-shortcuts"><button data-view="immersive-scenarios"><b>Scenario Library</b><small>${ScenarioLibraryService.all().length} tình huống theo vai</small></button><button data-view="immersive-progress-map"><b>Progress Map</b><small>Beginner → Intermediate → Advanced</small></button></div><div class="p44-experience-grid"><button data-p44-start="daily"><b>Một ngày ở Hàn</b><small>Đi qua lịch sinh hoạt bằng quyết định thực tế.</small></button><button data-p44-start="story"><b>Truyện tương tác</b><small>Lựa chọn câu trả lời làm thay đổi hành trình.</small></button><button data-p44-start="culture"><b>Ứng xử văn hóa</b><small>Chọn register và hành vi phù hợp bối cảnh.</small></button><button data-p44-survival aria-pressed="${LanguageSurvivalModeService.enabled()}"><b>한국어 생존 모드</b><small>${LanguageSurvivalModeService.enabled() ? '한국어만 사용합니다' : 'Ẩn dịch và romanization'}</small></button></div></section>`; };

  function dailyView() {
    if (!runtime.content) return loadingView(); const session = runtime.daily; const stage = DailyLifeSimulationService.current(); const ko = LanguageSurvivalModeService.enabled();
    if (!session || !stage) return `${heading('immersive-world', 'KOREAN DAILY LIFE', survivalCopy('Một ngày ở Hàn', '한국에서의 하루'), survivalCopy('Mỗi chặng là một nhiệm vụ giao tiếp; không phải danh sách bài học.', '하루 동안 실제 상황별 미션을 수행하세요.'))}<section class="p44-start-card section"><span>하루</span><h2>${survivalCopy(`${DailyLifeSimulationService.stages().length} tình huống trong ngày`, `오늘의 상황 ${DailyLifeSimulationService.stages().length}개`)}</h2><p>${survivalCopy('Cửa hàng, tàu điện, công việc, ăn uống và hàng xóm theo cấp độ đã chọn.', '편의점, 지하철, 회사와 일상생활을 연습합니다.')}</p><button class="btn primary" data-p44-start="daily">${survivalCopy('Bắt đầu ngày mới', '하루 시작하기')}</button></section>`;
    const feedback = runtime.feedback; const stages = DailyLifeSimulationService.stages(session.level); const genericFeedback = feedback?.correct ? survivalCopy(feedback.feedback, '상황에 잘 맞는 표현입니다.') : survivalCopy(feedback?.feedback, '상황과 높임말을 다시 확인해 보세요.');
    return `${heading('immersive-world', `${stage.time} · ${stage.place}`, survivalCopy('Một ngày ở Hàn', '한국에서의 하루'), ko ? stage.prompt : stage.goal)}<section class="p44-sim-progress section"><b>${session.index + 1}/${stages.length}</b><i><em style="width:${percent(session.index + (feedback ? 1 : 0), stages.length)}%"></em></i><span>${session.score} ${survivalCopy('đúng', '정답')}</span></section><section class="p44-decision-stage section"><div class="p44-scene"><small>${esc(stage.time)} · ${esc(stage.place)}</small><h2 lang="ko">${esc(stage.prompt)}</h2>${ko ? '' : `<p>${esc(stage.translation)}</p>`}</div><div class="p44-choice-list">${stage.choices.map((choice) => `<button type="button" data-p44-daily-choice="${choice.id}" ${feedback ? 'disabled' : ''} lang="ko">${esc(choice.text)}</button>`).join('')}</div>${feedback ? `<div class="p44-feedback ${feedback.correct ? 'good' : 'needs-work'}"><b>${feedback.correct ? survivalCopy('Phù hợp', '적절해요') : survivalCopy('Cần điều chỉnh', '다시 생각해 보세요')}</b><p>${esc(genericFeedback)}</p>${session.completed ? `<button class="btn primary" data-view="immersive-readiness">${survivalCopy('Xem kết quả ngày', '결과 보기')}</button>` : `<button class="btn primary" data-p44-daily-next>${survivalCopy('Tiếp tục', '계속하기')}</button>`}</div>` : ''}</section>`;
  }
  function storyView() {
    if (!runtime.content) return loadingView(); const session = runtime.story; const node = InteractiveKoreanStoryService.current(); const ko = LanguageSurvivalModeService.enabled();
    if (!session || !node) return `${heading('immersive-world', 'INTERACTIVE STORY', survivalCopy('Ngày đầu ở Seoul', '서울에서의 첫날'), survivalCopy('Câu trả lời của bạn quyết định cảnh tiếp theo.', '선택한 대답에 따라 다음 장면이 달라집니다.'))}<section class="p44-start-card section"><span>路</span><h2 lang="ko">${esc(runtime.content.story.koreanTitle)}</h2><p>${survivalCopy('Sửa sai trong hành trình vẫn được tính là tiến bộ; không hard lock.', '틀려도 다시 선택할 수 있습니다.')}</p><button class="btn primary" data-p44-start="story">${survivalCopy('Bắt đầu câu chuyện', '이야기 시작하기')}</button></section>`;
    if (node.ending) return `${heading('immersive-world', node.scene, ko ? runtime.content.story.koreanTitle : runtime.content.story.title, ko ? node.narration : node.translation)}<section class="p44-ending section"><strong>${node.outcome === 'ready' ? '✓' : '↻'}</strong><h2 lang="ko">${esc(node.narration)}</h2><p>${node.outcome === 'ready' ? survivalCopy('Bạn đã đi đến cuối hành trình bằng lựa chọn phù hợp.', '적절한 선택으로 이야기를 마쳤습니다.') : survivalCopy('Bạn có thể bắt đầu lại và thử cách yêu cầu trợ giúp rõ hơn.', '다시 시작해서 더 정확하게 도움을 요청해 보세요.')}</p><div class="action-row"><button class="btn primary" data-p44-start="story">${survivalCopy('Chơi lại', '다시 하기')}</button><button class="btn secondary" data-view="immersive-readiness">${survivalCopy('Xem readiness', '준비도 보기')}</button></div></section>`;
    return `${heading('immersive-world', node.scene, ko ? runtime.content.story.koreanTitle : runtime.content.story.title, survivalCopy('Lựa chọn một câu bạn thực sự có thể dùng.', '실제로 사용할 수 있는 문장을 선택하세요.'))}<section class="p44-story-stage section"><div><small>SCENE ${session.path.length + 1}</small><h2 lang="ko">${esc(node.narration)}</h2>${ko ? '' : `<p>${esc(node.translation)}</p>`}</div><div class="p44-choice-list">${node.choices.map((choice) => `<button type="button" data-p44-story-choice="${choice.id}" lang="ko">${esc(choice.text)}</button>`).join('')}</div></section>`;
  }
  function cultureView() {
    if (!runtime.content) return loadingView(); const session = runtime.culture; const question = CultureDecisionGameService.current(); const ko = LanguageSurvivalModeService.enabled();
    if (!session || !question) return `${heading('immersive-world', 'CULTURE DECISION GAME', survivalCopy('Chọn cách ứng xử phù hợp', '상황에 맞는 행동을 선택하세요'), survivalCopy('Ngôn ngữ đúng vẫn cần phù hợp quan hệ và hoàn cảnh.', '문법뿐 아니라 관계와 상황도 중요합니다.'))}<section class="p44-start-card section"><span>禮</span><h2>${survivalCopy(`${CultureDecisionGameService.questions().length} quyết định theo cấp độ`, `문화 선택 ${CultureDecisionGameService.questions().length}개`)}</h2><p>${survivalCopy('Feedback giải thích lý do, không chỉ báo đúng hoặc sai.', '정답뿐 아니라 문화적인 이유도 확인할 수 있습니다.')}</p><button class="btn primary" data-p44-start="culture">${survivalCopy('Bắt đầu', '시작하기')}</button></section>`;
    const feedback = runtime.feedback; const questions = CultureDecisionGameService.questions(session.level); const choices = ko && question.choicesKo ? question.choicesKo : question.choices;
    return `${heading('immersive-world', `${session.index + 1}/${questions.length} · ${question.level}`, ko ? question.situationKo : question.situation, ko ? question.questionKo : question.question)}<section class="p44-decision-stage section"><div class="p44-choice-list">${choices.map((choice, index) => `<button type="button" data-p44-culture-choice="${index}" ${feedback ? 'disabled' : ''}>${esc(choice)}</button>`).join('')}</div>${feedback ? `<div class="p44-feedback ${feedback.correct ? 'good' : 'needs-work'}"><b>${feedback.correct ? survivalCopy('Phù hợp văn hóa', '문화적으로 적절해요') : survivalCopy('Nên chọn cách khác', '다른 방법을 생각해 보세요')}</b><p>${esc(ko ? question.explanationKo : feedback.explanation)}</p>${session.completed ? `<button class="btn primary" data-view="immersive-readiness">${survivalCopy('Xem kết quả', '결과 보기')}</button>` : `<button class="btn primary" data-p44-culture-next>${survivalCopy('Tiếp tục', '계속하기')}</button>`}</div>` : ''}</section>`;
  }
  function readinessView() { if (!runtime.content) return loadingView(); const value = RealWorldReadinessService.calculate(); const labels = { city: 'Thành phố', roleplay: 'Nhập vai', dailyLife: 'Một ngày ở Hàn', story: 'Truyện tương tác', culture: 'Ứng xử văn hóa', survival: 'Korean only' }; return `${heading('immersive-world', 'REAL-WORLD READINESS', `${value.score}/100 · ${value.band.label}`, 'Đo bằng tình huống đã hoàn thành và quyết định trong app.')}<section class="p44-readiness-hero section"><div class="p44-score"><strong>${value.score}</strong><span>/100</span></div><div><h2>${esc(value.band.label)}</h2><p>${esc(value.disclaimer)}</p></div></section><section class="p44-readiness-grid section">${Object.entries(value.breakdown).map(([key, item]) => `<article><div><b>${esc(labels[key])}</b><span>${item.score}% · trọng số ${item.weight}%</span></div><i><em style="width:${item.score}%"></em></i><strong>+${item.points}</strong></article>`).join('')}</section><section class="p44-evidence section"><h2>Bằng chứng tiến độ</h2><p>Thành phố: <b>${value.evidence.cityCompleted}/${value.evidence.cityTotal}</b></p><p>Roleplay: <b>${value.evidence.roleplayCompleted}/${value.evidence.roleplayTotal}</b></p><p>Daily / Story / Culture: <b>${value.evidence.dailyRuns} / ${value.evidence.storyRuns} / ${value.evidence.cultureRuns}</b></p></section>`; }

  function cityCatalogView() {
    if (!runtime.content) return loadingView(); const places = VirtualKoreanCityService.progress(); const completed = places.filter((item) => item.completed).length;
    return `${heading('immersive-world', 'VIRTUAL KOREAN CITY', survivalCopy('Thành phố tiếng Hàn', '한국어 도시'), survivalCopy('Bốn địa điểm cốt lõi, mỗi nơi là một nhiệm vụ giao tiếp thực tế.', '네 곳에서 실제 한국어 미션을 수행하세요.'))}<section class="p58-map-summary section"><strong>${percent(completed, places.length)}%</strong><div><h2>${survivalCopy(`${completed}/${places.length} địa điểm đã hoàn thành`, `${completed}/${places.length} 장소 완료`)}</h2><i><em style="width:${percent(completed, places.length)}%"></em></i><p>${survivalCopy('Airport · Cafe · University · Office', '공항 · 카페 · 대학교 · 회사')}</p></div></section><section class="p44-city-grid section">${places.map((place) => `<button type="button" data-p44-place="${place.id}" class="${place.completed ? 'completed' : ''}"><span>${place.icon}</span><b>${esc(place.title)}</b><small lang="ko">${esc(place.korean)}</small><em>${place.completed ? survivalCopy('✓ Hoàn thành', '✓ 완료') : survivalCopy('Mở nhiệm vụ', '미션 시작')}</em></button>`).join('')}</section>`;
  }

  function scenarioLibraryView() {
    if (!runtime.content) return loadingView(); const role = ScenarioLibraryService.role(); const scenarios = ScenarioLibraryService.filtered(); const roleLabels = { all: 'Tất cả vai', student: 'Student', worker: 'Worker', traveler: 'Traveler' };
    return `${heading('immersive-world', 'SCENARIO LIBRARY', 'Thư viện tình huống', 'Nội dung nằm trong catalog đã duyệt và có thể mở rộng mà không hardcode trong component.')}<section class="p58-library-tools section"><div class="p58-role-tabs" role="group" aria-label="Lọc theo vai">${ScenarioLibraryService.roles().map((item) => `<button type="button" data-p58-role="${item}" class="${role === item ? 'active' : ''}" aria-pressed="${role === item}">${roleLabels[item]}</button>`).join('')}</div><span>${scenarios.length} tình huống · ${ImmersiveLevelService.current().label}</span></section><section class="p58-scenario-grid section">${scenarios.length ? scenarios.map((item) => { const progress = ScenarioLibraryService.progress(item); return `<article class="${progress.completed ? 'completed' : ''}"><header><span>${item.role === 'student' ? '學' : item.role === 'worker' ? '職' : '旅'}</span><div><small>${esc(item.level)} · ${esc(item.role)}</small><h2>${esc(item.title)}</h2><p lang="ko">${esc(item.titleKo)}</p></div></header><p>${esc(item.objective)}</p><div class="p58-tags">${list(item.skillTags).map((tag) => `<span>${esc(tag)}</span>`).join('')}</div><footer><span>${progress.completed ? `✓ ${progress.score}/100` : 'Chưa thực hiện'}</span><button class="btn primary" data-p58-scenario="${esc(item.id)}">${progress.completed ? 'Luyện lại' : 'Bắt đầu'}</button></footer></article>`; }).join('') : '<div class="p58-empty"><b>Chưa có tình huống phù hợp</b><p>Chọn vai khác hoặc nâng cấp độ để xem thêm nhiệm vụ.</p></div>'}</section>`;
  }

  function progressMapView() {
    if (!runtime.content) return loadingView(); const summary = ImmersiveProgressMapService.summary();
    return `${heading('immersive-world', 'PROGRESS MAP', 'Hành trình sống bằng tiếng Hàn', 'Theo dõi năng lực của chính bạn từ Beginner đến Advanced; không so sánh với người khác.')}<section class="p58-map-summary section"><strong>${summary.percentage}%</strong><div><h2>${summary.completed}/${summary.total} nhiệm vụ đã hoàn thành</h2><i><em style="width:${summary.percentage}%"></em></i><p>${summary.nextMission ? `Tiếp theo: ${esc(summary.nextMission.title)}` : 'Bạn đã đi hết catalog hiện tại.'}</p></div></section><section class="p58-progress-map section">${summary.nodes.map((node, index) => `<article class="${node.status}"><div class="p58-map-marker"><span>${index + 1}</span></div><div><small>${node.status === 'completed' ? 'ĐÃ ĐI QUA' : node.status === 'current' ? 'ĐANG HỌC' : 'CHẶNG TIẾP THEO'}</small><h2>${esc(node.label)}</h2><p>${esc(node.description)}</p><i><em style="width:${node.percentage}%"></em></i><span>${node.completed}/${node.total} nhiệm vụ</span></div></article>`).join('')}</section>${summary.nextMission ? `<section class="p58-map-action section"><div><b>${esc(summary.nextMission.title)}</b><span lang="ko">${esc(summary.nextMission.titleKo)}</span></div><button class="btn primary" data-p58-scenario="${esc(summary.nextMission.id)}">Tiếp tục hành trình</button></section>` : ''}`;
  }

  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'virtual-korean-city': cityCatalogView, 'immersive-daily-life': dailyView, 'immersive-story': storyView, 'immersive-culture-game': cultureView, 'immersive-readiness': readinessView, 'immersive-scenarios': scenarioLibraryView, 'immersive-progress-map': progressMapView };
  const bind = () => {
    if (!global.document || !state.currentUser) return;
    global.document.documentElement?.toggleAttribute?.('data-immersive-survival', LanguageSurvivalModeService.enabled());
    if (state.currentView === 'immersive-world' && runtime.content && !global.document.querySelector('[data-p44-world-panel]')) global.document.querySelector('.world-hero')?.insertAdjacentHTML('afterend', hubPanel());
    global.document.querySelectorAll('[data-p44-level]').forEach((button) => { button.onclick = () => { ImmersiveLevelService.set(button.dataset.p44Level); runtime.daily = null; runtime.story = null; runtime.culture = null; render(); }; });
    global.document.querySelectorAll('[data-p44-place]').forEach((button) => { button.onclick = () => VirtualKoreanCityService.open(button.dataset.p44Place); });
    global.document.querySelectorAll('[data-p44-start]').forEach((button) => { button.onclick = () => ({ daily: DailyLifeSimulationService, story: InteractiveKoreanStoryService, culture: CultureDecisionGameService })[button.dataset.p44Start]?.start?.(); });
    global.document.querySelector('[data-p44-survival]')?.addEventListener('click', () => { LanguageSurvivalModeService.set(!LanguageSurvivalModeService.enabled()); render(); });
    global.document.querySelectorAll('[data-p44-daily-choice]').forEach((button) => { button.onclick = () => { DailyLifeSimulationService.choose(button.dataset.p44DailyChoice); render(); }; });
    global.document.querySelector('[data-p44-daily-next]')?.addEventListener('click', () => { DailyLifeSimulationService.next(); render(); });
    global.document.querySelectorAll('[data-p44-story-choice]').forEach((button) => { button.onclick = () => { InteractiveKoreanStoryService.choose(button.dataset.p44StoryChoice); render(); }; });
    global.document.querySelectorAll('[data-p44-culture-choice]').forEach((button) => { button.onclick = () => { CultureDecisionGameService.answer(Number(button.dataset.p44CultureChoice)); render(); }; });
    global.document.querySelector('[data-p44-culture-next]')?.addEventListener('click', () => { CultureDecisionGameService.next(); render(); });
    global.document.querySelectorAll('[data-p58-role]').forEach((button) => { button.onclick = () => { ScenarioLibraryService.setRole(button.dataset.p58Role); render(); }; });
    global.document.querySelectorAll('[data-p58-scenario]').forEach((button) => { button.onclick = () => ScenarioLibraryService.start(button.dataset.p58Scenario); });
  };
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); bind(); };
  Object.assign(global, { ImmersiveKoreanWorldContentService, ImmersiveLevelService, VirtualKoreanCityService, ImmersiveKoreanWorldProgressService, ScenarioLibraryService, ImmersiveMissionService, ImmersiveProgressMapService, DailyLifeSimulationService, InteractiveKoreanStoryService, CultureDecisionGameService, LanguageSurvivalModeService, RealWorldReadinessService });
  global.ImmersiveKoreanWorld = { content: ImmersiveKoreanWorldContentService, level: ImmersiveLevelService, city: VirtualKoreanCityService, scenarios: ScenarioLibraryService, missions: ImmersiveMissionService, progressMap: ImmersiveProgressMapService, dailyLife: DailyLifeSimulationService, story: InteractiveKoreanStoryService, culture: CultureDecisionGameService, survival: LanguageSurvivalModeService, readiness: RealWorldReadinessService, version: 'p58-v2' };
  ImmersiveKoreanWorldContentService.load().finally(bind);
})(window);
