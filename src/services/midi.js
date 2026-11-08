// Web MIDI: the output and input ports, sending messages, and panic (all notes off).
//
// Owns: MIDI (MIDI ports), MIDI_ACT (the last note sent on each channel, for activity lights).
// Reads: S, AU.
// Calls up the layers through hooks (core/hooks.js).
import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { isMcName, mcFind } from '../core/device.js';
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
/** The last note-on sent on each MIDI channel (0-15): {at: performance.now() time it plays, v: velocity}. */
export const MIDI_ACT = Array.from({ length: 16 }, () => ({ at: -1e9, v: 0 }));
/** How lit a channel's activity light is now (0-1): the last note's velocity, dying away over 0.3 s. */
export function midiAct(ch) {
  const a = MIDI_ACT[ch],
    dt = performance.now() - a.at;
  return dt < 0 || dt > 300 ? 0 : (a.v / 127) * (1 - dt / 300);
}
/* The audio clock moves on in steps (once per audio buffer, 3 to 20 ms on most computers) while
   performance.now() runs smoothly, so 'now + (at - currentTime)' is late by however long ago the last step
   was: every batch of notes would land up to a buffer late, a different amount each time, and fast hats
   would wobble. The gap between the two clocks is smallest just after a step, so the smallest gap seen
   lately is the true one; it may creep up slowly (the two clocks drift apart a little) and starts again
   after a jump (the audio was suspended). */
let GAP = null,
  GAPAT = 0;
/** performance.now() time (ms) of an AudioContext time (s). */
export function ctxMs(at) {
  const now = performance.now(),
    g = now - AU.ctx.currentTime * 1000;
  if (GAP == null || g < GAP || g > GAP + 100) GAP = g;
  else GAP = Math.min(g, GAP + (now - GAPAT) * 0.0002);
  GAPAT = now;
  return GAP + at * 1000;
}
export function sendMidi(bytes, at) {
  const o = MIDI.out;
  if (!o) return;
  try {
    /* the MIDI offset (latency trim) moves every message together: notes, clip changes, controls and the
       clock, so a clip change still comes before the clip's first note and a note-off after its note-on */
    const ms = ctxMs(at) + (S.midiOffset || 0);
    if (bytes.length > 2 && (bytes[0] & 0xf0) === 0x90 && bytes[2] > 0) {
      NOTEHIST.add(((bytes[0] & 15) << 7) | bytes[1]);
      SENTAT.set(((bytes[0] & 15) << 7) | bytes[1], Math.max(ms, performance.now()));
      const a = MIDI_ACT[bytes[0] & 15],
        t = Math.max(ms, performance.now());
      if (t >= a.at + 40 || bytes[2] > a.v) ((a.at = t), (a.v = bytes[2]));
    }
    o.send(bytes, Math.max(ms, 0));
  } catch (e) {}
}
/* ---------- played notes: a note-off never lands after the next note-on of the same key ----------
   With swing or humanize an off-beat note is played late but its next neighbour is not, so its note-off
   would come after the next note-on of the same key and cut that note short on the MC-707 (a hat or kick
   that clicks instead of ringing). So note-offs wait here (HELD) until no note of that key can come
   before them any more (flushOffs, once a tick), and a note-on of the same key sends the waiting note-off
   just before itself. Two note-ons of one key at the same moment play once (emitNote also catches two
   parts hitting one key on the same tick, before Humanize moves them apart). */
const HELD = new Map(),
  LASTON = new Map();
const DOUBLE = 0.0005; /* s: note-ons of one key closer than this are one hit */
/**
 * Send a note-on at an AudioContext time, ending the key's waiting note first. False if the key was
 * already hit at that moment (then send no note-off for it either).
 */
export function noteOn(ch, p, v, at) {
  const k = (ch << 7) | p,
    last = LASTON.get(k);
  if (last != null && Math.abs(at - last) < DOUBLE) return false;
  const h = HELD.get(k);
  if (h && h.on < at) {
    HELD.delete(k);
    sendMidi([0x80 | ch, p, 0], Math.min(h.at, Math.max(h.on + 0.001, at - 0.0005)));
  }
  LASTON.set(k, at);
  sendMidi([0x90 | ch, p, v], at);
  return true;
}
/** The note-off for a note that started at `on`: it waits until flushOffs (or the key's next note-on). */
export function noteOff(ch, p, at, on) {
  const k = (ch << 7) | p,
    h = HELD.get(k);
  if (h) {
    /* a note of this key already waiting: a later one ends before it starts, an earlier one is sent */
    if (h.on > on) return sendMidi([0x80 | ch, p, 0], Math.min(at, Math.max(on + 0.001, h.on - 0.0005)));
    sendMidi([0x80 | ch, p, 0], Math.min(h.at, Math.max(h.on + 0.001, on - 0.0005)));
  }
  HELD.set(k, { at, on });
  /* notes played with nothing scheduling after them (an audition, a pad): their note-offs go out
     when they are nearly due */
  if (!offTimer)
    offTimer = setInterval(() => {
      if (AU.ctx) flushOffs(AU.ctx.currentTime + 0.05);
      if (!HELD.size) offTimer = (clearInterval(offTimer), 0);
    }, 100);
}
let offTimer = 0;
/** Send the waiting note-offs due before `before` (all of them with no argument). */
export function flushOffs(before = Infinity) {
  for (const [k, h] of HELD)
    if (h.at < before) {
      HELD.delete(k);
      sendMidi([0x80 | (k >> 7), k & 127, 0], h.at);
    }
  if (before === Infinity) LASTON.clear();
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
  /* a port that was unplugged can stay in the list as 'disconnected': leave it out */
  const outs = MIDI.access ? [...MIDI.access.outputs.values()].filter(o => o.state !== 'disconnected') : [];
  const had = MIDI.out;
  sel.textContent = '';
  sel.append(el('option', { value: '' }, outs.length ? 'No output' : 'No devices found'));
  outs.forEach(o => sel.append(el('option', { value: o.id }, o.name)));
  /* with Connect to the MC-707 by itself on, an MC-707 or MC-101 plugged in wins over the port the song
     remembers: port ids are given out afresh, so a remembered one can belong to another device (a
     keyboard) next time. A port you picked yourself in this session stays picked. */
  let auto = true;
  try {
    auto = localStorage.getItem('mc707-autoconnect') !== '0';
  } catch (e) {}
  const saved = outs.find(o => o.id === S.midiOut),
    mc = mcFind(outs);
  let pick = MIDI.picked && saved ? saved : auto && mc ? mc : saved || mc;
  sel.value = pick ? pick.id : '';
  MIDI.out = pick || null;
  if (pick) S.midiOut = pick.id;
  /* an MC-101 on the port while the app is set to the MC-707 (or the reverse): follow the device */
  if (pick) hooks.matchDevice(pick.name);
  /* the device went away (USB unplugged, powered off) or came back: tell the user, and resync on return */
  if (had && !pick) {
    MIDI.lost = had.name;
    hooks.midiLost(had.name);
  } else if (pick && MIDI.lost) {
    MIDI.lost = null;
    hooks.midiBack(pick.name);
  } else if (pick && isMcName(pick.name) && !(had && isMcName(had.name))) {
    /* an MC-707 or MC-101 just found (at launch, plugged in, or picked): connect the rest */
    hooks.midiFound(pick.name);
  }
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
  flushOffs();
  const o = MIDI.out;
  if (!o) return;
  const now = performance.now();
  const burst = ms => {
    for (let ch = 0; ch < 16; ch++) {
      o.send([0xb0 | ch, 123, 0], ms);
      o.send([0xb0 | ch, 64, 0], ms);
      if (hard) o.send([0xb0 | ch, 120, 0], ms);
      /* the pitch back to the middle (a tape stop or spinback cut short) */
      o.send([0xe0 | ch, 0, 64], ms);
    }
    NOTEHIST.forEach(k => o.send([0x80 | (k >> 7), k & 127, 0], ms));
  };
  /* once now, and again after the scheduling window so queued note-ons cannot start afterwards */
  try {
    burst(now);
    burst(now + 320 + Math.max(0, S.midiOffset || 0));
  } catch (e) {}
  NOTEHIST.clear();
}
