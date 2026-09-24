// KV: read-aloud (speechSynthesis). The rig has no real voices, so a stand-in speechSynthesis records every utterance
// (text, rate, voice, lang) and ends it after 2 s; cancel() ends the current one with an 'interrupted' error, as browsers do.
//   node "audits/tools/phase3/kidverse/speech.mjs"
// S1 verse "Read it to me": the text spoken, rate, voice; the button while speaking; a second tap stops it.
// S2 story "Read it to me" while the verse is speaking: does the verse button reset? both buttons' labels.
// S3 Escape stops speech. S4 every one of the 52 references goes through sayRef's pattern (static check of the same regex).
// S5 no speechSynthesis at all: the toast.
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep, log, saveJson, pulled, ROOT } from './_kv.mjs';

const STUB = () => {
  const rec = window.__spoken = [];
  let cur = null, timer = null;
  const fire = (u, type) => { const e = new Event(type); if (type === 'error') e.error = 'interrupted'; try { (type === 'end' ? u.onend : u.onerror) && (type === 'end' ? u.onend(e) : u.onerror(e)); } catch {} };
  class U { constructor(t) { this.text = t; this.rate = 1; this.pitch = 1; this.lang = ''; this.voice = null; } }
  const synth = {
    speaking: false,
    getVoices: () => [{ name: 'Daniel', lang: 'en-GB' }, { name: 'Samantha', lang: 'en-US' }, { name: 'Thomas', lang: 'fr-FR' }],
    speak(u) { rec.push({ text: u.text, rate: u.rate, pitch: u.pitch, lang: u.lang, voice: u.voice && u.voice.name, at: Date.now() }); cur = u; synth.speaking = true; clearTimeout(timer); timer = setTimeout(() => { synth.speaking = false; cur = null; fire(u, 'end'); }, 2000); },
    cancel() { clearTimeout(timer); if (cur) { const u = cur; cur = null; synth.speaking = false; fire(u, 'error'); } },
    addEventListener() {}, removeEventListener() {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = U;
};

const out = {};
const L = await local({ variant: 'typical', clock: 'real' });
try {
  // native availability in rig WebKit (no stub)
  const n = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  const fn = await n.openApp('kidverse', { wait: '#say' }); await pulled(fn);
  out.native = await fn.evaluate(() => ({ speechSynthesis: 'speechSynthesis' in window, utterance: 'SpeechSynthesisUtterance' in window, voices: (() => { try { return speechSynthesis.getVoices().length; } catch { return null; } })() }));
  await n.close();

  const d = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  await d.ctx.addInitScript(STUB);
  const f = await d.openApp('kidverse', { wait: '#say' }); await pulled(f); await sleep(1200);
  const labels = () => f.evaluate(() => ({ say: document.querySelector('#say span').textContent, sayOn: document.querySelector('#say').classList.contains('on'), story: document.querySelector('#story-say span').textContent, storyOn: document.querySelector('#story-say').classList.contains('on') }));
  await f.click('#say'); await sleep(300);
  out.S1_speaking = await labels();
  await f.click('#say'); await sleep(300);
  out.S1_afterSecondTap = await labels();
  await f.click('#say'); await sleep(300);
  await f.click('#story-say'); await sleep(300);
  out.S2_bothTapped = await labels();
  await sleep(2300);
  out.S2_afterEnd = await labels();
  await f.click('#story-say'); await sleep(300);
  await f.press('body', 'Escape'); await sleep(300);
  out.S3_afterEscape = await labels();
  out.spoken = await f.evaluate(() => window.__spoken);
  await d.close();

  // S5 — no speech at all
  const e = await L.device({ device: 'iphone-pwa', profile: 'ezra', fixedTime: false });
  await e.ctx.addInitScript(() => { try { delete window.speechSynthesis; Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true }); } catch {} });
  const fe = await e.openApp('kidverse', { wait: '#say' }); await pulled(fe); await sleep(800);
  await fe.evaluate(() => { window.__toasts = []; const o = hub.toast; hub.toast = (m, ms) => { window.__toasts.push(String(m)); return o.call(hub, m, ms); }; });
  await fe.click('#say'); await sleep(300);
  out.S5 = { toasts: await fe.evaluate(() => window.__toasts), canSpeakProbe: await fe.evaluate(() => 'speechSynthesis' in window) };
  await e.close();
} finally { await L.close(); }

// S4 — the 52 references through sayRef's own pattern (apps/kidverse.html:293)
const src = fs.readFileSync(path.join(ROOT, 'apps', 'kidverse.html'), 'utf8');
const refs = [...src.matchAll(/\{ w: (\d+),\s+refs: \['([^']+)', '([^']+)'\], p: (\d)/g)].map(m => ({ w: +m[1], refs: [m[2], m[3]], p: +m[4] }));
const RE = /^(\d\s)?([A-Za-z ]+?)\s+(\d+):(\d+)(?:-(\d+))?[a-z]?$/;
const ORD = { 1: 'First', 2: 'Second', 3: 'Third' };
const sayRef = ref => { const m = String(ref).match(RE); if (!m) return null; const book = (m[1] ? ORD[m[1].trim()] + ' ' : '') + m[2].trim(); const verses = m[5] ? `verses ${m[4]} to ${m[5]}` : `verse ${m[4]}`; return /^Psalms?$/i.test(m[2].trim()) ? `Psalm ${m[3]}, ${verses}` : `${book}, chapter ${m[3]}, ${verses}`; };
out.S4 = { count: refs.length, spokenRefFails: refs.filter(r => !sayRef(r.refs[r.p])).map(r => r.refs[r.p]), samples: [1, 16, 18, 23, 51].map(w => { const r = refs.find(x => x.w === w); return r.refs[r.p] + ' → ' + sayRef(r.refs[r.p]); }) };

log('native speechSynthesis in rig WebKit', JSON.stringify(out.native));
log('S1 speaking', JSON.stringify(out.S1_speaking), '| second tap', JSON.stringify(out.S1_afterSecondTap));
log('S2 story tapped while verse speaks', JSON.stringify(out.S2_bothTapped), '| after end', JSON.stringify(out.S2_afterEnd));
log('S3 Escape', JSON.stringify(out.S3_afterEscape));
log('spoken', JSON.stringify(out.spoken.map(s => ({ text: s.text.slice(0, 110), rate: s.rate, voice: s.voice, lang: s.lang }))));
log('S4 refs', JSON.stringify(out.S4));
log('S5 no speech', JSON.stringify(out.S5));
saveJson('speech.json', out);
