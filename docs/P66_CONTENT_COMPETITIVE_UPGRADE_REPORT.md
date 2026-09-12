# P66 CONTENT COMPETITIVE UPGRADE REPORT

Date: 2026-09-12

Repository: `tam9166/Hoctienghan`

Branch: `main`

P66 adds a small, controlled content pack and the governance needed to improve it safely. It does not claim that machine-written Korean is native-reviewed: all 46 new learning records are `NEEDS_REVIEW`, every bundled listening item is labeled `TTS`, and every new TOPIK item is labeled practice/original rather than an official question.

## 1. Content Audit

The read-only audit command is:

```powershell
node scripts/audit-competitive-content.js
node scripts/audit-competitive-content.js --details
```

The normalized inventory fields are:

```text
content_id, type, level, topic, quality_score, status
```

Status vocabulary is limited to `APPROVED`, `NEEDS_REVIEW`, `INVALID`, and `MISSING_DATA`.

Audit result after P66:

| Metric | Result |
| --- | ---: |
| Total records | 6,810 |
| Existing inventory | 6,764 |
| P66 controlled pack | 46 |
| Approved with existing human evidence | 3 |
| Needs review | 6,159 |
| Missing data | 648 |
| P66 approved without human evidence | 0 |

The audit is structural evidence, not a linguistic certification. Legacy records without topic metadata remain `UNMAPPED`; duplicate legacy rows normalize to `NEEDS_REVIEW` rather than being silently treated as valid. The prior P62 findings—template examples, fallback romanization, generated TOPIK-style questions, and browser TTS—remain visible rather than being hidden by the new pack.

## 2. Hangul Foundation

The new Hangul Zero track contains seven controlled units:

- what Hangul is and how `한 = ㅎ + ㅏ + ㄴ` is assembled;
- foundational vowels and Vietnamese listening pitfalls;
- initial consonants and syllable building;
- basic batchim and an introductory linking observation;
- stroke order, direction, tracing/free-writing, and reuse of `HandwritingProvider`;
- first reading with `가`, `나`, `학교`, `사람`, and `한국`;
- pronunciation contrasts: `ㅓ/ㅗ`, `ㅡ/ㅜ`, plain/aspirated/tense consonants, batchim, and beginner linking.

The UI exposes this as a quality lab from the Learning page. Completion uses stable content IDs and a separate, user-scoped, CloudSync-compatible progress domain. Existing lesson progress is not rewritten.

## 3. Vietnamese Contrast System

Five priority contrast lessons cover:

- `은/는` and `이/가`;
- Korean tense endings versus Vietnamese time markers;
- honorific/register choices versus Vietnamese address terms;
- `있다/없다` for possession and existence;
- predicate-final Korean word order versus common Vietnamese word order.

Each controlled lesson has usage, Vietnamese contrast, common mistakes, a correct example, a context-sensitive example to repair, and a repair exercise. The explanations avoid absolute one-to-one translations. Reference checking is anchored to the [National Institute of Korean Language Korean–Vietnamese Learners’ Dictionary](https://krdict.korean.go.kr/vie/mainAction?flag=PC), which explicitly serves Korean learners in Vietnamese, and the [Online King Sejong Institute curriculum](https://www.iksi.or.kr/index.html).

## 4. Sentence Database

The starter bank contains 11 stable records classified by register and context:

- registers: formal, daily, casual, and chat;
- contexts: daily life, work, school, friends, travel, restaurant usage, and Korean culture.

The route presents variants side by side so a learner sees how relationship and situation change an expression. All entries remain provisional until a reviewer confirms naturalness.

## 5. Listening System

Eight listening packs cover the requested starter range:

| Level | Topics |
| --- | --- |
| Beginner | self-introduction, shopping, ordering at a café |
| Intermediate | work scheduling, interview, coordinating opinions |
| Advanced | a self-authored news-style notice, discussion/opinion |

Every pack includes transcript, vocabulary, grammar, question, answer explanation, and playback at slow (`0.75×`), normal (`1×`), and natural-speed practice (`1.15×`). “Natural” describes the playback speed only; the UI prominently states that the source is browser `TTS`, not verified native audio.

## 6. TOPIK Quality

Three small practice items demonstrate the trust model. Each includes `question_id`, TOPIK level, skill, `source_type`, difficulty, answer, and explanation.

- official verified claims in P66: **0**;
- source types used: `TOPIK_STYLE_PRACTICE` and `ORIGINAL_CREATED_CONTENT`;
- each explanation states that the item is practice/self-authored rather than a real exam question.

The official reference link is stored as [TOPIK’s official examination service](https://www.topik.go.kr/), but no official-question claim is inferred from that link. Verified official items can only be introduced later with item-level evidence and human review.

## 7. Survival Korean

Five scenario lessons cover:

- restaurant: ordering, asking price/spiciness, and payment;
- hospital: symptoms and requesting an appointment;
- work: confirming tasks and asking for leave;
- travel: airport gate, hotel reservation, subway, and bus;
- study: classroom questions, assignment deadlines, and dormitory help.

Each lesson includes reusable phrases, context, and a role-play prompt. Medical content carries a clear boundary that it is language practice, not medical advice.

## 8. Culture Content

Six notes cover age questions, `존댓말`, hierarchy, workplace communication, dating-language boundaries, and meal expressions. Each note includes a recommended action and a “do not assume” boundary. The content avoids presenting all Korean people as behaving identically and remains queued for cultural/native review.

## 9. Audio System

Audio provenance is explicit:

| Source label | Current P66 count | Rule |
| --- | ---: | --- |
| Native | 0 | Only a verified native-speaker recording may use this label |
| AI voice | 0 | Must name provider/model when introduced |
| TTS | 8 listening packs | Browser `ko-KR` voice with rate and level metadata |

The database migration adds `audio_source_type` and `audio_metadata`. CSS filters or renamed TTS assets are not used to manufacture a “Native” claim.

## 10. Story Learning

The first story, “Ngày đầu du học”, has three chapters: arriving at a dormitory, finding a classroom, and sharing a first lunch. Every chapter contains dialogue, Vietnamese meaning, vocabulary, grammar, and a quiz. Its stable story/chapter IDs allow content version upgrades without replacing a learner’s history.

## 11. Quality Score

The model defines five dimensions:

1. Accuracy
2. Naturalness
3. Difficulty
4. Completeness
5. Vietnamese explanation

P66 scores are explicitly provisional structural scores and are capped at 69 while human review is absent. `accuracy` and `naturalness` remain `null` on the detailed records where no qualified reviewer has supplied evidence. A score therefore cannot bypass the P62 workflow guard:

```text
Draft → AI Check → Human Review → Approve → Publish
```

The Supabase migration preserves human `reviewed_by`/`reviewed_at` evidence and only adds provenance, topic, audio origin, quality dimensions, AI-check evidence, and semantic content-version metadata.

## 12. Remaining Issues

- 6,159 inventory records still need editorial review; P66 deliberately does not mass-approve them.
- 648 records remain structurally incomplete.
- Legacy topic metadata is mostly unmapped.
- There is no verified native audio asset in P66; browser TTS is a fallback and is labeled honestly.
- There are no verified official TOPIK questions in P66.
- The 46-item pack is a starter set, not a complete curriculum. Expansion should happen only through the review workflow.
- Naturalness, Korean cultural nuance, and Vietnamese pedagogy still need named qualified reviewers and review evidence.
- The migration is repository-ready but requires deployment to the configured Supabase project before cloud metadata columns are live.

These are launch gates, not cosmetic backlog. Until review happens, the UI calls this area a “content lab” rather than an approved course catalog.

## 13. Testing

Completed validation:

- JSON/schema and stable-ID checks for all 46 P66 records;
- human-review gate (zero machine-approved P66 items);
- honest audio provenance and TOPIK source labeling;
- whole-inventory read-only audit (6,810 records);
- Global Search integration;
- completion progress saved in a new user-scoped domain;
- existing progress marker retained after P66 completion;
- Content Issue Report persistence;
- offline asset references and cache revision;
- additive migration safety scan (no learner-data update/delete);
- JavaScript syntax and `git diff --check`;
- 56/56 repository contract/static test files;
- real Edge browser at 360, 768, 1024, 1440, and 1920 px;
- dark mode, sidebar/mobile navigation, and no horizontal overflow.

Production build and release-readiness checks pass. The HTTPS production smoke test remains pending because `PRODUCTION_URL` is not configured in the repository; the script intentionally rejects localhost.

## 14. Git

Commit: `feat: upgrade competitive Korean content quality`

SHA: filled after commit

Push: filled after push

Files are committed together with the previously uncommitted P65 evaluation report so the audit evidence is not lost.
