/* =====================================================================
   Lands: maps of their own. A new great place is first made on a map of
   its own, apart from the world, and reached as a start of a new game.
   There it is built, judged and put right, and only then laid into the
   world, which gives way to it: the place matters more than whatever the
   generator would have put there (docs/YARNBURY.md).
   A land is a square of ground written out by its definition (LANDS[id],
   in local metres about its own middle): the shape of the land, its
   waters, ways and earthworks, its fields, woods, buildings and people.
   The area draws it once, whole, with the open country's own surfaces,
   materials and plants, so what is made here looks as it will out there.
   It stands where it is meant to go (D.origin, in world metres), but it
   is its own area: the world is not drawn round it.
   ===================================================================== */
const LANDS = {};
const LAND_SMALL = 125; // tufts, flowers and weeds are drawn this near, as in the open country

// one land's ground: heights on a fine grid over the walkable square and a coarse one round it, with what lies on each point
function landGround(D) {
  const C = D.C || 4, R = D.R, N = Math.round(2 * R / C) + 1, CS = D.CS || 24, RS = D.RS, NS = Math.round(2 * RS / CS) + 1;
  const H = new Float32Array(N * N), at = (i, j) => j * N + i, X = i => -R + i * C;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[at(i, j)] = D.base(X(i), X(j));
  // the earthworks: banks, ditches and the beds of the meadows, laid on the land as it lies
  if (D.earth) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) H[at(i, j)] += D.earth(X(i), X(j), H[at(i, j)]);
  const sample = (x, z) => { const fx = clamp((x + R) / C, 0, N - 1.001), fz = clamp((z + R) / C, 0, N - 1.001), i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
    return lerp(lerp(H[at(i, j)], H[at(i + 1, j)], u), lerp(H[at(i, j + 1)], H[at(i + 1, j + 1)], u), v); };
  // the waters: each a line with its level and width at every point
  const waters = (D.waters || []).map(W => ({ ...W, Lc: W.P.reduce((a, p, k) => (a.push(k ? a[k - 1] + Math.hypot(p[0] - W.P[k - 1][0], p[1] - W.P[k - 1][1]) : 0), a), []), box: W.P.reduce((b, [x, z]) => [Math.min(b[0], x), Math.min(b[1], z), Math.max(b[2], x), Math.max(b[3], z)], [1e9, 1e9, -1e9, -1e9]) }));
  // the ways: walked along every 3 m, their grade the ground along them smoothed over some tens of metres, level over their bridges
  const ways = (D.ways || []).map(Wy => { const P = resampleLine(Wy.P, 3); return { ...Wy, P }; });
  const bridges = [];
  ways.forEach((Wy, wi) => {
    const P = Wy.P;
    for (const W of waters) for (let q = 1; q < P.length; q++) for (let p = 1; p < W.P.length; p++) {
      const [ax, az] = P[q - 1], [bx, bz] = P[q], [cx, cz] = W.P[p - 1], [dx, dz] = W.P[p]; if (!segCross(ax, az, bx, bz, cx, cz, dx, dz)) continue;
      const w = Math.max(W.w[p - 1], W.w[p]), wl = (W.wl[p - 1] + W.wl[p]) / 2; if (w < (W.bridgeOver ?? 4.5)) { Wy.fords = (Wy.fords || []).concat([q]); continue; }
      if (bridges.some(b => b.wi === wi && Math.abs(b.q - q) * 3 < b.half + 6)) continue; // (one crossing, found again on the next segment)
      const ang = Math.atan2(bx - ax, bz - az), half = w / 2 + 6, mx = (ax + bx) / 2, mz = (az + bz) / 2, ux = Math.sin(ang), uz = Math.cos(ang);
      const h1 = sample(mx - ux * half, mz - uz * half), h2 = sample(mx + ux * half, mz + uz * half);
      bridges.push({ wi, q, x: mx, z: mz, ang, w, wl, half, deck: W.raised ? wl + (W.deckUp ?? 2.8) : clamp(Math.min(h1, h2), wl + 1.6, wl + 5), stone: !!W.stone }); // (over a stream on its bank the bridge stands well above its lip, so the hump rises out of the bank)
    }
  });
  for (const [wi, Wy] of ways.entries()) {
    for (const b of bridges) if (b.wi === wi && b.fade == null) { const lo = Math.min(sample(b.x - Math.sin(b.ang) * (b.half + 30), b.z - Math.cos(b.ang) * (b.half + 30)), sample(b.x + Math.sin(b.ang) * (b.half + 30), b.z + Math.cos(b.ang) * (b.half + 30))); b.fade = clamp((b.deck - lo) * 2.2, 12, 46); } // (the higher the deck stands over the land, the longer the ramp up to it)
    const P = Wy.P, bs = bridges.filter(b => b.wi === wi), pin = q => { for (const b of bs) { const d = Math.abs(q - b.q) * 3; if (d < b.half + 4 + b.fade) return [b.deck, 1 - smoothstep(b.half + 4, b.half + 4 + b.fade, d)]; } return null; }; // (level for a few metres off each end of a bridge)
    let h = P.map(([x, z]) => sample(x, z));
    for (let it = 0; it < 4; it++) h = h.map((_, q) => { let s = 0, n = 0; for (let k = -6; k <= 6; k++) { s += h[clamp(q + k, 0, h.length - 1)]; n++; } const p = pin(q); return p ? lerp(s / n, p[0], p[1]) : s / n; });
    Wy.h = h; Wy.half = WAY_W[Wy.kind] / 2 - 1.7; // (the levelled ground reaches from the edge of a wider way)
  }
  const onBridge = (x, z, m = 0) => bridges.some(b => { const dx = x - b.x, dz = z - b.z, al = dx * Math.sin(b.ang) + dz * Math.cos(b.ang), ac = -dx * Math.cos(b.ang) + dz * Math.sin(b.ang); return Math.abs(al) < b.half + m && Math.abs(ac) < 2.6 + m; });
  // the ground levelled across each way and brought to its grade, blending back over a few metres
  const best = new Float32Array(N * N).fill(99), tgt = new Float32Array(N * N);
  for (const Wy of ways) for (let q = 1; q < Wy.P.length; q++) {
    const [ax, az] = Wy.P[q - 1], [bx, bz] = Wy.P[q], m = 12;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - m + R) / C)), i1 = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + m + R) / C)), j0 = Math.max(0, Math.floor((Math.min(az, bz) - m + R) / C)), j1 = Math.min(N - 1, Math.ceil((Math.max(az, bz) + m + R) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const s = segDist(X(i), X(j), ax, az, bx, bz), d = s.d - Wy.half, k = at(i, j); if (d < best[k]) { best[k] = d; tgt[k] = lerp(Wy.h[q - 1], Wy.h[q], s.t); } }
  }
  const emb = new Float32Array(N * N);
  for (let k = 0; k < N * N; k++) { if (best[k] > 40) continue; const r = 11 + 0.75 * Math.abs(tgt[k] - H[k]); emb[k] = Math.max(0, tgt[k] - H[k]); if (best[k] < r) H[k] = lerp(H[k], tgt[k], 1 - smoothstep(2.4, r, best[k])); } // (a high bank spreads its foot: its sides keep a steady slope)
  // the waters: the bed cut below the level, a bank raised wherever the land falls away beside the water (steep, on the 4 m grid: the
  // jagged walls of a raised stream), the valley sides let down towards it. As the open country cuts its rivers (src/03_wild.js)
  const rD = new Float32Array(N * N).fill(99), rW = new Float32Array(N * N), rL = new Float32Array(N * N), rS = new Float32Array(N * N), rI = new Int8Array(N * N).fill(-1);
  waters.forEach((W, wi) => { for (let p = 1; p < W.P.length; p++) {
    const [ax, az] = W.P[p - 1], [bx, bz] = W.P[p], m = W.w[p] / 2 + 70;
    const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - m + R) / C)), i1 = Math.min(N - 1, Math.ceil((Math.max(ax, bx) + m + R) / C)), j0 = Math.max(0, Math.floor((Math.min(az, bz) - m + R) / C)), j1 = Math.min(N - 1, Math.ceil((Math.max(az, bz) + m + R) / C));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const k = at(i, j), s = segDist(X(i), X(j), ax, az, bx, bz), hw = lerp(W.w[p - 1], W.w[p], s.t) / 2; if (s.d - hw < rD[k] - rW[k]) { rD[k] = s.d; rW[k] = hw; rL[k] = lerp(W.wl[p - 1], W.wl[p], s.t); rS[k] = lerp(W.Lc[p - 1], W.Lc[p], s.t); rI[k] = wi; } }
  } });
  for (let k = 0; k < N * N; k++) {
    if (rD[k] > rW[k] + 70) continue; const hw = rW[k], d = rD[k], wl = rL[k], x = X(k % N), z = X(Math.floor(k / N)), br = onBridge(x, z, 3), ford = best[k] < 6 && !br;
    const cw = Math.max(hw + 1.6, 6.2), W = waters[rI[k]];
    // a stream held up on a bank of its own (W.raised, wherever the land lies below it): the channel filled; a lip all along, above the water, so
    // none of it shows from below; beyond the lip a crest narrower than the ground's grid, so it rises in peaks wherever a point of the grid
    // falls in it (the bank's own jagged, peaked look), their height wandering; and from it the steep faces down to the land
    if (W && W.raised && (br || H[k] >= wl - 0.6)) { if (d < hw + 0.3) H[k] = Math.min(H[k], wl - 0.85); continue; } // (under its bridge, and wherever the land stands as high, a raised stream keeps to its own channel)
    if (W && W.raised && H[k] < wl - 0.6) { let bd = 1e9; for (const b of bridges) bd = Math.min(bd, Math.hypot(x - b.x, z - b.z));
      const lip = wl + (W.lip ?? 0.9), s = rS[k], c0 = hw + 3.4 + 1.8 * (0.5 + 0.5 * fbm(s / 9 + 3.1, 0.7, 2, 3913)), c1 = c0 + 0.8 + 1.0 * (0.5 + 0.5 * fbm(s / 7 + 8.3, 1.9, 1, 3914));
      const on = smoothstep(-0.05, 0.2, fbm(s / 4.2 + 7.7, d * 0.02 + 0.4, 1, 3915)) * smoothstep(W.saddle ? W.saddle[0] : 16, W.saddle ? W.saddle[1] : 30, bd), peak = lip + on * (W.teeth ?? 3) * (0.45 + 0.55 * smoothstep(-0.4, 0.4, fbm(s / 8 + 1.7, 0.31, 2, 3911)));
      if (d < hw + 0.3) H[k] = Math.max(H[k], wl - 0.85);
      else if (d < c0) H[k] = Math.max(H[k], lip);
      else if (d < c1) H[k] = Math.max(H[k], peak);
      else H[k] = Math.max(H[k], lerp(lip, H[k], smoothstep(c1, c1 + 6, d)));
      continue; }
    if (d < cw) { const bed = ford ? wl - 0.25 : wl - (0.35 + hw * 0.08) * (1 - 0.6 * (d / cw) ** 2) - 0.08; H[k] = Math.min(H[k], bed); }
    else if (br) continue; // the bridge's approaches keep the height of its deck
    else { const bank = wl + 0.3 + 0.5 * smoothstep(2, 6, hw), raise = bank - H[k]; if (raise > 0) H[k] += raise * (1 - smoothstep(cw, cw + 6, d)); else { const e = d - cw; H[k] = Math.min(H[k], bank + e * (0.26 + 0.1 * fbm(x / 40, z / 40, 2, 3901))); } }
  }
  // the coarse ground round it: the same land, its waters only let down to their level (out there it is only seen through the haze)
  const HS = new Float32Array(NS * NS), XS = i => -RS + i * CS;
  for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) { const x = XS(i), z = XS(j); let h = D.base(x, z);
    for (const W of waters) { if (x < W.box[0] - 80 || x > W.box[2] + 80 || z < W.box[1] - 80 || z > W.box[3] + 80) continue; for (let p = 1; p < W.P.length; p++) { const s = segDist(x, z, ...W.P[p - 1], ...W.P[p]), hw = lerp(W.w[p - 1], W.w[p], s.t) / 2, wl = lerp(W.wl[p - 1], W.wl[p], s.t); if (s.d < hw + 40) h = Math.min(h, lerp(wl - 0.8, h, smoothstep(hw + 4, hw + 40, s.d))); } }
    HS[j * NS + i] = h; }
  // heights read as the drawn triangles lie (each square split from its first corner to its last), so feet and drapes sit on the ground drawn
  const tri = (A, n, c, r, x, z) => { const fx = (x + r) / c, fz = (z + r) / c, i = clamp(Math.floor(fx), 0, n - 2), j = clamp(Math.floor(fz), 0, n - 2), u = fx - i, v = fz - j, k = j * n + i;
    const h00 = A[k], h10 = A[k + 1], h01 = A[k + n], h11 = A[k + n + 1]; return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v; };
  const local = (x, z) => Math.max(Math.abs(x), Math.abs(z)) < R - 0.01 ? tri(H, N, C, R, x, z) : tri(HS, NS, CS, RS, x, z);
  const qAt = (A, x, z) => { const i = clamp(Math.round((x + R) / C), 0, N - 1), j = clamp(Math.round((z + R) / C), 0, N - 1); return A[at(i, j)]; };
  return { D, C, R, N, H, CS, RS, NS, HS, X, XS, at, rD, rW, rL, rI, best, emb, waters, ways, bridges, onBridge, local, qAt,
    water(x, z) { const k = at(clamp(Math.round((x + R) / C), 0, N - 1), clamp(Math.round((z + R) / C), 0, N - 1)); return rD[k] < rW[k] + 0.6 ? rL[k] : null; } };
}
// a line walked at an even step (its corners kept close)
function resampleLine(P, step) {
  const out = [P[0].slice()]; let carry = 0;
  for (let k = 1; k < P.length; k++) { const [ax, az] = P[k - 1], [bx, bz] = P[k], L = Math.hypot(bx - ax, bz - az); let t = step - carry;
    while (t <= L) { out.push([ax + (bx - ax) * t / L, az + (bz - az) * t / L]); t += step; } carry = L - (t - step); }
  const e = P[P.length - 1]; if (Math.hypot(e[0] - out[out.length - 1][0], e[1] - out[out.length - 1][1]) > step * 0.3) out.push(e.slice()); return out;
}
// a smooth line through a few points (Catmull-Rom), walked every `step` metres
function smoothLine(P, step = 4) {
  const out = [];
  for (let k = 0; k < P.length - 1; k++) { const p0 = P[Math.max(0, k - 1)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(P.length - 1, k + 2)], n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
    for (let s = 0; s < n; s++) { const t = s / n, t2 = t * t, t3 = t2 * t, f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3); out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]); } }
  out.push(P[P.length - 1].slice()); return out;
}

// the whole land as an area of its own
function buildLand(id) {
  const D = LANDS[id], t0 = performance.now(), [OX, OZ] = D.origin;
  const area = newArea('land'); area.landId = id; area.name = D.name; area.floorY = 0; area.music = D.music || 'wild'; area.open = 1.55; area.bbs = []; area.waterMat = true;
  const mats = worldMats(area, CITY_MATS);
  // the sea keeps some colour to the horizon, as it does from the city (src/04_city.js)
  mats.wSea.onBeforeCompile = mats.water.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', '#ifdef USE_FOG\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * vec3(0.9, 0.9, 1.0), smoothstep(60.0, 800.0, vFogDepth) * 0.55);\n float fogFactor = smoothstep(fogNear, fogFar, vFogDepth * 0.55);\n gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor * vec3(0.84, 0.9, 0.96), fogFactor);\n#endif'); };
  const winA = new THREE.MeshBasicMaterial({ map: TEX.winDay, vertexColors: true }), winB = new THREE.MeshBasicMaterial({ map: TEX.winDay, vertexColors: true }), lantern = new THREE.MeshBasicMaterial({ map: TEX.lantern, vertexColors: true });
  mats.winA = winA; mats.winB = winB; mats.lantern = lantern;
  area.special = { winA, winB, lantern, glowMat: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0 }) };
  addSky(area);
  const L = landGround(D); area.land = L; L.area = area; L.origin = D.origin;
  area.heightAt = (x, z) => L.local(x - OX, z - OZ); L.heightAt = (x, z) => L.local(x, z);
  const root = new THREE.Group(); root.position.set(OX, 0, OZ); root.matrixAutoUpdate = false; root.updateMatrix(); area.scene.add(root); area.root = root;
  const savedH = GROUND_H; GROUND_H = L.heightAt; // (the drapes and the buildings read this land's ground, in its own metres, while it is made)
  const fl = {}; for (const k in WILD_KINDS) fl[k] = [];
  const cols = []; area.colliders = cols;
  try {
    landMeshes(L, mats, root);
    const gb = new GB(), near = new GB(); L.gb = gb; L.near = near; L.fl = fl; L.mats = mats; L.cols = cols;
    // the waters' surfaces: one ribbon along each, level across, falling downstream
    for (const W of L.waters) if (!W.hidden) { const P = resampleLine(W.P, 2.5), wl = P.map(([x, z]) => { let bd = 1e9, h = W.wl[0]; for (let p = 1; p < W.P.length; p++) { const s = segDist(x, z, ...W.P[p - 1], ...W.P[p]); if (s.d < bd) { bd = s.d; h = lerp(W.wl[p - 1], W.wl[p], s.t); } } return h; }), wd = P.map(([x, z]) => { let bd = 1e9, w = W.w[0]; for (let p = 1; p < W.P.length; p++) { const s = segDist(x, z, ...W.P[p - 1], ...W.P[p]); if (s.d < bd) { bd = s.d; w = lerp(W.w[p - 1], W.w[p], s.t); } } return w; });
      landRibbon(gb, 'wStream', P, wd.map(w => w + 0.8), wl.map(h => h + 0.02)); }
    // the ways: a lane's bare earth with ragged edges, a cart track's ruts; broken at their bridges
    for (const Wy of L.ways) { const runs = []; let cur = [];
      for (const p of Wy.P) { if (L.onBridge(p[0], p[1], -0.6)) { if (cur.length > 1) runs.push(cur); cur = []; continue; } cur.push(p); } if (cur.length > 1) runs.push(cur);
      runs.forEach((run, ri) => { const sd = Wy.seed || 0; if (Wy.kind === WAY.lane) { drapeStrip(gb, 'rDirt', run, 2.5, { lift: 0.068 }); drapeFeather(gb, 'rDirtF', run, 2.5, 0.6, { seed: sd + ri }); }
        else if (Wy.kind === WAY.green) { for (const o of [-0.68, 0.68]) { const rut = offsetLine(run, o); drapeStrip(gb, 'rDirt', rut, 0.5, { lift: 0.066 }); drapeFeather(gb, 'rDirtF', rut, 0.5, 0.5, { seed: sd + ri + (o > 0 ? 7 : 0) }); } }
        else { drapeStrip(gb, 'rDirtCart', run, 3.4, { lift: 0.07, uvAlong: true, tw: 3.4 }); drapeFeather(gb, 'rDirtF', run, 3.4, 0.45, { seed: sd + ri }); } }); }
    for (const b of L.bridges) bridgeMesh(gb, b, cols);
    if (D.build) D.build(L, gb, near, fl, cols);
    if (D.plants) D.plants(L, fl, cols);
    const far = gb.build(mats), nearM = near.build(mats); far.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); }); nearM.traverse(o => { o.matrixAutoUpdate = false; o.updateMatrix(); });
    root.add(far); root.add(nearM); area.nearDetail = nearM; L.gb = L.near = null;
  } finally { GROUND_H = savedH; }
  if (L.smoke) makeSmoke(area, L.smoke.map(s => ({ ...s, x: s.x + OX, z: s.z + OZ })), new RNG(8801)); // (a fire's smoke)
  for (const f of L.flags || []) makeFlag(area, TEX[f.tex || 'bannerRed'], f.x + OX, f.y, f.z + OZ, f.ang || 0, f.w, f.h); // (flags wave in the area's own scene)
  // the solids, moved out to where the land stands
  for (const c of cols) { c.x0 += OX; c.x1 += OX; c.z0 += OZ; c.z1 += OZ; if (c.o) { c.o.x += OX; c.o.z += OZ; } }
  buildColliderGrid(area);
  // the plants, in pools that turn on the graphics card (the open country's own): trees always, the small ones only near
  area.pools = {}; area.smallCells = new Map(); area.smallAt = null;
  for (const [k, def] of Object.entries(WILD_KINDS)) { const list = fl[k]; if (!list.length) continue; const [tex, seed, w, h, , small] = def, [, sk, fr] = tex.split(':');
    const pool = area.pools[k] = new WildPool(area, tex.startsWith('s:') ? simpleSprite(sk, { flowers: 4, heather: 2, weed: 3 }[sk] || 1).tex[+fr || 0] : treeSprite(tex, seed).tex[0], w, h, small ? (/^flowers/.test(k) ? 1 : 0.8) : 0);
    for (const p of list) { p[0] += OX; p[2] += OZ; }
    if (small) { const cells = new Map(); for (const p of list) { const ck = Math.floor(p[0] / 64) * 100003 + Math.floor(p[2] / 64); let l = cells.get(ck); if (!l) cells.set(ck, l = []); l.push(p); } area.smallCells.set(k, cells); }
    else pool.set([list]); }
  if (D.sprites) for (const s of D.sprites(L)) new SpriteBatch(area, s.tex, s.w, s.h, s.at.map(([x, y, z, sc]) => [x + OX, y, z + OZ, sc]));
  area.update = dt => landUpdate(area, dt);
  area.footing = (p, ox, oz) => landFooting(area, p, ox, oz);
  area.toWorld = (x, z) => [x + OX, z + OZ];
  if (D.nearAt) { area.nearAt = [D.nearAt[0] + OX, D.nearAt[1] + OZ]; area.nearR = D.nearR; } // (the small detail is drawn only near its middle)
  area.start = D.start; area.buildMs = Math.round(performance.now() - t0);
  return area;
}
// the ground itself: the fine square in tiles (grass, bare earth on the steep faces by the ways and on banks, mud along the water), the
// coarse ground round it, an apron under the fine square's edge so no crack shows between them, and the sea where the land falls below it
function landMeshes(L, mats, root) {
  const { D, N, H, C, R, at, rD, rW, best } = L;
  const col = new Float32Array(N * N * 3), qE = new Float32Array(N * N), qW = new Float32Array(N * N);
  const hb = (i, j) => H[at(clamp(i, 0, N - 1), clamp(j, 0, N - 1))];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = at(i, j), x = L.X(i), z = L.X(j), h = H[k], gx = (hb(i + 1, j) - hb(i - 1, j)) / (2 * C), gz = (hb(i, j + 1) - hb(i, j - 1)) / (2 * C), sl = Math.hypot(gx, gz);
    const n = v3norm([-gx * 2.4, 1, -gz * 2.4]), sh = terrainShade(n);
    let avg = 0; for (const [di, dj] of CAV8) avg += hb(i + di, j + dj); avg /= 8;
    const lush = rD[k] < 90 ? 1 - smoothstep(rW[k] + 2, rW[k] + 12, rD[k]) : 0, cav = clamp(1 + (h - avg) * 0.045, 0.72, 1.1), wet = clamp((avg - h) * 0.12 + lush * 0.9, -1, 1);
    const t = D.tint(x, z, h, n, { lush, sl });
    col[k * 3] = sh[0] * t[0] * cav * (1 - 0.05 * wet); col[k * 3 + 1] = sh[1] * t[1] * cav * (1 + 0.04 * wet); col[k * 3 + 2] = sh[2] * t[2] * cav * (1 - 0.06 * Math.max(0, -wet));
    const bw = 2.5 + 0.55 * L.emb[k]; qE[k] = (1 - smoothstep(bw, bw + 4.5, best[k])) * smoothstep(0.22, 0.5, sl); if (D.bare) qE[k] = Math.max(qE[k], D.bare(x, z, h, sl));
    const mw = 1.1 + 3.6 * smoothstep(-0.35, 0.45, fbm(x / 24, z / 24, 2, 372)); qW[k] = rD[k] < 90 ? 1 - smoothstep(rW[k] + 0.2, rW[k] + mw, rD[k]) : 0;
  }
  const T = 50, tiles = Math.ceil((N - 1) / T);
  for (let tj = 0; tj < tiles; tj++) for (let ti = 0; ti < tiles; ti++) {
    const groups = new Map(), grp = k => { let g = groups.get(k); if (!g) groups.set(k, g = { p: [], u: [], c: [], i: [] }); return g; };
    const put = (key, i, j, alpha) => { const g = grp(key), base = g.p.length / 3; if (alpha) g.rgba = true;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = at(i + di, j + dj), x = L.X(i + di), z = L.X(j + dj); g.p.push(x, H[k], z); g.u.push(x / 5, z / 5); g.c.push(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]); if (alpha) g.c.push(alpha[k]); }
      g.i.push(base, base + 3, base + 1, base, base + 2, base + 3); };
    for (let j = tj * T; j < Math.min(N - 1, (tj + 1) * T); j++) for (let i = ti * T; i < Math.min(N - 1, (ti + 1) * T); i++) {
      const ks = [at(i, j), at(i + 1, j), at(i, j + 1), at(i + 1, j + 1)], hs = ks.map(k => H[k]); if (Math.max(...hs) < SEA - 3) continue;
      put('tGrass', i, j);
      if (Math.max(...ks.map(k => qE[k])) > 0.02) put('wEarthO', i, j, qE);
      if (Math.max(...ks.map(k => qW[k])) > 0.02 && Math.min(...ks.map(k => qW[k])) < 0.97) put('wMudO', i, j, qW);
    }
    for (const [k, g] of groups) { const m = groupMesh(g, mats[k]); m.renderOrder = { wMudO: 1, wEarthO: 1 }[k] || 0; root.add(m); }
  }
  // the apron: down and out from the fine square's edge, under the coarse ground beside it
  { const g = { p: [], u: [], c: [], i: [] }, o = 2 * C;
    const edge = (i0, j0, i1, j1, ox, oz) => { const k0 = at(i0, j0), k1 = at(i1, j1), xa = L.X(i0), za = L.X(j0), xb = L.X(i1), zb = L.X(j1), base = g.p.length / 3;
      g.p.push(xa, H[k0], za, xb, H[k1], zb, xb + ox * o, H[k1] - 6, zb + oz * o, xa + ox * o, H[k0] - 6, za + oz * o); g.u.push(xa / 5, za / 5, xb / 5, zb / 5, (xb + ox * o) / 5, (zb + oz * o) / 5, (xa + ox * o) / 5, (za + oz * o) / 5);
      for (const k of [k0, k1, k1, k0]) g.c.push(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]); g.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2); };
    for (let q = 0; q < N - 1; q++) { edge(q, 0, q + 1, 0, 0, -1); edge(q, N - 1, q + 1, N - 1, 0, 1); edge(0, q, 0, q + 1, -1, 0); edge(N - 1, q, N - 1, q + 1, 1, 0); }
    root.add(groupMesh(g, mats.tGrass)); }
  // the coarse ground: every square that lies outside the fine one (it tucks a little under it), coloured as the land would be there
  { const { NS, HS, XS, CS, RS } = L, g = { p: [], u: [], c: [], i: [] }, cs = new Float32Array(NS * NS * 3), hs = (i, j) => HS[clamp(j, 0, NS - 1) * NS + clamp(i, 0, NS - 1)];
    for (let j = 0; j < NS; j++) for (let i = 0; i < NS; i++) { const k = j * NS + i, x = XS(i), z = XS(j), h = HS[k], gx = (hs(i + 1, j) - hs(i - 1, j)) / (2 * CS), gz = (hs(i, j + 1) - hs(i, j - 1)) / (2 * CS), n = v3norm([-gx * 2.4, 1, -gz * 2.4]), sh = terrainShade(n), t = D.tint(x, z, h, n, { lush: 0, sl: Math.hypot(gx, gz), far: true });
      cs[k * 3] = sh[0] * t[0]; cs[k * 3 + 1] = sh[1] * t[1]; cs[k * 3 + 2] = sh[2] * t[2]; }
    for (let j = 0; j < NS - 1; j++) for (let i = 0; i < NS - 1; i++) { const x0 = XS(i), z0 = XS(j); if (x0 >= -R + CS * 0.5 && x0 + CS <= R - CS * 0.5 && z0 >= -R + CS * 0.5 && z0 + CS <= R - CS * 0.5) continue;
      const ks = [j * NS + i, j * NS + i + 1, (j + 1) * NS + i, (j + 1) * NS + i + 1]; if (Math.max(...ks.map(k => HS[k])) < SEA - 3) continue; const base = g.p.length / 3;
      for (const [di, dj] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const k = (j + dj) * NS + i + di, x = XS(i + di), z = XS(j + dj), inner = Math.max(Math.abs(x), Math.abs(z)) < R; g.p.push(x, HS[k] - (inner ? 2.5 : 0), z); g.u.push(x / 5, z / 5); g.c.push(cs[k * 3], cs[k * 3 + 1], cs[k * 3 + 2]); }
      g.i.push(base, base + 3, base + 1, base, base + 2, base + 3); }
    root.add(groupMesh(g, mats.tGrass)); }
  // the sea, wherever the land goes under it
  { const RS = L.RS * 1.25, g = { p: [], u: [], c: [], i: [] }, n = 24, st = 2 * RS / n; // (in squares, the texture repeated over them: one stretched over the whole sea reads as a dark band)
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x0 = -RS + i * st, z0 = -RS + j * st, base = g.p.length / 3; if (Math.max(...[[x0, z0], [x0 + st, z0], [x0, z0 + st], [x0 + st, z0 + st]].map(([x, z]) => D.base(x, z))) < SEA - 0.2 || D.base(x0 + st / 2, z0 + st / 2) < SEA + 6) {
      for (const [x, z] of [[x0, z0], [x0 + st, z0], [x0, z0 + st], [x0 + st, z0 + st]]) { g.p.push(x, SEA, z); g.u.push(x / 7, z / 7); g.c.push(1, 1, 1); } g.i.push(base, base + 3, base + 1, base, base + 2, base + 3); } }
    if (g.i.length) { const m = groupMesh(g, mats.wSea); m.renderOrder = -1; root.add(m); } }
}
// a ribbon of water along a line: level across, at its own level and width at each point
function landRibbon(gb, key, P, W, Y) {
  const g = gb.grp(key), saved = gb.xf; gb.xf = null; let run = 0;
  for (let q = 0; q < P.length; q++) { const a = P[Math.max(0, q - 1)], b = P[Math.min(P.length - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / l, nz = (b[0] - a[0]) / l, hw = W[q] / 2;
    if (q) run += Math.hypot(P[q][0] - P[q - 1][0], P[q][1] - P[q - 1][1]);
    const base = g.p.length / 3; g.p.push(P[q][0] + nx * hw, Y[q], P[q][1] + nz * hw, P[q][0] - nx * hw, Y[q], P[q][1] - nz * hw); g.u.push(0, run / 6, hw / 3, run / 6); g.c.push(1, 1, 1, 1, 1, 1);
    if (q) g.i.push(base - 2, base, base - 1, base - 1, base, base + 1); }
  gb.xf = saved;
}
// a line moved sideways by o metres
function offsetLine(P, o) { return P.map((p, q) => { const a = P[Math.max(0, q - 1)], b = P[Math.min(P.length - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * o, p[1] + (b[0] - a[0]) / l * o]; }); }

// each frame in a land: the small plants near you, its people by day
function landUpdate(area, dt) {
  const P = G.player, cp = camera.position;
  if (!area.smallAt || Math.hypot(cp.x - area.smallAt[0], cp.z - area.smallAt[1]) > 16) { area.smallAt = [cp.x, cp.z];
    for (const [k, cells] of area.smallCells) { const lists = []; const ci = Math.floor(cp.x / 64), cj = Math.floor(cp.z / 64), r = Math.ceil(LAND_SMALL / 64);
      for (let a = ci - r; a <= ci + r; a++) for (let b = cj - r; b <= cj + r; b++) { const l = cells.get(a * 100003 + b); if (l && Math.hypot((a + 0.5) * 64 - cp.x, (b + 0.5) * 64 - cp.z) < LAND_SMALL + 46) lists.push(l); }
      area.pools[k].set(lists); } }
  if (area.nearDetail) area.nearDetail.visible = !area.nearAt || Math.hypot(cp.x - area.nearAt[0], cp.z - area.nearAt[1]) < area.nearR;
  const D = LANDS[area.landId]; if (!P || !D.folk) return;
  if (!area.folk) { const [OX, OZ] = D.origin; area.folk = D.folk.map((f, k) => { const r = new RNG(9150 + k), g = f.gender || (r.chance(0.5) ? 'f' : 'm');
    return spawnNPC(area, { name: personName(r, g), look: { ...lookByWealth(r, g, f.wealth ?? 0.9), ...f.look }, gender: g, x: f.at[0] + OX, z: f.at[1] + OZ, role: 'wander', wanderR: f.r, speed: 0.9, dialog: 'household', spriteKey: area.landId + k, data: { site: area.landId, trade: f.trade, lines: f.lines } }); }); }
  const night = isNight(G.time); for (const e of area.folk) if (!e.dead) e.active = !night;
}
// on foot in a land: no climbing the steep faces, no wading into the water deeper than the knee, and the land ends where it was made
function landFooting(area, p, ox, oz) {
  const L = area.land, [OX, OZ] = L.origin, R = L.R - 14;
  const lx = p.pos.x - OX, lz = p.pos.z - OZ;
  if (Math.abs(lx) > R || Math.abs(lz) > R) { p.pos.x = clamp(lx, -R, R) + OX; p.pos.z = clamp(lz, -R, R) + OZ; if (!area.edgeSaid || G.clock - area.edgeSaid > 12) { area.edgeSaid = G.clock; msg('The country beyond here is not yet made. You turn back.'); } }
  const g0 = area.heightAt(ox, oz);
  const bad = (x, z) => { const g = area.heightAt(x, z), wl = L.water(x - OX, z - OZ);
    if (wl != null && g < wl - 0.55 && !(groundAt(area, x, z, 0.3, p.pos.y + 0.45) > g + 0.005)) return true; // the water itself (a bridge over it is walked on)
    if (g <= g0 + 0.01 || p.pos.y > g + 0.3) return false; const e = 2, sl = Math.hypot(area.heightAt(x + e, z) - area.heightAt(x - e, z), area.heightAt(x, z + e) - area.heightAt(x, z - e)) / (2 * e);
    return sl > 1.2 && !(groundAt(area, x, z, 0.3, p.pos.y + 0.45) > g + 0.005); };
  if (!bad(p.pos.x, p.pos.z)) return;
  if (!bad(p.pos.x, oz)) p.pos.z = oz; else if (!bad(ox, p.pos.z)) p.pos.x = ox; else { p.pos.x = ox; p.pos.z = oz; }
}
