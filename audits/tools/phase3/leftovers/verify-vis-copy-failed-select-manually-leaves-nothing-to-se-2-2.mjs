// Skeptic 2: "Copy failed — select manually" leaves nothing to select (apps/leftovers.html:339-358).
// Makes both clipboard paths fail (async API rejects, execCommand returns false), taps #copy, and records what the
// user can see/select at 0.2 s and 2.3 s. Also runs a control with the real clipboard.
import { local, sleep, openLarder, save, shot } from './_lib.mjs';
const P = 'verify-vis-copy-failed-select-manually-leaves-nothing-to-se-2-2';
const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
const out = {};
try {
  for (const mode of ['control', 'failing']) {
    const d = await L.device({ device: 'iphone-safari', profile: 'eli', fixedTime: false });
    if (mode === 'failing') await d.ctx.addInitScript(() => {
      try { Object.defineProperty(Navigator.prototype, 'clipboard', { configurable: true, get: () => ({ writeText: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) }) }); } catch (e) {}
      try { Document.prototype.execCommand = function () { return false; }; } catch (e) {}
    });
    await d.goto('#home');
    const f = await openLarder(d);
    await f.evaluate(() => document.getElementById('copy').scrollIntoView({ block: 'center' }));
    const before = await f.evaluate(() => document.getElementById('copy').textContent);
    await f.locator('#copy').click();
    await sleep(200);
    const probe = () => f.evaluate(() => ({
      label: document.getElementById('copy').textContent,
      textareas: document.querySelectorAll('textarea').length,
      anyElementWithHearthText: /Push these to the Hearth Calendar|Nothing aging right now/.test(document.body.innerText),
      selection: String(getSelection()),
      hint: document.querySelector('.hearth p').textContent.trim().replace(/\s+/g, ' '),
    }));
    const at200 = await probe();
    if (mode === 'failing') await shot(d.page, P + '-failed.png');
    await sleep(2100);
    const at2300 = await probe();
    out[mode] = { before, at200, at2300 };
    console.log(mode, JSON.stringify(out[mode], null, 1));
    await d.page.close().catch(() => {});
  }
  console.log('saved', save(P + '.json', out));
} finally { await L.close(); }
