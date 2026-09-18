#!/usr/bin/env node
// Roadmap 6 checks: profile photos + the family album. Uploads a generated picture as Eli, sees it on a second
// device (picker, Home feed, chat, admin), checks caching and guards (kids cannot upload; only the owner/admin
// removes album photos), removes it again. Screenshots → docs/screens/rm6-*.png
//   cd worker && npx wrangler dev --port 8787     (fresh local D1 with migrations/002-media.sql applied)
//   node scripts/test-photos.mjs <pairing-code>
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright-core');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const CODE = process.argv[2] || 'local-test-code';
const API = process.env.HUB_API || 'http://127.0.0.1:8787';
const SITE = 'http://localhost:8765';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  fs.readFile(p, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  });
}).listen(8765);

let pass = 0, fail = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ✓', name); } else { fail++; console.log('  ✗', name, extra); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function waitFor(fn, { timeout = 12000, every = 150, label = 'condition' } = {}) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) { try { const v = await fn(); if (v) return v; } catch {} await sleep(every); }
  throw new Error('timeout waiting for ' + label);
}
const shots = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(shots, { recursive: true });
const errors = [];
async function newContext(browser, name, size) {
  const ctx = await browser.newContext({ viewport: size || { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  await ctx.addInitScript(api => { try { localStorage.setItem('hub.api', JSON.stringify(api)); } catch {} }, API);
  const page = await ctx.newPage();
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(400|401|403|404|413|429)/.test(m.text())) errors.push(name + ': ' + m.text()); });
  page.on('pageerror', e => errors.push(name + ': ' + e.message));
  await page.goto(SITE + '/index.html'); await page.waitForSelector('#paircode');
  await page.fill('#paircode', CODE); await page.click('#pairform button[type=submit]'); await page.waitForSelector('.pcard[data-id]');
  return { ctx, page };
}
async function signIn(page, id, pin) {
  await page.click(`.pcard[data-id=${id}]`);
  if (pin) {
    await page.waitForSelector('#pad'); await sleep(450);
    const tap = async () => { for (const d of pin) await page.click(`#pad [data-d="${d}"]`); await page.click('#pingo'); };
    await tap();
    await page.waitForFunction(() => !document.getElementById('gate').hidden === false || /again/.test((document.getElementById('pinhint') || {}).textContent || ''), null, { timeout: 15000 });
    if (await page.$('#gate:not([hidden]) #pad')) await tap();
  }
  await page.waitForSelector('#shell:not([hidden])');
  await page.waitForFunction(() => window.hub && hub.sync && hub.sync.lastPull > 0, null, { timeout: 15000 });
}
// a File made in the page: a big coloured picture with a face-ish circle, wider than tall (tests the square crop)
const makeFile = (page, w = 1800, h = 1200, hue = 30) => page.evaluateHandle(async ([w, h, hue]) => {
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const g = cv.getContext('2d');
  g.fillStyle = `hsl(${hue} 60% 70%)`; g.fillRect(0, 0, w, h); g.fillStyle = `hsl(${hue} 70% 35%)`; g.beginPath(); g.arc(w / 2, h / 2, h / 3, 0, 7); g.fill();
  g.fillStyle = '#fff'; g.fillRect(0, 0, 40, h); // left edge stripe: must be cropped away
  const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
  return new File([blob], 'me.png', { type: 'image/png' });
}, [w, h, hue]);

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    console.log('\n## Eli uploads a photo');
    const A = await newContext(browser, 'A');
    await signIn(A.page, 'eli', '1357');
    ok(await A.page.evaluate(() => hub.profile.photo === null), 'no photo to start with');
    const f = await makeFile(A.page);
    const prof = await A.page.evaluate(async f => hub.uploadPhoto(f), f);
    ok(prof && prof.photo && /photos\/eli\/[\w-]+-256\.jpg$/.test(prof.photo.sm) && /-1024\.jpg$/.test(prof.photo.lg), 'upload returns 256 + 1024 urls', JSON.stringify(prof && prof.photo));
    ok(await A.page.evaluate(() => hub.profile.photo && hub.profile.photo.sm.includes('-256.jpg')), 'session profile updated in place');
    const smUrl = await A.page.evaluate(() => hub.photoUrl(hub.profile, 'sm')), lgUrl = await A.page.evaluate(() => hub.photoUrl(hub.profile, 'lg'));
    const r = await fetch(smUrl); const buf = new Uint8Array(await r.arrayBuffer());
    ok(r.status === 200 && r.headers.get('content-type') === 'image/jpeg' && buf[0] === 0xFF && buf[1] === 0xD8, `GET small photo is a JPEG (${buf.length} bytes)`);
    ok(/immutable/.test(r.headers.get('cache-control') || ''), 'photo is cached forever (immutable)');
    ok(buf.length < 80 * 1024, 'small photo under 80 KB');
    const lg = new Uint8Array(await (await fetch(lgUrl)).arrayBuffer());
    ok(lg.length > buf.length && lg.length < 420 * 1024, `large photo bigger than small, under 420 KB (${lg.length})`);
    // dimensions + crop: decode in the page
    const dims = await A.page.evaluate(async ([sm, lg]) => { const d = async u => { const b = await createImageBitmap(await (await fetch(u)).blob()); return [b.width, b.height]; }; return [await d(sm), await d(lg)]; }, [smUrl, lgUrl]);
    ok(dims[0][0] === 256 && dims[0][1] === 256 && dims[1][0] === 1024 && dims[1][1] === 1024, `square crops 256 and 1024 (${JSON.stringify(dims)})`);
    const edge = await A.page.evaluate(async u => { const b = await createImageBitmap(await (await fetch(u)).blob()); const cv = document.createElement('canvas'); cv.width = cv.height = 256; const g = cv.getContext('2d'); g.drawImage(b, 0, 0); const px = g.getImageData(2, 128, 1, 1).data; return px[0] > 240 && px[1] > 240 && px[2] > 240; }, smUrl);
    ok(!edge, 'the white edge stripe was cropped away (centre square)');
    await A.page.click('.tab[data-tab=me]');
    await waitFor(() => A.page.$eval('.me-hero .avatar img', i => i.complete && i.naturalWidth > 0), { label: 'me hero img' });
    ok(true, 'Me hero shows the photo');
    await sleep(400); await A.page.screenshot({ path: path.join(shots, 'rm6-me-photo-390.png') });

    console.log('\n## a second device sees it');
    const B = await newContext(browser, 'B');
    ok(await B.page.$eval('.pcard[data-id=eli] .avatar img', i => /-256\.jpg/.test(i.src)) , 'picker card shows the photo');
    await sleep(400); await B.page.screenshot({ path: path.join(shots, 'rm6-picker-390.png') });
    await signIn(B.page, 'christian', '2468');
    await B.page.evaluate(() => hub.activity('Waved hello', 'hub'));
    await A.page.evaluate(() => hub.activity('Uploaded a photo', 'hub'));
    await B.page.click('.tab[data-tab=home]'); await B.page.click('#feed-refresh');
    await waitFor(() => B.page.$$eval('#feed .avatar img', els => els.some(i => /photos\/eli/.test(i.src))), { label: 'feed avatar' });
    ok(true, "Home feed shows Eli's face");
    await A.page.click('.tab[data-tab=chat]'); await A.page.waitForFunction(() => !document.querySelector('#chat-log .skeleton'));
    await A.page.fill('#chat-in', 'hello there');
    const chatBubble = await A.page.evaluate(() => new Promise(res => { document.getElementById('chat-form').requestSubmit(); setTimeout(() => res({ img: !!document.querySelector('.mrow.user .avatar img'), user: !!document.querySelector('.mrow.user'), disabled: document.getElementById('chat-in').disabled, note: (document.querySelector('.chat-note') || {}).textContent }), 1200); }));
    ok(chatBubble.img, 'chat bubble carries the photo avatar', JSON.stringify(chatBubble));
    ok(await A.page.evaluate(() => hub.people().find(p => p.id === 'eli').photo !== null), 'hub.people() carries photos for apps');

    console.log('\n## guards');
    const K = await newContext(browser, 'K');
    await signIn(K.page, 'ezra');
    const kf = await makeFile(K.page, 600, 600, 200);
    const kidErr = await K.page.evaluate(async f => { try { await hub.uploadPhoto(f); return 'allowed'; } catch (e) { return e.error; } }, kf);
    ok(kidErr === 'adults_only', `kid cannot set their own photo (${kidErr})`);
    const otherErr = await B.page.evaluate(async () => { try { await hub.removePhoto('eli'); return 'allowed'; } catch (e) { return e.error; } });
    ok(otherErr === 'not_yours', `Mae cannot remove Eli's photo (${otherErr})`);
    const kidAlbum = await K.page.evaluate(async f => { try { await hub.addAlbumPhoto(f); return 'allowed'; } catch (e) { return e.error; } }, kf);
    ok(kidAlbum === 'adults_only', 'kid cannot add album photos');
    const big = await A.page.evaluate(async () => { try { await hub.request('/api/profiles/eli/photo', { method: 'PUT', body: { sm: 'AAAA', lg: 'AAAA' } }); return 'allowed'; } catch (e) { return e.error; } });
    ok(big === 'bad_image', 'server rejects non-JPEG bytes');
    ok((await fetch(API + '/api/media/photos/eli/nope-256.jpg')).status === 404, 'unknown key is 404');

    console.log('\n## family album');
    const af = await makeFile(A.page, 1600, 1000, 120);
    const ph = await A.page.evaluate(async f => hub.addAlbumPhoto(f, 'Picnic'), af);
    ok(ph && ph.id && ph.sm.includes('album/') && ph.caption === 'Picnic', 'album upload returns the row');
    await B.page.evaluate(() => hub.pull());
    await waitFor(() => B.page.evaluate(() => hub.list('album:', { app: 'hub', scope: 'family' }).length === 1), { label: 'album synced to B' });
    ok(true, 'album row syncs to the second device (family scope)');
    await A.page.click('.tab[data-tab=me]');
    await waitFor(() => A.page.$eval('#album-grid img', i => i.complete && i.naturalWidth > 0), { label: 'album img' });
    ok(true, 'Me → Family album shows the photo');
    await sleep(300); await A.page.screenshot({ path: path.join(shots, 'rm6-album-390.png') });
    const delOther = await B.page.evaluate(async id => { try { await hub.removeAlbumPhoto(id); return 'allowed'; } catch (e) { return e.error; } }, ph.id);
    ok(delOther === 'not_yours', "Mae cannot remove Eli's album photo");
    await A.page.evaluate(id => hub.removeAlbumPhoto(id), ph.id);
    await waitFor(() => A.page.evaluate(() => hub.list('album:', { app: 'hub', scope: 'family' }).length === 0), { label: 'album removed' });
    ok((await fetch(API + ph.sm)).status === 404, 'removed album bytes are gone');

    console.log('\n## remove the profile photo');
    await A.page.evaluate(() => hub.removePhoto());
    ok(await A.page.evaluate(() => hub.profile.photo === null), 'session profile photo cleared');
    ok((await fetch(smUrl)).status === 404, 'old photo bytes deleted');
    await A.page.click('.tab[data-tab=home]'); await A.page.click('.tab[data-tab=me]');
    ok(await A.page.$('.me-hero .avatar img') === null, 'Me hero back to the emoji');
    await K.ctx.close(); await B.ctx.close(); await A.ctx.close();
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 5).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
