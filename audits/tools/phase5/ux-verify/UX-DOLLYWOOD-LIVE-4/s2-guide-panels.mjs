// Skeptic s2, UX-DOLLYWOOD-LIVE-4: the build guide's panels inside the park map, measured on iPhone PWA and iPad portrait.
// (1) Thunderhead card -> Track: the card's rows and the rendered size of the elevation profile's axis labels (:936);
// (2) Search "zipline": what the sheet says; (3) Style pane: its labels and native controls.
// Run: node "audits/tools/phase5/ux-verify/UX-DOLLYWOOD-LIVE-4/s2-guide-panels.mjs"
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../evidence/p5/ux-verify/UX-DOLLYWOOD-LIVE-4/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'park', clock: 'real', engine: 'webkit' });
const out = {};
async function openMap(d) {
  await d.goto('#home'); await sleep(1200);
  const f = await d.openApp('dollywood-live');
  await f.waitForSelector('#lv-pill[data-state]', { timeout: 15000 });
  await f.waitForFunction(() => window.hub && hub.profile, null, { timeout: 10000 }).catch(() => {});
  await sleep(1500); return f;
}
async function tab(f, id) { await f.locator(id).click(); await sleep(700); }
async function run(device, key) {
  const d = await L.device({ device, profile: 'eli', fixedTime: false });
  const r = {};
  try {
    let f = await openMap(d);
    // (2) search no-match first
    await tab(f, '#lv-search');
    await f.locator('#q').fill('zipline'); await sleep(600);
    r.searchNoMatch = await f.evaluate(() => { const p = document.getElementById('lv-srch'); return { text: p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300), results: document.querySelectorAll('#tab-list .oi').length, hasEmptyMsg: /no (match|result)|nothing found|couldn/i.test(p.innerText) }; });
    await d.page.screenshot({ path: path.join(OUT, `${key}-search-zipline.png`) });
    await f.locator('#q').fill('wild'); await sleep(600);
    r.searchWild = await f.evaluate(() => { const p = document.getElementById('lv-srch'); return { text: p.innerText.replace(/\s+/g, ' ').trim().slice(0, 300), selects: [...p.querySelectorAll('select')].map(s => ({ id: s.id, opts: [...s.options].map(o => o.text).slice(0, 8) })) }; });
    // (3) style pane
    await tab(f, '#lv-layers-tab');
    r.style = await f.evaluate(() => { const p = document.getElementById('lv-lay'); return { text: p.innerText.replace(/\s+/g, ' ').trim().slice(0, 400), selects: p.querySelectorAll('select').length, checkboxes: p.querySelectorAll('input[type=checkbox]').length,
      checkboxSize: (() => { const c = p.querySelector('input[type=checkbox]'); if (!c) return null; const b = c.getBoundingClientRect(); return [Math.round(b.width), Math.round(b.height)]; })(),
      appearance: (() => { const c = p.querySelector('input[type=checkbox]'); return c ? getComputedStyle(c).appearance || getComputedStyle(c).webkitAppearance : null; })() }; });
    // contour interval: does changing it have a visible effect on the default (illustrated) style?
    r.contourSelectEffect = await f.evaluate(async () => { const s = document.getElementById('cint'); if (!s) return null; const svgBefore = document.querySelector('svg').innerHTML.length; const old = s.value; const alt = [...s.options].map(o => o.value).find(v => v !== old); s.value = alt; s.dispatchEvent(new Event('change')); await new Promise(r => setTimeout(r, 500)); const svgAfter = document.querySelector('svg').innerHTML.length; s.value = old; s.dispatchEvent(new Event('change')); return { old, alt, svgBefore, svgAfter }; });
    await d.page.screenshot({ path: path.join(OUT, `${key}-style.png`) });
    // (1) Thunderhead card -> Track
    await tab(f, '#lv-search');
    await f.locator('#q').fill('Thunderhead'); await sleep(500);
    await f.locator('#tab-list .oi[data-n="28"]').click({ timeout: 4000 }); await sleep(1500);
    r.rideCard = await f.evaluate(() => { const p = document.getElementById('pop'); return { text: p.innerText.replace(/\s+/g, ' ').trim().slice(0, 400), hasTrack: !!document.getElementById('i-coast') }; });
    await f.locator('#i-coast').click({ timeout: 4000 }); await sleep(1200);
    r.coasterCard = await f.evaluate(() => { const p = document.getElementById('pop'); const kv = [...p.querySelectorAll('dl.kv dt')].map(dt => dt.textContent + ': ' + (dt.nextElementSibling ? dt.nextElementSibling.textContent : ''));
      const gp = document.getElementById('gp'); const gr = gp ? gp.getBoundingClientRect() : null;
      const labels = gp ? [...gp.querySelectorAll('text')].map(t => { const b = t.getBoundingClientRect(); return { t: t.textContent, h: +b.height.toFixed(1), w: +b.width.toFixed(1) }; }) : [];
      const bodyFs = getComputedStyle(p).fontSize;
      return { kv, gpWidth: gr && Math.round(gr.width), gpViewBox: gp && gp.getAttribute('viewBox'), axisLabels: labels, scale: gr ? +(gr.width / 1000).toFixed(3) : null, renderedFontPx: gr ? +(12 * gr.width / 1000).toFixed(1) : null, cardFs: bodyFs,
        disclaimer: (p.querySelector('p.fact') || {}).textContent, hasHead: !!p.querySelector('.pop-head'), hasActionRow: !!p.querySelector('.lv-act-row, .pop-acts') }; });
    await d.page.screenshot({ path: path.join(OUT, `${key}-coaster-card.png`) });
    out[key] = r;
  } finally { await d.close(); }
}
try { await run('iphone-pwa', 'iphone'); await run('ipad-portrait', 'ipad'); }
finally { fs.writeFileSync(path.join(OUT, 'guide-panels.json'), JSON.stringify(out, null, 2)); console.log(JSON.stringify(out, null, 1)); await L.close(); }
