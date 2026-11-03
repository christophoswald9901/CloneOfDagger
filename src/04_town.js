/* =====================================================================
   Towns: a generator for walled towns on flat ground, driven by one
   config. The plan (walls, gates, canal, streets, blocks, lots, districts,
   landmarks) is laid out once at load as plain data; the buildings are
   built with the ground chunk they stand in, as the player comes near,
   and a cheap block silhouette stands for the whole town from afar.
   The first is Corrinvale, a planned lowland town in the north: a
   rectangular wall with square towers and a moat, a canal through the
   middle, a grid of streets, tall gable-fronted houses in rows, a
   cathedral, a belfry over the cloth hall, a citadel, a market hall.
   See CITIES.md for what Daggerfall and this town taught about cities.
   ===================================================================== */

// One config per town. Lengths in metres; u runs along the town's long axis, v across it (+v is south when ang is 0)
const TOWN_CFGS = [{
  id: 'corrinvale', name: 'Corrinvale', x: -2200, z: -13600, ang: 0.12, seed: 9101,
  A: 470, B: 380,              // half-length and half-width of the walled rectangle
  H0: 96,                      // the level of the plain it stands on
  rc: 1300, rb: 2400,          // the fixed ground: wholly within rc, blending out to rb
  wall: { h: 10.5, t: 3, towerEvery: 46, tower: 8.5, towerH: 17, gateW: 6 },
  moat: { off: 7, w: 20 },     // its inner edge off the wall's foot, its width
  canal: { v: -88, w: 14, quay: 6 },
  mainU: 0, mainV: 34,         // the two main streets, gate to gate
  ring: { off: 13, w: 7 },     // the street inside the wall
  street: { w: 8, main: 12, du: [62, 96], dv: [58, 82] },
  blurb: 'a walled town of canals and tall brick gables on the northern plain',
  districts: [ // checked in order; the first that claims a point names it
    { id: 'grand', name: 'the Grand Square', blurb: 'merchants’ houses with stepped gables round the belfry', wealth: 3 },
    { id: 'close', name: 'the Cathedral Close', blurb: 'quiet stone houses in the shadow of Saint Aurel’s spire', wealth: 2.2 },
    { id: 'citadel', name: 'the Citadel Ward', blurb: 'barracks, smithies and armourers under the citadel', wealth: 1.5 },
    { id: 'canal', name: 'the Canal Quarter', blurb: 'warehouses and guild halls along the water', wealth: 2.2 },
    { id: 'commons', name: 'the Commons', blurb: 'low cottages and gardens under the walls', wealth: 0.7 },
    { id: 'weavers', name: 'the Weavers’ Quarter', blurb: 'timber houses of the cloth trade, three storeys high', wealth: 1.3 },
  ],
}];

// how each quarter builds: plot frontage and depth, storeys, walls and roofs
const TK = {
  grand: { w: [7, 11], d: [14, 18], stories: [3, 3, 4], styles: ['brick', 'brick', 'stone'], roofs: ['roofSlate', 'roofBrown', 'roofRed'], step: 0.75, jetty: 0 },
  close: { w: [8, 12], d: [12, 16], stories: [2, 3], styles: ['stone', 'stoneLight', 'brick'], roofs: ['roofSlate'], step: 0.35, jetty: 0 },
  citadel: { w: [8, 12], d: [12, 16], stories: [2, 2, 3], styles: ['stone', 'brick', 'timber2'], roofs: ['roofSlate', 'roofBrown'], step: 0.15, jetty: 0.2 },
  canal: { w: [8, 13], d: [14, 20], stories: [3, 4], styles: ['brick', 'brick', 'timber2'], roofs: ['roofBrown', 'roofSlate', 'roofRed'], step: 0.55, jetty: 0.1, warehouse: 0.45 },
  suburb: { w: [6, 9], d: [9, 11], stories: [1, 2, 2], styles: ['brick', 'timber2', 'brick', 'plaster'], roofs: ['roofSlate', 'roofBrown', 'roofRed'], step: 0.3, jetty: 0.2 },
  commons: { w: [6, 9], d: [9, 12], stories: [1, 1, 2], styles: ['timber2', 'plaster', 'wood'], roofs: ['roofThatch', 'roofThatch', 'roofBrown'], step: 0, jetty: 0.1 },
  weavers: { w: [6, 9], d: [11, 15], stories: [2, 3, 3], styles: ['timber2', 'timber2', 'plaster', 'brick'], roofs: ['roofBrown', 'roofSlate', 'roofRed'], step: 0.2, jetty: 0.55 },
};

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
  // how far a point lies outside the walled rectangle (negative inside)
  rectOut(x, z) { const [u, v] = this.local(x, z), C = this.cfg; return Math.max(Math.abs(u) - C.A, Math.abs(v) - C.B); }
  inside(x, z, m = 0) { return this.rectOut(x, z) < m; }

  /* ---------------- the plan ---------------- */
  plan() {
    const C = this.cfg, rng = new RNG(C.seed), A = C.A, B = C.B;
    // the grid: lines of constant u (streets running across the town) and of constant v (running along it)
    const lines = (lo, hi, main, extra, d) => { const out = [{ p: lo, w: C.ring.w, ring: true }, { p: hi, w: C.ring.w, ring: true }, { p: main, w: C.street.main, main: true }, ...extra];
      const fill = (a, b) => { let p = a + rng.range(...d); while (p < b - d[0] * 0.75) { if (!out.some(l => Math.abs(l.p - p) < d[0] * 0.6)) out.push({ p, w: C.street.w }); p += rng.range(...d); } };
      const fixed = out.map(l => l.p).sort((x, y) => x - y); for (let k = 1; k < fixed.length; k++) fill(fixed[k - 1], fixed[k]);
      return out.sort((x, y) => x.p - y.p); };
    const R = C.ring.off;
    this.U = lines(-A + R, A - R, C.mainU, [], C.street.du);
    this.V = lines(-B + R, B - R, C.mainV, [{ p: C.canal.v, w: C.canal.w + 2 * C.canal.quay, canal: true }], C.street.dv);
    // not every cross street runs the whole way: some end at a T, so blocks differ in size
    const nV = this.V.length;
    for (const L of this.U) { if (L.ring || L.main) { L.a = 0; L.b = nV - 1; continue; } let a = 0, b = nV - 1; if (rng.chance(0.45)) a = rng.int(1, Math.max(1, nV - 3)); if (rng.chance(0.45)) b = rng.int(Math.min(nV - 2, a + 2), nV - 2); L.a = a; L.b = Math.min(nV - 1, Math.max(b, a + 2)); }
    // but no block grows too wide: where one would, the cross street between runs on through that row
    for (let r = 0; r < nV - 1; r++) for (let guard = 0; guard < 8; guard++) { const act = this.U.filter(L => L.a <= r && L.b >= r + 1); let worst = null;
      for (let k = 1; k < act.length; k++) if (act[k].p - act[k - 1].p > 165) { worst = [act[k - 1].p, act[k].p]; break; }
      if (!worst) break; const mid = (worst[0] + worst[1]) / 2, L = this.U.filter(L => L.p > worst[0] && L.p < worst[1]).sort((x, y) => Math.abs(x.p - mid) - Math.abs(y.p - mid))[0]; if (!L) break; L.a = Math.min(L.a, r); L.b = Math.max(L.b, r + 1); }
    // blocks: between consecutive v-lines, between consecutive u-lines that run through that row
    this.blocks = [];
    for (let r = 0; r < nV - 1; r++) {
      const act = this.U.filter(L => L.a <= r && L.b >= r + 1);
      for (let k = 0; k < act.length - 1; k++) {
        const L0 = act[k], L1 = act[k + 1], V0 = this.V[r], V1 = this.V[r + 1];
        this.blocks.push({ u0: L0.p + L0.w / 2, u1: L1.p - L1.w / 2, v0: V0.p + V0.w / 2, v1: V1.p - V1.w / 2, r, k, uc: (L0.p + L1.p) / 2, vc: (V0.p + V1.p) / 2, use: 'lots' });
      }
    }
    // the great places take whole blocks
    const nearest = (u, v, f = () => true) => this.blocks.filter(f).sort((a, b) => Math.hypot(a.uc - u, a.vc - v) - Math.hypot(b.uc - u, b.vc - v))[0];
    // which side of the main streets the great places take (a varied town flips them)
    const fu = C.flip && C.flip[0] ? -1 : 1, fv = C.flip && C.flip[1] ? -1 : 1; this.fu = fu; this.fv = fv; this.oneTower = !!(C.vary && rng.chance(0.4)); // a varied town may raise one great tower instead of two
    const sq = nearest(C.mainU + fu * 40, C.mainV + fv * 40, b => (fu > 0 ? b.u0 > C.mainU : b.u1 < C.mainU) && (fv > 0 ? b.v0 > C.mainV - 1 : b.v1 < C.mainV + 1) && Math.abs((b.v0 + b.v1) / 2 - C.canal.v) > 20); if (sq) { sq.use = 'square'; this.square = sq; }
    const hall = sq && nearest(sq.uc, sq.vc - fv * 60, b => (fv > 0 ? b.v1 < C.mainV + 1 : b.v0 > C.mainV - 1) && b !== sq && Math.abs(b.uc - sq.uc) < 60 && b.v1 - b.v0 > 20 && b.use === 'lots'); if (hall) { hall.use = 'hall'; this.hall = hall; }
    const side = C.canal.v < C.mainV ? -1 : 1; // the cathedral stands beyond the canal from the main street
    const cat = this.blocks.filter(b => b.use === 'lots' && (side < 0 ? b.v1 < C.canal.v : b.v0 > C.canal.v) && b.v1 - b.v0 > 46 && Math.hypot(b.uc + fu * A * 0.45, b.vc - (C.canal.v + side * B) / 2) < 300).sort((a, b) => (b.u1 - b.u0) * (b.v1 - b.v0) - (a.u1 - a.u0) * (a.v1 - a.v0))[0]; if (cat) { cat.use = 'cathedral'; this.cathedral = cat; const pv = this.blocks.find(b => b.r === cat.r && b.use === 'lots' && b.u0 > cat.u1 && b.u0 - cat.u1 < 16); if (pv) { pv.use = 'parvis'; this.parvis = pv; const pd = 32; if (pv.u1 - pv.u0 > pd + 30) { const rest = { ...pv, u0: pv.u0 + pd, use: 'lots' }; rest.uc = (rest.u0 + rest.u1) / 2; pv.u1 = pv.u0 + pd; pv.uc = pv.u0 + pd / 2; this.blocks.push(rest); } } } // the open square before its west front: only some 30 m deep, with houses facing it across, so the front fills the view
    const cit = nearest(fu * (A - 60), -fv * (B - 60), b => b.u1 - b.u0 > 50 && b.v1 - b.v0 > 45 && b.use === 'lots' && Math.max(b.u1 - b.u0, b.v1 - b.v0) < 1.7 * Math.min(b.u1 - b.u0, b.v1 - b.v0)); if (cit) { cit.use = 'citadel'; this.citadel = cit; }
    const mk = nearest(fu * A * 0.6, C.mainV + fv * 60, b => b.use === 'lots' && b.u1 - b.u0 > 45 && b.v1 - b.v0 > 40); if (mk) { mk.use = 'market'; this.market = mk; }
    const ch = nearest(-fu * A * 0.55, fv * B * 0.55, b => b.use === 'lots'); if (ch) { ch.chapel = true; }
    // districts: by what is near
    const dOf = (u, v) => {
      if (this.square && Math.hypot(u - this.square.uc, v - this.square.vc) < 170) return 'grand';
      if (this.cathedral && Math.hypot(u - this.cathedral.uc, v - this.cathedral.vc) < 160) return 'close';
      if (this.citadel && Math.hypot(u - this.citadel.uc, v - this.citadel.vc) < 170) return 'citadel';
      if (Math.abs(v - C.canal.v) < 50) return 'canal';
      if (Math.min(A - Math.abs(u), B - Math.abs(v)) < 75) return 'commons';
      return 'weavers';
    };
    this.districtAt = (x, z) => { const [u, v] = this.local(x, z); const id = dOf(u, v); return C.districts.find(d => d.id === id); };
    // lots: rows of narrow plots along each side of a block that faces a street, gable to the street; the rest is yards and gardens
    this.lots = [];
    for (const b of this.blocks) {
      if (b.use !== 'lots') continue;
      const kind = dOf(b.uc, b.vc), K = TK[kind], W = b.u1 - b.u0, Hh = b.v1 - b.v0;
      const d = rng.range(...K.d) * 0.88, yard = 10, dd = Math.max(7, Math.min(d, Hh / 2 - yard)), dw = Math.max(7, Math.min(d, W / 2 - yard)); if (Hh < 16) continue; // (a garden or yard is left behind every row)
      // along the u-running sides (whole length), then along the v-running sides between them
      const row = (ax, bx, fixedV, faceA, depth, alongU) => { let t = ax; while (t < bx - 3.5) { let w = rng.range(...K.w); if (bx - t - w < 4) w = bx - t; if (w < 3.5) break;
        const c = t + w / 2, lu = alongU ? c : fixedV, lv = alongU ? fixedV : c; this.lots.push({ u: lu, v: lv, a: faceA, w, d: depth, kind, seed: rng.int(1, 1e9), corner: t === ax || t + w >= bx - 0.01 }); t += w; } };
      row(b.u0, b.u1, b.v0 + dd / 2, Math.PI, dd, true);        // facing the street at v0 (towards -v)
      row(b.u0, b.u1, b.v1 - dd / 2, 0, dd, true);              // facing the street at v1 (towards +v)
      if (W > 2 * dw + 10 && Hh - 2 * dd > 8) {
        row(b.v0 + dd, b.v1 - dd, b.u0 + dw / 2, -Math.PI / 2, dw, false); // facing the street at u0 (towards -u)
        row(b.v0 + dd, b.v1 - dd, b.u1 - dw / 2, Math.PI / 2, dw, false);  // facing the street at u1 (towards +u)
      }
      b.yard = { u0: b.u0 + (W > 2 * dw + 10 ? dw : 0) + 1, u1: b.u1 - (W > 2 * dw + 10 ? dw : 0) - 1, v0: b.v0 + dd + 1, v1: b.v1 - dd - 1 };
    }
    // what each lot is: shops and inns where the trade is, warehouses on the canal, a chapel, the rest homes
    const pick = (types, want) => { for (const [type, n, f] of types) for (let k = 0; k < n; k++) { const c = this.lots.filter(l => !l.type && l.w >= 7 && f(l)); if (!c.length) continue; const l = c[rng.int(0, c.length - 1)]; l.type = type; } };
    const nearGate = l => Math.min(Math.hypot(l.u - C.mainU, Math.abs(l.v) - B), Math.hypot(Math.abs(l.u) - A, l.v - C.mainV)) < 140;
    pick([['tavern', 3, l => l.kind === 'grand' || l.kind === 'canal'], ['tavern', 4, nearGate], ['tavern', 2, l => l.kind === 'weavers' || l.kind === 'commons'],
      ['general', 3, l => l.kind === 'grand' || l.kind === 'weavers'], ['general', 2, nearGate], ['alchemist', 2, l => l.kind === 'close' || l.kind === 'grand'],
      ['weaponsmith', 2, l => l.kind === 'citadel'], ['armorer', 2, l => l.kind === 'citadel'], ['weaponsmith', 1, l => l.kind === 'weavers']]);
    for (const l of this.lots) if (!l.type) { const K = TK[l.kind], r2 = new RNG(l.seed); l.type = K.warehouse && Math.abs(l.v - C.canal.v) < C.canal.w / 2 + C.canal.quay + l.d + 2 && l.w >= 9 && r2.chance(K.warehouse) ? 'warehouse' : 'house'; }
    // the streets as segments (for paving, the walkers and the road network) and the gates
    const nodeKey = (u, v) => Math.round(u * 2) + ':' + Math.round(v * 2);
    this.nodes = []; const nmap = new Map(); const node = (u, v) => { const k = nodeKey(u, v); if (nmap.has(k)) return nmap.get(k); const [x, z] = this.w(u, v); const n = { u, v, x, z, n: [], w: [] }; nmap.set(k, this.nodes.length); this.nodes.push(n); return this.nodes.length - 1; };
    const link = (a, b, w) => { if (a === b || this.nodes[a].n.includes(b)) return; this.nodes[a].n.push(b); this.nodes[a].w.push(w); this.nodes[b].n.push(a); this.nodes[b].w.push(w); };
    this.streets = []; // {u0,v0,u1,v1,w,kind}
    for (const L of this.U) { const vs = this.V.slice(L.a, L.b + 1).map(V => V.p); for (let k = 1; k < vs.length; k++) { this.streets.push({ u0: L.p, v0: vs[k - 1], u1: L.p, v1: vs[k], w: L.w, main: !!L.main, ring: !!L.ring }); link(node(L.p, vs[k - 1]), node(L.p, vs[k]), L.w); } }
    for (const V of this.V) { const us = this.U.filter(L => L.a <= this.V.indexOf(V) && L.b >= this.V.indexOf(V)).map(L => L.p); for (let k = 1; k < us.length; k++) { this.streets.push({ u0: us[k - 1], v0: V.p, u1: us[k], v1: V.p, w: V.w, main: !!V.main, ring: !!V.ring, canal: !!V.canal }); link(node(us[k - 1], V.p), node(us[k], V.p), V.canal ? C.canal.quay : V.w); } }
    this.gates = [
      { id: 'south', name: 'the Bay Gate', u: C.mainU, v: B, nu: 0, nv: 1 }, { id: 'north', name: 'the Moor Gate', u: C.mainU, v: -B, nu: 0, nv: -1 },
      { id: 'east', name: 'the Sunrise Gate', u: A, v: C.mainV, nu: 1, nv: 0 }, { id: 'west', name: 'the Mill Gate', u: -A, v: C.mainV, nu: -1, nv: 0 },
    ];
    if (C.gates === 3) this.gates = this.gates.filter(g => g.id !== 'north');
    for (const g of this.gates) { const inner = node(g.u - g.nu * R, g.v - g.nv * R), outer = node(g.u + g.nu * (C.moat.off + C.moat.w + 10), g.v + g.nv * (C.moat.off + C.moat.w + 10)); link(inner, outer, 6); g.node = outer; [g.x, g.z] = this.w(g.u, g.v); [g.ox, g.oz] = this.w(g.u + g.nu * (C.moat.off + C.moat.w + 10), g.v + g.nv * (C.moat.off + C.moat.w + 10)); }
    // the suburbs: cottages along each road out of a gate, beyond the moat
    for (const g of this.gates) { const pu = -g.nv, pv = g.nu, start = C.moat.off + C.moat.w + 26;
      for (const s of [-1, 1]) { let t = start + rng.range(0, 6), first = true;
        while (t < start + 170) { const w = rng.range(7, 10), d = rng.range(9, 11), mid = t + w / 2, off = 4 + rng.range(1.5, 4) + d / 2, u = g.u + g.nu * mid + pu * s * off, v = g.v + g.nv * mid + pv * s * off;
          this.lots.push({ u, v, a: Math.atan2(-s * pu, -s * pv), w, d, kind: 'suburb', seed: rng.int(1, 1e9), corner: true, type: first && s > 0 ? 'tavern' : 'house', suburb: true }); first = false; t += w + rng.range(0, 2.5); } } }
    // landmarks, for the map and for finding
    const lm = (id, name, b, du = 0, dv = 0) => b && { id, name, u: b.uc + du, v: b.vc + dv };
    this.landmarks = [lm('square', 'the Grand Square', this.square), lm('belfry', 'the Belfry', this.hall, 0, (this.hall ? fv * ((this.hall.v1 - this.hall.v0) / 2 - 12) : 0)), lm('cathedral', 'the Cathedral of Saint Aurel', this.cathedral), lm('citadel', 'the Citadel', this.citadel), lm('market', 'the Market Hall', this.market)].filter(Boolean)
      .map(l => { [l.x, l.z] = this.w(l.u, l.v); return l; });
    for (const g of this.gates) this.landmarks.push({ id: g.id, name: g.name, u: g.u, v: g.v, x: g.x, z: g.z, gate: true });
    // windmills on the plain outside, by the west and north roads
    this.mills = [[-A - 150, C.mainV - 120], [-A - 230, C.mainV + 90], [C.mainU - 160, -B - 190], [C.mainU + 210, -B - 150], [C.mainU + 120, B + 260], [C.mainU - 140, B + 340]].map(([u, v], k) => { const [x, z] = this.w(u, v); return { u, v, x, z, a: 0.4 + k * 0.7 }; });
    // the hash of what stands where, for the chunks
    this.lotHash = new SHash(48);
    this.lots.forEach((l, i) => { l.idx = i; if (i && !l.suburb && Math.abs(this.lots[i - 1].a - l.a) < 0.01 && Math.hypot(this.lots[i - 1].u - l.u, this.lots[i - 1].v - l.v) < 14) l.prev = this.lots[i - 1]; });
    for (const l of this.lots) { const [x, z] = this.w(l.u, l.v); l.x = x; l.z = z; l.o = mkObb(x, z, this.cfg.ang + l.a, l.w / 2, l.d / 2); this.lotHash.add(l, obbAabb(l.o)); }
  }
  // the door of a lot: where makeBuilding will put it (doorT is fixed per lot so the plan knows it)
  doorOf(l) { const r = new RNG(l.seed + 7), dT = l.w < 8 ? 0.5 : r.range(0.3, 0.7), dt = clamp(l.w * dT, 1.5, l.w - 1.5); const [x, z] = xfP(l.o, -l.w / 2 + dt, l.d / 2 + 0.2); return { x, z, y: this.H0, nx: Math.sin(l.o.ang), nz: Math.cos(l.o.ang), dT }; }
  // the ground: dead flat inside, a moat round the walls, the canal through the middle and out through both walls
  waterAt(u, v) {
    const C = this.cfg, out = Math.max(Math.abs(u) - C.A, Math.abs(v) - C.B), M = C.moat;
    const moat = out > M.off && out < M.off + M.w, canal = Math.abs(v - C.canal.v) < C.canal.w / 2 && Math.abs(u) < C.A + M.off + M.w + 1;
    return moat || canal;
  }
  groundH(x, z) {
    const [u, v] = this.local(x, z), C = this.cfg, out = Math.max(Math.abs(u) - C.A, Math.abs(v) - C.B), M = C.moat;
    let h = this.H0 + (out > M.off + M.w + 20 ? 0.6 * fbm(x / 120, z / 120, 2, 9301) * smoothstep(M.off + M.w + 20, M.off + M.w + 120, out) : 0);
    const dm = Math.min(out - M.off, M.off + M.w - out); // inside the moat, its distance from the nearer bank
    if (dm > -2) h = Math.min(h, this.H0 - 2.8 * smoothstep(-2, 3, dm));
    const dc = C.canal.w / 2 - Math.abs(v - C.canal.v); if (dc > -0.5 && Math.abs(u) < C.A + M.off + M.w + 1) h = Math.min(h, this.H0 - 3 * smoothstep(-0.5, 1, dc)); // (the canal has walled quays: steep)
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
// the wall's course: pieces between towers along each side, gaps at the gates, arches where the canal passes under
// the cathedral's measure in its block: nave length, its middle, nave and aisle half-widths, the transept's reach
Town.prototype.cathDims = function (b) { const w = b.u1 - b.u0, h = b.v1 - b.v0, L = clamp(w - 34, 30, 70), nw = h > 52 ? 11 : 9, aw = h > 52 ? 7 : 4; return { L, cu: b.uc - 4, nw, aw, tr: Math.min(22, h / 2 - 2) }; };
// the wall a house is first given (the same draw townHouse makes), so its neighbour can choose another
Town.prototype.styleOf = function (l) { const r = new RNG(l.seed), K = TK[l.kind]; let st = r.pick(K.stories); if (l.type !== 'house' && l.type !== 'warehouse') st = Math.max(2, st); if (l.type === 'warehouse') st = Math.max(3, st); r.next(); return l.type === 'warehouse' ? r.pick(['brick', 'brick', 'timber2']) : r.pick(K.styles); };
Town.prototype.wallPieces = function () {
  if (this._wp) return this._wp; const C = this.cfg, A = C.A, B = C.B, W = C.wall, out = [], towers = [];
  const side = (ax, av, bx, bv, gates) => { const L = Math.hypot(bx - ax, bv - av), n = Math.max(1, Math.round(L / W.towerEvery));
    for (let k = 0; k < n; k++) { const t0 = k / n, t1 = (k + 1) / n; out.push({ u0: lerp(ax, bx, t0), v0: lerp(av, bv, t0), u1: lerp(ax, bx, t1), v1: lerp(av, bv, t1) }); if (k) towers.push({ u: lerp(ax, bx, t0), v: lerp(av, bv, t0) }); } };
  side(-A, -B, A, -B); side(A, -B, A, B); side(A, B, -A, B); side(-A, B, -A, -B);
  for (const [u, v] of [[-A, -B], [A, -B], [A, B], [-A, B]]) towers.push({ u, v, corner: true });
  const free = towers.filter(t => !this.gates.some(g => Math.hypot(g.u - t.u, g.v - t.v) < 16)); // (the gatehouse is the tower there)
  this._wp = { pieces: out, towers: free }; return this._wp;
};
// a gable-fronted town house in the current frame (gb.xf): front (+z) to the street, often with a stepped gable in brick
function townHouse(area, gb, rng, l, K, T) {
  const shop = l.type !== 'house' && l.type !== 'warehouse', wh = l.type === 'warehouse';
  let stories = rng.pick(K.stories); if (shop) stories = Math.max(2, stories); if (wh) stories = Math.max(3, stories);
  let style = wh ? rng.pick(['brick', 'brick', 'timber2']) : rng.pick(K.styles); if (style === l.prevStyle) style = ['brick', 'stone', 'plaster', 'timber2', 'stoneLight'].filter(s2 => s2 !== l.prevStyle && (K.styles.includes(s2) || s2 === 'plaster'))[rng.int(0, 2) % 2] || style; const timber = style.startsWith('timber');
  const roofKey = stories === 1 ? rng.pick(K.roofs) : rng.pick(K.roofs.filter(r => r !== 'roofThatch').concat(['roofSlate']));
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
    gb.box(-3, 30, -3, 3, 38, 3, { side: 'stone', top: 'stone' }, 3, 3); gb.xf = null; gb.box(kx - 0.1, y + 38, kz - 0.1, kx + 0.1, y + 42, kz + 0.1, 'woodDark', 1, 1);
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
  // paving: streets in pieces, the quays along the canal, the squares in tiles
  for (const s of this.streets) {
    const L = Math.hypot(s.u1 - s.u0, s.v1 - s.v0), np = Math.max(1, Math.ceil(L / 16));
    for (let k = 0; k < np; k++) { const f0 = k / np, f1 = (k + 1) / np, mu = lerp(s.u0, s.u1, (f0 + f1) / 2), mv = lerp(s.v0, s.v1, (f0 + f1) / 2), [mx, mz] = this.w(mu, mv); if (!inC(mx, mz)) continue;
      const a = this.w(lerp(s.u0, s.u1, f0), lerp(s.v0, s.v1, f0)), b = this.w(lerp(s.u0, s.u1, f1), lerp(s.v0, s.v1, f1));
      if (s.canal) { for (const sd of [-1, 1]) { const off = sd * (C.canal.w / 2 + C.canal.quay / 2), oa = this.w(lerp(s.u0, s.u1, f0), s.v0 + off), ob = this.w(lerp(s.u0, s.u1, f1), s.v0 + off); drapeStrip(gb, 'rFlag', [oa, ob], C.canal.quay, { lift: 0.06, hAt: () => H0 });
          const wa = this.w(lerp(s.u0, s.u1, f0), s.v0 + sd * C.canal.w / 2), wb = this.w(lerp(s.u0, s.u1, f1), s.v0 + sd * C.canal.w / 2), mx2 = (wa[0] + wb[0]) / 2, mz2 = (wa[1] + wb[1]) / 2, Lq = Math.hypot(wb[0] - wa[0], wb[1] - wa[1]);
          gb.setXf(mx2, mz2, ang + Math.PI / 2, H0); gb.box(-0.5, -3.2, -Lq / 2 - 0.05, 0.5, 0.08, Lq / 2 + 0.05, { side: 'stone', top: 'stoneLight' }, 2, 2); gb.xf = null; } continue; } // the quay walls
      drapeStrip(gb, s.main ? 'rFlag' : 'rCobble', [a, b], s.w, { lift: 0.06, hAt: () => H0 });
      // lamps along the main streets (their light is kept with the town)
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
  // boats moored along the quays, and a crane or two for the warehouses
  { const ci = C.canal, r2 = new RNG(8200);
    for (let u = -C.A + 20; u < C.A - 20; u += r2.range(22, 46)) { const sd = r2.chance(0.5) ? 1 : -1, v = ci.v + sd * (ci.w / 2 - 1.8), [bx2, bz2] = this.w(u, v); if (!inC(bx2, bz2) || this.U.some(L => Math.abs(L.p - u) < L.w / 2 + 6)) continue; const wl = this.wl();
      gb.setXf(bx2, bz2, C.ang + Math.PI / 2, wl); gb.box(-1.2, -0.4, -3.4, 1.2, 0.5, 3.4, { side: 'woodDark', top: 'wood' }, 1, 1);
      for (const sd of [-1, 1]) { gb.tri('woodDark', [-1.2, -0.4, sd * 3.4], [1.2, -0.4, sd * 3.4], [0, 0.9, sd * 5], [0, 0], [1, 0], [0.5, 1], [0, 0.3, sd]); gb.tri('woodDark', [-1.2, 0.5, sd * 3.4], [0, 0.9, sd * 5], [-1.2, -0.4, sd * 3.4], [0, 0], [1, 0], [0.5, 1], [-1, 0, 0]); gb.tri('woodDark', [1.2, 0.5, sd * 3.4], [1.2, -0.4, sd * 3.4], [0, 0.9, sd * 5], [0, 0], [1, 0], [0.5, 1], [1, 0, 0]); gb.tri('wood', [-1.2, 0.5, sd * 3.4], [1.2, 0.5, sd * 3.4], [0, 0.9, sd * 5], [0, 0], [1, 0], [0.5, 1], [0, 1, 0]); } // bow and stern
      for (const s of [-1, 1]) gb.box(s * 1.2 - 0.12, 0.5, -3.4, s * 1.2 + 0.12, 0.85, 3.4, 'wood', 1, 1); // the gunwales
      gb.box(-1.1, 0.42, -3.3, 1.1, 0.5, 3.3, 'woodDark', 1, 1); gb.box(-0.05, 0.5, -5.2, 0.05, 1.8, -4.9, 'woodDark', 1, 1); // the hold's floor, the tiller
      if (r2.chance(0.6)) { gb.box(-0.08, 0.5, -0.6, 0.08, 7, -0.4, 'woodDark', 1, 1); gb.box(-0.06, 2.0, -0.55, 0.06, 2.12, 2.2, 'woodDark', 1, 1); gb.quad('sail', [-0.05, 2.2, -0.45], [0, 0, 1], [0, 1, 0], 2.6, 4, 2, 2, { double: true }); }
      else { gb.box(-0.85, 0.5, 0.8, 0.85, 1.6, 2.8, { side: 'wood', top: 'woodDark' }, 1, 1); gableRoof(gb, 'roofBrown', 'wood', -0.95, 0.7, 0.95, 2.9, 1.6, 0.6, 0.1, false); }
      for (let q = 0, nq = r2.int(1, 4); q < nq; q++) { const cz3 = r2.range(-3, -1); if (r2.chance(0.5)) gb.cyl('woodDark', r2.range(-0.6, 0.6), cz3, 0.32, 0.5, 1.25, 8, 1, 1); else gb.box(-0.4, 0.5, cz3 - 0.4, 0.4, 1.2, cz3 + 0.4, 'wood', 1, 1); } // its cargo: barrels and crates
      gb.xf = null; }
    for (const u of [-C.A * 0.45, C.A * 0.2]) { const v = ci.v - ci.w / 2 - 2.5, [kx, kz] = this.w(u, v); if (!inC(kx, kz)) continue; gb.setXf(kx, kz, C.ang, H0); gb.box(-0.6, 0, -0.6, 0.6, 9, 0.6, 'woodDark', 1, 1); gb.box(-0.3, 8.4, -0.3, 0.3, 8.9, 6.5, 'woodDark', 1, 1); gb.box(-0.03, 4, 6.2, 0.03, 8.4, 6.26, 'iron', 1, 1); gb.box(-1.4, 0, -1.4, 1.4, 1.6, 1.4, { side: 'woodDark', top: 'wood' }, 1, 1); gb.xf = null; siteCol(area, kx, kz, C.ang, 1.4, 1.4, H0 - 1, H0 + 9); } }
  // the great buildings, with the chunk their middle stands in
  for (const b of this.blocks) { if (!TOWN_BUILD[b.use]) continue; const [mx, mz] = this.w(b.uc, b.vc); if (inC(mx, mz)) { TOWN_BUILD[b.use](this, gb, b, area); n += 20; } }
  for (const m of this.mills) if (inC(m.x, m.z)) TOWN_BUILD.mill(this, gb, m, area);
  // a chapel on the corner of its block
  for (const b of this.blocks) if (b.chapel) { const [mx, mz] = this.w(b.u0 + 12, b.v1 - 9); if (!inC(mx, mz)) continue; gb.setXf(mx, mz, ang, H0); const r2 = new RNG(7990);
    makeBuilding(area, gb, r2, { fp: { x0: -5, z0: -8, x1: 5, z1: 8 }, h: 7, style: 'stone', roof: 'gable', roofKey: 'roofSlate', alongX: false, doorT: 0.5, found: 0.5, chimney: 0 }); gb.box(-1.2, 7, -9.6, 1.2, 15, -7.2, 'stone', 2, 2); gb.cone('roofSlate', 0, -8.4, 1.8, 15, 5, 4, 2); gb.xf = null; }
  // yards inside the blocks: a few trees, a shed or two, a well
  for (const b of this.blocks) if (b.yard && b.yard.u1 - b.yard.u0 > 4 && b.yard.v1 - b.yard.v0 > 4) { const Y = b.yard, r2 = new RNG(Math.floor(b.uc * 7 + b.vc * 13) + 7000), nT = Math.floor((Y.u1 - Y.u0) * (Y.v1 - Y.v0) / 220);
    for (let k = 0; k < nT; k++) { const u = r2.range(Y.u0 + 2, Y.u1 - 2), v = r2.range(Y.v0 + 2, Y.v1 - 2), [x, z] = this.w(u, v); if (!inC(x, z)) continue; if (r2.chance(0.65)) { const kind = r2.pick(['oak0', 'oak1', 'oak2', 'cypress']); fl[kind].push([x, H0 - 0.15, z, r2.range(0.6, 0.95)]); cols.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, y0: H0 - 1, y1: H0 + 8 }); }
      else if (r2.chance(0.5)) { gb.setXf(x, z, ang + r2.pick([0, Math.PI / 2]), H0); gb.box(-1.6, 0, -1.2, 1.6, 2.2, 1.2, { side: 'woodDark', top: 'roofBrown' }, 2, 2); gb.xf = null; siteCol(area, x, z, ang, 1.7, 1.7, H0 - 1, H0 + 2.2); }
      else fl[r2.chance(0.5) ? 'bush' : 'bushB'].push([x, H0 - 0.1, z, r2.range(0.7, 1)]); } }
  // the walls: lengths of curtain with a walk and merlons, square towers with roofs, gatehouses, arches where the canal goes under
  const WP = this.wallPieces(), W = C.wall;
  for (const p of WP.pieces) {
    const L = Math.hypot(p.u1 - p.u0, p.v1 - p.v0), n2 = Math.max(1, Math.round(L / 6)), a2 = Math.atan2(p.u1 - p.u0, p.v1 - p.v0);
    for (let k = 0; k < n2; k++) { const f = (k + 0.5) / n2, mu = lerp(p.u0, p.u1, f), mv = lerp(p.v0, p.v1, f), [mx, mz] = this.w(mu, mv); if (!inC(mx, mz)) continue;
      const gate = this.gates.some(g => Math.hypot(g.u - mu, g.v - mv) < W.gateW / 2 + L / n2 / 2), canal = Math.abs(mv - C.canal.v) < C.canal.w / 2 + 1 && Math.abs(Math.abs(mu) - C.A) < 1;
      const seg = L / n2; gb.setXf(mx, mz, ang + a2, H0);
      if (canal) { gb.box(-W.t / 2, 2.6, -seg / 2, W.t / 2, W.h, seg / 2, { side: 'cityWall', top: 'stone' }, 3, 3); gb.box(-W.t / 2, 2.52, -seg / 2, W.t / 2, 2.6, seg / 2, 'iron', 1, 1); for (const sd of [-1, 1]) gb.box(sd * W.t / 2 - 0.25, 2.6, -seg / 2, sd * W.t / 2 + 0.25, 3.6, seg / 2, 'stoneLight', 2, 1); gb.xf = null; /* the vault in shadow, a band of dressed stone over it on both faces */ siteCol(area, mx, mz, ang + a2, W.t / 2, seg / 2, H0 - 4, H0 + W.h); continue; } // the water gate
      if (gate) { gb.box(-W.t / 2 - 1, 4.6, -seg / 2, W.t / 2 + 1, W.h + 3, seg / 2, { side: 'cityWall', top: 'stone' }, 3, 3); gb.xf = null; siteCol(area, mx, mz, ang + a2, W.t / 2 + 1, seg / 2, H0 + 4.6, H0 + W.h + 3); continue; } // the arch over the gateway
      gb.box(-W.t / 2, -1.5, -seg / 2 - 0.02, W.t / 2, W.h, seg / 2 + 0.02, { side: 'cityWall', top: 'stone' }, 3, 3); gb.box(W.t / 2, W.h - 1.2, -seg / 2, W.t / 2 + 1.3, W.h - 0.6, seg / 2, 'stone', 2, 2); /* the wall-walk on its corbels */
      for (let t = -seg / 2 + 0.3; t < seg / 2 - 0.4; t += 1.9) gb.box(-W.t / 2 - 0.05, W.h, t, -W.t / 2 + 0.75, W.h + 1.3, t + 1.0, 'cityWall', 2, 2); // merlons on the outer edge
      gb.xf = null; siteCol(area, mx, mz, ang + a2, W.t / 2, seg / 2, H0 - 2, H0 + W.h + 1.3);
    }
  }
  for (const t of WP.towers) { const [x, z] = this.w(t.u, t.v); if (!inC(x, z)) continue; const s = W.tower / 2 + (t.corner ? 1.5 : 0), h = W.towerH + (t.corner ? 4 : 0); gb.setXf(x, z, ang, H0);
    gb.box(-s, -1.5, -s, s, h, s, { side: 'cityWall', top: 'stone' }, 3, 3); hipRoof(gb, 'roofSlate', -s, -s, s, s, h, s * 1.1, 0.4); for (const [a, b] of [[0, s + 0.03], [s + 0.03, 0]]) gb.quad('winB', [a ? a : -0.4, h - 4, b ? b : 0.4], a ? [0, 0, -1] : [1, 0, 0], [0, 1, 0], 0.8, 1.6, 1, 1, { fixedUV: true }); gb.xf = null; siteCol(area, x, z, ang, s, s, H0 - 2, H0 + h + s); }
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
  for (const L of this.U) { const ci = this.V.findIndex(V => V.canal); if (!(L.a <= ci && L.b >= ci)) continue; const [bx, bz] = this.w(L.p, C.canal.v); if (!inC(bx, bz)) continue;
    const bw = Math.min(L.w, 8), hl = C.canal.w / 2 + 1; gb.setXf(bx, bz, ang, H0); gb.box(-bw / 2, -0.6, -hl, bw / 2, 0.1, hl, { side: 'stone', top: 'flag' }, 2, 2); for (const sd of [-1, 1]) gb.box(sd * bw / 2 - (sd > 0 ? 0.5 : 0), 0.1, -hl, sd * bw / 2 + (sd > 0 ? 0 : 0.5), 1.0, hl, 'stoneLight', 2, 2);
    gb.box(-bw / 2, -3.2, -1, bw / 2, -0.6, 1, 'stone', 2, 2); gb.xf = null; siteCol(area, bx, bz, ang, bw / 2, hl, H0 - 0.7, H0 + 0.1); for (const sd of [-1, 1]) { const [px, pz] = xfP(makeXf(bx, bz, ang), sd * (bw / 2 - 0.25), 0); siteCol(area, px, pz, ang, 0.25, hl, H0 + 0.1, H0 + 1); } }
  return n;
};

/* ---------------- what is kept for good: the water, the lamps, the silhouette from afar, the doors ---------------- */
Town.prototype.buildLasting = function (area, mats) {
  const T = this, C = this.cfg, H0 = this.H0, wl = this.wl(), gb = new GB(); this.flags = this.flags || [];
  // the moat (a ring of water round the walls) and the canal
  { const g = gb.grp('wStream'), M = C.moat, a = C.A + M.off + M.w / 2, b = C.B + M.off + M.w / 2, hw = M.w / 2 + 0.6;
    const ring = [[-a, -b], [a, -b], [a, b], [-a, b], [-a, -b]];
    const strip = (pts, w) => { for (let k = 1; k < pts.length; k++) { const [u0, v0] = pts[k - 1], [u1, v1] = pts[k], L = Math.hypot(u1 - u0, v1 - v0), nu = -(v1 - v0) / L * w, nv = (u1 - u0) / L * w, e = w / L; const P = [[u0 - (u1 - u0) * e + nu, v0 - (v1 - v0) * e + nv], [u1 + (u1 - u0) * e + nu, v1 + (v1 - v0) * e + nv], [u1 + (u1 - u0) * e - nu, v1 + (v1 - v0) * e - nv], [u0 - (u1 - u0) * e - nu, v0 - (v1 - v0) * e - nv]].map(([u, v]) => this.w(u, v));
      const base = g.p.length / 3; for (const [x, z] of P) { g.p.push(x, wl, z); g.u.push(x / 6, z / 6); g.c.push(0.72, 0.84, 0.86); } g.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2); } };
    strip(ring, hw); strip([[-a, C.canal.v], [a, C.canal.v]], C.canal.w / 2 + 0.6); }
  // the lamps along the main streets and round the square: their light at night
  for (const s of this.streets) if (s.main) { const L = Math.hypot(s.u1 - s.u0, s.v1 - s.v0); for (let t = 12; t < L - 6; t += 32) { const f = t / L, u = lerp(s.u0, s.u1, f), v = lerp(s.v0, s.v1, f), du = (s.u1 - s.u0) / L, dv = (s.v1 - s.v0) / L, [x, z] = this.w(u - dv * (s.w / 2 - 0.6), v + du * (s.w / 2 - 0.6)); Sites.glows.push([x, H0 + 3.6, z, 3]); gb.box(x - 0.08, H0, z - 0.08, x + 0.08, H0 + 3.4, z + 0.08, 'iron', 1, 1); gb.box(x - 0.2, H0 + 3.3, z - 0.2, x + 0.2, H0 + 3.8, z + 0.2, 'lantern', 1, 1); } }
  this.group = gb.build(mats); this.group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); area.scene.add(this.group);
  // the silhouette: every house, tower and great building as a plain block, hidden wherever the ground chunk has the real thing
  { const sg = new GB(), mk = (base, key) => { const m = base.clone(); m.userData = {}; m.onBeforeCompile = sh => { sh.uniforms.wMask = Wild.maskU; sh.vertexShader = 'varying vec2 vTxz; varying float vWy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n { vec4 wp = modelMatrix * vec4(transformed, 1.0); vTxz = wp.xz; vWy = 140.0 + max(0.0, wp.y - ' + (H0 + 16).toFixed(1) + ') * 9.0; }');
      sh.fragmentShader = '#define FAR_HIGH\nuniform sampler2D wMask; varying vec2 vTxz; varying float vWy;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (texture2D(wMask, (floor((vTxz + 352.0) / 176.0) + vec2(64.5, 112.5)) / 128.0).r > 0.5) discard;').replace('#include <fog_fragment>', FAR_FOG.replace('mix(1.0, 0.6, hiK)', 'mix(1.0, 0.3, hiK)')); }; m.customProgramCacheKey = () => 'townFar' + key; /* (spires and towers stand out of the haze from far off) */ area.tintMats.push(m); return m; };
    const fm = { tfWall: mk(mats.plaster, 'w'), tfRoof: mk(mats.roofSlate, 'r'), tfBrick: mk(mats.brick, 'b') };
    for (const l of this.lots) { const r = new RNG(l.seed), K = TK[l.kind]; let st = r.pick(K.stories); if (l.type !== 'house') st = Math.max(2, st); const h = st * 3.1 + 0.3, rh = l.w / 2 * 1.35, style = r.pick(K.styles);
      sg.setXf(l.x, l.z, l.o.ang, H0); sg.tint = style === 'brick' ? [1, 0.82, 0.74] : style.startsWith('stone') ? [0.95, 0.95, 0.96] : [1.06, 1.02, 0.94];
      sg.box(-l.w / 2, 0, -l.d / 2, l.w / 2, h, l.d / 2, { side: style === 'brick' ? 'tfBrick' : 'tfWall', top: null }, 3.2, 3.2, { skip: 'b' }); sg.tint = r.chance(0.5) ? [0.5, 0.55, 0.66] : [0.66, 0.46, 0.4]; gableRoof(sg, 'tfRoof', style === 'brick' ? 'tfBrick' : 'tfWall', -l.w / 2, -l.d / 2, l.w / 2, l.d / 2, h, rh, 0.3, false); sg.tint = null; sg.xf = null; }
    const WP = this.wallPieces(); sg.tint = [0.92, 0.9, 0.86];
    for (const p of WP.pieces) { const [ax, az] = this.w(p.u0, p.v0), [bx, bz] = this.w(p.u1, p.v1), L = Math.hypot(bx - ax, bz - az); sg.setXf((ax + bx) / 2, (az + bz) / 2, Math.atan2(bx - ax, bz - az), H0); sg.box(-C.wall.t / 2, -1, -L / 2, C.wall.t / 2, C.wall.h + 1, L / 2, 'tfWall', 3, 3); sg.xf = null; }
    for (const t of WP.towers) { const [x, z] = this.w(t.u, t.v), s = C.wall.tower / 2 + (t.corner ? 1.5 : 0), h = C.wall.towerH + (t.corner ? 4 : 0); sg.setXf(x, z, C.ang, H0); sg.box(-s, -1, -s, s, h, s, 'tfWall', 3, 3); sg.tint = [0.72, 0.74, 0.82]; hipRoof(sg, 'tfRoof', -s, -s, s, s, h, s * 1.1, 0.4); sg.tint = [0.92, 0.9, 0.86]; sg.xf = null; }
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
    const r = new RNG(l.seed + 11), K = TK[l.kind], wealth = { grand: 3, close: 2.2, citadel: 1.5, canal: 2.2, commons: 0.7, weavers: 1.3, suburb: 0.8 }[l.kind], owner = makeOwner(r, l.type, wealth);
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
