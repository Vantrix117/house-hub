// round 5: queue rows (grid + .qbody + .cv), the button's a11y, the long-name pill
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots5'); fs.mkdirSync(SHOTS, { recursive: true });
const variant = process.env.VARIANT || 'typical';
const L = await local({ variant, clock: 'demo', engine: 'webkit' });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
async function open(d) { const f = await d.openApp('verses'); await f.waitForFunction(() => document.getElementById('trainer').getAttribute('aria-busy') === 'false', null, { timeout: 15000 }).catch(() => {}); await sleep(700); return f; }
try {
  for (const [who, w, ts] of variant === 'typical' ? [['eli', 375], ['eli', 390], ['eli', 430], ['eli', 375, 'xxl'], ['eli', 390, 'xxl'], ['eli', 430, 'xxl'], ['eli', 375, 'xl']] : [['eli', 375], ['eli', 375, 'xxl'], ['ezra', 375], ['ezra', 375, 'xxl']]) {
    const d = await L.device({ device: 'iphone-pwa', profile: who, installClock: DEMO }); await d.page.setViewportSize({ width: w, height: 844 });
    const f = await open(d);
    if (ts) { await f.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(300); }
    const m = await f.evaluate(() => {
      const multi = el => { const rg = document.createRange(); rg.selectNodeContents(el); return new Set([...rg.getClientRects()].filter(r => r.width > 0).map(r => Math.round(r.top))).size > 1; };
      const rows = [...document.querySelectorAll('.queue .qrow')];
      const bad = [];
      let minH = 1e9;
      for (const q of rows) {
        const r = q.getBoundingClientRect(); minH = Math.min(minH, r.height);
        const body = q.querySelector('.qbody'), chev = q.querySelector(':scope > .sym');
        const b = body.getBoundingClientRect(), c = chev.getBoundingClientRect();
        const cvBroken = [...q.querySelectorAll('.cv')].filter(multi).map(e => e.textContent);
        const overlap = b.right > c.left + 0.5;
        const chevOut = c.right > r.right + 0.5;
        const kidsOut = [...body.querySelectorAll('*')].filter(e => e.getBoundingClientRect().right > b.right + 1).length;
        if (cvBroken.length || overlap || chevOut || kidsOut) bad.push({ ref: q.getAttribute('aria-label'), cvBroken, overlap, chevOut, kidsOut });
      }
      const p = document.querySelector('#who'); const pb = p.querySelector('b');
      return { rows: rows.length, bad, minH: Math.round(minH), names: rows.slice(0, 3).map(q => q.getAttribute('aria-label')), qbodyTag: rows[0] && rows[0].querySelector('.qbody').tagName, divInButton: rows.some(q => q.querySelector('div, p, ul, li, h1, h2, h3')), hscroll: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, pill: pb ? { text: pb.textContent, broken: multi(pb), pillH: Math.round(p.getBoundingClientRect().height), pillW: Math.round(p.getBoundingClientRect().width), overflow: p.scrollWidth > p.clientWidth + 1 } : null };
    });
    log(`${variant}-${who}-${w}-${ts || 'm'}`, m);
    await f.evaluate(() => { const q = document.querySelector('#later-list'); q && q.scrollIntoView(); }); await sleep(200);
    await d.page.screenshot({ path: path.join(SHOTS, `${variant}-${who}-${w}-${ts || 'm'}.png`) });
    if (variant === 'typical' && w === 390 && !ts) {
      // keyboard: focus a row with Tab, ring painted, Enter practises; press rule
      await f.focus('#later-list .qrow'); await f.evaluate(() => document.activeElement.blur());
      await f.evaluate(() => { const qs = [...document.querySelectorAll('.qrow')]; qs[qs.length - 2].previousElementSibling; });
      // tab from the row before
      const qs = await f.$$('.qrow'); await qs[qs.length - 3].focus(); await d.page.keyboard.press('Tab'); await sleep(150);
      const k = await f.evaluate(() => { const a = document.activeElement, cs = getComputedStyle(a); return { cls: a.className, label: a.getAttribute('aria-label'), fv: a.matches(':focus-visible'), outline: cs.outlineStyle + ' ' + cs.outlineWidth + ' ' + cs.outlineColor, shadow: cs.boxShadow.slice(0, 90) }; });
      await d.page.screenshot({ path: path.join(SHOTS, 'qrow-focus-390.png') });
      await d.page.keyboard.press('Enter'); await sleep(800);
      k.afterEnter = await f.evaluate(() => ({ picked: verses.pickedId(), cur: verses.currentId(), focus: document.activeElement.id }));
      k.pressRule = await f.evaluate(() => { for (const s of document.styleSheets) for (const r of s.cssRules) if (r.selectorText && r.selectorText.includes('.qrow:active')) return r.style.transform + ' ' + r.style.filter; });
      log('keyboard', k);
    }
    await d.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `r5-${variant}.json`), JSON.stringify(res, null, 1)); await L.close(); }
