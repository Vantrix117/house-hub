// rev4-visual round 2: every segmented control in F260 settings, Prayer (today + add) and the shell Me tab: clipped labels?
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
import { put } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/phase3/f260/_lib.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe4/';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const scan = ctx => ctx.evaluate(() => [...document.querySelectorAll('.segmented, .ds .seg, .seg')].filter(s => s.getClientRects().length).map(s => {
  const bs = [...s.querySelectorAll('button')].filter(b => b.getClientRects().length);
  const clipped = bs.filter(b => b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim());
  const sr = s.getBoundingClientRect(), over = bs.filter(b => { const r = b.getBoundingClientRect(); return r.right > sr.right + 1 || r.left < sr.left - 1; }).map(b => b.textContent.trim());
  return { id: s.id || s.className, w: Math.round(sr.width), h: Math.round(sr.height), n: bs.length, clipped, over, pageOverflow: document.documentElement.scrollWidth > innerWidth + 1 };
}).filter(x => x.n));
try {
  for (const [w, h] of [[390, 844], [430, 932], [820, 1180]]) for (const size of ['', 'xxl']) {
    await put(L, 'eli', 'textSize', size || null, { app: 'hub' });
    const d = await L.device({ device: w > 600 ? 'ipad-portrait' : 'iphone-pwa', profile: 'eli' });
    await d.page.setViewportSize({ width: w, height: h });
    // F260 settings
    let f = await d.openApp('f260'); await f.waitForFunction(() => document.getElementById('todayTitle') && document.getElementById('todayTitle').textContent.trim(), null, { timeout: 20000 });
    await f.evaluate(() => { document.getElementById('sheet').classList.add('on'); document.getElementById('srcSeg').scrollIntoView({ block: 'start' }); }); await sleep(600);
    console.log(`f260 ${w} ${size || 'm'}`, JSON.stringify(await scan(f)));
    await d.page.screenshot({ path: OUT + `seg-f260-${w}-${size || 'm'}.png`, scale: 'css' });
    // Prayer today + add
    await d.page.goto('about:blank'); f = await d.openApp('prayer'); await sleep(3500);
    console.log(`prayer-today ${w} ${size || 'm'}`, JSON.stringify(await scan(f)));
    await f.evaluate(() => { const b = document.querySelector('nav button[data-go="add"]'); b && b.click(); }); await sleep(900);
    console.log(`prayer-add ${w} ${size || 'm'}`, JSON.stringify(await scan(f)));
    await d.page.screenshot({ path: OUT + `seg-prayer-add-${w}-${size || 'm'}.png`, scale: 'css' });
    // shell Me
    await d.goto('#me'); await sleep(2500); console.log(`shell-me ${w} ${size || 'm'}`, JSON.stringify(await scan(d.page))); await d.page.screenshot({ path: OUT + `seg-shell-me-${w}-${size || 'm'}.png`, scale: 'css', fullPage: true });
    await d.close();
  }
} finally { await L.close(); }
