// Phase 4 COLOR: every failing text group of the rig (failing-pairs/<area>.json, non-suspect), grouped by component.
// A component is matched by selector/colour rules below; each carries the cause, the prior ID it belongs to (or NEW),
// whether it is exempt (a disabled control, WCAG 1.4.3 "inactive"), and a screenshot: the Phase 1 capture for the
// System theme (audits/screens/<area>/<screen>-<state>-<device>-<mode>.png) or the rig's named-theme shot
// (audits/evidence/p4/measure/shots/<theme>/<area>/..., git-ignored; cited ones are copied into audits/evidence/p4/COLOR/).
// Usage: node audits/tools/phase4/COLOR/components.mjs -> audits/evidence/p4/COLOR/components.json (+ markdown on stdout)
import fs from 'node:fs'; import path from 'node:path'; import url from 'node:url';
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '../../../..');
const M = path.join(ROOT, 'audits/evidence/p4/measure/failing-pairs');
const AREAS = ['shell', 'tv', 'f260', 'leftovers', 'prayer', 'tally', 'timer', 'dollywood', 'dollywood-live', 'kidverse', 'verses'];
// [id, test(g, area), label, cause, prior, exempt]
const R = [
  ['disabled', g => /#pingo|reward-kid|#askSave|#prayBack|#week-down|#jSort|#jCopyAll/.test(g.sel), 'Disabled controls (PIN Continue, Cash in/Reset week at 0, Mark answered, Back on the first card, week −, locked journal tools)', 'opacity on :disabled', 'exempt', true],
  ['kiosk-me', (g, a, area) => area === 'tv' && /me-kiosk|chat-kiosk/.test(g.jobs[0]), 'TV kiosk Me/Chat rendered under the board', 'hidden views drawn over the album backdrop', 'P2-PROF-10', false],
  ['album', g => /album-item > figcaption/.test(g.sel), 'Album captions', '--on-accent over a 45 % scrim on photos', 'P2 VIS (album captions)', false],
  ['home-hero', g => /home-hero/.test(g.sel), 'Home hero kicker / greeting / summary', 'dark: --text on the pale accent gradient; light: kicker .85 opacity', 'P2-VIS-06 (dark), P2 VIS light kicker', false],
  ['me-hero', g => /me-hero/.test(g.sel), 'Me hero kicker / name', 'same hero recipe as Home in dark', 'P2 VIS (Me hero dark wash, investigator only)', false],
  ['hero-btn', g => /#switch/.test(g.sel), 'Me hero Switch (.ds .hero .btn-primary)', '--accent-deep text on a fixed 92 % white fill; dark --accent-deep is a pale tint', 'P2 VIS (Switch 2.30) — widened', false],
  ['placeholder-ds', g => g.colorTok?.includes('--muted-decor') && /input|textarea/.test(g.sel), 'Field placeholders, the only label of the reminder and chat fields (--muted-decor)', '--muted-decor is "decorative only" (design.css:48) but is the .ds placeholder colour (design.css:446)', 'NEW (P2 UX placeholder-only labels)', false],
  ['placeholder-ua', g => g.color === '#A9A9A9', 'Field placeholders with no ::placeholder rule (UA #A9A9A9)', 'F260, Prayer and the Dollywood template never style ::placeholder', 'NEW', false],
  ['native-ctl', g => /#F4F4F4/i.test(g.bgMed) && /select|> button$|div\.jft > button/.test(g.sel), 'Native select / default button under a named theme', 'color-scheme stays "light dark" (design.css:15); hub.js never sets the resolved scheme', 'NEW', false],
  ['theme-blurb', g => /theme-blurb/.test(g.sel), 'Theme card blurbs (--muted on --surface-2)', '--muted is tuned for --bg/--surface (4.9), not wells (4.37-4.45)', 'P2 VIS (4.45) — cross-area', false],
  ['muted-well', (g, a) => g.colorTok?.includes('--muted') && (g.bgTok || []).some(t => /surface-2|sunk|panel2/.test(t)) && g.minP10 >= 4.2, '--muted on a well (--surface-2): badge hints, category counts, step pill', 'same token pair as the theme blurbs', 'VIS-KIDVERSE-1, VIS-DOLLYWOOD-5, VIS-PRAYER-1 (Mine) — cross-area', false],
  ['tabbar', g => /tabbar|#tabJournal|lv-tabs|#lv-(family|search|layers-tab)|#loc-near|#pill-home|near-mode/.test(g.sel), 'Labels on glass bars and tabs (provisional: no blur)', 'muted label on translucent glass', 'P2 VIS (Apps tab 3.78), VIS-PRAYER-1 (nav)', false],
  ['badge', g => /span\.badge/.test(g.sel), 'Tile badge (#fff on --danger)', 'literal #fff on the dark-scheme terra (design.css:517)', 'P2 VIS (badge 2.61)', false],
  ['feed-name', g => /fwho/.test(g.sel), 'Feed names (--tint-ink = 70 % person colour + --text)', 'the mix does not guarantee 4.5 (David dark, Kiara Parchment)', 'P2 VIS (David 4.22) — Kiara/Parchment new', false],
  ['tv-dim', g => /tv-face\.off/.test(g.sel), 'TV "not read yet" faces', 'dimmed with opacity', 'P2 VIS (TV dimmed faces)', false],
  ['tv-meta', g => /tv-date|tv-feed.*when|rem-by/.test(g.sel), 'TV kicker, feed times, reminder bylines', '--muted / --text-2 on the translucent board panes', 'P2 VIS (3.84/4.15/4.28)', false],
  ['kv-days', g => /div\.days > span/.test(g.sel), 'Kid Verse day letters (--muted-decor)', 'decorative token used for information', 'VIS-KIDVERSE-1', false],
  ['kv-badge', g => /bicon/.test(g.sel), 'Kid Verse unearned badge glyph (--muted-decor)', 'decorative token used for information', 'VIS-KIDVERSE-1', false],
  ['kv-also', g => /#also/.test(g.sel), 'Kid Verse "Also this week" (--muted on the gold wash)', '--muted over a tinted wash', 'NEW (4.45)', false],
  ['err-danger', g => /#err|\.err\b|#f-titleErr/.test(g.sel), 'Error lines in --danger/--terra instead of --danger-ink', 'mid tone used as text', 'P3-LEFTOVERS-15 (Larder); Prayer new', false],
  ['got-it', g => /\.got/.test(g.sel), 'Verses "Got it" (on-accent on --olive)', 'white on the olive mid tone', 'VIS-VERSES-3', false],
  ['f260-past', (g, a) => a === 'f260' && /span\.num|span\.span/.test(g.sel), 'F260 past weeks (opacity .6)', 'opacity-dimmed text instead of a muted ink', 'VIS-F260-1', false],
  ['f260-milestone', (g, a) => a === 'f260' && /div\.m[din]\b|div\.md|div\.mn|div\.mi/.test(g.sel), 'F260 unearned milestones (opacity .55)', 'opacity-dimmed text', 'VIS-F260-1', false],
  ['f260-nt-muted', (g, a) => a === 'f260' && g.colorTok?.includes('--muted') && g.minP10 >= 4.2, 'F260 --muted on the New Testament paper tint (4.49)', 'body.nt mixes 7 % teal into --bg (apps/f260.html:24-27); --muted was only checked on --bg', 'VIS-F260-1 (cause new)', false],
  ['dw-compass', g => /^b$/.test(g.sel.split(' > ').pop()) && (g.texts || []).includes('N'), 'Compass "N" (9 px)', 'template compass label', 'ICON dimension (compass needle)', false],
  ['f260-ring', (g, a) => a === 'f260' && /span.rn|todayRingN/.test(g.sel), 'F260 ring labels (week ring numbers)', 'label inside the progress ring', 'VIS-F260-1 / P2-VIS-03 (hearth-dark)', false],
  ['gold-text', g => (g.colorTok || []).some(t => /--gold|--warn|--ochre|g-law|--d3/.test(t)) , 'Gold (--gold/--warn) used as text', 'the mid tone instead of --gold-ink', 'VIS-F260-1, VIS-PRAYER-1; build guide/park map new', false],
  ['mid-text', g => (g.colorTok || []).some(t => /^--(olive|ok|terra|danger|teal|info)$|g-wis|--clay|--moss|--d1/.test(t)), 'Olive / terra / teal mid tones used as text', 'the mid tone instead of the -ink token', 'VIS-PRAYER-1 (terra, shared pill); F260 and template new', false],
  ['raw-accent', g => (g.colorTok || []).some(t => /^--(accent|tint)$/.test(t)), 'Raw person colour (--accent) used as text', 'hub.js sets --accent to the raw profile hex (apps/hub.js:80); no dark lift', 'NEW (Prayer kitchen, park map)', false],
  ['dw-done', (g, a) => a === 'dollywood' && /^(b|span)$/.test(g.sel.split(' > ').pop()) && /Flatten|✓/.test((g.texts || []).join()), 'Build guide completed steps (opacity .55 + line-through)', 'opacity-dimmed text', 'VIS-DOLLYWOOD-1', false],
  ['dw-min', g => /small$/.test(g.sel) && /MIN/.test((g.texts || []).join()) || /wtile/.test(g.sel), 'Park map wait tiles (white on literal bands; dimmed rows)', 'saturated literal bands + .noride opacity .55', 'VIS-DOLLYWOOD-LIVE-8', false],
  ['timer-blink', g => /#t\.time/.test(g.sel), 'Timer 0:00 blink (65 % phase)', 'blink keyframe to opacity .3 in steps(2)', 'NEW (transient)', false],
  ['over-map', g => g.bgImage, 'Secondary text over map art, photos or glass (provisional)', 'sampled over imagery/unblurred glass', 'various (provisional)', false],
  ['other', () => true, 'Other', '', '', false],
];
const shot = (job, theme) => { const [run, area, name] = job.split('/'); const m = name.match(/^(.*)-(light|dark)-([a-z]+)$/); if (!m) return null; const base = `${m[1]}-${m[2]}`;
  return m[3] === 'system' ? `audits/screens/${area}/${base}.png` : `audits/evidence/p4/measure/shots/${m[3]}/${area}/${base}.png`; };
const comps = {};
for (const a of AREAS) {
  let f = {}; try { f = JSON.parse(fs.readFileSync(path.join(M, a + '.json'))); } catch { continue; }
  for (const [th, groups] of Object.entries(f)) for (const g of groups) {
    if (g.suspect) continue;
    const doc = g.doc === 'page' ? 'shell' : a;          // page text in an app job belongs to the shell
    const r = R.find(([, t]) => t(g, doc, a)); const id = r[0];
    const c = comps[id] ||= { id, label: r[2], cause: r[3], prior: r[4], exempt: r[5], areas: {}, themes: {}, occ: 0, groups: 0, minP10: 99, maxP10: 0, examples: [] };
    c.areas[doc] = (c.areas[doc] || 0) + g.n; c.themes[th] = Math.min(c.themes[th] ?? 99, g.minP10); c.occ += g.n; c.groups++;
    c.minP10 = Math.min(c.minP10, g.minP10); c.maxP10 = Math.max(c.maxP10, g.minP10);
    if (c.examples.length < 6 || g.minP10 < Math.max(...c.examples.map(e => e.p10))) {
      c.examples.push({ area: doc, theme: th, sel: g.sel.split(' > ').slice(-2).join(' > '), text: (g.texts || [])[0], fs: g.fs, fw: g.fw, large: g.large, color: g.color, bg: g.bgMed, p10: g.minP10, med: g.medMedian, n: g.n, job: g.jobs[0], shot: shot(g.jobs[0], th) });
      c.examples.sort((x, y) => x.p10 - y.p10); c.examples = c.examples.slice(0, 6);
    }
  }
}
const list = Object.values(comps).sort((x, y) => (x.exempt - y.exempt) || (y.occ - x.occ));
fs.writeFileSync(path.join(ROOT, 'audits/evidence/p4/COLOR/components.json'), JSON.stringify({ note: 'Non-suspect failing text groups (rig v2 failing-pairs/<area>.json) grouped by component. areas = occurrences per area (page text counted under shell); themes = worst p10 per theme key; examples = the 6 worst groups with a screenshot (Phase 1 capture for system themes, rig named-theme shot otherwise).', components: list }, null, 1));
for (const c of list) console.log(`| ${c.label} | ${Object.entries(c.areas).map(([a, n]) => a + ' ' + n).join(', ')} | ${Object.entries(c.themes).map(([t, v]) => t + ' ' + v).join(', ')} | ${c.minP10}-${c.maxP10} | ${c.occ} | ${c.prior}${c.exempt ? ' (exempt)' : ''} | ${c.examples[0]?.sel} "${c.examples[0]?.text}" ${c.examples[0]?.color} on ${c.examples[0]?.bg} p10 ${c.examples[0]?.p10} med ${c.examples[0]?.med} — ${c.examples[0]?.shot} |`);
