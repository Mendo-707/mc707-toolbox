// Web MIDI: the output and input ports, sending messages, and panic (all notes off).
//
// Owns: MIDI (MIDI ports).
// Reads: S, AU.
// Calls up the layers through hooks (core/hooks.js).
import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { mcFind } from '../core/device.js';
import { AU } from './synth.js';
import { hooks } from '../core/hooks.js';

/* ---------- MIDI ---------- */
export const MIDI = { access: null, out: null };
/* when each note was last sent (performance.now ms), so a note echoed back by the MC-707 is not taken for a player */
const SENTAT = new Map();
/** True if the app itself sent this note (channel 1-16) within the last `ms` milliseconds. */
export function sentRecently(ch, note, ms = 80) {
  const at = SENTAT.get(((ch - 1) << 7) | note);
  return at != null && Math.abs(performance.now() - at) < ms;
}
/**
 * Send a MIDI message to the chosen output at an AudioContext time (seconds).
 * @param {number[]} bytes
 * @param {number} at  AU.ctx time; use AU.ctx.currentTime for now
 */
export function sendMidi(bytes, at) {
  const o = MIDI.out;
  if (!o) return;
  try {
    const ms = performance.now() + (at - AU.ctx.currentTime) * 1000;
    if (bytes.length > 2 && (bytes[0] & 0xf0) === 0x90 && bytes[2] > 0) {
      NOTEHIST.add(((bytes[0] & 15) << 7) | bytes[1]);
      SENTAT.set(((bytes[0] & 15) << 7) | bytes[1], Math.max(ms, performance.now()));
    }
    o.send(bytes, Math.max(ms, 0));
  } catch (e) {}
}
/** Ask the browser for MIDI access, then pick the output (see refreshOuts). */
export async function connectMidi() {
  const st = $('#midiStat');
  if (!navigator.requestMIDIAccess) {
    st.textContent = 'Web MIDI is not available in this browser. Use Chrome or Edge on desktop.';
    return;
  }
  try {
    MIDI.access = await navigator.requestMIDIAccess({ sysex: false });
    MIDI.access.onstatechange = refreshOuts;
    refreshOuts();
  } catch (err) {
    st.textContent =
      'MIDI access was blocked (' +
      ((err && err.name) || 'error') +
      '). Allow MIDI for this page in your browser, or open the page in its own tab.';
  }
}
/** Refill the MIDI output list and pick the saved output, or the first MC-707. Also refreshes the input list. */
export function refreshOuts() {
  const sel = $('#midiOut');
  const outs = MIDI.access ? [...MIDI.access.outputs.values()] : [];
  sel.textContent = '';
  sel.append(el('option', { value: '' }, outs.length ? 'No output' : 'No devices found'));
  outs.forEach(o => sel.append(el('option', { value: o.id }, o.name)));
  let pick = outs.find(o => o.id === S.midiOut) || mcFind(outs);
  sel.value = pick ? pick.id : '';
  MIDI.out = pick || null;
  if (pick) S.midiOut = pick.id;
  $('#midiStat').textContent = pick
    ? 'Sending to ' + pick.name + '.'
    : outs.length
      ? 'Choose an output device.'
      : 'No MIDI outputs found. Plug in the MC-707 by USB and reconnect.';
  hooks.refreshIns();
}
const NOTEHIST = new Set();
/** All notes off and sustain off on every channel, now and again after the look-ahead. hard = also all sound off. */
export function panic(hard) {
  const o = MIDI.out;
  if (!o) return;
  const now = performance.now();
  const burst = ms => {
    for (let ch = 0; ch < 16; ch++) {
      o.send([0xb0 | ch, 123, 0], ms);
      o.send([0xb0 | ch, 64, 0], ms);
      if (hard) o.send([0xb0 | ch, 120, 0], ms);
    }
    NOTEHIST.forEach(k => o.send([0x80 | (k >> 7), k & 127, 0], ms));
  };
  /* once now, and again after the scheduling window so queued note-ons cannot start afterwards */
  try {
    burst(now);
    burst(now + 320);
  } catch (e) {}
  NOTEHIST.clear();
}
