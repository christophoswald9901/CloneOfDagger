/* =====================================================================
   Building interiors — generated on entry, lit with baked vertex light
   ===================================================================== */

const INT_MATS = {
  floor: { tex: 'floor' }, flag: { tex: 'flag' }, plaster: { tex: 'plaster' }, timber: { tex: 'timber' }, stone: { tex: 'stone' }, stoneLight: { tex: 'stoneLight' },
  castle: { tex: 'castle' }, marble: { tex: 'marble' }, wood: { tex: 'wood' }, woodDark: { tex: 'woodDark' }, ceiling: { tex: 'ceiling' },
  carpet: { tex: 'carpet' }, carpetBlue: { tex: 'carpetBlue' }, books: { tex: 'books' }, iron: { tex: 'iron' }, cloth: { tex: 'cloth' }, clothRed: { tex: 'clothRed' },
  door: { tex: 'door' }, winLit: { tex: 'winNight' }, banner: { tex: 'banner', double: true }, bannerRed: { tex: 'bannerRed', double: true }, bannerGuild: { tex: 'bannerGuild', double: true },
  brick: { tex: 'brick' }, dirt: { tex: 'dirt' }, timber2: { tex: 'timber2' },
};
function makeLightFn(L) {
  return (p, n) => {
    let r = L.amb[0], g = L.amb[1], b = L.amb[2];
    for (const l of L.lights) {
      const dx = l.p[0] - p[0], dy = l.p[1] - p[1], dz = l.p[2] - p[2]; const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 > l.r * l.r) continue;
      const d = Math.sqrt(d2); const f = 1 - d / l.r; const ndl = d > 0.01 ? Math.max(0, (dx * n[0] + dy * n[1] + dz * n[2]) / d) : 1;
      const k = f * f * l.i * (0.3 + 0.7 * ndl); r += l.c[0] * k; g += l.c[1] * k; b += l.c[2] * k;
    }
    return [Math.min(r, 1.5), Math.min(g, 1.5), Math.min(b, 1.5)];
  };
}
const WARM = [1.0, 0.72, 0.42], BLUE = [0.5, 0.7, 1.0], GREEN = [0.5, 1.0, 0.55];

// A "plan" collects geometry ops (run after all lights are known), colliders, sprites and people.
function makePlan(area) {
  const P = {
    ops: [], sprites: [], people: [], L: { lights: [], amb: [0.3, 0.28, 0.25] },
    op(f) { this.ops.push(f); },
    light(x, y, z, r, i, c = WARM) { this.L.lights.push({ p: [x, y, z], r, i, c }); },
    col(x0, z0, x1, z1, top = 100) { addCol(area, x0, z0, x1, z1, -10, top); },
    box(x0, y0, z0, x1, y1, z1, k, tw = 1, th = 1, o = {}) { this.op(gb => gb.box(x0, y0, z0, x1, y1, z1, k, tw, th, o)); },
    spr(tex, x, y, z, w, h, o = {}) { this.sprites.push({ tex, x, y, z, w, h, o }); },
    person(o) { this.people.push(o); },
  };
  return P;
}
const FURN = {
  table(P, x, z, w = 1.6, d = 0.9, candle = true) {
    P.box(x - w / 2, 0.7, z - d / 2, x + w / 2, 0.8, z + d / 2, { side: 'woodDark', top: 'wood', bottom: 'woodDark' }, 1, 1);
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) P.box(x + lx * (w / 2 - 0.1) - 0.05, 0, z + lz * (d / 2 - 0.1) - 0.05, x + lx * (w / 2 - 0.1) + 0.05, 0.7, z + lz * (d / 2 - 0.1) + 0.05, 'woodDark');
    P.col(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.8);
    if (candle) { P.spr(simpleSprite('candle', 2), x, 0.8, z, 0.18, 0.36, { anim: 4 }); P.light(x, 1.2, z, 4.5, 0.55); }
  },
  bench(P, x, z, w = 1.6, d = 0.4) {
    P.box(x - w / 2, 0.4, z - d / 2, x + w / 2, 0.48, z + d / 2, { side: 'woodDark', top: 'wood' }, 1, 1);
    P.box(x - w / 2 + 0.05, 0, z - 0.05, x - w / 2 + 0.15, 0.4, z + 0.05, 'woodDark'); P.box(x + w / 2 - 0.15, 0, z - 0.05, x + w / 2 - 0.05, 0.4, z + 0.05, 'woodDark');
    P.col(x - w / 2, z - d / 2, x + w / 2, z + d / 2, 0.48);
  },
  counter(P, x0, z0, x1, z1) {
    P.box(x0, 0, z0, x1, 1.0, z1, { side: 'woodDark', top: 'wood' }, 1, 1); P.box(x0 - 0.05, 1.0, z0 - 0.05, x1 + 0.05, 1.08, z1 + 0.05, { side: 'wood', top: 'wood' }, 1, 1);
    P.col(x0, z0, x1, z1, 1.08);
  },
  shelf(P, x0, x1, zWall, dir, h = 2.4, fill = 'bottles') { // shelf against a north/south wall; dir = +1 when wall is at smaller z
    const zf = zWall + dir * 0.45;
    P.box(x0, 0, Math.min(zWall, zf), x1, h, Math.max(zWall, zf), { side: 'woodDark', top: 'woodDark' }, 1, 1, { skip: dir > 0 ? 's' : 'n' });
    for (let y = 0.5; y < h; y += 0.65) P.box(x0, y, Math.min(zWall, zf), x1, y + 0.05, Math.max(zWall, zf) + (dir > 0 ? 0.02 : -0.02), { side: 'wood', top: 'wood' }, 1, 1);
    if (fill) for (let y = 0.55; y < h - 0.3; y += 0.65) for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.8) if (Math.random() < 0.75) P.spr(simpleSprite(fill), x, y, zf - dir * 0.2, 0.7, 0.35);
    P.col(x0, Math.min(zWall, zf), x1, Math.max(zWall, zf));
  },
  bookcase(P, x0, x1, zWall, dir, h = 3) {
    const zf = zWall + dir * 0.5;
    P.box(x0, 0, Math.min(zWall, zf), x1, h, Math.max(zWall, zf), { side: 'woodDark', top: 'woodDark' }, 1, 1, { skip: dir > 0 ? 's' : 'n' });
    P.op(gb => gb.quad('books', dir > 0 ? [x0, 0, zf + 0.001] : [x1, 0, zf - 0.001], dir > 0 ? [1, 0, 0] : [-1, 0, 0], [0, 1, 0], x1 - x0, h, 1.4, 1.4));
    P.col(x0, Math.min(zWall, zf), x1, Math.max(zWall, zf));
  },
  bed(P, x, z, dir = 1) {
    P.box(x - 0.55, 0, z - 1.05, x + 0.55, 0.45, z + 1.05, { side: 'woodDark', top: 'cloth' }, 1, 1);
    P.box(x - 0.45, 0.45, z - dir * 0.95 - 0.2, x + 0.45, 0.6, z - dir * 0.95 + 0.2, { side: 'cloth', top: 'cloth' }, 1, 1);
    P.box(x - 0.55, 0, z - dir * 1.05 - (dir > 0 ? 0.1 : 0), x + 0.55, 1.0, z - dir * 1.05 + (dir > 0 ? 0 : 0.1), 'woodDark');
    P.col(x - 0.55, z - 1.1, x + 0.55, z + 1.1, 0.6);
  },
  barrel(P, x, z) { P.op(gb => { gb.cyl('woodDark', x, z, 0.38, 0, 1.0, 8, 1, 1, { top: 'woodDark' }); }); P.col(x - 0.38, z - 0.38, x + 0.38, z + 0.38, 1.0); },
  crate(P, x, z, s = 0.8) { P.box(x - s / 2, 0, z - s / 2, x + s / 2, s, z + s / 2, { side: 'wood', top: 'wood' }, s, s); P.col(x - s / 2, z - s / 2, x + s / 2, z + s / 2, s); },
  fireplace(P, x, zWall, dir) { // on a north wall (dir=+1)
    const z1 = zWall + dir * 0.8;
    P.box(x - 1.3, 0, Math.min(zWall, z1), x + 1.3, 2.2, Math.max(zWall, z1), { side: 'stone', top: 'stone' }, 2, 2);
    P.box(x - 0.8, 0, z1 - dir * 0.05, x + 0.8, 1.1, z1 + dir * 0.02, { side: 'iron', top: 'iron' }, 1, 1, { skip: 't' });
    P.box(x - 0.6, 2.2, Math.min(zWall, zWall + dir * 0.5), x + 0.6, 6, Math.max(zWall, zWall + dir * 0.5), { side: 'stone', top: 'stone' }, 2, 2);
    P.spr(simpleSprite('fire', 3), x, 0.02, z1 + dir * 0.12, 1.1, 1.1, { anim: 7, bright: true });
    P.light(x, 0.9, z1 + dir * 0.8, 10, 1.25);
    P.col(x - 1.3, Math.min(zWall, z1), x + 1.3, Math.max(zWall, z1));
  },
  pillar(P, x, z, H, key = 'stone', r = 0.45) { P.op(gb => gb.cyl(key, x, z, r, 0, H, 8, 2, 2)); P.col(x - r, z - r, x + r, z + r); },
  brazier(P, x, z) { P.op(gb => { gb.cyl('iron', x, z, 0.12, 0, 0.9, 6, 1, 1); gb.cyl('iron', x, z, 0.4, 0.9, 1.15, 8, 1, 1, { top: 'iron' }); }); P.spr(simpleSprite('fire', 3), x, 1.12, z, 0.9, 0.9, { anim: 7, bright: true }); P.light(x, 1.8, z, 9, 1.1); P.col(x - 0.4, z - 0.4, x + 0.4, z + 0.4); },
  carpet(P, x0, z0, x1, z1, key = 'carpet') { P.op(gb => gb.quad(key, [x0, 0.012, z1], [1, 0, 0], [0, 0, -1], x1 - x0, z1 - z0, x1 - x0, 4, { u0: 0 })); },
  wallBanner(P, x, y, zWall, dir, key = 'banner') { P.op(gb => gb.quad(key, dir > 0 ? [x - 0.8, y, zWall + 0.03] : [x + 0.8, y, zWall - 0.03], dir > 0 ? [1, 0, 0] : [-1, 0, 0], [0, 1, 0], 1.6, 3.2, 1, 1, { fixedUV: true })); },
  sideBanner(P, xWall, y, z, dir, key = 'banner') { P.op(gb => gb.quad(key, dir > 0 ? [xWall + 0.03, y, z + 0.8] : [xWall - 0.03, y, z - 0.8], dir > 0 ? [0, 0, -1] : [0, 0, 1], [0, 1, 0], 1.6, 3.2, 1, 1, { fixedUV: true })); },
};

const INTERIORS = {
  tavern: { w: 16, d: 13, h: 4.4, floor: 'floor', wall: 'timber', ceil: 'ceiling', wains: 'woodDark', amb: [0.28, 0.24, 0.2], music: 'tavern' },
  general: { w: 12, d: 10, h: 4, floor: 'floor', wall: 'plaster', ceil: 'ceiling', wains: 'woodDark', amb: [0.35, 0.32, 0.28] },
  weaponsmith: { w: 12, d: 10, h: 4.4, floor: 'flag', wall: 'stone', ceil: 'ceiling', amb: [0.3, 0.27, 0.24] },
  armorer: { w: 12, d: 10, h: 4.4, floor: 'flag', wall: 'stone', ceil: 'ceiling', amb: [0.3, 0.27, 0.24] },
  alchemist: { w: 12, d: 10, h: 4, floor: 'floor', wall: 'plaster', ceil: 'ceiling', wains: 'woodDark', amb: [0.28, 0.3, 0.26] },
  temple: { w: 14, d: 24, h: 9, floor: 'flag', wall: 'stoneLight', ceil: 'stoneLight', amb: [0.32, 0.3, 0.3], music: 'hall' },
  mages: { w: 16, d: 14, h: 5.5, floor: 'floor', wall: 'stone', ceil: 'ceiling', amb: [0.26, 0.27, 0.34], music: 'hall' },
  fighters: { w: 16, d: 14, h: 5, floor: 'flag', wall: 'stone', ceil: 'ceiling', amb: [0.3, 0.27, 0.24], music: 'hall' },
  castle: { w: 20, d: 34, h: 10, floor: 'flag', wall: 'castle', ceil: 'woodDark', amb: [0.3, 0.28, 0.27], music: 'hall' },
  house: { w: 10, d: 8, h: 3.4, floor: 'floor', wall: 'plaster', ceil: 'ceiling', wains: 'woodDark', amb: [0.3, 0.27, 0.23] },
  manor: { w: 14, d: 11, h: 4.2, floor: 'floor', wall: 'stoneLight', ceil: 'ceiling', wains: 'woodDark', amb: [0.34, 0.31, 0.27] },
  hovel: { w: 7, d: 6, h: 2.9, floor: 'dirt', wall: 'timber2', ceil: 'ceiling', amb: [0.22, 0.2, 0.17] },
  hospice: { w: 18, d: 14, h: 5, floor: 'flag', wall: 'stoneLight', ceil: 'ceiling', amb: [0.36, 0.35, 0.32], music: 'hall' },
  warehouse: { w: 16, d: 12, h: 5, floor: 'floor', wall: 'wood', ceil: 'ceiling', amb: [0.24, 0.22, 0.19] },
};
function interiorCfg(b) {
  if (b.type !== 'house') return INTERIORS[b.type] || INTERIORS.house;
  const w = b.wealth ?? 1.5; return w >= 3 ? INTERIORS.manor : w <= 0.7 ? INTERIORS.hovel : INTERIORS.house;
}

function furnish(P, b, R, rng) {
  const { x0, x1, z0, z1, H } = R; const owner = b.owner || { name: 'Shopkeeper', gender: 'm', look: randomLook(rng, 'm') };
  const keeper = (x, z, dialog, extra = {}) => P.person({ name: owner.name, look: owner.look || randomLook(rng, owner.gender), gender: owner.gender, x, z, role: 'static', dialog, building: b, data: { fixed: true, owner: true }, ...extra });
  switch (b.type) {
    case 'tavern': {
      FURN.counter(P, -5, z0 + 1.7, 3, z0 + 2.4); FURN.shelf(P, -5, 3, z0, 1, 2.4, 'bottles');
      keeper(-1, z0 + 1.05, 'innkeeper');
      FURN.fireplace(P, x1 - 2.2, z0, 1);
      for (const [tx, tz] of [[-4.5, -0.5], [3.5, -0.2], [-4.5, 3.4], [3.5, 3.6]]) { FURN.table(P, tx, tz, 1.8, 0.9); FURN.bench(P, tx, tz - 0.85, 1.8); FURN.bench(P, tx, tz + 0.85, 1.8); }
      FURN.barrel(P, x0 + 0.6, z0 + 0.6); FURN.barrel(P, x0 + 1.5, z0 + 0.6); FURN.barrel(P, x0 + 0.6, z0 + 1.5);
      P.light(0, H - 0.4, 1, 11, 0.7);
      const n = rng.int(3, 5);
      for (let i = 0; i < n; i++) { const g = rng.chance(0.4) ? 'f' : 'm'; P.person({ name: personName(rng, g), look: randomLook(rng, g), gender: g, x: rng.range(-6, 6), z: rng.range(-1.5, 5), role: 'wander', wanderR: 1.5, dialog: 'patron' }); }
      P.person({ name: personName(rng, 'm').split(' ')[0] + ' the Bard', look: LOOKS.bard, spriteKey: 'bard', x: x1 - 1.4, z: 1.5, role: 'static', dialog: 'bard', data: { fixed: true } });
      break;
    }
    case 'general': case 'weaponsmith': case 'armorer': case 'alchemist': {
      FURN.counter(P, -3, z0 + 2.0, 3, z0 + 2.7);
      keeper(0, z0 + 1.2, 'shop');
      if (b.type === 'weaponsmith') {
        for (const x of [-4.5, -2, 2, 4.5]) P.spr(simpleSprite('rack'), x, 1.0, z0 + 0.12, 1.6, 1.6);
        P.op(gb => gb.box(x1 - 2.4, 0, -1.2, x1 - 0.2, 1.1, 1.2, { side: 'stone', top: 'iron' }, 1, 1)); P.col(x1 - 2.4, -1.2, x1 - 0.2, 1.2, 1.1);
        P.spr(simpleSprite('fire', 3), x1 - 1.3, 1.1, 0, 1.0, 1.0, { anim: 7, bright: true }); P.light(x1 - 1.3, 1.6, 0, 9, 1.3);
        P.op(gb => gb.box(-4.8, 0, 1.2, -3.8, 0.8, 1.8, { side: 'iron', top: 'iron' }, 1, 1)); P.col(-4.8, 1.2, -3.8, 1.8, 0.8);
        for (const z of [-1.5, 1.5, 3]) P.spr(simpleSprite('rack'), x0 + 0.12, 1.0, z, 1.4, 1.4);
      } else if (b.type === 'armorer') {
        for (const x of [-4.5, -3, 3, 4.5]) { P.spr(simpleSprite('armorstand'), x, 0, z0 + 0.8, 0.9, 1.85); P.col(x - 0.3, z0 + 0.5, x + 0.3, z0 + 1.1); }
        for (const z of [-1, 1.5]) { P.spr(simpleSprite('armorstand'), x0 + 0.7, 0, z, 0.9, 1.85); P.col(x0 + 0.4, z - 0.3, x0 + 1, z + 0.3); }
        FURN.fireplace(P, x1 - 2.5, z0, 1);
      } else if (b.type === 'alchemist') {
        FURN.shelf(P, -5.5, -3.3, z0, 1, 2.4, 'bottles'); FURN.shelf(P, 3.3, 5.5, z0, 1, 2.4, 'bottles');
        P.op(gb => gb.cyl('iron', x1 - 1.8, 1, 0.6, 0, 0.8, 10, 1, 1, { top: 'iron' })); P.col(x1 - 2.4, 0.4, x1 - 1.2, 1.6, 0.8);
        P.spr(TEX.glowGreen, x1 - 1.8, 0.5, 1, 1.2, 1.2, { additive: true }); P.light(x1 - 1.8, 1.2, 1, 7, 0.9, GREEN);
        FURN.table(P, x0 + 1.5, 1.5, 1.4, 0.8); P.spr(simpleSprite('bottles'), x0 + 1.5, 0.8, 1.5, 0.8, 0.4);
      } else {
        FURN.shelf(P, -5.5, -3.3, z0, 1, 2.4, 'bottles'); FURN.shelf(P, 3.3, 5.5, z0, 1, 2.4, 'bottles');
        FURN.barrel(P, x0 + 0.6, 1); FURN.barrel(P, x0 + 0.6, 2); FURN.crate(P, x1 - 0.6, 1.2); FURN.crate(P, x1 - 0.6, 2.2); FURN.crate(P, x1 - 0.6, 1.7, 0.6);
        P.spr(simpleSprite('sack'), x0 + 1.5, 0, 3, 0.8, 0.64);
      }
      P.light(0, H - 0.5, 0, 9, 0.8);
      break;
    }
    case 'temple': {
      P.box(-2, 0, z0 + 2.4, 2, 1.1, z0 + 3.6, { side: 'marble', top: 'cloth' }, 1, 1); P.col(-2, z0 + 2.4, 2, z0 + 3.6, 1.1);
      P.op(gb => gb.box(-0.8, 0, z0 + 0.3, 0.8, 1.2, z0 + 1.5, { side: 'marble', top: 'marble' }, 1, 1)); P.col(-0.8, z0 + 0.3, 0.8, z0 + 1.5);
      P.spr(simpleSprite('statue'), 0, 1.2, z0 + 0.9, 1.6, 3.2);
      for (const x of [-1.6, -0.6, 0.6, 1.6]) { P.spr(simpleSprite('candle', 2), x, 1.1, z0 + 3.0, 0.2, 0.4, { anim: 3 }); }
      P.light(0, 2, z0 + 3.2, 9, 1.1);
      FURN.carpet(P, -1.2, z0 + 4, 1.2, z1, 'carpet');
      for (let z = z0 + 6.5; z < z1 - 3; z += 2.2) { FURN.bench(P, -3.4, z, 3.2, 0.5); FURN.bench(P, 3.4, z, 3.2, 0.5); }
      for (let z = z0 + 5; z < z1 - 1; z += 5) { FURN.pillar(P, x0 + 1.2, z, H, 'marble', 0.5); FURN.pillar(P, x1 - 1.2, z, H, 'marble', 0.5); }
      FURN.brazier(P, -4.5, z0 + 3); FURN.brazier(P, 4.5, z0 + 3);
      for (let z = z0 + 7.5; z < z1 - 2; z += 5) { FURN.sideBanner(P, x0, 3.5, z, 1, 'bannerRed'); FURN.sideBanner(P, x1, 3.5, z, -1, 'bannerRed'); }
      P.op(gb => { for (let z = z0 + 5; z < z1 - 2; z += 5) { gb.quad('winLit', [x0 + 0.02, 5, z + 0.6], [0, 0, -1], [0, 1, 0], 1.2, 2.4, 1, 1, { fixedUV: true }); gb.quad('winLit', [x1 - 0.02, 5, z - 0.6], [0, 0, 1], [0, 1, 0], 1.2, 2.4, 1, 1, { fixedUV: true }); } });
      keeper(0, z0 + 4.4, 'priest');
      P.person({ name: 'Brother ' + rng.pick(FIRST_M), look: LOOKS.priest, spriteKey: 'priest2', x: -4, z: 2, role: 'wander', wanderR: 3, dialog: 'acolyte' });
      break;
    }
    case 'mages': {
      FURN.carpet(P, -4, z0 + 1, 4, z1 - 1, 'carpetBlue');
      FURN.bookcase(P, x0 + 0.2, -2, z0, 1, 3.2); FURN.bookcase(P, 2, x1 - 0.2, z0, 1, 3.2);
      for (const z of [-3, 1]) P.op(gb => gb.quad('books', [x0 + 0.01, 0, z + 1.5], [0, 0, -1], [0, 1, 0], 3, 3.2, 1.4, 1.4));
      for (const z of [-3, 1]) P.col(x0, z - 1.5, x0 + 0.3, z + 1.5);
      FURN.table(P, -4, 1.5, 1.8, 1, false); P.spr(simpleSprite('orb'), -4, 0.8, 1.5, 0.6, 0.6, { additive: true }); P.light(-4, 1.4, 1.5, 7, 1, BLUE);
      FURN.table(P, 4, 1.5, 1.8, 1, false); P.spr(simpleSprite('orb'), 4, 0.8, 1.5, 0.6, 0.6, { additive: true }); P.light(4, 1.4, 1.5, 7, 1, BLUE);
      FURN.brazier(P, x1 - 1.5, z0 + 2);
      P.light(0, H - 0.6, -1, 11, 0.6, BLUE);
      keeper(0, z0 + 2.6, 'magister');
      P.person({ name: 'Apprentice ' + rng.pick(FIRST_F), look: { ...LOOKS.mage, robe: '#5a2a6a', hair: '#2a1c12' }, spriteKey: 'apprentice', x: 3, z: -2, role: 'wander', wanderR: 3, dialog: 'apprentice' });
      break;
    }
    case 'fighters': {
      for (const x of [-5, -2, 2, 5]) P.spr(simpleSprite('rack'), x, 1.1, z0 + 0.12, 1.6, 1.6);
      for (const z of [-3, 0, 3]) { P.spr(simpleSprite('dummy'), x0 + 2, 0, z, 0.9, 1.8); P.col(x0 + 1.7, z - 0.3, x0 + 2.3, z + 0.3); }
      for (const z of [-2, 2]) { P.spr(simpleSprite('armorstand'), x1 - 0.8, 0, z, 0.9, 1.85); P.col(x1 - 1.1, z - 0.3, x1 - 0.5, z + 0.3); }
      FURN.wallBanner(P, -3.5, 2, z0, 1, 'bannerGuild'); FURN.wallBanner(P, 3.5, 2, z0, 1, 'bannerGuild');
      FURN.brazier(P, -3, z0 + 3); FURN.brazier(P, 3, z0 + 3);
      FURN.table(P, 3, 3, 1.8, 0.9); FURN.bench(P, 3, 2.15, 1.8); FURN.bench(P, 3, 3.85, 1.8);
      keeper(0, z0 + 2.4, 'guildmaster');
      for (let i = 0; i < 2; i++) { const g = rng.chance(0.3) ? 'f' : 'm'; const look = { ...randomLook(rng, g), shirt: '#6a707a', chain: true }; P.person({ name: personName(rng, g), look, gender: g, x: rng.range(-3, 3), z: rng.range(-2, 3), role: 'wander', wanderR: 3, dialog: 'fighter' }); }
      break;
    }
    case 'castle': {
      P.box(-6, 0, z0, 6, 0.3, z0 + 5, { side: 'castle', top: 'carpet' }, 2, 2); P.col(-6, z0, 6, z0 + 5, 0.3);
      P.box(-4, 0.3, z0, 4, 0.6, z0 + 3.4, { side: 'castle', top: 'carpet' }, 2, 2); P.col(-4, z0, 4, z0 + 3.4, 0.6);
      for (const tx of [-1.6, 1.6]) { P.box(tx - 0.6, 0.6, z0 + 0.5, tx + 0.6, 1.1, z0 + 1.5, { side: 'woodDark', top: 'clothRed' }, 1, 1); P.box(tx - 0.6, 0.6, z0 + 0.2, tx + 0.6, 3.2, z0 + 0.5, { side: 'clothRed', top: 'woodDark' }, 1, 1); P.col(tx - 0.6, z0 + 0.2, tx + 0.6, z0 + 1.5); }
      FURN.carpet(P, -1.6, z0 + 5, 1.6, z1, 'carpet');
      for (let z = z0 + 8; z < z1 - 3; z += 6) { FURN.pillar(P, -6, z, H, 'castle', 0.7); FURN.pillar(P, 6, z, H, 'castle', 0.7); }
      for (let z = z0 + 11; z < z1 - 3; z += 6) { FURN.sideBanner(P, x0, 4, z, 1, 'banner'); FURN.sideBanner(P, x1, 4, z, -1, 'banner'); }
      FURN.wallBanner(P, -4.5, 3.5, z0, 1, 'banner'); FURN.wallBanner(P, 4.5, 3.5, z0, 1, 'banner');
      FURN.brazier(P, -5, z0 + 6); FURN.brazier(P, 5, z0 + 6); FURN.brazier(P, -4, z1 - 5); FURN.brazier(P, 4, z1 - 5);
      P.op(gb => { for (let z = z0 + 8; z < z1 - 3; z += 6) { gb.quad('winLit', [x0 + 0.02, 6, z + 0.5], [0, 0, -1], [0, 1, 0], 1, 2.4, 1, 1, { fixedUV: true }); gb.quad('winLit', [x1 - 0.02, 6, z - 0.5], [0, 0, 1], [0, 1, 0], 1, 2.4, 1, 1, { fixedUV: true }); } });
      P.person({ name: 'King Ottmar', look: LOOKS.king, spriteKey: 'king', x: -1.6, z: z0 + 2.3, role: 'static', dialog: 'king', data: { fixed: true } });
      P.person({ name: 'Queen Isabeau', look: LOOKS.queen, spriteKey: 'queen', x: 1.6, z: z0 + 2.3, role: 'static', dialog: 'queen', gender: 'f', data: { fixed: true } });
      for (const [gx, gz] of [[-3, z0 + 9], [3, z0 + 9], [-3, z1 - 6], [3, z1 - 6]]) P.person({ name: 'Palace Guard', look: LOOKS.guard, spriteKey: 'guard', x: gx, z: gz, role: 'static', dialog: 'palaceguard', data: { fixed: true } });
      P.person({ name: 'Court Philosopher Anselm Brandt', look: { ...LOOKS.mage, robe: '#3a1a1a', hair: '#c8c8c8', beard: true, hairStyle: 1 }, spriteKey: 'courtmage', x: 5, z: z0 + 4, role: 'static', dialog: 'courtmage', data: { fixed: true } });
      break;
    }
    case 'hospice': {
      for (let z = z0 + 3; z < z1 - 2; z += 2.6) { FURN.bed(P, x0 + 1.2, z, 1); FURN.bed(P, x1 - 1.2, z, 1); }
      FURN.counter(P, -2.5, z0 + 1.8, 2.5, z0 + 2.5); FURN.shelf(P, -4, 4, z0, 1, 2.4, 'bottles');
      FURN.table(P, 0, 1.5, 1.8, 0.9); P.spr(simpleSprite('bottles'), 0, 0.8, 1.5, 0.8, 0.4);
      FURN.brazier(P, -3.5, 3.5); FURN.brazier(P, 3.5, 3.5);
      P.op(gb => { for (let z = z0 + 3; z < z1 - 2; z += 5) { gb.quad('winLit', [x0 + 0.02, 2.2, z + 0.6], [0, 0, -1], [0, 1, 0], 1.2, 1.8, 1, 1, { fixedUV: true }); gb.quad('winLit', [x1 - 0.02, 2.2, z - 0.6], [0, 0, 1], [0, 1, 0], 1.2, 1.8, 1, 1, { fixedUV: true }); } });
      P.light(0, H - 0.5, 0, 12, 0.7);
      keeper(0, z0 + 1.1, 'healer');
      const sick = ['#c8b8a0', '#b8c0a8', '#c0b0b0'];
      for (let i = 0; i < 3; i++) { const g = rng.chance(0.5) ? 'f' : 'm'; const look = { ...randomLook(rng, g), skin: sick[i], shirt: '#d8d0c0', robe: null, cape: null, hat: null }; P.person({ name: personName(rng, g), look, gender: g, x: (i % 2 ? x1 - 2.3 : x0 + 2.3), z: z0 + 3 + i * 2.6, role: 'static', dialog: 'patient', data: { fixed: true } }); }
      P.person({ name: 'Sister ' + rng.pick(FIRST_F), look: { ...LOOKS.priest, robe: '#3a6a4a', hair: '#8a5a30', hairStyle: 2 }, gender: 'f', spriteKey: 'sister', x: 2, z: 0, role: 'wander', wanderR: 3, dialog: 'acolyte' });
      break;
    }
    case 'warehouse': {
      for (let x = x0 + 1.2; x < x1 - 1; x += 2.2) for (const z of [z0 + 1, z0 + 2.2]) { if (rng.chance(0.2)) continue; const s2 = rng.chance(0.4); P.box(x - 0.5, 0, z - 0.5, x + 0.5, s2 ? 2 : 1, z + 0.5, { side: 'wood', top: 'wood' }, 1, 1); P.col(x - 0.5, z - 0.5, x + 0.5, z + 0.5, s2 ? 2 : 1); }
      for (let z = -1.5; z < z1 - 2; z += 1.2) { FURN.barrel(P, x0 + 0.7, z); if (rng.chance(0.6)) FURN.barrel(P, x0 + 1.6, z); }
      for (let z = -1; z < z1 - 3; z += 1.8) FURN.crate(P, x1 - 1, z, 0.9);
      FURN.table(P, 2, 2, 1.6, 0.9); FURN.bench(P, 2, 2.9, 1.6);
      P.spr(simpleSprite('sack'), -2, 0, 1.5, 0.8, 0.64); P.spr(simpleSprite('sack'), -1.2, 0, 1.9, 0.8, 0.64);
      P.light(0, H - 0.6, 0, 11, 0.6);
      if (hourOf(G.time) >= 6 && hourOf(G.time) < 18) keeper(2, 3.6, 'clerk', { role: 'wander', wanderR: 2, data: { owner: true } });
      const st = G.bState[b.id] || {};
      P.chest = { x: 3.5, z: z0 + 1.8, looted: !!st.looted };
      break;
    }
    default: { // house: furniture follows the owner's purse
      const wealth = b.wealth ?? 1.5; const poor = wealth <= 0.7, rich = wealth >= 3;
      const bx = x1 - 1, bz = z0 + 1.3;
      FURN.bed(P, bx, bz, 1); if ((b.residents || []).length > 1) FURN.bed(P, bx - 1.4, bz, 1);
      if (poor) { FURN.brazier(P, x0 + 1.2, z0 + 1.2); FURN.crate(P, -0.5, 0.8, 0.8); FURN.barrel(P, x0 + 0.5, z1 - 1.4); P.spr(simpleSprite('sack'), x0 + 1.2, 0, 0.5, 0.8, 0.64); }
      else {
        FURN.fireplace(P, x0 + 2.2, z0, 1);
        FURN.table(P, -1, 1.2, 1.4, 0.9); FURN.bench(P, -1, 0.35, 1.4); FURN.bench(P, -1, 2.05, 1.4);
        FURN.shelf(P, -0.2, 1.6, z0, 1, 2.0, 'bottles');
        FURN.barrel(P, x0 + 0.5, z1 - 1.8);
      }
      if (rich) {
        FURN.carpet(P, -3.5, -1.5, 3, 3.5, 'carpet'); FURN.bookcase(P, -3.3, -0.5, z0, 1, 3.2);
        FURN.wallBanner(P, -4.5, 1.6, z1, -1, 'bannerRed'); FURN.table(P, 3.5, 2.2, 1.6, 0.9); FURN.brazier(P, x1 - 0.8, z1 - 1.2);
        if (hourOf(G.time) >= 6 && hourOf(G.time) < 22) { const g = rng.chance(0.5) ? 'f' : 'm'; P.person({ name: personName(rng, g), look: { ...randomLook(rng, g), apron: '#d8d0b8', shirt: '#2a2a2a' }, gender: g, x: 1, z: 3, role: 'wander', wanderR: 2, dialog: 'servant', building: b }); }
      }
      const st = G.bState[b.id] || {};
      P.chest = { x: x1 - 0.7, z: rich ? 0.2 : 1.6, looted: !!st.looted };
      const home = hourOf(G.time) >= 6 && hourOf(G.time) < 20;
      if (home) (b.residents || []).forEach((r, i) => P.person({ name: r.name, look: r.look, gender: r.gender, x: -2 + i * 2, z: 2.6, role: 'wander', wanderR: 1.5, dialog: 'resident', building: b, data: { owner: i === 0, resident: true } }));
    }
  }
}

function buildInterior(b) {
  const area = newArea('interior'); area.building = b; area.name = b.name; area.floorY = 0; area.bbs = [];
  const cfg = interiorCfg(b);
  const rng = new RNG(hashStr(b.id + ':interior'));
  const W = cfg.w, D = cfg.d, H = cfg.h; const x0 = -W / 2, x1 = W / 2, z0 = -D / 2, z1 = D / 2;
  area.ceilY = H; area.music = cfg.music || null;
  const P = makePlan(area); P.L.amb = cfg.amb.slice();
  furnish(P, b, { x0, x1, z0, z1, W, D, H }, rng);
  P.light(0, 2.2, z1 - 1, 5, 0.35);
  const gb = new GB({ sub: 1.25, light: makeLightFn(P.L) });
  gb.quad(cfg.floor, [x0, 0, z1], [1, 0, 0], [0, 0, -1], W, D, 2, 2);
  gb.quad(cfg.ceil, [x0, H, z0], [1, 0, 0], [0, 0, 1], W, D, 2, 2);
  const tw = cfg.wall === 'timber' ? 3.2 : 3;
  gb.quad(cfg.wall, [x0, 0, z0], [1, 0, 0], [0, 1, 0], W, H, tw, tw);
  gb.quad(cfg.wall, [x1, 0, z1], [-1, 0, 0], [0, 1, 0], W, H, tw, tw);
  gb.quad(cfg.wall, [x0, 0, z1], [0, 0, -1], [0, 1, 0], D, H, tw, tw);
  gb.quad(cfg.wall, [x1, 0, z0], [0, 0, 1], [0, 1, 0], D, H, tw, tw);
  if (cfg.wains) {
    gb.quad(cfg.wains, [x0, 0, z0 + 0.02], [1, 0, 0], [0, 1, 0], W, 1.0, 2, 2); gb.quad(cfg.wains, [x1, 0, z1 - 0.02], [-1, 0, 0], [0, 1, 0], W, 1.0, 2, 2);
    gb.quad(cfg.wains, [x0 + 0.02, 0, z1], [0, 0, -1], [0, 1, 0], D, 1.0, 2, 2); gb.quad(cfg.wains, [x1 - 0.02, 0, z0], [0, 0, 1], [0, 1, 0], D, 1.0, 2, 2);
  }
  // ceiling beams
  if (cfg.ceil === 'ceiling') for (let x = x0 + 2; x < x1 - 0.5; x += 3) gb.box(x - 0.15, H - 0.35, z0, x + 0.15, H, z1, { side: 'woodDark', top: null, bottom: 'woodDark' }, 1, 1, { skip: 'nst' });
  // exit door
  gb.box(-1.05, 0, z1 - 0.12, 1.05, 2.85, z1, 'woodDark', 1, 1, { skip: 'sb' });
  gb.quad('door', [0.8, 0, z1 - 0.13], [-1, 0, 0], [0, 1, 0], 1.6, 2.7, 1, 1, { fixedUV: true });
  for (const op of P.ops) op(gb);
  const mats = worldMats(area, Object.fromEntries(Object.entries(INT_MATS).map(([k, v]) => [k, { ...v, tint: false }])));
  area.scene.add(gb.build(mats));
  addCol(area, x0 - 3, z0 - 3, x1 + 3, z0); addCol(area, x0 - 3, z1, x1 + 3, z1 + 3); addCol(area, x0 - 3, z0, x0, z1); addCol(area, x1, z0, x1 + 3, z1);
  // sprites
  const lf = makeLightFn(P.L);
  const brightness = (x, y, z) => { const c = lf([x, y + 0.5, z], [0, 0, 1]); return Math.min(1.2, (c[0] + c[1] + c[2]) / 3 + 0.25); };
  for (const s of P.sprites) {
    const spr = s.tex.tex ? s.tex : null; const tex = spr ? spr.tex[0] : s.tex;
    const m = makeBillboard(tex, s.w, s.h, { additive: s.o.additive }); m.position.set(s.x, s.y, s.z); area.scene.add(m); area.bbs.push(m);
    if (!s.o.additive && !s.o.bright) { const k = brightness(s.x, s.y, s.z); m.material.color.setRGB(k, k * 0.95, k * 0.88); }
    if (s.o.anim && spr) area.anim.push((dt, t) => { m.material.map = spr.tex[Math.floor(t * s.o.anim + s.x) % spr.tex.length]; });
  }
  area.entityLight = (e) => brightness(e.pos.x, 0.8, e.pos.z);
  for (const o of P.people) {
    const e = spawnNPC(area, o); if (o.wanderR) e.wanderR = o.wanderR;
  }
  if (P.chest) {
    const st = G.bState[b.id] || (G.bState[b.id] = {});
    const l = st.looted ? { items: [], gold: 0 } : rollLoot('house', G.player ? G.player.level : 1);
    const w = b.wealth ?? 1.5; l.gold = Math.round(l.gold * (0.35 + w * 0.55)); if (!st.looted && w >= 3) { l.items.push(makeGem(rnd.pick(['ruby', 'emerald', 'sapphire', 'necklace']))); if (rnd.chance(0.4)) l.items.push(makePotion('heal')); }
    if (!st.looted && b.type === 'warehouse') { l.gold += rnd.int(10, 40); for (let i = 0; i < rnd.int(1, 3); i++) l.items.push(makeGem(rnd.pick(['goblet', 'candlestick', 'amethyst']))); }
    const c = makeLootPile(area, P.chest.x, P.chest.z, 'Chest', l.items, l.gold, { chest: true });
    c.owned = b; c.onEmpty = () => { st.looted = true; };
  }
  area.exits = [{ x: 0, z: z1 - 0.2, nx: 0, nz: -1, kind: 'exit' }];
  area.spawn = { x: 0, z: z1 - 1.4, yaw: 0 };
  area.scene.fog = new THREE.Fog(0x0b0906, 14, 48);
  area.scene.background = new THREE.Color(0x0b0906);
  buildColliderGrid(area);
  return area;
}
