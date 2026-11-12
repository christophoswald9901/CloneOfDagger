/* =====================================================================
   Music: composed pieces played by a small Web Audio orchestra.
   The sound aims at a late-90s General MIDI orchestra, played cleaner:
   string sections, choir, horn, flute, oboe, a plucked harp, pizzicato,
   timpani, seated left to right in a shared hall. Plucked and struck
   instruments are physically modelled into buffers once per note; the
   held ones are live oscillators. Pieces are chosen by place, time and
   weather, play through, then the world is left to itself for a while.
   ===================================================================== */

/* ---------------- synth ---------------- */
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);
const panner = (c, p) => { if (!c.createStereoPanner) return c.createGain(); const n = c.createStereoPanner(); n.pan.value = p; return n; };
// plucked strings (Karplus-Strong): t60 = ring time at A3, bright = excitation colour, pos = pluck position, damp = loop filter
const PLUCKS = {
  harp: { t60: 4.5, max: 5, bright: 0.5, pos: 0.17, damp: 0.38, seed: 1 },
  pizz: { t60: 0.7, max: 1.4, bright: 0.28, pos: 0.23, damp: 0.5, seed: 2 },
};
const Synth = {
  cache: new WeakMap(),
  res(c) { // per-context shared resources: wavetables, noise, reverb impulse, note buffers
    let r = this.cache.get(c); if (r) return r;
    const wave = (amps) => { const re = new Float32Array(amps.length), im = new Float32Array(amps.length); amps.forEach((a, i) => { im[i] = a; }); return c.createPeriodicWave(re, im); };
    const sr = c.sampleRate, nl = sr * 2, noise = c.createBuffer(1, nl, sr), nd = noise.getChannelData(0);
    const rng = mulberry32(77); for (let i = 0; i < nl; i++) nd[i] = rng() * 2 - 1;
    // hall: a few early reflections, then a decaying tail that darkens as it fades (T60 about 2.8 s)
    const il = Math.floor(sr * 3.4), ir = c.createBuffer(2, il, sr), pre = Math.floor(sr * 0.028);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = pre; i < il; i++) { const x = (i - pre) / sr; const k = 0.5 * Math.exp(-x * 1.6) + 0.04; lp += (rng() * 2 - 1 - lp) * k; d[i] = lp * Math.exp(-x * 2.45) * (1 - Math.exp(-x * 25)); }
      for (let k = 0; k < 9; k++) d[pre + Math.floor(sr * (0.004 + rng() * 0.075))] += (rng() < 0.5 ? -1 : 1) * 0.9 * Math.exp(-k * 0.22);
      let e = 0; for (let i = 0; i < il; i++) e += d[i] * d[i]; const k = 1 / Math.sqrt(e); for (let i = 0; i < il; i++) d[i] *= k; // unit energy
    }
    r = { flute: wave([0, 1, 0.3, 0.1, 0.035]), noise, ir, notes: new Map() };
    this.cache.set(c, r); return r;
  },
  // a plucked note as a buffer, tuned exactly by playback rate
  pluck(c, kind, n) {
    const R = this.res(c), key = kind + n; let p = R.notes.get(key); if (p) return p;
    const P = PLUCKS[kind], sr = c.sampleRate, f = mtof(n), a = P.damp;
    const N = Math.max(4, Math.round(sr / f + a)), rate = f * (N - a) / sr;
    const t60 = P.t60 * Math.pow(220 / f, 0.45), loss = Math.exp(-6.9 / (f * t60));
    const L = Math.ceil(sr * Math.min(t60, P.max)), buf = c.createBuffer(1, L, sr), d = buf.getChannelData(0);
    const rng = mulberry32(n * 131 + P.seed), ex = new Float32Array(N), line = new Float32Array(N);
    let lp = 0; for (let i = 0; i < N; i++) { lp += (rng() * 2 - 1 - lp) * P.bright; ex[i] = lp; }
    const pp = Math.max(1, Math.round(N * P.pos)); let m = 0;
    for (let i = 0; i < N; i++) { line[i] = ex[i] - ex[(i + pp) % N]; m += line[i]; } m /= N; for (let i = 0; i < N; i++) line[i] -= m;
    let j = 0, peak = 1e-9;
    for (let i = 0; i < L; i++) { const j2 = j + 1 === N ? 0 : j + 1, y = line[j]; d[i] = y; line[j] = loss * ((1 - a) * y + a * line[j2]); j = j2; const ay = y < 0 ? -y : y; if (ay > peak) peak = ay; }
    const fs = Math.floor(L * 0.75); for (let i = fs; i < L; i++) d[i] *= (L - i) / (L - fs);
    const k = 0.8 / peak; for (let i = 0; i < L; i++) d[i] *= k;
    p = { buf, rate }; R.notes.set(key, p); return p;
  },
  // a timpani stroke: inharmonic membrane modes with a slight pitch drop, and the mallet's thump
  drum(c, n) {
    const R = this.res(c), key = 'timp' + n; let p = R.notes.get(key); if (p) return p;
    const sr = c.sampleRate, f = mtof(n), L = Math.ceil(sr * 3), buf = c.createBuffer(1, L, sr), d = buf.getChannelData(0), rng = mulberry32(n);
    for (const [r, amp, tau] of [[1, 1, 1.5], [1.504, 0.5, 1.0], [1.742, 0.3, 0.8], [2.0, 0.24, 0.7], [2.245, 0.15, 0.55], [2.494, 0.1, 0.45]]) {
      let ph = 0; for (let i = 0; i < L; i++) { const t = i / sr; ph += 2 * Math.PI * f * r * (1 + 0.012 * Math.exp(-t / 0.08)) / sr; d[i] += amp * Math.sin(ph) * Math.exp(-t / tau) * (1 - Math.exp(-t / 0.002)); }
    }
    let lp = 0, peak = 1e-9; for (let i = 0; i < L; i++) { lp += (rng() * 2 - 1 - lp) * 0.06; d[i] += lp * 3 * Math.exp(-i / sr / 0.035); peak = Math.max(peak, Math.abs(d[i])); }
    for (let i = 0; i < L; i++) d[i] *= 0.8 / peak;
    p = { buf, rate: 1 }; R.notes.set(key, p); return p;
  },
  playBuf(c, out, p, t, v) {
    const s = c.createBufferSource(); s.buffer = p.buf; s.playbackRate.value = p.rate; const g = c.createGain(); g.gain.value = v;
    s.connect(g); g.connect(out); s.start(t); this.done(s, g);
  },
  // a finished note must leave the graph: Web Audio keeps processing a connected node after its source has stopped,
  // so the cost would otherwise grow with every note played
  done(src, ...nodes) { src.onended = () => nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* already gone */ } }); },
  // a music bus: each instrument has a seat (pan) and a reverb send; dry + hall -> fade -> low cut -> gentle compressor -> dest
  bus(c, dest) {
    const R = this.res(c);
    const fade = c.createGain(); fade.gain.value = 1;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.5; // nothing below what small speakers can play
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4; comp.knee.value = 10;
    const verb = c.createConvolver(); verb.normalize = false; verb.buffer = R.ir;
    const wet = c.createGain(); wet.gain.value = 0.5;
    verb.connect(wet); wet.connect(fade); fade.connect(hp); hp.connect(comp); comp.connect(dest);
    const ch = {}, nodes = [fade, hp, comp, verb, wet];
    for (const [name, v] of Object.entries(INSTRUMENTS)) {
      const g = c.createGain(); g.gain.value = v.level; const p = panner(c, v.pan || 0); g.connect(p); p.connect(fade);
      const s = c.createGain(); s.gain.value = v.send; p.connect(s); s.connect(verb); ch[name] = g; nodes.push(g, p, s);
    }
    return { c, fade, ch, nodes };
  },
  env(g, t, dur, v, a, d, s, r) { // ADSR; returns when the voice can stop
    a = Math.min(a, dur * 0.9 + 0.005);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setTargetAtTime(v * s, t + a, d / 3);
    g.gain.setTargetAtTime(0, t + Math.max(dur, a), r / 4); return t + Math.max(dur, a) + r * 1.6;
  },
  vibrato(c, t, rate, depth, delay, targets) {
    const l = c.createOscillator(); l.frequency.value = rate; const lg = c.createGain();
    lg.gain.setValueAtTime(0, t); lg.gain.setValueAtTime(0, t + delay); lg.gain.linearRampToValueAtTime(depth, t + delay + 0.5);
    l.connect(lg); targets.forEach(p => lg.connect(p)); return l;
  },
};

// a waveform per note with its tone colour baked in (cheaper than filtering every voice live):
// harmonic k gets 1/k, a gentle low-pass at `cut` Hz, and optional formant peaks [[Hz, bandwidth, gain]]
function toneWave(c, key, f, cut, formants = null, floor = 1) {
  const R = Synth.res(c); let w = R.notes.get(key); if (w) return w;
  const K = Math.max(2, Math.min(64, Math.floor(9000 / f))), re = new Float32Array(K + 1), im = new Float32Array(K + 1);
  for (let k = 1; k <= K; k++) {
    const h = k * f; let a = 1 / k / Math.sqrt(1 + Math.pow(h / cut, 4));
    if (formants) { let fg = floor * 0.08; for (const [F, B, A] of formants) fg += A / (1 + Math.pow((h - F) / (B / 2), 2)); a *= fg; }
    im[k] = a;
  }
  w = c.createPeriodicWave(re, im); R.notes.set(key, w); return w;
}
// a string section: four detuned voices split left and right; longer notes get vibrato on two of them
function bowed(c, out, n, t, dur, v, o) {
  const f = mtof(n), a = Math.min(o.a, Math.max(0.08, dur * 0.3)), wave = toneWave(c, o.name + n, f, Math.min(o.maxCut, f * o.bright + 600));
  const g = c.createGain(); const end = Synth.env(g, t, dur, v, a, 2, 0.9, o.rel);
  const pl = panner(c, -o.width), pr = panner(c, o.width);
  const os = [-12, -4, 4, 12].map((dt, i) => { const x = c.createOscillator(); x.setPeriodicWave(wave); x.frequency.value = f; x.detune.value = dt; x.connect(i % 2 ? pr : pl); return x; });
  const l = dur > 0.8 ? Synth.vibrato(c, t, 4.5 + (n % 5) * 0.13, f * o.vib, 0.5, [os[1].frequency, os[2].frequency]) : null;
  pl.connect(g); pr.connect(g); g.connect(out);
  os.forEach((x, i) => { x.start(t + i * 0.006); x.stop(end); }); if (l) { l.start(t); l.stop(end); } Synth.done(os[0], g, pl, pr);
}

// level: channel gain; send: reverb amount; pan: seat on the stage (violins left, celli right, winds in the middle, horns back right)
const INSTRUMENTS = {
  violins: { level: 0.05, send: 0.5, pan: -0.32, play(c, out, n, t, dur, v) { bowed(c, out, n, t, dur, v, { name: 'vn', a: 0.5, rel: 1.1, bright: 2.6, maxCut: 4200, width: 0.5, vib: 0.0045 }); } },
  celli: { level: 0.048, send: 0.4, pan: 0.32, play(c, out, n, t, dur, v) { bowed(c, out, n, t, dur, v, { name: 'vc', a: 0.35, rel: 0.9, bright: 3.5, maxCut: 2200, width: 0.3, vib: 0.0035 }); } },
  choir: { level: 0.09, send: 0.65, pan: 0, play(c, out, n, t, dur, v) { // two voices per note, an open "ah" baked into the waveform
    const f = mtof(n), wave = toneWave(c, 'ch' + n, f, 3500, [[720, 130, 1], [1150, 160, 0.5], [2500, 250, 0.2]], 1);
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.7, 1.5, 0.9, 1.5); const p = panner(c, n % 2 ? 0.35 : -0.35);
    const os = [-8, 7].map(dt => { const x = c.createOscillator(); x.setPeriodicWave(wave); x.frequency.value = f; x.detune.value = dt; x.connect(g); return x; });
    const l = Synth.vibrato(c, t, 5 + (n % 3) * 0.2, f * 0.003, 0.5, [os[0].frequency]);
    g.connect(p); p.connect(out); [...os, l].forEach(x => { x.start(t); x.stop(end); }); Synth.done(os[0], g, p);
  } },
  horn: { level: 0.1, send: 0.6, pan: 0.3, play(c, out, n, t, dur, v) { // brass: the filter opens with the breath, then settles
    const f = mtof(n);
    const os = [-4, 4].map(dt => { const x = c.createOscillator(); x.type = 'sawtooth'; x.frequency.value = f; x.detune.value = dt; return x; });
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1;
    lp.frequency.setValueAtTime(f * 1.2, t); lp.frequency.linearRampToValueAtTime(f * (2 + 3 * v), t + 0.09); lp.frequency.setTargetAtTime(f * (1.6 + 1.6 * v), t + 0.09, 0.25); lp.frequency.setTargetAtTime(f * 1.1, t + dur, 0.1);
    const lp2 = c.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 2200;
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.07, 0.5, 0.8, 0.35);
    const l = Synth.vibrato(c, t, 4.8, f * 0.003, 0.5, os.map(x => x.frequency));
    os.forEach(x => x.connect(lp)); lp.connect(lp2); lp2.connect(g); g.connect(out); [...os, l].forEach(x => { x.start(t); x.stop(end); }); Synth.done(l, g, lp, lp2);
  } },
  flute: { level: 0.155, send: 0.42, pan: -0.12, play(c, out, n, t, dur, v) {
    const R = Synth.res(c), f = mtof(n);
    const o = c.createOscillator(); o.setPeriodicWave(R.flute); o.frequency.setValueAtTime(f * 0.988, t); o.frequency.setTargetAtTime(f, t, 0.03); // a breath's scoop up to pitch
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(8000, f * (3.5 + 2 * v));
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.07, 0.4, 0.82, 0.22);
    const l = Synth.vibrato(c, t, 5.1, f * 0.0045, 0.3, [o.frequency]);
    // breath: a little band-passed noise, with a soft chiff at the start
    const b = c.createBufferSource(); b.buffer = R.noise; b.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.6; bp.Q.value = 1.2;
    const bg = c.createGain(); bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(v * 0.25, t + 0.02); bg.gain.setTargetAtTime(v * 0.05, t + 0.02, 0.05); bg.gain.setTargetAtTime(0, t + dur, 0.05);
    o.connect(lp); lp.connect(g); b.connect(bp); bp.connect(bg); bg.connect(g); g.connect(out);
    o.start(t); l.start(t); b.start(t, (n * 0.037) % 1.5); [o, l, b].forEach(x => x.stop(end)); Synth.done(o, g, lp, bp, bg);
  } },
  reed: { level: 0.105, send: 0.36, pan: 0.14, play(c, out, n, t, dur, v) { // the oboe: two-operator FM with a nasal resonance
    const f = mtof(n);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.setValueAtTime(f * 0.99, t); car.frequency.setTargetAtTime(f, t, 0.025); mod.frequency.setValueAtTime(f * 0.99, t); mod.frequency.setTargetAtTime(f, t, 0.025);
    mg.gain.setValueAtTime(f * (1.6 + v), t); mg.gain.setTargetAtTime(f * (0.9 + 0.5 * v), t + 0.03, 0.12); mg.gain.setTargetAtTime(f * 0.5, t + dur, 0.06);
    const nas = c.createBiquadFilter(); nas.type = 'peaking'; nas.frequency.value = 1300; nas.Q.value = 1.4; nas.gain.value = 5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(5000, f * 6); lp.Q.value = 0.4;
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.045, 0.3, 0.85, 0.16);
    const l = Synth.vibrato(c, t, 5.4, f * 0.004, 0.35, [car.frequency, mod.frequency]);
    mod.connect(mg); mg.connect(car.frequency); car.connect(nas); nas.connect(lp); lp.connect(g); g.connect(out);
    [car, mod, l].forEach(x => { x.start(t); x.stop(end); }); Synth.done(car, g, lp, nas, mg);
  } },
  harp: { level: 0.34, send: 0.45, pan: -0.5, play(c, out, n, t, dur, v) { Synth.playBuf(c, out, Synth.pluck(c, 'harp', n), t, v); } },
  pizz: { level: 0.6, send: 0.38, pan: 0.22, play(c, out, n, t, dur, v) { Synth.playBuf(c, out, Synth.pluck(c, 'pizz', n), t, v); } },
  timp: { level: 0.088, send: 0.5, pan: 0.12, play(c, out, n, t, dur, v) { Synth.playBuf(c, out, Synth.drum(c, n), t, v); } },
  bell: { level: 0.32, send: 0.6, pan: 0.05, play(c, out, n, t, dur, v) { // FM bell, inharmonic modulator
    const f = mtof(n);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(); car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 3, t); mg.gain.setTargetAtTime(f * 0.3, t, 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, 1.1);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out); [car, mod].forEach(x => { x.start(t); x.stop(t + 6); }); Synth.done(car, g, mg);
  } },
};

/* ---------------- score notation ----------------
   A line is space-separated tokens: "D5:1.5" (note:beats), "-:1" (rest), "[A3,C4]:3" (chord), "|" (bar line, checked),
   "pp p mp mf f ff" (dynamics from there on); a trailing ! accents a note, ? softens it.
   Chords are written per bar, bars split by |, several chords in a bar share it: "Dm | C | Bb C | Dm". */
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6] };
const DYN = { pp: 0.5, p: 0.65, mp: 0.82, mf: 1, f: 1.15, ff: 1.3 };
function noteNum(s) { const m = /^([A-G])(b|s|#)?(-?\d)$/.exec(s); if (!m) throw new Error('bad note ' + s); return 12 * (+m[3] + 1) + PC[m[1]] + (m[2] === 'b' ? -1 : m[2] ? 1 : 0); }
function parseChords(str, meter) {
  const out = []; str.split('|').forEach((bar, bi) => {
    const cs = bar.trim().split(/\s+/); const len = meter / cs.length;
    cs.forEach((cname, ci) => { const m = /^([A-G])(b|#)?(.*)$/.exec(cname); out.push({ at: bi * meter + ci * len, len, root: PC[m[1]] + (m[2] === 'b' ? -1 : m[2] ? 1 : 0), ints: QUAL[m[3]] }); });
  }); return out;
}
const chordAt = (cs, b) => { let r = cs[0]; for (const c of cs) if (c.at <= b + 1e-6) r = c; return r; };

// builds one section's events: { b: beat, inst, n, d: beats, v }
class Section {
  constructor(bars, meter, chords) { this.bars = bars; this.meter = meter; this.len = bars * meter; this.ev = []; this.swells = []; this.chords = chords ? parseChords(chords, meter) : null; }
  add(inst, b, n, d, v) { if (b < this.len - 1e-6) this.ev.push({ b, inst, n, d, v }); return this; }
  line(inst, str, vol = 1, from = 0, tr = 0) {
    let b = from, dyn = 1;
    for (const tok of str.trim().split(/\s+/)) {
      if (tok === '|') { if (Math.abs((b - from) / this.meter - Math.round((b - from) / this.meter)) > 1e-6) console.warn(`music: ${inst} bar line at beat ${b} is off the bar`); continue; }
      if (DYN[tok]) { dyn = DYN[tok]; continue; }
      const m = /^(\[[^\]]+\]|[^:]+):([\d.]+)([!?]?)$/.exec(tok); if (!m) throw new Error('bad token ' + tok); const d = +m[2];
      const v = vol * dyn * (m[3] === '!' ? 1.2 : m[3] === '?' ? 0.7 : 1);
      if (m[1][0] === '[') m[1].slice(1, -1).split(',').forEach(s => this.add(inst, b, noteNum(s.trim()) + tr, d, v));
      else if (m[1] !== '-') this.add(inst, b, noteNum(m[1]) + tr, d, v);
      b += d;
    }
    if (b > this.len + 1e-6) console.warn(`music: ${inst} runs ${b - this.len} beats past its section`);
    return this;
  }
  // held chords, voice-led inside [lo, hi]; o.from/o.to limit the beats, o.pulse re-strikes every so many beats
  pad(inst, vol, lo = 53, hi = 70, o = {}) {
    let prev = null; const from = o.from || 0, to = o.to ?? this.len;
    for (const ch of this.chords) {
      if (ch.at < from - 1e-6 || ch.at >= to - 1e-6) continue;
      const pcs = ch.ints.slice(0, 4).map(i => (ch.root + i) % 12); let best = null, bc = 1e9;
      const opts = pcs.map(p => { const r = []; for (let n = lo; n <= hi; n++) if (n % 12 === (p + 12) % 12) r.push(n); return r; });
      const walk = (i, acc) => {
        if (i === opts.length) {
          const s = [...acc].sort((a, b) => a - b); if (s[s.length - 1] - s[0] > 14) return;
          for (let k = 1; k < s.length; k++) if (s[k] - s[k - 1] < 2 && s.length > 3) return;
          const cost = prev ? s.reduce((t, n, k) => t + Math.abs(n - (prev[k] ?? prev[prev.length - 1])), 0) : Math.abs(s[0] + s[s.length - 1] - lo - hi);
          if (cost < bc) { bc = cost; best = s; } return;
        }
        for (const n of opts[i]) walk(i + 1, [...acc, n]);
      };
      walk(0, []); if (!best) best = opts.map(r => r[0]).filter(x => x !== undefined); prev = best;
      if (o.pulse) for (let x = 0; x < ch.len - 1e-6; x += o.pulse) best.forEach(n => this.add(inst, ch.at + x, n, o.pulse * 0.95, vol * (x === 0 ? 1 : 0.85)));
      else best.forEach(n => this.add(inst, ch.at, n, ch.len, vol));
    } return this;
  }
  // broken chords: pattern of [beat in bar, tone, accent]; tones: 0 root, 1 5th, 2 8ve, 3 3rd above, 4 5th above, 5 two 8ves, 6 9th, 7 3rd
  arp(inst, vol, pattern, base = 48, dur = 2, o = {}) {
    const from = o.from || 0, to = o.to ?? this.len;
    for (let bar = 0; bar < this.bars; bar++) for (const [pb, ti, acc] of pattern) {
      const b = bar * this.meter + pb; if (b < from - 1e-6 || b >= to - 1e-6) continue;
      const ch = chordAt(this.chords, b), r = base + ((ch.root - base) % 12 + 12) % 12;
      const tones = [r, r + ch.ints[2], r + 12, r + 12 + ch.ints[1], r + 12 + ch.ints[2], r + 24, r + 14, r + ch.ints[1]];
      this.add(inst, b, tones[ti], dur, vol * (acc || 1));
    } return this;
  }
  strum(inst, b, notes, gap, vol) { notes.trim().split(/\s+/).forEach((s, i) => this.add(inst, b + i * gap, noteNum(s), 2, vol)); return this; }
  roll(inst, b, n, beats, v0, v1, step = 0.125) { for (let x = 0; x < beats - 1e-6; x += step) this.add(inst, b + x, n, step * 2, v0 + (v1 - v0) * x / beats); return this; }
  // a hairpin: velocities from b0 to b1 scaled from m0 to m1 (all instruments, or the listed ones)
  swell(b0, b1, m0, m1, insts = null) { this.swells.push({ b0, b1, m0, m1, insts }); return this; }
  finish() {
    for (const w of this.swells) for (const e of this.ev) if (e.b >= w.b0 && e.b < w.b1 && (!w.insts || w.insts.includes(e.inst))) e.v *= w.m0 + (w.m1 - w.m0) * (e.b - w.b0) / (w.b1 - w.b0);
    return this;
  }
}

/* ---------------- pieces ---------------- */
// Open Country: a clear day out in the wild. D dorian in 3/4; the tune passes from flute to oboe (in F major) and back,
// a middle section builds the opening motif up through the strings to a climax, and it ends on the dorian G-major colour.
function pieceOpenCountry() {
  const M = 3;
  const CH_A = 'Dm | G | Dm | C | Bb | F | Gm | A | Dm | G | Am | F | Bb | C | Gm A | Dm';
  const THEME = `D5:1 E5:0.5 F5:0.5 A5:1 | B5:1.5 A5:0.5 G5:1 | A5:1 F5:1 D5:1 | E5:2 C5:1 |
    D5:1.5 C5:0.5 Bb4:1 | A4:1 C5:1 F5:1 | E5:1 D5:0.5 C5:0.5 Bb4:1 | A4:3 |
    D5:1 E5:0.5 F5:0.5 A5:1 | B5:1.5 A5:0.5 G5:1 | C6:1 B5:0.5 A5:0.5 E5:1 | F5:2 A5:1 |
    F5:1.5 D5:0.5 Bb4:1 | C5:1 E5:1 G5:1 | Bb5:1 A5:0.5 E5:1.5 | D5:3`;
  const COUNTER = 'F4:2 A4:1 | G4:3 | E4:1.5 G4:1.5 | A4:2 C5:1 | Bb4:2 A4:1 | G4:2 E4:1 | D4:1.5 E4:1.5 | F4:3';
  const CELLI_A = 'D3:3 | B2:3 | A2:3 | C3:3 | Bb2:3 | A2:3 | G2:3 | A2:3 | D3:2 C3:1 | B2:3 | A2:3 | F2:3 | Bb2:2 A2:1 | C3:3 | G2:1.5 A2:1.5';
  const harpA = [[0, 0, 1], [0.5, 1, 0.7], [1, 2, 0.8], [1.5, 3, 0.75], [2, 2, 0.7], [2.5, 1, 0.65]];
  const harpB = [[0, 0, 1], [1, 2, 0.8], [1.5, 3, 0.75], [2, 4, 0.75], [2.5, 3, 0.65]];
  const harpC = [[0, 0, 0.9], [0.5, 1, 0.6], [1, 2, 0.7], [1.5, 6, 0.65], [2, 4, 0.7], [2.5, 2, 0.6]];
  const s = [];
  // intro: the harp alone, then a held D under a quiet choir, and the horn gives the motif from far off
  s.push(new Section(8, M, 'Dm | Dm | Bb | C | Dm | Bb | Gm | A')
    .arp('harp', 0.7, harpA, 45)
    .line('celli', '-:6 | D2:15 A1:3', 0.8)
    .pad('choir', 0.5, 50, 66, { from: 6 })
    .line('horn', '-:12 | A3:1 D4:1.5 E4:0.5 | F4:2 E4:1 | D4:1.5 C4:0.5 Bb3:1 | A3:3', 0.8)
    .swell(0, 24, 0.6, 1));
  // A: the flute's tune; held strings, then the violins answer with a line of their own
  s.push(new Section(16, M, CH_A)
    .arp('harp', 0.75, harpA, 45)
    .line('flute', THEME, 1)
    .pad('violins', 0.55, 53, 69, { to: 24 })
    .line('violins', '-:24 | ' + COUNTER, 0.7)
    .line('celli', CELLI_A + ' | D2:3', 0.85)
    .pad('choir', 0.35, 50, 66, { from: 24 }));
  // B: into F major; the oboe sings the tune's major cousin over pulsing strings and horns, the flute floats above
  s.push(new Section(16, M, 'F | Bb | F | C | Dm | Bb | Gm | C | F | Bb | Am | Dm | Bb | C | Bb C | F')
    .arp('harp', 0.6, harpB, 45)
    .line('reed', `F4:1 G4:0.5 A4:0.5 C5:1 | D5:1.5 C5:0.5 Bb4:1 | A4:1 C5:1 F5:1 | E5:2 C5:1 |
      D5:1 C5:0.5 Bb4:0.5 A4:1 | Bb4:1 D5:1 F5:1 | G5:1.5 F5:0.5 D5:1 | E5:3 |
      F5:1 E5:0.5 D5:0.5 C5:1 | D5:1 Bb4:1 F4:1 | E5:1.5 D5:0.5 C5:1 | A4:3 |
      Bb4:1 C5:1 D5:1 | E5:1 G5:1 E5:1 | F5:1 D5:0.5 E5:1.5 | F5:3`, 1)
    .line('flute', '-:24 | A5:3 | F5:3 | E5:1.5 G5:1.5 | F5:3 | F5:1.5 D5:1.5 | G5:3 | F5:1.5 G5:1.5 | A5:3', 0.6)
    .pad('violins', 0.45, 53, 69, { pulse: 1 })
    .line('horn', `[A3,C4]:3 | [Bb3,D4]:3 | [A3,C4]:3 | [G3,C4]:3 | [A3,D4]:3 | [Bb3,D4]:3 | [Bb3,D4]:3 | [G3,C4]:3 |
      -:18 | [F3,D4]:1.5 [G3,C4]:1.5 | [F3,A3]:3`, 0.55)
    .line('celli', 'F2:3 | D2:3 | F2:2 A2:1 | C3:3 | D3:3 | Bb2:3 | G2:3 | C3:3 | F2:3 | Bb2:2 D3:1 | A2:3 | D3:3 | Bb2:3 | C3:3 | Bb2:1.5 C3:1.5 | F2:3', 0.8)
    .arp('pizz', 0.7, [[0, 0, 1], [1, 1, 0.7], [2, 2, 0.7]], 38, 1, { from: 24 }));
  // C: the motif climbs through G minor, E-flat, A minor, F, B-flat, handed between horn, flute, oboe and violins, to a climax on A
  s.push(new Section(12, M, 'Gm | Eb | Am | F | Bb | Gm | C | Am | Bb | C | Asus4 | A')
    .arp('harp', 0.55, harpC, 45)
    .line('horn', 'G3:1 A3:0.5 Bb3:0.5 D4:1 | -:3 | -:3 | -:3 | Bb3:1 C4:0.5 D4:0.5 F4:1 | D4:3 | E4:3 | E4:3 | [D4,F4]:3 | [E4,G4]:3 | [D4,A4]:3 | [Cs4,A4]:3', 0.85)
    .line('flute', '-:3 | Eb5:1 F5:0.5 G5:0.5 Bb5:1 | -:3 | F5:1 G5:0.5 A5:0.5 C6:1 | -:3 | -:3 | E5:1 F5:0.5 G5:0.5 C6:1 | C6:1.5 B5:0.5 A5:1 | D6:1.5 C6:0.5 Bb5:1 | C6:1 D6:1 E6:1 | D6:3 | Cs6:3', 0.85)
    .line('reed', '-:6 | A4:1 B4:0.5 C5:0.5 E5:1', 0.9)
    .line('violins', '-:15 | G4:1 A4:0.5 Bb4:0.5 D5:1 | E5:1 F5:0.5 G5:0.5 C6:1 | C6:1.5 B5:0.5 A5:1 | D6:1.5 C6:0.5 Bb5:1 | C6:1 D6:1 E6:1 | D6:3 | Cs6:3', 0.85)
    .pad('violins', 0.4, 53, 67, { to: 15 })
    .pad('choir', 0.5, 50, 66, { from: 12 })
    .line('celli', 'G2:3 | Eb2:3 | A2:3 | F2:3 | Bb2:3 | G2:3 | C3:3 | A2:3 | Bb2:3 | C3:3 | A2:6', 0.85)
    .roll('timp', 30, noteNum('A2'), 6, 0.25, 0.9)
    .swell(0, 36, 0.7, 1.15));
  // A': the tune in full, flute and violins together, the horn takes the counter-line, choir behind; it swerves to B-flat at the end
  s.push(new Section(16, M, 'Dm | G | Dm | C | Bb | F | Gm | A | Dm | G | Am | F | Bb | C | Gm A | Bb')
    .arp('harp', 0.75, harpA, 45)
    .line('flute', THEME, 1.1)
    .line('violins', THEME, 0.7)
    .line('horn', 'A4:3 | B4:3 | A4:3 | G4:3 | F4:3 | F4:3 | G4:1.5 Bb4:1.5 | A4:3 | ' + COUNTER, 0.6, 0, -12)
    .pad('choir', 0.45, 50, 66)
    .line('celli', CELLI_A + ' | Bb2:3', 0.9)
    .add('timp', 0, noteNum('D2'), 2, 1).add('timp', 24, noteNum('D2'), 2, 0.6));
  // coda: settles through G minor and A, the flute remembers the tune, D minor with the dorian G major, a last harp roll
  s.push(new Section(8, M, 'Gm | Asus4 A | Dm | G | Dm | G | Dm | Dm')
    .arp('harp', 0.55, [[0, 0, 0.9], [1, 2, 0.7], [2, 3, 0.65]], 45, 2, { to: 18 })
    .strum('harp', 18, 'D3 A3 D4 E4 F4 A4 D5', 0.2, 0.6)
    .line('flute', 'G5:1 F5:0.5 E5:0.5 D5:1 | E5:1.5 Cs5:1.5 | D5:3 | B4:1.5 A4:0.5 G4:1 | A4:3 | B4:3 | A4:6', 0.75)
    .pad('choir', 0.4, 50, 66)
    .pad('violins', 0.3, 57, 69)
    .line('celli', 'G2:3 | A2:3 | D2:3 | G2:3 | D2:3 | G2:3 | D2:6', 0.7)
    .add('bell', 18, noteNum('D6'), 4, 0.35)
    .swell(0, 24, 1, 0.55));
  return { name: 'Open Country', bpm: 80, seed: 11, sections: s };
}

// Rain on the Heath: a wet day out in the wild. A minor, slow 4/4; pizzicato falls like rain under the oboe,
// the flute takes the tune higher, the violins and horns open out briefly in the middle, and it closes back to the rain.
function pieceRain() {
  const M = 4, CH = 'Am | Fmaj7 | C | G | Am | Fmaj7 | Dm7 | Esus4 E';
  const MEL = 'E5:2 D5:1 C5:1 | A4:3 -:1 | G4:1 C5:1 E5:1.5 D5:0.5 | D5:3 -:1 | E5:1 A5:2 G5:1 | F5:1.5 E5:0.5 C5:2 | D5:1 C5:1 A4:1 F4:1 | ';
  const CELLI = 'A2:4 | F2:4 | C3:4 | G2:4 | A2:4 | F2:4 | D2:4 | ';
  const drops = [[0, 0, 0.9], [0.5, 2, 0.6], [1, 3, 0.7], [1.5, 2, 0.55], [2, 4, 0.75], [2.5, 3, 0.6], [3, 6, 0.7], [3.5, 2, 0.55]];
  const sparse = [[0, 2, 0.8], [1, 3, 0.6], [2, 4, 0.7], [3.5, 6, 0.55]];
  const s = [];
  s.push(new Section(4, M, 'Am | Fmaj7 | Am | Esus4 E')
    .arp('pizz', 0.9, drops, 57).pad('choir', 0.4, 50, 64).line('celli', 'A2:4 | F2:4 | A2:4 | E2:4', 0.6).swell(0, 16, 0.5, 1));
  s.push(new Section(8, M, CH)
    .arp('pizz', 0.98, drops, 57).arp('harp', 0.62, [[0, 0, 0.9], [2.5, 3, 0.6]], 45)
    .line('reed', MEL + 'E4:2 Gs4:2', 1).pad('violins', 0.4, 52, 67).line('celli', CELLI + 'E2:4', 0.75));
  s.push(new Section(8, M, CH)
    .arp('pizz', 0.83, sparse, 57).arp('harp', 0.75, [[0, 0, 0.9], [1, 1, 0.6], [2, 2, 0.65], [3, 3, 0.6]], 45)
    .line('flute', 'A5:2 G5:1 E5:1 | C5:2 E5:1 F5:1 | G5:2 E5:1 D5:1 | D5:2 B4:1 D5:1 | E5:1 A5:2 B5:1 | C6:1.5 B5:0.5 A5:2 | F5:1 E5:1 D5:1 C5:1 | B4:4', 0.95)
    .line('reed', 'C5:4 | A4:4 | G4:4 | B4:4 | C5:4 | A4:4 | A4:2 F4:2 | E4:4', 0.55)
    .pad('violins', 0.4, 52, 67).pad('choir', 0.3, 50, 64).line('celli', CELLI + 'E2:4', 0.75));
  s.push(new Section(8, M, 'F | G | Em | Am | Dm | G | C | E')
    .line('violins', 'A5:2 G5:1 F5:1 | G5:3 D5:1 | E5:2 G5:1 B5:1 | A5:4 | F5:2 E5:1 D5:1 | D5:2 B4:1 G4:1 | C5:1 E5:1 G5:2 | Gs5:4', 0.9)
    .line('horn', '[A3,C4]:4 | [B3,D4]:4 | [B3,E4]:4 | [C4,E4]:4 | [A3,D4]:4 | [B3,D4]:4 | [C4,E4]:4 | [B3,E4]:2 [Gs3,E4]:2', 0.55)
    .pad('choir', 0.5, 50, 64).line('celli', 'F2:4 | G2:4 | E2:4 | A2:4 | D2:4 | G2:4 | C3:4 | E2:4', 0.8)
    .arp('pizz', 0.68, sparse, 57).arp('harp', 0.69, [[0, 0, 0.9], [1, 2, 0.6], [2, 3, 0.6], [3, 4, 0.55]], 45)
    .swell(0, 16, 0.8, 1.1).swell(16, 32, 1.1, 0.85));
  s.push(new Section(8, M, 'Am | Fmaj7 | C | G | Am | Fmaj7 | Dm7 | Am')
    .arp('pizz', 0.98, drops, 57)
    .line('reed', MEL + 'A4:4', 1)
    .line('flute', '-:4 | -:3 E5:0.5 D5:0.5 | -:4 | -:3 B4:0.5 A4:0.5', 0.6)
    .pad('violins', 0.4, 52, 67).line('celli', CELLI + 'A1:4', 0.75));
  s.push(new Section(4, M, 'Am | Fmaj7 | Dm7 | Am')
    .arp('pizz', 0.75, sparse, 57, 1, { to: 12 })
    .line('reed', 'E5:2 D5:1 C5:1 | A4:4', 0.8)
    .pad('choir', 0.35, 50, 64).pad('violins', 0.3, 52, 67).line('celli', 'A2:4 | F2:4 | D2:4 | A1:4', 0.6)
    .strum('harp', 12, 'A2 E3 A3 C4 E4 A4', 0.25, 0.5).add('bell', 12, noteNum('E6'), 4, 0.25)
    .swell(0, 16, 1, 0.55));
  return { name: 'Rain on the Heath', bpm: 63, seed: 23, sections: s };
}

// mood, or mood:weather (clear, overcast, rain); a missing weather falls back to the plain mood
const PIECES = { wild: [pieceOpenCountry], 'wild:rain': [pieceRain] };

// flatten a piece into timed events (seconds), lightly humanized with the piece's own seed
function scorePiece(fn) {
  const P = fn(), spb = 60 / P.bpm, rng = mulberry32(P.seed); const ev = []; let at = 0;
  for (const S of P.sections) {
    S.finish();
    for (const e of S.ev) {
      const held = e.inst === 'choir' || e.inst === 'celli';
      ev.push({ t: Math.max(0, (at + e.b) * spb + (held ? 0 : (rng() - 0.5) * 0.02)), inst: e.inst, n: e.n, d: e.d * spb * 0.97, v: e.v * (1 + (rng() - 0.5) * 0.12) });
    }
    at += S.len;
  }
  ev.sort((a, b) => a.t - b.t);
  return { name: P.name, ev, len: at * spb + 4 };
}

/* ---------------- scheduler ----------------
   pickMusic() names a mood and the weather; a composed piece for them plays through, then silence, then another.
   Moods without a composed piece yet fall back to the old generative tracks. A change of weather does not
   interrupt a piece: the next one follows it. */
const LEGACY_FOR = { title: 'title', wild: 'day', city: 'day', town: 'day', night: 'night', dungeon: 'dungeon', tavern: 'tavern', hall: 'hall', house: 'day' };
const Music = {
  mood: null, weather: null, cur: null, gapUntil: 0, timer: null, last: {}, rng: new RNG(31),
  play(mood) {
    if (!this.timer) this.timer = setInterval(() => this.tick(), 200);
    if (mood === this.mood) return;
    const first = this.mood === null; this.mood = mood;
    const now = SFX.ctx ? SFX.ctx.currentTime : 0;
    this.fadeOut(now);
    // a new place is a good moment for music: start soon, even out of a pause
    this.gapUntil = now + (first ? 0.2 : 3);
  },
  key() { const k = this.mood + ':' + this.weather; return PIECES[k] ? k : this.mood; },
  stop() { this.mood = null; if (SFX.ctx) this.fadeOut(SFX.ctx.currentTime); },
  fadeOut(now) {
    const c = this.cur; this.cur = null; if (!c || !SFX.ctx) return;
    c.bus.fade.gain.cancelScheduledValues(now); c.bus.fade.gain.setValueAtTime(c.bus.fade.gain.value, now); c.bus.fade.gain.setTargetAtTime(0, now, 1.1);
    setTimeout(() => c.bus.nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } }), 9000);
  },
  start(now) {
    const key = this.key(), fns = PIECES[key]; const bus = Synth.bus(SFX.ctx, SFX.mus);
    if (fns && fns.length) {
      let i = this.rng.int(0, fns.length - 1); if (fns.length > 1 && i === this.last[key]) i = (i + 1) % fns.length; this.last[key] = i;
      this.cur = { kind: 'piece', key, bus, s: scorePiece(fns[i]), idx: 0, t0: now + 0.3 };
    } else {
      Legacy.start(LEGACY_FOR[this.mood] || 'day');
      const g = SFX.ctx.createGain(); g.connect(bus.fade); bus.nodes.push(g);
      this.cur = { kind: 'legacy', key, bus, out: g, t0: now, end: now + 150 };
    }
  },
  tick() {
    const c = SFX.ctx; if (!c || !this.mood) return; const now = c.currentTime;
    if (settings.music <= 0) { if (this.cur) this.fadeOut(now); this.gapUntil = now + 2; return; }
    const C = this.cur;
    if (!C) { if (now >= this.gapUntil) this.start(now); return; }
    if (C.kind === 'legacy') { Legacy.tick(C.out); if (now > C.end) this.finished(now); return; }
    const ev = C.s.ev, I = INSTRUMENTS;
    while (C.idx < ev.length && C.t0 + ev[C.idx].t < now + 1.5) {
      const e = ev[C.idx++], t = C.t0 + e.t; if (t < now - 0.05) continue; // dropped while the tab slept
      I[e.inst].play(c, C.bus.ch[e.inst], e.n, Math.max(t, now), e.d, e.v);
    }
    if (C.idx >= ev.length && now > C.t0 + C.s.len) this.finished(now);
  },
  finished(now) { this.fadeOut(now); this.gapUntil = now + (settings.musicPauses === false ? 2 : this.rng.range(80, 200)); },
  score(key, i = 0) { return scorePiece(PIECES[key][i]); }, // for tools/music.py
  // offline render of a piece for previews: resolves to an AudioBuffer
  render(key, i = 0, only = null) {
    const s = scorePiece(PIECES[key][i]), sr = 44100, c = new OfflineAudioContext(2, Math.ceil(s.len * sr), sr);
    const bus = Synth.bus(c, c.destination), ev = s.ev.filter(e => !only || e.inst === only); let idx = 0;
    // notes are handed over a few seconds ahead, as the live scheduler does, so finished ones can be let go
    const feed = upTo => { while (idx < ev.length && ev[idx].t < upTo) { const e = ev[idx++]; INSTRUMENTS[e.inst].play(c, bus.ch[e.inst], e.n, e.t + 0.1, e.d, e.v); } };
    feed(3); for (let x = 1; x < s.len - 0.5; x++) c.suspend(x).then(() => { feed(x + 3); c.resume(); });
    return c.startRendering();
  },
};
