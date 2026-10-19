// The Big Beat pack: a new genre (late-90s breakbeat rock-dance, 110-140 BPM). Chopped funk breaks and
// stomping beats with tambourines, distorted riffs, octave and acid basses, stabs, organ, sirens and wah
// guitar on minor-pentatonic and mixolydian progressions, plus its own intros, fills, builds, impacts and
// flash breaks. The material is in bigbeat-data.js. Every tone part of a progression shares its name,
// length and key, so Live Mode keeps them together. Ids start with 'bb' and come after the melodic pack;
// the melodic pack then adds its pads, arps, leads and chord rhythms over these progressions too.
//
// Reads: FAC.
import { FAC } from './factory.js';
import { LANE_KEY } from '../core/theory.js';
import { liveExtrasFor } from './live-extras.js';
import { flashFor } from './flash.js';
import {
  BB_BASS_RH,
  BB_CHORD_RH,
  BB_HATS,
  BB_KEYS_MAJ,
  BB_KEYS_MIN,
  BB_KITS,
  BB_LEAD_RH,
  BB_PERC,
  BB_PLUCK_RH,
  BB_PROGS_MAJ,
  BB_PROGS_MIN
} from './bigbeat-data.js';

export const BB_GENRE = 'bigbeat';
const VEL = { X: 122, x: 100, g: 50 };

/* lanes as strings of 16ths -> notes */
function drums(lanes) {
  const out = [];
  for (const k in lanes) [...lanes[k]].forEach((ch, s) => VEL[ch] && out.push({ s, l: 1, n: LANE_KEY[k], v: VEL[ch] }));
  return out.sort((a, b) => a.s - b.s || a.n - b.n);
}
const bars = lanes => Math.ceil(Math.max(...Object.values(lanes).map(x => x.length)) / 16);

/** Add the pack to the library. Called once by finishLibrary() (pools.js), after the melodic pack. */
export function addBigBeatPack() {
  let uid = 0;
  const push = o =>
    FAC.push({ id: 'bb' + uid++, genre: BB_GENRE, styles: null, bpm: null, key: null, keyName: null, ...o });
  addDrums(push);
  liveExtrasFor(BB_GENRE, { k: [0, 10], s: [4, 12], fs: 12, roll: true }, 'Big beat', push);
  flashFor(BB_GENRE, { sn: 2, roll: true }, 'Big beat', o => push({ lively: true, pool: 'flash', ...o }));
  for (const [kn, root] of BB_KEYS_MIN) for (const p of BB_PROGS_MIN) addTones(push, p, kn, root, 'minor');
  for (const [kn, root] of BB_KEYS_MAJ) for (const p of BB_PROGS_MAJ) addTones(push, p, kn, root, 'mixolydian');
}

function addDrums(push) {
  const kit = (name, lanes) =>
    push({
      name: 'Big beat: ' + name,
      type: 'drum',
      bars: bars(lanes),
      notes: drums(lanes),
      role: 'Full kit',
      pool: 'kit'
    });
  for (const [name, L] of BB_KITS) {
    kit(name, L);
    /* the same break with a crash on the one and an open hat into the next bar */
    kit(name + ' crash', { ...L, cr: 'x' + '.'.repeat(31), oh: (L.oh || '.'.repeat(32)).slice(0, 30) + 'x.' });
    /* and dirtier: tambourine 16ths over it and every snare hit harder */
    kit(name + ' tamb', {
      ...L,
      pc: L.pc || 'xgxgxgxgxgxgxgxgxgxgxgxgxgxgxgxg',
      ...(L.s ? { s: L.s.replace(/x/g, 'X') } : {})
    });
  }
  for (const [name, L] of BB_HATS)
    push({ name: 'Big beat hats: ' + name, type: 'drum', bars: 1, notes: drums(L), role: 'Hats', pool: 'hats' });
  for (const [name, L] of BB_PERC)
    push({ name: 'Big beat perc: ' + name, type: 'drum', bars: 1, notes: drums(L), role: 'Perc', pool: 'perc' });
  /* intros: the break thinned out */
  const intro = (name, L) =>
    push({
      name: 'Big beat intro: ' + name,
      type: 'drum',
      bars: bars(L),
      notes: drums(L),
      role: 'Full kit',
      pool: 'intro'
    });
  for (const [name, L] of BB_KITS.slice(0, 6)) {
    intro(name + ' hats', { h: L.h || 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.', pc: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.' });
    intro(name + ' kick', { k: L.k, h: '..x...x...x...x...x...x...x...x.' });
  }
}

/* one progression in one key, in 4 bars (a chord a bar) and 8 bars (a chord every two) */
function addTones(push, [prog, chords], keyName, root, scale) {
  const key = { root, scale };
  for (const per of [16, 32]) {
    const total = per * 4,
      base = { type: 'tone', bars: total / 16, key, keyName },
      tag = ' ' + prog;
    const each = fn => {
      const out = [];
      chords.forEach(([off, q], ci) => {
        for (let b = 0; b < per; b += 16) fn(out, ci * per + b, (root + off) % 12, q);
      });
      return out;
    };
    const voice = (pc, q, center) => {
      const iv = q === 'm' ? [0, 3, 7] : q === 'M' ? [0, 4, 7] : [0, 7, 12];
      let r = pc + 48;
      while (r + 4 < center) r += 12;
      while (r + 4 > center + 6) r -= 12;
      return iv.map(x => r + x);
    };
    for (const [nm, cells] of BB_CHORD_RH)
      push({
        ...base,
        name: 'Chords: ' + nm + tag,
        role: 'Chords',
        pool: 'chords',
        notes: each((o, s0, pc, q) =>
          cells.forEach(([p, l, oct]) => {
            const v = voice(pc, q, 62);
            (oct ? [...v, v[0] + 12] : v).forEach((n, i) => o.push({ s: s0 + p, l, n, v: i ? 96 : 108 }));
          })
        )
      });
    for (const [nm, cells] of BB_BASS_RH)
      push({
        ...base,
        name: 'Bass: ' + nm + tag,
        role: 'Bass',
        pool: 'bass',
        lively: nm === 'Acid squelch' || nm === 'Gallop',
        notes: each((o, s0, pc) => {
          const r = 31 + ((pc + 5) % 12);
          cells.forEach(([p, l, d]) => o.push({ s: s0 + p, l, n: r + d, v: p % 4 === 0 ? 118 : 100 }));
        })
      });
    for (const [nm, cells] of BB_PLUCK_RH)
      push({
        ...base,
        name: 'Pluck: ' + nm + tag,
        role: 'Lead',
        pool: 'pluck',
        notes: each((o, s0, pc, q) => {
          const v = voice(pc, q, 66);
          cells.forEach(([p, l, i, up]) =>
            o.push({ s: s0 + p, l, n: v[i] + (up ? 12 : 0), v: p % 4 === 0 ? 100 : 84 })
          );
        })
      });
    push({
      ...base,
      name: 'Pad: Organ drone' + tag,
      role: 'Pad',
      pool: 'pad',
      notes: each((o, s0, pc, q) => voice(pc, q, 60).forEach(n => o.push({ s: s0, l: 16, n, v: 80 })))
    });
    push({
      ...base,
      name: 'Pad: Swell' + tag,
      role: 'Pad',
      pool: 'pad',
      notes: each((o, s0, pc, q) =>
        voice(pc, q, 64).forEach(n => o.push({ s: s0, l: 8, n, v: 56 }, { s: s0 + 8, l: 8, n, v: 84 }))
      )
    });
    /* leads: pentatonic phrases two bars long, repeated through the progression */
    const pent = scale === 'minor' ? [0, 3, 5, 7, 10] : [0, 4, 5, 7, 10],
      deg = d => 60 + root + pent[((d % 5) + 5) % 5] + 12 * Math.floor(d / 5);
    for (const [nm, cells] of BB_LEAD_RH) {
      const notes = [];
      for (let b = 0; b < total; b += 32)
        cells.forEach(
          ([p, l, d]) =>
            b + p < total &&
            notes.push({ s: b + p, l: Math.min(l, total - b - p), n: deg(d), v: p % 8 === 0 ? 112 : 98 })
        );
      push({ ...base, name: 'Lead: ' + nm + tag, role: 'Lead', pool: 'lead', lively: true, notes });
    }
  }
}
