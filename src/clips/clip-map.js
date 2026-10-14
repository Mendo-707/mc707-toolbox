import { clamp } from '../core/dom.js';
import { DEV, devNum, devOn } from '../core/device.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { renderArr } from '../song/arrangement.js';
import { AU } from '../services/synth.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { CM_ABBR, clipMapOpen } from './clips-screen.js';
import { facById } from '../library/index.js';

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
export const ctInfo = k => CLIP_TYPES.find(x => x[0] === k) || CLIP_TYPES[6];
export const PCLAST = {};
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
export function clipFor(t, type) {
  if (!type) return -1;
  const m = cmFix()[t];
  for (let k = 0; k < m.n; k++) if (m.types[k] === type) return k;
  return -1;
}
/* switch an MC-707 track to the clip for this kind of part, a moment before its notes */
export function autoClip(t, p, time) {
  if (!S.clipAuto || !devOn(t) || CLIPPIN[t] != null) return;
  const k = clipFor(t, patType(p));
  if (k < 0 || PCLAST[t] === k) return;
  sendClip(t, k, time);
}
/* a clip chosen on purpose (a Song Mode clip change or a Live scene's clip) holds until the next one, and automatic switching waits */
export const CLIPPIN = {},
  CMNOW = {};
export const autoClipReset = () => {
  for (const k in PCLAST) delete PCLAST[k];
  for (const k in CLIPPIN) delete CLIPPIN[k];
};
export function sendClip(t, k, time) {
  if (!devOn(t) || k == null || k < 0) return;
  PCLAST[t] = k;
  if (MIDI.out) sendMidi([0xc0 | (S.tracks[t].ch - 1), k], Math.max(0, time - 0.004));
  const d = AU.ctx && time ? Math.max(0, (time - AU.ctx.currentTime) * 1000) : 0;
  setTimeout(() => cmChipSet(t, k), d);
}
function cmChipSet(t, k) {
  CMNOW[t] = k;
  ['thClip', 'lvClip'].forEach(p => {
    const e = document.getElementById(p + t);
    if (e) cmChipFill(e, t, k);
  });
}
export function cmChipFill(e, t, k) {
  const m = cmFix()[t],
    on = k != null && k >= 0;
  e.textContent = on ? 'C' + (k + 1) + ' ' + (m.names[k] ? m.names[k].slice(0, 7) : CM_ABBR[m.types[k]]) : 'Clip';
  e.style.setProperty('--k', on ? ctInfo(m.types[k])[2] : 'transparent');
  e.classList.toggle('on', on);
  e.title =
    (on ? devNm() + ' track ' + devNum(t) + ' is on ' + cmLabel(t, k) : 'No clip chosen yet') + '. Click to change.';
}
export const devNm = () => (DEV === '101' ? 'MC-101' : 'MC-707');
export const cmLabel = (t, k) => {
  if (k < 0) return 'Automatic';
  const m = cmFix()[t];
  return 'Clip ' + (k + 1) + ' · ' + (m.names[k] || ctInfo(m.types[k])[1]);
};
/* menu entries: every clip set up on this track, then automatic, then the clips screen */
export function cmPickItems(t, cur, fn, autoLabel) {
  const m = cmFix()[t],
    items = [];
  for (let k = 0; k < m.n; k++) items.push({ label: cmLabel(t, k), checked: cur === k, action: () => fn(k) });
  if (autoLabel && (S.clipAuto || cur === -1))
    items.push('-', { label: autoLabel, checked: cur === -1, action: () => fn(-1) });
  items.push('-', { label: 'Set up track ' + devNum(t) + ' clips…', action: () => clipMapOpen(t) });
  return items;
}
/* ---- Song Mode clip changes: a flag on a track at a bar tells that MC-707 track to change clip (k=-1 hands it back to automatic) ---- */
export const cmMarks = () => S.clipMarks || (S.clipMarks = []);
function clipMarkAt(t, bar) {
  let r = null;
  for (const m of cmMarks()) if (m.t === t && m.bar <= bar + 1e-9 && (!r || m.bar > r.bar)) r = m;
  return r;
}
export function setClipMark(t, bar, k) {
  pushUndo();
  bar = Math.max(0, Math.floor(bar));
  const ms = cmMarks(),
    ex = ms.find(m => m.t === t && m.bar === bar);
  if (ex) ex.k = k;
  else ms.push({ t, bar, k });
  ms.sort((a, b) => a.bar - b.bar || a.t - b.t);
  scheduleSave();
  renderArr();
}
export function delClipMark(mk) {
  pushUndo();
  S.clipMarks = cmMarks().filter(m => m !== mk);
  scheduleSave();
  renderArr();
}
/* which clip a track is on at a bar, as far as the app knows */
export function cmAtBar(t, bar) {
  const mk = clipMarkAt(t, bar);
  if (mk && mk.k >= 0) return mk.k;
  let last = null;
  for (const c of S.clips) if (c.t === t && c.start <= bar + 1e-9 && (!last || c.start > last.start)) last = c;
  if (last && last.pc != null) return last.pc;
  if (S.clipAuto && last) {
    const k = clipFor(t, patType(S.patterns[last.pat]));
    if (k >= 0) return k;
  }
  return null;
}
export const CMK = { last: -9 };
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
