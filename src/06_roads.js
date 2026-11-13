/* =====================================================================
   Travellers on the roads: merchants, pilgrims, farmers, a patrol, a
   wandering knight. They walk the tracks out in the country, a few at a
   time round the player, appearing and leaving well out of sight, and
   stop for a word if spoken to.
   ===================================================================== */
const TRAVELLER_KINDS = [
  { trade: 'A travelling merchant', w: 3, speed: 1.15, look: r => ({ ...lookByWealth(r, 'm', 2), cape: '#5a3a1e', hat: '#3a2a1a' }), g: 'm' },
  { trade: 'A pilgrim on the road to the shrines', w: 2, speed: 1.0, look: (r, g) => ({ ...lookByWealth(r, g, 0.8), robe: '#6a5a46', hat: null }) },
  { trade: 'A farmer on the way to market', w: 3, speed: 1.1, look: (r, g) => lookByWealth(r, g, 0.7) },
  { trade: 'A courier of the Aldhaven court', w: 1, speed: 1.55, look: r => ({ ...lookByWealth(r, 'm', 2.2), cape: '#2a4a8a' }), g: 'm' },
  { trade: 'A soldier of the road patrol', w: 1.5, speed: 1.2, look: () => LOOKS.guard, g: 'm', pair: true },
  { trade: 'A wandering knight', w: 0.6, speed: 1.2, look: r => ({ ...lookByWealth(r, 'm', 3), cape: '#7a1e1e' }), g: 'm' },
  { trade: 'A peddler of pots and ribbons', w: 1.5, speed: 1.0, look: (r, g) => ({ ...lookByWealth(r, g, 1.2), apron: '#8a7a5a' }) },
];
const Roads = {
  list: [], t: 0,
  want() { const n = isNight(G.time) ? 1 : 4; return n; },
  update(dt) {
    if (!Wild.on || G.area !== G.city || !G.player) return;
    const P = G.player, px = P.pos.x, pz = P.pos.z;
    this.list = this.list.filter(e => { if (e.removed) return false; const d = Math.hypot(e.pos.x - px, e.pos.z - pz); if (d > 700 || e.data.done) { e.remove(); return false; } return true; });
    this.t -= dt; if (this.t > 0) return; this.t = 3 + rnd.next() * 4;
    if (this.list.length >= this.want() || Math.max(Math.abs(px), Math.abs(pz)) < TG.R - 60) return;
    // a point on a track some way off (not under the player's nose), outside the surveyed land
    const T = Wild.tracks; const cand = [];
    for (let ti = 0; ti < T.length; ti++) if (!T[ti].lane) for (let q = 0; q < T[ti].length; q += 20) { /* (on the tracks; the lanes are the farmers' own) */ const [x, z] = T[ti][q], d = Math.hypot(x - px, z - pz); if (d > 260 && d < 560 && Math.max(Math.abs(x), Math.abs(z)) > TG.R + 20) cand.push([ti, q]); }
    if (!cand.length) return;
    const [ti, q] = rnd.pick(cand), tot = TRAVELLER_KINDS.reduce((a, k) => a + k.w, 0); let r = rnd.next() * tot, K = TRAVELLER_KINDS[0], ki = 0; for (const k of TRAVELLER_KINDS) { r -= k.w; if (r <= 0) { K = k; break; } ki++; } ki = Math.min(ki, TRAVELLER_KINDS.length - 1);
    const dir = rnd.chance(0.5) ? 1 : -1, n = K.pair || rnd.chance(0.15) ? 2 : 1;
    for (let m = 0; m < n; m++) {
      const v = rnd.int(0, 11), rr = new RNG(9100 + ki * 53 + v), g = K.g || (rr.chance(0.5) ? 'f' : 'm'), qq = clamp(q - dir * m * 2, 0, T[ti].length - 1), [x, z] = T[ti][qq];
      const e = spawnNPC(G.city, { name: K.trade === 'A soldier of the road patrol' ? 'Road Warden' : personName(rr, g), look: K.look(rr, g), gender: g, x: x + rr.range(-0.8, 0.8), z: z + rr.range(-0.8, 0.8), role: 'traveller', dialog: 'traveler', speed: K.speed * rr.range(0.92, 1.08), spriteKey: `trav${ki}_${v}`, data: { trade: K.trade, ti, q: qq, dir, lane: dir * 0.9 } });
      this.list.push(e);
    }
  },
  // a traveller walks the track, keeping to its side of the way, and stops when spoken to or at the end
  step(e, dt) {
    const D = e.data, T = Wild.tracks[D.ti]; if (!T) { e.moving = false; return; }
    if (G.uiOpen && UI.is('dialog')) { e.moving = false; return; }
    const q = clamp(D.q + D.dir * 3, 0, T.length - 1), a = T[Math.max(0, q - 1)], b = T[Math.min(T.length - 1, q + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const tx = T[q][0] - (b[1] - a[1]) / l * D.lane, tz = T[q][1] + (b[0] - a[0]) / l * D.lane;
    if (moveEnt(e, tx, tz, e.speed, dt) || Math.hypot(tx - e.pos.x, tz - e.pos.z) < 2) { D.q = q; if (q === 0 || q === T.length - 1) D.done = true; }
  },
};
