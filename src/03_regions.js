/* =====================================================================
   Regions: the character of the land, which changes on a long walk.
   One field over the whole world says what kind of country a place is:
   the heartland (the home country's own mixed farmland and woods), chalk
   downs, fen, moor or the wooded weald. It is a function of position
   alone (a warped cellular field on a lattice of its own size, turned
   against the lattice of the countries), so every country's plan reads
   the same answer and the regions run across the borders as they like:
   a region may lie in several countries, and a country may hold several.
   Everything that gives a region its look reads this one field: the
   shape of the ground, its streams, woods, heath and farmland, the colour
   of the turf, the trees, the fields and what bounds them, how people
   settle, what they build with and what their roads are like.
   The home country is heartland throughout and keeps its plan: the
   regions begin beyond its box, on the outer flank of its mountains.
   ===================================================================== */
const RG = { heart: 0, downs: 1, fen: 2, moor: 3, weald: 4 }, RG_N = 5, RG_KEYS = ['heart', 'downs', 'fen', 'moor', 'weald'];
const REGION = {
  cell: 5600,                              // the lattice the regions grow from: a region is one cell or a few run together (some 15 to 60 minutes' walk across)
  rot: 0.47,                               // turned against the countries' lattice (radians)
  jitter: 0.86,                            // how far a cell's middle strays from its lattice point (of a cell)
  warp: 950,                               // the edges wander by this much (metres)
  share: [0.15, 0.22, 0.17, 0.22, 0.24],   // how much of the world each kind takes
  edge: [1500, 620, 380, 1700, 1400],      // how broad the change into each kind is (metres): the fen and the downs have an edge, the others shade off
  fade: 1500,                              // beyond the home country's box the regions come in over this distance
  home: 0,                                 // the home country's own kind
};
// what each kind does, in the order of RG (heart, downs, fen, moor, weald)
const RP = {
  relief:  [1,    0.3,   0,     1.15,  0.7],   // the broad uplands and ranges of the country, of their full height
  lift:    [0,    8,     -8,    24,    0],     // the whole of it raised or let down (metres)
  knoll:   [1,    0.3,   0.03,  0.7,   1.75],  // the small close hills
  swell:   [1,    1,     0.12,  1,     1],     // the broad swells of the ground
  rim:     [1,    0.7,   0.4,   1.1,   0.85],  // the height of a border range where it runs through
  stream:  [1,    5,     0.55,  0.7,   0.8],   // the land a stream must drain before it runs (of 1.6 km2): the chalk swallows its water, the fen and the moor shed it
  incise:  [1,    1,     0.06,  0.75,  1],     // how deep a river has cut its valley
  meander: [1,    1,     0.22,  1,     1],     // how far its line wanders
  wetK:    [0,    -0.3,  0.75,  0.32,  0],     // wet ground added (on the flat) or taken away
  wood:    [0,    -0.34, -0.3,  -0.6,  0.3],   // more or less woodland
  heath:   [0,    -0.3,  -1,    0.5,   -0.08], // more or less heath
  conif:   [0,    -0.8,  -0.9,  0.3,   -0.55], // pine against broadleaf
  plough:  [1,    0.95,  0.9,   0.15,  0.72],  // how much of the good land is ploughed
  graze:   [1,    1.2,   1,     0.7,   1],     // and grazed
  field:   [1,    1.9,   1.5,   1.2,   0.72],  // the size of a field
  openF:   [0.45, 0.85,  0.7,   0,     0.1],   // how many furlongs lie open (no hedge between their strips)
  village: [1,    1,     0.8,   0,     0.3],   // how readily people gather into villages
  hamlet:  [1,    0.35,  0.5,   0.8,   1.5],   // and into hamlets
  farms:   [1,    0.4,   0.6,   0.8,   1.5],   // how many farmsteads stand out in the fields
  spread:  [1,    1.25,  1.1,   0.85,  0.85],  // how far a place's fields reach
  green:   [0.5,  0.85,  0.3,   0.85,  0.3],   // how many of the farm lanes are green lanes
  sunk:    [1,    1.1,   0,     0.6,   1.6],   // how deep the ways have worn into the slopes
  // the colour of the open turf (multipliers on the colour it would have in the heartland)
  tr: [1, 1.13, 0.8, 1.12, 0.84], tg: [1, 1.05, 0.95, 0.91, 1.02], tb: [1, 0.9, 0.76, 0.8, 0.8],
};
// what bounds a field in each kind: a hedge, a dry-stone wall, or nothing that stands (a ditch, a baulk of grass)
const RG_BOUND = ['hedge', 'none', 'none', 'wall', 'hedge'];
// what people build with: [walls of a house (one picked), its roofs (one picked), the tint of the roof, walls of a barn, roof of a barn]
const RG_BUILD = [
  { walls: ['timber2', 'timber2', 'stone', 'plaster', 'plaster'], roofs: ['roofThatch', 'roofThatch', 'roofThatch', 'roofSlate'], tint: [1, 0.95, 0.86], barn: 'wood', barnRoof: 'roofBrown' },
  { walls: ['stoneLight', 'stoneLight', 'plaster', 'plaster'], roofs: ['roofThatch'], tint: [1.08, 1.0, 0.84], barn: 'stoneLight', barnRoof: 'roofThatch' },        // chalk and flint under pale thatch
  { walls: ['brick', 'brick', 'timber', 'wood'], roofs: ['roofRed', 'roofRed', 'roofThatch'], tint: [0.92, 0.84, 0.74], barn: 'wood', barnRoof: 'roofThatch' },       // brick and tarred board, pantiles and dark reed
  { walls: ['stone'], roofs: ['roofSlate'], tint: [0.9, 0.92, 0.98], barn: 'stone', barnRoof: 'roofSlate' },                                                           // grey stone and slate
  { walls: ['timber', 'timber', 'timber2', 'brick'], roofs: ['roofBrown', 'roofBrown', 'roofRed'], tint: [1, 0.92, 0.84], barn: 'wood', barnRoof: 'roofBrown' },      // oak frames and tile
];

REGION.c = Math.cos(REGION.rot); REGION.s = Math.sin(REGION.rot);
const regionKindOf = (i, j) => { let u = _h2(i, j, 552 + WSEED * 57); const S = REGION.share; for (let k = 0; k < RG_N; k++) { if (u < S[k]) return k; u -= S[k]; } return RG_N - 1; };
// the weights of the kinds at a point, worked out afresh (regionW keeps them on a grid)
const _rgD = new Float32Array(9), _rgK = new Uint8Array(9), _rgU = new Float32Array(9);
function regionRaw(x, z, out) {
  const R = REGION, s = WSEED * 57;
  const wx = x + R.warp * fbm(x / 3100 + 1.7, z / 3100, 2, 540 + s) + 0.26 * R.warp * fbm(x / 760, z / 760, 2, 542 + s), wz = z + R.warp * fbm(x / 3100, z / 3100 + 5.3, 2, 541 + s) + 0.26 * R.warp * fbm(x / 760 + 3.9, z / 760, 2, 543 + s);
  const u = (wx * R.c + wz * R.s) / R.cell, v = (-wx * R.s + wz * R.c) / R.cell, iu = Math.floor(u), iv = Math.floor(v);
  let n = 0, f1 = 1e9;
  for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ci = iu + a, cj = iv + b, su = ci + 0.5 + R.jitter * (_h2(ci, cj, 550 + s) - 0.5), sv = cj + 0.5 + R.jitter * (_h2(ci, cj, 551 + s) - 0.5), d = Math.hypot(u - su, v - sv) * R.cell;
    _rgD[n] = d; _rgK[n] = regionKindOf(ci, cj); if (d < f1) f1 = d; n++; }
  // how broad the change is here: the breadth of the kinds about, by a first even blend (so it varies smoothly from place to place)
  let su = 0, sb = 0; for (let q = 0; q < 9; q++) { const t = 1 - (_rgD[q] - f1) / 1300, w = t > 0 ? t * t : 0; su += w; sb += w * R.edge[_rgK[q]]; }
  const B = sb / su; out.fill(0); let sum = 0;
  for (let q = 0; q < 9; q++) { const t = 1 - (_rgD[q] - f1) / B; if (t <= 0) continue; const w = t * t; out[_rgK[q]] += w; sum += w; }
  for (let k = 0; k < RG_N; k++) out[k] /= sum;
  return out;
}
// the field on a grid of 80 m (tiles of 16 x 16 cells, made as they are asked for): the weights change over hundreds of metres, so
// reading them from the grid loses nothing, and the ground is asked for millions of times
const RT_C = 80, RT_N = 16, RT_S = RT_C * RT_N, _RT = new Map(); let _rtI = NaN, _rtJ = NaN, _rtT = null;
function regionTile(ti, tj) {
  const key = (ti + 32768) * 65536 + tj + 32768; let T = _RT.get(key); if (T) return T;
  const S = RT_N + 1, w = new Float32Array(RG_N); T = new Float32Array(S * S * RG_N);
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { regionRaw(ti * RT_S + i * RT_C, tj * RT_S + j * RT_C, w); T.set(w, (j * S + i) * RG_N); }
  if (_RT.size > 1600) _RT.delete(_RT.keys().next().value);
  _RT.set(key, T); return T;
}
// the weights of the kinds at a point: an array of RG_N numbers that sum to 1 (shared: read it at once), or null where the land is the
// home country's own kind and nothing else (the whole of the home country, and all of it while the home country is planned)
const _rw = new Float32Array(RG_N); let _rwx = NaN, _rwz = NaN, _rwOk = false;
function regionW(x, z) {
  if (LEGACY) return null; const ho = homeOut(x, z); if (ho <= 0) return null;
  if (x === _rwx && z === _rwz) return _rw;
  const fx = x / RT_C, fz = z / RT_C, ti = Math.floor(fx / RT_N), tj = Math.floor(fz / RT_N);
  if (ti !== _rtI || tj !== _rtJ) { _rtT = regionTile(ti, tj); _rtI = ti; _rtJ = tj; }
  const lx = fx - ti * RT_N, lz = fz - tj * RT_N, i = Math.min(RT_N - 1, Math.floor(lx)), j = Math.min(RT_N - 1, Math.floor(lz)), u = lx - i, v = lz - j, S = RT_N + 1, T = _rtT;
  const k0 = (j * S + i) * RG_N, k1 = k0 + RG_N, k2 = k0 + S * RG_N, k3 = k2 + RG_N, a = (1 - u) * (1 - v), b = u * (1 - v), c = (1 - u) * v, d = u * v;
  for (let q = 0; q < RG_N; q++) _rw[q] = T[k0 + q] * a + T[k1 + q] * b + T[k2 + q] * c + T[k3 + q] * d;
  if (ho < REGION.fade) { const k = smoothstep(0, REGION.fade, ho); for (let q = 0; q < RG_N; q++) _rw[q] *= k; _rw[REGION.home] += 1 - k; }
  _rwx = x; _rwz = z; return _rw;
}
// a property of the land at a point: the kinds' values of it, mixed by their weights
function regionMix(w, a) { return w ? w[0] * a[0] + w[1] * a[1] + w[2] * a[2] + w[3] * a[3] + w[4] * a[4] : a[REGION.home]; }
function regionP(x, z, a) { return regionMix(regionW(x, z), a); }
// how much of one kind a place is (0..1)
function regionIs(x, z, k) { const w = regionW(x, z); return w ? w[k] : k === REGION.home ? 1 : 0; }
// the kind that leads at a place, and one kind picked by the weights with a draw u in 0..1 (so houses, walls and lanes change over
// a border one by one, not all at a line)
function regionKind(x, z) { const w = regionW(x, z); if (!w) return REGION.home; let b = 0; for (let k = 1; k < RG_N; k++) if (w[k] > w[b]) b = k; return b; }
function regionPick(x, z, u) { const w = regionW(x, z); if (!w) return REGION.home; for (let k = 0; k < RG_N; k++) { if (u < w[k]) return k; u -= w[k]; } return RG_N - 1; }

/* ---------- the shape each kind gives the ground (metres, added to the country's own relief) ---------- */
// a tor: a knoll of piled rock on the open moor. One may stand in each cell of a lattice of 560 m: [x, z, size] or null
const TOR_C = 560;
function torNear(x, z) {
  const i = Math.floor(x / TOR_C), j = Math.floor(z / TOR_C), s = WSEED * 57; if (_h2(i, j, 580 + s) > 0.42) return null;
  return [(i + 0.22 + 0.56 * _h2(i, j, 581 + s)) * TOR_C, (j + 0.22 + 0.56 * _h2(i, j, 582 + s)) * TOR_C, 0.7 + 0.6 * _h2(i, j, 583 + s)];
}
// the level a fen lies at (its ground is within a metre of it): the plain's own level, let down to that of the valley floors
function fenBase(x, z) { return 0.6 + 45 * (1 - Math.exp(-Math.max(0, SHORE - z) / 330)) + 70 * smoothstep(1500, 14000, coastZ(x) - z) + RP.lift[RG.fen]; }
// a mere: a sheet of shallow open water in a hollow of the fen, 0 (none) .. 1 (its middle). Only well inland, where the fen is level
function mereAt(x, z) { const w = regionW(x, z); if (!w || w[RG.fen] < 0.86 || coastZ(x) - z < 14200) return 0; return smoothstep(0.3, 0.42, -fbm(x / 640 + WSEED * 3.7, z / 640, 2, 571)) * smoothstep(0.86, 0.97, w[RG.fen]); }
const MERE_DEPTH = 1.9, MERE_LEVEL = -0.75; // the bed of a mere below the fen's level, and its water
function regionShape(x, z, w) {
  let h = 0; const s = WSEED * 57;
  { const k = w[RG.downs]; if (k > 0.004) { // downs: broad whale-backed hills of chalk, dry valleys winding into them, a scarp along part of their edge
    let d = 46 * smoothstep(-0.5, 0.5, fbm(x / 1250 + s, z / 1250, 2, 560)) + 8 * fbm(x / 500, z / 500, 2, 561);
    d -= 15 * (1 - smoothstep(0.012, 0.1, Math.abs(fbm(x / 820 + 3.1, z / 820 + s, 2, 562)))) * smoothstep(6, 30, d); // the coombes
    const sc = smoothstep(0.3, 0.62, 0.5 + 0.9 * fbm(x / 4300 + 9.1, z / 4300, 2, 563 + s));                              // where the edge is a scarp, and where it shades off
    h += lerp(k, smoothstep(0.36, 0.6, k), sc) * (d + 14); } }
  { const k = w[RG.fen]; if (k > 0.004) { // fen: level, with low islands of firm ground and shallow meres
    let f = 6.5 * smoothstep(0.26, 0.5, fbm(x / 820 + s, z / 820, 2, 570)) + 0.3 * fbm(x / 85, z / 85, 2, 572);
    if (k > 0.86 && coastZ(x) - z > 14200) f -= (MERE_DEPTH + 0.3) * smoothstep(0.3, 0.42, -fbm(x / 640 + WSEED * 3.7, z / 640, 2, 571)) * smoothstep(0.86, 0.97, k);
    h += k * f; } }
  { const k = w[RG.moor]; if (k > 0.004) { // moor: high, broad-backed, rough underfoot; tors on its tops
    let m = 17 * fbm(x / 880 + s, z / 880, 3, 565) + 4.5 * fbm(x / 170, z / 170, 2, 566) + 1.3 * fbm(x / 36, z / 36, 2, 567);
    if (k > 0.5) { const t = torNear(x, z); if (t) { const d = Math.hypot(x - t[0], z - t[1]) / (30 * t[2]); if (d < 2.4) m += 7.5 * t[2] * Math.exp(-d * d) * smoothstep(0.5, 0.75, k); } }
    h += k * m; } }
  { const k = w[RG.weald]; if (k > 0.004) h -= k * 7 * (1 - smoothstep(0.01, 0.075, Math.abs(fbm(x / 430 + s, z / 430, 2, 569)))); } // weald: steep little stream valleys (ghylls) between its close hills
  return h;
}
