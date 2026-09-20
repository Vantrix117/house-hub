#!/usr/bin/env node
// Writes the hub's illustration set into art/ (and the PNG app icons into icons/ when playwright-core is on NODE_PATH).
// Everything is hand-tuned SVG in the sand/mocha palette; edit the shapes here and re-run — the files are the output.
//   node scripts/make-art.mjs            # art/**
//   node scripts/make-art.mjs --png      # also re-render icons/*.png from icon.svg (needs Chrome + playwright-core)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'art');

// ── palette (mirrors apps/design.css light tokens) ───────────────
const P = { paper: '#FFFCF8', sand: '#EFE7DC', sand2: '#E6DCCE', ink: '#2E251D', mocha: '#8A6A4B', mochaDeep: '#5E4630', mochaSoft: '#F0E6D9',
  gold: '#B4861B', goldSoft: '#F6EBD0', olive: '#5B8143', oliveSoft: '#E6EEDD', teal: '#137F77', tealSoft: '#DCECEA',
  terra: '#BC5A38', terraSoft: '#F7E3DA', slate: '#4F5D8C', slateSoft: '#E4E7F1', night: '#2A2F4A' };
const cream = P.paper;

// ── little helpers ───────────────────────────────────────────────
const svg = (w, h, body, extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" fill="none" ${extra}aria-hidden="true">\n${body}\n</svg>\n`;
const stroke = (d, c, w = 4, more = '') => `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${more}/>`;
const fill = (d, c, more = '') => `<path d="${d}" fill="${c}" ${more}/>`;
const circle = (cx, cy, r, c, more = '') => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${c}" ${more}/>`;
const rays = (cx, cy, r1, r2, n, c, w = 4) => Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI / (n + 1)); return stroke(`M${(cx + Math.cos(a) * r1).toFixed(1)} ${(cy + Math.sin(a) * r1).toFixed(1)}L${(cx + Math.cos(a) * r2).toFixed(1)} ${(cy + Math.sin(a) * r2).toFixed(1)}`, c, w); }).join('');
const star = (cx, cy, r, c) => fill(`M${cx} ${cy - r}l${r * .3} ${r * .7}l${r * .7} ${r * .3}l${-r * .7} ${r * .3}l${-r * .3} ${r * .7}l${-r * .3} ${-r * .7}l${-r * .7} ${-r * .3}l${r * .7} ${-r * .3}z`, c);
const sparkles = (pts, c) => pts.map(([x, y, r]) => star(x, y, r, c)).join('');
const hills = (w, h, c1, c2) => fill(`M0 ${h}c${w * .2} ${-h * .3} ${w * .4} ${-h * .32} ${w * .62} ${-h * .22}s${w * .28} ${h * .1} ${w * .38} ${h * .06}V${h}z`, c1) + fill(`M0 ${h}c${w * .15} ${-h * .12} ${w * .35} ${-h * .18} ${w * .55} ${-h * .1}s${w * .3} ${h * .05} ${w * .45} ${-h * .02}V${h}z`, c2);
const write = (rel, content) => { const f = path.join(OUT, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, content); };

// ── hero art: drawn in cream so it sits on any person's colour ───
const hero = {};
hero.morning = svg(300, 200, [
  rays(190, 116, 52, 70, 5, cream, 5).replace(/stroke="#FFFCF8"/g, `stroke="${cream}" stroke-opacity=".7"`),
  circle(190, 116, 42, cream, 'fill-opacity=".92"'),
  fill('M0 200c60-52 120-66 190-48s90 30 110 48z', cream, 'fill-opacity=".22"'),
  fill('M40 200c70-40 140-44 260-8v8z', cream, 'fill-opacity=".3"'),
].join('\n'));
hero.afternoon = svg(300, 200, [
  circle(228, 62, 34, cream, 'fill-opacity=".92"'),
  fill('M96 118a26 26 0 0 1 50-10 20 20 0 0 1 36 12 18 18 0 0 1-8 34H100a18 18 0 0 1-4-36z', cream, 'fill-opacity=".6"'),
  fill('M0 200c70-40 150-50 300-16v16z', cream, 'fill-opacity=".26"'),
  stroke('M150 50c10-8 20-8 30 0M170 72c8-6 14-6 22 0', cream, 3, 'stroke-opacity=".45"'),
].join('\n'));
hero.evening = svg(300, 200, [
  fill('M226 40a44 44 0 1 0 40 62 36 36 0 0 1-40-62z', cream, 'fill-opacity=".92"'),
  sparkles([[120, 50, 5], [160, 92, 4], [90, 100, 3], [270, 130, 4], [200, 140, 3]], cream).replace(/fill="#FFFCF8"/g, `fill="${cream}" fill-opacity=".85"`),
  fill('M0 200c60-48 140-60 300-30v30z', cream, 'fill-opacity=".24"'),
].join('\n'));
hero.night = svg(300, 200, [
  fill('M230 34a40 40 0 1 0 36 58 32 32 0 0 1-36-58z', cream, 'fill-opacity=".9"'),
  sparkles([[70, 40, 5], [120, 80, 3], [160, 40, 4], [40, 110, 3], [280, 120, 4], [190, 120, 3]], cream).replace(/fill="#FFFCF8"/g, `fill="${cream}" fill-opacity=".8"`),
  fill('M0 200c60-40 140-56 300-26v26z', cream, 'fill-opacity=".2"'),
  stroke('M100 176v-30l22-16 22 16v30M114 176v-14h16v14', cream, 3, 'stroke-opacity=".7"'),
].join('\n'));
hero.play = svg(300, 200, [
  circle(230, 60, 30, cream, 'fill-opacity=".9"'),
  stroke('M60 170c0-40 30-70 70-70s70 30 70 70', cream, 10, 'stroke-opacity=".8"'),
  fill('M0 200c60-30 140-40 300-12v12z', cream, 'fill-opacity=".28"'),
  sparkles([[70, 74, 14], [150, 42, 9], [260, 130, 7]], cream).replace(/fill="#FFFCF8"/g, `fill="${cream}" fill-opacity=".85"`),
].join('\n'));
for (const [k, v] of Object.entries(hero)) write(`hero/${k}.svg`, v);

// ── per-app spot illustrations (200×160, on paper) ───────────────
const app = {};
app.f260 = svg(200, 160, [
  circle(150, 44, 22, P.goldSoft), rays(150, 44, 28, 36, 5, P.gold, 3),
  fill('M30 120V52c22-6 40-4 60 8v70c-20-12-38-14-60-8z', P.slateSoft), fill('M170 120V52c-22-6-40-4-60 8v70c20-12 38-14 60-8z', P.slateSoft),
  stroke('M30 120V52c22-6 40-4 60 8v70c-20-12-38-14-60-8zM170 120V52c-22-6-40-4-60 8v70c20-12 38-14 60-8z', P.slate, 4),
  stroke('M46 70c14-2 26 0 40 6M46 86c14-2 26 0 40 6M154 70c-14-2-26 0-40 6M154 86c-14-2-26 0-40 6', P.slate, 3, 'stroke-opacity=".45"'),
  fill('M118 52v46l8-6 8 6V56c-5-2-10-3-16-4z', P.terra),
  stroke('M22 132c30 6 60 6 78 0 18 6 48 6 78 0', P.mocha, 3, 'stroke-opacity=".5"'),
].join('\n'));
app.leftovers = svg(200, 160, [
  stroke('M76 30c-6 10 6 16 0 26M100 24c-6 10 6 16 0 26M124 30c-6 10 6 16 0 26', P.teal, 3, 'stroke-opacity=".55"'),
  fill('M40 78h120v10a60 60 0 0 1-120 0z', P.oliveSoft), stroke('M40 78h120v10a60 60 0 0 1-120 0z', P.olive, 4),
  stroke('M52 78c0-16 20-26 48-26s48 10 48 26', P.olive, 4), stroke('M100 52v-8M90 44h20', P.olive, 4),
  fill('M148 96h34v40a8 8 0 0 1-8 8h-18a8 8 0 0 1-8-8z', P.goldSoft), stroke('M148 96h34v40a8 8 0 0 1-8 8h-18a8 8 0 0 1-8-8zM146 96h38M154 90h22', P.gold, 3),
  stroke('M70 146h60', P.mocha, 3, 'stroke-opacity=".5"'),
].join('\n'));
app.prayer = svg(200, 160, [
  fill('M100 28c10 14 22 26 22 44a22 22 0 0 1-44 0c0-8 3-14 8-18 3 8 8 11 12 11 2-12-6-22 2-37z', P.goldSoft),
  stroke('M100 28c10 14 22 26 22 44a22 22 0 0 1-44 0c0-8 3-14 8-18 3 8 8 11 12 11 2-12-6-22 2-37z', P.gold, 3.5),
  fill('M84 98h32v42H84z', P.mochaSoft), stroke('M84 98h32v42H84zM78 140h44', P.mocha, 4),
  stroke('M40 128c10-14 22-18 34-14M160 128c-10-14-22-18-34-14', P.olive, 4),
  fill('M40 128c4-8 10-12 18-12-2 8-8 12-18 12zM160 128c-4-8-10-12-18-12 2 8 8 12 18 12z', P.olive),
  sparkles([[140, 44, 6], [56, 60, 5]], P.gold),
].join('\n'));
app.tally = svg(200, 160, [
  fill('M60 34h80a12 12 0 0 1 12 12v76a12 12 0 0 1-12 12H60a12 12 0 0 1-12-12V46a12 12 0 0 1 12-12z', P.tealSoft),
  stroke('M60 34h80a12 12 0 0 1 12 12v76a12 12 0 0 1-12 12H60a12 12 0 0 1-12-12V46a12 12 0 0 1 12-12z', P.teal, 4),
  fill('M64 50h72v30H64z', P.paper), stroke('M64 50h72v30H64z', P.teal, 3),
  stroke('M76 65h14M84 58v14M104 65h18M104 72l8-14', P.teal, 3.5),
  circle(100, 108, 14, P.teal), stroke('M100 100v16M92 108h16', cream, 3.5),
  circle(36, 44, 4, P.terra), circle(168, 36, 3, P.gold), circle(176, 116, 4, P.olive), circle(28, 120, 3, P.slate),
].join('\n'));
app.timer = svg(200, 160, [
  stroke('M100 34v-10M88 24h24', P.terra, 4), stroke('M144 46l8-8', P.terra, 4),
  circle(100, 92, 48, P.terraSoft), stroke('M100 92m-48 0a48 48 0 1 0 96 0a48 48 0 1 0-96 0', P.terra, 4),
  fill('M100 92 L100 52 A40 40 0 0 1 134 72z', P.terra, 'fill-opacity=".35"'),
  stroke('M100 92V56M100 92l24 14', P.terra, 4), circle(100, 92, 4, P.terra),
  stroke('M100 48v6M144 92h-6M100 136v-6M56 92h6', P.terra, 3),
  stroke('M40 148h120', P.mocha, 3, 'stroke-opacity=".5"'),
].join('\n'));
app.dollywood = svg(200, 160, [
  fill('M10 132c30-60 60-90 90-90s60 30 90 90z', P.oliveSoft),
  fill('M60 132c14-40 28-60 40-60s26 20 40 60z', P.olive, 'fill-opacity=".45"'),
  stroke('M16 128c26-50 54-76 84-76s58 26 84 76', P.olive, 4),
  stroke('M30 120c20-44 44-66 70-66M60 128v-26M84 128v-46M108 128v-52M132 128v-44M156 128v-28', P.mocha, 3, 'stroke-opacity=".7'),
  stroke('M30 120c20-44 44-66 70-66', P.terra, 5),
  fill('M92 40h16l4 10H88z', P.terra), circle(100, 34, 6, P.terra),
  stroke('M12 136h176', P.mocha, 3, 'stroke-opacity=".5"'),
].join('\n').replace('stroke-opacity=".7', 'stroke-opacity=".7"'));
app['dollywood-live'] = svg(200, 160, [
  fill('M0 160c50-40 120-46 200-10v10z', P.oliveSoft),
  stroke('M30 130c30-20 60-14 80-30s30-40 60-44', P.mocha, 4, 'stroke-dasharray="8 8" stroke-opacity=".6"'),
  fill('M100 20a34 34 0 0 1 34 34c0 26-34 56-34 56S66 80 66 54a34 34 0 0 1 34-34z', P.slateSoft),
  stroke('M100 20a34 34 0 0 1 34 34c0 26-34 56-34 56S66 80 66 54a34 34 0 0 1 34-34z', P.slate, 4),
  circle(100, 54, 12, P.slate), circle(100, 54, 5, cream),
  circle(40, 120, 8, P.terra), circle(170, 66, 8, P.gold), circle(150, 128, 8, P.teal),
].join('\n'));
app.chat = svg(200, 160, [
  fill('M30 40h100a12 12 0 0 1 12 12v40a12 12 0 0 1-12 12H70l-24 20V104H30a12 12 0 0 1-12-12V52a12 12 0 0 1 12-12z', P.tealSoft),
  stroke('M30 40h100a12 12 0 0 1 12 12v40a12 12 0 0 1-12 12H70l-24 20V104H30a12 12 0 0 1-12-12V52a12 12 0 0 1 12-12z', P.teal, 4),
  stroke('M46 66h68M46 82h44', P.teal, 4, 'stroke-opacity=".6"'),
  fill('M110 92h58a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10h-6l14 14-30-14h-36a10 10 0 0 1-10-10v-28a10 10 0 0 1 10-10z', P.goldSoft),
  stroke('M110 92h58a10 10 0 0 1 10 10v28a10 10 0 0 1-10 10h-6l14 14-30-14h-36a10 10 0 0 1-10-10v-28a10 10 0 0 1 10-10z', P.gold, 3.5),
  sparkles([[146, 122, 10]], P.gold),
].join('\n'));
app.reminders = svg(200, 160, [
  fill('M100 30c-22 0-36 16-36 38v22l-14 18h100l-14-18V68c0-22-14-38-36-38z', P.goldSoft),
  stroke('M100 30c-22 0-36 16-36 38v22l-14 18h100l-14-18V68c0-22-14-38-36-38zM88 120a12 12 0 0 0 24 0', P.gold, 4),
  stroke('M100 30v-8', P.gold, 4), stroke('M40 56c4-14 12-22 24-26M160 56c-4-14-12-22-24-26', P.gold, 3, 'stroke-opacity=".5"'),
  circle(140, 44, 12, P.terra), stroke('M136 44l3 3 6-6', cream, 3),
].join('\n'));
app.feed = svg(200, 160, [
  fill('M40 140V78l60-46 60 46v62z', P.mochaSoft), stroke('M40 140V78l60-46 60 46v62H40z', P.mocha, 4),
  stroke('M86 140v-34h28v34', P.mocha, 4), fill('M86 106h28v34H86z', P.goldSoft),
  stroke('M124 62V44h12v28', P.mocha, 4),
  stroke('M130 40c-6-10 6-16 0-26', P.mocha, 3, 'stroke-opacity=".45"'),
  circle(64, 96, 8, P.slateSoft), stroke('M64 88v16M56 96h16', P.slate, 2.5),
  fill('M0 160c60-14 140-14 200 0z', P.oliveSoft),
].join('\n'));
app.kidverse = svg(200, 160, [
  // an open storybook with a big gold star rising out of it, and a few small ones caught in the air
  fill('M30 124V64c22-8 44-6 70 6v62c-26-12-48-14-70-6z', P.goldSoft), fill('M170 124V64c-22-8-44-6-70 6v62c26-12 48-14 70-6z', P.goldSoft),
  stroke('M30 124V64c22-8 44-6 70 6v62c-26-12-48-14-70-6zM170 124V64c-22-8-44-6-70 6v62c26-12 48-14 70-6z', P.mocha, 4),
  stroke('M46 80c14-2 26 0 40 6M46 96c14-2 26 0 40 6M154 80c-14-2-26 0-40 6M154 96c-14-2-26 0-40 6', P.mocha, 3, 'stroke-opacity=".45"'),
  star(100, 40, 26, P.gold), star(100, 40, 14, P.goldSoft),
  sparkles([[46, 34, 7], [156, 30, 6], [140, 58, 5], [62, 56, 4]], P.gold),
  stroke('M22 138c30 6 60 6 78 0 18 6 48 6 78 0', P.mocha, 3, 'stroke-opacity=".5"'),
].join('\n'));
app.verses = svg(200, 160, [
  // Verses (roadmap 19): an open book with a tick on the right page (a verse recited from memory) and five little
  // Leitner boxes stepping up along the bottom — the verse climbs a box each time it is got right
  fill('M30 106V46c22-8 44-6 70 6v62c-26-12-48-14-70-6z', P.oliveSoft), fill('M170 106V46c-22-8-44-6-70 6v62c26-12 48-14 70-6z', P.oliveSoft),
  stroke('M30 106V46c22-8 44-6 70 6v62c-26-12-48-14-70-6zM170 106V46c-22-8-44-6-70 6v62c26-12 48-14 70-6z', P.olive, 4),
  stroke('M46 62c14-2 26 0 40 6M46 78c14-2 26 0 40 6M46 94c10-1 20 0 30 3', P.olive, 3, 'stroke-opacity=".45"'),
  circle(134, 76, 17, P.goldSoft), stroke('M126 76l6 6 11-12', P.gold, 4),
  fill('M24 148h20v-12H24zM52 148h20v-18H52zM80 148h20v-24H80zM108 148h20v-30h-20zM136 148h20v-36h-20z', P.sand2),
  stroke('M24 148h20v-12H24zM52 148h20v-18H52zM80 148h20v-24H80zM108 148h20v-30h-20zM136 148h20v-36h-20z', P.olive, 3, 'stroke-opacity=".6"'),
  star(160, 118, 8, P.gold),
].join('\n'));
for (const [k, v] of Object.entries(app)) write(`app/${k}.svg`, v);

// ── empty states (220×140) ───────────────────────────────────────
const empty = {};
empty.fridge = svg(220, 140, [
  fill('M60 20h100a10 10 0 0 1 10 10v90a10 10 0 0 1-10 10H60a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10z', P.tealSoft),
  stroke('M60 20h100a10 10 0 0 1 10 10v90a10 10 0 0 1-10 10H60a10 10 0 0 1-10-10V30a10 10 0 0 1 10-10zM50 62h120M50 96h120M64 44v8M64 76v10', P.teal, 3.5),
  fill('M126 70h22v22h-22z', P.goldSoft), stroke('M126 70h22v22h-22zM124 70h26', P.gold, 2.5),
  fill('M0 140c40-10 180-10 220 0z', P.sand),
].join('\n'));
empty.list = svg(220, 140, [
  fill('M70 22h80a10 10 0 0 1 10 10v86a10 10 0 0 1-10 10H70a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10z', P.mochaSoft),
  stroke('M70 22h80a10 10 0 0 1 10 10v86a10 10 0 0 1-10 10H70a10 10 0 0 1-10-10V32a10 10 0 0 1 10-10z', P.mocha, 3.5),
  fill('M94 14h32a8 8 0 0 1 8 8v8H86v-8a8 8 0 0 1 8-8z', P.mocha),
  stroke('M80 58h60M80 78h44M80 98h52', P.mocha, 3, 'stroke-opacity=".35" stroke-dasharray="6 8"'),
  sparkles([[176, 40, 7], [40, 100, 5]], P.gold),
].join('\n'));
empty.chat = svg(220, 140, [
  fill('M50 30h120a12 12 0 0 1 12 12v44a12 12 0 0 1-12 12H100l-28 22V98H50a12 12 0 0 1-12-12V42a12 12 0 0 1 12-12z', P.tealSoft),
  stroke('M50 30h120a12 12 0 0 1 12 12v44a12 12 0 0 1-12 12H100l-28 22V98H50a12 12 0 0 1-12-12V42a12 12 0 0 1 12-12z', P.teal, 3.5),
  circle(86, 64, 6, P.teal), circle(110, 64, 6, P.teal), circle(134, 64, 6, P.teal),
  sparkles([[190, 26, 8]], P.gold),
].join('\n'));
empty.feed = svg(220, 140, [
  fill('M60 120V66l50-38 50 38v54z', P.mochaSoft), stroke('M60 120V66l50-38 50 38v54H60z', P.mocha, 3.5),
  stroke('M98 120v-28h24v28', P.mocha, 3.5),
  fill('M124 50V36h10v22z', P.mocha),
  sparkles([[40, 40, 6], [180, 30, 5], [190, 90, 4]], P.gold),
  fill('M0 140c40-16 180-16 220 0z', P.oliveSoft),
].join('\n'));
empty.prayers = svg(220, 140, [
  fill('M110 24c8 12 18 22 18 36a18 18 0 0 1-36 0c0-7 3-12 7-15 2 7 6 9 10 9 1-10-5-18 1-30z', P.goldSoft),
  stroke('M110 24c8 12 18 22 18 36a18 18 0 0 1-36 0c0-7 3-12 7-15 2 7 6 9 10 9 1-10-5-18 1-30z', P.gold, 3),
  fill('M96 84h28v36H96z', P.mochaSoft), stroke('M96 84h28v36H96zM90 120h40', P.mocha, 3.5),
  stroke('M56 110c8-12 18-16 28-12M164 110c-8-12-18-16-28-12', P.olive, 3.5),
].join('\n'));
for (const [k, v] of Object.entries(empty)) write(`empty/${k}.svg`, v);

// ── story art for the kid verse (240×160), one per theme ─────────
const story = {};
const sky = (c) => fill('M0 0h240v160H0z', c);
story['01-creation'] = svg(240, 160, [sky(P.slateSoft), circle(70, 50, 26, P.gold), rays(70, 50, 32, 42, 5, P.gold, 3), fill('M186 40a26 26 0 1 0 22 38 20 20 0 0 1-22-38z', cream), hills(240, 160, P.oliveSoft, P.olive), stroke('M120 150V96', P.mocha, 5), circle(120, 84, 24, P.olive), circle(104, 96, 14, P.olive), circle(136, 96, 14, P.olive)].join('\n'));
story['02-flood'] = svg(240, 160, [sky(P.slateSoft), stroke('M20 70a100 100 0 0 1 200 0', P.terra, 6), stroke('M32 70a88 88 0 0 1 176 0', P.gold, 6), stroke('M44 70a76 76 0 0 1 152 0', P.olive, 6), stroke('M56 70a64 64 0 0 1 128 0', P.teal, 6), fill('M70 100h100l-10 30H80z', P.mocha), fill('M88 76h64v24H88z', P.goldSoft), stroke('M88 76h64v24H88z', P.mocha, 3), fill('M0 160v-30c30-10 60 10 90 0s60-10 90 0 40 10 60 0v30z', P.tealSoft), stroke('M0 132c30-10 60 10 90 0s60-10 90 0 40 10 60 0', P.teal, 4)].join('\n'));
story['03-promise'] = svg(240, 160, [sky(P.night), sparkles([[30, 30, 5], [70, 60, 3], [120, 24, 6], [170, 50, 4], [210, 28, 5], [200, 90, 3], [90, 90, 3]], cream), fill('M60 150l50-70 50 70z', P.goldSoft), stroke('M60 150l50-70 50 70zM110 150v-40', P.gold, 4), fill('M0 160v-14c60-16 180-16 240 0v14z', P.mochaDeep)].join('\n'));
story['04-exodus'] = svg(240, 160, [sky(P.goldSoft), circle(200, 36, 20, P.gold), fill('M0 60c40 20 40 40 0 60v40h90V60z', P.teal), fill('M240 60c-40 20-40 40 0 60v40h-90V60z', P.teal), stroke('M30 80c20 8 20 20 0 30M210 80c-20 8-20 20 0 30', cream, 3, 'stroke-opacity=".6"'), fill('M90 60h60v100H90z', P.sand), stroke('M110 130v-24M130 130v-24M120 100v-14', P.mocha, 4), circle(110, 100, 5, P.mocha), circle(130, 100, 5, P.mocha), circle(120, 80, 5, P.mocha)].join('\n'));
story['05-law'] = svg(240, 160, [sky(P.slateSoft), fill('M0 160c40-60 80-100 120-100s80 40 120 100z', P.mocha), fill('M60 160c20-40 40-60 60-60s40 20 60 60z', P.mochaDeep), fill('M96 46h20a10 10 0 0 1 10 10v50H86V56a10 10 0 0 1 10-10zM126 46h20a10 10 0 0 1 10 10v50h-40V56a10 10 0 0 1 10-10z', P.goldSoft), stroke('M96 46h20a10 10 0 0 1 10 10v50H86V56a10 10 0 0 1 10-10zM126 46h20a10 10 0 0 1 10 10v50h-40V56a10 10 0 0 1 10-10zM96 66h20M96 78h20M126 66h20M126 78h20', P.gold, 3), fill('M50 40a20 20 0 0 1 40 0 14 14 0 0 1 26 8 12 12 0 0 1-6 22H54a14 14 0 0 1-4-30z', cream)].join('\n'));
story['06-kings'] = svg(240, 160, [sky(P.terraSoft), fill('M70 110l10-50 30 24 10-40 10 40 30-24 10 50z', P.gold), stroke('M70 110l10-50 30 24 10-40 10 40 30-24 10 50z', P.mochaDeep, 3), fill('M70 110h100v20H70z', P.terra), circle(90, 120, 5, P.teal), circle(120, 120, 5, P.slate), circle(150, 120, 5, P.teal), stroke('M190 40c-20 20-24 50-12 78M190 40c10 10 14 24 12 40', P.mocha, 4), stroke('M186 60l10-4M184 76l14-6M186 92l16-6', P.mocha, 3), fill('M0 160v-20h240v20z', P.mocha)].join('\n'));
story['07-prophets'] = svg(240, 160, [sky(P.slateSoft), fill('M40 40h120v90H40z', P.goldSoft), stroke('M40 40h120v90H40z', P.gold, 3), stroke('M56 60h88M56 76h70M56 92h88M56 108h50', P.mocha, 3, 'stroke-opacity=".5"'), circle(40, 40, 8, P.gold), circle(40, 130, 8, P.gold), circle(160, 40, 8, P.gold), circle(160, 130, 8, P.gold), fill('M196 40c8 14 18 26 18 40a18 18 0 0 1-36 0c0-7 3-12 7-15 2 7 6 9 10 9 1-10-5-18 1-34z', P.terra), fill('M196 60c4 8 10 14 10 20a10 10 0 0 1-20 0c0-6 6-12 10-20z', P.gold)].join('\n'));
story['08-exile'] = svg(240, 160, [sky(P.slateSoft), fill('M0 110c40-10 80 10 120 0s80-10 120 0v50H0z', P.tealSoft), stroke('M0 112c40-10 80 10 120 0s80-10 120 0', P.teal, 4), stroke('M60 110V50', P.mocha, 6), stroke('M60 50c-20 10-30 40-24 60M60 50c20 10 30 40 24 60M60 50c0 20-4 40 0 60M60 50c-10 24-6 40 4 56', P.olive, 4), stroke('M160 90c10-16 24-18 40-10M170 100c10-10 20-10 30-4', P.mocha, 3, 'stroke-opacity=".5"'), circle(200, 40, 18, cream)].join('\n'));
story['09-nativity'] = svg(240, 160, [sky(P.night), sparkles([[30, 40, 4], [200, 60, 3], [60, 90, 3], [220, 20, 4]], cream), star(120, 30, 16, P.gold), stroke('M120 46v20', P.gold, 3, 'stroke-opacity=".6"'), fill('M50 150V90l70-40 70 40v60z', P.mocha), fill('M64 150V96l56-32 56 32v54z', P.goldSoft), stroke('M50 150V90l70-40 70 40v60', P.mochaDeep, 4), fill('M96 126h48a6 6 0 0 1 6 6v10H90v-10a6 6 0 0 1 6-6z', P.terra), circle(120, 120, 10, cream), fill('M0 160v-10h240v10z', P.mochaDeep)].join('\n'));
story['10-teaching'] = svg(240, 160, [sky(P.slateSoft), fill('M0 160c60-70 120-70 240-20v20z', P.olive), fill('M0 160c40-50 100-50 160-30v30z', P.oliveSoft), circle(190, 40, 22, P.gold), circle(120, 74, 10, P.terra), fill('M108 84h24l6 30H102z', P.terra), ...[[40, 130], [70, 120], [100, 128], [140, 128], [170, 120], [200, 130]].map(([x, y]) => circle(x, y, 7, P.mocha) + fill(`M${x - 9} ${y + 8}h18l4 16h-26z`, P.mocha))].join('\n'));
story['11-cross'] = svg(240, 160, [sky(P.goldSoft), circle(120, 110, 60, P.gold, 'fill-opacity=".35"'), circle(120, 110, 36, P.gold, 'fill-opacity=".5"'), fill('M0 160c40-30 80-40 120-40s80 10 120 40z', P.mochaDeep), stroke('M120 120V40M100 60h40', P.mochaDeep, 8), stroke('M60 124V70M46 84h28M180 124V70M166 84h28', P.mochaDeep, 6)].join('\n'));
story['12-church'] = svg(240, 160, [sky(P.tealSoft), fill('M130 60c-10-12-26-14-38-6-8 6-12 16-10 26 8 0 14 4 20 10 4-12 14-20 28-30z', cream), stroke('M130 60c-10-12-26-14-38-6-8 6-12 16-10 26 8 0 14 4 20 10 4-12 14-20 28-30z', P.teal, 3), fill('M130 60c10-6 22-6 30 2-8 4-14 10-18 18-6-6-10-10-12-20z', cream), stroke('M130 60c10-6 22-6 30 2-8 4-14 10-18 18-6-6-10-10-12-20z', P.teal, 3), ...[[40, 140], [80, 146], [120, 140], [160, 146], [200, 140]].map(([x, y]) => fill(`M${x} ${y - 30}c4 6 10 12 10 20a10 10 0 0 1-20 0c0-8 6-14 10-20z`, P.terra) + fill(`M${x} ${y - 18}c2 4 5 7 5 10a5 5 0 0 1-10 0c0-3 3-6 5-10z`, P.gold))].join('\n'));
for (const [k, v] of Object.entries(story)) write(`story/${k}.svg`, v);

// ── ambient backdrops for the TV (1600×900) ──────────────────────
const amb = (id, top, mid, h1, h2, extra) => svg(1600, 900, [
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${mid}"/></linearGradient></defs>`,
  `<rect width="1600" height="900" fill="url(#${id})"/>`, extra,
  fill('M0 900V640c200-90 400-110 640-60s420 60 960 -40V900z', h1, 'fill-opacity=".9"'),
  fill('M0 900V740c260-70 520-60 800-10s500 40 800-30V900z', h2),
].join('\n'));
const ambient = {
  dawn: amb('gd', P.slateSoft, P.goldSoft, P.oliveSoft, P.olive, circle(1180, 560, 90, P.gold, 'fill-opacity=".7"')),
  day: amb('gy', P.tealSoft, cream, P.oliveSoft, P.olive, circle(1240, 200, 80, P.gold) + fill('M300 300a70 70 0 0 1 134-26 54 54 0 0 1 96 30 48 48 0 0 1-20 92H310a48 48 0 0 1-10-96z', cream)),
  dusk: amb('gk', P.slate, P.terra, P.mochaDeep, P.night, circle(400, 600, 110, P.gold, 'fill-opacity=".8"')),
  night: amb('gn', P.night, P.mochaDeep, P.mochaDeep, P.ink, fill('M1220 160a120 120 0 1 0 108 176 96 96 0 0 1-108-176z', cream, 'fill-opacity=".9"') + sparkles([[200, 120, 8], [420, 220, 6], [700, 90, 9], [980, 260, 6], [1500, 120, 7], [1400, 380, 5], [600, 330, 5]], cream)),
};
for (const [k, v] of Object.entries(ambient)) write(`ambient/${k}.svg`, v);

// ── the app icon, refreshed: a warm house at dawn ────────────────
const icon = svg(180, 180, [
  '<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A88461"/><stop offset="1" stop-color="#6B4F35"/></linearGradient></defs>',
  '<rect width="180" height="180" rx="40" fill="url(#bg)"/>',
  circle(128, 56, 22, cream, 'fill-opacity=".35"'),
  fill('M0 180v-46c40-24 80-30 120-16s40 16 60 6v56z', cream, 'fill-opacity=".14"'),
  fill('M42 92 90 50l48 42v46H42z', cream, 'fill-opacity=".18"'),
  stroke('M42 92 90 50l48 42', cream, 11), stroke('M52 86v52h76V86', cream, 11), stroke('M78 138v-28h24v28', cream, 11),
  fill('M112 58h12v20h-12z', cream, 'rx="3"'),
].join('\n'));
fs.writeFileSync(path.join(ROOT, 'icon.svg'), icon);

// ── inventory + size guard ───────────────────────────────────────
const files = []; (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const f = path.join(d, e.name); if (e.isDirectory()) walk(f); else if (f.endsWith('.svg')) files.push(path.relative(ROOT, f).replace(/\\/g, '/')); } })(OUT);
const total = files.reduce((n, f) => n + fs.statSync(path.join(ROOT, f)).size, 0);
fs.writeFileSync(path.join(OUT, 'README.md'), `# art/

The hub's illustration set — hand-tuned SVG in the sand/mocha palette, generated by \`scripts/make-art.mjs\`
(edit the shapes there, re-run, commit the output). ${files.length} files, ${(total / 1024).toFixed(0)} KB. All precached by \`sw.js\`.

| Folder | For | Size |
|---|---|---|
| \`hero/\` | Home hero art by time of day (\`morning\`, \`afternoon\`, \`evening\`, \`night\`) and \`play\` for kids; drawn in cream so it sits on any person's colour | 300×200 |
| \`app/\` | One spot illustration per app (same id as \`apps.json\`) plus \`chat\`, \`reminders\`, \`feed\` — Home cards, app heroes, empty screens | 200×160 |
| \`empty/\` | Empty states: \`fridge\`, \`list\`, \`chat\`, \`feed\`, \`prayers\` | 220×140 |
| \`story/\` | Twelve scenes for the kid verse / F260 companion, by theme: creation, flood, promise, exodus, law, kings, prophets, exile, nativity, teaching, cross, church | 240×160 |
| \`ambient/\` | TV backdrops: \`dawn\`, \`day\`, \`dusk\`, \`night\` | 1600×900 |

Use them as \`<img src="art/app/f260.svg" alt="">\` (decorative, so empty alt). Tile icons stay in \`icons/\` (duotone, \`currentColor\`).
`);
console.log(`${files.length} svg files, ${(total / 1024).toFixed(1)} KB`);
files.forEach(f => console.log('  ' + f));

// ── PNG app icons from icon.svg (optional) ───────────────────────
if (process.argv.includes('--png')) {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(import.meta.url)('playwright-core');
  const exe = ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].find(p => fs.existsSync(p));
  const b = await chromium.launch({ headless: true, executablePath: exe });
  const render = async (size, pad, out) => {
    const page = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const inner = size - 2 * pad;
    await page.setContent(`<html><body style="margin:0;background:${pad ? '#8A6A4B' : 'transparent'}"><img src="data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}" style="position:absolute;left:${pad}px;top:${pad}px;width:${inner}px;height:${inner}px"></body></html>`);
    await page.screenshot({ path: path.join(ROOT, 'icons', out), omitBackground: !pad });
    await page.close(); console.log('  icons/' + out);
  };
  await render(512, 0, 'icon-512.png'); await render(192, 0, 'icon-192.png'); await render(180, 0, 'apple-touch-icon.png'); await render(512, 64, 'icon-512-maskable.png');
  await b.close();
}
