// Mood: how a pattern feels, on two scales, so Live Mode and the song wizard can lean a whole set
// towards angry, euphoric, chill or melancholy without leaving the genre.
//   intensity  calm (0) to intense (1): how many hits, how hard, how short and how syncopated
//   colour     dark (0) to bright (1): the scale, clashing intervals, the register, and words in the name
// Patterns are ranked against the others they are picked from (the style's own pool), so a calm
// dubstep kit counts as calm for dubstep and every style spreads from calm to intense. With the mood
// off, nothing is narrowed and the picks are as before.
//
// Reads: nothing.

/** The named moods: intensity and colour, 0-100. */
export const MOODS = [
  ['angry', 'Angry', 95, 8],
  ['dark', 'Dark', 62, 12],
  ['driving', 'Driving', 82, 50],
  ['euphoric', 'Euphoric', 88, 92],
  ['uplifting', 'Uplifting', 62, 80],
  ['chill', 'Chill', 18, 68],
  ['dreamy', 'Dreamy', 8, 88],
  ['melancholy', 'Melancholy', 22, 14]
];
export const moodName = m => {
  if (!m) return 'Off';
  const near = MOODS.find(x => x[2] === m.i && x[3] === m.c);
  return near ? near[1] : 'Custom';
};

const BRIGHT = {
  major: 1,
  lydian: 1,
  'major pent': 0.9,
  mixolydian: 0.75,
  dorian: 0.55,
  minor: 0.3,
  'minor pent': 0.32,
  blues: 0.3,
  'harmonic minor': 0.15,
  phrygian: 0.05,
  chromatic: 0.1
};
const DARK_WORDS =
  /\b(dark|horror|menace|evil|doom|grim|sinister|heavy|growl|gritty|ominous|metal|tension|phrygian|minor 2nd|neapolitan|lament)/i;
const BRIGHT_WORDS = /\b(bright|heaven|dream|shimmer|lift|lydian|uplift|euphor|sun|glow|happy|sweet|major|picardy)/i;

/* raw scores, before ranking */
function rawIntensity(f) {
  const n = f.notes,
    bars = Math.max(1, f.bars);
  if (!n.length) return 0;
  const vel = n.reduce((a, x) => a + x.v, 0) / n.length / 127,
    off = n.filter(x => x.s % 2 !== 0).length / n.length;
  if (f.type === 'drum') {
    const loud = n.filter(x => x.v >= 70),
      kicks = n.filter(x => x.n === 0).length / bars,
      fast = n.filter(x => x.s % 1 !== 0).length / bars;
    return (
      Math.min(1, loud.length / bars / 26) * 0.35 +
      vel * 0.25 +
      Math.min(1, kicks / 6) * 0.2 +
      off * 0.1 +
      Math.min(1, fast / 6) * 0.1
    );
  }
  const onsets = new Set(n.map(x => x.s)).size / bars,
    short = n.filter(x => x.l <= 1).length / n.length;
  return Math.min(1, onsets / 12) * 0.4 + vel * 0.25 + short * 0.2 + off * 0.15;
}
function rawColour(f) {
  if (f.type === 'drum') return 0.5;
  const n = f.notes;
  let c = BRIGHT[(f.key && f.key.scale) || 'minor'] ?? 0.3;
  /* clashing intervals sounding together: minor seconds and tritones darken */
  let clash = 0,
    pairs = 0;
  const byS = new Map();
  n.forEach(x => (byS.has(x.s) ? byS.get(x.s).push(x.n) : byS.set(x.s, [x.n])));
  for (const v of byS.values())
    for (let i = 0; i < v.length; i++)
      for (let j = i + 1; j < v.length; j++) {
        const d = Math.abs(v[i] - v[j]) % 12;
        pairs++;
        if (d === 1 || d === 6 || d === 11) clash++;
      }
  if (pairs) c -= (clash / pairs) * 0.6;
  const avg = n.reduce((a, x) => a + x.n, 0) / Math.max(1, n.length);
  c += Math.max(-0.15, Math.min(0.15, (avg - 60) / 80));
  if (DARK_WORDS.test(f.name)) c -= 0.25;
  if (BRIGHT_WORDS.test(f.name)) c += 0.25;
  return c;
}
/** A pattern's raw mood: { i: intensity, c: colour } (cached on the pattern). */
export function moodOf(f) {
  return f._mood || (f._mood = { i: rawIntensity(f), c: rawColour(f) });
}
/* ranks 0-1 inside the list being picked from */
function ranks(fs, k) {
  const order = fs.map((f, j) => [j, f ? moodOf(f)[k] : 0]).sort((a, b) => a[1] - b[1]),
    out = new Float64Array(fs.length);
  order.forEach(([j], idx) => (out[j] = order.length > 1 ? idx / (order.length - 1) : 0.5));
  return out;
}

/**
 * Keep the patterns that suit a mood, in their original order (so the shuffles stay as they were).
 * Each pattern is ranked against the others in the list (the style's own pool), so a chill trap set gets
 * the calmest trap kits. The further the mood is from the middle, the fewer are kept. Drums are judged
 * on intensity only.
 * @param {string[]} ids
 * @param {{i:number,c:number}|null} mood  0-100 each, or null for off
 * @param {(id:string)=>object} get        the id lookup
 */
export function moodFilter(ids, mood, get) {
  if (!mood || ids.length < 5) return ids;
  const ti = mood.i / 100,
    tc = mood.c / 100,
    si = Math.abs(ti - 0.5) * 2,
    sc = Math.abs(tc - 0.5) * 2;
  if (si < 0.1 && sc < 0.1) return ids;
  const fs = ids.map(id => {
      const f = get(id);
      return f && f.notes && f.notes.length ? f : null;
    }),
    ri = ranks(fs, 'i'),
    rc = ranks(fs, 'c');
  const score = fs.map((f, j) => {
    if (!f) return -9;
    const drum = f.type === 'drum',
      w = drum ? si : si + sc;
    return w ? -(si * Math.abs(ri[j] - ti) + (drum ? 0 : sc * Math.abs(rc[j] - tc))) / w : 0;
  });
  const keep = Math.max(3, Math.round(ids.length * (1 - 0.8 * Math.max(si, sc)))),
    cut = score.slice().sort((a, b) => b - a)[Math.min(keep, score.length) - 1];
  return ids.filter((id, j) => score[j] >= cut);
}
