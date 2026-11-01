// Chord lock: keeps Live Mode's leads and plucks to the chord playing (after Scaler's Melody Lock and the way
// Logic's Session Players follow the chord track). The chord is read from the bass, chords and pad as they
// play right now (a stab's chord carries on until the next one). A lead or pluck note that lands on a beat
// or rings on, and rubs a half-step against that chord or rings on off it, moves to the nearest note of the
// chord; quick passing notes between the beats stay as written, so lines still move.
//
// Reads: LV (the voices playing, the key and mode).
import { shiftFor } from '../library/index.js';
import { lvModeFam } from '../library/pools.js';
import { tracksFor } from '../core/tracks.js';
import { LV } from './state.js';

/* a note as Live Mode plays it: moved into the set's key, and into its mode when written in the other one */
const modeNote = n => {
  const r = (((n - LV.key) % 12) + 12) % 12;
  if (LV.mode === 'major') return r === 3 || r === 8 || r === 10 ? n + 1 : n;
  return r === 4 || r === 9 || r === 11 ? n - 1 : n;
};
/* each pattern's pitch classes tick by tick (32 a bar), kept until the next chord, for the key and mode now */
const GRID = new Map();
function gridOf(f) {
  const sh = shiftFor(f, LV.key),
    conv = !!(f.key && lvModeFam(f.key.scale) !== LV.mode),
    key = f.id + '|' + LV.key + '|' + LV.mode;
  let g = GRID.get(key);
  if (g) return g;
  const n = f.bars * 32;
  g = Array.from({ length: n }, () => null);
  for (const x of f.notes) {
    const nn = conv ? modeNote(x.n + sh) : x.n + sh,
      pc = ((nn % 12) + 12) % 12;
    for (let t = Math.floor(x.s * 2); t < Math.min(n, Math.ceil((x.s + x.l) * 2)); t++)
      (g[t] = g[t] || new Set()).add(pc);
  }
  let last = null;
  for (let pass = 0; pass < 2; pass++)
    for (let t = 0; t < n; t++) {
      if (g[t]) last = g[t];
      else g[t] = last;
    }
  if (GRID.size > 400) GRID.clear();
  GRID.set(key, g);
  return g;
}
/**
 * The chord playing at tick `ft` (the loop's own time): the pitch classes of the bass, chords and pad, or
 * null when none of them is playing.
 */
export function lvChordNow(ft) {
  const out = new Set();
  for (const t of tracksFor([3, 4, 5])) {
    const vs = LV.voices[t] || [],
      v = vs.filter(x => x.env.v1 > 0).pop();
    if (!v || v.f.type !== 'tone' || !v.f.key) continue;
    const L = v.f.bars * 32,
      g = gridOf(v.f)[(((ft - v.start) % L) + L) % L];
    if (g) for (const pc of g) out.add(pc);
  }
  return out.size >= 2 ? out : null;
}
/**
 * The note a lead or pluck plays: nn as written, or the nearest chord note when it lands on a beat or rings
 * on and rubs against the chord (or rings on, off the chord, other than a 9th above its root).
 * @param {number} nn     the note as it would play
 * @param {number} len    its length in 16ths
 * @param {number} local  where it falls in its pattern, in ticks
 * @param {Set<number>|null} chord
 */
export function lvLockNote(nn, len, local, chord) {
  if (!chord) return nn;
  const pc = ((nn % 12) + 12) % 12;
  if (chord.has(pc)) return nn;
  const strong = local % 8 === 0,
    held = len >= 2,
    rub = chord.has((pc + 1) % 12) || chord.has((pc + 11) % 12);
  if (!((rub && (strong || held)) || len >= 4)) return nn;
  /* the nearest chord note, down first on a tie (a held note resolves down) */
  for (let d = 1; d <= 6; d++) {
    if (chord.has((((pc - d) % 12) + 12) % 12)) return nn - d;
    if (chord.has((pc + d) % 12)) return nn + d;
  }
  return nn;
}
