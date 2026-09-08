# Version management

`version.json` is the single release manifest for the application. It records the public SemVer, release channel, data schema compatibility and release date without exposing deployment credentials.

## Version policy

- Use SemVer: `MAJOR.MINOR.PATCH`.
- Use `-rc.N` while the release is being validated in production-like environments.
- Increment `MAJOR` for incompatible data or public API changes, `MINOR` for backward-compatible features and `PATCH` for backward-compatible fixes.
- Keep `schemaVersion` aligned with the additive local/cloud data schema. A release must never lower this value.
- Change `minimumSupportedVersion` only when an older client is genuinely unsafe or incompatible; prefer backward compatibility.

The service worker cache name is an implementation version, not the product version. Change it only when cached application assets change. Database migrations remain timestamped, additive and reversible where possible.

## Release flow

1. Update `version.json`, release notes and any changed cache/schema versions.
2. Run the production build verifier, readiness audit and all tests.
3. Merge the reviewed commit to `main`.
4. Create the matching annotated tag, for example `v1.0.0-rc.1`.
5. Approve the protected GitHub `production` environment. The deployment workflow verifies that the tag exactly matches `version.json`.
6. Verify `/api/version`, `/api/health`, the canonical domain and the key learning flow.
7. Promote a validated candidate by removing the `-rc.N` suffix and repeating the same process.

## Rollback and traceability

Every deployment exposes a shortened immutable commit in `/api/version` and `/api/health`. Roll back by promoting the last known-good Vercel deployment, then run smoke checks against both its deployment URL and the canonical domain. Do not roll back user data automatically. If a data migration is involved, follow the restore procedure and incident process before taking action.

Release tags are immutable. Correct a bad tag with a new patch or release-candidate version rather than moving an existing tag.
