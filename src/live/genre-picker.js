// The genre picker: when Live Mode opens (and nothing is playing) it asks which style to jam in,
// grouped by family, with the current set one click away. Picking a style builds a fresh set.
//
// Reads: LV, STYLES.
// Owns: localStorage 'mc707-live-pick' ('0' = do not ask when Live Mode opens).
import { $, el } from '../core/dom.js';
import { FAMLABEL, STYLES } from '../library/styles.js';
import { LV, lvStyle } from './state.js';
import { liveNewSet } from './scene-templates.js';
import { liveRender } from './panels.js';

const KEY = 'mc707-live-pick';
/** True unless the picker was turned off. */
export function livePickOnOpen() {
  try {
    return localStorage.getItem(KEY) !== '0';
  } catch (e) {
    return true;
  }
}
/** Show the genre picker. */
export function liveGenrePick() {
  if ($('#lvPickOv')) return;
  const cur = lvStyle();
  const close = () => ov.remove();
  const pick = id => {
    close();
    if (id !== LV.style || !LV.scenes.length) liveNewSet(id);
    liveRender();
  };
  const fams = ['dnb', 'hh', 'edm', 'song'].map(f => {
    const list = STYLES.filter(s => s.fam === f);
    return list.length
      ? el(
          'section',
          { class: 'lpFam' },
          el('h4', {}, FAMLABEL[f]),
          el(
            'div',
            { class: 'lpGrid' },
            ...list.map(s =>
              el(
                'button',
                {
                  type: 'button',
                  class: 'lpStyle' + (s.id === cur.id ? ' on' : ''),
                  title: s.vibe || s.name,
                  onclick: () => pick(s.id)
                },
                el('b', {}, s.name),
                el('small', {}, Math.round(s.bpm[2]) + ' BPM')
              )
            )
          )
        )
      : null;
  });
  const ov = el(
    'div',
    { id: 'lvPickOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pick a genre' },
    el(
      'div',
      { class: 'ptBox lpBox' },
      el(
        'div',
        { class: 'lpHead' },
        el('h3', {}, 'What are we jamming?'),
        el('button', { type: 'button', class: 'btn on', onclick: () => pick(cur.id) }, 'Keep ' + cur.name + ' →')
      ),
      el('p', { class: 'hint' }, 'Pick a style for a fresh set of scenes, or keep the one you had.'),
      ...fams,
      el(
        'label',
        { class: 'stShow' },
        el('input', {
          type: 'checkbox',
          checked: true,
          onchange: e => {
            try {
              localStorage.setItem(KEY, e.target.checked ? '1' : '0');
            } catch (er) {}
          }
        }),
        ' Ask when Live Mode opens'
      )
    )
  );
  ov.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
  });
  document.body.append(ov);
  setTimeout(() => {
    const b = ov.querySelector('.lpStyle.on');
    if (b) b.focus();
  }, 30);
}
