# F260 and Prayer: why some shots differ though batch 5 did not change either app

Batch 5 left `apps/f260.html`, `apps/prayer.html` and `apps/design.css` unchanged. It made two shared changes that reach these apps:
- `icons/sprite.svg` gained 4 new symbols, and `i-star` now reads `fill: var(--sym-fill, none)`. With nothing set, it draws as before.
- `apps/hub.js` added `draggable="false"` to the avatar `<img>`.

## Two comparisons

| Comparison | F260 shots changed | Prayer shots changed |
|---|---|---|
| Batch-4 final capture (`pxdiff-*-vs-4.txt`) | 23 | 20 |
| The PRE-batch code (archive 1ba5cec), recaptured the same evening (`pxdiff-*-vs-prebatch-recapture.txt`) | 18 | 23 |

## What the changed shots show
- The sets of changed shots differ between the two comparisons.
- `f260/complete-overflow-desktop-dark` (a toast) and `prayer/settings-categories-*` (a 1 px shift) differ only against batch 4's capture. Against the pre-batch recapture they are identical. So they come from the capture day and environment, not from this batch's code.
- In every changed pair that was opened, the content is identical. Only the scroll position behind the content differs:
  - `hear-typical-desktop-light`: the week pane is 8 px higher;
  - `practice-overflow-ipad-landscape-light`: the page behind the modal is 37 px higher;
  - `kid-faces-overflow-iphone-pwa-light`: a 1 px scroll.
- That is F260's smooth scroll to the current week, and the capture moment.
- `apps/*` text: "Kitchen timer" anti-aliasing only.

## Conclusion
No visible change in F260 or Prayer comes from batch 5.
