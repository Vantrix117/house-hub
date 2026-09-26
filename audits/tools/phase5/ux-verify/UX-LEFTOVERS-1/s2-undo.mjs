// Skeptic s2, UX-LEFTOVERS-1: does one ✓ tap remove a family item with no confirm, no undo, no completed view,
// and what is left on the server (tombstone value) and in the feed to recover it from?
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-LEFTOVERS-1/s2');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  const d = await L.device({ device: 'iphone-pwa', profile: 'eli' });
  const dialogs = [];
  d.page.on('dialog', async dl => { dialogs.push(dl.type() + ': ' + dl.message()); await dl.dismiss(); });
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => window.__larder && document.getElementById('tally').textContent.length > 0);
  await sleep(1500);
  out.before = await f.$$eval('.item .nm', ns => ns.map(n => n.textContent));
  out.doneBox = await f.$eval('.done', b => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  out.completedUi = await f.evaluate(() => /completed|undo|restore|history|recently/i.test(document.body.innerText));
  const target = out.before[0];
  out.target = target;
  const serverBefore = (await L.apiAs('eli', '/api/data/leftovers?scope=family')).body;
  const rowsB = serverBefore.items || serverBefore.rows || serverBefore.data || [];
  const row = rowsB.find(r => r.value && r.value.name === target);
  out.targetKey = row && row.key;
  await d.shot(path.join(OUT, 'before-iphone.png'));
  await f.click(`.item:has(.nm:text-is("${target}")) .done`);
  await sleep(400);
  out.dialogs = dialogs;
  const probe = fr => fr.evaluate(() => ({
    text: document.body.innerText,
    toastish: [...document.querySelectorAll('[role=status],[role=alert],.toast,[class*=toast],[class*=snack]')].filter(e => e.offsetParent && e.textContent.trim()).map(e => e.textContent.trim().slice(0, 120)),
    undoButtons: [...document.querySelectorAll('button')].filter(b => /undo|restore|bring back/i.test(b.textContent + (b.getAttribute('aria-label') || ''))).length,
  }));
  const inApp = await probe(f); const inShell = await probe(d.page);
  out.afterTap400ms = { appToasts: inApp.toastish, shellToasts: inShell.toastish, undoButtonsApp: inApp.undoButtons, undoButtonsShell: inShell.undoButtons, appMentionsTarget: inApp.text.includes(target) };
  await d.shot(path.join(OUT, 'after-tap-400ms-iphone.png'));
  await sleep(3000);
  out.afterUi = await f.$$eval('.item .nm', ns => ns.map(n => n.textContent));
  const serverAfter = (await L.apiAs('eli', '/api/data/leftovers?scope=family')).body;
  const rowsA = serverAfter.items || serverAfter.rows || serverAfter.data || [];
  out.serverRowAfter = rowsA.find(r => r.key === out.targetKey) || 'absent from list response';
  const feed = (await L.apiAs('eli', '/api/activity?limit=3')).body;
  out.feedTop = (feed.activity || feed).slice(0, 2).map(a => ({ text: a.text, keys: Object.keys(a) }));
  // Re-logging as a workaround: is a past date accepted by the date box?
  out.dateBox = await f.$eval('#date', i => ({ min: i.min, max: i.max, value: i.value }));
  await d.shot(path.join(OUT, 'after-iphone.png'));
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, 'undo.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
