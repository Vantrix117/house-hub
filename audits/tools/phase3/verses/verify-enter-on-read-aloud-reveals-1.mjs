// Skeptic #1 for "enter-on-read-aloud-reveals": with keyboard focus on "Read aloud" (#say), does Enter / Space reveal
// the card instead of reading? Control: a mouse click on #say must read (speechSynthesis.speak called) and not reveal.
// A counting speechSynthesis.speak is installed before load (addInitScript) so canSpeak (apps/verses.html:248) is true
// and every call is counted; the stub fires onend so `speaking` resets. Both engines.
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/verses');
fs.mkdirSync(EVID, { recursive: true });
const INIT = () => {
  window.__spoke = 0; window.__spokeText = [];
  const fake = { speak(u) { window.__spoke++; window.__spokeText.push(u && u.text); setTimeout(() => { try { u.onend && u.onend(); } catch {} }, 20); },
    cancel() {}, getVoices() { return []; }, addEventListener() {}, removeEventListener() {} };
  try { if (!('speechSynthesis' in window)) Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true });
        else { window.speechSynthesis.speak = fake.speak; window.speechSynthesis.cancel = () => {}; } } catch {}
  try { if (!('SpeechSynthesisUtterance' in window)) window.SpeechSynthesisUtterance = function (t) { this.text = t; }; } catch {}
};
const st = f => f.evaluate(() => ({ revealed: !document.getElementById('act-rate').hidden, showVisible: !document.getElementById('act-show').hidden,
  spoke: window.__spoke, spokeText: window.__spokeText, focused: document.activeElement && document.activeElement.id, trainer: !document.getElementById('trainer').hidden }));
const out = {};
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const r = out[engine] = {};
  try {
    const run = async (label, act) => {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
      await d.ctx.addInitScript(INIT);
      const f = await d.openApp('verses');
      await f.waitForSelector('#trainer:not([hidden])', { timeout: 12000 });
      await sleep(400);
      const before = await st(f);
      await act(d, f); await sleep(400);
      const after = await st(f);
      r[label] = { before: { revealed: before.revealed, spoke: before.spoke, trainer: before.trainer }, after };
      if (label === 'enterOnSay') await d.page.screenshot({ path: path.join(EVID, `verify-enter-on-read-aloud-reveals-1-${engine}.png`), scale: 'css' });
      await d.close();
    };
    await run('clickSay', async (d, f) => { await f.click('#say'); });
    await run('enterOnSay', async (d, f) => { await f.focus('#say'); r.enterOnSayFocusBefore = await f.evaluate(() => document.activeElement && document.activeElement.id); await d.page.keyboard.press('Enter'); });
    await run('spaceOnSay', async (d, f) => { await f.focus('#say'); await d.page.keyboard.press(' '); });
    await run('enterOnShow', async (d, f) => { await f.focus('#show'); await d.page.keyboard.press('Enter'); });
  } finally { await L.close(); }
}
fs.writeFileSync(path.join(EVID, 'verify-enter-on-read-aloud-reveals-1.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
