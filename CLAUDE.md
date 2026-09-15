# House Hub — instructions for Claude

This repo is a static site served by GitHub Pages at **https://vantrix117.github.io/house-hub/**.
It is a launcher: `index.html` reads `apps.json` and renders a tile per app. Each app is one
self-contained HTML file in `apps/`.

There is no build step, no bundler, no framework, no package.json. Do not add one.

## Adding an app

### 1. Write the app as a single file: `apps/<id>.html`

Hard requirements:

- **Self-contained.** All CSS in a `<style>` block, all JS in a `<script>` block, both inline in
  the same file. No external scripts, no CDN links, no imports, no fonts fetched over the network.
  Use system fonts (`-apple-system, system-ui, sans-serif`).
- **No build step.** The file must work when opened directly in a browser.
- **`localStorage` is allowed and encouraged** for persistence. Namespace keys by app id
  (e.g. `chores.items`) so apps do not collide. Wrap reads/writes in `try/catch` — Safari can throw
  in private browsing.
- **Must work on iPad Safari, iPhone Safari, and desktop browsers (Chrome/Edge/Safari on Mac
  and Windows).** The hub is the family's one-stop shop and gets used on all three. Design
  touch-first, then make sure it is also good with a mouse and keyboard:
  - No hover-only affordances, no right-click, no keyboard shortcuts as the only path to an
    action. Hover styles are welcome but only under `@media (hover: hover) and (pointer: fine)`.
  - Layout must work from ~375px (phone portrait) through ~1400px (desktop) without horizontal
    scrolling. Test at phone width, iPad width, and desktop width before calling it done.
  - Inputs and dialogs should support Enter/Escape; anything tappable must also be focusable.
- **Big touch targets.** Minimum 44×44 CSS px for anything tappable; 60px+ for primary buttons.
  Generous spacing so a stray thumb does not hit the wrong control. Keep the same sizes on
  desktop — they are fine with a mouse.
- Include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Use `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` to avoid the
  double-tap zoom delay and grey flash.
- Respect the safe area on iPad and iPhone (`env(safe-area-inset-*)`) if the app has edge-anchored controls.
- The app runs inside an iframe in the hub. Keep it working standalone too — do not depend on
  the parent frame.

### 2. Add exactly one entry to `apps.json`

```json
{ "id": "chores", "name": "Chore board", "file": "apps/chores.html", "color": "#5B6FA8", "icon": "✓" }
```

| Field   | Meaning |
|---------|---------|
| `id`    | Short, lowercase, no spaces. Also the deep link: `…/index.html#chores`. Must match the filename. |
| `name`  | Label shown on the tile. Keep it short enough to fit. |
| `file`  | Path relative to the repo root — always `apps/<id>.html`. |
| `color` | Tile background, any hex. Pick something distinct from the existing tiles. |
| `icon`  | A single character or emoji. |

Optional: `"dark": true` makes the viewer background dark while the app loads — use it for apps
with a dark UI so there is no white flash.

Keep `apps.json` valid JSON: no trailing commas, no comments.

### 3. Commit, push, and verify it is live

After creating the app, always:

```bash
git add apps/<id>.html apps.json
git commit -m "Add <name> app"
git push
```

Then **confirm the file actually returns 200 on the live URL** — do not stop at "pushed".
GitHub Pages takes 30–90 seconds to rebuild, so poll:

```bash
until [ "$(curl -s -o /dev/null -w '%{http_code}' https://vantrix117.github.io/house-hub/apps/<id>.html)" = "200" ]; do sleep 10; done; echo live
```

Also check `https://vantrix117.github.io/house-hub/apps.json` reflects the new entry.
Report the result of that check, not just that the push succeeded.

## The one app with a backend

`apps/leftovers.html` (Larder Ledger) is the exception to "no network requests". It syncs a
shared household list through a Cloudflare Worker + D1 database — see [`worker/README.md`](worker/README.md).

- Its `API` constant near the top of the `<script>` block holds the Worker URL. Empty means
  local-only, and the app still works that way; it just says "Saved on this iPad only."
- Requests carry an `X-House-Key` header holding the household passphrase, kept in
  `localStorage` under `house.key` — hub-wide, so a future shared app reuses it. A `401`
  clears the stored key and shows the unlock screen.
- **Never put the passphrase in this repo.** It's a Cloudflare secret (`HOUSE_KEY`) on the
  server and a per-device `localStorage` value on the client. If you add a shared app,
  reuse `house.key` rather than inventing a second passphrase.
- It still obeys every other rule: one file, no build step, no external scripts, plain `fetch`.
- `localStorage` is its offline cache, not its source of truth.
- The Worker lives in `worker/`. It is deployed from the Cloudflare dashboard, not from this
  repo — editing `worker/leftovers-worker.js` here changes nothing until it's pasted in and
  redeployed. Say so rather than implying a push deploys it.

**New apps should still default to localStorage-only.** Only add a backend when the app
genuinely needs to be shared between people, and ask first — it's a real dependency.

## Do not touch

- `index.html` — the hub shell. Leave it alone unless explicitly asked to change the hub itself.
- `apps/tally.html`, `apps/timer.html` — the starter apps.
- The Larder Ledger's visual design — it's a port of an artifact the owner picked deliberately.
  Fix bugs, but don't restyle it.
- `.nojekyll` — required, keeps GitHub Pages from running Jekyll and dropping files.
- `manifest.json`, `icon.svg` — Home Screen install metadata.
