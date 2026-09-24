// F260 — "Print plan" through a real PDF: headless Chrome (engine chromium), standalone apps/f260.html signed in as Eli,
// CDP Page.printToPDF (A4/Letter default, the app's @page margin). Counts pages, then emulates print media in the page to
// list what prints (UI text, read state) and draws the print layout to a PNG for the record.
//   node "audits/tools/phase3/f260/print.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, DEMO, save, shot, ready, EVID, rel } from './_lib.mjs';

const out = {};
const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
try {
  const d = await L.device({ device: 'desktop', profile: 'eli', installClock: DEMO });
  await d.ctx.route(u => u.href.startsWith(L.api + '/api/') && !u.href.startsWith(L.api + '/api/media/'), r => r.request().method() === 'GET' ? r.fallback() : r.abort());
  await d.page.goto(L.site + '/apps/f260.html', { waitUntil: 'load' }); await ready(d.page);
  const cdp = await d.ctx.newCDPSession(d.page);
  const pdf = await cdp.send('Page.printToPDF', { printBackground: false, preferCSSPageSize: true });
  const buf = Buffer.from(pdf.data, 'base64');
  const file = path.join(EVID, 'print-eli.pdf'); fs.writeFileSync(file, buf);
  const pages = (buf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  out.pdf = { file: rel(file), bytes: buf.length, pages };
  // what the print stylesheet shows
  await d.page.emulateMedia({ media: 'print' }); await sleep(300);
  out.printed = await d.page.evaluate(() => {
    const shown = e => { for (let x = e; x && x.nodeType === 1; x = x.parentElement) if (getComputedStyle(x).display === 'none') return false; return true; };
    const weeks = [...document.querySelectorAll('.weeks .week')].filter(shown);
    const ui = ['#todayDone', '#today', '.switch', '#settingsBtn', '#printBtn', '.side', '.foot', '.mark', '.jbtn', '.readbar', '.ring'].map(s => [s, [...document.querySelectorAll(s)].some(shown)]);
    const doneA = document.querySelector('.day.done .refs a'), openA = document.querySelector('.day:not(.done) .refs a');
    const st = e => e && (c => ({ color: c.color, deco: c.textDecorationLine, weight: c.fontWeight }))(getComputedStyle(e));
    const head = document.querySelector('.wk-head'); const hc = getComputedStyle(head);
    return { weeksShown: weeks.length, uiShown: Object.fromEntries(ui), readDayLink: st(doneA), unreadDayLink: st(openA),
      wkHead: { radius: hc.borderTopLeftRadius + ' ' + hc.borderBottomRightRadius, borderBottom: hc.borderBottomWidth + ' ' + hc.borderBottomStyle },
      text: document.body.innerText.slice(0, 260) };
  });
  await d.page.setViewportSize({ width: 794, height: 1123 }); await sleep(300);
  await shot(d.page, 'print-media-page1.png');
  await d.page.screenshot({ path: path.join(EVID, 'print-media-wkhead-zoom.png'), clip: { x: 0, y: 40, width: 260, height: 90 }, scale: 'css' });
  await d.close();
} finally { await L.close(); }
console.log('PDF', JSON.stringify(out.pdf));
console.log('printed', JSON.stringify(out.printed));
console.log('evidence →', save('print.json', out));
