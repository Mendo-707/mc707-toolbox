import { LV, lvStyle, saveLive } from './state.js';
import { lvClearCustom } from './scene-editor.js';
import { lvModeFam } from '../library/pools.js';
import { liveBuild } from './pools.js';

/* ---- Live scenes: loops for performing, not song sections. Each uses a different mix of parts, and parts can sit out bars so the groove breathes. ---- */
export const LV_PLAY = [
  ['all', 'Every bar'],
  ['h1', 'First half'],
  ['h2', 'Second half'],
  ['alt', '2 bars on, 2 off'],
  ['odd', 'Every other bar'],
  ['rest', 'Rests every 4th bar'],
  ['four', 'Only every 4th bar']
];
export function lvPlayOn(p, bar, bars) {
  if (!p || p === 'all' || bars < 2) return true;
  if (p === 'h1') return bar < bars / 2;
  if (p === 'h2') return bar >= bars / 2;
  if (p === 'alt') return bars < 4 ? bar % 2 === 0 : Math.floor(bar / 2) % 2 === 0;
  if (p === 'odd') return bar % 2 === 0;
  if (p === 'rest') return bar % 4 !== 3;
  if (p === 'four') return bar % 4 === 3 || (bars < 4 && bar === bars - 1);
  return true;
}
export function lvMaskOff(t, tick) {
  const sc = LV.scenes[LV.cur],
    c = sc && sc.cells[t];
  if (!c || !c.play || c.play === 'all') return false;
  const rel = tick - LV.sceneStart;
  if (rel < 0) return false;
  const L = sc.bars * 32;
  return !lvPlayOn(c.play, Math.floor((rel % L) / 32), sc.bars);
}
/* name, kind, bars, energy, move, parts {track: set A/B or R (a build on Drums 3) : how often it plays} */
export const LV_TPL = [
  ['Groove', 'groove', 8, 5, null, { 0: 'A', 1: 'A', 2: 'A:alt', 3: 'A', 7: 'A:h2' }],
  ['Lift', 'build', 4, 4, 'build', { 1: 'A', 2: 'R', 4: 'A', 5: 'A', 6: 'A:alt' }],
  ['Peak', 'peak', 8, 9, null, { 0: 'A', 1: 'A', 2: 'A', 3: 'A', 4: 'A:odd', 6: 'A', 7: 'A:h2' }],
  ['Stripped', 'strip', 4, 3, 'wash', { 2: 'B', 5: 'A', 6: 'A:alt' }],
  ['Groove B', 'groove', 8, 6, 'pump', { 0: 'B', 1: 'B', 3: 'B:rest', 4: 'B:alt', 7: 'B' }],
  ['Tool', 'tool', 4, 5, 'filterin', { 0: 'A', 1: 'B', 2: 'B', 3: 'B:alt' }],
  ['Peak B', 'peak', 16, 10, null, { 0: 'B', 1: 'A', 2: 'B', 3: 'B', 4: 'B', 5: 'B:h1', 6: 'B', 7: 'B:alt' }]
];
/* MC-707 with full kits on Drums 1: Drums 3 is free for builds, so Lift keeps its snare build there */
export const LV_TPL1K = [
  ['Groove', 'groove', 8, 5, null, { 0: 'A', 3: 'A', 7: 'A:h2' }],
  ['Lift', 'build', 4, 4, 'build', { 2: 'R', 4: 'A', 5: 'A', 6: 'A:alt' }],
  ['Peak', 'peak', 8, 9, null, { 0: 'A', 3: 'A', 4: 'A:odd', 6: 'A', 7: 'A:h2' }],
  ['Stripped', 'strip', 4, 3, 'wash', { 5: 'A', 6: 'A:alt', 3: 'A:four' }],
  ['Groove B', 'groove', 8, 6, 'pump', { 0: 'B', 3: 'B:rest', 4: 'B:alt', 7: 'B' }],
  ['Tool', 'tool', 4, 5, 'filterin', { 0: 'A', 3: 'B:alt', 7: 'A:alt' }],
  ['Peak B', 'peak', 16, 10, null, { 0: 'B', 3: 'B', 4: 'B', 5: 'B:h1', 6: 'B', 7: 'B:alt' }]
];
/* MC-101: Drums (full kit), Bass, Chords, Lead */
export const LV_TPL101 = [
  ['Groove', 'groove', 8, 5, null, { 0: 'A', 3: 'A' }],
  ['Lift', 'build', 4, 4, 'build', { 4: 'A', 6: 'A:alt' }],
  ['Peak', 'peak', 8, 9, null, { 0: 'A', 3: 'A', 4: 'A:odd', 6: 'A' }],
  ['Stripped', 'strip', 4, 3, 'wash', { 3: 'A:rest', 6: 'A' }],
  ['Groove B', 'groove', 8, 6, 'pump', { 0: 'B', 3: 'B:rest', 4: 'B:alt' }],
  ['Tool', 'tool', 4, 5, 'filterin', { 0: 'A', 3: 'B:alt' }],
  ['Peak B', 'peak', 16, 10, null, { 0: 'B', 3: 'B', 4: 'B', 6: 'B' }]
];
export function liveNewSet(newStyle) {
  if (newStyle) {
    LV.style = newStyle;
    const s2 = lvStyle();
    LV.bpm = s2.bpm[2];
    LV.swing = s2.swing;
    LV.key = s2.keys[0][0];
    LV.mode = lvModeFam(s2.scale);
  }
  lvClearCustom();
  LV.edIdx = -1;
  LV.homeKey = LV.key;
  LV.seed = Math.floor(Math.random() * 1e6) + 1;
  liveBuild();
  saveLive();
}
