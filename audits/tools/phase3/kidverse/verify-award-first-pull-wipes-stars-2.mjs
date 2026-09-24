// Skeptic 2 for "award-first-pull-wipes-stars": does Done ★ on a first open, before the first pull lands, overwrite Ezra's stars?
//   node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-2.mjs"              latency, blip, control (~3 min)
//   node "audits/tools/phase3/kidverse/verify-award-first-pull-wipes-stars-2.mjs" latency|blip|control
// latency: EVERY API request (GET and POST alike) from the new phone is delayed 10 s: a uniformly slow network, no GET-only hold.
// blip:    only the first two GETs of /api/data/kidverse?scope=person (the shell's and the app's) fail with a network error;
//          everything else is normal. The kid taps 1 s after Done ★ paints; then we just wait for hub.js's own 30 s poll.
// control: no fault; tap after the first pull has landed.
// Evidence: audits/evidence/p3/kidverse/verify-award-first-pull-wipes-stars-2*.json|png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../lib/local.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVID = path.resolve(HERE, '..', '..', '..', 'evidence', 'p3', 'kidverse');
fs.mkdirSync(EVID, { recursive: true });
const P = 'verify-award-first-pull-wipes-stars-2';
const T0 = Date.now(); const say = (...a) => console.log(((Date.now() - T0) / 1000).toFixed(1).padStart(6) + 's', ...a);

const summ = it => { if (!it || !it.value) return null; const v = it.value; return { count: v.count, total: v.total, earned: v.earned,
  badges: Object.keys(v.badges || {}), applied: Object.keys(v.applied || {}).length, payouts: (v.payouts || []).length,
  story: Object.keys((v.credited || {}).story || {}).length, prayed: Object.keys((v.credited || {}).prayed || {}).length, updated_at: it.updated_at }; };
async function server(L) {
  const g = async (who, scope, key) => { const r = await L.apiAs(who, `/api/data/kidverse?scope=${scope}&key=${encodeURIComponent(key)}`); return summ(r.body && r.body.item); };
  const led = await L.apiAs('eli', '/api/data/kidverse?scope=family');
  return { person: await g('ezra', 'person', 'stars'), mirror: await g('eli', 'family', 'stars:ezra'),
    ledgerRows: ((led.body && led.body.items) || []).filter(i => i.key.startsWith('ledger:ezra:') && i.value).map(i => ({ key: i.key, kind: i.value.kind, amount: i.value.amount })) };
}
const view = f => f.evaluate(() => { const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { who: t('#who'), ref: t('#ref'), done: t('#done'), doneDisabled: !!(document.querySelector('#done') || {}).disabled, star: t('#star-count'), sub: t('#mine .sub'), rwTotal: t('#rw-total'), rwEarned: t('#rw-earned'), badgesOn: document.querySelectorAll('#rw-badges li.on').length,
    lastPull: hub.sync.lastPull || 0, state: hub.sync.state }; });

async function run(mode) {
  const L = await local({ variant: 'typical', clock: 'real' });
  const out = { mode };
  try {
    out.before = await server(L);
    const nd = await L.newDevice({ name: 'Ezra phone v2 ' + mode, profiles: ['ezra'] });
    const phone = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, as: nd });
    const t0 = Date.now(); let blips = 0; const reqs = [];
    await phone.ctx.route(u => u.href.startsWith(L.api + '/api/'), async route => {
      const r = route.request(); const u = r.url();
      if (mode === 'latency') await sleep(10000);
      if (mode === 'blip' && r.method() === 'GET' && /\/api\/data\/kidverse\?scope=person/.test(u) && blips < 2) { blips++; reqs.push({ ms: Date.now() - t0, aborted: u.replace(L.api, '') }); return route.abort('failed'); }
      route.continue().catch(() => {});
    });
    const posts = [];
    phone.page.on('request', r => { if (r.method() === 'POST' && /\/api\/data\/kidverse\/batch/.test(r.url())) { try { const b = JSON.parse(r.postData()); posts.push({ ms: Date.now() - t0, url: r.url().replace(L.api, ''), items: b.items.map(i => ({ key: i.key, total: i.value && i.value.total, earned: i.value && i.value.earned, badges: i.value && i.value.badges ? Object.keys(i.value.badges) : undefined, applied: i.value && i.value.applied ? Object.keys(i.value.applied).length : undefined })) }); } catch {} } });
    const f = await phone.openApp('kidverse', { wait: '#done:not([hidden])' });
    out.paintMs = Date.now() - t0;
    if (mode === 'control') { const until = Date.now() + 15000; while (Date.now() < until && !(await f.evaluate(() => hub.sync.lastPull).catch(() => 0))) await sleep(150); await sleep(1500); }
    else await sleep(1000);
    await f.evaluate(() => { window.__t = []; const o = hub.toast; hub.toast = (m, ms) => { window.__t.push(String(m)); return o.call(hub, m, ms); }; });
    out.atTap = { ms: Date.now() - t0, ...(await view(f)) };
    await f.evaluate(() => document.querySelector('#done').click());   // tap at once: a screenshot before the tap can outlast the pull
    out.tapDoneMs = Date.now() - t0;
    await phone.page.screenshot({ path: path.join(EVID, `${P}-${mode}-phone-at-tap.png`), scale: 'css', animations: 'disabled' });
    await sleep(800);
    out.afterTapView = await view(f);
    // wait for things to settle: latency → requests land after 8 s; blip → hub.js's 30 s poll pulls again
    await sleep(mode === 'blip' ? 36000 : mode === 'latency' ? 26000 : 5000);
    out.phoneFinal = await view(f); out.toasts = await f.evaluate(() => window.__t); out.posts = posts; out.aborted = reqs;
    await phone.page.screenshot({ path: path.join(EVID, `${P}-${mode}-phone-final.png`), scale: 'css', animations: 'disabled' });
    out.after = await server(L);
    await phone.close();
  } finally { await L.close(); }
  say(`[${mode}] before  person ${JSON.stringify(out.before.person)}`);
  say(`[${mode}] before  mirror ${JSON.stringify(out.before.mirror)}  ledger ${JSON.stringify(out.before.ledgerRows)}`);
  say(`[${mode}] paint ${out.paintMs} ms; tap done by ${out.tapDoneMs} ms; at tap ${JSON.stringify(out.atTap)}`);
  say(`[${mode}] aborted ${JSON.stringify(out.aborted)}`);
  say(`[${mode}] POSTs   ${JSON.stringify(out.posts)}`);
  say(`[${mode}] toasts  ${JSON.stringify(out.toasts)}`);
  say(`[${mode}] phone   ${JSON.stringify(out.phoneFinal)}`);
  say(`[${mode}] after   person ${JSON.stringify(out.after.person)}`);
  say(`[${mode}] after   mirror ${JSON.stringify(out.after.mirror)}`);
  return out;
}
const modes = process.argv[2] ? [process.argv[2]] : ['latency', 'blip', 'control'];
const res = {}; for (const m of modes) res[m] = await run(m);
const file = path.join(EVID, P + (process.argv[2] ? '-' + process.argv[2] : '') + '.json');
fs.writeFileSync(file, JSON.stringify(res, null, 1)); say('wrote', file);
