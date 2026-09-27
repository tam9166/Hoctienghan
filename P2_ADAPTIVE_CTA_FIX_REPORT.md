# P2 Adaptive CTA Fix Report

Date: 2026-09-27

## Scope

This report covers only the P2 production-validation finding where the Adaptive Assistant CTA opened `daily-session` without creating a usable learning session. P1 health, Supabase schema, RLS, migrations and unrelated modules were not changed.

## Root cause

The Assistant summary CTA used `data-view="daily-session"`. The click only changed the route; it did not call `DailyLearningSessionService.sessions.start()`. The session view then saw no active session and rendered the dead-end `Chưa có phiên đang chạy` state. The existing Home CTA worked because it started the session before navigating. A second production edge was that the `daily-session` deep-link was not registered with the route loader, so a fresh reload could omit the existing `FocusSessionService` dependency.

## Fix

- `DailyLearningSessionService.sessions.active()` now rejects empty or malformed sessions.
- Opening `daily-session` without an active/completed session now materializes the existing `DailyPlanService` plan locally.
- The start path validates that the plan and every task are actionable before saving it.
- If content or the session provider is unavailable, the UI shows an explicit empty state with safe recovery actions; it does not invent or hardcode a lesson.
- `daily-session` is now registered as a route-loader group with the existing `practical` dependency, so direct navigation/reload hydrates the Focus Session service before rendering.
- The Daily Session asset query was bumped from `v=7` to `v=8` in `index.html` and `sw.js` so installed PWAs receive the fix.

## Evidence

### Local

- 94/94 `tests/*.test.js`: PASS.
- `node tests/adaptive-personal-learning-assistant-responsive.browser.js`: PASS at 320, 360, 390, 430, 768, 1024, 1440 and 1920 px.
- Browser regression covers both the Home one-click start and the Adaptive Assistant CTA, asserting a non-empty session and no empty-state copy.
- New unit coverage verifies new user, unavailable provider fallback, stale empty active session replacement and completed-session preservation.
- Route-loader regression coverage verifies that direct `daily-session` navigation loads `practical` and the Daily Learning asset.
- Build/readiness: PASS (`verify-production-build.js`, `release-readiness.js`).
- Vercel function audit: PASS, 7/12 functions.
- `git diff --check`: PASS.
- Release-readiness tracked-file secret scan: PASS; no new secret or stack-trace output.

### Production

Canonical domain: https://hoctienghan-eight.vercel.app

- GitHub/Vercel deployment for final code commit `2b6acb9`: success.
- `/`: HTTP 200, app HTML (not Vercel Protection).
- `/api/version`: HTTP 200, production commit `8e69ae26f109`.
- `/api/health`: HTTP 200; `status=ok`, `backend=ok`, database status `ok`; AI remains the documented unconfigured degraded feature.
- `/manifest.json`: HTTP 200.
- `/sw.js`: HTTP 200 and references `daily-learning-experience.js?v=8`.
- After logging out and entering a fresh demo session, the production browser flow opened Trợ lý → `Học theo kế hoạch hôm nay` and reached `#daily-session` with a 15-minute session containing 4 actionable tasks: SRS, Listening, Error Notebook repair and the next lesson. No `Chưa có phiên đang chạy` or `Chưa có nội dung phù hợp` state was rendered.
- The canonical route-loader response contains the new `dailyExperience` registration; the production CTA was then verified from a fresh demo session after the deployment.
- Production response scan found no service-role/private-key material or stack trace in the checked app/API/PWA responses.

## Git

- Fix commits: `8e69ae2` — `fix: prevent empty adaptive learning sessions`; `2b6acb9` — `fix: load adaptive session dependencies on direct route`
- Pushed to `origin/main`.
- Pre-existing untracked validation/audit reports were left untouched and are not part of this fix.

## Result

Overall: PASS

P0: PASS — no P0 regression found.
P1: PASS — existing production health check remains HTTP 200 with database ok.
P2: PASS — Adaptive CTA now produces a usable, non-empty session; explicit fallback remains available.
P3: PASS — responsive/browser regression and local regression remain green.

Production Domain: https://hoctienghan-eight.vercel.app
Deployed Commit: `2b6acb9`
Deployment: SUCCESS
Runtime: PASS
Adaptive CTA: PASS
Fallback: PASS (local unit coverage)
Offline/PWA asset refresh: PASS (service-worker asset reference verified)
Supabase/RLS/Database changes: NONE
