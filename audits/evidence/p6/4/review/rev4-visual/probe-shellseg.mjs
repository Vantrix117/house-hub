// rev4-visual round 3: the shell's guest "Stays until" (#gexp) and Household "Adult or kid" (#hhkind) segmented controls at 390/430, default + XXL
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe4/';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const scan = (page, id) => page.evaluate(id => { const s = document.getElementById(id); if (!s || !s.getClientRects().length) return null; const sr = s.getBoundingClientRect(), cs = getComputedStyle(s);
  const bs = [...s.querySelectorAll('button')].map(b => { const r = b.getBoundingClientRect(), c = getComputedStyle(b); return { t: b.textContent.trim(), w: Math.round(r.width), h: Math.round(r.height), clip: b.scrollWidth > b.clientWidth + 1, out: r.right > sr.right + 1 || r.left < sr.left - 1, r: c.borderRadius, sel: b.getAttribute('aria-pressed') }; });
  return { w: Math.round(sr.width), h: Math.round(sr.height), track: cs.backgroundColor, trackR: cs.borderRadius, wrap: cs.flexWrap, bs, docOver: document.documentElement.scrollWidth > innerWidth + 1 }; }, id);
try {
  for (const [w, size] of [[390, 'm'], [390, 'xxl'], [430, 'xxl'], [320, 'xl']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', localStorage: { 'hub.prefs': JSON.stringify({ textSize: size }) } });
    await d.page.setViewportSize({ width: w, height: 844 });
    await d.goto('#me'); await sleep(1500);
    await d.page.evaluate(s => window.hub && hub.setTextSize && hub.setTextSize(s === 'm' ? null : s), size).catch(() => {}); await sleep(600);
    await d.page.evaluate(() => { const b = document.getElementById('guest-add'); b && b.click(); }); await sleep(900);
    await d.page.evaluate(() => { const s = document.getElementById('gexp'); s && s.scrollIntoView({ block: 'center' }); }); await sleep(300);
    console.log('gexp', w, size, JSON.stringify(await scan(d.page, 'gexp')));
    await d.page.screenshot({ path: OUT + `gexp-${w}-${size}.png`, scale: 'css' });
    await d.goto('#home'); await sleep(400); await d.goto('#me'); await sleep(1500);
    await d.page.evaluate(() => { const b = document.querySelector('[data-hh="add"]'); b && b.click(); }); await sleep(900);
    await d.page.evaluate(() => { const s = document.getElementById('hhkind'); s && s.scrollIntoView({ block: 'center' }); }); await sleep(300);
    console.log('hhkind', w, size, JSON.stringify(await scan(d.page, 'hhkind')));
    await d.page.screenshot({ path: OUT + `hhkind-${w}-${size}.png`, scale: 'css' });
    await d.close();
  }
} finally { await L.close(); }
