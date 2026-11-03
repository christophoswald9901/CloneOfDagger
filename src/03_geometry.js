/* =====================================================================
   Geometry builder (merged, vertex-lit meshes), areas, colliders
   ===================================================================== */

class GB {
  constructor(opts = {}) { this.g = new Map(); this.light = opts.light || null; this.sub = opts.sub || 0; this.xf = null; this.tint = null; }
  // optional local frame: everything added while xf is set is rotated by xf.ang about y and moved to (xf.x, xf.y, xf.z)
  setXf(x, z, ang = 0, y = 0) { this.xf = makeXf(x, z, ang, y); return this.xf; }
  _p(p) { const f = this.xf; return f ? [f.x + p[0] * f.c + p[2] * f.s, p[1] + f.y, f.z - p[0] * f.s + p[2] * f.c] : p; }
  _n(n) { const f = this.xf; return f ? [n[0] * f.c + n[2] * f.s, n[1], -n[0] * f.s + n[2] * f.c] : n; }
  grp(k) { let g = this.g.get(k); if (!g) { g = { p: [], u: [], c: [], i: [] }; this.g.set(k, g); } return g; }
  col(p, n, tint) {
    let r, g, b;
    if (this.light) [r, g, b] = this.light(p, n);
    else { const d = Math.max(0, v3dot(n, TERRAIN_LIGHT)); const k = 0.48 + 0.82 * d; r = k * lerp(0.78, 1.18, d); g = k * lerp(0.86, 1.0, d); b = k * lerp(1.1, 0.74, d); } // warm low sun from the east-south-east, cool shade
    if (tint) { r *= tint[0]; g *= tint[1]; b *= tint[2]; }
    if (this.tint) { r *= this.tint[0]; g *= this.tint[1]; b *= this.tint[2]; }
    return [r, g, b];
  }
  // quad: origin o, unit vectors U (width) and V (height); front face normal = U × V
  quad(k, o, U, V, w, h, tw, th, opt = {}) {
    const g = this.grp(k); const n = this._n(v3cross(U, V)); const sub = opt.sub ?? this.sub;
    const nu = sub ? Math.max(1, Math.ceil(w / sub)) : 1, nv = sub ? Math.max(1, Math.ceil(h / sub)) : 1;
    const u0 = opt.u0 ?? (v3dot(o, U) / tw), v0 = opt.v0 ?? ((V[1] > 0.99 ? o[1] : v3dot(o, V)) / th);
    const base = g.p.length / 3;
    for (let j = 0; j <= nv; j++) for (let i = 0; i <= nu; i++) {
      const a = w * i / nu, b = h * j / nv;
      const p = this._p([o[0] + U[0] * a + V[0] * b, o[1] + U[1] * a + V[1] * b, o[2] + U[2] * a + V[2] * b]);
      g.p.push(p[0], p[1], p[2]);
      if (opt.fixedUV) g.u.push(opt.flipU ? 1 - i / nu : i / nu, j / nv); else g.u.push(u0 + a / tw, v0 + b / th);
      const c = this.col(p, n, opt.tint); g.c.push(c[0], c[1], c[2]);
    }
    for (let j = 0; j < nv; j++) for (let i = 0; i < nu; i++) {
      const a = base + j * (nu + 1) + i, b = a + 1, c = a + nu + 2, d = a + nu + 1;
      g.i.push(a, b, c, a, c, d);
      if (opt.double) g.i.push(a, c, b, a, d, c);
    }
  }
  // axis-aligned box. k is a key or {side, top, bottom}; skip: letters of faces to omit (n,s,e,w,t,b)
  box(x0, y0, z0, x1, y1, z1, k, tw, th, opt = {}) {
    const ks = typeof k === 'string' ? { side: k, top: k, bottom: null } : k; const sk = opt.skip || '';
    const w = x1 - x0, h = y1 - y0, d = z1 - z0;
    if (!sk.includes('s')) this.quad(ks.side, [x0, y0, z1], [1, 0, 0], [0, 1, 0], w, h, tw, th, opt);
    if (!sk.includes('n')) this.quad(ks.side, [x1, y0, z0], [-1, 0, 0], [0, 1, 0], w, h, tw, th, opt);
    if (!sk.includes('e')) this.quad(ks.side, [x1, y0, z1], [0, 0, -1], [0, 1, 0], d, h, tw, th, opt);
    if (!sk.includes('w')) this.quad(ks.side, [x0, y0, z0], [0, 0, 1], [0, 1, 0], d, h, tw, th, opt);
    if (!sk.includes('t') && ks.top) this.quad(ks.top, [x0, y1, z1], [1, 0, 0], [0, 0, -1], w, d, opt.ttw ?? tw, opt.ttw ?? tw, opt);
    if (!sk.includes('b') && ks.bottom) this.quad(ks.bottom, [x0, y0, z0], [1, 0, 0], [0, 0, 1], w, d, tw, tw, opt);
  }
  tri(k, a, b, c, ua, ub, uc, hint) {
    if (this.xf) { a = this._p(a); b = this._p(b); c = this._p(c); if (hint) hint = this._n(hint); }
    const g = this.grp(k); let n = v3norm(v3cross(v3sub(b, a), v3sub(c, a)));
    if (hint && v3dot(n, hint) < 0) { [b, c] = [c, b]; [ub, uc] = [uc, ub]; n = [-n[0], -n[1], -n[2]]; }
    const base = g.p.length / 3;
    for (const [p, uv] of [[a, ua], [b, ub], [c, uc]]) { g.p.push(p[0], p[1], p[2]); g.u.push(uv[0], uv[1]); const cc = this.col(p, n); g.c.push(cc[0], cc[1], cc[2]); }
    g.i.push(base, base + 1, base + 2);
  }
  quad4(k, a, b, c, d, ua, ub, uc, ud, hint) { this.tri(k, a, b, c, ua, ub, uc, hint); this.tri(k, a, c, d, ua, uc, ud, hint); }
  cyl(k, cx, cz, r, y0, y1, segs, tw, th, opt = {}) {
    const circ = 2 * Math.PI * r;
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2, m = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const p2 = [p1[0], y1, p1[2]], p3 = [p0[0], y1, p0[2]];
      const u0 = i / segs * circ / tw, u1 = (i + 1) / segs * circ / tw;
      const hint = opt.inward ? [-Math.cos(m), 0, -Math.sin(m)] : [Math.cos(m), 0, Math.sin(m)];
      this.quad4(k, p0, p1, p2, p3, [u0, y0 / th], [u1, y0 / th], [u1, y1 / th], [u0, y1 / th], hint);
      if (opt.top) this.tri(opt.top, [cx, y1, cz], p3, p2, [cx / tw, cz / tw], [p3[0] / tw, p3[2] / tw], [p2[0] / tw, p2[2] / tw], [0, 1, 0]);
    }
  }
  cone(k, cx, cz, r, y0, h, segs, tw) {
    const slant = Math.hypot(r, h);
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2, m = (a0 + a1) / 2;
      const p0 = [cx + Math.cos(a0) * r, y0, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y0, cz + Math.sin(a1) * r];
      const seg = 2 * Math.PI * r / segs;
      this.tri(k, p0, p1, [cx, y0 + h, cz], [0, 0], [seg / tw, 0], [seg / tw / 2, slant / tw], [Math.cos(m), 0.6, Math.sin(m)]);
    }
  }
  disc(k, cx, y, cz, r, segs, tw) {
    for (let i = 0; i < segs; i++) {
      const a0 = i / segs * Math.PI * 2, a1 = (i + 1) / segs * Math.PI * 2;
      const p0 = [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], p1 = [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r];
      this.tri(k, [cx, y, cz], p0, p1, [cx / tw, cz / tw], [p0[0] / tw, p0[2] / tw], [p1[0] / tw, p1[2] / tw], [0, 1, 0]);
    }
  }
  build(mats) {
    const grp = new THREE.Group();
    for (const [k, g] of this.g) {
      if (!g.i.length) continue;
      const m = mats[k]; if (!m) { console.warn('missing material', k); continue; }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(g.p, 3));
      geo.setAttribute('uv', new THREE.Float32BufferAttribute(g.u, 2));
      geo.setAttribute('color', new THREE.Float32BufferAttribute(g.c, g.rgba ? 4 : 3));
      geo.setIndex(g.i); geo.computeBoundingSphere();
      const mesh = new THREE.Mesh(geo, m); mesh.matrixAutoUpdate = false; mesh.updateMatrix(); grp.add(mesh);
    }
    return grp;
  }
}

// roofs
function gableRoof(gb, key, wallKey, x0, z0, x1, z1, h, rh, ov, alongX) {
  const tw = 3;
  if (alongX) {
    const zc = (z0 + z1) / 2, half = (z1 - z0) / 2, drop = ov * rh / half, sl = Math.hypot(half + ov, rh + drop);
    const A = [x0 - ov, h - drop, z1 + ov], B = [x1 + ov, h - drop, z1 + ov], C = [x1 + ov, h + rh, zc], D = [x0 - ov, h + rh, zc];
    gb.quad4(key, A, B, C, D, [A[0] / tw, 0], [B[0] / tw, 0], [B[0] / tw, sl / tw], [A[0] / tw, sl / tw], [0, 1, 1]);
    const E = [x1 + ov, h - drop, z0 - ov], F = [x0 - ov, h - drop, z0 - ov];
    gb.quad4(key, E, F, D, C, [-E[0] / tw, 0], [-F[0] / tw, 0], [-D[0] / tw, sl / tw], [-C[0] / tw, sl / tw], [0, 1, -1]);
    gb.tri(wallKey, [x0, h, z1], [x0, h, z0], [x0, h + rh, zc], [z1 / 3.2, h / 3.2], [z0 / 3.2, h / 3.2], [zc / 3.2, (h + rh) / 3.2], [-1, 0, 0]);
    gb.tri(wallKey, [x1, h, z0], [x1, h, z1], [x1, h + rh, zc], [-z0 / 3.2, h / 3.2], [-z1 / 3.2, h / 3.2], [-zc / 3.2, (h + rh) / 3.2], [1, 0, 0]);
  } else {
    const xc = (x0 + x1) / 2, half = (x1 - x0) / 2, drop = ov * rh / half, sl = Math.hypot(half + ov, rh + drop);
    const A = [x1 + ov, h - drop, z1 + ov], B = [x1 + ov, h - drop, z0 - ov], C = [xc, h + rh, z0 - ov], D = [xc, h + rh, z1 + ov];
    gb.quad4(key, A, B, C, D, [-A[2] / tw, 0], [-B[2] / tw, 0], [-C[2] / tw, sl / tw], [-D[2] / tw, sl / tw], [1, 1, 0]);
    const E = [x0 - ov, h - drop, z0 - ov], F = [x0 - ov, h - drop, z1 + ov];
    gb.quad4(key, E, F, D, C, [E[2] / tw, 0], [F[2] / tw, 0], [D[2] / tw, sl / tw], [C[2] / tw, sl / tw], [-1, 1, 0]);
    gb.tri(wallKey, [x0, h, z1], [x1, h, z1], [xc, h + rh, z1], [x0 / 3.2, h / 3.2], [x1 / 3.2, h / 3.2], [xc / 3.2, (h + rh) / 3.2], [0, 0, 1]);
    gb.tri(wallKey, [x1, h, z0], [x0, h, z0], [xc, h + rh, z0], [-x1 / 3.2, h / 3.2], [-x0 / 3.2, h / 3.2], [-xc / 3.2, (h + rh) / 3.2], [0, 0, -1]);
  }
}
function hipRoof(gb, key, x0, z0, x1, z1, h, rh, ov) {
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, apex = [cx, h + rh, cz];
  const drop = ov * rh / (Math.min(x1 - x0, z1 - z0) / 2);
  const a = [x0 - ov, h - drop, z1 + ov], b = [x1 + ov, h - drop, z1 + ov], c = [x1 + ov, h - drop, z0 - ov], d = [x0 - ov, h - drop, z0 - ov];
  const T = (p, q, hint) => { const len = Math.hypot(q[0] - p[0], q[2] - p[2]); const sl = Math.hypot(Math.hypot(apex[0] - (p[0] + q[0]) / 2, apex[2] - (p[2] + q[2]) / 2), rh + drop); gb.tri(key, p, q, apex, [0, 0], [len / 3, 0], [len / 6, sl / 3], hint); };
  T(a, b, [0, 1, 1]); T(b, c, [1, 1, 0]); T(c, d, [0, 1, -1]); T(d, a, [-1, 1, 0]);
}

// outward-facing wall info for a footprint side
function faceInfo(fp, f) {
  switch (f) {
    case 's': return { o: [fp.x0, 0, fp.z1], U: [1, 0, 0], n: [0, 0, 1], len: fp.x1 - fp.x0 };
    case 'n': return { o: [fp.x1, 0, fp.z0], U: [-1, 0, 0], n: [0, 0, -1], len: fp.x1 - fp.x0 };
    case 'e': return { o: [fp.x1, 0, fp.z1], U: [0, 0, -1], n: [1, 0, 0], len: fp.z1 - fp.z0 };
    case 'w': return { o: [fp.x0, 0, fp.z0], U: [0, 0, 1], n: [-1, 0, 0], len: fp.z1 - fp.z0 };
  }
}
function facePoint(fi, t, off = 0) { return [fi.o[0] + fi.U[0] * t + fi.n[0] * off, 0, fi.o[2] + fi.U[2] * t + fi.n[2] * off]; }
function faceQuad(gb, key, fi, t, y, w, h, off, opt = {}) {
  const p = facePoint(fi, t, off); p[1] = y;
  gb.quad(key, p, fi.U, [0, 1, 0], w, h, 1, 1, { fixedUV: true, ...opt });
}

/* ---------------- areas & colliders ---------------- */
function newArea(kind) {
  const scene = new THREE.Scene();
  return { kind, scene, colliders: [], grid: new Map(), entities: [], doors: [], exits: [], tintMats: [], batches: [], anim: [], lights: [] };
}
const CELL = 8;
function addCol(area, x0, z0, x1, z1, y0 = -10, y1 = 100, tag = null) {
  const c = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), y0, y1, tag, stamp: 0 };
  area.colliders.push(c); return c;
}
// local frame helpers shared by geometry and colliders: local (x, z) -> world
function makeXf(x, z, ang = 0, y = 0) { return { x, z, ang, c: Math.cos(ang), s: Math.sin(ang), y }; }
function xfP(f, x, z) { return f ? [f.x + x * f.c + z * f.s, f.z - x * f.s + z * f.c] : [x, z]; }
function xfN(f, x, z) { return f ? [x * f.c + z * f.s, -x * f.s + z * f.c] : [x, z]; }
// collider for a local rectangle under frame f (oriented box when rotated); y0/y1 are relative to the frame's height
function addOCol(area, f, x0, z0, x1, z1, y0 = -10, y1 = 100) {
  if (f && f.y) { y0 += f.y; y1 += f.y; }
  if (!f || Math.abs(f.s) < 1e-6 && f.c > 0) { const ox = f ? f.x : 0, oz = f ? f.z : 0; return addCol(area, x0 + ox, z0 + oz, x1 + ox, z1 + oz, y0, y1); }
  const hx = Math.abs(x1 - x0) / 2, hz = Math.abs(z1 - z0) / 2; const [cx, cz] = xfP(f, (x0 + x1) / 2, (z0 + z1) / 2);
  const ex = Math.abs(f.c) * hx + Math.abs(f.s) * hz, ez = Math.abs(f.s) * hx + Math.abs(f.c) * hz;
  const c = addCol(area, cx - ex, cz - ez, cx + ex, cz + ez, y0, y1); c.o = { x: cx, z: cz, c: f.c, s: f.s, hx, hz };
  return c;
}
// world point -> collider-local coordinates for oriented colliders
function oLocal(o, x, z) { const dx = x - o.x, dz = z - o.z; return [dx * o.c - dz * o.s, dx * o.s + dz * o.c]; }
function buildColliderGrid(area) {
  area.grid = new Map();
  for (const c of area.colliders) {
    for (let ix = Math.floor(c.x0 / CELL); ix <= Math.floor(c.x1 / CELL); ix++)
      for (let iz = Math.floor(c.z0 / CELL); iz <= Math.floor(c.z1 / CELL); iz++) {
        const k = ix * 10007 + iz; let l = area.grid.get(k); if (!l) { l = []; area.grid.set(k, l); } l.push(c);
      }
  }
}
let _stamp = 1;
function queryCols(area, x0, z0, x1, z1) {
  const out = []; _stamp++;
  for (let ix = Math.floor(x0 / CELL); ix <= Math.floor(x1 / CELL); ix++)
    for (let iz = Math.floor(z0 / CELL); iz <= Math.floor(z1 / CELL); iz++) {
      const l = area.grid.get(ix * 10007 + iz); if (!l) continue;
      for (const c of l) if (c.stamp !== _stamp) { c.stamp = _stamp; out.push(c); }
    }
  return out;
}
const STEP = 0.45;
// pushes a circle (pos.x/z, radius r) out of colliders; feet = current feet height; height = body height
function collide(area, pos, r, feet, height = 1.8) {
  for (let it = 0; it < 3; it++) {
    let moved = false;
    for (const c of queryCols(area, pos.x - r - 0.5, pos.z - r - 0.5, pos.x + r + 0.5, pos.z + r + 0.5)) {
      if (feet >= c.y1 - STEP || feet + height <= c.y0) continue;
      if (c.o) {
        const o = c.o; const [lx, lz] = oLocal(o, pos.x, pos.z);
        const qx = clamp(lx, -o.hx, o.hx), qz = clamp(lz, -o.hz, o.hz); const ex = lx - qx, ez = lz - qz; const d2 = ex * ex + ez * ez;
        if (d2 >= r * r) continue;
        let px, pz;
        if (d2 > 1e-8) { const d = Math.sqrt(d2); px = ex / d * (r - d); pz = ez / d * (r - d); }
        else {
          const l = lx + o.hx, rr = o.hx - lx, t = lz + o.hz, b = o.hz - lz; const m = Math.min(l, rr, t, b); px = 0; pz = 0;
          if (m === l) px = -o.hx - r - lx; else if (m === rr) px = o.hx + r - lx; else if (m === t) pz = -o.hz - r - lz; else pz = o.hz + r - lz;
        }
        pos.x += px * o.c + pz * o.s; pos.z += -px * o.s + pz * o.c; moved = true; continue;
      }
      const cx = clamp(pos.x, c.x0, c.x1), cz = clamp(pos.z, c.z0, c.z1);
      const dx = pos.x - cx, dz = pos.z - cz; const d2 = dx * dx + dz * dz;
      if (d2 >= r * r) continue;
      if (d2 > 1e-8) { const d = Math.sqrt(d2); const push = r - d; pos.x += dx / d * push; pos.z += dz / d * push; }
      else {
        const l = pos.x - c.x0, rr = c.x1 - pos.x, t = pos.z - c.z0, b = c.z1 - pos.z; const m = Math.min(l, rr, t, b);
        if (m === l) pos.x = c.x0 - r; else if (m === rr) pos.x = c.x1 + r; else if (m === t) pos.z = c.z0 - r; else pos.z = c.z1 + r;
      }
      moved = true;
    }
    if (!moved) break;
  }
}
// terrain height under a point: the flat floor, or the area's heightfield (hills outside the city)
function baseY(area, x, z) { return area.heightAt ? area.heightAt(x, z) : (area.floorY ?? 0); }
function groundAt(area, x, z, r, feet) {
  let g = baseY(area, x, z);
  for (const c of queryCols(area, x - r, z - r, x + r, z + r)) {
    if (c.y1 > feet + STEP || c.y1 >= 999) continue; // full-height barriers are never floors
    if (c.o) { const [lx, lz] = oLocal(c.o, x, z); if (Math.abs(lx) > c.o.hx + r * 0.6 || Math.abs(lz) > c.o.hz + r * 0.6) continue; if (c.y1 > g) g = c.y1; continue; }
    if (x + r * 0.6 < c.x0 || x - r * 0.6 > c.x1 || z + r * 0.6 < c.z0 || z - r * 0.6 > c.z1) continue;
    if (c.y1 > g) g = c.y1;
  }
  return g;
}
// the sea stops you on foot: a step from dry ground down into the water is refused, or slides along the shore (piers and moles count as ground)
function keepAshore(area, pos, ox, oz, r, feet) {
  if (!area.heightAt) return;
  const wet = (x, z) => groundAt(area, x, z, r, feet) < SEA + 0.1;
  if (!wet(pos.x, pos.z) || wet(ox, oz)) return;
  if (!wet(pos.x, oz)) pos.z = oz; else if (!wet(ox, pos.z)) pos.x = ox; else { pos.x = ox; pos.z = oz; }
}
function pointBlocked(area, x, y, z) {
  for (const c of queryCols(area, x, z, x, z)) if (c.o) { if (y > c.y0 && y < c.y1) { const [lx, lz] = oLocal(c.o, x, z); if (Math.abs(lx) < c.o.hx && Math.abs(lz) < c.o.hz) return true; } }
  else if (x > c.x0 && x < c.x1 && z > c.z0 && z < c.z1 && y > c.y0 && y < c.y1) return true;
  return false;
}
function hasLOS(area, a, b, eyeA = 1.5, eyeB = 1.5) {
  if (area.kind === 'dungeon') return dungeonLOS(area, a.x, a.z, b.x, b.z);
  const dx = b.x - a.x, dz = b.z - a.z; const d = Math.hypot(dx, dz); const n = Math.ceil(d / 0.8);
  for (let i = 1; i < n; i++) { const t = i / n; const x = a.x + dx * t, y = lerp(a.y + eyeA, b.y + eyeB, t), z = a.z + dz * t; if (pointBlocked(area, x, y, z) || (area.heightAt && y < area.heightAt(x, z))) return false; }
  return true;
}

/* ---------------- billboard sprites ---------------- */
const _planeGeos = new Map();
function planeGeo(w, h) {
  const k = w + 'x' + h; let g = _planeGeos.get(k);
  if (!g) { g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0); _planeGeos.set(k, g); }
  return g;
}
function spriteMat(tex, opt = {}) {
  const m = new THREE.MeshBasicMaterial({ map: tex, alphaTest: opt.additive ? 0 : 0.5, side: THREE.DoubleSide, fog: opt.fog ?? true, transparent: !!(opt.transparent || opt.additive), opacity: opt.opacity ?? 1, depthWrite: !(opt.transparent || opt.additive) });
  if (opt.additive) m.blending = THREE.AdditiveBlending;
  return m;
}
function makeBillboard(tex, w, h, opt = {}) {
  const mat = spriteMat(tex, opt); const mesh = new THREE.Mesh(planeGeo(w, h), mat); mesh.userData.bb = true; return mesh;
}
// static sprite batch: many copies of one texture, all rotated to face the camera plane
class SpriteBatch {
  constructor(area, tex, w, h, positions, opt = {}) {
    this.mat = spriteMat(tex, opt); this.positions = positions; this.lit = opt.lit !== false;
    this.mesh = new THREE.InstancedMesh(planeGeo(w, h), this.mat, Math.max(1, positions.length));
    this.mesh.count = positions.length; this.mesh.frustumCulled = false; area.scene.add(this.mesh);
    if (this.lit && !opt.additive) area.tintMats.push(this.mat);
    area.batches.push(this); this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._s = new THREE.Vector3(1, 1, 1); this._p = new THREE.Vector3();
    this.lastYaw = null;
  }
  update(yaw) {
    if (this.lastYaw !== null && Math.abs(yaw - this.lastYaw) < 0.002) return; this.lastYaw = yaw;
    this._q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    for (let i = 0; i < this.positions.length; i++) {
      const p = this.positions[i]; this._p.set(p[0], p[1], p[2]); this._s.set(p[3] || 1, p[3] || 1, 1);
      this._m.compose(this._p, this._q, this._s); this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
function disposeArea(area) {
  if (!area) return;
  area.scene.traverse(o => {
    if (o.geometry && !_planeGeosHas(o.geometry)) o.geometry.dispose();
    if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach(m => m.dispose()); }
  });
}
function _planeGeosHas(g) { for (const v of _planeGeos.values()) if (v === g) return true; return false; }

function worldMats(area, defs) {
  const mats = {};
  for (const [k, d] of Object.entries(defs)) {
    const m = new THREE.MeshBasicMaterial({ map: TEX[d.tex], vertexColors: true, side: d.double ? THREE.DoubleSide : THREE.FrontSide, fog: d.fog ?? true, alphaTest: d.alpha ? 0.5 : 0, transparent: !!d.transparent, opacity: d.opacity ?? 1 });
    if (d.color) m.color.set(d.color);
    if (d.transparent) m.depthWrite = false;
    if (d.po) { m.polygonOffset = true; m.polygonOffsetFactor = -d.po; m.polygonOffsetUnits = -d.po * 4; }
    m.userData.base = m.color.clone();
    if (d.tint !== false) area.tintMats.push(m);
    mats[k] = m;
  }
  return mats;
}
