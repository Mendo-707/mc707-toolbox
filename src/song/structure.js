import { $, toast } from '../core/dom.js';
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { renderArr } from './arrangement.js';
import { carve, ensureBars, loopLen, q16, songEnd, wrapOff } from '../core/song-model.js';
import { renderEditor } from './editor.js';
import { cmMarks } from '../services/clip-switch.js';
import { showMenu } from '../ui/menu.js';
import { applyShape, posBarNow, shapeSlice } from './clip-ops.js';
import { splitAtBar } from './transpose.js';
import { hooks } from '../core/hooks.js';

/* ---------- song structure tools: copy, paste, repeat, insert, delete ranges ---------- */
let RANGEB = null;
function piecesIn(a, b) {
  const out = [];
  for (const c of S.clips) {
    const s0 = Math.max(c.start, a),
      e0 = Math.min(c.start + c.len, b);
    if (e0 - s0 < 1e-9) continue;
    const pc = {
      ...c,
      id: undefined,
      start: q16(s0 - a),
      len: q16(e0 - s0),
      off: wrapOff(c.off + (s0 - c.start), loopLen(c))
    };
    out.push(s0 > c.start + 1e-9 || e0 < c.start + c.len - 1e-9 ? applyShape(pc, shapeSlice(c, s0, e0)) : pc);
  }
  return out;
}
const markersIn = (a, b) => S.markers.filter(m => m.bar >= a && m.bar < b).map(m => ({ ...m, bar: m.bar - a }));
const cmarksIn = (a, b) =>
  cmMarks()
    .filter(m => m.bar >= a && m.bar < b)
    .map(m => ({ ...m, bar: m.bar - a }));
const carveAll = (a, b) => {
  for (let t = 0; t < 8; t++) carve(t, a, b);
};
function shiftAfter(at, d) {
  for (let t = 0; t < 8; t++) splitAtBar(at, new Set([t]));
  S.clips.forEach(c => {
    if (c.start >= at - 1e-9) c.start = q16(c.start + d);
  });
  S.markers.forEach(m => {
    if (m.bar >= at) m.bar = Math.max(0, m.bar + d);
  });
  cmMarks().forEach(m => {
    if (m.bar >= at) m.bar = Math.max(0, m.bar + d);
  });
}
function placeRange(r, at) {
  r.pieces.forEach(p => S.clips.push({ ...p, id: 'c' + S.nextId++, start: q16(at + p.start) }));
  r.marks.forEach(m => {
    if (!S.markers.some(x => x.bar === at + m.bar)) S.markers.push({ ...m, bar: at + m.bar });
  });
  (r.cm || []).forEach(m => {
    const ms = cmMarks();
    if (!ms.some(x => x.t === m.t && x.bar === at + m.bar)) ms.push({ ...m, bar: at + m.bar });
  });
  cmMarks().sort((a, b) => a.bar - b.bar || a.t - b.t);
  S.markers.sort((a, b) => a.bar - b.bar);
  ensureBars(at + r.len);
}
function structDone(msg) {
  S.clips = S.clips.filter(c => S.patterns[c.pat]);
  renderArr();
  renderEditor();
  hooks.syncControls();
  scheduleSave();
  if (msg) toast(msg);
}
function copyRange(a, b) {
  RANGEB = { len: b - a, pieces: piecesIn(a, b), marks: markersIn(a, b), cm: cmarksIn(a, b) };
  toast('Copied bars ' + (a + 1) + '–' + b + ' (' + RANGEB.pieces.length + ' clips)');
}
function pasteRange(at, insert) {
  if (!RANGEB) {
    toast('Copy a range first');
    return;
  }
  pushUndo();
  if (insert) shiftAfter(at, RANGEB.len);
  else carveAll(at, at + RANGEB.len);
  placeRange(RANGEB, at);
  structDone('Pasted at bar ' + (at + 1));
}
function repeatRange(a, b, times) {
  const r = { len: b - a, pieces: piecesIn(a, b), marks: markersIn(a, b), cm: cmarksIn(a, b) };
  pushUndo();
  shiftAfter(b, r.len * times);
  for (let k = 0; k < times; k++) placeRange(r, b + k * r.len);
  structDone('Repeated bars ' + (a + 1) + '–' + b + ' ×' + times);
}
function insertBarsAt(at, n) {
  pushUndo();
  shiftAfter(at, n);
  ensureBars(songEnd() + n);
  structDone('Inserted ' + n + ' bar' + (n > 1 ? 's' : '') + ' at bar ' + (at + 1));
}
function deleteRange(a, b, close) {
  pushUndo();
  carveAll(a, b);
  S.markers = S.markers.filter(m => m.bar < a || m.bar >= b);
  S.clipMarks = cmMarks().filter(m => m.bar < a || m.bar >= b);
  if (close) shiftAfter(b, -(b - a));
  structDone(close ? 'Deleted bars ' + (a + 1) + '–' + b + ' and closed the gap' : 'Cleared bars ' + (a + 1) + '–' + b);
}
export function rangeMenuItems(at) {
  const a = S.loop.start,
    b = S.loop.end;
  const len = b - a;
  const lab = 'bars ' + (a + 1) + '–' + b;
  return [
    { label: 'Range: ' + lab + (S.loop.on ? '' : ' (loop range)'), disabled: true },
    '-',
    { label: 'Copy ' + lab, action: () => copyRange(a, b) },
    {
      label: 'Paste at bar ' + (at + 1) + ' (overwrite)',
      disabled: !RANGEB,
      action: () => pasteRange(at, false)
    },
    {
      label: 'Paste at bar ' + (at + 1) + ' (insert and push the song later)',
      disabled: !RANGEB,
      action: () => pasteRange(at, true)
    },
    '-',
    { label: 'Duplicate ' + lab + ' right after it', action: () => repeatRange(a, b, 1) },
    {
      label: 'Repeat ' + lab,
      sub: [2, 3, 4, 8].map(n => ({
        label: '×' + n + ' (' + len * n + ' bars added)',
        action: () => repeatRange(a, b, n)
      }))
    },
    '-',
    {
      label: 'Insert empty bars at bar ' + (at + 1),
      sub: [1, 2, 4, 8, 16].map(n => ({
        label: n + (n === 1 ? ' bar' : ' bars'),
        action: () => insertBarsAt(at, n)
      }))
    },
    { label: 'Delete ' + lab + ' and close the gap', danger: true, action: () => deleteRange(a, b, true) },
    { label: 'Clear ' + lab + ' (keep the gap)', danger: true, action: () => deleteRange(a, b, false) }
  ];
}
export function initStructure() {
  $('#bStruct').addEventListener('click', e => {
    e.stopPropagation();
    const r = e.currentTarget.getBoundingClientRect();
    showMenu(r.left, r.bottom + 4, [
      { label: 'Drag on the ruler to choose a range, then use these.', disabled: true },
      '-',
      ...rangeMenuItems(Math.floor(posBarNow()))
    ]);
  });
}
