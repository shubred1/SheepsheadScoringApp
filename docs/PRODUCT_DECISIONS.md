# Product Decisions

These are durable, implemented product choices rather than a feature roadmap.

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
