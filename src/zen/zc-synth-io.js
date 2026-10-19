// Synth mode's state and what it does on the MC-707: which sound each track plays (a clip or the track's
// own sound), the mix (level, pan, reverb send, mute and solo), reading the sounds' names, setups (all
// eight sounds with the mix, in a file or kept in this browser) and passing a DAW's or keyboard's notes
// through to the MC-707, on their own channels or all to one track.
//
// Owns: SY (Synth mode's settings, localStorage 'mc707-synth'), the saved setups ('mc707-synth-setups').
// Reads: S, DEV, MIDI.
import { S } from '../core/state.js';
import { DEVS, DEV } from '../core/device.js';
import { MIDI } from '../services/midi.js';
import { ZX, slotAddr, trackSetAddr, zxConnect, zxRead, zxWrite } from './zc-sysex.js';
import { newSound, readSound, sendSound, soundFrom, soundJSON } from './zc-tone.js';
import { rememberClip } from './zc-library.js';
import { zeQuietly } from './zc-editor.js';
import { diffOf } from './zc-sounds.js';

const KEY = 'mc707-synth',
  SETUPS = 'mc707-synth-setups';
/* per track (0-7): slot 0-15 = clip 1-16, 16 = the track's own sound */
export const SY = {
  slot: Array(8).fill(0),
  level: Array(8).fill(100),
  pan: Array(8).fill(64),
  rev: Array(8).fill(0),
  mute: Array(8).fill(false),
  solo: Array(8).fill(false),
  names: Array(8).fill(''),
  /* the quick settings page open on each strip (null: closed) */
  page: Array(8).fill(null),
  thru: '',
  /* where passed-through notes go: 'own' (each on its own channel) or a track number */
  kbd: 'own'
};
try {
  const o = JSON.parse(localStorage.getItem(KEY) || '{}');
  for (const k of ['slot', 'level', 'pan', 'rev', 'names', 'mute', 'solo'])
    if (Array.isArray(o[k]) && o[k].length === 8)
      SY[k] = o[k].map((v, i) =>
        k === 'names' ? String(v || '') : k === 'mute' || k === 'solo' ? !!v : Number.isFinite(+v) ? +v : SY[k][i]
      );
  if (Array.isArray(o.page) && o.page.length === 8) SY.page = o.page.map(x => (typeof x === 'string' ? x : null));
  if (typeof o.thru === 'string') SY.thru = o.thru;
  if (o.kbd === 'own' || (Number.isInteger(o.kbd) && o.kbd >= 0 && o.kbd < 8)) SY.kbd = o.kbd;
} catch (e) {}
export function synthSave() {
  try {
    localStorage.setItem(KEY, JSON.stringify(SY));
  } catch (e) {}
}
export const tracks = () => DEVS[DEV].tracks;
export const kindOf = t => (S.tracks[t].type === 'drum' ? 'kit' : 'tone');
export const chOf = t => ((S.tracks[t] && S.tracks[t].ch) || t + 1) - 1;
const out = () => ZX.out || MIDI.out;
const cc = (t, n, v) => out() && out().send([0xb0 | chOf(t), n, v]);
export const slotOf = t => slotAddr(kindOf(t), t, SY.slot[t]);

/* ---- the mix ---- */
/** A track's level as heard: muted, or not soloed while another track is, is 0. */
export const heardLevel = t => (SY.mute[t] || (SY.solo.some(Boolean) && !SY.solo[t]) ? 0 : SY.level[t]);
const sendLevels = () => tracks().forEach(t => cc(t, 7, heardLevel(t)));
/** Track level (CC 7), pan (CC 10) and reverb send (CC 91). */
export function setLevel(t, v) {
  SY.level[t] = v;
  cc(t, 7, heardLevel(t));
  synthSave();
}
export function setPan(t, v) {
  SY.pan[t] = v;
  cc(t, 10, v);
  synthSave();
}
export function setRev(t, v) {
  SY.rev[t] = v;
  cc(t, 91, v);
  synthSave();
}
export function setMute(t, on) {
  SY.mute[t] = on;
  sendLevels();
  synthSave();
}
export function setSolo(t, on) {
  SY.solo[t] = on;
  sendLevels();
  synthSave();
}
/** Send the whole mix (on entering Synth mode, after opening a setup). */
export function sendMix() {
  for (const t of tracks()) {
    cc(t, 7, heardLevel(t));
    cc(t, 10, SY.pan[t]);
    cc(t, 91, SY.rev[t]);
  }
}
/** Stop every note on every track: sustain off, all notes off, all sound off. */
export function panic() {
  for (const t of tracks()) {
    cc(t, 64, 0);
    cc(t, 123, 0);
    cc(t, 120, 0);
  }
}

/**
 * Which sound a track plays: a clip (its Sound Source set to CLIP and the clip selected) or the track's
 * own sound (Sound Source TRACK). Changes the project in the MC-707's memory, as choosing on the unit does.
 */
export async function setSlot(t, k) {
  SY.slot[t] = k;
  synthSave();
  if (!(await zxConnect())) return false;
  zxWrite(trackSetAddr(t) + 4, [k === 16 ? 0 : 1]);
  if (k < 16 && out()) out().send([0xc0 | chOf(t), k]);
  return true;
}
const ascii = d =>
  (d || [])
    .map(x => (x >= 32 && x < 127 ? String.fromCharCode(x) : ' '))
    .join('')
    .trim();
/** Read each track's sound name (and which sound it plays). Returns false when the MC-707 does not answer. */
export async function readNames(progress) {
  if (!(await zxConnect()) || !ZX.inp) return false;
  let any = false;
  for (const t of tracks()) {
    const src = await zxRead(trackSetAddr(t) + 4, 1);
    if (src && src[0] === 0) SY.slot[t] = 16;
    else if (src && SY.slot[t] === 16) SY.slot[t] = 0;
    const d = await zxRead(slotOf(t), 16);
    if (d) {
      SY.names[t] = ascii(d);
      any = true;
    }
    if (progress) progress(t);
  }
  synthSave();
  return any;
}

/** Read one track's whole sound (null when the MC-707 does not answer). */
export async function readTrackSound(t) {
  if (!(await zxConnect()) || !ZX.inp) return null;
  const snd = newSound(kindOf(t)),
    r = await readSound(snd, slotOf(t));
  return r.silent || !r.ok ? null : snd;
}
/** Put a sound on track t's current slot (quietly). */
export async function sendTrackSound(t, snd) {
  if (!(await zxConnect()) || snd.kind !== kindOf(t)) return false;
  await zeQuietly(() => sendSound(snd, slotOf(t)), t);
  rememberClip(snd, t, SY.slot[t]);
  SY.names[t] = (snd.v[snd.kind === 'kit' ? 'KCMN.NAME' : 'CMN.NAME'] || '').trim();
  synthSave();
  return true;
}
/** Level, pan and reverb back to the start (100, centre, 0), mute and solo off. */
export function resetMix(t) {
  SY.mute[t] = SY.solo[t] = false;
  setLevel(t, 100);
  setPan(t, 64);
  setRev(t, 0);
}

/* ---- setups: every track's sound, where it plays from, and the mix ---- */
/**
 * Read every track's whole sound. Tracks that do not answer are left out; null when none answers.
 * progress(track, fraction) is called as it goes.
 */
export async function setupRead(progress) {
  if (!(await zxConnect()) || !ZX.inp) return null;
  const list = [];
  for (const t of tracks()) {
    const snd = newSound(kindOf(t)),
      r = await readSound(snd, slotOf(t), null, (d, n) => progress && progress(t, d / n));
    const e = { track: t, slot: SY.slot[t], level: SY.level[t], pan: SY.pan[t], rev: SY.rev[t], sound: null };
    if (!r.silent && r.ok) {
      e.sound = soundJSON(snd);
      SY.names[t] = e.sound.name.trim();
    }
    list.push(e);
  }
  synthSave();
  if (!list.some(e => e.sound)) return null;
  return { app: 'mc707-toolbox', synth: 1, device: DEV, tracks: list };
}
/** Send a setup to the MC-707: each sound into its slot (the track quiet while it goes in), then the mix. */
export async function setupSend(o, progress) {
  if (!o || o.synth !== 1 || !Array.isArray(o.tracks)) throw new Error('not a synth setup');
  if (!(await zxConnect())) return false;
  let n = 0;
  for (const e of o.tracks) {
    const t = e.track;
    if (!tracks().includes(t)) continue;
    const num = (v, lo, hi) => Number.isFinite(v) && Math.max(lo, Math.min(hi, v | 0));
    if (num(e.level, 0, 127) !== false) SY.level[t] = num(e.level, 0, 127);
    if (num(e.pan, 0, 127) !== false) SY.pan[t] = num(e.pan, 0, 127);
    if (num(e.rev, 0, 127) !== false) SY.rev[t] = num(e.rev, 0, 127);
    const snd = e.sound && soundFrom(e.sound);
    if (!snd || snd.kind !== kindOf(t)) continue;
    const k = Number.isInteger(e.slot) && e.slot >= 0 && e.slot <= 16 ? e.slot : 0;
    await setSlot(t, k);
    await zeQuietly(() => sendSound(snd, slotAddr(snd.kind, t, k)), t);
    rememberClip(snd, t, k);
    SY.names[t] = (e.sound.name || '').trim();
    n++;
    if (progress) progress(t);
  }
  SY.mute.fill(false);
  SY.solo.fill(false);
  sendMix();
  synthSave();
  return n;
}
/* setups kept in this browser: only what differs from the initial sounds, so they stay small */
export function setupsList() {
  try {
    const l = JSON.parse(localStorage.getItem(SETUPS) || '[]');
    return Array.isArray(l) ? l.filter(x => x && x.name && x.setup) : [];
  } catch (e) {
    return [];
  }
}
export function setupKeep(name, o) {
  const small = {
    ...o,
    tracks: o.tracks.map(e => {
      if (!e.sound) return e;
      const s = soundFrom(e.sound);
      return { ...e, sound: { ...e.sound, v: s ? diffOf(s) : e.sound.v } };
    })
  };
  const l = setupsList().filter(x => x.name !== name);
  l.unshift({ name, at: Date.now(), setup: small });
  try {
    localStorage.setItem(SETUPS, JSON.stringify(l));
    return true;
  } catch (e) {
    return false;
  }
}
export function setupForget(name) {
  try {
    localStorage.setItem(SETUPS, JSON.stringify(setupsList().filter(x => x.name !== name)));
  } catch (e) {}
}

/* ---- MIDI thru: notes from a DAW (through a virtual port) or a keyboard, passed to the MC-707 ---- */
let thruIn = null;
/** Called with the track a passed-through note played on (for the strips' activity lights). */
export const SYHOOK = { activity: null };
const pass = e => {
  let d = e.data;
  /* note, aftertouch, controller, program, pressure and pitch bend; never clock or SysEx */
  if (!d || d[0] < 0x80 || d[0] >= 0xf0 || !MIDI.out) return;
  if (SY.kbd !== 'own' && tracks().includes(SY.kbd)) {
    d = Uint8Array.from(d);
    d[0] = (d[0] & 0xf0) | chOf(SY.kbd);
  }
  MIDI.out.send(d);
  if ((d[0] & 0xf0) === 0x90 && d[2] > 0 && SYHOOK.activity) {
    const t = tracks().find(x => chOf(x) === (d[0] & 15));
    if (t != null) SYHOOK.activity(t);
  }
};
/** The inputs that can be passed through (not the MC-707 itself). */
export const thruInputs = () =>
  MIDI.access ? [...MIDI.access.inputs.values()].filter(p => !/MC-?(707|101)/i.test(p.name)) : [];
/** Pass notes from input id (or none) while Synth mode is open. */
export function thruSet(id, on = true) {
  if (thruIn) thruIn.removeEventListener('midimessage', pass);
  thruIn = null;
  SY.thru = id || '';
  synthSave();
  if (!on || !id || !MIDI.access) return;
  const p = MIDI.access.inputs.get(id);
  if (p) {
    p.addEventListener('midimessage', pass);
    thruIn = p;
  }
}
/** Where passed-through notes go: 'own' or a track. */
export function kbdSet(v) {
  SY.kbd = v;
  synthSave();
}
