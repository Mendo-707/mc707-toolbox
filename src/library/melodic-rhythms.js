// Rhythm and shape banks for the melodic pack (melodic-pack.js): the pad treatments, arp orders and
// rates, lead rhythms and contours, and chord comping rhythms it picks from. Data only.
//
// Reads: nothing.

/* Gates for pads and chords: one bar of 16ths, x = play (with a length to the next x or gate end) */
export const GATES = [
  ['Trance gate', 'xx.xx.x.xx.xx.x.'],
  ['Stutter gate', 'x.x.xx.xx.x.xx.x'],
  ['Offbeat gate', '..x...x...x...x.'],
  ['Triplet-ish gate', 'x..x..x..x..x.x.'],
  ['Chop gate', 'x.xx..x.x.xx..x.'],
  ['Long-short gate', 'xxx.x.xxx.x.xx.x']
];

/* Pads: [name, kind, option]. Kinds are worked out in melodic-pack.js. */
export const PADS = [
  ['Pulse', 'pulse', 2],
  ['Slow pulse', 'pulse', 4],
  ['Breath', 'hits', [0, 6]],
  ['Sigh', 'hits', [2, 6, 10, 14]],
  ['Dotted', 'hits', [0, 3, 6, 9, 12, 14]],
  ['Half-bar push', 'hits', [0, 7]],
  ['Top line', 'topline', 8],
  ['Top line fast', 'topline', 4],
  ['Wide', 'wide', 0],
  ['Shimmer', 'shimmer', 8],
  ['Swell', 'swell', 4],
  ['Suspended', 'sus', 0],
  ...GATES.map(([n, m]) => [n, 'gate', m])
];

/* Arps: tone orders over the chord's notes spread across octaves */
export const ORDERS = [
  ['Up', 'up'],
  ['Down', 'down'],
  ['Up-down', 'updown'],
  ['Down-up', 'downup'],
  ['Converge', 'converge'],
  ['Spread', 'outside'],
  ['Broken thirds', 'thirds'],
  ['Pedal', 'pedal'],
  ['Wander', 'walk'],
  ['Leap', 'leap']
];
/* rates: [name, step length in 16ths, note length] (triplets fall between the 16ths) */
export const RATES = [
  ['16ths', 1, 1],
  ['8ths', 2, 1.5],
  ['8th triplets', 4 / 3, 1.2],
  ['Dotted 8ths', 3, 2],
  ['16th triplets', 2 / 3, 0.6]
];
export const ARP_MASKS = [null, 'xxx.xxx.xxx.xx.x', 'xx.xx.xx.xx.xx.x', 'x.xxx.xxx.xxx.xx', 'xxxx.xxxxxx.xxx.'];

/* Leads: two-bar rhythms as [step, length] (steps in 16ths; .5 = a 32nd off the grid) */
export const LEAD_RHYTHMS = [
  [
    'Call',
    [
      [0, 3],
      [3, 1],
      [4, 2],
      [6, 2],
      [8, 6],
      [16, 2],
      [18, 2],
      [20, 4],
      [26, 6]
    ]
  ],
  [
    'Hook',
    [
      [0, 2],
      [2, 2],
      [4, 1],
      [6, 2],
      [10, 2],
      [12, 4],
      [16, 2],
      [18, 2],
      [20, 1],
      [22, 2],
      [26, 6]
    ]
  ],
  [
    'Syncopated',
    [
      [0, 1.5],
      [3, 1.5],
      [6, 2],
      [10, 1],
      [11, 3],
      [16, 1.5],
      [19, 1.5],
      [22, 3],
      [27, 5]
    ]
  ],
  [
    'Long notes',
    [
      [0, 6],
      [6, 2],
      [8, 8],
      [16, 4],
      [20, 4],
      [24, 8]
    ]
  ],
  [
    'Answer',
    [
      [4, 2],
      [6, 2],
      [8, 4],
      [12, 2],
      [14, 2],
      [20, 2],
      [22, 2],
      [24, 8]
    ]
  ],
  [
    'Run',
    [
      [0, 1],
      [1, 1],
      [2, 1],
      [3, 1],
      [4, 4],
      [8, 2],
      [10, 6],
      [16, 1],
      [17, 1],
      [18, 1],
      [19, 1],
      [20, 4],
      [24, 8]
    ]
  ],
  [
    'Riff',
    [
      [0, 1],
      [2, 1],
      [3, 1],
      [6, 1],
      [8, 1],
      [10, 1],
      [11, 2],
      [14, 2],
      [16, 1],
      [18, 1],
      [19, 1],
      [22, 1],
      [24, 4],
      [30, 2]
    ]
  ],
  [
    'Lazy',
    [
      [1, 3],
      [5, 3],
      [9, 6],
      [17, 3],
      [21, 2],
      [24, 7]
    ]
  ],
  [
    'Triplet phrase',
    [
      [0, 4 / 3],
      [4 / 3, 4 / 3],
      [8 / 3, 4 / 3],
      [4, 4],
      [8, 8],
      [16, 4 / 3],
      [52 / 3, 4 / 3],
      [56 / 3, 4 / 3],
      [20, 4],
      [24, 8]
    ]
  ],
  [
    'Stabs',
    [
      [0, 1],
      [3, 1],
      [6, 1],
      [8, 2],
      [12, 1],
      [14, 1],
      [16, 1],
      [19, 1],
      [22, 1],
      [24, 6]
    ]
  ],
  [
    'Rise and hold',
    [
      [0, 2],
      [2, 2],
      [4, 2],
      [6, 2],
      [8, 8],
      [16, 2],
      [18, 2],
      [20, 2],
      [22, 10]
    ]
  ],
  [
    'Pickup',
    [
      [12, 1],
      [13, 1],
      [14, 2],
      [16, 6],
      [22, 2],
      [24, 4],
      [28, 1],
      [29, 1],
      [30, 2]
    ]
  ]
];
/* contours: how the phrase moves through the scale, one value per note in scale steps (cycled) */
export const CONTOURS = [
  ['Arch', [0, 1, 2, 3, 2, 1]],
  ['Fall', [3, 2, 1, 0, -1]],
  ['Rise', [-1, 0, 1, 2, 3]],
  ['Zigzag', [0, 2, 1, 3, 2, 4]],
  ['Repeat', [0, 0, 1, 0, 0, -1]],
  ['Leap', [0, 4, 3, 1, 2, 0]]
];

/* Chord comping: one bar as [step, length]; a third value of 1 plays the next chord early (a push) */
export const COMPS = [
  [
    'House stab',
    [
      [2, 1],
      [6, 1],
      [10, 1],
      [14, 1]
    ]
  ],
  [
    'Skank',
    [
      [4, 2],
      [12, 2]
    ]
  ],
  [
    'Charleston',
    [
      [0, 3],
      [6, 2]
    ]
  ],
  [
    'Tresillo',
    [
      [0, 2],
      [6, 2],
      [12, 2]
    ]
  ],
  [
    'Push',
    [
      [0, 4],
      [7, 2],
      [14, 2, 1]
    ]
  ],
  [
    'Two-step',
    [
      [0, 2],
      [3, 1],
      [6, 2],
      [10, 2],
      [13, 1]
    ]
  ],
  [
    'Gospel',
    [
      [0, 6],
      [6, 2],
      [10, 4],
      [14, 2, 1]
    ]
  ],
  [
    'Upstrokes',
    [
      [2, 1],
      [6, 1],
      [10, 1],
      [14, 1, 1]
    ]
  ],
  [
    'Chop',
    [
      [0, 1],
      [2, 1],
      [3, 1],
      [6, 1],
      [8, 1],
      [10, 1],
      [11, 1],
      [14, 1]
    ]
  ],
  [
    'Half-time hits',
    [
      [0, 4],
      [8, 6]
    ]
  ],
  [
    'Offbeat pairs',
    [
      [2, 1],
      [3, 1],
      [10, 1],
      [11, 1]
    ]
  ],
  [
    '3-3-2',
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 3],
      [11, 3],
      [14, 2]
    ]
  ],
  [
    'Anticipation',
    [
      [0, 6],
      [6, 1],
      [7, 7, 1]
    ]
  ],
  [
    'Rolled hits',
    [
      [0, 2, 0, 'roll'],
      [8, 2, 0, 'roll'],
      [12, 2, 0, 'roll']
    ]
  ],
  [
    'Broken',
    [
      [0, 2, 0, 'low'],
      [2, 2, 0, 'high'],
      [6, 2, 0, 'low'],
      [8, 2, 0, 'high'],
      [12, 2, 0, 'low'],
      [14, 2, 0, 'high']
    ]
  ]
];
