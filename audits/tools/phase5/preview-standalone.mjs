// Builds a self-contained copy of audits/design-preview.html: one file with the token CSS, the app icons, the Prayer
// "before" captures and the park-map art inlined, so it renders wherever it is opened on its own (a file viewer, a phone,
// a published link). audits/design-preview.html stays the source and the page the capture rig and preview-check load.
//   node audits/tools/phase5/preview-standalone.mjs <out.html>
// Differences from the source, all mechanical:
//  - the glass stages are srcdoc iframes built from this page's own <style>/<script> elements (the source loads
//    design-preview.html?stage=… instead); the stage parameters travel in the iframe's name;
//  - the palette attribute is data-hh-theme, not data-theme, because a viewer that stamps data-theme="light|dark" on the
//    root (claude.ai artifacts do) would otherwise override the palette; the page follows that stamp, or the OS scheme;
//  - no <html>/<head>/<body> tags (a host that wraps the page supplies them; the doctype and metas stay for opening it
//    on its own); the stage captions are not links.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const out = process.argv[2];
if (!out) { console.error('usage: node audits/tools/phase5/preview-standalone.mjs <out.html>'); process.exit(2); }
const rd = (p, enc) => readFileSync(resolve(ROOT, p), enc);
const b64 = p => rd(p).toString('base64');

let html = rd('audits/design-preview.html', 'utf8');
let css = rd('audits/tools/phase4/tokens/proposed-tokens.css', 'utf8');

// replace exactly `count` occurrences, or fail: the source changed and this script must follow it
function sub(from, to, count = 1) {
  const n = html.split(from).length - 1;
  if (n !== count) throw new Error(`expected ${count} of ${JSON.stringify(from.slice(0, 80))}, found ${n}`);
  html = html.split(from).join(to);
}
function subRe(re, to) {
  if (!re.test(html)) throw new Error('no match for ' + re);
  html = html.replace(re, to);
}

// document shell: the host supplies it
subRe(/\n<html [^>]*>\n<head>\n(<meta charset="utf-8">\n<meta name="viewport"[^>]*>\n)/, '\n$1');   // the metas stay: they land in the implied <head>
sub('<title>House Hub — design preview (Phase 5)</title>', '<title>House Hub Design Preview</title>');
sub('</style>\n</head>\n<body>\n', '</style>\n');
sub('</script>\n</body>\n</html>', '</script>');

// the token file, inline
sub('<link rel="stylesheet" href="tools/phase4/tokens/proposed-tokens.css">', '<style id="tokens">\n' + css + '\n</style>');

// the boot script is replaced whole (below, after the rename); mark it
subRe(/<script>\n  \/\/ Follow the device's scheme[\s\S]*?<\/script>\n/, '@@BOOT@@\n');

// page style and main script get ids so the stage documents can copy them
sub('<style>\n  *, *::before', '<style id="page">\n  *, *::before');
sub('  a.gcap { color: var(--text-3);', '  .gcap { color: var(--text-3); display: block; min-height: var(--tap); }\n  a.gcap { color: var(--text-3);');
sub('url("../apps/dollywood/illustrated_lo.jpg")', 'var(--stage-art)');
sub('<script>\n(function () {\n', '<script id="main">\n(function () {\n');
sub(" Tap a stage's caption to open it full size.", '');

// assets
sub("st.src = '../apps/dollywood/illustrated_lo.jpg';", "st.src = window.__stageArt || '';");
// a hidden or backgrounded viewer may never settle decode(); the captions then fill after 1.5 s anyway
sub('(st.decode ? st.decode() : Promise.resolve()).catch(function () {})',
    'Promise.race([(st.decode ? st.decode() : Promise.resolve()).catch(function () {}), new Promise(function (r) { setTimeout(r, 1500); })])');
sub("url(../icons/' + a[0] + '.svg)", "url(' + window.__HH_ICONS[a[0]] + ')", 3);
sub("url(../icons/' + n[0] + '.svg)", "url(' + window.__HH_ICONS[n[0]] + ')");
sub("url(../icons/f260.svg)", "url(' + window.__HH_ICONS.f260 + ')");
sub(`src="design-preview-assets/prayer-before-iphone-' + m[0] + '.jpg"`, `src="' + window.__HH_PRAYER[m[0]] + '"`);

// glass stages: srcdoc iframes of this page's own parts
sub("src: 'design-preview.html?stage=glass&theme=' + s[0] + '&scheme=' + s[1] + '&glass=' + lv[0] });",
    "name: 'stage=glass&theme=' + s[0] + '&scheme=' + s[1] + '&glass=' + lv[0], srcdoc: stageDoc() });");
sub(`'<a class="gcap" href="design-preview.html?stage=glass&amp;theme=' + s[0] + '&amp;scheme=' + s[1] + '&amp;glass=' + lv[0] + '" target="_blank" rel="noopener"><b>' + lv[1] + '</b> · ' + s[1] + ' · <span data-stage-cap>…</span> · open full size</a>'`,
    `'<span class="gcap"><b>' + lv[1] + '</b> · ' + s[1] + ' · <span data-stage-cap>…</span></span>'`);
sub('        var w = st.iframe.contentWindow;\n',
    '        var w = null; try { w = st.iframe.contentWindow; if (w) void w.__previewReady; } catch (e) { res(); return; }\n');
sub('  var gf = document.getElementById(\'glassframes\'), stages = [];\n',
    `  var gf = document.getElementById('glassframes'), stages = [];
  function stageDoc() {   // one glass stage as its own document: this page's styles and scripts, the art as a blob URL
    if (stageDoc.html) return stageDoc.html;
    var el = document.getElementById('stage-art'), b = el ? el.textContent.trim() : '', art = '';
    try { var bin = atob(b), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); art = URL.createObjectURL(new Blob([u], { type: 'image/jpeg' })); } catch (e) { art = 'data:image/jpeg;base64,' + b; }
    var pick = function (id) { var e = document.getElementById(id); return e ? e.outerHTML : ''; };
    return (stageDoc.html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">' +
      pick('tokens') + pick('page') + '<style>:root{--stage-art:url("' + art + '") 60% 78% / 300% auto}</style><script>window.__stageArt=' + JSON.stringify(art) + '<\\/script>' +
      pick('boot') + '</head><body>' + pick('main') + '</body></html>');
  }
`);
// .stage used the shorthand background: url(...) 60% 78% / 300% auto; the variable now carries the whole value
sub('.stage { position: absolute; inset: 0; background: var(--stage-art) 60% 78% / 300% auto; }',
    '.stage { position: absolute; inset: 0; background: var(--stage-art); }');

// the palette attribute: data-theme → data-hh-theme, in the page and the token file
html = html.split('data-theme').join('data-hh-theme').split('dataset.theme').join('dataset.hhTheme');
css = null;

const BOOT = `<script id="boot">
  // Stage mode (a glass stage in a srcdoc iframe) reads its parameters from the frame's name; the page itself follows the
  // viewer: a host's data-theme="light|dark" on the root wins, otherwise the device's scheme (Hearth by day, Midnight at night).
  (function () {
    var d = document.documentElement, n = window.name || '';
    var q = new URLSearchParams(n.indexOf('stage=') === 0 ? n : location.search);
    d.lang = 'en'; d.dataset.accent = q.get('accent') || 'periwinkle';
    if (q.get('stage') === 'glass') {
      var th = q.get('theme') || 'hearth', sc = q.get('scheme') || 'light', lv = q.get('glass') || 'frosted';
      d.dataset.hhTheme = th; d.dataset.scheme = sc; d.style.colorScheme = sc; d.dataset.kind = 'adult';
      if (lv === 'solid') d.dataset.transparency = 'reduce'; else { d.dataset.glass = lv; d.dataset.transparency = 'full'; }
      d.dataset.stage = 'glass';
      return;
    }
    var mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
    function apply() {
      var host = d.getAttribute('data-theme');
      var dark = host === 'dark' || (host !== 'light' && !!(mq && mq.matches));
      d.dataset.hhTheme = dark ? 'midnight' : 'hearth'; d.dataset.scheme = dark ? 'dark' : 'light'; d.style.colorScheme = dark ? 'dark' : 'light';
    }
    apply();
    if (mq && mq.addEventListener) mq.addEventListener('change', apply);
    new MutationObserver(apply).observe(d, { attributes: true, attributeFilter: ['data-theme'] });
    var s = q.get('section'); if (s) d.dataset.only = s;
  })();
</script>`;
html = html.replace('@@BOOT@@', () => BOOT);

// data the main page needs (not copied into the stages)
const ICONS = Object.fromEntries(['timer', 'prayer', 'kidverse', 'verses', 'leftovers', 'tally', 'dollywood-live', 'f260', 'dollywood']
  .map(id => [id, 'data:image/svg+xml;base64,' + b64(`icons/${id}.svg`)]));
const PRAYER = Object.fromEntries(['light', 'dark'].map(m => [m, 'data:image/jpeg;base64,' + b64(`audits/design-preview-assets/prayer-before-iphone-${m}.jpg`)]));
const DATA = `<script id="data">window.__HH_ICONS = ${JSON.stringify(ICONS)};\nwindow.__HH_PRAYER = ${JSON.stringify(PRAYER)};</script>\n` +
  `<script type="text/plain" id="stage-art">${b64('apps/dollywood/illustrated_lo.jpg')}</script>\n`;
sub('<script id="main">', DATA + '<script id="main">');

const left = html.match(/url\(\.\.\/|['"]\.\.\/apps|src="design-preview-assets\/|href="tools\/|href="design-preview\.html/);
if (left) throw new Error('a relative asset reference is left: ' + left[0]);
writeFileSync(out, html);
console.log(out, (Buffer.byteLength(html) / 1024).toFixed(0) + ' KB');
