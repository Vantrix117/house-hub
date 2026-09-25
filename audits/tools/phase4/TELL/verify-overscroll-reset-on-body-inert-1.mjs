// TELL / verify-overscroll-reset-on-body-inert-1 (skeptic #1): is `body { overscroll-behavior: none }` (apps/design.css:304)
// inert because body is never a scroll container and the viewport only takes the ROOT element's value?
//   node audits/tools/phase4/TELL/verify-overscroll-reset-on-body-inert-1.mjs
//   → audits/evidence/p4/TELL/verify-overscroll-reset-on-body-inert-1.json
// Part A (real documents, local rig, WebKit + Chromium): for each of the 11 areas, in the document that scrolls, read
//   html/body computed overscroll-behavior-y and overflow-y, whether body is itself a scroll container (overflow not
//   visible/clip on body AND on html, so nothing propagates to the viewport), whether the viewport (scrollingElement)
//   has overflow, and every element whose computed overscroll-behavior-y is not 'auto'.
// Part B (synthetic, no hub code, WebKit + Chromium): a scrollable parent embeds a scrollable srcdoc iframe; the wheel
//   scrolls the iframe past its end; chained = the parent scrolled. Arms include design.css's own base rules inlined
//   (read from disk), design.css + html rule, and a control where body IS the scroll container.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { local, playwright, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const OUT = path.join(ROOT, 'audits/evidence/p4/TELL/verify-overscroll-reset-on-body-inert-1.json');
const APPS = ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
const out = { script: 'audits/tools/phase4/TELL/verify-overscroll-reset-on-body-inert-1.mjs', partA: {}, partB: {} };

const probe = () => {
  const cs = e => getComputedStyle(e);
  const h = document.documentElement, b = document.body, se = document.scrollingElement;
  const nonVis = v => v !== 'visible' && v !== 'clip';
  const bodyIsScroller = nonVis(cs(b).overflowY) && nonVis(cs(h).overflowY);
  const others = [];
  for (const e of document.querySelectorAll('*')) { const o = cs(e).overscrollBehaviorY; if (o !== 'auto') others.push((e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/)[0] : '')) + '=' + o + (e.scrollHeight > e.clientHeight + 1 && nonVis(cs(e).overflowY) ? ' (scrolls)' : '')); }
  return { html: { ob: cs(h).overscrollBehaviorY, overflowY: cs(h).overflowY }, body: { ob: cs(b).overscrollBehaviorY, overflowY: cs(b).overflowY, position: cs(b).position },
    bodyIsScroller, viewportOverflowPx: se.scrollHeight - se.clientHeight, nonAuto: others.slice(0, 12), nonAutoCount: others.length };
};

for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  out.partA[engine] = {};
  try {
    for (const area of ['shell', 'tv', ...APPS]) {
      const prof = area === 'tv' ? 'tv' : area === 'kidverse' ? 'ezra' : 'eli';
      const d = await L.device({ device: area === 'tv' ? 'tv' : 'iphone-pwa', mode: 'light', profile: prof });
      try {
        let doc;
        if (area === 'shell' || area === 'tv') { await d.goto('#home'); await sleep(2000); doc = d.page.mainFrame(); }
        else { doc = await d.openApp(area); await sleep(2000); }
        const r = await doc.evaluate(probe);
        if (area !== 'shell' && area !== 'tv') r.shellDoc = await d.page.mainFrame().evaluate(probe).then(x => ({ html: x.html, body: x.body, bodyIsScroller: x.bodyIsScroller, viewportOverflowPx: x.viewportOverflowPx }));
        out.partA[engine][area] = r;
        console.log(engine, area, JSON.stringify(r).slice(0, 400));
      } catch (e) { out.partA[engine][area] = { error: String(e).slice(0, 300) }; console.log(engine, area, 'ERR', String(e).slice(0, 200)); }
      finally { await d.close(); }
    }
  } finally { await L.close(); }
}

// Part B
const dcss = fs.readFileSync(path.join(ROOT, 'apps/design.css'), 'utf8');
const base = dcss.slice(dcss.indexOf('*, *::before, *::after'), dcss.indexOf('h1, h2, h3, h4'));   // design.css's html + body base block
const ARMS = [
  ['noRule', 'body{margin:0}'],
  ['designCssBody', base + ' body{background:#fff}'],
  ['designCssPlusHtmlNone', base + ' html{overscroll-behavior:none} body{background:#fff}'],
  ['htmlContain', 'body{margin:0} html{overscroll-behavior:contain}'],
  ['controlBodyIsScroller', 'html{height:100%;overflow:hidden} body{margin:0;height:100%;overflow:auto;overscroll-behavior:none}'],
];
const pw = playwright();
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
for (const engine of ['chromium', 'webkit']) {
  const browser = engine === 'chromium' ? await pw.chromium.launch({ executablePath: CHROME, headless: true }) : await pw.webkit.launch({ headless: true });
  out.partB[engine] = {};
  try {
    for (const [arm, css] of ARMS) {
      const page = await browser.newPage({ viewport: { width: 500, height: 500 } });
      const inner = `<!doctype html><html><head><style>${css} .c{height:1400px;background:linear-gradient(#abc,#cba)}</style></head><body><div class=c></div></body></html>`;
      await page.setContent(`<!doctype html><style>body{margin:0}</style><div style="height:80px"></div><iframe style="display:block;width:460px;height:280px;border:0" srcdoc="${inner.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}"></iframe><div style="height:1800px"></div>`);
      await sleep(500);
      const f = page.frames().find(x => x !== page.mainFrame());
      await f.evaluate(() => { const s = document.body.scrollHeight > document.body.clientHeight + 1 && getComputedStyle(document.body).overflowY === 'auto' ? document.body : document.scrollingElement; s.scrollTop = 1e6; });
      await sleep(200);
      await page.mouse.move(230, 200);
      const before = await page.evaluate(() => scrollY);
      for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 150); await sleep(100); }
      await sleep(500);
      const after = await page.evaluate(() => scrollY);
      const comp = await f.evaluate(() => ({ html: getComputedStyle(document.documentElement).overscrollBehaviorY, body: getComputedStyle(document.body).overscrollBehaviorY, bodyOverflowY: getComputedStyle(document.body).overflowY }));
      out.partB[engine][arm] = { parentBefore: before, parentAfter: after, chained: after > before, computed: comp };
      console.log('B', engine, arm, JSON.stringify(out.partB[engine][arm]));
      await page.close();
    }
  } finally { await browser.close(); }
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log('wrote', OUT);
