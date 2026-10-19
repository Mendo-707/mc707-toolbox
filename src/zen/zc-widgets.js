// Controls for the ZenCore editor: a slider, menu or switch for one parameter, with friendly names,
// value text (pan, dB, notes, value names) and the "not read from the MC-707" state.
//
// Reads: ZE (through the editor's callbacks), ZC_CATEGORIES.
import { el } from '../core/dom.js';
import { showMenu } from '../ui/menu.js';
import { ZC_CATEGORIES } from './zc-data.js';
import { paramOf } from './zc-tone.js';

/* Friendlier names than Roland's, where they differ (by parameter id). */
const NAMES = {
  NAME: 'Name',
  CATEGORY: 'Category',
  PIT_CRS: 'Coarse tune',
  PIT_FINE: 'Fine tune',
  OCTAVE: 'Octave',
  MONO_POLY: 'Voice',
  PORTA_SW: 'Portamento',
  PORTA_TIME: 'Porta time',
  PORTA_MODE: 'Porta mode',
  PORTA_TYPE: 'Porta type',
  PORTA_START: 'Porta start',
  PORTA_CRV: 'Porta curve',
  BEND_RANGE_UP: 'Bend up',
  BEND_RANGE_DW: 'Bend down',
  CUTOFF: 'Cutoff',
  RESO: 'Resonance',
  CUTOFF_KF: 'Key follow',
  CUTOFF_VCRV: 'Velocity curve',
  CUTOFF_VSENS: 'Velocity sens',
  RESO_VSENS: 'Reso velocity',
  FILTER_TYPE: 'Filter type',
  LEVEL_VCRV: 'Velocity curve',
  LEVEL_VSENS: 'Velocity sens',
  CHO_SEND: 'Delay send',
  REV_SEND: 'Reverb send',
  OSC_TYPE: 'Oscillator',
  VA_FORM: 'Waveform',
  PW: 'Pulse width',
  PWM_DEPTH: 'PWM depth',
  SSAW_DETUNE: 'Detune',
  WAV_GTYPE: 'Wave bank',
  WAV_GID: 'Wave group',
  WAV_NUM_L: 'Wave (L)',
  WAV_NUM_R: 'Wave (R)',
  WAV_GAIN: 'Wave gain',
  SYNC_WAV_NUM: 'Sync wave',
  UNISON_SW: 'Unison',
  UNISON_SIZE: 'Voices',
  UNISON_DETN: 'Detune',
  DEPTH: 'Depth',
  VSENS: 'Velocity sens',
  VCRV: 'Velocity curve',
  T1_VSENS: 'T1 velocity',
  T4_VSENS: 'T4 velocity',
  FORM: 'Wave',
  RATE: 'Rate',
  RATE_SYNC: 'Sync to tempo',
  RATE_NOTE: 'Rate (note)',
  PIT_DEPTH: 'Pitch',
  TVF_DEPTH: 'Filter',
  TVA_DEPTH: 'Amp',
  PAN_DEPTH: 'Pan',
  KEY_TRIG: 'Key trigger',
  FADE_MODE: 'Fade mode',
  FADE: 'Fade time',
  DELAY: 'Delay',
  OFST: 'Offset',
  RATE_DETN: 'Rate detune',
  PHASE_POS: 'Phase',
  STEP_MAX: 'Steps',
  LO_GAIN: 'Low gain',
  MID_GAIN: 'Mid gain',
  HI_GAIN: 'High gain',
  LO_FREQ: 'Low freq',
  MID_FREQ: 'Mid freq',
  HI_FREQ: 'High freq',
  MID_Q: 'Mid Q',
  SW: 'On',
  INST_NUM: 'Instrument',
  INST_GTYPE: 'Inst bank',
  INST_GID: 'Inst group',
  KEY_OFST: 'Tune (semi)',
  PIT_FINE_OFST: 'Fine tune',
  CUTOFF_OFST: 'Cutoff',
  RESO_OFST: 'Resonance',
  TVA_ATK_OFST: 'Attack',
  TVA_DCY_OFST: 'Decay',
  TVA_REL_OFST: 'Release',
  MUTE_GRP: 'Mute group',
  OUT_ASGN: 'Output'
};
/** Display name for a parameter key ('PTL0.CUTOFF' → 'Cutoff'). */
export function nameOf(kind, key) {
  const id = key.split('.')[1].replace(/^LFO\d_/, ''),
    p = paramOf(kind, key)[0];
  return NAMES[id] || p[7].replace(/^(TVF|TVA|Pitch Env|TVF Env|TVA Env|PCMRhythm|MFX) /, '');
}
const VCRV = ['FIXED', '1', '2', '3', '4', '5', '6', '7'];
/** The value list of a parameter, if it is a list. */
export function listOf(kind, key) {
  const id = key.split('.')[1],
    p = paramOf(kind, key)[0];
  if (id === 'CATEGORY' && kind === 'tone') return ZC_CATEGORIES;
  if (/VCRV$/.test(id)) return VCRV;
  if (/PHASE_POS$/.test(id)) return ['0°', '90°', '180°', '270°'];
  if (/^ctrlAsgn/.test(id)) return ['OFF', ...Array.from({ length: p[4] }, (_, i) => 'Parameter ' + (i + 1))];
  if (p[8] && p[8].v) return p[8].v;
  return p[3] === 0 && p[4] === 1 ? ['OFF', 'ON'] : null;
}
/** Text for a value. */
export function valText(kind, key, v) {
  const id = key.split('.')[1],
    p = paramOf(kind, key)[0],
    x = p[8] || {},
    list = listOf(kind, key);
  if (list) return list[v - p[3]] ?? String(v);
  if ((/PAN$|PAN_ALT$/.test(id) && p[3] === -64) || id === 'PAN') return v === 0 ? 'C' : v < 0 ? 'L' + -v : v + 'R';
  if (x.d && id !== 'WAV_GID') {
    const s = (x.d[1] - x.d[0]) / (p[4] - p[3]),
      d = x.d[0] + (v - p[3]) * s;
    return (s < 1 ? d.toFixed(1) : String(Math.round(d))) + (x.u === 'EQGAIN' ? ' dB' : '');
  }
  const u = { semitone: ' semi', cent: ' cent', dB: ' dB', EQFREQ: ' Hz' }[x.u] || '';
  return (v > 0 && p[3] < 0 ? '+' : '') + v + u;
}

/* one value copied from a control, to paste into another of the same kind */
let COPIED = null;
const partialOf = key => /^(PTL|PENV|FENV|AENV|LFO|EQ|SPTL)(\d)\.(.+)$/.exec(key);
function ctlMenu(ctx, key, p) {
  const v = ctx.get(key),
    m = ctx.kind === 'tone' && partialOf(key),
    id = key.replace(/^\D+\d*\./, '');
  return [
    {
      label: 'Back to the start value (' + valText(ctx.kind, key, p[5]) + ')',
      disabled: v === p[5],
      action: () => ctx.set(key, p[5], true)
    },
    '-',
    { label: 'Copy value (' + valText(ctx.kind, key, v) + ')', action: () => (COPIED = { id, v }) },
    {
      label: COPIED && COPIED.id === id ? 'Paste value (' + valText(ctx.kind, key, COPIED.v) + ')' : 'Paste value',
      disabled: !(COPIED && COPIED.id === id && COPIED.v >= p[3] && COPIED.v <= p[4]),
      action: () => ctx.set(key, COPIED.v, true)
    },
    m
      ? {
          label: 'Same on all four partials',
          action: () => {
            const keys = [0, 1, 2, 3].map(i => m[1] + i + '.' + m[3]).filter(k => k !== key);
            keys.forEach((k, i) => ctx.set(k, v, i === keys.length - 1));
          }
        }
      : null
  ];
}

/**
 * One control. ctx: {snd, get(key), set(key, v, final), kind}. Lists become menus, 0/1 lists
 * become switches, everything else a slider with its value; double-click a slider for its start value.
 */
export function ctl(ctx, key, opts = {}) {
  const [p] = paramOf(ctx.kind, key),
    list = listOf(ctx.kind, key),
    v = ctx.get(key),
    known = ctx.snd.known.has(key),
    label = opts.label || nameOf(ctx.kind, key);
  const box = el('label', {
    class: 'zcC' + (known ? '' : ' unk') + (opts.wide ? ' wide' : ''),
    title: (known ? '' : 'Not read from the MC-707 yet. ') + p[7] + ' · right-click for more',
    oncontextmenu: e => {
      if (e.target.matches('input[type=text], input[type=number]')) return;
      e.preventDefault();
      showMenu(e.clientX, e.clientY, ctlMenu(ctx, key, p));
    }
  });
  box.append(el('span', { class: 'zcL' }, label));
  if (p[8] && p[8].ascii) {
    box.append(
      el('input', {
        type: 'text',
        maxlength: p[2],
        value: v,
        class: 'zcName',
        onchange: e => ctx.set(key, e.target.value.toUpperCase().slice(0, p[2]), true)
      })
    );
    return box;
  }
  if (list && list.length === 2 && /^(OFF|ON)$/.test(list[0]) && list[1] === 'ON') {
    box.classList.add('sw');
    box.append(
      el(
        'button',
        { type: 'button', class: 'zcSw' + (v ? ' on' : ''), onclick: () => ctx.set(key, v ? 0 : 1, true) },
        v ? 'ON' : 'OFF'
      )
    );
    return box;
  }
  if (list && list.length <= 160) {
    const s = el('select', { onchange: e => ctx.set(key, +e.target.value, true) });
    list.forEach((n, i) => s.append(el('option', { value: p[3] + i, selected: p[3] + i === v }, n)));
    box.append(s);
    return box;
  }
  const out = el('span', { class: 'zcV' }, valText(ctx.kind, key, v));
  const r = el('input', {
    type: 'range',
    min: p[3],
    max: p[4],
    step: 1,
    value: v,
    oninput: e => {
      out.textContent = valText(ctx.kind, key, +e.target.value);
      ctx.set(key, +e.target.value, false);
    },
    onchange: e => ctx.set(key, +e.target.value, true),
    ondblclick: () => ctx.set(key, p[5], true)
  });
  if (p[4] - p[3] > 2000) {
    /* wave numbers and the like: a number box is easier than a long slider */
    const n = el('input', {
      type: 'number',
      min: p[3],
      max: p[4],
      value: v,
      class: 'zcNum',
      onchange: e => ctx.set(key, Math.max(p[3], Math.min(p[4], Math.round(+e.target.value || 0))), true)
    });
    box.append(n);
    return box;
  }
  box.append(r, out);
  return box;
}
/** A titled group of controls. */
export const group = (title, ...kids) => el('fieldset', { class: 'zcG' }, el('legend', {}, title), ...kids);
