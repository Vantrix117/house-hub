// Batch 1a core, checked on the rig's local instance (no wrangler): prefs follow the person, the display keeps its own,
// ACCENT-9, avatars carry their own family, the theme-color meta, the sheen on the bars only, Prayer's one meta.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const ROOT = process.cwd();
const { local, sleep } = await import(pathToFileURL(path.join(ROOT, 'audits/tools/lib/local.mjs')).href);
const OUT = process.argv[2];
const engine = process.argv[3] || 'webkit';
let pass = 0, fail = 0;
const ok = (c, n, x = '') => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x); } };
const until = async (fn, label, t = 10000) => { const t0 = Date.now(); while (Date.now() - t0 < t) { try { const v = await fn(); if (v) return v; } catch {} await sleep(150); } throw new Error('timeout: ' + label); };
const attrs = p => p.evaluate(() => { const d = document.documentElement.dataset; return { theme: d.theme, choice: d.themeChoice, scheme: d.scheme, accent: d.accent, kind: d.kind, textSize: d.textSize || null, contrast: d.contrast || null, transparency: d.transparency || null, motion: d.motion || null, glass: d.glass || null, cs: document.documentElement.style.colorScheme }; });
const pulled = p => until(() => p.evaluate(() => window.hub && hub.sync && hub.sync.lastPull > 0), 'pulled', 15000);
const flushed = p => until(() => p.evaluate(() => hub.flush().then(() => hub.sync.pending === 0)), 'flushed');

const L = await local({ variant: 'typical', engine });
try {
  const other = await L.newDevice({ name: 'Rig phone', profiles: ['eli', 'christian'] });
  const A = await L.device({ device: 'iphone-pwa', profile: 'eli', mode: 'light' });
  await A.goto('#home'); await pulled(A.page);
  const a0 = await attrs(A.page);
  ok(a0.theme === 'hearth' && a0.choice === 'system' && a0.scheme === 'light' && a0.accent === 'periwinkle' && a0.cs === 'light', `A: System on a light device paints Hearth; Eli is periwinkle; color-scheme light (${JSON.stringify(a0)})`);
  const metas = await A.page.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map(m => [m.getAttribute('content'), m.getAttribute('media')]));
  ok(metas.length === 1 && metas[0][0].toUpperCase() === '#F4F1EC' && metas[0][1] === null, `shell: one theme-color meta, Hearth's --bg, no media (${JSON.stringify(metas)})`);
  ok(await A.page.evaluate(() => !document.documentElement.style.getPropertyValue('--accent') && !document.documentElement.style.getPropertyValue('--sheen-x')), 'shell: no inline --accent and no --sheen-x on :root');
  // faces wear their own family
  const faces = await A.page.evaluate(() => [...document.querySelectorAll('.avatar')].map(a => a.getAttribute('data-accent') + (a.getAttribute('style') || '')));
  ok(faces.length > 0 && faces.every(f => /^[a-z]+$/.test(f)), `every avatar carries data-accent and no inline --tint (${faces.slice(0, 6).join(',')})`);
  // Me → Appearance
  await A.page.click('.tab[data-tab=me]'); await sleep(300);
  await A.page.$eval('#appearance', el => el.scrollIntoView({ block: 'center' })); await sleep(200);
  if (OUT) await A.shot(path.join(OUT, `appearance-${engine}-light.png`));
  ok(await A.page.$$eval('#theme .theme-card', els => els.length) === 7, 'Me: seven theme cards (Graphite included)');
  const sw = await A.page.evaluate(() => { const s = document.querySelector('.theme-swatch[data-preview="midnight"]'), sys = document.querySelector('.theme-swatch[data-preview="system"] .tp-half'); return { mid: getComputedStyle(s).backgroundColor, half: getComputedStyle(sys).backgroundColor, halfAcc: getComputedStyle(sys).getPropertyValue('--accent-fill').trim() }; });
  ok(sw.mid === 'rgb(11, 10, 9)' && sw.half === 'rgb(11, 10, 9)' && sw.halfAcc.toUpperCase() === '#373D69', `Me: the Midnight swatch and the System night half paint Midnight, the half with the dark periwinkle fill (${JSON.stringify(sw)})`);
  await A.page.click('#ap-size [data-v="l"]');
  await A.page.click('#ap-glass [data-v="solid"]');
  await A.page.click('#ap-contrast'); await A.page.click('#ap-motion');
  const a1 = await attrs(A.page);
  ok(a1.textSize === 'l' && a1.transparency === 'reduce' && a1.contrast === 'more' && a1.motion === 'reduce', `A: the four switches apply at once (${JSON.stringify(a1)})`);
  ok(await A.page.evaluate(() => { const g = k => hub.get(k, { app: 'hub', scope: 'person' }); return g('textSize') === 'l' && g('glass') === 'solid' && g('contrast') === 'more' && g('motion') === 'reduce'; }), 'A: one person-scope hub row each');
  ok(await A.page.evaluate(() => JSON.stringify(JSON.parse(localStorage.getItem('hub.prefs'))) === JSON.stringify({ textSize: 'l', contrast: 'more', motion: 'reduce', glass: 'solid' })), 'A: the device mirror hub.prefs holds them');
  if (OUT) { await A.page.$eval('#appearance', el => el.scrollIntoView({ block: 'center' })); await A.shot(path.join(OUT, `appearance-${engine}-light-set.png`)); }
  await flushed(A.page);
  // B: Eli on a second device in dark mode
  const B = await L.device({ device: 'ipad-portrait', profile: 'eli', mode: 'dark', as: other });
  await B.goto('#home'); await pulled(B.page);
  await until(() => attrs(B.page).then(x => x.textSize === 'l' && x.transparency === 'reduce' && x.contrast === 'more' && x.motion === 'reduce'), 'B follows');
  const b1 = await attrs(B.page);
  ok(b1.theme === 'midnight' && b1.choice === 'system' && b1.cs === 'dark', `B: System on a dark device paints Midnight (${b1.theme}/${b1.cs})`);
  ok(true, 'B: Eli\'s text size, glass, contrast and motion follow on the second device');
  const bar = await B.page.evaluate(() => { const cs = getComputedStyle(document.getElementById('tabbar')); return { bg: cs.backgroundColor, bf: cs.backdropFilter || cs.webkitBackdropFilter }; });
  ok(/^rgb\(/.test(bar.bg) && (bar.bf === 'none' || !bar.bf), `B: Solid → the tab bar is opaque with no blur (${bar.bg} / ${bar.bf})`);
  if (OUT) await B.shot(path.join(OUT, `home-${engine}-dark-prefs.png`));
  // Mae on another device: none of Eli's
  const M = await L.device({ device: 'iphone-pwa', profile: 'christian', mode: 'light', as: other });
  await M.goto('#home'); await pulled(M.page);
  const m1 = await attrs(M.page);
  ok(!m1.textSize && !m1.contrast && !m1.transparency && !m1.motion && m1.accent === 'peach', `Mae: none of Eli's preferences; her family is peach (${JSON.stringify(m1)})`);
  // ACCENT-9: an admin recolour reaches Mae while she is signed in
  const r = await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { hue: 'mint' } });
  ok(r.status === 200, 'admin sets Mae to mint (' + r.status + ')');
  await M.page.evaluate(() => { localStorage.removeItem('hub.meAt'); return hub.pull(); });
  await until(() => attrs(M.page).then(x => x.accent === 'mint'), 'Mae mint');
  ok(true, 'Mae: the recolour reaches her signed-in session on the next pull (ACCENT-9)');
  await L.apiAs('eli', '/api/admin/profiles/christian', { method: 'PUT', body: { hue: 'peach' } });
  // stale mirror on B
  await B.page.evaluate(() => { localStorage.setItem('hub.prefs', JSON.stringify({ textSize: 'xs' })); localStorage.setItem('hub.prefs.eli', JSON.stringify({ textSize: 'xs' })); });
  await B.page.reload({ waitUntil: 'load' });
  const early = await attrs(B.page);
  await pulled(B.page);
  await until(() => attrs(B.page).then(x => x.textSize === 'l'), 'row wins');
  ok(await B.page.evaluate(() => JSON.parse(localStorage.getItem('hub.prefs')).textSize === 'l'), `B: a stale mirror (XS) loses to the row (L): painted ${early.textSize} at load, the mirror corrected`);
  // back to the defaults
  await A.page.evaluate(() => { hub.setTextSize('m'); hub.setGlass(null); hub.setContrast(null); hub.setMotion(null); });
  ok(await A.page.evaluate(() => ['textSize', 'glass', 'contrast', 'motion'].every(k => hub.get(k, { app: 'hub', scope: 'person' }) === undefined) && !document.documentElement.dataset.textSize), 'A: reset clears the rows and the attributes');
  await flushed(A.page);
  await B.page.evaluate(() => hub.pull());
  await until(() => attrs(B.page).then(x => !x.textSize && !x.contrast && !x.motion && !x.transparency), 'B defaults');
  ok(true, 'B: follows back to the defaults');
  // theme change → meta follows
  await A.page.click('#theme [data-theme=forest]'); await sleep(200);
  const fm = await A.page.evaluate(() => [document.documentElement.dataset.theme, document.querySelector('meta[name="theme-color"]').content, getComputedStyle(document.body).backgroundColor]);
  ok(fm[0] === 'forest' && fm[1].toUpperCase() === '#070F0D', `A: Forest → data-theme forest, theme-color #070F0D (${fm})`);
  if (OUT) { await A.page.click('.tab[data-tab=home]'); await sleep(300); await A.shot(path.join(OUT, `home-${engine}-forest.png`)); await A.page.click('.tab[data-tab=me]'); }
  await A.page.click('#theme [data-theme=graphite]'); await sleep(200);
  ok(await A.page.evaluate(() => document.documentElement.dataset.theme === 'graphite' && getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)'), 'A: Graphite paints true black');
  await A.page.click('#theme [data-theme=system]'); await sleep(200);
  // sheen: on the bars only
  await A.page.click('.tab[data-tab=home]'); await sleep(200);
  await A.page.evaluate(() => { const v = document.getElementById('views'); v.scrollTop = v.scrollHeight; }); await sleep(300);
  const sh = await A.page.evaluate(() => ({ root: document.documentElement.style.getPropertyValue('--sheen-x'), bar: document.getElementById('tabbar').style.getPropertyValue('--sheen-x') }));
  ok(!sh.root && /%$/.test(sh.bar), `the sheen is written on the tab bar only (${JSON.stringify(sh)})`);
  // the display keeps its own settings
  const K = await L.device({ device: 'desktop', profile: 'tv', mode: 'light' });
  await K.goto('#home'); await pulled(K.page);
  const kp = await K.page.evaluate(() => { const r = { threw: null }; try { hub.setContrast('more'); hub.setMotion('reduce'); hub.setTransparency('reduce'); } catch (e) { r.threw = e.message; }
    const t = document.getElementById('hub-toast'); r.toast = t && !t.hidden ? t.textContent : ''; r.pending = hub.sync.pending; return r; });
  ok(!kp.threw && !kp.toast && !kp.pending, `display: setters write no row, no toast, no throw (${JSON.stringify(kp)})`);
  await K.page.reload({ waitUntil: 'load' }); await pulled(K.page);
  const k2 = await attrs(K.page);
  ok(k2.contrast === 'more' && k2.motion === 'reduce' && k2.transparency === 'reduce' && k2.accent === 'graphite', `display: kept across a reload; the TV is graphite (${JSON.stringify(k2)})`);
  if (OUT) await K.shot(path.join(OUT, `tv-${engine}-contrast.png`));
  // Prayer: exactly one theme-color meta, its own id
  const P = await L.device({ device: 'iphone-pwa', profile: 'eli', mode: 'dark' });
  const f = await P.openApp('prayer');
  await sleep(500);
  const pm = await f.evaluate(() => [...document.querySelectorAll('meta[name="theme-color"]')].map(m => [m.id, m.getAttribute('media')]));
  ok(pm.length === 1 && pm[0][0] === 'themeColor', `Prayer: one theme-color meta with id themeColor (${JSON.stringify(pm)})`);
  // F260: the root always carries data-theme; the theme buttons do not climb to it
  const F = await L.device({ device: 'iphone-pwa', profile: 'eli', mode: 'light' });
  const ff = await F.openApp('f260'); await sleep(800);
  ok(await ff.evaluate(() => document.documentElement.dataset.theme === 'hearth' && document.documentElement.dataset.themeChoice === 'system'), 'F260: the frame paints Hearth for System');
  const errs = [A, B, M, K, P, F].flatMap(d => d.logs.filter(l => /^(error|pageerror)/.test(l) && !/Failed to load resource/.test(l)));
  ok(errs.length === 0, 'no console errors', errs.slice(0, 5).join(' | '));
} finally { await L.close(); }
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
