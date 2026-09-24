// Skeptic #1 for finding "amenity-tap-dead": does a REAL tap on a restroom/first-aid/AED marker open its card?
// Real pointer input (mouse click + touchscreen tap) at the marker's on-screen centre, not a direct pick() call.
// Controls: (a) showAmen(a) called directly opens a card (so the detector works); (b) the token parse pick() does.
// Run: node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-1.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
try {
  console.log('started', L.site || '');
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 2500 });
  // zoom in until amenity markers draw
  for (let i = 0; i < 10; i++) {
    const n = await f.evaluate(() => document.querySelectorAll('g.amk').length);
    if (n) break;
    await f.evaluate(() => document.getElementById('z-in').click()); await sleep(500);   // the app's own zoom-in button
  }
  await sleep(800);
  console.log('zoomed');
  out.mppAfterZoom = await f.evaluate(() => mpp());
  out.amkCount = await f.evaluate(() => document.querySelectorAll('g.amk').length);
  // pick markers whose centre is on screen and topmost at that point
  const cands = await f.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, res = [];
    for (const g of document.querySelectorAll('g.amk')) {
      const r = g.querySelector('circle').getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
      if (cx < 30 || cy < 120 || cx > vw - 30 || cy > vh - 200) continue;
      const top = document.elementFromPoint(cx, cy); const hit = top && top.closest && top.closest('[data-pick]');
      res.push({ token: g.dataset.pick, cx, cy, topIsThisMarker: hit === g, topTag: top && top.tagName, topPick: hit && hit.dataset.pick });
    }
    return res;
  });
  out.candidatesOnScreen = cands.length;
  const targets = cands.filter(c => c.topIsThisMarker).slice(0, 3);
  out.targets = targets;
  const fe = await f.frameElement(); const fb = await fe.boundingBox();
  // spy: record every pick() call the real tap path makes (endPtr -> pick(dp), :848) and what it returned
  out.pickIsGlobal = await f.evaluate(() => { if (typeof window.pick !== "function") return false; const orig = window.pick; window.__picks = []; window.pick = function (elm) { const r = orig(elm); window.__picks.push({ token: elm && elm.dataset.pick, ret: r }); return r; }; return true; });
  out.taps = [];
  for (const [i, t] of targets.entries()) {
    await f.evaluate(() => { if (window.closePop) closePop(); });
    const px = fb.x + t.cx, py = fb.y + t.cy;
    const method = i % 2 === 0 ? 'mouse.click' : 'touchscreen.tap';
    if (method === 'mouse.click') await d.page.mouse.click(px, py); else await d.page.touchscreen.tap(px, py);
    await sleep(700);
    const st = await f.evaluate(() => { const p = document.getElementById('pop'); return { popShow: p.classList.contains('show'), popCat: p.dataset.cat || null, popH2: (p.querySelector('h2') || {}).textContent || null }; });
    out.taps.push({ token: t.token, method, ...st, pickCalls: await f.evaluate(() => window.__picks.splice(0)) });
    if (i === 0) await shot(d, 'verify-amenity-tap-dead-1-after-tap.png');
  }
  // what pick() computes from the token (same expressions as :844)
  out.parse = await f.evaluate(tok => { const [k, v] = tok.split(':'); const [kind, x, y] = v.split(':'); const found = amenList().find(q => q.kind === kind && Math.round(q.x) == x && Math.round(q.y) == y);
    const [, kind2, x2, y2] = tok.split(':'); const found2 = amenList().find(q => q.kind === kind2 && Math.round(q.x) == x2 && Math.round(q.y) == y2);
    return { k, v, kind, x: x ?? 'undefined', y: y ?? 'undefined', foundWithAppParse: !!found, foundWithFourPartParse: !!found2 }; }, targets[0] ? targets[0].token : 'a:restroom:0:0');
  // control: showAmen directly opens the card
  out.control = await f.evaluate(tok => { closePop(); const [, kind, x, y] = tok.split(':'); const a = amenList().find(q => q.kind === kind && Math.round(q.x) == x && Math.round(q.y) == y); if (!a) return { found: false }; showAmen(a); const p = document.getElementById('pop'); return { found: true, popShow: p.classList.contains('show'), popCat: p.dataset.cat, popH2: p.querySelector('h2').textContent }; }, targets[0] ? targets[0].token : 'a:restroom:0:0');
  await shot(d, 'verify-amenity-tap-dead-1-control-showAmen.png');
  await f.evaluate(() => closePop());
  // control 2: pop open, then tap an amenity -> does the open card stay (pick returns true so closePop is skipped)?
  if (targets[0]) {
    await f.evaluate(() => openPop('<h2>CONTROL CARD</h2>'));
    await d.page.mouse.click(fb.x + targets[0].cx, fb.y + targets[0].cy); await sleep(600);
    out.tapWithOtherCardOpen = await f.evaluate(() => { const p = document.getElementById('pop'); return { popShow: p.classList.contains('show'), popH2: (p.querySelector('h2') || {}).textContent || null }; });
  }
} finally { save('verify-amenity-tap-dead-1.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
