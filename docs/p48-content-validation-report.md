# P48 Vocabulary Content Validation Report

Validation source: `data/vocabulary-bank.js` (1,000 records). This report is diagnostic only. No meanings, romanization, TOPIK levels, or examples were bulk-edited.

## Summary

| Check | Result | Editorial action |
| --- | ---: | --- |
| Duplicate surface forms | 33 groups / 34 excess records | Review homonyms separately from accidental duplicates |
| Duplicate word + Vietnamese meaning | 22 groups | Decide canonical record and preserve topic relationships |
| Automatic romanization | 986 records | Native/editor review required before marking curated |
| Missing `audioText` | 0 | `audioText` is only a TTS input, not a native recording |
| Missing example | 0 | All current examples are generated templates |
| Missing Vietnamese meaning | 0 | No missing value detected; accuracy was not auto-corrected |
| Invalid TOPIK level | 0 | Valid range is 1–6; level appropriateness still needs human review |
| Template examples | 1,000 records | Replace only through a reviewed editorial workflow |

## Duplicate surface review queue

`질문` (v-01-18, v-32-13); `일` (v-03-01, v-16-01); `팔` (v-03-08, v-26-06); `시간` (v-05-01, v-28-02); `시` (v-05-02, v-49-03); `서류` (v-07-17, v-17-04); `면접` (v-07-18, v-32-01); `연구` (v-07-19, v-33-08); `직원` (v-09-05, v-16-04); `예약` (v-09-07, v-15-06); `포장` (v-09-10, v-18-10); `배달` (v-09-11, v-30-16); `도착하다` (v-11-20, v-27-20); `주소` (v-12-18, v-27-09); `눈` (v-13-07, v-14-05); `몸` (v-14-02, v-26-01); `머리` (v-14-03, v-26-02); `얼굴` (v-14-04, v-26-03); `손` (v-14-09, v-26-07); `발` (v-14-10, v-26-15); `배` (v-14-11, v-26-10); `등` (v-14-12, v-26-12); `검사` (v-15-12, v-18-16, v-42-12); `경력` (v-16-15, v-32-06); `확인하다` (v-16-18, v-28-14); `준비하다` (v-16-19, v-32-16); `일정` (v-17-08, v-28-04); `환율` (v-21-09, v-36-12); `긴장하다` (v-23-19, v-32-15); `만나다` (v-24-11, v-28-08); `기다리다` (v-24-19, v-28-09); `주민` (v-30-04, v-34-02); `갈등` (v-34-05, v-49-10).

## Reproducible detailed queue

Run `node scripts/validate-vocabulary-content.js`. The JSON output includes every affected record ID for all eight checks, including the complete lists of 986 automatic romanizations and 1,000 template examples. Editorial reviewers should resolve records individually, retain source/context metadata, and approve changes before publishing.
