// The finished pattern library: the id lookup (facById), the pool each track draws from, and
// helpers that copy a factory pattern into the song.
//
// Reads: S, FAC.
import './generate.js';
import './live-extras.js';
import './lively.js';
import './variety.js';
import './flash.js';
import './genre-drums.js';
import './genre-keys.js';
import './groove-pack.js';
import './acid.js';
import { FAC } from './factory.js';
import { userById } from './user-lib.js';
import { demoClips } from './demo-song.js';
import { S, addPattern, newState, replaceState } from '../core/state.js';

/* Punk and rock were taken out in 1.2: their patterns leave the library. Every other pattern keeps its id. */
for (let i = FAC.length - 1; i >= 0; i--) if (FAC[i].genre === 'rock') FAC.splice(i, 1);

/** Copy a factory pattern into the song and return the song pattern id. An unedited copy already in the song is reused. */
export function instFactory(f) {
  const found = Object.keys(S.patterns).find(
    k => S.patterns[k].src === f.id && !S.patterns[k].mod && !S.patterns[k].shift
  );
  if (found) return found;
  return addPattern(f.type, f.name, f.bars, f.notes, {
    src: f.id,
    genre: f.genre,
    key: f.key ? { ...f.key } : null,
    role: f.role
  });
}
/** Replace the song with the demo: its clips spell MC 707 / 101 TOOLBOX (library/demo-song.js), 124 BPM house in F minor. */
export function makeDemo() {
  replaceState(newState());
  const { clips, bars } = demoClips();
  S.bpm = 124;
  S.key = 5;
  S.scale = 'minor';
  S.bars = Math.ceil(bars / 8) * 8;
  S.loop = { on: true, start: 0, end: bars };
  for (const [t, start, len, f] of clips)
    S.clips.push({ id: 'c' + S.nextId++, t, start, len, off: 0, pat: instFactory(f) });
}
/** The pattern behind a library or drag source {kind: 'fac'|'user'|'proj', id}. */
export const metaOf = src =>
  src.kind === 'fac' ? FACMAP.get(src.id) : src.kind === 'user' ? userById(src.id) : S.patterns[src.id];
export const FACMAP = new Map(FAC.map(f => [f.id, f]));
/** A factory pattern by id. @returns {import('../core/types.js').FactoryPattern|undefined} */
export const facById = id => FACMAP.get(id);
export const TRACK_POOLS = ['kit', 'hats', 'perc', 'bass', 'chords', 'pad', 'lead', 'pluck'];
export const LEVELS = [100, 80, 75, 105, 85, 70, 90, 80];

/** Semitones to move a factory tone pattern into the key with root `target`, kept in a sensible range. */
export function shiftFor(f, target) {
  if (f.type !== 'tone' || !f.key) return 0;
  const d = (((target - f.key.root) % 12) + 12) % 12;
  let sh = d > 6 ? d - 12 : d;
  const mn = Math.min(...f.notes.map(n => n.n)),
    mx = Math.max(...f.notes.map(n => n.n));
  const floor = f.role === 'Bass' ? (/808/.test(f.name) ? 12 : 24) : 36;
  if (mn + sh < floor) sh += 12;
  if (mx + sh > 102) sh -= 12;
  return sh;
}
