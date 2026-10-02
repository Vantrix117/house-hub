// rev5-visual probe 4: heading wrap, practice modes at 375 XXL, histogram per palette, guest, editor dark, kid fold shot
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots'); fs.mkdirSync(SHOTS, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const PH = 'Alpha bravo charlie, delta echo foxtrot golf; hotel india juliet kilo lima mike november oscar papa quebec romeo sierra tango.';
const res = {};
const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d, id = 'verses') { const f = await d.openApp(id); await sleep(2000); return f; }
const lum = rgb => { const m = String(rgb).match(/[\d.]+/g); const [r, g, b] = m.slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return +(((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2)); };
try {
  // stats heading at 390/430 for each adult
  for (const who of ['mom', 'eli', 'dad', 'christian', 'niece']) for (const w of [375, 430]) {
    const d = await L.device({ device: 'iphone-pwa', profile: who, installClock: DEMO });
    await d.page.setViewportSize({ width: w, height: 844 });
    const f = await open(d);
    const m = await f.evaluate(() => { const h = document.querySelector('#stats h2'); if (!h || document.getElementById('stats').hidden) return null; const lh = parseFloat(getComputedStyle(h).lineHeight) || 24; const t = h.firstChild && [...h.childNodes].find(n => n.nodeType === 3); const rg = document.createRange(); rg.selectNodeContents(t); const lines = new Set([...rg.getClientRects()].map(r => Math.round(r.top))).size; return { title: t.textContent, titleLines: lines, sub: document.getElementById('stats-sub').textContent }; });
    log(`statsH2-${who}-${w}`, m);
    if (m && m.titleLines > 1) await d.page.screenshot({ path: path.join(SHOTS, `statsh2-${who}-${w}.png`) });
    await d.close();
  }
  // practice modes at 375 XXL
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.page.setViewportSize({ width: 375, height: 667 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    await f.evaluate(() => document.documentElement.setAttribute('data-text-size', 'xxl'));
    if (await f.evaluate(() => !verses.textOf(verses.currentId()))) { await f.click('#addtext'); await f.fill('#text-input', PH); await f.click('#text-save'); await sleep(600); }
    for (const mode of ['recall', 'letters', 'gaps', 'order']) {
      await f.evaluate(m => versesB.setMode(m), mode); await sleep(300);
      const m = await f.evaluate(() => { const segs = [...document.querySelectorAll('#pm-modes button')].map(b => { const r = b.getBoundingClientRect(); return [b.textContent, Math.round(r.width), Math.round(r.height)]; }); const small = [...document.querySelectorAll('#pm-area button')].filter(b => { const r = b.getBoundingClientRect(); return r.height < 44 || r.width < 44; }).length; return { hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, segs, small, over: [...document.querySelectorAll('#trainer *')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).map(e => e.className || e.tagName).slice(0, 5) }; });
      log(`xxl375-${mode}`, m);
      await f.evaluate(() => document.getElementById('trainer').scrollIntoView()); await sleep(200);
      await d.page.screenshot({ path: path.join(SHOTS, `xxl375-${mode}.png`) });
    }
    // gaps: a tapped blank, does the card move?
    await f.evaluate(() => versesB.setMode('gaps')); await sleep(300);
    const h0 = await f.evaluate(() => document.getElementById('trainer').getBoundingClientRect().height);
    await f.click('#pm-area .pm-w.gap'); await sleep(200);
    const h1 = await f.evaluate(() => document.getElementById('trainer').getBoundingClientRect().height);
    log('gapsTapMove', { h0, h1 });
    await f.evaluate(() => versesB.setMode('recall'));
    await d.close();
  }
  // histogram per palette (independent): fills order, edge vs card, number/label contrast
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO, localStorage: { 'hub.theme': JSON.stringify(theme) } });
    const f = await open(d);
    await f.evaluate(t => { document.documentElement.setAttribute('data-theme', t); document.documentElement.setAttribute('data-scheme', ['midnight', 'forest', 'graphite'].includes(t) ? 'dark' : 'light'); }, theme); await sleep(300);
    const m = await f.evaluate(() => { const card = getComputedStyle(document.getElementById('stats')).backgroundColor; return { card, bars: [...document.querySelectorAll('#boxes .bx')].map(b => { const i = b.querySelector('.col i'), cs = getComputedStyle(i); return { bg: cs.backgroundColor, edge: cs.borderTopColor, zero: b.classList.contains('zero'), lbl: getComputedStyle(b.querySelector('.lbl')).color }; }) }; });
    const out = { card: m.card, fillVsCard: m.bars.map(b => ratio(b.bg, m.card)), edgeVsCard: m.bars.map(b => ratio(b.edge, m.card)), lblVsCard: ratio(m.bars[0].lbl, m.card), fillLum: m.bars.map(b => +lum(b.bg).toFixed(3)) };
    log(`hist-${theme}`, out);
    await d.close();
  }
  // guest: a guest with nothing memorised and a guest view of the card
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    await d.page.setViewportSize({ width: 390, height: 844 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    await f.evaluate(() => document.documentElement.setAttribute('data-scheme', 'dark'));
    await f.evaluate(() => { document.documentElement.setAttribute('data-theme', 'midnight'); });
    await f.click('#addtext'); await sleep(300);
    await d.page.screenshot({ path: path.join(SHOTS, 'editor-midnight-390.png') });
    await d.close();
  }
  {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', installClock: DEMO });
    await d.page.setViewportSize({ width: 390, height: 844 });
    await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
    const f = await open(d);
    await d.page.screenshot({ path: path.join(SHOTS, 'kid-before-390x844.png') });
    await f.evaluate(() => document.getElementById('show').click()); await sleep(500);
    await d.page.screenshot({ path: path.join(SHOTS, 'kid-after-390x844.png') });
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, 'probe4.json'), JSON.stringify(res, null, 1)); await L.close(); }
