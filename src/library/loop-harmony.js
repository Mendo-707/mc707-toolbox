// The key and chords of loops you played (LoopCompose): a key from all the notes (the set's own key when
// they fit it), then a chord for each bar, the one of the key's chords that holds most of that bar's
// notes (long notes and notes on the beat count most; on a bass loop, the lowest note is the root).
// The chords come back as the composer's degree tokens (1-7, 5M for a major five in minor), so the
// composer can write every other part on them (library/compose.js composer opts.prog).
//
// Reads: nothing shared.
import { SCALES } from '../core/theory.js';

const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
/* Krumhansl's key profiles */
const PROF = {
  major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
  minor: [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
};
/* a note's weight: how long it sounds (up to a beat) and more on the beat */
const weight = n => Math.min(4, Math.max(0.5, n.l)) * (n.s % 4 < 0.25 ? 1.5 : 1) * (0.5 + (n.v || 100) / 254);

function corr(a, b) {
  const ma = a.reduce((x, y) => x + y, 0) / 12,
    mb = b.reduce((x, y) => x + y, 0) / 12;
  let n = 0,
    da = 0,
    db = 0;
  for (let i = 0; i < 12; i++) {
    n += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? n / Math.sqrt(da * db) : 0;
}

/** The key of some notes: the hint's when nearly all of them are in its scale, else the best fit. */
export function loopKey(notes, hint) {
  const h = Array(12).fill(0);
  for (const n of notes) h[n.n % 12] += weight(n);
  const total = h.reduce((a, b) => a + b, 0);
  if (!total) return { key: hint.key, scale: hint.scale };
  const inScale = (key, scale) => SCALES[scale].reduce((a, i) => a + h[(key + i) % 12], 0) / total;
  if (hint && inScale(hint.key, hint.scale) >= 0.9) return { key: hint.key, scale: hint.scale };
  let best = null;
  for (const scale of ['minor', 'major'])
    for (let key = 0; key < 12; key++) {
      const prof = PROF[scale].map((_, i) => PROF[scale][(i - key + 12) % 12]),
        sc = corr(h, prof) + (hint && hint.key === key && hint.scale === scale ? 0.08 : 0);
      if (!best || sc > best.sc) best = { key, scale, sc };
    }
  return { key: best.key, scale: best.scale };
}

/* the key's chords to choose from: its triads (not the diminished one), and a major five in minor */
function choices(key, scale) {
  const sc = SCALES[scale],
    out = [];
  for (let d = 0; d < 7; d++) {
    const pcs = [0, 2, 4].map(i => (key + sc[(d + i) % 7]) % 12),
      third = (pcs[1] - pcs[0] + 12) % 12,
      fifth = (pcs[2] - pcs[0] + 12) % 12;
    if (fifth !== 7) continue;
    out.push({ tok: d + 1, pcs, minor: third === 3 });
  }
  if (scale === 'minor') out.push({ tok: '5M', pcs: [7, 11, 2].map(i => (key + i) % 12), minor: false });
  return out;
}

/**
 * The key and a chord for every bar of some loops played together (each repeats over the longest).
 * @param {{notes:{s:number,l:number,n:number,v:number}[], bars:number, bass?:boolean}[]} loops
 * @param {{key:number, scale:string}} hint  the set's key
 * @returns {{key:number, scale:string, prog:(number|string)[], names:string[]}}
 */
export function loopHarmony(loops, hint) {
  const bars = Math.max(1, ...loops.map(l => l.bars || 1)),
    all = loops.flatMap(l => l.notes),
    { key, scale } = loopKey(all, hint),
    cands = choices(key, scale),
    prog = [],
    names = [];
  let prev = null;
  for (let b = 0; b < bars; b++) {
    const w = Array(12).fill(0);
    let low = null;
    for (const l of loops) {
      const lb = b % (l.bars || 1);
      for (const n of l.notes) {
        if (n.s < lb * 16 || n.s >= lb * 16 + 16) continue;
        w[n.n % 12] += weight(n) * (l.bass ? 1.5 : 1);
        if (l.bass && (!low || n.n < low.n || (n.n === low.n && n.s < low.s))) low = n;
      }
    }
    let best = null;
    if (w.some(Boolean))
      for (const c of cands) {
        let sc = 0;
        for (let pc = 0; pc < 12; pc++)
          if (w[pc]) sc += c.pcs.includes(pc) ? w[pc] * (pc === c.pcs[0] ? 1.3 : 1) : -0.6 * w[pc];
        if (low && low.n % 12 === c.pcs[0]) sc += 2;
        /* a near tie: the chord before, then the home chord */
        if (prev && c.tok === prev.tok) sc += 0.25;
        if (c.tok === 1) sc += 0.1;
        if (!best || sc > best.sc) best = { ...c, sc };
      }
    const c = best || prev || cands[0];
    prog.push(c.tok);
    names.push(NAMES[c.pcs[0]] + (c.minor ? 'm' : ''));
    prev = c;
  }
  return { key, scale, prog, names };
}
/** A key's name, as "F minor". */
export const keyName = (key, scale) => NAMES[key] + ' ' + scale;
