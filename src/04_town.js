/* =====================================================================
   Towns: a generator for walled towns on flat ground, driven by one
   config. The plan (wall, gates, canal, streets, blocks, lots, districts,
   landmarks) is laid out once at load as plain data; the buildings are
   built with the ground chunk they stand in, as the player comes near,
   and a cheap block silhouette stands for the whole town from afar.
   A town grows like a polycrystal: a small planned old town in a strict
   grid at the middle, ringed by a boulevard where its first wall stood,
   and around it looser quarters, each cut into blocks along its own
   road at its own angle and scale, inside an irregular polygonal wall.
   The first is Corrinvale, a lowland canal town in the north.
   See CITIES.md for what Daggerfall and this town taught about cities.
   ===================================================================== */

// One config per town. Lengths in metres; u runs along the town's long axis, v across it (+v is south when ang is 0)
const TOWN_CFGS = [{
  id: 'corrinvale', name: 'Corrinvale', x: -2200, z: -13600, ang: 0.12, seed: 9101,
  A: 470, B: 380,              // half-length and half-width of the walled rectangle
  H0: 96,                      // the level of the plain it stands on
  rc: 1300, rb: 2400,          // the fixed ground: wholly within rc, blending out to rb
  wall: { h: 10.5, t: 3, towerEvery: 46, tower: 8.5, towerH: 17, gateW: 6, corners: 11 },
  moat: { off: 7, w: 20 },     // its inner edge off the wall's foot, its width
  canal: { v: -52, w: 14, quay: 6 },
  mainU: 0, mainV: 34,         // the two main streets of the old town; roads run on from them to the gates
  ring: { off: 13, w: 7 },     // the street inside the wall
  core: { a: 0.32, b: 0.32, bw: 10, du: [30, 42], dv: [28, 38] }, // the old town: its half-size as a share of the wall's, the boulevard round it, its grid
  street: { w: 8, main: 12 },
  blurb: 'a walled town of canals and tall brick gables on the northern plain',
  districts: [ // checked in order; the first that claims a point names it
    { id: 'old', name: 'the Old Town', blurb: 'tall brick houses on the first streets, laid out in a grid', wealth: 2 },
    { id: 'grand', name: 'the Grand Square', blurb: 'merchants’ houses with stepped gables round the belfry', wealth: 3 },
    { id: 'close', name: 'the Cathedral Close', blurb: 'quiet stone houses in the shadow of Saint Aurel’s spire', wealth: 2.2 },
    { id: 'citadel', name: 'the Citadel Ward', blurb: 'barracks, smithies and armourers under the citadel', wealth: 1.5 },
    { id: 'canal', name: 'the Canal Quarter', blurb: 'warehouses and guild halls along the water', wealth: 2.2 },
    { id: 'commons', name: 'the Commons', blurb: 'low cottages and gardens under the walls', wealth: 0.7 },
    { id: 'weavers', name: 'the Weavers’ Quarter', blurb: 'timber houses of the cloth trade, three storeys high', wealth: 1.3 },
    { id: 'tanners', name: 'the Tanners’ Ward', blurb: 'narrow lanes of low workshops and drying yards', wealth: 0.9 },
  ],
}];

// how each quarter builds: plot frontage and depth, storeys, walls and roofs
const TK = {
  old: { w: [6.5, 10], d: [12, 16], stories: [3, 3, 4, 2], styles: ['brick', 'brick', 'stone', 'plaster'], roofs: ['roofRed', 'roofRed', 'roofBrown'], step: 0.5, jetty: 0.1 },
  tanners: { w: [5, 8], d: [8, 11], stories: [1, 2, 2], styles: ['timber2', 'plaster', 'wood', 'brick'], roofs: ['roofThatch', 'roofBrown', 'roofThatch'], step: 0, jetty: 0.3 },
  grand: { w: [7, 11], d: [14, 18], stories: [3, 3, 4], styles: ['brick', 'brick', 'stone'], roofs: ['roofSlate', 'roofSlate', 'roofRed'], step: 0.75, jetty: 0 },
  close: { w: [8, 12], d: [12, 16], stories: [2, 3], styles: ['stone', 'stoneLight', 'brick'], roofs: ['roofSlate'], step: 0.35, jetty: 0 },
  citadel: { w: [8, 12], d: [12, 16], stories: [2, 2, 3], styles: ['stone', 'brick', 'timber2'], roofs: ['roofSlate', 'roofBrown'], step: 0.15, jetty: 0.2 },
  canal: { w: [8, 13], d: [14, 20], stories: [3, 4], styles: ['brick', 'brick', 'timber2'], roofs: ['roofRed', 'roofRed', 'roofBrown'], step: 0.55, jetty: 0.1, warehouse: 0.45 },
  suburb: { w: [6, 9], d: [9, 11], stories: [1, 2, 2], styles: ['brick', 'timber2', 'brick', 'plaster'], roofs: ['roofThatch', 'roofBrown', 'roofBrown'], step: 0.3, jetty: 0.2 },
  commons: { w: [6, 9], d: [9, 12], stories: [1, 1, 2], styles: ['timber2', 'plaster', 'wood'], roofs: ['roofThatch', 'roofThatch', 'roofBrown'], step: 0, jetty: 0.1 },
  weavers: { w: [6, 9], d: [11, 15], stories: [2, 3, 3], styles: ['timber2', 'timber2', 'plaster', 'brick'], roofs: ['roofBrown', 'roofBrown', 'roofRed'], step: 0.2, jetty: 0.55 },
};

// how each kind of quarter is cut into blocks: block length and depth between street lines, and the width of its lanes
const TQ = {
  weavers: { du: [34, 48], dv: [30, 42], sw: 6 },
  tanners: { du: [24, 34], dv: [22, 30], sw: 5 },
  canal: { du: [44, 62], dv: [36, 48], sw: 7 },
  citadel: { du: [40, 56], dv: [36, 50], sw: 7 },
  commons: { du: [46, 64], dv: [40, 56], sw: 6 },
};

/* ---------------- plane geometry in the town frame (u, v) ---------------- */
// a half-plane {nu, nv, c} keeps the points p with n·p >= c
const tDot = (h, p) => h.nu * p[0] + h.nv * p[1];
function tClipPoly(P, h) { const out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], da = tDot(h, a) - h.c, db = tDot(h, b) - h.c; if (da >= 0) out.push(a); if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); } } return out; }
function tClipSeg(a, b, hs) { let t0 = 0, t1 = 1; for (const h of hs) { const da = tDot(h, a) - h.c, db = tDot(h, b) - h.c; if (da < 0 && db < 0) return null; if (da < 0) t0 = Math.max(t0, da / (da - db)); else if (db < 0) t1 = Math.min(t1, da / (da - db)); } if (t1 - t0 < 1e-3) return null; const P = t => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; return [P(t0), P(t1)]; }
function tArea(P) { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return s / 2; }
function tCentroid(P) { let x = 0, y = 0; for (const p of P) { x += p[0]; y += p[1]; } return [x / P.length, y / P.length]; }
// the inward half-plane of each edge of a convex polygon (either winding), set in by off
function tEdgesIn(P, off = 0) { const s = Math.sign(tArea(P)) || 1, out = []; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], du = b[0] - a[0], dv = b[1] - a[1], L = Math.hypot(du, dv); if (L < 1e-6) continue; const nu = -dv / L * s, nv = du / L * s; out.push({ nu, nv, c: nu * a[0] + nv * a[1] + off, i, a, b, L }); } return out; }
// how wide a convex polygon is across, at its narrowest
function tWidth(P) { let m = 1e9; for (const h of tEdgesIn(P)) { let w = 0; for (const p of P) w = Math.max(w, tDot(h, p) - h.c); m = Math.min(m, w); } return m; }
// the nearest point of a polyline
function tPolyDist(p, pts, closed = false) { let best = { d: 1e9 }; const n = pts.length - (closed ? 0 : 1); for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % pts.length], r = segDist(p[0], p[1], a[0], a[1], b[0], b[1]); if (r.d < best.d) best = { d: r.d, i, t: r.t, x: r.x, z: r.z }; } return best; }
// where a ray first leaves a closed polygon: distance, edge and the place along it
function tRay(P, p, d) { let best = null; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], r = segCross(p[0], p[1], p[0] + d[0] * 4000, p[1] + d[1] * 4000, a[0], a[1], b[0], b[1]); if (r && (!best || r[0] * 4000 < best.t)) best = { t: r[0] * 4000, i, f: r[1] }; } return best; }
function tHull(P) { const p = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1)); }
const tJit = (i, j, s) => { let h = Math.imul(i, 73856093) ^ Math.imul(j, 19349663) ^ Math.imul(s, 83492791); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296 - 0.5; };

class Town {
  constructor(cfg) {
    if (cfg.vary) { const r = new RNG(cfg.seed + 31), k = r.range(0.88, 1.12); cfg = { ...cfg, A: Math.round(cfg.A * k), B: Math.round(cfg.B / k), mainU: Math.round(r.range(-0.25, 0.25) * cfg.A), mainV: Math.round(r.range(-0.15, 0.3) * cfg.B), canal: { ...cfg.canal, v: Math.round(r.pick([-1, 1]) * r.range(0.15, 0.45) * cfg.B) }, flip: [r.chance(0.5), r.chance(0.5)], gates: r.chance(0.3) ? 3 : 4 };
      if (Math.abs(cfg.canal.v - cfg.mainV) < 60) cfg.canal.v = cfg.mainV + (cfg.canal.v > cfg.mainV ? 60 : -60); }
    this.cfg = cfg; this.id = cfg.id; this.name = cfg.name; this.x = cfg.x; this.z = cfg.z; this.H0 = cfg.H0;
    this.xf = makeXf(cfg.x, cfg.z, cfg.ang); this.c = Math.cos(cfg.ang); this.s = Math.sin(cfg.ang);
    this.plan();
  }
  // town frame <-> world
  w(u, v) { return xfP(this.xf, u, v); }
  local(x, z) { const dx = x - this.x, dz = z - this.z; return [dx * this.c - dz * this.s, dx * this.s + dz * this.c]; }
  // how far a point lies outside the wall (negative inside); the moat and the ground kept clear follow it
  wallOut(u, v) { let m = -1e9; for (const h of this.wallIn) m = Math.max(m, h.c - h.nu * u - h.nv * v); return m; }
  rectOut(x, z) { const [u, v] = this.local(x, z); return this.wallOut(u, v); }
  inside(x, z, m = 0) { return this.rectOut(x, z) < m; }
  // the wall's outline moved out by off (in by a negative off), corners mitred
  offPoly(off) { const H = this.wallIn; return H.map((h, i) => { const g = H[(i + H.length - 1) % H.length], det = g.nu * h.nv - g.nv * h.nu, c1 = g.c - off, c2 = h.c - off; return [(c1 * h.nv - g.nv * c2) / det, (g.nu * c2 - c1 * h.nu) / det]; }); }

  /* ---------------- the plan ---------------- */
  plan() {
    const C = this.cfg, rng = new RNG(C.seed), A = C.A, B = C.B, R = C.ring.off, RW = C.ring.w, M = C.moat, CW = C.canal.w, QW = C.canal.quay, MW = C.street.main;
    const CO = C.core, CA = Math.round(A * CO.a), CB = Math.round(B * CO.b), BW = CO.bw; this.CA = CA; this.CB = CB;
    const mainU = clamp(C.mainU, -CA + 50, CA - 50), mainV = clamp(C.mainV, -CB + 50, CB - 50);
    let cv = clamp(C.canal.v, -CB + 40, CB - 40); if (Math.abs(cv - mainV) < 60) cv = mainV + (cv >= mainV ? 60 : -60); if (Math.abs(cv) > CB - 40) cv = mainV - Math.sign(cv - mainV) * 60;
    this.mainU = mainU; this.mainV = mainV; this.cv = cv; const qOff = CW / 2 + QW / 2;
    // the old town's outline: its rectangle with each corner cut off by its own amount
    { const cm = Math.max(0, Math.min(CB - Math.max(Math.abs(mainV), Math.abs(cv)) - 20, CA - Math.abs(mainU) - 20)), cut = () => Math.min(cm, rng.range(0.2, 0.45) * Math.min(CA, CB)), c = [cut(), cut(), cut(), cut()];
      this.core = [[-CA + c[0], -CB], [CA - c[1], -CB], [CA, -CB + c[1]], [CA, CB - c[2]], [CA - c[2], CB], [-CA + c[3], CB], [-CA, CB - c[3]], [-CA, -CB + c[0]]]; }
    this.coreIn = tEdgesIn(this.core); const coreOut = (u, v) => { let m = -1e9; for (const h of this.coreIn) m = Math.max(m, h.c - h.nu * u - h.nv * v); return m; }; this.coreOut = coreOut;
    const fu = C.flip && C.flip[0] ? -1 : 1, fv = C.flip && C.flip[1] ? -1 : 1; this.fu = fu; this.fv = fv; this.oneTower = !!(C.vary && rng.chance(0.4)); // a varied town may raise one great tower instead of two
    // the wall: a convex polygon round an ellipse, its corners jittered
    { const pts = [], N = C.vary ? rng.int(8, 13) : C.wall.corners || 11; for (let k = 0; k < N; k++) { const th = (k + rng.range(-0.28, 0.28)) / N * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), r = rng.range(0.94, 1.06) / Math.hypot(c / A, s / B); pts.push([r * c, r * s]); } this.wall = tHull(pts); }
    this.wallIn = tEdgesIn(this.wall); const W = this.wall;
    // the roads from the old town's main streets out to the gates, each bent a little off the grid (east and west away from the canal)
    const rot = (d, a) => [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)], sg = Math.sign(cv - mainV) || 1;
    const roads = [{ id: 'east', name: 'the Sunrise Gate', p0: [CA, mainV], d: rot([1, 0], -sg * rng.range(0.18, 0.45)) }, { id: 'south', name: 'the Bay Gate', p0: [mainU, CB], d: rot([0, 1], rng.pick([-1, 1]) * rng.range(0.12, 0.45)) },
      { id: 'west', name: 'the Mill Gate', p0: [-CA, mainV], d: rot([-1, 0], sg * rng.range(0.18, 0.45)) }, { id: 'north', name: 'the Moor Gate', p0: [mainU, -CB], d: rot([0, -1], rng.pick([-1, 1]) * rng.range(0.12, 0.45)) }];
    for (const r of roads) { const h = tRay(W, r.p0, r.d), e = this.wallIn[h.i], f = e.L < 44 ? 0.5 : clamp(h.f, 20 / e.L, 1 - 20 / e.L); // (a gate keeps clear of the wall's corners)
      r.g = [e.a[0] + (e.b[0] - e.a[0]) * f, e.a[1] + (e.b[1] - e.a[1]) * f]; r.n = [-e.nu, -e.nv]; const du = r.g[0] - r.p0[0], dv = r.g[1] - r.p0[1], l = Math.hypot(du, dv); r.d = [du / l, dv / l];
      const k = R / Math.max(0.3, r.d[0] * r.n[0] + r.d[1] * r.n[1]); r.rp = [r.g[0] - r.d[0] * k, r.g[1] - r.d[1] * k]; r.gate = !(C.gates === 3 && r.id === 'north'); }
    this.roads = roads;
    this.gates = roads.filter(r => r.gate).map(r => ({ id: r.id, name: r.name, u: r.g[0], v: r.g[1], nu: r.n[0], nv: r.n[1] }));
    for (const g of this.gates) { [g.x, g.z] = this.w(g.u, g.v); const o = M.off + M.w + 10; [g.ox, g.oz] = this.w(g.u + g.nu * o, g.v + g.nv * o); }
    // the canal: straight through the old town, bending a little on each side out under the wall
    { const a1 = rng.range(0.06, 0.3), a2 = rng.range(0.06, 0.3), de = [Math.cos(a1), sg * Math.sin(a1)], dw = [-Math.cos(a2), sg * Math.sin(a2)];
      const endOf = (p, d) => { const h = tRay(W, p, d), t = h.t + M.off + M.w + 30; return [p[0] + d[0] * t, p[1] + d[1] * t]; };
      this.canal = [endOf([-CA, cv], dw), [-CA, cv], [CA, cv], endOf([CA, cv], de)]; }
    // the quarters between the roads: each road's line, turned to face into the sector between it and the next
    const ang2 = p => Math.atan2(p[1], p[0]);
    this.sectors = roads.map((r, k) => { const r2 = roads[(k + 1) % 4], a0 = ang2(r.g), a1 = ang2(r2.g), m = a0 + ((a1 - a0 + 4 * Math.PI) % (2 * Math.PI)) / 2, hm = tRay(W, [0, 0], [Math.cos(m), Math.sin(m)]), rep = [Math.cos(m) * hm.t * 0.75, Math.sin(m) * hm.t * 0.75];
      const side = rr => { let nu = -rr.d[1], nv = rr.d[0]; if (nu * (rep[0] - rr.p0[0]) + nv * (rep[1] - rr.p0[1]) < 0) { nu = -nu; nv = -nv; } return { nu, nv, c0: nu * rr.p0[0] + nv * rr.p0[1], clear: MW / 2 }; };
      return { k, a: r, b: r2, rep, m, hp: [side(r), side(r2)] }; });
    const inSector = (sc, p) => sc.hp.every(h => h.nu * p[0] + h.nv * p[1] >= h.c0);
    const pool = rng.shuffle(['weavers', 'tanners', 'commons', 'citadel']), canalSeg = [[this.canal[2], this.canal[3]], [this.canal[1], this.canal[0]]];
    for (const sc of this.sectors) { const cs = canalSeg.find(([p, q]) => inSector(sc, [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]));
      if (cs) { const [p, q] = cs, L = Math.hypot(q[0] - p[0], q[1] - p[1]), ax = [(q[0] - p[0]) / L, (q[1] - p[1]) / L]; sc.canal = { p, q, ax, pp: [-ax[1], ax[0]] }; sc.kinds = { 1: 'canal', [-1]: pool.pop() || 'weavers' }; }
      else sc.kind = pool.pop() || 'weavers'; }
    const quarterAt = (u, v) => { for (const sc of this.sectors) if (inSector(sc, [u, v])) { if (!sc.canal) return sc.kind; const s = sc.canal.pp[0] * (u - sc.canal.p[0]) + sc.canal.pp[1] * (v - sc.canal.p[1]) >= 0 ? 1 : -1; return sc.kinds[s]; } return 'weavers'; };
    // the citadel: in its quarter, near the wall, clear of the roads and the canal
    const S = 38; this.blocks = [];
    for (const pass of [0, 1]) { if (this.citadel) break; const cands = []; for (let u = -A; u <= A; u += 16) for (let v = -B; v <= B; v += 16) { if (pass === 0 && quarterAt(u, v) !== 'citadel') continue; const m = S + 16;
        if ([[-1, -1], [1, -1], [1, 1], [-1, 1]].some(([a, b]) => this.wallOut(u + a * m, v + b * m) > -(R + RW / 2 + 2))) continue;
        if (coreOut(u, v) < BW / 2 + m * 1.2) continue;
        if (roads.some(r => segDist(u, v, r.p0[0], r.p0[1], r.g[0], r.g[1]).d < m * 1.15 + MW / 2) || tPolyDist([u, v], this.canal).d < m * 1.15 + CW / 2 + QW) continue;
        cands.push([u, v, Math.hypot(u / A, v / B) + rng.range(0, 0.05)]); }
      cands.sort((a, b) => b[2] - a[2]); if (cands.length) { const [u, v] = cands[0]; this.citadel = { u0: u - S, u1: u + S, v0: v - S, v1: v + S, uc: u, vc: v, use: 'citadel', poly: [[u - S, v - S], [u + S, v - S], [u + S, v + S], [u - S, v + S]] }; this.blocks.push(this.citadel); } }
    if (!this.citadel) for (const sc of this.sectors) { if (sc.kind === 'citadel') sc.kind = 'weavers'; if (sc.kinds && sc.kinds[-1] === 'citadel') sc.kinds[-1] = 'weavers'; }
    const cit = this.citadel;
    // what kind of place a point is in: it names the district and decides how the houses there are built
    this.kindAt = (u, v) => {
      if (coreOut(u, v) <= BW / 2) { // the old town
        if (this.square && Math.hypot(u - this.square.uc, v - this.square.vc) < 95) return 'grand';
        if (this.cathedral && Math.hypot(u - this.cathedral.uc, v - this.cathedral.vc) < 95) return 'close';
        if (Math.abs(v - cv) < 45) return 'canal'; return 'old'; }
      if (cit && Math.max(Math.abs(u - cit.uc), Math.abs(v - cit.vc)) < S + 70) return 'citadel';
      if (tPolyDist([u, v], this.canal).d < 50) return 'canal';
      if (this.wallOut(u, v) > -(R + 55)) return 'commons';
      return quarterAt(u, v);
    };
    this.districtAt = (x, z) => { const [u, v] = this.local(x, z), id = this.kindAt(u, v); return C.districts.find(d => d.id === id) || C.districts[0]; };
    this.streets = []; const street = (a, b, o = {}) => { if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.5) this.streets.push({ u0: a[0], v0: a[1], u1: b[0], v1: b[1], w: C.street.w, ...o }); };

    /* the old town: a strict grid between the boulevard lines, the main streets and the canal */
    const lines = (lo, hi, main, extra, d) => { const out = [{ p: lo, w: BW, ring: true }, { p: hi, w: BW, ring: true }, { p: main, w: MW, main: true }, ...extra];
      const fill = (a, b) => { let p = a + rng.range(...d); while (p < b - d[0] * 0.75) { if (!out.some(l => Math.abs(l.p - p) < d[0] * 0.6)) out.push({ p, w: C.street.w }); p += rng.range(...d); } };
      const fixed = out.map(l => l.p).sort((x, y) => x - y); for (let k = 1; k < fixed.length; k++) fill(fixed[k - 1], fixed[k]);
      return out.sort((x, y) => x.p - y.p); };
    const U = lines(-CA, CA, mainU, [], CO.du), V = lines(-CB, CB, mainV, [{ p: cv, w: CW + 2 * QW, canal: true }], CO.dv); this.U = U; this.V = V;
    const nI = U.length - 1, nJ = V.length - 1, own = [...Array(nI)].map(() => Array(nJ).fill(null)), iu = U.findIndex(l => l.main), jv = V.findIndex(l => l.main), jc = V.findIndex(l => l.canal);
    const fits = (i0, j0, i1, j1) => { if (i0 < 0 || j0 < 0 || i1 >= nI || j1 >= nJ) return false; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) if (own[i][j]) return false;
      for (let i = i0 + 1; i <= i1; i++) if (U[i].main) return false; for (let j = j0 + 1; j <= j1; j++) if (V[j].main || V[j].canal) return false;
      for (const u of [U[i0].p + U[i0].w / 2, U[i1 + 1].p - U[i1 + 1].w / 2]) for (const v of [V[j0].p + V[j0].w / 2, V[j1 + 1].p - V[j1 + 1].w / 2]) if (coreOut(u, v) > -BW / 2 + 0.3) return false; return true; }; // (whole, inside the old town's outline)
    const claim = (i0, j0, i1, j1, use) => { const u0 = U[i0].p + U[i0].w / 2, u1 = U[i1 + 1].p - U[i1 + 1].w / 2, v0 = V[j0].p + V[j0].w / 2, v1 = V[j1 + 1].p - V[j1 + 1].w / 2;
      const b = { u0, u1, v0, v1, uc: (u0 + u1) / 2, vc: (v0 + v1) / 2, use, core: true, poly: [[u0, v0], [u1, v0], [u1, v1], [u0, v1]] }; for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) own[i][j] = b; this.blocks.push(b); return b; };
    const tryClaim = (opts, use) => { for (const o of opts) if (fits(...o)) return claim(...o, use); return null; };
    const nearestFit = (wi, hj, tu, tv, f = () => true) => { let best = null, bd = 1e9; for (let i = 0; i + wi - 1 < nI; i++) for (let j = 0; j + hj - 1 < nJ; j++) { if (!fits(i, j, i + wi - 1, j + hj - 1) || !f(i, j)) continue; const d = Math.hypot((U[i].p + U[i + wi].p) / 2 - tu, (V[j].p + V[j + hj].p) / 2 - tv); if (d < bd) { bd = d; best = [i, j, i + wi - 1, j + hj - 1]; } } return best; };
    // the Grand Square in one corner of the main crossing, the belfry hall across the main street from it
    { const iS = fu > 0 ? iu : iu - 2, jS = fv > 0 ? jv : jv - 2;
      this.square = tryClaim([[iS, jS, iS + 1, jS + 1], [iS, jS + (fv > 0 ? 0 : 1), iS + 1, jS + (fv > 0 ? 0 : 1)], [iS + (fu > 0 ? 0 : 1), jS, iS + (fu > 0 ? 0 : 1), jS + 1]], 'square');
      const jH = fv > 0 ? jv - 1 : jv; this.hall = tryClaim([[iS, jH, iS + 1, jH], [iS + (fu > 0 ? 0 : 1), jH, iS + (fu > 0 ? 0 : 1), jH]], 'hall'); }
    // the cathedral beyond the canal from the main street, its forecourt before the west front
    { const side = cv < mainV ? -1 : 1, rowOk = (j, h) => side < 0 ? j + h - 1 < jc : j >= jc, tu = -fu * CA * 0.35, tv = (cv + side * CB) / 2;
      for (const [wi, any] of [[3, 0], [2, 0], [3, 1], [2, 1]]) { const o = nearestFit(wi + 1, 2, tu, tv, (i, j) => any || rowOk(j, 2)); if (!o) continue; this.cathedral = claim(o[0], o[1], o[0] + wi - 1, o[3], 'cathedral'); this.parvis = claim(o[0] + wi, o[1], o[0] + wi, o[3], 'parvis'); break; } }
    { const o = nearestFit(2, 1, fu * CA * 0.6, mainV + fv * CB * 0.55) || nearestFit(1, 1, fu * CA * 0.6, mainV + fv * CB * 0.55); if (o) this.market = claim(...o, 'market'); }
    // a few bigger blocks among the small ones, then every cell left is a block of its own
    for (let i = 0; i < nI; i++) for (let j = 0; j < nJ; j++) { if (own[i][j]) continue; if (rng.chance(0.18)) { if (rng.chance(0.5) ? tryClaim([[i, j, i + 1, j]], 'lots') : tryClaim([[i, j, i, j + 1]], 'lots')) continue; }
      const b = claim(i, j, i, j, 'lots'); let P2 = b.poly; for (const h of tEdgesIn(this.core, BW / 2)) { if (P2.length < 3) break; P2 = tClipPoly(P2, h); } // (the cells at the cut corners are cut too)
      const ar = P2.length >= 3 ? Math.abs(tArea(P2)) : 0; if (ar < 60) { this.blocks.pop(); continue; } b.poly = P2; if (ar < 250) b.use = 'place'; [b.uc, b.vc] = tCentroid(P2); }
    // its streets: every grid edge between two blocks; some cross streets bridge the canal, the rest stop at the quays
    const cst = (a, b, o) => { const s2 = tClipSeg(a, b, this.coreIn); if (s2) street(s2[0], s2[1], { ...o, core: true }); };
    { const bridged = new Set(); let last = -1e9; for (const [l, i] of U.map((l, i) => [l, i]).filter(([l]) => !l.ring)) if (l.main || (l.p - last > 70 && rng.chance(0.6))) { bridged.add(i); last = l.p; }
      for (let i = 1; i < nI; i++) for (let j = 0; j < nJ; j++) { if (own[i - 1][j] === own[i][j]) continue; let v0 = V[j].p, v1 = V[j + 1].p; if (!bridged.has(i)) { if (V[j].canal) v0 = cv + qOff; if (V[j + 1].canal) v1 = cv - qOff; } cst([U[i].p, v0], [U[i].p, v1], { w: U[i].w, main: !!U[i].main }); }
      for (let j = 1; j < nJ; j++) { if (V[j].canal) continue; for (let i = 0; i < nI; i++) if (own[i][j - 1] !== own[i][j]) cst([U[i].p, V[j].p], [U[i + 1].p, V[j].p], { w: V[j].w, main: !!V[j].main }); } }
    // the boulevard where the old town's wall once stood
    { const P = this.core; for (let k = 0; k < P.length; k++) street(P[k], P[(k + 1) % P.length], { w: BW, main: true, boulevard: true }); }

    /* the quarters: each a lattice of blocks laid along one of its roads (or along the canal), at its own scale, bent and jittered, cut off by the roads, the canal, the boulevard and the wall */
    const consFor = (sc, cen, side) => { const hs = sc.hp.slice();
      if (sc.canal) { const n = [sc.canal.pp[0] * side, sc.canal.pp[1] * side]; hs.push({ nu: n[0], nv: n[1], c0: n[0] * sc.canal.p[0] + n[1] * sc.canal.p[1], clear: CW / 2 + QW, canal: true }); }
      { let hb = null, m = -1e9; for (const h of this.coreIn) { const o = h.c - tDot(h, cen); if (o > m) { m = o; hb = h; } } hs.push({ nu: -hb.nu, nv: -hb.nv, c0: -hb.c, clear: BW / 2 }); } // (off the old town, beyond the boulevard on its nearest side)
      if (cit && Math.max(Math.abs(cen[0] - cit.uc), Math.abs(cen[1] - cit.vc)) < S + 100) { const du = Math.abs(cen[0] - cit.uc), dv = Math.abs(cen[1] - cit.vc); hs.push(du > dv ? { nu: Math.sign(cen[0] - cit.uc), nv: 0, c0: Math.sign(cen[0] - cit.uc) * cit.uc + S + 10, clear: 4 } : { nu: 0, nv: Math.sign(cen[1] - cit.vc), c0: Math.sign(cen[1] - cit.vc) * cit.vc + S + 10, clear: 4 }); }
      for (const h of this.wallIn) hs.push({ nu: h.nu, nv: h.nv, c0: h.c + R, clear: RW / 2 });
      for (const g of this.gates) if (Math.hypot(cen[0] - g.u, cen[1] - g.v) < 80) hs.push({ nu: -g.nu, nv: -g.nv, c0: -(g.nu * g.u + g.nv * g.v) + R + 26, clear: 0 }); // a little square inside each gate
      return hs; };
    this.gateSquares = this.gates.map(g => { const t = [-g.nv, g.nu], a = R - RW / 2, b = R + 26; return [[g.u + t[0] * 46 - g.nu * a, g.v + t[1] * 46 - g.nv * a], [g.u - t[0] * 46 - g.nu * a, g.v - t[1] * 46 - g.nv * a], [g.u - t[0] * 46 - g.nu * b, g.v - t[1] * 46 - g.nv * b], [g.u + t[0] * 46 - g.nu * b, g.v + t[1] * 46 - g.nv * b]]; });
    const cellHP = hs => hs.map(h => ({ nu: h.nu, nv: h.nv, c: h.c0 + h.clear })), segHP = (hs, skipCanal) => hs.filter(h => !(skipCanal && h.canal)).map(h => ({ nu: h.nu, nv: h.nv, c: h.c0 + h.clear - 1.5 }));
    const quarterBlocks = [];
    for (const sc of this.sectors) {
      const anchor = sc.canal ? { p: sc.canal.p, ax: sc.canal.ax, pp: sc.canal.pp } : rng.chance(0.45) ? (() => { const h = tRay(W, [0, 0], [Math.cos(sc.m), Math.sin(sc.m)]), e = this.wallIn[h.i]; return { p: [e.a[0] + e.nu * R, e.a[1] + e.nv * R], ax: [(e.b[0] - e.a[0]) / e.L, (e.b[1] - e.a[1]) / e.L], pp: [e.nu, e.nv] }; })() // (streets that follow the wall)
        : (() => { const k = rng.chance(0.5) ? 0 : 1, r = k ? sc.b : sc.a, h = sc.hp[k]; return { p: r.p0, ax: r.d, pp: [h.nu, h.nv] }; })();
      const colKind = sc.canal ? 'canal' : sc.kind, rowKind = s => sc.canal ? sc.kinds[s] : sc.kind, Q = TQ[colKind] || TQ.weavers, ext = 1.25 * Math.max(A, B);
      const cum = (d, n) => { const o = [0]; for (let k = 0; k < n; k++) o.push(o[k] + rng.range(...d)); return o; };
      const nI2 = Math.ceil(ext / Q.du[0]), Up = cum(Q.du, nI2), Un = cum(Q.du, nI2), Ucum = i => i >= 0 ? Up[i] : -Un[-i];
      const QR = s => TQ[rowKind(s)] || TQ.weavers, nJp = Math.ceil(ext / QR(1).dv[0]), nJn = sc.canal ? Math.ceil(ext / QR(-1).dv[0]) : 0, Vp = cum(QR(1).dv, nJp), Vn = cum(QR(-1).dv, Math.max(1, nJn)), Vcum = j => j >= 0 ? Vp[j] : -Vn[-j];
      const mU = (Q.du[0] + Q.du[1]) / 2, mV = (QR(1).dv[0] + QR(1).dv[1]) / 2, lam1 = rng.range(70, 140), lam2 = rng.range(70, 140), ph1 = rng.range(0, 6.3), ph2 = rng.range(0, 6.3), salt = rng.int(1, 1e6);
      const memo = new Map(), P = (i, j) => { const k = i * 4096 + j; let p = memo.get(k); if (p) return p; const U0 = Ucum(i), V0 = Vcum(j);
        const du = 0.24 * mU * Math.sin(V0 / lam2 + ph2 + 0.5 * i) + 0.24 * mU * tJit(i, j, salt), dv = j === 0 ? 0 : 0.22 * mV * Math.sin(U0 / lam1 + ph1 + 0.5 * j) + 0.22 * mV * tJit(i, j, salt + 1);
        p = [anchor.p[0] + anchor.ax[0] * (U0 + du) + anchor.pp[0] * (V0 + dv), anchor.p[1] + anchor.ax[1] * (U0 + du) + anchor.pp[1] * (V0 + dv)]; memo.set(k, p); return p; };
      // the canal is bridged on some of the cross lanes, one lattice serving both banks
      const bridgeCols = new Set(); if (sc.canal) { const L = Math.hypot(sc.canal.q[0] - sc.canal.p[0], sc.canal.q[1] - sc.canal.p[1]); let last = -1e9; for (let i = 1; i < nI2; i++) { const t = Ucum(i); if (t > 45 && t < L - 100 && t - last > 80 && rng.chance(0.7)) { bridgeCols.add(i); last = t; } } }
      const edges = new Map(), j0 = sc.canal ? -nJn : 0;
      const used = new Set();
      for (let i = -nI2; i < nI2; i++) for (let j = j0; j < nJp; j++) { if (used.has(i * 4096 + j)) continue;
        // now and then two cells make one block, so a lane ends at a T and the next one runs on offset
        const bc = c => bridgeCols.has(c) && (j === 0 || j === -1), mg = rng.chance(0.2) && !bc(i + 1) && !used.has((i + 1) * 4096 + j) ? 'u' : rng.chance(0.16) && j !== -1 && j + 1 < nJp ? 'v' : null;
        const quad = mg === 'u' ? [P(i, j), P(i + 1, j), P(i + 2, j), P(i + 2, j + 1), P(i + 1, j + 1), P(i, j + 1)] : mg === 'v' ? [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i + 1, j + 2), P(i, j + 2), P(i, j + 1)] : [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], cen = tCentroid(quad), side = j >= 0 ? 1 : -1;
        if (mg === 'u') used.add((i + 1) * 4096 + j); if (mg === 'v') used.add(i * 4096 + j + 1);
        if (this.wallOut(cen[0], cen[1]) > -R || coreOut(cen[0], cen[1]) < 0 || !inSector(sc, cen)) continue;
        const hs = consFor(sc, cen, side), sw = TQ[rowKind(side)] ? TQ[rowKind(side)].sw : Q.sw; let poly = quad; for (const h of tEdgesIn(quad, sw / 2)) poly = tClipPoly(poly, h); for (const h of cellHP(hs)) { if (poly.length < 3) break; poly = tClipPoly(poly, h); }
        if (poly.length < 3) continue; const area = Math.abs(tArea(poly)); if (area < 110) continue;
        const c2 = tCentroid(poly), b = { poly, uc: c2[0], vc: c2[1], use: area < 260 || tWidth(poly) < 11 ? 'place' : 'lots', q: sc.k * 2 + (side > 0 ? 0 : 1), ang: Math.atan2(anchor.ax[0], anchor.ax[1]), area };
        this.blocks.push(b); quarterBlocks.push(b);
        const H = (a, b) => ['h' + a + ',' + b, P(a, b), P(a + 1, b)], Vt = (a, b) => ['v' + a + ',' + b, P(a, b), P(a, b + 1), a];
        const es = mg === 'u' ? [H(i, j), H(i + 1, j), H(i, j + 1), H(i + 1, j + 1), Vt(i, j), Vt(i + 2, j)] : mg === 'v' ? [H(i, j), H(i, j + 2), Vt(i, j), Vt(i, j + 1), Vt(i + 1, j), Vt(i + 1, j + 1)] : [H(i, j), H(i, j + 1), Vt(i, j), Vt(i + 1, j)];
        for (const [key, a, bb, col] of es)
          if (!edges.has(key)) edges.set(key, { a, b: bb, hs, w: sw, bridge: col !== undefined && bridgeCols.has(col) && (key.endsWith(',0') || key.endsWith(',-1')) });
      }
      for (const e of edges.values()) { const s2 = tClipSeg(e.a, e.b, segHP(e.hs, e.bridge)); if (s2) street(s2[0], s2[1], { w: e.w, lane: true }); }
    }
    // in each quarter a small square with a well, and in two of the small-block quarters a chapel on its own little square
    { const byQ = new Map(); for (const b of quarterBlocks) { if (!byQ.has(b.q)) byQ.set(b.q, []); byQ.get(b.q).push(b); } let chapels = 0;
      for (const [q, bs] of byQ) { const cu = bs.reduce((s, b) => s + b.uc, 0) / bs.length, cv2 = bs.reduce((s, b) => s + b.vc, 0) / bs.length, kind = this.kindAt(cu, cv2);
        const c = bs.filter(b => b.use === 'lots' && b.area > 380 && b.area < 1500).sort((a, b) => Math.hypot(a.uc - cu, a.vc - cv2) - Math.hypot(b.uc - cu, b.vc - cv2));
        if (c[0]) c[0].use = 'plein'; const ch = bs.filter(b => b.use === 'lots' && tWidth(b.poly) > 24 && b.area < 2200 && b !== c[0]).sort((a, b) => Math.hypot(a.uc - cu, a.vc - cv2) - Math.hypot(b.uc - cu, b.vc - cv2))[2];
        if (ch && chapels < 2 && (kind === 'weavers' || kind === 'tanners' || kind === 'commons')) { ch.use = 'chapel'; chapels++; } } }
    // the ring street inside the wall, the roads out to the gates, the quays, the esplanade round the citadel
    { const P = this.offPoly(-R); for (let k = 0; k < P.length; k++) street(P[k], P[(k + 1) % P.length], { w: RW, ring: true }); }
    for (const r of roads) { const end = r.gate ? [r.g[0] - r.n[0] * 2, r.g[1] - r.n[1] * 2] : r.rp; street(r.p0, end, { w: MW, main: true, road: r.id }); if (r.gate) { const o = M.off + M.w + 10; street(end, [r.g[0] + r.n[0] * o, r.g[1] + r.n[1] * o], { w: 6, nopave: true }); } }
    for (let k = 0; k < this.canal.length - 1; k++) { const a = this.canal[k], b = this.canal[k + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = [-(b[1] - a[1]) / L, (b[0] - a[0]) / L];
      for (const s of [-1, 1]) { const o = [n[0] * s * qOff, n[1] * s * qOff], s2 = tClipSeg([a[0] + o[0], a[1] + o[1]], [b[0] + o[0], b[1] + o[1]], this.wallIn.map(h => ({ nu: h.nu, nv: h.nv, c: h.c + R + RW / 2 - 1.5 }))); if (s2) street(s2[0], s2[1], { w: QW, quay: true, cn: [-n[0] * s, -n[1] * s] }); } }
    if (cit) { const e = S + 10, P = [[cit.uc - e, cit.vc - e], [cit.uc + e, cit.vc - e], [cit.uc + e, cit.vc + e], [cit.uc - e, cit.vc + e]]; for (let k = 0; k < 4; k++) street(P[k], P[(k + 1) % 4], { w: 8, esplanade: true }); }

    /* lots: rows of plots along every edge of a block, gable to the street, the longest edges first; a plot must lie in the block and clear of the others. The rest is yards and gardens */
    this.lots = [];
    const placeLots = (b, kind) => { const K = TK[kind] || TK.weavers, Pp = b.poly, E = tEdgesIn(Pp).sort((x, y) => y.L - x.L), mine = []; b.lots = mine; b.kind = kind;
      for (const e of E) { if (e.L < 5) continue; const tu = (e.b[0] - e.a[0]) / e.L, tv = (e.b[1] - e.a[1]) / e.L; let deep = 0; for (const p of Pp) deep = Math.max(deep, tDot(e, p) - e.c);
        const d = Math.min(rng.range(...K.d) * 0.88, deep / 2 - 2); if (d < 6) continue; (b.edgeD = b.edgeD || {})[e.i] = d; const a = Math.atan2(-e.nu, -e.nv); let s = 0.3, last = null, lastEnd = -9;
        while (s < e.L - 4) { let w = rng.range(...K.w); if (e.L - s - w < 4) w = e.L - s - 0.3; if (w < 4) break; let ok = null;
          for (const ww of [w, Math.max(4.2, w * 0.65)]) { const cu = e.a[0] + tu * (s + ww / 2) + e.nu * d / 2, cv2 = e.a[1] + tv * (s + ww / 2) + e.nv * d / 2, o = mkObb(cu, cv2, a, ww / 2, d / 2);
            if (obbCorners(o).every(c => E.every(h => tDot(h, c) - h.c > -0.25)) && !mine.some(m => obbOverlap(m.ob, o, -0.12))) { ok = { u: cu, v: cv2, w: ww, ob: o }; break; } }
          if (!ok) { if (last) last.corner = true; last = null; s += 1.5; continue; }
          const l = { u: ok.u, v: ok.v, a, w: ok.w, d, kind, seed: rng.int(1, 1e9), corner: s - lastEnd > 0.4, ob: ok.ob }; if (l.corner && last) last.corner = true;
          this.lots.push(l); mine.push(l); last = l; lastEnd = s + ok.w; s += ok.w; }
        if (last) last.corner = true; } };
    for (const b of this.blocks) if (b.use === 'lots') placeLots(b, this.kindAt(b.uc, b.vc));
    // what each lot is: shops and inns where the trade is, warehouses on the canal, the rest homes
    const pick = types => { for (const [type, n, f] of types) for (let k = 0; k < n; k++) { const c = this.lots.filter(l => !l.type && l.w >= 7 && f(l)); if (!c.length) continue; const l = c[rng.int(0, c.length - 1)]; l.type = type; } };
    const nearGate = l => this.gates.some(g => Math.hypot(l.u - g.u, l.v - g.v) < 140);
    pick([['tavern', 3, l => l.kind === 'grand' || l.kind === 'canal'], ['tavern', 4, nearGate], ['tavern', 3, l => l.kind === 'weavers' || l.kind === 'commons' || l.kind === 'tanners' || l.kind === 'old'],
      ['general', 3, l => l.kind === 'grand' || l.kind === 'weavers' || l.kind === 'old'], ['general', 2, nearGate], ['alchemist', 2, l => l.kind === 'close' || l.kind === 'grand'],
      ['weaponsmith', 2, l => l.kind === 'citadel'], ['armorer', 2, l => l.kind === 'citadel'], ['weaponsmith', 1, l => l.kind === 'weavers' || l.kind === 'tanners']]);
    for (const l of this.lots) if (!l.type) { const K = TK[l.kind], r2 = new RNG(l.seed); l.type = K.warehouse && tPolyDist([l.u, l.v], this.canal).d < CW / 2 + QW + l.d + 2 && l.w >= 9 && r2.chance(K.warehouse) ? 'warehouse' : 'house'; }

    /* the street graph: streets are cut where they cross or where one ends on another, and the pieces become the walkers' and travellers' network */
    { const Sx = this.streets, hs = new SHash(40), cuts = Sx.map(() => [0, 1]), links = [], bb = s => [Math.min(s.u0, s.u1) - 8, Math.min(s.v0, s.v1) - 8, Math.max(s.u0, s.u1) + 8, Math.max(s.v0, s.v1) + 8];
      Sx.forEach((s, i) => { s.i = i; hs.add(s, bb(s)); });
      for (const s of Sx) { for (const o of hs.query(...bb(s))) { if (o.i <= s.i) continue; const r = segCross(s.u0, s.v0, s.u1, s.v1, o.u0, o.v0, o.u1, o.v1); if (r && r[0] > 1e-3 && r[0] < 1 - 1e-3 && r[1] > 1e-3 && r[1] < 1 - 1e-3) { cuts[s.i].push(r[0]); cuts[o.i].push(r[1]); } }
        for (const [eu, ev] of [[s.u0, s.v0], [s.u1, s.v1]]) for (const o of hs.query(eu - 1, ev - 1, eu + 1, ev + 1)) { if (o === s) continue; const r = segDist(eu, ev, o.u0, o.v0, o.u1, o.v1); if (r.d < Math.max(1, o.w / 2) + 0.8) { if (r.t > 1e-3 && r.t < 1 - 1e-3) cuts[o.i].push(r.t); if (r.d > 0.3) links.push([[eu, ev], [r.x, r.z], Math.min(s.w, o.w)]); } } }
      this.nodes = []; const nh = new Map(), node = (u, v) => { const ki = Math.round(u / 1.5), kj = Math.round(v / 1.5); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = nh.get((ki + a) * 8192 + kj + b); if (l) for (const k of l) { const n = this.nodes[k]; if (Math.hypot(n.u - u, n.v - v) < 1.2) return k; } }
        const [x, z] = this.w(u, v); this.nodes.push({ u, v, x, z, n: [], w: [] }); const k = this.nodes.length - 1, key = ki * 8192 + kj; if (!nh.has(key)) nh.set(key, []); nh.get(key).push(k); return k; };
      const link = (a, b, w) => { if (a === b || this.nodes[a].n.includes(b)) return; this.nodes[a].n.push(b); this.nodes[a].w.push(w); this.nodes[b].n.push(a); this.nodes[b].w.push(w); };
      Sx.forEach((s, i) => { const ts = [...new Set(cuts[i].map(t => Math.round(t * 1e4) / 1e4))].sort((a, b) => a - b); let prev = null; for (const t of ts) { const k = node(lerp(s.u0, s.u1, t), lerp(s.v0, s.v1, t)); if (prev !== null) link(prev, k, s.quay ? QW : s.w); prev = k; } });
      for (const [a, b, w] of links) link(node(...a), node(...b), w);
      for (const g of this.gates) { const o = M.off + M.w + 10, u = g.u + g.nu * o, v = g.v + g.nv * o; g.node = this.nodes.reduce((bi, n, i) => Math.hypot(n.u - u, n.v - v) < Math.hypot(this.nodes[bi].u - u, this.nodes[bi].v - v) ? i : bi, 0); } }
    // the bridges: wherever a street crosses the canal
    this.bridges = [];
    for (const s of this.streets) { if (s.quay || s.nopave) continue; const su = s.u1 - s.u0, sv = s.v1 - s.v0, sl = Math.hypot(su, sv);
      for (let k = 0; k < this.canal.length - 1; k++) { const a = this.canal[k], b = this.canal[k + 1]; let p = null; const r = segCross(s.u0, s.v0, s.u1, s.v1, a[0], a[1], b[0], b[1]); if (r) p = [lerp(s.u0, s.u1, r[0]), lerp(s.v0, s.v1, r[0])];
        else for (const e of [[s.u0, s.v0], [s.u1, s.v1]]) { const d = segDist(e[0], e[1], a[0], a[1], b[0], b[1]); if (d.d < 0.6 && d.t > 0 && d.t < 1) p = e; }
        if (!p || this.bridges.some(q => Math.hypot(q.u - p[0], q.v - p[1]) < 5)) continue; const cl = Math.hypot(b[0] - a[0], b[1] - a[1]), sn = Math.abs(su * (b[1] - a[1]) - sv * (b[0] - a[0])) / sl / cl;
        this.bridges.push({ u: p[0], v: p[1], du: su / sl, dv: sv / sl, w: Math.min(s.w, 8), hl: (CW / 2 + 1) / Math.max(0.5, sn) }); } }

    // the suburbs: cottages along each road out of a gate, beyond the moat
    for (const g of this.gates) { const pu = -g.nv, pv = g.nu, start = M.off + M.w + 26;
      for (const s of [-1, 1]) { let t = start + rng.range(0, 6), first = true;
        while (t < start + 170) { const w = rng.range(7, 10), d = rng.range(9, 11), mid = t + w / 2, off = 4 + rng.range(1.5, 4) + d / 2, u = g.u + g.nu * mid + pu * s * off, v = g.v + g.nv * mid + pv * s * off;
          this.lots.push({ u, v, a: Math.atan2(-s * pu, -s * pv), w, d, kind: 'suburb', seed: rng.int(1, 1e9), corner: true, type: first && s > 0 ? 'tavern' : 'house', suburb: true }); first = false; t += w + rng.range(0, 2.5); } } }
    // landmarks, for the map and for finding
    const lm = (id, name, b, du = 0, dv = 0) => b && { id, name, u: b.uc + du, v: b.vc + dv };
    this.landmarks = [lm('square', 'the Grand Square', this.square), lm('belfry', 'the Belfry', this.hall, 0, (this.hall ? fv * ((this.hall.v1 - this.hall.v0) / 2 - 12) : 0)), lm('cathedral', 'the Cathedral of Saint Aurel', this.cathedral), lm('citadel', 'the Citadel', this.citadel), lm('market', 'the Market Hall', this.market)].filter(Boolean)
      .map(l => { [l.x, l.z] = this.w(l.u, l.v); return l; });
    for (const g of this.gates) this.landmarks.push({ id: g.id, name: g.name, u: g.u, v: g.v, x: g.x, z: g.z, gate: true });
    // windmills on the plain outside, off the roads
    this.mills = [[-A - 150, mainV - 120], [-A - 230, mainV + 90], [mainU - 160, -B - 190], [mainU + 210, -B - 150], [mainU + 120, B + 260], [mainU - 140, B + 340]].map(([u, v], k) => { const [x, z] = this.w(u, v); return { u, v, x, z, a: 0.4 + k * 0.7 }; });
    // the hash of what stands where, for the chunks
    this.lotHash = new SHash(48);
    this.lots.forEach((l, i) => { l.idx = i; delete l.ob; if (i && !l.suburb && Math.abs(this.lots[i - 1].a - l.a) < 0.01 && Math.hypot(this.lots[i - 1].u - l.u, this.lots[i - 1].v - l.v) < 14) l.prev = this.lots[i - 1]; });
    for (const l of this.lots) { const [x, z] = this.w(l.u, l.v); l.x = x; l.z = z; l.o = mkObb(x, z, this.cfg.ang + l.a, l.w / 2, l.d / 2); this.lotHash.add(l, obbAabb(l.o)); }
  }
  // the door of a lot: where makeBuilding will put it (doorT is fixed per lot so the plan knows it)
  doorOf(l) { const r = new RNG(l.seed + 7), dT = l.w < 8 ? 0.5 : r.range(0.3, 0.7), dt = clamp(l.w * dT, 1.5, l.w - 1.5); const [x, z] = xfP(l.o, -l.w / 2 + dt, l.d / 2 + 0.2); return { x, z, y: this.H0, nx: Math.sin(l.o.ang), nz: Math.cos(l.o.ang), dT }; }
  // the ground: dead flat inside, a moat round the walls, the canal through the middle and out under the wall on both sides
  waterAt(u, v) { const M = this.cfg.moat, out = this.wallOut(u, v); return (out > M.off && out < M.off + M.w) || tPolyDist([u, v], this.canal).d < this.cfg.canal.w / 2; }
  groundH(x, z) {
    const [u, v] = this.local(x, z), C = this.cfg, out = this.wallOut(u, v), M = C.moat;
    let h = this.H0 + (out > M.off + M.w + 20 ? 0.6 * fbm(x / 120, z / 120, 2, 9301) * smoothstep(M.off + M.w + 20, M.off + M.w + 120, out) : 0);
    const dm = Math.min(out - M.off, M.off + M.w - out); // inside the moat, its distance from the nearer bank
    if (dm > -2) h = Math.min(h, this.H0 - 2.8 * smoothstep(-2, 3, dm));
    if (out < M.off + M.w + 40) { const dc = C.canal.w / 2 - tPolyDist([u, v], this.canal).d; if (dc > -0.5) h = Math.min(h, this.H0 - 3 * smoothstep(-0.5, 1, dc)); } // (the canal has walled quays: steep)
    return h;
  }
  wl() { return this.H0 - 0.35; }
}
const TOWN_SEED = (() => { try { return parseInt(new URLSearchParams(location.search).get('townseed'), 10) || 0; } catch (e) { return 0; } })(); // (testing only)
const TOWNS = TOWN_CFGS.map(c => new Town(TOWN_SEED ? { ...c, seed: c.seed + TOWN_SEED * 7919, vary: true } : c));
const TownOf = id => TOWNS.find(t => t.id === id);
// where any town's walls, moat and the ground kept clear round them claim a point (0 outside .. 1 within)
function townCore(x, z) { let k = 0; for (const T of TOWNS) { if (Math.abs(x - T.x) > T.cfg.A + T.cfg.B + 400 || Math.abs(z - T.z) > T.cfg.A + T.cfg.B + 400) continue; k = Math.max(k, 1 - smoothstep(T.cfg.moat.off + T.cfg.moat.w + 30, T.cfg.moat.off + T.cfg.moat.w + 160, T.rectOut(x, z))); } return k; }
// the farmland round a town: its own fields reach well out over the plain
function townFields(x, z) { let k = 0; for (const T of TOWNS) { if (Math.abs(x - T.x) > 2600 || Math.abs(z - T.z) > 2600) continue; const o = T.rectOut(x, z); if (o > T.cfg.moat.off + T.cfg.moat.w + 40) k = Math.max(k, 0.9 * (1 - smoothstep(500, 1500, o))); } return k; }
// the towns are sites: their ground is fixed (and flat), the country blends into it
for (const T of TOWNS) {
  const C = T.cfg, g = T.gates;
  const road = gg => { const out = []; for (let k = 0; k <= 8; k++) { const d = C.moat.off + C.moat.w + 14 + k * 80; out.push(T.w(gg.u + gg.nu * d, gg.v + gg.nv * d)); } return out; };
  SITES.push({ id: T.id, name: T.name, kind: 'town', town: T, x: T.x, z: T.z, rc: C.rc, rb: C.rb, discR: Math.max(C.A, C.B) + 260, blurb: C.blurb, farmed: true,
    road: road(g[0]), roads: g.map(road) });
  SITE_H[T.id] = (x, z) => T.groundH(x, z);
}

/* ---------------- building the town ---------------- */
// the cathedral's measure in its block: nave length, its middle, nave and aisle half-widths, the transept's reach
Town.prototype.cathDims = function (b) { const w = b.u1 - b.u0, h = b.v1 - b.v0, L = clamp(w - 34, 30, 70), nw = h > 52 ? 11 : 9, aw = h > 52 ? 7 : 4; return { L, cu: b.uc - 4, nw, aw, tr: Math.min(22, h / 2 - 2) }; };
// the wall a house is first given (the same draw townHouse makes), so its neighbour can choose another
Town.prototype.styleOf = function (l) { const r = new RNG(l.seed), K = TK[l.kind]; let st = r.pick(K.stories); if (l.type !== 'house' && l.type !== 'warehouse') st = Math.max(2, st); if (l.type === 'warehouse') st = Math.max(3, st); r.next(); return l.type === 'warehouse' ? r.pick(['brick', 'brick', 'timber2']) : r.pick(K.styles); };
Town.prototype.wallPieces = function () {
  if (this._wp) return this._wp; const W = this.cfg.wall, P = this.wall, out = [], towers = [];
  for (let i = 0; i < P.length; i++) { const [au, av] = P[i], [bu, bv] = P[(i + 1) % P.length], [pu, pv] = P[(i + P.length - 1) % P.length], L = Math.hypot(bu - au, bv - av), n = Math.max(1, Math.round(L / W.towerEvery)), a = Math.atan2(bu - au, bv - av), ap = Math.atan2(au - pu, av - pv);
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; out.push({ u0: lerp(au, bu, t0), v0: lerp(av, bv, t0), u1: lerp(au, bu, t1), v1: lerp(av, bv, t1) }); if (k) towers.push({ u: lerp(au, bu, t0), v: lerp(av, bv, t0), a }); }
    towers.push({ u: au, v: av, corner: true, a: Math.atan2(Math.sin(a) + Math.sin(ap), Math.cos(a) + Math.cos(ap)) }); }
  const free = towers.filter(t => !this.gates.some(g => Math.hypot(g.u - t.u, g.v - t.v) < 16)); // (the gatehouse is the tower there)
  this._wp = { pieces: out, towers: free }; return this._wp;
};
// a gable-fronted town house in the current frame (gb.xf): front (+z) to the street, often with a stepped gable in brick
function townHouse(area, gb, rng, l, K, T) {
  const shop = l.type !== 'house' && l.type !== 'warehouse', wh = l.type === 'warehouse';
  let stories = rng.pick(K.stories); if (shop) stories = Math.max(2, stories); if (wh) stories = Math.max(3, stories);
  let style = wh ? rng.pick(['brick', 'brick', 'timber2']) : rng.pick(K.styles); if (style === l.prevStyle) style = ['brick', 'stone', 'plaster', 'timber2', 'stoneLight'].filter(s2 => s2 !== l.prevStyle && (K.styles.includes(s2) || s2 === 'plaster'))[rng.int(0, 2) % 2] || style; const timber = style.startsWith('timber');
  const roofKey = stories === 1 ? rng.pick(K.roofs) : rng.pick(K.roofs.filter(r => r !== 'roofThatch').concat(K.roofs.every(r => r === 'roofThatch') ? ['roofBrown'] : [])); // (each quarter keeps to its own roofs)
  const tint = roofKey === 'roofBrown' ? [0.82, 0.62, 0.52] : roofKey === 'roofSlate' ? [0.78, 0.84, 0.94] : roofKey === 'roofRed' ? [0.86, 0.66, 0.6] : [1, 0.95, 0.85];
  const fp = { x0: -l.w / 2, z0: -l.d / 2, x1: l.w / 2, z1: l.d / 2 }, h = stories * 3.1 + 0.3 + (wh ? 0.8 : 0) + rng.range(-0.3, 0.9) + (l.oddHeight ? 1.1 : 0);
  const pitch = rng.range(1.15, 1.6); // steep northern roofs
  const door = makeBuilding(area, gb, rng, { fp, h, stories, style, roof: 'gable', roofKey, roofTint: tint, alongX: false, pitch, doorT: T.doorOf(l).dT, found: 0.5, wealth: TK[l.kind] === TK.grand ? 3 : 1.5, sign: shop ? l.type : null,
    jetty: timber && stories >= 2 && rng.chance(K.jetty), chimney: 0.7, winRate: wh ? 0.5 : rng.range(0.7, 1), plinth: style === 'brick' && rng.chance(0.25), noWin: l.corner ? null : (f) => f === 'e' || f === 'w', doorKey: wh ? 'doorDark' : undefined, doorW: wh ? 2.4 : undefined, doorH: wh ? 3 : undefined });
  const rh = l.w / 2 * pitch;
  if (shop) { const aw = rng.pick(['stallA', 'stallB', 'stallC']); gb.quad4(aw, [-l.w / 2 + 0.4, 3.0, l.d / 2 + 0.05], [l.w / 2 - 0.4, 3.0, l.d / 2 + 0.05], [l.w / 2 - 0.4, 2.4, l.d / 2 + 1.5], [-l.w / 2 + 0.4, 2.4, l.d / 2 + 1.5], [0, 0], [2, 0], [2, 1], [0, 1], [0, 1, 1]); } // a striped awning over the shop front
  // a stepped gable: the front wall climbs above the roof in steps
  if (!timber && rng.chance(K.step)) { const n = l.w < 8 ? 4 : 5, sw = l.w / 2 / (n + 0.4);
    for (let k = 0; k < n; k++) { const hw = l.w / 2 - k * sw + (k ? 0.12 : 0.6), y = h + k * rh / n; gb.box(-hw, y - 0.05, l.d / 2 - 0.42, hw, y + rh / n + 0.25, l.d / 2 + 0.58, { side: style, top: 'stone' }, 3.2, 3.2); }
    gb.box(-0.35, h + rh, l.d / 2 - 0.3, 0.35, h + rh + 1.0, l.d / 2 + 0.5, 'stone', 1, 1); }
  if (!l.corner) for (const sd of [-1, 1]) gb.box(sd * l.w / 2 - 0.22, 0, l.d / 2 - 0.1, sd * l.w / 2 + 0.22, h, l.d / 2 + 0.16, style.startsWith('timber') ? 'woodDark' : 'stoneLight', 1, 3); // the party walls show on the front
  // a warehouse: stacked loading doors and the hoist beam over them
  if (wh) { for (let s = 1; s < stories; s++) faceQuad(gb, 'doorDark', faceInfo(fp, 's'), l.w / 2 - 0.8, s * 3.1 + 0.3, 1.6, 2.1, 0.04);
    gb.box(-0.15, h + rh * 0.55, l.d / 2, 0.15, h + rh * 0.55 + 0.3, l.d / 2 + 1.6, 'woodDark', 1, 1); }
  return { door, h: h + rh };
}
// a round window or a clock face standing on a wall, facing +z in the current frame
function wallDisc(gb, key, x, y, z, r, n = 12) { for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = (k + 1) / n * Math.PI * 2; gb.tri(key, [x, y, z], [x + Math.cos(a0) * r, y + Math.sin(a0) * r, z], [x + Math.cos(a1) * r, y + Math.sin(a1) * r, z], [0.5, 0.5], [0.5 + Math.cos(a0) / 2, 0.5 + Math.sin(a0) / 2], [0.5 + Math.cos(a1) / 2, 0.5 + Math.sin(a1) / 2], [0, 0, 1]); } }
// a flat polygon of paving at height y (the town's ground is level)
function drapePoly(gb, key, pts, y, tw = 3) { const saved = gb.xf; gb.xf = null; const P = pts.map(([x, z]) => [x, y, z]), uv = p => [p[0] / tw, p[2] / tw]; for (let k = 1; k < P.length - 1; k++) gb.tri(key, P[0], P[k], P[k + 1], uv(P[0]), uv(P[k]), uv(P[k + 1]), [0, 1, 0]); gb.xf = saved; }
// the great buildings
const TOWN_BUILD = {
  // the cathedral: nave and aisles, transept, apse, two west towers with spires
  cathedral(T, gb, b, area) {
    const { L, cu, nw, aw, tr } = T.cathDims(b), y = T.H0, [cx, cz] = T.w(cu, b.vc), xf = gb.setXf(cx, cz, T.cfg.ang + Math.PI / 2, y), rng = new RNG(7700);
    const nh = 21;  // local frame: +z runs along the nave (town +u) towards the west front
    gb.box(-nw, 0, -L / 2, nw, nh, L / 2, { side: 'stoneLight', top: null }, 3, 3); gableRoof(gb, 'roofSlate', 'stoneLight', -nw, -L / 2, nw, L / 2, nh, 9, 0.6, false);
    for (const s of [-1, 1]) { gb.box(s > 0 ? nw : -nw - aw, 0, -L / 2 + 6, s > 0 ? nw + aw : -nw, 11, L / 2 - 2, { side: 'stoneLight', top: 'roofSlate' }, 3, 3);
      for (let t = -L / 2 + 10; t < L / 2 - 4; t += 8) { gb.box(s * (nw + aw) - 0.8, 0, t - 0.8, s * (nw + aw) + 0.8, 13, t + 0.8, 'stoneLight', 2, 2); gb.box(s * (nw + aw / 2) - 0.5, 13, t - 0.5, s * (nw + aw / 2) + 0.5, 18, t + 0.5, 'stoneLight', 2, 2); }
      for (let t = -L / 2 + 8; t < L / 2 - 6; t += 8) gb.quad('winB', [s > 0 ? nw + aw + 0.03 : -nw - aw - 0.03, 3, t + (s > 0 ? 1 : -1)], [0, 0, s > 0 ? -1 : 1], [0, 1, 0], 2, 5.5, 1, 1, { fixedUV: true }); }
    gb.box(-tr, 0, -12, tr, nh - 1, 0, { side: 'stoneLight', top: null }, 3, 3); gableRoof(gb, 'roofSlate', 'stoneLight', -tr, -12, tr, 0, nh - 1, 8, 0.6, true); // the transept
    gb.cyl('stoneLight', 0, -L / 2, nw, 0, nh - 2, 10, 3, 3); gb.cone('roofSlate', 0, -L / 2, nw + 0.5, nh - 2, 8, 10, 3);                                 // the apse at the east end
    const one = T.oneTower; gb.box(-3.2, 0, L / 2 + 5, 3.2, 32, L / 2 + 9, { side: 'stoneLight', top: 'stone' }, 3, 3); // the screen of the west front
    for (const s of one ? [0] : [-1, 1]) { const tx = s * 8.5, tw = one ? 7.5 : 5.5, th = one ? 62 : 52; gb.box(tx - tw, 0, L / 2 - 2, tx + tw, th, L / 2 + 9, { side: 'stoneLight', top: 'stone' }, 3, 3);  // the west towers and their spires
      gb.setXf(...xfP(xf, tx, L / 2 + 3.5), xf.ang, y); hipRoof(gb, 'roofSlate', -tw, -tw, tw, tw, th, one ? 30 : 34, 0.3); gb.xf = xf;
      for (let wy = 34; wy < th - 3; wy += 6) gb.quad('winB', [tx - 0.8, wy, L / 2 + 9.03], [1, 0, 0], [0, 1, 0], 1.6, 3.6, 1, 1, { fixedUV: true }); }
    gb.box(-3, 0, L / 2 + 8.9, 3, 0.2, L / 2 + 9.6, 'stone', 1, 1); gb.quad('door', [-2.2, 0.2, L / 2 + 9.05], [1, 0, 0], [0, 1, 0], 4.4, 6.2, 1, 1, { fixedUV: true }); // the great door
    wallDisc(gb, 'winB', 0, 26, L / 2 + 9.06, 3.4, 14); // the rose window
    gb.xf = null;
    for (const [lx, lz, hx, hz, top] of [[0, 0, nw + aw + 1, L / 2, 22], [0, -6, tr, 6, 21], [-8.5, L / 2 + 3.5, one ? 16 : 5.5, 5.5, 86], [8.5, L / 2 + 3.5, 5.5, 5.5, 86], [0, -L / 2, nw, nw, 28]]) { const [wx, wz] = xfP(xf, lx, lz); siteCol(area, wx, wz, xf.ang, hx, hz, y - 1, y + top); }
  },
  // the cloth hall facing the square, the belfry rising from the middle of its front
  hall(T, gb, b, area) {
    const y = T.H0, Lh = Math.min(70, b.u1 - b.u0 - 6), D = 16, [cx, cz] = T.w(b.uc, T.fv > 0 ? b.v1 - D / 2 - 1 : b.v0 + D / 2 + 1), xf = gb.setXf(cx, cz, T.cfg.ang + (T.fv > 0 ? 0 : Math.PI), y), rng = new RNG(7800);
    makeBuilding(area, gb, rng, { fp: { x0: -Lh / 2, z0: -D / 2, x1: Lh / 2, z1: D / 2 }, h: 12, stories: 3, style: 'brick', roof: 'gable', roofKey: 'roofSlate', roofTint: [0.8, 0.86, 0.95], alongX: true, pitch: 1.0, doorT: 0.3, found: 0.6, chimney: 0, wealth: 3 });
    for (let k = -Lh / 2 + 3; k < Lh / 2 - 2; k += 6) gb.box(k - 0.6, 0, D / 2 - 0.1, k + 0.6, 4.6, D / 2 + 0.9, 'stone', 1, 1); // an arcade of piers along the front
    const bv = T.cfg.seed % 3, bm = bv === 1 ? 'stoneLight' : 'brick'; // the belfry takes one of three forms, so towns differ on the skyline
    gb.box(-7, 0, -1, 7, 54, 13, { side: bm, top: 'stone' }, 3.2, 3.2); // the belfry: a tower over the front
    for (const [x0, z0, x1, z1] of [[-7, -1, -5.6, 13], [5.6, -1, 7, 13], [-7, -1, 7, 0.4], [-7, 11.6, 7, 13]]) gb.box(x0, 54, z0, x1, 55.4, z1, 'stone', 1, 1);
    if (bv === 1) { hipRoof(gb, 'roofSlate', -6.2, -0.2, 6.2, 12.2, 54, 24, 0.2); for (const [tx, tz] of [[-6, 0], [6, 0], [-6, 12], [6, 12]]) { gb.box(tx - 1.1, 50, tz - 1.1, tx + 1.1, 57, tz + 1.1, bm, 1, 1); gb.cone('roofSlate', tx, tz, 1.5, 57, 5, 6, 2); } } // a stone tower under a tall pyramid roof, with pinnacles
    else { for (const [tx, tz] of [[-6, 0], [6, 0], [-6, 12], [6, 12]]) { gb.box(tx - 1, 54, tz - 1, tx + 1, 59, tz + 1, bm, 1, 1); gb.cone('roofSlate', tx, tz, 1.4, 59, 3.5, 6, 2); } // corner turrets round the crown
      gb.setXf(...xfP(xf, 0, 0), xf.ang, y + 14); const top = bv === 2 ? 52 : 48; gb.cyl(bm, 0, 6, 5, 40, top, 8, 3, 3); for (let k = 0; k < 8; k++) { const a = (k + 0.5) / 8 * Math.PI * 2; gb.quad('winB', [Math.cos(a) * 5.05 - Math.sin(a) * 0.6, 44, 6 + Math.sin(a) * 5.05 + Math.cos(a) * 0.6], [Math.sin(a), 0, -Math.cos(a)], [0, 1, 0], 1.2, 3.4, 1, 1, { fixedUV: true }); }
      if (bv === 2) gb.cone('roofSlate', 0, 6, 5.6, 52, 13, 8, 3); // an octagon under a spire
      else { gb.cone('roofSlate', 0, 6, 5.8, 48, 3, 8, 3); gb.cyl('woodDark', 0, 6, 2, 51, 55, 8, 2, 2); gb.cone('roofSlate', 0, 6, 2.6, 55, 4, 8, 2); } } // or an octagon under a low cap and lantern
    gb.xf = xf; for (let wy = 14; wy < 52; wy += 6) gb.quad('winB', [-0.8, wy, 13.03], [1, 0, 0], [0, 1, 0], 1.6, 3.2, 1, 1, { fixedUV: true });
    wallDisc(gb, 'stoneLight', 0, 34.5, 13.06, 2.3, 12); gb.box(-0.1, 34.4, 13.06, 0.1, 36.2, 13.2, 'iron', 1, 1); gb.box(-0.1, 34.4, 13.06, 1.3, 34.6, 13.2, 'iron', 1, 1); // the clock
    gb.xf = null; const [bx, bz] = xfP(xf, 0, 6); siteCol(area, bx, bz, xf.ang, 7, 7, y - 1, y + 79);
    T.hallDoor = { x: xfP(xf, -Lh / 2 + Lh * 0.3, D / 2 + 0.2)[0], z: xfP(xf, -Lh / 2 + Lh * 0.3, D / 2 + 0.2)[1], y, nx: Math.sin(xf.ang), nz: Math.cos(xf.ang) };
  },
  // the citadel: a square curtain with corner towers, a gate to the town, the keep inside
  citadel(T, gb, b, area) {
    const y = T.H0, S2 = Math.min(b.u1 - b.u0, b.v1 - b.v0) / 2 - 4, [cx, cz] = T.w(b.uc, b.vc), xf = gb.setXf(cx, cz, T.cfg.ang, y), rng = new RNG(7900);
    const seg = (ax, az, bx, bz, gate) => { const L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), n = Math.round(L / 6);
      for (let k = 0; k < n; k++) { const f = (k + 0.5) / n, mx = lerp(ax, bx, f), mz = lerp(az, bz, f); if (gate && Math.abs(f - 0.5) < 0.09) continue; const [wx, wz] = xfP(xf, mx, mz);
        gb.setXf(wx, wz, xf.ang + ang, y); gb.box(-1.4, 0, -L / n / 2, 1.4, 11, L / n / 2, { side: 'stone', top: 'stone' }, 3, 3); for (let t = -L / n / 2 + 0.4; t < L / n / 2 - 0.5; t += 1.8) gb.box(-1.4, 11, t, -0.6, 12.2, t + 0.9, 'stone', 2, 2); gb.xf = xf; siteCol(area, wx, wz, xf.ang + ang, 1.4, L / n / 2, y - 1, y + 12.2); } };
    seg(-S2, -S2, S2, -S2); seg(S2, -S2, S2, S2, false); seg(S2, S2, -S2, S2, true); seg(-S2, S2, -S2, -S2);
    for (const [tx, tz] of [[-S2, -S2], [S2, -S2], [S2, S2], [-S2, S2]]) { gb.box(tx - 5, 0, tz - 5, tx + 5, 17, tz + 5, { side: 'stone', top: 'stone' }, 3, 3); hipRoof(gb, 'roofSlate', tx - 5, tz - 5, tx + 5, tz + 5, 17, 7, 0.4); const [wx, wz] = xfP(xf, tx, tz); siteCol(area, wx, wz, xf.ang, 5, 5, y - 1, y + 24); }
    gb.xf = null; const [kx, kz] = xfP(xf, 0, -S2 * 0.25); gb.setXf(kx, kz, xf.ang, y);
    makeBuilding(area, gb, rng, { fp: { x0: -12, z0: -12, x1: 12, z1: 12 }, h: 30, style: 'stone', roof: 'flat', doorT: 0.5, found: 1, winRate: 0.4, chimney: 0 });
    gb.box(-3, 30, -3, 3, 38, 3, { side: 'stone', top: 'stone' }, 3, 3); for (let t = -11.6; t < 11.6; t += 2.2) for (const [a, b] of [[t, -12], [t, 11.4], [-12, t], [11.4, t]]) gb.box(a, 30, b, a + 0.6 + (a === -12 || a === 11.4 ? 0 : 0.6), 31.4, b + 0.6 + (a === -12 || a === 11.4 ? 0.6 : 0), 'stone', 1, 1); // the keep's battlements
    gb.xf = null; gb.box(kx - 0.1, y + 38, kz - 0.1, kx + 0.1, y + 42, kz + 0.1, 'woodDark', 1, 1);
    // barracks along two sides of the ward, and a gate between two towers
    gb.setXf(...xfP(xf, 0, 0), xf.ang, y); for (const sd of [-1, 1]) { gb.setXf(...xfP(xf, sd * (S2 - 8), S2 * 0.1), xf.ang, y); makeBuilding(area, gb, rng, { fp: { x0: -5, z0: -S2 * 0.55, x1: 5, z1: S2 * 0.55 }, h: 7, stories: 2, style: 'stone', roof: 'gable', roofKey: 'roofSlate', alongX: false, doorT: 0.5, found: 0.4, chimney: 0.6, winRate: 0.7 }); }
    gb.setXf(...xfP(xf, 0, S2), xf.ang, y); for (const sd of [-1, 1]) { gb.box(sd * 6.5 - 3, 0, -3, sd * 6.5 + 3, 16, 3, { side: 'stone', top: 'stone' }, 3, 3); hipRoof(gb, 'roofSlate', sd * 6.5 - 3.3, -3.3, sd * 6.5 + 3.3, 3.3, 16, 5, 0.3); const [tx, tz] = xfP(xf, sd * 6.5, S2); siteCol(area, tx, tz, xf.ang, 3, 3, y - 1, y + 21); }
    gb.box(-3.5, 6, -2.5, 3.5, 13, 2.5, { side: 'stone', top: 'stone', bottom: 'stone' }, 3, 3); gb.xf = null;
    drapePatch(gb, 'sqCobble', xf, -S2 + 2, -S2 + 2, S2 - 2, S2 - 2, { cell: 6, lift: 0.05 });
  },
  // the market hall: a great roof on timber posts over the stalls, in a paved square
  market(T, gb, b, area) {
    const y = T.H0, Lm = Math.min(46, b.u1 - b.u0 - 14), Dm = Math.min(20, b.v1 - b.v0 - 14), [cx, cz] = T.w(b.uc, b.vc), xf = gb.setXf(cx, cz, T.cfg.ang, y);
    for (let x = -Lm / 2; x <= Lm / 2 + 0.01; x += Lm / Math.round(Lm / 4)) for (const z of [-Dm / 2, 0, Dm / 2]) { gb.box(x - 0.3, 0, z - 0.3, x + 0.3, 5.5, z + 0.3, 'woodDark', 1, 1); const [px, pz] = xfP(xf, x, z); siteCol(area, px, pz, xf.ang, 0.3, 0.3, y - 1, y + 5.5); }
    gb.box(-Lm / 2 - 0.3, 5.5, -Dm / 2 - 0.3, Lm / 2 + 0.3, 6.1, Dm / 2 + 0.3, 'woodDark', 1, 1); gableRoofTinted(gb, 'roofBrown', 'wood', -Lm / 2 - 1, -Dm / 2 - 1, Lm / 2 + 1, Dm / 2 + 1, 6.1, 7, 0.4, true, [0.85, 0.65, 0.55]);
    const rng = new RNG(7950); for (let k = 0; k < 10; k++) { const sx = rng.range(-Lm / 2 + 2, Lm / 2 - 2), sz = rng.pick([-Dm / 4, Dm / 4]); gb.box(sx - 1.2, 0, sz - 0.6, sx + 1.2, 0.9, sz + 0.6, { side: 'woodDark', top: rng.pick(['stallA', 'stallB', 'stallC']) }, 1, 1); }
    gb.xf = null;
  },
  // a windmill on the plain: a round stone tower, a cap, four sails
  mill(T, gb, m, area) {
    const y = T.H0 + 0.2, [x, z] = [m.x, m.z]; gb.tint = [1.1, 1.08, 1.0]; gb.cyl('plaster', x, z, 4.2, y - 1, y + 13, 10, 3, 3); gb.tint = null; gb.cone('roofThatch', x, z, 4.6, y + 13, 4.5, 10, 3);
    gb.quad('door', [x - 0.7 * Math.cos(m.a) + 4.25 * Math.sin(m.a), y, z + 0.7 * Math.sin(m.a) + 4.25 * Math.cos(m.a)], [Math.cos(m.a), 0, -Math.sin(m.a)], [0, 1, 0], 1.4, 2.3, 1, 1, { fixedUV: true });
    const hx = x + Math.sin(m.a) * 5, hz = z + Math.cos(m.a) * 5, hy = y + 13, ux = Math.cos(m.a), uz = -Math.sin(m.a);
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.35, ca = Math.cos(a), sa = Math.sin(a), P = (r, o) => [hx + ux * (ca * r - sa * o), hy + sa * r + ca * o, hz + uz * (ca * r - sa * o)];
      gb.quad4('sail', P(0.6, -0.15), P(10.5, -0.15), P(10.5, 1.5), P(0.6, 1.5), [0, 0], [1, 0], [1, 1], [0, 1], [Math.sin(m.a), 0, Math.cos(m.a)]); gb.quad4('woodDark', P(0, -0.2), P(11, -0.2), P(11, 0.15), P(0, 0.15), [0, 0], [1, 0], [1, 0.1], [0, 0.1], [Math.sin(m.a), 0, Math.cos(m.a)]); }
    siteCol(area, x, z, 0, 4.2, 4.2, y - 2, y + 18);
  },
};
// everything of the town that stands in one ground chunk: houses, walls and towers, gates and bridges, paving, quays, the great buildings, yards
Town.prototype.buildChunk = function (x0, z0, WC, gb, cols, fl, blocks) {
  const T = this, C = this.cfg, H0 = this.H0, area = { colliders: cols }, inC = (x, z) => x >= x0 && x < x0 + WC && z >= z0 && z < z0 + WC, ang = C.ang;
  if (Math.abs(x0 + WC / 2 - T.x) > C.A + C.B + 600 || Math.abs(z0 + WC / 2 - T.z) > C.A + C.B + 600) return 0;
  let n = 0;
  // houses
  for (const l of this.lotHash.query(x0, z0, x0 + WC, z0 + WC)) { if (!inC(l.x, l.z)) continue; const rng = new RNG(l.seed); l.prevStyle = l.prev ? this.styleOf(l.prev) : null; l.oddHeight = l.idx % 2 === 1; gb.setXf(l.x, l.z, l.o.ang, H0); townHouse(area, gb, rng, l, TK[l.kind], T); gb.xf = null; n++; }
  // paving: streets in pieces, the quays along the canal with their walls, the squares in tiles
  for (const s of this.streets) { if (s.nopave) continue;
    const L = Math.hypot(s.u1 - s.u0, s.v1 - s.v0), np = Math.max(1, Math.ceil(L / 16));
    for (let k = 0; k < np; k++) { const f0 = k / np, f1 = (k + 1) / np, mu = lerp(s.u0, s.u1, (f0 + f1) / 2), mv = lerp(s.v0, s.v1, (f0 + f1) / 2), [mx, mz] = this.w(mu, mv); if (!inC(mx, mz)) continue;
      const a = this.w(lerp(s.u0, s.u1, f0), lerp(s.v0, s.v1, f0)), b = this.w(lerp(s.u0, s.u1, f1), lerp(s.v0, s.v1, f1));
      if (s.quay) { drapeStrip(gb, 'rFlag', [a, b], s.w, { lift: 0.064, hAt: () => H0 }); const o = s.w / 2, wa = this.w(lerp(s.u0, s.u1, f0) + s.cn[0] * o, lerp(s.v0, s.v1, f0) + s.cn[1] * o), wb = this.w(lerp(s.u0, s.u1, f1) + s.cn[0] * o, lerp(s.v0, s.v1, f1) + s.cn[1] * o), Lq = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
        gb.setXf((wa[0] + wb[0]) / 2, (wa[1] + wb[1]) / 2, Math.atan2(wb[0] - wa[0], wb[1] - wa[1]), H0); gb.box(-0.5, -3.2, -Lq / 2 - 0.05, 0.5, 0.08, Lq / 2 + 0.05, { side: 'stone', top: 'stoneLight' }, 2, 2); gb.xf = null; continue; } // the quay wall
      drapeStrip(gb, s.main ? 'rFlag' : 'rCobble', [a, b], s.w, { lift: s.main ? 0.068 : s.lane ? 0.058 : 0.062, hAt: () => H0 });
    }
  }
  for (const b of this.blocks) if (b.use === 'square' || b.use === 'market' || b.use === 'cathedral' || b.use === 'parvis') {
    const t = 16; for (let u = b.u0 - (b.use === 'cathedral' ? 0 : 0); u < b.u1 - 0.01; u += t) for (let v = b.v0; v < b.v1 - 0.01; v += t) { const [mx, mz] = this.w(u + Math.min(t, b.u1 - u) / 2, v + Math.min(t, b.v1 - v) / 2); if (!inC(mx, mz)) continue;
      if (b.use === 'cathedral' && (u > b.u0 + 10 && u < b.u1 - 30 && v > b.v0 + 6 && v < b.v1 - 6)) { drapePatch(gb, 'gGrass', this.xf, u, v, Math.min(u + t, b.u1), Math.min(v + t, b.v1), { cell: 4, lift: 0.04 }); continue; } // the close's lawn
      drapePatch(gb, b.use === 'square' || b.use === 'parvis' ? 'sqFlag' : 'sqCobble', this.xf, u, v, Math.min(u + t, b.u1), Math.min(v + t, b.v1), { cell: 4, lift: 0.055 }); }
  }
  // the market on the Grand Square: stalls with awnings, a well, carts and barrels
  if (this.square) { const b = this.square, r2 = new RNG(8100), W2 = b.u1 - b.u0, H2 = b.v1 - b.v0;
    const at = (u, v) => this.w(u, v);
    { const [wx, wz] = at(b.uc + W2 * 0.15, b.vc); if (inC(wx, wz)) { gb.cyl('stone', wx, wz, 1.4, H0 - 0.2, H0 + 0.9, 10, 2, 2); gb.disc('water', wx, H0 + 0.5, wz, 1.2, 10, 2); for (const sd of [-1, 1]) gb.box(wx + sd * 1.3 - 0.1, H0, wz - 0.1, wx + sd * 1.3 + 0.1, H0 + 2.6, wz + 0.1, 'woodDark', 1, 1); gb.box(wx - 1.5, H0 + 2.5, wz - 0.12, wx + 1.5, H0 + 2.7, wz + 0.12, 'woodDark', 1, 1); siteCol(area, wx, wz, 0, 1.4, 1.4, H0 - 1, H0 + 0.9); } }
    const nS = Math.max(8, Math.round(W2 / 7)), rowsS = H2 > 70 ? 4 : 2; for (let k = 0; k < nS * rowsS; k++) { const row = Math.floor(k / nS), u = b.u0 + 6 + (k % nS) * (W2 - 12) / (nS - 1), v = b.v0 + H2 * (row + 0.5) / rowsS + r2.range(-1.5, 1.5), [sx, sz] = at(u, v); if (!inC(sx, sz) || r2.chance(0.15)) continue; const a = C.ang + (row % 2 ? Math.PI : 0);
      gb.setXf(sx, sz, a, H0); gb.box(-1.3, 0, -0.6, 1.3, 0.95, 0.6, { side: 'woodDark', top: 'wood' }, 1, 1); for (const [px, pz] of [[-1.25, -0.6], [1.25, -0.6], [-1.25, 1.1], [1.25, 1.1]]) gb.box(px - 0.05, 0, pz - 0.05, px + 0.05, pz < 0 ? 2.5 : 2.1, pz + 0.05, 'woodDark', 1, 1);
      gb.quad4(r2.pick(['stallA', 'stallB', 'stallC']), [-1.4, 2.5, -0.75], [1.4, 2.5, -0.75], [1.4, 2.1, 1.25], [-1.4, 2.1, 1.25], [0, 0], [2, 0], [2, 1], [0, 1], [0, 1, 1]);
      for (let q = 0; q < 3; q++) gb.box(-1 + q * 0.75, 0.95, -0.4, -0.55 + q * 0.75, 1.25, 0.1, r2.pick(['wood', 'roofThatch', 'stallB', 'cloth']), 1, 1);
      gb.xf = null; siteCol(area, sx, sz, a, 1.3, 0.6, H0 - 1, H0 + 0.95); }
    for (let k = 0; k < 3; k++) { const [cx2, cz2] = at(b.u0 + r2.range(8, W2 - 8), b.v0 + r2.range(6, H2 - 6)); if (!inC(cx2, cz2)) continue; const a = r2.range(0, 6.28); gb.setXf(cx2, cz2, a, H0); gb.box(-0.8, 0.5, -1.5, 0.8, 1.1, 1.5, { side: 'woodDark', top: 'wood' }, 1, 1); for (const sd of [-1, 1]) gb.box(sd * 0.85 - 0.06, 0, -0.5, sd * 0.85 + 0.06, 1.0, 0.5, 'woodDark', 1, 1); gb.box(-0.05, 0.6, 1.5, 0.05, 0.7, 3.2, 'woodDark', 1, 1); gb.xf = null; siteCol(area, cx2, cz2, a, 0.9, 1.6, H0 - 1, H0 + 1.1); }
    for (let k = 0; k < 8; k++) { const [bx2, bz2] = at(b.u0 + r2.range(3, W2 - 3), b.v0 + r2.range(3, H2 - 3)); if (inC(bx2, bz2)) gb.cyl('woodDark', bx2, bz2, 0.35, H0, H0 + 0.9, 8, 1, 1); }
    { const [px, pz] = at(b.u0 + W2 * 0.8, b.vc); if (inC(px, pz)) { gb.box(px - 1.6, H0, pz - 1.6, px + 1.6, H0 + 0.6, pz + 1.6, 'stone', 2, 2); gb.box(px - 0.2, H0 + 0.6, pz - 0.2, px + 0.2, H0 + 3.4, pz + 0.2, 'woodDark', 1, 1); gb.box(px - 0.9, H0 + 2.4, pz - 0.15, px + 0.9, H0 + 2.8, pz + 0.15, 'woodDark', 1, 1); siteCol(area, px, pz, 0, 1.6, 1.6, H0 - 1, H0 + 0.6); } } } // the pillory
  if (this.parvis) { const b = this.parvis, r2 = new RNG(8300), [cx2, cz2] = this.w((b.u0 + b.u1) / 2, b.vc);
    if (inC(cx2, cz2)) { gb.box(cx2 - 1.2, H0, cz2 - 1.2, cx2 + 1.2, H0 + 0.8, cz2 + 1.2, 'stone', 2, 2); gb.box(cx2 - 0.25, H0 + 0.8, cz2 - 0.25, cx2 + 0.25, H0 + 5.5, cz2 + 0.25, 'stoneLight', 1, 1); gb.setXf(cx2, cz2, C.ang, H0); gb.box(-1.2, 4.2, -0.22, 1.2, 4.7, 0.22, 'stoneLight', 1, 1); gb.xf = null; siteCol(area, cx2, cz2, 0, 1.2, 1.2, H0 - 1, H0 + 0.8); } // the calvary
    for (let u = b.u0 + 5; u < b.u1 - 4; u += 9) for (const v of [b.v0 + 3, b.v1 - 3]) { const [tx, tz] = this.w(u, v); if (!inC(tx, tz)) continue; fl[r2.pick(['oak0', 'oak1'])].push([tx, H0 - 0.15, tz, r2.range(0.75, 0.95)]); cols.push({ x0: tx - 0.35, z0: tz - 0.35, x1: tx + 0.35, z1: tz + 0.35, y0: H0 - 1, y1: H0 + 8 }); } }
  // boats moored along the quays, and cranes for the warehouses
  { const ci = C.canal, r2 = new RNG(8200), wl = this.wl(), lim = -(C.ring.off + C.ring.w / 2 + 4);
    for (let k = 0; k < this.canal.length - 1; k++) { const p = this.canal[k], q = this.canal[k + 1], L = Math.hypot(q[0] - p[0], q[1] - p[1]), du = (q[0] - p[0]) / L, dv = (q[1] - p[1]) / L, ca = Math.atan2(du, dv);
      for (let t = r2.range(8, 30); t < L - 8; t += r2.range(22, 46)) { const sd = r2.chance(0.5) ? 1 : -1, u = p[0] + du * t - dv * sd * (ci.w / 2 - 1.8), v = p[1] + dv * t + du * sd * (ci.w / 2 - 1.8), [bx2, bz2] = this.w(u, v);
        if (!inC(bx2, bz2) || this.wallOut(u, v) > lim || this.bridges.some(B2 => Math.hypot(B2.u - u, B2.v - v) < B2.hl + 9)) continue;
      gb.setXf(bx2, bz2, C.ang + ca, wl); gb.box(-1.2, -0.4, -3.4, 1.2, 0.5, 3.4, { side: 'woodDark', top: 'wood' }, 1, 1);
      for (const sd of [-1, 1]) { gb.tri('woodDark', [-1.2, -0.4, sd * 3.4], [1.2, -0.4, sd * 3.4], [0, 0.9, sd * 5], [0, 0], [1, 0], [0.5, 1], [0, 0.3, sd]); gb.tri('woodDark', [-1.2, 0.5, sd * 3.4], [0, 0.9, sd * 5], [-1.2, -0.4, sd * 3.4], [0, 0], [1, 0], [0.5, 1], [-1, 0, 0]); gb.tri('woodDark', [1.2, 0.5, sd * 3.4], [1.2, -0.4, sd * 3.4], [0, 0.9, sd * 5], [0, 0], [1, 0], [0.5, 1], [1, 0, 0]); gb.tri('wood', [-1.2, 0.5, sd * 3.4], [1.2, 0.5, sd * 3.4], [0, 0.9, sd * 5], [0, 0], [1, 0], [0.5, 1], [0, 1, 0]); } // bow and stern
      for (const s of [-1, 1]) gb.box(s * 1.2 - 0.12, 0.5, -3.4, s * 1.2 + 0.12, 0.85, 3.4, 'wood', 1, 1); // the gunwales
      gb.box(-1.1, 0.42, -3.3, 1.1, 0.5, 3.3, 'woodDark', 1, 1); gb.box(-0.05, 0.5, -5.2, 0.05, 1.8, -4.9, 'woodDark', 1, 1); // the hold's floor, the tiller
      if (r2.chance(0.6)) { gb.box(-0.08, 0.5, -0.6, 0.08, 7, -0.4, 'woodDark', 1, 1); gb.box(-0.06, 2.0, -0.55, 0.06, 2.12, 2.2, 'woodDark', 1, 1); gb.quad('sail', [-0.05, 2.2, -0.45], [0, 0, 1], [0, 1, 0], 2.6, 4, 2, 2, { double: true }); }
      else { gb.box(-0.85, 0.5, 0.8, 0.85, 1.6, 2.8, { side: 'wood', top: 'woodDark' }, 1, 1); gableRoof(gb, 'roofBrown', 'wood', -0.95, 0.7, 0.95, 2.9, 1.6, 0.6, 0.1, false); }
      for (let q = 0, nq = r2.int(1, 4); q < nq; q++) { const cz3 = r2.range(-3, -1); if (r2.chance(0.5)) gb.cyl('woodDark', r2.range(-0.6, 0.6), cz3, 0.32, 0.5, 1.25, 8, 1, 1); else gb.box(-0.4, 0.5, cz3 - 0.4, 0.4, 1.2, cz3 + 0.4, 'wood', 1, 1); } // its cargo: barrels and crates
      gb.xf = null; }
      for (const f of [0.35, 0.7]) { if (r2.chance(0.4)) continue; const sd = r2.chance(0.5) ? 1 : -1, o = ci.w / 2 + 2.5, u = p[0] + du * L * f - dv * sd * o, v = p[1] + dv * L * f + du * sd * o, [kx, kz] = this.w(u, v); if (!inC(kx, kz) || this.wallOut(u, v) > lim) continue;
        const ka = C.ang + Math.atan2(dv * sd, -du * sd); gb.setXf(kx, kz, ka, H0); gb.box(-0.6, 0, -0.6, 0.6, 9, 0.6, 'woodDark', 1, 1); gb.box(-0.3, 8.4, -0.3, 0.3, 8.9, 6.5, 'woodDark', 1, 1); gb.box(-0.03, 4, 6.2, 0.03, 8.4, 6.26, 'iron', 1, 1); gb.box(-1.4, 0, -1.4, 1.4, 1.6, 1.4, { side: 'woodDark', top: 'wood' }, 1, 1); gb.xf = null; siteCol(area, kx, kz, ka, 1.4, 1.4, H0 - 1, H0 + 9); } } } // (its jib reaches out over the water)
  // the great buildings, with the chunk their middle stands in
  for (const b of this.blocks) { if (!TOWN_BUILD[b.use]) continue; const [mx, mz] = this.w(b.uc, b.vc); if (inC(mx, mz)) { TOWN_BUILD[b.use](this, gb, b, area); n += 20; } }
  for (const m of this.mills) if (inC(m.x, m.z)) TOWN_BUILD.mill(this, gb, m, area);
  // the small squares of the quarters: paved, with a well and a tree or two; one in a few has its chapel
  for (const b of this.blocks) { if (b.use !== 'place' && b.use !== 'plein' && b.use !== 'chapel') continue; const [mx, mz] = this.w(b.uc, b.vc); if (!inC(mx, mz)) continue; const r2 = new RNG(Math.floor(b.uc * 7 + b.vc * 13) + 7100);
    drapePoly(gb, b.use === 'place' ? 'sqCobble' : 'sqFlag', b.poly.map(([u, v]) => this.w(u, v)), H0 + 0.056);
    if (b.use === 'chapel') { gb.setXf(mx, mz, ang + b.ang, H0); makeBuilding(area, gb, r2, { fp: { x0: -5, z0: -8, x1: 5, z1: 8 }, h: 7, style: 'stone', roof: 'gable', roofKey: 'roofSlate', alongX: false, doorT: 0.5, found: 0.5, chimney: 0 }); gb.box(-1.2, 7, -9.6, 1.2, 15, -7.2, 'stone', 2, 2); gb.cone('roofSlate', 0, -8.4, 1.8, 15, 5, 4, 2); gb.xf = null; continue; }
    if (b.use === 'plein' || b.area > 260) { const [wx, wz] = b.use === 'plein' ? [mx, mz] : this.w(b.uc + 2, b.vc); if (b.use === 'plein') { gb.cyl('stone', wx, wz, 1.3, H0 - 0.2, H0 + 0.9, 10, 2, 2); gb.disc('water', wx, H0 + 0.5, wz, 1.1, 10, 2); siteCol(area, wx, wz, 0, 1.3, 1.3, H0 - 1, H0 + 0.9); }
      for (let k = 0, nT = b.use === 'plein' ? 3 : 1; k < nT; k++) { const c = b.poly[k % b.poly.length], f = 0.4, tu = lerp(b.uc, c[0], f), tv = lerp(b.vc, c[1], f), [tx, tz] = this.w(tu, tv); fl[r2.pick(['oak0', 'oak1', 'oak2'])].push([tx, H0 - 0.15, tz, r2.range(0.6, 0.85)]); cols.push({ x0: tx - 0.35, z0: tz - 0.35, x1: tx + 0.35, z1: tz + 0.35, y0: H0 - 1, y1: H0 + 8 }); } } }
  // the roads out of the gates paved through the suburbs
  for (const g of this.gates) { const o0 = C.moat.off + C.moat.w + 8, pts = []; for (let t = o0; t <= o0 + 190; t += 10) pts.push(this.w(g.u + g.nu * t, g.v + g.nv * t)); for (let k = 1; k < pts.length; k++) if (inC(...pts[k - 1])) drapeStrip(gb, 'rCobble', [pts[k - 1], pts[k]], 7, { lift: 0.07 }); }
  // the squares just inside the gates
  for (const P of this.gateSquares) { const c = tCentroid(P), [mx, mz] = this.w(c[0], c[1]); if (inC(mx, mz)) drapePoly(gb, 'sqCobble', P.map(([u, v]) => this.w(u, v)), H0 + 0.052); }
  // yards and gardens inside the blocks: the ground before the houses paved, the gardens behind them walled, with trees, sheds and bushes; orchards in the commons
  for (const b of this.blocks) { if (b.use !== 'lots' || !b.lots) continue; const [mx, mz] = this.w(b.uc, b.vc); if (!inC(mx, mz)) continue; const r2 = new RNG(Math.floor(b.uc * 7 + b.vc * 13) + 7000), E = tEdgesIn(b.poly), built = b.lots.reduce((s2, l) => s2 + l.w * l.d, 0), nT = Math.floor(Math.max(0, Math.abs(tArea(b.poly)) - built) / (b.kind === 'commons' ? 120 : 200));
    { for (const h of tEdgesIn(b.poly)) { const dk = (b.edgeD && b.edgeD[h.i] || 2.4) + 0.6; drapePoly(gb, 'rCobble', [h.a, h.b, [h.b[0] + h.nu * dk, h.b[1] + h.nv * dk], [h.a[0] + h.nu * dk, h.a[1] + h.nv * dk]].map(([u, v]) => this.w(u, v)), H0 + 0.05); } let Y = b.poly; // (the ground before the houses paved, each row's depth back) for (const h of tEdgesIn(b.poly)) { if (Y.length < 3) break; h.c += (b.edgeD && b.edgeD[h.i] || 2.4) + 0.5; Y = tClipPoly(Y, h); }
      if (Y.length >= 3 && Math.abs(tArea(Y)) > 20) { drapePoly(gb, 'gGrass', Y.map(([u, v]) => this.w(u, v)), H0 + 0.053); const wk = b.kind === 'commons' || b.kind === 'tanners' ? 'wood' : 'stone', wh = wk === 'wood' ? 1.1 : 1.6; // the garden wall (a fence in the poorer quarters)
        for (let k = 0; k < Y.length; k++) { const a = Y[k], c = Y[(k + 1) % Y.length], L = Math.hypot(c[0] - a[0], c[1] - a[1]); if (L < 1) continue; const [ax, az] = this.w(a[0], a[1]), [cx, cz] = this.w(c[0], c[1]); gb.setXf((ax + cx) / 2, (az + cz) / 2, Math.atan2(cx - ax, cz - az), H0); gb.box(-0.15, 0, -L / 2, 0.15, wh, L / 2, wk, 2, 2); gb.xf = null; }
        if (b.kind === 'commons') { const yb = tEdgesIn(Y, 3), yc = tCentroid(Y), ya = b.ang || 0, ca = Math.cos(ya), sa = Math.sin(ya); for (let a = -60; a <= 60; a += 6.5) for (let c = -60; c <= 60; c += 6.5) { const u = yc[0] + a * ca + c * sa, v = yc[1] - a * sa + c * ca; if (!yb.every(h => tDot(h, [u, v]) - h.c > 0)) continue; const [x, z] = this.w(u, v); fl[r2.chance(0.7) ? 'oak2' : 'oak1'].push([x, H0 - 0.15, z, r2.range(0.42, 0.6)]); } continue; } } } // (an orchard)
    let u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9; for (const [u, v] of b.poly) { u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); }
    for (let k = 0, tries = 0; k < nT && tries < nT * 6; tries++) { const u = r2.range(u0, u1), v = r2.range(v0, v1); if (!E.every(h => tDot(h, [u, v]) - h.c > 2.2) || b.lots.some(l => Math.abs((u - l.u) * Math.cos(l.a) - (v - l.v) * Math.sin(l.a)) < l.w / 2 + 1.2 && Math.abs((u - l.u) * Math.sin(l.a) + (v - l.v) * Math.cos(l.a)) < l.d / 2 + 1.2)) continue; k++;
      const [x, z] = this.w(u, v); if (r2.chance(0.6)) { const kind = r2.pick(['oak0', 'oak1', 'oak2', 'cypress']); fl[kind].push([x, H0 - 0.15, z, r2.range(0.6, 0.95)]); cols.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, y0: H0 - 1, y1: H0 + 8 }); }
      else if (r2.chance(0.45)) { const sa = ang + (b.ang || 0) + r2.pick([0, Math.PI / 2]); gb.setXf(x, z, sa, H0); gb.box(-1.6, 0, -1.2, 1.6, 2.2, 1.2, { side: 'woodDark', top: 'roofBrown' }, 2, 2); gb.xf = null; siteCol(area, x, z, sa, 1.7, 1.3, H0 - 1, H0 + 2.2); }
      else fl[r2.chance(0.5) ? 'bush' : 'bushB'].push([x, H0 - 0.1, z, r2.range(0.7, 1)]); } }
  // the walls: lengths of curtain with a walk and merlons, square towers with roofs, gatehouses, arches where the canal goes under
  const WP = this.wallPieces(), W = C.wall;
  for (const p of WP.pieces) {
    const L = Math.hypot(p.u1 - p.u0, p.v1 - p.v0), n2 = Math.max(1, Math.round(L / 6)), a2 = Math.atan2(p.u1 - p.u0, p.v1 - p.v0);
    for (let k = 0; k < n2; k++) { const f = (k + 0.5) / n2, mu = lerp(p.u0, p.u1, f), mv = lerp(p.v0, p.v1, f), [mx, mz] = this.w(mu, mv); if (!inC(mx, mz)) continue;
      const gate = this.gates.some(g => Math.hypot(g.u - mu, g.v - mv) < W.gateW / 2 + L / n2 / 2), canal = tPolyDist([mu, mv], this.canal).d < C.canal.w / 2 + 1;
      const seg = L / n2; gb.setXf(mx, mz, ang + a2, H0);
      if (canal) { gb.box(-W.t / 2, 2.6, -seg / 2, W.t / 2, W.h, seg / 2, { side: 'cityWall', top: 'stone' }, 3, 3); gb.box(-W.t / 2, 2.52, -seg / 2, W.t / 2, 2.6, seg / 2, 'iron', 1, 1); for (const sd of [-1, 1]) gb.box(sd * W.t / 2 - 0.25, 2.6, -seg / 2, sd * W.t / 2 + 0.25, 3.6, seg / 2, 'stoneLight', 2, 1); gb.box(-W.t / 2 - 0.3, -2.5, -seg / 2 - 0.6, W.t / 2 + 0.3, 2.6, -seg / 2 + 0.6, { side: 'stone', top: 'stone' }, 2, 2); gb.xf = null; /* the vault in shadow, a band of dressed stone over it on both faces, a pier between the arches */ siteCol(area, mx, mz, ang + a2, W.t / 2, seg / 2, H0 - 4, H0 + W.h); continue; } // the water gate
      if (gate) { gb.box(-W.t / 2 - 1, 4.6, -seg / 2, W.t / 2 + 1, W.h + 3, seg / 2, { side: 'cityWall', top: 'stone' }, 3, 3); gb.xf = null; siteCol(area, mx, mz, ang + a2, W.t / 2 + 1, seg / 2, H0 + 4.6, H0 + W.h + 3); continue; } // the arch over the gateway
      gb.box(-W.t / 2, -1.5, -seg / 2 - 0.02, W.t / 2, W.h, seg / 2 + 0.02, { side: 'cityWall', top: 'stone' }, 3, 3); gb.box(-W.t / 2 - 1.3, W.h - 1.2, -seg / 2, -W.t / 2, W.h - 0.6, seg / 2, 'stone', 2, 2); /* the wall-walk on its corbels, inside */
      for (let t = -seg / 2 + 0.3; t < seg / 2 - 0.4; t += 1.9) gb.box(W.t / 2 - 0.75, W.h, t, W.t / 2 + 0.05, W.h + 1.3, t + 1.0, 'cityWall', 2, 2); // merlons on the outer edge
      gb.xf = null; siteCol(area, mx, mz, ang + a2, W.t / 2, seg / 2, H0 - 2, H0 + W.h + 1.3);
    }
  }
  for (const t of WP.towers) { const [x, z] = this.w(t.u, t.v); if (!inC(x, z)) continue; const s = W.tower / 2 + (t.corner ? 1.5 : 0), h = W.towerH + (t.corner ? 4 : 0); gb.setXf(x, z, ang + t.a, H0);
    gb.box(-s, -1.5, -s, s, h, s, { side: 'cityWall', top: 'stone' }, 3, 3); hipRoof(gb, 'roofSlate', -s, -s, s, s, h, s * 1.1, 0.4); for (const [a, b] of [[0, s + 0.03], [s + 0.03, 0]]) gb.quad('winB', [a ? a : -0.4, h - 4, b ? b : 0.4], a ? [0, 0, -1] : [1, 0, 0], [0, 1, 0], 0.8, 1.6, 1, 1, { fixedUV: true }); gb.xf = null; siteCol(area, x, z, ang + t.a, s, s, H0 - 2, H0 + h + s); }
  for (const g of this.gates) { if (!inC(g.x, g.z)) continue; const ga = ang + Math.atan2(g.nu, g.nv), [gx, gz] = [g.x, g.z];
    gb.setXf(gx, gz, ga, H0); for (const sd of [-1, 1]) { gb.box(sd * (W.gateW / 2) - (sd > 0 ? 0 : 6), -1.5, -6, sd * (W.gateW / 2) + (sd > 0 ? 6 : 0), W.h + 9, 6, { side: 'cityWall', top: 'stone' }, 3, 3); const tx = sd * (W.gateW / 2 + 3); hipRoof(gb, 'roofSlate', tx - 3.2, -6, tx + 3.2, 0.4, W.h + 9, 6, 0.4); }
    gb.box(-W.gateW / 2, 5, -5, W.gateW / 2, W.h + 9, 5, { side: 'cityWall', top: 'stone', bottom: 'stone' }, 3, 3); gb.quad('portcullis', [-W.gateW / 2, 3.4, 4.2], [1, 0, 0], [0, 1, 0], W.gateW, 1.6, 1, 1, { double: true }); // the gatehouse, its portcullis raised
    for (const sd of [-1, 1]) { gb.box(sd * W.gateW / 2 - 0.08, 0, -5, sd * W.gateW / 2 + 0.08, 5, 5, 'iron', 1, 1); gb.box(sd * (W.gateW / 2 + 0.6) - 0.6, -0.2, 6, sd * (W.gateW / 2 + 0.6) + 0.6, 5.4, 6.5, 'stoneLight', 1, 2); } // the passage in shadow, the jambs
    gb.box(-W.gateW / 2, 4.92, -5, W.gateW / 2, 5, 5, 'iron', 1, 1); gb.box(-W.gateW / 2 - 1.2, 5.4, 6, W.gateW / 2 + 1.2, 6.6, 6.5, 'stoneLight', 3, 1); for (let k = -1; k <= 1; k++) gb.box(k * 1.6 - 0.6, 6.6, 6, k * 1.6 + 0.6, 7.6 - Math.abs(k) * 0.5, 6.5, 'stoneLight', 1, 1); // the soffit, the arch head and its keystones
    for (let t = -W.gateW / 2 - 6 + 0.3; t < W.gateW / 2 + 6 - 0.5; t += 1.9) gb.box(t, W.h + 9, 5.2, t + 1, W.h + 10.4, 6, 'cityWall', 2, 2);
    // the bridge over the moat
    const bl = C.moat.off + C.moat.w + 8; gb.box(-W.gateW / 2 + 0.2, -0.35, 4, W.gateW / 2 - 0.2, 0.08, bl, { side: 'stone', top: 'flag' }, 2, 2); for (const sd of [-1, 1]) gb.box(sd * (W.gateW / 2 - 0.2) - 0.25, 0.08, 6, sd * (W.gateW / 2 - 0.2) + 0.25, 0.95, bl, 'stoneLight', 2, 2);
    gb.xf = null; for (const sd of [-1, 1]) { const [px, pz] = xfP(makeXf(gx, gz, ga), sd * (W.gateW / 2 + 3), 0); siteCol(area, px, pz, ga, 3, 6, H0 - 2, H0 + W.h + 11); }
    { const [bx, bz] = xfP(makeXf(gx, gz, ga), 0, (4 + bl) / 2); siteCol(area, bx, bz, ga, W.gateW / 2 - 0.2, (bl - 4) / 2, H0 - 0.4, H0 + 0.08); for (const sd of [-1, 1]) { const [px, pz] = xfP(makeXf(gx, gz, ga), sd * (W.gateW / 2 - 0.2), (6 + bl) / 2); siteCol(area, px, pz, ga, 0.25, (bl - 6) / 2, H0 + 0.08, H0 + 0.95); } }
    drapeStrip(gb, 'rFlag', [this.w(g.u - g.nu * 8, g.v - g.nv * 8), this.w(g.u + g.nu * 4, g.v + g.nv * 4)], W.gateW, { lift: 0.06, hAt: () => H0 }); }
  // bridges where streets cross the canal
  for (const B2 of this.bridges) { const [bx, bz] = this.w(B2.u, B2.v); if (!inC(bx, bz)) continue; const ba = ang + Math.atan2(B2.du, B2.dv), bw = B2.w, hl = B2.hl;
    gb.setXf(bx, bz, ba, H0); gb.box(-bw / 2, -0.6, -hl, bw / 2, 0.1, hl, { side: 'stone', top: 'flag' }, 2, 2); for (const sd of [-1, 1]) gb.box(sd * bw / 2 - (sd > 0 ? 0.5 : 0), 0.1, -hl, sd * bw / 2 + (sd > 0 ? 0 : 0.5), 1.0, hl, 'stoneLight', 2, 2);
    gb.box(-bw / 2, -3.2, -1, bw / 2, -0.6, 1, 'stone', 2, 2); gb.xf = null; siteCol(area, bx, bz, ba, bw / 2, hl, H0 - 0.7, H0 + 0.1); for (const sd of [-1, 1]) { const [px, pz] = xfP(makeXf(bx, bz, ba), sd * (bw / 2 - 0.25), 0); siteCol(area, px, pz, ba, 0.25, hl, H0 + 0.1, H0 + 1); } }
  return n;
};

/* ---------------- what is kept for good: the water, the lamps, the silhouette from afar, the doors ---------------- */
Town.prototype.buildLasting = function (area, mats) {
  const T = this, C = this.cfg, H0 = this.H0, wl = this.wl(), gb = new GB(); this.flags = this.flags || [];
  // the moat (a ring of water round the walls) and the canal
  { const g = gb.grp('wStream'), M = C.moat, hw = M.w / 2 + 0.6, ring = this.offPoly(M.off + M.w / 2); ring.push(ring[0]);
    const strip = (pts, w) => { for (let k = 1; k < pts.length; k++) { const [u0, v0] = pts[k - 1], [u1, v1] = pts[k], L = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / L * w, nv = (u1 - u0) / L * w, e = w / L; const P = [[u0 - (u1 - u0) * e + nu, v0 - (v1 - v0) * e + nv], [u1 + (u1 - u0) * e + nu, v1 + (v1 - v0) * e + nv], [u1 + (u1 - u0) * e - nu, v1 + (v1 - v0) * e - nv], [u0 - (u1 - u0) * e - nu, v0 - (v1 - v0) * e - nv]].map(([u, v]) => this.w(u, v));
      const base = g.p.length / 3; for (const [x, z] of P) { g.p.push(x, wl, z); g.u.push(x / 6, z / 6); g.c.push(0.72, 0.84, 0.86); } g.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2); } };
    strip(ring, hw); strip(this.canal, C.canal.w / 2 + 0.6); }
  // the lamps along the main streets and round the square: their light at night
  for (const s of this.streets) if (s.main) { const L = Math.hypot(s.u1 - s.u0, s.v1 - s.v0); for (let t = 12; t < L - 6; t += 32) { const f = t / L, u = lerp(s.u0, s.u1, f), v = lerp(s.v0, s.v1, f), du = (s.u1 - s.u0) / L, dv = (s.v1 - s.v0) / L, [x, z] = this.w(u - dv * (s.w / 2 - 0.6), v + du * (s.w / 2 - 0.6)); Sites.glows.push([x, H0 + 3.6, z, 3]); gb.box(x - 0.08, H0, z - 0.08, x + 0.08, H0 + 3.4, z + 0.08, 'iron', 1, 1); gb.box(x - 0.2, H0 + 3.3, z - 0.2, x + 0.2, H0 + 3.8, z + 0.2, 'lantern', 1, 1); } }
  this.group = gb.build(mats); this.group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); area.scene.add(this.group);
  // the silhouette: every house, tower and great building as a plain block, hidden wherever the ground chunk has the real thing
  { const sg = new GB(), mk = (base, key) => { const m = base.clone(); m.userData = {}; m.onBeforeCompile = sh => { sh.uniforms.wMask = Wild.maskU; sh.vertexShader = 'varying vec2 vTxz; varying float vWy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n { vec4 wp = modelMatrix * vec4(transformed, 1.0); vTxz = wp.xz; vWy = 140.0 + max(0.0, wp.y - ' + (H0 + 16).toFixed(1) + ') * 9.0; }');
      sh.fragmentShader = '#define FAR_HIGH\nuniform sampler2D wMask; varying vec2 vTxz; varying float vWy;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (texture2D(wMask, (floor((vTxz + 352.0) / 176.0) + vec2(64.5, 112.5)) / 128.0).r > 0.5) discard;').replace('#include <fog_fragment>', FAR_FOG.replace('mix(1.0, 0.6, hiK)', 'mix(1.0, 0.3, hiK)')); }; m.customProgramCacheKey = () => 'townFar' + key; /* (spires and towers stand out of the haze from far off) */ area.tintMats.push(m); return m; };
    const fm = { tfWall: mk(mats.plaster, 'w'), tfRoof: mk(mats.roofSlate, 'r'), tfBrick: mk(mats.brick, 'b') };
    for (const l of this.lots) { const r = new RNG(l.seed), K = TK[l.kind]; let st = r.pick(K.stories); if (l.type !== 'house') st = Math.max(2, st); const h = st * 3.1 + 0.3, rh = l.w / 2 * 1.35, style = r.pick(K.styles);
      sg.setXf(l.x, l.z, l.o.ang, H0); sg.tint = style === 'brick' ? [1, 0.82, 0.74] : style.startsWith('stone') ? [0.95, 0.95, 0.96] : [1.06, 1.02, 0.94];
      sg.box(-l.w / 2, 0, -l.d / 2, l.w / 2, h, l.d / 2, { side: style === 'brick' ? 'tfBrick' : 'tfWall', top: null }, 3.2, 3.2, { skip: 'b' }); sg.tint = { roofSlate: [0.5, 0.55, 0.66], roofRed: [0.7, 0.44, 0.38], roofBrown: [0.6, 0.47, 0.4], roofThatch: [0.72, 0.62, 0.42] }[K.roofs[r.int(0, K.roofs.length - 1)]] || [0.6, 0.5, 0.45]; gableRoof(sg, 'tfRoof', style === 'brick' ? 'tfBrick' : 'tfWall', -l.w / 2, -l.d / 2, l.w / 2, l.d / 2, h, rh, 0.3, false); sg.tint = null; sg.xf = null; }
    const WP = this.wallPieces(); sg.tint = [0.92, 0.9, 0.86];
    for (const p of WP.pieces) { const [ax, az] = this.w(p.u0, p.v0), [bx, bz] = this.w(p.u1, p.v1), L = Math.hypot(bx - ax, bz - az); sg.setXf((ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), H0); sg.box(-C.wall.t / 2, -1, -L / 2, C.wall.t / 2, C.wall.h + 1, L / 2, 'tfWall', 3, 3); sg.xf = null; }
    for (const t of WP.towers) { const [x, z] = this.w(t.u, t.v), s = C.wall.tower / 2 + (t.corner ? 1.5 : 0), h = C.wall.towerH + (t.corner ? 4 : 0); sg.setXf(x, z, C.ang + t.a, H0); sg.box(-s, -1, -s, s, h, s, 'tfWall', 3, 3); sg.tint = [0.72, 0.74, 0.82]; hipRoof(sg, 'tfRoof', -s, -s, s, s, h, s * 1.1, 0.4); sg.tint = [0.92, 0.9, 0.86]; sg.xf = null; }
    const tall = (u, v, hx, hz, h, roof) => { const [x, z] = this.w(u, v); sg.setXf(x, z, C.ang, H0); sg.tint = h > 30 ? [0.75, 0.66, 0.6] : [0.92, 0.9, 0.86]; sg.box(-hx, 0, -hz, hx, h, hz, h > 30 ? 'tfBrick' : 'tfWall', 3, 3); if (roof) { sg.tint = [0.45, 0.5, 0.6]; hipRoof(sg, 'tfRoof', -hx, -hz, hx, hz, h, roof, 0.3); sg.tint = [0.92, 0.9, 0.86]; } sg.xf = null; };
    if (this.cathedral) { const b = this.cathedral, { L, cu, nw, aw } = this.cathDims(b); tall(cu, b.vc, L / 2, nw + aw, 22, 9); if (this.oneTower) tall(cu + L / 2 + 3.5, b.vc, 7.5, 7.5, 62, 30); else { tall(cu + L / 2 + 3.5, b.vc - 8.5, 5.5, 5.5, 52, 34); tall(cu + L / 2 + 3.5, b.vc + 8.5, 5.5, 5.5, 52, 34); } }
    if (this.hall) { const b = this.hall, f = this.fv; tall(b.uc, f > 0 ? b.v1 - 9 : b.v0 + 9, Math.min(35, (b.u1 - b.u0) / 2 - 3), 8, 15, 6); tall(b.uc, f > 0 ? b.v1 - 3 : b.v0 + 3, 7, 7, 66, 13); }
    if (this.citadel) { const b = this.citadel; tall(b.uc, b.vc - 10, 12, 12, 38, 0); }
    for (const m of this.mills) { sg.tint = [1.1, 1.08, 1.0]; sg.cyl('tfWall', m.x, m.z, 4.2, H0 - 1, H0 + 13, 8, 3, 3); }
    sg.tint = null; this.far = sg.build(fm); this.far.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); o.frustumCulled = false; }); area.scene.add(this.far); }
  if (this.hall) { const b = this.hall, [hx, hz] = this.w(b.uc, this.fv > 0 ? b.v1 - 9 : b.v0 + 9), [fx, fz] = xfP(makeXf(hx, hz, C.ang + (this.fv > 0 ? 0 : Math.PI)), 0.2, 6); makeFlag(area, TEX.bannerRed, fx, H0 + 79.6, fz, C.ang, 2.6, 1.5); }
  if (this.citadel) { const b = this.citadel, S2 = Math.min(b.u1 - b.u0, b.v1 - b.v0) / 2 - 4, [kx, kz] = this.w(b.uc, b.vc - S2 * 0.25); makeFlag(area, TEX.bannerRed, kx + 0.1, H0 + 41, kz, C.ang, 2.6, 1.5); }
  // the doors: every house, shop and inn can be entered, as in Daggerfall
  const used = new Set();
  for (const l of this.lots) {
    const r = new RNG(l.seed + 11), K = TK[l.kind], wealth = { old: 2, grand: 3, close: 2.2, citadel: 1.5, canal: 2.2, commons: 0.7, weavers: 1.3, tanners: 0.9, suburb: 0.8 }[l.kind], owner = makeOwner(r, l.type, wealth);
    let name = buildingName(r, l.type, owner, wealth); for (let k = 0; k < 5 && used.has(name) && l.type !== 'house'; k++) name = buildingName(r, l.type, owner, wealth); used.add(name);
    const rec = { type: l.type, name, owner, door: this.doorOf(l), seed: r.int(1, 1e9), district: this.id + ':' + l.kind, wealth, poly: obbCorners(l.o), town: this.id };
    if (l.type === 'house') rec.residents = [owner];
    registerBuilding(area, rec);
  }
  if (this.cathedral) { const b = this.cathedral, { L, cu } = this.cathDims(b), [dx, dz] = this.w(cu + L / 2 + 10, b.vc), n = [Math.cos(C.ang), -Math.sin(C.ang)]; // the great door
    registerBuilding(area, { type: 'temple', name: 'the Cathedral of Saint Aurel', owner: makeOwner(new RNG(7701), 'temple', 2), door: { x: dx, z: dz, y: H0, nx: n[0], nz: n[1] }, seed: 7702, district: this.id + ':close', wealth: 2.5, town: this.id, id: this.id + '_cathedral' }); }
};

/* ---------------- the people in the streets ---------------- */
Town.prototype.updateFolk = function (px, pz, dt) {
  const near = this.inside(px, pz, 140); this.folk = (this.folk || []).filter(e => !e.removed);
  // people lingering in the squares: they stand about and wander a little, near the player
  this.loiter = (this.loiter || []).filter(e => !e.removed);
  for (const b of [this.square, this.market]) { if (!b) continue; const [sx, sz] = this.w(b.uc, b.vc), d = Math.hypot(sx - px, sz - pz), have = this.loiter.filter(e => e.data.sq === b);
    if (d < 180 && near && !have.length && !isNight(G.time)) for (let k = 0; k < 18; k++) { const r = new RNG(9500 + k + (b === this.market ? 50 : 0)), g = r.chance(0.5) ? 'f' : 'm', [x, z] = this.w(r.range(b.u0 + 4, b.u1 - 4), r.range(b.v0 + 4, b.v1 - 4)); this.loiter.push(spawnNPC(G.city, { name: personName(r, g), look: lookByWealth(r, g, 2), gender: g, x, z, role: 'wander', wanderR: 9, speed: 1, dialog: 'townsfolk', spriteKey: 'sq' + k, data: { sq: b } })); }
    else if ((d > 260 || isNight(G.time)) && have.length) for (const e of have) e.remove(); }
  if (!near) { for (const e of this.folk) e.remove(); this.folk = []; return; }
  const night = isNight(G.time), want = night ? 8 : 34;
  for (const e of this.folk) if (Math.hypot(e.pos.x - px, e.pos.z - pz) > 260) e.remove();
  this.folk = this.folk.filter(e => !e.removed); this.spawnT = (this.spawnT || 0) - dt;
  if (this.folk.length >= want || this.spawnT > 0) return; this.spawnT = this.folk.length < want / 2 ? 0 : 0.4;
  const cand = this.nodes.map((n, i) => [n, i]).filter(([n]) => { const d = Math.hypot(n.x - px, n.z - pz); return d > 25 && d < 200; }); if (!cand.length) return;
  const [n, i] = cand[rnd.int(0, cand.length - 1)], k = rnd.int(0, 39), r = new RNG(9300 + k), g = r.chance(0.5) ? 'f' : 'm', kind = this.districtAt(n.x, n.z) || this.cfg.districts[0], guard = r.chance(0.08);
  const nb = n.n.length ? this.nodes[n.n[rnd.int(0, n.n.length - 1)]] : n, f0 = rnd.next(); // somewhere along a street, not only at the corners
  const e = spawnNPC(G.city, { name: guard ? 'Town Watch' : personName(r, g), look: guard ? LOOKS.guard : lookByWealth(r, g, kind.wealth), gender: guard ? 'm' : g, x: lerp(n.x, nb.x, f0) + rnd.range(-1, 1), z: lerp(n.z, nb.z, f0) + rnd.range(-1, 1), role: 'townwalker', dialog: guard ? 'guard' : 'townsfolk', speed: r.range(1.1, 1.5), spriteKey: guard ? 'guard' : 'tw' + k, data: { town: this.id, node: i, prev: -1, lane: rnd.range(-0.8, 0.8) } });
  this.folk.push(e);
};
Town.prototype.stepFolk = function (e, dt) {
  const D = e.data, n = this.nodes[D.node]; if (!n) { e.moving = false; return; }
  if (D.pause > 0) { D.pause -= dt; e.moving = false; return; }
  let tx = n.x, tz = n.z; const p = D.prev >= 0 ? this.nodes[D.prev] : null;
  if (p) { const k = p.n.indexOf(D.node), w = k >= 0 ? p.w[k] : 6, dx = n.x - p.x, dz = n.z - p.z, l = Math.hypot(dx, dz) || 1, lane = D.lane * Math.max(0, w / 2 - 1); tx -= dz / l * lane; tz += dx / l * lane; }
  if (moveEnt(e, tx, tz, e.speed, dt) || Math.hypot(n.x - e.pos.x, n.z - e.pos.z) < 2.5) { const opts = n.n.filter(j => j !== D.prev); const next = opts.length ? opts[rnd.int(0, opts.length - 1)] : n.n[0]; D.prev = D.node; D.node = next; if (rnd.chance(0.15)) D.pause = rnd.range(1, 4); }
};
