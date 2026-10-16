// The groove pack's material: modal chord progressions (Dorian, Mixolydian, Lydian, Phrygian,
// harmonic minor, blues), each genre's groovy keys and rhythms for chords, basslines and melodies,
// and four new drum grooves per genre. library/groove-pack.js turns it into patterns.
//
// Reads: nothing.

/* chord qualities: semitones above the chord root */
export const QUAL = {
  m: [0, 3, 7],
  M: [0, 4, 7],
  m7: [0, 3, 7, 10],
  M7: [0, 4, 7, 11],
  7: [0, 4, 7, 10],
  m9: [0, 3, 7, 10, 14],
  M9: [0, 4, 7, 11, 14],
  9: [0, 4, 7, 10, 14],
  13: [0, 4, 10, 14, 21],
  m11: [0, 3, 7, 10, 14, 17],
  add9: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  6: [0, 4, 7, 9],
  m6: [0, 3, 7, 9]
};
/* melody scales (semitones from the key's root) and the note that gives each mode its colour */
export const MODE = {
  dorian: { sc: [0, 2, 3, 5, 7, 9, 10], color: 9 },
  mixolydian: { sc: [0, 2, 4, 5, 7, 9, 10], color: 10 },
  lydian: { sc: [0, 2, 4, 6, 7, 9, 11], color: 6 },
  phrygian: { sc: [0, 1, 3, 5, 7, 8, 10], color: 1 },
  'harmonic minor': { sc: [0, 2, 3, 5, 7, 8, 11], color: 11 },
  minor: { sc: [0, 2, 3, 5, 7, 8, 10], color: 8 },
  major: { sc: [0, 2, 4, 5, 7, 9, 11], color: 9 },
  blues: { sc: [0, 3, 5, 6, 7, 10], color: 6 }
};
/* progressions: name (roman numerals, so Live keeps parts together), bars, chords [semitones from the
   key's root, quality, length in bars], the scale melodies use, and the genres it suits */
export const GPROGS = [
  [
    'i7-IV9-i7-IV9',
    4,
    [
      [0, 'm7', 1],
      [5, '9', 1],
      [0, 'm7', 1],
      [5, '9', 1]
    ],
    'dorian',
    'funk house garage hiphop latin dnb electro'
  ],
  [
    'im9-IV13-im9-bVIIM9',
    4,
    [
      [0, 'm9', 1],
      [5, '13', 1],
      [0, 'm9', 1],
      [10, 'M9', 1]
    ],
    'dorian',
    'house garage dnb hiphop funk'
  ],
  [
    'im7-iim7-bIIIM7-iim7',
    4,
    [
      [0, 'm7', 1],
      [2, 'm7', 1],
      [3, 'M7', 1],
      [2, 'm7', 1]
    ],
    'dorian',
    'house dnb ambient hiphop funk garage'
  ],
  [
    'i7-IV9-i7-IV9',
    2,
    [
      [0, 'm7', 0.5],
      [5, '9', 0.5],
      [0, 'm7', 0.5],
      [5, '9', 0.5]
    ],
    'dorian',
    'funk house techno latin reggae'
  ],
  [
    'I-bVII-IV-I',
    4,
    [
      [0, 'M', 1],
      [10, 'M', 1],
      [5, 'M', 1],
      [0, 'M', 1]
    ],
    'mixolydian',
    'rock pop house latin reggae synth'
  ],
  [
    'I7-bVII-IV-I7',
    4,
    [
      [0, '7', 1],
      [10, 'M', 1],
      [5, 'add9', 1],
      [0, '7', 1]
    ],
    'mixolydian',
    'funk latin reggae electro rock'
  ],
  [
    'IM7-IIadd9-IM7-IIadd9',
    4,
    [
      [0, 'M7', 1],
      [2, 'add9', 1],
      [0, 'M7', 1],
      [2, 'add9', 1]
    ],
    'lydian',
    'synth ambient trance pop dnb'
  ],
  [
    'i-bII-bIII-bII',
    4,
    [
      [0, 'm', 1],
      [1, 'M', 1],
      [3, 'M', 1],
      [1, 'M', 1]
    ],
    'phrygian',
    'techno dubstep dnb trance'
  ],
  [
    'im7-bIIM7-bVIIm7-im7',
    4,
    [
      [0, 'm7', 1],
      [1, 'M7', 1],
      [10, 'm7', 1],
      [0, 'm7', 1]
    ],
    'phrygian',
    'techno dubstep electro'
  ],
  [
    'i-iv-V7-i',
    4,
    [
      [0, 'm', 1],
      [5, 'm', 1],
      [7, '7', 1],
      [0, 'm', 1]
    ],
    'harmonic minor',
    'dubstep trance latin hiphop rock'
  ],
  [
    'i-bVI-bII-V7',
    4,
    [
      [0, 'm', 1],
      [8, 'M', 1],
      [1, 'M', 1],
      [7, '7', 1]
    ],
    'harmonic minor',
    'dubstep trance techno latin'
  ],
  [
    'i7-iv7-i7-v7',
    4,
    [
      [0, 'm7', 1],
      [5, 'm7', 1],
      [0, 'm7', 1],
      [7, 'm7', 1]
    ],
    'blues',
    'hiphop funk rock reggae dnb'
  ],
  [
    'I7-IV7-I7-V7',
    4,
    [
      [0, '7', 1],
      [5, '7', 1],
      [0, '7', 1],
      [7, '7', 1]
    ],
    'mixolydian',
    'funk rock electro latin'
  ],
  [
    'iim9-V13-IM9-vi9',
    4,
    [
      [2, 'm9', 1],
      [7, '13', 1],
      [0, 'M9', 1],
      [9, 'm9', 1]
    ],
    'major',
    'hiphop house garage latin pop'
  ],
  [
    'IVM7-iiim7-vim9-Vsus4',
    4,
    [
      [5, 'M7', 1],
      [4, 'm7', 1],
      [9, 'm9', 1],
      [7, 'sus4', 1]
    ],
    'major',
    'pop house garage synth ambient'
  ],
  [
    'vi-IV-I-V',
    4,
    [
      [9, 'm', 1],
      [5, 'M', 1],
      [0, 'M', 1],
      [7, 'M', 1]
    ],
    'major',
    'pop trance synth dnb house'
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
    'minor',
    'rock trance synth dnb electro'
  ],
  [
    'i-bIII-bVII-IV',
    4,
    [
      [0, 'm', 1],
      [3, 'M', 1],
      [10, 'M', 1],
      [5, 'M', 1]
    ],
    'dorian',
    'rock pop dnb reggae'
  ],
  [
    'i-v-bVI-bIII',
    4,
    [
      [0, 'm', 1],
      [7, 'm', 1],
      [8, 'M', 1],
      [3, 'M', 1]
    ],
    'minor',
    'trance synth pop ambient'
  ],
  [
    'i-IV-i-IV',
    4,
    [
      [0, 'm', 1],
      [5, 'M', 1],
      [0, 'm', 1],
      [5, 'M', 1]
    ],
    'dorian',
    'reggae latin funk house'
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
    'major',
    'pop reggae latin rock'
  ],
  [
    'im11-bVIIsus2-bVIM7-bVIIsus2',
    4,
    [
      [0, 'm11', 1],
      [10, 'sus2', 1],
      [8, 'M7', 1],
      [10, 'sus2', 1]
    ],
    'dorian',
    'dnb ambient garage house'
  ],
  [
    'im7-bVII-bVIM7-bVII',
    4,
    [
      [0, 'm7', 1],
      [10, 'M', 1],
      [8, 'M7', 1],
      [10, 'M', 1]
    ],
    'minor',
    'garage dnb synth electro'
  ],
  [
    'im9-bIIIM7-ivm7-bVIIsus4',
    4,
    [
      [0, 'm9', 1],
      [3, 'M7', 1],
      [5, 'm7', 1],
      [10, 'sus4', 1]
    ],
    'dorian',
    'hiphop ambient dnb house'
  ]
];
/* per genre: groovy keys [root, mode family], and the rhythm families for its parts */
export const GSET = {
  dnb: {
    keys: [
      [5, 'minor'],
      [2, 'dorian'],
      [9, 'minor']
    ],
    ch: 'liquid',
    bs: 'dnb',
    ld: 'sparse',
    ar: 16,
    tag: 'DnB',
    bpm: 174
  },
  hiphop: {
    keys: [
      [1, 'dorian'],
      [5, 'minor'],
      [0, 'dorian']
    ],
    ch: 'lazy',
    bs: 'boombap',
    ld: 'soul',
    ar: 't8',
    tag: 'HH',
    bpm: 90
  },
  house: {
    keys: [
      [9, 'dorian'],
      [5, 'minor'],
      [0, 'major']
    ],
    ch: 'house',
    bs: 'house',
    ld: 'hook',
    ar: 16,
    tag: 'House',
    bpm: 124
  },
  techno: {
    keys: [
      [6, 'phrygian'],
      [7, 'minor'],
      [9, 'dorian']
    ],
    ch: 'techno',
    bs: 'rolling',
    ld: 'acid',
    ar: 16,
    tag: 'Techno',
    bpm: 132
  },
  garage: {
    keys: [
      [6, 'minor'],
      [1, 'dorian'],
      [8, 'major']
    ],
    ch: 'garage',
    bs: 'garage',
    ld: 'hook',
    ar: 16,
    tag: 'Garage',
    bpm: 132
  },
  dubstep: {
    keys: [
      [5, 'phrygian'],
      [4, 'minor'],
      [2, 'harmonic minor']
    ],
    ch: 'sustain',
    bs: 'halftime',
    ld: 'sparse',
    ar: 't8',
    tag: 'Dubstep',
    bpm: 140
  },
  trance: {
    keys: [
      [9, 'minor'],
      [6, 'minor'],
      [2, 'lydian']
    ],
    ch: 'gate',
    bs: 'offbeat',
    ld: 'anthem',
    ar: 16,
    tag: 'Trance',
    bpm: 138
  },
  electro: {
    keys: [
      [4, 'minor'],
      [9, 'phrygian'],
      [2, 'dorian']
    ],
    ch: 'stab',
    bs: 'electro',
    ld: 'hook',
    ar: 16,
    tag: 'Electro',
    bpm: 125
  },
  funk: {
    keys: [
      [4, 'dorian'],
      [9, 'mixolydian'],
      [2, 'dorian']
    ],
    ch: 'chop',
    bs: 'slap',
    ld: 'riff',
    ar: 16,
    tag: 'Funk',
    bpm: 105
  },
  reggae: {
    keys: [
      [2, 'minor'],
      [7, 'major'],
      [9, 'dorian']
    ],
    ch: 'skank',
    bs: 'onedrop',
    ld: 'melodica',
    ar: 8,
    tag: 'Reggae',
    bpm: 75
  },
  latin: {
    keys: [
      [9, 'minor'],
      [2, 'dorian'],
      [7, 'mixolydian']
    ],
    ch: 'montuno',
    bs: 'tumbao',
    ld: 'hook',
    ar: 't8',
    tag: 'Latin',
    bpm: 98
  },
  synth: {
    keys: [
      [9, 'minor'],
      [2, 'minor'],
      [4, 'lydian']
    ],
    ch: 'sustain8',
    bs: 'octave8',
    ld: 'anthem',
    ar: 16,
    tag: 'Synth',
    bpm: 110
  },
  pop: {
    keys: [
      [0, 'major'],
      [7, 'major'],
      [9, 'minor']
    ],
    ch: 'pop',
    bs: 'pop8',
    ld: 'hook',
    ar: 8,
    tag: 'Pop',
    bpm: 118
  },
  ambient: {
    keys: [
      [2, 'lydian'],
      [4, 'major'],
      [9, 'dorian']
    ],
    ch: 'sustain',
    bs: 'whole',
    ld: 'sparse',
    ar: 8,
    tag: 'Ambient',
    bpm: 70
  },
  rock: {
    keys: [
      [4, 'mixolydian'],
      [9, 'minor'],
      [2, 'dorian']
    ],
    ch: 'power8',
    bs: 'rock8',
    ld: 'riff',
    ar: 8,
    tag: 'Rock',
    bpm: 120
  }
};
/* the styles each genre feeds (tone parts suit every style of their genre) */
export const GSTYLES = {
  dnb: ['liquid', 'neuro', 'jungle', 'jumpup', 'halftime'],
  hiphop: ['boombap', 'lofi', 'gfunk', 'neosoul', 'memphis', 'phonk'],
  house: ['deephouse', 'classichouse', 'techhouse', 'afrohouse'],
  techno: ['techno', 'minimal', 'acidtechno'],
  garage: ['ukgarage', 'speedgarage'],
  dubstep: ['dubstep', 'riddim'],
  trance: ['trance', 'progtrance'],
  electro: ['electro', 'breakbeat'],
  funk: ['funk', 'disco', 'nudisco'],
  reggae: ['reggae', 'dub', 'dancehall'],
  latin: ['reggaeton', 'afrobeats'],
  synth: ['synthwave'],
  pop: ['pop', 'indie'],
  ambient: ['ambient', 'cinematic'],
  rock: ['rock', 'punk']
};
const r16 = (steps, v = [96, 80, 90, 84]) => steps.map((s, i) => [s, 1, v[i % v.length]]);
/* chord rhythms, one bar: [step, length, velocity]; two per family */
export const CH_RH = {
  liquid: [
    [
      [0, 6, 92],
      [6, 2, 70],
      [8, 6, 88],
      [14, 2, 72]
    ],
    [[0, 16, 80]]
  ],
  lazy: [
    [
      [0, 6, 96],
      [7, 3, 70],
      [10, 6, 84]
    ],
    [
      [0, 3, 90],
      [3, 3, 70],
      [8, 4, 88],
      [14, 2, 70]
    ]
  ],
  house: [
    [
      [2, 2, 96],
      [6, 2, 90],
      [10, 2, 96],
      [14, 2, 90]
    ],
    [
      [0, 3, 100],
      [3, 3, 80],
      [6, 4, 92],
      [10, 2, 80],
      [12, 3, 90]
    ]
  ],
  techno: [
    [
      [3, 1, 100],
      [11, 1, 90]
    ],
    [
      [0, 1, 100],
      [3, 1, 80],
      [6, 1, 90],
      [10, 1, 80],
      [13, 1, 90]
    ]
  ],
  garage: [
    [
      [0, 2, 100],
      [3, 2, 84],
      [6, 2, 92],
      [10, 3, 96]
    ],
    [
      [2, 2, 90],
      [7, 2, 84],
      [10, 2, 92],
      [14, 2, 84]
    ]
  ],
  sustain: [
    [[0, 16, 82]],
    [
      [0, 8, 84],
      [8, 8, 78]
    ]
  ],
  gate: [
    r16([0, 2, 3, 4, 6, 7, 8, 10, 11, 12, 14, 15]),
    [
      [2, 2, 96],
      [6, 2, 96],
      [10, 2, 96],
      [14, 2, 96]
    ]
  ],
  stab: [
    [
      [0, 1, 100],
      [3, 1, 84],
      [6, 1, 96],
      [10, 1, 90],
      [12, 1, 84]
    ],
    [
      [0, 2, 100],
      [8, 2, 90],
      [11, 1, 80]
    ]
  ],
  chop: [r16([0, 2, 3, 6, 8, 10, 11, 14], [100, 70, 86, 92]), r16([1, 4, 7, 9, 12, 15], [90, 100, 84, 92])],
  skank: [
    [
      [4, 1, 96],
      [12, 1, 96]
    ],
    r16([2, 4, 6, 10, 12, 14], [86, 96, 84])
  ],
  montuno: [
    r16([0, 3, 6, 8, 10, 13], [96, 88, 92, 80]),
    [
      [0, 2, 96],
      [3, 2, 84],
      [7, 2, 92],
      [10, 2, 88]
    ]
  ],
  sustain8: [[0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, i % 2 ? 80 : 94]), [[0, 16, 84]]],
  pop: [
    [
      [0, 4, 96],
      [4, 4, 82],
      [8, 4, 90],
      [12, 4, 82]
    ],
    [
      [0, 6, 96],
      [6, 2, 80],
      [8, 6, 90],
      [14, 2, 80]
    ]
  ],
  power8: [
    [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, i % 2 ? 84 : 100]),
    [
      [0, 6, 100],
      [6, 2, 84],
      [8, 8, 96]
    ]
  ]
};
const off16 = (v = [96, 80, 90]) => [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15].map((s, i) => [s, 1, 'R', v[i % 3]]);
/* bass rhythms, one bar: [step, length, tone, velocity]. Tones: R root, 5 fifth, 8 octave, 3 the chord's
   third, 7 its seventh, b the groove seventh, 6 sixth, 4 fourth, a an approach into the next chord */
export const BS_RH = {
  dnb: [
    [
      [0, 6, 'R', 112],
      [6, 2, 'R', 90],
      [10, 4, '5', 100],
      [14, 2, 'a', 92]
    ],
    [
      [0, 10, 'R', 110],
      [11, 2, '8', 90],
      [14, 2, '7', 90]
    ]
  ],
  boombap: [
    [
      [0, 3, 'R', 110],
      [3, 1, 'R', 70],
      [7, 2, '5', 96],
      [10, 4, 'R', 100],
      [14, 2, 'a', 84]
    ],
    [
      [0, 6, 'R', 110],
      [8, 2, '3', 90],
      [10, 2, '4', 90],
      [12, 4, '5', 96]
    ]
  ],
  house: [
    [
      [2, 2, 'R', 100],
      [6, 2, 'R', 96],
      [10, 2, '8', 100],
      [14, 2, 'R', 92]
    ],
    [
      [0, 2, 'R', 104],
      [3, 1, 'R', 80],
      [6, 2, '8', 96],
      [10, 2, 'R', 92],
      [12, 2, '7', 86],
      [14, 2, '5', 90]
    ]
  ],
  rolling: [
    off16(),
    [
      [0, 1, 'R', 110],
      [3, 1, 'R', 90],
      [6, 1, 'R', 96],
      [8, 1, 'b', 80],
      [11, 1, 'R', 96],
      [14, 1, '5', 86]
    ]
  ],
  garage: [
    [
      [0, 3, 'R', 110],
      [3, 2, 'R', 84],
      [7, 2, '5', 96],
      [10, 3, 'R', 100],
      [14, 2, '7', 84]
    ],
    [
      [0, 2, 'R', 106],
      [4, 1, '8', 80],
      [6, 2, 'R', 96],
      [9, 2, '5', 90],
      [12, 4, 'R', 96]
    ]
  ],
  halftime: [
    [
      [0, 8, 'R', 116],
      [10, 2, 'R', 96],
      [12, 4, 'b', 100]
    ],
    [
      [0, 4, 'R', 116],
      [6, 2, '8', 100],
      [8, 8, '5', 100]
    ]
  ],
  offbeat: [
    off16([96, 84, 92]),
    [
      [2, 2, 'R', 100],
      [6, 2, 'R', 100],
      [10, 2, 'R', 100],
      [14, 2, 'R', 100]
    ]
  ],
  electro: [
    [
      [0, 2, 'R', 110],
      [3, 1, 'R', 90],
      [6, 2, '8', 100],
      [8, 1, 'R', 90],
      [10, 2, 'b', 96],
      [12, 1, 'R', 90],
      [14, 2, '5', 96]
    ],
    [
      [0, 3, 'R', 110],
      [4, 1, '8', 90],
      [7, 2, 'R', 96],
      [11, 1, '5', 90],
      [12, 4, 'R', 100]
    ]
  ],
  slap: [
    [
      [0, 1, 'R', 112],
      [2, 1, '8', 96],
      [3, 1, 'R', 60],
      [4, 1, 'b', 90],
      [6, 1, '8', 100],
      [7, 1, 'R', 60],
      [8, 1, '5', 96],
      [10, 1, '6', 90],
      [11, 1, '5', 70],
      [12, 1, '4', 90],
      [14, 1, '3', 96],
      [15, 1, 'a', 84]
    ],
    [
      [0, 2, 'R', 110],
      [3, 1, 'R', 70],
      [4, 1, '8', 100],
      [7, 1, 'b', 90],
      [8, 2, '5', 96],
      [11, 1, '6', 86],
      [12, 2, 'R', 100],
      [14, 1, 'b', 86],
      [15, 1, 'a', 80]
    ]
  ],
  onedrop: [
    [
      [0, 3, 'R', 104],
      [4, 2, '5', 90],
      [6, 2, '8', 96],
      [10, 2, 'R', 96],
      [12, 2, 'b', 90],
      [14, 2, '5', 86]
    ],
    [
      [2, 2, 'R', 100],
      [4, 1, 'R', 80],
      [6, 2, '3', 90],
      [8, 4, '5', 96],
      [13, 3, 'a', 88]
    ]
  ],
  tumbao: [
    [
      [3, 3, '5', 100],
      [6, 2, 'R', 96],
      [11, 3, '5', 100],
      [14, 2, 'R', 96]
    ],
    [
      [0, 3, 'R', 104],
      [3, 3, '5', 96],
      [8, 3, 'R', 100],
      [11, 3, '8', 92],
      [14, 2, 'a', 88]
    ]
  ],
  octave8: [
    [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 1, i % 2 ? '8' : 'R', i % 2 ? 86 : 100]),
    [
      [0, 3, 'R', 100],
      [3, 1, 'R', 80],
      [4, 2, '8', 90],
      [6, 2, 'R', 86],
      [8, 3, 'R', 100],
      [11, 1, '5', 80],
      [12, 4, '8', 90]
    ]
  ],
  pop8: [
    [
      [0, 2, 'R', 100],
      [2, 2, 'R', 86],
      [4, 2, 'R', 92],
      [6, 2, '5', 86],
      [8, 2, 'R', 100],
      [10, 2, 'R', 86],
      [12, 2, '8', 92],
      [14, 2, 'a', 86]
    ],
    [
      [0, 6, 'R', 104],
      [6, 2, '5', 90],
      [8, 6, 'R', 100],
      [14, 2, 'a', 86]
    ]
  ],
  whole: [
    [[0, 16, 'R', 90]],
    [
      [0, 12, 'R', 90],
      [12, 4, '5', 80]
    ]
  ],
  rock8: [
    [0, 2, 4, 6, 8, 10, 12, 14].map((s, i) => [s, 2, i === 7 ? 'a' : 'R', i % 2 ? 88 : 100]),
    [
      [0, 3, 'R', 104],
      [3, 1, 'R', 80],
      [4, 2, 'R', 96],
      [6, 2, '5', 90],
      [8, 3, 'R', 104],
      [11, 1, 'R', 80],
      [12, 2, 'b', 92],
      [14, 2, 'a', 88]
    ]
  ]
};
/* melody rhythms: a call (bars 1 and 3) and an answer (bar 2); bar 4 ends on a long note */
export const LD_RH = {
  sparse: [
    [
      [0, 3],
      [4, 2],
      [8, 6]
    ],
    [
      [2, 2],
      [6, 2],
      [8, 8]
    ]
  ],
  soul: [
    [
      [0, 2],
      [3, 1],
      [4, 3],
      [8, 2],
      [10, 1],
      [11, 5]
    ],
    [
      [2, 1],
      [3, 2],
      [6, 2],
      [8, 6],
      [14, 2]
    ]
  ],
  hook: [
    [
      [0, 1],
      [2, 1],
      [3, 2],
      [6, 2],
      [8, 1],
      [10, 1],
      [11, 3]
    ],
    [
      [0, 2],
      [3, 1],
      [4, 2],
      [7, 1],
      [8, 4],
      [14, 2]
    ]
  ],
  acid: [[0, 1, 3, 4, 6, 7, 9, 10, 12, 14, 15].map(s => [s, 1]), [0, 2, 3, 5, 6, 8, 10, 11, 13, 14].map(s => [s, 1])],
  anthem: [
    [
      [0, 2],
      [2, 2],
      [4, 4],
      [8, 2],
      [10, 2],
      [12, 4]
    ],
    [
      [0, 3],
      [3, 3],
      [6, 2],
      [8, 8]
    ]
  ],
  riff: [
    [
      [0, 1],
      [1, 1],
      [3, 1],
      [5, 1],
      [6, 2],
      [9, 1],
      [10, 1],
      [12, 2],
      [14, 1]
    ],
    [
      [0, 2],
      [3, 1],
      [4, 1],
      [6, 1],
      [8, 2],
      [11, 1],
      [12, 1],
      [14, 2]
    ]
  ],
  melodica: [
    [
      [0, 3],
      [4, 1],
      [6, 2],
      [8, 4],
      [12, 4]
    ],
    [
      [2, 2],
      [4, 2],
      [8, 6],
      [14, 2]
    ]
  ]
};
/* four new drum grooves per genre: [name, bars, lanes, styles (null = every style of the genre)] */
const R = (s, n) => Array(n).fill(s).join('|');
export const GDRUMS = {
  dnb: [
    [
      'Two-Step Ghost Roll',
      2,
      {
        k: 'x.........x.....|x.........x..x..',
        s: '....x..g.g..x..g|....x..g.g..x.g.',
        h: R('xoxoxoxoxoxoxoxo', 2),
        oh: '..............o.|......o.........'
      },
      ['liquid', 'neuro', 'jumpup']
    ],
    [
      'Liquid Shuffle',
      2,
      { k: 'x.........x.....|x......x..x.....', s: '....x.......x..g|....x..g....x...', h: R('x.xox.xox.xox.xo', 2) },
      ['liquid', 'jungle']
    ],
    [
      'Rolling Rimshot',
      2,
      {
        k: 'x.....x...x.....|x.........x.....',
        s: R('....x.......x...', 2),
        rim: R('..g...g...g.g..g', 2),
        h: R('x.x.x.x.x.x.x.x.', 2)
      },
      ['liquid', 'neuro', 'jungle', 'jumpup']
    ],
    [
      'Tumbling Break',
      2,
      { k: 'x.x.......x.....|x.x.....x.x.....', s: '....x.......x...|....x..g....x.xg', h: R('xxoxxxoxxxoxxxox', 2) },
      ['jungle', 'jumpup']
    ]
  ],
  hiphop: [
    [
      'Swung Boom Bap',
      2,
      { k: 'x.......x.x.....|x..x....x.x..x..', s: '....x..g....x...|....x......gx...', h: R('x.o.x.o.x.o.x.oo', 2) },
      ['boombap', 'lofi', 'gfunk']
    ],
    [
      'Dusty Ghosts',
      2,
      { k: 'x......x..x.....|x......x.x......', s: '....x..g.g..x...|....x..g...gx..g', h: R('xoxoxoxoxoxoxoxo', 2) },
      ['boombap', 'lofi', 'neosoul']
    ],
    [
      'Neo Pocket',
      1,
      { k: 'x.....x...x..x..', s: '....x.......x...', rim: '..g....g..g....g', h: 'x.xox.xox.xox.xo' },
      ['neosoul', 'lofi', 'gfunk']
    ],
    [
      'Head Nod Rim',
      1,
      { k: 'x..x......x.....', rim: '....x.......x...', h: 'o.x.o.x.o.x.o.x.', pc: '..x.......x.....' },
      ['boombap', 'gfunk', 'lofi']
    ]
  ],
  house: [
    [
      'Deep Shuffle',
      1,
      { k: 'x...x...x...x...', c: '....x.......x...', oh: '..x...x...x...x.', pc: 'o.oxo.oxo.oxo.ox' },
      null
    ],
    [
      'Garage-Tinged House',
      1,
      { k: 'x...x...x...x...', c: '....x.......x..g', h: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.' },
      null
    ],
    [
      'Afro House Drive',
      1,
      {
        k: 'x...x...x...x...',
        rim: '...x..x....x..x.',
        pc: 'x.oxx.oxx.oxx.ox',
        lt: '......x.......x.',
        mt: '..x.......x.....'
      },
      ['afrohouse', 'deephouse']
    ],
    [
      'Disco Open',
      1,
      { k: 'x...x...x...x...', c: '....x.......x...', oh: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' },
      ['classichouse', 'techhouse', 'deephouse']
    ]
  ],
  techno: [
    [
      'Rumble 16ths',
      1,
      { k: 'x...x...x...x...', h: 'xoxxxoxxxoxxxoxx', oh: '..x...x...x...x.', rim: '......x.......x.' },
      null
    ],
    [
      'Minimal Click',
      1,
      { k: 'x...x...x...x...', rim: '...x......x..x..', h: '..x...x...x...x.', pc: 'g.g.g.g.g.g.g.g.' },
      null
    ],
    [
      'Warehouse Ride',
      1,
      { k: 'x...x...x...x...', c: '....x.......x...', rd: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
      null
    ],
    ['Broken Stomp', 1, { k: 'x...x..x..x.x...', c: '....x.......x...', h: 'xxoxxxoxxxoxxxox' }, null]
  ],
  garage: [
    [
      'Two-Step Skip',
      2,
      {
        k: 'x......x..x.....|x.........x..x..',
        s: R('....x.......x...', 2),
        h: R('..x.xx.x..x.xx.x', 2),
        oh: '......x.........|................'
      },
      null
    ],
    [
      'Speed Garage Bounce',
      1,
      { k: 'x...x...x...x...', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', oh: '..x...x...x...x.' },
      null
    ],
    ['Skippy Rim 2-Step', 1, { k: 'x.........x..x..', rim: '....x..g....x..g', h: 'x.x.xx.xx.x.xx.x' }, null],
    [
      'Bumpy Garage',
      2,
      { k: 'x.....x...x.....|x..x......x.....', s: R('....x.......x...', 2), h: R('x.xxx.x.x.xxx.x.', 2) },
      null
    ]
  ],
  dubstep: [
    ['Halfstep Heavy', 1, { k: 'x.........x.....', s: '........x.......', h: 'x.x.x.x.x.x.x.x.' }, null],
    ['Swung Halftime', 1, { k: 'x......x..x.....', s: '........x.......', h: 'x..xx..xx..xx..x' }, null],
    [
      'Skank Halftime',
      1,
      { k: 'x.....x.......x.', s: '........x......g', rim: '..g...g.....g...', h: 'x.x.x.x.x.x.x.xx' },
      null
    ],
    ['Riddim Rattle', 1, { k: 'x.........x.x...', s: '........x.......', h: 'xoxoxoxoxoxoxoxo' }, null]
  ],
  trance: [
    [
      'Offbeat Drive',
      1,
      { k: 'x...x...x...x...', c: '....x.......x...', oh: '..x...x...x...x.', h: 'x.xxx.xxx.xxx.xx' },
      null
    ],
    ['Psy Gallop', 1, { k: 'x...x...x...x...', h: 'xoxxxoxxxoxxxoxx', oh: '..x...x...x...x.' }, null],
    [
      'Uplift Ride',
      1,
      { k: 'x...x...x...x...', c: '....x.......x...', rd: 'x.x.x.x.x.x.x.x.', oh: '..x...x...x...x.' },
      null
    ],
    [
      'Prog Shuffle',
      1,
      { k: 'x...x...x...x...', c: '....x.......x...', h: '..x...x...x...x.', pc: 'o.oxo.oxo.oxo.ox' },
      null
    ]
  ],
  electro: [
    [
      'Electro Funk 808',
      2,
      { k: 'x.....x...x.....|x.....x.....x...', s: R('....x.......x...', 2), h: R('Xoxoxoxoxoxoxoxo', 2) },
      null
    ],
    [
      'Breakbeat Chop',
      2,
      { k: 'x.........x.x...|x.x.......x.....', s: '....x.......x...|....x..g....x...', h: R('x.x.x.x.x.x.x.x.', 2) },
      null
    ],
    ['Robot Clap', 1, { k: 'x..x..x...x.....', c: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' }, null],
    [
      'Nu Skool Break',
      2,
      {
        k: 'x.......x.x.....|..x.......x..x..',
        s: R('....x.......x...', 2),
        oh: '..............o.|................',
        h: R('x.x.x.x.x.x.x.x.', 2)
      },
      null
    ]
  ],
  funk: [
    ['Ghost Note Groove', 1, { k: 'x..x......x..x..', s: '....x..g.g..x..g', h: 'xoxoxoxoxoxoxoxo' }, null],
    [
      'Linear Funk',
      1,
      { k: 'x.....x...x.....', s: '..g.x..g.g..x..g', h: 'x.x.x.x.x.x.x.x.', oh: '..............o.' },
      null
    ],
    [
      'Disco Strut',
      1,
      { k: 'x...x...x...x...', s: '....x.......x...', oh: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' },
      ['disco', 'nudisco']
    ],
    ['Second Line Funk', 1, { k: 'x..x..x...x.....', s: '....x..g..g.x..g', h: 'x.xxx.xxx.xxx.xx' }, ['funk']]
  ],
  reggae: [
    [
      'One Drop Classic',
      1,
      { k: '........x.......', rim: '........x.......', h: 'x.x.x.x.x.x.x.x.' },
      ['reggae', 'dub']
    ],
    ['Steppers', 1, { k: 'x...x...x...x...', rim: '........x.......', h: 'x.xxx.xxx.xxx.xx' }, null],
    ['Rockers', 1, { k: 'x.......x.......', s: '........x.......', h: 'xxx.xxx.xxx.xxx.' }, null],
    ['Dub Ghost Drop', 1, { k: '........x.......', rim: '....g...x...g..g', h: 'o.x.o.x.o.x.o.x.' }, ['dub', 'reggae']]
  ],
  latin: [
    ['Dembow Classic', 1, { k: 'x...x...x...x...', s: '...x..x....x..x.', h: '..x...x...x...x.' }, ['reggaeton']],
    [
      'Afrobeats Bounce',
      1,
      { k: 'x......x..x.....', rim: '...x..x....x..x.', pc: 'o.xoo.xoo.xoo.xo', h: '..x...x...x...x.' },
      ['afrobeats']
    ],
    [
      'Amapiano Log',
      1,
      { k: 'x...x...x...x...', rim: '..x.....x.x.....', pc: 'xoxoxoxoxoxoxoxo', lt: '........x.....x.' },
      ['afrobeats']
    ],
    [
      'Clave Groove',
      2,
      {
        k: 'x.....x.x.......|x.....x.x.......',
        rim: 'x..x..x.........|..x...x.........',
        mt: R('..x...x...x...x.', 2)
      },
      null
    ]
  ],
  synth: [
    ['Linn Pop', 1, { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, null],
    [
      'Gated Snare',
      1,
      { k: 'x...x...x...x...', s: '....x.......x...', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' },
      null
    ],
    ['Night Drive', 1, { k: 'x.......x.......', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' }, null],
    [
      'Outrun Toms',
      1,
      {
        k: 'x.......x.x.....',
        s: '....x.......x...',
        h: 'x.x.x.x.x.x.x.x.',
        lt: '..............x.',
        mt: '.............x..'
      },
      null
    ]
  ],
  pop: [
    ['Pop Four', 1, { k: 'x...x...x...x...', c: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, null],
    ['Pop Bounce', 1, { k: 'x.....x.x.......', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx' }, null],
    ['Indie Drive', 1, { k: 'x.x.....x.x.....', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' }, null],
    ['Clap Stomp', 1, { k: 'x.......x.......', c: '....x.......x...', pc: '..x...x...x...x.' }, null]
  ],
  ambient: [
    ['Soft Pulse', 1, { k: 'x.......x.......', rim: '....g.......g...', h: 'o...o...o...o...' }, null],
    ['Brushed', 1, { k: 'x.........x.....', rim: '....x.......x...', h: 'o.o.o.o.o.o.o.o.' }, null],
    ['Heartbeat', 1, { k: 'x..x............', pc: '........o.......' }, null],
    ['Glitch Dust', 1, { k: 'x......x........', rim: '...g.....g..g...', h: 'g.g.ggg.g.g.g.gg' }, null]
  ],
  rock: [
    ['Straight Rock', 1, { k: 'x.......x.x.....', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.' }, ['rock']],
    ['Driving 16ths', 1, { k: 'x.....x.x.......', s: '....x.......x...', h: 'xoxoxoxoxoxoxoxo' }, ['rock']],
    ['Half-Time Rock', 1, { k: 'x.........x.....', s: '........x.......', rd: 'x.x.x.x.x.x.x.x.' }, ['rock']],
    ['Punk Beat', 1, { k: 'x.x.x.x.x.x.x.x.', s: '..x...x...x...x.', h: 'x.x.x.x.x.x.x.x.' }, ['punk']]
  ]
};
