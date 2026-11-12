/* =====================================================================
   Music: composed pieces played by a small Web Audio synth.
   Instruments in the spirit of early FM and General MIDI cards, but
   cleaner: soft strings, a plucked harp, flute, an FM reed, an FM bell,
   bass, all through a shared hall reverb. Pieces play through, then the
   world is left to itself for a while before the next one.
   ===================================================================== */

/* ---------------- synth ---------------- */
const Synth = {
  cache: new WeakMap(),
  res(c) { // per-context shared resources: wavetables, noise, reverb impulse
    let r = this.cache.get(c); if (r) return r;
    const wave = (amps) => { const re = new Float32Array(amps.length), im = new Float32Array(amps.length); amps.forEach((a, i) => { im[i] = a; }); return c.createPeriodicWave(re, im); };
    const sr = c.sampleRate, nl = sr * 2, noise = c.createBuffer(1, nl, sr), nd = noise.getChannelData(0);
    const rng = mulberry32(77); for (let i = 0; i < nl; i++) nd[i] = rng() * 2 - 1;
    // hall impulse: decaying noise that darkens as it fades (T60 about 2.8 s), a little pre-delay
    const il = Math.floor(sr * 3.4), ir = c.createBuffer(2, il, sr), pre = Math.floor(sr * 0.025);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch); let lp = 0;
      for (let i = pre; i < il; i++) { const x = (i - pre) / sr; const k = 0.5 * Math.exp(-x * 1.6) + 0.04; lp += (rng() * 2 - 1 - lp) * k; d[i] = lp * Math.exp(-x * 2.45) * (1 - Math.exp(-x * 60)); }
      let e = 0; for (let i = 0; i < il; i++) e += d[i] * d[i]; const k = 1 / Math.sqrt(e); for (let i = 0; i < il; i++) d[i] *= k; // unit energy
    }
    r = {
      harp: wave([0, 1, 0.42, 0.22, 0.12, 0.07, 0.035, 0.02]),
      flute: wave([0, 1, 0.3, 0.1, 0.035]),
      noise, ir,
    };
    this.cache.set(c, r); return r;
  },
  // a music bus: instrument channels -> dry + reverb send -> fade -> gentle compressor -> dest
  bus(c, dest) {
    const R = this.res(c);
    const fade = c.createGain(); fade.gain.value = 1;
    const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 40; hp.Q.value = 0.5; // nothing below what small speakers can play
    const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; comp.attack.value = 0.02; comp.release.value = 0.4; comp.knee.value = 10;
    const verb = c.createConvolver(); verb.normalize = false; verb.buffer = R.ir;
    const wet = c.createGain(); wet.gain.value = 0.55;
    verb.connect(wet); wet.connect(fade); fade.connect(hp); hp.connect(comp); comp.connect(dest);
    const ch = {};
    for (const [name, v] of Object.entries(INSTRUMENTS)) {
      const g = c.createGain(); g.gain.value = v.level; g.connect(fade);
      const s = c.createGain(); s.gain.value = v.send; g.connect(s); s.connect(verb); ch[name] = g;
    }
    return { c, fade, ch, nodes: [fade, hp, comp, verb, wet] };
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
const mtof = n => 440 * Math.pow(2, (n - 69) / 12);

// level: channel gain; send: reverb amount
const INSTRUMENTS = {
  harp: { level: 0.085, send: 0.45, play(c, out, n, t, dur, v) {
    const R = Synth.res(c), f = mtof(n), ring = clamp(3.4 - (f - 150) / 300, 1.1, 3.4);
    const g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(9000, f * 9), t); lp.frequency.setTargetAtTime(Math.max(400, f * 2), t + 0.01, 0.35);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.004); g.gain.setTargetAtTime(0, t + 0.004, ring / 5);
    const os = [1, 1.0018].map(m => { const o = c.createOscillator(); o.setPeriodicWave(R.harp); o.frequency.value = f * m; o.connect(lp); return o; });
    lp.connect(g); g.connect(out); os.forEach(o => { o.start(t); o.stop(t + ring * 1.15); });
  } },
  flute: { level: 0.135, send: 0.4, play(c, out, n, t, dur, v) {
    const R = Synth.res(c), f = mtof(n);
    const o = c.createOscillator(); o.setPeriodicWave(R.flute); o.frequency.value = f;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(8000, f * 5);
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.07, 0.4, 0.82, 0.22);
    const l = Synth.vibrato(c, t, 5.1, f * 0.0045, 0.28, [o.frequency]);
    // breath: a little band-passed noise, with a soft chiff at the start
    const b = c.createBufferSource(); b.buffer = R.noise; b.loop = true;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = f * 1.6; bp.Q.value = 1.2;
    const bg = c.createGain(); bg.gain.setValueAtTime(0, t); bg.gain.linearRampToValueAtTime(v * 0.22, t + 0.02); bg.gain.setTargetAtTime(v * 0.045, t + 0.02, 0.05); bg.gain.setTargetAtTime(0, t + dur, 0.05);
    o.connect(lp); lp.connect(g); b.connect(bp); bp.connect(bg); bg.connect(g); g.connect(out);
    o.start(t); l.start(t); b.start(t, (n * 0.037) % 1.5); [o, l, b].forEach(x => x.stop(end));
  } },
  reed: { level: 0.105, send: 0.32, play(c, out, n, t, dur, v) { // two-operator FM, the old sound-card oboe
    const f = mtof(n);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(); car.frequency.value = f; mod.frequency.value = f;
    mg.gain.setValueAtTime(f * 2.3, t); mg.gain.setTargetAtTime(f * 1.25, t + 0.03, 0.12); mg.gain.setTargetAtTime(f * 0.6, t + dur, 0.06);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.min(5000, f * 6); lp.Q.value = 0.4;
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.045, 0.3, 0.85, 0.16);
    const l = Synth.vibrato(c, t, 5.4, f * 0.004, 0.35, [car.frequency, mod.frequency]);
    mod.connect(mg); mg.connect(car.frequency); car.connect(lp); lp.connect(g); g.connect(out);
    [car, mod, l].forEach(x => { x.start(t); x.stop(end); });
  } },
  strings: { level: 0.05, send: 0.5, play(c, out, n, t, dur, v) {
    const f = mtof(n);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.3; lp.frequency.setValueAtTime(Math.min(3200, f * 2.2 + 400), t);
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.9, 1.4, 0.85, 1.6);
    const os = [-9, 0, 8].map(d => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = d; o.connect(lp); return o; });
    const l = Synth.vibrato(c, t, 4.7, 7, 0.6, os.map(o => o.detune));
    lp.connect(g); g.connect(out); [...os, l].forEach(x => { x.start(t); x.stop(end); });
  } },
  bass: { level: 0.1, send: 0.12, play(c, out, n, t, dur, v) {
    const f = mtof(n);
    const o = c.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
    const s = c.createOscillator(); s.frequency.value = f; const sg = c.createGain(); sg.gain.value = 0.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 650;
    const g = c.createGain(); const end = Synth.env(g, t, dur, v, 0.03, 1.2, 0.55, 0.4);
    o.connect(lp); s.connect(sg); sg.connect(lp); lp.connect(g); g.connect(out); [o, s].forEach(x => { x.start(t); x.stop(end); });
  } },
  bell: { level: 0.18, send: 0.6, play(c, out, n, t, dur, v) { // FM bell, inharmonic modulator
    const f = mtof(n);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(); car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 3, t); mg.gain.setTargetAtTime(f * 0.3, t, 0.5);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.003); g.gain.setTargetAtTime(0, t + 0.003, 1.1);
    mod.connect(mg); mg.connect(car.frequency); car.connect(g); g.connect(out); [car, mod].forEach(x => { x.start(t); x.stop(t + 6); });
  } },
};

/* ---------------- score notation ----------------
   A line is space-separated tokens "D5:1.5" (note:beats), "-:1" (rest); a trailing ! accents, ? softens.
   Chords are written per bar, bars split by |, several chords in a bar share it: "Dm | C | Bb C | Dm". */
const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], sus4: [0, 5, 7], sus2: [0, 2, 7], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6] };
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
  constructor(bars, meter, chords) { this.bars = bars; this.meter = meter; this.len = bars * meter; this.ev = []; this.chords = chords ? parseChords(chords, meter) : null; }
  add(inst, b, n, d, v) { if (b < this.len) this.ev.push({ b, inst, n, d, v }); return this; }
  line(inst, str, vol, from = 0) {
    let b = from; for (const tok of str.trim().split(/\s+/)) {
      const m = /^([^:]+):([\d.]+)([!?]?)$/.exec(tok); const d = +m[2];
      if (m[1] !== '-') this.add(inst, b, noteNum(m[1]), d, vol * (m[3] === '!' ? 1.2 : m[3] === '?' ? 0.7 : 1));
      b += d;
    } return this;
  }
  // block chords, voice-led inside [lo, hi]
  pad(inst, vol, lo = 53, hi = 70) {
    let prev = null;
    for (const ch of this.chords) {
      const pcs = ch.ints.slice(0, 4).map(i => (ch.root + i) % 12); let best = null, bc = 1e9;
      const opts = pcs.map(p => { const o = []; for (let n = lo; n <= hi; n++) if (((n % 12) + 12) % 12 === (p + 12) % 12) o.push(n); return o; });
      const walk = (i, acc) => {
        if (i === opts.length) {
          const s = [...acc].sort((a, b) => a - b); if (s[s.length - 1] - s[0] > 14) return;
          for (let k = 1; k < s.length; k++) if (s[k] - s[k - 1] < 2 && s.length > 3) return;
          const cost = prev ? s.reduce((t, n, k) => t + Math.abs(n - (prev[k] ?? prev[prev.length - 1])), 0) : Math.abs(s[0] + s[s.length - 1] - lo - hi);
          if (cost < bc) { bc = cost; best = s; } return;
        }
        for (const n of opts[i]) walk(i + 1, [...acc, n]);
      };
      walk(0, []); prev = best;
      best.forEach(n => this.add(inst, ch.at, n, ch.len, vol));
    } return this;
  }
  // broken chords: pattern of [beat in bar, tone index]; tones: root, 5th, 8ve, 3rd above, 5th above, 2 8ves
  arp(inst, vol, pattern, base = 48, dur = 2) {
    for (let bar = 0; bar < this.bars; bar++) for (const [pb, ti, acc] of pattern) {
      const b = bar * this.meter + pb, ch = chordAt(this.chords, b); const r = base + ((ch.root - base) % 12 + 12) % 12;
      const tones = [r, r + ch.ints[2], r + 12, r + 12 + ch.ints[1], r + 12 + ch.ints[2], r + 24];
      this.add(inst, b, tones[ti], dur, vol * (acc || 1));
    } return this;
  }
  // bass: pattern of [beat in bar, 0 root | 1 fifth, beats]
  bass(inst, vol, pattern, base = 38) {
    for (let bar = 0; bar < this.bars; bar++) for (const [pb, which, d] of pattern) {
      const b = bar * this.meter + pb, ch = chordAt(this.chords, b); const r = base + ((ch.root - base) % 12 + 12) % 12;
      this.add(inst, b, which ? (r + ch.ints[2] > base + 14 ? r + ch.ints[2] - 12 : r + ch.ints[2]) : r, d, vol);
    } return this;
  }
}

/* ---------------- pieces ---------------- */
// Open Country: daytime, out in the wild. D dorian, unhurried, a flute over harp and strings.
function pieceOpenCountry() {
  const M = 4, A = 'Dm | C | Bb | C | Dm | G | Bb C | Dm', B = 'F | C | Dm | Am | Bb | F | Gm | A', C = 'Bb F | C Dm | Bb F | Gm Asus4';
  const harpA = [[0, 0], [1, 1], [2, 3, 0.85], [3, 2, 0.75]], harpB = [[0, 0], [2, 3, 0.8]], harpC = [[0, 4, 0.8], [1, 3, 0.7], [2, 2, 0.75], [3, 1, 0.7]];
  const melA = `D5:1.5 E5:0.5 F5:1 A5:1  G5:2 E5:1 C5:1  D5:1.5 C5:0.5 Bb4:1 A4:1  G4:3 -:1
                A4:1 D5:1 F5:1.5 E5:0.5  D5:1 B4:1 G4:2  Bb4:1 D5:1 C5:1 E5:1  D5:3 -:1`;
  const s = [];
  s.push(new Section(4, M, 'Dm | Bb | C | Dm').pad('strings', 0.55).arp('harp', 0.8, harpA).bass('bass', 0.6, [[0, 0, 4]]).add('bell', 0, noteNum('A5'), 4, 0.6));
  s.push(new Section(8, M, A).pad('strings', 0.6).arp('harp', 0.85, harpA).bass('bass', 0.7, [[0, 0, 4]]).line('flute', melA, 0.95));
  s.push(new Section(8, M, B).pad('strings', 0.75).arp('harp', 0.8, harpB, 48, 3).bass('bass', 0.7, [[0, 0, 2], [2, 1, 2]])
    .line('reed', `C5:2 A4:1 F4:1  G4:1.5 A4:0.5 G4:1 E4:1  F4:1 A4:1 D5:2  C5:1.5 B4:0.5 A4:2
                   Bb4:1 A4:1 G4:1 F4:1  A4:2 C5:2  D5:1.5 C5:0.5 Bb4:1 G4:1  A4:2 E4:1 Cs5:1`, 0.9));
  s.push(new Section(8, M, A).pad('strings', 0.65).arp('harp', 0.85, harpA).bass('bass', 0.7, [[0, 0, 2], [2, 1, 2]])
    .line('flute', `D5:1.5 E5:0.5 F5:1 A5:1  G5:2 E5:1 C5:1  D5:1.5 C5:0.5 Bb4:1 A4:1  G4:2 A4:1 C5:1
                    D5:1 F5:1 A5:1.5 G5:0.5  B5:1! A5:0.5 G5:0.5 D5:2  F5:1 E5:0.5 D5:0.5 E5:1 G5:1  A5:2 F5:1 E5:1`, 0.95)
    .line('reed', 'A4:4 G4:4 F4:4 E4:4 F4:4 D4:4 D4:2 E4:2 F4:4', 0.5));
  s.push(new Section(8, M, C + ' | ' + C).pad('strings', 0.5).arp('harp', 0.6, harpC, 48, 2.5).bass('bass', 0.5, [[0, 0, 4]])
    .line('bell', 'F5:8 G5:8 D5:8 -:4 E5:4', 0.45));
  s.push(new Section(8, M, A).pad('strings', 0.6).arp('harp', 0.85, harpA).bass('bass', 0.7, [[0, 0, 4]])
    .line('flute', `D5:1.5 E5:0.5 F5:1 A5:1  G5:2 E5:1 C5:1  D5:1.5 C5:0.5 Bb4:1 A4:1  G4:3 -:1
                    A4:1 D5:1 F5:1.5 E5:0.5  D5:1 B4:1 G4:1 A4:1  Bb4:1 C5:1 D5:1 E5:1  D5:4`, 0.9));
  s.push(new Section(4, M, 'Dm | C | Bb | Dmadd9').pad('strings', 0.5).arp('harp', 0.6, [[0, 0], [2, 3, 0.8]], 48, 3).bass('bass', 0.55, [[0, 0, 4]])
    .add('bell', 12, noteNum('D6'), 4, 0.4));
  return { name: 'Open Country', bpm: 72, seed: 11, sections: s };
}

const PIECES = { wild: [pieceOpenCountry] };

// flatten a piece into timed events (seconds), lightly humanized with the piece's own seed
function scorePiece(fn) {
  const P = fn(), spb = 60 / P.bpm, rng = mulberry32(P.seed); const ev = []; let at = 0;
  for (const S of P.sections) {
    for (const e of S.ev) {
      const solo = e.inst === 'flute' || e.inst === 'reed' || e.inst === 'harp';
      ev.push({ t: (at + e.b) * spb + (solo ? (rng() - 0.5) * 0.024 : 0), inst: e.inst, n: e.n, d: e.d * spb * (solo ? 0.96 : 1), v: e.v * (1 + (rng() - 0.5) * 0.12) });
    }
    at += S.len;
  }
  ev.sort((a, b) => a.t - b.t);
  return { name: P.name, ev, len: at * spb + 4 };
}

/* ---------------- scheduler ----------------
   pickMusic() names a mood; a composed piece for it plays through, then silence, then another.
   Moods without a composed piece yet fall back to the old generative tracks. */
const LEGACY_FOR = { title: 'title', wild: 'day', city: 'day', town: 'day', night: 'night', dungeon: 'dungeon', tavern: 'tavern', hall: 'hall', house: 'day' };
const Music = {
  mood: null, cur: null, gapUntil: 0, timer: null, last: {}, rng: new RNG(31),
  play(mood) {
    if (!this.timer) this.timer = setInterval(() => this.tick(), 200);
    if (mood === this.mood) return;
    const first = this.mood === null; this.mood = mood;
    const now = SFX.ctx ? SFX.ctx.currentTime : 0;
    this.fadeOut(now);
    // a new place is a good moment for music: start soon, even out of a pause
    this.gapUntil = now + (first ? 0.2 : 3);
  },
  stop() { this.mood = null; if (SFX.ctx) this.fadeOut(SFX.ctx.currentTime); },
  fadeOut(now) {
    const c = this.cur; this.cur = null; if (!c || !SFX.ctx) return;
    c.bus.fade.gain.cancelScheduledValues(now); c.bus.fade.gain.setValueAtTime(c.bus.fade.gain.value, now); c.bus.fade.gain.setTargetAtTime(0, now, 1.1);
    setTimeout(() => c.bus.nodes.forEach(n => { try { n.disconnect(); } catch (e) { /* gone */ } }), 9000);
  },
  start(now) {
    const fns = PIECES[this.mood]; const bus = Synth.bus(SFX.ctx, SFX.mus);
    if (fns && fns.length) {
      let i = this.rng.int(0, fns.length - 1); if (fns.length > 1 && i === this.last[this.mood]) i = (i + 1) % fns.length; this.last[this.mood] = i;
      this.cur = { kind: 'piece', bus, s: scorePiece(fns[i]), idx: 0, t0: now + 0.3 };
    } else {
      Legacy.start(LEGACY_FOR[this.mood] || 'day');
      const g = SFX.ctx.createGain(); g.connect(bus.fade); bus.nodes.push(g);
      this.cur = { kind: 'legacy', bus, out: g, t0: now, end: now + 150 };
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
  // offline render of a piece for previews: resolves to an AudioBuffer
  render(mood, i = 0, only = null) {
    const s = scorePiece(PIECES[mood][i]), sr = 44100, c = new OfflineAudioContext(2, Math.ceil(s.len * sr), sr);
    const bus = Synth.bus(c, c.destination);
    for (const e of s.ev) if (!only || e.inst === only) INSTRUMENTS[e.inst].play(c, bus.ch[e.inst], e.n, e.t + 0.1, e.d, e.v);
    return c.startRendering();
  },
};
