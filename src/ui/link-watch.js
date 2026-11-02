// The connection watch: a banner when the MC-707 (or MC-101) drops off MIDI mid-set, and a clean
// return when it comes back: notes released, then what is playing sent again, in time: a Live set's clips,
// levels and knobs, a song's mix, Synth Mode's mix, and, when the MC-707 follows the app's clock, where the
// song is and Continue, so its own sequencer picks up in step. Its pads and keys (MIDI in) are listened to
// again too.
//
// Reads: TR, MIDI, S.
import { $, el, toast } from '../core/dom.js';
import { devNm } from '../core/device.js';
import { MIDI, panic, sendMidi } from '../services/midi.js';
import { S } from '../core/state.js';
import { sendTrackCCs } from '../services/mc-controls.js';
import { sendMix } from '../zen/zc-synth-io.js';
import { setMidiIn } from './setup-wizard.js';
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
  else if (TR.playing) sendTrackCCs();
  if (document.body.dataset.mode === 'synth') sendMix();
  /* the MC-707 following the clock stopped when it went: where the song is (in 16ths), then Continue */
  if (TR.playing && S.clock && MIDI.out) {
    const spp = Math.round(TR.tick / 2) & 0x3fff;
    sendMidi([0xf2, spp & 127, spp >> 7], TR.nextTime);
    sendMidi([0xfb], TR.nextTime);
  }
  /* the device's own MIDI in came back as well: listen to it again */
  if (S.midiIn) setMidiIn(S.midiIn);
  toast((name || devNm()) + ' is back' + (TR.playing ? ', in time with the set' : '') + '.');
}
