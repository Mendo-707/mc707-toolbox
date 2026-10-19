// Bringing a Live set back in line after the MIDI connection drops and returns (a USB hiccup): the
// MC-707 may have missed clip changes, effect moves and level fades, so everything is sent again.
//
// Reads: LV, S.
import { S } from '../core/state.js';
import { PCLAST } from '../services/clip-switch.js';
import { AU } from '../services/synth.js';
import { LV } from './state.js';
import { lvCellClip } from './engine.js';
import { lvLevelBack } from './fades.js';
import { knobsRest } from './pads.js';
import { lvRestCC, lvSendCC } from './moves.js';

/** Send the playing scene's clips, every track's level and the knobs again; moves resend on their next step. */
export function lvResync() {
  const now = AU.ctx ? AU.ctx.currentTime : 0,
    sc = LV.scenes[LV.cur];
  for (const k in PCLAST) delete PCLAST[k];
  LV.ccLast = {};
  for (let t = 0; t < 8; t++) {
    if (sc) lvCellClip(t, sc.cells[t], now + 0.05);
    if (LV.low) delete LV.low[t];
    lvLevelBack(t, now);
    /* every track's level, whether or not it was faded: the device may have missed any of it */
    lvSendCC(t, 11, lvRestCC(t, 11), now);
  }
  knobsRest();
  return S.tracks.length;
}
