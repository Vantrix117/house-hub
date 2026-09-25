// Phase 4 TOK: a component that re-points --accent does not re-point the tokens derived from it.
// design.css computes --accent-soft/-tint/-deep/-glow, --glow-accent and --focus on :root (apps/design.css:86-102), so a
// descendant that sets --accent inherits the ROOT's already-computed derived values. Two apps rely on the opposite:
//   Kid Verse  .ds .btn.done / .btn.story-heard { --accent: var(--gold) }   (apps/kidverse.html:55, 137) on .btn-primary,
//              whose fill is var(--accent-deep) (apps/design.css:361) → intended gold, renders the kid's own colour.
//   Prayer     body.shared { --accent: var(--teal); --accent-soft: var(--teal-soft) }  (apps/prayer.html:39) → soft fills turn
//              teal on the Family list, but every --accent-deep surface (current nav item text, pressed chips, the Pray
//              buttons, .fab) keeps the signed-in person's colour.
// Verses restates all three (apps/verses.html:56-58) and is the control: its buttons follow.
//   node audits/tools/phase4/TOK/verify-accent-repoint.mjs  → audits/evidence/p4/TOK/accent-repoint.json (+ 1x PNGs)
import fs from 'node:fs';
import path from 'node:path';
import { local } from '../../lib/local.mjs';
import { OUT } from './lib-tok.mjs';

const read = (f, sels) => f.evaluate(sels => {
  const root = getComputedStyle(document.documentElement);
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const rgb = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
  const out = { rootAccent: root.getPropertyValue('--accent').trim(), rootAccentDeep: rgb(root.getPropertyValue('--accent-deep').trim()), gold: rgb('var(--gold)'), teal: rgb('var(--teal)'), tealSoft: rgb('var(--teal-soft)'), bodyShared: document.body.classList.contains('shared') };
  out.els = sels.map(s => { const el = document.querySelector(s); if (!el) return { sel: s, missing: true }; const cs = getComputedStyle(el);
    return { sel: s, hidden: el.hidden || cs.display === 'none', localAccent: rgb(cs.getPropertyValue('--accent').trim()), localAccentSoft: rgb(cs.getPropertyValue('--accent-soft').trim()), localAccentDeep: rgb(cs.getPropertyValue('--accent-deep').trim()), color: cs.color, backgroundColor: cs.backgroundColor, backgroundImage: cs.backgroundImage.slice(0, 160) }; });
  probe.remove(); return out;
}, sels);
const shot1x = async (d, file, clip) => { await d.page.screenshot({ path: file, scale: 'css', animations: 'disabled', caret: 'hide', ...(clip ? { clip } : {}) }); return path.relative(process.cwd(), file).replace(/\\/g, '/'); };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  // Kid Verse as Ezra (#137F77) and as Kiara (#B4861B, whose colour is close to gold)
  for (const kid of ['ezra']) {
    const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: kid });
    const f = await d.openApp('kidverse', { wait: '#done' });
    await f.waitForTimeout(800);
    res['kidverse-' + kid] = await read(f, ['#done', '#story-heard']);
    res['kidverse-' + kid].png = await shot1x(d, path.join(OUT, `accent-repoint-kidverse-${kid}.png`));
    await d.ctx.close();
  }
  // Prayer as Eli (#4F5D8C): Mine, then the Family list
  const d = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
  const f = await d.openApp('prayer');
  await f.waitForTimeout(800);
  const sels = ['nav button[aria-current="true"]', '[data-list="shared"]', '[data-list="personal"]', '.prompt', '.fab'];
  res['prayer-eli-mine'] = await read(f, sels);
  await f.click('[data-list="shared"]'); await f.waitForTimeout(600);
  res['prayer-eli-family'] = await read(f, sels);
  res['prayer-eli-family'].png = await shot1x(d, path.join(OUT, 'accent-repoint-prayer-eli-family.png'));
  await d.ctx.close();
  // Verses (control): its rating buttons restate --accent, --accent-soft and --accent-deep
  const v = await L.device({ device: 'ipad-portrait', mode: 'light', profile: 'eli' });
  const fv = await v.openApp('verses'); await fv.waitForTimeout(800);
  res['verses-eli'] = await read(fv, ['.ds .btn.not', '.ds .btn.almost', '.ds .btn.got']);
  await v.ctx.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'accent-repoint.json'), JSON.stringify(res, null, 1));
const k = res['kidverse-ezra'];
console.log('kidverse ezra: root --accent', k.rootAccent, 'root deep', k.rootAccentDeep, 'gold', k.gold);
for (const e of k.els) console.log('  ', e.sel, 'local --accent', e.localAccent, 'local --accent-deep', e.localAccentDeep, 'bg', e.backgroundImage.slice(0, 110), 'color', e.color, e.hidden ? '(hidden)' : '');
for (const key of ['prayer-eli-mine', 'prayer-eli-family']) { const p = res[key]; console.log(key, 'body.shared', p.bodyShared, 'teal', p.teal, 'tealSoft', p.tealSoft, 'rootDeep', p.rootAccentDeep); for (const e of p.els) console.log('  ', e.sel, e.missing ? 'missing' : `local accent ${e.localAccent} soft ${e.localAccentSoft} deep ${e.localAccentDeep} | color ${e.color} bg ${e.backgroundColor}`); }
for (const e of res['verses-eli'].els) console.log('verses', e.sel, e.missing ? 'missing' : `accent ${e.localAccent} deep ${e.localAccentDeep} bg ${e.backgroundColor} ${e.backgroundImage.slice(0, 80)}`);
