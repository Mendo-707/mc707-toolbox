// Scene Mode's edits to the song's scenes (S.scn, see core/scene-model.js): add, copy, move and remove
// scenes, set a scene's length and name, put a pattern and a tone in a cell, and the selection. Every
// change is one undo step and is saved with the song.
//
// Owns: SC (the selected cell, the copied cell, what redraws after a change).
// Reads: S.
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { SCN_BARS, SCN_MAX, newRow } from '../core/scene-model.js';
import { hashOf } from '../zen/zc-sounds.js';

export const SC = {
  /* the selected cell: row index and track */
  row: 0,
  t: 0,
  /* a copied cell (or row, with rows) */
  copy: null,
  /* the cell open in the track editor (row and t), the editor expanded, the last click inside it */
  edit: false,
  big: false,
  /* the editor's tab: 'notes' (the pattern) or 'sound' (the ZenCore editor) */
  tab: 'notes',
  inDock: false,
  /* redraws Scene Mode after a change (set by the screen) */
  draw: () => {}
};

/** The scenes, or an empty list when the song has none. */
export const rows = () => (S.scn ? S.scn.rows : []);
/** The MC-707 scene the first row goes into (0-127). */
export const firstScene = () => (S.scn ? S.scn.first : 0);
const rowId = () => 'r' + S.nextId++;

/** Change the scenes as one undo step: fn(scn) edits S.scn (made when the song has none). */
export function edit(fn) {
  pushUndo();
  if (!S.scn) S.scn = { first: 0, rows: [], tones: {} };
  fn(S.scn);
  if (!S.scn.rows.length) delete S.scn;
  scheduleSave();
  SC.row = Math.max(0, Math.min(SC.row, rows().length - 1));
  SC.draw();
}

/** Add a scene after row i (at the end without i): a copy of row i's cells, or empty. */
export function addRow(i, copy = false) {
  if (rows().length >= SCN_MAX) return false;
  edit(q => {
    const at = i == null ? q.rows.length : i + 1,
      src = q.rows[i],
      r = newRow(rowId(), copy && src ? src.name : 'Scene ' + (q.rows.length + 1), src ? src.bars : 8);
    if (copy && src) r.cells = src.cells.map(c => (c ? { ...c } : null));
    q.rows.splice(at, 0, r);
    SC.row = at;
  });
  return true;
}
export function removeRow(i) {
  edit(q => q.rows.splice(i, 1));
}
export function moveRow(i, d) {
  const j = i + d;
  if (j < 0 || j >= rows().length) return;
  edit(q => {
    const [r] = q.rows.splice(i, 1);
    q.rows.splice(j, 0, r);
    SC.row = j;
  });
}
export function setBars(i, bars) {
  const b = Math.max(1, Math.min(SCN_BARS, Math.round(+bars) || 1));
  if (rows()[i] && rows()[i].bars !== b) edit(q => (q.rows[i].bars = b));
}
export function setName(i, name) {
  const n =
    String(name || '')
      .trim()
      .slice(0, 20) || 'Scene ' + (i + 1);
  if (rows()[i] && rows()[i].name !== n) edit(q => (q.rows[i].name = n));
}
export function setFirst(k) {
  edit(q => (q.first = Math.max(0, Math.min(SCN_MAX - 1, k | 0))));
}

/** Put song pattern pid in a cell (the transpose and tone it had stay, when the kind matches). */
export function setPattern(i, t, pid) {
  edit(q => {
    if (!q.rows.length) q.rows.push(newRow(rowId(), 'Scene 1'));
    const old = q.rows[i].cells[t];
    q.rows[i].cells[t] = { ...(old || {}), pat: pid };
  });
}
export function setTranspose(i, t, tr) {
  const c = rows()[i] && rows()[i].cells[t];
  if (!c) return;
  edit(q => {
    const x = q.rows[i].cells[t];
    if (tr) x.tr = Math.max(-48, Math.min(48, tr | 0));
    else delete x.tr;
  });
}
/**
 * Give a cell a tone (kept once in S.scn.tones), or none (null: the clip keeps the sound it has).
 * @param {{name:string, kind:'tone'|'kit', d:object}|null} tone
 */
export function setTone(i, t, tone) {
  const c = rows()[i] && rows()[i].cells[t];
  if (!c) return;
  edit(q => {
    const x = q.rows[i].cells[t];
    if (!tone) return void delete x.tone;
    const key = hashOf(tone.kind, tone.d);
    q.tones[key] = { name: String(tone.name || 'Tone').slice(0, 16), kind: tone.kind, d: tone.d };
    x.tone = key;
    /* forget tones nothing uses */
    const used = new Set(q.rows.flatMap(r => r.cells.map(y => y && y.tone)));
    for (const k in q.tones) if (!used.has(k)) delete q.tones[k];
  });
}
export function clearCell(i, t) {
  if (rows()[i] && rows()[i].cells[t]) edit(q => (q.rows[i].cells[t] = null));
}
/** Paste a copied cell (same kind of track only). */
export function pasteCell(i, t, c) {
  const p = c && S.patterns[c.pat];
  if (!p || p.type !== S.tracks[t].type) return false;
  edit(q => (q.rows[i].cells[t] = { ...c }));
  return true;
}
/** The tone a cell has, or null. */
export const toneOf = c => (c && c.tone && S.scn && S.scn.tones[c.tone]) || null;
