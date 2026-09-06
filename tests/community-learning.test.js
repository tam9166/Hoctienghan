const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const content = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'content', 'community-learning.json'), 'utf8'));
const source = fs.readFileSync(path.join(__dirname, '..', 'data', 'community-learning.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', 'supabase', 'migrations', '20260906_community_learning_foundation.sql'), 'utf8');

function boot(userId = 'learner-a', shared = new Map()) {
  const state = { currentUser: { id: userId, fullName: userId === 'learner-a' ? 'An' : 'Bình', level: 'TOPIK 1', createdAt: '2026-08-01T00:00:00.000Z' }, currentView: 'home', communityLearning: null };
  const syncEvents = [];
  const scoped = (key) => shared.get(key)?.[userId] || [];
  const saveScoped = (key, items) => { const all = shared.get(key) || {}; all[userId] = items; shared.set(key, all); syncEvents.push(key); };
  const document = { documentElement: { lang: 'vi' }, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null };
  const window = {
    document, KLEARN_EXTRA_VIEWS: { 'community-hub': () => '<section>legacy</section>' }, KLEARN_AFTER_RENDER: null,
    GlobalSearchService: { search: () => ({ studyTools: [] }) }, AchievementService: { all: () => [{ id: 'first-hangul', title: 'Đọc Hangul đầu tiên', unlocked: true, unlockedAt: '2026-08-02T00:00:00.000Z' }] },
    KLEARN_APP: { state, STORAGE_KEYS: { communityProgress: 'community' }, render: () => {}, setView: (view) => { state.currentView = view; }, toast: () => {}, escapeHtml: String, userScoped: scoped, saveUserScoped: saveScoped, getUserProgress: () => ({ stats: { streak: 2 } }) }
  };
  const context = { window, document, console, Date, Intl, String, Number, Object, Array, Math, Set, Map, RegExp, FormData: class {}, fetch: async () => ({ ok: true, json: async () => content }) };
  vm.createContext(context); vm.runInContext(source, context); window.CommunityContentService.hydrate(content);
  return { window, state, shared, syncEvents };
}

assert.equal(content.verified, true);
assert.equal(content.reviewStatus, 'approved');
assert.deepEqual(content.principles, ['learning-first', 'privacy-by-default', 'no-leaderboard', 'no-direct-messaging', 'opt-in-discovery']);
assert.deepEqual(content.groups.map((item) => item.track), ['topik', 'conversation', 'business']);
assert.equal(content.challenges[0].durationDays, 30);
assert.equal(content.safety.defaultVisibility, 'private');
assert.equal(content.activitySnapshot.competitiveRanking, false);
assert.ok(content.discoverableProfiles.every((item) => item.discoverable && !('email' in item) && !('phone' in item)));
assert.ok(content.questions.every((question) => ['grammar', 'vocabulary'].includes(question.category)));
assert.ok(content.questions.flatMap((question) => question.answers).every((answer) => answer.verified));

const shared = new Map(); const a = boot('learner-a', shared); const app = a.window;
assert.equal(app.CommunityProfileService.get().visibility, 'private');
assert.equal(app.CommunityProfileService.discoverable(), null);
const profile = app.CommunityProfileService.save({ displayName: 'An Học Hàn', level: 'TOPIK 1', interests: ['topik', 'grammar', 'travel', 'reading', 'business'], goal: 'Thi TOPIK 1', visibility: 'groups' });
assert.equal(profile.interests.length, 4);
assert.equal(app.CommunityProfileService.discoverable().goal, 'Thi TOPIK 1');
assert.deepEqual(Object.keys(app.CommunityProfileService.discoverable()).sort(), ['displayName', 'goal', 'interests', 'level', 'visibility']);
assert.throws(() => app.CommunityProfileService.save({ displayName: 'an@example.com', goal: '', interests: [], visibility: 'public' }), /Không chia sẻ/);

assert.equal(app.StudyGroupService.all().length, 3);
assert.ok(app.StudyGroupService.join('group-topik-1'));
assert.equal(app.StudyGroupService.mine()[0].id, 'group-topik-1');
app.StudyGroupService.leave('group-topik-1');
assert.equal(app.StudyGroupService.mine().length, 0);

assert.equal(app.ChallengeEventService.current().progress, 0);
app.ChallengeEventService.join('challenge-hangul-30');
const firstCheckIn = app.ChallengeEventService.checkIn('challenge-hangul-30');
assert.equal(firstCheckIn.days.length, 1);
assert.equal(app.ChallengeEventService.checkIn('challenge-hangul-30').days.length, 1, 'one check-in per day');
assert.equal(app.ChallengeEventService.checkIn('challenge-hangul-30', '2020-01-01'), null, 'past check-ins are rejected');

assert.equal(app.SharedAchievementService.available().length, 2);
assert.equal(app.SharedAchievementService.share('first-hangul', 'groups').status, 'local-preview');
assert.equal(app.SharedAchievementService.share('missing', 'groups'), null, 'only earned milestones can be shared');
assert.equal(app.SharedAchievementService.share('started-learning', 'public'), null, 'public sharing is not enabled');

assert.equal(app.PeerPracticeService.available().length, 4);
assert.equal(app.LearningFriendService.toggle('peer-hana'), true);
assert.ok(app.PeerPracticeService.request('peer-hana', 'greeting'));
assert.equal(app.PeerPracticeService.requested('peer-hana').status, 'local-draft');
app.CommunitySafetyService.block('peer-hana');
assert.equal(app.PeerPracticeService.available().some((item) => item.id === 'peer-hana'), false);
assert.equal(app.LearningFriendService.follows('peer-hana'), false, 'blocking removes learning friend');
assert.equal(app.PeerPracticeService.requested('peer-hana'), null, 'blocking removes peer request');
assert.equal(app.LearningFriendService.toggle('peer-hana'), false, 'blocked profile cannot be followed');

const question = app.CommunityQuestionService.ask('grammar', 'Dùng 에 hay 에서?', 'Mình chưa rõ cách chỉ địa điểm.');
assert.equal(question.status, 'local-draft');
assert.equal(app.CommunityQuestionService.own().length, 1);
assert.throws(() => app.CommunityQuestionService.ask('vocabulary', 'Liên hệ tôi', 'Email learner@example.com'), /Không chia sẻ/);
const answer = content.questions[0].answers[0];
assert.equal(app.CommunityQuestionService.usefulCount(answer), answer.usefulCount);
app.CommunityQuestionService.rateUseful(answer.id);
app.CommunityQuestionService.rateUseful(answer.id);
assert.equal(app.CommunityQuestionService.usefulCount(answer), answer.usefulCount + 1, 'useful rating is counted once');

const report = app.CommunitySafetyService.report({ targetType: 'profile', targetId: 'peer-yun', reason: 'spam', details: 'Nội dung lặp lại.' });
assert.equal(report.status, 'local-pending');
assert.equal(app.CommunitySafetyService.reports().length, 1);
assert.equal(app.CommunityStatisticsService.snapshot().leaderboard, false);
assert.equal(app.CommunityStatisticsService.snapshot().ranking, null);
assert.equal(app.CommunityStatisticsService.snapshot().dataStatus, 'local-account-only');
assert.deepEqual({ ...app.CommunityStatisticsService.snapshot().own }, { groups: 0, challengeDays: 1, questions: 1, practiceRequests: 0 });
assert.ok(a.syncEvents.every((event) => event === 'community'));

const b = boot('learner-b', shared);
assert.equal(b.window.CommunityProfileService.get().visibility, 'private', 'profile must be user scoped');
assert.equal(b.window.CommunityQuestionService.own().length, 0, 'questions must be user scoped');
assert.equal(b.window.CommunitySafetyService.reports().length, 0, 'reports must be user scoped');
assert.equal(b.window.SharedAchievementService.all().length, 0, 'achievement shares must be user scoped');
for (const route of ['community-hub','learning-community','study-groups','community-challenge','peer-practice','community-questions','community-profile','community-safety']) assert.equal(typeof app.KLEARN_EXTRA_VIEWS[route], 'function', `${route} is registered`);
assert.match(app.GlobalSearchService.search('nhóm học').studyTools[0].title, /Cộng đồng/);

for (const table of ['community_profiles','community_groups','community_group_members','community_challenges','community_challenge_participants','community_questions','community_answers','community_answer_ratings','community_learning_friends','community_peer_requests','community_achievement_shares','community_blocks','community_reports']) {
  assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`), `${table} must enable RLS`);
}
assert.match(migration, /default 'private'/);
assert.match(migration, /community_can_read_question\(question_id, auth\.uid\(\)\)/);
assert.match(migration, /revoke all on function public\.community_is_blocked/);
assert.match(migration, /No public leaderboard is created/);

console.log('community learning: groups, challenge, milestones, peer practice, Q&A, useful ratings, friends, privacy, safety and RLS passed');
