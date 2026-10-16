// The genre pack's tone parts for trap and drill: sliding 808s (overlapping notes, so the MC-707
// glides with portamento on), dark bells, bouncy plucks, piano chords and piano runs with triplet
// flourishes, organ and string pads. Every part of a progression shares its name, so Live Mode
// keeps them together. Other hip hop basslines leave the trap and drill pools, which are 808s only.
//
// Reads: FAC.
import { KEYS } from '../core/theory.js';
import { ROLL, ROLL2 } from '../core/rolls.js';
import { FAC } from './factory.js';

/* Trap and drill basslines are 808s. Other hip hop basslines (walking, funk, lively runs) leave those two
   styles' pools; their ids and notes stay the same. */
const HH_STYLES = ['boombap', 'trap', 'lofi', 'gfunk', 'drill', 'neosoul', 'memphis', 'phonk'];
for (const f of FAC) {
  if (f.genre !== 'hiphop' || f.pool !== 'bass' || /808|Sub/i.test(f.name)) continue;
  const st = f.styles || HH_STYLES;
  if (st.includes('trap') || st.includes('drill')) f.styles = st.filter(x => x !== 'trap' && x !== 'drill');
  f.notFor = ['trap', 'drill'];
}

const Q = { m: [0, 3, 7], M: [0, 4, 7], m7: [0, 3, 7, 10], M7: [0, 4, 7, 11], 7: [0, 4, 7, 10] };
const MINOR = [0, 2, 3, 5, 7, 8, 10];
/* progressions: name (roman numerals), one chord a bar as [semitones from the key's root, quality] */
const TRAP_P = [
  [
    'i-bVI-bIII-bVII',
    [
      [0, 'm'],
      [8, 'M'],
      [3, 'M'],
      [10, 'M']
    ]
  ],
  [
    'i-iv-bVI-V',
    [
      [0, 'm'],
      [5, 'm'],
      [8, 'M'],
      [7, 'M']
    ]
  ],
  [
    'i-bVI-iv-V',
    [
      [0, 'm'],
      [8, 'M'],
      [5, 'm'],
      [7, 'M']
    ]
  ],
  [
    'i-v-bVI-iv',
    [
      [0, 'm'],
      [7, 'm'],
      [8, 'M'],
      [5, 'm']
    ]
  ],
  [
    'i-bVII-bVI-V',
    [
      [0, 'm'],
      [10, 'M'],
      [8, 'M'],
      [7, 'M']
    ]
  ],
  [
    'im7-ivm7-bVIM7-V7',
    [
      [0, 'm7'],
      [5, 'm7'],
      [8, 'M7'],
      [7, '7']
    ]
  ],
  [
    'i-i-bVI-bVII',
    [
      [0, 'm'],
      [0, 'm'],
      [8, 'M'],
      [10, 'M']
    ]
  ]
];
const DRILL_P = [
  [
    'i-bII-i-bII',
    [
      [0, 'm'],
      [1, 'M'],
      [0, 'm'],
      [1, 'M']
    ]
  ],
  [
    'i-bVI-bII-V',
    [
      [0, 'm'],
      [8, 'M'],
      [1, 'M'],
      [7, 'M']
    ]
  ],
  [
    'i-iv-bII-V',
    [
      [0, 'm'],
      [5, 'm'],
      [1, 'M'],
      [7, 'M']
    ]
  ],
  [
    'i-bVI-v-bII',
    [
      [0, 'm'],
      [8, 'M'],
      [7, 'm'],
      [1, 'M']
    ]
  ]
];
/* 808 rhythms, one bar: [step, length, semitones above the chord root, slide into this note]. Second
   array is the last bar's turnaround. */
const B808 = {
  Long: [
    [
      [0, 10, 0],
      [11, 2, 0],
      [14, 2, 12, 1]
    ],
    [
      [0, 6, 0],
      [8, 3, 0],
      [12, 2, 12, 1],
      [14, 2, 7, 1]
    ]
  ],
  Bounce: [
    [
      [0, 3, 0],
      [3, 3, 0],
      [7, 2, 0],
      [10, 4, 0],
      [14, 2, 12, 1]
    ],
    [
      [0, 3, 0],
      [3, 3, 0],
      [6, 2, 12, 1],
      [8, 4, 0],
      [12, 2, 0],
      [14, 2, 7, 1]
    ]
  ],
  Rolling: [
    [
      [0, 6, 0],
      [6, 2, 0],
      [8, 4, 0],
      [12, 2, 12, 1],
      [14, 2, 0, 1]
    ],
    [
      [0, 4, 0],
      [4, 2, 0],
      [6, 2, 0],
      [8, 2, 12, 1],
      [10, 2, 0, 1],
      [12, 4, 0]
    ]
  ],
  Glide: [
    [
      [0, 5, 0],
      [6, 3, 0],
      [10, 3, 12, 1],
      [13, 3, 0, 1]
    ],
    [
      [0, 5, 0],
      [6, 2, 0],
      [8, 4, 7, 1],
      [12, 4, 0, 1]
    ]
  ]
};
const r4 = x => Math.round(x * 10000) / 10000;
let seed = 20261015;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const hum = v => Math.max(1, Math.min(127, Math.round(v + (rnd() - 0.5) * 10)));

/** Chord notes around middle C, moving as little as possible from the last chord. */
function voice(pc, q, prev) {
  const iv = Q[q];
  let best = null,
    bd = 1e9;
  for (let inv = 0; inv < iv.length; inv++) {
    const pcs = iv.map((x, i) => (pc + iv[(i + inv) % iv.length]) % 12);
    let n = 55 + ((pcs[0] - 55 + 1200) % 12);
    const notes = pcs.map((p, i) => {
      if (i) while (n % 12 !== p) n++;
      return n;
    });
    const d = prev ? notes.reduce((a, x, i) => a + Math.abs(x - (prev[i] ?? prev[prev.length - 1])), 0) : notes[0];
    if (notes[notes.length - 1] <= 76 && d < bd) {
      bd = d;
      best = notes;
    }
  }
  return best;
}
/** The chord's triad tones as a ladder: idx 0 is the root in octave `oct`, 3 the root an octave up. */
const ladder = (pc, q, oct) => idx => {
  const t = Q[q].slice(0, 3),
    o = Math.floor(idx / 3),
    i = ((idx % 3) + 3) % 3;
  return 12 * (oct + 1) + pc + t[i] + 12 * o;
};
/** Scale notes from `from` upwards (dir 1) or downwards (-1); the V chord borrows the raised 7th. */
function run(root, from, n, dir, q, deg) {
  const sc = deg === 7 && q !== 'm' ? MINOR.map(x => (x === 10 ? 11 : x)) : MINOR,
    ins = x => sc.includes((((x - root) % 12) + 12) % 12),
    out = [];
  for (let x = from; out.length < n; x += dir) if (ins(x)) out.push(x);
  return out;
}

function parts(P, o) {
  const { tag, keyName, bpm, styles } = o;
  const key = KEYS[keyName],
    R = key.root;
  P.forEach(([prog, chords], pi) => {
    const ix = o.ix(pi);
    const pcOf = ([d]) => (R + d) % 12;
    const id = part => 'gx-' + tag.toLowerCase() + '-p' + (pi + 1) + '-' + part;
    const push = (part, name, pool, role, notes, lively) =>
      FAC.push({
        id: id(part),
        name: tag + ' ' + name + ' ' + prog,
        type: 'tone',
        genre: 'hiphop',
        bpm,
        bars: 4,
        notes: notes.map(n => ({ ...n, s: r4(n.s), l: r4(n.l) })).sort((a, b) => a.s - b.s || a.n - b.n),
        key: { ...key },
        keyName,
        role,
        styles,
        pool,
        gen: true,
        lively: !!lively
      });
    /* 808s */
    ix.b808.forEach(bn => {
      const notes = [];
      chords.forEach((c, b) => {
        const root = 24 + pcOf(c);
        B808[bn][b === 3 ? 1 : 0].forEach(([s, l, up, slide]) => {
          const prev = notes[notes.length - 1];
          if (slide && prev) prev.l = b * 16 + s - prev.s + 0.5;
          notes.push({ s: b * 16 + s, l, n: root + up, v: hum(s === 0 ? 122 : 108) });
        });
      });
      push('808' + bn.toLowerCase(), '808 ' + bn + ' Slide', 'bass', 'Bass', notes, bn !== 'Long');
    });
    /* chords */
    let prev = null;
    const V = chords.map(c => (prev = voice(pcOf(c), c[1], prev)));
    const chordPart = (part, name, A, B, pool, role, lively) => {
      const notes = [];
      V.forEach((vc, b) =>
        (b % 2 ? B : A).forEach(([s, l, vv]) => vc.forEach(n => notes.push({ s: b * 16 + s, l, n, v: hum(vv) })))
      );
      push(part, name, pool, role, notes, lively);
    };
    if (ix.chords.includes('piano'))
      chordPart(
        'piano',
        'Piano Chords',
        [
          [0, 3, 100],
          [3, 3, 80],
          [6, 2, 86],
          [10, 2, 90],
          [12, 4, 84]
        ],
        [
          [0, 3, 100],
          [3, 1, 78],
          [4, 2, 84],
          [8, 8, 90]
        ],
        'chords',
        'Chords',
        true
      );
    if (ix.chords.includes('stabs'))
      chordPart(
        'stabs',
        'Dark Stabs',
        [
          [0, 2, 100],
          [6, 2, 90],
          [12, 2, 94]
        ],
        [
          [0, 2, 100],
          [3, 2, 86],
          [6, 2, 90],
          [8, 6, 96]
        ],
        'chords',
        'Chords'
      );
    if (ix.chords.includes('bounce'))
      chordPart(
        'bounce',
        'Bounce Keys',
        [
          [0, 1, 100],
          [3, 1, 84],
          [6, 2, 90],
          [8, 1, 96],
          [11, 1, 84],
          [14, 2, 90]
        ],
        [
          [0, 1, 100],
          [3, 1, 84],
          [6, 2, 90],
          [10, 2, 90],
          [12, 4, 94]
        ],
        'chords',
        'Chords',
        true
      );
    if (ix.pad === 'organ')
      chordPart(
        'organ',
        'Church Organ',
        [
          [0, 8, 84],
          [8, 8, 78]
        ],
        [[0, 16, 84]],
        'pad',
        'Pad'
      );
    else chordPart('strings', 'Dark Strings', [[0, 16, 82]], [[0, 16, 82]], 'pad', 'Pad');
    /* leads and plucks from chord tones */
    const line = (part, name, pool, role, oct, A, B, lively, extra) => {
      const notes = [];
      chords.forEach((c, b) => {
        const L = ladder(pcOf(c), c[1], oct);
        (b % 2 ? B : A).forEach(([s, l, i, vv = 100]) => notes.push({ s: b * 16 + s, l, n: L(i), v: hum(vv) }));
        if (extra) extra(notes, c, b, L);
      });
      push(part, name, pool, role, notes, lively);
    };
    if (ix.lead.includes('bells'))
      line(
        'bells',
        'Dark Bells',
        'lead',
        'Lead',
        5,
        [
          [0, 1, 2],
          [2, 1, 1],
          [4, 1, 0],
          [6, 1, 1],
          [8, 1, 2],
          [10, 1, 3],
          [12, 2, 2]
        ],
        [
          [0, 1, 2],
          [3, 1, 1],
          [6, 1, 0],
          [8, 1, 1],
          [11, 1, -1],
          [12, 4, 0]
        ]
      );
    if (ix.lead.includes('runs'))
      line(
        'runs',
        'Piano Runs',
        'lead',
        'Lead',
        4,
        [
          [0, 2, 2],
          [3, 1, 1],
          [6, 2, 0],
          [8, 3, 1]
        ],
        [
          [0, 2, 3],
          [3, 1, 2],
          [6, 2, 1]
        ],
        true,
        (notes, c, b, L) => {
          const up = b % 2 === 0,
            at = up ? 12 : 8,
            pos = up ? ROLL.t16 : ROLL2.t8x2,
            ns = run(R, up ? L(0) : L(3), pos.length, up ? 1 : -1, c[1], c[0]);
          pos.forEach((p, i) => notes.push({ s: b * 16 + at + p, l: up ? 0.6 : 1.2, n: ns[i], v: hum(78 + i * 5) }));
        }
      );
    if (ix.lead.includes('drill'))
      line(
        'drillkeys',
        'Drill Piano',
        'lead',
        'Lead',
        4,
        [
          [0, 3, 2],
          [3, 3, 1],
          [6, 2, 0],
          [8, 3, -1],
          [11, 3, 0],
          [14, 2, 1]
        ],
        [
          [0, 3, 2],
          [3, 3, 3],
          [6, 2, 2],
          [8, 6, 1]
        ]
      );
    if (ix.pluck === 'bounce')
      line(
        'pluck',
        'Bounce Pluck',
        'pluck',
        'Lead',
        4,
        [0, 2, 3, 6, 8, 10, 11, 14].map((s, i) => [s, 1, [0, 1, 2, 1, 3, 2, 1, 2][i], i % 2 ? 84 : 100]),
        [0, 2, 3, 6, 8, 11, 12].map((s, i) => [s, 1, [3, 2, 1, 2, 0, 1, 2][i], i % 2 ? 84 : 100]),
        true
      );
    else
      line(
        'tripletarp',
        'Triplet Arp',
        'pluck',
        'Lead',
        4,
        Array.from({ length: 12 }, (_, i) => [(i * 4) / 3, 1.2, [0, 1, 2, 3, 2, 1][i % 6], i % 3 ? 82 : 100]),
        Array.from({ length: 12 }, (_, i) => [(i * 4) / 3, 1.2, [3, 2, 1, 0, 1, 2][i % 6], i % 3 ? 82 : 100]),
        true
      );
  });
}
/* trap: each progression gets two 808s, two chord parts, a pad, two leads and a pluck; the flavours rotate */
const R808 = [
  ['Long', 'Bounce'],
  ['Long', 'Rolling'],
  ['Bounce', 'Rolling']
];
parts(TRAP_P, {
  tag: 'Trap',
  keyName: 'Cm',
  bpm: 140,
  styles: ['trap', 'phonk'],
  ix: i => ({
    b808: R808[i % 3],
    chords: [
      ['piano', 'stabs'],
      ['stabs', 'bounce'],
      ['piano', 'bounce']
    ][i % 3],
    pad: i % 2 ? 'organ' : 'strings',
    lead: ['bells', 'runs'],
    pluck: i % 2 ? 'arp' : 'bounce'
  })
});
/* drill: gliding 808s, dark stabs, strings, sliding piano and bells, triplet arps */
parts(DRILL_P, {
  tag: 'Drill',
  keyName: 'Gm',
  bpm: 142,
  styles: ['drill'],
  ix: i => ({
    b808: ['Glide', i % 2 ? 'Long' : 'Bounce'],
    chords: ['stabs'],
    pad: 'strings',
    lead: ['drill', 'bells'],
    pluck: 'arp'
  })
});
