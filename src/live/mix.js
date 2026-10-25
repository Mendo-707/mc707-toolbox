// Live Mode's own mix: level, pan, reverb and chorus for each MC-707 track (CC 7, 10, 91 and 92), and the
// track's FILTER, MOD, FX and SOUND knobs (CC 80-83; until set, a track's knob rests where Live's knob
// panel has it, the same for every track), kept apart from the song's. These are the values the tracks rest at in Live Mode: moves and knobs that
// sweep one of them come back to it, and Start sends them all. The Live mixer window (live-mixer.js)
// sets them.
//
// Reads: LV, S.
import { S } from '../core/state.js';
import { sendMidi } from '../services/midi.js';
import { LV, saveLive } from './state.js';
import { lvRestCC, lvSendCC } from './moves.js';

/** The mixer's controls and their CCs. */
export const MIX_CC = { lvl: 7, pan: 10, rev: 91, cho: 92, flt: 80, mod: 81, fx: 82, snd: 83 };
const KEY_OF = { 7: 'lvl', 10: 'pan', 91: 'rev', 92: 'cho', 80: 'flt', 81: 'mod', 82: 'fx', 83: 'snd' };
/** The knob controls (a track's own value, or null: Live's knob panel's rest). */
export const MIX_KNOBS = ['flt', 'mod', 'fx', 'snd'];
/** The rest value of a mixer CC on track t, or undefined when cc is not one of the mixer's. */
export function lvMixRest(t, cc) {
  return KEY_OF[cc] ? lvRestCC(t, cc) : undefined;
}
/** What a control shows: the value last sent to the track (a knob or a move may have it elsewhere), else its rest. */
export function lvMixNow(t, key) {
  const last = LV.ccLast[t + ':' + MIX_CC[key]];
  return last != null ? last : lvMixRest(t, MIX_CC[key]);
}
/** Set a control: it becomes the track's rest and goes to the MC-707 at once. */
export function lvMixSet(t, key, v, nt) {
  LV.mix[key][t] = v;
  saveLive();
  lvSendCC(t, MIX_CC[key], v, nt);
}
/** Put a track's mix back to the defaults. */
export function lvMixReset(t, nt) {
  for (const [k, d] of [['lvl', 100], ['pan', 64], ['rev', null], ['cho', 0], ...MIX_KNOBS.map(k => [k, null])]) {
    LV.mix[k][t] = d;
    lvSendCC(t, MIX_CC[k], lvMixRest(t, MIX_CC[k]), nt);
  }
  saveLive();
}
/** Send the whole Live mix (at Start, after the song's track controls, so Live's own mix wins). */
export function lvMixSendAll(nt) {
  if (S.sendCC === false) return;
  for (let t = 0; t < 8; t++)
    for (const k in MIX_CC) {
      /* a knob the mixer has not set is Live's knob panel's, which Start sends already */
      if (MIX_KNOBS.includes(k) && LV.mix[k][t] == null) continue;
      const v = lvMixRest(t, MIX_CC[k]);
      LV.ccLast[t + ':' + MIX_CC[k]] = v;
      sendMidi([0xb0 | (S.tracks[t].ch - 1), MIX_CC[k], v], nt);
    }
}
