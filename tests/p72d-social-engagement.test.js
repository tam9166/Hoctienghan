'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const content = JSON.parse(read('content/social-engagement.json'));

function runtime(values = new Map(), id = 'user-a') {
  const state = { currentUser: { id, currentTopikLevel: 1 }, currentView: 'home' }; const sync = []; const rpc = []; const reports = []; const blocks = new Set();
  const xp = [
    { event_id: 'completed_lesson:1', user_id: id, activity_type: 'lesson_completed', reference_id: 'l1', xp: 10, base_xp: 10, server_xp: 10, sync_status: 'synced', anti_gaming: 'verified', created_at: new Date().toISOString() },
    { event_id: 'speaking_completed:1', user_id: id, activity_type: 'speaking_practice', reference_id: 's1', xp: 15, base_xp: 15, sync_status: 'pending', anti_gaming: 'verified', created_at: new Date().toISOString() },
    { event_id: 'completed_lesson:1', user_id: id, activity_type: 'lesson_completed', reference_id: 'l1', xp: 10, base_xp: 10, server_xp: 10, sync_status: 'synced', anti_gaming: 'verified', created_at: new Date().toISOString() },
    { event_id: 'fake:1', user_id: id, activity_type: 'lesson_completed', reference_id: 'fake', xp: 9999, base_xp: 10, sync_status: 'synced', anti_gaming: 'verified', created_at: new Date().toISOString() }
  ];
  const window = { KLEARN_APP: { state, STORAGE_KEYS: { socialEngagement: 'social' }, userScoped: (key) => values.get(key)?.[state.currentUser.id] || [], saveUserScoped: (key, items) => { const all = values.get(key) || {}; all[state.currentUser.id] = items; values.set(key, all); }, CloudSyncService: { schedule: (reason) => sync.push(reason) }, setView: (view) => { state.currentView = view; }, render() {}, toast() {}, escapeHtml: String }, LearningXPService: { events: () => xp }, CommunitySafetyService: { blocked: () => blocks, block: (target) => (blocks.add(target), { target }), report: (input) => (reports.push(input), input) }, SupabaseService: { client: { rpc: async (name, payload) => { rpc.push({ name, payload }); if (name === 'get_korean_learning_leaderboard') return { data: [{ user_id: 'peer-a', nickname: 'Mây', valid_weekly_xp: 120, event_count: 8, tier: 'Bronze', server_verified: true }, { user_id: 'peer-b', nickname: 'Private email@example.com', valid_weekly_xp: 999, event_count: 9, tier: 'Gold', server_verified: false }] }; return { data: true }; } } }, navigator: { onLine: true }, crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(Math.random()).slice(2, 14).padEnd(12, '0')}` }, KLEARN_EXTRA_VIEWS: {}, addEventListener() {}, document: null };
  window.window = window;
  vm.runInNewContext(read('data/social-engagement.js'), { window, console, Date, Math, JSON, Object, Array, Number, String, Boolean, RegExp, Set, Map, Promise, Symbol, FormData: class FormData {} });
  window.SocialEngagementContentService.hydrate(content);
  return { window, state, values, sync, rpc, reports, blocks, xp };
}

(async () => {
  const r = runtime(); const w = r.window;
  assert.deepEqual(w.SocialEngagementContentService.get().league.tiers.map((item) => item.name), ['Bronze','Silver','Gold','Platinum','Master']);
  assert.equal(w.SocialXPIntegrityService.validEvents().length, 2, 'duplicate/fake XP must be rejected');
  assert.equal(w.SocialXPIntegrityService.weeklyXp(true), 10, 'ranking only uses synced canonical XP');
  assert.equal(w.LeagueService.mine().pendingXp, 15); assert.equal(w.LeagueService.tierFor(501).name, 'Gold');
  assert.equal(JSON.stringify(w.SocialPrivacyService.get()), JSON.stringify({ nickname: 'Học viên', leaderboardVisible: false, profileVisible: false }));
  w.SocialPrivacyService.save({ nickname: 'Mầm xanh', leaderboardVisible: true, profileVisible: false }); assert.deepEqual(w.SocialPrivacyService.publicProfile(), null); assert.ok(!JSON.stringify(r.values.get('social')).includes('email'));
  const board = await w.LeaderboardService.load(); assert.equal(board.rows.length, 1); assert.equal(board.rows[0].nickname, 'Mây'); assert.equal(board.rows[0].serverVerified, true);
  w.SocialSafetyService.mute('peer-a'); assert.equal(w.SocialSafetyService.muted().has('peer-a'), true); assert.equal(w.LeaderboardService.hydrate([{ user_id: 'peer-a', nickname: 'Mây', valid_weekly_xp: 120, server_verified: true }]).rows.length, 0);
  w.SocialSafetyService.block('peer-block'); w.SocialSafetyService.report('peer-report', 'spam'); assert.equal(r.blocks.has('peer-block'), true); assert.equal(r.reports.length, 1);
  const friend = w.FriendQuestService.create('friend-500', ['peer-a']); assert.equal(friend.targetXp, 500); assert.equal(w.FriendQuestService.progress(friend).canonicalXp, 0, 'XP before quest start must not count');
  assert.ok(w.SocialMonthlyChallengeService.join('monthly-valid-xp')); assert.equal(w.SocialMonthlyChallengeService.progress('monthly-valid-xp').progress, 25);
  const side = w.SocialSideQuestService.start('side-listen'); assert.ok(side); r.xp.push({ event_id: 'listening_completed:1', user_id: 'user-a', activity_type: 'listening_practice', reference_id: 'listen-1', xp: 12, base_xp: 12, sync_status: 'pending', anti_gaming: 'verified', created_at: new Date().toISOString() }); const reward = w.SocialSideQuestService.claim('side-listen'); assert.equal(reward.rankingEligible, false); assert.equal(w.SocialXPIntegrityService.weeklyXp(true), 10);
  w.navigator.onLine = false; assert.equal((await w.SocialOfflineSyncService.syncPending()).status, 'offline'); assert.ok(w.SocialOfflineSyncService.pending().length >= 5); assert.equal((await w.LeaderboardService.load()).status, 'offline'); assert.equal(w.LeaderboardService.state().rows.length, 0);
  const restored = runtime(r.values); assert.equal(restored.window.SocialPrivacyService.get().nickname, 'Mầm xanh'); restored.state.currentUser = { id: 'user-b' }; assert.equal(restored.window.SocialPrivacyService.get().nickname, 'Học viên');
  const app = read('app.js'); const loader = read('data/route-loader.js'); const worker = read('sw.js'); const sql = read('supabase/migrations/20260913_p72d_social_engagement.sql');
  assert.match(app, /socialEngagement: 'klearn_social_engagement'/); assert.match(app, /mergeSocialEngagement/); assert.match(loader, /socialEngagement/); assert.match(worker, /content\/social-engagement\.json/); assert.match(sql, /get_korean_learning_leaderboard/); assert.match(sql, /leaderboard_visible = true/); assert.match(sql, /ranking_eligible boolean not null default false check \(ranking_eligible = false\)/); assert.match(sql, /community_is_blocked/); assert.doesNotMatch(sql, /auth\.users.*email/i);
  console.log('P72D league, canonical leaderboard, privacy, anti-cheat, friend/monthly/side quests, safety, offline queue and RLS passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
