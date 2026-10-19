// Quick sound controls on a Synth Mode strip: pick a page (Tone, Filter, Envelope, Movement, Effect) and
// change the most used ZenCore settings right there, without opening the editor. Only that page's values
// are read from the MC-707, and each change goes straight back. Settings that live in each of the four
// partials (filter, envelope, LFO) move together: the slider shows the first playing partial and every
// playing partial shifts by the same amount, so a layered sound keeps its shape.
//
// Owns: QS (each track's quick values, read from the MC-707).
// Reads: SY, DEV.
import { el } from '../core/dom.js';
import { DEVS, DEV } from '../core/device.js';
import { newSound, paramOf, readSound, sendSound } from './zc-tone.js';
import { clipMemory, rememberClip } from './zc-library.js';
import { valText } from './zc-widgets.js';
import { mfxNames } from './zc-mfx.js';
import { ZX, zxConnect } from './zc-sysex.js';
import { SY, kindOf, slotOf, synthSave } from './zc-synth-io.js';

/* pages: [id, label, controls]; a control is [key, label] (one value) or ['*.KEY', label] (every partial) */
const PAGES = {
  tone: [
    [
      'tone',
      'Tone',
      [
        ['CMN.LEVEL', 'Level'],
        ['CMN.OCTAVE', 'Octave'],
        ['CMN.MONO_POLY', 'Mono'],
        ['CMN.PORTA_SW', 'Glide'],
        ['CMN.PORTA_TIME', 'Glide time'],
        ['CMN.ANALOG_FEEL', 'Analog feel']
      ]
    ],
    [
      'filter',
      'Filter',
      [
        ['*PTL.CUTOFF', 'Cutoff'],
        ['*PTL.RESO', 'Resonance'],
        ['*FENV.DEPTH', 'Env depth'],
        ['*PTL.CUTOFF_KF', 'Key follow']
      ]
    ],
    [
      'env',
      'Envelope',
      [
        ['*AENV.T1', 'Attack'],
        ['*AENV.T2', 'Decay'],
        ['*AENV.L3', 'Sustain'],
        ['*AENV.T4', 'Release']
      ]
    ],
    [
      'move',
      'Movement',
      [
        ['*LFO.LFO1_RATE', 'LFO rate'],
        ['*LFO.LFO1_PIT_DEPTH', 'Vibrato'],
        ['*LFO.LFO1_TVF_DEPTH', 'Wah'],
        ['*LFO.LFO1_TVA_DEPTH', 'Tremolo']
      ]
    ],
    [
      'fx',
      'Effect',
      [
        ['MFX.mfxType', 'Effect'],
        ['MFX.mfxSwitch', 'Effect on'],
        ['MFX.choSend', 'Chorus send'],
        ['MFX.revSend', 'Reverb send']
      ]
    ]
  ],
  kit: [
    ['tone', 'Kit', [['KCMN.LEVEL', 'Kit level']]],
    [
      'fx',
      'Effect',
      [
        ['MFX.mfxType', 'Effect'],
        ['MFX.mfxSwitch', 'Effect on'],
        ['MFX.choSend', 'Chorus send'],
        ['MFX.revSend', 'Reverb send']
      ]
    ]
  ]
};
export const quickPages = t => PAGES[kindOf(t)];
const PSW = i => 'PMT.PMT' + (i + 1) + '_PTL_SW';
/* the real keys behind a control: one, or one per partial */
const keysOf = ctlKey => {
  const m = /^\*(\w+)\.(\w+)$/.exec(ctlKey);
  return m ? [0, 1, 2, 3].map(i => m[1] + i + '.' + m[2]) : [ctlKey];
};

/* each track's values: {slot, snd, has: Set of keys read} */
export const QS = {};
const cur = t => {
  const q = QS[t];
  return q && q.slot === SY.slot[t] && q.snd.kind === kindOf(t)
    ? q
    : (QS[t] = { slot: SY.slot[t], snd: newSound(kindOf(t)), has: new Set() });
};
/** Forget what was read (after a new sound is loaded on the track). */
export const quickForget = t => delete QS[t];

/** Read a page's values (and which partials play). Resolves true when the MC-707 answered. A page already
    being read (the strip was drawn again meanwhile) is not asked for twice. */
function readPage(t, page) {
  const q = cur(t),
    k = page[0];
  q.busy = q.busy || {};
  if (!q.busy[k]) q.busy[k] = readNow(t, page).finally(() => delete q.busy[k]);
  return q.busy[k];
}
async function readNow(t, page) {
  const q = cur(t),
    want = new Set(page[2].flatMap(([k]) => keysOf(k)));
  if (kindOf(t) === 'tone') for (let i = 0; i < 4; i++) want.add(PSW(i));
  for (const k of [...want]) if (q.has.has(k)) want.delete(k);
  if (!want.size) return true;
  if (!(await zxConnect()) || !ZX.inp) return false;
  const r = await readSound(q.snd, slotOf(t), want);
  if (r.silent) return false;
  for (const k of want) if (q.snd.known.has(k)) q.has.add(k);
  return true;
}
/* the partials that play (all four when unknown) */
const playing = (t, q) =>
  kindOf(t) === 'kit' ? [0] : [0, 1, 2, 3].filter(i => !q.has.has(PSW(i)) || q.snd.v[PSW(i)] === 1);

/* changes go out together, a moment after the last move */
const PEND = {};
function send(t, keys) {
  const q = cur(t);
  const p = (PEND[t] = PEND[t] || { keys: new Set(), timer: 0 });
  keys.forEach(k => p.keys.add(k));
  clearTimeout(p.timer);
  p.timer = setTimeout(() => {
    const ks = new Set(p.keys);
    p.keys.clear();
    sendSound(q.snd, slotOf(t), ks);
    /* keep the editor's memory of this clip in step */
    const mem = clipMemory(kindOf(t), t, SY.slot[t]);
    if (mem) {
      ks.forEach(k => (mem.v[k] = q.snd.v[k]));
      rememberClip(mem, t, SY.slot[t]);
    }
  }, 30);
}

/* one control: a switch for 0/1, a menu for named values, otherwise a slider with its value */
function control(t, q, [ctlKey, label]) {
  const kind = kindOf(t),
    keys = keysOf(ctlKey),
    multi = keys.length > 1,
    on = multi ? playing(t, q) : [0],
    ref = keys[on[0] ?? 0],
    p = paramOf(kind, ref)[0],
    known = keys.every((k, i) => !on.includes(i) || q.has.has(k));
  const v = q.snd.v[ref];
  const out = el('b', {}, known ? valText(kind, ref, v) : '–');
  const apply = x => {
    const d = x - q.snd.v[ref],
      changed = [];
    keys.forEach((k, i) => {
      if (multi && !on.includes(i)) return;
      const [pp] = paramOf(kind, k);
      const nv = multi ? Math.max(pp[3], Math.min(pp[4], q.snd.v[k] + d)) : x;
      if (nv !== q.snd.v[k]) ((q.snd.v[k] = nv), changed.push(k));
    });
    if (changed.length) send(t, changed);
    out.textContent = valText(kind, ref, q.snd.v[ref]);
  };
  const title = (p[7] || label) + (multi ? '. Moves every playing partial by the same amount.' : '');
  if (p[3] === 0 && p[4] === 1)
    return el(
      'label',
      { class: 'syQ sw', title },
      el('span', {}, label),
      el('input', {
        type: 'checkbox',
        checked: v === 1,
        disabled: !known,
        onchange: e => apply(e.target.checked ? 1 : 0)
      })
    );
  if (ref === 'MFX.mfxType')
    return el('label', { class: 'syQ', title }, el('span', {}, label), el('b', {}, mfxNames()[v] || '–'));
  const paint = (inp, x) => inp.style.setProperty('--hi', ((x - p[3]) / (p[4] - p[3])) * 100 + '%');
  const inp = el('input', {
    type: 'range',
    class: 'syFader',
    min: p[3],
    max: p[4],
    value: v,
    disabled: !known,
    'aria-label': label,
    oninput: e => (apply(+e.target.value), paint(e.target, +e.target.value)),
    ondblclick: e => {
      e.target.value = p[5];
      e.target.dispatchEvent(new Event('input'));
    }
  });
  inp.style.setProperty('--lo', '0%');
  paint(inp, v);
  return el(
    'label',
    { class: 'syRange syQ', title: title + ' Double-click for the start value.' },
    el('span', {}, label),
    inp,
    out
  );
}

/**
 * The quick controls for strip t: a page menu and that page's controls (read when first shown). The page
 * chosen is kept for next time.
 */
export function quickPanel(t) {
  const pages = quickPages(t),
    page = pages.find(p => p[0] === SY.page[t]);
  const body = el('div', { class: 'syQBody' });
  const menu = el(
    'select',
    {
      class: 'syQMenu',
      'aria-label': 'Sound settings for this track',
      title: 'Change this track’s sound here: pick a page of settings',
      onchange: e => {
        SY.page[t] = e.target.value || null;
        synthSave();
        fill();
      }
    },
    el('option', { value: '' }, 'Sound settings…'),
    ...pages.map(([id, l]) => el('option', { value: id, selected: page && page[0] === id }, l))
  );
  async function fill() {
    body.textContent = '';
    const pg = pages.find(p => p[0] === SY.page[t]);
    if (!pg) return;
    body.append(el('div', { class: 'syQNote' }, 'Reading from the ' + DEVS[DEV].name + '…'));
    const ok = await readPage(t, pg);
    if (SY.page[t] !== pg[0]) return;
    body.textContent = '';
    if (!ok)
      body.append(
        el(
          'div',
          { class: 'syQNote' },
          'The ' + DEVS[DEV].name + ' did not answer. Connect it by USB to change the sound here.'
        )
      );
    const q = cur(t);
    pg[2].forEach(c => body.append(control(t, q, c)));
  }
  if (page) fill();
  return el('div', { class: 'syQuick' }, menu, body);
}
