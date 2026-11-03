/* =====================================================================
   Touch controls for tablets: a floating stick under the left thumb,
   drag anywhere else to look, and stone buttons that stand in for keys.
   They switch on with the first touch (or always / never, in Settings);
   a mouse click on the view hands control back to mouse and keyboard.
   ===================================================================== */
const Touch = {
  on: false, shown: false, stick: null, look: null, held: new Map(), el: null, sig: '',
  LOOK: 2.3, // screen pixels to mouse counts: a 300 px drag turns about 90°

  init() {
    const el = this.el = $('touch');
    const b = (k, label, cls = '') => `<button class="tb ${cls}" data-k="${k}">${label}</button>`;
    el.innerHTML = `<div class="stk" hidden><i></i></div>
      <div class="tbar">${b('Escape', 'Menu', 'sq')}${b('KeyM', 'Map', 'sq')}${b('KeyJ', 'Journal', 'sq')}${b('KeyI', 'Character', 'sq')}${b('KeyR', 'Rest', 'sq')}${b('KeyT', 'Travel', 'sq')}${b('full', 'Full screen', 'sq')}</div>
      <div class="tact">${b('attack', 'Attack', 'big')}${b('use', 'Use')}${b('cast', 'Cast')}${b('Space', 'Jump', 'jump')}${b('KeyX', 'Down', 'down')}
        <div class="tside">${b('KeyH', 'Potion', 'pill')}${b('KeyZ', 'Draw', 'pill')}${b('spell', 'Spell', 'pill')}${b('KeyG', 'Fly', 'pill')}</div></div>`;
    this.btn = {}; for (const e of el.querySelectorAll('[data-k]')) this.btn[e.dataset.k] = e;
    if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) this.btn.full.remove();
    el.addEventListener('pointerdown', e => this.down(e));
    el.addEventListener('pointermove', e => this.move(e));
    el.addEventListener('pointerup', e => this.up(e, true));
    el.addEventListener('pointercancel', e => this.up(e, false));
    el.addEventListener('contextmenu', e => e.preventDefault());
    // no emulated mouse clicks: the tap that opens a menu must not also land on the menu's backdrop
    for (const t of ['touchstart', 'touchend']) el.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
    // the first real touch anywhere (title screen included) turns the controls on
    addEventListener('touchstart', () => { if (settings.touch !== 2 && !this.on) this.enable(true); }, { capture: true, passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.on && G.state === 'play' && !G.uiOpen && G.player && !G.player.dead && !G.resting) UI.openPause(); });
    this.apply();
  },
  // settings: 0 auto (on for touch-first devices, or after the first touch), 1 always, 2 never
  apply() {
    const auto = matchMedia('(hover: none) and (pointer: coarse)').matches;
    this.enable(settings.touch === 1 || (settings.touch === 0 && (auto || this.on)));
    document.documentElement.style.setProperty('--tsu', settings.touchSize || 1);
  },
  enable(on) {
    this.on = Input.touch = on; document.body.classList.toggle('touch', on);
    if (on) exitLock(); else this.release();
  },

  // show or hide with the game state, and keep the buttons honest about what they will do
  update() {
    const P = G.player;
    const show = this.on && G.state === 'play' && !!P && !P.dead && !G.uiOpen && !G.mapOpen && !G.resting && !G.fading;
    if (show !== this.shown) { this.shown = show; this.el.classList.toggle('live', show); if (!show) this.release(); }
    if (!show) return;
    const pots = P.inv.find(i => i.kind === 'potion' && i.base === 'heal');
    const sig = [rpgUI(), !!G.focus, G.flying, settings.dbgFly, P.spells.length, P.sheathed, pots ? pots.qty : 0, !!document.fullscreenElement || !!document.webkitFullscreenElement].join();
    if (sig === this.sig) return; this.sig = sig;
    const B = this.btn;
    B.use.classList.toggle('ready', !!G.focus);
    B.Space.textContent = G.flying ? 'Rise' : 'Jump'; B.KeyX.hidden = !G.flying;
    B.KeyG.hidden = !settings.dbgFly; B.KeyG.textContent = G.flying ? 'Land' : 'Fly';
    const rpg = rpgUI(); B.attack.hidden = B.KeyZ.hidden = B.KeyH.hidden = B.KeyI.hidden = !rpg;
    B.cast.hidden = !rpg || !P.spells.length; B.spell.hidden = !rpg || P.spells.length < 2;
    this.el.classList.toggle('min', !rpg);
    B.KeyZ.textContent = P.sheathed ? 'Draw' : 'Sheathe';
    B.KeyH.textContent = pots ? `Potion ×${pots.qty}` : 'Potion'; B.KeyH.classList.toggle('off', !pots);
    if (B.full) B.full.textContent = document.fullscreenElement || document.webkitFullscreenElement ? 'Window' : 'Full screen';
  },

  down(e) {
    if (e.pointerType === 'mouse') { this.enable(false); requestLock(true); return; } // a mouse or trackpad took over
    e.preventDefault(); SFX.init();
    try { this.el.setPointerCapture(e.pointerId); } catch (err) { /* capture is a nicety */ }
    const b = e.target.closest('[data-k]');
    if (b) {
      const k = b.dataset.k; this.held.set(e.pointerId, b); b.classList.add('on'); this.press(k);
      // keep a thumb on Attack or Cast and drag to aim, as in most shooters on a tablet
      if ((k === 'attack' || k === 'cast') && !this.look) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, t: 0, moved: 99 };
      return;
    }
    if (!this.stick && e.clientX < innerWidth * 0.42) {
      this.stick = { id: e.pointerId, x0: e.clientX, y0: e.clientY };
      this.drawStick(0, 0, false);
    } else if (!this.look) this.look = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 };
  },
  move(e) {
    const S = this.stick, L = this.look;
    if (S && e.pointerId === S.id) {
      const R = 58 * (settings.touchSize || 1); let dx = e.clientX - S.x0, dy = e.clientY - S.y0; const d = Math.hypot(dx, dy);
      if (d > R * 1.6) { const k = (d - R * 1.6) / d; S.x0 += dx * k; S.y0 += dy * k; dx = e.clientX - S.x0; dy = e.clientY - S.y0; } // the stick follows a thumb that wanders
      const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
      const run = Math.hypot(dx, dy) > R * 1.15;
      Input.stick.x = Math.cos(a) * m; Input.stick.y = Math.sin(a) * m; Input.stick.run = run;
      if (m < 0.12) Input.stick.x = Input.stick.y = 0; // a small dead zone
      this.drawStick(dx, dy, run);
    }
    if (L && e.pointerId === L.id) {
      const dx = e.clientX - L.x, dy = e.clientY - L.y; L.x = e.clientX; L.y = e.clientY; L.moved += Math.abs(dx) + Math.abs(dy);
      Input.mdx += dx * this.LOOK; Input.mdy += dy * this.LOOK;
    }
  },
  up(e, ended) {
    const b = this.held.get(e.pointerId);
    if (b) { this.held.delete(e.pointerId); b.classList.remove('on'); this.unpress(b.dataset.k); }
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; Input.stick.x = Input.stick.y = 0; Input.stick.run = false; this.el.querySelector('.stk').hidden = true; }
    if (this.look && e.pointerId === this.look.id) {
      const L = this.look; this.look = null;
      if (ended && L.t && L.moved < 12 && performance.now() - L.t < 300 && G.focus && this.shown) interact(); // a tap on the view uses what you face
    }
  },
  // drop every held control (the layer hid, or control went back to the mouse)
  release() {
    for (const b of this.held.values()) b.classList.remove('on');
    this.held.clear(); this.stick = this.look = null; Input.vkeys = Object.create(null);
    Input.stick.x = Input.stick.y = 0; Input.stick.run = false;
    if (this.el) this.el.querySelector('.stk').hidden = true;
  },
  drawStick(dx, dy, run) {
    const S = this.stick, st = this.el.querySelector('.stk'); const R = 58 * (settings.touchSize || 1);
    const d = Math.hypot(dx, dy), k = d > R * 1.2 ? R * 1.2 / d : 1;
    st.hidden = false; st.style.left = S.x0 + 'px'; st.style.top = S.y0 + 'px';
    st.firstChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`; st.classList.toggle('run', run);
  },

  press(k) {
    const P = G.player; if (!this.shown || !P) return;
    if (k === 'Space' || k === 'KeyX') { Input.vkeys[k] = true; if (k === 'Space') SFX.init(); return; }
    if (k === 'attack') { startAttack(); return; }
    if (k === 'cast') { startCast(); return; }
    if (k === 'use') { if (G.focus) interact(); else msg('There is nothing within reach to use.'); return; }
    if (k === 'spell') { if (P.spells.length) { P.spell = (P.spell + 1) % P.spells.length; msg(`Spell selected: ${SPELLS[P.spells[P.spell]].name}.`); } return; }
    if (k === 'full') { this.fullscreen(); return; }
    onKey({ code: k, preventDefault() {} });
  },
  unpress(k) { if (k === 'Space' || k === 'KeyX') Input.vkeys[k] = false; },
  fullscreen() {
    const d = document, root = d.documentElement;
    try {
      if (d.fullscreenElement || d.webkitFullscreenElement) (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      else { const r = (root.requestFullscreen || root.webkitRequestFullscreen).call(root); if (r && r.catch) r.catch(() => {}); }
    } catch (err) { msg('Full screen is not available here.'); }
    this.sig = '';
  },
};
