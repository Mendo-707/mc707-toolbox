// The 16 Live pads: press and release, knobs and scatter sent to the MC-707.
//
// Reads: S, LV, MIDI.
import { $, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { MIDI } from '../services/midi.js';
import { LV, MUG } from './state.js';
import { tracksFor } from '../core/tracks.js';
import { lvIsFlash, lvSend, lvTracksFor } from './themes.js';
import { liveBreak } from './breaks.js';
import {
  liveAuto,
  liveBuildDrop,
  liveCue,
  liveEnergy,
  liveFillNow,
  liveKeyCue,
  liveLock,
  liveMute,
  liveRiser,
  liveStopCue,
  liveStutter,
  liveSwap
} from './cues.js';

/* ---- hardware sends: scatter and knobs ---- */
export function scatter(i, on) {
  if (!MIDI.out) {
    if (on) toast('Connect the MC-707 first');
    return;
  }
  const ch = (S.ctrlCh || 16) - 1;
  if (on) {
    LV.held['sc' + i] = 1;
    lvSend([0x90 | ch, LV.scBase + i, 110]);
  } else {
    delete LV.held['sc' + i];
    lvSend([0x80 | ch, LV.scBase + i, 0]);
  }
  const b = $('#lvSc' + i);
  if (b) b.classList.toggle('on', on);
}
export function sendKnob(i, val) {
  LV.knobs[i] = val;
  lvTracksFor(LV.ktarget).forEach(t => lvSend([0xb0 | (S.tracks[t].ch - 1), 80 + i, val]));
  knobUI(i, val);
}
/**
 * Show a knob's value on screen without sending it: the slider, its number, and a bar from its rest
 * position to where it is now (lit while it is away from rest, also during risers and moves).
 */
export function knobUI(i, val) {
  const k = $('#lvKn' + i);
  if (!k) return;
  if (+k.value !== val) k.value = val;
  const box = k.parentNode,
    r = LV.rest[i],
    away = Math.abs(val - r) > 1;
  box.style.setProperty('--r', r / 127);
  box.style.setProperty('--a', Math.min(r, val) / 127);
  box.style.setProperty('--w', Math.abs(val - r) / 127);
  box.classList.toggle('away', away);
  const t = $('#lvKv' + i);
  if (t) t.textContent = away ? val + (val > r ? ' ▲' : ' ▼') : 'rest ' + r;
}
export function knobsRest() {
  for (let i = 0; i < 4; i++) sendKnob(i, LV.rest[i]);
}
/* ---- pads ---- */
export function livePadDown(i) {
  const a = LV.acts[i];
  const b = $('#lvPad' + i);
  if (b) b.classList.add('flash');
  liveActDown(a);
}
/** Press an action: held ones (stutter, scatter) start, the rest run. */
export function liveActDown(a) {
  if (a.startsWith('stut:')) {
    liveStutter(a === 'stut:4' ? 8 : a === 'stut:8' ? 4 : 2, true);
    return;
  }
  if (a.startsWith('sc:')) {
    scatter(+a.slice(3), true);
    return;
  }
  liveAct(a);
}
export function livePadUp(i) {
  const a = LV.acts[i];
  const b = $('#lvPad' + i);
  if (b) b.classList.remove('flash');
  liveActUp(a);
}
/** Let go of a held action (stutter, scatter). */
export function liveActUp(a) {
  if (a.startsWith('stut:')) liveStutter(0, false);
  else if (a.startsWith('sc:')) scatter(+a.slice(3), false);
}
/** Run a pad action by name ('s0'-'s6', 'brk', 'fill', 'bd', 'next', 'sw:bass', 'key:5', …). */
export function liveAct(a) {
  if (/^s\d$/.test(a)) return liveCue(+a.slice(1));
  if (a === 'next' || a === 'prev') {
    const n = LV.scenes.length;
    if (!n) return;
    const base = LV.cues.filter(c => c.type === 'scene').pop();
    let j = base ? base.idx : LV.cur;
    for (let k = 0; k < n; k++) {
      j = (j + (a === 'next' ? 1 : n - 1)) % n;
      if (!lvIsFlash(LV.scenes[j])) break;
    }
    return liveCue(j);
  }
  if (a === 'fill') return liveFillNow();
  if (a === 'brk') return liveBreak();
  if (a === 'stop') return liveStopCue();
  if (a === 'bd') return liveBuildDrop();
  if (a === 'auto') return liveAuto();
  if (a === 'lock') return liveLock();
  if (a === 'rise:up') return liveRiser('up');
  if (a === 'rise:down') return liveRiser('down');
  if (a === 'en:up' || a === 'en:down') {
    const base = LV.cues.filter(c => c.type === 'energy').pop();
    return liveEnergy((base ? base.n : LV.energy) + (a === 'en:up' ? 1 : -1));
  }
  if (a.startsWith('sw:')) return liveSwap(a.slice(3));
  if (a.startsWith('mu:')) return liveMute(tracksFor(MUG[a.slice(3)]));
  if (a.startsWith('mt:')) return liveMute([+a.slice(3)]);
  if (a.startsWith('key:')) return liveKeyCue(+a.slice(4));
}
