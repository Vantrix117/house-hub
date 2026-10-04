// batch 7 copy of audits/tools/phase3/kidverse/_kv.mjs: only the evidence folder differs (env EVID7, else audits/evidence/p6/7).
// Shared helpers for the Phase 3 Kid Verse experiments (read-only use of the harness; writes evidence only to
// audits/evidence/p3/kidverse/). Every script in this folder imports this file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
export { local, sleep, DEMO } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..', '..', '..', '..');
export const EVID = process.env.EVID7 || path.join(ROOT, 'audits', 'evidence', 'p6', '7');
fs.mkdirSync(EVID, { recursive: true });
const T0 = Date.now();
export const log = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);
export const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
export const saveJson = (name, obj) => { const f = path.join(EVID, name); fs.writeFileSync(f, JSON.stringify(obj, null, 1)); log('wrote', rel(f)); return rel(f); };
/** 1x CSS-scale screenshot into the evidence folder. */
export async function shot(page, name, opts = {}) { const f = path.join(EVID, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...opts }); log('shot', rel(f)); return rel(f); }

/** The server's copy of one kidverse row, as a profile. */
export async function row(L, profile, scope, key, app = 'kidverse') {
  const r = await L.apiAs(profile, `/api/data/${app}?scope=${scope}&key=${encodeURIComponent(key)}`);
  return r.body && r.body.item ? r.body.item : null;
}
/** A compact summary of a stars row. */
export function sum(it) {
  if (!it || !it.value) return null;
  const v = it.value;
  return { week: v.week, count: v.count, total: v.total, earned: v.earned, days: v.days, badges: Object.keys(v.badges || {}).length,
    payouts: (v.payouts || []).length, applied: Object.keys(v.applied || {}).length,
    storyCredited: Object.keys((v.credited || {}).story || {}).length, prayedCredited: Object.keys((v.credited || {}).prayed || {}).length,
    bytes: JSON.stringify(v).length, updated_at: it.updated_at };
}
export async function stars(L, kid) {
  return { person: sum(await row(L, kid, 'person', 'stars')), mirror: sum(await row(L, 'eli', 'family', 'stars:' + kid)) };
}
/** Wait until the app frame's hub has pulled at least once (or the timeout). */
export async function pulled(f, ms = 15000) { const until = Date.now() + ms; while (Date.now() < until) { if (await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull)).catch(() => false)) return true; await new Promise(r => setTimeout(r, 150)); } return false; }
/** Wait until the frame's write queue is empty and it reads "synced". */
export async function flushed(f, ms = 15000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const ok = await f.evaluate(() => window.hub && hub.sync.state === 'synced' && !Object.keys(localStorage).some(k => k.startsWith('hub.queue.') && Object.keys(JSON.parse(localStorage.getItem(k) || '{}')).length)).catch(() => false);
    if (ok) return true; await new Promise(r => setTimeout(r, 150));
  }
  return false;
}
/** The visible Kid Verse state in a frame. */
export async function ui(f) {
  return f.evaluate(() => {
    const t = s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { who: t('#who'), ref: t('#ref'), done: t('#done'), doneToday: !!document.querySelector('#done.today'), starCount: t('#star-count'), mineSub: t('#mine .sub'),
      litDots: document.querySelectorAll('#mine .days span.on').length, storyTitle: t('#story-title'), storySpan: t('#story-span'), heard: t('#story-heard'), storySub: t('#story-sub'),
      rwTotal: t('#rw-total'), rwWeek: t('#rw-week'), rwEarned: t('#rw-earned'), badgesOn: document.querySelectorAll('#rw-badges li.on').length, paid: t('#rw-paid'),
      weekNow: t('#week-now'), kids: [...document.querySelectorAll('#kids li[data-kid]')].map(li => li.textContent.replace(/\s+/g, ' ').trim()),
      toast: [...document.querySelectorAll('.toast, #toast, [class*=toast]')].map(e => e.textContent.trim()).filter(Boolean) };
  });
}
/** Record every toast hub.toast() shows in a frame (hub.toast may route to the shell; wrap it). */
export async function watchToasts(f) {
  await f.evaluate(() => { if (window.__toasts) return; window.__toasts = []; const o = hub.toast; hub.toast = (m, ms) => { window.__toasts.push(String(m)); return o.call(hub, m, ms); }; });
}
export const toasts = f => f.evaluate(() => window.__toasts || []);

// batch 7: Reset week / Cash in ask through the shared hub.confirm sheet since batch 0i (CONS-TELL-2), not a native confirm(): press its confirming button.
export async function answerSheet(page) {
  const bd = await page.waitForSelector('.hub-ask .sheet', { timeout: 6000 }).catch(() => null); if (!bd) { console.log('  [sheet] none appeared'); return null; }
  const title = (await bd.evaluate(e => e.querySelector('h2') ? e.querySelector('h2').textContent : e.textContent)).trim(); console.log('  [sheet] ' + title);
  await page.click('.hub-ask .sheet-actions .btn:last-child'); await page.waitForSelector('.hub-ask', { state: 'detached', timeout: 6000 }).catch(() => {});
  return title;
}
