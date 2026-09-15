# P73C REAL USER RETENTION REPORT

## 1. Learning Journey

The new evidence-first journey records milestones as `{ title, date, evidence, achievement }`. Day 1, 30, 90 and 180 are reference points only; account age or opening a screen never marks a milestone complete.

- Day 1: account start and Hangul evidence from the existing Foundation progress.
- Day 30: 500 vocabulary items mastered by the existing SRS.
- Day 90: a completed conversation attempt with a passing evidence score.
- Day 180: a qualifying TOPIK 2 practice record.

The timeline is not a hard lock. It keeps the learner's history and shows the next meaningful milestone without inventing progress.

## 2. Real Korean Missions

Real Korean Mission is separate from Daily Mission. Each mission has a goal, scenario, required skills, vocabulary, grammar, dialogue, submission and feedback. The authored tracks cover beginner self-introduction, intermediate ordering and advanced work email.

Seven approved scenarios are available: airport, restaurant, cafe, shopping, hospital, interview and office. Submission supports text and browser speech recognition; voice is converted to text and audio is never stored. If microphone support is absent, text input remains fully usable.

## 3. Conversation Memory

Mission attempts store the learner's submitted sentence, score, missing vocabulary, recurring grammar gaps and completion evidence. Weak attempts are forwarded to the existing Error Notebook, while sanitized learning signals are recorded in Long-term Learning Memory. Passwords, tokens, audio and unrelated private data are excluded.

## 4. Evidence Achievements

Achievements are unlocked only by learning evidence:

- Hangul Starter: at least five learned Hangul characters.
- First Conversation: one passing real-world conversation attempt.
- Vocabulary Builder 1000: 1,000 mastered SRS vocabulary items.

XP is intentionally excluded from achievement truth and cannot unlock these milestones.

## 5. Reflection

The reflection flow asks for the learner's next goal, current difficulty and recent achievement. Entries are user-scoped, retained locally/cloud-synced through the existing storage envelope and bridged to the existing Learning Journal when that service is available.

## 6. Return Loop

Home now provides one pressure-free return action. Recommendation order is evidence-based: due SRS review, unfinished lesson, suitable real Korean mission, then the next journey step. Copy avoids streak-loss pressure and explicitly supports short five-minute sessions.

## 7. Monthly Learning Report

The report shows study minutes, active days, new words, skill deltas and one improvement focus. Values come from Learning Activity, SRS timestamps, Learner Profile and Long-term Learning Memory snapshots. When evidence is insufficient, the UI says so instead of fabricating a percentage.

## 8. Integration and Data Safety

- Reuses SRS, Mastery-derived vocabulary status, Learner Profile, Error Notebook, Learning Memory, Learning Journal and CloudSync.
- Existing progress remains intact; no storage reset or destructive migration was added.
- User-scoped P73C data uses a bounded envelope and the existing CloudSync merge path.
- Content and UI are route-lazy loaded; scenario JSON and P73C assets are available to the service-worker offline cache.
- AI Coach behavior was not changed. Its view/render extension registration was made composable so it no longer deletes other route modules.

## 9. UX and Accessibility

The experience uses clear next actions, evidence labels, helpful empty states, keyboard-focusable native controls, polite live feedback, Korean language annotations, touch-friendly buttons and reduced-motion support. Dark mode is preserved. Responsive layouts use one column at 360/390/430 px, two at 768 px and three at 1024/1440/1920 px with no horizontal overflow.

## 10. Tests

- New-user test: only account-start evidence is present; later milestones do not unlock from page views.
- 30-day learner test: monthly minutes, active days and skill changes use supplied activity/memory evidence.
- 180-day learner test: 500-word, 1,000-word and TOPIK 2 outcomes require SRS/practice records.
- Mission test: passing and weak answers, Error Notebook bridge, conversation memory, no audio storage and unchanged SRS/progress.
- Reflection, monthly report, Return Loop, CloudSync merge, content quality gate and offline assets passed.
- Real browser: dark mode and no horizontal overflow passed at 360, 390, 430, 768, 1024, 1440 and 1920 px.
- Full repository regression: 71/71 test files passed.
- Production asset verification and release-readiness checks passed.

## 11. Remaining Risks

- Browser speech recognition availability and accuracy depend on the browser/device; text fallback remains the reliable baseline.
- Mission scoring is deterministic evidence matching, not a claim of native-speaker semantic assessment.
- Monthly skill deltas remain unavailable until at least two trustworthy improvement snapshots exist in that month.
- Production domain, Supabase environment variables and AI key require verification in the deployment environment.

## 12. Git SHA

The authoritative implementation SHA and `origin/main` push status are reported in the final delivery message because a commit cannot embed its own hash.
