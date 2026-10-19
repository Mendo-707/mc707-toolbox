// The connection watch: a banner when the MC-707 (or MC-101) drops off MIDI mid-set, and a clean
// return when it comes back: notes released, then the playing set or song sent again, in time.
//
// Reads: TR, MIDI.
import { $, el, toast } from '../core/dom.js';
import { devNm } from '../core/device.js';
import { panic } from '../services/midi.js';
import { TR } from '../services/transport.js';
import { PCLAST } from '../services/clip-switch.js';
import { AUTOLAST } from '../services/mc-controls.js';
import { lvResync } from '../live/resync.js';

/** The device went away: say so, plainly, until it is back. The clock keeps running. */
export function midiLost(name) {
  let b = $('#linkWarn');
  if (!b) {
    b = el('div', { id: 'linkWarn', role: 'alert' });
    document.body.append(b);
  }
  b.textContent =
    (name || devNm()) +
    ' is disconnected. ' +
    (TR.playing
      ? 'The set keeps time; plug the USB cable back in and it picks up where it is.'
      : 'Plug the USB cable back in.');
  b.hidden = false;
}
/** The device is back: release anything left sounding, then send the current state again. */
export function midiBack(name) {
  const b = $('#linkWarn');
  if (b) b.hidden = true;
  panic(true);
  for (const k in PCLAST) delete PCLAST[k];
  for (const k in AUTOLAST) delete AUTOLAST[k];
  if (TR.playing && TR.mode === 'live') lvResync();
  toast((name || devNm()) + ' is back' + (TR.playing ? ', in time with the set' : '') + '.');
}
