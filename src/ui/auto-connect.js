// Connecting by itself: as the app opens, and whenever an MC-707 or MC-101 is plugged in while it runs, the
// app connects to it fully, as Set up your MC-707's Auto-connect does: notes out, its pads and keys in, the
// app set to the device found (MC-707 or MC-101), the ZenCore editor's connection, and (the first time only,
// so turning it off sticks) the MC-707 following the app's clock. Settings › Connect to the MC-707 by itself
// turns it off. In a browser it connects at launch only when MIDI is already allowed for the page, so the
// app never opens on a permission prompt; the desktop apps always may.
//
// Owns: localStorage 'mc707-autoconnect' ('0' when off), 'mc707-autoconnect-clock' (the clock set once).
// Reads: HOST, MIDI, S.
import { toast } from '../core/dom.js';
import { HOST, S, scheduleSave } from '../core/state.js';
import { mcFind } from '../core/device.js';
import { MIDI, connectMidi } from '../services/midi.js';
import { zxConnect } from '../zen/zc-sysex.js';
import { syncControls } from './controls.js';
import { setMidiIn } from './setup-wizard.js';

const KEY = 'mc707-autoconnect',
  CLOCK = 'mc707-autoconnect-clock';
const get = k => {
  try {
    return localStorage.getItem(k);
  } catch (e) {
    return null;
  }
};
const put = (k, v) => {
  try {
    localStorage.setItem(k, v);
  } catch (e) {}
};
/** True when the app connects to the MC-707 by itself (the default). */
export const autoConnectOn = () => get(KEY) !== '0';
/** Settings › Connect to the MC-707 by itself. */
export function autoConnectSet(on) {
  put(KEY, on ? '1' : '0');
  toast(on ? 'The app connects to the MC-707 by itself' : 'Connect to the MC-707 with the Connect button');
  if (on) autoConnectAtLaunch(true);
}
/* may MIDI be asked for without a prompt? (always in the desktop apps) */
async function allowed(sysex) {
  if (HOST) return true;
  try {
    const p = await navigator.permissions.query({ name: 'midi', sysex });
    return p.state === 'granted';
  } catch (e) {
    return false;
  }
}

/** As the app opens: connect if it may, quietly; finding the device does the rest (midiFound). */
export async function autoConnectAtLaunch(now) {
  if (!autoConnectOn() || !navigator.requestMIDIAccess || MIDI.access) return;
  if (!now && !(await allowed(false))) return;
  await connectMidi();
}

/**
 * An MC-707 or MC-101 has just become the output (at launch, plugged in, or picked): its input, the clock the
 * first time, and the ZenCore editor's connection, then say so.
 */
export async function midiFound(name) {
  /* off: connecting stays as you do it (Connect, or Set up your MC-707) */
  if (!autoConnectOn()) return;
  const ins = MIDI.access ? [...MIDI.access.inputs.values()].filter(i => i.state !== 'disconnected') : [];
  const mi = mcFind(ins);
  if (mi && (!MIDI.inp || MIDI.inp.id !== mi.id)) setMidiIn(mi.id);
  const parts = ['notes'];
  if (mi) parts.push('pads and keys');
  /* the MC-707 following the app's tempo: set once, so turning it off later sticks */
  if (!get(CLOCK)) {
    put(CLOCK, '1');
    if (!S.clock) {
      S.clock = true;
      syncControls();
      scheduleSave();
    }
  }
  if (S.clock) parts.push('clock');
  if (await allowed(true)) {
    try {
      if (await zxConnect()) parts.push('sounds');
    } catch (e) {}
  }
  toast(name + ' connected: ' + parts.join(', ').replace(/, ([^,]*)$/, ' and $1'));
}
