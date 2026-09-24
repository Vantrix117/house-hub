// Skeptic #1 for CHAT finding "kiosk-hashchange-chat": on the TV (kiosk profile) a later hashchange to #chat runs
// showTab('chat') (index.html:650-653), which un-hides #chat-form for any profile (index.html:636). Independent re-run on a
// fresh local instance, measuring what is actually painted (elementFromPoint), not only the hidden flag.
//   node "audits/tools/phase2/CHAT/verify-kiosk-hashchange-chat-1.mjs"            (WebKit, the default)
//   node "audits/tools/phase2/CHAT/verify-kiosk-hashchange-chat-1.mjs" chromium   (the installed Chrome)
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID } from './lib.mjs';

const ENGINE = process.argv[2] === 'chromium' ? 'chromium' : 'webkit';
const SUF = ENGINE === 'webkit' ? '' : '-chromium';
const L = await local({ variant: 'typical', clock: 'demo', engine: ENGINE });
const out = { engine: ENGINE };
const shot = async (d, name) => { name = name.replace('.png', SUF + '.png'); const f = path.join(EVID, name); await d.page.screenshot({ path: f, scale: 'css', animations: 'disabled', caret: 'hide' }); return 'audits/evidence/p2/CHAT/' + name; };
try {
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  const state = () => tv.page.evaluate(() => {
    const f = document.querySelector('#chat-form'); const r = f.getBoundingClientRect();
    const on = [...document.querySelectorAll('.view.on')].map(v => v.id);
    const disp = id => getComputedStyle(document.getElementById(id)).display;
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const hit = r.width ? document.elementFromPoint(cx, cy) : null;
    const views = document.querySelector('#views');
    return {
      hash: location.hash, kind: document.documentElement.dataset.kind, tabAttr: document.documentElement.dataset.tab,
      formHidden: f.hidden, formRect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      viewsOn: on, homeDisplay: disp('view-home'), chatDisplay: disp('view-chat'),
      hitAtFormCentre: hit ? (hit.id || hit.tagName + '.' + hit.className) : null, hitInsideForm: !!(hit && f.contains(hit)),
      tvBoardRendered: !!document.querySelector('#tv') && document.querySelector('#tv').getBoundingClientRect().height > 0,
      chatTitleVisible: document.querySelector('#view-chat .view-title').getBoundingClientRect().height > 0,
      viewsScrollTop: views.scrollTop, viewsScrollHeight: views.scrollHeight,
      chatLogHtmlLen: document.querySelector('#chat-log').innerHTML.length,
    };
  });

  // 1. load straight onto #chat — the kiosk must land on Home
  await tv.goto('#chat'); await sleep(2500);
  out.a_loadWithHashChat = await state();
  out.a_shot = await shot(tv, 'verify-kiosk-hashchange-1-load-tv-light.png');

  // 2. a single later hashchange (#home -> #chat), as a URL edit / Back-Forward would produce
  await tv.page.evaluate(() => { location.hash = '#chat'; }); await sleep(1500);
  out.b_afterHashchange = await state();
  out.b_shot = await shot(tv, 'verify-kiosk-hashchange-1-after-hashchange-tv-light.png');

  // 3. type + send: what does the server say and what is painted
  let status = null, body = null;
  tv.page.on('response', async r => { if (r.url().endsWith('/api/chat')) { status = r.status(); body = await r.text().catch(() => null); } });
  if (!out.b_afterHashchange.formHidden) {
    await tv.page.fill('#chat-in', 'hello from the tv');
    await tv.page.press('#chat-in', 'Enter');
    await sleep(2000);
  }
  out.c_post = { status, body };
  out.c_after = await state();
  out.c_errBubble = await tv.page.evaluate(() => {
    const e = document.querySelector('#chat-log .msg.err'); if (!e) return null;
    const r = e.getBoundingClientRect(); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    return { text: e.innerText, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], hit: hit ? (hit.id || hit.tagName + '.' + hit.className) : null, painted: !!(hit && (hit === e || e.contains(hit) || hit.contains(e))) };
  });
  out.c_userBubbles = await tv.page.evaluate(() => [...document.querySelectorAll('#chat-log .mrow.user .msg')].map(m => m.innerText));
  out.c_shot = await shot(tv, 'verify-kiosk-hashchange-1-after-send-tv-light.png');

  // 3b. why is the bubble not seen? the kiosk's #view-home stays displayed (index.html:129 display:grid beats .view{display:none}),
  //     and #tv (position:relative; z-index:1) holds the position:fixed .tv-bg (inset:0, pointer-events:none) over #view-chat.
  out.c_layers = await tv.page.evaluate(() => {
    const cs = s => { const e = document.querySelector(s); if (!e) return null; const c = getComputedStyle(e); const r = e.getBoundingClientRect(); return { position: c.position, zIndex: c.zIndex, display: c.display, pointerEvents: c.pointerEvents, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] }; };
    return { viewHome: cs('#view-home'), tv: cs('#tv'), tvBg: cs('.tv-bg'), viewChat: cs('#view-chat'), chatForm: cs('#chat-form') };
  });
  // diagnostic only (page-side style, no app file touched): drop the backdrop and re-shoot — the chat view was there all along
  await tv.page.addStyleTag({ content: '.tv-bg{display:none !important}' }); await sleep(300);
  out.c_shot_bgHidden = await shot(tv, 'verify-kiosk-hashchange-1-after-send-bg-hidden-tv-light.png');

  // 4. does a server-side write happen? (kiosk must not have chat rows)
  out.d_serverHistoryAsTv = await L.apiAs('tv', '/api/chat/history');
  out.logs = tv.logs.filter(l => !/favicon/.test(l)).slice(0, 20);

  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, 'verify-kiosk-hashchange-chat-1' + SUF + '.json'), JSON.stringify(out, null, 1));
  console.log('evidence: audits/evidence/p2/CHAT/verify-kiosk-hashchange-chat-1' + SUF + '.json');
} finally { await L.close(); }
