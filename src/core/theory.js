//<FACTORY>
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = n => NOTE_NAMES[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
export const parseNote = s => {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(s);
  if (!m) throw new Error('bad note ' + s);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return (+m[3] + 1) * 12 + base;
};
export const LANES = [
  ['Kick', 36],
  ['Rim', 37],
  ['Snare', 38],
  ['Clap', 39],
  ['Closed hat', 42],
  ['Open hat', 46],
  ['Low tom', 41],
  ['Mid tom', 45],
  ['High tom', 48],
  ['Crash', 49],
  ['Ride', 51],
  ['Perc', 56]
];
export const LANE_KEY = { k: 0, rim: 1, s: 2, c: 3, h: 4, oh: 5, lt: 6, mt: 7, ht: 8, cr: 9, rd: 10, pc: 11 };
export const KEYS = {
  Fm: { root: 5, scale: 'minor' },
  Gm: { root: 7, scale: 'minor' },
  Cm: { root: 0, scale: 'minor' },
  Am: { root: 9, scale: 'minor' },
  Dm: { root: 2, scale: 'minor' },
  Em: { root: 4, scale: 'minor' }
};
export const SCALES = {
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  'minor pent': [0, 3, 5, 7, 10],
  'major pent': [0, 2, 4, 7, 9],
  blues: [0, 3, 5, 6, 7, 10]
};
