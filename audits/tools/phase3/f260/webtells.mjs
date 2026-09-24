// F260 — the house style's web-tells list, measured: tap highlight, long-press callout / selection on chrome, native
// controls, link styling, focus rings, tap delay (touch-action), scrollbars, layout shift while data loads (Chromium
// layout-shift entries, cold open with the first data pull delayed 1.5 s), press states and motion durations.
//   node "audits/tools/phase3/f260/webtells.mjs"
import { local, sleep, DEMO, save, ready } from './_lib.mjs';

const out = {};
// ── WebKit: computed styles on an iPhone ──
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    const f = await d.openApp('f260'); await ready(f);
    out.webkit = await f.evaluate(() => {
      const q = s => document.querySelector(s);
      const st = (s, props) => { const e = q(s); if (!e) return null; const c = getComputedStyle(e); return Object.fromEntries(props.map(p => [p, c.getPropertyValue(p) || c[p]])); };
      const P = ['-webkit-tap-highlight-color', '-webkit-user-select', 'user-select', '-webkit-touch-callout', 'touch-action'];
      return {
        todayDone: st('#todayDone', P), weekHead: st('.wk-head', P), mark: st('.mark', P), refLink: st('.refs a', [...P, 'color', 'text-decoration-line', 'border-bottom-width', 'border-bottom-color']),
        switchBtn: st('.switch button', P), h1: st('h1', P), body: st('body', [...P, 'overscroll-behavior-y', 'background-color']), html: st('html', ['background-color', 'overscroll-behavior-y']),
        select: st('#wkSel', ['-webkit-appearance', 'appearance', 'background-image']), checkbox: st('#showPw', ['-webkit-appearance', 'appearance', 'accent-color', 'width']), search: st('#jSearch', ['-webkit-appearance', 'appearance']),
        sideScrollbar: st('.side', ['scrollbar-width', 'overflow-y']), milesScrollbar: st('.miles', ['scrollbar-width']),
        activeRules: [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } }).map(r => r.selectorText || '').filter(s => /:active/.test(s)).length,
        focusVisibleRules: [...document.styleSheets].flatMap(ss => { try { return [...ss.cssRules]; } catch { return []; } }).map(r => r.selectorText || '').filter(s => /:focus-visible/.test(s)),
      };
    });
    await d.close();
  } finally { await L.close(); }
}
// ── Chromium: layout shift during a cold open (no cache; first data pull delayed 1.5 s) ──
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    for (const [label, delay] of [['cold-1500ms', 1500], ['cold-0ms', 0]]) {
      const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
      await d.ctx.route(u => u.href.startsWith(L.api + '/api/data/'), async r => { if (delay) await sleep(delay); r.fallback(); });
      await d.ctx.addInitScript(() => { window.__ls = []; try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__ls.push({ v: +e.value.toFixed(4), t: Math.round(e.startTime), input: e.hadRecentInput, src: (e.sources || []).map(s => s.node && (s.node.id || s.node.className || s.node.nodeName)).slice(0, 4) }); }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { window.__lsErr = String(e); } });
      await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' });
      await ready(d.page); await sleep(1500);
      const ls = await d.page.evaluate(() => ({ entries: window.__ls, err: window.__lsErr || null }));
      out['cls-' + label] = { total: +ls.entries.filter(e => !e.input).reduce((a, e) => a + e.v, 0).toFixed(4), entries: ls.entries.slice(0, 8), err: ls.err };
      await d.close();
    }
  } finally { await L.close(); }
}
console.log('webkit', JSON.stringify(out.webkit));
console.log('CLS cold 1.5 s', JSON.stringify(out['cls-cold-1500ms']));
console.log('CLS cold 0 s  ', JSON.stringify(out['cls-cold-0ms']));
console.log('evidence →', save('webtells.json', out));
