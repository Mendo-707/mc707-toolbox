// The 91 MFX types of the MC-707 (firmware 1.80+) and each type's parameters, in the order they fill
// the 32 MFX parameter slots. Taken from the MC-707 Reference Manual's MFX Parameters chapter.
//
// Each parameter: [name, kind, ...]. Kinds: 'S' off/on; 'L' [names] (unit); 'N' a note value;
// 'R' lo, hi, unit (integer); 'D' lo, hi, decimals, unit. Unit 'pan' shows L64-63R and 'bal' D:W.

/** [type name, parameters] for MFX types 0-90. */
export const MFX_TYPES = [
  ['Thru', []],
  [
    'Equalizer',
    [
      [
        'Low Freq',
        'L',
        ['20', '25', '31', '40', '50', '63', '80', '100', '125', '160', '200', '250', '315', '400'],
        'Hz'
      ],
      ['Low Gain', 'R', -15, 15, 'dB'],
      [
        'Mid1 Freq',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['Mid1 Gain', 'R', -15, 15, 'dB'],
      ['Mid1 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      [
        'Mid2 Freq',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['Mid2 Gain', 'R', -15, 15, 'dB'],
      ['Mid2 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      ['High Freq', 'L', ['2000', '2500', '3150', '4000', '5000', '6300', '8000', '10000', '12500', '16000'], 'Hz'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Spectrum',
    [
      ['Band1 (250 Hz)', 'R', -15, 15, 'dB'],
      ['Band2 (500 Hz)', 'R', -15, 15, 'dB'],
      ['Band3 (1000 Hz)', 'R', -15, 15, 'dB'],
      ['Band4 (1250 Hz)', 'R', -15, 15, 'dB'],
      ['Band5 (2000 Hz)', 'R', -15, 15, 'dB'],
      ['Band6 (3150 Hz)', 'R', -15, 15, 'dB'],
      ['Band7 (4000 Hz)', 'R', -15, 15, 'dB'],
      ['Band8 (8000 Hz)', 'R', -15, 15, 'dB'],
      ['Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Isolator',
    [
      ['Boost/Cut Low', 'R', -60, 4, 'dB'],
      ['Boost/Cut Mid', 'R', -60, 4, 'dB'],
      ['Boost/Cut High', 'R', -60, 4, 'dB'],
      ['Anti Phase Low Sw', 'S'],
      ['Anti Phase Low Level', 'R', 0, 127, ''],
      ['Anti Phase Mid Sw', 'S'],
      ['Anti Phase Mid Level', 'R', 0, 127, ''],
      ['Low Boost Sw', 'S'],
      ['Low Boost Level', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Low Boost',
    [
      ['Boost Frequency', 'L', ['50', '56', '63', '71', '80', '90', '100', '112', '125'], 'Hz'],
      ['Boost Gain', 'R', 0, 12, 'dB'],
      ['Boost Width', 'L', ['WIDE', 'MID', 'NARROW']],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Super Filter',
    [
      ['Filter Type', 'L', ['LPF', 'BPF', 'HPF', 'NOTCH']],
      ['Filter Slope', 'L', ['-12', '-24', '-36'], 'dB'],
      ['Filter Cutoff', 'R', 0, 127, ''],
      ['Filter Resonance', 'R', 0, 100, ''],
      ['Filter Gain', 'R', 0, 12, 'dB'],
      ['Modulation Sw', 'S'],
      ['Modulation Wave', 'L', ['TRI', 'SQR', 'SIN', 'SAW1', 'SAW2']],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Attack', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Step Filter',
    [
      ['Step 1', 'R', 0, 127, ''],
      ['Step 2', 'R', 0, 127, ''],
      ['Step 3', 'R', 0, 127, ''],
      ['Step 4', 'R', 0, 127, ''],
      ['Step 5', 'R', 0, 127, ''],
      ['Step 6', 'R', 0, 127, ''],
      ['Step 7', 'R', 0, 127, ''],
      ['Step 8', 'R', 0, 127, ''],
      ['Step 9', 'R', 0, 127, ''],
      ['Step 10', 'R', 0, 127, ''],
      ['Step 11', 'R', 0, 127, ''],
      ['Step 12', 'R', 0, 127, ''],
      ['Step 13', 'R', 0, 127, ''],
      ['Step 14', 'R', 0, 127, ''],
      ['Step 15', 'R', 0, 127, ''],
      ['Step 16', 'R', 0, 127, ''],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Attack', 'R', 0, 127, ''],
      ['Filter Type', 'L', ['LPF', 'BPF', 'HPF', 'NOTCH']],
      ['Filter Slope', 'L', ['-12', '-24', '-36'], 'dB'],
      ['Filter Resonance', 'R', 0, 127, ''],
      ['Filter Gain', 'R', 0, 12, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Enhancer',
    [
      ['Sens', 'R', 0, 127, ''],
      ['Mix', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Auto Wah',
    [
      ['Filter Type', 'L', ['LPF', 'BPF']],
      ['Manual', 'R', 0, 127, ''],
      ['Peak', 'R', 0, 127, ''],
      ['Sens', 'R', 0, 127, ''],
      ['Polarity', 'L', ['UP', 'DOWN']],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Phase', 'R', 0, 180, 'deg'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Humanizer',
    [
      ['Drive Sw', 'S'],
      ['Drive', 'R', 0, 127, ''],
      ['Vowel1', 'L', ['a', 'e', 'i', 'o', 'u']],
      ['Vowel2', 'L', ['a', 'e', 'i', 'o', 'u']],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Input Sync Sw', 'S'],
      ['Input Sync Threshold', 'R', 0, 127, ''],
      ['Manual', 'R', 0, 100, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Pan', 'R', -64, 63, 'pan'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Speaker Simulator',
    [
      [
        'Speaker Type',
        'L',
        [
          'SMALL 1',
          'SMALL 2',
          'MIDDLE',
          'JC-120',
          'BUILT-IN 1',
          'BUILT-IN 2',
          'BUILT-IN 3',
          'BUILT-IN 4',
          'BUILT-IN 5',
          'BG STACK 1',
          'BG STACK 2',
          'MS STACK 1',
          'MS STACK 2',
          'METAL STACK',
          '2-STACK',
          '3-STACK'
        ]
      ],
      ['Mic Setting', 'L', ['1', '2', '3']],
      ['Mic Level', 'R', 0, 127, ''],
      ['Direct Level', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Phaser 1',
    [
      ['Mode', 'L', ['4-STAGE', '8-STAGE', '12-STAGE']],
      ['Manual', 'R', 0, 127, ''],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Polarity', 'L', ['INVERSE', 'SYNCHRO']],
      ['Resonance', 'R', 0, 127, ''],
      ['Cross Feedback', 'R', -98, 98, '%'],
      ['Mix', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Phaser 2',
    [
      ['Rate', 'R', 0, 100, ''],
      ['Color', 'L', ['1', '2']],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Phaser 3',
    [
      ['Speed', 'R', 0, 100, ''],
      ['Depth', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Step Phaser',
    [
      ['Mode', 'L', ['4-STAGE', '8-STAGE', '12-STAGE']],
      ['Manual', 'R', 0, 127, ''],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Polarity', 'L', ['INVERSE', 'SYNCHRO']],
      ['Resonance', 'R', 0, 127, ''],
      ['Cross Feedback', 'R', -98, 98, '%'],
      ['Step Rate (sync sw)', 'S'],
      ['Step Rate (Hz)', 'D', 0.1, 20.0, 2, 'Hz'],
      ['Step Rate (note)', 'N'],
      ['Mix', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Multi Stage Phaser',
    [
      ['Mode', 'L', ['4-STAGE', '8-STAGE', '12-STAGE', '16-STAGE', '20-STAGE', '24-STAGE']],
      ['Manual', 'R', 0, 127, ''],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Resonance', 'R', 0, 127, ''],
      ['Pan', 'R', -64, 63, 'pan'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Infinite Phaser',
    [
      ['Mode', 'L', ['1', '2', '3', '4']],
      ['Speed', 'R', -100, 100, ''],
      ['Resonance', 'R', 0, 127, ''],
      ['Mix', 'R', 0, 127, ''],
      ['Pan', 'R', -64, 63, 'pan'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Ring Modulator',
    [
      ['Frequency', 'R', 0, 127, ''],
      ['Sens', 'R', 0, 127, ''],
      ['Polarity', 'L', ['UP', 'DOWN']],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Tremolo',
    [
      ['Mod Wave', 'L', ['TRI', 'SQR', 'SIN', 'SAW1', 'SAW2', 'TRP']],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Auto Pan',
    [
      ['Mod Wave', 'L', ['TRI', 'SQR', 'SIN', 'SAW1', 'SAW2', 'TRP']],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Slicer',
    [
      ['Step 1', 'R', 0, 127, ''],
      ['Step 2', 'R', 0, 127, ''],
      ['Step 3', 'R', 0, 127, ''],
      ['Step 4', 'R', 0, 127, ''],
      ['Step 5', 'R', 0, 127, ''],
      ['Step 6', 'R', 0, 127, ''],
      ['Step 7', 'R', 0, 127, ''],
      ['Step 8', 'R', 0, 127, ''],
      ['Step 9', 'R', 0, 127, ''],
      ['Step 10', 'R', 0, 127, ''],
      ['Step 11', 'R', 0, 127, ''],
      ['Step 12', 'R', 0, 127, ''],
      ['Step 13', 'R', 0, 127, ''],
      ['Step 14', 'R', 0, 127, ''],
      ['Step 15', 'R', 0, 127, ''],
      ['Step 16', 'R', 0, 127, ''],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Attack', 'R', 0, 127, ''],
      ['Input Sync Sw', 'S'],
      ['Input Sync Threshold', 'R', 0, 127, ''],
      ['Mode', 'L', ['LEGATO', 'SLASH']],
      ['Shuffle', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Rotary',
    [
      ['Speed', 'L', ['SLOW', 'FAST']],
      ['Woofer Slow Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Woofer Fast Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Woofer Acceleration', 'R', 0, 15, ''],
      ['Woofer Level', 'R', 0, 127, ''],
      ['Tweeter Slow Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tweeter Fast Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tweeter Acceleration', 'R', 0, 15, ''],
      ['Tweeter Level', 'R', 0, 127, ''],
      ['Separation', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'VK Rotary',
    [
      ['Speed', 'L', ['SLOW', 'FAST']],
      ['Brake', 'S'],
      ['Woofer Slow Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Woofer Fast Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Woofer Trans Up', 'R', 0, 127, ''],
      ['Woofer Trans Down', 'R', 0, 127, ''],
      ['Woofer Level', 'R', 0, 127, ''],
      ['Tweeter Slow Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tweeter Fast Speed', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tweeter Trans Up', 'R', 0, 127, ''],
      ['Tweeter Trans Down', 'R', 0, 127, ''],
      ['Tweeter Level', 'R', 0, 127, ''],
      ['Spread', 'R', 0, 10, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, ''],
      ['OD Switch', 'S'],
      ['OD Gain', 'R', 0, 127, ''],
      ['OD Drive', 'R', 0, 127, ''],
      ['OD Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Chorus',
    [
      ['Filter Type', 'L', ['OFF', 'LPF', 'HPF']],
      [
        'Cutoff Freq',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Phase', 'R', 0, 180, 'deg'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Flanger',
    [
      ['Filter Type', 'L', ['OFF', 'LPF', 'HPF']],
      [
        'Cutoff Freq',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Phase', 'R', 0, 180, 'deg'],
      ['Feedback', 'R', -98, 98, '%'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Step Flanger',
    [
      ['Filter Type', 'L', ['OFF', 'LPF', 'HPF']],
      [
        'Cutoff Freq',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Phase', 'R', 0, 180, 'deg'],
      ['Feedback', 'R', -98, 98, '%'],
      ['Step Rate (sync sw)', 'S'],
      ['Step Rate (Hz)', 'D', 0.1, 20.0, 2, 'Hz'],
      ['Step Rate (note)', 'N'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Hexa-Chorus',
    [
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Pre Delay Deviation', 'R', 0, 20, ''],
      ['Depth Deviation', 'R', -20, 20, ''],
      ['Pan Deviation', 'R', 0, 20, ''],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Tremolo Chorus',
    [
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Tremolo Rate (sync sw)', 'S'],
      ['Tremolo Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tremolo Rate (note)', 'N'],
      ['Tremolo Separation', 'R', 0, 127, ''],
      ['Tremolo Phase', 'R', 0, 180, 'deg'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Space-D',
    [
      ['Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Phase', 'R', 0, 180, 'deg'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Overdrive',
    [
      ['Drive', 'R', 0, 127, ''],
      ['Tone', 'R', 0, 127, ''],
      ['Amp Sw', 'S'],
      ['Amp Type', 'L', ['SMALL', 'BUILT-IN', '2-STACK', '3-STACK']],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Pan', 'R', -64, 63, 'pan'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Distortion',
    [
      ['Drive', 'R', 0, 127, ''],
      ['Tone', 'R', 0, 127, ''],
      ['Amp Sw', 'S'],
      ['Amp Type', 'L', ['SMALL', 'BUILT-IN', '2-STACK', '3-STACK']],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Pan', 'R', -64, 63, 'pan'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'T-Scream',
    [
      ['Distortion', 'R', 0, 127, ''],
      ['Tone', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Guitar Amp Simulator',
    [
      ['Pre Amp Sw', 'S'],
      [
        'Pre Amp Type',
        'L',
        [
          'JC-120',
          'CLEAN TWIN',
          'MATCH DRIVE',
          'BG LEAD',
          'MS1959I',
          'MS1959II',
          'MS1959I+II',
          'SLDN LEAD',
          'METAL 5150',
          'METAL LEAD',
          'OD-1',
          'OD-2 TURBO',
          'DISTORTION',
          'FUZZ'
        ]
      ],
      ['Pre Amp Volume', 'R', 0, 127, ''],
      ['Pre Amp Master', 'R', 0, 127, ''],
      ['Pre Amp Gain', 'L', ['LOW', 'MIDDLE', 'HIGH']],
      ['Pre Amp Bass', 'R', 0, 127, ''],
      ['Pre Amp Middle', 'R', 0, 127, ''],
      ['Pre Amp Treble', 'R', 0, 127, ''],
      ['Pre Amp Presence', 'R', 0, 127, ''],
      ['Pre Amp Bright', 'S'],
      ['Speaker Sw', 'S'],
      [
        'Speaker Type',
        'L',
        [
          'SMALL 1',
          'SMALL 2',
          'MIDDLE',
          'JC-120',
          'BUILT-IN 1',
          'BUILT-IN 2',
          'BUILT-IN 3',
          'BUILT-IN 4',
          'BUILT-IN 5',
          'BG STACK 1',
          'BG STACK 2',
          'MS STACK 1',
          'MS STACK 2',
          'METAL STACK',
          '2-STACK',
          '3-STACK'
        ]
      ],
      ['Mic Setting', 'L', ['1', '2', '3']],
      ['Mic Level', 'R', 0, 127, ''],
      ['Direct Level', 'R', 0, 127, ''],
      ['Pan', 'R', -64, 63, 'pan'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Compressor',
    [
      ['Attack', 'R', 0, 124, ''],
      ['Release', 'R', 0, 124, ''],
      ['Threshold', 'R', -60, 0, 'dB'],
      ['Knee', 'R', 0, 30, 'dB'],
      ['Ratio', 'L', ['1:1', '1.5:1', '2:1', '4:1', '16:1', 'INF:1']],
      ['Post Gain', 'R', 0, 18, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Limiter',
    [
      ['Release', 'R', 0, 127, ''],
      ['Threshold', 'R', 0, 127, ''],
      ['Ratio', 'L', ['1.5:1', '2:1', '4:1', '100:1']],
      ['Post Gain', 'R', 0, 18, 'dB'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Sustainer',
    [
      ['Sustain', 'R', 0, 127, ''],
      ['Attack', 'R', 0, 127, ''],
      ['Release', 'R', 0, 127, ''],
      ['Post Gain', 'R', -15, 15, 'dB'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Gate',
    [
      ['Threshold', 'R', 0, 127, ''],
      ['Mode', 'L', ['GATE', 'DUCK']],
      ['Attack', 'R', 0, 127, ''],
      ['Hold', 'R', 0, 127, ''],
      ['Release', 'R', 0, 127, ''],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Delay',
    [
      ['Delay Left (sync sw)', 'S'],
      ['Delay Left (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Left (note)', 'N'],
      ['Delay Right (sync sw)', 'S'],
      ['Delay Right (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Right (note)', 'N'],
      ['Phase Left', 'L', ['NORMAL', 'INVERSE']],
      ['Phase Right', 'L', ['NORMAL', 'INVERSE']],
      ['Feedback Mode', 'L', ['NORMAL', 'CROSS']],
      ['Feedback', 'R', -98, 98, '%'],
      [
        'HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Modulation Delay',
    [
      ['Delay Left (sync sw)', 'S'],
      ['Delay Left (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Left (note)', 'N'],
      ['Delay Right (sync sw)', 'S'],
      ['Delay Right (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Right (note)', 'N'],
      ['Feedback Mode', 'L', ['NORMAL', 'CROSS']],
      ['Feedback', 'R', -98, 98, '%'],
      [
        'HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Phase', 'R', 0, 180, 'deg'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    '3Tap Pan Delay',
    [
      ['Delay Left (sync switch)', 'S'],
      ['Delay Left (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Left (note)', 'N'],
      ['Delay Right (sync switch)', 'S'],
      ['Delay Right (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Right (note)', 'N'],
      ['Delay Center (sync sw)', 'S'],
      ['Delay Center (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Center (note)', 'N'],
      ['Center Feedback', 'R', -98, 98, '%'],
      [
        'HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Left Level', 'R', 0, 127, ''],
      ['Right Level', 'R', 0, 127, ''],
      ['Center Level', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    '4Tap Pan Delay',
    [
      ['Delay 1 Time (sync sw)', 'S'],
      ['Delay 1 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 1 Time (note)', 'N'],
      ['Delay 2 Time (sync sw)', 'S'],
      ['Delay 2 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 2 Time (note)', 'N'],
      ['Delay 3 Time (sync sw)', 'S'],
      ['Delay 3 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 3 Time (note)', 'N'],
      ['Delay 4 Time (sync sw)', 'S'],
      ['Delay 4 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 4 Time (note)', 'N'],
      ['Delay 1 Feedback', 'R', -98, 98, '%'],
      [
        'HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay 1 Level', 'R', 0, 127, ''],
      ['Delay 2 Level', 'R', 0, 127, ''],
      ['Delay 3 Level', 'R', 0, 127, ''],
      ['Delay 4 Level', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Multi Tap Delay',
    [
      ['Delay 1 Time (sync sw)', 'S'],
      ['Delay 1 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 1 Time (note)', 'N'],
      ['Delay 2 Time (sync sw)', 'S'],
      ['Delay 2 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 2 Time (note)', 'N'],
      ['Delay 3 Time (sync sw)', 'S'],
      ['Delay 3 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 3 Time (note)', 'N'],
      ['Delay 4 Time (sync sw)', 'S'],
      ['Delay 4 Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay 4 Time (note)', 'N'],
      ['Delay 1 Feedback', 'R', -98, 98, '%'],
      [
        'HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['Delay 3 Pan', 'R', -64, 63, 'pan'],
      ['Delay 4 Pan', 'R', -64, 63, 'pan'],
      ['Delay 1 Level', 'R', 0, 127, ''],
      ['Delay 2 Level', 'R', 0, 127, ''],
      ['Delay 3 Level', 'R', 0, 127, ''],
      ['Delay 4 Level', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Reverse Delay',
    [
      ['Threshold', 'R', 0, 127, ''],
      ['Rev Delay Time (sync sw)', 'S'],
      ['Rev Delay Time (msec)', 'R', 1, 1300, 'msec'],
      ['Rev Delay Time (note)', 'N'],
      ['Rev Delay Feedback', 'R', -98, 98, '%'],
      [
        'Rev Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Rev Delay Pan', 'R', -64, 63, 'pan'],
      ['Rev Delay Level', 'R', 0, 127, ''],
      ['Delay 1 Time (sync sw)', 'S'],
      ['Delay 1 Time (msec)', 'R', 1, 1300, 'msec'],
      ['Delay 1 Time (note)', 'N'],
      ['Delay 2 Time (sync sw)', 'S'],
      ['Delay 2 Time (msec)', 'R', 1, 1300, 'msec'],
      ['Delay 2 Time (note)', 'N'],
      ['Delay 3 Time (sync sw)', 'S'],
      ['Delay 3 Time (msec)', 'R', 1, 1300, 'msec'],
      ['Delay 3 Time (note)', 'N'],
      ['Delay 3 Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['Delay 1 Level', 'R', 0, 127, ''],
      ['Delay 2 Level', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Time Ctrl Delay',
    [
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Acceleration', 'R', 0, 15, ''],
      ['Feedback', 'R', -98, 98, '%'],
      [
        'HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Tape Echo',
    [
      ['Mode', 'L', ['S', 'M', 'L', 'S+M', 'S+L', 'M+L', 'S+M+L']],
      ['Repeat Rate', 'R', 0, 127, ''],
      ['Intensity', 'R', 0, 127, ''],
      ['Bass', 'R', -15, 15, 'dB'],
      ['Treble', 'R', -15, 15, 'dB'],
      ['Head S Pan', 'R', -64, 63, 'pan'],
      ['Head M Pan', 'R', -64, 63, 'pan'],
      ['Head L Pan', 'R', -64, 63, 'pan'],
      ['Tape Distortion', 'R', 0, 5, ''],
      ['W/F Rate', 'R', 0, 127, ''],
      ['W/F Depth', 'R', 0, 127, ''],
      ['Echo Level', 'R', 0, 127, ''],
      ['Direct Level', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'LOFI Compress',
    [
      ['Pre Filter Type', 'L', ['1', '2', '3', '4', '5', '6']],
      ['LoFi Type', 'L', ['1', '2', '3', '4', '5', '6', '7', '8', '9']],
      ['Post Filter Type', 'L', ['OFF', 'LPF', 'HPF']],
      [
        'Post Filter Cutoff',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Bit Crusher',
    [
      ['Sample Rate', 'R', 0, 127, ''],
      ['Bit Down', 'R', 0, 20, ''],
      ['Filter', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Pitch Shifter',
    [
      ['Coarse', 'R', -24, 12, 'semi'],
      ['Fine', 'R', -100, 100, 'cent'],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Feedback', 'R', -98, 98, '%'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    '2Voice Pitch Shifter',
    [
      ['Pitch1 Coarse', 'R', -24, 12, 'semi'],
      ['Pitch1 Fine', 'R', -100, 100, 'cent'],
      ['Pitch1 Delay (sync sw)', 'S'],
      ['Pitch1 Delay (msec)', 'R', 1, 1300, 'msec'],
      ['Pitch1 Delay (note)', 'N'],
      ['Pitch1 Feedback', 'R', -98, 98, '%'],
      ['Pitch1 Pan', 'R', -64, 63, 'pan'],
      ['Pitch1 Level', 'R', 0, 127, ''],
      ['Pitch2 Coarse', 'R', -24, 12, 'semi'],
      ['Pitch2 Fine', 'R', -100, 100, 'cent'],
      ['Pitch2 Delay (sync sw)', 'S'],
      ['Pitch2 Delay (msec)', 'R', 1, 1300, 'msec'],
      ['Pitch2 Delay (note)', 'N'],
      ['Pitch2 Feedback', 'R', -98, 98, '%'],
      ['Pitch2 Pan', 'R', -64, 63, 'pan'],
      ['Pitch2 Level', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Overdrive → Chorus',
    [
      ['Overdrive Drive', 'R', 0, 127, ''],
      ['Overdrive Pan', 'R', -64, 63, 'pan'],
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Overdrive → Flanger',
    [
      ['Overdrive Drive', 'R', 0, 127, ''],
      ['Overdrive Pan', 'R', -64, 63, 'pan'],
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (sync sw)', 'S'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Rate (note)', 'N'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Overdrive → Delay',
    [
      ['Overdrive Drive', 'R', 0, 127, ''],
      ['Overdrive Pan', 'R', -64, 63, 'pan'],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Distortion → Chorus',
    [
      ['Distortion Drive', 'R', 0, 127, ''],
      ['Distortion Pan', 'R', -64, 63, 'pan'],
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Distortion → Flanger',
    [
      ['Distortion Drive', 'R', 0, 127, ''],
      ['Distortion Pan', 'R', -64, 63, 'pan'],
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (sync sw)', 'S'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Rate (note)', 'N'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Distortion → Delay',
    [
      ['Distortion Drive', 'R', 0, 127, ''],
      ['Distortion Pan', 'R', -64, 63, 'pan'],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'OD/DS → TouchWah',
    [
      ['Drive Switch', 'S'],
      ['Drive Type', 'L', ['OVERDRIVE', 'DISTORTION']],
      ['Drive', 'R', 0, 127, ''],
      ['Tone', 'R', 0, 127, ''],
      ['Amp Switch', 'S'],
      ['Amp Type', 'L', ['SMALL', 'BUILT-IN', '2-STACK', '3-STACK']],
      ['TWah Switch', 'S'],
      ['TWah Mode', 'L', ['LPF', 'BPF']],
      ['TWah Polarity', 'L', ['DOWN', 'UP']],
      ['TWah Sens', 'R', 0, 127, ''],
      ['TWah Manual', 'R', 0, 127, ''],
      ['TWah Peak', 'R', 0, 127, ''],
      ['TWah Balance', 'R', 0, 100, 'bal'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'OD/DS → AutoWah',
    [
      ['Drive Switch', 'S'],
      ['Drive Type', 'L', ['OVERDRIVE', 'DISTORTION']],
      ['Drive', 'R', 0, 127, ''],
      ['Tone', 'R', 0, 127, ''],
      ['Amp Switch', 'S'],
      ['Amp Type', 'L', ['SMALL', 'BUILT-IN', '2-STACK', '3-STACK']],
      ['AutoWah Switch', 'S'],
      ['AutoWah Mode', 'L', ['LPF', 'BPF']],
      ['AutoWah Manual', 'R', 0, 127, ''],
      ['AutoWah Peak', 'R', 0, 127, ''],
      ['AutoWah Rate (sync sw)', 'S'],
      ['AutoWah Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['AutoWah Rate (note)', 'N'],
      ['AutoWah Depth', 'R', 0, 127, ''],
      ['AutoWah Balance', 'R', 0, 100, 'bal'],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'GtAmpSim → Chorus',
    [
      ['Pre Amp Sw', 'S'],
      [
        'Pre Amp Type',
        'L',
        [
          'JC-120',
          'CLEAN TWIN',
          'MATCH DRIVE',
          'BG LEAD',
          'MS1959I',
          'MS1959II',
          'MS1959I+II',
          'SLDN LEAD',
          'METAL 5150',
          'METAL LEAD',
          'OD-1',
          'OD-2 TURBO',
          'DISTORTION',
          'FUZZ'
        ]
      ],
      ['Pre Amp Volume', 'R', 0, 127, ''],
      ['Pre Amp Master', 'R', 0, 127, ''],
      ['Pre Amp Gain', 'L', ['LOW', 'MIDDLE', 'HIGH']],
      ['Pre Amp Bass', 'R', 0, 127, ''],
      ['Pre Amp Middle', 'R', 0, 127, ''],
      ['Pre Amp Treble', 'R', 0, 127, ''],
      ['Speaker Sw', 'S'],
      [
        'Speaker Type',
        'L',
        [
          'SMALL 1',
          'SMALL 2',
          'MIDDLE',
          'JC-120',
          'BUILT-IN 1',
          'BUILT-IN 2',
          'BUILT-IN 3',
          'BUILT-IN 4',
          'BUILT-IN 5',
          'BG STACK 1',
          'BG STACK 2',
          'MS STACK 1',
          'MS STACK 2',
          'METAL STACK',
          '2-STACK',
          '3-STACK'
        ]
      ],
      ['Chorus Switch', 'S'],
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'GtAmpSim → Flanger',
    [
      ['Pre Amp Sw', 'S'],
      [
        'Pre Amp Type',
        'L',
        [
          'JC-120',
          'CLEAN TWIN',
          'MATCH DRIVE',
          'BG LEAD',
          'MS1959I',
          'MS1959II',
          'MS1959I+II',
          'SLDN LEAD',
          'METAL 5150',
          'METAL LEAD',
          'OD-1',
          'OD-2 TURBO',
          'DISTORTION',
          'FUZZ'
        ]
      ],
      ['Pre Amp Volume', 'R', 0, 127, ''],
      ['Pre Amp Master', 'R', 0, 127, ''],
      ['Pre Amp Gain', 'L', ['LOW', 'MIDDLE', 'HIGH']],
      ['Pre Amp Bass', 'R', 0, 127, ''],
      ['Pre Amp Middle', 'R', 0, 127, ''],
      ['Pre Amp Treble', 'R', 0, 127, ''],
      ['Speaker Sw', 'S'],
      [
        'Speaker Type',
        'L',
        [
          'SMALL 1',
          'SMALL 2',
          'MIDDLE',
          'JC-120',
          'BUILT-IN 1',
          'BUILT-IN 2',
          'BUILT-IN 3',
          'BUILT-IN 4',
          'BUILT-IN 5',
          'BG STACK 1',
          'BG STACK 2',
          'MS STACK 1',
          'MS STACK 2',
          'METAL STACK',
          '2-STACK',
          '3-STACK'
        ]
      ],
      ['Flanger Switch', 'S'],
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'GtAmpSim → Phaser',
    [
      ['Pre Amp Sw', 'S'],
      [
        'Pre Amp Type',
        'L',
        [
          'JC-120',
          'CLEAN TWIN',
          'MATCH DRIVE',
          'BG LEAD',
          'MS1959I',
          'MS1959II',
          'MS1959I+II',
          'SLDN LEAD',
          'METAL 5150',
          'METAL LEAD',
          'OD-1',
          'OD-2 TURBO',
          'DISTORTION',
          'FUZZ'
        ]
      ],
      ['Pre Amp Volume', 'R', 0, 127, ''],
      ['Pre Amp Master', 'R', 0, 127, ''],
      ['Pre Amp Gain', 'L', ['LOW', 'MIDDLE', 'HIGH']],
      ['Pre Amp Bass', 'R', 0, 127, ''],
      ['Pre Amp Middle', 'R', 0, 127, ''],
      ['Pre Amp Treble', 'R', 0, 127, ''],
      ['Speaker Sw', 'S'],
      [
        'Speaker Type',
        'L',
        [
          'SMALL 1',
          'SMALL 2',
          'MIDDLE',
          'JC-120',
          'BUILT-IN 1',
          'BUILT-IN 2',
          'BUILT-IN 3',
          'BUILT-IN 4',
          'BUILT-IN 5',
          'BG STACK 1',
          'BG STACK 2',
          'MS STACK 1',
          'MS STACK 2',
          'METAL STACK',
          '2-STACK',
          '3-STACK'
        ]
      ],
      ['Phaser Switch', 'S'],
      ['Phaser Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Phaser Manual', 'R', 0, 127, ''],
      ['Phaser Depth', 'R', 0, 127, ''],
      ['Phaser Resonance', 'R', 0, 127, ''],
      ['Phaser Mix', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'GtAmpSim → Delay',
    [
      ['Pre Amp Sw', 'S'],
      [
        'Pre Amp Type',
        'L',
        [
          'JC-120',
          'CLEAN TWIN',
          'MATCH DRIVE',
          'BG LEAD',
          'MS1959I',
          'MS1959II',
          'MS1959I+II',
          'SLDN LEAD',
          'METAL 5150',
          'METAL LEAD',
          'OD-1',
          'OD-2 TURBO',
          'DISTORTION',
          'FUZZ'
        ]
      ],
      ['Pre Amp Volume', 'R', 0, 127, ''],
      ['Pre Amp Master', 'R', 0, 127, ''],
      ['Pre Amp Gain', 'L', ['LOW', 'MIDDLE', 'HIGH']],
      ['Pre Amp Bass', 'R', 0, 127, ''],
      ['Pre Amp Middle', 'R', 0, 127, ''],
      ['Pre Amp Treble', 'R', 0, 127, ''],
      ['Speaker Sw', 'S'],
      [
        'Speaker Type',
        'L',
        [
          'SMALL 1',
          'SMALL 2',
          'MIDDLE',
          'JC-120',
          'BUILT-IN 1',
          'BUILT-IN 2',
          'BUILT-IN 3',
          'BUILT-IN 4',
          'BUILT-IN 5',
          'BG STACK 1',
          'BG STACK 2',
          'MS STACK 1',
          'MS STACK 2',
          'METAL STACK',
          '2-STACK',
          '3-STACK'
        ]
      ],
      ['Delay Switch', 'S'],
      ['Delay Time', 'R', 1, 1300, 'msec'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'EPAmpSim → Tremolo',
    [
      ['Type', 'L', ['OLDCASE', 'NEWCASE', 'WURLY']],
      ['Bass', 'R', -50, 50, ''],
      ['Treble', 'R', -50, 50, ''],
      ['Tremolo Switch', 'S'],
      ['Tremolo Speed (sync sw)', 'S'],
      ['Tremolo Speed (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tremolo Speed (note)', 'N'],
      ['Tremolo Depth', 'R', 0, 127, ''],
      ['Tremolo Duty', 'R', -10, 10, ''],
      ['Speaker Type', 'L', ['LINE', 'OLD', 'NEW', 'WURLY', 'TWIN']],
      ['OD Switch', 'S'],
      ['OD Gain', 'R', 0, 127, ''],
      ['OD Drive', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'EPAmpSim → Chorus',
    [
      ['Type', 'L', ['OLDCASE', 'NEWCASE']],
      ['Bass', 'R', -50, 50, ''],
      ['Treble', 'R', -50, 50, ''],
      ['Chorus Switch', 'S'],
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Speaker Type', 'L', ['LINE', 'OLD', 'NEW', 'WURLY', 'TWIN']],
      ['OD Switch', 'S'],
      ['OD Gain', 'R', 0, 127, ''],
      ['OD Drive', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'EPAmpSim → Flanger',
    [
      ['Type', 'L', ['OLDCASE', 'NEWCASE']],
      ['Bass', 'R', -50, 50, ''],
      ['Treble', 'R', -50, 50, ''],
      ['Flanger Switch', 'S'],
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (sync sw)', 'S'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Rate (note)', 'N'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Speaker Type', 'L', ['LINE', 'OLD', 'NEW', 'WURLY', 'TWIN']],
      ['OD Switch', 'S'],
      ['OD Gain', 'R', 0, 127, ''],
      ['OD Drive', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'EPAmpSim → Phaser',
    [
      ['Type', 'L', ['OLDCASE', 'NEWCASE']],
      ['Bass', 'R', -50, 50, ''],
      ['Treble', 'R', -50, 50, ''],
      ['Phaser Switch', 'S'],
      ['Phaser Rate (sync sw)', 'S'],
      ['Phaser Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Phaser Rate (note)', 'N'],
      ['Phaser Manual', 'R', 0, 127, ''],
      ['Phaser Depth', 'R', 0, 127, ''],
      ['Phaser Resonance', 'R', 0, 127, ''],
      ['Phaser Mix', 'R', 0, 127, ''],
      ['Speaker Type', 'L', ['LINE', 'OLD', 'NEW', 'WURLY', 'TWIN']],
      ['OD Switch', 'S'],
      ['OD Gain', 'R', 0, 127, ''],
      ['OD Drive', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'EPAmpSim → Delay',
    [
      ['Type', 'L', ['OLDCASE', 'NEWCASE']],
      ['Bass', 'R', -50, 50, ''],
      ['Treble', 'R', -50, 50, ''],
      ['Delay Switch', 'S'],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 1300, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Accel', 'R', 0, 15, ''],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Speaker Type', 'L', ['LINE', 'OLD', 'NEW', 'WURLY', 'TWIN']],
      ['OD Switch', 'S'],
      ['OD Gain', 'R', 0, 127, ''],
      ['OD Drive', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Enhancer → Chorus',
    [
      ['Enhancer Sens', 'R', 0, 127, ''],
      ['Enhancer Mix', 'R', 0, 127, ''],
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Enhancer → Flanger',
    [
      ['Enhancer Sens', 'R', 0, 127, ''],
      ['Enhancer Mix', 'R', 0, 127, ''],
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (sync sw)', 'S'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Rate (note)', 'N'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Enhancer → Delay',
    [
      ['Enhancer Sens', 'R', 0, 127, ''],
      ['Enhancer Mix', 'R', 0, 127, ''],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Chorus → Delay',
    [
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Flanger → Delay',
    [
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (sync sw)', 'S'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Rate (note)', 'N'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Chorus → Flanger',
    [
      ['Chorus Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Chorus Rate (sync sw)', 'S'],
      ['Chorus Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Chorus Rate (note)', 'N'],
      ['Chorus Depth', 'R', 0, 127, ''],
      ['Chorus Balance', 'R', 0, 100, 'bal'],
      ['Flanger Pre Delay', 'D', 0.0, 100.0, 1, 'msec'],
      ['Flanger Rate (sync sw)', 'S'],
      ['Flanger Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Flanger Rate (note)', 'N'],
      ['Flanger Depth', 'R', 0, 127, ''],
      ['Flanger Feedback', 'R', -98, 98, '%'],
      ['Flanger Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'CE-1',
    [
      ['Intensity', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'SBF-325',
    [
      ['Mode', 'L', ['FL1', 'FL2', 'FL3', 'CHO']],
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.02, 5.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Depth', 'R', 0, 127, ''],
      ['Manual', 'R', 0, 127, ''],
      ['Feedback', 'R', 0, 127, ''],
      ['CH-R Mode', 'L', ['NORM', 'INV']],
      ['CH-L Phase', 'L', ['NORM', 'INV']],
      ['CH-R Phase', 'L', ['NORM', 'INV']],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'SDD-320',
    [
      ['Mode', 'L', ['1', '2', '3', '4', '1+4', '2+4', '3+4']],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    '2Tap Pan Delay',
    [
      ['Delay Time (sync sw)', 'S'],
      ['Delay Time (msec)', 'R', 1, 2600, 'msec'],
      ['Delay Time (note)', 'N'],
      ['Delay Feedback', 'R', -98, 98, '%'],
      [
        'Delay HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['Delay 1 Level', 'R', 0, 127, ''],
      ['Delay 2 Level', 'R', 0, 127, ''],
      ['Low Gain', 'R', -15, 15, 'dB'],
      ['High Gain', 'R', -15, 15, 'dB'],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Transient',
    [
      ['Attack', 'R', -50, 50, ''],
      ['Release', 'R', -50, 50, ''],
      ['Output Gain', 'R', -24, 12, 'dB'],
      ['Sense', 'L', ['LOW', 'MID', 'HIGH']],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Mid-Side EQ',
    [
      ['M EQ Switch', 'S'],
      ['M Input Gain', 'D', -12.0, 12.0, 2, 'dB'],
      [
        'M Low Frequency',
        'L',
        ['20', '25', '31', '40', '50', '63', '80', '100', '125', '160', '200', '250', '315', '400'],
        'Hz'
      ],
      ['M Low Gain', 'D', -12.0, 12.0, 2, 'dB'],
      [
        'M Mid1 Frequency',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['M Mid1 Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['M Mid1 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      [
        'M Mid2 Frequency',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['M Mid2 Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['M Mid2 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      [
        'M Mid3 Frequency',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['M Mid3 Gain', 'D', -12.0, 12.0, 2, 'dB'],
      [
        'M High Frequency',
        'L',
        ['2000', '2500', '3150', '4000', '5000', '6300', '8000', '10000', '12500', '16000'],
        'Hz'
      ],
      ['M High Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['S EQ Switch', 'S'],
      ['S Input Gain', 'D', -12.0, 12.0, 2, 'dB'],
      [
        'S Low Frequency',
        'L',
        ['20', '25', '31', '40', '50', '63', '80', '100', '125', '160', '200', '250', '315', '400'],
        'Hz'
      ],
      ['S Low Gain', 'D', -12.0, 12.0, 2, 'dB'],
      [
        'S Mid1 Frequency',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['S Mid1 Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['S Mid1 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      [
        'S Mid2 Frequency',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['S Mid2 Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['S Mid2 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      [
        'S Mid3 Frequency',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000'
        ],
        'Hz'
      ],
      ['S Mid3 Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['S Mid3 Q', 'L', ['0.5', '1.0', '2.0', '4.0', '8.0']],
      [
        'S High Frequency',
        'L',
        ['2000', '2500', '3150', '4000', '5000', '6300', '8000', '10000', '12500', '16000'],
        'Hz'
      ],
      ['S High Gain', 'D', -12.0, 12.0, 2, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Mid-Side Compressor',
    [
      ['M Comp Switch', 'S'],
      ['M Attack', 'R', 0, 124, ''],
      ['M Release', 'R', 0, 124, ''],
      ['M Threshold', 'R', -60, 0, 'dB'],
      ['M Knee', 'R', 0, 30, 'dB'],
      ['M Ratio', 'L', ['1:1', '1.5:1', '2:1', '4:1', '16:1', 'INF:1']],
      ['M Post Gain', 'R', 0, 18, 'dB'],
      ['S Comp Switch', 'S'],
      ['S Attack', 'R', 0, 124, ''],
      ['S Release', 'R', 0, 124, ''],
      ['S Threshold', 'R', -60, 0, 'dB'],
      ['S Knee', 'R', 0, 30, 'dB'],
      ['S Ratio', 'L', ['1:1', '1.5:1', '2:1', '4:1', '16:1', 'INF:1']],
      ['S Post Gain', 'R', 0, 18, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Tone Fattener',
    [
      ['Odd Level', 'R', 0, 400, '%'],
      ['Even Level', 'R', 0, 400, '%'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Mid-Side Delay',
    [
      ['M Delay Level', 'R', 0, 127, ''],
      ['M Delay Mode', 'L', ['2Tap', '3Tap', '4Tap']],
      ['M Delay Time (sync sw)', 'S'],
      ['M Delay Time (msec)', 'R', 1, 1300, 'msec'],
      ['M Delay Time (note)', 'N'],
      ['M Delay 1 Feedback', 'R', -98, 98, '%'],
      [
        'M HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['M Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['M Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['M Delay 3 Pan', 'R', -64, 63, 'pan'],
      ['M Delay 4 Pan', 'R', -64, 63, 'pan'],
      ['S Delay Level', 'R', 0, 127, ''],
      ['S Delay Mode', 'L', ['2Tap', '3Tap', '4Tap']],
      ['S Delay Time (sync sw)', 'S'],
      ['S Delay Time (msec)', 'R', 1, 1300, 'msec'],
      ['S Delay Time (note)', 'N'],
      ['S Delay 1 Feedback', 'R', -98, 98, '%'],
      [
        'S HF Damp',
        'L',
        [
          '200',
          '250',
          '315',
          '400',
          '500',
          '630',
          '800',
          '1000',
          '1250',
          '1600',
          '2000',
          '2500',
          '3150',
          '4000',
          '5000',
          '6300',
          '8000',
          'BYPASS'
        ],
        'Hz'
      ],
      ['S Delay 1 Pan', 'R', -64, 63, 'pan'],
      ['S Delay 2 Pan', 'R', -64, 63, 'pan'],
      ['S Delay 3 Pan', 'R', -64, 63, 'pan'],
      ['S Delay 4 Pan', 'R', -64, 63, 'pan'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'RD EPAmpSim',
    [
      ['Bass', 'R', -50, 50, ''],
      ['Treble', 'R', -50, 50, ''],
      ['Tremolo Switch', 'S'],
      ['Tremolo Type', 'L', ['OLDCASE MONO', 'OLDCASE STEREO', 'NEWCASE', 'DYNO', 'WURLY']],
      ['Tremolo Speed (sync sw)', 'S'],
      ['Tremolo Speed (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Tremolo Speed (note)', 'N'],
      ['Tremolo Depth', 'R', 0, 127, ''],
      ['Tremolo Shape', 'R', 0, 20, ''],
      ['AMP Switch', 'S'],
      ['Speaker Type', 'L', ['LINE', 'OLD', 'NEW', 'WURLY', 'TWIN']],
      ['OD Drive', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'DJFX Looper',
    [
      ['Length', 'R', 0, 127, ''],
      ['Speed', 'D', -1.0, 1.0, 2, ''],
      ['Loop Sw', 'S'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'BPM Looper',
    [
      ['Length', 'R', 0, 127, ''],
      ['Rate (sync sw)', 'S'],
      ['Rate Hz', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate Note', 'N'],
      ['On Timing', 'R', 1, 8, ''],
      ['On Length', 'R', 1, 8, ''],
      ['Loop Mode', 'L', ['OFF', 'AUTO', 'ON']],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Saturator',
    [
      ['DrvPre1 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPre1 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPre1 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['Drive', 'D', 0.0, 48.0, 1, 'dB'],
      ['DrvPost1 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPost1 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPost1 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['DrvPost2 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPost2 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPost2 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['DrvPost3 Type', 'L', ['THRU', 'LPF', 'HPF', 'BPF', 'PKG']],
      ['DrvPost3 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPost3 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['DrvPost3 Q', 'D', 0.5, 16.0, 1, ''],
      ['Makeup Sense', 'D', -60.0, 0.0, 1, 'dB'],
      ['DrvPost Gain', 'D', -48.0, 12.0, 1, 'dB'],
      ['Drive Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Warm Saturator',
    [
      ['EQ Low Frequency', 'R', 20, 16000, 'Hz'],
      ['EQ Low Gain', 'R', -24, 24, 'dB'],
      ['EQ High Slope', 'L', ['THRU', '-12dB', '-24dB']],
      ['EQ High Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPre1 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPre1 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPre1 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['Drive', 'D', 0.0, 48.0, 1, 'dB'],
      ['DrvPost1 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPost1 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPost1 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['DrvPost2 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPost2 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPost2 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['DrvPost3 Type', 'L', ['THRU', 'LPF', 'HPF', 'LSV', 'HSV']],
      ['DrvPost3 Frequency', 'R', 20, 16000, 'Hz'],
      ['DrvPost3 Gain', 'D', -24.0, 24.0, 1, 'dB'],
      ['DrvPost3 Q', 'D', 0.5, 16.0, 1, ''],
      ['Makeup Sense', 'D', -60.0, 0.0, 1, 'dB'],
      ['DrvPost Gain', 'D', -48.0, 12.0, 1, 'dB'],
      ['Drive Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Fuzz',
    [
      ['Drive', 'R', 0, 127, ''],
      ['Tone', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'JUNO-106 Chorus',
    [
      ['Mode', 'L', ['I', 'II', 'I+II', 'JX I', 'JX II']],
      ['Noise Level', 'R', 0, 127, ''],
      ['Balance', 'R', 0, 100, 'bal'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Multi Mode Filter',
    [
      ['Filter Type', 'L', ['LPF/HPF', 'LPF', 'HPF', 'BPF']],
      ['Filter Tone', 'R', 0, 255, ''],
      ['Filter Color', 'R', 0, 255, ''],
      ['Filter Slope', 'L', ['-12', '-24', '-36'], 'dB'],
      ['Filter Gain', 'R', 0, 12, 'dB'],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'HMS Distortion',
    [
      ['Distortion', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ],
  [
    'Phaser 100',
    [
      ['Rate (sync sw)', 'S'],
      ['Rate (Hz)', 'D', 0.05, 10.0, 2, 'Hz'],
      ['Rate (note)', 'N'],
      ['Duty', 'R', -50, 50, ''],
      ['Min', 'R', 0, 100, ''],
      ['Max', 'R', 0, 100, ''],
      ['Manual Sw', 'S'],
      ['Manual', 'R', 0, 100, ''],
      ['Resonance', 'R', 0, 66, ''],
      ['Mix', 'R', 0, 127, ''],
      ['Level', 'R', 0, 127, '']
    ]
  ]
];
