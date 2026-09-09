# P56 — Mobile native ecosystem

## Architecture

The existing SPA/PWA remains the product source. A reproducible Capacitor 8 shell packages the same HTML/CSS/JavaScript for Android and iOS, while native plugins provide lifecycle, network, push, camera and widget storage hooks.

```text
Web/PWA UI + Learning/SRS/Mastery
              |
       KLearnPlatform API resolver
              |
 Capacitor Android/iOS shell ---- Native plugins
              |                   lifecycle / camera / push / widget snapshot
              |
       Existing /api + Supabase Auth/learning_sync
```

There is no mobile-only user or progress database. `MOBILE_API_BASE_URL` points the bundled app to the same HTTPS API as web. The API accepts only the known Capacitor origins (`capacitor://localhost`, `https://localhost`) plus explicitly configured HTTPS values in `MOBILE_ALLOWED_ORIGINS`; this is not an authentication mechanism. `NativeSyncBridge` flushes the existing idempotent background queue and `CloudSyncService` after network recovery/app resume.

## Authentication and sync

- Email/password uses the same Supabase project and user ID.
- OAuth/passwordless use PKCE and `com.tamhoanq.korean://auth/callback`; add this exact URL to the Supabase redirect allowlist and native platform deep-link configuration.
- The API URL and redirect are public runtime configuration; keys/tokens are never embedded in the bundle.
- Learning progress, SRS, mastery and history remain in the existing user-scoped local model and `learning_sync`. Push tokens live separately in `mobile_push_devices` and never enter CloudSync.

## Offline and background behavior

- The app shell/content is bundled. Downloadable packs cover lesson, vocabulary, approved audio metadata/assets and practice; large assets remain in Cache Storage/native filesystem, not localStorage or cloud payloads.
- Offline mutations keep using `BackgroundSyncQueueService`; reconnect/resume flushes through CAS-based CloudSync.
- Background audio uses real licensed audio assets, Media Session and platform audio-session/foreground-service configuration. Speech synthesis is not claimed to work under screen lock.
- Camera capture is temporary, on-device and not saved to gallery or uploaded. OCR falls back to text input when unavailable.
- Widgets receive only the daily public phrase and due count through `klearn_widget_snapshot`; no name, email, raw progress or journal is exposed.

## Build

Requires Node 22+. iOS also requires macOS/Xcode; Android requires Android Studio/SDK.

```bash
cd mobile
npm ci
npm run build
npm run doctor
npx cap add android
npm run configure:android
npx cap add ios
npm run configure:ios
npx cap sync
```

For a release candidate, set `MOBILE_API_BASE_URL=https://<production-api-host>` and use `npm run build:release`. The build refuses cleartext or missing release APIs. Generated `mobile/www`, `android` and `ios` folders are ignored and reproducible; platform-specific signing/capability changes must be maintained as audited patches before store submission. On iOS, confirm `PrivacyInfo.xcprivacy` is included in the App target's Copy Bundle Resources phase after project generation.

## Notifications

Types are limited to review due, daily mission and goal reminder. Permission is user initiated, quiet hours are 22:00–07:00, minimum spacing is six hours and the maximum is two per day. Provider credentials and message dispatch belong in a server/Edge Function. The browser cannot read the server-only delivery table.

Before enabling push:

1. Apply `20260909_mobile_native_ecosystem.sql`.
2. Configure FCM/APNs and native capabilities outside Git.
3. Implement the authenticated server dispatcher with preference/quiet-hour/deduplication checks.
4. Test opt-in, revoke, token rotation, deep-link allowlist and expired-token cleanup.

## Release stages

- `internal`: unsigned/debug artifacts for engineering device tests.
- `beta`: signed owner build distributed with Play Internal Testing/TestFlight after manual approval.
- `production`: approved, signed artifact promoted only after P55 and mobile store checklists pass.

`.github/workflows/mobile-native.yml` validates every relevant change and creates unsigned Android/iOS validation builds on manual dispatch. It deliberately does not store signing material or publish to a store. Store promotion remains blocked until Apple/Google credentials, legal metadata and real-device evidence exist.

## Required real-device matrix

| Area | Android | iOS |
|---|---|---|
| Minimum | API 24 device/emulator | iOS 15 device/simulator |
| Low end | 2 GB RAM, battery saver | oldest supported device |
| Network | offline, 2G throttle, reconnect | offline, constrained network, reconnect |
| Lifecycle | background/terminate/resume | background/terminate/resume |
| Native | push/deep link/camera/audio | APNs/deep link/camera/audio session |

Release blockers include lost progress, duplicate queue mutation, cross-user data, notification outside policy, camera persistence, background audio failure, horizontal overflow or inaccessible touch targets.
