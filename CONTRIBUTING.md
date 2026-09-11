# Contributing

Thank you for improving Tiếng Hàn - TamHoanq. Changes should preserve learner data, describe real behavior and keep the main learning journey understandable.

## Before starting

1. Read [`PROJECT_OVERVIEW.md`](PROJECT_OVERVIEW.md) and [`SYSTEM_ARCHITECTURE.md`](SYSTEM_ARCHITECTURE.md).
2. Search existing issues/docs/modules before creating a duplicate feature.
3. Keep the request bounded. Documentation-only tasks should not refactor learning logic.
4. Never use real learner data, credentials or production exports as fixtures.

## Branches

- `main` is the integration/release-candidate branch.
- Use a focused branch, normally `codex/<short-topic>` for Codex work or `<type>/<short-topic>` for human contributions.
- Keep one concern per branch.
- Rebase/merge current `main` before requesting review; never force-push shared branches without coordination.

## Commit convention

Use Conventional Commit style:

- `feat:` user-visible capability
- `fix:` bug or data-integrity correction
- `docs:` documentation only
- `test:` test-only change
- `refactor:` behavior-preserving code structure
- `perf:` performance improvement
- `style:` visual/code formatting without behavior change
- `chore:` tooling/maintenance

Examples:

```text
fix: preserve SRS evidence during cloud merge
docs: document local-first sync architecture
```

## Code style

- Use plain JavaScript compatible with the current static runtime.
- Follow existing service/module patterns; do not introduce a framework for a small change.
- Keep user-owned values scoped by user ID.
- Escape learner/content text before inserting HTML.
- Prefer accessible semantic controls and `aria-*` labels where needed.
- Maintain Vietnamese-first copy and locale fallbacks.
- Do not expose phase codes, backend terms or AI implementation details in learner-facing copy unless required for transparency.
- Update asset query versions and `sw.js` together when cached assets change.

## Data and migrations

- Migrations must be additive and reviewable.
- Add RLS, indexes and grants with the table/function they protect.
- Do not reset localStorage, cloud snapshot or learner history.
- Define idempotency/conflict behavior for sync mutations.
- Preserve “unmeasured” as unavailable; do not invent zero or improvement scores.

## Tests required

At minimum:

1. `node --check` for changed JS.
2. Relevant `tests/*.test.js`.
3. `node scripts/verify-production-build.js` when assets/routes change.
4. `node scripts/release-readiness.js` when config/security/deploy changes.
5. Responsive browser test when layout/navigation changes.
6. `git diff --check` before commit.

Run the full static suite before merging to `main`. Commands are in [`DEVELOPMENT_GUIDE.md`](DEVELOPMENT_GUIDE.md).

## Pull request checklist

- [ ] Problem and scope are clear.
- [ ] User-facing behavior and fallback are described.
- [ ] No unrelated files or generated native directories are included.
- [ ] Existing learner data remains compatible.
- [ ] Security/privacy implications are addressed.
- [ ] New Supabase objects include RLS tests.
- [ ] Copy exists for supported UI languages where applicable.
- [ ] Documentation and changelog are updated.
- [ ] Static and relevant browser tests pass.
- [ ] No secret, token or personal data is present.

## Content contributions

- New learning content starts as draft.
- Include source/curriculum metadata and difficulty.
- Examples must be natural and level-appropriate.
- AI-generated drafts require authorized human review before approval/publish.
- Use the P62 quality workflow; do not set “native checked” without a real reviewer.

## Security reports

Do not submit vulnerabilities with exploit details as public pull requests or issues. Follow [`SECURITY.md`](SECURITY.md).
