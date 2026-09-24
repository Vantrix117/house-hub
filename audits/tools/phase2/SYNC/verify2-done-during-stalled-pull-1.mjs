// Skeptic #1 re-check of SYNC "done-during-stalled-pull" (audit Phase 2). Independent of critic-done-during-stall.mjs:
// a different profile (Elizabeth, id 'mom': week 38, a 26-day streak), the tap is gated on F260 having rendered
// (not a fixed 7 s), and a third run replaces the stall with one failed first GET (a network blip).
//   node "audits/tools/phase2/SYNC/verify2-done-during-stalled-pull-1.mjs"
// Runs (each on a fresh local instance, real clock, WebKit, a newly paired phone with an empty cache, deep link #f260):
//   stall   — every GET /api/data/f260?… from the phone is held 9 s; tap Today's Done once F260 has painted (after hub.ready's
//             6 s race, apps/hub.js:337); then the hold is released and the phone's own pull completes.
//   control — no hold; tap Done once the first pull has landed.
//   blip    — the phone's first GET /api/data/f260?… from the shell and from the F260 frame each fail once (connection
//             reset); tap Done as soon as F260 paints (a failed pull settles hub.ready at once, no 6 s wait).
// For each: server rows before/after (as mom, via the rig's device), every f260 batch POST the phone sent, the phone's UI at the
// tap, and a second device (the rig's Kitchen iPad as mom, empty cache) opened afterwards to show what the rest of the house sees.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID, ROOT, log, waitFor, shot } from './_util.mjs';

const WHO = 'mom';
const OUT = 'verify2-done-during-stalled-pull-1';

async function rows(L) {
  const r = await L.apiAs(WHO, '/api/data/f260?scope=person');
  const items = Object.fromEntries(((r.body && r.body.items) || []).map(i => [i.key, i]));
  const v = k => items[k] && items[k].value;
  const done = v('f260.done'), lg = v('f260.log'), wd = v('f260.weekDone'), best = v('f260.best'), sum = v('f260.summary');
  return {
    status: r.status,
    doneTrue: done ? Object.values(done).filter(x => x === true).length : null,
    logDays: lg ? Object.keys(lg).length : null,
    weekDone: wd ? Object.keys(wd).length : null,
    best: best || null,
    summary: sum ? { week: sum.week, weekDone: sum.weekDone, total: sum.total, streak: sum.streak } : null,
    doneAt: items['f260.done'] ? items['f260.done'].updated_at : null,
  };
}

async function ui(f) {
  return f.evaluate(() => {
    const t = id => { const e = document.getElementById(id); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { title: t('todayTitle'), meta: t('todayMeta'), week: t('curWeekLbl'), streak: t('todayStreak'), ring: t('todayRingN'),
      sync: window.hub && { state: hub.sync.state, lastPull: hub.sync.lastPull || 0 } };
  }).catch(e => ({ error: String(e).slice(0, 200) }));
}

async function run(name) {
  const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
  const out = { name, profile: WHO };
  try {
    out.before = await rows(L);
    const ph = await L.newDevice({ name: 'Mom new phone ' + name, profiles: [WHO] });
    const phone = await L.device({ device: 'iphone-pwa', profile: WHO, fixedTime: false, as: ph });
    let hold = name === 'stall'; const failed = new Set();   // blip: the first GET from each frame (shell, f260) fails
    const gets = [];
    await phone.ctx.route(/\/api\/data\/f260\?/, async route => {
      const req = route.request();
      if (req.method() !== 'GET') return route.continue().catch(() => {});
      const g = { at: Date.now() - t0, frame: (req.frame() && req.frame().url().includes('/apps/f260.html')) ? 'f260' : 'shell' };
      gets.push(g);
      if (name === 'blip' && !failed.has(g.frame)) { failed.add(g.frame); g.fate = 'aborted'; return route.abort('connectionreset').catch(() => {}); }
      if (hold) { g.fate = 'held'; while (hold) await sleep(100); g.released = Date.now() - t0; }
      route.continue().catch(() => {});
    });
    const posts = [];
    phone.page.on('request', r => {
      if (r.method() !== 'POST' || !/\/api\/data\/f260\/batch/.test(r.url())) return;
      try {
        const b = JSON.parse(r.postData());
        posts.push({ ms: Date.now() - t0, items: b.items.map(i => {
          const v = i.value;
          if (i.key === 'f260.done' && v) return `${i.key} (${Object.values(v).filter(x => x === true).length} true: ${Object.keys(v).join(',')})`;
          if (i.key === 'f260.log' && v) return `${i.key} (${Object.keys(v).length} days)`;
          if (i.key === 'f260.best' || i.key === 'f260.summary') return `${i.key} ${JSON.stringify(v).slice(0, 120)}`;
          return i.key;
        }) });
      } catch {}
    });
    const t0 = Date.now();
    const f = await phone.openApp('f260', { wait: '#todayDone' });
    // gate the tap on what a person would see: F260 has painted a reading on Today
    await waitFor(async () => { const u = await ui(f); return u.title && u.title.length > 2; }, { timeout: 15000, every: 100 });
    if (name === 'control') await waitFor(async () => (await ui(f)).sync.lastPull > 0, { timeout: 15000, every: 100 });
    await sleep(500);
    out.atTap = { ms: Date.now() - t0, ui: await ui(f), heldGetsSoFar: gets.length };
    out.shotBefore = await shot(phone.page, `${OUT}-${name}-phone-at-tap.png`);
    await f.click('#todayDone');
    out.tapMs = Date.now() - t0;
    await sleep(1500);
    out.afterTapUi = await ui(f);
    out.midRows = await rows(L);                      // what the server holds while the phone's pull is still stalled
    if (name === 'stall') { await sleep(Math.max(0, 9000 - (Date.now() - t0))); hold = false; }
    await waitFor(async () => (await ui(f)).sync.lastPull > 0, { timeout: 40000, every: 250 });   // blip: the 30 s poll
    out.phonePulledAtMs = Date.now() - t0;
    await sleep(3000);
    out.gets = gets; out.posts = posts;
    out.after = await rows(L);
    out.phoneAfter = await ui(f);
    out.shotPhoneAfter = await shot(phone.page, `${OUT}-${name}-phone-after.png`);
    // a second device of the house, opened afterwards (the rig's Kitchen iPad as mom, empty cache)
    const ipad = await L.device({ device: 'ipad-portrait', profile: WHO, fixedTime: false });
    const fi = await ipad.openApp('f260', { wait: '#todayDone' });
    await waitFor(async () => (await ui(fi)).sync.lastPull > 0, { timeout: 15000, every: 250 });
    await sleep(1500);
    out.ipadAfter = await ui(fi);
    out.shotIpad = await shot(ipad.page, `${OUT}-${name}-ipad-after.png`);
    out.phoneLogs = phone.logs.filter(l => /error|fail/i.test(l)).slice(0, 10);
  } finally { await L.close(); }
  log(`[${name}] before ${JSON.stringify(out.before)}`);
  log(`[${name}] at tap ${JSON.stringify(out.atTap)} (tap at ${out.tapMs} ms)`);
  log(`[${name}] server 1.5 s after tap ${JSON.stringify(out.midRows)}`);
  log(`[${name}] GETs ${JSON.stringify(out.gets)}`);
  log(`[${name}] POSTs ${JSON.stringify(out.posts)}`);
  log(`[${name}] after ${JSON.stringify(out.after)}`);
  log(`[${name}] phone after ${JSON.stringify(out.phoneAfter)} | iPad after ${JSON.stringify(out.ipadAfter)}`);
  return out;
}

const res = {};
for (const n of (process.argv[2] ? process.argv[2].split(',') : ['stall', 'control', 'blip'])) res[n] = await run(n);
const file = path.join(EVID, `${OUT}.json`);
fs.writeFileSync(file, JSON.stringify(res, null, 1));
log('wrote ' + path.relative(ROOT, file));
