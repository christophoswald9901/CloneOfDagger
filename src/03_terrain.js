/* =====================================================================
   Terrain: one heightfield for the city and the countryside.
   The land rises from the harbour to the castle and on into rolling hills;
   Pilgrim's Rise is a crag north-east of the walls; headlands close the bay.
   ===================================================================== */

const SEA = -0.8;                           // water level
const TG = { C: 4, R: 352, N: 176 };        // fine grid: 4 m cells over the walkable world
let TH = null;                              // baked heights of the fine grid, (N+1)^2
// the wild country beyond the surveyed land is generated; ?seed=N lays out a different one (the city and its fields stay)
const WSEED = (() => { try { return parseInt(new URLSearchParams(location.search).get('seed'), 10) || 0; } catch (e) { return 0; } })();
// the play area: 20 × 20 km with the city near its southern edge, on the bay; mountains too steep to climb close the three land sides
const WORLD = { x0: -10000, x1: 10000, z0: -18000, z1: 2000 };

/* ---------------- noise ---------------- */
function _h2(ix, iz, s) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(s + 1, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, z, s = 0) {
  const ix = Math.floor(x), iz = Math.floor(z); const fx = x - ix, fz = z - iz;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = _h2(ix, iz, s), b = _h2(ix + 1, iz, s), c = _h2(ix, iz + 1, s), d = _h2(ix + 1, iz + 1, s);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, z, oct = 4, s = 0) { let a = 1, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { sum += a * vnoise(x * f, z * f, s + i * 17); n += a; a *= 0.5; f *= 2.03; } return sum / n; }
function ridgeNoise(x, z, oct = 4, s = 0) { let a = 1, f = 1, sum = 0, n = 0; for (let i = 0; i < oct; i++) { const v = 1 - Math.abs(vnoise(x * f, z * f, s + i * 31)); sum += a * v * v; n += a; a *= 0.5; f *= 2.1; } return sum / n; }

/* ---------------- the shape of the land ---------------- */
// the shoreline: the quay inside the walls, beaches beside them, headlands further out that close the bay
function coastZ(x) {
  const ax = Math.abs(x);
  if (ax < 158) return SHORE;
  const k = smoothstep(158, 200, ax);
  const wild = smoothstep(900, 1500, ax); // further along, the coast runs on in bays and headlands
  return SHORE + k * (6 + 16 * fbm(x / 70, 3.7, 3, 5)) + 85 * smoothstep(230, 470, ax) + 30 * smoothstep(500, 800, ax) * (x < 0 ? 1.2 : 0.8)
    + (wild > 0 ? wild * (150 * fbm(x / 900 + WSEED * 3.1, 7.3, 3, 306) + 40 * fbm(x / 160, 2.9, 2, 307)) : 0)
    + smoothstep(1800, 4000, ax) * 650 * fbm(x / 5200 + WSEED * 1.9, 13.7, 3, 309); // and at the scale of the whole bay, in broad bights and capes
}
// Pilgrim's Rise: a crag whose steep face looks down on the city from the north-east
const RISE = { a: [115, -290], b: [295, -150], H: 85, wIn: 46, wOut: 150 };
// far mountain massifs: [x, z, height, radius along, radius across, heading]
// far mountain ranges: [x, z, height, half-length along the horizon, half-depth]; each lies tangent to the world's rim
const MASSIFS = [[-820, 70, 170, 260, 150], [-760, -380, 215, 280, 160], [-450, -720, 210, 250, 150], [-20, -820, 260, 300, 160], [410, -700, 220, 240, 150], [720, -350, 240, 260, 160], [800, 90, 180, 240, 150]];
// a rocky shoulder on the city-facing flank, a little below the crest
const RISE_LOOK = (() => { const [ax, az] = RISE.a, [bx, bz] = RISE.b; const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L; const t = 0.47 * L; return [ax + ux * t - uz * 25, az + uz * t + ux * 25]; })();
function riseHeight(x, z) {
  const [ax, az] = RISE.a, [bx, bz] = RISE.b; const dx = bx - ax, dz = bz - az; const L = Math.hypot(dx, dz);
  const ux = dx / L, uz = dz / L; const wx = x + 14 * fbm(x / 60, z / 60, 3, 91), wz = z + 14 * fbm(x / 60 + 7, z / 60, 3, 92);
  const t = ((wx - ax) * ux + (wz - az) * uz) / L; const perp = (wx - ax) * -uz + (wz - az) * ux; // > 0 is the side facing the city
  const along = Math.max(0, 1 - Math.pow((t - 0.45) / 0.62, 2));
  const crest = RISE.H * along * (0.8 + 0.35 * ridgeNoise(t * 5, 1.3, 3, 93));
  const w = perp > 0 ? RISE.wIn : RISE.wOut;
  let h = crest * Math.exp(-Math.pow(perp / w, 2));
  // the lookout shoulder: a small knoll on the steep face
  const dl = Math.hypot(x - RISE_LOOK[0], z - RISE_LOOK[1]); h += 4 * Math.exp(-Math.pow(dl / 11, 2));
  return h;
}
// ridged multifractal: each octave is weighted by the one above, so crests stay sharp and the valleys between them smooth
function ridgedMF(x, z, oct, s) { let sum = 0, amp = 1, f = 1, w = 1, norm = 0; for (let i = 0; i < oct; i++) { let n = 1 - Math.abs(vnoise(x * f, z * f, s + i * 29)); n *= n * w; w = clamp(n * 1.8, 0, 1); sum += n * amp; norm += amp; amp *= 0.5; f *= 2.05; } return sum / norm; }
// the valley lines of the wild: a broad field whose zero line the valleys (and the streams in them) follow
function wildValley(x, z) {
  const s = WSEED * 131, X = x + WSEED * 7919, Z = z - WSEED * 6271;
  const wx = X + 260 * fbm(X / 1200, Z / 1200, 2, 302 + s), wz = Z + 260 * fbm(X / 1200 + 4.1, Z / 1200, 2, 303 + s);
  return [wx, wz, Math.abs(fbm(wx / 1500, wz / 1500, 3, 304 + s) + 0.018 * fbm(wx / 90, wz / 90, 2, 309 + s))]; // the small term makes the stream meander
}
// the wild country: uplands and plains, long mountain ranges, broad valleys winding through. Returns [extra height, valley floor 0 (on it) .. 1]
function wildRelief(x, z) {
  const s = WSEED * 131, X = x + WSEED * 7919, Z = z - WSEED * 6271;
  const [wx, wz, vl] = wildValley(x, z);
  const floor = smoothstep(0.015, 0.17, vl); // valleys wind along the zero line of a broad field
  const region = fbm(X / 2800, Z / 2800, 3, 301 + s) + 0.12;                                // lowland plains < 0 < uplands
  let h = 34 * smoothstep(-0.35, 0.35, region);
  // ranges follow the zero lines of another broad field: a crest band some hundreds of metres wide, foothills either side
  const band = Math.abs(fbm(wx / 2400, wz / 2400, 3, 310 + s));
  const rm = (1 - smoothstep(0.04, 0.32, band)) * smoothstep(-0.5, 0.05, region);
  if (rm > 0.001) {
    const qx = wx + 110 * fbm(wx / 330, wz / 330, 2, 317 + s), qz = wz + 110 * fbm(wx / 330 + 5.2, wz / 330, 2, 318 + s); // warped, so peaks grow spurs and lopsided flanks
    let m = rm * rm * (95 + 95 * smoothstep(0, 0.6, region)) * (0.75 * ridgedMF(qx / 760, qz / 760, 6, 306 + s) + 0.25 * ridgedMF(qx / 410, qz / 410, 4, 319 + s)) * 1.3; // massifs with shoulders and spurs, not cones
    // the high ground breaks into crags and cliff bands: sharper small ridges, and soft steps in the slope
    const hi = smoothstep(60, 190, m);
    if (hi > 0) {
      m += hi * 12 * (ridgeNoise(wx / 120, wz / 120, 3, 312 + s) - 0.45);
      // gullies run down the fall line: a groove noise stretched along the slope of the range
      const e = 12, gx = ridgedMF((wx + e) / 720, wz / 720, 3, 306 + s) - ridgedMF((wx - e) / 720, wz / 720, 3, 306 + s), gz = ridgedMF(wx / 720, (wz + e) / 720, 3, 306 + s) - ridgedMF(wx / 720, (wz - e) / 720, 3, 306 + s), gl = Math.hypot(gx, gz) || 1e-6;
      const u = (wx * gz - wz * gx) / gl, v = (wx * gx + wz * gz) / gl; m -= hi * 11 * Math.pow(1 - Math.abs(vnoise(u / 26, v / 170, 313 + s)), 4);
      const t = m / 17, f = Math.floor(t); m = lerp(m, (f + smoothstep(0.3, 0.7, t - f)) * 17, 0.2 * hi);
    }
    h += m;
  }
  return [h * lerp(0.2, 1, floor) - 9 * (1 - floor), floor];
}
// sand on the shore: wide beaches by the city, out along the coast only a strip at the water's edge (low river flats beside it stay green)
function isBeach(x, z, h) { const w = smoothstep(900, 1500, Math.abs(x)); return h < SEA + lerp(2.4, 3.2, w) && coastZ(x) - z < lerp(140, 60, w); }
// how far inside the play area's land edge a point lies (negative beyond it), along a ragged line
function rimDist(x, z) { return Math.min(x - WORLD.x0, WORLD.x1 - x, z - WORLD.z0) - 300 + 2400 * fbm(x / 5000 + 3.3, z / 5000, 3, 390 + WSEED * 7) + 500 * fbm(x / 1300, z / 1300, 2, 391) + 120 * fbm(x / 400, z / 400, 2, 392); }
// the mountains that close the play area: foothills, then a wall of peaks too steep to climb
function rimHeight(x, z) {
  const de = rimDist(x, z); if (de > 3600) return 0;
  const sd = WSEED * 1.1, pk = ridgedMF(x / 900 + sd, z / 900, 5, 395), fine = ridgedMF(x / 260 + sd, z / 260, 3, 398);
  const mass = smoothstep(0.2, 0.8, 0.5 + 0.9 * fbm(x / 1800 + sd, z / 1800, 2, 397)); // where the highest peaks stand
  const plinth = smoothstep(3600, 300, de), wall = smoothstep(950, -250, de);
  // the land climbs through foothills to a range of separate peaks with cols between them, and on beyond into the high country
  return plinth * (0.4 + 0.6 * plinth) * 190 * (0.55 + 0.6 * pk) + wall * (280 + 380 * mass) * (0.4 + 0.8 * pk) + wall * 40 * fine + smoothstep(150, -700, de) * 230;
}
// the raw height before level plots and roads are cut in, and before the rivers have cut their valleys (terrainRaw, in 03_water.js, adds those)
function terrainBase(x, z) {
  const dIn = SHORE - z; const r0 = Math.hypot(x, z);
  const wW = smoothstep(800, 1400, r0); const wr = wW > 0 ? wildRelief(x, z) : null;
  let h = 0.6 + 45 * (1 - Math.exp(-Math.max(0, dIn) / 330));      // the land climbs away from the sea
  h += 4.5 * fbm(x / 260 + 11, z / 260, 3, 21);                     // broad swells
  const inside = pointInPoly(x, z, WALL_PTS) && z < SHORE + 2;
  const wd = inside ? 0 : wallDist(x, z);
  const out = smoothstep(4, 75, wd);
  h += (1 - out * 0.7) * 2.2 * fbm(x / 70, z / 70, 3, 22);         // small rises and dips in the streets
  h += 16 * Math.exp(-(x * x + (z + 128) * (z + 128)) / (42 * 42)); // the castle knoll
  // hills beyond the walls, bigger towards the horizon
  const far = smoothstep(330, 700, Math.hypot(x, z));
  const amp = out * (26 + 45 * far) * lerp(1, 0.32, smoothstep(700, 1700, r0)); // out in the country the big shapes carry the relief, the knolls calm down
  if (amp > 0.01) {
    const wx = x + 40 * fbm(x / 300, z / 300, 2, 23), wz = z + 40 * fbm(x / 300 + 5, z / 300, 2, 24);
    const hills = 0.6 * ridgeNoise(wx / 230, wz / 230, 4, 25) + 0.4 * (fbm(wx / 150, wz / 150, 4, 26) * 0.5 + 0.5);
    h += amp * (hills - 0.42) * (wr ? lerp(1, lerp(0.35, 1, wr[1]), wW) : 1);
  }
  if (wr) h += out * wW * (wr[0] + 70 * smoothstep(1500, 14000, coastZ(x) - z)); // the land rises slowly towards the interior
  if (r0 > 5500) h += rimHeight(x, z);
  if (Math.abs(x - 205) < 700 && Math.abs(z + 220) < 700) h += out * riseHeight(x, z); // it has faded to nothing long before the box ends
  // western downs framing the other side of the bay
  { const dx = x + 300, dz = z + 120; h += out * 30 * Math.exp(-(dx * dx) / (90 * 90) - (dz * dz) / (190 * 190)); }
  // the coast: beaches beside the walls, cliffs at the headlands
  const d = coastZ(x) - z;
  if (Math.abs(x) >= 158 || z > SHORE) {
    if (d < 0) h = SEA - 0.3 - Math.min(6, -d * 0.06);               // the sea bed shelves gently: a band of shallows
    else {
      const inland = Math.max(h, SEA + 0.5);
      // wide beaches near the city, cliffs at the headlands; far along, the shore slope grows with the height of the land behind it
      const W = lerp(lerp(40, 9, smoothstep(240, 420, Math.abs(x))), clamp((inland - SEA) * 0.8, 10, 110), smoothstep(900, 1500, Math.abs(x)));
      h = SEA + 0.15 + (inland - SEA - 0.15) * smoothstep(0, W, d);
    }
  }
  if (dIn > 30 && !inside && r0 < 1500) h = Math.max(h, 1.2 + (dIn - 30) * 0.01);  // no inland lakes below the sea
  if (r0 > 1400) { const dC = coastZ(x) - z; if (dC > 30) h = Math.max(h, SEA + 2.2 * smoothstep(30, 150, dC)); }
  // mountain ranges ring the land beyond the walkable country; the bay stays open to the south
  // a few islands far out in the bay
  for (const [ix, iz, ih, ir] of [[-330, 720, 34, 90], [120, 860, 22, 70], [360, 690, 16, 55]]) { const d = Math.hypot(x - ix, (z - iz) * 1.6); if (d < ir * 1.6) h = Math.max(h, SEA - 2 + (ih + 2) * Math.pow(Math.max(0, 1 - d / ir), 0.8) * (0.8 + 0.3 * fbm(x / 40, z / 40, 2, 81))); }
  // mountain massifs stand beyond the walkable country, each with foothills stepping down to the plain; the bay stays open
  if (Math.hypot(x, z) > 560) {
    let m = 0;
    for (const [mx, mz, H, rx, rz] of MASSIFS) {
      const ml = Math.hypot(mx, mz), ux = mx / ml, uz = mz / ml; const dx = x - mx, dz = z - mz; const lx = (dx * -uz + dz * ux) / rx, lz = (dx * ux + dz * uz) / rz;
      const d2 = lx * lx + lz * lz; if (d2 > 4) continue;
      const shape = Math.exp(-d2 * 1.3); const wx = x + 50 * fbm(x / 300, z / 300, 2, 71), wz = z + 50 * fbm(x / 300 + 9, z / 300, 2, 72);
      m = Math.max(m, H * shape * (0.55 + 0.6 * Math.pow(ridgeNoise(wx / 170, wz / 170, 5, 73), 1.3)) + 28 * smoothstep(4, 1, d2) * (0.5 + 0.5 * fbm(x / 90, z / 90, 3, 74)));
    }
    h += m * smoothstep(560, 700, Math.hypot(x, z));
  }
  return h;
}

/* ---------------- baking ---------------- */
// pads: level plots [{x, z, r} or {o: obb}], blended into the surrounding ground over `blend` metres
function bakeTerrain(pads = []) {
  const { C, R, N } = TG; const S = N + 1; TH = new Float32Array(S * S);
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) TH[j * S + i] = terrainRaw(-R + i * C, -R + j * C);
  for (const p of pads) applyPad(p);
}
// the outermost ring keeps the raw heights, so the generated country beside it meets it without a crack
function sealTerrainEdge() {
  const { C, R, N } = TG; const S = N + 1;
  for (let i = 0; i <= N; i++) for (const j of [0, N]) { TH[j * S + i] = terrainRaw(-R + i * C, -R + j * C); TH[i * S + j] = terrainRaw(-R + j * C, -R + i * C); }
}
function padDist(p, x, z) {
  if (p.o) { const [lx, lz] = oLocal(p.o, x, z); const qx = Math.max(0, Math.abs(lx) - p.o.hx), qz = Math.max(0, Math.abs(lz) - p.o.hz); return Math.hypot(qx, qz); }
  return Math.max(0, Math.hypot(x - p.x, z - p.z) - p.r);
}
function applyPad(p) {
  const { C, R, N } = TG; const S = N + 1; const blend = p.blend ?? 10;
  const ext = p.o ? Math.max(p.o.hx, p.o.hz) * 1.5 : p.r; const cx = p.o ? p.o.x : p.x, cz = p.o ? p.o.z : p.z;
  const i0 = Math.max(0, Math.floor((cx - ext - blend + R) / C)), i1 = Math.min(N, Math.ceil((cx + ext + blend + R) / C));
  const j0 = Math.max(0, Math.floor((cz - ext - blend + R) / C)), j1 = Math.min(N, Math.ceil((cz + ext + blend + R) / C));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const d = padDist(p, -R + i * C, -R + j * C); if (d > blend) continue;
    const w = 1 - smoothstep(0, blend, d); const k = j * S + i; TH[k] = lerp(TH[k], p.h, w);
  }
}
// cut a road into the slope: level across, straight grade along (hA → hB)
function levelRoad(ax, az, bx, bz, hA, hB, w, blend = 3.5) {
  const { C, R, N } = TG; const S = N + 1; const pad = w / 2 + blend;
  const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - pad + R) / C)), i1 = Math.min(N, Math.ceil((Math.max(ax, bx) + pad + R) / C));
  const j0 = Math.max(0, Math.floor((Math.min(az, bz) - pad + R) / C)), j1 = Math.min(N, Math.ceil((Math.max(az, bz) + pad + R) / C));
  const dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1e-9;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const x = -R + i * C, z = -R + j * C; const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1);
    const d = Math.hypot(x - (ax + dx * t), z - (az + dz * t)); if (d > pad) continue;
    const wgt = 1 - smoothstep(w / 2 + 0.5, pad, d); const k = j * S + i; TH[k] = lerp(TH[k], lerp(hA, hB, t), wgt);
  }
}
// lower the ground (never raise it) inside a rectangle to below hFn(x, z): built ramps and landings sit on it cleanly
function carveTerrain(x0, z0, x1, z1, hFn) {
  const { C, R, N } = TG; const S = N + 1;
  const i0 = Math.max(0, Math.floor((x0 + R) / C)), i1 = Math.min(N, Math.ceil((x1 + R) / C)), j0 = Math.max(0, Math.floor((z0 + R) / C)), j1 = Math.min(N, Math.ceil((z1 + R) / C));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * S + i; TH[k] = Math.min(TH[k], hFn(-R + i * C, -R + j * C)); }
}
// reshape the ground inside a rectangle: fn(x, z, h) returns the new height and reads the heights as they were before the call
function shapeTerrain(x0, z0, x1, z1, fn) {
  const { C, R, N } = TG; const S = N + 1, out = [];
  const i0 = Math.max(0, Math.floor((x0 + R) / C)), i1 = Math.min(N, Math.ceil((x1 + R) / C)), j0 = Math.max(0, Math.floor((z0 + R) / C)), j1 = Math.min(N, Math.ceil((z1 + R) / C));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = j * S + i; out.push(k, fn(-R + i * C, -R + j * C, TH[k])); }
  for (let q = 0; q < out.length; q += 2) TH[out[q]] = out[q + 1];
}
// height at any point; inside the fine grid this matches the rendered triangles exactly
function terrainH(x, z) {
  const { C, R, N } = TG; const fx = (x + R) / C, fz = (z + R) / C;
  const i = Math.floor(fx), j = Math.floor(fz);
  if (!TH || i < 0 || j < 0 || i >= N || j >= N) return Wild.heightAt(x, z);
  const u = fx - i, v = fz - j, S = N + 1, k = j * S + i;
  const h00 = TH[k], h10 = TH[k + 1], h01 = TH[k + S], h11 = TH[k + S + 1];
  return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
}
function terrainSlope(x, z) { const e = 2; return Math.hypot(terrainH(x + e, z) - terrainH(x - e, z), terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e); }
function terrainNormal(x, z, e = 2) { const gx = (terrainH(x + e, z) - terrainH(x - e, z)) / (2 * e), gz = (terrainH(x, z + e) - terrainH(x, z - e)) / (2 * e); return v3norm([-gx, 1, -gz]); }

/* ---------------- routing over the land ---------------- */
// A* on the fine grid (16 directions). cost(x,z) returns Infinity where a road may not go.
// grade: comfortable slope; steeper ground costs quadratically more, so roads bend along the contours
function routeTerrain(from, to, { grade = 0.08, block = null, extra = null, maxNodes = 60000 } = {}) {
  const { C, R, N } = TG; const S = N + 1;
  const idx = (x, z) => [clamp(Math.round((x + R) / C), 0, N), clamp(Math.round((z + R) / C), 0, N)];
  const [si, sj] = idx(from[0], from[1]), [ti, tj] = idx(to[0], to[1]);
  const start = sj * S + si, goal = tj * S + ti;
  const g = new Float32Array(S * S).fill(Infinity), came = new Int32Array(S * S).fill(-1), closed = new Uint8Array(S * S);
  const heap = [], push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
  g[start] = 0; push(start, 0); let n = 0;
  while (heap.length && n++ < maxNodes) {
    const [, k] = pop(); if (closed[k]) continue; closed[k] = 1; if (k === goal) break;
    const i = k % S, j = (k - i) / S; const hk = TH[k];
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj; if (ni < 0 || nj < 0 || ni > N || nj > N) continue;
      const nk = nj * S + ni; if (closed[nk]) continue;
      const x = -R + ni * C, z = -R + nj * C; if (block && nk !== goal && block(x, z)) continue;
      const len = Math.hypot(di, dj) * C; const gr = Math.abs(TH[nk] - hk) / len;
      let c = len * (1 + (gr / grade) * (gr / grade)); if (extra) c += extra(x, z) * len;
      const ng = g[k] + c; if (ng < g[nk]) { g[nk] = ng; came[nk] = k; push(nk, ng + Math.hypot(ti - ni, tj - nj) * C); }
    }
  }
  if (came[goal] < 0 && goal !== start) return null;
  const pts = []; for (let k = goal; k >= 0; k = came[k]) { const i = k % S, j = (k - i) / S; pts.push([-R + i * C, -R + j * C]); if (k === start) break; }
  pts.reverse(); pts[0] = from.slice(); pts[pts.length - 1] = to.slice();
  return pts;
}
// Ramer–Douglas–Peucker, then corner-cutting so routed roads curve instead of zig-zagging
function simplifyPath(pts, eps = 2.5) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const rec = (a, b) => { let m = -1, md = eps; for (let i = a + 1; i < b; i++) { const d = segDist(pts[i][0], pts[i][1], pts[a][0], pts[a][1], pts[b][0], pts[b][1]).d; if (d > md) { md = d; m = i; } } if (m >= 0) { keep[m] = 1; rec(a, m); rec(m, b); } };
  rec(0, pts.length - 1); return pts.filter((_, i) => keep[i]);
}
function smoothPath(pts, iters = 2) {
  let P = pts;
  for (let it = 0; it < iters; it++) { const Q = [P[0]]; for (let i = 0; i < P.length - 1; i++) { const a = P[i], b = P[i + 1]; Q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); } Q.push(P[P.length - 1]); P = Q; }
  return P;
}
// points every `step` metres along the path (fewer or more than it had), ends kept
function resampleEven(pts, step) {
  const out = [pts[0].slice()]; let carry = 0;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az); let t = step - carry;
    for (; t <= l; t += step) out.push([ax + (bx - ax) * t / l, az + (bz - az) * t / l]);
    carry = l - (t - step);
  }
  const e = pts[pts.length - 1], last = out[out.length - 1]; if (Math.hypot(e[0] - last[0], e[1] - last[1]) > step * 0.3) out.push(e.slice()); else out[out.length - 1] = e.slice();
  return out;
}
function resamplePath(pts, step) {
  const out = [pts[0]];
  for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const n = Math.max(1, Math.round(Math.hypot(bx - ax, bz - az) / step)); for (let k = 1; k <= n; k++) out.push([ax + (bx - ax) * k / n, az + (bz - az) * k / n]); }
  return out;
}

/* ---------------- ground meshes ---------------- */
// Vertex-lit terrain: smooth normals from the heightfield, one geometry per ground material.
// mat(x, z, h, slope) picks the surface of a cell; tint(x, z, h) returns an rgb multiplier.
const CAV8 = [[-3, 0], [3, 0], [0, -3], [0, 3], [-2, -2], [2, 2], [-2, 2], [2, -2]]; // where a vertex looks for hollows and crests
const TERRAIN_LIGHT = v3norm([0.8, 0.42, 0.5]); // a low morning sun from the east-south-east, about 24° up
function terrainShade(n) { const d = Math.max(0, v3dot(n, TERRAIN_LIGHT)); const k = 0.52 + 0.88 * d; return [k * lerp(0.78, 1.2, d), k * lerp(0.86, 1.0, d), k * lerp(1.12, 0.72, d)]; }
function buildTerrainMeshes(mats, matOf, tintOf) {
  const groups = new Map(); const grp = k => { let g = groups.get(k); if (!g) groups.set(k, g = { p: [], u: [], c: [], i: [] }); return g; };
  const { C, R, N } = TG; const S = N + 1;
  // per-vertex colour once
  const col = new Float32Array(S * S * 3);
  const th = (i, j) => i < 0 || j < 0 || i > N || j > N ? terrainRaw(-R + i * C, -R + j * C) : TH[j * S + i];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
    const x = -R + i * C, z = -R + j * C; const k = j * S + i;
    const hl = th(i - 1, j), hr = th(i + 1, j), hd = th(i, j - 1), hu = th(i, j + 1);
    const EX = 2.4; // relief is drawn a little steeper than it is, so gentle ground still reads from above
    const n = v3norm([-(hr - hl) / (2 * C) * EX, 1, -(hu - hd) / (2 * C) * EX]); const sh = terrainShade(n); const t = tintOf(x, z, TH[k], n);
    let avg = 0; for (const [di, dj] of CAV8) avg += th(i + di, j + dj); avg /= 8;
    const cav = clamp(1 + (TH[k] - avg) * 0.045, 0.72, 1.1); // hollows darker, crests catch the light
    col[k * 3] = sh[0] * t[0] * cav; col[k * 3 + 1] = sh[1] * t[1] * cav; col[k * 3 + 2] = sh[2] * t[2] * cav;
  }
  TCOL = col;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k00 = j * S + i, k10 = k00 + 1, k01 = k00 + S, k11 = k01 + 1;
    const x = -R + i * C, z = -R + j * C; const hc = (TH[k00] + TH[k11]) / 2;
    if (Math.max(TH[k00], TH[k10], TH[k01], TH[k11]) < SEA - 3) continue; // deep water: nothing to see
    const slope = Math.hypot(TH[k10] - TH[k00] + TH[k11] - TH[k01], TH[k01] - TH[k00] + TH[k11] - TH[k10]) / (2 * C);
    const key = matOf(x + C / 2, z + C / 2, hc, slope); const g = grp(key); const b = g.p.length / 3;
    // steep rock: wrap the texture round the face instead of stretching it down the slope
    const steep = key === 'tRock' || key === 'tCrag', alongZ = Math.abs(TH[k10] - TH[k00] + TH[k11] - TH[k01]) > Math.abs(TH[k01] - TH[k00] + TH[k11] - TH[k10]);
    for (const [kk, di, dj] of [[k00, 0, 0], [k10, 1, 0], [k01, 0, 1], [k11, 1, 1]]) {
      const vx = x + di * C, vz = z + dj * C; g.p.push(vx, TH[kk], vz); g.u.push(steep ? (alongZ ? vz : vx) / 4 : vx / 5, steep ? TH[kk] / 4 : vz / 5); g.c.push(col[kk * 3], col[kk * 3 + 1], col[kk * 3 + 2]);
    }
    g.i.push(b, b + 3, b + 1, b, b + 2, b + 3); // (00,11,10) and (00,01,11): the same split terrainH uses
    // along the shore, grass fades out over the sand instead of ending in steps
    if (key === 'tSand' && Math.max(TH[k00], TH[k10], TH[k01], TH[k11]) > SEA + 0.6) {
      const f = grp('tGrassFade'); f.rgba = true; const fb = f.p.length / 3;
      for (const [kk, di, dj] of [[k00, 0, 0], [k10, 1, 0], [k01, 0, 1], [k11, 1, 1]]) {
        const vx = x + di * C, vz = z + dj * C; const tg = tintOf(vx, vz, SEA + 3, [0, 1, 0]);
        f.p.push(vx, TH[kk], vz); f.u.push(vx / 5, vz / 5); f.c.push(col[kk * 3] * tg[0], col[kk * 3 + 1] * tg[1], col[kk * 3 + 2] * tg[2], smoothstep(SEA + 0.7, SEA + 2.3, TH[kk]));
      }
      f.i.push(fb, fb + 3, fb + 1, fb, fb + 2, fb + 3);
    }
  }
  // a skirt hangs from the fine grid's outer edge, so the seam with the coarse ring can never show sky
  { const g = grp('farGround');
    const edge = (i0, j0, i1, j1) => { const k0 = j0 * S + i0, k1 = j1 * S + i1; const x0 = -R + i0 * C, z0 = -R + j0 * C, x1 = -R + i1 * C, z1 = -R + j1 * C; const b = g.p.length / 3;
      g.p.push(x0, TH[k0], z0, x1, TH[k1], z1, x1, TH[k1] - 8, z1, x0, TH[k0] - 8, z0); g.u.push(x0 / 5, 0, x1 / 5, 0, x1 / 5, 1.6, x0 / 5, 1.6); for (const k of [k0, k1, k1, k0]) g.c.push(col[k * 3] * 0.8, col[k * 3 + 1] * 0.8, col[k * 3 + 2] * 0.8);
      g.i.push(b, b + 1, b + 2, b, b + 2, b + 3, b, b + 2, b + 1, b, b + 3, b + 2); };
    for (let i = 0; i < N; i++) { edge(i, 0, i + 1, 0); edge(i, N, i + 1, N); edge(0, i, 0, i + 1); edge(N, i, N, i + 1); }
  }
  const out = new THREE.Group();
  for (const [k, g] of groups) {
    if (!g.i.length) continue; const m = mats[k]; if (!m) { console.warn('missing terrain material', k); continue; }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, g.rgba ? 4 : 3));
    geo.setIndex(g.i); geo.computeBoundingSphere();
    const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; out.add(mesh);
  }
  return out;
}
// the sea: finer near the coast so shallows show lighter and a line of foam marks the shore
function buildWater(mat) {
  // one seamless grid (no T-junctions, so no pixel cracks): fine near the coast, coarse towards the horizon
  const xs = [-1500, -1200, -950, -760]; for (let x = -600; x <= 600; x += 8) xs.push(x); xs.push(760, 950, 1200, 1500);
  const zs = [-1500, -1000, -600, -300, -120, 40, 100]; for (let z = SHORE - 10; z <= 600; z += 8) zs.push(z); zs.push(760, 950, 1200, 1500);
  const shade = (x, z) => {
    const d = SEA - terrainH(x, z); const sh = smoothstep(2.8, 0.2, d), foam = smoothstep(0.45, 0.05, d);
    const far = smoothstep(250, 900, z); // toward the horizon the bay picks up the sky
    return [lerp(1, 1.3, sh) + foam * 0.5 + far * 0.18, lerp(1, 1.5, sh) + foam * 0.45 + far * 0.2, lerp(1, 1.36, sh) + foam * 0.4 + far * 0.18];
  };
  const p = [], u = [], c = [], idx = []; const NX = xs.length;
  for (const z of zs) for (const x of xs) { p.push(x, SEA, z); u.push(x / 6, z / 6); c.push(...shade(x, z)); }
  for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < NX - 1; i++) { const a = j * NX + i; idx.push(a, a + NX, a + 1, a + 1, a + NX, a + NX + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  geo.setIndex(idx); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; return m;
}
// the ground's own light (relief, cavities, baked shadows) at any point, so paving and yards are lit like the earth under them
let TCOL = null;
function groundColAt(x, z) {
  const { C, R, N } = TG; const S = N + 1; const fx = (x + R) / C, fz = (z + R) / C;
  const i = clamp(Math.floor(fx), 0, N - 1), j = clamp(Math.floor(fz), 0, N - 1), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
  const k00 = (j * S + i) * 3, k10 = k00 + 3, k01 = k00 + S * 3, k11 = k01 + 3, out = [1, 1, 1];
  if (!TCOL) return out;
  for (let c = 0; c < 3; c++) out[c] = lerp(lerp(TCOL[k00 + c], TCOL[k10 + c], u), lerp(TCOL[k01 + c], TCOL[k11 + c], u), v);
  return out;
}
// relight every vertex of the given builder groups from the ground (keeps any alpha)
function relightGround(gb, keys, tints = {}) {
  for (const k of keys) { const g = gb.g.get(k); if (!g) continue; const st = g.rgba ? 4 : 3, t = tints[k] || [1, 1, 1];
    for (let v = 0, n = g.p.length / 3; v < n; v++) { const c = groundColAt(g.p[v * 3], g.p[v * 3 + 2]); g.c[v * st] = c[0] * t[0]; g.c[v * st + 1] = c[1] * t[1]; g.c[v * st + 2] = c[2] * t[2]; } }
}
// a soft margin either side of a strip: the surface thins out over the ground beside it, along a ragged line
function drapeFeather(gb, key, pts, w, f, { lift = 0.04, tw = 3, seed = 1 } = {}) {
  const L = pts.length; if (L < 2) return; const g = gb.grp(key); g.rgba = true; const saved = gb.xf; gb.xf = null;
  const rng = new RNG(seed);
  for (const s of [1, -1]) {
    let prev = null;
    for (let i = 0; i < L; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(L - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l * s, nz = dx / l * s;
      const ww = w / 2 - 0.25 * f, fo = w / 2 + f * (0.35 + rng.next() * 1.1);
      const ix = pts[i][0] + nx * ww, iz = pts[i][1] + nz * ww, ox = pts[i][0] + nx * fo, oz = pts[i][1] + nz * fo;
      const cur = [[ix, terrainH(ix, iz) + lift, iz], [ox, terrainH(ox, oz) + lift, oz]];
      if (prev) { const base = g.p.length / 3;
        for (const [p, al] of [[prev[0], 1], [prev[1], 0], [cur[1], 0], [cur[0], 1]]) { g.p.push(p[0], p[1], p[2]); g.u.push(p[0] / tw, p[2] / tw); g.c.push(1, 1, 1, al); }
        if (s > 0) g.i.push(base, base + 2, base + 1, base, base + 3, base + 2); else g.i.push(base, base + 1, base + 2, base, base + 2, base + 3); }
      prev = cur;
    }
  }
  gb.xf = saved;
}
// a strip laid over the ground along a path (roads, paths): pts [[x,z]...], heights from hAt or the terrain
// uvAlong: the texture runs along the strip (kerbs), instead of being projected from above
function drapeStrip(gb, key, pts, w, { lift = 0.06, hAt = null, tw = 3, uvAlong = false } = {}) {
  const L = pts.length; if (L < 2) return;
  if (uvAlong) { let run = 0; const saved = gb.xf; gb.xf = null;
    for (let i = 1; i < L; i++) {
      const E = (k, s) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(L - 1, k + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; const x = pts[k][0] - dz / l * w / 2 * s, z = pts[k][1] + dx / l * w / 2 * s; return [x, terrainH(x, z) + lift, z]; };
      const seg = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / tw;
      gb.quad4(key, E(i - 1, 1), E(i, 1), E(i, -1), E(i - 1, -1), [run, 1], [run + seg, 1], [run + seg, 0], [run, 0], [0, 1, 0]); run += seg;
    }
    gb.xf = saved; return; }
  const edge = (i, s) => {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(L - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1;
    const x = pts[i][0] - dz / l * w / 2 * s, z = pts[i][1] + dx / l * w / 2 * s; const h = hAt ? hAt(i, x, z) : terrainH(x, z);
    return [x, h + lift, z];
  };
  let prevL = edge(0, 1), prevR = edge(0, -1);
  for (let i = 1; i < L; i++) {
    const l = edge(i, 1), r = edge(i, -1);
    gb.quad4(key, prevL, l, r, prevR, [prevL[0] / tw, prevL[2] / tw], [l[0] / tw, l[2] / tw], [r[0] / tw, r[2] / tw], [prevR[0] / tw, prevR[2] / tw], [0, 1, 0]);
    prevL = l; prevR = r;
  }
}
// a flat-ish polygon patch (squares, yards, fields) laid over the ground on a local grid
function drapePatch(gb, key, xf, x0, z0, x1, z1, { cell = 4, lift = 0.05, tw = 3, uvFrame = false } = {}) {
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell)), nz = Math.max(1, Math.ceil((z1 - z0) / cell));
  const P = (a, b) => { const lx = x0 + (x1 - x0) * a / nx, lz = z0 + (z1 - z0) * b / nz; const [wx, wz] = xfP(xf, lx, lz); return { p: [wx, terrainH(wx, wz) + lift, wz], uv: uvFrame ? [lx / tw, lz / tw] : [wx / tw, wz / tw] }; };
  const saved = gb.xf; gb.xf = null;
  for (let b = 0; b < nz; b++) for (let a = 0; a < nx; a++) {
    const A = P(a, b), B = P(a + 1, b), Cc = P(a + 1, b + 1), D = P(a, b + 1);
    gb.quad4(key, A.p, B.p, Cc.p, D.p, A.uv, B.uv, Cc.uv, D.uv, [0, 1, 0]);
  }
  gb.xf = saved;
}
function drapeDisc(gb, key, cx, cz, r, { segs = 16, rings = 3, lift = 0.05, tw = 3, h = null } = {}) {
  const saved = gb.xf; gb.xf = null;
  const P = (rr, a) => { const x = cx + Math.cos(a) * rr, z = cz + Math.sin(a) * rr; return [x, (h ?? terrainH(x, z)) + lift, z]; };
  for (let ring = 0; ring < rings; ring++) {
    const r0 = r * ring / rings, r1 = r * (ring + 1) / rings;
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      const p0 = P(r0, a0), p1 = P(r1, a0), p2 = P(r1, a1), p3 = P(r0, a1); const uv = p => [p[0] / tw, p[2] / tw];
      if (ring === 0) gb.tri(key, p0, p1, p2, uv(p0), uv(p1), uv(p2), [0, 1, 0]);
      else gb.quad4(key, p0, p1, p2, p3, uv(p0), uv(p1), uv(p2), uv(p3), [0, 1, 0]);
    }
  }
  gb.xf = saved;
}
// relief shading for the automap, drawn once
function terrainMapImage(size = 512, landCol = null) {
  const [c, x] = cnv(size, size); const img = x.createImageData(size, size); const a = img.data; const W = TG.R * 2;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const wx = -TG.R + (px + 0.5) / size * W, wz = -TG.R + (py + 0.5) / size * W; const h = terrainH(wx, wz); const k = (py * size + px) * 4;
    if (h < SEA) { a[k] = 29; a[k + 1] = 52; a[k + 2] = 70; a[k + 3] = 255; continue; }
    const n = terrainNormal(wx, wz, 3); const sh = clamp(0.55 + 0.9 * (n[0] * -0.6 + n[2] * -0.6 + n[1] * 0.5 - 0.35), 0.35, 1.25);
    const e = clamp(h / 90, 0, 1); let r = lerp(44, 88, e), g = lerp(56, 80, e), b = lerp(34, 52, e);
    if (h < SEA + 1.2) { r = 106; g = 94; b = 68; }
    if (landCol) { const lc = landCol(wx, wz); if (lc) [r, g, b] = lc; }
    a[k] = r * sh; a[k + 1] = g * sh; a[k + 2] = b * sh; a[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); return c;
}
