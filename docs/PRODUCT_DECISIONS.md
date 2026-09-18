# Product Decisions

These are durable product choices; planned decisions are included when they guide future implementation.

- Multiple saved games are first-class. New Game is a draft until **Start Game**; it does not create a saved game before then.
- A Game Name belongs in both New Game and Game Settings. The active name appears below the app header. The date-based New Game placeholder is saved when the name field is left blank.
- The Games modal switches or deletes games; it intentionally has no inline rename control. Rename through Game Settings.
- Deleting the final saved game returns the app to mandatory New Game creation.
- Player array order is seating order. Players can be reordered, and new players can be added within a game type's supported maximum. Existing players are not deleted.
- Skip is the way to exclude a player from current rotation. It is preferable to deletion because history is keyed by stable player IDs.
- Reordering affects future seating/UI order only. Historical hands retain their player-ID associations and stored deltas.
- A game type is selected at creation and cannot be changed afterward.
- Edit Hand changes only the selected hand's roles, outcome, multiplier, sitters, and deltas. It updates totals but does not replay or alter later hands.
- Undo Last Hand is separate from Edit Hand. There is no arbitrary historical-hand deletion UI.
- First run, and the state after the last game is deleted, opens a mandatory New Game modal.
- The app favors local-first browser use: no account, sync, or server-side game state is required.

## Round of Doublers (Stage 1 model)

- The game stores upcoming hands' doubler layer counts. **Start Now** adds a layer to the next N hands; **Add to End** appends N one-layer hands. The feature is generic, not tied only to a 60-point loss.
- The current doubler base is `2 ^ layer count`. The effective hand multiplier is the greater of the selected per-hand multiplier and that base; a higher hand multiplier is retained rather than multiplied by the base.
- Submitting consumes one schedule entry and saves a pre-submit schedule snapshot for exact Undo restoration. Edit Hand does not change the current schedule. Older games default to an empty schedule without a data-version reset.
- The round controls and scoring-screen status are still planned. The hand count will be editable, potentially defaulting to players currently in rotation. History uses the existing effective multiplier badges; no separate star indicator is planned.
