# Scoring Rules

This document describes the app's implemented scoring, not generic Sheepshead rules.

## Game types, players, and roles

| Game type | Valid player counts | Roles |
| --- | --- | --- |
| 3-Handed | 3, 4 | Picker only |
| 4-Handed Cut Throat | 4, 5 | Picker only |
| 4-Handed Partners | 4, 5 | Picker plus optional partner |
| 5-Handed | 5, 6, 7, 8 | Picker plus optional partner |

Sitting-player count is `playerCount - handed`. Fixed Skip players stay sitting; other sitters rotate after a submitted hand. Sitting players receive no hand delta. In picker-only modes, tapping another eligible player moves the picker in Cut Throat; the normal selection state also supports filling missing sit slots. Partner-capable modes use the normal picker/optional-partner interaction.

Outcomes stored in each hand are `win`, `schneider`, `schwarz`, `loss`, `schneider-loss`, `schwarz-loss`, `leaster`, and `moster`. The normal per-hand multiplier control offers 1, 2, 4, 8, 16, 32, or 64. Overlapping doubler layers can produce a higher effective multiplier, which multiplies the final base values.

## Round of Doublers

Each game has a schedule of doubling-layer counts for upcoming hands. The current base is `2 ^ first entry`, or `1x` when the schedule is empty. The menu modal defaults its editable hand count to players currently in rotation, excluding fixed Sitting players. **Now** adds a layer to each of the next N entries, extending the schedule; **End** appends N entries with one layer each. Ending doublers clears only the upcoming schedule after confirmation and resets the in-progress multiplier selection to 1x. The current hand's effective multiplier is the greater of its selected multiplier and the doubler base; multiplier choices below the base are disabled. Score Hand reports all doubler hands remaining and any later segment with a higher base. A successful submission consumes the first entry and stores the effective multiplier in hand history. Undo restores the schedule snapshot saved on that hand. Editing a hand preserves its original doubler minimum without changing the current schedule.

## Standard outcomes

For picker-alone hands (all 3-Handed and Cut Throat hands, plus a Partners/5-Handed hand with no partner), each active defender receives the applicable defender value and the picker receives the balancing opposite total:

| Outcome | Defender base value |
| --- | --- |
| Win | -1 |
| Schneider win | -2 |
| No Tricks / Schwarz win | -3 |
| Loss | +1 × bump factor |
| Schneidered loss | +2 × bump factor |
| No Tricks Taken loss | +3 × bump factor |

For 5-Handed with a partner, the picker/partner/defender bases are respectively `+2/+1/-1`, `+4/+2/-2`, and `+6/+3/-3` for win, Schneider, and Schwarz. Losses reverse those signs and use the bump factor.

For 4-Handed Partners with a partner, picker and partner score equally and defenders score the equal opposite: ±1 standard, ±2 Schneider, ±3 Schwarz. Loss outcomes use the bump factor; wins do not. If no partner is selected, the app uses the picker-alone balancing method above.

## Rule settings

`Double on the bump` is enabled for every game type. When on, the bump factor is 2; otherwise it is 1. It affects standard loss, Schneidered loss, and No Tricks Taken loss, including 4-Handed Partners loss outcomes. It does not affect wins, Leaster, or Moster.

`No trick partner doesn't lose` is enabled only for 5-Handed. For a 5-Handed No Tricks Taken loss with a partner, the partner receives 0 and the picker is adjusted to preserve zero-sum scoring. The setting is disabled and ignored outside 5-Handed, even if stale stored data says it is true.

## Leaster and Moster

Leaster requires exactly one selected active, non-sitting, non-Skip winner. The winner is held in `pickerId`, but rendered as a purple **Leaster** role. There is no partner. Selection can move to another eligible player; sit-out interaction remains available.

For `N` active non-sitting players, every non-winner gets `-1 × multiplier` and the winner gets `(N - 1) × multiplier`. Sitting/Skip players get 0. Leaster ignores both rule settings.

Moster uses the same single-player selection, `pickerId` storage, purple styling, and sitting behavior, but the selected player loses. For `N` active non-sitting players, the selected player gets `-(N - 1) × multiplier` and every other player gets `+1 × multiplier`. Sitting/Skip players get 0. Moster ignores both rule settings.

## History details

The `★` Hand History column uses stored `outcome` and `multiplier`, not inferred deltas:

- `NS`: Schneider (green when picker won, red when picker lost)
- `NT`: No Tricks / Schwarz (green when picker won, red when picker lost)
- `L`: Leaster (purple)
- `M`: Moster (purple)
- `2x`, `4x`, `8x`, and higher: neutral effective multiplier badge

An outcome badge and multiplier badge stack in one compact cell. Standard 1× hands have no result badge.
