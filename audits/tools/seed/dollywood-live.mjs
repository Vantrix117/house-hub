// Dollywood park map (apps/dollywood-live.html, app id 'dollywood-live', data-scope "both" at :684).
//   empty     nothing
//   typical   an ordinary Tuesday at home: only the kids' measured heights (they persist between park days)
//   park      typical + a park day: Eli, Mae, Elizabeth and Ezra are in the park and sharing, Ezra's beacon is on,
//             Mae dropped a meeting point 12 minutes ago
//   overflow  also a park day (OVERFLOW_IS_PARK_DAY): everyone who can share, with long names, clustered so markers and
//             labels collide, one faded (52 min), one arriving from the parking lots (edge marker), one at the far end
//             of Wildwood Grove, one row from yesterday lunchtime (greyed in Family), a long meeting-point name and note
//
// Positions are map metres in the page's own frame (x east, y north; frame 1534.9 x 2211.5, D.wm/D.hm), taken from the
// listing positions in the embedded payload (D.official[].pos, :682) so everyone stands beside a real ride.
// Freshness rules the app applies: markers hidden after 4 h and faded after 45 min (:1212-1214), rows deleted after 24 h
// (:1255), the meeting point shown only if under 2 h old (:1579), the pill's "nearest family" line under 20 min (:1603).
// Home's "At the park" card (index.html:872-877) counts loc:* rows fresher than 4 h — so a park day on the map is a
// park day on Home too.

// Overflow is a park day as well, so the map and the Family pane can show many markers and long names at once.
// Set to false to keep overflow a plain day (then Home's overflow shows no park card and the map no family).
export const OVERFLOW_IS_PARK_DAY = true;

export default function dollywoodLive(h) {
  if (h.empty) return;
  const app = 'dollywood-live';

  // kid:<kidId> — family scope, { height_in, at, by }: read by kidHeight() at :1539, written by the Family pane's
  // height stepper at :1548 (hub.set('kid:'+id, {height_in, at: Date.now(), by: hub.profile.id}, {scope:'family'})).
  // Measured at home by Elizabeth late last month; kept on ordinary days too (the ride filter needs them before the next visit).
  h.family(app, 'kid:ezra', { height_in: 43, at: h.time(-24, '18:20'), by: 'mom' }, h.time(-24, '18:20'));
  h.family(app, 'kid:kiara', { height_in: 40, at: h.time(-24, '18:22'), by: 'mom' }, h.time(-24, '18:22'));

  const parkDay = h.park || (h.overflow && OVERFLOW_IS_PARK_DAY);
  if (!parkDay) return;

  const P = Object.fromEntries(h.profiles().map(p => [p.id, p]));
  // loc:<profileId> — family scope, { x, y, acc, hdg, t, name, emoji, color }: written by publish() at :1253
  // (x/y rounded metres, acc metres or null, hdg degrees or null, t = ms of the fix, name/emoji/color from hub.profile),
  // listed by loadFam() at :1254, drawn by drawFam() at :1212-1221, listed in the Family pane at :1303-1304.
  const loc = (id, x, y, mins, acc, hdg = null) => {
    const p = P[id] || {};
    const t = h.ago(mins);
    h.family(app, 'loc:' + id, { x, y, acc, hdg, t, name: p.name || id, emoji: p.emoji || '•', color: p.color || '#8A6A4B' }, t);
  };
  // share — person scope, boolean: shareOn() at :694, set by the Share my spot switch at :1310. On for each adult sharing.
  const share = id => h.person(id, app, 'share', true, Math.min(h.time(0, '08:05'), h.ago(15)));
  // kidshare:<kidId> — family scope, boolean: VIEW_ONLY/kidBeaconOn at :693/:1601, set by an adult's switch at :1308.
  const beacon = id => h.family(app, 'kidshare:' + id, true, Math.min(h.time(0, '08:07'), h.ago(15)));
  // meet — family scope, { x, y, name, note, by, byName, at }: loadMeet() at :1579 (shown under 2 h), setMeet() at :1586
  // (note is '' from the app; only POST /api/dollywood/rally carries one, worker/src/index.js:97-110), activity at :1587.
  const meet = (by, x, y, name, note, mins) => {
    const at = h.ago(mins);
    h.family(app, 'meet', { x, y, name, note, by, byName: (P[by] || {}).name || by, at }, at);
    h.activity(by, app, `Meeting point: ${name}`, at);
  };

  if (h.park) {
    // Timber Canyon / Wildwood Grove, a few minutes apart (listing positions: Thunderhead #28 [759,847],
    // Till & Harvest Food Hall #144 [865,781], Great Tree Swing #134 [843,855], The Wildwood Tree #138 [855,921]).
    for (const id of ['eli', 'christian', 'mom']) share(id);
    beacon('ezra');
    loc('eli', 762, 842, 2, 6, 210);          // in the Thunderhead queue
    loc('christian', 866, 784, 4, 8, null);   // coffee at Till & Harvest
    loc('mom', 842, 858, 3, 5, 95);           // Great Tree Swing, with Ezra
    loc('ezra', 847, 864, 1, 9, null);        // his beacon, beside Mom
    meet('christian', 855, 921, 'The Wildwood Tree', '', 12);
    return;
  }

  // overflow: everyone who can share, long names, markers stacked on each other around Thunderhead and the Great Tree Swing.
  // Only people who could have written a row: not Mea (story.mjs HOUSEHOLD: she has never signed in) and not Cousin
  // Theodore (his guest profile ended yesterday at 8:40 am, story.mjs GUESTS expires -1, before any row under 24 h old).
  for (const id of ['eli', 'christian', 'mom', 'dad', 'guest-grandmajo', 'guest-auntwil', 'guest-pastor']) share(id);
  beacon('ezra'); beacon('kiara');
  loc('eli', 762, 842, 2, 6, 210);
  loc('christian', 768, 836, 3, 12, null);          // same queue as Eli: her label collides with his dot and label
  loc('mom', 842, 858, 3, 5, 95);                   // Great Tree Swing with both kids: three labels stacked
  loc('ezra', 846, 862, 1, 9, null);
  loc('kiara', 839, 861, 1, 14, null);
  loc('guest-grandmajo', 866, 784, 52, 10, null);    // Till & Harvest, 52 min ago: faded (over 45 min)
  loc('guest-auntwil', 931, 1141, 38, 18, null);     // NightFlight Expedition #136, the far end of Wildwood Grove
  loc('guest-pastor', 700, 2361, 6, 25, 20);         // 150 m north of the frame: the parking lots and tram road (edge marker)
  loc('dad', 1002, 473, 60 * 20, 9, null);           // Tennessee Tornado at lunchtime yesterday (20 h ago): kept (under 24 h), greyed in Family, off the map
  // the app caps a Meet-here name at 38 chars + '…' (:1590); the note can only come from the rally API (140 max)
  meet('christian', 554, 791, 'TimeSaver & Special Experiences Reserv…',
    'By the big window next to the ride accessibility desk — bring the stroller, Grandma Josephine is holding the bags', 18);
}
