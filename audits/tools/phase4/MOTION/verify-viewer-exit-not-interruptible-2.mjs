// Phase 4 MOTION skeptic #2 — is the viewer's 220 ms close interruptible? Independent re-measure. WebKit, iPad portrait,
// Eli, typical seed, real clock. Only navigation taps; nothing written.
//  T1  tile tap at 60 / 150 / 260 ms after tapping Hub: what is under the finger and does the app open?
//  T2  openApp via the in-shell Home/Apps path is not reachable during exit except by hash: set #leftovers at 80 ms.
//  T3  same-app reopen by hash at 80 ms (frame.dataset.id still set → src is not reloaded, then blanked).
//  T4  close 120 ms into the 360 ms open: sample opacity/scale per rAF around the class change.
//   node "audits/tools/phase4/MOTION/verify-viewer-exit-not-interruptible-2.mjs" [--t4-chromium]  (T4 only, in Chromium)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const out = {};
const state = p => p.evaluate(() => { const v = document.getElementById('viewer'), f = document.getElementById('frame'); return { viewerClass: v.className, viewerDisplay: getComputedStyle(v).display, frameSrc: (f.getAttribute('src') || '').replace(/^.*\/apps\//, 'apps/'), frameId: f.dataset.id || null, hash: location.hash }; });
const ONLY_T4 = process.argv.includes('--t4-chromium'); // WebKit headless paints ~6 rAFs in 700 ms while the frame loads, too sparse for T4
const L = await local({ variant: 'typical', engine: ONLY_T4 ? 'chromium' : 'webkit' });
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
  const p = d.page;
  const fresh = async () => { await d.goto('#apps'); await p.waitForFunction(() => window.hub && hub.sync.lastPull > 0, null, { timeout: 15000 }).catch(() => {}); await sleep(900); };
  const tile = id => p.locator(`#grid .tile[data-id="${id}"]`);
  await fresh();
  const box = await tile('timer').boundingBox(); const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  if (!ONLY_T4) {
  out.T1 = {};
  for (const ms of [60, 150, 260]) {
    await fresh();
    await tile('tally').click(); await sleep(1400);
    await p.click('#pill-home'); await sleep(ms);
    const hit = await p.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.dataset && e.dataset.id ? '[' + e.dataset.id + ']' : '') : null; }, [cx, cy]);
    await p.mouse.click(cx, cy); await sleep(900);
    out.T1['tapAt' + ms + 'ms'] = { hit, after: await state(p) };
  }
  // T2
  await fresh(); await tile('tally').click(); await sleep(1400);
  await p.click('#pill-home'); await sleep(80);
  await p.evaluate(() => { location.hash = '#leftovers'; }); await sleep(60);
  out.T2_leftoversBy80msHash = { at140ms: await state(p) };
  await sleep(900); out.T2_leftoversBy80msHash.at1s = await state(p);
  out.T2_leftoversBy80msHash.appsTabActive = await p.evaluate(() => document.querySelector('.tab.on')?.dataset.tab || null);
  await p.screenshot({ path: path.join(EV, 'verify-viewer-exit-not-interruptible-2-hash-ipad.png'), scale: 'css', animations: 'disabled' });
  // recovery: does a tap on the Leftovers tile now open it?
  await tile('leftovers').click(); await sleep(900); out.T2_recoveryTileTap = await state(p);
  // T3 same app
  await fresh(); await tile('tally').click(); await sleep(1400);
  await p.click('#pill-home'); await sleep(80);
  await p.evaluate(() => { location.hash = '#tally'; }); await sleep(1000);
  out.T3_sameAppHash = await state(p);
  }
  // T4 close mid-open, driven inside the page so no automation latency: tile click via JS, Hub click from the rAF loop at >=120 ms
  await fresh();
  const s = await p.evaluate(() => new Promise(res => { const v = document.getElementById('viewer'); const S = []; let t0 = null, closed = false;
    const rec = tag => { const cs = getComputedStyle(v); const m = new DOMMatrix(cs.transform === 'none' ? undefined : cs.transform); S.push({ t: Math.round(performance.now() - t0), tag, cls: v.className, o: +(+cs.opacity).toFixed(3), s: +m.a.toFixed(3) }); };
    const tick = () => { rec('raf'); const t = performance.now() - t0; if (!closed && t >= 120) { closed = true; document.getElementById('pill-home').click(); } if (t < 700) requestAnimationFrame(tick); else res(S); };
    document.querySelector('#grid .tile[data-id="tally"]').click(); t0 = performance.now(); requestAnimationFrame(tick); }));
  const i = s.findIndex(x => /closing/.test(x.cls));
  out.T4_closeMidOpen = { lastBeforeClose: s[i - 1] || null, firstAfterClose: s[i] || null, next: s.slice(i + 1, i + 4), samples: s.length };
  if (s[i - 1] && s[i]) out.T4_closeMidOpen.opacityJump = +(s[i].o - s[i - 1].o).toFixed(3);
  out.errors = d.logs.filter(l => /error/i.test(l)).slice(0, 5);
  await d.close();
} finally {
  fs.writeFileSync(path.join(EV, ONLY_T4 ? 'verify-viewer-exit-not-interruptible-2-t4-chromium.json' : 'verify-viewer-exit-not-interruptible-2.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
  await L.close();
}
