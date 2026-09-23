// Shell seed: the family reminders on Home, the family photo album (TV backdrop, Me → Family album) and the feed
// lines the shell itself posts for them. Runs after the app seeds (SEED_ORDER in seed.mjs), so every name here is
// read back from the profiles table (long names in the overflow variant).
//
//   empty     nothing
//   typical   4 reminders (+1 cleared yesterday), 6 album photos
//   park      same as typical
//   overflow  15 long reminders (+2 cleared), 12 album photos
//
// All content is invented.

// Reminders: family scope, app 'reminders', one row per item.
// Shape = what the Home add form writes, index.html:1210-1211:
//   hub.set('item:' + id, { id, text, by: p.id, byName: p.name, createdAt: Date.now() }, { app: 'reminders', scope: 'family' })
// renderReminders (index.html:1218-1227) sorts by createdAt and shows text + byName; Done (adults only) removes the row.
const TYPICAL_REMINDERS = [
  { by: 'dad',       at: [-1, '19:12'], text: 'Trash and recycling go out tonight' },
  { by: 'mom',       at: [-1, '20:05'], text: 'Library books are due Thursday. They are in the basket by the door' },
  { by: 'christian', at: [0, '07:15'],  text: 'Church potluck Sunday: we are bringing the baked ziti' },
  // Eli added this one from the Chat tab (seed/chat.mjs replays that exchange): same row shape (worker/src/chat.js:195),
  // feed line with ' (via chat)' (chat.js:197)
  { by: 'eli',       at: [0, '08:15'],  text: 'Kiara has her dentist check-up Friday at 3:30', via: 'chat' },
];
// A reminder someone ticked off yesterday: a tombstone row plus the shell's "Cleared the reminder" feed line.
const TYPICAL_CLEARED = [
  { by: 'mom', at: [-1, '17:40'], done: [-1, '18:20'], text: 'Pick up the photos from the pharmacy' },
];

// Overflow: long texts (the form allows 140 characters, index.html:1204) from the four adults who have signed in (never
// Mea, see ALBUM_BY), so the list runs long.
const OVERFLOW_REMINDERS = [
  { by: 'dad',       at: [-6, '18:02'], text: 'Trash and recycling go out Tuesday night, and the yard waste bags go to the curb on the first Wednesday of the month' },
  { by: 'mom',       at: [-6, '20:31'], text: 'Library books due Thursday: the dinosaur book, both bird guides and the big picture Bible are in the basket by the door' },
  { by: 'christian', at: [-5, '07:48'], text: 'Church potluck on Sunday after the second service. We signed up for the baked ziti and two dozen of the lemon cookies' },
  { by: 'eli',       at: [-5, '12:10'], text: 'Kiara has her dentist check-up on Friday at 3:30 at the office on Maple. Bring the insurance card and her favourite bear' },
  { by: 'mom',       at: [-4, '09:25'], text: 'The piano tuner is coming Saturday between nine and eleven in the morning. Please clear the music off the lid beforehand' },
  { by: 'dad',       at: [-4, '17:55'], text: 'Change the furnace filter before the cold weather starts. The spare filters are on the top shelf in the garage cupboard' },
  { by: 'mom',       at: [-3, '08:03'], text: "Grandma Jo's birthday is on the fourth. Sign the card on the fridge and add a drawing or a verse before Thursday night" },
  { by: 'christian', at: [-3, '19:40'], text: 'Small group meets here next Wednesday at seven. We need extra chairs from the basement and the big coffee urn cleaned' },
  { by: 'eli',       at: [-2, '06:58'], text: 'Renew the car registration online before the end of the month. The reminder letter is in the blue folder in the office' },
  { by: 'christian', at: [-2, '15:12'], text: 'Return the casserole dish and the cake carrier to the Hendersons next door, with a thank-you note from the whole family' },
  { by: 'dad',       at: [-1, '07:30'], text: 'The gutters on the back of the house need clearing before the rain on Friday. The long ladder is behind the shed' },
  { by: 'mom',       at: [-1, '19:05'], text: "Ezra's school picture day is Monday. The blue collared shirt is ironed and hanging in his closet, and the order form is signed" },
  { by: 'christian', at: [-1, '21:16'], text: 'Call the church office at 555-0142 to sign up for the Thanksgiving food drive and the Saturday morning packing shift' },
  // Eli's only reminder today: seed/chat.mjs replays it as a chat exchange (its eliRem, chat.mjs:96/154), so it too came
  // from chat and its feed line carries ' (via chat)'
  { by: 'eli',       at: [0, '06:45'],  text: 'Order more printer ink and the big pack of index cards for the memory verses. The kids have used almost every card', via: 'chat' },
  { by: 'dad',       at: [0, '08:05'],  text: 'Pick up the fresh peaches and sweet corn from the farm stand on the way home before they close at five this afternoon' },
];
const OVERFLOW_CLEARED = [
  { by: 'dad', at: [-3, '07:10'], done: [-2, '18:40'], text: 'Take the old paint cans and the broken lamp to the county recycling drop-off on the Saturday collection day' },
  { by: 'mom', at: [-2, '09:15'], done: [-1, '16:05'], text: 'Bring the folding table back from the church fellowship hall after the bake sale and wipe it down before it goes back' },
];

// Album photos: family scope, app 'hub', key 'album:<id>'. Shape = POST /api/album, worker/src/index.js:361-371:
//   media album/<id>-256.jpg + album/<id>-1024.jpg (worker/src/index.js:367-368), and
//   value { id, sm: '/api/media/album/<id>-256.jpg', lg: '/api/media/album/<id>-1024.jpg', by, byName, caption, at }
// (index.js:369). The shell's uploader always sends caption '' (hub.addAlbumPhoto(f), index.html:1306 → apps/hub.js:494).
// Readers: Me → Family album (index.html:1426-1433, newest first) and the TV backdrop (index.html:1046, oldest first).
// Adding a photo posts no feed line (index.html:1306 calls no hub.activity), so the album adds none.
// Mea (niece) has never signed in (story.mjs HOUSEHOLD: her first tap creates her PIN), so she adds nothing — no photos
// here and no reminders above.
const ALBUM_BY = ['eli', 'christian', 'mom', 'dad', 'eli', 'mom', 'christian', 'dad', 'mom', 'eli', 'dad', 'christian'];

export default function seedShell(h) {
  if (h.empty) return;
  const R = h.overflow ? OVERFLOW_REMINDERS : TYPICAL_REMINDERS;
  const C = h.overflow ? OVERFLOW_CLEARED : TYPICAL_CLEARED;
  const at = ([d, hhmm]) => h.time(d, hhmm);

  for (const r of R) {
    const id = h.uid('rem');
    const createdAt = at(r.at);
    h.family('reminders', 'item:' + id, { id, text: r.text, by: r.by, byName: h.name(r.by), createdAt }, createdAt);
    // the line the Home form posts with it: hub.activity('Added a reminder: ' + t, 'reminders'), index.html:1212
    h.activity(r.by, 'reminders', 'Added a reminder: ' + r.text + (r.via === 'chat' ? ' (via chat)' : ''), createdAt);
  }
  for (const r of C) {
    const id = h.uid('rem');
    const createdAt = at(r.at), doneAt = at(r.done);
    h.activity(r.by, 'reminders', 'Added a reminder: ' + r.text, createdAt);
    // Done removes the row (a tombstone, index.html:1232) and posts 'Cleared the reminder: ' + text (index.html:1233);
    // the clearer is whoever tapped Done — here the same adult
    h.family('reminders', 'item:' + id, null, doneAt);
    h.activity(r.by, 'reminders', 'Cleared the reminder: ' + r.text, doneAt);
  }

  // album: 6 photos (typical/park) or all 12 (overflow), added over the past weeks, oldest first
  const n = h.overflow ? 12 : 6;
  for (let i = 0; i < n; i++) {
    const sm = h.asset(`album-${i + 1}-256.jpg`), lg = h.asset(`album-${i + 1}-1024.jpg`);
    if (!sm || !lg) continue;                          // the driver renders the assets before the first reset
    const id = h.uid('alb');
    h.media(`album/${id}-256.jpg`, sm);
    h.media(`album/${id}-1024.jpg`, lg);
    const by = ALBUM_BY[i];
    const added = h.time(-(n - i) * 3, i % 2 ? '19:30' : '12:15');   // one every three days, the newest three days ago
    h.family('hub', 'album:' + id, { id, sm: `/api/media/album/${id}-256.jpg`, lg: `/api/media/album/${id}-1024.jpg`, by, byName: h.name(by), caption: '', at: added }, added);
  }

  // push_log: what Me → Admin → Usage counts (worker/src/reminders.js:46 writes one row per pushTo, ok = any device
  // took it). The demo has no push subscriptions (push needs https), so these rows stand in for the last few days of
  // the household's reminders: the 8 am fridge nudge to adults, the 8 pm F260 nudge, Sunday's catch-up, a new prayer.
  if (!h.empty) {
    const adults = ['eli', 'christian', 'mom', 'dad'];
    for (const d of [-2, -1, 0]) for (const id of adults) h.push(id, 'leftovers', true, h.time(d, '08:00'));
    for (const d of [-2, -1]) for (const id of ['eli', 'dad']) h.push(id, 'f260', true, h.time(d, '20:00'));
    h.push('dad', 'behind', true, h.time(-2, '20:00'));
    h.push('mom', 'prayer', true, h.time(-1, '08:00'));
    h.push('eli', 'prayer', false, h.time(-1, '08:00'));
    if (h.overflow) for (let d = -29; d < -2; d++) for (const id of adults) h.push(id, d % 3 ? 'leftovers' : 'f260', d % 7 !== 0, h.time(d, d % 3 ? '08:00' : '20:00'));
  }
}
