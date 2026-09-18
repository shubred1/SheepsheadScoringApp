# Feature Backlog

## Round of Doublers

Planned as a generic manual feature, not one tied only to a 60-point loss. The user chooses how many upcoming hands the round affects; the default may use the number of players currently in rotation, but remains editable.

The schedule, scoring, persistence, and Undo behavior are implemented in Stage 1. The remaining work is user controls for **Start Now** (overlapping layers) and **Add to End** (queued hands), plus a scoring-screen indicator for active doublers and hands remaining. The per-hand multiplier may exceed the current doubler base; the effective multiplier is the greater of the two. History uses existing effective multiplier badges (`2x`, `4x`, `8x`, and so on); no separate star indicator is planned.
