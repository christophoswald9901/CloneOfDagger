/* =====================================================================
   Entities: townsfolk, guards, creatures, loot piles, projectiles
   ===================================================================== */

class Ent {
  constructor(area, o) {
    this.area = area; this.kind = o.kind; this.role = o.role || null; this.def = o.def || null;
    this.name = o.name || 'Someone';
    this.pos = new THREE.Vector3(o.x, baseY(area, o.x, o.z) + (o.y ?? 0), o.z);
    this.radius = o.radius ?? 0.35; this.frames = o.frames; this.w = o.w ?? 0.95; this.h = o.h ?? 1.9;
    this.mesh = makeBillboard(this.frames[0], this.w, this.h, { transparent: o.transparent, opacity: o.opacity });
    this.mat = this.mesh.material; this.mesh.position.copy(this.pos); area.scene.add(this.mesh);
    this.hp = o.hp ?? 25; this.maxHp = this.hp; this.hostile = !!o.hostile; this.dead = false; this.active = true;
    this.state = 'idle'; this.anim = rnd.next() * 10; this.flash = 0; this.cd = 0; this.atkT = 0; this.hitPending = 0;
    this.dialog = o.dialog || null; this.building = o.building || null; this.data = o.data || {};
    this.home = { x: o.x, z: o.z }; this.wanderR = o.wanderR ?? 0; this.speed = o.speed ?? 1.2;
    this.fly = o.fly || 0; this.items = o.items || null; this.gold = o.gold || 0; this.level = o.level || 1;
    this.id = o.id || uid(); this.look = o.look || null; this.gender = o.gender || 'm';
    this.losT = 0; this.see = false; this.lostT = 0; this.moving = false; this.stuckT = 0; this.lastPos = this.pos.clone();
    this.wT = 0; this.wTarget = null; this.path = null; this.pathT = 0; this.barkT = 0; this.soundT = rnd.range(2, 6);
    area.entities.push(this);
  }
  setFrame(i) { const t = this.frames[i % this.frames.length]; if (this.mat.map !== t) this.mat.map = t; }
  remove() {
    this.area.scene.remove(this.mesh); this.mat.dispose();
    const i = this.area.entities.indexOf(this); if (i >= 0) this.area.entities.splice(i, 1); this.removed = true;
  }
  get alive() { return !this.dead && this.kind !== 'loot'; }
}

function spawnEnemy(area, type, x, z, extra = {}) {
  const d = ENEMIES[type]; const L = G.player ? G.player.level : 1;
  const lvl = Math.max(1, L + rnd.int(-1, 1));
  const hp = Math.round(d.hp * (1 + (lvl - 1) * 0.12));
  const e = new Ent(area, { kind: 'enemy', def: d, name: extra.name || d.name, x, z, y: d.fly || 0, frames: enemySprite(d.sprite).tex, w: d.w, h: d.h, radius: d.radius ?? 0.38, hp, hostile: true, transparent: d.transparent, opacity: d.opacity, fly: d.fly, level: lvl, speed: d.speed, ...extra });
  e.etype = type; e.wanderR = extra.wanderR ?? 5;
  return e;
}
function spawnNPC(area, o) {
  const frames = o.frames || humanSprite(o.spriteKey || ('n_' + o.name), o.look).tex;
  return new Ent(area, { kind: 'npc', hp: o.hp ?? 30, frames, ...o });
}
function makeLootPile(area, x, z, name, items, gold, opt = {}) {
  const spr = opt.chest ? simpleSprite('chest') : opt.corpse ? simpleSprite('corpse') : simpleSprite('sack');
  const [w, h] = opt.chest ? [1.1, 0.82] : opt.corpse ? (opt.size || [1.7, 0.55]) : [0.8, 0.64];
  const e = new Ent(area, { kind: 'loot', name, x, z, frames: spr.tex, w, h, items: items || [], gold: gold || 0, radius: 0.3 });
  e.chest = !!opt.chest; e.owned = opt.owned || null; e.questItem = opt.questItem || null; e.fade = opt.fade ?? (opt.chest ? -1 : 180);
  if (opt.chest) { const b = baseY(area, x, z); addCol(area, x - 0.5, z - 0.3, x + 0.5, z + 0.3, b - 10, b + 0.75); }
  return e;
}

/* ---------------- movement helpers ---------------- */
function moveEnt(e, tx, tz, speed, dt) {
  const dx = tx - e.pos.x, dz = tz - e.pos.z; const d = Math.hypot(dx, dz);
  if (d < 0.05) { e.moving = false; return true; }
  const step = Math.min(d, speed * dt), ox = e.pos.x, oz = e.pos.z;
  e.pos.x += dx / d * step; e.pos.z += dz / d * step; e.moving = true;
  collide(e.area, e.pos, e.radius, (e.fly ? e.pos.y - e.fly : e.pos.y), 1.6);
  if (!e.fly) keepAshore(e.area, e.pos, ox, oz, e.radius, e.pos.y);
  return d < 0.3;
}
function separate(area) {
  const ents = area.entities;
  for (let i = 0; i < ents.length; i++) {
    const a = ents[i]; if (!a.alive || !a.active) continue;
    for (let j = i + 1; j < ents.length; j++) {
      const b = ents[j]; if (!b.alive || !b.active) continue;
      const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z; const r = a.radius + b.radius; const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 1e-6) { const d = Math.sqrt(d2); const p = (r - d) / 2; const nx = dx / d, nz = dz / d; if (!a.data.fixed) { a.pos.x -= nx * p; a.pos.z -= nz * p; } if (!b.data.fixed) { b.pos.x += nx * p; b.pos.z += nz * p; } }
    }
    const P = G.player; if (!P) continue;
    const dx = P.pos.x - a.pos.x, dz = P.pos.z - a.pos.z; const r = a.radius + 0.38; const d2 = dx * dx + dz * dz;
    if (d2 < r * r && d2 > 1e-6 && Math.abs(P.pos.y - a.pos.y) < 1.5 && !a.data.fixed) { const d = Math.sqrt(d2); a.pos.x -= dx / d * (r - d); a.pos.z -= dz / d * (r - d); }
  }
}
function wanderStep(e, dt, speedMul = 0.5) {
  e.wT -= dt;
  if (!e.wTarget || e.wT <= 0) {
    e.wT = rnd.range(2, 6);
    if (rnd.chance(0.35) || e.wanderR <= 0) e.wTarget = null;
    else { const a = rnd.next() * Math.PI * 2, r = rnd.next() * e.wanderR; e.wTarget = { x: e.home.x + Math.cos(a) * r, z: e.home.z + Math.sin(a) * r }; }
  }
  if (e.wTarget) { if (moveEnt(e, e.wTarget.x, e.wTarget.z, e.speed * speedMul, dt)) e.wTarget = null; } else e.moving = false;
}
function followNodes(e, dt) {
  const nodes = e.area.nodes; if (!nodes) return;
  if (e.node == null) { let best = 0, bd = 1e9; nodes.forEach((n, i) => { const d = Math.hypot(n.x - e.pos.x, n.z - e.pos.z); if (d < bd) { bd = d; best = i; } }); e.node = best; e.lane = rnd.range(-0.8, 0.8); }
  const n = nodes[e.node]; const prev = e.prevNode != null ? nodes[e.prevNode] : null;
  let tx = n.x, tz = n.z;
  if (prev) {
    // keep to a lane that fits the street: wide avenues spread people out, alleys put them in single file
    const k = prev.n.indexOf(e.node); const w = k >= 0 && prev.w ? prev.w[k] : 6; const lane = e.lane * Math.max(0, w / 2 - 0.9);
    const dx = n.x - prev.x, dz = n.z - prev.z; const l = Math.hypot(dx, dz) || 1; tx += -dz / l * lane; tz += dx / l * lane;
  }
  if (e.pause > 0) { e.pause -= dt; e.moving = false; return; }
  if (moveEnt(e, tx, tz, e.speed, dt) || Math.hypot(n.x - e.pos.x, n.z - e.pos.z) < 2.2) {
    const opts = n.n.filter(k => k !== e.prevNode); const next = opts.length ? rnd.pick(opts) : n.n[0];
    e.prevNode = e.node; e.node = next; if (rnd.chance(0.25)) e.pause = rnd.range(1, 5);
  }
  // unstick
  e.stuckT += dt;
  if (e.stuckT > 2) { if (e.pos.distanceTo(e.lastPos) < 0.3) { e.lane = rnd.range(-0.8, 0.8); const t = e.node; e.node = e.prevNode ?? e.node; e.prevNode = t; } e.stuckT = 0; e.lastPos.copy(e.pos); }
}

/* ---------------- dungeon pathfinding ---------------- */
function dungeonPath(area, fx, fz, tx, tz) {
  const D = area.dg; const N = D.N; const cs = D.cs;
  const s = Math.floor(fx / cs) + Math.floor(fz / cs) * N, t = Math.floor(tx / cs) + Math.floor(tz / cs) * N;
  if (s === t) return null;
  const prev = new Int32Array(N * N).fill(-1); prev[s] = s; const q = [s]; let qi = 0;
  while (qi < q.length && qi < 900) {
    const c = q[qi++]; if (c === t) break; const cx = c % N, cy = (c / N) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue; const k = nx + ny * N; if (D.grid[k] || prev[k] >= 0) continue; prev[k] = c; q.push(k); }
  }
  if (prev[t] < 0) return null;
  let c = t; const path = [];
  while (c !== s) { path.push(c); c = prev[c]; }
  path.reverse(); return path.map(k => ({ x: (k % N + 0.5) * cs, z: (((k / N) | 0) + 0.5) * cs }));
}

/* ---------------- enemy AI ---------------- */
function enemyTargetHostile(e) { return e.kind === 'enemy' || (e.role === 'guard' && G.wanted); }
function updateHostile(e, dt) {
  const P = G.player; const d = e.def; const area = e.area;
  const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z; const dist = Math.hypot(dx, dz);
  e.losT -= dt;
  if (e.losT <= 0) { e.losT = 0.25 + rnd.next() * 0.15; e.see = !P.dead && dist < d.sight && hasLOS(area, e.pos, P.pos, e.fly ? 0.3 : 1.5, 1.5); if (e.see) { e.lastSeen = { x: P.pos.x, z: P.pos.z }; } }
  e.cd -= dt;
  if (e.state === 'idle' || e.state === 'wander') {
    if (e.see || e.aggro) {
      e.state = 'chase'; e.aggro = true;
      if (d.bark && e.barkT <= 0) { msg(`${e.name}: "${rnd.pick(d.bark)}"`, 'bark'); e.barkT = 20; }
      if (d.sound) SFX.play(d.sound, e.pos);
    } else if (e.role === 'guard') followNodes(e, dt); else wanderStep(e, dt, 0.4);
  } else if (e.state === 'chase') {
    if (P.dead) { e.state = 'idle'; return; }
    if (!e.see) { e.lostT += dt; if (e.lostT > 10) { e.state = 'idle'; e.aggro = false; e.lostT = 0; } } else e.lostT = 0;
    // casters keep their distance and throw fire
    if (d.caster) {
      e.castT = (e.castT ?? 2) - dt;
      if (e.see && dist > 3 && dist < 18 && e.castT <= 0) { e.castT = rnd.range(2.2, 3.6); e.atkT = 0.5; castEnemyFireball(e); }
      if (!e.summoned && e.hp < e.maxHp * 0.55) { e.summoned = true; msg(`${e.name}: "Rise, my servants!"`, 'bark'); for (let k = 0; k < 2; k++) { const a = rnd.next() * 6.28; const s = spawnEnemy(area, 'skeleton', e.pos.x + Math.cos(a) * 2, e.pos.z + Math.sin(a) * 2); s.aggro = true; s.state = 'chase'; } SFX.play('growl', e.pos); }
    }
    const speed = e.speed * (e.flash > 0 ? 0.5 : 1);
    if (dist > d.reach * 0.8) {
      let tx = P.pos.x, tz = P.pos.z;
      if (!e.see && e.lastSeen) { tx = e.lastSeen.x; tz = e.lastSeen.z; }
      if (area.kind === 'dungeon' && !e.see) {
        e.pathT -= dt;
        if (e.pathT <= 0 || !e.path) { e.pathT = 0.7; e.path = dungeonPath(area, e.pos.x, e.pos.z, P.pos.x, P.pos.z); }
        if (e.path && e.path.length) { const n = e.path[0]; tx = n.x; tz = n.z; if (Math.hypot(n.x - e.pos.x, n.z - e.pos.z) < 0.6) e.path.shift(); }
      }
      if (!(d.caster && dist < 5 && e.see && e.castT > 1)) moveEnt(e, tx, tz, speed, dt); else e.moving = false;
    } else e.moving = false;
    if (dist < d.reach + 0.25 && e.cd <= 0 && Math.abs(P.pos.y - (e.pos.y - (e.fly || 0))) < 1.6 && e.see) {
      e.cd = d.cd * rnd.range(0.85, 1.2); e.atkT = 0.45; e.hitPending = 0.22;
      if (d.sound && rnd.chance(0.4)) SFX.play(d.sound, e.pos);
    }
  }
  if (e.hitPending > 0) { e.hitPending -= dt; if (e.hitPending <= 0 && dist < d.reach + 0.7 && !P.dead) enemyHitsPlayer(e); }
}
function enemyHitsPlayer(e) {
  const P = G.player;
  const chance = clamp(0.58 + e.level * 0.025 - playerAC() * 0.035 - (P.attr.AGI - 50) / 260, 0.1, 0.92);
  if (rnd.next() < chance) damagePlayer(rnd.int(e.def.dmg[0], e.def.dmg[1]) + Math.floor(e.level / 3), e);
  else SFX.play('miss', e.pos);
}

/* ---------------- NPC update ---------------- */
function updateNPC(e, dt) {
  if (e.role === 'guard' && G.wanted && e.area.kind === 'city') {
    if (!e.def) e.def = ENEMIES.guard;
    const d = Math.hypot(G.player.pos.x - e.pos.x, G.player.pos.z - e.pos.z);
    // guards join the hunt when they are close, or when they can see you
    if (e.state !== 'chase') {
      e.losT -= dt;
      if (e.losT <= 0) { e.losT = 0.5; e.see = d < 35 && hasLOS(e.area, e.pos, G.player.pos); }
      if (e.data.temp || d < (e.data.post ? 18 : 28) || e.see) {
        e.state = 'chase'; e.aggro = true;
        if (e.barkT <= 0) { e.barkT = 12; bigMsg('HALT!', 1.2); SFX.play('halt', e.pos); }
      }
    }
    if (e.state === 'chase') { updateHostile(e, dt); return; }
  }
  if (e.state === 'chase') { e.state = 'idle'; e.aggro = false; }
  switch (e.state === 'flee' ? 'flee' : e.role) {
    case 'flee': {
      e.fleeT -= dt; const P = G.player; const dx = e.pos.x - P.pos.x, dz = e.pos.z - P.pos.z; const d = Math.hypot(dx, dz) || 1;
      moveEnt(e, e.pos.x + dx / d * 3, e.pos.z + dz / d * 3, 3.6, dt); if (e.fleeT <= 0) e.state = 'idle'; break;
    }
    case 'townsfolk': case 'guard':
      if (e.data.post) { e.moving = false; break; }
      followNodes(e, dt); break;
    case 'ghost': {
      wanderStep(e, dt, 0.5);
      const P = G.player; const d = Math.hypot(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
      e.barkT -= dt;
      if (d < 26 && e.barkT <= 0) { e.barkT = rnd.range(12, 20); SFX.play('ghost', e.pos); msg(rnd.pick(['A spectral voice howls: "VENGEANCE!"', 'The ghost of King Aldwin moans: "Vengeance... vengeance..."', 'A chill wind whispers: "Who... betrayed... me..."']), 'ghost'); }
      break;
    }
    case 'wander': wanderStep(e, dt, 0.5); break;
    case 'traveller': Roads.step(e, dt); break;
    case 'townwalker': { const T = TownOf(e.data.town); if (T) T.stepFolk(e, dt); else e.moving = false; break; }
    default: e.moving = false;
  }
}

/* ---------------- generic update ---------------- */
function updateEntities(dt) {
  const area = G.area; const P = G.player; const cam = camera.position;
  for (const e of area.entities.slice()) {
    if (e.removed) continue;
    if (!e.active) { e.mesh.visible = false; continue; }
    e.mesh.visible = true;
    e.barkT -= dt; e.flash = Math.max(0, e.flash - dt); e.atkT = Math.max(0, e.atkT - dt);
    if (e.kind === 'loot') {
      if (e.fade > 0 && !e.items.length && !e.gold && !e.questItem) { e.fade -= dt; if (e.fade <= 0) { e.remove(); continue; } }
    } else if (!e.dead && !G.paused) {
      if (e.kind === 'enemy') updateHostile(e, dt); else updateNPC(e, dt);
      if (!e.fly) e.pos.y = groundAt(area, e.pos.x, e.pos.z, e.radius, e.pos.y + 0.3);
      else e.pos.y = baseY(area, e.pos.x, e.pos.z) + e.fly + Math.sin(e.anim * 3) * 0.15;
      e.soundT -= dt;
      if (e.soundT <= 0 && e.kind === 'enemy' && e.def.sound && e.state !== 'chase') { e.soundT = rnd.range(5, 12); SFX.play(e.def.sound, e.pos); }
    }
    // animation
    e.anim += dt;
    if (e.kind !== 'loot') {
      if (e.atkT > 0) e.setFrame(3); else if (e.moving || e.fly) e.setFrame(1 + (Math.floor(e.anim * (e.fly ? 8 : 4)) % 2)); else e.setFrame(0);
    }
    e.mesh.position.copy(e.pos);
    e.mesh.rotation.y = Math.atan2(cam.x - e.pos.x, cam.z - e.pos.z);
    if (e.flash > 0) e.mat.color.setRGB(1, 0.35, 0.35); else if (e.role === 'ghost' || (e.def && e.def.sprite === 'wraith')) e.mat.color.setRGB(1, 1, 1); else if (area.entityLight) { const k = area.entityLight(e); e.mat.color.setRGB(k, k * 0.95, k * 0.88); } else e.mat.color.copy(G.tint);
  }
  if (!G.paused) separate(area);
}

/* ---------------- damage & death ---------------- */
function hurtEntity(e, dmg, byPlayer = true) {
  if (e.dead) return;
  e.hp -= dmg; e.flash = 0.18; SFX.play('enemyHurt', e.pos); bloodBurst(e);
  if (byPlayer) {
    if (e.kind === 'npc' && !enemyTargetHostile(e) && e.role !== 'ghost') {
      commitCrime(e.hp <= 0 ? 'murder' : 'assault');
      if (e.role !== 'guard') { e.state = 'flee'; e.fleeT = 8; msg(`${e.name} screams for the guards!`); }
    }
    if (e.kind === 'enemy') { e.aggro = true; e.state = 'chase'; }
  }
  if (e.hp <= 0) killEnt(e, byPlayer);
}
function killEnt(e, byPlayer) {
  e.dead = true; e.hp = 0; SFX.play('die', e.pos);
  const d = e.def;
  if (byPlayer) {
    if (e.kind === 'enemy' || (e.role === 'guard')) giveXP(Math.round((d ? d.xp : 20) * (1 + (e.level - 1) * 0.15)));
    Quests.onKill(e);
  }
  if (e.kind === 'npc' && e.role !== 'guard') { const l = rollLoot('citizen', 1); convertToLoot(e, l, [1.7, 0.55]); return; }
  const l = rollLoot(d ? d.loot : 'none', e.level);
  if (e.bossLoot) l.items.push(...e.bossLoot);
  if (d && d.noCorpse) {
    if (l.items.length || l.gold) makeLootPile(e.area, e.pos.x, e.pos.z, `Remains of the ${d.name}`, l.items, l.gold);
    e.remove(); return;
  }
  convertToLoot(e, l, d && d.corpse ? d.corpse : [1.7, 0.55]);
}
function convertToLoot(e, l, size) {
  e.kind = 'loot'; e.frames = simpleSprite('corpse').tex; e.mesh.geometry = planeGeo(size[0], size[1]); e.setFrame(0);
  e.items = l.items; e.gold = l.gold; e.name = `${e.name} (dead)`; e.fade = 120; e.pos.y = e.fly ? baseY(e.area, e.pos.x, e.pos.z) : e.pos.y; e.fly = 0;
  if (e.mat.transparent) { e.mat.transparent = false; e.mat.opacity = 1; e.mat.depthWrite = true; e.mat.needsUpdate = true; }
}

/* ---------------- particles & projectiles ---------------- */
const FX = [];
function bloodBurst(e) {
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(planeGeo(0.07, 0.07), new THREE.MeshBasicMaterial({ color: e.def && e.def.undead ? 0xa89c80 : 0x8a0c0c, side: THREE.DoubleSide, fog: true }));
    m.position.set(e.pos.x, e.pos.y + (e.fly ? 0.2 : e.h * 0.6), e.pos.z); e.area.scene.add(m);
    FX.push({ m, area: e.area, v: new THREE.Vector3(rnd.range(-1.5, 1.5), rnd.range(1, 3), rnd.range(-1.5, 1.5)), t: 0.45 });
  }
}
function flashFX(area, x, y, z, tex, size, life = 0.35) {
  const m = makeBillboard(tex, size, size, { additive: true, fog: false }); m.position.set(x, y - size / 2, z); area.scene.add(m);
  FX.push({ m, area, t: life, life, grow: true });
}
function updateFX(dt) {
  for (let i = FX.length - 1; i >= 0; i--) {
    const f = FX[i]; f.t -= dt;
    if (f.v) { f.v.y -= 9 * dt; f.m.position.addScaledVector(f.v, dt); }
    if (f.grow) { const s = 1 + (1 - f.t / f.life) * 1.5; f.m.scale.set(s, s, s); f.m.material.opacity = Math.max(0, f.t / f.life); }
    f.m.rotation.y = Math.atan2(camera.position.x - f.m.position.x, camera.position.z - f.m.position.z);
    if (f.t <= 0 || f.area !== G.area) { f.area.scene.remove(f.m); f.m.material.dispose(); FX.splice(i, 1); }
  }
}
const PROJ = [];
function spawnProjectile(area, from, dir, o) {
  const tex = o.kind === 'fire' ? simpleSprite('fireball').tex[0] : simpleSprite('spark').tex[0];
  const m = makeBillboard(tex, 0.7, 0.7, { additive: true, fog: false }); area.scene.add(m);
  PROJ.push({ area, pos: from.clone(), vel: dir.clone().multiplyScalar(o.speed || 16), m, owner: o.owner, dmg: o.dmg, radius: o.radius || 2.2, life: 3, kind: o.kind, src: o.src });
  SFX.play('fire');
}
function castEnemyFireball(e) {
  const P = G.player; const from = new THREE.Vector3(e.pos.x, e.pos.y + 1.4, e.pos.z);
  const to = new THREE.Vector3(P.pos.x, P.pos.y + 1.2, P.pos.z); const dir = to.sub(from).normalize();
  spawnProjectile(e.area, from.addScaledVector(dir, 0.8), dir, { owner: 'enemy', dmg: [6, 13], kind: 'fire', speed: 11, radius: 1.6, src: e });
}
function updateProjectiles(dt) {
  for (let i = PROJ.length - 1; i >= 0; i--) {
    const p = PROJ[i];
    if (p.area !== G.area) { p.area.scene.remove(p.m); p.m.material.dispose(); PROJ.splice(i, 1); continue; }
    p.life -= dt; const steps = 3; let hit = false;
    for (let s = 0; s < steps && !hit; s++) {
      p.pos.addScaledVector(p.vel, dt / steps);
      if (p.pos.y < baseY(p.area, p.pos.x, p.pos.z) + 0.05 || pointBlocked(p.area, p.pos.x, p.pos.y, p.pos.z) || (p.area.ceilY && p.pos.y > p.area.ceilY)) hit = true;
      if (p.owner === 'player') {
        for (const e of p.area.entities) if (e.alive && e.active && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < e.radius + 0.45 && p.pos.y > e.pos.y - 0.3 && p.pos.y < e.pos.y + e.h + 0.3) { hit = true; break; }
      } else {
        const P = G.player; if (Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z) < 0.7 && p.pos.y > P.pos.y && p.pos.y < P.pos.y + 2) hit = true;
      }
    }
    p.m.position.set(p.pos.x, p.pos.y - 0.35, p.pos.z); p.m.rotation.y = Math.atan2(camera.position.x - p.pos.x, camera.position.z - p.pos.z);
    if (hit || p.life <= 0) {
      flashFX(p.area, p.pos.x, p.pos.y, p.pos.z, simpleSprite('fireball').tex[0], 2.2, 0.4); SFX.play('boom', p.pos);
      if (p.owner === 'player') {
        for (const e of p.area.entities.slice()) if (e.alive && e.active) { const d = Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z); if (d < p.radius + e.radius) hurtEntity(e, rnd.int(p.dmg[0], p.dmg[1]), true); }
      } else {
        const P = G.player; const d = Math.hypot(P.pos.x - p.pos.x, P.pos.z - p.pos.z);
        if (d < p.radius && Math.abs(P.pos.y + 1 - p.pos.y) < 2) damagePlayer(Math.round(rnd.int(p.dmg[0], p.dmg[1]) * (1 - d / p.radius * 0.5)), p.src);
      }
      p.area.scene.remove(p.m); p.m.material.dispose(); PROJ.splice(i, 1);
    }
  }
}

/* ---------------- crime ---------------- */
function commitCrime(kind) {
  if (G.area.kind === 'dungeon') return;
  const fine = kind === 'murder' ? 1000 : kind === 'theft' ? 150 : 80;
  const fresh = !G.wanted;
  if (fresh) G.wanted = { fine: 0, until: 0, spawnT: 2 };
  G.wanted.fine += fine; G.wanted.until = G.time + 24 * 60;
  if (fresh) { bigMsg('HALT!', 1.5); SFX.play('halt'); }
  msg(`Crime: ${kind}. The city guard wants you. Your fine is ${G.wanted.fine} gold.`, 'bad');
}
function clearWanted(reason) {
  G.wanted = null; msg(reason, 'good');
  if (G.city) for (const e of G.city.entities) if (e.role === 'guard') { e.state = 'idle'; e.aggro = false; if (e.data.temp) e.data.leave = true; }
}
