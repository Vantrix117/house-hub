// Skeptic #2 for "picker-title-under-status-bar":
//   node "audits/tools/phase2/PWA/verify-picker-title-under-status-bar-2.mjs"
// Question: is the picker title clipped because of the 59 px top inset (the finding's claim), or is it the #gate
// centred-flex-with-overflow layout (index.html:29-30) regardless of insets? And is the 59 px top inset even real for this
// app, whose status-bar style is "default" (index.html:12: iOS puts the web view BELOW the status bar, top inset 0)?
// Scenarios (signed-out picker, typical household + guest Grandma Jo, and the same with the guest card removed = the real
// 8-profile household):
//   A  rig default          430x932, insets 0/0            (what Phase 1 captured)
//   B  finding's scenario   430x932, top 59 / bottom 34    (black-translucent-style full-bleed web view)
//   C  status-bar "default" 430x873, top 0 / bottom 34     (web view starts below the 59 px status band; home indicator)
//   D  small iPhone         375x647, insets 0/0            (iPhone SE-class Home Screen app, 20 px status bar)
// For each: .gate-title top/bottom and h1 top at the gate's natural scrollTop, after gate.scrollTop = 0 and after trying
// to scroll further up (scrollBy -500) — i.e. can the user ever bring the title into view?
// Evidence: audits/evidence/p2/PWA/verify-picker-title-under-status-bar-2.json and -<scenario>.png (1x css).
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
const rel = f => path.relative(ROOT, f).replace(/\\/g, '/');
const inset = ({ top = 0, bottom = 0 }) => `:root:root{--safe-top:${top}px !important;--safe-bottom:${bottom}px !important}`;

const SCEN = [
  ['A-rig-430x932-inset0', { width: 430, height: 932 }, { top: 0, bottom: 0 }],
  ['B-finding-430x932-top59-bottom34', { width: 430, height: 932 }, { top: 59, bottom: 34 }],
  ['C-statusbar-default-430x873-bottom34', { width: 430, height: 873 }, { top: 0, bottom: 34 }],
  ['D-small-375x647-inset0', { width: 375, height: 647 }, { top: 0, bottom: 0 }],
];

const measure = page => page.evaluate(() => {
  const g = document.getElementById('gate'), t = document.querySelector('.gate-title'), h = t.querySelector('h1'), p = t.querySelector('p');
  const r = e => { const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom) }; };
  const cs = getComputedStyle(g);
  return { gateScrollTop: Math.round(g.scrollTop), gateClient: g.clientHeight, gateScroll: g.scrollHeight, padTop: cs.paddingTop, padBottom: cs.paddingBottom,
    cards: document.querySelectorAll('.pcard[data-id]').length, title: r(t), h1: { ...r(h), text: h.textContent }, sub: { ...r(p), text: p.textContent },
    lastCardBottom: Math.round([...document.querySelectorAll('.pcard[data-id]')].pop().getBoundingClientRect().bottom) };
});

const log = {};
const L = await local({ variant: 'typical', clock: 'demo' });
try {
  for (const [name, size, ins] of SCEN) {
    for (const guest of [true, false]) {
      const d = await L.device({ device: 'iphone-pwa', profile: null });
      await d.page.setViewportSize(size);
      await d.goto(''); await d.page.waitForSelector('.pcard[data-id]');
      await d.page.addStyleTag({ content: inset(ins) });
      if (!guest) await d.page.evaluate(() => document.querySelectorAll('.pcard[data-id]').forEach(b => { if (/Grandma/.test(b.textContent)) b.remove(); }));
      await sleep(1200);
      const r = { viewport: size, insets: ins, natural: await measure(d.page) };
      await d.page.evaluate(() => { document.getElementById('gate').scrollTop = 0; }); await sleep(150);
      r.atScrollTop0 = await measure(d.page);
      await d.page.evaluate(() => document.getElementById('gate').scrollBy(0, -500)); await sleep(150);
      r.afterScrollUp = await measure(d.page);
      const key = `${name}${guest ? '-9profiles' : '-8profiles'}`;
      const top = r.afterScrollUp.h1.top;
      r.verdict = top < ins.top ? `h1 top ${top} < ${ins.top} (clipped, unreachable)` : `h1 top ${top} >= ${ins.top} (visible)`;
      if (guest || name.startsWith('C')) { const f = path.join(OUT, `verify-picker-title-under-status-bar-2-${key}.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled' }); r.shot = rel(f); }
      log[key] = r;
      console.log(`\n== ${key}: ${r.verdict}\n   natural: title ${JSON.stringify(r.natural.title)} h1 ${JSON.stringify(r.natural.h1)} sub ${JSON.stringify(r.natural.sub)} scrollTop ${r.natural.gateScrollTop} client ${r.natural.gateClient} scrollH ${r.natural.gateScroll} pad ${r.natural.padTop}/${r.natural.padBottom} cards ${r.natural.cards}\n   after scroll-up: h1 ${JSON.stringify(r.afterScrollUp.h1)} scrollTop ${r.afterScrollUp.gateScrollTop}`);
      await d.close();
    }
  }
  const meta = await (async () => { const d = await L.device({ device: 'iphone-pwa', profile: null }); await d.goto(''); const m = await d.page.evaluate(() => ({ statusBarStyle: document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]').content, viewport: document.querySelector('meta[name="viewport"]').content, gateCss: getComputedStyle(document.getElementById('gate')).justifyContent + ' / overflow ' + getComputedStyle(document.getElementById('gate')).overflowY })); await d.close(); return m; })();
  log.meta = meta; console.log('\n== meta', JSON.stringify(meta));
  // User-like reach in WebKit (no wheel/swipe in mobile WebKit): keyboard scrolling from the focused card, and
  // scrollIntoView on the h1 — both are clamped to the same scroll range a finger swipe gets.
  for (const [name, size, ins] of [SCEN[1], SCEN[2]]) {
    const d = await L.device({ device: 'iphone-pwa', profile: null });
    await d.page.setViewportSize(size); await d.goto(''); await d.page.waitForSelector('.pcard[data-id]');
    await d.page.addStyleTag({ content: inset(ins) }); await sleep(1200);
    const before = await measure(d.page);
    await d.page.focus('.pcard[data-id]'); for (let i = 0; i < 6; i++) { await d.page.keyboard.press('PageUp'); await sleep(120); }
    const kb = await measure(d.page);
    await d.page.evaluate(() => { document.getElementById('gate').scrollTop = 0; }); await sleep(100);
    await d.page.evaluate(() => document.querySelector('.gate-title h1').scrollIntoView({ block: 'start' })); await sleep(300);
    const siv = await measure(d.page);
    const f = path.join(OUT, `verify-picker-title-under-status-bar-2-${name}-scrolledUp.png`); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled' });
    log[`webkit-reach-${name}`] = { before: { h1: before.h1, scrollTop: before.gateScrollTop }, pageUp: { h1: kb.h1, scrollTop: kb.gateScrollTop }, scrollIntoView: { h1: siv.h1, scrollTop: siv.gateScrollTop }, shot: rel(f) };
    console.log(`\n== webkit reach ${name}: before h1 ${before.h1.top} (scrollTop ${before.gateScrollTop}) · PageUp x6 h1 ${kb.h1.top} (scrollTop ${kb.gateScrollTop}) · h1.scrollIntoView h1 ${siv.h1.top} (scrollTop ${siv.gateScrollTop})`);
    await d.close();
  }
} finally {
  fs.writeFileSync(path.join(OUT, 'verify-picker-title-under-status-bar-2.json'), JSON.stringify(log, null, 1));
  await L.close();
}
