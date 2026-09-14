# Agent Guide

Work primarily on `dev`. `main` is the production branch published by GitHub Pages.

This is a static, mobile-first HTML/CSS/JavaScript application. There is no framework, bundler, or build system; keep the repository structure simple unless a task explicitly requests otherwise.

Protect these invariants:

- Preserve installed PWA and offline behavior.
- Preserve existing localStorage data unless a task explicitly requires a schema change.
- Game, player, and hand IDs are stable. Player reordering must never rewrite historical identity.
- Do not delete players from an existing game. Use Skip/sitting behavior instead, without damaging historical hands.
- Edit Hand changes only the selected historical hand and recalculates displayed totals; it does not replay later hands.
- Multiple saved games remain isolated.
- Game type cannot change after creation.
- Avoid unrelated refactors, especially in scoring and state handling.
- When application assets change, review whether `version.js` needs a cache-version bump.
- Verify scoring and state changes carefully, including sitting players, stored IDs, and edit behavior.

Read these before making feature work:

- [Current status](PROJECT_STATUS.md)
- [Product decisions](docs/PRODUCT_DECISIONS.md)
- [Data model](docs/DATA_MODEL.md)
- [Scoring rules](docs/SCORING_RULES.md)
- [PWA notes](docs/PWA_NOTES.md)
