// Recording notes into a pattern from a MIDI keyboard, the MC-707 pads or the computer keyboard.
//
// Reads: S, ED, TR, REC, MIDI, AU.
// Calls up the layers through hooks (core/hooks.js).
import { clamp, el, toast } from '../core/dom.js';
import { ED, S, curClip, pushUndo } from '../core/state.js';
import { scheduleUI } from './arrangement.js';
import { patOf, touch } from '../core/song-model.js';
import { drawEditor } from './editor.js';
import { AU } from '../services/synth.js';
import { MIDI } from '../services/midi.js';
import { REC, TR, emitNote, startPat, stopPlay, tickDur } from '../services/transport.js';
import { renderEdHead } from './editor-head.js';
import { hooks } from '../core/hooks.js';

const KEYMAP_TONE = {
  a: 0,
  w: 1,
  s: 2,
  e: 3,
  d: 4,
  f: 5,
  t: 6,
  g: 7,
  y: 8,
  h: 9,
  u: 10,
  j: 11,
  k: 12,
  o: 13,
  l: 14,
  p: 15,
  ';': 16
};
const KEYMAP_DRUM = { a: 0, s: 2, d: 4, f: 5, g: 3, h: 1, j: 6, k: 7, l: 8, q: 9, w: 10, e: 11 };
function recStepNow(at) {
  const v = TR.vis[0];
  if (!v) return 0;
  return Math.max(0, (v.tick + (at - v.time) / (v.dur || tickDur())) / 2);
}
function recNoteOn(key, nn, vel, at) {
  const p = REC.pat;
  if (!p) return;
  emitNote(REC.ti, nn, vel, AU.ctx.currentTime + 0.005, 0.2, true);
  const N = p.bars * 16,
    drum = p.type === 'drum';
  if (REC.mode === 'step') {
    const now = performance.now();
    let pos;
    if (now - REC.lastT < 80) pos = REC.chordPos;
    else {
      pos = REC.cur % N;
      REC.chordPos = pos;
      REC.cur = (pos + (drum ? 1 : Math.max(1, ED.snap >= 1 ? ED.snap : 1))) % N;
    }
    REC.lastT = now;
    p.notes = p.notes.filter(n => !(n.n === nn && Math.abs(n.s - pos) < 0.01));
    p.notes.push({
      s: pos,
      l: drum ? 1 : Math.max(1, ED.snap >= 1 ? ED.snap : 1),
      n: nn,
      v: clamp(vel, 1, 127)
    });
    touch(p);
    drawEditor();
    return;
  }
  const raw = recStepNow(at),
    q = REC.quant;
  REC.held[key] = { nn, vel, raw, s: (((Math.round(raw / q) * q) % N) + N) % N };
}
function recNoteOff(key, at) {
  const h = REC.held[key];
  if (!h) return;
  delete REC.held[key];
  const p = REC.pat;
  if (!p) return;
  const N = p.bars * 16,
    drum = p.type === 'drum';
  let len = drum ? 1 : Math.max(REC.quant, (recStepNow(at) - h.raw + N) % N);
  len = Math.min(len, N - h.s);
  if (len <= 0) len = REC.quant;
  p.notes = p.notes.filter(n => !(n.n === h.nn && Math.abs(n.s - h.s) < 0.01));
  p.notes.push({ s: h.s, l: len, n: h.nn, v: clamp(h.vel, 1, 127) });
  touch(p);
  drawEditor();
}
export function recMidi(ev) {
  const d = ev.data;
  if (!d || d.length < 2) return;
  const st = d[0];
  if (st >= 0xf0) return;
  const typ = st & 0xf0;
  const at = AU.ctx.currentTime - (performance.now() - ev.timeStamp) / 1000;
  const p = REC.pat;
  if (!p) return;
  let nn = d[1];
  if (p.type === 'drum') {
    nn = S.drumMap.indexOf(d[1]);
    if (nn < 0) {
      if (typ === 0x90 && d[2] && !REC.warned) {
        REC.warned = true;
        toast('Note ' + d[1] + ' is not in the drum map. Use Setup, step 4, to learn your pads.');
      }
      return;
    }
  }
  const key = 'm' + d[1];
  if (typ === 0x90 && d[2] > 0) recNoteOn(key, nn, d[2], at);
  else if (typ === 0x80 || (typ === 0x90 && !d[2])) recNoteOff(key, at);
}
export function recKey(e, down) {
  if (!REC.on || e.ctrlKey || e.metaKey || e.altKey) return false;
  const p = REC.pat;
  if (!p) return false;
  const k = e.key.toLowerCase();
  if (down && e.key === 'Escape') {
    recStop();
    return true;
  }
  if (REC.mode === 'step' && e.code === 'Space') {
    if (down) {
      e.preventDefault();
      stepAdv(1);
    }
    return true;
  }
  const map = p.type === 'drum' ? KEYMAP_DRUM : KEYMAP_TONE;
  if (!(k in map)) {
    if (p.type === 'tone' && (k === 'z' || k === 'x')) {
      if (down) {
        REC.oct += k === 'x' ? 12 : -12;
        toast('Keyboard octave ' + (REC.oct > 0 ? '+' : '') + REC.oct / 12);
      }
      return true;
    }
    return false;
  }
  if (down && e.repeat) return true;
  const nn = p.type === 'drum' ? map[k] : clamp(60 + REC.oct + map[k], 0, 127);
  const at = AU.ctx.currentTime;
  if (down) {
    e.preventDefault();
    recNoteOn('k' + k, nn, 100, at);
  } else recNoteOff('k' + k, at);
  return true;
}
function stepAdv(d) {
  const p = REC.pat;
  if (!p) return;
  const N = p.bars * 16;
  const l = p.type === 'drum' ? 1 : Math.max(1, ED.snap >= 1 ? ED.snap : 1);
  REC.cur = (((REC.cur + d * l) % N) + N) % N;
  drawEditor();
}
function recStart() {
  const c = curClip();
  if (!c) {
    toast('Select a clip first');
    return;
  }
  const p = patOf(c);
  if (!MIDI.inp)
    toast(
      'No MIDI input selected. Play with the computer keyboard instead (A S D F … for notes, Z and X for octave), or pick an input in the MIDI panel.'
    );
  pushUndo();
  REC.on = true;
  REC.pat = p;
  REC.ti = c.t;
  REC.held = {};
  REC.cur = 0;
  REC.lastT = 0;
  REC.warned = false;
  if (REC.mode === 'live') {
    REC.metroWas = S.metro;
    S.metro = true;
    hooks.syncControls();
    startPat(p, c.t, ED.aud);
  }
  renderEdHead();
  drawEditor();
}
export function recStop() {
  if (!REC.on) return;
  REC.on = false;
  if (REC.mode === 'live') {
    S.metro = REC.metroWas;
    hooks.syncControls();
    if (TR.playing && TR.mode === 'pat') stopPlay();
  }
  REC.held = {};
  renderEdHead();
  drawEditor();
  scheduleUI();
}
export function recGroup() {
  const g = el('div', { class: 'grp' });
  g.append(
    el(
      'button',
      {
        class: 'btn sm recbtn' + (REC.on ? ' on' : ''),
        id: 'bRec',
        title: 'Record into this pattern from your MIDI input or the computer keyboard (Esc stops)',
        onclick: () => {
          if (REC.on) recStop();
          else recStart();
        }
      },
      REC.on ? '■ Stop rec' : '● Rec'
    )
  );
  const ms = el('select', {
    'aria-label': 'Record mode',
    disabled: REC.on,
    onchange: e => {
      REC.mode = e.target.value;
    }
  });
  [
    ['live', 'Live (loops)'],
    ['step', 'Step']
  ].forEach(([v, l]) => ms.append(el('option', { value: v, selected: REC.mode === v }, l)));
  const qs = el('select', {
    'aria-label': 'Record quantize',
    onchange: e => {
      REC.quant = +e.target.value;
    }
  });
  [
    [0.5, 'Quantize 1/32'],
    [1, 'Quantize 1/16'],
    [2, 'Quantize 1/8'],
    [4, 'Quantize 1/4']
  ].forEach(([v, l]) => qs.append(el('option', { value: v, selected: REC.quant === v }, l)));
  g.append(ms, qs);
  if (REC.on && REC.mode === 'step')
    g.append(
      el('button', { class: 'btn sm', onclick: () => stepAdv(1) }, 'Rest'),
      el('button', { class: 'btn sm', onclick: () => stepAdv(-1) }, '◀ Back')
    );
  return g;
}
