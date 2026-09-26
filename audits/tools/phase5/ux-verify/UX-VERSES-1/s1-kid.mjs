// UX-VERSES-1, skeptic s1: what Ezra (kid) is given to practise in Verses on the Kitchen iPad (portrait).
// Records: the card, what Read aloud says (speechSynthesis stubbed), whether any verse text exists before/after Show,
// Ezra's own f260 person rows on the server, the family week, and which of the week's two refs Kid Verse has words for.
// Outputs only to audits/evidence/p5/ux-verify/UX-VERSES-1/s1/. Local rig only.
import fs from 'node:fs';
import path from 'node:path';
import { local, DEMO, sleep, ROOT } from '../../../lib/local.mjs';
const OUT = path.join(ROOT, 'audits/evidence/p5/ux-verify/UX-VERSES-1/s1');
fs.mkdirSync(OUT, { recursive: true });
const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  const d = await L.device({ device: 'ipad-portrait', profile: 'ezra', installClock: DEMO });
  await d.ctx.addInitScript(() => {
    window.__said = [];
    class U { constructor(t) { this.text = t; } }
    window.SpeechSynthesisUtterance = U;
    const ss = { speak(u) { window.__said.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }, cancel() {}, getVoices() { return []; }, addEventListener() {} };
    Object.defineProperty(window, 'speechSynthesis', { value: ss, configurable: true });
  });
  const f = await d.openApp('verses', { wait: '#trainer:not([hidden]), #done:not([hidden]), #empty:not([hidden])' });
  await sleep(400);
  const card = () => f.evaluate(() => ({ kind: document.documentElement.dataset.kind, ref: document.querySelector('#ref').textContent, kick: document.querySelector('#kick').textContent, hint: document.querySelector('#hint').textContent,
    textHidden: document.querySelector('#text').hidden, text: document.querySelector('#text').textContent, visibleButtons: [...document.querySelectorAll('#trainer button')].filter(b => b.offsetParent).map(b => b.textContent.trim()) }));
  out.before = await card();
  await f.click('#say'); await sleep(200);
  out.said = await f.evaluate(() => window.__said.slice());
  await f.click('#show'); await sleep(200);
  out.after = await card();
  await d.shot(path.join(OUT, 'ezra-revealed-ipad-portrait.png'));
  const rows = await L.apiAs('ezra', '/api/data/f260?scope=person');
  out.ezraF260Keys = (rows.body.items || []).map(i => i.key);
  const fam = await L.apiAs('eli', '/api/data/kidverse?scope=family');
  const wk = (fam.body.items || []).find(i => i.key === 'week');
  out.familyWeek = wk ? wk.value : null;
  // Kid Verse words: which refs of each week have a paraphrase (apps/kidverse.html VERSES[].p picks one of the two)
  const src = fs.readFileSync(path.join(ROOT, 'apps/kidverse.html'), 'utf8');
  const rx = /\{ w: (\d+),\s*refs: \['([^']+)', '([^']+)'\], p: ([01]), words: /g; let m; const kv = [];
  while ((m = rx.exec(src))) kv.push({ w: +m[1], refs: [m[2], m[3]], p: +m[4] });
  out.kidverseWeeksWithWords = kv.length;
  out.kidverseWordsPerWeek = 1;
  const w = typeof out.familyWeek === 'object' && out.familyWeek ? out.familyWeek.week : out.familyWeek;
  out.kidverseThisWeek = kv.find(x => x.w === Number(w)) || null;
  out.logs = d.logs.filter(l => /error/i.test(l)).slice(0, 10);
  await d.close();
} finally { await L.close(); }
fs.writeFileSync(path.join(OUT, 'kid.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
