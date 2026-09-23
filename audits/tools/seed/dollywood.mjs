// Dollywood build guide (apps/dollywood.html, app id 'dollywood', person scope). Eli is rebuilding the park in
// Planet Coaster 2 and works through the guide's 242 build steps section by section.
//
//   empty     nothing (the guide's first open: every chip 0/N, "Mark done" on step 1)
//   typical   three sections part-done (Entrance & Plaza 7/9, Showstreet 13/21, Dolly Parton Experience 4/19), a plot width set
//   overflow  239 of 242 steps done (every section full but the last three steps of Wildwood Grove) and a huge plot width
//   park      = typical (the build guide has nothing park-day specific)
//
// Only Eli has progress: the other adults can open the guide (apps.json:9 visibleTo) but have never ticked a step.

// Step ids are '<section>-NN' (1-based, two digits) and these are the per-section counts, in the chip order of the
// page payload (apps/dollywood.html:682 D.sections / D.steps; stepsOf() at :1063 filters D.steps by section).
const SECTIONS = [
  ['entrance', 9], ['show', 21], ['dpx', 19], ['village', 20], ['fair', 26], ['river', 20], ['jukebox', 18],
  ['crafts', 27], ['owens', 15], ['wild', 20], ['timber', 21], ['grove', 26],
];
const stepId = (sec, i) => `${sec}-${String(i).padStart(2, '0')}`;

export default function dollywood(h) {
  if (h.empty) return;

  // How many steps of each section are done, in order from step 1 (the guide is worked top to bottom).
  const done = h.overflow
    ? Object.fromEntries(SECTIONS.map(([s, n]) => [s, s === 'grove' ? n - 3 : n]))
    : { entrance: 7, show: 13, dpx: 4 };   // typical: the boot section (curSec 'entrance', :1061) opens on step 8, not done

  // 'progress' — {stepId: true}: read at apps/dollywood.html:1109 and :1111 (hub.get('progress',{default:{}})),
  // written by save() at :1062 as hub.set('progress', Object.assign({}, doneMap)); a tick is doneMap[step.id]=true (:1086).
  const progress = {};
  for (const [sec, n] of SECTIONS) for (let i = 1; i <= (done[sec] || 0); i++) progress[stepId(sec, i)] = true;
  h.person('eli', 'dollywood', 'progress', progress, h.time(-1, '21:12'));

  // 'plot' — the Planet Coaster plot width in metres, stored as the input's string value: savePlot() at :1055
  // (hub.set('plot', $('sc-plot').value || null)); read back at :1110 into #sc-plot. The built park is 917 m wide
  // (D.layers.allbox, :1051), so 400 m compresses it to 44 %; overflow tries a five-digit width.
  h.person('eli', 'dollywood', 'plot', h.overflow ? '12500' : '400', h.time(-6, '20:05'));

  // The feed line a tick posts: hub.activity('Ticked ' + now.title) at :1086 — the last step Eli ticked last night
  // (real step titles: show-13 in typical; crafts-17, the guide's longest title, in overflow).
  if (h.typical) h.activity('eli', 'dollywood', 'Ticked Traditions, Wired Up Names and Gazebo Gifts (#17, #18, #13)', h.time(-1, '21:12'));
  if (h.overflow) h.activity('eli', 'dollywood', "Ticked Calico Falls Schoolhouse (#47), Hickory House BBQ (#70), Food Truck Park (#67), Games (#50), Airbrush T-Shirts (#55), Tornado Dippin' Dots (#74)", h.time(-1, '21:12'));
}
