/* =====================================================================
   Halewood House: a great brick house of the new fashion, some 4 km
   south-west of Corrinvale. Everything hangs on one straight line of
   about a kilometre: gate lodges on the road, an avenue of trees, a
   railed forecourt, the house, a terrace, a parterre round a fountain,
   a long water, and three rides fanning out through a wood, the middle
   one closed by an obelisk on a rise. A sixth fixed landmark: its
   ground, plants and buildings are the same in every world.
   Local frame: +z runs from the house to the gate (east-south-east, the
   side the morning sun lights), +x to the north-north-east.
   ===================================================================== */
const HALL = { x: -3900, z: -10300, ang: 1.012, H0: 118, gate: 460, ob: -520, GL: -1.4 };
HALL.c = Math.cos(HALL.ang); HALL.s = Math.sin(HALL.ang);
function hallW(lx, lz) { return [HALL.x + lx * HALL.c + lz * HALL.s, HALL.z - lx * HALL.s + lz * HALL.c]; }
function hallL(x, z) { const dx = x - HALL.x, dz = z - HALL.z; return [dx * HALL.c - dz * HALL.s, dx * HALL.s + dz * HALL.c]; }
// the three rides through the wood, from the head of the long water: [x0, z0, x1, z1] in the local frame
const HALL_RIDES = [[0, -350, 0, -506], [0, -350, -98, -512], [0, -350, 98, -512]];

// the ground: a level platform for the house and its courts, a long even fall down the avenue to the gate,
// the gardens sunk a step below the terrace, the wood rising behind them to the obelisk's knoll; rolling parkland round about
function hallH(x, z) {
  const [lx, lz] = hallL(x, z), ax = Math.abs(lx);
  let p = 0;
  if (lz >= 75) p = -0.012 * (Math.min(lz, 640) - 75);
  else if (lz < -25) {
    p = HALL.GL * (1 - smoothstep(51, 64, ax)) * (ax < 9 ? smoothstep(-25.5, -27.5, lz) * 1.25 - 0.25 * smoothstep(-30, -34, lz) : smoothstep(-25, -31, lz)); // (the bank falls away sooner under the steps)
    if (lz < -345) p += 0.03 * Math.min(-345 - lz, 230);
  }
  p += 5 * Math.exp(-((lz - HALL.ob) ** 2 + lx * lx) / 3600);
  const m = Math.max(smoothstep(120, 300, ax), smoothstep(480, 650, lz), smoothstep(580, 720, -lz));
  return HALL.H0 + p + m * (7 * fbm(x / 230, z / 230, 3, 971) + 2.2 * fbm(x / 60, z / 60, 2, 972));
}
// the long water and the fountain: not to be walked into
function hallWet(x, z) {
  if (Math.abs(x - HALL.x) > 400 || Math.abs(z - HALL.z) > 400) return false;
  const [lx, lz] = hallL(x, z); return (Math.abs(lx) < 9.7 && lz < -130.3 && lz > -337.7) || Math.hypot(lx, lz + 77) < 6.8;
}
// where nothing grows of itself: the courts, the avenue, the gardens, the rides and the obelisk's foot
function hallKeep(x, z, r) {
  if (Math.abs(x - HALL.x) > 700 || Math.abs(z - HALL.z) > 700) return false;
  const [lx, lz] = hallL(x, z), ax = Math.abs(lx);
  if (ax < 104 + r && lz > -34 && lz < 84) return true;
  if (ax < 29 && lz >= 84 && lz < 486) return true;
  if (ax < 16 && lz >= 486 && lz < 730) return true; // the view up the road to the gate
  if (ax < 72 && lz <= -34 && lz > -362) return true;
  if (Math.hypot(lx, lz - HALL.ob) < 17) return true;
  for (const [a, b, c, d] of HALL_RIDES) if (segDist(lx, lz, a, b, c, d).d < 6.5 + r * 0.5) return true;
  return false;
}
// its woods: a fan of old wood behind the long water, cut by the rides; a belt behind each service court to frame the house
function hallForest(x, z) {
  const [lx, lz] = hallL(x, z), ax = Math.abs(lx), n = fbm(x / 70, z / 70, 2, 973);
  const d = -338 - lz, hw = 48 + d * 0.8 + 16 * n, fan = d > 0 ? smoothstep(0, 22, d) * (1 - smoothstep(hw, hw + 30, ax)) * (1 - smoothstep(225 + 20 * n, 270 + 20 * n, d)) : 0;
  // a belt of wood round the park, broken here and there, open where the road comes in
  const e = Math.hypot(lx / 340, (lz - 20) / 620) + 0.09 * n, ring = smoothstep(0.82, 0.96, e) * (1 - smoothstep(1.14, 1.34, e)) * smoothstep(30, 60, ax);
  return Math.max(fan, ring);
}
{ const [sx, sz] = hallW(0, -30);
  SITES.push({ id: 'halewood', name: 'Halewood House', kind: 'house', x: sx, z: sz, rc: 560, rb: 1050, discR: 520,
    blurb: 'a great brick house of the new fashion, set square at the end of its avenue among clipped gardens and a long water',
    road: [[0, 468], [0, 520], [0, 580], [0, 640], [0, 700], [8, 760]].map(([a, b]) => hallW(a, b)),
    lane: [[0, 468], [0, 300], [0, 150], [0, 66]].map(([a, b]) => hallW(a, b)),   // the drive, for travel by road
    keep: hallKeep, forest: hallForest });
  SITE_H.halewood = hallH; }

// a hipped roof with a ridge along the longer side (a pyramid over a square)
function hallRoof(gb, key, x0, z0, x1, z1, h, rh) {
  const w = x1 - x0, d = z1 - z0, tw = 3;
  if (w >= d) { const zc = (z0 + z1) / 2, q = d / 2, a = [x0 + q, h + rh, zc], b = [x1 - q, h + rh, zc], sl = Math.hypot(q, rh) / tw;
    gb.quad4(key, [x0, h, z1], [x1, h, z1], b, a, [x0 / tw, 0], [x1 / tw, 0], [b[0] / tw, sl], [a[0] / tw, sl], [0, 1, 1]);
    gb.quad4(key, [x1, h, z0], [x0, h, z0], a, b, [-x1 / tw, 0], [-x0 / tw, 0], [-a[0] / tw, sl], [-b[0] / tw, sl], [0, 1, -1]);
    gb.tri(key, [x0, h, z0], [x0, h, z1], a, [z0 / tw, 0], [z1 / tw, 0], [zc / tw, sl], [-1, 1, 0]);
    gb.tri(key, [x1, h, z1], [x1, h, z0], b, [-z1 / tw, 0], [-z0 / tw, 0], [-zc / tw, sl], [1, 1, 0]);
  } else { const xc = (x0 + x1) / 2, q = w / 2, a = [xc, h + rh, z0 + q], b = [xc, h + rh, z1 - q], sl = Math.hypot(q, rh) / tw;
    gb.quad4(key, [x1, h, z1], [x1, h, z0], a, b, [-z1 / tw, 0], [-z0 / tw, 0], [-a[2] / tw, sl], [-b[2] / tw, sl], [1, 1, 0]);
    gb.quad4(key, [x0, h, z0], [x0, h, z1], b, a, [z0 / tw, 0], [z1 / tw, 0], [b[2] / tw, sl], [a[2] / tw, sl], [-1, 1, 0]);
    gb.tri(key, [x0, h, z1], [x1, h, z1], b, [x0 / tw, 0], [x1 / tw, 0], [xc / tw, sl], [0, 1, 1]);
    gb.tri(key, [x1, h, z0], [x0, h, z0], a, [-x1 / tw, 0], [-x0 / tw, 0], [-xc / tw, sl], [0, 1, -1]);
  }
}

SITE_BUILD.halewood = function (gb, S, H, area) {
  const rng = new RNG(7601), Y0 = HALL.H0, GL = HALL.GL, XF = makeXf(HALL.x, HALL.z, HALL.ang);
  // a softer light than the open country's: the shaded fronts of a pale house still show their windows
  const savedLight = gb.light;
  gb.light = (p, n) => { const d = Math.max(0, v3dot(n, TERRAIN_LIGHT)), k = 0.72 + 0.56 * d + 0.06 * Math.max(0, n[1]); return [k * lerp(0.92, 1.14, d), k * lerp(0.9, 1.0, d), k * lerp(0.96, 0.8, d)]; };
  const frame = (lx = 0, lz = 0, rot = 0, y = Y0) => { const [x, z] = hallW(lx, lz); return gb.setXf(x, z, HALL.ang + rot, y); };
  const gy = (lx, lz) => H(...hallW(lx, lz));
  const col = (x0, z0, x1, z1, y0, y1) => addOCol(area, gb.xf, x0, z0, x1, z1, y0, y1);
  const plants = S.plants = [], plant = (kind, lx, lz, s) => plants.push([kind, ...hallW(lx, lz), s]);
  const SL = { side: 'ashlar', top: 'ashlar' };

  // windows in even bays along one face of a footprint, between t0 and t1 metres along it; rows: [sill height, width, height, key]
  const wins = (fp, face, t0, t1, rows, skip = null, bay = 3.9) => {
    const fi = faceInfo(fp, face), n = Math.max(1, Math.round((t1 - t0) / bay)), sp = (t1 - t0) / n;
    for (let k = 0; k < n; k++) { const t = t0 + (k + 0.5) * sp;
      rows.forEach(([y, w, h, key], ri) => { if (skip && skip(k, ri, n)) return;
        gb.quad(key, [fi.o[0] + fi.U[0] * (t - w / 2) + fi.n[0] * 0.05, y, fi.o[2] + fi.U[2] * (t - w / 2) + fi.n[2] * 0.05], fi.U, [0, 1, 0], w, h, 1, 1, { fixedUV: true }); }); }
  };
  // a range of building: stone plinth, brick walls, stone quoins, string courses and cornice, a hipped slate roof
  const range = (x0, z0, x1, z1, h, o = {}) => {
    const pl = o.plinth ?? 1.0;
    gb.box(x0 - 0.15, -1.8, z0 - 0.15, x1 + 0.15, pl, z1 + 0.15, SL, 3, 3);
    gb.box(x0, pl, z0, x1, h, z1, { side: o.wall || 'brick', top: null }, 2.4, 2.4);
    if (!o.plain) for (const qx of [x0, x1]) for (const qz of [z0, z1]) gb.box(qx === x0 ? x0 - 0.07 : x1 - 0.9, pl, qz === z0 ? z0 - 0.07 : z1 - 0.9, qx === x0 ? x0 + 0.9 : x1 + 0.07, h - 0.6, qz === z0 ? z0 + 0.9 : z1 + 0.07, 'ashlar', 2, 2, { skip: 'tb' }); // quoins
    for (const y of o.strings || []) gb.box(x0 - 0.12, y - 0.16, z0 - 0.12, x1 + 0.12, y + 0.16, z1 + 0.12, 'ashlar', 3, 3, { skip: 'b' });
    gb.box(x0 - 0.55, h - 0.7, z0 - 0.55, x1 + 0.55, h + 0.05, z1 + 0.55, SL, 3, 3);
    const rh = o.rh ?? Math.min(x1 - x0 + 1.4, z1 - z0 + 1.4) / 2 * (o.pitch ?? 0.72);
    hallRoof(gb, o.roofKey || 'roofSlate', x0 - 0.7, z0 - 0.7, x1 + 0.7, z1 + 0.7, h, rh);
    col(x0, z0, x1, z1, -2, h + rh * 0.6);
    return rh;
  };
  const chimney = (x, z, y0, y1) => { gb.box(x - 1.1, y0, z - 0.7, x + 1.1, y1, z + 0.7, { side: 'brick', top: null }, 2.4, 2.4); gb.box(x - 1.28, y1, z - 0.88, x + 1.28, y1 + 0.35, z + 0.88, SL, 2, 2); for (const px of [-0.55, 0.55]) gb.cyl('roofRed', x + px, z, 0.26, y1 + 0.35, y1 + 0.95, 6, 1, 1); };
  // a brick wall with a stone coping
  const wall = (x0, z0, x1, z1, h, y = 0, key = 'brick') => { gb.box(x0, y - 1.2, z0, x1, y + h, z1, { side: key, top: null }, 2.4, 2.4); gb.box(x0 - 0.1, y + h, z0 - 0.1, x1 + 0.1, y + h + 0.18, z1 + 0.1, SL, 2, 2); col(x0, z0, x1, z1, y - 1.5, y + h + 0.18); };
  const pier = (x, z, w, h, y = 0, top = 'ball') => {
    gb.box(x - w / 2, y - 1, z - w / 2, x + w / 2, y + h, z + w / 2, 'ashlar', 2, 2, { skip: 'tb' }); gb.box(x - w / 2 - 0.12, y + h, z - w / 2 - 0.12, x + w / 2 + 0.12, y + h + 0.22, z + w / 2 + 0.12, SL, 2, 2);
    if (top === 'ball') { gb.cyl('ashlar', x, z, w * 0.34, y + h + 0.22, y + h + 0.22 + w * 0.55, 6, 2, 2); gb.cone('ashlar', x, z, w * 0.34, y + h + 0.22 + w * 0.55, w * 0.3, 6, 2); }
    else if (top === 'urn') urn(x, z, y + h + 0.22, 0.8);
    col(x - w / 2, z - w / 2, x + w / 2, z + w / 2, y - 1, y + h + 0.3);
  };
  const urn = (x, z, y, s = 1) => { gb.cyl('ashlar', x, z, 0.16 * s, y, y + 0.3 * s, 6, 2, 2); gb.cyl('ashlar', x, z, 0.42 * s, y + 0.3 * s, y + 0.85 * s, 8, 2, 2, { top: 'ashlar' }); gb.cyl('ashlar', x, z, 0.26 * s, y + 0.85 * s, y + 1.05 * s, 6, 2, 2); gb.cone('ashlar', x, z, 0.3 * s, y + 1.05 * s, 0.3 * s, 6, 2); };
  // a figure on a pedestal, facing along +z of the current frame
  const statue = (x, z, y) => {
    gb.box(x - 0.55, y - 0.4, z - 0.55, x + 0.55, y + 0.18, z + 0.55, SL, 2, 2); gb.box(x - 0.42, y + 0.18, z - 0.42, x + 0.42, y + 1.0, z + 0.42, 'ashlar', 2, 2, { skip: 'tb' }); gb.box(x - 0.52, y + 1.0, z - 0.52, x + 0.52, y + 1.14, z + 0.52, SL, 2, 2);
    gb.tint = [1.14, 1.12, 1.07]; const b = y + 1.14;
    gb.cone('plaster', x, z, 0.34, b, 1.5, 7, 2); gb.cyl('plaster', x, z, 0.2, b + 0.85, b + 1.3, 6, 2, 2); gb.cyl('plaster', x, z, 0.27, b + 1.3, b + 1.62, 6, 2, 2, { top: 'plaster' });
    gb.cyl('plaster', x, z, 0.085, b + 1.62, b + 1.74, 5, 2, 2); gb.cyl('plaster', x, z, 0.14, b + 1.74, b + 2.02, 6, 2, 2, { top: 'plaster' });
    gb.box(x + 0.22, b + 1.45, z - 0.07, x + 0.36, b + 2.15, z + 0.07, 'plaster', 2, 2); gb.box(x - 0.36, b + 0.95, z - 0.07, x - 0.24, b + 1.58, z + 0.07, 'plaster', 2, 2);
    gb.tint = null; col(x - 0.5, z - 0.5, x + 0.5, z + 0.5, y - 1, y + 3.1);
  };
  const hedge = (x0, z0, x1, z1, h, y = GL) => { gb.box(x0, y - 0.4, z0, x1, y + h, z1, 'hedge', 2, 2); col(x0, z0, x1, z1, y - 1, y + h); };
  const yew = (x, z, r, h, y = GL) => { gb.cyl('hedge', x, z, r, y - 0.2, y + h * 0.22, 8, 2, 2); gb.cone('hedge', x, z, r, y + h * 0.22, h * 0.78, 8, 2); col(x - r * 0.7, z - r * 0.7, x + r * 0.7, z + r * 0.7, y - 1, y + h * 0.8); };
  const patch = (key, x0, z0, x1, z1, lift, cell = 8) => drapePatch(gb, key, XF, x0, z0, x1, z1, { cell, lift, uvFrame: true });
  const disc = (key, lx, lz, r, lift, segs = 20) => { const [x, z] = hallW(lx, lz); drapeDisc(gb, key, x, z, r, { segs, rings: 2, lift }); };

  /* ---------------- the ground: lawns, gravel, paving ---------------- */
  patch('hGravel', -2.6, 70, 2.6, HALL.gate + 7, 0.07, 6);        // the drive
  patch('hGravel', -39, 9, 39, 72, 0.06);                                        // the forecourt
  disc('hLawn2', 0, 42, 10, 0.09);                                               // its round of grass
  for (const s of [-1, 1]) patch('hLawn2', s > 0 ? 13.5 : -37, 20, s > 0 ? 37 : -13.5, 66, 0.09, 6); // and a plat either side
  gb.tint = [1.28, 1.22, 1.06]; patch('sqFlag', -40, -25, 40, -8, 0.06); gb.tint = null;                                       // the terrace
  patch('hGravel', -46, -120, 46, -31.5, 0.07);                                    // the parterre's walks
  for (const s of [-1, 1]) patch('hGravel', s * 16 - 3, -346, s * 16 + 3, -120, 0.07); // walks along the long water
  patch('hGravel', -19, -346, 19, -340, 0.07);                                    // and round its head
  disc('hGravel', 0, -347, 10, 0.07);                                            // the round at its head, where the rides part
  HALL_RIDES.forEach(([a, b, c, d]) => drapeStrip(gb, 'hGravel', resampleEven([hallW(a, b), hallW(c, d)], 6), 3.2, { lift: 0.08 }));                                  // the middle ride's path to the obelisk
  HALL_RIDES.forEach(([a, b, c, d]) => drapeStrip(gb, 'hLawn', resampleEven([hallW(a, b), hallW(c, d)], 6), 10, { lift: 0.05 }));
  patch('hGravel', 39, 30, 50, 36, 0.07, 4); patch('hGravel', -50, 30, -39, 36, 0.07, 4); // ways through to the courts

  /* ---------------- the house ---------------- */
  frame();
  // a raised basement, a ground floor, a taller principal floor and an attic storey under a steep roof with dormers
  const PL = 1.6, S1 = 6.2, S2 = 11.2, E3 = 15.4, E2 = S2;
  const R3 = [[PL + 1.0, 1.7, 3.1, 'sash'], [S1 + 0.9, 1.7, 3.5, 'sash'], [S2 + 0.9, 1.7, 2.4, 'sashS']], R2 = R3.slice(0, 2), HO = { plinth: PL, pitch: 0.95 };
  const MAIN = { x0: -19, z0: -8, x1: 19, z1: 8 };
  const mrh = range(MAIN.x0, MAIN.z0, MAIN.x1, MAIN.z1, E3, { ...HO, strings: [S1, S2] });
  for (const f of ['s', 'n']) { wins(MAIN, f, 0.8, 11.8, R3, null, 3.6); wins(MAIN, f, 26.2, 37.2, R3, null, 3.6); }
  // the centrepieces, front and garden: three bays standing forward under a pediment, the door in the middle up a flight of steps
  for (const sg of [1, -1]) {
    const z0 = sg > 0 ? 8 : -10, z1 = sg > 0 ? 10 : -8, zf = sg > 0 ? 10 : -10, CP = { x0: -7, z0, x1: 7, z1 }, f = sg > 0 ? 's' : 'n';
    const E4 = E3 + 3.7, zb = sg * 8.7 * (1 - 3.7 / mrh) - sg * 0.6; // (the attic runs back to where it meets the main roof)
    gb.box(-7.15, -1.8, z0 - 0.15, 7.15, PL, z1 + 0.15, SL, 3, 3); gb.box(-7, PL, z0, 7, E4, z1, { side: 'brick', top: null }, 2.4, 2.4); gb.box(-7, E3 - 0.2, Math.min(zb, z0), 7, E4, Math.max(zb, z0), { side: 'brick', top: null }, 2.4, 2.4);
    for (const qx of [-7.07, 6.1]) gb.box(qx, PL, sg > 0 ? zf - 0.9 : zf - 0.07, qx + 0.97, E4 - 0.6, sg > 0 ? zf + 0.07 : zf + 0.9, 'ashlar', 2, 2, { skip: 'tb' });
    for (const y of [S1, S2, E3 - 0.2]) gb.box(-7.12, y - 0.16, z0 - 0.12, 7.12, y + 0.16, z1 + 0.12, 'ashlar', 3, 3, { skip: 'b' });
    gb.box(-7.55, E4 - 0.7, Math.min(zb, z0) - 0.55, 7.55, E4 + 0.05, Math.max(zb, z1) + 0.55, SL, 3, 3);
    wins(CP, f, 0, 14, [...R3, [E3 + 0.75, 1.7, 2.0, 'sashS']], (k, ri) => k === 1 && ri === 0, 4.6);
    // the pediment and the little roof behind it, running back into the main roof
    const zp = zf + sg * 0.6, ph = 4.3, zc = sg * 8.7 * Math.max(0.02, 1 - (3.7 + ph) / mrh), ze = zb - sg * 0.6;
    gb.tri('ashlar', [-7.9, E4, zp - sg * 0.3], [7.9, E4, zp - sg * 0.3], [0, E4 + ph, zp - sg * 0.3], [-2.5, 0], [2.5, 0], [0, 1.4], [0, 0, sg]);
    gb.quad('sashS', [sg > 0 ? -0.75 : 0.75, E4 + 0.7, zp - sg * 0.26], [sg, 0, 0], [0, 1, 0], 1.5, 1.7, 1, 1, { fixedUV: true });
    gb.quad4('roofSlate', [-8.1, E4 - 0.1, zp], [0, E4 + ph + 0.1, zp], [0, E4 + ph + 0.1, zc], [-8.1, E4 - 0.1, ze], [0, 0], [2.8, 0], [2.8, 2], [0, 0.4], [-1, 1.5, 0]);
    gb.quad4('roofSlate', [8.1, E4 - 0.1, zp], [0, E4 + ph + 0.1, zp], [0, E4 + ph + 0.1, zc], [8.1, E4 - 0.1, ze], [0, 0], [2.8, 0], [2.8, 2], [0, 0.4], [1, 1.5, 0]);
    // the door in its stone frame
    const zd = zf + sg * 0.06;
    gb.box(-2.9, PL, Math.min(zf, zf + sg * 0.12), 2.9, S1 - 0.16, Math.max(zf, zf + sg * 0.12), 'ashlar', 2, 2, { skip: 'tb' }); // the middle bay faced in stone
    gb.tint = [1.9, 1.85, 1.7]; gb.quad('doorB', [sg > 0 ? -1.25 : 1.25, PL, zf + sg * 0.16], [sg, 0, 0], [0, 1, 0], 2.5, 3.6, 1, 1, { fixedUV: true }); gb.tint = null;
    for (const px of [-2.6, 1.7]) { gb.box(px, PL, Math.min(zf, zf + sg * 0.7), px + 0.9, PL + 0.5, Math.max(zf, zf + sg * 0.7), SL, 2, 2); gb.cyl('ashlar', px + 0.45, zf + sg * 0.42, 0.3, PL + 0.5, PL + 3.9, 7, 1, 2); }
    gb.box(-2.8, PL + 3.9, Math.min(zf, zf + sg * 0.8), 2.8, PL + 4.4, Math.max(zf, zf + sg * 0.8), SL, 2, 2);
    gb.tri('ashlar', [-2.8, PL + 4.4, zf + sg * 0.75], [2.8, PL + 4.4, zf + sg * 0.75], [0, PL + 5.6, zf + sg * 0.75], [-0.8, 0], [0.8, 0], [0, 0.4], [0, 0, sg]);
    // the steps: eight slabs, each a step lower and wider than the last
    for (let k = 0; k < 8; k++) { const a = zf + sg * (0.8 + 0.45 * k), b = zf + sg * (0.8 + 0.45 * (k + 1)), hw = 4.2 + 0.35 * k, top = PL - 0.2 * k;
      gb.box(-hw, -1, Math.min(a, b), hw, top, Math.max(a, b), SL, 2, 2, { skip: 'b' }); col(-hw, Math.min(a, b), hw, Math.max(a, b), -1, top); }
    gb.box(-4.2, -1, Math.min(zf, zf + sg * 0.8), 4.2, PL, Math.max(zf, zf + sg * 0.8), SL, 2, 2, { skip: 'b' }); col(-4.2, Math.min(zf, zf + sg * 0.8), 4.2, Math.max(zf, zf + sg * 0.8), -1, PL); // the landing before the door
    col(-7, z0, 7, z1, -2, E4 + 2);
    if (sg > 0) for (const lx of [-2.6, 2.6]) Sites.glows.push([...((p) => [p[0], Y0 + 4.8, p[1]])(hallW(lx, 10.7)), 3]);
    // dormers in the roof, two either side of the pediment
    for (const dx of [-16.4, -13, -9.6, 9.6, 13, 16.4]) { const zs = 8.7 * (1 - 0.7 / mrh), a = sg * (zs - 2.8), b = sg * (zs + 0.05), zlo = Math.min(a, b), zhi = Math.max(a, b);
      gb.box(dx - 0.95, E3 + 0.6, zlo, dx + 0.95, E3 + 2.8, zhi, { side: 'roofSlate', top: null }, 3, 3); gb.quad('sashS', [dx - sg * 0.75, E3 + 0.85, b + sg * 0.04], [sg, 0, 0], [0, 1, 0], 1.5, 1.8, 1, 1, { fixedUV: true });
      hallRoof(gb, 'roofSlate', dx - 1.2, zlo - 0.25, dx + 1.2, zhi + 0.25, E3 + 2.8, 0.95); }
  }
  // the lantern on the roof
  { const y = E3 + mrh - 0.6; gb.box(-3.1, y - 1.2, -3.1, 3.1, y + 1.8, 3.1, SL, 2, 2);
    gb.tint = [1.12, 1.1, 1.04]; gb.cyl('plaster', 0, 0, 2.3, y + 1.8, y + 6.2, 8, 2, 2); gb.tint = null;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 8, ux = Math.sin(a), uz = -Math.cos(a); gb.quad('winB', [Math.cos(a) * 2.17 - ux * 0.55, y + 2.7, Math.sin(a) * 2.17 - uz * 0.55], [ux, 0, uz], [0, 1, 0], 1.1, 2.6, 1, 1, { fixedUV: true }); }
    gb.cyl('ashlar', 0, 0, 2.7, y + 6.2, y + 6.6, 8, 2, 2, { top: 'ashlar' }); gb.cone('roofCopper', 0, 0, 2.65, y + 6.6, 4.4, 8, 2);
    gb.box(-0.07, y + 10.8, -0.07, 0.07, y + 13, 0.07, 'iron', 1, 1); gb.cyl('roofCopper', 0, 0, 0.32, y + 11.6, y + 12.1, 6, 1, 1, { top: 'roofCopper' }); }
  for (const x of [-10, -4.2, 4.2, 10]) chimney(x, 0, E3 + mrh * 0.55, E3 + mrh + 2.8);
  // the wings, and the pavilions that close them and come forward to hold the forecourt
  for (const s of [-1, 1]) {
    const W = s > 0 ? { x0: 19, z0: -6.5, x1: 29, z1: 6.5 } : { x0: -29, z0: -6.5, x1: -19, z1: 6.5 };
    const wrh = range(W.x0, W.z0, W.x1, W.z1, E2, { ...HO, strings: [S1], plain: true, pitch: 0.75 });
    wins(W, 's', 0.4, 9.6, R2, null, 3.2); wins(W, 'n', 0.4, 9.6, R2, null, 3.2); chimney(s * 24, 0, E2 + wrh * 0.5, E2 + wrh + 2.2);
    const P = s > 0 ? { x0: 29, z0: -8, x1: 38, z1: 18 } : { x0: -38, z0: -8, x1: -29, z1: 18 };
    const prh = range(P.x0, P.z0, P.x1, P.z1, E2, { ...HO, strings: [S1], pitch: 0.8 });
    wins(P, 's', 0.9, 8.1, R2, null, 3.6); wins(P, 'n', 0.9, 8.1, R2, null, 3.6); wins(P, s > 0 ? 'e' : 'w', 1, 25, R2, null, 3.5);
    if (s > 0) wins(P, 'w', 15.2, 25.2, R2, null, 3.4); else wins(P, 'e', 0.8, 10.8, R2, null, 3.4);
    chimney(s * 33.5, 12, E2 + prh * 0.5, E2 + prh + 2.2); chimney(s * 33.5, -2, E2 + prh * 0.5, E2 + prh + 2.2);
  }

  /* ---------------- the forecourt: a railed screen with gate piers, walls to either side, a figure on the round of grass ---------------- */
  statue(0, 42, 0);
  for (const s of [-1, 1]) { const a = s > 0 ? 13.5 : -37, b = s > 0 ? 37 : -13.5; for (const [p, q, r, u] of [[a - 0.3, 19.7, b + 0.3, 20], [a - 0.3, 66, b + 0.3, 66.3], [a - 0.3, 20, a, 66], [b, 20, b + 0.3, 66]]) gb.box(p, -0.3, q, r, 0.22, u, SL, 2, 2);
    for (const x of [a + 1.6, b - 1.6]) for (const z of [21.6, 64.4]) yew(x, z, 0.9, 2.8, 0); yew((a + b) / 2, 42, 1.4, 4.0, 0); }
  for (const s of [-1, 1]) {
    const a = s > 0 ? 4.6 : -40, b = s > 0 ? 40 : -4.6;
    gb.box(a, -1, 71.7, b, 0.6, 72.3, SL, 2, 2); col(a, 71.6, b, 72.4, -1, 2.4);
    for (let x = a; x < b - 0.5; x += 5.06) gb.quad('portcullis', [x, 0.6, 72], [1, 0, 0], [0, 1, 0], Math.min(5.06, b - x), 1.75, 1, 1, { fixedUV: true, double: true });
    for (let k = 1; k < 7; k++) pier(s * (4.6 + k * 5.06), 72, 0.8, 2.6);
    pier(s * 4.6, 72, 1.3, 4.2, 0, 'urn');
    wall(s > 0 ? 39.7 : -40.3, 18, s > 0 ? 40.3 : -39.7, 30, 2.6); wall(s > 0 ? 39.7 : -40.3, 36, s > 0 ? 40.3 : -39.7, 72, 2.6);
    pier(s * 40, 30, 0.9, 3.0); pier(s * 40, 36, 0.9, 3.0);
  }

  /* ---------------- the stable court (north side): ranges round a cobbled yard, a clock turret over the long one ---------------- */
  { patch('rCobble', 50, -1, 84, 41, 0.06);
    const L = { x0: 84, z0: -8, x1: 93, z1: 48 }, RS = [[1.7, 1.2, 1.6, 'sashS'], [4.4, 1.2, 1.2, 'sashS']], E = 6.3;
    const lrh = range(L.x0, L.z0, L.x1, L.z1, E, { strings: [3.9], pitch: 0.6 });
    wins(L, 'w', 9, 47, RS, (k, ri) => ri === 0 && k % 2 === 1, 4.2); wins(L, 'e', 2, 54, RS, null, 4.4);
    { const fi = faceInfo(L, 'w'), n = 9, sp = 38 / n; for (let k = 1; k < n; k += 2) { const t = 9 + (k + 0.5) * sp; gb.quad('doorF', [fi.o[0] - 0.05, 1.0, fi.o[2] + t - 1.3], fi.U, [0, 1, 0], 2.6, 2.9, 1, 1, { fixedUV: true }); } }
    { const y = E + lrh - 0.7; gb.box(87, y, 18.5, 90, y + 2.6, 21.5, { side: 'plaster', top: null }, 2, 2); gb.quad('winB', [86.95, y + 0.9, 19.4], [0, 0, 1], [0, 1, 0], 1.2, 1.2, 1, 1, { fixedUV: true }); gb.box(86.8, y + 2.6, 18.3, 90.2, y + 2.85, 21.7, SL, 2, 2); gb.cone('roofCopper', 88.5, 20, 2.0, y + 2.85, 2.6, 8, 2); }
    for (const [z0, z1, f] of [[-8, -1, 's'], [41, 48, 'n']]) { const Rg = { x0: 50, z0, x1: 84, z1 }; range(Rg.x0, Rg.z0, Rg.x1, Rg.z1, 4.4, { plain: true, plinth: 0.6, pitch: 0.6 }); wins(Rg, f, 1, 33, [RS[0]], null, 4.2); wins(Rg, f === 's' ? 'n' : 's', 1, 33, [RS[0]], null, 4.2); }
    wall(49.7, -1, 50.3, 30, 2.6); wall(49.7, 36, 50.3, 41, 2.6); pier(50, 30, 0.9, 3.0); pier(50, 36, 0.9, 3.0);
    gb.box(60.8, -0.3, 19.5, 62.8, 0.5, 20.5, { side: 'stone', top: 'hWater' }, 2, 2); col(60.8, 19.5, 62.8, 20.5, -1, 0.5); // a trough
  }
  /* ---------------- the kitchen garden (south side): beds within a high wall, a gardener's cottage in the corner ---------------- */
  { wall(-93, -8.3, -50, -7.7, 3.0); wall(-93, 47.7, -50, 48.3, 3.0); wall(-93.3, -8, -92.7, 48, 3.0); wall(-50.3, -8, -49.7, 30, 3.0); wall(-50.3, 36, -49.7, 48, 3.0);
    pier(-50, 30, 0.9, 3.3); pier(-50, 36, 0.9, 3.3);
    patch('hGravel', -91, 31.5, -51, 34.5, 0.07, 4); patch('hGravel', -73, -6, -70, 46, 0.07, 4);
    const beds = [[-90, 36.5, -74.5, 45.5, 'fGreens'], [-68.5, 36.5, -52, 45.5, 'fPlowed'], [-90, 12, -74.5, 29.5, 'hBed'], [-68.5, 12, -52, 29.5, 'fGreens']];
    for (const [a, b, c, d, k] of beds) { patch(k, a, b, c, d, 0.06, 4); for (const [p, q, r, t] of [[a - 0.3, b - 0.3, c + 0.3, b], [a - 0.3, d, c + 0.3, d + 0.3], [a - 0.3, b, a, d], [c, b, c + 0.3, d]]) gb.box(p, -0.2, q, r, 0.32, t, 'hedge', 2, 2); }
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) plant('oak' + (i + j) % 3, -66 + i * 4.3, -3.2 + j * 3.6, 0.36); // a quarter of fruit trees
    for (let x = -90; x < -52; x += 4.4) { gb.box(x, -0.2, 47.1, x + 3.2, 2.3, 47.6, 'hedge', 2, 2); gb.box(x, -0.2, -7.6, x + 3.2, 2.3, -7.1, 'hedge', 2, 2); } // fruit trained on the walls
    for (let k = 0; k < 4; k++) { const x = -89 + k * 3.6; gb.box(x, -0.2, 2, x + 3, 0.5, 4.4, { side: 'wood', top: 'winB' }, 1.5, 1.5); col(x, 2, x + 3, 4.4, -1, 0.5); } // glazed frames
    gb.cyl('ashlar', -71.5, 33, 1.9, -0.4, 0.45, 12, 2, 2, { top: 'hWater' }); col(-73.2, 31.3, -69.8, 34.7, -1, 0.45); // a dipping pond where the paths cross
    for (const [a, b, c, d] of [[-90, 36.5, -74.5, 45.5], [-68.5, 12, -52, 29.5]]) for (let x = a + 1.2; x < c - 0.6; x += 2.1) for (let z = b + 1.2; z < d - 0.6; z += 2.2) plant('bush', x, z, 0.32); // cabbages in rows
    gb.setXf(...hallW(-82, 1.5), HALL.ang + Math.PI / 2, Y0); makeBuilding(area, gb, new RNG(7611), { fp: { x0: -4.5, z0: -3.4, x1: 4.5, z1: 3.4 }, stories: 1, style: 'brick', roof: 'gable', roofKey: 'roofSlate', doorT: 0.5, found: 0.6, chimney: 1 }); frame();
  }

  /* ---------------- the gate: two lodges, piers and railings on the road ---------------- */
  { const gz = HALL.gate, yg = gy(0, gz) - Y0; frame(0, gz, 0, Y0 + yg);
    for (const s of [-1, 1]) {
      const Lg = s > 0 ? { x0: 8, z0: -3.2, x1: 14.4, z1: 3.2 } : { x0: -14.4, z0: -3.2, x1: -8, z1: 3.2 };
      range(Lg.x0, Lg.z0, Lg.x1, Lg.z1, 4.6, { plinth: 0.6, pitch: 0.9 }); wins(Lg, 's', 0.8, 5.6, [[1.5, 1.2, 2.0, 'sashS']], null, 5); wins(Lg, 'n', 0.8, 5.6, [[1.5, 1.2, 2.0, 'sashS']], null, 5);
      gb.quad('doorC', [s > 0 ? 7.95 : -7.95, 0.6, s > 0 ? -0.7 : 0.7], [0, 0, s], [0, 1, 0], 1.4, 2.4, 1, 1, { fixedUV: true }); // its door to the drive
      chimney(s * 11.2, 0, 6.5, 9.4);
      pier(s * 3.9, 3.2, 1.3, 4.4, 0, 'urn'); pier(s * 8, 3.2, 0.9, 3.0);
      gb.box(s > 0 ? 4.5 : -7.6, -1, 2.95, s > 0 ? 7.6 : -4.5, 0.6, 3.45, SL, 2, 2); col(s > 0 ? 4.5 : -7.6, 2.9, s > 0 ? 7.6 : -4.5, 3.5, -1, 2.4);
      gb.quad('portcullis', [s > 0 ? 4.5 : -7.6, 0.6, 3.2], [1, 0, 0], [0, 1, 0], 3.1, 1.75, 1, 1, { fixedUV: true, double: true });
      wall(s > 0 ? 14.4 : -34, 2.9, s > 0 ? 34 : -14.4, 3.5, 1.5); pier(s * 34, 3.2, 0.9, 2.2);
      Sites.glows.push([...((p) => [p[0], Y0 + yg + 5.4, p[1]])(hallW(s * 3.9, gz + 3.2)), 3.4]);
    }
    frame(); }

  /* ---------------- the avenue: a double row of trees either side of the drive; old oaks standing about the park; sheep ---------------- */
  for (let lz = 84; lz <= HALL.gate - 8; lz += 10) for (const lx of [-17.5, -8, 8, 17.5]) plant('oak1', lx, lz, 1.08);
  { const cl = []; for (let q = 0; q < 300 && cl.length < 9; q++) { const lx = rng.range(60, 250) * (cl.length % 2 ? 1 : -1), lz = rng.range(110, 440); if (cl.some(([a, b]) => Math.hypot(a - lx, b - lz) < 75)) continue; cl.push([lx, lz]);
      const n = rng.int(4, 7); for (let k = 0; k < n; k++) { const a = rng.range(0, 6.283), r = rng.range(3, 17); plant('oak' + rng.int(0, 2), lx + Math.cos(a) * r, lz + Math.sin(a) * r, rng.range(1.0, 1.4)); }
      if (cl.length % 2) for (let k = 0; k < 5; k++) plant('sheep', lx + rng.range(-26, 26), lz + rng.range(18, 34), rng.range(0.9, 1.1)); }
    for (let q = 0; q < 14; q++) { const lx = rng.range(40, 260) * (q % 2 ? 1 : -1), lz = rng.range(95, 465); if (!cl.some(([a, b]) => Math.hypot(a - lx, b - lz) < 30)) plant('oak' + rng.int(0, 2), lx, lz, rng.range(1.15, 1.45)); } }

  for (const s of [-1, 1]) { for (let z = -20; z <= 60; z += 10) { plant('oak2', s * 104, z, 1.1); plant('oak0', s * 114, z + 5, 1.15); } for (let x = 60; x <= 95; x += 11) plant('oak2', s * x, 60, 1.1); } // rows of trees behind the courts, to frame the house

  /* ---------------- the terrace: a balustrade above the bank, steps down to the gardens ---------------- */
  for (const s of [-1, 1]) {
    const a = s > 0 ? 5.5 : -40, b = s > 0 ? 40 : -5.5;
    gb.box(a, -1.6, -25.5, b, 0.14, -25, SL, 2, 2); gb.quad('balus', [a, 0.14, -25.25], [1, 0, 0], [0, 1, 0], b - a, 0.72, 0.42, 0.72, { double: true, v0: 0 }); gb.box(a - 0.05, 0.86, -25.5, b + 0.05, 1.0, -25, SL, 2, 2); col(a, -25.5, b, -25, -2, 0.95);
    for (const x of [12, 26]) { gb.box(s * x - 0.55, 0, -23.6, s * x + 0.55, 0.7, -22.5, { side: 'wood', top: 'dirt' }, 1, 1); gb.cone('hedge', s * x, -23.05, 0.6, 0.7, 1.9, 7, 2); col(s * x - 0.55, -23.6, s * x + 0.55, -22.5, -1, 2); }
    for (let k = 0; k <= 5; k++) { const x = s * (5.5 + k * 6.9); gb.box(x - 0.35, -1.6, -25.6, x + 0.35, 1.1, -24.9, SL, 2, 2); if (k === 0 || k === 5) urn(x, -25.25, 1.1, 0.9); }
  }
  for (let k = 0; k < 7; k++) { const z1 = -25 - k * 0.86, z0 = z1 - 0.86, top = -0.2 * k; gb.box(-5.5, top - 2.2, z0, 5.5, top, z1, SL, 2, 2, { skip: 'b' }); col(-5.5, z0, 5.5, z1, top - 2.2, top); }
  for (const s of [-1, 1]) { gb.box(s > 0 ? 5.5 : -6.4, -3, -31.4, s > 0 ? 6.4 : -5.5, 0.3, -25, SL, 2, 2, { skip: 'b' }); col(s > 0 ? 5.5 : -6.4, -31.4, s > 0 ? 6.4 : -5.5, -25, -3, 0.3); urn(s * 5.95, -30.9, 0.3, 0.9); }

  /* ---------------- the parterre: four quarters of embroidery in clipped box and coloured earth round a fountain ---------------- */
  const PW = 42; // its half-width: about that of the house and its terrace
  for (const sx of [-1, 1]) for (const [za, zb] of [[-64, -40], [-114, -90]]) {
    const x0 = sx > 0 ? 5 : -PW, x1 = sx > 0 ? PW : -5, t = 0.8, cx = (x0 + x1) / 2, cz = (za + zb) / 2, hx = (x1 - x0) / 2 - t, hz = (zb - za) / 2 - t;
    hedge(x0, za, x1, za + t, 0.6); hedge(x0, zb - t, x1, zb, 0.6); hedge(x0, za + t, x0 + t, zb - t, 0.6); hedge(x1 - t, za + t, x1, zb - t, 0.6);
    // the pattern itself, laid on the ground: scrolls of box on sand and brick dust, mirrored about both walks
    gb.quad('hBrod', [x0 + t, GL + 0.1, zb - t], [1, 0, 0], [0, 0, -1], 2 * hx, 2 * hz, 1, 1, { fixedUV: true, flipU: sx < 0, v0: 0 });
    // and standing up from it: the lozenge and the inner border in low clipped box, a yew in the middle bed and at each point
    const lz2 = hz * 0.57, lx2 = hx * 0.49;
    for (const [ax, az, bx, bz] of [[cx - lx2, cz, cx, cz - lz2], [cx, cz - lz2, cx + lx2, cz], [cx + lx2, cz, cx, cz + lz2], [cx, cz + lz2, cx - lx2, cz]]) { const L = Math.hypot(bx - ax, bz - az), rot = Math.atan2(bx - ax, bz - az); frame((ax + bx) / 2, (az + bz) / 2, rot); gb.box(-0.3, GL - 0.2, -L / 2, 0.3, GL + 0.42, L / 2, 'hedge', 2, 2); }
    frame();
    const bi = 2.3; for (const [p, q, r, u] of [[x0 + t + bi, za + t + bi, x1 - t - bi, za + t + bi + 0.5], [x0 + t + bi, zb - t - bi - 0.5, x1 - t - bi, zb - t - bi], [x0 + t + bi, za + t + bi, x0 + t + bi + 0.5, zb - t - bi], [x1 - t - bi - 0.5, za + t + bi, x1 - t - bi, zb - t - bi]]) gb.box(p, GL - 0.2, q, r, GL + 0.42, u, 'hedge', 2, 2);
    gb.cyl('hedge', cx, cz, 2.6, GL - 0.2, GL + 0.42, 12, 2, 2, { top: 'hBedTop' });
    yew(cx, cz, 1.0, 2.8); for (const px of [cx - lx2, cx + lx2]) yew(px, cz, 0.55, 1.6);
    for (const [px, pz] of [[x0, za], [x1, za], [x0, zb], [x1, zb]]) yew(px + (px === x0 ? 0.4 : -0.4), pz + (pz === za ? 0.4 : -0.4), 0.8, 2.1);
    for (let x = x0 + 7.4; x < x1 - 4; x += 7.4) for (const z of [za + 0.4, zb - 0.4]) yew(x, z, 0.5, 1.5);
    // flowers in the border between the two lines of box
    const fr = new RNG(7700 + (sx > 0 ? 0 : 1) + (za > -80 ? 0 : 2));
    for (let q = 0; q < 70; q++) { const side = q % 4, u = fr.next(), w = t + 0.5 + fr.next() * (bi - 0.9); const lx = side < 2 ? lerp(x0 + 2, x1 - 2, u) : side === 2 ? x0 + w : x1 - w, lz = side === 0 ? za + w : side === 1 ? zb - w : lerp(za + 2, zb - 2, u); plant('flowers' + fr.int(0, 3), lx, lz, fr.range(1.0, 1.5)); }
  }
  // grass plats in the cross walk, edged with stone, a figure on each and an urn at its inner end
  for (const s of [-1, 1]) { const a = s > 0 ? 16 : -PW, b = s > 0 ? PW : -16;
    patch('hLawn2', a, -83, b, -71, 0.08, 6);
    for (const [p, q, r, u] of [[a - 0.3, -83.3, b + 0.3, -83], [a - 0.3, -71, b + 0.3, -70.7], [a - 0.3, -83, a, -71], [b, -83, b + 0.3, -71]]) gb.box(p, GL - 0.3, q, r, GL + 0.22, u, SL, 2, 2);
    frame(s * 29, -77, s > 0 ? -Math.PI / 2 : Math.PI / 2, Y0 + GL); statue(0, 0, 0); frame();
    for (const x of [18.5, 39.5]) { frame(s * x, -77, 0, Y0 + GL); gb.box(-0.45, -0.4, -0.45, 0.45, 0.9, 0.45, SL, 2, 2); urn(0, 0, 0.9, 1.1); col(-0.45, -0.45, 0.45, 0.45, -1, 2.2); frame(); } }
  for (const [px, pz] of [[-45, -37], [45, -37], [-45, -117], [45, -117]]) { frame(px, pz, px > 0 ? -Math.PI / 2 : Math.PI / 2, Y0 + GL); statue(0, 0, 0); }
  frame();
  // the fountain: a broad basin, two bowls and a jet
  { const fz = -77; gb.cyl('ashlar', 0, fz, 7.6, GL - 0.5, GL + 0.6, 20, 2, 2, { top: 'ashlar' }); gb.disc('hWater', 0, GL + 0.66, fz, 6.9, 20, 5);
    gb.cyl('ashlar', 0, fz, 1.2, GL, GL + 1.5, 8, 2, 2); gb.cone('ashlar', 0, fz, 1.2, GL + 1.5, 0.9, 8, 2); gb.cyl('ashlar', 0, fz, 0.5, GL + 1.5, GL + 2.5, 6, 2, 2);
    gb.cyl('ashlar', 0, fz, 3.0, GL + 2.5, GL + 2.85, 14, 2, 2, { top: 'hWater' }); gb.cyl('ashlar', 0, fz, 0.42, GL + 2.85, GL + 4.3, 6, 2, 2); gb.cyl('ashlar', 0, fz, 1.5, GL + 4.3, GL + 4.6, 10, 2, 2, { top: 'hWater' });
    gb.tint = [1.5, 1.56, 1.6]; gb.cone('plaster', 0, fz, 0.6, GL + 4.6, 1.9, 6, 1); gb.tint = null;
    col(-6.6, fz - 6.6, 6.6, fz + 6.6, GL - 1, GL + 0.6); col(-1.6, fz - 1.6, 1.6, fz + 1.6, GL - 1, GL + 5); }
  // tall clipped hedges close the gardens on either side, in lengths with gaps to the park
  for (const s of [-1, 1]) for (let z = -36; z > -330; z -= 50) hedge(s > 0 ? 49.2 : -50.8, Math.max(z - 45, -338), s > 0 ? 50.8 : -49.2, z, 2.7);

  /* ---------------- the long water: a stone-edged basin, walks and rows of trees beside it, yews at measured intervals ---------------- */
  { const z0 = -338, z1 = -130, hw = 10;
    gb.quad('hWater', [-hw + 0.3, GL + 0.22, z1 - 0.3], [1, 0, 0], [0, 0, -1], 2 * hw - 0.6, z1 - z0 - 0.6, 6, 6);
    for (const [a, b, c, d] of [[-hw - 0.5, z0 - 0.5, -hw + 0.5, z1 + 0.5], [hw - 0.5, z0 - 0.5, hw + 0.5, z1 + 0.5], [-hw + 0.5, z0 - 0.5, hw - 0.5, z0 + 0.5], [-hw + 0.5, z1 - 0.5, hw - 0.5, z1 + 0.5]]) { gb.box(a, GL - 1, b, c, GL + 0.4, d, SL, 2, 2, { skip: 'b' }); col(a, b, c, d, GL - 1, GL + 0.4); }
    for (const s of [-1, 1]) { for (const z of [z0 - 0.2, z1 + 0.2]) { frame(s * (hw + 0.2), z, 0, Y0 + GL); urn(0, 0, 0.4, 1.0); frame(); }
      for (let z = -140; z >= -334; z -= 10.8) { plant('oak1', s * 29, z, 1.0); plant('oak1', s * 39, z, 1.0); }
      for (let z = -150; z >= -330; z -= 27) yew(s * 21.5, z, 1.0, 3.0);
      for (let z = -136; z >= -332; z -= 27) { frame(s * 12.6, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, Y0 + GL); gb.box(-0.9, -0.3, -0.3, 0.9, 0.45, 0.3, SL, 2, 2); col(-0.9, -0.3, 0.9, 0.3, -1, 0.45); frame(); } } // stone seats
  }

  /* ---------------- the rides and the obelisk ---------------- */
  HALL_RIDES.forEach(([a, b, c, d], ri) => { const L = Math.hypot(c - a, d - b), ux = (c - a) / L, uz = (d - b) / L;
    for (let t = 22; t < L - 4; t += 10) for (const s of [-1, 1]) { const lx = a + ux * t - uz * 7.6 * s, lz = b + uz * t + ux * 7.6 * s; if (HALL_RIDES.some((R, k) => k !== ri && segDist(lx, lz, R[0], R[1], R[2], R[3]).d < 8)) continue; plant('oak0', lx, lz, 0.9); }
    // each side ride ends at a little round temple: six columns under a copper dome
    if (ri) { const y = gy(c, d) - Y0, K = 1.5; frame(c, d, 0, Y0 + y); gb.cyl('ashlar', 0, 0, 4.4 * K, -1.2, 0.35, 14, 2, 2, { top: 'ashlar' }); gb.cyl('ashlar', 0, 0, 3.8 * K, 0.35, 0.7, 14, 2, 2, { top: 'ashlar' });
      for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4 + Math.PI / 8, px = Math.cos(an) * 3.1 * K, pz = Math.sin(an) * 3.1 * K; gb.cyl('ashlar', px, pz, 0.42, 0.7, 6.6, 6, 1, 2); col(px - 0.45, pz - 0.45, px + 0.45, pz + 0.45, 0, 6.6); }
      gb.cyl('ashlar', 0, 0, 3.7 * K, 6.6, 7.5, 14, 2, 2); gb.disc('ashlar', 0, 6.6, 0, 3.7 * K, 14, 2); gb.cone('roofCopper', 0, 0, 3.9 * K, 7.5, 4.4, 14, 2); statue(0, 0, 0.7);
      col(-4.4 * K, -4.4 * K, 4.4 * K, 4.4 * K, -1.2, 0.35); col(-3.8 * K, -3.8 * K, 3.8 * K, 3.8 * K, -1.2, 0.7); frame(); } });
  { const oz = HALL.ob, y = gy(0, oz) - Y0 - 0.2; frame(0, oz, 0, Y0 + y); gb.tint = [1.08, 1.06, 1.0];
    gb.box(-4.6, -1.5, -4.6, 4.6, 0.6, 4.6, SL, 2, 2); gb.box(-3.5, 0.6, -3.5, 3.5, 1.2, 3.5, SL, 2, 2); gb.box(-2.4, 1.2, -2.4, 2.4, 5.0, 2.4, SL, 2, 2); gb.box(-2.75, 5.0, -2.75, 2.75, 5.45, 2.75, SL, 2, 2);
    const b = 1.95, t = 1.1, y0 = 5.45, y1 = 30, ya = 33, C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    for (let k = 0; k < 4; k++) { const [ax, az] = C[k], [bx, bz] = C[(k + 1) % 4], hint = [(ax + bx) / 2, 0.05, (az + bz) / 2];
      gb.quad4('ashlar', [ax * b, y0, az * b], [bx * b, y0, bz * b], [bx * t, y1, bz * t], [ax * t, y1, az * t], [0, 0], [1.6, 0], [1.25, 10], [0.35, 10], hint);
      gb.tri('ashlar', [ax * t, y1, az * t], [bx * t, y1, bz * t], [0, ya, 0], [0, 0], [0.9, 0], [0.45, 1.2], [hint[0], 0.6, hint[2]]); }
    gb.tint = null; col(-4.6, -4.6, 4.6, 4.6, -2, 0.6); col(-3.5, -3.5, 3.5, 3.5, -2, 1.2); col(-2.4, -2.4, 2.4, 2.4, -2, 30); frame(); }

  gb.xf = null; gb.light = savedLight;
  // the household, about their work by day
  const P = (lx, lz) => hallW(lx, lz);
  S.folk = [
    { at: P(5.5, HALL.gate - 6), r: 3, trade: 'Gatekeeper of Halewood', look: { hat: '#2a2a2e', shirt: '#3a3a44', pants: '#2a2a2e' }, lines: ['"The family is in town for the season. You may walk the avenue, so long as you keep off the lawns."', '"Four hundred paces from this gate to the door. I have counted them more often than I care to say."', '"Carriages for Corrinvale leave by this road. On foot it is the better part of an hour."'] },
    { at: P(30, -78), r: 9, trade: 'Gardener at Halewood', look: { apron: '#5a6a3a', hat: '#a08a52' }, lines: ['"Every yew is clipped twice a year, and each must match its twin across the walk."', '"Mind the box hedges. They are older than I am, and better thought of."', '"The fountain plays on feast days. The rest of the year it sulks."'] },
    { at: P(-16, -230), r: 8, trade: 'Gardener at Halewood', look: { apron: '#5a6a3a', hat: '#6a5a3a' }, lines: ['"The long water was dug in a single summer. I carried my share of it in a barrow."', '"Stand at the far end and the house sits on the water like a picture. That is what it was dug for."', '"The obelisk? It marks nothing at all. It is there to be looked at."'] },
    { at: P(66, 22), r: 7, trade: 'Groom at Halewood', look: { shirt: '#7a6a50', pants: '#3a2e24' }, lines: ['"Twelve stalls, and the best of them stand empty while the family is away."', '"The grey kicks. The bay bites. The rest are merely unfriendly."'] },
    { at: P(-72, 20), r: 6, trade: 'Kitchen gardener at Halewood', look: { apron: '#c8c0a8' }, lines: ['"Leeks, cabbages, and more beans than any household could eat. They ask for flowers."', '"The wall keeps the wind off and the rabbits out. Mostly the wind."'] },
  ];
};
