/* =====================================================================
   The Giant's Ridge: a great bank of earth that carries the
   west road level across a wooded valley in the foothills west of
   Aldhaven, some 2 km long and up to 34 m above the valley floor. A
   seventh fixed landmark: its line, the height of its crest and the lie of
   the land round it are fixed data, taken from the world where it was
   first walked (seed 0), so it is the same in every world. It began as an
   accident of the endless world (docs/EMBANKMENT.md); here it is built on
   purpose: a level crest with the road along it, turfed sides, a borrow
   ditch at its foot, a culvert under its deepest point, white marker
   stones along the crest and stone piers where it begins and ends.
   ===================================================================== */
// c: half the crest's width; k: the fall of its sides (1.5: some 56 degrees, too steep to climb); kc: the rise of a cutting's sides
const RIDGE = { c: 4.2, k: 1.5, kc: 0.9, X0: -8700, Z0: -2800, C: 40, NI: 71, NJ: 73, B0: 40, BQ: 0.8 };
const RQ = { d: 1e9, s: 0, top: 0, u: 0 }; // the last ridgeNear: distance from the crest line, the place along it, the crest's height there, which side

// the land round it (bicubic through the fixed cells, a little fixed roughness on top)
function ridgeLand(x, z) {
  const R = RIDGE, fx = (x - R.X0) / R.C, fz = (z - R.Z0) / R.C, i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, T = R.land;
  const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  const row = jj => { const o = clamp(jj, 0, R.NJ - 1) * R.NI, at = ii => T[o + clamp(ii, 0, R.NI - 1)]; return cr(at(i - 1), at(i), at(i + 1), at(i + 2), u); };
  return cr(row(j - 1), row(j), row(j + 1), row(j + 2), v) + 0.9 * fbm(x / 31 + 7.3, z / 31, 2, 1971);
}
// within 140 m of the crest line: fills RQ (bilinear over an 8 m grid of the signed distance, exact across a straight stretch)
function ridgeNear(x, z) {
  const N = RIDGE.near, fx = (x - N.x0) / N.C, fz = (z - N.z0) / N.C, i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= N.ni - 1 || j >= N.nj - 1) return false;
  const k = j * N.ni + i, D = N.D, a = D[k], b = D[k + 1], c = D[k + N.ni], e = D[k + N.ni + 1];
  if (a > 1e8 || b > 1e8 || c > 1e8 || e > 1e8) return false;
  const u = fx - i, v = fz - j, S = N.S, sd = lerp(lerp(a, b, u), lerp(c, e, u), v);
  RQ.u = sd; RQ.d = Math.abs(sd); RQ.s = lerp(lerp(S[k], S[k + 1], u), lerp(S[k + N.ni], S[k + N.ni + 1], u), v); RQ.top = ridgeTop(RQ.s);
  return RQ.d < 140;
}
// the crest's height at s metres along the line
function ridgeTop(s) { const L = RIDGE.line, f = clamp(s / L.ds, 0, L.n - 1.001), q = Math.floor(f); return lerp(L.H[q], L.H[q + 1], f - q); }
// the point s metres along the line, and the direction it runs there
function ridgeAt(s) { const L = RIDGE.line, f = clamp(s / L.ds, 0, L.n - 1.001), q = Math.floor(f), t = f - q, dx = L.X[q + 1] - L.X[q], dz = L.Z[q + 1] - L.Z[q], l = Math.hypot(dx, dz) || 1;
  return { x: lerp(L.X[q], L.X[q + 1], t), z: lerp(L.Z[q], L.Z[q + 1], t), h: lerp(L.H[q], L.H[q + 1], t), tx: dx / l, tz: dz / l }; }
// how far a point lies from the landmark for its blending into the country (stretched beyond its ends and narrowing towards them, so the
// fixed ground keeps to the bank there and leaves the river and the villages near its ends alone)
function ridgeZoneD(x, z) {
  const F = RIDGE.far, fx = (x - F.x0) / F.C, fz = (z - F.z0) / F.C, i = Math.floor(fx), j = Math.floor(fz);
  if (i < 0 || j < 0 || i >= F.ni - 1 || j >= F.nj - 1) return 1e9;
  const k = j * F.ni + i, D = F.D, u = fx - i, v = fz - j; return lerp(lerp(D[k], D[k + 1], u), lerp(D[k + F.ni], D[k + F.ni + 1], u), v);
}
const smaxK = (a, b, k) => { if (k <= 0) return Math.max(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.max(a, b) + h * h * k * 0.25; };
const sminK = (a, b, k) => -smaxK(-a, -b, k);
// the ground: the land, the bank raised on it (a cutting where the land stands above the crest), the ditch at its foot, the culvert's channel
function ridgeH(x, z) {
  const g = ridgeLand(x, z); if (!ridgeNear(x, z)) return g;
  const R = RIDGE, r = RQ.d - R.c, top = RQ.top, bh = top - g; let h;
  if (r <= 0) h = top;
  else if (bh >= 0) h = smaxK(g, top - r * R.k, Math.min(2.6, r * 0.7)); // the turfed face, its foot rounded into the land
  else h = sminK(g, top + r * R.kc, Math.min(2.6, r * 0.7));
  if (R.stairs && r > 0) for (const St of R.stairs) { if ((RQ.u > 0 ? 1 : -1) !== St.side) continue; const a = RQ.s - St.s0, b = St.foot - RQ.d, L2 = St.len * St.len; // (along the bank from the flight's foot, and in from the foot of the face)
    const f = (a * St.along + b * St.run) / L2, w = (a * St.run - b * St.along) / St.len; if (f < -0.08 || f > 1.08 || Math.abs(w) > 6.5) continue;
    h = lerp(h, St.y(clamp(f, 0, 1)), (1 - smoothstep(2.6, 6.5, Math.abs(w))) * smoothstep(-0.08, 0, f) * (1 - smoothstep(1, 1.08, f))); } // level across, rising evenly along
  if (r > 0 && bh > 3) { const dc = r - bh / R.k - 6; h -= 0.8 * smoothstep(3, 9, bh) * Math.exp(-dc * dc / 7) * (0.75 + 0.35 * fbm(x / 36, z / 36, 1, 1973)); } // where its earth was dug
  const ds = RQ.s - R.sc; if (r > 0 && Math.abs(ds) < 9) { const rt = Math.max(0, bh) / R.k; h -= 0.6 * Math.exp(-ds * ds / 4) * smoothstep(rt - 1, rt + 3, r) * (1 - smoothstep(70, 120, r)); } // the winter water's channel to and from the culvert
  return h;
}
// woods on the valley sides, kept off the bank and its foot, a glade round the culvert
function ridgeForest(x, z) {
  const R = RIDGE; let f = smoothstep(-0.12, 0.22, fbm(x / 170 + 4.2, z / 170, 3, 1981) + 0.2) * (0.82 + 0.18 * fbm(x / 45, z / 45, 2, 1982));
  if (ridgeNear(x, z)) { const foot = R.c + Math.max(0, RQ.top - ridgeLand(x, z)) / R.k; f *= smoothstep(foot + 6, foot + 26, RQ.d); }
  return f * smoothstep(40, 95, Math.hypot(x - R.cx, z - R.cz));
}
// no trees or bushes on the bank (nor right at its foot), no plants at all on the crest
function ridgeKeep(x, z, r) {
  if (!ridgeNear(x, z)) return false; const R = RIDGE;
  if (r < 2) return RQ.d < R.c + 0.8;
  return RQ.d < R.c + Math.max(0, RQ.top - ridgeLand(x, z)) / R.k + 4 + r || Math.hypot(x - R.cx, z - R.cz) < 18;
}

// its steep faces are bare earth, the turf holding on in patches
function ridgeEarth(x, z, sl) {
  if (!ridgeNear(x, z)) return 0; const R = RIDGE, foot = R.c + Math.max(0, RQ.top - ridgeLand(x, z)) / R.k;
  if (RQ.d < R.c + 0.3 || RQ.d > foot + 3) return 0;
  const up = RQ.top - (RQ.d - R.c) * R.k - ridgeLand(x, z); // how far up the face (the turf creeps up from its foot)
  return smoothstep(0.5, 0.95, sl) * Math.min(1, 0.3 + 0.8 * smoothstep(-0.25, 0.25, fbm(x / 13, z / 13, 2, 1991))) * (0.4 + 0.6 * smoothstep(0, 7, up));
}
// the line, the grids and the landmark itself, made once at load
function ridgeSetup() {
  const R = RIDGE, P = RIDGE_P, n = P.length, M = 10, t0 = performance.now();
  { const s = atob(RIDGE_LAND); R.land = new Float32Array(s.length); for (let i = 0; i < s.length; i++) R.land[i] = R.B0 + s.charCodeAt(i) * R.BQ; }
  // the crest line, dense: Catmull-Rom through the points, then even steps
  const cr = (a, b, c, d, t) => b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));
  const dense = []; for (let k = 0; k < n - 1; k++) for (let i = 0; i < M; i++) { const a = P[Math.max(0, k - 1)], b = P[k], c = P[k + 1], d = P[Math.min(n - 1, k + 2)]; dense.push([0, 1, 2].map(q => cr(a[q], b[q], c[q], d[q], i / M))); }
  dense.push(P[n - 1].slice());
  const ev = resampleEven(dense.map(p => [p[0], p[1]]), 3), cum = [0]; for (let q = 1; q < dense.length; q++) cum.push(cum[q - 1] + Math.hypot(dense[q][0] - dense[q - 1][0], dense[q][1] - dense[q - 1][1]));
  const hAt = s => { let q = 0; while (q < cum.length - 2 && cum[q + 1] < s) q++; return lerp(dense[q][2], dense[q + 1][2], clamp((s - cum[q]) / (cum[q + 1] - cum[q] || 1), 0, 1)); };
  const L = R.line = { X: new Float64Array(ev.length), Z: new Float64Array(ev.length), H: new Float32Array(ev.length), n: ev.length, ds: 3 };
  let s = 0; ev.forEach(([x, z], q) => { if (q) s += Math.hypot(x - ev[q - 1][0], z - ev[q - 1][1]); L.X[q] = x; L.Z[q] = z; L.H[q] = hAt(s); });
  L.len = s; L.ds = s / (ev.length - 1); L.pts = ev;
  let bx0 = 1e9, bz0 = 1e9, bx1 = -1e9, bz1 = -1e9; for (const [x, z] of ev) { bx0 = Math.min(bx0, x); bz0 = Math.min(bz0, z); bx1 = Math.max(bx1, x); bz1 = Math.max(bz1, z); } R.box = [bx0, bz0, bx1, bz1];
  // near grid: the signed distance from the line and the place along it, within 140 m
  { const C = 8, m = 150, x0 = bx0 - m, z0 = bz0 - m, ni = Math.ceil((bx1 - bx0 + 2 * m) / C) + 1, nj = Math.ceil((bz1 - bz0 + 2 * m) / C) + 1, D = new Float32Array(ni * nj).fill(1e9), S = new Float32Array(ni * nj), A = new Float32Array(ni * nj).fill(1e9);
    for (let q = 0; q < L.n - 1; q++) { const ax = L.X[q], az = L.Z[q], ex = L.X[q + 1] - ax, ez = L.Z[q + 1] - az, l2 = ex * ex + ez * ez;
      const i0 = Math.max(0, Math.floor((Math.min(ax, ax + ex) - 140 - x0) / C)), i1 = Math.min(ni - 1, Math.ceil((Math.max(ax, ax + ex) + 140 - x0) / C)), j0 = Math.max(0, Math.floor((Math.min(az, az + ez) - 140 - z0) / C)), j1 = Math.min(nj - 1, Math.ceil((Math.max(az, az + ez) + 140 - z0) / C));
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const px = x0 + i * C - ax, pz = z0 + j * C - az, t = clamp((px * ex + pz * ez) / l2, 0, 1), dx = px - ex * t, dz = pz - ez * t, d = Math.hypot(dx, dz), k = j * ni + i;
        if (d < A[k]) { A[k] = d; D[k] = (ex * pz - ez * px >= 0 ? 1 : -1) * d; S[k] = (q + t) * L.ds; } } }
    for (let k = 0; k < D.length; k++) if (A[k] > 160) D[k] = 1e9;
    R.near = { C, x0, z0, ni, nj, D, S }; }
  // far grid: the distance the landmark blends by (beyond the ends stretched 2.5 times; narrowing over the last 250 m: 2.2 times at the
  // south-east end, 2.5 at the north-west)
  { const C = 40, m = 700, x0 = bx0 - m, z0 = bz0 - m, ni = Math.ceil((bx1 - bx0 + 2 * m) / C) + 1, nj = Math.ceil((bz1 - bz0 + 2 * m) / C) + 1, D = new Float32Array(ni * nj), Pc = P, nc = Pc.length;
    const tot = Pc.reduce((a, p, q) => q ? a + Math.hypot(p[0] - Pc[q - 1][0], p[1] - Pc[q - 1][1]) : 0, 0);
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) { const px = x0 + i * C, pz = z0 + j * C; let best = 1e9, s0 = 0;
      for (let q = 0; q < nc - 1; q++) { const ax = Pc[q][0], az = Pc[q][1], ex = Pc[q + 1][0] - ax, ez = Pc[q + 1][1] - az, l = Math.hypot(ex, ez), t = ((px - ax) * ex + (pz - az) * ez) / (l * l), tc = clamp(t, 0, 1);
        let e = Math.hypot(px - ax - ex * tc, pz - az - ez * tc);
        if (q === 0 && t < 0) { const a = -t * l; e = Math.sqrt(e * e + 5.25 * a * a); }
        if (q === nc - 2 && t > 1) { const a = (t - 1) * l; e = Math.sqrt(e * e + 5.25 * a * a); }
        const sa = s0 + tc * l; e *= 1 + 1.2 * (1 - smoothstep(0, 250, sa)) + 1.5 * smoothstep(tot - 250, tot, sa); s0 += l; if (e < best) best = e; }
      D[j * ni + i] = best; }
    R.far = { C, x0, z0, ni, nj, D }; }
  // the culvert under the deepest point; the piers where the bank stands 2 m high at either end
  let sc = 0, bm = -1e9, sa = 0, sb = L.len; for (let q = 0; q < L.n; q++) { const b = L.H[q] - ridgeLand(L.X[q], L.Z[q]); if (b > bm) { bm = b; sc = q * L.ds; } }
  for (let q = 0; q < L.n; q++) if (L.H[q] - ridgeLand(L.X[q], L.Z[q]) > 2) { sa = q * L.ds; break; }
  for (let q = L.n - 1; q >= 0; q--) if (L.H[q] - ridgeLand(L.X[q], L.Z[q]) > 2) { sb = q * L.ds; break; }
  const C0 = ridgeAt(sc); Object.assign(R, { sc, sa, sb, cx: C0.x, cz: C0.z, height: bm });
  // a flight of steps up each face beside the culvert: a slanting terrace cut into the face, from its foot to the crest (ridgeH lays it, the build its stones)
  const sp = (St, f) => { const q = ridgeAt(St.s0 + f * St.along), r = St.foot - f * St.run; return [q.x - q.tz * r * St.side, q.z + q.tx * r * St.side]; };
  R.stairs = [-1, 1].map(side => { const s0 = sc + 11, p0 = ridgeAt(s0); let foot = R.c; for (let it = 0; it < 4; it++) foot = R.c + Math.max(0, p0.h - ridgeLand(p0.x - p0.tz * foot * side, p0.z + p0.tx * foot * side)) / R.k;
    // the steps climb to a landing a metre below the crest by the time they are 12.5 m from its middle (the road's shoulder is too steep
    // to cross on a slant), then the landing rises gently onto the road
    const run = foot - R.c - 0.4, Hs = run * R.k, f1 = clamp((foot - 12.5) / run, 0.3, 0.9), len = (Hs - 1) / (0.72 * f1), along = Math.sqrt(Math.max(1, len * len - run * run));
    const St = { side, s0, along, foot, run, Hs, f1, y0: p0.h - 0.4 * R.k - Hs, len: Math.hypot(along, run) };
    St.y = f => St.y0 + (f < f1 ? (St.Hs - 1) * Math.max(0, f) / f1 : St.Hs - 1 + 0.8 * Math.min(1, (f - f1) / (1 - f1)));
    St.footP = sp(St, -0.02); St.topP = sp(St, 1.04); St.at = f => sp(St, f); return St; });
  // its roads: the crest from the south-east end to the north-west and on a little, and a short way out of the south-east end;
  // the country's tracks take over from both (kept exactly as laid: the road runs down the middle of the crest)
  const e0 = ridgeAt(0), e1 = ridgeAt(L.len), crest = ev.map(p => p.slice()); crest.push([e1.x + e1.tx * 30, e1.z + e1.tz * 30]);
  const out = [[e0.x, e0.z], [e0.x - e0.tx * 30, e0.z - e0.tz * 30], [e0.x - e0.tx * 60, e0.z - e0.tz * 60]];
  SITES.push({ id: 'ridge', name: "the Giant's Ridge", kind: 'bank', x: C0.x, z: C0.z, rc: 130, rb: 380, discR: 300, box: R.box, late: true, exact: true, wayKind: WAY.road,
    blurb: 'a great bank of earth that carries the road level across a wooded valley, thirty metres above its floor',
    dist: ridgeZoneD, road: [[C0.x, C0.z]], roads: [crest, out], forest: ridgeForest, keep: ridgeKeep, earth: ridgeEarth });
  SITE_H.ridge = ridgeH; R.setupMs = performance.now() - t0;
}

SITE_BUILD.ridge = function (gb, S, H, area) {
  const R = RIDGE, rng = new RNG(7701), col = (x, z, ang, hx, hz, y0, y1) => siteCol(area, x, z, ang, hx, hz, y0, y1);
  // white marker stones along both edges of the crest, every 30 m between the piers: to keep a cart on it in the dark or the fog
  for (let s = R.sa + 18; s < R.sb - 12; s += 30) { const p = ridgeAt(s), ang = Math.atan2(p.tx, p.tz);
    for (const side of [-1, 1]) { const x = p.x - p.tz * 3.9 * side, z = p.z + p.tx * 3.9 * side, y = H(x, z) - 0.15, hh = rng.range(0.58, 0.7);
      gb.tint = [1.5, 1.48, 1.42]; gb.cyl('plaster', x, z, 0.19, y, y + hh, 7, 1, 1); gb.cone('plaster', x, z, 0.19, y + hh, 0.12, 7, 1); gb.tint = null; // whitewashed
      col(x, z, ang, 0.2, 0.2, y - 1, y + hh + 0.1); } }
  // a pair of stone piers where the bank begins at either end, the road between them
  for (const s of [R.sa, R.sb]) { const p = ridgeAt(s), ang = Math.atan2(p.tx, p.tz);
    for (const side of [-1, 1]) { const x = p.x - p.tz * 3.95 * side, z = p.z + p.tx * 3.95 * side, y = H(x, z) - 0.6;
      gb.setXf(x, z, ang, y); gb.box(-0.55, 0, -0.55, 0.55, 3.0, 0.55, { side: 'stone', top: 'stone' }, 2, 2); gb.box(-0.68, 3.0, -0.68, 0.68, 3.28, 0.68, { side: 'stoneLight', top: 'stoneLight' }, 2, 2);
      gb.cyl('stoneLight', 0, 0, 0.32, 3.28, 3.62, 6, 2, 2); gb.cone('stoneLight', 0, 0, 0.32, 3.62, 0.34, 6, 2); gb.xf = null; col(x, z, ang, 0.6, 0.6, y - 1, y + 3.7); } }
  // the culvert: a stone portal at the foot of the bank on either side, an arched opening, wing walls holding back the slope
  { const p = ridgeAt(R.sc);
    for (const side of [-1, 1]) {
      const nx = -p.tz * side, nz = p.tx * side; let rt = R.c; for (let it = 0; it < 3; it++) rt = R.c + Math.max(0, p.h - ridgeLand(p.x + nx * rt, p.z + nz * rt)) / R.k; // where its face meets the land
      const fx = p.x + nx * (rt + 0.6), fz = p.z + nz * (rt + 0.6), y = ridgeLand(fx + nx * 3, fz + nz * 3) - 0.9, ang = Math.atan2(nx, nz), Hw = 4.6, hw = 3.6, D = 6.5;
      gb.setXf(fx, fz, ang, y);
      gb.box(-hw, -0.6, -D, hw, Hw, 0, { side: 'stone', top: 'stone' }, 2.4, 2.4, { skip: 'b' });
      gb.box(-hw - 0.15, Hw, -D, hw + 0.15, Hw + 0.35, 0.15, { side: 'stoneLight', top: 'stoneLight' }, 2, 2); // its coping
      // the opening: dark, a round arch on short jambs, a ring of paler voussoirs about it
      gb.tint = [0.16, 0.15, 0.14]; gb.quad('iron', [-1.1, 0.4, 0.04], [1, 0, 0], [0, 1, 0], 2.2, 1.3, 2, 2);
      for (let q = 0; q < 8; q++) { const a0 = q / 8 * Math.PI, a1 = (q + 1) / 8 * Math.PI; gb.tri('iron', [0, 1.7, 0.04], [Math.cos(a0) * 1.1, 1.7 + Math.sin(a0) * 1.1, 0.04], [Math.cos(a1) * 1.1, 1.7 + Math.sin(a1) * 1.1, 0.04], [0, 0], [1, 0], [1, 1], [0, 0, 1]); }
      gb.tint = null;
      for (let q = 0; q < 9; q++) { const a = (q + 0.5) / 9 * Math.PI, cx = Math.cos(a) * 1.35, cy = 1.7 + Math.sin(a) * 1.35; gb.setXf(...xfP(makeXf(fx, fz, ang), cx, 0.06), ang, y); gb.box(-0.24, cy - 0.24, 0, 0.24, cy + 0.24, 0.12, 'stoneLight', 1, 1); gb.setXf(fx, fz, ang, y); }
      gb.xf = null; col(fx - nx * D / 2, fz - nz * D / 2, ang, hw, D / 2, y - 1, y + Hw + 0.35);
      // wing walls, splayed and stepping down as the slope falls away
      for (const w of [-1, 1]) { const ax = xfP(makeXf(fx, fz, ang), w * hw, -0.3), wa = ang + w * 0.55, L = 5.5;
        for (let q = 0; q < 3; q++) { const t0 = q / 3 * L, t1 = (q + 1) / 3 * L, top = Hw * (1 - q * 0.28); gb.setXf(ax[0], ax[1], wa, y); gb.box(w > 0 ? 0 : -0.8, -0.6, t0, w > 0 ? 0.8 : 0, top, t1, { side: 'stone', top: 'stoneLight' }, 2.4, 2.4); gb.xf = null; }
        const [mx, mz] = xfP(makeXf(ax[0], ax[1], wa), w * 0.4, L / 2); col(mx, mz, wa, 0.4, L / 2, y - 1, y + Hw); }
      // stones the floods have left in the channel
      for (let q = 0; q < 7; q++) { const t = rng.range(3, 26), x = fx + nx * t + p.tx * rng.range(-1.6, 1.6), z = fz + nz * t + p.tz * rng.range(-1.6, 1.6); boulder(gb, 'boulder', x, H(x, z) - 0.05, z, rng.range(0.25, 0.6), rng); }
    } }
  // the steps up the faces: stone treads laid on the terrace, each a little proud of it at its front
  for (const St of R.stairs) { const n = Math.ceil((St.Hs - 1) / 0.25), [ax, az] = St.at(0), [bx, bz] = St.at(St.f1), ang = Math.atan2(bx - ax, bz - az), tread = Math.hypot(bx - ax, bz - az) / n;
    for (let q = 0; q < n; q++) { const [x, z] = St.at((q + 0.5) / n * St.f1), top = St.y((q + 1) / n * St.f1) + 0.03; gb.setXf(x, z, ang, top); gb.box(-0.85, -0.9, -tread / 2 - 0.01, 0.85, 0, tread / 2 + 0.01, { side: 'stone', top: 'flag' }, 2, 2, { skip: 'b' });
      for (const e of [-1, 1]) gb.box(e * 0.85 - 0.14, -0.9, -tread / 2 - 0.01, e * 0.85 + 0.14, 0.34, tread / 2 + 0.01, { side: 'stone', top: 'stoneLight' }, 2, 2, { skip: 'b' }); gb.xf = null; } } // (a kerb along either side)
};

/* ---------------- the fixed data ---------------- */
// the crest line, every 30 m or so from the south-east end to the north-west: x, z, the height of the crest
const RIDGE_P = [[-6613.6,-652,89],[-6630.2,-675.7,92.8],[-6645,-700.8,94.2],[-6658.5,-726.8,96.9],[-6671.4,-753.2,99.1],[-6684.7,-779.5,100.8],[-6699,-805.1,102.2],[-6714.9,-829.7,103.3],[-6732.3,-853.2,104.1],[-6751,-875.8,104.6],[-6770.7,-897.5,104.7],[-6791.1,-918.7,104.7],[-6812.2,-939.2,104.6],[-6834.1,-958.8,104.6],[-6857,-976.9,104.6],[-6880.9,-993.3,104.7],[-6905.7,-1007.7,104.9],[-6931,-1020,104.8],[-6956.4,-1030.6,104.6],[-6981,-1040.4,104],[-7003.9,-1051,103.3],[-7024.2,-1064.1,102.5],[-7041.2,-1080.8,101.8],[-7054.9,-1101.3,101.3],[-7066,-1125.2,101.3],[-7075.7,-1151.3,101.6],[-7085,-1178.6,102.1],[-7094.9,-1206.2,102.7],[-7105.9,-1233.6,103.2],[-7118.2,-1260.5,103.5],[-7132,-1286.5,103.4],[-7147.5,-1311.5,103],[-7164.7,-1335.3,102.2],[-7183.5,-1357.7,101.2],[-7203.8,-1378.8,100.1],[-7225.2,-1399,98.9],[-7247.2,-1418.5,97.9],[-7269.2,-1438,97],[-7291,-1457.7,96.5],[-7312.3,-1477.8,96.2],[-7333.6,-1498.1,96.2],[-7355,-1518.1,96.4],[-7376.7,-1537.9,96.6],[-7398.6,-1557.5,96.8],[-7420.2,-1577.3,97],[-7441.4,-1597.7,97.1],[-7461.9,-1618.8,97],[-7481.8,-1640.4,96.9],[-7501.4,-1662.3,96.7],[-7520.6,-1684.6,96.5],[-7539.4,-1707.3,96.3],[-7557.7,-1730.5,96.1],[-7575.4,-1754.1,95.9],[-7593,-1778,95.7],[-7610.7,-1801.8,95.6],[-7629.1,-1824.9,95.4],[-7648.6,-1847,95.3],[-7669.5,-1867.8,95.1],[-7691.7,-1887.3,95],[-7715,-1905.5,95],[-7739.2,-1922.7,94.9],[-7764.1,-1939.1,94.9],[-7789.4,-1955,94.8],[-7814.9,-1970.6,94.7],[-7840.5,-1986.1,94.6],[-7865.9,-2001.9,94.5],[-7890.9,-2018.2,93.1],[-7915.2,-2035.4,89.6],[-7938.4,-2053.8,87.3],[-7960.3,-2073.5,86.1]];
// the lie of the land round it: 40 m cells from (-8700, -2800), 71 x 73, one byte each (40 m + 0.8 m a step)
const RIDGE_LAND = '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ZllTVFlkcHl/g4WKk56or7GurKyrpZ6YjoN7c2hdUkxHRUNAOzIiEhEbICAkJyorKy4uLzEyNDc8PD5CR0hEQT43MC0tmot5b21xeYKLk5aVlZqksLm+wL++vryzrKack4mCem5hWVVTUUxFPC0aFR8lJigpKiwtLCwvMjY4Oz08PkJISkdEPzcxLzCyqJuWl5+nrrK0s6yrr7jE0tjW1NPRysK9uK6mnZSNgnVtZmJiXFFGNyEcJSosLi0rLS4tLjExNjk8PDw+QUdLS0dAODIwMdHJxsjK0djc29XNxMTK093q9vPt6ePZ0MvGvrmypZuUjIJ5c3FnW087JSIsMDI0MTAxMjI0MzI1ODo9PT9CR0tMTEY/NzM09e7t8PH0/P//+Ozj4+nx+f//////9+rd1tDIw7yzqaGZj4V9eW1jVDwpKDE4Nzc0NDU2NjUzMzM1Nzw9QENGSEpMSkI7OTn/////////////////////////////+uvk39bPycG3qp6VjIR9cWhYPi8uNj07ODU2ODc2NTMzMzQ3OjxBREdKS01KQz8+Pf///////////////////////////////PHq4djSy8Gxo5qSioF2a1hANjY8QT45Nzg6OTc1MzEyNDY5PD5DSExNTEpIRUNB/////////////////////////////////fHm3NbQxbSmm5GKgXZpVUM7PUREPzw7PD08Ojk0MzMyMzc6PD0+QUNDQT8+QUH/////////////////////////////////9ejc0cm+r6OZkIl+cWBQRUFFSkdCQEBBQD49PDY2NTMzNjo7NjIxMjQyLzI3Ov////////////////////////////////zs3NHIvbOlmZCIgHdoV0xGSE1PTEhHR0VDQkE9NjY1NDQ1NTcyKycnKCUkJyou////////////////////////////////7drKwLisoJWMhX12bF1RS0lOUlJQTktKSUlIRT44NjUzMjIyNDEpIyMjIB8iJCf/////////////////////////////++nZyr60q6CVi4R9dW1kWVFNUFZYWFhVU1JQTkpGQT05NTExMTEyMSolIyIgHh8hIf////////////////////////////7v39DHvbOpnZOKg3txaWNbVFNaXl9fXVpYVlNOSUZDQTw2MjEuKysrKScjIB8eHh0d////////////////////////////+e7g0crBuLClmpGJf3RrZl9YWV9hYmFdW1hVUUxJRkRDPzg0LyonJSQkIyIhHx0aGRr////////////////////////////27uHUzMS8tKqhmZGHenFrZF1eX2BjY15aWVZRTEhEQ0I/ODMtKCYlJCIgICIgHBkZGv//////////////////////////8eXe1MvEvbevpJyXkIqBd3BoYmBeXmBhYFtZVlFMSENBPz02LyonJiUkIiEgISEcGxsb/////////////////////////+7f0MjDu7ayraaemJSOiIB4dGtlYl9dXl9fXVlWUk5JQj47OjQtKScmJiUlIyMjIh4eICH////////////////////////r18i7tbOxsLGuqKKdmJGKgnl2b2hkYV9fXl1eW1dUUUpDPjo3NC4qKCgnJiYlJSUjICAhI///////////////////////6NC/sqqpq660urq3sauilYuBd3JtZ2JfXmBfXV1cWVdSSkM9NzQzLiooKCckJCMkJSIeHB0e/////////////////////+bOu6+mpKixucHHxsK/uayZiX1zbGhiXVteYV9dXF1dXVVJQTkzMjEtKykoJiIhHyAiHxsZGhv////////////////////u072up6SosbvAwsLCwb+7rpyKfHBoZWBaWFtdW15dYGNgVUk+NjMxLysoJygkHx0cHR8dGRcXGP///////////////////+LHsqilqLG7vr28uru8ubSpmox+cWljXFhVV1hYXVxhZWFWST41MS8sKiYmJyMdHBscHhsYFhYX///////////////////11buqpKWvu8PCvru6u7q2r6OWiX90a2JcWFVXVlZbXmRoZFlLPzcxLywqJyUlIh8dHB0eGxgWFhj//////////////////+PEsKekqbfEx8TAvby9vLeuoZOFeXFqYV1aWFdUVVlfY2RgWUtCOTIvLCkmIyIgIB4eHx8dGhobHf/////////////////y0bappqeyxMzHw8C9u7y8taeajX9zbGZeW1tXU1FUWV5eWVVQRT84MS0qKCUiHx0dHR0dHx8dHiAg/////////////////+XGsaipsMHU2NDJw767uberm46DeW9oYVtYV1RQUFVZW1VPS0Y/OjQvLiwpJSEdGhgYGRgbHh4fIB7////////////////+2sKyrK660eLf1s7Fvbe1rZuPhHpxZ2FbV1VTUU1NU1VRS0ZDPjk1MCoqKSYjHhoXFRMUExYZGhsbGf////////////////jYxLWxtMLY5+LWyr60ra2ikYd9c2tkXVhVUU9LR0VJSUdEPz05MzEtKSclIR8aFhUSDw8QERMVFhcV////////////////8NG9r620xNbi3M7AtaukoJmLgnlxa2VfWlVQTUdCP0A/Pz06OTUwLSspKCMcGRYTEQ8MDQ0OEBMVFBP////////////////gxbSop7C/zNPOxLeupZ2Xj4V+dm9rZWBcV1BKRD07OTk5ODc2My4rKCUkIBgUEhAODAkJCgoKDA8PDv//////////////99S9raOgp7TBxsC3rqefl5GIf3pzbWhiXl1WTkZAOzc2NzY1MzIwLCgmJCEbFREPDAsKBwYHBgUGCAkJ///////////////pzrmon5ueq7u/uK+loZqSjIV8d3BoYlxYVlFKRD05NTIzMTAwLy0pJSMhHRYRDgwKCQcEAwICAQAAAAH/////////////9ePKtaKZlpahs7myqKCblY2HgXpyamNcVlFPTEZAOTYxLi4tLCwrKiQhHhoXEg0LCggGAwEAAAAAAAAAAP/////////////v3cWvnJOPj5ensK2mn5mTiYJ8dm5lXlhSTkxJQTs1MS4rKSknJSUkHhoaGBQOCQcGBAMAAAAAAAAAAAAA8v///////////erVvKaUi4iIjZmip6eimpOIfnVuaWRdV1BNTEU8NC4sKiYjIyIgHx4YFRQVEg0IBQIAAAAAAAAAAAAAAAA=';
ridgeSetup();
