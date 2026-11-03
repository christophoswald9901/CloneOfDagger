/* =====================================================================
   The city of Daggerfall: an irregular walled port with seven quarters,
   a hierarchical street network that grows from the market outwards,
   buildings that face their street, landmarks, carriage stops, harbour
   and the countryside beyond the walls
   ===================================================================== */

const SHORE = 150, WALL_T = 3, WALL_H = 10, WORLD_R = 330, QUAY_H = 1.0;
// the land wall, from the western shore round the north to the eastern shore; the sea closes the south side
const WALL_PTS = [[-160, 150], [-170, 100], [-178, 38], [-176, -30], [-160, -88], [-122, -132], [-66, -160], [0, -168], [66, -160], [122, -132], [160, -88], [176, -30], [178, 38], [170, 100], [160, 150]];
// far: where each gate's road heads into the countryside
const GATES = [
  { id: 'westgate', name: 'the West Gate', seg: 2, t: 0.5, far: [-346, 14] }, { id: 'oldgate', name: 'the Old Gate', seg: 5, t: 0.42, far: [-170, -346] },
  { id: 'northgate', name: 'the North Gate', seg: 9, t: 0.5, far: [346, -236], via: [168, -168] }, { id: 'eastgate', name: 'the East Gate', seg: 11, t: 0.55, far: [346, -30] },
];
// where the tracks beyond the gate roads lead: the headings of their legs (0 south, π/2 east, π north), and any fixed way they take first
const H_N = Math.PI, H_E = Math.PI / 2, H_W = -Math.PI / 2;
const GATE_TRACKS = {
  westgate: { aims: [H_W, H_W, H_W] },                               // along the coast to the west
  oldgate: { aims: [-2.4, H_N, H_N, H_N] },                         // north-west, then north into the hills
  northgate: { pre: [[362, -290], [358, -345], [334, -393], [296, -444], [244, -502], [196, -566], [170, -640]], aims: [H_N, 2.8, H_N, H_N] }, // up the stream's west bank to its spring, then north up the long valleys
  eastgate: { pre: [[440, -25], [520, -21], [560, -19], [600, -20]], aims: [H_E, H_E, H_E] }, // over the stone bridge, then east along the coast
};
const gateTracks = () => GATES.map(g => ({ pre: [g.far, ...(GATE_TRACKS[g.id].pre || [])], aims: GATE_TRACKS[g.id].aims }));
const MARKET = [0, 12], MEMORIAL = [0, -50];
const CASTLE_Z = -58; // the castle's frame: its north wall is part of the city wall
// the castle ramp climbs the scarp in two legs: east→west along z1, a landing at xw, then west→east along z2 to the forecourt
const RAMP = { x0: 40, xw: -24, xe: 10, z1: -72, z2: -79, w: 6 };
const LOOK_AT = [-12, 26]; // what the lookout on Pilgrim's Rise faces

const FIRST_M = ['Aldric', 'Bertrand', 'Cedric', 'Gaston', 'Pierre', 'Remy', 'Theodore', 'Lucien', 'Guillaume', 'Mathieu', 'Roland', 'Edouard', 'Gilles', 'Anton', 'Basile', 'Corvin', 'Darien', 'Emeric', 'Florian', 'Hugo', 'Jourdain', 'Lothaire', 'Marius', 'Olivier', 'Rainier', 'Tristan', 'Valentin', 'Kharjo', 'Sigurd', 'Azzan', 'Tavi', 'Hazadir', 'Brond', 'Ferrin'];
const FIRST_F = ['Jehanne', 'Marguerite', 'Odile', 'Sabine', 'Yvette', 'Aurore', 'Isolde', 'Nadine', 'Celestine', 'Fiona', 'Helene', 'Adele', 'Blanche', 'Clemence', 'Elodie', 'Genevieve', 'Liliane', 'Mirabelle', 'Oriane', 'Perrine', 'Rosalind', 'Solene', 'Viviane', 'Iszara', 'Saadia', 'Freyja', 'Nirasha'];
const SURNAMES = ['Belmont', 'Carrard', 'Dufresne', 'Fontaine', 'Gautier', 'Lamoreaux', 'Marchand', 'Montclair', 'Rochefort', 'Sauveur', 'Thibault', 'Vautrin', 'Duvall', 'Leclerc', 'Moreau', 'Pelletier', 'Renaud', 'Arcand', 'Beaumont', 'Chastel', 'Delacroix', 'Estienne', 'Fauconnier', 'Girard', 'Hennequin', 'Jardin', 'Lefort', 'Mercier', 'Noirel', 'Oriel', 'Pontbriand', 'Quintard', 'Rivard', 'Sorel', 'Tremblay', 'Valmont'];
const TAV_ADJ = ['Laughing', 'Drunken', 'Silver', 'Rusty', 'Howling', 'Dancing', 'Bloated', 'Crimson', 'Sleeping', 'Wandering', 'Salty', 'Screaming', 'Golden', 'Tipsy', 'Bearded', 'Merry'];
const TAV_NOUN = ['Unicorn', 'Goat', 'Knight', 'Dragon', 'Mermaid', 'Flagon', 'Barrel', 'Wolf', 'Hound', 'Chicken', 'Rat', 'Kraken', 'Stag', 'Minotaur', 'Harpy', 'Mudcrab'];
const OPEN_HOURS = { tavern: [0, 24], general: [6, 18], weaponsmith: [6, 18], armorer: [6, 18], alchemist: [6, 18], temple: [0, 24], mages: [6, 23], fighters: [6, 23], castle: [6, 20], house: [6, 20], mausoleum: [0, 24], hospice: [0, 24], warehouse: [6, 18] };
const TYPE_LABEL = { tavern: 'Tavern', general: 'General Store', weaponsmith: 'Weaponsmith', armorer: 'Armorer', alchemist: 'Alchemist', temple: 'Temple', mages: 'Guild Hall', fighters: 'Guild Hall', castle: 'Palace', house: 'Residence', mausoleum: 'Mausoleum', hospice: 'Hospice', warehouse: 'Warehouse' };
const LOCKABLE = { house: true, warehouse: true };
function personName(rng, gender) { return rng.pick(gender === 'f' ? FIRST_F : FIRST_M) + ' ' + rng.pick(SURNAMES); }
function isOpen(b, t = G.time) { const [a, z] = OPEN_HOURS[b.type] || [0, 24]; const h = hourOf(t); return h >= a && h < z; }
const capFirst = s => s.charAt(0).toUpperCase() + s.slice(1);

/* ---------------- quarters ---------------- */
const DISTRICTS = [
  { id: 'kingsward', name: 'Kingsward', kind: 'noble', blurb: 'where the nobility keep their manors in the shadow of the castle', seeds: [[-85, -105], [0, -135], [-40, -85], [30, -95]] },
  { id: 'market', name: 'the Market Ward', kind: 'market', blurb: 'crowded timber houses around the Grand Market', seeds: [[0, 12], [-35, -25], [35, -25], [0, 48]] },
  { id: 'temple', name: 'the Temple Quarter', kind: 'temple', blurb: "quiet streets around the Temple of Arkay", seeds: [[-130, -10], [-122, -62], [-125, 40]] },
  { id: 'forges', name: 'the Forges', kind: 'crafts', blurb: 'smithies, workshops and the Fighters Guild', seeds: [[125, -5], [118, -58], [88, 18], [100, -110]] },
  { id: 'docks', name: 'the Docks', kind: 'harbor', blurb: 'warehouses, sailors and the smell of fish', seeds: [[-45, 135], [15, 130], [75, 132]] },
  { id: 'warrens', name: 'the Warrens', kind: 'slum', blurb: 'a maze of shacks where the guard seldom goes', seeds: [[-108, 108], [-150, 78], [-72, 98]] },
  { id: 'tanners', name: "Tanners' Row", kind: 'poor', blurb: 'tanneries, dye-works and the homes of the people who work them', seeds: [[132, 92], [95, 88], [152, 45]] },
];
// district kind → wealth, architecture, spacing, streets
const DK = {
  noble: { wealth: 3, styles: ['stoneLight', 'stoneLight', 'stone', 'plaster', 'brick'], roofs: ['roofSlate'], roofTint: [[0.9, 0.96, 1.1], [0.86, 0.92, 1.04]], hip: 0.6, stories: [2, 2, 3, 3], w: [11, 15], d: [10, 13], set: [1.5, 3.5], gap: [1.5, 4], jit: 0, jetty: 0, plinth: 0.5, clutter: 0.05, fence: 0.8, road1: 'rFlag', road2: 'rFlag', ground: null, b1: [34, 46], b2: [40, 55], b3: null, wander: 0.05, lamp: 20, tree: 0.9, pop: 1 },
  market: { wealth: 2, styles: ['timber', 'timber', 'timber2', 'plaster', 'brick'], roofs: ['roofRed', 'roofRed', 'roofRed', 'roofRed', 'roofBrown', 'roofSlate'], roofTint: [[1.1, 0.96, 0.86], [1.04, 0.93, 0.85], [0.96, 0.9, 0.84]], hip: 0.15, stories: [2, 2, 3, 3], w: [7, 10.5], d: [9, 12], set: [0, 0.4], gap: [0.1, 0.5], jit: 0, jetty: 0.55, plinth: 0.3, clutter: 0.3, fence: 0, road1: 'rCobble', road2: 'rCobble', ground: 'gDirt', b1: [24, 32], b2: [24, 32], b3: [20, 28], wander: 0.1, lamp: 22, tree: 0.05, pop: 3 },
  temple: { wealth: 2, styles: ['stoneLight', 'plaster', 'stone', 'timber2'], roofs: ['roofSlate', 'roofSlate', 'roofRed'], roofTint: [[0.95, 0.97, 1.05], [0.9, 0.93, 1.0]], hip: 0.35, stories: [1, 2, 2], w: [8, 12], d: [8, 11], set: [1, 3], gap: [1.5, 4], jit: 0, jetty: 0.1, plinth: 0.3, clutter: 0.15, fence: 0.3, road1: 'rCobble', road2: 'rGravel', ground: 'gDirt', b1: [28, 36], b2: [26, 34], b3: null, wander: 0.08, lamp: 26, tree: 0.5, pop: 1.5 },
  crafts: { wealth: 1.5, styles: ['brick', 'brick', 'stone', 'timber2'], roofs: ['roofRed'], roofTint: [[0.82, 0.74, 0.68], [0.88, 0.8, 0.72]], hip: 0.15, stories: [1, 2, 2], w: [8, 13], d: [9, 12], set: [0, 1.5], gap: [1, 4], jit: 0, jetty: 0.15, plinth: 0.2, clutter: 0.7, fence: 0, road1: 'rCobble', road2: 'rGravel', ground: 'gDirt', b1: [26, 34], b2: [24, 32], b3: null, wander: 0.1, lamp: 28, tree: 0.1, pop: 1.5 },
  harbor: { wealth: 1, styles: ['timber2', 'wood', 'brick', 'timber'], roofs: ['roofRed'], roofTint: [[0.96, 0.87, 0.8], [1.0, 0.9, 0.82]], hip: 0.08, stories: [1, 2, 2], w: [10, 17], d: [9, 12], set: [0, 1], gap: [0.2, 1.5], jit: 0.02, jetty: 0.2, plinth: 0.1, clutter: 0.8, fence: 0, road1: 'rCobble', road2: 'rGravel', ground: 'gDirt', b1: [26, 34], b2: [24, 32], b3: [20, 28], wander: 0.12, lamp: 26, tree: 0.03, pop: 2 },
  slum: { wealth: 0, styles: ['timber2', 'wood', 'plaster', 'timber2', 'wood'], roofs: ['roofThatch', 'roofThatch', 'roofBrown'], roofTint: [[0.9, 0.85, 0.76], [0.96, 0.9, 0.8]], hip: 0.05, stories: [1, 1, 1, 2], w: [5, 7.5], d: [5, 7.5], set: [0, 1], gap: [0, 1.6], jit: 0.12, jetty: 0, plinth: 0, clutter: 0.6, fence: 0, road1: 'rDirt', road2: 'rMud', ground: 'gDirt', b1: [22, 30], b2: [16, 22], b3: [12, 18], wander: 0.3, lamp: 55, tree: 0.08, pop: 2 },
  poor: { wealth: 0.7, styles: ['timber2', 'timber', 'brick', 'wood'], roofs: ['roofRed', 'roofRed', 'roofThatch'], roofTint: [[1.06, 0.92, 0.74], [1.0, 0.9, 0.76]], hip: 0.1, stories: [1, 1, 2], w: [6, 9], d: [7, 10], set: [0, 1.5], gap: [0.5, 2.5], jit: 0.05, jetty: 0.1, plinth: 0.1, clutter: 0.5, fence: 0, road1: 'rGravel', road2: 'rDirt', ground: 'gDirt', b1: [24, 32], b2: [20, 26], b3: [16, 22], wander: 0.2, lamp: 40, tree: 0.15, pop: 1.5 },
};
// the nearest district seed wins; a wobble keeps the borders from being straight lines
function districtAt(x, z) {
  let best = DISTRICTS[0], bd = 1e9;
  for (let i = 0; i < DISTRICTS.length; i++) {
    const d = DISTRICTS[i]; const wob = 7 * Math.sin(x * 0.043 + i * 1.7) + 7 * Math.sin(z * 0.051 + i * 2.9);
    for (const [sx, sz] of d.seeds) { const dd = Math.hypot(x - sx, z - sz) + wob; if (dd < bd) { bd = dd; best = d; } }
  }
  return best;
}

const CITY_MATS = {
  grass: { tex: 'grass' }, dirt: { tex: 'dirt' }, sand: { tex: 'sand' }, cobble: { tex: 'cobble' }, plaza: { tex: 'plaza' }, flag: { tex: 'flag' },
  water: { tex: 'water' }, stone: { tex: 'stone' }, stoneLight: { tex: 'stoneLight' }, cityWall: { tex: 'cityWall' }, castle: { tex: 'castle' }, brick: { tex: 'brick' },
  timber: { tex: 'timber' }, timber2: { tex: 'timber2' }, plaster: { tex: 'plaster' }, wood: { tex: 'wood' }, woodDark: { tex: 'woodDark' },
  roofRed: { tex: 'roofRed', double: true }, roofSlate: { tex: 'roofSlate', double: true }, roofThatch: { tex: 'roofThatch', double: true },
  door: { tex: 'door' }, doorDark: { tex: 'doorDark' }, doorA: { tex: 'doorA' }, doorB: { tex: 'doorB' }, doorC: { tex: 'doorC' }, doorD: { tex: 'doorD' }, doorE: { tex: 'doorE' }, doorF: { tex: 'doorF' }, doorG: { tex: 'doorG' }, portcullis: { tex: 'portcullis', alpha: true, double: true }, iron: { tex: 'iron' },
  cloth: { tex: 'cloth', double: true }, stallA: { tex: 'stallA', double: true }, stallB: { tex: 'stallB', double: true }, stallC: { tex: 'stallC', double: true },
  banner: { tex: 'banner', double: true }, bannerRed: { tex: 'bannerRed', double: true }, bannerGuild: { tex: 'bannerGuild', double: true }, sail: { tex: 'sail', double: true },
  hedge: { tex: 'hedge' }, rock: { tex: 'rock' }, signLook: { tex: 'signLook', double: true },
  roofCopper: { tex: 'roofCopper', double: true }, roofBlue: { tex: 'roofBlue', double: true }, roofBrown: { tex: 'roofBrown', double: true },
  // the terrain itself
  farRock: { tex: 'scree' }, tGrass: { tex: 'grass' }, tGrassFade: { tex: 'grass', po: 1, transparent: true }, tDirt: { tex: 'yard' }, tSand: { tex: 'sand' }, tRock: { tex: 'cliff' }, tCrag: { tex: 'crag' }, crag: { tex: 'crag' }, farGround: { tex: 'grass' }, tScree: { tex: 'scree' },
  // the generated wild: its horizon mesh and the open sea
  wFar: { tex: 'farNoise' }, wFarO: { tex: 'farNoise' }, wFarR: { tex: 'farNoise', po: 8 }, wFarRO: { tex: 'farNoise', po: 8 }, wFarH: { tex: 'farNoise' }, wSea: { tex: 'water', po: -2 }, boulder: { tex: 'cliff' },
  wScreeO: { tex: 'scree', po: 1, transparent: true }, wEarthO: { tex: 'dirt', po: 1, transparent: true }, wRockO: { tex: 'cliff', po: 2, transparent: true }, wMudO: { tex: 'mud', po: 1, transparent: true }, wStream: { tex: 'water', double: true }, wFoam: { tex: 'farNoise', transparent: true, po: 1 },
  // layers laid over it: polygon offset decides what is drawn on top (overlays < roads < squares)
  gDirt: { tex: 'yard', po: 1 }, gSand: { tex: 'sand', po: 1 }, gGrass: { tex: 'meadow', po: 1 },
  fWheat: { tex: 'wheat', po: 1 }, fBarley: { tex: 'barley', po: 1 }, fPlowed: { tex: 'plowed', po: 1 }, fGreens: { tex: 'greens', po: 1 }, fMeadow: { tex: 'meadow', po: 1 },
  rCobble: { tex: 'cobble', po: 2 }, rFlag: { tex: 'setts', po: 2 }, rGravel: { tex: 'gravel', po: 2 }, rDirt: { tex: 'dirt', po: 2 }, rMud: { tex: 'mud', po: 2 }, rAve: { tex: 'paveLight', po: 2 },
  // soft margins of the unpaved ways, and the kerbs that edge the paved ones
  rGravelF: { tex: 'gravel', po: 2, transparent: true, double: true }, rDirtF: { tex: 'dirt', po: 2, transparent: true, double: true }, rMudF: { tex: 'mud', po: 2, transparent: true, double: true }, kerb: { tex: 'kerb', po: 3 },
  sqPlaza: { tex: 'paveLight', po: 3 }, sqCobble: { tex: 'cobble', po: 3 }, sqFlag: { tex: 'flag', po: 3 },
  sign_tavern: { tex: 'sign_tavern', double: true }, sign_weaponsmith: { tex: 'sign_weaponsmith', double: true }, sign_armorer: { tex: 'sign_armorer', double: true },
  sign_alchemist: { tex: 'sign_alchemist', double: true }, sign_general: { tex: 'sign_general', double: true }, sign_mages: { tex: 'sign_mages', double: true },
  sign_fighters: { tex: 'sign_fighters', double: true }, sign_temple: { tex: 'sign_temple', double: true }, sign_coach: { tex: 'sign_coach', double: true }, sign_hospice: { tex: 'sign_hospice', double: true },
};

/* ---------------- 2D helpers ---------------- */
function pointInPoly(x, z, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins; }
  return ins;
}
function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az; const L2 = dx * dx + dz * dz || 1e-9; const t = clamp(((px - ax) * dx + (pz - az) * dz) / L2, 0, 1);
  const x = ax + dx * t, z = az + dz * t; return { d: Math.hypot(px - x, pz - z), t, x, z };
}
function wallDist(x, z) { let m = 1e9; for (let i = 0; i < WALL_PTS.length - 1; i++) { const a = WALL_PTS[i], b = WALL_PTS[i + 1]; m = Math.min(m, segDist(x, z, a[0], a[1], b[0], b[1]).d); } return m; }
function insideCity(x, z, m = 0) { return z <= SHORE - m && pointInPoly(x, z, WALL_PTS) && wallDist(x, z) >= m; }
// segment intersection: returns [t along AB, u along CD] or null
function segCross(ax, az, bx, bz, cx, cz, dx, dz) {
  const rx = bx - ax, rz = bz - az, sx = dx - cx, sz = dz - cz; const den = rx * sz - rz * sx; if (Math.abs(den) < 1e-9) return null;
  const qx = cx - ax, qz = cz - az; const t = (qx * sz - qz * sx) / den, u = (qx * rz - qz * rx) / den;
  if (t < 1e-6 || t > 1 || u < -1e-6 || u > 1 + 1e-6) return null; return [t, u];
}
// oriented boxes share the frame format of makeXf: local z maps to (s, c), local x to (c, -s)
function mkObb(x, z, ang, hx, hz) { return { x, z, ang, c: Math.cos(ang), s: Math.sin(ang), hx, hz }; }
function obbAabb(o) { const ex = Math.abs(o.c) * o.hx + Math.abs(o.s) * o.hz, ez = Math.abs(o.s) * o.hx + Math.abs(o.c) * o.hz; return [o.x - ex, o.z - ez, o.x + ex, o.z + ez]; }
function obbCorners(o) { return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => xfP(o, a * o.hx, b * o.hz)); }
function obbOverlap(a, b, pad = 0) {
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const [ux, uz] of [[a.c, -a.s], [a.s, a.c], [b.c, -b.s], [b.s, b.c]]) {
    const ra = (a.hx + pad) * Math.abs(a.c * ux - a.s * uz) + (a.hz + pad) * Math.abs(a.s * ux + a.c * uz);
    const rb = b.hx * Math.abs(b.c * ux - b.s * uz) + b.hz * Math.abs(b.s * ux + b.c * uz);
    if (Math.abs(dx * ux + dz * uz) > ra + rb) return false;
  }
  return true;
}
function circleObb(x, z, r, o) { const [lx, lz] = oLocal(o, x, z); const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz); return Math.hypot(lx - qx, lz - qz) < r; }
function segObb(ax, az, bx, bz, hw, cap = 0) { const dx = bx - ax, dz = bz - az; const L = Math.hypot(dx, dz) || 1e-6; return mkObb((ax + bx) / 2, (az + bz) / 2, Math.atan2(dx / L, dz / L), hw, L / 2 + cap); }
class SHash {
  constructor(cs = 16) { this.cs = cs; this.m = new Map(); this.st = 0; this.key = Symbol('q'); }
  add(item, b) { const cs = this.cs; for (let i = Math.floor(b[0] / cs); i <= Math.floor(b[2] / cs); i++) for (let j = Math.floor(b[1] / cs); j <= Math.floor(b[3] / cs); j++) { const k = i * 4099 + j; let l = this.m.get(k); if (!l) this.m.set(k, l = []); l.push(item); } }
  query(x0, z0, x1, z1) {
    const out = []; const st = ++this.st, cs = this.cs, key = this.key;
    for (let i = Math.floor(x0 / cs); i <= Math.floor(x1 / cs); i++) for (let j = Math.floor(z0 / cs); j <= Math.floor(z1 / cs); j++) { const l = this.m.get(i * 4099 + j); if (l) for (const it of l) if (it[key] !== st) { it[key] = st; out.push(it); } }
    return out;
  }
}

/* ---------------- street network ---------------- */
class RoadNet {
  constructor() { this.nodes = []; this.segs = []; this.sg = new SHash(16); this.ng = new SHash(12); }
  addNode(x, z) { const n = { x, z, segs: [], i: this.nodes.length }; this.nodes.push(n); this.ng.add(n, [x, z, x, z]); return n.i; }
  other(s, i) { return s.a === i ? s.b : s.a; }
  adjacent(a, b) { return this.nodes[a].segs.some(s => this.other(s, a) === b); }
  addSeg(a, b, w, lvl, extra = {}) {
    if (a === b || this.adjacent(a, b)) return null;
    const s = { a, b, w, lvl, alive: true, ...extra }; this.segs.push(s); this.nodes[a].segs.push(s); this.nodes[b].segs.push(s); this._grid(s); return s;
  }
  _grid(s) { const A = this.nodes[s.a], B = this.nodes[s.b]; this.sg.add(s, [Math.min(A.x, B.x) - 1, Math.min(A.z, B.z) - 1, Math.max(A.x, B.x) + 1, Math.max(A.z, B.z) + 1]); }
  query(x0, z0, x1, z1) { return this.sg.query(x0, z0, x1, z1).filter(s => s.alive); }
  kill(s) { s.alive = false; for (const i of [s.a, s.b]) { const l = this.nodes[i].segs; const k = l.indexOf(s); if (k >= 0) l.splice(k, 1); } }
  len(s) { const A = this.nodes[s.a], B = this.nodes[s.b]; return Math.hypot(B.x - A.x, B.z - A.z); }
  splitAt(s, x, z) {
    const A = this.nodes[s.a], B = this.nodes[s.b];
    if (Math.hypot(A.x - x, A.z - z) < 2) return s.a; if (Math.hypot(B.x - x, B.z - z) < 2) return s.b;
    const m = this.addNode(x, z); const oldB = s.b;
    const l = this.nodes[oldB].segs; l.splice(l.indexOf(s), 1); s.b = m; this.nodes[m].segs.push(s);
    const { a, b, alive, lvl, w, ...extra } = s; this.addSeg(m, oldB, w, lvl, extra); this._grid(s);
    return m;
  }
  firstHit(ax, az, bx, bz, ex1, ex2 = -1) {
    let best = null;
    for (const s of this.query(Math.min(ax, bx) - 1, Math.min(az, bz) - 1, Math.max(ax, bx) + 1, Math.max(az, bz) + 1)) {
      if (s.a === ex1 || s.b === ex1 || s.a === ex2 || s.b === ex2) continue;
      const A = this.nodes[s.a], B = this.nodes[s.b]; const r = segCross(ax, az, bx, bz, A.x, A.z, B.x, B.z);
      if (r && (!best || r[0] < best.t)) best = { s, t: r[0], x: ax + (bx - ax) * r[0], z: az + (bz - az) * r[0] };
    }
    return best;
  }
  nearestNode(x, z, r, excl) {
    let best = -1, bd = r;
    for (const n of this.ng.query(x - r, z - r, x + r, z + r)) { if (n.i === excl || !n.segs.length) continue; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; best = n.i; } }
    return best;
  }
  nearestSeg(x, z, r, excl) {
    let best = null;
    for (const s of this.query(x - r, z - r, x + r, z + r)) {
      if (s.a === excl || s.b === excl) continue; const A = this.nodes[s.a], B = this.nodes[s.b];
      const q = segDist(x, z, A.x, A.z, B.x, B.z); if (q.d < r && (!best || q.d < best.d)) best = { s, ...q };
    }
    return best;
  }
  segAt(x, z) { let best = null, bd = 0.6; for (const s of this.query(x - 1, z - 1, x + 1, z + 1)) { const A = this.nodes[s.a], B = this.nodes[s.b]; const d = segDist(x, z, A.x, A.z, B.x, B.z).d; if (d < bd) { bd = d; best = s; } } return best; }
  nodeAt(x, z, r) { const n = this.nearestNode(x, z, r, -1); return n >= 0 ? n : this.addNode(x, z); }
  hasDirection(i, ang, tol) { const n = this.nodes[i]; return n.segs.some(s => { const o = this.nodes[this.other(s, i)]; let d = Math.atan2(o.z - n.z, o.x - n.x) - ang; d = Math.atan2(Math.sin(d), Math.cos(d)); return Math.abs(d) < tol; }); }
  // a road that may cross existing roads (creating junctions)
  polyline(pts, w, lvl, extra = {}, start = null) {
    let cur = start ?? this.nodeAt(pts[0][0], pts[0][1], 2);
    for (let i = 1; i < pts.length; i++) {
      const [tx, tz] = pts[i];
      for (let g = 0; g < 24; g++) {
        const A = this.nodes[cur]; const hit = this.firstHit(A.x, A.z, tx, tz, cur); if (!hit) break;
        const m = this.splitAt(hit.s, hit.x, hit.z); if (m === cur) break; this.addSeg(cur, m, w, lvl, extra); cur = m;
      }
      const end = this.nodeAt(tx, tz, 2); if (end !== cur) this.addSeg(cur, end, w, lvl, extra); cur = end;
    }
    return cur;
  }
}

/* ---------------- buildings ---------------- */
// Builds one house in the local frame currently set on gb (gb.xf, whose y is the floor); the front is the local +z ('s') face.
// spec.found: metres of foundation below the floor where the ground falls away; spec.steps: height of the steps down to the street
function makeBuilding(area, gb, rng, spec) {
  const xf = gb.xf; const fp = spec.fp, front = spec.front || 's'; const h = spec.h ?? (spec.stories * 3.2 + 0.3);
  const wallKey = spec.style; const found = spec.found || 0;
  const jet = spec.jetty && h > 5 && front === 's' ? 0.6 : 0;
  const up = jet ? { x0: fp.x0 - 0.15, z0: fp.z0, x1: fp.x1 + 0.15, z1: fp.z1 + jet } : fp; // upper floors overhang the street
  if (found > 0.05) gb.box(fp.x0 - 0.12, -found - 0.4, fp.z0 - 0.12, fp.x1 + 0.12, spec.plinth ? 0.02 : 0.08, fp.z1 + 0.12, { side: spec.foundKey || 'stone', top: null }, 4, 4);
  if (spec.plinth) gb.box(fp.x0 - 0.08, 0, fp.z0 - 0.08, fp.x1 + 0.08, 1.0, fp.z1 + 0.08, { side: 'stone', top: 'stone' }, 4, 4);
  const y0 = spec.plinth ? 1.0 : 0;
  if (jet) {
    gb.box(fp.x0, y0, fp.z0, fp.x1, 3.2, fp.z1, { side: wallKey, top: null }, 3.2, 3.2);
    gb.box(up.x0, 3.2, up.z0, up.x1, h, up.z1, { side: wallKey, top: null, bottom: 'woodDark' }, 3.2, 3.2);
    gb.box(up.x0 - 0.05, 3.02, up.z1 - 0.25, up.x1 + 0.05, 3.3, up.z1 + 0.06, 'woodDark', 1, 1);
  } else gb.box(fp.x0, y0, fp.z0, fp.x1, h, fp.z1, { side: wallKey, top: spec.roof === 'flat' ? 'stone' : null }, 3.2, 3.2);
  const w = up.x1 - up.x0, d = up.z1 - up.z0; let roofTop = h, rh = 0; const alongX = spec.alongX ?? (front === 'n' || front === 's');
  gb.tint = spec.roofTint || null;
  if (spec.roof === 'gable') {
    const half = alongX ? d / 2 : w / 2; rh = half * (spec.pitch ?? rng.range(0.7, 1.0));
    gb.tint = null; // the gable ends are wall, not roof
    gableRoofTinted(gb, spec.roofKey, wallKey, up.x0, up.z0, up.x1, up.z1, h, rh, 0.5, alongX, spec.roofTint); roofTop = h + rh;
  } else if (spec.roof === 'hip') {
    rh = Math.min(w, d) / 2 * (spec.pitch ?? rng.range(0.7, 1.0)); hipRoof(gb, spec.roofKey, up.x0, up.z0, up.x1, up.z1, h, rh, 0.5); roofTop = h + rh;
  } else {
    for (let x = fp.x0; x < fp.x1 - 0.6; x += 1.6) { gb.box(x, h, fp.z0, x + 0.8, h + 0.9, fp.z0 + 0.5, 'stone', 4, 4); gb.box(x, h, fp.z1 - 0.5, x + 0.8, h + 0.9, fp.z1, 'stone', 4, 4); }
    for (let z = fp.z0 + 1.6; z < fp.z1 - 0.6; z += 1.6) { gb.box(fp.x0, h, z, fp.x0 + 0.5, h + 0.9, z + 0.8, 'stone', 4, 4); gb.box(fp.x1 - 0.5, h, z, fp.x1, h + 0.9, z + 0.8, 'stone', 4, 4); }
  }
  gb.tint = null;
  let chimney = null;
  if (spec.roof !== 'flat' && rng.chance(spec.chimney ?? 0.45)) {
    const cx = lerp(up.x0 + 1, up.x1 - 1, rng.next()), cz = lerp(up.z0 + 1, up.z1 - 1, rng.next());
    gb.box(cx - 0.4, h, cz - 0.4, cx + 0.4, roofTop + 0.6, cz + 0.4, { side: 'stone', top: 'iron' }, 4, 4);
    const [wx, wz] = xfP(xf, cx, cz); chimney = [wx, (xf ? xf.y : 0) + roofTop + 0.8, wz];
    if (!spec.noCollider) addOCol(area, xf, cx - 0.4, cz - 0.4, cx + 0.4, cz + 0.4, h, roofTop + 0.6);
  }
  // door with frame
  const fi = faceInfo(fp, front);
  const dt = clamp(fi.len * (spec.doorT ?? rng.range(0.3, 0.7)), 1.5, fi.len - 1.5);
  const dw = spec.doorW ?? 1.4, dh = spec.doorH ?? 2.5;
  // the doorway: jambs and a lintel stand proud of the wall so the door sits back in a reveal, over a stone doorstep
  const masonry = /stone|brick|plaster|castle/.test(wallKey), frameKey = spec.frameKey || (masonry ? 'stoneLight' : 'woodDark'), jw = masonry ? 0.24 : 0.16, pd = 0.17, sill = 0.16;
  const fbox = (t0, t1, y0, y1, o0, o1, k) => { const a = facePoint(fi, t0, o0), b = facePoint(fi, t1, o1); gb.box(Math.min(a[0], b[0]), y0, Math.min(a[2], b[2]), Math.max(a[0], b[0]), y1, Math.max(a[2], b[2]), k, 1, 1, { skip: 'b' }); };
  fbox(dt - dw / 2 - jw, dt - dw / 2, sill, dh, 0, pd, frameKey); fbox(dt + dw / 2, dt + dw / 2 + jw, sill, dh, 0, pd, frameKey);
  fbox(dt - dw / 2 - jw - (masonry ? 0.1 : 0.06), dt + dw / 2 + jw + (masonry ? 0.1 : 0.06), dh, dh + (masonry ? 0.34 : 0.22), 0, pd + 0.03, frameKey);
  if (masonry && rng.chance(0.5)) fbox(dt - 0.16, dt + 0.16, dh - 0.02, dh + 0.4, 0, pd + 0.06, frameKey); // a keystone
  const doors = spec.wealth >= 2.5 ? ['doorF', 'doorC', 'doorD', 'doorE', 'doorA'] : spec.wealth <= 0.7 ? ['doorB', 'doorA', 'doorG', 'doorB'] : masonry ? ['doorA', 'doorF', 'doorD', 'doorC', 'doorG'] : ['doorA', 'doorG', 'doorB', 'doorC', 'door'];
  faceQuad(gb, spec.doorKey || rng.pick(doors), fi, dt - dw / 2, sill, dw, dh - sill, spec.plinth ? 0.1 : 0.03);
  { const a = facePoint(fi, dt - dw / 2 - jw - 0.12, 0), b = facePoint(fi, dt + dw / 2 + jw + 0.12, 0.62); // the doorstep, worn in the middle
    gb.box(Math.min(a[0], b[0]), -0.45, Math.min(a[2], b[2]), Math.max(a[0], b[0]), sill, Math.max(a[2], b[2]), { side: 'stone', top: spec.wealth <= 0.7 ? 'woodDark' : 'stoneLight' }, 1.2, 1.2);
    if (!spec.noCollider) addOCol(area, xf, Math.min(a[0], b[0]), Math.min(a[2], b[2]), Math.max(a[0], b[0]), Math.max(a[2], b[2]), -0.5, sill); }
  // a little pent roof over the door of many timber and plaster houses
  if (!masonry && !jet && spec.roof !== 'flat' && dh < 3 && rng.chance(spec.hood ?? 0.4)) {
    const y = dh + 0.55, hw = dw / 2 + jw + 0.35, out = 0.85;
    for (const t of [dt - hw + 0.1, dt + hw - 0.16]) fbox(t, t + 0.06 + 0.06, y - 0.55, y - 0.4, 0, out - 0.1, 'woodDark');
    const p0 = facePoint(fi, dt - hw, 0.02), p1 = facePoint(fi, dt + hw, 0.02), p2 = facePoint(fi, dt + hw, out), p3 = facePoint(fi, dt - hw, out);
    gb.quad4(spec.roofKey || 'roofRed', [p0[0], y, p0[2]], [p1[0], y, p1[2]], [p2[0], y - 0.38, p2[2]], [p3[0], y - 0.38, p3[2]], [0, 0], [hw * 2 / 3, 0], [hw * 2 / 3, 0.35], [0, 0.35], [fi.n[0], 1.5, fi.n[2]]);
  }
  // steps down to the street when the house stands above it, measured where the door actually is
  if (front === 's' && spec.steps != null && xf) { const [qx, qz] = xfP(xf, fp.x0 + dt, fp.z1 + 1.2); spec.steps = Math.max(spec.steps, xf.y - terrainH(qx, qz)); }
  if (front === 's' && (spec.steps || 0) > 0.2) {
    const st = spec.steps, n = Math.ceil(st / 0.24), rise = st / n; const dx = fp.x0 + dt, sx0 = dx - dw / 2 - 0.3, sx1 = dx + dw / 2 + 0.3, z1 = fp.z1 + 0.62;
    for (let k = 0; k < n; k++) {
      const top = -k * rise, depth = 0.4 + 0.32 * k;
      gb.box(sx0, -st - 0.3, z1, sx1, top, z1 + depth, { side: 'stone', top: 'stone' }, 2, 2, { skip: 'n' });
      addOCol(area, xf, sx0, z1 + depth - 0.32, sx1, z1 + depth, -st - 0.3, top);
    }
  }
  // windows (upper floors sit on the overhang when there is one)
  const stories = Math.max(1, Math.floor((h - 0.3) / 3.2));
  for (const f of ['n', 's', 'e', 'w']) {
    for (let s = 0; s < stories; s++) {
      const fw = faceInfo(s === 0 ? fp : up, f); const n = Math.max(1, Math.floor(fw.len / 2.9));
      const y = s * 3.2 + (spec.plinth && s === 0 ? 1.35 : 1.15);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) * fw.len / n;
        if (s === 0 && f === front && Math.abs(t - dt) < dw / 2 + 0.9) continue;
        if (spec.noWin && spec.noWin(f, t, s)) continue;
        if (spec.winRate != null && !rng.chance(spec.winRate)) continue;
        faceQuad(gb, rng.chance(0.72) ? 'winA' : 'winB', fw, t - 0.45, y, 0.9, 1.2, 0.03);
      }
    }
  }
  if (spec.sign) {
    const st = dt + (dt < fi.len / 2 ? dw / 2 + 1.0 : -dw / 2 - 1.0); const sp = facePoint(fi, st, 0);
    gb.quad('sign_' + spec.sign, [sp[0] + fi.n[0] * 0.25, 2.9, sp[2] + fi.n[2] * 0.25], fi.n, [0, 1, 0], 0.95, 0.95, 1, 1, { fixedUV: true });
    const b0 = facePoint(fi, st - 0.05, 0), b1 = facePoint(fi, st + 0.05, 1.3);
    gb.box(Math.min(b0[0], b1[0]), 3.9, Math.min(b0[2], b1[2]), Math.max(b0[0], b1[0]), 3.98, Math.max(b0[2], b1[2]), 'iron', 1, 1);
  }
  // colliders end where the building does: walls to the eaves, then the roof in steps
  if (!spec.noCollider) {
    addOCol(area, xf, fp.x0, fp.z0, fp.x1, fp.z1, -found - 1, h);
    if (jet) addOCol(area, xf, up.x0, up.z0, up.x1, up.z1, 3.2, h);
    if (spec.roof === 'flat') {
      addOCol(area, xf, fp.x0, fp.z0, fp.x1, fp.z0 + 0.5, h, h + 0.9); addOCol(area, xf, fp.x0, fp.z1 - 0.5, fp.x1, fp.z1, h, h + 0.9);
      addOCol(area, xf, fp.x0, fp.z0, fp.x0 + 0.5, fp.z1, h, h + 0.9); addOCol(area, xf, fp.x1 - 0.5, fp.z0, fp.x1, fp.z1, h, h + 0.9);
    } else {
      const cx = (up.x0 + up.x1) / 2, cz = (up.z0 + up.z1) / 2;
      for (let k = 0; k < 3; k++) {
        const f = 1 - k / 3; let hx = w / 2 + 0.3, hz = d / 2 + 0.3;
        if (spec.roof === 'hip') { hx *= f; hz *= f; } else if (alongX) hz *= f; else hx *= f;
        addOCol(area, xf, cx - hx, cz - hz, cx + hx, cz + hz, h + rh * k / 3, h + rh * (k + 1) / 3);
      }
    }
  }
  const dp = facePoint(fi, dt, 0.2); const [wx, wz] = xfP(xf, dp[0], dp[2]); const [nx, nz] = xfN(xf, fi.n[0], fi.n[2]);
  return { x: wx, z: wz, y: xf ? xf.y : 0, nx, nz, t: dt, fi, lx: dp[0], lz: dp[2], dw, chimney, roofTop };
}
// a gable roof whose slopes take a tint (the gable-end walls stay untinted)
function gableRoofTinted(gb, key, wallKey, x0, z0, x1, z1, h, rh, ov, alongX, tint) {
  const t0 = gb.tint; const g = gb.g; const before = new Map([...g].map(([k, v]) => [k, v.c.length]));
  gableRoof(gb, key, wallKey, x0, z0, x1, z1, h, rh, ov, alongX);
  if (tint) { const grp = g.get(key); const from = before.get(key) || 0; for (let i = from; i < grp.c.length; i += 3) { grp.c[i] *= tint[0]; grp.c[i + 1] *= tint[1]; grp.c[i + 2] *= tint[2]; } }
  gb.tint = t0;
}
function footprintPoly(xf, fp) { return [[fp.x0, fp.z0], [fp.x1, fp.z0], [fp.x1, fp.z1], [fp.x0, fp.z1]].map(([x, z]) => xfP(xf, x, z)); }

function registerBuilding(area, rec) {
  rec.id = rec.id || ('b' + G.buildings.length);
  G.buildings.push(rec);
  area.doors.push({ x: rec.door.x, z: rec.door.z, y: rec.door.y ?? 0, nx: rec.door.nx, nz: rec.door.nz, building: rec });
  return rec;
}
// clothing follows the wealth of the quarter
function lookByWealth(rng, g, wealth = 1.5) {
  const o = randomLook(rng, g);
  if (wealth >= 3) {
    o.shirt = rng.pick(['#7a1c3a', '#1c3a7a', '#2a6a4a', '#6a2a7a', '#8a6a1c']); o.apron = null; o.hood = null;
    if (rng.chance(0.6)) o.cape = rng.pick(['#5a1020', '#1a2a5a', '#2a4a2a', '#3a1a4a']);
    if (g === 'f' && rng.chance(0.7)) { o.robe = rng.pick(['#8a2a4a', '#3a3a8a', '#2a6a5a', '#7a5a1a']); o.trim = '#c8a040'; }
    if (rng.chance(0.3)) o.hat = rng.pick(['#5a1020', '#1a2a5a', '#2a2a2a']);
  } else if (wealth <= 0.7) {
    const drab = ['#5a4a3a', '#4a4238', '#5e5446', '#3e3a32', '#6a5a44', '#4a4a3e'];
    o.shirt = rng.pick(drab); o.pants = rng.pick(drab); if (o.robe) o.robe = rng.pick(drab); o.cape = null; o.hat = null;
    if (rng.chance(0.25)) o.hood = rng.pick(drab);
  }
  return o;
}
function makeOwner(rng, type, wealth = 1.5) {
  const gender = rng.chance(0.5) ? 'f' : 'm'; const look = lookByWealth(rng, gender, type === 'house' ? wealth : Math.max(1.2, wealth));
  if (type === 'weaponsmith' || type === 'armorer') { look.apron = '#5a3a24'; look.shirt = '#6a5a4a'; look.cape = null; look.robe = null; }
  if (type === 'alchemist') { look.robe = rng.pick(['#3a5a3a', '#4a3a5a']); }
  if (type === 'tavern') { look.apron = '#d8d0b8'; look.cape = null; }
  if (type === 'warehouse') { look.apron = '#8a7a60'; look.cape = null; }
  return { name: personName(rng, gender), gender, look };
}
function buildingName(rng, type, owner, wealth = 1.5) {
  const sur = owner.name.split(' ')[1];
  switch (type) {
    case 'tavern': return `The ${rng.pick(TAV_ADJ)} ${rng.pick(TAV_NOUN)}`;
    case 'general': return rng.pick([`${sur}'s General Store`, 'Iliac Bay Provisions', `The ${rng.pick(['Honest', 'Thrifty', 'Wandering'])} Merchant`]);
    case 'weaponsmith': return rng.pick([`${sur}'s Smithy`, 'The Iron Anvil', 'The Keen Edge', 'The Red Forge']);
    case 'armorer': return rng.pick([`${sur}'s Armory`, 'The Steel Bulwark', 'The Dented Shield', 'The Riveted Hauberk']);
    case 'alchemist': return rng.pick([`The ${rng.pick(['Bubbling', 'Green', 'Smoking'])} Cauldron`, `${sur}'s Apothecary`]);
    case 'warehouse': return rng.pick([`${sur} Warehouse`, `${sur} & Sons Storehouse`, `The ${sur} Trading Company`]);
    default:
      if (wealth >= 3) return rng.pick([`${sur} Manor`, `House ${sur}`, `The ${sur} Townhouse`]);
      if (wealth <= 0) return rng.pick([`${sur}'s Shack`, `${sur} Hovel`, `${sur}'s Lodgings`]);
      if (wealth < 1) return rng.pick([`${sur} Cottage`, `${sur} Residence`]);
      return `${sur} Residence`;
  }
}

/* ---------------- the city ---------------- */
// road chains: runs of segments through plain two-way nodes, so lots can follow a curving street
function roadChains(net, roads) {
  const used = new Set(), chains = [];
  const plain = n => net.nodes[n].segs.filter(q => !q.square).length === 2;
  for (const s of roads) {
    if (s.square || used.has(s)) continue;
    used.add(s); const pts = [s.a, s.b];
    for (const tail of [true, false]) {
      for (let g = 0; g < 200; g++) {
        const n = tail ? pts[pts.length - 1] : pts[0]; if (!plain(n)) break;
        const nx = net.nodes[n].segs.find(q => !q.square && !used.has(q) && q.lvl === s.lvl && Math.abs(q.w - s.w) < 0.01); if (!nx) break;
        used.add(nx); const o = net.other(nx, n); if (tail) pts.push(o); else pts.unshift(o);
      }
    }
    const P = pts.map(i => net.nodes[i]); let len = 0; for (let i = 1; i < P.length; i++) len += Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z);
    chains.push({ P, ends: [pts[0], pts[pts.length - 1]], w: s.w, lvl: s.lvl, quay: !!s.quay, mat: s.mat, len });
  }
  return chains;
}
function chainAt(ch, t) {
  const P = ch.P; t = clamp(t, 0, ch.len);
  for (let i = 1; i < P.length; i++) {
    const L = Math.hypot(P[i].x - P[i - 1].x, P[i].z - P[i - 1].z) || 1e-6;
    if (t <= L || i === P.length - 1) { const k = Math.min(1, t / L); return { x: P[i - 1].x + (P[i].x - P[i - 1].x) * k, z: P[i - 1].z + (P[i].z - P[i - 1].z) * k, ux: (P[i].x - P[i - 1].x) / L, uz: (P[i].z - P[i - 1].z) / L }; }
    t -= L;
  }
}

function buildCity() {
  planLand(); // the rivers of the whole country, and the valleys they cut, before any ground is laid
  const area = newArea('city'); G.city = area; area.floorY = 0; area.name = 'Daggerfall'; area.heightAt = terrainH;
  const rng = new RNG(40521);
  const gb = new GB();
  const mats = worldMats(area, CITY_MATS);
  // the sea keeps some colour to the horizon: it hazes over more slowly than the land
  mats.wSea.onBeforeCompile = mats.water.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * vec3(0.9, 0.9, 1.0), smoothstep(60.0, 800.0, vFogDepth) * 0.55);\n float fogFactor = smoothstep(fogNear, fogFar, vFogDepth * 0.55);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * vec3(0.84, 0.9, 0.96), fogFactor);\n#endif'); };
  const winA = new THREE.MeshBasicMaterial({ map: TEX.winDay, vertexColors: true });
  const winB = new THREE.MeshBasicMaterial({ map: TEX.winDay, vertexColors: true });
  const lantern = new THREE.MeshBasicMaterial({ map: TEX.lantern, vertexColors: true });
  mats.winA = winA; mats.winB = winB; mats.lantern = lantern;
  area.special = { winA, winB, lantern };
  G.buildings = []; area.doors = []; area.bbs = []; area.districtAt = districtAt; area.districts = DISTRICTS;
  const trees = { oak: [], pine: [], dead: [], cypress: [], bush: [], grove: [] }, flowers = [], tufts = [], hay = [], glows = [], dummies = [], chimneys = [];
  const H = (x, z) => terrainH(x, z);
  const col = (x0, z0, x1, z1, y0, y1) => addOCol(area, gb.xf, x0, z0, x1, z1, y0, y1); // heights relative to the frame
  const wp = (x, z) => xfP(gb.xf, x, z);
  const gy = (lx, lz) => { const p = wp(lx, lz); return H(p[0], p[1]) - (gb.xf ? gb.xf.y : 0); }; // local ground height under the frame
  const TREE_H = { oak: 9, pine: 11, dead: 8, cypress: 6.5, grove: 8 };
  const tree = (kind, x, z, s = 1) => { const y = H(x, z); trees[kind].push([x, y - 0.15, z, s]); if (kind !== 'bush') addCol(area, x - 0.35, z - 0.35, x + 0.35, z + 0.35, y - 1, y + TREE_H[kind] * s); };
  const flower = (x, z, s = 1) => flowers.push([x, H(x, z), z, s]);
  const bldHash = new SHash(16), roadHash = new SHash(16);
  const clearOf = (x, z, r, roads = true) => {
    for (const b of bldHash.query(x - r, z - r, x + r, z + r)) if (circleObb(x, z, r, b.o)) return false;
    if (roads) for (const s of roadHash.query(x - r, z - r, x + r, z + r)) if (circleObb(x, z, r, s.o)) return false;
    return true;
  };
  const block = (o) => { const it = { o }; bldHash.add(it, obbAabb(o)); }; // reserve space for later placement tests
  const circlePts = (cx, cz, r, n, jit = 0) => { const p = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; const rr = r + (jit ? rng.range(-jit, jit) : 0); p.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); } return p; };

  /* ---------- reserved places (landmarks, squares) and the level plots they stand on ---------- */
  const zones = [];
  const zoneC = (x, z, r, road) => zones.push({ x, z, r, road });
  const zoneO = (o, road) => zones.push({ o, road });
  const zoneHit = (x, z, r, blockingOnly) => zones.some(q => (!blockingOnly || !q.road) && (q.o ? circleObb(x, z, r, q.o) : Math.hypot(x - q.x, z - q.z) < q.r + r));
  const zoneObb = (o) => zones.some(q => q.o ? obbOverlap(o, q.o) : circleObb(q.x, q.z, q.r, o));
  const pads = [];
  const padC = (x, z, r, blend = 10, h = null) => { const p = { x, z, r, blend, h: h ?? terrainRaw(x, z) }; pads.push(p); return p; };
  const padO = (o, blend = 10, h = null) => { const p = { o, blend, h: h ?? terrainRaw(o.x, o.z) }; pads.push(p); return p; };
  const TEMPLE = { x: -120, z: 36, ang: Math.PI }, GRAVE = { x0: -152, z0: 56, x1: -104, z1: 96 };
  const HOSPICE = { x: -55, z: 50, ang: 0 }, MAGES = { x: 72, z: -100, ang: 0 }, FIGHTERS = { x: 128, z: 30, ang: Math.PI };
  const BELL = [62, 62], GARDEN = [-70, -100], WELL = [-100, 112], FISH = [-50, 128];
  const PIERS = [-85, -20, 45], BREAK = 125, WMOLE = -128, PIER_END = 196;
  const quayPad = padO(mkObb(0, SHORE - 8, 0, 162, 8), 18, QUAY_H);
  const castlePad = padO(mkObb(0, CASTLE_Z - 71, 0, 35, 34), 22); const forePad = padC(0, CASTLE_Z - 30, 11, 6, castlePad.h);
  const marketPad = padC(MARKET[0], MARKET[1], 27, 14), memPad = padC(MEMORIAL[0], MEMORIAL[1], 14, 10);
  const templePad = padO(mkObb(-120, 29, 0, 13, 23), 10);
  const mausPad = padC(-143.5, 86.5, 7, 6);
  const hospPad = padO(mkObb(HOSPICE.x, HOSPICE.z + 2, 0, 13, 10), 8), magesPad = padO(mkObb(MAGES.x, MAGES.z - 2, 0, 14, 13), 8);
  const fightPad = padO(mkObb(FIGHTERS.x, FIGHTERS.z + 9, 0, 13, 18), 8), bellPad = padC(BELL[0], BELL[1], 11, 8), gardenPad = padC(GARDEN[0], GARDEN[1], 23, 10);
  const wellPad = padC(WELL[0], WELL[1], 8, 7), fishPad = padC(FISH[0], FISH[1], 9, 7, QUAY_H + 0.2);
  zoneO(mkObb(0, CASTLE_Z - 71, 0, 52, 41), false);             // the castle, its scarp and a narrow glacis round it
  zoneC(0, CASTLE_Z - 30, 11, true);                              // its forecourt
  zoneO(mkObb((RAMP.x0 + RAMP.xw) / 2, (RAMP.z1 + RAMP.z2 - 6) / 2, 0, (RAMP.x0 - RAMP.xw) / 2 + 6, (RAMP.z1 - RAMP.z2 + 6) / 2 + 2), false); // the switchback ramp
  zoneC(MARKET[0], MARKET[1], 25, true); zoneC(MEMORIAL[0], MEMORIAL[1], 13, true);
  zoneO(mkObb(TEMPLE.x, TEMPLE.z, TEMPLE.ang, 11, 14), false); zoneC(-120, 14, 10, true);
  zoneO(mkObb((GRAVE.x0 + GRAVE.x1) / 2, (GRAVE.z0 + GRAVE.z1) / 2, 0, (GRAVE.x1 - GRAVE.x0) / 2 + 1, (GRAVE.z1 - GRAVE.z0) / 2 + 1), false);
  zoneO(mkObb(HOSPICE.x, HOSPICE.z, 0, 13, 8), false);
  zoneO(mkObb(MAGES.x, MAGES.z - 2, 0, 13, 11), false);
  zoneO(mkObb(FIGHTERS.x, FIGHTERS.z + 9, 0, 13, 17), false);
  zoneC(BELL[0], BELL[1], 12, true); zoneC(GARDEN[0], GARDEN[1], 23, false);
  zoneC(WELL[0], WELL[1], 9, true); zoneC(FISH[0], FISH[1], 9, true);
  // wall segments and gates
  const wallSeg = i => {
    const a = WALL_PTS[i], b = WALL_PTS[i + 1]; const dx = b[0] - a[0], dz = b[1] - a[1]; const len = Math.hypot(dx, dz); const ux = dx / len, uz = dz / len;
    let nx = -uz, nz = ux; const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2; if (nx * -mx + nz * -mz < 0) { nx = -nx; nz = -nz; }
    return { a, b, len, ux, uz, nx, nz };
  };
  for (const g of GATES) {
    const S = wallSeg(g.seg); g.tg = S.len * g.t; g.x = S.a[0] + S.ux * g.tg; g.z = S.a[1] + S.uz * g.tg; g.nx = S.nx; g.nz = S.nz;
    g.inner = [g.x + S.nx * 8, g.z + S.nz * 8]; g.outer = [g.x - S.nx * 9, g.z - S.nz * 9];
    zoneC(g.inner[0], g.inner[1], 11, true);
    g.pad = padC(g.x, g.z, 10, 10);
  }
  area.gates = GATES;
  // farmsteads out in the country: the gentlest ground among a few candidate sites
  const farmSites = [];
  { const fr = new RNG(99);
    const cands = [[-232, -38], [-246, 74], [-196, -158], [-48, -246], [-120, -292], [252, -34], [246, 84], [306, 20], [-300, -40], [-290, 110], [-20, -310], [300, 118]];
    for (const [x, z] of cands) {
      const hs = []; for (const [dx, dz] of [[-16, -16], [16, -16], [16, 16], [-16, 16], [0, 0]]) hs.push(terrainRaw(x + dx, z + dz));
      if (Math.max(...hs) - Math.min(...hs) > 6.5 || Math.min(...hs) < 2 || wallDist(x, z) < 50) continue;
      farmSites.push({ x, z, ang: fr.range(-0.6, 0.6) + (z > 0 ? Math.PI : 0), seed: fr.int(1, 1e9) });
      if (farmSites.length >= 8) break;
    }
    for (const F of farmSites) F.pad = padO(mkObb(F.x, F.z, F.ang, 13, 16), 10);
  }
  const lookPad = padC(RISE_LOOK[0], RISE_LOOK[1], 3.2, 3);

  /* ---------- the land ---------- */
  bakeTerrain(pads);
  // the castle rock: the knoll breaks off in a sheer scarp under the west, east and north curtains (the south stays open for the ramp)
  shapeTerrain(-60, CASTLE_Z - 136, 60, CASTLE_Z - 20, (x, z, h) => {
    const lz = z - CASTLE_Z, qx = Math.max(0, Math.abs(x) - 32), qz = Math.max(0, -110 - lz, lz + 40), d = Math.hypot(qx, qz);
    const m = smoothstep(-28, -46, lz), F = 28; if (d < 1.5 || d > F || m <= 0) return h;
    const ux = Math.sign(x) * qx / d, uz = (lz < -75 ? -1 : 1) * qz / d, foot = Math.min(h, terrainH(x + ux * (F - d), z + uz * (F - d)));
    const n = 2.5 * fbm(x / 17, z / 17, 2, 77);                      // the brink wanders a little in and out
    const e = 11 + n, B = foot + 2.5;                                   // a sheer face down to B, then a gentle apron out to the natural foot
    const v = d < e ? lerp(castlePad.h + 0.5, B, smoothstep(1.5 + n, e, d)) : lerp(B, foot, (d - e) / (F - e));
    return Math.min(h, lerp(h, v, m));
  });
  carveTerrain(-46, CASTLE_Z - 128, 46, CASTLE_Z - 117, (x, z) => terrainH(x, z) - 4.5 * smoothstep(46, 30, Math.abs(x)) * (1 - Math.abs(z - (CASTLE_Z - 122.5)) / 7)); // the dry ditch outside the north curtain

  /* ---------- street network ---------- */
  const net = new RoadNet();
  const cityBlock = (x, z) => !insideCity(x, z, 6) || zoneHit(x, z, 2.5, true);
  const routed = (from, to, grade = 0.075) => { const p = routeTerrain(from, to, { grade, block: cityBlock }); return p ? simplifyPath(p, 2.5) : [from, to]; };
  // ring lanes around the market fountain and the memorial
  const ringOf = (cx, cz, r, n, w) => { const ids = circlePts(cx, cz, r, n).map(([x, z]) => net.addNode(x, z)); for (let i = 0; i < n; i++) net.addSeg(ids[i], ids[(i + 1) % n], w, 0, { square: true }); return ids; };
  const mRing = ringOf(MARKET[0], MARKET[1], 16, 10, 7), memRing = ringOf(MEMORIAL[0], MEMORIAL[1], 9, 8, 6);
  const nearestOf = (ids, x, z) => { let bi = ids[0], bd = 1e9; for (const i of ids) { const n = net.nodes[i]; const d = Math.hypot(n.x - x, n.z - z); if (d < bd) { bd = d; bi = i; } } return bi; };
  const avenue = (ids, target, grade = 0.075) => { const s = nearestOf(ids, target[0], target[1]); const n = net.nodes[s]; net.polyline(routed([n.x, n.z], target, grade), 9, 0, { avenue: true }, s); };
  net.polyline([[-156, SHORE - 5], [-80, SHORE - 5.4], [0, SHORE - 4.8], [80, SHORE - 5.3], [156, SHORE - 5]], 8, 0, { quay: true });
  for (const g of GATES) avenue(mRing, g.inner);
  avenue(mRing, [0, SHORE - 5], 0.07);
  { const s = nearestOf(mRing, 0, -10), m = nearestOf(memRing, 0, -40); const A = net.nodes[s], B = net.nodes[m]; net.polyline(routed([A.x, A.z], [B.x, B.z]), 9, 0, { avenue: true }, s); }
  { const s = nearestOf(memRing, 0, -62); const A = net.nodes[s]; net.polyline(routed([A.x, A.z], [RAMP.x0 + 5, RAMP.z1], 0.09), 9, 0, { avenue: true }, s); } // to the foot of the castle ramp
  // the ring road, routed along the slope between points on an ellipse
  { const way = []; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; way.push([Math.cos(a) * (105 + rng.range(-5, 5)), 8 + Math.sin(a) * (80 + rng.range(-5, 5))]); }
    for (let i = 0; i < 12; i++) { const a = way[i], b = way[(i + 1) % 12]; if (cityBlock(a[0], a[1]) || cityBlock(b[0], b[1])) continue; net.polyline(routed(a, b, 0.08), 6.5, 0, { ringRoad: true }); } }
  // short roads that tie each landmark's door into the network
  const spur = (x, z, w = 5) => {
    const s0 = net.addNode(x, z); let best = null;
    for (const s of net.segs) { if (!s.alive) continue; const A = net.nodes[s.a], B = net.nodes[s.b]; const q = segDist(x, z, A.x, A.z, B.x, B.z); if (!best || q.d < best.d) best = { s, ...q }; }
    const hit = net.firstHit(x, z, best.x, best.z, s0);
    const m = hit ? net.splitAt(hit.s, hit.x, hit.z) : net.splitAt(best.s, best.x, best.z); net.addSeg(s0, m, w, 1, { keep: true });
    return s0;
  };
  spur(TEMPLE.x, TEMPLE.z - 16); spur(HOSPICE.x, HOSPICE.z + 9.5); spur(MAGES.x, MAGES.z + 10); spur(FIGHTERS.x, FIGHTERS.z - 10);
  spur(GRAVE.x1 + 2.5, 76.5, 5); spur(GARDEN[0] + 25, GARDEN[1], 5); spur(GARDEN[0], GARDEN[1] + 25, 5); spur(WELL[0], WELL[1], 5); spur(FISH[0], FISH[1], 5);

  { // the wall lane: 13 m inside the walls, broken where landmarks stand
    const inner = []; for (let i = 0; i < WALL_PTS.length; i++) { const [x, z] = WALL_PTS[i]; let nx = -x, nz = -z + 30; const l = Math.hypot(nx, nz) || 1; inner.push([x + nx / l * 14, Math.min(SHORE - 20, z + nz / l * 14)]); }
    const pts = resamplePath(inner, 6); let run = [];
    const flush = () => { if (run.length > 5) net.polyline(simplifyPath(run, 1.5), 3.8, 2, { wallLane: true }); run = []; };
    for (const [x, z] of pts) { if (insideCity(x, z, 8) && !zoneHit(x, z, 4, true) && z < SHORE - 25) run.push([x, z]); else flush(); }
    flush();
  }
  // organic growth: streets off the avenues, lanes off the streets, alleys in the poorer quarters.
  // Each step picks the heading that keeps the street at a walkable grade, so streets bend along the slope.
  const LV = {
    1: K => ({ w: K === DK.noble ? 6 : K === DK.slum ? 4 : 5, step: 12, maxLen: rng.range(70, 160), wander: K.wander, snap: 7, sep: 11, gmax: 0.09 }),
    2: K => ({ w: K === DK.noble ? 4.6 : K === DK.slum ? 3 : 3.8, step: 10, maxLen: rng.range(25, 70), wander: K.wander * 1.4, snap: 6, sep: 11, gmax: 0.13 }),
    3: K => ({ w: 2.6, step: 8, maxLen: rng.range(12, 34), wander: K.wander * 1.8, snap: 5, sep: 8.5, gmax: 0.2 }),
  };
  const grow = (start, a, lvl, P) => {
    let cur = start, len = 0;
    const within = (x, z) => insideCity(x, z, 7) && !zoneHit(x, z, P.w / 2 + 1.5, true);
    for (let k = 0; k < 40 && len < P.maxLen; k++) {
      const A = net.nodes[cur]; const step = P.step * rng.range(0.85, 1.15); const hA = H(A.x, A.z);
      let best = null;
      for (const dd of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const aa = a + dd + rng.range(-P.wander, P.wander) * 0.6; const qx = A.x + Math.cos(aa) * step, qz = A.z + Math.sin(aa) * step;
        const gr = Math.abs(H(qx, qz) - hA) / step; const c = Math.abs(dd) * (k === 0 ? 4 : 0.7) + Math.max(0, gr - P.gmax) * 30;
        if (!best || c < best.c) best = { aa, c, gr };
      }
      if (best.gr > P.gmax * 2.6) return; // too steep for this kind of street
      a = best.aa;
      const ux = Math.cos(a), uz = Math.sin(a); const px = A.x + ux * step, pz = A.z + uz * step;
      // crossing another road: meet it there
      const hit = net.firstHit(A.x, A.z, px, pz, cur);
      if (hit) {
        const B0 = net.nodes[hit.s.a], B1 = net.nodes[hit.s.b]; const sl = Math.hypot(B1.x - B0.x, B1.z - B0.z) || 1;
        if (Math.abs((ux * (B1.x - B0.x) + uz * (B1.z - B0.z)) / sl) > 0.82 || hit.t * step < 2.5) return;
        const m = net.splitAt(hit.s, hit.x, hit.z); if (m !== cur) net.addSeg(cur, m, P.w, lvl); return;
      }
      // close to an existing junction: join it
      const sn = net.nearestNode(px, pz, P.snap, cur);
      if (sn >= 0 && !net.adjacent(cur, sn)) {
        const S = net.nodes[sn]; const dx = S.x - A.x, dz = S.z - A.z; const dl = Math.hypot(dx, dz);
        if (dl > 2 && (dx * ux + dz * uz) / dl > 0.5 && !net.firstHit(A.x, A.z, S.x, S.z, cur, sn)) { net.addSeg(cur, sn, P.w, lvl); return; }
      }
      // running alongside another road: turn into it or stop
      let ns = net.nearestSeg(px, pz, P.sep, cur);
      if (ns && k === 0) { // the parent road itself does not count; any other road this close means no room for houses
        const Q0 = net.nodes[ns.s.a], Q1 = net.nodes[ns.s.b];
        if (segDist(A.x, A.z, Q0.x, Q0.z, Q1.x, Q1.z).d < 3) ns = null; else return;
      }
      if (ns) {
        const B0 = net.nodes[ns.s.a], B1 = net.nodes[ns.s.b]; const sl = Math.hypot(B1.x - B0.x, B1.z - B0.z) || 1;
        const vx = ns.x - A.x, vz = ns.z - A.z; const vl = Math.hypot(vx, vz) || 1;
        if (vl > 2 && Math.abs((vx * (B1.x - B0.x) + vz * (B1.z - B0.z)) / (vl * sl)) < 0.7) {
          const h2 = net.firstHit(A.x, A.z, ns.x, ns.z, cur);
          if (!h2 || h2.s === ns.s) { const m = net.splitAt(ns.s, ns.x, ns.z); if (m !== cur) net.addSeg(cur, m, P.w, lvl); return; }
        }
        return;
      }
      if (!within(px, pz) || !within((A.x + px) / 2, (A.z + pz) / 2)) return;
      const n = net.addNode(px, pz); net.addSeg(cur, n, P.w, lvl); cur = n; len += step;
    }
  };
  const branchPass = (fromLv, toLv, key, mul = 1) => {
    const reqs = [];
    for (const s of net.segs) {
      if (!s.alive || s.square || !fromLv.includes(s.lvl)) continue;
      const A = net.nodes[s.a], B = net.nodes[s.b]; const L = Math.hypot(B.x - A.x, B.z - A.z); if (L < 4) continue;
      const ux = (B.x - A.x) / L, uz = (B.z - A.z) / L;
      const K0 = DK[districtAt((A.x + B.x) / 2, (A.z + B.z) / 2).kind]; if (!K0[key]) continue;
      let t = rng.range(0, K0[key][1] * mul);
      while (t < L) {
        const x = A.x + ux * t, z = A.z + uz * t; const K = DK[districtAt(x, z).kind];
        if (K[key]) {
          let sides = rng.chance(0.45) ? [1, -1] : [rng.chance(0.5) ? 1 : -1];
          if (s.quay) sides = [ux > 0 ? -1 : 1];
          reqs.push({ x, z, ux, uz, sides, K });
        }
        t += rng.range(...(K[key] || K0[key])) * mul;
      }
    }
    for (let i = reqs.length - 1; i > 0; i--) { const j = rng.int(0, i); [reqs[i], reqs[j]] = [reqs[j], reqs[i]]; }
    for (const r of reqs) {
      const seg = net.segAt(r.x, r.z); if (!seg) continue;
      const jn = net.ng.query(r.x - 7, r.z - 7, r.x + 7, r.z + 7).some(n => n.segs.length >= 3 && Math.hypot(n.x - r.x, n.z - r.z) < 5.5);
      if (jn) continue; // too close to another junction
      const m = net.splitAt(seg, r.x, r.z); if (net.nodes[m].segs.length >= 4) continue;
      for (const side of r.sides) {
        const a = Math.atan2(r.uz, r.ux) + side * Math.PI / 2 + rng.range(-0.3, 0.3);
        if (net.hasDirection(m, a, 0.6)) continue;
        grow(m, a, toLv, LV[toLv](r.K));
      }
    }
  };
  branchPass([0], 1, 'b1'); branchPass([1], 1, 'b1', 1.15);
  branchPass([1], 2, 'b2'); branchPass([0], 2, 'b2', 1.7); branchPass([2], 2, 'b2', 1.2);
  branchPass([2], 3, 'b3'); branchPass([3], 3, 'b3', 1.2);
  // prune stubs too short to be streets
  for (let it = 0; it < 3; it++) for (const s of net.segs) {
    if (!s.alive || s.lvl === 0 || s.keep) continue;
    if ((net.nodes[s.a].segs.length === 1 || net.nodes[s.b].segs.length === 1) && net.len(s) < 8) net.kill(s);
  }
  const roads = net.segs.filter(s => s.alive);
  for (const s of roads) {
    const A = net.nodes[s.a], B = net.nodes[s.b]; const K = DK[districtAt((A.x + B.x) / 2, (A.z + B.z) / 2).kind];
    s.mat = s.lvl === 0 ? (s.quay ? 'rCobble' : 'rAve') : s.lvl === 1 ? K.road1 : K.road2;
    if (!s.square) { const it = { o: segObb(A.x, A.z, B.x, B.z, s.w / 2 + 0.1, s.w * 0.12), s }; roadHash.add(it, obbAabb(it.o)); }
  }
  area.net = net;
  // cut the streets into the slope: node heights first, then each street levelled across (small ones first, avenues win)
  for (const n of net.nodes) n.h = H(n.x, n.z);
  for (const s of roads.filter(q => !q.square).sort((a, b) => b.lvl - a.lvl)) { const A = net.nodes[s.a], B = net.nodes[s.b]; levelRoad(A.x, A.z, B.x, B.z, A.h, B.h, s.w, 3); }

  /* ---------- roads beyond the gates, farm lanes and the footpath up Pilgrim's Rise ---------- */
  const outBlock = (x, z) => pointInPoly(x, z, WALL_PTS) || wallDist(x, z) < 5 || terrainH(x, z) < SEA + 0.8;
  const levelPath = (pts, w, blend = 3) => { const hs = pts.map(([x, z]) => H(x, z)); const sm = hs.map((_, i) => { let a = 0, n = 0; for (let k = -3; k <= 3; k++) { const j = i + k; if (j >= 0 && j < hs.length) { a += hs[j]; n++; } } return a / n; });
    for (let i = 0; i < pts.length - 1; i++) levelRoad(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], sm[i], sm[i + 1], w, blend); };
  const outsideRoads = [];
  for (const g of GATES) {
    const legs = g.via ? [[g.outer, g.via], [g.via, g.far]] : [[g.outer, g.far]]; let p = [];
    for (const [a, b] of legs) { const q = routeTerrain(a, b, { grade: 0.07, block: outBlock }) || [a, b]; p = p.concat(p.length ? q.slice(1) : q); }
    const pts = resamplePath(smoothPath(simplifyPath(p, 3), 2), 4); pts.unshift([g.x, g.z]); pts.unshift(g.inner);
    levelPath(pts.slice(1), 5.5); outsideRoads.push(pts);
  }
  const roadPts = []; const nearRoads = (x, z, r) => roadPts.some(([ax, az, bx, bz]) => segDist(x, z, ax, az, bx, bz).d < r);
  const addRoadPts = pts => { for (let i = 0; i < pts.length - 1; i++) roadPts.push([pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]]); };
  outsideRoads.forEach(addRoadPts);
  const nearestOnRoads = (x, z) => { let best = null, bd = 1e9; for (const [ax, az, bx, bz] of roadPts) { const q = segDist(x, z, ax, az, bx, bz); if (q.d < bd) { bd = q.d; best = [q.x, q.z]; } } return best; };
  const lanes = [];
  for (const F of farmSites) {
    const tgt = nearestOnRoads(F.x, F.z); const from = xfP(makeXf(F.x, F.z, F.ang), 0, 16);
    const p = routeTerrain(from, tgt, { grade: 0.1, block: outBlock }); if (!p) continue;
    const pts = resamplePath(smoothPath(simplifyPath(p, 3), 2), 4); levelPath(pts, 3.2, 2); lanes.push(pts);
  }
  lanes.forEach(addRoadPts);
  // the lookout: a stone terrace on the shoulder of Pilgrim's Rise, facing the city and the bay
  const lookDir = (() => { const dx = LOOK_AT[0] - RISE_LOOK[0], dz = LOOK_AT[1] - RISE_LOOK[1], l = Math.hypot(dx, dz); return [dx / l, dz / l]; })();
  const lookAng = Math.atan2(lookDir[0], lookDir[1]);
  const lookXf = makeXf(RISE_LOOK[0], RISE_LOOK[1], lookAng, lookPad.h);
  const pathStart = xfP(lookXf, -5.5, 2.5);
  const northGate = GATES.find(g => g.id === 'northgate');
  let hillPath = routeTerrain(pathStart, northGate.outer, { grade: 0.15, block: (x, z) => pointInPoly(x, z, WALL_PTS) || terrainH(x, z) < SEA + 0.8 });
  hillPath = hillPath ? resamplePath(smoothPath(simplifyPath(hillPath, 2), 2), 3) : [pathStart, northGate.outer];
  levelPath(hillPath, 2.2, 1.5); addRoadPts(hillPath);
  // grass worn thin along every road and track
  const wear = new Float32Array((TG.N + 1) * (TG.N + 1));
  const wearSeg = (ax, az, bx, bz, w) => {
    const pad = w / 2 + 5, S = TG.N + 1; const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad + TG.R) / TG.C)), i1 = Math.min(TG.N, Math.ceil((Math.max(ax, bx) + pad + TG.R) / TG.C));
    const j0 = Math.max(0, Math.floor((Math.min(az, bz) - pad + TG.R) / TG.C)), j1 = Math.min(TG.N, Math.ceil((Math.max(az, bz) + pad + TG.R) / TG.C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const x = -TG.R + i * TG.C, z = -TG.R + j * TG.C; const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1); const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < pad) wear[j * S + i] = Math.max(wear[j * S + i], 1 - smoothstep(w / 2, pad, d)); }
  };
  for (const [ax, az, bx, bz] of roadPts) wearSeg(ax, az, bx, bz, 4);
  const wearAt = (x, z) => { const i = Math.round((x + TG.R) / TG.C), j = Math.round((z + TG.R) / TG.C); return i < 0 || j < 0 || i > TG.N || j > TG.N ? 0 : wear[j * (TG.N + 1) + i] * 0.45; };
  // the level plots win over everything that was cut around them
  for (const p of pads) applyPad({ ...p, blend: Math.min(p.blend, 4) });
  sealTerrainEdge();
  // the tracks that run on from the gates into the wild are planned now, so the edge of the surveyed land is cut for them too
  Wild.planTracks(gateTracks());
  Wild.levelFine();

  /* ---------- ground ---------- */
  const forestMask = (x, z, h = H(x, z)) => {
    if (pointInPoly(x, z, WALL_PTS)) return 0;
    const wd = wallDist(x, z), r = Math.hypot(x, z), wild = smoothstep(700, 1300, r);
    let f = fbm(x / 190 + 3, z / 190, 3, 77) + 0.3 * smoothstep(250, 700, r) * (1 - wild) + 0.25 * smoothstep(40, 90, h) - 0.05;
    // out in the wild the woods come and go with the lie of the land: clearings, heaths and open valley floors
    if (wild > 0) f += wild * (0.22 * fbm(x / 520 + WSEED * 1.7, z / 520, 3, 78) - 0.06 * smoothstep(90, 150, h - 0.6 * (wildTreeLine(x, z) - 150)) - 0.9 * smoothstep(wildTreeLine(x, z) - 35, wildTreeLine(x, z), h));
    f -= 1.1 * wildCult(x, z); // farmed land: the woods are cleared back to copses
    const m = smoothstep(-0.06, 0.34, f) * smoothstep(55, 120, wd), st = r > 1500 ? siteAt(x, z) : null;
    return st ? lerp(m, siteForest(st.S, x, z, h), st.w) : m; // a site's own woods, the same in every world

  };
  area.forestMask = forestMask;
  const matOf = (x, z, h, slope) => {
    if (slope > 1.3 && Math.hypot(x, z + 125) < 75) return 'tCrag'; // the castle rock shows through only where it is sheer
    if (insideCity(x, z, -3)) { const K = DK[districtAt(x, z).kind]; return K.ground ? 'tDirt' : 'tGrass'; }
    if (z > 60 && isBeach(x, z, h)) return 'tSand';
    if (slope > 0.8 && wallDist(x, z) > 45) return 'tRock';
    if (h > 150 + 22 * fbm(x / 240, z / 240, 2, 332) && slope > 0.22) return 'tScree'; // above the trees the ground breaks up into stone
    return 'tGrass';
  };
  // what casts a shadow on the ground: [obb, top height]; the low morning sun comes from the east-south-east
  const casters = new SHash(16); const caster = (o, top) => casters.add({ o, top }, obbAabb(o));
  const casterL = (x0, z0, x1, z1, top) => { const f = gb.xf; const [cx, cz] = wp((x0 + x1) / 2, (z0 + z1) / 2); caster(mkObb(cx, cz, f ? f.ang : 0, Math.abs(x1 - x0) / 2, Math.abs(z1 - z0) / 2), (f ? f.y : 0) + top); };
  const SUN = (() => { const l = TERRAIN_LIGHT, hl = Math.hypot(l[0], l[2]); return { x: l[0] / hl, z: l[2] / hl, tan: l[1] / hl }; })();
  const shadowAt = (x, z, h) => {
    for (const t of [1.5, 3, 5, 8, 12, 17, 24, 32, 42]) { const qx = x + SUN.x * t, qz = z + SUN.z * t, need = h + t * SUN.tan; for (const c of casters.query(qx, qz, qx, qz)) if (c.top > need && circleObb(qx, qz, 0.01, c.o)) return 0.66; }
    return 1;
  };
  const tintOf = (x, z, h, n) => {
    const sh = shadowAt(x, z, h);
    if (z > 60 && isBeach(x, z, h) && !insideCity(x, z, -3)) return [sh, sh, sh];
    const outK = smoothstep(TG.R, TG.R + 260, Math.max(Math.abs(x), Math.abs(z))), wildK = 1 - 0.7 * outK; // calmer colour out in the country (blended in, so the surveyed square has no seam)
    const dry = clamp(0.5 + 0.9 * wildK * fbm(x / 120, z / 120, 3, 41), 0, 1), patch = 1 + 0.09 * wildK * fbm(x / 26, z / 26, 2, 55);
    let r = lerp(1.0, 1.18, dry) * patch, g = lerp(0.97, 0.95, dry) * patch, b = lerp(0.8, 0.72, dry) * patch;
    const fm0 = Math.max(forestMask(x, z, h), 0.75 * wildCopse(x, z)), fm = Math.min(1, lerp(1.3 * fm0, smoothstep(0.08, 0.42, fm0), outK)); // out in the country the floor darkens wherever the trees stand thick
    r = lerp(r, 0.4, fm * 0.92); g = lerp(g, 0.55, fm * 0.92); b = lerp(b, 0.36, fm * 0.92); // the floor of a wood reads dark from afar
    const heath = smoothstep(60, 110, h); r = lerp(r, 1.12, heath * 0.5); b = lerp(b, 0.78, heath * 0.5);
    if (outK > 0) { const vale = (1 - smoothstep(40, 380, riverD(x, z))) * outK, rough = smoothstep(0.05, 0.45, fbm(x / 340 + 7, z / 340, 2, 48)) * outK * (1 - fm0), dry = smoothstep(-0.1, 0.5, fbm(x / 900, z / 900, 2, 49)) * outK;
      r = lerp(r, 0.86, vale * 0.45); g = lerp(g, 1.04, vale * 0.45); b = lerp(b, 0.66, vale * 0.45); // lush meadow along the rivers
      r = lerp(r, 1.2, rough * 0.4); g = lerp(g, 0.93, rough * 0.4); b = lerp(b, 0.66, rough * 0.4); // rough grazing, tawny
      r *= 1 + 0.07 * dry; b *= 1 - 0.08 * dry; }
    { const hw = wildHeath(x, z, h) * (1 - fm); if (hw > 0) { r = lerp(r, h > 70 ? 1.02 : 1.12, hw * 0.92); g = lerp(g, h > 70 ? 0.72 : 0.82, hw * 0.92); b = lerp(b, h > 70 ? 0.84 : 0.58, hw * 0.92); } } // heather purples the uplands, bracken browns the lower heath
    if (Math.max(Math.abs(x), Math.abs(z)) <= TG.R) { const bare = smoothstep(118, 165, h); r = lerp(r, 1.05, bare); g = lerp(g, 1.0, bare); b = lerp(b, 1.02, bare); } // thin turf and bare rock above the tree line
    else { const TL = wildTreeLine(x, z), turf = smoothstep(TL - 20, TL + 70, h), bare = smoothstep(TL + 110, TL + 230, h); r = lerp(lerp(r, 1.1, turf * 0.7), 1.02, bare); g = lerp(lerp(g, 0.97, turf * 0.7), 0.98, bare); b = lerp(lerp(b, 0.74, turf * 0.7), 0.96, bare); } // out in the country: tawny alpine turf, then bare stone
    const SL = Math.max(Math.abs(x), Math.abs(z)) <= TG.R ? 250 : wildSnowLine(x, z), snow = smoothstep(SL, SL + 50, h) * smoothstep(0.35, 0.7, n[1]); if (snow > 0) { r = lerp(r, 1.9, snow); g = lerp(g, 1.92, snow); b = lerp(b, 2.0, snow); }
    const wear = wearAt(x, z); r = lerp(r, 1.1, wear); g = lerp(g, 0.98, wear); b = lerp(b, 0.78, wear);
    if (insideCity(x, z, -3)) { r = 1; g = 1; b = 0.96; }
    if (n[1] < 0.72 && Math.hypot(x, z + 125) < 75) { r = 0.92; g = 0.9; b = 0.88; } // the castle rock: grey limestone, a shade darker than the walls
    return sh < 1 ? [r * sh * 0.92, g * sh * 0.97, b * sh * 1.16] : [r, g, b]; // shade takes the blue of the sky
  };
  // the far country and the mountains keep their shape through a bluer haze
  for (const k of ['farGround', 'farRock']) mats[k].onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n float fogFactor = smoothstep(fogNear, fogFar, vFogDepth * 0.7);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * vec3(0.86, 0.92, 1.06), min(1.0, fogFactor * 1.05));\n#endif'); };
  area.scene.add(buildWater(mats.water));
  area.waterMat = mats.water;
  // roads: strips over the levelled ground plus a disc at every junction
  for (const s of roads) {
    if (s.square) continue;
    const A = net.nodes[s.a], B = net.nodes[s.b];
    drapeStrip(gb, s.mat, resamplePath([[A.x, A.z], [B.x, B.z]], 3), s.w, { lift: 0.07 });
  }
  for (const n of net.nodes) {
    const ss = n.segs.filter(s => !s.square); if (!ss.length) continue;
    const s = ss.reduce((a, b) => b.w > a.w ? b : a); drapeDisc(gb, s.mat, n.x, n.z, s.w / 2, { segs: 10, rings: 1, lift: 0.075 });
  }
  // unpaved ways fray out into the ground beside them; paved ones are edged with a line of kerb stones
  { const PAVED = { rCobble: 1, rAve: 1, rFlag: 1 }, SOFT = { rGravel: 'rGravelF', rDirt: 'rDirtF', rMud: 'rMudF' }; let fs = 1;
    const cut = (pts, t0, t1) => { const out = []; let run = 0; for (let i = 0; i < pts.length; i++) { if (i) run += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (run >= t0 && run <= t1) out.push(pts[i]); } return out; };
    for (const ch of roadChains(net, roads)) {
      const pts = resamplePath(ch.P.map(n => [n.x, n.z]), 1.5);
      if (SOFT[ch.mat]) { drapeFeather(gb, SOFT[ch.mat], pts, ch.w, ch.mat === 'rGravel' ? 0.55 : 0.85, { lift: 0.035, seed: fs++ });
        const tr = new RNG(fs * 31); for (let i = 1; i < pts.length - 1; i++) { if (tr.next() > 0.3) continue; const a = pts[i - 1], b = pts[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, sd = tr.next() < 0.5 ? 1 : -1, o = (ch.w / 2 + 0.5 + tr.next() * 0.9) * sd; const x = pts[i][0] - (b[1] - a[1]) / l * o, z = pts[i][1] + (b[0] - a[0]) / l * o; tufts.push([x, H(x, z), z, 0.8 + tr.next() * 0.5]); }
        continue; }
      if (!PAVED[ch.mat] || ch.quay) continue;
      const trim = (ni) => { const n = net.nodes[ni]; if (n.segs.length < 2) return 0; let m = 0; for (const q of n.segs) if (q.w > m && (q.square || q.w !== ch.w || q.mat !== ch.mat || n.segs.length > 2)) m = q.w; return m ? m / 2 + 0.5 : 0; };
      const inner = cut(pts, trim(ch.ends[0]), ch.len - trim(ch.ends[1])); if (inner.length < 2) continue;
      for (const sd of [1, -1]) {
        const off = inner.map((p, i) => { const a = inner[Math.max(0, i - 1)], b = inner[Math.min(inner.length - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; const o = (ch.w / 2 - 0.17) * sd; return [p[0] - dz / l * o, p[1] + dx / l * o]; });
        drapeStrip(gb, 'kerb', off, 0.34, { lift: 0.085, tw: 1.2, uvAlong: true });
      }
    }
  }
  // squares
  { const pts = circlePts(MARKET[0], MARKET[1], 25.5, 14, 1.8); area.marketPoly = pts;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; const y = marketPad.h + 0.05; gb.tri('sqPlaza', [MARKET[0], y, MARKET[1]], [a[0], y, a[1]], [b[0], y, b[1]], [MARKET[0] / 4, MARKET[1] / 4], [a[0] / 4, a[1] / 4], [b[0] / 4, b[1] / 4], [0, 1, 0]); } }
  drapeDisc(gb, 'sqPlaza', MEMORIAL[0], MEMORIAL[1], 13, { lift: 0.05, tw: 4 }); drapeDisc(gb, 'sqPlaza', 0, CASTLE_Z - 30, 11, { lift: 0.05, tw: 4 });
  drapeDisc(gb, 'sqFlag', -120, 14, 10, { lift: 0.05, tw: 4 });
  drapeDisc(gb, 'sqPlaza', BELL[0], BELL[1], 12, { lift: 0.05, tw: 4 });
  drapeDisc(gb, 'sqCobble', WELL[0], WELL[1], 8, { lift: 0.05 }); drapeDisc(gb, 'sqCobble', FISH[0], FISH[1], 8.5, { lift: 0.05 });
  gb.quad('sqCobble', [-160, QUAY_H + 0.04, SHORE], [1, 0, 0], [0, 0, -1], 320, 3.5, 3, 3);
  gb.quad('stone', [-160, SEA - 3, SHORE], [1, 0, 0], [0, 1, 0], 320, QUAY_H - SEA + 3, 4, 4);
  // beyond the gates
  for (const pts of outsideRoads) { drapeStrip(gb, 'rCobble', pts.slice(0, 4), 7, { lift: 0.08 }); drapeStrip(gb, 'rDirt', pts.slice(3), 5, { lift: 0.07 }); }
  for (const pts of lanes) drapeStrip(gb, 'rDirt', pts, 3, { lift: 0.07 });
  drapeStrip(gb, 'rGravel', hillPath, 1.5, { lift: 0.07 });

  /* ---------- city walls, towers and gatehouses: they climb and fall with the ground ---------- */
  const merlon = (x, y, z, sx, sz) => gb.box(x - sx, y, z - sz, x + sx, y + 1.3, z + sz, 'cityWall', 5, 5);
  const T2 = WALL_T / 2;
  // runs of wall along the frame's local x, each stepping with the ground; a run that stops short of its segment's end leaves a dressed face
  const wallSpans = (spans, len, WH) => {
    for (const [t0, t1] of spans) {
      const n = Math.max(1, Math.ceil((t1 - t0) / 4)); const ts = [], gs = [];
      for (let k = 0; k <= n; k++) { const t = t0 + (t1 - t0) * k / n; ts.push(t); gs.push(Math.min(gy(t, T2 + 1), gy(t, -T2 - 1), gy(t, 0))); }
      for (let k = 0; k < n; k++) {
        const a = ts[k], b = ts[k + 1], ga = gs[k], gb2 = gs[k + 1]; const ya = ga + WH, yb = gb2 + WH, ba = ga - 2, bb = gb2 - 2;
        const Q = (p, q, r2, s2, hint, u0, u1) => gb.quad4('cityWall', p, q, r2, s2, [u0 / 5, p[1] / 5], [u1 / 5, q[1] / 5], [u1 / 5, r2[1] / 5], [u0 / 5, s2[1] / 5], hint);
        Q([a, ba, T2], [b, bb, T2], [b, yb, T2], [a, ya, T2], [0, 0, 1], a, b);
        Q([b, bb, -T2], [a, ba, -T2], [a, ya, -T2], [b, yb, -T2], [0, 0, -1], b, a);
        gb.quad4('cityWall', [a, ya, T2], [b, yb, T2], [b, yb, -T2], [a, ya, -T2], [a / 5, T2 / 5], [b / 5, T2 / 5], [b / 5, -T2 / 5], [a / 5, -T2 / 5], [0, 1, 0]);
        for (let x = a + 0.8; x < b - 0.4; x += 2.4) { const y = lerp(ya, yb, (x - a) / (b - a)); merlon(x, y, T2 - 0.4, 0.6, 0.4); merlon(x, y, -T2 + 0.4, 0.6, 0.4); }
        col(a, -T2, b, T2, Math.min(ba, bb), Math.max(ya, yb) + 1.3); casterL(a, -T2, b, T2, Math.max(ya, yb) + 1.3);
      }
      for (const [t, gg, sgn] of [[t0, gs[0], 1], [t1, gs[n], -1]]) if ((sgn === 1 && t0 > 0) || (sgn === -1 && t1 < len)) gb.quad('cityWall', [t, gg - 2, sgn > 0 ? -T2 : T2], [0, 0, sgn], [0, 1, 0], WALL_T, WH + 2, 5, 5);
    }
  };
  // a square tower astride the wall, its foot y0 above the frame
  const sqTower = (cx, s, h, y0 = 0) => { gb.box(cx - s / 2, y0 - 3, -s / 2, cx + s / 2, y0 + h, s / 2, { side: 'cityWall', top: 'cityWall' }, 5, 5); col(cx - s / 2, -s / 2, cx + s / 2, s / 2, y0 - 3, y0 + h + 1.3);
    for (let x = cx - s / 2 + 0.5; x < cx + s / 2 - 0.6; x += 2.2) { merlon(x + 0.4, y0 + h, s / 2 - 0.4, 0.5, 0.4); merlon(x + 0.4, y0 + h, -s / 2 + 0.4, 0.5, 0.4); } };
  for (let i = 0; i < WALL_PTS.length - 1; i++) {
    const S = wallSeg(i); const ang = Math.atan2(-S.uz, S.ux); gb.setXf(S.a[0], S.a[1], ang, 0); // local x runs along the wall
    const g = GATES.find(q => q.seg === i);
    wallSpans(g ? [[0, g.tg - 5], [g.tg + 5, S.len]] : [[0, S.len]], S.len, WALL_H);
    if (g) {
      const gg = g.pad.h; gb.setXf(S.a[0], S.a[1], ang, gg);
      sqTower(g.tg - 8, 6.5, 14); sqTower(g.tg + 8, 6.5, 14);
      gb.box(g.tg - 5, 7, -3, g.tg + 5, 14, 3, { side: 'cityWall', top: 'cityWall', bottom: 'cityWall' }, 5, 5); col(g.tg - 5, -3, g.tg + 5, 3, 7, 15.3);
      for (let x = g.tg - 4.4; x < g.tg + 4.6; x += 2.4) { merlon(x, 14, 2.6, 0.6, 0.4); merlon(x, 14, -2.6, 0.6, 0.4); }
      for (const z of [3.05, -3.05]) gb.quad('portcullis', [g.tg - 5, 5.3, z], [1, 0, 0], [0, 1, 0], 10, 1.8, 1.8, 1.8, { v0: 0 });
      for (const t of [g.tg - 5.6, g.tg + 5.6]) { const p = wp(t, 0); glows.push([p[0] + g.nx * 3.8, gg + 3.2, p[1] + g.nz * 3.8, 1.2]); }
    }
    gb.xf = null;
  }
  { // the sea wall closes the waterfront, a little lower than the land walls, with the beach left at its foot;
    // each pier runs out through a water gate, and square towers stand along it, two of them on the roots of the moles
    const SW_H = 6.5, GW = 4.5, x0 = WALL_PTS[0][0], len = WALL_PTS[WALL_PTS.length - 1][0] - x0; gb.setXf(x0, SHORE + 0.5, 0, 0); // local x runs east along the quay
    const cuts = PIERS.map(px => px - x0).sort((a, b) => a - b), spans = []; let t = 0;
    for (const c of cuts) { spans.push([t, c - GW]); t = c + GW; } spans.push([t, len]);
    wallSpans(spans, len, SW_H);
    for (const c of cuts) { // the arch: a lintel over the passage, the portcullis drawn up beneath it
      const g = Math.min(gy(c - GW, 0), gy(c + GW, 0));
      gb.box(c - GW, g + 4.4, -T2, c + GW, g + SW_H, T2, { side: 'cityWall', top: 'cityWall', bottom: 'cityWall' }, 5, 5); col(c - GW, -T2, c + GW, T2, g + 4.4, g + SW_H + 1.3);
      for (let x = c - GW + 0.8; x < c + GW - 0.4; x += 2.4) { merlon(x, g + SW_H, T2 - 0.4, 0.6, 0.4); merlon(x, g + SW_H, -T2 + 0.4, 0.6, 0.4); }
      for (const z of [T2 + 0.05, -T2 - 0.05]) gb.quad('portcullis', [c - GW, g + 3.1, z], [1, 0, 0], [0, 1, 0], GW * 2, 1.3, 1.8, 1.8, { v0: 0 });
    }
    for (const tx of [WMOLE, -52.5, 12.5, 85, BREAK]) { const c = tx - x0, g = Math.min(gy(c, -3.5), gy(c, 3.5)); sqTower(c, 7, 10, g); casterL(c - 3.5, -3.5, c + 3.5, 3.5, g + 11.3); }
    gb.xf = null;
  }
  for (const [x, z] of WALL_PTS) {
    let g = 1e9; for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; g = Math.min(g, H(x + Math.cos(a) * 5, z + Math.sin(a) * 5)); }
    gb.cyl('cityWall', x, z, 4.6, g - 2, g + 15, 12, 5, 5); gb.cone('roofSlate', x, z, 5.3, g + 15, 7, 12, 3);
    addCol(area, x - 4.3, z - 4.3, x + 4.3, z + 4.3, g - 2, g + 15); caster(mkObb(x, z, 0, 4.4, 4.4), g + 19); addCol(area, x - 3, z - 3, x + 3, z + 3, g + 15, g + 18.5); addCol(area, x - 1.4, z - 1.4, x + 1.4, z + 1.4, g + 18.5, g + 21.5);
  }

  /* ---------- Castle Daggerfall (north), on its knoll ---------- */
  const CH = castlePad.h;
  gb.setXf(0, CASTLE_Z, 0, CH);
  gb.quad('sqCobble', [-30.5, 0.03, -41.5], [1, 0, 0], [0, 0, -1], 61, 59, 3, 3); // the ward is cobbled
  gb.quad('sqFlag', [-2.5, 0.06, -40], [1, 0, 0], [0, 0, -1], 5, 26, 3, 3);
  // Castle Daggerfall: a tall curtain on a battered plinth; one great tower and a keep lead a clear hierarchy of towers,
  // a projecting twin-towered gatehouse, the royal palace with crow-stepped gables and a chapel whose spire tops its ridge
  const CW = 15; // wall-walk height above the ward: half as high again as the city wall
  const cmerX = (x0, x1, z, h) => { for (let x = x0 + 0.6; x < x1 - 1.2; x += 2.7) gb.box(x, h, z - 0.5, x + 1.5, h + 1.7, z + 0.5, 'castle', 4, 4); };
  const cmerZ = (z0, z1, x, h) => { for (let z = z0 + 0.6; z < z1 - 1.2; z += 2.7) gb.box(x - 0.5, h, z, x + 0.5, h + 1.7, z + 1.5, 'castle', 4, 4); };
  const ringMer = (cx, cz, r, y, n) => { for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * Math.PI * 2, x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; gb.box(x - 0.65, y, z - 0.65, x + 0.65, y + 1.6, z + 0.65, 'castle', 4, 4); } };
  const slit = (cx, cz, r, a, y, h = 1.8) => { const U = [Math.sin(a), 0, -Math.cos(a)], px = cx + Math.cos(a) * (r + 0.03), pz = cz + Math.sin(a) * (r + 0.03); gb.quad('iron', [px - U[0] * 0.2, y, pz - U[2] * 0.2], U, [0, 1, 0], 0.4, h, 1, 1, { fixedUV: true }); };
  const batter = (x0, z0, x1, z1, y0, y1, e) => { // a sloped stone skirt from footprint+e at y0 up to the footprint at y1
    const B = [[x0 - e, z1 + e], [x1 + e, z1 + e], [x1 + e, z0 - e], [x0 - e, z0 - e]], Tp = [[x0, z1], [x1, z1], [x1, z0], [x0, z0]], N = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, L = Math.hypot(B[j][0] - B[i][0], B[j][1] - B[i][1]) / 4; gb.quad4('stone', [B[i][0], y0, B[i][1]], [B[j][0], y0, B[j][1]], [Tp[j][0], y1, Tp[j][1]], [Tp[i][0], y1, Tp[i][1]], [0, y0 / 4], [L, y0 / 4], [L, y1 / 4], [0, y1 / 4], [N[i][0], 0.4, N[i][1]]); } };
  const frustum = (k, cx, cz, r0, r1, y0, y1, n = 16) => { for (let i = 0; i < n; i++) { const a0 = i / n * Math.PI * 2, a1 = (i + 1) / n * Math.PI * 2, m = (a0 + a1) / 2, L = 2 * Math.PI * r0 / n / 4; gb.quad4(k, [cx + Math.cos(a0) * r0, y0, cz + Math.sin(a0) * r0], [cx + Math.cos(a1) * r0, y0, cz + Math.sin(a1) * r0], [cx + Math.cos(a1) * r1, y1, cz + Math.sin(a1) * r1], [cx + Math.cos(a0) * r1, y1, cz + Math.sin(a0) * r1], [0, y0 / 4], [L, y0 / 4], [L, y1 / 4], [0, y1 / 4], [Math.cos(m), 0.4, Math.sin(m)]); } };
  const cwall = (x0, z0, x1, z1) => {
    const along = x1 - x0 > z1 - z0;
    batter(x0, z0, x1, z1, -14, 4, 2.6); gb.box(x0 - 0.3, 3.6, z0 - 0.3, x1 + 0.3, 4.1, z1 + 0.3, 'stoneLight', 4, 4); // battered plinth and its string course
    gb.box(x0, 4, z0, x1, CW, z1, { side: 'castle', top: 'castle' }, 4, 4);
    gb.box(x0 - 0.45, CW - 0.8, z0 - 0.45, x1 + 0.45, CW, z1 + 0.45, { side: 'stoneLight', top: 'castle' }, 4, 4); // corbelled parapet band
    if (along) cmerX(x0, x1, (z0 + z1) / 2, CW); else cmerZ(z0, z1, (x0 + x1) / 2, CW);
    col(x0 - 2, z0 - 2, x1 + 2, z1 + 2, -14, 1); col(x0 - 1, z0 - 1, x1 + 1, z1 + 1, 1, 3); col(x0, z0, x1, z1, 3, CW + 1.7); casterL(x0, z0, x1, z1, CW + 1.7);
  };
  // round towers: 'inset' sets a steep cone inside a crenellated parapet, 'cap' overhangs the wall head, 'open' is crenellated and flat
  const tower = (cx, cz, r, h, style, roof = 0, slits = true) => {
    frustum('stone', cx, cz, r + 2.4, r, -14, 4); gb.cyl('stoneLight', cx, cz, r + 0.25, 3.6, 4.1, 16, 4, 4);
    gb.cyl('castle', cx, cz, r, 4, h, 16, 4, 4);
    gb.cyl('stoneLight', cx, cz, r + 0.5, h - 2.4, h - 1.7, 16, 4, 4);                                                  // corbel course
    for (let i = 0; i < 16; i++) { const a = (i + 0.5) / 16 * Math.PI * 2, x = cx + Math.cos(a) * (r + 0.3), z = cz + Math.sin(a) * (r + 0.3); gb.box(x - 0.3, h - 3.2, z - 0.3, x + 0.3, h - 2.4, z + 0.3, 'stoneLight', 1, 1); } // corbels
    gb.cyl('castle', cx, cz, r + 0.7, h - 1.7, h, 16, 4, 4, { top: style === 'cap' ? null : 'castle' });
    if (style === 'cap') gb.cone('roofSlate', cx, cz, r + 1.2, h, roof, 16, 3);
    else { ringMer(cx, cz, r + 0.25, h, Math.round(r * 2.4)); if (style === 'inset') { gb.cyl('castle', cx, cz, r - 0.5, h, h + 1.2, 16, 4, 4); gb.cone('roofSlate', cx, cz, r - 0.1, h + 1.2, roof, 16, 3); } }
    if (slits) for (let i = 0; i < 5; i++) slit(cx, cz, r, i * 1.26 + 0.4, 4 + (h - 8) * ((i * 0.37) % 1));
    col(cx - r - 1.8, cz - r - 1.8, cx + r + 1.8, cz + r + 1.8, -14, 1); col(cx - r - 0.8, cz - r - 0.8, cx + r + 0.8, cz + r + 0.8, 1, 3); col(cx - r, cz - r, cx + r, cz + r, 3, h + 1.6);
    if (roof) { col(cx - r * 0.6, cz - r * 0.6, cx + r * 0.6, cz + r * 0.6, h, h + roof * 0.5); col(cx - r * 0.25, cz - r * 0.25, cx + r * 0.25, cz + r * 0.25, h + roof * 0.5, h + roof * 0.9); }
    casterL(cx - r, cz - r, cx + r, cz + r, h + (roof || 1.6) * 0.6);
  };
  cwall(-32, -110, 32, -100.5); cwall(-32, -110, -30.5, -40); cwall(30.5, -110, 32, -40); // the north wall runs into the city wall
  cwall(-32, -41.5, -12.5, -40); cwall(12.5, -41.5, 32, -40);
  tower(-31.2, -106, 7.2, 33, 'inset', 15);          // the great tower, on the city wall
  tower(31.2, -106, 5.2, 24, 'cap', 4.5);            // its lesser twin under a low cap
  tower(-31.2, -41, 5.2, 19, 'open'); tower(31.2, -41, 5.2, 19, 'open'); // the southern corners, crenellated
  tower(-31.2, -73, 3.6, 17.5, 'open', 0, false); tower(31.2, -73, 3.6, 17.5, 'open', 0, false);
  // square wall towers break the long flanks, and a timber hoarding hangs off the south-west curtain
  for (const [sx, sz] of [[-31.2, -90], [-31.2, -57], [31.2, -90], [31.2, -57]]) { const o = Math.sign(sx) * 1.2; batter(sx - 2.6 + o, sz - 2.6, sx + 2.6 + o, sz + 2.6, -14, 4, 1.6); gb.box(sx - 2.6 + o, 4, sz - 2.6, sx + 2.6 + o, CW + 2.5, sz + 2.6, { side: 'castle', top: 'castle' }, 4, 4); gb.box(sx - 2.9 + o, CW + 1.8, sz - 2.9, sx + 2.9 + o, CW + 2.5, sz + 2.9, 'stoneLight', 2, 2); cmerX(sx - 2.9 + o, sx + 2.9 + o, sz - 2.5, CW + 2.5); cmerX(sx - 2.9 + o, sx + 2.9 + o, sz + 2.5, CW + 2.5); cmerZ(sz - 2.9, sz + 2.9, sx + o + Math.sign(sx) * 2.5, CW + 2.5); slit(sx + o, sz, 2.6, sx > 0 ? 0 : Math.PI, 8); col(sx - 2.6 + o, sz - 2.6, sx + 2.6 + o, sz + 2.6, -14, CW + 4); casterL(sx - 2.6 + o, sz - 2.6, sx + 2.6 + o, sz + 2.6, CW + 4); }
  gb.box(-29.5, CW - 2.2, -40, -14, CW + 1.2, -38.6, { side: 'woodDark', top: 'wood' }, 2, 2); for (let x = -29; x < -14; x += 2.2) gb.box(x, CW - 3.4, -40, x + 0.3, CW - 2.2, -38.8, 'woodDark', 1, 1);
  gb.quad4('roofSlate', [-29.8, CW + 1.2, -38.3], [-13.7, CW + 1.2, -38.3], [-13.7, CW + 3.2, -40.6], [-29.8, CW + 3.2, -40.6], [0, 0], [5, 0], [5, 1], [0, 1], [0, 1, 1]); // hoarding

  // the gatehouse: drum towers pushed out in front of the curtain, a tall arch, and a machicolated gallery between them
  const GW = 3, GH = 9, GT = CW + 5;
  tower(-8.2, -36.5, 5.2, GT + 3, 'open'); tower(8.2, -36.5, 5.2, GT + 3, 'open');
  gb.box(-5.8, -9, -43, 5.8, GT, -35.2, { side: 'castle', top: 'castle' }, 4, 4, { skip: 's' });
  gb.box(-GW, GH, -35.2, GW, GT - 4, -34.8, { side: 'castle', top: 'castle' }, 4, 4);                             // face above the arch
  for (const x of [-5.8, GW]) gb.box(x, -9, -35.2, x + 5.8 - GW, GT - 4, -34.8, { side: 'castle', top: 'castle' }, 4, 4);
  for (let i = 0; i < 5; i++) { const t = i / 4, y = GH - 1.4 + Math.sin(t * Math.PI) * 1.4, x = lerp(-GW, GW, t); gb.box(x - 0.8, y, -35.1, x + 0.8, y + 0.9, -34.5, 'stoneLight', 1, 1); } // voussoirs of the arch
  for (const x of [-GW - 0.4, GW - 0.3]) gb.box(x, 0, -35.1, x + 0.7, GH - 1.2, -34.6, 'stoneLight', 2, 2);
  gb.box(-6, GT - 4, -35.2, 6, GT, -33.4, { side: 'castle', top: 'castle' }, 4, 4);                                // the machicolated gallery...
  for (let x = -5.5; x < 5.6; x += 1.6) gb.box(x, GT - 5, -34.8, x + 0.6, GT - 4, -33.6, 'stoneLight', 1, 1);       // ...on its corbels
  cmerX(-6, 6, -33.8, GT);
  gb.quad('doorDark', [-GW, 0, -42.5], [1, 0, 0], [0, 1, 0], GW * 2, GH, 1, 1, { fixedUV: true });                 // the dark passage...
  gb.quad('portcullis', [-GW, GH - 3.4, -35.3], [1, 0, 0], [0, 1, 0], GW * 2, 3.2, 2, 1);                          // ...under a raised portcullis
  for (const sg of [-1, 1]) gb.box(sg > 0 ? GW : -GW - 0.3, 0, -43, sg > 0 ? GW + 0.3 : -GW, GH, -35.2, 'castle', 4, 4);
  gb.box(-GW, GH, -43, GW, GH + 0.4, -35.2, 'castle', 4, 4);
  gb.quad('bannerRed', [-1.4, GT - 3.6, -33.35], [1, 0, 0], [0, 1, 0], 2.8, 5, 1, 1, { fixedUV: true });           // the royal banner over the arch
  col(-5.8, -43, -GW, -34.8, -9, GT); col(GW, -43, 5.8, -34.8, -9, GT); col(-GW, -43, GW, -33.4, GH, GT + 1.7);
  casterL(-6, -43, 6, -33.4, GT + 1.7);
  for (const x of [-8.2, 8.2]) gb.quad('bannerRed', [x - 1.2, 8, -31.25], [1, 0, 0], [0, 1, 0], 2.4, 5.4, 1, 1, { fixedUV: true });

  // the great keep, set back in the north-west of the ward: one plain block of masonry under a steep slate pyramid,
  // with a round stair turret climbing its north-east corner, broad and simple enough to read from across the city
  const KX0 = -26, KX1 = -13, KZ0 = -98, KZ1 = -85, KH = 38, KR = 15;
  gb.box(KX0 - 1.4, -6, KZ0 - 1.4, KX1 + 1.4, 3, KZ1 + 1.4, { side: 'stone', top: 'stone' }, 4, 4);
  gb.box(KX0, 3, KZ0, KX1, KH, KZ1, { side: 'castle', top: 'castle' }, 4, 4);
  gb.box(KX0 - 0.7, KH - 3, KZ0 - 0.7, KX1 + 0.7, KH, KZ1 + 0.7, { side: 'castle', top: 'castle' }, 4, 4);    // a plain overhanging wall head
  hipRoof(gb, 'roofSlate', KX0, KZ0, KX1, KZ1, KH, KR, 1.3);
  const STX = KX1, STZ = KZ0, STR = 3.4, STH = KH + 8;                                                       // the stair turret
  gb.cyl('castle', STX, STZ, STR, 3, STH, 12, 4, 4); gb.cone('roofSlate', STX, STZ, STR + 0.8, STH, 10, 12, 3);
  for (const y of [14, 26]) slit(STX, STZ, STR, 0.45, y, 1.6);
  for (const x of [-22.8, -16.2]) for (const y of [21, 30]) gb.quad('winA', [x - 0.7, y, KZ1 + 0.03], [1, 0, 0], [0, 1, 0], 1.4, 3, 1, 1, { fixedUV: true }); // few, large windows
  for (const z of [-94, -89]) gb.quad('winA', [KX0 - 0.03, 30, z - 0.7], [0, 0, 1], [0, 1, 0], 1.4, 3, 1, 1, { fixedUV: true });
  gb.quad('winA', [KX1 + 0.03, 30, -89.3], [0, 0, -1], [0, 1, 0], 1.4, 3, 1, 1, { fixedUV: true });
  col(KX0 - 1.4, KZ0 - 1.4, KX1 + 1.4, KZ1 + 1.4, -6, 3); col(KX0, KZ0, KX1, KZ1, 3, KH); col(KX0 + 3, KZ0 + 3, KX1 - 3, KZ1 - 3, KH, KH + KR * 0.6);
  col(STX - STR, STZ - STR, STX + STR, STZ + STR, 3, STH + 4); casterL(KX0, KZ0, KX1, KZ1, KH + KR * 0.5); casterL(STX - STR, STZ - STR, STX + STR, STZ + STR, STH + 5);

  // the royal palace along the ward, its door on the axis of the gate; crow-stepped gables and tall chimneys show above the curtain
  const PX0 = -10, PX1 = 26, PZ0 = -83, PZ1 = -66, PH = 16, PR = 12;
  gb.box(PX0, 0, PZ0, PX1, PH, PZ1, { side: 'castle', top: null }, 4, 4);
  gb.box(PX0 - 0.3, PH - 0.6, PZ0 - 0.3, PX1 + 0.3, PH, PZ1 + 0.3, 'stoneLight', 4, 4); gb.box(PX0 - 0.2, 6.2, PZ1, PX1 + 0.2, 6.6, PZ1 + 0.25, 'stoneLight', 4, 4);
  gableRoof(gb, 'roofSlate', 'castle', PX0, PZ0, PX1, PZ1, PH, PR, 0.5, true);
  for (const gx of [PX0, PX1]) { const zc = (PZ0 + PZ1) / 2; gb.box(gx - 0.5, PH + PR - 0.2, zc - 0.6, gx + 0.5, PH + PR + 1.6, zc + 0.6, 'stoneLight', 1, 1); for (const y of [PH + 2, PH + 6]) gb.quad('winA', [gx + (gx === PX0 ? -0.03 : 0.03), y, zc + (gx === PX0 ? -0.6 : 0.6)], [0, 0, gx === PX0 ? 1 : -1], [0, 1, 0], 1.2, 2.8, 1, 1, { fixedUV: true }); } // gable finials and windows
  for (const x of [-6, -1, 4, 9, 14, 19]) gb.quad('winA', [x + 0.6, 9, PZ0 - 0.03], [-1, 0, 0], [0, 1, 0], 1.2, 3.6, 1, 1, { fixedUV: true }); // the outer face
  for (const [x, z] of [[-3, -79], [11, -70], [19, -79]]) { gb.box(x - 1, PH + 3, z - 1, x + 1, PH + PR + 5, z + 1, { side: 'stone', top: 'iron' }, 3, 3); gb.box(x - 1.3, PH + PR + 4.3, z - 1.3, x + 1.3, PH + PR + 4.8, z + 1.3, 'stoneLight', 2, 2); } // chimneys
  for (const x of [-7, -3.8, 6, 9.2, 12.4, 15.6, 18.8, 22]) { gb.quad('winA', [x - 0.55, 2.6, PZ1 + 0.03], [1, 0, 0], [0, 1, 0], 1.1, 2.6, 1, 1, { fixedUV: true }); gb.quad('winA', [x - 0.6, 8.4, PZ1 + 0.03], [1, 0, 0], [0, 1, 0], 1.2, 4.6, 1, 1, { fixedUV: true }); gb.box(x - 0.9, 13, PZ1, x + 0.9, 13.4, PZ1 + 0.3, 'stoneLight', 1, 1); }
  gb.box(-3.8, 0, PZ1, 3.8, PH + 4, PZ1 + 1, { side: 'stoneLight', top: 'castle' }, 4, 4);          // the frontispiece over the door
  gableRoof(gb, 'roofSlate', 'stoneLight', -3.8, PZ1 - 1, 3.8, PZ1 + 1, PH + 4, 4, 0.3, false);
  for (const x of [-2, 2]) gb.quad('winA', [x - 0.55, 9, PZ1 + 1.03], [1, 0, 0], [0, 1, 0], 1.1, 3.4, 1, 1, { fixedUV: true });
  gb.quad('doorF', [-2, 0.44, PZ1 + 1.05], [1, 0, 0], [0, 1, 0], 4, 4.3, 1, 1, { fixedUV: true });                   // the palace doors, up two steps in a deep stone surround
  for (const sx of [-1, 1]) gb.box(sx > 0 ? 2 : -2.55, 0.44, PZ1 + 1, sx > 0 ? 2.55 : -2, 4.74, PZ1 + 1.4, 'stoneLight', 1, 1);
  gb.box(-2.75, 4.74, PZ1 + 1, 2.75, 5.3, PZ1 + 1.45, 'stoneLight', 1, 1); gb.box(-0.3, 4.6, PZ1 + 1, 0.3, 5.45, PZ1 + 1.5, 'stoneLight', 1, 1);
  gb.box(-3.2, -0.3, PZ1 + 1, 3.2, 0.44, PZ1 + 2, { side: 'stone', top: 'stoneLight' }, 1.2, 1.2); gb.box(-3.9, -0.3, PZ1 + 2, 3.9, 0.22, PZ1 + 2.8, { side: 'stone', top: 'stoneLight' }, 1.2, 1.2);
  col(-3.2, PZ1 + 1, 3.2, PZ1 + 2, -1, 0.44); col(-3.9, PZ1 + 2, 3.9, PZ1 + 2.8, -1, 0.22);
  for (const x of [-7.5, 8]) gb.quad('banner', [x - 1.2, 8, PZ1 + 0.05], [1, 0, 0], [0, 1, 0], 2.4, 5.4, 1, 1, { fixedUV: true });
  tower(PX1, PZ1, 3.4, 23, 'cap', 9, false);                                                             // the palace's corner tower
  col(PX0, PZ0, PX1, PZ1, 0, PH + 2); col(PX0 + 2, PZ0 + 2, PX1 - 2, PZ1 - 2, PH, PH + 8); col(-3.8, PZ1, 3.8, PZ1 + 1, 5, PH + 4);
  casterL(PX0, PZ0, PX1, PZ1, PH + 7);

  for (const [x0, x1, z0, z1, wx] of [[-30.5, -25, -68, -45, -30.5], [25, 30.5, -61, -45, 30.5]]) { // lean-to ranges: stores, kitchens, stables
    const xi = wx === x0 ? x1 : x0; gb.box(x0, 0, z0, x1, 6.5, z1, { side: 'plaster', top: null }, 3, 3);
    gb.quad4('roofSlate', [xi + Math.sign(xi - wx) * 0.6, 6.2, z1], [xi + Math.sign(xi - wx) * 0.6, 6.2, z0], [wx, 9.6, z0], [wx, 9.6, z1], [0, 0], [(z1 - z0) / 3, 0], [(z1 - z0) / 3, 2], [0, 2], [Math.sign(xi - wx), 1, 0]);
    for (let z = z0 + 2.5; z < z1 - 1; z += 4.5) gb.quad(wx < 0 ? 'door' : 'doorDark', [xi + Math.sign(xi - wx) * 0.03, 0, wx < 0 ? z + 1.4 : z], [0, 0, wx < 0 ? -1 : 1], [0, 1, 0], 1.4, 2.6, 1, 1, { fixedUV: true });
    gb.box(x0 + 1, 8, z0 + 3, x0 + 2.4, 12.5, z0 + 4.4, { side: 'stone', top: 'iron' }, 2, 2); col(x0, z0, x1, z1, 0, 9); casterL(x0, z0, x1, z1, 9.6); }
  // the royal chapel in the north-east of the ward; its spire tops the palace ridge
  gb.box(8, 0, -99, 24, 11, -90, { side: 'castle', top: null }, 4, 4); gableRoof(gb, 'roofSlate', 'castle', 8, -99, 24, -90, 11, 6, 0.5, true);
  gb.box(19.5, 0, -96.8, 24, 21, -92.2, { side: 'stoneLight', top: null }, 3, 3); gb.cone('roofCopper', 21.75, -94.5, 3.3, 21, 13, 8, 3);
  for (const x of [10.5, 13.5, 16.5]) gb.quad('winA', [x - 0.4, 3, -89.97], [1, 0, 0], [0, 1, 0], 0.8, 4, 1, 1, { fixedUV: true });
  col(8, -99, 24, -90, 0, 14); col(19.5, -96.8, 24, -92.2, 14, 24); casterL(8, -99, 24, -90, 15); casterL(19.5, -96.8, 24, -92.2, 30);
  { const w = wp(-13, -52); gb.xf = null; gb.cyl('stoneLight', w[0], w[1], 1.3, CH, CH + 0.9, 10, 2, 2, { top: 'water' }); addCol(area, w[0] - 1.3, w[1] - 1.3, w[0] + 1.3, w[1] + 1.3, CH - 1, CH + 0.9); gb.setXf(0, CASTLE_Z, 0, CH); } // the ward well

  const castleFlags = [];
  for (const [cx, cz, tt, red] of [[STX, STZ, STH + 9, true], [-31.2, -106, 49, true], [-8.2, -36.5, GT + 4.6, false], [8.2, -36.5, GT + 4.6, false]]) { gb.box(cx - 0.2, tt - 1.5, cz - 0.2, cx + 0.2, tt + 5.8, cz + 0.2, 'woodDark', 1, 1); gb.box(cx - 0.35, tt + 5.8, cz - 0.35, cx + 0.35, tt + 6.3, cz + 0.35, 'iron', 1, 1); const p = wp(cx, cz); castleFlags.push([p[0], CH + tt + 4.9, p[1], red ? TEX.bannerRed : TEX.banner]); }
  for (const [x, z] of [[-24, -48], [24, -48], [-24, -60], [24, -60]]) { const p = wp(x, z); tree('cypress', p[0], p[1], 1.1); }
  registerBuilding(area, { id: 'castle', type: 'castle', name: 'Castle Daggerfall', district: 'kingsward', wealth: 3, door: { x: 0, z: PZ1 + 1.1 + CASTLE_Z, y: CH, nx: 0, nz: 1 }, poly: footprintPoly(gb.xf, { x0: PX0, z0: PZ0, x1: PX1, z1: PZ1 }), owner: { name: 'King Gothryd', gender: 'm' } });
  area.castleWalls = footprintPoly(gb.xf, { x0: -32, z0: -102, x1: 32, z1: -40 });
  area.castleTowers = [[-31.2, -106], [31.2, -106], [-31.2, -41], [31.2, -41], [-31.2, -73], [31.2, -73], [-8.2, -36.5], [8.2, -36.5], [STX, STZ]].map(([x, z]) => wp(x, z));
  gb.xf = null;

  // the castle rock: the scarp is faced with broad, angular outcrops of bedrock, parted by turfy gullies
  { const R = mulberry32(907), smp = [];
    const side = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), k = Math.max(1, Math.round(L / 5)); for (let i = 0; i < k; i++) smp.push([lerp(ax, bx, i / k), lerp(az, bz, i / k), nx, nz]); };
    const corner = (cx, cz, a0) => { for (let i = 0; i < 3; i++) { const a = a0 + i / 3 * Math.PI / 2; smp.push([cx, cz, Math.cos(a), Math.sin(a)]); } };
    side(-32, -40, -32, -110, -1, 0); corner(-32, -110, Math.PI); side(-32, -110, 32, -110, 0, -1); corner(32, -110, -Math.PI / 2); side(32, -110, 32, -40, 1, 0); smp.push([32, -40, 1, 0]);
    const ph = [R() * 6, R() * 6, R() * 6];
    const V = smp.map(([px, pz, nx, nz], i) => {
      const o = clamp(0.55 + 0.35 * Math.sin(i * 0.55 + ph[0]) + 0.25 * Math.sin(i * 1.7 + ph[1]), 0, 1); // how boldly the rock stands out here
      const end = Math.min(i, smp.length - 1 - i), tuck = clamp(Math.max(end < 2 ? 1 - end / 2 : 0, (0.3 - o) / 0.3), 0, 1); // gullies, and the ends sink into the turf
      const reach = 0.75 + 0.6 * (0.5 + 0.5 * Math.sin(i * 0.8 + ph[2]));                    // tongues of rock run further down in places
      return [[1.3, 1.6, -0.3], [4.5, 1.8, 1.2 + 1.4 * o], [8.5 * reach, 2, 1.2 + 1.6 * o], [14 * reach, 3, -1.5]].map(([d, jd, lift], r) => {
        const dd = d + R() * jd, j = (R() - 0.5) * 2.6, x = px + nx * dd - nz * j, z = CASTLE_Z + pz + nz * dd + nx * j;
        const g = terrainH(x, z); let y = r === 0 ? CH + lift - R() * 1.8 : Math.min(CH - 1.2, g + lift + (r < 3 ? R() * 1.2 : 0));
        y = lerp(y, g - 1.2, r === 0 ? tuck * 0.5 : tuck); return [x, y, z];
      });
    });
    gb.tint = [0.95, 0.93, 0.9]; let run = 0;
    const uv = (p, u) => [u / 5, (p[1] - u * 0.35) / 5];                                                  // the bedding dips along the scarp
    for (let i = 0; i < V.length - 1; i++) {
      const [, , nx, nz] = smp[i], [, , nx2, nz2] = smp[i + 1], hint = [nx + nx2, 0.5, nz + nz2], du = Math.hypot(V[i + 1][1][0] - V[i][1][0], V[i + 1][1][2] - V[i][1][2]);
      const t = 0.86 + R() * 0.14; gb.tint = [0.95 * t, 0.93 * t, 0.9 * t];
      for (let r = 0; r < 3; r++) { const a = V[i][r], b = V[i + 1][r], c = V[i + 1][r + 1], d = V[i][r + 1], ua = uv(a, run), ub = uv(b, run + du), uc = uv(c, run + du), ud = uv(d, run);
        if ((i + r) % 2) { gb.tri('crag', a, b, c, ua, ub, uc, hint); gb.tri('crag', a, c, d, ua, uc, ud, hint); } else { gb.tri('crag', a, b, d, ua, ub, ud, hint); gb.tri('crag', b, c, d, ub, uc, ud, hint); } }
      run += du;
    }
    gb.tint = null;
  }

  // the switchback ramp up the scarp: stone legs on buttressed retaining walls, with a parapet on the drop side
  { const RY0 = terrainH(RAMP.x0, RAMP.z1) + 0.3, RYE = CH, RYW = RY0 + (RYE - RY0) * (RAMP.x0 - RAMP.xw) / (RAMP.x0 - RAMP.xw + RAMP.xe - RAMP.xw);
    const hw = RAMP.w / 2;
    const leg = (xa, xb, zc, ya, yb, outer) => { // outer: +1 if the drop is on the +z side
      const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb), yAt = (x) => lerp(ya, yb, (x - xa) / (xb - xa));
      let lo = Infinity; for (let x = x0; x <= x1; x += 2) lo = Math.min(lo, terrainH(x, zc - hw), terrainH(x, zc + hw)); lo -= 1.5;
      gb.quad4('cobble', [x0, yAt(x0), zc + hw], [x1, yAt(x1), zc + hw], [x1, yAt(x1), zc - hw], [x0, yAt(x0), zc - hw], [x0 / 3, (zc + hw) / 3], [x1 / 3, (zc + hw) / 3], [x1 / 3, (zc - hw) / 3], [x0 / 3, (zc - hw) / 3], [0, 1, 0]);
      for (const sd of [1, -1]) { const zf = zc + sd * hw; gb.quad4('castle', [x0, lo, zf], [x1, lo, zf], [x1, yAt(x1), zf], [x0, yAt(x0), zf], [x0 / 4, lo / 4], [x1 / 4, lo / 4], [x1 / 4, yAt(x1) / 4], [x0 / 4, yAt(x0) / 4], [0, 0, sd]); }
      for (let x = x0; x < x1 - 0.1; x += 2) { const y = yAt(x + 1); const zf = zc + outer * hw; gb.box(x, y, Math.min(zf, zf - outer * 0.6), x + 2, y + 1.1, Math.max(zf, zf - outer * 0.6), { side: 'castle', top: 'stoneLight' }, 4, 4); addCol(area, x, Math.min(zf, zf - outer * 0.6), x + 2, Math.max(zf, zf - outer * 0.6), y, y + 1.1); }
      for (let x = x0 + 5.5; x < x1 - 4; x += 9) { const zf = zc + outer * (hw + 0.04), top = yAt(x + 2) - 2.2, bot = Math.max(lo + 0.5, terrainH(x + 2, zf) + 0.2); if (top - bot < 2.5) continue; // an arcade of blind arches
        gb.quad('doorDark', [outer > 0 ? x : x + 4, bot, zf], [outer, 0, 0], [0, 1, 0], 4, top - bot, 1, 1, { fixedUV: true }); gb.box(x - 0.3, top, zf - 0.3, x + 4.3, top + 0.7, zf + 0.3, 'stoneLight', 2, 2); }
      for (let x = x0 + 4; x < x1 - 2; x += 9) { const y = yAt(x) - 1.2, zf = zc + outer * hw; gb.box(x - 0.8, lo, Math.min(zf, zf + outer * 1.3), x + 0.8, y, Math.max(zf, zf + outer * 1.3), { side: 'castle', top: 'stoneLight' }, 4, 4); } // buttresses
      for (let x = x0; x < x1; x += 0.5) addCol(area, x, zc - hw, x + 0.5, zc + hw, lo, yAt(x + 0.25));
      carveTerrain(x0 - 1, zc - hw - 1, x1 + 1, zc + hw + 1, (x) => yAt(clamp(x, x0, x1)) - 0.4);
      caster(mkObb((x0 + x1) / 2, zc, 0, (x1 - x0) / 2, hw), Math.max(ya, yb) - 1);
    };
    leg(RAMP.x0, RAMP.xw, RAMP.z1, RY0, RYW, 1);
    leg(RAMP.xw, RAMP.xe, RAMP.z2, RYW, RYE, 1);
    // the turning landing, a small bastion, and the top landing into the forecourt
    const land = (x0, z0, x1, z1, y, walls) => { let lo = Infinity; for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) lo = Math.min(lo, terrainH(x, z)); lo -= 1.5;
      gb.box(x0, lo, z0, x1, y, z1, { side: 'castle', top: 'cobble' }, 4, 4); addCol(area, x0, z0, x1, z1, lo, y); carveTerrain(x0 - 1, z0 - 1, x1 + 1, z1 + 1, () => y - 0.4);
      for (const w of walls) { const [a, b, c, d] = w === 'w' ? [x0, z0, x0 + 0.6, z1] : w === 's' ? [x0, z1 - 0.6, x1, z1] : [x1 - 0.6, z0, x1, z1]; gb.box(a, y, b, c, y + 1.1, d, { side: 'castle', top: 'stoneLight' }, 4, 4); addCol(area, a, b, c, d, y, y + 1.1); }
      caster(mkObb((x0 + x1) / 2, (z0 + z1) / 2, 0, (x1 - x0) / 2, (z1 - z0) / 2), y); };
    land(RAMP.xw - 7, RAMP.z2 - hw, RAMP.xw, RAMP.z1 + hw, RYW, ['w', 's']);
    land(RAMP.xe, RAMP.z2 - hw - 3, RAMP.xe + 6, RAMP.z2 + hw, RYE, ['e', 's']);
    { const gx = RAMP.x0 - 1, y = RY0; // the outer gate: two square piers and a crenellated arch over the ramp's first metres
      for (const zz of [RAMP.z1 - hw - 1.6, RAMP.z1 + hw]) { gb.box(gx - 1.8, y - 2, zz, gx + 1.8, y + 7.5, zz + 1.6, { side: 'castle', top: 'castle' }, 4, 4); addCol(area, gx - 1.8, zz, gx + 1.8, zz + 1.6, y - 2, y + 7.5); ringMer(gx, zz + 0.8, 1.4, y + 7.5, 4); }
      gb.box(gx - 1.6, y + 4.6, RAMP.z1 - hw, gx + 1.6, y + 7.2, RAMP.z1 + hw, { side: 'castle', top: 'castle' }, 4, 4); gb.box(gx - 1.7, y + 4.4, RAMP.z1 - hw, gx + 1.7, y + 4.8, RAMP.z1 + hw, 'stoneLight', 2, 2);
      addCol(area, gx - 1.6, RAMP.z1 - hw, gx + 1.6, RAMP.z1 + hw, y + 4.4, y + 7.2); cmerZ(RAMP.z1 - hw, RAMP.z1 + hw, gx, y + 7.2);
      gb.quad('bannerRed', [gx + 1.85, y + 1.2, RAMP.z1 + hw + 1.2], [0, 0, -1], [0, 1, 0], 2.2, 4.6, 1, 1, { fixedUV: true }); }
    area.rampFoot = [RAMP.x0, RAMP.z1];
  }
  gb.xf = null;

  /* ---------- the Grand Market ---------- */
  gb.setXf(MARKET[0], MARKET[1], 0, marketPad.h);
  gb.cyl('stone', 0, 0, 3.6, 0, 0.8, 14, 3, 3);
  gb.cyl('stone', 0, 0, 3.2, 0.3, 0.8, 14, 3, 3, { inward: true });
  for (let i = 0; i < 14; i++) { const a0 = i / 14 * Math.PI * 2, a1 = (i + 1) / 14 * Math.PI * 2; const P = (r, a) => [Math.cos(a) * r, 0.8, Math.sin(a) * r]; gb.quad4('stone', P(3.2, a0), P(3.6, a0), P(3.6, a1), P(3.2, a1), [0, 0], [0.2, 0], [0.2, 0.3], [0, 0.3], [0, 1, 0]); }
  gb.disc('water', 0, 0.62, 0, 3.2, 14, 3);
  gb.cyl('stone', 0, 0, 0.45, 0.6, 2.4, 8, 2, 2);
  gb.cyl('stone', 0, 0, 1.4, 2.0, 2.35, 10, 2, 2);
  gb.disc('water', 0, 2.3, 0, 1.35, 10, 2);
  col(-3.4, -3.4, 3.4, 3.4, -1, 0.8); col(-1.4, -1.4, 1.4, 1.4, 0.8, 2.4);
  const stall = (cx, cz, dir, key) => {
    const cz0 = cz + dir * 0.6, cz1 = cz + dir * 1.3; const g0 = gy(cx, cz);
    gb.box(cx - 1.6, g0 - 0.3, Math.min(cz0, cz1), cx + 1.6, 1.0, Math.max(cz0, cz1), { side: 'wood', top: 'wood' }, 2, 2); col(cx - 1.6, Math.min(cz0, cz1), cx + 1.6, Math.max(cz0, cz1), -1, 1.0);
    for (const px of [-1.6, 1.5]) for (const pz of [-1.3, 1.2]) gb.box(cx + px, g0 - 0.3, cz + pz, cx + px + 0.12, 2.5, cz + pz + 0.12, 'woodDark', 1, 1);
    gb.quad4(key, [cx - 1.9, 2.3, cz + dir * 1.7], [cx + 1.9, 2.3, cz + dir * 1.7], [cx + 1.9, 2.7, cz - dir * 1.6], [cx - 1.9, 2.7, cz - dir * 1.6], [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]);
    col(cx - 1.9, Math.min(cz + dir * 1.7, cz - dir * 1.6), cx + 1.9, Math.max(cz + dir * 1.7, cz - dir * 1.6), 2.3, 2.75);
    const f = wp(cx - 1, cz + dir * 0.95); flowers.push([f[0], gb.xf.y + 1.0, f[1], 0.9]);
  };
  stall(-7, -8, 1, 'stallA'); stall(7, -8, 1, 'stallB'); stall(-7, 8, -1, 'stallC'); stall(7, 8, -1, 'stallA');
  area.stalls = [wp(-7, -8.6), wp(7, -8.6)];
  gb.xf = null;
  { // the Market Belfry
    const bx = MARKET[0] - 17, bz = MARKET[1] - 12; gb.setXf(bx, bz, 0.35, marketPad.h);
    gb.box(-4, -1, -4, 4, 40, 4, { side: 'stoneLight', top: null }, 4, 4); col(-4, -4, 4, 4, -1, 40);
    for (const [x, z] of [[-4, -4], [3.4, -4], [-4, 3.4], [3.4, 3.4]]) gb.box(x, 40, z, x + 0.6, 45, z + 0.6, 'stoneLight', 2, 2);
    gb.box(-4.3, 45, -4.3, 4.3, 45.6, 4.3, { side: 'woodDark', top: null, bottom: 'woodDark' }, 2, 2); gb.tint = [0.95, 0.97, 1.05]; hipRoof(gb, 'roofSlate', -4.3, -4.3, 4.3, 4.3, 45.6, 19, 0.4); gb.tint = null;
    col(-4.3, -4.3, 4.3, 4.3, 45, 50); col(-2.4, -2.4, 2.4, 2.4, 50, 57); col(-1, -1, 1, 1, 57, 64.5);
    gb.box(-1, 41, -1, 1, 43.2, 1, { side: 'iron', top: 'iron', bottom: 'iron' }, 1, 1);
    for (const f of ['n', 's', 'e', 'w']) { const fi = faceInfo({ x0: -4, z0: -4, x1: 4, z1: 4 }, f); for (const y of [12, 20, 28, 35]) faceQuad(gb, y > 30 ? 'winA' : 'winB', fi, 3.4, y, 1.2, 2, 0.03); }
    faceQuad(gb, 'doorDark', faceInfo({ x0: -4, z0: -4, x1: 4, z1: 4 }, 's'), 3.3, 0, 1.4, 2.5, 0.05);
    casterL(-4, -4, 4, 4, 64); gb.xf = null;
  }
  const spray = makeBillboard(simpleSprite('spray', 2).tex[0], 1.3, 2.4, { transparent: true, opacity: 0.8 }); spray.position.set(MARKET[0], marketPad.h + 2.2, MARKET[1]); area.scene.add(spray); area.bbs.push(spray);
  area.anim.push((dt, t) => { spray.material.map = simpleSprite('spray', 2).tex[Math.floor(t * 6) % 2]; });

  /* ---------- the Lysandus Memorial ---------- */
  gb.setXf(MEMORIAL[0], MEMORIAL[1], 0, memPad.h);
  gb.box(-1.8, -0.3, -1.8, 1.8, 0.5, 1.8, { side: 'stone', top: 'stone' }, 2, 2); gb.box(-1.2, 0.5, -1.2, 1.2, 2.0, 1.2, { side: 'stoneLight', top: 'stoneLight' }, 2, 2); col(-1.8, -1.8, 1.8, 1.8, -1, 0.5); col(-1.2, -1.2, 1.2, 1.2, 0.5, 6.4);
  for (const [x, z] of [[-2.6, 0], [2.6, 0], [0, 2.6], [0, -2.6]]) { const p = wp(x, z); flower(p[0], p[1]); }
  gb.xf = null;
  { const st = makeBillboard(simpleSprite('kingstatue').tex[0], 2.2, 4.4); st.position.set(MEMORIAL[0], memPad.h + 2.0, MEMORIAL[1]); area.scene.add(st); area.bbs.push(st); area.tintMats.push(st.material); }
  area.memorial = { x: MEMORIAL[0], z: MEMORIAL[1] };

  /* ---------- Temple of Arkay with its spire, the graveyard on the slope and the old mausoleum ---------- */
  {
    gb.setXf(TEMPLE.x, TEMPLE.z, TEMPLE.ang, templePad.h);
    const fp = { x0: -10, z0: -13, x1: 10, z1: 13 };
    const door = makeBuilding(area, gb, rng, { fp, h: 12, style: 'stoneLight', roof: 'gable', alongX: false, roofKey: 'roofSlate', doorT: 0.5, doorW: 2.2, doorH: 3.4, sign: 'temple', chimney: 0, found: 1.5 });
    gb.box(1, -1.5, -15, 12, 48, -4, { side: 'stoneLight', top: null }, 4, 4); hipRoof(gb, 'roofCopper', 1, -15, 12, -4, 48, 34, 0.3);
    for (const [x, z] of [[1, -15], [11.2, -15], [1, -4.8], [11.2, -4.8]]) { gb.box(x, 48, z, x + 0.8, 53, z + 0.8, 'stoneLight', 2, 2); }
    col(1, -15, 12, -4, -1.5, 48); col(3, -13, 10, -6, 48, 60); col(5.5, -10.5, 7.5, -8.5, 60, 82); casterL(1, -15, 12, -4, 70); casterL(-10, -13, 10, 13, 19);
    for (const y of [16, 24, 32, 40]) gb.quad('winA', [5.9, y, -3.97], [1, 0, 0], [0, 1, 0], 1.2, 2.4, 1, 1, { fixedUV: true });
    for (const x of [-4.5, 4.5]) { const p = wp(x, 15.5); tree('cypress', p[0], p[1], 1.1); }
    registerBuilding(area, { id: 'temple', type: 'temple', name: 'The Temple of Arkay', district: 'temple', fp, poly: footprintPoly(gb.xf, fp), door, owner: { name: 'High Priest Odric Maleveil', gender: 'm', look: LOOKS.priest } });
    gb.xf = null;
    const g = GRAVE;
    drapePatch(gb, 'gGrass', null, g.x0, g.z0, g.x1, g.z1, { cell: 4, lift: 0.05, tw: 4 });
    const fenceRun = (x0, z0, x1, z1) => { const L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 3)); for (let k = 0; k < n; k++) { const ax = lerp(x0, x1, k / n), az = lerp(z0, z1, k / n), bx = lerp(x0, x1, (k + 1) / n), bz = lerp(z0, z1, (k + 1) / n); const y = Math.min(H(ax, az), H(bx, bz)); const qx0 = Math.min(ax, bx) - (ax === bx ? 0.08 : 0), qx1 = Math.max(ax, bx) + (ax === bx ? 0.08 : 0), qz0 = Math.min(az, bz) - (az === bz ? 0.08 : 0), qz1 = Math.max(az, bz) + (az === bz ? 0.08 : 0); gb.box(qx0, y - 0.3, qz0, qx1, y + 1.0, qz1, { side: 'woodDark', top: 'woodDark' }, 2, 2); addCol(area, qx0, qz0, qx1, qz1, y - 1, y + 1.0); } };
    fenceRun(g.x0, g.z0, g.x1, g.z0); fenceRun(g.x0, g.z1, g.x1, g.z1); fenceRun(g.x0, g.z0, g.x0, g.z1);
    fenceRun(g.x1, g.z0, g.x1, 74); fenceRun(g.x1, 79, g.x1, g.z1);
    for (let x = g.x0 + 2.5; x < g.x1 - 2; x += 3.2) for (let z = g.z0 + 3; z < g.z1 - 1.5; z += 3.6) {
      if (x > -150 && x < -135 && z > 79 && z < 94) continue; if (x > g.x1 - 8 && z > 72 && z < 81) continue;
      if (rng.chance(0.2)) continue;
      const hh = rng.range(0.8, 1.25), jx = rng.range(-0.4, 0.4); const y = H(x + jx, z);
      gb.box(x + jx - 0.32, y - 0.3, z - 0.09, x + jx + 0.32, y + hh, z + 0.09, { side: 'stone', top: 'stone' }, 1, 1); addCol(area, x + jx - 0.32, z - 0.12, x + jx + 0.32, z + 0.12, y - 1, y + hh);
      if (rng.chance(0.25)) flower(x + jx, z + 0.5, 0.6);
    }
    tree('dead', g.x0 + 3, g.z1 - 3, 1); tree('dead', g.x1 - 3, g.z0 + 4, 0.9); tree('cypress', g.x0 + 2, g.z0 + 8, 1); tree('cypress', g.x1 - 2, 83, 1);
    gb.setXf(-143.5, 86.5, Math.PI / 2, mausPad.h);
    const mfp = { x0: -4.5, z0: -4.5, x1: 4.5, z1: 4.5 };
    const mdoor = makeBuilding(area, gb, rng, { fp: mfp, h: 4.6, style: 'stone', roof: 'gable', roofKey: 'roofSlate', doorT: 0.5, doorKey: 'doorDark', chimney: 0, noWin: () => true, pitch: 0.5, found: 1 });
    registerBuilding(area, { id: 'mausoleum', type: 'mausoleum', name: 'The Old Mausoleum', district: 'temple', fp: mfp, poly: footprintPoly(gb.xf, mfp), door: mdoor, owner: { name: 'the dead', gender: 'm' } });
    gb.xf = null;
    area.graveyard = g;
  }
  /* ---------- House of Mercy ---------- */
  {
    gb.setXf(HOSPICE.x, HOSPICE.z, HOSPICE.ang, hospPad.h);
    const fp = { x0: -11, z0: -7, x1: 11, z1: 7 };
    const door = makeBuilding(area, gb, rng, { fp, stories: 2, style: 'stoneLight', roof: 'gable', roofKey: 'roofSlate', doorT: 0.5, doorW: 2, doorH: 2.8, sign: 'hospice', chimney: 1, found: 1 }); casterL(-11, -7, 11, 7, 11);
    if (door.chimney) chimneys.push({ p: door.chimney, pri: 1 });
    for (const x of [-12.5, 12.5]) for (const z of [-3, 1, 5]) { const p = wp(x, z); flower(p[0], p[1]); }
    const hl = { ...LOOKS.priest, robe: '#3a6a4a', trim: '#e8e0c8', hair: '#6a4526', hairStyle: 2 };
    registerBuilding(area, { id: 'hospice', type: 'hospice', name: 'The House of Mercy', district: 'market', fp, poly: footprintPoly(gb.xf, fp), door, owner: { name: 'Mother Ysolde Carrard', gender: 'f', look: hl } });
    gb.xf = null;
  }
  /* ---------- Mages Guild and its blue-roofed tower ---------- */
  {
    gb.setXf(MAGES.x, MAGES.z, MAGES.ang, magesPad.h);
    const fp = { x0: -12, z0: -7.5, x1: 12, z1: 7.5 };
    const door = makeBuilding(area, gb, rng, { fp, h: 9.9, style: 'stone', roof: 'hip', roofKey: 'roofSlate', roofTint: [0.9, 0.95, 1.1], doorT: 0.5, doorW: 1.8, doorH: 3, sign: 'mages', found: 1 });
    gb.cyl('stone', 6, -12.5, 4.5, -2, 30, 12, 4, 4); gb.tint = [0.84, 0.92, 1.12]; gb.cone('roofSlate', 6, -12.5, 5.4, 30, 13, 12, 3); gb.tint = null; casterL(1.6, -16.9, 10.4, -8.1, 38); casterL(-12, -7.5, 12, 7.5, 14);
    col(1.6, -16.9, 10.4, -8.1, -2, 30); col(3, -15.5, 9, -9.5, 30, 35); col(4.8, -13.7, 7.2, -11.3, 35, 43);
    for (const a of [0.5, 2.1, 3.7, 5.3]) for (const y of [14, 22]) gb.quad('winA', [6 + Math.cos(a) * 4.53 - Math.sin(a) * 0.4, y, -12.5 + Math.sin(a) * 4.53 + Math.cos(a) * 0.4], [Math.sin(a), 0, -Math.cos(a)], [0, 1, 0], 0.8, 1.4, 1, 1, { fixedUV: true });
    for (const [x, z] of [[-8, -9.5], [-4, -10]]) { const p = wp(x, z); trees.bush.push([p[0], H(p[0], p[1]), p[1], 1]); }
    { const p = wp(-10, 9.5); tree('cypress', p[0], p[1], 1); }
    { const p = wp(6, -12.5); glows.push([p[0], magesPad.h + 30.5, p[1], 1.6]); }
    registerBuilding(area, { id: 'mages', type: 'mages', name: 'The Mages Guild', district: 'kingsward', fp, poly: footprintPoly(gb.xf, fp), door, owner: { name: 'Magistrix Celestine Vautrin', gender: 'f', look: LOOKS.mage } });
    gb.xf = null;
  }
  /* ---------- Fighters Guild with its training yard ---------- */
  {
    gb.setXf(FIGHTERS.x, FIGHTERS.z, FIGHTERS.ang, fightPad.h);
    const fp = { x0: -12, z0: -7.5, x1: 12, z1: 7.5 };
    const door = makeBuilding(area, gb, rng, { fp, h: 8, style: 'stone', roof: 'flat', doorT: 0.5, doorW: 2, doorH: 3, sign: 'fighters', found: 1 }); casterL(-12, -7.5, 12, 7.5, 8.9);
    for (const x of [-6, 6]) gb.quad('bannerGuild', [x - 1, 3.5, 7.6], [1, 0, 0], [0, 1, 0], 2, 4, 1, 1, { fixedUV: true });
    gb.quad('gDirt', [-12, 0.04, -7.5], [1, 0, 0], [0, 0, -1], 24, 18, 3, 3);
    const fz = -25.5;
    gb.box(-12, -0.5, fz, 12, 1.0, fz + 0.15, { side: 'woodDark', top: 'woodDark' }, 2, 2); col(-12, fz, 12, fz + 0.15, -1, 1.0);
    for (const x of [-12, 11.85]) { gb.box(x, -0.5, fz, x + 0.15, 1.0, -7.5, { side: 'woodDark', top: 'woodDark' }, 2, 2); col(x, fz, x + 0.15, -7.5, -1, 1.0); }
    for (const x of [-8, -3, 2, 7]) { const p = wp(x, -16); dummies.push([p[0], fightPad.h, p[1], 1]); addCol(area, p[0] - 0.3, p[1] - 0.3, p[0] + 0.3, p[1] + 0.3, fightPad.h - 1, fightPad.h + 1.8); }
    registerBuilding(area, { id: 'fighters', type: 'fighters', name: 'The Fighters Guild', district: 'forges', fp, poly: footprintPoly(gb.xf, fp), door, owner: { name: 'Guildmaster Ulfgar Stone-Arm', gender: 'm', look: LOOKS.fighter } });
    area.fightersYard = footprintPoly(gb.xf, { x0: -12, z0: fz, x1: 12, z1: -7.5 });
    gb.xf = null;
  }
  /* ---------- the Bell Tower with its green copper roof ---------- */
  {
    gb.setXf(BELL[0], BELL[1], 0.3, bellPad.h);
    gb.box(-3.5, -1, -3.5, 3.5, 24, 3.5, { side: 'stone', top: 'stone' }, 4, 4); col(-3.5, -3.5, 3.5, 3.5, -1, 24);
    for (const [x, z] of [[-3.5, -3.5], [3, -3.5], [-3.5, 3], [3, 3]]) gb.box(x, 24, z, x + 0.5, 28.5, z + 0.5, 'stone', 2, 2);
    gb.box(-3.7, 28.5, -3.7, 3.7, 29, 3.7, { side: 'woodDark', top: null, bottom: 'woodDark' }, 2, 2); hipRoof(gb, 'roofRed', -3.7, -3.7, 3.7, 3.7, 29, 7, 0.5); casterL(-3.7, -3.7, 3.7, 3.7, 34);
    col(-3.7, -3.7, 3.7, 3.7, 28.5, 31); col(-2.2, -2.2, 2.2, 2.2, 31, 33.5); col(-1, -1, 1, 1, 33.5, 36);
    gb.box(-0.9, 25.2, -0.9, 0.9, 27.2, 0.9, { side: 'iron', top: 'iron', bottom: 'iron' }, 1, 1);
    for (const f of ['n', 's', 'e', 'w']) { const fi = faceInfo({ x0: -3.5, z0: -3.5, x1: 3.5, z1: 3.5 }, f); for (const y of [7, 13, 19]) faceQuad(gb, 'winB', fi, 3.05, y, 0.9, 1.6, 0.03); }
    faceQuad(gb, 'doorDark', faceInfo({ x0: -3.5, z0: -3.5, x1: 3.5, z1: 3.5 }, 's'), 2.8, 0, 1.4, 2.5, 0.05);
    for (const [x, z] of [[-6, 6], [6, -6]]) { const p = wp(x, z); trees.bush.push([p[0], H(p[0], p[1]), p[1], 1]); }
    gb.xf = null;
    area.bellTower = { x: BELL[0], z: BELL[1] };
  }
  /* ---------- the Queen's Garden ---------- */
  {
    const [gx, gz] = GARDEN; const R = 20, N = 20, GH = gardenPad.h;
    drapeDisc(gb, 'gGrass', gx, gz, 21, { segs: 20, rings: 2, lift: 0.04, tw: 4 });
    for (let i = 0; i < N; i++) {
      const a0 = i / N * Math.PI * 2, a1 = (i + 1) / N * Math.PI * 2; const am = (a0 + a1) / 2;
      if (Math.abs(Math.atan2(Math.sin(am), Math.cos(am))) < 0.25 || Math.abs(am - Math.PI / 2) < 0.25) continue; // east and south entrances
      const ax = gx + Math.cos(a0) * R, az = gz + Math.sin(a0) * R, bx = gx + Math.cos(a1) * R, bz = gz + Math.sin(a1) * R;
      const L = Math.hypot(bx - ax, bz - az); gb.setXf(ax, az, Math.atan2(-(bz - az) / L, (bx - ax) / L), GH);
      gb.box(0, -0.4, -0.45, L + 0.2, 1.4, 0.45, { side: 'hedge', top: 'hedge' }, 2, 2); col(0, -0.45, L + 0.2, 0.45, -1, 1.4); gb.xf = null;
    }
    gb.cyl('stone', gx, gz, 5.6, GH - 0.2, GH + 0.5, 16, 2, 2); gb.cyl('stone', gx, gz, 5.1, GH + 0.1, GH + 0.5, 16, 2, 2, { inward: true });
    for (let i = 0; i < 16; i++) { const a0 = i / 16 * Math.PI * 2, a1 = (i + 1) / 16 * Math.PI * 2; const P = (r, a) => [gx + Math.cos(a) * r, GH + 0.5, gz + Math.sin(a) * r]; gb.quad4('stone', P(5.1, a0), P(5.6, a0), P(5.6, a1), P(5.1, a1), [0, 0], [0.2, 0], [0.2, 0.3], [0, 0.3], [0, 1, 0]); }
    gb.disc('water', gx, GH + 0.32, gz, 5.1, 16, 3); addCol(area, gx - 5.3, gz - 5.3, gx + 5.3, gz + 5.3, GH - 1, GH + 0.5);
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + 0.3; tree(i % 2 ? 'oak' : 'cypress', gx + Math.cos(a) * 13.5, gz + Math.sin(a) * 13.5, rng.range(0.9, 1.15)); }
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; flower(gx + Math.cos(a) * 8, gz + Math.sin(a) * 8); }
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; const x = gx + Math.cos(a) * 17.5, z = gz + Math.sin(a) * 17.5; trees.bush.push([x, H(x, z), z, 1.1]); }
    for (const a of [0.8, 2.4, 3.9, 5.5]) { const bx = gx + Math.cos(a) * 9.5, bz = gz + Math.sin(a) * 9.5; gb.setXf(bx, bz, -a + Math.PI / 2, GH); gb.box(-0.9, 0.4, -0.25, 0.9, 0.5, 0.25, { side: 'wood', top: 'wood' }, 1, 1); gb.box(-0.8, 0, -0.1, -0.7, 0.4, 0.1, 'woodDark'); gb.box(0.7, 0, -0.1, 0.8, 0.4, 0.1, 'woodDark'); col(-0.9, -0.25, 0.9, 0.25, -1, 0.5); gb.xf = null; }
    for (const a of [0.9, 2.5, 4.0, 5.6]) glows.push([gx + Math.cos(a) * 18, GH + 2.4, gz + Math.sin(a) * 18, 0.8]);
  }
  /* ---------- Beggar's Well and the Fish Market ---------- */
  {
    gb.setXf(WELL[0], WELL[1], 0, wellPad.h);
    gb.cyl('stone', 0, 0, 1.2, -0.3, 0.9, 10, 2, 2, { top: 'iron' }); col(-1.2, -1.2, 1.2, 1.2, -1, 0.9);
    for (const s of [-1, 1]) gb.box(s * 1.1 - 0.08, 0, -0.08, s * 1.1 + 0.08, 2.4, 0.08, 'woodDark', 1, 1);
    gableRoof(gb, 'roofThatch', 'woodDark', -1.3, -0.8, 1.3, 0.8, 2.4, 0.7, 0.2, true); col(-1.5, -1, 1.5, 1, 2.3, 3.1);
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + 0.4; const px = Math.cos(a) * 5.5, pz = Math.sin(a) * 5.5; gb.cyl('woodDark', px, pz, 0.38, -0.3, 1.0, 8, 1, 1, { top: 'woodDark' }); col(px - 0.38, pz - 0.38, px + 0.38, pz + 0.38, -1, 1.0); }
    gb.setXf(FISH[0], FISH[1], 0, fishPad.h);
    stall(-4, -2.5, 1, 'stallB'); stall(4, -2.5, 1, 'stallC'); stall(0, 4, -1, 'stallB');
    for (const [x, z] of [[-6.5, 3], [6.5, 3.5]]) { gb.cyl('woodDark', x, z, 0.38, -0.3, 1.0, 8, 1, 1, { top: 'woodDark' }); col(x - 0.38, z - 0.38, x + 0.38, z + 0.38, -1, 1.0); }
    area.stalls.push(wp(-4, -3.1));
    gb.xf = null;
  }

  /* ---------- harbour: piers, a ship, the breakwater and lighthouse ---------- */
  const DECK = QUAY_H - 0.1;
  for (const px of PIERS) {
    gb.box(px - 3, SEA - 1.2, SHORE, px + 3, DECK, PIER_END, { side: 'woodDark', top: 'wood' }, 2, 2); addCol(area, px - 3, SHORE, px + 3, PIER_END, SEA - 3, DECK);
    for (let z = SHORE + 2; z < PIER_END; z += 6) for (const x of [px - 3.1, px + 2.85]) gb.box(x, SEA - 1.2, z, x + 0.25, DECK + 0.8, z + 0.25, 'woodDark', 1, 1);
    glows.push([px + 2.9, DECK + 1.5, PIER_END - 1, 0.9]);
  }
  // two stone moles enclose the harbour; the lighthouse stands on the eastern head
  for (const [mx, end, headR] of [[WMOLE, 202, 6], [BREAK, 208, 8]]) {
    gb.box(mx - 3.5, SEA - 2, SHORE, mx + 3.5, DECK - 0.1, end, { side: 'stone', top: 'flag' }, 3, 3); addCol(area, mx - 3.5, SHORE, mx + 3.5, end, SEA - 3, DECK - 0.1);
    gb.cyl('stone', mx, end + headR - 2, headR, SEA - 2, DECK - 0.1, 16, 3, 3, { top: 'flag' }); addCol(area, mx - headR * 0.8, end - 2, mx + headR * 0.8, end + headR * 1.7 - 2, SEA - 3, DECK - 0.1);
    for (let z = SHORE + 6; z < end; z += 3.4) for (const x of [mx - 3.3, mx + 2.9]) gb.box(x, DECK - 0.1, z, x + 0.4, DECK + 0.55, z + 1.6, 'stone', 2, 2);
  }
  { // merchant ship moored at the middle pier
    const o = PIERS[1] + 1;
    gb.box(o + 4.5, SEA - 0.2, 160, o + 10.5, SEA + 2.6, 190, { side: 'woodDark', top: 'wood' }, 2, 2); addCol(area, o + 4.5, 160, o + 10.5, 190, SEA - 3, SEA + 2.6);
    gb.box(o + 5, SEA + 2.6, 184, o + 10, SEA + 4.6, 190, { side: 'woodDark', top: 'wood' }, 2, 2); addCol(area, o + 5, 184, o + 10, 190, SEA + 2.6, SEA + 4.6);
    gb.box(o + 7.3, SEA + 2.6, 173, o + 7.7, SEA + 17, 173.4, 'woodDark', 1, 1); gb.quad('sail', [o + 4.2, SEA + 6.1, 173.6], [1, 0, 0], [0, 1, 0], 6.8, 9, 3, 3);
    gb.box(o + 7.3, SEA + 2.6, 163, o + 7.6, SEA + 11, 163.3, 'woodDark', 1, 1); gb.quad('sail', [o + 5.3, SEA + 5.1, 163.5], [1, 0, 0], [0, 1, 0], 4.6, 5, 3, 3);
  }
  const anchored = (x, z, ang, s, set = false) => { // a cog riding at anchor, sails furled on their yards unless just arriving
    s *= 0.7; gb.setXf(x, z, ang, SEA);
    gb.box(-3 * s, -0.4, -13 * s, 3 * s, 2.6 * s, 13 * s, { side: 'woodDark', top: 'wood' }, 2, 2); gb.box(-2.6 * s, 2.6 * s, 8 * s, 2.6 * s, 4.6 * s, 13 * s, { side: 'woodDark', top: 'wood' }, 2, 2);
    gb.box(-0.2, 2.6 * s, -1, 0.2, 21 * s, -0.6, 'woodDark', 1, 1); gb.box(-0.15, 2.6 * s, -9 * s, 0.15, 13 * s, -8.7 * s, 'woodDark', 1, 1);
    gb.box(-3 * s, 2.6 * s, 11.5 * s, 3 * s, 3.2 * s, 13.2 * s, 'woodDark', 1, 1); // stern rail
    if (set) { gb.quad('sail', [-3.6 * s, 8 * s, -0.5], [1, 0, 0], [0, 1, 0], 7.2 * s, 10 * s, 3, 3, { double: true }); gb.quad('sail', [-2.4 * s, 6 * s, -8.6 * s], [1, 0, 0], [0, 1, 0], 4.8 * s, 6 * s, 3, 3, { double: true }); }
    else for (const [zc, y, w] of [[-0.8, 18.5 * s, 4.2 * s], [-8.85 * s, 11.5 * s, 2.8 * s]]) { gb.box(-w, y, zc - 0.3, w, y + 0.3, zc + 0.3, 'woodDark', 1, 1); gb.box(-w * 0.9, y - 0.7, zc - 0.25, w * 0.9, y, zc + 0.25, 'sail', 1, 1); } // yard and furled sail
    col(-3 * s, -13 * s, 3 * s, 13 * s, -3, 2.6 * s); col(-2.6 * s, 8 * s, 2.6 * s, 13 * s, 2.6 * s, 4.6 * s); gb.xf = null;
  };
  anchored(-52, 206, 0.35, 1.9); anchored(70, 214, -0.25, 2.1); anchored(172, 200, 0.5, 2.0); anchored(214, 226, -0.2, 1.8); anchored(160, 250, 1.1, 1.6, true); anchored(240, 272, 0.3, 1.4);
  anchored(PIERS[0] + 9, 178, 0, 1.0); anchored(PIERS[2] - 9, 176, 0.02, 1.05); // moored alongside the piers
  for (const [bx, bz] of [[PIERS[2] + 3.4, 166], [PIERS[2] + 3.6, 176], [PIERS[0] - 4.2, 170]]) { gb.box(bx, SEA - 0.2, bz, bx + 1.6, SEA + 0.45, bz + 4.2, { side: 'woodDark', top: 'wood' }, 1, 1); addCol(area, bx, bz, bx + 1.6, bz + 4.2, SEA - 2, SEA + 0.45); }
  gb.tint = [1.15, 1.15, 1.12]; gb.cyl('plaster', BREAK, 214, 4.5, DECK - 0.2, 32, 14, 4, 4); gb.tint = null; gb.cyl('iron', BREAK, 214, 3.2, 32, 35, 10, 2, 2); gb.cone('roofRed', BREAK, 214, 4.4, 35, 5, 12, 3);
  addCol(area, BREAK - 4.4, 209.6, BREAK + 4.4, 218.4, SEA - 3, 32); addCol(area, BREAK - 3.2, 210.8, BREAK + 3.2, 217.2, 32, 37); addCol(area, BREAK - 1.4, 212.6, BREAK + 1.4, 215.4, 37, 40); caster(mkObb(BREAK, 214, 0, 4.5, 4.5), 40);
  for (let y = 5; y < 31; y += 5) gb.quad('winB', [BREAK - 0.45, y, 218.53], [1, 0, 0], [0, 1, 0], 0.9, 1.4, 1, 1, { fixedUV: true });
  glows.push([BREAK, 32.2, 214, 6]);
  area.lighthouse = { x: BREAK, z: 214 };

  /* ---------- lots along every street ---------- */
  // Everything already standing blocks new lots
  for (const b of G.buildings) if (b.poly) { const p = b.poly; const cx = (p[0][0] + p[2][0]) / 2, cz = (p[0][1] + p[2][1]) / 2; block(mkObb(cx, cz, Math.atan2(p[1][0] - p[0][0], p[1][1] - p[0][1]) - Math.PI / 2, Math.hypot(p[1][0] - p[0][0], p[1][1] - p[0][1]) / 2 + 0.5, Math.hypot(p[3][0] - p[0][0], p[3][1] - p[0][1]) / 2 + 0.5)); }
  const fits = (o) => {
    for (const [cx, cz] of obbCorners(o)) if (!insideCity(cx, cz, 5)) return false;
    const bb = obbAabb(o);
    for (const r of roadHash.query(...bb)) if (obbOverlap(o, r.o)) return false;
    for (const b of bldHash.query(bb[0] - 3, bb[1] - 3, bb[2] + 3, bb[3] + 3)) if (obbOverlap(o, b.o, 0.25)) return false;
    return !zoneObb(o);
  };
  const lots = [];
  const lotRng = new RNG(777);
  const chains = roadChains(net, roads).sort((a, b) => a.lvl - b.lvl || b.len - a.len);
  for (const ch of chains) {
    for (const side of [1, -1]) {
      if (ch.quay && side === (chainAt(ch, 1).ux > 0 ? 1 : -1)) continue; // nothing on the water side of the quay
      let t = lotRng.range(0, 2);
      while (t < ch.len) {
        const q0 = chainAt(ch, t); const dist = districtAt(q0.x, q0.z); const K = DK[dist.kind];
        let placed = false;
        // try the full lot first, then shallower and narrower ones, then set back from a curving street
        const TRY = [[1, 1, 0], [1, 0.75, 0], [1, 0.55, 0], [0.75, 1, 0], [0.75, 0.7, 0], [0.75, 0.5, 0], [0.55, 0.8, 0], [0.55, 0.5, 0], [0.75, 0.6, 1.2], [0.55, 0.5, 1.2], [0.45, 0.42, 0.6]];
        const w0 = lotRng.range(...K.w), d0 = lotRng.range(...K.d), set0 = lotRng.range(...K.set);
        for (let tries = 0; tries < TRY.length && !placed; tries++) {
          const [sw, sd, back] = TRY[tries];
          const w = Math.max(4.2, w0 * sw), d = Math.max(4.2, d0 * sd), set = set0 * (sd < 1 ? 0.5 : 1) + back;
          const along = t + w / 2; if (along > ch.len + 1.5) break;
          const q = chainAt(ch, along); const nx = -q.uz * side, nz = q.ux * side; const cx = q.x, cz = q.z;
          const base = Math.atan2(-nx, -nz); const j = K.jit ? lotRng.range(-K.jit, K.jit) : 0;
          const near = ch.w / 2 + 0.35 + back;
          const front = ch.w / 2 + 0.35 + set + Math.abs(Math.sin(j)) * w / 2;
          const depth = front + d - near;
          const claim = mkObb(cx + nx * (near + depth / 2), cz + nz * (near + depth / 2), base, w / 2, depth / 2);
          const o = mkObb(cx + nx * (front + d / 2), cz + nz * (front + d / 2), base + j, w / 2, d / 2);
          if (!fits(claim)) continue;
          // the ground under the house: too steep a plot stays empty
          const hs = obbCorners(o).map(([x, z]) => H(x, z)); const lo = Math.min(...hs), hi = Math.max(...hs);
          if (hi - lo > (K === DK.noble ? 8 : 5.5)) continue;
          const doorG = H(cx + nx * front, cz + nz * front);
          const floor = Math.max(doorG + 0.05, hi - 1.5);
          const it = { o: claim }; bldHash.add(it, obbAabb(claim));
          lots.push({ o, claim, K, dist, w, d, set: front - ch.w / 2 - 0.2, lvl: ch.lvl, mat: ch.mat, seed: lotRng.int(1, 1e9), floor, found: floor - lo, steps: floor - doorG });
          t += w + lotRng.range(...K.gap); placed = true;
        }
        if (!placed) t += 1.5;
      }
    }
  }
  // shops go where the quarter wants them, on its busiest streets first
  const WANT = { market: ['tavern', 'general', 'alchemist', 'tavern', 'general'], forges: ['weaponsmith', 'armorer', 'weaponsmith', 'armorer', 'tavern'], docks: ['tavern', 'general', 'tavern'], temple: ['alchemist', 'general'], kingsward: ['tavern', 'alchemist'], warrens: ['tavern'], tanners: ['general', 'tavern'] };
  for (const [did, types] of Object.entries(WANT)) {
    const D = DISTRICTS.find(q => q.id === did); const [sx, sz] = D.seeds[0];
    for (const type of types) {
      const minW = D.kind === 'slum' ? 5.5 : 7.5;
      const cands = lots.filter(l => l.dist === D && !l.type && l.w >= minW).sort((a, b) => (a.lvl - b.lvl) * 25 + Math.hypot(a.o.x - sx, a.o.z - sz) - Math.hypot(b.o.x - sx, b.o.z - sz));
      const pick = cands.find(l => !lots.some(m => m.type === type && Math.hypot(m.o.x - l.o.x, m.o.z - l.o.z) < 45)) || cands[0];
      if (pick) pick.type = type;
    }
  }
  for (const l of lots) if (!l.type) {
    const hr = new RNG(l.seed);
    if (l.dist.id === 'docks' && l.w >= 11 && hr.chance(0.5)) l.type = 'warehouse';
    else if (l.K !== DK.market && l.K !== DK.harbor && hr.chance(0.05)) l.type = 'garden';
    else l.type = 'house';
  }
  const FIXED_NAMES = { warrens: "The Rat's Nest", kingsward: 'The Gilded Griffon', docks: 'The Salty Mudcrab' };
  const usedNames = new Set();
  for (const l of lots) {
    const hr = new RNG(l.seed); const K = l.K; const type = l.type;
    gb.setXf(l.o.x, l.o.z, l.o.ang, l.floor);
    if (type === 'garden') { // an empty plot: a tree, a bush, some flowers
      tree(hr.pick(['oak', 'oak', 'cypress']), l.o.x, l.o.z, hr.range(0.9, 1.2)); const p = wp(l.w / 2 - 1, l.d / 2 - 1); trees.bush.push([p[0], H(p[0], p[1]), p[1], 1]); const f = wp(-l.w / 2 + 1, 0); flower(f[0], f[1]);
      gb.xf = null; continue;
    }
    const fp = { x0: -l.w / 2, z0: -l.d / 2, x1: l.w / 2, z1: l.d / 2 };
    const shop = type !== 'house' && type !== 'warehouse';
    let stories = hr.pick(K.stories); if (shop && K !== DK.slum) stories = Math.max(2, stories);
    if (Math.hypot(l.o.x - MARKET[0], l.o.z - MARKET[1]) < 85 && K !== DK.slum) stories = Math.min(4, stories + 1); // the core stands taller
    let style = hr.pick(K.styles); if (type === 'weaponsmith' || type === 'armorer') style = hr.pick(['stone', 'brick']);
    const roofKey = stories === 1 && K.roofs.includes('roofThatch') ? hr.pick(K.roofs) : hr.pick(K.roofs.filter(r => r !== 'roofThatch'));
    const tb = hr.pick(K.roofTint), vv = hr.range(0.92, 1.06); const roofTint = [tb[0] * vv, tb[1] * vv, tb[2] * vv];
    const alongX = l.w > l.d * 1.1 ? true : l.w < l.d * 0.9 ? false : hr.chance(0.5);
    const spec = { fp, stories, style, roof: hr.chance(K.hip) ? 'hip' : 'gable', roofKey, roofTint, alongX, plinth: style.startsWith('timber') && hr.chance(K.plinth), jetty: style.startsWith('timber') && stories >= 2 && hr.chance(K.jetty), sign: shop ? type : null, found: l.found, steps: l.steps, wealth: K.wealth, foundKey: K === DK.noble ? 'stoneLight' : 'stone', chimney: type === 'tavern' || type === 'weaponsmith' || type === 'armorer' ? 1 : 0.45 };
    if (type === 'warehouse') Object.assign(spec, { h: stories * 3.6 + 0.6, roof: 'gable', alongX: true, doorW: 2.6, doorH: 3.2, doorKey: 'doorDark', winRate: 0.35, jetty: false, style: hr.pick(['wood', 'timber2', 'brick']), roofKey: 'roofBrown', roofTint: [0.7, 0.66, 0.62], chimney: 0 });
    const door = makeBuilding(area, gb, hr, spec); caster(l.o, l.floor + door.roofTop);
    { const tc = { slum: 0.55, poor: 0.45, harbor: 0.25, crafts: 0.2, temple: 0.3, market: 0.08, noble: 0 }[K === DK.slum ? 'slum' : K === DK.poor ? 'poor' : K === DK.harbor ? 'harbor' : K === DK.crafts ? 'crafts' : K === DK.temple ? 'temple' : K === DK.market ? 'market' : 'noble'];
      for (const [ax, az, bx, bz, ox, oz] of [[-l.w / 2, -l.d / 2, l.w / 2, -l.d / 2, 0, -1], [-l.w / 2, -l.d / 2, -l.w / 2, l.d / 2, -1, 0], [l.w / 2, -l.d / 2, l.w / 2, l.d / 2, 1, 0]]) {
        const n = Math.floor(Math.hypot(bx - ax, bz - az) / 1.4); for (let k = 0; k <= n; k++) { if (hr.next() > tc) continue; const t = k / Math.max(1, n); const p = wp(lerp(ax, bx, t) + ox * 0.35, lerp(az, bz, t) + oz * 0.35); tufts.push([p[0], H(p[0], p[1]), p[1], 0.7 + hr.next() * 0.5]); } } }
    // the street's paving runs right up to the house fronts in the busy quarters; elsewhere a path leads from the door to the street
    if (l.set > 0.12 && l.mat) {
      const dense = K === DK.market || K === DK.crafts || K === DK.harbor || K === DK.temple, zf = l.d / 2 - 0.1, ze = l.d / 2 + l.set + 0.4;
      if (dense && l.mat !== 'rDirt' && l.mat !== 'rMud') drapePatch(gb, l.mat, gb.xf, -l.w / 2 - 0.7, zf, l.w / 2 + 0.7, ze, { cell: 2, lift: 0.05 });
      else if (l.set > 0.5) drapePatch(gb, K.wealth >= 2 ? 'rFlag' : K.wealth >= 1 ? 'rGravel' : 'rDirt', gb.xf, door.lx - door.dw / 2 - 0.4, zf, door.lx + door.dw / 2 + 0.4, ze, { cell: 2, lift: 0.05 });
    }
    if (door.chimney) chimneys.push({ p: door.chimney, pri: type === 'tavern' ? 1 : type === 'weaponsmith' || type === 'armorer' ? 2 : 0 });
    const owner = makeOwner(hr, type, K.wealth);
    let name = buildingName(hr, type, owner, K.wealth);
    if (type === 'tavern' && FIXED_NAMES[l.dist.id] && !usedNames.has(FIXED_NAMES[l.dist.id])) name = FIXED_NAMES[l.dist.id];
    while (usedNames.has(name) && type !== 'house') name = buildingName(hr, type, owner, K.wealth);
    usedNames.add(name);
    const rec = { type, name, owner, door, seed: hr.int(1, 1e9), district: l.dist.id, wealth: K.wealth, poly: footprintPoly(gb.xf, fp) };
    if (type === 'house') { rec.residents = [owner]; if (hr.chance(K.wealth >= 3 ? 0.7 : 0.5)) { const g2 = owner.gender === 'f' ? 'm' : 'f'; rec.residents.push({ name: personName(hr, g2).split(' ')[0] + ' ' + owner.name.split(' ')[1], gender: g2, look: lookByWealth(hr, g2, K.wealth) }); } }
    registerBuilding(area, rec);
    // front yards: garden walls or hedges in the rich quarters, following the ground
    if (K.fence && l.set >= 2.2 && hr.chance(K.fence)) {
      const zf = l.d / 2 + l.set - 0.2; const x0 = -l.w / 2 - 0.6, x1 = l.w / 2 + 0.6; const g0 = door.lx - 1.3, g1 = door.lx + 1.3;
      const hedge = hr.chance(0.5); const hh = hedge ? 1.25 : 0.95, th = hedge ? 0.35 : 0.2;
      for (const [a, b] of [[x0, g0], [g1, x1]]) if (b - a > 0.3) {
        const n = Math.max(1, Math.ceil((b - a) / 2.5));
        for (let k = 0; k < n; k++) { const pa = lerp(a, b, k / n), pb = lerp(a, b, (k + 1) / n); const y = Math.min(gy(pa, zf), gy(pb, zf)); gb.box(pa, y - 0.4, zf - th, pb, y + hh, zf + th, hedge ? { side: 'hedge', top: 'hedge' } : { side: 'stone', top: 'stoneLight' }, 2, 2); col(pa, zf - th, pb, zf + th, y - 1, y + hh); }
      }
      for (const x of [door.lx - 2.4, door.lx + 2.4]) { const p = wp(x, l.d / 2 + l.set * 0.5); flower(p[0], p[1]); }
    }
    // clutter by the door
    if (hr.chance(K.clutter)) {
      const n = K === DK.harbor || type === 'warehouse' ? hr.int(1, 3) : 1;
      for (let i = 0; i < n; i++) {
        const lx = door.lx + (i % 2 ? -1 : 1) * (door.dw / 2 + 1.0 + Math.floor(i / 2) * 1.1), lz = l.d / 2 + 0.6;
        if (Math.abs(lx) > l.w / 2 + 0.3 || l.steps > 0.3) continue;
        const y = gy(lx, lz);
        if (hr.chance(0.5)) { gb.box(lx - 0.45, y - 0.2, lz - 0.45, lx + 0.45, y + 0.9, lz + 0.45, { side: 'wood', top: 'wood' }, 0.9, 0.9); col(lx - 0.45, lz - 0.45, lx + 0.45, lz + 0.45, y - 1, y + 0.9); }
        else { gb.cyl('woodDark', lx, lz, 0.4, y - 0.2, y + 1.0, 8, 1, 1, { top: 'woodDark' }); col(lx - 0.4, lz - 0.4, lx + 0.4, lz + 0.4, y - 1, y + 1.0); }
      }
    }
    // trees beside the houses of the well-off
    if (K.tree > 0.3) for (const sx of [-1, 1]) { if (!hr.chance(K.tree * 0.6)) continue; const p = wp(sx * (l.w / 2 + 2.3), hr.range(-l.d / 3, l.d / 4)); if (insideCity(p[0], p[1], 5) && clearOf(p[0], p[1], 1.6) && !zoneHit(p[0], p[1], 1.5)) { tree(K === DK.noble ? hr.pick(['oak', 'cypress', 'oak']) : hr.pick(['oak', 'bush']), p[0], p[1], hr.range(0.85, 1.1)); block(mkObb(p[0], p[1], 0, 1, 1)); } }
    gb.xf = null;
  }

  /* ---------- street lamps ---------- */
  let lampSide = 1; const lampAt = (x, z) => { const y = H(x, z); gb.box(x - 0.09, y - 0.3, z - 0.09, x + 0.09, y + 3.3, z + 0.09, 'iron', 1, 1); gb.box(x - 0.22, y + 3.3, z - 0.22, x + 0.22, y + 3.78, z + 0.22, { side: 'lantern', top: 'iron' }, 0.44, 0.48); addCol(area, x - 0.15, z - 0.15, x + 0.15, z + 0.15, y - 1, y + 3.8); glows.push([x, y + 2.4, z, 1]); };
  for (const s of roads) {
    if (s.square) continue;
    const A = net.nodes[s.a], B = net.nodes[s.b]; const L = net.len(s); const ux = (B.x - A.x) / L, uz = (B.z - A.z) / L;
    const K = DK[districtAt((A.x + B.x) / 2, (A.z + B.z) / 2).kind]; const sp = s.lvl === 0 ? Math.min(K.lamp, 26) : K.lamp * (s.lvl >= 2 ? 1.5 : 1);
    for (let t = rng.range(2, sp); t < L - 2; t += sp) {
      lampSide = -lampSide; const off = s.w / 2 - 0.3; const x = A.x + ux * t - uz * off * lampSide, z = A.z + uz * t + ux * off * lampSide;
      if (!insideCity(x, z, 4) || !clearOf(x, z, 0.5, false) || zoneHit(x, z, 0.5, true)) continue;
      if (area.doors.some(d => Math.abs(d.x - x) < 3 && Math.abs(d.z - z) < 3 && Math.hypot(d.x - x, d.z - z) < 2.6)) continue; // never in front of a doorway
      lampAt(x, z);
    }
  }
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2 + 0.2; lampAt(MARKET[0] + Math.cos(a) * 21.5, MARKET[1] + Math.sin(a) * 21.5); }
  for (const [x, z] of [[-4.5, -4.5], [4.5, -4.5], [-4.5, 4.5], [4.5, 4.5]]) lampAt(MEMORIAL[0] + x, MEMORIAL[1] + z);
  for (const px of PIERS) lampAt(px - 5.8, SHORE - 2.4); // beside each water gate

  /* ---------- trees and bushes in yards and corners ---------- */
  for (let k = 0; k < 1600; k++) {
    const x = rng.range(-180, 180), z = rng.range(-170, SHORE - 10); if (!insideCity(x, z, 5)) continue;
    const K = DK[districtAt(x, z).kind]; if (!rng.chance(K.tree * 0.35)) continue;
    if (zoneHit(x, z, 2) || !clearOf(x, z, 2.2)) continue;
    const kind = K === DK.noble ? rng.pick(['oak', 'oak', 'cypress', 'bush']) : K === DK.slum ? rng.pick(['dead', 'bush', 'bush']) : rng.pick(['oak', 'bush', 'cypress']);
    tree(kind, x, z, rng.range(0.8, 1.15)); block(mkObb(x, z, 0, 1.2, 1.2));
  }

  /* ---------- carriage stops ---------- */
  const STOP_DEFS = [
    ['market', 'the Grand Market', 22, 22], ['castle', 'Castle Daggerfall', 9, CASTLE_Z - 30], ['temple', 'the Temple of Arkay', -108, 4], ['hospice', 'the House of Mercy', -55, 64],
    ['mages', 'the Mages Guild', 72, -84], ['fighters', 'the Fighters Guild', 128, 14], ['garden', "the Queen's Garden", -43, -100], ['bell', 'the Bell Tower', 50, 50],
    ['docks', 'the Docks', -30, 143], ['lighthouse', 'Lighthouse Quay', 112, 143], ['warrens', "Beggar's Well", -100, 101], ['tanners', "Tanners' Row", 128, 90],
    ...GATES.map(g => [g.id, capFirst(g.name.replace('the ', '')), g.inner[0] + g.nx * 6, g.inner[1] + g.nz * 6]),
  ];
  area.stops = [];
  for (const [id, name, rx, rz] of STOP_DEFS) {
    let best = null, bd = 1e9;
    for (const n of net.nodes) { const ss = n.segs.filter(s => !s.square); if (!ss.length) continue; const d = Math.hypot(n.x - rx, n.z - rz); if (d < bd) { bd = d; best = n; } }
    const s = best.segs.filter(q => !q.square).reduce((a, b) => b.w > a.w ? b : a); const O = net.nodes[net.other(s, best.i)];
    let ux = O.x - best.x, uz = O.z - best.z; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    let spot = null;
    for (const off of [s.w / 2 + 2.6, s.w / 2 + 1.6]) { for (const side of [1, -1]) { const cx = best.x + ux * 3 - uz * off * side, cz = best.z + uz * 3 + ux * off * side; if (insideCity(cx, cz, 4) && clearOf(cx, cz, 1.5, false) && !zoneHit(cx, cz, 1.6, true)) { spot = { cx, cz, side }; break; } } if (spot) break; }
    if (!spot) spot = { cx: best.x + ux * 3 - uz * (s.w / 2 - 0.4), cz: best.z + uz * 3 + ux * (s.w / 2 - 0.4), side: 1 };
    const nx = -uz * spot.side, nz = ux * spot.side; // points away from the road
    const sx = spot.cx + ux * 3.4 - nx * 0.6, sz = spot.cz + uz * 3.4 - nz * 0.6; const sy = H(sx, sz), cy = H(spot.cx, spot.cz);
    gb.box(sx - 0.08, sy - 0.3, sz - 0.08, sx + 0.08, sy + 3.0, sz + 0.08, 'woodDark', 1, 1); addCol(area, sx - 0.12, sz - 0.12, sx + 0.12, sz + 0.12, sy - 1, sy + 3.4);
    gb.quad('sign_coach', [sx - ux * 0.5 + nx * 0.1, sy + 1.9, sz - uz * 0.5 + nz * 0.1], [ux, 0, uz], [0, 1, 0], 1.0, 1.0, 1, 1, { fixedUV: true });
    gb.box(sx - 0.18, sy + 3.0, sz - 0.18, sx + 0.18, sy + 3.4, sz + 0.18, { side: 'lantern', top: 'iron' }, 0.36, 0.4); glows.push([sx, sy + 2.3, sz, 0.8]);
    const car = makeBillboard(simpleSprite('carriage').tex[0], 4.6, 2.9); car.position.set(spot.cx, cy, spot.cz); area.scene.add(car); area.bbs.push(car); area.tintMats.push(car.material);
    addCol(area, spot.cx - 1.1, spot.cz - 1.1, spot.cx + 1.1, spot.cz + 1.1, cy - 1, cy + 2.9);
    const ax = best.x + ux * 4.6 - nx * Math.max(0, s.w / 2 - 1.2), az = best.z + uz * 4.6 - nz * Math.max(0, s.w / 2 - 1.2);
    area.stops.push({ id, name, x: sx, z: sz, carriage: [spot.cx, spot.cz], coachman: [spot.cx - nx * 1.5 + ux * 1.6, spot.cz - nz * 1.5 + uz * 1.6], arrive: [ax, az, Math.atan2(-ux, -uz)], node: best.i, district: districtAt(sx, sz).id });
    block(mkObb(spot.cx, spot.cz, 0, 1.5, 1.5));
  }

  /* ---------- a straggle of houses and an inn along the road outside the North Gate ---------- */
  { const road = outsideRoads[GATES.findIndex(g => g.id === 'northgate')]; const fr = new RNG(313);
    let acc = 0, next = 16, innDone = false;
    for (let i = 3; i < road.length - 1 && acc < 80; i++) {
      const [ax, az] = road[i], [bx, bz] = road[i + 1]; const L = Math.hypot(bx - ax, bz - az) || 1; acc += L; if (acc < next) continue; next = acc + fr.range(10, 15);
      const ux = (bx - ax) / L, uz = (bz - az) / L;
      for (const side of [1, -1]) {
        if (!fr.chance(0.7)) continue;
        const w = fr.range(7, 10.5), d = fr.range(7, 9), set = fr.range(1.2, 3); const nx = -uz * side, nz = ux * side;
        const front = 2.9 + set; const o = mkObb(ax + nx * (front + d / 2), az + nz * (front + d / 2), Math.atan2(-nx, -nz), w / 2, d / 2);
        const cs = obbCorners(o); if (cs.some(([x, z]) => pointInPoly(x, z, WALL_PTS) || wallDist(x, z) < 8 || Math.hypot(x - RISE_LOOK[0], z - RISE_LOOK[1]) < 62)) continue;
        const hs = cs.map(([x, z]) => H(x, z)); const lo = Math.min(...hs), hi = Math.max(...hs); if (hi - lo > 4.5) continue;
        const bb = obbAabb(o); if (bldHash.query(bb[0] - 2, bb[1] - 2, bb[2] + 2, bb[3] + 2).some(b => obbOverlap(o, b.o, 1)) || roadPts.some(([qa, qb, qc, qd]) => obbOverlap(o, segObb(qa, qb, qc, qd, 2.9)))) continue;
        const doorG = H(ax + nx * front, az + nz * front); const floor = Math.max(doorG + 0.05, hi - 1.5);
        const inn = !innDone && w >= 8.5; if (inn) innDone = true;
        const fp = { x0: -w / 2, z0: -d / 2, x1: w / 2, z1: d / 2 }; gb.setXf(o.x, o.z, o.ang, floor);
        const door = makeBuilding(area, gb, fr, { fp, stories: inn ? 2 : fr.pick([1, 1, 2]), style: fr.pick(['timber2', 'timber', 'plaster', 'wood']), roof: 'gable', roofKey: inn || fr.chance(0.45) ? 'roofRed' : 'roofThatch', roofTint: [1.02, 0.92, 0.82], found: floor - lo, steps: floor - doorG, sign: inn ? 'tavern' : null, chimney: inn ? 1 : 0.6 });
        caster(o, floor + door.roofTop); if (door.chimney) chimneys.push({ p: door.chimney, pri: 1 });
        const type = inn ? 'tavern' : 'house'; const owner = makeOwner(fr, type, 0.7);
        const rec = { type, name: inn ? "The Pilgrim's Rest" : buildingName(fr, 'house', owner, 0.7), owner, door, seed: fr.int(1, 1e9), district: 'outside', wealth: 0.7, poly: footprintPoly(gb.xf, fp) };
        if (!inn) rec.residents = [owner];
        registerBuilding(area, rec); gb.xf = null; block(mkObb(o.x, o.z, o.ang, o.hx + 1.5, o.hz + 1.5));
        if (fr.chance(0.5)) { const [tx, tz] = xfP(o, fr.chance(0.5) ? o.hx + 2.5 : -o.hx - 2.5, -o.hz + 1); if (!nearRoads(tx, tz, 3)) tree(fr.pick(['oak', 'oak', 'cypress']), tx, tz, fr.range(0.85, 1.1)); }
      }
    }
  }

  /* ---------- the countryside: farmsteads, a ring of strip fields, pasture ---------- */
  const fieldHash = new SHash(24); const fields = []; const sheep = [];
  const inField = (x, z, r = 0) => fieldHash.query(x - r, z - r, x + r, z + r).some(f => circleObb(x, z, r + 0.01, f.o));
  const farmRng = new RNG(99);
  const roadObbs = roadPts.map(([ax, az, bx, bz]) => segObb(ax, az, bx, bz, 3.4)); const roadObbHash = new SHash(24); roadObbs.forEach(o => roadObbHash.add({ o }, obbAabb(o)));
  // a parcel is laid if it sits on gentle, dry ground clear of walls, roads, buildings and other parcels
  const tryField = (o, key, fr, hedge = 0.7) => {
    const cs = obbCorners(o); if (cs.some(([x, z]) => pointInPoly(x, z, WALL_PTS) || wallDist(x, z) < 8 || H(x, z) < SEA + 1.5)) return false;
    const hs = cs.map(([x, z]) => H(x, z)); if (Math.max(...hs) - Math.min(...hs) > 8 || terrainSlope(o.x, o.z) > 0.22) return false;
    const bb = obbAabb(o);
    if (roadObbHash.query(...bb).some(r => obbOverlap(o, r.o)) || fieldHash.query(...bb).some(f => obbOverlap(o, f.o, 2.5)) || bldHash.query(...bb).some(b => obbOverlap(o, b.o, 2))) return false;
    if (Math.hypot(o.x - RISE_LOOK[0], o.z - RISE_LOOK[1]) < 60 || Wild.trackInObb(o, 4)) return false;
    const f = { o, key }; fields.push(f); fieldHash.add(f, bb);
    drapePatch(gb, key, makeXf(o.x, o.z, o.ang), -o.hx, -o.hz, o.hx, o.hz, { cell: 5, lift: 0.05, tw: 3, uvFrame: true });
    // hedgerows along the long sides (and sometimes the ends), with the odd tree standing in them
    for (const [sx, sz, len, along] of [[-1, 0, o.hz, true], [1, 0, o.hz, true], [0, -1, o.hx, false], [0, 1, o.hx, false]]) {
      if (!fr.chance(along ? hedge : hedge * 0.6)) continue;
      const pieces = Math.max(1, Math.ceil(2 * len / 5)); // a continuous hedge, laid in short lengths over the ground
      for (let k = 0; k < pieces; k++) {
        const t0 = -len + 2 * len * k / pieces, t1 = -len + 2 * len * (k + 1) / pieces;
        const [ax, az] = along ? xfP(o, sx * (o.hx + 0.9), t0) : xfP(o, t0, sz * (o.hz + 0.9)), [bx, bz] = along ? xfP(o, sx * (o.hx + 0.9), t1) : xfP(o, t1, sz * (o.hz + 0.9));
        const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (nearRoads(mx, mz, 3.4) || fr.chance(0.07)) continue;
        const y = Math.min(H(ax, az), H(bx, bz)), L = Math.hypot(bx - ax, bz - az), hh = fr.range(1.1, 1.6);
        gb.setXf(mx, mz, Math.atan2(bx - ax, bz - az), y); gb.box(-0.6, -0.5, -L / 2 - 0.2, 0.6, hh, L / 2 + 0.2, { side: 'hedge', top: 'hedge' }, 2, 2, { skip: 'ns' }); col(-0.6, -L / 2, 0.6, L / 2, -1, hh); gb.xf = null;
        if (fr.chance(0.07)) tree(fr.chance(0.7) ? 'oak' : 'cypress', mx, mz, fr.range(0.8, 1.1));
      }
    }
    if (key === 'fMeadow') { const n = fr.int(3, 9); for (let k = 0; k < n; k++) { const [x, z] = xfP(o, fr.range(-o.hx + 2, o.hx - 2), fr.range(-o.hz + 2, o.hz - 2)); sheep.push([x, H(x, z), z, fr.range(0.85, 1.1)]); } }
    return true;
  };
  // crops by distance from the walls: market gardens close in, grain beyond, pasture furthest out
  const cropAt = (x, z, fr) => { const d = wallDist(x, z); const r = fr.next(); if (d < 45) return r < 0.45 ? 'fGreens' : r < 0.75 ? 'fPlowed' : 'fWheat'; if (d < 130) return r < 0.4 ? 'fWheat' : r < 0.62 ? 'fBarley' : r < 0.8 ? 'fPlowed' : r < 0.9 ? 'fGreens' : 'fMeadow'; return r < 0.25 ? 'fWheat' : r < 0.4 ? 'fBarley' : 'fMeadow'; };
  for (const F of farmSites) {
    const fr = new RNG(F.seed); const FX = makeXf(F.x, F.z, F.ang, F.pad.h);
    // farmhouse and barn
    const hfp = { x0: -5, z0: -3.5, x1: 5, z1: 3.5 };
    gb.setXf(...xfP(FX, -4, 4), F.ang, F.pad.h);
    const door = makeBuilding(area, gb, farmRng, { fp: hfp, stories: 1, style: 'timber2', roof: 'gable', roofKey: 'roofThatch', roofTint: [1, 0.95, 0.85], doorT: 0.5, found: 0.8, chimney: 1 });
    if (door.chimney) chimneys.push({ p: door.chimney, pri: 1 });
    const owner = makeOwner(farmRng, 'house', 0.7); owner.look.hat = '#8a6a30';
    registerBuilding(area, { type: 'house', name: `${owner.name.split(' ')[1]} Farmstead`, owner, residents: [owner], poly: footprintPoly(gb.xf, hfp), door, seed: farmRng.int(1, 1e9), farm: true, wealth: 0.7, district: 'outside' });
    gb.setXf(...xfP(FX, 6, -5), F.ang + Math.PI / 2, F.pad.h);
    makeBuilding(area, gb, farmRng, { fp: { x0: -6, z0: -4.5, x1: 6, z1: 4.5 }, h: 5.2, style: 'wood', roof: 'gable', roofKey: 'roofBrown', roofTint: [0.85, 0.8, 0.75], doorT: 0.5, doorW: 2.6, doorH: 3.2, doorKey: 'doorDark', winRate: 0.2, found: 0.8, chimney: 0 });
    gb.xf = FX;
    drapePatch(gb, 'gDirt', FX, -12, -12, 12, 12, { cell: 4, lift: 0.04 });
    for (let k = 0; k < 6; k++) { const p = wp(fr.range(-10, 10), fr.range(4, 11)); hay.push([p[0], H(p[0], p[1]), p[1], fr.range(0.8, 1.2)]); }
    for (const [x, z] of [[-13, -8], [13, 9], [-12, 12]]) { const p = wp(x, z); tree(fr.pick(['oak', 'oak', 'cypress']), p[0], p[1], fr.range(0.9, 1.15)); }
    gb.xf = null;
    block(mkObb(F.x, F.z, F.ang, 13, 13));
    for (let row = -3; row <= 3; row++) for (let colI = -4; colI <= 4; colI++) {
      if (Math.abs(row) <= 0 && Math.abs(colI) <= 1) continue;
      const pw = fr.range(17, 26), pl = fr.range(46, 70);
      const [cx, cz] = xfP(FX, colI * 28 + fr.range(-2, 2), row * 76 + fr.range(-4, 4));
      tryField(mkObb(cx, cz, F.ang + fr.range(-0.05, 0.05), pw / 2, pl / 2), cropAt(cx, cz, fr), fr);
    }
  }
  // the ring of fields that feeds the city: blocks of parallel strips squared to the nearest road
  { const fr = new RNG(606);
    for (let gx = -WORLD_R + 20; gx < WORLD_R - 20; gx += 42) for (let gz = -WORLD_R + 20; gz < SHORE + 90; gz += 42) {
      const x = gx + fr.range(-18, 18), z = gz + fr.range(-18, 18); const wd = wallDist(x, z);
      if (pointInPoly(x, z, WALL_PTS) || wd < 10 || wd > 230 || forestMask(x, z) > 0.55) continue;
      let best = null, bd = 1e9; for (const [ax, az, bx, bz] of roadPts) { const q = segDist(x, z, ax, az, bx, bz); if (q.d < bd) { bd = q.d; best = [bx - ax, bz - az]; } }
      const ang = best && bd < 90 ? Math.atan2(best[0], best[1]) : Math.atan2(x, z);
      const pw = fr.range(14, 22), pl = fr.range(46, 76); const n = fr.int(3, 6);
      for (let k = 0; k < n; k++) { const [cx, cz] = xfP(makeXf(x, z, ang), (k - (n - 1) / 2) * (pw + 3.2), fr.range(-3, 3)); tryField(mkObb(cx, cz, ang + fr.range(-0.03, 0.03), pw / 2, pl / 2 * fr.range(0.9, 1.05)), cropAt(cx, cz, fr), fr, 0.9); }
    }
  }
  const orchards = [];
  { // orchards close under the walls: fruit trees in rows
    const fr = new RNG(707);
    for (let k = 0; k < 40; k++) {
      const a = fr.range(0, 6.283), d = fr.range(240, 330); const x = Math.cos(a) * d, z = Math.sin(a) * d * 0.9 - 20; const wd = wallDist(x, z);
      if (pointInPoly(x, z, WALL_PTS) || wd < 12 || wd > 70 || H(x, z) < SEA + 2) continue;
      const ang = Math.atan2(x, z); const o = mkObb(x, z, ang, fr.range(12, 18), fr.range(14, 22));
      const bb = obbAabb(o); if (fieldHash.query(...bb).some(f => obbOverlap(o, f.o, 3)) || roadObbHash.query(...bb).some(r => obbOverlap(o, r.o)) || bldHash.query(...bb).some(b => obbOverlap(o, b.o, 3)) || terrainSlope(x, z) > 0.25) continue;
      const f = { o, key: 'orchard' }; fieldHash.add(f, bb); orchards.push(o);
      for (let i = -o.hx + 2; i < o.hx - 1; i += 4.5) for (let j = -o.hz + 2; j < o.hz - 1; j += 4.5) { const [tx, tz] = xfP(o, i + fr.range(-0.4, 0.4), j + fr.range(-0.4, 0.4)); { const y = H(tx, tz); trees.oak.push([tx, y - 0.1, tz, fr.range(0.55, 0.7)]); addCol(area, tx - 0.3, tz - 0.3, tx + 0.3, tz + 0.3, y - 1, y + 5); } }
    }
  }
  { // a windmill on open high ground among the fields
    let best = null; for (const F of farmSites) for (const [dx, dz] of [[40, 30], [-40, 30], [40, -40], [-40, -40]]) { const x = F.x + dx, z = F.z + dz; const h = H(x, z); if (inField(x, z, 6) || nearRoads(x, z, 8) || terrainSlope(x, z) > 0.15) continue; if (!best || h > best.h) best = { x, z, h }; }
    if (best) {
      const { x: mx, z: mz, h: my } = best;
      gb.cyl('stoneLight', mx, mz, 3.6, my - 1, my + 13, 10, 4, 4); gb.cone('roofThatch', mx, mz, 4.2, my + 13, 5, 10, 3);
      addCol(area, mx - 3.4, mz - 3.4, mx + 3.4, mz + 3.4, my - 1, my + 13); addCol(area, mx - 2, mz - 2, mx + 2, mz + 2, my + 13, my + 16);
      const bg = new GB();
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; const c = Math.cos(a), s = Math.sin(a); const P = (r, w) => [c * r - s * w, s * r + c * w, 0]; bg.quad4('cloth', P(0.6, -0.1), P(8, -0.1), P(8, 1.4), P(0.6, 1.4), [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 1]); }
      const blades = bg.build(mats); blades.position.set(mx, my + 11, mz + 4.3); area.scene.add(blades);
      area.anim.push(dt => { blades.rotation.z += dt * 0.5; });
      block(mkObb(mx, mz, 0, 5, 5));
    }
  }
  /* ---------- Pilgrim's Rise: the lookout terrace, its signpost, and the view it keeps clear ---------- */
  {
    gb.xf = lookXf; const top = 0.35;
    gb.box(-3.6, -4, -3.6, 3.6, top, 3.6, { side: 'stone', top: 'flag' }, 3, 3); col(-3.6, -3.6, 3.6, 3.6, -4, top);
    const par = (x0, z0, x1, z1) => { gb.box(x0, top, z0, x1, top + 0.38, z1, { side: 'stone', top: 'stone' }, 3, 3); col(x0, z0, x1, z1, top, top + 0.5); };
    par(-1.6, 3.25, 3.6, 3.6); par(3.25, -3.6, 3.6, 3.25);
    for (let k = 1; k <= 3; k++) { const y = top - k * 0.3; gb.box(-3.6 - k * 0.45, -4, 1.2, -3.6 - (k - 1) * 0.45, y, 3.6, { side: 'stone', top: 'stone' }, 2, 2); col(-3.6 - k * 0.45, 1.2, -3.6 - (k - 1) * 0.45, 3.6, -4, y); }
    gb.box(-2.6, top, -3.0, -0.4, top + 0.45, -2.5, { side: 'woodDark', top: 'wood' }, 2, 2); col(-2.6, -3.0, -0.4, -2.5, top, top + 0.45);
    gb.box(2.4, top, -2.6, 2.56, top + 2.6, -2.44, 'woodDark', 1, 1); col(2.35, -2.65, 2.6, -2.4, top, top + 2.6);
    gb.quad('signLook', [1.6, top + 1.7, -2.4], [1, 0, 0], [0, 1, 0], 1.9, 0.72, 1, 1, { fixedUV: true, double: true });
    gb.xf = null;
  }
  const LOOKY = lookPad.h + 0.35;
  { // a wind-bent pine and a few boulders frame the view from the terrace
    { const fx = lookDir[0], fz = lookDir[1], lx = fz, lz = -fx; const sx = xfP(lookXf, 0, 2.55); for (const [f, l, sc] of [[13, 11.5, 1.45], [17, 16, 1.2]]) { const px = sx[0] + fx * f + lx * l, pz = sx[1] + fz * f + lz * l; tree('pine', px, pz, sc); } }
    { const br = new RNG(515); for (const [lx, lz, s] of [[-5.6, 5.4, 1.3], [-7.4, 3.6, 1.8], [-4.8, 7.4, 0.9]]) { const [x, z] = xfP(lookXf, lx, lz); const y = H(x, z); boulder(gb, 'boulder', x, y, z, s * 1.1, br); addCol(area, x - s * 0.8, z - s * 0.8, x + s * 0.8, z + s * 0.8, y - s, y + s * 0.6); } }
  }
  // true where something this tall would stand in the view from the lookout
  const blocksView = (x, z, tall = 11) => { const dx = x - RISE_LOOK[0], dz = z - RISE_LOOK[1], d = Math.hypot(dx, dz); if (d < 12) return true; if (d > 190) return false; const cosA = (dx * lookDir[0] + dz * lookDir[1]) / d; if (cosA < 0.4) return false; return H(x, z) + tall > LOOKY + 1.6 - d * 0.3; };

  /* ---------- forests with ragged edges, copses, a few lone trees; scrub and rocks on the steep ground ---------- */
  const trng = new RNG(4242);
  const nearFarm = (x, z) => farmSites.some(F => Math.hypot(x - F.x, z - F.z) < 26);
  for (let gx = -TG.R + 2.5; gx < TG.R; gx += 5) for (let gz = -TG.R + 2.5; gz < TG.R; gz += 5) { // the whole surveyed square: the wild's chunks carry on beyond it
    const x = gx + trng.range(-2.5, 2.5), z = gz + trng.range(-2.5, 2.5);
    if (pointInPoly(x, z, WALL_PTS) || wallDist(x, z) < 18) continue;
    const h = H(x, z); if (h < SEA + 1.6) continue;
    const m = forestMask(x, z); const copse = fbm(x / 34, z / 34, 2, 88);
    const p = m > 0.03 ? 0.25 + 0.74 * m : copse > 0.42 ? 0.5 : 0.0012;
    if (!trng.chance(p)) continue;
    if (inField(x, z, 2) || nearRoads(x, z, 4) || Wild.trackD(x, z) < 6 || nearFarm(x, z) || terrainSlope(x, z) > 1.0) continue;
    const r = trng.next(); const edge = m > 0.03 && m < 0.35;
    if (r < (edge ? 0.3 : 0.1)) { if (!blocksView(x, z, 1.6)) trees.bush.push([x, h - 0.1, z, trng.range(0.8, 1.4)]); continue; }
    let kind = h > 60 ? (r < 0.75 ? 'pine' : 'oak') : (r < 0.62 ? 'oak' : r < 0.9 ? 'pine' : r < 0.95 ? 'dead' : 'cypress');
    if (m > 0.75 && trng.chance(0.35) && Math.hypot(x - RISE_LOOK[0], z - RISE_LOOK[1]) > 120) kind = 'grove'; // deep woods read as one canopy
    if (blocksView(x, z, TREE_H[kind])) { if (!blocksView(x, z, 1.6)) trees.bush.push([x, h - 0.1, z, 1.1]); continue; }
    tree(kind, x, z, trng.range(0.8, 1.3));
  }
  // scrub, gorse and wind-bent pines clinging to the crag below the lookout
  for (let k = 0; k < 2200; k++) {
    const a = trng.range(0, 6.283), d = trng.range(10, 200); const x = RISE_LOOK[0] + Math.cos(a) * d, z = RISE_LOOK[1] + Math.sin(a) * d;
    if (pointInPoly(x, z, WALL_PTS) || wallDist(x, z) < 10 || nearRoads(x, z, 2.5) || inField(x, z, 1)) continue;
    const sl = terrainSlope(x, z); if (sl < 0.3 || sl > 3) continue;
    if (trng.chance(0.2) && !blocksView(x, z, 7)) { tree('pine', x, z, trng.range(0.55, 0.8)); continue; }
    if (!blocksView(x, z, 1.8)) trees.bush.push([x, H(x, z) - 0.15, z, trng.range(0.7, 1.3)]);
  }
  for (let k = 0; k < 900; k++) {
    const x = trng.range(-WORLD_R, WORLD_R), z = trng.range(-WORLD_R, SHORE + 60); if (pointInPoly(x, z, WALL_PTS) || wallDist(x, z) < 12) continue;
    const sl = terrainSlope(x, z); if (sl < 0.55 || nearRoads(x, z, 3) || blocksView(x, z, 2.5) || wallDist(x, z) < 35 || Math.hypot(x, z - CASTLE_Z + 71) < 75) continue;
    const s = trng.range(0.8, 2.4), y = H(x, z);
    boulder(gb, 'boulder', x, y, z, s, trng); addCol(area, x - s * 0.75, z - s * 0.75, x + s * 0.75, z + s * 0.75, y - s, y + s * 0.55);
  }
  // wildflowers in drifts, not sprinkled
  for (let k = 0; k < 70; k++) {
    const cx = trng.range(-WORLD_R, WORLD_R), cz = trng.range(-WORLD_R, SHORE); if (pointInPoly(cx, cz, WALL_PTS) || wallDist(cx, cz) < 8 || forestMask(cx, cz) > 0.3 || H(cx, cz) < SEA + 1.5) continue;
    { const dx = cx - RISE_LOOK[0], dz = cz - RISE_LOOK[1], d = Math.hypot(dx, dz); if (d > 50 && (dx * lookDir[0] + dz * lookDir[1]) / d > 0.2) continue; } // no speckle in the view
    for (let i = 0; i < 9; i++) { const x = cx + trng.range(-3.5, 3.5), z = cz + trng.range(-3.5, 3.5); if (!inField(x, z) && !nearRoads(x, z, 2)) flower(x, z); }
  }

  /* ---------- sprite batches ---------- */
  const oaks = [[], [], []]; trees.oak.forEach((p, i) => oaks[i % 3].push(p));
  oaks.forEach((l, i) => l.length && new SpriteBatch(area, treeSprite('oak', 10 + i).tex[0], 6, 10, l));
  if (trees.pine.length) new SpriteBatch(area, treeSprite('pine', 20).tex[0], 5, 12, trees.pine);
  if (trees.dead.length) new SpriteBatch(area, treeSprite('dead', 30).tex[0], 5.4, 9, trees.dead);
  if (trees.cypress.length) new SpriteBatch(area, treeSprite('cypress', 40).tex[0], 2.1, 7, trees.cypress);
  if (trees.bush.length) new SpriteBatch(area, treeSprite('bush', 50).tex[0], 2.4, 1.5, trees.bush);
  if (trees.grove.length) new SpriteBatch(area, treeSprite('grove', 60).tex[0], 9.5, 7, trees.grove);
  for (let f = 0; f < 4; f++) { const l = flowers.filter((_, i) => i % 4 === f); if (l.length) new SpriteBatch(area, simpleSprite('flowers', 4).tex[f], 0.8, 0.4, l); }
  if (tufts.length) new SpriteBatch(area, simpleSprite('tuft').tex[0], 0.95, 0.55, tufts);
  if (hay.length) new SpriteBatch(area, simpleSprite('hay').tex[0], 2.6, 2.0, hay);
  if (sheep.length) new SpriteBatch(area, simpleSprite('sheep').tex[0], 1.4, 1.0, sheep);
  if (dummies.length) new SpriteBatch(area, simpleSprite('dummy').tex[0], 0.9, 1.8, dummies);
  const glowBatch = new SpriteBatch(area, TEX.glow, 2.2, 2.2, glows, { additive: true, lit: false, fog: false });
  area.special.glowMat = glowBatch.mat;

  for (const [k, g] of gb.g) { // roads, squares and fields lie in the same shadows as the ground
    if (!/^(r[A-Z]|sq|g[A-Z]|f[A-Z])/.test(k)) continue;
    for (let i = 0; i < g.p.length; i += 3) { const s = shadowAt(g.p[i], g.p[i + 2], g.p[i + 1]); if (s < 1) { g.c[i] *= s * 0.92; g.c[i + 1] *= s * 0.97; g.c[i + 2] *= s * 1.16; } }
  }
  area.scene.add(buildTerrainMeshes(mats, matOf, tintOf));
  relightGround(gb, ['gDirt', 'gSand', 'gGrass', 'fWheat', 'fBarley', 'fPlowed', 'fGreens', 'fMeadow', 'rCobble', 'rFlag', 'rGravel', 'rDirt', 'rMud', 'rAve', 'rGravelF', 'rDirtF', 'rMudF', 'kerb', 'sqPlaza', 'sqCobble', 'sqFlag']);
  const meshes = gb.build(mats); area.scene.add(meshes);

  /* ---------- ambience: smoke from the busier chimneys, gulls, a boat in the bay, flags on the castle ---------- */
  {
    const arng = new RNG(8080);
    const pick = arng.shuffle(chimneys.filter(c => c.pri > 0)).slice(0, 14);
    makeSmoke(area, pick.map(c => ({ x: c.p[0], y: c.p[1], z: c.p[2], dark: c.pri === 2 })), arng);
    makeGulls(area, 115, -115, 6, arng, 40, 62); // birds wheeling below the crag
    makeBoat(area, mats, [[-150, 226], [-40, 250], [100, 252], [190, 226], [170, 272], [30, 284], [-120, 268]], 2.6);
    makeBoat(area, mats, [[200, 190], [260, 205], [290, 250], [250, 300], [190, 290], [160, 240]], 2.0);
    for (const [x, y, z, tex] of castleFlags) makeFlag(area, tex, x, y, z, 0.6, 2.6, 1.5);
  }

  /* ---------- walkable street graph for townsfolk and the carriages ---------- */
  const remap = new Map(); const nodes = [];
  for (const n of net.nodes) if (n.segs.length) { remap.set(n.i, nodes.length); const d = districtAt(n.x, n.z); nodes.push({ x: n.x, z: n.z, n: [], w: [], dist: d.id, kind: d.kind }); }
  for (const s of roads) { const a = remap.get(s.a), b = remap.get(s.b); if (a === undefined || b === undefined) continue; nodes[a].n.push(b); nodes[a].w.push(s.w); nodes[b].n.push(a); nodes[b].w.push(s.w); }
  area.nodes = nodes;
  for (const st of area.stops) st.node = remap.get(st.node);
  area.guardPosts = [];
  for (const g of GATES) for (const s of [-1, 1]) area.guardPosts.push([g.inner[0] - g.nz * 4.2 * s - g.nx * 2, g.inner[1] + g.nx * 4.2 * s - g.nz * 2]);
  area.guardPosts.push([-3, CASTLE_Z - 35], [3, CASTLE_Z - 35], [PIERS[1] - 3.2, SHORE - 1.5], [PIERS[1] + 3.2, SHORE - 1.5]);
  { const s = xfP(lookXf, 0, 2.55); area.start = { x: s[0], z: s[1], y: LOOKY, yaw: Math.atan2(-lookDir[0], -lookDir[1]), pitch: -0.25 }; }
  area.landmarks = [
    { id: 'market', name: 'the Grand Market', x: MARKET[0], z: MARKET[1] }, { id: 'memorial', name: 'the Lysandus Memorial', x: MEMORIAL[0], z: MEMORIAL[1] },
    { id: 'garden', name: "the Queen's Garden", x: GARDEN[0], z: GARDEN[1] }, { id: 'bell', name: 'the Bell Tower', x: BELL[0], z: BELL[1] },
    { id: 'well', name: "Beggar's Well", x: WELL[0], z: WELL[1] }, { id: 'fish', name: 'the Fish Market', x: FISH[0], z: FISH[1] },
    { id: 'lighthouse', name: 'the Lighthouse', x: BREAK, z: 210 }, { id: 'rise', name: "Pilgrim's Rise", x: RISE_LOOK[0], z: RISE_LOOK[1] }, { id: 'graveyard', name: "Arkay's Graveyard", x: -128, z: 76 },
    ...GATES.map(g => ({ id: g.id, name: g.name, x: g.x, z: g.z })),
  ];
  // everything the automap needs
  area.map = {
    roads: roads.filter(s => !s.square).map(s => { const A = net.nodes[s.a], B = net.nodes[s.b]; return [A.x, A.z, B.x, B.z, s.w, s.lvl]; }),
    outside: outsideRoads, lanes, hillPath, fields: fields.map(f => ({ poly: obbCorners(f.o), key: f.key })), relief: null,
    piers: PIERS, breakwater: BREAK, pierEnd: PIER_END, garden: GARDEN, well: WELL, fish: FISH, bell: BELL,
    labels: DISTRICTS.map(d => { const ns = nodes.filter(n => n.dist === d.id); const x = ns.reduce((a, n) => a + n.x, 0) / (ns.length || 1), z = ns.reduce((a, n) => a + n.z, 0) / (ns.length || 1); return { name: capFirst(d.name), x, z }; }),
  };
  area.stats = { roadLen: Math.round(roads.filter(q => !q.square).reduce((a, q) => a + net.len(q), 0)), roads: roads.length, lots: lots.length, buildings: G.buildings.length, nodes: nodes.length, lamps: glows.length, fields: fields.length, farms: farmSites.length, trees: Object.values(trees).reduce((a, l) => a + l.length, 0), smoke: chimneys.length };

  buildColliderGrid(area);
  addSky(area);
  // beyond the surveyed square the country is generated as the player walks; the gate roads run on as tracks
  Wild.init(area, { mats, matOf, tintOf, forestMask, tracksFrom: gateTracks(), handFields: [...fields.map(f => f.o), ...orchards] });
  return area;
}
