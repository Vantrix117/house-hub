// Skeptic #1 for "vis-copy-failed-select-manually-leaves-nothing-to-se-2": when both clipboard paths fail, does the
// Larder's "Copy failed — select manually" leave any Hearth text on screen for the user to select?
// Independent of areas/leftovers.mjs: own stub, own probes (every textarea/pre/selection/visible text after the tap).
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
const EV = path.resolve('audits/evidence/p3/leftovers');
const P = 'verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-1';
fs.mkdirSync(EV, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
try {
  const d = await L.device({ device: 'iphone-safari', profile: 'eli', fixedTime: false });
  await d.ctx.addInitScript(() => {
    window.__copyCalls = { writeText: 0, exec: 0, textareas: [] };
    try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText: () => { window.__copyCalls.writeText++; return Promise.reject(new DOMException('denied', 'NotAllowedError')); } }) }); } catch (e) {}
    const origAppend = Element.prototype.append;
    Element.prototype.append = function (...n) { for (const x of n) if (x && x.tagName === 'TEXTAREA') window.__copyCalls.textareas.push({ value: x.value, style: x.style.cssText }); return origAppend.apply(this, n); };
    try { Document.prototype.execCommand = function (c) { window.__copyCalls.exec++; return false; }; } catch (e) {}
  });
  await d.goto('#home'); await sleep(1500);
  const f = await d.openApp('leftovers');
  await f.waitForFunction(() => document.querySelectorAll('.item').length > 0, null, { timeout: 15000 });
  await f.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await sleep(300);
  const before = await f.evaluate(() => ({ label: document.getElementById('copy').textContent, hearthP: document.querySelector('.hearth p').textContent.replace(/\s+/g, ' ').trim() }));
  await f.locator('#copy').click();
  await f.waitForFunction(() => /failed|Copied/.test(document.getElementById('copy').textContent), null, { timeout: 2000 }).catch(() => {});
  const after = await f.evaluate(() => {
    const body = document.body.innerText;
    return {
      label: document.getElementById('copy').textContent,
      calls: window.__copyCalls,
      textareaCount: document.querySelectorAll('textarea').length,
      preOrOutput: document.querySelectorAll('pre, output, [contenteditable]').length,
      hearthTextVisible: /Push these to the Hearth Calendar/.test(body),
      bulletLinesVisible: (body.match(/logged \d+d ago/g) || []).length,
      selection: String(getSelection()),
      listIsAboveCopy: (() => { const l = document.getElementById('list'), c = document.getElementById('copy'); return !!(l.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING); })(),
    };
  });
  await d.page.screenshot({ path: path.join(EV, P + '-failed.png'), scale: 'css' });
  await sleep(2300);
  const reverted = await f.evaluate(() => ({ label: document.getElementById('copy').textContent, textareaCount: document.querySelectorAll('textarea').length }));
  const out = { device: 'iphone-safari', engine: 'webkit', profile: 'eli', before, after, afterPlus2300ms: reverted };
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EV, P + '.json'), JSON.stringify(out, null, 1));
} finally { await L.close(); }
