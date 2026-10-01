// rev4-visual round 2: F260 settings open at 390/430, default and XXL — page overflow culprits and clipped segment labels: node probe-f260set.mjs <root> <tag>
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const ROOT = process.argv[2], TAG = process.argv[3] || 'x';
const { local, sleep } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/local.mjs')).href);
const { put } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/phase3/f260/_lib.mjs')).href);
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev4-visual/probe4/';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const [w, size] of [[390, ''], [430, ''], [390, 'xxl'], [430, 'xxl'], [820, 'xxl']]) {
    await put(L, 'eli', 'textSize', size || null, { app: 'hub' });
    const d = await L.device({ device: w > 600 ? 'ipad-portrait' : 'iphone-pwa', profile: 'eli' });
    await d.page.setViewportSize({ width: w, height: 900 });
    const f = await d.openApp('f260'); await f.waitForFunction(() => document.getElementById('todayTitle') && document.getElementById('todayTitle').textContent.trim(), null, { timeout: 20000 }); await sleep(600);
    await f.evaluate(() => { document.getElementById('sheet').classList.add('on'); }); await sleep(500);
    const m = await f.evaluate(() => {
      const vw = document.documentElement.clientWidth, over = [];
      for (const e of document.querySelectorAll('body *')) { if (!e.getClientRects().length || e.closest('.miles') || e.closest('.mv')) continue; const r = e.getBoundingClientRect(); if (r.right > vw + 1 && r.width > 0) over.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + [...e.classList].join('.')) + ':' + Math.round(r.right)); }
      const clipped = [...document.querySelectorAll('#srcSeg button,#themeSeg button,#sizeSeg button,#autoSeg button,.switch button')].filter(b => b.getClientRects().length && b.scrollWidth > b.clientWidth + 1).map(b => b.textContent.trim());
      return { ts: document.documentElement.dataset.textSize || '', sw: document.documentElement.scrollWidth, vw, over: over.slice(0, 12), overflowAnc: (() => { const m = document.querySelector('.mv.memd'); const out = []; let e = m; while (e && e !== document.body) { const c = getComputedStyle(e); if (c.overflowX !== 'visible' || c.contain !== 'none') out.push((e.id||e.className||e.tagName) + ':' + c.overflowX + '/' + c.contain); e = e.parentElement; } return out; })(), clipped };
    });
    console.log(TAG, w, size || 'm', JSON.stringify(m));
    await f.evaluate(() => { document.getElementById('sheet').classList.remove('on'); const e = [...document.querySelectorAll('.mv.memd')].find(x => x.getBoundingClientRect().right > innerWidth); (e || document.body).scrollIntoView({ block: 'center' }); }); await sleep(400); console.log(TAG, 'mv', JSON.stringify(await f.evaluate(() => { const e = [...document.querySelectorAll('.mv.memd')].find(x => x.getBoundingClientRect().right > innerWidth) || document.querySelector('.mv.memd'); const p = e.parentElement.getBoundingClientRect(); return { text: e.textContent.trim(), w: Math.round(e.getBoundingClientRect().width), right: Math.round(e.getBoundingClientRect().right), parentW: Math.round(p.width), parentCls: e.parentElement.className, mark: Math.round(e.querySelector('.mkm').getBoundingClientRect().width), pr: e.querySelector('.pr') && getComputedStyle(e.querySelector('.pr')).display, ws: getComputedStyle(e).whiteSpace }; })));
    await d.page.screenshot({ path: OUT + `f260set-${TAG}-${w}-${size || 'm'}.png`, scale: 'css' });
    await d.close();
  }
} finally { await L.close(); }
