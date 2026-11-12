/* =====================================================================
   Audio: synthesized sound effects + a tiny generative "MIDI" score
   ===================================================================== */

const SFX = {
  ctx: null, master: null, sfx: null, mus: null, noiseBuf: null, rainNode: null,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
      this.sfx = this.ctx.createGain(); this.sfx.connect(this.master);
      this.mus = this.ctx.createGain(); this.mus.connect(this.master);
      const len = this.ctx.sampleRate; this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0); for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    } catch (e) { this.ctx = null; }
  },
  applyVolumes() { if (!this.ctx) return; this.sfx.gain.value = settings.sfx; this.mus.gain.value = settings.music * 0.55; },
  tone(freq, dur, type = 'square', vol = 0.15, slide = null, delay = 0, dest = null, attack = 0.005) {
    if (!this.ctx) return; const t = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(dur, vol = 0.2, ftype = 'lowpass', f0 = 1000, f1 = null, delay = 0, q = 1, dest = null) {
    if (!this.ctx) return; const t = this.ctx.currentTime + delay;
    const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = this.ctx.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(f0, t); f.Q.value = q; if (f1) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = this.ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  play(name, pos = null) {
    if (!this.ctx) return;
    let v = 1;
    if (pos && G.player) { const d = Math.hypot(pos.x - G.player.pos.x, pos.z - G.player.pos.z); v = clamp(1 - d / 28, 0, 1); if (v <= 0.02) return; }
    switch (name) {
      case 'swing': this.noise(0.2, 0.22 * v, 'bandpass', 700, 2600, 0, 1.5); break;
      case 'hit': this.noise(0.14, 0.4 * v, 'lowpass', 900, 200); this.tone(110, 0.12, 'square', 0.12 * v, 50); break;
      case 'miss': this.noise(0.16, 0.14 * v, 'bandpass', 1400, 600, 0, 2); break;
      case 'hurt': this.tone(240, 0.28, 'sawtooth', 0.14 * v, 110); this.noise(0.12, 0.2 * v, 'lowpass', 700); break;
      case 'enemyHurt': this.tone(320, 0.14, 'square', 0.1 * v, 190); break;
      case 'die': this.tone(220, 0.6, 'sawtooth', 0.14 * v, 55); this.noise(0.4, 0.15 * v, 'lowpass', 500, 100); break;
      case 'squeak': this.tone(1900, 0.07, 'square', 0.06 * v, 2400); this.tone(2100, 0.06, 'square', 0.05 * v, 2600, 0.09); break;
      case 'flap': this.noise(0.08, 0.12 * v, 'lowpass', 500, 200); this.noise(0.08, 0.12 * v, 'lowpass', 500, 200, 0.12); break;
      case 'growl': this.tone(70, 0.5, 'sawtooth', 0.14 * v, 55); this.noise(0.5, 0.12 * v, 'lowpass', 300, 150); break;
      case 'moan': this.tone(160, 0.9, 'triangle', 0.1 * v, 120); this.tone(163, 0.9, 'triangle', 0.08 * v, 118); break;
      case 'coin': this.tone(1320, 0.09, 'square', 0.07); this.tone(1760, 0.14, 'square', 0.07, null, 0.07); break;
      case 'door': this.tone(190, 0.35, 'sawtooth', 0.05, 120); this.noise(0.18, 0.3, 'lowpass', 400, 120, 0.3); break;
      case 'locked': this.tone(300, 0.06, 'square', 0.08); this.tone(250, 0.08, 'square', 0.08, null, 0.08); break;
      case 'fire': this.noise(0.5, 0.25, 'lowpass', 1400, 300); this.tone(140, 0.4, 'sawtooth', 0.08, 60); break;
      case 'boom': this.noise(0.7, 0.5 * v, 'lowpass', 900, 80); this.tone(80, 0.5, 'sine', 0.3 * v, 30); break;
      case 'shock': this.tone(900, 0.25, 'sawtooth', 0.1, 200); this.noise(0.25, 0.2, 'highpass', 3000, 1000); break;
      case 'heal': [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.35, 'sine', 0.1, null, i * 0.07)); break;
      case 'levelup': [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone(f, 0.3, 'square', 0.07, null, i * 0.1)); break;
      case 'quest': [392, 523, 659].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, null, i * 0.12)); break;
      case 'step': this.noise(0.06, 0.05, 'lowpass', 420, 200); break;
      case 'ghost': this.tone(330, 1.6, 'sine', 0.08 * v, 220, 0, null, 0.4); this.tone(336, 1.6, 'sine', 0.06 * v, 228, 0.1, null, 0.4); break;
      case 'click': this.tone(700, 0.04, 'square', 0.04); break;
      case 'drink': this.noise(0.3, 0.12, 'bandpass', 600, 1200, 0, 4); this.tone(400, 0.2, 'sine', 0.06, 700, 0.2); break;
      case 'unlock': this.tone(900, 0.05, 'square', 0.06); this.tone(1200, 0.08, 'square', 0.06, null, 0.06); break;
      case 'halt': this.tone(180, 0.25, 'sawtooth', 0.1 * Math.max(v, 0.5), 150); this.tone(180, 0.3, 'sawtooth', 0.1 * Math.max(v, 0.5), 140, 0.35);
        try { if (window.speechSynthesis && !speechSynthesis.speaking) { const u = new SpeechSynthesisUtterance('Halt! Halt!'); u.rate = 1.15; u.pitch = 0.6; u.volume = settings.sfx; speechSynthesis.speak(u); } } catch (e) { /* no speech */ }
        break;
    }
  },
  rain(on) {
    if (!this.ctx) return;
    if (on && !this.rainNode) {
      const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
      const f = this.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1200;
      const g = this.ctx.createGain(); g.gain.value = 0.05; s.connect(f); f.connect(g); g.connect(this.sfx); s.start();
      this.rainNode = { s, g };
    } else if (!on && this.rainNode) { try { this.rainNode.s.stop(); } catch (e) { /* already stopped */ } this.rainNode = null; }
  },
};

/* ---------------- legacy generative score (moods without a composed piece yet) ---------------- */
const NOTE = n => 440 * Math.pow(2, (n - 69) / 12);
const TRACKS = {
  title: { bpm: 66, chords: [[50, 'm'], [46, ''], [41, ''], [48, '']], mel: 0.55, arp: 'slow', lead: 'triangle', pad: true },
  day: { bpm: 88, chords: [[50, 'm'], [48, ''], [46, ''], [48, ''], [50, 'm'], [53, ''], [48, ''], [45, '']], mel: 0.45, arp: 'eighth', lead: 'square', pad: false },
  night: { bpm: 58, chords: [[45, 'm'], [41, ''], [50, 'm'], [52, '']], mel: 0.25, arp: 'slow', lead: 'sine', pad: true },
  dungeon: { bpm: 48, chords: [[38, 'm'], [39, ''], [38, 'm'], [37, 'dim']], mel: 0.12, arp: 'none', lead: 'sine', pad: true, drone: true },
  tavern: { bpm: 126, chords: [[43, ''], [48, ''], [50, ''], [43, '']], mel: 0.7, arp: 'jig', lead: 'square', pad: false },
  hall: { bpm: 60, chords: [[50, 'm'], [43, 'm'], [45, ''], [50, 'm']], mel: 0.3, arp: 'slow', lead: 'triangle', pad: true },
};
const Legacy = {
  track: null, step: 0, next: 0, melNote: 0, rng: new RNG(9),
  start(name) { if (this.track !== name) { this.track = name; this.step = 0; this.melNote = 0; } this.next = SFX.ctx.currentTime + 0.1; },
  chordNotes(root, q) { const third = q === 'm' || q === 'dim' ? 3 : 4, fifth = q === 'dim' ? 6 : 7; return [root, root + third, root + fifth]; },
  tick(d) {
    const T = TRACKS[this.track]; if (!T) return; const spb = 60 / T.bpm / 2; // eighth notes
    if (this.next < SFX.ctx.currentTime - 0.5) this.next = SFX.ctx.currentTime + 0.05; // tab was hidden
    while (this.next < SFX.ctx.currentTime + 0.25) {
      const s = this.step; const bar = Math.floor(s / 8) % T.chords.length; const beat = s % 8; const [root, q] = T.chords[bar];
      const ch = this.chordNotes(root, q); const t = this.next - SFX.ctx.currentTime;
      if (beat === 0) {
        SFX.tone(NOTE(root - 12), spb * 7, 'triangle', 0.16, null, t, d, 0.02);
        if (T.pad) ch.forEach(n => SFX.tone(NOTE(n + 12), spb * 8, 'sine', 0.035, null, t, d, 0.3));
        if (T.drone) { SFX.tone(NOTE(root - 24), spb * 8, 'sawtooth', 0.03, null, t, d, 0.5); }
      }
      if (beat === 4 && !T.drone) SFX.tone(NOTE(root - 12 + 7), spb * 3, 'triangle', 0.1, null, t, d, 0.02);
      if (T.arp === 'eighth') SFX.tone(NOTE(ch[[0, 1, 2, 1, 0, 1, 2, 1][beat]] + 12), spb * 0.9, 'triangle', 0.05, null, t, d);
      else if (T.arp === 'jig') { if (beat % 2 === 0 || this.rng.chance(0.4)) SFX.tone(NOTE(ch[beat % 3] + 12), spb * 0.8, 'square', 0.025, null, t, d); }
      else if (T.arp === 'slow' && beat % 2 === 0) SFX.tone(NOTE(ch[(beat / 2) % 3] + 12), spb * 2.2, 'triangle', 0.04, null, t, d);
      if (this.rng.chance(T.mel * (beat % 2 === 0 ? 1 : 0.4))) {
        const scale = q === 'm' || q === 'dim' ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11];
        this.melNote = clamp(this.melNote + this.rng.pick([-2, -1, -1, 0, 1, 1, 2]), -2, 9);
        const deg = ((this.melNote % 7) + 7) % 7, oct = Math.floor(this.melNote / 7);
        SFX.tone(NOTE(root + 24 + scale[deg] + oct * 12), spb * (this.rng.chance(0.3) ? 3 : 1.6), T.lead, T.lead === 'square' ? 0.03 : 0.06, null, t, d, 0.01);
      }
      this.step++; this.next += spb;
    }
  },
};
