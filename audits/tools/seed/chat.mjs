// Chat seed: the chat_log rows behind the Chat tab (and the chat half of Me → Admin → Usage). Owns chat_log only.
//
// Row = chat_log (profile_id, role 'user'|'assistant', content, created_at) — worker/schema.sql:87-93.
// What reads it:
//   GET /api/chat/history → the newest 20 rows (HISTORY), no age limit, oldest first            worker/src/chat.js:454-457, 17
//   the daily cap: role='user' rows whose New York date is today (DAILY_CAP 60, 36 h window)   worker/src/chat.js:112-117, 16
//   Me → Admin → Usage: user rows per profile per *UTC* day, last 30 days                      worker/src/index.js:519-524
// Assistant rows are stored as the reply text, then a newline and the tool chips joined with ' · ' (each chip starts
// with '✓'); a reply with chips and no text is the chips line alone (worker/src/chat.js:444-445). The Chat tab re-splits
// lines starting with ✓ into chip pills on ' · ' (index.html:1475-1480). Chip wording is the tool's own (chat.js:179-281).
//
// Runs last in SEED_ORDER, so replies that mention app data read the rows the app seeds wrote (fridge, reminders,
// prayers, F260) and a chip is only claimed when the row it describes exists (or, for "Finished", when the item is gone);
// otherwise that exchange is left out. Cross-app facts come from story.mjs PLOT (F260 weeks and progress, the family
// memory-verse week, who prayed today).
//
//   empty     nothing
//   typical   Eli: 4 messages today (two replies carry a tool chip) + one question last night; Ezra: the week's verse (read
//             aloud by the hub) and the family prayer he prayed this morning; Grandma Jo (guest): the fridge and the verse;
//             Mae, Elizabeth, David: a few read-only questions this week (usage table)
//   park      same as typical
//   overflow  Eli: 60 messages today (the cap: the input is disabled), very long messages, a long unbroken link, a reply
//             that is six chips and nothing else; Ezra: a long chat; everyone: two weeks of messages (usage fills 30 rows)
//
// A chip is a write the tool made, and every chat write also posts a '… (via chat)' feed line (chat.js:177-281), so a
// chip is claimed only for a row whose owning seed wrote that feed line: Eli's pancakes (seed/leftovers.mjs, typical and
// overflow) and Eli's dentist reminder (seed/shell.mjs, typical only). Everything else is a read-only question, with one
// knowing exception: overflow's six-chip "Finished …" reply (the chip-wrapping stress case) names items that are not on
// the fridge list, but no seed posts the matching "Finished … from the fridge (via chat)" feed lines (chat.js:281).
//
// All content is invented. Verse paraphrases are the hub's own: the MV table in worker/src/chat.js:56-109, read from
// that file so any week the F260 seed reports (week 52 in overflow) gets its real pair.
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { PLOT, HOUSEHOLD } from './story.mjs';

// MV[week] = [[ref, gist], [ref, gist]] — what read_todays_verse / f260_status return (worker/src/chat.js:110, 299, 305)
const MV = (() => {
  const fallback = {
    37: [['Matthew 28:18-20', 'Go and make disciples everywhere; Jesus is with us always.'], ['Acts 1:8', 'The Holy Spirit gives power to tell about Jesus to the ends of the earth.']],
    38: [['Acts 2:42', 'The first believers kept learning, sharing meals and praying together.'], ['Acts 4:31', "They prayed, the place shook, and they spoke God's word boldly."]],
  };
  try {
    const src = fs.readFileSync(fileURLToPath(new URL('../../../worker/src/chat.js', import.meta.url)), 'utf8');
    const rows = new Function('return ' + src.match(/const MV = (\[[\s\S]*?\n\]);/)[1])();
    return Object.fromEntries(rows.map((m, i) => [i + 1, [[m[0], m[1]], [m[2], m[3]]]]));
  } catch { return fallback; }
})();

export default function seedChat(h) {
  if (h.empty) return;
  const S = 1000;
  const at = (off, hhmm, sec = 0) => h.time(off, hhmm) + sec * S;
  const name = id => h.name(id);
  const first = id => String(name(id) || (HOUSEHOLD[id] || {}).name || id).split(/[\s-]/)[0];
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  // One exchange: the user's line at t, the assistant's row `gap` seconds later — the reply text, then the chips line
  // (worker/src/chat.js:444-445: text + '\n' + chips.join(' · '), or the chips alone when there is no text).
  const say = (pid, t, user, reply, chips = [], gap = 20) => {
    h.chat(pid, 'user', user, t);
    h.chat(pid, 'assistant', chips.length ? (reply ? reply + '\n' + chips.join(' · ') : chips.join(' · ')) : reply, t + gap * S);
  };

  // ── what the other seeds wrote ───────────────────────────────────────────────────────────────────────────
  // leftovers: family item:<id> = { id, name, size, dateLogged: 'YYYY-MM-DD', by, byName }  (apps/leftovers.html:294-297)
  const today = h.day(0), midnight = h.time(0, '00:00');
  const ageOf = it => Math.round((Date.parse(today) - Date.parse(it.dateLogged)) / 86400000);
  const fridge = h.list('family', null, 'leftovers', 'item:').map(r => r.value).filter(v => v && v.name && !Number.isNaN(ageOf(v)))
    .sort((a, b) => ageOf(b) - ageOf(a) || (a.name < b.name ? -1 : 1));                       // oldest first
  const ageWords = n => n === 0 ? 'from today' : n === 1 ? 'from yesterday' : n + ' days old';
  const PROPER = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Grandma|Great-Aunt|Aunt|Uncle|Cousin|Pastor|Church|Hawaiian|Mexican)( |$)/;
  const lc = s => PROPER.test(s) || /^[A-Z][a-z]*[’']s /.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1);   // mid-sentence; keep proper nouns
  // reminders: family item:<id> = { id, text, by, byName, createdAt }  (index.html:1210-1211; the chat tool writes the same, chat.js:195)
  const reminders = h.list('family', null, 'reminders', 'item:').map(r => r.value).filter(v => v && v.text && Number(v.createdAt));
  // F260: person f260.summary { week, weekDone, streak, next, … } (apps/f260.html summary; chat.js:293-300 reads it)
  const plot = id => { const s = h.get('person', id, 'f260', 'f260.summary') || {}; const o = { ...PLOT.f260[id] }; for (const k of ['week', 'weekDone', 'streak', 'next']) if (s[k] != null && s[k] !== '') o[k] = s[k]; return o; };
  // prayer: prayer:<id> = { id, title, status, createdAt: 'YYYY-MM-DD', … }; rows add_prayer writes have ids 'c…' (chat.js:228-230)
  const prayers = (scope, pid) => h.list(scope, pid, 'prayer', 'prayer:').map(r => r.value).filter(v => v && v.title);
  // the family prayer Ezra prayed today: prayedBy = { 'YYYY-MM-DD': [names] } (apps/prayer.html:729, 1559; chat.js:246);
  // the shortest title, as a four-year-old would say it
  const kidPrayer = prayers('family', null).filter(p => p.prayedBy && Array.isArray(p.prayedBy[today]) && p.prayedBy[today].includes(name('ezra')))
    .sort((a, b) => a.title.length - b.title.length)[0];

  const verseLine = w => { const [a, b] = MV[w] || MV[38]; return `${a[0]}: ${a[1]} ${b[0]}: ${b[1]}`; };   // gists are sentences
  const verseRefs = w => { const [a, b] = MV[w] || MV[38]; return `${a[0]} and ${b[0]}`; };
  const fridgeFirst = (n = 3) => {
    const old = fridge.filter(it => ageOf(it) >= 4).slice(0, n);
    if (!old.length) return fridge.length ? 'Nothing is getting old — everything in the fridge is from the last few days.' : 'The fridge list is empty right now.';
    const [a, ...rest] = old;
    const head = `${a.name} is ${ageWords(ageOf(a))}${ageOf(a) >= 7 ? ' — eat it or toss it today' : ''}.`;
    return rest.length ? `${head} After that: ${rest.map(it => `${lc(it.name)} (${ageOf(it)} days)`).join(' and ')}.` : head;
  };
  const fridgeFresh = () => {
    const fresh = fridge.filter(it => ageOf(it) <= 3).reverse().slice(0, 3);
    if (!fresh.length) return fridgeFirst();
    const skip = ageOf(fridge[0]) >= 7 ? ` Skip the ${lc(fridge[0].name)} — it is ${ageOf(fridge[0])} days old.` : '';
    return `The freshest are ${fresh.map(it => `the ${lc(it.name)} (${ageWords(ageOf(it))})`).join(', ')}.${skip}`;
  };
  // "You're on week 38: 2 of 5 readings done, 12-day streak. Next up: …" — the f260_status answer (chat.js:293-300)
  const f260Line = (id, extra = '') => {
    const p = plot(id);
    const head = p.weekDone >= 5 ? `Week ${p.week} is complete: all 5 readings done` : `You're on week ${p.week}: ${p.weekDone} of 5 readings done`;
    const next = p.next && typeof p.next === 'object' ? p.next.ref : p.next;   // f260.summary.next = { week, day, ref }
    return `${head}${p.streak ? `, ${p.streak}-day streak` : ''}.${next && p.weekDone < 5 ? ` Next up: ${next}.` : ''}${extra}`;
  };
  const eliItem = fridge.find(it => it.by === 'eli' && ageOf(it) === 0);                      // logged by Eli this morning
  const eliRem = reminders.filter(r => r.by === 'eli' && r.createdAt >= midnight && r.createdAt < h.now).sort((a, b) => b.createdAt - a.createdAt)[0];
  const itemAsk = it => `Put the leftover ${lc(it.name)} on the fridge list, ${String(it.size || 'Medium').toLowerCase()} container`;
  const itemAt = it => Math.min(h.ago(2), at(0, '07:54', 30));                              // the leftovers seed logs Eli's item at 07:55

  if (h.overflow) return overflow();

  // ── typical (and park) ───────────────────────────────────────────────────────────────────────────────────
  // Eli, last night, just after ticking week 38 day 2 in the F260 app (the f260 seed's feed line at 21:10; PLOT: 2 of 5,
  // not read today): a read-only question, so no chip. (A chat tick would toggle the day the app already ticked —
  // chat.js:207 — and its feed line would read "(via chat)", which the f260 seed's lines do not.)
  const w = plot('eli').week, nx = plot('eli').next;                                       // f260.summary.next = { week, day, ref }
  if (nx && typeof nx === 'object' && nx.ref) say('eli', at(-1, '21:18'), "What's my reading tomorrow?",
    `Week ${nx.week} day ${nx.day}: ${nx.ref}. That will make ${Math.min(5, (plot('eli').weekDone || 0) + 1)} of 5 for week ${nx.week}.`);
  // Eli, this morning
  say('eli', at(0, '07:12'), 'What in the fridge needs eating first?', fridgeFirst());
  if (eliItem) say('eli', itemAt(eliItem), itemAsk(eliItem), `Added — ${eliItem.name} (${eliItem.size || 'Medium'}) is on the list.`, [`✓ Added ${eliItem.name} to leftovers`]);
  // a prayer request Eli added from chat today — only if the prayer seed has one (family or private list, created today)
  const famP = prayers('family', null).find(p => p.createdAt === today && p.status !== 'answered' && (p.by === 'eli' || String(p.id).startsWith('c')));
  const ownP = prayers('person', 'eli').find(p => p.createdAt === today && p.status !== 'answered');
  const newP = famP || ownP;
  if (newP) say('eli', at(0, '07:58'), `Add a prayer request: ${newP.title}`, famP ? 'Added to the family list so everyone can pray.' : 'Added to your private list.',
    [`✓ Added to ${famP ? 'the family' : 'your private'} prayer list: ${newP.title}`]);
  if (eliRem) say('eli', eliRem.createdAt - 25 * S, `Remind everyone: ${eliRem.text}`, "It's on the reminders card on Home.", [`✓ Added reminder: ${eliRem.text}`], 25);
  say('eli', at(0, '08:33'), 'Where am I in F260?', f260Line('eli', ` This week's memory verses are ${verseRefs(w)}.`));

  // Ezra (kid, pre-reader: he talks and the mic types): the week's verse, read aloud by the hub (read_todays_verse has no chip)
  const kw = PLOT.kidverseWeek;
  const [v1, v2] = MV[kw];
  say('ezra', at(0, '07:03'), "What's my verse today?",
    `Here are this week's verses, ${first('ezra')}! ${v1[0]}: ${v1[1]} And ${v2[0]}: ${v2[1]} Can you say the first one with me?`);
  say('ezra', at(0, '07:05'), 'Why did the place shake?', 'Because God heard them praying! It was His way of showing He was right there with them. Isn’t that amazing?');
  // PLOT: Ezra prayed on the family list today (the prayer seed puts his name in prayedBy[today] at 07:31-07:32)
  if (kidPrayer) say('ezra', at(0, '07:34'), `I prayed for ${lc(kidPrayer.title)}`,
    `That’s wonderful, ${first('ezra')}! Praying for each other is just what the first believers did in ${v1[0]}. God loves hearing you.`);

  // Grandma Jo (guest; typical only): no chips — nothing in the other seeds was added by her
  if (name('guest-grandmajo')) {
    say('guest-grandmajo', at(0, '08:02'), 'Is there anything in the fridge I can warm up for lunch?', fridgeFresh());
    say('guest-grandmajo', at(0, '08:04'), 'What is the family memory verse this week?', `The family is on week ${kw}. ${verseLine(kw)} The kids are learning them in Kid Verse.`);
  }

  // The other adults over the week — read-only questions (no rows to reconcile); they fill Admin → Usage. Mae's 21:40
  // message falls on today's UTC date (the usage table counts UTC days, the cap New York days: index.js:522 vs chat.js:115).
  // It asks what the reminders card held at that moment (seed/shell.mjs rows created by then; cleared ones are tombstones).
  const maeAt = at(-1, '21:40'), onCard = reminders.filter(r => r.createdAt <= maeAt).sort((a, b) => a.createdAt - b.createdAt);
  say('christian', maeAt, "What's on the reminders card?", onCard.length
    ? `${onCard.length} on the card: ${onCard.map(r => `“${r.text}” (${first(r.by)})`).join(', ')}.` : 'Nothing — the reminders card is empty.');
  say('christian', at(0, '06:50'), "What are this week's memory verses?", `For week ${plot('christian').week}: ${verseLine(plot('christian').week)}`);
  say('christian', at(-6, '12:20'), 'What should we use up first in the fridge?', 'Nothing on the list is getting old yet.');
  say('mom', at(0, '06:15'), "Did I tick off today's reading?", `Yes. ${f260Line('mom')}`);
  say('mom', at(-1, '19:45'), 'What is Kiara learning this week?', `The family memory verses for week ${kw} are ${verseRefs(kw)}. She hears them in Kid Verse.`);
  const famWeek = Math.max(...['eli', 'christian', 'mom'].map(id => plot(id).week));
  say('dad', at(-2, '20:30'), 'How far behind am I in F260?', `You're on week ${plot('dad').week} with ${plural(plot('dad').weekDone, 'reading')} done this week. The family is on week ${famWeek}, so one reading a day will close the gap.`);
  say('dad', at(-9, '07:10'), 'Is there chili left?', 'Not right now — there is no chili on the fridge list.');
  return;

  // ── overflow ─────────────────────────────────────────────────────────────────────────────────────────────
  function overflow() {
    // Eli: exactly 60 messages today (the cap). The Chat tab shows only the newest 20 rows = the last 10 exchanges
    // (07:57-08:33, every 4 min), which carry the stress cases. The chip for a row another seed wrote sits at that row's
    // own time (Eli's fridge item, which seed/leftovers.mjs logs "via chat"; in this variant Eli added his reminder on
    // Home, so it gets no chat exchange); fillers run every few minutes from 05:30.
    const specials = [];
    if (eliItem) specials.push([itemAt(eliItem), itemAsk(eliItem), `Added — ${eliItem.name} is on the list.`, [`✓ Added ${eliItem.name} to leftovers`]]);
    const last = lastTen();
    const fillers = [                                                                           // a reply may depend on the time asked
      ['What is on the reminders card today?', t => `There are ${reminders.filter(r => r.createdAt <= t).length} reminders on Home.`],
      ['What in the fridge needs eating first?', fridgeFirst(4)],
      ['Where am I in F260?', f260Line('eli')],
      ["What are this week's memory verses?", `For week ${plot('eli').week}: ${verseLine(plot('eli').week)}`],
      ['Is there any soup left?', fridge.some(it => /soup/i.test(it.name)) ? 'Yes — there is soup on the fridge list.' : 'No soup on the list right now.'],
      ['How many things are in the fridge?', `There are ${fridge.length} things on the fridge list.`],
    ];
    const nFill = 60 - last.length - specials.length;
    const start = at(0, '05:30'), span = at(0, '07:50') - start;
    const taken = new Set(specials.map(s => Math.round(s[0] / 60000)));
    for (let i = 0; i < nFill; i++) {
      let t = start + Math.round((span * i) / nFill / 60000) * 60000;
      while (taken.has(Math.round(t / 60000))) t += 60000;                                  // never on a special's minute
      taken.add(Math.round(t / 60000));
      const [u, r] = fillers[i % fillers.length];
      say('eli', t, i >= fillers.length ? `${u} (checking again)` : u, typeof r === 'function' ? r(t) : r, [], 25);
    }
    for (const [t, u, r, c] of specials) say('eli', t, u, r, c, 25);
    last.forEach(([u, r, c = []], i) => say('eli', at(0, '07:57') + i * 240 * S, u, r, c, 25));

    // Ezra: a long chat this morning, with long replies (his name is long in this variant)
    const [v1, v2] = MV[PLOT.kidverseWeek];
    const kid = [
      ["What's my verse today?", `Here are this week's verses, ${name('ezra')}! ${v1[0]}: ${v1[1]} And ${v2[0]}: ${v2[1]} Can you say the first one with me? Let's try it slowly, one little piece at a time, and clap on every word.`],
      ['Again please', `${v1[0]}: ${v1[1]} You are doing so well! Next time try to say it before I do.`],
      ['Why did the place shake?', 'Because God heard them praying! It was His way of showing He was right there with them, and it made them brave enough to tell everyone about Jesus. Isn’t that amazing? What would you like to tell someone about Jesus today?'],
      ['Can I have a cookie', 'That is a question for Mom or Dad! Maybe you can ask them nicely and say thank you.'],
      ['Tell me a story about a big fish', 'Once there was a man called Jonah. God asked him to go to a city called Nineveh, but Jonah ran the other way and got on a boat. A big storm came, and a very big fish swallowed Jonah! Inside the fish, Jonah prayed, and God heard him. The fish spat Jonah out on the beach, and this time he went where God asked. God is kind and gives second chances.'],
      kidPrayer && [`I prayed for ${lc(kidPrayer.title)}`, `That’s wonderful! Praying for each other is just what the first believers did in ${v1[0]}. God loves hearing you.`],
      ['How many stars do I have', 'Your stars live in Kid Verse — open it and look at the top. A grown-up can see them too.'],
      ['Bye', `Bye, ${first('ezra')}! Have a happy day.`],
    ].filter(Boolean);
    kid.forEach(([u, r], i) => say('ezra', at(0, '06:40') + i * 150 * S, u, r));
    // Grandma (guest) — the fridge, with the long names this variant carries
    if (name('guest-grandmajo')) say('guest-grandmajo', at(0, '08:02'), 'Is there anything in the fridge I can warm up for lunch?', fridgeFresh());
    // Everyone who has signed in: two weeks of messages so Admin → Usage fills its 30 rows (profile × UTC day), with the
    // long names. Not Mea (story.mjs: she has never signed in) and not the kiosk (no chat, worker/src/chat.js:391).
    const who = ['christian', 'mom', 'dad', 'ezra', 'kiara', 'guest-grandmajo', 'guest-auntwil'].filter(id => name(id));
    const q = {
      adult: [['Where am I in F260?', 'You are a few readings into the week — keep going!'], ['What in the fridge needs eating first?', 'The oldest things are at the top of the fridge list; start there.'], ['Is there anything on the reminders card for me?', 'Nothing new since yesterday.']],
      kid: [["What's my verse today?", `This week's verses are ${v1[0]} and ${v2[0]}.`], ['Tell me a joke', 'Why did the cookie go to the doctor? It felt crummy!']],
    };
    who.forEach((id, k) => {
      const kidRow = HOUSEHOLD[id] && HOUSEHOLD[id].kind === 'kid';
      for (let d = 1; d <= 13; d++) {
        const n = (k * 3 + d * 5) % 4;                                                        // 0-3 messages that day, deterministic
        for (let j = 0; j < n; j++) {
          const set = q[kidRow ? 'kid' : 'adult'];
          const [u, r] = set[(d + j) % set.length];
          say(id, at(-d, '17:30', (k * 7 + j * 3) * 60), u, r);
        }
      }
    });
  }

  // Eli's last 10 exchanges of the 60 (the only ones the Chat tab shows): a very long message and reply, a long unbroken
  // link, a reply that is six chips and nothing else ("Finished" chips for things that are not on the fridge list, so
  // nothing contradicts the Larder), a long single chip, and the 60th message.
  function lastTen() {
    const oldest = fridge.slice(0, 8);
    const gone = ['The enormous leftover birthday cake with the blue frosting and the sprinkles from the church picnic', 'Half a rotisserie chicken',
      'Garden salad with ranch on the side', 'Garlic bread', 'Two slices of pepperoni pizza', 'The last of the mashed potatoes']
      .filter(n => !fridge.some(it => it.name.toLowerCase() === n.toLowerCase()));
    // (the week as the overflow reminders tell it, seed/shell.mjs: library books Thursday, Kiara's dentist Friday, the
    // potluck Sunday, small group next Wednesday; Grandma Josephine is the guest staying this week)
    const longAsk = 'Okay, big planning question for the rest of the week. Tonight I want to cook something that stretches into lunches, and tomorrow is church supper, so no cooking at all. Thursday the library books are due and Grandma Josephine wants to cook for everyone, usually a casserole or a slow-cooker chili, so I need to make room in the fridge before then. Friday Kiara has the dentist at 3:30, so I would rather not cook much that night either, Sunday is the church potluck, and small group meets here next Wednesday. The fridge is honestly packed right now and I keep finding things in the back that I forgot about. Can you go through everything on the fridge list, tell me what is the oldest, what we should eat tonight, what should probably just go in the trash, and what could be frozen instead of eaten this week? Also remind me which things Mom made so I can ask her before I throw any of them out, because she gets upset when her soup disappears without a word. And if there is anything that is fine for the kids for lunch tomorrow, please point that out as well, thank you!';
    const longReply = `Here is the fridge, oldest first: ${oldest.map(it => `${it.name} (${ageOf(it)} days, ${it.byName || name(it.by) || it.by})`).join('; ')}. `
      + 'Anything past a week should go in the trash today unless it was frozen. Soups, stews and chili freeze well, so move those to the freezer tonight to make room for Thursday. '
      + `For tonight, eat the oldest thing that is still inside four days. For the kids' lunch tomorrow, the freshest small items are the easiest. Ask ${first('mom')} before you toss anything she made.`;
    const longest = fridge.map(it => it.name).sort((a, b) => b.length - a.length)[0];
    // Oldest to newest; the stress cases the bottom of the log shows on every device come last: the long link, then a
    // reply that is only chips (six "Finished" pills, one of them very long), then the 60th message with a short answer.
    const aging = fridge.find(it => ageOf(it) >= 4 && ageOf(it) < 7);
    const out = [
      [longAsk, longReply],
      ['Thanks, that was a lot. Tell me the three oldest again, short.', fridge.length ? oldest.slice(0, 3).map(it => it.name).join('; ') + '.' : 'The fridge list is empty.'],
      ['Where am I in F260 and what are the memory verses?', f260Line('eli', ` This week's memory verses: ${verseLine(plot('eli').week)}`)],
      ['Supercalifragilisticexpialidocious-sized question: what is the longest thing on the fridge list?', longest ? `That would be "${longest}".` : 'The fridge list is empty.'],
      ['Okay', 'Anything else?'],
      ['Is there anything the kids can have for lunch?', fridgeFresh()],
      ['And for the grown-ups?', `Anything from the last three days: ${fridge.filter(it => ageOf(it) <= 3).length} things on the list are that fresh.`],
      ['Can you save this recipe for later? https://example.com/recipes/slow-cooker/white-chicken-chili-with-cornbread-crumbles-and-extra-green-chiles?servings=12&from=grandma-josephine&notes=double-the-beans-and-skip-the-jalapenos-for-the-kids',
        "I can't save links yet. You could add it to a reminder on Home so it doesn't get lost."],
    ];
    if (gone.length) out.push([`We finished off ${gone.map(lc).join(', ')} at the cookout last night. Take them all off the list.`, '', gone.map(n => `✓ Finished ${n}`)]);
    out.push(['Last one for today: what should we eat first tonight?', aging ? `${aging.name}: it is ${ageOf(aging)} days old, the oldest thing still worth eating.` : fridgeFirst(1)]);
    return out.slice(-10);
  }
}
