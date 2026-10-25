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
// A note longer than a step is stored again in each step it covers (end 100 in every step but the
// last), and a step's notes sit in its lowest slots, each pitch once.
//
// Reading puts a clip in My patterns. Writing puts a pattern into an EMPTY clip only (it reads the clip
// first and refuses one with notes), then reads it back to check. Nothing is kept on the MC-707 until
// its project is saved there.
//
// Owns: localStorage 'mc707-clip-reads' (which My pattern each clip was last read into).
// Reads: S (the drum map), DEV.
import { $, el, toast } from '../core/dom.js';
import { askDlg } from '../ui/dialogs.js';
import { hooks } from '../core/hooks.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { userById, userSave } from '../library/user-lib.js';
import { ZX, devTrack, hexAddr, lin, zxConnect, zxFlush, zxRead, zxWrite } from './zc-sysex.js';

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
  /* the step settings answer with 3 bytes (seen on an MC-707: 01 01 00 = 16 steps of 1/16) */
  const params = decodeParams(await read(paramAddr(t, k), 3, 600));
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
  return {
    ok: true,
    params,
    notes: joinNotes(steps),
    name: name || 'Track ' + devNum(t) + ' clip ' + (k + 1),
    /* how many name bytes the MC-707 sent: the name field's length, for writing a name */
    nameLen: nm ? nm.length : 0
  };
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
    /* a clip read again replaces the copy it was read into before (if that is still in My patterns) */
    const reads = readsMap(),
      before = reads[t + ':' + k] && userById(reads[t + ':' + k]) ? reads[t + ':' + k] : undefined;
    const id = userSave(pattern, before);
    if (!id) return toast('Could not save: the browser storage is full');
    reads[t + ':' + k] = id;
    keepReads(reads);
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

/* which My pattern each clip was last read into, by 't:k' */
function readsMap() {
  try {
    return JSON.parse(localStorage.getItem('mc707-clip-reads') || '{}') || {};
  } catch (e) {
    return {};
  }
}
function keepReads(m) {
  try {
    localStorage.setItem('mc707-clip-reads', JSON.stringify(m));
  } catch (e) {}
}

/* ---- writing ---- */
/** The most steps a clip holds (8 bars of 16ths). */
export const MAX_STEPS = 128;
/**
 * A pattern as clip steps of 1/16: the step slots the MC-707 keeps (lowest slots first, each pitch once
 * per step, long notes tied across steps). Drum lanes become notes through the song's drum map.
 * @returns {{steps:number, slots:{note,vel,start,end,sub}[][], skipped:number} | {error:string}}
 */
export function encodePattern(p, type) {
  const steps = Math.round(p.bars * 16);
  if (steps > MAX_STEPS) return { error: 'An MC-707 clip holds up to 8 bars of 16ths; this pattern is ' + p.bars };
  const slots = Array.from({ length: steps }, () => []);
  let skipped = 0;
  const notes = [...p.notes].sort((a, b) => a.s - b.s || a.n - b.n);
  for (const x of notes) {
    const note = type === 'drum' ? S.drumMap[x.n] : x.n;
    if (!(note >= 0 && note <= 127)) {
      skipped++;
      continue;
    }
    let at = Math.floor(x.s + 1e-6),
      start = Math.round((x.s - at) * 100);
    if (start >= 100) (at++, (start = 0));
    if (at < 0 || at >= steps) {
      skipped++;
      continue;
    }
    const vel = Math.max(1, Math.min(127, Math.round(x.v || 100)));
    let left = Math.max(1, Math.round((x.l || 0.8) * 100)),
      first = true,
      prev = null;
    while (left > 0 && at < steps) {
      const room = 100 - start,
        tie = left > room;
      const c = { note, vel, start, end: tie ? 100 : Math.min(99, start + left), sub: 0 };
      const s = slots[at];
      /* a full step, or this pitch already in it: the note is cut here */
      if (s.length >= 16 || s.some(y => y.note === note)) {
        if (first) skipped++;
        if (prev) prev.end = 99;
        prev = null;
        break;
      }
      s.push(c);
      prev = c;
      first = false;
      left -= room;
      start = 0;
      at++;
    }
    /* a note running past the clip's end stops on its last step */
    if (prev && prev.end >= 100) prev.end = 99;
  }
  return { steps, slots, skipped };
}
const nib = v => [((v & 0xff) >> 4) & 15, v & 15];
/** The 7 writes (offset, 16 bytes) that set one step's slots; empty slots as the MC-707 keeps them. */
export function stepWrites(slots) {
  const f = Array.from({ length: 16 }, (_, i) => slots[i] || null);
  return [
    [0x10, f.slice(0, 8).flatMap(c => nib(c ? c.note : EMPTY))],
    [0x20, f.slice(8).flatMap(c => nib(c ? c.note : EMPTY))],
    [0x30, f.map(c => (c ? c.vel : 0x50))],
    [0x40, f.slice(0, 8).flatMap(c => nib(c ? c.start : 0))],
    [0x50, f.slice(8).flatMap(c => nib(c ? c.start : 0))],
    [0x60, f.map(c => (c ? c.end : 0x50))],
    [0x70, f.map(c => (c ? c.sub : 0))]
  ];
}
/* the notes as the read gives them back, to compare */
const sig = notes =>
  notes
    .map(x => [x.step, x.note, x.start, x.len, x.vel].join(','))
    .sort()
    .join(' ');
/** The clip name bytes for a pattern name: printable ASCII, padded with spaces to the field's length. */
export const nameBytes = (s, n) =>
  Array.from({ length: n }, (_, i) => {
    const c = String(s || '').charCodeAt(i);
    return c >= 32 && c < 127 ? c : 32;
  });
/**
 * Write pattern p into clip k of app track t, then read it back. A clip that holds notes is left alone
 * unless o.replace; replacing writes all 128 steps, so nothing of the old notes stays past the end.
 * With o.name, the clip is named after the pattern (as many characters as its name field holds).
 * @param {{replace?:boolean, name?:boolean, onStep?:(done:number, of:number)=>void}} [o]
 * @returns {Promise<{ok:boolean, why?:string, notes?:number, skipped?:number, checked?:boolean, replaced?:boolean}>}
 */
export async function writeClip(t, k, p, o = {}) {
  const onStep = o.onStep;
  const type = S.tracks[t].type === 'drum' ? 'drum' : 'tone';
  if (p.type !== type) return { ok: false, why: 'That is a ' + p.type + ' pattern and this is a ' + type + ' track' };
  const enc = encodePattern(p, type);
  if (enc.error) return { ok: false, why: enc.error };
  const before = await readClip(t, k);
  if (!before.ok) return before;
  if (before.notes.length && !o.replace)
    return {
      ok: false,
      why: 'Clip ' + (k + 1) + ' already has notes. Tick Replace the notes to write over them'
    };
  const replaced = before.notes.length > 0;
  zxWrite(paramAddr(t, k), [1, (enc.steps >> 4) & 15, enc.steps & 15]);
  if (o.name && before.nameLen) zxWrite(clipAddr(t, k), nameBytes(p.name, before.nameLen));
  /* every step a replaced clip may have used, so none of its notes stays behind */
  const count = o.replace ? MAX_STEPS : enc.steps;
  for (let s = 0; s < count; s++) {
    const a = stepAddr(t, k, s);
    for (const [off, data] of stepWrites(enc.slots[s] || [])) zxWrite(a + off, data);
    if (onStep && s % 8 === 7) {
      await zxFlush();
      onStep(s + 1, count);
    }
  }
  await zxFlush();
  const want = joinNotes(enc.slots);
  const after = await readClip(t, k);
  const checked = after.ok && after.params.steps === enc.steps && sig(after.notes) === sig(want);
  return { ok: true, notes: want.length, skipped: enc.skipped, checked, replaced };
}

/* the picker: which track (of the pattern's type) and which clip */
let wbusy = false;
/** Ask where to send pattern p (from app track t, if any), then write it (the editor's → MC-707 clip). */
export function clipWriteAsk(p, t) {
  if (wbusy || $('#cwOv')) return;
  const tracks = DEVS[DEV].tracks.filter(i => (S.tracks[i].type === 'drum' ? 'drum' : 'tone') === p.type);
  if (!tracks.length) return toast('No ' + p.type + ' track to send it to');
  const trk = el(
    'select',
    { 'aria-label': 'Track' },
    ...tracks.map(i => el('option', { value: i, selected: i === t }, 'Track ' + devNum(i) + ' · ' + S.tracks[i].name))
  );
  const clip = el(
    'select',
    { 'aria-label': 'Clip' },
    ...Array.from({ length: 16 }, (_, k) => el('option', { value: k }, 'Clip ' + (k + 1)))
  );
  const box = (label, on, title) =>
    el('label', { class: 'cwOpt', title }, el('input', { type: 'checkbox', checked: on }), ' ' + label);
  const repl = box('Replace the notes if the clip has some', false, 'Otherwise a clip that holds notes is left alone'),
    named = box('Name the clip after the pattern', true, 'The clip’s name on the MC-707');
  const close = () => ov.remove();
  const go = el(
    'button',
    {
      type: 'button',
      class: 'btn on',
      onclick: () => {
        close();
        clipWriteNow(p, +trk.value, +clip.value, {
          replace: repl.firstChild.checked,
          name: named.firstChild.checked
        });
      }
    },
    'Write'
  );
  const ov = el(
    'div',
    { id: 'cwOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send to an MC-707 clip' },
    el(
      'div',
      { class: 'ptBox', style: 'max-width:460px' },
      el('h3', {}, 'Send “' + (p.name || 'this pattern') + '” to an MC-707 clip'),
      el(
        'p',
        { class: 'hint', style: 'line-height:1.45' },
        'Experimental. The app reads the clip first, and leaves one that holds notes alone unless you tick Replace. Up to 8 bars, in 1/16 steps. Nothing is kept until you save the project on the ' +
          DEVS[DEV].name +
          '; use a project you can lose while trying this.'
      ),
      el('div', { style: 'display:flex;gap:8px;margin:12px 0' }, trk, clip),
      el('div', { style: 'display:flex;flex-direction:column;gap:6px;margin-bottom:12px' }, repl, named),
      el(
        'div',
        { style: 'display:flex;gap:8px;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'),
        go
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  document.body.append(ov);
  setTimeout(() => go.focus(), 30);
}
/** Write pattern p into clip k of app track t now, with progress and the result as messages. */
export async function clipWriteNow(p, t, k, o = {}) {
  if (wbusy) return;
  wbusy = true;
  const where = 'track ' + devNum(t) + ' clip ' + (k + 1);
  toast('Checking ' + where + ' is empty…');
  try {
    if (!(await zxConnect())) return toast('The MC-707 is not connected (or MIDI with SysEx is not allowed)');
    const r = await writeClip(t, k, p, {
      ...o,
      onStep: (d, n) => toast('Writing ' + where + '… step ' + d + ' of ' + n)
    });
    if (!r.ok) return r.why && /answer|send/.test(r.why) ? showWhy(r.why, t, k) : toast(r.why);
    toast(
      (r.replaced ? 'Replaced the notes in ' + where + ' with ' : 'Wrote ') +
        r.notes +
        (r.replaced ? ' notes' : ' notes to ' + where) +
        (r.checked ? ', read back and checked' : '. The read-back did not match: check the clip on the MC-707') +
        (r.skipped ? '. ' + r.skipped + ' notes could not go in (no drum note, past the end, or a full step)' : '')
    );
  } finally {
    wbusy = false;
  }
}

/* ---- a whole song into clips ---- */
/**
 * What the song would send: for each track, its patterns in the order they first play (one per
 * pattern and transpose), each with the clip it goes to from that track's starting clip.
 * @param {Record<number, number>} starts  first clip (0-15) by app track
 * @returns {{t:number, items:{k:number, p:object, label:string, skip?:string}[]}[]}
 */
export function songPlan(starts = {}) {
  const out = [];
  for (const t of DEVS[DEV].tracks) {
    const seen = new Map();
    for (const c of [...S.clips].filter(c => c.t === t).sort((a, b) => a.start - b.start)) {
      const p = S.patterns[c.pat];
      if (!p || !p.notes.length) continue;
      const tr = p.type === 'tone' ? c.tr || 0 : 0,
        key = c.pat + ':' + tr;
      if (seen.has(key)) continue;
      const q = tr
        ? {
            ...p,
            name: p.name + ' ' + (tr > 0 ? '+' : '') + tr,
            notes: p.notes.map(n => ({ ...n, n: Math.max(0, Math.min(127, n.n + tr)) }))
          }
        : p;
      seen.set(key, q);
    }
    if (!seen.size) continue;
    let k = starts[t] || 0;
    const items = [];
    for (const p of seen.values()) {
      const skip = p.bars * 16 > MAX_STEPS ? 'longer than 8 bars' : k > 15 ? 'no clip left on this track' : '';
      items.push({ k: skip ? -1 : k, p, label: p.name, ...(skip ? { skip } : {}) });
      if (!skip) k++;
    }
    out.push({ t, items });
  }
  return out;
}
/** The Song menu's Send patterns to MC-707 clips: pick each track's first clip, then write them all. */
export function songToClipsOpen() {
  if (wbusy || $('#scOv')) return;
  const starts = {};
  const plan0 = songPlan();
  if (!plan0.length) return toast('The song has no patterns to send');
  const body = el('div', { class: 'scRows' });
  const repl = el(
      'label',
      { class: 'cwOpt' },
      el('input', { type: 'checkbox' }),
      ' Replace the notes in clips that have some'
    ),
    named = el(
      'label',
      { class: 'cwOpt' },
      el('input', { type: 'checkbox', checked: true }),
      ' Name each clip after its pattern'
    );
  const draw = () => {
    body.textContent = '';
    for (const row of songPlan(starts)) {
      const sel = el(
        'select',
        {
          'aria-label': 'First clip for track ' + devNum(row.t),
          onchange: e => ((starts[row.t] = +e.target.value), draw())
        },
        ...Array.from({ length: 16 }, (_, k) =>
          el('option', { value: k, selected: (starts[row.t] || 0) === k }, 'from clip ' + (k + 1))
        )
      );
      body.append(
        el(
          'div',
          { class: 'scRow' },
          el('b', {}, 'Track ' + devNum(row.t) + ' · ' + S.tracks[row.t].name),
          sel,
          el(
            'span',
            { class: 'hint' },
            row.items
              .map(i => (i.skip ? i.label + ' (skipped: ' + i.skip + ')' : 'clip ' + (i.k + 1) + ': ' + i.label))
              .join(' · ')
          )
        )
      );
    }
  };
  draw();
  const close = () => ov.remove();
  const go = el(
    'button',
    {
      type: 'button',
      class: 'btn on',
      onclick: () => {
        close();
        songToClipsNow(songPlan(starts), { replace: repl.firstChild.checked, name: named.firstChild.checked });
      }
    },
    'Send'
  );
  const ov = el(
    'div',
    { id: 'scOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Send patterns to MC-707 clips' },
    el(
      'div',
      { class: 'ptBox', style: 'max-width:720px' },
      el('h3', {}, 'Send the song’s patterns to MC-707 clips'),
      el(
        'p',
        { class: 'hint', style: 'line-height:1.45' },
        'Experimental. Each track’s patterns go into its clips in the order they play, from the clip you pick (a pattern with a transpose counts as its own). Up to 8 bars each, in 1/16 steps. Clips that hold notes are left alone unless you tick Replace. Nothing is kept until you save the project on the ' +
          DEVS[DEV].name +
          '.'
      ),
      body,
      el('div', { style: 'display:flex;flex-direction:column;gap:6px;margin:12px 0' }, repl, named),
      el(
        'div',
        { style: 'display:flex;gap:8px;justify-content:flex-end' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel'),
        go
      )
    )
  );
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  document.body.append(ov);
}
/** Write a song plan (songPlan) clip by clip, then show what went where. */
export async function songToClipsNow(plan, o = {}) {
  if (wbusy) return;
  wbusy = true;
  const lines = [];
  let done = 0,
    left = 0,
    bad = 0;
  try {
    if (!(await zxConnect())) return toast('The MC-707 is not connected (or MIDI with SysEx is not allowed)');
    const todo = plan.flatMap(r => r.items.filter(i => !i.skip).map(i => ({ t: r.t, ...i })));
    for (const [n, it] of todo.entries()) {
      const where = 'track ' + devNum(it.t) + ' clip ' + (it.k + 1);
      toast('Sending ' + (n + 1) + ' of ' + todo.length + ': ' + it.label + ' → ' + where);
      const r = await writeClip(it.t, it.k, it.p, { replace: o.replace, name: o.name });
      if (r.ok) {
        done++;
        if (!r.checked) bad++;
        lines.push(where + ': ' + it.label + (r.checked ? '' : ' (read-back did not match)'));
      } else {
        left++;
        lines.push(where + ': ' + it.label + ' (not sent: ' + r.why + ')');
      }
    }
    for (const r of plan)
      for (const i of r.items)
        if (i.skip) lines.push('track ' + devNum(r.t) + ': ' + i.label + ' (skipped: ' + i.skip + ')');
    await askDlg({
      title: 'Sent ' + done + ' pattern' + (done === 1 ? '' : 's') + ' to MC-707 clips',
      text:
        (bad ? bad + ' did not read back the same; check those clips. ' : '') +
        (left ? left + ' were not sent. ' : '') +
        'Save the project on the ' +
        DEVS[DEV].name +
        ' to keep them.\n\n' +
        lines.join('\n'),
      ok: 'OK',
      cancel: 'Close'
    });
  } finally {
    wbusy = false;
  }
}
