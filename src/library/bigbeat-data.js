// Big Beat's material (late-90s breakbeat rock-dance): chopped funk breaks, stomping four-to-the-floor
// beats, tambourines and shakers, distorted riffs on minor-pentatonic progressions, stabs, sirens and
// acid lines. library/bigbeat-pack.js turns it into patterns. Data only.
//
// Reads: nothing.

/* Drums: two bars of 16ths per lane (k kick, s snare, c clap, h hat, oh open hat, rd ride, pc tambourine
   or shaker, rim, lt/mt/ht toms, cr crash). X = accent, x = hit, g = ghost, . = rest. */
export const BB_KITS = [
  [
    'Block break',
    {
      k: 'X.....x.x.....x.X.....x...x.....',
      s: '....X..g.g..X..g....X..g.g..X.gX',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'
    }
  ],
  [
    'Rolling break',
    {
      k: 'X.x.......x.....X.x.....x.x.....',
      s: '....X......gX.......X..g...gX..g',
      h: 'x.xxx.x.x.xxx.x.x.xxx.x.x.xxx.x.'
    }
  ],
  [
    'Stomp',
    {
      k: 'X...x...X...x...X...x...X...x...',
      s: '....X.......X.......X.......X...',
      oh: '..x...x...x...x...x...x...x...x.',
      pc: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    }
  ],
  [
    'Skippy break',
    {
      k: 'X..x..x...x..x..X..x..x...x.....',
      s: '....X.g.....X.g.....X.g.....X.gX',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'
    }
  ],
  [
    'Smash',
    {
      k: 'X.........x.....X.........x..x..',
      s: '........X...............X.......',
      cr: 'x...............................',
      rd: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'
    }
  ],
  [
    'Double kick',
    {
      k: 'XX....x..x...x..XX....x..x......',
      s: '....X.......X.......X.......X.g.',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'
    }
  ],
  [
    'Rock break',
    {
      k: 'X.x...x.x.......X.x...x.x...x...',
      s: '....X.......X.......X.......X...',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
      c: '............x...............x...'
    }
  ],
  [
    'Drive',
    {
      k: 'X...x.x.x...x.x.X...x.x.x...x.x.',
      s: '....X.......X.......X.......X...',
      h: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    }
  ],
  [
    'Funk ghost',
    {
      k: 'X.....x...x.....X.....x..x......',
      s: '..g.X..g.gg.X..g..g.X..g.g..X.g.',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.',
      oh: '..............x...............x.'
    }
  ],
  [
    'Shuffle break',
    {
      k: 'X..x......x..x..X..x......x.....',
      s: '....X..g....X..g....X..g....X..g',
      h: 'x..xx..xx..xx..xx..xx..xx..xx..x'
    }
  ],
  [
    'Clap stomp',
    {
      k: 'X...X...X...X...X...X...X...X...',
      c: '....X.......X.......X.......X...',
      h: '..x...x...x...x...x...x...x...x.',
      pc: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'
    }
  ],
  [
    'Breakneck',
    {
      k: 'X.x...x...x.x...X.x...x...x.x.x.',
      s: '....X..g.g..X..g....X..g.g..XgXg',
      h: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'
    }
  ],
  [
    'Lazy break',
    {
      k: 'X.......x.x.....X.......x.......',
      s: '....X.......X.......X.......X..g',
      h: 'x...x...x...x...x...x...x...x...',
      rd: '..x...x...x...x...x...x...x...x.'
    }
  ],
  [
    'Tom break',
    {
      k: 'X.....x...x.....X.....x.........',
      s: '....X.......X.......X...........',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.........',
      lt: '...........................x.x..',
      mt: '........................x.x.....',
      ht: '.........................x......'
    }
  ],
  [
    'Half stomp',
    {
      k: 'X.......x.......X.....x.x.......',
      s: '........X...............X.......',
      c: '........X...............X.......',
      oh: '..x...x...x...x...x...x...x...x.'
    }
  ],
  [
    'Military',
    {
      k: 'X.......X.......X.......X.......',
      s: '....X..g.gg.X.ggg...X..g.gg.XgXg',
      h: 'x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.x.'
    }
  ]
];
/* hats and percussion lines, one bar */
export const BB_HATS = [
  ['8ths', { h: 'x.x.x.x.x.x.x.x.' }],
  ['16ths', { h: 'xxxxxxxxxxxxxxxx' }],
  ['Open offbeats', { oh: '..x...x...x...x.', h: 'x...x...x...x...' }],
  ['Funk 16ths', { h: 'x.xxx.xxx.xxx.xx', oh: '..............x.' }],
  ['Ride', { rd: 'x.x.x.x.x.x.x.x.' }],
  ['Ride bell', { rd: 'x..x..x.x..x..x.' }],
  ['Shuffle', { h: 'x..xx..xx..xx..x' }],
  ['Swing open', { h: 'x.x.x.x.x.x.x...', oh: '..............x.' }]
];
export const BB_PERC = [
  ['Tambourine 16ths', { pc: 'xgxgxgxgxgxgxgxg' }],
  ['Tambourine 8ths', { pc: 'x.x.x.x.x.x.x.x.' }],
  ['Tambourine backbeat', { pc: '....x.......x...' }],
  ['Shaker', { pc: 'gxgxgxgxgxgxgxgx' }],
  ['Cowbell', { pc: 'x..x..x...x.x...' }],
  ['Congas', { lt: 'x.....x...x.....', mt: '...x.....x....x.', ht: '.x......x....x..' }],
  ['Claps offbeat', { c: '..x...x...x...x.' }],
  ['Rim click', { rim: '..x..x....x..x..' }]
];

/* Progressions: [name, chords as [semitones from the key root, 'm' minor, 'M' major, '5' power]].
   Minor ones use the minor key; the major ones lean mixolydian, with the flat seventh. */
export const BB_PROGS_MIN = [
  [
    'i-i-bVII-iv',
    [
      [0, 'm'],
      [0, 'm'],
      [10, 'M'],
      [5, 'm']
    ]
  ],
  [
    'i-bVII-bVI-bVII',
    [
      [0, 'm'],
      [10, 'M'],
      [8, 'M'],
      [10, 'M']
    ]
  ],
  [
    'i-iv-i-bVII',
    [
      [0, 'm'],
      [5, 'm'],
      [0, 'm'],
      [10, 'M']
    ]
  ],
  [
    'i-bIII-iv-iv',
    [
      [0, 'm'],
      [3, 'M'],
      [5, 'm'],
      [5, 'm']
    ]
  ],
  [
    'i-i-iv-V',
    [
      [0, 'm'],
      [0, 'm'],
      [5, 'm'],
      [7, 'M']
    ]
  ],
  [
    'i-bVI-bVII-i',
    [
      [0, 'm'],
      [8, 'M'],
      [10, 'M'],
      [0, 'm']
    ]
  ],
  [
    'i5-bIII5-iv5-bVI5',
    [
      [0, '5'],
      [3, '5'],
      [5, '5'],
      [8, '5']
    ]
  ]
];
export const BB_PROGS_MAJ = [
  [
    'I-bVII-IV-I',
    [
      [0, 'M'],
      [10, 'M'],
      [5, 'M'],
      [0, 'M']
    ]
  ],
  [
    'I-IV-bVII-IV',
    [
      [0, 'M'],
      [5, 'M'],
      [10, 'M'],
      [5, 'M']
    ]
  ],
  [
    'I-I-IV-bVII',
    [
      [0, 'M'],
      [0, 'M'],
      [5, 'M'],
      [10, 'M']
    ]
  ]
];
export const BB_KEYS_MIN = [
  ['Em', 4],
  ['Am', 9],
  ['Dm', 2],
  ['Gm', 7]
];
export const BB_KEYS_MAJ = [
  ['E', 4],
  ['A', 9],
  ['D', 2]
];

/* Chord rhythms, one bar: [step, length]; a third value of 1 adds the octave on top */
export const BB_CHORD_RH = [
  [
    'Stabs',
    [
      [0, 1],
      [3, 1],
      [6, 1],
      [10, 1]
    ]
  ],
  [
    'Horn hits',
    [
      [0, 1, 1],
      [7, 1, 1],
      [10, 2, 1]
    ]
  ],
  ['Organ hold', [[0, 16]]],
  [
    'Power chug',
    [
      [0, 1],
      [2, 1],
      [4, 1],
      [6, 1],
      [8, 1],
      [10, 1],
      [12, 1],
      [14, 1]
    ]
  ],
  [
    'Offbeat chops',
    [
      [2, 1],
      [6, 1],
      [10, 1],
      [14, 1]
    ]
  ],
  [
    'Big hits',
    [
      [0, 3, 1],
      [12, 4, 1]
    ]
  ]
];
/* Basslines over each chord, one bar: [step, length, semitones from the chord root]; slides overlap */
export const BB_BASS_RH = [
  [
    'Riff',
    [
      [0, 2, 0],
      [3, 1, 0],
      [4, 1, 12],
      [6, 2, 10],
      [8, 2, 0],
      [11, 1, 7],
      [12, 2, 5],
      [14, 2, 3]
    ]
  ],
  [
    'Octave bounce',
    [
      [0, 2, 0],
      [2, 2, 12],
      [4, 2, 0],
      [6, 2, 12],
      [8, 2, 0],
      [10, 2, 12],
      [12, 2, 0],
      [14, 2, 12]
    ]
  ],
  [
    'Fuzz hold',
    [
      [0, 6, 0],
      [6, 2, 3],
      [8, 8, 0]
    ]
  ],
  [
    'Acid squelch',
    [
      [0, 1, 0],
      [1, 1, 12],
      [2, 1, 0],
      [3, 2, 3],
      [4, 1, 0],
      [6, 1, 12],
      [7, 1, 10],
      [8, 1, 0],
      [9, 1, 7],
      [10, 1, 0],
      [11, 2, 15],
      [12, 1, 0],
      [14, 1, 12],
      [15, 1, 10]
    ]
  ],
  [
    'Stomp',
    [
      [0, 1, 0],
      [4, 1, 0],
      [8, 1, 0],
      [12, 1, 0],
      [14, 2, 3]
    ]
  ],
  [
    'Walk down',
    [
      [0, 3, 0],
      [3, 1, 0],
      [6, 2, -2],
      [8, 3, -5],
      [11, 1, -5],
      [14, 2, -2]
    ]
  ],
  [
    'Gallop',
    [
      [0, 1, 0],
      [2, 1, 0],
      [3, 1, 0],
      [6, 1, 0],
      [8, 1, 0],
      [10, 1, 0],
      [11, 1, 0],
      [14, 2, 7]
    ]
  ],
  [
    'Break bass',
    [
      [0, 3, 0],
      [6, 1, 0],
      [10, 2, 0],
      [13, 1, 10],
      [14, 2, 12]
    ]
  ]
];
/* Leads, two bars: [step, length, scale step of the minor or major pentatonic, from the root] */
export const BB_LEAD_RH = [
  [
    'Siren',
    [
      [0, 8, 4],
      [8, 8, 5],
      [16, 8, 4],
      [24, 8, 3]
    ]
  ],
  [
    'Hook',
    [
      [0, 1, 0],
      [2, 1, 0],
      [3, 2, 2],
      [6, 2, 1],
      [8, 4, 0],
      [16, 1, 0],
      [18, 1, 0],
      [19, 2, 3],
      [22, 2, 2],
      [24, 8, 1]
    ]
  ],
  [
    'Hoover stabs',
    [
      [0, 2, 5],
      [3, 2, 5],
      [6, 4, 4],
      [16, 2, 5],
      [19, 2, 5],
      [22, 4, 6]
    ]
  ],
  [
    'Call out',
    [
      [0, 3, 2],
      [3, 3, 3],
      [6, 2, 2],
      [8, 8, 0],
      [24, 2, 3],
      [26, 2, 4],
      [28, 4, 5]
    ]
  ],
  [
    'Riff lead',
    [
      [0, 1, 5],
      [2, 1, 4],
      [3, 1, 3],
      [4, 2, 2],
      [8, 1, 5],
      [10, 1, 4],
      [11, 1, 3],
      [12, 2, 4],
      [16, 1, 5],
      [18, 1, 4],
      [19, 1, 3],
      [20, 2, 2],
      [24, 4, 0]
    ]
  ],
  [
    'Rave rise',
    [
      [0, 2, 0],
      [4, 2, 1],
      [8, 2, 2],
      [12, 2, 3],
      [16, 2, 4],
      [20, 2, 5],
      [24, 2, 6],
      [28, 4, 7]
    ]
  ]
];
/* Pluck parts: wah guitar chops and riffs, one bar: [step, length, chord tone index, octave up] */
export const BB_PLUCK_RH = [
  [
    'Wah chops',
    [
      [0, 1, 0],
      [1, 1, 1],
      [2, 1, 2],
      [4, 1, 0],
      [6, 1, 1],
      [8, 1, 0],
      [9, 1, 1],
      [10, 1, 2],
      [12, 1, 0],
      [14, 1, 2]
    ]
  ],
  [
    'Guitar riff',
    [
      [0, 2, 0],
      [3, 1, 1],
      [4, 2, 2],
      [8, 2, 0],
      [11, 1, 2],
      [12, 2, 1, 1],
      [14, 2, 0, 1]
    ]
  ],
  [
    'Picked 8ths',
    [
      [0, 1, 0],
      [2, 1, 2],
      [4, 1, 1],
      [6, 1, 2],
      [8, 1, 0],
      [10, 1, 2],
      [12, 1, 1],
      [14, 1, 2]
    ]
  ]
];
