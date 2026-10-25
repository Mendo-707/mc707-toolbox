// Scene Mode's track editor: Song Mode's own pattern editor (steps, piano roll, velocity, length and its
// tools), docked under the scenes for the cell being edited, or expanded to fill the screen beside that
// track's column of scenes. Above it, the cell's own controls: the scene and track, the pattern and tone,
// transpose, the scene above or below, an own copy of a pattern other cells or clips share, expand and
// close. The editor changes the song's pattern itself, so every cell that uses it changes.
//
// Reads: S, SC, UI.
import { el } from '../core/dom.js';
import { S, UI, addPattern } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { openView } from '../song/lib-view.js';
import { renderEditor } from '../song/editor.js';
import { SC, edit, rows, setTranspose, toneOf } from './model.js';
import { choosePattern, chooseTone } from './menus.js';
import { sceneLabel } from './names.js';
import { closeSound, soundHost, soundNote } from './sound-tab.js';

let EDITOR = null,
  shown = '';
const editorEl = () => EDITOR || (EDITOR = document.getElementById('editor'));

/** Edit cell (i, t) in the docked editor (an empty cell asks for its pattern first). */
export function editCell(i, t) {
  SC.row = i;
  SC.t = t;
  const c = rows()[i] && rows()[i].cells[t];
  if (!c) return choosePattern(i, t, () => editCell(i, t));
  SC.edit = true;
  SC.draw();
}
/** Notes (the pattern editor) or Sound (the ZenCore editor). */
function setTab(v) {
  if (v === 'notes') closeSound();
  SC.tab = v;
  SC.draw();
}
/** Close the editor (the grid gets the room back). */
export function closeEdit() {
  closeSound();
  SC.edit = false;
  SC.big = false;
  undock();
  SC.draw();
}
/** Put the editor back in Song Mode and let go of the pattern (later: while Scene Mode draws). */
export function undock(later = false) {
  closeSound(later);
  const ed = editorEl(),
    work = document.getElementById('work');
  if (ed && work && ed.parentNode !== work) work.append(ed);
  if (UI.view && UI.view.scene) {
    UI.view = null;
    renderEditor();
  }
  shown = '';
}
/* how many cells, and how many Song Mode clips, play pattern pid */
const uses = pid => [
  rows().reduce((n, r) => n + r.cells.filter(c => c && c.pat === pid).length, 0),
  S.clips.filter(c => c.pat === pid).length
];
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/** Give cell (i, t) its own copy of its pattern, so editing it changes nothing else. */
export function ownCopy(i, t) {
  const c = rows()[i].cells[t],
    p = S.patterns[c.pat];
  edit(() => {
    const id = addPattern(p.type, p.name.slice(0, 34) + ' ' + sceneLabel(i), p.bars, p.notes, {
      key: p.key ? { ...p.key } : null,
      role: p.role || '',
      genre: p.genre || ''
    });
    S.scn.rows[i].cells[t] = { ...c, pat: id };
  });
}

function head(i, t, c, p) {
  const b = (label, fn, title, cls = '') =>
    el('button', { type: 'button', class: 'btn sm ' + cls, title: title || label, onclick: fn }, label);
  const tn = toneOf(c),
    tr = c.tr || 0,
    [cells, clips] = uses(c.pat),
    others = cells - 1 + clips,
    n = rows().length;
  return el(
    'div',
    { class: 'scnDockHead' },
    el(
      'span',
      { class: 'chip', style: '--c:' + TRACK_COLORS[t] },
      'Scene ' + sceneLabel(i) + ' · ' + devNum(t) + ' ' + S.tracks[t].name
    ),
    el(
      'span',
      { class: 'grp scnTabs', role: 'tablist' },
      ...[
        ['notes', 'Notes', 'The pattern editor'],
        ['sound', 'Sound', 'The ZenCore editor and Sound browser, for this cell’s MC-707 clip']
      ].map(([v, l, title]) =>
        el(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: 'btn sm' + (SC.tab === v ? ' on' : ''),
            'aria-selected': String(SC.tab === v),
            title,
            onclick: () => setTab(v)
          },
          l
        )
      )
    ),
    b('▲', () => editCell(i - 1, t), 'The scene above, same track', i ? '' : 'off'),
    b('▼', () => editCell(i + 1, t), 'The scene below, same track', i < n - 1 ? '' : 'off'),
    b('Pattern…', () => choosePattern(i, t), 'Choose another pattern for this cell'),
    b(tn ? '♪ ' + tn.name : '♪ Clip’s own sound', () => chooseTone(i, t), 'The tone this clip gets on the MC-707'),
    S.tracks[t].type === 'tone'
      ? el(
          'span',
          { class: 'grp scnTr', title: 'Transpose this cell (semitones)' },
          b('−', () => setTranspose(i, t, tr - 1), 'Down a semitone'),
          el('span', {}, (tr > 0 ? '+' : '') + tr),
          b('+', () => setTranspose(i, t, tr + 1), 'Up a semitone')
        )
      : null,
    SC.tab === 'sound' ? el('span', { class: 'hint' }, soundNote(i, t)) : null,
    others > 0 && SC.tab === 'notes'
      ? el(
          'span',
          { class: 'scnShared hint' },
          'Shared with ' +
            [cells > 1 ? plural(cells - 1, 'other cell') : '', clips ? plural(clips, 'Song Mode clip') : '']
              .filter(Boolean)
              .join(' and ') +
            ' ',
          b('Make it this cell’s own', () => ownCopy(i, t), 'Copy the pattern, so changes here change only this cell')
        )
      : null,
    el(
      'span',
      { class: 'grp', style: 'margin-left:auto' },
      b(
        SC.big ? '⤡ Collapse' : '⤢ Expand',
        () => ((SC.big = !SC.big), SC.draw()),
        SC.big ? 'Show every track again' : 'Give the editor the whole screen'
      ),
      b('✕ Close', closeEdit, 'Close the editor')
    )
  );
}

/**
 * The dock for the cell being edited, or null when there is none (the editor is closed then).
 * @param {() => void} changed  runs after edits in the editor, to redraw the cells
 */
export function dock(changed) {
  const i = SC.row,
    t = SC.t,
    c = rows()[i] && rows()[i].cells[t],
    p = c && S.patterns[c.pat];
  if (!SC.edit || !p) {
    if (SC.edit) SC.edit = SC.big = false;
    undock(true);
    return null;
  }
  /* the editor draws into the page, so it has to be in it while the pattern opens */
  if (!editorEl().isConnected) document.getElementById('work').append(editorEl());
  if (SC.tab === 'sound') {
    const h = soundHost(i, t);
    if (h) return el('div', { class: 'scnDock', style: '--tc:' + TRACK_COLORS[t] }, head(i, t, c, p), h);
    SC.tab = 'notes';
  } else closeSound(true);
  const key = i + ':' + t + ':' + c.pat;
  if (key !== shown || !UI.view || !UI.view.scene) {
    UI.sel = null;
    UI.view = null;
    openView({ kind: 'proj', id: c.pat }, t);
    UI.view.scene = true;
    shown = key;
  }
  let tm = 0;
  const later = () => (clearTimeout(tm), (tm = setTimeout(changed, 120)));
  const box = el(
    'div',
    { class: 'scnDock', style: '--tc:' + TRACK_COLORS[t], onchange: later, onpointerup: later },
    head(i, t, c, p),
    editorEl()
  );
  requestAnimationFrame(renderEditor);
  return box;
}

/** The expanded view's column: the track's cell in every scene, to move between them. */
export function trackColumn(t) {
  return el(
    'div',
    { class: 'scnCol', style: '--tc:' + TRACK_COLORS[t] },
    el(
      'div',
      { class: 'scnColTrks', role: 'group', 'aria-label': 'Track' },
      ...DEVS[DEV].tracks.map(x =>
        el(
          'button',
          {
            type: 'button',
            class: 'scnColTrk' + (x === t ? ' on' : ''),
            style: '--tc:' + TRACK_COLORS[x],
            title: devNum(x) + ' · ' + S.tracks[x].name,
            onclick: () => editCell(SC.row, x)
          },
          String(devNum(x))
        )
      )
    ),
    el(
      'div',
      { class: 'scnColHead' },
      el('b', {}, devNum(t) + ' · ' + S.tracks[t].name),
      el('span', { class: 'hint' }, 'every scene')
    ),
    ...rows().map((r, i) => {
      const c = r.cells[t],
        p = c && S.patterns[c.pat];
      return el(
        'button',
        {
          type: 'button',
          class: 'scnColCell' + (i === SC.row ? ' sel' : '') + (p ? '' : ' empty'),
          onclick: () => editCell(i, t)
        },
        el('span', { class: 'scnNo' }, sceneLabel(i)),
        el('span', {}, p ? p.name + (c.tr ? ' ' + (c.tr > 0 ? '+' : '') + c.tr : '') : '+ add')
      );
    })
  );
}
