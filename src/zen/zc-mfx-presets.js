// Ready-made settings for the most-used MFX types (dotted delay, dub echo, Juno chorus, Leslie, gates,
// filter wobbles, lo-fi and drive). Each preset names its type and the parameters it changes, by the
// names in zc-mfx-data.js and in shown units (list entries by their text); the rest keep the type's
// starting values.
//
// Reads: MFX_TYPES (through zc-mfx.js).
import { NOTES, mfxDefaults, mfxNames, mfxParams, stored } from './zc-mfx.js';

const gate = s => Object.fromEntries([...s].map((c, i) => ['Step ' + (i + 1), c === 'x' ? 127 : c === '-' ? 0 : 64]));
const ramp = (a, b) =>
  Object.fromEntries([...Array(16)].map((_, i) => ['Step ' + (i + 1), Math.round(a + ((b - a) * i) / 15)]));

/** [menu label, type name, {parameter name: shown value}] */
export const MFX_PRESETS = [
  [
    'Delay: dotted 1/8 ping-pong',
    'Delay',
    {
      'Delay Left (sync sw)': 'ON',
      'Delay Left (note)': '1/8.',
      'Delay Right (sync sw)': 'ON',
      'Delay Right (note)': '1/4',
      'Feedback Mode': 'CROSS',
      Feedback: 35,
      'HF Damp': '4000',
      Balance: 25
    }
  ],
  ['Delay: short slapback', 'Delay', { 'Delay Left (msec)': 90, 'Delay Right (msec)': 115, Feedback: 0, Balance: 22 }],
  [
    'Delay: long 1/4 wash',
    'Delay',
    {
      'Delay Left (sync sw)': 'ON',
      'Delay Left (note)': '1/4',
      'Delay Right (sync sw)': 'ON',
      'Delay Right (note)': '1/2',
      Feedback: 55,
      'HF Damp': '2000',
      Balance: 30
    }
  ],
  [
    'Tape echo: dub',
    'Tape Echo',
    {
      Mode: 'M+L',
      'Repeat Rate': 70,
      Intensity: 85,
      Bass: 3,
      Treble: -4,
      'Tape Distortion': 2,
      'W/F Rate': 20,
      'W/F Depth': 20,
      'Echo Level': 100,
      'Direct Level': 127
    }
  ],
  [
    'Reverse delay: swell',
    'Reverse Delay',
    {
      'Rev Delay Time (sync sw)': 'ON',
      'Rev Delay Time (note)': '1/4',
      'Rev Delay Feedback': 30,
      'Rev Delay Level': 110,
      Balance: 40
    }
  ],
  ['Juno chorus I', 'JUNO-106 Chorus', { Mode: 'I', Balance: 50 }],
  ['Juno chorus II', 'JUNO-106 Chorus', { Mode: 'II', Balance: 50 }],
  ['Juno chorus I+II (fast and deep)', 'JUNO-106 Chorus', { Mode: 'I+II', Balance: 50 }],
  ['CE-1: warm chorus', 'CE-1', { Intensity: 90 }],
  ['Space-D: wide stereo', 'Space-D', { 'Rate (Hz)': 0.5, Depth: 60, Balance: 50 }],
  ['Flanger: jet sweep', 'Flanger', { 'Rate (Hz)': 0.2, Depth: 100, Feedback: 60, Balance: 50 }],
  ['Rotary: slow Leslie', 'Rotary', { Speed: 'SLOW' }],
  ['Rotary: fast Leslie', 'Rotary', { Speed: 'FAST' }],
  ['Tremolo: 1/8 chop', 'Tremolo', { 'Mod Wave': 'SQR', 'Rate (sync sw)': 'ON', 'Rate (note)': '1/8', Depth: 110 }],
  [
    'Auto pan: 1/2 bar sweep',
    'Auto Pan',
    { 'Mod Wave': 'SIN', 'Rate (sync sw)': 'ON', 'Rate (note)': '1/2', Depth: 90 }
  ],
  [
    'Slicer: trance gate (1/16)',
    'Slicer',
    { ...gate('xx-xx-x-xx-xx-x-'), 'Rate (sync sw)': 'ON', 'Rate (note)': '1/1', Attack: 12, Mode: 'SLASH' }
  ],
  [
    'Slicer: half-time chop',
    'Slicer',
    { ...gate('x--x--x-x---x-x-'), 'Rate (sync sw)': 'ON', 'Rate (note)': '2/1', Attack: 20, Mode: 'LEGATO' }
  ],
  [
    'Step filter: rising 1/16 sweep',
    'Step Filter',
    {
      ...ramp(10, 120),
      'Rate (sync sw)': 'ON',
      'Rate (note)': '1/1',
      'Filter Type': 'LPF',
      'Filter Slope': '-24',
      'Filter Resonance': 60
    }
  ],
  [
    'Super filter: 1/8 wobble',
    'Super Filter',
    {
      'Filter Type': 'LPF',
      'Filter Slope': '-24',
      'Filter Cutoff': 60,
      'Filter Resonance': 70,
      'Modulation Sw': 'ON',
      'Modulation Wave': 'SIN',
      'Rate (sync sw)': 'ON',
      'Rate (note)': '1/8',
      Depth: 90
    }
  ],
  [
    'Multi mode filter: dark',
    'Multi Mode Filter',
    { 'Filter Type': 'LPF', 'Filter Tone': 90, 'Filter Color': 120, 'Filter Slope': '-24' }
  ],
  ['Bit crusher: 8-bit', 'Bit Crusher', { 'Sample Rate': 70, 'Bit Down': 8, Filter: 90 }],
  [
    'Lo-fi: worn cassette',
    'LOFI Compress',
    { 'Pre Filter Type': '2', 'LoFi Type': '5', 'Post Filter Type': 'LPF', 'Post Filter Cutoff': '4000', Balance: 60 }
  ],
  ['Distortion: gritty bass', 'Distortion', { Drive: 70, Tone: 60, Level: 90 }],
  ['Overdrive: warm', 'Overdrive', { Drive: 40, Tone: 70, Level: 100 }],
  ['Compressor: punch', 'Compressor', { Attack: 20, Release: 40, Threshold: -20, Ratio: '4:1', 'Post Gain': 6 }],
  ['Isolator: no lows', 'Isolator', { 'Boost/Cut Low': -60 }],
  ['Ring mod: metallic', 'Ring Modulator', { Frequency: 90, Balance: 50 }],
  ['Pitch shifter: octave down', 'Pitch Shifter', { Coarse: -12, Balance: 50 }]
];

/**
 * A preset as the MFX type number and its 32 stored slot values. Throws if a name or value does not
 * fit the type (the tests check every preset).
 */
export function mfxPreset(i) {
  const [label, typeName, set] = MFX_PRESETS[i];
  const type = mfxNames().indexOf(typeName);
  if (type < 0) throw new Error(label + ': no MFX type ' + typeName);
  const sps = mfxParams(type),
    vals = mfxDefaults(type);
  for (const [name, val] of Object.entries(set)) {
    const j = sps.findIndex(sp => sp.name === name),
      sp = sps[j];
    if (!sp) throw new Error(label + ': ' + typeName + ' has no ' + name);
    const v = sp.kind === 'L' ? (sp.list === NOTES ? NOTES : sp.list).indexOf(String(val)) : val;
    if (sp.kind === 'L' ? v < 0 : v < sp.lo || v > sp.hi) throw new Error(label + ': ' + name + ' = ' + val);
    vals[j] = stored(sp, v);
  }
  return { type, vals };
}
