// The ZenCore editor: opens on one MC-707 clip's tone (or a drum track's kit), reads it from the
// MC-707, sends every change as you make it, and keeps undo, partial linking and the last state of
// each clip. The pages are in zc-panels.js and zc-pages-fx.js, the header actions in zc-actions.js.
//
// Owns: ZE (the open editor).
// Reads: S, DEV, ZX.
import { $, el, toast } from '../core/dom.js';
import { S } from '../core/state.js';
import { DEVS, DEV, devNum } from '../core/device.js';
import { MIDI } from '../services/midi.js';
import { PCLAST } from '../services/clip-switch.js';
import { TR } from '../services/transport.js';
import { ZX, slotAddr, trackSetAddr, zxConnect, zxFlush, zxNote, zxRead } from './zc-sysex.js';
import { MFX_PARAMS, newSound, pk, readSound, sendSound, setVal } from './zc-tone.js';
import { clipMemory, rememberClip } from './zc-library.js';
import { mfxDefaults } from './zc-mfx.js';
import {
  pageAmp,
  pageCommon,
  pageEq,
  pageFilter,
  pageLfo,
  pageMatrix,
  pageOsc,
  pagePartials,
  pagePitch
} from './zc-panels.js';
import { pageComp, pageKeys, pageKit, pageMfx } from './zc-pages-fx.js';
import { headerBar } from './zc-actions.js';
import { linkedKeys, partialBar } from './zc-partbar.js';

export const ZE = {
  t: 0,
  k: 0,
  kind: 'tone',
  snd: null,
  tab: 'common',
  part: 0,
  key: 15 /* kit key index: 36 (C2) */,
  linked: [false, false, false, false],
  live: true,
  undo: [],
  redo: [],
  pend: {},
  busy: '',
  srcNote: ''
};
const TABS = {
  tone: [
    ['common', 'Common', pageCommon],
    ['osc', 'Oscillator', pageOsc],
    ['filter', 'Filter', pageFilter],
    ['amp', 'Amp', pageAmp],
    ['pitch', 'Pitch', pagePitch],
    ['lfo', 'LFO', pageLfo],
    ['matrix', 'Matrix', pageMatrix],
    ['eq', 'EQ', ctx => pageEq(ctx)],
    ['mix', 'Partials', pagePartials],
    ['mfx', 'MFX', pageMfx]
  ],
  kit: [
    ['common', 'Kit', pageKit],
    ['keys', 'Keys', pageKeys],
    ['comp', 'Comp', pageComp],
    ['mfx', 'MFX', pageMfx]
  ]
};
const PART_TABS = ['osc', 'filter', 'amp', 'pitch', 'lfo', 'matrix', 'eq'];
/** The MC-707 address of the sound being edited. */
export const zeBase = () => slotAddr(ZE.kind, ZE.t, ZE.k);
const sending = () => ZE.live && ZX.state === 'ready';

/* The MC-707 changes the sound at once but only redraws its screen when the clip is selected again (as
   moving the cursor does). So when a burst of edits has gone out, the editor re-selects the clip it is
   editing: program change k on the track's channel, the way the app switches clips. On by default;
   the "Screen" switch turns it off (kept under its own localStorage key). */
const REFRESH_KEY = 'mc707-zen-refresh';
export function zeRefreshOn() {
  try {
    return localStorage.getItem(REFRESH_KEY) !== '0';
  } catch (e) {
    return true;
  }
}
export function zeSetRefresh(on) {
  try {
    localStorage.setItem(REFRESH_KEY, on ? '1' : '0');
  } catch (e) {}
}
let nudgeT = 0;
function screenNudge() {
  clearTimeout(nudgeT);
  nudgeT = setTimeout(() => {
    if (!$('#zcOv') || !zeRefreshOn() || !ZX.out || ZX.wait || ZX.q.size || ZE.k > 15) return;
    /* never switch the clip under a held note: wait until the keys are let go */
    if (HELD.size) return screenNudge();
    const ch = (S.tracks[ZE.t] && S.tracks[ZE.t].ch) || ZE.t + 1;
    try {
      ZX.out.send([0xc0 | (ch - 1), ZE.k]);
      PCLAST[ZE.t] = ZE.k;
    } catch (e) {}
  }, 450);
}

/* ---- changing values ---- */
function apply(key, v) {
  const keys = linkedKeys(key, ZE.linked);
  for (const k of keys) {
    if (!(k in ZE.pend)) ZE.pend[k] = ZE.snd.v[k];
    setVal(ZE.snd, k, v, sending() ? zeBase() : null);
  }
}
function commit() {
  const ch = ZE.pend;
  ZE.pend = {};
  const keys = Object.keys(ch).filter(k => ch[k] !== ZE.snd.v[k]);
  if (!keys.length) return;
  ZE.undo.push(Object.fromEntries(keys.map(k => [k, ch[k]])));
  ZE.undo.length = Math.min(ZE.undo.length, 200);
  ZE.redo = [];
  remember();
}
/** Undo (or redo) the last change. */
export function zeUndo(redo) {
  const from = redo ? ZE.redo : ZE.undo,
    to = redo ? ZE.undo : ZE.redo;
  const step = from.pop();
  if (!step) return;
  to.push(Object.fromEntries(Object.keys(step).map(k => [k, ZE.snd.v[k]])));
  for (const k in step) setVal(ZE.snd, k, step[k], null);
  if (sending()) sendSound(ZE.snd, zeBase(), new Set(Object.keys(step)));
  remember();
  zeRender();
}
let memT = 0;
function remember() {
  clearTimeout(memT);
  memT = setTimeout(() => ZE.snd && rememberClip(ZE.snd, ZE.t, ZE.k), 800);
}
/** Replace the whole sound (a starter, a saved sound, a file) and send it all. */
/**
 * Load a whole sound (a starter, a library sound, a file) into the clip. Only the values that differ
 * from what the MC-707 has are sent, and the effect type only when it changes: rewriting it resets the
 * effect, which can make a small noise.
 */
/* Sending a whole sound: while it is half written the MC-707 plays a mix of the old and new sound, and a new
   effect type first runs with the old effect's settings, then with all zeros, until its own arrive. So the
   track is muted (expression, CC 11) until the new sound is in and checked, any tail is cut (CC 120), and
   the track comes back. Overlapping loads share one mute. */
/* the track's expression to come back to, and the mute in progress on each channel */
const exprBack = t => {
  const c = S.tracks[t] && S.tracks[t].cc && S.tracks[t].cc[11];
  return Number.isFinite(c) && c > 0 ? c : 127;
};
const chOf = t => ((S.tracks[t] && S.tracks[t].ch) || t + 1) - 1;
const QUIET = new Map(); /* channel -> {n: loads in progress, t: track} */
const pause = ms => new Promise(r => setTimeout(r, ms));
/** Expression back to normal on a track (after a load, and whenever the editor opens or closes). */
export function zeUnmute(t) {
  const out = ZX.out || MIDI.out,
    ch = chOf(t);
  QUIET.delete(ch);
  if (out) out.send([0xb0 | ch, 11, exprBack(t)]);
}
/** Send a whole sound to track t with the track muted while it goes in (Synth mode uses it too). */
export async function zeQuietly(send, t = ZE.t) {
  const ch = chOf(t),
    out = ZX.out || MIDI.out,
    q = QUIET.get(ch) || { n: 0, t };
  if (!q.n++ && out) out.send([0xb0 | ch, 11, 0]);
  QUIET.set(ch, q);
  try {
    /* the writes, the effect's reset and its settings: never more than a moment, whatever the checks do */
    await Promise.race([send(), pause(1500)]);
    await Promise.race([zxFlush(), pause(1500)]);
    await pause(40);
  } catch (e) {
    /* the track always comes back */
  } finally {
    if (QUIET.get(ch) === q && --q.n <= 0) {
      if (out) out.send([0xb0 | ch, 120, 0]);
      zeUnmute(t);
    }
  }
}
/** Put a whole sound in the editor (and on the MC-707, with Live on). Resolves once it is on the MC-707. */
export function zeLoad(snd, why) {
  const prev = ZE.snd;
  ZE.undo.push(Object.fromEntries(Object.keys(prev.v).map(k => [k, prev.v[k]])));
  ZE.redo = [];
  ZE.snd = snd;
  const live = sending();
  let done = Promise.resolve();
  if (live) {
    /* the whole sound, not only what differs from the editor's last one: the clip may hold something the
       editor never read (a sound picked on the MC-707, say), and anything left unsent would stay */
    const base = zeBase();
    done = zeQuietly(() => sendSound(snd, base, new Set(Object.keys(snd.v))));
  }
  remember();
  zeRender();
  if (why) toast(why + (live ? ' and sent to the ' + DEVS[DEV].name : ''));
  return done;
}
function mfxType(type, vals) {
  /* the type and the new effect's starting values (or a preset's), as one undo step; sendSound sends the
     settings once the MC-707 has finished resetting them for the new type */
  const keys = ['MFX.mfxType', ...MFX_PARAMS],
    d = vals || mfxDefaults(type);
  keys.forEach((k, i) => {
    if (!(k in ZE.pend)) ZE.pend[k] = ZE.snd.v[k];
    ZE.snd.v[k] = i ? d[i - 1] : type;
    ZE.snd.known.add(k);
  });
  commit();
  zeRender();
  if (sending()) sendSound(ZE.snd, zeBase(), new Set(keys)).then(() => $('#zcOv') && zeRender());
}

/* ---- reading from the MC-707 ---- */
/** Read the whole sound from the MC-707 (keeps what cannot be read). */
export async function zeRead() {
  if (!(await zxConnect())) return status();
  if (!ZX.inp) {
    toast('No MIDI input from the ' + DEVS[DEV].name + ': cannot read, but changes are still sent');
    return;
  }
  const t = ZE.t,
    k = ZE.k;
  ZE.busy = 'Reading…';
  status();
  const r = await readSound(ZE.snd, zeBase(), null, (d, n) => {
    ZE.busy = 'Reading… ' + Math.round((d / n) * 100) + '%';
    status();
  });
  if (ZE.t !== t || ZE.k !== k) return;
  ZE.busy = '';
  ZE.srcNote = r.ok
    ? 'Read ' +
      r.ok +
      ' of ' +
      r.total +
      ' values' +
      (r.bad ? ' (' + r.bad + ' could not be read; they show faded)' : '')
    : 'The ' + DEVS[DEV].name + ' did not answer the read. Edits are still sent.';
  remember();
  zeRender();
  if (r.ok) readSource();
}
/* which sound the track plays: the clip's (CLIP) or the track's own (TRACK) */
async function readSource() {
  if (ZE.k === 16 || !ZX.inp) return;
  const d = await zxRead(trackSetAddr(ZE.t) + 4, 1);
  if (d && d[0] === 0) {
    ZE.srcNote += ' · This track’s Sound Source is TRACK, so it plays the track sound, not the clip’s.';
    status();
  }
}
/** Send the whole sound to the MC-707. */
export async function zeSendAll() {
  if (!(await zxConnect())) return status();
  const snd = ZE.snd,
    base = zeBase();
  zeQuietly(() => sendSound(snd, base));
  toast('Sent the whole ' + (ZE.kind === 'kit' ? 'kit' : 'tone') + ' to track ' + devNum(ZE.t) + ', ' + targetName());
}
export const targetName = (k = ZE.k) => (k === 16 ? 'track sound' : 'clip ' + (k + 1));

/* ---- opening ---- */
/** Open the editor on track t, clip k (0-15, or 16 for the track's own sound). */
export async function zenOpen(t, k) {
  ZE.t = t;
  ZE.k = k;
  ZE.kind = S.tracks[t].type === 'drum' ? 'kit' : 'tone';
  if (!TABS[ZE.kind].some(x => x[0] === ZE.tab)) ZE.tab = 'common';
  const mem = clipMemory(ZE.kind, t, k);
  ZE.snd = mem || newSound(ZE.kind);
  if (!mem) ZE.snd.known.clear();
  ZE.undo = [];
  ZE.redo = [];
  ZE.pend = {};
  ZE.srcNote = '';
  let ov = $('#zcOv');
  if (!ov) {
    ov = el('div', { id: 'zcOv', class: 'ptOv', role: 'dialog', 'aria-label': 'ZenCore editor' });
    document.body.append(ov);
    addEventListener('keydown', keys, true);
  }
  ZX.onState = status;
  ZX.onIdle = screenNudge;
  zeRender();
  zeUnmute(t);
  if (await zxConnect()) {
    zeUnmute(t);
    zeRead();
  } else status();
}
export function zenClose() {
  const o = $('#zcOv');
  if (o) o.remove();
  removeEventListener('keydown', keys, true);
  /* release every note the editor started, then Hold, All Notes Off and, when nothing is playing,
     All Sound Off, so no tone or tail carries on after closing */
  const ch = (S.tracks[ZE.t] && S.tracks[ZE.t].ch) || ZE.t + 1;
  try {
    for (const [c, b] of HELD.values()) noteOut(c, b, false);
    HELD.clear();
    const out = ZX.out || MIDI.out;
    if (out) {
      out.send([0xb0 | (ch - 1), 64, 0]);
      out.send([0xb0 | (ch - 1), 123, 0]);
      if (!TR.playing) out.send([0xb0 | (ch - 1), 120, 0]);
    }
  } catch (e) {}
  zeUnmute(ZE.t);
  if (ZE.snd) rememberClip(ZE.snd, ZE.t, ZE.k);
  ZX.onState = null;
  ZX.onIdle = null;
  clearTimeout(nudgeT);
}
/* while the editor is open it takes undo, redo and Escape (and keeps Space and the app's other
   shortcuts from reaching the song behind it) */
function keys(e) {
  if (!$('#zcOv') || $('[role=dialog][aria-modal]:not([hidden])') || $('.cmenu')) return;
  const typing = /INPUT|SELECT|TEXTAREA/.test(e.target.tagName) && e.target.type !== 'range';
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !typing) {
    e.preventDefault();
    e.stopPropagation();
    zeUndo(e.shiftKey);
  } else if (e.key === 'Escape') {
    e.stopPropagation();
    zenClose();
  } else if (!typing && !e.ctrlKey && !e.metaKey) e.stopPropagation();
}

/* ---- the screen ---- */
/* previews and graphs that redraw while a value changes (cleared on each render) */
let WATCH = [];
function ctx() {
  return {
    kind: ZE.kind,
    snd: ZE.snd,
    part: ZE.part,
    key: ZE.key,
    get: key => ZE.snd.v[key],
    set: (key, v, final) => {
      apply(key, v);
      WATCH.forEach(f => f(key));
      if (final) {
        commit();
        zeRender();
      }
    },
    commit: () => {
      commit();
      zeRender();
    },
    watch: f => WATCH.push(f),
    mfxType,
    pickKey: i => {
      ZE.key = i;
      zeRender();
    },
    audition
  };
}
/* notes the editor's keyboard is holding: [channel, note] by 'ch:note' */
const HELD = new Map();
const noteOut = (ch, b, on) => {
  if (ZX.out) zxNote(ch, b, on);
  else if (MIDI.out) MIDI.out.send(on ? [0x90 | (ch - 1), b, 100] : [0x80 | (ch - 1), b, 0]);
};
/** Play note n on the edited track while the pointer is held (the keyboard and the Sound browser). */
export function audition(n) {
  const ch = S.tracks[ZE.t].ch || ZE.t + 1;
  const send = (b, on) => {
    noteOut(ch, b, on);
    if (on) HELD.set(ch + ':' + b, [ch, b]);
    else HELD.delete(ch + ':' + b);
  };
  send(n, true);
  /* release on pointer up, a cancelled touch or the window losing focus, so no note is left hanging */
  const up = () => {
    send(n, false);
    for (const ev of ['pointerup', 'pointercancel', 'blur']) removeEventListener(ev, up);
  };
  for (const ev of ['pointerup', 'pointercancel', 'blur']) addEventListener(ev, up);
}
/* two octaves from C3 to play the sound: white keys side by side, black keys on top */
function keyboard() {
  const box = el('div', { class: 'zcKb', 'aria-label': 'Play notes' });
  const whites = [];
  for (let n = 48; n <= 72; n++) if (![1, 3, 6, 8, 10].includes(n % 12)) whites.push(n);
  const w = 100 / whites.length;
  const key = (n, cls, style) =>
    el('button', {
      type: 'button',
      class: 'zcKbK' + cls,
      style,
      title:
        'Play ' + ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'][n % 12] + (Math.floor(n / 12) - 1),
      onpointerdown: e => {
        e.preventDefault();
        audition(n);
      }
    });
  whites.forEach((n, i) => box.append(key(n, '', 'left:' + i * w + '%;width:' + w + '%')));
  whites.forEach((n, i) => {
    if ([0, 2, 5, 7, 9].includes(n % 12) && n < 72)
      box.append(key(n + 1, ' b', 'left:' + ((i + 1) * w - w * 0.32) + '%;width:' + w * 0.64 + '%'));
  });
  return box;
}
/** The status line: connection, reading, what was read. */
export function status() {
  const s = $('#zcStat');
  if (!s) return;
  const dn = DEVS[DEV].name;
  const st = {
    off: 'Not connected',
    asking: 'Asking the browser for SysEx access…',
    ready: 'Connected to ' + (ZX.out ? ZX.out.name : dn) + (ZE.live ? ', sending changes live' : ', live sending off'),
    blocked: 'SysEx access was blocked. Allow MIDI (with SysEx) for this page, or use the Windows app.',
    noport: 'No ' + dn + ' found. Plug it in by USB.'
  }[ZX.state];
  s.textContent = ZE.busy || st + (ZE.srcNote ? ' · ' + ZE.srcNote : '');
  s.className = 'zcStat ' + (ZX.state === 'ready' ? 'ok' : ZX.state === 'asking' ? '' : 'bad');
}
export function zeRender() {
  const ov = $('#zcOv');
  if (!ov || !ZE.snd) return;
  WATCH = [];
  const c = ctx(),
    tabs = TABS[ZE.kind],
    cur = tabs.find(x => x[0] === ZE.tab) || tabs[0];
  const scroll = $('.zcPage', ov) ? $('.zcPage', ov).scrollTop : 0;
  ov.textContent = '';
  const nav = el(
    'nav',
    { class: 'zcTabs' },
    ...tabs.map(([id, lab]) =>
      el(
        'button',
        { type: 'button', class: 'zcTab' + (id === cur[0] ? ' on' : ''), onclick: () => ((ZE.tab = id), zeRender()) },
        lab
      )
    )
  );
  const parts = ZE.kind === 'tone' && PART_TABS.includes(cur[0]) ? partialBar(ZE, zeRender) : null;
  const page = el('div', { class: 'zcPage' }, cur[2](c));
  ov.append(
    el(
      'div',
      { class: 'ptBox zcBox' },
      headerBar(),
      el('div', { id: 'zcStat', class: 'zcStat' }),
      el('div', { class: 'zcBar' }, nav, parts),
      page,
      ZE.kind === 'tone' ? keyboard() : null
    )
  );
  page.scrollTop = scroll;
  status();
}
