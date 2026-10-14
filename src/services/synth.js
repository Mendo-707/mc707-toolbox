/* ---------- audio preview synth ---------- */
export const AU = {};
export function ensureAudio() {
  if (!AU.ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    AU.ctx = new C();
    AU.out = AU.ctx.createGain();
    AU.out.gain.value = 0.8;
    const comp = AU.ctx.createDynamicsCompressor();
    AU.out.connect(comp);
    comp.connect(AU.ctx.destination);
    const b = AU.ctx.createBuffer(1, AU.ctx.sampleRate, AU.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    AU.noise = b;
  }
  if (AU.ctx.state !== 'running') AU.ctx.resume();
  return AU.ctx;
}
function genv(t, peak, dec, atk = 0.001) {
  const g = AU.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(peak, 0.0002), t + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, t + atk + dec);
  g.connect(AU.out);
  return g;
}
function nsrc(t, dur) {
  const s = AU.ctx.createBufferSource();
  s.buffer = AU.noise;
  s.loop = true;
  s.start(t, Math.random() * 0.5);
  s.stop(t + dur);
  return s;
}
function osc(type, f, t, dur) {
  const o = AU.ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.start(t);
  o.stop(t + dur);
  return o;
}
function filt(type, f, q = 1) {
  const x = AU.ctx.createBiquadFilter();
  x.type = type;
  x.frequency.value = f;
  x.Q.value = q;
  return x;
}
const tom = f => (t, a) => {
  const g = genv(t, a * 0.7, 0.3);
  const o = osc('sine', f, t, 0.4);
  o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.2);
  o.connect(g);
};
export const DRUMS = [
  (t, a) => {
    const g = genv(t, a, 0.38);
    const o = osc('sine', 160, t, 0.5);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    o.connect(g);
  },
  (t, a) => {
    const g = genv(t, a * 0.45, 0.04);
    osc('square', 1700, t, 0.07).connect(g);
  },
  (t, a) => {
    const g = genv(t, a * 0.6, 0.17);
    const n = nsrc(t, 0.25);
    const f = filt('highpass', 1400);
    n.connect(f);
    f.connect(g);
    const g2 = genv(t, a * 0.45, 0.1);
    osc('triangle', 190, t, 0.15).connect(g2);
  },
  (t, a) => {
    for (let i = 0; i < 3; i++) {
      const g = genv(t + i * 0.011, a * 0.5, i < 2 ? 0.03 : 0.16);
      const n = nsrc(t + i * 0.011, 0.25);
      const f = filt('bandpass', 1250, 1.2);
      n.connect(f);
      f.connect(g);
    }
  },
  (t, a) => {
    const g = genv(t, a * 0.35, 0.045);
    const n = nsrc(t, 0.1);
    const f = filt('highpass', 7000);
    n.connect(f);
    f.connect(g);
  },
  (t, a) => {
    const g = genv(t, a * 0.3, 0.3);
    const n = nsrc(t, 0.4);
    const f = filt('highpass', 6500);
    n.connect(f);
    f.connect(g);
  },
  tom(95),
  tom(140),
  tom(200),
  (t, a) => {
    const g = genv(t, a * 0.3, 1.1);
    const n = nsrc(t, 1.3);
    const f = filt('highpass', 5200);
    n.connect(f);
    f.connect(g);
  },
  (t, a) => {
    const g = genv(t, a * 0.22, 0.55);
    const n = nsrc(t, 0.7);
    const f = filt('bandpass', 8500, 0.8);
    n.connect(f);
    f.connect(g);
  },
  (t, a) => {
    const g = genv(t, a * 0.5, 0.1);
    const o = osc('sine', 880, t, 0.15);
    o.frequency.exponentialRampToValueAtTime(560, t + 0.08);
    o.connect(g);
  }
];
const TONE_P = {
  3: { w: ['sawtooth', 'sine'], lp: 650, atk: 0.004, rel: 0.08, gain: 0.34 },
  4: { w: ['sawtooth', 'sawtooth'], det: [-9, 9], lp: 2400, atk: 0.01, rel: 0.25, gain: 0.12 },
  5: { w: ['sawtooth', 'triangle'], det: [-6, 6], lp: 1300, atk: 0.35, rel: 0.6, gain: 0.1 },
  6: { w: ['square'], lp: 3600, atk: 0.006, rel: 0.12, gain: 0.14 },
  7: { w: ['triangle'], lp: 5000, atk: 0.002, rel: 0.05, gain: 0.3, pluck: 0.3 }
};
export function voice(ti, pitch, t, dur, vel) {
  const p = TONE_P[ti] || TONE_P[6];
  const f = 440 * Math.pow(2, (pitch - 69) / 12);
  const a = vel / 127;
  const end = t + Math.max(dur, 0.06);
  const g = AU.ctx.createGain();
  const lp = filt('lowpass', p.lp, 1);
  lp.connect(g);
  g.connect(AU.out);
  const peak = Math.max(a * p.gain, 0.0002);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + p.atk);
  let stop;
  if (p.pluck) {
    g.gain.exponentialRampToValueAtTime(0.0001, t + p.pluck + 0.1);
    stop = t + p.pluck + 0.15;
  } else {
    g.gain.setValueAtTime(peak, Math.max(end, t + p.atk + 0.001));
    g.gain.linearRampToValueAtTime(0.0001, end + p.rel);
    stop = end + p.rel + 0.05;
  }
  p.w.forEach((w, i) => {
    const o = AU.ctx.createOscillator();
    o.type = w;
    o.frequency.value = f;
    if (p.det) o.detune.value = p.det[i] || 0;
    o.connect(lp);
    o.start(t);
    o.stop(stop);
  });
}
export function click(t, accent) {
  const g = genv(t, 0.25, 0.03);
  osc('square', accent ? 1600 : 1050, t, 0.05).connect(g);
}
