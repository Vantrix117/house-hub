// Phase 3 / dollywood: house-style measurements of the build guide's chrome (not the map drawing), WebKit, as Eli.
// The app is opened standalone (apps/dollywood.html as the top page, signed in) so the Phase 2 VIS helpers can screenshot it.
//   1 type scale: computed size/weight/family of every kind of text          2 tap targets under 44 px
//   3 rendered text contrast (lib-vis contrastSweep) in Hearth light, all five palettes on the iPad build card, phone sheet
//   4 the per-profile accent: Eli vs Mae                                        5 reduced motion: does the pulse stop?
//   6 radii nesting and glass layers                                          7 the dark viewer flash when a light-theme person opens it
//   node "audits/tools/phase3/dollywood/visual-measure.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { install, contrastSweep, nearestDT } from '../../phase2/VIS/lib-vis.mjs';
const EV = path.resolve('audits/evidence/p3/dollywood');
const out = {};
const log = (k, v, quiet) => { out[k] = v; console.log(k, quiet ? '(saved)' : JSON.stringify(v).slice(0, 1500)); };
const shot = async (page, name, opts = {}) => { const f = path.join(EV, name); await page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide', ...opts }); return path.relative(process.cwd(), f).replace(/\\/g, '/'); };
async function standalone(L, device, profile = 'eli', extra = {}) {
  const d = await L.device({ device, profile, fixedTime: false, ...extra });
  await d.page.goto(L.site + '/apps/dollywood.html');
  await d.page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 });
  await sleep(900);
  return d;
}
const TYPE = [['h1', 'header h1'], ['stat number', '.stat b'], ['stat caption', '.stat span'], ['intro', 'header .sub'], ['section chip', '#chips button .cl'],
  ['toolbar group label (::before)', '.toolbar .tg', '::before'], ['toolbar button', '#t-sec'], ['search field', '#q'], ['card title', '.bhead h2'], ['card count', '#b-count'],
  ['phase pill', '#b-now .pill'], ['step title', '#b-now h3'], ['step body', '#b-now p'], ['approx note', '#b-now .approx'], ['card button', '#b-done'], ['next unfinished', '#b-nextun'],
  ['step list item', '.bitem b'], ['step list phase', '.phhead'], ['readout', '#readout'], ['hint', '.hint span'], ['coaster legend', '.cle'], ['side tab', '.tabs button'],
  ['side h2', '.tabbody h2'], ['side h3', '#tab-list h3'], ['listing row', '.oi span:nth-child(2)'], ['listing row meta', '.oi .k'], ['profile title', '.profhead h2'], ['profile controls', '.vx'], ['profile stats', '.pstats']];
const typeScale = page => page.evaluate(T => T.map(([name, sel, pseudo]) => { const e = document.querySelector(sel); if (!e) return { name, sel, missing: true };
  const cs = getComputedStyle(e, pseudo || null); return { name, sel: sel + (pseudo || ''), px: parseFloat(cs.fontSize), weight: cs.fontWeight, family: cs.fontFamily.split(',')[0].replace(/"/g, '').trim(), tracking: cs.letterSpacing, upper: cs.textTransform === 'uppercase' }; }), TYPE);
const fails = r => r.measured.filter(x => x.p10 < (x.large ? 3 : 4.5)).map(x => ({ sel: x.sel, text: x.text, fs: x.fs, p10: x.p10, med: x.med, op: x.op }));
const summary = r => ({ measured: r.measured.length, failing: fails(r), minP10: Math.min(...r.measured.map(x => x.p10)) });

const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  // 1-2 type scale and targets, phone + iPad (Hearth)
  for (const dev of ['iphone-pwa', 'ipad-portrait']) {
    const d = await standalone(L, dev);
    const ts = await typeScale(d.page);
    log(dev + '.typeScale', ts.map(t => t.missing ? `${t.name}: missing` : `${t.name} ${t.px}px/${t.weight} ${t.family}${t.upper ? ' CAPS' : ''} ~${nearestDT(t.px)[0]}(${nearestDT(t.px)[1]})`));
    await install(d.page);
    if (dev === 'iphone-pwa') await d.page.evaluate(() => { document.getElementById('build').dataset.state = 'half'; });
    await sleep(500);
    const tg = await d.page.evaluate(() => __vis.targets().filter(t => !t.disabled && (t.w < 44 || t.h < 44)));
    log(dev + '.targetsUnder44', { n: tg.length, list: tg.map(t => `${t.label || t.sel} ${t.w}x${t.h}`) });
    await d.close();
  }
  // 3 contrast: Hearth phone (top, sheet half), iPad all palettes (top + build card)
  {
    const d = await standalone(L, 'iphone-pwa');
    log('phone.hearth.top', summary(await contrastSweep(d.page, null)));
    await d.page.evaluate(() => { document.getElementById('build').dataset.state = 'half'; }); await sleep(600);
    log('phone.hearth.sheetHalf', summary(await contrastSweep(d.page, null)));
    log('phone.hearth.sheetHalf.png', await shot(d.page, 'phone-sheet-half-hearth.png'));
    await d.close();
  }
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
    const d = await standalone(L, 'ipad-portrait', 'eli', { mode: ['midnight', 'forest'].includes(theme) ? 'dark' : 'light', localStorage: theme === 'hearth' ? {} : { 'hub.theme': JSON.stringify(theme) } });
    const applied = await d.page.evaluate(() => ({ theme: document.documentElement.dataset.theme || 'hearth(default)', scheme: document.documentElement.dataset.scheme, bg: getComputedStyle(document.body).backgroundColor }));
    const top = summary(await contrastSweep(d.page, null));
    await d.page.evaluate(() => document.getElementById('build').scrollIntoView({ block: 'start' })); await sleep(500);
    const card = summary(await contrastSweep(d.page, null));
    const f = await shot(d.page, `ipad-card-${theme}.png`);
    const strike = await d.page.evaluate(() => { const e = document.querySelector('.bitem.ok'); if (!e) return null; const cs = getComputedStyle(e); return { color: cs.color, opacity: cs.opacity, decoration: cs.textDecorationLine }; });
    log('ipad.' + theme, { applied, top, card, doneItemStyle: strike, png: f });
    await d.close();
  }
  // 4 accent: Eli vs Mae
  {
    const r = {};
    for (const pid of ['eli', 'christian']) {
      const d = await standalone(L, 'ipad-portrait', pid);
      r[pid] = await d.page.evaluate(() => { const c = document.querySelector('#chips button[aria-pressed=true]'), t = document.getElementById('t-pan'); return { accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), pressedChipBg: getComputedStyle(c).backgroundColor, panBtnBg: getComputedStyle(t).backgroundColor, focusRing: getComputedStyle(document.documentElement).getPropertyValue('--focus').trim().slice(0, 60), progressBar: getComputedStyle(document.getElementById('b-bar')).backgroundColor, stepTarget: (document.querySelector('#hl .hl-ring') || { getAttribute: () => null }).getAttribute('stroke') }; });
      r[pid].png = await shot(d.page, `ipad-top-${pid}.png`, { clip: { x: 0, y: 0, width: 820, height: 560 } });
      await d.close();
    }
    log('accent', r);
  }
  // 5 reduced motion
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.ctx.close(); // reopen with reducedMotion
    const ctx = await L.browser.newContext({ viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await ctx.route('https://house-hub-api.catalystfarm1.workers.dev/**', r => r.abort());
    const S = L.S;
    await ctx.addInitScript(c => { if (!localStorage.getItem('rig.init')) { localStorage.clear(); localStorage.setItem('hub.api', JSON.stringify(c.api)); localStorage.setItem('hub.device', JSON.stringify(c.device)); localStorage.setItem('hub.session', JSON.stringify(c.session)); localStorage.setItem('rig.init', '1'); } }, { api: L.api, device: S.info.device, session: S.sessions.eli });
    const page = await ctx.newPage();
    await page.goto(L.site + '/apps/dollywood.html');
    await page.waitForFunction(() => /of \d+ done/.test((document.getElementById('b-count') || {}).textContent || ''), null, { timeout: 30000 }); await sleep(800);
    log('reducedMotion', await page.evaluate(() => { const r = document.querySelector('#hl .hl-ring'); return { mq: matchMedia('(prefers-reduced-motion: reduce)').matches, pulseAnimation: r ? getComputedStyle(r).animationName + ' ' + getComputedStyle(r).animationDuration + ' ' + getComputedStyle(r).animationIterationCount : null, chipBarTransition: getComputedStyle(document.querySelector('.chips .cbar b')).transitionDuration }; }));
    await ctx.close();
  }
  // 6 radii and glass
  {
    const d = await standalone(L, 'ipad-portrait');
    await install(d.page);
    const radii = await d.page.evaluate(() => __vis.radii());
    const glass = await d.page.evaluate(() => __vis.glass());
    const recipe = await d.page.evaluate(() => ['header', '.toolbar', 'aside.side', '.build', '.profwrap', '.mapbox', '#readout', '#chips button'].map(s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return { sel: s, radius: cs.borderTopLeftRadius, backdrop: cs.webkitBackdropFilter || cs.backdropFilter || 'none', bgImage: cs.backgroundImage.slice(0, 40), position: cs.position }; }));
    log('ipad.radii', { n: radii.length, off: radii.filter(r => !r.ok) });
    log('ipad.glass', { backdropLayers: glass, surfaces: recipe });
    await d.close();
    const p = await standalone(L, 'iphone-pwa');
    await install(p.page);
    log('phone.glass', await p.page.evaluate(() => __vis.glass()));
    await p.close();
  }
  // 7 the dark viewer flash: a Hearth person opens the build guide from the Apps grid; sample the viewer's brightness
  {
    const d = await L.device({ device: 'ipad-portrait', profile: 'eli', fixedTime: false });
    await d.goto('#apps'); await sleep(1500);
    const lumAt = async () => { const b = await d.page.screenshot({ clip: { x: 100, y: 600, width: 40, height: 40 }, scale: 'css' }); return b; };
    const samples = [];
    const t0 = Date.now();
    await d.page.click('.tile[data-id="dollywood"]');
    for (let i = 0; i < 14; i++) { const png = await lumAt(); samples.push({ ms: Date.now() - t0, png: png.toString('base64') }); await sleep(60); }
    const lums = await d.page.evaluate(async S => { const r = []; for (const s of S) { const img = new Image(); img.src = 'data:image/png;base64,' + s.png; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height).data; let t = 0; for (let i = 0; i < d.length; i += 4) t += (d[i] + d[i + 1] + d[i + 2]) / 3; r.push({ ms: s.ms, meanRGB: Math.round(t / (d.length / 4)) }); } return r; }, samples);
    const viewerBg = await d.page.evaluate(() => getComputedStyle(document.getElementById('viewer')).backgroundColor);
    log('darkFlash', { viewerDarkBg: viewerBg, samples: lums, darkFrames: lums.filter(x => x.meanRGB < 60).length });
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(EV, 'visual-measure.json'), JSON.stringify(out, null, 1));
  await L.close();
}
