// Keeping a Live set in tune with itself: the chord progression that is playing now, which
// patterns fit it when parts swap or a guest melody comes in, and where a new part should start so
// it lines up with the progression already playing.
//
// Reads: LV, S.
import { S } from '../core/state.js';
import { facById } from '../library/index.js';
import { lvProg } from '../library/pools.js';
import { LV } from './state.js';

/* which tone tracks to ask first: chords, then bass, pad, pluck, lead */
const ORDER = [4, 3, 5, 7, 6];
const live = t => LV.voices[t].filter(v => v.env.v1 > 0).pop() || null;

/**
 * The progression of the set right now ({prog, bars}): from the tone parts playing (leaving out
 * track `skip`), or else from the scene's own parts. Null when neither follows one.
 */
export function lvCurProg(skip) {
  for (const t of ORDER) {
    if (t === skip) continue;
    const v = live(t),
      p = v && lvProg(v.f);
    if (p) return { prog: p, bars: v.f.bars };
  }
  const sc = LV.scenes[LV.cur];
  for (const t of ORDER) {
    const c = sc && sc.cells[t],
      f = c && facById(c.id),
      p = f && lvProg(f);
    if (p) return { prog: p, bars: f.bars };
  }
  return null;
}
/**
 * The patterns from `ids` that fit the set's progression: the same progression and length. A part
 * that follows no progression (a riff, a hook) only gives way to another such part when `free` is
 * true. Drum tracks always fit. Returns [] when nothing fits, so the caller leaves the part alone
 * rather than clash.
 */
export function lvFitIds(t, ids, skipId, free) {
  const cand = ids.filter(id => id !== skipId && facById(id));
  if (S.tracks[t].type !== 'tone') return cand;
  const cur = lvCurProg(t);
  if (!cur) return cand;
  const same = cand.filter(id => {
    const f = facById(id);
    return lvProg(f) === cur.prog && f.bars === cur.bars;
  });
  if (same.length) return same;
  return free ? cand.filter(id => !lvProg(facById(id))) : [];
}
/**
 * Where a new part on track t should start (in ticks) so that it plays the same bar of the
 * progression as the parts already playing: their start when it shares their progression and
 * length, otherwise `tick`.
 */
export function lvAnchorStart(t, f, tick) {
  const p = lvProg(f);
  if (!p || S.tracks[t].type !== 'tone') return tick;
  for (let u = 3; u < 8; u++) {
    if (u === t || S.tracks[u].type !== 'tone') continue;
    const v = live(u);
    if (v && v.start <= tick && lvProg(v.f) === p && v.f.bars === f.bars) return v.start;
  }
  return tick;
}
/** How many melodic parts (chords, pad, lead, pluck) are playing now. */
export const lvMelodicCount = () => [4, 5, 6, 7].filter(t => live(t)).length;
