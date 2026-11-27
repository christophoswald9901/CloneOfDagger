/* =====================================================================
   Fort Merrow: a star fort of five bastions at the end of a low point on
   the western shore of the bay, some 4.3 km west of Aldhaven, where it
   commands the roadstead. An eighth fixed landmark, the same in every
   world. It is drawn the way the engineers of the 16th and 17th
   centuries drew theirs:
   - the trace: a regular pentagon, each side's bastions laid out from
     the lines of defence (the perpendicular a seventh of the side, the
     faces two sevenths, the flanks square to the curtain), as in the
     Italian and Dutch textbooks and at Bourtange, Naarden or the
     Kastellet in Copenhagen;
   - brick scarps with a stone cordon rising straight out of a wet moat
     fed by the sea, a thick parapet of earth over them with embrasures for
     guns, and stone sentry boxes at the bastion points (as at St Augustine
     or San Juan);
   - a ravelin before the gate on the land front, entered from the side,
     so the road reaches the gate in a dog-leg over two bridges (as at
     Fort George on the Moray Firth);
   - a covered way and a glacis on the land fronts; on the sea front none, so
     the sea bastion and its curtains rise straight from the water, and stone
     dams (batardeaux) close the wet ditch at either end of it;
   - inside: a parade with two ranges of barracks, the governor's house
     on the axis of the gate, a chapel, a powder magazine behind its own
     wall, a well, and a windmill on a bastion (as at the Kastellet);
     guns on the sea fronts, a flag on the sea bastion.
   A green hill behind the point looks down on it, so a redoubt holds the hill
   and a cavalier on the north-west bastion answers it.
   Notes: docs/FORT.md.
   Local frame: u east, v south (world x and z), from the middle of the parade.
   ===================================================================== */
const FORT_RAMPS = [0, 1, 4]; // the bastions with a gun ramp up from the parade
const FORT = { x: -4300, z: 672, R: 128, YP: 3.6, YR: 9.6, YRV: 7.4, YI: 3.3, CW: 3.0, TR: -24, WL: -0.92, W: 22, WR: 16, PA: 48, TAL: 9, GF: 3.3 };

const FORT_HILL = 74, FORT_REDOUBT = [-221, -296, 74], FORT_REDOUBT_A = 0.64; // the height of the hill behind the point; the redoubt on its top: where, and the level of its floor
// a polygon kept with its edges, for signed distances (negative inside) and insets
function fpoly(pts) {
  const n = pts.length, E = []; let A = 0;
  for (let i = 0; i < n; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n]; A += ax * bz - bx * az; }
  for (let i = 0; i < n; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % n], dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz); E.push({ ax, az, dx, dz, L, L2: L * L, nx: (A > 0 ? dz : -dz) / L, nz: (A > 0 ? -dx : dx) / L }); }
  return { pts, E, n };
}
function fsd(Pl, u, v) {
  let d2 = 1e18, ins = false;
  for (const e of Pl.E) {
    const t = clamp(((u - e.ax) * e.dx + (v - e.az) * e.dz) / e.L2, 0, 1), qx = e.ax + e.dx * t - u, qz = e.az + e.dz * t - v, q = qx * qx + qz * qz; if (q < d2) d2 = q;
    if ((e.az > v) !== (e.az + e.dz > v) && u < e.dx * (v - e.az) / e.dz + e.ax) ins = !ins;
  }
  const d = Math.sqrt(d2); return ins ? -d : d;
}
// the polygon moved inward by t (outward for t < 0), its corners mitred
function finset(Pl, t) { const out = []; for (let i = 0; i < Pl.n; i++) { const a = Pl.E[(i + Pl.n - 1) % Pl.n], b = Pl.E[i], k = 1 + a.nx * b.nx + a.nz * b.nz; out.push([Pl.pts[i][0] - t * (a.nx + b.nx) / k, Pl.pts[i][1] - t * (a.nz + b.nz) / k]); } return out; }

// the trace, worked out once
const FT = (() => {
  const { R, W } = FORT, BP = [], sides = [], P = [], Q = [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]], add = (a, b) => [a[0] + b[0], a[1] + b[1]], mul = (a, s) => [a[0] * s, a[1] * s], nrm = a => { const l = Math.hypot(a[0], a[1]); return [a[0] / l, a[1] / l]; };
  const meet = (p, d, q, e) => { const den = d[0] * e[1] - d[1] * e[0], s = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / den; return add(p, mul(d, s)); }; // where p + s·d crosses the line q + t·e
  for (let k = 0; k < 5; k++) { const a = Math.PI / 2 + k * 2 * Math.PI / 5; BP.push([Math.cos(a) * R, Math.sin(a) * R]); } // the bastions' points: the first to the south, out to sea
  for (let k = 0; k < 5; k++) {
    const A = BP[k], B = BP[(k + 1) % 5], L = Math.hypot(B[0] - A[0], B[1] - A[1]), M = mul(add(A, B), 0.5), n = nrm(M);
    const D = sub(M, mul(n, L / 7)), ua = nrm(sub(D, A)), ub = nrm(sub(D, B)), fl = 2 * L / 7;   // the lines of defence cross at D; the faces lie along them
    const Ea = add(A, mul(ua, fl)), Eb = add(B, mul(ub, fl));                                    // the shoulders
    const Ha = meet(Ea, mul(n, -1), B, ub), Hb = meet(Eb, mul(n, -1), A, ua);                    // the flanks run square to the curtain, back to the line of defence from the far bastion
    sides.push({ A, B, M, n, D, ua, ub, Ea, Eb, Ha, Hb, L });
    P.push(A, Ea, Ha, Hb, Eb); Q.push(A, D);
  }
  // the ravelin before the north curtain (side 2): its point 60 m out, its faces aimed 12 m short of the bastions' shoulders, ending at the moat's far side
  const s2 = sides[2], Sr = add(s2.M, mul(s2.n, 60));
  const rface = (A, E, u) => { const T = sub(E, mul(u, 12)), d = nrm(sub(T, Sr)); let no = [u[1], -u[0]]; if (no[0] * s2.n[0] + no[1] * s2.n[1] < 0) no = mul(no, -1); return meet(Sr, d, add(A, mul(no, W)), u); };
  const Ga = rface(s2.A, s2.Ea, s2.ua), Gb = rface(s2.B, s2.Eb, s2.ub), Gm = mul(add(Ga, Gb), 0.5);
  // the way in: over the ravelin's ditch and through its east face, across the ravelin, over the moat to the gate
  const fd = nrm(sub(Gb, Sr)), F1 = add(Sr, mul(sub(Gb, Sr), 0.72)); let nF = [fd[1], -fd[0]]; if ((F1[0] - Gm[0]) * nF[0] + (F1[1] - (Gm[1] + Sr[1]) / 2) * nF[1] < 0) nF = mul(nF, -1);
  const B1o = add(F1, mul(nF, FORT.WR + 1.6)), R0 = add(F1, mul(nF, FORT.WR + 20)), F2 = sub(F1, mul(nF, 15));
  const PR = FORT.PA / Math.cos(Math.PI / 5), PAR = BP.map(([x, z]) => [x / R * PR, z / R * PR]);
  // the re-entrant angles of the moat's far edge, where the covered way widens into a place of arms: before each curtain, and either side of the ravelin
  const outN = (d, ref) => { let no = [d[1], -d[0]]; if (no[0] * ref[0] + no[1] * ref[1] < 0) no = mul(no, -1); return no; };
  const PA = [], place = (R, d1, d2) => { const b = nrm(add(d1, d2)); PA.push(fpoly([add(R, mul(d1, 24)), add(R, mul(b, 30)), add(R, mul(d2, 24))])); };
  for (const k of [1, 3]) { const s = sides[k]; place(meet(add(s.A, mul(outN(s.ua, s.n), W)), s.ua, add(s.B, mul(outN(s.ub, s.n), W)), s.ub), mul(s.ua, -1), mul(s.ub, -1)); }
  { const C = mul(add(add(Sr, Ga), Gb), 1 / 3), dW = nrm(sub(Ga, Sr)), dE = nrm(sub(Gb, Sr)), mW = sub(mul(add(Sr, Ga), 0.5), C), mE = sub(mul(add(Sr, Gb), 0.5), C);
    place(meet(add(Sr, mul(outN(dW, mW), FORT.WR)), dW, add(s2.A, mul(outN(s2.ua, s2.n), W)), s2.ua), mul(s2.ua, -1), mul(dW, -1));
    place(meet(add(Sr, mul(outN(dE, mE), FORT.WR)), dE, add(s2.B, mul(outN(s2.ub, s2.n), W)), s2.ub), mul(s2.ub, -1), mul(dE, -1)); }
  // (for the moat's far edge, the ravelin reaches back to the curtain: the water runs all round its gorge)
  return { BP, sides, P: fpoly(P), Q: fpoly(Q), RV: fpoly([Sr, Gb, Ga]), RVX: fpoly([Sr, Gb, s2.Hb, s2.Ha, Ga]), PAR: fpoly(PAR), PA, HV: sides.flatMap(q => [q.Ha, q.Hb]), Sr, Ga, Gb, Gm, F1, F2, nF, fd, B1o, R0, cv: s2.Ha[1] };
})();

/* ---------------- the ground ---------------- */
// the shore near the point: the v of the water's edge for each u (the point standing out of a straight-ish coast; it ends abreast of the fort's
// middle, so the fort's sea front stands in the water)
// (the two sides differ: west of the fort deep water comes in close under the hill along a rocky shore; to the east lies a broad, low, sandy
// foreland with dunes, a lagoon and a beach round its end, and the bay's shore runs on north from it)
const FORT_SHORE_W = [[113, 100], [128, 95], [146, 66], [164, 22], [184, -36], [204, -96], [226, -158], [256, -222], [296, -258], [350, -272], [420, -266]];
const FORT_SHORE_E = [[113, 104], [150, 109], [200, 114], [255, 112], [305, 102], [350, 82], [390, 47], [424, 2], [452, -52], [480, -112], [510, -168], [548, -212], [600, -240], [660, -252]];
function fortShore(u) {
  const a = Math.abs(u), P = u < 0 ? FORT_SHORE_W : FORT_SHORE_E, end = P[P.length - 1][0], gen = -250 + 32 * fbm(u / 260, 1.7, 2, 1101) + 14 * fbm(u / 90, 3.1, 2, 1102);
  let k = 0; while (k < P.length - 2 && a > P[k + 1][0]) k++;
  const q = i => P[clamp(i, 0, P.length - 1)], [a0, v0] = q(k), [a1, v1] = q(k + 1), t = clamp((a - a0) / (a1 - a0), 0, 1), m0 = (v1 - q(k - 1)[1]) / 2, m1 = (q(k + 2)[1] - v0) / 2, t2 = t * t, t3 = t2 * t;
  const sh = (2 * t3 - 3 * t2 + 1) * v0 + (t3 - 2 * t2 + t) * m0 + (-2 * t3 + 3 * t2) * v1 + (t3 - t2) * m1 + (a > 120 ? 6 * fbm(u / 38, 4.2, 2, 1103) * smoothstep(120, 150, a) : 0); // (through the points, smoothly)
  const tip = lerp(56, sh, smoothstep(103, 113, a)); // (the works end in two arms, with open water between them and the sea bastion)
  return lerp(tip, gen, smoothstep(end - 90, end, a));
}
function fortCoast(x) { return FORT.z + fortShore(x - FORT.x); }
// the lagoon behind the foreland's beach: how far a point lies inside it (below 1)
const FORT_INLET = [[366, 38], [377, 36], [387, 34], [397, 31], [410, 27]]; // (its way out to the sea, through the dunes)
function fortLagoon(u, v) { const du = u - 318, dv = v - 50, c = Math.cos(0.42), s = Math.sin(0.42), a = (du * c - dv * s) / 58, b = (du * s + dv * c) / (10 + 4 * Math.cos(Math.min(1.6, Math.abs((du * c - dv * s) / 58)) * 1.9)); let l = Math.hypot(a, b) + 0.22 * fbm(u / 24, v / 24, 2, 1135) + 0.08 * fbm(u / 9, v / 9, 1, 1136); // (long and narrow along the shore, wider in its middle, an uneven edge)
  for (let q = 1; q < FORT_INLET.length; q++) l = Math.min(l, 0.55 + segDist(u, v, ...FORT_INLET[q - 1], ...FORT_INLET[q]).d / 9); return l; }
// the lie of the land without the fort: a low point, the land rising behind it, the green hill to the north-west whose sea face drops to the bay
// (the hill: its brow within 300 m of the fort, close enough to be seen through the haze; its west face a low cliff over the bay)
function fortHill(u, v) { const hx = u + 240, hz = v + 320; return FORT_HILL * Math.exp(-Math.pow((hx * hx) / (185 * 185) + (hz * hz) / (160 * 160), 1.3)); } // (a rounded brow, the sides falling away below it)
// how far a point lies inland of the fixed shore (negative: out in the water)
function fortDT(u, v) {
  const sd = u > 0 ? 0 : 17.3, au = Math.abs(u), us = au < 130 || au > 420 || v > 60 ? u : u + (11 * fbm(v / 62 + sd, 4.4, 2, 1106) + 3 * fbm(v / 21 + sd, 6.1, 1, 1107)) * smoothstep(130, 175, au) * (1 - smoothstep(330, 420, au)) * (1 - smoothstep(15, 60, v)); // (the point's shores run in and out)
  const f = fortShore(us), fp = (fortShore(us + 3) - fortShore(us - 3)) / 6; return (f - v) / Math.hypot(1, fp);
}
// the foreland's dunes: ridges parallel to the beach, broken by blowouts (their height over the ground behind)
function fortDunes(u, v, dt) {
  if (u < 140 || dt < 0 || dt > 90) return 0; const x = FORT.x + u, z = FORT.z + v, b = (c, w) => Math.exp(-(((dt - c) / w) ** 2)), m = 0.8 + 0.6 * fbm(x / 55, z / 55, 2, 1131);
  const fore = 3.8 * (dt < 13 ? b(13, 4) : b(13, 7.5)) * (0.85 + 0.35 * fbm(x / 30, z / 30, 2, 1139)), ridges = 5.4 * b(30, 8) * (0.75 + 0.6 * fbm(x / 40 + 3, z / 40, 2, 1132)) + 3.2 * b(51, 11) * (0.7 + 0.7 * fbm(x / 33 + 7, z / 33, 2, 1133)); // (a foredune all along the beach, older ridges behind it)
  const blow = 1 - 0.7 * smoothstep(0.12, 0.3, fbm(x / 28, z / 28, 2, 1134)); // (the blowouts: notches through the ridges)
  return Math.max(0, fore * (0.55 + 0.45 * blow) + ridges * m * blow + 0.7 * fbm(x / 9, z / 9, 1, 1136) * b(25, 20)) * smoothstep(140, 185, u);
}
// the colour of the ground round the fort, as a multiplier (S.tint): the glacis even green, kept grazed; the dunes blue-grey with marram and the
// slacks between them damp and dark; the heath behind them brown; bracken rusty in patches on the hill; the rough west shore darker
function fortTint(x, z, h) { const u = x - FORT.x, v = z - FORT.z, r = Math.hypot(u, v); if (r > 760) return null; let m = [1, 1, 1]; const mix = (t, w) => { if (w > 0) m = m.map((q, k) => lerp(q, t[k], w)); };
  if (r < 300) { const e = fortE(u, v); mix([0.95, 1.03, 0.92], 0.4 * smoothstep(70, 24, e) * smoothstep(-2, 4, e)); }
  if (u > 140) { const dt = fortDT(u, v); if (dt > 0 && dt < 140) { const d = fortDunes(u, v, dt); mix([0.84, 0.92, 1.28], 0.85 * smoothstep(0.6, 2.2, d) * smoothstep(84, 50, dt)); mix([0.8, 1.02, 0.78], 0.55 * smoothstep(1.6, 0.4, d) * smoothstep(14, 22, dt) * smoothstep(70, 56, dt));
    mix([1.2, 0.82, 0.74], 0.85 * smoothstep(48, 80, dt) * smoothstep(-0.35, 0.2, fbm(x / 50, z / 50, 2, 1124)) * smoothstep(270, 330, r)); } }
  { const hh = fortHill(u, v) / FORT_HILL; if (hh > 0.08) mix([1.24, 0.86, 0.6], 0.65 * smoothstep(0.1, 0.3, hh) * smoothstep(0.0, 0.3, fbm(x / 58, z / 58, 2, 1125)) * smoothstep(240, 300, r)); }
  if (u < -120 && v < 60) mix([0.9, 0.93, 0.9], 0.5 * smoothstep(40, 10, fortDT(u, v)));
  return m; }
// bare rock along the west shore where the ground comes down to the water (S.rock)
function fortRock(x, z, h) { const u = x - FORT.x, v = z - FORT.z; if (u > -110 || u < -460 || v > 64 || v < -330) return 0; const dt = fortDT(u, v); return smoothstep(7, 4.2, h) * smoothstep(-1.9, -1.0, h) * smoothstep(22, 6, dt) * smoothstep(-0.4, 0.0, fbm(x / 13, z / 13, 2, 1143)); } // (the scarp and the ledges at its foot, in a band along the water)
// wet mud round the lagoon (S.mud)
function fortMud(x, z) { const u = x - FORT.x, v = z - FORT.z; if (u < 230 || u > 440 || v < -20 || v > 120) return 0; const l = fortLagoon(u, v); return smoothstep(0.9, 1.0, l) * (1 - smoothstep(1.12, 1.32 + 0.12 * fbm(x / 11, z / 11, 1, 1144), l)); }
// bare sand, how much (0..1): the dunes' seaward faces and crests, and the blowouts (the rest of them is grey dune, turfed)
function fortSand(x, z) { const u = x - FORT.x, v = z - FORT.z; if (u < 140 || u > 720 || v < -330 || v > 140) return 0; const dt = fortDT(u, v); if (dt < 0.5 || dt > 62) return 0;
  const d = fortDunes(u, v, dt); return Math.max(smoothstep(20, 9, dt) * smoothstep(0.4, 1.4, d), smoothstep(12, 6, dt), smoothstep(0, 1.1, d - 1.3 - 1.2 * smoothstep(20, 44, dt)), smoothstep(16, 6, Math.hypot(u - FORT_INLET[0][0], v - FORT_INLET[0][1]))) * smoothstep(-0.34, -0.12, fbm(x / 21, z / 21, 2, 1137)) * smoothstep(1.3, 1.5, fortLagoon(u, v)) * smoothstep(0.5, 2, dt); }
function fortNat(u, v) {
  const x = FORT.x + u, z = FORT.z + v, dt = fortDT(u, v);
  if (dt < 0) return -1.1 - Math.min(7, -dt * 0.06);
  let land = 3.0 + 0.6 * fbm(x / 45, z / 45, 2, 1111) + 1.1 * fbm(x / 170, z / 170, 2, 1112) * smoothstep(240, 420, Math.hypot(u, v))
    + 15 * smoothstep(-240, -760, v) * (0.75 + 0.25 * fbm(x / 300, z / 300, 2, 1113)) + fortHill(u, v) * (0.93 + 0.07 * fbm(x / 70, z / 70, 2, 1114)); const ru = u - FORT_REDOUBT[0], rv = v - FORT_REDOUBT[1], rr = Math.hypot(ru, rv);
  if (rr < 46) land = lerp(FORT_REDOUBT[2], land, smoothstep(21, 45, rr)); // (the hill's brow levelled for its redoubt)
  if (u > 130) { land += fortDunes(u, v, dt) + 0.9 * fbm(x / 80, z / 80, 2, 1133) * smoothstep(150, 260, u) * smoothstep(60, 110, dt); // dunes along the foreland's shore, the ground behind them uneven
    const lg = fortLagoon(u, v); if (lg < 1.4) land = lerp(-1.7, land, smoothstep(0.62, 1.25, lg)); }
  const W = clamp((land + 0.8) * 0.6, u < -120 ? 5 : 18, 60) * (land > 10 ? 0.75 + 0.6 * smoothstep(-0.3, 0.3, fbm(x / 32, z / 32, 2, 1138)) : 1); // (west of the fort a low rocky shore, east a long beach; the hill's sea cliff ragged along its top)
  return -0.65 + (land + 0.65) * smoothstep(0, W, dt);
}
// the fort laid over it: the ramparts and the parade inside the trace, the moats (with a deep trench at the foot of every wall, unseen under
// the water, so the ground's 4 m grid cannot show a bank in front of the brick), the covered way and the glacis
function fortCut(u, v) { // the passages through the ramparts: the floor where one runs, else NaN
  if (Math.abs(u) < 8.5 && v > FT.cv - 1.2 && v < -FORT.PA + 2.5) return Math.abs(u) <= 4.2 ? lerp(FORT.GF, FORT.YP, smoothstep(FT.cv, -FORT.PA, v)) : NaN;
  const du = u - FT.F1[0], dv = v - FT.F1[1], l = -(du * FT.nF[0] + dv * FT.nF[1]), w = du * FT.fd[0] + dv * FT.fd[1];
  if (l > -1.2 && l < 16 && Math.abs(w) <= 4.6) return FORT.YI;
  return NaN;
}
function fortField(u, v, nat) {
  if (u * u + v * v > 300 * 300) return nat;
  const F = FORT, sP = fsd(FT.P, u, v);
  if (sP < 0) {
    const c = Math.abs(u) < 8.5 ? fortCut(u, v) : NaN; if (c === c) return c;
    const dPar = fsd(FT.PAR, u, v); let h = lerp(F.YP, F.YR, clamp(dPar / F.TAL, 0, 1));
    for (const k of FORT_RAMPS) { const [cu, cv] = FT.BP[k], al = (u * cu + v * cv) / F.R, pe = Math.abs(u * cv - v * cu) / F.R; if (al > 49 && al < 72 && pe < 7) h = Math.max(h, lerp(lerp(F.YP, F.YR, clamp((al - 50) / 18.4, 0, 1)), h, smoothstep(2.8, 7, pe))); } // (the gun ramps)
    if (sP > -10) for (const [hu, hv] of FT.HV) h = lerp(F.TR, h, smoothstep(6, 8, Math.hypot(u - hu, v - hv))); // (the inner angles of the walls: a cell of the ground could span one, in front of the brick)
    return sP > -2 ? lerp(F.TR, h, -sP / 2) : h;
  }
  const sR = fsd(FT.RV, u, v);
  if (sR < 0) {
    const c = fortCut(u, v); if (c === c) return c;
    const E = FT.RV.E, dF = Math.min(segDist(u, v, E[0].ax, E[0].az, E[0].ax + E[0].dx, E[0].az + E[0].dz).d, segDist(u, v, E[2].ax, E[2].az, E[2].ax + E[2].dx, E[2].az + E[2].dz).d);
    const h = lerp(F.YRV, F.YI, smoothstep(8, 14, dF));
    return sR > -2 ? lerp(F.TR, h, -sR / 2) : h;
  }
  const dc = Math.min(fsd(FT.Q, u, v) - F.W, fsd(FT.RVX, u, v) - F.WR);
  let h;
  if (dc < 0) h = F.TR;                                 // the moat: deep under its water, unseen (so no bank shows against the brick on either side)
  else if (v > 40 && Math.abs(u) < FORT_ARM) h = Math.abs(u) > FORT_ARM - 12 ? F.TR : Math.min(nat, -4); // (open water before the sea front)
  else if (dc < 2) h = lerp(F.TR, F.CW, dc / 2);        // (within the counterscarp's wall)
  else { const au = Math.abs(u), e = Math.min(dc - 8, fortPAd(u, v)), cr = fortCrest(v); // the covered way, its crest, the glacis (low towards the sea)
    h = e < 4.5 ? F.CW : e < 9 ? F.CW + cr * smoothstep(4.5, 9, e) : (u < -90 ? (nat < -0.4 ? nat : lerp(F.CW + cr, Math.max(nat, 1.5 + 0.6 * fbm(u / 14, v / 14, 2, 1141)), smoothstep(9, 34, e))) : lerp(F.CW + cr, nat, smoothstep(9, lerp(30, 64, smoothstep(-4, 2, nat)), e))); // (on the west the glacis comes down to a shelf over the rock, which drops to the water where the shore is; on the east it runs out long and low into the dunes) // (level a little beyond the gravel: the ground's grid would carry the rise back over it)
    if (u < 0 && v > 40) { const ve = 50 + 7 * fbm(u / 13, 3.3, 2, 1142); h = lerp(h, Math.min(nat, -2.5), smoothstep(ve - 4, ve + 6, v)); } // (on the west the covered way ends, unevenly, at the deep water)
    if (v > 56 && u > 0) { // the arm: level ground for a low battery, ending in a pier head of masonry towards the open water
      h = lerp(h, v < 90 ? F.CW : lerp(F.CW, nat, smoothstep(90, 100, v)), (1 - smoothstep(146, 162, au)) * smoothstep(56, 64, v));
      if (v > 90) h = lerp(F.TR, h, clamp((au - 120 - 0.13 * (v - 90) ** 2) / 6, 0, 1)); // (the point's corner rounded off, its foot in rubble)
      h = lerp(F.TR, h, clamp((au - FORT_ARM) / 2, 0, 1)); } }
  // the way out through the covered way and the glacis: level with the bridge, then rising gently
  const q1 = segDist(u, v, FT.B1o[0], FT.B1o[1], FT.R0[0], FT.R0[1]);
  if (q1.d < 8 && dc > 1) h = lerp(F.CW + 0.5 * smoothstep(0.5, 1, q1.t), h, smoothstep(3.5, 8, q1.d));
  const q2 = segDist(u, v, FT.R0[0], FT.R0[1], FT.R0[0] + 7, FT.R0[1] - 24); // (and on through the crest in a shallow cutting)
  if (q2.d < 9) h = lerp(lerp(F.CW + 0.5, h, smoothstep(0, 1, q2.t)), h, smoothstep(3.5, 9, q2.d));
  return h;
}
// how high the glacis' crest stands over the covered way
function fortCrest(v) { return (2.6 - 1.3 * smoothstep(-40, 20, v)) * (1 - smoothstep(46, 58, v)); }
const FORT_ARM = 108; // (the works beyond the ditch end this far either side of the sea front's middle)
// how far a point lies beyond the moats' far edge, the counterscarp (the covered way runs 8 m on from it)
function fortDC(u, v) { return Math.min(fsd(FT.Q, u, v) - FORT.W, fsd(FT.RVX, u, v) - FORT.WR); }
// the places of arms (negative inside one), and how far a point lies beyond the covered way's outer edge, where its crest begins
function fortPAd(u, v) { let d = 1e9; for (const T of FT.PA) d = Math.min(d, fsd(T, u, v)); return d; }
function fortE(u, v) { return Math.min(fortDC(u, v) - 8, fortPAd(u, v)); }
// the line round the fort where fn is d: the outermost crossing along each of 2400 rays from the middle
function fortLevel(d, fn = fortDC) { const out = [];
  for (let k = 0; k <= 2400; k++) { const a = k / 2400 * 2 * Math.PI, ca = Math.cos(a), sa = Math.sin(a); let r = 270; while (r > 60 && fn(ca * r, sa * r) > d) r -= 3; // (every line it is asked for lies well within 270 m)
    let lo = r, hi = r + 3; for (let q = 0; q < 12; q++) { const m = (lo + hi) / 2; if (fn(ca * m, sa * m) > d) hi = m; else lo = m; } out.push([ca * lo, sa * lo]); }
  return out; }
function fortH(x, z) { const u = x - FORT.x, v = z - FORT.z; return fortField(u, v, fortNat(u, v)); }

// where nothing grows of itself: no tree or bush on the fort, its glacis (kept open so the guns can see) or by its road; no small plants on the
// parade, the covered way or the paved walks
function fortKeep(x, z, r) {
  const u = x - FORT.x, v = z - FORT.z, d2 = u * u + v * v; if (d2 > 1100 * 1100) return false;
  for (const [cu, cv, a, hx, hz] of FORT_FIELDS) { const dx = u - cu, dz = v - cv, lx = dx * Math.cos(a) - dz * Math.sin(a), lz = dx * Math.sin(a) + dz * Math.cos(a); if (Math.abs(lx) < hx + 1 && Math.abs(lz) < hz + 1) return true; } // (the fields by the hamlet)
  if (Math.hypot(u - FORT_REDOUBT[0], v - FORT_REDOUBT[1]) < 27) return true;
  if (r >= 2 && (d2 < 300 * 300 || (u < 20 && d2 < 470 * 470))) return true; // (the esplanade: open ground for the guns, the hill's near side with it)
  if (r >= 2) for (let q = 1; q < FORT_ROAD.length; q++) { const [ax, az] = FORT_ROAD[q - 1], [bx, bz] = FORT_ROAD[q]; if (segDist(u, v, ax, az, bx, bz).d < 9) return true; }
  if (d2 > 260 * 260) return false;
  if (fsd(FT.PAR, u, v) < 2) return true;
  const sP = fsd(FT.P, u, v); if (sP < 0) return sP > -11;
  const sR = fsd(FT.RV, u, v); if (sR < 0) return true;
  return fortE(u, v) < 52;
}
// woods only far back from the point, on the land rising behind the hill; heather and gorse on the hill's top
function fortForest(x, z) { const u = x - FORT.x, v = z - FORT.z, r = Math.hypot(u, v); if (r < 560) return 0; return smoothstep(-0.05, 0.3, fbm(x / 150, z / 150, 2, 1121) + 0.25 * fbm(x / 60, z / 60, 2, 1122)) * smoothstep(560, 760, r) * smoothstep(-300, -520, v) * (1 - smoothstep(0.4, 0.7, fortHill(u, v) / FORT_HILL)); }
function fortHeath(x, z) { const u = x - FORT.x, v = z - FORT.z, hh = fortHill(u, v) / FORT_HILL, r = Math.hypot(u, v);
  return Math.max(0.65 * smoothstep(0.45, 0.8, hh) * smoothstep(-0.2, 0.25, fbm(x / 60, z / 60, 2, 1123)) * smoothstep(70, 120, Math.hypot(u - FORT_REDOUBT[0], v - FORT_REDOUBT[1])),
    0.36 * smoothstep(0.12, 0.35, hh) * smoothstep(250, 320, r) * smoothstep(0.0, 0.35, fbm(x / 38, z / 38, 2, 1125)), // (rough grass down the hill's flanks, outside the esplanade: the bracken in it is a colour, fortTint)
    0.7 * smoothstep(150, 230, u) * smoothstep(300, 360, r) * smoothstep(-0.25, 0.2, fbm(x / 55, z / 55, 2, 1124)) * smoothstep(1.3, 1.9, fortLagoon(u, v)) * smoothstep(-200, -120, v)); } // (on the hill's top; and rough heath on the far part of the foreland, outside the esplanade)
// the fort's earthworks are turf, however steep
function fortTurf(x, z) { const u = x - FORT.x, v = z - FORT.z, d2 = u * u + v * v; return u > -125 ? d2 < 700 * 700 : d2 < 265 * 265 && (v > 44 || fortE(u, v) < 12); } // (and the sandy foreland east of it; but the shore west of the glacis is rock, cut by the waves)
// the moat's water is still: no surf along its banks
function fortCalm(x, z) { const u = x - FORT.x, v = z - FORT.z; return (u * u + v * v < 265 * 265 && (fortDC(u, v) < 4 || (v > 40 && Math.abs(u) < 160))) || fortLagoon(u, v) < 1.5; }

// the fields of the hamlet where the road leaves the fort's open ground, hedged: [u, v, angle, half-width, half-depth, crop]
const FORT_FIELDS = [[172, -505, 0.12, 52, 34, 'fWheat'], [168, -585, 0.12, 52, 38, 'fMeadow'], [272, -512, 0.1, 44, 34, 'fBarley'], [262, -598, 0.1, 44, 42, 'fPlowed'],
  [152, -338, 0.1, 46, 30, 'fMeadow'], [146, -418, 0.1, 46, 32, 'fBarley'], [-40, -650, -0.1, 42, 34, 'fMeadow'], [-28, -735, -0.1, 42, 40, 'fWheat']];
// its road: from the glacis north along the spine of the point, east of the hill, inland (local, then the world's)
const FORT_ROAD = [FT.R0, [FT.R0[0] + 7, FT.R0[1] - 24], [74, -214], [84, -262], [86, -318], [76, -380], [62, -446], [54, -516], [58, -592], [74, -668], [94, -746], [108, -826], [116, -910]];
{ const W = ([u, v]) => [FORT.x + u, FORT.z + v];
  SITES.push({ id: 'fort', name: 'Fort Merrow', kind: 'fort', x: FORT.x, z: FORT.z, rc: 640, rb: 1100, discR: 330, late: true, quiet: true, exact: true, wayKind: WAY.road, own: [3600, 800],
    blurb: 'a star fort of five bastions at the end of a low point on the western shore, its brick walls rising from a moat the sea fills',
    road: FORT_ROAD.map(W),
    lane: [FT.R0, FT.B1o, FT.F1, FT.F2, [0, FT.Gm[1] - 6], [0, FT.Gm[1] + 1.5], [0, FT.cv - 0.5], [0, -FORT.PA + 2], [0, -12]].map(W),
    keep: fortKeep, forest: fortForest, heath: fortHeath, noRock: fortTurf, calm: fortCalm, sand: fortSand, tint: fortTint, rock: fortRock, mud: fortMud });
  SITE_H.fort = fortH; }

/* ---------------- the masonry, the bridges, the buildings ---------------- */
SITE_BUILD.fort = function (gb, S, H, area) {
  const F = FORT, X = FORT.x, Z = FORT.z;
  const W3 = (u, y, v) => [X + u, y, Z + v];
  // what is too small to be seen from far off goes into a mesh of its own, drawn only close by (S.own)
  const detail = fn => { const g0 = gb; gb = S.near || gb; if (gb !== g0) { gb.light = g0.light; gb.xf = g0.xf; gb.tint = g0.tint; } const r = fn(); if (gb !== g0) { gb.xf = null; gb.tint = null; } gb = g0; return r; };
  const colO = (cu, cv, ang, hx, hz, y0, y1) => siteCol(area, X + cu, Z + cv, ang, hx, hz, y0, y1), poles = S.poles = []; // (poles: masts and staffs, drawn at least a pixel wide from afar)
  const savedLight = gb.light; // brick in shade still reads as brick
  gb.light = (p, n) => { const d = Math.max(0, v3dot(n, TERRAIN_LIGHT)), k = 0.66 + 0.6 * d + 0.06 * Math.max(0, n[1]); return [k * lerp(0.9, 1.14, d), k * lerp(0.9, 1.0, d), k * lerp(0.98, 0.82, d)]; };
  const BRICK = [0.8, 0.61, 0.53], WET = [0.34, 0.42, 0.3], TURF = [0.6, 0.68, 0.4], TURF2 = [0.72, 0.8, 0.47], TURFD = [0.4, 0.46, 0.27], DARK = [0.5, 0.5, 0.55];

  // walls along a polygon's edges: a battered brick face from below the water to a stone cordon, darkened by the water at its foot; on top an
  // earthen parapet, turfed, sloping gently outward and lined with brick, with a firing step behind it and embrasures cut through it, splayed;
  // a gravel walk behind, over the seam where the ground drops to the moat. Returns the insets and where the guns stand.
  // o: { y0, yr (the rampart's top), yb (top of the batter), bat (how far the face leans back), sc (the parapet's size across), walk (the walk's
  //      inner edge), quoins (vertex indices), holes {edge: [[s0, s1]]}, emb {edge: [s...]}, caps {edge: [0|1]}, cop (a plain coping, no parapet) }
  const walls = (Pl, edges, o) => {
    const ins = {}, I = t => ins[t] || (ins[t] = finset(Pl, t)), n = Pl.n, key = o.key || 'brick', tw = 2.4, YR = o.yr ?? F.YR, sc = o.sc ?? 1, guns = [];
    let run = 0; const GBR = [0.82, 0.66, 0.58];
    for (const i of edges) {
      const e = Pl.E[i], j = (i + 1) % n, L = e.L, hint = [e.nx, 0.12, e.nz], up = [0, 1, 0], inw = [-e.nx, 0, -e.nz], al = [e.dx / L, 0, e.dz / L];
      const at = (t, s, y) => { const a = I(t)[i], b = I(t)[j]; return W3(lerp(a[0], b[0], s), y, lerp(a[1], b[1], s)); };
      // a band between two lines along the edge (inset tA at height yA, from sa0 to sa1; inset tB at yB, from sb0 to sb1), textured along the wall or from above
      const band = (k, tA, yA, tB, yB, sa0, sa1, sb0, sb1, h, flat, tw = 2.4) => { const a = at(tA, sa0, yA), b = at(tA, sa1, yA), c = at(tB, sb1, yB), d = at(tB, sb0, yB), U = p => flat ? [p[0] / 3, p[2] / 3] : null;
        gb.quad4(k, a, b, c, d, U(a) || [(run + sa0 * L) / tw, yA / tw], U(b) || [(run + sa1 * L) / tw, yA / tw], U(c) || [(run + sb1 * L) / tw, yB / tw], U(d) || [(run + sb0 * L) / tw, yB / tw], h); };
      const quad = (k, tA, yA, tB, yB, s0, s1, h, flat, w) => band(k, tA, yA, tB, yB, s0, s1, s0, s1, h, flat, w);
      const colT = (t0, t1, s0, s1, y0, y1) => { const m = (t0 + t1) / 2, a = I(m)[i], b = I(m)[j], pa = [lerp(a[0], b[0], s0), lerp(a[1], b[1], s0)], pb = [lerp(a[0], b[0], s1), lerp(a[1], b[1], s1)];
        colO((pa[0] + pb[0]) / 2, (pa[1] + pb[1]) / 2, Math.atan2(pb[0] - pa[0], pb[1] - pa[1]), (t1 - t0) / 2 + 0.05, Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) / 2 + 0.05, y0, y1); };
      // the face, broken where something stands in front of it, its salient corners in stone, darkened by the water at its foot
      const cuts = [0, 1]; for (const [a, b] of (o.holes && o.holes[i]) || []) cuts.push(a, b); cuts.sort((a, b) => a - b);
      const qa = o.quoins && o.quoins.has(i) ? 1.6 / L : 0, qb = o.quoins && o.quoins.has(j) ? 1.6 / L : 0, yw = 0.35, tB = y => o.bat * (y - o.y0) / (o.yb - o.y0), tw0 = tB(yw);
      for (let k = 0; k < cuts.length; k += 2) { const s0 = cuts[k], s1 = cuts[k + 1]; if (s1 - s0 < 1e-4) continue;
        const seg = [[s0, Math.min(s1, qa), 'ashlar'], [Math.max(s0, qa), Math.min(s1, 1 - qb), key], [Math.max(s0, 1 - qb), s1, 'ashlar']];
        for (const [a, b, kk] of seg) if (b - a > 1e-4) { gb.tint = WET; quad(kk, 0, o.y0, tw0, yw, a, b, hint); gb.tint = null;
          if (kk !== key) { quad(kk, tw0, yw, o.bat, o.yb, a, b, hint); continue; }
          const nc = Math.max(1, Math.round((b - a) * L / 6.5)); for (let q = 0; q < nc; q++) { const v = 0.955 + 0.09 * _h2(i * 31 + q, k, 8300); gb.tint = BRICK.map(c => c * v); quad(kk, tw0, yw, o.bat, o.yb, lerp(a, b, q / nc), lerp(a, b, (q + 1) / nc), hint); } // (the brick a little lighter or darker from length to length)
          gb.tint = null; } }
      for (const c of (o.ports && o.ports[i]) || []) { const fr = (w, y0, y1, d, k) => quad(k, tB(y0) - d, y0, tB(y1) - d, y1, c - w / L, c + w / L, hint); gb.tint = [0.95, 0.92, 0.86]; fr(1.15, 1.7, 3.7, 0.05, 'ashlar'); gb.tint = [0.5, 0.5, 0.5]; fr(0.7, 2.05, 3.3, 0.09, 'iron'); gb.tint = null; } // (the casemates' gunports)
      if (o.cop) { // a plain coping: the wall's top, flat, as far back as the walk
        quad('ashlar', o.bat - 0.2, o.yb, o.bat - 0.2, o.yb + 0.3, 0, 1, hint); quad('ashlar', o.bat - 0.2, o.yb + 0.3, o.walk, o.yb + 0.3, 0, 1, up, true);
        colT(o.bat - 0.2, o.walk, 0, 1, o.yb - 0.7, o.yb + 0.3); run += L; continue; }
      // the cordon: a band of stone standing a little proud at the top of the face
      const yc = o.yb, t0 = o.bat - 0.3;
      quad('ashlar', o.bat - 0.02, yc - 0.32, t0, yc - 0.32, 0, 1, [0, -1, 0]); quad('ashlar', t0, yc - 0.32, t0, yc + 0.4, 0, 1, hint); quad('ashlar', t0, yc + 0.4, o.bat, yc + 0.4, 0, 1, up);
      // the parapet across the wall: its foot on the cordon, the outer crest, the inner crest, the top and the foot of its brick lining, the firing
      // step, the step's foot, the walk
      const T = [o.bat, o.bat + 1.3 * sc, o.bat + 4.7 * sc, o.bat + 5.3 * sc, o.bat + 5.4 * sc, o.bat + 6.8 * sc, o.bat + 6.84 * sc], Y = [yc + 0.4, YR + 1.1, YR + 1.5, YR + 1.2, YR + 0.45, YR + 0.45, YR + 0.06];
      const yS = t => lerp(Y[0], YR + 0.78, (t - T[0]) / (T[4] - T[0])), hw = t => 0.74 + (T[4] - t) * 0.16, GW = 1.8; // an embrasure's sole, rising inward from the cordon, and its half-width at each inset (wider outside); the gun's place behind
      const E = ((o.emb && o.emb[i]) || []).filter(c => c - hw(T[0]) / L > 0.03 && c + hw(T[0]) / L < 0.97).sort((a, b) => a - b);
      const pieces = (t, w) => { const out = []; let s = 0; for (const c of E) { const h = (w ? GW : hw(t)) / L; out.push([s, c - h]); s = c + h; } out.push([s, 1]); return out; };
      for (const [k, a, b, h, w, tint] of [['tGrass', 0, 1, hint, 0, TURF], ['tGrass', 1, 2, up, 0, TURF2], ['tGrass', 2, 3, [inw[0], 0.8, inw[2]], 0, TURF], [key, 3, 4, inw, 0, GBR], ['gravelN', 4, 5, up, 1, null], ['plaster', 5, 6, inw, 1, [0.56, 0.55, 0.52]]]) {
        const pa = pieces(T[a], w), pb = pieces(T[b], w); gb.tint = tint;
        for (let q = 0; q < pa.length; q++) band(k, T[a], Y[a], T[b], Y[b], pa[q][0], pa[q][1], pb[q][0], pb[q][1], h, k === 'tGrass' || k === 'gravelN', k === key ? 1.3 : 2.4); }
      gb.tint = [0.62, 0.61, 0.58]; for (const [s0, s1] of pieces(T[5], 1)) quad('plaster', T[5] - 0.3, YR + 0.47, T[5], YR + 0.47, s0, s1, up, true); // (the step's edge)
      gb.tint = null;
      for (const [s0, s1] of pieces((T[0] + T[4]) / 2, 0)) colT(T[0], T[4], s0, s1, YR - 1, YR + 1.5);
      for (const [s0, s1] of pieces(T[5], 1)) colT(T[4], T[5], s0, s1, YR - 1, YR + 0.45);
      // each embrasure, cut down to the cordon: a dark sole, cheeks of dressed stone splayed outward; behind it the firing step cut away for the gun's platform
      for (const c of E) {
        const s0 = t => c - hw(t) / L, s1 = t => c + hw(t) / L, g0 = c - GW / L, g1 = c + GW / L; let lo = T[0], hi = T[1]; for (let q = 0; q < 20; q++) { const m = (lo + hi) / 2; if (lerp(Y[0], Y[1], (m - T[0]) / (T[1] - T[0])) < yS(m)) lo = m; else hi = m; } const tA = lo;
        gb.tint = [0.26, 0.24, 0.22]; band('stone', T[0], yS(T[0]), T[4], yS(T[4]), s0(T[0]), s1(T[0]), s0(T[4]), s1(T[4]), up, true);
        for (const [sf, sg] of [[s0, 1], [s1, -1]]) { const A = at(tA, sf(tA), yS(tA)), K = k => at(T[k], sf(T[k]), Y[k]), D = at(T[4], sf(T[4]), yS(T[4])), h = [al[0] * sg, 0, al[2] * sg], uv = (t, y) => [t / 2.4, y / 2.4];
          gb.tint = [0.36, 0.38, 0.24]; gb.tri('tGrass', A, K(1), K(2), uv(tA, yS(tA)), uv(T[1], Y[1]), uv(T[2], Y[2]), h); gb.tint = [0.24, 0.19, 0.17]; gb.tri(key, A, K(2), K(3), uv(tA, yS(tA)), uv(T[2], Y[2]), uv(T[3], Y[3]), h); gb.tri(key, A, K(3), D, uv(tA, yS(tA)), uv(T[3], Y[3]), uv(T[4], yS(T[4])), h); }
        gb.tint = [0.13, 0.12, 0.12]; quad('iron', T[3] - 0.1, yS(T[3]), T[3] - 0.1, YR + 1.3, s0(T[3]), s1(T[3]), hint); // (the shade in its throat: faces outward only, so from inside one looks out through it)
        gb.tint = GBR; quad(key, T[4], YR + 0.06, T[4], yS(T[4]), s0(T[4]), s1(T[4]), inw, false, 1.3); quad(key, T[4], YR + 0.06, T[4], Y[4], g0, s0(T[4]), inw, false, 1.3); quad(key, T[4], YR + 0.06, T[4], Y[4], s1(T[4]), g1, inw, false, 1.3);
        gb.tint = null; quad('wood', T[4], YR + 0.12, o.walk, YR + 0.12, g0, g1, up, true);
        gb.tint = [0.56, 0.55, 0.52]; for (const [s, sg] of [[g0, 1], [g1, -1]]) gb.quad4('plaster', at(T[4], s, YR + 0.06), at(T[5], s, YR + 0.06), at(T[5], s, Y[5]), at(T[4], s, Y[4]), [0, 0], [1, 0], [1, 0.3], [0, 0.3], [al[0] * sg, 0, al[2] * sg]);
        gb.tint = null; colT(T[0], T[4], s0((T[0] + T[4]) / 2), s1((T[0] + T[4]) / 2), YR - 1, YR + 1.2); // (no one climbs out past the gun)
        const gp = at(T[4] + 0.75, c, 0); guns.push([gp[0] - X, gp[2] - Z, Math.atan2(e.nx, e.nz), YR + 0.06]);
      }
      // an end with nothing beyond it: the parapet's profile closed off
      for (const c of (o.caps && o.caps[i]) || []) { const P = k => at(T[k], c, Y[k]), h = [al[0] * (c ? 1 : -1), 0, al[2] * (c ? 1 : -1)];
        for (let k = 1; k < 6; k++) gb.tri(k < 3 ? 'tGrass' : 'stone', P(0), P(k), P(k + 1), [0, 0], [1, 0], [1, 1], h); gb.tri('stone', P(0), P(6), at(T[6], c, Y[0]), [0, 0], [1, 0], [1, 1], h); }
      // the walk behind
      quad('gravelN', T[6], YR + 0.08, o.walk, YR + 0.08, 0, 1, up, true); quad('stone', o.walk, YR + 0.08, o.walk, YR - 0.5, 0, 1, inw);
      { const la = Math.hypot(I(T[5])[j][0] - I(T[5])[i][0], I(T[5])[j][1] - I(T[5])[i][1]), lb = Math.hypot(I(o.walk)[j][0] - I(o.walk)[i][0], I(o.walk)[j][1] - I(o.walk)[i][1]), m = (T[5] + o.walk) / 2, a = I(m)[i], b = I(m)[j];
        colO((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, Math.atan2(b[0] - a[0], b[1] - a[1]), (o.walk - T[5]) / 2 + 0.1, Math.max(la, lb) / 2 + 0.5, YR - 1, YR + 0.08); }
      run += L;
    }
    return { I, guns };
  };

  // guns: a barrel on a timber carriage behind each embrasure, shot piled beside some
  const gun = (cu, cvv, ang, y) => detail(() => {
    const f = gb.setXf(X + cu, Z + cvv, ang, y);
    gb.tint = [0.72, 0.6, 0.5]; for (const x of [-0.5, 0.32]) { gb.box(x, 0.3, -1.3, x + 0.18, 0.7, -0.5, 'wood', 1, 1); gb.box(x, 0.3, -0.5, x + 0.18, 1.1, 0.75, 'wood', 1, 1); } gb.box(-0.5, 0.3, -1.3, 0.5, 0.46, 0.75, 'wood', 1, 1); gb.tint = [0.5, 0.44, 0.38];
    for (const z of [-0.95, 0.42]) for (const sx of [-0.68, 0.52]) { const r = 0.32, yc = 0.32; for (let k = 0; k < 8; k++) { const a0 = k * Math.PI / 4, a1 = a0 + Math.PI / 4, q = (x, a) => [x, yc + Math.sin(a) * r, z + Math.cos(a) * r], m = a0 + Math.PI / 8; gb.quad4('wood', q(sx, a0), q(sx + 0.16, a0), q(sx + 0.16, a1), q(sx, a1), [0, 0], [0.2, 0], [0.2, 0.3], [0, 0.3], [0, Math.sin(m), Math.cos(m)]); const ox = sx < 0 ? sx : sx + 0.16; gb.tri('wood', [ox, yc, z], q(ox, a0), q(ox, a1), [0.5, 0.5], [0, 0], [1, 0], [Math.sign(sx), 0, 0]); } } // the trucks
    const seg = 8, r0 = 0.33, r1 = 0.23, z0 = -1.15, z1 = 3.0, yc = 1.1; gb.tint = [1.5, 1.5, 1.55]; // the barrel, tapering to the muzzle
    for (let k = 0; k < seg; k++) { const a0 = k / seg * 2 * Math.PI, a1 = (k + 1) / seg * 2 * Math.PI, p = (r, a, z) => [Math.cos(a) * r, yc + Math.sin(a) * r, z];
      gb.quad4('iron', p(r0, a0, z0), p(r1, a0, z1), p(r1, a1, z1), p(r0, a1, z0), [0, 0], [1, 0], [1, 1], [0, 1], [Math.cos((a0 + a1) / 2), Math.sin((a0 + a1) / 2), 0]);
      gb.tri('iron', [0, yc, z0 - 0.15], p(r0, a1, z0), p(r0, a0, z0), [0, 0], [1, 0], [0, 1], [0, 0, -1]); gb.tint = [0.4, 0.4, 0.4]; gb.tri('iron', [0, yc, z1 - 0.1], p(r1, a0, z1), p(r1, a1, z1), [0, 0], [1, 0], [0, 1], [0, 0, 1]); gb.tint = [1.5, 1.5, 1.55]; }
    gb.tint = null; addOCol(area, f, -0.68, -1.3, 0.68, 0.75, -0.5, 1.3); gb.xf = null;
  });

  // a pile of shot
  const shot = (u, v, y) => detail(() => { for (const [r, h0] of [[0.55, 0], [0.38, 0.24], [0.2, 0.46]]) gb.cyl('iron', X + u, Z + v, r, y + h0, y + h0 + 0.26, 8, 1, 1, { top: 'iron' }); });

  /* ---------------- the main rampart ---------------- */
  const P = FT.P, salients = new Set([0, 5, 10, 15, 20]), shoulders = new Set([1, 4, 6, 9, 11, 14, 16, 19, 21, 24]);
  // embrasures: three in each face of the sea bastions (0, 1, 4), two in each face of the land ones, two in every flank, five in either sea curtain
  const emb = {}; const faceE = (k, pos) => { emb[k] = (emb[k] || []).concat(pos); };
  // (bastion b: its faces are the edges 5b and 5b - 1, its flanks 5b + 1 and 5b - 2, the curtain to the next one 5b + 2)
  for (const b of [0, 1, 4]) { faceE(5 * b, [0.28, 0.53, 0.78]); faceE((5 * b + 24) % 25, [0.22, 0.47, 0.72]); }
  for (const b of [2, 3]) { faceE(5 * b, [0.36, 0.7]); faceE(5 * b - 1, [0.3, 0.64]); }
  for (let b = 0; b < 5; b++) { faceE(5 * b + 1, [0.32, 0.7]); faceE((5 * b + 23) % 25, [0.3, 0.68]); }
  for (const k of [2, 22]) faceE(k, [0.16, 0.33, 0.5, 0.67, 0.84]);
  const north = 12; // the north curtain, with the gate
  const holes = {}; { const e = P.E[north], sa = (-5.6 - e.ax) / e.dx, sb = (5.6 - e.ax) / e.dx; holes[north] = [[Math.min(sa, sb), Math.max(sa, sb)]]; }
  const MW = walls(P, [...Array(25).keys()], { y0: -2.2, yb: F.YR - 0.45, bat: 1.0, walk: 9.6, quoins: new Set([...salients, ...shoulders]), holes, emb, ports: Object.fromEntries([...Array(5).keys()].flatMap(b => [[5 * b + 1, [0.34, 0.7]], [5 * b + 3, [0.3, 0.66]]])) }), IP = MW.I;

  // sentry boxes at the bastions' points: a stone turret corbelled out over the angle, slits to the field, a door to the rampart, a domed cap
  const garita = (cu, cv, ang, y) => {
    gb.tint = [1.06, 1.04, 0.98];
    gb.cyl('ashlar', X + cu, Z + cv, 0.45, y - 2.2, y - 1.7, 8, 2, 2); gb.cyl('ashlar', X + cu, Z + cv, 0.8, y - 1.7, y - 1.2, 10, 2, 2); gb.cyl('ashlar', X + cu, Z + cv, 1.08, y - 1.2, y - 0.75, 10, 2, 2, { top: 'ashlar' });
    gb.cyl('ashlar', X + cu, Z + cv, 0.98, y - 0.75, y + 2.2, 10, 2, 2); gb.tint = [0.74, 0.72, 0.68]; gb.cyl('ashlar', X + cu, Z + cv, 1.14, y + 2.2, y + 2.45, 10, 2, 2);
    gb.cone('ashlar', X + cu, Z + cv, 1.12, y + 2.45, 1.1, 10, 2); gb.cyl('ashlar', X + cu, Z + cv, 0.11, y + 3.5, y + 3.9, 5, 1, 1, { top: 'ashlar' }); gb.tint = null;
    for (const da of [-1.2, 0, 1.2]) { const aa = ang + da, sx = Math.sin(aa), sz = Math.cos(aa); gb.quad('winB', W3(cu + sx * 1.0 - sz * 0.11, y + 0.9, cv + sz * 1.0 + sx * 0.11), [sz, 0, -sx], [0, 1, 0], 0.22, 0.8, 1, 1, { fixedUV: true }); }
    { const sx = -Math.sin(ang), sz = -Math.cos(ang); gb.quad('doorDark', W3(cu + sx * 1.0 - sz * 0.35, y + 0.1, cv + sz * 1.0 + sx * 0.35), [sz, 0, -sx], [0, 1, 0], 0.7, 1.8, 1, 1, { fixedUV: true }); }
    colO(cu, cv, ang, 1.02, 1.02, y - 2.5, y + 3.5);
  };
  for (const i of salients) { const a = P.E[(i + 24) % 25], b = P.E[i], ox = a.nx + b.nx, oz = a.nz + b.nz, ol = Math.hypot(ox, oz), [px, pz] = IP(1.0)[i]; garita(px + ox / ol * 0.35, pz + oz / ol * 0.35, Math.atan2(ox, oz), F.YR); }

  /* ---------------- the ravelin ---------------- */
  const RV = FT.RV; // edges: 0 the east face (point to Gb), 1 the gorge (Gb to Ga), 2 the west face (Ga to point)
  const rvHoles = { 0: [[0.72 - 5.6 / RV.E[0].L, 0.72 + 5.6 / RV.E[0].L]] };
  const RW = walls(RV, [0, 2], { y0: -2.2, yr: F.YRV, yb: F.YRV - 0.45, bat: 0.85, sc: 0.82, walk: 8.0, quoins: new Set([0, 1, 2]), holes: rvHoles, emb: { 0: [0.3], 2: [0.3, 0.7] }, caps: { 0: [1], 2: [0] } });
  walls(RV, [1], { y0: -2.2, yb: F.YI - 0.25, bat: 0.5, walk: 8.4, cop: true, quoins: new Set([1, 2]) }); // the gorge: a quay wall, open to the fort, paved 8 m back (over the seam)
  { const [px, pz] = RW.I(0.85)[0]; garita(px, pz - 0.3, Math.PI, F.YRV); }

  /* ---------------- the gates: vaulted passages through the ramparts, a stone frontispiece outside ---------------- */
  // a round arch 4.4 m wide whose crown is at yv, in the current frame: its soffit from z0 to z1 (in the passage's shade), and the spandrels filled on faces at zf (facing sf)
  const AR = 2.2, ARN = 10;
  const arch = (yv, z0, z1, faces) => { const ys = yv - AR, P = (k, z) => { const a = Math.PI * k / ARN; return [-Math.cos(a) * AR, ys + Math.sin(a) * AR, z]; };
    for (let k = 0; k < ARN; k++) { const a = Math.PI * (k + 0.5) / ARN; if (z1 > z0) { gb.tint = DARK; gb.quad4('stone', P(k, z0), P(k + 1, z0), P(k + 1, z1), P(k, z1), [k * 0.7 / 2.4, z0 / 2.4], [(k + 1) * 0.7 / 2.4, z0 / 2.4], [(k + 1) * 0.7 / 2.4, z1 / 2.4], [k * 0.7 / 2.4, z1 / 2.4], [Math.cos(a), -Math.sin(a), 0]); gb.tint = null; }
      for (const [zf, sf] of faces) { const p0 = P(k, zf), p1 = P(k + 1, zf); gb.quad4('ashlar', p0, p1, [p1[0], yv + 0.02, zf], [p0[0], yv + 0.02, zf], [p0[0] / 2, p0[1] / 2], [p1[0] / 2, p1[1] / 2], [p1[0] / 2, yv / 2], [p0[0] / 2, yv / 2], [0, 0, sf]); } } };
  // a thin iron rod (a chain) between two points of the current frame
  const rod = (a, b, w = 0.07, key = 'iron') => { const d = v3norm(v3sub(b, a)), e = v3norm(v3cross(d, Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0])), f = v3cross(e, d), o = (p, s, t) => [p[0] + e[0] * s + f[0] * t, p[1] + e[1] * s + f[1] * t, p[2] + e[2] * s + f[2] * t];
    for (const [s0, t0, s1, t1] of [[-w, -w, w, -w], [w, -w, w, w], [w, w, -w, w], [-w, w, -w, -w]]) gb.quad4(key, o(a, s0, t0), o(b, s0, t0), o(b, s1, t1), o(a, s1, t1), [0, 0], [1, 0], [1, 1], [0, 1], [(s0 + s1) * e[0] + (t0 + t1) * f[0], (s0 + s1) * e[1] + (t0 + t1) * f[1], (s0 + s1) * e[2] + (t0 + t1) * f[2]]); };
  // a chain between two points: links turned this way and that
  const chain = (a, b, w = 0.026) => { const n = Math.max(2, Math.round(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) / 0.26)), q = t => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; for (let k = 0; k < n; k++) rod(q(k / n), q((k + 1) / n), k % 2 ? w : w * 0.62); };
  // the gates' stone in a softer light, so no side of it glares beside the rest
  const soft = fn => { const g0 = gb.light; gb.light = (p, n) => { const c = g0(p, n), m = Math.max(c[0], c[1], c[2]); const v = Math.min(0.8, 0.5 * m + 0.3); return [v, v * 0.99, v * 0.95]; }; fn(); gb.light = g0; };
  // the stones of the arch's ring on a face at zf, long and short
  const ring = (yv, zf, sf, key = 'ashlar') => { const n = 13, ys = yv - AR; for (let k = 0; k < n; k++) { const a0 = Math.PI * k / n, a1 = Math.PI * (k + 1) / n, r1 = AR + (k % 2 ? 0.55 : 0.85), q = (a, r) => [-Math.cos(a) * r, ys + Math.sin(a) * r, zf]; gb.tint = k % 2 ? [0.86, 0.84, 0.8] : [1.02, 1.0, 0.95];
      gb.quad4(key, q(a0, AR), q(a1, AR), q(a1, r1), q(a0, r1), [0, 0], [0.5, 0], [0.5, 0.4], [0, 0.4], [0, 0, sf]); } gb.tint = null; };
  // a passage in a frame whose +z runs inward from the face: opening half-width 2.2 under a barrel vault whose crown is at yv, walls out to 8.6, the rampart's top at yt
  const passage = (cu, cv, ang, len, y0, y1, yv, yt, inner) => {
    const f = gb.setXf(X + cu, Z + cv, ang, 0), col = (a, b, c, d, e, g) => addOCol(area, f, a, b, c, d, e, g);
    arch(yv, -0.9, len + (inner ? 0.8 : 0), inner ? [[len + 0.8, 1]] : []);
    gb.tint = DARK; for (const sg of [-1, 1]) { gb.box(sg > 0 ? 2.2 : -8.6, Math.min(y0, y1) - 1, 1.3, sg > 0 ? 8.6 : -2.2, yv, len, { side: 'stone', top: null }, 2.4, 2.4); col(sg > 0 ? 2.2 : -8.6, 0, sg > 0 ? 8.6 : -2.2, len, Math.min(y0, y1) - 1, yv); } // (they begin behind the battered face)
    gb.box(-8.6, yv, 1.3, 8.6, yt - 0.05, len, { side: 'stone', top: null, bottom: 'stone' }, 2.4, 2.4); col(-8.6, 0, 8.6, len, yv, yt);
    gb.tint = [0.7, 0.7, 0.72]; gb.quad4('flag', [-2.3, y0 + 0.06, -0.9], [2.3, y0 + 0.06, -0.9], [2.3, y1 + 0.1, len + 1.2], [-2.3, y1 + 0.1, len + 1.2], [0, 0], [1.5, 0], [1.5, len / 3], [0, len / 3], [0, 1, 0]); gb.tint = null; for (let q = 0; q < 6; q++) col(-2.3, lerp(-0.9, len + 1.2, q / 6), 2.3, lerp(-0.9, len + 1.2, (q + 1) / 6), y0 - 1.5, lerp(y0 + 0.06, y1 + 0.1, (q + 0.5) / 6)); // (its floor)
    gb.tint = TURF2; gb.quad('tGrass', [-8.6, yt + 0.03, len], [1, 0, 0], [0, 0, -1], 17.2, len - 1.3, 3, 3); gb.tint = null; // its top, turfed like the rest of the rampart
    for (const sg of [-1, 1]) { gb.box(sg > 0 ? 2.03 : -2.15, y0, 0.5, sg > 0 ? 2.15 : -2.03, y0 + 2.45, 2.7, 'woodDark', 1, 1); for (const y of [0.5, 1.9]) gb.box(sg > 0 ? 2.0 : -2.18, y0 + y, 0.5, sg > 0 ? 2.18 : -2.0, y0 + y + 0.12, 2.7, 'iron', 1, 1); } // the gate's leaves, folded back
    if (inner) { // the inner face, on the parade: a plain front with the arch, a low parapet along the top
      for (const [a, b, c, d] of [[-10, -2.2, Math.min(y0, y1) - 1, yt + 1.0], [2.2, 10, Math.min(y0, y1) - 1, yt + 1.0], [-2.2, 2.2, yv, yt + 1.0]]) { gb.tint = BRICK; gb.box(a, c, len, b, d, len + 0.8, { side: 'brick', top: 'stone' }, 2.4, 2.4); gb.tint = null; col(a, len, b, len + 0.8, c, d); }
      gb.box(-10.2, yt + 1.0, len - 0.15, 10.2, yt + 1.3, len + 1.0, 'ashlar', 2, 2); ring(yv, len + 0.83, 1); // a coping, and a ring of stone round the arch
      gb.box(-2.75, y1, len + 0.8, -2.2, yv - AR, len + 0.95, 'ashlar', 2, 2); gb.box(2.2, y1, len + 0.8, 2.75, yv - AR, len + 0.95, 'ashlar', 2, 2); gb.box(-0.35, yv - 0.04, len + 0.8, 0.35, yv + 0.5, len + 1.0, 'ashlar', 1, 1); // the jambs and the keystone
      for (const sg of [-1, 1]) { gb.box(Math.min(sg * 2.75, sg * 10.15), y1 - 1, len + 0.8, Math.max(sg * 2.75, sg * 10.15), y1 + 0.6, len + 0.93, 'stone', 2, 2); for (const x of [3.7, 9.6]) { gb.box(sg * x - 0.5, y1 - 0.5, len + 0.8, sg * x + 0.5, yt + 0.4, len + 1.02, 'ashlar', 1.6, 1.6); gb.box(sg * x - 0.6, yt + 0.1, len + 0.8, sg * x + 0.6, yt + 0.45, len + 1.1, 'ashlar', 1, 1); }
        { const nx = sg * 6.65, r = 1.15, ny = y1 + 2.2, zf = len + 0.86; gb.box(nx - 1.45, y1 + 0.6, len + 0.8, nx + 1.45, y1 + 0.62, len + 0.9, 'ashlar', 1, 1); for (let k = 0; k < 10; k++) { const a0 = k / 10 * Math.PI, a1 = (k + 1) / 10 * Math.PI, q = (a, w, z) => [nx + Math.cos(a) * w, ny + Math.sin(a) * w, z]; gb.quad4('ashlar', q(a0, r, zf), q(a0, r + 0.4, zf), q(a1, r + 0.4, zf), q(a1, r, zf), [0, 0], [0.4, 0], [0.4, 0.4], [0, 0.4], [0, 0, 1]); gb.tint = [0.36, 0.34, 0.33]; gb.tri('stone', [nx, ny, zf - 0.01], q(a0, r, zf - 0.01), q(a1, r, zf - 0.01), [0.5, 0], [0, 1], [1, 1], [0, 0, 1]); gb.tint = null; }
          gb.tint = [0.36, 0.34, 0.33]; gb.quad('stone', [nx - r, y1 + 0.6, zf - 0.01], [1, 0, 0], [0, 1, 0], 2 * r, ny - y1 - 0.6, 2, 2); gb.tint = null; for (const e of [-1, 1]) gb.box(nx + e * (r + 0.2) - 0.2, y1 + 0.6, len + 0.8, nx + e * (r + 0.2) + 0.2, ny, len + 0.88, 'ashlar', 1, 1); } } // pilasters and blind casemate arches
      gb.tri('ashlar', [-4.42, yt + 1.28, len + 0.9], [4.42, yt + 1.28, len + 0.9], [0, yt + 3.46, len + 0.9], [-1.5, 0], [1.5, 0], [0, 0.8], [0, 0, 1]); gb.tri('ashlar', [-4.42, yt + 1.28, len + 0.2], [4.42, yt + 1.28, len + 0.2], [0, yt + 3.46, len + 0.2], [-1.5, 0], [1.5, 0], [0, 0.8], [0, 0, -1]); for (const sg of [-1, 1]) gb.quad4('roofSlate', [sg * 4.45, yt + 1.28, len + 1.1], [0, yt + 3.45, len + 1.1], [0, yt + 3.45, len], [sg * 4.45, yt + 1.28, len], [0, 0], [1.6, 0], [1.6, 0.4], [0, 0.4], [sg * 0.45, 1, 0]); // a pediment over it
    }
    gb.xf = null; return f;
  };
  // the main gate: through the north curtain to the parade
  const cv = FT.cv, plen = (-F.PA + 1.5) - cv;
  const GV = 7.6; soft(() => passage(0, cv, 0, plen, F.GF, F.YP, GV, F.YR, true));
  soft(() => { const f = gb.setXf(X, Z + cv, 0, 0), col = (a, b, c, d, e, g) => addOCol(area, f, a, b, c, d, e, g);
    // the frontispiece: rusticated piers, an entablature, a pediment with the arms over the arch, standing proud of the brick
    for (const [a, b, c] of [[-5.6, -2.2, -2.2], [2.2, 5.6, -2.2], [-2.2, 2.2, GV]]) { gb.box(a, c, -0.9, b, F.YR + 1.4, 1.5, { side: 'ashlar', top: 'stone' }, 2, 2); col(a, -0.9, b, 1.5, c - 0.8, F.YR + 1.4); }
    gb.box(-2.2, -2.2, -0.9, 2.2, F.GF, 1.4, { side: 'ashlar', top: null }, 2, 2); // under the threshold, down into the water
    arch(GV, -0.9, -0.9, [[-0.9, -1]]); ring(GV, -0.93, -1); // (the spandrels on its face: the passage's vault runs through it)
    for (const sg of [-1, 1]) { for (let y = F.GF - 0.1, k = 0; y < GV - AR - 0.2; y += 0.72, k++) { const xa = sg * 2.2, xb = sg * (k % 2 ? 3.1 : 3.6); gb.tint = k % 2 ? [0.86, 0.84, 0.8] : [1.02, 1.0, 0.95]; gb.box(Math.min(xa, xb), y, -1.02, Math.max(xa, xb), y + 0.64, -0.9, 'ashlar', 1, 1); gb.tint = null; } // the jambs rusticated, long and short
      gb.box(sg * 4.7 - 0.5, F.GF - 0.4, -1.08, sg * 4.7 + 0.5, F.YR - 0.2, -0.9, 'ashlar', 1, 2); gb.box(sg * 4.7 - 0.62, F.YR - 0.75, -1.16, sg * 4.7 + 0.62, F.YR - 0.2, -0.9, 'ashlar', 1, 1); gb.box(sg * 4.7 - 0.62, F.GF - 0.4, -1.16, sg * 4.7 + 0.62, F.GF + 0.2, -0.9, 'ashlar', 1, 1); // pilasters, with capitals and bases
      gb.tint = [0.25, 0.23, 0.22]; gb.box(sg * 2.05 - 0.3, GV + 0.75, -0.95, sg * 2.05 + 0.3, GV + 1.75, -0.88, 'stone', 1, 1); gb.tint = null; } // the slots of the lifting beams
    gb.box(-5.9, F.YR - 0.2, -1.5, 5.9, F.YR + 0.5, 1.6, 'ashlar', 2, 2); // the entablature
    for (const [zt, sg] of [[-1.2, -1], [1.5, 1]]) gb.tri('ashlar', [-6.1, F.YR + 0.42, zt], [6.1, F.YR + 0.42, zt], [0, F.YR + 3.36, zt], [-2, 0], [2, 0], [0, 1], [0, 0, sg]);
    for (const sg of [-1, 1]) gb.quad4('roofSlate', [sg * 6.15, F.YR + 0.45, -1.45], [0, F.YR + 3.35, -1.45], [0, F.YR + 3.35, 1.7], [sg * 6.15, F.YR + 0.45, 1.7], [0, 0], [2, 0], [2, 1], [0, 1], [sg * 0.4, 1, 0]);
    gb.tint = [0.75, 0.14, 0.1]; gb.box(-0.75, F.YR + 0.75, -1.3, 0.75, F.YR + 2.05, -1.18, 'plaster', 1, 1); gb.tint = [1.25, 0.95, 0.3]; gb.box(-0.75, F.YR + 1.25, -1.33, 0.75, F.YR + 1.55, -1.2, 'plaster', 1, 1); gb.box(-0.14, F.YR + 0.75, -1.33, 0.14, F.YR + 2.05, -1.2, 'plaster', 1, 1); gb.tint = null; // the arms in the tympanum
    gb.box(-0.4, GV - 0.04, -1.08, 0.4, GV + 0.75, -0.9, 'ashlar', 1, 1); // the keystone
    // the drawbridge's lifting beams, run out through slots over the arch, their chains down to the end of the bridge
    for (const sg of [-1, 1]) { gb.box(sg * 2.05 - 0.17, GV + 0.95, -6.4, sg * 2.05 + 0.17, GV + 1.3, -0.9, 'woodDark', 1, 1); chain([sg * 2.05, GV + 0.95, -6.1], [sg * 1.72, F.GF + 0.08, -5.9]); gb.box(sg * 1.72 - 0.14, F.GF, -6.0, sg * 1.72 + 0.14, F.GF + 0.1, -5.7, 'iron', 1, 1); }
    gb.box(-2.5, GV + 0.9, -6.5, 2.5, GV + 1.2, -6.2, 'woodDark', 1, 1); // (a beam across their ends)
    gb.box(-2.6, F.GF - 0.4, -1.6, 2.6, F.GF + 0.02, 0.6, { side: 'stone', top: 'stone' }, 2, 2); col(-2.6, -1.6, 2.6, 0.6, F.GF - 1, F.GF + 0.02); // the threshold
    gb.xf = null; Sites.glows.push([X - 3.2, F.GF + 4.2, Z + cv - 1.6, 2.6], [X + 3.2, F.GF + 4.2, Z + cv - 1.6, 2.6]); });
  // stairs up either side of the gate's inner front, to the rampart
  for (const sg of [-1, 1]) { const x0 = sg > 0 ? 10.6 : -13.6, x1 = x0 + 3.0, n = 15, rise = (F.YR - F.YP) / n, run = 0.87, vb = -44.6;
    for (let k = 0; k < n; k++) { const za = vb - (k + 1) * run, zb = vb - k * run, top = F.YP + (k + 1) * rise; gb.box(X + x0, F.YP - 0.6, Z + za, X + x1, top, Z + zb, { side: 'stone', top: 'stoneLight' }, 2, 2, { skip: 'b' }); addCol(area, X + x0, Z + za, X + x1, Z + zb, F.YP - 1, top); }
    const xo = sg > 0 ? x1 : x0 - 0.35; for (let k = 0; k < n; k++) { const za = vb - (k + 1) * run, zb = vb - k * run, top = F.YP + (k + 1) * rise; gb.box(X + xo, F.YP - 0.6, Z + za, X + xo + 0.35, top + 0.9, Z + zb, { side: 'stone', top: 'stoneLight' }, 2, 2, { skip: 'b' }); addCol(area, X + xo, Z + za, X + xo + 0.35, Z + zb, F.YP - 1, top + 0.9); } } // (a stepped parapet along the open side)
  // the ravelin's gate: through its east face, square to it
  soft(() => { const RVV = 6.7, ang = Math.atan2(-FT.nF[0], -FT.nF[1]), f = passage(FT.F1[0], FT.F1[1], ang, 14.5, F.YI, F.YI, RVV, F.YRV, false), col = (a, b, c, d, e, g) => addOCol(area, f, a, b, c, d, e, g);
    gb.xf = f; for (const [a, b, c] of [[-4.4, -2.2, -2.2], [2.2, 4.4, -2.2], [-2.2, 2.2, RVV]]) { gb.box(a, c, -0.8, b, F.YRV + 1.4, 1.4, { side: 'ashlar', top: 'stone' }, 2, 2); col(a, -0.8, b, 1.4, c - 0.8, F.YRV + 1.4); }
    for (const sg of [-1, 1]) gb.box(sg > 0 ? 4.4 : -5.8, -2.2, 0.1, sg > 0 ? 5.8 : -4.4, F.YRV + 0.6, 1.4, { side: 'stone', top: 'stone' }, 2, 2); // (and beside it, where the brick leaves off)
    gb.box(-2.2, -2.2, -0.8, 2.2, F.YI, 1.3, { side: 'ashlar', top: null }, 2, 2);
    arch(RVV, -0.8, -0.8, [[-0.8, -1]]); ring(RVV, -0.83, -1); gb.box(-0.36, RVV - 0.04, -0.98, 0.36, RVV + 0.6, -0.8, 'ashlar', 1, 1); gb.box(-4.7, F.YRV + 1.4, -1.0, 4.7, F.YRV + 1.75, 1.6, 'ashlar', 2, 2);
    for (const sg of [-1, 1]) { for (let y = F.YI - 0.1, k = 0; y < RVV - AR - 0.2; y += 0.72, k++) { const xa = sg * 2.2, xb = sg * (k % 2 ? 3.0 : 3.4); gb.tint = k % 2 ? [0.86, 0.84, 0.8] : [1.02, 1.0, 0.95]; gb.box(Math.min(xa, xb), y, -0.92, Math.max(xa, xb), y + 0.64, -0.8, 'ashlar', 1, 1); gb.tint = null; }
      gb.tint = [0.25, 0.23, 0.22]; gb.box(sg * 2.05 - 0.28, RVV + 0.75, -0.85, sg * 2.05 + 0.28, RVV + 1.4, -0.78, 'stone', 1, 1); gb.tint = null;
      gb.box(sg * 2.05 - 0.15, RVV + 0.9, -4.6, sg * 2.05 + 0.15, RVV + 1.2, -0.8, 'woodDark', 1, 1); chain([sg * 2.05, RVV + 0.9, -4.3], [sg * 1.72, F.YI + 0.08, -4.2]); gb.box(sg * 1.72 - 0.14, F.YI, -4.3, sg * 1.72 + 0.14, F.YI + 0.1, -4.0, 'iron', 1, 1); }
    gb.box(-2.15, RVV + 0.88, -4.75, 2.15, RVV + 1.16, -4.45, 'woodDark', 1, 1);
    gb.tri('ashlar', [-4.72, F.YRV + 1.69, -0.9], [4.72, F.YRV + 1.69, -0.9], [0, F.YRV + 3.66, -0.9], [-1.5, 0], [1.5, 0], [0, 0.7], [0, 0, -1]); gb.tri('ashlar', [-4.72, F.YRV + 1.69, 1.4], [4.72, F.YRV + 1.69, 1.4], [0, F.YRV + 3.66, 1.4], [-1.5, 0], [1.5, 0], [0, 0.7], [0, 0, 1]); for (const sg of [-1, 1]) gb.quad4('roofSlate', [sg * 4.75, F.YRV + 1.7, -1.1], [0, F.YRV + 3.65, -1.1], [0, F.YRV + 3.65, 1.6], [sg * 4.75, F.YRV + 1.7, 1.6], [0, 0], [1.7, 0], [1.7, 1], [0, 1], [sg * 0.4, 1, 0]); // (a pediment)
    gb.box(-2.6, F.YI - 0.4, -2.0, 2.6, F.YI + 0.02, 6.2, { side: 'stone', top: 'stone' }, 2, 2); col(-2.6, -2.0, 2.6, 6.2, F.YI - 1, F.YI + 0.02); // (the threshold runs on into the passage: oblique to the ground's grid, its floor would dip there)
    gb.xf = null; });

  /* ---------------- the bridges: timber on stone piers, a drawbridge at the gate end ---------------- */
  const bridge = (au, av, bu, bv, y, piers, rs) => {
    const L = Math.hypot(bu - au, bv - av), ang = Math.atan2(bu - au, bv - av), f = gb.setXf(X + au, Z + av, ang, 0), col = (a, b, c, d, e, g) => addOCol(area, f, a, b, c, d, e, g);
    const dl = 5.0; // the drawbridge, the last span before the gate
    gb.box(-2.1, y - 0.45, 0, 2.1, y, L - dl, { side: 'woodDark', top: 'wood' }, 2, 2); gb.box(-2.0, y - 0.35, L - dl, 2.0, y + 0.02, L - 0.1, { side: 'woodDark', top: 'woodDark' }, 1.5, 1.5);
    col(-2.1, -0.5, 2.1, L + 0.3, y - 1.5, y + 0.02);
    for (const sg of [-1, 1]) { gb.box(sg * 2.1 - 0.07, y + 0.88, rs, sg * 2.1 + 0.07, y + 1.02, L - dl, 'woodDark', 1, 1); gb.box(sg * 2.1 - 0.05, y + 0.4, rs, sg * 2.1 + 0.05, y + 0.5, L - dl, 'woodDark', 1, 1); col(sg * 2.1 - 0.1, rs, sg * 2.1 + 0.1, L - dl, y - 1, y + 1.05);
      for (let t = rs; t <= L - dl + 0.01; t += (L - dl - rs) / Math.max(1, Math.round((L - dl - rs) / 2.5))) gb.box(sg * 2.1 - 0.1, y - 0.2, t - 0.1, sg * 2.1 + 0.1, y + 1.15, t + 0.1, 'woodDark', 1, 1);
    }
    for (const t of piers) { gb.box(-2.6, -4, t - 1.1, 2.6, y - 0.45, t + 1.1, { side: 'stone', top: 'stone' }, 2, 2); gb.box(-1.5, -4, t - 1.9, 1.5, y - 1.4, t - 1.1, 'stone', 2, 2); } // (cutwaters)
    for (let t = 3; t < L - dl - 1; t += 3) if (!piers.some(p => Math.abs(p - t) < 2)) for (const sg of [-1.6, 1.6]) gb.box(sg - 0.14, -3, t - 0.14, sg + 0.14, y - 0.45, t + 0.14, 'woodDark', 1, 1);
    gb.xf = null;
  };
  bridge(FT.B1o[0], FT.B1o[1], FT.F1[0] - FT.nF[0] * 0.8, FT.F1[1] - FT.nF[1] * 0.8, F.YI, [8], 2.0);
  bridge(0, FT.Gm[1] - 3, 0, cv - 1.0, F.GF, [10, 21, 31], 3.6);

  /* ---------------- the counterscarp: brick from below the water to a stone coping; the covered way gravelled behind it ---------------- */
  { const A = fortLevel(0), B = fortLevel(8), G = fortLevel(3.9, fortE), step = 3, l2 = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)]; let run = 0;
    for (let k = 0; k + step < A.length; k += step) {
      const a0 = A[k], a1 = A[k + step], b0 = B[k], b1 = B[k + step], L = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]); if (L < 0.05) continue;
      const dx = (a1[0] - a0[0]) / L, dz = (a1[1] - a0[1]) / L; let nx = dz, nz = -dx; const mx = (a0[0] + a1[0]) / 2, mz = (a0[1] + a1[1]) / 2; if (fortDC(mx + nx * 1.5, mz + nz * 1.5) > 0) { nx = -nx; nz = -nz; } // (facing the water)
      if ((mz > 40 && Math.min(Math.abs(a0[0]), Math.abs(a1[0])) < FORT_ARM) || (mx < -90 && mz > 46)) { run += L; continue; } // (none before the sea front)
      const Pt = (p, y) => W3(p[0], y, p[1]), uv = (s, y) => [(run + s) / 2.4, y / 2.4], h = [nx, 0.05, nz], c0 = l2(a0, b0, 0.07), c1 = l2(a1, b1, 0.07), fl = p => [(X + p[0]) / 3, (Z + p[1]) / 3], t0 = F.CW, t1 = F.CW, s0 = F.CW + 0.06, s1 = F.CW + 0.06, lo = y => Math.min(y, -0.15);
      const west = mx < -45 && mz > -95, rk = west ? 'stone' : 'brick'; // (on the west, where the ground is rock, the counterscarp is cut in it, and the covered way is not gravelled)
      gb.tint = WET; gb.quad4(rk, Pt(a0, -2.2), Pt(a1, -2.2), Pt(a1, lo(t1)), Pt(a0, lo(t0)), uv(0, -2.2), uv(L, -2.2), uv(L, lo(t1)), uv(0, lo(t0)), h);
      gb.tint = west ? [0.72, 0.7, 0.66] : BRICK; gb.quad4(rk, Pt(a0, lo(t0)), Pt(a1, lo(t1)), Pt(a1, t1), Pt(a0, t0), uv(0, -0.15), uv(L, -0.15), uv(L, t1), uv(0, t0), h); gb.tint = null;
      gb.quad4('ashlar', Pt(a0, t0), Pt(a1, t1), Pt(a1, t1 + 0.22), Pt(a0, t0 + 0.22), uv(0, 0), uv(L, 0), uv(L, 0.22), uv(0, 0.22), h);
      gb.quad4('ashlar', Pt(a0, t0 + 0.22), Pt(a1, t1 + 0.22), Pt(c1, t1 + 0.22), Pt(c0, t0 + 0.22), fl(a0), fl(a1), fl(c1), fl(c0), [0, 1, 0]);
      gb.quad4('ashlar', Pt(c0, t0 + 0.22), Pt(c1, t1 + 0.22), Pt(c1, t1 + 0.02), Pt(c0, t0 + 0.02), uv(0, 0.22), uv(L, 0.22), uv(L, 0), uv(0, 0), [-nx, 0, -nz]);
      if (!west) gb.quad4('gravelN', Pt(c0, t0 + 0.1), Pt(c1, t1 + 0.1), Pt(b1, s1 + 0.04), Pt(b0, s0 + 0.04), fl(c0), fl(c1), fl(b1), fl(b0), [0, 1, 0]);
      if (mz < 66 && !west) { const g0 = G[k], g1 = G[k + step]; gb.quad4('gravelN', Pt(b0, s0 + 0.04), Pt(b1, s1 + 0.04), Pt(g1, s1 + 0.03), Pt(g0, s0 + 0.03), fl(b0), fl(b1), fl(g1), fl(g0), [0, 1, 0]); }
      const cx = (a0[0] + a1[0] + b0[0] + b1[0]) / 4, cz = (a0[1] + a1[1] + b0[1] + b1[1]) / 4, cy = (t0 + t1 + s0 + s1) / 4; colO(cx, cz, Math.atan2(dx, dz), 4.3, Math.max(L, Math.hypot(b1[0] - b0[0], b1[1] - b0[1])) / 2 + 0.3, cy - 1.2, cy + 0.04);
      run += L;
    } }
  // the palisade: sharpened stakes standing a little apart inside the crest, only their points above it; a rail behind them; a gate where the road
  // goes through; its ends carried on to the batteries
  { const line = fortLevel(4.1, fortE), gd = v3norm([7, 0, -24]), gp = [gd[2], -gd[0]], G0 = [FT.R0[0] + gd[0] * 2.2, FT.R0[1] + gd[2] * 2.2], rd = (u, v) => segDist(u, v, FT.R0[0], FT.R0[1], FT.R0[0] + gd[0] * 20, FT.R0[1] + gd[2] * 20).d, runs = []; let cur = null; // (the road leaves through the point of the place of arms east of the ravelin)
    for (const q of line) { if (rd(q[0], q[1]) < 3.6 || q[1] > 50) { cur = null; continue; } if (!cur) runs.push(cur = []); cur.push(q); }
    if (runs.length > 1 && Math.hypot(runs[0][0][0] - runs[runs.length - 1].at(-1)[0], runs[0][0][1] - runs[runs.length - 1].at(-1)[1]) < 3) { runs[0] = [...runs.pop(), ...runs[0]]; } // (the rays start due east: one run across it)
    const pier = sg => [G0[0] + gp[0] * sg * 3.6, G0[1] + gp[1] * sg * 3.6], sideOf = q => Math.sign((q[0] - G0[0]) * gp[0] + (q[1] - G0[1]) * gp[1]) || 1;
    for (const r of runs) { for (const end of [0, 1]) { const q = end ? r.at(-1) : r[0], add = rd(q[0], q[1]) < 6 ? [pier(sideOf(q))] : q[1] > 46 && q[0] > 0 ? [[122, 60], [122, 78.5]] : []; if (end) r.push(...add); else r.unshift(...add.reverse()); } }
    detail(() => { gb.tint = [0.64, 0.82, 1.1];
    for (const r of runs) { const st = resampleEven(r, 0.34); let prev = null; for (let q = 0; q < st.length; q++) { const [bx, bz] = st[q], top = F.CW + Math.max(1.5, fortCrest(bz) - 0.05) + 0.14 * _h2(q, 7, 8150), rl = Math.hypot(bx, bz) || 1, ox = bx / rl, oz = bz / rl; gb.box(X + bx - 0.11, F.CW - 0.3, Z + bz - 0.11, X + bx + 0.11, top, Z + bz + 0.11, 'wood', 1, 1, { skip: 'tb' }); gb.cone('wood', X + bx, Z + bz, 0.15, top, 0.3, 4, 1);
      if (!prev) prev = [bx, bz]; else if (q % 8 === 7 || q === st.length - 1) { const [px, pz] = prev, y = top - 0.8; gb.quad4('wood', W3(px - ox * 0.14, y, pz - oz * 0.14), W3(bx - ox * 0.14, y, bz - oz * 0.14), W3(bx - ox * 0.14, y + 0.2, bz - oz * 0.14), W3(px - ox * 0.14, y + 0.2, pz - oz * 0.14), [0, 0], [2, 0], [2, 0.2], [0, 0.2], [-ox, 0, -oz]);
        const L = Math.hypot(bx - px, bz - pz); if (L < 12) colO((px + bx) / 2, (pz + bz) / 2, Math.atan2(bx - px, bz - pz), 0.2, L / 2 + 0.15, F.CW - 1, top + 0.3); prev = [bx, bz]; } } } });
    const f = gb.setXf(X + G0[0], Z + G0[1], Math.atan2(gd[0], gd[2]), F.CW + 0.45);
    for (const sg of [-1, 1]) { gb.box(sg * 3.1 - 0.5, -0.8, -0.5, sg * 3.1 + 0.5, 2.5, 0.5, 'ashlar', 1.6, 1.6); gb.box(sg * 3.1 - 0.6, 2.5, -0.6, sg * 3.1 + 0.6, 2.72, 0.6, 'ashlar', 1, 1); gb.cyl('ashlar', sg * 3.1, 0, 0.16, 2.72, 2.9, 6, 1, 1); gb.cyl('ashlar', sg * 3.1, 0, 0.34, 2.9, 3.4, 8, 1, 1, { top: 'ashlar' }); addOCol(area, f, sg * 3.1 - 0.5, -0.5, sg * 3.1 + 0.5, 0.5, -1, 3);
      for (let k = 0; k < 6; k++) gb.box(sg * 2.5 - 0.06, 0.08, -0.6 - k * 0.42, sg * 2.5 + 0.06, 1.75, -0.6 - k * 0.42 + 0.34, 'wood', 1, 1); for (const y of [0.4, 1.3]) gb.box(sg * 2.5 - 0.1, y, -3.1, sg * 2.5 + 0.1, y + 0.16, -0.4, 'woodDark', 1, 1); addOCol(area, f, sg * 2.5 - 0.12, -3.1, sg * 2.5 + 0.12, -0.4, -1, 1.75); } // (its leaves, folded back)
    gb.xf = null; }
  // the places of arms gravelled like the covered way
  for (const T of FT.PA) { if (T.pts[0][0] < -60 && T.pts[0][1] > -95) continue; const [a, b, c] = T.pts, y = F.CW + 0.05, uv = q => [(X + q[0]) / 3, (Z + q[1]) / 3]; gb.tri('gravelN', W3(a[0], y, a[1]), W3(b[0], y, b[1]), W3(c[0], y, c[1]), uv(a), uv(b), uv(c), [0, 1, 0]); }
  // the batardeaux: a stone dam across the wet ditch at either end of the sea front, its top a sharp ridge no one could walk along, a turret in the middle of it
  for (const [A, u] of [[FT.sides[4].A, FT.sides[4].ua], [FT.sides[0].B, FT.sides[0].ub]]) { const sx = A[0] + u[0] * 18.5, sz = A[1] + u[1] * 18.5; if (sx < 0) continue; let nx = u[1], nz = -u[0]; if (fsd(FT.P, sx + nx, sz + nz) < 0) { nx = -nx; nz = -nz; }
    const len = F.W + 1.6, ang = Math.atan2(nx, nz), f = gb.setXf(X + sx - nx * 0.6, Z + sz - nz * 0.6, ang, 0);
    gb.tint = WET; gb.box(-1.3, -3, 0, 1.3, -0.15, len, { side: 'stone', top: null }, 2.4, 2.4); gb.tint = null; gb.tint = [1.1, 1.08, 1.02]; gb.box(-1.3, -0.15, 0, 1.3, 1.5, len, { side: 'stone', top: null }, 2.4, 2.4);
    for (const sg of [-1, 1]) gb.quad4('stone', [sg * 1.3, 1.5, 0], [sg * 1.3, 1.5, len], [0, 3.1, len], [0, 3.1, 0], [0, 0], [len / 2.4, 0], [len / 2.4, 0.9], [0, 0.9], [sg, 0.8, 0]);
    for (const z of [0, len]) gb.tri('stone', [-1.3, 1.5, z], [1.3, 1.5, z], [0, 3.1, z], [0, 0], [1, 0], [0.5, 0.7], [0, 0, z ? 1 : -1]);
    gb.cyl('stone', 0, len / 2, 1.0, 1.2, 4.6, 10, 2, 2); gb.tint = [0.74, 0.72, 0.68]; gb.cone('ashlar', 0, len / 2, 1.25, 4.6, 1.3, 10, 2); gb.tint = null; addOCol(area, f, -1.3, 0, 1.3, len, -3, 4.6); gb.xf = null; }
  // rock thrown down in a bank along the foot of the sea front and round the pier heads, against the waves, and scattered along the shore
  const rocks = new RNG(8180), rock = (u, v, y, sz) => detail(() => { gb.setXf(X + u, Z + v, rocks.range(0, 3), y); const a = sz * rocks.range(0.8, 1.2), b = sz * rocks.range(0.7, 1.1), c = sz * rocks.range(0.6, 0.95), q = rocks.range(0.72, 1.12); gb.tint = [q, q, q * 0.97]; gb.box(-a, -c, -b, a, c * 0.75, b, 'rock', 1.6, 1.6, { skip: 'b' }); gb.box(-a * 0.6, c * 0.75, -b * 0.6, a * 0.65, c * 1.1, b * 0.55, 'rock', 1.6, 1.6, { skip: 'b' }); gb.tint = null; gb.xf = null; });
  const gridH = (u, v) => { const C = 4, gx = Math.floor((X + u) / C) * C, gz = Math.floor((Z + v) / C) * C, fx = (X + u - gx) / C, fz = (Z + v - gz) / C; return lerp(lerp(H(gx, gz), H(gx + C, gz), fx), lerp(H(gx, gz + C), H(gx + C, gz + C), fx), fz); };
  const bank = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az); for (let row = 0; row < 3; row++) for (let t = rocks.range(0, 0.8); t < L; t += rocks.range(1.0, 1.7)) { const o = 0.5 + row * 1.15 + rocks.range(-0.3, 0.4), u = lerp(ax, bx, t / L) + nx * o, v = lerp(az, bz, t / L) + nz * o; if (fsd(P, u, v) > 0.2) rock(u, v, -0.75 - row * 0.22 + rocks.range(-0.15, 0.2), rocks.range(0.55, 1.0)); } };
  for (const e of P.E) if (e.az + e.dz / 2 > 56) bank(e.ax, e.az, e.ax + e.dx, e.az + e.dz, e.nx, e.nz);
  bank(FORT_ARM, 69, FORT_ARM, 92, -1, 0); bank(FORT_ARM, 92, 122.5, 92, 0, 1);
  for (let t = 0, k = 0; t < 4000 && k < 70; t++) { const u = rocks.range(119, 158), v = rocks.range(84, 112), h = gridH(u, v); if (Math.abs(h + 0.95) > 0.55) continue; rock(u, v, h + 0.25, rocks.range(0.5, 1.15)); k++; } // (the arm's rounded corner)
  // rock where the ground meets the water: along the west shore under the glacis and the hill in broken ledges and boulders, in reefs off it
  const ledge = (u, v, n, R, s0, s1) => { for (let q = 0; q < n; q++) { const a = rocks.range(0, 6.283), r = R * Math.sqrt(rocks.next()), uu = u + Math.cos(a) * r, vv = v + Math.sin(a) * r, h = gridH(uu, vv); if (h > 2.2) continue; rock(uu, vv, Math.max(h, -1.3) + rocks.range(0.05, 0.4), rocks.range(s0, s1)); } };
  for (let t = 0, k = 0; t < 8000 && k < 70; t++) { const u = rocks.range(-320, -95), v = rocks.range(-240, 66), h = gridH(u, v); if (h > 0.6 || h < -1.6 || u > -100 && v < 40) continue; ledge(u, v, 6, 4, 0.8, 2.2); k++; }
  for (const [ru0, rv0, ang, n] of [[-205, 66, 2.6, 7], [-262, -120, 3.4, 6], [-300, -205, 3.0, 5]]) for (let q = 0; q < n; q++) { const u = ru0 + Math.cos(ang) * q * 6 + rocks.range(-2, 2), v = rv0 + Math.sin(ang) * q * 6 + rocks.range(-2, 2), h = gridH(u, v); if (h > 0.5) continue; for (let w = 0; w < 4; w++) rock(u + rocks.range(-3, 3), v + rocks.range(-3, 3), -0.95 + rocks.range(-0.3, 0.9) * (1 - q / n), rocks.range(1.1, 2.6)); } // (some awash, some standing clear) // (reefs running out from the shore's points)
  // a bank of turf along +z of a frame, from its inner foot at z0: segs [from, to, crest's height] (from or to null: a corner, mitred), planks or
  // brick on the ends of the high ones beside a gap; zo, yo: how far out and how low its outer foot lies
  const turfBank = (bu, bv, ang, y, z0, segs, lit, zo = 7.2, yo = -2) => { const f = gb.setXf(X + bu, Z + bv, ang, y);
    const rq = (a, b, c, d, h, t, w0, w1) => { gb.tint = t.map((q, k) => q * lit[k]); gb.quad4('tGrass', a, b, c, d, [a[0] / 3, w0 / 3], [b[0] / 3, w0 / 3], [c[0] / 3, w1 / 3], [d[0] / 3, w1 / 3], h); gb.tint = null; };
    for (const [a, b, hc] of segs) { const pf = [[z0, -0.1], [z0 + 0.8, hc], [z0 + 3.2, hc - 0.2], [z0 + zo, yo]], P = (q, end) => [end ? (b === null ? pf[q][0] : b) : (a === null ? -pf[q][0] : a), pf[q][1], pf[q][0]];
      for (const [q, h, t, w0, w1] of [[0, [0, 0.3, -1], TURFD, 0, 2.4], [1, [0, 1, 0], TURF2, 2.4, 4.9], [2, [0, 0.8, 1], TURF, 4.9, 10.4]]) rq(P(q, 0), P(q, 1), P(q + 1, 1), P(q + 1, 0), h, t, w0, w1);
      for (const [end, v] of [[0, a], [1, b]]) if (v !== null && hc > 1) { gb.tint = [0.5, 0.42, 0.36]; gb.quad4('brick', P(0, end), P(1, end), P(2, end), P(3, end), [0, 0], [0.4, 0.9], [1.4, 0.9], [3, 0], [end ? 1 : -1, 0, 0]); gb.tint = null; }
      addOCol(area, f, a === null ? -z0 - 4 : a, z0 + 0.2, b === null ? z0 + 4 : b, z0 + 4, -2, hc < 1 ? Math.max(hc, 1.2) : hc); }
    gb.xf = null; return f; };
  // the arm at the east end of the sea front (the west end runs into deep water): level gravel behind a pier head of masonry, and a low battery behind a bank of turf
  for (const sg of [1]) { const xs = (a, b) => [Math.min(sg * a, sg * b), Math.max(sg * a, sg * b)], y = F.CW + 0.1, [x0, x1] = xs(FORT_ARM, 120.5), q = (u, v) => [(X + u) / 3, (Z + v) / 3];
    const WA = [[-FORT_ARM, 92.6], [-124.5, 85.2]]; // (the west arm's quay runs back along its rocky shore, where the east one goes straight out)
    if (sg > 0) { gb.quad4('gravelN', W3(x0, y, 64), W3(x1, y, 64), W3(x1, y, 92), W3(x0, y, 92), q(x0, 64), q(x1, 64), q(x1, 92), q(x0, 92), [0, 1, 0]); addCol(area, X + x0, Z + 64, X + x1, Z + 92, y - 1.2, y); }
    else { const A = [-120.5, 64], B = [-FORT_ARM, 64], C = [-FORT_ARM, 92], D = [-120.5, 87.1]; gb.quad4('gravelN', W3(A[0], y, A[1]), W3(B[0], y, B[1]), W3(C[0], y, C[1]), W3(D[0], y, D[1]), q(...A), q(...B), q(...C), q(...D), [0, 1, 0]); addCol(area, X - 120.5, Z + 64, X - FORT_ARM, Z + 88, y - 1.2, y);
      const [[ax, az], [bx, bz]] = WA, L = Math.hypot(bx - ax, bz - az), ang = Math.atan2(bx - ax, bz - az), f = gb.setXf(X + (ax + bx) / 2, Z + (az + bz) / 2, ang, 0); gb.tint = WET; gb.box(-0.7, -2.6, -L / 2 - 0.6, 0.7, 0.3, L / 2 + 0.6, { side: 'stone', top: null }, 2.4, 2.4); gb.tint = null; gb.box(-0.7, 0.3, -L / 2 - 0.6, 0.7, F.CW + 0.75, L / 2 + 0.6, { side: 'stone', top: null }, 2.4, 2.4); gb.box(-0.8, F.CW + 0.75, -L / 2 - 0.7, 0.8, F.CW + 1.0, L / 2 + 0.7, 'ashlar', 2, 2); addOCol(area, f, -0.7, -L / 2 - 0.6, 0.7, L / 2 + 0.6, -3, F.CW + 1.0); gb.xf = null; }
    for (const [a, b, c, d] of (sg > 0 ? [[sg > 0 ? FORT_ARM - 0.9 : -FORT_ARM - 0.5, 67.5, sg > 0 ? FORT_ARM + 0.5 : -FORT_ARM + 0.9, 92.9], [Math.min(sg * FORT_ARM, sg * 123), 91.6, Math.max(sg * FORT_ARM, sg * 123), 92.9], [Math.min(sg * 121.7, sg * 123), 82, Math.max(sg * 121.7, sg * 123), 92]] : [[-FORT_ARM - 0.5, 67.5, -FORT_ARM + 0.9, 92.9]])) { gb.tint = WET; gb.box(X + a, -2.6, Z + b, X + c, 0.3, Z + d, { side: 'stone', top: null }, 2.4, 2.4); gb.tint = null; gb.box(X + a, 0.3, Z + b, X + c, F.CW + 0.75, Z + d, { side: 'stone', top: null }, 2.4, 2.4); gb.box(X + a - 0.1, F.CW + 0.75, Z + b - 0.1, X + c + 0.1, F.CW + 1.0, Z + d + 0.1, 'ashlar', 2, 2); addCol(area, X + a, Z + b, X + c, Z + d, -3, F.CW + 1.0); }
    const hx = sg * FORT_ARM; if (sg > 0) { gb.cyl('stone', X + hx, Z + 92, 2.6, -2.6, F.CW + 1.2, 14, 2.4, 2.4, { top: 'stone' }); gb.cyl('ashlar', X + hx, Z + 92, 2.75, F.CW + 1.2, F.CW + 1.45, 14, 2, 2, { top: 'ashlar' }); colO(hx, 92, 0, 2.3, 2.3, -3, F.CW + 1.45); }
    else { gb.setXf(X + hx - 0.6, Z + 92.4, 0.42, 0); gb.box(-2.9, -2.6, -2.9, 2.9, F.CW + 1.2, 2.9, { side: 'stone', top: 'stone' }, 2.4, 2.4); gb.box(-3.05, F.CW + 1.2, -3.05, 3.05, F.CW + 1.45, 3.05, 'ashlar', 2, 2); gb.xf = null; colO(hx - 0.6, 92.4, 0.42, 2.9, 2.9, -3, F.CW + 1.45); } // (a square head on the west, set square to its quay)
    const gs = [127.5, 134.5, 141.5, 148.5], bm = 138, hb = 16, lo = -hb, hi = hb, xl = gs.map(g => sg * g - sg * bm).sort((a, b) => a - b), seg = []; let x = lo; for (const c of xl) { seg.push([x, c - 1.0, 1.75], [c - 1.0, c + 1.0, 0.6]); x = c + 1.0; } seg.push([x, hi, 1.75]); // (four guns on the east side, two and a guardhouse on the west)
    turfBank(sg * bm, 79, 0, F.CW, 0, seg, [1.25, 1.15, 1.2], 6.6, -0.6);
    for (const e of [-1, 1]) { const ex = sg * bm + e * hb, tp = W3(ex + e * 4.5, H(X + ex + e * 4.5, Z + 82) - 0.15, 82.2), P = [W3(ex, F.CW - 0.1, 79), W3(ex, F.CW + 1.75, 79.8), W3(ex, F.CW + 1.55, 82.2), W3(ex, F.CW - 0.6, 85.6)]; if (e * sg < 0) continue; for (let k = 0; k < 3; k++) { gb.tint = [0.8, 0.86, 0.52]; gb.tri('tGrass', P[k], P[k + 1], tp, [P[k][2] / 3, 0], [P[k + 1][2] / 3, 0], [P[k][2] / 3, 1.5], [e, 0.9, k - 1]); gb.tint = null; } } // (its far end runs out to the ground)
    { const [g0, g1] = xs(120.5, sg > 0 ? 154 : 143); gb.quad4('gravelN', W3(g0, y, 70), W3(g1, y, 70), W3(g1, y, 79.2), W3(g0, y, 79.2), q(g0, 70), q(g1, 70), q(g1, 79.2), q(g0, 79.2), [0, 1, 0]); addCol(area, X + g0, Z + 70, X + g1, Z + 79.2, y - 1.2, y); }
    for (const gu of gs) { gb.setXf(X + sg * gu, Z + 75.6, 0, F.CW + 0.1); gb.box(-1.6, -0.5, -2.4, 1.6, 0.14, 3.3, { side: 'woodDark', top: 'wood' }, 1, 1); gb.xf = null; gun(sg * gu, 77.4, 0, F.CW + 0.24); shot(sg * gu + 2.4, 75, F.CW + 0.1); }
    gb.setXf(X + sg * 113.8, Z + 84.6, 0, F.CW + 0.1); gb.box(-1.7, -0.5, -2.6, 1.7, 0.16, 3.3, { side: 'woodDark', top: 'wood' }, 1, 1); gb.xf = null; gun(sg * 113.8, 86.2, 0, F.CW + 0.26); shot(sg * 113.8 + 2.4, 82.6, F.CW + 0.1);
    if (sg < 0) { const f = gb.setXf(X - 139, Z + 64, 0.12, F.CW); gb.box(-3.1, -0.8, -2.3, 3.1, 0.4, 2.3, { side: 'stone', top: 'stone' }, 2, 2); gb.tint = BRICK; gb.box(-3, 0.4, -2.2, 3, 3.1, 2.2, { side: 'brick', top: null }, 2.4, 2.4); gb.tint = null; hallRoof(gb, 'roofRed', -3.5, -2.7, 3.5, 2.7, 3.1, 2.2); gb.quad('doorD', [-0.6, 0.2, 2.24], [1, 0, 0], [0, 1, 0], 1.2, 2.1, 1, 1, { fixedUV: true }); for (const wx of [-2.2, 1.3]) gb.quad('sashS', [wx, 1.1, 2.23], [1, 0, 0], [0, 1, 0], 0.9, 1.1, 1, 1, { fixedUV: true }); addOCol(area, f, -3, -2.2, 3, 2.2, -1, 4.5); gb.xf = null; } }
  // the ravelin's floor between its gate and the bridge, and the way over the covered way
  drapeStrip(gb, 'gravelN', [[X + FT.F2[0], Z + FT.F2[1]], [X + FT.Gm[0] + 4, Z + FT.Gm[1] - 5], [X, Z + FT.Gm[1] - 2.5]], 3.6, { lift: 0.14 });
  drapeStrip(gb, 'gravelN', [[X + FT.B1o[0], Z + FT.B1o[1]], [X + FT.R0[0], Z + FT.R0[1]]], 4.2, { lift: 0.14 });
  { const d = v3norm([7, 0, -24]), at = t => [X + FT.R0[0] + d[0] * t, Z + FT.R0[1] + d[2] * t]; drapeStrip(gb, 'gravelN', [at(-3.5), at(0), at(3), at(6)], 6, { lift: 0.12 }); }

  /* ---------------- water: one sheet over the moat and the fixed coast round the point (the ground hides it where it is dry) ---------------- */
  { const g = gb.grp('water'), y = F.WL, base = g.p.length / 3, N = 32, R = 950; g.p.push(X, y, Z); g.u.push(X / 6, Z / 6); g.c.push(1.16, 1.18, 1.16);
    for (let k = 0; k <= N; k++) { const a = k / N * 2 * Math.PI, x = X + Math.cos(a) * R, z = Z + Math.sin(a) * R; g.p.push(x, y, z); g.u.push(x / 6, z / 6); g.c.push(1.16, 1.18, 1.16); if (k) g.i.push(base, base + k + 1, base + k); } }

  /* ---------------- the parade and what stands round it ---------------- */
  gb.light = savedLight;
  { const pts = FT.PAR.pts, y = F.YP + 0.12; // the parade: beaten gravel, flat
    for (let i = 0; i < 5; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 5]; gb.tri('gravelN', W3(0, y, 0), W3(ax, y, az), W3(bx, y, bz), [X / 3, Z / 3], [(X + ax) / 3, (Z + az) / 3], [(X + bx) / 3, (Z + bz) / 3], [0, 1, 0]); }
    drapeStrip(gb, 'settsN', [[X, Z - F.PA + 0.5], [X, Z + 25]], 5, { lift: 0.2 });
    // a kerb of stone along the foot of the ramparts' inner slope (open at the ramps), the slope itself in even turf, the gun ramps gravelled
    for (let i = 0; i < 5; i++) { const [ax, az] = pts[i], [bx, bz] = pts[(i + 1) % 5], L = Math.hypot(bx - ax, bz - az) - 13; gb.setXf(X + (ax + bx) / 2, Z + (az + bz) / 2, Math.atan2(bx - ax, bz - az), F.YP); gb.box(-0.25, -0.3, -L / 2, 0.25, 0.25, L / 2, { side: 'stone', top: 'stone' }, 2, 2); gb.xf = null; }
    const top = finset(FT.PAR, -F.TAL); gb.tint = TURF;
    for (let i = 0; i < 5; i++) { const a = pts[i], b = pts[(i + 1) % 5], c = top[(i + 1) % 5], d = top[i], l2 = (p, q, t) => [lerp(p[0], q[0], t), lerp(p[1], q[1], t)], e = FT.PAR.E[i]; for (const [t0, t1] of i === 2 ? [[0.03, 0.31], [0.69, 0.97]] : [[0.03, 0.97]]) { const A = l2(a, b, t0), B = l2(a, b, t1), C = l2(d, c, t1), D = l2(d, c, t0); const M0 = l2(A, D, 0.55), M1 = l2(B, C, 0.55), ym = lerp(F.YP + 0.14, F.YR + 0.1, 0.55), wl = (t1 - t0) * e.L / 3; gb.tint = [0.66, 0.74, 0.44]; gb.quad4('tGrass', W3(A[0], F.YP + 0.14, A[1]), W3(B[0], F.YP + 0.14, B[1]), W3(M1[0], ym, M1[1]), W3(M0[0], ym, M0[1]), [0, 0], [wl, 0], [wl, 2], [0, 2], [-e.nx, 1.2, -e.nz]); gb.tint = [0.86, 0.9, 0.53]; gb.quad4('tGrass', W3(M0[0], ym, M0[1]), W3(M1[0], ym, M1[1]), W3(C[0], F.YR + 0.1, C[1]), W3(D[0], F.YR + 0.1, D[1]), [0, 2], [wl, 2], [wl, 3.6], [0, 3.6], [-e.nx, 1.2, -e.nz]); } }
    gb.tint = null;
    for (const k of FORT_RAMPS) { const [bx, bz] = FT.BP[k], P2 = r => [X + bx / F.R * r, Z + bz / F.R * r]; drapeStrip(gb, 'gravelN', resampleEven([P2(46), P2(72)], 2), 4.4, { lift: 0.16 }); drapeStrip(gb, 'gravelN', resampleEven([P2(72), P2(k === 0 ? 85 : 104)], 2), 2.6, { lift: 0.07 }); if (k === 0) drapeStrip(gb, 'gravelN', resampleEven([P2(91), P2(106)], 2), 2.6, { lift: 0.07 }); } }
  const side = k => { const e = FT.PAR.E[k]; return { mx: e.ax + e.dx / 2, mz: e.az + e.dz / 2, nx: e.nx, nz: e.nz, ang: Math.atan2(-e.nx, -e.nz) }; };
  const house = (cu, cvv, ang, spec, seed, y = F.YP) => { gb.setXf(X + cu, Z + cvv, ang, y); const r = makeBuilding(area, gb, new RNG(seed), spec); gb.xf = null; return r; };
  // a range in brick: a stone plinth, sash windows in pale frames in regular bays, a string course and cornice, a hipped roof with dormers and chimneys
  // (its front is +z; doors: the bays that hold one)
  const rangeB = (cu, cvv, ang, hx, hz, h, o = {}) => {
    const f = gb.setXf(X + cu, Z + cvv, ang, F.YP), rows = o.rows || [[1.15, 2.1]], bay = o.bay || 3.5, rh = o.rh || hz * 0.85;
    gb.box(-hx - 0.12, -1, -hz - 0.12, hx + 0.12, 0.75, hz + 0.12, { side: 'stone', top: 'stone' }, 2.4, 2.4); gb.tint = BRICK; gb.box(-hx, 0.75, -hz, hx, h, hz, { side: 'brick', top: null }, 2.4, 2.4); gb.tint = null;
    for (const y of o.strings || []) gb.box(-hx - 0.1, y - 0.14, -hz - 0.1, hx + 0.1, y + 0.14, hz + 0.1, 'ashlar', 3, 3, { skip: 'b' });
    gb.box(-hx - 0.4, h - 0.5, -hz - 0.4, hx + 0.4, h + 0.05, hz + 0.4, { side: 'ashlar', top: 'ashlar' }, 3, 3);
    if (o.quoins) for (const qx of [-hx - 0.06, hx - 0.64]) for (const qz of [-hz - 0.06, hz - 0.64]) gb.box(qx, 0.75, qz, qx + 0.7, h - 0.5, qz + 0.7, 'ashlar', 1, 2, { skip: 'tb' });
    hallRoof(gb, o.roof || 'roofRed', -hx - 0.6, -hz - 0.6, hx + 0.6, hz + 0.6, h, rh);
    const win = (fx, fz, ux, uz, nx, nz, y, w, hh) => { const b = (a0, a1, y0, y1) => { const p = [fx + ux * a0 + nx * 0.02, fz + uz * a0 + nz * 0.02], q = [fx + ux * a1 + nx * 0.1, fz + uz * a1 + nz * 0.1]; gb.box(Math.min(p[0], q[0]), y0, Math.min(p[1], q[1]), Math.max(p[0], q[0]), y1, Math.max(p[1], q[1]), 'ashlar', 1, 1); };
      b(-w / 2 - 0.2, w / 2 + 0.2, y - 0.22, y); b(-w / 2 - 0.2, w / 2 + 0.2, y + hh, y + hh + 0.24); b(-w / 2 - 0.2, -w / 2, y, y + hh); b(w / 2, w / 2 + 0.2, y, y + hh); gb.quad(hh > 1.5 ? 'sash' : 'sashS', [fx - ux * w / 2 + nx * 0.06, y, fz - uz * w / 2 + nz * 0.06], [ux, 0, uz], [0, 1, 0], w, hh, 1, 1, { fixedUV: true }); };
    for (const [len, fx, fz, ux, uz, nx, nz, front] of [[2 * hx, -hx, hz, 1, 0, 0, 1, 1], [2 * hx, hx, -hz, -1, 0, 0, -1, 0], [2 * hz, hx, hz, 0, -1, 1, 0, 0], [2 * hz, -hx, -hz, 0, 1, -1, 0, 0]]) { const n = Math.max(1, Math.floor((len - 1) / bay)), sp = len / n;
      for (let k = 0; k < n; k++) { const t = (k + 0.5) * sp, px = fx + ux * t, pz = fz + uz * t; rows.forEach(([y, hh], ri) => { if (front && ri === 0 && (o.doors || []).includes(k)) { const b = (a0, a1, y0, y1, d) => { gb.box(px + a0, y0, hz, px + a1, y1, hz + d, 'ashlar', 1, 1); }; b(-1.1, -0.75, 0, 2.75, 0.2); b(0.75, 1.1, 0, 2.75, 0.2); b(-1.25, 1.25, 2.75, 3.1, 0.28); gb.quad(o.door || 'doorA', [px - 0.75, 0.2, hz + 0.08], [1, 0, 0], [0, 1, 0], 1.5, 2.55, 1, 1, { fixedUV: true }); gb.box(px - 1.0, -0.4, hz, px + 1.0, 0.2, hz + 0.8, { side: 'stone', top: 'stoneLight' }, 1, 1); addOCol(area, f, px - 1.0, hz, px + 1.0, hz + 0.8, -1, 0.2); }
          else win(px, pz, ux, uz, nx, nz, y, o.ww || 1.1, hh); }); } }
    for (let x = -hx + 4.5; x < hx - 3.5 && o.dormers; x += o.dormers) for (const sg of [1, -1]) { const zf = sg * (hz - 0.5), sl = rh / (hz + 0.6), zAt = y => sg * (hz + 0.6 - (y - h) / sl), y0 = h + 0.75, ye = h + 2.5, yr = h + 3.35, w = 0.85, B = (x0, y, x1, yb, d) => gb.box(x0, y, Math.min(zf, zf + sg * d), x1, yb, Math.max(zf, zf + sg * d), 'ashlar', 1, 1); // an upright dormer under its own little gable
      gb.tint = BRICK; gb.quad4('brick', [x - w, y0, zf], [x + w, y0, zf], [x + w, ye, zf], [x - w, ye, zf], [0, 0], [0.7, 0], [0.7, 0.7], [0, 0.7], [0, 0, sg]); gb.tri('brick', [x - w, ye, zf], [x + w, ye, zf], [x, yr, zf], [0, 0.7], [0.7, 0.7], [0.35, 1.05], [0, 0, sg]);
      for (const sx of [-1, 1]) { gb.tri('brick', [x + sx * w, y0, zf], [x + sx * w, ye, zf], [x + sx * w, ye, zAt(ye)], [0, 0], [0, 0.7], [0.9, 0.7], [sx, 0, 0]); gb.tint = null; gb.quad4(o.roof || 'roofRed', [x + sx * (w + 0.22), ye - 0.2, zf + sg * 0.25], [x, yr + 0.06, zf + sg * 0.25], [x, yr + 0.06, zAt(yr + 0.06)], [x + sx * (w + 0.22), ye - 0.2, zAt(ye - 0.2)], [0, 0], [0.4, 0], [0.4, 1], [0, 0.6], [sx * 0.7, 1, 0]); gb.tint = BRICK; }
      gb.tint = null; B(x - 0.62, y0 + 0.1, x + 0.62, y0 + 0.26, 0.1); B(x - 0.62, y0 + 1.5, x + 0.62, y0 + 1.68, 0.08); gb.quad('sashS', [x - sg * 0.5, y0 + 0.26, zf + sg * 0.03], [sg, 0, 0], [0, 1, 0], 1.0, 1.24, 1, 1, { fixedUV: true }); }
    for (const x of o.chim || []) { gb.tint = BRICK; gb.box(x - 0.6, h + rh * 0.4, -0.5, x + 0.6, h + rh + 1.7, 0.5, { side: 'brick', top: null }, 2, 2); gb.tint = null; gb.box(x - 0.72, h + rh + 1.7, -0.62, x + 0.72, h + rh + 1.95, 0.62, 'ashlar', 1, 1); }
    addOCol(area, f, -hx, -hz, hx, hz, -1, h + rh * 0.6); return f;
  };
  // two ranges of barracks along the west and east sides, a row of young trees before each
  for (const k of [1, 3]) { const s = side(k), d = F.PA - 2.4 - 4.8, cu = s.mx * d / F.PA, cvv = s.mz * d / F.PA, f = rangeB(cu, cvv, s.ang, 21, 4.8, 7.0, { rows: [[1.15, 1.75], [4.4, 1.75]], strings: [3.75], doors: [1, 4, 7, 10], door: k === 1 ? 'doorA' : 'doorG', dormers: 7, chim: [-15, -5, 5, 15] });
    gb.box(22.3, 0, -3.8, 23.5, 1.5, 1.8, { side: 'woodDark', top: 'wood' }, 0.6, 0.6); addOCol(area, f, 22.3, -3.8, 23.5, 1.8, -1, 1.5); // firewood stacked against the gable
    gb.xf = null; for (let t = -17.5; t <= 17.6; t += 7) { const [wx, wz] = xfP(f, t, 10.2); (S.plants || (S.plants = [])).push([(t * 2 + k) % 4 < 2 ? 'beech' : 'oak1', wx, wz, 0.5 + 0.08 * _h2(Math.round(t), k, 8290)]); } }
  // the governor's house, on the axis of the gate, looking down the parade to it: a storey more than the barracks, a doorcase and pediment in stone, a cupola on its roof
  { const GH = 9.4, rh = 4.6, f = rangeB(0, 31, Math.PI, 11, 5.2, GH, { rows: [[1.2, 2.0], [4.6, 2.0], [7.2, 1.3]], strings: [4.0], quoins: true, roof: 'roofSlate', rh, bay: 2.95, doors: [3], door: 'doorF', chim: [-6.5, 6.5] });
    gb.box(-4.0, GH - 0.3, 5.0, 4.0, GH + 0.1, 5.75, 'ashlar', 2, 2); gb.tri('ashlar', [-4.0, GH + 0.1, 5.6], [4.0, GH + 0.1, 5.6], [0, GH + 2.2, 5.6], [-1.5, 0], [1.5, 0], [0, 0.8], [0, 0, 1]); for (const sg of [-1, 1]) gb.quad4('roofSlate', [sg * 4.2, GH + 0.05, 5.7], [0, GH + 2.35, 5.7], [0, GH + 2.35, 2.2], [sg * 4.2, GH + 0.05, 2.2], [0, 0], [1.6, 0], [1.6, 1.2], [0, 1.2], [sg * 0.5, 1, 0]); // the pediment
    gb.tri('ashlar', [-1.7, 3.1, 5.5], [1.7, 3.1, 5.5], [0, 4.0, 5.5], [-0.6, 0], [0.6, 0], [0, 0.4], [0, 0, 1]);
    { const yc = GH + rh - 0.8; gb.box(-1.9, yc - 0.6, -1.9, 1.9, yc + 0.5, 1.9, 'ashlar', 2, 2); gb.tint = [1.12, 1.1, 1.04]; gb.cyl('plaster', 0, 0, 1.5, yc + 0.5, yc + 4.2, 8, 2, 2); gb.tint = null; gb.cyl('ashlar', 0, 0, 1.75, yc + 4.2, yc + 4.55, 8, 2, 2, { top: 'ashlar' }); gb.cone('roofCopper', 0, 0, 1.7, yc + 4.55, 3.4, 8, 2);
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 8, ux = Math.sin(a), uz = -Math.cos(a); gb.quad('winB', [Math.cos(a) * 1.43 - ux * 0.38, yc + 1.2, Math.sin(a) * 1.43 - uz * 0.38], [ux, 0, uz], [0, 1, 0], 0.76, 2.2, 1, 1, { fixedUV: true }); }
      gb.box(-0.1, yc + 7.8, -0.1, 0.1, yc + 9.6, 0.1, 'iron', 1, 1); gb.cyl('roofCopper', 0, 0, 0.3, yc + 8.4, yc + 8.9, 6, 1, 1, { top: 'roofCopper' }); }
    gb.xf = null; Sites.glows.push([X - 2.1, F.YP + 3.3, Z + 31 - 5.6, 2.4], [X + 2.1, F.YP + 3.3, Z + 31 - 5.6, 2.4]); }
  // the chapel by the south-west side, its bell turret at one end
  { const s = side(0), d = F.PA - 2.5 - 4.5, cu = s.mx * d / F.PA - 6, cvv = s.mz * d / F.PA - 4;
    const f = gb.setXf(X + cu, Z + cvv, s.ang, F.YP); gb.tint = [1.06, 1.04, 0.98];
    gb.box(-8.2, -1, -4.7, 8.2, 0.6, 4.7, { side: 'stone', top: 'stone' }, 2.4, 2.4); gb.box(-8, 0.6, -4.5, 8, 6.4, 4.5, { side: 'plaster', top: null }, 2, 2); gb.tint = null; gableRoof(gb, 'roofSlate', 'plaster', -8, -4.5, 8, 4.5, 6.4, 4.8, 0.45, true); addOCol(area, f, -8, -4.5, 8, 4.5, -1, 9);
    for (const sg of [-1, 1]) { for (const t of [-4.2, -0.4, 3.4, 6.4]) { if (sg > 0 && t === -0.4) continue; gb.box(t - 0.68, 1.5, sg > 0 ? 4.5 : -4.58, t + 0.68, 5.0, sg > 0 ? 4.58 : -4.5, 'ashlar', 1, 1); gb.quad('winB', [t - sg * 0.45, 1.75, sg * 4.6], [sg, 0, 0], [0, 1, 0], 0.9, 2.5, 1, 1, { fixedUV: true }); gb.tri('winB', [t - 0.45, 4.25, sg * 4.6], [t + 0.45, 4.25, sg * 4.6], [t, 4.95, sg * 4.6], [0, 0.5], [1, 0.5], [0.5, 1], [0, 0, sg]); }
      for (const t of [-2.3, 1.5, 4.9, 7.7]) gb.box(t - 0.35, -0.5, sg > 0 ? 4.5 : -5.2, t + 0.35, 4.4, sg > 0 ? 5.2 : -4.5, { side: 'stone', top: 'ashlar' }, 1.6, 1.6); }
    gb.box(-1.5, 0, 4.5, 0.7, 3.2, 4.72, 'ashlar', 1, 1); gb.quad('doorF', [-1.1, 0.1, 4.75], [1, 0, 0], [0, 1, 0], 1.4, 2.7, 1, 1, { fixedUV: true }); gb.box(-1.5, -0.6, 4.5, 0.7, 0.12, 5.4, { side: 'stone', top: 'stone' }, 1, 1);
    gb.box(-9.5, -0.6, -1.6, -6.4, 13.6, 1.6, { side: 'plaster', top: null }, 2, 2); gb.box(-9.7, 13.4, -1.8, -6.2, 13.8, 1.8, 'ashlar', 2, 2); gb.cone('roofSlate', -7.95, 0, 2.5, 13.8, 9.4, 8, 2); gb.box(-8.07, 23, -0.1, -7.83, 25.2, 0.1, 'iron', 1, 1); gb.box(-8.5, 24.2, -0.1, -7.4, 24.4, 0.1, 'iron', 1, 1);
    for (const sx of [-9.53, -6.37]) gb.quad('winB', [sx, 10.4, sx < -8 ? -0.5 : 0.5], [0, 0, sx < -8 ? 1 : -1], [0, 1, 0], 1.0, 2.0, 1, 1, { fixedUV: true }); for (const sg of [1, -1]) gb.quad('winB', [-7.95 - sg * 0.5, 10.4, sg * 1.63], [sg, 0, 0], [0, 1, 0], 1.0, 2.0, 1, 1, { fixedUV: true });
    addOCol(area, f, -9.5, -1.6, -6.4, 1.6, -1, 22); gb.xf = null; }
  // the powder magazine by the south-east side: thick stone walls with buttresses, a steep roof, its own wall round it
  { const s = side(4), d = F.PA - 2.5 - 8, cu = s.mx * d / F.PA + 5, cvv = s.mz * d / F.PA - 3, f = gb.setXf(X + cu, Z + cvv, s.ang, F.YP), col = (a, b, c, e, g, h) => addOCol(area, f, a, b, c, e, g, h);
    gb.box(-6, -0.6, -3.6, 6, 4.2, 3.6, { side: 'stone', top: null }, 2.4, 2.4); hipRoof(gb, 'roofSlate', -6.4, -4.0, 6.4, 4.0, 4.2, 4.0, 0); col(-6, -3.6, 6, 3.6, -1, 6.5);
    for (const t of [-4.2, -1.8, 1.8, 4.2]) for (const sg of [-1, 1]) { gb.box(t - 0.45, -0.6, sg > 0 ? 3.6 : -4.5, t + 0.45, 3.2, sg > 0 ? 4.5 : -3.6, 'stone', 1.5, 1.5); }
    gb.box(-1.0, -0.6, 3.6, 1.0, 2.7, 3.8, 'ashlar', 1, 1); gb.quad('doorDark', [-0.7, 0.05, 3.82], [1, 0, 0], [0, 1, 0], 1.4, 2.3, 1, 1, { fixedUV: true });
    for (const [a, b, c, e] of [[-9, -6.5, 9, -6.0], [-9, 6.0, -1.5, 6.5], [1.5, 6.0, 9, 6.5], [-9, -6.5, -8.5, 6.5], [8.5, -6.5, 9, 6.5]]) { gb.box(a, -0.6, b, c, 2.6, e, { side: 'brick', top: 'stone' }, 2.4, 2.4); col(a, b, c, e, -1, 2.6); }
    gb.xf = null; }
  // the main guard and the store either side of the gate's inner mouth
  for (const sg of [-1, 1]) { rangeB(sg * 21.2, -F.PA + 2.4 + 3.6, 0, 6.4, 3.6, 4.0, { rows: [[1.15, 1.75]], doors: [1], door: 'doorD', chim: [sg * 3.5], bay: 3.2 }); gb.xf = null; }
  // the well, off the axis: a round stone head, a windlass on two posts, a trough beside it
  { const wu = -15, wv = -6, y = F.YP; gb.cyl('stone', X + wu, Z + wv, 1.3, y - 0.4, y + 0.85, 12, 2, 2, { top: 'iron' }); for (const a of [-1.2, 1.2]) gb.box(X + wu + a - 0.12, y + 0.85, Z + wv - 0.12, X + wu + a + 0.12, y + 2.4, Z + wv + 0.12, 'woodDark', 1, 1);
    gb.box(X + wu - 1.25, y + 2.0, Z + wv - 0.14, X + wu + 1.25, y + 2.28, Z + wv + 0.14, 'wood', 1, 1); colO(wu, wv, 0, 1.3, 1.3, y - 1, y + 0.85);
    gb.box(X + wu + 2.2, y - 0.2, Z + wv - 0.5, X + wu + 4.6, y + 0.6, Z + wv + 0.5, { side: 'stone', top: 'water' }, 1, 1); colO(wu + 3.4, wv, 0, 1.2, 0.5, y - 1, y + 0.6); }

  // an expense magazine at the sea bastion's gorge; timber stacked on the parade
  { const f = gb.setXf(X + 11, Z + 79, -0.25, F.YR); gb.box(-2.6, -0.6, -2, 2.6, 2.7, 2, { side: 'stone', top: null }, 2.4, 2.4); gableRoof(gb, 'roofSlate', 'stone', -2.6, -2, 2.6, 2, 2.7, 2.0, 0.35, true); gb.quad('doorDark', [0.6, 0.05, -2.03], [-1, 0, 0], [0, 1, 0], 1.2, 2.0, 1, 1, { fixedUV: true }); addOCol(area, f, -2.6, -2, 2.6, 2, -1, 4); gb.xf = null; }
  for (const [tu, tv, n] of [[-20, 14, 4], [-21, 18, 3]]) { const f = gb.setXf(X + tu, Z + tv, 0.35, F.YP); for (let q = 0; q < n; q++) gb.box(-3.2, q * 0.34, -0.9 + q * 0.08, 3.2, q * 0.34 + 0.3, 0.9 - q * 0.08, { side: 'wood', top: 'wood' }, 1, 1); addOCol(area, f, -3.2, -0.9, 3.2, 0.9, -1, n * 0.34); gb.xf = null; }

  /* ---------------- the windmill on the north-east bastion, the flag on the sea bastion, the guns ---------------- */
  { const [bx, bz] = FT.BP[3], mu = bx * 0.7, mv = bz * 0.7, y = F.YR, a = Math.atan2(-0.34, -0.94); // (its sails turned a little west of north, to the road and the hill)
    gb.tint = [1.12, 1.1, 1.02]; gb.cyl('plaster', X + mu, Z + mv, 4.0, y - 1, y + 12.5, 12, 3, 3); gb.tint = null; gb.cyl('woodDark', X + mu, Z + mv, 4.4, y + 12.5, y + 13.1, 12, 2, 2); gb.cone('roofThatch', X + mu, Z + mv, 4.4, y + 13.1, 4.2, 12, 3);
    gb.quad('door', [X + mu - 0.7 * Math.cos(a + Math.PI) + 4.05 * Math.sin(a + Math.PI), y, Z + mv + 0.7 * Math.sin(a + Math.PI) + 4.05 * Math.cos(a + Math.PI)], [Math.cos(a + Math.PI), 0, -Math.sin(a + Math.PI)], [0, 1, 0], 1.4, 2.3, 1, 1, { fixedUV: true });
    for (const wy of [4.5, 8.5]) gb.quad('winB', [X + mu - 0.35 * Math.cos(a + 1.6) + 4.03 * Math.sin(a + 1.6), y + wy, Z + mv + 0.35 * Math.sin(a + 1.6) + 4.03 * Math.cos(a + 1.6)], [Math.cos(a + 1.6), 0, -Math.sin(a + 1.6)], [0, 1, 0], 0.7, 1.0, 1, 1, { fixedUV: true });
    const hx = X + mu + Math.sin(a) * 4.8, hz = Z + mv + Math.cos(a) * 4.8, hy = y + 13.2, ux = Math.cos(a), uz = -Math.sin(a), fn = [Math.sin(a), 0, Math.cos(a)], bn = [-fn[0], 0, -fn[2]];
    gb.box(hx - 0.35, hy - 0.35, hz - 0.35, hx + 0.35, hy + 0.35, hz + 0.35, 'woodDark', 1, 1);
    for (let k = 0; k < 4; k++) { const sa = k * Math.PI / 2 + 0.5, c = Math.cos(sa), s = Math.sin(sa), Pq = (r, o, d = 0) => [hx + ux * (c * r - s * o) + fn[0] * d, hy + s * r + c * o, hz + uz * (c * r - s * o) + fn[2] * d];
      for (const [h, d] of [[fn, 0.03], [bn, -0.03]]) { gb.tint = [0.96, 0.93, 0.84]; gb.quad4('sail', Pq(1.4, 0.3, d), Pq(10.8, 0.3, d), Pq(10.8, 2.8, d), Pq(1.4, 2.8, d), [0, 0], [1, 0], [1, 1], [0, 1], h); gb.tint = null; }
      for (const [h, d] of [[fn, 0.12], [bn, -0.12]]) gb.quad4('woodDark', Pq(0, -0.4, d), Pq(11.3, -0.4, d), Pq(11.3, 0.4, d), Pq(0, 0.4, d), [0, 0], [1, 0], [1, 0.1], [0, 0.1], h);
 } // the stocks, seen from either side
    colO(mu, mv, 0, 4.0, 4.0, y - 2, y + 17); }
  // the cavalier on the north-west bastion, raised over the rampart so its guns can answer the hill: brick walls, a gravel top behind a turf parapet, a ramp up its back
  { const [bx, bz] = FT.BP[2], ca = Math.atan2(bx, bz), cu = bx * 0.72, cvv = bz * 0.72, y = F.YR, hT = 2.4, xf = makeXf(X + cu, Z + cvv, ca), at = (lx, lz) => { const [wx, wz] = xfP(xf, lx, lz); return [wx - X, wz - Z]; }, f = gb.setXf(X + cu, Z + cvv, ca, y);
    gb.tint = BRICK; gb.box(-7, -0.6, -4.5, 7, hT - 0.2, 4.5, { side: 'brick', top: null }, 2.4, 2.4); gb.tint = null; gb.box(-7.15, hT - 0.3, -4.65, 7.15, hT, 4.65, { side: 'ashlar', top: null }, 2, 2); gb.quad('gravelN', [-7, hT + 0.02, 4.5], [1, 0, 0], [0, 0, -1], 14, 9, 3, 3); addOCol(area, f, -7, -4.5, 7, 4.5, -1, hT + 0.02);
    const mer = (a, b, z0, z1) => { gb.tint = TURF; gb.box(a, hT, z0, b, hT + 1.15, z1, { side: 'tGrass', top: null }, 3, 3); gb.tint = TURF2; gb.quad('tGrass', [a, hT + 1.15, z1], [1, 0, 0], [0, 0, -1], b - a, z1 - z0, 3, 3); gb.tint = null; addOCol(area, f, a, z0, b, z1, hT - 0.5, hT + 1.15); };
    for (const [a, b] of [[-7, -5.0], [-3.2, -0.9], [0.9, 3.2], [5.0, 7]]) mer(a, b, 2.4, 4.5); for (const sg of [-1, 1]) mer(Math.min(sg * 7, sg * 5.6), Math.max(sg * 7, sg * 5.6), -2.6, 2.4);
    for (const gx of [-4.1, 0, 4.1]) { gb.box(gx - 0.9, hT, 2.4, gx + 0.9, hT + 0.45, 4.5, { side: 'tGrass', top: 'tGrass' }, 3, 3); addOCol(area, f, gx - 0.9, 2.4, gx + 0.9, 4.5, hT - 0.5, hT + 1.1); }
    gb.quad4('gravelN', [-1.9, hT + 0.02, -4.5], [1.9, hT + 0.02, -4.5], [1.9, 0.06, -10.5], [-1.9, 0.06, -10.5], [0, 2], [1.3, 2], [1.3, 0], [0, 0], [0, 1, -0.4]); for (const sg of [-1, 1]) { gb.tint = BRICK; gb.tri('brick', [sg * 1.9, hT, -4.5], [sg * 1.9, -0.1, -4.5], [sg * 1.9, 0, -10.5], [0, 1], [0, 0], [2.5, 0], [sg, 0, 0]); gb.tint = null; } for (let q = 0; q < 8; q++) addOCol(area, f, -1.9, -10.5 + q * 0.75, 1.9, -4.4, -1, 0.06 + (q + 1) * (hT - 0.04) / 8);
    gb.xf = null; for (const gx of [-4.1, 0, 4.1]) gun(...at(gx, 1.5), ca, y + hT + 0.04); shot(...at(-2, -1.5), y + hT); }
  // the flagstaff, back from the sea bastion's point: a stout mast on a stone base, a topmast, a crosstree (no stays: they would dissolve at any distance)
  { const cx = X, cz = Z + 88, y = F.YR; gb.cyl('woodDark', cx, cz, 0.5, y - 0.5, y + 11.6, 8, 1, 2); gb.cyl('woodDark', cx, cz, 0.38, y + 11, y + 23.5, 8, 1, 2); gb.box(cx - 1.3, y + 11.1, cz - 0.16, cx + 1.3, y + 11.45, cz + 0.16, 'woodDark', 1, 1); gb.cyl('roofCopper', cx, cz, 0.55, y + 23.5, y + 24.2, 8, 1, 1, { top: 'roofCopper' });
    gb.cyl('stone', cx, cz, 1.5, y - 0.5, y + 0.6, 10, 2, 2, { top: 'stone' }); colO(0, 88, 0, 1.5, 1.5, y - 1, y + 0.6); colO(0, 88, 0, 0.34, 0.34, y - 1, y + 12); poles.push([cx, cz, y, y + 23.6, 0.7]); S.flags = [[cx + 0.35, y + 20.8, cz, Math.PI / 2, 8.0, 5.0]]; }
  [...MW.guns, ...RW.guns].forEach(([u, v, a, y], k) => { gun(u, v, a, y + 0.06); if (k % 3 === 1) shot(u + Math.cos(a) * 1.7 - Math.sin(a) * 1.4, v - Math.sin(a) * 1.7 - Math.cos(a) * 1.4, y + 0.04); });
  // the parade's lumber: spare guns in a park by the magazine with their shot piled beside them, barrels by the store
  for (const [gu, gv] of [[14, 9], [18.5, 9], [23, 9]]) { gun(gu, gv, Math.PI, F.YP + 0.02); shot(gu + 1.5, gv - 2.6, F.YP); }
  { const br = new RNG(8160); for (let k = 0; k < 9; k++) { const bu = 29.5 + (k % 3) * 0.85 + br.range(-0.1, 0.1), bv = -36.5 + Math.floor(k / 3) * 0.85; gb.cyl('woodDark', X + bu, Z + bv, 0.36, F.YP, F.YP + 0.95, 8, 1, 1, { top: 'wood' }); }
    colO(30.35, -35.65, 0, 1.4, 1.4, F.YP - 1, F.YP + 0.95); }

  gb.tint = [0.86, 0.83, 0.78]; // the way carts take from the gate to the store and the magazine, worn paler; a cart standing, chests by the store's door, earth worn bare about the well
  for (const pts of [[[2, -44], [8, -34], [17, -30], [24, -32]], [[3, -42], [7, -20], [11, 2], [20, 16]]]) drapeStrip(gb, 'gravelN', resampleEven(smoothPath(pts, 2), 2).map(([u, v]) => [X + u, Z + v]), 2.6, { lift: 0.18 });
  gb.tint = null;
  { const f = gb.setXf(X + 13, Z - 25, 0.5, F.YP + 0.12); gb.box(-0.95, 0.7, -1.7, 0.95, 0.85, 1.7, { side: 'woodDark', top: 'wood' }, 1, 1); for (const sg of [-1, 1]) { gb.box(sg * 0.95 - 0.06, 0.85, -1.7, sg * 0.95 + 0.06, 1.35, 1.7, 'wood', 1, 1); gb.box(sg * 0.5 - 0.06, 0.7, 1.7, sg * 0.5 + 0.06, 0.82, 4.2, 'woodDark', 1, 1); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; rod([sg * 1.12, 0.68, 0], [sg * 1.12, 0.68 + Math.sin(a) * 0.62, Math.cos(a) * 0.62], 0.05, 'woodDark'); rod([sg * 1.12, 0.68 + Math.sin(a) * 0.62, Math.cos(a) * 0.62], [sg * 1.12, 0.68 + Math.sin(a + 0.785) * 0.62, Math.cos(a + 0.785) * 0.62], 0.08, 'woodDark'); } }
    for (const [bx, bz] of [[-0.4, -1.0], [0.45, -0.9], [0, 0.2]]) gb.cyl('woodDark', bx, bz, 0.38, 0.85, 1.75, 8, 1, 1, { top: 'wood' }); addOCol(area, f, -1.2, -1.7, 1.2, 1.7, -1, 1.5); gb.xf = null; }
  for (const [su, sv, w, h] of [[16.2, -35.4, 0.9, 0.7], [17.3, -35.3, 0.8, 0.8], [16.6, -35.2, 0.6, 1.3], [25.9, -35.3, 0.9, 0.75]]) { gb.box(X + su - w / 2, F.YP + (h > 1 ? 0.7 : 0), Z + sv - 0.4, X + su + w / 2, F.YP + h, Z + sv + 0.4, { side: 'wood', top: 'woodDark' }, 1, 1); if (h < 1) colO(su, sv, 0, w / 2, 0.4, F.YP - 1, F.YP + h); }
  drapePatch(gb, 'dirtN', makeXf(X - 14, Z - 6, 0.4), -3.2, -3, 3.4, 3, { cell: 3, lift: 0.15 });

  /* ---------------- the landing on the east beach: a broad stage, a shed and a crane, boats; a track to the gate; ships riding in the roadstead ---------------- */
  const shoreU = v => { let u = 170; while (u < 640 && fortNat(u, v) > -0.9) u += 0.5; return u; }, shoreV = u => { let v = 40; while (v < 200 && fortNat(u, v) > -0.9) v += 0.5; return v; };
  const boat = (u, v, y, ang) => { gb.setXf(X + u, Z + v, ang, y); gb.box(-0.8, -0.35, -2.6, 0.8, 0.05, 2.2, { side: 'woodDark', top: 'wood' }, 1, 1); for (const sg of [-1, 1]) { gb.quad4('woodDark', [sg * 0.95, -0.25, -2.7], [sg * 0.95, -0.25, 2.2], [sg * 0.98, 0.5, 2.2], [sg * 0.98, 0.5, -2.7], [0, 0], [2, 0], [2, 0.3], [0, 0.3], [sg, 0, 0]); gb.quad4('woodDark', [sg * 0.95, -0.25, 2.2], [0, -0.25, 3.6], [0, 0.6, 3.7], [sg * 0.98, 0.5, 2.2], [0, 0], [1, 0], [1, 0.3], [0, 0.3], [sg * 0.7, 0, 0.7]); }
    gb.box(-0.98, 0.42, -2.75, 0.98, 0.56, -2.6, 'woodDark', 1, 1); for (const z of [-1.3, 0.6]) gb.box(-0.9, 0.18, z, 0.9, 0.3, z + 0.35, 'wood', 1, 1); gb.xf = null; }; // (a hull with sides and a pointed bow, thwarts across it)
  const LJ = (() => { const ju = 226, jv = shoreV(ju) - 13; return [ju, jv]; })(); // (the landing's root)
  { const [ju, jv] = LJ, L = 46, y = 1.3, th = 0, f = gb.setXf(X + ju, Z + jv, th, 0), col = (a, b, c, d, e, g) => addOCol(area, f, a, b, c, d, e, g), lw = (lx, lz) => { const [wx, wz] = xfP(f, lx, lz); return [wx - X, wz - Z]; };
    gb.box(-3.2, -4, -2, 3.2, y - 0.02, 20, { side: 'stone', top: 'stone' }, 2.4, 2.4); for (const sg of [-1, 1]) gb.box(sg * 3.0 - 0.3, y - 0.3, -2, sg * 3.0 + 0.3, y + 0.35, 20.2, 'ashlar', 2, 2); col(-3.2, -2, 3.2, 20, -4, y); // (a stone quay as far as the deeper water)
    gb.box(-2.5, y - 0.6, 19, 2.5, y, L, { side: 'woodDark', top: 'wood' }, 2, 2); col(-2.5, 19, 2.5, L, y - 1.5, y); gb.box(-4.2, y - 0.45, L - 9, 4.2, y, L, { side: 'woodDark', top: 'wood' }, 2, 2); col(-4.2, L - 9, 4.2, L, y - 1.5, y);
    for (let t = 22; t <= L; t += 4) for (const sx of [-2.4, 2.4]) gb.box(sx - 0.22, -4, t - 0.22, sx + 0.22, y + (Math.round(t) % 3 ? 0.9 : 0.1), t + 0.22, 'woodDark', 1, 1);
    { const cz = L - 3; gb.box(-3.7, y, cz - 0.25, -3.2, y + 5.2, cz + 0.25, 'woodDark', 1, 1); rod([-3.45, y + 1.4, cz], [-6.2, y + 5.8, cz], 0.16, 'woodDark'); rod([-3.45, y + 5.1, cz], [-6.2, y + 5.8, cz], 0.07, 'woodDark'); rod([-6.2, y + 5.7, cz], [-6.2, y + 1.6, cz], 0.04); col(-3.8, cz - 0.3, -3.1, cz + 0.3, y, y + 5); } // the crane
    for (const [bx, bz] of [[1.4, L - 6], [2.0, L - 5.1], [1.1, L - 5.0], [2.9, L - 2.2]]) gb.cyl('woodDark', bx, bz, 0.4, y, y + 1.0, 8, 1, 1, { top: 'wood' });
    for (const [bx, bz] of [[-1.5, 7], [-0.6, 7.2]]) gb.box(bx - 0.4, y, bz - 0.4, bx + 0.4, y + 0.8, bz + 0.4, { side: 'wood', top: 'wood' }, 1, 1);
    gb.xf = null; for (const [lx, lz, da] of [[-4.6, 31, 0.06], [6.2, 39, -0.05], [4.4, 24, 0.03]]) boat(...lw(lx, lz), -0.75, th + da);
    // the shed at its head, and the track from it round the foot of the glacis to the road
    const [hu, hv] = lw(9, -9), hy = Math.min(H(X + hu - 3, Z + hv), H(X + hu + 3, Z + hv), H(X + hu, Z + hv - 4), H(X + hu, Z + hv + 4)) - 0.1; house(hu, hv, th, { fp: { x0: -4.5, z0: -2.8, x1: 4.5, z1: 2.8 }, stories: 1, style: 'timber2', roof: 'gable', roofKey: 'roofBrown', doorT: 0.5, found: 0.8, chimney: 0, winRate: 0.3 }, 8230, hy);
    drapeStrip(gb, 'dirtN', resampleEven(smoothPath([lw(0, 1), lw(-1, -12), [216, 62], [206, 34], [197, 4], [189, -38], [178, -78], [170, -106], [150, -126], [138, -152], [112, -160], [94, -178], [76, -176], [FORT_ROAD[1][0] + 2, FORT_ROAD[1][1]]], 1).map(([u, v]) => [X + u, Z + v]), 3), 2.8, { lift: 0.1 }); }
  // gorse and thorn scattered over the far part of the foreland, in clumps
  { const pr = new RNG(8330), pl = S.plants || (S.plants = []); for (let t = 0, k = 0; t < 3000 && k < 26; t++) { const u = pr.range(240, 520), v = pr.range(-200, 90), r = Math.hypot(u, v); if (r < 335 || fortNat(u, v) < 1.6 || fortLagoon(u, v) < 1.6 || Math.hypot(u - LJ[0], v - LJ[1]) < 30) continue; for (let q = 0, n = pr.int ? 2 + pr.int(0, 3) : 3; q < n; q++) pl.push([pr.pick(['bush', 'bushB', 'bush', 'thorn']), X + u + pr.range(-4, 4), Z + v + pr.range(-4, 4), pr.range(0.7, 1.1)]); k++; } }
  // the trodden path along the west covered way
  { const L4 = fortLevel(4, fortDC), runs = []; let cur = null; for (const q of L4) { if (!(q[0] < -50 && q[1] > -92 && q[1] < 46)) { cur = null; continue; } if (!cur) runs.push(cur = []); cur.push(q); }
    for (const r of runs) if (r.length > 4) drapeStrip(gb, 'dirtN', resampleEven(r, 2).map(([u, v]) => [X + u, Z + v]), 2.0, { lift: 0.09 }); }
  // reeds and rushes round the lagoon, in stands
  { const pr = new RNG(8320), pl = S.plants || (S.plants = []); for (let t = 0, k = 0; t < 6000 && k < 34; t++) { const u = pr.range(240, 400), v = pr.range(0, 100), l = fortLagoon(u, v); if (l < 0.95 || l > 1.15) continue; for (let q = 0; q < 14; q++) { const uu = u + pr.range(-5, 5), vv = v + pr.range(-3.5, 3.5), ll = fortLagoon(uu, vv); if (ll < 0.86 || ll > 1.3) continue; pl.push([ll < 1.12 ? 'reeds' : pr.chance(0.5) ? 'rush' : 'tgrass', X + uu, Z + vv, pr.range(0.85, 1.25)]); } k++; } } // (in stands, not one by one)
  // fishermen's cottages above the same beach, each with its walled garden; boats drawn up, racks of drying fish
  [[-104, 0.1, 'stone'], [-131, -0.08, 'plaster'], [-158, 0.15, 'stone']].forEach(([v, da, style], k) => { const u = shoreU(v) - 30, ang = Math.PI / 2 + da, y = Math.min(H(X + u - 4, Z + v - 5), H(X + u + 4, Z + v + 5), H(X + u + 4, Z + v - 5), H(X + u - 4, Z + v + 5)) - 0.1;
    house(u, v, ang, { fp: { x0: -4.6, z0: -3.1, x1: 4.6, z1: 3.1 }, stories: 1, style, roof: 'gable', roofKey: 'roofThatch', doorT: 0.5, found: 0.9, chimney: 1, wealth: 0.6 }, 8240 + k, y);
    const xf = makeXf(X + u, Z + v, ang); drapePatch(gb, k === 1 ? 'fGreens' : 'fPlowed', xf, -5.5, -14, 5.5, -4.4, { cell: 3, lift: 0.06, uvFrame: true });
    for (const [ax, az, bx, bz] of [[-6, -4.4, -6, -14.5], [-6, -14.5, 6, -14.5], [6, -14.5, 6, -4.4]]) { const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 3); for (let q = 0; q < n; q++) { const [px, pz] = xfP(xf, lerp(ax, bx, (q + 0.5) / n), lerp(az, bz, (q + 0.5) / n)), sl = Math.hypot(bx - ax, bz - az) / n, wa = ang + Math.atan2(bx - ax, bz - az), wy = H(px, pz) - 0.3; gb.setXf(px, pz, wa, wy); gb.box(-0.25, 0, -sl / 2 - 0.05, 0.25, 1.2, sl / 2 + 0.05, { side: 'stone', top: 'stone' }, 2, 2); gb.xf = null; siteCol(area, px, pz, wa, 0.25, sl / 2, wy - 1, wy + 1.2); } }
    boat(shoreU(v) - 7, v + 7, H(X + shoreU(v) - 7, Z + v + 7) + 0.25, 1.4 + k * 0.5); { const ru = u + 10, ry = H(X + ru, Z + v - 6); for (const z of [-9, -3]) gb.box(X + ru - 0.1, ry - 0.3, Z + v + z - 0.1, X + ru + 0.1, ry + 1.9, Z + v + z + 0.1, 'woodDark', 1, 1); for (const h of [1.1, 1.75]) gb.box(X + ru - 0.07, ry + h, Z + v - 9, X + ru + 0.07, ry + h + 0.14, Z + v - 3, 'wood', 1, 1); } });
  // ships at anchor off the sea front
  for (const [u, v, ang, k] of [[150, 262, 0.5, 1.5], [-176, 208, -0.35, 1.25], [470, 150, 1.15, 1.35], [40, 330, 2.0, 1.6]]) { gb.setXf(X + u, Z + v, ang, -0.9);
    // the hull, station by station from the stern: where (at the water, at the rail), half its breadth (at the water, at the rail), the rail's height
    const st = [[-11.2, -13.2, 1.7, 2.1, 6.2], [-7.6, -8.2, 2.7, 2.7, 5.1], [-7.5, -8.1, 2.7, 2.8, 4.0], [-2, -2, 3.0, 3.0, 3.1], [5, 5.2, 2.9, 3.0, 3.1], [8.4, 9, 2.2, 2.7, 3.5], [8.5, 9.1, 2.2, 2.7, 4.4], [11, 12.4, 1.1, 1.9, 4.8], [12.6, 15.0, 0.1, 0.35, 5.4]].map(q => q.map(w => w * k));
    const band = (key, fa, fb, out, t) => { gb.tint = t; for (let q = 1; q < st.length; q++) for (const sg of [-1, 1]) { const P = (i, f) => { const [zw, zr, bw, br, yr] = st[i], b = lerp(bw, br, f) + out; return [sg * b, lerp(-1.4, yr, f), lerp(zw, zr, f)]; }; gb.quad4(key, P(q - 1, fa), P(q, fa), P(q, fb), P(q - 1, fb), [P(q - 1, 0)[2] / 2, fa * 2.4], [P(q, 0)[2] / 2, fa * 2.4], [P(q, 0)[2] / 2, fb * 2.4], [P(q - 1, 0)[2] / 2, fb * 2.4], [sg, 0.05, 0]); } gb.tint = null; };
    band('woodDark', 0, 1, 0, null); // its planking; the gundeck's strake is paler
    for (const sg of [-1, 1]) for (let q = 1; q < st.length - 1; q++) { const a = st[q - 1], b = st[q], yl = z => (1.25 + 0.006 * (z / k) ** 2) * k, P = (s0, y) => { const f = (y + 1.4) / (s0[4] + 1.4); return [sg * (lerp(s0[2], s0[3], f) + 0.07), y, lerp(s0[0], s0[1], f)]; }, ya = yl(a[0]), yb = yl(b[0]); if (b[0] - a[0] < 0.3) continue; gb.tint = [1.25, 1.12, 0.8]; gb.quad4('wood', P(a, ya), P(b, yb), P(b, yb + 0.75 * k), P(a, ya + 0.75 * k), [a[0] / 2, 0], [b[0] / 2, 0], [b[0] / 2, 0.4], [a[0] / 2, 0.4], [sg, 0.05, 0]); gb.tint = null; }
    for (const sg of [-1, 1]) for (let z = -6; z <= 6.1; z += 2.4) { const f = 0.62, b = 2.98 * k + 0.1; gb.box(sg * b - 0.12, 1.4 * k, z * k - 0.36 * k, sg * b + 0.12, 1.95 * k, z * k + 0.36 * k, 'iron', 1, 1); }
    { const [a, b] = [st[0], st[1]]; gb.quad4('woodDark', [-a[2], -1.4, a[0]], [a[2], -1.4, a[0]], [a[3], a[4], a[1]], [-a[3], a[4], a[1]], [0, 0], [2, 0], [2, 3], [0, 3], [0, 0, -1]); gb.tint = [1.25, 1.12, 0.8]; for (const x of [-1.1, 0, 1.1]) gb.quad('sashS', [x * k + 0.35 * k, 3.6 * k, -12.75 * k], [-1, 0, 0], [0, 1, 0], 0.7 * k, 1.1 * k, 1, 1, { fixedUV: true }); gb.tint = null; } // the raked stern and its cabin windows
    for (const [q0, q1] of [[0, 1], [2, 5], [6, 8]]) for (let q = q0 + 1; q <= q1; q++) { const A = st[q - 1], B = st[q], y = Math.min(A[4], B[4]) - 0.7 * k; gb.quad4('wood', [-A[3], y, A[1]], [A[3], y, A[1]], [B[3], y, B[1]], [-B[3], y, B[1]], [0, A[1] / 2], [A[3], A[1] / 2], [B[3], B[1] / 2], [0, B[1] / 2], [0, 1, 0]); } // the decks
    for (const [a, b] of [[1, 2], [6, 5]]) gb.quad4('woodDark', [-st[a][3], st[b][4] - 0.7 * k, st[a][1]], [st[a][3], st[b][4] - 0.7 * k, st[a][1]], [st[a][3], st[a][4], st[a][1]], [-st[a][3], st[a][4], st[a][1]], [0, 0], [2, 0], [2, 1], [0, 1], [0, 0, a === 1 ? 1 : -1]); // the bulkheads of the poop and the forecastle
    for (const [z, h, w] of [[6.4, 17.5, 4.2], [-1, 21.5, 5.0], [-9, 14.5, 3.0]].map(q => q.map(x => x * k))) { gb.cyl('woodDark', 0, z, 0.34 * k, 1.5 * k, h * 0.56, 8, 1, 2); gb.cyl('woodDark', 0, z, 0.27 * k, h * 0.54, h, 8, 1, 2); gb.box(-0.8 * k, h * 0.55, z - 0.5 * k, 0.8 * k, h * 0.55 + 0.35 * k, z + 0.5 * k, 'woodDark', 1, 1); // the mast, its top
      { const [wx, wz] = xfP(makeXf(X + u, Z + v, ang), 0, z); poles.push([wx, wz, 2 * k, h - 0.6 * k, 0.5 * k]); }
      for (const f of [0.5, 0.82]) { const ww = w * (1.25 - f), cb = Math.cos(0.45), sb = Math.sin(0.45); rod([-ww * cb, h * f + 0.2 * k, z - ww * sb], [ww * cb, h * f + 0.2 * k, z + ww * sb], 0.22 * k, 'woodDark'); gb.tint = [0.95, 0.92, 0.84]; rod([-ww * 0.9 * cb, h * f - 0.35 * k, z - ww * 0.9 * sb], [ww * 0.9 * cb, h * f - 0.35 * k, z + ww * 0.9 * sb], 0.42 * k, 'sail'); gb.tint = null; } // its yards, braced round, the sails furled on them
      gb.tint = [0.7, 0.66, 0.6]; for (const sg of [-1, 1]) for (const hz of [-1, 1]) gb.tri('woodDark', [sg * 2.8 * k, 2.8 * k, z - 1.1 * k], [sg * 2.8 * k, 2.8 * k, z + 0.35 * k], [sg * 0.25 * k, h * 0.55, z], [0, 0], [1, 0], [0.5, 6], [sg * 0.3, 0, hz]); gb.tint = null; } // its shrouds
    rod([0, 4.4 * k, 13 * k], [0, 7.6 * k, 20.5 * k], 0.26 * k, 'woodDark'); gb.box(-0.26 * k, 21.4 * k, -1.26 * k, 0.26 * k, 25 * k, -0.74 * k, 'woodDark', 1, 1); { const [wx, wz] = xfP(makeXf(X + u, Z + v, ang), 0, -k); poles.push([wx, wz, 20 * k, 24 * k, 0.4 * k]); } gb.quad('bannerRed', [0, 22.6 * k, -1.2 * k], [0, 0, -1], [0, 1, 0], 3.4 * k, 1.9 * k, 1, 1, { fixedUV: true, double: true }); gb.xf = null; siteCol(area, X + u, Z + v, ang, 3 * k, 13 * k, -4, 4); }

  /* ---------------- between the fort and the hamlet: a barrier on the road, a wall and a thin line of trees beside it, hay; the redoubt on the hill ---------------- */
  { const pl = S.plants || (S.plants = []), [bu, bv] = FT.R0, dx = FORT_ROAD[1][0] - bu, dz = FORT_ROAD[1][1] - bv, dl = Math.hypot(dx, dz), px = -dz / dl, pz = dx / dl, gy = (u, v) => H(X + u, Z + v);
    { const su = bu + px * 4.4 + dx / dl * 15, sv = bv + pz * 4.4 + dz / dl * 15, y = gy(su, sv) - 0.05, f = gb.setXf(X + su, Z + sv, Math.atan2(-px, -pz), y); gb.box(-0.9, -0.4, -0.8, 0.9, 0.12, 0.8, { side: 'stone', top: 'stone' }, 1, 1); gb.box(-0.8, 0.1, -0.75, 0.8, 2.3, -0.6, 'woodDark', 1, 1); for (const sg of [-1, 1]) { gb.box(sg * 0.8 - 0.08, 0.1, -0.75, sg * 0.8 + 0.08, 2.3, 0.75, 'wood', 1, 1); gb.box(sg * 0.62 - 0.14, 0.1, 0.62, sg * 0.62 + 0.14, 2.3, 0.75, 'wood', 1, 1); } gb.box(-0.8, 1.9, 0.6, 0.8, 2.3, 0.75, 'wood', 1, 1); hipRoof(gb, 'roofSlate', -0.95, -0.9, 0.95, 0.9, 2.3, 0.9, 0.2); addOCol(area, f, -0.85, -0.8, 0.85, 0.8, -1, 3); gb.xf = null; // a sentry box
      const wu = bu - px * 3.9 + dx / dl * 16, wv = bv - pz * 3.9 + dz / dl * 16, wy = gy(wu, wv), g = gb.setXf(X + wu, Z + wv, Math.atan2(px, pz), wy), tip = [0, 1.15 + 2.7, 1.9], butt = [0, 1.15 - 0.75, -0.6]; for (const sg of [-1, 1]) gb.box(sg * 0.24 - 0.09, -0.5, -0.16, sg * 0.24 + 0.09, 1.5, 0.16, 'woodDark', 1, 1); gb.box(-0.36, 1.5, -0.2, 0.36, 1.62, 0.2, 'woodDark', 1, 1); rod(butt, tip, 0.12, 'wood'); gb.box(-0.28, 0.0, -0.95, 0.28, 0.5, -0.4, 'stone', 1, 1); addOCol(area, g, -0.4, -1.0, 0.4, 0.3, -1, 1.6); gb.xf = null; } // and the barrier, up
    // a dry-stone wall on the road's west side, oaks and beeches spaced along both
    for (let q = 5; q < 8; q++) { const [ax, az] = FORT_ROAD[q - 1], [cx, cz] = FORT_ROAD[q], L = Math.hypot(cx - ax, cz - az), nx = (cz - az) / L, nz = -(cx - ax) / L, n = Math.ceil(L / 4); for (let k = 0; k < n; k++) { const u = lerp(ax, cx, (k + 0.5) / n) + nx * 7.5 * (nx > 0 ? -1 : 1), v = lerp(az, cz, (k + 0.5) / n) + nz * 7.5 * (nx > 0 ? -1 : 1), y = gy(u, v) - 0.35, ang = Math.atan2(cx - ax, cz - az); if (k % 9 === 4) continue; gb.setXf(X + u, Z + v, ang, y); gb.box(-0.35, 0, -L / n / 2 - 0.1, 0.35, 1.35, L / n / 2 + 0.1, { side: 'stone', top: 'stone' }, 2, 2); for (const [c, e] of [[k === 0 && q === 5 || k % 9 === 5, -1], [k === n - 1 && q === 7 || k % 9 === 3, 1]]) if (c) { gb.box(-0.5, 0, e * L / n / 2 - 0.5, 0.5, 1.75, e * L / n / 2 + 0.5, { side: 'stone', top: null }, 2, 2); gb.box(-0.6, 1.75, e * L / n / 2 - 0.6, 0.6, 1.95, e * L / n / 2 + 0.6, 'ashlar', 1, 1); } gb.xf = null; // (a pier where it ends)
      siteCol(area, X + u, Z + v, ang, 0.35, L / n / 2, y - 1, y + 1.35); }
      for (let t = 8; t < L; t += 23) for (const sd of [-1, 1]) pl.push([(t * 7 + q + sd) % 3 < 1 ? 'beech' : 'oak1', X + lerp(ax, cx, t / L) + nx * 11 * sd, Z + lerp(az, cz, t / L) + nz * 11 * sd, 0.75 + 0.2 * _h2(q, Math.round(t), 8270 + sd)]); }
    for (const [u, v] of [[120, -326], [134, -350], [150, -330], [166, -352], [178, -330], [188, -352]]) { const y = gy(u, v); gb.cyl('roofThatch', X + u, Z + v, 1.9, y - 0.3, y + 1.6, 9, 2, 2); gb.cone('roofThatch', X + u, Z + v, 2.1, y + 1.6, 1.9, 9, 2); colO(u, v, 0, 1.6, 1.6, y - 1, y + 3); } // haycocks
    // the redoubt on the hill, so the commanding ground is held: a square of turfed banks in a dry ditch, guns towards the bay and the roadstead, a
    // blockhouse that shows over the banks from below, a beacon
    const [ru, rv, ry] = FORT_REDOUBT, ra = FORT_REDOUBT_A, HW = 14, rw = (lx, lz) => { const [wx, wz] = xfP(makeXf(X + ru, Z + rv, ra), lx, lz); return [wx - X, wz - Z]; };
    const HL = [1.72, 1.32, 1.5]; // (the hill's own turf, drier than the fort's)
    for (let k = 0; k < 4; k++) { const ang = ra + k * Math.PI / 2, guns = k === 0 ? [-9.4, 9.4] : k === 3 ? [-6, 6] : [], segs = []; let x = null; for (const [a, b, e] of k === 1 ? [[-2, 2, 0]] : guns.map(c => [c - 1, c + 1, 1])) { segs.push([x, a, 2.7]); if (e) segs.push([a, b, 0.85]); x = b; } segs.push([x, null, 2.7]);
      turfBank(ru, rv, ang, ry, HW, segs, HL);
      const xf = makeXf(X + ru, Z + rv, ang), at = (lx, lz) => { const [wx, wz] = xfP(xf, lx, lz); return [wx - X, wz - Z]; };
      for (const c of guns) { gb.setXf(X + ru, Z + rv, ang, ry); gb.box(c - 1.6, -0.4, HW - 5, c + 1.6, 0.14, HW - 0.1, { side: 'woodDark', top: 'wood' }, 1, 1); for (const gx of [-2.0, -1.55, 1.55, 2.0]) for (const gz of [HW + 1.4, HW + 2.4]) { gb.tint = [0.85, 0.78, 0.66]; gb.cyl('wood', c + gx, gz, 0.42, 2.4, 3.5, 7, 1, 1, { top: 'dirtN' }); gb.tint = null; } gb.xf = null; gun(...at(c, HW - 1.7), ang, ry + 0.14); shot(...at(c + 2.3, HW - 3), ry); } // gabions either side of each gun
      detail(() => { gb.setXf(X + ru, Z + rv, ang, ry); gb.tint = [0.62, 0.76, 0.95]; for (let t = -17; t <= 17.01; t += 0.85) { if (k === 1 && Math.abs(t) < 3) continue; rod([t, 0.45, HW + 4.4], [t, 0.75, HW + 6.5], 0.09, 'wood'); } }); // a row of storm poles out of the bank's face
      for (const [a, b] of k === 1 ? [[-21, -2.6], [2.6, 21]] : [[-21, 21]]) drapePatch(gb, 'dirtN', xf, a, HW + 6.3, b, HW + 8.6, { cell: 2.5, lift: 0.1 }); } // the ditch round it: bare earth
    { const f = gb.setXf(X + ru, Z + rv, ra + Math.PI / 2, ry); for (const sg of [-1, 1]) { gb.box(sg * 1.85 - 0.22, -0.6, HW + 1.2, sg * 1.85 + 0.22, 2.9, HW + 1.7, 'woodDark', 1, 1); gb.box(sg * 1.6 - 0.06, 0.1, HW - 1.0, sg * 1.6 + 0.06, 2.1, HW + 1.2, 'wood', 1, 1); } gb.box(-2.1, 2.5, HW + 1.22, 2.1, 2.9, HW + 1.68, 'woodDark', 1, 1); gb.xf = null; } // its gate
    { const [bu, bv] = rw(0, 5), f = gb.setXf(X + bu, Z + bv, ra, ry); gb.box(-3.5, -1, -3.1, 3.5, 0.5, 3.1, { side: 'stone', top: 'stone' }, 2.4, 2.4); gb.tint = BRICK; gb.box(-3.3, 0.5, -2.9, 3.3, 3.7, 2.9, { side: 'brick', top: null }, 2.4, 2.4); gb.tint = null;
      gb.box(-4.0, 3.6, -3.6, 4.0, 3.9, 3.6, 'woodDark', 1, 1); gb.box(-3.9, 3.9, -3.5, 3.9, 6.6, 3.5, { side: 'timber2', top: null }, 3, 3); hallRoof(gb, 'roofRed', -4.5, -4.1, 4.5, 4.1, 6.6, 3.2); gb.tint = BRICK; gb.box(-0.5, 8, -0.5, 0.5, 11.0, 0.5, { side: 'brick', top: 'iron' }, 2, 2); gb.tint = null;
      for (const sg of [-1, 1]) { for (const x of [-2.4, 0, 2.4]) gb.quad('winB', [x - sg * 0.35, 4.7, sg * 3.53], [sg, 0, 0], [0, 1, 0], 0.7, 0.9, 1, 1, { fixedUV: true }); for (const z of [-1.8, 1.8]) gb.quad('winB', [sg * 3.93, 4.7, z + sg * 0.35], [0, 0, -sg], [0, 1, 0], 0.7, 0.9, 1, 1, { fixedUV: true }); }
      gb.quad('doorD', [-0.6, 0.3, -2.94], [-1, 0, 0], [0, 1, 0], 1.2, 2.2, 1, 1, { fixedUV: true }); gb.quad('doorD', [3.34, 0.3, 0.6], [0, 0, -1], [0, 1, 0], 1.2, 2.2, 1, 1, { fixedUV: true }); gb.box(3.3, -0.6, -0.9, 4.1, 0.3, 0.9, { side: 'stone', top: 'stone' }, 1, 1); addOCol(area, f, -3.3, -2.9, 3.3, 2.9, -1, 8); addOCol(area, f, -3.9, -3.5, 3.9, 3.5, 3.6, 8); gb.xf = null; }
    { const [bu, bv] = rw(9, -9.5), bx = X + bu, bz = Z + bv; gb.cyl('woodDark', bx, bz, 0.3, ry - 0.5, ry + 8.2, 6, 1, 1); poles.push([bx, bz, ry, ry + 8.4, 0.5]); for (let k = 0; k < 4; k++) rod([bx, ry + 2.6, bz], [bx + Math.cos(k * 1.571) * 1.9, ry - 0.2, bz + Math.sin(k * 1.571) * 1.9], 0.1, 'woodDark'); gb.cyl('iron', bx, bz, 0.7, ry + 8.2, ry + 9.3, 8, 1, 1); Sites.glows.push([bx, ry + 9.3, bz, 3.8]); colO(bu, bv, 0, 0.3, 0.3, ry - 1, ry + 9); }
    { const xf = makeXf(X + ru, Z + rv, ra); drapePatch(gb, 'dirtN', xf, 4.5, -2, 25, 2, { cell: 2.5, lift: 0.08 }); drapePatch(gb, 'dirtN', xf, -9, -5, 4.5, 1.5, { cell: 3, lift: 0.06 }); }
    for (const [su, sv, n, a] of [[-128, -258, 14, 0.9], [-286, -262, 12, 2.2], [-176, -206, 9, 0.5], [-262, -196, 10, 1.4], [-300, -232, 12, 1.9], [-232, -160, 8, 1.1], [-196, -372, 9, 0.3]]) for (let k = 0; k < n; k++) { const t = (k / n - 0.5) * 22, u = su + Math.cos(a) * t + rocks.range(-2.5, 2.5), v = sv + Math.sin(a) * t + rocks.range(-2.5, 2.5); detail(() => boulder(gb, 'boulder', X + u, gridH(u, v) - 0.3, Z + v, rocks.range(0.7, 2.4), rocks)); } // (rock breaking out of the hillside)
    drapeStrip(gb, 'dirtN', resampleEven(smoothPath([[84, -290], [62, -296], [48, -316], [22, -318], [2, -338], [-34, -334], [-62, -352], [-98, -344], [-122, -356], [-146, -338], [-160, -342], [-174, -328], [-186, -331], rw(31, 1), rw(24, 0)], 2).map(([u, v]) => [X + u, Z + v]), 2), 1.7, { lift: 0.1 }); }

  /* ---------------- the hamlet where the road leaves the fort's open ground: an inn, cottages, a smithy, their gardens and fields ---------------- */
  { const roadU = v => { for (let q = 1; q < FORT_ROAD.length; q++) { const [au, av] = FORT_ROAD[q - 1], [bu, bv] = FORT_ROAD[q]; if ((av - v) * (bv - v) <= 0) return lerp(au, bu, (v - av) / (bv - av || 1)); } return 60; };
    const B = [[-1, -520, 'inn', 7, 4.6, 2, 'plaster', 'roofRed'], [1, -538, 'cottage', 4.6, 3.3, 1, 'timber2', 'roofThatch'], [-1, -556, 'cottage', 4.4, 3.2, 1, 'stone', 'roofThatch'],
      [1, -578, 'cottage', 4.8, 3.4, 1, 'plaster', 'roofThatch'], [-1, -598, 'smithy', 5.2, 4.2, 1, 'brick', 'roofRed']];
    B.forEach(([sg, v, kind, hx, hz, st, style, roofKey], k) => { const ru = roadU(v), cu = ru + sg * (13 + hz), ang = sg > 0 ? -Math.PI / 2 : Math.PI / 2, [wx, wz] = [X + cu, Z + v];
      let y = 1e9; for (const [dx, dz] of [[-hz, -hx], [hz, -hx], [-hz, hx], [hz, hx]]) y = Math.min(y, H(wx + dx, wz + dz)); y -= 0.15;
      house(cu, v, ang, { fp: { x0: -hx, z0: -hz, x1: hx, z1: hz }, stories: st, style, roof: 'gable', roofKey, doorT: 0.5, found: 1.0, chimney: 1, wealth: 0.9, sign: kind === 'inn' ? 'tavern' : undefined }, 8200 + k, y);
      const [gx, gz] = xfP(makeXf(wx, wz, ang), 0, -hz - 6); drapePatch(gb, k % 2 ? 'fGreens' : 'fPlowed', makeXf(gx, gz, ang), -hx + 0.5, -4, hx - 0.5, 4, { cell: 3, lift: 0.05, uvFrame: true }); });
    // its fields, hedged, a gap on the side towards the road
    const plants = S.plants || (S.plants = []), pr = new RNG(8210);
    for (const [cu, cvv, a, hx, hz, crop] of FORT_FIELDS) { const xf = makeXf(X + cu, Z + cvv, a); drapePatch(gb, crop, xf, -hx, -hz, hx, hz, { cell: 6, lift: 0.05, uvFrame: crop !== 'fMeadow' });
      const gapSide = cu > roadU(cvv) ? -1 : 1;
      for (const [x0, z0, x1, z1, gate] of [[-hx, -hz, hx, -hz, 0], [-hx, hz, hx, hz, 0], [-hx, -hz, -hx, hz, gapSide < 0], [hx, -hz, hx, hz, gapSide > 0]]) {
        const L = Math.hypot(x1 - x0, z1 - z0), nseg = Math.max(1, Math.round(L / 6));
        for (let q = 0; q < nseg; q++) { if (gate && q === Math.floor(nseg / 2)) continue; const t0 = q / nseg, t1 = (q + 1) / nseg, [ax, az] = xfP(xf, lerp(x0, x1, t0), lerp(z0, z1, t0)), [bx, bz] = xfP(xf, lerp(x0, x1, t1), lerp(z0, z1, t1)), mx = (ax + bx) / 2, mz = (az + bz) / 2, ang = Math.atan2(bx - ax, bz - az), sl = Math.hypot(bx - ax, bz - az), y = Math.min(H(ax, az), H(bx, bz), H(mx, mz)) - 0.3;
          gb.setXf(mx, mz, ang, y); gb.box(-0.6, 0, -sl / 2 - 0.2, 0.6, 1.75, sl / 2 + 0.2, { side: 'hedge', top: 'hedge' }, 2, 2, { skip: 'ns' }); gb.xf = null; siteCol(area, mx, mz, ang, 0.6, sl / 2 + 0.2, y - 1, y + 1.75);
          if (pr.chance(0.18)) plants.push([pr.pick(['oak1', 'oak2', 'beech']), mx + pr.range(-0.5, 0.5), mz + pr.range(-0.5, 0.5), pr.range(0.85, 1.1)]); } } }
    // trees about the hamlet and a copse in the lee of the hill
    for (const [tu, tv, kind] of [[96, -512, 'oak1'], [22, -548, 'beech'], [100, -570, 'oak2'], [24, -600, 'oak1'], [92, -612, 'beech']]) plants.push([kind, X + tu, Z + tv, pr.range(0.9, 1.15)]);
    for (let t = 0, k = 0; t < 200 && k < 24; t++) { const u = pr.range(-230, -110), v = pr.range(-640, -540); if (FORT_FIELDS.some(([cu, cvv, a, hx, hz]) => Math.abs(u - cu) < hx + 6 && Math.abs(v - cvv) < hz + 6)) continue; plants.push([pr.pick(['oak0', 'oak1', 'beech', 'birch']), X + u, Z + v, pr.range(0.8, 1.15)]); k++; } }

  // sheep grazing the glacis and the hill in loose flocks; thorn and gorse on the hill beyond its near slope (the fort's field of fire kept open)
  { const pr = new RNG(8170), plants = S.plants || (S.plants = []), roadD = (u, v) => { let d = 1e9; for (let q = 1; q < FORT_ROAD.length; q++) d = Math.min(d, segDist(u, v, ...FORT_ROAD[q - 1], ...FORT_ROAD[q]).d); return d; };
    const free = (u, v) => roadD(u, v) > 9 && (u * u + v * v > 240 * 240 || fortE(u, v) > 4) && fortNat(u, v) > 1.5;
    for (const [fu, fv, n] of [[-150, -205, 7], [130, -205, 5], [-190, -232, 5], [-120, -300, 4], [175, -120, 4], [30, -212, 5], [112, -168, 3], [290, 64, 6], [260, -60, 4]]) for (let k = 0, t = 0; k < n && t < 60; t++) { const u = fu + pr.range(-20, 20), v = fv + pr.range(-16, 16); if (!free(u, v)) continue; plants.push(['sheep', X + u, Z + v, pr.range(0.85, 1.05)]); k++; }
    for (let t = 0, k = 0; t < 600 && k < 46; t++) { const u = pr.range(-480, -60), v = pr.range(-560, -180), r = Math.hypot(u, v); if (r < 340 || !free(u, v) || fortHill(u, v) < 14 || Math.hypot(u - FORT_REDOUBT[0], v - FORT_REDOUBT[1]) < 62) continue;
      plants.push([pr.pick(['thorn', 'thorn', 'bush', 'bushB']), X + u, Z + v, pr.range(0.7, 1.15)]); k++; } }
  gb.light = savedLight; gb.xf = null;
  // the garrison, about the fort by day
  const Wp = (u, v) => [X + u, Z + v];
  S.folk = [
    { at: Wp(4, -F.PA + 5), r: 2, trade: 'Sentry at Fort Merrow', look: { hat: '#2a2a2e', shirt: '#6a2a22', pants: '#3a3430' }, lines: ['"Keep to the bridges. The moat is deeper than it looks, and saltier."', '"Nothing comes into the bay that we do not see first. Nothing leaves it, either."', '"The ravelin is there so no one can fire straight at the gate. You have to come at it sideways, like a crab."'] },
    { at: Wp(14, 100), r: 5, trade: 'Gunner at Fort Merrow', look: { hat: '#2a2a2e', shirt: '#6a2a22', pants: '#3a3430' }, lines: ['"From this point a culverin carries halfway to Gullscar Light on a still day. We have never had to prove it."', '"The sea fronts have no ravelin. The sea does that work."', '"Powder lives in the magazine, behind its own wall. If it ever goes up, it goes up alone."'] },
    { at: Wp(12, 2), r: 10, trade: 'Sergeant of the garrison', look: { hat: '#1e1e22', shirt: '#6a2a22', pants: '#2e2a26' }, lines: ['"Five bastions, five curtains, and every face can be seen from the flank of its neighbour. That is the whole art of it."', '"The engineers drew it with a compass and a rule. Then the rest of us carried the earth."', '"Drill is at dawn, whatever the weather. The weather here is mostly wind."'] },
    { at: Wp(-12, -3), r: 4, trade: 'Washerwoman of the garrison', gender: 'f', look: { apron: '#c8c0a8' }, lines: ['"The well is sweet, though the moat is salt. The engineers swore it would be, and for once they were right."', '"They say the walls are brick so the shot sinks in instead of shattering them. I say brick was cheaper."'] },
    { at: Wp(LJ[0] - 4, LJ[1] - 3), r: 3, trade: 'Boatman at Fort Merrow', look: { shirt: '#5a6a7a', pants: '#3a3a3a' }, lines: ['"Stores come by water. It is quicker than the road, when the wind is kind."', '"In a westerly the whole bay piles up against this point. We bring the boats round to the lee."'] },
    { at: Wp(FT.BP[3][0] * 0.7 - 6, FT.BP[3][1] * 0.7 + 6), r: 4, trade: 'Miller of the fort', look: { apron: '#d8d0c0', hat: '#8a7a5a' }, lines: ['"The mill grinds the garrison\'s flour. Up here it never wants for wind."', '"From the cap you can see the whole bay, Aldhaven and all. I charge the officers a penny."'] },
    { at: Wp(FORT_REDOUBT[0] - 5, FORT_REDOUBT[1] - 4), r: 3, trade: 'Watchman on the hill', look: { hat: '#2a2a2e', shirt: '#6a2a22', pants: '#3a3430' }, lines: ['"Whoever holds this hill can throw stones into the fort. So we hold it."', '"One fire on the beacon for a sail. Two for a fleet. I have never lit the second."', '"You can read the whole plan of the place from up here. The engineers come up to admire it."'] },
    { at: Wp(52, -526), r: 5, trade: 'Innkeeper at the fort\'s hamlet', look: { apron: '#c8c0a8' }, lines: ['"Soldiers drink, and the fort is dry. You can work out the rest yourself."', '"The road goes no further than the fort. Everyone who comes this way is going there, or coming back."'] },
  ];
};
