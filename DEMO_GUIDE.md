# Demo guide

## 1. Demo principles

- Use the built-in **demo account**; do not enter a real email, password or learner data.
- Present verified behavior, not roadmap foundations as finished services.
- Keep one theme and viewport for a coherent presentation.
- Explain offline/cloud/AI boundaries explicitly.
- Reset only the demo namespace between sessions.

Detailed implementation notes are in [`docs/P54_DEMO_PRESENTATION.md`](docs/P54_DEMO_PRESENTATION.md).

## 2. Preparation

1. Serve the current commit locally or use an authorized preview deployment.
2. Open the app online once so core PWA assets can install.
3. From Welcome, choose **Xem bản demo** → **Vào bản demo**.
4. Choose light mode for screenshots or the theme suited to the projector; do not switch mid-demo.
5. In Demo Center, restore synthetic sample data.
6. Check Home, Learning, TOPIK, Trợ lý học tập, Analytics and Profile.
7. Test refresh. Test offline separately before the audience session.

Recommended presentation viewport: `1440 × 900`.
Recommended mobile proof: `390 × 844`.

## 3. Canonical flow

```text
Welcome
  → Demo account
  → Home: today’s next action
  → Learning: Hangul-to-TOPIK path
  → Lesson/practice: evidence saved
  → Trợ lý học tập: optional contextual help
  → Analytics/outcomes: measured progress and unavailable states
  → Profile: privacy, cloud and learning preferences
```

## 4. Five-minute script

| Time | Screen | Talking point |
|---|---|---|
| 0:00–0:40 | Landing | Vietnamese-first problem and positioning. |
| 0:40–1:40 | Home | One clear next action; not a feature dashboard. |
| 1:40–2:40 | Learning | Level 0 → TOPIK path and lesson evidence. |
| 2:40–3:35 | Review | SRS cards activate only after learning; due review. |
| 3:35–4:20 | Trợ lý | Optional help uses bounded learner context and fallback. |
| 4:20–5:00 | Outcomes | Show measured evidence; state what has not been measured. |

Closing sentence: “TamHoanq connects a Vietnamese-first learning path, the next action today and evidence of progress; AI and cloud assist the journey but do not replace it.”

## 5. Ten-minute script

1. **0–1 min — Problem:** beginners do not know where to start; returning learners do not know what to review.
2. **1–2 min — Landing/onboarding:** three questions choose goal, level and daily time.
3. **2–4 min — Home:** today plan, due words, recent mistake and continue lesson.
4. **4–5 min — Lesson:** Korean text, Vietnamese explanation, practice and stored completion.
5. **5–6 min — SRS/Error Notebook:** correct/incorrect evidence changes future review.
6. **6–7 min — TOPIK:** curriculum/practice path; clarify mock scores are not official.
7. **7–8 min — Trợ lý:** consent, contextual explanation and no-AI fallback.
8. **8–9 min — Analytics/outcomes:** skills, retention and missing-baseline guardrail.
9. **9–10 min — Architecture:** local-first, optional Supabase and tagged deployment.

## 6. Twenty-minute script

1. **0–2 min:** target user and product positioning.
2. **2–4 min:** onboarding paths for zero beginner, Hangul reader and TOPIK learner.
3. **4–7 min:** Level 0 lesson, syllable/handwriting and checkpoint flow.
4. **7–10 min:** SRS state, mastery evidence, Error Notebook and daily mission.
5. **10–12 min:** listening/speaking/writing limitations and fallbacks.
6. **12–14 min:** TOPIK practice, strategy and outcome tracking.
7. **14–16 min:** contextual assistant, privacy and provider failure.
8. **16–18 min:** local/cloud sync, revision conflict and offline queue.
9. **18–19 min:** CI, release candidate, monitoring/runbooks.
10. **19–20 min:** honest limitations and next validation milestone.

## 7. Architecture explanation for a technical audience

Use this 45-second version:

> The UI is a vanilla JavaScript static SPA. Learning data writes to user-scoped localStorage first. Route modules are lazy-loaded and core assets are available through a service worker. When a learner links Supabase Auth, a bounded JSONB snapshot syncs through a compare-and-swap RPC with revision and mutation IDs. Optional AI goes through a Vercel serverless endpoint with consent, context bounds and fallback. GitHub Actions validates source, assets and contracts before tagged Vercel deployment.

## 8. Screenshot sequence

Use the reproducible assets/process in [`docs/screenshots/README.md`](docs/screenshots/README.md):

1. Landing.
2. Home.
3. Learning path.
4. Grammar/lesson.
5. TOPIK.
6. Trợ lý học tập.
7. Analytics/outcomes.
8. Profile/privacy.

## 9. Failure plan

| Failure | Demo response |
|---|---|
| AI key/network unavailable | Show controlled fallback and continue with lesson/dictionary. |
| Supabase unavailable | Explain local-first; progress remains on device. |
| Microphone unsupported | Use text fallback; do not claim acoustic phoneme analysis. |
| Stale service worker | Use a fresh isolated browser profile; do not clear a real user profile. |
| Route asset failure | Return Home and use prepared screenshots; record issue after demo. |

## 10. Claims checklist

- Say “release candidate”, not “production ready”.
- Say “Capacitor shell and unsigned validation pipeline”, not “published mobile app”.
- Say “foundation” for teacher/community/marketplace/payment/global-language areas.
- Say “optional AI assistance”, not “AI guarantees correct Korean”.
- Say “automated regression pass”, not “bug free”.
- Do not claim learning improvement without real before/after data.
