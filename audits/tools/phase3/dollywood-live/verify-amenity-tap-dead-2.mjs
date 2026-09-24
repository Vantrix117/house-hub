// Skeptic #2 for finding "amenity-tap-dead": does a REAL tap (pointer events through the svg handlers, not a direct
// pick() call) on a restroom / first-aid / AED marker open its card? Controls: the same marker's showAmen() works when
// called with the matching record; a real tap on another pickable (official ride marker) does open a card.
// Run: node "audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-2.mjs"
import { local, sleep, save, shot, openMap } from './_lib.mjs';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = { script: 'audits/tools/phase3/dollywood-live/verify-amenity-tap-dead-2.mjs' };
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
  await d.goto('#home'); await sleep(1200);
  const f = await openMap(d, { settle: 2500 });
  // zoom in with the app's own + button until amenity markers draw
  for (let i = 0; i < 10; i++) {
    const n = await f.evaluate(() => document.querySelectorAll('g.amk').length);
    if (n) break;
    await f.evaluate(() => document.getElementById('z-in').click()); await sleep(450);
  }
  out.zoom = await f.evaluate(() => ({ mpp: typeof mpp === 'function' ? mpp() : null, markers: document.querySelectorAll('g.amk').length, amenTotal: (D.amen || []).length }));
  // choose markers whose centre is on screen and whose centre is hit-tested to the marker itself (not covered)
  const cands = await f.evaluate(() => {
    const W = innerWidth, H = innerHeight, res = [];
    document.querySelectorAll('g.amk').forEach(g => {
      const r = g.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 30 || cy < 120 || cx > W - 30 || cy > H - 200) return;
      const hit = document.elementFromPoint(cx, cy); const top = hit && hit.closest && hit.closest('[data-pick]');
      if (top === g) res.push({ token: g.dataset.pick, cx, cy });
    });
    return res.slice(0, 3);
  });
  out.candidates = cands;
  const fe = await f.frameElement(); const fb = await fe.boundingBox();
  out.taps = [];
  for (const c of cands) {
    await f.evaluate(() => { if (window.closePop) closePop(); });
    await sleep(200);
    const px = fb.x + c.cx, py = fb.y + c.cy;
    await d.page.mouse.click(px, py); await sleep(700);
    const after = await f.evaluate(() => ({ popShow: document.getElementById('pop').classList.contains('show'), popText: document.getElementById('pop').textContent.slice(0, 120) }));
    // what pick() parses from this token, and whether the matching record exists
    const parse = await f.evaluate(tok => {
      const [k, v] = tok.split(':'); const [kind, x, y] = String(v).split(':');
      const rest = tok.split(':'); const rec = amenList().find(q => q.kind === rest[1] && Math.round(q.x) == rest[2] && Math.round(q.y) == rest[3]);
      return { k, v, kind, x: x === undefined ? 'undefined' : x, y: y === undefined ? 'undefined' : y, recordExistsForFullToken: !!rec };
    }, c.token);
    out.taps.push({ ...c, ...after, parse });
  }
  if (cands[0]) await shot(d, 'verify-amenity-tap-dead-2-after-tap.png');
  // control A: showAmen with the record for the first marker opens a card (so the card code itself works)
  await f.evaluate(() => closePop());
  out.controlShowAmen = cands[0] ? await f.evaluate(tok => { const p = tok.split(':'); const a = amenList().find(q => q.kind === p[1] && Math.round(q.x) == p[2] && Math.round(q.y) == p[3]); if (!a) return 'no record'; showAmen(a); return { popShow: document.getElementById('pop').classList.contains('show'), popText: document.getElementById('pop').textContent.slice(0, 120) }; }, cands[0].token) : null;
  // control B: a real tap on a different pickable kind (o: official ride marker) opens a card
  await f.evaluate(() => closePop()); await sleep(200);
  const other = await f.evaluate(() => {
    const W = innerWidth, H = innerHeight;
    for (const g of document.querySelectorAll('[data-pick^="o:"],[data-pick^="c:"],[data-pick^="b:"]')) {
      const r = g.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      if (cx < 30 || cy < 120 || cx > W - 30 || cy > H - 200 || !r.width) continue;
      const hit = document.elementFromPoint(cx, cy); if (hit && hit.closest && hit.closest('[data-pick]') === g) return { token: g.dataset.pick, cx, cy };
    }
    return null;
  });
  if (other) { await d.page.mouse.click(fb.x + other.cx, fb.y + other.cy); await sleep(700); other.popShow = await f.evaluate(() => document.getElementById('pop').classList.contains('show')); other.popText = await f.evaluate(() => document.getElementById('pop').textContent.slice(0, 120)); }
  out.controlOtherTap = other;
} finally { save('verify-amenity-tap-dead-2.json', out); console.log(JSON.stringify(out, null, 2)); await L.close(); }
