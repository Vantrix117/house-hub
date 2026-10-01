// rev4-visual: Prayer's .ds .seg track vs the page, the sym icons, kid target sizes, per theme
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe2/';
const L = await local({ variant: 'typical', clock: 'demo', engine: process.argv[2] || 'webkit' });
const ready = f => f.waitForFunction(() => document.getElementById('todayLine') && document.getElementById('todayLine').textContent.trim().length > 0, null, { timeout: 20000 });
try {
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', localStorage: { 'hub.theme': JSON.stringify(theme) } });
    const f = await d.openApp('prayer'); await ready(f); await sleep(700);
    const m = await f.evaluate(() => {
      const sw = document.getElementById('listSwitch'), cs = getComputedStyle(sw), b = sw.querySelector('[aria-pressed="true"]'), bs = getComputedStyle(b);
      let el = sw.parentElement, pageBg = 'transparent'; while (el) { const c = getComputedStyle(el).backgroundColor; if (c !== 'rgba(0, 0, 0, 0)') { pageBg = c; break; } el = el.parentElement; }
      const syms = [...document.querySelectorAll('svg.sym')].filter(s => s.getClientRects().length).map(s => { const u = s.querySelector('use'); let w = 0; try { w = u.getBBox().width; } catch (e) {} return { id: (u.getAttribute('href') || '').split('#')[1], w, sw: getComputedStyle(s).strokeWidth }; });
      return { theme: document.documentElement.dataset.theme, track: cs.backgroundColor, trackR: cs.borderRadius, pageBg, sel: bs.backgroundColor, selR: bs.borderRadius, selH: b.getBoundingClientRect().height, syms: syms.length, blank: syms.filter(x => !x.w).map(x => x.id), strokes: [...new Set(syms.map(x => x.sw))] };
    });
    console.log(JSON.stringify(m));
    await d.close();
  }
  // kid targets
  const k = await L.device({ device: 'iphone-pwa', profile: 'ezra' });
  const fk = await k.openApp('prayer'); await sleep(3000);
  const kk = await fk.evaluate(() => [...document.querySelectorAll('button')].filter(b => b.getClientRects().length).map(b => { const r = b.getBoundingClientRect(); return [b.className || b.id || b.textContent.trim().slice(0, 12), Math.round(r.width), Math.round(r.height)]; }).filter(x => x[2] < 64 || x[1] < 64));
  console.log('kid buttons under 64:', JSON.stringify(kk));
  await k.close();
} finally { await L.close(); }
