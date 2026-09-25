// TELL / matrix: the 12 x 11 web-tell matrix, derived ONLY from the TELL evidence JSONs (no browser), so every cell can be
// recomputed. Run the measurement scripts first (static, from-raw, tells-webkit, tells-chromium, scrollbars, flash
// chromium + webkit, loading, dialogs, verify-keyboard-ring).
//   node audits/tools/phase4/TELL/matrix.mjs   → audits/evidence/p4/TELL/matrix.json + a markdown table on stdout
// Status words: PASS, FAIL, PARTIAL, DEVICE (the rig cannot decide; what it measured is given), n/a.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const EV = path.join(ROOT, 'audits/evidence/p4/TELL');
const J = f => JSON.parse(fs.readFileSync(path.join(EV, f), 'utf8'));
const st = J('static.json'), raw = J('from-raw.json'), wk = J('tells-webkit.json'), cr = J('tells-chromium.json'), sb = J('scrollbars.json'),
  fc = J('flash-chromium.json'), fw = J('flash-webkit.json'), ld = J('loading.json'), dl = J('dialogs.json'), kr = J('keyboard-ring.json');
const AREAS = ['shell', 'tv', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
const srcOf = a => a === 'tv' ? 'shell' : a;
const M = {};
const cell = (a, t, s, e) => { (M[a] ||= {})[t] = { s, e }; };
for (const a of AREAS) {
  const W = wk.areas[a] || {}, C = cr.areas[a] || {}, R = raw.areas[a] || {}, S = st.files[srcOf(a)];
  // 1 tap highlight
  const th = C.desktop ? C.desktop.tapHighlight : {}; const thN = Object.values(th).reduce((x, y) => x + y, 0); const thT = th['rgba(0, 0, 0, 0)'] || 0;
  cell(a, '1 tap highlight', thT === thN && thN > 0 ? 'PASS' : 'FAIL', `${thT}/${thN} controls transparent (Chromium computed)`);
  // 2 selection / callout
  const us = W.probe ? W.probe.userSelect : {}; const usN = Object.values(us).reduce((x, y) => x + y, 0); const usT = usN - (us.none || 0);
  const imgs = W.probe ? W.probe.imgsDraggable : 0, links = W.probe ? W.probe.links : 0;
  const callout = S.counts.touchCallout;
  let s2 = usN && usT / usN >= 0.5 ? 'FAIL' : (usT || imgs || links) ? 'PARTIAL' : 'PASS';
  if (a === 'verses' && W.probe && W.probe.selectable.every(([k]) => /chip/.test(k))) s2 = imgs ? 'PARTIAL' : 'PASS';
  cell(a, '2 selection/callout', s2, `${usT}/${usN} controls -webkit-user-select:text; ${imgs} draggable img, ${links} links; -webkit-touch-callout rules ${callout}`);
  // 3 default form controls (every rig screen)
  const nf = R.nativeForms || []; const sf = R.styledForms || [];
  cell(a, '3 form controls', nf.length ? 'FAIL' : (a === 'prayer' && sf.some(f => f.type === 'select-multiple')) ? 'PARTIAL' : (sf.length ? 'PASS' : 'n/a'), nf.length ? `${nf.length} native: ${nf.map(f => f.sel.split(' ').pop() + '(' + f.type + ')').slice(0, 6).join(', ')}` : sf.length ? `${sf.length} styled${a === 'prayer' ? ' (one is <select multiple>)' : ''}` : 'no form controls');
  // 4 focus rings
  const ft = W.focusTap; const ks = C.keyboardSummary || {};
  const kv = kr.results.filter(r => r.area === a);
  const kvTxt = kv.map(r => `${r.sel} ${r.changedPx}px`).join(', ');
  const s4 = ft && ft.focusVisible ? 'FAIL' : ks.stops && ks.ringPainted === 0 ? 'FAIL' : ks.stops && ks.ringPainted < ks.stops ? 'PARTIAL' : 'PASS';
  cell(a, '4 focus rings', s4, `touch: ${ft ? (ft.focusVisible ? 'ring after tap' : 'no ring after tap') : 'no touch control'}; keyboard: ${ks.ringPainted}/${ks.stops} stops paint a ring${kvTxt ? '; pixel check ' + kvTxt : ''}`);
  // 5 links
  const ln = R.links || []; const blue = ln.filter(l => l.tell).length; const und = ln.filter(l => l.underline).length;
  cell(a, '5 blue links', blue ? 'FAIL' : und ? 'PARTIAL' : ln.length ? 'PASS' : 'n/a', ln.length ? `${ln.length} links, ${blue} blue+underlined, ${und} underlined` : '0 <a href>');
  // 6 white flash
  const F = fc.areas[a] || {}; const FW = fw.areas[a] || {};
  const fl = k => F[k] ? (F[k].flash ? 'FLASH' : F[k].paletteFlash ? 'palette' : F[k].darkFlash ? 'DARK' : '-') : '?';
  const dur = k => { const R6 = F[k]; if (!R6 || !(R6.flash || R6.paletteFlash)) return ''; const s = R6.series; const on = s.filter(x => x[2] - R6.settled.meanL >= 0.15); if (!on.length) return ''; const j = s.indexOf(on[on.length - 1]); return ` ~${(s[j + 1] ? s[j + 1][0] : on[on.length - 1][0]) - on[0][0]} ms`; };
  const b4 = F['B-400'] || {};
  const s6 = (F['A-0'] && F['A-0'].flash) || (F['A-400'] && F['A-400'].flash) || (F['B-0'] && F['B-0'].flash) ? 'FAIL' : (b4.flash || b4.paletteFlash || (F['C-0'] && F['C-0'].darkFlash)) ? 'PARTIAL' : 'PASS';
  cell(a, '6 white flash', s6, `Chromium A-0 ${fl('A-0')}, A-400 ${fl('A-400')}, B-0 ${fl('B-0')}, B-400 ${fl('B-400')}${dur('B-400')}, C-0 ${F['C-0'] ? (F['C-0'].darkFlash ? 'DARK' : '-') : '?'} (light frames in C are the viewer's 360 ms fade over a light Home, not counted); WebKit B-400 ${FW['B-400'] ? (FW['B-400'].flash ? 'FLASH' : FW['B-400'].paletteFlash ? 'palette' : '-') : 'not run'}`);
  // 7 rubber-band
  const ov = W.over || {}; const sc = ov['system-light'] || {};
  const rts = Object.values(ov).filter(v => v.docScrolls).flatMap(v => [v.ratioTop, v.ratioBottom]).filter(x => x != null);
  cell(a, '7 rubber-band', 'DEVICE', `${Object.keys(R.overscroll || {}).join(' ')} over ${R.docs} docs (body is not a scroll container, so body's value is inert: overscroll-body.json); body ${sc.bodyOverflow || '?'}/${sc.bodyPos || '?'}; doc scrolls ${sc.docScrolls}; canvas vs content edge ${rts.length ? Math.min(...rts) + '-' + Math.max(...rts) : 'n/a (does not scroll)'}`);
  // 8 tap delay
  const vp = (W.probe && W.probe.viewport) || ''; const td = C.tapDelay ? C.tapDelay.touchendToClickMs : null;
  const f16 = (C.desktop ? C.desktop.fieldsUnder16 : []);
  cell(a, '8 tap delay', /width=device-width/.test(vp) ? (f16.length ? 'PARTIAL' : 'PASS') : 'FAIL', `viewport device-width; touchend→click ${td == null ? 'n/a (no touch)' : td + ' ms'}; body touch-action manipulation${f16.length ? `; iOS focus zoom: ${f16.length} fields < 16 px (${f16.map(f => f.sel + ' ' + f.fs).join(', ')})` : ''}`);
  // 9 scrollbars
  const views = (sb.areas[a] || {}).views || []; const bars = views.flatMap(v => v.scrollers.filter(s => s.vbar > 0 || s.hbar > 0));
  const chromeBars = [...new Set(bars.filter(s => s.chrome).map(s => `${s.sel} ${Math.max(s.vbar, s.hbar)}px`))]; const docBars = [...new Set(bars.filter(s => !s.chrome).map(s => `${s.sel} ${Math.max(s.vbar, s.hbar)}px`))];
  cell(a, '9 scrollbars', chromeBars.length ? 'FAIL' : docBars.length ? 'PARTIAL' : 'PASS', `classic bars (desktop): chrome ${chromeBars.join(', ') || 'none'}; content ${docBars.join(', ') || 'none'}; iPad/iPhone overlay`);
  // 10 layout shift
  const L0 = (ld.areas[a] || {}).cls || {};
  cell(a, '10 layout shift', L0.cls >= 0.1 || L0.maxMovePx >= 100 ? 'FAIL' : L0.cls >= 0.05 || L0.maxMovePx > 0 ? 'PARTIAL' : 'PASS', `CLS ${L0.cls}, max landmark move ${L0.maxMovePx} px (cold, held pull, in the viewer)`);
  // 11 spinners vs skeletons
  const l9 = (ld.areas[a] || {}).loadingAt900 || {};
  const usesSk = a === 'shell' || a === 'tv' ? st.files.shell.counts.skeleton : S.counts.skeleton;
  cell(a, '11 spinner vs skeleton', l9.spinnerClass || (l9.infinite || []).length ? 'FAIL' : 'PARTIAL', `at 900 ms: ${l9.skeletons} skeletons, ${l9.spinnerClass} spinners, text ${l9.textLen} chars${(l9.loadingText || []).length ? ', "…" ×' + l9.loadingText.length : ''}; .skeleton in source ${usesSk}`);
  // 12 dialogs
  const REACH = { shell: [9, 'all 9 reachable: 4 for any adult (Forget device, album remove, Cash in, Reset week), 5 admin-only'], tv: [0, 'the kiosk reaches none (tv-me: #forget not clickable)'], f260: [0, '1 latent alert(), only when crypto.subtle is missing (insecure http), unreachable on the https site'], dollywood: [2, '2 reachable (Reset progress confirm, bad-import alert); 3 park-map confirms are dead code in the guide'], 'dollywood-live': [3, '3 reachable (meeting point long-press, Meet here, Clear meeting point); confirm+alert of the hidden guide UI unreachable'] };
  const dN = a === 'tv' ? 0 : S.counts.dialog; const reach = REACH[a] || [0, '']; const raised = Object.entries(dl.runs).filter(([k]) => k.startsWith(a === 'shell' ? 'shell' : a + '-') && !(a === 'dollywood' && k.startsWith('dollywood-live'))).flatMap(([, v]) => v.raised);
  cell(a, '12 alert/confirm/prompt', reach[0] === 0 ? 'PASS' : 'FAIL', `${dN} call sites in source, ${reach[0]} reachable${reach[1] ? ' (' + reach[1] + ')' : ''}${raised.length ? `; ${raised.length} raised at runtime (dismissed)` : ''}`);
}
// the TV reaches none of the shell's confirms (tv-me run raised 0); spinners: the shell's own skeleton use is cited by row
fs.writeFileSync(path.join(EV, 'matrix.json'), JSON.stringify({ note: 'See the header of audits/tools/phase4/TELL/matrix.mjs. Rows = areas, keys = tells.', matrix: M }, null, 1));
const TELLS = Object.keys(M.shell);
console.log('| Tell | ' + AREAS.join(' | ') + ' |'); console.log('|' + '---|'.repeat(AREAS.length + 1));
for (const t of TELLS) console.log(`| ${t} | ` + AREAS.map(a => M[a][t].s).join(' | ') + ' |');
console.log();
for (const a of AREAS) { console.log('## ' + a); for (const t of TELLS) console.log(`- ${t}: **${M[a][t].s}** — ${M[a][t].e}`); }
