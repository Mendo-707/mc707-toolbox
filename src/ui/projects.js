import { $, toast } from '../core/dom.js';
import { HOST, PROJ, S, UI, fixState, newState, pushUndo, replaceState } from '../core/state.js';
import { panic } from '../services/midi.js';
import { stopAll } from '../services/transport.js';
import { afterReplaceKeepUndo } from './controls.js';
import { saveFile } from '../song/export.js';
import { askDlg } from './dialogs.js';

/* ---------- projects, folders and exit ---------- */
export function projTitle() {
  const n = PROJ.name || 'Untitled';
  document.title = n + (PROJ.dirty ? ' •' : '') + ' – MC-707 Toolbox';
  const m = $('#mProj');
  if (m) {
    m.textContent = n + (PROJ.dirty ? ' •' : '');
    m.title = PROJ.path || (HOST ? 'Not saved to a file yet' : 'Saved copies go to your Downloads folder');
  }
}
const RECK = 'mc707-recent';
export function projRecents() {
  try {
    return (JSON.parse(localStorage.getItem(RECK) || '[]') || []).filter(r => r && r.path).slice(0, 8);
  } catch (e) {
    return [];
  }
}
function projRecent(path) {
  const name = path
    .split(/[\\/]/)
    .pop()
    .replace(/\.(json|mc707)$/i, '');
  const l = [{ name, path }, ...projRecents().filter(r => r.path !== path)].slice(0, 8);
  try {
    localStorage.setItem(RECK, JSON.stringify(l));
  } catch (e) {}
}
export function projLoadText(text, name, path) {
  let s;
  try {
    s = JSON.parse(text);
    if (!s || s.v !== 1 || !Array.isArray(s.tracks) || s.tracks.length !== 8 || !s.patterns || !Array.isArray(s.clips))
      throw 0;
  } catch (e) {
    toast('That file is not a Toolbox project');
    return false;
  }
  stopAll();
  pushUndo();
  const m = S.midiOut;
  replaceState(fixState(s));
  if (!S.midiOut) S.midiOut = m;
  UI.sel = null;
  afterReplaceKeepUndo();
  PROJ.name = (name || '').replace(/\.(json|mc707)$/i, '');
  PROJ.path = path || '';
  PROJ.dirty = false;
  if (path) projRecent(path);
  projTitle();
  toast('Opened ' + (PROJ.name || 'project'));
  return true;
}
const projText = () => JSON.stringify(S, null, 1);
const projSafe = n => (n || '').replace(/[\\/:*?"<>|]+/g, '-').trim() || 'mc707-project';
async function projConfirmLoss() {
  if (!PROJ.dirty) return true;
  return askDlg({
    title: 'Discard unsaved changes?',
    text: 'The song has changes that are not saved to a file. They are still in this browser’s autosave, but opening something else replaces them.',
    ok: 'Continue'
  });
}
export async function projNew() {
  if (!(await projConfirmLoss())) return;
  stopAll();
  pushUndo();
  const m = S.midiOut;
  replaceState(newState());
  S.midiOut = m;
  UI.sel = null;
  afterReplaceKeepUndo();
  PROJ.name = '';
  PROJ.path = '';
  PROJ.dirty = false;
  projTitle();
  toast('New empty project');
}
export async function projOpen() {
  if (!(await projConfirmLoss())) return;
  if (HOST) {
    try {
      const r = await HOST.openDialog();
      if (r && r.text != null) projLoadText(r.text, r.name, r.path);
    } catch (e) {
      toast('Could not open the file');
    }
  } else $('#fileIn').click();
}
export async function projOpenPath(path) {
  if (!HOST) return;
  if (!(await projConfirmLoss())) return;
  try {
    const r = await HOST.readFile(path);
    projLoadText(r.text, r.name, path);
  } catch (e) {
    toast('Could not open ' + path.split(/[\\/]/).pop());
  }
}
export async function projSave() {
  if (!PROJ.path && HOST) return projSaveAs();
  if (HOST) {
    try {
      await HOST.writeFile(PROJ.path, projText());
      PROJ.dirty = false;
      projTitle();
      toast('Saved ' + PROJ.name);
    } catch (e) {
      toast('Could not save the file');
    }
    return;
  }
  if (!PROJ.name) return projSaveAs();
  await saveFile(projSafe(PROJ.name) + '.json', projText());
  PROJ.dirty = false;
  projTitle();
}
export async function projSaveAs() {
  if (HOST) {
    try {
      const r = await HOST.saveDialog(projSafe(PROJ.name) + '.json');
      if (!r) return;
      await HOST.writeFile(r, projText());
      PROJ.path = r;
      PROJ.name = r
        .split(/[\\/]/)
        .pop()
        .replace(/\.(json|mc707)$/i, '');
      PROJ.dirty = false;
      projRecent(r);
      projTitle();
      toast('Saved ' + PROJ.name);
    } catch (e) {
      toast('Could not save the file');
    }
    return;
  }
  const n = await askDlg({
    title: 'Save project as',
    text: 'The file is saved to your Downloads folder.',
    input: true,
    def: PROJ.name || 'My song',
    ok: 'Save'
  });
  if (!n) return;
  PROJ.name = projSafe(n);
  await saveFile(PROJ.name + '.json', projText());
  PROJ.dirty = false;
  projTitle();
}
export async function projFolder(kind) {
  if (!HOST) {
    toast('Folders can be opened in the Windows app. In the browser, files go to your Downloads folder.');
    return;
  }
  try {
    const p = await HOST.openFolder(kind);
    if (p) toast('Opened ' + p);
  } catch (e) {
    toast('Could not open the folder');
  }
}
export async function projChooseFolder(kind) {
  if (!HOST) {
    toast('Folder choice is available in the Windows app.');
    return;
  }
  try {
    const p = await HOST.chooseFolder(kind);
    if (p) toast((kind === 'projects' ? 'Project' : 'Recording') + ' folder: ' + p);
  } catch (e) {
    toast('Could not set the folder');
  }
}
export function exitApp() {
  try {
    stopAll();
    panic(true);
  } catch (e) {}
  toast('Stopping all notes…');
  setTimeout(() => {
    if (HOST) HOST.quit();
    else {
      window.close();
      toast('All notes stopped. You can close this tab.');
    }
  }, 450);
}
