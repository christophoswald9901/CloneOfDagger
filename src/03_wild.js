/* =====================================================================
   The wild: the country beyond the surveyed land round the city is
   generated as you walk. Square chunks of ground with their woods, fields,
   rocks and tracks stream in around the player; a coarse horizon mesh
   carries the hills and mountains out to the edge of sight. No fence rings
   the world any more: the sea is its only shore.
   ===================================================================== */
// one haze for everything: beyond 450 m it thickens more slowly, so far hills and a far city fade alike
THREE.ShaderChunk.fog_fragment = THREE.ShaderChunk.fog_fragment.replace('smoothstep( fogNear, fogFar, vFogDepth )', 'smoothstep( fogNear, fogFar, vFogDepth < 450.0 ? vFogDepth : 450.0 + ( vFogDepth - 450.0 ) * 0.7 )');
// the far haze: it keeps a little of the light and shade of what it covers, so far slopes and far trees fade alike
const FAR_FOG = `#ifdef USE_FOG
        float fd = vFogDepth < 450.0 ? vFogDepth : 450.0 + (vFogDepth - 450.0) * 0.7;
        float fogFactor = smoothstep(fogNear, fogFar, fd);
        vec3 fc = fogColor * clamp(0.72 + 0.5 * dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)), 0.8, 1.12);
        float farK = smoothstep(700.0, 3000.0, vFogDepth); // far off, the lowland keeps a trace of its light and shade, cooler with distance (no white band below the mountains)
        fogFactor = min(fogFactor, 1.0 - 0.15 * farK); fc = mix(fc, fc * vec3(0.88, 0.93, 1.02), farK);
        #ifdef FAR_HIGH
        float hiK = smoothstep(140.0, 460.0, vWy);
        fogFactor *= mix(1.0, 0.6, hiK); // high ground keeps its shape through the haze, so the mountains stand on the skyline,
        fc = mix(fc, fc * vec3(0.74, 0.82, 0.97), hiK * smoothstep(1500.0, 6000.0, vFogDepth)); // blue-grey with distance
        #endif
        gl_FragColor.rgb = mix(gl_FragColor.rgb, fc, fogFactor);
      #endif`;
const WC = 176, WCELL = 4, WN = WC / WCELL;   // chunk size, cell size, cells per side: aligned with the city's fine grid
const WILD = {
  near: 400, drop: 470,      // chunks whose square comes this close get full ground; they go again past `drop`
  trees: 430, small: 125,    // trees stand in chunks this close, tufts and flowers only nearer
  budget: 5,                 // milliseconds of building per frame
};
// sprite pools: texture (tree kind + seed, or s:simple[:frame]), width, height, trunk height for a collider (0: none), near-only
const WILD_KINDS = {
  oak0: ['oak', 10, 6, 10, 9], oak1: ['oak', 11, 6, 10, 9], oak2: ['oak', 12, 6, 10, 9], pine: ['pine', 20, 5, 12, 11], dead: ['dead', 30, 5.4, 9, 8],
  cypress: ['cypress', 40, 2.1, 7, 6.5], grove: ['grove', 60, 9.5, 7, 8], bush: ['bush', 50, 2.4, 1.5, 0], bushB: ['bushB', 51, 2.4, 1.5, 0], sheep: ['s:sheep', 0, 1.4, 1.0, 0],
  flowers0: ['s:flowers:0', 0, 0.8, 0.4, 0, true], flowers1: ['s:flowers:1', 0, 0.8, 0.4, 0, true], flowers2: ['s:flowers:2', 0, 0.8, 0.4, 0, true], flowers3: ['s:flowers:3', 0, 0.8, 0.4, 0, true],
  tufts: ['s:tuft', 0, 0.95, 0.55, 0, true], fern: ['s:fern', 0, 1.3, 0.65, 0, true], reeds: ['s:reeds', 0, 1.1, 1.3, 0, true],
  heather0: ['s:heather:0', 0, 1.25, 0.62, 0, true], heather1: ['s:fern', 0, 1.3, 0.65, 0, true], // the lower heath is summer bracken: green fronds
  tgrass: ['s:tgrass', 0, 1.0, 1.0, 0, true], weed0: ['s:weed:0', 0, 0.5, 0.68, 0, true], weed1: ['s:weed:1', 0, 0.52, 0.7, 0, true], weed2: ['s:weed:2', 0, 0.55, 0.72, 0, true],
  rush: ['s:rush', 0, 0.85, 0.7, 0, true], pebbles: ['s:pebbles', 0, 1.2, 0.45, 0, true],
  hay: ['s:hay', 0, 2.6, 2.0, 0],
};
const FIELD_KEYS = [['fMeadow', 0.3], ['fWheat', 0.3], ['fBarley', 0.18], ['fPlowed', 0.16], ['fGreens', 0.06]];
// the tree line rises inland with the land itself; the snow lies some way above it
function wildTreeLine(x, z) { return 150 + 95 * smoothstep(1500, 14000, coastZ(x) - z) + 110 * smoothstep(2200, 500, rimDist(x, z)) + 24 * fbm(x / 260, z / 260, 2, 331); } // (and climbs the flanks of the great mountains at the world's edge)
function wildSnowLine(x, z) { return wildTreeLine(x, z) + 210; }
// how far the land is farmed: the hand-made fields carry on outwards and thin out over a kilometre or so, the city's farmland
// rings it (but not where woods meet the surveyed square), and a belt runs along the tracks far out into the country
function wildCult(x, z) {
  if (Math.abs(x) < TG.R && Math.abs(z) < TG.R) return 0; // the surveyed square keeps its own
  const band = 0.8 * (1 - smoothstep(40, 300, Wild.handFD(x, z))); // (the turf between the hand-made fields and the first generated ones)
  return Math.max(band, Settle.cultAt(x, z)) * (1 - siteWild(x, z)) * (1 - townCore(x, z)); // the settlement plan: its fields, pasture and commons (no generated farmland in a site)
}

// a pool of billboards that turn to the camera on the graphics card, so thousands cost nothing per frame
class WildPool {
  constructor(area, tex, w, h, dim = 0) {
    this.area = area; this.geo = planeGeo(w, h); this.mat = spriteMat(tex); area.tintMats.push(this.mat);
    if (dim && dim < 1) this.mat.userData.base = new THREE.Color(dim, dim, dim * 0.96); // the small plants stand in the turf's own light, not brighter than it
    this.mat.onBeforeCompile = sh => { sh.uniforms.wYaw = Wild.yawU; sh.vertexShader = 'uniform float wYaw;\n' + sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3(position.x * cos(wYaw), position.y, -position.x * sin(wYaw));' + (dim ? '\n#ifdef USE_INSTANCING\n transformed *= 1.0 - smoothstep(80.0, 120.0, distance((modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz, cameraPosition));\n#endif' : '')); sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', FAR_FOG); }; // (the small plants dwindle to nothing some 100 m off, where they would be a pixel: thousands fewer to draw)
    this.mat.customProgramCacheKey = () => 'wildBillboard' + (dim ? 'S' : '');
    this.mesh = null; this.cap = 0; this._m = new THREE.Matrix4(); this.grow(512);
  }
  grow(n) {
    if (this.mesh) { this.area.scene.remove(this.mesh); this.mesh.dispose(); }
    this.cap = n; this.mesh = new THREE.InstancedMesh(this.geo, this.mat, n); this.mesh.count = 0; this.mesh.frustumCulled = false; this.area.scene.add(this.mesh);
  }
  set(lists) {
    let n = 0; for (const l of lists) n += l.length;
    if (n > this.cap) this.grow(Math.ceil(n * 1.3));
    const m = this._m.elements; let k = 0;
    for (const l of lists) for (const p of l) { const s = p[3] || 1; m.fill(0); m[0] = m[5] = m[10] = s; m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1; this.mesh.setMatrixAt(k++, this._m); }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
// mean linear colour of a texture, so the horizon mesh (colour in its vertices) matches the textured ground up close
function texMeanLin(key) {
  const c = TEX[key].image, x = c.getContext('2d'), d = x.getImageData(0, 0, c.width, c.height).data, s = [0, 0, 0];
  for (let i = 0; i < d.length; i += 4) for (let q = 0; q < 3; q++) { const v = d[i + q] / 255; s[q] += v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }
  return s.map(v => v / (d.length / 4));
}

const Wild = {
  on: false, area: null, env: null, chunks: new Map(), job: null, jobKey: null, dirty: false,
  yawU: { value: 0 }, pools: {}, tracks: [], tD: null,
  // the far ground, beyond the chunks: a finer ring out to some 1.2 km and a coarse one to some 3 km, each kept round the camera.
  // A chunk's square of far ground is not drawn while the chunk itself is there (the mask), and the coarse ring is not drawn over the fine one
  FAR: [{ C: 16, R: 1232, snap: WC, move: WC * 2, inner: true }, { C: 64, R: 3072, snap: WC * 4, move: WC * 6 }],
  maskU: { value: null }, innerU: { value: new THREE.Vector4(1e9, 1e9, -1e9, -1e9) }, outerU: { value: new THREE.Vector4(-3072, -3072, 3072, 3072) },

  init(area, env) {
    this.area = area; this.env = env; this.on = true;
    for (const [k, [tex, seed, w, h, , small]] of Object.entries(WILD_KINDS)) {
      const [, sk, fr] = tex.split(':'); this.pools[k] = new WildPool(area, tex.startsWith('s:') ? simpleSprite(sk, { flowers: 4, heather: 2, weed: 3 }[sk] || 1).tex[+fr || 0] : treeSprite(tex, seed).tex[0], w, h, small ? (/^flowers/.test(k) ? 1 : 0.8) : 0);
    }
    // which chunks have their full ground (and the surveyed square): one texel a chunk over the whole world
    { const N = 128, d = new Uint8Array(N * N * 4), t = new THREE.DataTexture(d, N, N, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; this.maskData = d; this.maskTex = t; this.maskU.value = t;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) this.setMask(i, j, true); }
    // the far ground's haze matches the near ground's, then turns bluer with distance; it is not drawn where nearer ground lies
    const farShader = (m, outer, pull = false) => { m.onBeforeCompile = sh => {
      sh.uniforms.wMask = this.maskU; sh.uniforms.wInner = this.innerU; sh.uniforms.wOuter = this.outerU;
      sh.vertexShader = 'varying vec2 vWxz; varying float vWy;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n { vec4 wp = modelMatrix * vec4(transformed, 1.0); vWxz = wp.xz; vWy = wp.y; }');
      if (pull) sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0); mvPosition.xyz *= 0.995; gl_Position = projectionMatrix * mvPosition;'); // (rivers drawn over the far ground win where it would hide them)
      sh.fragmentShader = '#define FAR_HIGH\nuniform sampler2D wMask; uniform vec4 wInner; uniform vec4 wOuter; varying vec2 vWxz; varying float vWy;\n' + sh.fragmentShader.replace('void main() {', `void main() {
        if (texture2D(wMask, (floor((vWxz + 352.0) / 176.0) + vec2(64.5, 112.5)) / 128.0).r > 0.5) discard;
        ${outer === 1 ? 'if (vWxz.x > wInner.x + 64.0 && vWxz.y > wInner.y + 64.0 && vWxz.x < wInner.z - 64.0 && vWxz.y < wInner.w - 64.0) discard;' : outer === 2 ? 'if (vWxz.x > wOuter.x + 200.0 && vWxz.y > wOuter.y + 200.0 && vWxz.x < wOuter.z - 200.0 && vWxz.y < wOuter.w - 200.0) discard;' : ''}`).replace('#include <fog_fragment>', FAR_FOG); };
      m.customProgramCacheKey = () => 'wildFar' + outer + (pull ? 'p' : ''); };
    farShader(env.mats.wFar, 0); farShader(env.mats.wFarR, 0, true); farShader(env.mats.wFarO, 1); farShader(env.mats.wFarRO, 1, true); farShader(env.mats.wFarH, 2);
    // the coarse ring reaches a cell under the fine one, pushed back in depth: where they overlap the fine ground shows, and no crack opens between them
    for (const m of [env.mats.wFarO]) { m.polygonOffset = true; m.polygonOffsetFactor = 2; m.polygonOffsetUnits = 16; }
    { const m = env.mats.wFarH; m.polygonOffset = true; m.polygonOffsetFactor = 4; m.polygonOffsetUnits = 32; } // and the whole country's mesh under the coarse ring, likewise
    this.farTrees = { grove: new FarTrees(area, treeSprite('grove', 60).tex[0], 10.5, 8), pine: new FarTrees(area, treeSprite('pine', 20).tex[0], 6, 13) };
    this.mean = { grass: texMeanLin('grass'), cliff: texMeanLin('cliff'), scree: texMeanLin('scree'), sand: texMeanLin('sand'), noise: texMeanLin('farNoise'), water: texMeanLin('water'), dirt: texMeanLin('dirt'), gravel: texMeanLin('gravel'),
      fWheat: texMeanLin('wheat'), fBarley: texMeanLin('barley'), fPlowed: texMeanLin('plowed'), fMeadow: texMeanLin('meadow'), fGreens: texMeanLin('greens') };
    // the open sea, far beyond the charted water round the bay
    { const n = 24, span = 9000, p = [], u = [], c = [], idx = [];
      for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) { const x = -span / 2 + span * i / n, z = -span / 2 + span * j / n; p.push(x, 0, z); u.push(x / 6, z / 6); c.push(1.16, 1.18, 1.16); }
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const a = j * (n + 1) + i; idx.push(a, a + n + 1, a + 1, a + 1, a + n + 1, a + n + 2); }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); geo.setIndex(idx);
      this.sea = new THREE.Mesh(geo, env.mats.wSea); this.sea.frustumCulled = false; this.sea.renderOrder = -1; area.scene.add(this.sea);
      // it is not drawn inland, where it would show as a band of water beyond the edge of the far ground: the coastline, every 50 m along it
      const N = 512, d = new Float32Array(N * 4); for (let q = 0; q < N; q++) d[q * 4] = coastZ(-12800 + q * 50);
      const ct = new THREE.DataTexture(d, N, 1, THREE.RGBAFormat, THREE.FloatType); ct.magFilter = ct.minFilter = THREE.NearestFilter; ct.needsUpdate = true; const cu = { value: ct };
      const prev = env.mats.wSea.onBeforeCompile; env.mats.wSea.onBeforeCompile = sh => { if (prev) prev(sh); sh.uniforms.wCoast = cu;
        sh.vertexShader = 'varying vec2 vSxz;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vSxz = (modelMatrix * vec4(transformed, 1.0)).xz;');
        sh.fragmentShader = 'uniform sampler2D wCoast; varying vec2 vSxz;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\n if (vSxz.y < texture2D(wCoast, vec2((vSxz.x + 12800.0) / 25600.0, 0.5)).r - 90.0) discard;'); };
      env.mats.wSea.customProgramCacheKey = () => 'wildSea'; env.mats.wSea.needsUpdate = true; }
    if (!this.tracks.length) this.planTracks(env.tracksFrom);
    // the hand-made country round the city (its fields, hedges and orchards): nothing generated is laid over it, and how far a point lies
    // from it (or from the surveyed square) sets how much the generated land beside it still follows its pattern
    this.hand = env.handFields || []; this.handHash = new SHash(48); for (const o of this.hand) this.handHash.add(o, obbAabb(o));
    { const C = 8, R = 1100, N = Math.round(2 * R / C) + 1, D = new Float32Array(N * N), FD = new Float32Array(N * N).fill(1e9), A = new Float32Array(N * N).fill(NaN);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) D[j * N + i] = Math.max(0, Math.max(Math.abs(-R + i * C), Math.abs(-R + j * C)) - TG.R);
      for (const o of this.hand) { const [bx0, bz0, bx1, bz1] = obbAabb(o), m = 180;
        for (let j = Math.max(0, Math.floor((bz0 - m + R) / C)); j <= Math.min(N - 1, Math.ceil((bz1 + m + R) / C)); j++) for (let i = Math.max(0, Math.floor((bx0 - m + R) / C)); i <= Math.min(N - 1, Math.ceil((bx1 + m + R) / C)); i++) {
          const k = j * N + i, d = padDist({ o }, -R + i * C, -R + j * C); if (d < D[k]) D[k] = d; if (d < FD[k]) { FD[k] = d; A[k] = o.ang; } } }
      this.hR = { C, R, N, D, A, FD }; }
    this.rivers = LAND.rivers;
    { const t0 = performance.now(); Settle.plan(); this.settleMs = performance.now() - t0; } // the villages, hamlets, farmsteads, lanes and fields of the whole country
    Sites.build(area, env.mats); // the landmarks' buildings, kept for good (each is seen from far off)
    POI.plan(); // the small places out in the country
    this.buildFarNow(this.FAR[0], 0, 0); this.FAR[1].job = this.genFar(this.FAR[1], 0, 0); // the coarse ring is built over the first frames
    this.buildHorizon();
  },
  // the whole country, very coarsely, behind the far rings: from anywhere the mountains round its edge stand on the skyline
  buildHorizon() {
    const C = 200, X0 = WORLD.x0 - 2600, Z0 = WORLD.z0 - 2600, NI = Math.round((WORLD.x1 - WORLD.x0 + 5200) / C), NJ = Math.round((WORLD.z1 - WORLD.z0 + 3800) / C), M = this.mean;
    const H = new Float32Array((NI + 1) * (NJ + 1)); for (let j = 0; j <= NJ; j++) for (let i = 0; i <= NI; i++) H[j * (NI + 1) + i] = siteFix(X0 + i * C, Z0 + j * C, terrainBase(X0 + i * C, Z0 + j * C));
    const hb = (i, j) => H[clamp(j, 0, NJ) * (NI + 1) + clamp(i, 0, NI)], col = new Float32Array((NI + 1) * (NJ + 1) * 3);
    for (let j = 0; j <= NJ; j++) for (let i = 0; i <= NI; i++) {
      const x = X0 + i * C, z = Z0 + j * C, h = hb(i, j), gx = (hb(i + 1, j) - hb(i - 1, j)) / (2 * C), gz = (hb(i, j + 1) - hb(i, j - 1)) / (2 * C), nn = v3norm([-gx * 2.4, 1, -gz * 2.4]), sh = terrainShade(nn), k = (j * (NI + 1) + i) * 3;
      const TL = wildTreeLine(x, z), SL = wildSnowLine(x, z) + 120, wood = 0.55 * (1 - smoothstep(TL - 30, TL + 10, h)), rock = Math.max(smoothstep(0.35, 0.75, Math.hypot(gx, gz) * 2.2), 0.6 * smoothstep(TL + 60, TL + 200, h)) * smoothstep(TL - 20, TL + 80, h), snow = 0.8 * smoothstep(SL, SL + 120, h) * smoothstep(0.35, 0.75, nn[1]);
      for (let q = 0; q < 3; q++) { const grass = M.grass[q] * [1.02, 0.96, 0.78][q] * (1 - wood * 0.45), v = lerp(lerp(grass, M.cliff[q] * [0.78, 0.84, 0.98][q], rock), 1.45, snow); col[k + q] = sh[q] * v / M.noise[q]; } // dark rock, snow only on the tops
    }
    const g = { p: [], u: [], c: [], i: [] };
    for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) {
      const hs = [hb(i, j), hb(i + 1, j), hb(i, j + 1), hb(i + 1, j + 1)]; if (Math.max(...hs) < SEA - 3) continue;
      const base = g.p.length / 3; [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([di, dj], q) => { const vx = X0 + (i + di) * C, vz = Z0 + (j + dj) * C, k = ((j + dj) * (NI + 1) + i + di) * 3; g.p.push(vx, hs[q] - 1.5, vz); g.u.push(vx / 6, vz / 6); g.c.push(col[k], col[k + 1], col[k + 2]); });
      g.i.push(base, base + 3, base + 1, base, base + 2, base + 3);
    }
    const m = groupMesh(g, this.env.mats.wFarH); m.frustumCulled = false; this.horizon = m; this.area.scene.add(m);
  },
  setMask(i, j, on) { const u = i + 64, v = j + 112; if (u < 0 || v < 0 || u >= 128 || v >= 128) return; this.maskData[(v * 128 + u) * 4] = on ? 255 : 0; this.maskTex.needsUpdate = true; },
  // tracks run on from the gate roads far into the country; a later one that meets an earlier one joins it, the others end at a farmstead.
  // They keep to easy ground, wade the small rivers and cross the large ones by bridges.
  // Planned before the city lays its ground, so the surveyed land can be levelled for them where they leave it
  planTracks(from) {
    const t0 = performance.now(), used = new Set();
    this.tracks = []; this.trackEnds = []; this.rivers = LAND.rivers;
    const rc = new Map(); // the route grid's cells a river runs through, with its width there
    const rn = new Set(); // cells within a stone's throw of a river: a track keeps to the valley side, not the bank
    for (const R of this.rivers) for (let q = 0; q < R.P.length; q += 6) { const [x, z] = R.P[q], r = R.w[q] / 2 + 30; for (let i = Math.floor((x - r) / TRC); i <= Math.floor((x + r) / TRC); i++) for (let j = Math.floor((z - r) / TRC); j <= Math.floor((z + r) / TRC); j++) rn.add(i * 8192 + j); }
    rc.near = rn;
    for (const R of this.rivers) for (let q = 0; q < R.P.length; q += 2) { const [x, z] = R.P[q], r = R.w[q] / 2 + 3; for (let i = Math.floor((x - r) / TRC); i <= Math.floor((x + r) / TRC); i++) for (let j = Math.floor((z - r) / TRC); j <= Math.floor((z + r) / TRC); j++) { const k = i * 8192 + j; rc.set(k, Math.max(rc.get(k) || 0, R.hand ? 99 : R.w[q])); } }
    from.forEach(({ pre, aims }, i) => { const t = wildTrack(pre, aims, 700 + i * 31 + WSEED * 97, used, this.tracks, rc); if (t.length > 1) { this.tracks.push(t); if (!t.joined) this.trackEnds.push({ ti: this.tracks.length - 1 }); } });
    // each site's road: its own fixed way out, then on over the country to the nearest track, which it joins
    SITES.flatMap(S => (S.roads || [S.road]).map((rd, ri) => [S, rd, ri])).forEach(([S, rd, ri], si) => {
      const pre = rd.map(p => p.slice()), [sx, sz] = pre[pre.length - 1];
      let tp = null, bd = 1e9; for (const T of this.tracks) for (let q = 0; q < T.length; q += 3) { const d = Math.hypot(T[q][0] - sx, T[q][1] - sz); if (d < bd) { bd = d; tp = T[q]; } }
      let pts = pre;
      if (tp) { const r = routeWild([sx, sz], tp, 900 + si * 17 + WSEED * 97, used, rc);
        if (r) { pts = pts.concat(r.path.slice(1)); const [ex, ez] = pts[pts.length - 1]; let bp = tp, bb = 1e9; for (const T of this.tracks) for (const q of T) { const d = Math.hypot(q[0] - ex, q[1] - ez); if (d < bb) { bb = d; bp = q; } } pts.push(bp.slice()); } }
      const out = resampleEven(smoothPath(simplifyPath(pts, 3), 2), 3); out.joined = true; out.site = S.id; if (!ri) S.track = this.tracks.length; this.tracks.push(out);
      for (let q = 0; q < out.length; q += 2) { const i = Math.round(out[q][0] / TRC), j = Math.round(out[q][1] / TRC); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) used.add((i + di) * 8192 + j + dj); }
    });
    // a farmstead where a track ends: its yard a little beyond the end, well inside one chunk, its front to the way
    this.endFarms = this.trackEnds.map(({ ti }) => { const T = this.tracks[ti], L = T.length, [ex, ez] = T[L - 1], [px, pz] = T[Math.max(0, L - 8)], l = Math.hypot(ex - px, ez - pz) || 1, ux = (ex - px) / l, uz = (ez - pz) / l;
      const spot = (a, r) => { const c = Math.cos(a), s = Math.sin(a); let fx = ex + (ux * c - uz * s) * r, fz = ez + (ux * s + uz * c) * r; const i0 = this.ci(fx), j0 = this.ci(fz), cx0 = -TG.R + i0 * WC, cz0 = -TG.R + j0 * WC;
        return [clamp(fx, cx0 + 34, cx0 + WC - 34), clamp(fz, cz0 + 34, cz0 + WC - 34)]; };
      const clear = ([x, z]) => { const rv = riverNear(x, z, 60); return rv ? rv.d - rv.w / 2 : 60; }; // how far the yard keeps from any stream
      let fx, fz, bc = -1e9; look: for (const r of [24, 36, 48]) for (const a of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.3, -2.3]) { const p = spot(a, r), c = clear(p); if (c > bc) { bc = c; [fx, fz] = p; } if (c > 14) break look; } // the first spot clear of the water, or failing that the clearest
      return { x: fx, z: fz, ang: Math.atan2(-(ex - fx), -(ez - fz)) + Math.PI, sg: [px, pz, ex, ez] }; });
    // where a track meets a river: a ford through the shallows, or a bridge over it
    const rh = new Map(); this.rivers.forEach((R, ri) => { for (let q = 1; q < R.P.length; q++) { const k = Math.floor(R.P[q][0] / 32) * 8192 + Math.floor(R.P[q][1] / 32); let l = rh.get(k); if (!l) rh.set(k, l = []); l.push(ri, q); } });
    this.rh = rh; this.bridges = []; this.trackH = []; this.used = used; this.rc = rc;
    this.waysFrom(0);
    this.stampTracks();
    this.trackMs = performance.now() - t0;
  },
  // the bridges and the grade of the ways from the ti0-th on (the tracks, then the lanes the settlement plan adds)
  waysFrom(ti0) {
    const rh = this.rh;
    this.tracks.forEach((T, ti) => { if (ti < ti0) return; for (let q = 1; q < T.length; q++) {
      if (T.lane && riverD(T[q][0], T[q][1]) > 60) continue; // (no water here a lane would need a bridge over)
      const [ax, az] = T[q - 1], [bx, bz] = T[q], l = []; for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const c = rh.get((Math.floor(bx / 32) + i) * 8192 + Math.floor(bz / 32) + j); if (c) l.push(...c); } if (!l.length) continue; // (the river's point can lie in the next cell over from the crossing)
      for (let m = 0; m < l.length; m += 2) { const R = this.rivers[l[m]], p = l[m + 1], [cx, cz] = R.P[p - 1], [dx, dz] = R.P[p]; if (!segCross(ax, az, bx, bz, cx, cz, dx, dz)) continue;
        if (this.bridges.some(b => b.ti === ti && Math.abs(b.q - q) * 3 < b.half + 6)) continue;
        let w = 0; for (let k = Math.max(0, p - 4); k <= Math.min(R.P.length - 1, p + 4); k++) w = Math.max(w, R.w[k]); // the widest water near the crossing: a pool beside a riffle is not waded
        const wl = R.wl[p];
        if (w < 4.5 && !R.hand) continue; // shallow enough to wade: the chunk lays a ford
        // the stretch of the track over the water, longer where it crosses aslant
        const wet = k => { const [x, z] = T[k]; for (let n = Math.max(1, p - 30); n < Math.min(R.P.length, p + 30); n++) if (segDist(x, z, ...R.P[n - 1], ...R.P[n]) < R.w[n] / 2 + 1.5) return true; return false; };
        let k0 = q - 1, k1 = q; while (k0 > 0 && q - k0 < 20 && wet(k0 - 1)) k0--; while (k1 < T.length - 1 && k1 - q < 20 && wet(k1 + 1)) k1++;
        const long = k1 - k0 > 2, [px, pz] = T[k0], [rx, rz] = T[k1], ang = long ? Math.atan2(rx - px, rz - pz) : Math.atan2(bx - ax, bz - az);
        const mx = long ? (px + rx) / 2 : (ax + bx) / 2, mz = long ? (pz + rz) / 2 : (az + bz) / 2, half = Math.max(w / 2, Math.hypot(rx - px, rz - pz) / 2) + 6;
        const ux = Math.sin(ang), uz = Math.cos(ang), h1 = terrainRaw(mx - ux * half, mz - uz * half), h2 = terrainRaw(mx + ux * half, mz + uz * half);
        this.bridges.push({ ti, q: long ? Math.round((k0 + k1) / 2) : q, x: mx, z: mz, ang, w, wl, half, deck: clamp(Math.min(h1, h2), wl + 1.6, wl + 5), stone: !!R.hand });
      } } });
    // each track keeps an even grade: its bed is the ground along it, smoothed over some tens of metres, starting level with the gate road, level over its bridges
    for (let ti = ti0; ti < this.tracks.length; ti++) this.trackH[ti] = ((T, ti) => { let h = T.lane ? T.map(([x, z], q) => q % 6 && q < T.length - 1 ? 0 : terrainRaw(x, z)) : T.map(([x, z]) => terrainRaw(x, z)); if (T.lane) for (let q = 0; q < h.length; q++) if (q % 6 && q < h.length - 1) { const a = q - q % 6, b = Math.min(h.length - 1, a + 6); h[q] = lerp(h[a], h[b], (q - a) / (b - a)); } // (a lane's ground taken every 18 m: its grade is smoothed over some 40 m anyway)
      const bs = this.bridges.filter(b => b.ti === ti), pin = q => { for (const b of bs) { const d = Math.abs(q - b.q) * 3; if (d < b.half + 12) return [b.deck, 1 - smoothstep(b.half, b.half + 12, d)]; } return null; };
      for (let it = 0; it < 4; it++) h = h.map((_, q) => { let s = 0, n = 0; for (let k = -6; k <= 6; k++) { const v = h[clamp(q + k, 0, h.length - 1)]; s += v; n++; } const p = pin(q); return p ? lerp(s / n, p[0], p[1]) : s / n; });
      const h0 = T.lane ? h[0] : terrainH(T[0][0], T[0][1]); for (let q = 0; q < Math.min(12, h.length); q++) h[q] = lerp(h0, h[q], q / 12); return h; })(this.tracks[ti], ti);
    for (let ti = ti0; ti < this.tracks.length; ti++) { const T = this.tracks[ti]; let a = 1e9, b = 1e9, c = -1e9, d = -1e9; for (const [x, z] of T) { a = Math.min(a, x); b = Math.min(b, z); c = Math.max(c, x); d = Math.max(d, z); } T.box = [a, b, c, d]; }
  },
  // the lanes of the settlement plan join the ways: bridged, graded, and counted in the distance to the nearest way
  addLanes(lanes) { const t0 = performance.now(), ti0 = this.tracks.length; this.tracks.push(...lanes); this.waysFrom(ti0); this.stampTracks(); this.laneMs = performance.now() - t0; },
  // the ground a track leaves the surveyed land over is cut for it the same way as in the wild beyond
  levelFine() {
    const { C, R, N } = TG, S = N + 1, segs = [];
    this.tracks.forEach((T, ti) => { for (let q = 1; q < T.length; q++) { const [ax, az] = T[q - 1], [bx, bz] = T[q]; if (Math.max(Math.abs(ax), Math.abs(az)) > R + 14 && Math.max(Math.abs(bx), Math.abs(bz)) > R + 14) continue; segs.push([ax, az, bx, bz, this.trackH[ti][q - 1], this.trackH[ti][q]]); } });
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = -R + i * C, z = -R + j * C; if (Math.max(Math.abs(x), Math.abs(z)) < R - 30) continue;
      let bd = 99, bt = 0; for (const [ax, az, bx, bz, ha, hb] of segs) { const q = segDist(x, z, ax, az, bx, bz); if (q.d < bd) { bd = q.d; bt = lerp(ha, hb, q.t) - 0.05; } }
      if (bd < 11) TH[j * S + i] = lerp(TH[j * S + i], bt, 1 - smoothstep(2.4, 11, bd));
    }
  },
  // distance to the nearest track on a coarse raster (bilinear), for the farmed belt along them
  stampTracks() {
    const C = 32, X0 = WORLD.x0 - 600, Z0 = WORLD.z0 - 600, NI = Math.ceil((WORLD.x1 - WORLD.x0 + 1200) / C) + 1, NJ = Math.ceil((WORLD.z1 - WORLD.z0 + 1200) / C) + 1, D = new Float32Array(NI * NJ).fill(999), rad = 1;
    for (const T of this.tracks) for (let q = 0; q < T.length; q += 4) { // exact near the way, then spread out over the grid (a chamfer distance: within a few per cent)
      const [px, pz] = T[q], ci = Math.round((px - X0) / C), cj = Math.round((pz - Z0) / C);
      for (let j = cj - rad; j <= cj + rad; j++) for (let i = ci - rad; i <= ci + rad; i++) { if (i < 0 || j < 0 || i >= NI || j >= NJ) continue; const d = Math.hypot(X0 + i * C - px, Z0 + j * C - pz); if (d < D[j * NI + i]) D[j * NI + i] = d; }
    }
    _chamfer(D, NI, NJ, C); for (let k = 0; k < D.length; k++) if (D[k] > 999) D[k] = 999;
    this.tD = { C, X0, Z0, NI, NJ, D };
  },
  trackD(x, z) {
    const T = this.tD; if (!T) return 999; const fx = (x - T.X0) / T.C, fz = (z - T.Z0) / T.C, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= T.NI - 1 || j >= T.NJ - 1) return 999; const u = fx - i, v = fz - j, k = j * T.NI + i, D = T.D;
    return lerp(lerp(D[k], D[k + 1], u), lerp(D[k + T.NI], D[k + T.NI + 1], u), v);
  },
  // how far a point lies from the hand-made country (0 on it), and the heading of the nearest hand-made field (NaN if none near)
  handD(x, z) {
    const H = this.hR; if (!H) return 999; const fx = (x + H.R) / H.C, fz = (z + H.R) / H.C, i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0 || j < 0 || i >= H.N - 1 || j >= H.N - 1) return 999; const u = fx - i, v = fz - j, k = j * H.N + i, D = H.D;
    return lerp(lerp(D[k], D[k + 1], u), lerp(D[k + H.N], D[k + H.N + 1], u), v);
  },
  handFD(x, z) { const H = this.hR; if (!H) return 999; const i = Math.round((x + H.R) / H.C), j = Math.round((z + H.R) / H.C); return i < 0 || j < 0 || i >= H.N || j >= H.N ? 999 : Math.min(999, H.FD[j * H.N + i]); },
  handAng(x, z) { const H = this.hR; if (!H) return NaN; const i = Math.round((x + H.R) / H.C), j = Math.round((z + H.R) / H.C); return i < 0 || j < 0 || i >= H.N || j >= H.N ? NaN : H.A[j * H.N + i]; },
  // true if a track runs through (or within m of) the box: the city's fields leave room for them
  trackInObb(o, m = 4) {
    const [x0, z0, x1, z1] = obbAabb(o);
    for (const T of this.tracks) for (let q = 0; q < T.length; q++) { const [x, z] = T[q]; if (x < x0 - m || x > x1 + m || z < z0 - m || z > z1 + m) continue; if (circleObb(x, z, m, o)) return true; }
    return false;
  },

  /* ---------- the ways near a box (the farmed land itself is laid out by the settlement plan, Settle) ---------- */
  trackPtsNear(x0, z0, x1, z1, step = 2) { const out = []; for (const T of this.tracks) for (let q = 0; q < T.length; q += step) { const [x, z] = T[q]; if (x > x0 && x < x1 && z > z0 && z < z1) out.push(T[q]); } return out; },
  ci(v) { return Math.floor((v + TG.R) / WC); },
  key(i, j) { return i * 4096 + j; },
  inCity(i, j) { const n = 2 * TG.R / WC; return i >= 0 && j >= 0 && i < n && j < n; },
  rectDist(i, j, x, z) { const x0 = -TG.R + i * WC, z0 = -TG.R + j * WC; return Math.hypot(Math.max(0, x0 - x, x - x0 - WC), Math.max(0, z0 - z, z - z0 - WC)); },

  // ground height matching the built triangles (the raw shape where nothing is built yet)
  heightAt(x, z) {
    const c = this.chunks.get(this.key(this.ci(x), this.ci(z)));
    if (!c || !c.H) return terrainRaw(x, z);
    const fx = (x - c.x0) / WCELL, fz = (z - c.z0) / WCELL; const i = clamp(Math.floor(fx), 0, WN - 1), j = clamp(Math.floor(fz), 0, WN - 1);
    const u = fx - i, v = fz - j, S = WN + 1, k = j * S + i, H = c.H;
    const h00 = H[k], h10 = H[k + 1], h01 = H[k + S], h11 = H[k + S + 1];
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
  },

  // build what the player needs right now in one go (a new game, a loaded save, a journey's end)
  prime(x, z) {
    if (!this.on) return;
    if (this.job) { this.finish(this.jobKey[0], this.jobKey[1], this.job); this.job = null; }
    for (const L of this.FAR) if (!L.at || Math.hypot(L.at[0] - x, L.at[1] - z) > L.move) this.buildFarNow(L, x, z);
    for (;;) { const w = this.wanted(x, z); if (!w.length || w[0].d > 200) break; this.finish(w[0].i, w[0].j, this.genChunk(w[0].i, w[0].j)); }
    this.refreshPools(x, z);
  },
  buildFarNow(L, x, z) { const g = this.genFar(L, x, z); let r; do r = g.next(); while (!r.done); L.job = null; },

  wanted(x, z) {
    const out = [], i0 = this.ci(x - WILD.near), i1 = this.ci(x + WILD.near), j0 = this.ci(z - WILD.near), j1 = this.ci(z + WILD.near);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      if (this.inCity(i, j) || this.chunks.has(this.key(i, j))) continue;
      const d = this.rectDist(i, j, x, z); if (d < WILD.near) out.push({ i, j, d });
    }
    return out.sort((a, b) => a.d - b.d);
  },

  update(cp, yaw) {
    if (!this.on) return;
    this.yawU.value = yaw;
    this.sea.position.set(Math.round(cp.x / 60) * 60, SEA - 0.12, Math.round(cp.z / 60) * 60);
    const x = cp.x, z = cp.z, t0 = performance.now();
    for (const [k, c] of this.chunks) if (c.done && this.rectDist(c.i, c.j, x, z) > WILD.drop) this.unload(k, c);
    // trees and small plants follow the player at their own distances
    let sig = ''; for (const c of this.chunks.values()) if (c.done) { const d = this.rectDist(c.i, c.j, x, z); sig += d < WILD.small ? 2 : d < WILD.trees ? 1 : 0; }
    if (sig !== this.sig) { this.sig = sig; this.dirty = true; }
    // the far rings follow the camera; while one has fallen well behind (fast travel) it gets a share of every frame even when chunks are waiting
    for (const L of this.FAR) if (!L.job && (!L.at || Math.hypot(L.at[0] - x, L.at[1] - z) > L.move)) L.job = this.genFar(L, x, z);
    for (const L of this.FAR) if (L.job && Math.hypot(L.at ? L.at[0] - x : 1e9, L.at ? L.at[1] - z : 1e9) > L.R * 0.45) { const t1 = performance.now(); while (L.job && performance.now() - t1 < 2) { if (L.job.next().done) L.job = null; } }
    while (performance.now() - t0 < (this.fast ? 13 : WILD.budget)) { // (more of each frame goes to the ground ahead while travelling)
      if (!this.job) {
        const w = this.wanted(x, z);
        if (w.length) { const { i, j } = w[0]; this.jobKey = [i, j]; this.job = this.genChunk(i, j); }
        else { const L = this.FAR.find(L => L.job); if (!L) break; if (L.job.next().done) L.job = null; continue; }
      }
      let r; try { r = this.job.next(); } catch (e) { console.error('wild chunk failed', this.jobKey, e); this.chunks.delete(this.key(...this.jobKey)); this.job = null; this.failed = (this.failed || 0) + 1; if (this.failed > 20) this.on = false; continue; }
      if (r.done) { this.finish(this.jobKey[0], this.jobKey[1], null, r.value); this.job = null; }
    }
    if (this.dirty) this.refreshPools(x, z);
  },
  finish(i, j, gen, c) {
    if (gen) { let r; do r = gen.next(); while (!r.done); c = r.value; }
    c.done = true; this.area.scene.add(c.group); this.chunks.set(this.key(i, j), c); this.setMask(i, j, true);
    const G2 = this.area.grid; for (const col of c.cols) for (let ix = Math.floor(col.x0 / CELL); ix <= Math.floor(col.x1 / CELL); ix++) for (let iz = Math.floor(col.z0 / CELL); iz <= Math.floor(col.z1 / CELL); iz++) { const k = ix * 10007 + iz; let l = G2.get(k); if (!l) G2.set(k, l = []); l.push(col); }
    this.dirty = true;
  },
  unload(k, c) {
    this.area.scene.remove(c.group); c.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
    const G2 = this.area.grid; for (const col of c.cols) for (let ix = Math.floor(col.x0 / CELL); ix <= Math.floor(col.x1 / CELL); ix++) for (let iz = Math.floor(col.z0 / CELL); iz <= Math.floor(col.z1 / CELL); iz++) { const l = G2.get(ix * 10007 + iz); if (l) { const q = l.indexOf(col); if (q >= 0) l.splice(q, 1); } }
    this.chunks.delete(k); this.dirty = true; if (c.done) this.setMask(c.i, c.j, false);
  },
  refreshPools(x, z) {
    this.dirty = false;
    for (const [k, def] of Object.entries(WILD_KINDS)) {
      const lim = def[5] ? WILD.small : WILD.trees, lists = [];
      for (const c of this.chunks.values()) if (c.done && c.fl[k].length && this.rectDist(c.i, c.j, x, z) < lim) lists.push(c.fl[k]);
      this.pools[k].set(lists);
    }
  },

  /* ---------- one chunk of ground: heights, light, surfaces, fields, plants, rocks, tracks ---------- */
  *genChunk(i, j) {
    const E = this.env, x0 = -TG.R + i * WC, z0 = -TG.R + j * WC, B = 3, S = WN + 1 + 2 * B, N1 = WN + 1;
    const c = { i, j, x0, z0, H: null, done: false, cols: [], fl: {} }; for (const k in WILD_KINDS) c.fl[k] = [];
    const Hb = new Float32Array(S * S);
    for (let b = 0; b < S; b++) { for (let a = 0; a < S; a++) Hb[b * S + a] = terrainRaw(x0 + (a - B) * WCELL, z0 + (b - B) * WCELL); if (b % 6 === 5) yield; }
    // tracks cut into the slope: level across, their smoothed grade along, blending back into the ground over a few metres
    const trackSegs = [], runs = [];
    // bridges here: a point is on one if it lies within its span and a little to either side
    const brs = this.bridges.filter(b => b.x > x0 - 60 && b.x < x0 + WC + 60 && b.z > z0 - 60 && b.z < z0 + WC + 60);
    const onBridge = (x, z, m = 0) => brs.some(b => { const dx = x - b.x, dz = z - b.z, al = dx * Math.sin(b.ang) + dz * Math.cos(b.ang), ac = -dx * Math.cos(b.ang) + dz * Math.sin(b.ang); return Math.abs(al) < b.half + m && Math.abs(ac) < 2.6 + m; });
    for (const [M, draw] of [[12, false], [3, true]]) this.tracks.forEach((T, ti) => { // the ground is levelled a little beyond the chunk; the strip is drawn only within it
      let run = []; const TH2 = this.trackH[ti];
      const kind = q => T.cls ? T.cls[q] : T.lane ? WAY.lane : WAY.track, sink = q => T.sink ? T.sink[q] : 0;
      // drawn in stretches of one kind of way, broken at the bridges; the ground is levelled across its width (and let down in a hollow way)
      const flush = () => { if (run.length > 1) { if (draw) { let cur = null, ck = 0;
          const start = k => { cur = []; cur.qs = []; cur.T = T; ck = k; }, end = () => { if (cur && cur.length > 1) { cur.cls = ck; runs.push(cur); } cur = null; };
          for (const q of run) { if (brs.length && onBridge(T[q][0], T[q][1], -0.6)) { end(); continue; }
            const k = kind(q); if (!cur) start(k);
            else if (k !== ck) { const pq = cur.qs[cur.qs.length - 1]; cur.push(T[q]); cur.qs.push(q); end(); start(k); cur.push(T[pq]); cur.qs.push(pq); } // (each stretch runs on a point into the next, so they meet)
            cur.push(T[q]); cur.qs.push(q); }
          end(); }
        else for (let q = 1; q < run.length; q++) { const a = run[q - 1], b = run[q]; trackSegs.push([...T[a], ...T[b], TH2[a], TH2[b], WAY_W[kind(b)] / 2 - 1.7, sink(a), sink(b)]); } } run = []; };
      for (let q = 0; q < T.length; q++) {
        const [px, pz] = T[q], ins = px >= x0 - M && px <= x0 + WC + M && pz >= z0 - M && pz <= z0 + WC + M;
        if (ins) { if (!run.length && q > 0) run.push(q - 1); run.push(q); } else if (run.length) { run.push(q); flush(); }
      }
      flush();
    });
    // the farmstead here, if any (laid out the same whichever chunk asks): its yard levelled, its front to the way
    const frng = new RNG(Math.floor(_h2(i, j, 78 + WSEED) * 2147483647)), farm = Settle.farmsIn(x0, z0, x0 + WC, z0 + WC)[0] || null, HF = this.handHash.query(x0 - 80, z0 - 80, x0 + WC + 80, z0 + WC + 80);
    if (farm) { const hs = []; for (let q = -2; q <= 2; q++) for (let r = -2; r <= 2; r++) hs.push(Hb[clamp(Math.round((farm.z + r * 7 - z0) / WCELL) + B, 0, S - 1) * S + clamp(Math.round((farm.x + q * 7 - x0) / WCELL) + B, 0, S - 1)]); farm.y = hs.reduce((a, v) => a + v, 0) / hs.length; }
    if (farm) { const o = mkObb(farm.x, farm.z, farm.ang, 15, 14); for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { const d = padDist({ o }, x0 + (a - B) * WCELL, z0 + (b - B) * WCELL); if (d < 9) Hb[b * S + a] = lerp(Hb[b * S + a], farm.y, 1 - smoothstep(0, 9, d)); } }
    const best = new Float32Array(S * S).fill(99); // distance to the nearest track, round the chunk
    if (trackSegs.length) {
      const tgt = new Float32Array(S * S);
      const sk = new Float32Array(S * S); // (best holds the distance from the edge of a cart track's width: a wider way reaches further)
      for (const [ax, az, bx, bz, ha, hb2, sh, sa, sb] of trackSegs) {
        const a0 = Math.max(0, Math.floor((Math.min(ax, bx) - 8 - x0) / WCELL) + B), a1 = Math.min(S - 1, Math.ceil((Math.max(ax, bx) + 8 - x0) / WCELL) + B);
        const b0 = Math.max(0, Math.floor((Math.min(az, bz) - 8 - z0) / WCELL) + B), b1 = Math.min(S - 1, Math.ceil((Math.max(az, bz) + 8 - z0) / WCELL) + B);
        for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) { const q = segDist(x0 + (a - B) * WCELL, z0 + (b - B) * WCELL, ax, az, bx, bz), d = q.d - sh, k = b * S + a; if (d < best[k]) { best[k] = d; tgt[k] = lerp(ha, hb2, q.t) - 0.05; const s2 = lerp(sa, sb, q.t); sk[k] = s2 > 0 ? s2 * (1 - smoothstep(1.4, 6.2, q.d)) : 0; } }
      }
      for (let k = 0; k < S * S; k++) if (best[k] < 11) Hb[k] = lerp(Hb[k], tgt[k], 1 - smoothstep(2.4, 11, best[k])) - sk[k]; // a hollow way: its bed sunk between steep banks
    }
    // rivers: the bed cut below the water, a low bank raised where the ground falls away beside it, a shallow ford where a track crosses
    const rD = new Float32Array(S * S).fill(99), rW = new Float32Array(S * S), rL = new Float32Array(S * S), rivRuns = [];
    for (const R of this.rivers) {
      if (R.box[0] > x0 + WC + 20 || R.box[2] < x0 - 20 || R.box[1] > z0 + WC + 20 || R.box[3] < z0 - 20) continue;
      let run = null;
      for (let q = 0; q < R.P.length; q++) {
        const [px, pz] = R.P[q], ins = px > x0 - 24 && px < x0 + WC + 24 && pz > z0 - 24 && pz < z0 + WC + 24 && (R.hand || Math.max(R.w[Math.max(0, q - 6)], R.w[q], R.w[Math.min(R.w.length - 1, q + 6)]) >= 2.4); // the trickles at the springs are left to the valley they run in
        if (ins) { if (!run) rivRuns.push(run = { R, q0: Math.max(0, q - 1), q1: q }); run.q1 = Math.min(R.P.length - 1, q + 1); } else run = null;
      }
    }
    for (const { R, q0, q1 } of rivRuns) for (let q = q0 + 1; q <= q1; q++) {
      const [ax, az] = R.P[q - 1], [bx, bz] = R.P[q], m = R.w[q] / 2 + 70;
      const a0 = Math.max(0, Math.floor((Math.min(ax, bx) - m - x0) / WCELL) + B), a1 = Math.min(S - 1, Math.ceil((Math.max(ax, bx) + m - x0) / WCELL) + B);
      const b0 = Math.max(0, Math.floor((Math.min(az, bz) - m - z0) / WCELL) + B), b1 = Math.min(S - 1, Math.ceil((Math.max(az, bz) + m - z0) / WCELL) + B);
      for (let b = b0; b <= b1; b++) for (let a = a0; a <= a1; a++) { const k = b * S + a, sq = segDist(x0 + (a - B) * WCELL, z0 + (b - B) * WCELL, ax, az, bx, bz), hw = lerp(R.w[q - 1], R.w[q], sq.t) / 2; if (sq.d - hw < rD[k] - rW[k]) { rD[k] = sq.d; rW[k] = hw; rL[k] = lerp(R.wl[q - 1], R.wl[q], sq.t); } }
    }
    for (const R of this.rivers) if (R.end === 'pond') { // a pond where a river settles in a hollow
      const [px, pz] = R.P[R.P.length - 1], hw = 9 + R.w[R.w.length - 1] * 1.3; if (px < x0 - hw - 8 || px > x0 + WC + hw + 8 || pz < z0 - hw - 8 || pz > z0 + WC + hw + 8) continue;
      for (let b = 0; b < S; b++) for (let a = 0; a < S; a++) { const k = b * S + a, d = Math.hypot(x0 + (a - B) * WCELL - px, z0 + (b - B) * WCELL - pz); if (d - hw < rD[k] - rW[k]) { rD[k] = d; rW[k] = hw; rL[k] = R.wl[R.wl.length - 1]; } }
    }
    const BAR = new Float32Array(S * S);
    for (let k = 0; k < S * S; k++) {
      if (rD[k] > rW[k] + 70) continue; const hw = rW[k], d = rD[k], wl = rL[k], br = brs.length && onBridge(x0 + (k % S - B) * WCELL, z0 + (Math.floor(k / S) - B) * WCELL, 3), ford = best[k] < 6 && !br;
      const cw = Math.max(hw + 1.6, 6.2); // the bed is cut well over a ground cell wider than the water, so no triangle of bank rises through it
      if (d < cw) { let bed = ford ? wl - 0.25 : wl - (0.35 + hw * 0.08) * (1 - 0.6 * (d / cw) ** 2) - 0.08;
        if (hw > 2.4 && !ford && !br) { const X = x0 + (k % S - B) * WCELL, Z = z0 + (Math.floor(k / S) - B) * WCELL, bar = smoothstep(0.12, 0.34, fbm(X / 27, Z / 27, 2, 393)) * smoothstep(hw * 0.3, hw * 0.7, d); if (bar > 0) { bed = lerp(bed, wl + 0.2, bar); BAR[k] = bar; } } // gravel bars break the water's edge
        Hb[k] = Math.min(Hb[k], bed); }
      else if (br) continue; // the bridge's approaches keep the height of its deck
      else { const bank = wl + 0.3 + 0.5 * smoothstep(2, 6, hw), raise = bank - Hb[k]; if (raise > 0) Hb[k] += raise * (1 - smoothstep(cw, cw + 6, d)); else { const e = d - cw; Hb[k] = Math.min(Hb[k], bank + e * (0.26 + 0.1 * fbm((x0 + (k % S) * WCELL) / 30, (z0 + Math.floor(k / S) * WCELL) / 30, 1, 373)) + 0.014 * Math.max(0, e - 16) ** 2); } } // cut banks lie back at an easy slope, steepening away from the water into the valley side (never a wall)
    }
    // bare rock over the whole bordered grid first, so scree can gather in aprons below it
    const RK = new Float32Array(S * S);
    for (let b = 1; b < S - 1; b++) for (let a = 1; a < S - 1; a++) { const k = b * S + a, gx = (Hb[k + 1] - Hb[k - 1]) / (2 * WCELL), gz = (Hb[k + S] - Hb[k - S]) / (2 * WCELL); RK[k] = best[k] < 16 ? 0 : wildRockiness(x0 + (a - B) * WCELL, z0 + (b - B) * WCELL, Hb[k], Math.hypot(gx, gz))[0] * (rD[k] < rW[k] + 70 ? smoothstep(rW[k] + 6, rW[k] + 70, rD[k]) : 1); }
    let anyRock = false; for (let k = 0; k < S * S; k++) if (RK[k] > 0.01) { anyRock = true; break; }
    // rock does not lie in smooth sheets: its faces break into ledges and buttresses, a few metres at a time
    if (anyRock) for (let b = 1; b < S - 1; b++) for (let a = 1; a < S - 1; a++) { const k = b * S + a, w = smoothstep(0.25, 0.85, RK[k]); if (w <= 0) continue; const x = x0 + (a - B) * WCELL, z = z0 + (b - B) * WCELL, h = Hb[k];
      const st = 11 + 4 * fbm(x / 90, z / 90, 1, 395), ph = h / st + 0.7 * fbm(x / 31, z / 31, 2, 396), f = ph - Math.floor(ph); // steps up the face, their level wavering along it
      Hb[k] = h + w * (st * (smoothstep(0.3, 0.7, f) - f) + 3.2 * fbm(x / 13, z / 13, 2, 397)); }
    // where steep ground meets the sea the waves have cut a shelf: a strip of shingle and wet rock at the foot of the cliff, wide enough to walk
    { let anySea = false; for (let k = 0; k < S * S; k += 7) if (Hb[k] < SEA + 1) { anySea = true; break; }
      if (anySea) { const T2 = Hb.slice(); for (let b = 1; b < S - 1; b++) for (let a = 1; a < S - 1; a++) { const k = b * S + a, h = T2[k]; if (h < SEA - 5 || h > SEA + 9 || rD[k] < rW[k] + 30) continue;
        const sl = Math.hypot(T2[k + 1] - T2[k - 1], T2[k + S] - T2[k - S]) / (2 * WCELL), w = smoothstep(0.28, 0.55, sl) * smoothstep(SEA + 9, SEA + 4, h) * smoothstep(SEA - 5, SEA - 2, h); if (w > 0) Hb[k] = lerp(h, SEA + 0.45 + 0.1 * (h - SEA) + 0.25 * fbm((x0 + (a - B) * WCELL) / 9, (z0 + (b - B) * WCELL) / 9, 1, 399), w); } } }
    const hb = (a, b) => Hb[(b + B) * S + a + B];
    const apronAt = (a, b) => { if (!anyRock) return 0; const k0 = (b + B) * S + a + B, h0 = Hb[k0]; let m = 0; for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const aa = a + B + di, bb = b + B + dj; if (aa < 0 || bb < 0 || aa >= S || bb >= S) continue; const k = bb * S + aa; if (Hb[k] > h0 + 1.5) m = Math.max(m, RK[k] * (1 - Math.hypot(di, dj) / 4.5)); } return m * 0.9; };
    const H = c.H = new Float32Array(N1 * N1), col = new Float32Array(N1 * N1 * 3), lit = new Float32Array(N1 * N1 * 3), colR = new Float32Array(N1 * N1 * 3), qR = new Float32Array(N1 * N1), qS = new Float32Array(N1 * N1), qW = new Float32Array(N1 * N1), qE = new Float32Array(N1 * N1), qF = new Float32Array(N1 * N1);
    this.chunks.set(this.key(i, j), c); // heights are known: tracks and plants below can sit on them
    for (let b = 0; b <= WN; b++) {
      for (let a = 0; a <= WN; a++) {
        const x = x0 + a * WCELL, z = z0 + b * WCELL, h = hb(a, b), v = b * N1 + a; H[v] = h;
        const gx = (hb(a + 1, b) - hb(a - 1, b)) / (2 * WCELL), gz = (hb(a, b + 1) - hb(a, b - 1)) / (2 * WCELL);
        const n = v3norm([-gx * 2.4, 1, -gz * 2.4]), sh = terrainShade(n), t = E.tintOf(x, z, h, n);
        let avg = 0; for (const [di, dj] of CAV8) avg += hb(a + di, b + dj); avg /= 8;
        const kr0 = (b + B) * S + a + B, lush = rD[kr0] < 90 ? 1 - smoothstep(rW[kr0] + 2, rW[kr0] + 12, rD[kr0]) : 0; // the grass is lusher along the water
        const cav = clamp(1 + (h - avg) * 0.045, 0.72, 1.1), k = v * 3, wet = clamp((avg - h) * 0.12 + lush * 0.9, -1, 1) * smoothstep(TG.R, TG.R + 150, Math.max(Math.abs(x), Math.abs(z))); // hollows lusher, crests drier (blended in from the surveyed square's edge)
        lit[k] = sh[0] * cav; lit[k + 1] = sh[1] * cav; lit[k + 2] = sh[2] * cav;
        col[k] = sh[0] * t[0] * cav * (1 - 0.05 * wet); col[k + 1] = sh[1] * t[1] * cav * (1 + 0.04 * wet); col[k + 2] = sh[2] * t[2] * cav * (1 - 0.06 * Math.max(0, -wet));
        const SL = wildSnowLine(x, z), snow = smoothstep(SL, SL + 50, h + 12 * fbm(x / 40, z / 40, 2, 337)) * smoothstep(0.35, 0.75, 1 / Math.hypot(1, Math.hypot(gx, gz))); // snow lies on the high ledges, not the sheer faces
        const rt = (1 + 0.14 * fbm(x / 55, z / 55, 2, 338)) * (0.86 + 0.14 * Math.sin(h / 2.6 + 3 * fbm(x / 40, z / 40, 1, 339)) + 0.08 * fbm(x / 9, z / 9, 1, 340)); // rock weathers unevenly: large lighter and darker patches, and bands of ledges across the face
        colR[k] = sh[0] * cav * rt * lerp(0.94, 1.85, snow); colR[k + 1] = sh[1] * cav * rt * lerp(0.97, 1.87, snow); colR[k + 2] = sh[2] * cav * rt * lerp(1.03, 1.95, snow); // grey stone out here
        const kb = (b + B) * S + a + B, q = wildRockiness(x, z, h, Math.hypot(gx, gz), apronAt(a, b)); qR[v] = smoothstep(0.3, 0.7, RK[kb]); qS[v] = best[kb] < 16 ? 0 : q[1];
        qE[v] = (1 - smoothstep(3.5, 10, best[kb])) * smoothstep(0.22, 0.5, Math.hypot(gx, gz)); // the raw earth of a track's cutting
        qF[v] = coastZ(x) - z < 220 ? smoothstep(220, 150, coastZ(x) - z) * smoothstep(SEA + 2.4 + 3.5 * Math.min(1, Math.hypot(gx, gz) * 1.5) + 0.8 * fbm(x / 25, z / 25, 1, 374), SEA + 0.4, h) : 0; // shingle and wrack along the foreshore
        if (BAR[kb] > 0) qF[v] = Math.max(qF[v], BAR[kb]);
        if (qE[v] < 0.6 && h > SEA + 2) { const fm = E.forestMask(x, z, h); if (fm > 0.4) qE[v] = Math.max(qE[v], 0.42 * smoothstep(0.4, 0.75, fm) * smoothstep(-0.35, 0.15, fbm(x / 14, z / 14, 2, 400))); } // leaf litter and bare earth under the trees, in patches
        { const kr = (b + B) * S + a + B, mw = 1.1 + 3.6 * smoothstep(-0.35, 0.45, fbm(x / 24, z / 24, 2, 372)); qW[v] = rD[kr] < 90 ? 1 - smoothstep(rW[kr] + 0.2, rW[kr] + mw, rD[kr]) : 0; } // wet mud along the banks, of uneven width
      }
      if (b % 8 === 7) yield;
    }
    const litAt = (x, z) => { const a = clamp(Math.round((x - x0) / WCELL), 0, WN), b = clamp(Math.round((z - z0) / WCELL), 0, WN), v = b * N1 + a; return [lit[v * 3], lit[v * 3 + 1], lit[v * 3 + 2]]; };
    const colAt = (x, z) => { const fx = clamp((x - x0) / WCELL, 0, WN - 0.001), fz = clamp((z - z0) / WCELL, 0, WN - 0.001); const a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b; const k00 = (b * N1 + a) * 3, k10 = k00 + 3, k01 = k00 + N1 * 3, k11 = k01 + 3; return [0, 1, 2].map(q => lerp(lerp(col[k00 + q], col[k10 + q], u), lerp(col[k01 + q], col[k11 + q], u), v)); };
    const qAt = (arr, x, z) => { const a = clamp(Math.round((x - x0) / WCELL), 0, WN), b = clamp(Math.round((z - z0) / WCELL), 0, WN); return arr[b * N1 + a]; };
    // surfaces: grass everywhere, scree and rock laid over it with soft edges; sand on the shore
    const groups = new Map(), grp = k => { let g = groups.get(k); if (!g) groups.set(k, g = { p: [], u: [], c: [], i: [] }); return g; };
    const CORN = [[0, 0], [1, 0], [0, 1], [1, 1]];
    for (let b = 0; b < WN; b++) for (let a = 0; a < WN; a++) {
      const vs = CORN.map(([di, dj]) => (b + dj) * N1 + a + di), x = x0 + a * WCELL, z = z0 + b * WCELL, hs = vs.map(v => H[v]);
      if (Math.max(...hs) < SEA - 3) continue;
      const hc = (hs[0] + hs[3]) / 2, sand = isBeach(x + 2, z + 2, hc) && Math.max(...hs) - Math.min(...hs) < 1.6; // (no sand on a steep shore: rock or turf there)
      const rMin = Math.min(...vs.map(v => qR[v])), rMax = Math.max(...vs.map(v => qR[v])), sMin = Math.min(...vs.map(v => qS[v])), sMax = Math.max(...vs.map(v => qS[v]));
      const alongZ = Math.abs(hs[1] - hs[0] + hs[3] - hs[2]) > Math.abs(hs[2] - hs[0] + hs[3] - hs[1]);
      const fgx = hs[1] - hs[0] + hs[3] - hs[2], fgz = hs[2] - hs[0] + hs[3] - hs[1], fgl = Math.hypot(fgx, fgz) || 1, tx = -fgz / fgl, tz = fgx / fgl; // the way across the face
      const rockUV = (vx, vz, vh) => [(vx * tx + vz * tz) / 3.6, vh / 3.6];
      const put = (key, uvf, cols, alpha) => { const g = grp(key), base = g.p.length / 3; if (alpha) g.rgba = true;
        CORN.forEach(([di, dj], q) => { const vx = x + di * WCELL, vz = z + dj * WCELL, v = vs[q]; g.p.push(vx, hs[q], vz); g.u.push(...uvf(vx, vz, hs[q])); g.c.push(cols[v * 3], cols[v * 3 + 1], cols[v * 3 + 2]); if (alpha) g.c.push(alpha[v]); });
        g.i.push(base, base + 3, base + 1, base, base + 2, base + 3); };
      const flat = (vx, vz) => [vx / 5, vz / 5];
      if (sand) {
        const wet = new Float32Array(N1 * N1 * 3); for (const v of vs) { const k2 = smoothstep(SEA + 0.25, SEA - 0.1, H[v]); for (let q = 0; q < 3; q++) wet[v * 3 + q] = col[v * 3 + q] * (1 - 0.3 * k2); }
        put('tSand', flat, wet);
        if (Math.max(...hs) > SEA + 0.6) { const f = grp('tGrassFade'); f.rgba = true; const fb = f.p.length / 3; // grass thins out over the upper beach
          CORN.forEach(([di, dj], q) => { const vx = x + di * WCELL, vz = z + dj * WCELL, v = vs[q], tg = E.tintOf(vx, vz, SEA + 3, [0, 1, 0]); f.p.push(vx, hs[q], vz); f.u.push(vx / 5, vz / 5); f.c.push(col[v * 3] * tg[0], col[v * 3 + 1] * tg[1], col[v * 3 + 2] * tg[2], smoothstep(SEA + 0.7, SEA + 2.3, hs[q])); });
          f.i.push(fb, fb + 3, fb + 1, fb, fb + 2, fb + 3); }
        continue;
      }
      if (rMin > 0.9) { put('tRock', rockUV, colR); continue; }
      const steepUV = Math.max(...hs) - Math.min(...hs) > WCELL * 0.9 ? rockUV : flat; // on steep ground the texture wraps round the face instead of stretching
      if (sMin > 0.98) put('tScree', steepUV, colR); else put('tGrass', steepUV, col);
      if (sMax > 0.02 && sMin <= 0.98) put('wScreeO', flat, colR, qS);
      if (Math.max(...vs.map(v => qE[v])) > 0.02) put('wEarthO', flat, col, qE);
      if (Math.max(...vs.map(v => qF[v])) > 0.02) put('wScreeO', flat, colR, qF);
      if (rMax > 0.02) put('wRockO', rockUV, colR, qR);
      if (Math.max(...vs.map(v => qW[v])) > 0.02 && Math.min(...vs.map(v => qW[v])) < 0.97) put('wMudO', flat, col, qW); // only the banks: under the water it would show through from afar
      // the sea's edge: wet sand, and a fringe of foam where the water is shallow
      if (Math.min(...hs) < SEA + 0.1 && Math.max(...hs) > SEA - 1.2 && coastZ(x + 2) - (z + 2) < 200) { const g = grp('wFoam'); g.rgba = true; const base = g.p.length / 3;
        CORN.forEach(([di, dj], q) => { const vx = x + di * WCELL, vz = z + dj * WCELL, dep = SEA - hs[q]; g.p.push(vx, SEA + 0.03, vz); g.u.push(vx / 3 + 0.3 * Math.sin(vz / 5), vz / 3); g.c.push(1.8, 1.84, 1.84, dep < -0.05 ? 0 : smoothstep(0.35, 0.02, dep) * 0.8); }); // a band a few metres wide along the waterline
        g.i.push(base, base + 3, base + 1, base, base + 2, base + 3); }
    }
    let lo = Infinity, hi = -Infinity; for (let k = 0; k < H.length; k++) { if (H[k] < lo) lo = H[k]; if (H[k] > hi) hi = H[k]; }
    const skirt = Math.max(12, (hi - lo) * 0.35); // deep enough on steep ground that the coarser far ground beside it never leaves a gap
    { const g = grp('tGrass'); // an apron round the edge hides any crack against coarser ground beside it: sloping out and down, it reads as ground, never as a wall
      const edge = (a0, b0, a1, b1, ox, oz) => { const k0 = b0 * N1 + a0, k1 = b1 * N1 + a1, xa = x0 + a0 * WCELL, za = z0 + b0 * WCELL, xb = x0 + a1 * WCELL, zb = z0 + b1 * WCELL, base = g.p.length / 3, o = 2 * WCELL;
        const ya = Math.min(H[k0] - skirt, hb(a0 + ox * 2, b0 + oz * 2) - 2.5), yb = Math.min(H[k1] - skirt, hb(a1 + ox * 2, b1 + oz * 2) - 2.5); // well under the ground beside it too, however steeply that falls away
        g.p.push(xa, H[k0], za, xb, H[k1], zb, xb + ox * o, yb, zb + oz * o, xa + ox * o, ya, za + oz * o); g.u.push(xa / 5, za / 5, xb / 5, zb / 5, (xb + ox * o) / 5, (zb + oz * o) / 5, (xa + ox * o) / 5, (za + oz * o) / 5); for (const k of [k0, k1, k1, k0]) g.c.push(col[k * 3], col[k * 3 + 1], col[k * 3 + 2]);
        g.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2); };
      for (let q = 0; q < WN; q++) { edge(q, 0, q + 1, 0, 0, -1); edge(q, WN, q + 1, WN, 0, 1); edge(0, q, 0, q + 1, -1, 0); edge(WN, q, WN, q + 1, 1, 0); }
    }
    yield;
    const group = c.group = new THREE.Group();
    for (const [k, g] of groups) { const m = groupMesh(g, E.mats[k]); m.renderOrder = { wMudO: 1, wEarthO: 1, wScreeO: 2, wRockO: 3, wFoam: 4 }[k] || 0; group.add(m); }
    // tracks through this chunk
    const gb = new GB();
    for (const { R, q0, q1 } of rivRuns) { // the water: one ribbon along the river, level across, always falling downstream
      const g = gb.grp('wStream'); const E2 = q => { const A = R.P[Math.max(0, q - 3)], Bq = R.P[Math.min(R.P.length - 1, q + 3)], l = Math.hypot(Bq[0] - A[0], Bq[1] - A[1]) || 1, nx = -(Bq[1] - A[1]) / l, nz = (Bq[0] - A[0]) / l;
        const P0 = R.P[Math.max(0, q - 2)], P1 = R.P[q], P2 = R.P[Math.min(R.P.length - 1, q + 2)], ax2 = P1[0] - P0[0], az2 = P1[1] - P0[1], bx2 = P2[0] - P1[0], bz2 = P2[1] - P1[1];
        const turn = Math.abs(Math.atan2(ax2 * bz2 - az2 * bx2, ax2 * bx2 + az2 * bz2)) || 1e-6, rad = Math.hypot(bx2, bz2) / turn; // the local radius of the bend
        const hw = Math.max(Math.min(R.w[q] / 2 + 0.5, rad * 0.85), Math.min(1.1, R.w[q] / 2 + 0.4)), wob = Math.min(1.1, hw * 0.3), hl = hw + wob * fbm(R.P[q][0] / 7, R.P[q][1] / 7, 1, 401), hr = hw + wob * fbm(R.P[q][0] / 7, R.P[q][1] / 7, 1, 402); // the edge is never ruled
        return [[R.P[q][0] + nx * hl, R.wl[q], R.P[q][1] + nz * hl], [R.P[q][0] - nx * hr, R.wl[q], R.P[q][1] - nz * hr]]; };
      const mid = (a, b, t) => [lerp(a[0], b[0], t), a[1], lerp(a[2], b[2], t)];
      for (let q = q0 + 1; q <= q1; q++) { const [l0, r0] = E2(q - 1), [l1, r1] = E2(q), rif = clamp((R.wl[q - 1] - R.wl[q]) * 6, 0, 0.5); // riffles pale where it falls
        // deep water down the middle, paler and browner over the shallows at either side
        const rows = [[l0, l1, 1], [mid(l0, r0, 0.27), mid(l1, r1, 0.27), 0], [mid(l0, r0, 0.73), mid(l1, r1, 0.73), 0], [r0, r1, 1]], base = g.p.length / 3;
        for (const [a, b, sh] of rows) for (const p2 of [a, b]) { g.p.push(p2[0], p2[1], p2[2]); g.u.push(p2[0] / 6, p2[2] / 6); g.c.push(lerp(0.78, 1.18, sh) + rif, lerp(0.86, 1.14, sh) + rif, lerp(0.8, 0.84, sh) + rif * 0.9); }
        for (let k = 0; k < 3; k++) { const o = base + k * 2; g.i.push(o, o + 1, o + 3, o, o + 3, o + 2, o, o + 3, o + 1, o, o + 2, o + 3); } }
    }
    for (const R of this.rivers) if (R.end === 'pond') { const [px, pz] = R.P[R.P.length - 1], hw = 9 + R.w[R.w.length - 1] * 1.3 + 0.8; if (px < x0 || px >= x0 + WC || pz < z0 || pz >= z0 + WC) continue;
      const g = gb.grp('wStream'), y = R.wl[R.wl.length - 1], base = g.p.length / 3; g.p.push(px, y, pz); g.u.push(px / 6, pz / 6); g.c.push(0.78, 0.88, 0.9);
      for (let k = 0; k <= 20; k++) { const a = k / 20 * 6.283, qx = px + Math.cos(a) * hw, qz = pz + Math.sin(a) * hw; g.p.push(qx, y, qz); g.u.push(qx / 6, qz / 6); g.c.push(0.8, 0.9, 0.9); if (k) g.i.push(base, base + k + 1, base + k, base, base + k, base + k + 1); } }
    for (const run of runs) { const sd = i * 31 + j + runs.indexOf(run);
      if (run.cls === WAY.road) { drapeStrip(gb, 'rGravel', run, 5.0, { lift: 0.072 }); drapeFeather(gb, 'rGravelF', run, 5.0, 0.55, { seed: sd }); continue; } // a high road: metalled with gravel, wide enough for two carts
      if (run.cls === WAY.lane) { drapeStrip(gb, 'rDirt', run, 2.5, { lift: 0.068 }); drapeFeather(gb, 'rDirtF', run, 2.5, 0.6, { seed: sd }); continue; } // a lane: narrower, grassier
      if (run.cls === WAY.green) { for (const o of [-0.68, 0.68]) { const rut = run.map((p, q) => { const a = run[Math.max(0, q - 1)], b = run[Math.min(run.length - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; return [p[0] - (b[1] - a[1]) / l * o, p[1] + (b[0] - a[0]) / l * o]; });
          drapeStrip(gb, 'rDirt', rut, 0.5, { lift: 0.066 }); drapeFeather(gb, 'rDirtF', rut, 0.5, 0.5, { seed: sd + (o > 0 ? 7 : 0) }); } continue; } // a green lane: two worn ruts in the grass
      drapeStrip(gb, 'rDirtCart', run, 3.4, { lift: 0.07, uvAlong: true, tw: 3.4 }); drapeFeather(gb, 'rDirtF', run, 3.4, 0.45, { seed: sd }); }
    for (const m of Settle.milestones || []) { if (m.x < x0 || m.x >= x0 + WC || m.z < z0 || m.z >= z0 + WC) continue; const y = this.heightAt(m.x, m.z); // a milestone by the high road
      gb.setXf(m.x, m.z, m.ang, y - 0.3); gb.box(-0.22, 0, -0.14, 0.22, 1.15, 0.14, { side: 'stoneLight', top: 'stone' }, 1, 1); gb.box(-0.24, 1.15, -0.16, 0.24, 1.25, 0.16, 'stone', 1, 1); gb.xf = null;
      c.cols.push({ x0: m.x - 0.3, z0: m.z - 0.3, x1: m.x + 0.3, z1: m.z + 0.3, y0: y - 1, y1: y + 1 }); }
    for (const b of brs) if (b.x >= x0 && b.x < x0 + WC && b.z >= z0 && b.z < z0 + WC) bridgeMesh(gb, b, c.cols);
    const nearTrack = (x, z, r) => trackSegs.some(s => segDist(x, z, s[0], s[1], s[2], s[3]).d - s[6] < r);
    for (const T of this.tracks) if (T.joined) { const [jx, jz] = T[T.length - 1]; if (jx >= x0 && jx < x0 + WC && jz >= z0 && jz < z0 + WC) { drapeDisc(gb, 'rDirt', jx, jz, 5.5, { segs: 12, rings: 2, lift: 0.066 }); } } // the gore where tracks meet is trodden bare
    const rngW = new RNG(Math.floor(_h2(i, j, 900 + WSEED) * 2147483647)), fl = c.fl; let rng = rngW;
    const blocks = []; // ground kept clear of plants: yards and buildings
    if (farm) {
      const FX = makeXf(farm.x, farm.z, farm.ang, farm.y), saved = this.area.colliders; this.area.colliders = [];
      gb.setXf(...xfP(FX, -4, 3), farm.ang, farm.y);
      makeBuilding(this.area, gb, frng, { fp: { x0: -5, z0: -3.5, x1: 5, z1: 3.5 }, stories: 1, style: frng.pick(['timber2', 'timber2', 'stone', 'plaster']), roof: 'gable', roofKey: 'roofThatch', roofTint: [1, 0.95, 0.85], doorT: 0.5, found: 0.8, chimney: 1 });
      gb.setXf(...xfP(FX, 6, -5), farm.ang + Math.PI / 2, farm.y);
      makeBuilding(this.area, gb, frng, { fp: { x0: -6, z0: -4.5, x1: 6, z1: 4.5 }, h: 5.2, style: 'wood', roof: 'gable', roofKey: 'roofBrown', roofTint: [0.85, 0.8, 0.75], doorT: 0.5, doorW: 2.6, doorH: 3.2, doorKey: 'doorDark', winRate: 0.2, found: 0.8, chimney: 0 });
      gb.xf = null; c.cols.push(...this.area.colliders); this.area.colliders = saved;
      drapePatch(gb, 'gDirt', FX, -13, -12, 13, 12, { cell: 4, lift: 0.04 });
      for (let k = 0; k < 5; k++) { const [hx, hz] = xfP(FX, frng.range(-10, 10), frng.range(6, 11)); fl.hay.push([hx, this.heightAt(hx, hz), hz, frng.range(0.8, 1.2)]); }
      for (const [lx, lz] of [[-14, -9], [14, 10], [-13, 12]]) { const [tx, tz] = xfP(FX, lx, lz); const th = this.heightAt(tx, tz); fl[frng.pick(['oak0', 'oak1', 'pine'])].push([tx, th - 0.15, tz, frng.range(0.9, 1.15)]); c.cols.push({ x0: tx - 0.35, z0: tz - 0.35, x1: tx + 0.35, z1: tz + 0.35, y0: th - 1, y1: th + 9 }); }
      blocks.push(mkObb(farm.x, farm.z, farm.ang, 16, 15));
    }
    for (const T of TOWNS) if (T.buildChunk(x0, z0, WC, gb, c.cols, fl, blocks)) yield; // a town's houses, walls and streets in this square
    for (const p of POI.list) if (p.x >= x0 && p.x < x0 + WC && p.z >= z0 && p.z < z0 + WC) POI.build(p, gb, c.cols, fl, blocks, (x, z) => this.heightAt(x, z));
    for (const h of POI.housesIn(x0 - 12, z0 - 12, x0 + WC + 12, z0 + WC + 12)) { blocks.push(mkObb(h.x, h.z, h.ang, 7, 6.5));
      if (h.x < x0 || h.x >= x0 + WC || h.z < z0 || h.z >= z0 + WC) continue;
      const hr = new RNG(h.seed), cs = obbCorners(mkObb(h.x, h.z, h.ang, 4.6, 3.6)), y = Math.min(...cs.map(([a, b]) => this.heightAt(a, b))), top = Math.max(...cs.map(([a, b]) => this.heightAt(a, b))), saved = this.area.colliders; this.area.colliders = [];
      gb.setXf(h.x, h.z, h.ang, y); makeBuilding(this.area, gb, hr, { fp: { x0: -4.5, z0: -3.5, x1: 4.5, z1: 3.5 }, stories: hr.chance(0.25) ? 2 : 1, style: hr.pick(['timber2', 'timber2', 'stone', 'plaster', 'plaster']), roof: 'gable', roofKey: hr.chance(0.7) ? 'roofThatch' : 'roofSlate', roofTint: [1, 0.95, 0.86], doorT: 0.5, found: top - y + 0.8, chimney: 0.9, wealth: 0.8 }); gb.xf = null;
      c.cols.push(...this.area.colliders); this.area.colliders = saved;
      const [gx, gz] = xfP(makeXf(h.x, h.z, h.ang), 0, -9); if (hr.chance(0.7)) drapePatch(gb, hr.chance(0.5) ? 'fGreens' : 'fPlowed', makeXf(gx, gz, h.ang), -4, -3, 4, 3, { cell: 3, lift: 0.05, uvFrame: true }); // a garden behind
      for (let k = 0; k < 2; k++) { const [tx, tz] = xfP(makeXf(h.x, h.z, h.ang), hr.range(-9, 9) + (k ? 7 : -7), hr.range(-14, -8)); const th = this.heightAt(tx, tz); fl[hr.pick(['oak0', 'oak1', 'oak2'])].push([tx, th - 0.15, tz, hr.range(0.8, 1.1)]); c.cols.push({ x0: tx - 0.35, z0: tz - 0.35, x1: tx + 0.35, z1: tz + 0.35, y0: th - 1, y1: th + 9 }); } }
    for (const H of Settle.list) { const [wx, wz] = H.well; if (wx < x0 || wx >= x0 + WC || wz < z0 || wz >= z0 + WC) continue; POI.build({ kind: 'well', x: wx, z: wz, ang: 0, r: 4 }, gb, c.cols, fl, blocks, (x, z) => this.heightAt(x, z));
      if (H.green) { const [gx, gz, gr] = H.green; drapeDisc(gb, 'gGrass', gx, gz, gr, { segs: 18, rings: 3, lift: 0.04 }); blocks.push(mkObb(gx, gz, 0, gr * 0.7, gr * 0.7)); } else drapeDisc(gb, 'gGrass', H.x, H.z, 6, { segs: 12, rings: 2, lift: 0.04 }); } // a village's green
    for (const b of Settle.builds) { if (b.x < x0 || b.x >= x0 + WC || b.z < z0 || b.z >= z0 + WC) continue; // a village's chapel: stone and slate, a bell-cote on its west gable
      const hr = new RNG(b.seed), cs = obbCorners(b.o), y = Math.min(...cs.map(([a, q]) => this.heightAt(a, q))), top = Math.max(...cs.map(([a, q]) => this.heightAt(a, q))), saved = this.area.colliders; this.area.colliders = [];
      gb.setXf(b.x, b.z, b.ang, y); makeBuilding(this.area, gb, hr, { fp: { x0: -7.5, z0: -4.6, x1: 7.5, z1: 4.6 }, h: 5.6, style: 'stone', roof: 'gable', roofKey: 'roofSlate', roofTint: [0.95, 0.95, 1], doorT: 0.5, found: top - y + 0.8, chimney: 0, winRate: 0.5, wealth: 0.7 });
      gb.box(-8.1, 5.0, -0.7, -6.7, 9.6, 0.7, { side: 'stone', top: 'roofSlate' }, 2, 2); gb.box(-8.25, 9.6, -0.85, -6.55, 9.9, 0.85, 'roofSlate', 1, 1); gb.xf = null;
      c.cols.push(...this.area.colliders); this.area.colliders = saved; blocks.push(mkObb(b.x, b.z, b.ang, 10, 8)); }
    // the farmed strips laid from here (each drawn by the chunk its middle lies in; it may reach a little into the chunks beside), hedged all round
    // (or walled on the uplands), sheep in the pasture. The strips of a block come from the settlement plan, the same whichever chunk asks
    const near = []; { let n = 0; for (const blk of Settle.blocksIn(x0 - 60, z0 - 60, x0 + WC + 60, z0 + WC + 60)) { near.push(...Settle.strips(blk)); if (++n % 4 === 0) yield; } }
    const fields = near.filter(o => o.x >= x0 && o.x < x0 + WC && o.z >= z0 && o.z < z0 + WC), nh = new SHash(24); for (const f of near) nh.add(f, obbAabb(f));
    // a length of hedge between two strips is drawn once, by the strip with the higher number; between the strips of an open field there is none
    const hedgeHere = (o, mx, mz) => { for (const f of nh.query(mx - 2, mz - 2, mx + 2, mz + 2)) { if (f === o || !circleObb(mx, mz, 1.7, f)) continue; if (o.open && f.open && f.blk === o.blk) return false; if (f.id > o.id) return false; } return true; };
    for (const o of fields) {
      const sl = terrainSlope(o.x, o.z);
      drapePatch(gb, o.key, makeXf(o.x, o.z, o.ang), -o.hx, -o.hz, o.hx, o.hz, { cell: 5, lift: 0.05 + sl * 0.5, tw: 3, uvFrame: true });
      const hr = new RNG(Math.floor(_h2(Math.round(o.x), Math.round(o.z), 1960) * 2147483647)), g = o.grow;
      // its hedges: the long side towards the next strip of the block is shared (drawn by one of the two), the ends likewise between rows;
      // near the city, as there, not every side is hedged; further out the fields are closed in
      // every field is closed in (a gate aside); the side shared with the next strip of the block is drawn once
      const sides = [[1, o.hz, true], [1, o.hx, false], [-1, o.hz, true], [-1, o.hx, false]], wall = o.wall;
      for (const [sx, len, along] of sides) {
        const pieces = Math.max(1, Math.ceil(2 * len / 3.5)), gate = hr.chance(0.4) ? hr.int(0, pieces - 1) : -1;
        // one kind of hedge throughout, as round the city: clipped near it, then (some 200 m on) taller, more uneven and grown over with bushes; one height to a hedge
        const hh0 = hr.range(1.0, 1.35) + smoothstep(0.25, 1, g) * hr.range(0, 0.4), hw = 0.6 + g * hr.range(0, 0.15);
        for (let k = 0; k < pieces; k++) {
          if (k === gate) continue; // a field gate
          const hh = hh0 * (0.85 + 0.3 * hr.next()); // uneven along its length
          const t0 = -len + 2 * len * k / pieces, t1 = -len + 2 * len * (k + 1) / pieces;
          const [ax, az] = along ? xfP(o, sx * (o.hx + 1.2), t0) : xfP(o, t0, sx * (o.hz + 1.2)), [bx, bz] = along ? xfP(o, sx * (o.hx + 1.2), t1) : xfP(o, t1, sx * (o.hz + 1.2));
          const mx = (ax + bx) / 2, mz = (az + bz) / 2; if (nearTrack(mx, mz, 3) || !hedgeHere(o, mx, mz)) continue;
          // a short length set on the ground at its lowest, its top clear of the ground at its highest, so it follows the slope without sinking in
          const ya = this.heightAt(ax, az), yb = this.heightAt(bx, bz), ym = this.heightAt(mx, mz), y = Math.min(ya, yb, ym) - 0.15, top = Math.max(ya, yb, ym) - y + hh * 0.9, L = Math.hypot(bx - ax, bz - az), ha = Math.atan2(bx - ax, bz - az);
          if (wall) { const wt = Math.max(top - hh * 0.9 + 0.95, 0.95); gb.setXf(mx, mz, ha, y); gb.box(-0.35, -0.5, -L / 2 - 0.15, 0.35, wt, L / 2 + 0.15, { side: 'stone', top: 'stone' }, 2, 2, { skip: 'ns' }); gb.xf = null; // a dry-stone wall
            const e = L / 2 + 0.8; c.cols.push({ x0: mx - e, z0: mz - e, x1: mx + e, z1: mz + e, y0: y - 1, y1: y + wt, o: { x: mx, z: mz, c: Math.cos(ha), s: Math.sin(ha), hx: 0.35, hz: L / 2 + 0.15 } }); continue; }
          gb.setXf(mx, mz, ha, y); gb.box(-hw, -0.5, -L / 2 - 0.2, hw, Math.max(top, hh), L / 2 + 0.2, { side: 'hedge', top: 'hedge' }, 2, 2, { skip: 'ns' }); gb.xf = null;
          if (hr.chance(0.3 + g * 0.6)) { const n2 = 1 + Math.floor((0.5 + g * 2) * hr.next()); for (let b = 0; b < n2; b++) { const f = hr.next(), x = lerp(ax, bx, f), z = lerp(az, bz, f); fl[hr.chance(0.5) ? 'bush' : 'bushB'].push([x, y + Math.max(top, hh) - 0.55, z, hr.range(0.55, 0.85)]); } } // a few bushes break the top
          const e = L / 2 + 0.8; c.cols.push({ x0: mx - e, z0: mz - e, x1: mx + e, z1: mz + e, y0: y - 1, y1: y + Math.max(top, hh), o: { x: mx, z: mz, c: Math.cos(ha), s: Math.sin(ha), hx: 0.6, hz: L / 2 + 0.2 } });
          if (hr.chance(0.055)) { const th = this.heightAt(mx, mz); (hr.chance(0.25 - 0.15 * g) ? fl.cypress : hr.chance(0.5) ? fl.oak0 : fl.oak1).push([mx, th - 0.15, mz, hr.range(0.8, 1.15)]); c.cols.push({ x0: mx - 0.35, z0: mz - 0.35, x1: mx + 0.35, z1: mz + 0.35, y0: th - 1, y1: th + 8 }); } // a hedgerow tree
        }
      }
      if (o.key === 'fMeadow' && hr.chance(o.past ? 0.75 : 0.5)) { const n2 = hr.int(3, 9); for (let k = 0; k < n2; k++) { const [sx, sz] = xfP(o, hr.range(-o.hx + 2, o.hx - 2), hr.range(-o.hz + 2, o.hz - 2)); fl.sheep.push([sx, this.heightAt(sx, sz), sz, hr.range(0.85, 1.1)]); } }
    }
    const inField = (x, z, r) => near.some(f => circleObb(x, z, r + 1.8, f)) || blocks.some(f => circleObb(x, z, r, f)) || HF.some(f => circleObb(x, z, r + 1.6, f)); // (hedges stand just outside their fields)
    for (const run of runs) for (let q = 1; q < run.length; q += 2) { // the way through farmland runs between hedges, or dry-stone walls on the uplands
      const [ax, az] = run[q - 1], [bx, bz] = run[Math.min(run.length - 1, q + 1)], mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (mx < x0 || mx >= x0 + WC || mz < z0 || mz >= z0 + WC) continue;
      const T = run.T, sunk = T.sink ? T.sink[run.qs[q]] : 0, hollow = sunk > 0.6, cu = wildCult(mx, mz); // (a hollow way has a hedge on each bank, fields or not, unless it runs through a wood)
      if (blocks.some(f => circleObb(mx, mz, 6, f)) || HF.some(f => circleObb(mx, mz, 6, f)) || Math.max(Math.abs(mx), Math.abs(mz)) < TG.R + 30 || townCore(mx, mz) > 0 || POI.housesIn(mx - 20, mz - 20, mx + 20, mz + 20).length) continue; // not across a cottage's front
      if (hollow ? E.forestMask(mx, mz, this.heightAt(mx, mz)) > 0.4 : (cu < 0.35 || !near.some(f => circleObb(mx, mz, 16, f)))) continue; // only where fields border the way
      const L = Math.hypot(bx - ax, bz - az), ha = Math.atan2(bx - ax, bz - az), nx = (bz - az) / L, nz = -(bx - ax) / L, wall = this.heightAt(mx, mz) > 70;
      for (const sd of [-1, 1]) {
        if (fbm(mx / 40 + sd * 3, mz / 40, 2, 364) < (hollow ? -0.2 : 0.25 - cu * 0.5)) continue; // with gaps and field gates
        const off = hollow ? 6.4 : [3.9, 4.7, 3.2, 3.2][run.cls], px = mx + nx * off * sd, pz = mz + nz * off * sd, y = this.heightAt(px, pz), hh = wall ? 0.95 : rng.range(1.2, 1.6);
        const g = smoothstep(120, 900, this.handFD(px, pz)), hw = wall ? 0.35 : 0.6; // the same hedge as round the fields, growing wilder away from the city
        gb.setXf(px, pz, ha, y - 0.1); gb.box(-hw, -0.6, -L / 2 - 0.15, hw, wall ? hh : hh + g * 0.3, L / 2 + 0.15, wall ? { side: 'stone', top: 'stone' } : { side: 'hedge', top: 'hedge' }, 2, 2, { skip: 'ns' }); gb.xf = null;
        if (!wall && g > 0.15 && rng.chance(g * 0.8)) fl[rng.chance(0.5) ? 'bush' : 'bushB'].push([px, y + hh - 0.5, pz, rng.range(0.55, 0.85)]);
        const e = L / 2 + 0.8; c.cols.push({ x0: px - e, z0: pz - e, x1: px + e, z1: pz + e, y0: y - 1, y1: y + hh, o: { x: px, z: pz, c: Math.cos(ha), s: Math.sin(ha), hx: 0.55, hz: L / 2 + 0.15 } });
        if (!wall && rng.chance(0.06)) { fl.oak1.push([px, y - 0.15, pz, rng.range(0.85, 1.15)]); }
      }
    }
    yield;
    // plants: one chance on a jittered 5.5 m grid, as dense as the woods round the city
    const SP = 5.5, DENS = (SP / 5) * (SP / 5);
    const tree = (kind, x, z, h, s) => { const def = WILD_KINDS[kind]; fl[kind].push([x, h - 0.15, z, s]); if (def[4]) c.cols.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, y0: h - 1, y1: h + def[4] * s }); };
    for (const S of SITES) if (S.plants) for (const [kind, px, pz, sc] of S.plants) if (px >= x0 && px < x0 + WC && pz >= z0 && pz < z0 + WC) tree(kind, px, pz, this.heightAt(px, pz), sc); // a site's planted trees: its avenues and rows
    const siteHere = SITES.some(S => Math.abs(x0 + WC / 2 - S.x) < S.rb + 400 && Math.abs(z0 + WC / 2 - S.z) < S.rb + 400), townHere = TOWNS.some(T => Math.abs(x0 + WC / 2 - T.x) < T.cfg.A + T.cfg.B + 500 && Math.abs(z0 + WC / 2 - T.z) < T.cfg.A + T.cfg.B + 500);
    for (let b = 0; b < WC / SP; b++) {
      for (let a = 0; a < WC / SP; a++) {
        // in a site, a cell takes its plants from the site's own fixed draw (as far as the site holds there), else from the world's
        let rng = rngW; const sx = x0 + (a + 0.5) * SP, sz = z0 + (b + 0.5) * SP, st = siteHere ? siteAt(sx, sz) : null;
        if (st && _h2(Math.floor(sx / SP), Math.floor(sz / SP), 4401) < st.w) rng = new RNG(Math.floor(_h2(Math.floor(sx / SP), Math.floor(sz / SP), 4402) * 2147483647));
        const x = x0 + (a + rng.next()) * SP, z = z0 + (b + rng.next()) * SP, h = this.heightAt(x, z);
        if (h < SEA + 1.6) continue;
        if (townHere && townCore(x, z) > 0.3) continue; // the town's own ground
        const openRoad = townHere && townFields(x, z) > 0.3 && this.trackD(x, z) < 45; // across a town's farmland the roads run open, so its towers show from the way in
        const qr = qAt(qR, x, z), qs = qAt(qS, x, z), qw = qAt(qW, x, z); if (qr > 0.5) continue; // nothing roots in bare rock
        if (qw > 0.3) { if (qw < 0.97 && rng.chance(0.55)) fl.reeds.push([x, h - 0.1, z, rng.range(0.8, 1.2)]); continue; } // reeds along the banks
        { const kb = (Math.round((z - z0) / WCELL) + B) * S + Math.round((x - x0) / WCELL) + B, e = rD[kb] - rW[kb]; if (e > 1.2 && e < 13 && rW[kb] > 1 && !inField(x, z, 2.5) && !nearTrack(x, z, 4) && rng.chance(0.5 * (1 - 0.5 * smoothstep(6, 13, e)) * (0.4 + smoothstep(-0.2, 0.3, fbm(x / 30, z / 30, 1, 385))))) { // alders and willow scrub along the water
          if (rng.chance(0.45)) tree(rng.chance(0.6) ? 'oak' + rng.int(0, 2) : 'cypress', x, z, h, rng.range(0.65, 1.0)); else fl[rng.chance(0.5) ? 'bush' : 'bushB'].push([x, h - 0.1, z, rng.range(0.7, 1.1)]); continue; } }
        if (coastZ(x) - z < 90 && h < SEA + 8) { if (rng.chance(0.25)) fl.tufts.push([x, h - 0.04, z, rng.range(0.7, 1.1)]); continue; } // no trees on the shore: dune grass
        const n = terrainNormal(x, z), sl = terrainSlope(x, z);
        let pick = wildPlant(x, z, h, sl, n, rng, E.forestMask(x, z, h), DENS, qs, wildCult(x, z), wildHeath(x, z, h), rng !== rngW);
        if (pick && !pick.small && openRoad) continue;
        if (pick && !pick.small) { const ex = 1 - smoothstep(90, 520, coastZ(x) - z); if (ex > 0 && rng.next() < ex) pick = rng.next() < 0.45 * (1 - ex) ? { kind: rng.chance(0.5) ? 'bush' : 'bushB', s: 0.6 + 0.5 * rng.next() } : null; } // the salt wind: trees thin to scrub towards the sea
        if (pick && st && st.w > 0.5 && Sites.clearAt(x, z, pick.small ? 1 : 4)) continue; // round a site's buildings and roads
        if (pick && !pick.small && st && st.S.bare && Math.hypot(x - st.S.x, z - st.S.z) < st.S.bare * (0.85 + 0.3 * _h2(Math.floor(x / 40), Math.floor(z / 40), 4403)) && rng.next() < st.w * 1.6) continue; // a site's bare ground: open grass and heath, no copses
        if (!pick) continue;
        if (nearTrack(x, z, pick.small ? 2.2 : 3.6) || inField(x, z, pick.small ? 0.5 : 2.5)) continue;
        if (pick.kind === 'flowers') { const fk = 'flowers' + rng.int(0, 3); for (let q = 0; q < 8; q++) { const fx = x + rng.range(-3.5, 3.5), fz = z + rng.range(-3.5, 3.5); if (!inField(fx, fz, 0.3)) fl[fk].push([fx, this.heightAt(fx, fz) - 0.03, fz, rng.range(0.7, 1.1)]); } continue; }
        if (pick.small) { fl[pick.kind].push([x, h - 0.04, z, pick.s]); continue; }
        tree(pick.kind, x, z, h, pick.s);
      }
      if (b % 8 === 7) yield;
    }
    // the ground between, on a finer grid: tussocks in drifts, tall grass and weeds in the rough and along the ways, rushes in the wet,
    // bracken and heather on the heath, ferns under the trees, stones where the soil is thin. Near-only sprites, so they cost little
    { const SF = 2.2, NF = Math.floor(WC / SF), rf = new RNG(Math.floor(_h2(i, j, 950 + WSEED) * 2147483647)), BL = 4, NB = Math.ceil(NF / BL), land = new Array(NB * NB);
      for (let b = 0; b < NF; b++) {
        for (let a = 0; a < NF; a++) {
          const r = rf.next(), x = x0 + (a + rf.next()) * SF, z = z0 + (b + rf.next()) * SF, r2 = rf.next(), s = 0.75 + 0.6 * rf.next();
          const h = this.heightAt(x, z); if (h < SEA + 0.35) continue;
          const qr = qAt(qR, x, z); if (qr > 0.5) continue;
          const kb = (clamp(Math.round((z - z0) / WCELL), 0, WN) + B) * S + clamp(Math.round((x - x0) / WCELL), 0, WN) + B, e = rD[kb] - rW[kb], td = best[kb];
          if (td < 2.3 || e < 0.4) continue; // not on the way, not in the water
          const lb = (b >> 2) * NB + (a >> 2); let Ld = land[lb]; // how wooded, farmed and heathy the land is, taken once per 9 m
          if (!Ld) { const bx = x0 + ((a >> 2) + 0.5) * BL * SF, bz = z0 + ((b >> 2) + 0.5) * BL * SF, bh = this.heightAt(bx, bz); Ld = land[lb] = [E.forestMask(bx, bz, bh), wildCult(bx, bz), wildHeath(bx, bz, bh), townHere ? townCore(bx, bz) : 0, siteHere ? siteWeight(bx, bz) : 0, bh - wildTreeLine(bx, bz), coastZ(bx) - bz, landAt(bx, bz)]; }
          const [m, cult, heath, town, site, overTL, shore, LF] = Ld; if (town > 0.3) continue;
          const drift = fbm(x / 19, z / 19, 2, 391), rough = fbm(x / 75, z / 75, 2, 392);
          let kind = null;
          if (qAt(qS, x, z) > 0.4) { if (r < 0.2) kind = 'pebbles'; else if (r < 0.26) kind = 'tufts'; }
          else if (e < 3 + 9 * smoothstep(-0.3, 0.4, drift) && rW[kb] > 0.8) { if (r < (e < 2.6 ? 0.85 : 0.5)) kind = e < 2.6 && r2 < 0.7 ? 'reeds' : r2 < 0.75 ? 'rush' : 'tgrass'; } // the waterside: reeds at the edge, rushes behind
          else if (shore < 110 && h < SEA + 9) { if (r < 0.3) kind = r2 < 0.75 ? 'tgrass' : 'pebbles'; } // marram on the shore
          else if (overTL > 10) { if (r < 0.12 + 0.3 * smoothstep(-0.2, 0.3, drift)) kind = r2 < 0.3 ? 'pebbles' : r2 < 0.5 && overTL < 120 ? 'heather0' : 'tufts'; } // the bare tops: wiry grass, stones, low heather
          else if (m > 0.4) { if (r < 0.26 * smoothstep(-0.3, 0.2, drift)) kind = 'fern'; }
          else if (m > 0.07 && heath < 0.4) { if (r < 0.04) fl[r2 < 0.5 ? 'bush' : 'bushB'].push([x, h - 0.1, z, 0.35 + 0.4 * r2]); else if (r < 0.4) kind = r2 < 0.35 ? 'fern' : r2 < 0.75 ? 'tgrass' : 'tufts'; } // the rank fringe of a wood: bramble, bracken, long grass
          else if (LF.wet > 0.5 && m < 0.35 && cult < 0.5) { if (r < 0.5 * LF.wet * smoothstep(-0.35, 0.1, drift)) kind = r2 < 0.6 ? 'rush' : r2 < 0.9 ? 'tgrass' : 'tufts'; } // rushy ground where the water gathers
          else if (heath > 0.4 && m < 0.35) { if (drift > -0.12 && r < 0.75 * (heath - 0.25)) kind = h > 70 ? (r2 < 0.8 ? 'heather0' : 'tufts') : (r2 < 0.8 ? 'heather1' : 'tgrass'); else if (r < 0.025) kind = 'pebbles'; }
          else {
            const verge = td < 7 ? 0.45 : 0, wild = smoothstep(0.0, 0.4, rough) * (1 - 0.6 * cult); // rank growth beside a way; rough pasture where no one mows
            if (r < 0.16 + 0.5 * smoothstep(-0.2, 0.32, drift) * (0.55 + 0.45 * wild) + verge) {
              kind = r2 < 0.22 * wild + verge * 0.6 ? 'tgrass' : r2 > 0.972 ? 'weed' + Math.floor(rf.next() * 3) : r2 > 0.94 - 0.03 * smoothstep(-70, 0, overTL) ? 'pebbles' : r2 > 0.9 && fbm(x / 60, z / 60, 2, 336) > 0.05 && h < 110 ? 'flowers' + Math.floor(rf.next() * 4) : 'tufts';
            }
          }
          if (!kind) continue;
          if (site > 0.5 && Sites.clearAt(x, z, 1)) continue;
          if (inField(x, z, 0.4) || (trackSegs.length && nearTrack(x, z, 2.0))) continue;
          fl[kind].push([x, h - 0.04, z, kind === 'pebbles' ? s * 0.8 : kind === 'reeds' ? s * 0.72 : s]);
          if (kind === 'tufts' || kind === 'tgrass' || kind === 'rush' || kind === 'reeds' || kind === 'heather0' || kind === 'heather1' || kind === 'fern') { // they grow in clumps
            for (let q = (r2 * 97 % 1) < 0.55 ? 2 : 1; q > 0; q--) { const cx = x + rf.range(-1.1, 1.1), cz = z + rf.range(-1.1, 1.1), ch = this.heightAt(cx, cz); if (ch > SEA + 0.35 && !(trackSegs.length && nearTrack(cx, cz, 2.0)) && !inField(cx, cz, 0.4)) fl[kind].push([cx, ch - 0.04, cz, s * rf.range(0.7, 1.1)]); } }
        }
        if (b % 10 === 9) yield;
      }
    }
    // stones: outcrops at the breaks of slope, blocks among the scree, the odd boulder in the grass
    for (let q = 0; q < 80; q++) {
      const x = x0 + rng.next() * WC, z = z0 + rng.next() * WC, h = this.heightAt(x, z); if (h < SEA + 1) continue;
      if (siteHere && siteWeight(x, z) > 0.3) continue; // a site has its own stones
      const qr = qAt(qR, x, z), qs = qAt(qS, x, z), sl = terrainSlope(x, z);
      const TLb = wildTreeLine(x, z), p = qr > 0.15 ? 0.6 : qs > 0.3 ? 0.4 : sl > 0.35 ? 0.12 : h > TLb - 70 ? 0.16 : 0.03; // (the open tops are strewn with stones)
      if (!rng.chance(p) || nearTrack(x, z, 3) || inField(x, z, 3)) continue;
      const s = rng.range(0.5, qr > 0.15 ? 3.2 : 1.4) * (rng.chance(0.12) ? 1.7 : 1);
      boulder(gb, 'boulder', x, h, z, s, rng); c.cols.push({ x0: x - s * 1.1, z0: z - s * 1.1, x1: x + s * 1.1, z1: z + s * 1.1, y0: h - s, y1: h + s * 0.6 });
      if (s > 1.2 && rng.chance(0.6)) for (let k = 0; k < 3; k++) { const bx = x + rng.range(-2.5, 2.5) * s, bz = z + rng.range(-2.5, 2.5) * s; if (!nearTrack(bx, bz, 2.5)) boulder(gb, 'boulder', bx, this.heightAt(bx, bz), bz, s * rng.range(0.2, 0.45), rng); }
    }
    // tracks and fields lie in the same light as the ground under them; the crops keep their own colour (not the tint of heath or wood floor round them)
    for (const [k, g] of gb.g) { if (!/^(rDirt|rGravel|f[A-Z]|gDirt)/.test(k)) continue; const st = g.rgba ? 4 : 3, crop = k[0] === 'f', ft = k === 'fMeadow' ? [1.12, 1.0, 0.74] : [1.06, 0.98, 0.8];
      for (let v = 0; v < g.p.length / 3; v++) { const x = g.p[v * 3], z = g.p[v * 3 + 2], cc = crop ? litAt(x, z).map((l, q) => l * ft[q]) : colAt(x, z); g.c[v * st] = cc[0]; g.c[v * st + 1] = cc[1]; g.c[v * st + 2] = cc[2]; } }
    if (gb.g.size) group.add(gb.build(E.mats));
    group.traverse(o => { o.matrixAutoUpdate = false; });
    return c;
  },

  /* ---------- the far ground: coarse ground out to the edge of sight, its colour in its vertices, rivers and tracks painted on, woods as single trees ---------- */
  *genFar(L, cx, cz) {
    const E = this.env, C = L.C, n = Math.round(2 * L.R / C), S = n + 3, M = this.mean, inner = !!L.inner;
    const ox = Math.round(cx / L.snap) * L.snap - L.R, oz = Math.round(cz / L.snap) * L.snap - L.R; // snapped, so the fine ring's squares are the chunks' squares
    const Hb = new Float32Array(S * S);
    for (let b = 0; b < S; b++) { for (let a = 0; a < S; a++) Hb[b * S + a] = terrainRaw(ox + (a - 1) * C, oz + (b - 1) * C); if (b % 3 === 2) yield; }
    const hb = (a, b) => Hb[(b + 1) * S + a + 1];
    const hAt = (x, z) => { const fx = clamp((x - ox) / C, 0, n - 0.001), fz = clamp((z - oz) / C, 0, n - 0.001), a = Math.floor(fx), b = Math.floor(fz), u = fx - a, v = fz - b, h00 = hb(a, b), h10 = hb(a + 1, b), h01 = hb(a, b + 1), h11 = hb(a + 1, b + 1); return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v; };
    const col = new Float32Array((n + 1) * (n + 1) * 3), trees = { grove: [], pine: [] }, rng = new RNG(Math.floor(_h2(Math.round(ox / C), Math.round(oz / C), 1700 + WSEED) * 2147483647));
    for (let b = 0; b <= n; b++) {
      for (let a = 0; a <= n; a++) {
        const x = ox + a * C, z = oz + b * C, h = hb(a, b);
        const gx = (hb(a + 1, b) - hb(a - 1, b)) / (2 * C), gz = (hb(a, b + 1) - hb(a, b - 1)) / (2 * C);
        const nn = v3norm([-gx * 2.4, 1, -gz * 2.4]), t = E.tintOf(x, z, h, nn), k = (b * (n + 1) + a) * 3;
        const avg = (hb(a - 1, b) + hb(a + 1, b) + hb(a, b - 1) + hb(a, b + 1)) / 4, cav = clamp(1 + (h - avg) * 0.03, 0.72, 1.1), sh = terrainShade(nn).map(v => v * cav);
        const [qr, qs] = wildRockiness(x, z, h, Math.hypot(gx, gz) * (inner ? 1.2 : 1.3)), qg = 1 - qr - qs;
        const sand = isBeach(x, z, h) && Math.hypot(gx, gz) < 0.3;
        const SL = wildSnowLine(x, z), snow = smoothstep(SL, SL + 50, h) * smoothstep(0.35, 0.75, nn[1]), sn = [1.85, 1.87, 1.95];
        // farmland reads from afar as a patchwork of strips
        const cult = sand || qr > 0.3 ? 0 : wildCult(x, z); let fc = null;
        if (cult > 0.2) { const blk = Settle.blockAt(x, z); if (blk) fc = M[Settle.cropAt(blk, x, z, inner)]; } // the blocks of the settlement plan: strip by strip in the fine ring; the coarse ring cannot show a strip, so there a whole block takes one colour
        for (let q = 0; q < 3; q++) { let v = sh[q] * (sand ? t[q] * M.sand[q] : qg * t[q] * M.grass[q] + (qr * M.cliff[q] + qs * M.scree[q] * [0.88, 0.94, 1.06][q]) * lerp(1, sn[q], snow)); if (fc) v = lerp(v, sh[q] * fc[q] * 1.05, inner ? 0.75 : 0.6); col[k + q] = v / M.noise[q]; }
        // the woods: a tree now and then stands for the many the chunk will plant (the fine ring only)
        if (inner && !sand && qr < 0.4 && h > SEA + 2) { const TL = wildTreeLine(x, z); if (h < TL + 10) { const m = E.forestMask(x, z, h); if (m > 0.3) for (let q = 0; q < 3; q++) { if (!rng.chance(smoothstep(0.3, 0.6, m) * (1 - smoothstep(TL - 40, TL + 10, h)))) continue;
          const tx = x + rng.range(-C / 2, C / 2), tz = z + rng.range(-C / 2, C / 2), LF = landAt(tx, tz), conif = 1.1 * fbm(tx / 260 + WSEED * 2.3, tz / 260, 2, 350) + 1.2 * smoothstep(TL - 110, TL - 40, h) + smoothstep(TL - 45, TL + 12, h) + 0.7 * LF.expo - 0.7 * LF.floor - 0.3 * LF.sun - 0.5 * LF.wet + 0.1;
          (conif > 0.3 ? trees.pine : trees.grove).push([tx, hAt(tx, tz) - 0.6, tz, rng.range(1.05, 1.55)]); } } }
      }
      if (b % 3 === 2) yield;
    }
    const g = { p: [], u: [], c: [], i: [] }, x1 = ox + n * C, z1 = oz + n * C, IR = this.innerU.value;
    for (let b = 0; b < n; b++) for (let a = 0; a < n; a++) {
      const x = ox + a * C, z = oz + b * C;
      if (inner ? (x >= -TG.R && x + C <= TG.R && z >= -TG.R && z + C <= TG.R) : (x >= IR.x + 64 && x + C <= IR.z - 64 && z >= IR.y + 64 && z + C <= IR.w - 64)) continue; // ground nearer in has its own (the coarse ring keeps one cell of overlap)
      const hs = [hb(a, b), hb(a + 1, b), hb(a, b + 1), hb(a + 1, b + 1)]; if (Math.max(...hs) < SEA - 3) continue;
      const base = g.p.length / 3;
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([di, dj], q) => { const vx = x + di * C, vz = z + dj * C, k = ((b + dj) * (n + 1) + a + di) * 3; g.p.push(vx, hs[q], vz); g.u.push((vx + hs[q] * 0.7) / 6, (vz - hs[q] * 0.7) / 6); g.c.push(col[k], col[k + 1], col[k + 2]); }); // (the height shifts the grain, so steep faces are not streaked)
      g.i.push(base, base + 3, base + 1, base, base + 2, base + 3);
    }
    if (inner) { // a skirt round the fine ring, so the coarse ring beyond can never show a crack
      const edge = (a0, b0, a1, b1, dx, dz) => { const k0 = (b0 * (n + 1) + a0) * 3, k1 = (b1 * (n + 1) + a1) * 3, xa = ox + a0 * C, za = oz + b0 * C, xb = ox + a1 * C, zb = oz + b1 * C, ha = hb(a0, b0), hb2 = hb(a1, b1), base = g.p.length / 3, o = 45;
        g.p.push(xa, ha, za, xb, hb2, zb, xb + dx * o, hb2 - 30, zb + dz * o, xa + dx * o, ha - 30, za + dz * o); g.u.push(xa / 6, za / 6, xb / 6, zb / 6, (xb + dx * o) / 6, (zb + dz * o) / 6, (xa + dx * o) / 6, (za + dz * o) / 6); for (const k of [k0, k1, k1, k0]) g.c.push(col[k], col[k + 1], col[k + 2]);
        g.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2); };
      for (let q = 0; q < n; q++) for (const [a0, b0, a1, b1, dx, dz] of [[q, 0, q + 1, 0, 0, -1], [q, n, q + 1, n, 0, 1], [0, q, 0, q + 1, -1, 0], [n, q, n, q + 1, 1, 0]]) if (Math.max(hb(a0, b0), hb(a1, b1)) > SEA - 1) edge(a0, b0, a1, b1, dx, dz); // an apron sloping out and down (not under the sea, where it would show through the water far off)
    }
    yield;
    // rivers and tracks painted over the far ground, a little wider than they are so they still read at a distance
    const r = { p: [], u: [], c: [], i: [] }, inBox = (x, z) => x > ox && x < x1 && z > oz && z < z1;
    const strip = (pts, wf, cl, lift) => { for (let q = 1; q < pts.length; q++) { const [ax0, az0] = pts[q - 1], [bx0, bz0] = pts[q]; if (!inBox(ax0, az0) || !inBox(bx0, bz0)) continue; const L = Math.hypot(bx0 - ax0, bz0 - az0) || 1, nx = -(bz0 - az0) / L, nz = (bx0 - ax0) / L, ns = Math.max(1, Math.ceil(L / (C * 0.5)));
      for (let s = 0; s < ns; s++) { const f0 = s / ns, f1 = (s + 1) / ns, ax = lerp(ax0, bx0, f0), az = lerp(az0, bz0, f0), bx = lerp(ax0, bx0, f1), bz = lerp(az0, bz0, f1), wa = lerp(wf(q - 1), wf(q), f0) / 2, wb = lerp(wf(q - 1), wf(q), f1) / 2, base = r.p.length / 3; // in pieces no longer than half a cell, so the coarse ground cannot rise through the middle of one
        for (const [x, z] of [[ax + nx * wa, az + nz * wa], [bx + nx * wb, bz + nz * wb], [bx - nx * wb, bz - nz * wb], [ax - nx * wa, az - nz * wa]]) { r.p.push(x, hAt(x, z) + lift, z); r.u.push(x / 6, z / 6); r.c.push(...cl); }
        r.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2); } } };
    const wc = M.water.map((v, q) => v * [0.78, 0.86, 0.8][q] / M.noise[q]), dc = M.dirt.map((v, q) => v * 0.95 / M.noise[q]), step = inner ? 4 : 10;
    for (const R of this.rivers) { if (R.box[0] > x1 || R.box[2] < ox || R.box[1] > z1 || R.box[3] < oz) continue; const wmin = inner ? 4 : 7; if (Math.max(...R.w) < wmin) continue;
      const keep = R.P.map((_, q) => (q % step === 0 || q === R.P.length - 1)), pts = R.P.filter((_, q) => keep[q]), ws = R.w.filter((_, q) => keep[q]);
      const q0 = ws.findIndex(w => w >= wmin * 0.6); if (q0 < 0 || q0 > pts.length - 2) continue; // one unbroken line from where it is first wide enough: a river drawn in dashes reads as a fault
      strip(pts.slice(q0), k => inner ? Math.max(ws[q0 + k], 4) : Math.max(ws[q0 + k] * 1.4, 9), wc, inner ? 2.2 : 4.0); }
    // the fields of the settlement plan: strip by strip in the fine ring, a block at a time in the coarse one, each edged dark where its hedge runs,
    // so from afar the farmland reads as a patchwork of hedged blocks (the near ground has the real ones)
    { const hc = M.grass.map((v, q) => v * [0.42, 0.5, 0.38][q] / M.noise[q]), lift = inner ? 0.55 : 1.8, step = inner ? C * 0.7 : C * 0.6;
      const patch = (o, lx0, lx1, lz0, lz1, key, dark) => { // dark: [left, right, near end, far end] edged with hedge colour
        const fc = key === 'fMeadow' ? M.fMeadow.map((v, q) => lerp(v, M.grass[q] * [1.02, 0.96, 0.78][q], 0.6)) : M[key], e = inner ? 1.6 : 5, ek = inner ? 1 : 0.55, us = [lx0, lx0 + e], vs = [lz0, lz0 + e]; for (let t = lx0 + e + step; t < lx1 - e - 0.5; t += step) us.push(t); us.push(lx1 - e, lx1); for (let t = lz0 + e + step; t < lz1 - e - 0.5; t += step) vs.push(t); vs.push(lz1 - e, lz1);
        const base = r.p.length / 3, nu = us.length, nv = vs.length;
        for (let b = 0; b < nv; b++) for (let a = 0; a < nu; a++) { const [x, z] = xfP(o, us[a], vs[b]), y = hAt(x, z), d = C * 0.5, gx = (hAt(x + d, z) - hAt(x - d, z)) / (2 * d), gz = (hAt(x, z + d) - hAt(x, z - d)) / (2 * d), sh = terrainShade(v3norm([-gx * 2.4, 1, -gz * 2.4]));
          const edge = (a === 0 && dark[0]) || (a === nu - 1 && dark[1]) || (b === 0 && dark[2]) || (b === nv - 1 && dark[3]); r.p.push(x, y + lift, z); r.u.push(x / 6, z / 6);
          for (let q = 0; q < 3; q++) { const f = fc[q] * 1.05 / M.noise[q]; r.c.push(sh[q] * (edge ? lerp(f, hc[q], ek) : f)); } }
        for (let b = 0; b < nv - 1; b++) for (let a = 0; a < nu - 1; a++) { const k = base + b * nu + a; r.i.push(k, k + nu, k + 1, k + 1, k + nu, k + nu + 1); } }; // (facing up: seen only from above)
      let nb = 0; for (const o of Settle.blocksIn(ox, oz, x1, z1)) {
        if (++nb % 40 === 0) yield;
        if (o.x < ox + 4 || o.x > x1 - 4 || o.z < oz + 4 || o.z > z1 - 4) continue;
        if (!inner && o.x > IR.x + 40 && o.x < IR.z - 40 && o.z > IR.y + 40 && o.z < IR.w - 40) continue; // (the fine ring has it)
        if (Settle.ufAt(o.x, o.z) < 0.3) continue;
        if (!inner) { patch(o, -o.hx - 1.2, o.hx + 1.2, -o.hz - 1.2, o.hz + 1.2, Settle.cropOf(o, 0), [1, 1, 1, 1]); continue; }
        for (let k = 0; k < o.n; k++) { const lx = -o.hx + o.pw / 2 + k * (o.pw + 2.4), [sx, sz] = xfP(o, lx, 0); if (Settle.ufAt(sx, sz) < 0.3 || this.trackD(sx, sz) < 9) continue; const rv = riverNear(sx, sz, 40); if (rv && rv.d < rv.w / 2 + 20) continue;
          const op = o.open; patch(o, lx - o.pw / 2 - 1.2, lx + o.pw / 2 + 1.2, -o.hz - 1.2, o.hz + 1.2, Settle.cropOf(o, k), [!op || k === 0, !op || k === o.n - 1, 1, 1]); }
      } }
    { const gc = M.gravel.map((v, q) => v * 0.98 / M.noise[q]), grc = dc.map((v, q) => lerp(v, M.grass[q] * [1.02, 0.96, 0.78][q] / M.noise[q], 0.55)), st = inner ? 5 : 12; // each kind of way in its own width and colour (the coarse ring leaves out the lanes)
      for (const T of this.tracks) { const kind = q => T.cls ? T.cls[q] : T.lane ? WAY.lane : WAY.track, idx = []; for (let q = 0; q < T.length; q += st) idx.push(q); if (idx[idx.length - 1] !== T.length - 1) idx.push(T.length - 1);
        let pts = [T[idx[0]]], k0 = kind(idx[Math.min(1, idx.length - 1)]);
        const out = () => { if (pts.length > 1 && (inner || k0 === WAY.track || k0 === WAY.road)) strip(pts, () => (inner ? [4, 6, 3, 2.4] : [8, 11, 6, 6])[k0], [dc, gc, dc, grc][k0], inner ? 0.9 : 2.6); };
        for (let n = 1; n < idx.length; n++) { const k = kind(idx[n]); if (k !== k0) { out(); pts = [pts[pts.length - 1]]; k0 = k; } pts.push(T[idx[n]]); }
        out(); } }
    yield;
    const group = new THREE.Group(); group.add(groupMesh(g, inner ? E.mats.wFar : E.mats.wFarO)); if (r.i.length) group.add(groupMesh(r, inner ? E.mats.wFarR : E.mats.wFarRO));
    group.traverse(o => { o.matrixAutoUpdate = false; });
    if (L.group) { this.area.scene.remove(L.group); L.group.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    L.group = group; this.area.scene.add(group); L.at = [cx, cz];
    if (inner) { this.innerU.value.set(ox, oz, x1, z1); for (const k in trees) this.farTrees[k].set(trees[k]); } else this.outerU.value.set(ox, oz, x1, z1);
  },
};
// the trees standing for far woods: billboards turned on the graphics card, hidden over chunks that have their own
class FarTrees {
  constructor(area, tex, w, h) {
    this.area = area; this.geo = planeGeo(w, h); this.mat = spriteMat(tex); area.tintMats.push(this.mat);
    this.mat.onBeforeCompile = sh => { sh.uniforms.wYaw = Wild.yawU; sh.uniforms.wMask = Wild.maskU;
      sh.vertexShader = 'uniform float wYaw; uniform sampler2D wMask;\n' + sh.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = vec3(position.x * cos(wYaw), position.y, -position.x * sin(wYaw));
        if (texture2D(wMask, (floor((vec2(instanceMatrix[3][0], instanceMatrix[3][2]) + 352.0) / 176.0) + vec2(64.5, 112.5)) / 128.0).r > 0.5) transformed = vec3(0.0);`); sh.fragmentShader = sh.fragmentShader.replace('#include <fog_fragment>', FAR_FOG); };
    this.mat.customProgramCacheKey = () => 'wildFarTree';
    this.mesh = null; this.cap = 0; this._m = new THREE.Matrix4();
  }
  set(list) {
    if (list.length > this.cap) { if (this.mesh) { this.area.scene.remove(this.mesh); this.mesh.dispose(); } this.cap = Math.ceil(list.length * 1.3) + 64; this.mesh = new THREE.InstancedMesh(this.geo, this.mat, this.cap); this.mesh.frustumCulled = false; this.area.scene.add(this.mesh); }
    const m = this._m.elements; let k = 0;
    for (const p of list) { const s = p[3]; m.fill(0); m[0] = m[5] = m[10] = s; m[12] = p[0]; m[13] = p[1]; m[14] = p[2]; m[15] = 1; this.mesh.setMatrixAt(k++, this._m); }
    this.mesh.count = list.length; this.mesh.instanceMatrix.needsUpdate = true;
  }
}
function groupMesh(g, mat) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2)); geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, g.rgba ? 4 : 3));
  geo.setIndex(g.i); geo.computeBoundingSphere(); const m = new THREE.Mesh(geo, mat); m.matrixAutoUpdate = false; return m;
}
// a hedge that reads as one: bushes of uneven height crowding along the line, over a low core
function hedgeBushes(fl, ax, az, bx, bz, rng, W) {
  const L = Math.hypot(bx - ax, bz - az);
  for (let t = rng.range(0, 0.8); t < L; t += rng.range(0.9, 2.2)) { const f = t / L, x = lerp(ax, bx, f) + rng.range(-0.3, 0.3), z = lerp(az, bz, f) + rng.range(-0.3, 0.3); fl[rng.chance(0.5) ? 'bush' : 'bushB'].push([x, W.heightAt(x, z) - 0.35, z, rng.range(0.55, 1.05) * (rng.chance(0.12) ? 1.35 : 1)]); }
}
// true if any track segment crosses or comes within 4 m of the box
function segDistObb(segs, o) { const cs = obbCorners(o); return segs.some(s => { for (let q = 0; q < 4; q++) { const a = cs[q], b = cs[(q + 1) % 4]; if (segCross(s[0], s[1], s[2], s[3], a[0], a[1], b[0], b[1])) return true; } return circleObb(s[0], s[1], 4, o); }); }

// how much of the ground is bare rock and how much scree, from the slope and the height above the tree line; ragged with noise
function wildRockiness(x, z, h, slope, apron = 0) {
  if (Math.hypot(x, z) < 380) return [0, 0];
  const nz = fbm(x / 36, z / 36, 2, 333), TL = wildTreeLine(x, z);
  const sea = 0.55 * smoothstep(160, 30, coastZ(x) - z) * smoothstep(SEA + 6, SEA + 18, h) + 0.3 * smoothstep(1800, 300, rimDist(x, z)); // (high ground breaks off at the sea in bare cliffs) // the sea keeps its cliffs bare, and the great mountains theirs
  const qr = smoothstep(1.12, 1.5, slope + 0.32 * nz + 0.15 * smoothstep(TL, TL + 60, h) + sea); // bare rock in outcrops on the steepest ground; turf and trees hold the rest
  const patch = smoothstep(-0.15, 0.25, fbm(x / 140, z / 140, 2, 334) + 0.35 * nz); // scree lies in tongues and fans, not over whole hills
  const alpine = smoothstep(TL + 90, TL + 190, h + 22 * nz) * smoothstep(0.55, 0.9, slope + 0.12 * nz) * patch; // above the trees alpine grass first, scree higher up on the steeper ground
  return [qr, (1 - qr) * Math.max(alpine, apron)];
}
// open heath: heather on the uplands, bracken lower down, where the land is neither wooded nor farmed
function wildHeath(x, z, h) { const r = Math.hypot(x, z); if (r < 420) return 0; const up = smoothstep(-90, 0, h - wildTreeLine(x, z)); const g = smoothstep(420, 700, r) * smoothstep(0.08 - 0.25 * up, 0.22 - 0.25 * up, 0.6 * fbm(x / 420 + WSEED, z / 420, 2, 362) + 0.25 * fbm(x / 90, z / 90, 1, 365) + (L => 0.95 * (L.expo - 0.3) - 0.45 * L.wet + 0.08 * L.sun)(landAt(x, z))) * (1 - smoothstep(0.25, 0.55, wildCult(x, z))); const st = r > 1500 ? siteAt(x, z) : null; return st ? lerp(g, siteHeath(st.S, x, z, h), st.w) : g; } // broad tracts on the high dry ground
// small woods standing in open country (the copses of the plant rules), for the ground tint under them
function wildCopse(x, z) { const r = Math.hypot(x, z); if (r < 380) return 0; return smoothstep(380, 560, r) * smoothstep(0.4, 0.5, fbm(x / 34, z / 34, 2, 88)) * (1 - smoothstep(0.4, 0.55, wildCult(x, z))) * (1 - siteWeight(x, z)) * (1 - townCore(x, z)); }

// what grows at a spot in the wild: {kind, s, small} or null. m is how wooded the land is, cult how farmed
function wildPlant(x, z, h, sl, n, rng, m, dens, qs, cult, heath = 0, fixed = false) {
  const WS = fixed ? 0 : WSEED; // a site's own plants are the same in every world
  const r = rng.next(), r2 = rng.next(), r3 = rng.next();
  const TL = wildTreeLine(x, z);
  if (h > TL + 20 || qs > 0.6) return r < 0.02 && sl < 0.9 ? { kind: 'bush', s: 0.5 + r2 * 0.4 } : r < 0.14 && qs < 0.8 ? { kind: 'tufts', small: true, s: 0.7 + r2 * 0.4 } : null;
  const alp = smoothstep(TL - 45, TL + 12, h);                     // woods thin out and turn to pine towards the tree line
  const copse = fbm(x / 34, z / 34, 2, 88);
  m = clamp(m + 0.22 * fbm(x / 30, z / 30, 2, 369) + 0.1 * fbm(x / 9, z / 9, 1, 370), 0, 1); // ragged wood edges: bays, tongues and outliers
  if (m > 0.004 && m < 0.16 && r < 0.36 * Math.min(1, m / 0.1) && h < TL) return r2 < 0.55 ? { kind: r3 < 0.5 ? 'bush' : 'bushB', s: 0.6 + r3 * 0.6 } : { kind: n[1] > 0.9 && r3 < 0.7 ? 'oak' + Math.floor(r3 * 3) % 3 : 'pine', s: 0.45 + r3 * 0.35 }; // scrub and saplings thinning out from the wood
  let p = m > 0.06 ? 0.95 * smoothstep(0.12, 0.45, m) * (1 - 0.5 * smoothstep(0.3, 0.6, cult)) : copse > lerp(0.36, 0.48, smoothstep(0.15, 0.5, cult)) ? 0.45 : 0.0004; // woods, copses (fewer in farmland), the odd lone tree
  p = Math.min(1, p * dens * (0.45 + smoothstep(-0.3, 0.35, fbm(x / 16, z / 16, 2, 361)))) * (m > 0.3 ? 0.1 + 0.9 * smoothstep(-0.5, -0.22, fbm(x / 80, z / 80, 2, 386)) : 1) * (1 - 0.85 * alp) * (1 - 0.85 * smoothstep(0.7, 1.15, sl)); // trees stand in clumps, with glades between; few cling to steep faces
  const edge = m > 0.03 && m < 0.35;
  if (r < p) {
    if (r2 < (edge ? 0.3 : 0.07) + alp * 0.25) return { kind: 'bush', s: 0.7 + r3 * 0.7 };
    // each stand has a leading species: pine on high and north-facing ground, broadleaf in the lowlands, mixed between
    const L = landAt(x, z), conif = 1.1 * fbm(x / 260 + WS * 2.3, z / 260, 2, 350) + 1.2 * smoothstep(TL - 110, TL - 40, h) - 0.35 * n[2] + alp + 0.7 * L.expo - 0.7 * L.floor - 0.3 * L.sun - 0.5 * L.wet + 0.1; // pine on the high, open and shaded ground, broadleaf in the valleys and by the water // stands of one kind or the other, few mixed
    let kind;
    if (conif > 0.3) kind = r2 < 0.86 ? 'pine' : r2 < 0.93 ? 'oak' : 'dead';
    else if (conif < -0.12) kind = r2 < 0.9 ? 'oak' : r2 < 0.95 ? 'pine' : n[2] > 0.25 && h < 40 && r3 < 0.5 ? 'cypress' : 'oak';
    else kind = r2 < 0.55 ? 'oak' : r2 < 0.95 ? 'pine' : 'dead';
    if (kind === 'oak') kind = m > 0.75 && r3 > 0.55 && h < 95 ? 'grove' : 'oak' + (Math.floor(r3 * 3) % 3); // deep woods read as one canopy
    // old trees and young ones: saplings crowd the edges of the woods
    let s = 0.62 + Math.pow(r3, 0.6) * 0.66; if (edge && r3 < 0.35) s *= 0.6; if (kind === 'pine' && alp > 0.3) s *= 0.72;
    return { kind, s };
  }
  // the ground between: ferns under the trees, tufts in the open grass, drifts of flowers in the meadows
  if (m > 0.4 && r2 < 0.24) return { kind: 'fern', small: true, s: 0.7 + r3 * 0.6 };
  if (heath > 0.05 && m < 0.35) { if (r2 < 0.06 * heath) return { kind: 'bush', s: 0.5 + r3 * 0.6 }; if (heath > 0.45 && fbm(x / 12, z / 12, 2, 363) > 0.0 && r2 < 1.3 * (heath - 0.45)) return { kind: h > 70 ? 'heather0' : 'heather1', small: true, s: 0.6 + r3 * 0.5 }; } // in clumps, grass between // sprites only in the heart of a patch; its tint carries the rest
  if (m < 0.3 && sl < 0.7) {
    if (r2 < 0.012 && fbm(x / 60, z / 60, 2, 336) > 0.1 && h < 110) return { kind: 'flowers', small: true };
    if (r2 < 0.1 + 0.2 * alp) return { kind: 'tufts', small: true, s: 0.8 + r3 * 0.6 };
  }
  return null;
}

// an irregular boulder: a rough, flat-faced lump, sunk a little into the ground and tilted
function boulder(gb, key, x, y, z, s, rng) {
  const seg = 6, rings = [[-0.45, 0.78], [0.05, 1], [0.5, 0.82], [0.85, 0.42]], sx = s * rng.range(0.8, 1.25), sy = s * rng.range(0.5, 0.8), sz = s * rng.range(0.75, 1.1);
  // lean with the slope and sink into it, so the downhill side never hangs in the air
  const gx = (terrainH(x + 1.5, z) - terrainH(x - 1.5, z)) / 3, gz = (terrainH(x, z + 1.5) - terrainH(x, z - 1.5)) / 3, sl = Math.min(1.2, Math.hypot(gx, gz));
  y -= sl * s * 0.55;
  const a0 = rng.range(0, 6.283), tx = gx * 0.7 + rng.range(-0.12, 0.12), tz = gz * 0.7 + rng.range(-0.12, 0.12), ca = Math.cos(a0), sa = Math.sin(a0);
  const P = (px, py, pz) => { const X = px * ca - pz * sa, Z = px * sa + pz * ca; return [x + X, y + py + X * tx + Z * tz, z + Z]; };
  const R = rings.map(([ry, rr]) => { const pts = []; for (let k = 0; k < seg; k++) { const a = k / seg * 6.283 + rng.range(-0.25, 0.25), w = rr * rng.range(0.75, 1.15); pts.push(P(Math.cos(a) * w * sx, ry * sy + rng.range(-0.08, 0.08) * sy, Math.sin(a) * w * sz)); } return pts; });
  const top = P(rng.range(-0.15, 0.15) * sx, sy * rng.range(0.95, 1.1), rng.range(-0.15, 0.15) * sz);
  const uv = p => [(p[0] + p[2]) / 3.2, p[1] / 3.2];
  for (let r = 0; r < R.length - 1; r++) for (let k = 0; k < seg; k++) { const a = R[r][k], b = R[r][(k + 1) % seg], c = R[r + 1][(k + 1) % seg], d = R[r + 1][k]; const out = [(a[0] + c[0]) / 2 - x, 0, (a[2] + c[2]) / 2 - z]; gb.quad4(key, a, b, c, d, uv(a), uv(b), uv(c), uv(d), out); }
  const L = R[R.length - 1]; for (let k = 0; k < seg; k++) gb.tri(key, L[k], L[(k + 1) % seg], top, uv(L[k]), uv(L[(k + 1) % seg]), uv(top), [0, 1, 0]);
}

// a bridge where a track crosses a river: a plank deck on timber trestles, or (by the city) a stone bridge with parapets
function bridgeMesh(gb, b, cols) {
  const L = b.half * 2, y = b.deck, c = Math.cos(b.ang), s = Math.sin(b.ang), bed = b.wl - 1.2 - b.w * 0.05;
  gb.setXf(b.x, b.z, b.ang, 0);
  if (b.stone) {
    gb.box(-2.6, y - 0.9, -L / 2 - 1.5, 2.6, y, L / 2 + 1.5, { side: 'stone', top: 'flag' }, 2, 2);                       // the deck and its spandrels
    for (const sx of [-1, 1]) gb.box(sx * 2.6 - 0.35, y, -L / 2 - 1.5, sx * 2.6 + 0.35, y + 0.75, L / 2 + 1.5, { side: 'stone', top: 'stoneLight' }, 2, 2); // parapets
    for (const sz of [-1, 1]) gb.box(-2.4, bed, sz * (L / 2 - 1.6) - 1.6, 2.4, y - 0.9, sz * (L / 2 - 1.6) + 1.6, 'stone', 2, 2);          // abutments
    gb.box(-2.4, bed, -0.9, 2.4, y - 0.9, 0.9, 'stone', 2, 2);                                                                   // a pier in the stream
    for (const sx of [-1, 1]) gb.box(sx * 2.6 - 0.36, y - 0.95, -0.95, sx * 2.6 + 0.36, y + 0.82, 0.95, 'stoneLight', 1, 1);    // its refuge over the cutwater
  } else {
    gb.box(-1.8, y - 0.28, -L / 2, 1.8, y, L / 2, { side: 'woodDark', top: 'wood' }, 2, 2);                                     // planks
    for (const sx of [-1, 1]) {
      gb.box(sx * 1.75 - 0.08, y, -L / 2, sx * 1.75 + 0.08, y + 0.1, L / 2, 'woodDark', 1, 1);
      gb.box(sx * 1.75 - 0.07, y + 0.95, -L / 2, sx * 1.75 + 0.07, y + 1.07, L / 2, 'woodDark', 1, 1);                         // the hand rail
      for (let t = -L / 2; t <= L / 2 + 0.01; t += L / Math.max(2, Math.round(L / 2.2))) gb.box(sx * 1.75 - 0.08, y, t - 0.08, sx * 1.75 + 0.08, y + 1.07, t + 0.08, 'woodDark', 1, 1);
    }
    for (let t = -L / 2 + 2; t <= L / 2 - 1.9; t += Math.max(3, (L - 4) / Math.max(1, Math.round((L - 4) / 4)))) for (const sx of [-1.4, 1.4]) gb.box(sx - 0.14, bed, t - 0.14, sx + 0.14, y - 0.28, t + 0.14, 'woodDark', 1, 1); // trestles
  }
  gb.xf = null;
  const ob = (hx, hz, ox, y0, y1) => { const x = b.x + c * ox, z = b.z - s * ox, e = Math.hypot(hx, hz) + 0.3; cols.push({ x0: x - e, z0: z - e, x1: x + e, z1: z + e, y0, y1, o: { x, z, c, s, hx, hz } }); };
  const half = L / 2 + (b.stone ? 1.5 : 0), rail = b.stone ? 2.6 : 1.75;
  ob(rail, half, 0, y - 0.9, y);                              // the deck: walked on
  for (const sx of [-1, 1]) ob(0.3, half, sx * rail, y, y + 1.1); // the sides: not walked off
}
// a track that runs on from a gate road into the wild: routed leg by leg to low, dry ground about 3 km on in the heading of each leg,
// through the passes, never back into the surveyed land. `used` holds the cells of earlier tracks: meeting one, this track joins it and ends there
const TRC = 32; // the routing grid
function wildTrack(pre, aims, seed, used, prev, rc) {
  let pts = pre.map(p => p.slice()), joined = false;
  for (let leg = 0; leg < aims.length; leg++) {
    const [sx, sz] = pts[pts.length - 1];
    let goal = null, best = Infinity; const drift = (_h2(seed, leg, 5) - 0.5) * 0.5;
    for (let t = -6; t <= 6; t++) { const a = aims[leg] + drift + t * 0.16, gx = sx + Math.sin(a) * 3000, gz = sz + Math.cos(a) * 3000; if (rimDist(gx, gz) < 1500) continue; const h = terrainRaw(gx, gz); if (h < SEA + 4 || coastZ(gx) - gz < 150) continue; const c = Math.abs(t) * 0.16 + Math.max(0, h - 60) / 40 + (riverNear(gx, gz, 30) ? 1.5 : 0); if (c < best) { best = c; goal = [gx, gz]; } }
    if (!goal) break;
    const r = routeWild([sx, sz], goal, seed + leg, used, rc); if (!r) break;
    pts = pts.concat(r.path.slice(1));
    if (r.joined) { // run on to the track it met
      const [ex, ez] = pts[pts.length - 1]; let bp = null, bd = 1e9; for (const T of prev) for (const q of T) { const d = Math.hypot(q[0] - ex, q[1] - ez); if (d < bd) { bd = d; bp = q; } }
      if (bp) pts.push([bp[0], bp[1]]); joined = true; break; }
  }
  let out = resampleEven(smoothPath(simplifyPath(pts, 4), 3), 3);
  // a track wanders a little where nothing makes it keep straight: not on its fixed way out, nor where it meets another
  let preLen = 0; for (let q = 1; q < pre.length; q++) preLen += Math.hypot(pre[q][0] - pre[q - 1][0], pre[q][1] - pre[q - 1][1]);
  const L = out.length, sd = _h2(seed, 3, 9) * 100;
  out = out.map((p, q) => { const a = out[Math.max(0, q - 2)], b = out[Math.min(L - 1, q + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = smoothstep(preLen, preLen + 60, q * 3) * Math.min(1, (L - 1 - q) * 3 / 45);
    const off = 7 * k * fbm(q * 3 / 140 + sd, 4.4, 2, 384); return [p[0] - (b[1] - a[1]) / l * off, p[1] + (b[0] - a[0]) / l * off]; });
  out.joined = joined;
  for (let q = 0; q < out.length; q += 2) { const i = Math.round(out[q][0] / TRC), j = Math.round(out[q][1] / TRC); for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) used.add((i + di) * 8192 + j + dj); } // near enough to meet
  return out;
}
function routeWild(from, to, seed, used, rc = null, C = TRC) {
  const key = (i, j) => (i + 4096) * 8192 + (j + 4096), hs = new Map();
  const hAt = (i, j) => { const k = key(i, j); let h = hs.get(k); if (h === undefined) hs.set(k, h = terrainRaw(i * C, j * C)); return h; };
  const si = Math.round(from[0] / C), sj = Math.round(from[1] / C), ti = Math.round(to[0] / C), tj = Math.round(to[1] / C);
  const g = new Map(), came = new Map(), closed = new Set(), heap = [];
  const push = (k, f) => { heap.push([f, k]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1], [2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
  const S = key(si, sj), T = key(ti, tj); g.set(S, 0); push(S, 0); let n = 0, found = null;
  while (heap.length && n++ < 55000) {
    const [, k] = pop(); if (closed.has(k)) continue; closed.add(k);
    const i = Math.floor(k / 8192) - 4096, j = k % 8192 - 4096, hk = hAt(i, j);
    if (k === T || (used.has(i * 8192 + j) && Math.hypot(i * C - from[0], j * C - from[1]) > 60 && Math.hypot(i * C, j * C) > 1800)) { found = k; break; } // tracks from different gates meet out in the country, not under the walls
    for (const [di, dj] of DIRS) {
      const ni = i + di, nj = j + dj, nk = key(ni, nj); if (closed.has(nk)) continue;
      const x = ni * C, z = nj * C; if (Math.abs(x) < TG.R + 12 && Math.abs(z) < TG.R + 12 && Math.hypot(x - from[0], z - from[1]) > 45) continue;
      if (townCore(x, z) > 0.2 && Math.hypot(x - from[0], z - from[1]) > 60) continue;
      const nh = hAt(ni, nj); if ((nh < SEA + 1.8 && !(nh > SEA + 0.3 && rc && rc.near.has(ni * 8192 + nj))) || rimDist(x, z) < 900) continue; // (low ground on a river's floor near its mouth can be crossed: the floors are too wide to step over)
      const len = Math.hypot(di, dj) * C, gr = Math.abs(nh - hk) / len, rw = rc ? rc.get(ni * 8192 + nj) : 0;
      const c = len * (1 + (gr / 0.075) ** 2 + 0.25 * (1 + vnoise(x / 260, z / 260, seed)) + (rw ? (rw > 4.5 ? 30 : 2.5) : 0) + (rc && rc.near.has(ni * 8192 + nj) ? 1.6 : 0)) * (landZone(x, z) ? 3 : 1) * (siteWeight(x, z) > 0.6 ? 3 : 1) + (nh > 150 ? len * 2 : 0); // easy grades, a little wander, few bridges, out of the city's fields, and not over the tops
      const ng = g.get(k) + c; if (ng < (g.get(nk) ?? Infinity)) { g.set(nk, ng); came.set(nk, k); push(nk, ng + Math.hypot(ti - ni, tj - nj) * C * 2.2); } // greedy enough to stay quick; the grade cost still bends it round the hills
    }
  }
  if (found == null) return null;
  const out = []; for (let k = found; k !== undefined; k = came.get(k)) { out.push([(Math.floor(k / 8192) - 4096) * C, (k % 8192 - 4096) * C]); if (k === S) break; }
  out.reverse(); out[0] = from.slice(); return { path: out, joined: found !== T };
}
