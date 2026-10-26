// Scene Mode: arrange a song the way the MC-707 keeps one. The clips board holds each track's 16 clips
// (pattern and tone); the scene chain down the left lists the scenes in the order the MC-707's scene
// chain plays them, each choosing a clip per track and lasting so many bars. The editor for the selected
// clip (notes or sound) sits under the board. Every clip and scene shows whether it is written to the
// MC-707; the toolbar walks through the four steps (clips, scenes, write, on the MC-707).
//
// Reads: S, SC, TR, DEV.
import { $, el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV } from '../core/device.js';
import { TR, sceneRowAt, startScenes, stopAll } from '../services/transport.js';
import { showMenu } from '../ui/menu.js';
import { SC, addRow, clipAt, rows } from './model.js';
import { chipMenu, choosePattern, clipMenu, sceneKey, sceneMenu, trackMenu } from './menus.js';
import { sceneLabel } from './names.js';
import { scenesFromSong, scenesToSong } from './convert.js';
import { sceneTop } from './top.js';
import { sceneGuideOpen } from './guide.js';
import { board } from './board.js';
import { chain } from './chain.js';
import { dock, editClip, undock } from './dock.js';
import { autoWrite, clipPattern, writeOneScene, writeTrack } from './write.js';

const tracks = () => DEVS[DEV].tracks;
let raf = 0;

/** Enter or leave Scene Mode (called by the mode switch). */
export function sceneEnter(on) {
  if (!on) {
    cancelAnimationFrame(raf);
    removeEventListener('pointerdown', where, true);
    undock();
    return;
  }
  SC.draw = sceneRender;
  SC.changed = autoWrite;
  addEventListener('pointerdown', where, true);
  sceneRender();
}
/* keys go to the docked editor after a click in it, to the board after a click anywhere else */
const where = e => (SC.inDock = !!(e.target.closest && e.target.closest('.scnDock')));

/** Play the chain from scene i (or only scene i, on a loop). */
export function scenePlay(i = SC.row, loop = false) {
  const rs = rows();
  if (!rs.length) return toast('Add a scene first');
  /* one pattern per clip, so a clip carrying on into the next scene keeps its place */
  const pats = new Map();
  const patOf = (t, k) => {
    const key = t + ':' + k;
    if (!pats.has(key)) pats.set(key, clipPattern(clipAt(t, k)));
    return pats.get(key);
  };
  const list = rs.map(r => ({
    bars: r.bars,
    parts: tracks()
      .filter(t => r.pick[t] >= 0 && clipAt(t, r.pick[t]))
      .map(t => ({ t, p: patOf(t, r.pick[t]) }))
  }));
  startScenes(list, Math.min(i, rs.length - 1), loop);
  watch();
}
export function sceneToggle() {
  /* a pattern playing from a picker or the clip editor stops, and the scenes start */
  if (TR.playing && TR.mode === 'scenes') stopAll();
  else scenePlay(SC.row);
  drawPlay();
}
/** Scene Mode's keys (from the app's key handler). */
export const sceneKeyDown = e => sceneKey(e, sceneToggle, (t, k) => editClip(t, k));

/* the playing scene and its clips lit, with how far through it is */
function watch() {
  cancelAnimationFrame(raf);
  const step = () => {
    const on = TR.playing && TR.mode === 'scenes',
      i = on ? sceneRowAt(TR.tick) : -1,
      r = rows()[i];
    document.querySelectorAll('#scene .scRowC').forEach((x, j) => {
      x.classList.toggle('playing', j === i);
      const bar = x.querySelector('.scProg i');
      if (bar)
        bar.style.width =
          j === i ? Math.min(100, ((TR.tick - TR.scn.starts[i]) / (rows()[i].bars * 32)) * 100) + '%' : '0';
    });
    document
      .querySelectorAll('#scene .sbClip')
      .forEach(b => b.classList.toggle('playing', !!r && r.pick[+b.dataset.t] === +b.dataset.k));
    const pos = $('#scnPos');
    if (pos)
      pos.textContent = r
        ? 'Scene ' + sceneLabel(i) + ' · bar ' + (Math.floor((TR.tick - TR.scn.starts[i]) / 32) + 1)
        : 'Stopped';
    drawPlay();
    if (on) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
function drawPlay() {
  const b = $('#scnPlay');
  if (!b) return;
  const on = TR.playing && TR.mode === 'scenes';
  b.classList.toggle('on', on);
  b.textContent = on ? '■ Stop' : '▶ Play';
}

const ACT = {
  pick: (t, k) => ((SC.t = t), (SC.k = k), choosePattern(t, k, () => editClip(t, k))),
  edit: (t, k) => editClip(t, k),
  menu: (t, k, x, y) => ((SC.t = t), (SC.k = k), clipMenu(t, k, x, y, editClip)),
  trackMenu,
  writeTrack: t => writeTrack(t)
};
const CHAIN = {
  select: i => ((SC.row = i), SC.draw()),
  play: i => scenePlay(i),
  chip: (i, t, x, y) => ((SC.row = i), chipMenu(i, t, x, y)),
  menu: (i, x, y) => ((SC.row = i), sceneMenu(i, x, y, scenePlay)),
  write: i => writeOneScene(i),
  add: () => addRow(rows().length ? rows().length - 1 : null) || toast('The MC-707 holds 128 scenes'),
  more: (x, y) =>
    showMenu(x, y, [
      { label: 'Make scenes and clips from the song…', action: scenesFromSong },
      { label: 'Lay the scenes out in Song Mode…', action: scenesToSong },
      '-',
      { label: 'How it plays on the MC-707…', action: sceneGuideOpen }
    ])
};

function empty() {
  return el(
    'div',
    { class: 'scnEmpty' },
    el('h2', {}, 'Arrange your song as MC-707 scenes'),
    el(
      'p',
      { class: 'hint' },
      'Fill the MC-707’s clips (a pattern and a sound for each), chain scenes that choose a clip per track for so many bars, then write them: the MC-707 plays the song by itself, with no computer.'
    ),
    el(
      'div',
      { class: 'grp' },
      el('button', { type: 'button', class: 'btn on', onclick: () => addRow(null) }, '+ Start with an empty scene'),
      el('button', { type: 'button', class: 'btn', onclick: scenesFromSong }, 'Make them from the song'),
      el('button', { type: 'button', class: 'btn', onclick: sceneGuideOpen }, '? How it works')
    )
  );
}

/** Draw Scene Mode. */
export function sceneRender() {
  const host = $('#scene');
  if (!host) return;
  const keep = sel => (host.querySelector(sel) ? host.querySelector(sel).scrollTop : 0),
    sc = [keep('.scList'), keep('.sBoardWrap')];
  host.textContent = '';
  host.append(sceneTop(sceneToggle));
  if (DEV !== '707')
    host.append(
      el(
        'p',
        { class: 'scnNote' },
        'Scenes are mapped on the MC-707 so far: on the MC-101, Scene Mode plays here but cannot write.'
      )
    );
  if (!S.scn) {
    SC.edit = SC.big = false;
    undock(true);
    host.append(empty());
    return;
  }
  const wrap = el('div', { class: 'sBoardWrap' });
  const drawBoard = () => ((wrap.textContent = ''), wrap.append(board(ACT, d && SC.big ? SC.t : null)));
  const d = dock(drawBoard);
  drawBoard();
  const main = el('div', { class: 'sMain' + (d ? ' editing' : '') + (d && SC.big ? ' wide' : '') }, wrap, d);
  const hint = el(
    'p',
    { class: 'hint scnFoot' },
    'Click an empty clip to choose its pattern, a full one to edit its notes and sound; right-click a clip, a track, a scene or a chip for more. Arrows move on the board, Page Up and Page Down between scenes, Enter edits, Delete clears, Space plays. ✓ written · ● changed · + not written yet.'
  );
  host.append(el('div', { class: 'sBody' }, chain(CHAIN), el('div', { class: 'sRight' }, main, d ? null : hint)));
  const l = host.querySelector('.scList');
  if (l) l.scrollTop = sc[0];
  wrap.scrollTop = sc[1];
  if (TR.playing && TR.mode === 'scenes') watch();
  drawPlay();
}
