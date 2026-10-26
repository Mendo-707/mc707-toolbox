// The settings of the MC-707's total effects for the mixers' Master FX panels: the parameters each
// reverb type and each chorus/delay type puts in its parameter slots (in the MC-707 Reference Manual's
// order, the way MFX types fill theirs), and the master EQ and compressor (Roland's MV-1 map, which the
// MC-707's project shares).
//
// Parameters are written as zc-mfx-data.js writes MFX ones: [name, kind, ...] with kinds 'S' off/on,
// 'L' [names] (unit), 'N' a note value, 'R' lo, hi, unit, 'D' lo, hi, decimals, unit.
//
// Reads: MFX_TYPES (for the HF Damp list the effects share).
import { MFX_TYPES } from './zc-mfx-data.js';

/* the HF Damp list (200 Hz to 8 kHz, then BYPASS), as the MFX delays have it */
const HFD = (() => {
  for (const [, ps] of MFX_TYPES) for (const p of ps) if (p[0] === 'HF Damp' && p[1] === 'L') return p[2];
  return ['BYPASS'];
})();
const DELAY = (ms = 1300) => [
  ['Delay (sync)', 'S'],
  ['Delay', 'R', 1, ms, 'msec'],
  ['Delay (note)', 'N']
];
const DAMP = ['HF Damp', 'L', HFD, 'Hz'];

/** [type name, parameters] for reverb types 0-7 (0 is off). */
export const REV_PARAMS = [
  ['Off', []],
  [
    'Integra',
    [
      ['Type', 'L', ['ROOM1', 'ROOM2', 'HALL1', 'HALL2', 'PLATE']],
      ['Pre Delay', 'R', 0, 100, 'msec'],
      ['Time', 'D', 0.1, 10.0, 1, 'sec'],
      ['Density', 'R', 0, 127],
      ['Diffusion', 'R', 0, 127],
      ['LF Damp', 'R', 0, 100],
      ['HF Damp', 'R', 0, 100],
      ['Spread', 'R', 0, 127],
      ['Tone', 'R', 0, 127]
    ]
  ],
  [
    'Warm Hall',
    [
      ['Pre Delay', 'R', 0, 100, 'msec'],
      ['Time', 'D', 0.3, 30.0, 1, 'sec']
    ]
  ],
  [
    'Hall',
    [
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Time', 'R', 0, 127],
      ['Size', 'R', 1, 8]
    ]
  ],
  [
    'GS',
    [
      ['Character', 'L', ['ROOM1', 'ROOM2', 'ROOM3', 'HALL1', 'HALL2', 'PLATE', 'DELAY', 'PAN-DELAY']],
      ['Pre-LPF', 'R', 0, 7],
      ['Time', 'R', 0, 127],
      ['Delay Feedback', 'R', 0, 127]
    ]
  ],
  ['SRV2000', []],
  [
    'SRV2000 Non-linear',
    [
      ['Pre Delay', 'R', 0, 160],
      ['Reverb Time', 'R', 1, 990, 'msec'],
      ['Gate Time', 'R', 10, 450, 'msec']
    ]
  ],
  [
    'GM2 Reverb',
    [
      ['Character', 'R', 0, 5],
      ['Time', 'R', 0, 127]
    ]
  ]
];

/** [type name, parameters] for chorus/delay types 0-9 (0 is off). */
export const CHO_PARAMS = [
  ['Off', []],
  [
    'Chorus',
    [
      ['Rate', 'R', 0, 127],
      ['Depth', 'R', 0, 127],
      ['Feedback', 'R', 0, 127]
    ]
  ],
  ['CE-1', [['Intensity', 'R', 0, 127]]],
  ['SDD-320', [['Mode', 'L', ['1', '2', '3', '4', '1+4', '2+4', '3+4']]]],
  [
    'JUNO-106 Chorus',
    [
      ['Mode', 'L', ['I', 'II', 'I+II', 'JX I', 'JX II']],
      ['Noise Level', 'R', 0, 127]
    ]
  ],
  ['Delay', [...DELAY(), ['Feedback', 'R', -98, 98, '%'], DAMP]],
  ['T-Ctrl Delay', [...DELAY(), ['Acceleration', 'R', 0, 15], ['Feedback', 'R', -98, 98, '%'], DAMP]],
  [
    'Delay + Tremolo',
    [
      ['Input Mode', 'L', ['MONAURAL', 'STEREO']],
      ...DELAY(),
      ['Feedback', 'R', -98, 98, '%'],
      DAMP,
      ['Tremolo', 'S'],
      ['Tremolo Wave', 'L', ['TRI', 'SQR', 'SIN', 'SAW1', 'SAW2', 'TRP']],
      ['Tremolo Rate (sync)', 'S'],
      ['Tremolo Rate', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tremolo Rate (note)', 'N'],
      ['Tremolo Depth', 'R', 0, 127]
    ]
  ],
  [
    '2Tap Pan Delay',
    [
      ...DELAY(),
      ['Feedback', 'R', -98, 98, '%'],
      DAMP,
      ['Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['Delay 1 Level', 'R', 0, 127],
      ['Delay 2 Level', 'R', 0, 127]
    ]
  ],
  [
    '3Tap Pan Delay',
    [
      ...DELAY(2600),
      ['Feedback', 'R', -98, 98, '%'],
      DAMP,
      ['Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['Delay 3 Pan', 'R', -64, 63, 'pan'],
      ['Delay 1 Level', 'R', 0, 127],
      ['Delay 2 Level', 'R', 0, 127],
      ['Delay 3 Level', 'R', 0, 127]
    ]
  ]
];

const FREQS =
  '20 25 31 40 50 63 80 100 125 160 200 250 315 400 500 630 800 1000 1250 1600 2000 2500 3150 4000 5000 6300 8000 10000 12600 16000'.split(
    ' '
  );
const QS = ['0.5', '1.0', '2.0', '4.0', '8.0', '16.0'];
const SPLIT =
  '16 20 25 31 40 50 63 80 100 125 160 200 250 315 400 500 630 800 1000 1250 1600 2000 2500 3150 4000 5000 6300 8000 10000 12500 16000'.split(
    ' '
  );
const RATIOS = ['1:1', '2:1', '3:1', '4:1', '8:1', '16:1', '32:1', 'INF:1'];
const ATTACK = ['0.1', ...Array.from({ length: 100 }, (_, i) => String(i + 1))];
const SYNC = ['OFF', '1/16', '1/8T', '1/16.', '1/8', '1/4T', '1/8.', '1/4'];

/**
 * The master EQ and compressor: one byte each, [name, offset, kind, ...]. Kinds: 'L' [names] (unit),
 * 'S' off/on, 'G' a gain from lo to hi dB kept as 64 + value, 'H' a gain in half dB kept as 64 + value,
 * 'M' a release time (0-99 for 10-1000 ms).
 */
export const MASTER_EQ = [
  ['EQ', 14, 'S'],
  ['Input', 0, 'G', -24, 24],
  ['Low', 1, 'G', -24, 24],
  ['Low freq', 6, 'L', FREQS, 'Hz'],
  ['Mid 1', 2, 'G', -24, 24],
  ['Mid 1 freq', 7, 'L', FREQS, 'Hz'],
  ['Mid 1 Q', 11, 'L', QS],
  ['Mid 2', 3, 'G', -24, 24],
  ['Mid 2 freq', 8, 'L', FREQS, 'Hz'],
  ['Mid 2 Q', 12, 'L', QS],
  ['Mid 3', 4, 'G', -24, 24],
  ['Mid 3 freq', 9, 'L', FREQS, 'Hz'],
  ['Mid 3 Q', 13, 'L', QS],
  ['High', 5, 'G', -24, 24],
  ['High freq', 10, 'L', FREQS, 'Hz']
];
const band = (name, at) => [
  [name + ' threshold', at + 2, 'G', -60, 0],
  [name + ' ratio', at + 3, 'L', RATIOS],
  [name + ' attack', at, 'L', ATTACK, 'ms'],
  [name + ' release', at + 1, 'M'],
  [name + ' knee', at + 4, 'R', 0, 30, 'dB'],
  [name + ' gain', at + 5, 'H', -48, 48]
];
export const MASTER_COMP = [
  ['Compressor', 0, 'S'],
  ['Low/mid split', 19, 'L', SPLIT, 'Hz'],
  ['Mid/high split', 20, 'L', SPLIT, 'Hz'],
  ...band('Low', 1),
  ['Low release sync', 21, 'L', SYNC],
  ...band('Mid', 7),
  ['Mid release sync', 22, 'L', SYNC],
  ...band('High', 13),
  ['High release sync', 23, 'L', SYNC]
];
