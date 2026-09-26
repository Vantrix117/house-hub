<!-- audits/02-shell.md:4818 · section "Notifications, voice add, activity feed, PWA install" · area shell · kind GAP · rated medium -->
- **PWA-GAP-1 · "Timer done" is a local notification only (gap, medium).**
  - `timerNotify` calls `showNotification` only if permission is already `granted` (index.html:797-803).
  - It runs only from `finishTimer`: while the shell's JS is running, less than 60 s after `endAt`, and not while the Timer app is open (index.html:804-810).
  - The only `Notification.requestPermission` is the push switch (index.html:1561). No server job knows about timers (worker/src/reminders.js).
  - Locked-phone behaviour needs a device.
  - The shared-iPad side is a separate defect: switching people silences a running kitchen timer. That is P2-PROF-08 (Profiles section).
