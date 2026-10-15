// The genre pack's drums: trap kits in three producer flavours (dark and sparse, bouncy, busy keys),
// drill, halftime drum and bass, Amen jungle breaks, afrobeats and phonk, with real hi-hat rolls
// (16th triplets, 32nds, 64th ramps) and the fills to match. Also moves older kits that do not fit
// out of the trap, drill and halftime pools.
//
// Reads: FAC.
import { LANE_KEY } from '../core/theory.js';
import { hatLine, rollNotes } from '../core/rolls.js';
import { D, FAC } from './factory.js';

/* ---- Older generated kits put the snare on 2 and 4 in trap, drill and halftime, which those styles never
   do (their snare or clap lands on beat 3 of a half-time bar), and some trap hat layers were swung boom-bap
   hats. They keep their ids, so saved songs still play them; they just leave those styles' pools. ---- */
const HALF = ['trap', 'drill', 'halftime'];
function backbeat(f) {
  return f.notes.some(n => (n.n === LANE_KEY.s || n.n === LANE_KEY.c) && n.v > 60 && [4, 12].includes(n.s % 16));
}
function notTrapHats(f) {
  const h = f.notes.filter(n => n.n === LANE_KEY.h);
  return h.length < 8 * f.bars || h.some(n => n.s % 2 === 0 && n.v <= 70);
}
for (const f of FAC) {
  if (!f.styles || !f.styles.some(s => HALF.includes(s))) continue;
  let drop = [];
  if (f.pool === 'kit' && backbeat(f)) drop = HALF;
  else if (f.pool === 'hats' && notTrapHats(f)) drop = ['trap', 'drill'];
  if (drop.length) f.styles = f.styles.filter(s => !drop.includes(s));
}

/* ---- builders ---- */
const tidy = notes => {
  const seen = new Set();
  return notes
    .filter(n => {
      const k = n.s + ':' + n.n;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => a.s - b.s || a.n - b.n);
};
/** One drum pattern: grid lanes (16 characters a bar, '|' between bars), a hat line, and extra notes. */
function kit(id, name, o) {
  const { bars, genre, bpm, styles, hats, extra = [], role = 'Full kit', pool = 'kit', lively = true } = o;
  const lanes = {};
  for (const k in LANE_KEY) if (o[k]) lanes[k] = o[k];
  for (const k in lanes)
    if (lanes[k].replace(/[\s|]/g, '').length !== 16 * bars) throw new Error('genre-drums ' + id + ' lane ' + k);
  const notes = [
    ...D(bars, lanes).notes,
    ...(hats ? hatLine(hats, o.hatLane ?? LANE_KEY.h, o.hatTop || 100) : []),
    ...extra
  ];
  FAC.push({
    id,
    name,
    type: 'drum',
    genre,
    bpm,
    bars,
    notes: tidy(notes),
    key: null,
    keyName: '',
    role,
    styles,
    pool,
    gen: true,
    lively
  });
}
const rep = (s, n) => Array(n).fill(s).join('|');
const TRAP = { genre: 'hiphop', bpm: 140, styles: ['trap'] };
const DRILL = { genre: 'hiphop', bpm: 142, styles: ['drill'] };
const HT = { genre: 'dnb', bpm: 174, styles: ['halftime'] };
const JG = { genre: 'dnb', bpm: 168, styles: ['jungle'] };
const AFRO = { genre: 'latin', bpm: 100, styles: ['afrobeats'] };
const PHONK = { genre: 'hiphop', bpm: 130, styles: ['phonk'] };
const S8 = '........x.......';

/* ---- Trap, dark and sparse: half-time snare, few kicks, 8th hats that burst into triplets ---- */
kit('gx-trap-dark-1', 'Trap Dark: Sparse Triplets', {
  ...TRAP,
  bars: 2,
  k: 'x......x..x.....|x.........x..x..',
  s: rep(S8, 2),
  c: rep(S8, 2),
  hats: '8 8 8 8 | 8 8 t16 8'
});
kit('gx-trap-dark-2', 'Trap Dark: Quarter Triplets', {
  ...TRAP,
  bars: 2,
  k: 'x.........x.....|x......x..x.....',
  s: rep(S8, 2),
  c: rep(S8, 2),
  hats: 'tq 8 8 | 8 8 tq'
});
kit('gx-trap-dark-3', 'Trap Dark: Rim Shadows', {
  ...TRAP,
  bars: 4,
  k: 'x.......x.......|x......x..x.....|x.......x.......|x......x...x.x..',
  s: rep(S8, 4),
  c: rep(S8, 4),
  rim: '...g.......g....|......g.......g.|...g.......g....|......g....g.g.g',
  hats: '8 8 8 8 | 8 8 8 t16 | 8 8 8 8 | 8 t16 8 64'
});
kit('gx-trap-dark-4', 'Trap Dark: Stop and Roll', {
  ...TRAP,
  bars: 2,
  k: 'x.........x.....|x.....x.........',
  s: rep(S8, 2),
  c: rep(S8, 2),
  oh: '............o...|................',
  hats: '8 8 8 - | 8 8 - 64'
});
/* ---- Trap, bouncy: 16th hats with pairs, snaps on 3, open hats, skippy kicks ---- */
kit('gx-trap-bounce-1', 'Trap Bounce: Snap Pairs', {
  ...TRAP,
  bars: 2,
  k: 'x..x......x.....|x......x..x..x..',
  s: rep(S8, 2),
  c: rep(S8, 2),
  oh: '......o.........|..............o.',
  hats: '16 16 16 pr | 16 16 t16 16'
});
kit('gx-trap-bounce-2', 'Trap Bounce: Open Skip', {
  ...TRAP,
  bars: 2,
  k: 'x.....x...x.....|x..x......x...x.',
  c: rep(S8, 2),
  rim: rep(S8, 2),
  oh: '......o.......o.|......o.........',
  hats: '8 sk 8 sk | 8 sk ht16 8'
});
kit('gx-trap-bounce-3', 'Trap Bounce: Skippy Kick', {
  ...TRAP,
  bars: 4,
  k: 'x..x......x.....|x......x.x......|x..x......x.....|x......x...x.x.x',
  s: rep(S8, 4),
  c: rep(S8, 4),
  oh: '..............o.|................|..............o.|................',
  hats: '16 16 16 16 | 16 16 t16 16 | 16 16 16 16 | 16 t16 16 32'
});
/* ---- Trap, busy keys: rolling 16ths, 32nd and triplet rolls, snare rushes ---- */
kit('gx-trap-keys-1', 'Trap Keys: Rolling 32nds', {
  ...TRAP,
  bars: 2,
  k: 'x.....x...x.....|x..x......x.x...',
  s: rep(S8, 2),
  c: rep(S8, 2),
  hats: '16 h32 16 32 | 16 16 h32 t16'
});
kit('gx-trap-keys-2', 'Trap Keys: Triplet Flow', {
  ...TRAP,
  bars: 2,
  k: 'x......x..x.....|x.....x.......x.',
  s: rep(S8, 2),
  c: rep(S8, 2),
  hats: 't16 8 t16 16 | t8 t16 16 32'
});
kit('gx-trap-keys-3', 'Trap Keys: Snare Rush', {
  ...TRAP,
  bars: 4,
  k: 'x.....x...x.....|x..x......x.....|x.....x...x.....|x..x............',
  s: rep(S8, 4),
  c: rep(S8, 4),
  hats: '16 32 16 16 | 16 16 h32 16 | 16 32 16 16 | 16 16 - -',
  extra: rollNotes('t16', 60, LANE_KEY.s, 110)
});
/* ---- Trap, modern ---- */
kit('gx-trap-ramp', 'Trap: 64th Ramps', {
  ...TRAP,
  bars: 2,
  k: 'x......x...x....|x.........x.....',
  s: rep(S8, 2),
  c: rep(S8, 2),
  hats: '8 8 8 64 | 8 8 64 64'
});
kit('gx-trap-flick', 'Trap: Sextuplet Flicks', {
  ...TRAP,
  bars: 1,
  k: 'x.........x..x..',
  s: S8,
  c: S8,
  hats: '8 16 s24 8'
});
/* ---- Trap and drill hat layers (Hats track) ---- */
const hats = (id, name, bars, line, styles = ['trap', 'drill', 'phonk'], bpm = 140) =>
  kit(id, 'Hats: ' + name, { genre: 'hiphop', bpm, styles, bars, hats: line, role: 'Hats', pool: 'hats' });
hats('gx-hats-trip', '8ths + Triplet Roll', 1, '8 8 8 t16');
hats('gx-hats-32', '16ths + 32nd Roll', 2, '16 16 16 16 | 16 16 16 32');
hats('gx-hats-tq', 'Quarter Triplets', 2, '8 8 tq | tq 8 t16');
hats('gx-hats-64', '64th Ramps', 2, '8 8 8 64 | 8 64 8 64');
hats('gx-hats-pairs', 'Bounce Pairs', 1, '16 pr 16 pr');
hats('gx-hats-keys', 'Rolling Keys', 4, '16 h32 16 16 | 16 16 t16 32 | 16 h32 16 16 | t16 t16 32 64');
hats('gx-hats-stop', 'Stop and Roll', 2, '8 8 8 - | - 8 t16 64');
hats('gx-hats-flow', 'Triplet Flow', 2, 't16 8 t16 8 | 8 t16 t8 32');
hats('gx-hats-flick', 'Sextuplet Flick', 1, '8 8 16 s24');
hats('gx-hats-drill', 'Drill 3-3-2', 1, 'x..x ..x. x..x ..x.', ['drill'], 142);
hats('gx-hats-drill-trip', 'Drill Triplet Skate', 2, 'x..x ..x. x..x t16 | x..x ..x. t16 t16', ['drill'], 142);
hats(
  'gx-hats-drill-rush',
  'Drill Rush',
  4,
  'x..x ..x. x..x ..x. | x..x t16 x.x. 32 | x..x ..x. x..x ..x. | x..x ..x. t16 64',
  ['drill'],
  142
);

/* ---- Drill: snare on 3 and a late one in the second bar, 3-3-2 hats with triplet slides ---- */
kit('gx-drill-pocket', 'Drill: Slide Pocket', {
  ...DRILL,
  bars: 2,
  k: 'x.........x.....|x.....x...x.....',
  s: '........x.......|........x.....x.',
  hats: 'x..x ..x. x..x ..x. | x..x ..x. t16 x.x.'
});
kit('gx-drill-skate', 'Drill: Triplet Skate', {
  ...DRILL,
  bars: 2,
  k: 'x.....x.......x.|..x.......x.....',
  s: '........x.......|........x..x....',
  hats: 'x..x ..x. t16 x... | x..x ..x. x.x. t16'
});
kit('gx-drill-ny', 'Drill: NY Bounce', {
  ...DRILL,
  bars: 4,
  k: 'x.........x..x..|x.....x.........|x.........x..x..|x.....x...x.x...',
  s: '........x.......|........x.....x.|........x.......|........x...x.x.',
  hats: 'x..x ..x. x..x ..x. | x..x ..x. x.xx t16 | x..x ..x. x..x ..x. | x..x t16 x..x 32'
});
kit('gx-drill-glide', 'Drill: Dark Glide', {
  ...DRILL,
  bars: 2,
  k: 'x.........x.....|...x......x.....',
  s: '........x.......|........x.....x.',
  rim: '..g.......g.....|..g.......g.....',
  hats: 'x..x ..x. x..x t16 | x..x ..x. t8 x..x'
});

/* ---- Halftime drum and bass: snare on 3 at 174 ---- */
kit('gx-ht-pocket', 'Halftime: Heavy Pocket', {
  ...HT,
  bars: 2,
  k: 'x.........x.....|x.....x...x..x..',
  s: rep(S8, 2),
  hats: '8 8 8 8 | 8 8 8 32'
});
kit('gx-ht-shuffle', 'Halftime: Shuffle Rolls', {
  ...HT,
  bars: 2,
  k: 'x......x..x.....|x.........x.x...',
  s: rep(S8, 2),
  oh: '..............o.|................',
  hats: '16 16 16 16 | 16 16 t16 16'
});
kit('gx-ht-skank', 'Halftime: Ghost Skank', {
  ...HT,
  bars: 2,
  k: 'x.....x...x.....|x.........xx....',
  s: '........x......g|....g...x..g....',
  hats: '8 x..x 8 x.xx | 8 x..x 8 t16'
});
kit('gx-ht-toms', 'Halftime: Tribal Toms', {
  ...HT,
  bars: 4,
  k: rep('x.........x.....', 4),
  s: rep(S8, 4),
  lt: rep('.....x.......x..', 4),
  mt: rep('...x..........x.', 4),
  hats: '8 8 8 8 | 8 8 8 8 | 8 8 8 8 | 8 8 t16 32'
});
kit('gx-ht-build', 'Halftime: Stutter Build', {
  ...HT,
  bars: 4,
  k: 'x.........x.....|x.....x...x.....|x.........x.....|x.....x.........',
  s: rep(S8, 4),
  hats: '16 16 16 16 | 16 16 16 t16 | 16 16 16 16 | 32 32 - -',
  extra: [...rollNotes('t16', 56, LANE_KEY.s, 100), ...rollNotes('32', 60, LANE_KEY.s, 115)]
});

/* ---- Jungle: the Amen break and chops of it (8th-note slices, re-ordered) ---- */
const AMEN = {
  k: 'x.x.......xx....|x.x.......xx....|x.x.......x.....|..xx......x.....',
  s: '....x..g.g..x..g|....x..g.g..x..g|....x..g.g....x.|.g..x..g.g....x.',
  rd: rep('x.x.x.x.x.x.x.x.', 4),
  cr: '................|................|................|..........x.....'
};
const AMEN_N = D(4, AMEN).notes;
/** A break built from Amen slices: each number is an 8th (2 steps) of the 4-bar break. */
const chop = order =>
  order.flatMap((sl, i) =>
    AMEN_N.filter(n => n.s >= sl * 2 && n.s < sl * 2 + 2).map(n => ({ ...n, s: i * 2 + (n.s - sl * 2) }))
  );
kit('gx-jungle-amen', 'Jungle: Amen (4 bars)', { ...JG, bars: 4, ...AMEN });
kit('gx-jungle-chop-1', 'Jungle: Amen Chop', {
  ...JG,
  bars: 2,
  extra: chop([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 26, 27])
});
kit('gx-jungle-chop-2', 'Jungle: Amen Stutter', {
  ...JG,
  bars: 2,
  extra: chop([0, 1, 2, 3, 2, 3, 6, 7, 0, 1, 10, 11, 4, 5, 14, 15])
});
kit('gx-jungle-chop-3', 'Jungle: Amen Turnaround', {
  ...JG,
  bars: 2,
  extra: chop([0, 1, 6, 7, 4, 5, 6, 7, 16, 17, 18, 19, 28, 29, 30, 31])
});
kit('gx-jungle-chop-4', 'Jungle: Amen Rush', {
  ...JG,
  bars: 2,
  extra: [...chop([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), ...rollNotes('32', 28, LANE_KEY.s, 110)]
});
kit('gx-jungle-think', 'Jungle: Think-Style Break', {
  ...JG,
  bars: 2,
  k: 'x......x..x.....|x.x....x..x.....',
  s: '....x.......x..g|....x..g....x.g.',
  hats: '16 16 16 16 | 16 16 16 32',
  hatTop: 80
});

/* ---- Afrobeats: 3-3-2 rim, shaker 16ths, congas on the toms ---- */
const SHK = 'o.xoo.xoo.xoo.xo';
kit('gx-afro-shekere', 'Afrobeats: Shekere Bounce', {
  ...AFRO,
  bars: 1,
  k: 'x......x..x.....',
  rim: '...x..x....x..x.',
  c: '............x...',
  pc: SHK,
  h: '..x...x...x...x.',
  mt: '......x.......x.',
  lt: '.........x...x..'
});
kit('gx-afro-log', 'Afrobeats: Talking Drums', {
  ...AFRO,
  bars: 2,
  k: 'x..x..x...x.....|x..x..x...x..x..',
  rim: rep('...x..x....x....', 2),
  pc: rep(SHK, 2),
  ht: '..x.....x.x.....|..x.....x...x.x.',
  mt: '....x.......x...|....x.......x...'
});
kit('gx-afro-ride', 'Afrobeats: Highlife Bell', {
  ...AFRO,
  bars: 2,
  k: rep('x.....x...x.....', 2),
  rim: rep('...x..x....x..x.', 2),
  rd: rep('x.x.x..x.x.x..x.', 2),
  pc: rep(SHK, 2)
});
kit('gx-afro-swing', 'Afrobeats: Afroswing Skip', {
  ...AFRO,
  bars: 2,
  k: 'x.....x..x......|x.....x..x...x..',
  rim: rep('...x..x...x..x..', 2),
  c: rep('....x.......x...', 2),
  hats: '8 8 8 t16 | 8 8 8 8',
  hatTop: 80
});
const perc = (id, name, lanes, bars = 1) =>
  kit(id, 'Perc: ' + name, { ...AFRO, bars, ...lanes, role: 'Perc', pool: 'perc' });
perc('gx-afro-p-shaker', 'Shekere 16ths', { pc: SHK });
perc('gx-afro-p-conga', 'Conga Tumbao', { mt: '......x.......x.', lt: '.........x.x....', ht: '..x.............' });
perc('gx-afro-p-clave', 'Clave 3-2', { rim: 'x..x..x...x.x...' });
perc('gx-afro-p-bell', 'Bell Line', { rd: 'x.x.x..x.x.x..x.' });

/* ---- Phonk: cowbell, half-time clap, Memphis triplet hats ---- */
kit('gx-phonk-drift', 'Phonk: Cowbell Drift', {
  ...PHONK,
  bars: 2,
  k: 'x..x......x..x..|x..x......x.....',
  s: rep(S8, 2),
  c: rep(S8, 2),
  pc: '..x...x...x..x..|..x...x...x...xx',
  hats: 't16 8 8 t16 | 8 t16 8 32'
});
kit('gx-phonk-memphis', 'Phonk: Memphis Triplets', {
  ...PHONK,
  bars: 1,
  k: 'x.....x...x.....',
  c: S8,
  hats: 't8 t8 t8 t16'
});

/* ---- Fills (one bar, played on the kit track) ---- */
const fill = (id, name, o) => kit(id, 'Fill: ' + name, { bars: 1, role: 'Fill', pool: 'fill', ...o });
const FTRAP = { genre: 'hiphop', bpm: 140, styles: ['trap', 'drill', 'phonk'] };
fill('gx-fill-trap-trip', 'Triplet Snare Rush', {
  ...FTRAP,
  k: 'x.....x.........',
  s: S8,
  hats: '8 8 - -',
  extra: rollNotes('t16', 12, LANE_KEY.s, 112)
});
fill('gx-fill-trap-32', '32nd Snare Build', {
  ...FTRAP,
  k: 'x...............',
  hats: '8 8 8 -',
  extra: hatLine('- - 16 32', LANE_KEY.s, 115)
});
fill('gx-fill-trap-64', 'Hat Stop and 64th Roll', { ...FTRAP, k: 'x.........x.....', s: S8, hats: '8 8 - 64' });
fill('gx-fill-trap-toms', 'Triplet Toms', {
  ...FTRAP,
  k: 'x...............',
  s: S8,
  hats: '8 8 - -',
  extra: rollNotes('t16', 12, 0, 110).map((n, i) => ({ ...n, n: [8, 8, 7, 7, 6, 6][i] }))
});
fill('gx-fill-ht-trip', 'Halftime Snare Triplets', {
  ...HT,
  k: 'x.....x.........',
  s: S8,
  extra: rollNotes('t16', 12, LANE_KEY.s, 110)
});
fill('gx-fill-amen', 'Amen Edit', {
  ...JG,
  extra: [...chop([0, 1, 4, 5, 4, 5]), ...rollNotes('32', 12, LANE_KEY.s, 110)]
});
fill('gx-fill-afro', 'Conga Run', {
  ...AFRO,
  k: 'x.....x.........',
  rim: '...x..x.........',
  extra: rollNotes('t16', 8, 0, 100)
    .concat(rollNotes('t16', 12, 0, 110))
    .map((n, i) => ({ ...n, n: [8, 8, 8, 7, 7, 7, 7, 7, 6, 6, 6, 6][i] }))
});
