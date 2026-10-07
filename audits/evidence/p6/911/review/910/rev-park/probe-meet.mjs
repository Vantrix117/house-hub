// R-park probe: the meeting pin's label and the meeting bar at 390 px (default and XXL text), adult (Rally shown) and kid (no Rally)
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const T = 'C:/Users/ex_bo/hub-audit/audits/tools/';
const { local, sleep } = await import(pathToFileURL(T + 'lib/local.mjs').href);
const { openMap } = await import(pathToFileURL(T + 'phase3/dollywood-live/_lib.mjs').href);
const OUT = 'C:/Users/ex_bo/b910/rev-park/shots/';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const measure = f => f.evaluate(() => {
  const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width) }; };
  const pill = document.querySelector('.lv-meetpin rect.mp-pill'), txt = document.querySelector('.lv-meetpin text');
  const nm = document.getElementById('meet-name'), meta = document.getElementById('meet-meta');
  const vw = document.documentElement.clientWidth;
  const comp = document.querySelector('#lv-north, .lv-north, #north, [aria-label*="orth"]');
  const pr = r(pill);
  const fabs = [...document.querySelectorAll('button')].filter(b => { const s = getComputedStyle(b); return s.position === 'absolute' || s.position === 'fixed'; }).map(b => ({ id: b.id || b.className, ...r(b) })).filter(b => pr && b.w && !(b.r < pr.l || b.l > pr.r || b.b < pr.t || b.t > pr.b));
  return { vw, textSize: document.documentElement.dataset.textSize || null, meetName: nm && nm.textContent, nameClipped: nm ? nm.scrollWidth > nm.clientWidth + 1 : null, nameShownPx: nm && nm.clientWidth, nameNeedPx: nm && nm.scrollWidth,
    meta: meta && meta.textContent, metaClipped: meta ? meta.scrollWidth > meta.clientWidth + 1 : null, side: document.querySelector('.lv-meetpin') && document.querySelector('.lv-meetpin').dataset.side,
    label: txt && txt.textContent, pill: pr, offLeft: pr ? Math.max(0, -pr.l) : null, offRight: pr ? Math.max(0, pr.r - vw) : null, controlsOverPill: fabs,
    rally: (b => b && !b.hidden ? r(b) : null)(document.getElementById('lv-rally')) };
});
try {
  const rows = (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items || [];
  out.meetSeed = (rows.find(x => x.key === 'meet') || {}).value || null;
  for (const [who, ts] of [['eli', 'm'], ['eli', 'xxl'], ['ezra', 'm']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: who, fixedTime: false });
    await d.goto('#home'); await sleep(1200);
    if (ts !== 'm') { await d.page.evaluate(t => hub.setTextSize(t), ts); await sleep(500); await d.page.reload(); await sleep(1500); }
    const f = await openMap(d, { settle: 2500 });
    const k = `${who}-${ts}`;
    out[k] = await measure(f);
    await d.page.screenshot({ path: OUT + `meet-${k}.png`, scale: 'css' });
    await d.close();
  }
  // parking-lot fix: inside the map's PROPERTY polygon, outside the Worker/Home box (y > 2511)
  {
    const { latLon } = await import(pathToFileURL(T + 'phase3/dollywood-live/_lib.mjs').href);
    const d = await L.device({ device: 'iphone-pwa', profile: 'christian', fixedTime: false });
    await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
    await d.goto('#home'); await sleep(1200);
    const f = await openMap(d, { settle: 1500 });
    await d.ctx.setGeolocation({ ...(await latLon(f, 1500, 3000)), accuracy: 10 });
    await f.evaluate(() => { try { setShare(true) } catch (e) {} });
    await sleep(6000);
    out.lot = await f.evaluate(() => ({ onProperty: onProperty([1500, 3000]), me: me && { x: Math.round(me.x), y: Math.round(me.y), src: me.src }, shareOn: shareOn(), pill: document.getElementById('loc-sec').textContent + ' / ' + document.getElementById('loc-acc').textContent }));
    await f.evaluate(() => hub.flush && hub.flush()).catch(() => {}); await sleep(1500);
    const rows2 = (await L.apiAs('eli', '/api/data/dollywood-live?scope=family')).body.items || [];
    out.lot.serverRow = (rows2.find(x => x.key === 'loc:christian') || {}).value || null;
    await d.page.screenshot({ path: OUT + 'lot-mae.png', scale: 'css' });
    await d.close();
    const e = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await e.goto('#home'); await sleep(4000);
    out.lot.eliHomeParkText = await e.page.evaluate(() => { const c = [...document.querySelectorAll('section,article,.card,.gcard')].find(x => /At the park/i.test(x.textContent)); return c ? c.textContent.replace(/\s+/g, ' ').slice(0, 200) : null; });
    await e.page.screenshot({ path: OUT + 'lot-eli-home.png', scale: 'css', fullPage: true });
    await e.close();
  }
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 2));
