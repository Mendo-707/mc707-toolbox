// Humanize for Live Mode: makes the band sound played. Not random jitter but the habits of real
// players, scaled by one amount (0 = machine-tight, exactly as before):
//   timing   each instrument sits in its own place against the beat (snare laid back, hats riding
//            the front, keys behind, a lead that floats), a slow drift per player so the groove
//            breathes, the bass locked to wherever the kick landed, and the whole band moving together
//   dynamics downbeats and the backbeat lean in, hat strokes alternate hands, ghost notes stay low,
//            and every four bars the players lean into the turnaround
//   chords   strummed or rolled instead of struck as one block, alternating up and down strokes
//   length   notes held a little longer or shorter, like a real hand on the keys
//   flams    near the top of the slider the snare sometimes gets a grace note
// Four feels shape it: Natural, Laid back, Pushed and Drunk (loose and lazy, after J Dilla).
// Its own seeded random numbers, so the patterns Live Mode picks never change.
//
// Owns: HUM (amount 0-100 and feel, set by Live Mode).
// Reads: S.
import { slotOf } from '../core/tracks.js';

export const HUM = { amount: 0, feel: 'natural' };
/** The feels, in milliseconds at full amount: where each player sits (negative = ahead of the beat),
    how far they drift, how loose each hit is, and how wide a chord spreads. */
export const FEELS = {
  natural: { kick: 0, snare: 4, hat: 1, perc: 2, bass: 1, keys: 5, pad: 7, lead: 3, drift: 4, loose: 3, spread: 7 },
  laidback: {
    kick: 2,
    snare: 14,
    hat: 6,
    perc: 7,
    bass: 5,
    keys: 12,
    pad: 12,
    lead: 9,
    drift: 5,
    loose: 3,
    spread: 10
  },
  pushed: {
    kick: -2,
    snare: -4,
    hat: -6,
    perc: -4,
    bass: -4,
    keys: -2,
    pad: 2,
    lead: -3,
    drift: 3,
    loose: 2,
    spread: 5
  },
  drunk: { kick: -3, snare: 20, hat: 4, perc: 9, bass: 9, keys: 14, pad: 15, lead: 12, drift: 10, loose: 9, spread: 16 }
};
export const FEEL_NAMES = [
  ['natural', 'Natural'],
  ['laidback', 'Laid back'],
  ['pushed', 'Pushed'],
  ['drunk', 'Drunk']
];

let seed = 0x9e3779b9;
const rnd = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296;
const bi = () => rnd() * 2 - 1;
/* per player: a slow random walk (where they sit right now), redrawn a little each beat */
const walk = new Float64Array(8),
  walkAt = new Int32Array(8).fill(-1);
let bandWalk = 0,
  bandAt = -1;
/* chords: notes struck at the same moment on one track are counted, to spread them */
const chordAt = new Float64Array(8).fill(-1),
  chordN = new Int32Array(8),
  strokeUp = new Uint8Array(8);
/* the kick's offset this tick, which the bass follows */
let kickTick = -1,
  kickOff = 0;

/** Start a performance from the same feel every time (the seed follows the set). */
export function humReset(s = 1) {
  seed = (0x9e3779b9 ^ (s * 2654435761)) >>> 0;
  walk.fill(0);
  walkAt.fill(-1);
  bandWalk = 0;
  bandAt = -1;
  chordAt.fill(-1);
  kickTick = -1;
}
const LANE_ROLE = ['kick', 'snare', 'snare', 'snare', 'hat', 'hat', 'perc', 'perc', 'perc', 'hat', 'hat', 'perc'];
function roleOf(ti, isDrum, nn) {
  if (isDrum) return LANE_ROLE[nn] || 'perc';
  const s = slotOf(ti);
  return s === 3 ? 'bass' : s === 4 ? 'keys' : s === 5 ? 'pad' : s === 6 || s === 7 ? 'lead' : 'keys';
}
function drift(ti, beat, F, a) {
  if (walkAt[ti] !== beat) {
    walkAt[ti] = beat;
    /* a bounded random walk: wander, but always come back towards the pocket */
    walk[ti] = walk[ti] * 0.85 + bi() * 0.45;
  }
  if (bandAt !== beat) {
    bandAt = beat;
    bandWalk = bandWalk * 0.9 + bi() * 0.3;
  }
  return (walk[ti] * F.drift + bandWalk * F.drift * 0.6) * a;
}
function accent(role, step, bar, a) {
  const pos = step % 16;
  let m = 1;
  if (pos % 4 === 0) m += 0.1 * a;
  else if (pos % 2 === 1) m -= (role === 'hat' ? 0.2 : 0.08) * a;
  if (role === 'snare' && (pos === 4 || pos === 12)) m += 0.08 * a;
  /* lean into the last bar of each four */
  if (bar % 4 === 3) m += (0.04 + 0.04 * (pos / 16)) * a;
  return m + bi() * 0.09 * a;
}

/**
 * Shape one note. Returns {v, t, d} (velocity, start time, length) and flam: a grace note's time,
 * or null. Live Mode only; with the amount at 0 the note is returned as it came.
 * @param {number} ti   track
 * @param {number} nn   drum lane or MIDI note
 * @param {number} v    velocity
 * @param {number} t    start time (AudioContext seconds)
 * @param {number} d    length (seconds)
 * @param {boolean} isDrum
 * @param {number} tick the tick being played (32 per bar)
 * @param {number} earliest the earliest time a note may be sent
 */
export function humanize(ti, nn, v, t, d, isDrum, tick, earliest) {
  /* the slider's top is a firm human feel, not chaos: a gentle curve up to 60% of the full model */
  const x = HUM.amount / 100;
  if (x <= 0) return { v, t, d, flam: null };
  const a = 0.6 * Math.pow(x, 1.2);
  const F = FEELS[HUM.feel] || FEELS.natural,
    role = roleOf(ti, isDrum, nn),
    step = tick >> 1,
    bar = tick >> 5,
    beat = tick >> 3;
  let ms = F[role] * a + drift(ti, beat, F, a) + bi() * F.loose * a;
  /* the bass locks to wherever the kick landed on this tick */
  if (role === 'kick') {
    kickTick = tick;
    kickOff = ms;
  } else if (role === 'bass' && kickTick === tick) ms = kickOff + F.bass * 0.3 * a;
  /* chords are rolled: the notes of one hit spread out, alternating down and up strokes */
  if (!isDrum && (role === 'keys' || role === 'pad')) {
    if (Math.abs(chordAt[ti] - t) > 0.0005) {
      chordAt[ti] = t;
      chordN[ti] = 0;
      strokeUp[ti] ^= 1;
    }
    const k = chordN[ti]++,
      dir = strokeUp[ti] || role === 'pad' ? 1 : -1;
    ms += k * (F.spread / 4) * a * (dir > 0 ? 1 : 0.7) + (dir < 0 ? (3 - Math.min(k, 3)) * (F.spread / 6) * a : 0);
  }
  const nt = Math.max(earliest, t + ms / 1000),
    nv = Math.max(1, Math.min(127, Math.round(v * accent(role, step, bar, a)))),
    nd = isDrum ? d : Math.max(0.02, d * (1 + bi() * 0.12 * a));
  /* now and then a flam on the snare: a quiet grace note just before */
  const flam =
    role === 'snare' && x >= 0.75 && v > 70 && rnd() < 0.05 * x ? Math.max(earliest, nt - 0.012 - 0.01 * a) : null;
  return { v: nv, t: nt, d: nd, flam };
}
