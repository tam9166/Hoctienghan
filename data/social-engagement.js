/* P72D — privacy-first social engagement built on verified P72A learning XP. */
(function buildSocialEngagement(global) {
  'use strict';
  const app = global.KLEARN_APP;
  if (!app) return;
  const { state, STORAGE_KEYS, userScoped, saveUserScoped, CloudSyncService, setView, render, toast, escapeHtml } = app;
  const STORE_KEY = STORAGE_KEYS.socialEngagement || 'klearn_social_engagement';
  const VALID_ACTIVITIES = new Set(['lesson_completed', 'vocabulary_practice', 'srs_review', 'listening_practice', 'speaking_practice', 'writing_practice', 'grammar_practice', 'topik_practice', 'quick_practice']);
  const VALID_ANTI_GAMING = new Set(['verified', 'diminished-repeat']);
  const runtime = state.socialEngagement || (state.socialEngagement = { content: null, loading: null, error: '', leaderboard: { status: 'idle', rows: [], weekStart: null, loadedAt: null } });
  const now = () => new Date().toISOString();
  const clean = (value, limit = 160) => String(value == null ? '' : value).normalize('NFC').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, limit);
  const uuid = () => global.crypto?.randomUUID?.() || `social-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const userId = () => state.currentUser?.id || '';
  const startOfWeek = (value = new Date()) => { const date = new Date(value); const day = (date.getUTCDay() + 6) % 7; date.setUTCDate(date.getUTCDate() - day); date.setUTCHours(0, 0, 0, 0); return date; };
  const startOfMonth = (value = new Date()) => { const date = new Date(value); return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1)); };
  const defaultStore = () => ({ schemaVersion: 1, profile: { nickname: 'Học viên', leaderboardVisible: false, profileVisible: false }, friendQuests: [], challengeJoins: [], sideQuestRuns: [], rewards: [], mutes: [], syncQueue: [], updatedAt: null });
  function readStore() {
    const value = userScoped(STORE_KEY)[0] || {};
    const base = defaultStore();
    return { ...base, ...value, profile: { ...base.profile, ...(value.profile || {}) }, friendQuests: Array.isArray(value.friendQuests) ? value.friendQuests : [], challengeJoins: Array.isArray(value.challengeJoins) ? value.challengeJoins : [], sideQuestRuns: Array.isArray(value.sideQuestRuns) ? value.sideQuestRuns : [], rewards: Array.isArray(value.rewards) ? value.rewards : [], mutes: Array.isArray(value.mutes) ? value.mutes : [], syncQueue: Array.isArray(value.syncQueue) ? value.syncQueue : [] };
  }
  function writeStore(value, reason = 'social-engagement') { const next = { ...defaultStore(), ...value, schemaVersion: 1, updatedAt: now() }; saveUserScoped(STORE_KEY, [next], 1); CloudSyncService?.schedule?.(reason); return next; }
  function queueAction(store, actionType, payload) { const action = { id: uuid(), actionType, payload, status: 'pending', createdAt: now() }; return { ...store, syncQueue: [action, ...store.syncQueue].slice(0, 300) }; }
  function learningEvents() { return Array.isArray(global.LearningXPService?.events?.()) ? global.LearningXPService.events() : []; }

  const SocialEngagementContentService = {
    hydrate(value) {
      const tiers = value?.league?.tiers || []; const side = value?.sideQuests || [];
      if (!value || value.schemaVersion !== 1 || value.status !== 'approved' || value.verified !== true || tiers.map((item) => item.name).join('|') !== 'Bronze|Silver|Gold|Platinum|Master' || !value.leaderboardPolicy?.canonicalOnly || side.some((item) => item.estimatedMinutes < 1 || item.estimatedMinutes > 3)) throw new Error('P72D social engagement quality gate failed');
      runtime.content = Object.freeze(value); runtime.error = ''; return value;
    },
    load() {
      if (runtime.content) return Promise.resolve(runtime.content); if (runtime.loading) return runtime.loading; if (typeof global.fetch !== 'function') return Promise.resolve(null);
      runtime.loading = global.fetch('./content/social-engagement.json', { cache: 'default' }).then((response) => { if (!response.ok) throw new Error(`Social engagement ${response.status}`); return response.json(); }).then((value) => this.hydrate(value)).catch((error) => { runtime.error = clean(error.message); return null; }).finally(() => { runtime.loading = null; if (routes.has(state.currentView)) render(); }); return runtime.loading;
    },
    get: () => runtime.content
  };

  const SocialXPIntegrityService = {
    validEvents({ canonicalOnly = false, from = null, to = null } = {}) {
      const seen = new Set(); const start = from ? new Date(from).getTime() : -Infinity; const end = to ? new Date(to).getTime() : Infinity;
      return learningEvents().filter((event) => {
        const eventId = clean(event.event_id, 220); const time = new Date(event.created_at).getTime(); const xp = Number(event.xp); const base = Number(event.base_xp ?? event.server_xp ?? xp);
        if (!eventId || seen.has(eventId) || !VALID_ACTIVITIES.has(event.activity_type) || !VALID_ANTI_GAMING.has(event.anti_gaming) || !Number.isFinite(time) || time < start || time >= end || !Number.isFinite(xp) || xp < 1 || xp > 40 || xp > base || (event.user_id && event.user_id !== userId())) return false;
        if (canonicalOnly && (event.sync_status !== 'synced' || !Number.isFinite(Number(event.server_xp)) || Number(event.server_xp) !== xp)) return false;
        seen.add(eventId); return true;
      });
    },
    weekly(canonicalOnly = false, value = new Date()) { const from = startOfWeek(value); const to = new Date(from.getTime() + 7 * 86400000); return this.validEvents({ canonicalOnly, from, to }); },
    weeklyXp(canonicalOnly = false, value = new Date()) { return this.weekly(canonicalOnly, value).reduce((sum, event) => sum + Number(event.xp || 0), 0); },
    audit() { const all = learningEvents(); const valid = this.validEvents(); return { total: all.length, valid: valid.length, rejected: all.length - valid.length, duplicateIdsRejected: new Set(all.map((item) => item.event_id)).size < all.length, rawClientXpAcceptedForRanking: false }; }
  };

  const LeagueService = {
    tierFor(xp) { const tiers = runtime.content?.league?.tiers || []; return [...tiers].reverse().find((tier) => Number(xp) >= Number(tier.minimumXp)) || tiers[0] || { id: 'bronze', name: 'Bronze', minimumXp: 0 }; },
    mine() { const canonicalXp = SocialXPIntegrityService.weeklyXp(true); const pendingXp = SocialXPIntegrityService.weeklyXp(false) - canonicalXp; return { tier: this.tierFor(canonicalXp), canonicalXp, pendingXp: Math.max(0, pendingXp), weekStart: startOfWeek().toISOString().slice(0, 10), rankingSource: 'server-canonical-only' }; }
  };

  const SocialPrivacyService = {
    get: () => readStore().profile,
    save(input = {}) {
      const nickname = clean(input.nickname, Number(runtime.content?.privacy?.nicknameMaximum || 40)); if (!nickname) throw new Error('Nickname không được để trống.');
      const store = readStore(); const profile = { nickname, leaderboardVisible: input.leaderboardVisible === true, profileVisible: input.profileVisible === true };
      writeStore(queueAction({ ...store, profile }, 'privacy', profile), 'social-privacy'); return profile;
    },
    publicProfile() { const profile = this.get(); return profile.profileVisible ? { nickname: profile.nickname, level: clean(state.currentUser?.currentTopikLevel ? `TOPIK ${state.currentUser.currentTopikLevel}` : 'Beginner', 30) } : null; }
  };

  const SocialSafetyService = {
    muted() { return new Set(readStore().mutes); },
    mute(targetId) { const id = clean(targetId, 80); if (!id || id === userId()) return false; const store = readStore(); if (store.mutes.includes(id)) return true; writeStore(queueAction({ ...store, mutes: [id, ...store.mutes].slice(0, 200) }, 'mute', { targetId: id }), 'social-mute'); return true; },
    unmute(targetId) { const id = clean(targetId, 80); const store = readStore(); writeStore(queueAction({ ...store, mutes: store.mutes.filter((item) => item !== id) }, 'unmute', { targetId: id }), 'social-unmute'); },
    block(targetId) { return global.CommunitySafetyService?.block?.(targetId) || null; },
    blocked() { return global.CommunitySafetyService?.blocked?.() || new Set(); },
    report(targetId, reason = 'spam', details = '') { return global.CommunitySafetyService?.report?.({ targetType: 'profile', targetId: clean(targetId, 80), reason, details: clean(details, 500) }) || null; },
    hiddenIds() { return new Set([...this.muted(), ...this.blocked()]); }
  };

  const LeaderboardService = {
    state: () => ({ ...runtime.leaderboard, rows: [...runtime.leaderboard.rows] }),
    hydrate(rows = [], weekStart = startOfWeek().toISOString().slice(0, 10)) {
      const hidden = SocialSafetyService.hiddenIds(); const safe = rows.filter((row) => row?.server_verified === true && row.user_id && !hidden.has(row.user_id) && Number.isFinite(Number(row.valid_weekly_xp)) && Number(row.valid_weekly_xp) >= 0).map((row) => ({ userId: clean(row.user_id, 80), nickname: clean(row.nickname, 40) || 'Học viên', validWeeklyXp: Math.max(0, Math.round(Number(row.valid_weekly_xp))), tier: clean(row.tier, 20) || LeagueService.tierFor(row.valid_weekly_xp).name, eventCount: Math.max(0, Number(row.event_count || 0)), serverVerified: true })).sort((a, b) => b.validWeeklyXp - a.validWeeklyXp || a.nickname.localeCompare(b.nickname)).slice(0, 100).map((row, index) => ({ ...row, rank: index + 1 }));
      runtime.leaderboard = { status: 'ready', rows: safe, weekStart, loadedAt: now() }; return this.state();
    },
    async load() {
      if (global.navigator?.onLine === false) { runtime.leaderboard = { status: 'offline', rows: [], weekStart: startOfWeek().toISOString().slice(0, 10), loadedAt: now() }; return this.state(); }
      const client = global.SupabaseService?.client; if (!client?.rpc) { runtime.leaderboard = { status: 'unavailable', rows: [], weekStart: startOfWeek().toISOString().slice(0, 10), loadedAt: now() }; return this.state(); }
      runtime.leaderboard.status = 'loading'; const weekStart = startOfWeek().toISOString().slice(0, 10);
      const { data, error } = await client.rpc('get_korean_learning_leaderboard', { p_week_start: weekStart, p_limit: 100 });
      if (error) { runtime.leaderboard = { status: 'unavailable', rows: [], weekStart, loadedAt: now() }; return this.state(); }
      return this.hydrate(Array.isArray(data) ? data : [], weekStart);
    }
  };

  const FriendQuestService = {
    all: () => readStore().friendQuests,
    create(templateId, participantIds = []) {
      const template = runtime.content?.friendQuestTemplates?.find((item) => item.id === templateId); if (!template) return null;
      const members = [...new Set(participantIds.map((item) => clean(item, 80)).filter((item) => item && item !== userId()))].slice(0, Math.max(0, Number(template.maxMembers || 4) - 1));
      const createdAt = now(); const quest = { id: uuid(), templateId, title: template.title, ownerId: userId(), participantIds: [userId(), ...members], targetXp: Number(template.targetXp), startsAt: createdAt, endsAt: new Date(new Date(createdAt).getTime() + Number(template.durationDays) * 86400000).toISOString(), status: 'pending-sync', serverContributions: [], createdAt };
      const store = readStore(); writeStore(queueAction({ ...store, friendQuests: [quest, ...store.friendQuests].slice(0, 50) }, 'friend-quest-create', { questId: quest.id, templateId, participantIds: members }), 'friend-quest'); return quest;
    },
    progress(quest) {
      const from = new Date(quest.startsAt); const to = new Date(quest.endsAt); const ownCanonical = SocialXPIntegrityService.validEvents({ canonicalOnly: true, from, to }).reduce((sum, event) => sum + Number(event.xp || 0), 0); const ownAll = SocialXPIntegrityService.validEvents({ from, to }).reduce((sum, event) => sum + Number(event.xp || 0), 0);
      const other = (quest.serverContributions || []).filter((item) => item.userId !== userId() && item.serverVerified).reduce((sum, item) => sum + Number(item.validXp || 0), 0); const canonicalXp = ownCanonical + other;
      return { canonicalXp, pendingOwnXp: Math.max(0, ownAll - ownCanonical), targetXp: quest.targetXp, completed: canonicalXp >= quest.targetXp, contributionSource: 'server-canonical-only' };
    }
  };

  const MonthlyChallengeService = {
    definitions: () => runtime.content?.monthlyChallenges || [],
    joined: (id) => readStore().challengeJoins.find((item) => item.challengeId === id) || null,
    join(challengeId) { const definition = this.definitions().find((item) => item.id === challengeId); if (!definition) return null; const store = readStore(); const existing = store.challengeJoins.find((item) => item.challengeId === challengeId && item.month === now().slice(0, 7)); if (existing) return existing; const joined = { id: uuid(), challengeId, month: now().slice(0, 7), joinedAt: now(), status: 'pending-sync' }; writeStore(queueAction({ ...store, challengeJoins: [joined, ...store.challengeJoins].slice(0, 36) }, 'monthly-join', { challengeId, month: joined.month }), 'social-monthly'); return joined; },
    progress(challengeId, value = new Date()) { const definition = this.definitions().find((item) => item.id === challengeId); if (!definition) return null; const from = startOfMonth(value); const to = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1)); const events = SocialXPIntegrityService.validEvents({ from, to }); const progress = definition.metric === 'learning_days' ? new Set(events.map((event) => String(event.created_at).slice(0, 10))).size : events.reduce((sum, event) => sum + Number(event.xp || 0), 0); return { progress: Math.min(Number(definition.target), progress), target: Number(definition.target), completed: progress >= Number(definition.target), metric: definition.metric, localEvidence: true };
    }
  };

  const SideQuestService = {
    definitions: () => runtime.content?.sideQuests || [],
    run(id) { return readStore().sideQuestRuns.find((item) => item.questId === id && item.day === now().slice(0, 10)) || null; },
    start(id) { const definition = this.definitions().find((item) => item.id === id); if (!definition) return null; const existing = this.run(id); if (existing) return existing; const store = readStore(); const run = { id: uuid(), questId: id, day: now().slice(0, 10), startedAt: `${now().slice(0, 10)}T00:00:00.000Z`, status: 'active', evidenceEventIds: [], claimedAt: null }; writeStore({ ...store, sideQuestRuns: [run, ...store.sideQuestRuns].slice(0, 100) }, 'side-quest-start'); return run; },
    progress(id) { const definition = this.definitions().find((item) => item.id === id); const run = this.run(id); if (!definition) return null; const from = new Date(run?.startedAt || `${now().slice(0, 10)}T00:00:00.000Z`); const events = SocialXPIntegrityService.validEvents({ from }).filter((event) => definition.activityTypes.includes(event.activity_type)); const unique = [...new Map(events.map((event) => [event.event_id, event])).values()]; return { progress: Math.min(definition.target, unique.length), target: definition.target, completed: unique.length >= definition.target, evidenceEventIds: unique.slice(0, definition.target).map((event) => event.event_id), reward: definition.reward };
    },
    claim(id) { const definition = this.definitions().find((item) => item.id === id); const progress = this.progress(id); const run = this.run(id) || this.start(id); if (!definition || !run || !progress?.completed || run.claimedAt) return null; const store = readStore(); const reward = { id: `side-reward:${run.id}`, questId: id, type: definition.reward.type, amount: Number(definition.reward.amount || 1), rewardId: definition.reward.id || null, evidenceEventIds: progress.evidenceEventIds, createdAt: now(), rankingEligible: false }; const updatedRun = { ...run, status: 'claimed', claimedAt: now(), evidenceEventIds: progress.evidenceEventIds }; const next = { ...store, sideQuestRuns: store.sideQuestRuns.map((item) => item.id === run.id ? updatedRun : item), rewards: [reward, ...store.rewards].slice(0, 200) }; writeStore(queueAction(next, 'side-quest-claim', { runId: run.id, questId: id, evidenceEventIds: progress.evidenceEventIds }), 'side-quest-claim'); return reward; },
    rewards: () => readStore().rewards
  };

  const SocialOfflineSyncService = {
    pending: () => readStore().syncQueue.filter((item) => item.status !== 'synced'),
    async syncPending() {
      if (global.navigator?.onLine === false) return { status: 'offline', synced: 0 }; const client = global.SupabaseService?.client; if (!client?.rpc) return { status: 'local-only', synced: 0 };
      const store = readStore(); let synced = 0;
      for (const action of store.syncQueue.filter((item) => item.status !== 'synced').slice(-100)) { const { error } = await client.rpc('sync_social_engagement_action', { p_action_id: action.id, p_action_type: action.actionType, p_payload: action.payload }); if (!error) { action.status = 'synced'; action.syncedAt = now(); synced += 1; } }
      if (synced) writeStore(store, 'social-sync'); return { status: synced ? 'synced' : 'no-change', synced };
    }
  };

  function heading(back, eyebrow, title, description) { return `<header class="p72d-heading"><button data-view="${back}" aria-label="Quay lại">←</button><div><p>${eyebrow}</p><h1>${title}</h1><span>${description}</span></div></header>`; }
  function loadingView() { SocialEngagementContentService.load(); return `${heading('engagement-center', 'P72D', 'Đang tải Social Engagement…', 'Không dựng bảng xếp hạng giả khi thiếu dữ liệu máy chủ.')}<section class="section p72d-loading"></section>`; }
  function hubView() {
    if (!runtime.content) return loadingView(); const league = LeagueService.mine(); const pending = SocialOfflineSyncService.pending().length;
    return `${heading('engagement-center', 'SOCIAL LEARNING', 'Cùng học, không cạnh tranh độc hại', 'League dùng XP hợp lệ theo tuần; Mastery và TOPIK không bị thay thế.')}<section class="section p72d-overview"><article><small>LEAGUE HIỆN TẠI</small><strong>${escapeHtml(league.tier.name)}</strong><span>${league.canonicalXp} XP đã xác minh · ${league.pendingXp} chờ sync</span></article><article><small>QUYỀN RIÊNG TƯ</small><strong>${SocialPrivacyService.get().leaderboardVisible ? 'Đang tham gia' : 'Đã ẩn'}</strong><span>Không hiển thị email hoặc dữ liệu riêng tư</span></article><article><small>OFFLINE QUEUE</small><strong>${pending}</strong><span>Social action chờ đồng bộ, không tạo rank giả</span></article></section><section class="section p72d-grid">${[['korean-league','🏅','League & Leaderboard','Weekly valid XP'],['friend-quests','🤝','Friend Quest','Nhóm nhỏ cùng mục tiêu'],['social-challenges','🗓','Monthly Challenge','20 ngày hoặc 1.000 XP'],['side-quests','⚡','Side Quest','Nhiệm vụ 1–3 phút'],['social-privacy','🔒','Privacy & Safety','Nickname · ẩn · block · mute']].map(([view,icon,title,copy]) => `<button data-view="${view}"><i>${icon}</i><b>${title}</b><span>${copy}</span></button>`).join('')}</section>`;
  }
  function leagueView() {
    if (!runtime.content) return loadingView(); const board = LeaderboardService.state(); const mine = LeagueService.mine(); const rows = board.rows;
    return `${heading('social-engagement', 'KOREAN LEARNING LEAGUE', `${mine.tier.name} · ${mine.canonicalXp} XP`, 'Chỉ XP học tập canonical trong tuần; bonus, spam và event trùng bị loại.')}<section class="section p72d-tiers">${runtime.content.league.tiers.map((tier) => `<article class="${tier.id === mine.tier.id ? 'active' : ''}"><b>${tier.name}</b><span>${tier.minimumXp}+ XP</span></article>`).join('')}</section><section class="section p72d-board"><header><div><h2>Bảng xếp hạng tuần</h2><p>${escapeHtml(board.weekStart || mine.weekStart)}</p></div><button class="btn secondary" data-p72d-refresh>Đồng bộ</button></header>${!SocialPrivacyService.get().leaderboardVisible ? '<div class="p72d-empty">Bạn đang ẩn khỏi leaderboard. Có thể bật bằng nickname trong Privacy.</div>' : board.status === 'offline' ? '<div class="p72d-empty">Đang offline. Bảng xếp hạng không được mô phỏng; hoạt động học vẫn được lưu.</div>' : board.status !== 'ready' ? '<div class="p72d-empty">Chưa có dữ liệu canonical từ máy chủ. Không hiển thị thứ hạng giả.</div>' : rows.length ? rows.map((row) => `<article><b>#${row.rank}</b><span><strong>${escapeHtml(row.nickname)}</strong><small>${escapeHtml(row.tier)} · ${row.eventCount} hoạt động</small></span><em>${row.validWeeklyXp} XP</em><button data-p72d-mute="${escapeHtml(row.userId)}">Ẩn</button></article>`).join('') : '<div class="p72d-empty">Chưa có người học công khai trong tuần này.</div>'}</section>`;
  }
  function friendView() {
    if (!runtime.content) return loadingView(); const quests = FriendQuestService.all();
    return `${heading('social-engagement', 'FRIEND QUEST', 'Cùng đạt mục tiêu thật', 'Chỉ đóng góp từ learning event đã xác minh; tối đa 4 thành viên.')}<section class="section p72d-create"><h2>Tạo Friend Quest</h2>${runtime.content.friendQuestTemplates.map((item) => `<button class="btn secondary" data-p72d-friend-create="${item.id}">${escapeHtml(item.title)} · ${item.durationDays} ngày</button>`).join('')}<p>Mời bạn học đã kết nối sau khi backend xác nhận. Không có nhắn tin trực tiếp.</p></section><section class="section p72d-quest-list">${quests.length ? quests.map((quest) => { const progress = FriendQuestService.progress(quest); return `<article><small>${escapeHtml(quest.status)}</small><h2>${escapeHtml(quest.title)}</h2><div><i style="width:${Math.min(100, progress.canonicalXp / progress.targetXp * 100)}%"></i></div><p>${progress.canonicalXp}/${progress.targetXp} canonical XP · ${progress.pendingOwnXp} đang chờ sync</p><span>${quest.participantIds.length}/${runtime.content.friendQuestTemplates.find((item) => item.id === quest.templateId)?.maxMembers || 4} thành viên</span></article>`; }).join('') : '<div class="p72d-empty">Chưa có Friend Quest. Tạo một mục tiêu 7 ngày để bắt đầu.</div>'}</section>`;
  }
  function challengeView() { if (!runtime.content) return loadingView(); return `${heading('social-engagement', 'MONTHLY CHALLENGE', 'Một tháng, một nhịp học rõ ràng', 'Tiến độ lấy từ event học hợp lệ, không cho nhập thủ công.')}<section class="section p72d-challenges">${MonthlyChallengeService.definitions().map((item) => { const joined = MonthlyChallengeService.joined(item.id); const progress = MonthlyChallengeService.progress(item.id); return `<article><small>${item.metric === 'learning_days' ? 'LEARNING DAYS' : 'VALID XP'}</small><h2>${escapeHtml(item.title)}</h2><div><i style="width:${Math.min(100, progress.progress / progress.target * 100)}%"></i></div><p>${progress.progress}/${progress.target}</p><button class="btn ${joined ? 'secondary' : 'primary'}" data-p72d-monthly="${item.id}" ${joined ? 'disabled' : ''}>${joined ? 'Đã tham gia' : 'Tham gia'}</button></article>`; }).join('')}</section>`; }
  function sideView() { if (!runtime.content) return loadingView(); return `${heading('social-engagement', 'SIDE QUEST', 'Thêm một chút nữa', 'Quest 1–3 phút chỉ hoàn thành khi có event học hợp lệ.')}<section class="section p72d-side">${SideQuestService.definitions().map((item) => { const run = SideQuestService.run(item.id); const progress = SideQuestService.progress(item.id); return `<article><header><span>${item.estimatedMinutes} phút</span><small>${item.reward.type === 'xp' ? `+${item.reward.amount} bonus XP` : item.reward.type}</small></header><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.description)}</p><div><i style="width:${Math.min(100, progress.progress / progress.target * 100)}%"></i></div><small>${progress.progress}/${progress.target} learning events · reward không tính leaderboard</small><footer>${!run ? `<button class="btn primary" data-p72d-side-start="${item.id}">Bắt đầu</button>` : progress.completed && !run.claimedAt ? `<button class="btn primary" data-p72d-side-claim="${item.id}">Nhận thưởng</button>` : run.claimedAt ? '<button class="btn secondary" disabled>Đã nhận</button>' : `<button class="btn secondary" data-view="${item.route}">Đi luyện</button>`}</footer></article>`; }).join('')}</section>`; }
  function privacyView() { if (!runtime.content) return loadingView(); const profile = SocialPrivacyService.get(); const muted = [...SocialSafetyService.muted()]; return `${heading('social-engagement', 'PRIVACY & SAFETY', 'Bạn quyết định mức độ xuất hiện', 'Nickname tách khỏi email; leaderboard và profile có hai công tắc riêng.')}<form id="p72dPrivacyForm" class="section p72d-privacy"><label>Nickname<input name="nickname" maxlength="40" required value="${escapeHtml(profile.nickname)}"></label><label><input type="checkbox" name="leaderboardVisible" ${profile.leaderboardVisible ? 'checked' : ''}> Hiển thị nickname trong leaderboard</label><label><input type="checkbox" name="profileVisible" ${profile.profileVisible ? 'checked' : ''}> Cho phép xem hồ sơ học tập tối giản</label><p>Không bao giờ công khai email, token, vị trí hay dữ liệu học chi tiết.</p><button class="btn primary">Lưu quyền riêng tư</button></form><section class="section p72d-muted"><h2>Đã mute</h2>${muted.length ? muted.map((id) => `<p><span>${escapeHtml(id)}</span><button data-p72d-unmute="${escapeHtml(id)}">Bỏ mute</button></p>`).join('') : '<div class="p72d-empty">Chưa mute hồ sơ nào.</div>'}<button class="btn secondary" data-view="community-safety">Mở Block & Report</button></section>`; }

  const routes = new Set(['social-engagement', 'korean-league', 'friend-quests', 'social-challenges', 'side-quests', 'social-privacy']);
  global.KLEARN_EXTRA_VIEWS = { ...(global.KLEARN_EXTRA_VIEWS || {}), 'social-engagement': hubView, 'korean-league': leagueView, 'friend-quests': friendView, 'social-challenges': challengeView, 'side-quests': sideView, 'social-privacy': privacyView };
  function bind() {
    global.document?.querySelectorAll('.p72d-heading [data-view],.p72d-grid [data-view],.p72d-side [data-view],.p72d-muted [data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); });
    global.document?.querySelector('[data-p72d-refresh]')?.addEventListener('click', () => LeaderboardService.load().then(() => render()));
    global.document?.querySelectorAll('[data-p72d-friend-create]').forEach((button) => { button.onclick = () => { FriendQuestService.create(button.dataset.p72dFriendCreate, []); render(); }; });
    global.document?.querySelectorAll('[data-p72d-monthly]').forEach((button) => { button.onclick = () => { MonthlyChallengeService.join(button.dataset.p72dMonthly); render(); }; });
    global.document?.querySelectorAll('[data-p72d-side-start]').forEach((button) => { button.onclick = () => { const run = SideQuestService.start(button.dataset.p72dSideStart); const route = runtime.content.sideQuests.find((item) => item.id === run?.questId)?.route; if (route) setView(route); else render(); }; });
    global.document?.querySelectorAll('[data-p72d-side-claim]').forEach((button) => { button.onclick = () => { const reward = SideQuestService.claim(button.dataset.p72dSideClaim); toast?.(reward ? 'Đã nhận phần thưởng có learning evidence.' : 'Quest chưa đủ điều kiện.'); render(); }; });
    global.document?.querySelectorAll('[data-p72d-mute]').forEach((button) => { button.onclick = () => { SocialSafetyService.mute(button.dataset.p72dMute); render(); }; });
    global.document?.querySelectorAll('[data-p72d-unmute]').forEach((button) => { button.onclick = () => { SocialSafetyService.unmute(button.dataset.p72dUnmute); render(); }; });
    const form = global.document?.getElementById('p72dPrivacyForm'); if (form) form.onsubmit = (event) => { event.preventDefault(); const data = new FormData(form); SocialPrivacyService.save({ nickname: data.get('nickname'), leaderboardVisible: data.has('leaderboardVisible'), profileVisible: data.has('profileVisible') }); toast?.('Đã lưu quyền riêng tư.'); render(); };
  }
  Object.assign(global, { SocialEngagementContentService, SocialXPIntegrityService, LeagueService, LeaderboardService, FriendQuestService, SocialMonthlyChallengeService: MonthlyChallengeService, SocialSideQuestService: SideQuestService, SocialPrivacyService, SocialSafetyService, SocialOfflineSyncService, SocialEngagementSystem: { content: SocialEngagementContentService, integrity: SocialXPIntegrityService, league: LeagueService, leaderboard: LeaderboardService, friendQuests: FriendQuestService, monthly: MonthlyChallengeService, sideQuests: SideQuestService, privacy: SocialPrivacyService, safety: SocialSafetyService, sync: SocialOfflineSyncService, version: 'p72d-v1' } });
  const previousAfterRender = global.KLEARN_AFTER_RENDER;
  global.KLEARN_AFTER_RENDER = () => {
    previousAfterRender?.(); if (!state.currentUser) return; if (routes.has(state.currentView) && !runtime.content) SocialEngagementContentService.load();
    if (state.currentView === 'engagement-center' && runtime.content && !global.document?.querySelector('[data-p72d-entry]')) global.document.querySelector('.p72-quests, .p72-summary')?.insertAdjacentHTML('afterend', `<section class="section p72d-entry" data-p72d-entry><div><small>P72D · SOCIAL LEARNING</small><h2>League, Friend Quest và thử thách ngắn</h2><p>Weekly XP có xác minh · riêng tư mặc định · không tạo rank khi offline.</p></div><button class="btn primary" data-view="social-engagement">Mở Social Learning</button></section>`);
    global.document?.querySelectorAll('[data-p72d-entry] [data-view]').forEach((button) => { button.onclick = () => setView(button.dataset.view); }); bind();
  };
  global.addEventListener?.('online', () => SocialOfflineSyncService.syncPending().then(() => LeaderboardService.load()));
  SocialEngagementContentService.load();
})(window);
