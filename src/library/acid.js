// Acid lines: TB-303 style 16th-note basslines with accents, slides (overlapping notes, so the
// MC-707 glides with portamento on) and octave jumps, in each genre's keys, for techno, house,
// trance, electro and breaks, and drum and bass. They go in their own 'acid' pool and show in the
// library as Acid lines. Give a clip the Acid kind on the clips screen and Live Mode plays them on
// it (in the B scenes and from the scene editor); acid techno's basslines include them too.
//
// Reads: FAC.
import { NOTE_NAMES } from '../core/theory.js';
import { mulberry } from '../core/random.js';
import { FAC } from './factory.js';

/* genre: [name tag, roots (pitch classes), styles that get the lines, base note (MIDI C2 = 36)] */
const ACID = {
  techno: ['Techno', [9, 0, 4, 5, 2], ['techno', 'minimal', 'acidtechno'], 33],
  house: ['House', [9, 5, 7, 2], ['classichouse', 'techhouse', 'deephouse'], 33],
  trance: ['Trance', [9, 6, 1, 4], ['trance', 'progtrance'], 33],
  electro: ['Electro', [9, 4, 7, 0], ['electro', 'breakbeat'], 33],
  dnb: ['DnB', [5, 2, 7, 9], ['jungle', 'neuro', 'jumpup'], 33]
};
/* scale steps an acid line leans on (minor with a phrygian b2 and a blue b5), with weights */
const DEG = [
  [0, 34],
  [12, 14],
  [3, 10],
  [7, 10],
  [10, 9],
  [5, 7],
  [1, 6],
  [6, 4],
  [15, 3],
  [-2, 3]
];
const WORDS = [
  'Squelch',
  'Rubber',
  'Phuture',
  'Resonator',
  'Slide Rule',
  'Snake',
  'Bubble',
  'Wire',
  'Mutant',
  'Acid Rain',
  'Liquid Acid',
  'Hard Acid'
];
function weighted(r) {
  const tot = DEG.reduce((a, d) => a + d[1], 0);
  let x = r() * tot;
  for (const [st, w] of DEG) if ((x -= w) < 0) return st;
  return 0;
}
/* One bar of an acid line: notes on most 16ths, about a third accented, some sliding into the next. */
function bar(r, base, density) {
  const on = [],
    out = [];
  for (let s = 0; s < 16; s++) on.push(s === 0 || r() < density);
  for (let s = 0; s < 16; s++) {
    if (!on[s]) continue;
    const next = on[(s + 1) % 16] && s < 15,
      slide = next && r() < 0.28,
      acc = s % 4 === 0 ? r() < 0.5 : r() < 0.25;
    out.push({ s, l: slide ? 1.25 : r() < 0.5 ? 0.5 : 0.75, n: base + weighted(r), v: acc ? 122 : 86 });
  }
  return out;
}
/* A second bar that answers the first: the same line with a few notes changed or moved up an octave. */
function answer(r, first, base) {
  return first.map(n => {
    const x = { ...n, s: n.s + 16 };
    const q = r();
    if (q < 0.15) x.n = base + weighted(r);
    else if (q < 0.25) x.n = n.n + 12 <= base + 24 ? n.n + 12 : n.n;
    else if (q < 0.32) x.v = n.v > 100 ? 86 : 122;
    return x;
  });
}

for (const g of Object.keys(ACID)) {
  const [tag, roots, styles, low] = ACID[g],
    r = mulberry(0xac1d + g.length * 977 + g.charCodeAt(0));
  for (let i = 0; i < 12; i++) {
    const root = roots[i % roots.length],
      base = low + ((root - (low % 12) + 12) % 12),
      bars = i % 3 === 2 ? 1 : 2,
      density = [0.62, 0.72, 0.8, 0.55][i % 4];
    const one = bar(r, base, density),
      notes = bars === 2 ? [...one, ...answer(r, one, base)] : one;
    FAC.push({
      id: 'ac-' + g + '-' + i,
      name: tag + ' Acid: ' + WORDS[i] + (bars === 1 ? ' 1-bar' : '') + ' (' + NOTE_NAMES[root] + 'm)',
      type: 'tone',
      genre: g,
      bpm: null,
      bars,
      notes: notes.sort((a, b) => a.s - b.s || a.n - b.n),
      key: { root, scale: 'minor' },
      keyName: NOTE_NAMES[root] + ' minor',
      role: 'Acid',
      pool: 'acid',
      styles,
      gen: true,
      lively: true
    });
  }
}
