// Scene Mode: arrange a song as MC-707 scenes. A grid like the MC-707's: the eight tracks across, the
// scenes down in the order the scene chain plays them. Each scene has a name and a length in bars; each
// cell a pattern (with a transpose) and the tone its MC-707 clip should have. Play runs the scenes in
// order through the MC-707 (and the preview sound); Send to MC-707 writes the clips, their tones and the
// scenes, chained (scene/send.js).
//
// Reads: S, SC, TR, DEV.
import { $, el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { sameCell, scnClips } from '../core/scene-model.js';
import { TR, sceneRowAt, startScenes, stopAll } from '../services/transport.js';
import { SC, addRow, rows, setBars, setName, toneOf } from './model.js';
import { cellMenu, choosePattern, rowMenu, sceneKey } from './menus.js';
import { sceneLabel } from './names.js';
import { scenesFromSong } from './convert.js';
import { sceneTop } from './top.js';
import { dock, editCell, trackColumn, undock } from './dock.js';

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
  addEventListener('pointerdown', where, true);
  sceneRender();
}
/* keys go to the docked editor after a click in it, to the grid after a click anywhere else */
const where = e => (SC.inDock = !!(e.target.closest && e.target.closest('.scnDock')));
/** Play from scene i (or only it, on a loop), or stop. */
export function scenePlay(i = SC.row, loop = false) {
  const rs = rows();
  if (!rs.length) return toast('Add a scene first');
  const list = rs.map(r => ({
    bars: r.bars,
    parts: tracks()
      .filter(t => r.cells[t] && S.patterns[r.cells[t].pat])
      .map(t => ({ t, p: S.patterns[r.cells[t].pat], tr: r.cells[t].tr || 0 }))
  }));
  startScenes(list, Math.min(i, rs.length - 1), loop);
  watch();
}
export function sceneToggle() {
  if (TR.playing) stopAll();
  else scenePlay(SC.row);
  drawTop();
}
/** Scene Mode's keys (from the app's key handler). */
export const sceneKeyDown = e => sceneKey(e, sceneToggle);

/* the playing scene lit, with how far through it is */
function watch() {
  cancelAnimationFrame(raf);
  const step = () => {
    const on = TR.playing && TR.mode === 'scenes',
      i = on ? sceneRowAt(TR.tick) : -1;
    document.querySelectorAll('#scene .scnRow').forEach((r, j) => {
      r.classList.toggle('playing', j === i);
      const bar = r.querySelector('.scnProg i');
      if (bar)
        bar.style.width =
          j === i ? Math.min(100, ((TR.tick - TR.scn.starts[i]) / (rows()[i].bars * 32)) * 100) + '%' : '0';
    });
    const pos = $('#scnPos');
    if (pos)
      pos.textContent =
        on && i >= 0
          ? 'Scene ' + sceneLabel(i) + ' · bar ' + (Math.floor((TR.tick - TR.scn.starts[i]) / 32) + 1)
          : 'Stopped';
    drawPlay();
    if (on) raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
}
function drawPlay() {
  const b = $('#scnPlay');
  if (b) {
    const on = TR.playing && TR.mode === 'scenes';
    b.classList.toggle('on', on);
    b.textContent = on ? '■ Stop' : '▶ Play';
  }
}
function drawTop() {
  drawPlay();
}

function head(clipsUsed) {
  return el(
    'div',
    { class: 'scnHead' },
    el('div', { class: 'scnCorner' }, 'Scene'),
    ...tracks().map(t =>
      el(
        'div',
        { class: 'scnTrk', style: '--tc:' + TRACK_COLORS[t] },
        el('b', {}, devNum(t) + ' · ' + S.tracks[t].name),
        el(
          'span',
          { class: 'hint' },
          (S.tracks[t].type === 'drum' ? 'Drums' : 'Tone') + ' · ' + clipsUsed[t] + ' of 16 clips'
        )
      )
    )
  );
}
function cell(i, t, c, over) {
  const above = i > 0 && rows()[i - 1].cells[t],
    same = !!c && sameCell(c, above),
    p = c && S.patterns[c.pat],
    tn = toneOf(c),
    sel = SC.row === i && SC.t === t;
  const pick = () => {
    SC.row = i;
    SC.t = t;
    markSel();
  };
  const open = () => (pick(), p ? editCell(i, t) : choosePattern(i, t));
  const menu = e => (e.preventDefault(), pick(), cellMenu(i, t, e.clientX, e.clientY, editCell));
  return el(
    'button',
    {
      type: 'button',
      class:
        'scnCell' +
        (p ? '' : ' empty') +
        (sel ? ' sel' : '') +
        (over ? ' over' : '') +
        (same ? ' same' : '') +
        (sel && SC.edit ? ' editing' : ''),
      title: same ? 'Carries on from the scene above (the MC-707 keeps it playing)' : null,
      style: '--tc:' + TRACK_COLORS[t],
      'data-row': i,
      'data-t': t,
      'aria-label': 'Scene ' + sceneLabel(i) + ', track ' + devNum(t) + ': ' + (p ? p.name : 'empty'),
      onclick: open,
      oncontextmenu: menu
    },
    p
      ? [
          el('b', {}, p.name),
          el(
            'span',
            { class: 'hint' },
            p.bars + (p.bars === 1 ? ' bar' : ' bars') + (c.tr ? ' · ' + (c.tr > 0 ? '+' : '') + c.tr : '')
          ),
          el('span', { class: 'scnTone' + (tn ? '' : ' none') }, tn ? '♪ ' + tn.name : 'clip’s own sound')
        ]
      : el('span', { class: 'scnPlus' }, '+')
  );
}
function row(r, i, clip) {
  const name = el('input', {
    class: 'scnName',
    value: r.name,
    'aria-label': 'Scene name',
    maxlength: 20,
    onchange: e => setName(i, e.target.value)
  });
  const bars = el('input', {
    type: 'number',
    class: 'scnBars',
    min: 1,
    max: 127,
    value: r.bars,
    'aria-label': 'Bars',
    title: 'How many bars this scene plays before the next (its LENGTH in the scene chain)',
    onchange: e => setBars(i, e.target.value)
  });
  return el(
    'div',
    { class: 'scnRow' + (SC.row === i ? ' cur' : '') },
    el(
      'div',
      { class: 'scnLabel' },
      el('span', { class: 'scnNo', title: 'MC-707 scene' }, sceneLabel(i)),
      name,
      el('label', { class: 'scnLen' }, bars, ' bars'),
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          'aria-label': 'Scene menu',
          onclick: e => rowMenu(i, e.clientX, e.clientY, scenePlay)
        },
        '⋯'
      ),
      el('div', { class: 'scnProg' }, el('i', {}))
    ),
    ...tracks().map(t => cell(i, t, r.cells[t], r.cells[t] && clip[i][t] < 0))
  );
}
function markSel() {
  document
    .querySelectorAll('#scene .scnCell')
    .forEach(b => b.classList.toggle('sel', +b.dataset.row === SC.row && +b.dataset.t === SC.t));
  document.querySelectorAll('#scene .scnRow').forEach((r, j) => r.classList.toggle('cur', j === SC.row));
}

/* the grid: the tracks across, the scenes down, and a line on the clips each track uses */
function drawGrid(wrap) {
  const map = scnClips(S.scn),
    used = Array(8).fill(0);
  for (const it of map.items) used[it.t]++;
  const over = map.over
    .map((n, t) => (n ? 'track ' + devNum(t) + ' needs ' + (16 + n) + ' clips' : ''))
    .filter(Boolean);
  const top = wrap.scrollTop;
  wrap.textContent = '';
  wrap.append(
    el(
      'div',
      { class: 'scnGrid', style: '--n:' + tracks().length },
      head(used),
      ...rows().map((r, i) => row(r, i, map.clip))
    ),
    el(
      'p',
      { class: 'hint scnFoot' },
      over.length
        ? el('b', { class: 'warn' }, 'Too many different cells: ' + over.join(', ') + ' (16 at most). ')
        : null,
      'Click a cell to edit its notes (an empty one to choose its pattern); right-click for its menu. Each track’s different cells become its MC-707 clips, in the order they first play. The last scene stays playing.'
    )
  );
  wrap.scrollTop = top;
  if (TR.playing && TR.mode === 'scenes') watch();
}
/** Draw Scene Mode. */
export function sceneRender() {
  const host = $('#scene');
  if (!host) return;
  const scroll = host.querySelector('.scnWrap') ? host.querySelector('.scnWrap').scrollTop : 0;
  host.textContent = '';
  host.append(sceneTop(sceneToggle));
  if (DEV !== '707')
    host.append(
      el(
        'p',
        { class: 'scnNote' },
        'Scenes are mapped on the MC-707 so far: on the MC-101, Scene Mode plays here but cannot send.'
      )
    );
  const rs = rows();
  if (!rs.length) {
    SC.edit = SC.big = false;
    undock(true);
    host.append(
      el(
        'div',
        { class: 'scnEmpty' },
        el('h2', {}, 'Arrange your song as MC-707 scenes'),
        el(
          'p',
          { class: 'hint' },
          'Each scene is a row: a pattern and a tone for each track, and how many bars it plays. Send to MC-707 writes them into clips and scenes, with the scene chain set, so the MC-707 plays the song by itself.'
        ),
        el(
          'div',
          { class: 'grp' },
          el('button', { type: 'button', class: 'btn on', onclick: () => addRow(null) }, '+ Add the first scene'),
          el('button', { type: 'button', class: 'btn', onclick: scenesFromSong }, 'Make scenes from the song')
        )
      )
    );
    return;
  }
  const grid = el('div', { class: 'scnWrap' });
  let col = null;
  const d = dock(() => (col ? col.replaceWith((col = trackColumn(SC.t))) : drawGrid(grid)));
  const body = el('div', { class: 'scnBody' + (d ? ' editing' : '') + (d && SC.big ? ' wide' : '') });
  if (d && SC.big) body.append((col = trackColumn(SC.t)), d);
  else {
    drawGrid(grid);
    body.append(grid);
    if (d) body.append(d);
    grid.scrollTop = scroll;
  }
  host.append(body);
  if (TR.playing && TR.mode === 'scenes') watch();
  drawTop();
}
