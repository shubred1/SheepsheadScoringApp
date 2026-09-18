# Data Model

All data is JSON in localStorage under `sheepshead_scorekeeper_data`.

At the top level:

```text
{
  dataVersion: 3,
  preferences: { theme: "dark" | "light" },
  games: Game[],
  activeGameId: string | null
}
```

`Game` contains:

- `id`, `name`, `createdAt`, `updatedAt`
- `mode`: `three`, `cut-throat`, `partners`, or `five`
- `handed`: derived active-player target (`3`, `4`, or `5`) retained alongside `mode`
- `playerCount`, `players`, and `fixedSatIds`
- `doubleOnBump`, `noTrickPartnerDoesntLose`
- `roles`: `{ pickerId, partnerId, satIds }` for the in-progress hand
- `history`: `Hand[]`
- `doublerSchedule`: upcoming hands' doubling-layer counts, e.g. `[2, 2, 1]`; missing values in older games normalize to `[]`
- `historyNewestFirst` and `historyShowTotals`

A `Player` is `{ id, name }`. IDs are generated with a `player-` prefix and remain stable when the array is reordered. The active players are the first `playerCount` entries; the app retains up to eight player records for future additions.

A `Hand` is stored as:

```text
{
  id,
  pickerId,
  partnerId,
  satIds,
  outcome,
  multiplier,
  deltas: { [playerId]: number }
}
```

Hands that consume a doubler schedule entry also store `doublerScheduleBefore`, a copy of the complete schedule immediately before submission. Their `multiplier` is the effective multiplier used for scoring. Undo restores this snapshot. Older hands have no such field and remain valid.

`pickerId` is also the selected player for Leaster (`outcome: "leaster"`) and Moster (`outcome: "moster"`); `partnerId` is `null` for both. `satIds` records the players sitting for that hand. `deltas` is keyed by stable player ID, not player-array index. This is why reorder must not rewrite history and why totals remain historically correct after seating changes.

The runtime normalizes older compatible game objects, including deriving `mode` from legacy `handed` values. A missing, unparsable, or incompatible `dataVersion`/shape triggers the implemented compatibility reset: a new empty app data object is saved and the user sees the storage-updated notice. Do not raise `dataVersion` casually; that path replaces saved app data under this key.
