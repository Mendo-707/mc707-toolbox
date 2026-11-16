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

/* ---------- weak lines ----------
   What makes a line sound generic, measured on its top notes: the same rhythm in nearly every bar, a
   back-and-forth wobble (x y x y), a scale run of five notes or more, the same shape moved up a step bar
   after bar (a sequence), 16th runs through the bar, no rhythm that ever comes back, two notes only, notes
   all on the beat, no space, and a last note cut short. Each costs points from 100. */
/**
 * How good a lead line is (0-100): 70 and up is fine; under 70 is left out of Live Mode's automatic picks.
 * Plucks are mostly arps, where one length and a wide range are the point: for them only a two-note wobble
 * that loops, or notes thrown about over two octaves, count against.
 * @param {{notes:{s:number,l:number,n:number}[], bars:number}} f
 * @param {'lead'|'pluck'} role
 */
export function melodyQuality(f, role = 'lead') {
  if (f._mq && f._mq[role] != null) return f._mq[role];
  const line = [];
  for (const n of f.notes.slice().sort((a, b) => a.s - b.s || b.n - a.n))
    if (!line.length || line[line.length - 1].s !== n.s) line.push(n);
  const bars = Math.max(1, f.bars || 1),
    N = line.length;
  let sc = 100;
  if (N >= 3) {
    const rb = Array.from({ length: bars }, (_, b) =>
      line
        .filter(n => Math.floor(n.s / 16) === b)
        .map(n => n.s % 16)
        .join(',')
    );
    const cnt = {};
    for (const x of rb) if (x) cnt[x] = (cnt[x] || 0) + 1;
    const topShare = Math.max(0, ...Object.values(cnt)) / bars;
    let wob = 0;
    for (let i = 3; i < N; i++)
      if (
        line[i].n === line[i - 2].n &&
        line[i - 1].n === line[i - 3].n &&
        line[i].n !== line[i - 1].n &&
        Math.abs(line[i].n - line[i - 1].n) <= 2
      )
        wob++;
    const pcs = new Set(line.map(n => n.n)).size;
    if (role === 'pluck') {
      if (pcs <= 2 && wob >= 4 && topShare >= 0.75) sc -= 40;
      /* notes thrown about over two octaves and more, more than an octave apart a third of the time */
      const ns = line.map(n => n.n),
        wide = line.slice(1).filter((n, i) => Math.abs(n.n - line[i].n) > 12).length / (N - 1);
      if (Math.max(...ns) - Math.min(...ns) > 24 && wide > 0.3) sc -= 40;
    } else {
      let rep = 0;
      for (let b = 1; b < bars; b++) if (rb[b] && [1, 2, 4].some(l => b - l >= 0 && rb[b] === rb[b - l])) rep++;
      const iv = line.slice(1).map((n, i) => n.n - line[i].n);
      let run = 1,
        maxRun = 1;
      for (let i = 1; i < iv.length; i++) {
        run =
          iv[i] &&
          iv[i - 1] &&
          Math.abs(iv[i]) <= 2 &&
          Math.abs(iv[i - 1]) <= 2 &&
          Math.sign(iv[i]) === Math.sign(iv[i - 1])
            ? run + 1
            : 1;
        maxRun = Math.max(maxRun, run);
      }
      const shapeOf = b => {
        const xs = line.filter(n => Math.floor(n.s / 16) === b);
        return xs.length > 1
          ? {
              sh: xs
                .slice(1)
                .map((n, i) => n.n - xs[i].n)
                .join(','),
              lo: xs[0].n
            }
          : null;
      };
      let seq = 0;
      for (let b = 1; b < bars; b++) {
        const a = shapeOf(b - 1),
          c = shapeOf(b);
        if (a && c && a.sh === c.sh && c.lo - a.lo >= 1 && c.lo - a.lo <= 4) seq++;
      }
      const sounding = Math.min(1, line.reduce((a, n) => a + Math.min(n.l, 16), 0) / (bars * 16)),
        runBars = rb.filter(x => x && x.split(',').length >= 8).length / bars,
        onBeat = line.filter(n => n.s % 4 === 0).length / N,
        on8 = line.filter(n => n.s % 2 === 0).length / N,
        lens = new Set(line.map(n => Math.min(8, Math.round(n.l)))).size;
      if (bars >= 4 && rep / (bars - 1) < 0.25) sc -= 18;
      if (bars >= 4 && new Set(rb.filter(Boolean)).size <= 1) sc -= 10;
      if (maxRun >= 5) sc -= 12 + 3 * (maxRun - 5);
      if (pcs <= 2) sc -= 15;
      if (on8 === 1 && onBeat > 0.7 && N > 6) sc -= 10;
      if (lens <= 1 && N > 8) sc -= 6;
      if (N / bars > 9) sc -= 12;
      if (runBars > 0.4) sc -= 10;
      if (sounding > 0.95 && N > 12) sc -= 6;
      if (seq >= 2) sc -= 10 + 4 * (seq - 2);
      if (bars >= 4 && line[N - 1].l < 2) sc -= 4;
      if (topShare >= 0.75 && bars >= 4) sc -= 15;
      if (wob >= 2) sc -= 8 + 2 * Math.min(5, wob - 2);
    }
  }
  (f._mq = f._mq || {})[role] = Math.max(0, sc);
  return f._mq[role];
}
