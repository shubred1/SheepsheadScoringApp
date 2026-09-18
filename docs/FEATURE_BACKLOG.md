# Feature Backlog

## Round of Doublers

Implemented as a generic manual feature, not one tied only to a 60-point loss. The user chooses how many upcoming hands the round affects; the default uses the number of players currently in rotation, but remains editable.

Stage 1 implements the schedule, scoring, persistence, and Undo. Stage 2 adds the menu modal for **Start Now**, **Add to End**, and confirmed ending; an active scoring-screen badge; and a multiplier floor in the UI. The per-hand multiplier may exceed the current doubler base; the effective multiplier is the greater of the two. History uses existing effective multiplier badges (`2x`, `4x`, `8x`, and so on); no separate star indicator is planned. Stage 3 remains for edge-case polish and regression testing.
