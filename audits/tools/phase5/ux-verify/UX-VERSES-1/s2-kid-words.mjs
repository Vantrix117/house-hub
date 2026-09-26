// s2 (UX-VERSES-1): as Ezra on the Kitchen iPad (portrait): what Verses reads aloud and reveals, and what Kid Verse reads for
// the same family week. speechSynthesis is stubbed to record utterances (the rig has no voice). Outputs only to my folder.
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../../lib/local.mjs';
const OUT = path.resolve('audits/evidence/p5/ux-verify/UX-VERSES-1/s2'); fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
  await d.ctx.addInitScript(() => {
    window.__said = [];
    class U { constructor(t) { this.text = t; } }
    window.SpeechSynthesisUtterance = U;
    const ss = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 50); }, cancel() {}, getVoices() { return []; }, addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
  });
  const f = await d.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])', { timeout: 12000 }).catch(() => {});
  await sleep(400);
  const st = () => f.evaluate(() => ({ ref: document.querySelector('#ref').textContent, kick: document.querySelector('#kick').textContent, hint: document.querySelector('#hint').textContent,
    textHidden: document.querySelector('#text').hidden, textLen: document.querySelector('#text').textContent.length,
    visibleText: document.querySelector('#trainer').innerText.replace(/\s+/g, ' ').trim(),
    f260verses: (() => { try { return Object.keys(hub.get('f260.verses', { app: 'f260', scope: 'person' }) || {}); } catch (e) { return String(e); } })(), isKid: hub.isKid }));
  out.before = await st();
  await f.click('#say'); await sleep(250);
  out.saidBefore = await f.evaluate(() => window.__said.slice());
  await f.click('#show'); await sleep(250);
  out.after = await st();
  out.sayVisibleAfterShow = await f.locator('#say').isVisible();
  await d.page.screenshot({ path: path.join(OUT, 'verses-ezra-ipad-after-show.png'), scale: 'css', animations: 'disabled' });
  out.serverEzraF260 = (await L.apiAs('ezra', '/api/data/f260?scope=person')).body.items?.map(i => i.key);
  // Kid Verse for the same week
  const k = await d.openApp('kidverse');
  await sleep(1500);
  out.kidverse = await k.evaluate(() => ({ words: document.querySelector('#words') && document.querySelector('#words').textContent, sayLabel: document.querySelector('#say') && document.querySelector('#say').getAttribute('aria-label') }));
  await k.click('#say').catch(e => out.kidverseClickErr = String(e)); await sleep(300);
  out.kidverseSaid = await k.evaluate(() => (window.__said || []).slice());
  await d.page.screenshot({ path: path.join(OUT, 'kidverse-ezra-ipad.png'), scale: 'css', animations: 'disabled' });
  await d.close();
  fs.writeFileSync(path.join(OUT, 'kid-words.json'), JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
} finally { await L.close(); }
