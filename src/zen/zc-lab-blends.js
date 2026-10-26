// The Slime Lab's blends: classic synth sounds built from scratch, one step at a time, each step a real
// sound-design move with the reason for it. A blend starts from a clean slate (a fresh tone on the VA
// oscillator, the way the ZenCore editor's starters are made), so it sounds the same whatever tone was
// loaded; then each step sets exact values. The values follow the editor's starters (zc-starters.js) and
// add what makes each sound itself: the right waveform, filter type and slope, velocity, the effect.
//
// A step: [ingredient (its colour and Learn entry), title, why, values {key: value}].
// Reads: MFX defaults (zc-mfx.js), the parameter keys (zc-tone.js).
import { mfxDefaults } from './zc-mfx.js';
import { MFX_PARAMS } from './zc-tone.js';

/* the tone's MFX set to a type, with its defaults and some parameters changed ({index: value}) */
function mfx(type, set = {}) {
  const d = mfxDefaults(type);
  for (const i in set) d[i] = set[i];
  return { 'MFX.mfxType': type, 'MFX.mfxSwitch': 1, ...Object.fromEntries(MFX_PARAMS.map((k, i) => [k, d[i]])) };
}
/* the same values on several partials: on([0, 1], {'PTL.CUTOFF': 500}) */
function on(parts, vals) {
  const out = {};
  for (const i of parts)
    for (const k in vals) {
      const [b, id] = k.split('.');
      out[b + i + '.' + id] = vals[k];
    }
  return out;
}
/* partial switches: these partials on, the rest off */
const partials = (...ps) =>
  Object.fromEntries([0, 1, 2, 3].map(i => ['PMT.PMT' + (i + 1) + '_PTL_SW', ps.includes(i) ? 1 : 0]));
const AMP = { overdrive: 29, distortion: 30, chorus: 23, bitcrush: 46, tapeEcho: 44, phaser: 11 };

/**
 * The blends. slate: the clean slate's waveform (VA_FORM: 0 saw, 1 square, 2 tri, 3 sine, 5 Juno) or
 * 'supersaw'. note: the key to taste it on.
 */
export const BLENDS = [
  {
    id: 'acid',
    name: 'Acid Bass',
    note: 36,
    slate: 0,
    about: 'The TB-303: one sawtooth voice, sliding between notes, through a resonant filter that snaps shut.',
    steps: [
      [
        'wolf',
        'One voice, with slides',
        'The 303 is monophonic. Legato glide means only notes you overlap slide into each other, so the slides are part of how you play the line.',
        {
          'CMN.MONO_POLY': 0,
          'CMN.LEGATO_SW': 1,
          'CMN.PORTA_SW': 1,
          'CMN.PORTA_MODE': 1,
          'CMN.PORTA_TIME': 90,
          'CMN.OCTAVE': -1
        }
      ],
      [
        'squelch',
        'Low cutoff, high resonance',
        'The cutoff starts low so the envelope has room to sweep it, and the resonance is high enough to whistle without self-oscillating. The analog filter model at -18 dB per octave is closer to the 303’s own slope than a standard -24 dB filter.',
        on([0], {
          'SPTL.FILTER_TYPE': 1,
          'SPTL.VCF_TYPE': 1,
          'SPTL.FILTER_SLOPE': 1,
          'PTL.CUTOFF': 280,
          'PTL.RESO': 800
        })
      ],
      [
        'pluck',
        'A short filter envelope',
        'Each note opens the filter at once and closes it in a fraction of a second: the “squelch”. Velocity deepens the sweep, standing in for the 303’s accent: play some notes harder.',
        on([0], {
          'FENV.DEPTH': 44,
          'FENV.VSENS': 45,
          'FENV.T1': 0,
          'FENV.L1': 1023,
          'FENV.T2': 190,
          'FENV.L2': 160,
          'FENV.L3': 110,
          'FENV.T4': 120
        })
      ],
      [
        'punch',
        'Gated amp',
        'The level jumps straight to full and cuts off quickly on release, so the line stays tight and rhythmic.',
        on([0], { 'AENV.T1': 0, 'AENV.L1': 1023, 'AENV.L2': 1023, 'AENV.L3': 1023, 'AENV.T4': 70 })
      ],
      [
        'grit',
        'Overdrive',
        'Acid is almost always driven. Overdrive after the filter makes the resonant peak scream and adds harmonics a small speaker can play.',
        mfx(AMP.overdrive, { 0: 72, 1: 70, 7: 96 })
      ]
    ]
  },
  {
    id: 'reese',
    name: 'Reese Bass',
    note: 36,
    slate: 0,
    about: 'Two detuned saws beating against each other: the moving, growling bass of drum and bass.',
    steps: [
      [
        'shimmer',
        'A second saw, detuned',
        'The two saws are a few cents apart, so they drift in and out of phase. That slow beating is the whole character of a Reese.',
        {
          ...partials(0, 1),
          'SPTL1.OSC_TYPE': 1,
          'SPTL1.VA_FORM': 0,
          'PTL0.PIT_FINE': -14,
          'PTL1.PIT_FINE': 14
        }
      ],
      [
        'wolf',
        'Mono, an octave down',
        'One note at a time keeps the low end clean; an octave down puts it in bass territory.',
        { 'CMN.MONO_POLY': 0, 'CMN.LEGATO_SW': 1, 'CMN.OCTAVE': -1 }
      ],
      [
        'moon',
        'Darker filter',
        'Taking off the top makes the beating felt more than heard, and leaves room for the drums.',
        on([0, 1], { 'PTL.CUTOFF': 500, 'PTL.RESO': 140, 'AENV.T4': 140 })
      ],
      [
        'wobble',
        'Slow filter movement',
        'A slow LFO on the cutoff, about one cycle a bar, makes it breathe. Synced to the tempo it moves with the track.',
        on([0, 1], {
          'LFO.LFO2_FORM': 1,
          'LFO.LFO2_RATE_SYNC': 1,
          'LFO.LFO2_RATE_NOTE': 18,
          'LFO.LFO2_TVF_DEPTH': 18
        })
      ],
      [
        'grit',
        'Distortion',
        'Distortion thickens the beating and gives the growl.',
        mfx(AMP.distortion, { 0: 50, 1: 56, 7: 90 })
      ]
    ]
  },
  {
    id: 'wob',
    name: 'Wobble Bass',
    note: 36,
    slate: 0,
    about: 'A saw with a filter wobbling in time with the track, over a steady sine sub.',
    steps: [
      [
        'wolf',
        'Mono, an octave down',
        'Wobble basses are single notes, low.',
        { 'CMN.MONO_POLY': 0, 'CMN.OCTAVE': -1 }
      ],
      [
        'squelch',
        'Resonant low-pass',
        'A low cutoff with some resonance gives the wobble a vowel-like “wow”.',
        on([0], { 'PTL.CUTOFF': 300, 'PTL.RESO': 440, 'AENV.T4': 120 })
      ],
      [
        'wobble',
        'An LFO on the filter, synced',
        'LFO 2 is locked to the tempo at 1/8 notes, so the wobble is part of the rhythm. Change the note value (LFO page) to change the groove: 1/4, 1/8, 1/8 triplet.',
        on([0], {
          'LFO.LFO2_FORM': 0,
          'LFO.LFO2_RATE_SYNC': 1,
          'LFO.LFO2_RATE_NOTE': 9,
          'LFO.LFO2_TVF_DEPTH': 70
        })
      ],
      [
        'abyss',
        'A sine sub that doesn’t wobble',
        'A second partial plays a clean sine an octave lower with no filter movement. The wobble happens above it while the low end stays solid, which is how these basses hit hard on a big system.',
        {
          ...partials(0, 1),
          'SPTL1.OSC_TYPE': 1,
          'SPTL1.VA_FORM': 3,
          'PTL1.PIT_CRS': -12,
          'PTL1.LEVEL': 110,
          'PTL1.CUTOFF': 1023,
          'PTL1.RESO': 0,
          'LFO1.LFO2_TVF_DEPTH': 0,
          'AENV1.T4': 120
        }
      ],
      [
        'grit',
        'Distortion',
        'Distortion turns the wobble from a wah into a growl.',
        mfx(AMP.distortion, { 0: 70, 1: 60, 7: 86 })
      ]
    ]
  },
  {
    id: 'trance',
    name: 'Supersaw Lead',
    note: 60,
    slate: 'supersaw',
    about: 'The Roland JP-8000’s SuperSAW: seven detuned saws in one oscillator, bright and huge.',
    steps: [
      [
        'swarm',
        'SuperSAW detune',
        'The SuperSAW oscillator stacks seven saws in one; Detune spreads them. Around two thirds is the classic trance setting: wide, but still in tune.',
        on([0], { 'SPTL.SSAW_DETUNE': 92 })
      ],
      [
        'sun',
        'Mostly open filter',
        'The filter is nearly open (a supersaw is about its brightness), with a little envelope so each note has a bite at the start.',
        on([0], {
          'PTL.CUTOFF': 860,
          'PTL.RESO': 80,
          'FENV.DEPTH': 14,
          'FENV.T2': 320,
          'FENV.L2': 700,
          'FENV.L3': 650
        })
      ],
      [
        'mist',
        'Full sustain, medium release',
        'The notes hold at full level and ring on a little after release, so chords and fast lines blur slightly together.',
        on([0], { 'AENV.T1': 10, 'AENV.L3': 1023, 'AENV.T4': 320 })
      ],
      [
        'space',
        'Delay and reverb',
        'Trance leads live in big spaces: a delay for the echoes between notes, reverb for the room.',
        on([0], { 'PTL.CHO_SEND': 50, 'PTL.REV_SEND': 64 })
      ]
    ]
  },
  {
    id: 'pad',
    name: 'Dream Pad',
    note: 60,
    slate: 0,
    about: 'Two detuned layers fading slowly in and out, darkened and gently moving, far away in a chorus and reverb.',
    steps: [
      [
        'shimmer',
        'A second layer, detuned',
        'A triangle under the saw, each a few cents off: the layers drift against each other and the pad shimmers.',
        {
          ...partials(0, 1),
          'SPTL1.OSC_TYPE': 1,
          'SPTL1.VA_FORM': 2,
          'PTL0.PIT_FINE': -8,
          'PTL1.PIT_FINE': 8
        }
      ],
      [
        'moon',
        'Darker',
        'Pads sit behind everything, so the top is taken off.',
        on([0, 1], { 'PTL.CUTOFF': 560, 'PTL.RESO': 60 })
      ],
      [
        'swell',
        'Slow in, slow out',
        'A slow attack and a long release turn notes into a wash. Play the chords a little early.',
        on([0, 1], { 'AENV.T1': 620, 'AENV.L3': 1023, 'AENV.T4': 640 })
      ],
      [
        'sloth',
        'Slow movement',
        'A slow LFO moves the cutoff slightly, so the pad never sits still.',
        on([0, 1], { 'LFO.LFO1_FORM': 0, 'LFO.LFO1_RATE': 380, 'LFO.LFO1_TVF_DEPTH': 12 })
      ],
      [
        'space',
        'Chorus and reverb',
        'A chorus effect widens it, and plenty of reverb sends it into the distance.',
        { ...mfx(AMP.chorus, {}), ...on([0, 1], { 'PTL.REV_SEND': 84, 'PTL.CHO_SEND': 40 }) }
      ]
    ]
  },
  {
    id: 'brass',
    name: 'Brass Stab',
    note: 60,
    slate: 0,
    about: 'Two saws with a filter that blooms on each note and opens wider the harder you play: 80s synth brass.',
    steps: [
      [
        'shimmer',
        'Two saws, slightly apart',
        'Brass sections are many players slightly out of tune with each other; two saws a few cents apart give that richness.',
        {
          ...partials(0, 1),
          'SPTL1.OSC_TYPE': 1,
          'SPTL1.VA_FORM': 0,
          'PTL0.PIT_FINE': -6,
          'PTL1.PIT_FINE': 6
        }
      ],
      [
        'bloom',
        'A filter that blooms',
        'The cutoff starts low and the envelope opens it over a short moment, like the air building in a horn.',
        on([0, 1], {
          'PTL.CUTOFF': 500,
          'FENV.DEPTH': 32,
          'FENV.T1': 130,
          'FENV.L1': 1023,
          'FENV.T2': 330,
          'FENV.L2': 700,
          'FENV.L3': 600
        })
      ],
      [
        'punch',
        'Velocity opens the filter',
        'Harder hits open the filter further, so the stab responds to how you play.',
        on([0, 1], { 'PTL.CUTOFF_VSENS': 50, 'FENV.VSENS': 40 })
      ],
      [
        'pluck',
        'A quick start and short end',
        'A tiny attack softens the click, and a short release keeps stabs punchy.',
        on([0, 1], { 'AENV.T1': 50, 'AENV.L3': 1023, 'AENV.T4': 190, 'PTL.REV_SEND': 40 })
      ]
    ]
  },
  {
    id: 'pluck',
    name: 'House Pluck',
    note: 60,
    slate: 1,
    about:
      'A square wave with an instant attack and a fast-closing filter: the plucked riff of house and tropical house.',
    steps: [
      [
        'pluck',
        'Filter envelope pluck',
        'The filter opens fully on each note and closes completely within a moment: the tone starts bright and dies dull, like a plucked string.',
        on([0], {
          'PTL.CUTOFF': 360,
          'PTL.RESO': 170,
          'FENV.DEPTH': 50,
          'FENV.T1': 0,
          'FENV.L1': 1023,
          'FENV.T2': 360,
          'FENV.L2': 0,
          'FENV.L3': 0
        })
      ],
      [
        'mist',
        'Decay to silence',
        'The level decays to nothing even while the key is held, so the notes are short however you play them; the release lets them ring a moment.',
        on([0], { 'AENV.T1': 0, 'AENV.T2': 420, 'AENV.L2': 0, 'AENV.L3': 0, 'AENV.T4': 300 })
      ],
      [
        'space',
        'Delay and a little reverb',
        'Plucks leave gaps; a delay fills them with echoes that become part of the riff.',
        on([0], { 'PTL.CHO_SEND': 56, 'PTL.REV_SEND': 40 })
      ]
    ]
  },
  {
    id: 'sub808',
    name: '808 Bass',
    note: 36,
    slate: 3,
    about: 'A sine with a pitch drop at the start and a long decay, gliding between notes, driven so it cuts through.',
    steps: [
      [
        'wolf',
        'Mono glide, an octave down',
        '808 basses slide between notes. Legato glide only slides overlapping notes, so you choose the slides as you play.',
        {
          'CMN.MONO_POLY': 0,
          'CMN.LEGATO_SW': 1,
          'CMN.PORTA_SW': 1,
          'CMN.PORTA_MODE': 1,
          'CMN.PORTA_TIME': 260,
          'CMN.OCTAVE': -1
        }
      ],
      [
        'punch',
        'A pitch drop at the start',
        'Each note starts a little higher and drops to pitch in a moment: heard as the knock at the start of an 808.',
        on([0], {
          'PENV.DEPTH': 12,
          'PENV.L0': 300,
          'PENV.T1': 120,
          'PENV.L1': 0,
          'PENV.L2': 0,
          'PENV.L3': 0,
          'PENV.L4': 0,
          'PTL.CUTOFF': 1023
        })
      ],
      [
        'mist',
        'A long decay',
        'The 808 rings and slowly decays, so it is a bass line and a kick in one.',
        on([0], { 'AENV.T1': 0, 'AENV.T2': 760, 'AENV.L2': 700, 'AENV.T3': 760, 'AENV.L3': 0, 'AENV.T4': 300 })
      ],
      [
        'grit',
        'Drive',
        'A pure sine is almost silent on phones and laptops. Overdrive adds harmonics that suggest the bass even where the speaker can’t play it.',
        mfx(AMP.overdrive, { 0: 56, 1: 52, 7: 100 })
      ]
    ]
  },
  {
    id: 'keys',
    name: 'Lo-fi Keys',
    note: 60,
    slate: 2,
    about: 'A soft electric piano: triangle with a bell-like sine above, decaying, wavering in pitch, gently pulsing.',
    steps: [
      [
        'feather',
        'A bell partial above',
        'A quiet sine two octaves up gives the tine-like ring of an electric piano. It decays faster than the body, as the real thing does.',
        {
          ...partials(0, 1),
          'SPTL1.OSC_TYPE': 1,
          'SPTL1.VA_FORM': 3,
          'PTL1.PIT_CRS': 24,
          'PTL1.LEVEL': 60,
          'AENV1.T1': 0,
          'AENV1.T2': 360,
          'AENV1.L2': 0,
          'AENV1.L3': 0,
          'AENV1.T4': 200
        }
      ],
      [
        'pluck',
        'A piano-like decay',
        'The body fades while the key is held, like a struck note, and stops quickly when released.',
        on([0], {
          'AENV.T1': 0,
          'AENV.T2': 600,
          'AENV.L2': 520,
          'AENV.T3': 900,
          'AENV.L3': 0,
          'AENV.T4': 260,
          'PTL.CUTOFF': 520
        })
      ],
      [
        'drift',
        'Wobbly, worn pitch',
        'Analog feel and a little random pitch imitate a worn tape: every note lands slightly differently.',
        { 'CMN.ANALOG_FEEL': 60, ...on([0, 1], { 'PTL.PIT_RND': 8 }) }
      ],
      [
        'tremolo',
        'Tremolo',
        'The level pulses gently in time with the track (1/8 notes), like an electric piano’s tremolo.',
        on([0, 1], {
          'LFO.LFO1_FORM': 1,
          'LFO.LFO1_RATE_SYNC': 1,
          'LFO.LFO1_RATE_NOTE': 9,
          'LFO.LFO1_TVA_DEPTH': 22
        })
      ],
      [
        'moon',
        'Warm and soft',
        'A low-gain overdrive with the tone turned down warms it like an old amp; a bit of reverb puts it in a room.',
        { ...mfx(AMP.overdrive, { 0: 24, 1: 36, 7: 110 }), ...on([0, 1], { 'PTL.REV_SEND': 46 }) }
      ]
    ]
  },
  {
    id: 'sync',
    name: 'Sync Lead',
    note: 60,
    slate: 0,
    about:
      'Hard sync: one oscillator forced to restart with another, swept by a pitch envelope for that tearing, vocal lead.',
    steps: [
      [
        'wolf',
        'Mono',
        'Sync leads are single-note lines.',
        { 'CMN.MONO_POLY': 0, 'CMN.LEGATO_SW': 1, 'CMN.PORTA_SW': 1, 'CMN.PORTA_TIME': 60 }
      ],
      [
        'grit',
        'Hard sync',
        'Partial 2 is synced to partial 1: it restarts every time partial 1 does, so it always plays partial 1’s pitch, but its own tuning changes the harmonics. Tuned up 19 semitones, it sounds bright and cutting.',
        { ...partials(0, 1), 'SPTL1.OSC_TYPE': 1, 'SPTL1.VA_FORM': 0, 'SPMT.STRUCT12': 1, 'PTL1.PIT_CRS': 19 }
      ],
      [
        'punch',
        'Sweep the synced oscillator',
        'A pitch envelope on the synced partial sweeps its tuning down at the start of each note. With sync, a pitch sweep is heard as the tone tearing through its harmonics: the classic sync sound.',
        {
          'PENV1.DEPTH': 40,
          'PENV1.L0': 400,
          'PENV1.T1': 360,
          'PENV1.L1': 0,
          'PENV1.L2': 0,
          'PENV1.L3': 0,
          'PENV1.L4': 0
        }
      ],
      [
        'space',
        'Open filter, some space',
        'The filter stays mostly open so the sync harmonics come through, with a little delay and reverb.',
        on([0, 1], { 'PTL.CUTOFF': 860, 'AENV.T4': 200, 'PTL.CHO_SEND': 30, 'PTL.REV_SEND': 30 })
      ]
    ]
  }
];
