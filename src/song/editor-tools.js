import { SCALES } from '../core/theory.js';
import { S } from '../core/state.js';
import { ED } from './editor.js';

/* ---- chords, euclid, scale lock ---- */
export const CHORDS = [
  ['Major', [0, 4, 7]],
  ['Minor', [0, 3, 7]],
  ['Dominant 7', [0, 4, 7, 10]],
  ['Minor 7', [0, 3, 7, 10]],
  ['Major 7', [0, 4, 7, 11]],
  ['Minor 9', [0, 3, 7, 10, 14]],
  ['Sus2', [0, 2, 7]],
  ['Sus4', [0, 5, 7]],
  ['Diminished', [0, 3, 6]]
];
export function diatonic(p, root, count) {
  const key = p.key || { root: S.key, scale: S.scale };
  const sc = SCALES[key.scale] || SCALES.minor;
  const L = sc.length;
  if (L >= 12) return count > 3 ? [0, 4, 7, 11] : [0, 4, 7];
  const idx = sc.indexOf((((root - key.root) % 12) + 12) % 12);
  if (idx < 0) return count > 3 ? [0, 4, 7, 11] : [0, 4, 7];
  const out = [];
  for (let k = 0; k < count; k++) {
    const di = idx + 2 * k;
    out.push(sc[di % L] + 12 * Math.floor(di / L) - sc[idx]);
  }
  return out;
}
export function euclidRow(p, id, k) {
  p.notes = p.notes.filter(n => n.n !== id);
  for (let b = 0; b < p.bars; b++)
    for (let i = 0; i < 16; i++)
      if ((i * k) % 16 < k) p.notes.push({ s: b * 16 + i, l: 1, n: id, v: i % 4 === 0 ? 110 : 90 });
}
export function lockPitch(id, p) {
  if (!ED.lock) return id;
  const key = p.key || { root: S.key, scale: S.scale };
  const sc = SCALES[key.scale] || SCALES.chromatic;
  const inS = m => sc.includes((((m - key.root) % 12) + 12) % 12);
  if (inS(id)) return id;
  for (const d of [1, -1, 2, -2]) if (inS(id + d)) return id + d;
  return id;
}
