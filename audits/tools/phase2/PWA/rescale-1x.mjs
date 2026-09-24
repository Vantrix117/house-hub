// Phase 2 PWA write-up (critic2 §F): one skeptic screenshot cited by the PWA section was saved at 2× CSS scale
// (1640×2360 for the 820×1180 ipad-portrait viewport). This writes a 1× copy next to it (suffix -1x.png) by drawing
// the PNG at half size in a headless page with deviceScaleFactor 1 and screenshotting it. The original is left
// untouched. No rig is started (so there is no L to close) and nothing touches production.
//   node "audits/tools/phase2/PWA/rescale-1x.mjs"
// Copied from audits/tools/phase2/PROF/rescale-evidence-1x.mjs, with the PWA file list.
import fs from 'node:fs';
import path from 'node:path';
import { playwright, ROOT } from '../../lib/local.mjs';

const DIR = path.join(ROOT, 'audits', 'evidence', 'p2', 'PWA');
const JOBS = [
  { file: 'verify-private-feed-2-mom-home-ipad-portrait-light.png', scale: 2 }  // 1640×2360 → 820×1180 (ipad-portrait)
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
    try {
      const page = await ctx.newPage();
      await page.setContent(`<html><body style="margin:0"><img id="i" style="display:block;width:${w}px;height:${h}px" src="data:image/png;base64,${buf.toString('base64')}"></body></html>`);
      await page.waitForFunction(() => { const i = document.getElementById('i'); return i.complete && i.naturalWidth > 0; });
      const out = path.join(DIR, file.replace(/\.png$/, '-1x.png'));
      await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
      const o = fs.readFileSync(out);
      console.log(`${file} ${w0}x${h0} → ${path.basename(out)} ${o.readUInt32BE(16)}x${o.readUInt32BE(20)} (${Math.round(o.length / 1024)} KB)`);
    } finally { await ctx.close(); }
  }
} finally { await browser.close(); }
