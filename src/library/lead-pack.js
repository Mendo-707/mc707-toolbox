// The lead pack: hooks and plucks that follow the chords, for every progression in the library. Each part
// is one short motif written as steps along the chord (the 1st, 2nd or 3rd note of the chord in its
// register), so it is the same hook on every chord, moved onto that chord's notes: the strong beats land on
// chord tones, and quick notes between them step through the scale to the next one. The rhythms are
// straight 8ths and 16ths (syncopated, offbeat, held), so they sit with any beat. Leads sit around C5, plucks
// an octave lower, so a lead and a pluck have room together. Every part keeps its progression's name,
// length, key and styles, so Live Mode and the song wizard pick them with its chords.
// Ids start with 'lp' and come after the fill pack.
//
// Reads: FAC.
import { SCALES } from '../core/theory.js';
import { FAC } from './factory.js';

const PROG = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3,}b?[ivIV]{1,3}[A-Za-z0-9]*)/;
const pc = n => ((n % 12) + 12) % 12;
/*
 * Rhythms, one bar of 16ths: x a note, - it rings on, . a rest. Motif: chord steps for the notes in order
 * (0 the chord's root in the register, 1 the next chord note up …, negative below), repeated as needed;
 * a step written as 'p' is a passing note: the scale note between this note and the next.
 */
const LEADS = [
  ['Chord hook', 'x--x--x---x-x---', [0, 1, 2, 1, 0]],
  ['Rising call', 'x-x-x---x-x-x---', [0, 1, 2, 2, 1, 3]],
  ['Answer', 'x---x-x-........', [2, 1, 0]],
  ['Long tones', 'x-------x---x---', [2, 1, 0]],
  ['Stab hook', 'x--x....x--x....', [1, 1, 2, 0]],
  ['Offbeat hook', '..x-..x-..x-.x--', [0, 1, 2, 1]],
  ['Walk up', 'x-xpx-xpx-x-x---', [0, 'p', 1, 'p', 2, 1, 0]],
  ['Fall', 'x--x--x-x-x-x---', [3, 2, 1, 1, 0, 0]],
  ['Two-note', 'x-x-x-x-x-x-x-x-', [0, 1]],
  ['Arch', 'x-xpx-x-x-x-x---', [0, 'p', 1, 2, 3, 2, 1]]
];
const PLUCKS = [
  ['Pluck 8ths', 'x.x.x.x.x.x.x.x.', [0, 1, 2, 1]],
  ['Pluck offbeats', '..x...x...x...x.', [1, 2, 1, 0]],
  ['Pluck roll', 'x.xx.xx.x.xx.xx.', [0, 1, 2, 0, 1, 2]],
  ['Pluck 16ths', 'xxxxxxxxxxxxxxxx', [0, 1, 2, 3]],
  ['Pluck skip', 'x..x..x.x..x..x.', [2, 1, 0]],
  ['Pluck stabs', 'x..x....x..x..x.', [0, 2, 1]]
];
const PER = { lead: 3, pluck: 2 };

/** Add the pack to the library. Called once by finishLibrary() (pools.js), after the fill pack. */
export function addLeadPack() {
  let seed = 20261101;
  const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296;
  const pick = (list, n) => {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };
  let uid = 0;
  for (const src of sources()) {
    const chords = chordsOf(src);
    if (!chords) continue;
    const prog = PROG.exec(src.name)[1],
      scale = SCALES[src.key.scale] || SCALES.minor;
    const base = {
      type: 'tone',
      genre: src.genre,
      bpm: src.bpm ?? null,
      bars: src.bars,
      key: src.key,
      keyName: src.keyName,
      styles: src.styles || null,
      lp: true
    };
    const add = (pool, role, name, notes) => {
      if (notes.length)
        FAC.push({ ...base, id: 'lp' + uid++, name: role + ': ' + name + ' ' + prog, notes, role, pool });
    };
    for (const [name, rh, motif] of pick(LEADS, PER.lead))
      add(
        'lead',
        'Lead',
        name,
        write({ chords, rh, motif, scale, root: src.key.root, low: 60, bars: src.bars, held: true })
      );
    for (const [name, rh, motif] of pick(PLUCKS, PER.pluck))
      add(
        'pluck',
        'Lead',
        name,
        write({ chords, rh, motif, scale, root: src.key.root, low: 48, bars: src.bars, held: false })
      );
  }
}
/* one chords pattern per progression, length and genre (the first of them) */
function sources() {
  const seen = new Set(),
    out = [];
  for (const f of FAC) {
    if (f.type !== 'tone' || f.pool !== 'chords' || f.busy || f.lp || !f.key || !PROG.test(f.name)) continue;
    const k = f.genre + '|' + PROG.exec(f.name)[1] + '|' + f.bars;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(f);
  }
  return out;
}
/* the chord's pitch classes on every 16th (a rest keeps the chord before it), or null with no full chords */
function chordsOf(f) {
  const n = f.bars * 16,
    grid = Array(n).fill(null);
  for (const x of f.notes)
    for (let s = Math.floor(x.s); s < Math.min(n, Math.ceil(x.s + x.l)); s++)
      (grid[s] = grid[s] || new Set()).add(pc(x.n));
  let last = null;
  for (let pass = 0; pass < 2; pass++)
    for (let s = 0; s < n; s++) {
      if (grid[s] && grid[s].size >= 3) last = grid[s];
      else grid[s] = last;
    }
  return grid.every(Boolean) ? grid : null;
}
/* the chord's notes from `low` up, over two octaves */
const tonesFrom = (set, low) => {
  const out = [];
  for (let n = low; n < low + 24; n++) if (set.has(pc(n))) out.push(n);
  return out;
};
/*
 * One part: the rhythm repeated every bar, each note a step along the chord sounding then (so the motif
 * moves onto each chord), passing notes on the scale between, the last note of each 4 bars back on the root.
 */
function write({ chords, rh, motif, scale, root, low, bars, held }) {
  const notes = [],
    total = bars * 16,
    inScale = n => scale.includes(pc(n - root));
  let k = 0,
    prev = null;
  for (let s = 0; s < total; s++) {
    const ch = rh[s % 16];
    if (ch !== 'x' && ch !== 'p') continue;
    let len = 1;
    if (held) while (s + len < total && rh[(s + len) % 16] === '-') len++;
    const step = motif[k++ % motif.length];
    const tones = tonesFrom(chords[s], low);
    let n;
    if (step === 'p' && prev != null) {
      /* between the last note and the chord's next note up: the scale note in between */
      const next = tones.find(t => t > prev) ?? prev + 2;
      n = prev + 1;
      while (n < next && !inScale(n)) n++;
      if (n >= next) n = next;
    } else {
      const i = step === 'p' ? 0 : step;
      n = tones[Math.max(0, Math.min(tones.length - 1, i))];
    }
    notes.push({ s, l: held ? len : 1, n, v: s % 4 === 0 ? 104 : 86 });
    prev = n;
  }
  return notes;
}
