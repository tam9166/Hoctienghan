# P58 — Immersive Korean World

P58 extends the existing P4/P44 immersion engine. It does not create a second progress store or replace speaking, Mastery, CloudSync, dark mode, or offline behavior.

## Experience architecture

- Virtual Korean City contains the four product locations: Airport, Cafe, University, and Office.
- Scenario Library reads approved catalog records from `content/immersive-korean-world.json` and filters them by level and the Student, Worker, or Traveler role.
- Mission sessions reuse `ImmersiveWorldController`, speech/text fallback, Mastery updates, and the existing user-scoped progress store.
- Story Learning uses branching choices. Decision Learning and Cultural Training return contextual explanations instead of translation-only feedback.
- Survival Mode reuses `ImmersionSettingsService` and hides Vietnamese translation in daily, story, and culture flows.
- Immersion Score uses completed city/role-play missions, daily simulation, story, culture decisions, and Korean-only practice. It is an internal readiness indicator, not a proficiency certificate.
- Progress Map presents Beginner, Intermediate, and Advanced stages and recommends the next incomplete mission without hard locking later content.

## Data and privacy

The catalog is versioned, verified, and approved before hydration. Scenario records use stable IDs, mission IDs, role, level, objective, and skill tags. Runtime progress remains scoped to the current user and synchronized through the existing `immersive-korean-world` CloudSync channel.

The system stores choice IDs, scores, completion timestamps, and mission aggregates. It does not store raw audio or free-form transcript text in the P58 progress record.

## Validation

- Unit coverage verifies the four city locations, three roles, level filters, story branches, culture decisions, Survival Mode, readiness evidence, progress map, CloudSync, and user isolation.
- Browser coverage verifies 360, 768, 1024, 1440, and 1920 px, dark mode, touch targets, no horizontal overflow, Scenario Library, Survival Mode, and the three-stage progress map.
- Production build, release readiness, PWA offline reopen, data integrity, performance, and product-polish regressions run before release.
