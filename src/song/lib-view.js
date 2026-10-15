// A library pattern open in the pattern editor without placing it: click a pattern in the library
// to see and edit it, then place it at the playhead. Also saves patterns to My patterns.
//
// Owns: UI.view (opened and closed here; core/song-model.js keeps the edited copy on the first edit).
// Reads: S, UI, ED.
import { $$, toast } from '../core/dom.js';
import { ED, S, UI, addPattern, pushUndo, scheduleSave } from '../core/state.js';
import { instFactory, metaOf } from '../library/index.js';
import { userSave } from '../library/user-lib.js';
import { patOf, placeClip } from '../core/song-model.js';
import { askDlg } from '../ui/dialogs.js';
import { defaultLo, renderEditor } from './editor.js';
import { renderArr, selectClip } from './arrangement.js';
import { renderLibrary } from './library-panel.js';
import { REC } from '../services/transport.js';
import { hooks } from '../core/hooks.js';

export const VIEW_ID = '__view';
const copyOf = m => ({
  id: null,
  name: m.name,
  type: m.type,
  bars: m.bars,
  notes: m.notes.map(n => ({ s: n.s, l: n.l, n: n.n, v: n.v })),
  key: m.key ? { ...m.key } : null,
  role: m.role || '',
  genre: m.genre || '',
  src: m.id,
  mod: false
});
/**
 * Show a library pattern in the editor. Project patterns are edited in place (every clip that uses
 * them changes); factory and My patterns are edited as a copy that is kept in the song once you change it.
 * @param {{kind: 'fac'|'user'|'proj', id: string}} it
 * @param {number} t  the track it plays on in the editor (its sound and colour)
 */
export function openView(it, t) {
  const m = metaOf(it);
  if (!m) return;
  const v = UI.view;
  if (v && v.kind === it.kind && v.srcId === it.id && !UI.sel) return;
  if (REC.on) hooks.recStop();
  UI.sel = null;
  $$('.clip.sel').forEach(x => x.classList.remove('sel'));
  const orig = it.kind === 'proj' ? null : copyOf(m);
  UI.view = {
    id: VIEW_ID,
    view: true,
    kind: it.kind,
    srcId: it.id,
    t,
    start: 0,
    len: m.bars,
    off: 0,
    pat: it.kind === 'proj' ? it.id : null,
    orig,
    p: orig ? copyOf(orig) : null
  };
  ED.barSel = null;
  ED.selNotes.clear();
  ED.fit = true;
  ED.aud = null;
  if (ED.mode === 'shape') ED.mode = 'steps';
  if (m.type === 'tone') ED.lo = defaultLo(m, t);
  renderEditor();
}
/** Close the library pattern in the editor (an edited copy stays in the song's Project patterns). */
export function closeView() {
  if (!UI.view) return;
  UI.view = null;
  renderEditor();
  renderLibrary();
}
/** Where the pattern in the editor came from, for its banner. */
export function viewLabel(v) {
  if (v.kind === 'proj') return 'Project pattern (not placed here)';
  return (v.kind === 'user' ? 'My pattern' : 'Factory pattern') + ' (not in the song yet)';
}
/** Place the pattern in the editor at the playhead, on its track (or the first track of its type). */
export function placeView() {
  const v = UI.view;
  if (!v) return;
  const p = patOf(v);
  let t = v.t;
  if (!S.tracks[t] || S.tracks[t].type !== p.type) t = p.type === 'drum' ? 0 : 3;
  pushUndo();
  const src = !v.pat && metaOf({ kind: v.kind, id: v.srcId });
  const pid =
    v.pat ||
    (src
      ? instFactory(src)
      : addPattern(p.type, p.name, p.bars, p.notes, { key: p.key, role: p.role, genre: p.genre }));
  const c = placeClip(t, Math.max(0, Math.floor(S.cursor)), pid, p.bars);
  UI.view = null;
  selectClip(c.id);
  renderArr();
  renderLibrary();
  scheduleSave();
  toast('Placed on ' + S.tracks[t].name + ' at bar ' + (Math.floor(S.cursor) + 1));
}
/**
 * Save the pattern in the editor to My patterns. Asks for a name; when it came from My patterns,
 * `update` overwrites that one.
 */
export async function saveToMine(c, update) {
  const p = patOf(c);
  if (!p) return;
  const name = update
    ? p.name
    : await askDlg({
        title: 'Save to My patterns',
        text: 'My patterns are kept in this browser and show in the library in every song.',
        input: true,
        def: p.name,
        ok: 'Save'
      });
  if (!name) return;
  const id = userSave({ ...p, name }, update && c.view && c.kind === 'user' ? c.srcId : null);
  if (!id) {
    toast('Could not save: the browser storage is full');
    return;
  }
  toast(update ? 'Updated in My patterns' : 'Saved to My patterns');
  renderLibrary();
}
