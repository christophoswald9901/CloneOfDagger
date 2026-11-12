/* =====================================================================
   Items, spells, races, classes, creatures, loot
   ===================================================================== */

const MATERIALS = {
  iron: { name: 'Iron', dmg: -1, mult: 0.7, rank: 0, col: '#8a8a8a' },
  steel: { name: 'Steel', dmg: 0, mult: 1, rank: 1, col: '#c4c8d0' },
  silver: { name: 'Silver', dmg: 1, mult: 2.2, rank: 2, col: '#eef2fa' },
  blued: { name: 'Blued', dmg: 2, mult: 4, rank: 3, col: '#7a98c8' },
  damascus: { name: 'Damascus', dmg: 3, mult: 6, rank: 4, col: '#b8b0a0' },
  blackened: { name: 'Blackened', dmg: 5, mult: 12, rank: 5, col: '#4a4460' },
  meteoric: { name: 'Meteoric', dmg: 7, mult: 25, rank: 6, col: '#8a3a2a' },
};
const WEAPONS = {
  dagger: { name: 'Dagger', min: 2, max: 5, speed: 1.45, reach: 2.1, price: 20, kind: 'blade' },
  shortsword: { name: 'Shortsword', min: 3, max: 8, speed: 1.25, reach: 2.3, price: 45, kind: 'blade' },
  longsword: { name: 'Longsword', min: 4, max: 11, speed: 1.05, reach: 2.5, price: 95, kind: 'blade' },
  claymore: { name: 'Claymore', min: 6, max: 15, speed: 0.85, reach: 2.7, price: 170, kind: 'blade', big: true },
  mace: { name: 'Mace', min: 3, max: 9, speed: 1.1, reach: 2.3, price: 60, kind: 'blunt' },
  warhammer: { name: 'Warhammer', min: 5, max: 13, speed: 0.85, reach: 2.5, price: 150, kind: 'hammer', big: true },
  battleaxe: { name: 'Battle Axe', min: 5, max: 12, speed: 0.9, reach: 2.5, price: 130, kind: 'axe', big: true },
  staff: { name: 'Staff', min: 2, max: 7, speed: 1.15, reach: 2.6, price: 30, kind: 'staff' },
};
const FISTS = { name: 'Fists', min: 1, max: 3, speed: 1.4, reach: 1.8, kind: 'fist' };
const ARMOR = {
  leather: { name: 'Leather Cuirass', slot: 'body', ac: 2, price: 40 },
  chain: { name: 'Chain Hauberk', slot: 'body', ac: 4, price: 160 },
  plate: { name: 'Plate Cuirass', slot: 'body', ac: 6, price: 420, mat: true },
  cap: { name: 'Leather Cap', slot: 'head', ac: 1, price: 15 },
  coif: { name: 'Chain Coif', slot: 'head', ac: 2, price: 60 },
  helm: { name: 'Helm', slot: 'head', ac: 3, price: 140, mat: true },
  buckler: { name: 'Buckler', slot: 'shield', ac: 1, price: 30 },
  kite: { name: 'Kite Shield', slot: 'shield', ac: 2, price: 90, mat: true },
  tower: { name: 'Tower Shield', slot: 'shield', ac: 3, price: 180, mat: true },
};
const POTIONS = {
  heal: { name: 'Potion of Healing', price: 30, desc: 'Restores 35 health.' },
  spirit: { name: 'Potion of Spirit', price: 35, desc: 'Restores 35 spirit.' },
  stamina: { name: 'Potion of Stamina', price: 15, desc: 'Restores 60 fatigue.' },
};
const GEMS = { ruby: ['Ruby', 120], emerald: ['Emerald', 100], sapphire: ['Sapphire', 90], amethyst: ['Amethyst', 40], ring: ['Silver Ring', 60], necklace: ['Gold Necklace', 150], candlestick: ['Silver Candlestick', 35], goblet: ['Pewter Goblet', 12] };
const SPELLS = {
  fireball: { name: 'Fireball', cost: 18, price: 260, desc: 'Hurls an exploding ball of fire. 12–24 damage to all it engulfs.' },
  shock: { name: 'Shock', cost: 9, price: 120, desc: 'Lightning leaps from your hand to a foe within 4 paces. 8–16 damage.' },
  heal: { name: 'Heal', cost: 14, price: 160, desc: 'Knits flesh and bone. Restores 20 + Willpower/4 health.' },
};

let _itemN = 0;
const iid = () => 'i' + Date.now().toString(36) + (_itemN++);
function makeWeapon(base, mat) { const W = WEAPONS[base], M = MATERIALS[mat]; return { id: iid(), kind: 'weapon', base, mat, name: `${M.name} ${W.name}`, value: Math.round(W.price * M.mult) }; }
function makeArmor(base, mat = 'iron') {
  const A = ARMOR[base]; const M = A.mat ? MATERIALS[mat] : null;
  return { id: iid(), kind: 'armor', base, mat: A.mat ? mat : null, slot: A.slot, name: A.mat ? `${M.name} ${A.name}` : A.name, ac: A.ac + (A.mat ? Math.floor(M.rank / 2) : 0), value: Math.round(A.price * (A.mat ? M.mult : 1)) };
}
function makePotion(k, n = 1) { return { id: iid(), kind: 'potion', base: k, name: POTIONS[k].name, value: POTIONS[k].price, qty: n }; }
function makeGem(k) { return { id: iid(), kind: 'misc', base: k, name: GEMS[k][0], value: GEMS[k][1] }; }
function makeQuestItem(base, name) { return { id: iid(), kind: 'quest', base, name, value: 0 }; }
function weaponStats(it) {
  if (!it) return { ...FISTS, dmgBonus: 0, rank: -1 };
  const W = WEAPONS[it.base], M = MATERIALS[it.mat];
  return { ...W, dmgBonus: M.dmg, rank: M.rank, col: M.col };
}
function itemDesc(it) {
  if (it.kind === 'weapon') { const s = weaponStats(it); return `Damage ${s.min + s.dmgBonus}–${s.max + s.dmgBonus} · Speed ${s.speed.toFixed(2)}${s.rank >= 2 ? ' · harms wraiths' : ''}`; }
  if (it.kind === 'armor') return `${it.slot === 'body' ? 'Body' : it.slot === 'head' ? 'Head' : 'Shield'} · Armor ${it.ac}`;
  if (it.kind === 'potion') return POTIONS[it.base].desc;
  if (it.kind === 'quest') return 'Quest item';
  if (it.kind === 'key') return 'A key';
  return 'Valuables';
}
function randMaterial(level, bias = 0) {
  const r = rnd.next() + level * 0.025 + bias;
  if (r > 1.32) return 'meteoric'; if (r > 1.2) return 'blackened'; if (r > 1.08) return 'damascus'; if (r > 0.96) return 'blued';
  if (r > 0.8) return 'silver'; if (r > 0.42) return 'steel'; return 'iron';
}

/* ---------------- character creation ---------------- */
const ATTRS = ['STR', 'INT', 'WIL', 'AGI', 'END', 'PER', 'SPD', 'LUC'];
const ATTR_NAMES = { STR: 'Strength', INT: 'Intelligence', WIL: 'Willpower', AGI: 'Agility', END: 'Endurance', PER: 'Personality', SPD: 'Speed', LUC: 'Luck' };
const RACES = {
  Townborn: { desc: 'Raised among printers, guild halls and counting-houses. Quick with letters and with figures.', mods: { INT: 10, WIL: 10, STR: -5, AGI: -5 } },
  Marcher: { desc: 'From the border hills, where every farm kept a pike by the door.', mods: { STR: 10, END: 10, SPD: 5, INT: -10, WIL: -5 } },
  Highlander: { desc: 'Hardy folk of the high pastures, who laugh at the cold.', mods: { STR: 10, END: 15, AGI: -5, INT: -10, PER: -5 } },
  Portborn: { desc: 'Grown up on the quays: quick of hand and of temper.', mods: { AGI: 10, SPD: 10, INT: 5, WIL: -10, PER: -10 } },
  Courtborn: { desc: 'Brought up at a noble court among tutors and fencing masters.', mods: { INT: 15, WIL: 5, END: -10, STR: -5 } },
  Forester: { desc: 'From the deep woods: nimble, watchful, a fair shot.', mods: { AGI: 15, SPD: 10, STR: -10, END: -10 } },
  Wanderer: { desc: 'Born on the road among tinkers and players. Lucky, agile, and hard to pin down.', mods: { AGI: 10, SPD: 5, LUC: 10, WIL: -10, END: -5 } },
  Fenlander: { desc: 'From the polders and the reed marshes, tough and swift.', mods: { SPD: 10, END: 10, AGI: 5, PER: -15, INT: -5 } },
};
const CLASSES = {
  Warrior: { desc: 'A master of arms who trusts steel over sorcery.', mods: { STR: 10, END: 10, INT: -10 }, hp: 12, mp: 0.5, gold: 90 },
  Adept: { desc: 'A blade in one hand and lightning in the other.', mods: { STR: 5, INT: 5, WIL: 5 }, hp: 6, mp: 1.1, gold: 100 },
  Scholar: { desc: 'A natural philosopher who burns what cannot be reasoned with.', mods: { INT: 15, WIL: 10, STR: -10, END: -5 }, hp: 0, mp: 2, gold: 120 },
  Thief: { desc: 'Quick hands, soft steps and a knack for locks.', mods: { AGI: 10, SPD: 10, LUC: 10, STR: -5 }, hp: 4, mp: 0.5, gold: 220 },
};
function startingKit(cls) {
  switch (cls) {
    case 'Warrior': return { items: [makeWeapon('longsword', 'steel'), makeArmor('chain'), makeArmor('buckler'), makePotion('heal', 3)], spells: [] };
    case 'Adept': return { items: [makeWeapon('shortsword', 'steel'), makeArmor('leather'), makePotion('heal', 2), makePotion('spirit', 1)], spells: ['shock'] };
    case 'Scholar': return { items: [makeWeapon('staff', 'iron'), makePotion('heal', 2), makePotion('spirit', 2)], spells: ['fireball', 'heal'] };
    default: return { items: [makeWeapon('dagger', 'steel'), makeArmor('leather'), makeArmor('cap'), makePotion('heal', 2), makePotion('stamina', 2)], spells: [] };
  }
}

/* ---------------- creatures ---------------- */
const ENEMIES = {
  rat: { name: 'Giant Rat', hp: 9, dmg: [1, 3], speed: 3.6, reach: 1.4, cd: 1.0, xp: 6, w: 1.1, h: 0.55, radius: 0.3, ac: 2, sight: 14, sprite: 'rat', sound: 'squeak', loot: 'none', corpse: [0.9, 0.3] },
  bat: { name: 'Giant Bat', hp: 10, dmg: [1, 4], speed: 4.8, reach: 1.6, cd: 0.9, xp: 8, w: 1.3, h: 0.65, radius: 0.3, ac: 5, sight: 16, sprite: 'bat', fly: 1.3, sound: 'flap', loot: 'none', noCorpse: true },
  thief: { name: 'Thief', hp: 26, dmg: [2, 7], speed: 3.3, reach: 1.9, cd: 1.2, xp: 22, w: 0.9, h: 1.85, ac: 3, sight: 18, sprite: 'thief', loot: 'thief', bark: ['Your purse or your life!', 'Nobody will miss you, stranger.', 'Empty your pockets!'] },
  bandit: { name: 'Bandit', hp: 55, dmg: [4, 10], speed: 3.4, reach: 2.0, cd: 1.2, xp: 60, w: 0.95, h: 1.9, ac: 5, sight: 20, sprite: 'bandit', loot: 'thief', bark: ['So they sent a hero. How sweet.'] },
  skeleton: { name: 'Skeletal Warrior', hp: 34, dmg: [3, 9], speed: 2.7, reach: 2.0, cd: 1.4, xp: 28, w: 0.9, h: 1.85, ac: 5, sight: 16, sprite: 'skeleton', undead: true, loot: 'skeleton', sound: 'growl' },
  zombie: { name: 'Zombie', hp: 52, dmg: [4, 10], speed: 1.6, reach: 1.9, cd: 1.8, xp: 30, w: 0.95, h: 1.85, ac: 1, sight: 12, sprite: 'zombie', undead: true, loot: 'zombie', sound: 'moan' },
  wraith: { name: 'Wraith', hp: 44, dmg: [5, 12], speed: 3.1, reach: 2.0, cd: 1.5, xp: 60, w: 1.0, h: 2.0, ac: 6, sight: 18, sprite: 'wraith', undead: true, silver: true, transparent: true, opacity: 0.78, fly: 0.25, loot: 'wraith', noCorpse: true, sound: 'ghost' },
  necro: { name: 'Corvin Ash the Necromancer', hp: 150, dmg: [6, 14], speed: 2.5, reach: 2.0, cd: 1.6, xp: 320, w: 0.95, h: 1.95, ac: 6, sight: 22, sprite: 'necro', caster: true, boss: true, loot: 'necro', bark: ['You dare intrude upon my work?', "The old king's soul is MINE!"] },
  guard: { name: 'City Guard', hp: 65, dmg: [5, 12], speed: 4.1, reach: 2.2, cd: 1.3, xp: 30, w: 0.95, h: 1.9, ac: 7, sight: 26, sprite: 'guard', loot: 'guard' },
};

function rollLoot(kind, level) {
  const items = []; let gold = 0; const L = level;
  switch (kind) {
    case 'thief': gold = rnd.int(5, 30) + L * 3; if (rnd.chance(0.3)) items.push(makePotion('heal')); if (rnd.chance(0.2)) items.push(makeWeapon('dagger', randMaterial(L))); if (rnd.chance(0.2)) items.push(makeGem(rnd.pick(['amethyst', 'ring', 'goblet']))); break;
    case 'skeleton': gold = rnd.int(0, 12); if (rnd.chance(0.35)) items.push(makeWeapon(rnd.pick(['shortsword', 'longsword', 'mace', 'battleaxe']), randMaterial(L))); break;
    case 'zombie': gold = rnd.int(0, 15); if (rnd.chance(0.25)) items.push(makeGem(rnd.pick(['amethyst', 'ring', 'candlestick']))); break;
    case 'wraith': gold = rnd.int(10, 40); if (rnd.chance(0.5)) items.push(makeGem(rnd.pick(['ruby', 'emerald', 'sapphire']))); break;
    case 'guard': gold = rnd.int(10, 40); if (rnd.chance(0.3)) items.push(makeWeapon('longsword', 'steel')); break;
    case 'citizen': gold = rnd.int(1, 18); break;
    case 'necro': gold = 250; items.push(makeWeapon('dagger', 'blackened'), makePotion('spirit', 2), makeGem('ruby')); break;
    case 'chest': gold = rnd.int(15, 80) + L * 5; if (rnd.chance(0.5)) items.push(makePotion(rnd.pick(['heal', 'heal', 'spirit', 'stamina']))); if (rnd.chance(0.3)) items.push(makeWeapon(rnd.pick(Object.keys(WEAPONS)), randMaterial(L, 0.1)));
      if (rnd.chance(0.2)) items.push(makeArmor(rnd.pick(Object.keys(ARMOR)), randMaterial(L))); if (rnd.chance(0.4)) items.push(makeGem(rnd.pick(Object.keys(GEMS)))); break;
    case 'house': gold = rnd.int(5, 45); if (rnd.chance(0.45)) items.push(makeGem(rnd.pick(['amethyst', 'ring', 'candlestick', 'necklace', 'goblet']))); if (rnd.chance(0.3)) items.push(makePotion('heal')); break;
  }
  return { items, gold };
}

/* ---------------- shops ---------------- */
const SHOP_BUYS = {
  weaponsmith: ['weapon'], armorer: ['armor'], alchemist: ['potion', 'misc'], general: ['weapon', 'armor', 'potion', 'misc'], vendor: ['potion', 'misc'],
};
function shopStock(b) {
  const st = G.bState[b.id] || (G.bState[b.id] = {}); const day = dayOf(G.time);
  if (st.stockDay === day && st.stock) return st.stock;
  const rng = new RNG(hashStr(b.id) + day * 7919); const stock = []; const L = G.player ? G.player.level : 1;
  const mat = (bias = 0) => { const r = rng.next() + L * 0.02 + bias; return r > 1.25 ? 'blackened' : r > 1.12 ? 'damascus' : r > 1.0 ? 'blued' : r > 0.78 ? 'silver' : r > 0.4 ? 'steel' : 'iron'; };
  const P_ = (k) => { const p = makePotion(k, 1); p.infinite = true; return p; };
  switch (b.type) {
    case 'weaponsmith': for (let i = 0; i < 11; i++) stock.push(makeWeapon(rng.pick(Object.keys(WEAPONS)), mat(0.05))); stock.push(makeWeapon('longsword', 'silver')); break;
    case 'armorer': for (let i = 0; i < 9; i++) stock.push(makeArmor(rng.pick(Object.keys(ARMOR)), mat())); break;
    case 'alchemist': stock.push(P_('heal'), P_('spirit'), P_('stamina')); break;
    case 'vendor': stock.push(P_('heal'), P_('stamina')); for (let i = 0; i < 2; i++) stock.push(makeGem(rng.pick(['amethyst', 'ring', 'goblet']))); break;
    default: stock.push(P_('heal'), P_('stamina')); for (let i = 0; i < 3; i++) stock.push(makeWeapon(rng.pick(['dagger', 'shortsword', 'mace', 'staff']), rng.chance(0.6) ? 'iron' : 'steel'));
      stock.push(makeArmor('leather'), makeArmor('cap'), makeArmor('buckler'));
  }
  st.stock = stock; st.stockDay = day; return stock;
}
function buyPrice(it) { return Math.max(1, Math.round(it.value * (1.25 - (G.player.attr.PER - 50) / 200))); }
function sellPrice(it) { return Math.max(1, Math.round(it.value * (0.45 + (G.player.attr.PER - 50) / 300))); }
