# P50 — Product polish evidence

## Scope

This pass changes presentation only. Learning Engine, SRS, Mastery, Supabase Auth, CloudSync, privacy gates and stored user data keep their existing contracts.

## Design decisions

- Brand accent is `#DDFF66`; hover/active accent is `#CBEF4D`; light tint is `#F7FFD1`.
- Buttons, cards, inputs, progress, navigation states, focus states and the TH asset use shared tokens.
- Learner-facing copy removes release labels (`Pxx`) and unnecessary system terminology. AI remains disclosed in privacy settings, while primary learning actions use names such as “Đề xuất hôm nay”, “Nhận xét”, “Luyện tập cá nhân” and “Trợ giúp học tập”.
- Mobile navigation shows five learning destinations; the separate assistant destination remains on desktop and learning help remains available from the compact help button.
- Existing personalized Home remains the source of truth. Internal priority percentages and disclosure-tier codes are no longer shown.

## Accessibility references

- [WCAG 2.2 — Focus Visible](https://www.w3.org/WAI/WCAG22/Understanding/focus-visible) supports a visible keyboard focus indicator. The app now applies a consistent 3px `:focus-visible` outline.
- [WCAG 2.2 — Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) defines a 24×24 CSS pixel minimum or sufficient spacing. Core app controls keep a stronger 44px minimum for touch use.
- [MDN — Using media queries for accessibility](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Media_queries/Using_for_accessibility) documents `prefers-reduced-motion`; non-essential animations and transitions are reduced when requested.

## Automated evidence

- `node --test tests/*.test.js`: static/unit regression, including brand assets and UI copy.
- `node tests/p50-product-polish-responsive.browser.js http://127.0.0.1:4173/`: real Edge checks at 360, 390, 430, 768, 1024, 1440 and 1920 px; light/dark; no horizontal overflow; mobile/desktop navigation; learning-help panel; progress preservation; beginner/TOPIK/conversation personas.
- All `tests/*.browser.js`: Auth/privacy, CloudSync integrity, PWA/offline, content/admin and feature-route browser regressions.
- `node scripts/verify-production-build.js` and `node scripts/performance-audit.js`: production asset and performance budgets.
