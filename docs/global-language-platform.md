# P59 — Global Language Platform

P59 turns the existing P27, P40, P45, and education-platform foundations into one operational product gateway. It does not duplicate SRS, Mastery, Analytics, Marketplace, teacher tools, creator workflow, or certification.

## Language engine

The engine recognizes Korean (`ko`), Japanese (`ja`), Chinese (`zh`), and English (`en`). Korean is the active content pack. The other languages support profiles, IDs, level systems, audio locales, grammar/vocabulary contracts, and future content ingestion, but are not presented as released curricula.

## Shared learning core

- Existing Korean knowledge IDs remain unchanged, preserving current SRS and Mastery history.
- New language knowledge uses a language namespace, such as `ja:lesson-id`, to prevent collisions.
- Vocabulary records without a `languageId` continue to resolve as Korean for backward compatibility.
- Analytics remains personal and does not introduce cross-user comparison.

## Profiles and exams

A user-scoped language profile stores an active language plus a separate level, target, and status for each language. It uses the existing `klearn_language_profiles` storage key and `language-profile` CloudSync channel.

The exam contract maps Korean to TOPIK, Japanese to JLPT, Chinese to HSK, and English to CEFR. Only TOPIK is active until approved exam content exists for the other systems.

## Education ecosystem

The global hub links to the existing approved-course Marketplace, role-protected Teacher Platform, human-review Content Creator workflow, and progress-based Certification system. Navigation loads those modules lazily through their existing routes.

## Validation

Unit tests cover aliases, profiles, shared IDs, SRS compatibility, exam mappings, comparison content, gateways, content quality, and RLS. Browser tests cover dark mode, touch targets, no page overflow at 360–1920 px, profile persistence, all primary routes, and preservation of legacy Korean SRS data.
