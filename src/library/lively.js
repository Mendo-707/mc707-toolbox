// Lively variants: busier, syncopated basslines, arps, chords and leads built on each genre's
// progressions.
//
// Reads: FAC.
import { KEYS } from '../core/theory.js';
import { FAC } from './factory.js';

/* ===== Lively patterns: busier, syncopated parts built on the same progressions as each genre's chords ===== */
(function () {
  const Q = {
    m: [0, 3, 7],
    M: [0, 4, 7],
    m7: [0, 3, 7, 10],
    M7: [0, 4, 7, 11],
    7: [0, 4, 7, 10],
    m9: [0, 3, 7, 10, 14],
    m7b5: [0, 3, 6, 10],
    M9: [0, 4, 7, 11, 14],
    6: [0, 4, 7, 9]
  };
  const PR = {
    'i-VI-III-VII': [
      [0, 'm7'],
      [8, 'M7'],
      [3, 'M7'],
      [10, '7']
    ],
    'i-VII-VI-VII': [
      [0, 'm'],
      [10, 'M'],
      [8, 'M'],
      [10, 'M']
    ],
    'i-iv-VII-III': [
      [0, 'm7'],
      [5, 'm7'],
      [10, '7'],
      [3, 'M7']
    ],
    'i-III-VII-VI': [
      [0, 'm'],
      [3, 'M'],
      [10, 'M'],
      [8, 'M']
    ],
    'i-VI-iv-V': [
      [0, 'm9'],
      [8, 'M7'],
      [5, 'm7'],
      [7, '7']
    ],
    'i-iv-i-V': [
      [0, 'm7'],
      [5, 'm7'],
      [0, 'm7'],
      [7, '7']
    ],
    'i-v-VI-iv': [
      [0, 'm'],
      [7, 'm'],
      [8, 'M'],
      [5, 'm']
    ],
    'ii-V-i-VI': [
      [2, 'm7b5'],
      [7, '7'],
      [0, 'm9'],
      [8, 'M7']
    ],
    'VI-VII-i-i': [
      [8, 'M7'],
      [10, '7'],
      [0, 'm7'],
      [0, 'm7']
    ],
    'i-i-VI-VII': [
      [0, 'm'],
      [0, 'm'],
      [8, 'M'],
      [10, 'M']
    ],
    'i-iv-VI-VII': [
      [0, 'm7'],
      [5, 'm7'],
      [8, 'M7'],
      [10, '7']
    ],
    'i-VII-iv-v': [
      [0, 'm7'],
      [10, 'M'],
      [5, 'm7'],
      [7, 'm7']
    ],
    'I-V-vi-IV': [
      [0, 'M'],
      [7, 'M'],
      [9, 'm'],
      [5, 'M']
    ],
    'vi-IV-I-V': [
      [9, 'm'],
      [5, 'M'],
      [0, 'M'],
      [7, 'M']
    ],
    'I-vi-IV-V': [
      [0, 'M'],
      [9, 'm'],
      [5, 'M'],
      [7, 'M']
    ],
    'ii-V-I-vi': [
      [2, 'm7'],
      [7, '7'],
      [0, 'M7'],
      [9, 'm7']
    ],
    'I-IV-V-IV': [
      [0, 'M'],
      [5, 'M'],
      [7, 'M'],
      [5, 'M']
    ],
    'I-iii-IV-V': [
      [0, 'M'],
      [4, 'm'],
      [5, 'M'],
      [7, 'M']
    ],
    'I-V-IV-V': [
      [0, 'M'],
      [7, 'M'],
      [5, 'M'],
      [7, 'M']
    ],
    'I-IV-vi-V': [
      [0, 'M'],
      [5, 'M'],
      [9, 'm'],
      [7, 'M']
    ],
    'I-bVII-IV-I': [
      [0, 'M'],
      [10, 'M'],
      [5, 'M'],
      [0, 'M']
    ],
    'IV-V-iii-vi': [
      [5, 'M7'],
      [7, '7'],
      [4, 'm7'],
      [9, 'm7']
    ],
    'I-vi-ii-V': [
      [0, 'M7'],
      [9, 'm7'],
      [2, 'm7'],
      [7, '7']
    ],
    'IMaj9-vi9-IV-V': [
      [0, 'M9'],
      [9, 'm9'],
      [5, 'M7'],
      [7, '7']
    ]
  };
  const progOf = n => {
    const m = /((?:b?[ivIV]{1,3}[A-Za-z0-9]*-){3}b?[ivIV]{1,3}[A-Za-z0-9]*)/.exec(n);
    return m ? m[1] : null;
  };
  let seed = 987654;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const pickN = (a, n) => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a.slice(0, n);
  };
  const FOUR = new Set(['house', 'techno', 'trance', 'pop', 'synth']);
  let uid = 0;
  const push = o => FAC.push(Object.assign({ id: 'lv' + uid++, styles: null, bpm: null, lively: true }, o));
  const chordTones = (R, off, q, center) => {
    const ns = Q[q].map(i => R + off + 48 + i);
    const m = ns.reduce((a, b) => a + b, 0) / ns.length;
    const sh = Math.round((center - m) / 12) * 12;
    return ns.map(n => n + sh).sort((a, b) => a - b);
  };
  const genres = [...new Set(FAC.map(f => f.genre))];
  for (const g of genres) {
    const used = new Map();
    FAC.forEach(f => {
      if (f.genre === g && f.pool === 'chords') {
        const p = progOf(f.name);
        if (p && PR[p]) used.set(p + '|' + f.bars, { p, bars: f.bars, keyName: f.keyName });
      }
    });
    const pairs = pickN([...used.values()], 6);
    const four = FOUR.has(g);
    pairs.forEach(({ p, bars, keyName }) => {
      const kn = keyName && KEYS[keyName] ? keyName : /^[iv]/.test(p) ? 'Am' : 'C';
      const R = KEYS[kn].root,
        prog = PR[p];
      /* basslines with octave pops, syncopation and approach notes into the next chord */
      const BR = four
        ? {
            A: [
              [2, 2, 0],
              [6, 2, 12],
              [10, 2, 0],
              [13, 1, 7],
              [14, 2, 12]
            ],
            B: [
              [0, 1, 0],
              [2, 2, 12],
              [6, 1, 0],
              [7, 1, 12],
              [10, 2, 0],
              [14, 1, 7],
              [15, 1, -1]
            ]
          }
        : g === 'dnb'
          ? {
              A: [
                [0, 3, 0, 118],
                [3, 1, 12],
                [6, 2, 0],
                [10, 2, 7],
                [13, 1, 0],
                [14, 2, -1]
              ],
              B: [
                [0, 2, 0, 118],
                [2, 1, 12],
                [4, 2, 0],
                [7, 1, 7],
                [8, 2, 0],
                [11, 1, 12],
                [12, 2, 10],
                [14, 2, -1]
              ]
            }
          : g === 'hiphop'
            ? {
                A: [
                  [0, 3, 0, 118],
                  [4, 1, 0],
                  [7, 2, 12],
                  [10, 2, 7],
                  [14, 2, -1]
                ],
                B: [
                  [0, 2, 0, 118],
                  [3, 1, 0],
                  [6, 2, 7],
                  [9, 1, 12],
                  [11, 2, 10],
                  [14, 1, 0],
                  [15, 1, -1]
                ]
              }
            : {
                A: [
                  [0, 2, 0],
                  [3, 1, 12],
                  [6, 2, 0],
                  [8, 1, 7],
                  [11, 2, 0],
                  [13, 1, 10],
                  [14, 2, -1]
                ],
                B: [
                  [0, 3, 0],
                  [4, 1, 12],
                  [6, 1, 0],
                  [8, 2, 7],
                  [10, 1, 12],
                  [12, 2, 0],
                  [15, 1, -1]
                ]
              };
      Object.entries(BR).forEach(([vn, rh]) => {
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const [off] = prog[b % 4];
          const root = 36 + ((((R + off) % 12) + 12) % 12);
          const nx = 36 + ((((R + prog[(b + 1) % 4][0]) % 12) + 12) % 12);
          rh.forEach(([s, l, iv, v]) =>
            notes.push({
              s: b * 16 + s,
              l,
              n: iv === -1 ? (nx > root ? nx - 1 : nx + 1) : root + iv,
              v: v || 100
            })
          );
        }
        push({
          name: 'Bass: ' + p + ' Lively ' + vn,
          type: 'tone',
          genre: g,
          bars,
          notes,
          keyName: kn,
          key: KEYS[kn],
          role: 'Bass',
          pool: 'bass'
        });
      });
      /* arps that jump octaves and leave gaps */
      [
        ['Bounce', 'x.xx.x.xx.xx.x.x', [0, 2, 1, 3, 4, 2, 1, 0]],
        ['Skip', 'x.x..xx.x.x.xx.x', [0, 3, 1, 4, 2, 3, 0, 4]],
        ['Cascade', 'xxx.xxx.xx.xxxx.', [4, 3, 2, 1, 0, 1, 2, 3]]
      ].forEach(([an, mask, seq]) => {
        const notes = [];
        for (let b = 0; b < bars; b++) {
          const [off, q] = prog[b % 4];
          const ts = chordTones(R, off, q, 72);
          let k = 0;
          for (let s = 0; s < 16; s++) {
            if (mask[s] !== 'x') continue;
            const idx = seq[k++ % seq.length];
            notes.push({
              s: b * 16 + s,
              l: 1,
              n: ts[idx % ts.length] + 12 * Math.floor(idx / ts.length),
              v: s % 4 === 0 ? 104 : s % 2 ? 78 : 90
            });
          }
        }
        push({
          name: 'Arp: Lively ' + an + ' ' + p,
          type: 'tone',
          genre: g,
          bars,
          notes,
          keyName: kn,
          key: KEYS[kn],
          role: 'Lead',
          pool: 'pluck'
        });
      });
      /* chord rhythms with pushes into the next bar */
      [
        [
          'Bounce',
          [
            [0, 2, 100],
            [3, 1, 84],
            [6, 2, 94],
            [10, 1, 86],
            [12, 2, 96]
          ]
        ],
        [
          'Push',
          [
            [0, 3, 100],
            [7, 1, 86],
            [10, 2, 92],
            [14, 2, 96, 'next']
          ]
        ],
        [
          'Skank',
          [
            [2, 1, 96],
            [6, 1, 90],
            [7, 1, 70],
            [10, 1, 96],
            [14, 1, 90],
            [15, 1, 70]
          ]
        ]
      ].forEach(([cn, rh]) => {
        const notes = [];
        for (let b = 0; b < bars; b++) {
          rh.forEach(([s, l, v, nx]) => {
            const [off, q] = prog[(b + (nx ? 1 : 0)) % 4];
            chordTones(R, off, q, 62).forEach(n => notes.push({ s: b * 16 + s, l, n, v }));
          });
        }
        push({
          name: 'Chords: ' + p + ' Lively ' + cn,
          type: 'tone',
          genre: g,
          bars,
          notes,
          keyName: kn,
          key: KEYS[kn],
          role: 'Chords',
          pool: 'chords'
        });
      });
    });
    /* 4-bar call-and-response leads: a motif, a variation, the motif again, then an answer with a run home */
    const minorG = !['pop', 'funk', 'synth', 'house'].includes(g) || rnd() < 0.5;
    const SC = minorG ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11],
      kn = minorG ? 'Am' : 'C',
      R = KEYS[kn].root;
    const MOT = [
      [
        'Hook',
        [
          [0, 2, 4],
          [2, 1, 3],
          [3, 1, 2],
          [6, 2, 4],
          [8, 3, 5],
          [12, 2, 4],
          [14, 2, 2]
        ]
      ],
      [
        'Stutter',
        [
          [0, 1, 4],
          [1, 1, 4],
          [3, 1, 6],
          [4, 2, 4],
          [7, 1, 2],
          [8, 2, 1],
          [11, 1, 2],
          [12, 4, 0]
        ]
      ],
      [
        'Climb',
        [
          [0, 1, 0],
          [2, 1, 2],
          [3, 1, 4],
          [6, 2, 5],
          [8, 1, 4],
          [10, 1, 5],
          [11, 1, 6],
          [12, 4, 7]
        ]
      ],
      [
        'Syncopated',
        [
          [0, 3, 7],
          [3, 3, 6],
          [6, 2, 4],
          [10, 1, 4],
          [11, 1, 5],
          [12, 2, 4],
          [14, 2, 2]
        ]
      ],
      [
        'Call',
        [
          [0, 2, 4],
          [2, 2, 4],
          [4, 4, 7],
          [10, 2, 6],
          [12, 4, 4]
        ]
      ],
      [
        'Ripple',
        [
          [0, 1, 2],
          [1, 1, 4],
          [2, 1, 7],
          [4, 1, 4],
          [6, 1, 2],
          [8, 1, 4],
          [9, 1, 7],
          [10, 1, 9],
          [12, 2, 7],
          [14, 2, 4]
        ]
      ]
    ];
    MOT.forEach(([mn, mot]) => {
      const notes = [];
      const deg = d => 60 + R + SC[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
      const put = (bar, shift, vel) =>
        mot.forEach(([s, l, d], i) =>
          notes.push({ s: bar * 16 + s, l, n: deg(d + shift), v: i === 0 ? vel : vel - 12 })
        );
      put(0, 0, 104);
      put(1, 2, 98);
      put(2, 0, 104);
      [
        [0, 2, 4],
        [2, 2, 3],
        [4, 2, 2],
        [6, 2, 1],
        [8, 4, 0],
        [12, 1, -1],
        [13, 1, 0],
        [14, 1, 1],
        [15, 1, 2]
      ].forEach(([s, l, d]) => notes.push({ s: 48 + s, l, n: deg(d), v: s === 0 ? 102 : 88 }));
      push({
        name: 'Lead: Lively ' + mn + ' (' + (minorG ? 'Minor' : 'Major') + ')',
        type: 'tone',
        genre: g,
        bars: 4,
        notes,
        keyName: kn,
        key: KEYS[kn],
        role: 'Lead',
        pool: 'lead'
      });
    });
  }
})();
