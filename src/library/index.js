// The finished pattern library: the id lookup (facById), the pool each track draws from, and
// helpers that copy a factory pattern into the song.
//
// Reads: S, FAC.
import './generate.js';
import './live-extras.js';
import './lively.js';
import './variety.js';
import './flash.js';
import { FAC } from './factory.js';
import { S, addPattern, newState, replaceState } from '../core/state.js';

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
/** Replace the song with the demo arrangement (174 BPM drum and bass in F minor). */
export function makeDemo() {
  replaceState(newState());
  S.bpm = 174;
  S.loop = { on: true, start: 0, end: 8 };
  S.key = 5;
  S.scale = 'minor';
  const put = (t, start, len, fid) => {
    const pid = instFactory(FAC.find(x => x.id === fid));
    S.clips.push({ id: 'c' + S.nextId++, t, start, len, off: 0, pat: pid });
  };
  put(0, 0, 7, 'dnb-twostep');
  put(0, 7, 1, 'dnb-fill');
  put(0, 8, 8, 'dnb-neuro');
  put(3, 0, 8, 'dnb-sub');
  put(3, 8, 8, 'dnb-reese');
  put(4, 4, 4, 'dnb-stabs');
  put(4, 8, 8, 'dnb-liquid-ch');
  put(5, 0, 8, 'dnb-pad');
  put(6, 12, 4, 'dnb-arp');
  put(7, 8, 8, 'dnb-pluck');
}
/** The pattern behind a library or drag source {kind: 'fac'|'pat', id}. */
export const metaOf = src => (src.kind === 'fac' ? FAC.find(f => f.id === src.id) : S.patterns[src.id]);
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
