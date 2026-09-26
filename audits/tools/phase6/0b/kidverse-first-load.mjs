// Phase 6 batch 0b — Kid Verse: no star, heard day or week step before its channels have pulled (P3-KIDVERSE-01/-03/-11),
// and skeletons of the loaded size meanwhile (UX-KIDVERSE-6). The phase 3 scripts' FAIL modes (award-first-pull fail,
// verify-week-stepper-stalled-overwrite-2 FAIL) now time out clicking a disabled control — the fix holding, but they print
// nothing; this prints what they meant to see.
//   A  kid Ezra, cold new phone, every GET /api/data/* answers 503 until released: Done ★ / I heard it disabled, direct
//      kidverse.award() / heard() write nothing (no POST); released + pulled, one Done ★ adds exactly one star to the real row.
//   B  adult Eli, same outage: stepper disabled ("Loading the family week…"), kidverse.setWeek(2) writes nothing; the
//      family week stays 38 on the server; after the pull the stepper shows the real week.
//   C  kid Ezra, cold phone, GETs held 1.5 s: tops/heights of the art, ref, words, Done and story, loading vs loaded.
// Usage: node "audits/tools/phase6/0b/kidverse-first-load.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p6/0b'); fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', clock: 'real', engine: 'webkit' });
const row = async (who, key, scope) => { const r = await L.apiAs(who, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`); return r.body && r.body.item ? r.body.item.value : null; };
const sum = v => v && { total: v.total, earned: v.earned, count: v.count, badges: Object.keys(v.badges || {}).length, payouts: (v.payouts || []).length, applied: Object.keys(v.applied || {}).length, story: Object.keys(v.credited?.story || {}).length };
const view = f => f.evaluate(() => { const q = s => document.querySelector(s); const t = s => q(s) && !q(s).hidden ? q(s).textContent.replace(/\s+/g, ' ').trim() : null;
  return { who: t('#who'), ref: t('#ref'), done: t('#done'), doneDisabled: q('#done')?.disabled, heard: t('#story-heard'), heardDisabled: q('#story-heard')?.disabled, sayDisabled: q('#say')?.disabled,
    mine: t('#mine .sub'), rewards: !q('#rewards').hidden, weekNow: t('#week-now'), upDisabled: q('#week-up')?.disabled, downDisabled: q('#week-down')?.disabled, busy: q('.wrap').getAttribute('aria-busy'), loaded: hub.isLoaded() }; });
async function outage(profile) {
  const nd = await L.newDevice({ name: `${profile} cold phone 0b`, profiles: [profile] });
  const d = await L.device({ device: 'iphone-pwa', profile, fixedTime: false, as: nd });
  let down = true; const posts = [];
  await d.ctx.route(/\/api\/data\/[^/?]+\?/, r => (r.request().method() === 'GET' && down) ? r.fulfill({ status: 503, contentType: 'application/json', body: '{"error":"unavailable"}' }) : r.continue().catch(() => {}));
  d.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(r.url())) posts.push(r.url().replace(/^.*\/api\/data\//, '')); });
  const f = await d.openApp('kidverse', { wait: '#who b' }); await sleep(2500);
  return { d, f, posts, release: async () => { down = false; await f.evaluate(() => hub.pull()); await sleep(1500); } };
}
const out = {};
try {
  // ── A ──
  out.A = { before: sum(await row('ezra', 'stars', 'person')), storyBefore: await row('ezra', 'story', 'person') };
  const a = await outage('ezra');
  out.A.during = await view(a.f);
  out.A.shot = path.relative('.', path.join(EV, 'kidverse-first-load-A-outage.png')).replace(/\\/g, '/');
  await a.d.page.screenshot({ path: out.A.shot, scale: 'css', animations: 'disabled' });
  out.A.direct = await a.f.evaluate(() => ({ award: window.kidverse.award(), heard: window.kidverse.heard() }));
  await sleep(1500); out.A.postsDuringOutage = [...a.posts];
  await a.release();
  out.A.afterPull = await view(a.f);
  await a.f.click('#done'); await sleep(2500);
  out.A.afterTap = await view(a.f); out.A.posts = a.posts;
  out.A.shotAfter = path.relative('.', path.join(EV, 'kidverse-first-load-A-after.png')).replace(/\\/g, '/');
  await a.d.page.screenshot({ path: out.A.shotAfter, scale: 'css', animations: 'disabled' });
  out.A.after = sum(await row('ezra', 'stars', 'person')); out.A.mirror = sum(await row('eli', 'stars:ezra', 'family'));
  out.A.storyAfter = await row('ezra', 'story', 'person');
  await a.d.close();
  // ── B ──
  out.B = { weekBefore: await row('eli', 'week', 'family') };
  const b = await outage('eli');
  out.B.during = await view(b.f);
  out.B.shot = path.relative('.', path.join(EV, 'kidverse-first-load-B-outage.png')).replace(/\\/g, '/');
  await b.f.evaluate(() => document.querySelector('#grown').scrollIntoView()); await b.d.page.screenshot({ path: out.B.shot, scale: 'css', animations: 'disabled' });
  await b.f.evaluate(() => window.kidverse.setWeek(2)); await sleep(1500);
  out.B.postsDuringOutage = [...b.posts];
  await b.release();
  out.B.afterPull = await view(b.f); out.B.weekAfter = await row('eli', 'week', 'family');
  await b.d.close();
  // ── C ──
  const nd = await L.newDevice({ name: 'Ezra layout phone 0b', profiles: ['ezra'] });
  const c = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: nd });
  await c.ctx.route(/\/api\/data\/[^/?]+\?/, async r => { if (r.request().method() === 'GET') await sleep(1500); r.continue().catch(() => {}); });
  const geo = f => f.evaluate(() => { const g = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return [Math.round(r.top + scrollY), Math.round(r.height)]; };
    return { loaded: hub.isLoaded(), art: g('#art'), ref: g('.ref'), words: g('.words'), done: g('#done'), mine: g('#mine'), story: g('#story'), refText: document.querySelector('#ref').textContent }; });
  await c.goto('#kidverse'); const t0 = Date.now(); let fr = null; const samples = []; let shotC = false;
  while (Date.now() - t0 < 7000) { fr = fr || c.frame('kidverse'); if (fr) { const s = await geo(fr).catch(() => null); if (s && s.done) { samples.push({ ms: Date.now() - t0, ...s }); if (!s.loaded && !shotC && Date.now() - t0 > 600) { shotC = true; await c.page.screenshot({ path: path.join(EV, 'kidverse-first-load-C-loading.png'), scale: 'css', animations: 'disabled' }); } } } await sleep(100); }
  out.C = { firstLoading: samples.find(s => !s.loaded), firstLoaded: samples.find(s => s.loaded), last: samples[samples.length - 1] };
  out.C.shot = path.relative('.', path.join(EV, 'kidverse-first-load-C-loading.png')).replace(/\\/g, '/');
  await c.close();
} finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v, null, 1));
fs.writeFileSync(path.join(EV, 'kidverse-first-load.json'), JSON.stringify(out, null, 1));
