/* P72A — evidence-backed engagement without replacing learning quality. */
(function buildEngagementCore(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { storage, state, STORAGE_KEYS, userScoped, saveUserScoped, getUserProgress, getUserSrs, PracticeService, CloudSyncService, setView, render, toast, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.engagement || 'klearn_engagement_core';
  const CORE_TOKEN = Symbol('verified-learning-event');
  const DAY = 86400000;
  const DEFAULT_RULES = Object.freeze({ lesson_completed: [10, 1], vocabulary_practice: [8, 3], srs_review: [2, 2], listening_practice: [12, 3], speaking_practice: [15, 3], writing_practice: [15, 3], grammar_practice: [10, 3], topik_practice: [20, 3], quick_practice: [6, 3], mission_completed: [20, 1], challenge_completed: [40, 1], quest_completed: [10, 1] });
  const EVENT_PATTERNS = Object.freeze({ lesson_completed: /^completed_lesson:/, vocabulary_practice: /^practice_completed:/, srs_review: /^srs_updated:/, listening_practice: /^(listening_completed:|practice_completed:)/, speaking_practice: /^(speaking_completed:|practice_completed:)/, writing_practice: /^(writing_completed:|practice_completed:)/, grammar_practice: /^practice_completed:/, topik_practice: /^(topik_completed:|practice_completed:)/, quick_practice: /^practice_completed:/, mission_completed: /^mission:/, challenge_completed: /^challenge:/, quest_completed: /^quest-xp:/ });
  const SKILLS = ['vocabulary', 'grammar', 'listening', 'reading', 'speaking', 'writing'];
  const skillLabels = { vocabulary: 'Từ vựng', grammar: 'Ngữ pháp', listening: 'Nghe', reading: 'Đọc', speaking: 'Nói', writing: 'Viết' };
  const runtime = state.engagementCore || (state.engagementCore = { content: null, loading: null, error: '', quickMinutes: 5 });
  const now = () => new Date().toISOString();
  const clean = (value, limit = 180) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
  const dateKey = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
  const shiftDate = (value, offset) => new Date(new Date(`${dateKey(value)}T12:00:00.000Z`).getTime() + offset * DAY);
  const currentUserId = () => state.currentUser?.id || '';
  const defaultStore = () => ({ schemaVersion: 1, xpEvents: [], quests: [], questClaims: [], protections: [], wallet: { streakFreezes: 0, badges: [], cosmetics: [] }, updatedAt: null });
  function readStore() {
    const saved = userScoped(STORE_KEY)[0]; const value = saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    return { ...defaultStore(), ...value, xpEvents: Array.isArray(value.xpEvents) ? value.xpEvents : [], quests: Array.isArray(value.quests) ? value.quests : [], questClaims: Array.isArray(value.questClaims) ? value.questClaims : [], protections: Array.isArray(value.protections) ? value.protections : [], wallet: { ...defaultStore().wallet, ...(value.wallet || {}) } };
  }
  function writeStore(value, reason = 'engagement-core') { const next = { ...defaultStore(), ...value, schemaVersion: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); CloudSyncService?.schedule?.(reason); return next; }
  function ruleFor(activityType) {
    const configured = runtime.content?.xpPolicy?.rules?.[activityType];
    return configured ? { xp: Number(configured.xp), referenceDailyLimit: Number(configured.referenceDailyLimit) } : DEFAULT_RULES[activityType] ? { xp: DEFAULT_RULES[activityType][0], referenceDailyLimit: DEFAULT_RULES[activityType][1] } : null;
  }
  function allQuestions() { const sets = PracticeService?.bank?.sets || []; return sets.flatMap((set) => PracticeService.bank.getQuestions(set.id)).filter((item, index, values) => item?.id && values.findIndex((candidate) => candidate.id === item.id) === index); }
  function attemptById(id) { return (PracticeService?.getHistory?.() || []).find((item) => item.id === id) || null; }
  function practiceActivity(attempt) {
    if (!attempt) return null;
    if (attempt.examMode || /^t[1-6]-/i.test(attempt.setId || '') || /TOPIK/i.test(`${attempt.level || ''} ${attempt.setTitle || ''}`) && !/quick/i.test(attempt.setId || '')) return 'topik_practice';
    if (/quick|daily-quick|engagement-quick/i.test(`${attempt.setId || ''} ${attempt.setTitle || ''}`)) return 'quick_practice';
    const skills = Object.keys(attempt.skillBreakdown || {}); const skill = skills.length === 1 ? skills[0] : attempt.skill;
    return ({ vocabulary: 'vocabulary_practice', grammar: 'grammar_practice', listening: 'listening_practice', speaking: 'speaking_practice', writing: 'writing_practice' })[skill] || 'vocabulary_practice';
  }
  function verifyPublicEvidence(input) {
    const id = clean(input.referenceId || input.entityId); const progress = getUserProgress?.() || {};
    if (input.activityType === 'lesson_completed') return Boolean(progress.lessonProgress?.[id]?.completed);
    if (input.activityType === 'srs_review') return Boolean((getUserSrs?.() || state.srsData || []).find((item) => (item.wordId || item.id) === id && Number(item.reviewCount || 0) > 0));
    if (input.activityType === 'speaking_practice') return Boolean((progress.pronunciationAttempts || []).find((item) => item.id === id));
    if (input.activityType === 'writing_practice') return Boolean((progress.writingSubmissions || []).find((item) => item.id === id));
    if (['vocabulary_practice', 'grammar_practice', 'listening_practice', 'topik_practice', 'quick_practice'].includes(input.activityType)) return Boolean(attemptById(id));
    return false;
  }

  const EngagementContentService = {
    hydrate(value) { if (!value || value.schemaVersion !== 1 || value.status !== 'approved' || value.verified !== true || !value.xpPolicy?.rules || !value.scoreModel || !Array.isArray(value.practiceCenter)) throw new Error('P72A engagement content gate failed'); runtime.content = Object.freeze(value); runtime.error = ''; return value; },
    load() { if (runtime.content) return Promise.resolve(runtime.content); if (runtime.loading) return runtime.loading; if (typeof global.fetch !== 'function') return Promise.resolve(null); runtime.loading = global.fetch('./content/engagement-core.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Engagement content ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message); return null; }).finally(() => { runtime.loading = null; if (['engagement-center', 'practice-center', 'engagement-practice', 'home'].includes(state.currentView)) render(); }); return runtime.loading; },
    get: () => runtime.content
  };

  const LearningXPService = {
    events() { return readStore().xpEvents; },
    total() { return this.events().reduce((sum, item) => sum + Number(item.xp || 0), 0); },
    today() { const key = dateKey(); return this.events().filter((item) => String(item.created_at).slice(0, 10) === key).reduce((sum, item) => sum + Number(item.xp || 0), 0); },
    pending() { return this.events().filter((item) => item.sync_status !== 'synced'); },
    record(input = {}, token = null) {
      if (!currentUserId()) return { status: 'rejected', reason: 'signed-in-user-required', awarded: 0 };
      const activityType = clean(input.activityType, 50); const eventId = clean(input.eventId, 220); const referenceId = clean(input.referenceId || input.entityId, 160); const rule = ruleFor(activityType);
      if (!rule || !eventId || !referenceId || !EVENT_PATTERNS[activityType]?.test(eventId)) return { status: 'rejected', reason: 'invalid-event', awarded: 0 };
      if (token !== CORE_TOKEN && !verifyPublicEvidence({ ...input, activityType, referenceId })) return { status: 'rejected', reason: 'learning-evidence-required', awarded: 0 };
      const store = readStore(); const duplicate = store.xpEvents.find((item) => item.event_id === eventId);
      if (duplicate) return { status: 'duplicate', event: duplicate, awarded: 0 };
      const trustedCreatedAt = token === CORE_TOKEN && input.createdAt && Number.isFinite(new Date(input.createdAt).getTime()) ? new Date(input.createdAt).toISOString() : now(); const createdAt = trustedCreatedAt; const dayKey = createdAt.slice(0, 10); const todayEvents = store.xpEvents.filter((item) => String(item.created_at).slice(0, 10) === dayKey); const dailyCap = Number(runtime.content?.xpPolicy?.dailyCap || 300); const todayXp = todayEvents.reduce((sum, item) => sum + Number(item.xp || 0), 0);
      if (todayXp >= dailyCap) return { status: 'rejected', reason: 'daily-cap', awarded: 0 };
      const sameReference = todayEvents.filter((item) => item.activity_type === activityType && item.reference_id === referenceId);
      const lifetimeOnce = ['lesson_completed', 'mission_completed', 'challenge_completed', 'quest_completed'].includes(activityType) && store.xpEvents.some((item) => item.activity_type === activityType && item.reference_id === referenceId);
      if (lifetimeOnce || sameReference.length >= rule.referenceDailyLimit) return { status: 'rejected', reason: 'repetition-limit', awarded: 0 };
      const factor = sameReference.length === 0 ? 1 : sameReference.length === 1 ? .5 : .25; const xp = Math.max(1, Math.min(rule.xp, Math.round(rule.xp * factor), dailyCap - todayXp));
      const event = { event_id: eventId, user_id: currentUserId(), activity_type: activityType, reference_id: referenceId, xp, base_xp: rule.xp, created_at: createdAt, sync_status: 'pending', anti_gaming: sameReference.length ? 'diminished-repeat' : 'verified' };
      writeStore({ ...store, xpEvents: [event, ...store.xpEvents].slice(0, 1500) }, 'engagement-xp');
      QuestEngine.refresh(); if (global.navigator?.onLine !== false) global.setTimeout?.(() => this.syncPending(), 0);
      return { status: 'awarded', event, awarded: xp };
    },
    async syncPending() {
      if (global.navigator?.onLine === false) return { status: 'offline', synced: 0 }; const client = global.SupabaseService?.client; if (!client?.rpc) return { status: 'local-only', synced: 0 };
      let store = readStore(); let synced = 0;
      const syncEvents = async (events) => { for (const event of events) {
        const { data, error } = await client.rpc('record_learning_xp', { p_event_id: event.event_id, p_activity_type: event.activity_type, p_reference_id: event.reference_id });
        if (!error) { const canonicalXp = Number(data); if (Number.isFinite(canonicalXp)) event.xp = canonicalXp; event.sync_status = 'synced'; event.server_xp = Number.isFinite(canonicalXp) ? canonicalXp : event.xp; synced += 1; }
      } };
      const pendingEvents = store.xpEvents.filter((item) => item.sync_status !== 'synced').slice(0, 100); await syncEvents(pendingEvents.filter((item) => item.activity_type !== 'quest_completed'));
      for (const claim of store.questClaims.filter((item) => item.sync_status !== 'synced').slice(0, 50)) { const { error } = await client.rpc('record_engagement_quest_claim', { p_quest_id: claim.quest_id, p_quest_type: claim.quest_type, p_period_key: claim.period_key, p_reward_type: claim.reward_type, p_reward_amount: claim.reward_amount }); if (!error) { claim.sync_status = 'synced'; synced += 1; } }
      await syncEvents(pendingEvents.filter((item) => item.activity_type === 'quest_completed'));
      for (const item of store.protections.filter((entry) => entry.sync_status !== 'synced').slice(0, 20)) { const { error } = await client.rpc('record_streak_protection', { p_event_id: item.event_id, p_protected_date: item.protected_date, p_protection_type: item.protection_type, p_source_quest_id: item.source_quest_id || null }); if (!error) { item.sync_status = 'synced'; synced += 1; } }
      if (synced) store = writeStore(store, 'engagement-sync'); return { status: 'synced', synced };
    }
  };

  const TamHoanqScoreService = {
    evidence() {
      const progress = getUserProgress?.() || {}; const samples = Object.fromEntries(SKILLS.map((skill) => [skill, []]));
      (getUserSrs?.() || state.srsData || []).filter((card) => Number(card.reviewCount || 0) > 0).slice(0, 200).forEach((card) => { const attempts = Number(card.correctCount || 0) + Number(card.wrongCount || 0); samples.vocabulary.push(attempts ? Number(card.correctCount || 0) / attempts * 100 : Number(card.mastery || 0)); });
      (PracticeService?.getHistory?.() || []).slice(0, 100).forEach((attempt) => Object.entries(attempt.skillBreakdown || {}).forEach(([skill, score]) => { if (samples[skill] && Number.isFinite(Number(score))) samples[skill].push(Number(score)); }));
      (progress.pronunciationAttempts || []).slice(0, 50).forEach((item) => samples.speaking.push(Number(item.score || 0)));
      (progress.writingSubmissions || []).slice(0, 50).forEach((item) => samples.writing.push(Number(item.preliminaryScore ?? item.score ?? 0)));
      return samples;
    },
    calculate() {
      const samples = this.evidence(); const configured = runtime.content?.scoreModel || {}; const weights = configured.weights || { vocabulary: .2, grammar: .2, listening: .18, reading: .18, speaking: .12, writing: .12 };
      const breakdown = Object.fromEntries(SKILLS.map((skill) => { const values = samples[skill].filter(Number.isFinite); return [skill, { skill, score: values.length ? clamp(values.reduce((sum, value) => sum + value, 0) / values.length) : null, sampleSize: values.length }]; }));
      const measured = SKILLS.filter((skill) => breakdown[skill].score != null); const sampleSize = measured.reduce((sum, skill) => sum + breakdown[skill].sampleSize, 0); const ready = measured.length >= Number(configured.minimumSkills || 4) && sampleSize >= Number(configured.minimumSamples || 6); const usedWeight = measured.reduce((sum, skill) => sum + Number(weights[skill] || 0), 0); const score = ready && usedWeight ? Math.round(measured.reduce((sum, skill) => sum + breakdown[skill].score * Number(weights[skill] || 0), 0) / usedWeight) : null; const confidence = !ready ? 'insufficient' : sampleSize >= 40 && measured.length === 6 ? 'high' : sampleSize >= 15 ? 'medium' : 'low';
      return { status: ready ? 'measured' : 'insufficient', score, confidence, sampleSize, skillCoverage: measured.length, breakdown, source: 'deterministic-learning-evidence', aiJudgment: false, xpIncluded: false };
    }
  };

  function questPeriods(value = new Date()) {
    const date = new Date(value); const daily = dateKey(date); const weekday = (date.getUTCDay() + 6) % 7; const monday = shiftDate(date, -weekday); const nextMonday = shiftDate(monday, 7); const month = daily.slice(0, 7); const nextMonth = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));
    return { daily: { key: daily, expires: shiftDate(date, 1).toISOString() }, weekly: { key: dateKey(monday), expires: nextMonday.toISOString() }, monthly: { key: month, expires: nextMonth.toISOString() } };
  }
  function learningActivityDates(events = LearningXPService.events()) { return new Set(events.filter((item) => !['mission_completed', 'challenge_completed', 'quest_completed'].includes(item.activity_type)).map((item) => String(item.created_at).slice(0, 10))); }
  const QuestEngine = {
    definitions(value = new Date()) {
      const periods = questPeriods(value); const store = readStore(); const events = store.xpEvents; const mission = global.DailyMissionService?.getToday?.(); const activeDays = learningActivityDates(events); const weekDays = [...activeDays].filter((date) => date >= periods.weekly.key && date < periods.weekly.expires.slice(0, 10)).length; const monthEvents = events.filter((item) => String(item.created_at).startsWith(periods.monthly.key) && !['srs_review', 'mission_completed', 'challenge_completed', 'quest_completed'].includes(item.activity_type)); const skillTypes = new Set(monthEvents.map((item) => item.activity_type).filter((item) => /vocabulary|grammar|listening|speaking|writing|topik|quick/.test(item))); const dailyTarget = Math.max(1, mission?.priorities?.length || 1); const dailyProgress = mission?.completed ? dailyTarget : Math.min(dailyTarget, mission?.completedItems?.filter((id) => id !== 'mission').length || events.filter((item) => String(item.created_at).startsWith(periods.daily.key) && !/quest|mission|challenge/.test(item.activity_type)).length);
      return [
        { id: `daily-${periods.daily.key}`, type: 'daily', objective: mission ? 'Hoàn thành Daily Mission hiện có' : 'Hoàn thành một hoạt động học', progress: dailyProgress, target: dailyTarget, reward: { type: 'xp', amount: 10 }, period_key: periods.daily.key, expires_at: periods.daily.expires },
        { id: `weekly-${periods.weekly.key}`, type: 'weekly', objective: 'Học 5 ngày trong tuần', progress: Math.min(5, weekDays), target: 5, reward: { type: 'streak_freeze', amount: 1 }, period_key: periods.weekly.key, expires_at: periods.weekly.expires },
        { id: `monthly-${periods.monthly.key}`, type: 'monthly', objective: 'Hoàn thành 20 learning sessions', progress: Math.min(20, monthEvents.length), target: 20, reward: { type: 'badge', amount: 1, id: `consistent-${periods.monthly.key}` }, period_key: periods.monthly.key, expires_at: periods.monthly.expires },
        { id: `special-${periods.monthly.key}`, type: 'special', objective: 'Luyện 5 nhóm kỹ năng khác nhau', progress: Math.min(5, skillTypes.size), target: 5, reward: { type: 'xp', amount: 40 }, period_key: periods.monthly.key, expires_at: periods.monthly.expires }
      ];
    },
    refresh(value = new Date()) {
      if (!currentUserId()) return []; const store = readStore(); const timestamp = new Date(value).getTime(); const definitions = this.definitions(value); let changed = false;
      const current = definitions.map((definition) => { const saved = store.quests.find((item) => item.id === definition.id); const claimed = store.questClaims.some((item) => item.quest_id === definition.id); const status = claimed ? 'claimed' : definition.progress >= definition.target ? 'completed' : timestamp >= new Date(definition.expires_at).getTime() ? 'expired' : 'active'; const next = { ...(saved || {}), ...definition, status, claimed_at: saved?.claimed_at || null }; if (!saved || saved.progress !== next.progress || saved.status !== next.status) changed = true; return next; });
      const expired = store.quests.filter((item) => !current.some((candidate) => candidate.id === item.id)).map((item) => item.status === 'claimed' || item.status === 'expired' ? item : { ...item, status: 'expired' }).slice(0, 36); const quests = [...current, ...expired]; if (changed || expired.some((item, index) => item.status !== store.quests.find((old) => old.id === item.id)?.status) || !store.quests.length) writeStore({ ...store, quests }, 'engagement-quests'); return quests;
    },
    current(value = new Date()) { const ids = new Set(this.definitions(value).map((item) => item.id)); return this.refresh(value).filter((item) => ids.has(item.id)); },
    claim(questId, value = new Date()) {
      const quest = this.current(value).find((item) => item.id === questId); const store = readStore(); if (!quest || quest.status !== 'completed' || store.questClaims.some((item) => item.quest_id === questId)) return null;
      const claim = { event_id: `quest-claim:${quest.id}`, quest_id: quest.id, quest_type: quest.type, period_key: quest.period_key, reward_type: quest.reward.type, reward_amount: Number(quest.reward.amount || 1), claimed_at: now(), sync_status: 'pending' }; const wallet = { ...store.wallet, badges: [...(store.wallet.badges || [])], cosmetics: [...(store.wallet.cosmetics || [])] };
      if (quest.reward.type === 'streak_freeze') wallet.streakFreezes = Math.min(3, Number(wallet.streakFreezes || 0) + claim.reward_amount);
      if (quest.reward.type === 'badge' && !wallet.badges.includes(quest.reward.id)) wallet.badges.push(quest.reward.id);
      if (quest.reward.type === 'cosmetic' && !wallet.cosmetics.includes(quest.reward.id)) wallet.cosmetics.push(quest.reward.id);
      const updatedQuests = store.quests.map((item) => item.id === quest.id ? { ...item, status: 'claimed', claimed_at: claim.claimed_at } : item); writeStore({ ...store, wallet, quests: updatedQuests, questClaims: [claim, ...store.questClaims].slice(0, 200) }, 'engagement-quest-claim');
      if (quest.reward.type === 'xp') LearningXPService.record({ activityType: 'quest_completed', eventId: `quest-xp:${quest.id}`, referenceId: quest.id }, CORE_TOKEN);
      return claim;
    }
  };

  const StreakProtectionService = {
    protections() { return readStore().protections; },
    wallet() { return readStore().wallet; },
    effectiveStreak(value = new Date()) { const active = learningActivityDates(); const protectedDays = new Set(this.protections().map((item) => item.protected_date)); let cursor = dateKey(value); if (!active.has(cursor) && !protectedDays.has(cursor)) cursor = dateKey(shiftDate(value, -1)); let count = 0; while ((active.has(cursor) || protectedDays.has(cursor)) && count < 366) { count += 1; cursor = dateKey(shiftDate(cursor, -1)); } return count; },
    eligibleGap(value = new Date()) { const active = learningActivityDates(); const missed = dateKey(shiftDate(value, -1)); const before = dateKey(shiftDate(value, -2)); return active.has(before) && !active.has(missed) && !this.protections().some((item) => item.protected_date === missed) ? missed : null; },
    useFreeze(value = new Date()) { const store = readStore(); const missed = this.eligibleGap(value); if (!missed || Number(store.wallet.streakFreezes || 0) < 1) return null; const item = { event_id: `streak-freeze:${missed}`, protected_date: missed, protection_type: 'freeze', source_quest_id: null, created_at: now(), sync_status: 'pending' }; return this.saveProtection(store, item, { ...store.wallet, streakFreezes: Number(store.wallet.streakFreezes) - 1 }); },
    repair(value = new Date()) { const store = readStore(); const missed = this.eligibleGap(value); const active = learningActivityDates(); const referenceTime = new Date(value).getTime(); const recentRepair = store.protections.some((item) => item.protection_type === 'repair' && referenceTime - new Date(item.created_at).getTime() < 30 * DAY); if (!missed || !active.has(dateKey(value)) || recentRepair) return null; const item = { event_id: `streak-repair:${missed}`, protected_date: missed, protection_type: 'repair', source_quest_id: `repair-task:${dateKey(value)}`, created_at: new Date(value).toISOString(), sync_status: 'pending' }; return this.saveProtection(store, item, store.wallet); },
    saveProtection(store, item, wallet) { if (store.protections.some((entry) => entry.event_id === item.event_id || entry.protected_date === item.protected_date)) return null; writeStore({ ...store, wallet, protections: [item, ...store.protections].slice(0, 100) }, `engagement-streak-${item.protection_type}`); if (global.navigator?.onLine !== false) global.setTimeout?.(() => LearningXPService.syncPending(), 0); return item; }
  };

  const EngagementQuickPracticeService = {
    plan(minutes = 5) {
      const duration = [5, 10, 15].includes(Number(minutes)) ? Number(minutes) : 5; const count = duration; const all = allQuestions(); const chosen = []; const add = (items) => items.forEach((item) => { if (item && !chosen.some((candidate) => candidate.id === item.id) && chosen.length < count) chosen.push(item); });
      const due = app.VocabularyService?.dueCards?.() || []; add(due.flatMap((card) => all.filter((question) => `${question.prompt || ''} ${question.koreanText || ''} ${(question.options || []).join(' ')}`.includes(card.korean || '__none__'))));
      const wrongIds = new Set((PracticeService?.getHistory?.() || []).flatMap((attempt) => attempt.wrongQuestionIds || [])); add(all.filter((question) => wrongIds.has(question.id)));
      const priorities = global.AdaptiveLearningEngine?.priorities?.() || []; const weakSkills = priorities.map((item) => item.id); weakSkills.forEach((skill) => add(all.filter((question) => question.skill === skill)));
      const level = `TOPIK_${state.currentUser?.currentTopikLevel || 1}`; add(all.filter((question) => !question.level || question.level === level)); add(all);
      return { minutes: duration, questions: chosen, sources: { srs: due.length, mistakes: wrongIds.size, adaptiveSkills: weakSkills.slice(0, 3), goal: global.GoalTrackingService?.getGoal?.()?.goalType || state.currentUser?.learningMode || 'casual' }, continuous: true, engine: 'existing-practice-service' };
    },
    start(minutes = runtime.quickMinutes) { const plan = this.plan(minutes); if (!plan.questions.length) return false; runtime.quickMinutes = plan.minutes; return PracticeService?.startQuestions?.(plan.questions, `Quick Practice · ${plan.minutes} phút`, 'engagement-quick'); }
  };

  function handleLearningMutation(event) {
    const detail = event?.detail || {}; const entityId = clean(detail.entityId); const eventId = clean(detail.mutationId || detail.id); if (!entityId || !eventId) return;
    if (detail.type === 'completed_lesson' && verifyPublicEvidence({ activityType: 'lesson_completed', referenceId: entityId })) LearningXPService.record({ activityType: 'lesson_completed', eventId, referenceId: entityId }, CORE_TOKEN);
    else if (detail.type === 'srs_updated' && detail.rating && verifyPublicEvidence({ activityType: 'srs_review', referenceId: entityId })) LearningXPService.record({ activityType: 'srs_review', eventId, referenceId: entityId }, CORE_TOKEN);
    else if (detail.type === 'practice_completed') { const attempt = attemptById(entityId); const activityType = practiceActivity(attempt); if (attempt && activityType) LearningXPService.record({ activityType, eventId, referenceId: attempt.setId || entityId }, CORE_TOKEN); }
    else if (detail.type === 'speaking_completed' && verifyPublicEvidence({ activityType: 'speaking_practice', referenceId: entityId })) LearningXPService.record({ activityType: 'speaking_practice', eventId, referenceId: entityId }, CORE_TOKEN);
    else if (detail.type === 'writing_completed' && verifyPublicEvidence({ activityType: 'writing_practice', referenceId: entityId })) LearningXPService.record({ activityType: 'writing_practice', eventId, referenceId: entityId }, CORE_TOKEN);
    else if (detail.type === 'listening_completed') { const session = storage?.get?.(STORAGE_KEYS.listeningSessions, {})?.[currentUserId()] || {}; const evidenceId = clean(detail.evidenceId); const directEvidence = [session.dictationResult, session.quizAnswer].some((item) => item?.id === evidenceId); const attempt = attemptById(entityId); if (directEvidence || attempt) LearningXPService.record({ activityType: 'listening_practice', eventId, referenceId: entityId }, CORE_TOKEN); }
    else if (detail.type === 'topik_completed' && attemptById(entityId)) LearningXPService.record({ activityType: 'topik_practice', eventId, referenceId: entityId }, CORE_TOKEN);
  }

  function patchIntegrations() {
    const mission = global.DailyMissionService; if (mission?.complete && !mission.__p72aPatched) { const original = mission.complete.bind(mission); mission.complete = (...args) => { const before = mission.getToday?.(); const wasCompleted = Boolean(before?.completed); const result = original(...args); if (!wasCompleted && result?.completed) LearningXPService.record({ activityType: 'mission_completed', eventId: `mission:${result.id}`, referenceId: result.id }, CORE_TOKEN); QuestEngine.refresh(); return result; }; Object.defineProperty(mission, '__p72aPatched', { value: true }); }
    const patchChallenge = (service, label, currentMethod = 'current') => { if (!service?.checkIn || service.__p72aPatched) return; const original = service.checkIn.bind(service); service.checkIn = (...args) => { const result = original(...args); const current = service[currentMethod]?.(args[0]) || result; const complete = Boolean(current?.completedAt || Number(current?.progress || current?.days?.length || 0) >= Number(current?.target || current?.durationDays || Infinity)); if (complete) { const reference = clean(current.id || current.month || current.challengeId || label); LearningXPService.record({ activityType: 'challenge_completed', eventId: `challenge:${label}:${reference}`, referenceId: `${label}:${reference}` }, CORE_TOKEN); } return result; }; Object.defineProperty(service, '__p72aPatched', { value: true }); };
    patchChallenge(global.MonthlyChallengeService, 'monthly'); patchChallenge(global.ChallengeEventService, 'community');
  }

  const heading = (back, eyebrow, title, description) => `<section class="section page-heading p72-heading"><button class="back-link" data-view="${back}" aria-label="Quay lại">←</button><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1 class="headline">${escapeHtml(title)}</h1><p class="subtle">${escapeHtml(description)}</p></section>`;
  const rewardLabel = (reward) => reward.type === 'xp' ? `+${reward.amount} XP` : reward.type === 'streak_freeze' ? `${reward.amount} Streak Freeze` : reward.type === 'badge' ? 'Huy hiệu' : 'Cosmetic';
  function loadingView() { EngagementContentService.load(); return `${heading('home', 'P72A', 'Đang tải Engagement Core…', 'Learning quality luôn độc lập với XP.')}<section class="section p72-loading"></section>`; }
  function engagementView() {
    if (!runtime.content) return loadingView(); const xp = LearningXPService.total(); const todayXp = LearningXPService.today(); const score = TamHoanqScoreService.calculate(); const quests = QuestEngine.current(); const store = readStore(); const streak = StreakProtectionService.effectiveStreak(); const gap = StreakProtectionService.eligibleGap();
    return `${heading('home', 'ENGAGEMENT CORE', 'Hôm nay bạn đã tiến thêm một bước', 'XP tạo nhịp quay lại; năng lực vẫn được đo riêng bằng learning evidence.')}<section class="section p72-summary"><article class="p72-xp"><small>LEARNING XP · ENGAGEMENT</small><strong>${xp} XP</strong><span>Hôm nay +${todayXp} · ${LearningXPService.pending().length} event chờ đồng bộ</span><p>XP không phải Mastery, proficiency hay điểm TOPIK.</p></article><article class="p72-score"><small>TAMHOANQ KOREAN SCORE · ABILITY</small><strong>${score.score == null ? 'Chưa đủ dữ liệu' : score.score}</strong><span>Confidence: ${score.confidence} · ${score.sampleSize} mẫu · ${score.skillCoverage}/6 kỹ năng</span><p>Không dùng XP và không để AI tự quyết định điểm.</p></article><article class="p72-streak"><small>STREAK PROTECTION</small><strong>🔥 ${streak} ngày</strong><span>${store.wallet.streakFreezes} Freeze · ${store.protections.length} ngày đã bảo vệ</span><div>${gap ? `<button class="btn secondary" data-p72-freeze ${store.wallet.streakFreezes ? '' : 'disabled'}>Dùng Freeze</button><button class="btn secondary" data-p72-repair>Repair bằng phiên học hôm nay</button>` : '<p>Streak hiện không có ngày gián đoạn cần xử lý.</p>'}</div></article></section><section class="section p72-score-breakdown"><header><div><p class="eyebrow">LEARNING EVIDENCE</p><h2>Điểm theo kỹ năng</h2></div><span>${score.status === 'measured' ? `Confidence ${score.confidence}` : 'Cần ít nhất 4 kỹ năng / 6 mẫu'}</span></header><div>${SKILLS.map((skill) => { const item = score.breakdown[skill]; return `<article><span>${skillLabels[skill]}</span><b>${item.score == null ? '—' : item.score}</b><small>${item.sampleSize} mẫu</small><i><em style="width:${item.score || 0}%"></em></i></article>`; }).join('')}</div></section><section class="section p72-quests"><header><div><p class="eyebrow">QUEST ENGINE</p><h2>Daily · Weekly · Monthly · Special</h2></div><button class="btn primary" data-view="practice-center">Mở Practice Center</button></header><div>${quests.map((quest) => `<article class="${quest.status}"><span>${({ daily: '日', weekly: '7', monthly: '30', special: '◆' })[quest.type]}</span><div><small>${quest.type.toUpperCase()} QUEST · ${escapeHtml(rewardLabel(quest.reward))}</small><h3>${escapeHtml(quest.objective)}</h3><div class="bar"><i style="width:${Math.min(100, Math.round(quest.progress / quest.target * 100))}%"></i></div><p>${quest.progress}/${quest.target} · hết hạn ${escapeHtml(quest.expires_at.slice(0, 10))}</p></div><button class="btn secondary" data-p72-claim="${quest.id}" ${quest.status !== 'completed' ? 'disabled' : ''}>${quest.status === 'claimed' ? 'Đã nhận' : quest.status === 'expired' ? 'Đã hết hạn' : quest.status === 'completed' ? 'Nhận thưởng' : 'Đang làm'}</button></article>`).join('')}</div></section>`;
  }
  function practiceCenterView() {
    if (!runtime.content) return loadingView(); const priority = global.AdaptiveLearningEngine?.priorities?.()?.[0];
    return `${heading('engagement-center', 'PRACTICE CENTER', 'Một nơi để luyện đúng điều cần thiết', 'Các mục bên dưới mở lại SRS, Error Notebook, Adaptive Engine và practice modules hiện có.')}<section class="section p72-practice-callout"><div><small>GỢI Ý TỪ ADAPTIVE ENGINE</small><h2>${escapeHtml(priority?.title || 'Bắt đầu bằng Quick Practice')}</h2><p>${escapeHtml(priority?.reason || 'Hệ thống sẽ trộn nội dung từ dữ liệu học hiện có.')}</p></div><button class="btn primary" data-view="${escapeHtml(priority?.actionView || 'engagement-practice')}">Bắt đầu</button></section><section class="section p72-practice-grid">${runtime.content.practiceCenter.map((item) => `<button data-view="${escapeHtml(item.route)}"><span>${item.icon}</span><div><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.source)}</small></div><i>→</i></button>`).join('')}</section><section class="section p72-quick"><div><small>QUICK PRACTICE · CONTINUOUS SESSION</small><h2>Chọn thời gian bạn có</h2><p>SRS → lỗi gần đây → kỹ năng yếu → mục tiêu hiện tại.</p></div><div>${[5, 10, 15].map((minutes) => `<button class="${runtime.quickMinutes === minutes ? 'active' : ''}" data-p72-minutes="${minutes}" aria-pressed="${runtime.quickMinutes === minutes}">${minutes} phút</button>`).join('')}</div><button class="btn primary" data-p72-quick-start>Bắt đầu Quick Practice</button></section>`;
  }
  function quickView() { if (!runtime.content) return loadingView(); const plan = EngagementQuickPracticeService.plan(runtime.quickMinutes); return `${heading('practice-center', 'QUICK PRACTICE', `${plan.minutes} phút · ${plan.questions.length} câu`, 'Một phiên liên tục dùng Question Bank hiện có; không tạo learning engine mới.')}<section class="section p72-quick-plan"><article><span>1</span><div><b>SRS đến hạn</b><small>${plan.sources.srs} thẻ làm tín hiệu ưu tiên</small></div></article><article><span>2</span><div><b>Lỗi gần đây</b><small>${plan.sources.mistakes} câu từng sai</small></div></article><article><span>3</span><div><b>Adaptive focus</b><small>${escapeHtml(plan.sources.adaptiveSkills.join(' · ') || 'đang thu thập')}</small></div></article><article><span>4</span><div><b>Mục tiêu hiện tại</b><small>${escapeHtml(plan.sources.goal)}</small></div></article><button class="btn primary" data-p72-quick-start ${plan.questions.length ? '' : 'disabled'}>Bắt đầu phiên ${plan.minutes} phút</button></section>`; }
  function bind() {
    global.document?.querySelectorAll('[data-p72-minutes]').forEach((button) => { button.onclick = () => { runtime.quickMinutes = Number(button.dataset.p72Minutes); render(); }; });
    global.document?.querySelectorAll('[data-p72-quick-start]').forEach((button) => { button.onclick = () => { if (!EngagementQuickPracticeService.start(runtime.quickMinutes)) toast?.('Chưa có câu hỏi phù hợp.'); }; });
    global.document?.querySelectorAll('[data-p72-claim]').forEach((button) => { button.onclick = () => { const claim = QuestEngine.claim(button.dataset.p72Claim); toast?.(claim ? 'Đã nhận phần thưởng có bằng chứng.' : 'Quest chưa đủ điều kiện hoặc đã nhận.'); render(); }; });
    global.document?.querySelector('[data-p72-freeze]')?.addEventListener('click', () => { const item = StreakProtectionService.useFreeze(); toast?.(item ? 'Đã dùng Streak Freeze.' : 'Chưa đủ điều kiện dùng Freeze.'); render(); });
    global.document?.querySelector('[data-p72-repair]')?.addEventListener('click', () => { const item = StreakProtectionService.repair(); toast?.(item ? 'Đã Repair streak bằng hoạt động hôm nay.' : 'Hãy hoàn thành một hoạt động hợp lệ; mỗi 30 ngày chỉ Repair một lần.'); render(); });
  }

  Object.assign(global, { EngagementContentService, LearningXPService, TamHoanqScoreService, QuestEngine, StreakProtectionService, EngagementQuickPracticeService, EngagementCoreSystem: { content: EngagementContentService, xp: LearningXPService, score: TamHoanqScoreService, quests: QuestEngine, streak: StreakProtectionService, practice: EngagementQuickPracticeService, version: 'p72a-v1' } });
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'engagement-center': engagementView, 'practice-center': practiceCenterView, 'engagement-practice': quickView };
  global.addEventListener?.('klearn-sync-action', handleLearningMutation); global.addEventListener?.('online', () => LearningXPService.syncPending());
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => { previousAfterRender?.(); if (!state.currentUser) return; patchIntegrations(); QuestEngine.refresh(); const effective = StreakProtectionService.effectiveStreak(); const streakNode = global.document?.getElementById('streakCount'); if (streakNode && effective) streakNode.textContent = String(effective); const beginner = global.UserExperienceProfileService?.segment?.() === 'beginner' || state.currentUser?.learningTrack === 'foundation'; if (beginner) global.document?.querySelector('[data-p72-home]')?.remove(); if (state.currentView === 'home' && !beginner && runtime.content && !global.document?.querySelector('[data-p72-home]')) { const score = TamHoanqScoreService.calculate(); global.document.querySelector('.ux-today-strip, .daily-start-panel, .dashboard-hero')?.insertAdjacentHTML('afterend', `<section class="p72-home-strip" data-p72-home><button data-view="engagement-center"><small>HÔM NAY +${LearningXPService.today()} XP</small><b>${LearningXPService.total()} Learning XP</b><span>Engagement, không phải năng lực</span></button><button data-view="engagement-center"><small>TAMHOANQ SCORE</small><b>${score.score == null ? 'Chưa đủ dữ liệu' : score.score}</b><span>${score.skillCoverage}/6 kỹ năng · ${score.confidence}</span></button><button data-view="practice-center"><small>PRACTICE CENTER</small><b>Luyện đúng điểm cần thiết</b><span>SRS · lỗi sai · Adaptive</span></button></section>`); global.document.querySelectorAll('[data-p72-home] [data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); }); } bind(); };
  EngagementContentService.load(); patchIntegrations(); if (global.navigator?.onLine !== false) global.setTimeout?.(() => LearningXPService.syncPending(), 0);
})(window);
