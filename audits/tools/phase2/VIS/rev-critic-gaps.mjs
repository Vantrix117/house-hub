// Section-edit check for two shell leads the Phase 2 critic listed as "not covered" (critic G7):
//   A. "The activity feed is unreadable on a portrait kiosk iPad" (01-leads TV): the kiosk profile on ipad-portrait,
//      ipad-landscape and the 1920x1080 TV (control). For each "Around the house" line on the board: pane width, the
//      .txt box's visible width against its full text width, and the visible share of the text.
//   B. "Me shows empty states instead of skeletons while loading" (01-leads Shell, index.html:1349-1356, 1429): Eli on
//      ipad-portrait with a cold cache, the first /api/data + /api/activity calls held behind a gate while #me is open.
//      Records what the Kids' rewards card, the Family album and the Sync card say while the pull is pending, then after it.
// Local rig only (lib/local.mjs); nothing is written to the server. PNGs at 1x CSS scale.
//   node "audits/tools/phase2/VIS/rev-critic-gaps.mjs"
// Evidence -> audits/evidence/p2/VIS/rev-critic-gaps{.json,-*.png}
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const EVID = path.join(ROOT, 'audits/evidence/p2/VIS');
fs.mkdirSync(EVID, { recursive: true });
const TAG = 'rev-critic-gaps';
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const out = { A: {}, B: {} };
const shot = async (d, name) => { const f = path.join(EVID, `${TAG}-${name}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return rel(f); };

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // ── A: kiosk feed lines ──────────────────────────────────────────────────────────────────────────────────────────
  for (const device of ['ipad-portrait', 'ipad-landscape', 'tv']) {
    const d = await L.device({ device, profile: 'tv' });
    await d.goto('#home');
    await d.page.waitForSelector('#tv-feed li', { timeout: 15000 });
    await d.page.waitForFunction(() => hub.sync.lastPull > 0, null, { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    const r = await d.page.evaluate(() => {
      const pane = document.querySelector('#tv-feed').closest('.tv-pane');
      const pr = pane.getBoundingClientRect();
      const lines = [...document.querySelectorAll('#tv-feed li')].map(li => {
        const who = li.querySelector('.who'), txt = li.querySelector('.txt'), when = li.querySelector('.when');
        if (!txt) return { quiet: li.textContent.trim() };
        const full = txt.textContent;
        // the visible prefix: binary-search the number of characters that fit in the box (ellipsis costs ~1 char)
        const probe = document.createElement('span'); probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font:inherit';
        txt.appendChild(probe);
        let lo = 0, hi = full.length;
        while (lo < hi) { const m = Math.ceil((lo + hi) / 2); probe.textContent = full.slice(0, m) + '…'; if (probe.getBoundingClientRect().width <= txt.clientWidth) lo = m; else hi = m - 1; }
        probe.remove();
        return {
          who: who && who.textContent, whoW: who && Math.round(who.getBoundingClientRect().width),
          when: when && when.textContent, txtClientW: txt.clientWidth, txtScrollW: txt.scrollWidth,
          visibleShare: +(txt.clientWidth / Math.max(1, txt.scrollWidth)).toFixed(2),
          full, visible: txt.scrollWidth > txt.clientWidth ? full.slice(0, lo) + '…' : full,
          fontPx: parseFloat(getComputedStyle(txt).fontSize),
        };
      });
      return { viewport: [innerWidth, innerHeight], paneW: Math.round(pr.width), paneX: Math.round(pr.left), paneY: Math.round(pr.top), lines };
    });
    r.shot = await shot(d, `A-kiosk-feed-${device}`);
    out.A[device] = r;
    console.log(`\n== A kiosk ${device} ${r.viewport.join('x')}: feed pane ${r.paneW} px wide at x=${r.paneX}, y=${r.paneY}`);
    for (const l of r.lines) console.log(l.quiet ? `   (quiet) ${l.quiet}` : `   who "${l.who}" ${l.whoW}px | txt ${l.txtClientW}/${l.txtScrollW}px (${Math.round(l.visibleShare * 100)}%) @${l.fontPx}px | visible "${l.visible}" | full "${l.full}" | when "${l.when}"`);
    await d.close();
  }

  // ── B: Me while the first pull is pending (cold cache) ───────────────────────────────────────────────────────────
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli' });
    let open; const gate = new Promise(r => { open = r; }); let held = 0;
    const h = async r => { if (/\/api\/(data|activity)/.test(r.request().url())) { held++; await gate; } await r.continue().catch(() => {}); };
    await d.ctx.route(L.api + '/api/**', h);
    await d.page.goto(L.site + '/index.html#me', { waitUntil: 'load' });
    await d.page.waitForSelector('#view-me .card', { timeout: 15000 });
    await sleep(800);
    const probe = () => {
      const t = s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\s+/g, ' ').trim().slice(0, 220) : null; };
      const sync = [...document.querySelectorAll('#view-me .card')].find(c => /Sync/.test((c.querySelector('h2') || {}).textContent || ''));
      return {
        sync: { state: hub.sync.state, lastPull: hub.sync.lastPull }, onLine: navigator.onLine,
        skeletons: document.querySelectorAll('#view-me .skeleton').length,
        rewards: t('#rewards-body'),
        rewardButtonsDisabled: [...document.querySelectorAll('#rewards-body button')].map(b => `${b.textContent.trim()}:${b.disabled}`),
        album: t('#album-grid'),
        syncCard: sync ? sync.innerText.replace(/\s+/g, ' ').trim().slice(0, 200) : null,
      };
    };
    const loading = await d.page.evaluate(probe); loading.heldRequests = held;
    const s1 = await shot(d, 'B-me-cold-loading-ipad-portrait');
    open();
    await d.page.waitForFunction(() => hub.sync.lastPull > 0 && hub.sync.state === 'synced', null, { timeout: 20000 }).catch(() => {});
    await sleep(1500);
    const loaded = await d.page.evaluate(probe);
    const s2 = await shot(d, 'B-me-cold-after-pull-ipad-portrait');
    // control: the server's view of the same facts
    const res = await L.apiAs('eli', '/api/data/hub?scope=family').catch(e => ({ status: 0, body: String(e) }));
    const rows = res.body && (Array.isArray(res.body) ? res.body : res.body.rows || res.body.items || res.body.data);
    const albumRows = Array.isArray(rows) ? rows.filter(x => /^album:/.test(x.key) && x.value != null && !x.deleted).length : `status ${res.status}: ${JSON.stringify(res.body).slice(0, 160)}`;
    out.B = { loading, loaded, serverAlbumRows: albumRows, shots: [s1, s2] };
    console.log('\n== B Me, cold cache, first pull held (Eli, ipad-portrait)');
    console.log('  loading:', JSON.stringify(loading));
    console.log('  after the pull (same page, no navigation):', JSON.stringify(loaded));
    console.log('  server album rows (family hub):', albumRows);
    await d.close();
  }
} finally { await L.close(); }

const f = path.join(EVID, `${TAG}.json`); fs.writeFileSync(f, JSON.stringify(out, null, 1));
console.log('\nwrote', rel(f));
