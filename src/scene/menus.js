// Scene Mode's menus and the actions behind them: a clip's menu (edit, pattern, tone, transpose, play it,
// which scenes play it, write it, copy, paste, move, clear, its notes and sound on the MC-707), a scene's
// menu (play, loop, write, add, copy, move, remove), a scene's track chip (which clip it plays), a
// track's menu (write and check its clips), and the keys Scene Mode answers.
//
// Reads: S, SC.
// Calls up the layers through hooks (core/hooks.js).
import { toast } from '../core/dom.js';
import { ED, S, pushUndo, redo, undo } from '../core/state.js';
import { devNum } from '../core/device.js';
import { curPat, touch } from '../core/song-model.js';
import { clipState } from '../core/scene-model.js';
import { hooks } from '../core/hooks.js';
import { drawEditor } from '../song/editor.js';
import { showMenu } from '../ui/menu.js';
import { startPat } from '../services/transport.js';
import { clipNotesToMine } from '../zen/zc-seq.js';
import {
  SC,
  addRow,
  clearClip,
  clipAt,
  edit,
  freeClip,
  moveRow,
  pasteClip,
  removeRow,
  rows,
  setPattern,
  setPick,
  setTone,
  setTranspose,
  swapClips,
  toneOf
} from './model.js';
import { pickPattern } from './pick-pattern.js';
import { pickTone } from './pick-tone.js';
import { sceneLabel } from './names.js';
import { clipPattern, writeOneClip, writeOneScene, writeTrack } from './write.js';
import { checkTrack } from './check.js';

/**
 * Choose the pattern for clip k of track t. A new clip also goes into the selected scene when that scene
 * plays nothing on the track. after() runs once it is in.
 */
export function choosePattern(t, k, after) {
  const c = clipAt(t, k),
    r = rows()[SC.row];
  pickPattern(
    t,
    'clip ' + (k + 1),
    pid => {
      setPattern(t, k, pid, !c && r && r.pick[t] < 0 ? SC.row : null);
      if (after) after();
    },
    c && c.pat
  );
}
/** Choose the tone for clip k of track t (it needs a pattern first). */
export function chooseTone(t, k) {
  const c = clipAt(t, k);
  if (!c) return toast('Choose a pattern for this clip first');
  const tn = toneOf(c);
  pickTone(t, 'clip ' + (k + 1), tone => setTone(t, k, tone), tn && tn.name);
}
/** Play clip k of track t on its own, on a loop. */
export function playClip(t, k) {
  const c = clipAt(t, k);
  if (c) startPat(clipPattern(c), t);
}

/** A clip's menu at x, y. onEdit(t, k, tab) opens it in the editor. */
export function clipMenu(t, k, x, y, onEdit) {
  const c = clipAt(t, k),
    tr = (c && c.tr) || 0,
    tone = S.tracks[t].type === 'tone',
    r = rows()[SC.row],
    st = clipState(S.scn || { clips: [[]], done: { c: {} } }, S.patterns, t, k);
  const shift = d => ({ label: (d > 0 ? '+' : '') + d, action: () => setTranspose(t, k, tr + d) });
  const free = Array.from({ length: 16 }, (_, j) => j).filter(j => j !== k);
  showMenu(x, y, [
    c ? { label: 'Edit the notes', action: () => onEdit(t, k, 'notes') } : null,
    c ? { label: 'Edit the sound (ZenCore)', action: () => onEdit(t, k, 'sound') } : null,
    { label: c ? 'Change pattern…' : 'Choose a pattern…', action: () => choosePattern(t, k) },
    c ? { label: toneOf(c) ? 'Change tone…' : 'Choose a tone…', action: () => chooseTone(t, k) } : null,
    c && toneOf(c) ? { label: 'Keep the MC-707 clip’s own sound', action: () => setTone(t, k, null) } : null,
    c && tone
      ? {
          label: 'Transpose' + (tr ? ' (' + (tr > 0 ? '+' : '') + tr + ')' : ''),
          sub: [shift(1), shift(-1), shift(12), shift(-12), { label: 'None', action: () => setTranspose(t, k, 0) }]
        }
      : null,
    c ? { label: 'Play it on its own', action: () => playClip(t, k) } : null,
    '-',
    c && r
      ? r.pick[t] === k
        ? { label: 'Take it out of scene ' + sceneLabel(SC.row), action: () => setPick(SC.row, t, -1) }
        : { label: 'Play it in scene ' + sceneLabel(SC.row), action: () => setPick(SC.row, t, k) }
      : null,
    c
      ? { label: 'Write it to the MC-707' + (st === 'written' ? ' again' : ''), action: () => writeOneClip(t, k) }
      : null,
    '-',
    c ? { label: 'Copy', hint: 'Ctrl+C', action: () => (SC.copy = { ...c }) } : null,
    SC.copy ? { label: 'Paste', hint: 'Ctrl+V', action: () => paste(t, k) } : null,
    c
      ? {
          label: 'Move or swap with',
          sub: free.map(j => ({
            label: 'clip ' + (j + 1) + (clipAt(t, j) ? ' (swap)' : ''),
            action: () => swapClips(t, k, j)
          }))
        }
      : null,
    c ? { label: 'Clear', hint: 'Del', danger: true, action: () => clearClip(t, k) } : null,
    '-',
    { label: 'On the MC-707: read its notes into My patterns', action: () => clipNotesToMine(t, k) },
    { label: 'On the MC-707: open its sound in the ZenCore editor', action: () => hooks.zenOpen(t, k) }
  ]);
}
function paste(t, k) {
  if (!pasteClip(t, k, SC.copy)) toast('That clip is for the other kind of track (drums and tones don’t mix)');
}
/** A scene's track chip: which of the track's clips the scene plays. */
export function chipMenu(i, t, x, y) {
  const q = S.scn,
    have = Array.from({ length: 16 }, (_, k) => k).filter(k => q.clips[t][k]);
  showMenu(x, y, [
    ...have.map(k => ({
      label: 'Clip ' + (k + 1) + ': ' + S.patterns[q.clips[t][k].pat].name,
      checked: q.rows[i].pick[t] === k,
      action: () => setPick(i, t, k)
    })),
    have.length ? '-' : null,
    {
      label: 'A new clip…',
      disabled: freeClip(t) < 0,
      action: () => {
        const k = freeClip(t);
        pickPattern(t, 'clip ' + (k + 1), pid => setPattern(t, k, pid, i));
      }
    },
    { label: 'Nothing on track ' + devNum(t), checked: q.rows[i].pick[t] < 0, action: () => setPick(i, t, -1) }
  ]);
}
/** A scene's menu at x, y. play(i, loop) plays from it. */
export function sceneMenu(i, x, y, play) {
  const n = rows().length;
  showMenu(x, y, [
    { label: 'Play from this scene', action: () => play(i, false) },
    { label: 'Loop this scene', action: () => play(i, true) },
    { label: 'Write it to the MC-707', action: () => writeOneScene(i) },
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
/** A track's menu (its name on the board). */
export function trackMenu(t, x, y) {
  showMenu(x, y, [
    { label: 'Write its new and changed clips', action: () => writeTrack(t) },
    { label: 'Write all its clips', action: () => writeTrack(t, true) },
    { label: 'Check its 16 clips on the MC-707 (read-only)', action: () => checkTrack(t) },
    '-',
    { label: 'Take it out of every scene', action: () => edit(q => q.rows.forEach(r => (r.pick[t] = -1))) }
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
/**
 * Scene Mode's keys. Returns true when it used the key. togglePlay plays or stops; open(t, k) opens or
 * fills the selected clip.
 */
export function sceneKey(e, togglePlay, open) {
  const mod = e.ctrlKey || e.metaKey,
    k = e.key.toLowerCase();
  if (e.code === 'Space') return (e.preventDefault(), togglePlay(), true);
  if (mod && (k === 'z' || k === 'y')) {
    e.preventDefault();
    (k === 'y' || e.shiftKey ? redo : undo)();
    SC.draw();
    return true;
  }
  if (SC.inDock) return editorKey(e, mod, k);
  if (!S.scn) return false;
  const c = clipAt(SC.t, SC.k);
  if (mod && k === 'c' && c) return ((SC.copy = { ...c }), toast('Copied clip ' + (SC.k + 1)), true);
  if (mod && k === 'v' && SC.copy) return (paste(SC.t, SC.k), true);
  if (e.key === 'Delete' || e.key === 'Backspace') return (clearClip(SC.t, SC.k), true);
  if (e.key === 'Enter') return (open(SC.t, SC.k), true);
  if (e.key === 'PageUp' || e.key === 'PageDown') {
    e.preventDefault();
    SC.row = Math.max(0, Math.min(rows().length - 1, SC.row + (e.key === 'PageUp' ? -1 : 1)));
    SC.draw();
    return true;
  }
  const mv = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
  if (!mv) return false;
  e.preventDefault();
  SC.t = Math.max(0, Math.min(7, SC.t + mv[0]));
  SC.k = Math.max(0, Math.min(15, SC.k + mv[1]));
  SC.draw();
  return true;
}
