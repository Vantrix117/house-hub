// KV: does read-aloud stop when the kid leaves Kid Verse mid-sentence (the viewer's "Hub" back button, or Switch app)?
// A stand-in speechSynthesis (the rig has none) reports speak()/cancel() calls to the parent window.
//   node "audits/tools/phase3/kidverse/speech-leave.mjs"
import { local, sleep, log, saveJson, pulled } from './_kv.mjs';

const STUB = () => {
  if (window === window.top) { window.__speech = []; return; }
  const report = x => { try { window.top.__speech.push({ ...x, at: Date.now() }); } catch {} };
  let cur = null;
  class U { constructor(t) { this.text = t; } }
  const synth = { speaking: false, getVoices: () => [{ name: 'Samantha', lang: 'en-US' }],
    speak(u) { cur = u; synth.speaking = true; report({ call: 'speak', text: String(u.text).slice(0, 40) }); },
    cancel() { report({ call: 'cancel', hadUtterance: !!cur }); if (cur) { const u = cur; cur = null; synth.speaking = false; try { u.onerror && u.onerror(new Event('error')); } catch {} } },
    addEventListener() {}, removeEventListener() {} };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
  window.addEventListener('pagehide', () => report({ call: 'pagehide event' }));
};
const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  for (const how of ['back', 'home-tab-hash']) {
    const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
    await d.ctx.addInitScript(STUB);
    await d.goto('#home'); await sleep(800);
    await d.page.click('[data-open="kidverse"]'); await sleep(600);
    const f = d.frame('kidverse'); await pulled(f); await sleep(800);
    await f.evaluate(() => document.querySelector('#story-say').scrollIntoView({ block: 'center' }));
    await f.click('#story-say'); await sleep(400);
    if (how === 'back') { const back = await d.page.$('#pill-home'); out.backSelector = back ? await back.evaluate(e => e.outerHTML.slice(0, 120)) : null; if (back) await back.click(); }
    else await d.page.evaluate(() => { location.hash = '#home'; });
    await sleep(1500);
    out[how] = { calls: await d.page.evaluate(() => window.__speech), frameStillThere: !!d.frame('kidverse'), iframes: await d.page.evaluate(() => [...document.querySelectorAll('iframe')].map(i => ({ src: i.getAttribute('src'), visible: !!i.offsetParent }))) };
    await d.close();
  }
} finally { await L.close(); }
log('back selector', out.backSelector);
log('leave via back', JSON.stringify(out.back));
log('leave via #home', JSON.stringify(out['home-tab-hash']));
saveJson('speech-leave.json', out);
