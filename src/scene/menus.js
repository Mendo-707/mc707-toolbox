// Scene Mode's menus and the actions behind them: a cell's menu (pattern, tone, transpose, edit in Song
// Mode, copy and paste, clear) and a scene's menu (play, copy, move, remove), and the keys Scene Mode
// answers (Space, arrows, Delete, copy and paste, undo).
//
// Reads: S, SC.
// Calls up the layers through hooks (core/hooks.js).
import { toast } from '../core/dom.js';
import { ED, S, pushUndo, redo, undo } from '../core/state.js';
import { curPat, touch } from '../core/song-model.js';
import { drawEditor } from '../song/editor.js';
import { showMenu } from '../ui/menu.js';
import { scnStart } from '../core/scene-model.js';
import { hooks } from '../core/hooks.js';
import { openView } from '../song/lib-view.js';
import {
  SC,
  addRow,
  clearCell,
  edit,
  moveRow,
  pasteCell,
  removeRow,
  rows,
  setPattern,
  setStart,
  setTone,
  setTranspose,
  toneOf
} from './model.js';
import { pickPattern } from './pick-pattern.js';
import { pickTone } from './pick-tone.js';
import { sceneLabel } from './names.js';

/** Choose the pattern for a cell. */
export function choosePattern(i, t, after) {
  const c = rows()[i] && rows()[i].cells[t];
  pickPattern(
    t,
    'scene ' + sceneLabel(i),
    pid => {
      setPattern(i, t, pid);
      if (after) after();
    },
    c && c.pat
  );
}
/** Choose the tone for a cell (it needs a pattern first). */
export function chooseTone(i, t) {
  const c = rows()[i] && rows()[i].cells[t];
  if (!c) return toast('Choose a pattern for this cell first');
  const tn = toneOf(c);
  pickTone(t, 'scene ' + sceneLabel(i), tone => setTone(i, t, tone), tn && tn.name);
}
/** A cell's menu at x, y. onEdit opens it in the track editor. */
export function cellMenu(i, t, x, y, onEdit) {
  const c = rows()[i] && rows()[i].cells[t],
    above = i > 0 && rows()[i - 1].cells[t],
    tr = (c && c.tr) || 0,
    tone = S.tracks[t].type === 'tone';
  const shift = d => ({ label: (d > 0 ? '+' : '') + d, action: () => setTranspose(i, t, tr + d) });
  showMenu(x, y, [
    c ? { label: 'Edit the notes', action: () => onEdit(i, t) } : null,
    c ? { label: 'Edit the sound (ZenCore)', action: () => ((SC.tab = 'sound'), onEdit(i, t)) } : null,
    { label: c ? 'Change pattern…' : 'Choose a pattern…', action: () => choosePattern(i, t) },
    c ? { label: toneOf(c) ? 'Change tone…' : 'Choose a tone…', action: () => chooseTone(i, t) } : null,
    c && toneOf(c) ? { label: 'Keep the clip’s own sound', action: () => setTone(i, t, null) } : null,
    c && tone
      ? {
          label: 'Transpose' + (tr ? ' (' + (tr > 0 ? '+' : '') + tr + ')' : ''),
          sub: [shift(1), shift(-1), shift(12), shift(-12), { label: 'None', action: () => setTranspose(i, t, 0) }]
        }
      : null,
    c
      ? {
          label: 'Edit the pattern in Song Mode',
          action: () => (hooks.setMode('song'), openView({ kind: 'proj', id: c.pat }, t))
        }
      : null,
    '-',
    above ? { label: 'Same as the scene above', action: () => pasteCell(i, t, above) } : null,
    c ? { label: 'Copy', hint: 'Ctrl+C', action: () => (SC.copy = { ...c }) } : null,
    SC.copy ? { label: 'Paste', hint: 'Ctrl+V', action: () => paste(i, t) } : null,
    c ? { label: 'Clear', hint: 'Del', danger: true, action: () => clearCell(i, t) } : null
  ]);
}
function paste(i, t) {
  if (!pasteCell(i, t, SC.copy)) toast('That cell is for the other kind of track (drums and tones don’t mix)');
}
/** A track's menu (its name in the grid head) at x, y. onEdit opens a cell in the track editor. */
export function trackMenu(t, x, y, onEdit) {
  const rs = rows(),
    has = rs.findIndex(r => r.cells[t]);
  showMenu(x, y, [
    {
      label: 'Edit this track',
      disabled: has < 0,
      action: () => ((SC.big = true), (SC.tab = 'notes'), onEdit(Math.max(0, has), t))
    },
    { label: 'Choose a pattern for every empty scene…', disabled: !rs.length, action: () => fillTrack(t) },
    '-',
    {
      label: 'Its clips start from',
      sub: Array.from({ length: 16 }, (_, k) => ({
        label: 'clip ' + (k + 1),
        checked: scnStart(S.scn, t) === k,
        action: () => setStart(t, k)
      }))
    },
    '-',
    {
      label: 'Clear it in every scene',
      danger: true,
      disabled: has < 0,
      action: () => edit(q => q.rows.forEach(r => (r.cells[t] = null)))
    }
  ]);
}
/* one pattern into every scene where the track is empty */
function fillTrack(t) {
  pickPattern(t, 'every empty scene', pid => edit(q => q.rows.forEach(r => r.cells[t] || (r.cells[t] = { pat: pid }))));
}
/** A scene's menu at x, y. play(i, loop) plays from it. */
export function rowMenu(i, x, y, play) {
  const n = rows().length;
  showMenu(x, y, [
    { label: 'Play from this scene', action: () => play(i, false) },
    { label: 'Loop this scene', action: () => play(i, true) },
    '-',
    { label: 'Add a scene before it', action: () => addRow(i - 1) },
    { label: 'Add a scene after it', action: () => addRow(i) },
    { label: 'Copy it below', action: () => addRow(i, true) },
    { label: 'Move up', disabled: i === 0, action: () => moveRow(i, -1) },
    { label: 'Move down', disabled: i === n - 1, action: () => moveRow(i, 1) },
    '-',
    { label: 'Remove the scene', danger: true, action: () => removeRow(i) }
  ]);
}

/* keys while working in the docked pattern editor: delete or clear the selected notes, select all */
function editorKey(e, mod, k) {
  const p = curPat();
  if (!p) return false;
  if ((e.key === 'Delete' || e.key === 'Backspace') && ED.selNotes.size) {
    e.preventDefault();
    pushUndo();
    p.notes = p.notes.filter(n => !ED.selNotes.has(n));
    ED.selNotes.clear();
    touch(p);
    drawEditor();
    return true;
  }
  if (e.key === 'Escape' && ED.selNotes.size) return (ED.selNotes.clear(), drawEditor(), true);
  if (mod && k === 'a') {
    e.preventDefault();
    p.notes.forEach(n => ED.selNotes.add(n));
    drawEditor();
    return true;
  }
  return false;
}
/** Scene Mode's keys. Returns true when it used the key. togglePlay plays or stops. */
export function sceneKey(e, togglePlay) {
  const mod = e.ctrlKey || e.metaKey,
    n = rows().length,
    k = e.key.toLowerCase();
  if (e.code === 'Space') return (e.preventDefault(), togglePlay(), true);
  if (mod && (k === 'z' || k === 'y')) {
    e.preventDefault();
    (k === 'y' || e.shiftKey ? redo : undo)();
    SC.draw();
    return true;
  }
  if (SC.inDock) return editorKey(e, mod, k);
  if (!n) return false;
  const c = rows()[SC.row] && rows()[SC.row].cells[SC.t];
  if (mod && k === 'c' && c) return ((SC.copy = { ...c }), toast('Copied'), true);
  if (mod && k === 'v' && SC.copy) return (paste(SC.row, SC.t), true);
  if (e.key === 'Delete' || e.key === 'Backspace') return (clearCell(SC.row, SC.t), true);
  if (e.key === 'Enter') return (choosePattern(SC.row, SC.t), true);
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!mv) return false;
  e.preventDefault();
  SC.row = Math.max(0, Math.min(n - 1, SC.row + mv[0]));
  SC.t = Math.max(0, Math.min(7, SC.t + mv[1]));
  SC.draw();
  return true;
}
