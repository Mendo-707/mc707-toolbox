// The Slime Lab's blends: classic synth sounds built only from what you can do in the lab yourself.
// A blend starts with New tone (a fresh tone, saw wave on partial 1), then each step is one lab action:
// choose which partials it Works on, mix in an ingredient at an amount (or 0: leave it out), and set some of
// that ingredient's Dial it in controls. The guide shows each step that way, so any blend can be made by hand.
//
// A step: {ing, amt (0-10; 0 only dials), on (partial 0-3, or all when left out), dial {key: value}, title,
// why}. Dial keys are that ingredient's Dial it in keys (zc-lab-more.js DIALS); 'mfx0'… is the effect's
// parameter 0…; values are in stored units, as the controls set them.
//
// Reads: nothing.

/** The blends. note: the key to taste it on. */
export const BLENDS = [
  {
    id: 'acid',
    name: 'Acid Bass',
    note: 36,
    about: 'The TB-303: one sawtooth voice, sliding between notes, through a resonant filter that snaps shut.',
    steps: [
      {
        ing: 'wolf',
        amt: 5,
        title: 'One voice',
        why: 'The 303 is monophonic, with legato: overlapping notes don’t restart the envelopes.',
        dial: {}
      },
      {
        ing: 'glide',
        amt: 0,
        title: 'Slides',
        why: 'Legato glide means only notes you overlap slide into each other, so the slides are part of how you play the line.',
        dial: { 'CMN.PORTA_SW': 1, 'CMN.PORTA_MODE': 1, 'CMN.PORTA_TIME': 90 }
      },
      { ing: 'abyss', amt: 4, title: 'An octave down', why: 'Acid lines sit in the bass register.', dial: {} },
      {
        ing: 'squelch',
        amt: 0,
        title: 'Low cutoff, high resonance',
        why: 'The cutoff starts low so the envelope has room to sweep it, and the resonance is high enough to whistle. The analog filter model at -18 dB per octave is closer to the 303’s own slope than the standard -24 dB.',
        dial: {
          'SPTL.FILTER_TYPE': 1,
          'SPTL.VCF_TYPE': 1,
          'SPTL.FILTER_SLOPE': 1,
          'PTL.CUTOFF': 280,
          'PTL.RESO': 800,
          'FENV.VSENS': 45
        }
      },
      {
        ing: 'pluck',
        amt: 0,
        title: 'A snappy filter envelope, gated amp',
        why: 'Each note opens the filter at once and closes it in a fraction of a second: the “squelch”. Velocity (above) deepens the sweep, standing in for the 303’s accent. The amp stays at full and cuts off quickly, so the line is tight.',
        dial: {
          'FENV.DEPTH': 44,
          'FENV.T2': 190,
          'FENV.L2': 160,
          'FENV.L3': 110,
          'AENV.T1': 0,
          'AENV.L2': 1023,
          'AENV.L3': 1023,
          'AENV.T4': 70
        }
      },
      {
        ing: 'od',
        amt: 5,
        title: 'Overdrive',
        why: 'Acid is almost always driven: overdrive after the filter makes the resonant peak scream and adds harmonics a small speaker can play.',
        dial: { mfx0: 72, mfx1: 70, mfx7: 96 }
      }
    ]
  },
  {
    id: 'reese',
    name: 'Reese Bass',
    note: 36,
    about: 'Two detuned saws beating against each other: the moving, growling bass of drum and bass.',
    steps: [
      {
        ing: 'layer',
        amt: 5,
        on: 1,
        title: 'A second saw, detuned up',
        why: 'Add a layer copies partial 1 onto partial 2. Tuned 14 cents up, the two saws drift in and out of phase: that slow beating is the Reese.',
        dial: { 'PTL.PIT_FINE': 14 }
      },
      {
        ing: 'shimmer',
        amt: 0,
        on: 0,
        title: 'The first saw, detuned down',
        why: 'Partial 1 goes 14 cents down, so the pair is centred on the note.',
        dial: { 'PTL.PIT_FINE': -14 }
      },
      { ing: 'wolf', amt: 5, title: 'Mono', why: 'One note at a time keeps the low end clean.', dial: {} },
      { ing: 'abyss', amt: 4, title: 'An octave down', why: 'Into bass territory.', dial: {} },
      {
        ing: 'moon',
        amt: 0,
        title: 'Darker',
        why: 'Taking off the top makes the beating felt more than heard, and leaves room for the drums.',
        dial: { 'PTL.CUTOFF': 500, 'PTL.RESO': 140 }
      },
      { ing: 'mist', amt: 0, title: 'Short release', why: 'Basses stop when you let go.', dial: { 'AENV.T4': 140 } },
      {
        ing: 'wobble',
        amt: 0,
        title: 'Slow filter movement',
        why: 'LFO 2 moves the cutoff slowly, synced to one bar, so it breathes with the track.',
        dial: {
          'LFO.LFO2_FORM': 1,
          'LFO.LFO2_RATE_SYNC': 1,
          'LFO.LFO2_RATE_NOTE': 18,
          'LFO.LFO2_TVF_DEPTH': 18
        }
      },
      {
        ing: 'dist',
        amt: 5,
        title: 'Distortion',
        why: 'Distortion thickens the beating and gives the growl.',
        dial: { mfx0: 50, mfx1: 56, mfx7: 90 }
      }
    ]
  },
  {
    id: 'wob',
    name: 'Wobble Bass',
    note: 36,
    about: 'A saw with its filter wobbling in time with the track, over a steady sine sub.',
    steps: [
      { ing: 'wolf', amt: 5, title: 'Mono', why: 'Wobble basses are single notes.', dial: {} },
      { ing: 'abyss', amt: 4, title: 'An octave down', why: 'Low.', dial: {} },
      { ing: 'mist', amt: 0, title: 'Short release', why: 'Tight notes.', dial: { 'AENV.T4': 120 } },
      {
        ing: 'layer',
        amt: 5,
        on: 1,
        title: 'A layer for the sub',
        why: 'Partial 2 becomes a copy, an octave lower and a little quieter: it will be the sub.',
        dial: { 'PTL.PIT_CRS': -12, 'PTL.LEVEL': 110 }
      },
      {
        ing: 'sine',
        amt: 5,
        on: 1,
        title: 'The sub is a sine',
        why: 'A pure sine with no filter movement. The wobble happens above it while the low end stays solid, which is how these basses hit hard on a big system.',
        dial: {}
      },
      {
        ing: 'squelch',
        amt: 0,
        on: 0,
        title: 'Resonant low-pass on the saw',
        why: 'Only partial 1: a low cutoff with some resonance gives the wobble a vowel-like “wow”.',
        dial: { 'PTL.CUTOFF': 300, 'PTL.RESO': 440 }
      },
      {
        ing: 'wobble',
        amt: 0,
        on: 0,
        title: 'The wobble, synced',
        why: 'LFO 2 on the cutoff, locked to the tempo at 1/8 notes, so the wobble is part of the rhythm. Change Rate (note) for another groove: 1/4, 1/8 triplet, 1/16.',
        dial: {
          'LFO.LFO2_FORM': 0,
          'LFO.LFO2_RATE_SYNC': 1,
          'LFO.LFO2_RATE_NOTE': 9,
          'LFO.LFO2_TVF_DEPTH': 70
        }
      },
      {
        ing: 'dist',
        amt: 5,
        title: 'Distortion',
        why: 'Distortion turns the wobble from a wah into a growl.',
        dial: { mfx0: 70, mfx1: 60, mfx7: 86 }
      }
    ]
  },
  {
    id: 'trance',
    name: 'Supersaw Lead',
    note: 60,
    about: 'The JP-8000’s SuperSAW: seven detuned saws in one oscillator, bright and huge.',
    steps: [
      {
        ing: 'ssaw',
        amt: 6,
        title: 'SuperSAW',
        why: 'The SuperSAW oscillator stacks seven saws; Detune spreads them. Around two thirds is the classic trance setting: wide but still in tune.',
        dial: { 'SPTL.SSAW_DETUNE': 92 }
      },
      {
        ing: 'sun',
        amt: 0,
        title: 'Mostly open',
        why: 'A supersaw is about its brightness, so the filter is nearly open.',
        dial: { 'PTL.CUTOFF': 860, 'PTL.RESO': 80 }
      },
      {
        ing: 'bloom',
        amt: 0,
        title: 'A little bite on each note',
        why: 'A small filter envelope brightens the start of each note, then settles.',
        dial: { 'FENV.DEPTH': 14, 'FENV.T2': 320, 'FENV.L2': 700, 'FENV.L3': 650 }
      },
      {
        ing: 'swell',
        amt: 0,
        title: 'Full sustain, medium release',
        why: 'The notes hold at full level and ring on a little, so fast lines blur slightly together.',
        dial: { 'AENV.T1': 10, 'AENV.L3': 1023, 'AENV.T4': 320 }
      },
      {
        ing: 'space',
        amt: 0,
        title: 'Delay and reverb',
        why: 'Trance leads live in big spaces: delay for the echoes between notes, reverb for the room.',
        dial: { 'PTL.CHO_SEND': 50, 'PTL.REV_SEND': 64 }
      }
    ]
  },
  {
    id: 'pad',
    name: 'Dream Pad',
    note: 60,
    about: 'Two detuned layers fading slowly in and out, darkened and gently moving, far away in a chorus and reverb.',
    steps: [
      {
        ing: 'layer',
        amt: 5,
        on: 1,
        title: 'A second layer, detuned up',
        why: 'A copy of the saw on partial 2, 8 cents up.',
        dial: { 'PTL.PIT_FINE': 8 }
      },
      {
        ing: 'tri',
        amt: 5,
        on: 1,
        title: 'The layer is a triangle',
        why: 'A softer wave under the saw: the two drift against each other and the pad shimmers.',
        dial: {}
      },
      {
        ing: 'shimmer',
        amt: 0,
        on: 0,
        title: 'The saw, detuned down',
        why: '8 cents down, so the pair is centred.',
        dial: { 'PTL.PIT_FINE': -8 }
      },
      {
        ing: 'moon',
        amt: 0,
        title: 'Darker',
        why: 'Pads sit behind everything, so the top comes off.',
        dial: { 'PTL.CUTOFF': 560 }
      },
      {
        ing: 'swell',
        amt: 0,
        title: 'Slow in, slow out',
        why: 'A slow attack and a long release turn notes into a wash. Play the chords a little early.',
        dial: { 'AENV.T1': 620, 'AENV.L3': 1023, 'AENV.T4': 640 }
      },
      {
        ing: 'wobble',
        amt: 0,
        title: 'Slow movement',
        why: 'A slow, gentle LFO on the cutoff, so the pad never sits still.',
        dial: { 'LFO.LFO2_FORM': 0, 'LFO.LFO2_RATE_SYNC': 0, 'LFO.LFO2_RATE': 380, 'LFO.LFO2_TVF_DEPTH': 12 }
      },
      { ing: 'chorus', amt: 5, title: 'Chorus', why: 'A chorus effect thickens and widens it.', dial: {} },
      {
        ing: 'space',
        amt: 0,
        title: 'Far away',
        why: 'Plenty of reverb sends it into the distance.',
        dial: { 'PTL.REV_SEND': 84, 'PTL.CHO_SEND': 40 }
      }
    ]
  },
  {
    id: 'brass',
    name: 'Brass Stab',
    note: 60,
    about: 'Two saws with a filter that blooms on each note and opens wider the harder you play: 80s synth brass.',
    steps: [
      {
        ing: 'layer',
        amt: 5,
        on: 1,
        title: 'Two saws, slightly apart',
        why: 'Brass sections are many players slightly out of tune; a second saw 6 cents up gives that richness.',
        dial: { 'PTL.PIT_FINE': 6 }
      },
      {
        ing: 'shimmer',
        amt: 0,
        on: 0,
        title: 'The first, 6 cents down',
        why: 'Centred on the note.',
        dial: { 'PTL.PIT_FINE': -6 }
      },
      {
        ing: 'bloom',
        amt: 0,
        title: 'A filter that blooms',
        why: 'The cutoff starts low and the envelope opens it over a short moment, like the air building in a horn.',
        dial: {
          'PTL.CUTOFF': 500,
          'FENV.DEPTH': 32,
          'FENV.T1': 130,
          'FENV.T2': 330,
          'FENV.L2': 700,
          'FENV.L3': 600
        }
      },
      {
        ing: 'bloom',
        amt: 0,
        title: 'Velocity opens it',
        why: 'Harder hits open the filter further, so the stab responds to how you play.',
        dial: { 'PTL.CUTOFF_VSENS': 50, 'FENV.VSENS': 40 }
      },
      {
        ing: 'swell',
        amt: 0,
        title: 'A quick start and short end',
        why: 'A tiny attack softens the click, and a short release keeps stabs punchy.',
        dial: { 'AENV.T1': 50, 'AENV.L3': 1023, 'AENV.T4': 190 }
      },
      { ing: 'space', amt: 0, title: 'A little room', why: 'Some reverb.', dial: { 'PTL.REV_SEND': 40 } }
    ]
  },
  {
    id: 'pluck',
    name: 'House Pluck',
    note: 60,
    about:
      'A square wave with an instant attack and a fast-closing filter: the plucked riff of house and tropical house.',
    steps: [
      { ing: 'square', amt: 5, title: 'Square wave', why: 'Hollow and woody: it plucks nicely.', dial: {} },
      {
        ing: 'squelch',
        amt: 0,
        title: 'Low cutoff, some resonance',
        why: 'The envelope will open the filter on each note, so it starts low.',
        dial: { 'PTL.CUTOFF': 360, 'PTL.RESO': 170 }
      },
      {
        ing: 'pluck',
        amt: 0,
        title: 'The pluck',
        why: 'The filter opens fully on each note and closes completely within a moment, and the level decays to nothing even while the key is held: bright then dull, like a plucked string.',
        dial: {
          'FENV.DEPTH': 50,
          'FENV.T2': 360,
          'FENV.L2': 0,
          'FENV.L3': 0,
          'AENV.T1': 0,
          'AENV.T2': 420,
          'AENV.L2': 0,
          'AENV.L3': 0,
          'AENV.T4': 300
        }
      },
      {
        ing: 'space',
        amt: 0,
        title: 'Delay and a little reverb',
        why: 'Plucks leave gaps; a delay fills them with echoes that become part of the riff.',
        dial: { 'PTL.CHO_SEND': 56, 'PTL.REV_SEND': 40 }
      }
    ]
  },
  {
    id: 'sub808',
    name: '808 Bass',
    note: 36,
    about: 'A sine with a knock at the start and a long decay, gliding between notes, driven so it cuts through.',
    steps: [
      { ing: 'sine', amt: 5, title: 'Sine wave', why: 'An 808 is a sine: all fundamental.', dial: {} },
      { ing: 'wolf', amt: 5, title: 'Mono', why: 'One note at a time, so notes can slide.', dial: {} },
      {
        ing: 'glide',
        amt: 0,
        title: 'Legato glide',
        why: 'Only overlapping notes slide, so you choose the slides as you play.',
        dial: { 'CMN.PORTA_SW': 1, 'CMN.PORTA_MODE': 1, 'CMN.PORTA_TIME': 260 }
      },
      { ing: 'abyss', amt: 4, title: 'An octave down', why: 'Sub territory.', dial: {} },
      {
        ing: 'punch',
        amt: 5,
        title: 'A knock at the start',
        why: 'Each note starts a little higher and drops to pitch in a moment, heard as the knock at the start of an 808.',
        dial: { 'PENV.DEPTH': 12, 'PENV.L0': 300, 'PENV.T1': 120 }
      },
      {
        ing: 'pluck',
        amt: 0,
        title: 'A long decay',
        why: 'The 808 rings and slowly decays: a bass line and a kick in one.',
        dial: { 'AENV.T2': 760, 'AENV.L2': 700, 'AENV.T3': 760, 'AENV.L3': 0, 'AENV.T4': 300 }
      },
      {
        ing: 'od',
        amt: 5,
        title: 'Drive',
        why: 'A pure sine is almost silent on phones and laptops. Overdrive adds harmonics that suggest the bass where the speaker can’t play it.',
        dial: { mfx0: 56, mfx1: 52, mfx7: 100 }
      }
    ]
  },
  {
    id: 'keys',
    name: 'Lo-fi Keys',
    note: 60,
    about: 'A soft electric piano: triangle body, a bell-like sine above, decaying, wavering in pitch, gently pulsing.',
    steps: [
      { ing: 'tri', amt: 5, title: 'Triangle body', why: 'Soft and round, like a tine piano’s body.', dial: {} },
      {
        ing: 'pluck',
        amt: 0,
        title: 'A piano-like decay',
        why: 'The level fades while the key is held, like a struck note, and stops quickly when released.',
        dial: { 'AENV.T1': 0, 'AENV.T2': 600, 'AENV.L2': 520, 'AENV.T3': 900, 'AENV.L3': 0, 'AENV.T4': 260 }
      },
      { ing: 'moon', amt: 0, title: 'Soft top', why: 'Darker, like an old piano.', dial: { 'PTL.CUTOFF': 520 } },
      {
        ing: 'layer',
        amt: 5,
        on: 1,
        title: 'A bell layer, two octaves up',
        why: 'A copy on partial 2, two octaves up and quiet.',
        dial: { 'PTL.PIT_CRS': 24, 'PTL.LEVEL': 60 }
      },
      {
        ing: 'sine',
        amt: 5,
        on: 1,
        title: 'The bell is a sine',
        why: 'A sine two octaves up gives the tine-like ring of an electric piano.',
        dial: {}
      },
      {
        ing: 'pluck',
        amt: 0,
        on: 1,
        title: 'The bell dies first',
        why: 'The ring decays faster than the body, as on the real thing.',
        dial: { 'AENV.T2': 360, 'AENV.L2': 0, 'AENV.L3': 0, 'AENV.T4': 200 }
      },
      {
        ing: 'drift',
        amt: 0,
        title: 'Worn tape',
        why: 'Analog feel and a little random pitch: every note lands slightly differently.',
        dial: { 'CMN.ANALOG_FEEL': 60, 'PTL.PIT_RND': 8 }
      },
      {
        ing: 'tremolo',
        amt: 0,
        title: 'Tremolo',
        why: 'The level pulses gently in time with the track (1/8 notes), like an electric piano’s tremolo.',
        dial: {
          'LFO.LFO1_FORM': 1,
          'LFO.LFO1_RATE_SYNC': 1,
          'LFO.LFO1_RATE_NOTE': 9,
          'LFO.LFO1_TVA_DEPTH': 22
        }
      },
      {
        ing: 'od',
        amt: 5,
        title: 'Warm amp',
        why: 'A little overdrive with the tone turned down warms it like an old amp.',
        dial: { mfx0: 24, mfx1: 36, mfx7: 110 }
      },
      { ing: 'space', amt: 0, title: 'A room', why: 'Some reverb.', dial: { 'PTL.REV_SEND': 46 } }
    ]
  },
  {
    id: 'sync',
    name: 'Sync Lead',
    note: 60,
    about: 'Hard sync: one oscillator forced to restart with another, swept by a pitch envelope for that tearing lead.',
    steps: [
      { ing: 'wolf', amt: 5, title: 'Mono', why: 'Sync leads are single-note lines.', dial: {} },
      {
        ing: 'glide',
        amt: 0,
        title: 'A little glide',
        why: 'A short glide between notes.',
        dial: { 'CMN.PORTA_SW': 1, 'CMN.PORTA_TIME': 60 }
      },
      {
        ing: 'sync',
        amt: 5,
        title: 'Hard sync',
        why: 'Partial 2 restarts every time partial 1 does, so it plays partial 1’s pitch, but its own tuning changes the harmonics. 19 semitones up is bright and cutting.',
        dial: { 'SPMT.STRUCT12': 1, 'PTL1.PIT_CRS': 19 }
      },
      {
        ing: 'punch',
        amt: 5,
        on: 1,
        title: 'Sweep the synced partial',
        why: 'A pitch envelope on partial 2 sweeps its tuning down at the start of each note. With sync, a pitch sweep is heard as the tone tearing through its harmonics.',
        dial: { 'PENV.DEPTH': 40, 'PENV.L0': 400, 'PENV.T1': 360 }
      },
      {
        ing: 'sun',
        amt: 0,
        title: 'Mostly open',
        why: 'The sync harmonics need an open filter.',
        dial: { 'PTL.CUTOFF': 860 }
      },
      { ing: 'mist', amt: 0, title: 'Short release', why: 'Tight lead lines.', dial: { 'AENV.T4': 200 } },
      {
        ing: 'space',
        amt: 0,
        title: 'Some space',
        why: 'A little delay and reverb.',
        dial: { 'PTL.CHO_SEND': 30, 'PTL.REV_SEND': 30 }
      }
    ]
  }
];
