// Flash-break patterns: 1 to 2 bar unison hits for every genre (FLASH_RH lists the rhythms).
//
// Reads: FAC.
import { KEYS } from '../core/theory.js';
import { FAC } from './factory.js';

/* ===== Flash breaks: 1–2 bar unison interjections. Every part hits the same rhythm, the gaps are silent,
   a pickup roll or run pulls you back, and the loop slams in on the downbeat. Drums, bass, chords and lead
   for each rhythm share a name, so a Flash scene always locks together. ===== */
export const FLASH_RH = [
  /* id, label, bars, hits [step, accent 0-1, length, chord index], pickup start step (roll / run into the return) */
  [
    'stabs',
    'Stabs',
    1,
    [
      [0, 1, 2, 0],
      [3, 0.8, 2, 0],
      [6, 0.85, 2, 0],
      [10, 0.9, 2, 0]
    ],
    12
  ],
  ['stop', 'Stop-time', 1, [[0, 1, 6, 0]], 14],
  [
    'epic',
    'Epic rise',
    1,
    [
      [0, 0.9, 3, 1],
      [4, 0.95, 3, 2],
      [8, 1, 4, 0]
    ],
    12
  ],
  [
    'chops',
    'Offbeat chops',
    1,
    [
      [2, 0.8, 1, 0],
      [6, 0.85, 1, 0],
      [10, 0.9, 1, 1],
      [14, 1, 1, 2]
    ],
    null
  ],
  [
    'rush',
    'Rush',
    1,
    [
      [0, 1, 2, 0],
      [4, 0.8, 2, 0],
      [8, 0.85, 1, 0],
      [10, 0.88, 1, 0],
      [12, 0.92, 1, 0],
      [13, 0.94, 1, 0],
      [14, 0.97, 1, 0],
      [15, 1, 1, 0]
    ],
    null
  ],
  [
    'tresillo',
    'Tresillo',
    1,
    [
      [0, 1, 2, 0],
      [3, 0.85, 2, 0],
      [6, 0.9, 2, 1],
      [8, 0.95, 2, 0],
      [11, 0.9, 2, 2],
      [14, 1, 2, 0]
    ],
    null
  ],
  [
    'answer',
    'Call and answer',
    2,
    [
      [0, 1, 2, 0],
      [3, 0.85, 2, 0],
      [6, 0.95, 4, 1]
    ],
    20
  ],
  [
    'half',
    'Half-time',
    2,
    [
      [0, 1, 8, 0],
      [8, 0.9, 4, 1],
      [16, 1, 8, 2],
      [24, 0.95, 4, 0]
    ],
    28
  ]
];
const CH = {
  minor: [
    [0, [0, 3, 7]],
    [8, [0, 4, 7]],
    [10, [0, 4, 7]]
  ],
  major: [
    [0, [0, 4, 7]],
    [5, [0, 4, 7]],
    [7, [0, 4, 7]]
  ]
}; /* i, VI, VII  /  I, IV, V */
const SCL = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11] };
const ramp = (i, n, a, b) => Math.round(a + (b - a) * (n <= 1 ? 1 : i / (n - 1)));
(function () {
  const G = {
    dnb: { sn: 2, roll: true },
    hiphop: { sn: 2, roll: false },
    house: { sn: 3, roll: true },
    techno: { sn: 3, roll: true },
    garage: { sn: 2, roll: true },
    dubstep: { sn: 2, roll: false },
    trance: { sn: 3, roll: true },
    electro: { sn: 3, roll: true },
    funk: { sn: 2, roll: false },
    reggae: { sn: 1, roll: false },
    latin: { sn: 1, roll: false },
    synth: { sn: 2, roll: false },
    pop: { sn: 3, roll: false },
    ambient: { sn: 2, roll: false },
    rock: { sn: 2, roll: false }
  };
  const NAME = {
    dnb: 'DnB',
    hiphop: 'Hip hop',
    house: 'House',
    techno: 'Techno',
    garage: 'Garage',
    dubstep: 'Dubstep',
    trance: 'Trance',
    electro: 'Electro',
    funk: 'Funk',
    reggae: 'Reggae',
    latin: 'Latin',
    synth: 'Synthwave',
    pop: 'Pop',
    ambient: 'Ambient',
    rock: 'Rock'
  };
  let uid = 0;
  const push = o =>
    FAC.push(
      Object.assign(
        { id: 'fl' + uid++, styles: null, bpm: null, key: null, keyName: null, lively: true, pool: 'flash' },
        o
      )
    );
  const genres = [...new Set(FAC.map(f => f.genre))].filter(g => G[g]);
  for (const g of genres) flashFor(g, G[g], NAME[g] || g, push);
})();

/** The flash breaks for one genre. q: {sn: the snare lane, roll: 32nd rolls}; push adds a pattern. */
export function flashFor(g, q, nm, push) {
  for (const [rid, rl, bars, hits, pick] of FLASH_RH) {
    const total = bars * 16,
      base = { genre: g, bars, flash: rid };
    /* drums: kick + crash on the first hit, kick + snare/clap on the rest, a roll into the return */
    const dn = [];
    hits.forEach(([s, a], i) => {
      const v = Math.round(96 + 31 * a);
      dn.push({ s, l: 1, n: 0, v });
      dn.push({ s, l: 1, n: i === 0 || (rid === 'half' && s === 16) ? 9 : q.sn, v });
      if (i > 0 && q.sn !== 3 && a > 0.9) dn.push({ s, l: 1, n: 3, v: v - 10 });
    });
    if (rid === 'half') [8, 24].forEach(s => dn.push({ s, l: 1, n: 2, v: 120 }));
    if (pick != null) {
      const st = q.roll ? 0.5 : 1,
        n = Math.round((total - pick) / st);
      for (let i = 0; i < n; i++)
        dn.push({
          s: pick + i * st,
          l: st,
          n: rid === 'answer' && i < n / 2 ? [6, 6, 7, 7, 8, 8, 8, 8][Math.floor((i * 8) / n)] : 2,
          v: ramp(i, n, 64, 124)
        });
    }
    if (rid === 'rush') hits.slice(4).forEach(([s]) => dn.push({ s, l: 1, n: 2, v: 118 }));
    push(Object.assign({ name: nm + ' Flash: ' + rl, type: 'drum', notes: dn, role: 'Flash', pool: 'fkit' }, base));
    for (const md of ['minor', 'major']) {
      const kn = md === 'minor' ? 'Am' : 'C',
        R = KEYS[kn].root,
        ch = CH[md],
        sc = SCL[md],
        tag = ' (' + (md === 'minor' ? 'Minor' : 'Major') + ')';
      const kk = { keyName: kn, key: KEYS[kn] };
      /* bass: chord roots on every hit, octave pop on accents */
      const bn = hits.map(([s, a, l, c], i) => ({
        s,
        l: Math.min(l, rid === 'rush' ? 1 : l),
        n: 36 + ((R + ch[c][0]) % 12) + (rid === 'rush' && i % 2 ? 12 : 0) + (a === 1 && l <= 2 && i > 0 ? 12 : 0),
        v: Math.round(96 + 31 * a)
      }));
      push(
        Object.assign(
          { name: 'Bass Flash: ' + rl + tag, type: 'tone', notes: bn, role: 'Bass', pool: 'fbass' },
          base,
          kk
        )
      );
      /* chords: stabs on the hits, voiced around middle C */
      const cn = [];
      hits.forEach(([s, a, l, c]) => {
        const [off, iv] = ch[c];
        let ns = iv.map(x => R + off + x + 60);
        while (ns.reduce((p, x) => p + x, 0) / ns.length > 66) ns = ns.map(x => x - 12);
        ns.forEach(n =>
          cn.push({
            s,
            l: Math.min(l, rid === 'stop' || rid === 'half' ? l : 1.5),
            n,
            v: Math.round(90 + 35 * a)
          })
        );
      });
      push(
        Object.assign(
          { name: 'Chords Flash: ' + rl + tag, type: 'tone', notes: cn, role: 'Chords', pool: 'fchords' },
          base,
          kk
        )
      );
      /* lead: the top of each chord an octave up, then a scale run into the return */
      const ln = [],
        deg = d => 60 + R + sc[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
      hits.forEach(([s, a, l, c], i) => {
        const [off, iv] = ch[c];
        let top = R + off + iv[2] + 72;
        while (top > 86) top -= 12;
        while (top < 74) top += 12;
        ln.push({ s, l: Math.min(l, 2), n: rid === 'rush' ? deg(i + 7) : top, v: Math.round(92 + 33 * a) });
      });
      if (pick != null) {
        const n = total - pick;
        for (let i = 0; i < n; i++)
          ln.push({
            s: pick + i,
            l: 1,
            n: deg(Math.round((i * 7) / Math.max(1, n - 1))),
            v: ramp(i, n, 84, 120)
          });
      }
      push(
        Object.assign(
          { name: 'Lead Flash: ' + rl + tag, type: 'tone', notes: ln, role: 'Lead', pool: 'flead' },
          base,
          kk
        )
      );
    }
  }
}
