#!/usr/bin/env node
// Behaviour checks for apps/prayer.html. Runs the app's script against a DOM stub
// and asserts the logic still holds. Usage:  node handoff/prayer/check.js apps/prayer.html
// Exits 1 on any failure. If you rename a function the checks call, update this file too.
const fs = require('fs');
const file = process.argv[2] || 'apps/prayer.html';
const src = fs.readFileSync(file, 'utf8');
const i = src.indexOf('<script>'), j = src.lastIndexOf('</script>');
if (i < 0 || j < 0) { console.error('no <script> block found in ' + file); process.exit(1); }
let code = src.slice(i + 8, j);
// Force the in-memory storage path so the checks never touch real localStorage.
code = code.replace(/const USE_LOCAL_STORAGE = true;/, 'const USE_LOCAL_STORAGE = false;');

const els = {}, store = {};
const mk = id => { const o = { id, innerHTML:'', textContent:'', value:'', disabled:false, style:{},
  dataset:{}, selectedOptions:[], _cls:new Set(), checked:false,
  setAttribute(){}, getAttribute(){ return null; }, hasAttribute(){ return false; },
  addEventListener(){}, removeEventListener(){}, focus(){}, click(){},
  querySelectorAll(){ return []; }, querySelector(){ return null; }, appendChild(){}, remove(){} };
  o.classList = { add:c=>o._cls.add(c), remove:c=>o._cls.delete(c),
    toggle:(c,v)=>{ (v===undefined? !o._cls.has(c) : v) ? o._cls.add(c) : o._cls.delete(c); },
    contains:c=>o._cls.has(c) };
  return o; };
const get = id => els[id] || (els[id] = mk(id));
global.document = { getElementById:get, querySelectorAll:()=>[], querySelector:()=>null,
  addEventListener(){}, createElement:()=>mk('tmp'), hidden:false,
  body:{ classList:{ toggle(){}, add(){}, remove(){}, contains(){ return false; } }, setAttribute(){} },
  documentElement:{ setAttribute(){}, dataset:{} } };
global.window = { scrollTo(){}, print(){ global.__printed = true; }, matchMedia:()=>({matches:false, addEventListener(){}}) };
global.location = { search:'', href:'' };
global.localStorage = { getItem:k=>store[k]??null, setItem:(k,v)=>{store[k]=v;}, removeItem:k=>{delete store[k];} };
global.alert = ()=>{}; global.prompt = ()=>null; global.confirm = ()=>true; global.navigator = {};
global.setTimeout = ()=>0; global.clearTimeout = ()=>0; global.setInterval = ()=>0;
global.TextEncoder = require('util').TextEncoder;
global.btoa = s => Buffer.from(s, 'binary').toString('base64');

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); } };

const probe = `
const g = id => document.getElementById(id);
// --- today
ok('today has entries', todaySet().length > 0, todaySet().length);
ok('today headline mentions a count', /\\d/.test(g('todayLine').textContent), g('todayLine').textContent);
const first = todaySet().length;
todaySet().forEach(p => setPrayed(p, true)); renderToday();
ok('marking everything ends the list (rotation frozen)', todaySet().filter(p => p.lastPrayedAt !== TODAY).length === 0);
ok('rotation picks cached for the day', !!L().rotationFor && L().rotationFor.date === TODAY);
ok('streak counts today', currentStreak() >= 1, currentStreak());
// --- plans
const dow = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][new Date().getDay()];
PL().mode = 'focus'; PL().focusCategory = 'Health Needs';
ok('focus mode narrows to one category', todaySet().every(p => p.category === 'Health Needs') && todaySet().length > 0);
PL().mode = 'byDay'; PL().includeDaily = false; PL().dayMap[dow] = ['Those Who Are Lost - Family'];
ok('byDay uses the day map', todaySet().every(p => p.category === 'Those Who Are Lost - Family'));
PL().includeDaily = true;
ok('byDay includeDaily adds daily requests', todaySet().length > 2);
PL().mode = 'everything'; L().rotationFor = null;
// --- prayer mode
L().prayers.forEach(p => { p.lastPrayedAt = null; });
startPrayMode();
ok('prayer mode opens', g('pray').classList.contains('on'));
let n = 0; while (g('pray').classList.contains('on') && n++ < 60) { setPrayed(prayList[prayIdx], true); prayStep(1); }
ok('prayer mode closes after the last request', !g('pray').classList.contains('on'));
ok('prayer mode marked every request', prayList.every(p => p.lastPrayedAt === TODAY));
// --- shared list + initials
D.me = 'Eli Anderson'; D.activeList = 'shared';
D.lists.shared.prayers.push({ id:'s001', title:'Check', for:'', phone:'', detail:'', category:'Health Needs',
  cadence:'daily', days:[], status:'active', createdAt:TODAY, lastPrayedAt:null, answeredAt:null,
  answerNote:null, updates:[], sharedFrom:null, prayedBy:{}, updatedAt:'' });
setPrayed(D.lists.shared.prayers[0], true); renderToday();
ok('shared list records who prayed', (D.lists.shared.prayers[0].prayedBy[TODAY]||[]).includes('Eli Anderson'));
ok('initials render on shared rows', g('todayList').innerHTML.includes('>EA<'));
setPrayed(D.lists.shared.prayers[0], false);
ok('unmarking removes only this person', !(D.lists.shared.prayers[0].prayedBy[TODAY]||[]).length);
// --- merge
D.lists.shared.prayers = [{ id:'s001', title:'local', updates:[{date:'2026-09-01',note:'a'}],
  prayedBy:{'2026-09-11':['Eli']}, lastPrayedAt:'2026-09-11', updatedAt:'2026-09-11T01:00:00Z' }];
mergeShared({ prayers:[{ id:'s001', title:'remote', updates:[{date:'2026-09-02',note:'b'}],
  prayedBy:{'2026-09-11':['Christian']}, lastPrayedAt:'2026-09-12', updatedAt:'2026-09-12T01:00:00Z' },
  { id:'s002', title:'from phone', updates:[], prayedBy:{}, updatedAt:'2026-09-12T02:00:00Z' }],
  categories:['Brand New'], prayerDays:['2026-09-12'] });
const m = D.lists.shared.prayers.find(p => p.id === 's001');
ok('merge: newer record wins', m.title === 'remote');
ok('merge: updates unioned', m.updates.length === 2);
ok('merge: prayedBy unioned', m.prayedBy['2026-09-11'].length === 2);
ok('merge: remote-only record added', D.lists.shared.prayers.some(p => p.id === 's002'));
ok('merge: categories unioned', D.lists.shared.categories.includes('Brand New'));
mergeShared({ prayers:[{ id:'s001', title:'stale', updatedAt:'2020-01-01T00:00:00Z', updates:[], prayedBy:{} }] });
ok('merge: older remote does not clobber', D.lists.shared.prayers.find(p=>p.id==='s001').title === 'remote');
// --- sync config
ok('sync is off by default', !SYNC.ready());
D.sync.mode = 'github'; D.sync.owner = 'x'; D.sync.repo = 'y'; D.sync.path = 'z.json';
ok('sync ready once configured', !!SYNC.ready());
SYNC.setToken('tok_test');
ok('token never appears in an export', !JSON.stringify(D).includes('tok_test'));
ok('utf-8 base64 round-trips', Buffer.from(SYNC.b64('Hylan — héllo'),'base64').toString('utf8') === 'Hylan — héllo');
D.sync.mode = 'off'; D.activeList = 'personal';
// --- other screens
renderAllScreens();
ok('answered list renders', (g('answeredList').innerHTML.match(/class="ans"/g)||[]).length >= 2);
ok('list groups by category', (g('allList').innerHTML.match(/<details/g)||[]).length >= 5);
openKitchen(); ok('kitchen view renders items', (g('kitchenBody').innerHTML.match(/k-item/g)||[]).length >= 10);
buildPrint(); ok('print builds tick boxes', (g('printArea').innerHTML.match(/p-box/g)||[]).length >= 10);
const parsed = parsePaste('Health Needs:\\n* Sam Carter - recovery\\nAunt Ruth\\n\\nMissionaries - Abroad:\\nThe Carters', 'Personal');
ok('paste parser reads headings', parsed[0].category === 'Health Needs' && parsed[2].category === 'Missionaries - Abroad');
ok('paste parser splits name - request', parsed[0].for === 'Sam Carter' && parsed[0].title === 'recovery');
L().prayers[0].createdAt = '2025-' + TODAY.slice(5);
ok('anniversaries fire on the day', anniversaries().length >= 1);
`;
try { eval(code + '\n' + probe); }
catch (e) { fail++; console.log('  FAIL script threw: ' + e.message); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
