# API documentation

## 1. Overview

The web app uses same-origin Vercel Serverless Functions under `/api`. All current handlers are CommonJS modules in [`api/`](api/). JSON responses are used throughout.

Base URL:

- Local static server: API is unavailable (`python -m http.server` only serves files).
- Local serverless development: use Vercel CLI.
- Production: same origin as the deployed PWA unless mobile `MOBILE_API_BASE_URL` points to an approved HTTPS origin.

## 2. Common behavior

### CORS

`api/_cors.js` allows Capacitor origins `capacitor://localhost` and `https://localhost`, plus exact HTTPS origins from `MOBILE_ALLOWED_ORIGINS`. Allowed preflight requests receive a 204 response. Same-origin browser calls do not require CORS headers.

### Rate limiting

Current rate limits are IP-based in-memory buckets. They protect a single warm serverless instance and must not be described as a distributed abuse-prevention service.

### Cache

`vercel.json` applies `Cache-Control: no-store, max-age=0` to `/api/*`; `/api/version` sets a more specific public 60-second cache header in its handler.

## 3. `GET /api/config`

Returns only validated public cloud configuration.

Authentication: none.
Rate limit: 30 requests/minute/IP bucket.
Cache: no-store.

### Response — configured

```json
{
  "configured": true,
  "supabaseUrl": "https://PROJECT.supabase.co",
  "supabasePublishableKey": "sb_publishable_..."
}
```

Legacy JWT-style anon keys are accepted only when the decoded role is `anon`.

### Response — not configured

```json
{ "configured": false }
```

### Errors

| Status | Meaning |
|---|---|
| 405 | Method is not GET. |
| 429 | Rate limit exceeded; includes `retryAfterSeconds`. |

Secrets such as service-role or OpenAI keys are never returned.

## 4. `POST /api/chat`

Provides optional learning assistance. It is not a public curriculum endpoint.

Authentication: no Supabase JWT validation in the current handler.
Consent: required through both `X-KLearn-AI-Consent: granted` and `privacy.aiEnabled: true`.
Rate limit: 40 requests/minute/IP bucket.
Maximum messages: 12 recent `user`/`assistant` messages.
Maximum message text: 4,000 characters each.
Maximum serialized learner context: 9,000 characters.

### Request

```json
{
  "task": "grammar",
  "modelRoute": "strong",
  "promptVersion": "p26-v1",
  "learningLanguage": "vi",
  "messages": [
    { "role": "user", "content": "Giải thích 은/는 ngắn gọn." }
  ],
  "learnerContext": {
    "level": "Beginner",
    "weakGrammar": ["topic-particle"]
  },
  "privacy": { "aiEnabled": true }
}
```

Supported tasks are allowlisted in `api/chat.js`. Unknown tasks fall back to `tutor`; model route is limited to `small` or `strong`.

### Response — success

```json
{
  "reply": "...",
  "usage": {
    "inputTokens": 120,
    "outputTokens": 220,
    "totalTokens": 340
  },
  "modelRoute": "strong",
  "promptVersion": "p26-v1"
}
```

The provider request uses the OpenAI Responses API and `store: false`.

### Errors

| Status | Body/condition |
|---|---|
| 400 | Missing final user message or sensitive-pattern filter rejection. |
| 403 | AI disabled by user (`AI_DISABLED_BY_USER`). |
| 405 | Method is not POST. |
| 429 | Too many requests; `Retry-After` header. |
| 502 | Provider error, unavailable provider, empty/filtered output. |
| 503 | `OPENAI_API_KEY` not configured. |

### Security limitation

Consent flags are privacy controls, not user authentication. Before exposing paid or user-metered AI, add trusted identity verification and distributed quota enforcement at the server boundary.

## 5. `GET /api/health`

Checks serverless handler status, Supabase reachability/configuration and whether AI is configured.

Authentication: none.
Rate limit: 30 requests/minute/IP bucket.
Database timeout: 2.5 seconds.
Cache: no-store.

### Response

```json
{
  "status": "ok",
  "backend": "ok",
  "database": { "status": "ok", "latencyMs": 84 },
  "ai": "configured",
  "degradedFeatures": [],
  "checkedAt": "2026-09-11T00:00:00.000Z",
  "release": {
    "version": "1.2.0-rc.1",
    "channel": "release-candidate",
    "releaseId": "p60-ai-language-operating-system",
    "schemaVersion": 13,
    "commit": null,
    "environment": "local",
    "region": null
  }
}
```

Production returns 503 when the configured database is degraded/unreachable or when database configuration is absent. Missing AI does not fail health; it appears in `degradedFeatures`.

## 6. `GET /api/version`

Returns release metadata from [`version.json`](version.json) plus environment/commit metadata.

Authentication: none.
Rate limit: 60 requests/minute/IP bucket.
Cache: `public, max-age=60, stale-while-revalidate=300`.

```json
{
  "version": "1.2.0-rc.1",
  "channel": "release-candidate",
  "releaseId": "p60-ai-language-operating-system",
  "schemaVersion": 13,
  "commit": "abcdef123456",
  "environment": "production",
  "region": "sin1"
}
```

## 7. Supabase APIs used by the client

These are not repository-owned HTTP handlers:

- Auth: sign-up, password sign-in, sign-out, PKCE session restore.
- Optional OAuth/passwordless/MFA through Supabase client capabilities.
- Read: `learning_sync` row owned by current `auth.uid()`.
- Write: RPC `compare_and_swap_learning_sync`.
- Feature-specific normalized tables where migrations and RLS permit access.

## 8. Testing endpoints

```powershell
node scripts/smoke-production.js https://your-deployment.example
```

`REQUIRE_FULL_SERVICES=1` makes the smoke test require configured dependencies. Do not point destructive test data at production; current smoke test is read-only.
