# Portfolio screenshots

This directory contains the canonical screenshots used by the project README and demo material.

## Screens

| File | Screen | Purpose |
| --- | --- | --- |
| `landing.png` | Public landing | Product positioning and first action |
| `home.png` | Personalized home | Daily learning plan and progress |
| `learning.png` | Learning catalog | Curriculum discovery |
| `grammar.png` | Grammar comparison | Contextual grammar learning |
| `topik.png` | TOPIK workspace | Exam preparation |
| `assistant.png` | Learning assistant | Optional AI-supported guidance |
| `analytics.png` | Analytics | Personal progress evidence |
| `profile.png` | Profile | Goals, settings, and learner identity |

## Reproduce the set

Start a local static server from the repository root:

```bash
python -m http.server 4173 --bind 127.0.0.1
```

In another terminal, run:

```bash
node scripts/capture-portfolio-screenshots.js http://127.0.0.1:4173/
```

The capture script uses Microsoft Edge with a temporary browser profile, a fixed `1440 × 900` viewport, light mode, and synthetic learner data. It clears only that disposable browser profile; it does not open or modify a real account, normal browser profile, Supabase record, or developer local storage.

Review every regenerated image before committing it. Do not put email addresses, access tokens, private learner data, or browser chrome in screenshots.
