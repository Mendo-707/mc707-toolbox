import './generate.js';
import './live-extras.js';
import './lively.js';
import './variety.js';
import './flash.js';
import { FAC } from './factory.js';

export const FACMAP = new Map(FAC.map(f => [f.id, f]));
export const facById = id => FACMAP.get(id);
export const TRACK_POOLS = ['kit', 'hats', 'perc', 'bass', 'chords', 'pad', 'lead', 'pluck'];
export const LEVELS = [100, 80, 75, 105, 85, 70, 90, 80];

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
