// Phase 4 GLASS skeptic #1: does the .card.glass perf guard miss .card.glass-strong content cards, and is .glass-lite unused?
//   node audits/tools/phase4/GLASS/verify-guard-misses-glass-strong-1.mjs
// Local instance only (WebKit). Writes audits/evidence/p4/GLASS/verify-guard-misses-glass-strong-1.json
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p4/GLASS/verify-guard-misses-glass-strong-1.json');

const probe = (sels) => {
  const scrollerOf = el => { for (let p = el.parentElement; p; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight >= p.clientHeight) return (p.id ? '#' + p.id : p.tagName.toLowerCase()) + ` (overflowY ${cs.overflowY}, sh ${p.scrollHeight} ch ${p.clientHeight})`; } return 'document'; };
  const out = {};
  for (const s of sels) {
    const els = [...document.querySelectorAll(s)];
    out[s] = els.map(el => { const cs = getComputedStyle(el); const r = el.getBoundingClientRect(); return { cls: el.className && el.className.baseVal === undefined ? el.className : String(el.className.baseVal), hidden: el.hidden || cs.display === 'none', w: Math.round(r.width), h: Math.round(r.height), bf: cs.backdropFilter || cs.webkitBackdropFilter || 'none', wbf: cs.webkitBackdropFilter, g: cs.getPropertyValue('--g').trim(), scroller: scrollerOf(el) }; });
  }
  out.glassLiteInDom = document.querySelectorAll('.glass-lite').length;
  // control: synthetic elements in the same document
  const mk = cls => { const d = document.createElement('div'); d.className = cls; d.style.cssText = 'position:absolute;left:-9999px;width:10px;height:10px'; document.body.appendChild(d); const cs = getComputedStyle(d); const v = cs.backdropFilter || cs.webkitBackdropFilter; d.remove(); return v; };
  out.control = { 'card glass': mk('card glass'), 'card glass-strong': mk('card glass-strong'), 'glass-strong glass-lite': mk('glass-strong glass-lite'), 'card glass-strong glass-lite': mk('card glass-strong glass-lite') };
  return out;
};

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = { note: 'WebKit, local rig, variant typical. bf = computed backdrop-filter (or -webkit-). scroller = nearest overflow auto/scroll ancestor.', runs: {} };
try {
  for (const device of ['ipad-portrait', 'iphone-pwa']) {
    // 1) unpaired: pairing form
    let d = await L.device({ device, profile: 'unpaired' });
    await d.goto(''); await sleep(1500);
    res.runs[`${device}/unpaired`] = await d.page.evaluate(probe, ['#pairform', '#gate']);
    if (device === 'ipad-portrait') await d.shot(path.join(ROOT, 'audits/evidence/p4/GLASS/verify-guard-misses-glass-strong-1-pairform-ipad.png'));
    await d.close();
    // 2) signed out on a paired device: picker, then tap an adult -> PIN pad
    d = await L.device({ device, profile: null });
    await d.goto(''); await sleep(1500);
    const cards = await d.page.$$('.pcard');
    let tapped = null;
    for (const c of cards) { const id = await c.getAttribute('data-id'); if (id === 'eli') { await c.click(); tapped = id; break; } }
    await sleep(1200);
    res.runs[`${device}/pin`] = { tapped, ...(await d.page.evaluate(probe, ['.pin-wrap', '.pcard'])) };
    await d.close();
    // 3) apps as eli
    d = await L.device({ device, profile: 'eli' });
    for (const [app, sels] of [['verses', ['#trainer', '#done']], ['timer', ['#dial']], ['tally', ['.dial']]]) {
      const f = await d.openApp(app); await sleep(1500);
      res.runs[`${device}/${app}/eli`] = await f.evaluate(probe, sels);
    }
    await d.close();
    d = await L.device({ device, profile: 'ezra' });
    for (const [app, sels] of [['kidverse', ['.scene']], ['verses', ['#trainer', '#done']]]) {
      const f = await d.openApp(app); await sleep(1500);
      res.runs[`${device}/${app}/ezra`] = await f.evaluate(probe, sels);
    }
    await d.close();
  }
} catch (e) { res.error = String(e && e.stack || e); }
finally { await L.close(); }
fs.writeFileSync(OUT, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
