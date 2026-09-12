# P71B REAL KOREAN EXPERIENCE REPORT

## Pronunciation Lab

P71B adds a focused pronunciation lab for Vietnamese learners covering ㄹ, ㅓ, ㅡ, 받침 and 연음. It reuses the existing microphone, SpeechRecognition, signal analysis and syllable-scoring services. Each target follows Listen → Record → Analyze → Feedback, reports accuracy, missing sounds and likely substitutions, and provides a transparent text fallback. The 서울/소울 confusion produces a specific ㅓ-versus-ㅗ correction. Audio exists only in memory while an attempt is evaluated and is never persisted or synced.

## Sentence Mining

Learners can save a short Korean sentence from a film, webtoon, YouTube item or document. The local, approved vocabulary and grammar index extracts known words and patterns, saves the sentence to the existing personal sentence notebook and can add vocabulary to the existing SRS. The system stores only the user-entered short sentence and source label, never a full copyrighted source document or media file.

## Media Learning

The first media lessons use original TamHoanq dialogues with Korean and Vietnamese subtitles, translation hiding, tap-to-save vocabulary, line navigation and completion progress. No copyrighted video is bundled. Content is quality-gated and cached by the current service worker after first use for offline continuation.

## Conversation

The real-conversation lab includes restaurant, airport, interview, hospital and workplace scenarios. Each answer receives local-first scores for meaning, grammar, naturalness and situational fit. The existing AI orchestration may add a short naturalness note; disabled, unavailable, rejected or rate-limited AI leaves the local evaluation and progress flow fully functional. Low scores continue to feed the existing Error Notebook.

## Shadowing

Shadowing follows Listen → Repeat → Record → Compare at 0.75×, 1× and 1.15×. It reuses the current voice analysis service, writes score-only progress into both the P71B domain and the existing shadowing progress domain, and never saves an audio blob.

## Testing

- Focused unit coverage verifies all five Vietnamese pronunciation targets, exact confusion feedback, text fallback, all four mining source types, SRS integration, media progress, five conversation scenarios, AI fallback, three shadowing speeds, offline-hydrated content and account isolation.
- Responsive browser coverage checks 360, 768, 1024, 1440 and 1920 px, dark mode, horizontal overflow, route discovery and persistence after reload.
- Existing Auth, CloudSync, SRS, Mastery, AI and user progress are not reset or replaced.
- Supabase migration is additive, owner-only through RLS, and explicitly forbids stored audio or full source documents.
- Repository-wide unit regression: 62/62 passed.
- P47 data-safety, P48 learning-integrity, Advanced Voice, P70 global-language and P71A learning-intelligence browser regressions passed.
- Production build passed with 31 direct assets (1,051,408 bytes), 100 lazy assets (1,913,265 bytes) and 2,964,673 referenced bytes in total.
- Local performance audit passed: DOMContentLoaded 472 ms, load 573 ms and first contentful paint 432 ms.
- Release readiness passed across 413 tracked/staged files. Production-domain smoke, Supabase deployment and the AI provider key remain environment deployment steps.

## Git

- Commit: `feat: add real korean experience system`
- SHA: recorded after commit.
- Push: `origin/main` after all validation gates pass.
