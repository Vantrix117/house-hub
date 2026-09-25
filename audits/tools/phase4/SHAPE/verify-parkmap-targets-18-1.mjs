// Skeptic #1 for SHAPE "parkmap-targets-18": re-measure, from scratch, every visible interactive control in the park map's
// own document (apps/dollywood-live.html frame) as an adult (Eli) on a park day, in the states that expose the sheet panes,
// the meeting bar, a card, directions and the kids' height stepper. For an <input> inside a <label> it records BOTH the input
// box and the label box (the label is the real hit area). Also records whether (pointer: coarse) matches.
//   node audits/tools/phase4/SHAPE/verify-parkmap-targets-18-1.mjs -> audits/evidence/p4/SHAPE/verify-parkmap-targets-18-1.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/SHAPE');
const MEET_FIX = { x: 762, y: 842, acc: 6, hdg: null, t: DEMO - 120000, src: 'gps', sec: 'timber' };
const scan = () => {
  const vis = el => { const s = getComputedStyle(el); if (s.display === 'none' || s.visibility === 'hidden') return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.bottom > 0 && b.right > 0 && b.left < innerWidth && b.top < innerHeight; };
  const sel = el => {
    let s = el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
    if (!el.id && typeof el.className === 'string' && el.className.trim()) s += '.' + el.className.trim().split(/\s+/).slice(0, 2).join('.');
    const p = el.parentElement;
    if (!el.id && p) s = (p.id ? '#' + p.id : p.tagName.toLowerCase() + (typeof p.className === 'string' && p.className.trim() ? '.' + p.className.trim().split(/\s+/)[0] : '')) + ' > ' + s;
    return s;
  };
  const els = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, summary, [role=button]')].filter(vis);
  const list = els.map(el => {
    const b = el.getBoundingClientRect(); const lab = el.tagName === 'INPUT' ? el.closest('label') : null; const lb = lab && lab.getBoundingClientRect();
    const cs = getComputedStyle(el); const inline = el.tagName === 'A' && cs.display === 'inline';
    return { sel: sel(el), text: (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 30), w: +b.width.toFixed(1), h: +b.height.toFixed(1), minH: cs.minHeight, inline,
      label: lb ? { sel: sel(lab), w: +lb.width.toFixed(1), h: +lb.height.toFixed(1) } : null };
  });
  return { coarse: matchMedia('(pointer: coarse)').matches, list };
};
const out = { note: 'adult eli, variant park, webkit; w/h are CSS px of getBoundingClientRect; label = enclosing <label> box for inputs', runs: [] };
const L = await local({ variant: 'park', engine: 'webkit' });
const tap = async (f, s) => { await f.locator(s).first().click({ timeout: 4000 }); await sleep(450); };
try {
  for (const device of ['iphone-pwa', 'ipad-portrait', 'desktop']) {
    const d = await L.device({ device, mode: 'light', profile: 'eli', localStorage: { 'dollywood.live.last': JSON.stringify(MEET_FIX) } });
    const f = await d.openApp('dollywood-live');
    await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 }); await sleep(4000);
    const run = async (state, fn) => {
      try { if (fn) await fn(); const r = await f.evaluate(scan); out.runs.push({ device, state, coarse: r.coarse, list: r.list }); console.log(device, state, 'coarse', r.coarse, 'n', r.list.length); }
      catch (e) { out.runs.push({ device, state, error: e.message }); console.log('ERR', device, state, e.message.slice(0, 200)); }
    };
    await run('map');
    if (device === 'iphone-pwa') await d.page.screenshot({ path: path.join(EV, 'verify-parkmap-targets-18-1-map-iphone.png'), scale: 'css' });
    await run('near', async () => { await tap(f, '#loc-near'); await sleep(400); });
    await run('waits', async () => { await tap(f, '#near-mode-waits'); });
    await run('near-again', async () => { await tap(f, '#near-mode-near'); });
    await run('family', async () => { await tap(f, '#lv-family'); await sleep(400); });
    await run('family-scrolled', async () => { await f.evaluate(() => { const b = document.querySelector('#lv-sheet .lv-body'); if (b) b.scrollTop = b.scrollHeight; }); await sleep(300); });
    if (device === 'iphone-pwa') await d.page.screenshot({ path: path.join(EV, 'verify-parkmap-targets-18-1-family-iphone.png'), scale: 'css' });
    await run('layers', async () => { await tap(f, '#lv-layers-tab'); await sleep(400); });
    await run('layers-scrolled', async () => { await f.evaluate(() => { const b = document.querySelector('#lv-sheet .lv-body'); if (b) b.scrollTop = b.scrollHeight; }); await sleep(300); });
    await run('search', async () => { await tap(f, '#lv-search'); await sleep(400); });
    await run('card', async () => { await f.locator('#q').fill('Thunderhead'); await sleep(400); await tap(f, '#tab-list .oi[data-n="28"]'); await sleep(1200); });
    await run('route', async () => { await f.evaluate(() => { const x = document.querySelector('#pop-x'); if (x) x.click(); }); await sleep(400); await tap(f, '#meet-go'); await sleep(1200); });
    await d.close();
  }
} finally { await L.close(); }
// roll-up: per selector the min w/h seen, and the min effective (label if present) size
const agg = {};
for (const r of out.runs) for (const x of r.list || []) {
  const k = x.sel; const a = agg[k] ||= { sel: k, text: x.text, minW: 1e9, minH: 1e9, effMinW: 1e9, effMinH: 1e9, inline: x.inline, label: x.label && x.label.sel, devices: new Set(), states: new Set() };
  a.minW = Math.min(a.minW, x.w); a.minH = Math.min(a.minH, x.h);
  const e = x.label || x; a.effMinW = Math.min(a.effMinW, e.w); a.effMinH = Math.min(a.effMinH, e.h);
  if (Math.min(x.w, x.h) < 44) { a.devices.add(r.device); a.states.add(r.state); }
}
out.summary = Object.values(agg).map(a => ({ ...a, devices: [...a.devices], states: [...a.states], under44: Math.min(a.minW, a.minH) < 44, effUnder44: Math.min(a.effMinW, a.effMinH) < 44 })).filter(a => a.under44).sort((a, b) => a.sel.localeCompare(b.sel));
out.counts = {
  under44Selectors: out.summary.length, under44NonInline: out.summary.filter(a => !a.inline).length,
  effectiveUnder44NonInline: out.summary.filter(a => !a.inline && a.effUnder44).length,
  touchUnder44NonInline: out.summary.filter(a => !a.inline && a.devices.some(d => d !== 'desktop')).length,
};
fs.writeFileSync(path.join(EV, 'verify-parkmap-targets-18-1.json'), JSON.stringify(out, null, 1));
for (const a of out.summary) console.log((a.inline ? 'INL ' : '    ') + a.sel.padEnd(58), `${a.minW}x${a.minH}`, a.label ? `label ${a.effMinW}x${a.effMinH}` : '', a.devices.join(','), '|', a.states.join(','));
console.log(JSON.stringify(out.counts));
