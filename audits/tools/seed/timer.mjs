// Kitchen timer (apps/timer.html, apps/hub.js hub.timers). Since batch 6: person scope, one row per timer,
// timer:<id> = { id, label, total, startedAt, endAt, pausedAt, remaining, by, ackAt } (every time in server ms, total and
// remaining in ms), the person's 'recents' [{ total, label }] and the family mirror run:<owner>:<id> that the Kitchen iPad
// and the TV read. 'lastPreset' (seconds) is the pre-batch-6 row the app still reads for its first idle length.
//   empty     nothing: the app opens idle on its 5:00 default
//   typical   PLOT.timerRunningFor (Elizabeth) has one 15-minute timer running, 6:20 left at the reset; three recents.
//             Eli has no running timer (the shell pill would otherwise sit on every Eli capture); his last preset is 10 min.
//   overflow  Elizabeth has three timers (the most): one over an hour (1:44:05 left), one with a long label, one paused
//             (2:10 left); three recents with long labels. Eli's last preset is the longest chip, 30 min.
//   park      THE MIGRATION VARIANT: Elizabeth's 15-minute timer is still the pre-batch-6 single row timer.active
//             ({ endAt, total in s, startedAt }), with no mirror; the shell shows it as one running timer and the Timer
//             app moves it to timer:m<startedAt> when it opens (captured as timer/migrated).
// Times are on the Worker's clock: the rig's demo clock starts at the demo instant at every reset and then runs in real
// time, and hub.js counts in server time (hub.serverNow()), so a timer counts down by the seconds since the reset (a
// capture shows 6:20 to about 6:00). States that need a timer to end (ringing, ended unseen) are written by the timer
// area's screen scripts, relative to hub.serverNow(), on an isolated database.
import { PLOT } from './story.mjs';

export default function timer(h) {
  if (h.empty) return;
  const who = PLOT.timerRunningFor;   // 'mom'
  h.person('eli', 'timer', 'lastPreset', h.overflow ? 1800 : 600, h.time(-1, '17:45'));
  h.person(who, 'timer', 'lastPreset', 900, h.time(-1, '18:10'));

  const demo = h.now - (h.now % 60000);               // the demo minute (h.now can run a few ms past it)
  if (h.park) {                                        // the migration variant: the old single row, as a device left it
    const startedAt = demo - 520 * 1000;
    h.person(who, 'timer', 'timer.active', { endAt: startedAt + 900 * 1000, total: 900, startedAt }, startedAt);
    return;
  }
  const put = (id, { label = '', total, elapsed, paused = false }) => {
    const startedAt = demo - elapsed * 1000;
    const row = paused
      ? { id, label, total: total * 1000, startedAt, endAt: null, pausedAt: demo - 40000, remaining: (total - elapsed + 40) * 1000, by: who, ackAt: null }
      : { id, label, total: total * 1000, startedAt, endAt: startedAt + total * 1000, pausedAt: null, remaining: null, by: who, ackAt: null };
    h.person(who, 'timer', 'timer:' + id, row, startedAt);
    const { label: l, total: t, endAt, pausedAt, remaining, by } = row;
    h.family('timer', `run:${who}:${id}`, { label: l, total: t, endAt, pausedAt, remaining, by, startedAt }, startedAt);
  };
  if (h.overflow) {
    put('rigroast', { total: 7200, elapsed: 955 });                                                           // 1:44:05 left, over an hour
    put('riglasagne', { label: 'Lasagne for the church potluck, the big dish on the bottom rack', total: 2700, elapsed: 1500 });   // 20:00 left
    put('rigtea', { label: 'Tea', total: 300, elapsed: 210, paused: true });                                   // paused 40 s ago with 2:10 left
    h.person(who, 'timer', 'recents', [
      { total: 2700000, label: 'Lasagne for the church potluck, the big dish on the bottom rack' },
      { total: 7200000, label: '' }, { total: 300000, label: 'Tea' }], demo - 955000);
  } else {
    put('rigoven', { total: 900, elapsed: 520 });                                                              // 6:20 left
    h.person(who, 'timer', 'recents', [{ total: 900000, label: '' }, { total: 720000, label: 'pasta' }, { total: 180000, label: '' }], demo - 520000);
  }
}
