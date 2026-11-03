/* =====================================================================
   Main: renderer, sky & day/night, areas, city life, resting, saving, loop
   ===================================================================== */

const TIME_SCALE = 1; // game minutes per real second
let renderer, camera, hudCanvas, hudCtx;
G.tint = new THREE.Color(1, 1, 1);

/* ---------------- sky ---------------- */
const SKY_KEYS = [
  [0, '#04050c', '#0e1122', 0.24], [4.5, '#060818', '#1a1a2e', 0.26], [5.5, '#1e2a50', '#6a4a50', 0.45], [6.5, '#3e5a90', '#e09a6a', 0.78],
  [7.4, '#3a68b4', '#f2c294', 0.92], [8.4, '#4a78b8', '#c4d2de', 1.0], [12, '#3d70b8', '#bcd2e4', 1.0], [17, '#4a6ea8', '#d0c4a8', 0.95], [18.5, '#2e3a70', '#e0784a', 0.72],
  [19.5, '#141a40', '#4a2e44', 0.44], [20.5, '#070a1c', '#141628', 0.27], [24, '#04050c', '#0e1122', 0.24],
].map(([h, a, b, l]) => [h, new THREE.Color(a), new THREE.Color(b), l]);
function addSky(area) {
  const sc = area.scene;
  const geo = new THREE.SphereGeometry(900, 24, 12); geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
  const skyMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(geo, skyMat); sky.renderOrder = -10; sky.frustumCulled = false; sc.add(sky);
  const sp = []; const r = new RNG(77); for (let i = 0; i < 700; i++) { const a = r.next() * Math.PI * 2, y = r.range(0.05, 1); const rr = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * rr * 850, y * 850, Math.sin(a) * rr * 850); }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false });
  const stars = new THREE.Points(sg, starMat); stars.renderOrder = -9; stars.frustumCulled = false; sc.add(stars);
  const mk = (tex, s) => { const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, fog: false, depthWrite: false, transparent: true })); m.scale.set(s, s, 1); m.renderOrder = -8; sc.add(m); return m; };
  const sun = mk(TEX.sun, 110), masser = mk(TEX.masser, 70), secunda = mk(TEX.secunda, 30);
  const cg = new THREE.CircleGeometry(1400, 48); const cc = new Float32Array(cg.attributes.position.count * 4);
  for (let i = 0; i < cg.attributes.position.count; i++) { cc[i * 4] = cc[i * 4 + 1] = cc[i * 4 + 2] = 1; cc[i * 4 + 3] = i === 0 ? 1 : 0; }
  cg.setAttribute('color', new THREE.BufferAttribute(cc, 4)); TEX.clouds.repeat.set(7, 7);
  const cloudMat = new THREE.MeshBasicMaterial({ map: TEX.clouds, transparent: true, vertexColors: true, fog: false, depthWrite: false, side: THREE.DoubleSide });
  const clouds = new THREE.Mesh(cg, cloudMat); clouds.rotation.x = -Math.PI / 2; clouds.position.y = 170; clouds.renderOrder = -7; sc.add(clouds);
  TEX.mountains.repeat.set(1, 1);
  const mountMat = new THREE.MeshBasicMaterial({ map: TEX.mountains, transparent: true, alphaTest: 0.5, fog: false, side: THREE.DoubleSide, depthWrite: false });
  const mountains = new THREE.Mesh(new THREE.CylinderGeometry(560, 560, 110, 96, 1, true), mountMat); mountains.position.y = 38; mountains.renderOrder = -6; sc.add(mountains);
  const rp = new Float32Array(900 * 6); const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.BufferAttribute(rp, 3));
  const rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x9aa8b8, transparent: true, opacity: 0.45, fog: false })); rain.frustumCulled = false; rain.visible = false; sc.add(rain);
  for (let i = 0; i < 900; i++) { rp[i * 6] = rnd.range(-30, 30); rp[i * 6 + 1] = rnd.range(0, 25); rp[i * 6 + 2] = rnd.range(-30, 30); }
  area.sky = { sky, geo, stars, starMat, sun, masser, secunda, clouds, cloudMat, mountains, mountMat, rain, rp };
  sc.fog = new THREE.Fog(0x9ab0c8, 60, 200);
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), _c3 = new THREE.Color(), _c4 = new THREE.Color();
function updateSky(area, dt) {
  const S = area.sky; const h = hourOf(G.time);
  let k = 0; while (k < SKY_KEYS.length - 2 && SKY_KEYS[k + 1][0] <= h) k++;
  const [h0, t0, z0, l0] = SKY_KEYS[k], [h1, t1, z1, l1] = SKY_KEYS[k + 1]; const f = (h - h0) / (h1 - h0);
  const top = _c1.copy(t0).lerp(t1, f), hor = _c2.copy(z0).lerp(z1, f); let L = lerp(l0, l1, f);
  const wx = G.weather; const gray = _c3.set(0x6e747c);
  if (wx !== 'clear') { const g = wx === 'rain' ? 0.65 : 0.4; top.lerp(gray.clone().multiplyScalar(L), g); hor.lerp(gray.clone().multiplyScalar(Math.max(L, 0.3)), g); L *= wx === 'rain' ? 0.7 : 0.85; }
  // sky gradient, warmer around a low sun
  const pos = S.geo.attributes.position, col = S.geo.attributes.color;
  const sa = (h - 6) / 12.5 * Math.PI; const sdx = Math.cos(sa), sdy = Math.sin(sa) * 0.9, sdz = 0.4, sdl = Math.hypot(sdx, sdy, sdz); const lowSun = sdy > -0.1 ? clamp(1 - sdy / sdl * 1.6, 0, 1) * (wx === 'clear' ? 1 : 0.3) : 0;
  const c = _c4; for (let i = 0; i < pos.count; i++) { const px = pos.getX(i) / 900, py = pos.getY(i) / 900, pz = pos.getZ(i) / 900; const t = Math.pow(clamp(py, 0, 1), 0.55); c.copy(hor).lerp(top, t); if (py < 0) c.multiplyScalar(0.85);
    const g = Math.pow(Math.max(0, (px * sdx + py * sdy + pz * sdz) / sdl), 5) * lowSun * 0.45; col.setXYZ(i, c.r + g, c.g + g * 0.72, c.b + g * 0.4); }
  col.needsUpdate = true;
  G.tint.setRGB(L, L * (0.95 + 0.05 * L), Math.min(1, L * 1.15 + (1 - L) * 0.16));
  { const wm = (smoothstep(5.6, 6.6, h) * (1 - smoothstep(8.2, 9.8, h)) + smoothstep(16.8, 18.2, h) * (1 - smoothstep(19, 20, h))) * (wx === 'clear' ? 1 : 0.4); G.tint.r *= 1 + 0.09 * wm; G.tint.g *= 1 - 0.01 * wm; G.tint.b *= 1 - 0.16 * wm; } // golden hours
  for (const m of area.tintMats) { if (m.userData.base) m.color.copy(m.userData.base).multiply(G.tint); else m.color.copy(G.tint); }
  const night = L < 0.6;
  for (const w of [area.special.winA, area.special.lantern]) { w.map = night ? TEX.winNight : TEX.winDay; if (night) w.color.setRGB(1, 0.95, 0.85); else w.color.copy(G.tint); }
  area.special.winB.color.copy(G.tint).multiplyScalar(0.85);
  area.special.glowMat.opacity = clamp((0.75 - L) * 2, 0, 1);
  const fogMul = wx === 'rain' ? 0.55 : wx === 'overcast' ? 0.8 : 1;
  area.scene.fog.color.copy(hor); const cp = camera.position; const above = cp.y - (area.heightAt ? area.heightAt(cp.x, cp.z) : 0); // see further from high ground, through more haze
  const hi = Math.max(cp.y - 2, above), lift = 1 + clamp((hi - 4) / 22, 0, 2.6) + 3.2 * smoothstep(70, 260, hi); // and from the peaks, or on the wing, across the country
  const open = 1 + 0.55 * smoothstep(420, 1000, Math.max(Math.abs(cp.x), Math.abs(cp.z))); // out in the open country the air is clearer than over the smoky town
  area.scene.fog.near = lerp(18, 60, L) * fogMul * (1 + (lift - 1) * 0.18) * open; area.scene.fog.far = lerp(115, 260, L) * fogMul * lift * open;
  S.sky.position.copy(cp); S.stars.position.copy(cp); S.mountains.position.set(cp.x, 38, cp.z); S.mountains.visible = false; // real ground now reaches the horizon; the painted range would only fight it
  S.clouds.position.set(cp.x, Math.max(170, cp.y + 90), cp.z); // the cloud deck stays overhead, even on the peaks
  S.starMat.opacity = clamp((0.55 - L) * 2.6, 0, 1) * (wx === 'clear' ? 1 : 0.2);
  const a = (h - 6) / 12.5 * Math.PI; const sd = new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.9, 0.4).normalize();
  S.sun.position.copy(cp).addScaledVector(sd, 800); S.sun.visible = sd.y > -0.05 && wx === 'clear';
  const ma = (h - 18.5) / 12 * Math.PI; const md = new THREE.Vector3(Math.cos(ma) * 0.9, Math.sin(ma) * 0.8, -0.3).normalize();
  S.masser.position.copy(cp).addScaledVector(md, 800); S.masser.visible = md.y > 0 && L < 0.8;
  const md2 = new THREE.Vector3(Math.cos(ma + 0.5), Math.sin(ma + 0.5) * 0.9, -0.1).normalize();
  S.secunda.position.copy(cp).addScaledVector(md2, 800); S.secunda.visible = md2.y > 0 && L < 0.8;
  S.cloudMat.opacity = wx === 'clear' ? 0.55 : wx === 'overcast' ? 0.92 : 1; S.cloudMat.color.copy(G.tint).lerp(hor, 0.3);
  TEX.clouds.offset.x = (G.clock * 0.0025) % 1; TEX.clouds.offset.y = (G.clock * 0.0012) % 1;
  S.mountMat.color.copy(hor).lerp(_c3.setRGB(0.5, 0.55, 0.66).multiplyScalar(Math.max(L, 0.35)), 0.3);
  // rain
  const raining = wx === 'rain' && G.state === 'play';
  S.rain.visible = raining; SFX.rain(raining && G.area === area);
  if (raining) {
    S.rain.position.set(cp.x, cp.y - 6, cp.z); const rp = S.rp;
    for (let i = 0; i < 900; i++) { rp[i * 6 + 1] -= dt * 22; if (rp[i * 6 + 1] < 0) { rp[i * 6] = rnd.range(-30, 30); rp[i * 6 + 1] = 25; rp[i * 6 + 2] = rnd.range(-30, 30); } rp[i * 6 + 3] = rp[i * 6] + 0.05; rp[i * 6 + 4] = rp[i * 6 + 1] + 0.7; rp[i * 6 + 5] = rp[i * 6 + 2]; }
    S.rain.geometry.attributes.position.needsUpdate = true;
  }
  if (area.waterMat) { TEX.water.offset.x = (G.clock * 0.02) % 1; TEX.water.offset.y = (G.clock * 0.01) % 1; }
}
function updateWeather() {
  const d = dayOf(G.time); if (d === G.weatherDay) return; G.weatherDay = d;
  if (d === 0) { G.weather = 'clear'; return; }
  const r = new RNG(d * 31 + 7).next(); G.weather = r < 0.55 ? 'clear' : r < 0.85 ? 'overcast' : 'rain';
}

/* ---------------- city life ---------------- */
function populateCity(area) {
  for (const e of area.entities.slice()) e.remove();
  const rng = new RNG(555); const nodes = area.nodes;
  // busy quarters get more people
  const weights = nodes.map(n => n.n.length > 0 ? DK[n.kind].pop : 0); const total = weights.reduce((a, b) => a + b, 0);
  const pickNode = (w = weights, tot = total) => { let r = rng.next() * tot; for (let i = 0; i < nodes.length; i++) { r -= w[i]; if (r <= 0) return nodes[i]; } return nodes[nodes.length - 1]; };
  for (let i = 0; i < 64; i++) {
    const n = pickNode(); const g = rng.chance(0.5) ? 'f' : 'm'; const look = lookByWealth(rng, g, DK[n.kind].wealth);
    const e = spawnNPC(area, { name: personName(rng, g), look, gender: g, x: n.x + rng.range(-1, 1), z: n.z + rng.range(-1, 1), role: 'townsfolk', dialog: 'townsfolk', speed: rng.range(1.1, 1.6), spriteKey: 'tf' + i });
    e.data.nightOwl = rng.chance(n.kind === 'slum' || n.kind === 'harbor' ? 0.3 : 0.12);
  }
  // patrols favour the wealthy quarters
  const gw = nodes.map(n => n.n.length > 0 ? 0.4 + DK[n.kind].wealth : 0); const gt = gw.reduce((a, b) => a + b, 0);
  for (let i = 0; i < 12; i++) { const n = pickNode(gw, gt); spawnNPC(area, { name: 'City Guard', look: LOOKS.guard, spriteKey: 'guard', x: n.x, z: n.z, role: 'guard', dialog: 'guard', speed: 1.5, hp: 65 }); }
  for (const [x, z] of area.guardPosts) spawnNPC(area, { name: 'City Guard', look: LOOKS.guard, spriteKey: 'guard', x, z, role: 'guard', dialog: 'guard', hp: 65, data: { post: true, fixed: true } });
  area.stalls.forEach(([x, z], i) => { const g = i % 2 ? 'f' : 'm'; const look = randomLook(new RNG(90 + i), g); look.apron = '#c8c0a8'; spawnNPC(area, { name: personName(new RNG(80 + i), g), look, gender: g, x, z, role: 'static', dialog: 'vendor', spriteKey: 'vendor' + i, building: { id: 'stall' + i, type: 'vendor', name: i === 2 ? 'Fish market stall' : 'Market stall' }, data: { fixed: true, vendor: true } }); });
  area.stops.forEach((st, i) => { const r = new RNG(300 + i); const look = { ...randomLook(r, 'm'), hat: '#2a2a2a', cape: '#3a2a1a', robe: null }; spawnNPC(area, { name: personName(r, 'm'), look, gender: 'm', x: st.coachman[0], z: st.coachman[1], role: 'static', dialog: 'coach', spriteKey: 'coach' + i, data: { fixed: true, stop: st.id, coachman: true } }); });
  const M = area.memorial;
  const ghost = spawnNPC(area, { name: 'Ghost of King Lysandus', frames: enemySprite('lysandus').tex, x: M.x, z: M.z + 11, role: 'ghost', dialog: 'ghost', transparent: true, opacity: 0.6, fly: 0.25, speed: 1.0, hp: 9999 });
  ghost.wanderR = 12; ghost.data.fixedHome = true;
  area.spawnT = 20;
}
/* ---------------- carriages ---------------- */
// shortest road distance from one stop to every other one, with the quarters on the way
function carriageRoutes(from) {
  const nodes = G.city.nodes; const N = nodes.length; const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1);
  const heap = [[0, from.node]]; dist[from.node] = 0;
  const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  while (heap.length) {
    const [d, i] = pop(); if (d > dist[i]) continue; const n = nodes[i];
    n.n.forEach((j, k) => { const w = n.w[k]; const nd = d + Math.hypot(nodes[j].x - n.x, nodes[j].z - n.z) * (w < 4 ? 1.3 : 1); if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); } });
  }
  const out = [];
  for (const st of G.city.stops) {
    if (st === from || !isFinite(dist[st.node])) continue;
    const via = []; let c = st.node; const seen = new Set([districtAt(from.x, from.z).name, districtAt(st.x, st.z).name]);
    const path = []; while (c >= 0) { path.push(c); c = prev[c]; } path.reverse();
    for (const i of path) { const nm = districtAt(nodes[i].x, nodes[i].z).name; if (!seen.has(nm)) { seen.add(nm); via.push(nm); } }
    const d = dist[st.node]; out.push({ stop: st, dist: d, fare: Math.max(3, Math.round(3 + d / 25)), mins: Math.round(8 + d / 90), via });
  }
  return out.sort((a, b) => a.dist - b.dist);
}
function travelBy(from, r, fare) {
  const P = G.player; P.gold -= fare; SFX.play('coin');
  transition(() => {
    G.time += r.mins; const [x, z, yaw] = r.stop.arrive; setArea(G.city, x, z, yaw);
    for (const e of G.city.entities) if (e.data.temp || (e.kind === 'enemy' && e.data.night && !e.data.bountyId)) e.remove();
    msg(`The carriage rattles ${r.via.length ? 'through ' + r.via.join(', ') + ' ' : ''}and sets you down at ${r.stop.name}. (${r.mins} minutes, ${fare} gold)`);
    G.lastDistrict = districtAt(x, z).id;
  });
}
function spawnAwayNode(area, minD, maxD) {
  const P = G.player; const c = area.nodes.filter(n => { const d = Math.hypot(n.x - P.pos.x, n.z - P.pos.z); return d > minD && d < maxD; });
  return c.length ? rnd.pick(c) : null;
}
function nearbyHostiles(r) { const P = G.player; return G.area.entities.some(e => e.alive && e.active && enemyTargetHostile(e) && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < r); }
function cityTick(area, dt) {
  const night = isNight(G.time), h = hourOf(G.time), P = G.player;
  for (const e of area.entities.slice()) {
    const d = Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z);
    if (e.role === 'townsfolk' && e.kind === 'npc') { const want = !night || e.data.nightOwl || e.state === 'flee'; if (e.active && !want && d < 35) { /* wait until out of sight */ } else e.active = want; }
    if (e.data.vendor) e.active = h >= 8 && h < 18;
    if (e.data.coachman) e.active = h >= 5 && h < 23;
    if (e.role === 'ghost') {
      if (e.data.fading) { e.data.fading -= dt * 0.35; e.mat.opacity = 0.6 * Math.max(0, e.data.fading); if (e.data.fading <= 0) { e.remove(); continue; } }
      else e.active = night && Quests.mq() < 3;
    }
    if (e.data.temp && e.data.leave && d > 30) { e.remove(); continue; }
    if (e.data.night && !night && e.kind === 'enemy' && d > 30 && !e.data.bountyId) { e.remove(); continue; }
  }
  if (G.wanted) {
    if (G.time > G.wanted.until) clearWanted('The guards seem to have forgotten about you.');
    else {
      G.wanted.spawnT -= dt;
      if (G.wanted.spawnT <= 0) {
        G.wanted.spawnT = rnd.range(14, 22);
        if (area.entities.filter(e => e.role === 'guard' && !e.dead).length < 16) for (let k = 0; k < 2; k++) {
          const n = spawnAwayNode(area, 18, 45); if (!n) break;
          const g = spawnNPC(area, { name: 'City Guard', look: LOOKS.guard, spriteKey: 'guard', x: n.x + rnd.range(-1, 1), z: n.z + rnd.range(-1, 1), role: 'guard', dialog: 'guard', speed: 1.6, hp: 65 }); g.data.temp = true;
        }
      }
    }
  }
  area.spawnT -= dt;
  if (area.spawnT <= 0) {
    area.spawnT = rnd.range(25, 50);
    const kind = districtAt(P.pos.x, P.pos.z).kind; const rough = kind === 'slum' || kind === 'poor' || kind === 'harbor';
    area.spawnT = kind === 'slum' ? rnd.range(12, 24) : kind === 'noble' ? rnd.range(45, 80) : rough ? rnd.range(20, 38) : area.spawnT;
    if (night && !P.dead && area.entities.filter(e => e.kind === 'enemy' && !e.dead).length < (kind === 'slum' ? 6 : 4)) {
      const n = spawnAwayNode(area, 25, 60);
      if (n) { const r = rnd.next(); let t = r < 0.3 ? 'rat' : r < (rough ? 0.85 : 0.72) ? 'thief' : r < 0.9 ? 'bat' : 'wraith'; if (t === 'wraith' && (P.level < 2 || Quests.mq() >= 3)) t = 'thief'; const e = spawnEnemy(area, t, n.x + rnd.range(-2, 2), n.z + rnd.range(-2, 2)); e.data.night = true; e.wanderR = 8; }
    }
  }
  Quests.cityTick(area);
}

/* ---------------- areas & transitions ---------------- */
function setArea(area, x, z, yaw, yHint = null) {
  const P = G.player; G.area = area;
  if (area.kind === 'city') Wild.prime(x, z);
  P.pos.set(x, area.floorY ?? 0, z); P.yaw = yaw; P.pitch = 0; P.vy = 0; P.onGround = true;
  P.pos.y = groundAt(area, x, z, 0.38, Math.max(baseY(area, x, z), yHint ?? -1e9) + 0.5);
  camera.position.set(P.pos.x, P.pos.y + 1.62, P.pos.z); camera.rotation.set(0, yaw, 0);
  G.focus = null; pickMusic(true);
}
function transition(fn) {
  if (G.fading) return; G.fading = true; const f = $('fade'); f.classList.add('on'); SFX.play('door');
  setTimeout(() => { try { fn(); } finally { setTimeout(() => { f.classList.remove('on'); G.fading = false; }, 80); } }, 300);
}
function leaveCurrentArea() { if (G.area && G.area !== G.city) { disposeArea(G.area); } }
function tryEnter(b) {
  const P = G.player;
  if (b.type === 'mausoleum') {
    if (!hasItem('catakey')) { SFX.play('locked'); msg('The mausoleum gate is sealed with a heavy iron lock. Someone at Castle Daggerfall must hold the key.'); return; }
    SFX.play('unlock'); transition(() => { const a = buildDungeon(); setArea(a, a.spawn.x, a.spawn.z, a.spawn.yaw); msg('You descend into the Catacombs. The air is cold and smells of old bones.'); });
    return;
  }
  const st = G.bState[b.id] || (G.bState[b.id] = {});
  if (!isOpen(b) && !(LOCKABLE[b.type] && st.unlocked === dayOf(G.time))) {
    if (LOCKABLE[b.type]) {
      UI.open('lock', () => `<h2>${esc(b.name)}</h2><p>${b.type === 'warehouse' ? 'The warehouse is barred for the night.' : 'The door is locked. Everyone inside must be asleep.'}</p><div class="btns col"><button class="db" data-a="pick">Try to pick the lock</button><button class="db" data-a="close">Leave</button></div>`, {
        cls: 'small', onAct: (a) => {
          if (a !== 'pick') return;
          G.time += 10; const chance = clamp(0.2 + (P.attr.AGI - 50) / 100 + (P.attr.LUC - 50) / 200 + (P.cls === 'Thief' ? 0.35 : 0) - ((b.wealth ?? 1.5) >= 3 ? 0.15 : 0), 0.05, 0.95);
          if (rnd.next() < chance) { st.unlocked = dayOf(G.time); SFX.play('unlock'); UI.close(true); msg('The lock clicks open.', 'good'); enterBuilding(b); }
          else { SFX.play('locked'); msg('You fail to pick the lock.'); if (rnd.chance((b.wealth ?? 1.5) >= 3 ? 0.25 : (b.wealth ?? 1.5) <= 0 ? 0.04 : 0.12)) { UI.close(true); msg('Someone saw you tampering with the lock!', 'bad'); commitCrime('trespassing'); } }
        },
      });
      return;
    }
    SFX.play('locked'); const [a, z] = OPEN_HOURS[b.type]; msg(`${b.name} is closed. Open from ${a}:00 to ${z}:00.`); return;
  }
  enterBuilding(b);
}
function enterBuilding(b) {
  transition(() => {
    leaveCurrentArea(); markDiscovered(b);
    const a = buildInterior(b); setArea(a, a.spawn.x, a.spawn.z, a.spawn.yaw);
    msg(`You enter ${b.name}.`);
    if (b.type === 'castle' && G.wanted) setTimeout(() => UI.openArrest(), 350);
  });
}
function exitInterior() {
  const b = G.area.building;
  transition(() => { leaveCurrentArea(); setArea(G.city, b.door.x + b.door.nx * 1.3, b.door.z + b.door.nz * 1.3, Math.atan2(-b.door.nx, -b.door.nz), b.door.y); });
}
function leaveDungeon() {
  const b = G.buildings.find(x => x.id === 'mausoleum');
  transition(() => { leaveCurrentArea(); setArea(G.city, b.door.x + b.door.nx * 1.3, b.door.z + b.door.nz * 1.3, Math.atan2(-b.door.nx, -b.door.nz), b.door.y); msg('You climb back into the graveyard.'); });
}
function reviveAtTemple() {
  const P = G.player; P.dead = false; P.hp = P.maxHp; P.fat = P.maxFat; P.gold = Math.floor(P.gold / 2); G.time += 8 * 60; camera.rotation.z = 0;
  leaveCurrentArea(); const t = G.buildings.find(b => b.id === 'temple'); const a = buildInterior(t); setArea(a, 0, -2, Math.PI);
  msg('You wake on a cold altar. The priests of Arkay dragged you back from the brink — and took half your purse for the trouble.');
}
let _musicT = 0;
function pickMusic(force) {
  if (!force && (_musicT -= 1) > 0) return; _musicT = 60;
  if (G.state === 'title' || G.state === 'create') return Music.play('title');
  const a = G.area; if (!a) return;
  if (a.kind === 'dungeon') return Music.play('dungeon');
  if (a.kind === 'interior') return Music.play(a.music || 'day');
  Music.play(isNight(G.time) ? 'night' : 'day');
}

/* ---------------- resting ---------------- */
function startRest(mode) {
  G.resting = { mode, mins: 0, acc: 0 }; exitLock(); $('restinfo').hidden = false;
}
function stopRest(text) { G.resting = null; $('restinfo').hidden = true; if (text) msg(text); if (G.state === 'play' && !G.uiOpen) requestLock(false); }
function updateRest(dt) {
  const R = G.resting, P = G.player; R.acc += dt;
  while (R.acc > 0.07 && G.resting) {
    R.acc -= 0.07; G.time += 15; R.mins += 15;
    P.hp = Math.min(P.maxHp, P.hp + P.maxHp * 0.035 * (1 + P.attr.END / 150)); P.mp = Math.min(P.maxMp, P.mp + P.maxMp * 0.05); P.fat = Math.min(P.maxFat, P.fat + P.maxFat * 0.12);
    if (R.mins % 60 === 0 && G.area.kind !== 'interior' && rnd.chance(G.area.kind === 'dungeon' ? 0.15 : isNight(G.time) ? 0.1 : 0.02)) { ambush(); stopRest('You are awakened by a noise!'); return; }
    const h = hourOf(G.time); let done = false;
    if (R.mode === 'heal') done = P.hp >= P.maxHp && P.mp >= P.maxMp;
    else if (R.mode === 'hour') done = R.mins >= 60;
    else if (R.mode === 'dawn') done = h >= 6 && h < 6.25;
    else if (R.mode === 'dusk') done = h >= 20 && h < 20.25;
    else if (R.mode === 'room') { done = R.mins >= 480; if (done) { P.hp = P.maxHp; P.mp = P.maxMp; P.fat = P.maxFat; } }
    if (R.mins >= 24 * 60) done = true;
    if (done) { stopRest(R.mode === 'room' ? 'You wake refreshed in a lumpy but honest bed.' : `You rest until ${clockString(G.time)}.`); return; }
  }
  $('restinfo').textContent = `${R.mode === 'dawn' || R.mode === 'dusk' ? 'Waiting' : 'Resting'}…  ${clockString(G.time)}  (${Input.touch ? 'tap' : 'Esc'} to stop)`;
}
function ambush() {
  const P = G.player; const a = rnd.next() * Math.PI * 2; const x = P.pos.x + Math.cos(a) * 5, z = P.pos.z + Math.sin(a) * 5;
  const t = G.area.kind === 'dungeon' ? rnd.pick(['skeleton', 'rat', 'zombie']) : rnd.pick(['thief', 'thief', 'rat']);
  const e = spawnEnemy(G.area, t, x, z); e.pos.set(x, 0, z); collide(G.area, e.pos, e.radius, 0); e.aggro = true; e.state = 'chase'; e.data.night = true;
}

/* ---------------- saving ---------------- */
function serialize() {
  const P = G.player;
  return {
    v: 3, time: G.time, flags: G.flags, quests: G.quests, wanted: G.wanted, bState: G.bState, weather: G.weather, weatherDay: G.weatherDay,
    player: { ...P, pos: [P.pos.x, P.pos.y, P.pos.z], equipIds: Object.fromEntries(Object.entries(P.equip).map(([k, v]) => [k, v ? v.id : null])), equip: undefined, swingT: -1, castT: -1 },
    area: G.area.kind === 'interior' ? { kind: 'interior', id: G.area.building.id } : { kind: G.area.kind },
  };
}
function readSave() { try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; } }
function saveGame() {
  if (!G.player || G.player.dead) { msg('You cannot save now.'); return false; }
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize())); return true; } catch (e) { msg('Saving is unavailable in this browser.', 'bad'); return false; }
}
function loadGame(data) {
  data = data || readSave(); if (!data || !data.player) { msg('No saved game found.'); return; }
  if (UI.cur) UI.close(true); if (G.mapOpen) MapView.close(); if (G.resting) stopRest();
  leaveCurrentArea(); G.area = G.city;
  G.time = data.time; G.flags = data.flags || {}; G.quests = data.quests || []; G.wanted = data.wanted; G.bState = data.bState || {}; G.weather = data.weather || 'clear'; G.weatherDay = data.weatherDay ?? -1;
  const sp = data.player; const P = { ...sp, pos: new THREE.Vector3(...sp.pos), vy: 0, onGround: true, swingT: -1, castT: -1, dead: false, hurtT: 0, equip: { weapon: null, body: null, head: null, shield: null } };
  for (const [k, id] of Object.entries(sp.equipIds || {})) P.equip[k] = id ? P.inv.find(i => i.id === id) || null : null;
  delete P.equipIds; G.player = P; camera.rotation.z = 0; G.flying = false;
  populateCity(G.city);
  G.state = 'play'; $('title').hidden = true;
  let area = G.city;
  if (data.area.kind === 'interior') { const b = G.buildings.find(x => x.id === data.area.id); if (b) area = buildInterior(b); }
  else if (data.area.kind === 'dungeon') area = buildDungeon();
  if ((data.v || 1) < 3) { // the city was rebuilt since this save: start again at the Grand Market
    area = G.city; const s = G.city.stops.find(q => q.id === 'market'); P.pos.set(s.arrive[0], 0, s.arrive[1]); P.yaw = s.arrive[2];
    for (const q of G.quests) if (q.type === 'deliver' && q.status === 'active') q.status = 'failed';
    setTimeout(() => msg('Daggerfall has grown since this journey was recorded. You find yourself at the Grand Market.'), 400);
  }
  setArea(area, P.pos.x, P.pos.z, P.yaw); if ((data.v || 1) >= 3) P.pos.y = Math.max(P.pos.y, sp.pos[1]);
  G.lastDistrict = G.area.kind === 'city' ? districtAt(P.pos.x, P.pos.z).id : null;
  msg('Game loaded.', 'good'); requestLock(false);
}

/* ---------------- game flow ---------------- */
const INTRO = `<p>The year is 3E 405. In the Imperial City, Emperor Uriel Septim VII summons you and speaks of a matter too delicate for his legions.</p>
<p>In the High Rock kingdom of Daggerfall, the ghost of the late King Lysandus has risen. Each night it stalks the streets of his capital, crying out for vengeance. And a letter the Emperor sent to the court of Daggerfall has vanished before anyone could read it.</p>
<p>A storm wrecked your ship in the Iliac Bay. Fishermen pulled you from the surf of a village up the coast, and three days on foot have brought you, with your wits, your sheathed sword and a light purse, to the crag travellers call Pilgrim's Rise. The morning mist is lifting. Below you lies Daggerfall.</p>
<p>Find out what binds the dead king to this world. Recover the letter. And whatever you do, <em>do not anger the city guard</em>.</p>`;
function beginNewGame(cfg) {
  SFX.init();
  G.time = 7 * 60 + 40; G.flags = { mq: 0, dungeonSeed: 1337 }; G.quests = []; G.wanted = null; G.bState = {}; G.weatherDay = -1; G.flying = false;
  leaveCurrentArea(); G.area = G.city; populateCity(G.city);
  G.player = newPlayer(cfg); markDiscovered(G.buildings.find(b => b.id === 'castle'));
  G.state = 'play'; $('title').hidden = true; $('msgs').innerHTML = '';
  const S = G.city.start; setArea(G.city, S.x, S.z, S.yaw); G.player.pitch = S.pitch || 0; if (S.y != null) G.player.pos.y = S.y; G.player.sheathed = true; G.lastDistrict = 'outside';
  // the story introduction (INTRO) is set aside while the project concentrates on the world itself; the hints wait so the first look is clear
  setTimeout(() => { if (G.state !== 'play') return;
    if (Input.touch) {
      msg('Welcome to Daggerfall. Walk with your left thumb, look by dragging on the right. The buttons at the top open the map and your journal.');
      msg('Carriages wait at signposts marked with a wheel. Tap Use at one, or Travel near one, to ride across the city.');
    } else {
      msg(`Welcome to Daggerfall. J opens your journal, M the map${rpgUI() ? ', I your character' : ''}. Click the view to capture the mouse.`);
      msg('Carriages wait at signposts marked with a wheel. Press E at one, or T near one, to ride across the city.');
    }
  }, 6000);
}
function toTitle() {
  if (G.resting) stopRest(); if (G.mapOpen) MapView.close(); if (UI.cur) UI.close(true);
  exitLock(); leaveCurrentArea(); G.area = G.city; G.state = 'title'; G.time = 18 * 60 + 5;
  $('title').hidden = false; $('msgs').innerHTML = ''; $('hint').textContent = ''; $('status').textContent = '';
  const cont = $('title').querySelector('[data-t="continue"]'); if (cont) cont.disabled = !readSave();
  pickMusic(true);
}
let _titleA = 0.6;
function titleCam(dt) {
  _titleA += dt * 0.03; const r = 215; const x = Math.sin(_titleA) * r, z = Math.cos(_titleA) * r - 10;
  camera.position.set(x, Math.max(78, terrainH(x, z) + 30), z); camera.lookAt(0, 14, -20);
}

/* ---------------- HUD text ---------------- */
let _statusT = 0;
function updateTextHUD(dt) {
  _statusT -= dt; if (_statusT > 0) return; _statusT = 0.2;
  const P = G.player; const f = G.focus; let hint = '';
  if (G.state === 'play' && P && !P.dead && !G.uiOpen) {
    const E = Input.touch ? '' : 'E — ';
    if (f) {
      if (f.type === 'npc') hint = `${E}Talk to ${f.obj.name}`;
      else if (f.type === 'loot') hint = `${E}Search: ${f.obj.name}`;
      else if (f.type === 'door') { const b = f.obj.building; hint = b.type === 'mausoleum' ? `${E}Enter the Catacombs` : `${E}Enter ${b.name}${b.type !== 'house' ? ' (' + TYPE_LABEL[b.type] + ')' : ''}${isOpen(b) ? '' : ' · closed'}`; }
      else if (f.type === 'exit') hint = `${E}Leave ${G.area.name}`;
      else if (f.type === 'dungeonExit') hint = `${E}Climb back to the surface`;
      else if (f.type === 'stop') hint = `${E}Carriage stop: ${capFirst(f.obj.name)}`;
    } else { const b = lookedAtBuildingName(); if (b) hint = b.type === 'house' ? b.name : `${b.name} · ${TYPE_LABEL[b.type]}`; }
  }
  $('hint').textContent = hint; $('hint').classList.toggle('dim', !f);
  let where = G.area.name;
  if (G.state === 'play' && P && G.area.kind === 'city') {
    const d = districtAt(P.pos.x, P.pos.z); const inside = insideCity(P.pos.x, P.pos.z, -2);
    const T = TOWNS.find(t => t.inside(P.pos.x, P.pos.z, -1)), td = T && T.districtAt(P.pos.x, P.pos.z);
    const id = inside ? d.id : T ? T.id + ':' + td.id : 'outside'; where = inside ? `Daggerfall · ${capFirst(d.name)}` : T ? `${T.name} · ${capFirst(td.name)}` : Math.hypot(P.pos.x, P.pos.z) < 1200 ? 'Outside the walls of Daggerfall' : 'The open country';
    if (G.lastDistrict && G.lastDistrict !== id && !P.dead) msg(inside ? `You enter ${d.name} — ${d.blurb}.` : T ? `You enter ${td.name} of ${T.name} — ${td.blurb}.` : (G.lastDistrict.includes(':') ? `You leave the walls of ${capFirst(G.lastDistrict.split(':')[0])} behind.` : G.lastDistrict === 'outside' ? '' : 'You leave the city walls behind.'), 'district');
    G.lastDistrict = id;
  }
  $('status').textContent = G.state === 'play' && P ? `${where} · ${dateString(G.time)} · ${clockString(G.time)}${G.weather !== 'clear' && G.area.kind === 'city' ? ' · ' + G.weather : ''}${G.flying || settings.dbgStamina ? ' · debug: ' + [G.flying && 'flying', G.flying && settings.dbgNoClip && 'no clip', settings.dbgStamina && 'stamina'].filter(Boolean).join(', ') : ''}` : '';
  $('resume').hidden = !(G.state === 'play' && !G.uiOpen && !G.mapOpen && !Input.locked && !Input.fallback && !Input.touch && !G.resting && !G.fading && P && !P.dead);
  const low = P && G.state === 'play' ? clamp(1 - P.hp / P.maxHp * 3, 0, 1) : 0; $('vignette').style.opacity = low * 0.8;
}

/* ---------------- loop ---------------- */
let _last = performance.now(); G.clock = 0;
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - _last) / 1000); _last = now; G.clock += dt;
  if (G.state === 'title' || G.state === 'create') { titleCam(dt); G.time += dt * 0.5; G.paused = true; updateWorld(dt); updateEntities(dt); }
  else if (G.state === 'play' && G.player) {
    const frozen = G.uiOpen || G.fading || (!Input.locked && !Input.fallback && !Input.touch);
    G.paused = frozen || !!G.resting;
    let sdt = dt; // the world's own time step: faster while travelling
    if (G.resting) updateRest(dt);
    else if (!frozen) {
      if (Travel.cur) sdt = Travel.update(dt); else updatePlayer(dt);
      G.time += sdt * TIME_SCALE; updateWeather();
      if (G.area.kind === 'city') { cityTick(G.area, sdt); Sites.update(G.player.pos.x, G.player.pos.z); POI.update(G.player.pos.x, G.player.pos.z); Roads.update(sdt); for (const T of TOWNS) T.updateFolk(G.player.pos.x, G.player.pos.z, sdt); }
      updateProjectiles(dt); Quests.tick(); G.focus = computeFocus();
      if (G.area.kind === 'dungeon') { const D = G.area.dg; const ci = Math.floor(G.player.pos.x / D.cs), cj = Math.floor(G.player.pos.z / D.cs); for (let j = cj - 2; j <= cj + 2; j++) for (let i = ci - 2; i <= ci + 2; i++) if (i >= 0 && j >= 0 && i < D.N && j < D.N) D.visited[i + j * D.N] = 1; }
    } else if (G.player.dead) updatePlayer(dt);
    updateEntities(sdt); updateFX(dt); pickMusic(false);
    G.dmgFlash = Math.max(0, G.dmgFlash - dt); G.shake = Math.max(0, G.shake - dt);
    $('dmg').style.opacity = G.dmgFlash * 1.6;
    if (G.mapOpen && Math.floor(G.clock * 8) !== Math.floor((G.clock - dt) * 8)) MapView.draw();
    updateWorld(dt);
  }
  updateTextHUD(dt); Touch.update();
  if (G.area) {
    try { renderer.render(G.area.scene, camera); }
    catch (e) { // a hole in the scene graph: drop it, say where it was, and draw again next frame
      const fix = o => { const n = o.children.length; o.children = o.children.filter(Boolean); if (o.children.length !== n) console.warn('scene: dropped', n - o.children.length, 'empty child slot(s) under', o.type, o.name || ''); o.children.forEach(fix); };
      fix(G.area.scene); console.warn('render failed once', e && e.message, (e && e.stack || '').split('\n').slice(0, 6).join(' | '), 'children', G.area.scene.children.length, G.area.scene.children.map(o => o.type[0]).join(''));
    }
  }
  drawHUD();
}
function updateWorld(dt) {
  const area = G.area; if (!area) return;
  for (const f of area.anim) f(dt, G.clock);
  const yaw = camera.rotation.y; for (const b of area.batches) b.update(yaw);
  for (const m of area.bbs || []) m.rotation.y = Math.atan2(camera.position.x - m.position.x, camera.position.z - m.position.z);
  if (area.kind === 'city') { updateSky(area, dt); Wild.update(camera.position, camera.rotation.y); } else { G.tint.setRGB(1, 1, 1); SFX.rain(false); }
}

/* ---------------- setup ---------------- */
function resize() {
  const auto = innerWidth >= 1500 ? 3 : innerWidth >= 700 ? 2 : 2;
  const ps = settings.pixelScale || auto;
  const w = Math.max(160, Math.ceil(innerWidth / ps)), h = Math.max(100, Math.ceil(innerHeight / ps));
  renderer.setSize(w, h, false); hudCanvas.width = w; hudCanvas.height = h; hudCtx.imageSmoothingEnabled = false;
  camera.aspect = w / h; camera.fov = settings.fov; camera.updateProjectionMatrix();
  document.documentElement.style.setProperty('--hudb', Math.ceil(19 * Math.max(1, Math.round(h / 190)) * innerHeight / h) + 'px'); // compass height, so touch buttons clear it
}
function onKey(e) {
  const c = e.code;
  if (['F5', 'F9', 'Tab'].includes(c) || (c === 'Space' && G.state === 'play')) e.preventDefault();
  if (G.state !== 'play' || !G.player) return;
  if (G.mapOpen) { if (c === 'KeyM' || c === 'Escape') MapView.close(); return; }
  if (UI.cur) {
    if (c === 'Escape') { if (UI.cur.closable) UI.close(); return; }
    if ((c === 'KeyI' || c === 'KeyC' || c === 'Tab') && UI.is('char')) UI.close();
    else if ((c === 'KeyJ' || c === 'KeyL') && UI.is('journal')) UI.close();
    return;
  }
  if (G.resting) { if (c === 'Escape' || c === 'KeyR') stopRest('You stop resting.'); return; }
  if (Travel.cur && !['F5', 'F9', 'KeyN'].includes(c)) { Travel.stop('You stop.'); if (['Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'Space', 'KeyT', 'KeyV'].includes(c)) return; }
  if (G.player.dead || G.fading) return;
  switch (c) {
    case 'Escape': UI.openPause(); break;
    case 'KeyE': case 'KeyF': interact(); break;
    case 'KeyI': case 'KeyC': case 'Tab': if (rpgUI()) UI.openCharacter(); break;
    case 'KeyJ': case 'KeyL': UI.openJournal(); break;
    case 'KeyM': MapView.open(); break;
    case 'KeyR': UI.openRest(); break;
    case 'KeyT': case 'KeyV': UI.openTravel(); break;
    case 'KeyQ': startCast(); break;
    case 'KeyH': if (rpgUI()) quickPotion(); break;
    case 'Digit1': case 'Digit2': case 'Digit3': case 'Digit4': {
      const i = +c.slice(5) - 1; const P = G.player; if (rpgUI() && P.spells[i]) { P.spell = i; msg(`Spell selected: ${SPELLS[P.spells[i]].name}.`); } break;
    }
    case 'F5': if (saveGame()) msg('Quicksaved.', 'good'); break;
    case 'F9': loadGame(); break;
    case 'KeyG': if (settings.dbgFly) setFlying(!G.flying); else msg('Flying is a debug option. Turn it on under Settings → Debug.'); break;
    case 'KeyZ': toggleSheathe(); break;
    case 'KeyN': settings.music = settings.music > 0 ? 0 : 0.5; saveSettings(); SFX.applyVolumes(); msg(settings.music ? 'Music on.' : 'Music off.'); break;
  }
}
function bindInput() {
  addEventListener('keydown', e => {
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) { if (e.code === 'Escape' && UI.cur && UI.cur.closable) UI.close(); return; }
    Input.keys[e.code] = true; onKey(e);
  });
  addEventListener('keyup', e => { Input.keys[e.code] = false; });
  addEventListener('blur', () => { Input.keys = Object.create(null); });
  document.addEventListener('mousemove', e => {
    if (Input.locked) { Input.mdx += e.movementX; Input.mdy += e.movementY; }
    else if (Input.drag) { const dx = e.clientX - Input.drag.x, dy = e.clientY - Input.drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) Input.drag.moved = true; if (Input.drag.moved) { Input.mdx += dx * 1.4; Input.mdy += dy * 1.4; } Input.drag.x = e.clientX; Input.drag.y = e.clientY; }
  });
  renderer.domElement.addEventListener('mousedown', e => {
    SFX.init();
    if (G.state !== 'play' || G.uiOpen || G.resting || !G.player || G.player.dead) return;
    if (!Input.locked && !Input.fallback) { requestLock(true); return; }
    if (Input.fallback) { Input.drag = { x: e.clientX, y: e.clientY, moved: false, button: e.button }; return; }
    if (e.button === 0) startAttack(); else if (e.button === 2) startCast();
  });
  addEventListener('mouseup', e => {
    if (!Input.drag) return;
    if (!Input.drag.moved && G.state === 'play' && !G.uiOpen) { if (Input.drag.button === 0) startAttack(); else if (Input.drag.button === 2) startCast(); }
    Input.drag = null;
  });
  addEventListener('contextmenu', e => { if (G.state === 'play') e.preventDefault(); });
  document.addEventListener('pointerlockchange', () => {
    Input.locked = document.pointerLockElement === renderer.domElement;
    if (!Input.locked) { if (Input.expectUnlock) Input.expectUnlock = false; else if (G.state === 'play' && !G.uiOpen && !G.resting && G.player && !G.player.dead) UI.openPause(); }
    else { Input.expectUnlock = false; Input.everLocked = true; }
  });
  document.addEventListener('pointerlockerror', () => onLockError());
  $('resume').addEventListener('click', () => { SFX.init(); requestLock(true); });
  $('panel').addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b || !UI.cur || b.disabled) return; SFX.init(); SFX.play('click');
    const a = b.dataset.a; if (a === 'close') { UI.close(); return; } UI.cur.onAct && UI.cur.onAct(a, b.dataset);
  });
  $('panel').addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.s; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' ? +e.target.value : +e.target.value;
    settings[k] = v; saveSettings(); SFX.applyVolumes(); resize(); Touch.apply();
  });
  $('title').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.disabled) return; SFX.init(); SFX.play('click'); pickMusic(true);
    const t = b.dataset.t;
    if (t === 'new') { if (rpgUI()) Create.open(); else beginNewGame(Create.quick()); } // character creation returns with the stats option
    if (t === 'continue') loadGame();
    if (t === 'controls') { $('title').hidden = true; UI.openControls(() => { UI.close(true); $('title').hidden = false; }); }
    if (t === 'settings') { $('title').hidden = true; UI.openSettings(() => { UI.close(true); $('title').hidden = false; }); }
  });
  $('mapview').addEventListener('wheel', e => { MapView.setZoom(MapView.zoom * (e.deltaY < 0 ? 1.25 : 0.8)); e.preventDefault(); }, { passive: false });
  // the map: drag to look around it, tap or click a place to travel there
  { let drag = null; const mc = $('mapc');
    mc.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, moved: false, id: e.pointerId }; try { mc.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } });
    mc.addEventListener('pointermove', e => { if (!drag || drag.id !== e.pointerId) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (!drag.moved && Math.hypot(dx, dy) < 8) return; drag.moved = true;
      const t = MapView.tf; if (!t) return; MapView.view = [t.cx - dx * t.dpr / t.scale, t.cz - dy * t.dpr / t.scale]; drag.x = e.clientX; drag.y = e.clientY; MapView.draw(); });
    mc.addEventListener('pointerup', e => { if (drag && !drag.moved && G.area === G.city) MapView.pick(e.clientX, e.clientY); drag = null; });
    mc.addEventListener('pointercancel', () => { drag = null; });
    $('mapdest').addEventListener('click', e => { const b = e.target.closest('[data-m]'); if (b) { SFX.play('click'); MapView.go(b.dataset.m); } }); }
  $('mapclose').addEventListener('click', () => MapView.close());
  $('backdrop').addEventListener('click', () => { if (performance.now() - UI.openedAt > 350) UI.leave(); });
  for (const [id, k] of [['mapzin', 1.25], ['mapzout', 0.8]]) $(id).addEventListener('click', () => MapView.setZoom(MapView.zoom * k));
  $('restinfo').addEventListener('click', () => { if (G.resting) stopRest('You stop resting.'); });
  $('travelinfo').addEventListener('click', () => { if (Travel.cur) Travel.stop('You stop.'); });
  addEventListener('resize', () => { resize(); if (G.mapOpen) MapView.draw(); });
}
function boot(hotData) {
  loadSettings();
  try {
    renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: false, powerPreference: 'high-performance' });
  } catch (e) { $('loading').textContent = 'This game needs WebGL, which is not available in this browser.'; return; }
  renderer.setPixelRatio(1); renderer.setClearColor(0x000000);
  camera = new THREE.PerspectiveCamera(settings.fov, 16 / 9, 0.12, 24000); camera.rotation.order = 'YXZ'; // far enough for the mountains at the edge of the country
  hudCanvas = $('hud'); hudCtx = hudCanvas.getContext('2d');
  resize(); bindInput(); Touch.init();
  // textured UI chrome from the same generator as the walls
  try { document.documentElement.style.setProperty('--stone-img', `url(${genBlocks({ seed: 5, bw: 16, bh: 8, base: '#3b352d', mortar: '#211d18', vary: 0.12 }).toDataURL()})`); } catch (e) { /* cosmetic */ }
  initTextures();
  G.area = buildCity(); populateCity(G.city);
  $('loading').hidden = true;
  try { window.claude?.hot?.snapshot?.(() => (G.state === 'play' && G.player && !G.player.dead) ? serialize() : null); } catch (e) { /* not in a live host */ }
  if (hotData && hotData.v && hotData.player) { loadGame(hotData); }
  else toTitle();
  requestAnimationFrame(frame);
  window.__game = { TOWNS, Wild, LAND, SITES, Sites, siteWeight, coastZ, Travel, POI, Roads, terrainRaw, terrainBase, riverNear, routeWild, wildCult, G, UI, Quests, SFX, Input, MapView, loadGame, saveGame, beginNewGame, setArea, tryEnter, enterBuilding, spawnEnemy, interact, startAttack, startCast, carriageRoutes, travelBy, Touch, districtAt, setFlying, settings, terrainH, groundAt, collide, keepAshore, insideCity, toggleSheathe, THREE, camera: () => camera, renderer: () => renderer };
}
const _start = (data) => boot(data);
const _hot = (() => { try { return window.claude && window.claude.hot; } catch (e) { return null; } })();
if (_hot && _hot.ready) _hot.ready(_start); else _start((_hot && _hot.data) || {});
