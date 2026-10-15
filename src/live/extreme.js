// Extreme variation (Variation above 100): every repeat of a loop changes. Hats break into rolls
// that suit the style (16th triplets for trap, drill and phonk, 32nds and 64th ramps elsewhere),
// snare rolls and kick drop-outs on the kit, and octave flicks on the 808.
//
// Reads: LV.
import { clamp } from '../core/dom.js';
import { ROLL, rollNotes } from '../core/rolls.js';
import { emitNote } from '../services/transport.js';
import { LV, lvStyle } from './state.js';

/** True when Variation is in its Extreme range. */
export const lvExtreme = () => LV.vary > 100;
/* styles whose rolls are mostly triplets */
const TRIP = ['trap', 'drill', 'phonk', 'memphis', 'halftime', 'dubstep', 'riddim', 'jungle'];
const BEATS = [[3], [1, 3], [2, 3], [3], [0, 2, 3], [1, 2, 3]];

/**
 * The Extreme variation for one repeat, chosen from a hash so the same repeat always does the same.
 * Kit: snare roll, hat roll, kick drop-out or the gentler ones; Hats: rolls; 808: octave flick.
 * @returns {string|null}
 */
export function lvXType(v, t, hs) {
  const hasHat = v.f.notes.some(n => n.n === 4);
  const o =
    t === 0
      ? ['sroll', 'kdrop', 'ghost', 'kickx', 'open', 'sroll', ...(hasHat ? ['hroll', 'hroll'] : [])]
      : t === 1
        ? hasHat
          ? ['hroll', 'hroll', 'hroll', 'open']
          : ['open']
        : t === 3
          ? ['slide', 'slide', 'oct', 'run']
          : ['oct', 'run', 'echo', 'up', 'thin'];
  const ty = o[(hs >>> 11) % o.length];
  if (ty === 'hroll' || ty === 'sroll') {
    const trip = TRIP.includes(lvStyle().id),
      kinds = trip ? ['t16', 't16', '32', '64', 's24', 't8'] : ['32', '32', 't16', '64', 'h32'];
    v._vr = {
      beats: BEATS[(hs >>> 3) % BEATS.length],
      kind: kinds[(hs >>> 7) % kinds.length],
      two: (hs >>> 17) % 3 === 0
    };
  }
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
