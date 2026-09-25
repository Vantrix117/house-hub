// TELL / verify-overscroll-body: does `body { overscroll-behavior: none }` (apps/design.css:304, the only overscroll reset
// every document inherits) stop overscroll at the document scroller? The spec applies the ROOT element's value to the
// viewport and does not propagate body's; this proves it in Chromium with a synthetic page, no hub code involved:
// a scrollable parent embeds a scrollable srcdoc iframe; the mouse wheel scrolls the iframe past its end and we read
// whether the parent scrolled (scroll chaining = the iframe's viewport ignored the declaration).
//   node audits/tools/phase4/TELL/verify-overscroll-body.mjs   → audits/evidence/p4/TELL/overscroll-body.json
// Arms: (1) no rule, (2) body{overscroll-behavior:none} — design.css's rule, (3) html{overscroll-behavior:none}.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { playwright, sleep } from '../../lib/local.mjs';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const pw = playwright();
const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
const out = { note: 'See the header of audits/tools/phase4/TELL/verify-overscroll-body.mjs.', arms: {} };
try {
  for (const [arm, css] of [['none', ''], ['body', 'body{overscroll-behavior:none}'], ['html', 'html{overscroll-behavior:none}']]) {
    const page = await browser.newPage({ viewport: { width: 600, height: 600 } });
    const inner = `<!doctype html><style>${css} body{margin:0} .t{height:1500px;background:linear-gradient(#cde,#edc)}</style><div class=t></div>`;
    await page.setContent(`<!doctype html><style>body{margin:0}</style><div style="height:100px">top</div><iframe id=f style="width:560px;height:300px;border:0" srcdoc="${inner.replace(/"/g, '&quot;')}"></iframe><div style="height:2000px">below</div>`);
    await sleep(400);
    const f = page.frames().find(x => x !== page.mainFrame());
    await f.evaluate(() => { document.scrollingElement.scrollTop = document.scrollingElement.scrollHeight; });
    await page.mouse.move(280, 250);
    const before = await page.evaluate(() => scrollY);
    for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, 200); await sleep(120); }
    await sleep(400);
    const r = { parentScrollBefore: before, parentScrollAfter: await page.evaluate(() => scrollY), innerAtEnd: await f.evaluate(() => { const s = document.scrollingElement; return s.scrollTop + s.clientHeight >= s.scrollHeight - 1; }),
      computed: await f.evaluate(() => ({ html: getComputedStyle(document.documentElement).overscrollBehaviorY, body: getComputedStyle(document.body).overscrollBehaviorY, bodyOverflow: getComputedStyle(document.body).overflowY })) };
    r.chained = r.parentScrollAfter > r.parentScrollBefore;
    out.arms[arm] = r;
    console.log(arm, JSON.stringify(r));
    await page.close();
  }
} finally { await browser.close(); }
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/TELL/overscroll-body.json'), JSON.stringify(out, null, 1));
