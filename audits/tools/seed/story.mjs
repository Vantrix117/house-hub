// The demo household's story. Every seed module reads these facts so the apps agree with each other
// (Home, the TV board and chat all read across apps). All content is invented; ids match worker/seed.sql
// because apps.json visibleTo lists those ids.
//
// Demo "now" is Tuesday 22 September 2026, 8:40 am in New York (see lib/server.mjs; the browser clock is fixed
// to the same instant by the driver). Dates below are offsets in days from that morning.

export const DEMO_TIME = '2026-09-22T08:40:00-04:00';

// Household (worker/seed.sql) plus the demo guests. `pin: true` means the adult has already created a PIN.
export const HOUSEHOLD = {
  eli:       { name: 'Eli',           kind: 'adult', admin: true, pin: true },
  christian: { name: 'Mae',           kind: 'adult', pin: true },
  ezra:      { name: 'Ezra',          kind: 'kid' },     // age 5, pre-reader
  kiara:     { name: 'Kiara',         kind: 'kid' },     // age 4, pre-reader
  mom:       { name: 'Elizabeth',     kind: 'adult', pin: true },
  dad:       { name: 'David',         kind: 'adult', pin: true },
  niece:     { name: 'Mea',           kind: 'adult', pin: false },   // has never signed in: first tap creates her PIN
  tv:        { name: 'Downstairs TV', kind: 'kiosk' },
};

// Overflow variant: long names everywhere, to find clipping.
export const LONG_NAMES = {
  eli: 'Elijah Montgomery-Anderson', christian: 'Mae-Christiane Delacroix', ezra: 'Ezra Bartholomew Anderson',
  kiara: 'Kiara Seraphina Josephine', mom: 'Elizabeth Anne Marguerite', dad: 'David Alexander Fitzgerald',
  niece: 'Mea Rosalind Winterbottom', tv: 'Downstairs Family Room Television',
};

// Guests by variant. expires: days from now (null = keep); negative = already ended.
export const GUESTS = {
  typical: [
    { id: 'guest-grandmajo', name: 'Grandma Jo', emoji: '👵', color: '#8A6A4B', pin: false, expires: 6, by: 'eli' },
  ],
  overflow: [
    { id: 'guest-grandmajo', name: 'Grandma Josephine Whitaker', emoji: '👵', color: '#8A6A4B', pin: false, expires: 6, by: 'eli' },
    { id: 'guest-auntwil', name: 'Great-Aunt Wilhelmina Fairweather-Pennington', emoji: '🌼', color: '#5B8143', pin: true, expires: null, by: 'mom' },
    { id: 'guest-theo', name: 'Cousin Theodore', emoji: '🎸', color: '#1F6FB2', pin: false, expires: -1, by: 'dad' },
    { id: 'guest-pastor', name: 'Pastor Tim & Rebecca', emoji: '⛪', color: '#4F5D8C', pin: false, expires: 0.6, by: 'christian' },
  ],
};

// Plot points the app seeds share (typical variant; overflow scales them up, empty has none).
export const PLOT = {
  // F260: each adult's current plan week and how many of this week's 5 readings are done.
  f260: {
    eli:       { week: 38, weekDone: 2, streak: 12, readToday: false },
    christian: { week: 37, weekDone: 5, streak: 4,  readToday: true },
    mom:       { week: 38, weekDone: 3, streak: 26, readToday: true },
    dad:       { week: 31, weekDone: 1, streak: 0,  readToday: false },   // behind: catching up
  },
  kidverseWeek: 38,                   // the family memory-verse week an adult set in Kid Verse
  prayedToday: ['Elizabeth', 'Ezra'], // names on today's family-prayer prayedBy list
  kidsStarsThisWeek: { ezra: 3, kiara: 1 },
  timerRunningFor: 'mom',             // Elizabeth has a kitchen timer running (endAt in the future)
  atPark: false,                      // false on a normal day; the 'park' variant (and overflow, see seed/dollywood-live.mjs) is a park day
};

// Profile photos (typical/overflow/park); files are rendered by the driver into the assets folder.
export const PHOTOS = { eli: 'photo-a', christian: 'photo-b' };
