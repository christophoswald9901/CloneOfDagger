/* =====================================================================
   Surveying (notes in docs/CARTOGRAPHY.md). K takes out a sighting
   compass with a small spyglass: aim at a landmark and note its bearing
   in the field book. On the map, now a survey sheet, lay the ruler with
   its pin in that landmark, turn it by hand to the bearing and draw the
   line: you stood somewhere on it. Two lines cross where you stood; a
   third shows by the little triangle it leaves how good the fix is.
   A new game starts in Aldhaven, in Corrinvale, or at the edge of the
   known map, where the map does not show where you are. The debug panel
   at the edge of the map switches what the map gives away.
   ===================================================================== */
const SURVEY_STARTS = [
  { id: 'aldhaven', name: 'Aldhaven', sub: "On Pilgrim's Rise, above the walled port and the bay." },
  { id: 'corrinvale', name: 'Corrinvale', sub: 'In the Grand Square of the canal town, under its belfry.' },
  { id: 'edge', name: 'The edge of the known map', sub: 'High on the western mountains: the known country below you, the unknown beyond the range behind. Your map does not show where you are; find it with the compass and the ruler.' },
];
// the edge start: a flat shoulder of the western home mountains, 1.2 km inside the border, in sight of seven landmarks
// (the Spindle 1.1 km, Harrow Fell 2.3 km, Mirrormere 4.5 km, Halewood 5 km, Corrinvale 8 km, Greywatch 9 km, the Ninefold Stones 13 km)
const SURVEY_EDGE = { x: -8800, z: -9000, bearing: 78, map: [-7400, -9800] };
// where each landmark is sighted: its tower, steeple or keep, not the middle of the place
const SIGHT_AT = {
  greywatch: S => [S.x - 10, S.z - 12], stones: S => [S.x, S.z], mirrormere: S => [S.x + 274, S.z - 34.6], kestrel: S => [S.x - 24, S.z + 6],
  gullscar: () => [GULL.x, gullCoast(GULL.x) - 34], halewood: () => hallW(0, 0), // (the house itself, at the middle of its own frame)
};
// two summits of the western home mountains, known by name and on every map: the Spindle, the sharp horn 1.1 km west-north-west of the edge
// start, and Harrow Fell, where the ridge north of it ends in a point (stand-in names until the story returns). Each is taken as the top of
// the ground near where it is given here
const PEAKS = [{ id: 'spindle', name: 'the Spindle', x: -9821, z: -9452 }, { id: 'harrow', name: 'Harrow Fell', x: -9032, z: -11277 }];
const fmtBearing = b => { const w = Math.floor(b + 1e-6); return (b - w > 0.25 ? w + '½' : String(w)) + '°'; };
const wrap360 = a => ((a % 360) + 360) % 360;

const Survey = {
  on: false, sheet: false, zoom: 3, ZMAX: 10, n: 0, v: 0, flash: 0, arm: null, grab: null, twist: null, ptrs: new Map(), pending: null, dbgOpen: false, sure: 0, told: false,

  /* ---------- what is kept with the game ---------- */
  fresh(start) { const edge = start === 'edge'; return { start, opts: { pos: edge ? 'never' : 'always', unknown: edge ? 'blank' : 'drawn', truth: false, needle: 'swing' }, reads: [], items: [], ruler: null, view: null, home: null }; },
  st() { return G.flags.survey || (G.flags.survey = this.fresh('aldhaven')); }, // (games saved before surveying came in start as Aldhaven's)
  opt(k) { return this.st().opts[k]; },
  // the known map: the home country and all of its mountains, out to their outer foot (their middle runs some 350 m beyond the old crest
  // line and they fall away to nothing within 2.4 km of it, homeFlank and rimHeight in 03_terrain.js)
  EDGE_FLANK: 2600,
  known(x, z) { return homeOut(x, z) <= 0 || homeFlank(x, z) < this.EDGE_FLANK; },
  // its edge, out of the home country's box to the west, north and east, as a line of points (worked out once): far south on the west,
  // up the west side, round the north-west corner, along the north, round the north-east corner, down the east side, far south again
  edge() {
    if (this._edge) return this._edge;
    const out = (px, pz, dx, dz) => { let t = 0; while (t < 12000 && this.known(px + dx * (t + 100), pz + dz * (t + 100))) t += 100;
      let a = t, b = t + 100; for (let k = 0; k < 7; k++) { const m = (a + b) / 2; if (this.known(px + dx * m, pz + dz * m)) a = m; else b = m; } return [Math.round(px + dx * a), Math.round(pz + dz * a)]; };
    const { x0, x1, z0, z1 } = WORLD, P = [], st = 200, far = z1 + 60000, fan = (cx, a0) => { for (let a = a0; a <= a0 + 90; a += 5) { const r = a * Math.PI / 180; P.push(out(cx, z0, Math.cos(r), Math.sin(r))); } };
    for (let z = z1; z > z0; z -= st) P.push(out(x0, z, -1, 0)); P.unshift([P[0][0], far]); fan(x0, 180);
    for (let x = x0 + st; x < x1; x += st) P.push(out(x, z0, 0, -1)); fan(x1, 270);
    for (let z = z0 + st; z <= z1; z += st) P.push(out(x1, z, 1, 0)); P.push([P[P.length - 1][0], far]);
    return (this._edge = P);
  },
  // the named summits, each at the top of its ground
  peaks() {
    return this._peaks || (this._peaks = PEAKS.map(p => { let x = p.x, z = p.z, h = terrainRaw(x, z);
      for (let st = 32; st >= 2; st /= 2) for (let moved = true, n = 0; moved && n < 30; n++) { moved = false; for (const [a, b] of [[st, 0], [-st, 0], [0, st], [0, -st], [st, st], [st, -st], [-st, st], [-st, -st]]) { const v = terrainRaw(x + a, z + b); if (v > h) { h = v; x += a; z += b; moved = true; } } }
      return { ...p, x: Math.round(x), z: Math.round(z), h: Math.round(h) }; }));
  },
  // whether the map shows where you are (and the travel panel how far things are)
  showPos() { const o = this.opt('pos'), P = G.player; return o === 'always' || (o === 'known' && !!P && this.known(P.pos.x, P.pos.z)); },
  blank() { return this.opt('unknown') === 'blank'; },
  // the landmarks on the map that can be sighted: Aldhaven's and Corrinvale's towers, and the landmarks you know of
  points() {
    const found = G.flags.found || {}, heard = G.flags.heard || {}, out = [];
    for (const l of G.city.landmarks) if (l.id === 'bell' || l.id === 'lighthouse') out.push({ name: 'Aldhaven, ' + l.name.replace(/^the /, 'the '), x: l.x, z: l.z });
    for (const T of TOWNS) for (const l of T.landmarks) if (l.id === 'belfry' || l.id === 'cathedral') out.push({ name: T.name + ', ' + l.name, x: l.x, z: l.z });
    for (const S of SITES) if (SIGHT_AT[S.id] && (found[S.id] || heard[S.id])) { const [x, z] = SIGHT_AT[S.id](S); out.push({ name: S.name.replace(/^the /, 'the '), x, z }); }
    for (const p of this.peaks()) out.push({ name: p.name, x: p.x, z: p.z });
    return out;
  },
  // where the map opens when it does not show you: where you last marked yourself, else the ruler, else where you began
  anchor() { const s = this.st(); for (let i = s.items.length - 1; i >= 0; i--) if (s.items[i].k === 'mark') return [s.items[i].x, s.items[i].z]; if (s.ruler) return [s.ruler.x, s.ruler.z]; return s.home || [0, -30]; },

  /* ---------- a new game: where it begins ---------- */
  chooseStart(go) {
    $('title').hidden = true; const back = () => { UI.close(true); $('title').hidden = false; };
    UI.open('start', () => `<h2>Where does your journey begin?</h2><div class="btns col">${SURVEY_STARTS.map(o => `<button class="db start" data-a="s:${o.id}"><b>${esc(o.name)}</b><small>${esc(o.sub)}</small></button>`).join('')}</div><div class="btns"><button class="db" data-a="back">Back</button></div>`,
      { cls: 'mid', leave: back, onAct: a => { if (a === 'back') { back(); return; } if (a.startsWith('s:')) { this.pending = a.slice(2); UI.close(true); go(); } } });
  },
  // put the new player at the start chosen (beginNewGame), with the map that goes with it
  place() {
    const start = SURVEY_STARTS.some(o => o.id === this.pending) ? this.pending : 'aldhaven'; this.pending = null; this.close();
    const s = G.flags.survey = this.fresh(start), found = G.flags.found || (G.flags.found = {}), day = dayOf(G.time) + 1, P = G.player;
    if (start === 'corrinvale') {
      const T = TOWNS[0], sq = T.landmarks.find(l => l.id === 'square'), bf = T.landmarks.find(l => l.id === 'belfry');
      found[T.id] = day; setArea(G.city, sq.x, sq.z, Math.atan2(-(bf.x - sq.x), -(bf.z - sq.z))); P.pitch = 0.12; G.lastDistrict = null; s.home = [sq.x, sq.z];
    } else if (start === 'edge') {
      for (const S of SITES) found[S.id] = day; // the known map shows the country's landmarks
      const E = SURVEY_EDGE; setArea(G.city, E.x, E.z, -E.bearing * Math.PI / 180); P.pitch = -0.05; G.lastDistrict = 'outside'; s.home = E.map; MapView.zoom = 0.06; // (the map opens over the west of the country and its mountains, not on you)
    } else { const S = G.city.start; setArea(G.city, S.x, S.z, S.yaw); P.pitch = S.pitch || 0; if (S.y != null) P.pos.y = S.y; G.lastDistrict = 'outside'; s.home = [S.x, S.z]; }
    return start;
  },
  welcome(start) {
    const t = Input.touch;
    if (start === 'edge') return [`You stand at the edge of the known map. To the east the known country lies below you; beyond the mountains to the west the land is unknown. Your map (${t ? 'Map' : 'M'}) shows the country, but not where you are. The peaks of the range behind you are on it too: the Spindle, the sharp horn, and Harrow Fell to the north.`,
      `${t ? 'Tap Survey' : 'Press K'} for the compass. Sight a landmark you can find on the map, note its bearing, then lay the ruler through that landmark on the map at that bearing and draw the line. Where two lines cross, you are.`];
    if (start === 'corrinvale') return [`Welcome to Corrinvale. ${t ? 'The buttons at the top open the map and your journal.' : 'M opens the map, J your journal.'}`, `${t ? 'Survey' : 'K'} takes out a compass and a ruler, to find where you are from the landmarks you can see.`];
    return null;
  },

  /* ---------- the compass in hand ---------- */
  heading() { return wrap360(-G.player.yaw * 180 / Math.PI); },
  toggle() { if (this.on || this.sheet) this.close('You put the compass and the ruler away.'); else this.open(); },
  open() {
    const P = G.player; if (!P || P.dead || G.state !== 'play') return;
    if (G.area !== G.city) { msg('You need open sky to take a bearing.'); return; }
    if (Travel.cur) Travel.stop('You stop.');
    this.on = true; this.n = this.heading(); this.v = 0; SFX.play('click');
    if (!this.told) { this.told = true; msg(Input.touch ? 'Compass out. Drag to aim at a landmark and tap Bearing to note it; + and − work the spyglass, Sheet opens the map with the ruler. Walking puts it away.'
      : 'Compass out. Aim at a landmark and click (or Enter) to note its bearing. The wheel or + / − works the spyglass, M opens the map with the ruler, K puts it all away; walking does too.'); }
  },
  close(text) {
    if (!this.on && !this.sheet) return;
    this.on = false; $('survinfo').hidden = true; this._info = ''; this.arm = null; this.grab = this.twist = null;
    if (this.sheet) { this.sheet = false; if (G.mapOpen) MapView.close(); }
    this.applyFov(); if (text) msg(text);
  },
  // keys while the compass is out (true: taken)
  key(c) {
    if (c === 'KeyK' || c === 'Escape') { this.close('You put the compass away.'); return true; }
    if (c === 'Enter' || c === 'NumpadEnter' || c === 'Space') { this.take(); return true; }
    if (c === 'KeyM') { this.openSheet(); return true; }
    if (c === 'Equal' || c === 'NumpadAdd') { this.zoomBy(1.25); return true; }
    if (c === 'Minus' || c === 'NumpadSubtract') { this.zoomBy(0.8); return true; }
    if (c === 'KeyE' || c === 'KeyF') this.close(); // (and then talk, or open the door)
    return false;
  },
  update(dt) {
    if (!this.on) return;
    const P = G.player; if (G.area !== G.city || Travel.cur || G.resting || !P || P.dead) { this.close(); return; }
    const t = this.heading();
    if (this.opt('needle') === 'steady') { this.n = t; this.v = 0; }
    else for (let k = 0; k < 3; k++) { const h = dt / 3, d = ((t - this.n + 540) % 360) - 180; this.v += (d * 24 - this.v * 4.4) * h; this.n = wrap360(this.n + this.v * h); } // the needle lags as you turn, swings past and settles
    this.flash = Math.max(0, this.flash - dt * 3);
    this.applyFov(); this.info();
  },
  info() {
    const el = $('survinfo'), show = this.on && !G.mapOpen && !G.uiOpen && G.state === 'play'; if (el.hidden !== !show) el.hidden = !show; if (!show) return;
    const r = this.st().reads, last = r[r.length - 1], a = `${this.zoom > 1.05 ? 'spyglass ×' + this.zoom.toFixed(1) : 'compass sights'}${last ? ` · last bearing ${fmtBearing(last.b)}, station ${last.st}` : ''}${this.opt('truth') ? ` · (true ${this.heading().toFixed(1)}°)` : ''}`,
      b = Input.touch ? 'drag to aim · Bearing notes it · + − spyglass · Sheet: map and ruler' : 'click or Enter: note the bearing · wheel or + −: spyglass · M: map and ruler · K: put away', t = a + '\n' + b;
    if (t !== this._info) { this._info = t; el.innerHTML = `<div class="a${this.flash > 0 ? ' new' : ''}">${esc(a)}</div><div class="b">${esc(b)}</div>`; }
  },
  // the spyglass: a narrower view, aimed more finely, and far things clear of the haze in proportion
  applyFov() { if (typeof camera === 'undefined' || !camera) return; const f = this.on && !this.sheet ? settings.fov / this.zoom : settings.fov; if (Math.abs(camera.fov - f) > 1e-3) { camera.fov = f; camera.updateProjectionMatrix(); } },
  lookK() { return this.on && !this.sheet ? 1 / this.zoom : 1; },
  fogK() { return this.on && !this.sheet ? this.zoom : 1; },
  zoomBy(k) { if (this.on) this.zoom = clamp(this.zoom * k, 1, this.ZMAX); },
  // what the card reads now: the needle, and the tremble of the hand that holds it
  reading() { if (this.opt('needle') === 'steady') return this.heading(); const c = G.clock; return wrap360(this.n + 0.32 * Math.sin(c * 1.9) + 0.22 * Math.sin(c * 3.3 + 1.3)); },
  take() {
    if (!this.on) return; const s = this.st(), P = G.player, b = wrap360(Math.round(this.reading() * 2) / 2), last = s.reads[s.reads.length - 1];
    const st = !last ? 1 : Math.hypot(last.x - P.pos.x, last.z - P.pos.z) < 30 ? last.st : last.st + 1; // a new station once you have walked on
    s.reads.push({ b, tb: Math.round(this.heading() * 10) / 10, st, t: Math.round(G.time), x: Math.round(P.pos.x * 10) / 10, z: Math.round(P.pos.z * 10) / 10 }); while (s.reads.length > 40) s.reads.shift();
    SFX.play('click'); this.flash = 1; msg(`Bearing ${fmtBearing(b)} noted (station ${st}).`);
  },
  // the view through the sights: the spyglass's round field, the hair, the compass card under it
  hud(x, W, H, s) {
    const cx = Math.round(W / 2), cy = Math.round(H / 2);
    if (this.zoom > 1.05) { const R = Math.round(Math.min(W, H) * 0.48); x.save(); x.fillStyle = 'rgba(8,6,4,0.92)'; x.beginPath(); x.rect(0, 0, W, H); x.arc(cx, cy, R, 0, Math.PI * 2, true); x.fill('evenodd');
      x.strokeStyle = this.flash > 0 ? `rgba(240,210,120,${0.5 + this.flash * 0.5})` : '#6a5228'; x.lineWidth = 2 * s; x.beginPath(); x.arc(cx, cy, R, 0, Math.PI * 2); x.stroke(); x.restore(); }
    const hair = (col, w) => { x.fillStyle = col; x.fillRect(cx - (w - s) / 2, cy - 44 * s, w, 37 * s); x.fillRect(cx - (w - s) / 2, cy + 7 * s, w, 37 * s); x.fillRect(cx - 26 * s, cy - (w - s) / 2, 19 * s, w); x.fillRect(cx + 7 * s, cy - (w - s) / 2, 19 * s, w); };
    hair('rgba(255,240,200,0.35)', 3 * s); hair('rgba(24,16,8,0.9)', s);
    const cw = Math.min(W - 24 * s, 170 * s), ch = 15 * s, x0 = Math.round(cx - cw / 2), y0 = H - ch - 8 * s, span = 12, rd = this.reading();
    x.fillStyle = '#120e0a'; x.fillRect(x0 - s, y0 - s, cw + 2 * s, ch + 2 * s); x.fillStyle = '#e6dab4'; x.fillRect(x0, y0, cw, ch);
    x.save(); x.beginPath(); x.rect(x0, y0, cw, ch); x.clip(); x.textAlign = 'center'; x.textBaseline = 'bottom'; x.font = `${8 * s}px VT323, monospace`;
    for (let a = Math.floor(rd - span - 1); a <= rd + span + 1; a++) { const X0 = Math.round(cx + (a - rd) / span * cw / 2), aa = wrap360(a), big = aa % 10 === 0;
      x.fillStyle = '#2a1e10'; x.fillRect(X0, y0, s, big ? 6 * s : aa % 5 === 0 ? 4 * s : 2 * s);
      if (big) { x.fillStyle = aa === 0 ? '#b0301a' : '#2a1e10'; x.fillText({ 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[aa] || String(aa), X0 + s / 2, y0 + ch); } }
    x.restore(); x.fillStyle = '#b0301a'; x.fillRect(cx - s, y0 - 3 * s, 2 * s, ch + 3 * s); // the lubber line: read the card here
    // (what the spyglass is set to and the last bearing are page text, #survinfo: crisp where the HUD is pixelated)
  },

  /* ---------- the sheet: the map with the ruler and the field book ---------- */
  openSheet() {
    if (G.area.kind !== 'city') return;
    this.sheet = true; this.arm = null; this.applyFov(); MapView.open();
    if (!G.mapOpen) this.sheet = false;
  },
  onMapOpen() { $('mapdebug').hidden = G.area.kind !== 'city'; this.panel(); this.debugPanel(); },
  onMapClose() { if (!this.showPos() && MapView.view) this.st().view = MapView.view.slice(); this.sheet = false; this.arm = null; this.grab = this.twist = null; this.ptrs.clear(); $('mapsurvey').hidden = true; this.applyFov(); },
  sheetKey(c) {
    if (c === 'KeyK') { this.close('You put the compass and the ruler away.'); return true; }
    if (c === 'KeyM' || c === 'Escape') { MapView.close(); return true; } // back to the compass
    const k = keyDown('ShiftLeft') || keyDown('ShiftRight') ? 1 : 0.1;
    if (c === 'BracketLeft' || c === 'Comma') { this.turn(-k); return true; }
    if (c === 'BracketRight' || c === 'Period') { this.turn(k); return true; }
    if (c === 'Enter' || c === 'NumpadEnter') { this.line(); return true; }
    if (c === 'Backspace') { this.undo(); return true; }
    return false;
  },
  legend() { return Input.touch ? 'The survey sheet. Drag the ruler to move it: its pin settles on a landmark. Turn it by its knobs, or twist it with two fingers, to the bearing in your field book, then Draw line. Where the lines cross is where you stood.'
    : 'The survey sheet. Drag the ruler to move it: its pin settles on a landmark. Turn it by the knobs at its ends ([ and ] or Shift+wheel turn it finely, Shift+[ ] by degrees) to the bearing in your field book, then Draw line (Enter). Where the lines cross is where you stood. M goes back to the compass.'; },
  // the ruler on screen (CSS pixels): its pin, the way it points, its length and width
  geo(t) { const R = this.st().ruler, d = t.dpr, a = R.a * Math.PI / 180, ux = Math.sin(a), uy = -Math.cos(a);
    return { cx: (t.W / 2 + (R.x - t.cx) * t.scale) / d, cy: (t.H / 2 + (R.z - t.cz) * t.scale) / d, ux, uy, nx: -uy, ny: ux, half: Math.min(440, 0.42 * Math.min(innerWidth, innerHeight)), w: 30 }; },
  brg(ax, ay, bx, by) { return wrap360(Math.atan2(bx - ax, -(by - ay)) * 180 / Math.PI); },
  turn(d) { const R = this.st().ruler; if (!R) return; R.a = wrap360(Math.round((R.a + d) * 10) / 10); MapView.draw(true); this.panelRuler(); },
  // the line along the ruler's edge, carried on across the whole sheet (as with a long straight-edge: the landmarks stand kilometres off)
  line() { const t = MapView.tf, R = this.st().ruler; if (!t || !R) return; const L = Math.max(this.geo(t).half * t.dpr / t.scale, 26000), a = R.a * Math.PI / 180, dx = Math.sin(a) * L, dz = -Math.cos(a) * L, r = v => Math.round(v * 10) / 10;
    this.st().items.push({ k: 'line', ax: r(R.x - dx), az: r(R.z - dz), bx: r(R.x + dx), bz: r(R.z + dz), a: R.a }); SFX.play('click'); MapView.draw(true); this.panel(); },
  undo() { const s = this.st(); if (!s.items.length) return; s.items.pop(); MapView.draw(true); this.panel(); },
  // a tap on the sheet: marks where you are, when Mark is armed
  tap(px, py) { if (this.arm !== 'mark') return; const w = MapView.toWorld(px, py), P = G.player; if (!w) return; const r = v => Math.round(v * 10) / 10;
    this.st().items.push({ k: 'mark', x: r(w[0]), z: r(w[1]), tx: r(P.pos.x), tz: r(P.pos.z), t: Math.round(G.time) }); this.arm = null; SFX.play('click'); MapView.draw(true); this.panel(); },
  hit(px, py) { const t = MapView.tf; if (!t || !this.st().ruler) return null; const g = this.geo(t), dx = px - g.cx, dy = py - g.cy, al = dx * g.ux + dy * g.uy, ac = dx * g.nx + dy * g.ny;
    if (Math.abs(al) > g.half + 8 || ac < -12 || ac > g.w + 12) return null; return Math.abs(al) > g.half - 44 ? 'turn' : 'move'; },
  // pointers on the sheet (true: the ruler took it, the map does not pan)
  pdown(e) {
    this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (this.grab && this.grab.id !== e.pointerId && !this.twist) { const p1 = this.ptrs.get(this.grab.id); if (p1) { this.twist = { id: e.pointerId, b0: this.brg(p1[0], p1[1], e.clientX, e.clientY), a0: this.st().ruler.a }; return true; } } // a second finger twists the ruler
    const h = this.hit(e.clientX, e.clientY); if (!h) return false;
    const R = this.st().ruler, g = this.geo(MapView.tf);
    this.grab = h === 'turn' ? { id: e.pointerId, kind: 'turn', off: this.brg(g.cx, g.cy, e.clientX, e.clientY) - R.a } : { id: e.pointerId, kind: 'move', sx: e.clientX, sy: e.clientY, x0: R.x, z0: R.z };
    return true;
  },
  pmove(e) {
    if (!this.ptrs.has(e.pointerId)) return false; this.ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const g0 = this.grab; if (!g0) return false; const R = this.st().ruler, t = MapView.tf;
    if (this.twist) { const p1 = this.ptrs.get(g0.id), p2 = this.ptrs.get(this.twist.id); if (p1 && p2) R.a = wrap360(Math.round((this.twist.a0 + this.brg(p1[0], p1[1], p2[0], p2[1]) - this.twist.b0) * 10) / 10); }
    else if (g0.id === e.pointerId) { if (g0.kind === 'move') { R.x = g0.x0 + (e.clientX - g0.sx) * t.dpr / t.scale; R.z = g0.z0 + (e.clientY - g0.sy) * t.dpr / t.scale; }
      else { const g = this.geo(t); R.a = wrap360(Math.round((this.brg(g.cx, g.cy, e.clientX, e.clientY) - g0.off) * 10) / 10); } }
    else return false;
    MapView.draw(true); this.panelRuler(); return true;
  },
  pup(e) {
    this.ptrs.delete(e.pointerId); const g0 = this.grab; if (!g0) return false;
    if (this.twist && e.pointerId === this.twist.id) { this.twist = null; return true; }
    if (e.pointerId !== g0.id) return false;
    this.twist = null; this.grab = null; if (g0.kind === 'move') this.snap(); MapView.draw(true); this.panelRuler(); return true;
  },
  // the pin settles into a landmark dropped near it
  snap() { const R = this.st().ruler, t = MapView.tf; let best = null, bd = 20 * t.dpr; for (const p of this.points()) { const d = Math.hypot(p.x - R.x, p.z - R.z) * t.scale; if (d < bd) { bd = d; best = p; } } if (best) { R.x = best.x; R.z = best.z; } },
  pinned() { const R = this.st().ruler; return R && this.points().find(p => Math.hypot(p.x - R.x, p.z - R.z) < 0.5); },
  rulerText() { const R = this.st().ruler; if (!R) return ''; const a = wrap360(R.a) % 180, f = v => v.toFixed(1).padStart(5, '0') + '°'; return `${f(a)} · ${f(a + 180)}`; },
  panelRuler() { const e = $('svrb'); if (e) e.textContent = this.rulerText(); const p = $('svpin'); if (p) { const q = this.pinned(); p.textContent = q ? 'pinned in ' + q.name : 'pin not in a landmark'; } },
  panel() {
    const el = $('mapsurvey'); if (!this.sheet) { el.hidden = true; return; } el.hidden = false;
    const s = this.st(), truth = s.opts.truth, sure = performance.now() - this.sure < 3000, pin = this.pinned();
    const rows = s.reads.map((r, i) => [r, i]).reverse().map(([r, i]) => `<div class="rd"><span class="st">station ${r.st}</span><b>${fmtBearing(r.b)}</b>${truth ? `<small>true ${r.tb.toFixed(1)}°</small>` : ''}<button class="db xs" data-sv="del:${i}" aria-label="Strike out">✕</button></div>`).join('');
    if (this.fold) { el.classList.add('fold'); el.innerHTML = `<button class="db sm" data-sv="fold">Field book and ruler ▸</button>`; return; } el.classList.remove('fold'); // (folded away, so a small screen shows the map)
    el.innerHTML = `<h4>Field book <button class="db xs" data-sv="fold" aria-label="Fold the field book away">◂</button></h4><div class="book">${rows || '<p class="dim">No bearings yet: take them with the compass (Sight).</p>'}</div>
      <h4>Ruler <span id="svrb" class="rb">${this.rulerText()}</span></h4><div id="svpin" class="dim">${pin ? 'pinned in ' + esc(pin.name) : 'pin not in a landmark'}</div>
      <div class="tools"><button class="db xs" data-sv="t:-1">↺1°</button><button class="db xs" data-sv="t:-0.1">↺0.1°</button><button class="db xs" data-sv="t:0.1">0.1°↻</button><button class="db xs" data-sv="t:1">1°↻</button></div>
      <div class="tools"><button class="db sm" data-sv="line">Draw line</button><button class="db sm${this.arm === 'mark' ? ' on' : ''}" data-sv="mark">${this.arm === 'mark' ? 'Tap where you are' : 'Mark my position'}</button></div>
      <div class="tools"><button class="db sm" data-sv="undo" ${s.items.length ? '' : 'disabled'}>Undo</button><button class="db sm" data-sv="clear" ${s.items.length ? '' : 'disabled'}>${sure ? 'Clear: sure?' : 'Clear sheet'}</button><button class="db sm" data-sv="mid">Ruler here</button></div>
      <div class="tools"><button class="db sm primary" data-sv="sight">Sight</button><button class="db sm" data-sv="away">Put away</button></div>`;
  },
  debugPanel() {
    const el = $('mapdbg'), o = this.st().opts; $('mapdbgbtn').classList.toggle('on', this.dbgOpen); el.hidden = !this.dbgOpen; if (!this.dbgOpen) return;
    const ch = (k, v, l) => `<button class="db xs${o[k] === v ? ' on' : ''}" data-sv="o:${k}:${v}">${l}</button>`, start = SURVEY_STARTS.find(q => q.id === this.st().start);
    el.innerHTML = `<div class="opt"><b>Your position on the map</b>${ch('pos', 'always', 'Always')}${ch('pos', 'known', 'In the known land')}${ch('pos', 'never', 'Never')}</div>
      <div class="opt"><b>Land beyond the known map</b>${ch('unknown', 'drawn', 'Drawn as you go')}${ch('unknown', 'blank', 'Left blank')}</div>
      <div class="opt"><b>Compass needle</b>${ch('needle', 'swing', 'Swings and settles')}${ch('needle', 'steady', 'Steady and exact')}</div>
      <div class="opt"><b>Check your fixes</b>${ch('truth', true, 'Show where you are')}${ch('truth', false, 'Hide')}</div>
      <p class="dim">Started: ${esc(start ? start.name : 'Aldhaven')}. These belong to this game and are saved with it.</p>`;
  },
  act(a) {
    const s = this.st();
    if (a === 'dbg') { this.dbgOpen = !this.dbgOpen; this.debugPanel(); return; }
    if (a.startsWith('o:')) { const [, k, v] = a.split(':'); const was = this.showPos(); s.opts[k] = v === 'true' ? true : v === 'false' ? false : v;
      if (was && !this.showPos() && !MapView.view && MapView.tf) MapView.view = [MapView.tf.cx, MapView.tf.cz]; // (the map stops following you)
      this.debugPanel(); this.panel(); MapView.draw(); return; }
    if (a.startsWith('t:')) { this.turn(+a.slice(2)); return; }
    if (a.startsWith('del:')) { s.reads.splice(+a.slice(4), 1); this.panel(); return; }
    if (a === 'fold') { this.fold = !this.fold; this.panel(); return; }
    if (a === 'line') this.line();
    else if (a === 'mark') { this.arm = this.arm === 'mark' ? null : 'mark'; this.panel(); }
    else if (a === 'undo') this.undo();
    else if (a === 'clear') { if (performance.now() - this.sure < 3000) { s.items = []; this.sure = 0; MapView.draw(true); } else this.sure = performance.now(); this.panel(); }
    else if (a === 'mid') { const t = MapView.tf; if (t && s.ruler) { s.ruler.x = t.cx; s.ruler.z = t.cz; MapView.draw(true); this.panelRuler(); } }
    else if (a === 'sight') MapView.close();
    else if (a === 'away') this.close('You put the compass and the ruler away.');
  },
  // the unknown land, left blank: paper beyond the edge of the known map, which is drawn dashed
  blankOut(x, X, Z, W, H) {
    const E = this.edge(), path = () => { x.beginPath(); E.forEach(([px, pz], i) => i ? x.lineTo(X(px), Z(pz)) : x.moveTo(X(px), Z(pz))); };
    x.save(); x.fillStyle = '#2b2a20'; path(); x.closePath(); x.rect(0, 0, W, H); x.fill('evenodd');
    x.strokeStyle = 'rgba(200,180,130,0.45)'; x.lineWidth = 2; x.setLineDash([10, 6]); x.lineJoin = 'round'; path(); x.stroke(); x.restore();
  },
  // pencil lines and your marks (under the map's labels), and the landmarks you can sight while the kit is out
  drawMap(x, X, Z, t) {
    const s = this.st(), d = t.dpr; x.save(); x.lineCap = 'round';
    for (const it of s.items) if (it.k === 'line') { x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = Math.max(2, 2.6 * d); x.beginPath(); x.moveTo(X(it.ax), Z(it.az)); x.lineTo(X(it.bx), Z(it.bz)); x.stroke();
      x.strokeStyle = 'rgba(232,224,204,0.92)'; x.lineWidth = Math.max(1, 1.2 * d); x.stroke(); }
    if (this.on || this.sheet) for (const p of this.points()) { const px = X(p.x), pz = Z(p.z); x.strokeStyle = '#1b1712'; x.lineWidth = 3 * d; x.beginPath(); x.arc(px, pz, 4.5 * d, 0, 7); x.stroke(); x.strokeStyle = '#f0d27a'; x.lineWidth = 1.4 * d; x.stroke(); x.fillStyle = '#f0d27a'; x.fillRect(px - d, pz - d, 2 * d, 2 * d); }
    let n = 0; x.font = `${Math.round(13 * d)}px VT323, monospace`; x.textAlign = 'left'; x.textBaseline = 'middle';
    for (const it of s.items) if (it.k === 'mark') { n++; const px = X(it.x), pz = Z(it.z), r = 6 * d;
      x.strokeStyle = '#1b1712'; x.lineWidth = 3.5 * d; x.beginPath(); x.arc(px, pz, r, 0, 7); x.stroke(); x.strokeStyle = '#e8573a'; x.lineWidth = 1.8 * d; x.stroke(); x.fillStyle = '#e8573a'; x.beginPath(); x.arc(px, pz, 1.6 * d, 0, 7); x.fill();
      x.fillStyle = '#000'; x.fillText(String(n), px + r + 3 * d + 1, pz + 1); x.fillStyle = '#ffb49a'; x.fillText(String(n), px + r + 3 * d, pz); }
    x.restore();
  },
  // over everything: the ruler, and (to check your work) where you really are
  drawTop(x, X, Z, t) {
    const s = this.st(), d = t.dpr, P = G.player;
    if (s.opts.truth && P) { x.save(); x.font = `${Math.round(13 * d)}px VT323, monospace`; x.textBaseline = 'middle'; let n = 0;
      for (const it of s.items) if (it.k === 'mark') { n++; const a = [X(it.x), Z(it.z)], b = [X(it.tx), Z(it.tz)], m = Math.hypot(it.x - it.tx, it.z - it.tz);
        x.strokeStyle = '#ff6a4a'; x.lineWidth = 1.2 * d; x.setLineDash([4 * d, 3 * d]); x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); x.setLineDash([]);
        const txt = `${n}: ${m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m'} off`; x.textAlign = 'left'; x.fillStyle = '#000'; x.fillText(txt, a[0] + 10 * d + 1, a[1] + 12 * d + 1); x.fillStyle = '#ff9a7a'; x.fillText(txt, a[0] + 10 * d, a[1] + 12 * d); }
      const px = X(P.pos.x), pz = Z(P.pos.z), k = 7 * d; x.strokeStyle = '#000'; x.lineWidth = 4 * d; x.beginPath(); x.moveTo(px - k, pz - k); x.lineTo(px + k, pz + k); x.moveTo(px + k, pz - k); x.lineTo(px - k, pz + k); x.stroke(); x.strokeStyle = '#ff4a3a'; x.lineWidth = 2 * d; x.stroke();
      x.textAlign = 'left'; x.fillStyle = '#000'; x.fillText('you are here', px + k + 4 * d + 1, pz + 1); x.fillStyle = '#ff9a7a'; x.fillText('you are here', px + k + 4 * d, pz); x.restore(); }
    if (!this.sheet) return;
    if (!s.ruler) s.ruler = { x: t.cx, z: t.cz, a: 0 }; // (first laid in the middle of the sheet)
    const g = this.geo(t), Q = (al, ac) => [(g.cx + g.ux * al + g.nx * ac) * d, (g.cy + g.uy * al + g.ny * ac) * d];
    x.save(); x.beginPath(); [[-g.half, 0], [g.half, 0], [g.half, g.w], [-g.half, g.w]].forEach(([al, ac], i) => { const [px, py] = Q(al, ac); i ? x.lineTo(px, py) : x.moveTo(px, py); }); x.closePath();
    x.fillStyle = 'rgba(214,190,130,0.6)'; x.fill(); x.strokeStyle = 'rgba(50,34,16,0.9)'; x.lineWidth = 1.5 * d; x.stroke();
    x.strokeStyle = 'rgba(46,30,14,0.95)'; x.lineWidth = d; for (let k = -40; k <= 40; k++) { const al = k / 40 * g.half, L = k % 10 === 0 ? 13 : k % 5 === 0 ? 9 : 5; const [ax, ay] = Q(al, 0), [bx, by] = Q(al, L); x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); }
    { const [ax, ay] = Q(-g.half, 0), [bx, by] = Q(g.half, 0); x.strokeStyle = '#1e1408'; x.lineWidth = 1.6 * d; x.beginPath(); x.moveTo(ax, ay); x.lineTo(bx, by); x.stroke(); } // the drawing edge, through the pin
    for (const sg of [-1, 1]) { const [kx, ky] = Q(sg * (g.half - 20), g.w / 2 + 2); x.fillStyle = 'rgba(110,76,36,0.95)'; x.strokeStyle = '#1e1408'; x.lineWidth = 1.5 * d; x.beginPath(); x.arc(kx, ky, 10 * d, 0, 7); x.fill(); x.stroke();
      x.strokeStyle = '#e8d29a'; x.lineWidth = 1.4 * d; x.beginPath(); x.arc(kx, ky, 5.5 * d, -2.4, 1.6); x.stroke(); } // the knobs to turn it by
    const [pX, pY] = Q(0, 0); x.fillStyle = '#e8c860'; x.strokeStyle = '#1e1408'; x.lineWidth = 1.6 * d; x.beginPath(); x.arc(pX, pY, 4.5 * d, 0, 7); x.fill(); x.stroke(); // the pin
    const [lx, ly] = Q(0, g.w + 16), txt = this.rulerText(); x.font = `${Math.round(17 * d)}px VT323, monospace`; x.textAlign = 'center'; x.textBaseline = 'middle'; const tw = x.measureText(txt).width + 12 * d;
    x.fillStyle = 'rgba(20,16,12,0.85)'; x.fillRect(lx - tw / 2, ly - 10 * d, tw, 20 * d); x.fillStyle = '#f0d890'; x.fillText(txt, lx, ly + d);
    x.restore();
  },
};
