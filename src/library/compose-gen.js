// The composer's generators (library/compose.js uses them): instead of picking from a list, they make
// new material for each take from rules, so the combinations never run out.
//
//   genProg    a chord progression (8 bars) for a colour (minor, major, jazzy, a vamp): chords chosen by
//              how they like to move (a Markov table of the degrees), how long each lasts (one or two bars,
//              four held, a repeat with a new ending), borrowed and sus chords now and then, and an ending
//              that leads back round.
//   genCell    a melody's rhythm in a bar for a lead style (how many notes, how syncopated, how long).
//   genShape   a melody's contour (where it heads over a phrase) and genForm its phrase plan.
//   genBassT   a bassline's rhythm and notes in a bar for a feel (rolling, offbeat, driving, sparse, 808,
//              funk, walking, reggae, pop), as [step, length, interval] with intervals the writer reads
//              (semitones above the root, 'T1'/'T2' chord tones, 'A' an approach to the next chord).
//   genComp    a chord part's rhythm in a bar for a family (stabs or held), as [step, length, velocity].
//   genArp     an arp's order, rate and grouping.
//
// Each takes a random function (the take's), so the same take always comes out the same.
//
// Reads: nothing.
const pick = (r, a) => a[Math.floor(r() * a.length)];
/* a weighted choice from {item: weight} */
function weighted(r, table) {
  const ks = Object.keys(table),
    tot = ks.reduce((a, k) => a + table[k], 0);
  let x = r() * tot;
  for (const k of ks) if ((x -= table[k]) <= 0) return k;
  return ks[ks.length - 1];
}
const asTok = k => (/^\d+$/.test(k) ? +k : k);

/* ---------- progressions ---------- */
/* where each chord likes to go: degrees, 'M' major and 'm' minor where the scale has the other, 'b7' the
   flat seventh borrowed in a major key, 's' a sus4 */
const MOVES = {
  minor: {
    1: { 6: 3, 4: 3, 7: 3, 3: 2, '5M': 1.5, 5: 1, '4M': 0.5, '1s': 0.4 },
    3: { 6: 2, 7: 2, 4: 2, 1: 0.6 },
    4: { 1: 2, '5M': 2, 7: 2, 6: 1, 5: 1, 3: 0.5 },
    5: { 1: 3, 6: 2, 4: 0.6 },
    '5M': { 1: 4, 6: 1 },
    6: { 7: 3, 3: 2, 4: 2, '5M': 1.5, 1: 1 },
    7: { 1: 3, 3: 3, 6: 2, 4: 1 },
    '4M': { 1: 3, 6: 1 },
    '1s': { 1: 3 }
  },
  major: {
    1: { 4: 3, 5: 3, 6: 3, 2: 2, 3: 1, '4m': 0.5, b7: 0.6, '5s': 0.4 },
    2: { 5: 4, 4: 1, b7: 0.3 },
    3: { 6: 3, 4: 2 },
    4: { 1: 3, 5: 3, 2: 1, 6: 1, '4m': 1 },
    5: { 1: 4, 6: 2, 4: 2 },
    6: { 4: 3, 2: 2, 5: 2, 3: 1 },
    '4m': { 1: 3, 5: 0.5 },
    b7: { 1: 2, 4: 2 },
    '5s': { 5: 2, 1: 2 }
  }
};
const START = { minor: { 1: 8, 6: 1, 4: 1 }, major: { 1: 7, 6: 1.5, 4: 1.5 } };
/* how long each chord lasts over 8 bars: which of the chords each bar plays */
const RHYTHMS = [
  /* two bars a chord, listed twice: twice as likely as the others */
  [0, 0, 1, 1, 2, 2, 3, 3],
  [0, 0, 1, 1, 2, 2, 3, 3],
  [0, 1, 2, 3, 0, 1, 2, 4],
  [0, 1, 2, 3, 4, 5, 6, 7],
  [0, 0, 1, 1, 2, 3, 4, 4],
  [0, 0, 0, 0, 1, 1, 2, 2],
  [0, 1, 0, 1, 2, 3, 2, 4],
  [0, 0, 1, 2, 3, 3, 4, 5]
];
/**
 * A progression for a colour ('m' minor, 'M' major, 'j' jazzy, 'v' a vamp), as chord tokens a bar
 * (library/compose.js chordsOf reads them).
 */
export function genProg(r, colour, scale = 'minor') {
  const maj = scale === 'major';
  if (colour === 'v') {
    /* (a major key's seventh chord is diminished: its flat seventh instead) */
    const x = pick(r, maj ? [4, 'b7', 6, '4m', 2] : [7, 4, 6, '4M', 3]),
      y = pick(r, maj ? [4, 'b7', 6, 1] : [7, 4, 6, 1]);
    return pick(r, [
      [1, 1, 1, 1, x, x, 1, 1],
      [1, 1, x, x, 1, 1, y, y],
      [1, 1, 1, 1, 1, 1, x, x],
      [1, x, 1, x, 1, x, 1, y]
    ]);
  }
  /* the jazzy colour follows the key (the coin is still tossed, so the takes stay as they were) */
  colour === 'j' && r();
  const mode = colour === 'M' || (colour === 'j' && maj) ? 'major' : 'minor',
    table = MOVES[mode],
    rhythm = pick(r, RHYTHMS),
    n = Math.max(...rhythm) + 1;
  const start = weighted(r, START[mode]),
    chords = [start];
  for (let i = 1; i < n; i++) {
    const from = table[chords[i - 1]] || table[1],
      opts = { ...from };
    /* no chord straight after itself, and the last one leads back to the first */
    delete opts[chords[i - 1]];
    if (i === n - 1) {
      const back = Object.keys(opts).filter(k => (table[k] || {})[start] || k === '5M' || k === '5');
      if (back.length && r() < 0.8) {
        chords.push(pick(r, back));
        continue;
      }
    }
    chords.push(Object.keys(opts).length ? weighted(r, opts) : '1');
  }
  let out = rhythm.map(i => asTok(chords[i]));
  if (colour === 'j') {
    /* sevenths throughout, a ninth on the home chord, and now and then a ii-V into it */
    out = out.map(t => {
      const x = String(t);
      return x === '1' ? '1-9' : /s$/.test(x) ? x : x + '-7';
    });
    if (r() < 0.5) {
      out[6] = '2-7';
      out[7] = mode === 'minor' ? '5M-7' : '5-7';
    }
  }
  return out;
}

/* ---------- melody ---------- */
/* how a lead style plays: notes in a bar, the steps it can start on (strong ones weigh more), lengths */
const LEADS = {
  song: { n: [3, 6], at: { 0: 4, 2: 1.5, 3: 1, 4: 2.5, 6: 2, 7: 1, 8: 3, 10: 2, 11: 1, 12: 2.5, 14: 1.5 }, hold: 0.5 },
  hard: {
    n: [4, 8],
    at: { 0: 4, 2: 2, 3: 2, 4: 2, 6: 2.5, 7: 1.5, 8: 3, 10: 2.5, 11: 1.5, 12: 2, 14: 2, 15: 1 },
    hold: 0.25
  },
  trance: {
    n: [6, 11],
    at: { 0: 3, 1: 1, 2: 2, 3: 1.5, 4: 2, 5: 1, 6: 2, 7: 1.5, 8: 3, 9: 1, 10: 2, 11: 1.5, 12: 2, 13: 1, 14: 2, 15: 1 },
    hold: 0.1
  },
  trap: { n: [2, 6], at: { 0: 3, 3: 2, 6: 2.5, 7: 1, 8: 2, 10: 2, 11: 1.5, 12: 1.5, 14: 2 }, hold: 0.4 },
  whine: { n: [2, 4], at: { 0: 4, 4: 2, 6: 1.5, 8: 3, 12: 2, 14: 1 }, hold: 0.8 },
  sparse: { n: [1, 3], at: { 0: 4, 4: 1, 6: 1, 8: 2.5, 10: 1, 12: 1 }, hold: 0.9 }
};
/** A melody's rhythm in a bar: [[step, length]] for a lead style. */
export function genCell(r, lead) {
  const L = LEADS[lead] || LEADS.song,
    want = L.n[0] + Math.floor(r() * (L.n[1] - L.n[0] + 1)),
    pool = { ...L.at },
    at = [];
  /* a pickup now and then: the first note off the downbeat */
  if (r() < 0.3) delete pool[0];
  while (at.length < want && Object.keys(pool).length) {
    const s = +weighted(r, pool);
    delete pool[s];
    at.push(s);
  }
  at.sort((a, b) => a - b);
  return at.map((s, i) => {
    const gap = (i + 1 < at.length ? at[i + 1] : 16) - s;
    return [s, r() < L.hold ? gap : Math.max(1, Math.min(gap, pick(r, [1, 2, 2, 3])))];
  });
}
/** A melody's contour over a phrase: where each note heads, in scale steps from the centre. */
export function genShape(r) {
  const len = 6,
    kind = pick(r, ['arch', 'rise', 'fall', 'wave', 'walk', 'valley']);
  return Array.from({ length: len }, (_, i) => {
    const x = i / (len - 1);
    const y =
      kind === 'arch'
        ? Math.sin(x * Math.PI) * 4
        : kind === 'rise'
          ? x * 5 - 1
          : kind === 'fall'
            ? 4 - x * 5
            : kind === 'wave'
              ? Math.sin(x * Math.PI * 2) * 2.5 + 1
              : kind === 'valley'
                ? 3 - Math.sin(x * Math.PI) * 4
                : 0;
    return Math.round(y + (kind === 'walk' ? (r() - 0.5) * 6 : (r() - 0.5) * 1.5));
  });
}
/** The phrase plan over 8 bars (four 2-bar phrases): which cell each uses ('A', 'B' or 'C'). */
export const genForm = r =>
  pick(r, [
    ['A', 'A', 'B', 'A'],
    ['A', 'B', 'A', 'B'],
    ['A', 'A', 'B', 'C'],
    ['A', 'B', 'A', 'C'],
    ['A', 'A', 'A', 'B']
  ]);

/* ---------- bass ---------- */
/** The feel of a style's bass writer, for the generated basslines (null: keep the style's own). */
export const BASS_FEEL = {
  dnb: 'roll',
  dnbLiquid: 'roll',
  dnbJungle: 'roll',
  dnbJump: 'roll',
  wobble: 'sparse',
  riddim: 'sparse',
  house: 'off',
  garage: 'off',
  techhouse: 'off',
  rumble: 'drive',
  trance: 'drive',
  acid: 'drive',
  synth: 'funk',
  disco: 'funk',
  funk: 'funk',
  afro: 'funk',
  boombap: 'sparse',
  walk: 'walk',
  eight08: '808',
  reggae: 'reggae',
  dembow: 'reggae',
  pop: 'pop',
  drone: null
};
/* where a feel's notes go: steps it plays, steps it may add */
const FEELS = {
  roll: { must: [0], may: { 3: 2, 6: 2.5, 7: 1.5, 10: 2.5, 11: 1, 13: 1, 14: 2 }, n: [3, 6], legato: 0.6 },
  off: { must: [2, 10], may: { 6: 3, 14: 2.5, 3: 1, 7: 1, 11: 1, 13: 1, 15: 1, 0: 0.5 }, n: [3, 6], legato: 0.1 },
  drive: {
    must: [],
    may: { 1: 1, 2: 3, 3: 2, 5: 1, 6: 3, 7: 2, 9: 1, 10: 3, 11: 2, 13: 1, 14: 3, 15: 2 },
    n: [5, 11],
    legato: 0
  },
  sparse: { must: [0], may: { 3: 1.5, 6: 1, 7: 2, 10: 2, 11: 1, 14: 1.5 }, n: [2, 4], legato: 0.9 },
  808: { must: [0], may: { 3: 1, 6: 2, 7: 1.5, 10: 2, 11: 1.5, 14: 1 }, n: [1, 4], legato: 1 },
  funk: {
    must: [0],
    may: { 2: 1.5, 3: 2, 5: 1, 6: 2, 7: 2, 8: 1.5, 10: 2, 11: 1.5, 12: 1, 13: 1, 14: 2, 15: 1 },
    n: [5, 9],
    legato: 0.2
  },
  reggae: { must: [], may: { 2: 2, 3: 2, 4: 1, 6: 2.5, 8: 2, 10: 2, 11: 1.5, 12: 1, 14: 1.5 }, n: [3, 6], legato: 0.5 },
  pop: { must: [0, 8], may: { 2: 1, 4: 2, 6: 2, 10: 2, 11: 1, 12: 2, 14: 2 }, n: [3, 7], legato: 0.4 }
};
/**
 * A bassline's bar for a feel: [[step, length, interval]] (interval: semitones above the root, 'T1'/'T2'
 * a chord tone, 'A' an approach to the next chord). Walking bass: four notes, the last an approach.
 */
export function genBassT(r, feel) {
  if (feel === 'walk') {
    const w = [
      [0, 4, 0],
      [4, 4, pick(r, ['T1', 'T2', 12, 2])],
      [8, 4, pick(r, ['T2', 'T1', 7, 5])],
      [12, 4, 'A']
    ];
    /* a skip now and then: a ghost note in an 8th before a beat, or the second beat left as a rest */
    const x = r();
    if (x < 0.3) {
      const at = pick(r, [3, 7, 11]);
      w.find(y => y[0] === at - 3)[1] = 3;
      w.push([at, 1, pick(r, [0, 12, 'T2'])]);
    } else if (x < 0.45) w.splice(1, 1);
    else if (x < 0.6) ((w[3] = [12, 2, 'T2']), w.push([14, 2, 'A']));
    return w.sort((a, b) => a[0] - b[0]);
  }
  const F = FEELS[feel] || FEELS.pop,
    want = F.n[0] + Math.floor(r() * (F.n[1] - F.n[0] + 1)),
    pool = { ...F.may },
    at = [...F.must];
  for (const s of at) delete pool[s];
  while (at.length < want && Object.keys(pool).length) {
    const s = +weighted(r, pool);
    delete pool[s];
    at.push(s);
  }
  at.sort((a, b) => a - b);
  /* the notes: the root on the downbeats, octaves, fifths and chord tones between; the last one of the
     bar sometimes walks into the next chord */
  const oct = feel === '808' ? 0.15 : feel === 'funk' || feel === 'drive' ? 0.45 : 0.3,
    approach = r() < 0.5;
  return at.map((s, i) => {
    const gap = (i + 1 < at.length ? at[i + 1] : 16) - s,
      len = r() < F.legato ? gap : Math.max(1, Math.min(gap, pick(r, [1, 1, 2]))),
      last = i === at.length - 1 && s >= 12;
    let iv = 0;
    if (last && approach) iv = 'A';
    else if (s % 8 !== 0) {
      const x = r();
      iv = x < oct ? 12 : x < oct + 0.15 ? 'T2' : x < oct + 0.22 ? 'T1' : 0;
    }
    return [s, len, iv];
  });
}
/** A bassline bar changed a little (Main B from Main): a hit added or moved, an octave turned. */
export function mutateBassT(r, bar) {
  const out = bar.map(x => [...x]),
    taken = new Set(out.map(x => x[0]));
  /* (nothing after a note that walks into the next chord) */
  const free = [3, 6, 7, 10, 11, 13, 14, 15].filter(s => !taken.has(s) && !out.some(x => x[2] === 'A' && x[0] < s));
  if (free.length && r() < 0.7) {
    const s = pick(r, free),
      i = out.findIndex(x => x[0] > s),
      prev = out[(i < 0 ? out.length : i) - 1];
    if (prev && prev[0] + prev[1] > s) prev[1] = Math.max(1, s - prev[0]);
    out.push([s, 1, r() < 0.5 ? 12 : 0]);
  }
  for (const x of out) if (x[0] % 8 && typeof x[2] === 'number' && r() < 0.3) x[2] = x[2] ? 0 : 12;
  return out.sort((a, b) => a[0] - b[0]);
}

/* ---------- chords ---------- */
const COMP = {
  four: { 2: 3, 6: 2.5, 10: 3, 14: 2, 3: 1, 7: 1, 11: 1, 0: 1, 12: 1 },
  dnb: { 0: 3, 6: 2, 10: 2.5, 3: 1.5, 14: 1.5, 8: 1 },
  hh: { 0: 3, 3: 1.5, 6: 2, 8: 1.5, 11: 1.5, 14: 1.5, 4: 1 },
  song: { 0: 3, 4: 2, 8: 2.5, 12: 2, 6: 1.5, 10: 1.5, 14: 1, 2: 1 }
};
/** A chord part's bar: [[step, length, velocity]], stabs or held, for a family's comping. */
export function genComp(r, fam) {
  const pool = { ...(COMP[fam] || COMP.song) },
    held = r() < 0.35,
    want = held ? 1 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4),
    at = [];
  while (at.length < want && Object.keys(pool).length) {
    const s = +weighted(r, pool);
    delete pool[s];
    at.push(s);
  }
  at.sort((a, b) => a - b);
  if (held && at[0] !== 0 && r() < 0.6) at.unshift(0);
  return at.map((s, i) => {
    const gap = (i + 1 < at.length ? at[i + 1] : 16) - s;
    return [s, held ? gap : Math.max(1, Math.min(gap, pick(r, [1, 2, 2, 3]))), s % 4 === 0 ? 100 : 90];
  });
}

/* ---------- arps ---------- */
/** An arp's way: order ('up', 'down', 'updown', 'broken', 'pedal', 'random'), rate (1 a 16th, 2 an 8th),
 * span (octaves) and a gap mask (steps left out of each 8). */
export function genArp(r) {
  return {
    order: pick(r, ['up', 'down', 'updown', 'broken', 'pedal', 'random', 'up', 'updown']),
    rate: r() < 0.7 ? 1 : 2,
    span: r() < 0.6 ? 1 : 2,
    gaps: pick(r, [[], [], [], [3, 7], [2, 5], [7], [1, 4, 6]])
  };
}
