# P78 — Vercel Hobby Function Optimization Report

Status: completed and verified on Vercel Production
Repository: `tam9166/Hoctienghan`
Baseline commit: `24c1a879da74203e2aa7fe22387661cf1f6054ad`
Implementation commit: `5455d655ca4b1b706bcfc98781ffc20bc2955825`

## 1. Root cause

The repository uses Vercel Functions directly without a framework. Vercel maps each eligible JavaScript file under `api/` to one Function. Files whose basename starts with `_` are ignored as utility files, but ordinary helper files are not.

The audited tree contains 24 JavaScript files under `api/`:

- 7 underscore-prefixed utility files ignored by Vercel.
- 15 intentional HTTP handlers.
- 2 internal payment-provider modules (`api/billing/providers/index.js` and `api/billing/providers/mock.js`) that are imported as helpers but are also eligible Function entrypoints.

Therefore Vercel detects 17 Functions, exceeding the Hobby direct-runtime limit of 12. `vercel.json` does not create the extra Functions; its current `functions` block only changes duration for four existing entrypoints.

The failed production deployment for `origin/main` commit `fa167db9aee3e569c24c0e7a289e05d18cb273c1` is `dpl_BnYd64qBNHFk7zSmSBgQdpyajzjz`. GitHub records Vercel status `failure` with the Function-limit failure supplied in the task.

## 2. Function count before

**17 Vercel Functions.**

Count method: every `.js` file below `api/` minus files whose basename begins with `_`, following Vercel's documented utility-file rule.

## 3. Function list before

1. `api/ai/feedback.js`
2. `api/billing/cancel.js`
3. `api/billing/checkout.js`
4. `api/billing/entitlements.js`
5. `api/billing/providers/index.js` — internal helper accidentally eligible as a Function
6. `api/billing/providers/mock.js` — internal helper accidentally eligible as a Function
7. `api/billing/trial.js`
8. `api/chat.js`
9. `api/commerce/access.js`
10. `api/commerce/catalog.js`
11. `api/commerce/course.js`
12. `api/commerce/dashboard.js`
13. `api/commerce/purchase.js`
14. `api/commerce/purchases.js`
15. `api/config.js`
16. `api/health.js`
17. `api/version.js`

Ignored utility files, correctly not deployed as Functions:

- `api/_ai-quality.js`
- `api/_cors.js`
- `api/_rate-limit.js`
- `api/_release.js`
- `api/billing/_shared.js`
- `api/billing/providers/_interface.js`
- `api/commerce/_shared.js`

## 4. Function count after

**7 Vercel Functions (7/12).**

The count is enforced by `scripts/vercel-function-audit.js`, the CI workflow and the protected production-deployment workflow. The pushed implementation also completed a Vercel Production deployment successfully, resolving the baseline limit failure.

## 5. Function list after

1. `api/ai/feedback.js`
2. `api/billing.js`
3. `api/chat.js`
4. `api/commerce.js`
5. `api/config.js`
6. `api/health.js`
7. `api/version.js`

## 6. Functions consolidated

Billing domain consolidation:

- `/api/billing/cancel`
- `/api/billing/checkout`
- `/api/billing/entitlements`
- `/api/billing/trial`

These contracts route through `api/billing.js` to allowlisted, underscore-prefixed domain handlers ignored as Function entrypoints by Vercel.

Commerce domain consolidation:

- `/api/commerce/access`
- `/api/commerce/catalog`
- `/api/commerce/course`
- `/api/commerce/dashboard`
- `/api/commerce/purchase`
- `/api/commerce/purchases`

These contracts route through `api/commerce.js` to allowlisted, underscore-prefixed domain handlers ignored as Function entrypoints by Vercel.

## 7. Functions kept separate

- `api/chat.js`: OpenAI key boundary, AI consent, quality policy, optional entitlement quota and longer duration.
- `api/ai/feedback.js`: authenticated AI evaluation write, independent from generation failures and duration.
- `api/config.js`: deliberately exposes only validated public Supabase URL/publishable key.
- `api/health.js`: operational dependency probe with health-specific status/cache semantics.
- `api/version.js`: public release metadata with short public caching.
- `api/billing.js`: subscription/payment domain and shared authentication/rate limiting.
- `api/commerce.js`: marketplace/creator/purchase domain and shared authentication/rate limiting.

## 8. Functions removed and evidence

No feature or API contract was removed.

The two accidental provider entrypoints were renamed as underscore-prefixed utility modules:

- `api/billing/providers/_index.js`: only imported by checkout and the payment infrastructure test; no frontend fetch, configuration route or deployment requirement targets it.
- `api/billing/providers/_mock.js`: only imported by the provider registry and payment infrastructure test; no frontend fetch, configuration route or deployment requirement targets it.

The existing billing and commerce handlers were renamed with underscore-prefixed basenames under their original domain folders. They remain bundled dependencies of the two routers but are no longer individual Functions. Source callers and regression tests prove all ten public contracts remain active and routable.

No client-side conversion is planned. References to `/api/billing/portal`, `/api/billing/coupons/validate`, `/api/billing/referrals/attribute` and `/api/marketplace/checkout` are declarative future configuration only; no corresponding Function exists today, and this task will not implement them.

## 9. API contract changes

External contract change: **none**.

The same public paths, methods, request bodies, query parameters, status codes and response shapes are preserved by ten exact Vercel rewrites and allowlisted internal dispatch. Frontend callers were not edited. Unknown or path-traversal-like action values return `404` and cannot dynamically load modules.

## 10. Security verification

Audit findings:

- `OPENAI_API_KEY` is read only by `api/chat.js`.
- Supabase service-role credentials are not used by these Functions and are not present in client code.
- Public config validates that the Supabase key is publishable/anon before returning it.
- Billing/commerce authenticate the Bearer token against Supabase Auth.
- Authorization remains enforced by user-token RLS and role-checking RPC functions.
- Admin and teacher dashboards delegate to role-gated `p77_admin_business_dashboard` and `p77_teacher_business_dashboard` RPCs.
- Creator course updates require `owner_id = auth.user.id` and draft/rejected status.
- AI consent, privacy rejection, AI quota claim, response safety checks and rate limiting are server-side.
- No security boundary is eligible for client-side relocation.

Post-refactor regression passed for anonymous rejection, AI consent, config-key validation, method restrictions, owner filtering and teacher/admin RPC routing. Existing P67/P77 security and payment suites also passed.

## 11. P79 compatibility

P79 Vocabulary Immersion added no Vercel Function and is local-first. Its unit suite and responsive real-browser regression passed, including 17 topics, shared SRS, personal collections, offline packs, progress preservation and 320–1440 px layouts.

## 12. P80 compatibility

P80 TOPIK Exam Intelligence added no Vercel Function. Its question bank, mock scoring, analysis and Error Notebook bridge are client-side; optional report prose reuses the existing privacy-gated AI path through `/api/chat`. Its unit suite and responsive real-browser regression passed, including all 44 questions, smart 5/10/5 generation, scoring, error sync, history/SRS preservation, offline bank and 320–1440 px layouts.

## 13. Test results

- `80/80` unit/static test files passed.
- `265` JavaScript files passed `node --check`.
- New P78 contract test passed: exact 7-Function list, all ten rewrites, allowlisted routing, authentication, AI consent, public-key validation and owner/role boundaries.
- Existing P67/P77 monetization, entitlement and payment infrastructure tests passed.
- P77, P79 and P80 real-browser regressions passed across mobile, tablet and desktop widths.
- `git diff --check` passed.

## 14. Production build result

- `node scripts/vercel-function-audit.js`: passed, `7/12`.
- `node scripts/verify-production-build.js`: passed, 35 direct and 126 lazy assets validated.
- `node scripts/release-readiness.js`: passed, including tracked-file secret scanning.
- `mobile/npm run build`: passed for version `1.5.0-rc.1`.
- GitHub CI validation for the implementation SHA: passed.

## 15. Vercel deployment result

- Baseline production deployment: failed because 17 detected Functions exceeded the Hobby limit of 12.
- Implementation deployment: **success — Deployment has completed**.
- Git SHA: `5455d655ca4b1b706bcfc98781ffc20bc2955825`.
- GitHub deployment ID: `6549530699`.
- Vercel deployment: `https://hoctienghan-gvsrn6c2o-tam9166s-projects.vercel.app`.
- Vercel dashboard result: `https://vercel.com/tam9166s-projects/hoctienghan/68rXyH4nKmF1qupDVJEtRYfxXJQN`.

The production URL currently has Vercel Deployment Protection enabled. Anonymous endpoint smoke requests are intercepted by Vercel authentication before reaching the Functions; deployment readiness is therefore verified from the successful Vercel/GitHub deployment state, while application-level public-domain smoke remains an operational follow-up.

## 16. Remaining risks

- Vercel Deployment Protection prevents anonymous production endpoint smoke testing until an authorized bypass or public canonical production domain is configured.
- The repository `PRODUCTION_URL` variable remains unconfigured, so scheduled canonical-domain monitoring cannot prove public availability.
- In-memory rate limiting retains its pre-existing per-instance limitation; consolidation neither weakens nor fixes that architecture.
- Any future non-underscore `.js` file below `api/` must be intentionally added to the seven-entry allowlist or the new CI budget check will fail.

## 17. Final Git SHA

Implementation SHA: `5455d655ca4b1b706bcfc98781ffc20bc2955825`. The documentation-only report commit follows this verified implementation commit on `main`.

## 18. References

- [Vercel Functions runtimes and `api` entrypoints](https://vercel.com/docs/functions/runtimes)
- [Vercel advanced configuration and underscore utility files](https://vercel.com/docs/functions/configuring-functions/advanced-configuration)
- [Vercel rewrites](https://vercel.com/docs/routing/rewrites)
