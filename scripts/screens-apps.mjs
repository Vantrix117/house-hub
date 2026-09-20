#!/usr/bin/env node
// Roadmap 27: every app in every theme at 390 and 1024, signed in, plus the token rule — no hex left in any
// app's <style> except the two Dollywood apps' map colours — and no app keying its own colours off the OS scheme.
//   cd worker && npx wrangler dev --port 8787
//   node scripts/screens-apps.mjs <pairing-code>      → docs/screens/rm27-<app>-<theme>-<width>.png
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
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
const shots = path.join(ROOT, 'docs', 'screens'); fs.mkdirSync(shots, { recursive: true });
const THEMES = { hearth: ['rgb(247, 242, 235)', 'light'], parchment: ['rgb(231, 217, 190)', 'light'], frost: ['rgb(237, 240, 245)', 'light'], midnight: ['rgb(26, 21, 18)', 'dark'], forest: ['rgb(16, 23, 26)', 'dark'] };
const APPS = JSON.parse(fs.readFileSync(path.join(ROOT, 'apps.json'), 'utf8')).apps;
const errors = [];

// ── static rules ────────────────────────────────────────────────
console.log('\n## token rules');
for (const a of APPS) {
  const src = fs.readFileSync(path.join(ROOT, a.file), 'utf8');
  const style = (src.match(/<style>([\s\S]*?)<\/style>/) || ['', ''])[1];
  const hex = style.match(/#[0-9a-f]{3,8}\b/gi) || [];
  if (a.id.startsWith('dollywood')) {
    // map colours are exempt; the hub chrome block must be clean
    // the hub-flavour chrome block must be tokens; map/terrain/marker colours may stay; the standalone flavour keeps its own light toggle
    const i = style.indexOf('[data-flavor=hub],[data-flavor=live]{'); const chrome = i < 0 ? '' : style.slice(i, style.indexOf('\n', i));
    ok(i >= 0 && !/#[0-9a-f]{3,8}\b/i.test(chrome), `${a.id}: hub chrome block uses tokens only (${hex.length} map hex remain)`, chrome.slice(0, 120));
    ok(!/prefers-color-scheme/.test(style) && !/\[data-flavor=(hub|live)\]\[data-theme=/.test(style), `${a.id}: hub flavour has no OS-scheme or data-theme selectors`);
  } else {
    ok(hex.length === 0, `${a.id}: no hex in <style>`, hex.slice(0, 8).join(' '));
    ok(!/prefers-color-scheme/.test(style) && !/\[data-theme=/.test(style), `${a.id}: no OS-scheme or data-theme selectors in its CSS`);
  }
  ok(/href="design\.css"/.test(src), `${a.id}: links design.css`);
}

// ── sessions: a kid for kid-visible apps, Eli for the rest ──────
async function session(profileId, pin) {
  const j = async (p, body, headers = {}) => { const r = await fetch(API + p, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) }); return [r.status, await r.json()]; };
  const [, d] = await j('/api/pair', { code: CODE, name: 'screens-apps' });
  const device = { id: d.device_id, token: d.device_token, name: 'screens-apps' };
  let [st, r] = await j('/api/login', { profile_id: profileId, pin }, { 'X-Device-Token': device.token });
  if (st === 403 && r.error === 'needs_pin_setup') [st, r] = await j(`/api/profiles/${profileId}/pin`, { pin }, { 'X-Device-Token': device.token });
  if (st !== 200) throw new Error('login ' + profileId + ': ' + JSON.stringify(r));
  return { device, session: { token: r.profile_token, profile: r.profile } };
}

(async () => {
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const browser = await chromium.launch({ headless: true, executablePath: exe });
  try {
    const eli = await session('eli', '1357'), ezra = await session('ezra');
    for (const a of APPS) {
      console.log(`\n## ${a.id}`);
      const who = (!a.visibleTo || a.visibleTo.includes('ezra')) ? ezra : eli;
      for (const width of [390, 1024]) {
        const mobile = true;
        const ctx = await browser.newContext({ viewport: { width, height: width === 390 ? 844 : 1366 }, deviceScaleFactor: 2, hasTouch: mobile, isMobile: mobile, colorScheme: 'light' });
        await ctx.addInitScript(([api, s]) => { try { localStorage.setItem('hub.api', JSON.stringify(api)); localStorage.setItem('hub.device', JSON.stringify(s.device)); localStorage.setItem('hub.session', JSON.stringify(s.session)); } catch {} }, [API, who]);
        const page = await ctx.newPage();
        page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource.*(401|403|404|409|429)/.test(m.text())) errors.push(`${a.id}/${width}: ${m.text()}`); });
        page.on('pageerror', e => errors.push(`${a.id}/${width}: ${e.message}`));
        await page.goto(SITE + '/' + a.file, { waitUntil: 'load' });
        if (a.id !== 'dollywood') await page.waitForFunction(() => window.hub && hub.sync && (hub.sync.lastPull > 0 || hub.sync.state === 'offline'), null, { timeout: 20000 }).catch(() => {});
        await sleep(600);
        for (const [t, [bg, scheme]] of Object.entries(THEMES)) {
          await page.evaluate(([t, scheme]) => { const r = document.documentElement; if (t === 'hearth') delete r.dataset.theme; else r.dataset.theme = t; r.dataset.scheme = scheme; if (window.hub && hub.setTheme && hub.profile) { try { localStorage.setItem('hub.theme', JSON.stringify(t)); } catch {} } }, [t, scheme]);
          await sleep(350);
          const got = await page.evaluate(() => ({ bg: getComputedStyle(document.documentElement).getPropertyValue('--bg').trim(), hs: document.documentElement.scrollWidth <= window.innerWidth + 1 }));
          if (width === 390) ok(got.hs, `${a.id}/${t}: no horizontal scroll at 390`);
          await page.screenshot({ path: path.join(shots, `rm27-${a.id}-${t}-${width}.png`), fullPage: false });
        }
        // the chrome really follows the theme: sample the page background under midnight vs hearth
        const dark = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        await page.evaluate(() => { const r = document.documentElement; delete r.dataset.theme; r.dataset.scheme = 'light'; }); await sleep(250);
        const light = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
        if (width === 390) ok(dark !== light, `${a.id}: page background changes between forest and hearth (${light} → ${dark})`);
        await ctx.close();
      }
    }
    ok(errors.length === 0, 'no console/page errors', errors.slice(0, 6).join(' | '));
  } finally { await browser.close(); server.close(); }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
