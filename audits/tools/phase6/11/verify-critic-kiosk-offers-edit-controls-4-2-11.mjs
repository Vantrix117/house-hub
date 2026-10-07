// Batch 11 copy of audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-2.mjs: changed on purpose, because the display profile no longer draws +, - or Reset (P3-TALLY-09), so the script cannot Playwright-click them; the clicks are issued as DOM clicks (el.click()) to prove that even a forced click writes nothing. Everything else is the original.
// Skeptic #2 for critic-kiosk-offers-edit-controls-4: does Tally offer live +/-/Reset to the kiosk (TV) profile?
//   1. TV shell: #tally deep link -> is Tally opened? any tile/link to Tally on the TV board?
//   2. apps/tally.html opened directly as 'tv' on the tv device: button disabled/aria-disabled/hidden state, hub.canWrite,
//      then tap +, -, Reset -> dial text, toast, POSTs to /api/data/, server row for tv.
// Run: node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-2.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p6/11/p3copies';
const NAME = 'verify-critic-kiosk-offers-edit-controls-4-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  await d.goto('#tally'); await sleep(2500);
  res.shell = await d.page.evaluate(() => ({
    hash: location.hash,
    tallyIframe: [...document.querySelectorAll('iframe')].some(i => (i.src || '').includes('tally')),
    tallyLinks: [...document.querySelectorAll('[data-id="tally"], a[href*="tally"]')].length,
    toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; })(),
  }));
  console.log('shell', JSON.stringify(res.shell));
  const posts = []; d.page.on('request', r => { if (['POST', 'PUT', 'DELETE'].includes(r.method()) && r.url().includes('/api/data')) posts.push(r.method() + ' ' + r.url()); });
  await d.page.goto(L.site + '/apps/tally.html');
  await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
  res.standalone = await d.page.evaluate(() => {
    const b = id => { const e = document.getElementById(id), cs = getComputedStyle(e), r = e.getBoundingClientRect();
      return { disabled: e.disabled, ariaDisabled: e.getAttribute('aria-disabled'), hidden: e.hidden, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, pointerEvents: cs.pointerEvents, cursor: cs.cursor, w: Math.round(r.width), h: Math.round(r.height) }; };
    return { canWrite: hub.canWrite, kind: hub.profile.kind, who: document.getElementById('who').textContent, dial: document.getElementById('n').textContent,
      plus: b('plus'), minus: b('minus'), reset: b('reset'), viewOnlyHint: /only looks|view only|read.only/i.test(document.body.innerText) };
  });
  console.log('standalone', JSON.stringify(res.standalone));
  await d.page.screenshot({ path: `${OUT}/${NAME}-tv-before.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  const taps = [];
  for (const id of ['plus', 'minus', 'reset']) {
    await d.page.locator('#' + id).evaluate(e => e.click()); await sleep(300);
    taps.push(await d.page.evaluate(id => ({ id, dial: document.getElementById('n').textContent, toast: (() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; })() }), id));
    await sleep(2700);
  }
  res.taps = taps; console.log('taps', JSON.stringify(taps));
  await d.page.locator('#plus').evaluate(e => e.click()); await sleep(300);
  await d.page.screenshot({ path: `${OUT}/${NAME}-tv-after-tap.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  await sleep(1500);
  res.posts = posts;
  const r = await L.apiAs('tv', '/api/data/tally?scope=person');
  res.serverTv = { status: r.status, items: (r.body && r.body.items) || r.body };
  console.log('posts', JSON.stringify(posts), 'serverTv', JSON.stringify(res.serverTv));
  await d.close();
} finally {
  fs.writeFileSync(`${OUT}/${NAME}.json`, JSON.stringify(res, null, 2));
  await L.close();
}
