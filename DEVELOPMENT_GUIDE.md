# Development guide

## 1. Repository layout

| Path | Purpose |
|---|---|
| `index.html`, `app.js`, `styles.css` | Core SPA shell, state/services and design system |
| `data/` | Content data, feature services and route extensions |
| `content/` | JSON content/config used by modules |
| `locales/` | Vietnamese, English and Simplified Chinese UI resources |
| `api/` | Vercel Serverless endpoints/helpers |
| `supabase/` | Core schema and chronological migrations |
| `mobile/` | Capacitor shell and native build tooling |
| `tests/` | Static/contract and Edge browser tests |
| `scripts/` | Build/readiness/smoke/audit tooling |
| `docs/` | Phase reports, production runbooks and screenshots |

## 2. Prerequisites

- Git.
- Node.js 22 (matches CI).
- Python 3 for a simple static development server, or another static server.
- Microsoft Edge for `*.browser.js` responsive tests on Windows.
- Vercel CLI only when testing `/api/*` locally.
- Supabase CLI only when maintaining/applying database migrations in an authorized project.

The root web app intentionally has no `package.json`; do not run `npm test` at repository root. The only npm project is [`mobile/package.json`](mobile/package.json).

## 3. Clone and run the web app

```powershell
git clone https://github.com/tam9166/Hoctienghan.git
Set-Location Hoctienghan
python -m http.server 8080
```

Open `http://127.0.0.1:8080/`.

This mode serves the SPA/PWA only. `/api/config`, `/api/chat`, `/api/health` and `/api/version` will return 404 because Python is not a serverless runtime. Core local learning should still work.

## 4. Run with serverless APIs

1. Copy variable names from `.env.example` into local Vercel environment configuration.
2. Add only values for projects you own.
3. Run:

```powershell
npx --yes vercel@latest dev
```

Never commit the generated `.env` files or `.vercel` credentials.

## 5. Environment variables

| Variable | Required | Purpose |
|---|---:|---|
| `SUPABASE_URL` | Optional for local-only | HTTPS Supabase project URL |
| `SUPABASE_ANON_KEY` | Optional for local-only | Publishable/anon client key |
| `OPENAI_API_KEY` | Optional | Server-side AI provider key |
| `OPENAI_MODEL` | Optional | Shared fallback model |
| `OPENAI_SMALL_MODEL` | Optional | Low-cost/simple task route |
| `OPENAI_STRONG_MODEL` | Optional | Complex task route |
| `PRODUCTION_URL` | Operations | Canonical URL for smoke/monitoring |
| `MOBILE_ALLOWED_ORIGINS` | Optional | Comma-separated exact HTTPS mobile origins |
| `MOBILE_API_BASE_URL` | Mobile release | HTTPS server API base |

## 6. Build contract

The root application is static and has no compilation step. Validate its production asset graph with:

```powershell
node scripts/verify-production-build.js
node scripts/release-readiness.js
```

These commands check asset references, lazy-load separation, release artifacts, headers, env contract and common tracked-secret patterns. They do not deploy.

## 7. Tests

### All static/contract tests — PowerShell

```powershell
$failed = @()
Get-ChildItem tests -Filter '*.test.js' | Sort-Object Name | ForEach-Object {
  node $_.FullName
  if ($LASTEXITCODE -ne 0) { $failed += $_.Name }
}
if ($failed.Count) { throw "Failed: $($failed -join ', ')" }
```

### CI equivalent — bash

```bash
for file in tests/*.test.js; do node "$file"; done
```

### Syntax

```powershell
Get-ChildItem api,data,scripts,tests -Recurse -Filter *.js |
  ForEach-Object { node --check $_.FullName }
```

### Responsive browser smoke

Start the static server, then:

```powershell
node tests/p50-product-polish-responsive.browser.js http://127.0.0.1:8080/
```

Browser tests use isolated temporary profiles and synthetic data. Do not point scripts that mutate localStorage at a browser profile containing real user data.

## 8. Mobile shell

```powershell
npm ci --prefix mobile
npm run build --prefix mobile
npm run doctor --prefix mobile
```

Generated `mobile/www`, `mobile/android` and `mobile/ios` are not source-of-truth directories. Follow [`mobile/README.md`](mobile/README.md) for native project generation and signing boundaries.

## 9. Database development

- Add a chronological SQL file under `supabase/migrations/`.
- Make it additive/idempotent where practical.
- Include RLS and grants in the same migration.
- Do not use client-provided roles for authorization.
- Test in a disposable/staging Supabase project before production.
- Never place project/service credentials in SQL or Markdown.

## 10. Adding or changing a route module

1. Keep core boot assets small.
2. Add module CSS/JS to the appropriate group in `data/route-loader.js`.
3. Register view through the established extension hooks.
4. Add optional asset to `sw.js` only when offline behavior requires it.
5. Bump query-string asset version when cached content changes.
6. Add a static test and a browser test for risky UI flows.

## 11. Debugging

### Blank route

- Check browser console for route-loader failure.
- Confirm every referenced asset exists.
- Run `node scripts/verify-production-build.js`.

### Cloud unavailable

- Call `/api/config` and confirm `configured` status.
- Check browser network request and Supabase project settings.
- Verify only publishable/anon key is used.
- Core local learning should remain available.

### Sync conflict

- Inspect local sync metadata/revision without copying tokens.
- Confirm RPC migration `20260907_p47_safety_data_integrity.sql` is applied.
- Preserve local data before attempting recovery.

### AI unavailable

- Check AI privacy preference.
- Verify `/api/chat` returns 503 (unconfigured), 403 (disabled), 429 (limited) or 502 (provider).
- Do not place provider key in frontend to bypass server setup.

### Stale PWA

- Confirm `sw.js` changed when cached asset URLs change.
- Verify query-string versions in `index.html` and service worker match.
- Test with an isolated browser profile before asking users to clear data.

## 12. Deploy

Production deployment is defined in `.github/workflows/deploy-production.yml` and uses Vercel secrets. Follow [`docs/production/RELEASE_CHECKLIST.md`](docs/production/RELEASE_CHECKLIST.md); do not manually declare production readiness from local tests alone.
