# P72B MICRO LEARNING REPORT

## 1. Micro Path

P72B adds `MicroPathService`, a presentation layer over the current TOPIK theory lessons and practice routes. It does not replace Roadmap, curriculum, SRS, Mastery or Adaptive Learning. For the learner's current TOPIK level, the first three existing theory lessons are presented as 24 small nodes of 3–10 minutes.

The eight node types are Reading, Vocabulary, Grammar, Listening, Speaking, Writing, Review and Checkpoint. Every node exposes its location, duration, next step and remaining count. The four states are `locked`, `available`, `in_progress` and `completed`.

Opening a node writes only an `opened` event. Completion requires a unique learning mutation produced by an existing engine:

- completed theory lesson;
- real SRS update;
- completed grammar/practice attempt with the required score;
- completed Listening, Speaking or Writing attempt;
- Review or Checkpoint practice result meeting its criterion.

Existing completed theory lessons count as evidence, so returning learners are not forced to repeat material. The active node is persisted, allowing its completion evidence to be accepted after a reload.

## 2. Character

The TamHoanq character set is original and deliberately separate from any third-party artwork, names, personality, league or social system:

- Bom — calm beginner guide;
- Yuna — curious student focused on natural Korean;
- Dojin — precise office worker focused on context and politeness;
- Ara — teacher who encourages self-correction.

Each character has an ID, name, role, personality, compact CSS avatar and unlock rule. Characters appear only where they provide learning context: Micro Path guidance, scenario dialogue, cultural/register cues and speaking follow-up. Unlock, meet and interaction events are user-scoped and persist across TOPIK level changes.

Character progression is intentionally independent from learning Mastery. Meeting a character or earning an adventure cosmetic never changes lesson score, SRS strength, skill score or TOPIK readiness.

## 3. Adventure

`AdventureLearningService` implements Korean Adventure with the requested structure: World, Location, Character, Mission, Dialogue, Choice or Speaking follow-up, Outcome and Reward.

The initial library contains:

- beginner café ordering with multiple choice;
- intermediate campus introduction with sentence construction;
- advanced workplace update with Korean free response.

Outcomes are not reduced to correct/wrong. Choices can Continue, Retry, reveal a Hint or move through an Alternative dialogue. The current step, selected construction tokens, evidence-only attempt data and score are saved after each action, so an interrupted scenario resumes at the same step.

No recording is stored. Advanced free response is evaluated in memory, then only keyword count, Hangul usage and score evidence are persisted; raw text is discarded.

## 4. Learning Integration

Adventure availability is deterministic and based on learner level plus persisted character unlocks. Recommendations prioritize scenario skills that overlap the existing Learner Profile weak-skill list. The scene marks vocabulary already encountered through SRS and displays the grammar required by the authored scenario.

All scenarios come from the approved P72B content file. The engine does not generate random curriculum. Existing routes provide the actual learning work, while P72B only coordinates presentation, context and evidence.

P72B state is included in CloudSync using an event-aware `mergeMicroLearning` strategy. Node, character, adventure and reward records are unioned by stable IDs; the latest active node/adventure wins. Existing progress, SRS, Auth and cloud payload fields are not reset or renamed.

## 5. UX

- Home receives two compact entry points: the next 3–10 minute step and Korean Adventure.
- The existing Roadmap receives a clear Micro Learning entry rather than being replaced.
- Desktop uses the current 260 px sidebar and remaining content width.
- Mobile keeps bottom navigation and uses an intentional horizontal node rail inside the card; it does not create page-level overflow.
- Character and adventure layouts collapse to one column on smaller screens.
- Light/dark tokens, keyboard-focusable native controls, labels, Korean `lang` attributes and reduced-motion behavior are retained.
- Visual design uses the existing lime brand, subtle borders and low shadow rather than neon, heavy gradient or copied game artwork.

## 6. Tests

Focused unit/contract coverage verifies:

- 24 nodes and all eight required types;
- 3–10 minute limits;
- sequential lock/available/in-progress/completed states;
- opening does not complete a node;
- unique completion evidence and reload-safe active node;
- persistent character unlocks separated from Mastery;
- hint, alternative and continue adventure consequences;
- adventure state, reward and user isolation;
- no raw voice/free-response persistence;
- CloudSync registration and offline shell assets.

Real Edge browser coverage verifies progression, reload resume, adventure completion, character persistence, offline reload, dark mode, fixed desktop sidebar and no page-level horizontal overflow at 360, 768, 1024, 1440 and 1920 px.

Validation results:

- 65/65 repository unit and contract suites passed.
- Ten critical real-browser suites passed: P72B plus Auth/privacy, CloudSync/learning integrity, offline/PWA, performance, product polish, P71A/P71B/P71C and P72A.
- Production build verification passed with 35 direct assets, 102 lazy assets and 3,088,746 referenced bytes.
- Local performance audit: 540 ms first-contentful paint, 659 ms load and 46 requests.
- Release-readiness and tracked-file secret scanning passed. Production domain and live Supabase configuration remain deployment-environment gates.

## 7. Risks

- Micro Path currently projects the first three existing theory lessons per TOPIK level. A future content release should author unit-level node sequences for the full curriculum without moving content into the component.
- Browser speech synthesis/recognition quality still depends on device support. P72B therefore keeps a visible Speaking route fallback and stores no audio.
- Free-response evaluation is a transparent keyword/Hangul fallback, not a claim of native-speaker judgment. Higher-stakes feedback should use reviewed rubrics or teacher review.
- P72B state uses the existing JSON CloudSync envelope. Event-aware merging reduces conflicts, but very high-volume multi-device usage should eventually move node events to normalized server tables.
- Cosmetic rewards communicate scenario progress only and must never be used as evidence of Korean proficiency.

## 8. Git SHA

- Commit: `feat: add micro learning character adventure system`
- SHA: reported from Git after commit.
- Push: `origin/main` after all validation gates pass.
