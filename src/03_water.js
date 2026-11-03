/* =====================================================================
   Water: the rivers of the whole play area, planned once at load.
   The ground is flooded up from the sea on a coarse grid, so every hollow
   finds a way out; water gathers downhill, and where enough of it has
   gathered a river runs, in a valley cut for it. Smaller rivers join larger
   ones and all of them reach the sea. Near the city one stream is laid by
   hand: it rises north of Pilgrim's Rise and meets the bay east of the walls.
   ===================================================================== */
const LAND = { ready: false, rivers: [], segs: null, hash: null, HC: 160, ms: 0 };
const LAND_C = 100;                                                  // the planning grid
const landZone = (x, z) => Math.abs(x) < 640 && z > -700;           // the surveyed land and its fields: no planned river comes in here
// the stream by the city, laid by hand: from its spring north of Pilgrim's Rise, down the valley east of the fields, under the East road to the beach
const HAND_RIVER = [[225, -548], [262, -520], [313, -475], [360, -425], [407, -378], [447, -335], [474, -275], [505, -215], [526, -150], [536, -80], [540, -20], [538, 40], [527, 95], [507, 150], [499, 195], [505, 250]];
const HAND_BRIDGE = { x: 540, z: -20 };                              // where the road east crosses it

function smin(a, b, k) { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); }

// the river valleys cut into the raw ground: around a river the land is let down by as much as the river needs (fading out with distance,
// so the hills keep their shape), and the floor beside the water is laid level a little above it
const LS = 12; // floats per valley segment: ax az bx bz, water level at a and b, floor half-width, cut at a and b, reach, width, planned (1) or laid by hand (0)
// the planned rivers leave the surveyed land round the city as it is
const zoneFade = (x, z) => Math.max(smoothstep(500, 640, Math.abs(x)), smoothstep(-560, -700, z));
function landCarve(x, z, h) {
  const L = LAND, list = L.hash.get((Math.floor(x / L.HC) + 4096) * 8192 + Math.floor(z / L.HC) + 4096); if (!list) return h;
  // each river near by gives the ground its own valley profile; the lowest of them wins. (Taking the cut from one river and the floor
  // from another, as before, stepped the ground by tens of metres where two rivers at different levels run side by side.)
  const S = L.segs; let out = h, zf = -1;
  for (let q = 0; q < list.length; q++) {
    const o = list[q] * LS, ax = S[o], az = S[o + 1], dx = S[o + 2] - ax, dz = S[o + 3] - az, R = S[o + 9];
    let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const ex = x - ax - dx * t, ez = z - az - dz * t, d2 = ex * ex + ez * ez; if (d2 > R * R) continue;
    const d = Math.sqrt(d2), Fw = S[o + 6], c0 = S[o + 7] + (S[o + 8] - S[o + 7]) * t;
    let k = 1; if (S[o + 11] > 0) { if (zf < 0) zf = zoneFade(x, z); k = zf; if (k <= 0) continue; }
    const cut = c0 * (1 - smoothstep(Fw, R, d)) * k, floor = S[o + 4] + (S[o + 5] - S[o + 4]) * t + 0.5 + 0.4 * smoothstep(3, 8, S[o + 10]);
    let v = Math.max(h - cut, Math.min(h, floor)); // never let down below the river's own floor
    const fw = (1 - smoothstep(Fw * 0.5, Fw + 8, d)) * k;
    if (fw > 0 && !(v < floor && h < SEA + 1)) v += (floor - v) * fw; // the floor beside the water laid level (the sea and the beach at a river's mouth keep their own ground)
    if (v < out) out = v;
  }
  return out;
}
function riverD(x, z) { const T = LAND.rd; if (!T) return 9999; const fx = (x - T.X0) / T.C, fz = (z - T.Z0) / T.C, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= T.NI - 1 || j >= T.NJ - 1) return 9999; const u = fx - i, v = fz - j, k = j * T.NI + i, D = T.D; return lerp(lerp(D[k], D[k + 1], u), lerp(D[k + T.NI], D[k + T.NI + 1], u), v); }
function terrainRaw(x, z) { const h = terrainBase(x, z); return siteFix(x, z, LAND.ready ? landCarve(x, z, h) : h); } // the sites' fixed ground last: no river is cut through it
// the nearest river to a point within reach r: { d, w } (distance to the middle of the water, its width), or null
function riverNear(x, z, r = 40) {
  const L = LAND; if (!L.ready) return null; const list = L.hash.get((Math.floor(x / L.HC) + 4096) * 8192 + Math.floor(z / L.HC) + 4096); if (!list) return null;
  const S = L.segs; let best = null;
  for (let q = 0; q < list.length; q++) {
    const o = list[q] * LS, ax = S[o], az = S[o + 1], dx = S[o + 2] - ax, dz = S[o + 3] - az;
    let t = ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1); t = t < 0 ? 0 : t > 1 ? 1 : t;
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < r && (!best || d < best.d)) best = { d, w: S[o + 10] };
  }
  return best;
}

function planLand() {
  if (LAND.ready) return;
  const t0 = performance.now(), C = LAND_C, M = 480, X0 = WORLD.x0 - M, Z0 = WORLD.z0 - M;
  const NI = Math.round((WORLD.x1 - WORLD.x0 + 2 * M) / C) + 1, NJ = Math.round((WORLD.z1 - WORLD.z0 + 2 * M) / C) + 1, n = NI * NJ;
  const H = new Float32Array(n), F = new Float32Array(n), rec = new Int32Array(n).fill(-1), st = new Uint8Array(n); // st: 0 unseen, 1 reached, 2 kept out
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const k = j * NI + i, x = X0 + i * C, z = Z0 + j * C; if (landZone(x, z) || siteZone(x, z, 60)) st[k] = 2; else H[k] = terrainBase(x, z); }
  const tGrid = performance.now();
  // flood up from the sea and from the edge of the grid (beyond the mountains), lowest first
  const hk = new Float64Array(n), hv = new Int32Array(n); let hn = 0;
  const push = (k, f) => { let i = hn++; while (i > 0) { const p = (i - 1) >> 1; if (hk[p] <= f) break; hk[i] = hk[p]; hv[i] = hv[p]; i = p; } hk[i] = f; hv[i] = k; };
  const pop = () => { const top = hv[0], f = hk[--hn], v = hv[hn]; let i = 0; for (;;) { let c = 2 * i + 1; if (c >= hn) break; if (c + 1 < hn && hk[c + 1] < hk[c]) c++; if (hk[c] >= f) break; hk[i] = hk[c]; hv[i] = hv[c]; i = c; } hk[i] = f; hv[i] = v; return top; };
  const sea = new Uint8Array(n);
  for (let k = 0; k < n; k++) { if (st[k] === 2) continue; const i = k % NI, j = (k - i) / NI;
    if (H[k] < SEA) { sea[k] = 1; st[k] = 1; F[k] = H[k]; push(k, F[k]); } else if (i === 0 || j === 0 || i === NI - 1 || j === NJ - 1) { sea[k] = 2; st[k] = 1; F[k] = H[k]; push(k, F[k]); } }
  const order = new Int32Array(n); let on = 0;
  const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
  while (hn) {
    const k = pop(); order[on++] = k; const i = k % NI, j = (k - i) / NI, f = F[k];
    for (let d = 0; d < 8; d++) { const a = i + DI[d], b = j + DJ[d]; if (a < 0 || b < 0 || a >= NI || b >= NJ) continue; const q = b * NI + a; if (st[q]) continue;
      st[q] = 1; F[q] = Math.max(H[q], f + (d < 4 ? 0.02 : 0.028)); rec[q] = k; push(q, F[q]); }
  }
  // gather the water downhill, and note where each cell's water leaves the land: the sea (1) or the edge of the world (2)
  const A = new Float32Array(n), out = new Uint8Array(n);
  for (let t = on - 1; t >= 0; t--) { const k = order[t]; if (!sea[k]) { A[k] += 1; if (rec[k] >= 0) A[rec[k]] += A[k]; } }
  for (let t = 0; t < on; t++) { const k = order[t]; out[k] = sea[k] ? sea[k] : out[rec[k]]; }
  const tFlood = performance.now();
  const Amin = 1.6e6 / (C * C);                                  // a river once 1.6 km² of land drains to it
  const ch = k => k >= 0 && !sea[k] && A[k] >= Amin && out[k] === 1;
  const main = new Int32Array(n).fill(-1), dHead = new Int32Array(n).fill(-1), dNext = new Int32Array(n).fill(-1);
  for (let t = 0; t < on; t++) { const k = order[t]; if (!ch(k)) continue; const r = rec[k]; dNext[k] = dHead[r]; dHead[r] = k; if (main[r] < 0 || A[k] > A[main[r]]) main[r] = k; }
  const widthOf = a => Math.min(16, 1.2 + 1.6 * Math.sqrt(a * C * C / 1e6));
  // rivers from the mouth upstream along the larger branch; every other branch is a tributary that joins it
  const todo = []; for (let t = 0; t < on; t++) { const k = order[t]; if (ch(k) && sea[rec[k]] === 1) todo.push({ k, parent: -1, at: rec[k] }); }
  const rivers = [], rng = new RNG(5100 + WSEED * 7);
  for (let qi = 0; qi < todo.length; qi++) {
    const { k: k0, parent, at } = todo[qi]; const cells = [];
    for (let k = k0; k >= 0; k = main[k]) cells.push(k);
    if (cells.length < (parent < 0 ? 6 : 9)) continue;            // too short to be worth a river of its own
    cells.reverse();                                             // head to mouth
    const ri = rivers.length;
    for (let c = cells.length - 1; c >= 0; c--) for (let d = dHead[cells[c]]; d >= 0; d = dNext[d]) if (d !== main[cells[c]]) todo.push({ k: d, parent: ri, at: cells[c] });
    let pts = cells.map(k => { const i = k % NI; return [X0 + i * C, Z0 + (k - i) / NI * C]; });
    const area = cells.map(k => A[k]);
    if (parent < 0) { const i = at % NI; pts.push([X0 + i * C, Z0 + (at - i) / NI * C]); area.push(area[area.length - 1]); }
    rivers.push({ cells: pts, area, parent, joinAt: at, end: parent < 0 ? 'sea' : 'join' });
  }
  // the hand-laid stream: its spring, its valley and its mouth are fixed; it is treated like the rest from here on
  rivers.push({ cells: HAND_RIVER.map(p => p.slice()), area: HAND_RIVER.map((_, q) => (0.5 + 11.5 * (q / (HAND_RIVER.length - 1)) ** 1.4) * 1e6 / (C * C)), parent: -1, end: 'sea', hand: true });
  // each river's line: the grid's steps rounded off, broad bends, then the meanders of the water itself
  const segs = [], built = [];
  for (const R of rivers) {
    if (R.parent >= 0 && !built[R.parent]) continue;
    let V = R.hand ? smoothPath(R.cells, 3) : smoothPath(simplifyPath(R.cells, 28), 4); // the grid's staircase straightened first, so the bends come out broad (not so far that it leaves its valley)
    if (R.parent >= 0) { // run on into the parent river's line, where it meets it
      const Pv = built[R.parent].V, [ex, ez] = V[V.length - 1]; let bq = 0, bd = 1e9; for (let q = 0; q < Pv.length; q++) { const d = Math.hypot(Pv[q][0] - ex, Pv[q][1] - ez); if (d < bd) { bd = d; bq = q; } }
      V.push(Pv[bq].slice()); R.joinQ = bq;
    }
    V = resampleEven(V, 20);
    const L = V.length, nrm = V.map((_, q) => { const a = V[Math.max(0, q - 1)], b = V[Math.min(L - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; });
    const sd = rng.next() * 100;
    if (!R.hand) V = V.map((p, q) => { const off = 48 * fbm(q * 20 / 560 + sd, 1.7, 2, 381) * Math.min(1, q / 6, (L - 1 - q) / 6); return [p[0] + nrm[q][0] * off, p[1] + nrm[q][1] * off]; });
    // width from the land drained, at each point of the line (by its share of the way down)
    const w = V.map((_, q) => widthOf(R.area[Math.min(R.area.length - 1, Math.round(q / (L - 1) * (R.area.length - 1)))]) * (R.hand ? 1 : lerp(0.45, 1, Math.min(1, q * 20 / 400)))); // a spring's trickle at first
    const Fw = w.map(v => v / 2 + 5 + 1.6 * v);
    // the water level: the low ground across the valley floor, never rising downstream
    const gb = V.map(([x, z], q) => { if (q % 2 && q < L - 1) return null; const [nx, nz] = nrm[q]; let g = Infinity; for (const f of [-0.5, 0, 0.5]) g = Math.min(g, terrainBase(x + nx * Fw[q] * f, z + nz * Fw[q] * f)); return g; }); // every other point, the rest between
    for (let q = 1; q < L - 1; q += 2) gb[q] = (gb[q - 1] + gb[q + 1]) / 2;
    // larger rivers have worn deeper valleys into the land
    const inc = w.map((v, q) => R.hand ? 0 : (2 + 2.8 * v) * Math.min(1, q * 20 / 1500)); // (a young stream has hardly cut in)
    const wl = [];
    for (let q = 0; q < L; q++) { const g = gb[q] - 0.6 - inc[q]; wl.push(q ? Math.min(wl[q - 1] - 0.03, g) : g); }
    for (let q = 0; q < L; q++) wl[q] = Math.max(wl[q], SEA);
    if (R.parent >= 0) { const pw = built[R.parent].wl[R.joinQ]; wl[L - 1] = pw; for (let q = L - 2; q >= 0; q--) wl[q] = Math.max(wl[q], wl[q + 1] + 0.01); }
    // how far the ground must come down where the river runs through higher ground (a gorge through a ridge), and how far round that reaches
    const cut0 = gb.map((g, q) => Math.max(0, g - (wl[q] + 0.5))), cut = cut0.slice();
    for (let q = 0; q < L; q++) for (let k = -3; k <= 3; k++) cut[q] = Math.max(cut[q], cut0[clamp(q + k, 0, L - 1)] * (1 - Math.abs(k) / 4)); // a gorge opens and closes gradually
    const reach = cut.map((c, q) => Fw[q] + 50 + Math.min(750, Math.max(c * 4.5, R.hand ? 0 : 110 + 26 * w[q])));
    for (let q = 1; q < L; q++) segs.push([V[q - 1][0], V[q - 1][1], V[q][0], V[q][1], wl[q - 1], wl[q], (Fw[q - 1] + Fw[q]) / 2, cut[q - 1], cut[q], Math.max(reach[q - 1], reach[q]), (w[q - 1] + w[q]) / 2, R.hand ? 0 : 1]);
    built[rivers.indexOf(R)] = { V, wl, w };
    // the water's own course: meanders within the valley floor, sampled finely for the ground and the water
    const P0 = resampleEven(V, 4), PL = P0.length, Pw = [], Pwl = [];
    for (let q = 0; q < PL; q++) { const f = q / (PL - 1) * (L - 1), a = Math.floor(f), b = Math.min(L - 1, a + 1), u = f - a; Pw.push(lerp(w[a], w[b], u) * (1 + 0.22 * fbm(q * 4 / 160 + sd * 0.7, 9.1, 2, 383))); Pwl.push(lerp(wl[a], wl[b], u)); } // wider in the pools, narrower at the riffles
    const pn = P0.map((_, q) => { const a = P0[Math.max(0, q - 1)], b = P0[Math.min(PL - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [-(b[1] - a[1]) / l, (b[0] - a[0]) / l]; });
    const P = P0.map((p, q) => { const off = (3 + Pw[q] * 0.9) * fbm(q * 4 / 130 + sd * 1.3, 3.3, 2, 371) * Math.min(1, q / 10, (PL - 1 - q) / 10); return [p[0] + pn[q][0] * off, p[1] + pn[q][1] * off]; });
    const xs = P.map(p => p[0]), zs = P.map(p => p[1]), pad = 30;
    R.out = { P, w: Pw, wl: Pwl, end: R.end, hand: !!R.hand, box: [Math.min(...xs) - pad, Math.min(...zs) - pad, Math.max(...xs) + pad, Math.max(...zs) + pad] };
  }
  const tRiv = performance.now();
  // the cut valleys, found by the cells they reach
  const S = new Float32Array(segs.length * LS), hash = new Map(), HC = LAND.HC;
  segs.forEach((s, q) => { S.set(s, q * LS); const R = s[9];
    const i0 = Math.floor((Math.min(s[0], s[2]) - R) / HC), i1 = Math.floor((Math.max(s[0], s[2]) + R) / HC), j0 = Math.floor((Math.min(s[1], s[3]) - R) / HC), j1 = Math.floor((Math.max(s[1], s[3]) + R) / HC);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { // only the cells the reach really touches
      const cx = Math.max(i * HC, Math.min((s[0] + s[2]) / 2, (i + 1) * HC)), cz = Math.max(j * HC, Math.min((s[1] + s[3]) / 2, (j + 1) * HC)); if (Math.hypot(cx - (s[0] + s[2]) / 2, cz - (s[1] + s[3]) / 2) > R + 12) continue;
      const k = (i + 4096) * 8192 + j + 4096; let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(q); } });
  for (const [k, l] of hash) hash.set(k, Int32Array.from(l));
  LAND.segs = S; LAND.hash = hash; LAND.rivers = rivers.filter(R => R.out).map(R => R.out); LAND.ready = true;
  // how far each place lies from a river of some size (chamfer distance on a 32 m grid, to some 700 m): its valley is farmed
  { const C2 = 32, X1 = WORLD.x0 - 600, Z1 = WORLD.z0 - 600, NI2 = Math.ceil((WORLD.x1 - WORLD.x0 + 1200) / C2) + 1, NJ2 = Math.ceil((WORLD.z1 - WORLD.z0 + 1200) / C2) + 1, D = new Float32Array(NI2 * NJ2).fill(9999);
    for (const R of LAND.rivers) for (let q = 0; q < R.P.length; q += 4) { if (R.w[q] < 3.5) continue; const i = Math.round((R.P[q][0] - X1) / C2), j = Math.round((R.P[q][1] - Z1) / C2); if (i >= 0 && j >= 0 && i < NI2 && j < NJ2) D[j * NI2 + i] = 0; }
    const d1 = C2, d2 = C2 * 1.4142;
    for (let j = 0; j < NJ2; j++) for (let i = 0; i < NI2; i++) { const k = j * NI2 + i; let v = D[k]; if (i > 0) v = Math.min(v, D[k - 1] + d1); if (j > 0) { v = Math.min(v, D[k - NI2] + d1); if (i > 0) v = Math.min(v, D[k - NI2 - 1] + d2); if (i < NI2 - 1) v = Math.min(v, D[k - NI2 + 1] + d2); } D[k] = v; }
    for (let j = NJ2 - 1; j >= 0; j--) for (let i = NI2 - 1; i >= 0; i--) { const k = j * NI2 + i; let v = D[k]; if (i < NI2 - 1) v = Math.min(v, D[k + 1] + d1); if (j < NJ2 - 1) { v = Math.min(v, D[k + NI2] + d1); if (i < NI2 - 1) v = Math.min(v, D[k + NI2 + 1] + d2); if (i > 0) v = Math.min(v, D[k + NI2 - 1] + d2); } D[k] = v; }
    LAND.rd = { C: C2, X0: X1, Z0: Z1, NI: NI2, NJ: NJ2, D }; }
  LAND.ms = Math.round(performance.now() - t0); LAND.prof = [tGrid - t0, tFlood - tGrid, tRiv - tFlood, performance.now() - tRiv].map(Math.round); LAND.grid = { NI, NJ, C, X0, Z0 };
}
