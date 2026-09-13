# P72C IMMERSIVE CONTENT REPORT

## 1. Stories

P72C adds Korean Stories as an authored content system with Series, Episode, Scene, Dialogue, Vocabulary, Grammar, Question and Speaking Task. The first release contains the original TamHoanq series `Tuần đầu ở Seoul` and `Một ngày đi làm`, split into three episodes of 6–9 minutes.

Episodes have `locked`, `available` and `completed` states. Opening or listening does not complete an episode. Completion requires a correct comprehension answer or a speaking result of at least 60. Episode events and the active step are user-scoped and survive reload/cloud synchronization.

The story loop exposes Read, Listen, Understand, Vocabulary, Grammar, Question and Speak, but does not require every auxiliary step. A learner can focus on comprehension or speaking evidence. Beginner episodes contain an explanation for every introduced grammar point, and content above the current learner level is not available.

## 2. Radio

Korean Radio includes the five requested series:

- Daily Korean;
- Beginner Talk;
- Work Korean;
- TOPIK Listening;
- Culture Korean.

Every episode is 3–10 minutes and contains an authored transcript, vocabulary, summary and quiz. Availability respects the learner's current level. Listen and quiz evidence are persisted independently, so listening alone is not reported as comprehension.

## 3. Spoken Exercises

Spoken Exercises lets the learner answer a contextual Korean question by microphone or text. The engine reuses `VoiceCaptureService` and `VoiceAnalysisService` when available and calculates:

- recognized Korean transcript;
- answer relevance from authored keywords;
- pronunciation similarity/provider score;
- a combined transparent learning score.

When microphone, SpeechRecognition or voice analysis is unavailable, the same exercise continues with text input and local comparison. A completed attempt emits the existing `speaking_completed` learning mutation and does not require AI.

## 4. Speaking Flashcards

Speaking Flashcards follow the Korean → Listen → Meaning → Speak → Feedback loop. Each card shows its current SRS status when present.

Speaking practice never changes SRS scheduling, mastery or intervals. The learner may explicitly add a word to the existing SRS through `DictionaryService.addToSrs`; this preserves the current SRS engine and its normal evidence events.

## 5. Shadowing

The new spoken-content Shadowing flow extends the existing pronunciation foundation:

1. Listen at Slow, Normal or Natural speed.
2. Repeat the authored line.
3. Record through the existing browser capture service or type a fallback transcript.
4. Replay the recording during the current session when a browser audio blob exists.
5. Compare pronunciation and relevance.

The object URL and audio blob stay in memory only. Persisted history contains score, transcript, speed, method and whether replay was available; it never stores the audio itself.

## 6. Audio Quality

Every story, radio episode and shadowing line has explicit audio metadata. Allowed labels are `Native`, `AI voice` and `TTS`. A `Native` label fails the content quality gate unless native evidence is present.

All content in this release is truthfully labeled `TTS`, with `ko-KR` locale and no claim of native recording. The UI displays `Nguồn audio: TTS` next to playback. The voice quality score is disclosed as browser/provider feedback, not native-speaker certification.

## 7. Offline

The approved JSON, P72C service and responsive stylesheet are part of the service-worker shell. They are loaded only when an immersive/spoken route or its discovery hub is opened, keeping the startup bundle bounded. Story/radio progress and spoken evidence write locally first and are included in the existing CloudSync envelope.

`mergeImmersiveSpoken` unions episode, radio, spoken, flashcard and shadowing events by stable ID and keeps the latest active episode. A cached P72C route reloads offline with prior completion state. Audio playback uses device TTS, so voice availability offline still depends on the Korean voice pack installed on that device; text/transcript learning remains available regardless.

## 8. Tests

Focused contract coverage verifies content quality gates, native-evidence enforcement, story loading/progression, episode persistence, level gates, all five Radio series, TTS source disclosure, typed speech fallback, SRS isolation/explicit activation, shadowing comparison, no raw-audio persistence, CloudSync registration and user isolation.

Real Edge coverage verifies existing voice-service reuse, story and Radio completion, speech fallback, Speaking Flashcard/SRS behavior, Shadowing, reload persistence, offline reopen, dark mode, fixed desktop sidebar and no page-level overflow at 360, 768, 1024, 1440 and 1920 px.

Validation completed successfully:

- 66/66 repository contract test files passed.
- 11 critical Edge browser suites passed, including P47/P48 integrity, P49 performance/offline, P50 polish and P71A–P72C responsive flows.
- P72C passed at 360, 768, 1024, 1440 and 1920 px in dark mode with no page-level horizontal overflow.
- Production build verification passed: 35 direct assets / 1,146,610 bytes and 104 lazy assets / 1,984,135 bytes.
- Browser performance audit passed: first contentful paint 856 ms, load 1,365 ms, 46 requests and about 1.19 MB decoded on the local audit server.
- Release-readiness and `git diff --check` passed. Production domain, Supabase deployment configuration and optional OpenAI key remain environment-level deployment checks; the documented AI fallback remains active without a key.

## 9. Git SHA

- Commit: `feat: add immersive content and spoken learning system`
- SHA: authoritative final SHA is reported in the delivery message because a commit cannot embed its own hash.
- Push: `origin/main` after validation passes.
