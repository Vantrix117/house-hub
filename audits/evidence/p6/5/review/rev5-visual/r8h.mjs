// round 6: Home cards — button wraps, truncated names, spot size, card heights, per variant/width/text size
import path from 'node:path';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
const REPO = process.env.REPO || 'C:/Users/ex_bo/OneDrive/Claude Related/App Hub';
const TAG = process.env.TAG || 'now';
const { local, sleep, DEMO } = await import(pathToFileURL(REPO + '/audits/tools/lib/local.mjs').href);
const OUT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const SHOTS = path.join(OUT, 'shots8h'); fs.mkdirSync(SHOTS, { recursive: true });
const res = {}; const log = (k, v) => { res[k] = v; console.log(k, JSON.stringify(v)); };
try {
  for (const variant of ['typical', 'park']) {
    const L = await local({ variant, clock: 'demo', engine: 'webkit' });
    for (const [device, w, h] of [['iphone-pwa', 390, 844], ['ipad-portrait'], ['ipad-landscape'], ['desktop']]) for (const ts of [null, 'xxl']) {
      const d = await L.device({ device, profile: 'eli', installClock: DEMO });
      if (w) await d.page.setViewportSize({ width: w, height: h });
      await d.goto('#home'); await sleep(2500);
      if (ts) { await d.page.evaluate(t => document.documentElement.setAttribute('data-text-size', t), ts); await sleep(500); }
      const m = await d.page.evaluate(() => [...document.querySelectorAll('#view-home .gcard')].map(c => {
        const r = c.getBoundingClientRect(), b = c.querySelector(':scope > .btn, :scope > .gfoot > .btn, :scope > .gfoot .btn'), s = c.querySelector('.spot');
        const lh = b ? (parseFloat(getComputedStyle(b).lineHeight) || 18) : 18;
        const trunc = [...c.querySelectorAll('*')].filter(e => e.children.length === 0 && e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis').map(e => e.textContent.trim().slice(0, 20));
        return { card: (c.querySelector('h2')?.textContent || '').trim().slice(0, 18), w: Math.round(r.width), h: Math.round(r.height), btn: b ? { text: b.textContent.trim(), h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) } : null, spot: s ? [Math.round(s.getBoundingClientRect().width), Math.round(s.getBoundingClientRect().height)] : null, trunc };
      }));
      log(`${TAG}-${variant}-${device}-${ts || 'm'}`, m);
      await d.page.screenshot({ path: path.join(SHOTS, `${TAG}-${variant}-${device}-${ts || 'm'}.png`), fullPage: false });
      await d.close();
    }
    await L.close();
  }
} catch (e) { console.error('ERR', e); }
finally { fs.writeFileSync(path.join(OUT, `r6-${TAG}.json`), JSON.stringify(res, null, 1)); }
