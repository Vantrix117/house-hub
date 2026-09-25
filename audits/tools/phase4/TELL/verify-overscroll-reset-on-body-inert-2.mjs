// TELL / verify-overscroll-reset-on-body-inert-2 (skeptic #2): is `body { overscroll-behavior: none }` (apps/design.css:304)
// inert? Independent re-measure.
//  A. Synthetic page, BOTH engines (Chromium = installed Chrome, WebKit = Playwright WebKit): a scrollable parent embeds a
//     scrollable srcdoc iframe; wheel past the iframe's end; did the parent scroll (= the iframe viewport chained)?
//     Arms: none | body{none} | html{none} | body{none;overflow:auto;height:100%} (body made a real scroller).
//  B. The real documents on the local rig (WebKit, iphone-pwa, eli; tv 1920 for the kiosk): per area, html/body
//     overscroll-behavior, body overflow/position, whether the document scroller overflows, and every element that
//     actually scrolls with its overscroll-behavior.
//   node audits/tools/phase4/TELL/verify-overscroll-reset-on-body-inert-2.mjs → audits/evidence/p4/TELL/verify-overscroll-reset-on-body-inert-2.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright, sleep, local } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pw = playwright();
const out = { note: 'See the header of audits/tools/phase4/TELL/verify-overscroll-reset-on-body-inert-2.mjs.', synthetic: {}, real: {} };
const ARMS = [['none', ''], ['body', 'body{overscroll-behavior:none}'], ['html', 'html{overscroll-behavior:none}'], ['bodyScroller', 'html{height:100%;overflow:hidden}body{height:100%;overflow:auto;overscroll-behavior:none}']];
for (const eng of ['chromium', 'webkit']) {
  const browser = eng === 'chromium' ? await pw.chromium.launch({ executablePath: CHROME, headless: true }) : await pw.webkit.launch({ headless: true });
  out.synthetic[eng] = {};
  try {
    for (const [arm, css] of ARMS) {
      const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
      const inner = `<!doctype html><style>body{margin:0} ${css} .t{height:1500px;background:linear-gradient(#cde,#edc)}</style><div class=t></div>`;
      await page.setContent(`<!doctype html><style>body{margin:0}</style><div style="height:100px">top</div><iframe style="width:560px;height:300px;border:0;display:block" srcdoc="${inner.replace(/"/g, '&quot;')}"></iframe><div style="height:2000px">below</div>`);
      await sleep(500);
      const f = page.frames().find(x => x !== page.mainFrame());
      await f.evaluate(() => { const s = document.body.scrollHeight > document.body.clientHeight + 1 && getComputedStyle(document.body).overflowY === 'auto' ? document.body : document.scrollingElement; s.scrollTop = 1e6; });
      await page.mouse.move(280, 250);
      const before = await page.evaluate(() => scrollY);
      for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 200); await sleep(150); }
      await sleep(500);
      const r = { before, after: await page.evaluate(() => scrollY),
        computed: await f.evaluate(() => ({ html: getComputedStyle(document.documentElement).overscrollBehaviorY, body: getComputedStyle(document.body).overscrollBehaviorY, bodyOverflow: getComputedStyle(document.body).overflowY, innerScrollTop: document.scrollingElement.scrollTop, bodyScrollTop: document.body.scrollTop })) };
      r.chained = r.after > r.before;
      out.synthetic[eng][arm] = r; console.log(eng, arm, JSON.stringify(r));
      await page.close();
    }
  } finally { await browser.close(); }
}
// B. real documents
const probe = () => {
  const cs = e => getComputedStyle(e);
  const H = document.documentElement, B = document.body, se = document.scrollingElement;
  const scrollers = [];
  for (const e of document.querySelectorAll('*')) {
    if (e === H) continue;
    const s = cs(e); const oy = s.overflowY;
    if ((oy === 'auto' || oy === 'scroll') && e.scrollHeight > e.clientHeight + 2 && e.getClientRects().length)
      scrollers.push({ sel: e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (e.classList.length ? '.' + [...e.classList].slice(0, 2).join('.') : ''), overscroll: s.overscrollBehaviorY, sh: e.scrollHeight, ch: e.clientHeight });
  }
  return { html: cs(H).overscrollBehaviorY, body: cs(B).overscrollBehaviorY, htmlOverflow: cs(H).overflowY, bodyOverflow: cs(B).overflowY, bodyPos: cs(B).position,
    docScrolls: se.scrollHeight > se.clientHeight + 2, docSH: se.scrollHeight, docCH: se.clientHeight, scrollers: scrollers.slice(0, 8) };
};
const L = await local({ variant: 'typical', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  await d.goto('#home'); await sleep(2500);
  out.real.shell = await d.page.evaluate(probe); console.log('shell', JSON.stringify(out.real.shell));
  for (const id of ['f260', 'leftovers', 'prayer', 'tally', 'timer', 'kidverse', 'verses', 'dollywood', 'dollywood-live']) {
    try { const f = await d.openApp(id); await sleep(id.startsWith('dollywood') ? 6000 : 2500); out.real[id] = await f.evaluate(probe); }
    catch (e) { out.real[id] = { error: String(e.message).slice(0, 200) }; }
    console.log(id, JSON.stringify(out.real[id]));
  }
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  await tv.goto('#home'); await sleep(2500);
  out.real.tv = await tv.page.evaluate(probe); console.log('tv', JSON.stringify(out.real.tv));
} finally { await L.close(); }
fs.mkdirSync(path.join(ROOT, 'audits/evidence/p4/TELL'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/TELL/verify-overscroll-reset-on-body-inert-2.json'), JSON.stringify(out, null, 1));
