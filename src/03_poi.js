/* =====================================================================
   Points of interest: small places out in the generated country that a
   traveller stumbles on — wayside shrines, an abandoned cottage, a
   hunters' camp, a cairn on the tops, a broken cart by the track. They
   are planned for the whole country at load (so the map and the road
   know of them) and built with the ground chunk they stand in.
   ===================================================================== */
const POI_KINDS = {
  shrine: { name: 'a wayside shrine', r: 7 }, cart: { name: 'a broken-down cart', r: 6 }, camp: { name: "a hunters' camp", r: 9 },
  hut: { name: "a woodcutter's hut", r: 9 }, ruin: { name: 'an abandoned cottage', r: 10 }, well: { name: 'an old well', r: 5 },
  cairn: { name: 'a burial cairn', r: 6 }, dolmen: { name: 'an ancient dolmen', r: 6 }, stone: { name: 'a lone standing stone', r: 4 }, oak: { name: 'a great old oak', r: 9 },
};
const POI = {
  list: [], hash: new Map(), HC: 700, discR: 55,
  // one chance in each cell of a coarse grid; what stands there follows the ground
  plan() {
    this.list = []; this.hash = new Map(); const C = this.HC;
    for (let i = Math.floor(WORLD.x0 / C); i <= Math.floor(WORLD.x1 / C); i++) for (let j = Math.floor(WORLD.z0 / C); j <= Math.floor(WORLD.z1 / C); j++) {
      if (_h2(i, j, 6001 + WSEED) > 0.42) continue;
      for (let t = 0; t < 4; t++) {
        const x = (i + 0.15 + 0.7 * _h2(i, j, 6002 + t + WSEED)) * C, z = (j + 0.15 + 0.7 * _h2(i, j, 6010 + t + WSEED)) * C;
        if (Math.hypot(x, z) < 1100 || rimDist(x, z) < 1600 || coastZ(x) - z < 80 || siteWeight(x, z) > 0) continue;
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
        this.list.push(p); const k = i * 100003 + j; this.hash.set(k, p); break;
      }
    }
  },
  near(x, z, r) { const C = this.HC, out = []; for (let i = Math.floor((x - r) / C); i <= Math.floor((x + r) / C); i++) for (let j = Math.floor((z - r) / C); j <= Math.floor((z + r) / C); j++) { const p = this.hash.get(i * 100003 + j); if (p && Math.hypot(p.x - x, p.z - z) < r + p.r) out.push(p); } return out; },
  found(p) { return !!(G.flags.poi && G.flags.poi[p.id]); },
  update(x, z) {
    if (!G.player || G.area !== G.city) return null; let hit = null;
    for (const p of this.near(x, z, this.discR)) if (!this.found(p) && Math.hypot(p.x - x, p.z - z) < this.discR) { (G.flags.poi || (G.flags.poi = {}))[p.id] = 1; hit = p; msg(`You come upon ${p.name}.`, 'district'); }
    return hit;
  },
  // what a chunk builds for the places within it: geometry, colliders (cols), plants (fl), and ground kept clear (blocks)
  build(p, gb, cols, fl, blocks, hAt) {
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
