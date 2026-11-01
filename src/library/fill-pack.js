// The fill pack: more interesting one-bar drum fills for every genre, beyond the snare runs: tom cascades,
// stop-time hits, kick stutters, flam crescendos, clap stacks, open-hat swells, call and response,
// triplet toms, ghost shuffles, rim runs, a breath of silence, 32nd rushes and more. Each keeps the
// genre's groove for the first half of the bar (four-on-the-floor, breakbeat or half-time) and fills the
// second; Live Mode plays them on the kit track into a new scene or at the end of a loop, and they are in
// the library to drag into a song. Ids start with 'fp' and come after the Big Beat pack's melodic parts.
//
// Reads: FAC.
import { FAC } from './factory.js';
import { LANE_KEY } from '../core/theory.js';
import { rollNotes } from '../core/rolls.js';

/* velocity letters: X accent, x normal, o softer, g ghost */
const VEL = { X: 124, x: 104, o: 84, g: 52 };
/* the genre's own name in front of each fill, and its groove for the first half of the bar */
const GENRES = {
  dnb: ['DnB', 'break'],
  hiphop: ['Hip hop', 'half'],
  house: ['House', 'four'],
  techno: ['Techno', 'four'],
  garage: ['Garage', 'skip'],
  dubstep: ['Dubstep', 'half'],
  trance: ['Trance', 'four'],
  electro: ['Electro', 'break'],
  funk: ['Funk', 'four'],
  reggae: ['Reggae', 'half'],
  latin: ['Latin', 'dem'],
  synth: ['Synthwave', 'pop'],
  pop: ['Pop', 'pop'],
  ambient: ['Ambient', 'half'],
  bigbeat: ['Big beat', 'break']
};
/* the first half (beats 1 and 2) of each groove */
const GROOVE = {
  four: { k: 'x...x...', h: '..x...x.' },
  break: { k: 'x.......', s: '....x...', h: 'x.x.x.x.' },
  half: { k: 'x.....x.', h: 'x.x.x.x.' },
  skip: { k: 'x.....x.', s: '....x...', h: '..x.x..x' },
  dem: { k: 'x...x...', s: '...x..x.', h: 'x.x.x.x.' },
  pop: { k: 'x.......', s: '....x...', h: 'x.x.x.x.' }
};
/*
 * The fills: [name, lanes for the second half (beats 3 and 4, 8 steps) or the whole bar (16), extra notes,
 * feels it suits ('' for all)]. Lanes: k rim s c h oh lt mt ht cr rd pc.
 */
const FILLS = [
  ['Tom cascade', { ht: 'XxXx....', mt: '....Xx..', lt: '......XX', k: '.......x' }],
  ['Snare and tom ladder', { s: 'x...x...', ht: '..x.....', mt: '......x.', lt: '.x...x.X' }],
  ['Stop-time', { k: 'X...............', cr: 'X...............', s: '...............x' }],
  ['Kick stutter', { k: 'goxxXXXX', s: '....x...' }, null, 'four break skip dem pop'],
  ['Flam crescendo', { s: 'ggoooxxX', c: '.......X' }],
  ['Clap stack', { c: 'x..x.xxX', k: 'x.......' }],
  ['Open-hat swell', { oh: 'o.o.x.X.', k: 'x...x...', s: '.......X' }, null, 'four skip pop'],
  ['Call and response', { k: 'x.x...x.', s: '..x.x..X', ht: '....x...' }],
  ['Ghost shuffle', { s: 'g.gg.gXg', h: 'x.x.x.x.', k: 'x.....x.' }],
  ['Rim run', { rim: 'x.x.xxxx', s: '.......X' }],
  ['Ride bell break', { rd: 'x.x.x.x.', k: 'x..x..x.', s: '......xX' }],
  ['Breath', { s: '.......X' }],
  ['Perc roll', { pc: 'xxxxxxxx', lt: '......xX' }],
  ['Double-time snare', { s: 'x.x.xxxx', k: 'x...x...' }],
  ['Tom gallop', { ht: 'x..x....', mt: '....x..x', lt: '.x....x.', k: 'x.......' }],
  ['Crash and choke', { cr: 'X.......', k: 'X.......', s: '....x.xX' }],
  ['32nd rush', { k: 'x.......' }, () => rollNotes('32', 12, LANE_KEY.s, 116)],
  [
    'Triplet toms',
    { k: 'x.......' },
    () =>
      [...rollNotes('t16', 8, 0, 96), ...rollNotes('t16', 12, 0, 116)].map((n, i) => ({
        ...n,
        n: [8, 8, 7, 7, 6, 6][i % 6]
      }))
  ],
  [
    'Triplet snare drag',
    { k: 'x.......' },
    () => [...rollNotes('t16', 8, LANE_KEY.s, 92), ...rollNotes('t16', 12, LANE_KEY.s, 118)],
    'half break'
  ],
  ['Hat stop and kick', { k: '....x.xX', s: '.......x' }]
];

function lanesNotes(lanes, from) {
  const out = [];
  for (const k in lanes)
    [...lanes[k]].forEach((ch, s) => VEL[ch] && out.push({ s: s + from, l: 1, n: LANE_KEY[k], v: VEL[ch] }));
  return out;
}

/** Add the pack to the library. Called once by finishLibrary() (pools.js), after the other packs. */
export function addFillPack() {
  let uid = 0;
  for (const g in GENRES) {
    const [nm, feel] = GENRES[g];
    for (const [name, lanes, extra, feels] of FILLS) {
      if (feels && !feels.split(' ').includes(feel)) continue;
      const whole = Object.values(lanes).some(x => x.length === 16);
      const notes = whole
        ? lanesNotes(lanes, 0)
        : [...lanesNotes(GROOVE[feel], 0), ...lanesNotes(lanes, 8), ...(extra ? extra() : [])];
      notes.sort((a, b) => a.s - b.s || a.n - b.n);
      FAC.push({
        id: 'fp' + uid++,
        name: nm + ' Fill: ' + name,
        type: 'drum',
        genre: g,
        styles: null,
        bpm: null,
        key: null,
        keyName: null,
        bars: 1,
        notes,
        role: 'Fill',
        pool: 'fill'
      });
    }
  }
}
