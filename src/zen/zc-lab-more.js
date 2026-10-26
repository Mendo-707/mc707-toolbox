// The Slime Lab's Oscillator and Effects ingredients, and the "Dial it in" controls: for every ingredient,
// the two to five real parameters behind it, so after mixing one in you can set it exactly.
//
// Ingredients here follow zc-lab.js's shape: {id, name, c (colour), tag, brew(b, dose), what, hear, tip}.
// b is the lab's brewer: get/set/add/toward a key, each(fn) over the partials it applies to, free() the
// first partial switched off. Reads: MFX defaults (zc-mfx.js), MFX_PARAMS (zc-tone.js).
import { mfxDefaults, mfxParams } from './zc-mfx.js';
import { MFX_PARAMS } from './zc-tone.js';

/* the tone's MFX as a type: a new type starts from its defaults; set {index: value} on top */
function useFx(b, type, set) {
  if (b.get('MFX.mfxType') !== type) {
    const d = mfxDefaults(type);
    b.set('MFX.mfxType', type);
    MFX_PARAMS.forEach((k, i) => b.set(k, d[i]));
  }
  b.set('MFX.mfxSwitch', 1);
  for (const i in set) b.set(MFX_PARAMS[i], set[i]);
}
const va = (b, p, form) => {
  b.set(p('SPTL') + '.OSC_TYPE', 1);
  b.set(p('SPTL') + '.VA_FORM', form);
};
/* sync and ring modulation work between partials 1 and 2 */
function pair(b, struct, crs) {
  b.set('PMT.PMT1_PTL_SW', 1);
  b.set('PMT.PMT2_PTL_SW', 1);
  if (b.get('SPTL0.OSC_TYPE') !== 1) b.set('SPTL0.OSC_TYPE', 1);
  b.set('SPTL1.OSC_TYPE', 1);
  b.set('SPTL1.VA_FORM', 0);
  b.set('SPMT.STRUCT12', struct);
  b.set('PTL1.PIT_CRS', crs);
}

/** Effect ingredients use these MFX types. */
export const FX_TYPE = { od: 29, dist: 30, crush: 46, chorus: 23, phaser: 11, tape: 44 };

export const OSC_GROUP = [
  'Oscillator',
  [
    {
      id: 'saw',
      name: 'Saw wave',
      c: '#ffb020',
      tag: 'Every harmonic: bright and buzzy.',
      brew: b => b.each(p => va(b, p, 0)),
      what: 'The oscillator makes the raw sound everything else shapes. A sawtooth contains every harmonic, falling off gently, so it sounds bright and buzzy and gives a filter plenty to work with. It is the starting point for strings, brass, leads and most basses.',
      hear: 'Trance leads, string machines, 80s brass, the Reese and acid basses.',
      tip: 'When in doubt, start from a saw and take away with the filter: subtractive synthesis.'
    },
    {
      id: 'square',
      name: 'Square wave',
      c: '#ff6b6b',
      tag: 'Odd harmonics: hollow and woody.',
      brew: b =>
        b.each(p => {
          va(b, p, 1);
          b.set(p('SPTL') + '.PW', 64);
        }),
      what: 'A square wave has only the odd harmonics, which gives it a hollow, woody sound, halfway between a clarinet and an old video game.',
      hear: 'Chiptune, clarinet-like leads, hollow basses, the 303’s other wave.',
      tip: 'An octave-down square under a saw makes a bass thicker without making it muddy.'
    },
    {
      id: 'pwm',
      name: 'Pulse width',
      c: '#ff8fab',
      tag: 'A narrower pulse, moving.',
      brew: (b, d) =>
        b.each(p => {
          va(b, p, 1);
          b.set(p('SPTL') + '.PW', Math.round(64 - 50 * d));
          b.add(p('SPTL') + '.PWM_DEPTH', 30 * d);
        }),
      what: 'A pulse wave is a square whose two halves have different lengths. Narrow pulses sound thin and nasal; moving the width all the time (pulse width modulation, from LFO 1) makes a rich, chorus-like movement without any effect.',
      hear: 'Juno and Prophet pads, string machines, 80s basses.',
      tip: 'PWM speed is LFO 1’s rate: slow for pads, faster for a shimmering lead.'
    },
    {
      id: 'tri',
      name: 'Triangle wave',
      c: '#9ad1ff',
      tag: 'Soft: a few gentle harmonics.',
      brew: b => b.each(p => va(b, p, 2)),
      what: 'A triangle has only odd harmonics, and they fall away fast: soft, round and flute-like, with little for a filter to take away.',
      hear: 'Flutes, soft leads, gentle keys, sub layers.',
      tip: 'Triangles cut through less than saws, which is useful for parts that should sit back.'
    },
    {
      id: 'sine',
      name: 'Sine wave',
      c: '#e0f7ff',
      tag: 'Pure: no harmonics at all.',
      brew: b => b.each(p => va(b, p, 3)),
      what: 'A sine is a single frequency with no harmonics: the purest tone. Filters do nothing to it. It is all fundamental, which is why sub basses and 808s are built on it.',
      hear: 'Sub bass, 808s, whistles, bell partials, FM-style tones.',
      tip: 'Sines are nearly invisible on small speakers. Add drive, or layer a brighter wave on top, so the note can be heard everywhere.'
    },
    {
      id: 'ssaw',
      name: 'SuperSAW',
      c: '#ffd166',
      tag: 'Seven detuned saws in one.',
      brew: (b, d) =>
        b.each(p => {
          b.set(p('SPTL') + '.OSC_TYPE', 3);
          b.toward(p('SPTL') + '.SSAW_DETUNE', 50 + 70 * d, 1);
        }),
      what: 'The SuperSAW oscillator (from the JP-8000) plays seven saws at once, spread apart by its Detune. It is a huge sound from a single oscillator, without using up extra voices the way unison does.',
      hear: 'Trance, big room EDM, anthem chords.',
      tip: 'Detune sets the size: low is a thick saw, high is a wide wall of sound.'
    },
    {
      id: 'noise',
      name: 'Noise layer',
      c: '#cfcfcf',
      tag: 'Air and breath on a spare partial.',
      brew: (b, d) => {
        const i = b.free();
        if (i == null) return;
        b.set('PMT.PMT' + (i + 1) + '_PTL_SW', 1);
        b.set('SPTL' + i + '.OSC_TYPE', 4);
        b.set('PTL' + i + '.LEVEL', Math.round(30 + 50 * d));
        b.set('PTL' + i + '.FILTER_TYPE', 3);
        b.set('PTL' + i + '.CUTOFF', 600);
      },
      what: 'Noise has every frequency at once, at random. A little, high-passed, on a spare partial adds air and breath to a sound, like the hiss of a flute or a bow on a string. With a short envelope it becomes a click at the start of each note.',
      hear: 'Breathy pads and flutes, risers, snares and hi-hats built from scratch.',
      tip: 'Give the noise partial its own short amp envelope (Amp tab, that partial) for a percussive attack.'
    },
    {
      id: 'sync',
      name: 'Hard sync',
      c: '#ff5d8f',
      tag: 'Partial 2 locked to partial 1.',
      brew: (b, d) => pair(b, 1, Math.round(5 + 19 * d)),
      what: 'Hard sync restarts partial 2’s wave every time partial 1’s does. Partial 2 then always plays partial 1’s pitch, but its own tuning changes the harmonics, giving a hard, tearing edge. Sweep partial 2’s pitch (a pitch envelope on it) and the tone rips through its harmonics.',
      hear: 'The Cars’ and Prophet-5 sync leads, screaming solos.',
      tip: 'The tuning amount here is the brightness. Dial it in below, and try a pitch envelope on partial 2.'
    },
    {
      id: 'ring',
      name: 'Ring mod',
      c: '#b8f2e6',
      tag: 'Metallic, bell-like clang.',
      brew: (b, d) => pair(b, 2, Math.round(3 + 16 * d)),
      what: 'Ring modulation multiplies partials 1 and 2. Instead of their pitches you hear their sum and difference, which are rarely in tune with each other: metallic, bell-like, alien.',
      hear: 'Bells, gongs, robot voices, sci-fi effects.',
      tip: 'Partial 2’s tuning decides the clang: fifths and octaves are bell-like, odd intervals are harsh.'
    }
  ]
];

export const FX_GROUP = [
  'Effects',
  [
    {
      id: 'od',
      name: 'Overdrive',
      c: '#ff9f43',
      tag: 'Warm drive: the tone’s MFX.',
      brew: (b, d) => useFx(b, FX_TYPE.od, { 0: Math.round(30 + 90 * d), 7: 100 }),
      what: 'Overdrive squeezes the peaks of the wave, gently at first, adding harmonics: warmth at low drive, crunch at high. It is the tone’s own effect (MFX), so it replaces whatever MFX the tone had.',
      hear: 'Organs through amps, driven basses, gritty leads.',
      tip: 'Drive adds level too: turn the effect’s Level down as you turn Drive up.'
    },
    {
      id: 'dist',
      name: 'Distortion',
      c: '#ef476f',
      tag: 'Hard clipping: aggressive.',
      brew: (b, d) => useFx(b, FX_TYPE.dist, { 0: Math.round(30 + 90 * d), 7: 92 }),
      what: 'Distortion clips the wave hard, adding many harmonics: aggressive, fuzzy, loud. Before a filter it would be smoothed; after the oscillator and filter, as here, it is raw.',
      hear: 'Growling basses, industrial, distorted leads.',
      tip: 'Distortion on chords turns them to mush (all the notes intermodulate). Use it on single notes.'
    },
    {
      id: 'crush',
      name: 'Bit crush',
      c: '#a0c4ff',
      tag: 'Lo-fi: fewer bits, lower rate.',
      brew: (b, d) => useFx(b, FX_TYPE.crush, { 0: Math.round(20 + 80 * d), 1: Math.round(2 + 10 * d) }),
      what: 'Digital audio is samples (how often) and bits (how finely). The bit crusher lowers both: fewer bits add a gritty noise, a lower sample rate adds whistling, metallic aliasing. It sounds like old samplers and games.',
      hear: 'Lo-fi hip hop, chiptune, 90s samplers.',
      tip: 'A little is character, a lot is destruction. Dial Sample Rate and Bit Down separately below.'
    },
    {
      id: 'chorus',
      name: 'Chorus',
      c: '#90e0ef',
      tag: 'Thick and wide.',
      brew: (b, d) => useFx(b, FX_TYPE.chorus, { 6: Math.round(40 + 80 * d), 10: 50 }),
      what: 'A chorus mixes the sound with copies of itself, slightly delayed and wobbling in pitch: it thickens and widens, like several players at once.',
      hear: 'Juno pads, clean guitars, 80s keys.',
      tip: 'Chorus on a bass widens the low end, which can make it weaker on a club system. Keep basses dry.'
    },
    {
      id: 'phaser',
      name: 'Phaser',
      c: '#c77dff',
      tag: 'A sweeping, whooshing notch.',
      brew: (b, d) => useFx(b, FX_TYPE.phaser, { 5: Math.round(40 + 80 * d), 7: Math.round(30 + 70 * d) }),
      what: 'A phaser cuts a few narrow notches in the spectrum and sweeps them up and down, so the sound whooshes like a jet. Resonance makes the notches sharper and the sweep more obvious.',
      hear: 'String machines, 70s electric pianos, psychedelic guitars.',
      tip: 'Slow phasing on a pad or a string machine is instant 70s.'
    },
    {
      id: 'tape',
      name: 'Tape echo',
      c: '#e9c46a',
      tag: 'Warm repeats that wobble.',
      brew: (b, d) => useFx(b, FX_TYPE.tape, { 2: Math.round(30 + 60 * d), 11: Math.round(50 + 60 * d) }),
      what: 'A tape echo (like the Roland Space Echo) records the sound on a loop of tape and plays it back a moment later, again and again, each repeat darker and wobblier than the last.',
      hear: 'Dub, reggae, ambient, psychedelic leads.',
      tip: 'Intensity is the feedback: past a point the repeats build on themselves and run away. That is the dub trick.'
    }
  ]
];

/**
 * Dial it in: per ingredient, the parameters behind it. A string 'BLK.ID' is a partial parameter (set on
 * the partials the lab applies to) or a common one (CMN, SCMN, SPMT, PMT); {mfx: i} is the effect's
 * parameter i (shown when the tone's effect is that ingredient's type).
 */
export const DIALS = {
  sun: ['PTL.CUTOFF', 'PTL.CUTOFF_KF', 'PTL.RESO'],
  moon: ['PTL.CUTOFF', 'PTL.CUTOFF_KF'],
  squelch: ['PTL.RESO', 'PTL.CUTOFF', 'FENV.DEPTH', 'FENV.T2', 'FENV.VSENS'],
  bloom: ['FENV.DEPTH', 'FENV.T1', 'FENV.T2', 'FENV.L3', 'PTL.CUTOFF_VSENS'],
  ghost: ['PTL.FILTER_TYPE', 'PTL.CUTOFF', 'PTL.RESO'],
  hush: ['PTL.RESO', 'CMN.ANALOG_FEEL', 'SPTL.FAT'],
  pluck: ['AENV.T2', 'AENV.L3', 'AENV.T4', 'FENV.DEPTH', 'FENV.T2'],
  swell: ['AENV.T1', 'AENV.L3', 'AENV.T4'],
  mist: ['AENV.T4', 'FENV.T4'],
  punch: ['PENV.DEPTH', 'PENV.L0', 'PENV.T1', 'AENV.T1'],
  wobble: ['LFO.LFO2_TVF_DEPTH', 'LFO.LFO2_FORM', 'LFO.LFO2_RATE_SYNC', 'LFO.LFO2_RATE_NOTE', 'LFO.LFO2_RATE'],
  vibrato: ['LFO.LFO1_PIT_DEPTH', 'LFO.LFO1_RATE', 'LFO.LFO1_DELAY', 'LFO.LFO1_FADE'],
  tremolo: ['LFO.LFO1_TVA_DEPTH', 'LFO.LFO1_FORM', 'LFO.LFO1_RATE_SYNC', 'LFO.LFO1_RATE_NOTE', 'LFO.LFO1_RATE'],
  swirl: ['LFO.LFO2_PAN_DEPTH', 'LFO.LFO2_RATE_SYNC', 'LFO.LFO2_RATE_NOTE', 'LFO.LFO2_RATE'],
  quick: ['LFO.LFO1_RATE', 'LFO.LFO2_RATE'],
  sloth: ['LFO.LFO1_RATE', 'LFO.LFO2_RATE'],
  abyss: ['CMN.OCTAVE', 'PTL.PIT_CRS'],
  feather: ['CMN.OCTAVE', 'PTL.PIT_CRS'],
  wolf: ['CMN.MONO_POLY', 'CMN.LEGATO_SW'],
  glide: ['CMN.PORTA_SW', 'CMN.PORTA_MODE', 'CMN.PORTA_TIME'],
  drift: ['CMN.ANALOG_FEEL', 'PTL.PIT_RND', 'PTL.PIT_FINE'],
  swarm: ['SCMN.UNISON_SW', 'SCMN.UNISON_SIZE', 'SCMN.UNISON_DETN'],
  giant: ['PTL.PAN', 'PTL.PAN_RND', 'PTL.STEREO_WIDTH'],
  shimmer: ['PTL.PIT_FINE', 'PTL.STEREO_DETN'],
  grit: ['PTL.FXM_SW', 'PTL.FXM_DEPTH', 'SPTL.FAT', 'CMN.ANALOG_FEEL'],
  space: ['PTL.REV_SEND', 'PTL.CHO_SEND'],
  saw: ['SPTL.OSC_TYPE', 'SPTL.VA_FORM', 'SPTL.FAT'],
  square: ['SPTL.VA_FORM', 'SPTL.PW', 'SPTL.PWM_DEPTH'],
  pwm: ['SPTL.PW', 'SPTL.PWM_DEPTH', 'LFO.LFO1_RATE'],
  tri: ['SPTL.VA_FORM'],
  sine: ['SPTL.VA_FORM', 'PTL.PIT_CRS'],
  ssaw: ['SPTL.OSC_TYPE', 'SPTL.SSAW_DETUNE'],
  noise: ['PTL.LEVEL', 'PTL.FILTER_TYPE', 'PTL.CUTOFF', 'AENV.T2', 'AENV.L3'],
  sync: ['SPMT.STRUCT12', 'PTL1.PIT_CRS', 'PENV1.DEPTH', 'PENV1.L0', 'PENV1.T1'],
  ring: ['SPMT.STRUCT12', 'PTL1.PIT_CRS', 'PTL1.PIT_FINE'],
  od: [{ mfx: 0 }, { mfx: 1 }, { mfx: 7 }],
  dist: [{ mfx: 0 }, { mfx: 1 }, { mfx: 7 }],
  crush: [{ mfx: 0 }, { mfx: 1 }, { mfx: 2 }, { mfx: 5 }],
  chorus: [{ mfx: 4 }, { mfx: 6 }, { mfx: 10 }],
  phaser: [{ mfx: 0 }, { mfx: 3 }, { mfx: 5 }, { mfx: 7 }, { mfx: 9 }],
  tape: [{ mfx: 0 }, { mfx: 1 }, { mfx: 2 }, { mfx: 11 }]
};
/** The MFX type an effect ingredient uses (null for the others). */
export const fxOf = id => FX_TYPE[id] ?? null;
/** An MFX parameter of a type, as {name, kind, lo, hi, list, dec, unit} (null when there is none). */
export const fxParam = (type, i) => mfxParams(type)[i] || null;
