# Shared list backend (Cloudflare Worker + D1)

> **Already deployed and live** — nothing below needs doing.
> Worker: `https://house-hub-api.catalystfarm1.workers.dev`
> D1 database: `house-hub` (`c5410eee-9095-4092-84b0-dc534aded0d8`, region ENAM)
> Deploy changes with `npx wrangler deploy` from this folder.
> The steps below are kept as a rebuild reference.

Until this is set up, the Larder Ledger saves to whatever device you're on and says
"Saved on this iPad only." Once it's wired up, everyone in the house sees one list.

Everything below is done in the Cloudflare dashboard — no command line, no install.
Free tier throughout; a household uses a rounding error of the daily allowance.

## 1. Cloudflare account

Sign up at [dash.cloudflare.com](https://dash.cloudflare.com). Free plan. You do not
need a domain and you do not need to move your DNS anywhere.

## 2. Create the database

**Storage & Databases → D1 → Create database.** Name it `house-hub`.

Open the new database's **Console** tab, paste the contents of [`schema.sql`](schema.sql),
and run it. That creates the single `leftovers` table.

## 3. Create the Worker

**Compute / Workers & Pages → Create → Start from Hello World → Deploy.**
Name it `house-hub-api`.

Then **Edit code**, delete the placeholder, paste all of
[`leftovers-worker.js`](leftovers-worker.js), and **Deploy**.

## 4. Connect the two

This is the step that's easy to miss. In the Worker:

**Settings → Bindings → Add → D1 database**

- Variable name: **`DB`** — exactly this, uppercase. The Worker looks for `env.DB`.
- D1 database: `house-hub`

Deploy again after adding the binding.

## 5. Point the app at it

Copy the Worker's URL — it looks like `https://house-hub-api.catalystfarm1.workers.dev`.

Check it works by opening `<that URL>/items` in a browser. You should see:

```json
{"items":[]}
```

Then in [`../apps/leftovers.html`](../apps/leftovers.html), put it in the `API` line near
the top of the `<script>` block:

```js
const API = 'https://house-hub-api.catalystfarm1.workers.dev';
```

Commit and push. Within a minute every iPad in the house is on the same list.

## How it behaves

- Each device polls every 20 seconds, and immediately whenever the app is reopened.
- Adding or removing shows instantly on the device that did it, then confirms with the server.
- If the Worker can't be reached, the app keeps showing the last list it saw and says so.
  A write attempted while offline is undone and reported rather than silently dropped.
- Items are added and deleted one at a time, so two people editing at once don't
  overwrite each other's changes.

## Worth knowing

**The endpoint is open.** Anyone who has the URL can read or change the list. It's in the
page's JavaScript and this repo is public, so treat it as discoverable. For a fridge list
that's a fine trade — the worst case is a list you clear in a few taps. If it ever matters,
two options: add a shared passphrase the Worker checks, or move hosting to Cloudflare Pages
or Netlify from a private repo (both free) so the URL isn't in public source.

**No credentials live in this repo.** The Worker URL is not a secret key; the database is
only reachable through the Worker.

## If something's wrong

| What you see | Cause |
|---|---|
| `D1 binding "DB" is missing` | Step 4 — binding absent or not named exactly `DB` |
| `no such table: leftovers` | Step 2 — `schema.sql` wasn't run in the D1 console |
| App still says "Saved on this iPad only" | `API` in `apps/leftovers.html` is still empty, or the change isn't pushed yet |
| "Can't reach the house list" | Worker URL wrong, or Worker not deployed |
