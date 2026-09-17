# Anderson House Hub

One app for the whole house: the F260 reading plan, the fridge list, prayers, reminders, a family chat helper — with a profile for each person and everything synced between the iPad, phones and the downstairs TV.

**Open it:** https://vantrix117.github.io/house-hub/

## First time on a new device

1. Open the link. It asks for the **house pairing code** — Eli has it. Type it once; the device stays paired.
2. Tap your name.
   - **Kids and the TV** open straight away.
   - **Adults** create a 4–8 digit PIN the first time, and use it after that. Forgot it? Eli can reset it from Me → Admin.
3. That's it. Your reading progress, prayers and settings follow you to any paired device; the fridge list and reminders are shared by everyone.

To switch who is using a device: **Me → Switch profile**.

## Put it on your Home Screen

**iPhone / iPad (Safari):** open the link → Share button → **Add to Home Screen** → Add. Open it from the icon: it runs full-screen and works offline. *Notifications only work from the Home Screen app, not from a Safari tab.*

**Android (Chrome):** menu → **Add to Home screen** (or the install banner).

**Mac / Windows (Chrome or Edge):** the install icon at the right of the address bar → Install.

**Downstairs TV / kiosk iPad:** add to Home Screen, pick the *Downstairs TV* profile once, and leave it. It shows the time, the date and the house reminders, refreshes itself, and cannot change anything. Settings → Display & Brightness → Auto-Lock → Never, and Guided Access if you want it locked to the hub.

## Turning on notifications

Me → **Notifications** → switch it on and allow the prompt. You can choose which reminders you get:

- **Fridge warnings** (adults, 8:00 am) — anything in the Larder Ledger that is about to hit a week old.
- **Reading nudge** (8:00 pm) — if you have not checked off an F260 reading yet that day.

"Send a test notification" confirms it works on that device. On iPhone and iPad this is only available from the Home Screen app (iOS 16.4 or later).

## What's inside

| Tab | What you get |
|---|---|
| **Home** | Today's reading, what to eat from the fridge, your prayer streak, the house reminders (adults can add and clear them), and what everyone has been up to. Pull down to refresh. |
| **Apps** | F260 Reading Plan, Larder Ledger, Prayer, Tally counter, Kitchen timer, the Dollywood guides. Kids see a shorter list with bigger buttons. |
| **Chat** | Ask the house helper things like "what's in the fridge?", "add milk to leftovers", "remind everyone about the bins", "I read week 3 day 2", "pray for Grandma's knee". Each person gets 60 messages a day. Kids get a kid-safe version. |
| **Me** | Switch profile, light/dark, notifications, sync status. Eli also gets the admin panel: edit people, reset PINs, change the pairing code, unpair devices, see usage. |

Everything keeps working offline; changes are sent when the device is back online, and the dot next to **Me** shows the sync state (green synced · amber sending · grey offline · red problem).

## For whoever maintains it

The technical map is in [`CLAUDE.md`](CLAUDE.md) (hosting, data model, adding an app, chat tools, push, admin ops, tests) and [`worker/README.md`](worker/README.md) (the API).
