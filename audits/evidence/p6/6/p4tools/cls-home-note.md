# Home motion while data lands (batch 6): how to read the MOTION/cls numbers

## The default arm (`out/` vs `before/`)
The default `MOTION/cls` arm is the variable-latency one. Its landmark-move count for Home swings from run to run on the same code (batch 5 measured 10–40 on the pre-batch code), so a single run is not a before/after measure.

| Measure | Before | After |
|---|---|---|
| Moves, iPad, one run each | 10 | 46 |
| Moves, iPhone, one run each | 29 | 39 |
| Largest move, iPad (stable) | 403 px | 402 px |
| Largest move, iPhone (stable) | 376 px | 339 px |

The Timer app moves 0 on both devices, and so does the kid Home.

## The held arm (`held/`)
Every data request answers 2.5 s late. Measured after the third final run (final-6c held), on a scratch copy of the final tree against the pre-batch archive (base6 = 084044f), with two runs each.

| Home, held | Pre-batch (run 1 / run 2) | Final (run 1 / run 2) |
|---|---|---|
| iPhone CLS | 0.180 / 0.180 | **0.083 / 0.083** |
| iPhone largest move | 376 px | 339 px |
| iPhone moves | 29 | 30 |
| iPad portrait CLS | 0.016 / 0.043 | 0.050 / 0.043 |
| iPad portrait largest move | 403 px | 403 px |
| iPad portrait moves | 31 | 37 |

- **iPhone:** the layout-shift score halves, and the largest move shrinks.
- **iPad:** the score is the same on the second run of each.
- **The six extra iPad landmark moves** are the Home Timer card's own landmarks (its heading and buttons) moving with the cards around them. The card is new this batch, so there are more landmarks to count; the largest move did not grow.

Moving at all is batch 2a's open carry-over (CONS-MOTION-4 / GAP-MOTION-1).
