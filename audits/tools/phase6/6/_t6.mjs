// Batch 6 helpers for the copied Phase 2/3 timer scripts (the *-6.mjs files here). Batch 6 replaced the single person row
// timer.active = { endAt, total in s, startedAt } with one row per timer, timer:<id> = { id, label, total (ms), startedAt,
// endAt, pausedAt, remaining, by, ackAt }, every time in the house's clock (apps/hub.js hub.timers). The copies write and
// read that contract through these helpers; nothing else in them changed unless their header says so.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../../lib/local.mjs';
export const EVD6 = path.join(ROOT, 'audits', 'evidence', 'p6', '6');
fs.mkdirSync(EVD6, { recursive: true });
export const save6 = (name, obj) => { const f = path.join(EVD6, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); return path.relative(ROOT, f).split(path.sep).join('/'); };
/** The contract row for what the old scripts wrote as timer.active ({ endAt, total in s, startedAt }). */
export const rowOf = (v, id = 't6', by = 'eli') => v && {
  id, label: '', total: (+v.total || 60) * 1000, startedAt: +v.startedAt || (+v.endAt - (+v.total || 60) * 1000), endAt: +v.endAt,
  pausedAt: null, remaining: null, by, ackAt: null,
};
/** The person's live timer rows on the server: [{ key, value, updated_at }]. */
export async function timerRows(L, pid = 'eli') {
  const r = await L.apiAs(pid, '/api/data/timer?scope=person');
  return ((r.body && r.body.items) || []).filter(i => /^timer:/.test(i.key) && i.value != null);
}
/** The first live row's value (what the old scripts read as timer.active), or null. */
export const firstRow = async (L, pid = 'eli') => { const rows = await timerRows(L, pid); return rows.length ? rows[0].value : null; };
/** Writes the old shape as the row timer:<id> (a fresh start each call, so every device rings it anew). */
export async function putTimer(L, pid, v, id = 't6') {
  const now = Date.now();
  return L.apiAs(pid, '/api/data/timer/batch?scope=person', { method: 'POST', body: { items: [{ key: 'timer:' + id, value: rowOf(v, id, pid), updated_at: now }] } });
}
/** Every timer row and the legacy row go (the old scripts' reset wrote timer.active = null). */
export async function clearTimers(L, pid = 'eli') {
  // a page that held its skew on a clock run ahead stamped its rows in that clock's future: the tombstone must be later still
  const rows = await timerRows(L, pid), t = Math.max(Date.now() + 5, ...rows.map(r => +r.updated_at + 1));
  const items = [...rows.map(r => ({ key: r.key, value: null, updated_at: t })), { key: 'timer.active', value: null, updated_at: t }];
  return L.apiAs(pid, '/api/data/timer/batch?scope=person', { method: 'POST', body: { items } });
}
/** serverTimer() of _util.mjs, with the rows listed. */
export async function serverTimers(L, pid = 'eli') { const o = {}; for (const r of await timerRows(L, pid)) o[r.key] = r.value; return o; }
/** In a page: the first timer of the signed-in person in the old shape the scripts read (endAt, total in s, startedAt). */
export const PAGE_FIRST = "(r => r ? { endAt: r.endAt, total: Math.round(r.total / 1000), startedAt: r.startedAt, state: r.state } : null)(hub.timers.list().slice().sort((a, b) => b.startedAt - a.startedAt)[0])";
/**
 * For a page on an installed (fake) clock that the script runs ahead: hold hub.skew at 0, so hub.serverNow() follows the
 * page's clock. Otherwise the first server reply after a jump puts serverNow back on the real clock (the batch 6 skew rule
 * working as meant), and a timer would never reach 0 under clock.runFor / fastForward. The rig's server runs the real
 * clock, which is where the installed clock starts.
 */
export const holdSkew = ctx => ctx.addInitScript(() => {
  Object.defineProperty(window, 'hub', { configurable: true, get() { return undefined; }, set(v) {
    try { Object.defineProperty(v, 'skew', { get: () => 0, set: () => {}, configurable: true }); } catch {}
    Object.defineProperty(window, 'hub', { value: v, writable: true, configurable: true });
  } });
});
/**
 * Closes a rig and never hangs: L.close() (devices, browser, the rig's server) gets `ms`, then the server is killed anyway.
 * A ringing timer, an audio context or a wake lock in a page can keep a browser close waiting (final run 3: basics-6 printed
 * every check and then sat until the 25-minute cap). The scripts end with process.exit, so nothing left open keeps node alive.
 */
export async function closeRig(L, ms = 15000) {
  if (!L) return;
  let t; await Promise.race([Promise.resolve().then(() => L.close()).catch(() => {}), new Promise(r => { t = setTimeout(r, ms); })]); clearTimeout(t);
  try { if (L.child && L.child.exitCode === null) L.child.kill(); } catch {}
}
/** A last resort: a script still running after `min` minutes says so and exits 2 (the 25-minute cap never has to). */
export function watchdog(min = 20) { const t = setTimeout(() => { console.log(`watchdog: still running after ${min} min; exiting`); process.exit(2); }, min * 60000); t.unref(); return t; }
