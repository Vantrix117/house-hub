// Phase 4 GLASS skeptic #3 (tie-break) for "guard-misses-glass-strong".
// Independent re-measure on WebKit (local instance only):
//  A. Control matrix: inject .card.glass / .card.glass-strong / .card.glass-strong.glass-lite / .glass-strong.glass-lite
//     into the shell's .ds body and read computed backdrop-filter (is the guard keyed to one class pair?).
//  B. Real surfaces: #pairform (unpaired), .pin-wrap (tap Eli), Verses #trainer (eli + ezra) — computed filter, rect,
//     and whether anything that contains them can actually scroll (the guard's stated rationale, design.css:399):
//     for every overflow:auto|scroll ancestor and the document, scrollHeight vs clientHeight, and a real scroll attempt.
//  C. Static .glass-lite count across index.html and apps/*.html.
//   node audits/tools/phase4/GLASS/verify-guard-misses-glass-strong-3.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-guard-misses-glass-strong-3.json');
const DEVS = ['iphone-safari', 'ipad-landscape'];
const out = { static: {}, controls: {}, devices: {} };

for (const f of ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f)])
  out.static[f] = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(/glass-lite/g) || []).length;

const bfOf = e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : ((s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') ? s.webkitBackdropFilter : 'none'); };
const controls = () => {
  const bf = e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : ((s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') ? s.webkitBackdropFilter : 'none'); };
  const host = document.createElement('div'); host.className = 'ds'; document.body.appendChild(host);
  const r = {};
  for (const c of ['card glass', 'card glass-strong', 'card glass-strong glass-lite', 'glass-strong glass-lite', 'glass', 'glass-strong']) {
    const e = document.createElement('div'); e.className = c; host.appendChild(e); r[c] = bf(e);
  }
  host.remove(); return { bodyHasDs: document.body.classList.contains('ds'), r };
};
const probe = sel => {
  const bf = e => { const s = getComputedStyle(e); return (s.backdropFilter && s.backdropFilter !== 'none') ? s.backdropFilter : ((s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none') ? s.webkitBackdropFilter : 'none'); };
  const el = document.querySelector(sel); if (!el) return { sel, found: false };
  const q = el.getBoundingClientRect();
  const scrollers = [];
  for (let a = el.parentElement; a; a = a.parentElement) {
    const o = getComputedStyle(a).overflowY;
    if (o === 'auto' || o === 'scroll' || a === document.scrollingElement) {
      const before = a.scrollTop; a.scrollTop = before + 200; const moved = a.scrollTop - before; a.scrollTop = before;
      scrollers.push({ el: a.id ? '#' + a.id : a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ').join('.') : ''), overflowY: o, scrollH: a.scrollHeight, clientH: a.clientHeight, scrollMoved: moved });
    }
  }
  const live = [...document.querySelectorAll('*')].filter(e => bf(e) !== 'none' && !e.closest('[hidden]') && e.getBoundingClientRect().width > 1).length;
  return { sel, cls: el.className, hidden: el.hidden || !!el.closest('[hidden]'), bf: bf(el), rect: [q.width, q.height].map(Math.round), matchesGuard: el.matches('.ds .card.glass'), scrollers, liveBlursInDoc: live, glassLiteInDom: document.querySelectorAll('.glass-lite').length, viewport: [innerWidth, innerHeight] };
};

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of DEVS) {
    const res = {};
    let d = await L.device({ device: dev, mode: 'light', profile: 'unpaired' });
    await d.goto(''); await d.page.waitForSelector('#pairform', { timeout: 10000 }); await sleep(800);
    res.pairform = await d.page.evaluate(probe, '#pairform');
    if (!out.controls.shell) out.controls.shell = await d.page.evaluate(controls);
    await d.close();

    d = await L.device({ device: dev, mode: 'light', profile: null });
    await d.goto(''); await d.page.waitForSelector('#profiles .pcard:not(.skeleton)', { timeout: 10000 });
    await d.page.click('#profiles .pcard[data-id="eli"]'); await d.page.waitForSelector('.pin-wrap', { timeout: 10000 }); await sleep(800);
    res.pinWrap = await d.page.evaluate(probe, '.pin-wrap');
    await d.close();

    for (const who of ['eli', 'ezra']) {
      d = await L.device({ device: dev, mode: 'light', profile: who });
      await d.goto('#home'); await sleep(1000);
      const f = await d.openApp('verses');
      await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden])', { timeout: 10000 }).catch(() => {}); await sleep(800);
      res['verses-' + who] = { trainer: await f.evaluate(probe, '#trainer'), done: await f.evaluate(probe, '#done') };
      if (!out.controls.verses) out.controls.verses = await f.evaluate(controls);
      await d.close();
    }
    out.devices[dev] = res;
    const s = x => [x.bf, x.rect.join('x'), 'guard=' + x.matchesGuard, 'scroll=' + x.scrollers.map(y => y.el + ':' + y.scrollH + '/' + y.clientH + ' moved ' + y.scrollMoved).join(',')].join(' | ');
    console.log(dev, '\n pair ', s(res.pairform), '\n pin  ', s(res.pinWrap), '\n v-eli', s(res['verses-eli'].trainer), res['verses-eli'].trainer.hidden, '\n v-ezr', s(res['verses-ezra'].trainer), res['verses-ezra'].trainer.hidden, '\n glass-lite in DOM', res.pairform.glassLiteInDom, res.pinWrap.glassLiteInDom, res['verses-eli'].trainer.glassLiteInDom);
  }
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await L.close();
}
console.log(JSON.stringify(out.controls), JSON.stringify(out.static));
console.log('wrote', OUT);
