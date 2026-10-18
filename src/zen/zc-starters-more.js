// More starter tones: step sequences (a riff from one held key, after Benedetto Schiavone's STEP LFO
// template), FM-style sounds from cross modulation, and extra basses. STARTER_MENU sorts every starter
// into the Starters menu's groups.
//
// Reads: nothing (builds new sounds).
import { STARTERS, tone } from './zc-starters.js';
import { SEQ_PATTERNS } from './zc-stepseq.js';

const pat = name => SEQ_PATTERNS.find(p => p[0] === name)[1];
const RATE_1_16 = 6;
/** Make partial i play `notes` (semitones, null = rest) on its STEP LFOs, as zc-stepseq.js does. */
function seq(s, i, notes, shape = 11, rate = RATE_1_16) {
  for (const l of [1, 2]) {
    s('LFO.LFO' + l + '_FORM', 10, i);
    s('LFO.LFO' + l + '_RATE_SYNC', 1, i);
    s('LFO.LFO' + l + '_RATE_NOTE', rate, i);
    s('LFO.LFO' + l + '_STEP_MAX', 15, i);
    s('LFO.LFO' + l + '_KEY_TRIG', 1, i);
  }
  s('LFO.LFO1_PIT_DEPTH', 63, i);
  s('LFO.LFO2_TVA_DEPTH', 100, i);
  notes.forEach((n, j) => {
    s('LFO.LFO1_STEP_' + (j + 1), n == null ? 0 : n * 4, i);
    s('LFO.LFO2_STEP_' + (j + 1), n == null ? -72 : 0, i);
    s('LFO.LFO2_STEP_CURVE_' + (j + 1), shape, i);
  });
  s('SPTL.FENV_LFO_TRIG_SW', 1, i);
  s('SPTL.AENV_LFO_TRIG_SW', 1, i);
}
/* FM-style: partial 2 (sine) cross-modulates partial 1 (sine) at a ratio; partial 2's amp envelope
   sets how bright the note is over time */
function fm(s, ratio, depth, modDecay) {
  s('PMT.PMT2_PTL_SW', 1);
  s('SPTL.OSC_TYPE', 1, 1);
  s('SPTL.VA_FORM', 3);
  s('SPTL.VA_FORM', 3, 1);
  s('SPMT.STRUCT12', 3);
  s('SPMT.XMOD12_DEPTH', depth);
  s('PTL.PIT_CRS', ratio, 1);
  s('AENV.T2', modDecay, 1);
  s('AENV.L2', 0, 1);
  s('AENV.L3', 0, 1);
}

export const MORE_STARTERS = [
  [
    'Seq: acid riff',
    () =>
      tone('SEQ ACID', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('PTL.CUTOFF', 380);
        s('PTL.RESO', 780);
        s('FENV.DEPTH', 40);
        s('FENV.T2', 120);
        s('FENV.L2', 0);
        s('FENV.L3', 0);
        seq(s, 0, pat('Acid run'), 11);
      })
  ],
  [
    'Seq: trance gate',
    () =>
      tone('SEQ GATE', s => {
        s('SPTL.OSC_TYPE', 3);
        s('PTL.CUTOFF', 760);
        s('PTL.REV_SEND', 50);
        seq(s, 0, pat('Trance gate (root)'), 15);
      })
  ],
  [
    'Seq: octave bass',
    () =>
      tone('SEQ OCT BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('SPTL.VA_FORM', 1);
        s('PTL.CUTOFF', 520);
        seq(s, 0, pat('Octave bounce'), 11);
      })
  ],
  [
    'Seq: rolling bass',
    () =>
      tone('SEQ ROLL BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('PTL.CUTOFF', 460);
        s('PTL.RESO', 300);
        seq(s, 0, pat('Rolling bass'), 15);
      })
  ],
  [
    'Seq: two-voice arp',
    () =>
      tone('SEQ ARP 2V', s => {
        s('CMN.MONO_POLY', 0);
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('SPTL.VA_FORM', 2, 1);
        s('PTL.PIT_CRS', 12, 1);
        s('PTL.REV_SEND', 40);
        s('PTL.REV_SEND', 40, 1);
        seq(s, 0, pat('Minor arp up'), 11);
        seq(s, 1, pat('Fifths stab'), 20);
      })
  ],
  [
    'FM: electric piano',
    () =>
      tone('FM EPIANO', s => {
        fm(s, 12, 1800, 420);
        s('AENV.T2', 900);
        s('AENV.L2', 300);
        s('AENV.L3', 0);
        s('AENV.T4', 300);
        s('PTL.REV_SEND', 40);
      })
  ],
  [
    'FM: glass bell',
    () =>
      tone('FM BELL', s => {
        fm(s, 26, 3600, 900);
        s('AENV.T2', 950);
        s('AENV.L2', 0);
        s('AENV.L3', 0);
        s('AENV.T4', 800);
        s('PTL.REV_SEND', 80);
      })
  ],
  [
    'FM: bass',
    () =>
      tone('FM BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        fm(s, 0, 2400, 260);
        s('AENV.T4', 80);
      })
  ],
  [
    'FM: metallic pluck',
    () =>
      tone('FM PLUCK', s => {
        fm(s, 7, 4800, 150);
        s('AENV.T2', 260);
        s('AENV.L2', 0);
        s('AENV.L3', 0);
        s('AENV.T4', 120);
      })
  ],
  [
    'Bass: deep sine sub',
    () =>
      tone('SINE SUB', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -2);
        s('SPTL.VA_FORM', 3);
        s('AENV.T4', 60);
      })
  ],
  [
    'Bass: punchy pluck',
    () =>
      tone('PLUCK BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('PTL.CUTOFF', 260);
        s('PTL.RESO', 260);
        s('FENV.DEPTH', 52);
        s('FENV.T2', 90);
        s('FENV.L2', 0);
        s('FENV.L3', 0);
        s('AENV.T2', 380);
        s('AENV.L2', 0);
        s('AENV.L3', 0);
        s('AENV.T4', 60);
      })
  ]
];

/* every starter's group in the menu (names not listed go under Other) */
const GROUP = {
  Basic: ['Init tone', 'Saw lead', 'Supersaw stack', 'Pluck', 'Noise sweep'],
  Bass: [
    'Square bass',
    'Sub 808',
    'Acid bass',
    'Reese bass',
    'Wobble bass',
    'Bass: deep sine sub',
    'Bass: punchy pluck'
  ],
  'Leads and stabs': ['Brass stab', 'Hoover', 'Sync lead', 'House chord stab'],
  'Pads and strings': ['Warm pad', 'Juno pad', 'Strings', 'PWM pad'],
  'Keys and bells': ['Bell', 'Organ'],
  'Step sequences': MORE_STARTERS.filter(([n]) => n.startsWith('Seq:')).map(([n]) => n),
  'FM-style': MORE_STARTERS.filter(([n]) => n.startsWith('FM:')).map(([n]) => n),
  Drums: ['Kick']
};
/** Every starter, as [group, [[name, make], …]] in menu order. */
export function starterMenu() {
  const all = [...STARTERS, ...MORE_STARTERS],
    used = new Set(),
    out = Object.entries(GROUP).map(([g, names]) => [
      g,
      names
        .map(n => all.find(x => x[0] === n))
        .filter(Boolean)
        .map(x => (used.add(x[0]), x))
    ]);
  const rest = all.filter(x => !used.has(x[0]));
  if (rest.length) out.push(['Other', rest]);
  return out.filter(([, list]) => list.length);
}
