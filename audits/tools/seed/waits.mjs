// The queue-times.com feed the Worker's /api/dollywood/waits route proxies, served by the rig instead of the network.
// Owned by the park-map seed. Returns the upstream shape: { lands: [{ name, rides: [{ name, is_open, wait_time, last_updated }] }] }.
//
// The Worker (worker/src/index.js:63-77) flattens this to rides[{ name (® and ™ stripped), land, open, wait, updated }].
// The park map (apps/dollywood-live.html:1499-1503) matches each ride to an ATTRACTION listing by wnorm(name)
// (lowercase, & -> "and", ® ™ and every non-alphanumeric dropped; WALIAS at :1494 is empty), so the names below are the
// listing names from the page's embedded payload (D.official, cat 'attraction'). A closed ride is is_open:false and the
// app shows it as "Closed" (:1502 wait = open ? wait : null); an open ride with wait 0 shows "Walk on" / "GO".
//
// Deterministic: the same rides, waits and stamps on every call. The stamps are anchored to the demo morning, because
// the browser's clock is fixed at DEMO_TIME while the server clock runs on from it — "posted 3 min ago" stays true.
import { DEMO_TIME } from './story.mjs';

// [land, name as queue-times would post it, open, wait minutes, minutes before "now" it was posted]
const RIDES = [
  ['Roller Coasters', 'Lightning Rod®', true, 75, 3],
  ['Roller Coasters', 'Thunderhead', true, 45, 3],
  ['Roller Coasters', 'Big Bear Mountain', true, 55, 4],
  ['Roller Coasters', 'Wild Eagle', true, 35, 3],
  ['Roller Coasters', 'Mystery Mine', true, 30, 5],
  ['Roller Coasters', 'Tennessee Tornado', true, 20, 3],
  ['Roller Coasters', 'FireChaser Express', true, 25, 4],
  ['Roller Coasters', 'Dragonflier', true, 10, 3],
  ['Roller Coasters', 'Whistle Punk Chaser', true, 5, 6],
  ['Roller Coasters', 'Blazing Fury', false, 0, 48],               // closed: the dark ride is down this morning
  ['Thrill Rides', 'Drop Line', true, 40, 3],
  ['Thrill Rides', 'NightFlight Expedition', true, 50, 4],
  ['Thrill Rides', 'Barnstormer', true, 20, 5],
  ['Thrill Rides', 'Lumberjack Lifts', true, 15, 3],
  ['Family Rides', 'Sky Rider', true, 10, 4],
  ['Family Rides', 'The Scrambler', true, 5, 6],
  ['Family Rides', 'The Waltzing Swinger', true, 10, 4],
  ['Family Rides', 'Demolition Derby', true, 15, 5],
  ['Family Rides', 'Great Tree Swing', true, 10, 3],
  ['Family Rides', "Rockin' Roadway", true, 20, 4],
  ['Family Rides', 'Village Carousel', true, 5, 7],
  ['Family Rides', 'Dollywood Express', true, 25, 5],               // posted name differs from the listing ("… Train Depot"): no chip attaches
  ['Kids Rides', 'The Mad Mockingbird', true, 5, 4],
  ['Kids Rides', 'Black Bear Trail', true, 5, 6],
  ['Kids Rides', 'Treetop Tower', true, 10, 3],
  ['Kids Rides', 'Frogs & Fireflies', true, 0, 5],                  // walk on
  ['Kids Rides', 'Busy Bees', true, 5, 6],
  ['Kids Rides', 'Lucky Ducky', true, 5, 8],
  ['Kids Rides', 'Piggy Parade', true, 5, 8],
  ['Kids Rides', 'Shooting Star', true, 5, 7],
  ['Kids Rides', 'Lemon Twist', true, 5, 7],
  ['Kids Rides', 'The Amazing Flying Elephants', true, 10, 5],
  ['Water Rides', 'Smoky Mountain River Rampage', true, 15, 4],
  ['Water Rides', 'Daredevil Falls', false, 0, 95],                 // closed: late-September water ride hours
];

export function waitsFeed(now) {
  const demo = Date.parse(DEMO_TIME);
  const base = Math.abs(now - demo) < 86400000 ? demo : now;
  const lands = [];
  for (const [land, name, open, wait, mins] of RIDES) {
    let l = lands.find(x => x.name === land);
    if (!l) lands.push(l = { name: land, rides: [] });
    l.rides.push({ name, is_open: open, wait_time: wait, last_updated: new Date(base - mins * 60000).toISOString() });
  }
  return { lands };
}
