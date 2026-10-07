// R-park round 4: the collapsed meeting bar (names, sizes, the rally feedback), the current-turn arrow's real colour, drawMeet cost
import { pathToFileURL } from 'node:url';
const T = 'C:/Users/ex_bo/hub-audit/audits/tools/';
const { local, sleep } = await import(pathToFileURL(T + 'lib/local.mjs').href);
const { openMap, latLon } = await import(pathToFileURL(T + 'phase3/dollywood-live/_lib.mjs').href);
const OUT = 'C:/Users/ex_bo/b910/rev-park/shots/';
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
const barInfo = f => f.evaluate(() => {
  const r = e => { const b = e.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; };
  const vis = e => !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).display !== 'none';
  const mt = document.getElementById('meet-t'), meta = document.getElementById('meet-meta');
  return { open: document.getElementById('lv-meet').hasAttribute('data-open'), name: document.getElementById('meet-name').textContent,
    metaVisible: vis(meta), metaText: meta.textContent, metaLive: meta.getAttribute('aria-live'),
    t: { role: mt.getAttribute('role'), expanded: mt.getAttribute('aria-expanded'), size: r(mt) },
    buttons: ['meet-go', 'lv-rally', 'meet-done'].map(id => { const b = document.getElementById(id); return { id, shown: vis(b), label: b.getAttribute('aria-label'), text: b.innerText.trim(), size: vis(b) ? r(b) : null, disabled: b.disabled }; }) };
});
try {
  // A. adult phone, collapsed: names, sizes; then Rally from the collapsed bar and what the person sees afterwards
  for (const [who, ts, dev] of [['eli', 'm', 'iphone-pwa'], ['eli', 'xxl', 'iphone-pwa'], ['ezra', 'm', 'iphone-pwa'], ['eli', 'm', 'ipad-portrait']]) {
    const d = await L.device({ device: dev, profile: who, fixedTime: false });
    await d.goto('#home'); await sleep(1000);
    if (ts !== 'm') { await d.page.evaluate(t => hub.setTextSize(t), ts); await sleep(400); await d.page.reload(); await sleep(1500); }
    const f = await openMap(d, { settle: 2500 });
    const k = `${who}-${ts}-${dev}`;
    out[k] = { before: await barInfo(f) };
    // the tap target on the name: does it do anything here?
    await f.click('#meet-t').catch(e => { out[k].tapErr = String(e).slice(0, 100); }); await sleep(400);
    out[k].afterTapName = (await barInfo(f)).open;
    if (out[k].afterTapName) { await f.click('#meet-t'); await sleep(300); }
    if (who === 'eli' && ts === 'm') {
      await f.click('#lv-rally'); await f.waitForSelector('#ask-ok', { timeout: 5000 });
      out[k].sheet = await f.evaluate(() => document.getElementById('ask-t').textContent);
      await f.click('#ask-ok'); await sleep(2500);
      out[k].afterRally = await barInfo(f);
      await d.page.screenshot({ path: OUT + `r4-after-rally-${k}.png`, scale: 'css' });
    }
    await d.page.screenshot({ path: OUT + `r4-${k}.png`, scale: 'css' });
    // C. drawMeet cost: time it and count calls over a pan-and-commit
    out[k].drawMeet = await f.evaluate(async () => {
      let n = 0, ms = 0; const orig = window.drawMeet || drawMeet;
      const t0 = performance.now(); for (let i = 0; i < 20; i++) drawMeet(); const per = (performance.now() - t0) / 20;
      return { perCallMs: +per.toFixed(2) };
    }).catch(e => String(e).slice(0, 120));
    await d.close();
  }
  // B. the current-turn arrow: computed stroke vs the colour actually used (currentColor) vs the tile, in every palette
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false });
    await d.ctx.grantPermissions(['geolocation'], { origin: L.site });
    await d.goto('#home'); await sleep(1000);
    const f = await openMap(d, { settle: 1500 });
    await f.evaluate(() => { try { setShare(true) } catch (e) {} });
    await d.ctx.setGeolocation({ ...(await latLon(f, 762, 842)), accuracy: 6 }); await sleep(2500);
    await f.evaluate(() => { routeTo(OFFNUM[28]); document.getElementById('lv-route').classList.add('open'); }); await sleep(800);
    out.turn = await f.evaluate(() => {
      const L = c => { const m = c.match(/[\d.]+/g).map(Number); const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }; return .2126 * f(m[0]) + .7152 * f(m[1]) + .0722 * f(m[2]); };
      const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
      const root = document.documentElement, res = [];
      for (const [th, sc] of [['hearth', 'light'], ['parchment', 'light'], ['frost', 'light'], ['midnight', 'dark'], ['forest', 'dark'], ['graphite', 'dark']]) {
        root.dataset.theme = th; root.dataset.scheme = sc;
        const g = document.querySelector('.lv-step.now .g'), s = g && g.querySelector('.sym'); if (!s) { res.push({ th, none: true }); continue; }
        const st = getComputedStyle(s), bg = getComputedStyle(g).backgroundColor;
        const use = s.querySelector('use'), href = use && use.getAttribute('href');
        res.push({ th, cssStroke: st.stroke, color: st.color, tile: bg, ratioStroke: +cr(st.stroke, bg).toFixed(2), ratioCurrentColor: +cr(st.color, bg).toFixed(2), href });
      }
      return res;
    });
    // pixel check: the drawn arrow on the tile, hearth light
    await f.evaluate(() => { document.documentElement.dataset.theme = 'hearth'; document.documentElement.dataset.scheme = 'light'; document.querySelector('.lv-step.now').scrollIntoView({ block: 'center' }); });
    await sleep(300);
    const box = await f.evaluate(() => { const b = document.querySelector('.lv-step.now .g').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    const fb = await (await d.page.$('iframe')).boundingBox();
    await d.page.screenshot({ path: OUT + 'r4-turn-tile.png', clip: { x: fb.x + box.x - 4, y: fb.y + box.y - 4, width: box.w + 8, height: box.h + 8 }, scale: 'css' });
    await d.close();
  }
} catch (e) { out.error = String(e && e.stack || e); }
finally { await L.close(); }
console.log(JSON.stringify(out, null, 2));
