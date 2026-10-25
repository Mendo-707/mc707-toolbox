// Scene Mode's clip editor, under the board: Notes is Song Mode's own pattern editor (steps, piano roll,
// velocity, length and its tools), Sound the ZenCore editor with its Sound browser (sound-tab.js), both
// for the selected clip. Above it, the clip's own controls: which clip, the clip before or after, the
// pattern, tone and transpose, the scenes that play it, an own copy of a pattern other clips share,
// write it, expand (the editor takes the board's room, keeping the track's row) and close.
//
// Reads: S, SC, UI.
import { el } from '../core/dom.js';
import { S, UI, addPattern } from '../core/state.js';
import { TRACK_COLORS, devNum } from '../core/device.js';
import { clipState } from '../core/scene-model.js';
import { openView } from '../song/lib-view.js';
import { renderEditor } from '../song/editor.js';
import { SC, clipAt, edit, rows, setTranspose, toneOf } from './model.js';
import { choosePattern, chooseTone } from './menus.js';
import { sceneLabel } from './names.js';
import { closeSound, soundHost, soundNote } from './sound-tab.js';
import { writeOneClip } from './write.js';
import { MARK, MARK_TIP } from './board.js';
import { pumpOpen } from './pump.js';

let EDITOR = null,
  shown = '';
const editorEl = () => EDITOR || (EDITOR = document.getElementById('editor'));

/** Edit clip k of track t (an empty one asks for its pattern first). tab: 'notes' or 'sound'. */
export function editClip(t, k, tab) {
  SC.t = t;
  SC.k = k;
  if (tab) SC.tab = tab;
  if (!clipAt(t, k)) return choosePattern(t, k, () => editClip(t, k));
  SC.edit = true;
  SC.draw();
}
function setTab(v) {
  if (v === 'notes') closeSound();
  SC.tab = v;
  SC.draw();
}
/** Close the editor (the board gets the room back). */
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
/* how many other clips, and Song Mode clips, use pattern pid */
const uses = (pid, t, k) => [
  S.scn.clips.reduce((n, l, tt) => n + l.filter((c, kk) => c && c.pat === pid && !(tt === t && kk === k)).length, 0),
  S.clips.filter(c => c.pat === pid).length
];
const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

/** Give clip k of track t its own copy of its pattern, so editing it changes nothing else. */
export function ownCopy(t, k) {
  const c = clipAt(t, k),
    p = S.patterns[c.pat];
  edit(q => {
    const id = addPattern(p.type, p.name.slice(0, 32) + ' (' + (k + 1) + ')', p.bars, p.notes, {
      key: p.key ? { ...p.key } : null,
      role: p.role || '',
      genre: p.genre || ''
    });
    q.clips[t][k] = { ...c, pat: id };
  });
}

function head(t, k, c) {
  const b = (label, fn, title, cls = '') =>
    el('button', { type: 'button', class: 'btn sm ' + cls, title: title || label, onclick: fn }, label);
  const tn = toneOf(c),
    tr = c.tr || 0,
    [others, songClips] = uses(c.pat, t, k),
    st = clipState(S.scn, S.patterns, t, k),
    scenes = rows()
      .map((r, i) => (r.pick[t] === k ? sceneLabel(i) : ''))
      .filter(Boolean),
    prev = [...Array(k).keys()].reverse().find(j => clipAt(t, j)),
    next = Array.from({ length: 15 - k }, (_, j) => k + 1 + j).find(j => clipAt(t, j));
  return el(
    'div',
    { class: 'scnDockHead' },
    el(
      'span',
      { class: 'chip', style: '--c:' + TRACK_COLORS[t] },
      devNum(t) + ' ' + S.tracks[t].name + ' · clip ' + (k + 1)
    ),
    el(
      'span',
      { class: 'grp scnTabs', role: 'tablist' },
      ...[
        ['notes', 'Notes', 'The pattern editor'],
        ['sound', 'Sound', 'The ZenCore editor and Sound browser, for this MC-707 clip']
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
    b('◀', () => editClip(t, prev), 'The track’s clip before', prev == null ? 'off' : ''),
    b('▶', () => editClip(t, next), 'The track’s clip after', next == null ? 'off' : ''),
    b('Pattern…', () => choosePattern(t, k), 'Choose another pattern for this clip'),
    S.tracks[t].type === 'drum'
      ? null
      : b(tn ? '♪ ' + tn.name : '♪ Clip’s own sound', () => chooseTone(t, k), 'The tone this clip gets on the MC-707'),
    b(
      c.pump ? '∿ Pump: ' + (c.pump.mode === 'level' ? 'Volume' : 'Filter') : '∿ Pump',
      () => pumpOpen(t, k),
      'Duck this part on every kick (sidechain pump), written into the clip so the MC-707 pumps by itself',
      c.pump ? 'on' : ''
    ),
    S.tracks[t].type === 'tone'
      ? el(
          'span',
          { class: 'grp scnTr', title: 'Transpose this clip (semitones)' },
          b('−', () => setTranspose(t, k, tr - 1), 'Down a semitone'),
          el('span', {}, (tr > 0 ? '+' : '') + tr),
          b('+', () => setTranspose(t, k, tr + 1), 'Up a semitone')
        )
      : null,
    el(
      'span',
      { class: 'hint' },
      scenes.length ? 'In scene' + (scenes.length === 1 ? ' ' : 's ') + scenes.join(', ') : 'In no scene yet'
    ),
    SC.tab === 'sound' ? el('span', { class: 'hint' }, soundNote(t, k)) : null,
    (others || songClips) && SC.tab === 'notes'
      ? el(
          'span',
          { class: 'scnShared hint' },
          'Pattern shared with ' +
            [others ? plural(others, 'other clip') : '', songClips ? plural(songClips, 'Song Mode clip') : '']
              .filter(Boolean)
              .join(' and ') +
            ' ',
          b('Make it this clip’s own', () => ownCopy(t, k), 'Copy the pattern, so changes here change only this clip')
        )
      : null,
    el(
      'span',
      { class: 'grp', style: 'margin-left:auto' },
      el('span', { class: 'scMark ' + st, title: MARK_TIP[st] }, MARK[st]),
      b(
        'Write clip',
        () => writeOneClip(t, k),
        'Write this clip (notes, and its tone) to the MC-707',
        st === 'written' ? '' : 'on'
      ),
      b(
        SC.big ? '⤡ Collapse' : '⤢ Expand',
        () => ((SC.big = !SC.big), SC.draw()),
        SC.big ? 'Show the whole board again' : 'Give the editor the board’s room'
      ),
      b('✕ Close', closeEdit, 'Close the editor')
    )
  );
}

/**
 * The editor for the selected clip, or null when it is closed.
 * @param {() => void} changed  runs after edits in the editor, to redraw the board
 */
export function dock(changed) {
  const t = SC.t,
    k = SC.k,
    c = clipAt(t, k),
    p = c && S.patterns[c.pat];
  if (!SC.edit || !p) {
    if (SC.edit) SC.edit = SC.big = false;
    undock(true);
    return null;
  }
  /* the editor draws into the page, so it has to be in it while the pattern opens */
  if (!editorEl().isConnected) document.getElementById('work').append(editorEl());
  if (SC.tab === 'sound') {
    const h = soundHost(t, k);
    if (h) return el('div', { class: 'scnDock', style: '--tc:' + TRACK_COLORS[t] }, head(t, k, c), h);
    SC.tab = 'notes';
  } else closeSound(true);
  const key = t + ':' + k + ':' + c.pat;
  if (key !== shown || !UI.view || !UI.view.scene) {
    UI.sel = null;
    UI.view = null;
    openView({ kind: 'proj', id: c.pat }, t);
    UI.view.scene = true;
    shown = key;
  }
  let tm = 0;
  const later = () => (clearTimeout(tm), (tm = setTimeout(changed, 150)));
  const box = el(
    'div',
    { class: 'scnDock', style: '--tc:' + TRACK_COLORS[t], onchange: later, onpointerup: later },
    head(t, k, c),
    editorEl()
  );
  requestAnimationFrame(renderEditor);
  return box;
}
