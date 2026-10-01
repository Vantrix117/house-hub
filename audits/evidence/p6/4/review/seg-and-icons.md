# Round 1: the one segmented control, icon sizes, chevrons (Worker B → Worker P)

All three are live in `apps/design.css`'s component half now (the token half is byte-identical).

## 1. The segmented control: ONE recipe hub-wide
`:is(.ds .seg, .segmented)` — the shell's `.ds .seg` and a GLOBAL `.segmented` class (for apps without `.ds`) share it:
- track: `background: var(--track)` + an inset `--separator` hairline (visible on Hearth, where `--surface-2` = the page);
  `padding: var(--sp-1); gap: var(--sp-1)`; corners `calc(var(--tap) / 2 + var(--sp-1))` (concentric with the capsules).
- items: capsules (`--r-full`), `min-height: var(--tap)`, `padding: 0 var(--sp-4)`, `flex: 1 1 auto; min-width: 0`,
  `white-space: nowrap`, `--text-2`, `--fw-medium`; the track does NOT wrap (`flex-wrap: nowrap`), so a two-choice control holds
  one row at XXL (a group that may run long opts into `flex-wrap: wrap` itself).
- selected (`.on` or `[aria-pressed="true"]`): `--sel-fill-strong` / `--sel-ink-strong` / `--sel-weight` / `--elev-control`.
- press: `--press-scale` + `--press-dim`; hover (fine pointer only) `--hover` + `--text`; `:disabled` → `--op-disabled`.

**Prayer should DROP** (they now fight or duplicate the shared recipe): any own `background`, `border-radius`, `padding`, `gap` on
`#listSwitch` / `#addListSwitch` (`.hdr .seg`, `.addto .seg`), any own `border-radius` / `min-height` / colour / selected-state on
their buttons, and `white-space: nowrap` (shared now). **Prayer may KEEP**: `flex: 0 0 auto` on the track, its own font-size
(`--fs-footnote`) and the item padding if it wants it tighter (`0 var(--sp-4)` is the shared value anyway), `letter-spacing`.
Keep `class="seg"` inside the `.ds` wrapper (as today) or put `class="seg segmented"` if the control sits outside a `.ds`.

## 2. Icons follow the text size
`svg.sym` (and `.sym-xs/-md/-lg/-xl`) is now `calc(var(--icon-*) * var(--ts-user, 1))`: a glyph beside a word grows with the
person's text size; the stroke stays 1.75 px (non-scaling). If Prayer sets its own icon sizes (e.g. the kid hands, the FAB +, the
chevrons), write them the same way: `width: calc(var(--icon-md) * var(--ts-user))` (kid scale is already in `--icon-k`).
Do NOT size an icon in `em` and do not put a `stroke-width` on it.

## 3. One drawing per meaning (Table ICON-6), the convention F260 now uses
- **Expand / collapse (a disclosure)** = `i-chevron-down`, turned `rotate(-90deg)` while closed and upright when open
  (F260: the week headers and the "Practice N verses" fold). For a `<details>`: `details:not([open]) .chev{transform:rotate(-90deg)}`.
- **Next / go to (navigation)** = `i-chevron-right`; **Previous / back** = `i-chevron-left` (F260: the week stepper and reading
  mode's arrows). So Prayer's row "open this" chevron → `i-chevron-right`; its "Needs attention" `<details>` chevron →
  `i-chevron-down` with the rotation above.
- New symbol `i-book-marked` (Lucide book-marked): F260's "First reading" milestone (Reading mode keeps `i-book-open`).
