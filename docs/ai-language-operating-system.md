# P60 — AI Language Operating System

P60 is an orchestration layer over the existing AI infrastructure, learner intelligence, content governance, analytics, and P59 language platform. It does not introduce another chatbot, duplicate SRS/Mastery, or replace a teacher.

## Runtime architecture

`AILanguageOperatingSystem` exposes ten coordinated capabilities:

1. `PersonalLanguageMemoryService` creates a minimal snapshot from Learner Profile, Language Profile, and Error Notebook. An explicit `confirmed: true` flag is required before allowed memory fields can be changed.
2. `AIStudyPlannerOSService` builds an evidence-first plan from Daily Plan or deterministic SRS/weak-skill signals. AI explanation is opt-in.
3. `AILearningAdvisorOSService` selects one next action and includes its evidence and route.
4. `AIContentCuratorOSService` ranks only approved content. Draft/review content is excluded and missing language curricula are never fabricated.
5. `AIProgressPredictionService` creates a bounded, personal forecast from recent sessions and skill samples. It never guarantees an exam, career, or learning outcome.
6. `AIMultiLanguageSupportService` projects the shared contract across Korean, Japanese, Chinese, and English while preserving each language's content status.
7. `HumanAIHybridService` marks outputs advisory. The learner controls goals; an authorized teacher can override recommendations; publishing requires human approval.
8. `AIPrivacyFirstService` delegates consent to the existing Privacy Center and keeps raw prompts, responses, and audio out of P60 storage.
9. `ContinuousAIImprovementService` stores bounded aggregate metadata only: capability, status, quality score, fallback, and optional usefulness.
10. `GlobalLanguageAssistantOSService` exposes explicit learning actions (`plan`, `advisor`, `curate`, `predict`) instead of a free-form chatbot.

## Data boundaries

- Existing `klearn_ai_memory`, learner profile, SRS, mastery, progress, and language profile data are read in place and are never reset or migrated by P60.
- P60 writes only user-scoped aggregate outcome metadata to `klearn_ai_language_os`, which participates in the existing CloudSync snapshot.
- Passwords, auth/session tokens, email, raw conversation, raw response, and raw audio are outside the contract.
- The AI consent toggle remains authoritative. Disabling AI does not disable deterministic plans, approved content discovery, SRS, or analytics.

## Quality and human oversight

Requests continue through the P26 orchestration limits and the P43 single-agent quality controller. There are no autonomous agent loops and no automatic retry chain. Generated practice remains review-only, while curriculum publishing stays inside the existing human approval workflow.

## Multi-language status

Korean content is active. Japanese, Chinese, and English are engine/profile foundations until approved content packs are released. Memory and planning can target those profiles without presenting an unavailable curriculum as complete.

## Validation

Unit coverage verifies the contract gate, explicit memory confirmation, deterministic planning, approved-only curation, bounded predictions, four-language matrix, hybrid authority, privacy fallback, metadata-only improvement logs, and route/cache integration. Browser QA covers dark mode, touch targets, no horizontal overflow, no chatbot input, and responsive layout at 360, 768, 1024, 1440, and 1920 px.
