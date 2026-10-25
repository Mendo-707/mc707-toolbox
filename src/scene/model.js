// Scene Mode's edits to the song's scenes (S.scn, see core/scene-model.js): fill, change, copy and clear
// the clips on the board; add, copy, move and remove scenes, their names and lengths, and the clip each
// track plays in them; and what is selected. Every change is one undo step and is saved with the song.
//
// Owns: SC (the selected clip and scene, the copied clip, the editor's state, what redraws).
// Reads: S.
import { S, pushUndo, scheduleSave } from '../core/state.js';
import { SCN_BARS, SCN_MAX, clipMark, emptyClips, newRow, sceneMark } from '../core/scene-model.js';
import { hashOf } from '../zen/zc-sounds.js';

export const SC = {
  /* the selected scene (row) and the selected clip (track, clip) */
  row: 0,
  t: 0,
  k: 0,
  /* a copied clip */
  copy: null,
  /* the editor open under the board, expanded, its tab ('notes' or 'sound'), the last click inside it */
  edit: false,
  big: false,
  tab: 'notes',
  inDock: false,
  /* redraws Scene Mode after a change, and what else runs after one (set by the screen: Auto-write) */
  draw: () => {},
  changed: () => {}
};

/** The scenes, or an empty list. */
export const rows = () => (S.scn ? S.scn.rows : []);
/** Clip k of track t, or null. */
export const clipAt = (t, k) => (S.scn && S.scn.clips[t][k]) || null;
/** The MC-707 scene the first row goes into (0-127). */
export const firstScene = () => (S.scn ? S.scn.first : 0);
const rowId = () => 'r' + S.nextId++;
const blank = () => ({ v: 2, first: 0, clips: emptyClips(), rows: [], tones: {}, done: { c: {}, s: {} } });

/** Change the scenes as one undo step: fn(scn) edits S.scn (made when the song has none). */
export function edit(fn) {
  pushUndo();
  if (!S.scn) S.scn = blank();
  fn(S.scn);
  /* tones nothing uses go */
  const used = new Set(S.scn.clips.flat().map(c => c && c.tone));
  for (const k in S.scn.tones) if (!used.has(k)) delete S.scn.tones[k];
  if (!S.scn.rows.length && !S.scn.clips.some(l => l.some(Boolean))) delete S.scn;
  scheduleSave();
  SC.row = Math.max(0, Math.min(SC.row, rows().length - 1));
  SC.draw();
  SC.changed();
}

/* ---- scenes ---- */
/** Add a scene after row i (at the start with -1, at the end without i): a copy of row i, or empty. */
export function addRow(i, copy = false) {
  if (rows().length >= SCN_MAX) return false;
  edit(q => {
    const at = i == null ? q.rows.length : i + 1,
      src = q.rows[i],
      r = newRow(rowId(), copy && src ? src.name : 'Scene ' + (q.rows.length + 1), src ? src.bars : 8);
    if (copy && src) r.pick = [...src.pick];
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
/** Scene i plays clip k on track t (-1: nothing). */
export function setPick(i, t, k) {
  if (rows()[i] && rows()[i].pick[t] !== k) edit(q => (q.rows[i].pick[t] = k));
}

/* ---- clips ---- */
/** Put song pattern pid in clip k of track t (its transpose and tone stay); pick: also play it in scene i. */
export function setPattern(t, k, pid, pick) {
  edit(q => {
    q.clips[t][k] = { ...(q.clips[t][k] || {}), pat: pid };
    if (pick != null && q.rows[pick]) q.rows[pick].pick[t] = k;
  });
}
export function setTranspose(t, k, tr) {
  if (!clipAt(t, k)) return;
  edit(q => {
    const x = q.clips[t][k];
    if (tr) x.tr = Math.max(-48, Math.min(48, tr | 0));
    else delete x.tr;
  });
}
/**
 * Give a clip a tone (kept once in S.scn.tones), or none (null: the MC-707 clip keeps the sound it has).
 * @param {{name:string, kind:'tone'|'kit', d:object}|null} tone
 */
export function setTone(t, k, tone) {
  if (!clipAt(t, k)) return;
  edit(q => {
    const x = q.clips[t][k];
    if (!tone) return void delete x.tone;
    const key = hashOf(tone.kind, tone.d);
    q.tones[key] = { name: String(tone.name || 'Tone').slice(0, 16), kind: tone.kind, d: tone.d };
    x.tone = key;
  });
}
/** Empty clip k of track t; the scenes that played it play nothing there. */
export function clearClip(t, k) {
  if (!clipAt(t, k)) return;
  edit(q => {
    q.clips[t][k] = null;
    q.rows.forEach(r => r.pick[t] === k && (r.pick[t] = -1));
  });
}
/** Put a copied clip in clip k of track t (same kind of track only). */
export function pasteClip(t, k, c) {
  const p = c && S.patterns[c.pat];
  if (!p || p.type !== S.tracks[t].type) return false;
  edit(q => (q.clips[t][k] = { ...c }));
  return true;
}
/** Move or swap clip a and clip b of track t, and the scenes with them. */
export function swapClips(t, a, b) {
  if (a === b) return;
  edit(q => {
    [q.clips[t][a], q.clips[t][b]] = [q.clips[t][b], q.clips[t][a]];
    q.rows.forEach(r => (r.pick[t] = r.pick[t] === a ? b : r.pick[t] === b ? a : r.pick[t]));
  });
}
/** The first empty clip of track t, or -1. */
export const freeClip = t => (S.scn ? S.scn.clips[t].findIndex(c => !c) : 0);
/** The tone a clip has, or null. */
export const toneOf = c => (c && c.tone && S.scn && S.scn.tones[c.tone]) || null;

/* ---- what was written ---- */
/** Mark clip k of track t as written as it is now (odd: the MC-707 read it back differently). */
export function markClip(t, k, odd = false) {
  const q = S.scn,
    c = q && q.clips[t][k];
  if (c) q.done.c[t + ':' + k] = (odd ? '!' : '') + clipMark(c, S.patterns, q.tones);
}
/** Mark scene row i as written as it is now (odd: read back differently). */
export function markScene(i, odd = false) {
  const q = S.scn;
  if (q && q.rows[i]) q.done.s[q.first + i] = (odd ? '!' : '') + sceneMark(q, i);
}
/** Forget what was written (after loading another project on the MC-707). */
export function forgetWritten() {
  edit(q => (q.done = { c: {}, s: {} }));
}
