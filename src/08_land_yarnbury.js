/* =====================================================================
   Yarnbury: an old earthwork in the inward bend of a stream that is
   carried high on a bank of its own across the foot of the downs. Long
   ago the stream was taken off the downs along that bank; now it is the
   main carrier of the water meadows below it, and inside the bend, within
   the old rampart, four parishes hold their fair. Made on a map of its
   own (src/08_land.js), a start of a new game; notes in docs/YARNBURY.md.
   Local metres about the middle of the fort, +x east, +z south. It is
   meant for where it was first found, in the country west of the home
   country (world -17430, -660, seed 0); the world will give way to it.
   ===================================================================== */
const YB = { origin: [-17430, -660] };
// the carrier: off the downs from the east, level on the plateau, then held up on its bank across the falling land round the bend, and
// down at last to the river in a steep tail. Points and levels as the stream was found (its bank rises to some 18 m at the bend)
YB.carrier = (() => {
  const P = [[1500, -360], [1250, -340], [1000, -300], [800, -280], [680, -262], [570, -254], [544, -236], [514, -224], [482, -223], [451, -229], [423, -240], [396, -256], [371, -276], [346, -296], [319, -313],
    [289, -325], [256, -323], [228, -309], [201, -291], [175, -272], [150, -253], [125, -232], [101, -211], [78, -189], [55, -166], [33, -144], [11, -120], [-10, -96], [-30, -71], [-49, -45], [-64, -18], [-71, 13],
    [-66, 44], [-52, 72], [-34, 98], [-12, 122], [8, 147], [23, 175], [28, 207], [24, 239], [10, 268], [-10, 293], [-33, 315], [-53, 340], [-69, 369], [-76, 400], [-76, 432], [-82, 463], [-108, 482], [-132, 503],
    [-156, 524], [-181, 544], [-212, 557], [-246, 566]];
  const wl = [34.2, 33.9, 33.5, 33.1, 32.8, 32.5, 32.4, 32.4, 32.3, 32.3, 32.2, 32.2, 32.1, 32.1, 32.0, 32.0, 31.9, 31.9, 31.8, 31.8, 31.7, 31.7, 31.6, 31.6, 31.5, 31.5, 31.4, 31.4, 31.4, 31.3, 31.3, 31.2,
    31.2, 30.9, 30.5, 30.0, 29.5, 29.0, 28.2, 27.4, 26.8, 26.1, 25.2, 24.4, 23.4, 22.2, 20.8, 19.5, 18.6, 17.6, 16.3, 15.2, 11.5, 5.0];
  const w = P.map((_, k) => k < 20 ? 4.8 : k < 50 ? 4.2 : 5.2);
  return { P, wl, w, name: 'the carrier', raised: true, lip: 0.9, teeth: 4.2, deckUp: 4.2, saddle: [14, 38], bridgeOver: 2 }; // (a way over it is always bridged: no one fords a stream on top of a bank) // (no peaks for some 60 m either side of a bridge: the hump stands up out of a saddle in the bank)
})();
// the river: down the valley floor west of the bank, falling towards the sea in the south
YB.riverLv = z => z < -440 ? 10.6 + 1.8 * smoothstep(-440, -2400, z) : z < 300 ? lerp(10.6, 7.0, (z + 440) / 740) : z < 640 ? lerp(7.0, 3.5, (z - 300) / 340) : z < 820 ? lerp(3.5, 0.2, (z - 640) / 180) : lerp(0.2, SEA + 0.2, smoothstep(820, 980, z));
YB.river = (() => {
  const P = smoothLine([[-470, -2400], [-430, -2100], [-380, -1800], [-330, -1500], [-360, -1200], [-390, -950], [-345, -700], [-360, -439], [-305, -250], [-325, -60], [-300, 120], [-252, 300], [-238, 450], [-262, 640], [-250, 800], [-246, 960], [-240, 1300]], 8);
  return { P, wl: P.map(([, z]) => YB.riverLv(z)), w: P.map(([, z]) => 13 + 2 * smoothstep(-400, 600, z)), name: 'the river' };
})();
// the lie of the land: the valley floor in the west, a long gentle rise east to the foot of the downs' edge, a steep hanger, the downs above;
// a swell in the south over which the carrier comes down; beyond the river the land rises again; the sea some 850 m south
function yarnBase(x, z) {
  const s = x - 0.35 * z + 35 * fbm(x / 700 + 3, z / 700, 2, 4101);
  const lv = YB.riverLv(z), floor = lv + 0.9 + 0.35 * fbm(x / 90, z / 90, 2, 4107); // (the valley floor falls with the river towards the sea)
  let h = lerp(floor, 13.0 + (lv - 10.6) * 0.45, smoothstep(-330, -80, s)) + 9.5 * smoothstep(-100, 160, s) + 10.5 * smoothstep(150, 240, s);
  h += 5.2 * Math.exp(-((x - 40) ** 2 + (z - 225) ** 2) / (2 * 150 * 150)) * smoothstep(-200, 40, s);
  h += 9 * smoothstep(-420, -900, s) + 14 * smoothstep(-900, -1700, s);
  h += 2.5 * smoothstep(200, 600, s) * fbm(x / 380, z / 380, 2, 4102) + 6 * smoothstep(-500, -1400, z) * (0.6 + 0.4 * fbm(x / 500, z / 500, 2, 4103));
  h += 1.1 * fbm(x / 260, z / 260, 3, 4104) * smoothstep(-200, 0, s) + 0.5 * fbm(x / 260, z / 260, 3, 4104) + 0.3 * fbm(x / 60, z / 60, 2, 4105);
  const cz = 860 + 70 * fbm(x / 500, 0.5, 2, 4106);
  return lerp(h, SEA - 5, smoothstep(cz - 70, cz + 90, z));
}
// the ways: the fair's road from Fernby over the bank to Stanhollow and its bridge, the lanes to Holley and the farms, the track to Kelfield's bridge
YB.ways = [
  { id: 'fair', kind: WAY.track, seed: 11, P: smoothLine([[88, 700], [80, 620], [66, 500], [56, 400], [48, 300], [44, 215], [49, 141], [40, 80], [37, 50], [26, 8], [17, -34], [3, -66], [-11, -94], [-32, -131], [-70, -175], [-125, -232], [-190, -292], [-255, -352], [-320, -410], [-359, -439], [-405, -447], [-460, -436], [-520, -412], [-575, -392], [-650, -380], [-700, -372]], 5) },
  { id: 'holley', kind: WAY.lane, seed: 12, P: smoothLine([[-32, -131], [30, -205], [100, -282], [180, -322], [300, -372], [420, -415], [520, -452], [560, -470], [640, -500]], 5) },
  { id: 'eastfarm', kind: WAY.lane, seed: 13, P: smoothLine([[17, -34], [75, -58], [121, -76], [158, -86]], 5) },
  { id: 'downs', kind: WAY.green, seed: 14, P: smoothLine([[178, -96], [230, -114], [300, -122], [420, -112], [560, -90], [700, -70]], 5) },
  { id: 'westfarm', kind: WAY.lane, seed: 15, P: smoothLine([[37, 50], [0, 66], [-43, 83], [-75, 92], [-110, 98], [-150, 103], [-192, 104]], 5) },
  { id: 'kelfield', kind: WAY.track, seed: 16, P: smoothLine([[-192, 104], [-236, 140], [-280, 200], [-330, 258], [-420, 330], [-560, 420], [-700, 500]], 5) },
];
// the old fort: its own bank and ditch round the east of the bend, the carrier's bank closing its west; the ways come in at its gates
YB.rampart = smoothLine([[70, -168], [100, -140], [118, -95], [124, -40], [120, 20], [104, 80], [78, 122], [48, 142], [18, 140], [-2, 126]], 2);
{ let s = 0; YB.rampart.L = YB.rampart.map((p, k) => (s += k ? Math.hypot(p[0] - YB.rampart[k - 1][0], p[1] - YB.rampart[k - 1][1]) : 0)); }
YB.gates = [[121, -76], [48, 141]].map(([gx, gz]) => { let bd = 1e9, L = 0; YB.rampart.forEach((p, k) => { const d = Math.hypot(p[0] - gx, p[1] - gz); if (d < bd) { bd = d; L = YB.rampart.L[k]; } }); return L; });
YB.fortBox = [-90, -190, 160, 175];
// the signed distance from the rampart's line (outside positive) and how far along it
function yarnRampart(x, z) {
  const R = YB.rampart; let bd = 1e9, bL = 0, sg = 1;
  for (let k = 1; k < R.length; k++) { const s = segDist(x, z, R[k - 1][0], R[k - 1][1], R[k][0], R[k][1]); if (s.d < bd) { bd = s.d; bL = lerp(R.L[k - 1], R.L[k], s.t); const dx = R[k][0] - R[k - 1][0], dz = R[k][1] - R[k - 1][1]; sg = (dx * (z - R[k - 1][1]) - dz * (x - R[k - 1][0])) < 0 ? 1 : -1; } }
  return [bd * sg, bL];
}
// the water meadows below the bank, west of the bend: beds 12 m wide running west from the feeder at the bank's foot to the main drain
YB.mead = { z0: -86, z1: 74, pitch: 12, xd: -262 };
YB.feederLine = offsetLine(YB.carrier.P.slice(26, 36), 19.5); // (19.5 m out from the carrier, along its west and north-west side: clear of the bank's foot)
YB.feederX = z => { const F = YB.feederLine; for (let k = 1; k < F.length; k++) if ((F[k - 1][1] - z) * (F[k][1] - z) <= 0) return lerp(F[k - 1][0], F[k][0], (z - F[k - 1][1]) / ((F[k][1] - F[k - 1][1]) || 1)); return -80; };
YB.feederXOld = z => { const C = YB.carrier.P; let bx = -60, bd = 1e9; for (let k = 26; k < 36; k++) { const [x0, z0] = C[k - 1], [x1, z1] = C[k]; if ((z0 - z) * (z1 - z) <= 0) { const t = (z - z0) / ((z1 - z0) || 1); const x = lerp(x0, x1, t); if (Math.abs(z - lerp(z0, z1, t)) < bd) { bd = 0; bx = x; } } } return bx - 18.5; }; // (clear of the bank's foot)
YB.inMead = (x, z, m = 0) => z > YB.mead.z0 - 6 - m && z < YB.mead.z1 + 6 + m && x < YB.feederX(z) + 2 + m && x > YB.mead.xd - 6 - m;
// the buildings' places
YB.alehouse = { x: 24, z: -84, ang: -Math.PI / 2 - 0.24 };
YB.fairhouse = { x: 66, z: 30, ang: -0.24 };
YB.pens = { x0: -46, z0: -26, x1: -10, z1: 30 };
YB.pool = { x: -97, z: 13 };
YB.villages = [
  { id: 'stanhollow', name: 'Stanhollow', x: -560, z: -470, n: 12, church: [-648, -404] },
  { id: 'fernby', name: 'Fernby', x: 78, z: 560, n: 4 },
  { id: 'holley', name: 'Holley', x: 560, z: -478, n: 3 },
];
YB.farms = [{ x: 172, z: -92, ang: -0.3 }, { x: -212, z: 98, ang: 1.45 }];
YB.drowner = { x: -112, z: -24, ang: Math.PI / 2 };

// the earthworks laid on the land: the rampart, its ditch and the low bank beyond, broken at the gates; the ridges of the meadow beds
function yarnEarth(x, z, h) {
  let d = 0; const B = YB.fortBox;
  if (x > B[0] && x < B[2] && z > B[1] && z < B[3]) {
    const [s, L] = yarnRampart(x, z);
    if (Math.abs(s) < 30) {
      const bump = u => Math.abs(u) >= 1 ? 0 : (1 - u * u) ** 2, gap = Math.max(...YB.gates.map(g => 1 - smoothstep(5, 10, Math.abs(L - g)))), open = 1 - gap;
      const wear = 0.78 + 0.3 * fbm(L / 38 + 2, 0.3, 2, 4201) - 0.25 * smoothstep(0.25, 0.5, fbm(L / 17, 1.7, 2, 4202)); // worn low in places, a slump here and there
      const crest = u => Math.abs(u) >= 1 ? 0 : (1 - Math.abs(u) ** 1.6) ** 1.3, slump = 1 - 0.38 * (1 - smoothstep(4, 14, Math.abs(L - 205))); // (a narrow rounded crest; where the bank has slipped)
      d += 5.8 * wear * slump * crest(s / (s > 0 ? 8 : 12.5 + 1.5 * fbm(L / 25, 3.1, 1, 4203))) * open; // (steeper outside, a long slope down into the fort)
      d -= 3.4 * (0.85 + 0.25 * fbm(L / 30, 5.5, 1, 4204)) * Math.max(0, 1 - Math.abs(s - 13.5) / 7) * (1 - 0.92 * gap); // the ditch, V-cut
      d += 1.2 * wear * bump((s - 21.5) / 3.8) * open;
      // the bank's ends run in a little at each gate, as the old builders made their ways in
      for (const g of YB.gates) { const e = Math.abs(L - g); if (e > 6 && e < 16 && s < 0 && s > -14) d += 1.1 * bump((e - 11) / 5) * bump((s + 6) / 8); }
    }
  }
  if (YB.inMead(x, z, 8)) { const M = YB.mead, f = smoothstep(M.z0 - 6, M.z0, z) * (1 - smoothstep(M.z1, M.z1 + 6, z)) * (1 - smoothstep(YB.feederX(z) - 4, YB.feederX(z) + 2, x)) * smoothstep(M.xd - 6, M.xd, x);
    d += f * (0.36 * Math.cos(2 * Math.PI * (z - M.z0) / M.pitch) + 0.1); }
  return d;
}
// the colour of the turf: pasture and hay most of it, lush green on the watered meads and by the water, worn and dusty where the fair treads,
// paler and drier up on the downs, dark under the woods
function yarnTint(x, z, h, n, o) {
  const dry = clamp(0.5 + 0.42 * fbm(x / 120, z / 120, 3, 41), 0, 1), patch = 1 + 0.06 * fbm(x / 26, z / 26, 2, 55) + 0.04 * fbm(x / 70, z / 70, 2, 56);
  let r = lerp(1.0, 1.18, dry) * patch, g = lerp(0.97, 0.95, dry) * patch, b = lerp(0.8, 0.72, dry) * patch;
  const vale = 1 - smoothstep(20, 260, Math.abs(x - yarnRiverX(z))); r = lerp(r, 0.78, vale * 0.55); g = lerp(g, 1.06, vale * 0.55); b = lerp(b, 0.6, vale * 0.55);
  const rough = smoothstep(0.05, 0.45, fbm(x / 340 + 7, z / 340, 2, 48)); r = lerp(r, 1.16, rough * 0.35); g = lerp(g, 0.95, rough * 0.35); b = lerp(b, 0.68, rough * 0.35);
  const downs = smoothstep(150, 270, x - 0.35 * z + 55 * fbm(x / 90, z / 90, 2, 4307)); r = lerp(r, 1.2, downs * 0.5); g = lerp(g, 1.02, downs * 0.5); b = lerp(b, 0.66, downs * 0.5); // short turf on the downs, paler and yellower in August
  if (!o.far && x > YB.fortBox[0] && x < YB.fortBox[2] && z > YB.fortBox[1] && z < YB.fortBox[3]) { const [s] = yarnRampart(x, z), dt = Math.max(1 - smoothstep(3, 6, Math.abs(s - 12.5)), 0.55 * smoothstep(0, 3, s) * (1 - smoothstep(7, 10, s))); if (dt > 0) { r = lerp(r, 0.7, dt * 0.45); g = lerp(g, 0.86, dt * 0.45); b = lerp(b, 0.55, dt * 0.45); } } // the ditch: damp, rank and darker
  { const wet = smoothstep(0.1, 0.4, fbm(x / 55 + 3, z / 55, 2, 4310)) * (1 - smoothstep(-80, 20, x - 0.35 * z)); r = lerp(r, 0.78, wet * 0.35); g = lerp(g, 0.98, wet * 0.35); b = lerp(b, 0.66, wet * 0.35); } // (rushy, cooler ground on the wet flats)
  if (o.lush) { r = lerp(r, 0.74, o.lush * 0.6); g = lerp(g, 1.08, o.lush * 0.6); b = lerp(b, 0.56, o.lush * 0.6); }
  if (!o.far && YB.inMead(x, z, 4)) { const ph = Math.cos(2 * Math.PI * (z - YB.mead.z0) / YB.mead.pitch), k = 0.62; // the watered meads, a month ahead of the rest: fresh grass on the beds, wetter and darker down the furrows
    const c = 0.5 + 0.5 * ph; r = lerp(r, lerp(0.6, 0.9, c), k); g = lerp(g, lerp(0.92, 1.14, c), k); b = lerp(b, lerp(0.6, 0.55, c), k); }
  const w = yarnWood(x, z); if (w > 0) { r = lerp(r, 0.4, w * 0.9); g = lerp(g, 0.55, w * 0.9); b = lerp(b, 0.36, w * 0.9); }
  if (!o.far) { const t = yarnTrodden(x, z); if (t > 0) { r = lerp(r, 1.22, t * 0.5); g = lerp(g, 1.0, t * 0.5); b = lerp(b, 0.7, t * 0.5); } }
  return [r, g, b];
}
// where the river runs at a given z (a table every 2 m: it is asked for at every point of the ground)
YB.riverTab = (() => { const P = YB.river.P, t = new Float32Array(2401); for (let q = 0; q <= 2400; q++) { const z = -2400 + q * 2; let x = -300; for (let k = 1; k < P.length; k++) if ((P[k - 1][1] - z) * (P[k][1] - z) <= 0) { x = lerp(P[k - 1][0], P[k][0], (z - P[k - 1][1]) / ((P[k][1] - P[k - 1][1]) || 1)); break; } t[q] = x; } return t; })();
function yarnRiverX(z) { const f = clamp((z + 2400) / 2, 0, 2399.999), q = Math.floor(f); return lerp(YB.riverTab[q], YB.riverTab[q + 1], f - q); }
// the woods: a hanger on the downs' steep edge, a copse or two up on the downs, a strip of alder and willow along the river
function yarnWood(x, z) {
  const s = x - 0.35 * z, n = fbm(x / 90, z / 90, 2, 4301);
  const mid = 200 + 45 * fbm(z / 210 + 3, 0.7, 2, 4304), half = 32 + 38 * smoothstep(-0.3, 0.4, fbm(z / 140, 2.2, 2, 4305)); // the hanger: along the steep edge, but lobed and broken
  const along = z * 0.94 + x * 0.33, gap = smoothstep(-0.12, 0.12, fbm(along / 190 + 5.5, 0.9, 2, 4308) + 0.05); // (woods of a few hundred metres, open pasture between them)
  let w = (1 - smoothstep(half - 14, half + 6, Math.abs(s - mid))) * smoothstep(-0.08, 0.2, n + 0.12 + 0.25 * fbm(x / 230, z / 230, 2, 4306)) * gap;
  w = Math.max(w, smoothstep(0.34, 0.46, fbm(x / 150 + 9, z / 150, 2, 4302)) * smoothstep(300, 340, s) * 0.9); // a copse or two up on the downs
  const rd = Math.abs(x - yarnRiverX(z)); w = Math.max(w, (1 - smoothstep(10, 24, rd)) * smoothstep(0.05, 0.3, fbm(x / 50, z / 50, 2, 4303)) * 0.8); // (alder and willow by the river, in clumps)
  if (x > -95 && x < 160 && z > -200 && z < 180) w *= smoothstep(30, 60, Math.abs(yarnRampart(x, z)[0]) + (yarnRampart(x, z)[0] > 0 ? 0 : 60)); // the fort and its ground kept open
  if (YB.inMead(x, z, 12)) w = 0;
  { const s2 = segDist(x, z, 150, -90, 330, -122); w *= smoothstep(30, 55, s2.d); } // (the green lane goes up onto the downs through a gap in the hanger)
  for (const V of YB.villages) if (Math.hypot(x - V.x, z - V.z) < 90) w = 0;
  for (const F of YB.farms) w *= smoothstep(40, 70, Math.hypot(x - F.x, z - F.z));
  return clamp(w, 0, 1);
}
// how much the fair has worn the turf: the gates, the booths along the road, the alleys between the pens, the trough
function yarnTrodden(x, z) {
  let t = 0;
  for (const [gx, gz] of [[121, -76], [48, 141], [-11, -94], [-43, 83]]) t = Math.max(t, 1 - smoothstep(4, 16, Math.hypot(x - gx, z - gz)));
  { const s = segDist(x, z, 17, -34, 40, 80); t = Math.max(t, (1 - smoothstep(6, 18, s.d)) * (0.55 + 0.25 * fbm(x / 9, z / 9, 2, 4401))); }
  const Pn = YB.pens; if (x > Pn.x0 - 4 && x < Pn.x1 + 4 && z > Pn.z0 - 4 && z < Pn.z1 + 4) t = Math.max(t, 0.45 + 0.2 * fbm(x / 6, z / 6, 1, 4402));
  t = Math.max(t, 1 - smoothstep(3, 9, Math.hypot(x + 49, z - 2)));
  return clamp(t, 0, 1);
}

LANDS.yarnbury = {
  id: 'yarnbury', name: 'Yarnbury', origin: YB.origin, R: 700, C: 4, RS: 2600, CS: 26, music: 'wild', nearAt: [-60, 0], nearR: 330,
  base: yarnBase, earth: yarnEarth, tint: yarnTint,
  waters: [YB.river, YB.carrier],
  ways: YB.ways,
  bare: (x, z, h, sl) => { const t = yarnTrodden(x, z); let b = t > 0.5 ? smoothstep(0.5, 0.95, t) * 0.75 : 0;
    return b; },
  start: (() => { const x = -66, z = -170, tx = -11, tz = -94; return { x, z, yaw: Math.atan2(-(tx - x), -(tz - z)), pitch: 0.05 }; })(),
  welcome: t => [
    'Yarnbury is a map of its own, not yet joined to the world. Walk it to its edges; nothing beyond them is made yet.',
    `Ahead the road climbs onto the bank and over the bridge into the old fort, where the fair is held. ${t ? 'Walk with your left thumb, look by dragging on the right.' : 'Look with the mouse, walk with WASD.'}`,
  ],
  build: yarnBuild, plants: yarnPlants,
  folk: [
    { at: [4, -72], r: 6, trade: 'Steward of the fair', look: { hat: '#2a2420', shirt: '#4a3a2a', pants: '#3a3028' }, wealth: 1.4, lines: ['"A penny a score for sheep, twopence a beast for cattle. The tolls keep the bridges mended."', '"Four parishes keep the fair here: Stanhollow, Fernby, Holley and Kelfield. None of them owns the ground, and all of them claim it."', '"Quarrels are settled at the fair house before the day is out. A fair cannot wait for the assizes."'] },
    { at: [-26, 4], r: 9, trade: 'Shepherd', look: { shirt: '#6a6050', pants: '#4a4234' }, wealth: 0.6, lines: ['"Ewes off the downs, lambs off the meads. The water brings the grass on a month early."', '"Mind the hurdles. A pen that falls is a morning lost."', '"From up on the bank you can count every pen. The steward does, twice."'] },
    { at: [33, 12], r: 7, trade: 'Pedlar', look: { shirt: '#5a2a2a', pants: '#3a3a30' }, wealth: 0.8, lines: ['"Laces, pins, ballads and almanacs. Everything a shepherd forgets to buy at home."', '"Last year the rain came at noon. This year the old bank keeps the wind off us."'] },
    { at: [14, -88], r: 5, trade: 'Alewife', gender: 'f', look: { apron: '#d8d0b8' }, wealth: 0.9, lines: ['"The fair house sells no drink. That is why I am here."', '"My grandmother said the bank was raised by giants, my grandfather said by monks. Both of them drank."'] },
    { at: [-104, 6], r: 10, trade: 'Drowner of the meads', gender: 'm', look: { shirt: '#4a4a3a', pants: '#3a3428', hat: '#3a2a1a' }, wealth: 0.6, lines: ['"In February I let the water over the meads, a finger deep, and keep it moving. Still water rots the grass."', '"Each bed has its hatch and each furrow its drain. Shut one wrong and you drown a man\'s hay."', '"The carrier runs level on its bank for half a mile. Whoever made it knew water better than I do."'] },
    { at: [46, 118], r: 8, trade: 'Carter', look: { shirt: '#5a4a32', pants: '#3a3028' }, wealth: 0.7, lines: ['"From Fernby the road climbs to the bridge like a goat path. The horses hate it."', '"Kelfield\'s carts come over the river bridge when the ford is up."'] },
    { at: [70, 548], r: 10, trade: 'Villager of Fernby', gender: 'f', wealth: 0.7, lines: ['"We go up to the fair on the first Tuesday after Lammas."', '"The bank? It was there before Fernby was."'] },
    { at: [-552, -452], r: 12, trade: 'Villager of Stanhollow', wealth: 0.8, lines: ['"Stanhollow has the church and the bridge, so Stanhollow keeps the fair\'s book."', '"Cross the river by our bridge, not the ford. The ford has taken two carts this summer."'] },
  ],
};

// the people at the fair: buyers and sellers from the four parishes, about the booths and the pens by day
{ const r = new RNG(5501), lines = ['"Fourpence for a fleece! He thinks I was born yesterday."', '"Keep your purse inside your coat. A fair draws more than shepherds."', '"We walked over from Holley before it was light."',
    '"We sit up on the bank to eat. You can see the sea from the top."', '"Prices are down this year. Everyone says so, every year."', '"My father bought his first ewes here, and his father before him."', '"There will be wrestling by the fair house when the selling is done."',
    '"Stanhollow men drive a hard bargain and a soft ewe."', '"The meads have been mown. Next year\'s lambs will be fat on them."'], spots = [[30, 40, 16], [-25, 4, 14], [55, 55, 9], [10, -60, 10], [40, 100, 12], [24, 20, 8], [36, 62, 8]];
  for (let k = 0; k < 32; k++) { const [sx, sz, sr] = spots[k % spots.length], a = r.range(0, 6.28), d = sr * Math.sqrt(r.next()); LANDS.yarnbury.folk.push({ at: [sx + Math.cos(a) * d, sz + Math.sin(a) * d], r: 6 + r.range(0, 6), trade: 'At the fair', wealth: r.range(0.5, 1.2), lines: [lines[k % lines.length], lines[(k + 4) % lines.length]] }); } }

// the buildings, waterworks and things of the fair
function yarnBuild(L, gb, near, fl, cols) {
  YB.closes = [];
  const hedge = (ax, az, bx, bz, r) => { const len = Math.hypot(bx - ax, bz - az); if (len < 0.5) return; const n = Math.ceil(len / 2.5); gb.tint = [1.12, 1.15, 1.05];
    for (let q = 0; q < n; q++) { if (r.chance(0.05)) continue; const x0 = lerp(ax, bx, q / n), z0 = lerp(az, bz, q / n), x1 = lerp(ax, bx, (q + 1) / n), z1 = lerp(az, bz, (q + 1) / n), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, l = Math.hypot(x1 - x0, z1 - z0), y = Math.min(L.heightAt(x0, z0), L.heightAt(x1, z1)), hh = 1.1 + 1.3 * r.next() ** 1.5, wd = 0.75 + 0.3 * r.next();
      gb.setXf(mx, mz, Math.atan2(x1 - x0, z1 - z0) + r.range(-0.08, 0.08), y); gb.box(-wd, -0.4, -l / 2 - 0.2, wd, hh, l / 2 + 0.2, 'hedge', 2, 1.5); gb.xf = null;
      if (r.chance(0.035)) { const kind = r.pick(['oak0', 'oak1', 'oak2', 'thorn']), h2 = L.heightAt(mx, mz); fl[kind].push([mx, h2 - 0.15, mz, r.range(0.75, 1.05)]); if (WILD_KINDS[kind][4]) cols.push({ x0: mx - 0.35, z0: mz - 0.35, x1: mx + 0.35, z1: mz + 0.35, y0: h2 - 1, y1: h2 + 8 }); } }
    gb.tint = null; hedgeBushes(fl, ax, az, bx, bz, r, L); };
  YB.hedge = hedge;
  const H = (x, z) => L.heightAt(x, z), rng = new RNG(5501), B = (g, x0, y0, z0, x1, y1, z1, k, tw = 1, th = 1) => g.box(x0, y0, z0, x1, y1, z1, k, tw, th);
  const col = (x, z, ang, hx, hz, y0, y1) => { const e = Math.hypot(hx, hz) + 0.2; cols.push({ x0: x - e, z0: z - e, x1: x + e, z1: z + e, y0, y1, o: { x, z, c: Math.cos(ang), s: Math.sin(ang), hx, hz } }); };
  const minH = (x, z, ang, hx, hz) => { const f = makeXf(x, z, ang); let lo = 1e9, hi = -1e9; for (const [a, b] of [[-hx, -hz], [hx, -hz], [-hx, hz], [hx, hz]]) { const [wx, wz] = xfP(f, a, b), h = H(wx, wz); lo = Math.min(lo, h); hi = Math.max(hi, h); } return [lo, hi]; };
  const C = YB.carrier;
  // the chute: a hatch in the carrier's west bank at the bend lets water down a timber launder on trestles to a stone-lined pool at the foot
  { const top = [-66, 13], wl = 31.2, [px, pz] = [YB.pool.x, YB.pool.z], pool = H(px, pz) + 0.2, ang = Math.atan2(px - top[0], pz - top[1]), Lc = Math.hypot(px - top[0], pz - top[1]);
    gb.setXf(top[0], top[1], ang, 0); const slope = (pool + 0.6 - wl) / Lc;
    for (let t = 0; t < Lc; t += 1.0) { const y = wl - 0.1 + slope * t, y1 = wl - 0.1 + slope * Math.min(Lc, t + 1.05);
      gb.quad4('woodDark', [-0.55, y - 0.35, t], [0.55, y - 0.35, t], [0.55, y1 - 0.35, t + 1.05], [-0.55, y1 - 0.35, t + 1.05], [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]);
      for (const sx of [-1, 1]) { gb.quad4('woodDark', [sx * 0.55, y - 0.35, t], [sx * 0.55, y + 0.25, t], [sx * 0.55, y1 + 0.25, t + 1.05], [sx * 0.55, y1 - 0.35, t + 1.05], [0, 0], [0, 1], [1, 1], [1, 0], [sx, 0, 0]); gb.quad4('woodDark', [sx * 0.55, y1 - 0.35, t + 1.05], [sx * 0.55, y1 + 0.25, t + 1.05], [sx * 0.55, y + 0.25, t], [sx * 0.55, y - 0.35, t], [1, 0], [1, 1], [0, 1], [0, 0], [-sx, 0, 0]); }
      gb.quad4('woodDark', [0.55, y - 0.35, t], [-0.55, y - 0.35, t], [-0.55, y1 - 0.35, t + 1.05], [0.55, y1 - 0.35, t + 1.05], [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0]); // (its underside, seen from the meads)
      gb.quad4('wStream', [-0.45, y - 0.12, t], [0.45, y - 0.12, t], [0.45, y1 - 0.12, t + 1.05], [-0.45, y1 - 0.12, t + 1.05], [0, t / 3], [0.3, t / 3], [0.3, (t + 1) / 3], [0, (t + 1) / 3], [0, 1, 0]); }
    for (let t = 2.5; t < Lc - 1; t += 3) { const [wx, wz] = xfP(gb.xf, 0, t), g0 = H(wx, wz), y = wl - 0.1 + slope * t - 0.4; if (y - g0 < 0.4) continue; for (const sx of [-0.7, 0.7]) B(gb, sx - 0.12, g0 - 0.3, t - 0.12, sx + 0.12, y, t + 0.12, 'woodDark'); B(gb, -0.85, y - 0.25, t - 0.1, 0.85, y - 0.05, t + 0.1, 'woodDark'); }
    // the hatch at its head: two posts, a beam and the boards that are drawn up to let the water through
    gb.xf = null; const hx = top[0] - 1.6, hz = top[1]; gb.setXf(hx, hz, ang, 0); for (const sx of [-1, 1]) B(gb, sx * 1.1 - 0.15, wl - 1.2, -0.15, sx * 1.1 + 0.15, wl + 1.6, 0.15, 'woodDark'); B(gb, -1.3, wl + 1.4, -0.18, 1.3, wl + 1.65, 0.18, 'woodDark'); B(gb, -0.95, wl - 0.6, -0.06, 0.95, wl + 0.25, 0.06, 'wood'); gb.xf = null;
    // the pool: a ring of stone, the water in it; the feeder runs north and south from it along the bank's foot
    gb.cyl('stone', px, pz, 4.2, pool - 1.2, pool + 0.35, 14, 2, 1); gb.disc('water', px, pool + 0.2, pz, 3.8, 14, 3); col(px, pz, 0, 3, 3, pool - 2, pool + 0.35);
    L.flagsN = 0; }
  // the meads: the feeder along the bank's foot, a carrier along the crown of each bed and a drain in each furrow, the main drain to the river
  { const M = YB.mead, beds = [], fx = z => YB.feederX(z);
    const feeder = []; for (let z = M.z0 - 2; z <= M.z1 + 2; z += 3) feeder.push([fx(z), z]);
    gb.tint = [0.72, 0.84, 0.82]; drapeStrip(gb, 'wStream', feeder, 1.3, { lift: 0.16 }); gb.tint = null; near.tint = [0.6, 0.72, 0.7]; // (the water in the meads is shallow and dark, green-grey over the grass)
    for (let z = M.z0; z <= M.z1 + 0.1; z += M.pitch) beds.push(z);
    for (const zc of beds) { const x0 = fx(zc) - 1, crown = []; crown.push([x0 + 2, zc - 2.2]); for (let x = x0 - 3; x > M.xd + 10; x -= 3) crown.push([x, zc + 1.6 * Math.sin(x / 26 + zc) + 0.4 * Math.sin(x / 7.1 + zc * 0.3)]); drapeStrip(near, 'wStream', crown, 0.5, { lift: 0.13 }); // (it leaves the feeder at a slant) // (near only: from afar these threads of water break up)
      // its hatch: a board across the head of the bed carrier
      const y = H(x0, zc); B(near, x0 - 0.12, y - 0.3, zc - 0.55, x0 + 0.12, y + 0.45, zc + 0.55, 'wood'); B(near, x0 - 0.15, y + 0.35, zc - 0.7, x0 + 0.15, y + 0.55, zc + 0.7, 'woodDark'); }
    for (const zc of beds) { const zd = zc + M.pitch / 2; if (zd > M.z1 + 2) continue; const dr = []; for (let x = fx(zd) - 8; x > M.xd - 1; x -= 3) dr.push([x, zd + 1.5 * Math.sin(x / 23 + zd) + 0.4 * Math.sin(x / 5.3)]); near.tint = [0.62, 0.8, 0.6]; drapeStrip(near, 'mudN', dr, 0.72, { lift: 0.17 }); near.tint = [0.6, 0.72, 0.7]; drapeStrip(near, 'wStream', dr, 0.55, { lift: 0.2 }); }
    const md = smoothLine([[M.xd + 1, M.z0 - 4], [M.xd - 1.5, M.z0 + 50], [M.xd + 1.5, M.z0 + 110], [M.xd - 1, M.z1 + 4], [M.xd - 10, M.z1 + 18], [yarnRiverX(M.z1 + 30) + 6, M.z1 + 32]], 3); // (bending gently down to the river)
    near.tint = null; gb.tint = [0.72, 0.84, 0.82]; drapeStrip(gb, 'wStream', md, 1.5, { lift: 0.18 }); gb.tint = null;
    for (const zc of [beds[2], beds[3], beds[7], beds[10]]) { const x0 = fx(zc) - 26 - rng.range(0, 20); for (let x = x0, n = rng.int(4, 7); n > 0 && x > M.xd + 14; n--, x -= rng.range(9, 15)) { const zz = zc + rng.range(-1.2, 1.2), y = H(x, zz), r = rng.range(0.85, 1.1);
      const hgt = rng.range(1.3, 1.7), lx = rng.range(-0.12, 0.12), lz = rng.range(-0.12, 0.12), fresh = rng.range(0, 0.12); let pr = r * 0.95, py = y - 0.15;
      for (const [f, rr, lt] of [[0.35, 0.98, 0.86], [0.62, 0.86, 0.96], [0.82, 0.62, 1.05], [0.95, 0.34, 1.12]]) { const ny = y + hgt * f, nr = r * rr; gb.tint = [(0.95 + fresh) * lt, (0.86 + fresh) * lt, 0.58 * lt]; gb.cyl('roofThatch', x + lx * f, zz + lz * f, (pr + nr) / 2, py, ny, 9, 8, 8); pr = nr; py = ny; }
      gb.cone('roofThatch', x + lx, zz + lz, pr, py, hgt * 0.12, 9, 8); gb.tint = null; } } // haycocks in rows, rounded and leaning a little: the meads were mown in July
    for (const zb of [beds[1] + 6, beds[6] + 6, beds[11] + 6]) { const x = M.xd + 0.5, y = H(x, zb); near.setXf(x, zb, Math.PI / 2, y); B(near, -1.6, 0.05, -0.35, 1.6, 0.16, 0.35, 'wood'); near.xf = null; } // plank footbridges over the main drain
    // pollard willows along the main drain, a footbridge of planks over it where the path from the drowner's hut goes
    for (let z = M.z0; z < M.z1; z += rng.range(11, 17)) { const x = M.xd - 3.5 + rng.range(-0.6, 0.6); fl.willow.push([x, H(x, z) - 0.15, z, rng.range(0.55, 0.75)]); cols.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, y0: H(x, z) - 1, y1: H(x, z) + 4 }); }
  }
  // the fair: booths along the road between the gates, their awnings striped; carts drawn up; sacks and crates
  { const a = [17, -34], b = [40, 80], len = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / len, uz = (b[1] - a[1]) / len, ang = Math.atan2(ux, uz), keys = ['stallA', 'stallB', 'stallC'];
    for (const side of [-1, 1]) for (let t = 44; t < len - 6;) { const kind = rng.pick(['booth', 'booth', 'booth', 'trestle', 'tent']), wdt = rng.pick([3, 4, 4, 6]), hw = wdt / 2; t += hw;
      if (rng.chance(side > 0 ? 0.42 : 0.12)) { t += hw + (side > 0 ? rng.range(4, 10) : 3); continue; } // (the west row thinner, with gaps)
      const off = 6.8 + rng.range(-0.4, 3.4), cx = a[0] + ux * t - uz * side * off, cz = a[1] + uz * t + ux * side * off, fa = ang + (side > 0 ? Math.PI / 2 : -Math.PI / 2) + (rng.chance(0.15) ? Math.PI / 2 : 0), [lo] = minH(cx, cz, ang, hw + 0.3, 1.8); gb.setXf(cx, cz, fa + rng.range(-0.2, 0.2), lo);
      if (kind === 'tent') { const k = rng.chance(0.15) ? 'stallA' : 'sail', tt = rng.range(0.88, 1.02), np = Math.max(2, Math.round(wdt / 1.4));
        for (let q = 0; q < np; q++) { const a0 = -hw + q * wdt / np, a1 = a0 + wdt / np; gb.tint = [tt * (q % 2 ? 0.93 : 1), tt * (q % 2 ? 0.91 : 0.98), tt * (q % 2 ? 0.86 : 0.94)]; gb.quad4(k, [a0, 0, -1.8], [a1, 0, -1.8], [a1, 2.55, -0.05], [a0, 2.55, -0.05], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0.6, -1]); gb.quad4(k, [a1, 0, 1.8], [a0, 0, 1.8], [a0, 2.55, 0.05], [a1, 2.55, 0.05], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0.6, 1]); } gb.tint = [tt, tt, tt * 0.94];
        B(gb, -hw - 0.25, 2.55, -0.05, hw + 0.25, 2.65, 0.05, 'woodDark'); // the ridge pole
        for (const [px, pz] of [[-hw - 0.8, -2.6], [hw + 0.8, -2.6], [-hw - 0.8, 2.6], [hw + 0.8, 2.6]]) { const ex = Math.sign(px) * (hw + 0.2); gb.quad4('woodDark', [ex, 2.6, -0.02], [ex, 2.6, 0.02], [px, 0.2, pz + 0.02], [px, 0.2, pz - 0.02], [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]); gb.quad4('woodDark', [px, 0.2, pz - 0.02], [px, 0.2, pz + 0.02], [ex, 2.6, 0.02], [ex, 2.6, -0.02], [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0]); } // guy ropes
        gb.tri(k, [-hw, 0, -1.8], [-hw, 2.6, 0], [-hw, 0, 1.8], [0, 0], [0.5, 1], [1, 0], [-1, 0, 0]); gb.tri(k, [hw, 0, 1.8], [hw, 2.6, 0], [hw, 0, -1.8], [0, 0], [0.5, 1], [1, 0], [1, 0, 0]); gb.tint = null; for (const px of [-hw + 0.08, hw - 0.08]) B(gb, px - 0.05, -0.2, -0.05, px + 0.05, 2.55, 0.05, 'woodDark');
        near.setXf(gb.xf.x, gb.xf.z, gb.xf.ang, lo); for (const [px, pz] of [[-hw - 0.8, -2.6], [hw + 0.8, -2.6], [-hw - 0.8, 2.6], [hw + 0.8, 2.6]]) B(near, px - 0.05, -0.1, pz - 0.05, px + 0.05, 0.25, pz + 0.05, 'wood'); near.xf = null; } // (its pegs)
      else { B(gb, -hw + 0.1, -0.3, -0.9, hw - 0.1, 0.95, -0.2, { side: 'wood', top: 'wood' }, 2, 2);
        if (kind === 'booth') { for (const px of [-hw, hw - 0.12]) for (const pz of [-1.3, 1.2]) B(gb, px, -0.3, pz, px + 0.12, 2.5, pz + 0.12, 'woodDark'); const k = rng.pick(['stallA', 'stallB', 'stallC']);
          gb.quad4(k, [-hw - 0.3, 2.3, -1.7], [hw + 0.3, 2.3, -1.7], [hw + 0.3, 2.75, 1.6], [-hw - 0.3, 2.75, 1.6], [0, 0], [1, 0], [1, 1], [0, 1], [0, 1, 0]); gb.quad4('woodDark', [-hw - 0.3, 2.75, 1.6], [hw + 0.3, 2.75, 1.6], [hw + 0.3, 2.3, -1.7], [-hw - 0.3, 2.3, -1.7], [0, 0], [1, 0], [1, 1], [0, 1], [0, -1, 0]); }
        // the goods: sacks of wool, cheeses, crocks, bolts of cloth
        for (let gx = -hw + 0.5; gx < hw - 0.5; gx += rng.range(0.45, 0.8)) { const g = rng.int(0, 3), [cx3, cz3] = xfP(gb.xf, gx, -0.55); // wool sacks, cheeses, crocks, bolts of cloth
          if (g === 0) { near.tint = [0.85, 0.72, 0.55]; near.setXf(gb.xf.x, gb.xf.z, gb.xf.ang, lo); B(near, gx - 0.22, 0.95, -0.75, gx + 0.22, 1.35, -0.35, 'cloth'); near.xf = null; }
          else if (g === 1) { near.tint = [1.3, 1.1, 0.55]; near.cyl('fBarley', cx3, cz3, 0.17, lo + 0.95, lo + 1.08, 7, 1, 1); }
          else if (g === 2) { near.tint = [0.95, 0.7, 0.6]; near.cyl('roofRed', cx3, cz3, 0.13, lo + 0.95, lo + 1.25, 6, 1, 1); }
          else { near.tint = null; near.setXf(gb.xf.x, gb.xf.z, gb.xf.ang, lo); B(near, gx - 0.3, 0.95, -0.8, gx + 0.3, 1.1, -0.35, rng.pick(['bannerRed', 'roofBlue', 'stallB'])); near.xf = null; } }
        near.tint = null;
        for (let k = 0; k < rng.int(1, 3); k++) { const sx = rng.range(-hw + 0.3, hw - 0.6); B(near, sx, -0.1, 0.5, sx + 0.55, 0.5, 1.0, { side: 'wood', top: 'woodDark' }); } }
      gb.xf = null; col(cx, cz, ang, hw + 0.2, 1.7, lo - 1, lo + 1.0); t += hw + rng.range(0.6, 2.5); }
    // a cookfire by the fair house: a ring of stones, a tripod and its pot
    { const x = 56, z = 58, y = H(x, z); for (let k = 0; k < 9; k++) { const a2 = k / 9 * 6.28; B(near, x + Math.cos(a2) * 0.9 - 0.16, y - 0.1, z + Math.sin(a2) * 0.9 - 0.14, x + Math.cos(a2) * 0.9 + 0.16, y + 0.2, z + Math.sin(a2) * 0.9 + 0.14, 'stone'); }
      for (let k = 0; k < 3; k++) { const a2 = k / 3 * 6.28; near.quad4('woodDark', [x + Math.cos(a2) * 1.1, y, z + Math.sin(a2) * 1.1], [x + Math.cos(a2) * 1.1 + 0.08, y, z + Math.sin(a2) * 1.1], [x + 0.04, y + 1.7, z], [x - 0.04, y + 1.7, z], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 1]); }
      near.cyl('iron', x, z, 0.3, y + 0.45, y + 0.85, 8, 1, 1); col(x, z, 0, 1, 1, y - 1, y + 0.3); (L.smoke = L.smoke || []).push({ x, y: y + 1.2, z, dark: false }); }
    const cart = (x, z, ang, tipped) => { const [y] = minH(x, z, ang, 1, 1.8); gb.setXf(x, z, ang, y + (tipped ? 0.0 : 0.1));
      B(gb, -0.9, 0.55, -1.7, 0.9, 0.7, 1.7, { side: 'woodDark', top: 'wood' }); for (const sx of [-0.92, 0.92]) B(gb, sx - 0.05, 0.7, -1.7, sx + 0.05, 1.05, 1.7, 'woodDark');
      for (const sx of [-0.25, 0.25]) B(gb, sx - 0.06, tipped ? 0.05 : 0.6, -4.2, sx + 0.06, tipped ? 0.15 : 0.7, -1.7, 'woodDark');
      for (const sx of [-1.05, 1.05]) B(gb, sx - 0.07, 0, -0.6, sx + 0.07, 1.15, 0.6, 'woodDark');
      gb.xf = null; col(x, z, ang, 1.1, 1.9, y - 1, y + 1.2); };
    cart(5, 18, 0.3, true); cart(52, 70, 1.4, true); cart(-6, -56, -0.5, true); cart(60, 110, 2.6, false); cart(80, 46, -1.2, true); cart(74, 16, 2.0, true);
    // the fair's pole by the crossing of the ways, its flag up while the fair is open
    { const x = 44, z = 40, y = H(x, z); B(gb, -0.14 + x, y - 0.5, -0.14 + z, 0.14 + x, y + 8.5, 0.14 + z, 'woodDark'); col(x, z, 0, 0.2, 0.2, y - 1, y + 8.5); (L.flags = L.flags || []).push({ x: x + 0.15, y: y + 7.4, z, ang: 0.3, w: 2.2, h: 1.2 }); }
  }
  // the pens: rows of hurdles, back to back with alleys between, most of them full
  { const P = YB.pens, pw = 3.6, pd = 3.0, rows = [], hurd = (x0, z0, x1, z1) => { const len = Math.hypot(x1 - x0, z1 - z0), ang = Math.atan2(x1 - x0, z1 - z0), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, y = H(mx, mz);
      near.setXf(mx, mz, ang, y); for (let t = -len / 2; t <= len / 2 + 0.01; t += len / 2) B(near, -0.035, -0.2, t - 0.035, 0.035, 1.0, t + 0.035, 'wood'); for (const hy of [0.18, 0.48, 0.78]) B(near, -0.02, hy, -len / 2, 0.02, hy + 0.11, len / 2, 'roofThatch'); near.xf = null;
      col(mx, mz, ang, 0.08, len / 2, y - 1, y + 1.05); };
    near.tint = [0.92, 0.9, 0.86]; // (hurdles of split hazel, weathered grey-tan)
    for (const bz of [P.z0 - 2, P.z0 + 20, P.z0 + 42]) { const bx = -38; // a block of 3 pens across by 4 deep, its end to the road
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const x = bx + i * pw, z = bz + j * pd; hurd(x, z, x + pw, z); if (j === 3) hurd(x, z + pd, x + pw, z + pd); hurd(x, z, x, z + pd); if (i === 2) hurd(x + pw, z, x + pw, z + pd);
        if (rng.chance(0.4)) continue; const n = rng.int(6, 11), cl = rng.int(1, 3), cs = []; for (let q = 0; q < cl; q++) cs.push([x + rng.range(0.9, pw - 0.9), z + rng.range(0.8, pd - 0.8)]);
        for (let k = 0; k < n; k++) { const [cx2, cz2] = cs[k % cl], sx = clamp(cx2 + rng.range(-0.7, 0.7), x + 0.35, x + pw - 0.35), sz = clamp(cz2 + rng.range(-0.55, 0.55), z + 0.35, z + pd - 0.35); fl.sheep.push([sx, H(sx, sz) - 0.05, sz, rng.range(0.85, 1.02)]); } } }
    near.tint = null;
    for (let k = 0; k < 5; k++) { const x = P.x1 + 3 + k * 0.5, z = P.z0 + 1, y = H(x, z); near.tint = [1.05, 1.0, 0.92]; for (const hy of [0.15, 0.45, 0.75]) B(near, x, y + hy, z - 1.3, x + 0.05, y + hy + 0.11, z + 1.3, 'roofThatch'); near.tint = null; } // spare hurdles leant together
    { const hx2 = -14, hz2 = P.z0 - 5, y = H(hx2, hz2); gb.tint = [0.95, 0.84, 0.58]; gb.cyl('roofThatch', hx2, hz2, 1.6, y - 0.2, y + 0.5, 9, 8, 8); gb.cone('roofThatch', hx2, hz2, 1.6, y + 0.5, 0.7, 9, 8); gb.tint = null; } // a loose heap of hay for the pens
  }
  // the trough at the foot of the bank's inner face, fed by a spout let through the bank from the carrier
  { const x = -49, z = 2, y = H(x, z); B(gb, x - 0.7, y - 0.3, z - 9, x + 0.7, y + 0.75, z + 9, { side: 'woodDark', top: 'woodDark' }); gb.box(x - 0.55, y + 0.62, z - 8.8, x + 0.55, y + 0.66, z + 8.8, 'water', 2, 2); col(x, z, 0, 0.75, 9, y - 1, y + 0.75);
    const sy = y + 2.1; let sx = x - 1; while (sx > x - 14 && H(sx, z) < sy + 0.3) sx -= 0.5; B(gb, sx - 0.4, sy - 0.12, z - 0.12, x - 0.3, sy + 0.12, z + 0.12, 'woodDark'); /* (let out of the bank's face) */ near.quad4('wStream', [x - 0.35, sy - 0.1, z - 0.08], [x - 0.35, sy - 0.1, z + 0.08], [x - 0.25, y + 0.66, z + 0.08], [x - 0.25, y + 0.66, z - 0.08], [0, 0], [0.1, 0], [0.1, 1], [0, 1], [1, 0, 0]); }
  // the fair house: an upper room on posts, where the steward keeps the book and the fair's court sits; open beneath for the corn and the wool
  { const F = YB.fairhouse, hx = 6.5, hz = 3.4, [lo, hi] = minH(F.x, F.z, F.ang, hx, hz), y = lo; gb.setXf(F.x, F.z, F.ang, y);
    B(gb, -hx - 0.2, -0.6, -hz - 0.2, hx + 0.2, Math.max(0.1, hi - lo + 0.1), hz + 0.2, { side: 'stone', top: 'flag' }, 2, 2); const f0 = Math.max(0.1, hi - lo + 0.1);
    for (const px of [-hx, -hx / 3, hx / 3, hx]) for (const pz of [-hz, hz]) B(gb, px - 0.18, f0, pz - 0.18, px + 0.18, f0 + 2.6, pz + 0.18, 'woodDark');
    B(gb, -hx - 0.3, f0 + 2.6, -hz - 0.3, hx + 0.3, f0 + 2.9, hz + 0.3, { side: 'woodDark', top: 'wood', bottom: 'wood' });
    B(gb, -hx - 0.25, f0 + 2.9, -hz - 0.25, hx + 0.25, f0 + 5.4, hz + 0.25, { side: 'timber', top: null }, 3.2, 2.5);
    for (const px of [-4.5, -1.5, 1.5, 4.5]) { gb.quad4('winB', [px - 0.5, f0 + 3.6, hz + 0.27], [px + 0.5, f0 + 3.6, hz + 0.27], [px + 0.5, f0 + 4.6, hz + 0.27], [px - 0.5, f0 + 4.6, hz + 0.27], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 1]); gb.quad4('winB', [px + 0.5, f0 + 3.6, -hz - 0.27], [px - 0.5, f0 + 3.6, -hz - 0.27], [px - 0.5, f0 + 4.6, -hz - 0.27], [px + 0.5, f0 + 4.6, -hz - 0.27], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1]); }
    hallRoof(gb, 'roofThatch', -hx - 0.7, -hz - 0.7, hx + 0.7, hz + 0.7, f0 + 5.4, 3.0);
    for (let k = 0; k < 9; k++) B(gb, hx + 0.4 + k * 0.32, -0.3, -0.7, hx + 0.72 + k * 0.32, f0 + 2.9 - k * 0.32, 0.7, 'wood'); // the stair up to the room
    gb.xf = null; const fx = F.x, fz = F.z; for (const px of [-hx, -hx / 3, hx / 3, hx]) for (const pz of [-hz, hz]) { const [wx, wz] = xfP(makeXf(fx, fz, F.ang), px, pz); col(wx, wz, 0, 0.22, 0.22, y - 1, y + f0 + 2.6); }
    col(fx, fz, F.ang, hx + 0.3, hz + 0.3, y + f0 + 2.6, y + f0 + 8); }
  // the alehouse by the north gate, where the road comes down off the bank
  const house = (x, z, ang, spec, r) => { const hx = spec.hx || 4.5, hz = spec.hz || 3.5, [lo, hi] = minH(x, z, ang, hx + 0.1, hz + 0.1); gb.setXf(x, z, ang, lo);
    makeBuilding(L.area, gb, r, { fp: { x0: -hx, z0: -hz, x1: hx, z1: hz }, stories: spec.stories || 1, style: spec.style || r.pick(['timber2', 'timber2', 'plaster', 'stone']), roof: 'gable', roofKey: spec.roof || (r.chance(0.8) ? 'roofThatch' : 'roofSlate'), roofTint: [0.8, 0.72, 0.6], doorT: 0.5, h: spec.h, found: hi - lo + 0.6, chimney: 0.9, wealth: spec.wealth ?? 0.8 });
    gb.xf = null;
    const [gx, gz] = xfP(makeXf(x, z, ang), 0, -hz - 6.5); if (spec.garden !== false && r.chance(0.75)) drapePatch(gb, r.chance(0.5) ? 'fGreens' : 'fPlowed', makeXf(gx, gz, ang), -hx, -3, hx, 3, { cell: 3, lift: 0.05, uvFrame: true }); };
  { const A = YB.alehouse; house(A.x, A.z, A.ang, { hx: 5.5, hz: 3.8, stories: 2, style: 'timber2', roof: 'roofThatch', garden: false }, new RNG(5601));
    const [sx, sz] = xfP(makeXf(A.x, A.z, A.ang), 2.2, 4.4), sy = H(sx, sz); B(gb, sx - 0.06, sy - 0.2, sz - 0.06, sx + 0.06, sy + 3.2, sz + 0.06, 'woodDark'); near.setXf(sx, sz, A.ang, sy); near.quad4('sign_tavern', [-0.5, 2.0, 0.1], [0.5, 2.0, 0.1], [0.5, 3.0, 0.1], [-0.5, 3.0, 0.1], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, 1]); near.quad4('sign_tavern', [0.5, 2.0, 0.08], [-0.5, 2.0, 0.08], [-0.5, 3.0, 0.08], [0.5, 3.0, 0.08], [0, 0], [1, 0], [1, 1], [0, 1], [0, 0, -1]); near.xf = null;
    for (let k = 0; k < 2; k++) { const [bx, bz] = xfP(makeXf(A.x, A.z, A.ang), -2 + k * 4, 6.2), by = H(bx, bz); B(near, bx - 0.9, by - 0.1, bz - 0.25, bx + 0.9, by + 0.45, bz + 0.25, 'wood'); } }
  // the drowner's cottage by the pool, the two farms, the villages that share the fair
  house(YB.drowner.x, YB.drowner.z, YB.drowner.ang, { hx: 3.4, hz: 2.8, style: 'timber2', roof: 'roofThatch' }, new RNG(5602));
  YB.farms.forEach((F, k) => { const r = new RNG(5610 + k); house(F.x, F.z, F.ang, { hx: 5, hz: 3.6, stories: 2, wealth: 1 }, r); const [bx, bz] = xfP(makeXf(F.x, F.z, F.ang), 13, 4); house(bx, bz, F.ang + Math.PI / 2, { hx: 7, hz: 4, style: 'timber2', roof: 'roofThatch', garden: false, wealth: 0.5, h: 4.8 }, r);
    for (let q = 0; q < 2; q++) { const [hx2, hz2] = xfP(makeXf(F.x, F.z, F.ang), -10 - q * 6, 10), y = H(hx2, hz2); gb.cyl('roofThatch', hx2, hz2, 2.2, y - 0.3, y + 2.4, 9, 3, 2); gb.cone('roofThatch', hx2, hz2, 2.35, y + 2.4, 1.7, 9, 3); cols.push({ x0: hx2 - 2.2, z0: hz2 - 2.2, x1: hx2 + 2.2, z1: hz2 + 2.2, y0: y - 1, y1: y + 4 }); } }); // ricks of hay by the farm
  for (const V of YB.villages) { const r = new RNG(5700 + V.n), road = YB.ways[0].P;
    for (let k = 0; k < V.n; k++) { const a = k / V.n * Math.PI * 2 + r.range(-0.2, 0.2), rr = (V.n > 6 ? 46 : 26) + r.range(-8, 14); let x = V.x + Math.cos(a) * rr, z = V.z + Math.sin(a) * rr * 0.75;
      if (L.rD[L.at(clamp(Math.round((x + L.R) / L.C), 0, L.N - 1), clamp(Math.round((z + L.R) / L.C), 0, L.N - 1))] < 26 || L.best[L.at(clamp(Math.round((x + L.R) / L.C), 0, L.N - 1), clamp(Math.round((z + L.R) / L.C), 0, L.N - 1))] < 5) continue;
      house(x, z, Math.atan2(V.x - x, V.z - z) + Math.PI + r.range(-0.3, 0.3), { stories: r.chance(0.25) ? 2 : 1 }, r); }
    if (V.church) { const [cx, cz] = V.church, ang = 0.1, [lo, hi] = minH(cx, cz, ang, 9, 4); gb.setXf(cx, cz, ang, lo);
      makeBuilding(L.area, gb, r, { fp: { x0: -8, z0: -3.6, x1: 8, z1: 3.6 }, stories: 1, h: 5.4, style: 'stone', roof: 'gable', roofKey: 'roofSlate', doorT: 0.2, found: hi - lo + 0.6, wealth: 1.2 }); gb.xf = null;
      const [tx, tz] = xfP(makeXf(cx, cz, ang), -10.2, 0), [tlo] = minH(tx, tz, ang, 2.8, 2.8); gb.setXf(tx, tz, ang, tlo); gb.tint = [1.02, 0.98, 0.9]; B(gb, -3.4, -0.8, -3.4, 3.4, 2.2, 3.4, { side: 'stone', top: 'stone' }, 2, 2); B(gb, -3.0, 2.2, -3.0, 3.0, 18.0, 3.0, { side: 'stone', top: 'stone' }, 2, 2); B(gb, -3.15, 18.0, -3.15, 3.15, 18.4, 3.15, 'stone');
      for (const [fx2, fz2, nx2] of [[0, 3.02, [0, 0, 1]], [0, -3.02, [0, 0, -1]]]) gb.quad4('doorDark', [-0.7, 15.4, fz2], [0.7, 15.4, fz2], [0.7, 17.3, fz2], [-0.7, 17.3, fz2], [0, 0], [1, 0], [1, 1], [0, 1], nx2); // the belfry's openings
      for (const fx3 of [3.02, -3.02]) gb.quad4('doorDark', [fx3, 15.4, 0.7], [fx3, 15.4, -0.7], [fx3, 17.3, -0.7], [fx3, 17.3, 0.7], [0, 0], [1, 0], [1, 1], [0, 1], [Math.sign(fx3), 0, 0]);
      gb.tint = null; hallRoof(gb, 'roofSlate', -3.2, -3.2, 3.2, 3.2, 18.4, 4.6); gb.xf = null; col(tx, tz, ang, 3.4, 3.4, tlo - 1, tlo + 23); }
    // the closes round the village: small hedged fields for the house cows and the horses, gates where the ways go through; an orchard
    const closes = YB.closes = YB.closes || [];
    for (let k = 0; k < (V.n > 6 ? 7 : 4); k++) { const a = k / (V.n > 6 ? 7 : 4) * 6.28 + r.range(-0.25, 0.25), d = (V.n > 6 ? 112 : 78) + r.range(-10, 14), cx = V.x + Math.cos(a) * d, cz = V.z + Math.sin(a) * d * 0.85, hx = r.range(26, 42), hz = r.range(20, 32), ca = a + r.range(-0.3, 0.3), xf = makeXf(cx, cz, ca);
      const ki = L.at(clamp(Math.round((cx + L.R) / L.C), 0, L.N - 1), clamp(Math.round((cz + L.R) / L.C), 0, L.N - 1)); if (L.rD[ki] < L.rW[ki] + hx || Math.max(Math.abs(cx), Math.abs(cz)) > L.R - 50) continue;
      closes.push({ xf, hx, hz }); const cs = [[-hx, -hz], [hx, -hz], [hx, hz], [-hx, hz]].map(([a2, b2]) => xfP(xf, a2, b2));
      for (let e = 0; e < 4; e++) { const [ax, az] = cs[e], [bx, bz] = cs[(e + 1) % 4], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 6); for (let q = 0; q < n; q++) { const x0 = lerp(ax, bx, q / n), z0 = lerp(az, bz, q / n), x1 = lerp(ax, bx, (q + 1) / n), z1 = lerp(az, bz, (q + 1) / n), kk = L.at(clamp(Math.round(((x0 + x1) / 2 + L.R) / L.C), 0, L.N - 1), clamp(Math.round(((z0 + z1) / 2 + L.R) / L.C), 0, L.N - 1)); if (L.best[kk] < 4 || L.rD[kk] < L.rW[kk] + 4) continue; hedge(x0, z0, x1, z1, r); if (r.chance(0.07)) fl[r.pick(['oak0', 'oak1', 'thorn'])].push([x0, L.heightAt(x0, z0) - 0.15, z0, r.range(0.8, 1.05)]); } }
      if (r.chance(0.6)) for (let q = 0; q < r.int(2, 6); q++) { const [sx, sz] = xfP(xf, r.range(-hx + 4, hx - 4), r.range(-hz + 4, hz - 4)); fl.sheep.push([sx, L.heightAt(sx, sz) - 0.05, sz, r.range(0.85, 1.05)]); } }
    { const a = r.range(0, 6.28), ox = V.x + Math.cos(a) * (V.n > 6 ? 62 : 40), oz = V.z + Math.sin(a) * (V.n > 6 ? 62 : 40), xf = makeXf(ox, oz, a); for (let i = -2; i <= 2; i++) for (let j = -1; j <= 2; j++) { const [tx, tz] = xfP(xf, i * 6 + r.range(-0.5, 0.5), j * 6 + r.range(-0.5, 0.5)), kk = L.at(clamp(Math.round((tx + L.R) / L.C), 0, L.N - 1), clamp(Math.round((tz + L.R) / L.C), 0, L.N - 1)); if (L.best[kk] < 3 || L.rD[kk] < L.rW[kk] + 3) continue; fl[r.pick(['oak2', 'oak1'])].push([tx, L.heightAt(tx, tz) - 0.15, tz, r.range(0.42, 0.55)]); } } // (an orchard: low, round-headed trees in rows)
    drapeDisc(gb, 'gGrass', V.x, V.z, V.n > 6 ? 16 : 9, { segs: 18, rings: 3, lift: 0.04 }); }
  // the fields: furlongs of strips, each strip its own crop, grass baulks between; the open fields of the villages round about
  yarnFields(L, gb, fl);
  // hedges along the lanes to the farms and Holley, and round the closes by the villages
  { const P = YB.ways[0].P.filter(([x]) => x < -440 && x > -650); for (const side of [-1, 1]) { const E = offsetLine(P, side * 4.6); for (let k = 1; k < E.length; k += 2) { const [ax, az] = E[k - 1], [bx, bz] = E[Math.min(E.length - 1, k + 1)], kk = L.at(clamp(Math.round((ax + L.R) / L.C), 0, L.N - 1), clamp(Math.round((az + L.R) / L.C), 0, L.N - 1)); if (L.rD[kk] < L.rW[kk] + 12) continue; hedge(ax, az, bx, bz, rng); } } } // the last of the road into Stanhollow, between hedges
  for (const id of ['eastfarm', 'westfarm', 'holley', 'kelfield', 'fair']) { const P = YB.ways.find(w => w.id === id).P; for (const side of [-1, 1]) { const E = offsetLine(P, side * 4.2); for (let k = 1; k < E.length; k += 2) { const [ax, az] = E[k - 1], [bx, bz] = E[Math.min(E.length - 1, k + 1)]; if (YB.inMead(ax, az, 6) || (ax > -95 && ax < 160 && az > -200 && az < 180 && yarnRampart(ax, az)[0] < 30) || L.bridges.some(b => Math.hypot(ax - b.x, az - b.z) < b.half + 50) || (id === 'fair' && az < 300)) continue; if (L.rD[L.at(clamp(Math.round((ax + L.R) / L.C), 0, L.N - 1), clamp(Math.round((az + L.R) / L.C), 0, L.N - 1))] < 14) continue; hedge(ax, az, bx, bz, rng); } } }
}
// the open fields: round each village its furlongs, blocks of strips lying this way and that, a grass headland between them; each strip its
// own crop. The downs stay sheep-walk, the valley floor meadow and pasture, the fort's ground open
function yarnFields(L, gb, fl) {
  const rng = new RNG(5801), crops = [['fWheat', 0.3], ['fBarley', 0.22], ['fPlowed', 0.16], ['fGreens', 0.06], ['fMeadow', 0.26]], pick = () => { let r = rng.next(); for (const [k, p] of crops) { if (r < p) return k; r -= p; } return 'fWheat'; };
  const free = (x, z) => { const i = clamp(Math.round((x + L.R) / L.C), 0, L.N - 1), j = clamp(Math.round((z + L.R) / L.C), 0, L.N - 1), k = L.at(i, j);
    if (L.rD[k] < L.rW[k] + 18 || L.best[k] < 9 || yarnWood(x, z) > 0.2 || YB.inMead(x, z, 10)) return false;
    if (x > -110 && x < 175 && z > -215 && z < 195 && yarnRampart(x, z)[0] < 36) return false;
    if (Math.abs(x - yarnRiverX(z)) < 70) return false; // (the river's own meadow)
    for (const V of YB.villages) if (Math.hypot(x - V.x, z - V.z) < (V.n > 6 ? 75 : 45)) return false;
    for (const F of YB.farms) if (Math.hypot(x - F.x, z - F.z) < 28) return false;
    for (const Cl of YB.closes || []) { const dx = x - Cl.xf.x, dz = z - Cl.xf.z, lx = dx * Cl.xf.c - dz * Cl.xf.s, lz = dx * Cl.xf.s + dz * Cl.xf.c; if (Math.abs(lx) < Cl.hx + 8 && Math.abs(lz) < Cl.hz + 8) return false; }
    if (x - 0.35 * z > 290 && Math.hypot(x - 560, z + 478) > 320) return false; // the downs: sheep-walk, except round Holley
    return Math.max(Math.abs(x), Math.abs(z)) < L.R - 6; };
  const fields = [[-560, -470, 380], [78, 560, 330], [560, -478, 300], [-640, 420, 300]], done = [];
  for (const [vx, vz, vr] of fields) for (let gz = vz - vr; gz <= vz + vr; gz += 125) for (let gx = vx - vr; gx <= vx + vr; gx += 125) {
    const cx = gx + rng.range(-35, 35), cz = gz + rng.range(-35, 35); if (Math.hypot(cx - vx, cz - vz) > vr || !free(cx, cz) || done.some(([x, z]) => Math.hypot(x - cx, z - cz) < 95)) continue; done.push([cx, cz]);
    const w = rng.range(130, 180), d = rng.range(115, 165), ang = rng.range(-0.5, 0.5) + (rng.chance(0.5) ? Math.PI / 2 : 0), xf = makeXf(cx, cz, ang), sw = rng.range(8, 11), long = d / 2;
    for (let s0 = -w / 2; s0 < w / 2 - sw * 0.5; s0 += sw) { const key = pick(), a = s0 + 0.6, b = s0 + sw - 0.6, n = Math.ceil(long * 2 / 6), ok = [];
      for (let q = 0; q <= n; q++) { const t = -long + q * long * 2 / n, [x, z] = xfP(xf, (a + b) / 2, t); ok.push(free(x, z)); }
      let run = null; const flush = () => { if (run && run[1] - run[0] > 14) drapePatch(gb, key, xf, a, run[0], b, run[1], { cell: 4, lift: 0.05 }); run = null; };
      for (let q = 0; q <= n; q++) { const t = -long + q * long * 2 / n; if (ok[q]) { if (!run) run = [t, t]; run[1] = t; } else flush(); } flush(); }
  }
}
// the plants: the hanger and the copses, alder and willow by the river, thorns on the old rampart, an oak or two in the fair field; tufts,
// flowers and weeds in the turf, rushes along the water and in the meads' drains
function yarnPlants(L, fl, cols) {
  const rng = new RNG(5901), R = L.R, H = (x, z) => L.heightAt(x, z);
  const tree = (kind, x, z, s) => { const h = H(x, z); fl[kind].push([x, h - 0.15, z, s]); const def = WILD_KINDS[kind]; if (def[4]) cols.push({ x0: x - 0.35, z0: z - 0.35, x1: x + 0.35, z1: z + 0.35, y0: h - 1, y1: h + def[4] * s }); };
  const blocked = (x, z, r) => { const k = L.at(clamp(Math.round((x + R) / L.C), 0, L.N - 1), clamp(Math.round((z + R) / L.C), 0, L.N - 1)); if (L.rD[k] < L.rW[k] + r * 0.5 + 0.6 || L.best[k] < r) return true; for (const c of cols) if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true; return false; };
  const colHash = new SHash(16); for (const c of cols) colHash.add(c, [c.x0, c.z0, c.x1, c.z1]);
  const near = (x, z, r) => { for (const c of colHash.query(x - r, z - r, x + r, z + r)) if (x > c.x0 - r && x < c.x1 + r && z > c.z0 - r && z < c.z1 + r) return true; return false; };
  const fieldAt = (x, z) => false; // (the strips are drapes: their crops stand in the texture)
  const SP = 5;
  for (let z = -R + 2; z < R - 2; z += SP) for (let x = -R + 2; x < R - 2; x += SP) {
    const px = x + rng.range(0, SP), pz = z + rng.range(0, SP), k = L.at(clamp(Math.round((px + R) / L.C), 0, L.N - 1), clamp(Math.round((pz + R) / L.C), 0, L.N - 1)), h = L.H[k];
    if (h < SEA + 1.2) continue;
    const wet = L.rD[k] - L.rW[k];
    if (wet < 1.2) continue;
    if (wet < 4 && rng.chance(0.7)) { fl.reeds.push([px, H(px, pz) - 0.1, pz, rng.range(0.8, 1.2)]); continue; }
    const w = yarnWood(px, pz);
    if (w > 0.2 && rng.chance(0.55 * w) && L.best[k] > 4 && !near(px, pz, 3)) { const s = px - 0.35 * pz; tree(s > 140 && s < 270 ? rng.pick(['beech', 'beech', 'oak0', 'oak1', 'oak2']) : wet < 26 ? rng.pick(['willow', 'oak2', 'willow']) : rng.pick(['oak0', 'oak1', 'oak2', 'beech']), px, pz, rng.range(0.75, 1.1)); continue; }
    if (w > 0.2 && rng.chance(0.25 * w)) { fl[rng.chance(0.5) ? 'bush' : 'fern'].push([px, H(px, pz) - 0.1, pz, rng.range(0.7, 1.1)]); continue; }
  }
  // thorns and an ash or two on the old rampart and in the fair's ground; a few field trees in the hedgerows and on the downs
  for (let k = 0; k < YB.rampart.length; k += 2) { if (YB.gates.some(g => Math.abs(YB.rampart.L[k] - g) < 12)) continue; const [x, z] = YB.rampart[k]; if (rng.chance(0.55)) fl.tgrass.push([x + rng.range(-1.5, 1.5), H(x, z) - 0.05, z + rng.range(-1.5, 1.5), rng.range(0.9, 1.3)]); } // the crest: rank tussocks
  for (let k = 0; k < YB.rampart.length; k += 4) { if (!rng.chance(0.55)) continue; const [x, z] = YB.rampart[k], [s, Lr] = [rng.range(-6, 4), 0]; const dx = rng.range(-3, 3), x2 = x + dx, z2 = z + rng.range(-3, 3); if (YB.gates.some(g => Math.abs(YB.rampart.L[k] - g) < 14)) continue; if (near(x2, z2, 3)) continue; tree(rng.chance(0.7) ? 'thorn' : rng.pick(['oak1', 'bushB']), x2, z2, rng.range(0.7, 1.0)); }
  for (const [x, z, k] of [[78, -10, 'oak0'], [-28, 60, 'oak2'], [92, 60, 'oak1']]) if (!near(x, z, 4)) tree(k, x, z, rng.range(0.9, 1.15));
  for (let q = 0; q < 900; q++) { const x = rng.range(-R + 20, R - 20), z = rng.range(-R + 20, R - 20), s = x - 0.35 * z; if (s < 255 || yarnWood(x, z) > 0.1 || near(x, z, 3) || blocked(x, z, 3)) continue; // juniper and thorn on the downs, in drifts
    if (rng.next() > 0.35 * smoothstep(-0.1, 0.4, fbm(x / 70, z / 70, 2, 5921))) continue; if (rng.chance(0.55)) tree('cypress', x, z, rng.range(0.32, 0.5)); else fl[rng.chance(0.5) ? 'thorn' : 'bushB'].push([x, H(x, z) - 0.1, z, rng.range(0.6, 0.95)]); }
  for (let q = 0; q < 14; q++) { const x = 228 + rng.range(-25, 25), z = -78 + rng.range(-35, 35); if (near(x, z, 2) || blocked(x, z, 2)) continue; if (rng.chance(0.6)) tree('cypress', x, z, rng.range(0.32, 0.5)); else fl.thorn.push([x, H(x, z) - 0.1, z, rng.range(0.6, 0.9)]); } // juniper by the green lane at the edge
  for (const [fx, fz, n] of [[420, -160, 46], [380, 120, 34], [-200, -380, 20], [520, -330, 26], [175, -45, 38]]) for (let k = 0; k < n; k++) { const a = rng.range(0, 6.28), r = 30 * Math.sqrt(rng.next()), x = fx + Math.cos(a) * r * 1.4, z = fz + Math.sin(a) * r; if (blocked(x, z, 1) || near(x, z, 1)) continue; fl.sheep.push([x, H(x, z) - 0.05, z, rng.range(0.85, 1.05)]); } // flocks on the downs and the river meadow
  // the turf: tufts in drifts, flowers, weeds by the ways and in the fair's trodden ground, rushes in the meads
  const SF = 2.4;
  for (let z = -R + 1; z < R - 1; z += SF) for (let x = -R + 1; x < R - 1; x += SF) {
    const px = x + rng.range(0, SF), pz = z + rng.range(0, SF), k = L.at(clamp(Math.round((px + R) / L.C), 0, L.N - 1), clamp(Math.round((pz + R) / L.C), 0, L.N - 1));
    if (L.H[k] < SEA + 1) continue; const wet = L.rD[k] - L.rW[k]; if (wet < 0.8 || L.best[k] < 0.6) continue;
    const drift = fbm(px / 18, pz / 18, 2, 5911), tr = yarnTrodden(px, pz), md = YB.inMead(px, pz, 0);
    if (near(px, pz, 0.6)) continue;
    let pick = null, s = rng.range(0.7, 1.1);
    if (md) { if (rng.chance(0.18)) pick = rng.chance(0.4) ? 'rush' : 'tgrass'; }
    else if (wet < 6) { if (rng.chance(0.4)) pick = rng.chance(0.5) ? 'rush' : 'reeds'; }
    else if (tr > 0.4) { if (rng.chance(0.05)) pick = 'pebbles'; }
    else if (L.best[k] < 3) { if (rng.chance(0.3)) pick = 'weed' + rng.int(0, 2); }
    else { const p = 0.1 + 0.25 * smoothstep(-0.1, 0.4, drift); if (rng.chance(p)) pick = rng.chance(0.12) ? 'flowers' + rng.int(0, 3) : rng.chance(0.25) ? 'tgrass' : 'tufts'; }
    if (pick) fl[pick].push([px, L.heightAt(px, pz) - 0.04, pz, s]);
  }
}
