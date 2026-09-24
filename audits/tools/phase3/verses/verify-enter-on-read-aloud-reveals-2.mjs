// Skeptic #2 for "enter-on-read-aloud-reveals": with keyboard focus on "Read aloud" (#say), does Enter/Space read the
// reference aloud (the button's click -> speak(), apps/verses.html:363) or reveal the answer (the document keydown handler,
// apps/verses.html:373-378: preventDefault + revealed = true)? WebKit and Chromium, a fresh device per trial.
// Controls: a mouse click on #say; Enter on a probe button whose keydown never reaches the document handler (the engine
// does activate a focused button on Enter). speechSynthesis.speak is stubbed to count; #say clicks are counted too
// (Playwright WebKit on Windows has no speechSynthesis, so there the click can only toast).
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep } from '../../lib/local.mjs';
const EVID = path.resolve('audits/evidence/p3/verses');
const out = { script: 'audits/tools/phase3/verses/verify-enter-on-read-aloud-reveals-2.mjs' };
const VIEW = '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])';
const arm = f => f.evaluate(() => {
  window.__spoke = 0; window.__spokeText = null; window.__sayClicks = 0; window.__keydownPrevented = null;
  try { if (window.speechSynthesis) speechSynthesis.speak = u => { window.__spoke++; window.__spokeText = u.text; }; } catch {}
  document.getElementById('say').addEventListener('click', () => window.__sayClicks++, true);
  window.addEventListener('keydown', e => { setTimeout(() => { window.__keydownPrevented = e.defaultPrevented; }, 0); }, true);
});
const read = f => f.evaluate(() => ({
  canSpeak: 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window,
  revealed: !document.getElementById('act-rate').hidden, sayVisible: !!document.getElementById('say').offsetParent,
  sayClicks: window.__sayClicks, spoke: window.__spoke, spokeText: window.__spokeText, keydownPrevented: window.__keydownPrevented,
  focused: document.activeElement ? (document.activeElement.id || document.activeElement.tagName) : null,
  hint: document.getElementById('hint').textContent,
}));
for (const engine of ['webkit', 'chromium']) {
  const L = await local({ variant: 'typical', clock: 'demo', engine });
  const r = {};
  try {
    const trial = async (name, act) => {
      const d = await L.device({ device: 'ipad-portrait', profile: 'eli', installClock: DEMO });
      try {
        await d.goto('#home'); const f = await d.openApp('verses');
        await f.waitForSelector(VIEW, { timeout: 12000 }).catch(() => {}); await sleep(400); await arm(f);
        await act(f, d); await sleep(300);
        r[name] = await read(f);
        if (name === 'enterOnSay') await d.shot(path.join(EVID, `verify-enter-on-read-aloud-reveals-2-${engine}.png`));
      } catch (e) { r[name] = { error: String(e && e.message || e).slice(0, 300) }; }
      finally { await d.close(); }
    };
    await trial('clickSay', f => f.click('#say'));
    await trial('enterOnSay', async (f, d) => { await f.focus('#say'); await d.page.keyboard.press('Enter'); });
    await trial('spaceOnSay', async (f, d) => { await f.focus('#say'); await d.page.keyboard.press(' '); });
    await trial('enterOnShow', async (f, d) => { await f.focus('#show'); await d.page.keyboard.press('Enter'); });
    await trial('probeEnter', async (f, d) => {
      await f.evaluate(() => { const b = document.createElement('button'); b.id = 'probe'; b.textContent = 'probe'; window.__pc = 0; b.onclick = () => window.__pc++; b.addEventListener('keydown', e => e.stopPropagation()); document.body.appendChild(b); b.focus(); });
      await d.page.keyboard.press('Enter'); await sleep(200);
      r.probeClicks = await f.evaluate(() => window.__pc);
    });
  } catch (e) { r.error = String(e && e.stack || e); }
  finally { await L.close(); }
  out[engine] = r;
  console.log(engine, JSON.stringify(r, null, 1));
}
fs.writeFileSync(path.join(EVID, 'verify-enter-on-read-aloud-reveals-2.json'), JSON.stringify(out, null, 1));
console.log('wrote audits/evidence/p3/verses/verify-enter-on-read-aloud-reveals-2.json');
