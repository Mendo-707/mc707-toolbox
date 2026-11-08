// The Template builder's sounds and project: for a genre, the factory kits and tones (and your own sounds or
// the starters) that suit each part of a track layout, picked so no two clips repeat; and the MC-707
// project (.mpj) that holds them: the layout's drum and tone tracks, a sound in every clip (no notes, the
// clips the length asked for) and the tempo. Loaded on the MC-707 (PROJECT › LOAD) it is a
// ready start: flick through the clips to hear the sounds, record into them, keep what you like.
//
// Reads: ZS.
import { mpjBlank, mpjFill, mpjToneAt } from '../core/mpj-write.js';
import { mulberry } from '../core/random.js';
import { catOf } from './zc-browse-data.js';
import { FW_REC, fwKitBytes, fwRecord } from './zc-factory.js';
import { ZS, soundOf } from './zc-sounds.js';
import { starterMenu } from './zc-starters-more.js';

/** The parts a track can play: [id, label, drum?]. */
export const TPL_ROLES = [
  ['kit', 'Main kit', true],
  ['hats', 'Hats and tops', true],
  ['perc', 'Percussion and FX', true],
  ['bass', 'Bass', false],
  ['keys', 'Keys and chords', false],
  ['pads', 'Pads and strings', false],
  ['leads', 'Leads', false],
  ['pluck', 'Plucks and arps', false],
  ['fx', 'Effects and risers', false],
  ['any', 'Anything', false]
];
export const roleIsDrum = id => !!(TPL_ROLES.find(r => r[0] === id) || [])[2];

/** Track layouts: [id, label, roles for the 8 tracks]. */
export const TPL_LAYOUTS = [
  ['3+5', '3 drum + 5 tone (the default)', ['kit', 'hats', 'perc', 'bass', 'keys', 'pads', 'leads', 'pluck']],
  ['2+6', '2 drum + 6 tone', ['kit', 'perc', 'bass', 'keys', 'pads', 'leads', 'pluck', 'fx']],
  ['4+4', '4 drum + 4 tone', ['kit', 'kit', 'hats', 'perc', 'bass', 'keys', 'pads', 'leads']],
  ['1+7', '1 drum + 7 tone', ['kit', 'bass', 'bass', 'keys', 'pads', 'leads', 'pluck', 'fx']],
  ['0+8', '8 tone tracks', ['bass', 'bass', 'keys', 'keys', 'pads', 'leads', 'pluck', 'fx']],
  ['8+0', '8 drum tracks', ['kit', 'kit', 'kit', 'hats', 'hats', 'perc', 'perc', 'perc']]
];

/* ZenCore categories for each tone part */
const CATS = {
  bass: ['Synth Bass', 'E.Bass', 'Ac.Bass'],
  keys: [
    'Ac.Piano',
    'Pop-Piano',
    'E.Piano1',
    'E.Piano2',
    'E.Organ',
    'Clav',
    'Synth PolyKey',
    'Synth Brass',
    'Hit',
    'E.Guitar'
  ],
  pads: ['Synth Pad/Str', 'Ensemble Strs', 'Vox/Choir', 'Synth BellPad', 'Orchestral'],
  leads: ['Synth Lead', 'Sax', 'Flute', 'Solo Brass', 'Ensemble Brass', 'Scat'],
  pluck: ['Synth Seq/Pop', 'Bell', 'Mallet', 'Pulsating', 'Plucked/Stroke', 'Synth BellPad'],
  fx: ['Synth FX', 'Sound FX', 'Phrase', 'Beat&Groove']
};
const FX = [
  ['Riser', 'Nz Sweep Up', 'Sweep Stab', 'Rave Siren', 'Zap'],
  ['Riser', 'Sweep', 'Noise', 'Nz', 'FX', 'Zap', 'Siren', 'Hit']
];

/* the genres: kits for the drum parts (main, tops, percussion), then for each tone part the names to
   try first and words that suit it. Names the MC-707 does not have are skipped. */
const G = (name, bpm, kits, tones) => ({ name, bpm, kits, tones });
export const TPL_GENRES = {
  dnb: G(
    'Drum and bass',
    174,
    [
      [
        'Drum&Bass Kit 1',
        'Drum&Bass Kit 2',
        'Drum&Bass Kit',
        'Drum&Bass Kit w',
        'Drum&Bass KitLim',
        "90's Kit 1",
        "90's Kit 2",
        'HipHop Kit 2',
        'EDM Kit  5',
        'EDM Kit  3',
        'Techno Kit 2',
        'TR-909 3',
        'Studio Kit 2',
        "90's Kit",
        'Power Kit',
        'R&B Kit 2'
      ],
      [
        'HipHop Kit 2',
        'HipHop Kit 1',
        "90's Kit 2",
        'R&B Kit 1',
        'Studio Kit 1',
        'TR-909 4',
        'TR-808 3',
        'HiHat Cymbal',
        'HiHat Cymbal w',
        'Jazz Kit',
        'Brush Kit',
        'Room Kit',
        'TR-606 1',
        'CR-78 1',
        'Pop Kit 2',
        "80's Kit 2"
      ],
      [
        'EDM Kit  5',
        'EDM Kit 10',
        'EDM Kit  7',
        'EDM Kit  9',
        'EDM Kit 11',
        'EDM Kit 12',
        'Perc. Kit 1',
        'Perc. Kit 2',
        'Perc. Kit 3',
        'SFX Kit 1',
        'SFX Kit 2',
        'SFX Kit 3',
        'Snare',
        'Other Perc 1',
        'Other Perc 2',
        'RimStickClapTom'
      ]
    ],
    {
      bass: [
        [
          'Sine Bass',
          'SC1 Growl Bass1',
          'SC1 Growl Bass3',
          'SC1 Growl Bass5',
          'Razor BassLead1',
          'X-MOD2 Bass1A',
          'X-MOD2 Bass1B',
          'Wub Bass',
          'Step Growl Bass2',
          'MG Deep Bass',
          'Round Bass',
          'Unison Bass 1'
        ],
        ['Growl', 'Reese', 'Sub', 'Wub', 'Neuro', 'Dist', 'Razor', 'Sine']
      ],
      keys: [
        [
          'Rave Stab',
          'JUNO Stab',
          'Horn Blast',
          'AX Orchestra Hit',
          'AX Vintage EP',
          'Delicate EP',
          'Spirit Tine',
          'Phase EP 1',
          'Stage EP',
          'Min7 Hit'
        ],
        ['Stab', 'Hit', 'EP', 'Rave', 'Tine']
      ],
      pads: [
        [
          'Boreal Pad',
          'Heaven Pad 1',
          'Soft Pad 2',
          'AX Heaven Pad',
          'Vox Pad 1',
          'Horror Pad',
          'Metal Pad',
          'AX Mood Strings',
          'Strings4Film'
        ],
        ['Pad', 'Air', 'Dark', 'Vox', 'Strings']
      ],
      leads: [
        [
          'Growl Lead',
          'Dist Sync Lead',
          'X-Mod Lead',
          'Hoover Lead',
          'Voice Lead1',
          'AX Soft Lead',
          'Sine Lead 1',
          'Juno Soft Ld'
        ],
        ['Lead', 'Ld', 'Hoover', 'Sync']
      ],
      pluck: [
        ['Sine Seq MC', 'Atmos Harp', 'Sweep Stab', 'Syn Atk Pluck', 'Sine Pluck', 'Pretty Bells'],
        ['Seq', 'Pluck', 'Sweep', 'Bell']
      ]
    }
  ),
  trap: G(
    'Trap and drill',
    140,
    [
      [
        'Trap Kit',
        'TR-808 1',
        'TR-808 2',
        'TR-808 3',
        'TR-808 4',
        'TR-808',
        'TR-808 comp',
        'TR-808 w comp',
        'Future Bass Kit',
        'EDM Kit  5',
        'HipHop Kit 1',
        'HipHop Kit 2',
        'Reggaeton Kit',
        'R&B Kit 1',
        'EDM Kit 10',
        'HipHop Kit comp'
      ],
      [
        'TR-808 2',
        'Trap Kit',
        'TR-808 3',
        'TR-808 4',
        'TR-606 1',
        'TR-606 2',
        'HiHat Cymbal',
        'HiHat Cymbal w',
        'CR-78 1',
        'TR-707&727 1',
        'R&B Kit 2',
        'HipHop Kit',
        'TR-626 1',
        'TR-909 4',
        'EDM Kit  2',
        'Pop Kit 1'
      ],
      [
        'EDM Kit  5',
        'Future Bass Kit',
        'EDM Kit  9',
        'EDM Kit 12',
        'Perc. Kit 1',
        'Perc. Kit 3',
        'SFX Kit 1',
        'SFX Kit 2',
        'SFX Kit 3',
        'TR-727',
        'Snare',
        'Kick',
        'Other Perc 1',
        'Other Perc 2',
        'RimStickClapTom',
        'EDM Kit  8'
      ]
    ],
    {
      bass: [
        [
          'Dist.808StyleBs1',
          'Dist.808StyleBs2',
          'Dist.808StyleBs3',
          'Sine Bass',
          'Round Bass',
          'Soft Bass',
          'MG Deep Bass',
          'Wub Bass'
        ],
        ['808', 'Sub', 'Sine', 'Boom', 'Round', 'Deep', 'Dist']
      ],
      keys: [
        [
          'Bright Piano',
          'AX Piano',
          'Nice Piano',
          'Bell 1',
          'Bell 2',
          'AX Org Bell',
          'Pop Synth Pluck',
          'Wurly EP',
          'AX Vintage EP',
          'Min7 Hit'
        ],
        ['Piano', 'Pno', 'Bell', 'EP', 'Keys']
      ],
      pads: [
        [
          'Horror Pad',
          'Vox Pad 1',
          'Vox Pad 2',
          'AX Mood Strings',
          'AX Choir 1',
          'Soft Pad 1',
          'Angels Pad',
          'Strings 1'
        ],
        ['Dark', 'Horror', 'Vox', 'Choir', 'Pad', 'Strings']
      ],
      leads: [
        [
          'Bell Lead 1',
          'Bell Lead 2',
          'Pop Synth Pluck2',
          'Sine Lead 1',
          'Whistle Lead',
          'Portament Ld',
          'AX Soft Lead',
          'Pop Flute'
        ],
        ['Bell', 'Whistle', 'Flute', 'Lead', 'Sine']
      ],
      pluck: [
        ['Bell 2', 'Bell 3', 'AX Marimba', 'AX Kalimba', 'Pop SynthMallet', 'Pretty Bells', 'AX Harp', 'AX Koto'],
        ['Bell', 'Mallet', 'Marimba', 'Pluck', 'Harp']
      ]
    }
  ),
  edm: G(
    'EDM and trance',
    128,
    [
      [
        'EDM Kit  1',
        'EDM Kit  2',
        'EDM Kit  3',
        'EDM Kit  4',
        'EDM Kit  5',
        'EDM Kit  6',
        'EDM Kit  7',
        'EDM Kit  8',
        'EDM Kit  9',
        'EDM Kit 10',
        'EDM Kit 11',
        'EDM Kit 12',
        'Future Bass Kit',
        'Trance Kit',
        'EDM Kit',
        'EDM Kit Lim'
      ],
      [
        'TR-909 1',
        'TR-909 3',
        'TR-909 4',
        'Trance Kit',
        'House Kit 1',
        'Techno Kit 1',
        'HiHat Cymbal',
        'HiHat Cymbal w',
        'TR-909 2',
        'EDM Kit w',
        'TR-909',
        'TR-909 comp',
        'TR-606 1',
        'Techno Kit 2',
        'Pop Kit 2',
        'TR-707&727 2'
      ],
      [
        'EDM Kit 10',
        'EDM Kit  5',
        'EDM Kit 12',
        'SFX Kit 1',
        'SFX Kit 2',
        'SFX Kit 3',
        'Perc. Kit 1',
        'Perc. Kit 2',
        'Perc. Kit 3',
        'Snare',
        'Kick',
        'RimStickClapTom',
        'Other Perc 1',
        'Other Perc 2',
        'SFX Kit',
        'EDM Kit  9'
      ]
    ],
    {
      bass: [
        [
          'Fat Analog Bs',
          'Unison Bass 1',
          'Wub Bass',
          'SC1 Growl Bass1',
          'Saw Boost Bs',
          'Hard House Bs',
          'Rubber Bs 1',
          'Punch MG Bs',
          'Spike Bass',
          'Dist Bass'
        ],
        ['Saw', 'Fat', 'Unison', 'Growl', 'Wub', 'Dist', 'Punch']
      ],
      keys: [
        [
          'Super Saw Key 1',
          'Super Saw Key 2',
          'Phase Super Saw',
          'Rave Stab',
          'JUNO Stab',
          'Rave Stab2',
          'Brass Sect',
          'AX Orchestra Hit',
          'Bright Piano',
          'House Piano'
        ],
        ['Saw', 'Stab', 'Key', 'Hit', 'Chord']
      ],
      pads: [
        [
          'Trance Pad',
          'Trance Sweep Pad',
          'JP8 Strings1',
          'JP-8 Pad 1',
          'Chronic Pad',
          'Glass Pad',
          'Shimmer Pad',
          'AX Choir 1',
          'OB Strings'
        ],
        ['Trance', 'Saw', 'Pad', 'Strings', 'Sweep']
      ],
      leads: [
        [
          'SuperSaw Ld',
          'Super Saw Lead',
          'AX Jupiter Ld 1',
          'Pulse Lead 1',
          'Square Ld 1',
          'Tekno Ld 1',
          'Growl Lead',
          'Hoover Lead'
        ],
        ['Saw', 'Lead', 'Ld', 'Super']
      ],
      pluck: [
        ['Super Saw Pluck', 'Syn Atk Pluck', 'SEQ 1', 'SEQ 3', 'SEQ 5', 'SEQ 6', 'JunoArpeggio MC', 'Sweep Stab'],
        ['Pluck', 'Seq', 'SEQ', 'Sweep', 'Arp']
      ]
    }
  ),
  house: G(
    'House and garage',
    124,
    [
      [
        'House Kit 1',
        'House Kit 2',
        'House Kit',
        'House Kit w',
        'TR-909 1',
        'TR-909 2',
        'TR-909 3',
        'TR-909 4',
        'TR-909',
        'TR-909 comp',
        'TR-909 w comp',
        'TR-707&727 1',
        'TR-707&727 2',
        'Techno Kit 1',
        'EDM Kit 10',
        'TR-808 1'
      ],
      [
        'TR-909 3',
        'House Kit 2',
        'TR-909 4',
        'HiHat Cymbal',
        'HiHat Cymbal w',
        'TR-707&727 2',
        'TR-626 1',
        'TR-626 2',
        'TR-606 1',
        'Techno Kit 2',
        'TR-808 3',
        'Pop Kit 1',
        'Studio Kit 1',
        'CR-78 1',
        'Trance Kit',
        "80's Kit 1"
      ],
      [
        'Perc. Kit 1',
        'Perc. Kit 2',
        'Perc. Kit 3',
        'TR-727',
        'CR-78 2',
        'TR-626 3',
        'EDM Kit 10',
        'EDM Kit  5',
        'Other Perc 1',
        'Other Perc 2',
        'RimStickClapTom',
        'SFX Kit 1',
        'SFX Kit 2',
        'Snare',
        'Kick',
        'SFX Kit 3'
      ]
    ],
    {
      bass: [
        [
          'House Bs',
          'MG Deep Bass',
          'Round Bass',
          'Rubber Bs 1',
          'Rubber Bs 2',
          'AX Garage Bass',
          'Garage Bs 1',
          'Hard House Bs',
          'Punch MG Bs',
          'MG Bs 1',
          'Soft Bass',
          'Finger E Bs 1'
        ],
        ['House', 'Deep', 'Garage', 'Rubber', 'MG', 'Round', 'Organ']
      ],
      keys: [
        [
          'House Piano',
          'GarageChd MC',
          '1Note GarageEP',
          'Bright Piano',
          'AX Vintage EP',
          '1Note Organ MC',
          'Rotary Org 1',
          'JUNO Stab',
          'AX Clav 1',
          'Funk Gtr',
          'Min7 Hit'
        ],
        ['House', 'Piano', 'Organ', 'Chd', 'EP', 'Stab']
      ],
      pads: [
        [
          'JP8 Strings1',
          'OB Strings',
          'Soft Pad 2',
          'Reverie Pad',
          'JUNO Str 1',
          'AX JP Strings',
          'Chronic Pad',
          'Glass Pad',
          'AX Choir 1'
        ],
        ['Strings', 'Str', 'Pad', 'Choir']
      ],
      leads: [
        [
          'Bell Lead 2',
          'Syn VoiceLead 1',
          'AX Vibraphone',
          'Voice Lead1',
          'AX Jupiter Ld 1',
          'Pulse Lead 1',
          'Funky Lead',
          'Brass Sect'
        ],
        ['Voice', 'Lead', 'Brass', 'Vox']
      ],
      pluck: [
        ['SEQ 6', 'Syn Atk Pluck', 'EP Belle', 'AX Kalimba', 'AX Marimba', 'Sine Seq MC', 'Echo Pluck', 'PW-Echo Seq'],
        ['Seq', 'SEQ', 'Pluck', 'Mallet', 'Marimba', 'Bell']
      ]
    }
  ),
  techno: G(
    'Techno',
    132,
    [
      [
        'Techno Kit 1',
        'Techno Kit 2',
        'TR-909 3',
        'TR-909 4',
        'TR-909 1',
        'TR-909',
        'TR-909 comp',
        'TR-808 1',
        'TR-808 3',
        'EDM Kit 10',
        'EDM Kit  9',
        'House Kit 2',
        'TR-606 1',
        'TR-707&727 2',
        'Power Kit',
        'EDM Kit 12'
      ],
      [
        'TR-909 4',
        'TR-909 3',
        'HiHat Cymbal',
        'HiHat Cymbal w',
        'TR-606 1',
        'TR-606 2',
        'TR-626 1',
        'TR-808 2',
        'Techno Kit 2',
        'CR-78 1',
        'TR-707&727 1',
        'House Kit 1',
        'EDM Kit  2',
        'Studio Kit 2',
        'Room Kit',
        "80's Kit 2"
      ],
      [
        'Perc. Kit 1',
        'Perc. Kit 2',
        'Perc. Kit 3',
        'SFX Kit 1',
        'SFX Kit 2',
        'SFX Kit 3',
        'TR-727',
        'TR-626 3',
        'Other Perc 1',
        'Other Perc 2',
        'RimStickClapTom',
        'EDM Kit  5',
        'Kick',
        'Snare',
        'CR-78 2',
        'SFX Kit'
      ]
    ],
    {
      bass: [
        [
          'TB Bass 1',
          'TB Bass 2',
          'Acid Bass',
          'Rubber Bs 1',
          'Punch MG Bs',
          'MG Bs 1',
          'Fat Analog Bs',
          'Spike Bass',
          'Sine Bass',
          'Round Bass'
        ],
        ['TB', 'Acid', 'Rubber', 'MG', 'Punch', 'Analog', 'Sub']
      ],
      keys: [
        [
          'Rave Stab',
          'JUNO Stab',
          'Min7 Hit',
          'Dub Chord',
          'Techno Stab',
          'Rave Stab2',
          'AX Orchestra Hit',
          'Phase EP 1'
        ],
        ['Stab', 'Chord', 'Hit', 'Dub', 'Rave']
      ],
      pads: [
        [
          'Metal Pad',
          'Horror Pad',
          'Chronic Pad',
          'Glass Pad',
          'Boreal Pad',
          'Trance Sweep Pad',
          'JP-8 Pad 1',
          'Soft Pad 2'
        ],
        ['Dark', 'Metal', 'Pad', 'Sweep', 'Drone']
      ],
      leads: [
        [
          'Tekno Ld 1',
          'Square Ld 1',
          'Pulse Lead 1',
          'Dist Sync Lead',
          'X-Mod Lead',
          'Hoover Lead',
          'Sine Lead 1',
          'AX Jupiter Ld 1'
        ],
        ['Tekno', 'Lead', 'Ld', 'Sync', 'Square']
      ],
      pluck: [
        ['SEQ 1', 'SEQ 3', 'SEQ 5', 'SEQ 6', 'PW-Echo Seq', 'Echo Pluck', 'Syn Atk Pluck', 'JunoArpeggio MC'],
        ['SEQ', 'Seq', 'Pulse', 'Echo', 'Arp']
      ]
    }
  ),
  boombap: G(
    'Boom bap and lo-fi',
    90,
    [
      [
        'HipHop Kit 1',
        'HipHop Kit 2',
        'HipHop Kit',
        'HipHop Kit comp',
        'HipHop Kit w cmp',
        "90's Kit 1",
        "90's Kit 2",
        "90's Kit",
        "90's Kit comp",
        'R&B Kit 1',
        'R&B Kit 2',
        'Studio Kit 1',
        'Studio Kit 2',
        'Room Kit',
        'Jazz Kit',
        'Pop Kit 1'
      ],
      [
        'HipHop Kit 2',
        'R&B Kit 2',
        'Jazz Kit',
        'Brush Kit',
        'HiHat Cymbal',
        'Studio Kit',
        'Room Kit w',
        'Jazz Kit w',
        'Brush Kit w',
        'TR-808 3',
        'TR-707&727 1',
        'CR-78 1',
        'CR-78 2',
        "80's Kit 1",
        'Standard Kit',
        'Pop Kit 2'
      ],
      [
        'Perc. Kit 1',
        'Perc. Kit 2',
        'Perc. Kit 3',
        'HipHop Kit 1',
        'SFX Kit 1',
        'SFX Kit 2',
        'Other Perc 1',
        'Other Perc 2',
        'RimStickClapTom',
        'Snare',
        'Kick',
        'CR-78 1',
        'TR-626 1',
        'Orchestra Kit',
        'SFX Kit 3',
        'TR-727'
      ]
    ],
    {
      bass: [
        [
          'Finger E Bs 1',
          'Finger E Bs 2',
          'Finger E Bs 3',
          'Acoustic Bs 1',
          'Acoustic Bs 2',
          'AX Fretless Bs',
          'Pick Bass 1',
          'MG Bs 1',
          'Round Bass',
          'Sine Bass'
        ],
        ['Finger', 'Acoustic', 'Upright', 'Fretless', 'Pick', 'Jazz', 'MG']
      ],
      keys: [
        [
          'AX Vintage EP',
          'Wurly EP',
          'AX Piano',
          'Stage EP',
          'Delicate EP',
          'Rotary Org 1',
          'AX Clav 1',
          'Jazz Gtr',
          'AX Clean Guitar',
          'Brass Sect'
        ],
        ['EP', 'Piano', 'Wurly', 'Rhodes', 'Org', 'Gtr', 'Clav']
      ],
      pads: [
        [
          'AX Mood Strings',
          'Tape Strings',
          'Strings 1',
          'Soft Pad 1',
          'AX Choir 1',
          'Vox Pad 1',
          'AX 60s Strings',
          'AX Small Strings'
        ],
        ['Strings', 'Str', 'Choir', 'Soft', 'Tape']
      ],
      leads: [
        [
          'Warm Vibes',
          'AX Soft Lead',
          'Breathy Sax',
          'AX Tenor Sax',
          'AX Mute Trumpet',
          'Pop Flute',
          'Syn VoiceLead 1',
          'AX Alto Sax'
        ],
        ['Sax', 'Trumpet', 'Tp', 'Flute', 'Soft', 'Vibe']
      ],
      pluck: [
        ['AX Kalimba', 'AX Marimba', 'AX Vibraphone', 'AX Harp', 'Bell 1', 'AX Koto', 'AX Sitar', 'AX Nylon Gtr 1'],
        ['Kalimba', 'Marimba', 'Vibe', 'Harp', 'Nylon', 'Bell']
      ]
    }
  ),
  pop: G(
    'Pop and everything',
    110,
    [
      [
        'Pop Kit 1',
        'Pop Kit 2',
        'Studio Kit 1',
        'Studio Kit 2',
        'Standard Kit',
        'Room Kit',
        "80's Kit 1",
        "80's Kit 2",
        'Power Kit',
        'R&B Kit 1',
        'TR-808 1',
        'TR-909 1',
        'HipHop Kit 1',
        'EDM Kit  5',
        'House Kit 1',
        'Jazz Kit'
      ],
      [
        'HiHat Cymbal',
        'HiHat Cymbal w',
        'Pop Kit 2',
        'Studio Kit',
        'Brush Kit',
        'TR-707&727 1',
        'CR-78 1',
        'TR-606 1',
        'TR-808 2',
        'TR-909 3',
        'R&B Kit 2',
        'Room Kit w',
        'Jazz Kit w',
        'TR-626 1',
        "80's Kit",
        'Standard Kit'
      ],
      [
        'Perc. Kit 1',
        'Perc. Kit 2',
        'Perc. Kit 3',
        'Orchestra Kit',
        'SFX Kit 1',
        'SFX Kit 2',
        'Other Perc 1',
        'Other Perc 2',
        'RimStickClapTom',
        'TR-727',
        'CR-78 2',
        'TR-626 3',
        'Snare',
        'Kick',
        'SFX Kit 3',
        'EDM Kit 10'
      ]
    ],
    {
      bass: [
        [
          'Finger E Bs 1',
          'Pick Bass 1',
          'MG Bs 1',
          'Round Bass',
          'Fat Analog Bs',
          'Sine Bass',
          'Soft Bass',
          'Rubber Bs 1',
          'Acoustic Bs 1',
          'Punch MG Bs'
        ],
        ['Bass', 'Bs', 'Finger', 'Pick', 'MG', 'Round']
      ],
      keys: [
        [
          'Bright Piano',
          'AX Piano',
          'Nice Piano',
          'Stage EP',
          'AX Vintage EP',
          'Wurly EP',
          'Rotary Org 1',
          'AX Clean Guitar',
          'Brass Sect',
          'JUNO Stab'
        ],
        ['Piano', 'EP', 'Org', 'Gtr', 'Keys']
      ],
      pads: [
        [
          'Soft Pad 1',
          'Soft Pad 2',
          'Strings 1',
          'AX Mood Strings',
          'OB Strings',
          'JP8 Strings1',
          'Glass Pad',
          'AX Choir 1'
        ],
        ['Pad', 'Strings', 'Str', 'Choir']
      ],
      leads: [
        [
          'AX Soft Lead',
          'Sine Lead 1',
          'Pop Flute',
          'AX Alto Sax',
          'Pulse Lead 1',
          'Square Ld 1',
          'Syn VoiceLead 1',
          'Bell Lead 2'
        ],
        ['Lead', 'Ld', 'Sax', 'Flute', 'Voice']
      ],
      pluck: [
        ['Pop Synth Pluck', 'Syn Atk Pluck', 'AX Marimba', 'AX Kalimba', 'Bell 1', 'AX Harp', 'SEQ 6', 'Pretty Bells'],
        ['Pluck', 'Bell', 'Mallet', 'Seq', 'Harp']
      ]
    }
  )
};

/* ---------- the sounds there are to pick from ---------- */
let STARTS = null;
const starters = () =>
  STARTS ||
  (STARTS = starterMenu().flatMap(([, list]) =>
    list.map(([name, make]) => {
      const snd = make();
      return { id: 'st:' + name, name, kind: snd.kind, src: 'starter', make, cat: null };
    })
  ));
/** Where a sound comes from, as the builder groups them: 'factory', 'starter' or 'mine'. */
export const srcOf = e => (e.src === 'factory' ? 'factory' : e.src === 'starter' ? 'starter' : 'mine');
/** The sounds there are for a kind ('tone' or 'kit'), from the sources asked for. Kits: only ones that
 * go in a project file (the factory kits, with their drum instruments). */
export function tplPool(kind, srcs) {
  const all = kind === 'tone' && srcs.includes('starter') ? [...ZS.list, ...starters()] : ZS.list;
  return all.filter(e => e.kind === kind && srcs.includes(srcOf(e)) && (kind === 'kit' ? !!e.mpj : !e.mpj));
}
const catName = e => (e.make ? (e.cat = e.cat || catOf({ make: e.make })) : catOf(e));
/* series like Vox Pad 2, 3, 4: at most two of one in a list */
const stem = n => n.replace(/[\s\d]+[A-Za-z]?$/, '').toLowerCase();

/**
 * Sounds for a part: up to n, none twice and none in avoid (names). With a shuffle (a seed), the
 * best matches are drawn in a new order and more of the near ones come in.
 * @returns {object[]} sound library entries
 */
export function tplPick(genre, role, n, srcs, avoid = new Set(), seed = 0) {
  const g = TPL_GENRES[genre] || TPL_GENRES.pop,
    drum = roleIsDrum(role),
    pool = tplPool(drum ? 'kit' : 'tone', srcs),
    byName = new Map(pool.map(e => [e.name, e])),
    r = seed ? mulberry(seed) : null,
    out = [];
  let series = true,
    others = false;
  const take = e => {
    if (!e || out.includes(e) || (!others && avoid.has(e.name)) || out.length >= n) return;
    if (series && out.filter(x => stem(x.name) === stem(e.name)).length >= 2) return;
    out.push(e);
  };
  let first = [],
    cats = [],
    words = [];
  if (drum) first = g.kits[role === 'kit' ? 0 : role === 'hats' ? 1 : 2];
  else if (role === 'fx') [first, words] = FX;
  else if (role !== 'any') [first, words] = g.tones[role];
  if (!drum) cats = role === 'any' ? Object.values(CATS).flat() : CATS[role];
  /* the names first (shuffled a little with a seed), then by how well they match */
  const named = first.map(x => byName.get(x)).filter(Boolean);
  if (r)
    for (let i = named.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [named[i], named[j]] = [named[j], named[i]];
    }
  named.slice(0, r ? Math.ceil(n * 0.6) : n).forEach(take);
  const score = e =>
    words.reduce((s, w, i) => s + (e.name.toLowerCase().includes(w.toLowerCase()) ? 40 - i : 0), 0) +
    (srcOf(e) === 'mine' ? 6 : 0) +
    (r ? r() * 30 : 0);
  const rest = pool
    .filter(e => (drum ? true : cats.includes(catName(e))) && !/^SL-/.test(e.name))
    .sort((a, b) => score(b) - score(a));
  rest.forEach(take);
  named.forEach(take);
  /* not enough without more of a series: then they come in too */
  series = false;
  rest.forEach(take);
  /* a small library: sounds another track has too, rather than empty clips */
  others = true;
  rest.forEach(take);
  return out;
}

/**
 * The project for a template: {bytes, clips}. cfg: {name, bpm, clipBars, tracks:[{kind:'drum'|'tone', sounds:[entry|null x16]}] (8)}.
 */
export async function tplBytes(cfg) {
  const kinds = cfg.tracks.map(x => x.kind),
    u8 = await mpjBlank(kinds),
    steps = Math.max(1, Math.min(8, cfg.clipBars || 1)) * 16,
    clips = [],
    sounds = [];
  cfg.tracks.forEach((tr, t) =>
    tr.sounds.forEach((e, k) => {
      if (!e || k > 15) return;
      clips.push({ t, k, size: 1, steps, slots: [], name: e.name.slice(0, 16) });
      if (tr.kind === 'drum') {
        const kit = e.mpj && fwKitBytes(e.mpj);
        if (kit) sounds.push({ t, k, kind: 'kit', ...kit });
      } else {
        const snd = e.make ? e.make() : soundOf(e);
        if (!snd) return;
        const at = mpjToneAt(u8, t, 16);
        sounds.push({ t, k, kind: 'tone', rec: fwRecord(snd, u8.subarray(at, at + FW_REC)) });
      }
    })
  );
  mpjFill(u8, { name: cfg.name, bpm: cfg.bpm, clips, scenes: [], sounds });
  return { bytes: u8, clips: clips.length };
}
