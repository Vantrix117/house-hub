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
// hub.js stand-in: the app now stores through the House Hub SDK; with USE_LOCAL_STORAGE=false it never calls get/set.
global.hub = { profile:{ id:'eli', name:'Eli Anderson', kind:'adult', isAdmin:true, color:'#4F5D8C', emoji:'x' }, canWrite:true,
  ready:async()=>{}, get:()=>undefined, set(){}, remove(){}, list:()=>[], has:()=>false, onChange(){}, onSync(){}, migrate:()=>[],
  activity(){}, theme:()=>'system', setTheme(){}, voiceSupported:false, voiceInput:()=>null, escape:s=>String(s), uid:()=>'id', toast(){} };

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + detail : '')); } };

// The app seeds nothing for a new profile (roadmap 11), so the checks bring their own list.
const FIXTURE = [
  ["p001","Salvation for a friend and her daughter","A friend","Those Who Are Lost - Friends","rotation","active"],
  ["p002","Salvation for a family member","Family member","Those Who Are Lost - Family","rotation","active"],
  ["p003","Salvation for a cousin","Cousin","Those Who Are Lost - Family","rotation","active"],
  ["p004","Healing after surgery","A church friend","Health Needs","daily","active"],
  ["p005","Healing through treatment","A neighbour","Health Needs","daily","active"],
  ["p006","Recovery at home","An older friend","Health Needs","daily","active"],
  ["p007","Peace during a hard season","A friend","Spiritual Needs","daily","active"],
  ["p008","College classes this semester","A student","Schools and Students","rotation","active"],
  ["p009","Safe delivery of their first child","A young couple","Expecting and New Parents","daily","active"],
  ["p010","A new job","A friend","Work and Job Search","rotation","active"],
  ["p011","My financial situation","Me","Financial Needs","daily","active"],
  ["p012","Family health, physical and spiritual","Family","Family","daily","active"],
  ["p013","Healing for a stomach illness","My wife","Health Needs","daily","answered"],
  ["p014","A family moving home from out of state","Friends","Friends","rotation","answered"]
];
global.__FIXTURE = FIXTURE;

const probe = `
const g = id => document.getElementById(id);
// --- a fresh profile is empty and shows the illustrated empty state with one action
ok('fresh data seeds no sample entries', freshData().lists.personal.prayers.length === 0 && freshData().lists.shared.prayers.length === 0);
ok('empty Today shows the illustration and one action', g('todayList').innerHTML.includes('art/empty/prayers.svg')
  && (g('todayList').innerHTML.match(/<button/g)||[]).length === 1 && g('todayList').innerHTML.includes('data-go="add"'));
ok('empty Today hides the action row', g('todayActions').hidden === true);
// --- seed the fixture the old sample data used to provide
L().prayers = __FIXTURE.map(r => ({ id:r[0], title:r[1], for:r[2], phone:'', detail:'', category:r[3],
  cadence:r[4], days:[], status:r[5], createdAt:'2026-09-10', lastPrayedAt:null,
  answeredAt:(r[5]==='answered'?'2026-09-10':null), answerNote:(r[5]==='answered'?'Answered.':null),
  updates:[], sharedFrom:null, prayedBy:{}, updatedAt:'2026-09-10T00:00:00.000Z' }));
renderAllScreens();
ok('Today with entries shows the action row', g('todayActions').hidden === false);
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
D.activeList = 'shared';   // who-prayed comes from hub.profile.name
D.lists.shared.prayers.push({ id:'s001', title:'Check', for:'', phone:'', detail:'', category:'Health Needs',
  cadence:'daily', days:[], status:'active', createdAt:TODAY, lastPrayedAt:null, answeredAt:null,
  answerNote:null, updates:[], sharedFrom:null, prayedBy:{}, updatedAt:'' });
setPrayed(D.lists.shared.prayers[0], true); renderToday();
ok('shared list records who prayed', (D.lists.shared.prayers[0].prayedBy[TODAY]||[]).includes('Eli Anderson'));
ok('initials render on shared rows', g('todayList').innerHTML.includes('>EA<'));
setPrayed(D.lists.shared.prayers[0], false);
ok('unmarking removes only this person', !(D.lists.shared.prayers[0].prayedBy[TODAY]||[]).length);
D.activeList = 'personal';
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
// --- markup: Pray now is the one primary button on Today; Print/Copy/Kitchen sit behind "More"
const today = src.slice(src.indexOf('<section id="s-today"'), src.indexOf('<section id="s-all"'));
const primaries = (today.match(/<button class="act(?: [a-z-]+)*"/g) || []).filter(b => !/ghost/.test(b));
ok('Today markup has exactly one primary button and it is Pray now', primaries.length === 1 && /id="startPray">Pray now</.test(today), primaries.join(' '));
ok('Today markup has no inline Print/Copy/Kitchen buttons', !/id="(doPrint|copyToday|openKitchen)"/.test(today));
ok('overflow sheet offers Kitchen, Copy and Print', /data-more="kitchen"/.test(src) && /data-more="copy"/.test(src) && /data-more="print"/.test(src));
ok('no in-app theme chips (the hub Me tab owns the theme)', !/data-look=|id="f-theme"/.test(src));
ok('no stale backup warning', !/backupWarn|backupNudge|Safari can clear/.test(src));
try { eval(code + '\n' + probe); }
catch (e) { fail++; console.log('  FAIL script threw: ' + e.message); }
console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
