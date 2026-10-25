// Scene Mode's Pump window for a clip: duck the part on every kick (Volume or Filter), how deep, how fast it
// comes back and where it rests, with a drawing of the move over the clip and the kicks it follows. The
// pump is written into the clip's motion with the clip (write.js), so the MC-707 pumps by itself.
//
// Reads: S, SC.
import { el } from '../core/dom.js';
import { S } from '../core/state.js';
import { TRACK_COLORS, devNum } from '../core/device.js';
import { PUMP_DEPTH, PUMP_MODES, PUMP_REL, PUMP_REST, newPump } from '../core/pump.js';
import { SC, clipAt, setPump } from './model.js';
import { sceneLabel } from './names.js';
import { pumpMotion } from './write.js';

const DEPTH_NAMES = { light: 'Light', medium: 'Medium', heavy: 'Heavy' };
const REL_TIPS = { '1/16': 'Tight and fast', '1/8': 'The classic pump', '1/4': 'Slow and breathing' };

/* the move over the clip: the value line, the kicks as ticks, bar lines */
function drawing(t, k) {
  const pm = pumpMotion(t, k);
  const W = 640,
    H = 120,
    pad = 6;
  if (!pm) return el('div', { class: 'pmEmpty hint' }, 'Pump is off for this clip.');
  const len = pm.steps * pm.k,
    x = s => pad + ((W - 2 * pad) * s) / len,
    y = v => pad + (H - 2 * pad) * (1 - v / 127),
    dt = pm.k / 8;
  const pts = pm.vals.map((v, i) => x(i * dt).toFixed(1) + ',' + y(v).toFixed(1)).join(' ');
  const ns = 'http://www.w3.org/2000/svg',
    svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
  svg.setAttribute('class', 'pmDraw');
  svg.setAttribute('role', 'img');
  svg.setAttribute(
    'aria-label',
    'The ' + (pm.lane === 3 ? 'volume' : 'filter') + ' over the clip, dipping on ' + pm.kicks.length + ' kicks'
  );
  const add = (tag, at) => {
    const n = document.createElementNS(ns, tag);
    for (const a in at) n.setAttribute(a, at[a]);
    svg.append(n);
  };
  for (let b = 0; b <= len; b += 16) add('line', { x1: x(b), x2: x(b), y1: pad, y2: H - pad, class: 'pmBar' });
  for (const kk of pm.kicks) add('line', { x1: x(kk.s), x2: x(kk.s), y1: H - pad - 10, y2: H - pad, class: 'pmKick' });
  add('polyline', { points: pts, class: 'pmLine' });
  return svg;
}

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
              seg(
                'Comes back in',
                Object.keys(PUMP_REL).map(v => [v, v, REL_TIPS[v]]),
                pump.rel,
                v => set({ rel: v })
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
              drawing(t, k),
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
          : drawing(t, k),
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
