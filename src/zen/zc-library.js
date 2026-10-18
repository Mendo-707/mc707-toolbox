// My sounds for the ZenCore editor: tones and kits you save, the last edit of each MC-707 clip, and
// starter tones to build from. Kept in this browser (or the Windows app) under its own key.
//
// Owns: ZLIB (my sounds and the clip memory).
// Reads: localStorage 'mc707-zen'.
import { newSound, pk, soundFrom, soundJSON } from './zc-tone.js';

const KEY = 'mc707-zen';
export const ZLIB = { lib: [], clips: {}, loaded: false };
function load() {
  if (ZLIB.loaded) return;
  ZLIB.loaded = true;
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Array.isArray(o.lib)) ZLIB.lib = o.lib.filter(e => e && typeof e.id === 'string' && soundFrom(e.s));
    if (o.clips && typeof o.clips === 'object') ZLIB.clips = o.clips;
  } catch (e) {}
}
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify({ lib: ZLIB.lib, clips: ZLIB.clips }));
    return true;
  } catch (e) {
    return false;
  }
}
/** My saved sounds, newest first (of one kind when given). */
export function myList(kind) {
  load();
  return ZLIB.lib.filter(e => !kind || e.s.kind === kind);
}
/** Save a sound to My sounds. @returns {boolean} */
export function mySave(snd, name) {
  load();
  ZLIB.lib.unshift({ id: 'z' + Date.now().toString(36), at: Date.now(), s: soundJSON(snd, name) });
  return save();
}
export function myDelete(id) {
  load();
  ZLIB.lib = ZLIB.lib.filter(e => e.id !== id);
  save();
}
/* The last state of each clip's sound, so the editor reopens where you left it even if the MC-707
   cannot be read back. Only the 40 most recent are kept. */
const ck = (kind, t, k) => kind + ':' + t + ':' + k;
export function clipMemory(kind, t, k) {
  load();
  const e = ZLIB.clips[ck(kind, t, k)];
  return e ? soundFrom(e.s) : null;
}
export function rememberClip(snd, t, k) {
  load();
  ZLIB.clips[ck(snd.kind, t, k)] = { at: Date.now(), s: soundJSON(snd) };
  const keys = Object.keys(ZLIB.clips).sort((a, b) => ZLIB.clips[b].at - ZLIB.clips[a].at);
  keys.slice(40).forEach(x => delete ZLIB.clips[x]);
  save();
}

/* ---- starter tones: a clean init, then a few classic shapes on the VA oscillators ---- */
function tone(name, fn) {
  const s = newSound('tone');
  const set = (key, i, id, v) => (s.v[pk(key, i, id)] = v);
  s.v['CMN.NAME'] = name;
  for (let i = 0; i < 4; i++) set('PMT', null, 'PMT' + (i + 1) + '_PTL_SW', i === 0 ? 1 : 0);
  set('SPTL', 0, 'OSC_TYPE', 1);
  fn((id, v, i = 0) =>
    set(
      id.split('.')[0],
      ['CMN', 'PMT', 'SCMN', 'SPMT', 'MFX'].includes(id.split('.')[0]) ? null : i,
      id.split('.')[1],
      v
    )
  );
  return s;
}
export const STARTERS = [
  ['Init tone', () => tone('INIT TONE', () => {})],
  [
    'Saw lead',
    () =>
      tone('SAW LEAD', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.LEGATO_SW', 1);
        s('CMN.PORTA_SW', 1);
        s('CMN.PORTA_TIME', 120);
        s('PTL.CUTOFF', 760);
        s('PTL.RESO', 260);
        s('FENV.DEPTH', 24);
        s('FENV.T2', 420);
        s('FENV.L2', 600);
        s('AENV.T3', 0);
        s('AENV.T4', 260);
        s('PTL.REV_SEND', 30);
      })
  ],
  [
    'Supersaw stack',
    () =>
      tone('SUPERSAW', s => {
        s('SPTL.OSC_TYPE', 3);
        s('SPTL.SSAW_DETUNE', 92);
        s('PTL.CUTOFF', 880);
        s('AENV.T1', 40);
        s('AENV.T4', 520);
        s('PTL.CHO_SEND', 40);
        s('PTL.REV_SEND', 60);
      })
  ],
  [
    'Square bass',
    () =>
      tone('SQUARE BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('SPTL.VA_FORM', 1);
        s('PTL.CUTOFF', 420);
        s('PTL.RESO', 180);
        s('FENV.DEPTH', 30);
        s('FENV.T2', 300);
        s('FENV.L2', 200);
        s('FENV.L3', 150);
        s('AENV.T4', 120);
      })
  ],
  [
    'Sub 808',
    () =>
      tone('SUB 808', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.LEGATO_SW', 1);
        s('CMN.PORTA_SW', 1);
        s('CMN.PORTA_MODE', 1);
        s('CMN.PORTA_TIME', 260);
        s('CMN.OCTAVE', -1);
        s('SPTL.VA_FORM', 3);
        s('PTL.CUTOFF', 1023);
        s('PENV.DEPTH', 12);
        s('PENV.L0', 300);
        s('PENV.T1', 120);
        s('PENV.L1', 0);
        s('PENV.L2', 0);
        s('PENV.L3', 0);
        s('AENV.T2', 760);
        s('AENV.L2', 700);
        s('AENV.L3', 0);
        s('AENV.T3', 760);
        s('AENV.T4', 300);
      })
  ],
  [
    'Pluck',
    () =>
      tone('PLUCK', s => {
        s('PTL.CUTOFF', 380);
        s('PTL.RESO', 160);
        s('FENV.DEPTH', 50);
        s('FENV.T1', 0);
        s('FENV.T2', 360);
        s('FENV.L2', 0);
        s('FENV.L3', 0);
        s('AENV.T2', 420);
        s('AENV.L2', 0);
        s('AENV.L3', 0);
        s('AENV.T4', 300);
        s('PTL.REV_SEND', 40);
      })
  ],
  [
    'Warm pad',
    () =>
      tone('WARM PAD', s => {
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('SPTL.VA_FORM', 2, 1);
        s('PTL.PIT_FINE', -8);
        s('PTL.PIT_FINE', 8, 1);
        for (const i of [0, 1]) {
          s('PTL.CUTOFF', 560, i);
          s('AENV.T1', 620, i);
          s('AENV.T4', 640, i);
          s('LFO.LFO1_TVF_DEPTH', 12, i);
          s('LFO.LFO1_RATE', 380, i);
          s('PTL.REV_SEND', 80, i);
          s('PTL.CHO_SEND', 50, i);
        }
      })
  ],
  [
    'Noise sweep',
    () =>
      tone('NOISE SWEEP', s => {
        s('SPTL.OSC_TYPE', 4);
        s('PTL.FILTER_TYPE', 2);
        s('PTL.CUTOFF', 200);
        s('PTL.RESO', 500);
        s('FENV.DEPTH', 50);
        s('FENV.T1', 820);
        s('FENV.L1', 1023);
        s('AENV.T1', 300);
        s('AENV.T4', 700);
        s('PTL.REV_SEND', 90);
      })
  ],
  [
    'Acid bass',
    () =>
      tone('ACID BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.LEGATO_SW', 1);
        s('CMN.PORTA_SW', 1);
        s('CMN.PORTA_MODE', 1);
        s('CMN.PORTA_TIME', 90);
        s('CMN.OCTAVE', -1);
        s('PTL.CUTOFF', 300);
        s('PTL.RESO', 820);
        s('FENV.DEPTH', 42);
        s('FENV.T2', 180);
        s('FENV.L2', 150);
        s('FENV.L3', 100);
        s('AENV.T4', 80);
      })
  ],
  [
    'Reese bass',
    () =>
      tone('REESE BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('PTL.PIT_FINE', -14);
        s('PTL.PIT_FINE', 14, 1);
        for (const i of [0, 1]) {
          s('PTL.CUTOFF', 520, i);
          s('PTL.RESO', 120, i);
          s('AENV.T4', 140, i);
        }
      })
  ],
  [
    'Wobble bass',
    () =>
      tone('WOBBLE BASS', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.OCTAVE', -1);
        s('PTL.CUTOFF', 300);
        s('PTL.RESO', 420);
        s('LFO.LFO1_FORM', 0);
        s('LFO.LFO1_RATE_SYNC', 1);
        s('LFO.LFO1_RATE_NOTE', 9);
        s('LFO.LFO1_TVF_DEPTH', 70);
        s('AENV.T4', 120);
      })
  ],
  [
    'Juno pad',
    () =>
      tone('JUNO PAD', s => {
        s('SPTL.VA_FORM', 5);
        s('SCMN.UNISON_SW', 1);
        s('SCMN.UNISON_SIZE', 4);
        s('SCMN.UNISON_DETN', 30);
        s('PTL.CUTOFF', 640);
        s('AENV.T1', 520);
        s('AENV.T4', 620);
        s('PTL.CHO_SEND', 80);
        s('PTL.REV_SEND', 70);
      })
  ],
  [
    'Strings',
    () =>
      tone('STRINGS', s => {
        s('SPTL.OSC_TYPE', 3);
        s('SPTL.SSAW_DETUNE', 50);
        s('PTL.CUTOFF', 700);
        s('AENV.T1', 420);
        s('AENV.T4', 520);
        s('PTL.CHO_SEND', 40);
        s('PTL.REV_SEND', 60);
      })
  ],
  [
    'Brass stab',
    () =>
      tone('BRASS STAB', s => {
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('PTL.PIT_FINE', -6);
        s('PTL.PIT_FINE', 6, 1);
        for (const i of [0, 1]) {
          s('PTL.CUTOFF', 520, i);
          s('FENV.DEPTH', 30, i);
          s('FENV.T1', 120, i);
          s('FENV.T2', 320, i);
          s('FENV.L2', 700, i);
          s('AENV.T1', 60, i);
          s('AENV.T4', 200, i);
        }
      })
  ],
  [
    'Hoover',
    () =>
      tone('HOOVER', s => {
        s('CMN.MONO_POLY', 0);
        s('CMN.PORTA_SW', 1);
        s('CMN.PORTA_TIME', 200);
        s('SPTL.OSC_TYPE', 3);
        s('SPTL.SSAW_DETUNE', 110);
        s('PENV.DEPTH', 30);
        s('PENV.L0', -150);
        s('PENV.T1', 160);
        s('PENV.L1', 0);
        s('PTL.CUTOFF', 820);
        s('PTL.CHO_SEND', 60);
      })
  ],
  [
    'Sync lead',
    () =>
      tone('SYNC LEAD', s => {
        s('CMN.MONO_POLY', 0);
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('SPMT.STRUCT12', 1);
        s('PTL.PIT_CRS', 19, 1);
        for (const i of [0, 1]) {
          s('PTL.CUTOFF', 860, i);
          s('AENV.T4', 200, i);
        }
        s('PTL.REV_SEND', 30);
      })
  ],
  [
    'Bell',
    () =>
      tone('BELL', s => {
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('SPTL.VA_FORM', 3);
        s('SPTL.VA_FORM', 3, 1);
        s('SPMT.STRUCT12', 2);
        s('PTL.PIT_CRS', 19, 1);
        for (const i of [0, 1]) {
          s('AENV.T2', 700, i);
          s('AENV.L2', 0, i);
          s('AENV.L3', 0, i);
          s('AENV.T4', 600, i);
          s('PTL.REV_SEND', 70, i);
        }
      })
  ],
  [
    'Organ',
    () =>
      tone('ORGAN', s => {
        s('PMT.PMT2_PTL_SW', 1);
        s('PMT.PMT3_PTL_SW', 1);
        [0, 12, 19].forEach((crs, i) => {
          s('SPTL.OSC_TYPE', 1, i);
          s('SPTL.VA_FORM', 3, i);
          s('PTL.PIT_CRS', crs, i);
          s('PTL.LEVEL', [127, 100, 80][i], i);
          s('AENV.T1', 0, i);
          s('AENV.T4', 40, i);
          s('PTL.CHO_SEND', 60, i);
        });
      })
  ],
  [
    'PWM pad',
    () =>
      tone('PWM PAD', s => {
        s('SPTL.VA_FORM', 1);
        s('SPTL.PWM_DEPTH', 40);
        s('LFO.LFO1_RATE', 300);
        s('PTL.CUTOFF', 620);
        s('AENV.T1', 560);
        s('AENV.T4', 640);
        s('PTL.CHO_SEND', 60);
        s('PTL.REV_SEND', 70);
      })
  ],
  [
    'House chord stab',
    () =>
      tone('CHORD STAB', s => {
        s('PMT.PMT2_PTL_SW', 1);
        s('SPTL.OSC_TYPE', 1, 1);
        s('PTL.PIT_FINE', -7);
        s('PTL.PIT_FINE', 7, 1);
        for (const i of [0, 1]) {
          s('PTL.CUTOFF', 560, i);
          s('FENV.DEPTH', 36, i);
          s('FENV.T2', 200, i);
          s('FENV.L2', 0, i);
          s('FENV.L3', 0, i);
          s('AENV.T2', 260, i);
          s('AENV.L2', 0, i);
          s('AENV.L3', 0, i);
          s('AENV.T4', 160, i);
          s('PTL.REV_SEND', 50, i);
        }
      })
  ],
  [
    'Kick',
    () =>
      tone('KICK', s => {
        s('CMN.OCTAVE', -1);
        s('SPTL.VA_FORM', 3);
        s('PTL.CUTOFF', 1023);
        s('PENV.DEPTH', 60);
        s('PENV.L0', 511);
        s('PENV.T1', 120);
        s('PENV.L1', 0);
        s('PENV.L2', 0);
        s('PENV.L3', 0);
        s('AENV.T2', 300);
        s('AENV.L2', 0);
        s('AENV.L3', 0);
        s('AENV.T4', 60);
      })
  ]
];
