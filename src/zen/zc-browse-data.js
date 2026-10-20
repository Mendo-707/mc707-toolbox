// What the Sound browser lists, the ZENOLOGY way: banks down the left (your sounds, the MC-707's,
// the factory banks, the starters), ZenCore categories in groups in the middle, and a table that sorts
// by bank and number, name, category or rating. Pure functions over the entries; the browser draws them.
//
// Reads: ZS (ratings).
import { ZC_CATEGORIES } from './zc-data.js';
import { FW_BANK_NAMES } from './zc-factory.js';
import { ratingOf } from './zc-sounds.js';

/** Category groups: [group, [ZenCore category names]]. */
export const CAT_GROUPS = [
  ['Piano', ['Ac.Piano', 'Pop-Piano', 'E.Grand Piano']],
  ['E.Piano', ['E.Piano1', 'E.Piano2']],
  ['Organ', ['E.Organ', 'Pipe Organ', 'Reed Organ']],
  ['Keyboard', ['Harpsichord', 'Clav', 'Celesta', 'Accordion', 'Harmonica', 'Bell', 'Mallet']],
  ['Guitar', ['Ac.Guitar', 'E.Guitar', 'Dist.Guitar', 'Plucked/Stroke']],
  ['Bass', ['Ac.Bass', 'E.Bass', 'Synth Bass']],
  ['Strings', ['Solo Strings', 'Ensemble Strs', 'Orchestral']],
  ['Brass', ['Solo Brass', 'Ensemble Brass']],
  ['Wind', ['Wind', 'Flute', 'Sax', 'Recorder']],
  ['Vocal', ['Vox/Choir', 'Scat']],
  ['Synth', ['Synth Lead', 'Synth Brass', 'Synth Pad/Str', 'Synth BellPad', 'Synth PolyKey', 'Synth Seq/Pop']],
  ['Motion', ['Phrase', 'Pulsating', 'Beat&Groove']],
  ['FX', ['Synth FX', 'Hit', 'Sound FX']],
  ['Drums', ['Drums', 'Percussion']],
  ['Other', ['None', 'Stack', 'Zone']]
];
const GROUP_OF = Object.fromEntries(CAT_GROUPS.flatMap(([g, l]) => l.map(c => [c, g])));
/** How a category shows: 'None' reads as No assign, as on the MC-707. */
export const catLabel = c => (c === 'None' ? 'No assign' : c);

/** An entry's ZenCore category name (cached on the entry; kits are Drums). */
export function catOf(e) {
  if (e.cat) return e.cat;
  let n = 0;
  if (e.kind === 'kit') n = ZC_CATEGORIES.indexOf('Drums');
  else if (e.make) n = e.make().v['CMN.CATEGORY'] | 0;
  else if (e.d) n = e.d['CMN.CATEGORY'] | 0;
  return (e.cat = ZC_CATEGORIES[n] || 'None');
}
export const groupOf = e => GROUP_OF[catOf(e)] || 'Other';

/** An entry's bank id: 'f:A' for a factory bank, else its source ('mine', 'mc707', 'starter'). */
export function bankOf(e) {
  if (e.src === 'factory') return 'f:' + (e.bank || '?');
  return e.src === 'file' ? 'mine' : e.src;
}
const SRC_NAME = { mine: 'My sounds', mc707: 'From the MC-707', starter: 'Starters' };
/** A bank's name in the list and the table. */
export function bankName(id, short) {
  if (id.startsWith('f:')) {
    const l = id.slice(2);
    if (l === '?') return 'Factory';
    return short ? 'PRST_' + l : 'PRST_' + l + ' ' + (FW_BANK_NAMES[l] || 'Factory');
  }
  return SRC_NAME[id] || id;
}
/** The banks the entries fill, in list order: your sounds, the MC-707's, factory A-…, starters. */
export function banksIn(list) {
  const have = new Set(list.map(bankOf));
  const fac = [...have].filter(b => b.startsWith('f:')).sort();
  return [...['mine', 'mc707'].filter(b => have.has(b)), ...fac, ...(have.has('starter') ? ['starter'] : [])];
}

/**
 * The entries a view shows.
 * @param {object[]} list every entry of the kind being edited
 * @param {{bank:string, group:string, cat:string, tag:string, q:string}} f bank: 'all', 'fav', 'factory'
 *   (every factory bank) or a bank id; group or cat ('' for any)
 */
export function filterList(list, f) {
  const q = f.q.trim().toLowerCase();
  return list.filter(e => {
    const b = bankOf(e);
    if (
      f.bank === 'fav' ? !ratingOf(e.id) : f.bank === 'factory' ? e.src !== 'factory' : f.bank !== 'all' && b !== f.bank
    )
      return false;
    if (f.cat ? catOf(e) !== f.cat : f.group && groupOf(e) !== f.group) return false;
    if (f.tag && !(e.tags || []).includes(f.tag)) return false;
    if (!q) return true;
    const hay = [
      e.name,
      catLabel(catOf(e)),
      ...(e.tags || []),
      e.group || '',
      e.no ? String(e.no).padStart(4, '0') : ''
    ];
    return hay.join(' ').toLowerCase().includes(q);
  });
}

/** How many entries each category and group holds (for the counts in the tree). */
export function catCounts(list) {
  const c = {};
  for (const e of list) {
    const k = catOf(e);
    c[k] = (c[k] || 0) + 1;
    c['g:' + groupOf(e)] = (c['g:' + groupOf(e)] || 0) + 1;
  }
  return c;
}

const BANK_ORDER = b => (b === 'mine' ? '0' : b === 'mc707' ? '1' : b.startsWith('f:') ? '2' + b : '3');
/** Sort in place by 'bank' (then number, then newest), 'name', 'cat' or 'rating'; dir 1 or -1. */
export function sortList(list, by, dir) {
  const key = {
    bank: e => BANK_ORDER(bankOf(e)),
    name: e => e.name.toLowerCase(),
    cat: e => catLabel(catOf(e)).toLowerCase(),
    rating: e => -ratingOf(e.id)
  }[by];
  const tie = (a, b) => (a.no || 0) - (b.no || 0) || (b.at || 0) - (a.at || 0) || a.name.localeCompare(b.name);
  return list.sort((a, b) => {
    const x = key(a),
      y = key(b);
    return (x < y ? -1 : x > y ? 1 : 0) * dir || tie(a, b);
  });
}
