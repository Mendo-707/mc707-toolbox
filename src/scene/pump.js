// Scene Mode's Pump window for a clip: duck the part on every kick (Volume or Filter), how deep, where it
// rests, and finely (in eighths of a 16th, with the time in ms at the song's tempo) when it starts, how long
// it holds and how long it takes to come back, eased or straight, since that timing shapes the groove.
// Drawn over the whole clip and close up around the first kick, with the kicks it follows. The
// pump is written into the clip's motion with the clip (write.js), so the MC-707 pumps by itself.
//
// Reads: S, SC.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { TRACK_COLORS, devNum } from '../core/device.js';
import {
  PUMP_CURVES,
  PUMP_DEPTH,
  PUMP_FINE,
  PUMP_MODES,
  PUMP_REL,
  PUMP_REST,
  PUMP_TIME,
  newPump
} from '../core/pump.js';
import { SC, clipAt, setPump } from './model.js';
import { sceneLabel } from './names.js';
import { pumpMotion } from './write.js';

const DEPTH_NAMES = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };
const REL_TIPS = { '1/16': 'Tight and fast', '1/8': 'The classic pump', '1/4': 'Slow and breathing' };

/* a time in 16ths as words: whole 16ths and eighths of one (⅛ ¼ ⅜ ½ ⅝ ¾ ⅞), and in ms at the tempo */
const EIGHTHS = ['', '⅛', '¼', '⅜', '½', '⅝', '¾', '⅞'];
export function timeText(v) {
  const a = Math.abs(v),
    whole = Math.floor(a + 1e-9),
    part = Math.round((a - whole) * 8) % 8,
    n = (whole ? String(whole) : '') + EIGHTHS[part] || '0';
  return n + (a > 0 && a <= 1 ? ' 16th' : ' 16ths') + ' · ' + Math.round((a * 15000) / (S.bpm || 120)) + ' ms';
}
const startText = v =>
  Math.abs(v) < 1e-9 ? 'on the kick' : timeText(v).replace(' · ', v < 0 ? ' early · ' : ' late · ');

/*
 * The move: over the whole clip (bars, kicks as ticks), or close up around the first kick (from a 16th
 * before it, over the time it takes to come back; 16ths marked, each motion point a dot).
 */
function drawing(pm, close = false) {
  const W = 640,
    H = close ? 150 : 110,
    pad = 8,
    dt = pm.k / 8,
    len = pm.steps * pm.k,
    k0 = pm.kicks.length ? pm.kicks[0].s : 0,
    from = close ? k0 - 1 : 0,
    to = close ? Math.min(len + k0, k0 + Math.max(4, Math.ceil(TAIL(pm) + 1))) : len,
    x = s => pad + ((W - 2 * pad) * (s - from)) / (to - from),
    y = v => pad + (H - 2 * pad - (close ? 14 : 0)) * (1 - v / 127);
  const ns = 'http://www.w3.org/2000/svg',
    svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('class', 'pmDraw' + (close ? ' pmClose' : ''));
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    close
      ? 'Close up on the first kick: the ' + (pm.lane === 3 ? 'volume' : 'filter') + ' point by point'
      : 'The ' + (pm.lane === 3 ? 'volume' : 'filter') + ' over the clip, dipping on ' + pm.kicks.length + ' kicks'
  );
  const add = (tag, at, text) => {
    const n = document.createElementNS(ns, tag);
    for (const a in at) n.setAttribute(a, at[a]);
    if (text) n.textContent = text;
    svg.append(n);
  };
  /* points, the clip looping round so a close-up past its end carries on from its start */
  const at = s => pm.vals[((Math.round(s / dt) % pm.vals.length) + pm.vals.length) % pm.vals.length];
  if (close)
    for (let s = Math.ceil(from); s <= to; s++) {
      add('line', { x1: x(s), x2: x(s), y1: pad, y2: H - pad - 14, class: 'pmBar' });
      if (x(s) < W - 24)
        add('text', { x: x(s) + 3, y: H - 4, class: 'pmTick' }, s === k0 ? 'kick' : (s > k0 ? '+' : '') + (s - k0));
    }
  else for (let b = 0; b <= len; b += 16) add('line', { x1: x(b), x2: x(b), y1: pad, y2: H - pad, class: 'pmBar' });
  for (const kk of pm.kicks)
    if (kk.s >= from && kk.s <= to)
      add('line', {
        x1: x(kk.s),
        x2: x(kk.s),
        y1: close ? pad : H - pad - 10,
        y2: H - pad - (close ? 14 : 0),
        class: 'pmKick'
      });
  const pts = [];
  for (let s = Math.ceil(from / dt) * dt; s <= to + 1e-9; s += dt) pts.push([x(s), y(at(s))]);
  add('polyline', { points: pts.map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '), class: 'pmLine' });
  if (close)
    for (const [px, py] of pts) add('circle', { cx: px.toFixed(1), cy: py.toFixed(1), r: 2.2, class: 'pmDot' });
  return svg;
}
/* how long after a kick the move lasts, in 16ths */
const TAIL = pm => {
  const p = pm.pump;
  return (p.start > 0 ? p.start : 0) + p.hold + p.rel * (p.curve === 'straight' ? 1 : 1.6);
};

/** Open the Pump window for clip k of track t. */
export function pumpOpen(t, k) {
  document.getElementById('pmOv')?.remove();
  const box = el('div', { class: 'ptBox pmBox', style: '--tc:' + TRACK_COLORS[t] });
  const ov = el('div', { id: 'pmOv', class: 'ptOv', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Pump' }, box);
  const close = () => (ov.remove(), (SC.pumpDraw = null));
  const seg = (label, opts, cur, pick) =>
    el(
      'div',
      { class: 'pmRow' },
      el('span', { class: 'pmLab' }, label),
      el(
        'span',
        { class: 'grp', role: 'radiogroup', 'aria-label': label },
        ...opts.map(([v, l, tip]) =>
          el(
            'button',
            {
              type: 'button',
              role: 'radio',
              'aria-checked': String(cur === v),
              class: 'btn sm' + (cur === v ? ' on' : ''),
              title: tip || l,
              onclick: () => pick(v)
            },
            l
          )
        )
      )
    );
  /* the drawings, for the clip's pump or a draft while a slider moves */
  const viewBox = el('div', { class: 'pmViews' });
  const showViews = pump => {
    const pm = pumpMotion(t, k, undefined, pump);
    if (pm) pm.pump = { ...newPump(pump.mode), ...pump };
    viewBox.replaceChildren(
      ...(pm
        ? [
            el('div', { class: 'pmCap' }, 'The whole clip'),
            drawing(pm),
            el('div', { class: 'pmCap' }, 'Close up on the first kick (each dot is one motion point)'),
            drawing(pm, true)
          ]
        : [])
    );
  };
  const views = () => (showViews(clipAt(t, k).pump), viewBox);
  /* a fine time setting: a slider in eighths of a 16th, the time in words and ms, quick choices after it */
  const fineRow = (label, which, pump, set, words, tip, extra = []) => {
    const [lo, hi] = PUMP_TIME[which],
      val = el('span', { class: 'pmVal' }, words(pump[which]));
    const slider = el('input', {
      type: 'range',
      min: lo,
      max: hi,
      step: PUMP_FINE,
      value: pump[which],
      title: tip,
      'aria-label': label + ' (in eighths of a 16th)',
      oninput: e => {
        const v = +e.target.value;
        val.textContent = words(v);
        showViews({ ...pump, [which]: v });
      },
      onchange: e => set({ [which]: +e.target.value })
    });
    const nudge = d =>
      el(
        'button',
        {
          type: 'button',
          class: 'btn sm',
          title: (d < 0 ? 'Less' : 'More') + ' by an eighth of a 16th',
          onclick: () => set({ [which]: Math.max(lo, Math.min(hi, pump[which] + d * PUMP_FINE)) })
        },
        d < 0 ? '−' : '+'
      );
    return el(
      'div',
      { class: 'pmRow', title: tip },
      el('span', { class: 'pmLab' }, label),
      nudge(-1),
      slider,
      nudge(1),
      val,
      ...extra
    );
  };
  const draw = () => {
    const c = clipAt(t, k);
    if (!c) return close();
    const p = S.patterns[c.pat],
      pump = c.pump,
      set = ch => setPump(t, k, { ...pump, ...ch }),
      pm = pumpMotion(t, k);
    const src = pm && pm.src;
    const from = !pump
      ? null
      : !src
        ? el(
            'p',
            { class: 'pmWarn' },
            'This clip is in no scene yet, so there are no kicks to follow. Put it in a scene with a kit clip.'
          )
        : !src.from.length
          ? el(
              'p',
              { class: 'pmWarn' },
              'No kit clip with kicks plays alongside it (in ' +
                src.scenes.map(sceneLabel).join(', ') +
                '), so it has nothing to follow.'
            )
          : el(
              'p',
              { class: 'hint' },
              'Follows the kicks in ' +
                src.from.map(([tt, kk]) => 'track ' + devNum(tt) + ' clip ' + (kk + 1)).join(' and ') +
                ' (as in scene' +
                (src.scenes.length === 1 ? ' ' : 's ') +
                src.scenes.map(sceneLabel).join(', ') +
                ')' +
                (src.differ
                  ? '. Other scenes play this clip with different kicks: one clip has one pump, so it follows the kicks most of its scenes have.'
                  : '.')
            );
    box.replaceChildren(
      ...[
        el('h3', {}, 'Pump: track ' + devNum(t) + ' ' + S.tracks[t].name + ', clip ' + (k + 1)),
        el(
          'p',
          { class: 'hint' },
          p.name +
            '. The part ducks on every kick and comes back, like sidechain compression. It is written into the clip’s motion with the clip, so the MC-707 pumps it by itself.'
        ),
        seg('Pump', [['off', 'Off'], ...PUMP_MODES.map(([v, l]) => [v, l])], pump ? pump.mode : 'off', v =>
          setPump(t, k, v === 'off' ? null : pump ? { ...pump, mode: v, rest: PUMP_REST[v] } : newPump(v))
        ),
        pump
          ? [
              seg(
                'Depth',
                Object.keys(PUMP_DEPTH).map(v => [v, DEPTH_NAMES[v]]),
                pump.depth,
                v => set({ depth: v })
              ),
              fineRow(
                'Starts',
                'start',
                pump,
                set,
                startText,
                'When the dip starts against the kick: a little late can let the kick through and push the groove'
              ),
              fineRow('Holds down', 'hold', pump, set, timeText, 'How long it stays all the way down'),
              fineRow(
                'Comes back in',
                'rel',
                pump,
                set,
                timeText,
                'How long it takes to come back: the most groove-shaping setting',
                Object.entries(PUMP_REL).map(([l, v]) =>
                  el(
                    'button',
                    {
                      type: 'button',
                      class: 'btn sm' + (pump.rel === v ? ' on' : ''),
                      title: REL_TIPS[l],
                      onclick: () => set({ rel: v })
                    },
                    l
                  )
                )
              ),
              seg(
                'Comes back',
                PUMP_CURVES.map(([v, l]) => [
                  v,
                  l,
                  v === 'eased'
                    ? 'Fast at first, then easing in, like a compressor'
                    : 'At an even rate, all the way back by the time set (as in Ada’s tool)'
                ]),
                pump.curve,
                v => set({ curve: v })
              ),
              el(
                'div',
                { class: 'pmRow' },
                el('span', { class: 'pmLab' }, 'Rests at'),
                el('input', {
                  type: 'number',
                  min: 1,
                  max: 127,
                  value: pump.rest,
                  'aria-label': 'The value it rests at between kicks (1-127)',
                  onchange: e => set({ rest: +e.target.value })
                }),
                el(
                  'span',
                  { class: 'hint' },
                  pump.mode === 'level'
                    ? 'The part’s level between kicks (100 is a good start; 127 is full).'
                    : 'The filter between kicks (127 is fully open; lower if the sound is darker).'
                )
              ),
              views(),
              from,
              el(
                'p',
                { class: 'pmNote' },
                pump.mode === 'level'
                  ? 'On the MC-707, once per track: press KNOB ASSIGN with track ' +
                      devNum(t) +
                      ' selected and set SOUND (C4) to Level. The pump moves that knob; set to something else, it moves that instead.'
                  : 'The pump moves the FILTER knob (cutoff, unless KNOB ASSIGN has it on something else on track ' +
                      devNum(t) +
                      ').'
              )
            ]
          : el('div', { class: 'pmEmpty hint' }, 'Pump is off for this clip.'),
        el(
          'div',
          { style: 'display:flex;justify-content:flex-end;gap:8px' },
          el(
            'span',
            { class: 'hint', style: 'margin-right:auto;align-self:center' },
            'Write the clip to put the pump on the MC-707.'
          ),
          el('button', { type: 'button', class: 'btn', onclick: close }, 'Done')
        )
      ].flat()
    );
  };
  SC.pumpDraw = draw;
  draw();
  ov.addEventListener('keydown', e => e.key === 'Escape' && close());
  ov.addEventListener('click', e => e.target === ov && close());
  document.body.append(ov);
}
