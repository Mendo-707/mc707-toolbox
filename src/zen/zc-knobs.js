// What each track's FILTER, MOD, FX and SOUND knobs (C1-C4) control: the MC-707's KNOB ASSIGN, read and
// set over SysEx for the mixers.
//
// Found on an MC-707 (2026): a project file keeps four knob entries per clip (and per track sound),
// and over SysEx the track's live settings sit in the structure after its 16 clips (clip 17, the
// track's own), in the sound control area at +01 00 00: entry n (0-3) at +29 + n x 3C (linear), a
// 16-bit value as four half-bytes. Its low byte is the choice: 0A Cutoff, 0B Resonance, 01 Level
// (seen changing as KNOB ASSIGN was set); the high byte reads 20. A project file stores the same choice
// one lower. The app writes the track's structure and its 16 clips, so the knob does the same whichever
// clip plays.
//
// Owns: KN (what was last read or set). Reads: S (track types).
import { S } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import { ZX, lin, zxConnect, zxFlush, zxRead, zxWrite } from './zc-sysex.js';
import { clipAddr } from './zc-seq.js';
import { refreshClip } from './zc-fx.js';

/**
 * The choices: [value, name, which tracks ('all', 'td' tone and drum, 'tone'), sure]. "sure" ones were
 * seen on an MC-707 (directly or in a project file); the rest follow the manual's list in between.
 */
export const KNOB_ASSIGN = [
  [0, 'No Assign', 'all', true],
  [1, 'Level', 'all', true],
  [2, 'Pan', 'all', true],
  [3, 'Coarse Tune', 'td', false],
  [4, 'Fine Tune', 'td', false],
  [8, 'Portamento', 'tone', true],
  [9, 'Porta Time', 'tone', false],
  [10, 'Cutoff', 'td', true],
  [11, 'Resonance', 'td', true],
  [12, 'Attack', 'td', true],
  [13, 'Decay', 'td', true],
  [14, 'Release', 'td', true],
  [15, 'Vib Rate', 'tone', false],
  [16, 'Vib Depth', 'tone', false],
  [17, 'Vib Delay', 'tone', false],
  [18, 'Oct Shift', 'tone', true],
  [20, 'Delay Send', 'all', true],
  [21, 'Reverb Send', 'all', true],
  [0xa1, 'SYS-Ctrl1', 'td', true],
  [0xa2, 'SYS-Ctrl2', 'td', false],
  [0xa3, 'SYS-Ctrl3', 'td', false],
  [0xa4, 'SYS-Ctrl4', 'td', false]
];
/** The choices for a track of this type ('tone' or 'drum'), as [value, name]. */
export function knobChoices(type) {
  return KNOB_ASSIGN.filter(([, , k]) => k !== 'tone' || type === 'tone').map(([v, n]) => [v, n]);
}
/** The name of a choice (a value not in the list shows as its number). */
export const knobName = v => (KNOB_ASSIGN.find(x => x[0] === v) || [, 'Other (' + v + ')'])[1];

/** What the mixers show: per track, the four knobs' choices as last read or set (16-bit values). */
export const KN = { track: [] };

const ENTRY = 0x29,
  STRIDE = 0x3c;
/** Where knob n (0-3) of track t, clip k (16: the track's own) is kept. */
export const knobAddr = (t, k, n) => clipAddr(t, k) + lin(0x10000) + ENTRY + n * STRIDE;
const nibbles = v => [(v >> 12) & 15, (v >> 8) & 15, (v >> 4) & 15, v & 15];
const fromNibbles = b => ((b[0] & 15) << 12) | ((b[1] & 15) << 8) | ((b[2] & 15) << 4) | (b[3] & 15);

/** Read track t's four knob choices from the MC-707 (null when it does not answer). */
export async function readKnobs(t) {
  if (!(await zxConnect())) return null;
  const out = [];
  for (let n = 0; n < 4; n++) {
    const b = await zxRead(knobAddr(t, 16, n), 4);
    out.push(Array.isArray(b) && b.length === 4 ? fromNibbles(b) : null);
    /* no answer for the first knob: the others will not answer either */
    if (n === 0 && out[0] == null) return null;
  }
  if (out.every(v => v == null)) return null;
  KN.track[t] = out;
  return out;
}
/** Read every track's knob choices; resolves true when the MC-707 answered. */
export async function readAllKnobs(tracks, quiet = false) {
  /* quiet: only when the app is connected already (a mixer opening does not ask for MIDI access) */
  if (quiet && !ZX.out && !MIDI.out) return false;
  let any = false;
  for (const t of tracks) if (await readKnobs(t)) any = true;
  return any;
}
/**
 * Set knob n (0-3) of track t to a choice: the track's own structure and its 16 clips. Resolves false
 * when the MC-707 is not connected.
 */
export async function setKnob(t, n, choice) {
  if (!(await zxConnect())) return false;
  const now = KN.track[t] || (KN.track[t] = [null, null, null, null]);
  /* the high byte as read (20 on every track seen); the choice is the low byte */
  const high = now[n] != null ? now[n] >> 8 : 0x20,
    v = (high << 8) | (choice & 0xff);
  now[n] = v;
  zxWrite(knobAddr(t, 16, n), nibbles(v));
  for (let k = 0; k < 16; k++) zxWrite(knobAddr(t, k, n), nibbles(v));
  await zxFlush();
  /* the MC-707 shows the new choice once the clip is selected again */
  await refreshClip(t);
  return true;
}
/** For the mixers: the track type's choices and the knob's current choice (null: not read). */
export function knobNow(t, n) {
  const v = KN.track[t] && KN.track[t][n];
  return {
    choices: knobChoices(S.tracks[t].type === 'drum' ? 'drum' : 'tone'),
    cur: v == null ? null : v & 0xff
  };
}
