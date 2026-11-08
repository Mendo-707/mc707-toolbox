// The composer: writes a whole song for a style, every part from one chord progression and an energy
// plan, the way a producer would rather than by picking library patterns. The song's form comes from its
// family (drum and bass, dance, hip hop, songs) and grows to the length asked for; each section kind
// (intro, groove, build, drop, switch, break, verse, pre, chorus, bridge, outro) says which parts play and
// how hard. Each part is written for its job: drums from the style's groove grammar (with fills at the
// phrase ends, a halftime switch, builds that speed up and stop dead a beat before the drop), the bass
// locked to the kick and leaving room for the fills, chords in the style's rhythm, voice-led pads, a hook
// built from a motif (stated, answered, developed, resolved), arps and risers, crashes and rolls. A part
// changes from drop to drop (a new bass, a busier beat) so the song goes somewhere. It also names a
// factory sound for every part (scene/compose.js gives them to the clips when asked).
//
// Plain data in, plain data out: compose(style, opts) → {bpm, swing, key, scale, sections, patterns,
// sounds}. One step is a 16th; drum notes are lanes (core/theory.js LANES). Seeded, so a song comes out
// the same every time for the same choices.
//
// Reads: nothing.
import { hashStr, mulberry } from '../core/random.js';
import { SCALES } from '../core/theory.js';
import {
  BASS_FEEL,
  genArp,
  genBassT,
  genCell,
  genComp,
  genForm,
  genProg,
  genShape,
  mutateBassT
} from './compose-gen.js';

/* drum lanes */
const K = 0,
  RIM = 1,
  SN = 2,
  CL = 3,
  CH = 4,
  OH = 5,
  LT = 6,
  MT = 7,
  HT = 8,
  CR = 9,
  RD = 10,
  PC = 11;

/* ---------------------------------------------------------------- styles ----
   Each style: its groove grammar, bass, chord and lead writers, the progressions it likes, its form
   (family) and its sounds. Styles not listed fall back to their family. */
const R = (gr, bass, chords, lead, progs, sound, extra = {}) => ({ gr, bass, chords, lead, progs, sound, ...extra });
const RECIPES = {
  liquid: R('dnb', 'dnbLiquid', 'keys', 'song', ['m1', 'm4', 'm3'], 'liquid', { form: 'dnb' }),
  neuro: R('dnb', 'dnb', 'stab', 'hard', ['m1', 'm7', 'm6'], 'neuro', { form: 'dnb' }),
  jungle: R('jungle', 'dnbJungle', 'stab', 'song', ['m4', 'm2', 'm1'], 'jungle', { form: 'dnb' }),
  jumpup: R('dnb', 'dnbJump', 'stab', 'hard', ['m6', 'm1'], 'jumpup', { form: 'dnb' }),
  halftime: R('dnbHalf', 'wobble', 'stab', 'hard', ['m6', 'm7'], 'neuro', { form: 'dnb' }),

  boombap: R('boombap', 'boombap', 'keys', 'song', ['m5', 'm3', 'm8'], 'boombap', { form: 'hh' }),
  trap: R('trap', 'eight08', 'keys', 'trap', ['m5', 'm6', 'm2'], 'trap', { form: 'hh' }),
  lofi: R('lofi', 'walk', 'jazz', 'song', ['j1', 'j2', 'm8'], 'lofi', { form: 'hh', ext: 7 }),
  gfunk: R('boombap', 'funk', 'keys', 'whine', ['M6', 'm8'], 'gfunk', { form: 'hh', ext: 7 }),
  drill: R('drill', 'eight08', 'keys', 'trap', ['m6', 'm5'], 'drill', { form: 'hh' }),
  neosoul: R('lofi', 'walk', 'jazz', 'song', ['j1', 'j2', 'j3'], 'neosoul', { form: 'hh', ext: 9 }),
  memphis: R('trap', 'eight08', 'keys', 'trap', ['m5', 'm6'], 'phonk', { form: 'hh' }),
  phonk: R('phonk', 'eight08', 'keys', 'trap', ['m5', 'm6'], 'phonk', { form: 'hh' }),

  deephouse: R('house', 'house', 'house', 'song', ['m8', 'j1', 'm3'], 'deephouse', { form: 'edm', ext: 7 }),
  classichouse: R('house', 'house', 'house', 'song', ['M1', 'M2', 'm3'], 'house', { form: 'edm', ext: 7 }),
  techhouse: R('techhouse', 'techhouse', 'stab', 'hard', ['v1', 'm5'], 'techhouse', { form: 'edm' }),
  afrohouse: R('afro', 'house', 'house', 'song', ['m3', 'm8'], 'afrohouse', { form: 'edm' }),
  techno: R('techno', 'rumble', 'stab', 'hard', ['v1', 'v2'], 'techno', { form: 'edm' }),
  minimal: R('minimal', 'techhouse', 'stab', 'hard', ['v1', 'v2'], 'techno', { form: 'edm' }),
  acidtechno: R('techno', 'acid', 'stab', 'hard', ['v1', 'v2'], 'acid', { form: 'edm', acid: true }),
  ukgarage: R('garage', 'garage', 'garage', 'song', ['m8', 'j1', 'm3'], 'garage', { form: 'edm', ext: 7 }),
  speedgarage: R('garage', 'garage', 'stab', 'hard', ['m5', 'm6'], 'garage', { form: 'edm' }),
  dubstep: R('dubstep', 'wobble', 'hit', 'hard', ['m6', 'm7', 'm5'], 'dubstep', { form: 'edm' }),
  riddim: R('dubstep', 'riddim', 'hit', 'hard', ['v2', 'm6'], 'dubstep', { form: 'edm' }),
  trance: R('trance', 'trance', 'long', 'trance', ['m4', 'm2', 'm3'], 'trance', { form: 'edm' }),
  progtrance: R('trance', 'trance', 'long', 'trance', ['m3', 'm2'], 'trance', { form: 'edm' }),
  electro: R('electro', 'synth', 'stab', 'hard', ['m5', 'm6'], 'electro', { form: 'edm' }),
  breakbeat: R('breaks', 'synth', 'stab', 'hard', ['m5', 'm1'], 'bigbeat', { form: 'edm' }),
  bigbeat: R('breaks', 'synth', 'stab', 'hard', ['m5', 'm6'], 'bigbeat', { form: 'edm' }),

  funk: R('funk', 'funk', 'comp', 'song', ['v3', 'M6'], 'funk', { form: 'song', ext: 7 }),
  disco: R('disco', 'disco', 'comp', 'song', ['M1', 'm3'], 'disco', { form: 'song', ext: 7 }),
  nudisco: R('disco', 'disco', 'house', 'song', ['m3', 'M2'], 'disco', { form: 'song', ext: 7 }),
  reggae: R('reggae', 'reggae', 'skank', 'song', ['M3', 'm5'], 'reggae', { form: 'song' }),
  dub: R('reggae', 'reggae', 'skank', 'sparse', ['m5', 'v2'], 'dub', { form: 'song' }),
  dancehall: R('dembow', 'dembow', 'skank', 'song', ['m5', 'm3'], 'dancehall', { form: 'song' }),
  reggaeton: R('dembow', 'dembow', 'dembowCh', 'song', ['m3', 'M1'], 'reggaeton', { form: 'song' }),
  afrobeats: R('afro', 'afro', 'pluckCh', 'song', ['M1', 'M2', 'm3'], 'afrobeats', { form: 'song', ext: 7 }),
  synthwave: R('synth', 'synth', 'long', 'song', ['m3', 'm2', 'm4'], 'synthwave', { form: 'song' }),
  pop: R('pop', 'pop', 'pop', 'song', ['M1', 'M2', 'M4'], 'pop', { form: 'song' }),
  indie: R('pop', 'pop', 'pop', 'song', ['M4', 'M5', 'm3'], 'indie', { form: 'song' }),
  ambient: R('ambient', 'drone', 'long', 'sparse', ['M5', 'm3', 'M2'], 'ambient', { form: 'song', ext: 9 }),
  cinematic: R('cinematic', 'drone', 'long', 'sparse', ['m2', 'm1', 'm3'], 'cinematic', { form: 'song' })
};
const FAM_DEFAULT = {
  dnb: 'neuro',
  hh: 'boombap',
  edm: 'deephouse',
  song: 'pop'
};
/** The recipe for a style (its own, or its family's). */
export function recipeOf(style) {
  return RECIPES[style.id] || RECIPES[FAM_DEFAULT[style.fam]] || RECIPES.pop;
}
/** The styles the composer has its own recipe for. */
export const COMPOSE_STYLES = Object.keys(RECIPES);

/* ---------------------------------------------------------- progressions ----
   Eight bars, one chord a bar, as scale degrees (1-7) of the song's scale; a trailing 'M' makes a
   minor-key chord major (the dominant), '7'/'9' add sevenths and ninths. m: minor keys, M: major,
   j: jazzy (sevenths throughout), v: vamps for techno and funk. */
const PROGS = {
  m1: [1, 1, 6, 6, 4, 4, '5M', '5M'],
  m2: [1, 1, 7, 7, 6, 6, 7, 7],
  m3: [1, 1, 6, 6, 3, 3, 7, 7],
  m4: [1, 1, 4, 4, 7, 7, 3, 3],
  m5: [1, 1, 1, 1, 6, 6, '5M', '5M'],
  m6: [1, 1, 1, 1, 2, 2, 1, 1],
  m7: [1, 1, 6, 6, 1, 1, 7, 7],
  m8: [1, 4, 1, 4, 6, 4, 1, 7],
  j1: ['2-7', '5-7', '1-9', '1-9', '2-7', '5-7', '6-7', '6-7'],
  j2: ['4-7', '4-7', '3-7', '3-7', '2-7', '2-7', '1-9', '1-9'],
  j3: ['1-9', '1-9', '4-9', '4-9', '3-7', '6-7', '2-7', '5-7'],
  M1: [1, 1, 5, 5, 6, 6, 4, 4],
  M2: [6, 6, 4, 4, 1, 1, 5, 5],
  M3: [1, 1, 4, 4, 1, 1, 5, 5],
  M4: [4, 4, 1, 1, 5, 5, 6, 6],
  M5: [1, 1, 4, 4, 6, 6, 4, 4],
  M6: ['1-7', '1-7', '4-7', '4-7', '1-7', '1-7', '5-7', '4-7'],
  v1: [1, 1, 1, 1, 1, 1, 1, 1],
  v2: [1, 1, 1, 1, 7, 7, 1, 1],
  v3: ['1-7', '1-7', '1-7', '1-7', '4-7', '4-7', '1-7', '1-7']
};
/* the scale a progression wants (a minor-key style asked for a major progression keeps its own) */
const progScale = (id, scale) => (id[0] === 'M' ? 'major' : id[0] === 'j' && scale === 'major' ? 'major' : 'minor');

/* a chord token: a degree, 'M'/'m' a major or minor chord where the scale has the other, 's' a sus4, a
   'b' before it the degree a semitone down (a major chord: the flat seventh in a major key), '-7'/'-9'
   sevenths and ninths. prog is a PROGS id or a list of tokens (a generated progression). */
function chordsOf(prog, key, scale, extAll = 0) {
  const sc = SCALES[scale] || SCALES.minor;
  return (Array.isArray(prog) ? prog : PROGS[prog]).map(d => {
    const s = String(d),
      flat = s[0] === 'b',
      deg = parseInt(flat ? s.slice(1) : s, 10) - 1,
      major = s.includes('M') || flat,
      minor = /\dm/.test(s),
      sus = /\ds/.test(s),
      ext = Math.max(s.includes('-9') ? 9 : s.includes('-7') ? 7 : 0, major || sus ? 0 : extAll);
    const at = i => sc[(deg + i) % 7] + 12 * Math.floor((deg + i) / 7) - sc[deg];
    const tones = [0, at(2), at(4)];
    if (major) tones.splice(1, 2, 4, 7);
    if (minor) tones.splice(1, 2, 3, 7);
    if (sus) tones[1] = 5;
    if (ext >= 7) tones.push(flat ? 10 : at(6));
    if (ext >= 9) tones.push(at(8));
    return { root: (key + sc[deg] - (flat ? 1 : 0) + 12) % 12, tones, deg: deg + 1 };
  });
}

/* ------------------------------------------------------------------ forms ----
   head, a block that repeats to fill the length, then a tail. Each entry: [kind, bars, name]. */
const FORMS = {
  dnb: {
    head: [
      ['intro', 16, 'Intro'],
      ['groove', 16, 'Intro Beat'],
      ['build', 8, 'Build'],
      ['drop', 16, 'Drop'],
      ['drop', 16, 'Drop'],
      ['drop', 16, 'Drop'],
      ['switch', 8, 'Switch']
    ],
    block: [
      ['break', 16, 'Breakdown'],
      ['build', 8, 'Build'],
      ['drop', 16, 'Drop'],
      ['drop', 16, 'Drop'],
      ['switch', 8, 'Switch']
    ],
    tail: [
      ['outro', 16, 'Outro'],
      ['end', 8, 'End']
    ]
  },
  edm: {
    head: [
      ['intro', 16, 'Intro'],
      ['groove', 16, 'Groove'],
      ['build', 8, 'Build'],
      ['drop', 16, 'Drop'],
      ['drop', 16, 'Drop']
    ],
    block: [
      ['break', 16, 'Breakdown'],
      ['build', 8, 'Build'],
      ['drop', 16, 'Drop'],
      ['drop', 16, 'Drop']
    ],
    tail: [
      ['outro', 16, 'Outro'],
      ['end', 8, 'End']
    ]
  },
  hh: {
    head: [
      ['intro', 8, 'Intro'],
      ['verse', 16, 'Verse'],
      ['chorus', 8, 'Hook']
    ],
    block: [
      ['verse', 16, 'Verse'],
      ['chorus', 8, 'Hook']
    ],
    bridge: ['bridge', 8, 'Bridge'],
    tail: [
      ['chorus', 8, 'Hook'],
      ['outro', 8, 'Outro']
    ]
  },
  song: {
    head: [
      ['intro', 8, 'Intro'],
      ['verse', 16, 'Verse'],
      ['pre', 8, 'Pre-chorus'],
      ['chorus', 16, 'Chorus']
    ],
    block: [
      ['verse', 16, 'Verse'],
      ['pre', 8, 'Pre-chorus'],
      ['chorus', 16, 'Chorus']
    ],
    bridge: ['bridge', 8, 'Bridge'],
    tail: [
      ['chorus', 16, 'Chorus'],
      ['outro', 8, 'Outro']
    ]
  }
};
/** The sections for a family and length (bars), each {kind, bars, name, n: its count of that kind}. */
export function formOf(fam, target) {
  const F = FORMS[fam] || FORMS.song,
    sum = a => a.reduce((s, x) => s + x[1], 0),
    fixed = sum(F.head) + sum(F.tail) + (F.bridge ? F.bridge[1] : 0);
  const n = Math.max(0, Math.round((target - fixed) / sum(F.block)));
  let list = [...F.head];
  for (let i = 0; i < n; i++) list.push(...F.block);
  if (F.bridge) list.push(F.bridge);
  list.push(...F.tail);
  /* lengthen the last drops or choruses by 8 bars at a time to come near the length */
  let over = target - sum(list);
  for (let i = list.length - 1; i >= 0 && over >= 8; i--)
    if (/drop|chorus/.test(list[i][0]) && list[i][1] < 32) {
      list[i] = [list[i][0], list[i][1] + 8, list[i][2]];
      over -= 8;
    }
  const count = {};
  return list.map(([kind, bars, name]) => {
    count[kind] = (count[kind] || 0) + 1;
    return { kind, bars, name, n: count[kind] };
  });
}

/* --------------------------------------------------------- section parts ----
   Which variant of each part plays in a section. Drops and choruses move through A, B and C so the song
   keeps changing; the last block's drops are the final ones. */
function partsOf(sec, i, all, fam, recipe) {
  const drops = all.filter(s => s.kind === sec.kind).length,
    last = sec.n === drops,
    lastTwo = sec.n >= drops - 1;
  const v = ['A', 'B', 'C'][(sec.n - 1) % 3];
  const hard = fam === 'dnb' || fam === 'edm';
  switch (sec.kind) {
    case 'intro':
      return { pad: 'intro', pluck: 'intro', bass: fam === 'dnb' ? 'intro' : null, perc: 'intro' };
    case 'groove':
      return {
        kit: 'intro',
        hats: 'intro',
        bass: 'intro',
        pad: 'intro',
        pluck: 'intro',
        chords: fam === 'edm' ? 'intro' : null
      };
    case 'build':
      return {
        kit: 'build',
        perc: 'build',
        bass: 'build',
        pad: 'intro',
        pluck: 'rise',
        chords: fam === 'edm' ? 'intro' : null
      };
    case 'drop': {
      const p = { kit: v, hats: v, perc: 'drop', bass: v, chords: v === 'C' ? 'B' : v };
      if (sec.n % 3 === 2 || lastTwo) p.pluck = 'drop';
      if (sec.n > 3 || lastTwo) p.lead = 'hook';
      if (fam === 'edm' && sec.n % 2 === 0) p.pad = 'drop';
      if (recipe.acid) p.acid = v;
      if (last && all.length > 12) p.lead = 'hook';
      return p;
    }
    case 'switch':
      return { kit: 'half', hats: 'half', perc: 'drop', bass: 'half', chords: 'B', lead: sec.n > 1 ? 'hook' : null };
    case 'break':
      return { pad: 'break', lead: 'break', pluck: 'break', bass: 'intro', hats: sec.n > 1 ? 'intro' : null };
    case 'verse':
      return {
        kit: sec.n > 1 ? 'B' : 'A',
        hats: 'A',
        perc: 'verse',
        bass: 'A',
        chords: 'A',
        lead: 'verse',
        pad: fam === 'hh' ? null : sec.n > 1 ? 'drop' : null,
        acid: recipe.acid ? 'A' : null
      };
    case 'pre':
      return { kit: 'A', hats: 'B', perc: 'pre', bass: 'A', chords: 'B', pad: 'break', pluck: 'rise' };
    case 'chorus':
      return {
        kit: hard ? 'C' : 'B',
        hats: 'B',
        perc: 'drop',
        bass: 'B',
        chords: 'B',
        pad: 'drop',
        lead: 'hook',
        pluck: sec.n > 1 || fam === 'song' ? 'drop' : null,
        acid: recipe.acid ? 'B' : null
      };
    case 'bridge':
      return {
        kit: 'half',
        hats: 'intro',
        bass: 'intro',
        chords: 'intro',
        pad: 'break',
        lead: 'break',
        pluck: 'break'
      };
    case 'outro':
      return {
        kit: 'outro',
        hats: 'intro',
        bass: 'intro',
        pad: 'intro',
        pluck: 'intro',
        chords: fam === 'dnb' ? null : 'intro'
      };
    case 'end':
      return { pad: 'intro', pluck: 'intro' };
  }
  return {};
}
const NAMES = {
  intro: 'Intro',
  A: 'Main',
  B: 'Main B',
  C: 'Main C',
  half: 'Halftime',
  build: 'Build',
  rise: 'Riser',
  drop: 'Drop',
  hook: 'Hook',
  break: 'Break',
  verse: 'Verse',
  pre: 'Pre',
  outro: 'Outro'
};

/* ------------------------------------------------------------ the writer ---- */
class Pat {
  constructor(bars) {
    this.bars = bars;
    this.notes = [];
  }
  add(bar, s, len, n, v) {
    const at = bar * 16 + s;
    if (at < 0 || at >= this.bars * 16 || n == null) return this;
    for (const x of Array.isArray(n) ? n : [n])
      this.notes.push({
        s: at,
        l: Math.max(1, Math.min(len, this.bars * 16 - at)),
        n: Math.max(0, Math.min(127, Math.round(x))),
        v: Math.max(1, Math.min(127, Math.round(v)))
      });
    return this;
  }
}
/* a velocity with a little life */
const hum = (r, v, d = 6) => v + Math.round((r() - 0.5) * 2 * d);

/* ---------- drums ---------- */
function fillBar(p, r, b, kind, from = 8, v0 = 72) {
  const toms = [HT, HT, MT, MT, LT, LT, LT, K];
  for (let s = from; s < 16; s++) {
    const i = s - from,
      v = v0 + ((127 - v0) * i) / Math.max(1, 15 - from);
    if (kind === 'toms') p.add(b, s, 1, toms[Math.min(7, Math.floor((i * 8) / (16 - from)))], v);
    else if (kind === 'mix') p.add(b, s, 1, i % 3 === 2 ? MT : SN, v);
    else p.add(b, s, 1, SN, v);
  }
}
/* the grammars: kit, hats and perc for a variant; nb bars */
const GR = {};
const twoStep = (p, r, b, v, extra = [], ghosts = true) => {
  p.add(b, 0, 1, K, hum(r, v)).add(b, 10, 1, K, hum(r, v - 8));
  for (const s of extra) p.add(b, s, 1, K, hum(r, v - 18));
  p.add(b, 4, 1, SN, hum(r, v + 6, 3)).add(b, 12, 1, SN, hum(r, v + 6, 3));
  if (ghosts) p.add(b, 7, 1, SN, hum(r, 42)).add(b, 15, 1, SN, hum(r, 38)).add(b, 14, 1, RIM, hum(r, 54));
};
const AMEN = [
  [K, 0, K, 2, SN, 4, SN, 7, SN, 9, K, 10, K, 11, SN, 12, SN, 15],
  [K, 0, K, 2, SN, 4, SN, 7, SN, 9, K, 10, K, 11, SN, 12, SN, 15],
  [K, 0, K, 2, SN, 4, SN, 7, SN, 9, K, 10, SN, 12, SN, 15],
  [K, 0, K, 2, SN, 4, SN, 7, SN, 9, K, 10, SN, 12, SN, 13, SN, 14, SN, 15]
];
const amenBar = (p, r, b, i, v = 116) => {
  const a = AMEN[i % 4];
  for (let j = 0; j < a.length; j += 2)
    p.add(b, a[j + 1], 1, a[j], hum(r, a[j] === SN ? (a[j + 1] % 8 === 4 ? v + 8 : v - 34) : v - 10));
};
/* builds: kicks that speed up and stop a beat before the drop (shared by the 4/4 and breakbeat styles) */
const buildKit = (p, r, nb, four = true) => {
  for (let b = 0; b < nb; b++) {
    const step = b < nb / 2 ? 4 : b < nb - 2 ? 2 : 1,
      end = b === nb - 1 ? 12 : 16;
    for (let s = 0; s < end; s += four ? step : Math.max(step, 2)) p.add(b, s, 1, K, 84 + (b * 40) / nb);
    if (b < nb - 2) p.add(b, 4, 1, CL, 96).add(b, 12, 1, CL, 100);
  }
};
const rollPerc = (p, r, nb) => {
  p.add(0, 0, 1, CR, 96);
  for (let b = 0; b < nb; b++) {
    const step = b < nb / 4 ? 4 : b < nb / 2 ? 2 : 1,
      end = b === nb - 1 ? 12 : 16;
    for (let s = 0; s < end; s += step) p.add(b, s, 1, SN, 48 + (70 * (b * 16 + s)) / (nb * 16));
  }
};
const crashPerc = (p, r, nb, extra) => {
  p.add(0, 0, 1, [CR, K], 124);
  if (nb >= 8) p.add(4, 0, 1, CR, 88);
  p.add(nb - 1, 12, 1, HT, 96)
    .add(nb - 1, 13, 1, MT, 100)
    .add(nb - 1, 14, 1, LT, 106)
    .add(nb - 1, 15, 1, LT, 112);
  if (extra) extra(p);
};
const halfKit = (p, r, nb, kick2 = [3, 11]) => {
  for (let b = 0; b < nb; b++) {
    p.add(b, 0, 1, K, 127).add(b, 8, 1, SN, 127);
    if (b % 2) for (const s of kick2) p.add(b, s, 1, K, 96);
  }
  p.add(nb - 1, 12, 1, SN, 96)
    .add(nb - 1, 13, 1, SN, 104)
    .add(nb - 1, 14, 1, SN, 116)
    .add(nb - 1, 15, 1, SN, 127);
};
const hats16 = (p, r, nb, accent = [92, 36, 60, 40], oh = [6]) => {
  for (let b = 0; b < nb; b++) {
    for (let s = 0; s < 16; s++) p.add(b, s, 1, CH, hum(r, accent[s % 4], 5));
    for (const s of oh) p.add(b, s, 1, OH, hum(r, 66));
  }
};
const hats8 = (p, r, nb, off = true, v = 80) => {
  for (let b = 0; b < nb; b++)
    for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 2 && off ? v : v - 34));
};
const offOH = (p, r, nb, v = 90) => {
  for (let b = 0; b < nb; b++) for (let s = 2; s < 16; s += 4) p.add(b, s, 1, OH, hum(r, v));
};
const halfHats = (p, r, nb) => {
  for (let b = 0; b < nb; b++) {
    for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 88 : 58));
    if (b % 2) for (let s = 12; s < 16; s++) p.add(b, s, 1, CH, 60 + (s - 12) * 14);
    p.add(b, 6, 1, OH, 70);
  }
};
const silentLastBeat = p => {
  const end = p.bars * 16 - 4;
  p.notes = p.notes.filter(n => n.s < end);
};

GR.dnb = {
  kit(p, r, v, nb) {
    if (v === 'build') return buildKit(p, r, nb);
    if (v === 'half') return halfKit(p, r, nb);
    for (let b = 0; b < nb; b++) {
      const last = b === nb - 1;
      if (v === 'intro') {
        p.add(b, 0, 1, K, 88).add(b, 10, 1, K, 78).add(b, 4, 1, SN, 84).add(b, 12, 1, SN, 90);
        if (last) fillBar(p, r, b, 'snare', 12, 80);
        continue;
      }
      if (v === 'C') {
        if (last) {
          amenBar(p, r, b, 0);
          fillBar(p, r, b, 'mix', 12, 96);
        } else amenBar(p, r, b, b);
        continue;
      }
      if (last && v !== 'outro') {
        p.add(b, 0, 1, K, 118).add(b, 4, 1, SN, 124).add(b, 6, 1, K, 100);
        fillBar(p, r, b, v === 'B' ? 'toms' : 'snare', 8, 72);
        continue;
      }
      const extra = v === 'B' ? (b % 2 ? [7, 11] : [11]) : b % 4 === 3 ? [13] : [];
      twoStep(p, r, b, v === 'outro' ? 108 - b * 3 : 120, extra, v !== 'outro' || b < nb / 2);
    }
  },
  hats(p, r, v, nb) {
    if (v === 'half') return halfHats(p, r, nb);
    if (v === 'intro') {
      hats8(p, r, nb, true, 72);
      for (let b = 3; b < nb; b += 4) p.add(b, 14, 1, OH, 70);
      return;
    }
    if (v === 'B') {
      for (let b = 0; b < nb; b++) {
        for (let s = 0; s < 16; s += 2) p.add(b, s, 1, RD, hum(r, s % 4 === 0 ? 96 : 70));
        for (const s of [3, 7, 11, 15]) p.add(b, s, 1, CH, hum(r, 44));
        p.add(b, 9, 1, SN, hum(r, 38));
      }
      return;
    }
    hats16(p, r, nb, v === 'C' ? [86, 30, 56, 30] : [92, 36, 60, 40], v === 'C' ? [2, 10] : [6]);
    for (let b = 0; b < nb; b++) p.add(b, 9, 1, SN, hum(r, 44)).add(b, 11, 1, SN, hum(r, 34));
  },
  perc(p, r, v, nb) {
    if (v === 'build') return rollPerc(p, r, nb);
    if (v === 'drop') return crashPerc(p, r, nb);
    if (v === 'intro') p.add(0, 0, 1, CR, 70);
  }
};
GR.jungle = {
  ...GR.dnb,
  kit(p, r, v, nb) {
    if (v === 'A' || v === 'B' || v === 'outro') {
      for (let b = 0; b < nb; b++) {
        if (b === nb - 1 && v !== 'outro') {
          amenBar(p, r, b, 3);
          continue;
        }
        amenBar(p, r, b, v === 'B' ? b + 1 : b, v === 'outro' ? 100 : 118);
        if (v === 'B' && b % 2) for (let s = 13; s < 16; s++) p.add(b, s, 1, SN, 70 + (s - 13) * 16);
      }
      return;
    }
    return GR.dnb.kit(p, r, v === 'C' ? 'B' : v, nb);
  }
};
GR.dnbHalf = {
  ...GR.dnb,
  kit(p, r, v, nb) {
    if (v === 'A' || v === 'B') return halfKit(p, r, nb, v === 'B' ? [3, 6, 11] : [11]);
    if (v === 'C') return GR.dnb.kit(p, r, 'A', nb);
    return GR.dnb.kit(p, r, v, nb);
  },
  hats(p, r, v, nb) {
    if (v === 'A' || v === 'B') return halfHats(p, r, nb);
    return GR.dnb.hats(p, r, v, nb);
  }
};
const four = (p, r, b, v = 120, skip = -1) => {
  for (let q = 0; q < 4; q++) if (q !== skip) p.add(b, q * 4, 1, K, hum(r, v, 3));
};
GR.house = {
  kit(p, r, v, nb) {
    if (v === 'build') return buildKit(p, r, nb);
    for (let b = 0; b < nb; b++) {
      if (v === 'half') {
        p.add(b, 0, 1, K, 120).add(b, 8, 1, CL, 118);
        continue;
      }
      four(p, r, b, v === 'intro' ? 108 : v === 'outro' ? 112 - b * 2 : 122);
      if (v !== 'intro') p.add(b, 4, 1, CL, hum(r, 108)).add(b, 12, 1, CL, hum(r, 112));
      if (v === 'B' || v === 'C') {
        if (b % 2) p.add(b, 14, 1, K, 70);
        p.add(b, 7, 1, RIM, hum(r, 56)).add(b, 13, 1, RIM, hum(r, 48));
      }
      if (b === nb - 1 && v !== 'outro' && v !== 'intro') fillBar(p, r, b, v === 'C' ? 'toms' : 'snare', 12, 80);
    }
  },
  hats(p, r, v, nb) {
    if (v === 'half') return hats8(p, r, nb);
    offOH(p, r, nb, v === 'intro' ? 70 : 92);
    if (v !== 'intro')
      for (let b = 0; b < nb; b++)
        for (let s = 0; s < 16; s++) if (s % 4 !== 2) p.add(b, s, 1, CH, hum(r, s % 2 ? 44 : 62));
    if (v === 'C') for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s += 4) p.add(b, s + 3, 1, PC, hum(r, 58));
  },
  perc(p, r, v, nb) {
    if (v === 'build') return rollPerc(p, r, nb);
    if (v === 'drop')
      return crashPerc(p, r, nb, q => {
        for (let b = 0; b < nb; b++) q.add(b, 10, 1, PC, 60);
      });
    if (v === 'intro') p.add(0, 0, 1, CR, 70);
    if (v === 'verse' || v === 'pre') for (let b = 0; b < nb; b++) p.add(b, 10, 1, PC, 54);
    if (v === 'pre') rollTail(p, nb);
  }
};
const rollTail = (p, nb) => {
  for (let s = 0; s < 12; s++) p.add(nb - 1, s, 1, SN, 50 + s * 5);
};
GR.techhouse = {
  ...GR.house,
  hats(p, r, v, nb) {
    GR.house.hats(p, r, v, nb);
    if (v === 'B' || v === 'C') for (let b = 0; b < nb; b++) p.add(b, 6, 1, PC, 70).add(b, 11, 1, PC, 64);
  }
};
GR.afro = {
  ...GR.house,
  hats(p, r, v, nb) {
    if (v === 'half') return hats8(p, r, nb);
    for (let b = 0; b < nb; b++) {
      for (const s of [0, 3, 6, 8, 11, 14]) p.add(b, s, 1, PC, hum(r, s === 0 ? 80 : 62));
      for (const s of [2, 6, 10, 14]) p.add(b, s, 1, CH, hum(r, 70));
      if (v !== 'intro') p.add(b, 10, 1, OH, 76);
    }
  },
  perc(p, r, v, nb) {
    GR.house.perc(p, r, v, nb);
    if (v === 'drop' || v === 'verse')
      for (let b = 0; b < nb; b++)
        for (const [s, x] of [
          [3, LT],
          [7, MT],
          [10, LT],
          [13, HT]
        ])
          p.add(b, s, 1, x, hum(r, 70));
  }
};
GR.techno = {
  kit(p, r, v, nb) {
    if (v === 'build') return buildKit(p, r, nb);
    for (let b = 0; b < nb; b++) {
      if (v === 'half') {
        p.add(b, 0, 1, K, 124).add(b, 10, 1, K, 100);
        continue;
      }
      four(p, r, b, v === 'intro' ? 112 : 124);
      if (v !== 'intro') p.add(b, 4, 1, CL, 90).add(b, 12, 1, CL, 96);
      if (v === 'B' || v === 'C') p.add(b, 15, 1, K, 64);
      if (v === 'C' && b % 2) p.add(b, 10, 1, RIM, 80).add(b, 11, 1, RIM, 72);
    }
  },
  hats(p, r, v, nb) {
    offOH(p, r, nb, v === 'intro' ? 76 : 96);
    if (v !== 'intro')
      for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s++) p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 62 : 40, 8));
    if (v === 'B' || v === 'C')
      for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s += 4) p.add(b, s, 1, RD, hum(r, 70));
  },
  perc(p, r, v, nb) {
    if (v === 'build') return rollPerc(p, r, nb);
    if (v === 'drop')
      return crashPerc(p, r, nb, q => {
        for (let b = 0; b < nb; b++) q.add(b, 7, 1, PC, 64).add(b, 13, 1, PC, 54);
      });
    if (v === 'intro') for (let b = 0; b < nb; b++) p.add(b, 7, 1, PC, 50);
  }
};
GR.minimal = {
  ...GR.techno,
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (const s of [2, 6, 10, 14]) p.add(b, s, 1, CH, hum(r, 70));
      if (v !== 'intro') p.add(b, 5, 1, RIM, hum(r, 56)).add(b, 11, 1, PC, hum(r, 60));
      if (v === 'B' || v === 'C') p.add(b, 14, 1, OH, 70);
    }
  }
};
GR.trance = {
  ...GR.techno,
  kit(p, r, v, nb) {
    if (v === 'build') {
      buildKit(p, r, nb);
      return;
    }
    for (let b = 0; b < nb; b++) {
      if (v === 'half') {
        p.add(b, 0, 1, K, 110);
        continue;
      }
      four(p, r, b, v === 'intro' ? 110 : 124);
      if (v !== 'intro') p.add(b, 4, 1, CL, 100).add(b, 12, 1, CL, 104);
      if (b === nb - 1 && v !== 'intro' && v !== 'outro') fillBar(p, r, b, 'snare', 12, 84);
    }
  },
  hats(p, r, v, nb) {
    offOH(p, r, nb, v === 'intro' ? 80 : 100);
    if (v === 'B' || v === 'C')
      for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s++) if (s % 4) p.add(b, s, 1, CH, hum(r, 46));
  }
};
GR.garage = {
  kit(p, r, v, nb) {
    if (v === 'build') return buildKit(p, r, nb, false);
    for (let b = 0; b < nb; b++) {
      if (v === 'half') {
        p.add(b, 0, 1, K, 118).add(b, 8, 1, SN, 116);
        continue;
      }
      const ks = v === 'B' || v === 'C' ? [0, 7, 10] : b % 2 ? [0, 10, 11] : [0, 10];
      for (const s of ks) p.add(b, s, 1, K, hum(r, s ? 104 : 120));
      if (v !== 'intro') p.add(b, 4, 1, SN, hum(r, 112)).add(b, 12, 1, SN, hum(r, 116)).add(b, 15, 1, RIM, hum(r, 56));
      if (b === nb - 1 && v !== 'outro' && v !== 'intro') fillBar(p, r, b, 'toms', 12, 84);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s += 2) p.add(b, s + (s % 4 === 2 ? 0 : 0), 1, CH, hum(r, s % 4 === 2 ? 84 : 50));
      if (v !== 'intro') for (const s of [3, 7, 11]) p.add(b, s, 1, CH, hum(r, 40));
      if (v === 'B' || v === 'C') p.add(b, 6, 1, OH, 70).add(b, 14, 1, OH, 76);
    }
  },
  perc: GR.house.perc
};
GR.dubstep = {
  kit(p, r, v, nb) {
    if (v === 'build') return buildKit(p, r, nb, false);
    for (let b = 0; b < nb; b++) {
      if (v === 'intro' || v === 'outro') {
        p.add(b, 0, 1, K, 110).add(b, 8, 1, SN, 104);
        continue;
      }
      if (v === 'half') {
        twoStep(p, r, b, 118, [], false);
        continue;
      }
      p.add(b, 0, 1, K, 127).add(b, 8, 1, [SN, CL], 127);
      if (v === 'B' || v === 'C') p.add(b, 3, 1, K, 100).add(b, 11, 1, K, 96);
      if (v === 'C' && b % 2) p.add(b, 14, 1, K, 100).add(b, 15, 1, SN, 80);
      if (b === nb - 1) for (let s = 12; s < 16; s++) p.add(b, s, 1, SN, 90 + (s - 12) * 12);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 86 : 56));
      if (v === 'B' || v === 'C') for (const s of [5, 13]) p.add(b, s, 1, CH, 50);
      if (b % 2 && v !== 'intro') for (let s = 12; s < 16; s++) p.add(b, s, 1, CH, 56 + (s - 12) * 14);
      p.add(b, 6, 1, OH, 70);
    }
  },
  perc: GR.techno.perc
};
GR.breaks = {
  kit(p, r, v, nb) {
    if (v === 'build') return buildKit(p, r, nb, false);
    if (v === 'half') return halfKit(p, r, nb);
    for (let b = 0; b < nb; b++) {
      const last = b === nb - 1 && v !== 'outro' && v !== 'intro';
      if (v === 'C') {
        amenBar(p, r, b, b, 118);
        continue;
      }
      const ks = v === 'B' ? [0, 6, 10] : [0, 10];
      for (const s of ks) p.add(b, s, 1, K, hum(r, 118));
      p.add(b, 4, 1, SN, hum(r, 120)).add(b, 12, 1, SN, hum(r, 122));
      p.add(b, 7, 1, SN, hum(r, 44)).add(b, 9, 1, SN, hum(r, 40));
      if (last) fillBar(p, r, b, 'mix', 12, 90);
    }
  },
  hats(p, r, v, nb) {
    hats8(p, r, nb, false, 86);
    for (let b = 0; b < nb; b++) {
      if (v !== 'intro') p.add(b, 14, 1, OH, 76);
      if (v === 'B' || v === 'C') for (let s = 0; s < 16; s += 4) p.add(b, s + 2, 1, PC, 64);
    }
  },
  perc: GR.house.perc
};
GR.electro = {
  ...GR.breaks,
  kit(p, r, v, nb) {
    if (v === 'build' || v === 'half') return GR.breaks.kit(p, r, v, nb);
    for (let b = 0; b < nb; b++) {
      const ks = v === 'B' || v === 'C' ? [0, 3, 6, 10] : [0, 6, 10];
      for (const s of ks) p.add(b, s, 1, K, hum(r, 116));
      p.add(b, 4, 1, [SN, CL], hum(r, 118)).add(b, 12, 1, [SN, CL], hum(r, 120));
      if (b === nb - 1 && v !== 'outro' && v !== 'intro') fillBar(p, r, b, 'toms', 12, 90);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s++) p.add(b, s, 1, CH, hum(r, [90, 40, 66, 40][s % 4]));
    if (v === 'B' || v === 'C') for (let b = 0; b < nb; b++) p.add(b, 11, 1, PC, 76);
  }
};
GR.boombap = {
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'half' || v === 'intro') {
        p.add(b, 0, 1, K, 104).add(b, 8, 1, SN, 100);
        continue;
      }
      if (v === 'build') {
        p.add(b, 0, 1, K, 110);
        if (b === nb - 1) for (let s = 8; s < 12; s++) p.add(b, s, 1, SN, 80 + s * 3);
        continue;
      }
      const ks = v === 'B' || v === 'C' ? (b % 2 ? [0, 7, 10] : [0, 3, 10]) : b % 2 ? [0, 10, 11] : [0, 10];
      for (const s of ks) p.add(b, s, 1, K, hum(r, s ? 104 : 120));
      p.add(b, 4, 1, SN, hum(r, 120)).add(b, 12, 1, SN, hum(r, 122));
      if (b % 4 === 3 && v !== 'outro') p.add(b, 15, 1, SN, 70);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 86 : 60, 10));
      if (v === 'B' || v === 'C') p.add(b, 14, 1, OH, 66);
    }
  },
  perc(p, r, v, nb) {
    if (v === 'drop') {
      p.add(0, 0, 1, CR, 104);
      for (let b = 0; b < nb; b++) p.add(b, 12, 1, CL, 70);
    }
    if (v === 'verse') for (let b = 1; b < nb; b += 2) p.add(b, 14, 1, PC, 60);
  }
};
GR.lofi = {
  ...GR.boombap,
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'half' || v === 'intro' || v === 'build') {
        p.add(b, 0, 1, K, 92);
        if (v !== 'build') p.add(b, 8, 1, RIM, 80);
        continue;
      }
      const ks = b % 2 ? [0, 9, 10] : [0, 7];
      for (const s of ks) p.add(b, s, 1, K, hum(r, s ? 90 : 104));
      p.add(b, 4, 1, SN, hum(r, 96)).add(b, 12, 1, SN, hum(r, 100));
      if (v !== 'A') p.add(b, 6, 1, RIM, hum(r, 50));
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 72 : 46, 12));
  }
};
GR.trap = {
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'intro' || v === 'build') {
        p.add(b, 0, 1, K, 110);
        if (v === 'build' && b === nb - 1) for (let s = 8; s < 12; s++) p.add(b, s, 1, SN, 90 + s * 2);
        continue;
      }
      const ks = v === 'B' || v === 'C' ? (b % 2 ? [0, 3, 10, 14] : [0, 6, 7]) : b % 2 ? [0, 10, 11] : [0, 7];
      for (const s of ks) p.add(b, s, 1, K, hum(r, 120, 4));
      if (v === 'half') p.add(b, 8, 1, [SN, CL], 120);
      else p.add(b, 8, 1, [SN, CL], hum(r, 124, 3));
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      const roll = (v === 'B' || v === 'C' || b % 2) && v !== 'intro';
      for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 96 : 70));
      if (roll) {
        const at = b % 2 ? 12 : 6;
        for (let s = at; s < at + 4; s++) p.add(b, s, 1, CH, 64 + (s - at) * 14);
      }
      if (v === 'C') p.add(b, 11, 1, OH, 70);
    }
  },
  perc(p, r, v, nb) {
    if (v === 'drop') p.add(0, 0, 1, CR, 110);
    if (v === 'drop' || v === 'verse') for (let b = 1; b < nb; b += 2) p.add(b, 15, 1, CL, 76);
  }
};
GR.drill = {
  ...GR.trap,
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'intro' || v === 'build') {
        p.add(b, 0, 1, K, 110);
        continue;
      }
      const ks = b % 2 ? [0, 6, 14] : [0, 10];
      for (const s of ks) p.add(b, s, 1, K, hum(r, 118));
      p.add(b, 8, 1, SN, 124);
      if (v !== 'A') p.add(b, 13, 1, SN, 80);
    }
  },
  hats(p, r, v, nb) {
    /* the drill skip: hats in threes against the beat */
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s += 3) p.add(b, s, 1, CH, hum(r, s % 6 === 0 ? 92 : 66));
      if (v === 'B' || v === 'C') p.add(b, 14, 1, CH, 70).add(b, 15, 1, CH, 82);
    }
  }
};
GR.phonk = {
  ...GR.trap,
  hats(p, r, v, nb) {
    GR.trap.hats(p, r, v, nb);
    /* the cowbell line */
    if (v !== 'intro')
      for (let b = 0; b < nb; b++)
        for (const s of [0, 3, 6, 10, 12]) p.add(b, s, 1, PC, hum(r, s % 4 === 0 ? 104 : 84));
  }
};
GR.funk = {
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'half' || v === 'intro' || v === 'build') {
        p.add(b, 0, 1, K, 104).add(b, 8, 1, SN, 96);
        if (v === 'build' && b === nb - 1) fillBar(p, r, b, 'toms', 8, 80);
        continue;
      }
      const ks = v === 'B' || v === 'C' ? [0, 3, 10, 14] : [0, 10, 13];
      for (const s of ks) p.add(b, s, 1, K, hum(r, s ? 100 : 116));
      p.add(b, 4, 1, SN, hum(r, 118)).add(b, 12, 1, SN, hum(r, 118));
      for (const s of [6, 9, 15]) p.add(b, s, 1, SN, hum(r, 38, 8));
      if (b === nb - 1 && v !== 'outro') fillBar(p, r, b, 'toms', 12, 86);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s++) p.add(b, s, 1, CH, hum(r, [88, 42, 64, 46][s % 4], 8));
      if (v === 'B' || v === 'C') p.add(b, 14, 1, OH, 70);
    }
  },
  perc(p, r, v, nb) {
    if (v === 'drop') p.add(0, 0, 1, CR, 104);
    if (v === 'drop' || v === 'verse') for (let b = 0; b < nb; b++) p.add(b, 4, 1, PC, 64).add(b, 12, 1, PC, 64);
    if (v === 'pre') rollTail(p, nb);
  }
};
GR.disco = {
  ...GR.house,
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'half' || v === 'build') {
        p.add(b, 0, 1, K, 110).add(b, 8, 1, K, 104);
        if (v === 'build' && b === nb - 1) fillBar(p, r, b, 'toms', 8, 80);
        continue;
      }
      four(p, r, b, 116);
      if (v !== 'intro') p.add(b, 4, 1, SN, hum(r, 112)).add(b, 12, 1, SN, hum(r, 114));
      if (b === nb - 1 && v !== 'outro' && v !== 'intro') fillBar(p, r, b, 'toms', 12, 86);
    }
  },
  hats(p, r, v, nb) {
    offOH(p, r, nb, 96);
    for (let b = 0; b < nb; b++) for (let s = 0; s < 16; s++) if (s % 4 !== 2) p.add(b, s, 1, CH, hum(r, 46));
  },
  perc: GR.funk.perc
};
GR.reggae = {
  kit(p, r, v, nb) {
    /* the one drop: kick and snare (rim) together on beat 3 */
    for (let b = 0; b < nb; b++) {
      if (v === 'build') {
        p.add(b, 8, 1, [K, RIM], 100);
        if (b === nb - 1) fillBar(p, r, b, 'toms', 10, 80);
        continue;
      }
      p.add(b, 8, 1, [K, v === 'intro' ? RIM : SN], hum(r, 110));
      if (v === 'B' || v === 'C') p.add(b, 14, 1, RIM, 60);
      if (b === nb - 1 && v !== 'outro' && v !== 'intro') fillBar(p, r, b, 'toms', 12, 80);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s += 2) p.add(b, s, 1, CH, hum(r, s % 4 === 2 ? 80 : 54));
      if (v === 'B' || v === 'C') for (const s of [3, 7, 11, 15]) p.add(b, s, 1, CH, 42);
    }
  },
  perc(p, r, v, nb) {
    if (v === 'drop') p.add(0, 0, 1, CR, 96);
    if (v === 'drop' || v === 'verse') for (let b = 0; b < nb; b++) p.add(b, 6, 1, PC, 56).add(b, 14, 1, PC, 56);
  }
};
GR.dembow = {
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'build' || v === 'half') {
        p.add(b, 0, 1, K, 110).add(b, 8, 1, K, 110);
        if (v === 'build' && b === nb - 1) for (let s = 8; s < 12; s++) p.add(b, s, 1, SN, 90 + s * 2);
        continue;
      }
      four(p, r, b, v === 'intro' ? 104 : 120);
      if (v !== 'intro') for (const s of [3, 6, 11, 14]) p.add(b, s, 1, SN, hum(r, s === 3 || s === 11 ? 112 : 104));
    }
  },
  hats(p, r, v, nb) {
    hats8(p, r, nb, true, 82);
    if (v === 'B' || v === 'C') for (let b = 0; b < nb; b++) p.add(b, 10, 1, OH, 70);
  },
  perc(p, r, v, nb) {
    if (v === 'drop') p.add(0, 0, 1, CR, 104);
    if (v === 'drop' || v === 'verse') for (let b = 0; b < nb; b++) for (const s of [3, 11]) p.add(b, s, 1, RIM, 70);
  }
};
GR.synth = {
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'build') {
        for (let s = 0; s < (b === nb - 1 ? 12 : 16); s += b < nb / 2 ? 4 : 2) p.add(b, s, 1, SN, 70 + b * 6);
        p.add(b, 0, 1, K, 110);
        continue;
      }
      if (v === 'half' || v === 'intro') {
        p.add(b, 0, 1, K, 108);
        if (v === 'half') p.add(b, 8, 1, SN, 110);
        continue;
      }
      const ks = v === 'B' || v === 'C' ? [0, 8, 10] : [0, 8];
      for (const s of ks) p.add(b, s, 1, K, hum(r, 118));
      p.add(b, 4, 1, [SN, CL], hum(r, 120)).add(b, 12, 1, [SN, CL], hum(r, 122));
      if (b === nb - 1 && v !== 'outro') fillBar(p, r, b, 'toms', 12, 86);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      for (let s = 0; s < 16; s += v === 'B' || v === 'C' ? 1 : 2)
        p.add(b, s, 1, CH, hum(r, s % 4 === 0 ? 80 : s % 2 ? 40 : 60));
      if (v !== 'intro') p.add(b, 14, 1, OH, 64);
    }
  },
  perc(p, r, v, nb) {
    if (v === 'drop') crashPerc(p, r, nb);
    if (v === 'pre') rollTail(p, nb);
  }
};
GR.pop = {
  ...GR.synth,
  kit(p, r, v, nb) {
    if (v === 'intro') return;
    if (v === 'B' || v === 'C') {
      for (let b = 0; b < nb; b++) {
        four(p, r, b, 116);
        p.add(b, 4, 1, [SN, CL], hum(r, 120)).add(b, 12, 1, [SN, CL], hum(r, 122));
        if (b === nb - 1) fillBar(p, r, b, 'snare', 12, 86);
      }
      return;
    }
    GR.synth.kit(p, r, v, nb);
  }
};
GR.ambient = {
  kit(p, r, v, nb) {
    if (v === 'intro' || v === 'build') return;
    for (let b = 0; b < nb; b++) {
      p.add(b, 0, 1, K, 84);
      if (v !== 'A') p.add(b, 10, 1, K, 64);
      if (b % 2) p.add(b, 8, 1, RIM, 60);
    }
  },
  hats(p, r, v, nb) {
    for (let b = 0; b < nb; b++) for (const s of [4, 12]) p.add(b, s, 1, PC, hum(r, 46, 10));
  },
  perc(p, r, v, nb) {
    if (v === 'drop') p.add(0, 0, 1, CR, 70);
  }
};
GR.cinematic = {
  kit(p, r, v, nb) {
    for (let b = 0; b < nb; b++) {
      if (v === 'intro') continue;
      if (v === 'build') {
        for (let s = 0; s < (b === nb - 1 ? 12 : 16); s += b < nb / 2 ? 4 : 2) p.add(b, s, 1, LT, 70 + b * 6);
        continue;
      }
      p.add(b, 0, 1, [K, LT], 118);
      if (v !== 'A') p.add(b, 6, 1, LT, 96).add(b, 10, 1, MT, 100);
      p.add(b, 8, 1, SN, 110);
      if (b === nb - 1) fillBar(p, r, b, 'toms', 8, 80);
    }
  },
  hats(p, r, v, nb) {
    if (v === 'intro') return;
    for (let b = 0; b < nb; b++)
      for (const s of [0, 3, 6, 8, 11, 14]) p.add(b, s, 1, LT, hum(r, s % 8 === 0 ? 90 : 60));
  },
  perc(p, r, v, nb) {
    if (v === 'drop') p.add(0, 0, 1, [CR, K], 127);
    if (v === 'build') rollPerc(p, r, nb);
  }
};
/* every grammar's perc writes rolls into a build, and a fill tail into a pre-chorus */
for (const g of Object.values(GR)) {
  const own = g.perc;
  g.perc = (p, r, v, nb) => {
    if (v === 'build' && !p.notes.length) {
      own(p, r, v, nb);
      if (!p.notes.length) rollPerc(p, r, nb);
      return;
    }
    own(p, r, v, nb);
  };
}

/* ---------- harmony helpers ---------- */
const nearest = (pc, around) => {
  let n = around - ((((around - pc) % 12) + 12) % 12);
  if (around - n > 6) n += 12;
  return n;
};
/* a voicing of a chord near the last one (smallest total movement) */
function voice(ch, center, prev, size = 3) {
  const pcs = ch.tones.slice(0, size).map(t => (ch.root + t) % 12);
  const opts = [];
  for (let inv = 0; inv < pcs.length; inv++) {
    const order = [...pcs.slice(inv), ...pcs.slice(0, inv)];
    for (const base of [center - 12, center - 7, center, center + 5]) {
      let n = nearest(order[0], base);
      const v = [n];
      for (let i = 1; i < order.length; i++) {
        n += (((order[i] - n) % 12) + 12) % 12 || 12;
        v.push(n);
      }
      opts.push(v);
    }
  }
  const score = v =>
    prev
      ? v.reduce((s, x, i) => s + Math.abs(x - (prev[i] ?? prev[prev.length - 1])), 0)
      : Math.abs(v[0] - center) + Math.abs(v[v.length - 1] - center - 7);
  return (
    opts.filter(v => v[0] >= center - 9 && v[v.length - 1] <= center + 19).sort((a, b) => score(a) - score(b))[0] ||
    opts[0]
  );
}
const bassNote = (ch, lo = 28) => nearest(ch.root, lo + 6);

/* ---------- bass ---------- */
const BASS = {};
/* the bass's rhythm in a bar: [step, length, interval] */
const bassBars = (p, ctx, rhythm, lo, v = 116, gap = true) => {
  const { ch, r, nb } = ctx;
  for (let b = 0; b < nb; b++) {
    const c = ch[b % ch.length],
      root = bassNote(c, lo);
    for (const [s, len, iv] of rhythm(b)) {
      if (gap && b === nb - 1 && s >= 12) continue;
      const note = typeof iv === 'string' ? root + c.tones[+iv.slice(1)] : root + iv;
      p.add(b, s, len, note, hum(r, s % 4 === 0 ? v : v - 14, 4));
    }
  }
};
const longRoots = (p, ctx, lo = 28, every = 2, v = 100) => {
  for (let b = 0; b < ctx.nb; b += every) p.add(b, 0, every * 16, bassNote(ctx.ch[b % ctx.ch.length], lo), v);
};
const buildBass = (p, ctx, lo = 28) => {
  const { nb, ch } = ctx,
    root = bassNote(ch[0], lo);
  for (let b = 0; b < nb - 2; b++) p.add(b, 0, 16, root, 100);
  for (let i = 0, s = (nb - 2) * 16; s < nb * 16 - 4; s += 2, i++)
    p.add(Math.floor(s / 16), s % 16, 2, root + i, 96 + i);
};
BASS.dnb = (p, v, ctx) => {
  if (v === 'intro') return longRoots(p, ctx, 34);
  if (v === 'build') return buildBass(p, ctx, 34);
  if (v === 'half')
    return bassBars(
      p,
      ctx,
      () => [
        [0, 4, 12],
        [4, 4, 12],
        [8, 2, 24],
        [10, 2, 12],
        [12, 4, 15]
      ],
      34,
      120,
      false
    );
  const R = {
    A: () => [
      [0, 2, 12],
      [2, 1, 24],
      [3, 2, 12],
      [6, 2, 19],
      [8, 1, 12],
      [10, 2, 24],
      [12, 1, 12],
      [13, 3, 15]
    ],
    B: () => [
      [0, 1, 12],
      [1, 1, 12],
      [2, 2, 24],
      [6, 1, 12],
      [7, 1, 12],
      [8, 3, 12],
      [11, 1, 24],
      [12, 2, 22],
      [14, 2, 19]
    ],
    C: b =>
      b % 2
        ? [
            [0, 6, 12],
            [6, 2, 24],
            [8, 3, 12],
            [11, 2, 15],
            [13, 3, 10]
          ]
        : [...Array(8)]
            .map((_, s) => [s, 1, s % 2 ? 24 : 12])
            .concat([
              [8, 2, 19],
              [10, 2, 18],
              [12, 4, 12]
            ])
  };
  bassBars(p, ctx, R[v] || R.A, 34, 120);
};
BASS.dnbLiquid = (p, v, ctx) => {
  if (v === 'intro' || v === 'build' || v === 'half') return BASS.dnb(p, v, ctx);
  const R = {
    A: () => [
      [0, 6, 0],
      [10, 4, 0],
      [14, 2, 7]
    ],
    B: () => [
      [0, 3, 0],
      [3, 3, 12],
      [6, 2, 7],
      [10, 3, 0],
      [13, 3, 'T1']
    ],
    C: () => [
      [0, 3, 0],
      [3, 3, 0],
      [6, 2, 12],
      [10, 3, 0],
      [13, 3, 10]
    ]
  };
  bassBars(p, ctx, R[v] || R.A, 34, 116);
};
BASS.dnbJungle = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b =>
        b % 2
          ? [
              [0, 6, 0],
              [8, 6, 0],
              [14, 2, 7]
            ]
          : [
              [0, 12, 0],
              [12, 2, 12],
              [14, 2, 10]
            ],
      34,
      118
    );
  return BASS.dnb(p, v, ctx);
};
BASS.dnbJump = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b =>
        b % 2
          ? [
              [0, 2, 12],
              [3, 1, 12],
              [6, 2, 24],
              [10, 4, 12],
              [14, 2, 13]
            ]
          : [
              [0, 4, 12],
              [6, 2, 12],
              [8, 2, 19],
              [10, 4, 12]
            ],
      34,
      124
    );
  return BASS.dnb(p, v, ctx);
};
BASS.wobble = (p, v, ctx) => {
  if (v === 'intro') return longRoots(p, ctx, 28);
  if (v === 'build') return buildBass(p, ctx, 28);
  const R = {
    A: b => [
      [0, 6, 12],
      [6, 2, 12],
      [8, 4, 15],
      [12, 4, 12]
    ],
    B: b =>
      b % 2
        ? [
            [0, 2, 12],
            [2, 2, 24],
            [4, 2, 12],
            [6, 2, 22],
            [8, 8, 12]
          ]
        : [
            [0, 3, 12],
            [3, 3, 12],
            [6, 2, 15],
            [8, 3, 12],
            [11, 3, 24],
            [14, 2, 12]
          ],
    C: b => [...Array(8)].map((_, i) => [i * 2, 2, i % 3 ? 12 : 24]),
    half: () => [
      [0, 3, 12],
      [3, 3, 12],
      [6, 2, 12],
      [10, 3, 12],
      [13, 3, 15]
    ]
  };
  bassBars(p, ctx, R[v] || R.A, 28, 124);
};
BASS.riddim = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b => [
        [0, 3, 12],
        [4, 2, 12],
        [6, 2, 12],
        [8, 3, 12],
        [12, 2, 12],
        [14, 2, v === 'A' ? 12 : 13]
      ],
      28,
      124
    );
  return BASS.wobble(p, v, ctx);
};
BASS.house = (p, v, ctx) => {
  if (v === 'intro')
    return bassBars(
      p,
      ctx,
      () => [
        [2, 2, 0],
        [10, 2, 0]
      ],
      34,
      96,
      false
    );
  if (v === 'build') return buildBass(p, ctx, 34);
  const R = {
    A: () => [
      [2, 2, 0],
      [6, 2, 0],
      [10, 2, 0],
      [14, 1, 12]
    ],
    B: b => [
      [2, 2, 0],
      [5, 1, 12],
      [6, 2, 0],
      [10, 2, 0],
      [13, 1, 'T2'],
      [14, 2, 12]
    ],
    C: b => [
      [0, 1, 0],
      [2, 2, 0],
      [6, 1, 12],
      [7, 1, 0],
      [10, 2, 'T1'],
      [14, 2, 0]
    ],
    half: () => [
      [0, 6, 0],
      [8, 4, 0],
      [14, 2, 7]
    ]
  };
  bassBars(p, ctx, R[v] || R.A, 34, 112);
};
BASS.techhouse = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b => [
        [2, 1, 0],
        [3, 1, 0],
        [6, 1, 12],
        [10, 1, 0],
        [11, 1, 0],
        [14, 1, v === 'C' ? 10 : 0]
      ],
      34,
      120
    );
  return BASS.house(p, v, ctx);
};
BASS.rumble = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      () =>
        [0, 1, 2, 3].flatMap(q => [
          [q * 4 + 1, 1, 0],
          [q * 4 + 2, 1, 0],
          [q * 4 + 3, 1, v === 'C' && q === 3 ? 12 : 0]
        ]),
      28,
      110,
      false
    );
  return BASS.house(p, v, ctx);
};
BASS.acid = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C') return acidLine(p, ctx, v);
  return BASS.house(p, v, ctx);
};
function acidLine(p, ctx, v, lo = 36) {
  const { r, nb, ch, key } = ctx;
  const shape = [0, 0, 12, 0, 3, 0, 15, 0, 0, 7, 0, 12, 10, 0, 3, 12].map((x, i) =>
    v === 'B' && i % 5 === 3 ? x + 12 : x
  );
  const acc = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
  for (let b = 0; b < nb; b++) {
    const root = nearest(ch[b % ch.length].root, lo + 6);
    for (let s = 0; s < 16; s++) {
      if ((s === 5 || s === 13) && v === 'A') continue;
      p.add(
        b,
        s,
        s % 4 === 3 && v !== 'A' ? 2 : 1,
        root + shape[(s + b * (v === 'C' ? 3 : 0)) % 16],
        acc[s] ? 118 : 86
      );
    }
  }
}
BASS.trance = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      () =>
        [0, 1, 2, 3].flatMap(q => [
          [q * 4 + 2, 1, 0],
          [q * 4 + 3, 1, v === 'C' ? 12 : 0]
        ]),
      34,
      112,
      false
    );
  return BASS.house(p, v, ctx);
};
BASS.garage = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b =>
        b % 2
          ? [
              [0, 3, 0],
              [7, 2, 0],
              [10, 3, 12],
              [14, 2, 7]
            ]
          : [
              [0, 4, 0],
              [6, 1, 12],
              [7, 3, 0],
              [11, 2, 'T2'],
              [14, 2, 10]
            ],
      34,
      116
    );
  return BASS.house(p, v, ctx);
};
BASS.synth = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(p, ctx, () => [...Array(8)].map((_, i) => [i * 2, 2, v === 'A' ? 0 : i % 2 ? 12 : 0]), 34, 112);
  if (v === 'half')
    return bassBars(
      p,
      ctx,
      () => [
        [0, 8, 0],
        [8, 8, 0]
      ],
      34,
      104,
      false
    );
  return BASS.house(p, v, ctx);
};
BASS.disco = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      () => [...Array(8)].map((_, i) => [i * 2, 1, i % 2 ? 12 : 0]).concat(v === 'C' ? [[15, 1, 10]] : []),
      34,
      112
    );
  return BASS.house(p, v, ctx);
};
BASS.funk = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b =>
        b % 2 && v !== 'A'
          ? [
              [0, 2, 0],
              [3, 1, 12],
              [6, 1, 0],
              [7, 1, 10],
              [10, 2, 0],
              [13, 1, 12],
              [14, 2, 'T1']
            ]
          : [
              [0, 3, 0],
              [3, 1, 12],
              [6, 2, 0],
              [10, 1, 0],
              [11, 1, 12],
              [14, 2, 7]
            ],
      34,
      114
    );
  if (v === 'intro') return longRoots(p, ctx, 34, 2, 90);
  return BASS.house(p, v, ctx);
};
BASS.boombap = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b =>
        b % 2
          ? [
              [0, 6, 0],
              [10, 2, 0],
              [12, 4, 'T1']
            ]
          : [
              [0, 6, 0],
              [7, 3, 0],
              [10, 4, 7]
            ],
      34,
      108,
      false
    );
  if (v === 'intro') return;
  return longRoots(p, ctx, 34, 2, 96);
};
BASS.walk = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C') {
    const { ch, nb, r } = ctx;
    for (let b = 0; b < nb; b++) {
      const c = ch[b % ch.length],
        nx = ch[(b + 1) % ch.length],
        root = bassNote(c, 34),
        tgt = bassNote(nx, 34);
      const line = [root, root + c.tones[1], root + c.tones[2], tgt + (tgt > root ? -1 : 1)];
      line.forEach((n, i) => p.add(b, i * 4, v === 'A' ? 3 : 4, n, hum(r, i ? 96 : 110)));
    }
    return;
  }
  if (v === 'intro') return;
  return longRoots(p, ctx, 34, 2, 92);
};
BASS.eight08 = (p, v, ctx) => {
  /* 808: long notes on the kicks, an octave jump and a slide down at the turn */
  if (v === 'intro') return;
  if (v === 'build') return longRoots(p, ctx, 28, 2, 100);
  const R = {
    A: b =>
      b % 2
        ? [
            [0, 10, 0],
            [10, 1, 0],
            [11, 5, 12]
          ]
        : [
            [0, 7, 0],
            [7, 9, 0]
          ],
    B: b =>
      b % 2
        ? [
            [0, 3, 0],
            [3, 3, 12],
            [6, 1, 0],
            [7, 3, 0],
            [10, 4, 0],
            [14, 2, -2]
          ]
        : [
            [0, 6, 0],
            [6, 1, 0],
            [7, 7, 0],
            [14, 2, 12]
          ],
    C: b => [
      [0, 3, 0],
      [3, 3, 0],
      [6, 4, 12],
      [10, 6, 0]
    ],
    half: b => [[0, 16, 0]]
  };
  bassBars(p, ctx, R[v] || R.A, 28, 122, false);
};
BASS.reggae = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b =>
        b % 2
          ? [
              [2, 2, 0],
              [4, 2, 0],
              [8, 3, 7],
              [12, 2, 12],
              [14, 2, 10]
            ]
          : [
              [2, 4, 0],
              [8, 2, 'T2'],
              [10, 2, 'T1'],
              [12, 4, 0]
            ],
      34,
      112,
      false
    );
  if (v === 'intro') return;
  return longRoots(p, ctx, 34, 2, 96);
};
BASS.dembow = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      () => [
        [0, 3, 0],
        [3, 3, 0],
        [6, 2, 12],
        [8, 3, 0],
        [11, 3, 0],
        [14, 2, 7]
      ],
      34,
      116,
      false
    );
  if (v === 'intro') return;
  return longRoots(p, ctx, 34, 2, 96);
};
BASS.afro = (p, v, ctx) => {
  if (v === 'A' || v === 'B' || v === 'C')
    return bassBars(
      p,
      ctx,
      b => [
        [0, 3, 0],
        [3, 2, 0],
        [6, 2, 12],
        [10, 2, 0],
        [12, 2, 7],
        [14, 2, 'T1']
      ],
      34,
      110,
      false
    );
  if (v === 'intro') return;
  return longRoots(p, ctx, 34, 2, 96);
};
BASS.pop = (p, v, ctx) => {
  if (v === 'A')
    return bassBars(
      p,
      ctx,
      () => [
        [0, 6, 0],
        [6, 2, 0],
        [8, 6, 0],
        [14, 2, 7]
      ],
      34,
      106,
      false
    );
  if (v === 'B' || v === 'C') return bassBars(p, ctx, () => [...Array(8)].map((_, i) => [i * 2, 2, 0]), 34, 110, false);
  if (v === 'intro') return;
  return longRoots(p, ctx, 34, 1, 96);
};
BASS.drone = (p, v, ctx) => {
  if (v === 'build') return buildBass(p, ctx, 28);
  longRoots(p, ctx, 28, 2, v === 'intro' ? 80 : 100);
};

/* ---------- chords ---------- */
const CHORDS = {};
const chordBars = (p, ctx, rhythm, center, v = 100, size = 3) => {
  let prev = null;
  for (let b = 0; b < ctx.nb; b++) {
    const vc = voice(ctx.ch[b % ctx.ch.length], center, prev, size);
    prev = vc;
    for (const [s, len, vel] of rhythm(b)) {
      if (b === ctx.nb - 1 && s >= 12 && ctx.gap) continue;
      p.add(b, s, len, vc, hum(ctx.r, vel || v, 4));
    }
  }
};
const sustain = (p, ctx, center = 60, v = 76, size = 3) => chordBars(p, ctx, () => [[0, 16, v]], center, v, size);
CHORDS.stab = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 60, 64);
  const R = {
    A: b =>
      b % 2
        ? [
            [6, 1, 96],
            [10, 2, 104]
          ]
        : [[0, 2, 110]],
    B: b =>
      b === ctx.nb - 1
        ? [
            [0, 1, 100],
            [3, 1, 80],
            [6, 1, 80]
          ]
        : [
            [0, 1, 100],
            [3, 1, 80],
            [6, 1, 84],
            [10, 1, 100],
            [12, 1, 80]
          ]
  };
  chordBars(p, { ...ctx, gap: true }, R[v] || R.A, 62, 100);
};
CHORDS.hit = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 60, 64);
  chordBars(
    p,
    ctx,
    b =>
      b % 4 === 0
        ? [[0, 4, 124]]
        : b % 4 === 2 && v === 'B'
          ? [
              [0, 2, 110],
              [6, 2, 104]
            ]
          : [],
    60,
    120
  );
};
CHORDS.house = (p, v, ctx) => {
  if (v === 'intro')
    return chordBars(
      p,
      ctx,
      () => [
        [0, 2, 80],
        [6, 2, 76],
        [10, 2, 78]
      ],
      62,
      80,
      4
    );
  const R = {
    A: () => [
      [0, 2, 100],
      [3, 1, 84],
      [6, 2, 96],
      [10, 2, 100],
      [12, 2, 88]
    ],
    B: b =>
      b % 2
        ? [
            [2, 2, 96],
            [6, 2, 92],
            [10, 1, 96],
            [13, 2, 90]
          ]
        : [
            [0, 2, 104],
            [3, 1, 84],
            [6, 2, 96],
            [10, 2, 100],
            [12, 2, 88]
          ]
  };
  chordBars(p, { ...ctx, gap: true }, R[v] || R.A, 62, 96, 4);
};
CHORDS.garage = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 62, 66, 4);
  chordBars(
    p,
    { ...ctx, gap: true },
    b =>
      b % 2
        ? [
            [3, 1, 96],
            [6, 1, 90],
            [11, 2, 96]
          ]
        : [
            [0, 2, 104],
            [7, 1, 90],
            [10, 2, 96]
          ],
    62,
    96,
    4
  );
};
CHORDS.keys = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 60, 70, 4);
  const R = {
    A: () => [
      [0, 7, 86],
      [7, 9, 80]
    ],
    B: b =>
      b % 2
        ? [
            [0, 4, 90],
            [6, 2, 84],
            [10, 6, 86]
          ]
        : [
            [0, 10, 92],
            [10, 6, 82]
          ]
  };
  chordBars(p, ctx, R[v] || R.A, 60, 86, 4);
};
CHORDS.jazz = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 58, 64, 4);
  chordBars(
    p,
    ctx,
    b =>
      b % 2
        ? [
            [0, 6, 76],
            [6, 1, 64],
            [14, 2, 72]
          ]
        : [
            [0, 14, 80],
            [14, 2, 70]
          ],
    58,
    78,
    4
  );
};
CHORDS.comp = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 62, 66);
  const R = {
    A: () => [
      [2, 1, 92],
      [6, 1, 86],
      [7, 1, 70],
      [10, 1, 92],
      [14, 1, 86]
    ],
    B: () => [
      [0, 1, 96],
      [2, 1, 80],
      [3, 1, 70],
      [6, 1, 90],
      [9, 1, 76],
      [10, 1, 90],
      [13, 1, 70],
      [14, 1, 88]
    ]
  };
  chordBars(p, ctx, R[v] || R.A, 64, 90);
};
CHORDS.skank = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 62, 64);
  chordBars(
    p,
    ctx,
    () =>
      [
        [4, 1, 90],
        [12, 1, 92]
      ].concat(
        v === 'B'
          ? [
              [6, 1, 70],
              [14, 1, 72]
            ]
          : []
      ),
    64,
    90
  );
};
CHORDS.dembowCh = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 62, 64);
  chordBars(
    p,
    ctx,
    () => [
      [0, 3, 90],
      [3, 3, 86],
      [6, 2, 84],
      [8, 3, 90],
      [11, 3, 86],
      [14, 2, 84]
    ],
    62,
    88
  );
};
CHORDS.pluckCh = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 62, 64);
  chordBars(
    p,
    ctx,
    () => [
      [0, 1, 90],
      [3, 1, 80],
      [6, 1, 84],
      [10, 1, 88],
      [12, 1, 80],
      [14, 1, 76]
    ],
    64,
    86
  );
};
CHORDS.long = (p, v, ctx) => sustain(p, ctx, 60, v === 'intro' ? 66 : 84, v === 'B' ? 4 : 3);
CHORDS.pop = (p, v, ctx) => {
  if (v === 'intro') return sustain(p, ctx, 60, 70);
  chordBars(
    p,
    ctx,
    v === 'B'
      ? () => [0, 4, 8, 12].map(s => [s, 3, s === 0 ? 96 : 82])
      : () => [
          [0, 8, 86],
          [8, 8, 80]
        ],
    60,
    86
  );
};

/* ---------- pads ---------- */
const padPart = (p, v, ctx) => {
  const v0 = v === 'break' ? 88 : v === 'drop' ? 54 : 72;
  /* held for as long as the chord lasts (up to two bars), so it never sits over the next chord */
  const same = (a, b) => a.root === b.root && a.tones.join() === b.tones.join();
  let prev = null;
  for (let b = 0; b < ctx.nb; ) {
    const c = ctx.ch[b % ctx.ch.length];
    let n = 1;
    while (n < 2 && b + n < ctx.nb && same(ctx.ch[(b + n) % ctx.ch.length], c)) n++;
    const vc = voice(c, v === 'break' ? 55 : 52, prev, 4);
    prev = vc;
    p.add(b, 0, n * 16, vc, v0);
    b += n;
  }
};

/* ---------- melody ----------
   A hook from a motif: two bars stated (A), answered on the next chords (A'), a contrasting pair (B)
   and a cadence that comes home (A with a long last note on the root). Strong beats land on chord
   tones, the notes between move by step through the scale. */
const CELLS = {
  song: [
    [
      [0, 4],
      [4, 2],
      [6, 2],
      [8, 8]
    ],
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 4],
      [12, 4]
    ],
    [
      [2, 2],
      [4, 2],
      [6, 2],
      [8, 6],
      [14, 2]
    ],
    [
      [0, 6],
      [6, 2],
      [8, 2],
      [10, 2],
      [12, 4]
    ]
  ],
  hard: [
    [
      [0, 2],
      [2, 1],
      [3, 1],
      [4, 4],
      [8, 2],
      [10, 2],
      [12, 4]
    ],
    [
      [0, 1],
      [1, 1],
      [2, 2],
      [6, 2],
      [8, 4],
      [12, 2],
      [14, 2]
    ],
    [
      [0, 4],
      [6, 2],
      [8, 2],
      [10, 1],
      [11, 1],
      [12, 4]
    ]
  ],
  trance: [
    [
      [0, 2],
      [2, 2],
      [4, 2],
      [6, 2],
      [8, 2],
      [10, 2],
      [12, 4]
    ],
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 3],
      [11, 3],
      [14, 2]
    ]
  ],
  trap: [
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 6],
      [14, 2]
    ],
    [
      [4, 2],
      [6, 2],
      [8, 4],
      [12, 2],
      [14, 2]
    ]
  ],
  whine: [
    [
      [0, 6],
      [6, 2],
      [8, 8]
    ],
    [
      [2, 2],
      [4, 4],
      [8, 4],
      [12, 4]
    ]
  ],
  sparse: [
    [
      [0, 12],
      [12, 4]
    ],
    [
      [0, 8],
      [8, 8]
    ]
  ]
};
const CONTOURS = [
  [0, 1, 2, 1, 0],
  [2, 1, 0, -1, 0],
  [0, 2, 1, 3, 2],
  [0, -1, 1, 0, 2],
  [4, 3, 2, 1, 0]
];
/* ---------- this take's own bass, chords and arp (from compose-gen.js) ---------- */
/* the variants the generated parts write (the intro, builds, half-time and breaks keep the style's) */
const GEN_V = new Set(['A', 'B', 'C', 'drop', 'hook', 'verse', 'pre', 'outro']);
const BASS_LO = { roll: 40, off: 40, drive: 40, sparse: 36, 808: 34, funk: 40, walk: 40, reggae: 38, pop: 40 };
const FOUR = new Set(['house', 'techhouse', 'afro', 'techno', 'minimal', 'trance', 'disco']);
/* the take's bar templates: Main plays one, Main B the same changed a little, Main C another */
function genBass(p, v, ctx) {
  const feel = ctx.motif.bass,
    tr = mulberry(hashStr('bass:' + feel) ^ ctx.motif.seed),
    A = genBassT(tr, feel),
    A2 = mutateBassT(tr, A),
    C = genBassT(tr, feel),
    bars =
      v === 'B'
        ? [A, A2]
        : v === 'C'
          ? [C, mutateBassT(tr, C)]
          : v === 'drop' || v === 'hook'
            ? [A2, mutateBassT(tr, A2)]
            : [A, A];
  const { ch, nb, r } = ctx,
    lo = BASS_LO[feel] || 40,
    thin = v === 'verse' || v === 'pre' || v === 'outro';
  for (let b = 0; b < nb; b++) {
    const c = ch[b % ch.length],
      next = ch[(b + 1) % ch.length],
      root = bassNote(c, lo);
    for (const [s, len, iv] of bars[b % 2]) {
      if (b === nb - 1 && s >= 12) continue;
      if (thin && s % 8 && r() < 0.45) continue;
      let n;
      if (iv === 'A') {
        const to = bassNote(next, lo);
        n = to === root ? root + 7 : to + (to > root ? -1 : 1);
      } else n = typeof iv === 'string' ? root + (c.tones[+iv.slice(1)] ?? 7) : root + iv;
      p.add(b, s, len, n, hum(r, s % 4 === 0 ? 116 : 100, 5));
    }
  }
}
function genChords(p, v, ctx) {
  const tr = mulberry(hashStr('comp') ^ ctx.motif.seed),
    fam = FOUR.has(ctx.recipe.gr) ? 'four' : ctx.fam === 'edm' ? 'four' : ctx.fam,
    A = genComp(tr, fam),
    B = genComp(tr, fam),
    C = genComp(tr, fam),
    bars =
      v === 'B' ? [B, A] : v === 'C' ? [C, B] : v === 'verse' || v === 'pre' ? [[[0, 16, 76]], [[0, 16, 72]]] : [A, A],
    size = (ctx.recipe.ext || 0) >= 7 ? 4 : 3;
  chordBars(p, { ...ctx, gap: true }, b => bars[b % 2], v === 'drop' ? 64 : 62, 96, size);
}
function genArpPart(p, v, ctx, center, step0) {
  const { ch, nb, r } = ctx,
    g = ctx.motif.arp,
    step = Math.max(step0, g.rate),
    tr = mulberry(hashStr('arp') ^ ctx.motif.seed);
  let prev = null;
  for (let b = 0; b < nb; b++) {
    const vc = voice(ch[b % ch.length], center, prev, 3);
    prev = vc;
    const up = g.span > 1 ? [...vc, ...vc.map(x => x + 12)] : [...vc, vc[0] + 12];
    const seq =
      g.order === 'down'
        ? [...up].reverse()
        : g.order === 'updown'
          ? [...up, ...up.slice(1, -1).reverse()]
          : g.order === 'broken'
            ? [up[0], up[2], up[1], up[3] ?? up[0] + 12]
            : g.order === 'pedal'
              ? up.slice(1).flatMap(x => [up[0], x])
              : g.order === 'random'
                ? up
                    .map(x => [tr(), x])
                    .sort((a, c) => a[0] - c[0])
                    .map(x => x[1])
                : up;
    for (let i = 0, s = 0; s < 16; s += step, i++) {
      if (g.gaps.includes(i % 8)) continue;
      if (b === nb - 1 && s >= 12 && v === 'drop') continue;
      p.add(b, s, step, seq[i % seq.length], hum(r, (s % 4 === 0 ? 76 : 64) - (v === 'drop' ? 8 : 0), 4));
    }
  }
}

function melody(p, v, ctx, center = 72) {
  const { ch, r, nb, scale, key, recipe, motif } = ctx;
  const sc = SCALES[scale] || SCALES.minor,
    inScale = n => sc.includes((((n - key) % 12) + 12) % 12);
  const cells = CELLS[recipe.lead] || CELLS.song;
  const cellOf = x =>
      motif.cells
        ? motif.cells[x]
        : cells[(x === 'A' ? motif.a : x === 'B' ? motif.b : motif.a + motif.b + 3) % cells.length],
    contour = motif.shape || CONTOURS[motif.c % CONTOURS.length],
    form = motif.form || ['A', 'A', 'B', 'A'];
  let last = center;
  const chordTone = (c, target) => {
    let best = null;
    for (const t of c.tones)
      for (let o = -2; o <= 2; o++) {
        const n = nearest((c.root + t) % 12, target) + o * 12;
        if (best === null || Math.abs(n - target) < Math.abs(best - target)) best = n;
      }
    return best;
  };
  const stepTo = (from, dir) => {
    let n = from + dir;
    while (!inScale(n)) n += dir;
    return n;
  };
  const phrase = (bar, cell, shape, cadence) => {
    /* the cell spreads over two bars: the first bar has the cell, the second its echo, shifted */
    const notes = [];
    for (const half of [0, 1]) {
      const b = bar + half,
        c = ch[b % ch.length];
      cell.forEach(([s, len], i) => {
        const strong = s % 4 === 0;
        const target = center + (shape[Math.min(i, shape.length - 1)] + (half ? motif.lift : 0)) * 2;
        let n = strong ? chordTone(c, (target + last) / 2) : stepTo(last, target >= last ? 1 : -1);
        if (Math.abs(n - last) > 9) n = chordTone(c, last);
        /* a strong beat that would repeat the last note moves to the next chord tone the line is heading for */
        if (strong && n === last && i) {
          const dir = target >= last ? 1 : -1;
          n = chordTone(c, last + dir * 3);
          if (n === last) n = chordTone(c, last + dir * 5);
        }
        notes.push([b, s, len, n]);
        last = n;
      });
    }
    if (cadence) {
      const lastN = notes[notes.length - 1],
        c = ch[lastN[0] % ch.length];
      lastN[3] = chordTone({ root: c.root, tones: [0] }, lastN[3]);
      lastN[2] = 16 - lastN[1];
    }
    return notes;
  };
  const vel = v === 'break' ? 92 : v === 'verse' ? 96 : 110;
  const all = [];
  /* four 2-bar phrases by the take's plan: an A again goes a step higher, B and C answer the other way,
     the last comes home */
  for (let b = 0; b < nb; b += 8)
    form.forEach((x, i) => {
      const shape =
        x !== 'A'
          ? [...contour].reverse()
          : i && form.slice(0, i).includes('A') && i < 3
            ? contour.map(y => y + 1)
            : contour;
      all.push(...phrase(b + i * 2, cellOf(x), shape, i === 3));
    });
  for (const [b, s, len, n] of all) {
    if (b >= nb) continue;
    if (v === 'verse' && s % 8 === 6 && r() < 0.4) continue;
    if (v === 'break') {
      if (s % 4) continue;
      p.add(b, s, Math.max(len, 4), n, hum(r, vel));
    } else p.add(b, s, len, n, hum(r, vel, 5));
  }
}

/* ---------- arps and risers ---------- */
const arp = (p, v, ctx) => {
  const { ch, nb, r, recipe } = ctx;
  if (v === 'rise') {
    const root = nearest(ch[0].root, 60);
    for (let b = 0; b < nb - 2; b++) p.add(b, 0, 16, root + b * 2, 70 + b * 6);
    for (let i = 0, s = (nb - 2) * 16; s < nb * 16 - 4; s++, i++)
      p.add(Math.floor(s / 16), s % 16, 1, root + 12 + Math.floor(i / 2), 90 + i);
    return;
  }
  const step = v === 'break' || v === 'intro' ? 2 : 1,
    center = v === 'drop' ? 72 : 67;
  if (ctx.motif.arp) return genArpPart(p, v, ctx, center, step);
  let prev = null;
  for (let b = 0; b < nb; b++) {
    const vc = voice(ch[b % ch.length], center, prev, 3);
    prev = vc;
    const seq = [...vc, vc[0] + 12, vc[1] + 12, ...vc.slice(1).reverse()].concat(
      recipe.gr === 'trance' ? [vc[0] + 12] : []
    );
    for (let i = 0, s = 0; s < 16; s += step, i++) {
      if (b === nb - 1 && s >= 12 && v === 'drop') continue;
      p.add(b, s, step, seq[i % seq.length], hum(r, (s % 4 === 0 ? 76 : 64) - (v === 'drop' ? 8 : 0), 4));
    }
  }
};

/* ---------------------------------------------------------------- sounds ----
   Factory sounds for each part: kits for the drum roles, tones by part and variant ([intro, main A,
   main B, main C, break/hook]); a list cycles. All names are the MC-707's own. */
const KITS = {
  dnb: ['Drum&Bass Kit 1', 'HipHop Kit 2', 'EDM Kit  5', 'Drum&Bass Kit 2'],
  house: ['House Kit 1', 'TR-909 1', 'EDM Kit 10', 'House Kit 2'],
  techno: ['Techno Kit 1', 'TR-909 3', 'Techno Kit 2', 'TR-909 4'],
  trance: ['Trance Kit', 'TR-909 1', 'EDM Kit  5', 'EDM Kit  2'],
  garage: ['TR-909 2', 'TR-909 1', 'EDM Kit 10', 'House Kit 2'],
  dubstep: ['EDM Kit 10', 'Future Bass Kit', 'EDM Kit  5', 'EDM Kit  3'],
  breaks: ["90's Kit 1", 'HipHop Kit 1', 'EDM Kit  5', "90's Kit 2"],
  electro: ['TR-808 1', 'TR-808 2', 'TR-808 3', 'TR-606 1'],
  boombap: ['HipHop Kit 1', 'HipHop Kit 2', 'Perc. Kit 1', 'R&B Kit 1'],
  lofi: ['HipHop Kit 2', 'R&B Kit 2', 'Perc. Kit 3', 'R&B Kit 1'],
  trap: ['Trap Kit', 'TR-808 2', 'EDM Kit  5', 'TR-808 4'],
  phonk: ['Trap Kit', 'TR-808 1', 'TR-808 3', 'TR-808 4'],
  funk: ['Studio Kit 1', 'Studio Kit 1', 'Perc. Kit 2', 'Studio Kit 2'],
  disco: ['Pop Kit 1', 'TR-909 1', 'Perc. Kit 2', "80's Kit 1"],
  reggae: ['Studio Kit 2', 'Studio Kit 2', 'Perc. Kit 1', 'Studio Kit 1'],
  dembow: ['Reggaeton Kit', 'Reggaeton Kit', 'Perc. Kit 1', 'TR-808 1'],
  afro: ['House Kit 2', 'Perc. Kit 1', 'Perc. Kit 3', 'House Kit 1'],
  synth: ["80's Kit 1", 'TR-707&727 1', 'EDM Kit  5', "80's Kit 2"],
  pop: ['Pop Kit 1', 'Pop Kit 2', 'EDM Kit  5', 'Studio Kit 1'],
  ambient: ['Perc. Kit 3', 'Perc. Kit 1', 'SFX Kit 1', 'Perc. Kit 2'],
  cinematic: ['Perc. Kit 2', 'Perc. Kit 3', 'SFX Kit 1', 'Studio Kit 2']
};
const KIT_OF = {
  jungle: 'dnb',
  dnbHalf: 'dnb',
  techhouse: 'house',
  afro: 'afro',
  minimal: 'techno',
  drill: 'trap'
};
/* tones: [bass, chords, pad, lead, pluck, acid] lists; bass by variant [intro, A, B, C, half] */
const T = (bass, chords, pad, lead, pluck, extra = {}) => ({ bass, chords, pad, lead, pluck, ...extra });
const SOUNDS = {
  liquid: T(
    ['Sine Bass', 'Sine Bass', 'Round Bass', 'MG Deep Bass', 'Wub Bass'],
    ['AX Vintage EP', 'Delicate EP', 'Spirit Tine'],
    ['Heaven Pad 1', 'AX Heaven Pad', 'Soft Pad 2'],
    ['Sine Lead 1', 'AX Soft Lead', 'Juno Soft Ld'],
    ['Syn Atk Pluck', 'Sine Seq MC', 'Sine Pluck']
  ),
  neuro: T(
    ['Sine Bass', 'SC1 Growl Bass1', 'Razor BassLead1', 'SC1 Growl Bass5', 'Wub Bass'],
    ['Rave Stab', 'JUNO Stab', 'Horn Blast'],
    ['Boreal Pad', 'Heaven Pad 1', 'Soft Pad 2'],
    ['Growl Lead', 'Dist Sync Lead', 'X-Mod Lead'],
    ['Sine Seq MC', 'Atmos Harp', 'Sweep Stab']
  ),
  jungle: T(
    ['Sine Bass', 'MG Deep Bass', 'Sine Bass', 'X-MOD2 Bass1A', 'Wub Bass'],
    ['Rave Stab', 'AX Orchestra Hit', 'JUNO Stab'],
    ['Boreal Pad', 'Vox Pad 1', 'Soft Pad 2'],
    ['Dist Sync Lead', 'Voice Lead1', 'AX Soft Lead'],
    ['Sine Seq MC', 'Atmos Harp', 'Sweep Stab']
  ),
  jumpup: T(
    ['Sine Bass', 'Razor BassLead1', 'Step Growl Bass2', 'X-MOD2 Bass1B', 'Wub Bass'],
    ['Horn Blast', 'Rave Stab', 'AX Orchestra Hit'],
    ['Boreal Pad', 'Soft Pad 2'],
    ['Growl Lead', 'Hoover Lead'],
    ['Sine Seq MC', 'Sweep Stab']
  ),
  boombap: T(
    ['Finger E Bs 1', 'Finger E Bs 1', 'Acoustic Bs 1', 'Finger E Bs 2', 'Acoustic Bs 1'],
    ['AX Vintage EP', 'Wurly EP', 'AX Piano'],
    ['AX Mood Strings', 'Soft Pad 1'],
    ['Warm Vibes', 'AX Soft Lead'],
    ['AX Kalimba', 'AX Marimba']
  ),
  trap: T(
    ['Dist.808StyleBs1', 'Dist.808StyleBs1', 'Dist.808StyleBs2', 'Dist.808StyleBs3', 'Dist.808StyleBs1'],
    ['Bright Piano', 'Bell 1', 'AX Piano'],
    ['Horror Pad', 'Vox Pad 1'],
    ['Bell Lead 1', 'Pop Synth Pluck', 'Sine Lead 1'],
    ['Bell 2', 'AX Marimba']
  ),
  drill: T(
    ['Dist.808StyleBs2', 'Dist.808StyleBs2', 'Dist.808StyleBs3', 'Dist.808StyleBs1', 'Dist.808StyleBs2'],
    ['AX Mood Strings', 'Bright Piano'],
    ['Horror Pad', 'Vox Pad 2'],
    ['Bell Lead 2', 'Sine Lead 1'],
    ['Bell 3', 'AX Marimba']
  ),
  phonk: T(
    ['Dist.808StyleBs1', 'Dist.808StyleBs1', 'Dist.808StyleBs3', 'Dist.808StyleBs2', 'Dist.808StyleBs1'],
    ['Bright Piano', 'AX Org Bell'],
    ['Horror Pad', 'Vox Pad 1'],
    ['Bell Lead 1', 'Whistle Lead'],
    ['Bell 1', 'AX Marimba']
  ),
  lofi: T(
    ['Acoustic Bs 1', 'Acoustic Bs 1', 'Finger E Bs 3', 'Acoustic Bs 2', 'Acoustic Bs 1'],
    ['AX Vintage EP', 'Wurly EP', 'Delicate EP'],
    ['Tape Strings', 'Soft Pad 1'],
    ['Warm Vibes', 'AmbienceVibe'],
    ['AX Kalimba', 'AX Marimba']
  ),
  neosoul: T(
    ['Finger E Bs 2', 'Finger E Bs 2', 'AX Fretless Bs', 'Finger E Bs 4', 'Finger E Bs 2'],
    ['AX Vintage EP', 'Stage EP', 'Spirit Tine'],
    ['AX Mood Strings', 'Soft Pad 2'],
    ['Warm Vibes', 'Syn VoiceLead 1'],
    ['AX Kalimba', 'EP Belle']
  ),
  gfunk: T(
    ['MG Bs 1', 'MG Bs 1', 'MG Bs 3', 'Fat MG Bass', 'MG Bs 1'],
    ['AX Vintage EP', 'Wurly EP'],
    ['AX JP Strings', 'Soft Pad 1'],
    ['Portament Ld', 'Sine Lead 1', 'Whistle Lead'],
    ['AX Kalimba', 'Syn Atk Pluck']
  ),
  deephouse: T(
    ['MG Deep Bass', 'House Bs', 'Round Bass', 'MG Deep Bass', 'Soft Bass'],
    ['House Piano', 'GarageChd MC', 'AX Vintage EP'],
    ['JP8 Strings1', 'Soft Pad 2'],
    ['Bell Lead 2', 'Syn VoiceLead 1'],
    ['SEQ 6', 'Syn Atk Pluck']
  ),
  house: T(
    ['House Bs', 'House Bs', 'Round Bass', 'MG Bs 1', 'House Bs'],
    ['House Piano', 'Bright Piano', 'GarageChd MC'],
    ['JP8 Strings1', 'OB Strings'],
    ['Bell Lead 2', 'AX Vibraphone'],
    ['SEQ 6', 'Syn Atk Pluck']
  ),
  techhouse: T(
    ['Rubber Bs 1', 'Rubber Bs 1', 'Punch MG Bs', 'Rubber Bs 2', 'Rubber Bs 1'],
    ['1Note PhaserEP1', 'JUNO Stab', 'Rave Stab2'],
    ['Chronic Pad', 'Glass Pad'],
    ['Tekno Ld 1', 'Pulse Lead 1'],
    ['SEQ 1', 'Sine Seq MC']
  ),
  afrohouse: T(
    ['Round Bass', 'Round Bass', 'MG Deep Bass', 'House Bs', 'Round Bass'],
    ['House Piano', 'AX Marimba', 'GarageChd MC'],
    ['JP8 Strings1', 'Heaven Pad 1'],
    ['AX Vibraphone', 'Syn VoiceLead 1'],
    ['AX Kalimba', 'AX Marimba']
  ),
  techno: T(
    ['TB Bass 1', 'TB Bass 1', 'MC202 Bs 1', 'Punch MG Bs', 'TB Bass 1'],
    ['1Note Organ MC', 'JUNO Stab', 'Rave Stab'],
    ['Chronic Pad', 'GlassFx Pad'],
    ['Tekno Ld 1', 'Pulse Lead 1'],
    ['SEQ 1', 'Sine Seq MC']
  ),
  acid: T(
    ['TB Bass 1', 'TB Bass 1', 'TB Dist Bs 1', 'TB Bass 2', 'TB Bass 1'],
    ['JUNO Stab', 'Rave Stab'],
    ['Chronic Pad', 'GlassFx Pad'],
    ['Tekno Ld 1', 'Dist TB Lead'],
    ['SEQ 1', 'Sine Seq MC'],
    { acid: ['TB Bass 1', 'TB Dist Bs 1', 'TB Bass 2'] }
  ),
  garage: T(
    ['AX Garage Bass', 'AX Garage Bass', 'Garage Bs 1', 'Garage Bs 2', 'AX Garage Bass'],
    ['GarageChd MC', '1Note GarageEP', 'AX Vintage EP'],
    ['Reverie Pad', 'JUNO Str 1'],
    ['Syn VoiceLead 1', 'Voice Lead1'],
    ['EP Belle', 'Syn Atk Pluck']
  ),
  dubstep: T(
    ['Sine Bass', 'Wub Bass', 'SC1 Growl Bass1', 'SC1 Growl Bass3', 'Wub Bass'],
    ['AX Orchestra Hit', 'Min7 Hit'],
    ['Horror Pad', 'Metal Pad'],
    ['X-MOD Lead', 'Growl Lead'],
    ['Seq X-Mod Wave 1', 'Feedback Pluck']
  ),
  trance: T(
    ['Fat Analog Bs', 'Fat Analog Bs', 'Unison Bass 1', 'Fat Analog Bs', 'Fat Analog Bs'],
    ['Phase Super Saw', 'Super Saw Key 1'],
    ['Trance Pad', 'Trance Sweep Pad'],
    ['SuperSaw Ld', 'Super Saw Lead'],
    ['Syn Atk Pluck', 'SEQ 5', 'Super Saw Pluck']
  ),
  electro: T(
    ['101 Bass', '101 Bass', 'SH-101 Bs 1', 'Compu Bs', '101 Bass'],
    ['JUNO Stab', 'Rave Stab'],
    ['Chronic Pad', 'Glass Pad'],
    ['Square Ld 1', 'Pulse Lead 1'],
    ['SEQ 3', 'Sine Seq MC']
  ),
  bigbeat: T(
    ['Dist Bass', 'Dist Bass', 'TB Dist Bass', 'Dist Atk Bs', 'Dist Bass'],
    ['Rave Stab', 'Brass Sect', 'AX Orchestra Hit'],
    ['Rotary Org 1', 'Lord Organ 1'],
    ['Hoover Lead', 'Fuzz Lead'],
    ['Funk Gtr', 'Sine Seq MC']
  ),
  funk: T(
    ['AX Slap Bass', 'AX Slap Bass', 'Finger E Bs 1', 'Pick Bass 1', 'AX Slap Bass'],
    ['AX Clav 1', 'Funk Gtr', 'Twah Clav'],
    ['Brass Sect', 'Soft Brass 1'],
    ['Brass Sect', 'Funky Lead'],
    ['AX Clav 2', 'Funk Gtr']
  ),
  disco: T(
    ['Finger E Bs 1', 'Finger E Bs 1', 'Pick Bass 1', 'Finger E Bs 2', 'Finger E Bs 1'],
    ['Funk Gtr', 'Bright Piano', 'AX Clav 1'],
    ['OB Strings', 'AX 60s Strings'],
    ['Brass Sect', 'Syn Brass 1'],
    ['AX Clav 2', 'Strings 1']
  ),
  reggae: T(
    ['Finger E Bs 3', 'Finger E Bs 3', 'Acoustic Bs 2', 'Finger E Bs 3', 'Finger E Bs 3'],
    ['Rotary Org 1', 'AX Piano', 'Funk Gtr'],
    ['Vintage Organ 1', 'Organ Pad 1'],
    ['AX Soft Lead', 'Brass Sect'],
    ['AX Marimba', 'Echo Pluck']
  ),
  dub: T(
    ['Sine Bass', 'Finger E Bs 3', 'Sine Bass', 'Finger E Bs 3', 'Sine Bass'],
    ['Rotary Org 1', 'Echo Piano'],
    ['Organ Pad 1', 'Slow Air Pad'],
    ['Echo Vibe', 'Sine Lead 1'],
    ['Echo Pluck', 'PW-Echo Seq']
  ),
  dancehall: T(
    ['Sine Bass', 'Sine Bass', 'Dist.808StyleBs1', 'Round Bass', 'Sine Bass'],
    ['Bright Piano', 'Syn Atk Pluck'],
    ['Soft Pad 2', 'JUNO Str 1'],
    ['Sine Lead 1', 'Whistle Lead'],
    ['AX Marimba', 'AX Kalimba']
  ),
  reggaeton: T(
    ['Dist.808StyleBs1', 'Dist.808StyleBs1', 'Sine Bass', 'Dist.808StyleBs2', 'Dist.808StyleBs1'],
    ['Pop Synth Pluck', 'Bright Piano'],
    ['Soft Pad 2', 'Vox Pad 1'],
    ['Pop Synth Pluck2', 'Sine Lead 1'],
    ['AX Marimba', 'Pop SynthMallet']
  ),
  afrobeats: T(
    ['Round Bass', 'Round Bass', 'Finger E Bs 1', 'MG Deep Bass', 'Round Bass'],
    ['AX Marimba', 'Bright Piano', 'AX Clean Guitar'],
    ['Soft Pad 2', 'JUNO Str 1'],
    ['Syn VoiceLead 1', 'AX Soft Lead'],
    ['AX Kalimba', 'AX Marimba']
  ),
  synthwave: T(
    ['JunoSqr Bs 1', 'JunoSqr Bs 1', 'Fat Analog Bs', '106 Bass 1', 'JunoSqr Bs 1'],
    ['Juno Brass', 'AX JP Strings', 'Poly Brass 1'],
    ['JP-8 Pad 1', 'JUNO Str 1'],
    ['AX Jupiter Ld 1', 'Juno Soft Ld'],
    ['JunoArpeggio MC', 'Syn Atk Pluck']
  ),
  pop: T(
    ['Finger E Bs 1', 'Finger E Bs 1', 'Round Bass', 'Fat Analog Bs', 'Finger E Bs 1'],
    ['Bright Piano', 'Nice Piano', 'Pop Synth Pluck'],
    ['Soft Pad 2', 'JUNO Str 1'],
    ['Pop Synth Pluck2', 'Syn VoiceLead 1', 'Bell Lead 1'],
    ['Pop SynthMallet', 'Syn Atk Pluck']
  ),
  indie: T(
    ['Pick Bass 1', 'Pick Bass 1', 'Finger E Bs 2', 'Pick Bass 2', 'Pick Bass 1'],
    ['AX Clean Guitar', 'Rock Piano', 'Folk Gtr 1'],
    ['Tape Strings', 'Soft Pad 1'],
    ['Sine Lead 1', 'AX Soft Lead'],
    ['Folk Gtr 2', 'AX Marimba']
  ),
  ambient: T(
    ['Sine Bass', 'Sine Bass', 'Soft Bass', 'Sine Bass', 'Sine Bass'],
    ['Glass Pad', 'Cloud Pad'],
    ['Shimmer Pad', 'Scape Pad', 'Angels Pad'],
    ['AmbienceVibe', 'Air Lead'],
    ['Pretty Bells', 'Stream Bell']
  ),
  cinematic: T(
    ['Sine Bass', 'Sine Bass', 'AX Bass Hit', 'Sine Bass', 'Sine Bass'],
    ['AX Strings Stacc', 'Brass Sect'],
    ['Strings 1', 'AX Mood Strings', 'AX Choir 1'],
    ['Strings4Film', 'Symph Horns'],
    ['AX Tubular Bells', 'Mallet Pipes']
  )
};
const VIDX = { intro: 0, A: 1, B: 2, C: 3, half: 4, build: 0, verse: 1, pre: 2, outro: 0 };
function soundFor(role, v, recipe, i) {
  const S = SOUNDS[recipe.sound] || SOUNDS.pop;
  if (role === 'kit' || role === 'hats' || role === 'perc') {
    const kits = KITS[KIT_OF[recipe.gr] || recipe.gr] || KITS.pop;
    if (role === 'kit') return v === 'C' || v === 'half' ? kits[3] : kits[0];
    if (role === 'hats') return kits[1];
    return kits[2];
  }
  if (role === 'bass') return S.bass[VIDX[v] ?? 1] || S.bass[1];
  if (role === 'acid') return (S.acid || S.bass)[(VIDX[v] ?? 1) % (S.acid || S.bass).length];
  const list = S[role] || [];
  if (!list.length) return null;
  if (role === 'lead') return v === 'break' ? list[list.length > 1 ? 1 : 0] : list[0];
  if (role === 'pad') return v === 'break' ? list[1 % list.length] : v === 'drop' ? list[list.length - 1] : list[0];
  if (role === 'pluck') return v === 'rise' ? list[list.length - 1] : v === 'break' ? list[1 % list.length] : list[0];
  if (role === 'chords') return list[(VIDX[v] ?? 1) % list.length] || list[0];
  return list[i % list.length];
}

/* -------------------------------------------------------------- compose ---- */
/**
 * Compose a song.
 * @param {{id:string, fam:string, bpm:number[], swing?:number, scale?:string, keys?:[number,string][]}} style
 * @param {{key?:number, bpm?:number, minutes?:number, seed?:number}} [opts]
 * @returns {{bpm:number, swing:number, key:number, scale:string, prog:string,
 *   sections:{name:string, kind:string, bars:number, parts:Object<string,string>}[],
 *   patterns:Object<string,{role:string, variant:string, name:string, bars:number, type:'drum'|'tone', notes:object[]}>,
 *   sounds:Object<string,string>}}  parts: role → pattern key; sounds: pattern key → factory sound name
 */
/* ------------------------------------------------------------- the take ----
   Every take (seed) plays the parts its own way, like a different band on the same song: the drummer
   picks where the extra kicks and ghost snares go, how the hats and percussion move; the bass player
   jumps octaves, walks into the next chord or leaves space; the keys player picks an inversion and
   pushes the changes; the arp finds its own order. A take's choices are the same for every variant
   of a part (Main, Main B and the drop share the feel), so the song still hangs together. */
const pick = (r, a) => a[Math.floor(r() * a.length)];
const pickN = (r, a, n) => {
  const b = [...a],
    out = [];
  while (b.length && out.length < n) out.push(b.splice(Math.floor(r() * b.length), 1)[0]);
  return out;
};
function takeVary(p, role, v, ctx, tr) {
  const nb = p.bars,
    at = (b, s) => b * 16 + s,
    has = (s, lanes) => p.notes.some(n => n.s === s && (!lanes || lanes.includes(n.n))),
    bar = n => Math.floor(n.s / 16),
    step = n => n.s % 16;
  /* which bars get the take's extra touches: every other bar, the end of each 4, or all of them */
  const mode = tr(),
    inBars = mode < 0.4 ? b => b % 2 === 1 : mode < 0.75 ? b => b % 4 === 3 : () => true;
  if (role === 'kit') {
    const k0 = p.notes.filter(n => n.n === K && n.s < 16).map(step),
      four = [0, 4, 8, 12].every(s => k0.includes(s));
    const sn = new Set(p.notes.filter(n => n.n === SN || n.n === CL).map(step));
    /* extra kicks where the snare is not */
    const cand = (four ? [7, 14, 15] : [2, 3, 6, 7, 10, 11, 14, 15]).filter(s => !sn.has(s));
    const adds = pickN(tr, cand, four ? (tr() < 0.6 ? 1 : 0) : 1 + Math.floor(tr() * 2)),
      kv = four ? 52 + Math.floor(tr() * 14) : 74 + Math.floor(tr() * 22);
    for (let b = 0; b < nb; b++)
      if (inBars(b)) for (const s of adds) if (!has(at(b, s), [K])) p.add(b, s, 1, K, hum(tr, kv, 5));
    /* one kick fewer in the answering bars */
    if (!four && tr() < 0.4) {
      const off = pick(tr, [3, 6, 7, 10, 11, 14]);
      p.notes = p.notes.filter(n => !(n.n === K && step(n) === off && inBars(bar(n))));
    }
    /* ghost snares between the backbeats */
    if (!four || tr() < 0.3) {
      const ghosts = pickN(
          tr,
          [1, 3, 5, 6, 9, 11, 13, 15].filter(s => !sn.has(s)),
          1 + Math.floor(tr() * 2)
        ),
        all = tr() < 0.5;
      for (let b = 0; b < nb; b++)
        if (all || inBars(b)) for (const s of ghosts) if (!has(at(b, s))) p.add(b, s, 1, SN, hum(tr, 34, 6));
    }
    /* a turn into the next phrase */
    if (v !== 'drop' && v !== 'half' && tr() < 0.45) {
      const kind = pick(tr, ['snare', 'toms', 'flam']);
      for (const b of [3, 7].filter(x => x < nb)) {
        if (p.notes.filter(n => bar(n) === b && step(n) >= 12 && (n.n === SN || n.n >= LT)).length > 2) continue;
        if (kind === 'snare') for (const s of [13, 14, 15]) p.add(b, s, 1, SN, 70 + (s - 13) * 18);
        else if (kind === 'toms') p.add(b, 13, 1, HT, 96).add(b, 14, 1, MT, 104).add(b, 15, 1, LT, 112);
        else p.add(b, 14, 1, SN, 60).add(b, 15, 1, SN, 104);
      }
    }
    return;
  }
  if (role === 'hats') {
    const perBar = p.notes.filter(n => n.n === CH && n.s < 16).length;
    const ops = pickN(
      tr,
      ['open', 'accent', 'thin', 'skip', 'ride', 'gallop', 'pickup', 'drop1'],
      1 + Math.floor(tr() * 3)
    );
    if (ops.includes('open')) {
      const s = pick(tr, [2, 6, 10, 14, 7, 15]),
        every = tr() < 0.5;
      for (let b = 0; b < nb; b++)
        if (every || inBars(b)) {
          p.notes = p.notes.filter(n => !(n.s === at(b, s) && n.n === CH));
          if (!has(at(b, s), [OH])) p.add(b, s, 1, OH, hum(tr, 70, 6));
        }
    }
    if (ops.includes('accent')) {
      const shape = pick(tr, [
          [1, 0.62, 0.86, 0.62],
          [0.8, 0.6, 1, 0.6],
          [1, 0.7, 0.7, 0.9],
          [0.75, 0.95, 0.75, 0.95]
        ]),
        top = Math.max(1, ...p.notes.filter(n => n.n === CH).map(n => n.v));
      for (const n of p.notes) if (n.n === CH) n.v = Math.max(20, Math.round(top * shape[step(n) % 4] - tr() * 6));
    }
    if (ops.includes('thin') && perBar >= 12) {
      const cls = pick(tr, [1, 3]);
      p.notes = p.notes.filter(n => !(n.n === CH && step(n) % 4 === cls && inBars(bar(n))));
    }
    if (ops.includes('skip'))
      for (const b of [3, 7].filter(x => x < nb))
        p.notes = p.notes.filter(n => !(bar(n) === b && step(n) >= 13 && (n.n === CH || n.n === OH)));
    /* 8th hats with a 16th after some of them */
    if (ops.includes('gallop') && perBar <= 8) {
      const where = pick(tr, [
        [3, 11],
        [7, 15],
        [3, 7, 11, 15]
      ]);
      for (let b = 0; b < nb; b++)
        if (inBars(b)) for (const s of where) if (!has(at(b, s), [CH, OH])) p.add(b, s, 1, CH, hum(tr, 44, 5));
    }
    /* a hat into the next bar */
    if (ops.includes('pickup'))
      for (let b = 0; b < nb; b++) if (inBars(b) && !has(at(b, 15), [CH, OH])) p.add(b, 15, 1, CH, hum(tr, 56, 5));
    /* the first hat of the answering bars left out, for the kick */
    if (ops.includes('drop1'))
      p.notes = p.notes.filter(n => !(step(n) === 0 && n.n === CH && inBars(bar(n)) && bar(n) > 0));
    if (ops.includes('ride') && perBar <= 8)
      for (let b = 0; b < nb; b++)
        if (inBars(b)) for (const s of [0, 4, 8, 12]) if (!has(at(b, s), [RD])) p.add(b, s, 1, RD, hum(tr, 58, 6));
    return;
  }
  if (role === 'perc') {
    const op = pick(tr, ['rotate', 'rotate', 'swap', 'sparse', 'double', 'shift']);
    if (op === 'rotate') {
      const d = pick(tr, [2, 4, 6, 10, 12]);
      for (const n of p.notes) if (n.n !== CR && n.n !== K) n.s = bar(n) * 16 + ((step(n) + d) % 16);
    } else if (op === 'swap') {
      const to = pick(tr, [RIM, CL, PC]);
      for (const n of p.notes) if ((n.n === RIM || n.n === CL || n.n === PC) && tr() < 0.7) n.n = to;
    } else if (op === 'sparse') p.notes = p.notes.filter((n, i) => n.n === CR || i % 2 === 0 || !inBars(bar(n)));
    else if (op === 'double') {
      for (const n of [...p.notes])
        if (n.n !== CR && step(n) < 8 && !has(n.s + 8, [n.n])) p.add(bar(n), step(n) + 8, 1, n.n, hum(tr, n.v - 10, 5));
    } else if (op === 'shift') {
      const d = pick(tr, [1, 3]);
      for (const n of p.notes) if (n.n !== CR && n.n !== K && inBars(bar(n))) n.s = bar(n) * 16 + ((step(n) + d) % 16);
    }
    /* a percussion line of its own when the style has little: a shaker or rim figure the take picks */
    if (p.notes.filter(n => n.n !== CR).length < nb * 2 && tr() < 0.6) {
      const lane = pick(tr, [PC, RIM, CL]),
        fig = pick(tr, [
          [3, 11],
          [6, 14],
          [2, 7, 10, 15],
          [3, 6, 11, 14]
        ]);
      for (let b = 0; b < nb; b++)
        for (const s of fig) if (!has(at(b, s), [lane])) p.add(b, s, 1, lane, hum(tr, 62, 8));
    }
    return;
  }
  if (role === 'bass' || role === 'acid') {
    if (v === 'intro' || v === 'half') return;
    const ops = pickN(tr, ['octave', 'approach', 'space', 'approach'], 1 + Math.floor(tr() * 2));
    if (ops.includes('octave')) {
      const pos = pick(tr, [[2, 10], [6, 14], [3, 11], [7]]);
      for (const n of p.notes) if (pos.includes(step(n)) && n.n + 12 <= 60 && inBars(bar(n))) n.n += 12;
    }
    if (ops.includes('approach'))
      for (let b = 0; b < nb - 1; b++) {
        const next = p.notes.filter(n => n.s === at(b + 1, 0)).sort((x, y) => x.n - y.n)[0],
          last = p.notes.filter(n => bar(n) === b).sort((x, y) => y.s - x.s)[0];
        if (!next || !last || last.n % 12 === next.n % 12) continue;
        if (last.s + last.l > at(b, 15)) last.l = Math.max(1, at(b, 15) - last.s);
        if (!has(at(b, 15))) p.add(b, 15, 1, next.n + (tr() < 0.5 ? -1 : 2), hum(tr, 96, 6));
      }
    if (ops.includes('space')) {
      const off = pick(tr, [2, 3, 6, 7, 10, 11, 13, 14]);
      p.notes = p.notes.filter(n => !(step(n) === off && inBars(bar(n)) && n.s % 16 !== 0));
    }
    return;
  }
  if (role === 'chords' || role === 'pad') {
    const groups = new Map();
    for (const n of p.notes) (groups.get(n.s) || groups.set(n.s, []).get(n.s)).push(n);
    const inv = Math.floor(tr() * 3); /* 0 root position, 1 first inversion, 2 an open voicing */
    for (const g of groups.values()) {
      if (g.length < 3) continue;
      g.sort((x, y) => x.n - y.n);
      if (inv === 1) g[0].n += 12;
      else if (inv === 2 && g[0].n - 12 >= 40) g[g.length - 1].n -= 12;
    }
    /* push the changes: the new chord comes in a 16th early */
    if (role === 'chords' && tr() < 0.4) {
      for (const [s, g] of groups) {
        if (s % 16 !== 0 || s === 0) continue;
        const prev = groups.get(s - 16);
        if (prev && prev.map(n => n.n).join() === g.map(n => n.n).join()) continue;
        if (p.notes.some(n => n.s > s - 2 && n.s < s)) continue;
        for (const n of g) {
          n.s -= 1;
          n.l += 1;
        }
      }
      for (const n of p.notes) {
        const later = p.notes.find(m => m.n === n.n && m.s > n.s && m.s < n.s + n.l);
        if (later) n.l = later.s - n.s;
      }
    }
    return;
  }
  if (role === 'pluck') {
    const op = pick(tr, ['reverse', 'octave', 'gaps', 'rate', 'keep']);
    /* half the speed: every other note, held twice as long */
    if (op === 'rate' && p.notes.length && p.notes.every(n => n.l <= 1)) {
      p.notes = p.notes.filter(n => step(n) % 2 === 0);
      for (const n of p.notes) n.l = 2;
      return;
    }
    for (let b = 0; b < nb; b++) {
      const ns = p.notes.filter(n => bar(n) === b).sort((x, y) => x.s - y.s);
      if (op === 'reverse') {
        const pitches = ns.map(n => n.n).reverse();
        ns.forEach((n, i) => (n.n = pitches[i]));
      } else if (op === 'octave') ns.forEach((n, i) => i % 4 === 3 && n.n + 12 <= 96 && (n.n += 12));
    }
    if (op === 'gaps') {
      const g = pick(tr, [3, 7]);
      p.notes = p.notes.filter(n => step(n) % 8 !== g);
    }
  }
}

export function compose(style, opts = {}) {
  const c = composer(style, opts),
    out = [];
  c.sections.forEach((sec, i) => {
    const want = partsOf(sec, i, c.sections, c.fam, c.recipe),
      parts = {};
    for (const [role, v] of Object.entries(want)) {
      if (!v) continue;
      const k = c.make(role, v);
      if (k) parts[role] = k;
    }
    out.push({ name: sec.name, kind: sec.kind, bars: sec.bars, parts });
  });
  return {
    bpm: c.bpm,
    swing: style.swing || 50,
    key: c.key,
    scale: c.scale,
    prog: c.prog,
    sections: out,
    patterns: c.patterns,
    sounds: c.sounds
  };
}
/**
 * The composer for a style without the song: make(role, variant) writes one part (kept in .patterns under
 * 'role:variant', which make returns, or null when the part is silent), all from the same progression,
 * motif and groove. Live Mode builds its scenes from these (live/set-builder.js).
 * @returns {{make:(role:string, v:string)=>string|null, patterns:object, sounds:object, sections:object[],
 *   bpm:number, key:number, scale:string, prog:string, fam:string, recipe:object}}
 */
export function composer(style, opts = {}) {
  const recipe = recipeOf(style),
    seed = (opts.seed ?? 1) >>> 0,
    r = mulberry(hashStr(style.id + ':compose') ^ seed);
  const fam = recipe.form || style.fam;
  const bpm = Math.round(opts.bpm || (style.bpm && style.bpm[2]) || 120);
  const key = opts.key ?? (style.keys && style.keys[0] ? style.keys[0][0] : 9);
  /* the progression: one of the style's own, another of the same colour (minor, major, jazzy or a
     vamp), or a new one made for this take from how chords like to move (compose-gen.js), sometimes
     starting further round the loop */
  const own = recipe.progs[Math.floor(r() * recipe.progs.length)],
    kin = Object.keys(PROGS).filter(id => id[0] === own[0] || (own[0] === 'v' && /^m[1-7]/.test(id))),
    pr0 = r(),
    made = pr0 >= 0.45 ? genProg(r, own[0]) : null,
    progId = made
      ? 'g' + own[0] + ':' + made.join('.')
      : pr0 < 0.3 || kin.length < 2
        ? own
        : kin[Math.floor(r() * kin.length)],
    turn = !made && own[0] !== 'v' && r() < 0.3 ? 2 * (1 + Math.floor(r() * 3)) : 0;
  const colour = made ? own[0] : progId[0],
    scale = style.scale === 'major' && colour !== 'm' ? 'major' : progScale(colour, style.scale);
  /* sevenths (and ninths) from the scale for the styles that like them */
  const ch0 = chordsOf(made || progId, key, scale, recipe.ext || 0),
    ch = ch0.slice(turn).concat(ch0.slice(0, turn));
  const minutes = Math.max(1, Math.min(10, opts.minutes || (fam === 'dnb' || fam === 'edm' ? 5 : 3.5)));
  const sections = formOf(fam, Math.round((minutes * bpm) / 4));
  const motif = {
    a: Math.floor(r() * 9),
    b: Math.floor(r() * 9) + 1,
    c: Math.floor(r() * 9),
    lift: r() < 0.5 ? 1 : -1
  };
  /* this take's own material (compose-gen.js): melody rhythms and contour, the phrase plan, a bassline
     feel's templates, chord comping and an arp's way; otherwise the style's own writers */
  if (r() < 0.6) {
    motif.cells = { A: genCell(r, recipe.lead), B: genCell(r, recipe.lead), C: genCell(r, recipe.lead) };
    motif.shape = genShape(r);
  }
  motif.form = r() < 0.6 ? genForm(r) : ['A', 'A', 'B', 'A'];
  motif.bass = BASS_FEEL[recipe.bass] && r() < 0.55 ? BASS_FEEL[recipe.bass] : null;
  motif.comp = recipe.chords !== 'long' && r() < 0.45;
  motif.arp = r() < 0.5 ? genArp(r) : null;
  motif.seed = Math.imul(seed + 3, 2654435761);
  const gr = GR[recipe.gr] || GR.pop;
  const patterns = {},
    sounds = {};
  const make = (role, v) => {
    const k = role + ':' + v;
    if (patterns[k]) return k;
    const nb = 8,
      p = new Pat(nb),
      pr = mulberry(hashStr(k) ^ seed),
      ctx = { ch, r: pr, nb, scale, key, recipe, motif, fam };
    if (role === 'kit') gr.kit(p, pr, v, nb);
    else if (role === 'hats') gr.hats(p, pr, v, nb);
    else if (role === 'perc') gr.perc(p, pr, v, nb);
    else if (role === 'bass') (motif.bass && GEN_V.has(v) ? genBass : BASS[recipe.bass] || BASS.pop)(p, v, ctx);
    else if (role === 'acid') acidLine(p, ctx, v === 'A' ? 'A' : v === 'B' ? 'B' : 'C', 48);
    else if (role === 'chords')
      (motif.comp && GEN_V.has(v) ? genChords : CHORDS[recipe.chords] || CHORDS.pop)(p, v, ctx);
    else if (role === 'pad') padPart(p, v, ctx);
    else if (role === 'lead') melody(p, v, ctx, recipe.lead === 'trap' || recipe.lead === 'whine' ? 74 : 72);
    else if (role === 'pluck') arp(p, v, ctx);
    if (v !== 'build' && v !== 'rise')
      takeVary(p, role, v, ctx, mulberry(hashStr(role + ':take') ^ Math.imul(seed + 7, 2654435761)));
    else silentLastBeat(p);
    p.notes = p.notes.filter(n => n.s >= 0 && n.s < nb * 16);
    if (!p.notes.length) return null;
    /* one note per step and pitch (the loudest, the longest) */
    const one = new Map();
    for (const n of p.notes) {
      const o = one.get(n.s * 128 + n.n);
      if (!o) one.set(n.s * 128 + n.n, n);
      else {
        o.v = Math.max(o.v, n.v);
        o.l = Math.max(o.l, n.l);
      }
    }
    p.notes = [...one.values()].sort((a, b) => a.s - b.s || a.n - b.n);
    const type = role === 'kit' || role === 'hats' || role === 'perc' ? 'drum' : 'tone';
    patterns[k] = { role, variant: v, name: NAMES[v] || v, bars: nb, type, notes: p.notes };
    const snd = soundFor(role, v, recipe, Object.keys(patterns).length);
    if (snd) sounds[k] = snd;
    return k;
  };
  return { make, patterns, sounds, sections, bpm, key, scale, prog: progId, fam, recipe };
}
/** Every factory sound name the composer may ask for (for checks). */
export function composeSoundNames() {
  const tones = new Set(),
    kits = new Set();
  for (const k of Object.values(KITS)) k.forEach(x => kits.add(x));
  for (const s of Object.values(SOUNDS)) for (const list of Object.values(s)) list.forEach(x => tones.add(x));
  return { tones: [...tones], kits: [...kits] };
}
