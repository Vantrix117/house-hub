// Skeptic #1 for "critic-kiosk-offers-edit-controls-4": on the TV (kiosk profile) Tally shows live +, − and Reset.
// Checks: (1) shell #tally deep link and Apps grid for the kiosk; (2) apps/tally.html opened directly as 'tv':
// hub.canWrite, each button's disabled / aria-disabled / pointer-events / opacity, pill text, then taps all three
// buttons and records toast, data POST/PUT/DELETE requests and the server row.
// Run: node "audits/tools/phase3/tally/verify-critic-kiosk-offers-edit-controls-4-1.mjs"
import fs from 'node:fs';
import { local, sleep } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/tally';
const P = `${OUT}/verify-critic-kiosk-offers-edit-controls-4-1`;
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const res = {};
try {
  const d = await L.device({ device: 'tv', profile: 'tv', fixedTime: false });
  const writes = []; d.page.on('request', r => { if (r.method() !== 'GET' && r.url().includes('/api/')) writes.push(r.method() + ' ' + r.url().replace(/^https?:\/\/[^/]+/, '')); });
  await d.goto('#tally'); await sleep(2500);
  res.shell = await d.page.evaluate(() => ({ hash: location.hash, tallyIframe: !![...document.querySelectorAll('iframe')].find(i => (i.src || '').includes('tally')), tallyTiles: document.querySelectorAll('.tile[data-id="tally"]').length }));
  await d.page.goto(L.site + '/apps/tally.html');
  await d.page.waitForFunction(() => document.getElementById('who').textContent.trim().length > 0, null, { timeout: 9000 });
  await sleep(800);
  const state = () => d.page.evaluate(() => ({
    canWrite: hub.canWrite, kind: hub.profile && hub.profile.kind, who: document.getElementById('who').textContent, n: document.getElementById('n').textContent,
    buttons: ['minus', 'plus', 'reset'].map(id => { const b = document.getElementById(id), cs = getComputedStyle(b), r = b.getBoundingClientRect();
      return { id, disabled: b.disabled, ariaDisabled: b.getAttribute('aria-disabled'), hidden: b.hidden, display: cs.display, visibility: cs.visibility, opacity: cs.opacity, pointerEvents: cs.pointerEvents, cursor: cs.cursor, w: Math.round(r.width), h: Math.round(r.height) }; }),
    anyViewOnlyText: /view.only|only looks|read.only/i.test(document.body.innerText) }));
  res.before = await state();
  await d.page.screenshot({ path: `${P}-tv-before.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
  res.taps = [];
  for (const id of ['plus', 'minus', 'reset']) {
    await d.page.locator('#' + id).click(); await sleep(300);
    const t = await d.page.evaluate(() => { const t = document.getElementById('hub-toast'); return t && !t.hidden ? t.textContent : null; });
    res.taps.push({ id, toast: t, n: await d.page.evaluate(() => document.getElementById('n').textContent) });
    if (id === 'plus') await d.page.screenshot({ path: `${P}-tv-after-plus.png`, scale: 'css', animations: 'disabled', caret: 'hide' });
    await sleep(2700); // kioskNudge throttles to one toast per 2.5 s
  }
  await sleep(1500);
  res.writes = writes;
  const r = await L.apiAs('tv', '/api/data/tally?scope=person');
  res.serverTv = { status: r.status, items: (r.body && r.body.items) || r.body };
  res.after = await state();
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(`${P}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1));
