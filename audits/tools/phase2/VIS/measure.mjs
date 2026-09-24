// VIS measure: for each shell surface × device × light/dark, measure on the local rig (typical demo household, WebKit):
//   - type: computed font-size / weight / family / line-height / tracking of every visible text element
//   - rendered contrast: text colour (× ancestor opacity) against the pixels actually painted under its line boxes
//     (text hidden, screenshot at 1× CSS, sampled in the page); p10 = the worst 10 % of samples, med = median
//   - tap targets (< 44 px, or < the kid --tap of 64 px), nested radii (concentric corners), glass layers, clipped text
// Writes audits/evidence/p2/VIS/measure-<surface>-<device>-<mode>.json and prints a summary.
//   node "audits/tools/phase2/VIS/measure.mjs" [--surface home,apps] [--device ipad-portrait] [--mode light]
import { local } from '../../lib/local.mjs';
import { SURFACES, contrastSweep, install, save, shotCss, nearestDT } from './lib-vis.mjs';

const arg = (n, d) => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1].split(',') : d; };
const RUNS = [];
const S_ADULT = ['home', 'apps', 'chat', 'me', 'picker', 'pin', 'guestSheet', 'switchSheet', 'viewer'];
for (const mode of arg('mode', ['light', 'dark'])) {
  for (const device of arg('device', ['ipad-portrait', 'iphone-pwa'])) {
    for (const s of S_ADULT) RUNS.push({ surface: s, device, mode });
    RUNS.push({ surface: 'home', device, mode, profile: 'ezra', tag: 'kid-home' });
    RUNS.push({ surface: 'apps', device, mode, profile: 'ezra', tag: 'kid-apps' });
    RUNS.push({ surface: 'home', device, mode, profile: 'guest-grandmajo', tag: 'guest-home' });
  }
  RUNS.push({ surface: 'tv', device: 'tv', mode });
}
const only = arg('surface', null);
const runs = RUNS.filter(r => !only || only.includes(r.tag || r.surface));

const L = await local({ variant: arg('variant', ['typical'])[0] });
const summary = [];
try {
  console.log('sessions available:', Object.keys(L.S.sessions).join(', '));
  for (const r of runs) {
    const name = `${r.tag || r.surface}-${r.device}-${r.mode}`;
    let d;
    try {
      const got = await SURFACES[r.surface](L, { device: r.device, mode: r.mode, profile: r.profile, fixedTime: undefined });
      d = got.d;
      const page = d.page;
      await install(page);
      const shot = await shotCss(page, `m-${name}.png`);
      const { all, measured } = await contrastSweep(page, got.scroller);
      let meas = measured; if (got.only) meas = measured.filter(m => m.sel.includes(got.only.slice(1)));
      const kid = r.profile === 'ezra';
      const [targets, radii, glass, clipped, hscroll] = await page.evaluate(() => [__vis.targets(), __vis.radii(), __vis.glass(), __vis.clipped(),
        { doc: document.documentElement.scrollWidth - innerWidth, views: (() => { const v = document.querySelector('#views'); return v ? v.scrollWidth - v.clientWidth : 0; })() }]);
      const minTap = kid ? 64 : 44;
      const smallTargets = targets.filter(t => Math.min(t.w, t.h) < minTap && !t.disabled);
      const fails = meas.filter(m => m.p10 < (m.large ? 3 : 4.5));
      const sizes = {}; for (const t of all) { const k = `${t.fs}px/${t.fw}/${t.ff}`; (sizes[k] ||= { fs: t.fs, fw: t.fw, ff: t.ff, n: 0, ex: [] }).n++; if (sizes[k].ex.length < 3) sizes[k].ex.push(t.text.slice(0, 28)); }
      const rec = { run: r, shot, fontFamilies: [...new Set(all.map(t => t.ffull))], sizes: Object.values(sizes).sort((a, b) => b.fs - a.fs).map(s => ({ ...s, dt: nearestDT(s.fs)[0] })),
        minFont: Math.min(...all.map(t => t.fs)), measuredCount: meas.length, contrastFails: fails.map(({ id, rects, ffull, ...x }) => x),
        lowest: [...meas].sort((a, b) => a.p10 - b.p10).slice(0, 8).map(({ id, rects, ffull, ...x }) => x),
        smallTargets, radii: radii.filter(x => !x.ok), radiiOk: radii.filter(x => x.ok).length, glass, clipped, hscroll, logs: d.logs.filter(l => /error/i.test(l)).slice(0, 5) };
      const file = save(`measure-${name}.json`, rec);
      summary.push({ name, file, minFont: rec.minFont, contrastFails: fails.length, of: meas.length, glassFails: fails.filter(f => f.glass).length, smallTargets: smallTargets.length, radiiOff: rec.radii.length, glass: glass.length, clipped: clipped.length, hscroll });
      console.log(`\n== ${name}  (${file}; shot ${shot})`);
      console.log(`  fonts: ${rec.fontFamilies.map(f => f.split(',')[0]).join(' | ')}   min font ${rec.minFont}px   h-overflow doc ${hscroll.doc} views ${hscroll.views}`);
      console.log('  sizes: ' + rec.sizes.map(s => `${s.fs}/${s.fw}${s.ff.includes('serif') ? 'serif' : ''}×${s.n}`).join('  '));
      for (const f of fails) console.log(`  CONTRAST ${f.p10} (med ${f.med}) ${f.large ? 'large' : 'text'}${f.glass ? ' [glass]' : ''} "${f.text.slice(0, 40)}"  ${f.sel}  fg ${f.color} a ${f.alpha} bg ${f.bgAtP10}`);
      for (const t of smallTargets) console.log(`  TARGET ${t.w}×${t.h} "${t.label}"  ${t.sel}`);
      for (const x of rec.radii) console.log(`  RADIUS outer ${x.outer} R${x.R} inset ${x.inset} → inner ${x.inner} r${x.r} (concentric ${x.want})`);
      for (const g of glass) console.log(`  GLASS ${g.sel} ${g.w}×${g.h} pos ${g.position} backdrop ${g.backdrop || 'none'}`);
      for (const c of clipped) console.log(`  CLIPPED (${c.how}) "${c.text.slice(0, 50)}" ${c.sel} ${c.sw != null ? `${c.sw}/${c.cw} × ${c.sh}/${c.ch}` : `text right ${c.textRight} > box ${c.boxRight}`}`);
    } catch (e) { console.log(`\n== ${name} FAILED: ${e.message.split('\n')[0]}`); summary.push({ name, error: e.message.split('\n')[0] }); }
    finally { if (d) await d.close(); }
  }
  console.log('\nSUMMARY'); console.table(summary.map(({ file, hscroll, ...s }) => ({ ...s, hdoc: hscroll && hscroll.doc })));
  save(`measure-summary${only ? '-' + only.join('+') : ''}.json`, summary);
} finally { await L.close(); }
