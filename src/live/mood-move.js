// The mood change while playing: one bar from the next bar line into the new set. Intense moods roll the
// snare, open the filter all the way and cut to an eighth of silence before the new set slams in on a
// crash; calm moods let the beat drop out, close the filter and wash the reverb up, then the new set
// glides in. Short and on the bar, so it never stalls the music.
//
// Reads: LV, TR.
import { TR } from '../services/transport.js';
import { facById } from '../library/index.js';
import { toneTracksAll, trackOf } from '../core/tracks.js';
import { LV, lvRand } from './state.js';
import { lvBoundary, lvSortCues } from './cues.js';
import { lvFilterAway, lvMove } from './moves.js';

/**
 * Bring the rebuilt set in over one bar, styled by the mood. Returns the tick the new set starts on.
 * @param {{i:number,c:number}|null} m
 */
export function lvMoodMove(m) {
  const intense = !!m && m.i >= 60,
    calm = !!m && m.i <= 40;
  /* the next bar line, or the one after if it is less than a beat away */
  let t1 = lvBoundary(1);
  if (t1 - TR.tick < 8) t1 += 32;
  const t2 = t1 + 32;
  LV.cues = LV.cues.filter(c => !['scene', 'gap', 'thin', 'bov', 'blend'].includes(c.type) && c.type !== 'fill');
  LV.blend = null;
  /* the drums: a roll into it, or the beat falling away */
  const fills = LV.fillIds.map(facById).filter(Boolean),
    want = intense ? /Roll|Snare 16ths|Flam|Kick Stutter/ : calm ? /Drop-out|Tom Run|Mixed/ : /Mixed|Clap|Snare/,
    pick = fills.filter(f => want.test(f.name));
  const fill = pick.length ? lvRand(pick) : fills.length ? lvRand(fills) : null;
  if (fill && LV.scenes[LV.cur] && LV.scenes[LV.cur].cells[trackOf(0)])
    LV.cues.push({ type: 'fill', tick: t1, end: t2, f: fill });
  /* the melodic parts: the filter sweeps (open for intense, closed for calm) and comes back on the one */
  const T = toneTracksAll();
  if (T.length)
    lvMove({
      id: 'moodsweep',
      tag: 'q',
      tracks: T,
      cc: 80,
      kind: 'ramp',
      from: 'rest',
      to: calm ? lvFilterAway(0.55) : 127,
      curve: calm ? 'log' : 'exp',
      start: t1,
      end: t2
    });
  if (calm && T.length)
    lvMove({
      id: 'moodwash',
      tag: 'q',
      tracks: T,
      cc: 91,
      kind: 'ramp',
      from: 'rest',
      to: 100,
      curve: 'exp',
      start: t1,
      end: t2
    });
  /* intense: an eighth of silence before the slam */
  if (intense) LV.cues.push({ type: 'gap', tick: t2 - 4 });
  const idx = Math.min(LV.cur, LV.scenes.length - 1);
  LV.cues.push({ type: 'scene', idx: Math.max(0, idx), tick: t2, hard: intense || undefined });
  lvSortCues();
  LV.ver++;
  return t2;
}
