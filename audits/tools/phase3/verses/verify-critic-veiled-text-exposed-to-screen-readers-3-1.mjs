// Skeptic #1: is the veiled (blurred) verse text in the accessibility tree before Show?
// apps/verses.html:44 (.veiled = filter blur only), :107 (<p class="text veiled" id="text">), :326 (render sets textContent, toggles .veiled; no aria-hidden/inert).
// Pass 1 WebKit iPhone PWA: Playwright ariaSnapshot of #trainer before/after Show.
// Pass 2 Chromium desktop: the ENGINE's own AX tree via CDP Accessibility.getFullAXTree on the app iframe, before Show.
// Eli, typical seed, demo clock. Batch writes aborted so the server stays at the seed.
// Run: node "audits/tools/phase3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1.mjs"
import fs from 'node:fs';
import { local, sleep, DEMO } from '../../lib/local.mjs';
const OUT = 'audits/evidence/p3/verses/verify-critic-veiled-text-exposed-to-screen-readers-3-1';
const out = {};
async function toTextCard(d) {
  await d.ctx.route(u => /\/api\/data\/[^/]+\/batch$/.test(u.pathname), r => r.abort('internetdisconnected'));
  const f = await d.openApp('verses');
  await f.waitForSelector('#trainer:not([hidden])', { timeout: 12000 }); await sleep(300);
  // advance until a card with text on file is shown (rate Got it on cards without text)
  for (let i = 0; i < 12; i++) {
    const has = await f.evaluate(() => !document.getElementById('text').hidden);
    if (has) break;
    await f.click('#show'); await f.waitForSelector('#act-rate:not([hidden])'); await f.click('[data-rate="got"]'); await sleep(600);
  }
  return f;
}
const elState = f => f.evaluate(() => { const e = document.getElementById('text'), cs = getComputedStyle(e);
  let a = e, anc = null; while (a) { if (a.getAttribute && (a.getAttribute('aria-hidden') === 'true' || a.inert || a.hidden)) { anc = a.id || a.tagName; break; } a = a.parentElement; }
  return { ref: document.getElementById('ref').textContent, hint: document.getElementById('hint').textContent, showVisible: !document.getElementById('act-show').hidden,
    hidden: e.hidden, veiled: e.classList.contains('veiled'), filter: cs.filter, display: cs.display, visibility: cs.visibility, ariaHidden: e.getAttribute('aria-hidden'), inert: e.inert, hiddenAncestor: anc, chars: e.textContent.length, head: e.textContent.slice(0, 30) }; });
// Pass 1: WebKit
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'webkit' });
  try {
    const d = await L.device({ device: 'iphone-pwa', profile: 'eli', installClock: DEMO });
    const f = await toTextCard(d);
    const s = await elState(f);
    const snap = await f.locator('#trainer').ariaSnapshot();
    out.webkit = { before: s, ariaSnapshot: snap, snapshotHasText: snap.includes(s.head.slice(0, 20)),
      textBeforeShowButton: snap.indexOf(s.head.slice(0, 20)) >= 0 && snap.indexOf(s.head.slice(0, 20)) < snap.indexOf('button "Show"') };
    await d.page.screenshot({ path: OUT + '-webkit.png', scale: 'css' });
    await f.click('#show'); await sleep(300);
    out.webkit.afterShow = await elState(f);
  } finally { await L.close(); }
}
// Pass 2: Chromium engine AX tree
{
  const L = await local({ variant: 'typical', clock: 'demo', engine: 'chromium' });
  try {
    const d = await L.device({ device: 'desktop', profile: 'eli', installClock: DEMO });
    const f = await toTextCard(d);
    const s = await elState(f);
    const cdp = await d.ctx.newCDPSession(d.page);
    const tree = (await cdp.send('Page.getFrameTree')).frameTree;
    const frames = []; (function walk(n) { frames.push(n.frame); (n.childFrames || []).forEach(walk); })(tree);
    const fr = frames.find(x => /verses\.html/.test(x.url));
    const ax = await cdp.send('Accessibility.getFullAXTree', { frameId: fr.id });
    const hits = ax.nodes.filter(n => !n.ignored && n.name && typeof n.name.value === 'string' && n.name.value.includes(s.head.slice(0, 20)))
      .map(n => ({ role: n.role && n.role.value, ignored: n.ignored, name: n.name.value.slice(0, 60) }));
    const ignoredHits = ax.nodes.filter(n => n.ignored && JSON.stringify(n).includes(s.head.slice(0, 20))).length;
    out.chromium = { frameUrl: fr.url, before: s, unignoredAxNodesWithText: hits, ignoredNodesWithText: ignoredHits };
  } finally { await L.close(); }
}
out.verdict = { webkitSnapshotExposes: out.webkit.snapshotHasText, chromiumEngineExposes: out.chromium.unignoredAxNodesWithText.length > 0 };
fs.writeFileSync(OUT + '.json', JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
