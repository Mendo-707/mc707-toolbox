// The Sound browser's table: one row per sound with its rating (three stars), bank, number, name,
// category and tags, a ▶ to load and play it, and a ⋯ menu. Headers sort (click again to reverse).
// Rows are drawn in batches as the list scrolls, so the factory banks (thousands of tones) stay quick.
// ↑ and ↓ move through the list and load each sound, as on ZENOLOGY.
//
// Reads: ZS (ratings).
import { el } from '../core/dom.js';
import { bankName, bankOf, catLabel, catOf } from './zc-browse-data.js';
import { ratingOf, setRating } from './zc-sounds.js';

const BATCH = 200;
/** Columns: [sort key, header, class]; null sort key = not sortable. */
const COLS = [
  ['rating', 'Rating', 'zbRate'],
  ['bank', 'Bank', 'zbBank'],
  [null, 'No.', 'zbNo'],
  ['name', 'Name', 'zbNm'],
  ['cat', 'Category', 'zbCat'],
  [null, 'Tags', 'zbTg']
];

/* three stars: click one to rate up to it, click the highest lit one again to clear */
function stars(e, redraw) {
  const r = ratingOf(e.id);
  return el(
    'span',
    { class: 'zbRate', role: 'group', 'aria-label': 'Rating: ' + r + ' of 3' },
    ...[1, 2, 3].map(n =>
      el(
        'button',
        {
          type: 'button',
          class: 'zbStar' + (n <= r ? ' on' : ''),
          title: n === r ? 'Clear the rating' : 'Rate ' + n + ' star' + (n > 1 ? 's' : ''),
          onclick: x => {
            x.stopPropagation();
            setRating(e.id, n === r ? 0 : n);
            redraw();
          }
        },
        n <= r ? '★' : '☆'
      )
    )
  );
}

/**
 * The header row.
 * @param {{by:string, dir:number}} sort
 * @param {(by:string) => void} onSort
 */
export function tableHead(sort, onSort) {
  return el(
    'div',
    { class: 'zbTh', role: 'row' },
    ...COLS.map(([k, label, cls]) =>
      k
        ? el(
            'button',
            {
              type: 'button',
              class: cls + (sort.by === k ? ' on' : ''),
              title: 'Sort by ' + label.toLowerCase(),
              onclick: () => onSort(k)
            },
            label + (sort.by === k ? (sort.dir > 0 ? ' ▲' : ' ▼') : '')
          )
        : el('span', { class: cls }, label)
    ),
    el('span', { class: 'zbPlay' }),
    el('span', { class: 'zbAct' })
  );
}

/**
 * One row. act: {cur, load(e), play(e, x), menu(e, x, y), more(e, x), redraw()}.
 */
export function tableRow(e, act) {
  const b = bankOf(e);
  return el(
    'div',
    {
      class: 'zbItem' + (act.cur === e.id ? ' cur' : ''),
      role: 'row',
      tabindex: -1,
      'data-id': e.id,
      title: 'Load into this clip · ↑ ↓ for the next · right-click for more',
      onclick: () => act.load(e),
      oncontextmenu: x => {
        x.preventDefault();
        x.stopPropagation();
        act.menu(e, x.clientX, x.clientY);
      }
    },
    stars(e, act.redraw),
    el('span', { class: 'zbBank', title: bankName(b) }, bankName(b, true)),
    el('span', { class: 'zbNo' }, e.no ? String(e.no).padStart(4, '0') : ''),
    el('span', { class: 'zbNm' }, e.name),
    el('span', { class: 'zbCat' }, catLabel(catOf(e))),
    el('span', { class: 'zbTg' }, (e.tags || []).join(' · ')),
    el(
      'button',
      {
        type: 'button',
        class: 'zbPlay',
        title: 'Load it and hold to play a note',
        onpointerdown: x => act.play(e, x),
        onclick: x => x.stopPropagation()
      },
      '▶'
    ),
    e.src === 'starter'
      ? el('span', { class: 'zbAct' })
      : el(
          'button',
          {
            type: 'button',
            class: 'zbAct',
            title: 'Rename, type, tags, delete',
            onclick: x => (x.stopPropagation(), act.more(e, x))
          },
          '⋯'
        )
  );
}

/**
 * Fill the list box with rows, a batch at a time as it scrolls; extra(e) can add a row after an entry
 * (the edit form). Returns nothing; keeps the batch state on the box.
 */
export function fillTable(box, list, act, extra) {
  let n = 0;
  const more = () => {
    const end = Math.min(list.length, n + BATCH);
    for (; n < end; n++) {
      box.append(tableRow(list[n], act));
      const x = extra && extra(list[n]);
      if (x) box.append(x);
    }
  };
  more();
  /* draw down to the current sound, so it can be scrolled to */
  const at = list.findIndex(e => e.id === act.cur);
  while (at >= n && n < list.length) more();
  box.onscroll = () => {
    if (n < list.length && box.scrollTop + box.clientHeight > box.scrollHeight - 400) more();
  };
  box.onkeydown = k => {
    if (k.key !== 'ArrowDown' && k.key !== 'ArrowUp') return;
    k.preventDefault();
    const cur = box.querySelector('.zbItem.cur'),
      i = Math.max(0, list.findIndex(e => cur && e.id === cur.dataset.id) + (k.key === 'ArrowDown' ? 1 : -1));
    if (!list[i]) return;
    while (i >= n && n < list.length) more();
    act.load(list[i]);
  };
}
