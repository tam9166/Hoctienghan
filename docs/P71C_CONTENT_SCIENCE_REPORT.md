# P71C CONTENT SCIENCE REPORT

## Verified Content

P71C adds a transparent review registry with content author, reviewer/team, review scope, review date, evidence and source fields. A content item receives the Verified label only when its review status is approved, all provenance fields are present and the documented quality score passes the threshold. Items without a review record remain explicitly unverified. Seeded records represent TamHoanq internal academic review and are not described as independent certification.

## Quality Score

The quality model scores accuracy (35%), naturalness (25%), difficulty fit (20%) and completeness (20%) from 0–100. Each dimension remains visible instead of being hidden behind one number. The calculated score supports human review and cannot approve or publish content automatically.

## Learning Analytics

The effectiveness layer records four evidence types per content item: studied, remembered, used and improved. It listens to existing lesson, SRS, practice and Mastery mutations and can bootstrap bounded evidence from existing progress without changing that progress. The learning curve is derived from real activation, lesson and usage dates; insufficient evidence produces a collecting state rather than invented growth.

## Retention

Vocabulary retention uses SRS recall evidence. Grammar retention uses grammar recall, usage and improvement signals. Skill improvement reuses the current Advanced Learning Analytics service, with the Learner Profile as a non-comparative fallback. All metrics are scoped to the current learner and never compare one learner with another.

## Feedback Loop

Users can create a Content Issue Report for wrong meaning, confusing examples or broken audio. Reports are owner-scoped and available only to the reporter and authorized teacher/content-review/admin roles. The report text is bounded and never enters anonymous research aggregates.

Anonymous research is opt-in through the existing research and telemetry consent. Only month, coarse segment/level/score bands, content identity/type and aggregate counts may be submitted. The database aggregate has no user ID, email, IP, device, free text, transcript, audio, journal, password or token fields, and its RPC rejects these fields.

## Testing

- Focused unit coverage validates verification gates, four-dimensional scoring, learning evidence, SRS/grammar retention, learning curves, feedback isolation and consent boundaries.
- Real-browser coverage validates existing-data bootstrap, mutation tracking, reload persistence, dark mode and no horizontal overflow at 360, 768, 1024, 1440 and 1920 px.
- Existing SRS, Mastery and progress objects are snapshotted before P71C and verified unchanged afterward.
- Supabase migration is additive and applies owner-only RLS to effectiveness and issue data; aggregate research uses a restricted security-definer RPC.
- Repository-wide regression: 63/63 unit suites passed. Eight critical real-browser suites passed, including safety/data integrity, learning integrity, content quality, outcomes, P70, P71A, P71B and P71C.
- Production build verification passed with 31 direct assets, 102 lazy assets and 2,995,668 referenced bytes. Local performance audit recorded 444 ms first-contentful paint, 847 ms load and 40 requests.
- Release-readiness and tracked-file secret scanning passed. The HTTPS production-domain smoke check remains pending because `PRODUCTION_URL` is not configured in this local environment.

## Git

- Commit: `feat: add content trust and learning science system`
- SHA: reported from Git after commit.
- Push: `origin/main` after all local validation gates pass.
