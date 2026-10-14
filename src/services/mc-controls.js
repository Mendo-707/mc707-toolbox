import { clamp } from '../core/dom.js';
import { S } from '../core/state.js';
import { AU, ensureAudio } from './synth.js';
import { MIDI, sendMidi } from './midi.js';

export const curveFn = { lin: t => t, exp: t => t * t, log: t => Math.sqrt(t), s: t => t * t * (3 - 2 * t) };
export function envInterp(pts, x, def) {
  if (!pts || !pts.length) return def;
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++)
    if (x <= pts[i][0]) {
      const a = pts[i - 1],
        b = pts[i];
      const t = b[0] === a[0] ? 1 : (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * t;
    }
  return pts[pts.length - 1][1];
}
export function fadeGain(c, pos) {
  let g = 1;
  const f = curveFn[c.fcv] || curveFn.lin;
  if (c.fi > 0) {
    const L = c.fi / 16;
    if (pos < L) g *= f(Math.max(0, pos / L));
  }
  if (c.fo > 0) {
    const L = c.fo / 16;
    const rem = c.len - pos;
    if (rem < L) g *= f(Math.max(0, rem / L));
  }
  return g;
}
export const velMul = (c, pos) => fadeGain(c, pos) * envInterp(c.ve, c.len ? pos / c.len : 0, 1);
export const AUTOLAST = {};
export function autoCC(ti, c, tick, time) {
  const x = (tick / 32 - c.start) / c.len;
  if (x < 0 || x > 1) return;
  const v = Math.round(clamp(envInterp(c.cc.pts, x, 0.5), 0, 1) * 127);
  const k = ti + ':' + c.cc.n;
  if (AUTOLAST[k] === v) return;
  AUTOLAST[k] = v;
  sendMidi([0xb0 | (S.tracks[ti].ch - 1), c.cc.n, v], time + (S.midiOffset || 0) / 1000);
}
export function tempoAtBar(bar) {
  let b = S.bpm;
  for (const m of S.markers) {
    if (m.bpm && m.bar <= bar + 1e-9) b = m.bpm;
  }
  return b;
}
export const tickDurAt = bar => 60 / tempoAtBar(bar) / 8;
export function sendCC(ti, n, v) {
  if (!MIDI.out) return false;
  ensureAudio();
  sendMidi([0xb0 | (S.tracks[ti].ch - 1), n, v], AU.ctx.currentTime);
  return true;
}
export function sendTrackCCs() {
  if (!MIDI.out || S.sendCC === false || !AU.ctx) return;
  S.tracks.forEach((t, i) => {
    if (t.cc) for (const n in t.cc) sendMidi([0xb0 | (t.ch - 1), +n, t.cc[n]], AU.ctx.currentTime + 0.02);
  });
}
