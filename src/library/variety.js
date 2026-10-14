import { KEYS } from '../core/theory.js';
import { FAC } from './factory.js';

/* ===== Variety pack: more harmony and groove for Live Mode.
   New progressions (borrowed chords, line clichés, Phrygian and Dorian vamps, 8-bar journeys, two chords to a bar,
   pedal points, sus chords that resolve), voice-led chords (each chord moves as little as possible from the last),
   chord rhythms from clave, tresillo, gates, pushes and top-line melodies, and basslines that know the chord:
   root, fifth, octave, the chord's own third and seventh, approach notes into the next chord, anticipations and pedals.
   Bass, chords, pads and arps built on the same progression share its name, so Live Mode keeps them together. ===== */
(function () {
  let seed = 20261014;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  const shuf = a => {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const Q = {
    m: [0, 3, 7],
    M: [0, 4, 7],
    m7: [0, 3, 7, 10],
    M7: [0, 4, 7, 11],
    7: [0, 4, 7, 10],
    m9: [0, 3, 7, 10, 14],
    m7b5: [0, 3, 6, 10],
    M9: [0, 4, 7, 11, 14],
    6: [0, 4, 7, 9],
    m6: [0, 3, 7, 9],
    mM7: [0, 3, 7, 11],
    m11: [0, 3, 7, 10, 14, 17],
    9: [0, 4, 7, 10, 14],
    13: [0, 4, 10, 14, 21],
    '7b9': [0, 4, 7, 10, 13],
    sus4: [0, 5, 7],
    sus2: [0, 2, 7],
    '7sus4': [0, 5, 7, 10],
    add9: [0, 4, 7, 14],
    madd9: [0, 3, 7, 14],
    M7s11: [0, 4, 7, 11, 18],
    aug: [0, 4, 8]
  };
  /* name (roman numerals, so bass and chords can find each other), bars, chords as [semitones from the key's root, quality, length in bars], options */
  const MIN = [
    [
      'i-bVII-bVI-V7',
      4,
      [
        [0, 'm', 1],
        [10, 'M', 1],
        [8, 'M', 1],
        [7, '7', 1]
      ]
    ],
    [
      'im9-ivm9-bVII9-bIIIM9',
      4,
      [
        [0, 'm9', 1],
        [5, 'm9', 1],
        [10, '9', 1],
        [3, 'M9', 1]
      ]
    ],
    [
      'i-imM7-i7-i6',
      4,
      [
        [0, 'm', 1],
        [0, 'mM7', 1],
        [0, 'm7', 1],
        [0, 'm6', 1]
      ]
    ],
    [
      'im7-IV9-im7-IV9',
      4,
      [
        [0, 'm7', 1],
        [5, '9', 1],
        [0, 'm7', 1],
        [5, '9', 1]
      ]
    ],
    [
      'i-bIIM7-i-bVII',
      4,
      [
        [0, 'm', 1],
        [1, 'M7', 1],
        [0, 'm', 1],
        [10, 'M', 1]
      ]
    ],
    [
      'iim7b5-V7b9-im9-bVIM7',
      4,
      [
        [2, 'm7b5', 1],
        [7, '7b9', 1],
        [0, 'm9', 1],
        [8, 'M7', 1]
      ]
    ],
    [
      'i-bVI-bIII-bVII-iv-bVI-bVII-V',
      8,
      [
        [0, 'm', 1],
        [8, 'M', 1],
        [3, 'M', 1],
        [10, 'M', 1],
        [5, 'm', 1],
        [8, 'M', 1],
        [10, 'M', 1],
        [7, '7', 1]
      ]
    ],
    [
      'i-bVII-bVI-bVII',
      2,
      [
        [0, 'm', 0.5],
        [10, 'M', 0.5],
        [8, 'M', 0.5],
        [10, 'M', 0.5]
      ]
    ],
    [
      'im7-ivm7-bVII7-bIIIM7-bVIM7-iim7b5-V7-im9',
      8,
      [
        [0, 'm7', 1],
        [5, 'm7', 1],
        [10, '7', 1],
        [3, 'M7', 1],
        [8, 'M7', 1],
        [2, 'm7b5', 1],
        [7, '7', 1],
        [0, 'm9', 1]
      ]
    ],
    [
      'i-v-bVI-bIII-iv-i-iv-V',
      8,
      [
        [0, 'm', 1],
        [7, 'm', 1],
        [8, 'M', 1],
        [3, 'M', 1],
        [5, 'm', 1],
        [0, 'm', 1],
        [5, 'm', 1],
        [7, 'M', 1]
      ]
    ],
    [
      'i-bIII-IV-iv',
      4,
      [
        [0, 'm', 1],
        [3, 'M', 1],
        [5, 'M', 1],
        [5, 'm', 1]
      ]
    ],
    [
      'i-bVII-bVI-bVII',
      4,
      [
        [0, 'm', 1],
        [10, 'M', 1],
        [8, 'M', 1],
        [10, 'M', 1]
      ],
      { pedal: true }
    ],
    [
      'im7-bVII6-bVIM7-V7sus4-V7',
      4,
      [
        [0, 'm7', 1],
        [10, '6', 1],
        [8, 'M7', 1],
        [7, '7sus4', 0.5],
        [7, '7', 0.5]
      ]
    ],
    [
      'im9-bVIM7-im9-bVIM7',
      4,
      [
        [0, 'm9', 1],
        [8, 'M7', 1],
        [0, 'm9', 1],
        [8, 'M7', 1]
      ]
    ],
    [
      'ivm7-vm7-bVIM7-bVII7',
      4,
      [
        [5, 'm7', 1],
        [7, 'm7', 1],
        [8, 'M7', 1],
        [10, '7', 1]
      ]
    ],
    [
      'i-bIII-bVII-IV',
      4,
      [
        [0, 'm', 1],
        [3, 'M', 1],
        [10, 'M', 1],
        [5, 'M', 1]
      ]
    ],
    [
      'i-iv-V7-bVIM7',
      4,
      [
        [0, 'm', 1],
        [5, 'm', 1],
        [7, '7', 1],
        [8, 'M7', 1]
      ]
    ],
    [
      'im11-bIIIM7-bVIIsus2-ivm9',
      4,
      [
        [0, 'm11', 1],
        [3, 'M7', 1],
        [10, 'sus2', 1],
        [5, 'm9', 1]
      ]
    ],
    [
      'i-iv-bVII-bIII-bVI-bII-V7-V7',
      4,
      [
        [0, 'm', 0.5],
        [5, 'm', 0.5],
        [10, 'M', 0.5],
        [3, 'M', 0.5],
        [8, 'M', 0.5],
        [1, 'M', 0.5],
        [7, '7', 1]
      ]
    ],
    [
      'i-i-bVI-bVII-i-i-iv-V',
      8,
      [
        [0, 'madd9', 2],
        [8, 'M7', 1],
        [10, '6', 1],
        [0, 'madd9', 2],
        [5, 'm7', 1],
        [7, '7sus4', 0.5],
        [7, '7b9', 0.5]
      ]
    ]
  ];
  const MAJ = [
    [
      'I-bVI-bVII-I',
      4,
      [
        [0, 'M', 1],
        [8, 'M', 1],
        [10, 'M', 1],
        [0, 'M', 1]
      ]
    ],
    [
      'IM7-iii7-vim9-II7',
      4,
      [
        [0, 'M7', 1],
        [4, 'm7', 1],
        [9, 'm9', 1],
        [2, '7', 1]
      ]
    ],
    [
      'IM7-ivm6-IM7-ivm6',
      4,
      [
        [0, 'M7', 1],
        [5, 'm6', 1],
        [0, 'M7', 1],
        [5, 'm6', 1]
      ]
    ],
    [
      'IM7-IVM7-IM7-IVM7',
      4,
      [
        [0, 'M7', 1],
        [5, 'M7', 1],
        [0, 'M7', 1],
        [5, 'M7', 1]
      ]
    ],
    [
      'I-V-vi-iii-IV-I-IV-V',
      8,
      [
        [0, 'M', 1],
        [7, 'M', 1],
        [9, 'm', 1],
        [4, 'm', 1],
        [5, 'M', 1],
        [0, 'M', 1],
        [5, 'M', 1],
        [7, 'M', 1]
      ]
    ],
    [
      'I-II7-IV-I',
      4,
      [
        [0, 'M', 1],
        [2, '7', 1],
        [5, 'M', 1],
        [0, 'M', 1]
      ]
    ],
    [
      'iim9-V13-IM9-VI7b9',
      4,
      [
        [2, 'm9', 1],
        [7, '13', 1],
        [0, 'M9', 1],
        [9, '7b9', 1]
      ]
    ],
    [
      'I-iii-vi-V-IV-I-iim7-V7',
      8,
      [
        [0, 'M', 1],
        [4, 'm', 1],
        [9, 'm', 1],
        [7, 'M', 1],
        [5, 'M', 1],
        [0, 'M', 1],
        [2, 'm7', 1],
        [7, '7', 1]
      ]
    ],
    [
      'IVM7-V7-iii7-vim9',
      4,
      [
        [5, 'M7', 1],
        [7, '7', 1],
        [4, 'm7', 1],
        [9, 'm9', 1]
      ]
    ],
    [
      'I-bVII-IV-iv',
      4,
      [
        [0, 'M', 1],
        [10, 'M', 1],
        [5, 'M', 1],
        [5, 'm', 1]
      ]
    ],
    [
      'vi-V-IV-V',
      2,
      [
        [9, 'm', 0.5],
        [7, 'M', 0.5],
        [5, 'M', 0.5],
        [7, 'M', 0.5]
      ]
    ],
    [
      'Isus2-I-IVadd9-V7sus4-V7',
      2,
      [
        [0, 'sus2', 0.5],
        [0, 'M', 0.5],
        [5, 'add9', 0.5],
        [7, '7sus4', 0.25],
        [7, '7', 0.25]
      ]
    ],
    [
      'I-vi-IV-bVII',
      4,
      [
        [0, 'M', 1],
        [9, 'm', 1],
        [5, 'M', 1],
        [10, 'M', 1]
      ]
    ],
    [
      'IM9-bIIIM7-IVM7-ivm6',
      4,
      [
        [0, 'M9', 1],
        [3, 'M7', 1],
        [5, 'M7', 1],
        [5, 'm6', 1]
      ]
    ],
    [
      'IV-I-V-vi',
      4,
      [
        [5, 'M', 1],
        [0, 'M', 1],
        [7, 'M', 1],
        [9, 'm', 1]
      ]
    ],
    [
      'IM7s11-IIadd9-IM7s11-IIadd9',
      4,
      [
        [0, 'M7s11', 1],
        [2, 'add9', 1],
        [0, 'M7s11', 1],
        [2, 'add9', 1]
      ]
    ],
    [
      'I-V-vi-IV',
      4,
      [
        [0, 'M', 1],
        [7, 'M', 1],
        [9, 'm', 1],
        [5, 'M', 1]
      ],
      { pedal: true }
    ],
    [
      'I-iii-IV-iv-I-VI7-iim7-V7',
      8,
      [
        [0, 'M7', 1],
        [4, 'm7', 1],
        [5, 'M7', 1],
        [5, 'm6', 1],
        [0, 'M7', 1],
        [9, '7', 1],
        [2, 'm7', 1],
        [7, '7', 1]
      ]
    ]
  ];
  /* chord rhythms: [name, cell length in steps, hits [step, length, velocity, look-ahead steps, 'sus' = suspended then resolve]] */
  const CRX = [
    [
      'Clave',
      32,
      [
        [0, 2, 100],
        [6, 2, 92],
        [12, 2, 96],
        [20, 2, 94],
        [24, 2, 98]
      ]
    ],
    [
      'Tresillo',
      16,
      [
        [0, 5, 100],
        [6, 5, 92],
        [12, 4, 96]
      ]
    ],
    [
      'Anticipate',
      16,
      [
        [0, 6, 100],
        [8, 4, 86],
        [14, 2, 96, 2]
      ]
    ],
    [
      'Gospel Push',
      16,
      [
        [0, 3, 100],
        [3, 1, 66],
        [6, 4, 92],
        [11, 1, 70],
        [12, 2, 90],
        [14, 2, 98, 2]
      ]
    ],
    [
      'Dotted',
      16,
      [
        [0, 2, 100],
        [3, 2, 88],
        [6, 2, 94],
        [9, 2, 88],
        [12, 4, 96]
      ]
    ],
    ['Trance Gate', 16, 'x.xx.x.xx.x.xx.x'],
    [
      'Swell + Stab',
      32,
      [
        [0, 12, 86],
        [14, 2, 100, 2],
        [16, 1, 98],
        [19, 1, 84],
        [22, 2, 92],
        [26, 1, 86],
        [28, 4, 94]
      ]
    ],
    [
      'Stab Answer',
      32,
      [
        [0, 1, 104],
        [3, 1, 92],
        [6, 2, 96],
        [22, 1, 90],
        [26, 1, 92],
        [28, 4, 98]
      ]
    ],
    [
      'Ghost Skank',
      16,
      [
        [2, 1, 96],
        [4, 1, 48],
        [6, 1, 92],
        [10, 1, 96],
        [12, 1, 48],
        [14, 1, 92]
      ]
    ],
    [
      'Rhodes Comp',
      16,
      [
        [0, 3, 96],
        [4, 1, 62],
        [7, 2, 88],
        [10, 1, 68],
        [11, 3, 92],
        [15, 1, 58]
      ]
    ],
    [
      'Breathe',
      32,
      [
        [0, 14, 92],
        [16, 6, 86],
        [24, 8, 80]
      ]
    ],
    ['Threes', 32, Array.from({ length: 11 }, (_, i) => [i * 3, 2, i % 2 ? 84 : 98])],
    [
      'Charleston',
      16,
      [
        [0, 5, 100],
        [6, 6, 88],
        [14, 2, 94, 2]
      ]
    ],
    [
      'Sus Resolve',
      16,
      [
        [0, 7, 94, 0, 'sus'],
        [8, 8, 90]
      ]
    ],
    ['Top Line', 0, null],
    ['Chop Shop', 16, 'xx.x..x.x.xx.x..'],
    [
      'Late Bloom',
      16,
      [
        [1, 5, 90],
        [7, 1, 74],
        [9, 5, 94],
        [15, 1, 72]
      ]
    ]
  ];
  const CALM = new Set(['Breathe', 'Sus Resolve', 'Top Line', 'Swell + Stab']);
  /* bass tokens: R root, O octave, 5 fifth, L fifth below, 3 the chord's third, 7 its seventh, S step above the root,
     A approach note into the next chord, N the next chord early, P the key's root (pedal) */
  const BG = [
    [
      'Liquid Walk',
      'dnb band hh',
      16,
      [
        [0, 3, 'R', 112],
        [3, 1, 'R', 80],
        [6, 2, 'O', 96],
        [10, 2, '5', 98],
        [12, 2, '3', 92],
        [14, 2, 'A', 96]
      ]
    ],
    [
      'Reese Hold',
      'dnb club',
      16,
      [
        [0, 14, 'R', 110],
        [14, 2, 'A', 96]
      ]
    ],
    [
      'Call & Answer',
      'dnb club hh band',
      32,
      [
        [0, 6, 'R', 112],
        [10, 2, 'R', 96],
        [16, 2, 'R', 108],
        [19, 2, '5', 94],
        [22, 2, 'O', 100],
        [26, 1, '7', 88],
        [28, 2, '5', 92],
        [30, 2, 'A', 96]
      ]
    ],
    [
      'Octave Gallop',
      'club dnb',
      16,
      [
        [0, 1, 'R', 118],
        [1, 1, 'O', 80],
        [2, 1, 'R', 96],
        [4, 1, 'R', 110],
        [5, 1, 'O', 80],
        [6, 1, 'R', 96],
        [8, 1, 'R', 112],
        [9, 1, 'O', 80],
        [10, 1, 'R', 96],
        [12, 1, 'R', 110],
        [13, 1, 'O', 84],
        [14, 1, '5', 92],
        [15, 1, 'A', 96]
      ]
    ],
    [
      'Dub Drop',
      'band hh dnb',
      16,
      [
        [2, 3, 'R', 108],
        [6, 2, 'R', 96],
        [8, 3, '5', 100],
        [12, 2, 'O', 90],
        [14, 2, 'L', 96]
      ]
    ],
    [
      'Funk Pop',
      'band club hh',
      16,
      [
        [0, 1, 'R', 118],
        [2, 1, 'O', 96],
        [3, 1, 'R', 80],
        [6, 1, 'O', 100],
        [7, 1, '7', 86],
        [10, 1, 'R', 110],
        [11, 1, 'O', 90],
        [13, 1, '5', 92],
        [14, 2, 'A', 98]
      ]
    ],
    [
      'Push Sub',
      'dnb club hh band',
      16,
      [
        [0, 3, 'R', 116],
        [3, 3, 'R', 96],
        [6, 4, 'R', 100],
        [12, 2, '5', 94],
        [14, 2, 'N', 104]
      ]
    ],
    [
      'Chord Climb',
      'band hh dnb',
      16,
      [
        [0, 4, 'R', 110],
        [4, 4, '3', 96],
        [8, 4, '5', 100],
        [12, 4, '7', 96]
      ]
    ],
    [
      'Arp Bass',
      'club band',
      16,
      [
        [0, 2, 'R', 112],
        [2, 2, '5', 90],
        [4, 2, 'O', 100],
        [6, 2, '5', 90],
        [8, 2, 'R', 108],
        [10, 2, '5', 90],
        [12, 2, 'O', 100],
        [14, 2, 'A', 96]
      ]
    ],
    [
      'Pedal Pulse',
      'club dnb',
      16,
      [
        [0, 1, 'P', 118],
        [2, 2, 'P', 94],
        [6, 2, 'P', 94],
        [8, 1, 'P', 110],
        [10, 2, 'P', 94],
        [14, 2, 'R', 100]
      ]
    ],
    [
      'Tresillo',
      'band hh club',
      16,
      [
        [0, 5, 'R', 116],
        [6, 5, 'R', 104],
        [12, 2, '5', 98],
        [14, 2, 'A', 94]
      ]
    ],
    [
      'Rolling Off',
      'club dnb',
      16,
      [
        [1, 1, 'R', 100],
        [2, 1, 'R', 92],
        [3, 1, 'O', 86],
        [5, 1, 'R', 100],
        [6, 1, 'R', 92],
        [7, 1, '5', 86],
        [9, 1, 'R', 100],
        [10, 1, 'R', 92],
        [11, 1, 'O', 86],
        [13, 1, 'R', 100],
        [14, 1, '7', 86],
        [15, 1, 'A', 96]
      ]
    ],
    [
      'Halftime Wobble',
      'dnb hh',
      32,
      [
        [0, 8, 'R', 120],
        [8, 4, 'L', 104],
        [12, 4, 'R', 100],
        [16, 6, 'R', 116],
        [22, 2, 'O', 96],
        [24, 4, '3', 96],
        [28, 4, 'A', 98]
      ]
    ],
    [
      'Skippy',
      'club band',
      16,
      [
        [0, 2, 'R', 112],
        [3, 1, 'R', 84],
        [7, 2, 'O', 96],
        [10, 1, 'R', 104],
        [11, 1, '5', 80],
        [14, 2, 'N', 100]
      ]
    ],
    [
      'Slap & Ghost',
      'band hh',
      16,
      [
        [0, 2, 'R', 118],
        [2, 1, 'R', 50],
        [4, 1, 'O', 104],
        [5, 1, 'R', 48],
        [8, 2, 'R', 112],
        [10, 1, 'R', 50],
        [11, 1, '7', 96],
        [12, 1, 'O', 104],
        [14, 1, '5', 92],
        [15, 1, 'A', 90]
      ]
    ],
    [
      'Boom Walk',
      'hh band',
      16,
      [
        [0, 3, 'R', 116],
        [4, 2, 'S', 90],
        [7, 1, '3', 96],
        [8, 3, '5', 104],
        [12, 2, '3', 92],
        [14, 2, 'A', 96]
      ]
    ],
    [
      '808 Glide',
      'hh',
      32,
      [
        [0, 10, 'R', 122],
        [10, 2, 'O', 96],
        [12, 4, '7', 100],
        [16, 6, 'R', 118],
        [22, 4, '5', 100],
        [26, 6, 'N', 104]
      ]
    ],
    [
      'Space',
      'dnb club hh band',
      32,
      [
        [0, 8, 'R', 104],
        [16, 6, 'R', 100],
        [24, 4, '5', 92],
        [28, 4, 'A', 90]
      ]
    ],
    [
      'Machine',
      'club',
      16,
      Array.from({ length: 16 }, (_, i) => [
        i,
        1,
        i === 15 ? 'A' : i % 4 === 3 ? 'O' : 'R',
        i % 4 === 0 ? 118 : i % 2 ? 78 : 96
      ])
    ],
    [
      'Stutter Stop',
      'dnb club',
      32,
      [
        [0, 1, 'R', 118],
        [1, 1, 'R', 90],
        [2, 1, 'R', 100],
        [4, 6, 'R', 112],
        [12, 2, 'O', 96],
        [16, 2, 'R', 112],
        [19, 2, 'R', 96],
        [22, 2, '5', 100],
        [24, 1, 'R', 104],
        [25, 1, 'R', 86],
        [26, 1, 'R', 94],
        [27, 1, 'R', 100],
        [28, 4, 'A', 104]
      ]
    ]
  ];
  const TURN = [
    [0, 4, 'R', 112],
    [4, 2, '5', 96],
    [6, 2, 'O', 100],
    [8, 2, '7', 94],
    [10, 2, '5', 92],
    [12, 2, '3', 92],
    [14, 1, 'S', 88],
    [15, 1, 'A', 96]
  ];
  const CALMB = new Set(['Reese Hold', 'Space']);
  const CLS = {
    dnb: 'dnb',
    dubstep: 'dnb',
    hiphop: 'hh',
    phonk: 'hh',
    house: 'club',
    techno: 'club',
    garage: 'club',
    trance: 'club',
    electro: 'club'
  };
  const thin = iv => {
    iv = iv.slice();
    if (iv.length > 4 && iv.includes(7)) iv.splice(iv.indexOf(7), 1);
    while (iv.length > 4) iv.splice(iv.length - 2, 1);
    return iv;
  };
  /* the voicing of a chord that moves least from the previous one, kept near a centre note */
  function voice(R, off, iv, center, prev) {
    iv = thin(iv);
    let best = null,
      bc = 1e9;
    for (let r = 0; r < iv.length; r++)
      for (let k = -2; k <= 2; k++) {
        const ns = iv.map((x, i) => R + off + x + (i < r ? 12 : 0) + 12 * k + 48).sort((a, b) => a - b);
        const m = ns.reduce((a, b) => a + b, 0) / ns.length;
        let c = Math.abs(m - center) * (prev ? 0.7 : 2) + (ns[ns.length - 1] - ns[0] > 19 ? 6 : 0);
        if (prev) c += ns.reduce((a, n) => a + Math.min(...prev.map(p => Math.abs(p - n))), 0);
        if (c < bc) {
          bc = c;
          best = ns;
        }
      }
    return best;
  }
  function segsOf(P, R, center) {
    const [, bars, list] = P;
    let at = 0;
    const segs = list.map(([off, q, d]) => {
      const s = { s: Math.round(at * 16), e: Math.round((at + d) * 16), off, q };
      at += d;
      return s;
    });
    let prev = null;
    for (let pass = 0; pass < 2; pass++)
      segs.forEach(g => {
        g.v = voice(R, g.off, Q[g.q], center, prev);
        prev = g.v;
      });
    return segs;
  }
  const segAt = (segs, total, s) => {
    s = ((s % total) + total) % total;
    return segs.find(g => s >= g.s && s < g.e) || segs[0];
  };
  const segNext = (segs, g) => segs[(segs.indexOf(g) + 1) % segs.length];
  const cellHits = c =>
    typeof c[2] === 'string'
      ? [...c[2]].map((x, i) => (x === 'x' ? [i, 1, i % 4 === 0 ? 100 : 86] : null)).filter(Boolean)
      : c[2];
  /* lay a cell across the phrase, splitting any note that crosses a chord change so the new chord sounds */
  function tile(total, len, hits, segs, emit, bass) {
    for (let base = 0; base < total; base += len)
      for (const h of hits) {
        let s = base + h[0];
        if (s >= total) continue;
        let l = Math.min(h[1], total - s);
        const look = bass ? 0 : h[3] || 0;
        while (l > 0) {
          const g = segAt(segs, total, s + look),
            end = look ? l : Math.min(l, g.e - (s % total));
          emit(s, Math.max(1, end), h, g);
          if (look) break;
          s += end;
          l -= end;
        }
      }
  }
  let uid = 0;
  const genres = [...new Set(FAC.filter(f => f.pool === 'chords').map(f => f.genre))];
  for (const g of genres) {
    const cls = CLS[g] || 'band';
    const keysOf = sc => [
      ...new Set(
        FAC.filter(
          f => f.genre === g && f.pool === 'chords' && f.keyName && KEYS[f.keyName] && KEYS[f.keyName].scale === sc
        ).map(f => f.keyName)
      )
    ];
    const km = keysOf('minor'),
      kM = keysOf('major');
    const NP = 18,
      nMaj = Math.round((NP * kM.length) / Math.max(1, km.length + kM.length));
    const plan = [
      ...shuf(MIN)
        .slice(0, km.length ? NP - nMaj : 0)
        .map(p => [p, km.length ? km : ['Am']]),
      ...shuf(MAJ)
        .slice(0, kM.length ? nMaj : 0)
        .map(p => [p, kM])
    ];
    const grooves = BG.filter(b => b[1].split(' ').includes(cls));
    let ci = 0,
      bi = 0,
      ki = 0;
    const cr = shuf(CRX),
      bg = shuf(grooves);
    const push = o =>
      FAC.push(Object.assign({ id: 'vx' + g + uid++, genre: g, styles: null, bpm: null, type: 'tone' }, o));
    for (const [P, keys] of plan) {
      const pn = P[0],
        bars = P[1],
        opt = P[3] || {},
        total = bars * 16,
        kn = keys[ki++ % keys.length],
        R = KEYS[kn].root,
        K = { keyName: kn, key: KEYS[kn] };
      const segs = segsOf(P, R, 62);
      /* chords: three rhythms per progression */
      for (let n = 0; n < 3; n++) {
        const c = cr[ci++ % cr.length],
          notes = [];
        if (c[0] === 'Top Line') {
          /* lower voices hold, the top voice sings a little tune from the chord's own notes */
          const TL = [
            [0, 3, 0],
            [3, 3, 1],
            [6, 2, 0],
            [8, 4, -1],
            [12, 2, 0],
            [14, 2, 1]
          ];
          segs.forEach(sg => {
            const lo = sg.v.slice(0, -1),
              top = sg.v[sg.v.length - 1],
              up = sg.v.map(n => n + 12).filter(n => n > top),
              down = sg.v.slice(-2, -1);
            lo.forEach(n => notes.push({ s: sg.s, l: sg.e - sg.s, n, v: 80 }));
            for (let s = sg.s; s < sg.e; s += 16)
              TL.forEach(([o, l, d]) => {
                const at = s + o;
                if (at >= sg.e) return;
                const n = d > 0 ? up[d - 1] || top + 12 : d < 0 ? down[0] || top : top;
                notes.push({ s: at, l: Math.min(l, sg.e - at), n, v: o === 0 ? 100 : 88 });
              });
          });
        } else {
          const len = c[1],
            hits = cellHits(c);
          tile(total, len, hits, segs, (s, l, h, sg) => {
            let v = sg.v;
            const t3 = Q[sg.q][1];
            /* suspended: the third becomes the fourth, and the next hit resolves it */
            if (h[4] === 'sus' && (t3 === 3 || t3 === 4)) {
              const pc = (R + sg.off + t3) % 12;
              v = sg.v.map(n => (((n % 12) + 12) % 12 === pc ? n + (t3 === 3 ? 2 : 1) : n));
            }
            v.forEach(n => notes.push({ s, l, n, v: h[2] }));
          });
        }
        push({
          name: 'Chords: ' + pn + ' ' + c[0],
          bars,
          notes,
          ...K,
          role: 'Chords',
          pool: 'chords',
          lively: !CALM.has(c[0])
        });
      }
      /* basslines: three grooves, and a turnaround in the last bar of longer phrases */
      const tonic = 36 + (R % 12);
      for (let n = 0; n < 3; n++) {
        const b = bg[bi++ % bg.length],
          notes = [],
          turn = bars >= 4 && n === 2;
        const note = (tok, sg, s, l) => {
          const root = 36 + ((((R + sg.off) % 12) + 12) % 12),
            iv = Q[sg.q],
            nx = segNext(segs, sg),
            nr = 36 + ((((R + nx.off) % 12) + 12) % 12);
          switch (tok) {
            case 'R':
              return opt.pedal ? tonic : root;
            case 'P':
              return tonic;
            case 'O':
              return (opt.pedal ? tonic : root) + 12;
            case '5':
              return root + (iv[2] || 7);
            case 'L':
              return root + (iv[2] || 7) - 12;
            case '3':
              return root + iv[1];
            case '7':
              return root + (iv[3] != null && iv[3] < 12 ? iv[3] : 12);
            case 'S':
              return root + 2;
            case 'N':
              return nr;
            case 'A':
              return nr < root ? nr + 1 : nr - 1;
          }
          return root;
        };
        const cut = turn ? total - 16 : total;
        tile(
          total,
          b[2],
          b[3],
          segs,
          (s, l, h, sg) => {
            if (s < cut) notes.push({ s, l: Math.min(l, cut - s), n: note(h[2], sg, s, l), v: h[3] || 100 });
          },
          1
        );
        if (turn)
          tile(
            total,
            total,
            TURN.map(h => [cut + h[0], ...h.slice(1)]),
            segs,
            (s, l, h, sg) => notes.push({ s, l, n: note(h[2], sg, s, l), v: h[3] }),
            1
          );
        push({
          name: 'Bass: ' + pn + ' ' + b[0] + (turn ? ' + Turn' : ''),
          bars,
          notes,
          ...K,
          role: 'Bass',
          pool: 'bass',
          lively: !CALMB.has(b[0])
        });
      }
      /* pad: the voice-led chords held, swelling a little on each change */
      {
        const pv = segsOf(P, R, 57),
          notes = [];
        pv.forEach(sg =>
          sg.v.forEach((n, i) => notes.push({ s: sg.s, l: sg.e - sg.s, n, v: i === sg.v.length - 1 ? 92 : 84 }))
        );
        push({ name: 'Pad: Voice-led ' + pn, bars, notes, ...K, role: 'Pad', pool: 'pad' });
      }
      /* arp: chord tones, following every change */
      {
        const A = [
          ['Ripple', 'xxx.xxx.xx.xxxx.', [0, 1, 2, 3, 2, 1, 0, 1, 3, 2]],
          ['Gallop', 'x.xxx.xxx.xxx.xx', [0, 2, 1, 3, 1, 2, 0, 3]],
          ['Spiral', 'xxxxxxxxxxxxxxxx', [0, 1, 2, 3, 4, 3, 2, 1]],
          ['Skip', 'x..x..x.x..x..x.', [0, 3, 1, 4, 2, 0]]
        ];
        const [an, mask, seq] = A[(ki + uid) % A.length],
          pv = segsOf(P, R, 70),
          notes = [];
        let k = 0;
        for (let s = 0; s < total; s++) {
          if (mask[s % 16] !== 'x') continue;
          const sg = segAt(pv, total, s),
            ts = sg.v,
            idx = seq[k++ % seq.length];
          notes.push({
            s,
            l: 1,
            n: ts[idx % ts.length] + 12 * Math.floor(idx / ts.length),
            v: s % 4 === 0 ? 102 : s % 2 ? 76 : 88
          });
        }
        push({ name: 'Arp: ' + an + ' ' + pn, bars, notes, ...K, role: 'Lead', pool: 'pluck', lively: true });
      }
    }
  }
})();
