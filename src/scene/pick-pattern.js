// Scene Mode's pattern picker: the factory library (by genre and part), My patterns, or the song's own
// patterns, with a search. ▶ plays a pattern on the track; picking one copies it into the song (once)
// and puts it in the cell.
//
// Reads: S, FAC, TR.
import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { devNum } from '../core/device.js';
import { poolOf } from '../core/tracks.js';
import { FAC } from '../library/factory.js';
import { instFactory } from '../library/index.js';
import { userLib } from '../library/user-lib.js';
import { TR, startPat, stopAll } from '../services/transport.js';
import { GENRE_LABELS } from '../song/library-panel.js';

const PARTS = {
  drum: [
    ['kit', 'Beats'],
    ['full', 'Full kits'],
    ['hats', 'Hats'],
    ['perc', 'Percussion'],
    ['fill', 'Fills']
  ],
  tone: [
    ['bass', 'Bass'],
    ['chords', 'Chords'],
    ['pad', 'Pads'],
    ['lead', 'Leads'],
    ['pluck', 'Plucks and arps'],
    ['acid', 'Acid']
  ]
};
const SHOW = 250;
/* what the picker showed last, kept between openings */
const P = { src: 'fac', q: '', genre: 'all', part: null };

function list(type) {
  const q = P.q.trim().toLowerCase(),
    hit = m => !q || (m.name + ' ' + (m.role || '') + ' ' + (m.genre || '')).toLowerCase().includes(q);
  if (P.src === 'user') return userLib().filter(m => m.type === type && hit(m));
  if (P.src === 'proj') return Object.values(S.patterns).filter(m => m.type === type && hit(m));
  return FAC.filter(
    f =>
      f.type === type && (P.genre === 'all' || f.genre === P.genre) && (P.part === 'all' || f.pool === P.part) && hit(f)
  );
}
const meta = m =>
  [
    GENRE_LABELS[m.genre] || '',
    m.bars + (m.bars === 1 ? ' bar' : ' bars'),
    m.bpm ? m.bpm + ' BPM' : '',
    m.keyName || ''
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Open the picker for track t.
 * @param {number} t
 * @param {string} title     what the cell is ("Scene 1-2")
 * @param {(pid:string) => void} done  gets the song pattern id
 * @param {string} [cur]     the cell's pattern now
 */
export function pickPattern(t, title, done, cur) {
  if ($('#spOv')) return;
  const type = S.tracks[t].type,
    parts = PARTS[type];
  if (!P.part || (P.part !== 'all' && !parts.some(x => x[0] === P.part)))
    P.part = parts.some(x => x[0] === poolOf(t)) ? poolOf(t) : 'all';
  const body = el('div', { class: 'spList', role: 'listbox', 'aria-label': 'Patterns' }),
    count = el('span', { class: 'hint' });
  const close = () => {
    if (TR.playing && TR.mode === 'pat') stopAll();
    ov.remove();
  };
  const choose = m => {
    close();
    done(P.src === 'proj' ? m.id : instFactory(m));
  };
  const draw = () => {
    const all = list(type);
    body.textContent = '';
    count.textContent = all.length > SHOW ? 'First ' + SHOW + ' of ' + all.length : all.length + ' patterns';
    for (const m of all.slice(0, SHOW)) {
      const play = el(
        'button',
        {
          type: 'button',
          class: 'btn sm spPlay',
          title: 'Play it on track ' + devNum(t),
          'aria-label': 'Play ' + m.name,
          onclick: e => {
            e.stopPropagation();
            if (TR.playing && TR.mode === 'pat' && TR.pat === m) stopAll();
            else startPat(m, t);
          }
        },
        '▶'
      );
      body.append(
        el(
          'div',
          {
            class: 'spRow' + (m.id === cur || (cur && S.patterns[cur] && S.patterns[cur].src === m.id) ? ' cur' : ''),
            role: 'option',
            tabindex: 0,
            onclick: () => choose(m),
            onkeydown: e => e.key === 'Enter' && choose(m)
          },
          play,
          el('b', {}, m.name),
          el('span', { class: 'hint' }, meta(m))
        )
      );
    }
    if (!all.length) body.append(el('p', { class: 'hint' }, 'Nothing matches.'));
  };
  const sel = (label, opts, val, set) =>
    el(
      'select',
      { 'aria-label': label, onchange: e => (set(e.target.value), draw()) },
      ...opts.map(([v, l]) => el('option', { value: v, selected: v === val }, l))
    );
  const tabs = el('div', { class: 'spTabs', role: 'tablist' });
  const filt = el('div', { class: 'spFilt' });
  const drawTop = () => {
    tabs.textContent = '';
    for (const [v, l] of [
      ['fac', 'Library'],
      ['user', 'My patterns'],
      ['proj', 'In this song']
    ])
      tabs.append(
        el(
          'button',
          {
            type: 'button',
            role: 'tab',
            class: 'btn' + (P.src === v ? ' on' : ''),
            'aria-selected': String(P.src === v),
            onclick: () => ((P.src = v), drawTop(), draw())
          },
          l
        )
      );
    filt.textContent = '';
    filt.append(search);
    if (P.src === 'fac')
      filt.append(
        sel('Genre', [['all', 'All genres'], ...Object.entries(GENRE_LABELS)], P.genre, v => (P.genre = v)),
        sel('Part', [['all', 'Any part'], ...parts], P.part, v => (P.part = v))
      );
    filt.append(count);
  };
  const search = el('input', {
    type: 'search',
    placeholder: 'Search',
    'aria-label': 'Search patterns',
    value: P.q,
    oninput: e => ((P.q = e.target.value), draw())
  });
  const ov = el(
    'div',
    {
      id: 'spOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Choose a pattern',
      onclick: e => e.target === ov && close(),
      onkeydown: e => e.key === 'Escape' && (e.stopPropagation(), close())
    },
    el(
      'div',
      { class: 'ptBox spBox' },
      el('h3', {}, 'Pattern for track ' + devNum(t) + ' · ' + S.tracks[t].name + ', ' + title),
      tabs,
      filt,
      body,
      el(
        'div',
        { style: 'display:flex;justify-content:flex-end;margin-top:10px' },
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel')
      )
    )
  );
  drawTop();
  draw();
  document.body.append(ov);
  search.focus();
}
