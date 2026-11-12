/* =====================================================================
   The Catacombs beneath Saint Hallam’s churchyard — a grid dungeon
   ===================================================================== */

const DG_MATS = { dwall: { tex: 'dungeonWall' }, dfloor: { tex: 'dungeonFloor' }, dceil: { tex: 'flag' }, door: { tex: 'doorDark' }, woodDark: { tex: 'woodDark' }, stone: { tex: 'stone' }, iron: { tex: 'iron' } };

function buildDungeon() {
  const area = newArea('dungeon'); area.name = 'The Catacombs'; area.floorY = 0; area.bbs = []; area.music = 'dungeon';
  const rng = new RNG(G.flags.dungeonSeed || 1337);
  const N = 29, cs = 4, H = 4.2; area.ceilY = H;
  const grid = new Uint8Array(N * N).fill(1); const at = (x, y) => (x < 0 || y < 0 || x >= N || y >= N) ? 1 : grid[x + y * N];
  const rooms = [];
  for (let a = 0; a < 300 && rooms.length < 12; a++) {
    const w = rng.int(3, 6), h = rng.int(3, 6), x = rng.int(1, N - w - 1), y = rng.int(1, N - h - 1);
    if (rooms.some(r => x < r.x + r.w + 1 && x + w + 1 > r.x && y < r.y + r.h + 1 && y + h + 1 > r.y)) continue;
    rooms.push({ x, y, w, h, cx: x + Math.floor(w / 2), cy: y + Math.floor(h / 2) });
  }
  for (const r of rooms) for (let j = r.y; j < r.y + r.h; j++) for (let i = r.x; i < r.x + r.w; i++) grid[i + j * N] = 0;
  const carve = (a, b) => {
    const hFirst = rng.chance(0.5);
    const hx = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) grid[x + y * N] = 0; };
    const vy = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) grid[x + y * N] = 0; };
    if (hFirst) { hx(a.cx, b.cx, a.cy); vy(a.cy, b.cy, b.cx); } else { vy(a.cy, b.cy, a.cx); hx(a.cx, b.cx, b.cy); }
  };
  rooms.sort((a, b) => (b.y + b.h) - (a.y + a.h));
  const entrance = rooms[0];
  const connected = [entrance], rest = rooms.slice(1);
  while (rest.length) {
    let best = null, bd = 1e9, bi = -1;
    rest.forEach((r, i) => connected.forEach(c => { const d = Math.abs(r.cx - c.cx) + Math.abs(r.cy - c.cy); if (d < bd) { bd = d; best = [c, r]; bi = i; } }));
    carve(best[0], best[1]); connected.push(best[1]); rest.splice(bi, 1);
  }
  for (let k = 0; k < 2; k++) { const a = rng.pick(rooms.slice(1)), b = rng.pick(rooms.slice(1)); if (a !== b) carve(a, b); }
  // pillars in big rooms
  for (const r of rooms) if (r.w >= 5 && r.h >= 5 && r !== entrance) for (const [px, py] of [[r.x + 1, r.y + 1], [r.x + r.w - 2, r.y + 1], [r.x + 1, r.y + r.h - 2], [r.x + r.w - 2, r.y + r.h - 2]]) {
    if (px === r.cx || py === r.cy) continue; grid[px + py * N] = 1;
  }
  // farthest room from the entrance is the necromancer's sanctum
  const dist = new Int32Array(N * N).fill(-1); const q = [entrance.cx + entrance.cy * N]; dist[q[0]] = 0;
  for (let qi = 0; qi < q.length; qi++) { const c = q[qi]; const cx = c % N, cy = (c / N) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = cx + dx + (cy + dy) * N; if (!at(cx + dx, cy + dy) && dist[k] < 0) { dist[k] = dist[c] + 1; q.push(k); } } }
  let boss = rooms[1], bd = -1; for (const r of rooms.slice(1)) { const d = dist[r.cx + r.cy * N]; if (d > bd) { bd = d; boss = r; } }
  area.dg = { grid, N, cs, rooms, entrance, boss, visited: new Uint8Array(N * N) };

  // lights: torches on room walls
  const L = { lights: [], amb: [0.25, 0.24, 0.25] }; const torches = [];
  for (const r of rooms) {
    const cands = [];
    for (let i = r.x; i < r.x + r.w; i++) { if (at(i, r.y - 1)) cands.push([i, r.y, 0, -1]); if (at(i, r.y + r.h)) cands.push([i, r.y + r.h - 1, 0, 1]); }
    for (let j = r.y; j < r.y + r.h; j++) { if (at(r.x - 1, j)) cands.push([r.x, j, -1, 0]); if (at(r.x + r.w, j)) cands.push([r.x + r.w - 1, j, 1, 0]); }
    rng.shuffle(cands); const n = r === boss ? 4 : r.w * r.h > 16 ? 2 : 1;
    for (const [i, j, dx, dy] of cands.slice(0, n)) {
      const x = (i + 0.5) * cs + dx * (cs / 2 - 0.12), z = (j + 0.5) * cs + dy * (cs / 2 - 0.12);
      torches.push([x, 1.9, z]); L.lights.push({ p: [x - dx * 0.6, 2.6, z - dy * 0.6], r: 11, i: 1.25, c: r === boss ? [0.7, 1.0, 0.6] : WARM });
    }
  }
  const gb = new GB({ sub: 2, light: makeLightFn(L) });
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (at(i, j)) continue;
    const x0 = i * cs, z0 = j * cs, x1 = x0 + cs, z1 = z0 + cs;
    gb.quad('dfloor', [x0, 0, z1], [1, 0, 0], [0, 0, -1], cs, cs, 2, 2);
    gb.quad('dceil', [x0, H, z0], [1, 0, 0], [0, 0, 1], cs, cs, 2, 2);
    if (at(i, j - 1)) gb.quad('dwall', [x0, 0, z0], [1, 0, 0], [0, 1, 0], cs, H, 2.8, 2.8);
    if (at(i, j + 1)) gb.quad('dwall', [x1, 0, z1], [-1, 0, 0], [0, 1, 0], cs, H, 2.8, 2.8);
    if (at(i - 1, j)) gb.quad('dwall', [x0, 0, z1], [0, 0, -1], [0, 1, 0], cs, H, 2.8, 2.8);
    if (at(i + 1, j)) gb.quad('dwall', [x1, 0, z0], [0, 0, 1], [0, 1, 0], cs, H, 2.8, 2.8);
  }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!at(i, j)) continue; let near = false;
    for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++) if (!at(i + dx, j + dy)) { near = true; break; }
    if (near) addCol(area, i * cs, j * cs, (i + 1) * cs, (j + 1) * cs);
  }
  // exit door on the entrance room's south wall
  const ex = (entrance.cx + 0.5) * cs, ez = (entrance.y + entrance.h) * cs;
  gb.box(ex - 1.2, 0, ez - 0.15, ex + 1.2, 3.1, ez, 'woodDark', 1, 1, { skip: 'sb' });
  gb.quad('door', [ex + 0.95, 0, ez - 0.16], [-1, 0, 0], [0, 1, 0], 1.9, 2.9, 1, 1, { fixedUV: true });
  L.lights.push({ p: [ex, 2.5, ez - 1], r: 6, i: 0.6, c: WARM });
  // coffins
  const decoSpr = [];
  for (const r of rooms) {
    if (r === entrance) continue;
    if (rng.chance(0.55)) {
      const i = r.x + (rng.chance(0.5) ? 0 : r.w - 1), j = r.y + rng.int(0, r.h - 1);
      if (!at(i, j)) { const x = (i + 0.5) * cs, z = (j + 0.5) * cs; gb.box(x - 0.45, 0, z - 1.05, x + 0.45, 0.65, z + 1.05, { side: 'woodDark', top: 'woodDark' }, 1, 1); gb.box(x - 0.5, 0.65, z - 1.1, x + 0.5, 0.75, z + 1.1, { side: 'stone', top: 'stone' }, 1, 1); addCol(area, x - 0.5, z - 1.1, x + 0.5, z + 1.1, -10, 0.75); }
    }
    for (let k = 0; k < rng.int(1, 4); k++) decoSpr.push([rng.pick(['bones', 'skulls', 'urn', 'urn']), (r.x + rng.range(0.2, r.w - 0.2)) * cs, (r.y + rng.range(0.2, r.h - 0.2)) * cs]);
    if (rng.chance(0.5)) decoSpr.push(['cobweb', (r.x + 0.15) * cs, (r.y + 0.15) * cs, 'high']);
  }
  const mats = worldMats(area, Object.fromEntries(Object.entries(DG_MATS).map(([k, v]) => [k, { ...v, tint: false }])));
  area.scene.add(gb.build(mats));
  const lf = makeLightFn(L);
  const lightAt = (x, y, z) => { const c = lf([x, y, z], [0, 1, 0]); return clamp((c[0] + c[1] + c[2]) / 3 + 0.15, 0.2, 1.2); };
  area.entityLight = e => lightAt(e.pos.x, 1.2, e.pos.z);
  const tspr = simpleSprite('torch', 2);
  for (const [x, y, z] of torches) { const m = makeBillboard(tspr.tex[0], 0.5, 1.0); m.position.set(x, y, z); area.scene.add(m); area.bbs.push(m); area.anim.push((dt, t) => { m.material.map = tspr.tex[Math.floor(t * 6 + x) % 2]; }); }
  for (const [kind, x, z, high] of decoSpr) {
    const s = simpleSprite(kind).tex[0]; const size = { bones: [1.2, 0.5], skulls: [1.0, 0.6], urn: [0.6, 0.75], cobweb: [1.6, 1.6] }[kind];
    const m = makeBillboard(s, size[0], size[1], kind === 'cobweb' ? { transparent: true, opacity: 0.8 } : {}); m.position.set(x, high ? H - 1.7 : 0, z); area.scene.add(m); area.bbs.push(m);
    const k = lightAt(x, 0.5, z); m.material.color.setRGB(k, k, k);
  }
  // loot chests
  const opened = G.flags.dchests || (G.flags.dchests = {});
  rooms.forEach((r, ri) => {
    if (r === entrance || !rng.chance(r === boss ? 1 : 0.4)) return;
    const x = (r.x + 0.6) * cs, z = (r.y + r.h - 0.6) * cs; if (at(Math.floor(x / cs), Math.floor(z / cs))) return;
    const key = 'c' + ri; const fresh = opened[key] == null || dayOf(G.time) - opened[key] >= 3; // chests restock after three days
    const l = fresh ? rollLoot('chest', G.player.level) : { items: [], gold: 0 };
    const c = makeLootPile(area, x, z, 'Old Chest', l.items, l.gold, { chest: true }); c.onEmpty = () => { opened[key] = dayOf(G.time); };
  });
  // creatures
  const L_ = G.player.level;
  const table = L_ < 2 ? [['rat', 3], ['bat', 2], ['skeleton', 3], ['zombie', 1]] : L_ < 4 ? [['rat', 2], ['bat', 2], ['skeleton', 3], ['zombie', 2], ['wraith', 1]] : [['bat', 1], ['skeleton', 3], ['zombie', 2], ['wraith', 2]];
  const pickType = () => { const tot = table.reduce((s, t) => s + t[1], 0); let r = rnd.next() * tot; for (const [t, w] of table) { r -= w; if (r <= 0) return t; } return 'skeleton'; };
  const freeSpot = (r) => { for (let k = 0; k < 20; k++) { const i = r.x + rnd.int(0, r.w - 1), j = r.y + rnd.int(0, r.h - 1); if (!at(i, j)) return [(i + rnd.range(0.3, 0.7)) * cs, (j + rnd.range(0.3, 0.7)) * cs]; } return [(r.cx + 0.5) * cs, (r.cy + 0.5) * cs]; };
  for (const r of rooms) {
    if (r === entrance) continue;
    if (r === boss) {
      if (!G.flags.necroDead) {
        const [x, z] = [(r.cx + 0.5) * cs, (r.cy + 0.5) * cs];
        const e = spawnEnemy(area, 'necro', x, z, { wanderR: 2 }); e.level = Math.max(3, L_); e.hp = e.maxHp = Math.round(ENEMIES.necro.hp * (1 + (e.level - 1) * 0.1));
        e.bossLoot = [makeQuestItem('soulgem', 'Black Stone of King Aldwin'), makeQuestItem('letter', "The Stadtholder’s Letter")];
      }
      for (let k = 0; k < 2; k++) { const [x, z] = freeSpot(r); spawnEnemy(area, 'skeleton', x, z); }
      continue;
    }
    const n = rnd.int(1, 2) + (r.w * r.h > 20 ? 1 : 0);
    for (let k = 0; k < n; k++) { const [x, z] = freeSpot(r); spawnEnemy(area, pickType(), x, z); }
  }
  Quests.populateDungeon(area, rooms.filter(r => r !== entrance && r !== boss), cs, freeSpot);
  area.exits = [{ x: ex, z: ez - 0.2, nx: 0, nz: -1, kind: 'dungeonExit' }];
  area.spawn = { x: ex, z: ez - 1.6, yaw: 0 };
  area.scene.fog = new THREE.Fog(0x000000, 3, 26); area.scene.background = new THREE.Color(0x000000);
  buildColliderGrid(area);
  return area;
}
function dungeonLOS(area, x0, z0, x1, z1) {
  const D = area.dg; const dx = x1 - x0, dz = z1 - z0; const d = Math.hypot(dx, dz); const n = Math.ceil(d / 0.5);
  for (let i = 1; i < n; i++) { const t = i / n; const cx = Math.floor((x0 + dx * t) / D.cs), cy = Math.floor((z0 + dz * t) / D.cs); if (cx < 0 || cy < 0 || cx >= D.N || cy >= D.N || D.grid[cx + cy * D.N]) return false; }
  return true;
}
