// Scene Mode's scene chain: the scenes in the order the MC-707's scene chain plays them, each with its
// MC-707 number, a name, its length in bars, a chip per track for the clip it plays (click to choose),
// whether it is written (✓), changed (●) or new (+), and Write. The selected scene's clips are outlined on
// the board; the playing one lights up.
//
// Reads: S, SC.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, TRACK_COLORS, devNum } from '../core/device.js';
import { sceneState } from '../core/scene-model.js';
import { sceneName } from '../zen/zc-scenes.js';
import { SC, firstScene, rows, setBars, setFirst, setName } from './model.js';
import { sceneLabel } from './names.js';
import { MARK, MARK_TIP } from './board.js';

/**
 * The chain. act: {select(i), play(i), chip(i, t, x, y), menu(i, x, y), write(i), add(), more(x, y)}.
 */
export function chain(act) {
  const q = S.scn,
    rs = rows();
  const total = rs.reduce((n, r) => n + r.bars, 0);
  const first = el(
    'select',
    {
      'aria-label': 'First MC-707 scene',
      title: 'The MC-707 scene the first row goes into',
      onchange: e => setFirst(+e.target.value)
    },
    ...Array.from({ length: 128 }, (_, s) =>
      el('option', { value: s, selected: s === firstScene() }, 'from ' + sceneName(s))
    )
  );
  const head = el(
    'div',
    { class: 'scHead' },
    el('b', {}, 'Scene chain'),
    el('span', { class: 'hint' }, rs.length + ' scene' + (rs.length === 1 ? '' : 's') + ' · ' + total + ' bars'),
    el('label', { class: 'scFirst' }, first),
    el(
      'button',
      {
        type: 'button',
        class: 'btn sm',
        'aria-label': 'More',
        title: 'Make scenes from the song, lay them out in Song Mode',
        onclick: e => act.more(e.clientX, e.clientY)
      },
      '⋯'
    )
  );
  const list = el(
    'div',
    { class: 'scList', role: 'list' },
    ...rs.map((r, i) => {
      const st = sceneState(q, i);
      return el(
        'div',
        {
          class: 'scRowC' + (SC.row === i ? ' sel' : '') + ' ' + st,
          role: 'listitem',
          'data-row': i,
          onclick: e => !e.target.closest('input,button,select') && act.select(i),
          oncontextmenu: e => {
            if (e.target.tagName === 'INPUT') return;
            e.preventDefault();
            act.menu(i, e.clientX, e.clientY);
          }
        },
        el(
          'div',
          { class: 'scLine' },
          el(
            'button',
            {
              type: 'button',
              class: 'scPlay',
              title: 'Play from this scene',
              'aria-label': 'Play from scene ' + sceneLabel(i),
              onclick: () => act.play(i)
            },
            '▶'
          ),
          el(
            'span',
            { class: 'scNo', title: 'The MC-707 scene this row goes into (Call Scene TYPE2: bank-scene)' },
            sceneLabel(i)
          ),
          el('input', {
            class: 'scName',
            value: r.name,
            maxlength: 20,
            'aria-label': 'Scene name',
            title: 'A name for you (the MC-707 does not keep scene names)',
            onchange: e => setName(i, e.target.value)
          }),
          el(
            'label',
            {
              class: 'scBars',
              title:
                i === rs.length - 1
                  ? 'The last scene keeps playing (its chain LENGTH is OFF)'
                  : 'How many bars this scene plays before the next (its chain LENGTH)'
            },
            el('input', {
              type: 'number',
              min: 1,
              max: 127,
              value: r.bars,
              'aria-label': 'Bars',
              onchange: e => setBars(i, e.target.value)
            }),
            i === rs.length - 1 ? ' bars ↻' : ' bars'
          ),
          el('span', { class: 'scMark ' + st, title: MARK_TIP[st] }, MARK[st]),
          el(
            'button',
            {
              type: 'button',
              class: 'btn sm scWr' + (st === 'written' ? '' : ' on'),
              title: 'Write this scene (and any clips it plays that are not written yet)',
              onclick: () => act.write(i)
            },
            'Write'
          ),
          el('div', { class: 'scProg' }, el('i', {}))
        ),
        el(
          'div',
          { class: 'scChips' },
          ...DEVS[DEV].tracks.map(t => {
            const k = r.pick[t],
              c = k >= 0 && q.clips[t][k],
              p = c && S.patterns[c.pat];
            return el(
              'button',
              {
                type: 'button',
                class: 'scChip' + (p ? '' : ' none'),
                style: '--tc:' + TRACK_COLORS[t],
                title:
                  'Track ' +
                  devNum(t) +
                  ' ' +
                  S.tracks[t].name +
                  ': ' +
                  (p ? 'clip ' + (k + 1) + ', ' + p.name : 'nothing') +
                  '. Click to choose',
                'aria-label':
                  'Scene ' + sceneLabel(i) + ', track ' + devNum(t) + ': ' + (p ? 'clip ' + (k + 1) : 'nothing'),
                onclick: e => act.chip(i, t, e.clientX, e.clientY)
              },
              p ? String(k + 1) : '–'
            );
          })
        )
      );
    })
  );
  const add = el('button', { type: 'button', class: 'btn scAdd', onclick: act.add }, '+ Add a scene');
  return el('aside', { class: 'sChain', 'aria-label': 'Scene chain' }, head, list, add);
}
