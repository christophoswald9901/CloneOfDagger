/* =====================================================================
   Procedural pixel-art textures and billboard sprites
   ===================================================================== */

function cnv(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true }); x.imageSmoothingEnabled = false;
  return [c, x];
}
function h2r(h) { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(c => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgba(r, g, b, a = 1) { return `rgba(${clamp(r | 0, 0, 255)},${clamp(g | 0, 0, 255)},${clamp(b | 0, 0, 255)},${a})`; }
function sh(h, f) { const [r, g, b] = h2r(h); return rgba(r * f, g * f, b * f); }
function mixc(h1, h2, t) { const a = h2r(h1), b = h2r(h2); return rgba(lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)); }
function noiseImg(x, w, h, amt, rng) {
  const d = x.getImageData(0, 0, w, h), a = d.data;
  for (let i = 0; i < a.length; i += 4) {
    if (!a[i + 3]) continue;
    const f = 1 + (rng.next() - 0.5) * amt;
    a[i] *= f; a[i + 1] *= f; a[i + 2] *= f;
  }
  x.putImageData(d, 0, 0);
}
// draws a 1px dark outline around opaque pixels (classic sprite look)
function outline(c, col = [22, 16, 12]) {
  const x = c.getContext('2d'); const w = c.width, h = c.height;
  const d = x.getImageData(0, 0, w, h), a = d.data; const src = new Uint8ClampedArray(a);
  const op = (i, j) => i >= 0 && j >= 0 && i < w && j < h && src[(j * w + i) * 4 + 3] > 127;
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const k = (j * w + i) * 4;
    if (src[k + 3] > 127) continue;
    if (op(i - 1, j) || op(i + 1, j) || op(i, j - 1) || op(i, j + 1)) { a[k] = col[0]; a[k + 1] = col[1]; a[k + 2] = col[2]; a[k + 3] = 255; }
  }
  x.putImageData(d, 0, 0);
}
function texFrom(c, { repeat = true, mip = true } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = mip ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter;
  t.generateMipmaps = mip;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; } else { t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; }
  return t;
}
const pxCircle = (x, cx, cy, r, col) => {
  x.fillStyle = col;
  for (let yy = -r; yy <= r; yy++) { const w = Math.floor(Math.sqrt(r * r - yy * yy)); x.fillRect(Math.round(cx - w), Math.round(cy + yy), w * 2 + 1, 1); }
};
const pxLine = (x, x0, y0, x1, y1, col, t = 1) => {
  x.fillStyle = col; const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= n; i++) x.fillRect(Math.round(lerp(x0, x1, i / n) - (t - 1) / 2), Math.round(lerp(y0, y1, i / n) - (t - 1) / 2), t, t);
};

/* ------------------------- surface textures ------------------------- */
function genStrata(seed, base = '#77726a', size = 64) {
  const rng = new RNG(seed); const [c, x] = cnv(size, size); const [r, g, b] = h2r(base);
  let y = 0; while (y < size) { const h = 2 + Math.floor(rng.next() * 5), f = 0.86 + rng.next() * 0.24; x.fillStyle = `rgb(${r * f | 0},${g * f | 0},${b * f * 1.02 | 0})`; x.fillRect(0, y, size, h);
    for (let i = 0; i < size; i++) if (rng.next() < 0.35) { const k = 0.9 + rng.next() * 0.2; x.fillStyle = `rgba(${r * f * k | 0},${g * f * k | 0},${b * f * k | 0},0.8)`; x.fillRect(i, y + Math.floor(rng.next() * h), 1, 1); }
    x.fillStyle = 'rgba(40,40,44,0.55)'; x.fillRect(0, y + h - 1, size, 1); y += h; }                       // bedding planes
  for (let k = 0; k < 7; k++) { let px = Math.floor(rng.next() * size), py = Math.floor(rng.next() * size); const L = 6 + Math.floor(rng.next() * 14); x.fillStyle = 'rgba(34,34,38,0.7)'; for (let i = 0; i < L; i++) { x.fillRect((px + size) % size, (py + i) % size, 1, 1); if (rng.next() < 0.25) px += rng.next() < 0.5 ? 1 : -1; } } // joints
  for (let k = 0; k < 40; k++) { x.fillStyle = rng.next() < 0.5 ? 'rgba(255,255,250,0.18)' : 'rgba(0,0,0,0.14)'; x.fillRect(Math.floor(rng.next() * size), Math.floor(rng.next() * size), 1 + Math.floor(rng.next() * 2), 1); }
  return c;
}
// pixel buffer helpers for tiling ground textures: every write wraps round the edges
function pxBuf(size) { const [c, x] = cnv(size, size); const img = x.createImageData(size, size); const a = img.data;
  const put = (px, py, r, g, b) => { px = ((Math.floor(px) % size) + size) % size; py = ((Math.floor(py) % size) + size) % size; const k = (py * size + px) * 4; a[k] = clamp(r, 0, 255); a[k + 1] = clamp(g, 0, 255); a[k + 2] = clamp(b, 0, 255); a[k + 3] = 255; };
  const get = (px, py) => { px = ((Math.floor(px) % size) + size) % size; py = ((Math.floor(py) % size) + size) % size; const k = (py * size + px) * 4; return [a[k], a[k + 1], a[k + 2]]; };
  const fill = (col) => { const [r, g, b] = h2r(col); for (let i = 0; i < a.length; i += 4) { a[i] = r; a[i + 1] = g; a[i + 2] = b; a[i + 3] = 255; } };
  return { c, x, img, put, get, fill, done: () => x.putImageData(img, 0, 0) }; }
// tileable value noise on a size×size texture, cells of `cell` pixels: -1..1
function tnoise(x, y, size, cell, s) {
  const P = Math.round(size / cell), fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy), u = fx - ix, v = fy - iy;
  const h = (i, j) => _h2(((i % P) + P) % P, ((j % P) + P) % P, s) * 2 - 1, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
  return lerp(lerp(h(ix, iy), h(ix + 1, iy), su), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), su), sv);
}
// natural rock: weathered beds of uneven thickness with wavering partings, broken joints, water stains and lichen; lit from above
function genCliff(seed, base = '#7a766c', size = 128) {
  const rng = new RNG(seed); const B = pxBuf(size); const [r, g, b] = h2r(base);
  const beds = []; { let y = 0; while (y < size - 4) { const h = rng.chance(0.3) ? rng.int(3, 6) : rng.int(8, 22); beds.push({ y, h: Math.min(h, size - y), f: 0.92 + rng.next() * 0.14, ph: rng.next() * 6.283, m: rng.int(1, 3), amp: rng.range(0.8, 3.2), warm: rng.next() < 0.3 }); y += h; } }
  const top = (d, x) => d.y + d.amp * Math.sin(x / size * 6.283 * d.m + d.ph) + 1.2 * tnoise(x, d.y, size, 8, seed + 9);
  const bedAt = (x, y) => { for (let k = beds.length - 1; k >= 0; k--) if (y >= top(beds[k], x)) return beds[k]; return beds[beds.length - 1]; };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const n = tnoise(x, y, size, 32, seed) * 0.12 + tnoise(x, y, size, 8, seed + 1) * 0.45 + tnoise(x, y, size, 2, seed + 2) * 0.43;
    const d = bedAt(x, y), f = (0.97 + (d.f - 0.97) * 0.5) * (1 + 0.16 * n);
    B.put(x, y, r * f * (d.warm ? 1.05 : 1), g * f, b * f * (d.warm ? 0.93 : 1.02));
  }
  // partings: broken, soft lines; the bed below catches a little light
  for (const d of beds) { let on = true; for (let x = 0; x < size; x++) {
    if (rng.next() < 0.08) on = !on; if (!on) continue;
    const y = Math.round(top(d, x)); const sh = (yy, k) => { const [cr, cg, cb] = B.get(x, yy); B.put(x, yy, cr * k, cg * k, cb * k); };
    sh(y, 0.72); sh(y + 1, 1.08); } }
  // joints: dark crevices wandering down through a bed or two, lit on one edge
  for (let k = 0; k < 34; k++) {
    let x = rng.int(0, size - 1); const y0 = rng.int(0, size - 1), L = rng.int(3, 20), w = rng.chance(0.25) ? 2 : 1;
    for (let i = 0; i < L; i++) { const y = y0 + i; for (let q = 0; q < w; q++) { const [cr, cg, cb] = B.get(x + q, y); B.put(x + q, y, cr * 0.55, cg * 0.55, cb * 0.58); } const [lr, lg, lb] = B.get(x + w, y); B.put(x + w, y, lr * 1.08, lg * 1.08, lb * 1.06); if (rng.next() < 0.4) x += rng.next() < 0.5 ? 1 : -1; }
  }
  for (let k = 0; k < 9; k++) { const x = rng.int(0, size - 1), y0 = rng.int(0, size - 1), L = rng.int(10, 34); for (let i = 0; i < L; i++) { const [cr, cg, cb] = B.get(x, y0 + i); const f = 1 - 0.13 * (1 - i / L); B.put(x, y0 + i, cr * f, cg * f, cb * f); } }
  for (let k = 0; k < 16; k++) { const cx = rng.int(0, size - 1), cy = rng.int(0, size - 1), col = rng.pick([[168, 170, 150], [150, 146, 96], [118, 128, 94]]);
    for (let i = 0; i < 16; i++) if (rng.next() < 0.6) B.put(cx + rng.int(-3, 3), cy + rng.int(-2, 2), col[0], col[1], col[2]); }
  B.done(); return B.c;
}
// scree: small angular stones packed on grit, each lit from the upper left
function genScree(seed, base = '#6a665e', size = 128) {
  const rng = new RNG(seed); const B = pxBuf(size); const [r, g, b] = h2r(base);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const f = 0.8 + 0.25 * rng.next() + 0.1 * tnoise(x, y, size, 16, seed); B.put(x, y, r * f, g * f, b * f); }
  for (let i = 0; i < size * size / 9; i++) {
    const cx = rng.next() * size, cy = rng.next() * size, w = rng.range(1.5, 4.5), h = w * rng.range(0.55, 1), f = rng.range(0.9, 1.35), warm = rng.next() < 0.25 ? 1.06 : 1, cut = rng.next() * 1.5;
    for (let yy = -h; yy <= h; yy++) for (let xx = -w; xx <= w; xx++) {
      if (Math.abs(xx) + Math.abs(yy) > w + h - cut) continue; // clipped corners: angular, not round
      const lit = yy < -h + 1 || xx < -w + 1 ? 1.14 : yy > h - 1 || xx > w - 1 ? 0.78 : 1;
      B.put(cx + xx, cy + yy, r * f * lit * warm, g * f * lit, b * f * lit / warm);
    }
  }
  B.done(); return B.c;
}
// soft blotches of lighter and darker ground, so a tiled surface does not read as wallpaper
function blotch(B, rng, size, n, amt, rMin = 6, rMax = 18) {
  for (let i = 0; i < n; i++) { const cx = rng.next() * size, cy = rng.next() * size, R = rng.range(rMin, rMax), k = 1 + (rng.next() - 0.5) * amt;
    for (let yy = -R; yy <= R; yy++) for (let xx = -R; xx <= R; xx++) { const d = Math.hypot(xx, yy) / R; if (d > 1) continue; const f = lerp(k, 1, d * d); const [r, g, b] = B.get(cx + xx, cy + yy); B.put(cx + xx, cy + yy, r * f, g * f, b * f); } }
}
// round-topped cobbles laid in wavering rows, dirt in the joints; light from the upper left
function genCobbles(seed, base, joint, { size = 128, rowH = 9, wMin = 7, wMax = 13, vary = 0.2 } = {}) {
  const rng = new RNG(seed); const B = pxBuf(size); B.fill(joint); const [jr, jg, jb] = h2r(joint);
  for (let i = 0; i < size * size / 6; i++) { const f = 0.75 + rng.next() * 0.55; B.put(rng.int(0, size - 1), rng.int(0, size - 1), jr * f, jg * f, jb * f); }
  const [r, g, b] = h2r(base); const rows = Math.round(size / rowH), rh = size / rows;
  for (let j = 0; j < rows; j++) {
    const ws = []; let sum = 0; while (sum < size) { const w = rng.range(wMin, wMax); ws.push(w); sum += w; }
    const sc = size / sum; let x0 = rng.next() * size;
    for (const w0 of ws) {
      const w = w0 * sc, cx = x0 + w / 2, cy = j * rh + rh / 2 + rng.range(-0.8, 0.8), rx = w / 2 - 0.7, ry = rh / 2 - 0.7 + rng.range(-0.4, 0.3);
      const f = 1 + (rng.next() - 0.5) * vary * 2, hue = rng.next(); const t = hue < 0.12 ? [1.08, 1.0, 0.88] : hue < 0.24 ? [0.9, 0.94, 1.02] : [1, 1, 1];
      for (let yy = Math.floor(cy - ry - 1); yy <= Math.ceil(cy + ry + 1); yy++) for (let xx = Math.floor(cx - rx - 1); xx <= Math.ceil(cx + rx + 1); xx++) {
        const dx = (xx + 0.5 - cx) / rx, dy = (yy + 0.5 - cy) / ry, d = dx * dx * dx * dx + dy * dy * dy * dy; if (d > 1) continue;
        let k = f * (1.06 - 0.22 * d); const lit = -(dx + dy * 1.3); if (lit > 0.9 && d > 0.25) k *= 1.22; else if (lit < -0.95 && d > 0.3) k *= 0.7;
        if (rng.next() < 0.08) k *= 0.9 + rng.next() * 0.2;
        B.put(xx, yy, r * k * t[0], g * k * t[1], b * k * t[2]);
      }
      x0 += w;
    }
  }
  B.done(); return B.c;
}
// packed earth strewn with pebbles
function genGravel(seed, base, { size = 128, n = 700, pal = ['#8e8472', '#6e6656', '#a49a86', '#7c7462', '#5e584c'] } = {}) {
  const rng = new RNG(seed); const B = pxBuf(size); B.fill(base); const [r0, g0, b0] = h2r(base);
  for (let i = 0; i < size * size / 3; i++) { const f = 0.85 + rng.next() * 0.3; B.put(rng.int(0, size - 1), rng.int(0, size - 1), r0 * f, g0 * f, b0 * f); }
  blotch(B, rng, size, 14, 0.18, 8, 22);
  for (let i = 0; i < n; i++) {
    const cx = rng.next() * size, cy = rng.next() * size, R = rng.next() < 0.8 ? rng.range(0.6, 1.3) : rng.range(1.4, 2.4); const [r, g, b] = h2r(rng.pick(pal)); const f = 0.9 + rng.next() * 0.2;
    for (let yy = -3; yy <= 3; yy++) for (let xx = -3; xx <= 3; xx++) { const d = Math.hypot(xx + 0.5, yy + 0.5) / R; if (d > 1) continue; const k = f * (xx + yy < -1 ? 1.18 : xx + yy > 1 ? 0.78 : 1); B.put(cx + xx, cy + yy, r * k, g * k, b * k); }
    B.put(cx + R, cy + R, r0 * 0.6, g0 * 0.6, b0 * 0.6); // a speck of shadow under each stone
  }
  B.done(); return B.c;
}
// trodden earth: clods, a few stones, straw and dung flecks
function genEarth(seed, base, { size = 128, stones = 90, straw = 60, strawCol = '#a08a52' } = {}) {
  const rng = new RNG(seed); const B = pxBuf(size); B.fill(base); const [r0, g0, b0] = h2r(base);
  for (let i = 0; i < size * size / 2; i++) { const f = 0.84 + rng.next() * 0.3; B.put(rng.int(0, size - 1), rng.int(0, size - 1), r0 * f, g0 * f, b0 * f); }
  blotch(B, rng, size, 22, 0.26, 6, 20);
  for (let i = 0; i < 260; i++) { const cx = rng.int(0, size - 1), cy = rng.int(0, size - 1), f = rng.next() < 0.5 ? 0.78 : 1.14; B.put(cx, cy, r0 * f, g0 * f, b0 * f); B.put(cx + 1, cy, r0 * f * 0.97, g0 * f * 0.97, b0 * f * 0.97); } // clods
  for (let i = 0; i < stones; i++) { const cx = rng.int(0, size - 1), cy = rng.int(0, size - 1), k = 0.9 + rng.next() * 0.35; B.put(cx, cy, 128 * k, 120 * k, 106 * k); if (rng.next() < 0.5) B.put(cx + 1, cy, 110 * k, 102 * k, 90 * k); B.put(cx + 1, cy + 1, r0 * 0.6, g0 * 0.6, b0 * 0.6); }
  const [sr, sg, sb] = h2r(strawCol); for (let i = 0; i < straw; i++) { let cx = rng.int(0, size - 1), cy = rng.int(0, size - 1); const dx = rng.pick([1, 1, 0, -1]), L = rng.int(2, 4), k = 0.85 + rng.next() * 0.3; for (let s = 0; s < L; s++) B.put(cx + s * dx, cy + (dx ? 0 : s), sr * k, sg * k, sb * k); }
  B.done(); return B.c;
}
function genBlocks({ seed = 1, size = 64, bw = 16, bh = 8, base = '#8a8478', mortar = '#3e3a34', vary = 0.16, noise = 0.22, bevel = true, stagger = 0.5, moss = 0 }) {
  const rng = new RNG(seed); const [c, x] = cnv(size, size);
  x.fillStyle = mortar; x.fillRect(0, 0, size, size);
  const [r, g, b] = h2r(base); const cols = Math.round(size / bw), rows = Math.round(size / bh);
  for (let j = 0; j < rows; j++) {
    const off = (j % 2) * bw * stagger; const cf = []; for (let i = 0; i < cols; i++) cf.push(1 + (rng.next() - 0.5) * vary * 2);
    for (let i = -1; i <= cols; i++) {
      const f = cf[((i % cols) + cols) % cols]; const x0 = Math.round(i * bw + off), y0 = j * bh;
      x.fillStyle = rgba(r * f, g * f, b * f); x.fillRect(x0 + 1, y0 + 1, bw - 1, bh - 1);
      if (bevel) {
        x.fillStyle = rgba(r * f * 1.18, g * f * 1.18, b * f * 1.18); x.fillRect(x0 + 1, y0 + 1, bw - 1, 1); x.fillRect(x0 + 1, y0 + 1, 1, bh - 1);
        x.fillStyle = rgba(r * f * 0.76, g * f * 0.76, b * f * 0.76); x.fillRect(x0 + 1, y0 + bh - 1, bw - 1, 1); x.fillRect(x0 + bw - 1, y0 + 1, 1, bh - 1);
      }
    }
  }
  if (moss) for (let i = 0; i < moss; i++) { x.fillStyle = `rgba(${60 + rng.int(0, 30)},${90 + rng.int(0, 40)},${40},${0.25 + rng.next() * 0.35})`; x.fillRect(rng.int(0, size), rng.int(0, size), rng.int(1, 4), rng.int(1, 3)); }
  noiseImg(x, size, size, noise, rng); return c;
}
function genTimber(seed, plaster = '#d6caa9', beam = '#4b3423') {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s);
  x.fillStyle = plaster; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(110,85,50,${0.04 + rng.next() * 0.08})`; x.fillRect(rng.int(0, s), rng.int(0, s), rng.int(2, 9), rng.int(2, 12)); }
  const B = (x0, y0, w, h) => { x.fillStyle = beam; x.fillRect(x0, y0, w, h); x.fillStyle = sh(beam, 1.35); x.fillRect(x0, y0, w, 1); x.fillStyle = sh(beam, 0.7); x.fillRect(x0, y0 + h - 1, w, 1); };
  B(0, 58, 64, 6); B(0, 0, 4, 64); B(31, 0, 4, 64); B(0, 27, 64, 3);
  pxLine(x, 36, 56, 62, 31, beam, 3); pxLine(x, 5, 25, 29, 3, beam, 3);
  noiseImg(x, s, s, 0.14, rng); return c;
}
function genPlanks(seed, base = '#7a5634', pw = 8, size = 64, ends = true) {
  const rng = new RNG(seed); const [c, x] = cnv(size, size); const [r, g, b] = h2r(base);
  for (let i = 0; i < size / pw; i++) {
    const f = 1 + (rng.next() - 0.5) * 0.3; x.fillStyle = rgba(r * f, g * f, b * f); x.fillRect(i * pw, 0, pw, size);
    for (let k = 0; k < 5; k++) { x.fillStyle = rgba(r * f * 0.8, g * f * 0.8, b * f * 0.8); x.fillRect(i * pw + rng.int(1, pw - 2), rng.int(0, size), 1, rng.int(6, 22)); }
    x.fillStyle = rgba(r * 0.45, g * 0.45, b * 0.45); x.fillRect(i * pw, 0, 1, size);
    x.fillStyle = rgba(r * f * 1.15, g * f * 1.15, b * f * 1.15); x.fillRect(i * pw + 1, 0, 1, size);
    if (ends) { const ey = rng.int(0, size - 1); x.fillStyle = rgba(r * 0.45, g * 0.45, b * 0.45); x.fillRect(i * pw, ey, pw, 1); }
    if (rng.chance(0.3)) { x.fillStyle = rgba(r * 0.5, g * 0.5, b * 0.5); x.fillRect(i * pw + rng.int(2, pw - 3), rng.int(2, size - 3), 2, 2); }
  }
  noiseImg(x, size, size, 0.12, rng); return c;
}
function genRoof(seed, base) {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s); const [r, g, b] = h2r(base);
  x.fillStyle = rgba(r * 0.4, g * 0.4, b * 0.4); x.fillRect(0, 0, s, s);
  for (let j = 0; j < 8; j++) {
    const off = (j % 2) * 4;
    for (let i = -1; i < 9; i++) {
      const f = 1 + (rng.next() - 0.5) * 0.14; const x0 = i * 8 + off, y0 = j * 8;
      x.fillStyle = rgba(r * f, g * f, b * f); x.fillRect(x0, y0, 7, 8);
      x.fillStyle = rgba(r * f * 0.7, g * f * 0.7, b * f * 0.7); x.fillRect(x0, y0, 7, 2);
      x.fillStyle = rgba(r * f * 1.2, g * f * 1.2, b * f * 1.2); x.fillRect(x0 + 1, y0 + 7, 5, 1);
    }
  }
  noiseImg(x, s, s, 0.08, rng); return c;
}
function genThatch(seed) {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s);
  x.fillStyle = '#8a6d38'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 700; i++) { const f = 0.7 + rng.next() * 0.6; x.fillStyle = rgba(168 * f, 138 * f, 74 * f); x.fillRect(rng.int(0, s), rng.int(0, s), 1, rng.int(3, 9)); }
  for (let j = 0; j < 4; j++) { x.fillStyle = 'rgba(40,28,10,0.5)'; x.fillRect(0, j * 16 + 14, s, 2); }
  return c;
}
function genVoronoi(seed, base, n = 26, size = 64, edgeCol = null, edge = 1.6, shadeAmt = 0.4) {
  const rng = new RNG(seed); const [c, x] = cnv(size, size); const [r, g, b] = h2r(base);
  const pts = []; for (let i = 0; i < n; i++) pts.push([rng.next() * size, rng.next() * size, 0.8 + rng.next() * 0.4]);
  const img = x.createImageData(size, size); const a = img.data; const ec = edgeCol ? h2r(edgeCol) : [r * 0.45, g * 0.45, b * 0.45];
  for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
    let d1 = 1e9, d2 = 1e9, f = 1;
    for (const p of pts) for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
      const dx = xx - (p[0] + ox * size), dy = y - (p[1] + oy * size); const d = Math.sqrt(dx * dx + dy * dy);
      if (d < d1) { d2 = d1; d1 = d; f = p[2]; } else if (d < d2) d2 = d;
    }
    const k = (y * size + xx) * 4; const e = d2 - d1;
    if (e < edge) { a[k] = ec[0]; a[k + 1] = ec[1]; a[k + 2] = ec[2]; }
    else { const s2 = f * (1 - Math.min(d1 / 14, 1) * shadeAmt) * (e < edge + 1.2 ? 0.85 : 1); a[k] = r * s2; a[k + 1] = g * s2; a[k + 2] = b * s2; }
    a[k + 3] = 255;
  }
  x.putImageData(img, 0, 0); noiseImg(x, size, size, 0.18, rng); return c;
}
function genSpeckle(seed, base, amt = 0.3, size = 64, specks = []) {
  const rng = new RNG(seed); const [c, x] = cnv(size, size); x.fillStyle = base; x.fillRect(0, 0, size, size);
  for (const [col, count, w, h] of specks) for (let i = 0; i < count; i++) { x.fillStyle = col; x.fillRect(rng.int(0, size - 1), rng.int(0, size - 1), w, h); }
  noiseImg(x, size, size, amt, rng); return c;
}
function genWater(seed) {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s);
  x.fillStyle = '#2a4d6a'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 60; i++) { x.fillStyle = rng.chance(0.5) ? 'rgba(120,170,200,0.55)' : 'rgba(20,40,60,0.5)'; x.fillRect(rng.int(0, s), rng.int(0, s), rng.int(3, 10), 1); }
  noiseImg(x, s, s, 0.1, rng); return c;
}
function genMarble(seed) {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s);
  x.fillStyle = '#d8d4c8'; x.fillRect(0, 0, s, s);
  for (let i = 0; i < 6; i++) { let px = rng.int(0, s), py = 0; x.fillStyle = 'rgba(120,115,105,0.55)'; while (py < s) { x.fillRect(px, py, 1, 1); px += rng.int(-1, 1); py++; } }
  x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 0, s, 1); x.fillRect(0, 0, 1, s); x.fillRect(0, 32, s, 1); x.fillRect(32, 0, 1, s);
  noiseImg(x, s, s, 0.08, rng); return c;
}
function genCarpet(seed, base = '#7a1a1a', trim = '#c8a040') {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s);
  x.fillStyle = base; x.fillRect(0, 0, s, s);
  x.fillStyle = trim; x.fillRect(0, 0, 4, s); x.fillRect(60, 0, 4, s);
  x.fillStyle = sh(base, 0.6); x.fillRect(4, 0, 2, s); x.fillRect(58, 0, 2, s);
  for (let j = 0; j < 4; j++) { const cy = j * 16 + 8; for (let k = 0; k < 6; k++) { x.fillStyle = trim; x.fillRect(32 - k, cy - 6 + k, k * 2 + 1, 1); x.fillRect(32 - k, cy + 6 - k, k * 2 + 1, 1); } x.fillStyle = base; x.fillRect(30, cy - 1, 5, 3); }
  noiseImg(x, s, s, 0.15, rng); return c;
}
function genBookshelf(seed) {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s);
  x.fillStyle = '#3a2616'; x.fillRect(0, 0, s, s);
  const cols = ['#6a1c1c', '#1c3a6a', '#2a5a2a', '#6a5a2a', '#4a2a5a', '#7a6a50', '#2a2a2a', '#8a4a1a'];
  for (let row = 0; row < 4; row++) {
    const y0 = row * 16 + 2; let px = 3;
    while (px < 61) { const w = rng.int(2, 4); const h = rng.int(9, 13); if (px + w > 61) break; x.fillStyle = rng.pick(cols); x.fillRect(px, y0 + 13 - h, w, h); x.fillStyle = 'rgba(255,230,160,0.35)'; x.fillRect(px, y0 + 13 - h + 2, w, 1); px += w + (rng.chance(0.15) ? 2 : 0); }
    x.fillStyle = '#5a3a20'; x.fillRect(0, y0 + 13, s, 3);
  }
  x.fillStyle = '#5a3a20'; x.fillRect(0, 0, 3, s); x.fillRect(61, 0, 3, s);
  noiseImg(x, s, s, 0.12, rng); return c;
}
// doors of the town: z-braced planks, panelled and painted, or studded with iron
function genDoorV(seed, wood, kind = 'z', iron = '#26262a') {
  const rng = new RNG(seed); const [c, x] = cnv(32, 64); const [r, g, b] = h2r(wood);
  const C = (f) => rgba(r * f, g * f, b * f);
  for (let i = 0; i < 4; i++) { const f = 1 + (rng.next() - 0.5) * 0.18; x.fillStyle = C(f); x.fillRect(i * 8, 0, 8, 64); x.fillStyle = C(0.55); x.fillRect(i * 8, 0, 1, 64); for (let k = 0; k < 4; k++) { x.fillStyle = C(f * 0.85); x.fillRect(i * 8 + rng.int(2, 6), rng.int(0, 60), 1, rng.int(4, 12)); } }
  if (kind === 'z') {
    x.fillStyle = C(0.8); x.fillRect(2, 9, 28, 4); x.fillRect(2, 50, 28, 4); x.fillStyle = C(1.12); x.fillRect(2, 9, 28, 1); x.fillRect(2, 50, 28, 1);
    for (let t = 0; t <= 36; t++) { const px = 4 + Math.round(t * 22 / 36), py = 49 - t; x.fillStyle = C(0.8); x.fillRect(px, py, 4, 2); x.fillStyle = C(1.12); x.fillRect(px, py, 4, 1); }
    x.fillStyle = iron; x.fillRect(0, 10, 12, 2); x.fillRect(0, 51, 12, 2);
  } else if (kind === 'panel') {
    x.fillStyle = C(1.0); x.fillRect(0, 0, 32, 64);
    for (const [px, py, w, h] of [[5, 5, 9, 24], [18, 5, 9, 24], [5, 35, 9, 24], [18, 35, 9, 24]]) { x.fillStyle = C(0.78); x.fillRect(px, py, w, h); x.fillStyle = C(0.6); x.fillRect(px, py, w, 1); x.fillRect(px, py, 1, h); x.fillStyle = C(1.2); x.fillRect(px, py + h - 1, w, 1); x.fillRect(px + w - 1, py, 1, h); x.fillStyle = C(0.9); x.fillRect(px + 2, py + 2, w - 4, h - 4); }
    x.fillStyle = '#c8a040'; x.fillRect(25, 32, 2, 2);
  } else { // studded
    x.fillStyle = iron; x.fillRect(0, 12, 32, 2); x.fillRect(0, 32, 32, 2); x.fillRect(0, 52, 32, 2);
    x.fillStyle = '#5a5a60'; for (let yy = 6; yy < 62; yy += 8) for (let xx = 4; xx < 30; xx += 8) x.fillRect(xx, yy, 1, 1);
  }
  if (kind !== 'panel') { x.fillStyle = iron; x.fillRect(22, 30, 4, 1); x.fillRect(21, 31, 1, 4); x.fillRect(26, 31, 1, 4); x.fillRect(22, 35, 4, 1); }
  x.fillStyle = C(0.4); x.fillRect(0, 62, 32, 2); // the sill is scuffed dark
  noiseImg(x, 32, 64, 0.12, rng); return c;
}
function genDoor(seed, wood = '#6a4424', iron = '#2a2a2e') {
  const rng = new RNG(seed); const [c, x] = cnv(32, 64);
  const [r, g, b] = h2r(wood);
  for (let i = 0; i < 4; i++) { const f = 1 + (rng.next() - 0.5) * 0.25; x.fillStyle = rgba(r * f, g * f, b * f); x.fillRect(i * 8, 0, 8, 64); x.fillStyle = rgba(r * 0.4, g * 0.4, b * 0.4); x.fillRect(i * 8, 0, 1, 64); }
  x.fillStyle = iron; x.fillRect(0, 10, 32, 3); x.fillRect(0, 50, 32, 3);
  x.fillStyle = '#55555c'; for (let i = 2; i < 32; i += 6) { x.fillRect(i, 11, 1, 1); x.fillRect(i, 51, 1, 1); }
  x.fillStyle = iron; x.fillRect(22, 30, 4, 1); x.fillRect(21, 31, 1, 4); x.fillRect(26, 31, 1, 4); x.fillRect(22, 35, 4, 1);
  x.fillStyle = '#20140c'; x.fillRect(0, 0, 32, 2); x.fillRect(0, 0, 2, 64); x.fillRect(30, 0, 2, 64);
  noiseImg(x, 32, 64, 0.14, rng); return c;
}
function genWindow(lit) {
  const [c, x] = cnv(32, 32);
  x.fillStyle = '#2e1e12'; x.fillRect(0, 0, 32, 32);
  const pane = lit ? ['#f6d27a', '#e8b050'] : ['#26303c', '#34465a'];
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const x0 = 3 + i * 14, y0 = 3 + j * 14;
    x.fillStyle = pane[0]; x.fillRect(x0, y0, 12, 12);
    x.fillStyle = pane[1]; x.fillRect(x0, y0 + 7, 12, 5);
    if (!lit) { x.fillStyle = 'rgba(200,220,255,0.35)'; x.fillRect(x0 + 2, y0 + 2, 2, 5); }
  }
  x.fillStyle = '#4a3220'; x.fillRect(0, 29, 32, 3);
  return c;
}
// a quarter of a parterre de broderie: scrolls of clipped box on sand, with fields of brick dust and coloured earth
function genBroderie() {
  const W = 192, Hh = 96, [c, x] = cnv(W, Hh), G = '#2c4a20', G2 = '#3e6228';
  const line = (w, col) => { x.lineWidth = w; x.strokeStyle = col; x.stroke(); };
  // a border of flowers within a band of box
  x.fillStyle = '#5c4832'; x.fillRect(0, 0, W, Hh);
  { const fr = new RNG(93); for (let k = 0; k < 2600; k++) { const px = fr.int(0, W - 1), py = fr.int(0, Hh - 1); if (px > 11 && px < W - 12 && py > 11 && py < Hh - 12) continue; x.fillStyle = fr.pick(['#c8403a', '#e0c840', '#ece8dc', '#8a56aa', '#3f6a2c', '#3f6a2c', '#4c7a34']); x.fillRect(px, py, 1, 1); } } // a ribbon of flowers
  x.fillStyle = '#cdb98c'; x.fillRect(11, 11, W - 22, Hh - 22);
  x.beginPath(); x.rect(11.5, 11.5, W - 23, Hh - 23); line(2, G);
  // the middle: a lozenge with a round bed, red earth within
  x.beginPath(); x.moveTo(W / 2 - 46, Hh / 2); x.lineTo(W / 2, Hh / 2 - 27); x.lineTo(W / 2 + 46, Hh / 2); x.lineTo(W / 2, Hh / 2 + 27); x.closePath(); x.fillStyle = '#b4502f'; x.fill(); line(4, G);
  x.beginPath(); x.arc(W / 2, Hh / 2, 13, 0, 6.283); x.fillStyle = '#cdb98c'; x.fill(); line(3, G); x.beginPath(); x.arc(W / 2, Hh / 2, 6, 0, 6.283); x.fillStyle = G2; x.fill();
  // scrolls in the four corners, each a pair of volutes turning out from a stem, and a leaf between
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) { const P = (u, v) => [W / 2 + sx * u, Hh / 2 + sy * v];
    const spiral = (cu, cv, r0, turns, dir) => { x.beginPath(); for (let k = 0; k <= 40; k++) { const a = k / 40 * turns * 6.283, r = r0 * (1 - 0.8 * k / 40), [px, py] = P(cu + Math.cos(a) * r * dir, cv + Math.sin(a) * r); if (k) x.lineTo(px, py); else x.moveTo(px, py); } line(3.4, G); };
    spiral(66, 22, 12, 1.6, 1); spiral(40, 30, 8, 1.4, -1); spiral(74, 6, 7, 1.3, -1);
    x.beginPath(); x.moveTo(...P(48, 2)); x.quadraticCurveTo(...P(60, 10), ...P(54, 22)); x.quadraticCurveTo(...P(46, 14), ...P(48, 2)); x.fillStyle = '#b8a23a'; x.fill(); line(1.6, G);
    x.beginPath(); x.moveTo(...P(20, 30)); x.quadraticCurveTo(...P(30, 34), ...P(28, 24)); line(2.2, G);
    x.beginPath(); x.arc(...P(78, 30), 3, 0, 6.283); x.fillStyle = G2; x.fill(); }
  noiseImg(x, W, Hh, 0.07, new RNG(92)); return c;
}
// a run of turned balusters, seen against whatever lies behind (alpha)
function genBalus() {
  const [c, x] = cnv(16, 16); x.clearRect(0, 0, 16, 16); const w = [3, 3, 5, 7, 8, 8, 7, 5, 3, 3, 4, 5, 5, 4, 3, 3];
  for (let j = 0; j < 16; j++) { const ww = w[j]; x.fillStyle = j % 5 === 0 ? '#b9ae94' : '#d4cab0'; x.fillRect(8 - Math.ceil(ww / 2), j, ww, 1); x.fillStyle = '#a89e84'; x.fillRect(8 + Math.floor(ww / 2) - 1, j, 1, 1); }
  return c;
}
// a tall sash window in its stone surround: broad white bars and large panes, so the grid still reads from across a court
function genSash(rows) {
  const W = 16, Hh = rows > 2 ? 32 : 18, [c, x] = cnv(W, Hh);
  x.fillStyle = '#cdc4ac'; x.fillRect(0, 0, W, Hh); x.fillStyle = '#b4aa90'; x.fillRect(0, Hh - 2, W, 2); x.fillRect(6, 0, 4, 2);
  x.fillStyle = '#f4f1e8'; x.fillRect(2, 2, 12, Hh - 4);
  const ph = (Hh - 4 - (rows + 1)) / rows;
  for (let j = 0; j < rows; j++) for (let i = 0; i < 2; i++) { const x0 = 3 + i * 5.5, y0 = 3 + j * (ph + 1);
    x.fillStyle = j < rows / 2 ? '#1e2a36' : '#283848'; x.fillRect(Math.round(x0), Math.round(y0), 5, Math.round(ph));
    if ((i + j) % 2 === 0) { x.fillStyle = 'rgba(200,222,255,0.3)'; x.fillRect(Math.round(x0) + 1, Math.round(y0) + 1, 1, 2); } }
  return c;
}
function genPortcullis() {
  const [c, x] = cnv(32, 32);
  x.fillStyle = '#26262a'; for (let i = 1; i < 32; i += 6) x.fillRect(i, 0, 2, 30);
  for (let j = 2; j < 30; j += 7) x.fillRect(0, j, 32, 2);
  x.fillStyle = '#44444a'; for (let i = 1; i < 32; i += 6) x.fillRect(i, 29, 2, 3);
  return c;
}
function genStripes(a, b2, w = 8) {
  const [c, x] = cnv(32, 32); for (let i = 0; i < 32; i += w) { x.fillStyle = (i / w) % 2 ? b2 : a; x.fillRect(i, 0, w, 32); }
  x.fillStyle = 'rgba(0,0,0,0.3)'; x.fillRect(0, 0, 32, 2); return c;
}
function genBanner(base, emblem) {
  const [c, x] = cnv(32, 64);
  x.fillStyle = base; x.fillRect(2, 0, 28, 56);
  for (let i = 0; i < 4; i++) x.fillRect(2 + i * 7, 56, 7, 4 + (i % 2) * 4);
  x.fillStyle = '#c8a040'; x.fillRect(2, 0, 28, 3); x.fillRect(2, 3, 2, 53); x.fillRect(28, 3, 2, 53);
  x.fillStyle = emblem;
  if (emblem) { // golden dagger with a crown above
    x.fillRect(15, 18, 2, 24); x.fillRect(11, 38, 10, 2); x.fillRect(15, 40, 2, 5); x.fillRect(14, 45, 4, 2);
    x.fillRect(10, 10, 12, 3); x.fillRect(10, 7, 2, 3); x.fillRect(15, 6, 2, 4); x.fillRect(20, 7, 2, 3);
  }
  noiseImg(x, 32, 64, 0.12, new RNG(3)); return c;
}
function genSign(kind) {
  const [c, x] = cnv(32, 32);
  x.fillStyle = '#5a3a1e'; x.fillRect(1, 1, 30, 30); x.fillStyle = '#7a5530'; x.fillRect(3, 3, 26, 26);
  x.fillStyle = '#2c1c0e'; x.fillRect(1, 1, 30, 1); x.fillRect(1, 30, 30, 1); x.fillRect(1, 1, 1, 30); x.fillRect(30, 1, 1, 30);
  const G_ = '#e0c070', S_ = '#c8ccd4', D_ = '#2a1a0e';
  switch (kind) {
    case 'tavern': x.fillStyle = G_; x.fillRect(10, 10, 10, 14); x.fillStyle = '#f4f0e0'; x.fillRect(10, 8, 10, 3); x.fillStyle = G_; x.fillRect(20, 13, 3, 2); x.fillRect(22, 13, 2, 8); x.fillRect(20, 19, 3, 2); x.fillStyle = D_; x.fillRect(12, 13, 1, 9); x.fillRect(17, 13, 1, 9); break;
    case 'weaponsmith': x.fillStyle = S_; for (let i = 0; i < 14; i++) x.fillRect(8 + i, 22 - i, 2, 2); x.fillStyle = G_; x.fillRect(8, 19, 7, 2); x.fillRect(10, 17, 2, 7); x.fillRect(6, 24, 3, 2); break;
    case 'armorer': x.fillStyle = S_; x.fillRect(9, 8, 14, 10); for (let i = 0; i < 7; i++) x.fillRect(9 + i, 18 + i, 14 - i * 2, 1); x.fillStyle = '#8a1c1c'; x.fillRect(15, 9, 2, 14); x.fillRect(11, 12, 10, 2); break;
    case 'alchemist': x.fillStyle = '#d8e8f0'; x.fillRect(14, 7, 4, 7); x.fillStyle = '#7a4a20'; x.fillRect(14, 6, 4, 2); x.fillStyle = '#5ad06a'; pxCircle(x, 16, 19, 6, '#5ad06a'); x.fillStyle = '#9af0a0'; x.fillRect(13, 16, 2, 2); break;
    case 'general': x.fillStyle = '#b88a4a'; pxCircle(x, 16, 19, 7, '#b88a4a'); x.fillStyle = '#8a6030'; x.fillRect(13, 9, 6, 4); x.fillStyle = G_; x.fillRect(14, 17, 4, 5); x.fillStyle = D_; x.fillRect(15, 18, 2, 3); break;
    case 'mages': pxCircle(x, 16, 16, 8, '#3a5ad0'); x.fillStyle = '#f0f0ff'; x.fillRect(15, 9, 2, 14); x.fillRect(9, 15, 14, 2); x.fillRect(12, 12, 8, 8); x.fillStyle = '#3a5ad0'; x.fillRect(14, 14, 4, 4); break;
    case 'fighters': x.fillStyle = S_; for (let i = 0; i < 16; i++) { x.fillRect(8 + i, 8 + i, 2, 2); x.fillRect(23 - i, 8 + i, 2, 2); } x.fillStyle = '#8a1c1c'; x.fillRect(6, 22, 5, 3); x.fillRect(21, 22, 5, 3); break;
    case 'coach': pxCircle(x, 16, 17, 9, '#2a1a0e'); pxCircle(x, 16, 17, 7, G_); pxCircle(x, 16, 17, 5, '#7a5530'); x.fillStyle = G_; for (let a = 0; a < 8; a++) pxLine(x, 16, 17, 16 + Math.round(Math.cos(a * Math.PI / 4) * 6), 17 + Math.round(Math.sin(a * Math.PI / 4) * 6), G_); pxCircle(x, 16, 17, 2, '#2a1a0e'); break;
    case 'hospice': x.fillStyle = '#f0ece0'; x.fillRect(13, 7, 6, 18); x.fillRect(7, 13, 18, 6); x.fillStyle = '#3a8a4a'; x.fillRect(15, 9, 2, 14); x.fillRect(9, 15, 14, 2); break;
    case 'temple': pxCircle(x, 16, 16, 9, G_); pxCircle(x, 16, 16, 6, '#7a5530'); x.fillStyle = G_; x.fillRect(15, 6, 2, 20); x.fillRect(10, 11, 12, 2); break;
  }
  noiseImg(x, 32, 32, 0.1, new RNG(kind.length)); return c;
}

/* --------------------------- sky helpers --------------------------- */
// crop rows for fields: stripes of two shades with a speckle
function genFurrows(seed, base, row, rowW = 2, period = 6, specks = []) {
  const rng = new RNG(seed); const s = 64; const [c, x] = cnv(s, s); x.fillStyle = base; x.fillRect(0, 0, s, s);
  for (let y = 0; y < s; y += period) { x.fillStyle = row; x.fillRect(0, y, s, rowW); }
  for (const [col, count, w, h] of specks) for (let i = 0; i < count; i++) { x.fillStyle = col; x.fillRect(rng.int(0, s - 1), rng.int(0, s - 1), w, h); }
  noiseImg(x, s, s, 0.2, rng); return c;
}
function genPuff(seed) {
  const rng = new RNG(seed); const s = 16; const [c, x] = cnv(s, s);
  for (let i = 0; i < 6; i++) pxCircle(x, 8 + rng.range(-3, 3), 8 + rng.range(-3, 3), rng.range(2.5, 4.5), '#cfcdc8');
  for (let i = 0; i < 4; i++) pxCircle(x, 7 + rng.range(-2, 2), 6 + rng.range(-2, 1), rng.range(1.5, 3), '#f0efea');
  return c;
}
function genGull(up) {
  const [c, x] = cnv(16, 8); x.fillStyle = '#f2f2ee';
  if (up) { pxLine(x, 1, 1, 7, 5, '#f2f2ee', 1); pxLine(x, 14, 1, 8, 5, '#f2f2ee', 1); x.fillStyle = '#3a3a3a'; x.fillRect(1, 1, 1, 1); x.fillRect(14, 1, 1, 1); }
  else { pxLine(x, 1, 5, 7, 4, '#f2f2ee', 1); pxLine(x, 14, 5, 8, 4, '#f2f2ee', 1); x.fillStyle = '#3a3a3a'; x.fillRect(1, 5, 1, 1); x.fillRect(14, 5, 1, 1); }
  x.fillStyle = '#d8d8d0'; x.fillRect(7, 4, 2, 2); return c;
}
function genSignBoard(lines) {
  const [c, x] = cnv(128, 48); x.fillStyle = '#6a4a2a'; x.fillRect(0, 0, 128, 48); x.fillStyle = '#4e3420'; x.fillRect(0, 0, 128, 3); x.fillRect(0, 45, 128, 3);
  for (let i = 0; i < 40; i++) { x.fillStyle = 'rgba(40,24,10,0.35)'; x.fillRect((i * 37) % 128, (i * 13) % 48, 12, 1); }
  x.fillStyle = '#efe2bc'; x.font = 'bold 15px Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((t, i) => x.fillText(t, 64, 14 + i * 20));
  return c;
}
function genClouds(seed) {
  const rng = new RNG(seed); const s = 128;
  const grid = (n) => { const g = []; for (let i = 0; i < n * n; i++) g.push(rng.next()); return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi; const at = (i, j) => g[((j % n + n) % n) * n + ((i % n + n) % n)]; const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy); return lerp(lerp(at(xi, yi), at(xi + 1, yi), sx), lerp(at(xi, yi + 1), at(xi + 1, yi + 1), sx), sy); }; };
  const oct = [grid(4), grid(8), grid(16), grid(32)];
  const [c, x] = cnv(s, s); const img = x.createImageData(s, s); const a = img.data;
  for (let y = 0; y < s; y++) for (let xx = 0; xx < s; xx++) {
    let v = 0, amp = 0.5, tot = 0;
    oct.forEach((f, i) => { const n = [4, 8, 16, 32][i]; v += f(xx / s * n, y / s * n) * amp; tot += amp; amp *= 0.5; });
    v /= tot; const al = smoothstep(0.48, 0.72, v);
    const k = (y * s + xx) * 4; const sh2 = 215 + v * 40; a[k] = sh2; a[k + 1] = sh2; a[k + 2] = sh2 + 8; a[k + 3] = al * 235;
  }
  x.putImageData(img, 0, 0); return c;
}
// the ring of mountains round the world, drawn once around the whole horizon (u = 0 is due south, 0.25 east, 0.5 north, 0.75 west).
// The bay stays open to the south; named peaks rise in the west and north-east.
function genMountains(seed) {
  const rng = new RNG(seed); const w = 2048, h = 160; const [c, x] = cnv(w, h);
  // peaks: [u, height, width left, width right]; asymmetric, with ridged flanks
  const PEAKS = [[0.79, 96, 0.018, 0.034], [0.745, 60, 0.03, 0.016], [0.832, 44, 0.012, 0.028], [0.665, 72, 0.04, 0.025], [0.55, 88, 0.02, 0.035], [0.47, 62, 0.05, 0.03], [0.335, 76, 0.024, 0.04], [0.24, 50, 0.035, 0.03], [0.62, 40, 0.02, 0.02]];
  const ridge = (u, s) => { let r = 0, a = 1, f = 1; for (let k = 0; k < 5; k++) { r += a * (1 - Math.abs(Math.sin(u * 60 * f + s * (k + 1) + Math.sin(u * 23 * f + k)))); a *= 0.5; f *= 2.3; } return r; };
  const layer = (base, amp, lit, shade, s, peakMul, rough, snow) => {
    let prev = null; const vals = [];
    for (let i = 0; i < w; i++) {
      const u = i / w; const du = Math.min(u, 1 - u); const sea = 1 - smoothstep(0.05, 0.17, du); // the open bay
      let v = base + amp * (0.35 + 0.25 * Math.sin(u * 29 + s) + 0.15 * Math.sin(u * 83 + s * 2)) + rough * 3 * ridge(u, s);
      for (const [pu, ph, wl, wr] of PEAKS) { let d = u - pu; if (d > 0.5) d -= 1; if (d < -0.5) d += 1; const wd = d < 0 ? wl : wr; const k = Math.max(0, 1 - Math.abs(d) / wd); v += peakMul * ph * Math.pow(k, 1.25) * (0.88 + 0.12 * ridge(u * 3, s + 1)); }
      v *= 1 - 0.9 * sea; v = Math.max(v, 7 + 3 * Math.sin(u * 140 + s)); vals.push(v);
    }
    for (let i = 0; i < w; i++) {
      const v = vals[i], dv = vals[(i + 3) % w] - vals[(i + w - 3) % w]; // the flank facing the morning sun is lit, the other in shade
      const top = Math.round(h - 4 - v); x.fillStyle = mixc(lit, shade, smoothstep(-1.2, 1.2, dv + (Math.sin(i * 0.9) + Math.sin(i * 0.37)) * 0.35)); x.fillRect(i, top, 1, h - top);
      if (snow && v > snow) { x.fillStyle = dv < 0 ? '#eef2f6' : '#c4ccda'; x.fillRect(i, top, 1, Math.max(1, Math.round((v - snow) * 0.45))); }
    }
  };
  layer(30, 30, '#c9bcc4', '#98a2ba', 1.3, 1.0, 1, 88);   // far range, pale in the haze, snow on the highest; sunlit flanks warm
  layer(18, 24, '#a8a0aa', '#7e8aa0', 4.1, 0.55, 1.4, 0);  // middle range
  layer(6, 16, '#848a80', '#687682', 7.7, 0.2, 1.8, 0);    // near foothills, a little green
  // the feet of the mountains dissolve into the haze
  const img = x.getImageData(0, 0, w, h), a = img.data; const hz = [205, 205, 214];
  for (let yy = Math.floor(h * 0.55); yy < h; yy++) { const t = smoothstep(h * 0.55, h, yy) * 0.9; for (let xx = 0; xx < w; xx++) { const k = (yy * w + xx) * 4; if (!a[k + 3]) continue; a[k] = lerp(a[k], hz[0], t); a[k + 1] = lerp(a[k + 1], hz[1], t); a[k + 2] = lerp(a[k + 2], hz[2], t); } }
  x.putImageData(img, 0, 0);
  return c;
}
function genGlow(r, g, b, size = 32) {
  const [c, x] = cnv(size, size); const img = x.createImageData(size, size); const a = img.data;
  for (let y = 0; y < size; y++) for (let xx = 0; xx < size; xx++) {
    const d = Math.hypot(xx - size / 2 + 0.5, y - size / 2 + 0.5) / (size / 2); const al = clamp(1 - d, 0, 1) ** 1.6;
    const k = (y * size + xx) * 4; a[k] = r; a[k + 1] = g; a[k + 2] = b; a[k + 3] = al * 255;
  }
  x.putImageData(img, 0, 0); return c;
}
function genMoon(size, base, seed) {
  const rng = new RNG(seed); const [c, x] = cnv(size, size);
  pxCircle(x, size / 2, size / 2, size / 2 - 2, base);
  for (let i = 0; i < size / 3; i++) pxCircle(x, rng.int(size * 0.25, size * 0.75), rng.int(size * 0.25, size * 0.75), rng.int(1, size / 10), 'rgba(0,0,0,0.12)');
  return c;
}

/* ------------------------------ sprites ------------------------------ */
const SKIN = ['#f0c8a0', '#e3b48c', '#cc946a', '#a8724c', '#7c5032', '#5c3a24'];
const HAIR = ['#2a1c12', '#4a3020', '#6a4526', '#a8783a', '#d8b060', '#8a8a8a', '#c8c8c8', '#7a2a18'];
const CLOTH = ['#6a2a2a', '#2a4a6a', '#3a5a2a', '#6a5a2a', '#4a3a5a', '#7a6a50', '#2e2e2e', '#8a4a1a', '#5a6a7a', '#a89a78', '#304040', '#702050', '#5a3a24'];

// front-facing humanoid, 24x48. frame: 0 idle, 1/2 walk, 3 attack
function drawHuman(o, frame) {
  const W = 24, H = 48; const [c, x] = cnv(W, H);
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const SR = (px, py, w, h, col) => { R(px, py, w, h, col); if (w > 2) { R(px, py, 1, h, sh(col, 0.72)); R(px + w - 1, py, 1, h, sh(col, 1.12)); } };
  const walk = frame === 1 ? 1 : frame === 2 ? -1 : 0, atk = frame === 3;
  const skin = o.skin, torso = o.shirt;
  if (o.cape) R(5, 17, 14, o.robe ? 29 : 25, sh(o.cape, 0.8));
  // legs
  if (!o.robe) {
    const lL = walk > 0 ? 2 : 0, lR = walk < 0 ? 2 : 0;
    SR(7 - (walk > 0 ? 1 : 0), 31, 4, 13 - lL, o.pants); SR(13 + (walk < 0 ? 1 : 0), 31, 4, 13 - lR, o.pants);
    R(7 - (walk > 0 ? 1 : 0), 44 - lL, 4, 4, o.boots); R(13 + (walk < 0 ? 1 : 0), 44 - lR, 4, 4, o.boots);
    R(6 - (walk > 0 ? 1 : 0), 46 - lL, 1, 2, o.boots); R(17 + (walk < 0 ? 1 : 0), 46 - lR, 1, 2, o.boots);
  } else {
    for (let yy = 17; yy < 46; yy++) { const g = Math.floor((yy - 17) / 7); R(7 - g, yy, 10 + g * 2, 1, o.robe); R(7 - g, yy, 1, 1, sh(o.robe, 0.7)); R(16 + g, yy, 1, 1, sh(o.robe, 1.15)); }
    R(3, 45, 18, 1, sh(o.robe, 0.6));
    R(7 + (walk > 0 ? -1 : 0), 46, 4, 2, o.boots); R(13 + (walk < 0 ? 1 : 0), 46, 4, 2, o.boots);
    if (o.trim) { R(4, 44, 16, 2, o.trim); R(11, 18, 2, 26, o.trim); }
  }
  // torso
  if (!o.robe) SR(7, 17, 10, 14, torso);
  else SR(7, 17, 10, 10, o.robe);
  R(5, 17, 14, 2, o.robe || torso);
  if (o.chain) for (let yy = 18; yy < 30; yy += 2) for (let xx = 8; xx < 16; xx += 2) R(xx + (yy % 4 === 0 ? 1 : 0), yy, 1, 1, sh(torso, 0.75));
  if (o.apron) SR(9, 21, 6, 12, o.apron);
  if (o.tabard) { SR(9, 18, 6, 16, o.tabard); R(11, 22, 2, 4, '#d8b040'); R(10, 23, 4, 1, '#d8b040'); }
  if (!o.robe) { R(7, 29, 10, 2, o.belt || '#3a2616'); R(11, 29, 2, 2, '#c8a040'); }
  if (o.ermine) { R(5, 17, 14, 3, '#f0f0ea'); R(7, 18, 1, 1, '#111'); R(11, 18, 1, 1, '#111'); R(15, 18, 1, 1, '#111'); }
  // arms
  const sleeve = o.robe || torso; const hand = o.handCol || skin;
  const aL = walk, aR = -walk;
  SR(4, 18 + aL, 3, 11, sleeve); R(4, 29 + aL, 3, 2, hand);
  if (atk) { SR(17, 9, 3, 10, sleeve); R(17, 7, 3, 2, hand); }
  else { SR(17, 18 + aR, 3, 11, sleeve); R(17, 29 + aR, 3, 2, hand); }
  // head
  R(11, 15, 2, 2, skin);
  SR(9, 7, 6, 8, skin);
  R(10, 10, 1, 1, o.eyes || '#1a1010'); R(13, 10, 1, 1, o.eyes || '#1a1010');
  R(11, 13, 2, 1, sh(skin, 0.7));
  const hair = o.hair;
  if (o.hairStyle >= 1) { R(9, 6, 6, 2, hair); R(8, 7, 1, 4, hair); R(15, 7, 1, 4, hair); R(9, 8, 6, 1, hair); }
  if (o.hairStyle === 2) { R(8, 7, 1, 11, hair); R(15, 7, 1, 11, hair); R(7, 10, 1, 7, hair); R(16, 10, 1, 7, hair); }
  if (o.hairStyle === 3) { R(10, 4, 4, 3, hair); }
  if (o.beard) { R(9, 11, 6, 5, hair); R(10, 16, 4, 1, hair); R(10, 10, 1, 1, '#1a1010'); R(13, 10, 1, 1, '#1a1010'); R(11, 13, 2, 1, sh(hair, 0.6)); }
  if (o.hood) { R(8, 5, 8, 3, o.hood); R(7, 7, 2, 11, o.hood); R(15, 7, 2, 11, o.hood); R(9, 7, 6, 1, sh(o.hood, 0.7)); }
  if (o.mask) R(9, 11, 6, 4, o.mask);
  if (o.hat) { R(8, 5, 8, 2, o.hat); R(10, 3, 4, 2, o.hat); }
  if (o.helmet) { R(8, 4, 8, 4, '#8a909a'); R(8, 8, 1, 4, '#6a707a'); R(15, 8, 1, 4, '#6a707a'); R(11, 8, 2, 3, '#8a909a'); R(9, 4, 6, 1, '#b0b6c0'); }
  if (o.crown) { R(9, 4, 6, 2, '#e0b840'); R(9, 3, 1, 1, '#e0b840'); R(11, 2, 2, 2, '#e0b840'); R(14, 3, 1, 1, '#e0b840'); R(11, 4, 1, 1, '#c02020'); }
  // held weapon
  const wpn = o.weapon;
  if (wpn) {
    const blade = o.bladeCol || '#c8ccd4';
    if (atk) {
      if (wpn === 'staff') { R(19, 0, 2, 12, '#6a4a2a'); if (o.orb) { R(18, 0, 4, 3, o.orb); } }
      else { pxLine(x, 19, 7, 23, 0, blade, 2); R(17, 7, 4, 1, '#c8a040'); }
    } else {
      if (wpn === 'sword') { R(18, 31 + aR, 1, 11, blade); R(17, 30 + aR, 3, 1, '#c8a040'); }
      else if (wpn === 'dagger') { R(18, 31 + aR, 1, 5, blade); }
      else if (wpn === 'spear') { R(20, 1, 1, 46, '#6a4a2a'); R(19, 0, 3, 4, blade); R(20, -1, 1, 2, blade); }
      else if (wpn === 'staff') { R(2, 4, 2, 44, '#6a4a2a'); if (o.orb) { R(1, 1, 4, 4, o.orb); R(2, 2, 1, 1, '#ffffff'); } }
      else if (wpn === 'axe') { R(18, 24 + aR, 1, 14, '#6a4a2a'); R(19, 24 + aR, 3, 4, blade); }
      else if (wpn === 'lute') { pxCircle(x, 12, 26, 3, '#a0682a'); R(14, 20, 6, 1, '#6a4a2a'); }
    }
  }
  noiseImg(x, W, H, 0.1, new RNG(frame + 7));
  outline(c);
  return c;
}
function drawSkeleton(frame) {
  const [c, x] = cnv(24, 48); const B = '#d8d0b0', D = '#8a826a';
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const walk = frame === 1 ? 1 : frame === 2 ? -1 : 0, atk = frame === 3;
  R(9, 5, 6, 7, B); R(10, 12, 4, 2, B); R(10, 8, 2, 2, '#100808'); R(13, 8, 2, 2, '#100808'); R(12, 10, 1, 1, '#100808');
  R(10, 13, 1, 1, D); R(12, 13, 1, 1, D);
  R(11, 15, 2, 15, B);
  for (let yy = 17; yy < 27; yy += 2) { R(8, yy, 8, 1, B); R(8, yy + 1, 8, 1, 'rgba(0,0,0,0)'); }
  R(7, 16, 10, 1, B);
  R(9, 29, 6, 3, B);
  R(9 - (walk > 0 ? 1 : 0), 32, 2, 13 - (walk > 0 ? 2 : 0), B); R(13 + (walk < 0 ? 1 : 0), 32, 2, 13 - (walk < 0 ? 2 : 0), B);
  R(8 - (walk > 0 ? 1 : 0), 45 - (walk > 0 ? 2 : 0), 3, 2, B); R(13 + (walk < 0 ? 1 : 0), 45 - (walk < 0 ? 2 : 0), 3, 2, B);
  R(5, 17 + walk, 2, 12, B); R(4, 29 + walk, 3, 2, B);
  if (atk) { R(17, 8, 2, 9, B); R(17, 6, 3, 2, B); pxLine(x, 19, 6, 23, 0, '#8a6a4a', 2); }
  else { R(17, 17 - walk, 2, 12, B); R(17, 29 - walk, 3, 2, B); R(18, 31 - walk, 1, 10, '#8a6a4a'); R(17, 30 - walk, 3, 1, '#5a4a3a'); }
  noiseImg(x, 24, 48, 0.12, new RNG(frame + 3)); outline(c); return c;
}
function drawWraith(frame) {
  const [c, x] = cnv(24, 48); const Rb = '#262a36';
  const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const sway = frame === 1 ? 1 : frame === 2 ? -1 : 0;
  R(8, 4, 8, 4, Rb); R(7, 7, 10, 10, Rb); R(9, 8, 6, 7, '#050508');
  R(10, 10, 1, 1, '#8fe8ff'); R(13, 10, 1, 1, '#8fe8ff');
  for (let yy = 16; yy < 46; yy++) { const g = Math.floor((yy - 16) / 6); const w = 10 + g * 2; const xo = 7 - g + (yy > 36 ? sway : 0); for (let xx = 0; xx < w; xx++) { if (yy > 38 && ((xx + yy + frame) % 3 === 0)) continue; R(xo + xx, yy, 1, 1, yy > 36 ? sh(Rb, 0.8) : Rb); } }
  if (frame === 3) { R(3, 12, 3, 8, Rb); R(18, 12, 3, 8, Rb); R(3, 10, 3, 2, '#c8c0a0'); R(18, 10, 3, 2, '#c8c0a0'); }
  else { R(4, 20, 3, 9, Rb); R(17, 20, 3, 9, Rb); R(4, 29, 3, 2, '#c8c0a0'); R(17, 29, 3, 2, '#c8c0a0'); }
  outline(c, [8, 8, 14]); return c;
}
function drawRat(frame) {
  const [c, x] = cnv(24, 12); const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  const B = '#5a4636';
  R(6, 4, 11, 5, B); R(7, 3, 9, 1, B); R(7, 9, 9, 1, sh(B, 0.8)); R(8, 7, 7, 2, '#7a6656');
  R(16, 5, 4, 4, B); R(20, 6, 1, 2, B); R(21, 7, 1, 1, '#d89090'); R(16, 3, 2, 2, '#b07070'); R(18, 5, 1, 1, '#ff3020');
  R(5, 7, 1, 1, '#a07070'); R(4, 8, 1, 1, '#a07070'); R(3, 8, 1, 1, '#a07070'); R(2, 7, 1, 1, '#a07070'); R(1, 6, 1, 1, '#a07070');
  if (frame % 2 === 0) { R(8, 10, 1, 2, B); R(14, 10, 1, 2, B); } else { R(9, 10, 1, 2, B); R(13, 10, 1, 2, B); R(16, 9, 1, 2, B); }
  noiseImg(x, 24, 12, 0.15, new RNG(frame)); outline(c); return c;
}
function drawBat(frame) {
  const [c, x] = cnv(32, 16); const B = '#3a2a2a'; const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  R(14, 5, 4, 6, B); R(14, 3, 1, 2, B); R(17, 3, 1, 2, B); R(15, 6, 1, 1, '#ff4030'); R(16, 6, 1, 1, '#ff4030');
  if (frame % 2 === 0) { for (let i = 0; i < 12; i++) { R(13 - i, 6 - Math.floor(i / 2), 1, 3 + (i % 3 === 0 ? 0 : 1), B); R(18 + i, 6 - Math.floor(i / 2), 1, 3 + (i % 3 === 0 ? 0 : 1), B); } }
  else { for (let i = 0; i < 12; i++) { R(13 - i, 6 + Math.floor(i / 2), 1, 3 - (i % 3 === 0 ? 1 : 0), B); R(18 + i, 6 + Math.floor(i / 2), 1, 3 - (i % 3 === 0 ? 1 : 0), B); } }
  outline(c); return c;
}
function drawTree(kind, seed) {
  const rng = new RNG(seed);
  if (kind === 'pine') {
    const [c, x] = cnv(40, 96); x.fillStyle = '#4a3220'; x.fillRect(18, 60, 5, 36);
    for (let i = 0; i < 7; i++) { const y0 = 6 + i * 10, w = 6 + i * 2.6; for (let yy = 0; yy < 14; yy++) { const ww = Math.round(w * yy / 14) + 1; x.fillStyle = yy > 10 ? '#1c3222' : '#26422c'; x.fillRect(20 - ww, y0 + yy, ww * 2, 1); } }
    for (let i = 0; i < 90; i++) { x.fillStyle = rng.chance(0.5) ? '#34583a' : '#1a2e1e'; x.fillRect(rng.int(4, 36), rng.int(8, 80), 1, 1); }
    noiseImg(x, 40, 96, 0.12, rng); outline(c, [12, 20, 12]); return c;
  }
  if (kind === 'dead') {
    const [c, x] = cnv(48, 80); const col = '#4a4038';
    x.fillStyle = col; x.fillRect(21, 36, 5, 44);
    const br = (x0, y0, ang, len, t) => { if (len < 3) return; const x1 = x0 + Math.cos(ang) * len, y1 = y0 - Math.sin(ang) * len; pxLine(x, x0, y0, x1, y1, col, t); br(x1, y1, ang + rng.range(0.2, 0.6), len * 0.65, Math.max(1, t - 1)); br(x1, y1, ang - rng.range(0.2, 0.6), len * 0.6, Math.max(1, t - 1)); };
    br(23, 40, Math.PI / 2, 16, 3);
    outline(c, [20, 16, 14]); return c;
  }
  if (kind === 'cypress') {
    const [c, x] = cnv(24, 80); x.fillStyle = '#3a2a1a'; x.fillRect(11, 70, 3, 10);
    for (let yy = 2; yy < 74; yy++) { const t = yy / 74; const w = Math.round(Math.sin(Math.min(1, t * 1.15) * Math.PI) * 9) + 1; x.fillStyle = '#20381f'; x.fillRect(12 - w, yy, w * 2, 1); }
    for (let i = 0; i < 70; i++) { x.fillStyle = rng.chance(0.5) ? '#2e4c2a' : '#152814'; x.fillRect(rng.int(4, 20), rng.int(4, 70), 1, 2); }
    outline(c, [10, 18, 10]); return c;
  }
  if (kind === 'grove') {
    const [c, x] = cnv(96, 72);
    for (const [tx, tw] of [[20, 4], [44, 5], [70, 4], [56, 3]]) { x.fillStyle = '#3a2818'; x.fillRect(tx, 50, tw, 22); }
    for (let i = 0; i < 16; i++) { const cx = rng.int(12, 84), cy = rng.int(16, 46), r = rng.int(9, 15); pxCircle(x, cx, cy, r, rng.chance(0.5) ? '#23391f' : '#2c4626'); }
    for (let i = 0; i < 10; i++) pxCircle(x, rng.int(14, 82), rng.int(12, 36), rng.int(4, 8), '#3a5a2e');
    for (let i = 0; i < 160; i++) { x.fillStyle = rng.chance(0.5) ? '#46683a' : '#16261a'; x.fillRect(rng.int(4, 92), rng.int(6, 56), 1, 1); }
    noiseImg(x, 96, 72, 0.14, rng); outline(c, [12, 20, 12]); return c;
  }
  if (kind === 'bush' || kind === 'bushB') {
    const [c, x] = cnv(32, 20), B = kind === 'bushB'; // B: a hawthorn-ish, olive shrub beside the darker hazel
    // a dome sitting on the ground: dark below, lit on top (not a ring)
    for (let i = 0; i < 10; i++) pxCircle(x, rng.int(7, 25), rng.int(12, 15), rng.int(4, 7), B ? '#34421f' : '#2a431e');
    x.fillStyle = B ? '#2c381a' : '#233a19'; x.fillRect(6, 15, 20, 5);
    for (let i = 0; i < 7; i++) pxCircle(x, rng.int(9, 23), rng.int(7, 10), rng.int(2, 4), B ? '#4e5e2a' : '#3e5c26');
    for (let i = 0; i < 4; i++) pxCircle(x, rng.int(11, 21), rng.int(5, 8), rng.int(1, 2), B ? '#64743a' : '#527434');
    if (B) for (let i = 0; i < 5; i++) { x.fillStyle = rng.chance(0.5) ? '#d8d0b8' : '#7a2a24'; x.fillRect(rng.int(9, 23), rng.int(6, 13), 1, 1); } // blossom or haws
    noiseImg(x, 32, 20, 0.2, rng); outline(c, [14, 22, 10]); return c;
  }
  // oak
  const [c, x] = cnv(48, 80);
  x.fillStyle = '#4a3220'; x.fillRect(21, 44, 6, 36); x.fillStyle = '#5c4028'; x.fillRect(24, 44, 2, 36); x.fillStyle = '#4a3220'; x.fillRect(19, 76, 10, 4);
  pxLine(x, 23, 50, 14, 36, '#4a3220', 2); pxLine(x, 25, 48, 34, 34, '#4a3220', 2);
  for (let i = 0; i < 26; i++) pxCircle(x, 24 + rng.range(-13, 13), 28 + rng.range(-15, 12), rng.int(5, 9), '#2d4620');
  for (let i = 0; i < 18; i++) pxCircle(x, 22 + rng.range(-11, 9), 24 + rng.range(-14, 8), rng.int(3, 6), '#44652a');
  for (let i = 0; i < 10; i++) pxCircle(x, 20 + rng.range(-9, 6), 20 + rng.range(-12, 6), rng.int(1, 3), '#62883a');
  noiseImg(x, 48, 80, 0.16, rng); outline(c, [14, 22, 10]); return c;
}
function drawSimple(kind, frame = 0) {
  let c, x; const R = (px, py, w, h, col) => { x.fillStyle = col; x.fillRect(px, py, w, h); };
  switch (kind) {
    case 'tuft': [c, x] = cnv(16, 10); for (let i = 0; i < 9; i++) { const px = 2 + i * 1.4 + (i % 3) * 0.3, hgt = 4 + ((i * 7) % 5), lean = (i % 3) - 1; for (let yy = 0; yy < hgt; yy++) R(Math.round(px + lean * yy / hgt * 1.5), 9 - yy, 1, 1, yy > hgt - 2 && i % 4 === 0 ? '#9a9450' : yy < 2 ? '#3a4a24' : i % 2 ? '#56702e' : '#4a6428'); } break;
    case 'flowers': { [c, x] = cnv(16, 8); const rr = new RNG(19 + frame); const pal = [['#e8e070', '#f4f0d8'], ['#d84a3a', '#e8e070'], ['#b070d0', '#e8e8f4'], ['#f0f0e0', '#e0c040']][frame % 4];
      for (let i = 0; i < 9; i++) R(rr.int(0, 15), rr.int(5, 7), 1, 2, rr.chance(0.5) ? '#4a6a2a' : '#5a7a30'); // leaves at the foot
      for (let i = 0; i < 6; i++) { const px = rr.int(1, 14), top = rr.int(1, 4); R(px, top + 1, 1, 7 - top, '#46682a'); R(px, top, 1, 1, pal[i % 2]); if (rr.chance(0.5)) R(px + 1, top, 1, 1, pal[i % 2]); } break; }
    case 'reeds': { [c, x] = cnv(16, 20); const rr = new RNG(29);
      for (let i = 0; i < 11; i++) { const px = rr.int(1, 14), top = rr.int(2, 9), lean = rr.range(-0.25, 0.25); for (let y = top; y < 20; y++) R(Math.round(px + (20 - y) * lean * 0.3), y, 1, 1, y < top + 3 ? '#8a9a48' : i % 3 ? '#4e6a2a' : '#627a34'); if (rr.chance(0.35)) R(Math.round(px + (20 - top) * lean * 0.3), top - 2, 1, 3, '#5a3a1e'); }
      break; }
    case 'heather': { const rr = new RNG(31 + frame);
      if (!frame) { [c, x] = cnv(18, 9); // heather: low mounded shrubs, dull purple over dark green
        for (let i = 0; i < 5; i++) { const cx = rr.int(3, 14), cy = rr.int(5, 7), r = rr.int(2, 4); for (let yy = -r; yy <= 0; yy++) for (let xx = -r - 1; xx <= r + 1; xx++) if (xx * xx / ((r + 1) * (r + 1)) + yy * yy / (r * r) <= 1) R(cx + xx, cy + yy, 1, 1, yy > -2 ? '#3e4a2a' : '#4a4a30'); }
        for (let i = 0; i < 26; i++) R(rr.int(1, 16), rr.int(2, 6), 1, 1, rr.pick(['#6e4a62', '#7e5670', '#5e4254'])); for (let i = 0; i < 18; i++) R(rr.int(0, 17), 8, 1, 1, '#2e3620');
      } else { [c, x] = cnv(16, 16); // bracken: upright stems fanning out, the fronds arching over at the top
        for (let f = 0; f < 7; f++) { const a = -0.9 + f * 0.3 + rr.range(-0.1, 0.1), L = rr.int(9, 14), col = rr.pick(['#8a5a2a', '#7a6a30', '#9a6a34', '#6e6a2e']);
          for (let t = 0; t < L; t++) { const k = t / L, px = 8 + Math.sin(a) * t * (0.5 + k * 0.7), py = 15 - t * (1.05 - k * k * 0.9); R(Math.round(px), Math.round(py), 1, 1, col); if (t > L * 0.35 && t % 2 === 0) { R(Math.round(px) - 1, Math.round(py) + 1, 1, 1, col); R(Math.round(px) + 1, Math.round(py) + 1, 1, 1, col); } } }
      }
      break; }
    case 'fern': { [c, x] = cnv(20, 10); const rr = new RNG(23);
      for (let f = 0; f < 7; f++) { const a = -2.5 + f * 0.83 + rr.range(-0.2, 0.2), L = rr.range(6, 10); for (let t = 0; t < L; t++) { const k = t / L, px = 10 + Math.cos(a) * t * 0.95, py = 9 - Math.sin(Math.abs(a) < 1.57 ? 1.1 - k * 0.5 : 1.1 - k * 0.5) * t * (0.9 - 0.35 * k) * (1 - Math.abs(a + 0.8) * 0.12); R(Math.round(px), Math.round(py), 1, 1, t % 2 ? '#3e6428' : '#4e7630'); if (t % 2 === 0 && t > 1) R(Math.round(px), Math.round(py) - 1, 1, 1, '#5a8436'); } }
      break; }
    case 'torch': [c, x] = cnv(16, 32); R(7, 14, 2, 18, '#5a3a1e'); R(6, 14, 4, 2, '#3a3a3a');
      for (let i = 0; i < 14; i++) { const w = Math.max(1, Math.round((1 - i / 14) * 4 + (frame ? Math.sin(i) : Math.cos(i)))); R(8 - w, 13 - i, w * 2, 1, i < 4 ? '#f0f0a0' : i < 9 ? '#f0a030' : '#c04010'); } break;
    case 'candle': [c, x] = cnv(8, 16); R(2, 8, 4, 8, '#e8e0c8'); R(2, 8, 1, 8, '#b8b098'); R(3, 3 + frame, 2, 4 - frame, '#f0c040'); R(3, 5, 2, 2, '#fff0a0'); break;
    case 'bones': [c, x] = cnv(24, 10); R(2, 6, 10, 2, '#d0c8a8'); R(1, 5, 2, 4, '#d0c8a8'); R(11, 5, 2, 4, '#d0c8a8'); R(12, 4, 9, 2, '#c0b898'); R(14, 6, 6, 3, '#d8d0b0'); R(15, 7, 1, 1, '#201010'); R(17, 7, 1, 1, '#201010'); break;
    case 'skulls': [c, x] = cnv(24, 14); for (const [px, py] of [[3, 7], [10, 8], [16, 7], [7, 2], [13, 2]]) { R(px, py, 6, 5, '#d8d0b0'); R(px + 1, py + 2, 1, 1, '#201010'); R(px + 3, py + 2, 1, 1, '#201010'); } break;
    case 'urn': [c, x] = cnv(16, 20); pxCircle(x, 8, 12, 6, '#8a5a3a'); R(5, 2, 6, 5, '#8a5a3a'); R(4, 2, 8, 1, '#6a4028'); R(4, 11, 8, 1, '#5a3a24'); R(5, 8, 2, 6, '#a87250'); break;
    case 'cobweb': [c, x] = cnv(32, 32); for (let i = 0; i < 6; i++) pxLine(x, 0, 0, 31, i * 6, 'rgba(230,230,230,0.8)'); for (let r = 6; r < 30; r += 6) for (let a = 0; a < 16; a++) R(Math.round(Math.cos(a / 16 * Math.PI / 2) * r), Math.round(Math.sin(a / 16 * Math.PI / 2) * r), 1, 1, 'rgba(230,230,230,0.8)'); break;
    case 'chest': [c, x] = cnv(24, 18); R(1, 6, 22, 12, '#6a4424'); R(1, 2, 22, 5, '#7a5230'); R(1, 1, 22, 1, '#8a6238'); R(4, 1, 2, 17, '#2a2a2e'); R(18, 1, 2, 17, '#2a2a2e'); R(10, 6, 4, 4, '#c8a040'); R(11, 8, 2, 1, '#2a1a0e'); break;
    case 'sack': [c, x] = cnv(20, 16); pxCircle(x, 10, 10, 6, '#8a6a3a'); R(8, 2, 4, 4, '#8a6a3a'); R(7, 4, 6, 1, '#5a4020'); R(6, 8, 3, 3, '#a8884a'); break;
    case 'corpse': [c, x] = cnv(32, 10); R(2, 6, 28, 4, '#5a1010'); R(4, 5, 22, 3, '#6a5a4a'); R(24, 3, 6, 5, '#a88a6a'); R(8, 5, 12, 2, '#4a3a2a'); break;
    case 'fireball': c = genGlow(255, 150, 40, 16); x = c.getContext('2d'); pxCircle(x, 8, 8, 3, '#fff0a0'); break;
    case 'spark': c = genGlow(150, 190, 255, 16); x = c.getContext('2d'); pxCircle(x, 8, 8, 2, '#ffffff'); break;
    case 'heal': c = genGlow(120, 255, 140, 16); break;
    case 'bottles': [c, x] = cnv(24, 12); for (let i = 0; i < 5; i++) { const col = ['#3a8a4a', '#8a2a2a', '#2a4a9a', '#9a7a2a', '#6a3a8a'][i]; R(1 + i * 5, 4, 3, 8, col); R(2 + i * 5, 1, 1, 3, col); R(1 + i * 5, 5, 1, 3, 'rgba(255,255,255,0.4)'); } break;
    case 'dummy': [c, x] = cnv(24, 48); R(11, 20, 2, 28, '#5a3a1e'); R(4, 16, 16, 3, '#5a3a1e'); pxCircle(x, 12, 10, 5, '#c8a860'); R(7, 18, 10, 14, '#c8a860'); pxCircle(x, 12, 24, 3, '#a02020'); pxCircle(x, 12, 24, 1, '#f0e0c0'); break;
    case 'rack': [c, x] = cnv(32, 32); R(1, 8, 30, 2, '#5a3a1e'); R(1, 26, 30, 2, '#5a3a1e'); R(1, 8, 2, 24, '#5a3a1e'); R(29, 8, 2, 24, '#5a3a1e');
      for (let i = 0; i < 4; i++) { R(6 + i * 6, 2, 1, 26, '#c8ccd4'); R(4 + i * 6, 11, 5, 1, '#c8a040'); } break;
    case 'armorstand': [c, x] = cnv(24, 48); R(11, 34, 2, 12, '#5a3a1e'); R(6, 46, 12, 2, '#5a3a1e'); R(7, 12, 10, 18, '#9aa0aa'); R(5, 12, 3, 8, '#8a909a'); R(16, 12, 3, 8, '#8a909a'); R(9, 3, 6, 8, '#9aa0aa'); R(10, 6, 4, 1, '#20202a'); R(11, 7, 2, 3, '#20202a'); R(7, 29, 10, 5, '#7a808a'); break;
    case 'fire': [c, x] = cnv(24, 24); for (let i = 0; i < 18; i++) { const w = Math.max(1, Math.round((1 - i / 18) * 9 + Math.sin(i * 1.7 + frame * 2) * 1.5)); R(12 - w, 22 - i, w * 2, 1, i < 5 ? '#fff0a0' : i < 11 ? '#f0a030' : '#c04010'); } R(4, 22, 16, 2, '#3a2010'); break;
    case 'spray': [c, x] = cnv(16, 32); for (let i = 0; i < 40; i++) R(8 + Math.round((Math.random() - 0.5) * (i / 3)), 31 - Math.round(i * 0.75 + (frame ? 1 : 0)), 1, 2, 'rgba(200,225,255,0.85)'); break;
    case 'orb': c = genGlow(120, 170, 255, 16); x = c.getContext('2d'); pxCircle(x, 8, 8, 3, '#c0e0ff'); break;
    case 'sheep': [c, x] = cnv(20, 14); pxCircle(x, 10, 7, 5, '#e8e4d8'); pxCircle(x, 7, 6, 3, '#f2efe6'); R(15, 4, 4, 4, '#3a3430'); R(18, 5, 1, 1, '#e8e4d8'); for (const px of [5, 8, 12, 14]) R(px, 11, 1, 3, '#3a3430'); break;
    case 'hay': [c, x] = cnv(32, 24); for (let yy = 4; yy < 24; yy++) { const w = Math.round(Math.sin((yy - 2) / 22 * Math.PI) * 14) + 2; R(16 - w, yy, w * 2, 1, '#b8983a'); } for (let i = 0; i < 40; i++) R(4 + Math.floor(Math.random() * 24), 6 + Math.floor(Math.random() * 16), 1, 3, '#8a6a20'); break;
    case 'carriage': { [c, x] = cnv(64, 40); const W_ = '#3a2414';
      // horse
      R(3, 16, 18, 9, '#6a4428'); R(1, 10, 5, 8, '#6a4428'); R(0, 12, 2, 4, '#5a3820'); R(3, 8, 3, 3, '#6a4428'); R(5, 9, 2, 2, '#2a1a0e');
      R(4, 25, 2, 11, '#5a3820'); R(9, 25, 2, 11, '#5a3820'); R(15, 25, 2, 11, '#5a3820'); R(19, 25, 2, 11, '#5a3820'); R(20, 16, 3, 7, '#3a2414');
      R(6, 14, 9, 2, '#8a1c1c'); R(21, 19, 8, 1, '#2a1a0e');
      // coach
      R(26, 8, 34, 20, '#5a2a1c'); R(26, 6, 34, 3, W_); R(24, 26, 38, 3, W_); R(29, 11, 11, 9, '#d8c890'); R(44, 11, 11, 9, '#d8c890'); R(34, 11, 1, 9, W_); R(49, 11, 1, 9, W_);
      R(27, 21, 32, 1, '#c8a040'); R(40, 4, 6, 2, '#c8a040'); R(59, 10, 3, 3, '#f0c040');
      for (const [wx, wr] of [[32, 6], [54, 6]]) { pxCircle(x, wx, 32, wr, W_); pxCircle(x, wx, 32, wr - 2, '#8a6a40'); pxCircle(x, wx, 32, 1, W_); R(wx - wr + 1, 32, wr * 2 - 1, 1, W_); R(wx, 32 - wr + 1, 1, wr * 2 - 1, W_); }
      break; }
    case 'well': [c, x] = cnv(32, 40); R(4, 26, 24, 14, '#7a7466'); for (let i = 0; i < 4; i++) R(4, 27 + i * 3, 24, 1, '#4a453c'); R(5, 6, 2, 21, '#4e3420'); R(25, 6, 2, 21, '#4e3420'); R(2, 3, 28, 4, '#8e3b2a'); R(15, 7, 2, 10, '#5a5a5a'); R(13, 16, 6, 5, '#6a4a2c'); break;
    case 'kingstatue': { const g = '#9a9a96'; return drawHuman({ skin: g, shirt: g, pants: g, boots: '#8a8a86', hair: '#8a8a86', hairStyle: 1, beard: true, eyes: '#6a6a66', crown: true, cape: '#8e8e8a', weapon: 'sword', handCol: g }, 0); }
    case 'statue': return drawHuman({ skin: '#9a9a96', shirt: '#9a9a96', pants: '#9a9a96', boots: '#8a8a86', robe: '#8e8e8a', hair: '#8a8a86', hairStyle: 2, beard: true, eyes: '#6a6a66', weapon: 'staff', handCol: '#9a9a96' }, 0);
  }
  if (!['fireball', 'spark', 'heal', 'orb', 'cobweb', 'spray', 'tuft', 'flowers', 'fern', 'reeds'].includes(kind)) outline(c, kind === 'heather' ? [30, 24, 20] : undefined);
  return c;
}

/* ---- townsfolk appearance ---- */
function randomLook(rng, gender) {
  const female = gender === 'f';
  const o = {
    skin: rng.pick(SKIN), hair: rng.pick(HAIR), shirt: rng.pick(CLOTH), pants: rng.pick(CLOTH.slice(4)), boots: rng.pick(['#2a1c12', '#3a2616', '#1a1a1a', '#4a3020']),
    hairStyle: female ? rng.pick([2, 2, 3, 1]) : rng.pick([0, 1, 1, 1, 2]), beard: !female && rng.chance(0.35),
  };
  if (female && rng.chance(0.6)) o.robe = rng.pick(CLOTH);
  if (!female && rng.chance(0.12)) o.robe = rng.pick(CLOTH);
  if (rng.chance(0.2)) o.hat = rng.pick(['#3a2a1a', '#5a2a2a', '#2a3a4a']);
  if (rng.chance(0.15)) o.apron = rng.pick(['#c8c0a8', '#8a7a60']);
  if (rng.chance(0.12)) o.hood = rng.pick(['#4a3a2a', '#3a4a3a', '#5a2a2a']);
  if (rng.chance(0.18)) o.cape = rng.pick(CLOTH);
  return o;
}
const LOOKS = {
  guard: { skin: '#e0b088', hair: '#4a3020', hairStyle: 1, shirt: '#7a808a', chain: true, tabard: '#7a1818', pants: '#2e2e30', boots: '#1a1a1a', helmet: true, weapon: 'spear' },
  king: { skin: '#e0b088', hair: '#6a4526', hairStyle: 1, beard: true, robe: '#8a1c1c', trim: '#e0b840', ermine: true, boots: '#2a1c12', crown: true, cape: '#6a1010' },
  queen: { skin: '#8a5a38', hair: '#1a1210', hairStyle: 2, robe: '#4a2a6a', trim: '#e0b840', boots: '#2a1c12', crown: true, cape: '#3a1a5a' },
  ghostking: { skin: '#d8c8b8', hair: '#8a8a8a', hairStyle: 1, beard: true, shirt: '#9aa0aa', chain: true, pants: '#6a707a', boots: '#4a4a50', crown: true, cape: '#5a2020', weapon: 'sword' },
  thief: { skin: '#cc946a', hair: '#2a1c12', hairStyle: 1, shirt: '#3a2e24', pants: '#2a2420', boots: '#1a1410', hood: '#262420', mask: '#1a1814', weapon: 'dagger' },
  bandit: { skin: '#a8724c', hair: '#7a2a18', hairStyle: 1, beard: true, shirt: '#4a2a1a', pants: '#2a2420', boots: '#1a1410', hood: '#5a1a1a', weapon: 'axe' },
  zombie: { skin: '#7c8a5c', hair: '#3a3a2a', hairStyle: 2, shirt: '#4a3e2e', pants: '#3a3228', boots: '#2a241c', eyes: '#c02010', handCol: '#6c7a4c' },
  necro: { skin: '#c8c0b0', hair: '#1a1a1a', robe: '#24162e', trim: '#6a3a8a', boots: '#1a1a1a', hood: '#1a1020', eyes: '#80ff60', weapon: 'staff', orb: '#7cff6a' },
  priest: { skin: '#e3b48c', hair: '#c8c8c8', hairStyle: 0, robe: '#d8d0b8', trim: '#8a6a2a', boots: '#3a2616' },
  mage: { skin: '#f0c8a0', hair: '#d8b060', hairStyle: 2, robe: '#2a3a7a', trim: '#c8a040', boots: '#2a1c12', weapon: 'staff', orb: '#80b0ff' },
  fighter: { skin: '#cc946a', hair: '#8a8a8a', hairStyle: 1, beard: true, shirt: '#7a808a', chain: true, pants: '#3a2a1a', boots: '#2a1c12', weapon: 'axe' },
  bard: { skin: '#e3b48c', hair: '#a8783a', hairStyle: 2, shirt: '#7a2a5a', pants: '#2a4a6a', boots: '#3a2616', hat: '#2a5a2a', weapon: 'lute' },
};

/* ---- sprite registry: canvases → textures, cached ---- */
const SPR = {};
function sprite(key, make) { if (!SPR[key]) { const cs = make(); SPR[key] = { canvases: cs, tex: cs.map(cv => texFrom(cv, { repeat: false, mip: false })) }; } return SPR[key]; }
function humanSprite(key, look) { return sprite('h_' + key, () => [0, 1, 2, 3].map(f => drawHuman(look, f))); }
function ghostify(canvas) {
  const x = canvas.getContext('2d'); const d = x.getImageData(0, 0, canvas.width, canvas.height); const a = d.data;
  for (let i = 0; i < a.length; i += 4) { const l = (a[i] * 0.3 + a[i + 1] * 0.59 + a[i + 2] * 0.11) / 255; a[i] = 90 + l * 120; a[i + 1] = 140 + l * 110; a[i + 2] = 200 + l * 55; }
  x.putImageData(d, 0, 0); return canvas;
}
function enemySprite(kind) {
  switch (kind) {
    case 'rat': return sprite('rat', () => [0, 1, 0, 1].map(drawRat));
    case 'bat': return sprite('bat', () => [0, 1, 0, 1].map(drawBat));
    case 'skeleton': return sprite('skeleton', () => [0, 1, 2, 3].map(drawSkeleton));
    case 'wraith': return sprite('wraith', () => [0, 1, 2, 3].map(drawWraith));
    case 'zombie': return humanSprite('zombie', LOOKS.zombie);
    case 'thief': return humanSprite('thief', LOOKS.thief);
    case 'bandit': return humanSprite('bandit', LOOKS.bandit);
    case 'necro': return humanSprite('necro', LOOKS.necro);
    case 'guard': return humanSprite('guard', LOOKS.guard);
    case 'ghostking': return sprite('ghostking', () => [0, 1, 2, 3].map(f => ghostify(drawHuman(LOOKS.ghostking, f))));
  }
  return humanSprite('thief', LOOKS.thief);
}
function simpleSprite(kind, frames = 1) { return sprite('s_' + kind, () => { const a = []; for (let i = 0; i < frames; i++) a.push(drawSimple(kind, i)); return a; }); }
function treeSprite(kind, seed) { return sprite('t_' + kind + seed, () => [drawTree(kind, seed)]); }

/* ---- texture library for world surfaces ---- */
const TEX = {};
function initTextures() {
  const T = (k, c, o) => { TEX[k] = texFrom(c, o); };
  T('grass', genSpeckle(11, '#566a36', 0.22, 64, [['#62783e', 140, 1, 2], ['#465a2c', 140, 1, 2], ['#6e8446', 40, 1, 1], ['#7a7a48', 30, 2, 1]]));
  T('dirt', genEarth(12, '#6c5a40'));
  T('yard', genEarth(64, '#6e604a', { stones: 160, straw: 30 }));
  T('sand', genSpeckle(13, '#b8a478', 0.2, 64, [['#a89468', 100, 1, 1], ['#c8b488', 80, 1, 1]]));
  T('cobble', genCobbles(14, '#8a8274', '#4a4234'));
  T('cobbleDark', genCobbles(65, '#6e6a62', '#3c3830', { rowH: 8, wMin: 6, wMax: 11 }));
  T('plaza', genBlocks({ seed: 15, bw: 16, bh: 16, base: '#8e877a', mortar: '#4a453e', stagger: 0 }));
  T('flag', genBlocks({ seed: 16, size: 128, bw: 26, bh: 17, base: '#747068', mortar: '#34322c', vary: 0.16, noise: 0.16 }));
  T('water', genWater(17));
  T('stone', genBlocks({ seed: 18, bw: 16, bh: 8, base: '#8c8474', mortar: '#4a453c' }));
  T('stoneLight', genBlocks({ seed: 19, bw: 16, bh: 8, base: '#a8a292', mortar: '#5e5a50' }));
  T('cityWall', genBlocks({ seed: 20, bw: 21, bh: 16, base: '#7c7666', mortar: '#3e3a32', vary: 0.12, moss: 60 }));
  T('castle', genBlocks({ seed: 21, bw: 16, bh: 8, base: '#8a8274', mortar: '#46413a', vary: 0.16, moss: 40 }));
  T('scree', genScree(63, '#6e6a62'));
  T('cliff', genCliff(71, '#7a766c'));
  T('farNoise', genSpeckle(64, '#e6e6e6', 0.1, 64, [['#d4d4d4', 200, 1, 1], ['#f4f4f4', 160, 1, 1]])); // neutral: the horizon's colour comes from its vertices
  T('brick', genBlocks({ seed: 22, bw: 8, bh: 4, base: '#8a4a36', mortar: '#b0a590', vary: 0.2, bevel: false }));
  T('timber', genTimber(23));
  T('timber2', genTimber(24, '#cfc0a0', '#3a281a'));
  T('plaster', genSpeckle(25, '#cfc4a8', 0.12));
  T('wood', genPlanks(26, '#7a5634'));
  T('woodDark', genPlanks(27, '#4e3420'));
  T('floor', genPlanks(28, '#6a4a2c', 8, 64, true));
  T('roofRed', genRoof(29, '#8e3b2a'));
  T('roofSlate', genRoof(30, '#4e5664'));
  T('roofThatch', genThatch(31));
  T('door', genDoor(32), { repeat: false });
  T('doorDark', genDoor(33, '#3a2616'), { repeat: false });
  T('winDay', genWindow(false), { repeat: false });
  T('winNight', genWindow(true), { repeat: false });
  T('portcullis', genPortcullis(), { mip: false });
  T('dungeonWall', genBlocks({ seed: 34, bw: 16, bh: 8, base: '#5a554c', mortar: '#26231e', vary: 0.2, moss: 90 }));
  T('dungeonFloor', genVoronoi(35, '#4a463e', 18, 64, '#1e1c18', 1.4, 0.3));
  T('ceiling', genPlanks(36, '#3a2818', 16, 64, false));
  T('marble', genMarble(37));
  T('carpet', genCarpet(38));
  T('carpetBlue', genCarpet(39, '#1c2a6a', '#c8a040'));
  T('books', genBookshelf(40));
  T('iron', genSpeckle(41, '#34343a', 0.25));
  T('cloth', genSpeckle(42, '#b8b0a0', 0.15));
  T('clothRed', genSpeckle(43, '#7a2020', 0.15));
  T('stallA', genStripes('#b83a2a', '#e8dcc0'), { repeat: false });
  T('stallB', genStripes('#2a5aa8', '#e8dcc0'), { repeat: false });
  T('stallC', genStripes('#3a7a3a', '#e8c850'), { repeat: false });
  T('banner', genBanner('#1c2a6a', '#e0b840'), { repeat: false });
  T('bannerRed', genBanner('#7a1818', '#e0b840'), { repeat: false });
  T('bannerGuild', genBanner('#2a4a2a', null), { repeat: false });
  T('lantern', genWindow(true), { repeat: false });
  T('clouds', genClouds(44));
  T('mountains', genMountains(45), { mip: false });
  T('sail', genSpeckle(46, '#cbbd9c', 0.1));
  T('mud', genEarth(47, '#4e3e2c', { stones: 40, straw: 90, strawCol: '#7a6a3c' }));
  T('gravel', genGravel(48, '#7a705c'));
  T('hedge', genSpeckle(49, '#2f4a22', 0.35, 64, [['#48682c', 170, 2, 2], ['#1e3016', 150, 1, 2]]));
  T('crag', genStrata(58));
  T('ashlar', genBlocks({ seed: 84, bw: 32, bh: 16, base: '#cdc3a8', mortar: '#a2987e', vary: 0.07, noise: 0.1 })); T('balus', genBalus(), { mip: false }); T('broderie', genBroderie(), { repeat: false });
  T('sash', genSash(4), { repeat: false }); T('sashS', genSash(2), { repeat: false });
  T('lawn', genSpeckle(81, '#587036', 0.18, 64, [['#62783e', 130, 1, 2], ['#4c6230', 120, 1, 2], ['#6a8244', 40, 1, 1]]));
  T('gravelPale', genGravel(82, '#b2a37e', { pal: ['#c2b48e', '#a2946e', '#d0c4a0', '#b0a078', '#948664'] }));
  T('bed', genSpeckle(83, '#4c3c2a', 0.2, 64, [['#3f6a2c', 150, 2, 2], ['#c8403a', 130, 2, 2], ['#e0c840', 110, 2, 2], ['#ece8dc', 90, 2, 2], ['#8a56aa', 70, 2, 2]]));
  T('rock', genVoronoi(52, '#9a9382', 16, 64, '#5e584c', 1.4, 0.45));
  T('wheat', genFurrows(53, '#a49868', '#8a7e52', 2, 5, [['#b4a674', 120, 1, 2]]));
  T('barley', genFurrows(54, '#8c8e64', '#767a52', 2, 5, [['#9c9e72', 90, 1, 2]]));
  T('plowed', genFurrows(55, '#6a5238', '#4e3a28', 3, 6, [['#7a6044', 80, 2, 1]]));
  T('greens', genFurrows(56, '#5a6840', '#5a4e38', 2, 6, [['#667248', 140, 2, 2]]));
  T('meadow', genSpeckle(57, '#667e40', 0.25, 64, [['#76884c', 150, 1, 2], ['#566632', 120, 1, 2], ['#d8d070', 10, 1, 1], ['#e8e8e0', 8, 1, 1]]));
  T('roofCopper', genRoof(58, '#4f8f78'));
  T('roofBlue', genRoof(59, '#34488a'));
  T('roofBrown', genRoof(60, '#5c4430'));
  T('paveLight', genVoronoi(61, '#a89e86', 190, 128, '#5e5648', 1.2, 0.1));
  T('setts', genBlocks({ seed: 67, size: 128, bw: 11, bh: 8, base: '#7e7a72', mortar: '#3a3730', vary: 0.2, noise: 0.16 }));
  T('kerb', genBlocks({ seed: 66, size: 64, bw: 32, bh: 64, base: '#8a8478', mortar: '#3e3a32', vary: 0.14, stagger: 0.5 }));
  for (const [k, sd, w, kind] of [['doorA', 70, '#6a4424', 'z'], ['doorB', 71, '#6e665a', 'z'], ['doorC', 72, '#44583e', 'panel'], ['doorD', 73, '#6a2a22', 'panel'], ['doorE', 74, '#3c4a62', 'panel'], ['doorF', 75, '#4a3020', 'studded'], ['doorG', 76, '#8a6a3a', 'z']]) T(k, genDoorV(sd, w, kind), { repeat: false });
  T('smoke', genPuff(62), { repeat: false, mip: false });
  T('gull1', genGull(true), { repeat: false, mip: false }); T('gull2', genGull(false), { repeat: false, mip: false });
  T('signLook', genSignBoard(['Pilgrim\'s Rise', '← Aldhaven']), { repeat: false });
  for (const k of ['tavern', 'weaponsmith', 'armorer', 'alchemist', 'general', 'mages', 'fighters', 'temple', 'coach', 'hospice']) T('sign_' + k, genSign(k), { repeat: false, mip: false });
  TEX.sun = texFrom(genGlow(255, 240, 190, 64), { repeat: false, mip: false });
  TEX.moon = texFrom(genMoon(48, '#e4dccb', 5), { repeat: false, mip: false }); // one moon
  TEX.glow = texFrom(genGlow(255, 200, 120, 32), { repeat: false, mip: false });
  TEX.glowBlue = texFrom(genGlow(140, 180, 255, 32), { repeat: false, mip: false });
  TEX.glowGreen = texFrom(genGlow(140, 255, 120, 32), { repeat: false, mip: false });
}
