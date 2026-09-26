// Skeptic s2, UX-KIDVERSE-2 (and inputs for UX-KIDVERSE-1 / VIS-KIDVERSE-1): open Kid Verse inside the shell as a kid on
// every non-TV device and measure where the kid's actions land relative to the visible viewer area. Also reads the
// computed colours of the day letters and unearned badge glyphs, and records the text + kind of every toast on a
// second Done tap. Local rig only (audits/tools/lib/local.mjs); nothing is written outside the s2 evidence folder.
import fs from 'node:fs';
import path from 'node:path';
import { local, ROOT, sleep } from '../../../lib/local.mjs';

const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-KIDVERSE-2/s2');
fs.mkdirSync(OUT, { recursive: true });
const DEVICES = ['iphone-pwa', 'iphone-safari', 'ipad-portrait', 'ipad-landscape', 'desktop'];
const result = { devices: {}, colours: {}, toast: null };

const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  for (const dev of DEVICES) {
    const d = await L.device({ device: dev, profile: 'ezra', mode: 'light' });
    const f = await d.openApp('kidverse', { wait: '#done:not([hidden])' });
    await sleep(1200);
    const iframe = await d.page.evaluate(() => { const el = [...document.querySelectorAll('iframe')].find(i => /kidverse/.test(i.src)); const r = el.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight, vw: innerWidth }; });
    const m = await f.evaluate(() => {
      const q = s => { const e = document.querySelector(s); if (!e || e.hidden) return null; const r = e.getBoundingClientRect(); return { top: Math.round(r.top + scrollY), bottom: Math.round(r.bottom + scrollY), h: Math.round(r.height) }; };
      return { frameVh: innerHeight, docH: document.documentElement.scrollHeight, scene: q('.scene'), ref: q('#ref'), say: q('#say'), done: q('#done'), stars: q('#mine'), storySay: q('#story-say'), heard: q('#story-heard'), rewards: q('#rewards'),
        sayLabel: document.querySelector('#say span').textContent, storySayLabel: document.querySelector('#story-say span').textContent, heardLabel: document.querySelector('#story-heard span').textContent };
    });
    const vis = r => r ? { visiblePx: Math.max(0, Math.min(r.bottom, m.frameVh) - r.top), fullyAbove: r.bottom <= m.frameVh, screens: +(r.top / m.frameVh).toFixed(2) } : null;
    result.devices[dev] = { iframe, ...m, fold: { say: vis(m.say), done: vis(m.done), stars: vis(m.stars), heard: vis(m.heard) } };
    await d.shot(path.join(OUT, `first-screen-${dev}.png`));
    if (dev === 'iphone-pwa') {
      // second Done tap: what feedback does a child get? (the rig's WebKit has no speech; count speak() calls if it exists)
      await f.evaluate(() => { window.__speaks = 0; try { const s = speechSynthesis.speak.bind(speechSynthesis); speechSynthesis.speak = u => { window.__speaks++; return s(u); }; } catch {} });
      await f.evaluate(() => { const b = document.querySelector('#done'); b.scrollIntoView({ block: 'center' }); });
      await f.click('#done'); await sleep(400);
      const first = await f.evaluate(() => ({ label: document.querySelector('#done span').textContent, toast: (document.getElementById('hub-toast') || {}).textContent || null, count: (document.getElementById('star-count') || {}).textContent }));
      await sleep(2600);
      await f.click('#done'); await sleep(300);
      const second = await f.evaluate(() => ({ label: document.querySelector('#done span').textContent, toast: (document.getElementById('hub-toast') || {}).textContent || null, toastRole: (document.getElementById('hub-toast') || { getAttribute() { return null; } }).getAttribute('role'), speaks: window.__speaks, hasSpeech: 'speechSynthesis' in window }));
      result.toast = { first, second };
      await d.shot(path.join(OUT, 'iphone-second-done-toast.png'));
    }
    await d.close();
  }
  // colours: Kiara in each palette (fewer badges earned, so more unearned glyphs), kid card at 430
  for (const theme of ['hearth', 'parchment', 'frost', 'midnight', 'forest']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'kiara', mode: theme === 'midnight' || theme === 'forest' ? 'dark' : 'light' });
    const f = await d.openApp('kidverse', { wait: '#rewards:not([hidden])' });
    await sleep(1200);
    await f.evaluate(([t, sch]) => { const r = document.documentElement; if (t === 'hearth') delete r.dataset.theme; else r.dataset.theme = t; r.dataset.scheme = sch; }, [theme, theme === 'midnight' || theme === 'forest' ? 'dark' : 'light']);
    await sleep(200);
    result.colours[theme] = await f.evaluate(() => {
      const rgb = s => (s.match(/[\d.]+/g) || []).slice(0, 4).map(Number);
      const lum = ([r, g, b]) => { const c = [r, g, b].map(v => v / 255).map(v => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
      const cr = (a, b) => { const x = lum(a), y = lum(b); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); };
      const bgOf = el => { for (let e = el; e; e = e.parentElement) { const c = rgb(getComputedStyle(e).backgroundColor); if (c.length === 4 ? c[3] > 0.9 : c.length === 3) return c; } return [255, 255, 255]; };
      const theme = document.documentElement.getAttribute('data-theme');
      const letters = [...document.querySelectorAll('#mine .days span:not(.on)')].map(s => ({ t: s.textContent, fs: getComputedStyle(s).fontSize, fg: getComputedStyle(s).color, bg: getComputedStyle(s).backgroundColor, cr: cr(rgb(getComputedStyle(s).color), bgOf(s)) }));
      const glyphs = [...document.querySelectorAll('#rw-badges li:not(.on) .bicon')].map(s => ({ badge: s.parentElement.dataset.badge, text: s.textContent.trim(), fs: getComputedStyle(s).fontSize, fw: getComputedStyle(s).fontWeight, cr: cr(rgb(getComputedStyle(s).color), bgOf(s)) }));
      const hints = [...document.querySelectorAll('#rw-badges li small')].map(s => ({ t: s.textContent, fs: getComputedStyle(s).fontSize, cr: cr(rgb(getComputedStyle(s).color), bgOf(s)) }));
      const names = [...document.querySelectorAll('#rw-badges li .bname')].map(s => ({ t: s.textContent, fs: getComputedStyle(s).fontSize, cr: cr(rgb(getComputedStyle(s).color), bgOf(s)) }));
      return { theme, letters: letters.slice(0, 2), letterCount: letters.length, glyphs, hints: hints.slice(0, 6), names: names.slice(0, 6) };
    });
    if (theme === 'hearth' || theme === 'midnight') await f.evaluate(() => document.querySelector('#mine').scrollIntoView({ block: 'start' }));
    if (theme === 'hearth' || theme === 'midnight') await d.shot(path.join(OUT, `kiara-stars-${theme}.png`));
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'fold.json'), JSON.stringify(result, null, 1));
  await L.close();
}
console.log(JSON.stringify(result, null, 1));
