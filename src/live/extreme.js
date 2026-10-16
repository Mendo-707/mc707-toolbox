// Hi-hat rolls for the trap family (trap, drill, phonk, Memphis), at any Variation level, and
// Extreme variation (Variation above 100): every repeat of a loop changes, with snare rolls and
// kick drop-outs on the kit and octave flicks on the 808.
//
// Reads: LV.
import { clamp } from '../core/dom.js';
import { ROLL, rollNotes } from '../core/rolls.js';
import { emitNote } from '../services/transport.js';
import { LV, lvStyle } from './state.js';

/** True when Variation is in its Extreme range. */
export const lvExtreme = () => LV.vary > 100;
/* the styles whose hats roll: their rolls are part of the style, so they play whatever Variation is set to */
const TRAPFAM = ['trap', 'drill', 'phonk', 'memphis'];
/** True when the playing style is one whose hi-hats roll (trap, drill, phonk, Memphis). */
export const lvTrapRolls = () => TRAPFAM.includes(lvStyle().id);
const BEATS = [[3], [1, 3], [2, 3], [3], [0, 2, 3], [1, 2, 3]];
const plan = (v, hs, kinds) =>
  (v._vr = {
    beats: BEATS[(hs >>> 3) % BEATS.length],
    kind: kinds[(hs >>> 7) % kinds.length],
    two: (hs >>> 17) % 3 === 0
  });
/**
 * A trap-family hat roll for one repeat of a hats pattern (or a kit with hats): about two repeats in
 * three roll, on different beats of the last bar, in 16th triplets, 32nds, sextuplets or 64th ramps.
 * @returns {'hroll'|null}
 */
export function lvTrapRoll(v, t, hs) {
  if (!v.f.notes.some(n => n.n === 4) || (hs >>> 21) % 100 >= 65) return null;
  plan(v, hs, ['t16', 't16', '32', '64', 's24', 't8', 'h32']);
  return 'hroll';
}

/**
 * The Extreme variation for one repeat, chosen from a hash so the same repeat always does the same.
 * Kit: snare roll, kick drop-out or the gentler ones; Hats: open hats or thinning; 808: octave flick.
 * Hat rolls are not here: they belong to the trap family (lvTrapRoll), not to the Variation level.
 * @returns {string|null}
 */
export function lvXType(v, t, hs) {
  const o =
    t === 0
      ? ['sroll', 'kdrop', 'ghost', 'kickx', 'open', 'sroll']
      : t === 1
        ? ['open', 'thin']
        : t === 3
          ? ['slide', 'slide', 'oct', 'run']
          : ['oct', 'run', 'echo', 'up', 'thin'];
  const ty = o[(hs >>> 11) % o.length];
  if (ty === 'sroll') plan(v, hs, lvTrapRolls() ? ['t16', 't16', '32', '64', 's24'] : ['16', '32', '32', 'h32']);
  return ty;
}
/** Leave out a pattern note this repeat (the beats a hat roll replaces, kicks in a drop-out). */
export function lvXSkip(v, vt, local, L, n) {
  const lb = local - (L - 32);
  if (lb < 0) return false;
  if (vt === 'hroll') return n.n === 4 && v._vr.beats.includes(lb >> 3);
  if (vt === 'kdrop') return n.n === 0 && lb >= 16;
  return false;
}
/** Extra notes for the Extreme variations, placed exactly (triplets fall between ticks). */
export function lvXExtra(t, v, vt, local, L, nt, td, g) {
  const lb = local - (L - 32);
  if (lb < 0) return;
  const at = (notes, lane) =>
    notes.forEach(n => emitNote(t, lane ?? n.n, clamp(n.v * g, 1, 127), nt + n.s * 2 * td, Math.max(1, n.l * 2) * td));
  if (vt === 'hroll' && lb % 8 === 0 && v._vr.beats.includes(lb >> 3)) at(rollNotes(v._vr.kind, 0, 4, 96));
  else if (vt === 'sroll') {
    const start = v._vr.two ? 16 : 24;
    if (lb === start) at(rollNotes(v._vr.kind === 't8' ? 't16' : v._vr.kind, 0, 2, v._vr.two ? 80 : 108));
    if (v._vr.two && lb === 24) at(rollNotes(ROLL[v._vr.kind] && v._vr.kind !== 't8' ? v._vr.kind : '32', 0, 2, 116));
  } else if (vt === 'slide' && v._last != null) {
    if (lb === 24) emitNote(t, clamp(v._last + 12, 0, 127), clamp(110 * g, 1, 127), nt, 4.6 * td);
    else if (lb === 28) emitNote(t, clamp(v._last + 7, 0, 127), clamp(104 * g, 1, 127), nt, 4 * td);
  }
}
