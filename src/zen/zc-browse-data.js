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

/** An entry's bank id: 'f:A' for a factory bank, 'u:name' for one of your folders, else its source
 * ('mine', 'mc707', 'starter'). */
export function bankOf(e) {
  if (e.src === 'factory') return 'f:' + (e.bank || '?');
  if (e.folder && (e.src === 'mine' || e.src === 'file')) return 'u:' + e.folder;
  return e.src === 'file' ? 'mine' : e.src;
}
const SRC_NAME = { mine: 'My sounds', mc707: 'From the MC-707', starter: 'Starters' };
/** A bank's name in the list and the table. */
export function bankName(id, short) {
  if (id.startsWith('u:')) return id.slice(2);
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
  const own = [...have].filter(b => b.startsWith('u:')).sort();
  return [
    ...(have.has('mine') ? ['mine'] : []),
    ...own,
    ...(have.has('mc707') ? ['mc707'] : []),
    ...fac,
    ...(have.has('starter') ? ['starter'] : [])
  ];
}

/**
 * The entries a view shows.
 * @param {object[]} list every entry of the kind being edited
 * @param {{bank:string, group:string, cat:string, tag:string, q:string}} f bank: 'all', 'fav', 'factory'
 *   (every factory bank) or a bank id; group or cat ('' for any)
 */
/* search text: lower case, accents off; and a compact form with no spaces or punctuation, so "epiano"
   finds E.Piano and "808" finds TR-808 */
const plain = t =>
  String(t)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
const compact = t => plain(t).replace(/[^a-z0-9]+/g, '');
const SRC_WORDS = { starter: 'starter', factory: 'factory', mine: 'mine my', mc707: 'grabbed mc-707', file: 'file' };
/** The text a search looks through for an entry: name, category, instrument, tags, number, folder, source. */
function searchText(e) {
  const hay = plain(
    [
      e.name,
      catLabel(catOf(e)),
      groupOf(e),
      ...(e.tags || []),
      e.group || '',
      e.type || '',
      e.folder || '',
      e.bank ? 'bank ' + e.bank : '',
      SRC_WORDS[e.src] || '',
      e.no ? String(e.no).padStart(4, '0') + ' ' + e.no : ''
    ].join(' ')
  );
  return [hay, compact(hay)];
}
/** Does an entry match a search? Every word must match, in any order (in the text or its compact form). */
export function searchHit(e, q) {
  const words = plain(q).split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const [hay, flat] = searchText(e);
  return words.every(w => hay.includes(w) || (compact(w) && flat.includes(compact(w))));
}
/** The entries a bank, category, tag and search show. */
export function filterList(list, f) {
  const q = (f.q || '').trim();
  return list.filter(e => {
    const b = bankOf(e);
    if (
      f.bank === 'fav' ? !ratingOf(e.id) : f.bank === 'factory' ? e.src !== 'factory' : f.bank !== 'all' && b !== f.bank
    )
      return false;
    if (f.cat ? catOf(e) !== f.cat : f.group && groupOf(e) !== f.group) return false;
    if (f.tag && !(e.tags || []).includes(f.tag)) return false;
    return !q || searchHit(e, q);
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

const BANK_ORDER = b =>
  b === 'mine' ? '0' : b.startsWith('u:') ? '0' + b : b === 'mc707' ? '1' : b.startsWith('f:') ? '2' + b : '3';
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
