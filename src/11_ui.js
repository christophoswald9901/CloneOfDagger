/* =====================================================================
   UI: HUD canvas, messages, panels (dialogue, shop, character, journal,
   map, rest, pause, settings), title & character creation
   ===================================================================== */

/* ---------------- messages ---------------- */
function msg(text, cls = '') {
  const box = $('msgs'); if (!box) return;
  const d = document.createElement('div'); d.className = 'm' + (cls ? ' m-' + cls : ''); d.textContent = text; box.appendChild(d);
  while (box.children.length > 6) box.removeChild(box.firstChild);
  setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 900); }, 7000);
}
let _bigT = null;
function bigMsg(text, secs = 1.5) {
  const b = $('big'); b.textContent = text; b.classList.add('on');
  clearTimeout(_bigT); _bigT = setTimeout(() => b.classList.remove('on'), secs * 1000);
}
function exitLock() { if (document.pointerLockElement) { Input.expectUnlock = true; document.exitPointerLock(); } }
function requestLock(fromClick) {
  if (Input.fallback || Input.locked || Input.touch || !renderer) return;
  Input.lockFromClick = fromClick;
  try { const r = renderer.domElement.requestPointerLock(); if (r && r.catch) r.catch(() => onLockError()); } catch (e) { onLockError(); }
}
function onLockError() { if (Input.lockFromClick && !Input.everLocked) enableFallback(); }
function enableFallback() {
  if (Input.fallback) return; Input.fallback = true;
  msg('Mouse capture is unavailable here: drag with the mouse to look around, or turn with the arrow keys.');
}

/* ---------------- portraits ---------------- */
const _portraits = new WeakMap();
function portraitOf(e) {
  const tex = e.frames && e.frames[0]; if (!tex || !tex.image) return '';
  if (!_portraits.has(tex)) { try { _portraits.set(tex, tex.image.toDataURL()); } catch (err) { _portraits.set(tex, ''); } }
  return _portraits.get(tex);
}

/* ---------------- panel system ---------------- */
const UI = {
  cur: null,
  open(name, render, opts = {}) {
    this.cur = { name, render, onAct: opts.onAct || null, closable: opts.closable !== false, onClose: opts.onClose || null, leave: opts.leave || null };
    G.uiOpen = true; exitLock(); $('backdrop').hidden = false; this.openedAt = performance.now();
    const p = $('panel'); p.className = 'panel ' + (opts.cls || ''); p.hidden = false; this.render();
    const f = p.querySelector('[autofocus]') || p.querySelector('button'); if (f && opts.focus !== false) setTimeout(() => f.focus({ preventScroll: true }), 0);
  },
  render() { if (!this.cur) return; const p = $('panel'); const st = p.querySelector('.scroll'); const top = st ? st.scrollTop : 0; p.innerHTML = this.cur.render(); const ns = p.querySelector('.scroll'); if (ns) ns.scrollTop = top; },
  close(force = false) {
    if (!this.cur || (!this.cur.closable && !force)) return;
    const cb = this.cur.onClose; $('panel').hidden = true; $('backdrop').hidden = true; this.cur = null; G.uiOpen = false;
    if (cb) cb();
    if (G.state === 'play' && !G.mapOpen) requestLock(false);
  },
  is(name) { return this.cur && this.cur.name === name; },
  // a tap or click outside the panel leaves it: back to the game, or back to the title menu
  leave() { const c = this.cur; if (!c) return; if (c.leave) c.leave(); else if (c.closable) this.close(); },
  // Settings and Controls sit under the pause menu or the title; leaving them in play resumes the game
  subLeave(back) { return () => { if (G.state === 'play') this.close(true); else if (back) back(); else this.close(); }; },
  resumeBtn() { return G.state === 'play' ? '<button class="db primary" data-a="resume">Resume</button>' : ''; },

  /* ---- dialogue ---- */
  openDialog(npc) {
    const d = dialogFor(npc); let text = d.text; let mode = 'main';
    if (npc.dialog === 'ghost') SFX.play('ghost');
    const render = () => {
      let opts;
      if (mode === 'where') opts = WHERE_TOPICS.map(([t, l], i) => `<button class="db" data-a="w${i}">${esc(l[0].toUpperCase() + l.slice(1))}</button>`).join('') + '<button class="db" data-a="back">Back</button>';
      else opts = d.opts.map((o, i) => `<button class="db" data-a="o${i}">${esc(o.label)}</button>`).join('') + '<button class="db" data-a="close">Goodbye</button>';
      return `<div class="dlg"><div class="dlg-head"><img class="portrait" alt="" src="${portraitOf(npc)}"><div><h2>${esc(d.title)}</h2><div class="sub">${esc(d.sub || '')}</div></div></div>
        <div class="dlg-text scroll">${esc(text).replace(/\n/g, '<br>')}</div><div class="dlg-opts">${opts}</div></div>`;
    };
    this.open('dialog', render, {
      cls: 'mid', onAct: (a) => {
        if (a === 'back') { mode = 'main'; this.render(); return; }
        if (a[0] === 'w') { text = `"${whereIs(npc, WHERE_TOPICS[+a.slice(1)][0])}"`; mode = 'main'; this.render(); return; }
        const o = d.opts[+a.slice(1)]; if (!o) return;
        const r = o.fn();
        if (r && typeof r === 'object' && r.sub === 'where') { mode = 'where'; text = '"Where is what, exactly?"'; this.render(); return; }
        if (r === null) return;
        if (typeof r === 'string') { text = r; const nd = dialogFor(npc); d.opts = nd.opts; this.render(); }
      },
    });
  },

  /* ---- shop ---- */
  openShop(npc, mode = 'buy', stockType = null) {
    const P = G.player; const b = npc.building || { id: 'vendor_' + npc.id, type: 'vendor' };
    const sb = stockType ? { id: b.id + '_' + stockType, type: stockType } : b;
    const buys = SHOP_BUYS[sb.type] || SHOP_BUYS.general; let note = '';
    const render = () => {
      const stock = shopStock(sb);
      const rows = mode === 'buy'
        ? stock.map((it, i) => `<div class="row"><div class="nm">${esc(it.name)}<small>${esc(itemDesc(it))}</small></div><div class="pr">${buyPrice(it)} g</div><button class="db sm" data-a="b${i}" ${P.gold < buyPrice(it) ? 'disabled' : ''}>Buy</button></div>`).join('') || '<p class="dim">Sold out for today.</p>'
        : P.inv.map((it, i) => ({ it, i })).filter(({ it }) => buys.includes(it.kind)).map(({ it, i }) => `<div class="row"><div class="nm">${esc(it.name)}${it.qty > 1 ? ' ×' + it.qty : ''}${isEquipped(it) ? ' <em>(equipped)</em>' : ''}<small>${esc(itemDesc(it))}</small></div><div class="pr">${sellPrice(it)} g</div><button class="db sm" data-a="s${i}">Sell</button></div>`).join('') || '<p class="dim">You have nothing this shop will buy.</p>';
      return `<h2>${esc(npc.building ? npc.building.name : npc.name)}</h2><div class="tabs"><button class="db ${mode === 'buy' ? 'on' : ''}" data-a="mbuy">Buy</button><button class="db ${mode === 'sell' ? 'on' : ''}" data-a="msell">Sell</button><span class="gold">${P.gold} gold</span></div>
        <div class="list scroll">${rows}</div><p class="note">${esc(note)}</p><div class="btns"><button class="db" data-a="close">Done</button></div>`;
    };
    this.open('shop', render, {
      cls: 'mid', onAct: (a) => {
        if (a === 'mbuy' || a === 'msell') { mode = a.slice(1); note = ''; this.render(); return; }
        const i = +a.slice(1);
        if (a[0] === 'b') { const stock = shopStock(sb); const it = stock[i]; if (!it) return; const pr = buyPrice(it); if (P.gold < pr) return; P.gold -= pr; if (!it.infinite) stock.splice(i, 1); addItem(P, it.infinite ? makePotion(it.base) : it, true); note = `You bought the ${it.name} for ${pr} gold.`; SFX.play('coin'); }
        if (a[0] === 's') { const it = P.inv[i]; if (!it) return; const pr = sellPrice(it); P.gold += pr; removeItem(P, it); note = `You sold the ${it.name} for ${pr} gold.`; SFX.play('coin'); }
        this.render();
      },
    });
  },
  openSpells(npc) {
    const P = G.player;
    const render = () => `<h2>Arts of the Philosophers’ Society</h2><div class="list scroll">${Object.entries(SPELLS).map(([k, s]) => `<div class="row"><div class="nm">${esc(s.name)} <small>${esc(s.desc)} Costs ${s.cost} spirit.</small></div><div class="pr">${s.price} g</div>${P.spells.includes(k) ? '<span class="dim">Known</span>' : `<button class="db sm" data-a="${k}" ${P.gold < s.price ? 'disabled' : ''}>Learn</button>`}</div>`).join('')}</div>
      <p class="note">Cast your selected spell with Q or the right mouse button. Choose it with 1–3.${P.maxMp < 20 ? ' Your spirit runs thin — consider Potions of Spirit.' : ''}</p><div class="btns"><span class="gold">${P.gold} gold</span><button class="db" data-a="close">Done</button></div>`;
    this.open('spells', render, { cls: 'mid', onAct: (a) => { const s = SPELLS[a]; if (!s || P.gold < s.price || P.spells.includes(a)) return; P.gold -= s.price; P.spells.push(a); SFX.play('levelup'); msg(`You have learned ${s.name}.`, 'good'); this.render(); } });
  },

  /* ---- loot ---- */
  openLoot(e) {
    const P = G.player; let stole = false;
    if (e.gold) { P.gold += e.gold; msg(`You find ${e.gold} gold.`, 'good'); SFX.play('coin'); e.gold = 0; checkTheft(); }
    function checkTheft() {
      if (stole || !e.owned) return; stole = true;
      const witness = G.area.entities.some(x => x.data.resident && x.active && !x.dead);
      if (witness) { msg('The owner sees you rifling through their belongings!', 'bad'); commitCrime('theft'); }
    }
    const render = () => `<h2>${esc(e.name)}</h2><div class="list scroll">${e.items.length ? e.items.map((it, i) => `<div class="row"><div class="nm">${esc(it.name)}${it.qty > 1 ? ' ×' + it.qty : ''}<small>${esc(itemDesc(it))}</small></div><button class="db sm" data-a="t${i}">Take</button></div>`).join('') : '<p class="dim">Nothing of value remains.</p>'}</div>
      <div class="btns">${e.items.length ? '<button class="db" data-a="all">Take all</button>' : ''}<button class="db" data-a="close">Close</button></div>`;
    this.open('loot', render, {
      cls: 'mid', onAct: (a) => {
        if (a === 'all') { for (const it of e.items) addItem(P, it); e.items = []; checkTheft(); }
        else if (a[0] === 't') { const it = e.items.splice(+a.slice(1), 1)[0]; if (it) { addItem(P, it); checkTheft(); } }
        if (!e.items.length && e.onEmpty) e.onEmpty();
        this.render();
      },
    });
  },

  /* ---- character sheet & inventory ---- */
  openCharacter() {
    const P = G.player; let note = '';
    const render = () => {
      const w = weaponStats(P.equip.weapon); const next = xpToNext(P.level);
      const attrs = ATTRS.map(a => `<div class="attr"><span>${ATTR_NAMES[a]}</span><b>${P.attr[a]}</b>${P.points > 0 && P.attr[a] < 100 ? `<button class="db xs" data-a="+${a}" aria-label="Raise ${ATTR_NAMES[a]}">+</button>` : ''}</div>`).join('');
      const eq = ['weapon', 'body', 'head', 'shield'].map(s => `<div class="attr"><span>${{ weapon: 'Weapon', body: 'Body', head: 'Head', shield: 'Shield' }[s]}</span><b>${P.equip[s] ? esc(P.equip[s].name) : '<span class="dim">—</span>'}</b></div>`).join('');
      const spells = P.spells.length ? P.spells.map((k, i) => `<button class="db sm ${P.spell % P.spells.length === i ? 'on' : ''}" data-a="sp${i}">${i + 1}. ${esc(SPELLS[k].name)} (${SPELLS[k].cost})</button>`).join('') : '<span class="dim">No spells known.</span>';
      const inv = P.inv.map((it, i) => `<div class="row"><div class="nm">${esc(it.name)}${it.qty > 1 ? ' ×' + it.qty : ''}${isEquipped(it) ? ' <em>(equipped)</em>' : ''}<small>${esc(itemDesc(it))}${it.value ? ' · worth ' + it.value + 'g' : ''}</small></div>
        ${it.kind === 'potion' ? `<button class="db sm" data-a="u${i}">Drink</button>` : ''}${it.kind === 'weapon' || it.kind === 'armor' ? `<button class="db sm" data-a="u${i}">${isEquipped(it) ? 'Remove' : 'Equip'}</button>` : ''}${it.kind === 'quest' || it.kind === 'key' ? `<button class="db sm" data-a="u${i}">Examine</button>` : `<button class="db sm ghost" data-a="d${i}">Drop</button>`}</div>`).join('') || '<p class="dim">Your pack is empty.</p>';
      return `<div class="sheet"><div class="col"><h2>${esc(P.name)}</h2><div class="sub">Level ${P.level} ${esc(P.race)} ${esc(P.cls)}</div>
        <div class="xpbar"><i style="width:${Math.round(P.xp / next * 100)}%"></i></div><div class="sub">${P.xp} / ${next} experience</div>
        <div class="vitals"><span class="hp">Health ${Math.ceil(P.hp)}/${P.maxHp}</span><span class="mp">Spirit ${Math.floor(P.mp)}/${P.maxMp}</span><span class="ft">Fatigue ${Math.floor(P.fat)}/${P.maxFat}</span></div>
        <div class="attrs">${attrs}</div>${P.points ? `<p class="note good">${P.points} attribute points to spend.</p>` : ''}
        <div class="attr"><span>Armor rating</span><b>${playerAC()}</b></div><div class="attr"><span>Damage</span><b>${w.min + (w.dmgBonus || 0)}–${w.max + (w.dmgBonus || 0)}</b></div><div class="attr"><span>Gold</span><b>${P.gold}</b></div></div>
        <div class="col"><h3>Equipment</h3>${eq}<h3>Spells</h3><div class="spells">${spells}</div><h3>Pack</h3><div class="list scroll">${inv}</div></div></div>
        <p class="note">${esc(note)}</p><div class="btns"><button class="db" data-a="close">Close (I)</button></div>`;
    };
    this.open('char', render, {
      cls: 'wide', onAct: (a) => {
        if (a[0] === '+') { const k = a.slice(1); if (P.points > 0) { P.attr[k]++; P.points--; recalcDerived(P); } }
        else if (a.startsWith('sp')) { P.spell = +a.slice(2); }
        else if (a[0] === 'u') { const it = P.inv[+a.slice(1)]; if (it) useItem(it); }
        else if (a[0] === 'd') { const it = P.inv[+a.slice(1)]; if (it) { removeItem(P, it, it.qty || 1); makeLootPile(G.area, P.pos.x - Math.sin(P.yaw), P.pos.z - Math.cos(P.yaw), 'Dropped items', [it], 0); note = `You drop the ${it.name}.`; } }
        this.render();
      },
    });
  },
  openJournal() {
    const P = G.player;
    const render = () => {
      const act = Quests.active().map(q => `<div class="quest ${q.status}"><h3>${esc(q.title)}${q.status === 'done' ? ' — report back' : ''}</h3><p>${esc(q.desc)}${q.type === 'undead' ? ` (${q.count}/${q.need})` : ''}</p><small>Reward: ${q.reward.gold} gold</small></div>`).join('');
      const old = G.quests.filter(q => q.status === 'complete' || q.status === 'failed').map(q => `<li>${esc(q.title)} — ${q.status}</li>`).join('');
      return `<h2>Journal</h2><div class="scroll journal"><div class="quest main"><h3>The Stadtholder’s Business</h3><p>${esc(Quests.mainJournal())}</p></div>${act}
        ${G.wanted ? `<div class="quest bad"><h3>Wanted</h3><p>The city guard hunts you. Pay your fine of ${G.wanted.fine} gold at Aldhaven Castle, or keep out of sight until ${clockString(G.wanted.until)} on ${dateString(G.wanted.until)}.</p></div>` : ''}
        ${old ? `<h3>Past deeds</h3><ul>${old}</ul>` : ''}</div><div class="btns"><button class="db" data-a="close">Close (J)</button></div>`;
    };
    this.open('journal', render, { cls: 'mid' });
  },
  openRest() {
    const P = G.player;
    if (G.area.kind !== 'interior' && nearbyHostiles(20)) { msg('You cannot rest with enemies nearby.', 'bad'); return; }
    const outside = G.area.kind !== 'interior';
    const render = () => `<h2>Rest</h2><p>${outside ? 'Resting in the open is dangerous. Something may find you.' : 'It is quiet here.'}</p>
      <div class="btns col">${rpgUI() ? '<button class="db" data-a="heal">Rest until healed</button>' : ''}<button class="db" data-a="hour">Rest for one hour</button><button class="db" data-a="dawn">Wait until morning (6:00)</button><button class="db" data-a="dusk">Wait until dusk (20:00)</button><button class="db" data-a="close">Cancel</button></div>`;
    this.open('rest', render, { cls: 'small', onAct: (a) => { this.close(true); startRest(a); } });
  },
  openPause() {
    const hasSave = !!readSave();
    const render = () => `<h2>Paused</h2><div class="btns col"><button class="db" data-a="close">Resume</button><button class="db" data-a="save">Save game</button><button class="db" data-a="load" ${hasSave ? '' : 'disabled'}>Load game</button><button class="db" data-a="controls">Controls</button><button class="db" data-a="settings">Settings</button><button class="db" data-a="quit">Quit to title</button></div>`;
    this.open('pause', render, {
      cls: 'small', onAct: (a) => {
        if (a === 'save') { if (saveGame()) { msg('Game saved.', 'good'); } this.close(); }
        if (a === 'load') loadGame();
        if (a === 'controls') this.openControls(() => this.openPause());
        if (a === 'settings') this.openSettings(() => this.openPause());
        if (a === 'quit') { this.close(true); toTitle(); }
      },
    });
  },
  openControls(back) {
    const rows = [['W A S D', 'Move'], ['Mouse', 'Look (click the view to capture the mouse)'], ['Shift', 'Run'], ['Space', 'Jump'], ['Left click', 'Attack with your weapon (draws it first if sheathed)'], ['Z', 'Draw or sheathe your weapon'], ['Right click / Q', 'Cast selected spell'], ['1 – 3', 'Select spell'], ['E or F', 'Talk, open doors, search corpses and chests'], ['H', 'Drink a healing potion'], ['I or C', 'Character sheet and inventory'], ['J', 'Journal'], ['M', 'Map (mouse wheel zooms)'], ['R', 'Rest or wait'], ['T', 'Hire a carriage (at a stop, or find the nearest one)'], ['G', 'Fly on / off (debug; enable it in Settings). Space rises, X sinks, you fly where you look'], ['F5 / F9', 'Quick save / quick load'], ['N', 'Toggle music'], ['Arrow keys', 'Turn and move without a mouse'], ['Esc', 'Pause menu']];
    const touch = [['Left side', 'Put a thumb down anywhere and push to walk; push to the edge to run'], ['Right side', 'Drag to look around; tap to talk or open what you are facing'], ['Attack', 'Swing your weapon (the first tap draws it). Keep your thumb down and drag to aim'], ['Use', 'Talk, open doors, search corpses and chests (lights up when something is in reach)'], ['Cast', 'Cast the selected spell; Spell switches between spells'], ['Jump', 'Jump, or rise while flying (Down sinks)'], ['Top row', 'Pause menu, map, journal, character sheet, rest and carriages'], ['Rest screen', 'Tap it to stop resting'], ['Menus', 'Tap outside a menu to close it and return to the game']];
    const table = (r) => `<div class="keys">${r.map(([k, v]) => `<kbd>${k}</kbd><span>${v}</span>`).join('')}</div>`;
    this.open('controls', () => `<h2>Controls</h2><div class="scroll" style="max-height:64vh">${Input.touch ? `<h3>Touch</h3>${table(touch)}<h3>Keyboard and mouse</h3>` : ''}${table(rows)}${Input.touch ? '' : `<h3>Touch screens</h3>${table(touch)}`}</div><div class="btns"><button class="db" data-a="back">Back</button>${this.resumeBtn()}</div>`,
      { cls: 'mid', leave: this.subLeave(back), onAct: (a) => { if (a === 'resume') this.close(true); else if (a === 'back') back ? back() : this.close(); }, onClose: null });
  },
  openSettings(back) {
    const render = () => `<h2>Settings</h2><div class="settings scroll">
      <label for="s_px">Pixel size</label><select id="s_px" data-s="pixelScale">${[0, 1, 2, 3, 4].map(v => `<option value="${v}" ${settings.pixelScale === v ? 'selected' : ''}>${v ? v + '×' : 'Auto'}</option>`).join('')}</select>
      <label for="s_sens">Look sensitivity</label><input id="s_sens" type="range" min="0.2" max="3" step="0.1" value="${settings.sens}" data-s="sens">
      <label for="s_fov">Field of view</label><input id="s_fov" type="range" min="55" max="95" step="1" value="${settings.fov}" data-s="fov">
      <label for="s_mus">Music volume</label><input id="s_mus" type="range" min="0" max="1" step="0.05" value="${settings.music}" data-s="music">
      <label for="s_mpause">Pauses between pieces</label><input id="s_mpause" type="checkbox" ${settings.musicPauses ? 'checked' : ''} data-s="musicPauses">
      <label for="s_sfx">Sound volume</label><input id="s_sfx" type="range" min="0" max="1" step="0.05" value="${settings.sfx}" data-s="sfx">
      <label for="s_inv">Invert look Y</label><input id="s_inv" type="checkbox" ${settings.invertY ? 'checked' : ''} data-s="invertY">
      <div class="sub">Interface</div>
      <label for="s_rpg">Show combat and character stats</label><input id="s_rpg" type="checkbox" ${settings.showRPG ? 'checked' : ''} data-s="showRPG">
      <div class="note">Off: a minimal view with no health bars, weapon, attacks, spells or character sheet.</div>
      <label for="s_touch">Touch controls</label><select id="s_touch" data-s="touch">${['Auto', 'Always on', 'Off'].map((l, v) => `<option value="${v}" ${settings.touch === v ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <label for="s_tsz">Touch button size</label><input id="s_tsz" type="range" min="0.7" max="1.4" step="0.05" value="${settings.touchSize}" data-s="touchSize">
      <div class="sub">Debug</div>
      <label for="s_fly">Allow flying</label><input id="s_fly" type="checkbox" ${settings.dbgFly ? 'checked' : ''} data-s="dbgFly">
      <label for="s_stam">Infinite stamina</label><input id="s_stam" type="checkbox" ${settings.dbgStamina ? 'checked' : ''} data-s="dbgStamina">
      <label for="s_nofall">No fall damage</label><input id="s_nofall" type="checkbox" ${settings.dbgNoFall ? 'checked' : ''} data-s="dbgNoFall">
      <label for="s_noclip">No clip (while flying)</label><input id="s_noclip" type="checkbox" ${settings.dbgNoClip ? 'checked' : ''} data-s="dbgNoClip">
      <div class="note">With flying allowed, G takes off and lands. You fly where you look; Space rises, X sinks, Shift is faster.</div></div>
      <div class="btns"><button class="db" data-a="back">Back</button>${this.resumeBtn()}</div>`;
    this.open('settings', render, { cls: 'small', leave: this.subLeave(back), onAct: (a) => { if (a === 'resume') this.close(true); else if (a === 'back') back ? back() : this.close(); } });
  },
  openDeath() {
    const hasSave = !!readSave();
    this.open('death', () => `<h2 class="bad">You have died</h2><p class="story">Your vision darkens. The cold stones of Aldhaven are the last thing you feel.</p>
      <div class="btns col">${hasSave ? '<button class="db" data-a="load">Load last save</button>' : ''}<button class="db" data-a="revive">Wake in the Church of Saint Hallam (lose half your gold)</button><button class="db" data-a="quit">Quit to title</button></div>`,
      { cls: 'small', closable: false, onAct: (a) => { if (a === 'load') loadGame(); if (a === 'revive') { this.close(true); reviveAtTemple(); } if (a === 'quit') { this.close(true); toTitle(); } } });
  },
  openStory(title, text, btn, cb, cls = 'mid') {
    this.open('story', () => `<h2>${esc(title)}</h2><div class="story scroll">${text}</div><div class="btns"><button class="db" data-a="go">${esc(btn)}</button></div>`,
      { cls, closable: false, leave: () => { this.close(true); cb && cb(); }, onAct: (a) => { if (a === 'go') { this.close(true); cb && cb(); } } });
  },
  openVictory() {
    this.openStory('The Ghost Is at Rest', `<p>King Aldwin no longer walks the streets of Aldhaven. The Stadtholder’s letter is in royal hands, and whatever it says will set Merrow Bay on a new course — but that is a story for another city.</p><p>For now, Aldhaven sleeps soundly for the first time in months. Its taverns, halls and Catacombs remain open to you.</p><p class="dim">Thank you for playing <b>Aldhaven: One City</b>, an unofficial tribute.</p>`, 'Keep exploring', null);
  },
  // fast travel on foot: straight on, along the road underfoot, or to a place you know of (by road or across country)
  openFoot() {
    const P = G.player; if (G.area !== G.city) { msg('You can only travel this way out in the open.'); return; }
    const goals = Travel.goals(), road = Travel.roadAhead(P.pos.x, P.pos.z, P.yaw), dir = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(-Math.sin(P.yaw), Math.cos(P.yaw)) * 180 / Math.PI) + 360) % 360 / 45) % 8];
    const s = nearestStop(P.pos.x, P.pos.z), km = d => d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d / 10) * 10 + ' m';
    const render = () => `<h2>Travel on foot</h2><p class="dim">The world runs faster while you travel. Any key, or a tap on the banner, stops you; so does anything worth stopping for.</p>
      <div class="btns col">${Travel.paused ? `<button class="db primary" data-a="resume" autofocus>${Travel.paused.c.mode === 'ahead' ? 'Go on the way you were going' : `Go on to ${esc(Travel.paused.c.name)}`}</button>` : ''}<button class="db" data-a="ahead">Walk straight on (${dir})</button>${road ? `<button class="db" data-a="road">Follow this road to the next fork (${km(road.len)})</button>` : ''}<button class="db" data-a="map">Choose a place on the map</button></div>
      ${goals.length ? `<div class="list scroll">${goals.map((g, i) => `<div class="row"><div class="nm">${esc(g.name)}<small>${esc(g.sub)} · ${km(g.d)} ${describeDir(P.pos.x, P.pos.z, g.x, g.z).replace(/^.* to the /, '').replace(/ of here$/, '')}</small></div><button class="db sm" data-a="r${i}">By road</button><button class="db sm" data-a="s${i}">Straight</button></div>`).join('')}</div>` : '<p class="note">Landmarks you find, or hear of from people on the road, are listed here.</p>'}
      <div class="btns"><span class="dim">Speed</span>${Travel.SPEEDS.map(v => `<button class="db sm${Travel.rate() === v ? ' primary' : ''}" data-a="v${v}">×${v}</button>`).join('')}</div>
      ${s && insideCity(P.pos.x, P.pos.z, -40) ? `<p class="note">Inside the walls the carriages are quicker: the nearest stop is at ${esc(s.name)}, ${describeDir(P.pos.x, P.pos.z, s.x, s.z)}.</p>` : ''}
      <div class="btns"><button class="db" data-a="close">Stay here</button></div>`;
    this.open('foot', render, { cls: 'mid', onAct: (a) => {
      if (a[0] === 'v') { settings.travelSpeed = +a.slice(1); saveSettings(); this.render(); return; }
      if (a === 'map') { G.mapOpen = true; this.close(true); MapView.open(true); return; } // (the map is marked open first, so closing this panel does not capture the mouse again)
      const go = () => { this.close(true); };
      if (a === 'resume') { go(); Travel.resume(); return; }
      if (a === 'ahead') { go(); Travel.ahead(false); return; }
      if (a === 'road') { go(); Travel.ahead(true); return; }
      const g = goals[+a.slice(1)]; if (!g) return; go(); Travel.toward(g.x, g.z, g.name, a[0] === 'r');
    } });
  },
  openTravel(stop) {
    const P = G.player;
    if (G.area.kind !== 'city') { msg('There are no carriages in here.'); return; }
    if (!stop) {
      const s = nearestStop(P.pos.x, P.pos.z);
      if (s && Math.hypot(s.x - P.pos.x, s.z - P.pos.z) < 8) stop = s;
      else { this.openFoot(); return; }
    }
    if (G.wanted) { msg('The coachman takes one look at you and shakes his head. "Not with the guard after you."', 'bad'); return; }
    if (nearbyHostiles(18)) { msg('The horses shy away. You cannot board with enemies nearby.', 'bad'); return; }
    const h = hourOf(G.time); const night = h < 5 || h >= 23;
    const routes = carriageRoutes(stop);
    const render = () => `<h2>Aldhaven Carriage Company</h2><p class="dim">${esc(capFirst(stop.name))} · ${esc(capFirst(districtAt(stop.x, stop.z).name))}${night ? ' · night coach, double fare' : ''}</p>
      <div class="list scroll">${routes.map((r, i) => `<div class="row"><div class="nm">${esc(capFirst(r.stop.name))}<small>${esc(capFirst(districtAt(r.stop.x, r.stop.z).name))} · about ${r.mins} minutes${r.via.length ? ' · via ' + esc(r.via.join(', ')) : ''}</small></div><div class="pr">${r.fare * (night ? 2 : 1)} g</div><button class="db sm" data-a="t${i}" ${P.gold < r.fare * (night ? 2 : 1) ? 'disabled' : ''}>Travel</button></div>`).join('')}</div>
      <p class="note">Fares follow the distance by road. Time passes on the way.</p><div class="btns"><span class="gold">${P.gold} gold</span><button class="db" data-a="foot">Travel on foot</button><button class="db" data-a="close">Stay here</button></div>`;
    this.open('travel', render, { cls: 'mid', onAct: (a) => { if (a === 'foot') { this.openFoot(); return; } const r = routes[+a.slice(1)]; if (!r) return; const fare = r.fare * (night ? 2 : 1); if (P.gold < fare) return; this.close(true); travelBy(stop, r, fare); } });
  },
  openArrest() {
    const P = G.player; const fine = G.wanted.fine;
    this.open('arrest', () => `<h2>Arrested</h2><p class="story">The palace guards seize you the moment you step inside. "Your crimes are known. Pay your fine of ${fine} gold, or spend time in the dungeon."</p>
      <div class="btns col"><button class="db" data-a="pay" ${P.gold < fine ? 'disabled' : ''}>Pay ${fine} gold</button><button class="db" data-a="jail">Serve ${Math.max(1, Math.round(fine / 150))} day(s) in the dungeon</button></div>`,
      { cls: 'small', closable: false, onAct: (a) => {
        if (a === 'pay') { P.gold -= fine; clearWanted('Your fine is paid. The guards will leave you in peace.'); }
        if (a === 'jail') { const days = Math.max(1, Math.round(fine / 150)); G.time += days * 1440; P.hp = P.maxHp; P.fat = P.maxFat; clearWanted(`You serve ${days} day(s) in the castle dungeon. You are free to go.`); }
        this.close(true);
      } });
  },
};
function isEquipped(it) { const e = G.player.equip; return e.weapon === it || e.body === it || e.head === it || e.shield === it; }

/* ---------------- map ---------------- */
const MapView = {
  zoom: 1, view: null, dest: null, ZMIN: 0.035, ZMAX: 6,
  // pick: opened to choose where to travel (starts zoomed out over the country)
  open(pick = false) {
    if (G.area.kind === 'interior') { msg(`You are inside ${G.area.name}. There is no need for a map here.`); return; }
    G.mapOpen = true; G.uiOpen = true; exitLock(); $('mapview').hidden = false; this.view = null; this.dest = null; $('mapdest').hidden = true;
    const P = G.player; if (pick || (G.area === G.city && Math.max(Math.abs(P.pos.x), Math.abs(P.pos.z)) > TG.R)) this.zoom = Math.min(this.zoom, pick ? 0.06 : 0.3);
    this.draw();
    if (Travel.paused && G.area === G.city) { const c = Travel.paused.c, el = $('mapdest'); el.innerHTML = `<span class="nm">${esc(c.mode === 'ahead' ? 'Your walk, paused' : `Your journey to ${c.name}, paused`)}</span><button class="db sm" data-m="resume">Go on</button><button class="db sm" data-m="clear">✕</button>`; el.hidden = false; } // (a paused journey can be taken up from the map too)
  },
  close() { G.mapOpen = false; G.uiOpen = false; $('mapview').hidden = true; $('mapdest').hidden = true; if (G.state === 'play') requestLock(false); },
  setZoom(z) { this.zoom = clamp(z, this.ZMIN, this.ZMAX); this.draw(); },
  // the whole country, shaded, drawn once: sea, lowland, upland, woods, bare rock and snow
  worldImage() {
    if (this._world) return this._world; const N = 300, [c, x] = cnv(N, N), img = x.createImageData(N, N), a = img.data, Wd = WORLD.x1 - WORLD.x0, Hd = WORLD.z1 - WORLD.z0, fm = G.city.forestMask;
    const hh = new Float32Array(N * N); for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) hh[j * N + i] = terrainRaw(WORLD.x0 + (i + 0.5) / N * Wd, WORLD.z0 + (j + 0.5) / N * Hd);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const wx = WORLD.x0 + (i + 0.5) / N * Wd, wz = WORLD.z0 + (j + 0.5) / N * Hd, h = hh[j * N + i], k = (j * N + i) * 4;
      if (h < SEA) { a[k] = 29; a[k + 1] = 52; a[k + 2] = 70; a[k + 3] = 255; continue; }
      const gx = (hh[j * N + Math.min(N - 1, i + 1)] - hh[j * N + Math.max(0, i - 1)]), gz = (hh[Math.min(N - 1, j + 1) * N + i] - hh[Math.max(0, j - 1) * N + i]), sh = clamp(1 - (gx + gz) * 0.012, 0.6, 1.35);
      const TL = wildTreeLine(wx, wz); let r = 74, g = 92, b = 50;
      if (h > TL + 40) { const t = smoothstep(TL + 40, TL + 200, h); r = lerp(96, 120, t); g = lerp(98, 116, t); b = lerp(70, 104, t); }
      if (h > wildSnowLine(wx, wz) + 60) { r = 214; g = 218; b = 224; }
      else if (fm && h < TL && fm(wx, wz, h) > 0.45) { r = 40; g = 62; b = 34; }
      else if (wildCult(wx, wz) > 0.4) { r = 104; g = 104; b = 56; }
      a[k] = r * sh; a[k + 1] = g * sh; a[k + 2] = b * sh; a[k + 3] = 255;
    }
    x.putImageData(img, 0, 0); return (this._world = c);
  },
  // screen → world on the map as last drawn
  toWorld(px, py) { const t = this.tf; if (!t) return null; return [t.cx + (px * t.dpr - t.W / 2) / t.scale, t.cz + (py * t.dpr - t.H / 2) / t.scale]; },
  pick(px, py) {
    const w = this.toWorld(px, py); if (!w || G.area !== G.city) return; const t = this.tf, P = G.player; let best = null, bd = 22 * t.dpr;
    for (const g of Travel.goals()) { const d = Math.hypot((g.x - w[0]) * t.scale, (g.z - w[1]) * t.scale); if (d < bd) { bd = d; best = g; } }
    for (const S of SITES) { const d = Math.hypot((S.x - w[0]) * t.scale, (S.z - w[1]) * t.scale); if (d < bd && ((G.flags.found || {})[S.id] || (G.flags.heard || {})[S.id])) { bd = d; best = { name: S.name, x: S.road[0][0], z: S.road[0][1] }; } }
    this.dest = best ? { ...best } : { name: 'the place you marked', x: w[0], z: w[1] };
    const d = Math.hypot(this.dest.x - P.pos.x, this.dest.z - P.pos.z), el = $('mapdest');
    el.innerHTML = `<span class="nm">${esc(capFirst(this.dest.name))} · ${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m'}</span><button class="db sm" data-m="road">Travel by road</button><button class="db sm" data-m="straight">Go straight there</button><button class="db sm" data-m="clear">✕</button>`;
    el.hidden = false; this.draw();
  },
  go(how) {
    if (how === 'resume') { this.close(); Travel.resume(); return; }
    const D = this.dest; if (how === 'clear' || !D) { this.dest = null; $('mapdest').hidden = true; this.draw(); return; }
    this.close(); Travel.toward(D.x, D.z, D.name, how === 'road');
  },
  draw() {
    const c = $('mapc'); const dpr = Math.min(devicePixelRatio, 2), W = c.width = Math.floor(innerWidth * dpr), H = c.height = Math.floor(innerHeight * dpr);
    const x = c.getContext('2d'); x.fillStyle = '#1b1712'; x.fillRect(0, 0, W, H); const P = G.player;
    const legend = $('maplegend');
    if (G.area.kind === 'dungeon') { this.drawDungeon(x, W, H); legend.textContent = 'The Catacombs — explored passages. The door marks the way out. (M or Esc to close)'; return; }
    const M = G.city.map; const span = 262 / this.zoom; const scale = Math.min(W, H) / (span * 2), region = this.zoom < 0.95;
    let cx = this.zoom > 1.05 ? clamp(P.pos.x, -WORLD_R + span, WORLD_R - span) : 0, cz = this.zoom > 1.05 ? clamp(P.pos.z, -WORLD_R + span, WORLD_R - span) : -30; // unzoomed: the city plus Pilgrim's Rise
    if (region || Math.hypot(P.pos.x, P.pos.z) > 900) { cx = P.pos.x; cz = P.pos.z; } // (out in the country, or in another town, the map is about where you are)
    if (this.view) { cx = this.view[0]; cz = this.view[1]; }
    cx = clamp(cx, WORLD.x0, WORLD.x1); cz = clamp(cz, WORLD.z0, WORLD.z1 + 1000);
    this.tf = { cx, cz, scale, W, H, dpr };
    const X = v => W / 2 + (v - cx) * scale, Z = v => H / 2 + (v - cz) * scale;
    const rect = (x0, z0, x1, z1, col) => { x.fillStyle = col; x.fillRect(X(x0), Z(z0), (x1 - x0) * scale, (z1 - z0) * scale); };
    const poly = (pts, col, stroke) => { x.beginPath(); pts.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.closePath(); if (col) { x.fillStyle = col; x.fill(); } if (stroke) { x.strokeStyle = stroke; x.stroke(); } };
    const circ = (px, pz, r, col) => { x.fillStyle = col; x.beginPath(); x.arc(X(px), Z(pz), Math.max(1, r * scale), 0, 7); x.fill(); };
    const line = (pts, w, col) => { x.strokeStyle = col; x.lineWidth = Math.max(1, w * scale); x.lineCap = 'round'; x.lineJoin = 'round'; x.beginPath(); pts.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.stroke(); };
    if (!M.relief) M.relief = terrainMapImage(420, (wx, wz) => G.city.forestMask && G.city.forestMask(wx, wz) > 0.45 ? [38, 56, 32] : null);
    x.fillStyle = '#1d3446'; x.fillRect(0, 0, W, H); x.imageSmoothingEnabled = true;
    if (this.zoom < 1.6) x.drawImage(this.worldImage(), X(WORLD.x0), Z(WORLD.z0), (WORLD.x1 - WORLD.x0) * scale, (WORLD.z1 - WORLD.z0) * scale);
    x.drawImage(M.relief, X(-TG.R), Z(-TG.R), TG.R * 2 * scale, TG.R * 2 * scale);
    // out in the country: rivers, tracks and the roads to the landmarks
    for (const R of LAND.rivers) { if (Math.max(...R.w) < (region ? 4 : 2)) continue; x.strokeStyle = '#2e5a78'; x.lineCap = 'round'; x.lineJoin = 'round'; x.lineWidth = Math.max(1, (region ? 2.4 : 1) * Math.max(1, R.w[R.w.length - 1] * scale)); x.beginPath(); R.P.forEach(([px, pz], q) => { if (q % 4 && q !== R.P.length - 1) return; q ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz)); }); x.stroke(); }
    { // the generated country's fields (block by block from afar, strip by strip close to), the houses of its villages and hamlets
      const FC = { fWheat: '#8a7a3a', fBarley: '#76783e', fPlowed: '#5a4630', fGreens: '#3e5a2c', fMeadow: '#4e6630' }, vx0 = cx - W / 2 / scale, vx1 = cx + W / 2 / scale, vz0 = cz - H / 2 / scale, vz1 = cz + H / 2 / scale;
      if (scale > 0.05) for (const o of Settle.blocksIn(vx0, vz0, vx1, vz1)) {
        if (scale < 0.35) { poly(obbCorners(o), FC[Settle.cropOf(o, 0)]); continue; }
        for (let k = 0; k < o.n; k++) { const lx = -o.hx + o.pw / 2 + k * (o.pw + 2.4); poly(obbCorners({ ...o, x: xfP(o, lx, 0)[0], z: xfP(o, lx, 0)[1], hx: o.pw / 2 }), FC[Settle.cropOf(o, k)]); }
      }
      if (scale > 0.12) { for (const h of Settle.housesIn(vx0, vz0, vx1, vz1)) poly(obbCorners(mkObb(h.x, h.z, h.ang, 4.5, 3.5)), '#6e5a44'); for (const b of Settle.builds) if (b.x > vx0 && b.x < vx1 && b.z > vz0 && b.z < vz1) poly(obbCorners(mkObb(b.x, b.z, b.ang, 7.5, 4.6)), '#8a8478');
        for (const f of Settle.farms) if (f.x > vx0 && f.x < vx1 && f.z > vz0 && f.z < vz1) { const FX = makeXf(f.x, f.z, f.ang); for (const [lx, lz, hx, hz, a] of [[-4, 3, 5, 3.5, 0], [6, -5, 6, 4.5, Math.PI / 2]]) { const [px, pz] = xfP(FX, lx, lz); poly(obbCorners(mkObb(px, pz, f.ang + a, hx, hz)), '#6e5a44'); } } }
    }
    for (const T of Wild.tracks) { if (T.cls && (T.lane || T.cls.includes(WAY.road))) { // by kind of way: the high roads broad and pale, the lanes thin (a lane carrying a village's traffic is drawn as a track)
        const sty = [['#8a7350', 4, 1.5], ['#b39c6c', 6.5, 2.4], ['#7d6a4a', 2.6, 1], ['#6f7448', 2.2, 1]];
        for (let q = 3; q < T.length + 2; q += 3) { const a = Math.min(q - 3, T.length - 1), b = Math.min(q, T.length - 1); if (a === b) break; const k = T.cls[b], [col, w, mw] = sty[k]; if (k >= 2 && scale < 0.08) continue;
          x.strokeStyle = col; x.lineWidth = Math.max(mw, w * scale); x.lineCap = 'round'; x.beginPath(); x.moveTo(X(T[a][0]), Z(T[a][1])); x.lineTo(X(T[b][0]), Z(T[b][1])); x.stroke(); }
        continue; }
      x.strokeStyle = '#8a7350'; x.lineWidth = Math.max(1.5, 4 * scale); x.setLineDash(region ? [] : [6, 4]); x.beginPath(); T.forEach(([px, pz], q) => { if (q % 3 && q !== T.length - 1) return; q ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz)); }); x.stroke(); x.setLineDash([]); }
    const FCOL = { fWheat: '#8a7a3a', fBarley: '#76783e', fPlowed: '#5a4630', fGreens: '#3e5a2c', fMeadow: '#4e6630' };
    for (const f of M.fields) poly(f.poly, FCOL[f.key] || '#5a5a30');
    poly(WALL_PTS, 'rgba(74,69,60,0.86)');
    for (const pts of M.outside) line(pts, 6, '#6a5a40');
    for (const pts of M.lanes) line(pts, 3, '#6a5a40');
    line(M.hillPath, 2, '#7a6a4a');
    poly(G.city.marketPoly, '#6e675a'); circ(MEMORIAL[0], MEMORIAL[1], 13, '#6e675a'); circ(-120, 14, 10, '#625c50'); circ(M.bell[0], M.bell[1], 12, '#6e675a'); circ(M.well[0], M.well[1], 8, '#5e584c'); circ(M.fish[0], M.fish[1], 8.5, '#5e584c');
    circ(M.garden[0], M.garden[1], 20, '#3d5a2c'); circ(M.garden[0], M.garden[1], 5, '#1d3446');
    const gy = G.city.graveyard; rect(gy.x0, gy.z0, gy.x1, gy.z1, '#3d4a2c'); poly(G.city.fightersYard, '#5a4a36');
    const roads = M.roads.slice().sort((a, b) => b[5] - a[5]);
    for (const [ax, az, bx, bz, w, lvl] of roads) line([[ax, az], [bx, bz]], w, lvl === 0 ? '#9a917e' : lvl === 1 ? '#857c6a' : '#716a5c');
    for (const px of M.piers) rect(px - 2, SHORE, px + 2, M.pierEnd, '#7a5634'); rect(M.breakwater - 2, SHORE, M.breakwater + 2, 206, '#6e675a'); circ(M.breakwater, 210, 4.5, '#c8c0a8');
    poly(G.city.castleWalls, '#4e4a44', '#8a8070');
    const COL = { tavern: '#d88a3a', general: '#d8c050', weaponsmith: '#c0c4cc', armorer: '#8aa0c0', alchemist: '#6ac070', temple: '#f0f0e0', mages: '#6a8ae8', fighters: '#d85a4a', castle: '#b070d0', mausoleum: '#909090', hospice: '#e8e8c8', warehouse: '#8a7050' };
    const labels = []; const fs = Math.round(Math.max(15, Math.min(W, H) / 42));
    for (const b of G.buildings) {
      if (!b.poly) continue; const known = (G.bState[b.id] || {}).known; const special = b.type !== 'house' && b.type !== 'warehouse';
      poly(b.poly, special && known ? COL[b.type] : b.type === 'warehouse' ? '#45382a' : '#3a3128');
      if (special && known) { const c = b.poly.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]); labels.push([b.name, X(c[0]), Z(c[1]) - 6, null, fs]); }
    }
    for (const [tx, tz] of G.city.castleTowers) { x.fillStyle = (G.bState.castle || {}).known ? COL.castle : '#3a3128'; x.beginPath(); x.arc(X(tx), Z(tz), 4.5 * scale, 0, 7); x.fill(); }
    x.strokeStyle = '#8a8070'; x.lineWidth = Math.max(2, 3 * scale); x.lineCap = 'butt'; x.beginPath(); WALL_PTS.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.stroke();
    { const xs = [WALL_PTS[0][0], ...M.piers.flatMap(p => [p - 4.5, p + 4.5]), WALL_PTS[WALL_PTS.length - 1][0]]; x.beginPath(); for (let i = 0; i < xs.length; i += 2) { x.moveTo(X(xs[i]), Z(SHORE + 0.5)); x.lineTo(X(xs[i + 1]), Z(SHORE + 0.5)); } x.stroke(); } // the sea wall, open at each pier
    for (const [px, pz] of WALL_PTS) circ(px, pz, 4.6, '#8a8070');
    if (this.zoom >= 0.45) for (const g of G.city.gates) circ(g.x, g.z, 3, '#c8a860');
    if (this.zoom >= 0.45) for (const st of G.city.stops) { x.fillStyle = '#e8c860'; x.strokeStyle = '#1b1712'; x.lineWidth = 2; x.beginPath(); x.arc(X(st.x), Z(st.z), Math.max(4, 2.2 * scale), 0, 7); x.fill(); x.stroke(); if (this.zoom >= 2) labels.push(['Carriage: ' + capFirst(st.name), X(st.x), Z(st.z) + fs, '#e8c860', Math.round(fs * 0.8)]); }
    for (const d of M.labels) labels.push([d.name.toUpperCase(), X(d.x), Z(d.z), 'rgba(232,216,168,0.55)', Math.round(fs * 1.25)]);
    for (const l of G.city.landmarks) if (!l.id.endsWith('gate') || this.zoom >= 1.5) labels.push([capFirst(l.name), X(l.x), Z(l.z) - 8, '#d8cca8', Math.round(fs * 0.9)]);
    // quest markers
    const markers = [];
    const mq = Quests.mq();
    const bld = id => G.buildings.find(b => b.id === id);
    if (mq === 0 || mq === 3) markers.push([bld('castle').door, 'King Ottmar']);
    if (mq === 1 && !G.flags.necroDead) markers.push([bld('mausoleum').door, 'The Catacombs']);
    if (mq === 2) markers.push([G.city.memorial, 'The ghost (at night)']);
    for (const q of Quests.active()) {
      if (q.status === 'done') { const gb = bld(q.giver === 'temple' ? 'temple' : q.giver); if (gb) markers.push([gb.door, 'Report: ' + q.title]); }
      else if (q.type === 'deliver') { const b = bld(q.targetId); if (b) markers.push([b.door, q.targetName]); }
      else if (q.type === 'bounty') markers.push([q.node, q.target + ' (night)']);
      else markers.push([bld('mausoleum').door, q.title]);
    }
    const t = performance.now() / 300;
    if (this.zoom >= 0.45) for (const [p, l] of markers) { x.fillStyle = '#ffd24a'; x.beginPath(); x.arc(X(p.x), Z(p.z), 5 + Math.sin(t) * 1.5, 0, 7); x.fill(); x.strokeStyle = '#1b1712'; x.lineWidth = 2; x.stroke(); labels.push([l, X(p.x), Z(p.z) - 10, '#ffd24a', fs]); }
    if (this.zoom < 0.45) { labels.length = 0; labels.push(['Aldhaven', X(0), Z(-10), '#efe2b8', Math.round(fs * 1.2)]); }
    // the towns: moat, walls, canal, streets and squares, their great buildings named once the town is found
    for (const T of TOWNS) { const C = T.cfg, f = (G.flags.found || {})[T.id], P2 = (u, v) => { const [wx, wz] = T.w(u, v); return [X(wx), Z(wz)]; };
      const poly = (pts, close) => { x.beginPath(); pts.forEach(([u, v], i) => { const [a, b] = P2(u, v); i ? x.lineTo(a, b) : x.moveTo(a, b); }); if (close) x.closePath(); };
      x.strokeStyle = '#2e5a78'; x.lineWidth = Math.max(1.5, C.moat.w * scale); poly(T.offPoly(C.moat.off + C.moat.w / 2), true); x.stroke();
      x.fillStyle = 'rgba(74,69,60,0.55)'; poly(T.wall, true); x.fill();
      if (this.zoom > 0.12) { for (const b of T.blocks) if (b.use === 'square' || b.use === 'market' || b.use === 'parvis' || b.use === 'plein' || b.use === 'chapel') { x.fillStyle = '#6e675a'; poly(b.poly, true); x.fill(); } else if (b.use === 'cathedral' || b.use === 'citadel' || b.use === 'hall') { x.fillStyle = '#4e4a44'; poly(b.poly, true); x.fill(); }
        for (const s of T.streets) { if (s.nopave) continue; const [a, b] = P2(s.u0, s.v0), [c, d] = P2(s.u1, s.v1); x.strokeStyle = s.main ? '#9a917e' : s.quay ? '#857c6a' : '#7a7262'; x.lineWidth = Math.max(1, s.w * scale); x.beginPath(); x.moveTo(a, b); x.lineTo(c, d); x.stroke(); }
        x.strokeStyle = '#2e5a78'; x.lineWidth = Math.max(1, C.canal.w * scale); poly(T.canal, false); x.stroke(); }
      x.strokeStyle = '#8a8070'; x.lineWidth = Math.max(1.5, C.wall.t * scale); poly(T.wall, true); x.stroke();
      if (f) { if (this.zoom >= 0.3) for (const l of T.landmarks) if (!l.gate || this.zoom >= 1) labels.push([capFirst(l.name), X(l.x), Z(l.z) - 6, '#d8cca8', Math.round(fs * 0.85)]);
 }
      if (this.zoom < 0.3) labels.push([T.name, X(T.x), Z(T.z) - 8, '#efe2b8', Math.round(fs * 1.1)]); } // (the big towns are known by name from the start)
    // the landmarks you know of, the places you have come upon, the way you are going
    const found = G.flags.found || {}, heard = G.flags.heard || {};
    for (const S of SITES) { if ((!found[S.id] && !heard[S.id]) || (S.kind === 'town' && found[S.id])) continue; const px = X(S.x), pz = Z(S.z), r = Math.max(5, 7 * dpr);
      x.fillStyle = found[S.id] ? '#e8d8a8' : 'rgba(232,216,168,0.45)'; x.strokeStyle = '#1b1712'; x.lineWidth = 2; x.beginPath(); x.moveTo(px, pz - r); x.lineTo(px + r, pz); x.lineTo(px, pz + r); x.lineTo(px - r, pz); x.closePath(); x.fill(); x.stroke();
      labels.push([S.name.replace(/^the /, 'The ') + (found[S.id] ? '' : ' ?'), px, pz - r - 6, found[S.id] ? '#efe2b8' : '#b8a888', Math.round(fs * 0.95)]); }
    for (const p of POI.list) if (POI.found(p)) { circ(p.x, p.z, Math.max(2.5 * dpr, 4) / scale, '#c8a860'); if (this.zoom > 0.25) labels.push([capFirst(p.name.replace(/^an? /, '')), X(p.x), Z(p.z) - 8, '#c8b890', Math.round(fs * 0.75)]); }
    if (Travel.cur || Travel.paused) { const pts = (Travel.cur || Travel.paused.c).pts; x.strokeStyle = '#ffd24a'; x.lineWidth = Math.max(2, 2 * dpr); x.setLineDash([8, 6]); x.beginPath(); pts.forEach(([px, pz], q) => q ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); x.stroke(); x.setLineDash([]); }
    if (this.dest) { const px = X(this.dest.x), pz = Z(this.dest.z); x.strokeStyle = '#ffd24a'; x.lineWidth = 3; x.beginPath(); x.moveTo(px - 9, pz - 9); x.lineTo(px + 9, pz + 9); x.moveTo(px + 9, pz - 9); x.lineTo(px - 9, pz + 9); x.stroke(); }
    x.textAlign = 'center';
    for (const [l, lx, lz, col, size] of labels) { x.font = `${size || fs}px VT323, monospace`; x.fillStyle = '#000'; x.fillText(l, lx + 1, lz + 1); x.fillStyle = col || '#efe2b8'; x.fillText(l, lx, lz); }
    this.arrow(x, X(P.pos.x), Z(P.pos.z), P.yaw, Math.max(8, 10 * Math.sqrt(this.zoom)));
    legend.textContent = G.area.kind !== 'city' ? '' : region ? `The country round Aldhaven — landmarks you know of are marked. ${Input.touch ? 'Drag to look around, tap a place to travel there; + and − zoom.' : 'Drag to look around, click a place to travel there; wheel or + / − zoom. (M or Esc to close)'}`
      : 'Aldhaven — gold wheels are carriage stops, buildings you know are named, yellow marks your objectives. ' + (Input.touch ? 'Zoom with + and −; tap a place to travel there.' : 'Wheel or + / − to zoom; click a place to travel there. (M or Esc to close)');
  },
  drawDungeon(x, W, H) {
    const D = G.area.dg; const cell = Math.floor(Math.min(W, H) * 0.9 / D.N); const ox = (W - cell * D.N) / 2, oz = (H - cell * D.N) / 2; const P = G.player;
    for (let j = 0; j < D.N; j++) for (let i = 0; i < D.N; i++) { if (!D.visited[i + j * D.N] || D.grid[i + j * D.N]) continue; x.fillStyle = '#6e675a'; x.fillRect(ox + i * cell, oz + j * cell, cell + 0.5, cell + 0.5); }
    const e = G.area.exits[0]; x.fillStyle = '#d88a3a'; x.fillRect(ox + e.x / D.cs * cell - cell * 0.3, oz + e.z / D.cs * cell - cell * 0.2, cell * 0.6, cell * 0.3);
    this.arrow(x, ox + P.pos.x / D.cs * cell, oz + P.pos.z / D.cs * cell, P.yaw, cell * 0.7);
  },
  arrow(x, px, pz, yaw, s) {
    x.save(); x.translate(px, pz); x.rotate(-yaw); x.fillStyle = '#ff4a3a'; x.strokeStyle = '#000'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(0, -s); x.lineTo(s * 0.6, s * 0.7); x.lineTo(0, s * 0.35); x.lineTo(-s * 0.6, s * 0.7); x.closePath(); x.fill(); x.stroke(); x.restore();
  },
};

/* ---------------- HUD canvas ---------------- */
const _wArt = new Map();
function weaponArt(it) {
  const key = it ? it.base + ':' + it.mat : 'fist'; if (_wArt.has(key)) return _wArt.get(key);
  const [c, x] = cnv(80, 80); const s = weaponStats(it); const col = s.col || '#c0c4cc';
  const dx = -0.6, dz = -0.8; const px = 0.8, pz = -0.6; const bx = 56, by = 58;
  const dot = (X, Y, cc, r = 1) => { x.fillStyle = cc; x.fillRect(Math.round(X - r / 2), Math.round(Y - r / 2), r, r); };
  const shaft = (len, w, cc, from = 0) => { for (let t = from; t < len; t += 0.5) for (let k = -w / 2; k <= w / 2; k += 0.5) dot(bx + dx * t + px * k, by + dz * t + pz * k, cc, 1); };
  switch (s.kind) {
    case 'blade': {
      const len = { dagger: 26, shortsword: 38, longsword: 50, claymore: 60 }[it.base] || 44; const w = it.base === 'claymore' ? 6 : it.base === 'dagger' ? 4 : 5;
      for (let t = 4; t < len; t += 0.5) { const ww = t > len - 7 ? w * (len - t) / 7 : w; for (let k = -ww / 2; k <= ww / 2; k += 0.5) dot(bx + dx * t + px * k, by + dz * t + pz * k, k < -ww / 4 ? sh(col, 1.25) : k > ww / 4 ? sh(col, 0.7) : col); }
      for (let k = -8; k <= 8; k += 0.5) { dot(bx + dx * 4 + px * k, by + dz * 4 + pz * k, '#c8a040', 2); }
      shaft(4, 3, '#4a2c16', -8); break;
    }
    case 'blunt': shaft(36, 3, '#5a3a1e', -6); for (let a = 0; a < 6.28; a += 0.35) for (let r = 0; r < 7; r += 0.5) dot(bx + dx * 38 + Math.cos(a) * r, by + dz * 38 + Math.sin(a) * r, r > 5 ? sh(col, 0.7) : col); for (let a = 0; a < 6.28; a += 0.8) dot(bx + dx * 38 + Math.cos(a) * 9, by + dz * 38 + Math.sin(a) * 9, col, 2); break;
    case 'hammer': shaft(44, 3, '#5a3a1e', -6); for (let t = 38; t < 48; t += 0.5) for (let k = -9; k <= 9; k += 0.5) dot(bx + dx * t + px * k, by + dz * t + pz * k, t > 46 ? sh(col, 0.7) : col); break;
    case 'axe': shaft(46, 3, '#5a3a1e', -6); for (let t = 34; t < 46; t += 0.5) for (let k = 0; k <= 12 - Math.abs(t - 40) * 0.8; k += 0.5) dot(bx + dx * t + px * k, by + dz * t + pz * k, k > 9 ? sh(col, 1.3) : col); break;
    case 'staff': shaft(66, 3, '#6a4a2a', -14); for (let r = 0; r < 4; r += 0.5) for (let a = 0; a < 6.28; a += 0.4) dot(bx + dx * 66 + Math.cos(a) * r, by + dz * 66 + Math.sin(a) * r, '#8a6a3a'); break;
    default: break;
  }
  // fist and sleeve
  const skin = '#e0b088';
  x.fillStyle = '#3a2e24'; x.fillRect(58, 66, 22, 14); x.fillStyle = '#2a2018'; x.fillRect(58, 66, 22, 2);
  x.fillStyle = skin; x.fillRect(48, 54, 16, 13); x.fillRect(50, 52, 12, 2);
  for (let k = 0; k < 4; k++) { x.fillStyle = sh(skin, 1.12); x.fillRect(49, 54 + k * 3, 4, 1); x.fillStyle = sh(skin, 0.72); x.fillRect(48, 56 + k * 3, 11, 1); }
  x.fillStyle = sh(skin, 0.9); x.fillRect(57, 53, 6, 5); x.fillStyle = sh(skin, 1.15); x.fillRect(58, 53, 4, 1);
  x.fillStyle = sh(skin, 0.8); x.fillRect(62, 56, 2, 11);
  outline(c); _wArt.set(key, c); return c;
}
function drawHUD() {
  const c = hudCanvas, x = hudCtx; const W = c.width, H = c.height; x.clearRect(0, 0, W, H);
  if (G.state !== 'play' || !G.player) return;
  const P = G.player; const s = Math.max(1, Math.round(H / 190));
  // weapon / casting hands
  const rpg = rpgUI();
  if (rpg && !P.dead && (!P.sheathed || P.castT >= 0)) {
    const bobX = Math.sin(P.bob) * 3 * s, bobY = Math.abs(Math.cos(P.bob)) * 3 * s + (1 - (P.drawT ?? 1)) * 70 * s;
    const art = weaponArt(P.equip.weapon); const ws = s * 1.25;
    let ox = W * 0.47 + bobX, oy = H - 76 * ws + bobY + 6 * s, rot = 0;
    if (P.castT >= 0) {
      const t = P.castT / 0.55; oy += Math.sin(t * Math.PI) * 30 * s;
      const col = { fireball: [255, 140, 40], shock: [140, 180, 255], heal: [120, 255, 140] }[P.castSpell] || [255, 255, 255];
      const g = x.createRadialGradient(W / 2, H * 0.8, 1, W / 2, H * 0.8, 40 * s * Math.sin(t * Math.PI));
      g.addColorStop(0, `rgba(${col},0.9)`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else if (P.swingT >= 0) {
      const t = P.swingT / P.swingDur; const d = P.swingDir;
      if (t < 0.25) { const k = t / 0.25; rot = 0.35 * k; ox += 14 * s * k; oy -= 10 * s * k; }
      else if (t < 0.6) { const k = (t - 0.25) / 0.35; rot = lerp(0.35, d === 0 ? -0.5 : -1.3, k); ox += lerp(14, d === 0 ? -30 : -95, k) * s; oy += lerp(-10, d === 0 ? 35 : 22, k) * s; }
      else { const k = (t - 0.6) / 0.4; rot = lerp(d === 0 ? -0.5 : -1.3, 0, k); ox += lerp(d === 0 ? -30 : -95, 0, k) * s; oy += lerp(d === 0 ? 35 : 22, 0, k) * s; }
    }
    x.save(); x.imageSmoothingEnabled = false; x.translate(ox + 56 * ws, oy + 60 * ws); x.rotate(rot); x.drawImage(art, -56 * ws, -60 * ws, 80 * ws, 80 * ws); x.restore();
  }
  // crosshair
  x.fillStyle = 'rgba(255,236,190,0.75)'; x.fillRect(Math.round(W / 2) - s, Math.round(H / 2), 3 * s, s); x.fillRect(Math.round(W / 2), Math.round(H / 2) - s, s, 3 * s);
  // vitals
  if (rpg) {
  const bw = 4 * s, bh = 42 * s, bx = 6 * s, by = H - 6 * s - bh;
  const bar = (i, frac, col) => { const X0 = bx + i * (bw + 2 * s); x.fillStyle = '#120e0a'; x.fillRect(X0 - s, by - s, bw + 2 * s, bh + 2 * s); x.fillStyle = '#2c241c'; x.fillRect(X0, by, bw, bh); const h = Math.round(bh * clamp(frac, 0, 1)); x.fillStyle = col; x.fillRect(X0, by + bh - h, bw, h); x.fillStyle = 'rgba(255,255,255,0.25)'; x.fillRect(X0, by + bh - h, s, h); };
  bar(0, P.hp / P.maxHp, P.hp / P.maxHp < 0.25 && Math.floor(performance.now() / 300) % 2 ? '#ff6a4a' : '#b3372b'); bar(1, P.maxMp ? P.mp / P.maxMp : 0, '#3f67c9'); bar(2, P.fat / P.maxFat, '#4f9a3c');
  x.font = `${8 * s}px VT323, monospace`; x.textBaseline = 'bottom'; x.textAlign = 'left';
  const label = (t, X0, Y0, col = '#e9dcb2') => { x.fillStyle = '#000'; x.fillText(t, X0 + s, Y0 + s); x.fillStyle = col; x.fillText(t, X0, Y0); };
  if (P.spells.length) label(SPELLS[P.spells[P.spell % P.spells.length]].name, bx + 3 * (bw + 2 * s) + 2 * s, H - 6 * s, '#9ab4ff');
  const pots = P.inv.find(i => i.kind === 'potion' && i.base === 'heal'); label(`${P.gold}g${pots ? '  ' + pots.qty + '♥' : ''}`, bx + 3 * (bw + 2 * s) + 2 * s, H - 15 * s);
  if (G.wanted && G.area.kind === 'city') label('WANTED', bx, by - 3 * s, Math.floor(performance.now() / 400) % 2 ? '#ff5a4a' : '#a02a20');
  }
  // compass
  const cw = 76 * s, ch = 11 * s, cx0 = W - cw - 6 * s, cy0 = H - ch - 6 * s;
  x.fillStyle = '#120e0a'; x.fillRect(cx0 - s, cy0 - s, cw + 2 * s, ch + 2 * s); x.fillStyle = '#3a3028'; x.fillRect(cx0, cy0, cw, ch);
  const heading = ((-P.yaw * 180 / Math.PI) % 360 + 360) % 360;
  x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let a = 0; a < 360; a += 15) {
    const rel = ((a - heading + 540) % 360) - 180; if (Math.abs(rel) > 55) continue;
    const X0 = cx0 + cw / 2 + rel / 55 * (cw / 2 - 5 * s);
    const lab = { 0: 'N', 90: 'E', 180: 'S', 270: 'W', 45: 'NE', 135: 'SE', 225: 'SW', 315: 'NW' }[a];
    if (lab) { x.fillStyle = lab === 'N' ? '#ff6a4a' : '#e9dcb2'; x.font = `${(lab.length > 1 ? 6 : 8) * s}px VT323, monospace`; x.fillText(lab, X0, cy0 + ch / 2 + s); }
    else { x.fillStyle = '#8a7a5a'; x.fillRect(X0, cy0 + 2 * s, s, 2 * s); }
  }
  x.fillStyle = '#d8b25a'; x.fillRect(cx0 + cw / 2 - s / 2, cy0, s, 2 * s);
}

/* ---------------- title & character creation ---------------- */
const Create = {
  race: 'Townborn', cls: 'Adept', name: '', attr: null,
  quick() { if (!this.attr) this.roll(); return { name: this.name || 'Traveller', race: this.race, cls: this.cls, attr: { ...this.attr } }; },
  roll() { this.attr = {}; for (const a of ATTRS) this.attr[a] = clamp(40 + rnd.int(0, 15) + (RACES[this.race].mods[a] || 0) + (CLASSES[this.cls].mods[a] || 0), 20, 95); },
  open() {
    G.state = 'create'; $('title').hidden = true; if (!this.attr) this.roll();
    const render = () => {
      const R = RACES[this.race], C = CLASSES[this.cls]; const hp = 25 + Math.floor(this.attr.END / 4) + C.hp, mp = Math.round(this.attr.INT * C.mp);
      return `<h2>Create Your Character</h2><div class="create scroll">
        <div class="field"><label for="c_name">Name</label><input id="c_name" type="text" maxlength="24" value="${esc(this.name)}" placeholder="Nameless" autocomplete="off"></div>
        <h3>Origin</h3><div class="grid">${Object.keys(RACES).map(r => `<button class="db sm ${r === this.race ? 'on' : ''}" data-a="r:${r}">${r}</button>`).join('')}</div><p class="dim">${esc(R.desc)}</p>
        <h3>Class</h3><div class="grid">${Object.keys(CLASSES).map(c => `<button class="db sm ${c === this.cls ? 'on' : ''}" data-a="c:${c}">${c}</button>`).join('')}</div><p class="dim">${esc(C.desc)}${rpgUI() ? ` Starts with: ${esc(startingKit(this.cls).items.map(i => i.name).join(', '))}${startingKit(this.cls).spells.length ? '; spells: ' + startingKit(this.cls).spells.map(s => SPELLS[s].name).join(', ') : ''}.` : ''}</p>
        ${rpgUI() ? `<h3>Attributes <button class="db xs" data-a="reroll">Reroll</button></h3><div class="attrs two">${ATTRS.map(a => `<div class="attr"><span>${ATTR_NAMES[a]}</span><b>${this.attr[a]}</b></div>`).join('')}</div>
        <p>Health ${hp} · Spirit ${mp} · Fatigue ${this.attr.END + this.attr.STR} · Gold ${C.gold}</p>` : ''}</div>
        <div class="btns"><button class="db" data-a="back">Back</button><button class="db primary" data-a="start">Begin</button></div>`;
    };
    UI.open('create', render, {
      cls: 'wide', closable: false, focus: false, onAct: (a) => {
        const inp = $('c_name'); if (inp) this.name = inp.value.trim();
        if (a.startsWith('r:')) { this.race = a.slice(2); this.roll(); }
        if (a.startsWith('c:')) { this.cls = a.slice(2); this.roll(); }
        if (a === 'reroll') this.roll();
        if (a === 'back') { UI.close(true); toTitle(); return; }
        if (a === 'start') { UI.close(true); beginNewGame({ name: this.name || 'Nameless', race: this.race, cls: this.cls, attr: { ...this.attr } }); return; }
        UI.render();
      },
    });
  },
};
