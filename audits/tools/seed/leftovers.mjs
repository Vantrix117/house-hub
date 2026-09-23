// Larder Ledger (apps/leftovers.html) — the family fridge log.
//
// Rows: family scope, app 'leftovers', one row per item under `item:<id>`. A finished item is a tombstone
// (value null), exactly what the app's hub.remove writes (apps/leftovers.html:306-311).
// Groups come only from the age of `dateLogged` (apps/leftovers.html:137, 168-170):
//   Use it up = 7+ days (red, and the warning banner "N items at a week or older", :207-215)
//   Aging     = 4-6 days (amber; also what Home's "In the fridge" card counts, index.html:680-681)
//   Fresh     = 0-3 days (green)
// Feed lines use the app's own wording: 'Logged <name> (<size>) in the fridge' (:302) and 'Finished the <name>' (:309).
// Eli's item from this morning (Blueberry pancakes, 07:55) is the one seed/chat.mjs narrates as added through Chat
// ("Put the leftover blueberry pancakes on the fridge list…" → "✓ Added Blueberry pancakes to leftovers"), so its feed
// line is the chat tool's wording instead: 'Logged <name> (<size>) in the fridge (via chat)' (worker/src/chat.js:189).
//
// Story: Mea (niece) has never signed in (story.mjs HOUSEHOLD), so she logs nothing; the kids are pre-readers and
// log nothing either. Guests do log things in overflow (a guest can use every adult app).

// apps/leftovers.html:136 (and the chat tool's enum, worker/src/chat.js:32)
const SIZES = ['Small', 'Medium', 'Large', 'Family-size'];

export default function seed(h) {
  if (h.empty) return;   // empty: no app data at all — the ledger shows "Nothing logged yet."

  // One ledger item. Shape as the app writes it at apps/leftovers.html:294-297 and reads it at :204, :263-265:
  //   { id, name, size, dateLogged: 'YYYY-MM-DD', by: profileId, byName: display name at the time }
  const log = (by, name, size, daysAgo, hhmm, { feed = true, via = '' } = {}) => {
    if (!SIZES.includes(size)) throw new Error('leftovers seed: bad size ' + size);
    const id = h.uid('lo');
    const at = h.time(-daysAgo, hhmm);
    const item = { id, name, size, dateLogged: h.day(-daysAgo), by, byName: h.name(by) };
    h.family('leftovers', 'item:' + id, item, at);
    if (feed) h.activity(by, 'leftovers', 'Logged ' + name + ' (' + size + ') in the fridge' + (via === 'chat' ? ' (via chat)' : ''), at);
    return item;
  };
  // Finished: the row becomes a tombstone (hub.remove → value null, apps/leftovers.html:308) and the feed says so (:309).
  const finish = (item, by, daysAgo, hhmm) => {
    const at = h.time(-daysAgo, hhmm);
    h.family('leftovers', 'item:' + item.id, null, at);
    h.activity(by, 'leftovers', 'Finished the ' + item.name, at);
  };

  if (h.typical) {   // also the park variant (h.base === 'typical')
    // A realistic Tuesday morning: 6 in the fridge; one 8 days old (the red banner), two aging, three fresh.
    // Home's fridge card therefore reads "3 to eat this week" (Chicken alfredo 8d, chili 5d, sweet potatoes 4d).
    const taco = log('dad', 'Taco meat', 'Medium', 6, '18:20');
    log('mom',       'Chicken alfredo',         'Large',       8, '19:10');   // Mon 14 Sep → Use it up
    log('dad',       'Beef and bean chili',     'Family-size', 5, '18:45');   // Thu 17 Sep → Aging
    log('christian', 'Roasted sweet potatoes',  'Medium',      4, '19:30');   // Fri 18 Sep → Aging
    log('mom',       'Sunday pot roast',        'Large',       2, '13:40');   // Sun 20 Sep → Fresh
    finish(taco, 'dad', 1, '12:30');                                           // Mon lunch: the taco meat is gone
    log('christian', 'Spaghetti and meatballs', 'Medium',      1, '19:20');   // Mon 21 Sep → Fresh
    log('eli',       'Blueberry pancakes',      'Small',       0, '07:55', { via: 'chat' });   // this morning, from Chat → Fresh
    return;
  }

  // Overflow: 32 in the fridge, long names (the profiles carry LONG_NAMES in this variant, so byName is long too),
  // several people and two guests, and ages up to 63 days so "63d ago" and a full bar show.
  // [by, name, size, daysAgo, time]
  const rows = [
    // Use it up (7+ days): 10
    ['mom',             'Forgotten jar of homemade cinnamon applesauce from the back of the bottom shelf', 'Small', 63, '17:05'],
    ['dad',             'Church potluck baked ziti (the big foil pan from Wednesday night supper)', 'Family-size', 30, '21:10'],
    ['christian',       'Butternut squash soup', 'Large', 21, '18:40'],
    ['guest-theo',      'Cousin Theo’s smoked brisket, sliced, with the burnt ends in a separate container', 'Large', 17, '20:15'],
    ['eli',             'Vegetable fried rice with scrambled egg, peas and carrots', 'Medium', 14, '19:00'],
    ['mom',             'Extra-large family-size lasagna with spinach, ricotta, mozzarella and parmesan', 'Family-size', 12, '18:30'],
    ['dad',             'Meatloaf with brown-sugar ketchup glaze', 'Medium', 10, '19:15'],
    ['guest-grandmajo', 'Grandma Josephine’s slow-cooker white chicken chili with cornbread crumbles on top', 'Family-size', 9, '17:45'],
    ['christian',       'Stuffed bell peppers', 'Medium', 8, '18:55'],
    ['eli',             'Chicken alfredo', 'Large', 7, '19:10'],
    // Aging (4-6 days): 8
    ['mom',             'Shepherd’s pie', 'Large', 6, '18:20'],
    ['guest-auntwil',   'Great-Aunt Wilhelmina’s famous seven-layer salad (the one with bacon, peas and cheddar)', 'Large', 6, '12:40'],
    ['dad',             'Red beans and rice', 'Medium', 6, '19:05'],
    ['christian',       'Broccoli cheddar soup', 'Medium', 5, '18:10'],
    ['eli',             'Pulled pork for sandwiches', 'Family-size', 5, '20:00'],
    ['mom',             'Beef stroganoff over buttered egg noodles with a little extra sour cream', 'Large', 5, '18:35'],
    ['guest-grandmajo', 'Banana bread (two loaves, one with walnuts and one without for the kids)', 'Medium', 4, '15:20'],
    ['dad',             'Jambalaya', 'Large', 4, '19:40'],
    // Fresh (0-3 days): 14
    ['christian',       'Half a sheet cake from the small-group fellowship night, vanilla with strawberry filling', 'Large', 3, '21:30'],
    ['mom',             'Chicken pot pie', 'Medium', 3, '18:25'],
    ['eli',             'Grilled chicken thighs (six pieces, marinated in lemon, garlic and rosemary)', 'Medium', 3, '19:50'],
    ['dad',             'Cornbread', 'Small', 3, '18:05'],
    ['guest-auntwil',   'Pesto pasta salad with cherry tomatoes and mozzarella pearls', 'Large', 2, '13:15'],
    ['mom',             'Sunday pot roast with carrots, onions and baby potatoes', 'Family-size', 2, '13:40'],
    ['christian',       'Apple crisp', 'Medium', 2, '20:10'],
    ['dad',             'Supercalifragilisticexpialidociously-enormous pot of vegetable beef stew', 'Family-size', 1, '18:50'],
    ['eli',             'Egg salad', 'Small', 1, '12:15'],
    ['christian',       'Spaghetti and meatballs', 'Medium', 1, '19:20'],
    ['mom',             'Chicken enchiladas verde with Mexican rice and refried beans', 'Large', 1, '19:35'],
    ['guest-grandmajo', 'Cut watermelon', 'Large', 0, '07:30'],
    ['dad',             'Hawaiian rolls', 'Small', 0, '07:45'],
    ['eli',             'Blueberry pancakes', 'Small', 0, '07:55'],
  ];
  // The feed would not keep two months of lines; only the last fortnight's logs post a feed line.
  // Eli's age-0 item is the one Chat added (see the header).
  for (const [by, name, size, d, hhmm] of rows) log(by, name, size, d, hhmm, { feed: d <= 14, via: by === 'eli' && d === 0 ? 'chat' : '' });
  // Four finished recently (tombstones + "Finished the …" lines).
  const gone = [
    [log('dad', 'Taco meat', 'Medium', 6, '18:15', { feed: false }), 'dad', 1, '12:30'],
    [log('mom', 'Macaroni and cheese with a toasted breadcrumb topping', 'Large', 5, '18:00', { feed: false }), 'christian', 2, '12:05'],
    [log('christian', 'Tomato basil soup', 'Medium', 9, '18:45', { feed: false }), 'eli', 3, '19:30'],
    [log('guest-grandmajo', 'Peach cobbler', 'Medium', 4, '16:00', { feed: false }), 'mom', 0, '07:10'],
  ];
  for (const [item, by, d, hhmm] of gone) finish(item, by, d, hhmm);
}
