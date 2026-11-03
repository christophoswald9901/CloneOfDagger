/* =====================================================================
   Points of interest: small places out in the generated country that a
   traveller stumbles on — wayside shrines, an abandoned cottage, a
   hunters' camp, a cairn on the tops, a broken cart by the track. They
   are planned for the whole country at load (so the map and the road
   know of them) and built with the ground chunk they stand in.
   ===================================================================== */
const POI_KINDS = {
  shrine: { name: 'a wayside shrine', r: 7 }, cart: { name: 'a broken-down cart', r: 6 }, camp: { name: "a hunters' camp", r: 9 },
  hut: { name: "a woodcutter's hut", r: 9 }, hamlet: { name: 'a hamlet', r: 70 }, ruin: { name: 'an abandoned cottage', r: 10 }, well: { name: 'an old well', r: 5 },
  cairn: { name: 'a burial cairn', r: 6 }, dolmen: { name: 'an ancient dolmen', r: 6 }, stone: { name: 'a lone standing stone', r: 4 }, oak: { name: 'a great old oak', r: 9 },
};
const POI = {
  list: [], hash: new Map(), HC: 700, discR: 55,
  // one chance in each cell of a coarse grid; what stands there follows the ground
  // hamlets: a handful of cottages facing a track, every few kilometres along the ways out from the city, with farmland round them
  planHamlets() {
    const out = [], A = ['Ash', 'Bram', 'Cold', 'Elm', 'Fern', 'Gor', 'Hart', 'Kel', 'Lark', 'Mer', 'Oak', 'Rook', 'Sedge', 'Thorn', 'Wil', 'Bar', 'Dun', 'Hol', 'Brack', 'Stan'], B = ['ford', 'ham', 'wick', 'by', 'stead', 'ley', 'combe', 'thorpe', 'well', 'hollow', 'cote', 'mere'];
    Wild.tracks.forEach((T, ti) => {
      if (T.site) return; let acc = 900 + 900 * _h2(ti, 1, 6200 + WSEED);
      for (let q = 6; q < T.length - 6; q++) {
        acc += 3; if (acc < 2300) continue;
        const [x, z] = T[q], h = terrainRaw(x, z);
        if (Math.hypot(x, z) < 1900 || rimDist(x, z) < 1800 || h < SEA + 4 || siteZone(x, z, 150) || riverNear(x, z, 70) || out.some(o => Math.hypot(o.x - x, o.z - z) < 1500)) continue;
        let lo = 1e9, hi = -1e9; for (let a = -2; a <= 2; a++) for (let b = -2; b <= 2; b++) { const v = terrainRaw(x + a * 20, z + b * 20); lo = Math.min(lo, v); hi = Math.max(hi, v); } if (hi - lo > 9) continue;
        const k = out.length, rng = new RNG(Math.floor(_h2(ti, q, 6210 + WSEED) * 2147483647)), houses = [], n = rng.int(4, 7);
        for (let m = 0; m < n; m++) {
          const qq = clamp(q + Math.round((m - (n - 1) / 2) * 7 + rng.range(-1, 1)), 1, T.length - 2), sd = m % 2 ? 1 : -1, [px, pz] = T[qq], a = T[qq - 1], b = T[qq + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l * sd, nz = (b[0] - a[0]) / l * sd, off = rng.range(11, 15);
          const hx = px + nx * off, hz = pz + nz * off; houses.push({ x: hx, z: hz, ang: Math.atan2(-nx, -nz), seed: rng.int(1, 1e9), o: mkObb(hx, hz, Math.atan2(-nx, -nz), 6, 5) });
        }
        const [wx, wz] = (() => { const a = T[q - 1], b = T[q + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [x + (b[1] - a[1]) / l * 7, z - (b[0] - a[0]) / l * 7]; })();
        out.push({ id: `h${ti}_${q}`, name: A[rng.int(0, A.length - 1)] + B[rng.int(0, B.length - 1)], x, z, houses, well: [wx, wz] }); acc = 0;
      }
    });
    this.hamlets = out; this.houseHash = new SHash(32); for (const H of out) for (const h of H.houses) this.houseHash.add(h, obbAabb(h.o));
    return out;
  },
  hamletNear(x, z, r) { return (this.hamlets || []).some(H => Math.hypot(H.x - x, H.z - z) < r); },
  housesIn(x0, z0, x1, z1) { return this.houseHash ? this.houseHash.query(x0, z0, x1, z1) : []; },
  plan() {
    this.list = []; this.hash = new Map(); const C = this.HC;
    for (const H of this.planHamlets()) { const p = { id: H.id, kind: 'hamlet', name: `the hamlet of ${H.name}`, x: H.x, z: H.z, ang: 0, r: 70, hamlet: H }; this.list.push(p); this.addHash(p); }
    for (let i = Math.floor(WORLD.x0 / C); i <= Math.floor(WORLD.x1 / C); i++) for (let j = Math.floor(WORLD.z0 / C); j <= Math.floor(WORLD.z1 / C); j++) {
      if (_h2(i, j, 6001 + WSEED) > 0.42) continue;
      for (let t = 0; t < 4; t++) {
        const x = (i + 0.15 + 0.7 * _h2(i, j, 6002 + t + WSEED)) * C, z = (j + 0.15 + 0.7 * _h2(i, j, 6010 + t + WSEED)) * C;
        if (Math.hypot(x, z) < 1100 || rimDist(x, z) < 1600 || coastZ(x) - z < 80 || siteWeight(x, z) > 0 || this.hamletNear(x, z, 260)) continue;
        const h = terrainRaw(x, z); if (h < SEA + 3) continue;
        const sl = Math.hypot(terrainRaw(x + 6, z) - terrainRaw(x - 6, z), terrainRaw(x, z + 6) - terrainRaw(x, z - 6)) / 12; if (sl > 0.22) continue;
        if (riverNear(x, z, 40)) continue;
        const tD = Wild.trackD(x, z), fm = Wild.env.forestMask(x, z, h), TL = wildTreeLine(x, z), u = _h2(i, j, 6020 + WSEED);
        if (tD < 14) continue; // not on the track itself
        let kind;
        if (h > TL - 30) kind = u < 0.55 ? 'cairn' : u < 0.8 ? 'stone' : 'dolmen';
        else if (tD < 70) kind = u < 0.45 ? 'shrine' : u < 0.75 ? 'cart' : 'well';
        else if (fm > 0.5) kind = u < 0.5 ? 'hut' : 'camp';
        else if (wildHeath(x, z, h) > 0.4) kind = u < 0.5 ? 'dolmen' : u < 0.8 ? 'stone' : 'cairn';
        else kind = u < 0.35 ? 'ruin' : u < 0.55 ? 'oak' : u < 0.7 ? 'camp' : u < 0.85 ? 'well' : 'stone';
        const p = { id: `p${i}_${j}`, kind, name: POI_KINDS[kind].name, x, z, ang: _h2(i, j, 6030) * Math.PI * 2, r: POI_KINDS[kind].r };
        if (kind === 'cart' || kind === 'shrine') { const tp = Wild.trackPtsNear(x - 90, z - 90, x + 90, z + 90, 2); let bd = 1e9, b = null; for (const q of tp) { const d = Math.hypot(q[0] - x, q[1] - z); if (d < bd) { bd = d; b = q; } } if (b) p.ang = Math.atan2(b[0] - x, b[1] - z); } // facing the way
        this.list.push(p); this.addHash(p); break;
      }
    }
  },
  addHash(p) { const k = Math.floor(p.x / this.HC) * 100003 + Math.floor(p.z / this.HC); let l = this.hash.get(k); if (!l) this.hash.set(k, l = []); l.push(p); },
  near(x, z, r) { const C = this.HC, out = []; for (let i = Math.floor((x - r - 80) / C); i <= Math.floor((x + r + 80) / C); i++) for (let j = Math.floor((z - r - 80) / C); j <= Math.floor((z + r + 80) / C); j++) { const l = this.hash.get(i * 100003 + j); if (l) for (const p of l) if (Math.hypot(p.x - x, p.z - z) < r + p.r) out.push(p); } return out; },
  found(p) { return !!(G.flags.poi && G.flags.poi[p.id]); },
  update(x, z) {
    if (!G.player || G.area !== G.city) return null; let hit = null;
    for (const p of this.near(x, z, this.discR)) if (!this.found(p) && Math.hypot(p.x - x, p.z - z) < this.discR + (p.kind === 'hamlet' ? 60 : 0)) { (G.flags.poi || (G.flags.poi = {}))[p.id] = 1; hit = p; msg(`You come upon ${p.name}.`, 'district'); }
    // the people of the nearest hamlet, about their doors by day
    const H = (this.hamlets || []).find(h => Math.hypot(h.x - x, h.z - z) < 380);
    if (this.folk && (this.folk.H !== H || this.folk.list[0].removed)) { for (const e of this.folk.list) if (!e.removed) e.remove(); this.folk = null; }
    if (H && !this.folk) this.folk = { H, list: H.houses.slice(0, 4).map((h, k) => { const r = new RNG(h.seed), g = r.chance(0.5) ? 'f' : 'm', [vx, vz] = xfP(makeXf(h.x, h.z, h.ang), r.range(-2, 2), 7);
      return spawnNPC(G.city, { name: personName(r, g), look: lookByWealth(r, g, 0.7), gender: g, x: vx, z: vz, role: 'wander', wanderR: 7, speed: 1.0, dialog: 'villager', spriteKey: 'ham' + (h.seed % 24), data: { hamlet: H.name } }); }) };
    if (this.folk) { const night = isNight(G.time); for (const e of this.folk.list) if (!e.dead) e.active = !night; }
    return hit;
  },
  // what a chunk builds for the places within it: geometry, colliders (cols), plants (fl), and ground kept clear (blocks)
  build(p, gb, cols, fl, blocks, hAt) {
    if (p.kind === 'hamlet') return; // (its houses are built with the chunk each stands in)
    const rng = new RNG(Math.floor(_h2(Math.round(p.x), Math.round(p.z), 6100) * 2147483647)), area = { colliders: cols };
    const at = (lx, lz) => xfP(makeXf(p.x, p.z, p.ang), lx, lz), y0 = Math.min(hAt(p.x - 3, p.z - 3), hAt(p.x + 3, p.z - 3), hAt(p.x - 3, p.z + 3), hAt(p.x + 3, p.z + 3), hAt(p.x, p.z));
    const box = (lx, lz, ang, y, x0, yb, z0, x1, yt, z1, k, tw = 2) => { const [wx, wz] = at(lx, lz); gb.setXf(wx, wz, p.ang + ang, y); gb.box(x0, yb, z0, x1, yt, z1, k, tw, tw); gb.xf = null; };
    const col = (lx, lz, ang, hx, hz, yb, yt) => { const [wx, wz] = at(lx, lz); siteCol(area, wx, wz, p.ang + ang, hx, hz, yb, yt); };
    blocks.push(mkObb(p.x, p.z, p.ang, p.r, p.r));
    switch (p.kind) {
      case 'shrine': // a little stone shrine under a pent roof, flowers left at its foot
        box(0, 0, 0, y0 - 0.3, -0.8, 0, -0.6, 0.8, 1.1, 0.6, { side: 'stone', top: 'stoneLight' }); box(0, 0, 0, y0 + 0.8, -0.45, 0, -0.35, 0.45, 1.5, 0.35, 'stoneLight');
        box(0, 0, 0, y0 + 2.3, -0.75, 0, -0.6, 0.75, 0.18, 0.6, { side: 'woodDark', top: 'roofSlate' }); col(0, 0, 0, 0.8, 0.6, y0 - 1, y0 + 2.5);
        for (let k = 0; k < 6; k++) { const [fx, fz] = at(rng.range(-1.6, 1.6), rng.range(0.8, 1.8)); fl['flowers' + rng.int(0, 3)].push([fx, hAt(fx, fz) - 0.03, fz, rng.range(0.7, 1)]); }
        break;
      case 'cart': { // a cart off the track with a broken wheel, its load spilled
        const y = y0 + 0.1; box(0, 0, 0.1, y + 0.55, -0.9, 0, -1.7, 0.9, 0.5, 1.7, { side: 'woodDark', top: 'wood' }); box(0, 0, 0.1, y + 1.05, -0.95, 0, -1.7, -0.85, 0.5, 1.7, 'woodDark'); box(0, 0, 0.1, y + 1.05, 0.85, 0, -1.7, 0.95, 0.5, 1.7, 'woodDark');
        box(0, -2.8, 0.1, y + 0.75, -0.06, 0, 0, 0.06, 0.1, 1.2, 'woodDark'); box(0.4, -2.8, 0.1, y + 0.75, -0.06, 0, 0, 0.06, 0.1, 1.2, 'woodDark'); // the shafts
        for (const [lx, up] of [[-1.05, true], [1.05, false]]) { const [wx, wz] = at(lx, 0.4); gb.setXf(wx, wz, p.ang + 0.1, y); if (up) gb.box(-0.08, 0, -0.55, 0.08, 1.1, 0.55, 'woodDark', 1, 1); else gb.box(-0.55, -0.1, -0.55, 0.55, 0.06, 0.55, 'woodDark', 1, 1); gb.xf = null; }
        for (let k = 0; k < 3; k++) box(rng.range(1.5, 3), rng.range(-1, 1.5), rng.range(0, 3), y - 0.05, -0.4, 0, -0.3, 0.4, 0.6, 0.3, { side: 'wood', top: 'woodDark' }); // crates
        col(0, 0, 0.1, 1, 1.8, y - 1, y + 1.2); break;
      }
      case 'camp': // two tents, a ring of stones round a cold fire, a log to sit on
        for (const [lx, lz, a] of [[-3.5, -1, 0.3], [2.8, -2.5, -0.5]]) { const [wx, wz] = at(lx, lz), y = hAt(wx, wz); gb.setXf(wx, wz, p.ang + a, y);
          gb.quad4('cloth', [-1.2, 0, -1.4], [-1.2, 0, 1.4], [0, 1.5, 1.4], [0, 1.5, -1.4], [0, 0], [1, 0], [1, 1], [0, 1], [-1, 0.6, 0]); gb.quad4('cloth', [1.2, 0, 1.4], [1.2, 0, -1.4], [0, 1.5, -1.4], [0, 1.5, 1.4], [0, 0], [1, 0], [1, 1], [0, 1], [1, 0.6, 0]);
          gb.xf = null; col(lx, lz, a, 1.2, 1.4, y - 1, y + 1.5); }
        for (let k = 0; k < 7; k++) { const a = k / 7 * 6.283, [fx, fz] = at(Math.cos(a) * 0.8, 1.8 + Math.sin(a) * 0.8); boulder(gb, 'boulder', fx, hAt(fx, fz), fz, 0.22, rng); }
        { const [fx, fz] = at(0, 1.8); gb.disc('woodDark', fx, hAt(fx, fz) + 0.05, fz, 0.5, 6, 1); }
        box(0, 3.4, 1.4, y0, -0.2, 0, -1.1, 0.2, 0.35, 1.1, 'woodDark'); break;
      case 'hut': { const [wx, wz] = at(0, 0); gb.setXf(wx, wz, p.ang, y0 + 0.1);
        makeBuilding(area, gb, rng, { fp: { x0: -3, z0: -2.5, x1: 3, z1: 2.5 }, stories: 1, h: 2.7, style: 'wood', roof: 'gable', roofKey: 'roofThatch', roofTint: [0.9, 0.85, 0.75], doorT: 0.5, found: 0.8, chimney: 1, winRate: 0.5, wealth: 0.4 });
        gb.xf = null; for (let k = 0; k < 4; k++) box(rng.range(4, 6), rng.range(-2, 2), rng.range(0, 3), y0 - 0.1, -0.25, 0, -1.2, 0.25, 0.5, 1.2, 'woodDark'); // a log pile
        break; }
      case 'ruin': { const pts = [[-4, -3], [4, -3], [4, 3], [-4, 3]].map(([a, b]) => at(a, b)); for (let k = 0; k < 4; k++) ruinWall(gb, area, hAt, ...pts[k], ...pts[(k + 1) % 4], 0.6, 3.6, 0.7, k * 3.3 + p.x, rng, k === 2 ? 1 : -1);
        const [tx, tz] = at(rng.range(-6, 6), rng.range(5, 8)); fl.dead.push([tx, hAt(tx, tz) - 0.15, tz, rng.range(0.9, 1.2)]); cols.push({ x0: tx - 0.35, z0: tz - 0.35, x1: tx + 0.35, z1: tz + 0.35, y0: y0 - 1, y1: y0 + 8 });
        for (let k = 0; k < 6; k++) { const [bx, bz] = at(rng.range(-6, 6), rng.range(-5, 5)); fl[rng.chance(0.5) ? 'bush' : 'bushB'].push([bx, hAt(bx, bz) - 0.1, bz, rng.range(0.6, 1)]); }
        break; }
      case 'well': { const [wx, wz] = at(0, 0); gb.cyl('stone', wx, wz, 0.95, y0 - 0.4, y0 + 0.8, 9, 2, 2); gb.disc('water', wx, y0 + 0.4, wz, 0.8, 9, 2);
        box(-1.1, 0, 0, y0, -0.08, 0, -0.08, 0.08, 2.2, 0.08, 'woodDark'); box(1.1, 0, 0, y0, -0.08, 0, -0.08, 0.08, 2.2, 0.08, 'woodDark'); box(0, 0, 0, y0 + 2.1, -1.2, 0, -0.07, 1.2, 0.12, 0.07, 'woodDark');
        box(0, 0, 0, y0 + 2.2, -1.3, 0, -0.75, 1.3, 0.12, 0.75, { side: 'woodDark', top: 'roofThatch' }); siteCol(area, wx, wz, 0, 1, 1, y0 - 1, y0 + 0.8); break; }
      case 'cairn': for (let k = 0; k < 9; k++) { const s = 1.5 - k * 0.13, a = k * 2.4, r = k < 6 ? 0.9 * (1 - k / 6) : 0; boulder(gb, 'boulder', p.x + Math.cos(a) * r, y0 + k * 0.32, p.z + Math.sin(a) * r, s * 0.65, rng); }
        siteCol(area, p.x, p.z, 0, 1.2, 1.2, y0 - 1, y0 + 2.6); break;
      case 'dolmen': box(-1.1, 0, 0, y0 - 0.4, -0.35, 0, -0.7, 0.35, 2.0, 0.7, 'rock'); box(1.1, 0, 0, y0 - 0.4, -0.35, 0, -0.7, 0.35, 2.0, 0.7, 'rock'); box(0, -0.6, 0, y0 - 0.4, -0.4, 0, -0.5, 0.4, 1.7, 0.5, 'rock');
        box(0, 0, 0.08, y0 + 1.6, -1.7, 0, -1.1, 1.7, 0.55, 1.1, 'rock'); col(-1.1, 0, 0, 0.35, 0.7, y0 - 1, y0 + 2.2); col(1.1, 0, 0, 0.35, 0.7, y0 - 1, y0 + 2.2); col(0, -0.6, 0, 0.4, 0.5, y0 - 1, y0 + 2.2); break;
      case 'stone': box(0, 0, 0, y0 - 0.5, -0.6, 0, -0.35, 0.6, 3.6, 0.35, 'rock'); box(0, 0, 0, y0 + 3.1, -0.45, 0, -0.28, 0.4, 0.45, 0.28, 'rock'); col(0, 0, 0, 0.6, 0.35, y0 - 1, y0 + 3.5); break;
      case 'oak': { fl.oak0.push([p.x, y0 - 0.2, p.z, 2.1]); cols.push({ x0: p.x - 0.8, z0: p.z - 0.8, x1: p.x + 0.8, z1: p.z + 0.8, y0: y0 - 1, y1: y0 + 18 });
        for (let k = 0; k < 7; k++) { const a = rng.range(0, 6.283), r = rng.range(5, 8), bx = p.x + Math.cos(a) * r, bz = p.z + Math.sin(a) * r; fl[rng.chance(0.5) ? 'bush' : 'bushB'].push([bx, hAt(bx, bz) - 0.1, bz, rng.range(0.6, 0.9)]); }
        break; }
    }
  },
};
