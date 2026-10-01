// Probe 8: the shell's .seg groups (Me → Appearance, Add a guest's "Stays until", Add a person's "Adult or kid") at 320/390
// with XXL text: no horizontal overflow, every item >= 44 px, text not clipped.
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
const SHOTS = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-core/probes/';
const measure = page => page.evaluate(() => [...document.querySelectorAll('.seg')].filter(s => s.getClientRects().length).map(s => {
  const r = s.getBoundingClientRect();
  return { id: s.id, w: Math.round(r.width), sw: s.scrollWidth, cw: s.clientWidth, right: Math.round(r.right), vw: innerWidth, docOverflow: document.documentElement.scrollWidth > innerWidth,
    items: [...s.querySelectorAll('button')].map(b => { const q = b.getBoundingClientRect(); return [b.textContent.trim().slice(0, 12), Math.round(q.width), Math.round(q.height), b.scrollWidth > b.clientWidth + 1]; }) };
}));
try {
  for (const [w, size] of [[390, 'xxl'], [320, 'xl'], [390, 'm']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', localStorage: { 'hub.prefs': JSON.stringify({ textSize: size }) } });
    await d.page.setViewportSize({ width: w, height: 844 });
    await d.goto('#me'); await sleep(1500); await d.page.evaluate(s => hub.setTextSize(s), size); await d.page.evaluate(() => { location.hash = '#home'; }); await sleep(300); await d.page.evaluate(() => { location.hash = '#me'; }); await sleep(1200); out[w + '-' + size + '-attr'] = await d.page.evaluate(() => document.documentElement.dataset.textSize);
    const k = w + '-' + size;
    out[k + '-me'] = await measure(d.page);
    await d.page.evaluate(() => document.getElementById('guest-add') && document.getElementById('guest-add').click()); await sleep(800);
    out[k + '-guest'] = await measure(d.page);
    await d.page.screenshot({ path: SHOTS + 'p8-guest-' + k + '.png' });
    await d.close();
  }
} catch (e) { out.err = String(e && e.stack || e); }
finally { await L.close(); }
for (const [k, v] of Object.entries(out)) console.log(k, JSON.stringify(v));
