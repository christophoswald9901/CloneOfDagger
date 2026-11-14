/* =====================================================================
   Settlement: where the people of the generated country live and farm,
   planned once for the whole country at load (after the rivers, the lie
   of the land and the tracks). Villages and hamlets stand where people
   would settle: on dry, gentle ground near water, by a track, at a
   junction or a crossing, on the valley floor or its edge, out of the
   wind. Each has a territory: fields on the good land round it, pasture
   on the slopes beyond, then wood or moor. Farmsteads stand in it, joined
   by lanes to the village and the tracks. The fields are laid out as
   blocks of strips (furlongs) on a lattice turned to a lane, the contour
   or the city's own fields, filling the farmland and thinning outwards.
   The chunks draw from this plan: a block's strips are worked out the
   same whichever chunk asks.
   ===================================================================== */
const SETTLE_R = { village: [950, 1400], hamlet: [520, 850], city: [2200, 2900], town: [1400, 1850] }; // how far (in walking effort) the fields and the pasture reach
const SETTLE_NAMES = [['Ash', 'Bram', 'Cold', 'Elm', 'Fern', 'Gor', 'Hart', 'Kel', 'Lark', 'Mer', 'Oak', 'Rook', 'Sedge', 'Thorn', 'Wil', 'Bar', 'Dun', 'Hol', 'Brack', 'Stan', 'Ald', 'Bur', 'Cran', 'Ever', 'Fox', 'Lang', 'Mill', 'Nor', 'Sut', 'Wether'],
  ['ford', 'ham', 'wick', 'by', 'stead', 'ley', 'combe', 'thorpe', 'well', 'hollow', 'cote', 'mere', 'field', 'bridge', 'worth', 'ton', 'den', 'hurst']];
function _chamfer(D, NI, NJ, C) { // distances on a grid from the cells set to 0 (two passes)
  const d1 = C, d2 = C * 1.4142;
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const k = j * NI + i; let v = D[k]; if (i > 0) v = Math.min(v, D[k - 1] + d1); if (j > 0) { v = Math.min(v, D[k - NI] + d1); if (i > 0) v = Math.min(v, D[k - NI - 1] + d2); if (i < NI - 1) v = Math.min(v, D[k - NI + 1] + d2); } D[k] = v; }
  for (let j = NJ - 1; j >= 0; j--) for (let i = NI - 1; i >= 0; i--) { const k = j * NI + i; let v = D[k]; if (i < NI - 1) v = Math.min(v, D[k + 1] + d1); if (j < NJ - 1) { v = Math.min(v, D[k + NI] + d1); if (i < NI - 1) v = Math.min(v, D[k + NI + 1] + d2); if (i > 0) v = Math.min(v, D[k + NI - 1] + d2); } D[k] = v; }
}
// a binary heap of (key, value) pairs, smallest key first
class _Heap { constructor() { this.k = []; this.v = []; }
  get size() { return this.k.length; }
  push(key, val) { const K = this.k, V = this.v; let i = K.length; K.push(key); V.push(val); while (i > 0) { const p = (i - 1) >> 1; if (K[p] <= key) break; K[i] = K[p]; V[i] = V[p]; i = p; } K[i] = key; V[i] = val; }
  pop() { const K = this.k, V = this.v, top = V[0], lk = K.pop(), lv = V.pop(), n = K.length; if (n) { let i = 0; for (;;) { let c = 2 * i + 1; if (c >= n) break; if (c + 1 < n && K[c + 1] < K[c]) c++; if (K[c] >= lk) break; K[i] = K[c]; V[i] = V[c]; i = c; } K[i] = lk; V[i] = lv; } return top; }
}

const Settle = {
  ready: false, list: [], owners: [], farms: [], blocks: [], seeds: [], builds: [], ms: 0,
  plan() {
    const t0 = performance.now(), T = LAND.lf, W = Wild, ss = smoothstep, prof = [['start', t0]]; if (!T) return;
    const { C, X0, Z0, NI, NJ, H, SL, TPI, TPL, WET, SUN } = T, n = NI * NJ, cx = i => X0 + i * C, cz = j => Z0 + j * C;
    const cellOf = (x, z) => { const i = Math.round((x - X0) / C), j = Math.round((z - Z0) / C); return i < 0 || j < 0 || i >= NI || j >= NJ ? -1 : j * NI + i; };
    /* ---- what each 50 m cell of the country is good for ---- */
    const EX = new Uint8Array(n), AR = new Float32Array(n), PA = new Float32Array(n); // EX 1: no one lives or farms here (sea, mountains, the city's own ground), 2: kept as it is (a landmark's or a town's ground)
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = j * NI + i, x = cx(i), z = cz(j), h = H[k];
      if (h < SEA + 2.5 || x < WORLD.x0 || x > WORLD.x1 || z < WORLD.z0 || z > WORLD.z1 || Math.max(Math.abs(x), Math.abs(z)) < TG.R + 30 || coastZ(x) - z < 60 || rimDist(x, z) < 1000) { EX[k] = 1; continue; }
      if (townCore(x, z) > 0 || siteWild(x, z) > 0.05) { EX[k] = 2; continue; }
      const TL = wildTreeLine(x, z), sl = SL[k], expo = clamp(0.62 * ss(4, 30, TPI[k]) + 0.5 * ss(10, 90, TPL[k]), 0, 1), wet = WET[k];
      AR[k] = (1 - ss(0.06, 0.16, sl)) * (1 - ss(0.42, 0.8, expo)) * (1 - ss(0.5, 0.85, wet)) * (1 - ss(TL - 110, TL - 45, h)); // the plough: gentle, sheltered, drained, low
      PA[k] = (1 - ss(0.15, 0.3, sl)) * (1 - ss(0.6, 0.95, expo)) * (1 - ss(0.72, 0.95, wet)) * (1 - ss(TL - 50, TL - 5, h));     // the grazing: the slopes beyond
    }
    // how far each cell lies from running water (any stream), and which cells a river too wide to wade runs through
    const SD = new Float32Array(n).fill(1e4), WR = new Uint8Array(n);
    for (const R of LAND.rivers) for (let q = 0; q < R.P.length; q += 3) { const k = cellOf(R.P[q][0], R.P[q][1]); if (k < 0) continue; SD[k] = 0; if (R.w[q] >= 4.5) WR[k] = 1; }
    _chamfer(SD, NI, NJ, C);
    // the good land round each place: the mean of the plough's ground within some 400 m (a village must feed itself)
    const IW = NI + 1, I = new Float64Array(IW * (NJ + 1));
    for (let j = 0; j < NJ; j++) { let row = 0; for (let i = 0; i < NI; i++) { row += AR[j * NI + i]; I[(j + 1) * IW + i + 1] = I[j * IW + i + 1] + row; } }
    const meanAR = (i, j, r) => { const i0 = Math.max(0, i - r), i1 = Math.min(NI - 1, i + r), j0 = Math.max(0, j - r), j1 = Math.min(NJ - 1, j + r); return (I[(j1 + 1) * IW + i1 + 1] - I[j0 * IW + i1 + 1] - I[(j1 + 1) * IW + i0] + I[j0 * IW + i0]) / ((i1 - i0 + 1) * (j1 - j0 + 1)); };
    /* ---- where the ways meet and cross the water ---- */
    const ways = W.tracks.filter(t => !t.lane), junc = [], cross = [];
    for (const t of ways) if (t.joined) junc.push(t[t.length - 1]);
    for (const b of W.bridges) cross.push([b.x, b.z]);
    for (const t of ways) for (let q = 0; q < t.length; q += 4) { const [x, z] = t[q], rv = riverNear(x, z, 12); if (rv && rv.d < rv.w / 2 + 3 && !cross.some(p => Math.hypot(p[0] - x, p[1] - z) < 150)) cross.push([x, z]); } // the fords
    this.houseHash = new SHash(32); this.builds = []; const wayHash = new SHash(64);
    const addWay = (t, ti) => { for (let q = 1; q < t.length; q++) { const [ax, az] = t[q - 1], [bx, bz] = t[q]; wayHash.add([ax, az, bx, bz, ti, q], [Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz)]); } };
    W.tracks.forEach(addWay);
    const wayNear = (x, z, r, skip = -1) => { let best = null, bd = r; for (const s of wayHash.query(x - r, z - r, x + r, z + r)) { if (s[4] === skip) continue; const q = segDist(x, z, s[0], s[1], s[2], s[3]); if (q.d < bd) { bd = q.d; best = { d: q.d, x: q.x, z: q.z, ang: Math.atan2(s[2] - s[0], s[3] - s[1]), ti: s[4] }; } } return best; };
    const nearest = (L, x, z) => { let d = 1e9; for (const p of L) { const e = Math.hypot(p[0] - x, p[1] - z); if (e < d) d = e; } return d; };
    const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];
    const cityOut = (x, z) => Math.max(Math.abs(x), Math.abs(z)) - TG.R, townOut = (x, z) => { let d = 1e9; for (const Tn of TOWNS) d = Math.min(d, Tn.rectOut(x, z) - Tn.cfg.moat.off - Tn.cfg.moat.w); return d; };
    prof.push(['cand', performance.now()]);
    /* ---- the places worth settling, best first ---- */
    const cand = [];
    for (let j = 2; j < NJ - 2; j++) for (let i = 2; i < NI - 2; i++) {
      const k = j * NI + i; if (EX[k] || AR[k] < 0.5 || SL[k] > 0.09 || WET[k] > 0.5) continue;
      const x = cx(i), z = cz(j), td = W.trackD(x, z); if (cityOut(x, z) < 1150 || townOut(x, z) < 1150) continue;
      const floor = ss(-3, -14, TPI[k]) * (1 - ss(0.06, 0.16, SL[k])), expo = clamp(0.62 * ss(4, 30, TPI[k]) + 0.5 * ss(10, 90, TPL[k]), 0, 1), sd = SD[k];
      const s = 1.5 * meanAR(i, j, 8) + 0.4 * AR[k]
        + 0.45 * (1 - ss(120, 700, sd)) - 0.5 * (1 - ss(30, 80, sd))       // water near, but not on the bank
        + 0.55 * (1 - ss(30, 320, td))                                       // on a way
        + 0.45 * (1 - ss(80, 500, nearest(junc, x, z))) + 0.35 * (1 - ss(80, 450, nearest(cross, x, z))) // where ways meet, or cross the water
        + 0.3 * floor - 0.4 * expo + 0.12 * SUN[k] + 0.3 * _h2(i, j, 7300 + WSEED); // the valley floor or its edge, out of the wind, in the sun
      cand.push({ k, x, z, s, td });
    }
    cand.sort((a, b) => b.s - a.s);
    prof.push(['sort', performance.now()]);
    const list = [], used = new Set(), rng = new RNG(7301 + WSEED * 131);
    const flatAt = (x, z, r, lim) => { let lo = 1e9, hi = -1e9; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const v = terrainRaw(x + a * r, z + b * r); lo = Math.min(lo, v); hi = Math.max(hi, v); } return hi - lo < lim && lo > SEA + 2.5; };
    const okSpot = (x, z) => !siteZone(x, z, 250) && townCore(x, z) === 0 && !riverNear(x, z, 40) && flatAt(x, z, 10, 9) && !W.bridges.some(b => Math.hypot(b.x - x, b.z - z) < b.half + 40);
    // the nearest point of a way (not a lane) to a place
    const wayPt = (x, z, r) => { const w = wayNear(x, z, r); if (!w) return null; const s2 = wayHash.query(w.x - 1, w.z - 1, w.x + 1, w.z + 1).find(s => s[4] === w.ti); const t = W.tracks[w.ti]; return t.lane ? null : { ti: ways.indexOf(t), q: s2 ? s2[5] : 1, d: w.d }; };
    const tiOf = t => W.tracks.indexOf(t);
    const place = (c, kind) => {
      const far = kind === 'village' ? 1900 : 1100; if (list.some(o => Math.hypot(o.x - c.x, o.z - c.z) < (o.kind === 'village' && kind === 'village' ? far : 1100))) return;
      let x = c.x, z = c.z, ti = -1, q = -1;
      const wp = wayPt(x, z, kind === 'village' ? 230 : 110);
      if (wp) { // on the way: the houses line it
        const t = ways[wp.ti]; let ok = false;
        for (const dq of [0, 8, -8, 16, -16, 26, -26, 40, -40]) { const qq = wp.q + dq; if (qq < 12 || qq > t.length - 12) continue; const [px, pz] = t[qq]; if (okSpot(px, pz)) { x = px; z = pz; ti = tiOf(t); q = qq; ok = true; break; } }
        if (!ok) return;
      } else if (!okSpot(x, z)) return;
      if (list.some(o => Math.hypot(o.x - x, o.z - z) < (o.kind === 'village' && kind === 'village' ? far : 1050)) || cityOut(x, z) < 1150 || townOut(x, z) < 1150) return;
      const name = (() => { for (let t = 0; t < 30; t++) { const nm = rng.pick(SETTLE_NAMES[0]) + rng.pick(SETTLE_NAMES[1]); if (!used.has(nm)) { used.add(nm); return nm; } } return 'Newton'; })();
      list.push({ kind, x, z, ti, q, name, id: (kind === 'village' ? 'v' : 'h') + Math.round(x) + '_' + Math.round(z), score: c.s });
    };
    for (const c of cand) if (cityOut(c.x, c.z) > 1700 && townOut(c.x, c.z) > 1600) place(c, 'village');
    const sMin = cand.length ? cand[Math.floor(cand.length * 0.6)].s : 0;
    for (const c of cand) if (c.s > sMin) place(c, 'hamlet');
    prof.push(['use', performance.now()]);
    /* ---- the houses of each place: along its way, a green with a well; a village has its chapel ---- */
    prof.push(['places', performance.now()]);
    /* ---- the lanes: on the 50 m grid, easy grades, round the wide rivers, joining the first way they meet ---- */
    const WAY = new Uint8Array(n); const markWay = t => { for (let q = 0; q < t.length; q += 4) { const k = cellOf(t[q][0], t[q][1]); if (k >= 0) WAY[k] = 1; } };
    W.tracks.forEach(markWay);
    const lanes = [], HC = new Set(), RT = { n: 0, dist: new Float64Array(n), prev: new Int32Array(n), seen: new Int32Array(n) };
    // where a lane meets the way: the nearest point it can reach without passing through a house
    const clearLine = (ax, az, bx, bz) => { const L = Math.hypot(bx - ax, bz - az), hs = this.houseHash.query(Math.min(ax, bx) - 12, Math.min(az, bz) - 12, Math.max(ax, bx) + 12, Math.max(az, bz) + 12).map(h => h.o).concat(this.builds.map(b => b.o));
      for (let t = 0; t <= L; t += 3) { const x = lerp(ax, bx, t / (L || 1)), z = lerp(az, bz, t / (L || 1)); if (hs.some(o => circleObb(x, z, 5, o))) return false; } return true; };
    const joinPt = (px, pz, ex, ez) => { const c = []; for (const s of wayHash.query(ex - 150, ez - 150, ex + 150, ez + 150)) for (const f of [0, 0.5, 1]) { const x = lerp(s[0], s[2], f), z = lerp(s[1], s[3], f); c.push([Math.hypot(x - ex, z - ez), x, z]); }
      const q0 = wayNear(ex, ez, 150); if (q0) c.push([q0.d, q0.x, q0.z]); c.sort((a, b) => a[0] - b[0]);
      for (const [, x, z] of c) if (clearLine(px, pz, x, z)) return [x, z]; return null; };
    const route = (from, to, seed, BX = 16) => {
      const s = cellOf(from[0], from[1]), g = to ? cellOf(to[0], to[1]) : -1; if (s < 0) return null;
      const si = s % NI, sj = (s - si) / NI, gi = g >= 0 ? g % NI : 0, gj = g >= 0 ? (g - gi) / NI : 0, B = BX; // a box round the two ends
      const i0 = Math.max(0, Math.min(si, g >= 0 ? gi : si) - B), i1 = Math.min(NI - 1, Math.max(si, g >= 0 ? gi : si) + B), j0 = Math.max(0, Math.min(sj, g >= 0 ? gj : sj) - B), j1 = Math.min(NJ - 1, Math.max(sj, g >= 0 ? gj : sj) + B);
      const stamp = ++RT.n, dist = RT.dist, prev = RT.prev, seen = RT.seen, h2 = new _Heap(); seen[s] = stamp; dist[s] = 0; prev[s] = -1; h2.push(0, s); let end = -1, it = 0;
      while (h2.size && it++ < 60000) { const k = h2.pop(), d = dist[k], i = k % NI, j = (k - i) / NI;
        if (k === g || (WAY[k] && Math.hypot(i - si, j - sj) > 1.6)) { end = k; break; }
        for (let e = 0; e < 8; e++) { const a = i + DI[e], b = j + DJ[e]; if (a < i0 || b < j0 || a > i1 || b > j1) continue; const q = b * NI + a; if (H[q] < SEA + 0.5 || EX[q] === 2) continue;
          const len = e < 4 ? C : C * 1.4142, gr = Math.abs(H[q] - H[k]) / len, c = len * (1 + (gr / 0.08) ** 2 + (WR[q] ? 25 : 0) + (SD[q] < 30 ? 0.6 : 0) + (EX[q] ? 4 : 0) + (HC.has(q) ? 6 : 0) + 0.3 * _h2(a, b, seed)) - (WAY[q] ? len * 0.3 : 0);
          const nd = d + c; if (seen[q] !== stamp || nd < dist[q]) { seen[q] = stamp; dist[q] = nd; prev[q] = k; h2.push(nd + (g >= 0 ? Math.hypot(a - gi, b - gj) * C * 0.95 : 0), q); } } }
      if (end < 0) return null;
      const cells = []; for (let k = end; k >= 0; k = prev[k]) cells.push(k); cells.reverse();
      const pts = [from.slice(), ...cells.slice(1, -1).map(k => { const i = k % NI; return [cx(i), cz((k - i) / NI)]; })];
      const [ex, ez] = (() => { const k = cells[cells.length - 1], i = k % NI; return [cx(i), cz((k - i) / NI)]; })();
      if (end === g) pts.push(to.slice()); else { const p = pts[pts.length - 1], j = joinPt(p[0], p[1], ex, ez); pts.push(j || [ex, ez]); }
      return pts;
    };
    const addLane = (pts, spur) => {
      let out = spur ? resampleEven(pts, 3) : resampleEven(smoothPath(simplifyPath(pts, 6), 3), 3); if (out.length < 3) return null;
      if (!spur) { const L = out.length, sd = _h2(out.length, Math.round(out[0][0]), 7320 + WSEED) * 100;
        out = out.map((p, q) => { const a = out[Math.max(0, q - 2)], b = out[Math.min(L - 1, q + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.min(1, q * 3 / 30, (L - 1 - q) * 3 / 30), off = 4 * k * fbm(q * 3 / 90 + sd, 2.2, 2, 384); return [p[0] - (b[1] - a[1]) / l * off, p[1] + (b[0] - a[0]) / l * off]; }); }
      out.lane = true; out.joined = true; if (spur) out.spur = true; lanes.push(out); markWay(out); addWay(out, W.tracks.length + lanes.length - 1); return out;
    };
    // a place off the way gets its lane first: its houses stand along it
    // (the nearest first, so a lane from further off can join one laid before it: the lanes grow out from the tracks into the country)
    { const todo = list.filter(S => S.ti < 0);
      for (const S of todo) { S.w = null; for (const r of [600, 1500, 4000]) { const w = wayNear(S.x, S.z, r); if (w) { S.w = w; break; } } }
      while (todo.length) { let bi = -1, bd = 1e9; todo.forEach((S, q) => { if (S.w && S.w.d < bd) { bd = S.w.d; bi = q; } }); if (bi < 0) { for (const S of todo) S.dead = true; break; }
        const S = todo.splice(bi, 1)[0], bw = S.w; delete S.w;
        const r = route([S.x, S.z], [bw.x, bw.z], 7330 + list.indexOf(S), Math.ceil(bd / C) + 10), L = r && addLane(r);
        if (L) { S.ti = W.tracks.length + lanes.indexOf(L); S.own = L; { const want = Math.min(L.length - 3, 2 + Math.round((S.kind === 'village' ? 5 : 3.5) * 7)); S.q = 2; for (let d = 0; d < L.length; d++) { const q = want + (d % 2 ? -1 : 1) * Math.ceil(d / 2); if (q < 2 || q > L.length - 3) continue; if (!riverNear(L[q][0], L[q][1], 30)) { S.q = q; break; } } } // (its middle on dry ground)
          for (const o of todo) for (let q = 0; q < L.length; q += 3) { const d = Math.hypot(L[q][0] - o.x, L[q][1] - o.z); if (!o.w || d < o.w.d) o.w = { d, x: L[q][0], z: L[q][1] }; } } else S.dead = true; } // (a lane laid is a way the others may join)
      for (let q = list.length - 1; q >= 0; q--) if (list[q].dead) list.splice(q, 1); }
    prof.push(['placeLanes', performance.now()]);
    /* ---- each place's territory: the land nearer to it than to any other, in walking effort ---- */
    const owners = [...list];
    owners.push({ kind: 'city', x: 0, z: 0 }); for (const Tn of TOWNS) owners.push({ kind: 'town', x: Tn.x, z: Tn.z, town: Tn });
    const D = new Float32Array(n).fill(Infinity), OWN = new Int16Array(n).fill(-1), hp = new _Heap();
    const src = (k, o) => { if (k < 0 || H[k] < SEA) return; D[k] = 0; OWN[k] = o; hp.push(0, k); };
    owners.forEach((o, oi) => {
      if (o.kind === 'city') { for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const d = Math.max(Math.abs(cx(i)), Math.abs(cz(j))) - TG.R; if (d >= 0 && d < 60) src(j * NI + i, oi); } }
      else if (o.kind === 'town') { const Tn = o.town, b = Tn.cfg.moat.off + Tn.cfg.moat.w + 40; for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) { const x = cx(i), z = cz(j); if (Math.abs(x - Tn.x) > 3000 || Math.abs(z - Tn.z) > 3000) continue; const d = Tn.rectOut(x, z) - b; if (d >= 0 && d < 60) src(j * NI + i, oi); } }
      else src(cellOf(o.x, o.z), oi);
    });
    const stepCost = (k, q, len) => { const g = Math.abs(H[q] - H[k]) / len; return len * (1 + (g / 0.1) ** 2 + (EX[q] === 1 ? 3 : 0) + (WR[q] ? 5 : 0)); };
    while (hp.size) { const k = hp.pop(), d = D[k]; if (d > 3600) continue; const i = k % NI, j = (k - i) / NI;
      for (let e = 0; e < 8; e++) { const a = i + DI[e], b = j + DJ[e]; if (a < 0 || b < 0 || a >= NI || b >= NJ) continue; const q = b * NI + a; if (H[q] < SEA) continue;
        const nd = d + stepCost(k, q, e < 4 ? C : C * 1.4142); if (nd < D[q]) { D[q] = nd; OWN[q] = OWN[k]; hp.push(nd, q); } } }
    prof.push(['terr', performance.now()]);
    /* ---- what the land is used for: 2 ploughed, 1 grazed, 0 left wild ---- */
    let USE = new Uint8Array(n);
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const k = j * NI + i; if (EX[k] || OWN[k] < 0) continue; const o = owners[OWN[k]], [Rf, Rp] = SETTLE_R[o.kind], x = cx(i), z = cz(j);
      const nz = 0.22 * fbm(x / 450, z / 450, 2, 7310 + WSEED), d1 = D[k] / Rf + nz, d2 = D[k] / Rp + nz;
      if (d1 < 1 && AR[k] > 0.3 + 0.5 * ss(0.5, 1, d1)) USE[k] = 2; else if (d2 < 1 && PA[k] > 0.3 + 0.45 * ss(0.55, 1, d2)) USE[k] = 1;
    }
    { const U2 = USE.slice(); for (let j = 1; j < NJ - 1; j++) for (let i = 1; i < NI - 1; i++) { const k = j * NI + i; let f = 0, a = 0; for (let e = 0; e < 8; e++) { const u = USE[k + DJ[e] * NI + DI[e]]; if (u) { f++; if (u === 2) a++; } }
      if (USE[k] && f < 2) U2[k] = 0; else if (!USE[k] && !EX[k] && OWN[k] >= 0 && f >= 6) U2[k] = a >= 4 ? 2 : 1; } USE = U2; } // no lone patches, no holes
    const UF = new Float32Array(n); for (let k = 0; k < n; k++) UF[k] = USE[k] === 2 ? 1 : USE[k] === 1 ? 0.62 : 0;
    Object.assign(this, { C, X0, Z0, NI, NJ, USE, UF, OWN, D, owners, list });
    const trackPts = ti => ti < W.tracks.length ? W.tracks[ti] : lanes[ti - W.tracks.length];
    for (const S of list) {
      const t = S.own || trackPts(S.ti); if (!t) continue; if (S.own) { S.x = t[S.q][0]; S.z = t[S.q][1]; }
      const r = new RNG(Math.floor(_h2(Math.round(S.x), Math.round(S.z), 7340 + WSEED) * 2147483647)), vil = S.kind === 'village', nH = vil ? r.int(9, 13) : r.int(3, 5), pitch = vil ? 5.5 : 7;
      const frame = q => { const a = t[Math.max(0, q - 1)], b = t[Math.min(t.length - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
      const [ux, uz] = frame(S.q), gs = r.chance(0.5) ? 1 : -1; // the green lies to one side of the way
      S.houses = []; S.green = vil ? [S.x - uz * gs * 30, S.z + ux * gs * 30, 15] : null; S.well = vil ? [S.green[0], S.green[1]] : [S.x - uz * 7, S.z + ux * 7];
      const okHouse = o => !riverNear(o.x, o.z, 22) && terrainRaw(o.x, o.z) > SEA + 2 && !wayNear(o.x, o.z, 9, S.ti) && !siteZone(o.x, o.z, 20) && townCore(o.x, o.z) === 0 && !S.houses.some(h => obbOverlap(h.o, o, 1.5)) && !(S.green && circleObb(S.green[0], S.green[1], S.green[2], o));
      for (let m = 0; m < nH; m++) {
        const qq = clamp(S.q + Math.round((m - (nH - 1) / 2) * pitch + r.range(-1, 1)), 1, t.length - 2), sd = m % 2 ? 1 : -1, [px, pz] = t[qq], [fx, fz] = frame(qq), nx = -fz * sd, nz = fx * sd, off = r.range(11, 15);
        const hx = px + nx * off, hz = pz + nz * off, ang = Math.atan2(-nx, -nz), o = mkObb(hx, hz, ang, 6, 5), h = { x: hx, z: hz, ang, seed: r.int(1, 1e9), o };
        if (okHouse(o)) S.houses.push(h);
      }
      if (vil) { // round the green: a few more houses facing it, and the chapel at its far side
        const [gx, gz, gr] = S.green, nx = -uz * gs, nz = ux * gs; // (out from the way, across the green)
        const ch = { kind: 'chapel', x: gx + nx * (gr + 9), z: gz + nz * (gr + 9), ang: Math.atan2(-nx, -nz), seed: r.int(1, 1e9) }; ch.o = mkObb(ch.x, ch.z, ch.ang, 8.5, 6);
        if (okHouse(ch.o) && flatAt(ch.x, ch.z, 4, 3.5)) { this.builds.push(ch); S.chapel = ch; }
        for (const a of [-1.15, 1.15, -0.55, 0.55]) { const ca = Math.cos(a), sa = Math.sin(a), dx = nx * ca - nz * sa, dz = nx * sa + nz * ca, hx = gx + dx * (gr + 10), hz = gz + dz * (gr + 10), ang = Math.atan2(-dx, -dz), o = mkObb(hx, hz, ang, 6, 5);
          if (!(S.chapel && obbOverlap(o, S.chapel.o, 2)) && okHouse(o)) S.houses.push({ x: hx, z: hz, ang, seed: r.int(1, 1e9), o }); }
      }
      for (const h of S.houses) { this.houseHash.add(h, obbAabb(h.o)); HC.add(cellOf(h.x, h.z)); } if (S.chapel) HC.add(cellOf(S.chapel.x, S.chapel.z));
    }
    prof.push(['houses', performance.now()]);
    /* ---- the farmsteads: within each territory, on good dry ground, a few hundred metres apart; each joined by a lane ---- */
    const farms = [], cap = { village: 8, hamlet: 3, city: 40, town: 24 }, cnt = new Map(), farmHash = new SHash(200);
    const farmOk = (x, z, oi) => {
      if (farmHash.query(x - 280, z - 280, x + 280, z + 280).some(f => Math.hypot(f.x - x, f.z - z) < 270)) return false;
      if (list.some(S => Math.hypot(S.x - x, S.z - z) < (owners.indexOf(S) === oi ? (S.kind === 'village' ? 190 : 150) : 200))) return false;
      if (cityOut(x, z) < 60 || townCore(x, z) > 0 || siteWild(x, z) > 0 || siteZone(x, z, 60) || W.handFD(x, z) < 45 || W.trackD(x, z) < 26 || riverNear(x, z, 45)) return false;
      if (W.handHash.query(x - 30, z - 30, x + 30, z + 30).some(o => circleObb(x, z, 26, o)) || this.houseHash.query(x - 40, z - 40, x + 40, z + 40).length) return false;
      return flatAt(x, z, 7, 6);
    };
    for (const f of W.endFarms) { const k = cellOf(f.x, f.z), F = { x: f.x, z: f.z, ang: f.ang, end: true, owner: k >= 0 ? OWN[k] : -1 }; farms.push(F); farmHash.add(F, [f.x, f.z, f.x, f.z]); }
    { const order = []; for (let k = 0; k < n; k++) if (USE[k] && OWN[k] >= 0) { const i = k % NI, j = (k - i) / NI, td = W.trackD(cx(i), cz(j)); order.push([_h2(i, j, 7350 + WSEED) - (td > 30 && td < 170 ? 0.45 : 0), k]); } // (those beside a way first: walking it, you pass them) order.sort((a, b) => a[0] - b[0]);
      for (const [hv, k] of order) {
        const oi = OWN[k], o = owners[oi]; if ((cnt.get(oi) || 0) >= cap[o.kind] || (AR[k] < 0.45 && PA[k] < 0.6)) continue;
        const i = k % NI, j = (k - i) / NI; let x = cx(i) + (_h2(i, j, 7351) - 0.5) * C * 0.8, z = cz(j) + (_h2(i, j, 7352) - 0.5) * C * 0.8;
        const ci = W.ci(x), cj = W.ci(z), x0 = -TG.R + ci * WC, z0 = -TG.R + cj * WC; x = clamp(x, x0 + 34, x0 + WC - 34); z = clamp(z, z0 + 34, z0 + WC - 34); // well inside one chunk, which builds it
        if (!farmOk(x, z, oi)) continue;
        const F = { x, z, owner: oi, d: D[k] }; farms.push(F); farmHash.add(F, [x, z, x, z]); cnt.set(oi, (cnt.get(oi) || 0) + 1);
      } }
    prof.push(['farms', performance.now()]);
    // their lanes, nearest the village first, so the later ones join them
    for (const F of farms.filter(F => !F.end).sort((a, b) => a.d - b.d)) {
      const o = owners[F.owner], w = wayNear(F.x, F.z, 170), home = o && (o.kind === 'village' || o.kind === 'hamlet') ? [o.x, o.z] : null;
      let tx, tz; if (w) { tx = w.x; tz = w.z; } else if (home) { tx = home[0]; tz = home[1]; } else { const w2 = wayNear(F.x, F.z, 1500); if (!w2) { tx = F.x; tz = F.z + 1; } else { tx = w2.x; tz = w2.z; } }
      const dl = Math.hypot(tx - F.x, tz - F.z) || 1; F.ang = Math.atan2(-(tx - F.x) / dl, -(tz - F.z) / dl) + Math.PI; // its front to the way
      const FX = makeXf(F.x, F.z, F.ang), gate = xfP(FX, 0, 12);
      if (w) { const j = joinPt(gate[0], gate[1], gate[0], gate[1]); F.lane = j && Math.hypot(j[0] - gate[0], j[1] - gate[1]) < 200 ? addLane([gate, j], true) : null; }
      else { const r = route(gate, home, 7360 + farms.indexOf(F)); F.lane = r ? addLane(r) : null; }
    }
    prof.push(['farmLanes', performance.now()]);
    const kept = farms.filter(F => F.end || F.lane); this.farmHash = new SHash(200);
    for (const F of kept) { F.o = mkObb(F.x, F.z, F.ang, 16, 15); this.farmHash.add(F, [F.x, F.z, F.x, F.z]); }
    this.farms = kept; this.lanes = lanes;
    W.addLanes(lanes);
    prof.push(['addLanes', performance.now()]);
    /* ---- the field systems: seeds of furlong lattices over the farmland, each turned to a lane, the contour or the city's fields ---- */
    const seeds = [], seedHash = new SHash(300); let sid = 0;
    { const order = []; for (let k = 0; k < n; k++) if (USE[k]) order.push([_h2(k % NI, Math.floor(k / NI), 7370 + WSEED), k]); order.sort((a, b) => a[0] - b[0]);
      for (const [, k] of order) { const i = k % NI, j = (k - i) / NI, x = cx(i) + (_h2(i, j, 7371) - 0.5) * C, z = cz(j) + (_h2(i, j, 7372) - 0.5) * C;
        if (seedHash.query(x - 300, z - 300, x + 300, z + 300).some(s => Math.hypot(s.x - x, s.z - z) < 290)) continue;
        const fd = W.handFD(x, z), ha = fd < 340 ? W.handAng(x, z) : NaN; let ang;
        if (ha === ha) ang = ha + (_h2(i, j, 7373) - 0.5) * 0.08;
        else { const w = wayNear(x, z, 150), a = Math.max(0, i - 2), b = Math.min(NI - 1, i + 2), c2 = Math.max(0, j - 2), d2 = Math.min(NJ - 1, j + 2), gx = (H[j * NI + b] - H[j * NI + a]) / ((b - a) * C), gz = (H[d2 * NI + i] - H[c2 * NI + i]) / ((d2 - c2) * C);
          if (w && _h2(i, j, 7374) < 0.75) ang = w.ang + (_h2(i, j, 7375) < 0.6 ? Math.PI / 2 : 0); // the strips run off the lane, or along it
          else if (Math.hypot(gx, gz) > 0.03) ang = Math.atan2(gz, -gx);                          // along the contour
          else ang = 1.6 * fbm(x / 1400, z / 1400, 1, 368); }
        const S = { id: sid++, x, z, ang, owner: OWN[k], grow: smoothstep(120, 900, fd) }; seeds.push(S); seedHash.add(S, [x, z, x, z]); } }
    this.seeds = seeds; this.seedHash = seedHash;
    prof.push(['seeds', performance.now()]);
    // the lattice: columns of blocks (each a few strips wide) side by side, the blocks of a column end to end, the columns staggered
    const blocks = [], blockHash = new SHash(64), RS = 440;
    for (const S of seeds) {
      const ca = Math.cos(S.ang), sa = Math.sin(S.ang); let u = -RS - _h2(S.id, 0, 7380) * 30, col = 0;
      while (u < RS) {
        const nS = 3 + Math.floor(_h2(S.id, col, 7381) * 5), pw = 14 + 8 * _h2(S.id, col, 7382), wc = nS * (pw + 2.4), uc = u + (wc - 2.4) / 2;
        let v = -RS - _h2(S.id, col, 7383) * 80, row = 0;
        while (v < RS) {
          const pl = 48 + 34 * _h2(S.id * 131 + col, row, 7384), vc = v + pl / 2, x = S.x + uc * ca + vc * sa, z = S.z - uc * sa + vc * ca; v += pl + 2.4; row++;
          if (this.seedAt(x, z) !== S) continue;
          const o = mkObb(x, z, S.ang, (wc - 2.4) / 2, pl / 2); let good = this.ufAt(x, z) > 0.3 ? 1 : 0; for (const [px, pz] of obbCorners(o)) if (this.ufAt(px, pz) > 0.3) good++; if (good < 3) continue;
          const k = cellOf(x, z); if (k < 0 || OWN[k] < 0) continue; const past = USE[k] !== 2, ow = owners[OWN[k]], Rp = SETTLE_R[ow.kind][1];
          if (past && _h2(S.id * 977 + col, row, 7385) < 0.55 * ss(0.72, 1.02, D[k] / Rp + 0.22 * fbm(x / 450, z / 450, 2, 7310 + WSEED))) continue; // the pasture thins out at the edge of the territory
          let nn = nS, pw2 = pw; if (past) { nn = Math.max(1, Math.round(wc / (32 + 12 * _h2(S.id, col, 7386)))); pw2 = wc / nn - 2.4; } // hedged pasture: fewer, wider closes
          Object.assign(o, { id: blocks.length, n: nn, pw: pw2, past, seed: S, owner: OWN[k], grow: S.grow, open: !past && S.grow > 0.35 && _h2(S.id, col * 31 + row, 7387) < 0.45, wall: past && H[k] > 70 });
          blocks.push(o); blockHash.add(o, obbAabb(o));
        }
        u += wc; col++;
      }
    }
    this.blocks = blocks; this.blockHash = blockHash; this.stripCache = new Map();
    prof.push(['blocks', performance.now()]);
    // how farmed each place is, from the blocks themselves (25 m), with the commons round each village
    { const C2 = 25, X1 = WORLD.x0 - 400, Z1 = WORLD.z0 - 400, N2 = Math.ceil((WORLD.x1 - WORLD.x0 + 800) / C2) + 1, M2 = Math.ceil((WORLD.z1 - WORLD.z0 + 800) / C2) + 1, CU = new Float32Array(N2 * M2);
      for (const o of blocks) { const [a0, b0, a1, b1] = obbAabb(o), v = o.past ? 0.72 : 0.92;
        for (let j = Math.max(0, Math.floor((b0 - 32 - Z1) / C2)); j <= Math.min(M2 - 1, Math.ceil((b1 + 32 - Z1) / C2)); j++) for (let i = Math.max(0, Math.floor((a0 - 32 - X1) / C2)); i <= Math.min(N2 - 1, Math.ceil((a1 + 32 - X1) / C2)); i++) {
          const d = padDist({ o }, X1 + i * C2, Z1 + j * C2), c = v * (1 - ss(4, 30, d)); if (c > CU[j * N2 + i]) CU[j * N2 + i] = c; } }
      for (const S of list) { const R = S.kind === 'village' ? 260 : 150; for (let j = Math.max(0, Math.floor((S.z - R - Z1) / C2)); j <= Math.min(M2 - 1, Math.ceil((S.z + R - Z1) / C2)); j++) for (let i = Math.max(0, Math.floor((S.x - R - X1) / C2)); i <= Math.min(N2 - 1, Math.ceil((S.x + R - X1) / C2)); i++) {
        const c = 0.55 * (1 - ss(R * 0.4, R, Math.hypot(X1 + i * C2 - S.x, Z1 + j * C2 - S.z))); if (c > CU[j * N2 + i]) CU[j * N2 + i] = c; } } // the green, the crofts and the commons round the houses
      this.cu = { C: C2, X0: X1, Z0: Z1, NI: N2, NJ: M2, CU }; }
    prof.push(['cult', performance.now()]); this.prof = prof.slice(1).map(([k, t], q) => k + ':' + Math.round(t - prof[q][1])).join(' '); this.ready = true; this.ms = Math.round(performance.now() - t0);
  },
  // the nearest seed of a field system (the lattice a place belongs to)
  seedAt(x, z) { let best = null, bd = 1e9; for (const s of this.seedHash.query(x - 600, z - 600, x + 600, z + 600)) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } } return best; },
  seedAt2(x, z) { let a = null, b = null, da = 1e18, db = 1e18; for (const s of this.seedHash.query(x - 600, z - 600, x + 600, z + 600)) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < da) { b = a; db = da; a = s; da = d; } else if (d < db) { b = s; db = d; } } return [a, Math.sqrt(da), Math.sqrt(db)]; },
  // how farmed the land is here by the plan (0 wild, 0.62 pasture, 1 ploughed), smoothly
  ufAt(x, z) { const T = this; if (!T.UF) return 0; const fx = clamp((x - T.X0) / T.C, 0, T.NI - 1.001), fz = clamp((z - T.Z0) / T.C, 0, T.NJ - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * T.NI + i, U = T.UF, N = T.NI; return (U[k] * (1 - u) + U[k + 1] * u) * (1 - v) + (U[k + N] * (1 - u) + U[k + N + 1] * u) * v; },
  cultAt(x, z) { const T = this.cu; if (!T) return 0; const fx = (x - T.X0) / T.C, fz = (z - T.Z0) / T.C, i = Math.floor(fx), j = Math.floor(fz); if (i < 0 || j < 0 || i >= T.NI - 1 || j >= T.NJ - 1) return 0; const u = fx - i, v = fz - j, k = j * T.NI + i, U = T.CU, N = T.NI; return (U[k] * (1 - u) + U[k + 1] * u) * (1 - v) + (U[k + N] * (1 - u) + U[k + N + 1] * u) * v; },
  // the block (furlong) at a place, if any
  blockAt(x, z) { if (!this.blockHash) return null; for (const o of this.blockHash.query(x, z, x, z)) { const [lx, lz] = oLocal(o, x, z); if (Math.abs(lx) <= o.hx && Math.abs(lz) <= o.hz) return o; } return null; },
  blocksIn(x0, z0, x1, z1) { return this.blockHash ? this.blockHash.query(x0, z0, x1, z1) : []; },
  farmsIn(x0, z0, x1, z1) { return this.farmHash ? this.farmHash.query(x0, z0, x1, z1).filter(f => f.x >= x0 && f.x < x1 && f.z >= z0 && f.z < z1) : []; },
  housesIn(x0, z0, x1, z1) { return this.houseHash ? this.houseHash.query(x0, z0, x1, z1) : []; },
  near(x, z, r) { return this.list.some(S => Math.hypot(S.x - x, S.z - z) < r + (S.kind === 'village' ? 140 : 70)) || (this.farmHash && this.farmHash.query(x - r - 30, z - r - 30, x + r + 30, z + r + 30).some(f => Math.hypot(f.x - x, f.z - z) < r + 30)); },
  // the crop of a strip of a block (the k-th across it): the same for the chunk and for the far ground
  cropOf(o, k) {
    if (o.past) return 'fMeadow';
    let q = _h2(o.id, k, 7400 + WSEED), key = 'fMeadow'; const mix = o.grow < 0.35 ? [['fMeadow', 0.42], ['fWheat', 0.36], ['fBarley', 0.22]] : FIELD_KEYS; for (const [kk, w] of mix) { if (q < w) { key = kk; break; } q -= w; }
    if (key === 'fGreens' && !this.farmHash.query(o.x - 120, o.z - 120, o.x + 120, o.z + 120).some(f => Math.hypot(f.x - o.x, f.z - o.z) < 120)) key = 'fPlowed'; // market greens only by a farmstead
    return key;
  },
  // the crop at a point of a block, for the far ground: per strip close to, one for the whole block further off
  cropAt(o, x, z, fine) { if (!fine) return this.cropOf(o, 0); const [lx] = oLocal(o, x, z), k = clamp(Math.floor((lx + o.hx + 1.2) / (o.pw + 2.4)), 0, o.n - 1); return this.cropOf(o, k); },
  // the strips of a block as laid on the ground: each runs the length of the block, broken where the land turns bad or a way, a stream,
  // a yard or a house is in the way, and ending where another field system takes over. The same whichever chunk asks.
  strips(o) {
    let out = this.stripCache.get(o.id); if (out) return out;
    out = []; const W = Wild, ss = smoothstep, S = o.seed, step = 4, NS = Math.max(2, Math.round(2 * o.hz / step)), dv = 2 * o.hz / NS;
    const [bx0, bz0, bx1, bz1] = obbAabb(o), m = 30, segs = [];
    for (const T of W.tracks) { if (T.box && (T.box[0] > bx1 + m || T.box[2] < bx0 - m || T.box[1] > bz1 + m || T.box[3] < bz0 - m)) continue; const c = T.lane ? 6 : 11;
      for (let q = 1; q < T.length; q++) { const [ax, az] = T[q - 1], [cx, cz] = T[q]; if (Math.max(ax, cx) < bx0 - m || Math.min(ax, cx) > bx1 + m || Math.max(az, cz) < bz0 - m || Math.min(az, cz) > bz1 + m) continue; segs.push([ax, az, cx, cz, c]); } }
    if (LAND.wh) { const WH = LAND.wh, CC = WH.C; for (let i = Math.floor((bx0 - m) / CC); i <= Math.floor((bx1 + m) / CC); i++) for (let j = Math.floor((bz0 - m) / CC); j <= Math.floor((bz1 + m) / CC); j++) { const l = WH.get((i + 4096) * 8192 + j + 4096); if (!l) continue;
      for (let q = 0; q < l.length; q += 2) { const R = LAND.rivers[l[q]], p = l[q + 1]; segs.push([...R.P[p - 1], ...R.P[p], R.w[p] / 2 + 18]); } } }
    const HF = W.handHash.query(bx0 - 10, bz0 - 10, bx1 + 10, bz1 + 10), FM = this.farmHash.query(bx0 - 40, bz0 - 40, bx1 + 40, bz1 + 40), HS = this.houseHash.query(bx0 - 20, bz0 - 20, bx1 + 20, bz1 + 20);
    const PO = POI.list.length ? POI.near((bx0 + bx1) / 2, (bz0 + bz1) / 2, Math.hypot(bx1 - bx0, bz1 - bz0) / 2 + 20).filter(p => p.kind !== 'hamlet' && p.kind !== 'village') : [], GR = this.list.filter(V => V.green && Math.abs(V.x - o.x) < 400 && Math.abs(V.z - o.z) < 400);
    const BU = this.builds.filter(b => Math.abs(b.x - o.x) < 300 && Math.abs(b.z - o.z) < 300), sited = siteZone(o.x, o.z, Math.max(o.hx, o.hz) + 40), towned = TOWNS.some(Tn => Math.abs(o.x - Tn.x) < 3200 && Math.abs(o.z - Tn.z) < 3200);
    const bad = (x, z) => {
      if (Math.max(Math.abs(x), Math.abs(z)) < TG.R + 8) return true;
      if (this.ufAt(x + 22 * fbm(x / 70, z / 70, 1, 7410), z + 22 * fbm(x / 70 + 5, z / 70, 1, 7411)) < 0.3) return true; // (the line drawn across the plan's grid with a ragged edge)
      const [s1, d1, d2] = this.seedAt2(x, z); if (s1 !== S || d2 - d1 < 5) return true;                                       // another field system's ground (a lane's width between them)
      if (sited && siteWild(x, z) > 0.05) return true; if (towned && townCore(x, z) > 0) return true;
      for (const s of segs) if (segDist(x, z, s[0], s[1], s[2], s[3]).d < s[4]) return true;
      for (const f of HF) if (circleObb(x, z, 4, f)) return true; for (const f of FM) if (circleObb(x, z, 9, f.o)) return true;
      for (const h of HS) if (circleObb(x, z, 8, h.o)) return true; for (const b of BU) if (circleObb(x, z, 10, b.o)) return true;
      for (const V of GR) if (Math.hypot(V.green[0] - x, V.green[1] - z) < V.green[2] + 8) return true;
      for (const p of PO) if (Math.hypot(p.x - x, p.z - z) < p.r + 12) return true;
      return false;
    };
    for (let k = 0; k < o.n; k++) {
      const lx = -o.hx + o.pw / 2 + k * (o.pw + 2.4), e = o.pw / 2 + 1.5, ok = [], hs = [];
      for (let s = 0; s <= NS; s++) { const lz = -o.hz + s * dv, [ax, az] = xfP(o, lx - e, lz), [mx, mz] = xfP(o, lx, lz), [bx, bz] = xfP(o, lx + e, lz);
        const ha = terrainRaw(ax, az), hb = terrainRaw(bx, bz); hs.push((ha + hb) / 2);
        ok.push(!(Math.min(ha, hb) < SEA + 1.5 || Math.abs(ha - hb) / (2 * e) > 0.24 || bad(ax, az) || bad(mx, mz) || bad(bx, bz))); }
      for (let s = 1; s <= NS; s++) if (Math.abs(hs[s] - hs[s - 1]) / dv > 0.24) ok[s] = false; // too steep along it
      let s0 = -1, seg = 0;
      for (let s = 0; s <= NS + 1; s++) {
        if (s <= NS && ok[s]) { if (s0 < 0) s0 = s; continue; }
        if (s0 >= 0) { const a = -o.hz + s0 * dv, b = -o.hz + (s - 1) * dv, len = b - a;
          if (len >= Math.max(2.2 * o.pw, 26)) { const [x, z] = xfP(o, lx, (a + b) / 2), f = mkObb(x, z, o.ang, o.pw / 2, len / 2); let sl = 0; for (let q = s0 + 1; q < s; q++) sl = Math.max(sl, Math.abs(hs[q] - hs[q - 1]) / dv);
            Object.assign(f, { id: o.id * 64 + k * 8 + Math.min(7, seg++), blk: o.id, k, grow: o.grow, key: sl > 0.14 ? 'fMeadow' : this.cropOf(o, k), nofill: o.past && sl > 0.19, past: o.past || sl > 0.14, wall: o.wall, open: o.open }); out.push(f); } }
        s0 = -1;
      }
    }
    if (out.length === 1 && !out[0].past) { out[0].key = 'fMeadow'; out[0].past = true; } // a strip left on its own is hedged pasture, not a lone crop field
    this.stripCache.set(o.id, out); if (this.stripCache.size > 3000) this.stripCache.delete(this.stripCache.keys().next().value);
    return out;
  },
};
