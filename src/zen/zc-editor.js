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
import { ZX, slotAddr, trackSetAddr, zxConnect, zxNote, zxRead } from './zc-sysex.js';
import { newSound, pk, readSound, sendSound, setVal } from './zc-tone.js';
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

export const ZE = {
  t: 0,
  k: 0,
  kind: 'tone',
  snd: null,
  tab: 'common',
  part: 0,
  key: 15 /* kit key index: 36 (C2) */,
  link: false,
  live: true,
  undo: [],
  redo: [],
  pend: {},
  busy: '',
  srcNote: ''
};
const PARTIAL = /^(PTL|PENV|FENV|AENV|LFO|EQ|SPTL)\d\./;
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
    const ch = (S.tracks[ZE.t] && S.tracks[ZE.t].ch) || ZE.t + 1;
    try {
      ZX.out.send([0xc0 | (ch - 1), ZE.k]);
      PCLAST[ZE.t] = ZE.k;
    } catch (e) {}
  }, 450);
}

/* ---- changing values ---- */
function apply(key, v) {
  const keys = ZE.link && PARTIAL.test(key) ? [0, 1, 2, 3].map(i => key.replace(/\d\./, i + '.')) : [key];
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
  for (const k in step) setVal(ZE.snd, k, step[k], sending() ? zeBase() : null);
  remember();
  zeRender();
}
let memT = 0;
function remember() {
  clearTimeout(memT);
  memT = setTimeout(() => ZE.snd && rememberClip(ZE.snd, ZE.t, ZE.k), 800);
}
/** Replace the whole sound (a starter, a saved sound, a file) and send it all. */
export function zeLoad(snd, why) {
  ZE.undo.push(Object.fromEntries(Object.keys(ZE.snd.v).map(k => [k, ZE.snd.v[k]])));
  ZE.redo = [];
  ZE.snd = snd;
  if (sending()) sendSound(snd, zeBase());
  remember();
  zeRender();
  if (why) toast(why + (sending() ? ' and sent to the ' + DEVS[DEV].name : ''));
}
function mfxType(type) {
  apply('MFX.mfxType', type);
  /* the MC-707 resets the parameters for the new type: show sensible values until they are read back */
  const d = mfxDefaults(type);
  for (let i = 0; i < 32; i++) {
    ZE.snd.v['MFX.param_' + (i + 1)] = d[i];
    ZE.snd.known.delete('MFX.param_' + (i + 1));
  }
  commit();
  zeRender();
  if (sending())
    setTimeout(async () => {
      const keys = new Set(Array.from({ length: 32 }, (_, i) => 'MFX.param_' + (i + 1)));
      await readSound(ZE.snd, zeBase(), keys);
      zeRender();
    }, 250);
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
  sendSound(ZE.snd, zeBase());
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
  if (await zxConnect()) zeRead();
  else status();
}
export function zenClose() {
  const o = $('#zcOv');
  if (o) o.remove();
  removeEventListener('keydown', keys, true);
  /* all notes off on the track the editor played */
  const ch = (S.tracks[ZE.t] && S.tracks[ZE.t].ch) || ZE.t + 1,
    off = [0xb0 | (ch - 1), 123, 0];
  try {
    if (ZX.out) ZX.out.send(off);
    else if (MIDI.out) MIDI.out.send(off);
  } catch (e) {}
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
function ctx() {
  return {
    kind: ZE.kind,
    snd: ZE.snd,
    part: ZE.part,
    key: ZE.key,
    get: key => ZE.snd.v[key],
    set: (key, v, final) => {
      apply(key, v);
      if (final) {
        commit();
        zeRender();
      }
    },
    commit: () => {
      commit();
      zeRender();
    },
    mfxType,
    pickKey: i => {
      ZE.key = i;
      zeRender();
    },
    audition
  };
}
function audition(n) {
  const ch = S.tracks[ZE.t].ch || ZE.t + 1;
  const send = (b, on) => {
    if (ZX.out) zxNote(ch, b, on);
    else if (MIDI.out) MIDI.out.send(on ? [0x90 | (ch - 1), b, 100] : [0x80 | (ch - 1), b, 0]);
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
  const parts =
    ZE.kind === 'tone' && PART_TABS.includes(cur[0])
      ? el(
          'div',
          { class: 'zcParts' },
          el('span', { class: 'zcL' }, 'Partial'),
          ...[0, 1, 2, 3].map(i => {
            const on = ZE.snd.v[pk('PMT', null, 'PMT' + (i + 1) + '_PTL_SW')];
            return el(
              'button',
              {
                type: 'button',
                class: 'zcPart' + (i === ZE.part ? ' on' : '') + (on ? ' lit' : ''),
                title: on ? 'Partial ' + (i + 1) : 'Partial ' + (i + 1) + ' is switched off (Partials page)',
                onclick: () => ((ZE.part = i), zeRender())
              },
              String(i + 1)
            );
          }),
          el(
            'label',
            { class: 'zcLink', title: 'Changes apply to all four partials at once' },
            el('input', { type: 'checkbox', checked: ZE.link, onchange: e => (ZE.link = e.target.checked) }),
            ' Edit all four'
          )
        )
      : null;
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
