# P72D SOCIAL ENGAGEMENT REPORT

## 1. League

Korean Learning League has five readable tiers: Bronze, Silver, Gold, Platinum and Master. A learner's weekly tier uses only XP returned by the P72A server authority; pending offline XP is disclosed separately and cannot promote a tier.

## 2. Leaderboard

The weekly leaderboard calls `get_korean_learning_leaderboard`. The database derives totals from `learning_xp_events`, excludes quest/challenge/mission rewards and only includes opt-in nicknames. The client accepts only rows marked `server_verified`; when offline or the RPC is unavailable it shows no ranking instead of generating a fake board.

## 3. Friend Quest

Small groups of at most four learners can pursue a seven-day canonical-XP target. Local creation becomes a pending sync action. Other-member contributions are accepted only from server-verified progress, while the learner's unsynced contribution remains visibly pending.

## 4. Monthly Challenge

The first release offers 20 learning days or 1,000 valid Learning XP. Join state is user-scoped and offline-capable. Progress is derived from unique, valid P72A learning events and cannot be typed manually.

## 5. Side Quest

Four authored 1–3 minute quests cover listening, speaking, SRS recall and error repair. Completion requires matching learning-event evidence. Rewards are stored with their evidence IDs and `rankingEligible: false`, preventing reward loops from affecting League results.

## 6. Privacy

Leaderboard and profile visibility default to off and are controlled independently. Only nickname and a minimal level may be exposed. Email, token, real name, phone, location and detailed learning data never enter leaderboard output. Existing Community Safety block/report is reused, and mute is added as a user-owned control.

## 7. Anti-cheat

Duplicate event IDs, unknown activities, impossible XP, mismatched user IDs and unsynced/noncanonical XP are rejected. Server functions retain P72A idempotency, repetition limits and daily cap. Side rewards never qualify for ranking.

## 8. Tests

Validation completed on 13 September 2026:

- 68/68 automated contract and regression test files passed.
- P72D/P72E real-browser flow passed for canonical versus pending XP, privacy, Friend Quest, Monthly Challenge, Side Quest evidence, block/mute/report behavior and offline sync.
- Responsive checks passed at 360, 390, 430 and 1024 px with no horizontal overflow and touch targets at least 44 px.
- Wider regression checks passed at 768, 1024, 1440 and 1920 px through the P50 and P72A-P72C suites.
- P47 authentication/data isolation, P48 learning integrity, P49 offline/PWA and P49 performance tests passed.
- `git diff --check`, production-build verification and release-readiness verification passed.

Production content audits remain intentionally honest: they identify legacy items requiring human/native-speaker review and do not promote them to approved content.

## 9. Git SHA

The authoritative implementation SHA and `origin/main` push status are reported in the final delivery message because a commit cannot embed its own hash.
