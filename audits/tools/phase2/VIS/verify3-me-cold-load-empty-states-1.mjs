// Skeptic #1 for VIS candidate "me-cold-load-empty-states": on a cold load of #me, do the Family album and Kids' rewards
// cards paint their FINAL empty states ("Add the first one.", ★0, disabled Cash in / Reset week) while the first pull is
// still pending — and what happens when the pull lands?
//
// Independent reproduction (does not reuse cls.mjs or the earlier verify scripts):
//   A. WebKit, variant 'typical', cold cache (the rig clears localStorage; only device/session/profiles are set), Eli on
//      iphone-pwa and ipad-portrait. Every /api/data + /api/activity request is HELD until the "loading" probe is read,
//      then released. Probe + element screenshots of #album and #rewards in both states.
//   A2. Same page, after the pull: leave Me and come back (showTab via the tab bar) — does the rewards card catch up?
//   B. Warm-cache control: reload the same context with the gate closed again — cached values or empty states?
//   C. Realistic latency, no gate: cold Eli iphone-pwa, each /api/data + /api/activity delayed 150 ms; sample the album and
//      rewards text every 50 ms for 12 s to time how long the empty states stay up (and whether rewards ever corrects
//      without leaving the tab).
//   D. What the server holds: /api/data/hub?scope=family album rows and /api/data/kidverse?scope=family stars rows.
//   E. Cold start on #home, tap Me while the first pull is held, release: does the rewards card correct itself on Me?
//   F. Warm, still on Me: stars:ezra changes on the server (written as Ezra, as Kid Verse would), the shell pulls — does
//      the rewards card follow without leaving the tab?
//
//   node "audits/tools/phase2/VIS/verify3-me-cold-load-empty-states-1.mjs"
// Evidence → audits/evidence/p2/VIS/verify3-me-cold-load-empty-states-1{.json,-*.png}
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });
const TAG = 'verify3-me-cold-load-empty-states-1';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const out = {};
const log = (...a) => { console.log(...a); (out._log ||= []).push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' ')); };

const probe = () => {
  const t = s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  const album = document.querySelector('#album-grid');
  const rewards = [...document.querySelectorAll('#rewards-body .reward-kid')].map(k => ({
    kid: k.dataset.kid, text: k.textContent.replace(/\s+/g, ' ').trim(),
    cashinDisabled: !!(k.querySelector('[data-cashin]') || {}).disabled, resetDisabled: !!(k.querySelector('[data-resetweek]') || {}).disabled,
  }));
  return {
    tab: document.documentElement.dataset.tab, sync: window.hub ? { state: hub.sync.state, lastPull: hub.sync.lastPull || 0, pending: hub.sync.pending } : null,
    meVisible: !!document.querySelector('#view-me.on'),
    album: album ? { photos: album.querySelectorAll('.album-item').length, emptyState: !!album.querySelector('.empty'), text: t('#album-grid').slice(0, 120) } : null,
    rewards, rewardsBody: t('#rewards-body'),
    skeletonsInMe: document.querySelectorAll('#view-me .skeleton').length,
    skeletonsInAlbumOrRewards: document.querySelectorAll('#album .skeleton, #rewards .skeleton').length,
    syncCard: t('#view-me .card:has(#syncnow)'),
  };
};
const shotEl = async (d, sel, name) => {
  const f = path.join(EVID, `${TAG}-${name}.png`);
  const loc = d.page.locator(sel);
  if (!(await loc.count())) return null;
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  await loc.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' });
  return rel(f);
};
const shotPage = async (d, name) => { const f = path.join(EVID, `${TAG}-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(f); };

async function gated(d, api, site, { reload = false } = {}) {
  let open; const gate = new Promise(r => { open = r; }); let held = 0, seen = 0;
  const h = async r => { if (/\/api\/(data|activity)/.test(r.request().url())) { seen++; held++; await gate; held--; } await r.continue().catch(() => {}); };
  await d.ctx.route(api + '/api/**', h);
  if (reload) await d.page.reload({ waitUntil: 'load' }); else await d.page.goto(site + '/index.html#me', { waitUntil: 'load' });
  await d.page.waitForSelector('#view-me.on .me-hero', { timeout: 15000 });
  await sleep(800);
  const loading = await d.page.evaluate(probe); loading.heldRequests = held; loading.requestsSeen = seen;
  return {
    loading,
    release: async () => {
      open();
      await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 20000 }).catch(() => {});
      await sleep(1500);
      const loaded = await d.page.evaluate(probe);
      await d.ctx.unroute(api + '/api/**', h);
      return loaded;
    },
  };
}
const summarize = (label, p) => log(`  ${label}: tab=${p.tab} sync=${p.sync && p.sync.state} lastPull>0=${!!(p.sync && p.sync.lastPull)}${p.heldRequests != null ? ' held=' + p.heldRequests + '/' + p.requestsSeen : ''} | album photos=${p.album && p.album.photos} empty=${p.album && p.album.emptyState} | skeletons(album/rewards)=${p.skeletonsInAlbumOrRewards} | rewards=${JSON.stringify(p.rewards.map(r => ({ kid: r.kid, text: r.text.slice(0, 80), cashinDisabled: r.cashinDisabled, resetDisabled: r.resetDisabled })))}`);

// ── A, A2, B: WebKit gated ───────────────────────────────────────────────────────────────────────────────────────────
{
  const L = await local({ variant: 'typical', engine: 'webkit' });
  try {
    // D: what the server holds
    const alb = await L.apiAs('eli', '/api/data/hub?scope=family');
    const kv = await L.apiAs('eli', '/api/data/kidverse?scope=family');
    const items = b => (b && b.items) || [];
    out.D = {
      albumRows: items(alb.body).filter(i => i.key.startsWith('album:') && i.value).length,
      stars: items(kv.body).filter(i => i.key.startsWith('stars:') && i.value).map(i => ({ key: i.key, total: i.value.total, count: i.value.count, week: i.value.week, earned: i.value.earned })),
      ledgerRows: items(kv.body).filter(i => i.key.startsWith('ledger:')).length,
    };
    log('== D server holds:', out.D);

    for (const device of ['iphone-pwa', 'ipad-portrait']) {
      const d = await L.device({ device, profile: 'eli' });
      const g = await gated(d, L.api, L.site);
      const s = { loadingPage: await shotPage(d, `${device}-cold-loading-viewport`), loadingAlbum: await shotEl(d, '#album', `${device}-cold-loading-album`), loadingRewards: await shotEl(d, '#rewards', `${device}-cold-loading-rewards`) };
      const loaded = await g.release();
      s.loadedAlbum = await shotEl(d, '#album', `${device}-cold-loaded-album`);
      s.loadedRewards = await shotEl(d, '#rewards', `${device}-cold-loaded-rewards`);
      // A2: leave Me and come back through the tab bar
      await d.page.click('#tabbar .tab[data-tab="home"]'); await sleep(400);
      await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(800);
      const revisit = await d.page.evaluate(probe);
      s.revisitRewards = await shotEl(d, '#rewards', `${device}-cold-revisit-rewards`);
      log(`\n== A webkit cold eli ${device}`);
      summarize('loading (first pull held)', g.loading);
      summarize('loaded  (pull done, still on Me)', loaded);
      summarize('revisit (Home -> Me)', revisit);
      out[`A-${device}`] = { loading: g.loading, loaded, revisit, shots: s };

      if (device === 'iphone-pwa') {  // B: warm-cache control
        const g2 = await gated(d, L.api, L.site, { reload: true });
        const s2 = { warmLoadingAlbum: await shotEl(d, '#album', `${device}-warm-loading-album`), warmLoadingRewards: await shotEl(d, '#rewards', `${device}-warm-loading-rewards`) };
        const loaded2 = await g2.release();
        log(`\n== B webkit WARM control eli ${device}`);
        summarize('loading (first pull held, warm cache)', g2.loading);
        summarize('loaded', loaded2);
        out[`B-${device}`] = { loading: g2.loading, loaded: loaded2, shots: s2 };
      }
      if (d.logs.length) out[`logs-${device}`] = d.logs.slice(0, 40);
      await d.close();
    }

    // C: realistic latency, no gate
    {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
      await d.ctx.route(L.api + '/api/**', async r => { if (/\/api\/(data|activity)/.test(r.request().url())) await sleep(150); await r.continue().catch(() => {}); });
      const t0 = Date.now(); const samples = []; let firstPullAt = null;
      await d.page.goto(L.site + '/index.html#me', { waitUntil: 'commit' });
      while (Date.now() - t0 < 12000) {
        const s = await d.page.evaluate(() => {
          if (!window.hub || !document.querySelector('#view-me.on #album-grid')) return null;
          return {
            lp: hub.sync.lastPull || 0,
            albumEmpty: !!document.querySelector('#album-grid .empty'), albumPhotos: document.querySelectorAll('#album-grid .album-item').length,
            rewards: [...document.querySelectorAll('#rewards-body .reward-kid .reward-total')].map(e => e.textContent).join(' '),
            cashinDisabled: [...document.querySelectorAll('#rewards-body [data-cashin]')].map(b => b.disabled).join(','),
          };
        }).catch(() => null);
        const ms = Date.now() - t0;
        if (s) { const key = JSON.stringify({ ...s, lp: !!s.lp }); if (!samples.length || samples[samples.length - 1].key !== key) samples.push({ ms, key, ...s, lp: !!s.lp }); if (s.lp && firstPullAt == null) firstPullAt = ms; }
        await sleep(50);
      }
      log('\n== C webkit cold eli iphone-pwa, 150 ms per data/feed call, no gate — state changes over 12 s (staying on Me):');
      for (const x of samples) log(`  ~${x.ms} ms: lastPull>0=${x.lp} albumEmpty=${x.albumEmpty} albumPhotos=${x.albumPhotos} rewards="${x.rewards}" cashinDisabled=[${x.cashinDisabled}]`);
      log(`  first pull finished at ~${firstPullAt} ms`);
      out.C = { samples: samples.map(({ key, ...x }) => x), firstPullAt };
      out.C.finalShotRewards = await shotEl(d, '#rewards', 'c-latency-12s-rewards');
      await d.close();
    }

    // E: the more common path — cold start lands on Home, the user taps Me while the first pull is still running
    {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
      let open; const gate = new Promise(r => { open = r; });
      const h = async r => { if (/\/api\/(data|activity)/.test(r.request().url())) await gate; await r.continue().catch(() => {}); };
      await d.ctx.route(L.api + '/api/**', h);
      await d.page.goto(L.site + '/index.html#home', { waitUntil: 'load' });
      await d.page.waitForSelector('#view-home .home-hero', { timeout: 15000 });
      await sleep(500);
      await d.page.click('#tabbar .tab[data-tab="me"]'); await sleep(500);
      const before = await d.page.evaluate(probe);
      open();
      await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 20000 }).catch(() => {});
      await sleep(1500);
      const after = await d.page.evaluate(probe);
      await d.ctx.unroute(L.api + '/api/**', h);
      const shotE = await shotEl(d, '#rewards', 'e-home-then-me-during-pull-rewards-after-pull');
      log('\n== E webkit cold eli iphone-pwa: open #home, tap Me while the first pull is held, then release');
      summarize('on Me, pull held', before);
      summarize('on Me, pull done', after);
      out.E = { before, after, shot: shotE };

      // F: warm, still on Me — a kid's stars row changes on the server (as Kid Verse would write it) and the shell pulls
      const kvNow = await L.apiAs('eli', '/api/data/kidverse?scope=family');
      const row = ((kvNow.body && kvNow.body.items) || []).find(i => i.key === 'stars:ezra');
      const changed = { ...row.value, total: (row.value.total || 0) + 1, earned: (row.value.earned || 0) + 1 };
      const w = await L.apiAs('ezra', '/api/data/kidverse/batch?scope=family', { method: 'POST', body: { items: [{ key: 'stars:ezra', value: changed, updated_at: row.updated_at + 1000 }] } });
      const beforeF = await d.page.evaluate(probe);
      const pulled = await d.page.evaluate(async () => { const ch = []; const off = hub.onChange(c => ch.push(c.app + ':' + c.key)); await hub.pull(); off(); return { changed: ch, cache: (hub.get('stars:ezra', { app: 'kidverse', scope: 'family' }) || {}).total }; });
      await sleep(800);
      const afterF = await d.page.evaluate(probe);
      log('\n== F warm, on Me: server stars:ezra total', row.value.total, '->', changed.total, `(write as ezra: ${w.status} ${JSON.stringify(w.body).slice(0, 120)})`);
      log('  shell pull emitted:', pulled.changed, 'shell cache stars:ezra.total now', pulled.cache);
      summarize('on Me before pull', beforeF);
      summarize('on Me after pull ', afterF);
      out.F = { write: { status: w.status }, from: row.value.total, to: changed.total, pulled, beforeF, afterF, shot: await shotEl(d, '#rewards', 'f-warm-after-remote-change-rewards') };
      await d.close();
    }
  } finally { await L.close(); }
}

const f = path.join(EVID, `${TAG}.json`); fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', rel(f));
