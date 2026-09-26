<!-- audits/04-design-system.md:1393 · section "Type (TYPE)" · area system · kind GAP · rated medium -->
#### GAP-TYPE-2 — No text-size preference and no Dynamic Type hook; F260's page zoom is the only control, and it leaves its 9.5 px label at 10.92 px (investigator rating: medium)

- **What happens.**
  - Every size is a px literal or a px token, and `html` sets `text-size-adjust: 100%` (`apps/design.css:293`).
  - NOT FOUND IN CODE, in `index.html`, `apps/*.html`, `apps/design.css` and the template: `font: -apple-system-body` or any `-apple-system-*` text style, `rem`-based font sizes (F260 and Prayer use `rem` only for max-widths, `apps/f260.html:44`, `apps/prayer.html:50`), or a hub text-size preference. As far as the code shows, iOS Larger Text never reaches the hub; this was not tested on a device.
  - F260 alone offers Large text, as `body.big { zoom: 1.15 }` (`apps/f260.html:50, 2034`; person scope `f260.big`). It zooms the layout as well as the text:
    - 17 → 19.6 px and 25 → 28.8 px;
    - the WEEK ring label 9.5 → 10.92 px, still under 11 (the re-measure read it from the rendered box: 28.11 × 9.5 → 32.33 × 10.92, a ratio of 1.150);
    - on the iPhone it wraps the meta line (VIS-F260-10), and it stops at the F260 frame.
- **Expected.** Grandparents are in the audience, and nothing important may hide behind small type. A person-scope text-size preference, like the theme, should scale the type hub-wide, and ideally follow the OS setting.
- **Why it matters.** A grandparent who needs larger text cannot get it outside F260, and inside F260 some text is still below the floor.
- **Evidence:** `apps/design.css:293`; `apps/f260.html:50, 2034`; `hidden-text.json` (f260 large-text: body zoom 1.15, smallest `span#todayRing > span.rn > small` at 10.92); `remeasure-live-f260-zoom.json`; `code-scan.json` (px or `--fs` tokens only, no `rem`).
- **Reproduction:** `grep -rn "apple-system-body\|-apple-system-headline\|font: *-apple" index.html apps/*.html apps/design.css` (no output); `node audits/tools/phase4/TYPE/hidden-text.mjs --only f260`.
- **Related (not re-filed):** VIS-F260-10 (the wrap). No earlier phase recorded the missing hub-wide setting (a grep of `audits/*.md` for "Larger Text", "text size" and "apple-system-body" finds nothing).

