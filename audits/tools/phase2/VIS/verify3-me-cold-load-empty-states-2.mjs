// Skeptic #2 for VIS candidate "me-cold-load-empty-states": on a cold load, does Me paint final empty states
// (album "Add the first one.", Kids' rewards ★0 with Cash in / Reset week disabled) instead of loading states, and is
// that only a rig artefact (a long hold) or does it happen at realistic latency too? Also: does Me recover by itself once
// the pull lands (index.html:1236-1242 re-renders the album on a 'hub' change but has no Me branch for 'kidverse')?
//
// Written from scratch; does not reuse rev-critic-gaps.mjs. WebKit, demo household 'typical', demo clock, Eli (adult admin).
//   S  server truth: album rows (hub/family) and each kid's stars mirror + ledger (kidverse/family) via L.apiAs.
//   H  iphone-pwa, cold cache, EVERY /api/data + /api/activity request held behind a gate while #me is open;
//      sample + screenshots; release the gate; sample again on the SAME page (no navigation); then tab Home → Me and sample.
//   R  iphone-pwa, cold cache, REALISTIC latency (each /api/data, /api/activity delayed 150 ms, no gate), #me;
//      an in-page MutationObserver timeline of the album/rewards texts with hub.sync state/lastPull.
//   W  warm cache: reload of R's context (the normal daily open), same latency — calibration.
//   T  cold cache, land on #home, tap Me ~300 ms later (before the pull ends), 150 ms/request — the everyday path.
//   X  warm cache, Me open; another adult writes a cash-in ledger row for Kiara on the local server; the page pulls
//      (hub.pull(), what its 30 s timer / visibilitychange do) — does the rewards card follow without navigation?
//   node "audits/tools/phase2/VIS/verify3-me-cold-load-empty-states-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });
const TAG = 'verify3-me-cold-load-empty-states-2';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');

const RECORDER = () => {
  if (window.top !== window) return;
  window.__rec = [];
  const t0 = performance.now();
  const snap = () => {
    const q = s => document.querySelector(s);
    const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 140) : null);
    if (!q('#view-me #album-grid') && !q('#view-me #rewards-body')) return;
    const h = window.hub;
    const s = {
      state: h && h.sync ? h.sync.state : null, lastPull: !!(h && h.sync && h.sync.lastPull),
      albumItems: document.querySelectorAll('#album-grid .album-item').length,
      albumEmpty: !!q('#album-grid .empty'),
      rewards: [...document.querySelectorAll('#rewards-body .reward-kid')].map(k => txt(k.querySelector('.grow'))),
      cashinDisabled: [...document.querySelectorAll('#rewards-body [data-cashin]')].map(b => b.disabled),
      resetDisabled: [...document.querySelectorAll('#rewards-body [data-resetweek]')].map(b => b.disabled),
      skeletons: document.querySelectorAll('#view-me .skeleton').length,
    };
    const key = JSON.stringify(s);
    const last = window.__rec[window.__rec.length - 1];
    if (last && last.key === key) return;
    window.__rec.push({ t: Math.round(performance.now() - t0), key, ...s });
  };
  let pend = false;
  const kick = () => { if (pend) return; pend = true; requestAnimationFrame(() => { pend = false; try { snap(); } catch (e) {} }); };
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(kick).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['disabled'] }); kick(); });
};

const sample = d => d.page.evaluate(() => {
  const q = s => document.querySelector(s);
  const txt = e => (e ? e.textContent.replace(/\s+/g, ' ').trim() : null);
  return {
    tab: document.documentElement.dataset.tab,
    sync: { state: hub.sync.state, lastPull: hub.sync.lastPull || 0, pending: hub.sync.pending },
    albumItems: document.querySelectorAll('#album-grid .album-item').length,
    albumText: txt(q('#album-grid')).slice(0, 120),
    rewards: [...document.querySelectorAll('#rewards-body .reward-kid')].map(k => ({ kid: k.dataset.kid, text: txt(k.querySelector('.grow')), cashinDisabled: k.querySelector('[data-cashin]').disabled, resetDisabled: k.querySelector('[data-resetweek]').disabled })),
    meSkeletons: document.querySelectorAll('#view-me .skeleton').length,
    syncCard: txt([...document.querySelectorAll('#view-me .card')].find(c => /Sync/.test(txt(c.querySelector('h2')) || ''))),
    shellCacheKidverseFamily: (() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.kidverse.family')); return c ? { since: c.since, keys: Object.keys(c.items || {}).length } : null; } catch { return 'err'; } })(),
    shellCacheHubFamily: (() => { try { const c = JSON.parse(localStorage.getItem('hub.cache.hub.family')); return c ? { since: c.since, albumKeys: Object.keys(c.items || {}).filter(k => k.startsWith('album:')).length } : null; } catch { return 'err'; } })(),
  };
});

async function shots(d, name) {
  const out = [];
  await d.page.evaluate(() => { document.querySelector('#views').scrollTop = 0; });
  await sleep(150);
  const top = path.join(EVID, `${TAG}-${name}-top.png`);
  await d.page.screenshot({ path: top, scale: 'css', animations: 'disabled', caret: 'hide' }); out.push(rel(top));
  for (const id of ['album', 'rewards']) {
    const el = d.page.locator('#' + id);
    if (await el.count()) {
      await el.scrollIntoViewIfNeeded().catch(() => {});
      await sleep(150);
      const f = path.join(EVID, `${TAG}-${name}-${id}.png`);
      await el.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); out.push(rel(f));
    }
  }
  await d.page.evaluate(() => { document.querySelector('#views').scrollTop = 0; });
  return out;
}

const out = { tag: TAG };
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // ── S: server truth ────────────────────────────────────────────────────────────────────────────────────────────
  {
    const hubFam = await L.apiAs('eli', '/api/data/hub?scope=family');
    const kvFam = await L.apiAs('eli', '/api/data/kidverse?scope=family');
    const items = b => (b && b.items) || [];
    const album = items(hubFam.body).filter(i => i.key.startsWith('album:') && i.value);
    const stars = Object.fromEntries(items(kvFam.body).filter(i => i.key.startsWith('stars:')).map(i => [i.key, { week: i.value && i.value.week, count: i.value && i.value.count, total: i.value && i.value.total, earned: i.value && i.value.earned, badges: i.value && i.value.badges ? Object.keys(i.value.badges) : [] }]));
    const ledger = items(kvFam.body).filter(i => i.key.startsWith('ledger:') && i.value).map(i => ({ key: i.key, kind: i.value.kind }));
    out.S = { status: [hubFam.status, kvFam.status], albumRows: album.length, stars, ledger };
    console.log('== S server truth', JSON.stringify(out.S));
  }

  // ── H: cold cache, every data pull held ────────────────────────────────────────────────────────────────────────
  {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
    let release; const gate = new Promise(r => { release = r; });
    let held = 0;
    await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity)/.test(r.request().url())) { held++; await gate; } await r.continue().catch(() => {}); });
    const t0 = Date.now();
    await d.page.goto(L.site + '/index.html#me', { waitUntil: 'load' });
    await d.page.waitForSelector('#view-me #rewards-body .reward-kid', { timeout: 15000 });
    await sleep(1200);
    const during = await sample(d); during.heldRequests = held; during.msSinceGoto = Date.now() - t0;
    during.shots = await shots(d, 'H-held');
    console.log('\n== H during hold', JSON.stringify(during, null, 1));
    release();
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 30000 });
    await sleep(2500);
    const after = await sample(d); after.shots = await shots(d, 'H-after-pull-same-page');
    console.log('\n== H after release, same page, no navigation', JSON.stringify(after, null, 1));
    await d.page.click('.tab[data-tab="home"]'); await sleep(600);
    await d.page.click('.tab[data-tab="me"]'); await sleep(1200);
    const back = await sample(d); back.shots = await shots(d, 'H-after-tab-home-me');
    console.log('\n== H after tapping Home then Me', JSON.stringify(back, null, 1));
    out.H = { during, after, back, logs: d.logs.filter(l => /error/i.test(l)).slice(0, 10) };
    await d.close();
  }

  // ── R: cold cache, realistic latency; W: warm reload ───────────────────────────────────────────────────────────
  {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
    await d.ctx.addInitScript(RECORDER);
    await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity)/.test(r.request().url())) await sleep(150); await r.continue().catch(() => {}); });
    await d.page.goto(L.site + '/index.html#me', { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 30000 });
    await sleep(3000);
    const rec = await d.page.evaluate(() => window.__rec.map(({ key, ...r }) => r));
    const end = await sample(d);
    out.R = { timeline: rec, end };
    console.log('\n== R cold, 150 ms/request, timeline (t = ms since document start)');
    for (const r of rec) console.log('  ' + JSON.stringify(r));
    console.log('  end sample:', JSON.stringify({ albumItems: end.albumItems, rewards: end.rewards, sync: end.sync }));
    // W: reload (localStorage caches now filled by R's pull)
    await d.page.reload({ waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 30000 });
    await sleep(1500);
    const recW = await d.page.evaluate(() => window.__rec.map(({ key, ...r }) => r));
    out.W = { timeline: recW };
    console.log('\n== W warm reload, 150 ms/request, timeline');
    for (const r of recW) console.log('  ' + JSON.stringify(r));
    await d.close();
  }

  // ── T: the everyday path — cold cache, land on Home, tap Me before the first pull finishes (150 ms/request) ─────
  {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
    await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity)/.test(r.request().url())) await sleep(150); await r.continue().catch(() => {}); });
    await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
    await d.page.waitForSelector('.tab[data-tab="me"]', { timeout: 10000 });
    await sleep(300);
    const lastPullAtTap = await d.page.evaluate(() => hub.sync.lastPull || 0);
    await d.page.click('.tab[data-tab="me"]');
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 30000 });
    await sleep(3000);
    const s = await sample(d);
    out.T = { lastPullAtTap, rewards: s.rewards, albumItems: s.albumItems, sync: s.sync, syncCard: s.syncCard };
    s.shots = await shots(d, 'T-home-then-me-early');
    out.T.shots = s.shots;
    console.log('\n== T cold at Home, tap Me at ~300 ms, sampled 3 s after the pull landed', JSON.stringify(out.T, null, 1));
    await d.close();
  }

  // ── X: warm Me open, another adult cashes in Kiara's stars on the server, the page pulls (as its 30 s timer would) ──
  {
    const d = await L.device({ device: 'iphone-pwa', mode: 'light', profile: 'eli' });
    await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 30000 });
    await d.page.click('.tab[data-tab="me"]'); await sleep(800);
    const before = (await sample(d)).rewards;
    const other = Object.keys(L.S.info.sessions).find(p => p !== 'eli' && ['david', 'elizabeth', 'christian', 'mea'].includes(p));
    const now = (await L.apiAs(other, '/api/data/kidverse?scope=family')).body.now;
    const w = await L.apiAs(other, '/api/data/kidverse/batch?scope=family', { method: 'POST', body: { items: [{ key: 'ledger:kiara:rigX-1', value: { kind: 'cashin', date: '2026-09-24', amount: 5, by: other, at: now + 5 }, updated_at: now + 5 }] } });
    const pulled = await d.page.evaluate(async () => { const c = await hub.pull(); return { changed: c, cachedLedger: hub.list('ledger:kiara:', { app: 'kidverse', scope: 'family' }).map(r => r.key) }; });
    await sleep(1500);
    const after = (await sample(d)).rewards;
    await d.page.click('.tab[data-tab="home"]'); await sleep(500);
    await d.page.click('.tab[data-tab="me"]'); await sleep(800);
    const afterNav = (await sample(d)).rewards;
    out.X = { writer: other, writeStatus: w.status, applied: w.body && w.body.results && w.body.results.map(r => r.applied), pulled, before, after, afterNav };
    console.log('\n== X live update on Me (warm), another adult cashes in Kiara', JSON.stringify(out.X, null, 1));
    await d.close();
  }

  // summary
  const zeroKids = rw => rw.filter(r => /★0 to cash in/.test(r.text)).length;
  out.summary = {
    serverAlbumRows: out.S.albumRows,
    serverTotals: Object.fromEntries(Object.entries(out.S.stars).map(([k, v]) => [k, v.total])),
    H_during: { albumItems: out.H.during.albumItems, albumEmptyText: /Add the first one/.test(out.H.during.albumText), kidsAtZero: zeroKids(out.H.during.rewards), cashinDisabled: out.H.during.rewards.map(r => r.cashinDisabled), meSkeletons: out.H.during.meSkeletons, sync: out.H.during.sync.state },
    H_afterSamePage: { albumItems: out.H.after.albumItems, kidsAtZero: zeroKids(out.H.after.rewards), rewards: out.H.after.rewards.map(r => r.text), cashinDisabled: out.H.after.rewards.map(r => r.cashinDisabled) },
    H_afterTabBack: { albumItems: out.H.back.albumItems, kidsAtZero: zeroKids(out.H.back.rewards), rewards: out.H.back.rewards.map(r => r.text), cashinDisabled: out.H.back.rewards.map(r => r.cashinDisabled) },
    R: { paints: out.R.timeline.length, first: out.R.timeline[0], albumEmptyFor: (() => { const a = out.R.timeline.find(r => r.albumEmpty), b = out.R.timeline.find(r => r.albumItems > 0); return a && b ? b.t - a.t : a ? 'never filled' : 0; })(), endRewards: out.R.end.rewards.map(r => r.text) },
    W: { paints: out.W.timeline.length, first: out.W.timeline[0] },
    T: { lastPullAtTap: out.T.lastPullAtTap, rewards: out.T.rewards.map(r => r.text + ' | cashin disabled=' + r.cashinDisabled) },
    X: { kiaraBefore: (out.X.before.find(r => r.kid === 'kiara') || {}).text, kiaraAfterPull: (out.X.after.find(r => r.kid === 'kiara') || {}).text, kiaraAfterNav: (out.X.afterNav.find(r => r.kid === 'kiara') || {}).text },
  };
  console.log('\n== summary', JSON.stringify(out.summary, null, 1));
} finally { await L.close(); }
const f = path.join(EVID, `${TAG}.json`);
fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', rel(f));
