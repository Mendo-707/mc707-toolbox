// The Clip options panel: fine position, length, transpose, velocity, fades and the MC-707 clip to
// launch.
//
// Reads: S, ED, TR.
import { clamp, el } from '../core/dom.js';
import { devNm } from '../core/device.js';
import { ED, S, pushUndo } from '../core/state.js';
import { scheduleUI } from './arrangement.js';
import { curPat, touch } from '../core/song-model.js';
import { drawEditor } from './editor.js';
import { TR, startPat } from '../services/transport.js';
import { cmFix } from '../services/clip-switch.js';
import { cmLabel } from '../clips/clip-map.js';
import { loopClip, playFrom } from './clip-ops.js';
import { setGeom } from './layout.js';

export function clipOptionsEl(c, p, isDrum) {
  const clipOpt = el('details', { class: 'clipopt' }, el('summary', { class: 'btn sm' }, 'Clip options'));
  const panel = el('div', { class: 'clippanel' });
  const row = (label, ctl) => el('label', { class: 'cprow' }, el('span', {}, label), ctl);
  const muteBtn = el(
    'button',
    {
      class: 'btn sm' + (c.mute ? ' on' : ''),
      onclick: () => {
        pushUndo();
        c.mute = !c.mute;
        muteBtn.classList.toggle('on', !!c.mute);
        muteBtn.textContent = c.mute ? 'Muted' : 'Mute clip';
        scheduleUI();
      }
    },
    c.mute ? 'Muted' : 'Mute clip'
  );
  panel.append(row('Mute', muteBtn));
  const stepIn = (label, val, min, fn, title) =>
    row(
      label,
      el('input', {
        type: 'number',
        min,
        step: 0.0625,
        value: +(val * 16).toFixed(4),
        style: 'width:84px',
        title: title || 'In steps (16 steps = 1 bar). Fractions work: 2.5 is half a step later',
        'aria-label': label,
        onchange: e => {
          const v = Math.round(+e.target.value * 16) / 16;
          fn(Number.isFinite(v) ? Math.max(min, v) : min);
        }
      })
    );
  panel.append(
    el(
      'div',
      { class: 'hint', style: 'margin-top:2px' },
      'Fine position, in steps (16 steps = 1 bar, 4 steps = 1 beat). Fractions work, down to 1/16 of a step:'
    ),
    stepIn('Start (from bar 1)', c.start, 0, v => setGeom(c, { start: v / 16 })),
    stepIn('Length', c.len, 0.25, v => setGeom(c, { len: v / 16 })),
    stepIn(
      'Start inside the pattern',
      c.off,
      0,
      v => setGeom(c, { off: v / 16 }),
      'Where in the pattern this clip begins playing'
    ),
    stepIn(
      'Loop length (0 = whole pattern)',
      c.ll || 0,
      0,
      v => setGeom(c, { ll: v / 16 }),
      'Repeat only this much of the pattern. Odd lengths make polyrhythms.'
    )
  );
  if (!isDrum) {
    const ts = el('select', {
      'aria-label': 'Transpose clip',
      onchange: e => {
        pushUndo();
        const v = +e.target.value;
        if (v) c.tr = v;
        else delete c.tr;
        scheduleUI();
      }
    });
    for (let v = -12; v <= 12; v++)
      ts.append(el('option', { value: v, selected: (c.tr || 0) === v }, (v > 0 ? '+' : '') + v + ' semitones'));
    panel.append(row('Transpose (this clip only)', ts));
  }
  {
    const mm = cmFix()[c.t],
      ps = el(
        'select',
        {
          title:
            'Switches this MC-707 track to a clip when this clip starts. Set up the clips in Settings › Your MC-707 clips.',
          'aria-label': 'MC-707 clip',
          onchange: e => {
            pushUndo();
            const v = e.target.value;
            if (v === '') delete c.pc;
            else c.pc = +v;
            scheduleUI();
          }
        },
        el('option', { value: '' }, S.clipAuto ? 'Automatic (by kind of part)' : 'No clip change')
      );
    for (let k = 0; k < 16; k++)
      if (k < mm.n || c.pc === k)
        ps.append(
          el(
            'option',
            { value: k, selected: c.pc === k },
            k < mm.n ? cmLabel(c.t, k) : 'Clip ' + (k + 1) + ' (not set up)'
          )
        );
    panel.append(row('Launch ' + devNm() + ' clip', ps));
  }
  panel.append(
    row(
      'Velocity %',
      el('input', {
        type: 'number',
        min: 10,
        max: 200,
        step: 5,
        value: c.vel || 100,
        style: 'width:70px',
        'aria-label': 'Clip velocity percent',
        onchange: e => {
          pushUndo();
          const v = clamp(Math.round(+e.target.value) || 100, 10, 200);
          if (v === 100) delete c.vel;
          else c.vel = v;
          scheduleUI();
        }
      })
    )
  );
  if (p.bars > 1) {
    const ar = el('select', {
      'aria-label': 'Audition loop range',
      onchange: e => {
        const v = e.target.value;
        if (v === 'all') ED.aud = null;
        else {
          const [a, b2] = v.split('-').map(Number);
          ED.aud = [a, b2];
        }
        if (TR.playing && TR.mode === 'pat' && TR.pat === p) startPat(p, c.t, ED.aud);
      }
    });
    ar.append(el('option', { value: 'all', selected: !ED.aud }, 'Whole pattern'));
    for (let i = 0; i < p.bars; i++)
      ar.append(
        el(
          'option',
          { value: i + '-' + (i + 1), selected: !!ED.aud && ED.aud[0] === i && ED.aud[1] === i + 1 },
          'Bar ' + (i + 1) + ' only'
        )
      );
    if (p.bars > 2)
      for (let i = 0; i + 2 <= p.bars; i += 2)
        ar.append(
          el(
            'option',
            { value: i + '-' + (i + 2), selected: !!ED.aud && ED.aud[0] === i && ED.aud[1] === i + 2 },
            'Bars ' + (i + 1) + '–' + (i + 2)
          )
        );
    panel.append(row('Pattern preview loop', ar));
  }
  panel.append(
    el(
      'div',
      { class: 'row', style: 'display:flex;gap:6px;flex-wrap:wrap' },
      el('button', { class: 'btn sm', onclick: () => loopClip(c) }, 'Loop this clip'),
      el('button', { class: 'btn sm', onclick: () => playFrom(c.start) }, 'Play from clip start')
    )
  );
  clipOpt.append(panel);
  clipOpt.addEventListener('toggle', () => {
    if (clipOpt.open) {
      const r = panel.getBoundingClientRect();
      panel.style.maxHeight = Math.max(160, innerHeight - r.top - 12) + 'px';
    }
  });
  return clipOpt;
}
export function edOp(fn) {
  const p = curPat();
  if (!p) return;
  pushUndo();
  fn(p);
  touch(p);
  drawEditor();
}
export function fillRow(p, id, every) {
  const N = p.bars * 16;
  const drum = p.type === 'drum';
  for (let s = 0; s < N; s += every)
    if (!p.notes.some(n => n.n === id && Math.floor(n.s) === s))
      p.notes.push({ s, l: drum ? 1 : Math.max(1, Math.min(every, 2)), n: id, v: 100 });
}
