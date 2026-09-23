// Kitchen timer (apps/timer.html): person scope, keys 'timer.active' and 'lastPreset'.
//   empty     nothing: the app opens idle on its 5:00 default
//   typical   PLOT.timerRunningFor (Elizabeth) has a 15-minute timer running: started 08:31:20, 6:20 left at the
//             demo instant (the browser clock is fixed, so the remaining time is static in every capture).
//             Eli has no running timer (the shell pill would otherwise sit on every Eli capture); his last preset is 10 min.
//   overflow  Elizabeth's timer is a 2-hour one with 104:05 left (a three-digit minute count, to stress the dial and the
//             shell pill). The presets stop at 30 min, but the record can come from elsewhere (chat's set_data writes any
//             timer key). Eli's last preset is the longest chip, 30 min.
//   park      same as typical.
import { PLOT } from './story.mjs';

export default function timer(h) {
  if (h.empty) return;
  const who = PLOT.timerRunningFor;   // 'mom'

  // apps/timer.html:81 reads Number(hub.get('lastPreset', { default: 300 })), in seconds; :124 writes one of the preset
  // values (60/180/300/600/900/1800, :61-66)
  h.person('eli', 'timer', 'lastPreset', h.overflow ? 1800 : 600, h.time(-1, '17:45'));
  h.person(who, 'timer', 'lastPreset', 900, h.time(-1, '18:10'));

  // apps/timer.html:77, 90, 117 (and the shell, index.html:785-787, 813-823): timer.active = { endAt, total, startedAt }:
  // endAt and startedAt are epoch ms, total is seconds; the app resumes it only while endAt > Date.now() (:129).
  // Anchored on the demo minute (h.now can run a few ms past it), so the browser, fixed at the demo instant, reads
  // exactly 6:20 / 104:05.
  const demo = h.now - (h.now % 60000);
  const total = h.overflow ? 7200 : 900;
  const elapsed = h.overflow ? 955 : 520;              // seconds since Start: left 6245 s (104:05) / 380 s (6:20)
  const startedAt = demo - elapsed * 1000;
  h.person(who, 'timer', 'timer.active', { endAt: startedAt + total * 1000, total, startedAt }, startedAt);
}
