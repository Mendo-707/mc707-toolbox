// Live Mode's state LV (style, key, tempo, scenes, pads, settings) and saving it.
//
// Owns: LV (Live Mode state).
// Reads: DEV.
import { clamp } from '../core/dom.js';
import { DEV } from '../core/device.js';
import { STYLES } from '../library/styles.js';
import { S } from '../core/state.js';
import { trackOf } from '../core/tracks.js';
/** How long a part fades in or out at a scene change, in ticks, for each Entry setting ('hard' = 0). */
export const ENTRY_TICKS = { smooth: 32, slow: 64, long: 128, vlong: 256 };

/* ---------- Live Mode ---------- */
const LVK = 'mc707-live';
const LV_LAYOUT = 5;
/* What the MC-707 pads really send on a drum track (measured on hardware): top row 1-8, bottom row 9-16. */
export const LV_DRUM_NOTES = [37, 39, 42, 46, 49, 51, 54, 56, 36, 38, 41, 45, 48, 62, 63, 64];
/* Default: the MC-707 pads numbered 1-8 on the top row and 9-16 on the bottom row, sending 16 notes in order. */
export const LV_ACTS = [
  's0',
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  'brk',
  'sw:drums',
  'sw:bass',
  'sw:chords',
  'sw:lead',
  'fill',
  'stut:8',
  'bd',
  'next'
];
export const LV_ACTS_KBD = [
  's0',
  's1',
  's2',
  's3',
  's4',
  's5',
  's6',
  'brk',
  'prev',
  'sw:drums',
  'sw:bass',
  'bd',
  'fill',
  'stut:8',
  'sw:chords',
  'next'
];
const lvGridNotes = base => Array.from({ length: 16 }, (_, i) => base + i);
export const lvLayoutNotes = () =>
  LV.padLayout === 'kbd'
    ? lvKbdNotes(LV.padBase)
    : LV.padLayout === 'drum'
      ? LV_DRUM_NOTES.slice()
      : lvGridNotes(LV.padBase);
export const LV_KBD_OFF = [0, 2, 4, 5, 7, 9, 11, 12, null, 1, 3, null, 6, 8, 10, null];
export const lvKbdNotes = base => LV_KBD_OFF.map(o => (o == null ? null : base + o));
export const LV_TOPFN = ['Oct −', null, null, 'Step', null, null, null, 'Oct +'];
const LV_SAVE = [
  'mix',
  'style',
  'seed',
  'key',
  'bpm',
  'swing',
  'quant',
  'entry',
  'fills',
  'padNotes',
  'padBase',
  'padLayout',
  'padCh',
  'padFlip',
  'acts',
  'keyBase',
  'muteBase',
  'keyCh',
  'perfOn',
  'layout',
  'autoReps',
  'chaos',
  'ktarget',
  'rest',
  'restV',
  'scBase',
  'riseBars',
  'dropStyle',
  'mode',
  'vary',
  'flavor',
  'buildFx',
  'custom',
  'revRest',
  'brkStyle',
  'brkLen',
  'ctl',
  'homeKey',
  'theme',
  'human',
  'feel',
  'mood'
];
export const LV = Object.assign(
  {
    style: 'liquid',
    seed: 1,
    key: 2,
    bpm: 174,
    swing: 50,
    human: 0,
    feel: 'natural',
    mood: null,
    quant: 4,
    entry: 'smooth',
    fills: true,
    padNotes: [37, 39, 42, 46, 49, 51, 54, 56, 36, 38, 41, 45, 48, 62, 63, 64],
    padBase: 36,
    padLayout: 'drum',
    padCh: 0,
    padFlip: false,
    acts: LV_ACTS.slice(),
    keyBase: 60,
    muteBase: 72,
    keyCh: 0,
    perfOn: true,
    layout: LV_LAYOUT,
    autoReps: 2,
    chaos: 30,
    ktarget: 'all',
    rest: [64, 0, 64, 64],
    scBase: 60,
    riseBars: 4,
    dropStyle: 'gap',
    mode: null,
    vary: 50,
    flavor: 'lively',
    buildFx: true,
    custom: false,
    revRest: 0,
    brkStyle: 'mix',
    brkLen: 32,
    ctl: null,
    homeKey: null,
    theme: 'neon'
  },
  (() => {
    try {
      return JSON.parse(localStorage.getItem(LVK) || '{}') || {};
    } catch (e) {
      return {};
    }
  })(),
  {
    autos: [],
    ccLast: {},
    edIdx: -1,
    scenes: [],
    fillIds: [],
    cur: 0,
    sceneStart: 0,
    voices: Array.from({ length: 8 }, () => []),
    cues: [],
    fill: null,
    mute: {},
    tg: [],
    stopAt: null,
    crash: false,
    ver: 0,
    learn: -1,
    hist: [],
    log: [],
    lastTick: 0,
    lastKey: '',
    auto: false,
    energy: 8,
    rate: 1,
    stut: null,
    rise: null,
    knobs: [64, 0, 64, 64],
    knobsIn: [null, null, null, null],
    pulse: [],
    held: {},
    dropTick: null,
    tapT: [],
    beat: 0
  }
);
/* Live's tempo and swing, read by the transport while Live Mode plays */
export const liveTempo = () => LV.bpm;
export const liveSwingAmt = () => LV.swing;
(function fixLive() {
  if (LV.layout !== LV_LAYOUT) {
    LV.acts = LV_ACTS.slice();
    LV.layout = LV_LAYOUT;
    LV.padFlip = false;
    LV.padLayout = 'drum';
    LV.padBase = 36;
    LV.padCh = 0;
    LV.padNotes = LV_DRUM_NOTES.slice();
  }
  if (!['kbd', 'grid', 'custom', 'drum'].includes(LV.padLayout)) LV.padLayout = 'drum';
  LV.padBase = clamp(Math.round(+LV.padBase || 36), 0, 115);
  if (
    !Array.isArray(LV.padNotes) ||
    LV.padNotes.length !== 16 ||
    LV.padNotes.some(n => n !== null && !Number.isFinite(+n))
  )
    LV.padNotes = lvLayoutNotes();
  if (!Array.isArray(LV.acts) || LV.acts.length !== 16 || LV.acts.some(a => typeof a !== 'string'))
    LV.acts = LV_ACTS.slice();
  if (!LV.acts.includes('brk')) {
    const i = LV.acts.indexOf('s7');
    if (i >= 0) LV.acts[i] = 'brk';
  }
  if (!['mix', 'hits', 'stutter', 'drop', 'roll'].includes(LV.brkStyle)) LV.brkStyle = 'mix';
  if (![16, 32, 64].includes(+LV.brkLen)) LV.brkLen = 32;
  else LV.brkLen = +LV.brkLen;
  if (!STYLES.some(s => s.id === LV.style)) LV.style = 'liquid';
  LV.key = clamp(Math.round(+LV.key || 0), 0, 11);
  LV.bpm = clamp(Math.round(+LV.bpm || 120), 40, 240);
  LV.swing = clamp(+LV.swing || 50, 50, 75);
  if (!(LV.quant === 'phrase' || [1, 2, 4, 8].includes(+LV.quant))) LV.quant = 4;
  else if (LV.quant !== 'phrase') LV.quant = +LV.quant;
  if (!ENTRY_TICKS[LV.entry] && LV.entry !== 'hard') LV.entry = 'smooth';
  LV.keyBase = clamp(Math.round(+LV.keyBase || 60), 0, 115);
  LV.muteBase = clamp(Math.round(+LV.muteBase || 72), 0, 119);
  LV.padCh = clamp(Math.round(+LV.padCh || 0), 0, 16);
  LV.keyCh = clamp(Math.round(+LV.keyCh || 0), 0, 16);
  LV.autoReps = clamp(Math.round(+LV.autoReps || 2), 1, 4);
  LV.chaos = clamp(Math.round(+LV.chaos || 0), 0, 100);
  LV.scBase = clamp(Math.round(+LV.scBase || 60), 0, 112);
  if (!['smooth', 'hard', 'gap'].includes(LV.dropStyle)) LV.dropStyle = 'gap';
  if (!['lively', 'mixed', 'classic'].includes(LV.flavor)) LV.flavor = 'lively';
  if (!LV.mood || !Number.isFinite(+LV.mood.i) || !Number.isFinite(+LV.mood.c)) LV.mood = null;
  else LV.mood = { i: clamp(Math.round(+LV.mood.i), 0, 100), c: clamp(Math.round(+LV.mood.c), 0, 100) };
  LV.vary = clamp(Math.round(Number.isFinite(+LV.vary) ? +LV.vary : 50), 0, 125);
  if (LV.mode !== 'major' && LV.mode !== 'minor') LV.mode = null;
  LV.riseBars = [2, 4, 8].includes(+LV.riseBars) ? +LV.riseBars : 4;
  /* FILTER and FX rest at 64, the centre. 1.0.1 moved FILTER's default to 0: a set still on that default
     goes back to 64 once (restV 3); a rest someone set by hand afterwards stays as they set it. */
  if (Array.isArray(LV.rest) && LV.rest.join() === '64,0,0,64') LV.rest = [64, 0, 64, 64];
  if (!Array.isArray(LV.rest) || LV.rest.length !== 4) LV.rest = [64, 0, 64, 64];
  if (LV.restV !== 3) {
    if (LV.rest.join() === '0,0,64,64') LV.rest = [64, 0, 64, 64];
    LV.restV = 3;
  }
  LV.knobs = LV.rest.slice();
  if (
    !(
      ['all', 'drums', 'tone'].includes(LV.ktarget) ||
      (Number.isInteger(+LV.ktarget) && +LV.ktarget >= 0 && +LV.ktarget < 8)
    )
  )
    LV.ktarget = 'all';
  /* Live Mode's own mixer (live/mix.js): level, pan, reverb and chorus per track; a reverb of null
     follows the Reverb rest setting */
  const arr = (a, d, nul) =>
    Array.from({ length: 8 }, (_, i) => {
      const v = Array.isArray(a) ? a[i] : undefined;
      return nul && v === null ? null : Number.isFinite(+v) && v !== null ? clamp(Math.round(+v), 0, 127) : d;
    });
  const m = LV.mix && typeof LV.mix === 'object' ? LV.mix : {};
  LV.mix = { lvl: arr(m.lvl, 100), pan: arr(m.pan, 64), rev: arr(m.rev, null, true), cho: arr(m.cho, 0) };
  LV.tg = Array.from({ length: 8 }, () => mkEnv(1, 1, 0, 0));
  LV.pulse = Array.from({ length: 8 }, () => ({ time: -9, v: 0 }));
})();
export function saveLive() {
  try {
    const o = {};
    LV_SAVE.forEach(k => (o[k] = LV[k]));
    localStorage.setItem(LVK, JSON.stringify(o));
  } catch (e) {}
}
/* the build track: Drums 3 (perc) with the default setup, else the kit track, else any drum track */
export const lvBT = () => {
  if (DEV === '101') return 0;
  const p = trackOf(2);
  if (p >= 0) return p;
  const k = trackOf(0);
  return k >= 0 ? k : S.tracks.findIndex(x => x.type === 'drum');
};
export const SWG = { drums: [0, 1], perc: [2], bass: [3], chords: [4, 5], pad: [5], lead: [6, 7] };
export const MUG = { drums: [0, 1, 2], bass: [3], chords: [4, 5], lead: [6, 7] };
export const LV_LABEL = {
  'sw:drums': 'New drums',
  'sw:perc': 'New perc',
  'sw:bass': 'New bass',
  'sw:chords': 'New chords',
  'sw:pad': 'New pad',
  'sw:lead': 'New lead',
  fill: 'Fill',
  brk: 'Break',
  'mu:drums': 'Drums out',
  'mu:bass': 'Bass out',
  'mu:chords': 'Chords out',
  'mu:lead': 'Lead out',
  next: 'Next scene',
  prev: 'Previous scene',
  stop: 'Stop at phrase end',
  bd: 'Build → Drop',
  'rise:up': 'Riser up',
  'rise:down': 'Riser down',
  'stut:4': 'Stutter ¼ (hold)',
  'stut:8': 'Stutter ⅛ (hold)',
  'stut:16': 'Stutter 1/16 (hold)',
  'en:up': 'Energy up',
  'en:down': 'Energy down',
  auto: 'Auto-pilot',
  lock: 'Lock loop'
};
export const NOTEN = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteLbl = n => NOTEN[((n % 12) + 12) % 12] + (Math.floor(n / 12) - 1);
export const LV_PRI = [0, 3, 1, 4, 2, 5, 6, 7];
export const lvStyle = () => STYLES.find(s => s.id === LV.style) || STYLES[0];
export const lvRand = a => a[Math.floor(Math.random() * a.length)];
export function envAt(e, tick) {
  return tick >= e.t1 ? e.v1 : tick <= e.t0 ? e.v0 : e.v0 + ((e.v1 - e.v0) * (tick - e.t0)) / (e.t1 - e.t0);
}
export function mkEnv(v0, v1, t0, dur) {
  return { v0, v1, t0, t1: t0 + Math.max(0, dur) };
}
export const lvHue = e => Math.round(215 - e * 19);
