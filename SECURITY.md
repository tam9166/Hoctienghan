# Security policy

## Supported version

The active branch documents version `1.2.0-rc.1` in [`version.json`](version.json). Security fixes target the current `main`/release-candidate line unless the maintainer announces another supported release.

This repository contains security foundations and automated checks; it has not published evidence of an independent penetration test or compliance certification.

## Reporting a vulnerability

Do not open a public issue containing credentials, personal data or a working exploit. Use GitHub’s private vulnerability reporting/security advisory feature for this repository if enabled. If private reporting is unavailable, contact the repository owner through a private channel listed on the GitHub profile before sharing details.

Include:

- affected URL/version/commit;
- impact and prerequisites;
- minimal reproduction without real user data;
- suggested mitigation if known.

Do not test against accounts or infrastructure you do not own or have permission to assess.

## Authentication

### Local account

- Password-derived credential uses PBKDF2-SHA-256 through Web Crypto with random salt and at least 100,000 iterations.
- Plaintext password is not stored in the user record.
- Local session TTL is seven days.
- Local auth protects access within one browser profile; it is not a server identity and does not sync across devices.
- UI warns users not to reuse an important password for local-only mode.

### Supabase cloud account

- Supabase JS v2 uses persisted session, refresh token handling and PKCE.
- Email/password is implemented when Supabase is configured.
- Google, Apple, passwordless and TOTP MFA are capability facades; they require provider/project setup and should not be presented as available until verified in the target environment.
- Only publishable/anon configuration is returned through `/api/config`.

## Authorization and RLS

- Core `learning_sync` select access requires `auth.uid() = user_id`.
- Direct core snapshot mutation is revoked; authenticated users call a compare-and-swap RPC.
- User-owned extension tables enable RLS and use owner policies.
- Teacher/admin/content access relies on database role helpers and organization membership policies.
- Client-side role strings are not a trusted authorization source.

Every new Supabase table exposed to the client must ship with RLS tests and least-privilege policies in the same change.

## Secrets

- Never commit `.env`, provider keys, service-role credentials, OAuth secrets, signing certificates or store credentials.
- `.gitignore` excludes `.env*` except `.env.example`.
- `OPENAI_API_KEY`, Vercel tokens and service credentials belong in deployment secret storage.
- `SUPABASE_ANON_KEY` is public by design but is still validated before the frontend receives it; service-role keys are forbidden in client assets.
- CI/release readiness scans tracked text for common private-key/service-role/OpenAI-key patterns. This is a guardrail, not a complete secret scanner.

## API security

- Vercel headers include CSP, frame denial, MIME sniffing protection, strict referrer policy and permissions policy.
- `/api/chat` requires explicit AI consent, bounds input/context and filters common secret-like strings.
- `/api/*` uses method checks and IP-bucket rate limiting.
- Cross-origin mobile access is limited to Capacitor defaults and configured exact HTTPS origins.

Known limitations:

- Rate limits are in-memory per serverless instance, not distributed.
- `/api/chat` does not currently verify a Supabase JWT. Do not use it for paid/user-metered quotas without adding trusted authentication.
- Prompt filtering is not a substitute for full content safety or provider policy enforcement.

## Privacy

- Learning data is local-first and scoped by learner ID.
- Cloud sync, AI usage and telemetry have separate preferences.
- AI provider requests set `store: false` and must receive bounded context only.
- Exact location is not collected by the documented app flow.
- Large audio/images should not enter localStorage or CloudSync.
- Data export supports local learning data. Account deletion is a request flow that requires a trusted backend process to perform irreversible cloud deletion.

See [`docs/privacy-policy-draft.md`](docs/privacy-policy-draft.md). It is a draft and requires legal/owner review before publication.

## Dependency and code checks

```powershell
node scripts/release-readiness.js
npm audit --prefix mobile --audit-level=high
Get-ChildItem api,data,scripts,tests -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
```

Run production smoke checks only against authorized deployments.

## Incident response

Follow [`docs/production/INCIDENT_RESPONSE.md`](docs/production/INCIDENT_RESPONSE.md). For suspected credential exposure:

1. Revoke/rotate the secret in the provider.
2. Stop affected deployment/workflow if necessary.
3. Preserve minimal logs without copying private learner data.
4. Patch and test.
5. Document scope, timeline and recovery actions.

## Security checklist for changes

- [ ] No secret or personal sample data committed.
- [ ] New user data is scoped by authenticated owner.
- [ ] RLS/policy included for new Supabase tables.
- [ ] API validates method, size, auth/consent and error output.
- [ ] Offline cache does not store private API responses.
- [ ] Logs do not include tokens, passwords, raw audio or private learning text.
- [ ] Failure leaves local learning data recoverable.
