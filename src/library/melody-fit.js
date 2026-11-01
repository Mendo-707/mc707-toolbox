// How well a lead or pluck pattern sits with the music it plays over, for the automatic picks (Live Mode's
// sets, swaps and guests, and the song wizard). Two checks:
//   harmony  on the strong beats and held notes, how many notes are tones of the chord sounding then (from
//            a chords pattern on the same progression and length), and how many rub a half-step against it.
//            A pattern that clashes is left out of the automatic picks (it stays in the library to pick by
//            hand: changing its notes would change the songs that use it).
//   timing   triplet and dotted-8th lines run across a straight beat and feel as if they drift, so they are
//            only picked in styles with a triplet or swung feel (and dotted 8ths in trance, synthwave, pop
//            and ambient, where that delay-arp feel belongs).
//
// Reads: FAC.
import { FAC } from './factory.js';

/* the chords a pattern follows: its progression in its name (the same test as pools.js lvProg) */
const progOf = f => {
  const m = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}b?[ivIV]{1,3}[A-Za-z0-9]*)/.exec(f.name);
  return m ? m[1] : null;
};
/* chords patterns by genre, progression and length, built once */
let CHORDS = null;
function chordsFor(f, p) {
  if (!CHORDS) {
    CHORDS = new Map();
    for (const g of FAC) {
      if (g.type !== 'tone' || g.pool !== 'chords' || !g.key) continue;
      const q = progOf(g);
      if (!q) continue;
      for (const k of [g.genre + '|' + q + '|' + g.bars, '*|' + q + '|' + g.bars]) if (!CHORDS.has(k)) CHORDS.set(k, g);
    }
  }
  return CHORDS.get(f.genre + '|' + p + '|' + f.bars) || CHORDS.get('*|' + p + '|' + f.bars) || null;
}
/**
 * The pitch classes sounding in a pattern at each 16th step, in the key of `root`, with a silent step
 * keeping the chord before it (a stab still implies its chord until the next one).
 */
function harmonyGrid(g, root) {
  const n = g.bars * 16,
    sh = (((root - g.key.root) % 12) + 12) % 12,
    grid = Array.from({ length: n }, () => new Set());
  for (const x of g.notes)
    for (let s = Math.floor(x.s); s < Math.min(n, Math.ceil(x.s + x.l)); s++) grid[s].add((x.n + sh) % 12);
  let last = null;
  for (let pass = 0; pass < 2; pass++)
    for (let s = 0; s < n; s++) {
      if (grid[s].size) last = grid[s];
      else if (last) grid[s] = last;
    }
  return grid;
}
const SCORE = new Map();
/** Forget what was worked out (the library has grown: finishLibrary adds the packs). */
export function melodyFitReset() {
  CHORDS = null;
  SCORE.clear();
}
/**
 * How well a lead or pluck fits its chords: {tones, clash} as shares of the strong-beat and held notes
 * (weighted by length), or null when it follows no progression or no chords pattern has it.
 */
export function melodyScore(f) {
  if (SCORE.has(f.id)) return SCORE.get(f.id);
  let out = null;
  const p = f.type === 'tone' && f.key && progOf(f),
    g = p && chordsFor(f, p);
  if (g) {
    const grid = harmonyGrid(g, f.key.root);
    let all = 0,
      tones = 0,
      clash = 0;
    for (const x of f.notes) {
      if (!(x.s % 4 === 0 || x.l >= 2)) continue;
      const ch = grid[Math.floor(x.s) % grid.length];
      if (!ch || !ch.size) continue;
      const pc = x.n % 12,
        w = Math.min(x.l, 8);
      all += w;
      if (ch.has(pc)) tones += w;
      else if ([...ch].some(c => (pc - c + 12) % 12 === 1 || (c - pc + 12) % 12 === 1)) clash += w;
    }
    if (all) out = { tones: tones / all, clash: clash / all };
  }
  SCORE.set(f.id, out);
  return out;
}
/** True when a lead or pluck clashes with its chords too much for an automatic pick. */
export const melodyClashes = f => {
  const s = melodyScore(f);
  return !!s && (s.clash > 0.2 || s.tones < 0.5);
};

/* the styles whose beat has a triplet or swung feel, and those where a dotted-8th arp belongs */
const TRIPLET_STYLES = new Set([
  'trap',
  'drill',
  'phonk',
  'memphis',
  'boombap',
  'lofi',
  'gfunk',
  'neosoul',
  'halftime',
  'dubstep',
  'riddim',
  'afrobeats',
  'dancehall',
  'reggaeton',
  'ambient',
  'cinematic'
]);
const DOTTED_STYLES = new Set(['trance', 'progtrance', 'synthwave', 'pop', 'indie', 'ambient', 'cinematic']);
/** A line in triplets (notes between the 16ths, or named so). */
export const isTriplet = f => /triplet/i.test(f.name) || f.notes.some(x => Math.abs(x.s - Math.round(x.s)) > 0.01);
/** A line in dotted 8ths, running in threes across the bar. */
export const isDotted = f => /dotted/i.test(f.name);
/** True when a lead or pluck's rhythm suits the style's beat. */
export function melodyFeelOk(f, styleId) {
  if (isTriplet(f)) return TRIPLET_STYLES.has(styleId);
  if (isDotted(f)) return DOTTED_STYLES.has(styleId);
  return true;
}
