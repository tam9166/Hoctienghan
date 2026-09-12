# P70 GLOBAL LANGUAGE PLATFORM REPORT

## 1. Architecture Changes

P70 adds a language-independent layer over P59 and keeps the Korean learning application intact. New content and learning records carry `language`, `level`, `skill` and `topic`; legacy Korean IDs remain unchanged while other languages use a language namespace.

## 2. Language Core

`LanguageLessonService` normalizes legacy Korean lessons and future language lessons into one contract. `LanguageConfigurationService` supplies Korean, Japanese, Chinese and English-specific script, level, skill and feature configuration without forcing every language into a Korean model.

## 3. Multi Language Profile

One user can maintain independent Korean, Japanese, Chinese and English profiles. Each profile owns level, goal, progress, weak skills, SRS, mastery and writing history. The optional P70 onboarding follows native language → target language → goal → current level → learning path and does not replace existing Korean onboarding.

## 4. Writing System

The shared writing contract supports alphabet, character, syllable block and Kana/Kanji systems. Attempts are stored by user, language and script with stroke-order/stroke/practice modes; it reuses the existing Korean handwriting experience rather than replacing it.

## 5. Exam Framework

The universal exam model contains language, level, skill, question type and score. TOPIK remains active; JLPT, HSK, IELTS and TOEIC are framework mappings only until reviewed curriculum and question banks are released.

## 6. Universal SRS

SRS supports vocabulary, grammar, character, Kanji and sentence items. New items are isolated by language. Existing Korean vocabulary cards remain readable with their legacy IDs and are not copied or reset.

## 7. Adaptive Engine

The deterministic adaptive layer selects the correct target language, goal, due SRS count and weak skill. Korean and Japanese profiles can therefore produce different plans without mixing state; AI remains optional presentation support.

## 8. AI Expansion

AI context now allowlists native language, target language, level, goal, weak skills, recent scores, exam system and script system. It does not send the complete profile database. The response language follows the learner's native language and existing consent, quality, quota and fallback controls remain in force.

## 9. Content System

The language-pack registry is paginated and lazy. Only an explicitly requested, active and human-approved pack is fetched. The Korean pack points to existing reviewed catalogs instead of duplicating content. Japanese, Chinese and English are clearly marked foundation-only, not fabricated curriculum.

## 10. Localization

Market configuration separates interface locale, content language and payment-provider setup. Vietnam, Korea and Global profiles are represented without inventing payment availability. Search can return reviewed Korean, Japanese and Chinese expressions for one Vietnamese query, and community groups carry a language scope.

## 11. Security

Supabase tables use owner-only RLS for profiles, universal review items and writing attempts. Unique keys include user and language IDs. Content pack/catalog access is review-gated; creators cannot approve their own content and only Admin or Super Admin can publish. Cross-user and cross-language isolation are regression-tested.

## 12. Performance

The 1-language, 10-language and 100-pack metadata simulations keep startup pack downloads at zero and use bounded catalog pagination. Optional route assets and content are cached on first use, not during core PWA installation. Language SRS is capped locally and indexed by user/language/due time in Postgres. The production asset audit passes with 31 direct assets (1,049,872 bytes), 96 lazy assets (1,842,359 bytes) and 2,892,231 referenced bytes in total. The local browser audit recorded DOMContentLoaded at 551 ms, load at 569 ms and no performance-budget failure.

## 13. Testing

- Korean and Japanese profiles can be created, switched and updated independently.
- Progress, SRS and mastery remain isolated; CloudSync merges each language independently.
- Writing, five exam mappings, adaptive recommendations, minimal AI context, multilingual search, localization and human-review gates pass unit/security tests.
- Real-browser testing passes at 360, 768, 1024, 1440 and 1920 px in dark mode with no horizontal overflow.
- Repository-wide unit regression: 60/60 passed.
- Production build, performance audit and release-readiness gates passed; the release checker scanned 400 tracked and staged files.

## 14. Remaining Risks

- Japanese, Chinese and English engines are ready, but their full curricula, licensed audio and exam banks require human-reviewed content before activation.
- The P70 migration must be applied to the target Supabase environment before normalized cloud tables are available.
- Production pack CDN, regional payment providers and native-language quality review require market-specific deployment work.
- HTTPS production smoke remains dependent on a configured `PRODUCTION_URL`.

## 15. Git

- Commit: `feat: build global language learning platform`
- SHA: recorded after commit.
- Push: `origin/main` after all gates pass.
