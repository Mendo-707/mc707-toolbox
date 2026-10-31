// The Slime Lab's five knobs: Bright, Body, Shape, Motion and Space, the same on every sound (after the
// four fixed knobs of Teenage Engineering's OP-XY engines and the macros of Arturia's Analog Lab). Each
// knob reads its place from the tone and sets the real parameters behind it on every partial that is on,
// and each comes with the idea behind it for the Learn panel.
//
// A knob: {id, name, c (colour), ends [left word, right word], read(v, ps) 0-1, set(b, x), word(x),
// what, hear, tip, page (the Fine-tune page with its settings)}. b is a brewer (zc-lab-moves.js).
// Reads: nothing (the values come in as v).
import { el } from '../core/dom.js';

const num = (v, k, d = 0) => (typeof v[k] === 'number' ? v[k] : d);
const avg = (ps, f) => ps.reduce((s, i) => s + f(i), 0) / ps.length;
const clamp = x => Math.max(0, Math.min(1, x));
const LFO_KEYS = ['1_PIT', '1_TVF', '1_TVA', '2_PIT', '2_TVF', '2_TVA'];

/* Shape: swell (0) … held organ-like notes (0.4–0.6) … pluck (1), all on the amp envelope */
function setShape(b, x) {
  b.each(p => {
    const a = p('AENV') + '.';
    if (x < 0.4) {
      const t = (0.4 - x) / 0.4;
      b.set(a + 'T1', 60 + 600 * t);
      b.set(a + 'L1', 1023);
      b.set(a + 'L2', 1023);
      b.set(a + 'L3', 1023);
      b.set(a + 'T4', 180 + 420 * t);
    } else if (x <= 0.6) {
      b.set(a + 'T1', 0);
      b.set(a + 'L1', 1023);
      b.set(a + 'L2', 1023);
      b.set(a + 'L3', 1023);
      b.set(a + 'T4', 140);
    } else {
      const q = (x - 0.6) / 0.4;
      b.set(a + 'T1', 0);
      b.set(a + 'L1', 1023);
      b.set(a + 'T2', 420 - 160 * q);
      b.set(a + 'L2', 1023 * (1 - q * 0.55));
      b.set(a + 'T3', 420 - 120 * q);
      b.set(a + 'L3', 1023 * (1 - q) ** 2);
      b.set(a + 'T4', 160 + 160 * q);
    }
  });
}
function readShape(v, ps) {
  const t1 = avg(ps, i => num(v, 'AENV' + i + '.T1')),
    l3 = avg(ps, i => num(v, 'AENV' + i + '.L3', 1023));
  if (t1 > 40) return clamp(0.4 - 0.4 * Math.min(1, (t1 - 60) / 600));
  if (l3 > 1000) return 0.5;
  return clamp(0.6 + 0.4 * (1 - Math.sqrt(l3 / 1023)));
}

/** The knobs, left to right. */
export const KNOBS = [
  {
    id: 'bright',
    name: 'Bright',
    c: '#ffd23f',
    ends: ['Dark', 'Bright'],
    page: 'filter',
    read: (v, ps) =>
      clamp(avg(ps, i => (num(v, 'PTL' + i + '.FILTER_TYPE', 1) === 0 ? 1 : num(v, 'PTL' + i + '.CUTOFF') / 1023))),
    set: (b, x) =>
      b.each(p => {
        if (b.get(p('PTL') + '.FILTER_TYPE') === 0 && x < 0.99) b.set(p('PTL') + '.FILTER_TYPE', 1);
        b.set(p('PTL') + '.CUTOFF', x * 1023);
      }),
    what: 'Every note is a stack of overtones above its root. The filter decides how many get through: turn Bright up and more pass, so the sound gets brighter, closer and more aggressive; turn it down and it goes warm, soft and further away. Under the hood: the filter’s cutoff.',
    hear: 'Every filter sweep in dance music, the “opening up” before a drop; muffled “through the wall” intros.',
    tip: 'Bright sounds grab attention but tire the ear. In a busy mix keep one or two parts bright and let the rest sit darker behind them.'
  },
  {
    id: 'body',
    name: 'Body',
    c: '#ff8a4c',
    ends: ['Thin', 'Fat'],
    page: 'osc',
    read: (v, ps) => clamp(avg(ps, i => num(v, 'SPTL' + i + '.FAT', 64) / 127)),
    set: (b, x) =>
      b.each(p => {
        b.set(p('SPTL') + '.FAT', x * 127);
        b.set(p('PTL') + '.STEREO_DETN', Math.max(0, x - 0.5) * 40);
        if (b.get(p('SPTL') + '.OSC_TYPE') === 3) b.set(p('SPTL') + '.SSAW_DETUNE', 20 + x * 100);
      }),
    what: 'Body is how much a sound fills out. Turned up, the oscillator gets fatter and slightly detuned copies spread it across the stereo field, the way two players never sit exactly in tune. Turned down it is a single, thin, focused line. Under the hood: Fat, stereo detune and the SuperSAW’s detune.',
    hear: 'Fat: trance supersaws, Reese basses, big pads. Thin: 8-bit leads, sub basses, tight plucks.',
    tip: 'Fat sounds take up room. Keep basses thinner so the low end stays solid, and save the width for pads and leads.'
  },
  {
    id: 'shape',
    name: 'Shape',
    c: '#ff5fa2',
    ends: ['Swell', 'Pluck'],
    page: 'amp',
    read: readShape,
    set: setShape,
    word: x => (x < 0.35 ? 'Swell' : x <= 0.6 ? 'Held' : 'Pluck'),
    what: 'Shape is a note’s life, its envelope. On the left notes fade in and ring on after you let go: a swell. In the middle they start at once and hold while the key is down, like an organ. On the right they start at once and die away even while held: a pluck. Under the hood: the amp envelope’s attack, decay, sustain and release.',
    hear: 'Swell: pads and strings. Held: organs and leads. Pluck: harps, marimbas, house stabs.',
    tip: 'Plucks leave gaps between notes, so they can play busy patterns without crowding a mix. Swells blur together, so give them slow chords.'
  },
  {
    id: 'motion',
    name: 'Motion',
    c: '#36e0c8',
    ends: ['Still', 'Moving'],
    page: 'motion',
    read: (v, ps) =>
      clamp(
        avg(ps, i =>
          Math.max(
            ...LFO_KEYS.map(x => Math.abs(num(v, 'LFO' + i + '.LFO' + x + '_DEPTH')) / 60),
            ...['1', '2'].map(x => Math.abs(num(v, 'LFO' + i + '.LFO' + x + '_PAN_DEPTH')) / 50)
          )
        )
      ),
    set: (b, x) =>
      b.each(p => {
        const l = p('LFO') + '.',
          ks = LFO_KEYS.map(k => l + 'LFO' + k + '_DEPTH');
        const cur = Math.max(...ks.map(k => Math.abs(b.get(k))));
        if (cur < 1) {
          /* nothing moving yet: a slow sweep of the filter */
          b.set(l + 'LFO2_FORM', 1);
          if (b.get(l + 'LFO2_RATE') > 700) b.set(l + 'LFO2_RATE', 520);
          b.set(l + 'LFO2_TVF_DEPTH', x * 60);
        } else for (const k of ks) b.set(k, (b.get(k) * x * 60) / cur);
      }),
    what: 'Motion is how much the sound moves by itself while a note is held. An LFO, a slow wave you don’t hear, pushes the filter, pitch or volume up and down. A little keeps a long note alive; a lot is a wobble. Under the hood: the depths of the two LFOs (on a still sound it starts a slow filter sweep).',
    hear: 'Dubstep wobbles, slowly breathing pads, vibrato on a lead, the pulsing of a tremolo.',
    tip: 'Sync the LFO to the tempo in Fine-tune › Motion and the movement locks to the groove: 1/4 for a pulse, 1/8T for a wobble.'
  },
  {
    id: 'space',
    name: 'Space',
    c: '#7fa7c9',
    ends: ['Dry', 'Distant'],
    page: 'fx',
    read: (v, ps) =>
      clamp(avg(ps, i => (num(v, 'PTL' + i + '.REV_SEND') + num(v, 'PTL' + i + '.CHO_SEND') * 0.7) / 140)),
    set: (b, x) =>
      b.each(p => {
        b.set(p('PTL') + '.REV_SEND', x * 100);
        b.set(p('PTL') + '.CHO_SEND', x * 57);
      }),
    what: 'Space is the room around a sound. Reverb is thousands of echoes blurring together; delay is distinct echoes. Sounds share the project’s reverb and delay and send some of themselves to them (Mixer › Master FX chooses their types). Under the hood: the reverb and delay sends.',
    hear: 'Lots: ambient, shoegaze, big trance leads. Little: tight funk, hip hop drums and basses.',
    tip: 'More space pushes a sound further back. Keep kick and bass mostly dry, and use space to put parts in front of or behind each other.'
  }
];
export const knob = id => KNOBS.find(k => k.id === id);
/** The word for where a knob is: its left end, the middle, or its right end. */
export const knobWord = (k, x) => (k.word ? k.word(x) : x < 0.12 ? k.ends[0] : x > 0.66 ? k.ends[1] : 'Some');

/* ---- the knob control: drag up and down (Shift: finer), the wheel, the arrow keys; double-click to go back ---- */
const NS = 'http://www.w3.org/2000/svg';
const A0 = 135,
  SPAN = 270;
const polar = (a, r) => [50 + r * Math.cos((a * Math.PI) / 180), 50 + r * Math.sin((a * Math.PI) / 180)];
function arc(a1, a2, r) {
  const [x1, y1] = polar(a1, r),
    [x2, y2] = polar(a2, r);
  return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${a2 - a1 > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}
/**
 * A knob.
 * @param {object} k  a knob from KNOBS
 * @param {object} on  {change(x, final), focus(), back() -> the value to go back to on double-click}
 * @returns {HTMLElement} with .show(x) to move it without a change
 */
export function knobEl(k, on) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100');
  svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML =
    `<path class="lkTrack" d="${arc(A0, A0 + SPAN, 40)}"/><path class="lkFill" d=""/>` +
    `<circle class="lkCap" cx="50" cy="50" r="29"/><line class="lkTick" x1="50" y1="50" x2="50" y2="26"/>`;
  const val = el('b', { class: 'lkVal' }),
    word = el('small', { class: 'lkWord' });
  const box = el(
    'div',
    {
      class: 'lkKnob',
      role: 'slider',
      tabindex: '0',
      'aria-label': k.name,
      'aria-valuemin': 0,
      'aria-valuemax': 100,
      'data-id': k.id,
      style: '--kc:' + k.c,
      title:
        k.name +
        ': drag up or down (Shift for fine), scroll, or use the arrow keys. Double-click: back to where it was.'
    },
    el('span', { class: 'lkName' }, k.name),
    svg,
    val,
    word
  );
  let x = 0;
  const show = nx => {
    x = clamp(nx);
    const a = A0 + SPAN * x;
    svg.querySelector('.lkFill').setAttribute('d', x > 0.003 ? arc(A0, a, 40) : '');
    svg.querySelector('.lkTick').setAttribute('transform', `rotate(${a + 90} 50 50)`);
    val.textContent = String(Math.round(x * 100));
    word.textContent = knobWord(k, x);
    box.setAttribute('aria-valuenow', Math.round(x * 100));
    box.setAttribute('aria-valuetext', Math.round(x * 100) + ', ' + knobWord(k, x));
  };
  const move = (nx, final) => {
    show(nx);
    on.change(x, final);
  };
  box.addEventListener('pointerdown', e => {
    if (e.button) return;
    e.preventDefault();
    box.focus();
    on.focus();
    box.setPointerCapture(e.pointerId);
    box.classList.add('drag');
    let y = e.clientY,
      moved = false;
    const mv = ev => {
      const dy = y - ev.clientY;
      y = ev.clientY;
      if (!dy) return;
      moved = true;
      move(x + dy / (ev.shiftKey ? 900 : 180), false);
    };
    const up = () => {
      box.removeEventListener('pointermove', mv);
      box.removeEventListener('pointerup', up);
      box.removeEventListener('pointercancel', up);
      box.classList.remove('drag');
      if (moved) on.change(x, true);
    };
    box.addEventListener('pointermove', mv);
    box.addEventListener('pointerup', up);
    box.addEventListener('pointercancel', up);
  });
  box.addEventListener(
    'wheel',
    e => {
      e.preventDefault();
      on.focus();
      move(x - Math.sign(e.deltaY) * (e.shiftKey ? 0.01 : 0.04), true);
    },
    { passive: false }
  );
  box.addEventListener('keydown', e => {
    const d = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 10, PageDown: -10 }[e.key];
    if (d == null && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    e.stopPropagation();
    on.focus();
    move(e.key === 'Home' ? 0 : e.key === 'End' ? 1 : x + d * (e.shiftKey ? 0.01 : 0.05), true);
  });
  box.addEventListener('dblclick', () => move(on.back(), true));
  box.addEventListener('focus', () => on.focus());
  box.addEventListener('pointerenter', () => on.focus(true));
  box.show = show;
  return box;
}
