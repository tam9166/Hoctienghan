const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const foundationSource = fs.readFileSync(path.join(root, 'data', 'community-learning.js'), 'utf8');
const ecosystemSource = fs.readFileSync(path.join(root, 'data', 'community-ecosystem.js'), 'utf8');
const foundationContent = JSON.parse(fs.readFileSync(path.join(root, 'content', 'community-learning.json'), 'utf8'));
const ecosystemContent = JSON.parse(fs.readFileSync(path.join(root, 'content', 'community-ecosystem.json'), 'utf8'));
const migration = fs.readFileSync(path.join(root, 'supabase', 'migrations', '20260906_p38_community_learning_ecosystem.sql'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const worker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'community-ecosystem.css'), 'utf8');

function boot(userId = 'learner-a', shared = new Map()) {
  let activeRole = 'student';
  const state = { currentUser: { id: userId, fullName: userId === 'learner-a' ? 'An' : 'Bình', level: 'TOPIK 1', createdAt: '2026-08-01T00:00:00.000Z' }, currentView: 'learning-community', communityLearning: null };
  const scoped = (key) => shared.get(key)?.[userId] || [];
  const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = { document, KLEARN_EXTRA_VIEWS: {}, KLEARN_AFTER_RENDER: null, RolePermissionService: { role: () => activeRole }, AccessControlService: { role: () => activeRole }, GlobalSearchService: { search: () => ({ studyTools: [] }) }, AchievementService: { all: () => [{ id: 'first-hangul', title: 'Đọc Hangul đầu tiên', unlocked: true, unlockedAt: '2026-08-02T00:00:00.000Z' }] }, KLEARN_APP: { state, STORAGE_KEYS: { communityProgress: 'community' }, render() {}, setView(view) { state.currentView = view; }, toast() {}, escapeHtml: String, userScoped: scoped, saveUserScoped: saveScoped, getUserProgress: () => ({ stats: { streak: 2 } }), AccessControlService: { role: () => activeRole } } };
  const context = { window, document, console, Date, Intl, String, Number, Boolean, Object, Array, Math, Set, Map, RegExp, Promise, JSON, FormData: class {}, fetch: async (url) => ({ ok: true, json: async () => String(url).includes('ecosystem') ? ecosystemContent : foundationContent }) };
  vm.createContext(context); vm.runInContext(foundationSource, context); window.CommunityContentService.hydrate(foundationContent); vm.runInContext(ecosystemSource, context); window.CommunityEcosystemContentService.hydrate(ecosystemContent);
  return { window, state, shared, setRole(value) { activeRole = value; } };
}

(async () => {
  assert.equal(ecosystemContent.verified, true);
  assert.equal(ecosystemContent.reviewStatus, 'approved');
  assert.ok(ecosystemContent.principles.includes('no-direct-messaging'));
  assert.ok(ecosystemContent.principles.includes('privacy-by-default'));
  assert.ok(ecosystemContent.exchangeProfiles.every((item) => !('email' in item) && !('phone' in item) && !('location' in item)));

  const shared = new Map(); const a = boot('learner-a', shared); const app = a.window;
  app.CommunityProfileService.save({ displayName: 'An Học Hàn', level: 'TOPIK 1', interests: ['conversation', 'travel'], goal: 'Nói tự nhiên hơn', visibility: 'groups' });
  assert.equal(app.CommunityPrivacyControlsService.get().discoveryEnabled, false);
  assert.equal(app.CommunityPrivacyControlsService.publicSnapshot(), null);
  app.CommunityPrivacyControlsService.save({ discoveryEnabled: true, allowExchangeRequests: true, showAchievements: true, showActivity: false });
  const preference = app.LanguageExchangeService.save({ enabled: true, nativeLanguage: 'vi', learningLanguage: 'ko', koreanLevel: 'TOPIK 1', topics: ['daily-life'], formats: ['text-prompts'], availability: 'evening' });
  assert.equal(preference.enabled, true);
  assert.throws(() => app.LanguageExchangeService.save({ enabled: true, nativeLanguage: 'ko', learningLanguage: 'ko' }), /hai ngôn ngữ khác nhau/);
  assert.deepEqual(Object.keys(app.CommunityPrivacyControlsService.publicSnapshot()).sort(), ['achievementsVisible','activityVisible','displayName','goal','interests','level']);

  const matches = app.LanguageExchangeService.matches();
  assert.equal(matches[0].id, 'peer-hana');
  assert.equal(matches[0].score, 90);
  assert.equal(app.LanguageExchangeService.prompts().length, 3);
  const request = app.LanguageExchangeService.request('peer-hana', 'daily-life', 'text-prompts');
  assert.equal(request.status, 'local-draft');
  assert.equal(request.contactShared, false);
  assert.equal(app.LanguageExchangeService.request('missing'), null);
  app.CommunitySafetyService.block('peer-hana');
  assert.equal(app.LanguageExchangeService.matches().some((item) => item.id === 'peer-hana'), false);
  assert.equal(app.LanguageExchangeService.requests()[0].status, 'cancelled', 'blocking must cancel active exchange request');

  assert.throws(() => app.CommunityProfileService.save({ displayName: 'Liên hệ 0901234567', visibility: 'groups' }), /Không chia sẻ/);
  const report = app.CommunitySafetyService.report({ targetType: 'profile', targetId: 'peer-yun', reason: 'spam', details: 'Nội dung lặp lại.' });
  assert.equal(app.CommunityModerationService.queue().some((item) => item.id === report.id), true);
  await assert.rejects(() => app.CommunityModerationService.decide('report', report.id, 'resolved'), /Chỉ Admin/);
  a.setRole('admin');
  const action = await app.CommunityModerationService.decide('report', report.id, 'resolved', 'Đã kiểm tra báo cáo.');
  assert.equal(action.hardDelete, false);
  assert.equal(action.syncStatus, 'local-pending');
  assert.equal(app.CommunityModerationService.queue().some((item) => item.id === report.id), false);
  assert.equal(app.CommunityModerationService.localActions().length, 1);

  const b = boot('learner-b', shared);
  assert.equal(b.window.CommunityPrivacyControlsService.get().discoveryEnabled, false, 'privacy must be user scoped');
  assert.equal(b.window.LanguageExchangeService.preference().enabled, false, 'exchange opt-in must be user scoped');
  assert.equal(b.window.LanguageExchangeService.requests().length, 0, 'exchange requests must be user scoped');
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS['language-exchange'], 'function');
  assert.equal(typeof app.KLEARN_EXTRA_VIEWS['community-moderation'], 'function');
  assert.match(app.GlobalSearchService.search('trao đổi ngôn ngữ').studyTools[0].title, /Language Exchange/);

  for (const table of ['community_language_exchange_profiles','community_exchange_requests','community_moderation_actions']) assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
  assert.match(migration, /discovery_enabled boolean not null default false/);
  assert.match(migration, /accepts_requests = true/);
  assert.match(migration, /hard_delete boolean not null default false check \(hard_delete = false\)/);
  assert.match(migration, /public\.community_is_blocked\(auth\.uid\(\), user_id\)/);
  assert.match(migration, /admins moderate community questions/);
  assert.match(migration, /guard_community_exchange_request_transition/);
  assert.match(migration, /create or replace function public\.moderate_community_item/);
  assert.match(migration, /insert into public\.community_moderation_actions/);
  assert.doesNotMatch(migration, /\n\s+(?:email|phone|precise_location)\s+text/i);
  assert.match(index, /community-ecosystem\.css\?v=1/);
  assert.match(index, /data\/community-ecosystem\.js\?v=1/);
  assert.match(index, /app\.js\?v=54/);
  assert.match(worker, /klearn-v68/);
  assert.match(worker, /community-ecosystem\.json/);
  assert.match(appSource, /'language-exchange', 'community-moderation'/);
  assert.match(css, /@media\(max-width:600px\)/);
  console.log('community ecosystem: study foundation reuse, language exchange, challenge, achievement, peers, Q&A, rating, profile, privacy, moderation, RLS and no-direct-message policy passed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
