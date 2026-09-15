# P73A USER ACTIVATION REPORT

## 1. Registration redesign

Registration now presents one user-facing action: **Tạo tài khoản**. The onboarding flow no longer asks a learner to choose between local, cloud, sync or database concepts. A new account attempts protected cloud registration by default and keeps a local, recoverable account when the provider is unavailable.

When prior device progress exists, the screen states **“Chúng tôi tìm thấy tiến trình học trước đây.”** and offers **Tiếp tục tiến trình** or **Bắt đầu mới**. Continuing routes to the existing identity. Starting new only dismisses the recovery suggestion; it does not delete, reset or overwrite the prior profile. Explicit cloud linking preserves the original local user ID, so the same learner is not duplicated during migration.

## 2. Beginner flow

The first-time journey is exactly three decisions:

1. Goal: TOPIK, Conversation, Study abroad, Work or Travel.
2. Level: no Hangul, reads Hangul slowly or has studied the basics.
3. Daily time: 5, 15 or 30 minutes.

The choices persist after every step. A learner who selects no Hangul enters the existing Level 0 foundation instead of Placement/TOPIK testing.

## 3. First 7 days

The Beginner Zero presentation now provides seven small evidence-based days: vowels, consonants, syllable building, batchim, first-word reading, handwriting and a first sentence. Opening a screen does not complete a day. Completion is derived from existing Foundation, Handwriting and SRS evidence.

## 4. Home UX

Foundation learners receive one primary action for today, the seven-day sequence and a progress story. AI, analytics, score and league panels are withheld from this beginner Home. Intermediate and TOPIK learners continue to receive the standard personalized dashboard.

## 5. Progress Story

The system captures a non-destructive baseline and turns real Foundation/SRS evidence into statements such as the number of Hangul characters and words learned since starting. It never fabricates an earlier skill level or deletes historical data.

## 6. Testing

- New user, returning user, prior-device progress and explicit cloud-link flows passed.
- The 3-step onboarding and Level 0 routing passed.
- Evidence-based Day 1 → Day 7 progression and reload persistence passed.
- Existing progress marker and user count remained intact; explicit cloud linking did not duplicate the account.
- Dark mode, touch targets and no horizontal overflow passed at 360, 390, 430, 768, 1024, 1440 and 1920 px.
- Repository contracts passed 70/70. Critical Auth/privacy, learning integrity, offline/PWA, Product UX, P71A/P71B and P73A/P73B browser suites passed after integration.

## 7. Remaining risks

- Default cloud protection depends on the production Supabase configuration and email-confirmation policy. When unavailable, the local credential remains usable and is marked for a later protection retry.
- “Bắt đầu mới” is deliberately non-destructive. A future product decision may add an explicit archived-profile workflow, but it must not silently erase prior progress.

## 8. Git SHA

The authoritative implementation SHA and `origin/main` push status are reported in the final delivery message because a commit cannot embed its own hash.
