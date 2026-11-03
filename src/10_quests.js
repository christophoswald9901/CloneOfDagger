/* =====================================================================
   Quests, rumors and dialogue
   ===================================================================== */

const RUMORS = [
  'They say old King Lysandus walks the streets after dark, howling for vengeance. I bar my door at sunset.',
  "Strange lights flicker in Arkay's graveyard at night. The priests won't speak of it.",
  'The city guard never forgets. Cross them once and they will chase you from here to Wayrest.',
  'Sentinel and Wayrest are circling each other like hungry dogs. War is coming to the Iliac Bay, mark my words.',
  'The Mages Guild sells spells to anyone with coin. Fireballs! In a city built of timber!',
  'Only silver or finer steel will bite a wraith. My uncle learned that the hard way.',
  'The Fighters Guild pays good coin to anyone brave or foolish enough to go into the Catacombs.',
  'Merchants shut their doors at six in the evening. The taverns never close, thank the Divines.',
  'Someone saw a hooded man slip into the old mausoleum. Nobody has seen him come out.',
  'The Underking? A tale to frighten children. ...Is it not?',
  'Sleep in the street and you may wake with a knife in your ribs. If you wake at all. Rent a room.',
  "Don't wander the Warrens after dark. The guard won't, and they're paid to.",
  'The carriages will take you anywhere inside the walls for a few coins. Cheaper than new boots.',
  'The House of Mercy takes in anyone, even Warrens folk. Mother Ysolde is a saint, or mad.',
  'In Kingsward they have hedges trimmed into the shape of griffons. In the Warrens we have rats shaped like rats.',
  "The bell in the Bell Tower cracked during the old king's funeral. Nobody has had the heart to recast it.",
  "They built the memorial to Lysandus on the castle road. Now his ghost walks right past his own statue every night.",
  'Half the cargo in the dockside warehouses never saw a customs clerk. The other half never saw daylight.',
  "Tanners' Row stinks worse than a troll's armpit, but the leather is the best on the Iliac Bay.",
  'Queen Aubk-i hails from Sentinel, you know. Some of the old nobles still grumble about it.',
  "They say Daggerfall is the only city worth seeing on the whole Iliac Bay. Lucky, since it's the only one you'll ever see.",
  'The Emperor sends his agents here and there. Most of them leave in a box.',
  'My cousin swears he found a Daedric dagger in a crypt once. He is a liar, but an entertaining one.',
  'The court mage says the dead king is bound to this world by something. Or someone.',
  'Rats the size of dogs in the Catacombs, I hear. Bats too. And worse.',
  'If the guards come for you, pay your fine at the castle. Or lie low for a day and pray.',
];
const GREET = {
  day: ['Good day to you.', 'Aye? What is it?', 'Make it quick, stranger.', 'Well met, traveler.', "Blessings of Arkay upon you.", 'You are not from around here, are you?', 'Lovely weather for the Iliac Bay.'],
  night: ["It's late. You should be indoors.", 'The dead walk this city at night. Did you know that?', 'Keep your voice down.', 'What do you want at this hour?'],
};

const Quests = {
  mq() { return G.flags.mq || 0; },
  setMQ(n, note) {
    G.flags.mq = n; SFX.play('quest');
    if (note) msg(note, 'quest');
  },
  active() { return G.quests.filter(q => q.status === 'active' || q.status === 'done'); },
  byGiver(g) { return G.quests.find(q => q.giver === g && (q.status === 'active' || q.status === 'done')); },
  generate(giver) {
    const L = G.player.level; const types = giver === 'fighters' ? ['undead', 'bounty'] : giver === 'mages' ? ['deliver', 'fetch'] : ['undead', 'deliver'];
    const type = rnd.pick(types); const id = 'q' + Date.now().toString(36);
    const q = { id, giver, type, status: 'active', day: dayOf(G.time) };
    const giverName = { fighters: 'the Fighters Guild', mages: 'the Mages Guild', temple: 'the Temple of Arkay' }[giver];
    if (type === 'undead') {
      q.need = rnd.int(3, 5); q.count = 0; q.title = giver === 'temple' ? 'Lay the Dead to Rest' : 'Cleanse the Catacombs';
      q.desc = `Destroy ${q.need} undead in the Catacombs beneath the mausoleum in Arkay's graveyard, then report to ${giverName}.`;
      q.reward = { gold: 80 + q.need * 25 + L * 10, xp: 50 + q.need * 12 };
    } else if (type === 'bounty') {
      const g = rnd.chance(0.5) ? 'm' : 'f'; q.target = `${rnd.pick(g === 'm' ? FIRST_M : FIRST_F)} ${rnd.pick(['the Knife', 'Blackhand', 'the Weasel', 'Redcloak', 'the Butcher', 'Quickfingers'])}`;
      const nodes = G.city.nodes.filter(n => ['slum', 'poor', 'harbor', 'crafts'].includes(n.kind) && n.n.length > 1); const n = rnd.pick(nodes); q.node = { x: n.x, z: n.z };
      q.where = `in ${districtAt(n.x, n.z).name}, ${describeDir(MARKET[0], MARKET[1], n.x, n.z, 'the Grand Market')}`;
      q.title = `Bounty: ${q.target}`; q.desc = `The bandit ${q.target} robs travelers after dark ${q.where}. Only shows their face between 8 in the evening and dawn. Kill them and report to ${giverName}.`;
      q.reward = { gold: 180 + L * 25, xp: 90 };
    } else if (type === 'deliver') {
      const cands = G.buildings.filter(b => b.owner && b.owner.look && !b.farm && ['house', 'general', 'weaponsmith', 'armorer', 'alchemist', 'tavern'].includes(b.type));
      const b = rnd.pick(cands); q.targetId = b.id; q.targetName = b.owner.name; q.building = b.name; q.deadline = G.time + 3 * 1440;
      q.itemBase = 'parcel_' + id; q.title = `Deliver to ${b.owner.name}`;
      q.item = giver === 'temple' ? `Healing salve for ${b.owner.name}` : `Sealed parcel for ${b.owner.name}`;
      q.desc = `Deliver the ${q.item.split(' for ')[0].toLowerCase()} to ${b.owner.name} at ${b.name} before ${dateString(q.deadline).split(',').slice(1).join(',').trim()}. ${b.type === 'house' ? 'Residents are home between 6 in the morning and 8 at night.' : ''}`;
      q.reward = { gold: 60 + L * 12, xp: 40 };
      markDiscovered(b);
      addItem(G.player, makeQuestItem(q.itemBase, q.item), true);
    } else {
      const names = giver === 'mages' ? ['the Codex of Vharzal', 'a Welkynd Stone', 'the Tome of Hollow Stars'] : ['the Reliquary of Arkay'];
      q.itemName = rnd.pick(names); q.itemBase = 'relic_' + id; q.title = `Retrieve ${q.itemName}`;
      q.desc = `Recover ${q.itemName} from the Catacombs beneath the mausoleum and bring it to ${giverName}.`;
      q.reward = { gold: 150 + L * 20, xp: 70 };
    }
    if ((type === 'undead' || type === 'fetch') && !hasItem('catakey')) { addItem(G.player, { id: iid(), kind: 'key', base: 'catakey', name: 'Catacombs Key', value: 0 }, true); q.gaveKey = true; }
    G.quests.push(q); SFX.play('quest');
    return q;
  },
  complete(q) {
    q.status = 'complete'; G.player.gold += q.reward.gold; giveXP(q.reward.xp); SFX.play('coin');
    msg(`Quest complete: ${q.title}. You receive ${q.reward.gold} gold.`, 'quest');
  },
  onKill(e) {
    if (e.etype === 'necro') { G.flags.necroDead = true; msg('Vharzal the Necromancer crumples to the floor. The air in the Catacombs grows lighter.', 'quest'); }
    for (const q of this.active()) {
      if (q.status !== 'active') continue;
      if (q.type === 'undead' && e.def && e.def.undead && G.area.kind === 'dungeon') {
        q.count++; if (q.count >= q.need) { q.status = 'done'; msg(`${q.title}: enough undead have been destroyed. Report back.`, 'quest'); SFX.play('quest'); }
        else msg(`${q.title}: ${q.count}/${q.need} undead destroyed.`);
      }
      if (q.type === 'bounty' && e.data.bountyId === q.id) { q.status = 'done'; msg(`${q.target} is dead. Report back for your bounty.`, 'quest'); SFX.play('quest'); }
    }
  },
  onPickup(it) {
    if ((it.base === 'soulgem' || it.base === 'letter') && this.mq() < 2 && hasItem('soulgem') && hasItem('letter')) {
      this.setMQ(2, 'You have recovered the Soul Gem of King Lysandus and the Emperor\'s Letter. Lysandus\'s ghost walks the streets at night — confront him with the gem.');
    }
    for (const q of this.active()) if (q.type === 'fetch' && q.status === 'active' && it.base === q.itemBase) { q.status = 'done'; msg(`You found ${q.itemName}. Return it to ${q.giver === 'mages' ? 'the Mages Guild' : 'the Temple'}.`, 'quest'); SFX.play('quest'); }
  },
  populateDungeon(area, rooms, cs, freeSpot) {
    for (const q of this.active()) {
      if (q.type !== 'fetch' || q.status !== 'active' || hasItem(q.itemBase) || !rooms.length) continue;
      const r = rnd.pick(rooms); const [x, z] = freeSpot(r);
      makeLootPile(area, x, z, 'Dusty Satchel', [makeQuestItem(q.itemBase, q.itemName)], rnd.int(5, 20));
    }
  },
  tick() {
    for (const q of G.quests) {
      if (q.status === 'active' && q.type === 'deliver' && G.time > q.deadline) {
        q.status = 'failed'; const it = hasItem(q.itemBase); if (it) removeItem(G.player, it);
        msg(`You failed to deliver the package to ${q.targetName} in time.`, 'bad');
      }
    }
  },
  cityTick(area) {
    for (const q of this.active()) {
      if (q.type !== 'bounty' || q.status !== 'active') continue;
      const ent = area.entities.find(e => e.data.bountyId === q.id && !e.dead);
      if (isNight(G.time) && !ent) {
        const e = spawnEnemy(area, 'bandit', q.node.x + rnd.range(-2, 2), q.node.z + rnd.range(-2, 2), { name: q.target, wanderR: 6 }); e.data.bountyId = q.id; e.data.night = true;
      } else if (!isNight(G.time) && ent && ent.pos.distanceTo(G.player.pos) > 40) ent.remove();
    }
  },
  mainJournal() {
    switch (this.mq()) {
      case 0: return 'The Emperor has sent me to Daggerfall. I should present myself to King Gothryd at Castle Daggerfall, at the north end of the city, and learn why the ghost of his father haunts the streets.';
      case 1: return "King Gothryd believes a necromancer has bound his father's spirit and stolen the Emperor's letter. The Catacombs lie beneath the old mausoleum in Arkay's Graveyard, behind the Temple of Arkay in the west of the city. The King gave me the key. A carriage from the Grand Market would save my legs.";
      case 2: return 'I carry the Soul Gem of King Lysandus and the Emperor\'s Letter. The ghost walks between 8 in the evening and dawn around the Lysandus Memorial, on the road from the Grand Market to the castle. I must confront him with the gem.';
      case 3: return "King Lysandus is at peace. I should bring the Emperor's Letter to King Gothryd.";
      default: return 'The ghost of Lysandus is at rest and the letter is delivered. Daggerfall is in my debt.';
    }
  },
};

/* ---------------- directions ---------------- */
function describeDir(fx, fz, tx, tz, from = 'here') {
  const dx = tx - fx, dz = tz - fz; const d = Math.hypot(dx, dz);
  const ang = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
  const dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  const dir = dirs[Math.round(ang / 45) % 8];
  if (d < 14) return `right near ${from}`;
  return `${d < 45 ? 'a short walk' : d < 110 ? 'some distance' : 'a long way'} to the ${dir} of ${from}`;
}
function nearestStop(x, z) { let best = null, bd = 1e9; for (const s of G.city.stops || []) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } } return best; }
const WHERE_TOPICS = [
  ['tavern', 'a tavern'], ['general', 'a general store'], ['weaponsmith', 'a weaponsmith'], ['armorer', 'an armorer'], ['alchemist', 'an alchemist'],
  ['temple', 'the Temple of Arkay'], ['hospice', 'the House of Mercy'], ['mages', 'the Mages Guild'], ['fighters', 'the Fighters Guild'], ['castle', 'Castle Daggerfall'], ['mausoleum', 'the Catacombs'],
  ['coach', 'a carriage stop'], ['lm:market', 'the Grand Market'], ['lm:memorial', 'the Lysandus Memorial'], ['lm:garden', "the Queen's Garden"], ['lm:bell', 'the Bell Tower'], ['lm:lighthouse', 'the lighthouse'],
];
function whereIs(npc, type) {
  const origin = G.area.kind === 'city' ? npc.pos : (G.area.building ? { x: G.area.building.door.x, z: G.area.building.door.z } : { x: 0, z: 0 });
  if (type === 'coach') {
    const s = nearestStop(origin.x, origin.z); if (!s) return "I couldn't say.";
    return `The nearest carriage stop is at ${s.name}, ${describeDir(origin.x, origin.z, s.x, s.z)}. Look for the wheel on the signpost.`;
  }
  if (type.startsWith('lm:')) {
    const l = G.city.landmarks.find(q => q.id === type.slice(3)); if (!l) return "I couldn't say.";
    const d = Math.hypot(l.x - origin.x, l.z - origin.z); const q = G.city.districts && districtAt(l.x, l.z);
    return `${capFirst(l.name)} is ${describeDir(origin.x, origin.z, l.x, l.z)}${q ? ', in ' + q.name : ''}.${d > 150 ? ' A carriage would get you there quicker.' : ''}`;
  }
  const opts = G.buildings.filter(b => b.type === type);
  if (!opts.length) return "I couldn't say.";
  if (rnd.chance(0.08)) return rnd.pick(["I'm not from around here myself.", "Couldn't tell you, friend.", 'Ask someone else.']);
  let best = opts[0], bd = 1e9; for (const b of opts) { const d = Math.hypot(b.door.x - origin.x, b.door.z - origin.z); if (d < bd) { bd = d; best = b; } }
  markDiscovered(best);
  const extra = type === 'mausoleum' ? ' The Catacombs lie beneath it. Nobody sane goes down there.' : '';
  const q = best.district && G.city.districts.find(x => x.id === best.district);
  return `${best.name} is ${describeDir(origin.x, origin.z, best.door.x, best.door.z)}${q ? ', in ' + q.name : ''}. I'll mark it on your map.${extra}${bd > 150 ? ' It is a long walk: take a carriage.' : ''}`;
}

// out on the road: what is there to see? The nearest landmark you have not found yet, marked on the map as a rumour
function siteRumor(npc) {
  return { label: 'Anything worth seeing out here?', fn: () => {
    const found = G.flags.found || {}, heard = G.flags.heard || (G.flags.heard = {}), x = npc.pos.x, z = npc.pos.z;
    const left = SITES.filter(S => !found[S.id]).sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const S = left[0] || SITES.slice().sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
    const km = Math.hypot(S.x - x, S.z - z) / 1000; heard[S.id] = true;
    return `"${capFirst(S.name)}? ${capFirst(S.blurb)}. It lies ${describeDir(x, z, S.x, S.z)}, ${km < 1 ? 'not far at all' : `a good ${Math.round(km)} kilometre${Math.round(km) === 1 ? '' : 's'}`}${S.track != null ? '. There is a road' : ''}." (Marked on your map.)`; } };
}
/* ---------------- dialogue ---------------- */
// Returns { title, sub, text, opts:[{label, fn}] }. fn returns new text or null (panel handled elsewhere).
function dialogFor(npc) {
  const P = G.player; const night = isNight(G.time);
  const opts = []; let text = rnd.pick(night ? GREET.night.concat(GREET.day.slice(0, 2)) : GREET.day); let sub = '';
  const where = { label: 'Where is…', fn: () => ({ sub: 'where' }) };
  const rumor = { label: 'Any news?', fn: () => rnd.pick(RUMORS) };
  const b = npc.building;
  // quest hooks
  for (const q of Quests.active()) {
    if (q.type === 'deliver' && q.status === 'active' && b && q.targetId === b.id && npc.data.owner) {
      opts.push({ label: 'Deliver the package', fn: () => { const it = hasItem(q.itemBase); if (it) removeItem(P, it); Quests.complete(q); return `"For me? Ah, I've been expecting this. Here, take this for your trouble — ${q.reward.gold} gold."`; } });
    }
  }
  const guildQuest = (giver) => {
    const q = Quests.byGiver(giver);
    if (q && q.status === 'done') opts.push({ label: 'Report success', fn: () => { if (q.type === 'fetch') { const it = hasItem(q.itemBase); if (it) removeItem(P, it); } Quests.complete(q); return `"Well done. The ${giver === 'temple' ? 'temple' : 'guild'} remembers those who deliver." You receive ${q.reward.gold} gold.`; } });
    else opts.push({ label: 'Ask for work', fn: () => { const cur = Quests.byGiver(giver); if (cur) return `"You already have a task from us: ${cur.title}. Finish it first."`; const nq = Quests.generate(giver); return `"${nq.desc}" (Added to your journal.)${nq.gaveKey ? ' You are given a key to the Catacombs.' : ''}`; } });
  };
  switch (npc.dialog) {
    case 'king': {
      sub = 'King of Daggerfall'; const mq = Quests.mq();
      if (mq === 0) {
        text = '"So, the Emperor\'s agent arrives at last. Welcome to Daggerfall. I would that you had come in happier times."';
        opts.push({ label: 'Ask about the ghost', fn: () => { Quests.setMQ(1, 'Journal updated. The King has given you the Catacombs Key.'); if (!hasItem('catakey')) addItem(P, { id: iid(), kind: 'key', base: 'catakey', name: 'Catacombs Key', value: 0 }, true); return '"My father, King Lysandus, fell at Cryngaine Field. Every night since, his shade stalks these streets crying for vengeance, and my people cower behind their doors. Mynaste — my court mage — believes something holds his spirit here. Something unnatural.\n\nWorse: a letter the Emperor sent to my mother vanished from these very halls. My spies trace both troubles to the Catacombs beneath the mausoleum in Arkay\'s graveyard. A necromancer lurks there, they say.\n\nTake this key. Find the villain. Free my father, and bring me that letter."'; } });
      } else if (mq === 1) text = '"The Catacombs lie beneath the old mausoleum in the graveyard beside the Temple of Arkay, in the south-west of the city. Go with Arkay\'s blessing — and a good blade."';
      else if (mq === 2) text = '"You have the gem? I can almost hear him through it. Go to my father — he walks the streets at night, near the plaza and the castle road. Release him, I beg you."';
      else if (mq === 3) {
        text = '"His voice... it no longer echoes through my halls. My father is at peace?"';
        opts.push({ label: "Hand over the Emperor's Letter", fn: () => { const it = hasItem('letter'); if (it) removeItem(P, it); P.gold += 1500; addItem(P, makeWeapon('longsword', 'daedric'), true); giveXP(400); Quests.setMQ(4); setTimeout(() => UI.openVictory(), 50); return '"The seal is unbroken. You have done what no priest or mage in this city could. Take this gold — and this blade, forged in fires not of this world. Daggerfall will not forget you."'; } });
      } else text = '"Daggerfall owes you a debt, friend. Stay as long as you like. The city is yours."';
      break;
    }
    case 'queen': sub = 'Queen of Daggerfall';
      text = Quests.mq() >= 4 ? '"My husband speaks of little else but your deeds. The court is grateful."' : '"The Emperor\'s letter was meant for my husband\'s mother. What it says is a matter of state — which is to say, a matter of war. Find it."';
      opts.push(rumor); break;
    case 'courtmage': sub = 'Court Mage';
      text = '"The dead king is anchored to our world by a soul gem — a black one. Whoever holds it holds him. Shatter it in his presence and he will finally rest. Mind the wraiths: only silver, finer metals or magic will touch them."';
      opts.push(where); break;
    case 'palaceguard': sub = 'Palace Guard'; text = rnd.pick(['"Keep your hands where I can see them."', '"The King receives petitioners until eight in the evening."', '"Move along."']); opts.push(where); break;
    case 'ghost': {
      sub = 'A restless spirit'; const mq = Quests.mq();
      if (mq < 2) text = '"VENGEANCE! ...The gem... the dark one binds me... beneath Arkay\'s garden... VENGEANCE!"';
      else if (mq === 2 && hasItem('soulgem')) {
        text = 'The ghost of King Lysandus turns towards the gem in your hand. Its hollow eyes burn.';
        opts.push({ label: 'Shatter the soul gem', fn: () => { const it = hasItem('soulgem'); if (it) removeItem(P, it); Quests.setMQ(3, "King Lysandus is at peace. Bring the Emperor's Letter to King Gothryd."); npc.data.fading = 1; giveXP(150); SFX.play('ghost'); return 'The gem cracks with a sound like breaking ice. The ghost sighs, and for a moment you see a tired old man instead of a monster.\n\n"At last... the chains are broken. Tell my son... I am proud. Tell the Emperor... the letter holds the truth..."\n\nHe fades into the night air.'; } });
      } else text = 'The ghost stares through you.';
      break;
    }
    case 'innkeeper': sub = b ? `Proprietor of ${b.name}` : 'Innkeeper';
      text = rnd.pick(['"Welcome, welcome! Sit, drink, be merry — and pay first."', '"A room, a drink, or a rumor? I sell all three."']);
      opts.push({ label: 'Rent a room (15 gold)', fn: () => { if (P.gold < 15) return '"No coin, no bed."'; P.gold -= 15; SFX.play('coin'); UI.close(); startRest('room'); return null; } });
      opts.push({ label: 'Buy a drink (2 gold)', fn: () => { if (P.gold < 2) return '"Come back with coin."'; P.gold -= 2; P.fat = P.maxFat; SFX.play('drink'); return `You drain a mug of ale. "${rnd.pick(RUMORS)}"`; } });
      opts.push(rumor, where); break;
    case 'shop': case 'vendor': sub = b ? `${TYPE_LABEL[b.type]} — ${b.name}` : 'Market vendor';
      text = rnd.pick(['"Take a look. Everything is of the finest quality."', '"Buying or selling?"', '"No haggling. Well — a little haggling."']);
      opts.push({ label: 'Buy', fn: () => { UI.openShop(npc, 'buy'); return null; } }, { label: 'Sell', fn: () => { UI.openShop(npc, 'sell'); return null; } }, where); break;
    case 'priest': sub = 'High Priest of Arkay';
      text = '"Arkay watches over the living and the dead alike. How may the temple serve you?"';
      opts.push({ label: 'Heal my wounds', fn: () => { const miss = P.maxHp - P.hp; if (miss <= 0) return '"You are hale, child. Go in peace."'; const cost = Math.ceil(miss * 0.5 + 5); if (P.gold < cost) return `"The temple asks a donation of ${cost} gold for healing."`; P.gold -= cost; P.hp = P.maxHp; SFX.play('heal'); return `The priest lays hands upon you. You are fully healed. (-${cost} gold)`; } });
      opts.push({ label: 'Buy potions', fn: () => { UI.openShop(npc, 'buy', 'alchemist'); return null; } });
      guildQuest('temple'); opts.push(where); break;
    case 'magister': sub = 'Guild Magister';
      text = '"The Mages Guild welcomes seekers of knowledge — and their gold."';
      opts.push({ label: 'Learn spells', fn: () => { UI.openSpells(npc); return null; } }, { label: 'Buy potions', fn: () => { UI.openShop(npc, 'buy', 'alchemist'); return null; } });
      guildQuest('mages'); opts.push(rumor); break;
    case 'guildmaster': sub = 'Master of the Fighters Guild';
      text = '"Another sword arm looking for coin? Good. We have more trouble than blades."';
      guildQuest('fighters');
      opts.push({ label: `Train (${60 * P.level} gold)`, fn: () => { const st = G.bState.fighters || (G.bState.fighters = {}); if (st.trainDay === dayOf(G.time)) return '"Enough for today. Your arms need rest. Come back tomorrow."'; const cost = 60 * P.level; if (P.gold < cost) return `"Training costs ${cost} gold."`; P.gold -= cost; st.trainDay = dayOf(G.time); const gain = Math.round(xpToNext(P.level) * 0.3); giveXP(gain); P.fat = 0; return `You spar for hours until your arms burn. (+${gain} experience)`; } });
      opts.push(rumor); break;
    case 'healer': sub = 'Healer of the House of Mercy';
      text = rnd.pick(['"Mercy asks no questions and turns no one away. Sit, let me look at you."', '"Another cut, another fever. Where does it hurt?"']);
      opts.push({ label: 'Tend my wounds', fn: () => { const miss = P.maxHp - P.hp; if (miss <= 0) return '"You are healthier than I am. Go on with you."'; const cost = Math.ceil(miss * 0.3 + 3); if (P.gold < cost) return `"We ask ${cost} gold for bandages and herbs. We are not the temple, but we are not rich either."`; P.gold -= cost; P.hp = P.maxHp; SFX.play('heal'); return `She cleans and binds your wounds with practiced hands. You are fully healed. (-${cost} gold)`; } });
      opts.push({ label: 'Rest in a cot (5 gold)', fn: () => { if (P.gold < 5) return '"Five gold for a cot and a blanket. Come back when you have it."'; P.gold -= 5; SFX.play('coin'); UI.close(); startRest('room'); return null; } });
      opts.push({ label: 'Buy remedies', fn: () => { UI.openShop(npc, 'buy', 'alchemist'); return null; } }, rumor, where); break;
    case 'patient': sub = 'A patient';
      text = rnd.pick(['"Mind the bucket. Please."', '"Fell off a roof in the Warrens. The roof fell with me."', '"The Mother says I will walk again. Soon. Probably."', '"Do not drink from Beggar\'s Well. Trust me."', '"Got stabbed on the docks. Over a fish. A fish!"']); opts.push(rumor); break;
    case 'clerk': sub = b ? `Clerk of ${b.name}` : 'Clerk';
      text = rnd.pick(['"Deliveries round the back. Everything here is counted twice."', '"If you are from customs, I have never seen you before in my life."']); opts.push(rumor, where); break;
    case 'servant': sub = 'Household servant'; text = rnd.pick(['"The master is not receiving visitors."', '"Mind the carpet, it came all the way from Sentinel."']); opts.push(rumor, where); break;
    case 'coach': {
      sub = 'Coachman of the Daggerfall Carriage Company'; const stop = G.city.stops.find(s => s.id === npc.data.stop);
      text = rnd.pick(['"Where to? Anywhere inside the walls, if you have the coin."', '"Climb aboard. Mind the horse, he bites."', '"Kingsward, the Docks, the Warrens if you are brave. Name it."']);
      opts.push({ label: 'Travel by carriage', fn: () => { UI.openTravel(stop); return null; } }, rumor, where); break;
    }
    case 'villager': sub = `A villager of ${npc.data.hamlet || 'Mirrormere'}`;
      text = npc.data.hamlet ? rnd.pick(['"Not many come through here. Fewer stop."', '"The harvest was thin this year. The one before, thinner."', '"Follow the track and you will reach Daggerfall, in the end. Everything ends up in Daggerfall."', '"Mind the dog. He is friendlier than he looks. No, wait, the other way round."', `"${npc.data.hamlet}? Five families and a well. Been that way since my grandmother's day."`]) : rnd.pick(['"Mind the jetty, the planks are older than I am."', '"The mere is deep in the middle. Deeper than anyone has swum, my father said."', '"We get pike the length of your arm out of that water. Not many visitors, though."', '"The road down the valley joins the track to Daggerfall, if you keep walking long enough."', '"Chapel bell rings for weddings and funerals. Mostly funerals, lately."']);
      opts.push(siteRumor(npc), rumor); break;
    case 'traveler': sub = npc.data.trade || 'A traveller on the road';
      text = rnd.pick(['"Fair weather for the road, at least."', '"Keep your purse close out here. Not everyone on the road is as honest as me."', '"Long way yet. Always a long way yet."', '"Good day to you, stranger."', '"If you are heading to Daggerfall, the gates shut at no hour, but the guards ask questions after dark."']);
      opts.push(siteRumor(npc), rumor); break;
    case 'bard': sub = 'Traveling bard'; text = '"Care for a song? No? A rumor, then — bards hear everything."'; opts.push(rumor); break;
    case 'resident':
      text = night ? '"What are you doing in my house?! Get out!"' : rnd.pick(['"Can I help you? This is a private home."', '"Did you knock? I didn\'t hear a knock."']); opts.push(rumor, where); break;
    case 'guard': sub = 'City Guard';
      text = rnd.pick(['"Move along, citizen."', '"Keep your blade in its sheath within these walls."', '"I used to adventure like you. Then I took a crossbow bolt to the... never mind."', '"Trouble? Report it at the castle."']);
      opts.push(where, rumor); break;
    default: opts.push(where, rumor);
  }
  if (!['king', 'ghost', 'villager', 'traveler'].includes(npc.dialog) && npc.dialog !== 'guard' && !opts.includes(where) && npc.dialog !== 'bard') opts.push(where);
  return { title: npc.name, sub, text, opts };
}
