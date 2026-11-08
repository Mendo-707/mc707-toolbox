// Notes Live Mode plays a little ahead of where they were decided (an echo, a fill's run into the next
// note, a roll over a beat): each waits for its own tick, so it swings with the groove like the pattern
// notes and goes out in order with them (a note sent early could otherwise be cut by the notes before it).
//
// Reads: S, TR.
import { S } from '../core/state.js';
import { TR, emitNote } from '../services/transport.js';

const LATER = [];
/**
 * Play a note `ahead` ticks from the tick being played (fractions fall between ticks).
 * @param {number} t   track
 * @param {number} nn  note or drum lane
 * @param {number} v   velocity
 * @param {number} ahead ticks from now
 * @param {number} len  length in ticks
 * @param {(t:number)=>boolean} [skip] leave the note out if this says so when its tick comes
 */
export function lvLater(t, nn, v, ahead, len, skip) {
  const k = Math.floor(ahead + 1e-9);
  LATER.push({ tick: TR.tick + k, sub: Math.max(0, ahead - k), t, nn, v, len, skip });
}
/** Play the waiting notes due on this tick (run first thing each tick). */
export function lvLaterTick(tick, nt, td) {
  for (let i = 0; i < LATER.length; i++) {
    const e = LATER[i];
    if (e.tick > tick && e.tick < tick + 256) continue;
    LATER.splice(i--, 1);
    if (e.tick !== tick || S.tracks[e.t].mute || (e.skip && e.skip(e.t))) continue;
    emitNote(e.t, e.nn, e.v, nt + e.sub * (TR.subTd || td), e.len * td);
  }
}
/** Forget the waiting notes (on start and stop). */
export const lvLaterClear = () => void (LATER.length = 0);
