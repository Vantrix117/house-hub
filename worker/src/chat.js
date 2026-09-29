// POST /api/chat — the house chatbot. Streams Claude's reply as Server-Sent Events and runs tools
// against D1 in between turns. Every tool action is echoed to the client as a chip and to the activity feed.
//
// SSE events sent to the client:
//   text  {text}                      a chunk of the reply
//   tool  {name, input, chip, ok, speak?, text?, undo?}   a tool ran (chip is the human-readable summary; speak:true + text asks
//                                                 the client to read `text` aloud — read_todays_verse for kids; undo is a token
//                                                 for POST /api/chat/undo, good for UNDO_MS, when the tool wrote something)
//   done  {usage, stop_reason}        finished
//   error {error, message}
import { HttpError } from './auth.js';
import { listData, getOne, liveItems, rowMap, putOne as rawPut } from './data.js';
import { nyParts } from './reminders.js';
import { appsFor, householdLoader, guardedPut } from './policy.js';

export const MODEL = 'claude-sonnet-5';
export const MAX_TOKENS = 800;
export const DAILY_CAP = 60;
export const HISTORY = 20;
const MAX_TURNS = 6;                      // tool round-trips per message
const BIG_VALUE = 4000;                   // chars; larger values are summarised, never sent to the model
const UNDO_MS = 45000;                    // a chat write can be undone this long (the chip offers Undo for 30 s)
const UNDO_APP = 'chatundo';              // app_data rows no app syncs or can read: one per undoable chat action

const enc = new TextEncoder();
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

// ── tools ─────────────────────────────────────────────────────
const TOOLS = [
  { name: 'list_apps', description: 'List the apps in the hub this person can use, with their data scope.', input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'get_data', description: "Read an app's stored data. scope 'person' is the signed-in person's own data; 'family' is shared by the whole house. Omit key to list everything.",
    input_schema: { type: 'object', properties: { app_id: { type: 'string' }, scope: { type: 'string', enum: ['person', 'family'] }, key: { type: 'string' } }, required: ['app_id', 'scope'], additionalProperties: false } },
  { name: 'set_data', description: "Change one of these settings, and nothing else: app 'tally' key 'count' (scope person, a whole number); app 'timer' key 'timer.active' (scope person, {endAt, total, startedAt} in ms, or null to stop); app 'hub' key 'theme' (scope person, one of system, hearth, parchment, frost, midnight, forest, graphite). Everything else is changed in its app, or with the list and prayer tools.",
    input_schema: { type: 'object', properties: { app_id: { type: 'string' }, scope: { type: 'string', enum: ['person', 'family'] }, key: { type: 'string' }, value: {} }, required: ['app_id', 'scope', 'key', 'value'], additionalProperties: false } },
  { name: 'add_list_item', description: "Add an item to a family list. app_id 'leftovers' (item: {name, size?, dateLogged?}) or 'reminders' (item: {text}).",
    input_schema: { type: 'object', properties: { app_id: { type: 'string', enum: ['leftovers', 'reminders'] }, item: { type: 'object', properties: { name: { type: 'string' }, size: { type: 'string', enum: ['Small', 'Medium', 'Large', 'Family-size'] }, dateLogged: { type: 'string', description: 'YYYY-MM-DD, defaults to today' }, text: { type: 'string' } }, additionalProperties: false } }, required: ['app_id', 'item'], additionalProperties: false } },
  { name: 'set_f260_reading', description: "Tick (done true) or untick (done false) one F260 reading for the signed-in person. week 1-52, day 1-5. Ticking a reading that is already ticked changes nothing.",
    input_schema: { type: 'object', properties: { week: { type: 'integer', minimum: 1, maximum: 52 }, day: { type: 'integer', minimum: 1, maximum: 5 }, done: { type: 'boolean' } }, required: ['week', 'day', 'done'], additionalProperties: false } },
  { name: 'add_prayer', description: "Add a prayer request. list 'private' is the person's own list, 'family' is the shared house list.",
    input_schema: { type: 'object', properties: { list: { type: 'string', enum: ['private', 'family'] }, text: { type: 'string' }, for: { type: 'string', description: 'who it is for, optional' } }, required: ['list', 'text'], additionalProperties: false } },
  { name: 'mark_prayed', description: "Mark a prayer request as prayed for today (the same thing as tapping it in the prayer app). prayer_id is the id from get_data on app prayer (rows prayer:<id>), or the request's title if you do not know the id — the tool matches it and asks when it is ambiguous.",
    input_schema: { type: 'object', properties: { list: { type: 'string', enum: ['private', 'family'] }, prayer_id: { type: 'string' } }, required: ['list', 'prayer_id'], additionalProperties: false } },
  { name: 'answer_prayer', description: 'Mark a prayer request as answered today, with an optional note about how. prayer_id as in mark_prayed.',
    input_schema: { type: 'object', properties: { list: { type: 'string', enum: ['private', 'family'] }, prayer_id: { type: 'string' }, note: { type: 'string' } }, required: ['list', 'prayer_id'], additionalProperties: false } },
  { name: 'finish_leftover', description: 'Remove one item from the family fridge list (Larder Ledger) because it was eaten or thrown out. Give the item id, or its exact name; if the name is not exact the tool lists the likely items and you ask which one.',
    input_schema: { type: 'object', properties: { item_id: { type: 'string' }, name: { type: 'string' } }, additionalProperties: false } },
  { name: 'where_is_family', description: 'Where family members were last seen on the Dollywood Live map in the last 4 hours (who, map position, how long ago). Read-only.',
    input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'f260_status', description: "The signed-in person's F260 Bible reading progress: current week, readings done this week, the next reading, streak, and this week's memory verses. Read-only.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false } },
  { name: 'read_todays_verse', description: "For kids: this week's F260 memory verse(s) for the family (the week the grown-ups are on), with a short kid-friendly gist of each. The hub reads it aloud to the child. Read-only.",
    input_schema: { type: 'object', properties: {}, additionalProperties: false } },
];

// Tools a kid may call. Everything else refuses for kids with a plain result (never throws).
const KID_TOOLS = ['list_apps', 'get_data', 'set_data', 'add_list_item', 'read_todays_verse'];

// F260 memory verses by week (references from apps/f260.html's PLAN) with a one-line gist in kid words.
// The app keeps no verse text (people paste it themselves to practise), so the gist stands in for it.
const MV = [
  ['Genesis 1:27', 'God made people in His own image, boys and girls alike.', 'Hebrews 11:7', 'Noah trusted God and built the ark before any rain came.'],
  ['Hebrews 11:6', 'To please God we trust Him, and He rewards those who look for Him.', 'Hebrews 11:8-10', 'Abraham obeyed and went where God led, even without knowing the way.'],
  ['Romans 4:20-22', "Abraham believed God's promise, and God counted that faith as right.", 'Hebrews 11:17-19', 'Abraham trusted God with Isaac, believing God could even raise the dead.'],
  ['2 Corinthians 10:12', 'Comparing ourselves with each other is not wise.', '1 John 3:18', 'Let us love not just with words but with what we do.'],
  ['Romans 8:28-30', 'God works everything together for good for those who love Him.', 'Ephesians 3:20-21', 'God can do far more than anything we ask or imagine.'],
  ['Genesis 50:20', 'What others meant for harm, God used for good.', 'Hebrews 11:24-26', "Moses chose to belong to God's people over the riches of Egypt."],
  ['John 1:29', 'Jesus is the Lamb of God who takes away the sin of the world.', 'Hebrews 9:22', 'Without blood being given, there is no forgiveness.'],
  ['Exodus 20:1-3', 'God said: I am the Lord your God; have no other gods before Me.', 'Galatians 5:14', 'The whole law fits in one line: love your neighbour as yourself.'],
  ['Exodus 33:16', 'It is God going with us that makes us His people.', 'Matthew 22:37-39', 'Love God with all your heart, and love your neighbour as yourself.'],
  ['Leviticus 26:13', 'God set His people free so they could walk with their heads held high.', 'Deuteronomy 31:7-8', 'Be strong and brave; the Lord goes ahead of you and will not leave you.'],
  ['Deuteronomy 4:7', 'What other nation has a God so near whenever they call?', 'Deuteronomy 6:4-9', 'Love the Lord with all your heart, and teach His words to your children.'],
  ['Joshua 1:8-9', "Keep God's word close and be strong and brave, for the Lord is with you wherever you go.", 'Psalm 1:1-2', "Happy is the one who delights in God's word day and night."],
  ['Joshua 24:14-15', 'As for me and my house, we will serve the Lord.', 'Judges 2:12', 'The people forgot the God who brought them out of Egypt and followed other gods.'],
  ['Psalm 19:14', 'May my words and my thoughts please You, Lord, my rock.', 'Galatians 4:4-5', 'At just the right time God sent His Son so we could become His children.'],
  ['1 Samuel 15:22', 'Obeying God matters more than any gift we could bring Him.', '1 Samuel 16:7', 'People look at the outside, but the Lord looks at the heart.'],
  ['1 Samuel 17:46-47', 'The battle belongs to the Lord, not to swords and spears.', '2 Timothy 4:17a', 'The Lord stood by me and gave me strength.'],
  ['Psalm 23:1-3', 'The Lord is my shepherd; I have everything I need.', 'Psalm 51:10-13', 'Make my heart clean, God, and give me a right spirit.'],
  ['Psalm 1:1-7', "Those who love God's word are like trees planted by streams of water.", 'Psalm 119:7-11', 'I keep Your word in my heart so I will not sin against You.'],
  ['Psalm 139:1-3', 'Lord, You know me completely, when I sit and when I rise.', 'Psalm 139:15-16', 'God saw me before I was born and knows every one of my days.'],
  ['Proverbs 1:7', 'Respecting the Lord is where knowledge begins.', 'Proverbs 3:5-6', 'Trust the Lord with all your heart, and He will make your paths straight.'],
  ['Psalm 17:15', "I will be glad to see God's face and to be like Him.", 'Psalm 63:1', 'God, You are my God; I look for You early, my whole self longs for You.'],
  ['Psalm 16:11', 'God shows the path of life; being with Him is full of joy.', 'John 11:25-26', 'Jesus said: I am the resurrection and the life; whoever believes in Me will live.'],
  ['Isaiah 53:5-6', 'He was hurt for our wrongs, and by His wounds we are healed.', '1 Peter 2:23-24', 'Jesus carried our sins on the cross so we could live for what is right.'],
  ['Proverbs 29:18', "Without God's word people wander, but keeping it brings joy.", 'Jeremiah 1:15', "God told Jeremiah what was coming, and God's word always comes true."],
  ['Ezekiel 36:26-27', 'God gives a new heart and puts His Spirit inside us.', 'Daniel 4:35', 'God does what He pleases in heaven and on earth; no one can stop His hand.'],
  ['Daniel 6:26-27', "Daniel's God is the living God who rescues and saves.", 'Daniel 9:19', "Lord, hear, forgive and act, for Your own name's sake."],
  ['Zephaniah 3:17', 'The Lord is with you; He delights in you and sings over you with joy.', '1 Peter 3:15', 'Always be ready to gently explain the hope you have.'],
  ['Deuteronomy 29:29', 'Some things belong to God alone, but what He has shown us is ours to follow.', 'Psalm 101:3-4', 'I will not set anything worthless before my eyes.'],
  ['Nehemiah 6:9', 'Now, God, make my hands strong.', 'Nehemiah 9:6', 'You alone are the Lord; You made the heavens, the earth and the seas.'],
  ['Psalm 51:17', 'A humble, sorry heart is the gift God will not turn away.', 'Colossians 1:19-20', 'Through Jesus, God makes peace with everything by His cross.'],
  ['John 1:1-2', 'In the beginning was the Word, and the Word was with God, and the Word was God.', 'John 1:14', 'The Word became a person and lived among us, full of grace and truth.'],
  ['Matthew 5:16', 'Let your light shine so people see your good deeds and praise your Father.', 'Matthew 6:33', "Seek God's kingdom first, and He will take care of the rest."],
  ['Luke 14:26-27', 'Following Jesus means loving Him more than anyone, and carrying our cross.', 'Luke 14:33', 'A follower of Jesus holds nothing back from Him.'],
  ['Mark 10:45', 'Jesus came to serve, and to give His life for many.', 'John 6:37', 'Whoever comes to Jesus, He will never turn away.'],
  ['John 13:34-35', 'Love one another as Jesus loved us; that is how people know we follow Him.', 'John 15:4-5', 'Jesus is the vine and we are the branches; stay close to Him and you will grow.'],
  ['Luke 23:34', 'On the cross Jesus prayed: Father, forgive them.', 'John 17:3', 'Real life is knowing the one true God and Jesus whom He sent.'],
  ['Matthew 28:18-20', 'Go and make disciples everywhere; Jesus is with us always.', 'Acts 1:8', 'The Holy Spirit gives power to tell about Jesus to the ends of the earth.'],
  ['Acts 2:42', 'The first believers kept learning, sharing meals and praying together.', 'Acts 4:31', "They prayed, the place shook, and they spoke God's word boldly."],
  ['James 1:2-4', 'Count hard times as joy; they grow patience and make you complete.', 'James 2:17', 'Faith without doing anything is not alive.'],
  ['Acts 17:11', 'The people in Berea checked the Scriptures every day to see what was true.', 'Acts 17:24-25', 'God made the world and everything in it; He gives everyone life and breath.'],
  ['1 Corinthians 1:18', "The message of the cross is God's power to those being saved.", '1 Thessalonians 5:23-24', 'The God of peace makes you holy; He is faithful and will do it.'],
  ['1 Corinthians 10:13', 'God is faithful; He always gives a way out when we are tempted.', '1 Corinthians 13:13', 'Faith, hope and love last, and the greatest is love.'],
  ['Romans 1:16-17', "The good news is God's power to save everyone who believes.", '1 Corinthians 15:3-4', 'Jesus died for our sins, was buried, and rose on the third day.'],
  ['Romans 5:1', 'Because of faith we have peace with God through Jesus.', '2 Corinthians 10:4', "Our weapons are God's power, not the world's, and they knock down strongholds."],
  ['Romans 8:1', 'There is no condemnation for those who belong to Jesus.', 'Romans 12:1-2', 'Give your whole self to God and let Him make your mind new.'],
  ['Acts 20:24', "My life's job is to finish the race and tell the good news of God's grace.", '2 Corinthians 4:7-10', 'We are like clay jars holding a treasure; knocked down but never out.'],
  ['Ephesians 2:8-10', 'We are saved by grace through faith, a gift from God, made to do good.', 'Colossians 2:6-7', 'Keep walking with Jesus, rooted and growing and thankful.'],
  ['Philippians 3:7-8', 'Knowing Jesus is worth more than everything else.', 'Hebrews 4:14-16', 'Jesus understands us, so come boldly to God for grace and help.'],
  ['Galatians 2:19-20', 'I have been crucified with Christ; Christ lives in me.', '2 Corinthians 5:17', 'Anyone in Christ is a new creation; the old is gone, the new has come.'],
  ['2 Timothy 2:1-2', 'Be strong in grace, and pass on what you learned to others who will teach too.', '2 Timothy 2:15', "Do your best to handle God's word rightly."],
  ['1 Peter 2:11', 'Stay away from wrong desires that fight against your soul.', '1 John 4:10-11', 'God loved us first and sent His Son, so we love each other.'],
  ['Revelation 3:19', 'God corrects those He loves, so be eager and turn back to Him.', 'Revelation 21:3-4', 'God will live with His people and wipe away every tear.'],
];
const versesFor = week => { const w = Math.min(52, Math.max(1, +week || 1)); const m = MV[w - 1]; return [{ ref: m[0], gist: m[1] }, { ref: m[2], gist: m[3] }]; };

const today = () => nyParts().date;
// F260's streak rule (apps/f260.html streakInfo): walk back from today; up to 2 rest days in a row keep a streak alive.
const logStreak = log => { let d = today(), n = 0, gap = 0; for (let i = 0; i < 400; i++) { if (log && log[d]) { n++; gap = 0; } else if (++gap > 2) break; d = new Date(Date.parse(d + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10); } return n; };
async function usedToday(env, profileId) {
  const { results } = await env.DB.prepare("SELECT created_at FROM chat_log WHERE profile_id = ? AND role = 'user' AND created_at > ?").bind(profileId, Date.now() - 36 * 3600000).all();
  const d = today();
  return results.filter(r => nyParts(new Date(r.created_at)).date === d).length;
}
// ctx.apps is the list the Worker itself computed for this person (policy.js appsFor), never one from the request (P2-CHAT-06).
const visibleApps = apps => apps || [];
const REFUSED = { bad_date: 'That date is not a real day, or it is in the future.', not_allowed: 'This person cannot change that.', kid_readonly: 'Kids cannot change that.', household_only: 'Only a household grown-up can change that.', app_hidden: 'This person cannot use that app.', not_yours: 'That belongs to someone else.', beacon_off: 'A parent has not switched this child\'s beacon on.' };
const refusal = code => REFUSED[code] || 'This person cannot change that.';

/** One line on Home's family feed. The feed prints the person's name itself, so `text` starts with the verb ("Added a guest: Sue"). Shared with index.js routes. */
export async function activity(env, profile, appId, text) {
  await env.DB.prepare('INSERT INTO activity (profile_id, app_id, text, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, appId, text.slice(0, 200), Date.now()).run();
}
const logActivity = activity;

/** A leftover's dateLogged: YYYY-MM-DD (a real day), or today / yesterday / "N days ago"; never after today. false when not. */
function dayOf(v) {
  const t = today();
  if (v === undefined || v === null || v === '') return t;
  const s = String(v).trim().toLowerCase();
  let d = s;
  if (s === 'today') d = t;
  else if (s === 'yesterday') d = addDay(t, -1);
  else { const m = /^(\d{1,2}) days? ago$/.exec(s); if (m) d = addDay(t, -m[1]); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const x = new Date(d + 'T12:00:00Z'); if (isNaN(x) || x.toISOString().slice(0, 10) !== d) return false;
  return d > t ? false : d;
}
const isIsoDay = v => { const d = String(v || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false; const x = new Date(d + 'T12:00:00Z'); return !isNaN(x) && x.toISOString().slice(0, 10) === d && d <= today(); };
const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Finds one prayer row by id (with or without the prayer: prefix) or, failing that, by title. Returns {p, key} or {result} explaining why not. */
async function findPrayer(env, profile, scope, idOrTitle) {
  const raw = String(idOrTitle || '').trim(); if (!raw) return { result: 'prayer_id is required.' };
  const id = raw.replace(/^prayer:/, '');
  const exact = await getOne(env, { appId: 'prayer', scope, profile, key: 'prayer:' + id });
  if (exact && exact.value && typeof exact.value === 'object') return { p: exact.value, key: exact.key };
  const rows = (await liveItems(env, { appId: 'prayer', scope, profile, prefix: 'prayer:' })).filter(r => r.value && typeof r.value === 'object');
  const q = norm(raw);
  let hit = rows.filter(r => r.value.id === id);
  if (!hit.length && q) hit = rows.filter(r => norm(r.value.title) === q);
  // not an id or the exact title: never act on a guess (as finish_leftover, batch 0i) — list what might be meant
  if (!hit.length && q) {
    const qw = q.split(' ').filter(w => w.length > 2 && /[a-z]/.test(w));
    const maybe = rows.filter(r => { const t = norm(r.value.title + ' ' + (r.value.for || '')); return t.includes(q) || (norm(r.value.title) && q.includes(norm(r.value.title))) || (qw.length && qw.every(w => t.includes(w))); });
    if (maybe.length) return { result: `No request is called exactly "${raw}". Ask which one they mean, then call again with its id: ${maybe.slice(0, 12).map(r => `${r.value.title}${r.value.for ? ' for ' + r.value.for : ''} (id ${r.value.id})`).join('; ')}` };
  }
  const active = hit.filter(r => r.value.status === 'active'); if (active.length && active.length < hit.length) hit = active;
  const which = scope === 'family' ? 'the family list' : 'the private list';
  if (!hit.length) return { result: rows.length ? `No prayer on ${which} matches "${raw}". Requests there: ${rows.slice(0, 30).map(r => `${r.value.title} (id ${r.value.id}${r.value.status !== 'active' ? ', ' + r.value.status : ''})`).join('; ')}` : `${which[0].toUpperCase() + which.slice(1)} is empty.` };
  if (hit.length > 1) return { result: `More than one prayer on ${which} matches; ask which one and call again with its id: ${hit.map(r => `${r.value.title}${r.value.for ? ' for ' + r.value.for : ''} (id ${r.value.id})`).join('; ')}` };
  return { p: hit[0].value, key: hit[0].key };
}

/** The week the family is on: the furthest week any adult's F260 summary reports, or week 1. */
async function familyWeek(env) {
  const { results } = await env.DB.prepare("SELECT a.value FROM app_data a JOIN profiles p ON p.id = a.profile_id WHERE a.app_id = 'f260' AND a.scope = 'person' AND a.key = 'f260.summary' AND a.value IS NOT NULL AND p.kind = 'adult'").all();
  let week = 1;
  for (const r of results) { try { const w = +JSON.parse(r.value).week; if (w > week) week = w; } catch {} }
  return Math.min(52, week);
}

/**
 * Runs one tool. Returns { result (for the model), chip (for the UI), ok, undo? }. Never throws for user-level problems.
 * Every write is recorded with the row as it was, so the chip can offer Undo (GAP-CHAT-02, P2-CHAT-01): the record is kept
 * under app_data(person, chatundo, <token>) — rows the data API refuses to read or write — for UNDO_MS. A main write that
 * another change beat under last-write-wins is not a success (P2-CHAT-09): the action's earlier writes are put back, the
 * person is told, and no ✓ is shown. Rows that only follow from the main one (the F260 log and summary, prayerDays, the
 * Larder's finished row) are written best-effort, stamped as they are written.
 */
async function runTool(env, ctx, name, input) {
  const writes = []; writes.feed = [];
  const r = await runToolInner(env, ctx, name, input, writes);
  if (!r.ok && writes.length) await restore(env, ctx, writes, { force: true });   // nothing half-done (P2-CHAT-09, review)
  if (r.lost) return { ok: false, result: 'Not saved: someone changed that just now. Tell the person nothing was changed and to try again.', chip: '✗ Not saved — someone changed it just now' };
  if (!r.ok || !writes.length || !r.chip) return r;
  const token = rid() + rid();
  try {
    await env.DB.prepare('DELETE FROM app_data WHERE app_id = ? AND scope = ? AND profile_id = ? AND updated_at < ?').bind(UNDO_APP, 'person', ctx.profile.id, Date.now() - 10 * 60000).run();
    await rawPut(env, { appId: UNDO_APP, scope: 'person', profile: ctx.profile, key: token, value: { tool: name, chip: r.chip, feed: writes.feed[0] || null, writes: writes.slice(0, 20), day: today(), at: Date.now() }, updated_at: Date.now() });
    return { ...r, undo: token };
  } catch { return r; }                                                 // no Undo offered, the write itself stands
}
class Lost extends Error {}
/**
 * Puts back the rows an action wrote, all or nothing: every row must still be as the action left it (and a tally reset
 * must have had no taps on its new count since), else nothing is touched. Rows go back in the order they were written, and
 * the first refusal stops it. { force } (a failed action's own rows, just written) skips the "changed since" check.
 * Returns { ok, changed, restored }.
 */
async function restore(env, ctx, writes, { force = false, day = today() } = {}) {
  const P = ctx.profile;
  if (!force) {
    for (const w of writes) {
      if (w.soft) continue;                                               // a follow-on row (F260's summary, prayerDays) another device may rewrite
      const cur = await getOne(env, { appId: w.appId, scope: w.scope, profile: P, key: w.key });
      if (!cur || +cur.updated_at !== +w.at) return { ok: false, changed: true, restored: 0 };
      if (w.appId === 'prayer' && w.scope === 'family' && day !== today()) return { ok: false, changed: true, restored: 0 };   // a new day: the tick is history
      if (w.appId === 'tally' && w.key === 'reset') {
        const taps = (await listData(env, { appId: 'tally', scope: 'person', profile: P })).filter(r => r.key.startsWith('count:') && r.key !== 'count:chat' && +r.updated_at > +w.at);
        if (taps.length) return { ok: false, changed: true, restored: 0 };
      }
    }
  }
  let restored = 0;
  for (const w of writes) {
    if (w.appId === 'prayer' && w.key === 'prayerDays') continue;       // a prayed day stays: someone may have prayed today since, and the list only gains days
    if (w.soft && !force) { const cur = await getOne(env, { appId: w.appId, scope: w.scope, profile: P, key: w.key }); if (!cur || +cur.updated_at !== +w.at) continue; }
    let value = w.had ? w.prev : null;
    // who prayed is merged by the house; an untick of this person's own entry has to say so (policy.js mergePrayedBy)
    if (w.appId === 'prayer' && w.scope === 'family' && /^prayer:/.test(w.key) && value && typeof value === 'object') value = { ...value, unprayed: today() };
    // a Larder row from before batch 0i may carry a date the house now refuses: it comes back dated today
    if (w.appId === 'leftovers' && /^item:/.test(w.key) && value && typeof value === 'object' && !isIsoDay(value.dateLogged)) value = { ...value, dateLogged: dayOf(value.dateLogged) || today() };
    const r = await guardedPut(env, P, { appId: w.appId, scope: w.scope, profile: P, key: w.key, value, updated_at: Math.max(Date.now(), +w.at + 1) }, ctx.people);   // after the write it undoes, even in the same millisecond
    if (r.rejected || r.applied === false) return { ok: restored > 0, changed: false, restored, stopped: true };
    restored++;
  }
  return { ok: true, changed: false, restored };
}
/** POST /api/chat/undo {token}: undoes one chat action (the chip's Undo), all or nothing, once, within UNDO_MS. */
export async function chatUndo(c, auth) {
  const profile = auth.profile, body = await c.body().catch(() => ({}));
  const token = String(body && body.token || '');
  if (!/^[a-z0-9]{8,40}$/.test(token)) throw new HttpError(400, 'bad_token', 'That cannot be undone.');
  const rec = await getOne(c.env, { appId: UNDO_APP, scope: 'person', profile, key: token });
  const v = rec && rec.value;
  await c.env.DB.prepare('DELETE FROM app_data WHERE app_id = ? AND scope = ? AND profile_id = ? AND key = ?').bind(UNDO_APP, 'person', profile.id, token).run();
  const age = Date.now() - +(v && v.at);
  if (!v || !Array.isArray(v.writes) || !v.writes.length || v.writes.length > 20 || !(age >= 0 && age <= UNDO_MS)) throw new HttpError(410, 'gone', 'That can no longer be undone.');
  const ctx = { profile, people: householdLoader(c.env) };
  const r = await restore(c.env, ctx, v.writes, { day: v.day });
  if (r.changed) return { ok: false, restored: 0, message: 'Nothing undone: it was changed since.' };
  // the feed gets the action's own feed-safe line (a private prayer is never named there, P2-PWA-01), never the chip
  const line = v.feed && v.feed.text ? String(v.feed.text).replace(/ \(via chat\)$/, '') : null;
  if (r.restored && line) await logActivity(c.env, profile, v.feed.app || 'hub', ('Undid: ' + line).slice(0, 190) + ' (via chat)');
  const chip = String(v.chip || '').replace(/^✓\s*/, '');
  await c.env.DB.prepare('INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, 'assistant', (r.ok && !r.stopped ? '↩ Undone: ' : r.restored ? '↩ Partly undone: ' : '↩ Not undone: ') + chip, Date.now()).run().catch(() => {});
  return { ok: r.ok, restored: r.restored, message: r.stopped ? (r.restored ? 'Only partly undone: the house refused part of it.' : 'Not undone: the house refused it.') : 'Undone.' };
}

async function runToolInner(env, ctx, name, input, writes) {
  const { profile, apps } = ctx;
  const canUse = id => visibleApps(apps).some(a => a.id === id);
  // the feed line each action posts, kept for its Undo (a private prayer is never named in it)
  const activity = async (e, p, app, text) => { writes.feed.push({ app, text }); return logActivity(e, p, app, text); };
  // Every write goes through the same rules as the data API (policy.js): a kid, a guest or the kitchen is limited here too.
  // { soft: true }: a row that only follows from the main write, stamped now and never failing the action.
  const putOne = async (_env, args, { soft = false } = {}) => {
    const a = soft ? { ...args, updated_at: Date.now() } : args;
    const r = await guardedPut(env, profile, { ...a, wantBefore: true }, ctx.people);
    if (r.rejected) { if (soft) return r; throw new Refused(r.rejected); }
    if (r.applied === false) {
      if (JSON.stringify(r.value) === JSON.stringify(a.value)) return r;   // already so: nothing to save, nothing lost
      // a family prayer tick the house already has: the stored row differs only in its stamps (never an answer or an edit)
      const same = v => { const o = { ...(v || {}) }; delete o.updatedAt; delete o.lastPrayedAt; return JSON.stringify(o); };
      if (a.appId === 'prayer' && a.scope === 'family' && /^prayer:/.test(a.key) && r.value && a.value && same(r.value) === same(a.value)) return r;
      if (soft) return r;
      throw new Lost();
    }
    const before = r.before;
    writes.push({ appId: a.appId, scope: a.scope, key: a.key, prev: before ? before.value : null, had: !!(before && before.value != null), at: r.updated_at, ...(soft ? { soft: true } : {}) });
    return r;
  };
  const shrink = v => { const s = JSON.stringify(v); return s.length > BIG_VALUE ? `(large value, ${s.length} chars, not shown)` : v; };
  try {
    if (profile.kind === 'kid' && !KID_TOOLS.includes(name)) return { ok: false, result: 'That is a grown-up tool; kids cannot use it. Tell the child a parent can do that.', chip: null };

    if (name === 'list_apps') return { ok: true, result: visibleApps(apps).map(a => ({ id: a.id, name: a.name, scope: a.scope })), chip: null };

    if (name === 'get_data') {
      if (!canUse(input.app_id) && !['reminders', 'hub'].includes(input.app_id)) return { ok: false, result: 'This person cannot use that app.', chip: null };
      const args = { appId: input.app_id, scope: input.scope, profile };
      // the journal vault never leaves the house, asked for by name or not (P2-CHAT-07)
      if (input.key && /\.vault$/.test(input.key)) return { ok: false, result: 'The private journal is locked; it cannot be read from chat.', chip: null };
      // Tally since batch 0f: the count is the sum of every device's count:<device> row on the current reset epoch
      if (input.app_id === 'tally' && input.scope === 'person' && (!input.key || input.key === 'count')) {
        const all = (await listData(env, args)).filter(r => r.value != null);
        const reset = all.find(r => r.key === 'reset'), ep = reset && reset.value && reset.value.epoch ? String(reset.value.epoch) : null;
        const base = all.find(r => r.key === 'count');
        let n = ep ? 0 : Math.max(0, Number(base && base.value) || 0);
        for (const r of all) if (r.key.startsWith('count:') && r.value && typeof r.value === 'object' && (r.value.epoch || null) === ep) n += Math.floor(Number(r.value.n) || 0);
        return { ok: true, result: input.key ? Math.max(0, n) : [{ key: 'count', value: Math.max(0, n) }], chip: null };
      }
      if (input.key) { const r = await getOne(env, { ...args, key: input.key }); return { ok: true, result: r && r.value != null ? shrink(r.value) : null, chip: null }; }
      const rows = (await listData(env, args)).filter(r => r.value != null && !/\.vault$/.test(r.key) && !(input.app_id === 'leftovers' && /^finished:/.test(r.key))).slice(0, 60);   // finished food is not in the fridge
      return { ok: true, result: rows.map(r => ({ key: r.key, value: shrink(r.value) })), chip: null };
    }

    if (name === 'set_data') {
      // Only these settings (P2-CHAT-01): anything else, a family row above all, is changed in its app or with its own tool.
      const SET_OK = { 'tally|person|count': 1, 'timer|person|timer.active': 1, 'hub|person|theme': 1 };
      if (!SET_OK[`${input.app_id}|${input.scope}|${input.key}`]) return { ok: false, result: 'That cannot be changed from chat. Tell the person to change it in the app itself.', chip: null };
      if (input.app_id !== 'hub' && !canUse(input.app_id)) return { ok: false, result: 'This person cannot use that app.', chip: null };
      if (input.key === 'theme' && !['system', 'hearth', 'parchment', 'frost', 'midnight', 'forest', 'graphite'].includes(input.value)) return { ok: false, result: 'theme must be one of system, hearth, parchment, frost, midnight, forest, graphite', chip: null };
      if (input.key === 'timer.active' && input.value !== null && !(input.value && typeof input.value === 'object' && ['endAt', 'total', 'startedAt'].every(k => Number.isFinite(+input.value[k])))) return { ok: false, result: 'timer.active is {endAt, total, startedAt} in ms, or null', chip: null };
      // Tally keeps one row per device on a reset epoch since batch 0f: "set my tally to N" starts a new epoch at N
      if (input.app_id === 'tally' && input.key === 'count' && input.scope === 'person') {
        const n = Math.max(0, Math.floor(Number(input.value) || 0)), epoch = rid(), now = Date.now();
        await putOne(env, { appId: 'tally', scope: 'person', profile, key: 'reset', value: { epoch, at: now }, updated_at: now });
        await putOne(env, { appId: 'tally', scope: 'person', profile, key: 'count:chat', value: { n, epoch }, updated_at: now });
        await activity(env, profile, 'tally', `Set the tally to ${n} (via chat)`);
        return { ok: true, result: 'saved', chip: `✓ Tally set to ${n}` };
      }
      const value = input.key === 'timer.active' && input.value ? { endAt: +input.value.endAt, total: +input.value.total, startedAt: +input.value.startedAt } : input.value;
      await putOne(env, { appId: input.app_id, scope: input.scope, profile, key: input.key, value, updated_at: Date.now() });
      const said = input.key === 'theme' ? `Changed their look to ${String(input.value)[0].toUpperCase() + String(input.value).slice(1)}` : value === null ? 'Stopped the timer' : 'Started a timer';   // UX-CHAT-06: words, not a storage key
      await activity(env, profile, input.app_id, `${said} (via chat)`);
      return { ok: true, result: 'saved', chip: input.key === 'theme' ? `✓ Look set to ${String(input.value)[0].toUpperCase() + String(input.value).slice(1)}` : value === null ? '✓ Timer stopped' : '✓ Timer set' };
    }

    if (name === 'add_list_item') {
      const id = rid();
      if (input.app_id === 'leftovers') {
        if (!canUse('leftovers')) return { ok: false, result: 'This person cannot use the Larder Ledger.', chip: null };
        const nm = String(input.item.name || '').trim(); if (!nm) return { ok: false, result: 'name is required', chip: null };
        const d = dayOf(input.item.dateLogged);
        if (d === false) return { ok: false, result: 'dateLogged must be a real date as YYYY-MM-DD (or today / yesterday / N days ago), and not in the future.', chip: null };
        const item = { id, name: nm, size: input.item.size || 'Medium', dateLogged: d, by: profile.id, byName: profile.name };
        await putOne(env, { appId: 'leftovers', scope: 'family', profile, key: 'item:' + id, value: item, updated_at: Date.now() });
        await activity(env, profile, 'leftovers', `Logged ${nm} (${item.size}) in the fridge (via chat)`);
        return { ok: true, result: item, chip: `✓ Added ${nm} to leftovers` };
      }
      if (input.app_id === 'reminders') {
        if (profile.kind === 'kid') return { ok: false, result: 'Kids cannot add reminders for the house.', chip: null };
        const t = String(input.item.text || input.item.name || '').trim(); if (!t) return { ok: false, result: 'text is required', chip: null };
        const item = { id, text: t, by: profile.id, byName: profile.name, createdAt: Date.now() };
        await putOne(env, { appId: 'reminders', scope: 'family', profile, key: 'item:' + id, value: item, updated_at: Date.now() });
        await activity(env, profile, 'reminders', `Added a reminder: ${t} (via chat)`);
        return { ok: true, result: item, chip: `✓ Added reminder: ${t}` };
      }
      return { ok: false, result: 'unknown list', chip: null };
    }

    if (name === 'set_f260_reading') {
      if (!canUse('f260')) return { ok: false, result: 'This person does not use F260.', chip: null };
      const k = `${input.week}-${input.day - 1}`, want = input.done !== false;
      // one row per tick and per logged day, as the F260 app writes them since batch 0e (P2-SYNC-01)
      const F = { appId: 'f260', scope: 'person', profile };
      const done = await rowMap(env, { ...F, prefix: 'done:', legacyKey: 'f260.done' });
      const now = Date.now();
      // tick means tick (P2-CHAT-04): a reading already in the asked state is left alone and the person is told
      if (!!done[k] === want) return { ok: true, result: { week: input.week, day: input.day, done: want, unchanged: true }, chip: `Week ${input.week} day ${input.day} was already ${want ? 'checked off' : 'unchecked'}` };
      if (want) done[k] = true; else delete done[k];
      await putOne(env, { ...F, key: 'done:' + k, value: !!done[k], updated_at: now });
      const log = await rowMap(env, { ...F, prefix: 'log:', legacyKey: 'f260.log' });
      if (done[k] && !log[today()]) {
        log[today()] = true;
        await putOne(env, { ...F, key: 'log:' + today(), value: true, updated_at: now }, { soft: true });
      }
      const sumRow = await getOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.summary' });
      if (sumRow && sumRow.value) {
        const s = sumRow.value; const weekDone = [0, 1, 2, 3, 4].filter(d => done[`${input.week}-${d}`]).length;
        await putOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.summary', value: { ...s, weekDone: s.week === input.week ? weekDone : s.weekDone, readToday: !!log[today()], readOn: today(), streak: logStreak(log), total: Object.keys(done).length }, updated_at: now }, { soft: true });   // readOn: the household date readToday and streak refer to
      }
      await activity(env, profile, 'f260', `${done[k] ? 'Read' : 'Unchecked'} week ${input.week} day ${input.day} (via chat)`);
      return { ok: true, result: { week: input.week, day: input.day, done: !!done[k] }, chip: `✓ Week ${input.week} day ${input.day} ${done[k] ? 'checked off' : 'unchecked'}` };
    }

    if (name === 'add_prayer') {
      if (!canUse('prayer')) return { ok: false, result: 'This person does not use the prayer app.', chip: null };
      const t = String(input.text || '').trim(); if (!t) return { ok: false, result: 'text is required', chip: null };
      const scope = input.list === 'family' ? 'family' : 'person';
      const id = 'c' + rid();
      const p = { id, title: t, for: input.for || '', phone: '', detail: '', category: 'Personal', cadence: 'daily', days: [], status: 'active',
        createdAt: today(), lastPrayedAt: null, answeredAt: null, answerNote: null, updates: [], sharedFrom: null, prayedBy: {}, by: profile.id, updatedAt: new Date().toISOString() };
      await putOne(env, { appId: 'prayer', scope, profile, key: 'prayer:' + id, value: p, updated_at: Date.now() });
      await activity(env, profile, 'prayer', scope === 'family' ? `Added a family prayer request: ${t} (via chat)` : 'Added a private prayer request (via chat)');
      return { ok: true, result: p, chip: `✓ Added to ${scope === 'family' ? 'the family' : 'your private'} prayer list: ${t}` };
    }

    if (name === 'mark_prayed' || name === 'answer_prayer') {
      if (!canUse('prayer')) return { ok: false, result: 'This person does not use the prayer app.', chip: null };
      const scope = input.list === 'family' ? 'family' : 'person';
      const found = await findPrayer(env, profile, scope, input.prayer_id);
      if (!found.p) return { ok: false, result: found.result, chip: null };
      const p = { ...found.p }; const now = Date.now(); const d = today();
      if (name === 'mark_prayed') {
        if (p.status !== 'active') return { ok: false, result: `"${p.title}" is not active (status ${p.status}); reopen it in the prayer app first.`, chip: null };
        // Same shape as apps/prayer.html setPrayed(): lastPrayedAt = today; on the family list, the person's profile id under
        // prayedBy[today] (batch 0g: ids, not names). The Worker merges who prayed (policy.js mergePrayedBy), so only this
        // person's own entry changes whatever else this copy of the row holds.
        p.lastPrayedAt = d;
        if (scope === 'family') { const pb = { ...(p.prayedBy && typeof p.prayedBy === 'object' && !Array.isArray(p.prayedBy) ? p.prayedBy : {}) }; pb[d] = [...new Set([...(Array.isArray(pb[d]) ? pb[d] : []), profile.id])]; p.prayedBy = pb; }
        p.updatedAt = new Date(now).toISOString();
        await putOne(env, { appId: 'prayer', scope, profile, key: found.key, value: p, updated_at: now });
        // markDay(): today joins the list's prayerDays so the prayer streak counts this.
        const daysRow = await getOne(env, { appId: 'prayer', scope, profile, key: 'prayerDays' });
        const days = Array.isArray(daysRow && daysRow.value) ? daysRow.value : [];
        if (!days.includes(d)) await putOne(env, { appId: 'prayer', scope, profile, key: 'prayerDays', value: [...days, d].sort(), updated_at: now }, { soft: true });
        // a private request is never named on the family feed (P2-PWA-01); the chip, which only this person sees, keeps the title
        await activity(env, profile, 'prayer', scope === 'family' ? `Prayed for ${p.title} (family list) (via chat)` : 'Prayed for a private request (via chat)');
        return { ok: true, result: { id: p.id, title: p.title, lastPrayedAt: d, prayedBy: scope === 'family' ? p.prayedBy[d] : undefined }, chip: `✓ Prayed for ${p.title}` };
      }
      if (p.status === 'answered') return { ok: false, result: `"${p.title}" is already marked answered (${p.answeredAt}).`, chip: null };
      p.status = 'answered'; p.answeredAt = d; p.answerNote = String(input.note || '').trim().slice(0, 1000); p.updatedAt = new Date(now).toISOString();
      await putOne(env, { appId: 'prayer', scope, profile, key: found.key, value: p, updated_at: now });
      await activity(env, profile, 'prayer', scope === 'family' ? `Answered: ${p.title} (via chat)` : 'Answered a private request (via chat)');
      return { ok: true, result: { id: p.id, title: p.title, status: 'answered', answeredAt: d, answerNote: p.answerNote }, chip: `✓ Answered: ${p.title}` };
    }

    if (name === 'finish_leftover') {
      if (!canUse('leftovers')) return { ok: false, result: 'This person cannot use the Larder Ledger.', chip: null };
      const items = await liveItems(env, { appId: 'leftovers', scope: 'family', profile, prefix: 'item:' });
      const rows = items.map(r => ({ key: r.key, it: r.value })).filter(x => x.it && typeof x.it === 'object');
      const idIn = String(input.item_id || '').trim().replace(/^item:/, '');
      let hit = idIn ? rows.filter(x => x.key === 'item:' + idIn || x.it.id === idIn) : [];
      if (!hit.length) {
        const q = norm(input.name || input.item_id || '');
        if (!q) return { ok: false, result: 'Give the item id or its name.', chip: null };
        hit = rows.filter(x => norm(x.it.name) === q);
        // not exact: never guess (P2-CHAT-03) — list what might be meant and let the person choose
        if (!hit.length) {
          const qw = q.split(' ').filter(w => w.length > 2 && /[a-z]/.test(w));   // words, not numbers
          const maybe = rows.filter(x => { const n = norm(x.it.name); return n.includes(q) || q.includes(n) || qw.some(w => n.includes(w)); });
          if (maybe.length) return { ok: false, result: `No item is called exactly that. Ask which one they mean, then call again with its id: ${maybe.map(x => `${x.it.name} (${x.it.size || ''}, logged ${x.it.dateLogged || '?'}, id ${x.it.id})`).join('; ')}`, chip: null };
        }
      }
      if (!hit.length) return { ok: false, result: rows.length ? `Nothing in the fridge list matches that. Items: ${rows.map(x => `${x.it.name} (id ${x.it.id})`).join(', ')}` : 'The fridge list is empty.', chip: null };
      if (hit.length > 1) return { ok: false, result: `More than one item matches; ask which one and call again with its id: ${hit.map(x => `${x.it.name} (${x.it.size || ''}, logged ${x.it.dateLogged || '?'}, id ${x.it.id})`).join('; ')}`, chip: null };
      const { key, it } = hit[0];
      await putOne(env, { appId: 'leftovers', scope: 'family', profile, key, value: null, updated_at: Date.now() });   // tombstone, as the app's hub.remove does
      // kept seven days under "Recently finished" in the app, where it can be put back (batch 0h, as the app's ✓ does)
      if (it.id) await putOne(env, { appId: 'leftovers', scope: 'family', profile, key: 'finished:' + it.id, updated_at: Date.now(),
        value: { id: it.id, name: it.name, size: it.size, dateLogged: it.dateLogged, loggedBy: it.by, loggedByName: it.byName, finishedAt: today(), finishedBy: profile.id, finishedByName: profile.name } }, { soft: true }).catch(() => {});
      await activity(env, profile, 'leftovers', `Finished ${it.name} from the fridge (via chat)`);
      return { ok: true, result: { removed: it.name, id: it.id }, chip: `✓ Finished ${it.name}` };
    }

    if (name === 'where_is_family') {
      const cutoff = Date.now() - 4 * 3600000;
      const rows = await liveItems(env, { appId: 'dollywood-live', scope: 'family', profile, prefix: 'loc:' });
      const seen = rows.map(r => ({ id: r.key.slice(4), v: r.value })).filter(x => x.v && typeof x.v === 'object' && +x.v.t > cutoff && x.v.x != null)
        .sort((a, b) => +b.v.t - +a.v.t)
        .map(x => ({ id: x.id, name: x.v.name || x.id, x: x.v.x, y: x.v.y, minutesAgo: Math.max(0, Math.round((Date.now() - +x.v.t) / 60000)), at: new Date(+x.v.t).toISOString(), accuracyM: x.v.acc == null ? null : x.v.acc }));
      return { ok: true, result: seen.length ? { people: seen, note: 'x/y are Dollywood map positions from the Dollywood Live app; say who was seen and how long ago.' } : 'Nobody has shared a position on the Dollywood Live map in the last 4 hours.', chip: null };
    }

    if (name === 'f260_status') {
      if (!canUse('f260')) return { ok: false, result: 'This person does not use F260.', chip: null };
      const row = await getOne(env, { appId: 'f260', scope: 'person', profile, key: 'f260.summary' });
      const s = row && row.value && typeof row.value === 'object' ? row.value : null;
      if (!s) return { ok: true, result: 'No F260 progress yet — the plan starts at week 1 when they open the app.', chip: null };
      const week = Math.min(52, Math.max(1, +s.week || 1));
      // "read today" from the log for today's New York date, as the 8 pm job decides it: the summary's own flag is only true for
      // the day it was written (readOn), and a summary from yesterday must not tell the model today's reading is done
      const log = await rowMap(env, { appId: 'f260', scope: 'person', profile, prefix: 'log:', legacyKey: 'f260.log' });
      const readToday = !!log[today()];
      return { ok: true, result: { week, weekDone: +s.weekDone || 0, total: +s.total || 0, streak: logStreak(log), readToday, next: s.next || null, finished: !!s.finished, memoryVerses: versesFor(week).map(v => v.ref) }, chip: null };
    }

    if (name === 'read_todays_verse') {
      if (profile.kind !== 'kid') return { ok: false, result: "read_todays_verse is for the kids' profiles; use f260_status for this person's own week and verses.", chip: null };
      const week = await familyWeek(env);
      const verses = versesFor(week);
      const say = verses.map(v => `${v.ref}. ${v.gist}`).join(' ');
      return { ok: true, result: { week, verses, speak: true, say }, chip: null, speak: say };
    }
    return { ok: false, result: 'unknown tool', chip: null };
  } catch (e) {
    if (e instanceof Refused) return { ok: false, result: refusal(e.code), chip: null };
    if (e instanceof Lost) return { ok: false, lost: true, result: '', chip: null };
    return { ok: false, result: 'Tool failed: ' + (e.message || e), chip: null };
  }
}
class Refused extends Error { constructor(code) { super(code); this.code = code; } }

// ── prompt ────────────────────────────────────────────────────
function systemPrompt({ profile, household, apps }) {
  const people = household.map(p => `${p.name} (${p.kind}${p.is_admin ? ', admin' : ''})`).join(', ');
  const appList = visibleApps(apps).map(a => `- ${a.id}: ${a.name} [${a.scope} data]`).join('\n');
  const base = `You are the Anderson House helper, a friendly assistant built into the family's hub app.
Household: ${people}.
Signed in now: ${profile.name} (${profile.kind}${profile.isAdmin ? ', admin' : ''}). Only their own person-scope data is reachable; family-scope data is shared by everyone.
Today is ${today()} (America/New_York).

Apps in the hub:
${appList}
Data conventions: leftovers and reminders are lists stored as item:<id> rows in family scope; prayers are prayer:<id> rows; F260 progress is one row per reading, done:<week>-<dayIndex> (dayIndex 0-4), and f260.summary in person scope; use set_f260_reading and f260_status rather than writing them.

How to behave:
- Keep replies short (a sentence or three); this is a phone-sized chat. Plain text, no markdown headings.
- Use tools to look things up or make changes instead of guessing. After a tool runs, confirm in one short line.
- To add food to the fridge list use add_list_item with app_id leftovers; when something was eaten or thrown out use finish_leftover; for house reminders use add_list_item with app_id reminders.
- Prayers: add_prayer adds one; mark_prayed records that they prayed for a request today ("I prayed for Grandma"); answer_prayer moves it to the answered record ("Grandma's knee is better"). Both take the id from get_data on app prayer, or the request's title. If the tool says several match, ask which one.
- F260: f260_status is the quick way to answer "where am I in my reading" (week, next reading, streak, this week's memory verses); set_f260_reading with done true checks a reading off (done false unchecks it).
- where_is_family says who was last seen on the Dollywood Live map and how long ago (only while the family is at the park).
- If something isn't possible or the app isn't available to this person, say so simply.`;
  const kid = `

This person is a young child. Use simple, warm, cheerful words and short sentences. Only talk about kind, safe, family-friendly things; if asked about anything scary, grown-up, or unsafe, gently steer back to something fun and suggest asking a parent. Never change data in apps this child cannot open. Do not give medical, legal or financial advice.
When the child asks for the Bible verse, memory verse, or "today's verse", call read_todays_verse: it gives the family's memory verses for this week and the hub reads them aloud; repeat the reference and the gist in your reply so they can see it too. Grown-up tools (prayers, fridge clean-up, F260 progress, the family map) will refuse for a child; just say a parent can help with that.`;
  return base + (profile.kind === 'kid' ? kid : '');
}

// ── Anthropic streaming call ──────────────────────────────────
async function* anthropicStream(env, body) {
  const r = await fetch((env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com').replace(/\/$/, '') + '/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ ...body, stream: true }),
  });
  if (!r.ok) {
    let msg = 'HTTP ' + r.status; try { const raw = await r.text(); try { const j = JSON.parse(raw); msg = (j.error && j.error.message) || raw.slice(0, 300); } catch { msg = raw.slice(0, 300) || msg; } } catch {}
    console.error('anthropic error', r.status, msg);
    throw new HttpError(r.status === 429 ? 503 : 502, 'upstream', 'The assistant is unavailable right now (' + msg + ').');
  }
  const reader = r.body.getReader(); const dec = new TextDecoder(); let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      for (const line of chunk.split('\n')) if (line.startsWith('data:')) { try { yield JSON.parse(line.slice(5).trim()); } catch {} }
    }
  }
}

/** One assistant turn: streams text to `send`, returns the full content blocks + stop reason. */
async function assistantTurn(env, body, send) {
  const blocks = []; let stop = null; let usage = null;
  for await (const ev of anthropicStream(env, body)) {
    if (ev.type === 'message_start') usage = ev.message.usage;
    else if (ev.type === 'content_block_start') blocks[ev.index] = ev.content_block.type === 'tool_use' ? { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, json: '' } : ev.content_block.type === 'text' ? { type: 'text', text: '' } : { type: ev.content_block.type, skip: true };
    else if (ev.type === 'content_block_delta') {
      const b = blocks[ev.index]; if (!b || b.skip) continue;
      if (ev.delta.type === 'text_delta') { b.text += ev.delta.text; send('text', { text: ev.delta.text }); }
      else if (ev.delta.type === 'input_json_delta') b.json += ev.delta.partial_json;
    }
    else if (ev.type === 'message_delta') { stop = ev.delta.stop_reason; if (ev.usage) usage = { ...(usage || {}), ...ev.usage }; }
    else if (ev.type === 'error') throw new HttpError(502, 'upstream', (ev.error && ev.error.message) || 'stream error');
  }
  const content = blocks.filter(b => b && !b.skip).map(b => b.type === 'tool_use' ? { type: 'tool_use', id: b.id, name: b.name, input: safeJson(b.json) } : { type: 'text', text: b.text });
  return { content, stop, usage };
}
const safeJson = s => { try { return JSON.parse(s || '{}'); } catch { return null; } };

// ── request handler ───────────────────────────────────────────
export async function chatHandler(c, auth) {
  const profile = auth.profile;
  if (!c.env.ANTHROPIC_API_KEY) throw new HttpError(503, 'chat_not_configured', 'The assistant has no API key yet (npx wrangler secret put ANTHROPIC_API_KEY).');
  if (profile.kind === 'kiosk') throw new HttpError(403, 'no_chat', 'The display profile has no chat.');
  const body = await c.body();
  const text = String(body.message || '').trim().slice(0, 2000);
  if (!text) throw new HttpError(400, 'bad_message', 'Say something first.');
  const people = householdLoader(c.env);
  const apps = await appsFor(profile, people);   // body.apps is ignored: the Worker decides what this person can open

  // Daily cap: user messages sent today (New York day).
  const { results: recent } = await c.env.DB.prepare("SELECT role, content, created_at FROM chat_log WHERE profile_id = ? AND created_at > ? ORDER BY created_at DESC LIMIT 200").bind(profile.id, Date.now() - 36 * 3600000).all();
  const used = await usedToday(c.env, profile.id);
  if (used >= DAILY_CAP) throw new HttpError(429, 'daily_cap', `That's ${DAILY_CAP} messages for today — the assistant is resting until tomorrow.`, { used, cap: DAILY_CAP });

  const { results: household } = await c.env.DB.prepare("SELECT name, kind, is_admin FROM profiles WHERE kind != 'kitchen' ORDER BY sort_order").all();
  const history = recent.slice(0, HISTORY).reverse().filter(r => r.role === 'user' || r.role === 'assistant').map(r => ({ role: r.role, content: r.content }));
  // The API wants alternating turns starting with user; drop a leading assistant and collapse repeats.
  const msgs = [];
  for (const m of history) { if (!msgs.length && m.role !== 'user') continue; if (msgs.length && msgs[msgs.length - 1].role === m.role) msgs[msgs.length - 1].content += '\n' + m.content; else msgs.push({ ...m }); }
  if (msgs.length && msgs[msgs.length - 1].role === 'user') msgs.pop();
  msgs.push({ role: 'user', content: text });

  const now = Date.now();
  await c.env.DB.prepare('INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, 'user', text, now).run();

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const send = (event, data) => writer.write(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)).catch(() => {});
  const ctx = { profile, apps, people };

  const run = async () => {
    let finalText = '', chips = [], usage = null, stop = null;
    try {
      const base = { model: MODEL, max_tokens: MAX_TOKENS, system: systemPrompt({ profile, household, apps }), tools: TOOLS, thinking: { type: 'adaptive' }, output_config: { effort: 'low' } };
      for (let turn = 0; turn < MAX_TURNS; turn++) {
        const t = await assistantTurn(c.env, { ...base, messages: msgs }, send);
        usage = t.usage; stop = t.stop;
        finalText += t.content.filter(b => b.type === 'text').map(b => b.text).join('');
        const uses = t.content.filter(b => b.type === 'tool_use');
        if (t.stop !== 'tool_use' || !uses.length) break;
        msgs.push({ role: 'assistant', content: t.content });
        const results = [];
        for (const u of uses) {
          const r = u.input === null ? { ok: false, result: 'tool input was not valid JSON', chip: null } : await runTool(c.env, ctx, u.name, u.input);
          if (r.chip) { chips.push(r.chip); }
          send('tool', { name: u.name, input: u.input, chip: r.chip, ok: r.ok, ...(r.speak ? { speak: true, text: r.speak } : {}), ...(r.undo ? { undo: r.undo } : {}) });
          results.push({ type: 'tool_result', tool_use_id: u.id, content: typeof r.result === 'string' ? r.result : JSON.stringify(r.result), is_error: !r.ok });
        }
        msgs.push({ role: 'user', content: results });
        finalText += finalText && !finalText.endsWith('\n') ? '\n' : '';
      }
      if (stop === 'max_tokens') send('text', { text: ' …' });
      send('done', { usage: usage ? { input: usage.input_tokens, output: usage.output_tokens } : null, stop_reason: stop, used: used + 1, cap: DAILY_CAP });
    } catch (e) {
      send('error', { error: e.error || 'chat_failed', message: e.message || String(e) });
    } finally {
      const saved = (finalText.trim() || (chips.length ? chips.join(' · ') : '')).slice(0, 4000);
      if (saved) await c.env.DB.prepare('INSERT INTO chat_log (profile_id, role, content, created_at) VALUES (?, ?, ?, ?)').bind(profile.id, 'assistant', saved + (chips.length && finalText.trim() ? '\n' + chips.join(' · ') : ''), Date.now()).run().catch(() => {});
      try { await writer.close(); } catch {}
    }
  };
  c.exec.waitUntil(run());
  return new Response(readable, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no', ...(c.cors || {}) } });
}

/** GET /api/chat/history — the rolling window the model also sees, for the Chat tab to show on open. */
export async function chatHistory(c, auth) {
  const { results } = await c.env.DB.prepare('SELECT role, content, created_at FROM chat_log WHERE profile_id = ? ORDER BY created_at DESC LIMIT ?').bind(auth.profile.id, HISTORY).all();
  return { messages: results.reverse(), used: await usedToday(c.env, auth.profile.id), cap: DAILY_CAP, enabled: !!c.env.ANTHROPIC_API_KEY };
}
