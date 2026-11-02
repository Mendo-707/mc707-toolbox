// Live Mode breaks and flashes: the top-right Break pad (hits, stutter, roll, drop-out) and the
// quick flash breaks auto-pilot adds.
//
// Reads: S, LV, TR.
import { clamp, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { facById } from '../library/index.js';
import { TR, emitNote } from '../services/transport.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { FLASH_RH } from '../library/flash.js';
import { LV, lvBT, lvRand, lvStyle, mkEnv } from './state.js';
import { lvMove, lvUserOwns } from './moves.js';
import { lvModeFam, lvPool } from '../library/pools.js';
import { lvLog } from './engine.js';
import { lvOn, lvSortCues } from './cues.js';
import { kitTrack, toneTracksAll, trackOf, tracksFor } from '../core/tracks.js';

/* ---- Flash: a quick 1-2 bar break. Every part hits the same rhythm with silence in between,
   a roll or run pulls you back, and the loop that was playing slams back in on the downbeat with an impact. ---- */
export const FLPOOL = ['fkit', 'fkit', 'fkit', 'fbass', 'fchords', 'fchords', 'flead', 'flead'];
export function lvFlashIds(st, rid, mode) {
  const want = mode === 'major' ? '(Major)' : '(Minor)',
    out = {};
  [
    [0, 'fkit'],
    [3, 'fbass'],
    [4, 'fchords'],
    [6, 'flead']
  ].forEach(([sl, p]) => {
    const t = trackOf(sl);
    if (t < 0) return;
    const ids = lvPool(st, p).filter(id => {
      const f = facById(id);
      return f && f.flash === rid && (f.type === 'drum' || f.name.endsWith(want));
    });
    if (ids.length) out[t] = { id: ids[0], pool: p };
  });
  return out;
}

/* ---- Break: the top-right pad. A quick, exciting flash (½, 1 or 2 bars) that always lands back in the loop on the downbeat. ---- */
export const LV_BRK = [
  ['mix', 'Mix it up'],
  ['hits', 'Unison hits'],
  ['stutter', 'Stutter'],
  ['roll', 'Snare roll'],
  ['drop', 'Drop-out'],
  ['gate', 'Gate chop'],
  ['half', 'Half-time'],
  ['wash', 'Reverb wash'],
  ['tape', 'Tape stop'],
  ['brake', 'Vinyl brake'],
  ['spin', 'Spinback']
];
/** The breaks that bend the pitch (tape stop and vinyl brake down, spinback up). */
export const LV_BENDS = ['tape', 'brake', 'spin'];
/** The Gate chop's rhythm, a 16th per character: x plays, . is silent. */
export const LV_GATE = 'x.xx.x.xx.x.xxx.';
export const LV_BRKLEN = [
  [16, '½ bar'],
  [32, '1 bar'],
  [64, '2 bars']
];
function lvMakeBreak(kind, len) {
  const st = lvStyle();
  if (kind === 'mix') {
    const x = Math.random();
    /* chances out of 100: unison hits most, the bigger moves now and then */
    const MIX = [
      ['hits', 27],
      ['stutter', 11],
      ['roll', 11],
      ['drop', 10],
      ['gate', 10],
      ['half', 9],
      ['wash', 8],
      ['tape', 6],
      ['brake', 4],
      ['spin', 4]
    ];
    let acc = 0;
    kind = MIX.find(([, w]) => (acc += w / 100) > x)?.[0] || 'hits';
  }
  /* a tape stop needs a bar to wind down: a vinyl brake in half a bar */
  if (kind === 'tape' && len < 32) kind = 'brake';
  if (kind === 'drop' && len < 32) kind = 'roll';
  const b = { kind, len, v: {} };
  if (kind === 'hits') {
    const opts = FLASH_RH.filter(R => R[2] * 32 <= Math.max(32, len)),
      R = lvRand(opts.length ? opts : FLASH_RH);
    const cells = lvFlashIds(st, R[0], LV.mode || lvModeFam(st.scale));
    for (const t in cells) {
      const f = facById(cells[t].id);
      if (f) b.v[t] = { f };
    }
    if (Object.keys(b.v).length) {
      b.rh = R[0];
      b.name = R[1];
    } else b.kind = 'roll';
  }
  if (kind === 'wash' && len < 32) kind = b.kind = 'gate';
  b.name =
    b.name ||
    {
      stutter: 'Stutter',
      roll: 'Snare roll',
      drop: 'Drop-out',
      gate: 'Gate chop',
      half: 'Half-time',
      wash: 'Reverb wash',
      tape: 'Tape stop',
      brake: 'Vinyl brake',
      spin: 'Spinback'
    }[b.kind];
  return b;
}
export function liveBreak(kind) {
  if (!lvOn()) {
    toast('Press Start Jam first, then hit Break');
    return;
  }
  const pend = LV.cues.find(c => c.type === 'brk');
  if (pend) {
    LV.cues = LV.cues.filter(c => c !== pend);
    LV.ver++;
    toast('Break cancelled');
    return;
  }
  if (LV.flash && LV.flash.end > TR.tick) {
    toast('A break is already playing');
    return;
  }
  /* it lands on the next bar line (a 2-bar break on the next even bar of the phrase) */
  const len = LV.brkLen || 32,
    U = Math.max(32, len),
    base = LV.sceneStart || 0,
    end = base + Math.ceil((TR.tick + 2 + len - base) / U) * U;
  lvQueueBreak(lvMakeBreak(kind || LV.brkStyle, len), end - len);
}
function lvQueueBreak(b, tick) {
  const end = tick + b.len;
  LV.cues = LV.cues.filter(
    c =>
      c.type !== 'brk' &&
      !(c.type === 'fill' && c.tick + 32 > tick && c.tick < end) &&
      !((c.type === 'gap' || c.type === 'thin') && c.tick >= tick && c.tick < end)
  );
  LV.cues.forEach(c => {
    if (c.tick > tick && c.tick < end && c.type !== 'moves') c.tick = end;
  });
  LV.cues.push({ type: 'brk', b, tick });
  lvSortCues();
  LV.ver++;
  return true;
}
export function lvBreakStart(b, tick) {
  b.start = tick;
  b.end = tick + b.len;
  b.loop = b.kind !== 'hits';
  b.keep = ['stutter', 'gate', 'half', 'wash', ...LV_BENDS].includes(b.kind)
    ? [0, 1, 2, 3, 4, 5, 6, 7]
    : b.kind === 'drop'
      ? tracksFor([4, 5, 6, 7])
      : [];
  if (b.kind === 'hits')
    for (const t in b.v) {
      const P = b.v[t].f.bars * 32;
      b.v[t].start = b.end - P * Math.ceil(b.len / P);
      b.v[t].env = mkEnv(1, 1, tick, 0);
    }
  LV.flash = b;
  LV.fill = null;
  LV.bov = null;
  if (LV.buildFx) {
    if (b.kind === 'drop')
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: tracksFor([4, 5, 6, 7]),
        cc: 91,
        kind: 'ramp',
        from: 'rest',
        to: 112,
        curve: 'exp',
        start: tick,
        end: b.end
      });
    else if (b.kind === 'roll')
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: toneTracksAll(),
        cc: 91,
        kind: 'ramp',
        from: 118,
        to: 'rest',
        curve: 'log',
        start: tick,
        end: b.end
      });
    else if (b.kind === 'wash')
      /* the one hit rings out in a wall of reverb, which falls back as the loop returns */
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: [0, 1, 2, 3, 4, 5, 6, 7],
        cc: 91,
        kind: 'ramp',
        from: 124,
        to: 'rest',
        curve: 'log',
        start: tick,
        end: b.end
      });
    else if (b.kind === 'half')
      /* half-time sinks: the filter closes a little, and opens again for the return */
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: toneTracksAll(),
        cc: 80,
        kind: 'ramp',
        from: 'rest',
        to: 40,
        curve: 'log',
        start: tick,
        end: b.end
      });
    else if (b.kind === 'tape' || b.kind === 'brake')
      /* the sound darkens as the tape slows, and opens again for the drop */
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: [0, 1, 2, 3, 4, 5, 6, 7],
        cc: 80,
        kind: 'ramp',
        from: 'rest',
        to: 18,
        curve: 'exp',
        start: tick,
        end: tick + Math.round(lvTapeStop(b))
      });
    else if (b.kind === 'spin')
      /* the rewind flies off into reverb, which falls back as the loop drops */
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: [0, 1, 2, 3, 4, 5, 6, 7],
        cc: 91,
        kind: 'ramp',
        from: 120,
        to: 'rest',
        curve: 'log',
        start: tick,
        end: b.end
      });
    else if (b.kind === 'stutter')
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: [0, 1, 2, 3, 4, 5, 6, 7],
        cc: 80,
        kind: 'ramp',
        from: 'rest',
        to: 127,
        curve: 'exp',
        start: tick,
        end: b.end
      });
    else
      lvMove({
        id: 'brkfx',
        tag: 'flash',
        tracks: tracksFor([4, 5, 6, 7]),
        cc: 91,
        kind: 'ramp',
        from: 'rest',
        to: 96,
        curve: 'exp',
        start: tick,
        end: b.end
      });
  }
  lvLog(tick);
}
/*
 * Tape stop, vinyl brake and spinback, tick by tick. The tape stop slows the loop to a stop over three
 * quarters of the break (the brake over two fifths), each step later than the last, notes stretching and the
 * pitch sinking; then silence, and the loop drops back in on the downbeat. The spinback runs the loop
 * backwards at double speed for half the break, the pitch rising, then silence.
 */
/** Where a tape stop or brake comes to a stop, in ticks from the break's start. */
export const lvTapeStop = b => b.len * (b.kind === 'brake' ? 0.4 : 0.75);
/**
 * This tick of a tape stop, brake or spinback: the loop's step to play (ticks from the break's start,
 * negative running backwards) and how fast it is going, or null when nothing plays (between steps, stopped).
 * @returns {{pos:number, rate:number}|null}
 */
export function lvTapeAt(b, fr) {
  if (b.kind === 'spin') return fr < b.len / 2 ? { pos: -2 * (fr + 1), rate: 2 } : null;
  const stop = lvTapeStop(b),
    p = x => x - (x * x) / (2 * stop);
  if (fr >= stop) return null;
  const at = Math.floor(p(fr));
  return fr === 0 || at > Math.floor(p(fr - 1)) ? { pos: at, rate: Math.max(0.15, 1 - fr / stop) } : null;
}
/**
 * The pitch bend for this tick of a tape stop, brake or spinback (0 to 16383, 8192 in the middle), sent to the
 * tone tracks every other tick, and back to the middle once it has stopped.
 */
export function lvTapeBend(b, fr, nt) {
  if (fr % 2 || !MIDI.out) return;
  const stop = b.kind === 'spin' ? b.len / 2 : lvTapeStop(b),
    u = Math.min(1, fr / stop);
  if (u >= 1 && b.bent) return;
  b.bent = u >= 1;
  const v = u >= 1 ? 8192 : b.kind === 'spin' ? Math.round(8192 + 8191 * u * u) : Math.round(8192 - 8192 * u * u);
  const at = nt + (S.midiOffset || 0) / 1000;
  for (const t of toneTracksAll())
    if (!S.tracks[t].mute) sendMidi([0xe0 | (S.tracks[t].ch - 1), v & 127, (v >> 7) & 127], at);
}

/* Snare roll for the Roll and Drop-out breaks: 8ths, then 16ths, then 32nds, getting louder, with a breath of silence before the loop slams back. */
export function lvRollTick(b, tick, nt, td) {
  const t = b.kind === 'roll' ? kitTrack() : lvBT(),
    k = kitTrack();
  if (t < 0 || S.tracks[t].mute || lvUserOwns(t) || tick >= b.end - 2) return;
  const rel = tick - b.start,
    u = rel / b.len,
    step = b.len >= 32 ? (u < 0.5 ? 4 : u < 0.75 ? 2 : 1) : u < 0.5 ? 2 : 1;
  if (b.kind === 'roll' && rel === 0) {
    emitNote(k, 0, 120, nt, td);
    emitNote(k, 9, 110, nt, td * 4);
  }
  if (rel % step === 0) {
    emitNote(t, 2, clamp(Math.round(62 + 60 * u), 1, 127), nt, td);
    if (u > 0.75) emitNote(t, 3, clamp(Math.round(70 + 50 * u), 1, 127), nt, td);
    LV.pulse[t] = { time: nt, v: 1 };
  }
}
/* Auto-pilot and Variation drop a break into the end of a phrase, so the loop returns on the downbeat. */
export function lvAutoFlash(phraseEnd) {
  const sc = LV.scenes[LV.cur];
  if (!sc || sc.e < 5 || LV.flash || LV.cues.some(c => c.type === 'brk')) return false;
  const len = LV.brkLen || 32,
    t = phraseEnd - len;
  if (t <= TR.tick) return false;
  return lvQueueBreak(lvMakeBreak(LV.brkStyle, len), t);
}
