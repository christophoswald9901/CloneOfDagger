import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

/* =====================================================================
   ALDHAVEN — a walled port on Merrow Bay, and the country round it
   core: utilities, global state, input plumbing
   ===================================================================== */

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
class RNG {
  constructor(seed) { this.f = mulberry32(seed >>> 0); }
  next() { return this.f(); }
  range(a, b) { return a + (b - a) * this.f(); }
  int(a, b) { return a + Math.floor(this.f() * (b - a + 1)); }
  pick(arr) { return arr[Math.floor(this.f() * arr.length)]; }
  chance(p) { return this.f() < p; }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.f() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
}
const rnd = new RNG((Date.now() ^ 0x5bd1e995) >>> 0); // gameplay randomness
const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function ordinal(n) { const s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
let _uid = 1;
const uid = () => 'u' + (_uid++) + Math.floor(Math.random() * 1e6).toString(36);
const $ = id => document.getElementById(id);

// small vector helpers on plain arrays (used by geometry builder)
const v3sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const v3cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const v3dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const v3norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/* ---------------- calendar ---------------- */
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const YEAR = 1652, START_MONTH = 7, START_DOM = 4, START_WD = 1; // Monday, 4th of August
const hourOf = t => (t / 60) % 24;
const dayOf = t => Math.floor(t / 1440);
function dateString(t) {
  const d = dayOf(t);
  const idx = d + START_DOM - 1;
  const dom = idx % 30 + 1;
  const month = (START_MONTH + Math.floor(idx / 30)) % 12;
  return `${WEEKDAYS[(d + START_WD) % 7]}, ${ordinal(dom)} of ${MONTHS[month]}, ${YEAR}`;
}
function clockString(t) {
  const m = Math.floor(t) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
}
const isNight = t => { const h = hourOf(t); return h >= 20 || h < 5.5; };

/* ---------------- global state ---------------- */
const G = {
  state: 'boot',          // boot | title | create | play | dead
  time: 8 * 60 + 30,      // game minutes since the start of day 0
  area: null,             // current area (city / interior / dungeon)
  city: null,
  paused: false,
  uiOpen: false,
  flags: {},
  quests: [],
  wanted: null,           // {fine, until}
  weather: 'clear',
  weatherDay: -1,
  buildings: [],
  bState: {},             // persistent per-building state (discovered, looted…)
  resting: null,
  mapOpen: false,
  shake: 0,
  dmgFlash: 0,
  hotStart: null,
};
const SETTINGS_KEY = 'onecity_aldhaven_settings', OLD_SETTINGS_KEY = 'onecity_daggerfall_settings'; // (settings and saves made under the old name are still read)
const SAVE_KEY = 'onecity_aldhaven_save', OLD_SAVE_KEY = 'onecity_daggerfall_save';
const settings = { pixelScale: 0, sens: 1, music: 0.5, sfx: 0.8, fov: 70, invertY: false, touch: 0, touchSize: 1, showRPG: false, travelSpeed: 20, dbgFly: false, dbgStamina: false, dbgNoFall: true, dbgNoClip: false };
// the minimalist interface hides character stats and combat until Settings → Interface turns them back on
const rpgUI = () => !!settings.showRPG;
function loadSettings() {
  try { const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || localStorage.getItem(OLD_SETTINGS_KEY) || 'null'); if (s) Object.assign(settings, s); } catch (e) { /* storage unavailable */ }
}
function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch (e) { /* storage unavailable */ }
}

/* ---------------- input ---------------- */
const Input = { keys: Object.create(null), vkeys: Object.create(null), stick: { x: 0, y: 0, run: false }, touch: false, mdx: 0, mdy: 0, locked: false, fallback: false, drag: null, expectUnlock: false, lockFromClick: false };
const keyDown = c => !!(Input.keys[c] || Input.vkeys[c]);
