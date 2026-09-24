// Phase 2 PROF write-up: two skeptic screenshots were saved above 1× CSS scale (2× iPad, 3× iPhone).
// This writes a 1× copy next to each original (suffix -1x.png) by drawing the PNG at its CSS size in a
// headless browser with deviceScaleFactor 1. The originals are left untouched. Nothing touches the rig or production.
//   node "audits/tools/phase2/PROF/rescale-evidence-1x.mjs"
import fs from 'node:fs';
import path from 'node:path';
import { playwright, ROOT } from '../../lib/local.mjs';

const DIR = path.join(ROOT, 'audits', 'evidence', 'p2', 'PROF');
const JOBS = [
  { file: 'verify2-switch-caches-ezra-prayer-ipad.png', scale: 2 },          // 1640×2360 → 820×1180 (ipad-portrait)
  { file: 'verify-person-writes-stranded-after-switch-1-phone.png', scale: 3 } // 1290×2796 → 430×932 (iphone-pwa)
];
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));

const pw = playwright();
const browser = await pw.chromium.launch({ executablePath: CHROME, headless: true });
try {
  for (const { file, scale } of JOBS) {
    const src = path.join(DIR, file);
    const buf = fs.readFileSync(src);
    const w0 = buf.readUInt32BE(16), h0 = buf.readUInt32BE(20);                // PNG IHDR width/height
    const w = Math.round(w0 / scale), h = Math.round(h0 / scale);
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await page.setContent(`<html><body style="margin:0"><img id="i" style="display:block;width:${w}px;height:${h}px" src="data:image/png;base64,${buf.toString('base64')}"></body></html>`);
    await page.waitForFunction(() => document.getElementById('i').complete);
    const out = path.join(DIR, file.replace(/\.png$/, '-1x.png'));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
    const o = fs.readFileSync(out);
    console.log(`${file} ${w0}x${h0} → ${path.basename(out)} ${o.readUInt32BE(16)}x${o.readUInt32BE(20)} (${Math.round(o.length / 1024)} KB)`);
    await ctx.close();
  }
} finally { await browser.close(); }
