# Home motion while data lands: how to read the MOTION/cls numbers

The default `MOTION/cls` run in `out/` and `before/` uses the variable-latency arm. Its landmark-move count for Home swings widely from run to run on the same code:
- Worker C, 4-5 runs each on scratch copies: pre-batch iPad 10-40, iPhone 12-42.
- One run each here: before iPad 10, iPhone 33; after iPad 31, iPhone 38.

A single run's count is therefore not a before/after measure. The largest move is stable:
- iPad: 402 → 403 px.
- iPhone: 391 → 376 px.

The deterministic "held" arm (every data request answers 2.5 s late) was run twice by Worker C and twice by the independent visual reviewer (round 8), on scratch copies:

| | Batch 4 (pre-batch) | First batch-5 build (before the fix) | Final |
|---|---|---|---|
| iPad portrait | 31 moves / 403 px | 32 / 436 | 31 / 403 |
| iPhone | 33 / 391 | 43 / 391 (default arm) · 34 / 391 (held) | 29 / 376 |

The fix: the Kids skeleton keeps its summary line; the loading Verses card takes no place below 1024 px; the hero line reserves its height.

Home moving at all is batch 2a's open carry-over (CONS-MOTION-4 / GAP-MOTION-1). This batch adds none and removes 4 moves and 15 px on the iPhone.
