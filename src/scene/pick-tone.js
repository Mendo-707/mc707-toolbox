// Scene Mode's tone picker: the sounds in your library (My sounds and your folders, sounds grabbed from
// the MC-707, the factory tones from its update file once added) and the starters, by bank, category
// and search. Drum tracks get drum kits. Picking one gives the cell that tone; the MC-707 clip gets it
// when the scenes are sent.
//
// Reads: ZS.
import { $, el } from '../core/dom.js';
import { S } from '../core/state.js';
import { devNum } from '../core/device.js';
import { ZS, diffOf, soundOf, soundsLoad, typeOf } from '../zen/zc-sounds.js';
import { CAT_GROUPS, bankName, bankOf, banksIn, catLabel, catOf, filterList, sortList } from '../zen/zc-browse-data.js';
import { starterMenu } from '../zen/zc-starters-more.js';
import { factoryImport } from '../zen/zc-factory-ui.js';

const SHOW = 300;
const T = { q: '', bank: 'all', group: '' };
let STARTS = null;
function starters() {
  if (STARTS) return STARTS;
  STARTS = [];
  for (const [group, items] of starterMenu())
    for (const [name, make] of items) {
      const snd = make();
      STARTS.push({
        id: 'st:' + name,
        name,
        kind: snd.kind,
        type: typeOf(snd, name),
        tags: [],
        src: 'starter',
        group,
        make
      });
    }
  return STARTS;
}
/** The tone of an entry, as a cell keeps it. */
const toneOf = e => ({
  name: e.name,
  kind: e.kind,
  d: e.src === 'starter' ? diffOf(e.make()) : diffOf(soundOf(e))
});

/**
 * Open the picker for track t.
 * @param {(tone:{name:string, kind:string, d:object}|null) => void} done  null: keep the clip's sound
 * @param {string} [curName]  the cell's tone now
 */
export async function pickTone(t, title, done, curName) {
  if ($('#stOv')) return;
  await soundsLoad();
  const kind = S.tracks[t].type === 'drum' ? 'kit' : 'tone';
  const all = () => [...ZS.list, ...starters()].filter(e => e.kind === kind);
  const body = el('div', { class: 'spList', role: 'listbox', 'aria-label': 'Sounds' }),
    count = el('span', { class: 'hint' }),
    filt = el('div', { class: 'spFilt' });
  const close = () => ov.remove();
  const choose = e => (close(), done(toneOf(e)));
  const draw = () => {
    const list = sortList(filterList(all(), { ...T, cat: '', tag: '' }), 'bank', 1);
    body.textContent = '';
    count.textContent = list.length > SHOW ? 'First ' + SHOW + ' of ' + list.length : list.length + ' sounds';
    for (const e of list.slice(0, SHOW))
      body.append(
        el(
          'div',
          {
            class: 'spRow' + (e.name === curName ? ' cur' : ''),
            role: 'option',
            tabindex: 0,
            onclick: () => choose(e),
            onkeydown: x => x.key === 'Enter' && choose(e)
          },
          el('span', { class: 'stBank' }, bankName(bankOf(e), true)),
          el('b', {}, e.name),
          el('span', { class: 'hint' }, catLabel(catOf(e)))
        )
      );
    if (!list.length) body.append(el('p', { class: 'hint' }, 'Nothing matches.'));
  };
  const drawFilt = () => {
    const banks = banksIn(all()),
      hasFac = banks.some(b => b.startsWith('f:'));
    filt.textContent = '';
    filt.append(
      search,
      el(
        'select',
        { 'aria-label': 'Bank', onchange: e => ((T.bank = e.target.value), draw()) },
        el('option', { value: 'all' }, 'All banks'),
        hasFac ? el('option', { value: 'factory', selected: T.bank === 'factory' }, 'All factory tones') : null,
        ...banks.map(b => el('option', { value: b, selected: T.bank === b }, bankName(b)))
      ),
      kind === 'tone'
        ? el(
            'select',
            { 'aria-label': 'Category', onchange: e => ((T.group = e.target.value), draw()) },
            el('option', { value: '' }, 'Any category'),
            ...CAT_GROUPS.map(([g]) => el('option', { value: g, selected: T.group === g }, g))
          )
        : null,
      count
    );
    if (!hasFac)
      filt.append(
        el(
          'button',
          {
            type: 'button',
            class: 'btn sm',
            title: 'Read the preset tones from the MC-707 system update file on your computer',
            onclick: () => factoryImport(() => (drawFilt(), draw()))
          },
          'Add the factory tones…'
        )
      );
  };
  if (!banksIn(all()).includes(T.bank) && !['all', 'factory'].includes(T.bank)) T.bank = 'all';
  const search = el('input', {
    type: 'search',
    placeholder: 'Search',
    'aria-label': 'Search sounds',
    value: T.q,
    oninput: e => ((T.q = e.target.value), draw())
  });
  const ov = el(
    'div',
    {
      id: 'stOv',
      class: 'ptOv',
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': 'Choose a tone',
      onclick: e => e.target === ov && close(),
      onkeydown: e => e.key === 'Escape' && (e.stopPropagation(), close())
    },
    el(
      'div',
      { class: 'ptBox spBox' },
      el(
        'h3',
        {},
        (kind === 'kit' ? 'Drum kit' : 'Tone') + ' for track ' + devNum(t) + ' · ' + S.tracks[t].name + ', ' + title
      ),
      el(
        'p',
        { class: 'hint' },
        'The MC-707 clip gets this sound when you send the scenes. Factory tones come from your MC-707 update file; your own sounds from the ZenCore editor.'
      ),
      filt,
      body,
      el(
        'div',
        { style: 'display:flex;gap:8px;justify-content:flex-end;margin-top:10px' },
        el(
          'button',
          {
            type: 'button',
            class: 'btn',
            title: 'Send no sound: the clip keeps the one it has',
            onclick: () => (close(), done(null))
          },
          'Keep the clip’s sound'
        ),
        el('button', { type: 'button', class: 'btn', onclick: close }, 'Cancel')
      )
    )
  );
  drawFilt();
  draw();
  document.body.append(ov);
  search.focus();
}
