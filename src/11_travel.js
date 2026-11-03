/* =====================================================================
   Fast travel on foot. The whole game runs faster while you travel: you
   walk the real way there (the world streams past), time and the people
   around you speed up with you. Three ways to go:
   - by road to a place picked on the map (city streets, gate roads,
     tracks and the roads to the landmarks form one network)
   - straight towards a place picked on the map, across country
   - straight ahead, or along the road you stand on, until something stops you.
   Any key, a tap on the banner, a landmark or a find on the way, danger,
   water or a wall ends the journey.
   ===================================================================== */
const Travel = {
  cur: null, graph: null, lookT: 0,
  SPEEDS: [5, 10, 20, 40],
  rate() { return settings.travelSpeed || 20; },

  /* ---------- the road network ---------- */
  buildGraph() {
    const X = [], Z = [], A = [], hash = new Map(), HC = 40;
    const key = (x, z) => Math.floor(x / HC) * 100003 + Math.floor(z / HC);
    const add = (x, z) => { const k = X.length; X.push(x); Z.push(z); A.push([]); const hk = key(x, z); let l = hash.get(hk); if (!l) hash.set(hk, l = []); l.push(k); return k; };
    const link = (a, b) => { if (a === b || A[a].includes(b)) return; A[a].push(b); A[b].push(a); };
    const near = (x, z, r, skip) => { let best = -1, bd = r; for (let i = Math.floor((x - r) / HC); i <= Math.floor((x + r) / HC); i++) for (let j = Math.floor((z - r) / HC); j <= Math.floor((z + r) / HC); j++) { const l = hash.get(i * 100003 + j); if (l) for (const k of l) { if (skip && skip.has(k)) continue; const d = Math.hypot(X[k] - x, Z[k] - z); if (d < bd) { bd = d; best = k; } } } return best; };
    const city = G.city, M = city.map;
    // the streets of the city as they are
    const base = X.length; for (const n of city.nodes) add(n.x, n.z); city.nodes.forEach((n, i) => { for (const j of n.n) link(base + i, base + j); });
    // a polyline joins where it starts and ends to whatever lies nearest (the streets, a gate road, another track)
    const line = (pts, step = 1) => { if (!pts || pts.length < 2) return; const own = new Set(), ks = [];
      for (let q = 0; q < pts.length; q += step) { const k = add(pts[q][0], pts[q][1]); own.add(k); ks.push(k); }
      if ((pts.length - 1) % step) { const k = add(pts[pts.length - 1][0], pts[pts.length - 1][1]); own.add(k); ks.push(k); }
      for (let q = 1; q < ks.length; q++) link(ks[q - 1], ks[q]);
      for (const k of [ks[0], ks[ks.length - 1]]) { const j = near(X[k], Z[k], 40, own); if (j >= 0) link(k, j); } };
    for (const pts of M.outside || []) line(pts);
    if (M.hillPath) line(M.hillPath);
    for (const T of Wild.tracks) line(T, 4);
    for (const S of SITES) if (S.id === 'mirrormere') line([[S.x + 126, S.z + 2], [S.x + 200, S.z - 2], [S.x + 280, S.z]]);
    // a second pass: an end that found nothing (it was laid before its neighbour) tries again
    for (let k = 0; k < X.length; k++) if (A[k].length === 1) { const j = near(X[k], Z[k], 40, new Set([k, A[k][0]])); if (j >= 0 && Math.hypot(X[j] - X[k], Z[j] - Z[k]) < 40) link(k, j); }
    this.graph = { X, Z, A, near };
  },
  nearestNode(x, z, r = 600) { const g = this.graph; let k = g.near(x, z, r); if (k < 0) k = g.near(x, z, 4000); return k; },
  // the way by road between two points: off the road to the nearest node, along the network, off it again to the goal
  route(x0, z0, x1, z1) {
    if (!this.graph) this.buildGraph(); const g = this.graph, N = g.X.length;
    const s = this.nearestNode(x0, z0), t = this.nearestNode(x1, z1); if (s < 0 || t < 0) return null;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), heap = [[0, s]]; dist[s] = 0;
    const push = (d, i) => { heap.push([d, i]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
    while (heap.length) { const [d, i] = pop(); if (d > dist[i]) continue; if (i === t) break; for (const j of g.A[i]) { const nd = d + Math.hypot(g.X[j] - g.X[i], g.Z[j] - g.Z[i]); if (nd < dist[j]) { dist[j] = nd; prev[j] = i; push(nd, j); } } }
    if (!isFinite(dist[t])) return null;
    const pts = [[x0, z0]]; const path = []; for (let k = t; k >= 0; k = prev[k]) path.push(k); path.reverse();
    for (const k of path) pts.push([g.X[k], g.Z[k]]); pts.push([x1, z1]);
    const len = pts.reduce((a, p, q) => q ? a + Math.hypot(p[0] - pts[q - 1][0], p[1] - pts[q - 1][1]) : 0, 0), straight = Math.hypot(x1 - x0, z1 - z0);
    if (straight < 60 || len > straight * 6 && straight < 400) return { pts: [[x0, z0], [x1, z1]], len: straight, road: false }; // close by: just walk there
    return { pts, len, road: true, off: Math.hypot(g.X[s] - x0, g.Z[s] - z0) };
  },
  // the road you stand on, onwards in the direction you face, to the next fork or its end
  roadAhead(x, z, yaw) {
    if (!this.graph) this.buildGraph(); const g = this.graph, k0 = g.near(x, z, 25); if (k0 < 0) return null;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw); let best = -1, bs = -0.2;
    for (const j of g.A[k0]) { const dx = g.X[j] - g.X[k0], dz = g.Z[j] - g.Z[k0], l = Math.hypot(dx, dz) || 1, s = (dx * fx + dz * fz) / l; if (s > bs) { bs = s; best = j; } }
    if (best < 0) return null;
    const pts = [[x, z], [g.X[k0], g.Z[k0]]]; let prev = k0, cur = best, len = 0;
    for (let n = 0; n < 6000; n++) {
      pts.push([g.X[cur], g.Z[cur]]); len += Math.hypot(g.X[cur] - g.X[prev], g.Z[cur] - g.Z[prev]);
      const next = g.A[cur].filter(j => j !== prev); if (next.length !== 1 || len > 30000) break; // a fork, a junction, or the end
      prev = cur; cur = next[0];
    }
    return pts.length > 2 ? { pts, len, road: true } : null;
  },

  /* ---------- the journey ---------- */
  start(o) {
    const P = G.player; if (!P || P.dead || G.area !== G.city) { msg('You can only travel this way out in the open.'); return false; }
    if (G.flying) setFlying(false);
    if (rpgUI() && nearbyHostiles(30)) { msg('You cannot travel with enemies nearby.', 'bad'); return false; }
    const pts = o.pts.map(p => p.slice()), cum = [0]; for (let q = 1; q < pts.length; q++) cum.push(cum[q - 1] + Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]));
    this.cur = { ...o, pts, cum, s: 0, seg: 0, t0: G.time, moved: 0, chk: { s: 0, t: 0 }, stuck: 0, detour: 0, detourT: 0 };
    $('travelinfo').hidden = false; this.lookT = 0; this.banner();
    msg(o.mode === 'ahead' ? 'You set off.' : `You set off ${o.road ? 'by road' : 'across country'} towards ${o.name}.`);
    return true;
  },
  stop(text, cls) {
    if (!this.cur) return; const c = this.cur; this.cur = null; $('travelinfo').hidden = true; Wild.fast = false;
    const mins = Math.round(G.time - c.t0), d = Math.round(c.moved);
    if (text !== null) msg(`${text || 'You stop.'} (${d >= 1000 ? (d / 1000).toFixed(1) + ' km' : d + ' m'} in ${mins >= 120 ? Math.floor(mins / 60) + ' hours' + (mins % 60 ? ' ' + (mins % 60) + ' min' : '') : mins + ' minutes'})`, cls);
  },
  // how much faster than life the world runs this frame: slower while the ground ahead is still being built
  k() {
    const c = this.cur; if (!c) return 1; const P = G.player; let k = this.rate();
    const w = Wild.wanted(P.pos.x, P.pos.z); if (w.length) { const d = w[0].d; if (d < 100) k = Math.min(k, 3); else if (d < 200) k = Math.min(k, k * 0.5); }
    return Math.max(1, k);
  },
  // one frame of travel: dt is real seconds; returns the game seconds that passed
  update(dt) {
    const c = this.cur, P = G.player;
    if (Input.stick.x || Input.stick.y) { this.stop('You stop.'); return dt; }
    if (Input.mdx || Input.mdy) this.lookT = 2; this.lookT -= dt;
    const k = this.k(), sdt = dt * k; Wild.fast = true;
    let left = sdt; while (left > 1e-4 && this.cur) { const h = Math.min(0.2, left); left -= h; this.step(h); }
    updatePlayer(0); // the view: free to look about, else it turns to the way ahead
    if (this.cur) this.banner();
    return sdt - left;
  },
  step(h) {
    const c = this.cur, P = G.player, spd = playerSpeed() * 1.15;
    // where along the way we are: the nearest point on the next few legs
    let bs = c.s, bq = c.seg, bd = 1e9;
    for (let q = c.seg; q < Math.min(c.pts.length - 1, c.seg + 6); q++) { const [ax, az] = c.pts[q], [bx, bz] = c.pts[q + 1], r = segDist(P.pos.x, P.pos.z, ax, az, bx, bz); if (r.d < bd) { bd = r.d; bq = q; bs = c.cum[q] + r.t * (c.cum[q + 1] - c.cum[q]); } }
    c.seg = bq; c.s = Math.max(c.s, bs);
    const L = c.cum[c.cum.length - 1];
    if (c.mode !== 'ahead' && L - c.s < 2.5) { this.stop(c.arrive || `You arrive at ${c.name}.`, 'good'); return; }
    // aim a few paces ahead along the way, so the bends are walked round, not cut zig-zag
    const look = Math.min(L, c.s + 7); let q = c.seg; while (q < c.cum.length - 2 && c.cum[q + 1] < look) q++;
    const f = (look - c.cum[q]) / ((c.cum[q + 1] - c.cum[q]) || 1), tx = lerp(c.pts[q][0], c.pts[q + 1][0], f), tz = lerp(c.pts[q][1], c.pts[q + 1][1], f);
    let dx = tx - P.pos.x, dz = tz - P.pos.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    if (c.detourT > 0) { c.detourT -= h; const a = c.detour, cs = Math.cos(a), sn = Math.sin(a); [dx, dz] = [dx * cs - dz * sn, dx * sn + dz * cs]; }
    // the water's edge, the sea or the mere, ends a cross-country walk
    const ax = P.pos.x + dx * 3, az = P.pos.z + dz * 3; if (terrainH(ax, az) < SEA + 0.15 && !c.road) { this.stop('The water bars your way.'); return; }
    const ox = P.pos.x, oz = P.pos.z, st = spd * h;
    P.pos.x += dx * st; P.pos.z += dz * st;
    collide(G.area, P.pos, 0.38, P.pos.y, 1.75); keepAshore(G.area, P.pos, ox, oz, 0.38, P.pos.y);
    if (Math.max(Math.abs(P.pos.x), Math.abs(P.pos.z)) > TG.R) wildFooting(P, ox, oz);
    P.pos.y = groundAt(G.area, P.pos.x, P.pos.z, 0.38, P.pos.y + 0.6); P.vy = 0; P.onGround = true;
    const moved = Math.hypot(P.pos.x - ox, P.pos.z - oz); c.moved += moved; P.bob += moved * 0.4;
    P.stepT -= moved / 1.15; if (P.stepT <= 0) { P.stepT = 1.9 * 3; SFX.play('step'); } // (fewer steps heard at speed)
    if (this.lookT <= 0) { const want = Math.atan2(-dx, -dz); let d = want - P.yaw; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; P.yaw += d * Math.min(1, h * 1.5); P.pitch = lerp(P.pitch, -0.03, Math.min(1, h)); }
    // blocked: try to step round it, then give up
    c.chk.t += h; if (c.chk.t > 2.5) { const prog = c.moved - c.chk.s; c.chk = { s: c.moved, t: 0 };
      if (prog < spd * 2.5 * 0.3) { c.stuck++; if (c.stuck > 4) { this.stop('Your way is blocked.'); return; } c.detour = (c.stuck % 2 ? 1 : -1) * (0.6 + 0.3 * c.stuck); c.detourT = 3; } else c.stuck = Math.max(0, c.stuck - 1); }
    // something worth stopping for
    const site = Sites.update(P.pos.x, P.pos.z); if (site && this.cur) { this.stop(`You come upon ${site.name}.`, 'good'); return; }
    const poi = POI.update(P.pos.x, P.pos.z); if (poi && this.cur) { this.stop(`You come upon ${poi.name}.`, 'good'); return; }
    if (rpgUI() && nearbyHostiles(35)) { this.stop('Something stirs nearby. You stop.', 'bad'); return; }
    if (c.mode === 'ahead' && (rimDist(P.pos.x, P.pos.z) < 300)) { this.stop('The mountains rise sheer ahead of you.'); }
  },
  banner() {
    const c = this.cur; if (!c) return; const L = c.cum[c.cum.length - 1], left = Math.max(0, L - c.s);
    const where = c.mode === 'ahead' ? (c.road ? 'Following the road' : 'Walking on') : `To ${c.name}${c.road ? ' by road' : ''} · ${left >= 1000 ? (left / 1000).toFixed(1) + ' km' : Math.round(left) + ' m'} to go`;
    $('travelinfo').textContent = `${where} · ×${Math.round(this.k())} · ${clockString(G.time)}  (${Input.touch ? 'tap here' : 'any key'} to stop)`;
  },

  /* ---------- the ways to set off ---------- */
  toward(x, z, name, byRoad) {
    const P = G.player;
    if (!byRoad) return this.start({ mode: 'straight', pts: [[P.pos.x, P.pos.z], [x, z]], name, road: false });
    const r = this.route(P.pos.x, P.pos.z, x, z); if (!r) { msg('There is no road there that you know of.'); return false; }
    return this.start({ mode: 'road', pts: r.pts, name, road: r.road });
  },
  ahead(followRoad) {
    const P = G.player;
    if (followRoad) { const r = this.roadAhead(P.pos.x, P.pos.z, P.yaw); if (!r) { msg('There is no road here to follow.'); return false; } return this.start({ mode: 'ahead', pts: r.pts, road: true, name: 'the road', arrive: 'The road forks here.' }); }
    const fx = -Math.sin(P.yaw), fz = -Math.cos(P.yaw);
    return this.start({ mode: 'ahead', pts: [[P.pos.x, P.pos.z], [P.pos.x + fx * 30000, P.pos.z + fz * 30000]], road: false, name: 'on' });
  },
  // the places you can name as a goal: the city, and the landmarks you have found or heard of
  goals() {
    const P = G.player, found = G.flags.found || {}, heard = G.flags.heard || {}, out = [];
    if (!insideCity(P.pos.x, P.pos.z, -5)) { const s = G.city.stops.find(q => q.id === 'market'); out.push({ id: 'city', name: 'Daggerfall', sub: 'the Grand Market', x: s.arrive[0], z: s.arrive[1] }); }
    for (const S of SITES) if (found[S.id] || heard[S.id]) out.push({ id: S.id, name: S.name, sub: found[S.id] ? capFirst(S.blurb.split(',')[0]) : 'heard of, not yet seen', x: S.road[0][0], z: S.road[0][1] });
    for (const p of POI.list) if (POI.found(p)) out.push({ id: p.id, name: capFirst(p.name), sub: 'found on your travels', x: p.x, z: p.z });
    return out.map(o => ({ ...o, d: Math.hypot(o.x - P.pos.x, o.z - P.pos.z) })).sort((a, b) => a.d - b.d);
  },
};
