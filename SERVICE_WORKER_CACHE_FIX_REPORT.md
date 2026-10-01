# Service Worker Cache Fix Report

Date: 2026-10-01

## Scope

This change addresses only stale production JavaScript/CSS assets served by the
Service Worker. No learning, quota, Supabase, database, RLS, authentication, or
UI source logic was changed.

## Root cause

The deployed worker used the fixed cache key `klearn-v105` and a cache-first
strategy for application JavaScript and CSS. When a deployment reused an asset
URL such as `app.js?v=89`, an existing profile could continue executing the old
cached asset indefinitely even though the network asset had changed.

## Fix

- Bumped the application cache to `klearn-v106`.
- Activation removes only caches matching the app-owned `klearn-v<number>`
  pattern. Offline pack caches (`klearn-pack-*`) and unrelated caches are kept.
- Application `.js` and `.css` requests are now network-first and write a
  successful response to the current app cache. If the network is unavailable,
  the last cached response is used.
- Existing `skipWaiting()` and `clients.claim()` lifecycle behavior remains in
  place.
- No localStorage or learning IndexedDB data is deleted by activation.

## Local verification

- 94/94 repository tests: PASS
- Production asset/readiness checks: PASS
- Vercel Function audit: 7/12, PASS
- `node --check sw.js`: PASS
- `git diff --check`: PASS
- Secret scan: PASS (no secret values or private keys found)
- Service Worker simulation: PASS
  - legacy `klearn-v105` removed
  - `klearn-pack-*` and unrelated cache retained
  - JS network-first response used online
  - cached response used offline

## Production verification

- Production domain: https://hoctienghan-eight.vercel.app
- Deployed commit: `c1cd19928e49`
- `/`: HTTP 200
- `/api/version`: HTTP 200, commit `c1cd19928e49`
- `/api/health`: HTTP 200, `status=ok`, database `ok` (5/5 repeated checks)
- `/manifest.json`: HTTP 200
- `/sw.js`: HTTP 200, contains `klearn-v106`, `Cache-Control: no-store`
- `/app.js?v=89`: HTTP 200 and contains the current quota recovery UI
- `/data/production-stability.js?v=5`: HTTP 200 and contains current recovery logic
- No secret or stack-trace leak observed in production responses

## Existing-profile regression

The browser profile that previously rendered the stale quota message was
reloaded after deployment. It now renders the new message with “Xuất bản sao
lưu”; the old “Hãy thử lại hoặc mở Quản lý dữ liệu” text is absent. Existing
learning state remained visible (streak, SRS count, progress and route state).

## Fresh-profile and offline checks

- Fresh production tab: Home rendered successfully with zero console errors.
- Offline reload using browser network emulation: app shell, Home route and
  learning content rendered from the Service Worker cache.
- Expected quota warnings from the intentionally full existing local storage
  profile were observed; they did not delete learning data and are unrelated to
  the Service Worker fix.

## Final status

Overall: **PASS**

- Cache invalidation: PASS
- Update lifecycle: PASS
- Existing profile refresh: PASS
- Learning data safety: PASS
- Offline fallback: PASS
- Quota recovery UI visibility after refresh: PASS
- Learning Intelligence regression: PASS (existing profile state preserved)
- Production health: PASS

