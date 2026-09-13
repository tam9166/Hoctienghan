# P72A ENGAGEMENT CORE REPORT

## 1. XP system

Learning XP is an engagement metric only. Verified completion events from lessons, vocabulary practice, SRS, listening, speaking, writing, grammar, TOPIK, missions and challenges receive bounded XP. Every local event contains `event_id`, `user_id`, `activity_type`, `xp` and `created_at`; `reference_id`, sync state and anti-gaming metadata support validation and local-first synchronization. The interface explicitly states that XP is not Mastery, proficiency or a TOPIK score.

## 2. Score system

TamHoanq Korean Score is calculated deterministically from actual vocabulary, grammar, listening, reading, speaking and writing evidence. Each skill retains its own score and sample count. The aggregate excludes XP and AI judgment, reports confidence from evidence coverage, and displays “Chưa đủ dữ liệu” until at least four skills and six samples exist.

## 3. Quest system

The existing Daily Mission is extended rather than duplicated. Quest Engine derives daily, weekly, monthly and special quests with `id`, `type`, `objective`, `progress`, `target`, `reward` and `expires_at`. Rewards are restricted to XP, badges, cosmetics and streak protection. Claimed and expired states persist per user; rewards never alter Mastery.

## 4. Streak system

Streak Protection adds a maximum-three Freeze wallet and a Repair flow over verified learning dates. Freeze protects one eligible missed day and consumes an earned token. Repair requires a valid activity on the return day and has a 30-day cooldown. Neither path rewrites lesson history, SRS, Mastery or the legacy progress object.

## 5. Practice Center

Practice Center routes learners to the existing Error Notebook, SRS vocabulary review, grammar practice, Listening Studio, Speaking Practice, Writing, TOPIK and Quick Practice. Quick Practice offers continuous 5/10/15-minute sessions selected in priority order from due SRS, recent errors, Adaptive Engine weak skills and the current goal. It reuses the existing question bank and `PracticeService` instead of creating another learning engine.

## 6. Anti-gaming

The client accepts only recognized completion-event prefixes and checks locally available learning evidence for public calls. Event IDs are idempotent, lesson/mission/challenge/quest references are lifetime-once, repeated low-effort references have daily limits and diminishing rewards, and total XP is capped at 300 per UTC day. Supabase recomputes XP, uses an advisory transaction lock, validates reward/evidence shapes and blocks direct table writes. Client-supplied XP is never trusted.

## 7. Offline

XP, quests, claims and streak protection write first to user-scoped local storage. Pending rows are synchronized through idempotent Supabase RPCs when connectivity returns. Engagement state is included in existing CloudSync with an event-aware merge, so offline changes from different devices are unioned by stable identity instead of overwriting SRS, Mastery or progress.

## 8. Tests

- Focused unit coverage: XP calculation, duplicate/repetition rejection, fake-event rejection, deterministic ability score, Quest persistence/expiration, Freeze, Repair, Practice Center routing, offline queue, cloud RPC synchronization and user isolation.
- Real-browser coverage: Home entry point, both P72A routes, persistence after reload, dark mode and no horizontal overflow at 360, 768, 1024, 1440 and 1920 px.
- Supabase migration coverage: owner-only RLS reads, revoked direct writes, server-side canonical XP, idempotency, cooldown and evidence-gated quest rewards.
- Existing user progress and SRS are treated as immutable regression markers throughout P72A tests.
- Repository-wide regression passed: 64/64 unit suites.
- Nine real-browser suites passed: P72A plus safety/data integrity, learning integrity, offline/PWA, performance, product polish and P71A/P71B/P71C.
- Production build verification passed with 33 direct assets, 102 lazy assets and 3,044,269 referenced bytes. The local performance audit recorded 532 ms first-contentful paint, 819 ms load and 43 requests.
- Release-readiness and tracked-file secret scanning passed. Production domain and live Supabase migration smoke checks remain deployment-environment gates.

## 9. Remaining risks

- Supabase migrations must be deployed before server-authoritative XP synchronization becomes active; without cloud configuration the feature remains safely local-only.
- Browser Speech Recognition quality varies by device and language pack; XP records participation, while pronunciation ability continues to rely on the existing evidence model.
- Quest periods use UTC for deterministic cross-device deduplication. A future release may add an explicitly stored learner timezone without changing existing event IDs.
- Cosmetic inventory is architecture-ready but this phase intentionally adds no character, adventure, story, radio, league or friend quest.

## 10. Git SHA

- Commit: `feat: add engagement core system`
- SHA: reported from Git after commit.
- Push: `origin/main` after all validation gates pass.
