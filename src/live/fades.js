// Smooth fades for Live Mode: a part fading in or out also ramps its MC-707 track's expression
// (CC 11), so held notes fade too instead of playing on at full level and stopping. After a fade-out
// the notes still held are released and the level goes back, ready for the next part on that track.
//
// Owns: LV.fadeEnds (pending ends of fade-outs), LV.low (tracks whose level is turned down).
// Reads: LV, S.
import { S } from '../core/state.js';
import { sendMidi } from '../services/midi.js';
import { LV } from './state.js';
import { lvMove, lvRestCC, lvSendCC } from './moves.js';

const EXPR = 11;
const ends = () => LV.fadeEnds || (LV.fadeEnds = []);
const low = () => LV.low || (LV.low = {});
const on = () => S.sendCC !== false;

/** Fade track t out over dur ticks from tick (an expression ramp to 0, then the held notes are released). */
export function lvFadeOut(t, tick, dur) {
  if (!on() || dur <= 0) return;
  lvMove({
    id: 'fade' + t,
    tag: 'fade',
    tracks: [t],
    cc: EXPR,
    kind: 'ramp',
    from: LV.ccLast && LV.ccLast[t + ':' + EXPR] != null ? LV.ccLast[t + ':' + EXPR] : low()[t] ? 0 : 'rest',
    to: 0,
    curve: 'lin',
    start: tick,
    end: tick + dur,
    restore: false
  });
  low()[t] = true;
  LV.fadeEnds = ends().filter(e => e.t !== t);
  ends().push({ t, at: tick + dur, back: tick + dur + 8 });
}
/** Fade track t in over dur ticks from tick: the expression starts at 0 and rises to its rest level. */
export function lvFadeIn(t, tick, dur, nt) {
  if (!on()) return;
  LV.fadeEnds = ends().filter(e => e.t !== t);
  if (dur <= 0) return lvLevelBack(t, nt);
  lvSendCC(t, EXPR, 0, nt);
  lvMove({
    id: 'fade' + t,
    tag: 'fade',
    tracks: [t],
    cc: EXPR,
    kind: 'ramp',
    from: 0,
    to: 'rest',
    curve: 'lin',
    start: tick,
    end: tick + dur
  });
  delete low()[t];
}
/** Put track t's level straight back (a new part starting on it without a fade). */
export function lvLevelBack(t, nt) {
  LV.fadeEnds = ends().filter(e => e.t !== t);
  if (!low()[t] && !(LV.autos || []).some(a => a.id === 'fade' + t)) return;
  LV.autos = LV.autos.filter(a => a.id !== 'fade' + t);
  delete low()[t];
  lvSendCC(t, EXPR, lvRestCC(t, EXPR), nt);
}
/** Each tick: release the notes of finished fade-outs, and a moment later bring their level back. */
export function lvFadeTick(tick, nt) {
  if (!LV.fadeEnds || !LV.fadeEnds.length) return;
  LV.fadeEnds = LV.fadeEnds.filter(e => {
    if (!e.off && tick >= e.at) {
      e.off = true;
      if (on() && !S.tracks[e.t].mute) sendMidi([0xb0 | (S.tracks[e.t].ch - 1), 123, 0], nt);
    }
    if (tick >= e.back) {
      lvLevelBack(e.t, nt);
      return false;
    }
    return true;
  });
}
/** Stop or start: every track turned down goes back to its rest level. */
export function lvFadesReset(nt) {
  const l = LV.low || {};
  LV.fadeEnds = [];
  for (const t in l) {
    if (on()) sendMidi([0xb0 | (S.tracks[t].ch - 1), EXPR, lvRestCC(+t, EXPR)], nt);
    delete l[t];
  }
}
