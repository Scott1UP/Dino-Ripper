// Every sound is synthesised here with the Web Audio API: no audio files.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
try {
  muted = localStorage.getItem('dino-ripper:muted') === '1';
} catch {
  // ignore
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, at: number, dur: number, type: OscillatorType, gain: number, slideTo?: number) {
  const c = ac();
  if (!c || !master) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

let noiseBuf: AudioBuffer | null = null;
function noise(at: number, dur: number, type: BiquadFilterType, f0: number, f1: number, gain: number, q = 1) {
  const c = ac();
  if (!c || !master) return;
  if (!noiseBuf) {
    noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  const t = c.currentTime + at;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  src.loop = true;
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(f0, t);
  filter.frequency.exponentialRampToValueAtTime(f1, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t, Math.random());
  src.stop(t + dur + 0.05);
}

const chime = (notes: number[], step: number, dur: number, gain: number, at = 0) =>
  notes.forEach((f, i) => {
    tone(f, at + i * step, dur, 'triangle', gain);
    tone(f * 2, at + i * step, dur * 0.7, 'sine', gain * 0.4);
  });

const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, B5 = 987.77, C6 = 1046.5, D6 = 1174.66, E6 = 1318.5, G6 = 1568;

export const audio = {
  get muted() {
    return muted;
  },
  toggle() {
    muted = !muted;
    try {
      localStorage.setItem('dino-ripper:muted', muted ? '1' : '0');
    } catch {
      // ignore
    }
    if (master) master.gain.value = muted ? 0 : 0.5;
    return muted;
  },
  /** Call from a tap so the browser lets sound start. */
  unlock: () => void ac(),

  tap: () => tone(700, 0, 0.07, 'sine', 0.2, 500),
  grab() {
    noise(0, 0.12, 'bandpass', 2500, 5000, 0.25, 2);
    tone(320, 0, 0.1, 'sine', 0.2, 480);
  },
  drop() {
    tone(240, 0, 0.14, 'sine', 0.35, 90);
    noise(0, 0.1, 'lowpass', 900, 300, 0.25);
  },
  whoosh: (dur = 0.7) => noise(0, dur, 'bandpass', 300, 2600, 0.35, 1.2),
  /** Foil tearing: a rising hiss with a rattle of crackles over it. */
  rip() {
    noise(0, 0.5, 'bandpass', 1200, 6500, 0.55, 0.8);
    noise(0, 0.5, 'highpass', 3000, 7000, 0.25);
    for (let i = 0; i < 16; i++) noise(i * 0.027 + Math.random() * 0.01, 0.03, 'bandpass', 1800 + Math.random() * 3000, 4000, 0.5, 4);
    tone(140, 0.42, 0.18, 'sine', 0.4, 60);
  },
  slide: (i = 0) => noise(0, 0.14, 'bandpass', 1800 + i * 150, 4200 + i * 150, 0.2, 1.5),
  flip() {
    noise(0, 0.16, 'bandpass', 900, 3200, 0.3, 1.2);
    tone(900, 0.13, 0.05, 'sine', 0.12, 600);
  },
  /** A chime that grows with the rarity tier (0 = common ... 3 = ultra rare). */
  reveal(tier: number) {
    if (tier === 1) tone(E5, 0.1, 0.25, 'triangle', 0.14);
    if (tier === 2) chime([C5, E5, G5], 0.07, 0.5, 0.2, 0.1);
    if (tier === 3) chime([C5, E5, G5, C6, E6], 0.065, 0.8, 0.24, 0.1);
  },
  /** Tension before a big card turns over. */
  riser(dur: number) {
    noise(0, dur, 'bandpass', 200, 5000, 0.3, 3);
    tone(110, 0, dur, 'sawtooth', 0.12, 660);
    tone(55, 0, dur, 'sine', 0.3, 110);
  },
  secret() {
    tone(80, 0, 0.5, 'sine', 0.6, 40);
    noise(0, 0.6, 'highpass', 2000, 9000, 0.3);
    chime([C5, G5, C6, E6, G6], 0.08, 1.4, 0.26);
    chime([E5, B5, E6], 0.16, 1.6, 0.14, 0.45);
    for (let i = 0; i < 10; i++) tone(2000 + Math.random() * 3000, 0.6 + i * 0.12, 0.25, 'sine', 0.05);
  },
  /** The gold card: a brass fanfare with a held chord and a shower of sparkles. */
  gold() {
    tone(60, 0, 0.8, 'sine', 0.7, 30);
    noise(0, 0.9, 'highpass', 1500, 9000, 0.35);
    const brass = (f: number, at: number, dur: number) => {
      tone(f, at, dur, 'sawtooth', 0.11);
      tone(f * 1.005, at, dur, 'sawtooth', 0.09);
      tone(f / 2, at, dur, 'square', 0.05);
    };
    brass(C5, 0, 0.16);
    brass(C5, 0.18, 0.16);
    brass(C5, 0.36, 0.16);
    brass(E5, 0.54, 0.3);
    brass(G5, 0.86, 0.3);
    for (const f of [C5, E5, G5, C6]) brass(f, 1.2, 1.8);
    chime([C6, E6, G6, C6 * 2], 0.09, 1.6, 0.2, 1.2);
    for (let i = 0; i < 26; i++) tone(1800 + Math.random() * 3600, 1.3 + i * 0.11, 0.3, 'sine', 0.05);
  },
  collect: (i = 0) => tone(A5 * 2 ** (i / 12), 0, 0.12, 'triangle', 0.14),
  binder() {
    noise(0, 0.25, 'lowpass', 500, 1500, 0.35);
    tone(160, 0, 0.2, 'sine', 0.3, 110);
  },
  page: () => noise(0, 0.32, 'bandpass', 700, 2600, 0.3, 0.9),
  lift() {
    noise(0, 0.2, 'bandpass', 2000, 4500, 0.2, 1.5);
    tone(D6, 0.12, 0.2, 'sine', 0.08);
  },
};
