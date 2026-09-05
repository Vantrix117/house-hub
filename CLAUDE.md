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
- **Must work on iPad Safari.** This is the only target that matters. Assume touch, not mouse:
  no hover-only affordances, no right-click, no keyboard shortcuts as the only path to an action.
- **Big touch targets.** Minimum 44×44 CSS px for anything tappable; 60px+ for primary buttons.
  Generous spacing so a stray thumb does not hit the wrong control.
- Include `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`.
- Use `-webkit-tap-highlight-color: transparent` and `touch-action: manipulation` to avoid the
  double-tap zoom delay and grey flash.
- Respect the safe area on iPad (`env(safe-area-inset-*)`) if the app has edge-anchored controls.
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

## Do not touch

- `index.html` — the hub shell. Leave it alone unless explicitly asked to change the hub itself.
- `apps/tally.html`, `apps/timer.html` — the starter apps.
- `.nojekyll` — required, keeps GitHub Pages from running Jekyll and dropping files.
- `manifest.json`, `icon.svg` — Home Screen install metadata.
