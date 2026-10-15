// USB controller keyboards in Live Mode: the model presets, keyboard zones (mutes, key, solo),
// learned controls and the solo voice.
//
// Owns: CTL (the controller keyboard).
// Reads: S, LV, TR, REC, MIDI, AU.
// Calls up the layers through hooks (core/hooks.js).
import { $, clamp, el, toast } from '../core/dom.js';
import { SCALES } from '../core/theory.js';
import { S } from '../core/state.js';
import { AU, voice } from '../services/synth.js';
import { MIDI, sendMidi } from '../services/midi.js';
import { REC, TR } from '../services/transport.js';
import { LV, NOTEN, mkEnv, noteLbl, saveLive } from './state.js';
import { actLabel, lvNow } from './themes.js';
import { LV_TONES, lvSendCC } from './moves.js';
import { liveBreak } from './breaks.js';
import { liveStart, liveStop, lvTarget } from './engine.js';
import {
  liveBuildDrop,
  liveEnergy,
  liveFillNow,
  lvBoundary,
  lvEffMute,
  lvOn,
  lvSortCues,
  lvVaryLabel
} from './cues.js';
import { livePadDown, livePadUp, sendKnob } from './pads.js';
import { liveRender } from './panels.js';
import { liveRenderSettings } from './settings-panel.js';
import { vizNote } from './visualizer.js';
import { hooks } from '../core/hooks.js';

/* ===== USB controller keyboard (FLkey, Launchkey, KeyLab, any MIDI keyboard) =====
   Raven-style zones: lowest octave mutes the 8 tracks, the next octave changes the key of every melodic part,
   and the keys above play a live solo on one MC-707 track. Knobs, faders, buttons and pads are learned once. */
/* id, name, keys, lowest note, knobs, faders, fader buttons, pads, keys channel, note */
export const CTL_PRESETS = [
  ['flkey61', 'Novation FLkey 61', 61, 36, 8, 9, 9, 16, 1, 'nov'],
  ['flkey49', 'Novation FLkey 49', 49, 36, 8, 9, 9, 16, 1, 'nov'],
  ['flkey37', 'Novation FLkey 37', 37, 48, 8, 0, 0, 16, 1, 'nov'],
  ['flkeymini', 'Novation FLkey Mini', 25, 48, 8, 0, 0, 16, 1, 'nov'],
  ['launchkey61', 'Novation Launchkey 61', 61, 36, 8, 9, 9, 16, 1, 'nov'],
  ['launchkey49', 'Novation Launchkey 49', 49, 36, 8, 9, 9, 16, 1, 'nov'],
  ['launchkey37', 'Novation Launchkey 37', 37, 48, 8, 0, 0, 16, 1, 'nov'],
  ['keylab61', 'Arturia KeyLab Essential 61', 61, 36, 9, 9, 0, 8, 1, ''],
  ['keylab49', 'Arturia KeyLab Essential 49', 49, 36, 9, 9, 0, 8, 1, ''],
  ['mpk261', 'Akai MPK261', 61, 36, 8, 8, 8, 16, 1, ''],
  ['mpk249', 'Akai MPK249', 49, 36, 8, 8, 8, 16, 1, ''],
  ['mpkmini', 'Akai MPK Mini', 25, 48, 8, 0, 0, 8, 1, ''],
  ['launchkeymini', 'Novation Launchkey Mini MK3', 25, 48, 8, 0, 0, 16, 1, 'nov'],
  ['minilab3', 'Arturia MiniLab 3', 25, 48, 8, 4, 0, 8, 1, ''],
  ['keylab88', 'Arturia KeyLab 88 MkII', 88, 21, 9, 9, 9, 16, 1, ''],
  ['mpkminiplus', 'Akai MPK Mini Plus', 37, 48, 8, 0, 0, 8, 1, ''],
  ['oxygenpro61', 'M-Audio Oxygen Pro 61', 61, 36, 8, 9, 9, 16, 1, ''],
  ['keystation61', 'M-Audio Keystation 61 MK3', 61, 36, 0, 1, 0, 0, 1, ''],
  ['kka49', 'Native Instruments Komplete Kontrol A49', 49, 36, 8, 0, 0, 0, 1, ''],
  ['kkm32', 'Native Instruments Komplete Kontrol M32', 32, 41, 8, 0, 0, 0, 1, ''],
  ['impactlx61', 'Nektar Impact LX61+', 61, 36, 8, 9, 9, 8, 1, ''],
  ['rolanda49', 'Roland A-49', 49, 36, 2, 0, 0, 0, 1, ''],
  ['g25', 'Other 25-key keyboard', 25, 48, 8, 0, 0, 8, 0, ''],
  ['g37', 'Other 37-key keyboard', 37, 48, 8, 0, 0, 8, 0, ''],
  ['g49', 'Other 49-key keyboard', 49, 36, 8, 9, 0, 16, 0, ''],
  ['g61', 'Other 61-key keyboard', 61, 36, 8, 9, 0, 16, 0, ''],
  ['g88', 'Other 88-key keyboard', 88, 21, 8, 9, 0, 16, 0, '']
];
export const CTL_ZONES = [
  ['raven', 'Mutes, key, then solo (Raven)'],
  ['keysolo', 'Key, then solo'],
  ['solo', 'Solo on every key']
];
const CTL_KNOBS = [
  'FILTER knob',
  'MOD knob',
  'FX knob',
  'SOUND knob',
  'Reverb (tone parts)',
  'Resonance (tone parts)',
  'Variation',
  'Chaos',
  'Solo cutoff'
];
const CTL_DEF = {
  preset: 'g61',
  inName: '',
  low: 36,
  base: 36,
  keys: 61,
  keyCh: 0,
  zones: 'raven',
  muteMode: 'toggle',
  muteWhen: 'beat',
  trMode: 'abs',
  trHold: false,
  trWhen: 'beat',
  soloT: 6,
  soloOct: 0,
  soloSnap: false,
  soloOwn: false,
  modWheel: 'filter',
  map: {}
};
export const CTL = {
  inp: null,
  learn: null,
  learnAll: false,
  learnLow: false,
  held: {},
  trHeld: [],
  idx: {},
  lastAct: ''
};
export const ctlPreset = () => CTL_PRESETS.find(p => p[0] === LV.ctl.preset) || CTL_PRESETS.find(p => p[0] === 'g61');
export function ctlFix() {
  const c = (LV.ctl = Object.assign({}, CTL_DEF, LV.ctl && typeof LV.ctl === 'object' ? LV.ctl : {}));
  if (!c.map || typeof c.map !== 'object') c.map = {};
  ['low', 'base', 'keys'].forEach(k => (c[k] = clamp(Math.round(+c[k] || CTL_DEF[k]), 0, 127)));
  c.keyCh = clamp(Math.round(+c.keyCh || 0), 0, 16);
  c.soloT = clamp(Math.round(Number.isFinite(+c.soloT) ? +c.soloT : 6), -1, 7);
  c.soloOct = clamp(Math.round(+c.soloOct || 0), -3, 3);
  if (!CTL_ZONES.some(z => z[0] === c.zones)) c.zones = 'raven';
  ctlIndex();
}
export function ctlIndex() {
  CTL.idx = {};
  for (const k in LV.ctl.map) CTL.idx[LV.ctl.map[k]] = k;
}
/* the controls the app can learn, sized to the chosen keyboard */
export function ctlTargets() {
  const p = ctlPreset(),
    out = [];
  for (let i = 0; i < Math.max(p[4], 4); i++) out.push(['k' + (i + 1), 'Knob ' + (i + 1), CTL_KNOBS[i] || '—']);
  for (let i = 0; i < p[5]; i++)
    out.push(['f' + (i + 1), 'Fader ' + (i + 1), i < 8 ? S.tracks[i].name + ' volume' : 'Energy']);
  for (let i = 0; i < p[6]; i++)
    out.push(['b' + (i + 1), 'Fader button ' + (i + 1), i < 8 ? 'Mute ' + S.tracks[i].name : 'Unmute all']);
  for (let i = 0; i < Math.max(p[7], 8); i++)
    out.push(['p' + (i + 1), 'Pad ' + (i + 1), 'Live pad ' + (i + 1) + ': ' + actLabel(LV.acts[i])]);
  out.push(['play', 'Play button', 'Start / stop'], ['stop', 'Stop button', 'Stop'], ['brk', 'Any button', 'Break']);
  return out;
}
export const ctlKeyName = k => {
  if (!k) return 'not set';
  const m = /^([cn])(\d+):(\d+)$/.exec(k);
  return m ? (m[1] === 'c' ? 'CC ' + m[3] : 'Note ' + m[3] + ' (' + noteLbl(+m[3]) + ')') + ' · ch ' + m[2] : k;
};
function ctlZoneOf(n) {
  const c = LV.ctl,
    b = c.base;
  if (c.zones === 'raven') {
    if (n >= b && n < b + 12) return ['mute', n - b];
    if (n >= b + 12 && n < b + 24) return ['key', n - b - 12];
  } else if (c.zones === 'keysolo') {
    if (n >= b && n < b + 12) return ['key', n - b];
  }
  return ['solo', n];
}
function ctlWhen(w) {
  if (!lvOn()) return 0;
  return w === 'now' ? TR.tick : w === 'bar' ? lvBoundary(1) : Math.ceil((TR.tick + 1) / 8) * 8;
}
function ctlMute(tracks, on) {
  if (!lvOn()) {
    tracks.forEach(t => {
      LV.mute[t] = on;
    });
    LV.tg = Array.from({ length: 8 }, (_, t) => mkEnv(lvTarget(t), lvTarget(t), 0, 0));
    LV.ver++;
    return;
  }
  LV.cues = LV.cues.filter(c => !(c.type === 'mute' && c.tracks.some(t => tracks.includes(t))));
  LV.cues.push({ type: 'mute', tracks, on, tick: ctlWhen(LV.ctl.muteWhen) });
  lvSortCues();
  LV.ver++;
}
function ctlTranspose(k) {
  const c = LV.ctl,
    home = LV.homeKey == null ? LV.key : LV.homeKey,
    pc = k == null ? home : c.trMode === 'rel' ? (home + k) % 12 : k;
  if (!lvOn()) {
    LV.key = pc;
    LV.ver++;
    liveRender();
    return;
  }
  LV.cues = LV.cues.filter(x => x.type !== 'key');
  if (pc !== LV.key) LV.cues.push({ type: 'key', key: pc, mode: LV.mode, tick: ctlWhen(c.trWhen) });
  lvSortCues();
  LV.ver++;
}
function ctlSnap(n) {
  const sc = SCALES[LV.mode === 'major' ? 'major' : 'minor'];
  for (let d = 0; d < 3; d++) {
    if (sc.includes((((n - d - LV.key) % 12) + 12) % 12)) return n - d;
  }
  return n;
}
function ctlSolo(n, v, on) {
  const c = LV.ctl,
    t = c.soloT;
  if (t < 0) return;
  const tr = S.tracks[t],
    now = lvNow();
  if (on) {
    let nn = clamp(n + 12 * c.soloOct, 0, 127);
    if (c.soloSnap) nn = ctlSnap(nn);
    if (CTL.held[n] != null) sendMidi([0x80 | (tr.ch - 1), CTL.held[n], 0], now);
    CTL.held[n] = { nn, t, ch: tr.ch };
    if (MIDI.out) sendMidi([0x90 | (tr.ch - 1), nn, v], now);
    if (typeof vizNote === 'function' && TR.mode === 'live') vizNote(t, nn, v, now, 0.25);
    if (S.preview) voice(t, nn, now, 0.35, v);
    LV.pulse[t] = { time: now, v: v / 127 };
  } else {
    const h = CTL.held[n];
    if (!h) return;
    delete CTL.held[n];
    if (MIDI.out) sendMidi([0x80 | (h.ch - 1), h.nn, 0], now);
  }
}
export function ctlAllOff() {
  const now = AU.ctx ? AU.ctx.currentTime : 0;
  for (const n in CTL.held) {
    const h = CTL.held[n];
    if (MIDI.out) sendMidi([0x80 | (h.ch - 1), h.nn, 0], now);
  }
  CTL.held = {};
  CTL.trHeld = [];
}
/* Raven mode, shared by the MC-707 keys and a controller keyboard */
export function ravenMuteKey(i, on) {
  const c = LV.ctl;
  if (i < 8) {
    if (c.muteMode === 'hold' || on) ctlMute([i], !lvEffMute(i));
    if (on) CTL.lastAct = (lvEffMute(i) ? 'Mute ' : 'Unmute ') + S.tracks[i].name;
  } else if (on) {
    if (i === 8) {
      ctlMute([0, 1, 2, 3, 4, 5, 6, 7], false);
      CTL.lastAct = 'Unmute all';
    } else if (i === 9) {
      liveFillNow();
      CTL.lastAct = 'Fill';
    } else if (i === 10) {
      liveBuildDrop();
      CTL.lastAct = 'Build → Drop';
    } else {
      liveBreak();
      CTL.lastAct = 'Break';
    }
  }
}
export function ravenKeyKey(i, on) {
  const c = LV.ctl;
  if (on) {
    if (LV.homeKey == null) LV.homeKey = LV.key;
    CTL.trHeld = CTL.trHeld.filter(x => x !== i);
    CTL.trHeld.push(i);
    ctlTranspose(i);
    CTL.lastAct = 'Key ' + NOTEN[c.trMode === 'rel' ? ((LV.homeKey == null ? LV.key : LV.homeKey) + i) % 12 : i];
  } else {
    CTL.trHeld = CTL.trHeld.filter(x => x !== i);
    if (c.trHold) ctlTranspose(CTL.trHeld.length ? CTL.trHeld[CTL.trHeld.length - 1] : null);
  }
}
function ctlKey(n, v, on) {
  const [z, i] = ctlZoneOf(n);
  if (z === 'mute') ravenMuteKey(i, on);
  else if (z === 'key') ravenKeyKey(i, on);
  else ctlSolo(n, v, on);
  const k = $('#ctlK' + n);
  if (k) k.classList.toggle('hit', on);
  const a = $('#ctlAct');
  if (a && on && CTL.lastAct) a.textContent = ' → ' + CTL.lastAct;
}
function ctlDo(tg, val, press, release) {
  const now = lvNow(),
    k = tg[0],
    i = +tg.slice(1) - 1;
  if (k === 'k') {
    if (i < 4) sendKnob(i, val);
    else if (i === 4) LV_TONES.forEach(t => lvSendCC(t, 91, val, now));
    else if (i === 5) LV_TONES.forEach(t => lvSendCC(t, 71, val, now));
    else if (i === 6) {
      LV.vary = Math.round((val / 127) * 25) * 5;
      const s = $('#lvVary');
      if (s) s.value = LV.vary;
      const x = $('#lvVaryVal');
      if (x) x.textContent = lvVaryLabel();
      saveLive();
    } else if (i === 7) {
      LV.chaos = Math.round((val / 127) * 100);
      const s = $('#lvChaos');
      if (s) s.value = LV.chaos;
      saveLive();
    } else if (i === 8 && LV.ctl.soloT >= 0) lvSendCC(LV.ctl.soloT, 74, val, now);
  } else if (k === 'f') {
    if (i < 8) lvSendCC(i, 7, val, now);
    else liveEnergy(1 + Math.round((val / 127) * 7));
  } else if (k === 'b') {
    if (!press) return;
    if (i < 8) ctlMute([i], !lvEffMute(i));
    else ctlMute([0, 1, 2, 3, 4, 5, 6, 7], false);
  } else if (k === 'p') {
    if (press) livePadDown(i);
    else if (release) livePadUp(i);
  } else if (tg === 'play') {
    if (press) {
      if (lvOn()) liveStop();
      else liveStart(LV.cur);
    }
  } else if (tg === 'stop') {
    if (press && lvOn()) liveStop();
  } else if (tg === 'brk') {
    if (press) liveBreak();
  }
}
function onCtlIn(ev) {
  const d = ev.data;
  if (!d || !d.length) return;
  const st = d[0];
  if (st === 0xfa || st === 0xfb) {
    if (document.body.dataset.mode === 'live' && !lvOn()) liveStart(LV.cur);
    return;
  }
  if (st === 0xfc) {
    if (lvOn()) liveStop();
    return;
  }
  if (st >= 0xf0 || d.length < 2) return;
  const typ = st & 0xf0,
    ch = (st & 15) + 1,
    n = d[1],
    v = d.length > 2 ? d[2] : 0;
  const on = typ === 0x90 && v > 0,
    off = typ === 0x80 || (typ === 0x90 && v === 0);
  if (CTL.learnLow && on) {
    const c = LV.ctl;
    c.low = n;
    c.base = n + ((12 - (n % 12)) % 12);
    CTL.learnLow = false;
    saveLive();
    liveRenderSettings();
    toast('Lowest key set: ' + noteLbl(n) + '. Zones start at ' + noteLbl(c.base));
    return;
  }
  if (CTL.learn && (typ === 0xb0 || on)) {
    const key = (typ === 0xb0 ? 'c' : 'n') + ch + ':' + n,
      map = LV.ctl.map;
    for (const t in map) if (map[t] === key) delete map[t];
    map[CTL.learn] = key;
    ctlIndex();
    saveLive();
    if (CTL.learnAll) {
      const ts = ctlTargets().map(x => x[0]),
        j = ts.indexOf(CTL.learn);
      CTL.learn = j >= 0 && j < ts.length - 1 ? ts[j + 1] : null;
      if (!CTL.learn) CTL.learnAll = false;
    } else CTL.learn = null;
    CTL.lastCC = key;
    setTimeout(liveRenderSettings, typ === 0xb0 ? 250 : 0);
    return;
  }
  if (REC.on && $('#setup').hidden && document.body.dataset.mode !== 'live') {
    hooks.recMidi(ev);
    return;
  }
  if (typ === 0xb0 || on || off) {
    const tg = CTL.idx[(typ === 0xb0 ? 'c' : 'n') + ch + ':' + n];
    if (tg) {
      ctlDo(tg, v, typ === 0xb0 ? v > 0 : on, typ === 0xb0 ? v === 0 : off);
      return;
    }
  }
  if (document.body.dataset.mode !== 'live') return;
  const t = LV.ctl.soloT,
    tr = t >= 0 ? S.tracks[t] : null;
  if (typ === 0xe0) {
    if (tr && MIDI.out) sendMidi([0xe0 | (tr.ch - 1), d[1], d[2]], lvNow());
    return;
  }
  if (typ === 0xd0) {
    if (tr && MIDI.out) sendMidi([0xd0 | (tr.ch - 1), d[1]], lvNow());
    return;
  }
  if (typ === 0xb0 && n === 1) {
    if (LV.ctl.modWheel === 'filter') sendKnob(0, Math.round(LV.rest[0] + ((127 - LV.rest[0]) * v) / 127));
    else if (tr && MIDI.out) sendMidi([0xb0 | (tr.ch - 1), 1, v], lvNow());
    return;
  }
  if (typ === 0xb0 && n === 64) {
    if (tr && MIDI.out) sendMidi([0xb0 | (tr.ch - 1), 64, v], lvNow());
    return;
  }
  if (on || off) {
    if (LV.ctl.keyCh && LV.ctl.keyCh !== ch) return;
    ctlKey(n, v, on);
  }
}
export function ctlAttach() {
  const ins = MIDI.access ? [...MIDI.access.inputs.values()] : [];
  const want = LV.ctl.inName,
    i = want ? ins.find(x => x.name === want && x !== MIDI.inp) : null;
  if (CTL.inp && CTL.inp !== i) {
    if (CTL.inp.onmidimessage === onCtlIn) CTL.inp.onmidimessage = null;
    ctlAllOff();
  }
  CTL.inp = i || null;
  if (i) i.onmidimessage = onCtlIn;
  const s = $('#lvCtlBar');
  if (s) liveRenderCtlBar();
}
export function ctlUsePreset(id) {
  const p = CTL_PRESETS.find(x => x[0] === id);
  if (!p) return;
  const c = LV.ctl;
  c.preset = id;
  c.keys = p[2];
  c.low = p[3];
  c.base = p[3] + ((12 - (p[3] % 12)) % 12);
  c.keyCh = p[8];
  if (!Object.keys(c.map).length) for (let i = 0; i < p[4]; i++) c.map['k' + (i + 1)] = 'c1:' + (21 + i);
  ctlIndex();
  saveLive();
}
/* a strip on the Live page: what each part of the keyboard does right now */
export function liveRenderCtlBar() {
  const bar = $('#lvCtlBar');
  if (!bar) return;
  bar.textContent = '';
  if (!CTL.inp) {
    bar.hidden = true;
    return;
  }
  bar.hidden = false;
  const c = LV.ctl,
    b = c.base,
    z = c.zones,
    solo = c.soloT >= 0 ? S.tracks[c.soloT].name : 'off';
  const parts = [ctlPreset()[1]];
  if (z === 'raven')
    parts.push(
      'mutes ' + noteLbl(b) + '–' + noteLbl(b + 11),
      'key ' + noteLbl(b + 12) + '–' + noteLbl(b + 23),
      'solo on ' + solo + ' from ' + noteLbl(b + 24)
    );
  else if (z === 'keysolo') parts.push('key ' + noteLbl(b) + '–' + noteLbl(b + 11), 'solo on ' + solo + ' elsewhere');
  else parts.push('solo on ' + solo);
  bar.append(el('b', {}, '🎹 '), parts.join(' · '), el('span', { class: 'ctlAct', id: 'ctlAct' }, ''));
}
export function ctlKeyboard() {
  const c = LV.ctl,
    wrap = el('div', { class: 'ctlKb' }),
    lo = c.low,
    hi = c.low + c.keys - 1,
    blk = [1, 3, 6, 8, 10];
  let wx = 0;
  const W = 16;
  for (let n = lo; n <= hi; n++) {
    const pc = n % 12,
      isB = blk.includes(pc),
      [zn, i] = ctlZoneOf(n);
    let lab = '';
    if (zn === 'mute') lab = i < 8 ? String(i + 1) : ['All', 'Fill', 'Drop', 'Brk'][i - 8];
    else if (zn === 'key') lab = c.trMode === 'rel' ? (i === 0 ? '0' : '+' + i) : NOTEN[i];
    else if (pc === 0) lab = noteLbl(n);
    const k = el(
      'i',
      {
        class: 'ck ' + (isB ? 'b ' : 'w ') + zn,
        id: 'ctlK' + n,
        title:
          noteLbl(n) +
          ' · ' +
          (zn === 'mute'
            ? i < 8
              ? 'Mute ' + S.tracks[i].name
              : ['Unmute all', 'Fill', 'Build → Drop', 'Break'][i - 8]
            : zn === 'key'
              ? 'Key change'
              : 'Solo on ' + (c.soloT >= 0 ? S.tracks[c.soloT].name : 'nothing')),
        style: isB ? 'left:' + (wx * W - 5) + 'px' : 'left:' + wx * W + 'px'
      },
      isB ? '' : lab
    );
    if (!isB) wx++;
    wrap.append(k);
  }
  wrap.style.width = wx * W + 'px';
  return el('div', { class: 'ctlKbWrap' }, wrap);
}
