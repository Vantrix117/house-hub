// Phase 4 GLASS skeptic #2 for "guard-misses-glass-strong": does the perf guard (apps/design.css:400, .ds .card.glass)
// miss .card.glass-strong content cards, and is the documented .glass-lite escape hatch unused?
// Independent of layers.mjs. WebKit (the target engine; computed style is reliable even though the rig paints no blur).
// Per device and surface it records: the element's computed backdrop-filter and rect, whether it matches the guard
// selector, whether its scroll container actually overflows (the guard's stated rationale is "blur in a scroller"),
// whether the fixed welcome art sits behind it (something for the blur to show), and every other live blur on screen.
// Control: a .card.glass on the Me tab must read backdrop-filter none (the guard works where it is used).
// Also a static count of .glass-lite in index.html and apps/*.html.
//   node audits/tools/phase4/GLASS/verify-guard-misses-glass-strong-2.mjs
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, ROOT } from '../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-guard-misses-glass-strong-2.json');
const DEVS = ['iphone-safari', 'iphone-pwa', 'ipad-portrait', 'desktop'];
const out = { method: 'see script header', static: {}, devices: {} };

// static: .glass-lite uses
const files = ['index.html', ...fs.readdirSync(path.join(ROOT, 'apps')).filter(f => f.endsWith('.html')).map(f => 'apps/' + f)];
for (const f of files) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  out.static[f] = { glassLite: (txt.match(/glass-lite/g) || []).length, cardGlassStrong: (txt.match(/card[^"'`]*glass-strong|glass-strong[^"'`]*card\b/g) || []).length };
}
const css = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8').split('\n');
out.static['apps/design.css'] = css.map((l, i) => [i + 1, l]).filter(([, l]) => /glass-lite|\.card\.glass/.test(l)).map(([n, l]) => n + ': ' + l.trim().slice(0, 200));

const probe = sel => {
  const bf = e => { const s = getComputedStyle(e); const v = s.backdropFilter && s.backdropFilter !== 'none' ? s.backdropFilter : (s.webkitBackdropFilter && s.webkitBackdropFilter !== 'none' ? s.webkitBackdropFilter : 'none'); return v; };
  const el = document.querySelector(sel);
  if (!el) return { sel, found: false };
  const r = el.getBoundingClientRect();
  let sc = el.parentElement; while (sc && sc !== document.documentElement) { const o = getComputedStyle(sc).overflowY; if ((o === 'auto' || o === 'scroll') && sc.scrollHeight > sc.clientHeight + 1) break; sc = sc.parentElement; }
  const docScroll = document.scrollingElement.scrollHeight > innerHeight + 1;
  const art = document.querySelector('.welcome-art');
  let artBehind = null;
  if (art && getComputedStyle(art).display !== 'none' && !art.closest('[hidden]')) { const a = art.getBoundingClientRect(); artBehind = !(a.right < r.left || r.right < a.left || a.bottom < r.top || r.bottom < a.top); }
  const live = [...document.querySelectorAll('*')].filter(e => bf(e) !== 'none' && e.getBoundingClientRect().width > 1 && !e.closest('[hidden]') && getComputedStyle(e).display !== 'none')
    .map(e => { const q = e.getBoundingClientRect(); return (e.id ? '#' + e.id : e.tagName.toLowerCase()) + '.' + [...e.classList].join('.') + ' ' + Math.round(q.width) + 'x' + Math.round(q.height); });
  return { sel, found: true, cls: el.className, bf: bf(el), rect: [r.x, r.y, r.width, r.height].map(Math.round), matchesGuard: el.matches('.ds .card.glass'), matchesLite: el.matches('.ds .glass-lite'),
    overflowingScroller: sc && sc !== document.documentElement ? { el: (sc.id ? '#' + sc.id : sc.tagName.toLowerCase()), scrollH: sc.scrollHeight, clientH: sc.clientHeight } : null, docScrolls: docScroll, viewport: [innerWidth, innerHeight], welcomeArtBehind: artBehind, liveBlurs: live };
};

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  for (const dev of DEVS) {
    const res = {};
    // 1. pairing form (unpaired device)
    let d = await L.device({ device: dev, mode: 'light', profile: 'unpaired' });
    await d.goto(''); await d.page.waitForSelector('#pairform', { timeout: 8000 }); await sleep(700);
    res.pairform = await d.page.evaluate(probe, '#pairform');
    await d.close();
    // 2. PIN pad (paired, signed out → tap Eli)
    d = await L.device({ device: dev, mode: 'light', profile: null });
    await d.goto(''); await d.page.waitForSelector('#profiles .pcard:not(.skeleton)', { timeout: 8000 });
    await d.page.click('#profiles .pcard[data-id="eli"]'); await d.page.waitForSelector('.pin-wrap', { timeout: 8000 }); await sleep(700);
    res.pinWrap = await d.page.evaluate(probe, '.pin-wrap');
    await d.close();
    // 3. Verses trainer + control .card.glass on Me
    d = await L.device({ device: dev, mode: 'light', profile: 'eli' });
    await d.goto('#me'); await sleep(1500);
    res.controlMeCardGlass = await d.page.evaluate(probe, '.card.glass');
    await d.goto('#home'); await sleep(800);
    const f = await d.openApp('verses');
    await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 10000 }).catch(() => {}); await sleep(700);
    res.versesTrainer = await f.evaluate(probe, '#trainer');
    res.versesTrainerHidden = await f.evaluate(() => document.getElementById('trainer').hidden);
    await d.close();
    out.devices[dev] = res;
    console.log(dev, JSON.stringify({ pair: [res.pairform.bf, res.pairform.rect, res.pairform.matchesGuard, res.pairform.overflowingScroller, res.pairform.welcomeArtBehind], pin: [res.pinWrap.bf, res.pinWrap.rect, res.pinWrap.overflowingScroller, res.pinWrap.welcomeArtBehind], ctrl: [res.controlMeCardGlass.bf], verses: [res.versesTrainer.bf, res.versesTrainer.rect, res.versesTrainer.docScrolls, res.versesTrainer.liveBlurs.length] }));
  }
} finally {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  await L.close();
}
console.log('wrote', OUT);
