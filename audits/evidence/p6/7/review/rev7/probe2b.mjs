// reviewer-7 probe 2: the look — "I heard it"'s two pictures, XXL dark kid screens, the adult recorder card (Chromium), and spoken toasts
import { local, sleep } from 'file:///C:/Users/ex_bo/OneDrive/Claude%20Related/App%20Hub/audits/tools/lib/local.mjs';
const OUT = 'C:/Users/ex_bo/AppData/Local/Temp/claude/C--Users-ex-bo-OneDrive-Claude-Related-App-Hub/af3dfdac-12ca-439a-9836-6c1cb19fda21/scratchpad/rev7/shots2';
const pulled = async (f, ms = 15000) => { const u = Date.now() + ms; while (Date.now() < u) { if (await f.evaluate(() => !!(window.hub && hub.sync && hub.sync.lastPull && hub.isLoaded())).catch(() => false)) return true; await sleep(150); } return false; };
const L = await local({ variant: 'typical', clock: 'real', engine: 'chromium' });
try {
  // 1. the two pictures inside "I heard it" (kid) vs Done's star
  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false, mode: 'dark' });
  const f = await d.openApp('kidverse'); await pulled(f); await sleep(1500);
  const sizes = await f.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { w: Math.round(b.width), h: Math.round(b.height), x: Math.round(b.x), y: Math.round(b.y) }; };
    const ear = r('#story-heard .pic .sym.big'), star = r('#story-heard .pic .sym.star');
    const ov = ear && star ? Math.max(0, Math.min(ear.x + ear.w, star.x + star.w) - Math.max(ear.x, star.x)) * Math.max(0, Math.min(ear.y + ear.h, star.y + star.h) - Math.max(ear.y, star.y)) : null;
    return { ear, star, doneStar: r('#done .sym.star'), earCoveredPct: ear && ov != null ? Math.round(100 * ov / (ear.w * ear.h)) : null }; });
  console.log('heard-it pictures', JSON.stringify(sizes));
  const hb = await f.$('#story-heard'); await hb.scrollIntoViewIfNeeded(); await sleep(200);
  await hb.screenshot({ path: OUT + '/heard-it-kid-dark.png' });
  // 2. XXL dark, 390: the first screen and the story buttons
  await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl')); await f.evaluate(() => window.scrollTo(0, 0)); await sleep(400);
  await d.page.screenshot({ path: OUT + '/kid-xxl-dark-430-top.png' });
  await (await f.$('#story')).scrollIntoViewIfNeeded(); await sleep(300); await d.page.screenshot({ path: OUT + '/kid-xxl-dark-430-story.png' });
  const xxlLabels = await f.evaluate(() => [...document.querySelectorAll('#actions .btn span, #story-actions .btn span')].map(s => ({ t: s.textContent, lines: Math.round(s.getBoundingClientRect().height / parseFloat(getComputedStyle(s).lineHeight || 20)) })));
  console.log('xxl labels', JSON.stringify(xxlLabels));
  // 3. a spoken toast must not talk over a reading: speak the verse (stubbed engine), then a toast
  const sp = await f.evaluate(async () => {
    const said = []; let cur = null;
    speechSynthesis.speak = u => { said.push(u.text.slice(0, 40)); cur = u; }; speechSynthesis.cancel = () => { const u = cur; cur = null; if (u && u.onerror) u.onerror({}); };
    document.querySelector('#say').click(); await new Promise(r => setTimeout(r, 100));
    hub.toast('You already have today’s star — come back tomorrow!');
    await new Promise(r => setTimeout(r, 100));
    const during = said.length;
    if (cur && cur.onend) { const u = cur; cur = null; u.onend({}); }
    hub.toast('Second toast'); hub.toast('Third toast');
    return { said, spokenDuringReading: during };
  });
  console.log('speech', JSON.stringify(sp));
  await d.close();
  // 4. the adult's recorder card in Chromium (MediaRecorder exists): light + dark + XXL, 390
  for (const mode of ['light', 'dark']) {
    const a = await L.device({ device: 'iphone-pwa', profile: 'eli', fixedTime: false, mode });
    const g = await a.openApp('kidverse'); await pulled(g); await sleep(1500);
    if (mode === 'dark') await g.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
    const vp = await g.$('#voice-panel'); const vis = vp && await vp.evaluate(e => !e.hidden);
    console.log(mode, 'voice panel visible', vis, await g.evaluate(() => { const e = document.querySelector('#voice-panel'); return e ? e.textContent.replace(/\s+/g, ' ').trim().slice(0, 200) : null; }));
    if (vis) { await vp.scrollIntoViewIfNeeded(); await sleep(200); await vp.screenshot({ path: OUT + `/voice-panel-adult-${mode}${mode === 'dark' ? '-xxl' : ''}.png` }); }
    const order = await g.evaluate(() => [...document.querySelectorAll('.wrap > *')].filter(e => !e.hidden && getComputedStyle(e).display !== 'none').map(e => e.id || e.className).slice(0, 5));
    console.log(mode, 'order', JSON.stringify(order));
    await a.page.screenshot({ path: OUT + `/adult-${mode}-390-top.png` });
    await a.close();
  }
} finally { await L.close(); }
process.exit(0);
