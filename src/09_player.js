/* =====================================================================
   The player: stats, inventory, movement, combat, magic, interaction
   ===================================================================== */

function newPlayer(cfg) {
  const R = RACES[cfg.race], C = CLASSES[cfg.cls];
  const attr = { ...cfg.attr };
  const p = {
    name: cfg.name, race: cfg.race, cls: cfg.cls, level: 1, xp: 0, attr, points: 0,
    hp: 0, maxHp: 0, mp: 0, maxMp: 0, fat: 0, maxFat: 0, gold: C.gold,
    inv: [], equip: { weapon: null, body: null, head: null, shield: null }, spells: [], spell: 0,
    pos: new THREE.Vector3(), yaw: 0, pitch: 0, vy: 0, onGround: true,
    swingT: -1, swingDur: 0.5, hitDone: false, castT: -1, castDone: false, bob: 0, stepT: 0, dead: false, hurtT: 0, lastHit: 0,
  };
  p.maxHp = 25 + Math.floor(attr.END / 4) + C.hp; p.hp = p.maxHp;
  p.maxMp = Math.round(attr.INT * C.mp); p.mp = p.maxMp;
  p.maxFat = attr.END + attr.STR; p.fat = p.maxFat;
  const kit = startingKit(cfg.cls);
  for (const it of kit.items) { addItem(p, it, true); if (it.kind === 'weapon' && !p.equip.weapon) p.equip.weapon = it; if (it.kind === 'armor' && !p.equip[it.slot]) p.equip[it.slot] = it; }
  p.spells = kit.spells.slice();
  return p;
}
function recalcDerived(p) {
  const C = CLASSES[p.cls];
  const newMp = Math.round(p.attr.INT * C.mp); p.mp += Math.max(0, newMp - p.maxMp); p.maxMp = newMp;
  const newFat = p.attr.END + p.attr.STR; p.fat += Math.max(0, newFat - p.maxFat); p.maxFat = newFat;
}
function playerAC() { const p = G.player; let ac = 0; for (const s of ['body', 'head', 'shield']) if (p.equip[s]) ac += p.equip[s].ac; return ac + Math.floor((p.attr.AGI - 50) / 12); }
// out in the country nobody walks up a sheer rock face, and the mountains at the edge of the world turn everyone back:
// a step is refused (or slides along) if it climbs ground steeper than about 50°, or goes on into the high peaks
function wildFooting(p, ox, oz) {
  const g0 = terrainH(ox, oz), r0 = rimDist(ox, oz);
  const bad = (x, z) => { const r = rimDist(x, z); if (r < -40 && r < r0) return true; const g = terrainH(x, z);
    if (Math.abs(x - SITES[2].x) < 300 && Math.abs(z - SITES[2].z) < 300 && g < MERE.wl - 0.5 && g < g0) return true; // the deep water of the mere
    return g > g0 + 0.01 && p.pos.y <= g + 0.3 && terrainSlope(x, z) > 1.2; };
  if (!bad(p.pos.x, p.pos.z)) return;
  if (!bad(p.pos.x, oz)) p.pos.z = oz; else if (!bad(ox, p.pos.z)) p.pos.x = ox; else { p.pos.x = ox; p.pos.z = oz; }
}
function playerSpeed() { return 3.9 + (G.player.attr.SPD - 50) / 35; }
function xpToNext(level) { return 100 * level + 20 * level * level; }
function giveXP(n) {
  const p = G.player; p.xp += n;
  while (p.xp >= xpToNext(p.level)) {
    p.xp -= xpToNext(p.level); p.level++;
    const gain = 5 + Math.floor(p.attr.END / 12) + rnd.int(0, 3);
    p.maxHp += gain; p.hp = p.maxHp; p.points += 4;
    if (!rpgUI()) continue; // levels still accrue quietly
    SFX.play('levelup'); bigMsg(`LEVEL ${p.level}`, 2);
    msg(`You feel more experienced. You are now level ${p.level}! (+${gain} health, 4 attribute points to spend in the character sheet)`, 'good');
  }
}

/* ---------------- inventory ---------------- */
function addItem(p, it, silent = false) {
  if (it.kind === 'potion') { const ex = p.inv.find(i => i.kind === 'potion' && i.base === it.base); if (ex) { ex.qty = (ex.qty || 1) + (it.qty || 1); if (!silent) msg(`You take the ${it.name}.`); return; } it = { ...it, qty: it.qty || 1 }; delete it.infinite; }
  p.inv.push(it); if (!silent) msg(`You take the ${it.name}.`);
  if (!silent) Quests.onPickup(it);
}
function removeItem(p, it, n = 1) {
  if (it.kind === 'potion' && (it.qty || 1) > n) { it.qty -= n; return; }
  const i = p.inv.indexOf(it); if (i >= 0) p.inv.splice(i, 1);
  for (const s in p.equip) if (p.equip[s] === it) p.equip[s] = null;
}
const hasItem = (base) => G.player.inv.find(i => i.base === base);
function equipItem(it) {
  const p = G.player;
  if (it.kind === 'weapon') { p.equip.weapon = p.equip.weapon === it ? null : it; msg(p.equip.weapon ? `You ready the ${it.name}.` : 'You sheathe your weapon.'); }
  else if (it.kind === 'armor') { p.equip[it.slot] = p.equip[it.slot] === it ? null : it; msg(p.equip[it.slot] ? `You put on the ${it.name}.` : `You take off the ${it.name}.`); }
  SFX.play('click');
}
function useItem(it) {
  const p = G.player;
  if (it.kind === 'potion') {
    if (it.base === 'heal') { const h = Math.min(p.maxHp - p.hp, 35); p.hp += h; msg(`You drink the potion and recover ${h} health.`, 'good'); }
    if (it.base === 'magicka') { const h = Math.min(p.maxMp - p.mp, 35); p.mp += h; msg(`Magicka surges through you (+${h}).`, 'good'); }
    if (it.base === 'stamina') { p.fat = Math.min(p.maxFat, p.fat + 60); msg('Your weariness fades.', 'good'); }
    removeItem(p, it); SFX.play('drink'); return true;
  }
  if (it.kind === 'weapon' || it.kind === 'armor') { equipItem(it); return true; }
  if (it.kind === 'quest' || it.kind === 'key') { msg(it.base === 'letter' ? 'The seal is unbroken. It is addressed to the Queen of Daggerfall.' : it.base === 'soulgem' ? 'Inside the black gem a tiny crowned figure pounds silently against the facets.' : `It is ${it.name}.`); return false; }
  return false;
}
function quickPotion() {
  const it = G.player.inv.find(i => i.kind === 'potion' && i.base === 'heal');
  if (!it) { msg('You have no healing potions.'); return; }
  useItem(it);
}

/* ---------------- damage ---------------- */
function damagePlayer(n, src) {
  const p = G.player; if (p.dead || n <= 0) return;
  p.hp -= n; p.hurtT = 0.4; G.dmgFlash = 0.35; G.shake = 0.15; SFX.play('hurt');
  if (src && src.name) p.lastHit = src.name;
  if (p.hp <= 0) { p.hp = 0; playerDies(src); }
}
function playerDies(src) {
  const p = G.player; p.dead = true; p.swingT = -1; p.castT = -1; G.flying = false;
  msg(`You have been slain${src && src.name ? ' by ' + src.name : ''}.`, 'bad');
  setTimeout(() => UI.openDeath(), 1400);
}

/* ---------------- update ---------------- */
function updatePlayer(dt) {
  const p = G.player;
  if (p.dead) { camera.position.y = lerp(camera.position.y, p.pos.y + 0.3, dt * 3); camera.rotation.z = lerp(camera.rotation.z, 0.6, dt * 3); return; }
  const sens = 0.0022 * settings.sens;
  p.yaw -= Input.mdx * sens; p.pitch -= Input.mdy * sens * (settings.invertY ? -1 : 1); Input.mdx = Input.mdy = 0;
  if (keyDown('ArrowLeft')) p.yaw += 2.4 * dt; if (keyDown('ArrowRight')) p.yaw -= 2.4 * dt;
  if (keyDown('PageUp')) p.pitch += 1.5 * dt; if (keyDown('PageDown')) p.pitch -= 1.5 * dt;
  p.pitch = clamp(p.pitch, -1.35, 1.35);
  let f = ((keyDown('KeyW') || keyDown('ArrowUp')) ? 1 : 0) - ((keyDown('KeyS') || keyDown('ArrowDown')) ? 1 : 0);
  let s = (keyDown('KeyD') ? 1 : 0) - (keyDown('KeyA') ? 1 : 0);
  const st = Input.stick; let analog = 1; // touch stick: partial pushes walk slower
  if (!f && !s && (st.x || st.y)) { f = -st.y; s = st.x; analog = clamp(Math.hypot(st.x, st.y), 0.3, 1); }
  const moving = f !== 0 || s !== 0;
  if (G.flying && !settings.dbgFly) setFlying(false);
  const fly = G.flying;
  const running = (keyDown('ShiftLeft') || keyDown('ShiftRight') || st.run) && (p.fat > 1 || fly) && moving;
  let spd = playerSpeed() * analog * (running ? 1.7 : 1) * (p.fat <= 0 && !fly ? 0.7 : 1); if (f < 0 && !fly) spd *= 0.7;
  const len = Math.hypot(f, s) || 1; f /= len; s /= len;
  const sn = Math.sin(p.yaw), cs = Math.cos(p.yaw);
  if (fly) { // debug flight: move where you look, Space rises, X (or Z) sinks
    const fs = spd * (running ? 7 : 2.5), cp = Math.cos(p.pitch), clip = !settings.dbgNoClip;
    const up = (keyDown('Space') ? 1 : 0) - (keyDown('KeyX') ? 1 : 0);
    p.pos.x += (-sn * f * cp + cs * s) * fs * dt; p.pos.z += (-cs * f * cp - sn * s) * fs * dt;
    p.pos.y += (Math.sin(p.pitch) * f * fs + up * fs * 0.8) * dt;
    if (clip) collide(G.area, p.pos, 0.38, p.pos.y, 1.75);
    const g = groundAt(G.area, p.pos.x, p.pos.z, 0.38, p.pos.y);
    p.pos.y = clamp(p.pos.y, clip ? g : -60, Math.max(clip ? 160 : 900, g + (clip ? 130 : 600))); p.vy = 0; p.onGround = clip && p.pos.y <= g + 0.01; // no clip: through walls, trees and the ground itself
    if (clip && G.area.ceilY && p.pos.y + 1.8 > G.area.ceilY) p.pos.y = G.area.ceilY - 1.8;
  } else {
    const wasGround = p.onGround, ox = p.pos.x, oz = p.pos.z;
    p.pos.x += (-sn * f + cs * s) * spd * dt; p.pos.z += (-cs * f - sn * s) * spd * dt;
    collide(G.area, p.pos, 0.38, p.pos.y, 1.75); keepAshore(G.area, p.pos, ox, oz, 0.38, p.pos.y);
    if (G.area.kind === 'city' && Math.max(Math.abs(p.pos.x), Math.abs(p.pos.z)) > TG.R) wildFooting(p, ox, oz);
    if (keyDown('Space') && p.onGround && p.fat > 3) { p.vy = 5.2; p.onGround = false; p.fat -= 3; }
    p.vy -= 18 * dt; p.pos.y += p.vy * dt;
    const g = groundAt(G.area, p.pos.x, p.pos.z, 0.38, p.pos.y);
    if (p.pos.y <= g) { if (!p.onGround && p.vy < -11 && !p.safeFall && !settings.dbgNoFall) damagePlayer(Math.round((-p.vy - 11) * 3), { name: 'the fall' }); p.pos.y = g; p.vy = 0; p.onGround = true; p.safeFall = false; }
    else if (wasGround && p.vy <= 0 && p.pos.y - g < 0.2 + spd * dt * 1.5) { p.pos.y = g; p.vy = 0; p.onGround = true; } // follow the ground down slopes
    else if (p.pos.y > g + 0.08) p.onGround = false;
    if (G.area.ceilY && p.pos.y + 1.8 > G.area.ceilY) { p.pos.y = G.area.ceilY - 1.8; if (p.vy > 0) p.vy = 0; }
    if (p.onGround && G.area.heightAt && p.pos.y < SEA + 0.1) toNearestLand(p); // came down over the water
  }
  if (running && !fly) p.fat = Math.max(0, p.fat - 6.5 * dt); else p.fat = Math.min(p.maxFat, p.fat + (moving ? 2.5 : 5) * dt);
  if (settings.dbgStamina) p.fat = p.maxFat;
  p.mp = Math.min(p.maxMp, p.mp + 0.1 * dt * (1 + (p.attr.WIL - 50) / 80));
  if (p.drawT < 1) p.drawT = Math.min(1, (p.drawT || 0) + dt * 3.5);
  if (moving && p.onGround && !fly) { p.bob += dt * spd * 1.7; p.stepT -= dt * spd; if (p.stepT <= 0) { p.stepT = 1.9; SFX.play('step'); } }
  // melee
  if (p.swingT >= 0) {
    p.swingT += dt;
    if (!p.hitDone && p.swingT > p.swingDur * 0.45) { p.hitDone = true; resolveMelee(); }
    if (p.swingT > p.swingDur) p.swingT = -1;
  }
  if (p.castT >= 0) {
    p.castT += dt;
    if (!p.castDone && p.castT > 0.22) { p.castDone = true; resolveSpell(); }
    if (p.castT > 0.55) p.castT = -1;
  }
  p.hurtT = Math.max(0, p.hurtT - dt);
  // camera
  const sh = G.shake > 0 ? (Math.random() - 0.5) * G.shake * 0.4 : 0;
  camera.position.set(p.pos.x + sh, p.pos.y + 1.62 + Math.sin(p.bob * 2) * 0.045, p.pos.z);
  camera.rotation.set(p.pitch, p.yaw, 0);
}

function setFlying(on) {
  const p = G.player; if (!p || !!G.flying === on) return;
  G.flying = on; p.vy = 0;
  if (on) { p.onGround = false; msg('You rise into the air. (Debug flight: look and walk to fly, Space rises, X sinks, G lands.)'); }
  else { p.safeFall = true; if (!p.dead) msg('You drift back down to the ground.'); }
}

// the nearest dry ground or pier: you cannot stand on the sea
function toNearestLand(p) {
  const a = G.area;
  for (let r = 2; r < 240; r += 2) for (let k = 0; k < 24; k++) {
    const ang = k / 24 * Math.PI * 2, x = p.pos.x + Math.cos(ang) * r, z = p.pos.z + Math.sin(ang) * r;
    const g = groundAt(a, x, z, 0.38, 40); if (g < SEA + 0.3) continue;
    const q = new THREE.Vector3(x, g, z); collide(a, q, 0.38, g, 1.75); if (Math.hypot(q.x - x, q.z - z) > 0.05) continue;
    p.pos.set(x, g, z); p.vy = 0; msg('You wade out of the water.'); return;
  }
}
function toggleSheathe() {
  const p = G.player; if (!p || p.dead || p.swingT >= 0 || !rpgUI()) return;
  p.sheathed = !p.sheathed; p.drawT = 0; SFX.play('swing');
  msg(p.sheathed ? 'You sheathe your weapon.' : `You draw your ${p.equip.weapon ? p.equip.weapon.name : 'fists'}.`);
}
function startAttack() {
  const p = G.player; if (p.dead || p.swingT >= 0 || p.castT >= 0 || !rpgUI()) return;
  if (p.sheathed) { toggleSheathe(); return; } // the first click draws the weapon
  const w = weaponStats(p.equip.weapon);
  p.swingDur = 0.5 / w.speed * (p.fat <= 0 ? 1.4 : 1); p.swingT = 0; p.hitDone = false; p.swingDir = rnd.pick([1, -1, 0]);
  p.fat = Math.max(0, p.fat - (w.big ? 3 : 2)); SFX.play('swing');
}
function resolveMelee() {
  const p = G.player; const w = weaponStats(p.equip.weapon);
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  let best = null, bs = 1e9;
  for (const e of G.area.entities) {
    if (!e.alive || !e.active || e.role === 'ghost') continue;
    const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; const d = Math.hypot(dx, dz);
    if (d > w.reach + e.radius) continue;
    const dot = d > 0.01 ? (dx * fx + dz * fz) / d : 1; if (dot < 0.72 && d > 0.9) continue;
    if (Math.abs((e.pos.y + (e.fly ? 0.2 : 0.9)) - (p.pos.y + 1.2)) > 2) continue;
    const hostile = enemyTargetHostile(e);
    const score = d + (1 - dot) * 3 + (hostile ? 0 : 5);
    if (score < bs) { bs = score; best = e; }
  }
  if (!best) return;
  const e = best; const def = e.def || { ac: 3 };
  if (def.silver && w.rank < 2) { msg(`Your ${p.equip.weapon ? 'weapon' : 'fist'} passes harmlessly through the ${e.name}. Only silver or better can harm it!`, 'bad'); SFX.play('miss'); e.aggro = true; if (e.kind === 'enemy') e.state = 'chase'; return; }
  const chance = clamp(0.62 + (p.attr.AGI - 50) / 150 + (p.attr.LUC - 50) / 400 + p.level * 0.012 - (def.ac || 0) * 0.03, 0.15, 0.95);
  if (e.kind === 'npc' && !enemyTargetHostile(e) ? true : rnd.next() < chance) {
    let dmg = rnd.int(w.min, w.max) + (w.dmgBonus || 0) + Math.floor((p.attr.STR - 50) / 10) + Math.floor(p.level / 3);
    if (p.fat <= 0) dmg = Math.ceil(dmg / 2);
    if (rnd.next() < 0.05 + (p.attr.LUC - 50) / 500) { dmg = Math.round(dmg * 1.6); msg('Critical strike!', 'good'); }
    dmg = Math.max(1, dmg); SFX.play('hit', e.pos); hurtEntity(e, dmg, true);
    const k = 0.25; e.pos.x += fx * k; e.pos.z += fz * k; collide(e.area, e.pos, e.radius, e.pos.y, 1.6);
  } else { SFX.play('miss'); if (e.kind === 'enemy') { e.aggro = true; e.state = 'chase'; } }
}
function startCast() {
  const p = G.player; if (p.dead || p.castT >= 0 || p.swingT >= 0 || !rpgUI()) return;
  if (!p.spells.length) { msg('You know no spells. The Mages Guild teaches them for a price.'); return; }
  const sp = SPELLS[p.spells[p.spell % p.spells.length]];
  if (p.mp < sp.cost) { msg(`Not enough magicka to cast ${sp.name} (${sp.cost} needed).`, 'bad'); SFX.play('locked'); return; }
  p.mp -= sp.cost; p.castT = 0; p.castDone = false; p.castSpell = p.spells[p.spell % p.spells.length];
}
function resolveSpell() {
  const p = G.player; const k = p.castSpell; const intB = Math.floor((p.attr.INT - 50) / 8);
  const dir = new THREE.Vector3(); camera.getWorldDirection(dir);
  if (k === 'fireball') {
    const from = camera.position.clone().addScaledVector(dir, 0.8); from.y -= 0.2;
    spawnProjectile(G.area, from, dir, { owner: 'player', dmg: [12 + intB, 24 + intB], kind: 'fire', speed: 17, radius: 2.4 });
  } else if (k === 'shock') {
    SFX.play('shock'); let best = null, bd = 4.5;
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    for (const e of G.area.entities) { if (!e.alive || !e.active || e.role === 'ghost') continue; const dx = e.pos.x - p.pos.x, dz = e.pos.z - p.pos.z; const d = Math.hypot(dx, dz); if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.75) { bd = d; best = e; } }
    const px = best ? best.pos.x : p.pos.x + fx * 3, pz = best ? best.pos.z : p.pos.z + fz * 3;
    flashFX(G.area, px, (best ? best.pos.y + best.h * 0.6 : p.pos.y + 1.3), pz, simpleSprite('spark').tex[0], 1.6, 0.3);
    if (best) hurtEntity(best, rnd.int(8 + intB, 16 + intB), true); else msg('The lightning crackles into empty air.');
  } else if (k === 'heal') {
    const h = Math.min(p.maxHp - p.hp, 20 + Math.floor(p.attr.WIL / 4)); p.hp += h; SFX.play('heal'); msg(`Warm light knits your wounds (+${h} health).`, 'good');
    flashFX(G.area, p.pos.x + Math.sin(p.yaw) * -0.8, p.pos.y + 1.2, p.pos.z - Math.cos(p.yaw) * 0.8, simpleSprite('heal').tex[0], 1.2, 0.5);
  }
}

/* ---------------- interaction focus ---------------- */
function computeFocus() {
  const p = G.player; const area = G.area; if (!p || p.dead) return null;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); let best = null, bs = 1e9;
  const consider = (x, z, range, obj, type, cone = 0.55) => {
    const dx = x - p.pos.x, dz = z - p.pos.z; const d = Math.hypot(dx, dz); if (d > range) return;
    const dot = d > 0.2 ? (dx * fx + dz * fz) / d : 1; if (dot < cone) return;
    const s = d + (1 - dot) * 4; if (s < bs) { bs = s; best = { type, obj, d }; }
  };
  for (const e of area.entities) {
    if (!e.active || e.removed) continue;
    if (e.kind === 'npc' && !e.dead && !enemyTargetHostile(e)) consider(e.pos.x, e.pos.z, 3.2, e, 'npc');
    if (e.kind === 'loot') consider(e.pos.x, e.pos.z, 2.6, e, 'loot');
  }
  for (const d of area.doors || []) consider(d.x, d.z, 3.2, d, 'door', 0.4);
  for (const x of area.exits || []) consider(x.x, x.z, 3.2, x, x.kind, 0.4);
  for (const st of area.stops || []) consider(st.x, st.z, 3.4, st, 'stop', 0.3);
  if (area.stalls && !best) for (const [sx, sz] of area.stalls) { /* stall vendors are NPCs */ }
  return best;
}
function interact() {
  const f = G.focus; if (!f) return;
  switch (f.type) {
    case 'npc': UI.openDialog(f.obj); break;
    case 'loot': UI.openLoot(f.obj); break;
    case 'door': tryEnter(f.obj.building); break;
    case 'exit': exitInterior(); break;
    case 'dungeonExit': leaveDungeon(); break;
    case 'stop': UI.openTravel(f.obj); break;
  }
}
function lookedAtBuildingName() {
  const p = G.player; if (G.area.kind !== 'city') return null;
  const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw); let best = null, bd = 18;
  for (const d of G.area.doors) {
    const dx = d.x - p.pos.x, dz = d.z - p.pos.z; const dist = Math.hypot(dx, dz); if (dist > bd) continue;
    if ((dx * fx + dz * fz) / (dist || 1) < 0.93) continue; bd = dist; best = d.building;
  }
  if (best && best.type !== 'house') markDiscovered(best);
  return best;
}
function markDiscovered(b) { const st = G.bState[b.id] || (G.bState[b.id] = {}); if (!st.known) { st.known = true; } }
