/* =====================================================================
   Sites: the great landmarks of the country. Their ground, their plants
   and their buildings are fixed, the same in every world (?seed=N only
   changes the country between them). Round each one the generated land
   blends into the fixed ground over some hundreds of metres, along a
   ragged line, so nothing marks where one ends and the other begins.
   Each is joined to the tracks by a road of its own.
   ===================================================================== */

// rc: wholly fixed within this radius; rb: wholly generated beyond it. road: from the site out to where the generated tracks take over
const SITES = [
  { id: 'greywatch', name: 'Greywatch', kind: 'ruin', x: -2400, z: -2900, rc: 280, rb: 820, discR: 240, bare: 110,
    blurb: 'the broken keep of Greywatch on its crag, abandoned since the War of Betony',
    road: [[26, 26], [52, 50], [92, 82], [140, 112], [196, 140], [262, 168], [330, 202], [400, 246], [470, 300], [540, 360]] },
  { id: 'stones', name: 'the Ninefold Stones', kind: 'stones', x: 3600, z: -5600, rc: 300, rb: 860, discR: 200, bare: 260,
    blurb: 'a ring of nine standing stones on a bare hilltop, older than any kingdom of the Bay',
    road: [[-14, 18], [-40, 52], [-80, 92], [-130, 128], [-196, 160], [-270, 196], [-344, 240], [-420, 290], [-500, 344]] },
  { id: 'mirrormere', name: 'Mirrormere', kind: 'hamlet', x: -4600, z: -8200, rc: 560, rb: 1050, discR: 330, wl: 96,
    blurb: 'a fishing hamlet on the shore of a still mountain lake',
    road: [[280, 0], [318, 22], [350, 58], [372, 104], [396, 158], [430, 214], [474, 268], [530, 322], [596, 372], [670, 420]] },
  { id: 'kestrel', name: 'Kestrel Tower', kind: 'tower', x: 1400, z: -11800, rc: 420, rb: 1100, discR: 260,
    blurb: 'a lonely watchtower that keeps the high pass between two peaks',
    road: [[14, 20], [8, 70], [-6, 130], [-14, 200], [-6, 280], [12, 360], [24, 440], [20, 530], [4, 620], [-10, 720], [-4, 820]] },
  { id: 'gullscar', name: 'Gullscar Light', kind: 'light', x: 5400, z: 430, rc: 330, rb: 1100, discR: 260,
    blurb: 'the lighthouse on the Gullscar headland, which guides ships into the eastern bay',
    road: [[0, 130], [-10, 90], [-22, 50], [-40, 4], [-62, -50], [-80, -110], [-92, -180], [-96, -260], [-90, -340], [-70, -420]] },
];
for (const S of SITES) S.road = S.road.map(([x, z]) => [S.x + x, S.z + z]);

// the distance to a site's centre, warped so its edge is not a circle (fixed noise: the same in every world)
function siteDist(S, x, z) { const dx = x - S.x, dz = z - S.z, r = Math.hypot(dx, dz); if (r > S.rb + 260) return r; return r + 0.16 * S.rb * fbm(x / (S.rb * 0.6) + 31.7, z / (S.rb * 0.6), 2, 940 + S.x % 7); }
function siteW(S, x, z) { if (Math.abs(x - S.x) > S.rb + 260 || Math.abs(z - S.z) > S.rb + 260) return 0; return 1 - smoothstep(S.rc, S.rb, siteDist(S, x, z)); }
// the site a point lies in (or nearest to), with how far its fixed ground holds there (0..1)
function siteAt(x, z) { let best = null, bw = 0; for (const S of SITES) { const w = siteW(S, x, z); if (w > bw) { bw = w; best = S; } } return best ? { S: best, w: bw } : null; }
function siteWeight(x, z) { let w = 0; for (const S of SITES) w = Math.max(w, siteW(S, x, z)); return w; }
// rivers are not planned through a site or the land blending into it
function siteZone(x, z, m = 0) { for (const S of SITES) if (Math.abs(x - S.x) < S.rb + m + 260 && Math.abs(z - S.z) < S.rb + m + 260 && siteDist(S, x, z) < S.rb + m) return true; return false; }

/* ---------------- the fixed ground ---------------- */
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d); };
// Greywatch: a crag with cliffs on three sides and a long slope on the fourth (south-east), where the road climbs; rolling ground round it
function greywatchH(x, z) {
  const S = SITES[0], dx = x - S.x, dz = z - S.z, H0 = 46;
  const gentle = smoothstep(1.05, 0.25, angDiff(Math.atan2(dz, dx), Math.PI / 4));
  const r = Math.hypot(dx, dz) + 7 * fbm(x / 40, z / 40, 2, 901), re = r / lerp(1, 4.2, gentle);
  const t = clamp((re - 44) / 95, 0, 1), prof = 1 - smoothstep(0, 1, Math.pow(t, lerp(0.42, 0.9, gentle))); // sheer near the top on three sides, a long even ramp on the fourth
  let h = H0 + 54 * prof + 1.4 * fbm(x / 16, z / 16, 2, 902) * prof;
  h += (1 - 0.8 * prof) * (7 * fbm(x / 210, z / 210, 3, 903) + 2.5 * fbm(x / 55, z / 55, 2, 904));
  h -= 10 * smoothstep(260, 560, r) * smoothstep(-0.1, 0.5, fbm(x / 300 + 4, z / 300, 2, 906)); // a hollow or two in the land round about
  return h;
}
// the Ninefold Stones: a broad bare dome with a level crown
function stonesH(x, z) {
  const S = SITES[1], dx = x - S.x, dz = z - S.z, r = Math.hypot(dx, dz) + 10 * fbm(x / 80, z / 80, 2, 911), H0 = 70;
  const dome = Math.exp(-Math.pow(r / 240, 2)), crown = 1 - smoothstep(18, 40, r);
  return H0 + 58 * dome + crown * 0.3 * (1 - dome) + (1 - crown) * (5 * fbm(x / 170, z / 170, 3, 912) + 1.6 * fbm(x / 40, z / 40, 2, 913));
}
// Mirrormere: a lake in a bowl of hills, open to the south-east where its outflow would run; the hamlet on a terrace on the east shore
const MERE = { wl: 96 };
function mereR(x, z) { const S = SITES[2], a = Math.atan2(z - S.z, x - S.x); return 128 + 30 * fbm(Math.cos(a) * 1.4 + 5, Math.sin(a) * 1.4, 2, 921); }
function mirrormereH(x, z) {
  const S = SITES[2], dx = x - S.x, dz = z - S.z, r = Math.hypot(dx, dz), R = mereR(x, z), WL = MERE.wl;
  if (r < R) return WL - 0.35 - Math.min(4.2, (R - r) * 0.075);
  const a = Math.atan2(dz, dx), gap = smoothstep(0.75, 0.2, angDiff(a, 0.62)); // the bowl opens to the south-east
  let h = WL + 0.25 + Math.min(6, (r - R) * 0.055) + 2.2 * fbm(x / 60, z / 60, 2, 922) * smoothstep(R, R + 40, r);
  h += (62 * smoothstep(240, 560, r) + 20 * smoothstep(560, 900, r)) * (0.55 + 0.45 * fbm(x / 240, z / 240, 3, 923)) * (1 - 0.85 * gap);
  // the hamlet's terrace: level ground on the east shore
  const tx = Math.max(0, Math.abs(dx - 220) - 80), tz = Math.max(0, Math.abs(dz) - 75), td = Math.hypot(tx, tz);
  return lerp(h, WL + 3.2, 1 - smoothstep(0, 45, td));
}
// Kestrel Tower: a saddle between two peaks; the pass runs north and south, the tower stands at its crest
function kestrelH(x, z) {
  const S = SITES[3], dx = x - S.x, dz = z - S.z, H0 = 232;
  const pk = Math.exp(-Math.pow((Math.abs(dx) - 380) / 210, 2)), wall = smoothstep(60, 260, Math.abs(dx));
  let h = H0 + 200 * pk * (0.7 + 0.45 * ridgedMF(x / 260, z / 260, 4, 931)) + 70 * wall * (1 - pk) * (0.6 + 0.5 * fbm(x / 200, z / 200, 2, 932));
  h -= 55 * smoothstep(90, 900, Math.abs(dz)) * (1 - 0.7 * pk); // the pass falls away to north and south
  h += 7 * Math.exp(-((dx + 24) ** 2 + (dz - 6) ** 2) / (30 * 30)); // the knoll the tower stands on
  h += 3 * fbm(x / 50, z / 50, 2, 933) - 2 * (1 - smoothstep(0, 40, Math.abs(dx + 4 * fbm(z / 90, 1.3, 2, 934)))); // the road worn a little into its floor
  return h;
}
// Gullscar: a headland of sheer cliffs pushing south into the bay; the coast itself is fixed for some way either side
const GULL = { x: 5400 };
function gullCoast(x) { return 360 + 240 * Math.exp(-Math.pow((x - GULL.x) / 190, 2)) + 14 * fbm(x / 70, 4.4, 2, 941) + 40 * fbm(x / 600, 2.2, 2, 942); }
function siteCoast(x, z) { const w = 1 - smoothstep(650, 1600, Math.abs(x - GULL.x)); return w > 0 ? lerp(z, gullCoast(x), w) : z; }
function gullscarH(x, z) {
  const d = gullCoast(x) - z;
  if (d < 0) return SEA - 0.3 - Math.min(9, -d * 0.09);
  return SEA + 0.3 + 36 * smoothstep(0, 18, d) + 0.025 * Math.max(0, d - 16) + 3.5 * fbm(x / 90, z / 90, 2, 943) * smoothstep(8, 40, d);
}
const SITE_H = { greywatch: greywatchH, stones: stonesH, mirrormere: mirrormereH, kestrel: kestrelH, gullscar: gullscarH };
// the ground with the sites laid in: their fixed shape where they hold, blended into whatever lies round them
function siteFix(x, z, h) {
  for (const S of SITES) { const w = siteW(S, x, z); if (w > 0) return lerp(h, SITE_H[S.id](x, z), w); }
  return h;
}

/* ---------------- what grows there: woods (0..1) and heath (0..1), fixed ---------------- */
function siteForest(S, x, z, h) {
  const dx = x - S.x, dz = z - S.z, n = fbm(x / 150, z / 150, 2, 950), n2 = fbm(x / 60, z / 60, 2, 951), r = Math.hypot(dx, dz) + 70 * fbm(x / 120 + 3, z / 120, 2, 952); // (a ragged radius: no wood edge runs round a site in a circle)
  switch (S.id) {
    case 'greywatch': return smoothstep(0.0, 0.3, n + 0.15 * n2) * smoothstep(150, 240, r) * smoothstep(40, -160, dz + dx * 0.4); // an oakwood under the north cliffs
    case 'stones': return 0;
    case 'mirrormere': { const tr = Math.max(0, Math.abs(dx - 260) - 150), tz = Math.max(0, Math.abs(dz) - 130); return smoothstep(-0.05, 0.25, n + 0.2 * n2) * smoothstep(170, 260, r) * smoothstep(20, 80, Math.hypot(tr, tz)); } // pinewoods on the hills round the lake, the hamlet's fields kept clear
    case 'kestrel': return smoothstep(0.1, 0.4, n) * (1 - smoothstep(250, 300, h)) * smoothstep(60, 140, Math.abs(dx));
    case 'gullscar': return 0;
  }
  return 0;
}
function siteHeath(S, x, z, h) {
  const r = Math.hypot(x - S.x, z - S.z), n = fbm(x / 90, z / 90, 2, 955);
  switch (S.id) {
    case 'greywatch': return 0.6 * smoothstep(0.0, 0.3, n) * (1 - smoothstep(60, 140, r));
    case 'stones': return smoothstep(-0.15, 0.2, n) * (1 - smoothstep(30, 60, -r + 60)) * (1 - smoothstep(500, 700, r)) + 0.0;
    case 'mirrormere': return 0.5 * smoothstep(0.05, 0.35, n) * smoothstep(300, 450, r);
    case 'kestrel': return 0.7 * smoothstep(-0.1, 0.25, n);
    case 'gullscar': return 0.55 * smoothstep(-0.05, 0.3, n) * smoothstep(30, 80, gullCoast(x) - z);
  }
  return 0;
}

/* ---------------- the buildings, built once and kept: each can be seen from far off ---------------- */
const Sites = {
  group: null, cols: [], glows: [], spawned: {}, lights: [],
  build(area, mats) {
    const gb = new GB(), saved = area.colliders; area.colliders = [];
    const H = (x, z) => terrainRaw(x, z);
    for (const S of SITES) SITE_BUILD[S.id](gb, S, H, area);
    this.cols = area.colliders; area.colliders = saved;
    const G2 = area.grid; for (const col of this.cols) for (let ix = Math.floor(col.x0 / CELL); ix <= Math.floor(col.x1 / CELL); ix++) for (let iz = Math.floor(col.z0 / CELL); iz <= Math.floor(col.z1 / CELL); iz++) { const k = ix * 10007 + iz; let l = G2.get(k); if (!l) G2.set(k, l = []); l.push(col); }
    this.group = gb.build(mats); this.group.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); area.scene.add(this.group);
    for (const S of SITES) for (const [fx, fy, fz, fa] of S.flags || []) makeFlag(area, TEX.bannerRed, fx, fy, fz, fa, 2.4, 1.4);
    if (this.glows.length) { const b = new SpriteBatch(area, TEX.glow, 3.2, 3.2, this.glows, { additive: true, lit: false, fog: false }); this.glowMat = b.mat; }
  },
  // true where a site keeps the ground clear: its solids (for any plant), its yards and courts (for trees and bushes)
  clearAt(x, z, r) {
    for (const c of this.near(x, z)) if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true;
    if (r >= 2) for (const S of SITES) if (S.clear && Math.abs(x - S.x) < 400 && Math.abs(z - S.z) < 400) for (const [cx, cz, cr] of S.clear) if (Math.hypot(x - cx, z - cz) < cr) return true;
    return false;
  },
  near(x, z) { if (!this.hash) { this.hash = new SHash(32); for (const c of this.cols) this.hash.add(c, [c.x0, c.z0, c.x1, c.z1]); } return this.hash.query(x - 6, z - 6, x + 6, z + 6); },
  // the player comes within sight of a site: it goes on the map
  update(x, z) {
    if (!G.player || G.area !== G.city) return null;
    const found = G.flags.found || (G.flags.found = {}); let hit = null;
    for (const S of SITES) if (!found[S.id] && Math.hypot(x - S.x, z - S.z) < S.discR) { found[S.id] = dayOf(G.time) + 1; hit = S; msg(`You have found ${S.name}: ${S.blurb}.`, 'district'); bigMsg(S.name.replace(/^the /, 'The '), 2.2); }
    if (this.glowMat) this.glowMat.opacity = isNight(G.time) ? 1 : 0;
    // the people of Mirrormere, about their doors by day
    const M = SITES[2], dm = Math.hypot(x - M.x, z - M.z);
    if (this.vill && this.vill[0].removed) this.vill = null;
    if (dm < 450 && !this.vill && M.villagers) this.vill = M.villagers.map(([vx, vz], k) => { const r = new RNG(7350 + k), g = r.chance(0.5) ? 'f' : 'm';
      return spawnNPC(G.city, { name: personName(r, g), look: lookByWealth(r, g, 0.7), gender: g, x: vx, z: vz, role: 'wander', wanderR: 8, speed: 1.0, dialog: 'villager', spriteKey: 'mere' + k, data: { site: 'mirrormere' } }); });
    else if (dm > 700 && this.vill) { for (const e of this.vill) if (!e.removed) e.remove(); this.vill = null; }
    if (this.vill) { const night = isNight(G.time); for (const e of this.vill) if (!e.dead) e.active = !night; }
    return hit;
  },
};

// a solid that blocks the way: an oriented box at (x, z), turned by ang, from y0 to y1
function siteCol(area, x, z, ang, hx, hz, y0, y1) { const e = Math.hypot(hx, hz) + 0.2; area.colliders.push({ x0: x - e, z0: z - e, x1: x + e, z1: z + e, y0, y1, o: { x, z, c: Math.cos(ang), s: Math.sin(ang), hx, hz } }); }
// a ruined wall run between two points: lengths of masonry of uneven height with breaches, rubble at its foot
function ruinWall(gb, area, H, ax, az, bx, bz, hmin, hmax, th, seed, rng, gapAt = -1) {
  const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2.6)), ang = Math.atan2(bx - ax, bz - az), seg = L / n;
  for (let k = 0; k < n; k++) {
    const f0 = k / n, f1 = (k + 1) / n, mx = lerp(ax, bx, (f0 + f1) / 2), mz = lerp(az, bz, (f0 + f1) / 2);
    const v = 0.5 + 0.5 * vnoise(seed + k * 0.41, 1.3, 960);
    if (v < 0.2 || Math.abs(k - gapAt) < 1) { if (v < 0.2 && rng.chance(0.8)) for (let q = 0; q < 3; q++) boulder(gb, 'boulder', mx + rng.range(-2, 2), H(mx, mz) - 0.1, mz + rng.range(-2, 2), rng.range(0.35, 0.8), rng); continue; } // a breach, its stones fallen
    const y = Math.min(H(lerp(ax, bx, f0), lerp(az, bz, f0)), H(lerp(ax, bx, f1), lerp(az, bz, f1)), H(mx, mz)) - 0.7, top = lerp(hmin, hmax, v * v) + rng.range(-0.4, 0.4);
    gb.setXf(mx, mz, ang, y); gb.box(-th / 2, 0, -seg / 2 - 0.04, th / 2, top + 0.7, seg / 2 + 0.04, { side: 'stone', top: 'stone' }, 3, 3); gb.xf = null;
    siteCol(area, mx, mz, ang, th / 2, seg / 2, y - 1, y + top + 0.7);
    if (rng.chance(0.25)) boulder(gb, 'boulder', mx + rng.range(-2.5, 2.5), H(mx, mz) - 0.1, mz + rng.range(-2.5, 2.5), rng.range(0.3, 0.6), rng);
  }
}
// a round tower of rough stone, its top broken off unevenly (ruined) or crenellated
function roundTower(gb, area, cx, cz, y, r, h, rng, ruined, key = 'stone') {
  const segs = 10;
  for (let i = 0; i < segs; i++) {
    const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2, top = ruined ? h * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(i * 2.3 + cx))) + rng.range(-0.6, 0.6) : h;
    const p0 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], c = 2 * Math.PI * r;
    gb.quad4(key, p0, p1, [p1[0], y + top, p1[2]], [p0[0], y + top, p0[2]], [i / segs * c / 3, y / 3], [(i + 1) / segs * c / 3, y / 3], [(i + 1) / segs * c / 3, (y + top) / 3], [i / segs * c / 3, (y + top) / 3], [Math.cos((a0 + a1) / 2), 0, Math.sin((a0 + a1) / 2)]);
    gb.quad4(key, [p0[0], y + top, p0[2]], [p1[0], y + top, p1[2]], [cx + Math.cos(a1) * (r - 1), y + top, cz + Math.sin(a1) * (r - 1)], [cx + Math.cos(a0) * (r - 1), y + top, cz + Math.sin(a0) * (r - 1)], [0, 0], [1, 0], [1, 0.3], [0, 0.3], [0, 1, 0]);
    if (!ruined && i % 2 === 0) { const am = (a0 + a1) / 2; gb.setXf(cx + Math.cos(am) * (r - 0.5), cz + Math.sin(am) * (r - 0.5), -am, y + h); gb.box(-0.5, 0, -0.9, 0.5, 1.1, 0.9, key, 2, 2); gb.xf = null; }
  }
  if (!ruined) gb.disc('flag', cx, y + h - 0.2, cz, r - 0.5, segs, 3);
  siteCol(area, cx, cz, 0, r * 0.9, r * 0.9, y - 2, y + h);
}
const SITE_BUILD = {
  // the broken keep: a ring of curtain wall round the crown of the crag with a gate on the road side, a tall shell of a keep, fallen towers
  greywatch(gb, S, H, area) {
    const rng = new RNG(7101), cx = S.x - 4, cz = S.z - 4, R = 33, n = 9, pts = []; S.clear = [[cx, cz, 42]];
    for (let k = 0; k < n; k++) { const a = k / n * Math.PI * 2 + 0.2, rr = R * (0.92 + 0.16 * (0.5 + 0.5 * Math.sin(k * 1.9))); pts.push([cx + Math.cos(a) * rr, cz + Math.sin(a) * rr]); }
    const gate = pts.reduce((b, p, k) => { const q = pts[(k + 1) % n], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, sc = (mx - cx) + (mz - cz); return sc > b[0] ? [sc, k] : b; }, [-1e9, 0])[1]; // the side facing the road (south-east)
    for (let k = 0; k < n; k++) { const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % n], L = Math.hypot(bx - ax, bz - az); ruinWall(gb, area, H, ax, az, bx, bz, 3, 10, 2.2, 13 + k * 7, rng, k === gate ? Math.round(L / 2.6 / 2) - 0.5 : -1); }
    pts.forEach(([x, z], k) => { if (k % 2) return; const y = H(x, z) - 0.8; roundTower(gb, area, x, z, y, 3.8, rng.range(9, 15), rng, true); });
    // the keep: four walls with their tops broken off, a doorway on the south side, open to the sky
    { const kx = cx - 6, kz = cz - 8, hw = 6.5, th = 1.6, y = Math.min(H(kx - hw, kz - hw), H(kx + hw, kz - hw), H(kx - hw, kz + hw), H(kx + hw, kz + hw)) - 0.8;
      const wall = (ax, az, bx, bz, door) => { const L = Math.hypot(bx - ax, bz - az), n2 = Math.round(L / 1.6), ang = Math.atan2(bx - ax, bz - az);
        for (let q = 0; q < n2; q++) { const f = (q + 0.5) / n2, mx = lerp(ax, bx, f), mz = lerp(az, bz, f); if (door && Math.abs(f - 0.5) < 0.12) { gb.setXf(mx, mz, ang, y); gb.box(-th / 2, 3.6, -L / n2 / 2, th / 2, 7, L / n2 / 2, 'stone', 3, 3); gb.xf = null; siteCol(area, mx, mz, ang, th / 2, L / n2 / 2, y + 3.6, y + 7); continue; }
          const top = 19 + 12 * (0.5 + 0.5 * Math.sin(q * 1.7 + ax)) * (0.6 + 0.4 * (0.5 + 0.5 * Math.cos(q * 0.6))) + rng.range(-1, 1);
          gb.setXf(mx, mz, ang, y); gb.box(-th / 2, 0, -L / n2 / 2 - 0.02, th / 2, top, L / n2 / 2 + 0.02, 'stone', 3, 3); gb.xf = null; siteCol(area, mx, mz, ang, th / 2, L / n2 / 2, y - 1, y + top);
          if (q % 3 === 1 && top > 8) for (let wy = 4.5; wy < top - 2; wy += 4.2) { const [nx, nz] = [Math.cos(ang), -Math.sin(ang)]; for (const s of [1, -1]) gb.quad('winB', [mx + nx * (th / 2 + 0.03) * s - Math.sin(ang) * 0.35 * s, y + wy, mz + nz * (th / 2 + 0.03) * s - Math.cos(ang) * 0.35 * s], [Math.sin(ang) * s, 0, Math.cos(ang) * s], [0, 1, 0], 0.7, 1.3, 1, 1, { fixedUV: true }); } } };
      wall(kx - hw, kz + hw, kx + hw, kz + hw, true); wall(kx + hw, kz + hw, kx + hw, kz - hw); wall(kx + hw, kz - hw, kx - hw, kz - hw); wall(kx - hw, kz - hw, kx - hw, kz + hw);
      for (let q = 0; q < 10; q++) boulder(gb, 'boulder', kx + rng.range(-hw + 1.5, hw - 1.5), H(kx, kz), kz + rng.range(-hw + 1.5, hw - 1.5), rng.range(0.4, 1.0), rng); }
    for (let q = 0; q < 26; q++) { const a = rng.range(0, 6.283), r = rng.range(36, 70), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r; boulder(gb, 'boulder', x, H(x, z), z, rng.range(0.4, 1.4), rng); } // masonry tumbled down the slopes
  },
  // nine stones in a ring on the crown of the hill, two of them fallen, a flat stone at the heart
  stones(gb, S, H, area) {
    const rng = new RNG(7201); S.clear = [[S.x, S.z, 22]];
    for (let k = 0; k < 9; k++) {
      const a = k / 9 * Math.PI * 2 + 0.3, r = 13 + rng.range(-0.6, 0.6), x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r, y = H(x, z) - 0.6, ang = a + Math.PI / 2 + rng.range(-0.2, 0.2);
      if (k === 3 || k === 7) { gb.setXf(x, z, ang + 1.3, y + 0.2); gb.box(-0.55, 0, -1.6, 0.55, 0.85, 1.6, 'rock', 2, 2); gb.xf = null; siteCol(area, x, z, ang + 1.3, 0.55, 1.6, y - 1, y + 1.05); continue; } // fallen
      const h = rng.range(3.8, 5.2), w = rng.range(0.6, 0.85);
      gb.tint = [1.3, 1.28, 1.2]; gb.setXf(x, z, ang, y); gb.box(-w, 0, -0.32, w, h, 0.32, 'rock', 2, 2); gb.box(-w * 0.7, h, -0.25, w * 0.6, h + 0.35, 0.25, 'rock', 2, 2); gb.xf = null; gb.tint = null; siteCol(area, x, z, ang, w, 0.35, y - 1, y + h + 0.35);
    }
    { const kx = S.x + 30, kz = S.z + 22, y = H(kx, kz) - 0.8; gb.tint = [1.3, 1.28, 1.2]; gb.setXf(kx, kz, 0.6, y); gb.box(-1.1, 0, -0.5, 1.1, 7.2, 0.5, 'rock', 2, 2); gb.box(-0.8, 7.2, -0.4, 0.7, 7.7, 0.4, 'rock', 2, 2); gb.xf = null; gb.tint = null; siteCol(area, kx, kz, 0.6, 1.1, 0.5, y - 1, y + 7.7); } // the king stone, standing apart
    { const y = H(S.x, S.z) - 0.3; gb.setXf(S.x, S.z, 0.4, y); gb.box(-1.3, 0, -0.75, 1.3, 0.85, 0.75, 'rock', 2, 2); gb.xf = null; siteCol(area, S.x, S.z, 0.4, 1.3, 0.75, y - 1, y + 0.85); }
    for (let q = 0; q < 8; q++) { const a = rng.range(0, 6.283), r = rng.range(30, 120), x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r; boulder(gb, 'boulder', x, H(x, z), z, rng.range(0.4, 1.0), rng); }
  },
  // the hamlet: cottages along a lane from the jetty, a chapel, gardens; a jetty out over the water
  mirrormere(gb, S, H, area) {
    const rng = new RNG(7301), WL = MERE.wl, y0 = WL + 3.2, o = (lx, lz) => [S.x + lx, S.z + lz]; S.clear = [[140, 0, 30], [175, 0, 30], [210, 0, 30], [245, 0, 30], [274, -24, 22]].map(([a, b, r]) => [...o(a, b), r]);
    // the lane, laid as a dirt strip
    const lane = [[126, 2], [160, 0], [200, -2], [240, 0], [280, 0]].map(([a, b]) => o(a, b)); drapeStrip(gb, 'rDirt', resampleEven(lane, 3), 4, { lift: 0.07 });
    const homes = [[150, -14, 0], [178, -14, 0], [214, -15, 0], [252, -14, 0], [162, 15, Math.PI], [198, 16, Math.PI], [236, 15, Math.PI]];
    homes.forEach(([lx, lz, rot], k) => {
      const [x, z] = o(lx, lz), r2 = new RNG(7310 + k); gb.setXf(x, z, rot, y0 - 0.1);
      makeBuilding(area, gb, r2, { fp: { x0: -4.5, z0: -3.2, x1: 4.5, z1: 3.2 }, stories: 1, style: r2.pick(['timber2', 'plaster', 'stone']), roof: 'gable', roofKey: 'roofThatch', roofTint: [1, 0.95, 0.85], doorT: 0.5, found: 0.6, chimney: 0.9, wealth: 0.8 });
      gb.xf = null; const [gx, gz] = xfP(makeXf(x, z, rot), 0, -9); drapePatch(gb, k % 3 ? 'fGreens' : 'fPlowed', makeXf(gx, gz, rot), -4, -3, 4, 3, { cell: 3, lift: 0.05, uvFrame: true }); // a kitchen garden behind
    });
    // the chapel, at the head of the lane, its little bell-cote over the door
    { const [x, z] = o(274, -26), r2 = new RNG(7320); gb.setXf(x, z, 0, y0 - 0.1);
      makeBuilding(area, gb, r2, { fp: { x0: -4, z0: -7, x1: 4, z1: 7 }, h: 5.2, style: 'stone', roof: 'gable', roofKey: 'roofSlate', doorT: 0.5, found: 0.6, chimney: 0, alongX: false, winRate: 0.8 });
      gb.tint = [0.8, 0.8, 0.82]; gb.box(-1.6, -0.6, -10.2, 1.6, 12, -7, { side: 'stone', top: 'stone' }, 2, 2); gb.tint = null; gb.cone('roofSlate', 0, -8.6, 2.4, 12, 7, 4, 2); gb.xf = null; // the steeple, at the far end from the door
      const [sx, sz] = xfP(makeXf(x, z, 0), 0, -8.6); siteCol(area, sx, sz, 0, 1.6, 1.6, y0 - 1, y0 + 19); }
    // the jetty and two boats drawn up beside it
    { const [x, z] = o(128, 2), ang = -Math.PI / 2; gb.setXf(x, z, ang, WL);
      gb.box(-1.4, 0.35, 0, 1.4, 0.6, 40, { side: 'woodDark', top: 'wood' }, 2, 2);
      for (let t = 2; t < 40; t += 4) for (const s of [-1.2, 1.2]) gb.box(s - 0.14, -3.5, t - 0.14, s + 0.14, 0.6, t + 0.14, 'woodDark', 1, 1);
      for (const [bx, bz] of [[3, 8], [-3.2, 17]]) gb.box(bx - 0.8, -0.2, bz - 2.2, bx + 0.8, 0.45, bz + 2.2, { side: 'woodDark', top: 'wood' }, 1, 1);
      gb.xf = null; const [jx, jz] = xfP(makeXf(x, z, ang), 0, 20); siteCol(area, jx, jz, ang, 1.4, 20, WL - 5, WL + 0.6); }
    // the lake itself
    { const g = gb.grp('wStream'), base = g.p.length / 3, n = 72; g.p.push(S.x, WL, S.z); g.u.push(S.x / 6, S.z / 6); g.c.push(0.74, 0.86, 0.9);
      for (let k = 0; k <= n; k++) { const a = k / n * Math.PI * 2, rr = mereR(S.x + Math.cos(a) * 100, S.z + Math.sin(a) * 100) + 3, x = S.x + Math.cos(a) * rr, z = S.z + Math.sin(a) * rr; g.p.push(x, WL, z); g.u.push(x / 6, z / 6); g.c.push(0.8, 0.9, 0.92); if (k) g.i.push(base, base + k, base + k + 1, base, base + k + 1, base + k); } }
    // an orchard on the slope above the hamlet, and a few rocks along the shore
    for (let q = 0; q < 6; q++) { const a = rng.range(-1.6, 1.6), r = mereR(S.x + Math.cos(a) * 100, S.z + Math.sin(a) * 100) + rng.range(2, 6), x = S.x + Math.cos(a) * r, z = S.z + Math.sin(a) * r; boulder(gb, 'boulder', x, H(x, z), z, rng.range(0.4, 0.9), rng); }
    S.villagers = homes.map(([lx, lz, rot]) => { const [x, z] = xfP(makeXf(S.x + lx, S.z + lz, rot), 0, 6.5); return [x, z]; });
  },
  // the watchtower at the crest of the pass, with a walled yard and a beacon on its roof
  kestrel(gb, S, H, area) {
    const rng = new RNG(7401), tx = S.x - 24, tz = S.z + 6; S.clear = [[tx, tz, 20]]; const y = Math.min(H(tx - 4, tz - 4), H(tx + 4, tz - 4), H(tx - 4, tz + 4), H(tx + 4, tz + 4)) - 0.4;
    gb.setXf(tx, tz, Math.PI / 2, y); makeBuilding(area, gb, rng, { fp: { x0: -4, z0: -4, x1: 4, z1: 4 }, h: 25, style: 'stone', roof: 'flat', doorT: 0.5, found: 1.2, winRate: 0.35, chimney: 0 }); gb.xf = null;
    this.glowAt(S, tx, y + 26.2, tz); gb.box(tx - 0.1, y + 25, tz - 0.1, tx + 0.1, y + 31, tz + 0.1, 'woodDark', 1, 1); S.flags = [[tx + 0.1, y + 30.2, tz, 0.4]];
    // the yard wall, with a gate to the road
    const yw = [[-12, -10], [12, -10], [12, 12], [-12, 12]].map(([a, b]) => [tx + a, tz + b]);
    for (let k = 0; k < 4; k++) { const [ax, az] = yw[k], [bx, bz] = yw[(k + 1) % 4]; ruinWall(gb, area, H, ax, az, bx, bz, 2.2, 2.6, 0.8, 50 + k, new RNG(7410 + k), k === 1 ? 4 : -1); }
    const hy = H(tx + 8, tz + 8); gb.setXf(tx + 7, tz + 7, 0, hy); makeBuilding(area, gb, rng, { fp: { x0: -3, z0: -2.5, x1: 3, z1: 2.5 }, stories: 1, style: 'stone', roof: 'gable', roofKey: 'roofSlate', doorT: 0.5, found: 0.6, chimney: 1 }); gb.xf = null;
  },
  // the lighthouse at the tip of the headland, its keeper's cottage beside it
  gullscar(gb, S, H, area) {
    const rng = new RNG(7501), lx = GULL.x, lz = gullCoast(GULL.x) - 34, y = H(lx, lz) - 0.5; S.clear = [[lx, lz, 12], [lx - 4, lz - 22, 12]];
    gb.tint = [1.15, 1.15, 1.12]; gb.cyl('plaster', lx, lz, 4.6, y, y + 30, 14, 4, 4); gb.tint = null;
    gb.cyl('stone', lx, lz, 5.0, y - 1.5, y + 1.2, 14, 3, 3); gb.cyl('iron', lx, lz, 3.2, y + 30, y + 33.5, 10, 2, 2); gb.cone('roofRed', lx, lz, 4.4, y + 33.5, 5, 12, 3); gb.disc('flag', lx, y + 30, lz, 4.65, 14, 3);
    for (let wy = 4; wy < 28; wy += 5) gb.quad('winB', [lx - 0.45, y + wy, lz + 4.63], [1, 0, 0], [0, 1, 0], 0.9, 1.4, 1, 1, { fixedUV: true });
    siteCol(area, lx, lz, 0, 4.8, 4.8, y - 2, y + 38);
    this.glowAt(S, lx, y + 31.8, lz, 8);
    const cx = lx - 4, cz = lz - 22, cy = H(cx, cz); gb.setXf(cx, cz, 0.15, cy - 0.1); makeBuilding(area, gb, rng, { fp: { x0: -5, z0: -3.5, x1: 5, z1: 3.5 }, stories: 1, style: 'plaster', roof: 'gable', roofKey: 'roofSlate', doorT: 0.4, found: 0.8, chimney: 1 }); gb.xf = null;
    drapeStrip(gb, 'rDirt', resampleEven([[cx + 1, cz + 4], [lx - 1, lz - 6]], 3), 2.4, { lift: 0.07 });
  },
  glowAt(S, x, y, z, s = 5) { Sites.glows.push([x, y, z, s]); },
};
