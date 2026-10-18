// The partial bar above the partial pages: pick the partial you see (1-4), and link any of them so a
// change to one linked partial goes to every linked partial (link 1 and 3 to edit both, all four to
// edit the whole tone).
//
// Reads: the open editor's state (passed in), the sound's partial switches.
import { el } from '../core/dom.js';
import { pk } from './zc-tone.js';

const PARTIAL = /^(PTL|PENV|FENV|AENV|LFO|EQ|SPTL)(\d)\./;

/** The keys a change to `key` reaches: every linked partial, when key's partial is one of them. */
export function linkedKeys(key, linked) {
  const m = PARTIAL.exec(key);
  if (!m || !linked || !linked[+m[2]]) return [key];
  return [0, 1, 2, 3].filter(i => linked[i]).map(i => key.replace(/\d\./, i + '.'));
}

/** The bar: partial buttons, then the link chips and All. `ze` is the editor state, `redraw` re-renders. */
export function partialBar(ze, redraw) {
  const linked = ze.linked || (ze.linked = [false, false, false, false]),
    all = linked.every(Boolean),
    chip = i =>
      el(
        'button',
        {
          type: 'button',
          class: 'zcLinkChip' + (linked[i] ? ' on' : ''),
          title: linked[i] ? 'Partial ' + (i + 1) + ' is linked' : 'Link partial ' + (i + 1),
          onclick: () => {
            linked[i] = !linked[i];
            redraw();
          }
        },
        String(i + 1)
      );
  return el(
    'div',
    { class: 'zcParts' },
    el('span', { class: 'zcL' }, 'Partial'),
    ...[0, 1, 2, 3].map(i => {
      const on = ze.snd.v[pk('PMT', null, 'PMT' + (i + 1) + '_PTL_SW')];
      return el(
        'button',
        {
          type: 'button',
          class: 'zcPart' + (i === ze.part ? ' on' : '') + (on ? ' lit' : '') + (linked[i] ? ' linked' : ''),
          title: on ? 'Partial ' + (i + 1) : 'Partial ' + (i + 1) + ' is switched off (Partials page)',
          onclick: () => {
            ze.part = i;
            redraw();
          }
        },
        String(i + 1)
      );
    }),
    el(
      'span',
      {
        class: 'zcLinks',
        title: 'Linked partials change together: a change to any linked partial goes to all of them'
      },
      el('span', { class: 'zcL' }, 'Link'),
      ...[0, 1, 2, 3].map(chip),
      el(
        'button',
        {
          type: 'button',
          class: 'zcLinkChip all' + (all ? ' on' : ''),
          onclick: () => {
            linked.fill(!all);
            redraw();
          }
        },
        'All'
      )
    )
  );
}
