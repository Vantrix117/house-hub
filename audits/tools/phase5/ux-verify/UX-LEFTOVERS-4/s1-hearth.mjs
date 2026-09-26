// s1 skeptic: UX-LEFTOVERS-4. Where the Hearth block sits against the fixed add bar (iPhone PWA, at rest and scrolled to
// the end), what the button shows and copies on a typical and an empty fridge, and whether anything in the worker or
// the chat tools can reach a calendar. Output: audits/evidence/p5/ux-verify/UX-LEFTOVERS-4/s1/
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-4/s1');
fs.mkdirSync(OUT, { recursive: true });
const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const v of ['typical', 'empty']) {
    await L.reset(v);
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
    const f = await d.openApp('leftovers');
    await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0, null, { timeout: 15000 });
    await sleep(800);
    const geo = () => f.evaluate(() => {
      const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: Math.round(b.height), w: Math.round(b.width) }; };
      const copy = document.getElementById('copy'), bar = document.getElementById('add'), p = document.querySelector('.hearth p');
      const c = r(copy), b = r(bar);
      return { vh: innerHeight, scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight, copy: c, para: r(p), bar: b,
        copyVisibleAboveBar: c.bottom <= b.top && c.top >= 0, copyDisabled: copy.disabled, label: copy.textContent.trim(),
        iconPath: copy.querySelector('svg path')?.getAttribute('d').slice(0, 30), cards: document.querySelectorAll('.item').length,
        paraText: p.textContent.replace(/\s+/g, ' ').trim(), elementsAfterHearthInWrap: document.querySelector('.hearth').nextElementSibling?.tagName || null };
    });
    const rest = await geo();
    await f.evaluate(() => scrollTo(0, document.documentElement.scrollHeight)); await sleep(400);
    const end = await geo();
    await f.evaluate(() => { window.__copied = null; navigator.clipboard.writeText = async t => { window.__copied = t; }; });
    await f.click('#copy'); await sleep(200);
    const copied = await f.evaluate(() => window.__copied);
    const labelAfter = await f.evaluate(() => document.getElementById('copy').textContent.trim());
    await d.page.screenshot({ path: path.join(OUT, `s1-${v}-iphone-end.png`), scale: 'css', animations: 'disabled' });
    out[v] = { rest, end, copied, labelAfter };
    console.log(v, JSON.stringify(out[v]));
    await d.close();
  }
  const src = fs.readdirSync('worker/src').filter(f => f.endsWith('.js')).map(f => fs.readFileSync('worker/src/' + f, 'utf8')).join('\n');
  out.worker = { hearth: (src.match(/hearth/gi) || []).length, calendar: (src.match(/calendar/gi) || []).length,
    chatTools: [...fs.readFileSync('worker/src/chat.js', 'utf8').matchAll(/\{ name: '([a-z_0-9]+)'/g)].map(m => m[1]) };
  console.log('worker', JSON.stringify(out.worker));
  fs.writeFileSync(path.join(OUT, 's1-hearth.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
