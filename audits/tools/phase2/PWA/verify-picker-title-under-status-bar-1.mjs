// Skeptic #1 for "picker-title-under-status-bar": is the signed-out picker's title really above the scroll origin
// (unreachable), and does that depend on the injected 59 px top inset?
//   node "audits/tools/phase2/PWA/verify-picker-title-under-status-bar-1.mjs"
// WebKit, typical household (9 picker cards incl. guest Grandma Jo), signed out (profile: null) on the iPhone PWA device.
// Scenarios: rig default (no inset), the investigator's 59/34 injected inset, a viewport that starts below the status bar
// (apple-mobile-web-app-status-bar-style "default" → content under the status bar is not drawn; top inset 0), a smaller
// iPhone (390x844 / 390x797), each with 9 cards and again with the guest card removed (the 8-profile household).
// For each: title rect, #gate scrollTop/scrollHeight/clientHeight, then try to reach the title (scrollTop=-500,
// scrollBy down then up, scrollIntoView) and re-measure. Evidence: audits/evidence/p2/PWA/verify-picker-title-under-status-bar-1.json + PNGs.
import { local, sleep } from '../../lib/local.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p2/PWA');
fs.mkdirSync(OUT, { recursive: true });
const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
const inset = ({ top = 0, bottom = 0 }) => `:root:root{--safe-top:${top}px !important;--safe-bottom:${bottom}px !important}`;

const SCEN = [
  { name: 'A rig default 430x932, no inset', vp: { width: 430, height: 932 }, ins: null },
  { name: 'B investigator 430x932, inset 59/34', vp: { width: 430, height: 932 }, ins: { top: 59, bottom: 34 }, shot: true },
  { name: 'C status-bar default: 430x873 below the bar, inset 0/34', vp: { width: 430, height: 873 }, ins: { top: 0, bottom: 34 }, shot: true },
  { name: 'D iPhone 13/14 390x844, inset 47/34', vp: { width: 390, height: 844 }, ins: { top: 47, bottom: 34 } },
  { name: 'E iPhone 13/14 below the bar 390x797, inset 0/34', vp: { width: 390, height: 797 }, ins: { top: 0, bottom: 34 } },
];

const measure = page => page.evaluate(() => {
  const g = document.getElementById('gate'), t = document.querySelector('.gate-title');
  const gr = g.getBoundingClientRect(), tr = t.getBoundingClientRect();
  return {
    cards: document.querySelectorAll('.pcard[data-id]').length,
    titleTop: Math.round(tr.top), titleBottom: Math.round(tr.bottom), titleText: t.innerText.replace(/\s+/g, ' ').trim(),
    titleOffsetInGate: Math.round(tr.top - gr.top + g.scrollTop),
    gate: { top: Math.round(gr.top), clientHeight: g.clientHeight, scrollHeight: g.scrollHeight, scrollTop: g.scrollTop, overflowY: getComputedStyle(g).overflowY, justify: getComputedStyle(g).justifyContent, paddingTop: getComputedStyle(g).paddingTop },
    safeTop: getComputedStyle(document.documentElement).getPropertyValue('--safe-top').trim(),
  };
});

const L = await local({ variant: 'typical', clock: 'demo' });
const res = {};
try {
  for (const s of SCEN) {
    for (const drop of [false, true]) {
      const d = await L.device({ device: 'iphone-pwa', profile: null });
      await d.page.setViewportSize(s.vp);
      await d.goto('');
      await d.page.waitForSelector('.pcard[data-id]');
      if (s.ins) await d.page.addStyleTag({ content: inset(s.ins) });
      if (drop) await d.page.evaluate(() => { const b = document.querySelector('.pcard[data-id^="guest-"]'); if (b) b.remove(); });
      await sleep(1500);
      const band = h => d.page.evaluate(h => { const b = document.createElement('div'); b.style.cssText = 'position:fixed;left:0;right:0;top:0;height:' + h + 'px;background:rgba(255,0,0,.28);z-index:2147483647;pointer-events:none'; document.body.appendChild(b); }, h);
      const snap = async tag => { const f = path.join(OUT, 'verify-picker-title-under-status-bar-1-' + s.name[0] + '-' + tag + '.png'); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled' }); return rel(f); };
      const shoot = s.shot && !drop;
      if (shoot && s.ins && s.ins.top) await band(s.ins.top);
      const r = { initial: await measure(d.page) };
      if (shoot) r.shotOnOpen = await snap('on-open');
      await d.page.evaluate(() => { document.getElementById('gate').scrollTop = -500; });
      r.afterScrollTopMinus500 = await measure(d.page);
      // Playwright has no wheel in mobile WebKit: scrollBy is what a finger drag does (down, then all the way back up)
      await d.page.evaluate(() => document.getElementById('gate').scrollBy(0, 400)); await sleep(300);
      r.afterWheelDown = { scrollTop: (await measure(d.page)).gate.scrollTop };
      await d.page.evaluate(() => document.getElementById('gate').scrollBy(0, -2000)); await sleep(400);
      r.afterWheelUp = await measure(d.page);
      if (shoot) r.shotAfterScrollingUp = await snap('after-scrolling-up');
      await d.page.evaluate(() => document.querySelector('.gate-title').scrollIntoView({ block: 'start' })); await sleep(300);
      r.afterScrollIntoView = await measure(d.page);
      r.titleReachableByScrollingUp = r.afterWheelUp.titleTop >= (s.ins ? s.ins.top : 0);
      res[s.name + (drop ? ' — guest card removed (8 cards)' : ' — typical (9 cards)')] = r;
      const i = r.initial;
      console.log(`${s.name}${drop ? ' [8 cards]' : ' [9 cards]'}: cards=${i.cards} titleTop=${i.titleTop} (offsetInGate ${i.titleOffsetInGate}) gate ch=${i.gate.clientHeight} sh=${i.gate.scrollHeight} st=${i.gate.scrollTop} pad=${i.gate.paddingTop} | after scrollTop=-500: st=${r.afterScrollTopMinus500.gate.scrollTop} top=${r.afterScrollTopMinus500.titleTop} | wheel down st=${r.afterWheelDown.scrollTop} | wheel up top=${r.afterWheelUp.titleTop} | scrollIntoView top=${r.afterScrollIntoView.titleTop} st=${r.afterScrollIntoView.gate.scrollTop} | title clear of the top inset after scrolling up=${r.titleReachableByScrollingUp}`);
      await d.close();
    }
  }
  const meta = await (await fetch(L.site + '/index.html')).text();
  res.statusBarStyleMeta = (meta.match(/<meta name="apple-mobile-web-app-status-bar-style"[^>]*>/) || [])[0];
  console.log('status-bar meta:', res.statusBarStyleMeta);
  // Control: the same CSS on a bare page (no hub code) in WebKit and in Chrome — is negative-side scrolling an engine behaviour?
  const bare = '<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><style>html,body{height:100%;margin:0}body{display:flex;flex-direction:column;position:fixed;inset:0;overflow:hidden}#g{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:auto;padding:32px 16px}#t{height:60px;background:#c33;flex:none}#c{height:1000px;width:200px;background:#39c;flex:none}</style><div id=g><div id=t>TITLE</div><div id=c></div></div>';
  const probe = async (b, label) => { const pg = await b.newPage({ viewport: { width: 430, height: 800 } }); await pg.setContent(bare); const o = await pg.evaluate(() => { const g = document.getElementById('g'), t = document.getElementById('t'); const a = { st: g.scrollTop, titleTop: Math.round(t.getBoundingClientRect().top) }; g.scrollTop = -9999; const b2 = { st: g.scrollTop, titleTop: Math.round(t.getBoundingClientRect().top) }; return { initial: a, afterScrollTopMinus9999: b2, scrollHeight: g.scrollHeight, clientHeight: g.clientHeight }; }); await pg.close(); res['control bare page — ' + label] = o; console.log('control', label, JSON.stringify(o)); };
  await probe(L.browser, 'WebKit ' + L.browser.version());
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  if (CHROME) { const cb = await L.pw.chromium.launch({ executablePath: CHROME }); try { await probe(cb, 'Chromium ' + cb.version()); } finally { await cb.close(); } }
  fs.writeFileSync(path.join(OUT, 'verify-picker-title-under-status-bar-1.json'), JSON.stringify(res, null, 1));
} finally {
  await L.close();
}
