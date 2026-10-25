// The notes in the MC-707's clips (its sequencer), read over SysEx. Roland never documented this; the
// layout is Ada Locriana's (github.com/Locriana/mctools_seq, MIT licence), found on an MC-707:
//
//   clip descriptor  20 00 00 00 for track 1 clip 1; each clip 08 00 00 further on, skipping addresses
//                    with a byte of 80 or more (so a track's 16 clips end before the next track's)
//   + 02 00 00       step settings: step size (0 1/8, 1 1/16, 2 1/32, 3 1/4T, 4 1/8T, 5 1/16T), then the
//                    number of steps (1-128) as two half-bytes
//   + 03 00 00       the steps, 01 00 apart; in each step up to 16 notes, slot by slot:
//                    +10/+20 pitch (two half-bytes each, FF = empty), +30 velocity,
//                    +40/+50 start in hundredths of a step (two half-bytes, signed, -50..99),
//                    +60 end in hundredths (100 = it carries on into the next step), +70 substep (0-4)
//
// A note longer than a step is stored again in each step it covers. This module only reads.
//
// Reads: S (the drum map), DEV.
import { toast } from '../core/dom.js';
import { askDlg } from '../ui/dialogs.js';
import { hooks } from '../core/hooks.js';
import { S } from '../core/state.js';
import { devNum } from '../core/device.js';
import { userSave } from '../library/user-lib.js';
import { ZX, devTrack, hexAddr, lin, zxConnect, zxRead } from './zc-sysex.js';

/* the first clip of each device track, packed as Roland writes addresses */
const CLIP1 = [0x20000000, 0x21080000, 0x22100000, 0x23180000, 0x24200000, 0x25280000, 0x26300000, 0x27380000];
/** App steps (16ths) per clip step, by the clip's step size: 1/8, 1/16, 1/32, 1/4T, 1/8T, 1/16T. */
export const STEP_SIZES = [2, 1, 0.5, 8 / 3, 4 / 3, 2 / 3];
export const STEP_NAMES = ['1/8', '1/16', '1/32', '1/4T', '1/8T', '1/16T'];
const EMPTY = 0xff,
  NONE = Array(16).fill(15);

/** A clip's descriptor, packed (0x20080000): device track d (0-7), clip k (0-15). */
export function clipPacked(d, k) {
  let a = CLIP1[d];
  for (let i = 0; i < k; i++) {
    a += 0x80000;
    while (a & 0x80808080) a += 0x80000;
  }
  return a;
}
/** Linear addresses for app track t, clip k: the descriptor, the step settings and step s's notes. */
export const clipAddr = (t, k) => lin(clipPacked(devTrack(t), k));
export const paramAddr = (t, k) => lin(clipPacked(devTrack(t), k) + 0x20000);
export const stepAddr = (t, k, s) => lin(clipPacked(devTrack(t), k) + 0x30000 + s * 0x100);

/* two half-bytes per value */
const pairs = (b, signed) => {
  const out = [];
  for (let i = 0; i + 1 < b.length; i += 2) {
    const v = ((b[i] & 15) << 4) | (b[i + 1] & 15);
    out.push(signed && v > 127 ? v - 256 : v);
  }
  return out;
};
/** The step settings: {size (0-5), steps (1-128)}, or null when they make no sense. */
export function decodeParams(b) {
  if (!b || b.length < 3) return null;
  const size = b[0],
    steps = ((b[1] & 15) << 4) | (b[2] & 15);
  return size >= 0 && size < STEP_SIZES.length && steps >= 1 && steps <= 128 ? { size, steps } : null;
}
/**
 * One step's note slots from its fields (each 16 bytes as the MC-707 sends them; missing ones empty).
 * @returns {{note:number, vel:number, start:number, end:number, sub:number}[]} only the filled slots
 */
export function decodeStep(f) {
  /* a half that did not come stays eight empty slots, so the slots keep their places */
  const notes = [...pairs(f.lo || NONE), ...pairs(f.hi || NONE)];
  const starts = [...pairs(f.startLo || NONE.map(() => 0), true), ...pairs(f.startHi || NONE.map(() => 0), true)];
  const out = [];
  notes.forEach((note, i) => {
    if (note === EMPTY || note > 127) return;
    out.push({
      note,
      vel: (f.vel && f.vel[i]) || 80,
      start: starts[i] || 0,
      end: f.end && f.end[i] != null ? f.end[i] : 80,
      sub: (f.sub && f.sub[i]) || 0
    });
  });
  return out;
}
/**
 * Join the steps' slots into notes: a slot ending at 100 carries on in the next step's slot with the
 * same pitch. Lengths are in hundredths of a step.
 * @param {ReturnType<typeof decodeStep>[]} steps
 * @returns {{step:number, note:number, vel:number, start:number, len:number, sub:number}[]}
 */
export function joinNotes(steps) {
  const used = steps.map(s => s.map(() => false)),
    out = [];
  steps.forEach((slots, si) => {
    slots.forEach((c, ci) => {
      if (used[si][ci]) return;
      used[si][ci] = true;
      let len = c.end < 100 ? Math.max(1, c.end - c.start) : 100 - c.start;
      let at = si + 1,
        on = c.end >= 100;
      while (on && at < steps.length) {
        const j = steps[at].findIndex((x, xi) => x.note === c.note && !used[at][xi]);
        if (j < 0) break;
        used[at][j] = true;
        const x = steps[at][j];
        if (x.end >= 100) len += 100;
        else {
          len += x.end;
          on = false;
        }
        at++;
      }
      out.push({ step: si, note: c.note, vel: c.vel, start: c.start, len, sub: c.sub });
    });
  });
  return out;
}
const BARS = [1, 2, 4, 8, 16, 32];
/**
 * The clip's notes as an app pattern (16ths). Drum notes become lanes through the song's drum map;
 * notes the map has no lane for are left out and counted.
 * @returns {{pattern: import('../core/types.js').Pattern, dropped: number}}
 */
export function toPattern(notes, params, type, name) {
  const k = STEP_SIZES[params.size],
    total = params.steps * k,
    bars = BARS.find(b => b * 16 >= total - 1e-6) || 32;
  let dropped = 0;
  const out = [];
  for (const x of notes) {
    const n = type === 'drum' ? S.drumMap.indexOf(x.note) : x.note;
    if (n < 0) {
      dropped++;
      continue;
    }
    const s = Math.round((x.step + x.start / 100) * k * 1000) / 1000;
    if (s < 0 || s >= bars * 16) continue;
    out.push({
      s,
      l: Math.max(0.05, Math.round((x.len / 100) * k * 1000) / 1000),
      n,
      v: Math.max(1, Math.min(127, x.vel))
    });
  }
  out.sort((a, b) => a.s - b.s || a.n - b.n);
  return {
    pattern: { id: '', name, type, bars, notes: out, role: type === 'drum' ? 'Full kit' : '' },
    dropped
  };
}

/* a read: the bytes, or null when the MC-707 sent nothing usable */
const read = async (l, n, ms) => {
  const r = await zxRead(l, n, ms, true);
  return Array.isArray(r) ? r : null;
};
/* when a read fails: the messages that went back and forth, to see what the MC-707 answered (and
   copied, to paste into a problem report) */
async function showWhy(why, t, k) {
  const lines = ZX.log.slice(0, 12).reverse();
  const text =
    why +
    '. Asked for track ' +
    devNum(t) +
    ' clip ' +
    (k + 1) +
    ' at ' +
    hexAddr(paramAddr(t, k)) +
    ' (step settings) and ' +
    hexAddr(stepAddr(t, k, 0)) +
    ' (step 1). The last SysEx messages (→ sent, ← received):\n' +
    (lines.length ? lines.join('\n') : '(none)');
  if (await askDlg({ title: 'Reading the clip’s notes did not work', text, ok: 'Copy and close', cancel: 'Close' }))
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied: paste it into a problem report');
    } catch (e) {}
}
/**
 * Read clip k of app track t from the MC-707 (read-only).
 * @param {(done:number, of:number) => void} [onStep] progress
 * @returns {Promise<{ok:true, params, notes, name:string} | {ok:false, why:string}>}
 */
export async function readClip(t, k, onStep) {
  if (!(await zxConnect()))
    return { ok: false, why: 'The MC-707 is not connected (or MIDI with SysEx is not allowed)' };
  const params = decodeParams(await read(paramAddr(t, k), 4, 600));
  if (!params) return { ok: false, why: 'The MC-707 did not answer for that clip' };
  const nm = await read(clipAddr(t, k), 16, 400);
  const name = nm ? String.fromCharCode(...nm.map(c => (c >= 32 && c < 127 ? c : 32))).trim() : '';
  const steps = [];
  for (let s = 0; s < params.steps; s++) {
    const a = stepAddr(t, k, s);
    /* some steps answer for the first 8 slots only: the rest then count as empty */
    const lo = await read(a + 0x10, 16, 300),
      hi = await read(a + 0x20, 16, 200);
    if (s === 0 && !lo) return { ok: false, why: 'The MC-707 did not send the clip’s notes' };
    const f = { lo, hi };
    if ([...pairs(lo || NONE), ...pairs(hi || NONE)].some(n => n !== EMPTY)) {
      f.vel = await read(a + 0x30, 16, 300);
      f.startLo = await read(a + 0x40, 16, 300);
      f.startHi = await read(a + 0x50, 16, 200);
      f.end = await read(a + 0x60, 16, 300);
      f.sub = await read(a + 0x70, 16, 300);
    }
    steps.push(decodeStep(f));
    if (onStep) onStep(s + 1, params.steps);
  }
  return { ok: true, params, notes: joinNotes(steps), name: name || 'Track ' + devNum(t) + ' clip ' + (k + 1) };
}

let busy = false;
/**
 * Read clip k of app track t from the MC-707 into My patterns (the clips screen's READ NOTES).
 * Nothing is sent to the MC-707 but read requests.
 */
export async function clipNotesToMine(t, k) {
  if (busy) return;
  busy = true;
  const where = 'track ' + devNum(t) + ' clip ' + (k + 1);
  toast('Reading the notes in ' + where + '…');
  try {
    const r = await readClip(t, k, (d, n) => {
      if (d % 8 === 0 && d < n) toast('Reading the notes in ' + where + '… step ' + d + ' of ' + n);
    });
    if (!r.ok) return showWhy(r.why, t, k);
    if (!r.notes.length) return toast('No notes in ' + where);
    const type = S.tracks[t].type === 'drum' ? 'drum' : 'tone';
    const { pattern, dropped } = toPattern(r.notes, r.params, type, r.name);
    if (!pattern.notes.length)
      return toast('None of the notes in ' + where + ' are on a drum lane here (see the drum map)');
    if (!userSave(pattern)) return toast('Could not save: the browser storage is full');
    hooks.renderAll();
    toast(
      'Read ' +
        pattern.notes.length +
        ' notes from ' +
        where +
        ' (' +
        r.params.steps +
        ' steps of ' +
        STEP_NAMES[r.params.size] +
        ') into My patterns as “' +
        pattern.name +
        '”' +
        (dropped ? '. ' + dropped + ' drum notes had no lane' : '')
    );
  } finally {
    busy = false;
  }
}
