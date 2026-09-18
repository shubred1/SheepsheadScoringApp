# Project Status

Sheepshead Scorekeeper is a local-first, mobile-first scoring app for Sheepshead games. It is a static HTML/CSS/JavaScript site: work happens on `dev`; `main` is the GitHub Pages production branch.

Current features:

- Four game types: 3-Handed, 4-Handed Cut Throat, 4-Handed Partners, and 5-Handed.
- Multiple independent saved games, with an active-game name below the header and a Games modal for switching or deleting games.
- Player naming, seating-order reordering, supported player additions, and Skip/sit rotation.
- Current-hand roles, configurable rule settings, Leaster, Moster, multipliers, scoring history, Edit Hand, and Undo Last Hand.
- Round of Doublers: configurable upcoming-hand multiplier layers with overlap, append, active status, multiplier floors, exact Undo restoration, and browser-local persistence.
- Hand History supports oldest/newest ordering, hand/totals views, role highlighting, and a compact `★` details column with outcome/multiplier badges.
- Browser-local persistence and installable/offline PWA support.

Current limitations / likely next work:

- No cloud sync, export/import, accounts, or cross-device sharing.
- Existing players cannot be removed; Skip is the supported alternative.
- Game type cannot be changed after a game is created.
- Only the latest hand can be undone; historical hands can be edited but not arbitrarily deleted.
- Saved data is browser/device-specific and an incompatible storage-version change currently resets app data.

See [product decisions](docs/PRODUCT_DECISIONS.md), [data model](docs/DATA_MODEL.md), [scoring rules](docs/SCORING_RULES.md), and [PWA notes](docs/PWA_NOTES.md) for implementation detail.
