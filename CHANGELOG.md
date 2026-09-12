# Changelog

All notable repository changes are documented here. The project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) structure and [Semantic Versioning](https://semver.org/) for release metadata where practical.

## [Unreleased]

### Added

- Added the P69 five-role education ecosystem, consented classroom progress sharing, assignments, secure assessments, teacher insights, organization management, creator approval workflow and evidence-backed certificates.
- Added an additive Supabase migration with organization/class-scoped RLS, student-controlled consent, answer-key isolation, server-side assessment grading and privacy-safe school reporting.
- Added P68 task-specific AI contracts, minimized learner context, client/server response quality gates, normal/edge/wrong evaluation data, human feedback metadata, aggregate usage/cost telemetry and public-only session caching.
- Added an additive Supabase migration for private AI feedback and security-invoker usage summaries without storing raw prompts or responses.
- Added the P67 ethical Free/Premium/Pro capability map, server-authoritative entitlement projection, fair-use AI quota, no-auto-charge trial, cancellation request flow, and admin subscription/payment audit view.
- Added provider-neutral billing API boundaries and an additive Supabase subscription, trial, quota, pricing-research, cancellation and audit migration.
- Added a controlled Vietnamese-first Korean content lab with Hangul Zero, Vietnamese contrast, natural-register examples, listening, transparent TOPIK practice, survival lessons, culture notes, and story learning.
- Added whole-inventory P66 audit output with normalized content identity, topic, provisional quality score, and review status.
- Added additive Supabase metadata for provenance, honest audio labeling, quality dimensions, AI-check evidence, and content versions.

### Changed

- Extended the existing B2C education foundation with optional B2B Student, Teacher and Center plans while preserving personal learning, SRS, Mastery, Adaptive Learning, AI fallback and CloudSync data.
- Bumped the PWA cache and route/app asset revisions for the offline-capable P69 education ecosystem.
- Routed simple and complex AI tasks independently, capped output per task, deduplicated identical in-flight requests, and preserved deterministic learning fallbacks when AI is disabled, unavailable, throttled or rejected.
- Bumped the PWA cache and route/app asset revisions for the P68 quality layer and offline-safe fallback.
- Kept learning foundations, basic skills, SRS, progress, offline core, journals and community foundations available to Free users; Premium and Pro add depth without deleting progress on expiry or cancellation.
- Bumped the PWA cache and route/app asset revisions for the offline-capable P67 Premium center.
- Bumped the PWA cache and route/app asset revisions for the P66 offline-capable content route.
- Kept all P66 items behind a human-review gate; AI checks cannot mark content approved or official.

### Documentation

- Added the P69 role, classroom, assessment, creator, school, privacy, monetization, testing and remaining-risk report.
- Added the P68 AI feature/value audit, quality and hallucination evidence, cost/privacy review, test results and remaining-risk report.
- Added product overview, architecture, database, API, AI, learning-engine, security, development, contribution, case-study and demo documentation.
- Added reproducible portfolio screenshot guidance and validation.
- Reorganized README as a source-linked project entry point.
- Added P65 product evaluation and P66 competitive content upgrade reports.
- Added the P67 monetization architecture, security evidence, validation results and remaining-risk report.

## [1.2.0-rc.1] - 2026-09-10

### Added

- Local-first Korean learning journey from Level 0/ Hangul through TOPIK, practice and real-life contexts.
- SRS, mastery, Error Notebook, daily plan, learning outcomes and supporting analytics.
- Optional Supabase Auth/CloudSync with revisioned snapshot and compare-and-swap mutation flow.
- Optional server-side AI assistance with consent, context bounds, routing and fallback.
- PWA/offline shell, route-level lazy loading and responsive desktop/mobile navigation.
- Capacitor mobile shell, validation workflow and native capability boundaries.
- Content quality/human-review governance, demo mode and production operations runbooks.

### Security

- Added PBKDF2 local credentials, session expiration, RLS migrations, privacy controls, security headers and tracked-secret checks.

### Known limitations

- Release candidate; production domain/provider configuration must be verified outside the repository.
- Mobile artifacts are unsigned validation builds, not app-store releases.
- Several teacher/community/commercial/global-language areas are foundations rather than complete operated services.
- No repository evidence yet proves real-user learning outcome or retention claims.

[Unreleased]: https://github.com/tam9166/Hoctienghan/compare/v1.2.0-rc.1...HEAD
[1.2.0-rc.1]: https://github.com/tam9166/Hoctienghan/releases/tag/v1.2.0-rc.1
