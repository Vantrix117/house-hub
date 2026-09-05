# Anderson House Hub

A single page that launches your Claude-built apps full-screen on the iPad and switches between them with one tap.

## Files

- `index.html` – the hub (clock + tile grid + app viewer + switcher sheet)
- `apps.json` – the list of apps. This is the only file you edit to add/remove an app.
- `apps/` – one self-contained `.html` file per app
- `manifest.json`, `icon.svg` – lets the hub install as a Home Screen app

## Put it on GitHub Pages (one time)

1. Create a new repo on GitHub (e.g. `house-hub`), public or private.
2. Upload every file in this folder to the root of the repo, keeping the `apps/` folder.
3. Repo → Settings → Pages → Source: "Deploy from a branch" → Branch: `main` / root → Save.
4. Wait ~1 minute. Your hub is at `https://vantrix117.github.io/house-hub/` (repo name may differ).

## iPad setup (one time)

1. Open the URL in Safari → Share → Add to Home Screen → Add.
2. Open it from the Home Screen (this hides Safari's bars and makes it full-screen).
3. Settings → Display & Brightness → Auto-Lock → Never.
4. Optional: Settings → Accessibility → Guided Access → on, then triple-click the top button while in the hub to lock the iPad to it.

The hub also asks Safari for a screen wake lock once you tap anything, as a second line of defense against the screen dimming.

## Add an app

1. Ask Claude for a **single-file HTML app** (everything inline: CSS, JS, no build step). It can use `localStorage` freely.
2. Save it as `apps/<id>.html` in the repo (GitHub app or website → Add file → Upload files, or let Claude Code push it).
3. Add one entry to `apps.json`:

```json
{ "id": "chores", "name": "Chore board", "file": "apps/chores.html", "color": "#5B6FA8", "icon": "✓" }
```

- `id` – short, no spaces; also works as a direct link (`…/index.html#chores`)
- `color` – tile color, any hex
- `icon` – one character or emoji
- `dark: true` – optional, makes the viewer background dark while the app loads

Commit. The hub reloads `apps.json` every time it opens, so the new tile appears within a minute of GitHub Pages rebuilding.

## Using the hub

- Tap a tile to open it. The most recently used app moves to the front and gets a gold dot.
- While an app is running, tap the pill at the bottom to switch apps, reload the current app, or go Home.
- Reloading the page keeps you in the same app (the app id is in the URL hash).
