// Phase 4 MOTION — press states on every kind of control, per area. Chromium: the :active state is forced through
// CDP (CSS.forcePseudoState), so nothing is clicked and no data is written. For each surface every visible, enabled
// control (button, [role=button], a[href], summary, label, select, input, .tile) is grouped by a signature
// (tag + first two classes); one representative per signature is forced :active for 450 ms and its computed transform
// scale, filter, background, opacity, box-shadow and colour are compared with the resting state. The transition that
// carries the change (duration + easing on transform / background) is recorded too.
//   node "audits/tools/phase4/MOTION/press.mjs" [surfaceFilter…]  → audits/evidence/p4/MOTION/press.json
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';

const EV = path.resolve('audits/evidence/p4/MOTION'); fs.mkdirSync(EV, { recursive: true });
const SURF = [
  ['shell-picker', 'ipad-portrait', null, '#home'],
  ['shell-home', 'ipad-portrait', 'eli', '#home'],
  ['shell-apps', 'ipad-portrait', 'eli', '#apps'],
  ['shell-me', 'ipad-portrait', 'eli', '#me'],
  ['shell-chat', 'ipad-portrait', 'eli', '#chat'],
  ['shell-home-kid', 'ipad-portrait', 'ezra', '#home'],
  ['f260', 'ipad-portrait', 'eli', 'apps/f260.html'],
  ['leftovers', 'ipad-portrait', 'eli', 'apps/leftovers.html'],
  ['prayer', 'ipad-portrait', 'eli', 'apps/prayer.html'],
  ['prayer-kid', 'ipad-portrait', 'kiara', 'apps/prayer.html'],
  ['tally', 'ipad-portrait', 'eli', 'apps/tally.html'],
  ['timer', 'ipad-portrait', 'eli', 'apps/timer.html'],
  ['dollywood', 'ipad-portrait', 'eli', 'apps/dollywood.html'],
  ['dollywood-live', 'ipad-portrait', 'eli', 'apps/dollywood-live.html'],
  ['kidverse-kid', 'ipad-portrait', 'ezra', 'apps/kidverse.html'],
  ['kidverse-adult', 'ipad-portrait', 'eli', 'apps/kidverse.html'],
  ['verses', 'ipad-portrait', 'eli', 'apps/verses.html'],
];
const want = process.argv.slice(2);
const out = {};
const L = await local({ variant: 'typical', engine: 'chromium' });
try {
  for (const [name, device, profile, where] of SURF) {
    if (want.length && !want.some(w => name.includes(w))) continue;
    const d = await L.device({ device, profile });
    if (where.startsWith('#')) await d.goto(where); else await d.page.goto(L.site + '/' + where, { waitUntil: 'load' });
    await d.page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 12000 }).catch(() => {});
    await sleep(2000);
    const reps = await d.page.evaluate(() => {
      const shown = el => { const r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4 || r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false; for (let e = el; e && e.nodeType === 1; e = e.parentElement) { const s = getComputedStyle(e); if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false; } return true; };
      const els = [...document.querySelectorAll('button, [role=button], a[href], summary, label, select, input:not([type=hidden]), .tile')].filter(e => !e.disabled && shown(e));
      const groups = new Map();
      for (const e of els) {
        const cl = [...e.classList].filter(c => !/^(on|active|sel|selected|done|is-|open)/.test(c)).slice(0, 2).join('.');
        const sig = e.tagName.toLowerCase() + (e.type && e.tagName === 'INPUT' ? `[${e.type}]` : '') + (cl ? '.' + cl : '') + (!cl && e.parentElement ? ` in ${e.parentElement.tagName.toLowerCase()}${e.parentElement.id ? '#' + e.parentElement.id : e.parentElement.classList[0] ? '.' + e.parentElement.classList[0] : ''}` : '');
        if (!groups.has(sig)) groups.set(sig, { sig, n: 0, el: e }); groups.get(sig).n++;
      }
      let k = 0; const list = [];
      for (const g of groups.values()) { if (k >= 45) break; g.el.setAttribute('data-mo-press', String(k)); list.push({ k, sig: g.sig, n: g.n, label: (g.el.getAttribute('aria-label') || g.el.textContent || g.el.value || '').replace(/\s+/g, ' ').trim().slice(0, 30) }); k++; }
      return { list, total: els.length };
    });
    const cdp = await d.ctx.newCDPSession(d.page);
    await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: 0 });
    const read = k => d.page.evaluate(k => {
      const e = document.querySelector(`[data-mo-press="${k}"]`); const c = getComputedStyle(e);
      const m = /matrix\(([^)]+)\)/.exec(c.transform); let sc = 1; if (m) { const [a, b] = m[1].split(',').map(Number); sc = Math.hypot(a, b); }
      if (c.scale && c.scale !== 'none') sc *= parseFloat(c.scale);
      const tr = c.transitionProperty.split(',').map(s => s.trim()), du = c.transitionDuration.split(','), ea = c.transitionTimingFunction.split(/,(?![^(]*\))/);
      const tfor = p => { const i = tr.findIndex(x => x === p || x === 'all'); return i < 0 ? null : `${Math.round(parseFloat(du[i % du.length]) * 1000)}ms ${ea[i % ea.length].trim()}`; };
      return { scale: +sc.toFixed(3), transform: c.transform, filter: c.filter, bg: c.backgroundColor + ' ' + c.backgroundImage.slice(0, 40), opacity: c.opacity, shadow: c.boxShadow.slice(0, 60), color: c.color, tTransform: tfor('transform'), tBg: tfor('background') || tfor('background-color') };
    }, k);
    const rows = [];
    for (const r of reps.list) {
      const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: `[data-mo-press="${r.k}"]` });
      if (!nodeId) continue;
      const before = await read(r.k);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: ['active'] });
      await sleep(450);
      const after = await read(r.k);
      await cdp.send('CSS.forcePseudoState', { nodeId, forcedPseudoClasses: [] });
      const change = [];
      if (after.scale !== before.scale) change.push('scale ' + after.scale); else if (after.transform !== before.transform) change.push('transform ' + after.transform);
      if (after.filter !== before.filter) change.push('filter ' + after.filter);
      if (after.bg !== before.bg) change.push('background');
      if (after.opacity !== before.opacity) change.push('opacity ' + after.opacity);
      if (after.shadow !== before.shadow) change.push('shadow');
      if (after.color !== before.color) change.push('color');
      rows.push({ sig: r.sig, n: r.n, label: r.label, change: change.length ? change : ['NONE'], tTransform: before.tTransform, tBg: before.tBg });
    }
    await cdp.detach();
    const withFb = rows.filter(r => r.change[0] !== 'NONE');
    out[name] = { controls: reps.total, signatures: rows.length, signaturesWithFeedback: withFb.length, controlsWithFeedback: withFb.reduce((s, r) => s + r.n, 0), controlsSampled: rows.reduce((s, r) => s + r.n, 0), scales: [...new Set(withFb.flatMap(r => r.change.filter(c => c.startsWith('scale')).map(c => +c.split(' ')[1])))].sort(), brightness: withFb.filter(r => r.change.some(c => /brightness/.test(c))).length, rows };
    console.log(`\n== ${name}: ${reps.total} controls, ${rows.length} signatures, ${withFb.length} with press feedback (${out[name].controlsWithFeedback}/${out[name].controlsSampled} controls); scales ${JSON.stringify(out[name].scales)}; brightness ${out[name].brightness}`);
    for (const r of rows) console.log(`  ${String(r.n).padStart(3)}× ${r.sig.slice(0, 44).padEnd(44)} ${r.label.padEnd(30)} → ${r.change.join(', ')}  [t ${r.tTransform || '-'} | bg ${r.tBg || '-'}]`);
    await d.close();
  }
} finally {
  const f = path.join(EV, want.length ? `press-${want.join('-')}.json` : 'press.json');
  fs.writeFileSync(f, JSON.stringify({ engine: 'chromium (CSS.forcePseudoState :active)', out }, null, 1));
  await L.close();
}
