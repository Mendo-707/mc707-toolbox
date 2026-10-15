// Hi-hat and snare roll shapes (16th triplets, 32nds, 64th ramps …) as note positions inside one
// beat, and a parser for beat-by-beat hat lines like '8 8 t16 32'. Used by the genre pack and by
// Live Mode's Extreme variation.
//
// Reads: nothing.

/**
 * Positions of each roll shape inside one beat (4 steps), in steps. Triplets and 64ths fall between
 * the 32-tick grid; the players place them exactly with subTick() (core/song-model.js).
 */
export const ROLL = {
  '-': [],
  x: [0],
  4: [0],
  8: [0, 2],
  16: [0, 1, 2, 3],
  t8: [0, 4 / 3, 8 / 3],
  t16: [0, 2 / 3, 4 / 3, 2, 8 / 3, 10 / 3],
  32: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
  h32: [0, 1, 2, 2.5, 3, 3.5],
  ht16: [0, 1, 2, 2 + 2 / 3, 2 + 4 / 3],
  s24: [0, 1, 2, 2 + 1 / 3, 2 + 2 / 3, 3, 3 + 1 / 3, 3 + 2 / 3],
  64: [0, 1, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75],
  pr: [0, 0.5, 2],
  d: [0, 1.5, 3],
  sk: [0, 2, 3]
};
/** Two-beat shapes: quarter-note triplets and a slow 8th-triplet drag. */
export const ROLL2 = {
  tq: [0, 8 / 3, 16 / 3],
  t8x2: [0, 4 / 3, 8 / 3, 4, 16 / 3, 20 / 3]
};
const r4 = x => Math.round(x * 10000) / 10000;
const isRoll = k => /^(t16|32|h32|ht16|s24|64)$/.test(k);

/**
 * Notes for one roll shape starting at step `at`. Rolls swell from soft to loud; plain 8ths and 16ths
 * accent the beat.
 * @param {string} kind  a key of ROLL or ROLL2, or a 4-character grid like 'x..x'
 * @param {number} at    start step
 * @param {number} lane  drum lane (see LANE_KEY)
 * @param {number} [top] loudest velocity
 * @param {boolean} [fall] roll gets softer instead of louder
 * @returns {import('./types.js').Note[]}
 */
export function rollNotes(kind, at, lane, top = 100, fall = false) {
  if (/^[xXog.]{4}$/.test(kind))
    return [...kind].flatMap((c, i) => {
      const v = { x: top, X: Math.min(127, top + 20), o: Math.round(top * 0.68), g: Math.round(top * 0.42) }[c];
      return v ? [{ s: at + i, l: 1, n: lane, v }] : [];
    });
  const pos = ROLL[kind] || ROLL2[kind] || [];
  const roll = isRoll(kind),
    N = pos.length;
  return pos.map((p, i) => {
    let v;
    if (roll) {
      const u = N > 1 ? i / (N - 1) : 1;
      v = top * (0.5 + 0.5 * (fall ? 1 - u : u));
      if (p % 1 === 0 && p % 2 === 0) v = Math.max(v, top * 0.8);
    } else v = p === 0 ? top : p % 1 ? top * 0.72 : top * 0.82;
    return { s: r4(at + p), l: roll ? 0.5 : 1, n: lane, v: Math.max(1, Math.min(127, Math.round(v))) };
  });
}
/**
 * Notes for a hat line: one token per beat ('8', '16', 't16', '32', '64', 'x..x' …) or a two-beat
 * token ('tq'). Bars are separated by '|'.
 * @param {string} line  e.g. '8 8 8 t16 | 8 tq 64'
 * @param {number} [lane] drum lane, closed hat by default
 * @param {number} [top]
 */
export function hatLine(line, lane = 4, top = 100) {
  const out = [];
  line.split('|').forEach((bar, b) => {
    let beat = 0;
    for (const tok of bar.trim().split(/\s+/).filter(Boolean)) {
      out.push(...rollNotes(tok, b * 16 + beat * 4, lane, top));
      beat += ROLL2[tok] ? 2 : 1;
    }
  });
  return out;
}
