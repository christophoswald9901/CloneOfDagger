/* =====================================================================
   The world beyond the home country: countries are planned as the player
   nears them, a little each frame, and forgotten again far behind. A
   country's plan is the same whenever and in whatever order it is made:
   it is worked out from its own land alone (World.only), and what crosses
   a border (a great river through its gap, a road over its pass) is fixed
   by the border itself (edgeFeat, in 03_terrain.js).
   ===================================================================== */
Object.assign(World, {
  ready: [], rev: 0, _all: {}, job: null, NEED: 3700, SOON: 6200, DROP: 15000, planMs: [], onReady: null,
  // lists across every planned country (the home country's own while it is the only one)
  pick(K, kind) { return kind === 'tracks' ? (K.ways ? K.ways.tracks : []) : kind === 'bridges' ? (K.ways ? K.ways.bridges : []) : kind === 'rivers' ? K.land.rivers : K.settle ? (kind === 'places' ? K.settle.list : K.settle[kind] || []) : []; },
  all(kind) {
    const base = this.pick(this.home, kind); if (!this.ready.length) return base;
    const c = this._all[kind]; if (c && c.rev === this.rev && c.n === base.length) return c.list;
    let list = base.slice(); for (const K of this.ready) list = list.concat(this.pick(K, kind));
    this._all[kind] = { rev: this.rev, n: base.length, list }; return list;
  },
  finishHome() { Settle.finishHome(); this.home.state = 2; },
  // how far a point lies from a country's box
  boxDist(i, j, x, z) { const home = isHomeTile(i, j), x0 = home ? WORLD.x0 : WORLD.x0 + i * TILE, x1 = home ? WORLD.x1 : x0 + TILE, z0 = home ? WORLD.z0 : WORLD.z0 + j * TILE, z1 = home || j >= 1 ? 1e12 : z0 + TILE; return Math.hypot(Math.max(0, x0 - x, x - x1), Math.max(0, z0 - z, z - z1)); },
  // the countries within r of a point that are not planned yet, nearest first
  missing(x, z, r) { const out = []; for (let i = tileI(x - r); i <= tileI(x + r); i++) for (let j = tileJ(z - r); j <= tileJ(z + r); j++) { if (isHomeTile(i, j)) continue; const K = this.get(i, j); if (K && K.state === 2) continue; const d = this.boxDist(i, j, x, z); if (d < r) out.push({ i, j, d, K }); } return out.sort((a, b) => a.d - b.d); },
  // true when every country a box touches (with a margin) is planned
  readyIn(x0, z0, x1, z1, m) { for (let i = tileI(x0 - m); i <= tileI(x1 + m); i++) for (let j = tileJ(z0 - m); j <= tileJ(z1 + m); j++) { if (isHomeTile(i, j)) continue; const K = this.get(i, j); if (!K || K.state !== 2) return false; } return true; },
  // a country's whole plan, in steps: its rivers and the lie of its land, its ways, its settlement, the places in it
  *planGen(K) {
    const t0 = performance.now(); K.state = 1; K.cpu = 0;
    yield* planLandGen(K);
    K.ways = makeWays(K); yield* K.ways.planCountry();
    K.settle = makeSettle(K); yield* K.settle.planGen(); yield;
    K.settle.classifyWays(); yield;
    POI.plan(K);
    K.state = 2; K.wall = performance.now() - t0; this.ready.push(K); this.rev++; this.planMs.push(Math.round(K.cpu));
    if (this.onReady) this.onReady(K);
  },
  // run the plan in hand for up to ms milliseconds (each step sees only that country's own plan)
  step(ms) {
    const J = this.job; if (!J) return false; const t0 = performance.now(), o = this.only; this.only = J.K; let done = false, n = 0, worst = 0, t1 = t0;
    try { for (;;) { done = J.gen.next().done; n++; const t = performance.now(); worst = Math.max(worst, t - t1); t1 = t; if (done || t - t0 >= ms) break; } }
    catch (e) { console.error('country plan failed', J.K.i, J.K.j, e); done = true; J.K.state = 2; J.K.failed = true; if (!this.ready.includes(J.K)) this.ready.push(J.K); this.rev++; }
    finally { this.only = o; }
    J.K.cpu += performance.now() - t0; this.worstStep = Math.max(this.worstStep || 0, worst);
    if (done) this.job = null; return true;
  },
  start(i, j) { const K = this.get(i, j) || this.make(i, j); this.job = { K, gen: this.planGen(K) }; return K; },
  // each frame: plan what the player is coming to (more of the frame when it is already in sight), forget what lies far behind
  update(x, z, fast) {
    if (!this.job) { const m = this.missing(x, z, this.SOON); if (m.length) this.start(m[0].i, m[0].j); }
    if (this.job) { const K = this.job.K, d = this.boxDist(K.i, K.j, x, z); this.step(d < this.NEED ? 12 : fast ? 8 : 4); }
    if (this.ready.length > 4 && !(this.tick = ((this.tick || 0) + 1) % 120)) for (const K of this.ready.slice()) if (this.boxDist(K.i, K.j, x, z) > this.DROP) this.drop(K);
  },
  // everything in sight of a place, at once (a loaded game, a journey's end, the tools)
  prime(x, z) { for (let n = 0; n < 12; n++) { const J = this.job; if (J && this.boxDist(J.K.i, J.K.j, x, z) < this.NEED) { while (this.job === J) this.step(1e9); continue; }
      const m = this.missing(x, z, this.NEED).filter(q => !J || q.K !== J.K); if (!m.length) break; const keep = this.job; this.job = null; this.start(m[0].i, m[0].j); while (this.job) this.step(1e9); this.job = keep; } },
  // every country a box touches, at once (the tools' maps)
  planBox(x0, z0, x1, z1) { const keep = this.job; let n = 0; for (let i = tileI(x0); i <= tileI(x1); i++) for (let j = tileJ(z0); j <= tileJ(z1); j++) { if (isHomeTile(i, j)) continue; const K = this.get(i, j); if (K && K.state === 2) continue; if (keep && keep.K === K) { while (this.job === keep) this.step(1e9); } else { this.job = null; this.start(i, j); while (this.job) this.step(1e9); } n++; } if (this.job !== keep && keep && keep.K.state !== 2) this.job = keep; return n; },
  drop(K) { const q = this.ready.indexOf(K); if (q < 0 || K.home) return; this.ready.splice(q, 1); this.map.delete(this.key(K.i, K.j)); this.list.splice(this.list.indexOf(K), 1); if (this._k === K) this._k = null; POI.forget(K); this.rev++; if (this.onDrop) this.onDrop(K); },
});
