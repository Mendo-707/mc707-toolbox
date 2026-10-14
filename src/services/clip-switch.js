// Switching MC-707 clips with program changes: the clip map, automatic switching by kind of part,
// and Song Mode clip-change flags played back at their bars.
//
// Owns: PCLAST (last clip sent per track), CLIPPIN (clips held by flags or scenes), CMK (clip-flag playback).
// Reads: S, MIDI, AU.
// Calls up the layers through hooks (core/hooks.js).
import { clamp } from '../core/dom.js';
import { devOn } from '../core/device.js';
import { S } from '../core/state.js';
import { facById } from '../library/index.js';
import { AU } from './synth.js';
import { MIDI, sendMidi } from './midi.js';
import { hooks } from '../core/hooks.js';

/* ===== MC-707 clips: how many clips each MC-707 track has and what kind of sound each one holds.
   When a track plays a different kind of part, the app switches that track to the matching clip (program change 0-15 = clip 1-16). ===== */
export const CLIP_TYPES = [
  ['drums', 'Drums', '#ff5f45'],
  ['bass', 'Bass', '#2fd3c0'],
  ['chords', 'Chords', '#4da3ff'],
  ['pad', 'Pad', '#a283ff'],
  ['lead', 'Lead', '#84d95b'],
  ['pluck', 'Pluck / arp', '#e9d94a'],
  ['fx', 'FX / other', '#9aa0ad']
];
export const CT_DEF = ['drums', 'drums', 'drums', 'bass', 'chords', 'pad', 'lead', 'pluck'];
export const CT_POOL = { bass: 'bass', chords: 'chords', pad: 'pad', lead: 'lead', pluck: 'pluck' };
/** [id, label, colour] for a clip type ('bass', 'lead' …). */
export const ctInfo = k => CLIP_TYPES.find(x => x[0] === k) || CLIP_TYPES[6];
export const PCLAST = {};
/** The clip map (S.clipMap), created and repaired if needed. @returns {import('../core/types.js').ClipMapEntry[]} */
export function cmFix() {
  if (!Array.isArray(S.clipMap) || S.clipMap.length !== 8)
    S.clipMap = CT_DEF.map(t => ({ n: 1, types: [t], names: [] }));
  S.clipMap.forEach((m, i) => {
    m.n = clamp(Math.round(+m.n || 1), 1, 16);
    if (!Array.isArray(m.types)) m.types = [];
    for (let k = 0; k < 16; k++)
      if (!ctInfo(m.types[k]) || !m.types[k]) m.types[k] = k === 0 ? CT_DEF[i] : m.types[k - 1] || CT_DEF[i];
    if (!Array.isArray(m.names)) m.names = [];
  });
  return S.clipMap;
}
/* what kind of part a pattern is */
/** What kind of part a pattern is: 'drums', 'bass', 'chords', 'pad', 'lead', 'pluck', or null. */
export function patType(p) {
  if (!p) return null;
  if (p.type === 'drum') return 'drums';
  const f = p.pool ? p : p.src ? facById(p.src) : null,
    pool = (f && f.pool) || '';
  const m = {
    bass: 'bass',
    fbass: 'bass',
    chords: 'chords',
    fchords: 'chords',
    pad: 'pad',
    lead: 'lead',
    flead: 'lead',
    pluck: 'pluck'
  }[pool];
  if (m) return m;
  const r = String(p.role || (f && f.role) || '').toLowerCase();
  return /bass/.test(r)
    ? 'bass'
    : /chord|stab|key/.test(r)
      ? 'chords'
      : /pad/.test(r)
        ? 'pad'
        : /arp|pluck/.test(r)
          ? 'pluck'
          : /lead|melod/.test(r)
            ? 'lead'
            : null;
}
/** The first clip on track t that holds this kind of part, or -1. */
export function clipFor(t, type) {
  if (!type) return -1;
  const m = cmFix()[t];
  for (let k = 0; k < m.n; k++) if (m.types[k] === type) return k;
  return -1;
}
/* switch an MC-707 track to the clip for this kind of part, a moment before its notes */
/** Automatic switching: when track t starts playing pattern p, switch to the clip that suits it. */
export function autoClip(t, p, time) {
  if (!S.clipAuto || !devOn(t) || CLIPPIN[t] != null) return;
  const k = clipFor(t, patType(p));
  if (k < 0 || PCLAST[t] === k) return;
  sendClip(t, k, time);
}
/* a clip chosen on purpose (a Song Mode clip change or a Live scene's clip) holds until the next one, and automatic switching waits */
export const CLIPPIN = {},
  CMNOW = {};
/** Forget which clips were sent (on start), so the next ones are sent again. */
export const autoClipReset = () => {
  for (const k in PCLAST) delete PCLAST[k];
  for (const k in CLIPPIN) delete CLIPPIN[k];
};
/** Switch MC-707 track t to clip k (program change k on its channel) at AU.ctx time. */
export function sendClip(t, k, time) {
  if (!devOn(t) || k == null || k < 0) return;
  PCLAST[t] = k;
  if (MIDI.out) sendMidi([0xc0 | (S.tracks[t].ch - 1), k], Math.max(0, time - 0.004));
  const d = AU.ctx && time ? Math.max(0, (time - AU.ctx.currentTime) * 1000) : 0;
  setTimeout(() => hooks.cmChipSet(t, k), d);
}
/* ---- Song Mode clip changes: a flag on a track at a bar tells that MC-707 track to change clip (k=-1 hands it back to automatic) ---- */
/** The song's clip-change flags (S.clipMarks), created if needed. */
export const cmMarks = () => S.clipMarks || (S.clipMarks = []);
/** The clip-change flag in effect on track t at a bar (the last one at or before it), or null. */
export function clipMarkAt(t, bar) {
  let r = null;
  for (const m of cmMarks()) if (m.t === t && m.bar <= bar + 1e-9 && (!r || m.bar > r.bar)) r = m;
  return r;
}
export const CMK = { last: -9 };
/** Plays clip-change flags while the song plays; on a jump (start, loop) it sets every track to the clip in effect. */
export function songClipTick(tick, time) {
  if (!S.clipMarks || !S.clipMarks.length) {
    CMK.last = tick;
    return;
  }
  const jump = tick !== CMK.last + 1;
  CMK.last = tick;
  if (!jump && tick % 32) return;
  const bar = Math.floor(tick / 32);
  for (let t = 0; t < 8; t++) {
    if (!devOn(t)) continue;
    const mk = jump ? clipMarkAt(t, bar) : S.clipMarks.find(m => m.t === t && m.bar === bar);
    if (!mk) {
      if (jump) delete CLIPPIN[t];
      continue;
    }
    if (mk.k >= 0) {
      CLIPPIN[t] = mk.k;
      if (PCLAST[t] !== mk.k) sendClip(t, mk.k, time);
    } else if (CLIPPIN[t] != null) {
      delete CLIPPIN[t];
      delete PCLAST[t];
    }
  }
}
