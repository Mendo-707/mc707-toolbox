// Scatter, in the app: while you hold a Scatter pad, Live Mode plays its own loop out of order, the way the
// MC-707's Scatter does to its loop: repeats, reverses, swaps, skips, speed changes and scrambles. It works on
// the parts the app plays (all of them, the drums or the melodic parts, as chosen), so it needs nothing set up
// on the MC-707. Letting go puts the loop straight back where it would have been. The MC-707's own Scatter can
// still be played as well (Settings: notes 60-75 on the control channel), for its audio effects.
//
// Each move maps the tick being played to the tick of the loop to play instead (32 ticks a bar, 8 a beat),
// or silence, and how long notes ring (dur, a factor).
//
// Owns: LV.scat (the move held: {i, press, tracks}). Reads: LV, TR.
import { LV } from './state.js';
import { TR } from '../services/transport.js';
import { tracksFor } from '../core/tracks.js';

/** The 16 moves: [id, name, what it does]. */
export const SCATTERS = [
  ['rep4', 'Repeat ¼', 'The beat you hit, over and over'],
  ['rep8', 'Repeat ⅛', 'An eighth over and over'],
  ['rep16', 'Repeat 1/16', 'A sixteenth over and over'],
  ['roll', 'Roll', 'A 32nd roll on the note you hit'],
  ['build', 'Build', 'Repeats getting shorter every beat: ¼, ⅛, 1/16, 1/32'],
  ['dot', 'Dotted', 'A dotted-8th repeat that runs across the beat'],
  ['rev4', 'Reverse beat', 'Each beat played backwards'],
  ['rev1', 'Reverse bar', 'The bar played backwards'],
  ['swap', 'Swap beats', 'Beats 1 and 2, 3 and 4 trade places'],
  ['scram', 'Scramble', 'The bar’s sixteenths in a new order'],
  ['skip', 'Skip', 'Every other sixteenth left out'],
  ['gate', 'Gate', 'Short hits on the eighths only'],
  ['stop', 'Stop-go', 'A beat on, a beat off'],
  ['half', 'Half speed', 'The loop at half speed, notes longer'],
  ['dbl', 'Double', 'The loop at double speed, notes shorter'],
  ['back', 'Backspin', 'The loop rewinding at double speed']
];
export const SCAT_TO = [
  ['all', 'Every part'],
  ['drums', 'Drums'],
  ['tone', 'Melodic parts']
];
/* the bar's sixteenths in a fixed new order (the same every time, so a scramble can be learned) */
const SCRAM = [0, 6, 3, 9, 12, 2, 15, 5, 8, 14, 1, 11, 4, 10, 7, 13];

/** Hold a Scatter pad: the move starts now (on the tick being played), on the parts chosen. */
export function scatDown(i) {
  const kind = SCATTERS[i] && SCATTERS[i][0];
  if (!kind) return;
  const to = LV.scatTo || 'all';
  LV.scat = {
    i,
    kind,
    press: TR.tick,
    tracks:
      to === 'drums' ? tracksFor([0, 1, 2]) : to === 'tone' ? tracksFor([3, 4, 5, 6, 7]) : [0, 1, 2, 3, 4, 5, 6, 7]
  };
  LV.ver++;
}
/** Let go: the loop is back where it would have been (only the move let go of ends). */
export function scatUp(i) {
  if (LV.scat && LV.scat.i === i) LV.scat = null;
  LV.ver++;
}
/**
 * This tick under the move held: {pos, dur} (the loop tick to play, how long notes ring), or {hush: true}.
 * @param {{kind:string, press:number}} s
 * @param {number} tick
 */
export function scatAt(s, tick) {
  const p = s.press,
    rel = tick - p,
    beat = Math.floor(tick / 8) * 8,
    bar = Math.floor(tick / 32) * 32;
  /* a repeat of `len` ticks from where you hit it (snapped to that length) */
  const rep = len => {
    const base = Math.floor(p / len) * len;
    return { pos: base + ((((tick - base) % len) + len) % len), dur: Math.min(1, len / 8) };
  };
  switch (s.kind) {
    case 'rep4':
      return rep(8);
    case 'rep8':
      return rep(4);
    case 'rep16':
      return rep(2);
    case 'roll':
      return { pos: Math.floor(p / 2) * 2, dur: 0.25 };
    case 'build':
      return rep([8, 4, 2, 1][Math.min(3, Math.floor(rel / 8))]);
    case 'dot':
      return rep(6);
    case 'rev4':
      return { pos: beat + 7 - (tick - beat), dur: 0.5 };
    case 'rev1':
      return { pos: bar + 31 - (tick - bar), dur: 0.5 };
    case 'swap':
      return { pos: tick + (Math.floor(tick / 8) % 2 ? -8 : 8), dur: 1 };
    case 'scram': {
      const st = Math.floor((tick - bar) / 2);
      return { pos: bar + SCRAM[st] * 2 + (tick % 2), dur: 0.5 };
    }
    case 'skip':
      return Math.floor(tick / 2) % 2 ? { hush: true } : { pos: tick, dur: 0.5 };
    case 'gate':
      return tick % 4 < 1 ? { pos: tick, dur: 0.3 } : { hush: true };
    case 'stop':
      return Math.floor(rel / 8) % 2 ? { hush: true } : { pos: tick, dur: 1 };
    case 'half':
      return rel % 2 ? { hush: true } : { pos: p + rel / 2, dur: 2 };
    case 'dbl':
      return { pos: p + rel * 2, dur: 0.5 };
    case 'back':
      return { pos: p - rel * 2, dur: 0.4 };
  }
  return { pos: tick, dur: 1 };
}
/** True when the move held changes track t. */
export const scatOn = t => !!(LV.scat && LV.scat.tracks.includes(t));
