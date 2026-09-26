// Phase 5: checks audits/design-preview.html in the audit's WebKit and in Chromium (the installed Chrome) at three widths
// and both OS schemes: every in-page contrast figure passes its threshold, no horizontal scroll, no page error.
// Step 2 of "Before Phase 6" (audits/05-decisions.md) adds:
//   - the people map is D3 + D4 (05-decisions.md:13-14) and the app map is APP_HUES in app-hues.mjs (D5), nine distinct, none a person's;
//   - each of the eight glass stages (four levels x light/dark, iframes of the page in stage mode) resolved the level the token
//     file defines: Clear 40/48, Current 64/84, Frosted = the palette's own 78-80/90, Solid = opaque with no blur; the outline
//     (text and icon) is on for Clear and Current only; the <html> attributes are the ones bootstrap.js:12 writes.
//   node audits/tools/phase5/preview-check.mjs  → audits/evidence/p5/preview-check.json (exit 1 on any failure)
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { playwright, ROOT } from '../lib/local.mjs';
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };
const srv = http.createServer((q, r) => { const p = path.join(ROOT, decodeURIComponent(new URL(q.url, 'http://x').pathname)); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' }); r.end(b); }); }).listen(0);
const port = srv.address().port;
const pw = playwright();
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

// expected maps
const PEOPLE_EXPECTED = { Eli: 'periwinkle', Mae: 'peach', Elizabeth: 'bubblegum', David: 'mint', Mea: 'butter', Ezra: 'aqua', Kiara: 'lavender', 'Downstairs TV': 'graphite' };
const PERSON_HUES = ['bubblegum', 'peach', 'butter', 'mint', 'aqua', 'sky', 'periwinkle', 'lavender', 'graphite'];
const hueSrc = fs.readFileSync(path.join(ROOT, 'audits', 'tools', 'phase5', 'app-hues.mjs'), 'utf8');
const APP_EXPECTED = Object.fromEntries([...hueSrc.slice(hueSrc.indexOf('export const APP_HUES'), hueSrc.indexOf('];', hueSrc.indexOf('export const APP_HUES'))).matchAll(/\['(\w+)', [\d.]+, '([\w-]+)'/g)].map(m => [m[2], m[1]]));
const tok = fs.readFileSync(path.join(ROOT, 'audits', 'tools', 'phase4', 'tokens', 'proposed-tokens.css'), 'utf8');
const levelRule = lv => { const m = tok.match(new RegExp(`:root\\[data-glass="${lv}"\\] \\{ --glass-alpha: (\\d+%); --glass-alpha-strong: (\\d+%)`)); return m && { alpha: m[1], alphaStrong: m[2] }; };
const paletteAlpha = th => { const i = tok.indexOf(`[data-theme-preview="${th}"]`); const body = tok.slice(tok.indexOf('{', i), tok.indexOf('}', i)); const m = body.match(/--glass-alpha: (\d+%); --glass-alpha-strong: (\d+%)/); return { alpha: m[1], alphaStrong: m[2] }; };

const problems = [];
const mapCheck = maps => {
  const out = [];
  const people = Object.fromEntries(maps.people.filter(([n]) => !/^Guest/.test(n)));
  for (const [n, hue] of Object.entries(PEOPLE_EXPECTED)) if (people[n] !== hue) out.push(`person ${n}: ${people[n]} (expected ${hue}, D3)`);
  const guests = maps.people.filter(([n]) => /^Guest/.test(n));
  if (!guests.length || guests.some(([, h]) => h !== 'sky')) out.push('guests must all be sky (D4)');
  if (Object.values(people).includes('sky')) out.push('a household member holds sky, the guests\' hue (D4)');
  const apps = Object.fromEntries(maps.apps);
  if (JSON.stringify(Object.keys(apps).sort()) !== JSON.stringify(Object.keys(APP_EXPECTED).sort())) out.push('app ids differ from APP_HUES');
  for (const [id, hue] of Object.entries(APP_EXPECTED)) if (apps[id] !== hue) out.push(`app ${id}: ${apps[id]} (expected ${hue}, app-hues.mjs APP_HUES)`);
  const hues = Object.values(apps);
  if (new Set(hues).size !== hues.length) out.push('two apps share a hue (D5)');
  if (hues.some(h => PERSON_HUES.includes(h))) out.push('an app uses a person hue (D5)');
  return out;
};
const stageCheck = st => {
  const out = [], r = st.result, tag = `${st.level}/${st.scheme}`;
  if (!r) return [`${tag}: stage never reported`];
  const theme = st.scheme === 'dark' ? 'midnight' : 'hearth';
  if (r.theme !== theme) out.push(`${tag}: theme ${r.theme}`);
  if (st.level === 'solid') {
    if (r.transparency !== 'reduce' || r.glass) out.push(`${tag}: attrs glass=${r.glass} transparency=${r.transparency} (expected transparency=reduce, no data-glass)`);
    if (r.filter !== 'none') out.push(`${tag}: --glass-filter ${r.filter} (expected none)`);
    if (/color-mix/.test(r.glassFill) && !/100%/.test(r.glassFill)) out.push(`${tag}: --glass is see-through: ${r.glassFill}`);
  } else {
    const want = st.level === 'frosted' ? paletteAlpha(theme) : levelRule(st.level);
    if (!want) out.push(`${tag}: no rule in the token file`);
    else if (r.alpha !== want.alpha || r.alphaStrong !== want.alphaStrong) out.push(`${tag}: alpha ${r.alpha}/${r.alphaStrong} (token file ${want.alpha}/${want.alphaStrong})`);
    if (r.transparency !== 'full') out.push(`${tag}: transparency ${r.transparency} (an explicit choice writes full, bootstrap.js:12)`);
    if (r.glass !== st.level) out.push(`${tag}: data-glass ${r.glass} (an explicit choice writes data-glass=${st.level}, bootstrap.js:12)`);
  }
  const haloWanted = st.level === 'clear' || st.level === 'current';
  if (r.halo !== haloWanted) out.push(`${tag}: text outline ${r.halo ? 'on' : 'off'} (expected ${haloWanted ? 'on' : 'off'})`);
  if (r.iconHalo !== haloWanted) out.push(`${tag}: icon outline ${r.iconHalo ? 'on' : 'off'} (expected ${haloWanted ? 'on' : 'off'})`);
  if (r.hscroll > 0) out.push(`${tag}: stage scrolls sideways by ${r.hscroll}px`);
  return out;
};

const out = [];
for (const [name, launch] of [['webkit', () => pw.webkit.launch()], ['chromium', () => pw.chromium.launch({ executablePath: CHROME })]]) {
  const b = await launch();
  for (const w of [390, 820, 1440]) for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: 900 }, colorScheme: scheme });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:${port}/audits/design-preview.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__previewReady === true, null, { timeout: 30000 });
    const r = await page.evaluate(() => ({ pass: document.querySelectorAll('.ratio.pass').length, fail: [...document.querySelectorAll('.ratio.fail')].map(e => (e.closest('.pair,tr,.person,.nb,.segs') || e).innerText.replace(/\s+/g, ' ').slice(0, 80)), hscroll: document.documentElement.scrollWidth - document.documentElement.clientWidth, maps: window.__previewMaps, stages: window.__stages, picker: [...document.querySelectorAll('#picker > .panel')].map(p => ({ radios: [...p.querySelectorAll('[role=radio]')].map(r => ({ hue: r.dataset.accent, text: r.innerText.replace(/\s+/g, ' '), checked: r.getAttribute('aria-checked') })), cvdRows: p.querySelectorAll('.cbcheck [style*="cvd-"]').length, warn: !!p.querySelector('.cbwarn') })) }));
    const mapIssues = mapCheck(r.maps), stageIssues = r.stages.flatMap(stageCheck);
    if (r.stages.length !== 8) stageIssues.push(`${r.stages.length} glass stages (expected 8)`);
    // the admin picker (household answer 2026-09-26): all 18 families, each app colour named with its app, one current choice, the CVD check
    if (r.picker.length !== 2) mapIssues.push(`${r.picker.length} picker panels (expected 2)`);
    for (const pk of r.picker) {
      const hues = pk.radios.map(x => x.hue);
      if (JSON.stringify([...hues].sort()) !== JSON.stringify([...PERSON_HUES, ...Object.values(APP_EXPECTED)].sort())) mapIssues.push('picker does not offer exactly the 18 families: ' + hues.join(','));
      for (const [id, hue] of Object.entries(APP_EXPECTED)) { const x = pk.radios.find(y => y.hue === hue); const name = r.maps.apps.find(([a]) => a === id) && ({ timer: 'Timer', prayer: 'Prayer', kidverse: 'Kid Verse', verses: 'Verses', leftovers: 'Larder', tally: 'Tally', 'dollywood-live': 'Park map', f260: 'F260', dollywood: 'Build guide' })[id]; if (!x || !x.text.includes(name)) mapIssues.push(`picker: ${hue} is not labelled ${name}`); }
      if (pk.radios.filter(x => x.checked === 'true').length !== 1) mapIssues.push('picker: not exactly one current colour');
      if (pk.cvdRows < 2 || !pk.warn) mapIssues.push('picker: no colour-blind check');
    }
    out.push({ engine: name, width: w, scheme, pass: r.pass, fail: r.fail, hscroll: r.hscroll, errors: errs, mapIssues, stageIssues, stages: r.stages });
    if (r.fail.length || r.hscroll > 0 || errs.length || mapIssues.length || stageIssues.length) problems.push(`${name} ${w} ${scheme}`);
    await ctx.close();
  }
  await b.close();
}
srv.close();
fs.mkdirSync(path.join(ROOT, 'audits', 'evidence', 'p5'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audits', 'evidence', 'p5', 'preview-check.json'), JSON.stringify({ expected: { people: PEOPLE_EXPECTED, guests: 'sky', apps: APP_EXPECTED }, runs: out }, null, 1));
for (const o of out) console.log(o.engine.padEnd(8), String(o.width).padEnd(5), o.scheme.padEnd(5), 'pass', o.pass, 'fail', o.fail.length, 'hscroll', o.hscroll, 'errors', o.errors.length, 'maps', o.mapIssues.length, 'stages', o.stageIssues.length, [...o.fail, ...o.errors, ...o.mapIssues, ...o.stageIssues].slice(0, 6).join(' | '));
console.log(problems.length ? 'FAIL: ' + problems.join(', ') : 'ok');
process.exit(problems.length ? 1 : 0);
