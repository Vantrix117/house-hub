// Skeptic #2 for finding "kiosk-hashchange-chat": on the TV kiosk, does a later hash change to #chat show a working
// composer over the board, and is the 403 reply out of sight? Independent of 08-kiosk-hash.mjs.
// The hash change is made the way a person would: a same-document navigation to …/index.html#chat (address bar edit),
// not a script assignment. Occlusion is measured with elementFromPoint, not just the bounding box.
//   node "audits/tools/phase2/CHAT/verify-kiosk-hashchange-chat-2.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { local, sleep } from '../../lib/local.mjs';
import { EVID } from './lib.mjs';

const L = await local({ variant: 'typical', clock: 'demo' });
const out = {};
try {
  await L.anthropicLog({ clear: true });
  const tv = await L.device({ device: 'tv', profile: 'tv' });
  const state = () => tv.page.evaluate(() => {
    const f = document.querySelector('#chat-form'); const r = f.getBoundingClientRect();
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = r.width ? document.elementFromPoint(cx, cy) : null;
    const vis = id => { const e = document.getElementById(id); return e ? getComputedStyle(e).display : null; };
    return {
      kind: document.documentElement.dataset.kind, tabAttr: document.documentElement.dataset.tab, hash: location.hash,
      formHidden: f.hidden, formRect: [r.x, r.y, r.width, r.height].map(Math.round),
      formOnTop: !!(top && f.contains(top)), inputDisabled: document.querySelector('#chat-in').disabled,
      display: { home: vis('view-home'), chat: vis('view-chat') }, chatLogChildren: document.querySelector('#chat-log').children.length,
      viewsScrollTop: Math.round(document.querySelector('#views').scrollTop),
    };
  });
  await tv.goto('#chat'); await sleep(2500);
  out.a_loadWithHashChat = await state();
  // the person edits the address bar: …#home → …#chat (same document, fires hashchange, pushes a history entry)
  await tv.page.goto(L.site + '/index.html#chat'); await sleep(1500);
  out.b_afterAddressBarHashChange = await state();
  await tv.page.screenshot({ path: path.join(EVID, 'verify-kiosk-hashchange-chat-2-composer-tv-light.png'), animations: 'disabled', caret: 'hide' });

  let post = null;
  tv.page.on('response', async r => { if (r.url().endsWith('/api/chat')) post = { status: r.status(), body: await r.text().catch(() => null) }; });
  if (!out.b_afterAddressBarHashChange.formHidden) {
    await tv.page.click('#chat-in'); await tv.page.keyboard.type('hello from the tv'); await tv.page.keyboard.press('Enter'); await sleep(2000);
  }
  out.c_post = post;
  out.c_upstreamLog = await L.anthropicLog();   // the scripted Anthropic stand-in: what the Worker sent upstream (expect nothing)
  out.c_errBubble = await tv.page.evaluate(() => {
    const e = document.querySelector('#chat-log .msg.err'); if (!e) return null;
    const r = e.getBoundingClientRect(); const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const inVp = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
    const top = inVp ? document.elementFromPoint(cx, cy) : null;
    const userMsg = document.querySelector('#chat-log .msg.user'); const ur = userMsg && userMsg.getBoundingClientRect();
    const utop = ur ? document.elementFromPoint(ur.x + ur.width / 2, ur.y + ur.height / 2) : null;
    const desc = el => el ? (el.id ? '#' + el.id : '') + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '') + ' <' + el.tagName.toLowerCase() + '>' : null;
    return { text: e.innerText, rect: [r.x, r.y, r.width, r.height].map(Math.round), inViewport: inVp,
      topElementAtCentre: desc(top), bubbleIsTopmost: !!(top && e.contains(top)),
      userBubbleTopmost: !!(utop && userMsg.contains(utop)), topElementAtUserBubble: desc(utop) };
  });
  // elementFromPoint skips pointer-events:none, and the board's fixed backdrop (.tv-bg, index.html:130) is exactly that.
  // Measurement only: let the backdrop take hit-tests for a moment to see what is PAINTED over the bubble, then restore.
  out.c_paintedOverBubble = await tv.page.evaluate(() => {
    const e = document.querySelector('#chat-log .msg.err'); const bg = document.querySelector('.tv-bg'); if (!e || !bg) return null;
    const r = e.getBoundingClientRect(); const was = bg.style.pointerEvents; bg.style.pointerEvents = 'auto';
    const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); bg.style.pointerEvents = was;
    const z = el => { const s = getComputedStyle(el); return { position: s.position, zIndex: s.zIndex }; };
    return { topElement: top && ((top.id ? '#' + top.id : '') + '.' + String(top.className).trim().split(/\s+/).join('.')), coveredByBoardBackdrop: !!(top && bg.contains(top)),
      tvStacking: z(document.querySelector('#tv')), tvBg: z(bg), chatView: z(document.querySelector('#view-chat')) };
  });
  out.c_afterSend = await state();
  await tv.page.screenshot({ path: path.join(EVID, 'verify-kiosk-hashchange-chat-2-after-send-tv-light.png'), animations: 'disabled', caret: 'hide' });

  // does the stray composer go away on its own? wait past a minute tick of the board, then try browser Back (a TV remote's Back key)
  await sleep(3000);
  out.d_later = await state();
  await tv.page.goBack(); await sleep(1200);
  out.e_afterBack = await state();
  await tv.page.goto(L.site + '/index.html#chat'); await sleep(800);
  out.e2_hashChatAgain = await state();
  await tv.page.reload(); await sleep(2500);
  out.f_afterReloadWithHashChat = await state();
  console.log(JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(EVID, 'verify-kiosk-hashchange-chat-2.json'), JSON.stringify(out, null, 1));
  console.log('evidence: audits/evidence/p2/CHAT/verify-kiosk-hashchange-chat-2.json');
} finally { await L.close(); }
