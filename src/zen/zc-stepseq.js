// The step sequencer inside a tone: each partial's STEP LFO 1 plays a 16-step note pattern (pitch
// depth 63, so 4 step units are one semitone) and STEP LFO 2 shapes each step on the amp (-72 rests a
// step). Tempo-synced, so one held key plays a riff; four partials give four voices. The idea and the
// numbers come from Benedetto Schiavone's ZEN-Core editor manual.
//
// Reads: the sound through the editor's ctx.
import { el } from '../core/dom.js';
import { group } from './zc-widgets.js';
import { pk } from './zc-tone.js';

const UNIT = 4; /* step units per semitone at pitch depth 63 */
const REST = -72;
const RATES = ['1/32', '1/16T', '1/16', '1/8T', '1/8', '1/4'];
const RATE_IX = { '1/32': 3, '1/16T': 4, '1/16': 6, '1/8T': 7, '1/8': 9, '1/4': 12 };
const SHAPES = [
  ['Smooth', 1],
  ['Plucky', 11],
  ['Punchy', 15],
  ['Short', 20]
];
/** Note patterns in semitones from the key you hold (null = rest). */
export const SEQ_PATTERNS = [
  ['Octave bounce', [0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12, 0, 12]],
  ['Minor arp up', [0, 3, 7, 12, 0, 3, 7, 12, 0, 3, 7, 12, 0, 3, 7, 12]],
  ['Major arp up and down', [0, 4, 7, 12, 16, 12, 7, 4, 0, 4, 7, 12, 16, 12, 7, 4]],
  ['Acid run', [0, 0, 12, 0, 3, null, 0, 15, 0, 12, null, 7, 0, 10, 12, 0]],
  ['Trance gate (root)', [0, 0, null, 0, 0, null, 0, null, 0, 0, null, 0, 0, null, 0, null]],
  ['Rolling bass', [0, null, 0, 12, 0, null, 0, 7, 0, null, 0, 12, 0, null, 10, 7]],
  ['Fifths stab', [0, null, null, 7, null, null, 12, null, 0, null, null, 7, null, 10, null, null]],
  ['Rest all', Array(16).fill(null)]
];

const k = (ctx, lfo, id) => pk('LFO', ctx.part, 'LFO' + lfo + '_' + id);
/** True when this partial is set up as a step sequence. */
export const isSeq = ctx => ctx.get(k(ctx, 1, 'FORM')) === 10 && ctx.get(k(ctx, 1, 'PIT_DEPTH')) === 63;

/** Turn the shown partial (and any partials linked to it) into a step sequence, as one undo step. */
export function seqTemplate(ctx, shape = 11) {
  const set = (key, v) => ctx.set(key, v, false);
  for (const lfo of [1, 2]) {
    set(k(ctx, lfo, 'FORM'), 10);
    set(k(ctx, lfo, 'RATE_SYNC'), 1);
    set(k(ctx, lfo, 'RATE_NOTE'), RATE_IX['1/16']);
    set(k(ctx, lfo, 'STEP_MAX'), 15);
    set(k(ctx, lfo, 'KEY_TRIG'), 1);
    for (const d of ['DELAY', 'FADE', 'OFST', 'PAN_DEPTH', 'TVF_DEPTH']) set(k(ctx, lfo, d), 0);
  }
  set(k(ctx, 1, 'PIT_DEPTH'), 63);
  set(k(ctx, 1, 'TVA_DEPTH'), 0);
  set(k(ctx, 2, 'PIT_DEPTH'), 0);
  set(k(ctx, 2, 'TVA_DEPTH'), 100);
  for (let i = 1; i <= 16; i++) {
    set(k(ctx, 1, 'STEP_' + i), 0);
    set(k(ctx, 2, 'STEP_' + i), 0);
    set(k(ctx, 2, 'STEP_CURVE_' + i), shape);
  }
  for (const s of ['FENV_LFO_TRIG_SW', 'AENV_LFO_TRIG_SW']) set(pk('SPTL', ctx.part, s), 1);
  ctx.commit();
}
/** Put a pattern (semitones, null = rest) into the shown partial's steps, as one undo step. */
export function seqPattern(ctx, notes) {
  notes.forEach((n, i) => {
    ctx.set(k(ctx, 1, 'STEP_' + (i + 1)), n == null ? 0 : n * UNIT, false);
    ctx.set(k(ctx, 2, 'STEP_' + (i + 1)), n == null ? REST : 0, false);
  });
  ctx.commit();
}
const both = (ctx, id, v) => {
  ctx.set(k(ctx, 1, id), v, false);
  ctx.set(k(ctx, 2, id), v, false);
  ctx.commit();
};
const interval = s =>
  (s > 0 ? '+' : '') +
  s +
  ({ 0: ' root', 12: ' oct', '-12': ' oct', 7: ' 5th', '-5': ' 5th', 3: ' m3', 4: ' M3' }[s] || '');

function stepCell(ctx, i, len) {
  const semis = Math.round(ctx.get(k(ctx, 1, 'STEP_' + (i + 1))) / UNIT),
    rest = ctx.get(k(ctx, 2, 'STEP_' + (i + 1))) <= REST + 8;
  const sel = el(
    'select',
    { onchange: e => ctx.set(k(ctx, 1, 'STEP_' + (i + 1)), +e.target.value * UNIT, true) },
    ...[...Array(37)].map((_, j) => el('option', { value: 18 - j, selected: 18 - j === semis }, interval(18 - j)))
  );
  const gate = el(
    'button',
    {
      type: 'button',
      class: 'zcSw' + (rest ? '' : ' on'),
      title: rest ? 'Rest: click to play this step' : 'Plays: click to rest this step',
      onclick: () => ctx.set(k(ctx, 2, 'STEP_' + (i + 1)), rest ? 0 : REST, true)
    },
    rest ? 'rest' : 'play'
  );
  return el(
    'div',
    { class: 'zcSeqStep' + (i > len ? ' off' : '') },
    el('span', { class: 'zcL' }, String(i + 1)),
    sel,
    gate
  );
}

function seqTools(ctx) {
  const pick = (label, opts, cur, on) =>
    el(
      'label',
      { class: 'zcC' },
      el('span', { class: 'zcL' }, label),
      el(
        'select',
        { onchange: e => on(e.target.value) },
        ...opts.map(([t, v]) => el('option', { value: v, selected: String(v) === String(cur) }, t))
      )
    );
  const rate = ctx.get(k(ctx, 1, 'RATE_NOTE')),
    len = ctx.get(k(ctx, 1, 'STEP_MAX')),
    shape = ctx.get(k(ctx, 2, 'STEP_CURVE_1'));
  return [
    pick(
      'Step length',
      RATES.map(r => [r, RATE_IX[r]]),
      rate,
      v => both(ctx, 'RATE_NOTE', +v)
    ),
    pick(
      'Steps',
      [...Array(16)].map((_, i) => [String(i + 1), i]),
      len,
      v => both(ctx, 'STEP_MAX', +v)
    ),
    pick('Step shape', SHAPES, shape, v => {
      for (let i = 1; i <= 16; i++) ctx.set(k(ctx, 2, 'STEP_CURVE_' + i), +v, false);
      ctx.commit();
    }),
    pick('Pattern', [['Choose…', -1], ...SEQ_PATTERNS.map(([n], i) => [n, i])], -1, v => {
      if (+v >= 0) seqPattern(ctx, SEQ_PATTERNS[+v][1]);
    })
  ];
}

/** The Step sequencer group for the LFO page. */
export function stepSeq(ctx) {
  if (!isSeq(ctx))
    return group(
      'Step sequencer',
      el(
        'p',
        { class: 'hint zcWide' },
        'Turns this partial into a 16-step riff that plays in time while you hold a key: LFO 1 plays the notes, LFO 2 shapes each step. Link partials first to set up several at once, then give each its own pattern for up to four voices. VA, SuperSAW and noise oscillators restart on every step; PCM waves only at the start of the note.'
      ),
      el(
        'button',
        { type: 'button', class: 'btn', onclick: () => seqTemplate(ctx) },
        'Make this partial a step sequence'
      )
    );
  const len = ctx.get(k(ctx, 1, 'STEP_MAX'));
  return group(
    'Step sequencer',
    ...seqTools(ctx),
    el('div', { class: 'zcSeq zcWide' }, ...[...Array(16)].map((_, i) => stepCell(ctx, i, len))),
    el(
      'p',
      { class: 'hint zcWide' },
      'Hold a key: each step plays its interval from that key. Mono (Common page) keeps one riff per key; the steps follow the MC-707 tempo.'
    )
  );
}
