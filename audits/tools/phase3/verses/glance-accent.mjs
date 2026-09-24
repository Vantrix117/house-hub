// (1) iPad glanceability: rendered size of the reference (h1), the stat numerals and the kid card text on the Kitchen iPad
//     (820×1180 portrait), with cap height measured from the font (canvas measureText('H').actualBoundingBoxAscent).
//     Heuristic: character (cap) height ≥ viewing distance / 200 (2 m → 10 mm, 3 m → 15 mm); 1 CSS px ≈ 0.192 mm on an
//     11-inch iPad (264 ppi, 2 device px per CSS px).
// (2) Per-profile accent: --accent, the Show button fill and the page wash for Eli, Elizabeth (mom) and Ezra.
// (3) Web tells on the chrome: tap highlight, touch callout, user-select on the pill / kicker / buttons, focus-visible rule.
// (4) Layout shift while the app loads (Chromium only; WebKit has no LayoutShift API): cold and warm first paint.
import { local, DEMO, sleep } from '../../lib/local.mjs';
import { openVerses, save } from './_lib.mjs';
const MM = 0.192;
const out = {};
let L = await local({ variant: 'typical', clock: 'demo' });
try {
  const measure = f => f.evaluate(() => {
    const cv = document.createElement('canvas').getContext('2d');
    const m = sel => { const e = document.querySelector(sel); if (!e || e.closest('[hidden]')) return null; const cs = getComputedStyle(e); cv.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; const t = cv.measureText('H'); const x = cv.measureText('x'); return { sel, fs: parseFloat(cs.fontSize), cap: +t.actualBoundingBoxAscent.toFixed(1), xh: +x.actualBoundingBoxAscent.toFixed(1), text: e.textContent.trim().slice(0, 30) }; };
    return ['#ref', '#kick', '#hint', '#show span', '.stats b', '.stats .stat span', '#who', '.queue .rf', '.boxes .lbl'].map(m).filter(Boolean);
  });
  for (const who of ['eli', 'ezra']) {
    const d = await L.device({ device: 'ipad-portrait', profile: who, installClock: DEMO });
    const f = await openVerses(d);
    out['glance-' + who] = (await measure(f)).map(r => ({ ...r, capMm: +(r.cap * MM).toFixed(1), legibleAtM: +((r.cap * MM) * 200 / 1000).toFixed(2) }));
    await d.close();
  }
  for (const who of ['eli', 'mom', 'ezra', 'kiara']) {
    const d = await L.device({ device: 'iphone-pwa', profile: who, installClock: DEMO });
    const f = await openVerses(d);
    out['accent-' + who] = await f.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), showBg: getComputedStyle(document.getElementById('show')).backgroundImage.slice(0, 120) + ' | ' + getComputedStyle(document.getElementById('show')).backgroundColor, wash: getComputedStyle(document.body).backgroundImage.slice(0, 200), avatar: document.querySelector('#who .avatar') ? document.querySelector('#who .avatar').outerHTML.slice(0, 160) : null, name: document.querySelector('#who').textContent }));
    if (who === 'eli') out.tells = await f.evaluate(() => {
      const cs = s => getComputedStyle(document.querySelector(s));
      const rules = [...document.styleSheets].flatMap(sh => { try { return [...sh.cssRules]; } catch { return []; } }).map(r => r.cssText).filter(t => /focus-visible|tap-highlight|touch-callout|overscroll/.test(t)).map(t => t.slice(0, 140));
      return { tapHighlight: cs('#show').webkitTapHighlightColor, calloutBody: cs('body').webkitTouchCallout, userSelectPill: cs('#who').userSelect || cs('#who').webkitUserSelect, userSelectKicker: cs('#kick').webkitUserSelect, userSelectBtn: cs('#show').webkitUserSelect, userSelectRef: cs('#ref').webkitUserSelect, overscroll: cs('html').overscrollBehaviorY + '/' + cs('body').overscrollBehaviorY, rules };
    });
    await d.close();
  }
  await L.close();
  // (4) CLS in Chromium
  L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  const cls = async (warm) => {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.ctx.addInitScript(() => { window.__cls = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), src: (e.sources || []).map(s => s.node && (s.node.id || s.node.className || s.node.nodeName)).slice(0, 4) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { window.__cls.push('no api ' + e); } });
    if (warm) { await d.page.goto(L.site + '/apps/verses.html'); await d.page.waitForSelector('#trainer:not([hidden])'); await sleep(1500); }
    await d.page.goto(L.site + '/apps/verses.html'); await sleep(2500);
    const r = await d.page.evaluate(() => ({ entries: window.__cls, total: +window.__cls.reduce((a, e) => a + (e.v || 0), 0).toFixed(4) }));
    await d.close(); return r;
  };
  out.clsCold = await cls(false); out.clsWarm = await cls(true);
  console.log(JSON.stringify(out, null, 1));
  save('glance-accent.json', out);
} finally { await L.close(); }
