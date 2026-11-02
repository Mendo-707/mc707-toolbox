// The demo song: its clips spell MC 707 / 101 TOOLBOX across the arrangement, a pixel font with a clip for
// each run of lit pixels, letters five tracks tall between a steady beat above and an arp below (on an MC-101,
// with four tracks, a four-high font). It plays as a house tune in F minor: each track plays a pattern for its
// job (kit, hats, perc, bass, chords, pad, arp), all on one progression, whenever its pixels are lit.
//
// Reads: FAC, DEV. Changes: S (through makeDemo in library/index.js).
import { DEV, DEVS } from '../core/device.js';
import { poolOf } from '../core/tracks.js';
import { FAC } from './factory.js';

export const DEMO_TEXT = 'MC 707 / 101 TOOLBOX';
/* five rows high, # lit; widths vary (M and X are five wide) */
const GLYPH = {
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#'],
  C: ['###', '#..', '#..', '#..', '###'],
  7: ['###', '..#', '.#.', '.#.', '.#.'],
  0: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  1: ['.#.', '##.', '.#.', '.#.', '###'],
  '/': ['..#', '..#', '.#.', '#..', '#..'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  O: ['###', '#.#', '#.#', '#.#', '###'],
  L: ['#..', '#..', '#..', '#..', '###'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  X: ['#...#', '.#.#.', '..#..', '.#.#.', '#...#']
};
/* four rows high (an MC-101): the middle row left out, B redrawn so it is not a D */
const four = g => (g === GLYPH.B ? ['##.', '###', '#.#', '##.'] : [g[0], g[1], g[3], g[4]]);

/**
 * The text as rows of pixels, one column per bar: a bar's gap between letters and three for a space.
 * @param {string} text
 * @param {number} h  5, or 4 for the MC-101
 * @returns {boolean[][]} rows, top first
 */
export function demoPixels(text = DEMO_TEXT, h = 5) {
  const rows = Array.from({ length: h }, () => []);
  let first = true;
  for (const ch of text) {
    if (ch === ' ') {
      rows.forEach(r => r.push(false, false));
      continue;
    }
    const g = GLYPH[ch];
    if (!g) continue;
    if (!first) rows.forEach(r => r.push(false));
    first = false;
    (h === 4 ? four(g) : g).forEach((line, y) => rows[y].push(...[...line].map(c => c === '#')));
  }
  return rows;
}
/** Runs of lit pixels in a row: [start, length] in bars. */
const runs = row => {
  const out = [];
  for (let x = 0; x < row.length; x++) {
    if (!row[x]) continue;
    const s = x;
    while (row[x + 1]) x++;
    out.push([s, x - s + 1]);
  }
  return out;
};

/* a house pattern for a track's job, on the i-iv-VII-III progression where it has one */
function patternFor(pool) {
  const house = FAC.filter(
    f => f.genre === 'house' && !f.busy && (f.pool === pool || (pool === 'full' && f.pool === 'kit'))
  );
  return (
    house.find(f => /i-iv-VII-III/.test(f.name) && f.key && f.key.root === 5) ||
    house.find(f => f.key && f.key.root === 5) ||
    house.find(f => /i-iv-VII-III/.test(f.name)) ||
    house[0] ||
    FAC.find(f => f.pool === pool)
  );
}

/**
 * Where the clips go: [track, start bar, bars, factory pattern] for every run of pixels, plus the beat above
 * and the arp below when there are tracks for them. Also the song's length in bars.
 */
export function demoClips() {
  const vis = DEVS[DEV].tracks,
    h = vis.length >= 5 ? 5 : 4,
    px = demoPixels(DEMO_TEXT, h),
    /* a bar of beat before the text and after it */
    lead = 1,
    len = px[0].length + lead * 2;
  const rows = vis.length >= 7 ? vis.slice(1, 6) : vis.slice(0, h),
    above = vis.length >= 7 ? vis[0] : -1,
    below = vis.length >= 7 ? vis[6] : -1;
  const out = [];
  rows.forEach((t, y) => {
    const f = patternFor(poolOf(t));
    if (f) for (const [s, n] of runs(px[y])) out.push([t, s + lead, n, f]);
  });
  for (const t of [above, below]) {
    const f = t >= 0 && patternFor(poolOf(t));
    if (f) out.push([t, 0, len, f]);
  }
  return { clips: out, bars: len };
}
