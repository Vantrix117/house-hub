// Batch 7, Worker C: IMP-KIDVERSE-I2, a parent's recorded voice, end to end in Chromium with a FAKE MICROPHONE
// (--use-fake-device-for-media-stream --use-fake-ui-for-media-stream) against the local Worker. Claims:
//   - the recorder card is for a household adult only (hidden for a kid, the TV, and where MediaRecorder is missing);
//   - Record -> Stop -> Play my take -> Save: the Worker holds one recording (family row voice:<week> = { id, by, byName, at,
//     mime, ms, bytes }), at most 1 MB / 90 s (a take that runs past 90 s is stopped at 1:30);
//   - a second device (a kid) hears it: "Read it to me" is labelled with the recorder's face and name, the audio is fetched
//     with the session header and played from a blob: URL, and the synthetic voice stays silent; it is not a public URL;
//   - where it cannot play (a decode error; offline) the synthetic voice reads instead, quietly (no toast);
//   - saving over one asks first, naming whose it replaces; Keep leaves it; Replace deletes the old bytes;
//   - Remove asks, deletes the recording and the kids are back on the synthetic voice;
//   - a refused microphone is a calm toast and leaves the card usable;
//   - the shelf (past weeks) plays a week's recording (Earlier weeks, when present);
//   - no console errors.
//   cd worker && npx wrangler dev --port 8794 --inspector-port 9794 --persist-to <fresh copy of the seeded D1>
//   HUB_API=http://127.0.0.1:8794 NODE_PATH="$LOCALAPPDATA/house-hub-audit/node_modules" node "audits/tools/phase6/7/voice-7.mjs" <pairing-code>
// D1_PERSIST (optional, the same --persist-to folder) also counts the stored recordings in the media table.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
const CODE = process.argv[2] || 'local-test-code';
const ELI_PIN = '1357';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const PORT = 8987;
const SITE = 'http://localhost:' + PORT;
const EV = path.join(ROOT, 'audits', 'evidence', 'p6', '7'); fs.mkdirSync(EV, { recursive: true });
const WEEK = 38;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/')) {                       // same-origin proxy: the Worker's CORS list only knows :8765
    const chunks = [];
    req.on('data', c => chunks.push(c)).on('end', () => {
      const headers = { ...req.headers }; delete headers.host; delete headers.origin; delete headers.referer;
      const up = http.request(API + req.url, { method: req.method, headers }, r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
      up.on('error', () => { res.writeHead(502); res.end('proxy error'); });
      up.end(Buffer.concat(chunks));
    });
    return;
  }
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(PORT);

let pass = 0, fail = 0; const out = {};
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓', n); } else { fail++; console.log('  ✗', n, x === undefined ? '' : JSON.stringify(x).slice(0, 600)); } out[n] = { pass: !!c, ...(x === undefined ? {} : { x }) }; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 15000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}

// ── the API, for seeding and for checking what the Worker holds ─────────
let DEVICE = null;
async function api(p, { method = 'GET', body, profile, raw = false } = {}) {
  const h = { 'Content-Type': 'application/json' };
  if (DEVICE) h['X-Device-Token'] = DEVICE;
  if (profile) h['X-Profile-Token'] = profile;
  const r = await fetch(API + p, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
  if (raw) return r;
  const j = await r.json().catch(() => ({}));
  if (!r.ok) { const e = new Error(j.message || r.statusText); e.status = r.status; e.error = j.error; throw e; }
  return j;
}
async function login(id, pin) {
  try { return (await api('/api/login', { method: 'POST', body: pin ? { profile_id: id, pin } : { profile_id: id } })).profile_token; }
  catch (e) { if (e.error === 'needs_pin_setup') return (await api(`/api/profiles/${id}/pin`, { method: 'POST', body: { pin } })).profile_token; throw e; }
}
let T = {};
const voiceRow = async () => (await api('/api/data/kidverse?scope=family&key=voice:' + WEEK, { profile: T.ezra })).item;
const voiceBytes = () => {
  if (!process.env.D1_PERSIST) return null;
  try {
    const o = execFileSync(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['wrangler', 'd1', 'execute', 'house-hub', '--local', '--persist-to', process.env.D1_PERSIST, '--json', '--command', `SELECT COUNT(*) AS n FROM media WHERE key LIKE 'voice/${WEEK}/%'`], { cwd: path.join(ROOT, 'worker'), encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'ignore'] });
    return JSON.parse(o.slice(o.indexOf('[')))[0].results[0].n;
  } catch { return null; }
};
async function seed() {
  DEVICE = (await api('/api/pair', { method: 'POST', body: { code: CODE, name: 'voice-7 seeder' } })).device_token;
  T = { eli: await login('eli', ELI_PIN), ezra: await login('ezra'), kiara: await login('kiara'), tv: await login('tv') };
  await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: WEEK, by: 'voice-7', at: Date.now() }, updated_at: Date.now() } });
  await api('/api/kidverse/voice/' + WEEK, { method: 'DELETE', profile: T.eli }).catch(() => {});   // a clean slate (404 when there is none)
}

// ── the browser ───────────────────────────────────────────────────────────
const errors = [];
async function newContext(browser, name, { width = 390, mic = true, init } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height: width < 700 ? 844 : 900 }, deviceScaleFactor: 1, hasTouch: width < 700, isMobile: width < 700, colorScheme: 'light', ...(mic ? { permissions: ['microphone'] } : {}) });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, SITE);
  // headless Chrome has no speakers: remember what the app asks speechSynthesis to say, and what Audio is asked to play
  await ctx.addInitScript(() => {
    window.__spoken = []; window.__plays = [];
    const real = window.speechSynthesis;
    const fake = {
      speak(u) { window.__spoken.push({ text: u.text, rate: u.rate }); setTimeout(() => { try { u.onend && u.onend({}); } catch {} }, 40); },
      cancel() {}, pause() {}, resume() {}, get speaking() { return false; }, get pending() { return false; },
      getVoices() { try { return real ? real.getVoices() : []; } catch { return []; } }, addEventListener() {}, removeEventListener() {},
    };
    try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch {}
    const p0 = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () { window.__plays.push({ blob: String(this.currentSrc || this.src || '').startsWith('blob:') }); return p0.apply(this, arguments); };
    // a way to run a take past 90 s without waiting 90 s: the page's performance.now() jumps forward
    const n0 = performance.now.bind(performance); let off = 0; performance.now = () => n0() + off; window.__jump = ms => { off += ms; };
  });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const seen = [];
  page.on('request', r => { if (/\/api\/kidverse\/voice\//.test(r.url())) seen.push({ method: r.method(), url: r.url().replace(/^https?:\/\/[^/]+/, ''), profile: !!r.headers()['x-profile-token'], device: !!r.headers()['x-device-token'] }); });
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_FAILED|net::/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page, seen, name };
}
async function signIn(page, id, pin) {
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) { await page.waitForSelector('#pad'); await sleep(450); for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); }
  await page.waitForSelector('#shell:not([hidden])', { timeout: 15000 });
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
// the app standalone (the session is the same origin's localStorage)
async function openKV(c) {
  await c.page.goto(SITE + '/apps/kidverse.html');
  await c.page.waitForFunction(() => window.kidverseVoice && window.hub && hub.sync && hub.sync.lastPull > 0 && document.getElementById('ref') && /\d/.test(document.getElementById('ref').textContent), null, { timeout: 20000 });
  await sleep(500);
}
const text = (p, sel) => p.$eval(sel, e => e.textContent.trim().replace(/\s+/g, ' ')).catch(() => null);
const vis = (p, sel) => p.$eval(sel, e => !e.hidden && e.getClientRects().length > 0).catch(() => false);
const toast = p => text(p, '#hub-toast');
const settle = p => p.evaluate(async () => { for (let i = 0; i < 20; i++) { try { await hub.flush(); await hub.pull(); } catch {} if (!hub.sync.pending) return true; await new Promise(r => setTimeout(r, 200)); } return false; });

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
  const ctxs = [];
  try {
    console.log('\n## seed'); await seed(); ok(!(await voiceRow()) || (await voiceRow()).value === null, 'week ' + WEEK + ' is the family week and has no recording yet');
    const src = fs.readFileSync(path.join(ROOT, 'apps/kidverse.html'), 'utf8');
    const styleBlock = src.slice(src.indexOf('<style id="kv-voice-style">'), src.indexOf('</style>', src.indexOf('<style id="kv-voice-style">')));
    ok(styleBlock.length > 100 && !/#[0-9a-f]{3,8}\b/i.test(styleBlock) && !/prefers-color-scheme/.test(styleBlock), 'the voice card\'s CSS block has no hex and no prefers-color-scheme');

    console.log('\n## who sees the recorder');
    const KID = await newContext(browser, 'kid'); ctxs.push(KID);
    await signIn(KID.page, 'ezra'); await openKV(KID);
    ok(!(await vis(KID.page, '#voice-panel')) && await KID.page.$eval('#voice-panel', e => e.innerHTML.trim() === ''), 'a kid has no recorder card');
    const NOMR = await newContext(browser, 'no-mediarecorder', { init: () => { try { delete window.MediaRecorder; } catch {} try { Object.defineProperty(window, 'MediaRecorder', { value: undefined, configurable: true }); } catch {} } }); ctxs.push(NOMR);
    await signIn(NOMR.page, 'eli', ELI_PIN); await openKV(NOMR);
    ok(!(await vis(NOMR.page, '#voice-panel')) && await NOMR.page.evaluate(() => window.kidverseVoice.canRecord === false), 'a grown-up where MediaRecorder is missing: the card stays hidden');
    const TVC = await newContext(browser, 'tv', { width: 1440 }); ctxs.push(TVC);
    await signIn(TVC.page, 'tv'); await openKV(TVC);
    ok(!(await vis(TVC.page, '#voice-panel')), 'the TV has no recorder card');
    ok(await TVC.page.evaluate(() => window.kidverseVoice.play(38)) === false, 'and its play() answers false at once (the TV does not play)');
    await TVC.ctx.close(); await NOMR.ctx.close();

    console.log('\n## a refused microphone is a calm toast');
    const DENY = await newContext(browser, 'mic-denied', { width: 1024, init: () => { navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError')); } }); ctxs.push(DENY);
    await signIn(DENY.page, 'eli', ELI_PIN); await openKV(DENY);
    await DENY.page.waitForSelector('#voice-record', { state: 'visible' });
    await DENY.page.click('#voice-record');
    await waitFor(() => toast(DENY.page).then(t => /microphone is off/i.test(t || '')), { label: 'the calm toast' });
    ok(true, 'a refused microphone: "' + await toast(DENY.page) + '"');
    ok(await vis(DENY.page, '#voice-record') && !(await vis(DENY.page, '#voice-stop')), 'and the card is still usable (Record shows, nothing is stuck recording)');
    await DENY.ctx.close();

    console.log('\n## Eli records the verse');
    const ELI = await newContext(browser, 'eli', { width: 1024 }); ctxs.push(ELI);
    await signIn(ELI.page, 'eli', ELI_PIN); await openKV(ELI);
    const P = ELI.page;
    await P.waitForSelector('#voice-panel:not([hidden]) #voice-record', { timeout: 15000 });
    ok(/Week 38/.test(await text(P, '.kvv-lead') || '') && /Record/.test(await text(P, '#voice-record') || ''), 'the card names the week and offers Record', await text(P, '.kvv-lead'));
    const first = await P.$eval('#voice-panel', e => { const g = document.getElementById('grown'); return !!g && !!(g.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING); });
    ok(first, 'it sits in the grown-ups\' area, after the kids\' stars and the week stepper');
    await P.click('#voice-record');
    await P.waitForSelector('#voice-stop', { timeout: 8000 });
    ok(await vis(P, '#voice-time') && /Recording/.test(await text(P, '#voice-status') || ''), 'Record starts: a running time and "Recording…"', await text(P, '#voice-status'));
    await sleep(2200);
    const t1 = await text(P, '#voice-time');
    ok(/^0:0[1-9]$/.test(t1 || ''), 'the clock counts the take (about 0:02)', t1);
    await P.click('#voice-stop');
    await P.waitForSelector('#voice-save', { timeout: 8000 });
    ok(/not saved yet/.test(await text(P, '.kvv-now') || '') && await vis(P, '#voice-take-play') && await vis(P, '#voice-redo'), 'Stop shows the take (not saved yet) with Play my take, Save and Record again', await text(P, '.kvv-now'));
    await P.click('#voice-take-play');
    await waitFor(() => P.evaluate(() => window.__plays.length >= 1), { label: 'the take plays' });
    ok(true, 'Play my take plays the take');
    await sleep(700); await P.screenshot({ path: path.join(EV, 'voice-take-1024.png') });
    await P.click('#voice-save');
    await waitFor(async () => { const r = await voiceRow(); return r && r.value && r.value.id; }, { label: 'the recording on the Worker' });
    const row1 = (await voiceRow()).value;
    ok(row1.by === 'eli' && row1.byName === 'Eli' && row1.mime === 'audio/webm' && row1.bytes > 500 && row1.bytes <= 1048576 && row1.ms >= 1500 && row1.ms <= 90000 && Object.keys(row1).sort().join() === 'at,by,byName,bytes,id,mime,ms', 'saved: one family row voice:38 = { id, by: eli, byName, at, mime: audio/webm, ms, bytes <= 1 MB }', row1);
    await waitFor(() => vis(P, '#voice-now'), { label: 'the saved recording on the card' });
    ok(/Eli’s voice/.test(await text(P, '#voice-now') || '') && /saved/.test(await text(P, '#voice-now') || '') && await vis(P, '#voice-remove') && await vis(P, '#voice-play'), 'the card now shows "Eli’s voice" with the recorder\'s face, Play and Remove', await text(P, '#voice-now'));
    ok(voiceBytes() === null || voiceBytes() === 1, 'one stored recording for the week', voiceBytes());
    await sleep(500); await P.screenshot({ path: path.join(EV, 'voice-saved-1024.png') });
    // it is family audio, never a public URL
    const pub = await fetch(API + '/api/media/voice/' + WEEK + '/' + row1.id); const noTok = await fetch(API + `/api/kidverse/voice/${WEEK}/${row1.id}`);
    ok(pub.status === 404 && noTok.status === 401, 'not public: /api/media/voice/… is 404 and the audio route without a session is 401', [pub.status, noTok.status]);
    const bytes1 = Buffer.from(await (await api(`/api/kidverse/voice/${WEEK}/${row1.id}`, { profile: T.ezra, raw: true })).arrayBuffer());
    ok(bytes1.length === row1.bytes && bytes1[0] === 0x1a && bytes1[1] === 0x45 && bytes1[2] === 0xdf && bytes1[3] === 0xa3, 'a signed-in kid fetches the exact recorded bytes (a webm)', { n: bytes1.length });
    await P.click('#voice-play');
    await waitFor(() => P.evaluate(() => window.kidverseVoice.playing() === 38), { timeout: 8000, label: 'playing' });
    ok(true, 'Play on the card plays the saved recording');
    await P.click('#voice-play');
    await waitFor(() => P.evaluate(() => window.kidverseVoice.playing() === 0), { label: 'stopped' });
    ok(true, 'and a second tap stops it');

    console.log('\n## a kid hears it on another device');
    await settle(KID.page); await KID.page.reload();
    await KID.page.waitForFunction(() => window.kidverseVoice && hub.sync.lastPull > 0 && kidverseVoice.has(38), null, { timeout: 15000 });
    await sleep(600);
    ok(await text(KID.page, '#say > span') === 'Eli’s voice' && await vis(KID.page, '#say-face') && /avatar/.test(await KID.page.$eval('#say-face', e => e.innerHTML)), 'the kid\'s verse speaker is "Eli’s voice" with Eli\'s face', await text(KID.page, '#say > span'));
    const aria = await KID.page.$eval('#say', b => b.getAttribute('aria-label') || b.textContent);
    ok(/Eli’s voice/.test(aria || ''), 'and it reads that way to a screen reader', aria);
    const bb = await KID.page.$eval('#say', e => { const r = e.getBoundingClientRect(); return { h: Math.round(r.height), w: Math.round(r.width) }; });
    ok(bb.h >= 64, 'the kid\'s speaker button stays >= 64 px tall', bb);
    await KID.page.screenshot({ path: path.join(EV, 'voice-kid-390.png') });
    await KID.page.click('#say');
    await waitFor(() => KID.page.evaluate(() => window.__plays.length >= 1), { label: 'the recording plays' });
    const pl = await KID.page.evaluate(() => ({ plays: window.__plays, spoken: window.__spoken.length, playing: kidverseVoice.playing() }));
    ok(pl.plays.length >= 1 && pl.plays.every(x => x.blob), 'tapping Read it to me plays a blob: URL (the audio was fetched with the session, not linked)', pl);
    ok(pl.spoken === 0, 'and the synthetic voice stays silent', pl);
    const gets = KID.seen.filter(x => x.method === 'GET');
    ok(gets.length >= 1 && gets.every(x => x.profile && x.device && x.url.startsWith(`/api/kidverse/voice/${WEEK}/`)), 'the audio request carries the device and session headers', gets);
    await waitFor(() => KID.page.evaluate(() => kidverseVoice.playing() === 0), { timeout: 15000, label: 'the recording ends' });
    ok(await text(KID.page, '#say > span') === 'Eli’s voice', 'when it ends the speaker is back to "Eli’s voice"');
    await KID.page.click('#say'); await sleep(250);
    await KID.page.click('#say'); await sleep(400);
    ok(await KID.page.evaluate(() => kidverseVoice.playing() === 0) && await KID.page.evaluate(() => window.__spoken.length) === 0, 'a second tap while it plays stops it, and does not fall back to the synthetic voice');
    const toasts = await KID.page.evaluate(() => document.getElementById('hub-toast') ? document.getElementById('hub-toast').textContent.trim() : '');
    ok(!toasts, 'no toast at all while it plays', toasts);

    console.log('\n## where it cannot play, the synthetic voice reads (quietly)');
    const BAD = await newContext(browser, 'kid-decode'); ctxs.push(BAD);
    await BAD.ctx.route(/\/api\/kidverse\/voice\/\d+\/[^/]+$/, r => { if (r.request().method() !== 'GET') return r.continue(); r.fulfill({ status: 200, contentType: 'audio/webm', headers: { 'Access-Control-Allow-Origin': '*' }, body: Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 7)]) }); });
    await signIn(BAD.page, 'kiara'); await openKV(BAD);
    await BAD.page.waitForFunction(() => kidverseVoice.has(38), null, { timeout: 15000 });
    await sleep(500);
    await BAD.page.click('#say');
    await waitFor(() => BAD.page.evaluate(() => window.__spoken.length >= 1), { timeout: 25000, label: 'the synthetic voice after a decode error' });
    const sp = await BAD.page.evaluate(() => window.__spoken);
    ok(sp.length === 1 && /Acts, chapter 2, verse 42/.test(sp[0].text) && Math.abs(sp[0].rate - 0.85) < 1e-6, 'a recording that will not decode: the synthetic voice reads the verse at rate 0.85', sp);
    ok(!(await toast(BAD.page)), 'and nothing is said about it (no toast)', await toast(BAD.page));
    ok(await BAD.page.evaluate(() => kidverseVoice.playing() === 0), 'the recording is not left "playing"');
    await BAD.ctx.close();
    const OFF = await newContext(browser, 'kid-offline'); ctxs.push(OFF);
    await OFF.ctx.route(/\/api\/kidverse\/voice\/\d+\/[^/]+$/, r => r.request().method() === 'GET' ? r.abort('internetdisconnected') : r.continue());
    await signIn(OFF.page, 'ezra'); await openKV(OFF);
    await OFF.page.waitForFunction(() => kidverseVoice.has(38), null, { timeout: 15000 });
    await OFF.page.click('#say');
    await waitFor(() => OFF.page.evaluate(() => window.__spoken.length >= 1), { timeout: 25000, label: 'the synthetic voice when the audio cannot be fetched' });
    ok((await OFF.page.evaluate(() => window.__spoken[0].text)).includes('Acts, chapter 2, verse 42') && !(await toast(OFF.page)), 'the audio cannot be fetched: the synthetic voice reads, quietly');
    await OFF.ctx.close();

    console.log('\n## saving over it asks first');
    await P.click('#voice-record');
    await P.waitForSelector('#voice-stop'); await sleep(1500);
    await P.click('#voice-stop'); await P.waitForSelector('#voice-save');
    await P.click('#voice-save');
    await P.waitForSelector('.hub-ask .sheet', { timeout: 6000 });
    const ask = await text(P, '.hub-ask .sheet');
    ok(/Eli’s recording of week 38 will be replaced/.test(ask || '') && /Replace the recording\?/.test(ask || ''), 'the sheet names whose recording it replaces', ask);
    await P.click('.hub-ask .sheet-actions .btn:not(.btn-primary)');
    await sleep(600);
    ok((await voiceRow()).value.id === row1.id && await vis(P, '#voice-save'), 'Keep the old one: the recording on the Worker is unchanged and the take is still there');
    await P.click('#voice-save'); await P.waitForSelector('.hub-ask .sheet');
    await P.click('.hub-ask .sheet-actions .btn-primary');
    await waitFor(async () => (await voiceRow()).value.id !== row1.id, { label: 'the replacement' });
    const row2 = (await voiceRow()).value;
    ok(row2.id !== row1.id && row2.by === 'eli', 'Replace it: a new recording', row2);
    const old = await api(`/api/kidverse/voice/${WEEK}/${row1.id}`, { profile: T.ezra, raw: true });
    ok(old.status === 404, 'the replaced recording is gone (404)', old.status);
    ok(voiceBytes() === null || voiceBytes() === 1, 'and its bytes are deleted: still exactly one stored recording', voiceBytes());

    console.log('\n## the 90-second limit');
    await waitFor(() => vis(P, '#voice-record'), { label: 'Record again' });
    await P.click('#voice-record'); await P.waitForSelector('#voice-stop');
    await P.evaluate(() => window.__jump(91000));
    await P.waitForSelector('#voice-save', { timeout: 8000 });
    const lastNow = await P.$$eval('.kvv-now', l => l[l.length - 1].textContent.trim().replace(/\s+/g, ' '));
    ok(/1:30/.test(lastNow), 'a take that runs past 90 s is stopped at 1:30', lastNow);

    console.log('\n## the shelf plays a past week\'s recording');
    await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: WEEK + 1, by: 'voice-7', at: Date.now() }, updated_at: Date.now() + 5 } });
    await settle(KID.page);
    await KID.page.reload();
    await KID.page.waitForFunction(w => window.kidverseVoice && hub.sync.lastPull > 0 && /\d/.test(document.getElementById('ref').textContent) && document.getElementById('ref').textContent !== '', null, { timeout: 15000 });
    await sleep(900);
    ok(await text(KID.page, '#say > span') !== 'Eli’s voice', 'on week 39 (no recording) the verse speaker is the synthetic "Read it to me"', await text(KID.page, '#say > span'));
    const card = await KID.page.$('.shelf-card[data-week="38"]');
    if (card) {
      await card.click();
      await KID.page.waitForSelector('#vs-say', { timeout: 6000 });
      ok(/Eli’s voice/.test(await text(KID.page, '#vs-say') || ''), 'Earlier weeks, week 38: its speaker is labelled "Eli’s voice"', await text(KID.page, '#vs-say'));
      const nPlays = await KID.page.evaluate(() => window.__plays.length);
      await KID.page.click('#vs-say');
      await waitFor(() => KID.page.evaluate(n => window.__plays.length > n, nPlays), { label: 'the shelf plays the recording' });
      ok(true, 'the shelf plays week 38\'s recording');
      await KID.page.keyboard.press('Escape');
      ok(await KID.page.evaluate(() => kidverseVoice.playing() === 0), 'closing the sheet stops it');
    } else ok(false, 'Earlier weeks has a card for week 38 (needs the shelf)');
    await api('/api/data/kidverse/week?scope=family', { method: 'PUT', profile: T.eli, body: { value: { week: WEEK, by: 'voice-7', at: Date.now() }, updated_at: Date.now() + 10 } });
    await settle(KID.page); await settle(P);

    console.log('\n## Remove');
    await P.reload();
    await P.waitForFunction(() => window.kidverseVoice && hub.sync.lastPull > 0 && kidverseVoice.has(38), null, { timeout: 15000 });
    await P.waitForSelector('#voice-remove');
    await P.click('#voice-remove');
    await P.waitForSelector('.hub-ask .sheet');
    ok(/Remove the recording\?/.test(await text(P, '.hub-ask .sheet') || '') && /Eli’s recording of week 38/.test(await text(P, '.hub-ask .sheet') || ''), 'Remove asks, naming whose recording it is', await text(P, '.hub-ask .sheet'));
    await P.click('.hub-ask .sheet-actions .btn:not(.btn-danger)'); await sleep(500);
    ok(!!(await voiceRow()).value, 'Keep it: the recording stays');
    await P.click('#voice-remove'); await P.waitForSelector('.hub-ask .sheet'); await P.click('.hub-ask .sheet-actions .btn-danger');
    await waitFor(async () => (await voiceRow()).value === null, { label: 'the recording removed' });
    ok(true, 'Remove it: the family row is a tombstone');
    const gone = await api(`/api/kidverse/voice/${WEEK}/${row2.id}`, { profile: T.ezra, raw: true });
    ok(gone.status === 404 && (voiceBytes() === null || voiceBytes() === 0), 'the audio is gone for everyone and its bytes are deleted', { status: gone.status, bytes: voiceBytes() });
    await waitFor(() => P.evaluate(() => !kidverseVoice.has(38)), { label: 'the card follows' });
    ok(await vis(P, '#voice-record') && !(await vis(P, '#voice-now')) && /^Record$/.test(await text(P, '#voice-record') || ''), 'the card is back to a plain Record');
    await settle(KID.page); await KID.page.reload();
    await KID.page.waitForFunction(() => window.kidverseVoice && hub.sync.lastPull > 0 && /\d/.test(document.getElementById('ref').textContent), null, { timeout: 15000 });
    await sleep(500);
    ok(await text(KID.page, '#say > span') === 'Read it to me', 'the kid is back on "Read it to me"', await text(KID.page, '#say > span'));
    await KID.page.click('#say');
    await waitFor(() => KID.page.evaluate(() => window.__spoken.length >= 1), { label: 'synthetic after removal' });
    ok(true, 'and it reads with the synthetic voice again');

    ok(errors.length === 0, 'no console errors in any context', errors.slice(0, 4));
  } catch (e) {
    fail++; console.log('  ✗ crashed:', e && e.stack || e);
  } finally {
    for (const c of ctxs) await c.ctx.close().catch(() => {});
    await browser.close(); server.close();
    fs.writeFileSync(path.join(EV, 'voice-7.json'), JSON.stringify({ pass, fail, checks: out }, null, 1));
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }
})();
